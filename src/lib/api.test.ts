import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getKoreanErrorMessage as getClientKoreanErrorMessage,
  isNetworkRequestError as isClientNetworkRequestError,
} from '../../../bid-client/src/lib/api'
import { login, type AuthResponse } from './auth'
import {
  getKoreanErrorMessage,
  initializeAuthSession,
  isNetworkRequestError,
} from './api'
import {
  clearAuthSession,
  getAuthSessionSnapshot,
  storeAuthSession,
} from './session'

const signedInResponse: AuthResponse = {
  token_type: 'bearer',
  access_token: 'new-access-token',
  expires_in: 900,
  refresh_expires_in: 86_400,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    login_id: 'testuser',
    phone_number: '01012345678',
    name: '테스트 사용자',
    access_group: 'general',
    auth_methods: ['password'],
    has_password: true,
    created_at: '2026-08-20T00:00:00Z',
    last_login_at: '2026-08-20T00:00:00Z',
  },
}

describe('API error messages', () => {
  it('describes a rejected fetch as a service connection failure, not an internet problem', () => {
    const error = new TypeError('Failed to fetch')

    for (const [isNetworkError, getMessage] of [
      [isNetworkRequestError, getKoreanErrorMessage],
      [isClientNetworkRequestError, getClientKoreanErrorMessage],
    ] as const) {
      expect(isNetworkError(error)).toBe(true)
      expect(getMessage(error)).toBe(
        '서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      )
      expect(getMessage(error)).not.toContain('네트워크 연결')
    }
  })
})

describe('authentication bootstrap', () => {
  beforeEach(() => {
    clearAuthSession()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not retry a failed background initialization request', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(initializeAuthSession()).rejects.toThrow('Failed to fetch')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('aborts background initialization after one 2.5 second deadline', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    ))
    vi.stubGlobal('fetch', fetchMock)

    const initialization = initializeAuthSession()
    const rejection = expect(initialization).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(2_500)

    await rejection
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('cancels a pending initialization before a password login starts', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const pathname = String(input)
      if (pathname.endsWith('/api/v1/refresh')) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
      }
      if (pathname.endsWith('/api/v1/login')) {
        return Promise.resolve(new Response(JSON.stringify(signedInResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }
      throw new Error(`Unexpected request: ${pathname}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const initialization = initializeAuthSession()
    const response = await login({
      login_id: 'testuser',
      password: 'secret-password',
      remember_me: false,
    })

    expect(response).toEqual(signedInResponse)
    await expect(initialization).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not clear a newer login when an older refresh returns 401', async () => {
    let resolveRefresh!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveRefresh = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)

    const initialization = initializeAuthSession()
    storeAuthSession(signedInResponse)
    resolveRefresh(new Response(JSON.stringify({ detail: 'expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(initialization).rejects.toMatchObject({ status: 401 })
    expect(getAuthSessionSnapshot()?.access_token).toBe('new-access-token')
  })
})
