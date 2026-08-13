import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Server, XCircle } from 'lucide-react'
import Layout from '../components/Layout'
import { getKoreanErrorMessage } from '../lib/api'
import { getHealth } from '../lib/health'

type CheckState = 'loading' | 'healthy' | 'unhealthy'

export default function SystemStatusPage() {
  const [state, setState] = useState<CheckState>('loading')
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const [message, setMessage] = useState('')

  const checkHealth = useCallback(async () => {
    setState('loading')
    setMessage('')
    try {
      const response = await getHealth()
      if (response.status !== 'ok') {
        throw new Error(`Unexpected health status: ${response.status}`)
      }
      setState('healthy')
    } catch (error) {
      setState('unhealthy')
      setMessage(getKoreanErrorMessage(error, 'API 서버의 응답을 확인하지 못했습니다.'))
    } finally {
      setCheckedAt(new Date())
    }
  }, [])

  useEffect(() => {
    let isActive = true
    getHealth()
      .then((response) => {
        if (!isActive) {
          return
        }
        if (response.status !== 'ok') {
          throw new Error(`Unexpected health status: ${response.status}`)
        }
        setState('healthy')
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState('unhealthy')
          setMessage(getKoreanErrorMessage(error, 'API 서버의 응답을 확인하지 못했습니다.'))
        }
      })
      .finally(() => {
        if (isActive) {
          setCheckedAt(new Date())
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  return (
    <Layout>
      <div className="flex w-full flex-grow items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-3"><Server className="h-6 w-6 text-slate-700" /></div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">시스템 상태</h1>
              <p className="mt-1 text-sm text-gray-500">auction_app API 생존 상태를 확인합니다.</p>
            </div>
          </div>

          <div className={`mt-7 rounded-2xl border p-6 ${state === 'healthy' ? 'border-emerald-200 bg-emerald-50' : state === 'unhealthy' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-slate-50'}`}>
            <div className="flex items-center gap-3" role="status">
              {state === 'loading' && <Loader2 className="h-7 w-7 animate-spin text-blue-700" />}
              {state === 'healthy' && <CheckCircle2 className="h-7 w-7 text-emerald-700" />}
              {state === 'unhealthy' && <XCircle className="h-7 w-7 text-red-700" />}
              <div>
                <p className="font-extrabold text-slate-900">
                  {state === 'loading' ? 'API 확인 중' : state === 'healthy' ? 'API 정상 응답' : 'API 응답 오류'}
                </p>
                {checkedAt && <p className="mt-1 text-xs text-gray-500">확인 시각: {checkedAt.toLocaleString('ko-KR')}</p>}
              </div>
            </div>
            {message && <p className="mt-4 text-sm font-semibold text-red-700" role="alert">{message}</p>}
          </div>

          <p className="mt-5 text-xs leading-relaxed text-gray-500">
            이 상태 확인은 웹 애플리케이션의 생존 응답만 검사합니다. 데이터베이스, Redis, SMS 공급자의 개별 상태까지 보장하지는 않습니다.
          </p>
          <button
            type="button"
            onClick={() => void checkHealth()}
            disabled={state === 'loading'}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-extrabold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} /> 다시 확인
          </button>
        </div>
      </div>
    </Layout>
  )
}
