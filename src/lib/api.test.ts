import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, type AuthResponse } from './auth'
import {
  getKoreanErrorMessage,
  initializeAuthSession,
  isNetworkRequestError,
  withQuery,
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

describe('검색 쿼리 직렬화', () => {
  it('빈 값은 생략하고 0·false·반복 조건과 한글을 보존한다', () => {
    const params = {
      q: '대구 & 부산',
      empty: '',
      missing: undefined,
      absent: null,
      goods_usage: ['아파트', '', null, ['토지', '아파트']],
      min_price: 0,
      half_price: false,
      limit: 50,
    }
    const result = new URL(withQuery('/api/v1/search', params), 'http://localhost')

    expect(result.pathname).toBe('/api/v1/search')
    expect([...result.searchParams]).toEqual([
      ['q', '대구 & 부산'],
      ['goods_usage', '아파트'],
      ['goods_usage', '토지'],
      ['goods_usage', '아파트'],
      ['min_price', '0'],
      ['half_price', 'false'],
      ['limit', '50'],
    ])
    expect(params.goods_usage).toEqual(['아파트', '', null, ['토지', '아파트']])
    for (const emptyParams of [{}, { q: '', limit: undefined, ids: [] }]) {
      expect(withQuery('/api/v1/search', emptyParams)).toBe('/api/v1/search')
    }
  })
})

describe('API error messages', () => {
  it('describes a rejected fetch as a service connection failure, not an internet problem', () => {
    const error = new TypeError('Failed to fetch')

    expect(isNetworkRequestError(error)).toBe(true)
    expect(getKoreanErrorMessage(error)).toBe(
      '서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    )
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
        return Promise.resolve(Response.json(signedInResponse))
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
    resolveRefresh(Response.json({ detail: 'expired' }, {
      status: 401,
    }))

    await expect(initialization).rejects.toMatchObject({ status: 401 })
    expect(getAuthSessionSnapshot()?.access_token).toBe('new-access-token')
  })
})
