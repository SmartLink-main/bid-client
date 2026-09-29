import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthResponse } from './auth'
import {
  createGoodsComment,
  getGoodsComments,
  getNextGoodsCommentOffset,
  type GoodsComment,
  type GoodsCommentListResponse,
} from './goods-comments'
import { clearAuthSession, storeAuthSession } from './session'

const authResponse: AuthResponse = {
  token_type: 'bearer',
  access_token: 'goods-comment-access-token',
  expires_in: 900,
  refresh_expires_in: 86_400,
  user: {
    id: '00000000-0000-0000-0000-000000000002',
    login_id: 'legal-agent',
    phone_number: '01012345678',
    name: '테스트 법무사',
    access_group: 'legal_agent',
    auth_methods: ['password'],
    has_password: true,
    created_at: '2026-09-02T00:00:00Z',
    last_login_at: '2026-09-02T00:00:00Z',
  },
}

const comment: GoodsComment = {
  id: '10000000-0000-0000-0000-000000000002',
  auction_goods_id: 42,
  content: '등기부상 선순위 권리를 확인해 주세요.',
  author: {
    label: '법무사',
    access_group: 'legal_agent',
  },
  created_at: '2026-09-02T01:00:00Z',
}

beforeEach(() => {
  storeAuthSession(authResponse)
})

afterEach(() => {
  clearAuthSession()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('goods comments API client', () => {
  it('advances pagination by rows consumed from the server, not deduplicated UI rows', () => {
    const repeatedBoundaryComment = { ...comment, id: 'boundary-comment' }

    expect(getNextGoodsCommentOffset({
      total: 41,
      limit: 20,
      offset: 20,
      items: [repeatedBoundaryComment, ...Array.from({ length: 19 }, (_, index) => ({
        ...comment,
        id: `next-comment-${index}`,
      }))],
    })).toBe(40)
  })

  it('loads a public paginated comment list without bearer authentication', async () => {
    const response: GoodsCommentListResponse = {
      total: 1,
      limit: 10,
      offset: 20,
      items: [comment],
    }
    const fetchMock = vi.fn().mockResolvedValue(Response.json(response))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(getGoodsComments(42, {
      limit: 10,
      offset: 20,
      signal: controller.signal,
    })).resolves.toEqual(response)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/goods\/42\/comments\?limit=10&offset=20$/)
    expect(init.signal).toBe(controller.signal)
    expect(new Headers(init.headers).get('Authorization')).toBeNull()
  })

  it('creates a comment with a bearer token and JSON content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(comment, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(createGoodsComment(
      42,
      comment.content,
      controller.signal,
    )).resolves.toEqual(comment)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/goods\/42\/comments$/)
    expect(init.method).toBe('POST')
    expect(init.signal).toBe(controller.signal)
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer goods-comment-access-token',
    )
    expect(JSON.parse(String(init.body))).toEqual({ content: comment.content })
  })
})
