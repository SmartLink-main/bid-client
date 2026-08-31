import { inflateRawSync } from 'node:zlib'

export const CODE_SOURCE_PAGE_URL =
  'https://www.code.go.kr/stdcode/regCodeL.do'
export const CODE_DOWNLOAD_ENDPOINT =
  'https://www.code.go.kr/etc/codeFullDown.do'

const provinceSourceOverrides = new Map([
  ['광주', '전남광주통합특별시'],
  ['전남', '전남광주통합특별시'],
])

// 2026-07-01 인천 자치구 개편 뒤에도 기존 프런트의 중구·동구·서구 선택을
// 안전하게 갱신할 수 있도록, 현행 구와 폐지 전 법정동 소속을 함께 대조한다.
const currentIncheonDistrictsByLegacySelection = new Map([
  ['인천|중구', ['제물포구', '영종구']],
  ['인천|동구', ['제물포구']],
  ['인천|서구', ['서해구', '검단구']],
])

export function parseFrontendRegionCatalog(source) {
  const provinceBlock = source.match(
    /export const REGION_PROVINCES:[^=]+?=\s*\[([\s\S]*?)\];/,
  )?.[1]
  const sigunguBlock = source.match(
    /export const SIGUNGU_BY_PROVINCE:[^=]+?=\s*\{([\s\S]*?)\n\};/,
  )?.[1]
  const provinceTermsBlock = source.match(
    /export const PROVINCE_SEARCH_TERMS:[^=]+?=\s*\{([\s\S]*?)\n\};/,
  )?.[1]

  if (!provinceBlock || !sigunguBlock || !provinceTermsBlock) {
    throw new Error('search-filter-options.ts의 지역 상수를 읽지 못했습니다.')
  }

  const provinces = [...provinceBlock.matchAll(/'([^']+)'/g)].map(
    ([, province]) => province,
  )
  const sigunguByProvince = Object.fromEntries(
    [...sigunguBlock.matchAll(/^\s*'([^']+)':\s*\[([^\]]+)\],?$/gm)].map(
      ([, province, items]) => [
        province,
        [...items.matchAll(/'([^']+)'/g)].map(([, item]) => item),
      ],
    ),
  )
  const provinceSearchTerms = Object.fromEntries(
    [...provinceTermsBlock.matchAll(/^\s*'([^']+)':\s*'([^']+)',?$/gm)].map(
      ([, province, term]) => [province, term],
    ),
  )

  if (
    provinces.some(
      (province) =>
        !sigunguByProvince[province] || !provinceSearchTerms[province],
    )
  ) {
    throw new Error('시도·시군구·검색어 상수의 키가 서로 일치하지 않습니다.')
  }

  return { provinces, sigunguByProvince, provinceSearchTerms }
}

function extractFirstZipEntry(archive) {
  if (archive.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('법정동 전체자료 응답이 ZIP 파일이 아닙니다.')
  }

  const compressionMethod = archive.readUInt16LE(8)
  const compressedSize = archive.readUInt32LE(18)
  const fileNameLength = archive.readUInt16LE(26)
  const extraFieldLength = archive.readUInt16LE(28)
  const contentStart = 30 + fileNameLength + extraFieldLength
  const compressedContent = archive.subarray(
    contentStart,
    contentStart + compressedSize,
  )

  if (compressionMethod === 0) return compressedContent
  if (compressionMethod === 8) return inflateRawSync(compressedContent)

  throw new Error(`지원하지 않는 ZIP 압축 방식입니다: ${compressionMethod}`)
}

export async function downloadOfficialRows() {
  const response = await fetch(CODE_DOWNLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ codeseId: '법정동코드' }),
  })

  if (!response.ok) {
    throw new Error(`법정동 전체자료 다운로드 실패: HTTP ${response.status}`)
  }

  const archive = Buffer.from(await response.arrayBuffer())
  const decoded = new TextDecoder('euc-kr').decode(
    extractFirstZipEntry(archive),
  )

  return decoded
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [code, name, status] = line.split('\t')
      return {
        code: code?.trim(),
        name: name?.trim(),
        status: status?.trim(),
      }
    })
    .filter(
      ({ code, name, status }) =>
        /^\d{10}$/.test(code) && Boolean(name) && Boolean(status),
    )
}

export function isEupMyeonDong({ code }) {
  return code.endsWith('00') && !code.endsWith('00000')
}

function getLocationParts(row, officialProvince) {
  const prefix = `${officialProvince} `
  if (!row.name.startsWith(prefix)) return null

  const parts = row.name.slice(prefix.length).trim().split(/\s+/)
  return {
    jurisdiction: parts.slice(0, -1),
    leaf: parts.at(-1),
  }
}

function startsWithParts(actual, expected) {
  return expected.every((part, index) => actual[index] === part)
}

export function generateCatalog(rows, frontendCatalog) {
  const allEmdRows = rows.filter(isEupMyeonDong)
  const currentEmdRows = allEmdRows.filter(({ status }) => status === '존재')
  const catalog = {}
  const codesByRegionAndDong = {}
  const coveredCodes = new Set()
  const collator = new Intl.Collator('ko-KR')

  for (const province of frontendCatalog.provinces) {
    const officialProvince =
      provinceSourceOverrides.get(province) ??
      frontendCatalog.provinceSearchTerms[province]
    const currentProvinceRows = currentEmdRows.filter((row) =>
      row.name.startsWith(`${officialProvince} `),
    )

    for (const sigungu of frontendCatalog.sigunguByProvince[province]) {
      const key = `${province}|${sigungu}`
      const sigunguParts = sigungu.split(' ')
      const legacyTargets = currentIncheonDistrictsByLegacySelection.get(key)
      let matchingRows

      if (province === '세종' && sigungu === '세종특별자치시') {
        matchingRows = currentProvinceRows.filter((row) => {
          const location = getLocationParts(row, officialProvince)
          return location?.jurisdiction.length === 0
        })
      } else if (legacyTargets) {
        const legacyProvince = frontendCatalog.provinceSearchTerms[province]
        const historicalLeaves = new Set(
          allEmdRows
            .map((row) => ({
              row,
              location: getLocationParts(row, legacyProvince),
            }))
            .filter(
              ({ location }) =>
                location && startsWithParts(location.jurisdiction, sigunguParts),
            )
            .map(({ location }) => location.leaf),
        )

        matchingRows = currentProvinceRows.filter((row) => {
          const location = getLocationParts(row, officialProvince)
          return (
            location &&
            legacyTargets.includes(location.jurisdiction[0]) &&
            historicalLeaves.has(location.leaf)
          )
        })
      } else {
        matchingRows = currentProvinceRows.filter((row) => {
          const location = getLocationParts(row, officialProvince)
          return location && startsWithParts(location.jurisdiction, sigunguParts)
        })
      }

      const codesByDong = new Map()
      for (const row of matchingRows) {
        const leaf = getLocationParts(row, officialProvince)?.leaf
        if (!leaf) {
          throw new Error(`${row.code}의 법정 읍·면·동명을 읽지 못했습니다.`)
        }
        coveredCodes.add(row.code)
        const codes = codesByDong.get(leaf) ?? new Set()
        codes.add(row.code.slice(0, 8))
        codesByDong.set(leaf, codes)
      }

      const names = [...codesByDong.keys()].sort(collator.compare)

      if (names.length === 0) {
        throw new Error(`${key}에 매핑된 현행 법정 읍·면·동이 없습니다.`)
      }
      if (names.some((name) => !name || name.endsWith('리'))) {
        throw new Error(`${key}에 잘못된 법정 읍·면·동명이 포함되었습니다.`)
      }

      catalog[key] = names
      codesByRegionAndDong[key] = Object.fromEntries(
        names.map((name) => [name, [...codesByDong.get(name)].sort()]),
      )
    }
  }

  const uncoveredRows = currentEmdRows.filter((row) => !coveredCodes.has(row.code))
  if (uncoveredRows.length > 0) {
    throw new Error(
      `프런트 지역 카탈로그가 현행 법정 읍·면·동 ${uncoveredRows.length}건을 포함하지 못했습니다.\n` +
        uncoveredRows.slice(0, 20).map((row) => row.name).join('\n'),
    )
  }

  return {
    catalog,
    codesByRegionAndDong,
    sourceCurrentEmdCount: currentEmdRows.length,
    mappedRegionCount: Object.keys(catalog).length,
  }
}
