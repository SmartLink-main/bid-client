export function getSafeInternalReturnTo(
  requestedReturnTo: unknown,
  fallback = '/',
) {
  if (typeof requestedReturnTo !== 'string' || !requestedReturnTo.startsWith('/')) {
    return fallback
  }

  try {
    const currentOrigin = typeof window === 'undefined'
      ? 'http://localhost'
      : window.location.origin
    const target = new URL(requestedReturnTo, `${currentOrigin}/`)
    const isPublicAuthEntry = (
      target.pathname === '/login' ||
      target.pathname.startsWith('/login/') ||
      target.pathname === '/signup' ||
      target.pathname.startsWith('/signup/') ||
      target.pathname === '/auth/kakao/callback' ||
      target.pathname.startsWith('/auth/kakao/callback/')
    )

    if (target.origin !== currentOrigin || isPublicAuthEntry) {
      return fallback
    }

    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}
