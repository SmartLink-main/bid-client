import { expect, type Page, type Response } from '@playwright/test'
import type { E2EUser } from './environment'

function isApiResponse(response: Response, pathname: string, method: string) {
  const url = new URL(response.url())
  return url.pathname === pathname && response.request().method() === method
}

export async function signUpThroughUi(page: Page, user: E2EUser) {
  await page.goto('/signup')
  await expect(page.getByRole('heading', { name: '계정 만들기' })).toBeVisible()

  await page.getByLabel('이름', { exact: true }).fill(user.name)
  await page.getByLabel('아이디', { exact: true }).fill(user.loginId)
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
  await page.getByLabel('비밀번호 확인', { exact: true }).fill(user.password)
  await page.getByLabel('휴대폰 번호', { exact: true }).fill(user.phoneNumber)

  const challengeResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, '/api/v1/signup/sms', 'POST'),
  )
  await page.getByRole('button', { name: '인증번호 받기' }).click()
  expect((await challengeResponsePromise).ok()).toBe(true)

  await page.getByLabel('인증번호', { exact: true }).fill(user.smsCode)
  const verificationResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, '/api/v1/signup/sms/verify', 'POST'),
  )
  await page.getByRole('button', { name: '인증번호 확인' }).click()
  expect((await verificationResponsePromise).ok()).toBe(true)
  await expect(page.getByRole('button', { name: '확인 완료' })).toBeDisabled()

  await page.getByLabel(/이용약관 및 개인정보 수집·이용/).check()
  const signupResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, '/api/v1/signup', 'POST'),
  )
  await page.getByRole('button', { name: '회원가입 완료' }).click()
  expect((await signupResponsePromise).ok()).toBe(true)
  await page.waitForURL('/')
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
}
export async function logOutThroughUi(page: Page) {
  const logoutResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, '/api/v1/logout', 'POST'),
  )
  await page.getByRole('button', { name: '로그아웃' }).click()
  expect((await logoutResponsePromise).ok()).toBe(true)
  await page.waitForURL('/')
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible()
}

export async function logInThroughUi(page: Page, user: E2EUser) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: '환영합니다' })).toBeVisible()
  await page.getByLabel('아이디', { exact: true }).fill(user.loginId)
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password)

  const loginResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, '/api/v1/login', 'POST'),
  )
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  expect((await loginResponsePromise).ok()).toBe(true)
  await page.waitForURL('/')
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
}
