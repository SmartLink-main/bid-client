import { useCallback, useEffect, useState } from 'react'

type CountdownState = {
  deadline: number | null
  seconds: number
}

export function useCountdown() {
  const [countdown, setCountdown] = useState<CountdownState>({
    deadline: null,
    seconds: 0,
  })

  useEffect(() => {
    const deadline = countdown.deadline
    if (deadline === null) {
      return
    }

    const timer = window.setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1_000),
      )
      setCountdown((current) => ({ ...current, seconds }))
      if (seconds === 0) {
        window.clearInterval(timer)
      }
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [countdown.deadline])

  const startCountdown = useCallback((seconds: number) => {
    const normalizedSeconds = Math.max(0, Math.ceil(seconds))
    setCountdown({
      deadline: Date.now() + normalizedSeconds * 1_000,
      seconds: normalizedSeconds,
    })
  }, [])

  const stopCountdown = useCallback(() => {
    setCountdown({ deadline: null, seconds: 0 })
  }, [])

  return {
    seconds: countdown.seconds,
    startCountdown,
    stopCountdown,
  }
}
