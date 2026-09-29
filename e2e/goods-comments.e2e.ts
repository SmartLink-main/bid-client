import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Response,
} from '@playwright/test'

const auctionGoodsId = 1
const commentsPath = `/api/v1/goods/${auctionGoodsId}/comments`
const initialLegalComment = '현황조사서와 등기부를 함께 확인한 인증 댓글입니다.'
const restrictedComposerNotice = '댓글은 누구나 볼 수 있지만 인증된 법무사와 관리자만 작성할 수 있습니다.'
const member = { loginId: 'commentmember', password: 'MemberPass!2026' }
const legalAgent = { loginId: 'commentlegal', password: 'LegalPass!2026' }
const admin = { loginId: 'commentadmin', password: 'AdminPass!2026' }

type LoginResponse = {
  access_token: string
}

function isApiResponse(response: Response, pathname: string, method: string) {
  return (
    new URL(response.url()).pathname === pathname &&
    response.request().method() === method
  )
}

async function login(
  page: Page,
  user: { loginId: string; password: string },
) {
  await page.goto('/login')
  await page.getByLabel('아이디', { exact: true }).fill(user.loginId)
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
  const responsePromise = page.waitForResponse((response) => (
    isApiResponse(response, '/api/v1/login', 'POST')
  ))
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  const payload = await response.json() as LoginResponse
  expect(payload.access_token).toEqual(expect.any(String))
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
  return payload.access_token
}

async function logout(page: Page) {
  const responsePromise = page.waitForResponse((response) => (
    isApiResponse(response, '/api/v1/logout', 'POST')
  ))
  await page.getByRole('button', { name: '로그아웃' }).click()
  expect((await responsePromise).status()).toBe(204)
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible()
}

async function openGoodsComments(page: Page) {
  const responsePromise = page.waitForResponse((response) => (
    isApiResponse(response, commentsPath, 'GET')
  ))
  await page.goto(`/goods/${auctionGoodsId}`)
  const response = await responsePromise
  expect(response.status()).toBe(200)
  await expect(
    page.getByRole('heading', { level: 2, name: '전문가 댓글' }),
  ).toBeVisible()
  return response
}

async function postCommentDirectly(
  request: APIRequestContext,
  apiOrigin: string,
  content: string,
  accessToken?: string,
) {
  return request.post(`${apiOrigin}${commentsPath}`, {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
    data: { content },
  })
}

function commentArticle(page: Page, content: string) {
  return page.locator('article').filter({ hasText: content })
}

test.describe('물건 전문가 댓글 실제 사용자 흐름', () => {
  test('비회원과 일반 회원은 읽기 전용이고 법무사와 관리자는 작성한다', async ({
    page,
    request,
  }) => {
    const anonymousListResponse = await openGoodsComments(page)
    const apiOrigin = new URL(anonymousListResponse.url()).origin
    const initialLegalArticle = commentArticle(page, initialLegalComment)
    await expect(initialLegalArticle).toHaveCount(1)
    await expect(
      initialLegalArticle.getByText('법무사', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(restrictedComposerNotice, { exact: true }),
    ).toHaveCount(0)
    await expect(page.getByLabel('댓글 내용')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '댓글 등록' })).toHaveCount(0)

    const anonymousPostResponse = await postCommentDirectly(
      request,
      apiOrigin,
      '비회원이 작성할 수 없어야 하는 댓글',
    )
    expect(anonymousPostResponse.status()).toBe(401)

    const memberAccessToken = await login(page, member)
    await openGoodsComments(page)
    await expect(
      page.getByText(restrictedComposerNotice, { exact: true }),
    ).toHaveCount(0)
    await expect(page.getByLabel('댓글 내용')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '댓글 등록' })).toHaveCount(0)

    const memberPostResponse = await postCommentDirectly(
      request,
      apiOrigin,
      '일반 회원이 작성할 수 없어야 하는 댓글',
      memberAccessToken,
    )
    expect(memberPostResponse.status()).toBe(403)
    await logout(page)

    const legalComment = '법무사 검토 결과, 말소기준권리 이후 권리는 소멸 예정입니다.'
    await login(page, legalAgent)
    await openGoodsComments(page)
    await page.getByLabel('댓글 내용').fill(legalComment)
    const legalPostResponsePromise = page.waitForResponse((response) => (
      isApiResponse(response, commentsPath, 'POST')
    ))
    await page.getByRole('button', { name: '댓글 등록' }).click()
    expect((await legalPostResponsePromise).status()).toBe(201)
    await expect(
      page.getByRole('status').filter({ hasText: '댓글이 등록되었습니다.' }),
    ).toContainText('댓글이 등록되었습니다.')
    const legalArticle = commentArticle(page, legalComment)
    await expect(legalArticle).toHaveCount(1)
    await expect(legalArticle.getByText('법무사', { exact: true })).toBeVisible()
    await logout(page)

    const adminComment = '관리자가 현황을 확인했으며 추가 공지사항은 없습니다.'
    await login(page, admin)
    await openGoodsComments(page)
    const persistedLegalArticle = commentArticle(page, legalComment)
    await expect(persistedLegalArticle).toHaveCount(1)
    await expect(
      persistedLegalArticle.getByText('법무사', { exact: true }),
    ).toBeVisible()
    await page.getByLabel('댓글 내용').fill(adminComment)
    const adminPostResponsePromise = page.waitForResponse((response) => (
      isApiResponse(response, commentsPath, 'POST')
    ))
    await page.getByRole('button', { name: '댓글 등록' }).click()
    expect((await adminPostResponsePromise).status()).toBe(201)
    await expect(
      page.getByRole('status').filter({ hasText: '댓글이 등록되었습니다.' }),
    ).toContainText('댓글이 등록되었습니다.')
    const adminArticle = commentArticle(page, adminComment)
    await expect(adminArticle).toHaveCount(1)
    await expect(adminArticle.getByText('관리자', { exact: true })).toBeVisible()
  })
})
