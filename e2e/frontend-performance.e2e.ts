import { expect, test, type Browser, type Page, type Request } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { env } from 'node:process'

type RouteCase = {
  name: string
  path: string
  readyText: string
  expectedPath?: string
  discoverLinkPrefix?: '/goods/' | '/schedules/'
}

type ApiTiming = {
  method: string
  path: string
  status: number | null
  durationMs: number
  failure: string | null
}

type RouteTiming = {
  mode: 'cold' | 'warm'
  name: string
  requestedPath: string
  finalPath: string
  visualReadyMs: number | null
  settledMs: number | null
  firstContentfulPaintMs: number | null
  domContentLoadedMs: number | null
  loadEventMs: number | null
  encodedResourceBytes: number
  api: ApiTiming[]
  blockedExternalOrigins: string[]
  consoleErrors: string[]
  pageErrors: string[]
  discoveredLink: string | null
  error: string | null
}

const PUBLIC_ROUTES: RouteCase[] = [
  { name: '홈', path: '/', readyText: '어떤 경매 물건을 찾으시나요?' },
  { name: '로그인', path: '/login', readyText: '환영합니다' },
  { name: '회원가입', path: '/signup', readyText: '계정 만들기' },
  { name: '카카오 콜백 오류 복구', path: '/auth/kakao/callback', readyText: '카카오 로그인 확인' },
  { name: '경매 지식', path: '/knowledge', readyText: '경매지식창고' },
  { name: '법원별 검색', path: '/court-search', readyText: '법원별검색' },
  { name: '지역별 검색', path: '/region-search', readyText: '지역별 검색' },
  { name: '물건종류 검색', path: '/type-search', readyText: '물건종류 검색' },
  { name: '특수물건 검색', path: '/special-search', readyText: '특수물건 검색' },
  { name: '종합 상세검색', path: '/advanced-search', readyText: '경매 종합 상세검색' },
  { name: '지도 영역 검색', path: '/map-search', readyText: '지도 영역 경매물건 찾기' },
  { name: '역세권 검색', path: '/subway-search', readyText: '역세권 경매물건 찾기' },
  { name: '미지정 예정물건', path: '/scheduled-search', readyText: '첫 매각기일 미지정 물건', discoverLinkPrefix: '/goods/' },
  { name: '경매 일정', path: '/schedules', readyText: '경매 공고 일정', discoverLinkPrefix: '/schedules/' },
  { name: '자연어 검색', path: '/question-search', readyText: '원하는 경매 물건을 문장으로 찾아보세요' },
  { name: '검색 결과', path: '/search', readyText: '검색 결과', discoverLinkPrefix: '/goods/' },
  { name: '시스템 상태', path: '/system-status', readyText: '시스템 상태' },
]

const PROTECTED_ROUTES: RouteCase[] = [
  { name: '관심물건 비로그인 보호', path: '/favorites', readyText: '환영합니다', expectedPath: '/login' },
  { name: '내 계정 비로그인 보호', path: '/account', readyText: '환영합니다', expectedPath: '/login' },
  { name: '회원관리 비로그인 보호', path: '/admin/users', readyText: '환영합니다', expectedPath: '/login' },
]

const baseURL = env.FRONTEND_PERF_BASE_URL ?? 'http://127.0.0.1:3103'
const apiBaseURL = env.FRONTEND_PERF_API_BASE_URL ?? 'http://127.0.0.1:8103'
const allowedOrigins = new Set([new URL(baseURL).origin, new URL(apiBaseURL).origin])
const artifactPath = resolve('test-results/frontend-performance/metrics.json')

function rounded(milliseconds: number) {
  return Math.round(milliseconds * 10) / 10
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function waitForApiToSettle(page: Page, pendingApi: Set<Request>) {
  await page.waitForTimeout(100)
  await expect.poll(() => pendingApi.size, {
    message: 'local API requests should settle',
    timeout: 15_000,
    intervals: [50, 100, 250],
  }).toBe(0)
  await page.evaluate(() => new Promise<void>((finish) => {
    requestAnimationFrame(() => requestAnimationFrame(() => finish()))
  }))
}

async function measureRoute(
  browser: Browser,
  routeCase: RouteCase,
  mode: 'cold' | 'warm',
  sharedContext?: Awaited<ReturnType<Browser['newContext']>>,
): Promise<RouteTiming> {
  const context = sharedContext ?? await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  if (mode === 'cold') {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  }

  const apiStarts = new Map<Request, number>()
  const pendingApi = new Set<Request>()
  const api: ApiTiming[] = []
  const apiCompletions: Promise<void>[] = []
  const blockedExternalOrigins = new Set<string>()
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (['http:', 'https:'].includes(requestUrl.protocol) && !allowedOrigins.has(requestUrl.origin)) {
      blockedExternalOrigins.add(requestUrl.origin)
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    if (request.url().startsWith(`${new URL(apiBaseURL).origin}/api/`)) {
      apiStarts.set(request, performance.now())
      pendingApi.add(request)
    }
  })
  page.on('requestfinished', (request) => {
    if (!pendingApi.delete(request)) return
    const startedAt = apiStarts.get(request) ?? performance.now()
    apiCompletions.push(request.response().then((response) => {
      const requestUrl = new URL(request.url())
      api.push({
        method: request.method(),
        path: `${requestUrl.pathname}${requestUrl.search}`,
        status: response?.status() ?? null,
        durationMs: rounded(performance.now() - startedAt),
        failure: null,
      })
    }))
  })
  page.on('requestfailed', (request) => {
    if (!pendingApi.delete(request)) return
    const startedAt = apiStarts.get(request) ?? performance.now()
    const requestUrl = new URL(request.url())
    api.push({
      method: request.method(),
      path: `${requestUrl.pathname}${requestUrl.search}`,
      status: null,
      durationMs: rounded(performance.now() - startedAt),
      failure: request.failure()?.errorText ?? 'request failed',
    })
  })

  const startedAt = performance.now()
  let visualReadyMs: number | null = null
  let settledMs: number | null = null
  let discoveredLink: string | null = null
  let error: string | null = null

  try {
    await page.goto(routeCase.path, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await expect(page.getByText(routeCase.readyText, { exact: false }).first()).toBeVisible()
    visualReadyMs = rounded(performance.now() - startedAt)
    await waitForApiToSettle(page, pendingApi)
    await Promise.all(apiCompletions)
    settledMs = rounded(performance.now() - startedAt)

    if (routeCase.expectedPath && new URL(page.url()).pathname !== routeCase.expectedPath) {
      throw new Error(`expected final path ${routeCase.expectedPath}, received ${new URL(page.url()).pathname}`)
    }

    if (routeCase.discoverLinkPrefix) {
      discoveredLink = await page
        .locator(`a[href^="${routeCase.discoverLinkPrefix}"]`)
        .first()
        .getAttribute('href')
        .catch(() => null)
    }
  } catch (caughtError) {
    error = toMessage(caughtError)
  }

  const browserMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const paint = performance.getEntriesByType('paint') as PerformanceEntry[]
    const firstContentfulPaint = paint.find((entry) => entry.name === 'first-contentful-paint')
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    return {
      firstContentfulPaintMs: firstContentfulPaint?.startTime ?? null,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      loadEventMs: navigation?.loadEventEnd ?? null,
      encodedResourceBytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    }
  }).catch(() => ({
    firstContentfulPaintMs: null,
    domContentLoadedMs: null,
    loadEventMs: null,
    encodedResourceBytes: 0,
  }))

  const finalPath = new URL(page.url(), baseURL).pathname
  await page.close()
  if (!sharedContext) await context.close()

  return {
    mode,
    name: routeCase.name,
    requestedPath: routeCase.path,
    finalPath,
    visualReadyMs,
    settledMs,
    firstContentfulPaintMs: browserMetrics.firstContentfulPaintMs === null
      ? null
      : rounded(browserMetrics.firstContentfulPaintMs),
    domContentLoadedMs: browserMetrics.domContentLoadedMs === null
      ? null
      : rounded(browserMetrics.domContentLoadedMs),
    loadEventMs: browserMetrics.loadEventMs === null ? null : rounded(browserMetrics.loadEventMs),
    encodedResourceBytes: browserMetrics.encodedResourceBytes,
    api: api.sort((left, right) => right.durationMs - left.durationMs),
    blockedExternalOrigins: [...blockedExternalOrigins].sort(),
    consoleErrors,
    pageErrors,
    discoveredLink,
    error,
  }
}

test('전체 프런트 라우트의 화면 준비와 API 응답 시간을 측정한다', async ({ browser }, testInfo) => {
  test.setTimeout(8 * 60_000)
  const routeCases = [...PUBLIC_ROUTES, ...PROTECTED_ROUTES]
  const results: RouteTiming[] = []

  for (const routeCase of routeCases) {
    results.push(await measureRoute(browser, routeCase, 'cold'))
  }

  const warmContext = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
  })
  for (const routeCase of routeCases) {
    results.push(await measureRoute(browser, routeCase, 'warm', warmContext))
  }

  const dynamicLinks = [...new Set(
    results
      .map((result) => result.discoveredLink)
      .filter((value): value is string => Boolean(value)),
  )]
  for (const link of dynamicLinks) {
    const isGoods = link.startsWith('/goods/')
    results.push(await measureRoute(browser, {
      name: isGoods ? '물건 상세' : '공고 상세',
      path: link,
      readyText: isGoods ? 'bid' : '상세공고',
    }, 'warm', warmContext))
  }
  await warmContext.close()

  const report = {
    generatedAt: new Date().toISOString(),
    baseURL,
    apiBaseURL,
    thresholds: {
      slowVisualMs: 2_000,
      slowSettledMs: 3_000,
      slowApiMs: 1_000,
    },
    slowScreens: results.filter((result) =>
      (result.visualReadyMs ?? 0) > 2_000 || (result.settledMs ?? 0) > 3_000),
    slowApis: results.flatMap((result) => result.api
      .filter((timing) => timing.durationMs > 1_000)
      .map((timing) => ({ route: result.requestedPath, mode: result.mode, ...timing }))),
    results,
  }

  await mkdir(dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await testInfo.attach('frontend-performance.json', {
    path: artifactPath,
    contentType: 'application/json',
  })

  const compact = results.map((result) => ({
    mode: result.mode,
    route: result.requestedPath,
    visualMs: result.visualReadyMs,
    settledMs: result.settledMs,
    slowestApiMs: result.api[0]?.durationMs ?? null,
    error: result.error,
  }))
  console.log(`FRONTEND_PERFORMANCE_SUMMARY=${JSON.stringify(compact)}`)

  const failures = results.filter((result) =>
    result.error ||
    result.pageErrors.length > 0 ||
    result.blockedExternalOrigins.some((origin) => {
      const hostname = new URL(origin).hostname
      return ['127.0.0.1', 'localhost', '[::1]'].includes(hostname)
    }) ||
    result.api.some((timing) =>
      timing.failure ||
      (timing.status !== null && timing.status >= 400 &&
        !(timing.path === '/api/v1/refresh' && timing.status === 401))))
  expect(failures, `route failures are recorded in ${artifactPath}`).toEqual([])
})

test('사이드바에서 일반 지도 검색과 역세권 검색을 분리해 연다', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
  await page.goto('/')

  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
  const mapSearchLink = page.getByRole('link', { name: '지도 영역 검색', exact: true })
  const subwaySearchLink = page.getByRole('link', { name: '역세권 반경 검색', exact: true })
  await expect(mapSearchLink).toBeVisible()
  await expect(mapSearchLink).toHaveAttribute('href', '/map-search')
  await expect(subwaySearchLink).toBeVisible()
  await expect(subwaySearchLink).toHaveAttribute('href', '/subway-search')
  await expect(page.getByText('좌표범위검색', { exact: true })).toHaveCount(0)

  await mapSearchLink.click()
  await expect(page).toHaveURL(/\/map-search$/)
  await expect(page.getByRole('heading', { name: '지도 영역 경매물건 찾기' })).toBeVisible()

  await page.getByRole('button', { name: '전체 메뉴 열기' }).click()
  const separatedSubwaySearchLink = page.getByRole('link', {
    name: '역세권 반경 검색',
    exact: true,
  })
  await expect(separatedSubwaySearchLink).toBeVisible()
  await separatedSubwaySearchLink.click()
  await expect(page).toHaveURL(/\/subway-search$/)
  await expect(page.getByRole('heading', { name: '역세권 경매물건 찾기' })).toBeVisible()
})
