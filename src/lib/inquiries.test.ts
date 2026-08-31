import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthResponse } from './auth'
import {
  answerInquiry,
  createInquiry,
  getAdminInquiries,
  getMyInquiries,
  type AdminInquiry,
  type Inquiry,
} from './inquiries'
import { clearAuthSession, storeAuthSession } from './session'

const authResponse: AuthResponse = {
  token_type: 'bearer',
  access_token: 'inquiry-access-token',
  expires_in: 900,
  refresh_expires_in: 86_400,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    login_id: 'inquiry-user',
    phone_number: '01012345678',
    name: '문의 사용자',
    access_group: 'general',
    auth_methods: ['password'],
    has_password: true,
    created_at: '2026-08-27T00:00:00Z',
    last_login_at: '2026-08-27T00:00:00Z',
  },
}

const inquiry: Inquiry = {
  id: '10000000-0000-0000-0000-000000000001',
  title: '문의 제목',
  content: '문의 내용',
  answer: null,
  status: 'pending',
  created_at: '2026-08-27T01:00:00Z',
  updated_at: '2026-08-27T01:00:00Z',
  answered_at: null,
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  storeAuthSession(authResponse)
})

afterEach(() => {
  clearAuthSession()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('inquiry API client', () => {
  it('creates a user inquiry with bearer authentication', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(inquiry))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(createInquiry({
      title: '문의 제목',
      content: '문의 내용',
    }, controller.signal)).resolves.toEqual(inquiry)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/inquiries$/)
    expect(init.method).toBe('POST')
    expect(init.signal).toBe(controller.signal)
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer inquiry-access-token',
    )
    expect(JSON.parse(String(init.body))).toEqual({
      title: '문의 제목',
      content: '문의 내용',
    })
  })

  it('keeps user and admin list endpoints separate with pagination', async () => {
    const adminInquiry: AdminInquiry = {
      ...inquiry,
      user: {
        id: authResponse.user.id,
        login_id: authResponse.user.login_id,
        name: authResponse.user.name,
      },
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        total: 1,
        limit: 20,
        offset: 10,
        items: [inquiry],
      }))
      .mockResolvedValueOnce(jsonResponse({
        total: 1,
        limit: 30,
        offset: 0,
        items: [adminInquiry],
      }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await getMyInquiries({ limit: 20, offset: 10, signal: controller.signal })
    await getAdminInquiries({ limit: 30, offset: 0 })

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/api\/v1\/inquiries\?limit=20&offset=10$/),
      expect.stringMatching(/\/api\/v1\/admin\/inquiries\?limit=30&offset=0$/),
    ])
    for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      expect(new Headers(init.headers).get('Authorization')).toBe(
        'Bearer inquiry-access-token',
      )
    }
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal)
  })

  it('replaces an admin answer through the protected answer endpoint', async () => {
    const answered: AdminInquiry = {
      ...inquiry,
      answer: '관리자 답변',
      status: 'answered',
      answered_at: '2026-08-27T02:00:00Z',
      user: {
        id: authResponse.user.id,
        login_id: authResponse.user.login_id,
        name: authResponse.user.name,
      },
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(answered))
    vi.stubGlobal('fetch', fetchMock)

    await expect(answerInquiry(inquiry.id, '관리자 답변')).resolves.toEqual(answered)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(new RegExp(`/api/v1/admin/inquiries/${inquiry.id}/answer$`))
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ answer: '관리자 답변' })
  })
})
