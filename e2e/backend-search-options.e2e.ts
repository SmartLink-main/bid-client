import { expect, test } from '@playwright/test'

test('법원별 경매계를 번호순으로 반환하고 빈 법원도 구분한다', async ({ request }) => {
  const response = await request.get(
    '/api/v1/search/options/courts/B000210/divisions',
  )

  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    court_code: 'B000210',
    items: [
      { division_number: 2, division_name: '경매2계' },
      { division_number: 9, division_name: null },
    ],
  })

  const emptyResponse = await request.get(
    '/api/v1/search/options/courts/B000211/divisions',
  )

  expect(emptyResponse.status()).toBe(200)
  expect(await emptyResponse.json()).toEqual({
    court_code: 'B000211',
    items: [],
  })
})

test('등록되지 않은 법원 코드는 404로 반환한다', async ({ request }) => {
  const response = await request.get(
    '/api/v1/search/options/courts/B999999/divisions',
  )

  expect(response.status()).toBe(404)
  expect(await response.json()).toEqual({
    detail: 'Auction court was not found.',
  })
})
