import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import {
  CODE_SOURCE_PAGE_URL,
  downloadOfficialRows,
  generateCatalog,
  isEupMyeonDong,
  parseFrontendRegionCatalog,
} from './dong-catalog-common.mjs'

const SNAPSHOT_DATE = '2026-08-25'
const VWORLD_ENDPOINT = 'https://api.vworld.kr/req/data'
const VWORLD_LAYER = 'LT_C_ADEMD_INFO'
const DATA_PORTAL_URL = 'https://www.data.go.kr/data/15059008/openapi.do'
const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
const optionsSourcePath = fileURLToPath(
  new URL('../src/lib/search-filter-options.ts', import.meta.url),
)
const outputPath = fileURLToPath(
  new URL('../src/lib/dong-viewports.ts', import.meta.url),
)

function parseArguments(args) {
  const modes = args.filter((arg) =>
    ['--write', '--check', '--print'].includes(arg),
  )
  if (modes.length > 1) {
    throw new Error('--write, --check, --print 중 하나만 지정하세요.')
  }

  const sourceFileIndex = args.indexOf('--source-file')
  if (sourceFileIndex >= 0 && !args[sourceFileIndex + 1]) {
    throw new Error('--source-file 뒤에 VWorld bbox JSON 경로가 필요합니다.')
  }

  const known = new Set([
    '--write',
    '--check',
    '--print',
    '--source-file',
    ...(sourceFileIndex >= 0 ? [args[sourceFileIndex + 1]] : []),
  ])
  const unknown = args.filter((arg) => !known.has(arg))
  if (unknown.length > 0) {
    throw new Error(`지원하지 않는 옵션입니다: ${unknown.join(', ')}`)
  }

  return {
    mode: modes[0] ?? '--print',
    sourceFile: sourceFileIndex >= 0 ? args[sourceFileIndex + 1] : null,
  }
}

function getGeometryBounds(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity]

  function visit(value) {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    ) {
      bounds[0] = Math.min(bounds[0], value[0])
      bounds[1] = Math.min(bounds[1], value[1])
      bounds[2] = Math.max(bounds[2], value[0])
      bounds[3] = Math.max(bounds[3], value[1])
      return
    }
    if (Array.isArray(value)) value.forEach(visit)
  }

  visit(geometry?.coordinates)
  return bounds
}

function normalizeVworldFeature(feature) {
  const properties = feature?.properties ?? {}
  const code8 = String(
    properties.emd_cd ?? properties.EMD_CD ?? properties.emdCd ?? '',
  ).trim()
  return {
    code8,
    bbox: getGeometryBounds(feature?.geometry),
    full_nm: String(
      properties.full_nm ?? properties.FULL_NM ?? properties.fullNm ?? '',
    ).trim(),
  }
}

async function downloadVworldBounds() {
  const key = process.env.VWORLD_API_KEY?.trim()
  const domain = process.env.VWORLD_API_DOMAIN?.trim()
  if (!key || !domain) {
    throw new Error(
      'VWorld 조회에는 VWORLD_API_KEY와 VWORLD_API_DOMAIN 환경변수가 필요합니다. ' +
        '또는 --source-file로 검증된 bbox JSON을 지정하세요.',
    )
  }

  const rows = []
  for (let page = 1; ; page += 1) {
    const url = new URL(VWORLD_ENDPOINT)
    url.search = new URLSearchParams({
      service: 'data',
      version: '2.0',
      request: 'getfeature',
      format: 'json',
      size: '1000',
      page: String(page),
      geometry: 'true',
      attribute: 'true',
      crs: 'EPSG:4326',
      data: VWORLD_LAYER,
      geomfilter: 'BOX(124,33,132,39)',
      domain,
      key,
    }).toString()

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`VWorld ${page}페이지 다운로드 실패: HTTP ${response.status}`)
    }
    const payload = await response.json()
    if (payload?.response?.status !== 'OK') {
      const message = payload?.response?.error?.text ?? '알 수 없는 API 오류'
      throw new Error(`VWorld ${page}페이지 응답 오류: ${message}`)
    }
    const features =
      payload?.response?.result?.featureCollection?.features ?? []
    rows.push(...features.map(normalizeVworldFeature))
    if (features.length < 1000) break
  }
  return rows
}

async function loadVworldBounds(sourceFile) {
  if (!sourceFile) return downloadVworldBounds()
  const rows = JSON.parse(await readFile(sourceFile, 'utf8'))
  if (!Array.isArray(rows)) {
    throw new Error('VWorld bbox JSON의 최상위 값은 배열이어야 합니다.')
  }
  return rows
}

function validateAndIndexBounds(rows, officialRows) {
  const index = new Map()
  for (const row of rows) {
    const code8 = String(row.code8 ?? '').trim()
    const bbox = row.bbox?.map(Number)
    if (!/^\d{8}$/.test(code8)) {
      throw new Error(`잘못된 VWorld 법정동 코드입니다: ${code8 || '(empty)'}`)
    }
    if (index.has(code8)) {
      throw new Error(`VWorld 법정동 코드가 중복되었습니다: ${code8}`)
    }
    if (
      bbox?.length !== 4 ||
      !bbox.every(Number.isFinite) ||
      bbox[0] >= bbox[2] ||
      bbox[1] >= bbox[3] ||
      bbox[0] < 124 ||
      bbox[2] > 132 ||
      bbox[1] < 33 ||
      bbox[3] > 39
    ) {
      throw new Error(`${code8}의 VWorld bbox가 유효하지 않습니다.`)
    }
    index.set(code8, bbox)
  }

  const officialCodes = new Set(
    officialRows
      .filter(isEupMyeonDong)
      .filter(({ status }) => status === '존재')
      .map(({ code }) => code.slice(0, 8)),
  )
  const missing = [...officialCodes].filter((code) => !index.has(code))
  const extra = [...index.keys()].filter((code) => !officialCodes.has(code))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `code.go/VWorld 코드 불일치: missing=${missing.length}, extra=${extra.length}`,
    )
  }
  return index
}

function unionBounds(codes, boundsByCode) {
  const rows = codes.map((code) => {
    const bounds = boundsByCode.get(code)
    if (!bounds) throw new Error(`${code}의 VWorld bbox가 없습니다.`)
    return bounds
  })
  return [
    Math.min(...rows.map(([west]) => west)),
    Math.min(...rows.map(([, south]) => south)),
    Math.max(...rows.map(([, , east]) => east)),
    Math.max(...rows.map(([, , , north]) => north)),
  ]
}

function buildViewportEntries(generated, boundsByCode) {
  const entries = []
  for (const [regionKey, dongNames] of Object.entries(generated.catalog)) {
    for (const dong of dongNames) {
      const codes = generated.codesByRegionAndDong[regionKey]?.[dong]
      if (!codes?.length) {
        throw new Error(`${regionKey}|${dong}에 연결된 법정동 코드가 없습니다.`)
      }
      entries.push({
        key: `${regionKey}|${dong}`,
        codes,
        bbox: unionBounds(codes, boundsByCode),
      })
    }
  }
  return entries
}

function renderTypeScript(entries, sourceFeatureCount, sourceCurrentEmdCount) {
  const unionedViewportCount = entries.filter(
    ({ codes }) => codes.length > 1,
  ).length
  const serializedEntries = entries
    .map(({ key, codes, bbox }) =>
      `  [${JSON.stringify(key)}, ${JSON.stringify(codes.join('+'))}, ${bbox.join(', ')}],`,
    )
    .join('\n')

  return `// This file is generated by scripts/generate-dong-viewports.mjs.\n// Source: ${VWORLD_LAYER}, 국토교통부 VWorld 행정구역_읍면동(법정동), WGS84.\n// Join: code.go 현존 법정 읍·면·동 8자리 코드와 1:1 대조한 뒤 프런트 선택 키로 투영합니다.\n\nimport type { GeographicBounds } from './auction-extra'\n\nexport type DongViewportEntry = GeographicBounds & {\n  legalDongCodes: readonly string[]\n}\n\nexport const DONG_VIEWPORT_SOURCE = {\n  provider: '국토교통부 VWorld',\n  layer: ${JSON.stringify(VWORLD_LAYER)},\n  snapshotDate: ${JSON.stringify(SNAPSHOT_DATE)},\n  coordinateSystem: 'EPSG:4326',\n  license: '공공누리 제1유형 (출처표시)',\n  dataPortalUrl: ${JSON.stringify(DATA_PORTAL_URL)},\n  codeSourceUrl: ${JSON.stringify(CODE_SOURCE_PAGE_URL)},\n  sourceFeatureCount: ${sourceFeatureCount},\n  sourceCurrentEmdCount: ${sourceCurrentEmdCount},\n  mappedViewportCount: ${entries.length},\n  unionedViewportCount: ${unionedViewportCount},\n  missingCodeCount: 0,\n  extraCodeCount: 0,\n  coverageStrategy: 'official-legal-dong-code-join',\n} as const\n\nconst DONG_VIEWPORT_DATA: ReadonlyArray<\n  readonly [string, string, number, number, number, number]\n> = [\n${serializedEntries}\n]\n\nexport const DONG_VIEWPORT_ENTRIES: Readonly<\n  Record<string, DongViewportEntry>\n> = Object.freeze(\n  Object.fromEntries(\n    DONG_VIEWPORT_DATA.map(\n      ([key, codes, west, south, east, north]) => [\n        key,\n        Object.freeze({\n          legalDongCodes: Object.freeze(codes.split('+')),\n          west,\n          south,\n          east,\n          north,\n        }),\n      ],\n    ),\n  ),\n)\n\nexport const DONG_VIEWPORTS: Readonly<Record<string, GeographicBounds>> =\n  Object.freeze(\n    Object.fromEntries(\n      Object.entries(DONG_VIEWPORT_ENTRIES).map(([key, entry]) => [\n        key,\n        Object.freeze({\n          west: entry.west,\n          south: entry.south,\n          east: entry.east,\n          north: entry.north,\n        }),\n      ]),\n    ),\n  )\n\nexport function getDongViewport(\n  province: string,\n  sigungu: string,\n  dong: string,\n+): GeographicBounds | null {\n  return DONG_VIEWPORTS[\`${'${province}'}|${'${sigungu}'}|${'${dong}'}\`] ?? null\n}\n`
}

async function main() {
  const { mode, sourceFile } = parseArguments(process.argv.slice(2))
  const frontendSource = await readFile(optionsSourcePath, 'utf8')
  const frontendCatalog = parseFrontendRegionCatalog(frontendSource)
  const officialRows = await downloadOfficialRows()
  const generated = generateCatalog(officialRows, frontendCatalog)
  const sourceRows = await loadVworldBounds(sourceFile)
  const boundsByCode = validateAndIndexBounds(sourceRows, officialRows)
  const entries = buildViewportEntries(generated, boundsByCode)
  const output = renderTypeScript(
    entries,
    sourceRows.length,
    generated.sourceCurrentEmdCount,
  ).replace(
    '\n+): GeographicBounds | null {',
    '\n): GeographicBounds | null {',
  )

  if (mode === '--write') {
    await writeFile(outputPath, output, 'utf8')
    process.stdout.write(
      `Updated ${outputPath} (${entries.length} viewports, ${sourceRows.length} official features)\n`,
    )
    return
  }

  if (mode === '--check') {
    const currentOutput = await readFile(outputPath, 'utf8')
    if (currentOutput !== output) {
      throw new Error(
        `법정 읍·면·동 viewport가 최신 생성 결과와 다릅니다. ${scriptDirectory}generate-dong-viewports.mjs --write를 실행하세요.`,
      )
    }
    process.stdout.write('The dong viewport snapshot is current and complete.\n')
    return
  }

  process.stdout.write(output)
}

await main()
