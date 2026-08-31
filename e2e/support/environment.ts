export type E2EUser = {
  name: string
  loginId: string
  password: string
  phoneNumber: string
  smsCode: string
}

const runSeed = Date.now()

const baseUser: E2EUser = {
  name: '결제 E2E',
  loginId: `billing${runSeed.toString(36)}`,
  password: 'E2eBilling!2026',
  phoneNumber: `010${String(runSeed % 100_000_000).padStart(8, '0')}`,
  smsCode: '123456',
}

export function getE2EUser(scenarioIndex: number): E2EUser {
  if (!Number.isSafeInteger(scenarioIndex) || scenarioIndex < 0 || scenarioIndex > 99) {
    throw new Error('Billing E2E scenario index must be an integer from 0 through 99.')
  }

  const loginSuffix = `t${scenarioIndex + 1}`
  const subscriberNumber = Number(baseUser.phoneNumber.slice(3))
  const scenarioPhoneNumber = Number.isSafeInteger(subscriberNumber)
    ? `010${String((subscriberNumber + scenarioIndex) % 100_000_000).padStart(8, '0')}`
    : baseUser.phoneNumber

  return {
    ...baseUser,
    loginId: `${baseUser.loginId.slice(0, 20 - loginSuffix.length)}${loginSuffix}`,
    phoneNumber: scenarioPhoneNumber,
  }
}
