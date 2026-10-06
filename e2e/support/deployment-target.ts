import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { APIRequestContext, BrowserContext } from '@playwright/test'

const productionSite = 'https://smartlink-bid-client.onrender.com'
const productionApi = 'https://smartlink-bid-api.onrender.com'
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export type DeploymentTarget = {
  site: URL
  api: URL
  expectedRevision: string
  waitMilliseconds: number
  local: boolean
}

function requireOrigin(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required.`)
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an HTTP(S) origin without credentials, path or query.`)
  }
  return url
}

/** Deployment smoke is opt-in; ordinary local suites never select this config. */
export function getDeploymentTarget(): DeploymentTarget {
  if (process.env.DEPLOYMENT_SMOKE_RUN !== '1') {
    throw new Error('Set DEPLOYMENT_SMOKE_RUN=1 to explicitly enable deployment smoke.')
  }
  const site = requireOrigin(process.env.DEPLOYMENT_SITE_URL, 'DEPLOYMENT_SITE_URL')
  const api = requireOrigin(process.env.DEPLOYMENT_API_URL, 'DEPLOYMENT_API_URL')
  const local = loopbackHosts.has(site.hostname) && loopbackHosts.has(api.hostname)
  if (local) {
    if (process.env.DEPLOYMENT_SMOKE_ALLOW_LOOPBACK !== '1') {
      throw new Error('Local rehearsal requires DEPLOYMENT_SMOKE_ALLOW_LOOPBACK=1.')
    }
  } else if (site.origin !== productionSite || api.origin !== productionApi) {
    throw new Error('Deployment smoke only allows the named Render site/API or explicit loopback rehearsal.')
  }
  const expectedRevision = process.env.DEPLOYMENT_EXPECTED_SHA ?? ''
  if (!/^[a-f0-9]{40}$/i.test(expectedRevision)) {
    throw new Error('DEPLOYMENT_EXPECTED_SHA must be a complete 40-character Git SHA.')
  }
  const seconds = Number(process.env.DEPLOYMENT_WAIT_SECONDS ?? '1200')
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 1200) {
    throw new Error('DEPLOYMENT_WAIT_SECONDS must be an integer from 1 through 1200.')
  }
  return { site, api, expectedRevision: expectedRevision.toLowerCase(), waitMilliseconds: seconds * 1000, local }
}

/** A successful old deployment or SPA fallback HTML must never satisfy this wait. */
export async function waitForDeployment(request: APIRequestContext, target: DeploymentTarget) {
  const deadline = Date.now() + target.waitMilliseconds
  let lastObservation = 'No revision response received.'
  do {
    const url = new URL('/deployment.json', target.site)
    url.searchParams.set('expected', target.expectedRevision)
    url.searchParams.set('smoke', randomUUID())
    try {
      const response = await request.get(url.href, {
        maxRedirects: 0,
        timeout: Math.min(15_000, Math.max(1, deadline - Date.now())),
        headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
      })
      try {
        if (response.status() === 200 && response.headers()['content-type']?.includes('application/json')) {
          const record: unknown = await response.json()
          if (typeof record === 'object' && record !== null && 'revision' in record && 'source' in record) {
            lastObservation = `revision=${String(record.revision)}, source=${String(record.source)}`
            if (record.revision === target.expectedRevision &&
                (record.source === 'render' || target.local && record.source === 'git')) {
              return { revision: record.revision, source: record.source }
            }
          } else lastObservation = 'Revision JSON has no revision/source fields.'
        } else lastObservation = `HTTP ${response.status()} without deployment JSON.`
      } finally {
        await response.dispose()
      }
    } catch (error) {
      lastObservation = error instanceof Error ? error.message : 'Revision request failed.'
    }
    const remaining = deadline - Date.now()
    if (remaining > 0) await delay(Math.min(5000, remaining))
  } while (Date.now() < deadline)
  throw new Error(`Expected deployment ${target.expectedRevision} did not become available. ${lastObservation}`)
}

/** Block mutations and third parties before requests leave the fresh browser. */
export async function installReadOnlyGuard(context: BrowserContext, target: DeploymentTarget) {
  const bootstrapOrigins = new Set<string>()
  const unexpectedMutations: string[] = []
  const blockedRedirects: string[] = []
  const scriptFailures: string[] = []
  const exceptions: string[] = []
  const allowedOrigins = new Set([target.site.origin, target.api.origin])
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) {
      // Fresh app bootstrap is POST refresh. Observe its built API origin, but never send it.
      if (request.method() === 'POST' && url.pathname === '/api/v1/refresh') {
        bootstrapOrigins.add(url.origin)
      } else unexpectedMutations.push(`${request.method()} ${url.origin}${url.pathname}`)
      return route.abort('blockedbyclient')
    }
    if (!allowedOrigins.has(url.origin)) return route.abort('blockedbyclient')
    // Browser redirects bypass route handlers. Never allow a redirect to escape this origin check.
    const response = await route.fetch({ maxRedirects: 0, timeout: 30_000 })
    try {
      if (response.status() >= 300 && response.status() < 400) {
        blockedRedirects.push(`${url.pathname}: HTTP ${response.status()}`)
        return await route.abort('blockedbyclient')
      }
      const headers = response.headers()
      // Playwright otherwise synthesizes successful CORS for fulfilled cross-origin responses.
      headers['access-control-allow-origin'] ??= ''
      await route.fulfill({ response, headers })
    } finally {
      await response.dispose()
    }
  })
  await context.routeWebSocket('**/*', (socket) => socket.close())
  context.on('page', (page) => {
    page.on('pageerror', (error) => exceptions.push(error.message))
    page.on('response', (response) => {
      if (response.request().resourceType() === 'script' && response.status() >= 400) {
        scriptFailures.push(`${new URL(response.url()).pathname}: HTTP ${response.status()}`)
      }
    })
    page.on('requestfailed', (request) => {
      const url = new URL(request.url())
      if (request.resourceType() === 'script' && allowedOrigins.has(url.origin)) {
        scriptFailures.push(`${url.pathname}: ${request.failure()?.errorText}`)
      }
    })
  })
  return { bootstrapOrigins, unexpectedMutations, blockedRedirects, scriptFailures, exceptions }
}
