import { useRef, useState } from 'react'
import { getApiUrl } from '../lib/api'
import { getSafeInternalReturnTo } from '../lib/navigation'

type KakaoAuthButtonProps = {
  label: string
  returnTo?: unknown
  rememberMe?: boolean
  disabled?: boolean
}

function KakaoSymbol() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
    >
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.51 2 10.84c0 2.76 1.83 5.19 4.59 6.59l-1.17 3.9a.55.55 0 0 0 .84.61l4.63-3.18c.37.03.74.05 1.11.05 5.52 0 10-3.51 10-7.97S17.52 3 12 3Z"
      />
    </svg>
  )
}

export default function KakaoAuthButton({
  label,
  returnTo,
  rememberMe = false,
  disabled = false,
}: KakaoAuthButtonProps) {
  const [isStarting, setIsStarting] = useState(false)
  const startInFlight = useRef(false)

  const handleClick = () => {
    if (startInFlight.current || disabled) {
      return
    }

    startInFlight.current = true
    setIsStarting(true)
    const query = new URLSearchParams({
      return_to: getSafeInternalReturnTo(returnTo),
      remember_me: String(rememberMe),
    })
    window.location.assign(getApiUrl(`/api/v1/oauth/kakao/start?${query}`))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isStarting}
      className="flex w-full items-center justify-center gap-2.5 rounded-[12px] bg-[#FEE500] px-5 py-4 text-base font-bold text-[#191919] shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191919] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <KakaoSymbol />
      <span>{isStarting ? '카카오로 이동 중' : label}</span>
    </button>
  )
}
