import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const SOURCE_PAGE_URL = 'https://www.code.go.kr/stdcode/regCodeL.do'
const DOWNLOAD_ENDPOINT = 'https://www.code.go.kr/etc/codeFullDown.do'
// Keep the metadata deterministic. Advance this together with a reviewed snapshot update.
const SNAPSHOT_DATE = '2026-08-25'
const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
const optionsSourcePath = fileURLToPath(
  new URL('../src/lib/search-filter-options.ts', import.meta.url),
)
const outputPath = fileURLToPath(
  new URL('../src/lib/dong-filter-options.ts', import.meta.url),
)

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

function parseFrontendRegionCatalog(source) {
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

async function downloadOfficialRows() {
  const response = await fetch(DOWNLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ codeseId: '법정동코드' }),
  })

  if (!response.ok) {
    throw new Error(`법정동 전체자료 다운로드 실패: HTTP ${response.status}`)
  }

  const archive = Buffer.from(await response.arrayBuffer())
  const decoded = new TextDecoder('euc-kr').decode(extractFirstZipEntry(archive))

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

function isEupMyeonDong({ code }) {
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

function generateCatalog(rows, frontendCatalog) {
  const allEmdRows = rows.filter(isEupMyeonDong)
  const currentEmdRows = allEmdRows.filter(({ status }) => status === '존재')
  const catalog = {}
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
            .map((row) => ({ row, location: getLocationParts(row, legacyProvince) }))
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

      const names = [
        ...new Set(
          matchingRows.map((row) => {
            coveredCodes.add(row.code)
            return getLocationParts(row, officialProvince).leaf
          }),
        ),
      ].sort(collator.compare)

      if (names.length === 0) {
        throw new Error(`${key}에 매핑된 현행 법정 읍·면·동이 없습니다.`)
      }
      if (names.some((name) => name.endsWith('리'))) {
        throw new Error(`${key}에 리 단위가 잘못 포함되었습니다.`)
      }

      catalog[key] = names
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
    sourceCurrentEmdCount: currentEmdRows.length,
    mappedRegionCount: Object.keys(catalog).length,
  }
}

function renderTypeScript(snapshotDate, generated) {
  const serializedCatalog = Object.entries(generated.catalog)
    .map(
      ([key, names]) =>
        `  ${JSON.stringify(key)}: ${JSON.stringify(names.join('|'))},`,
    )
    .join('\n')

  return `// This file is generated by scripts/generate-dong-filter-options.mjs.\n// Source: ${SOURCE_PAGE_URL} (법정동 코드 전체자료, 현존, 리 제외)\n// Compatibility: 2026-07-01 광주·전남 통합 및 인천 자치구 개편을 기존 프런트 키로 투영합니다.\n// 인천 레거시 중구·동구·서구는 개편 전 소속과 현행 법정동명의 교집합만 포함합니다.\n\nexport const DONG_FILTER_OPTIONS_METADATA = {\n  snapshotDate: ${JSON.stringify(snapshotDate)},\n  sourcePageUrl: ${JSON.stringify(SOURCE_PAGE_URL)},\n  downloadEndpoint: ${JSON.stringify(DOWNLOAD_ENDPOINT)},\n  sourceStatus: '존재',\n  sourceCurrentEmdCount: ${generated.sourceCurrentEmdCount},\n  mappedRegionCount: ${generated.mappedRegionCount},\n} as const\n\nconst DONG_FILTER_OPTION_DATA: Readonly<Record<string, string>> = {\n${serializedCatalog}\n}\n\nexport const DONG_BY_REGION: Readonly<Record<string, readonly string[]>> =\n  Object.fromEntries(\n    Object.entries(DONG_FILTER_OPTION_DATA).map(([key, value]) => [\n      key,\n      value.split('|'),\n    ]),\n  )\n\nexport function getDongOptions(\n  province: string,\n  sigungu: string,\n): readonly string[] {\n  return DONG_BY_REGION[\`${'${province}'}|${'${sigungu}'}\`] ?? []\n}\n`
}

async function main() {
  const frontendSource = await readFile(optionsSourcePath, 'utf8')
  const frontendCatalog = parseFrontendRegionCatalog(frontendSource)
  const rows = await downloadOfficialRows()
  const generated = generateCatalog(rows, frontendCatalog)
  const output = renderTypeScript(SNAPSHOT_DATE, generated)
  const mode = process.argv[2] ?? '--print'

  if (mode === '--write') {
    await writeFile(outputPath, output, 'utf8')
    process.stdout.write(
      `Updated ${outputPath} (${generated.mappedRegionCount} regions, ${generated.sourceCurrentEmdCount} current EMD codes)\n`,
    )
    return
  }

  if (mode === '--check') {
    const currentOutput = await readFile(outputPath, 'utf8')
    if (currentOutput !== output) {
      throw new Error(
        `법정 읍·면·동 스냅샷이 최신 생성 결과와 다릅니다. ${scriptDirectory}generate-dong-filter-options.mjs --write를 실행하세요.`,
      )
    }
    process.stdout.write('The dong filter snapshot is current.\n')
    return
  }

  if (mode !== '--print') {
    throw new Error(`지원하지 않는 옵션입니다: ${mode}`)
  }
  process.stdout.write(output)
}

await main()
