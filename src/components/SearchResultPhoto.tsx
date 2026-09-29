import { useState } from 'react'
import { ImageOff, Loader2 } from 'lucide-react'

export default function SearchResultPhoto({ source, status, onRetry }: {
  source: string | null | undefined
  status: 'ready' | 'error' | 'loading'
  onRetry: () => void
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const hasError = status === 'error' || failed
  const isLoading = status === 'loading' || (source && !loaded && !failed)
  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:aspect-[4/3]">
      {source && !failed && (
        <img
          src={attempt ? `${source}?retry=${attempt}` : source}
          alt="물건 대표 사진"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover ${loaded ? '' : 'opacity-0'}`}
        />
      )}
      {(!source || failed || !loaded) && (
        <div className="flex flex-col items-center gap-1 p-2 text-center text-[11px] text-slate-500 sm:gap-2 sm:text-xs">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ImageOff className="h-5 w-5" aria-hidden="true" />}
          <span>{hasError ? '사진 확인 불가' : isLoading ? '사진 불러오는 중' : '사진 없음'}</span>
          {hasError && (
            <button type="button" onClick={() => {
              if (status === 'error') onRetry()
              else {
                setFailed(false)
                setLoaded(false)
                setAttempt((value) => value + 1)
              }
            }} className="font-bold text-indigo-700 underline underline-offset-2">
              사진 다시 불러오기
            </button>
          )}
        </div>
      )}
    </div>
  )
}
