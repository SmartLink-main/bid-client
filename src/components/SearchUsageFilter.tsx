import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AuctionSearchMode, AuctionSearchParams } from '../lib/auction'
import { getKoreanErrorMessage } from '../lib/api'
import { loadSearchUsageCounts, type SearchUsageCounts, type SearchUsageSeed } from '../lib/search-usage-counts'

// 검색 전체의 용도별 건수를 선택 가능한 목록으로 표시한다.
export default function SearchUsageFilter({
  contextKey, params, mode, seed, selected, onSelect,
}: {
  contextKey: string
  params: AuctionSearchParams
  mode: AuctionSearchMode
  seed: SearchUsageSeed | null
  selected: string[]
  onSelect: (usage: string | null) => void
}) {
  const [result, setResult] = useState<{ key: string; counts?: SearchUsageCounts; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)
  const ready = seed?.key === contextKey

  useEffect(() => {
    if (!ready || !seed) return
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) setResult({ key: contextKey })
    })
    loadSearchUsageCounts(params, mode, controller.signal, seed)
      .then((counts) => {
        if (!controller.signal.aborted) setResult({ key: contextKey, counts })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResult({ key: contextKey, error: getKoreanErrorMessage(error, '용도별 건수를 불러오지 못했습니다.') })
        controller.abort()
      })
    return () => controller.abort()
  }, [contextKey, mode, params, ready, retry, seed])

  if (!ready) return null
  const current = result?.key === contextKey ? result : null
  const counts = current?.counts

  return (
    <section aria-label="용도별 검색 필터" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-extrabold text-slate-800">용도별 검색</h2>
        {counts && (
          <button type="button" aria-label={`전체 ${counts.total.toLocaleString('ko-KR')}건`} aria-pressed={selected.length === 0} onClick={() => onSelect(null)}
            className={`rounded-md px-2.5 py-1.5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${selected.length === 0 ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            전체 <span className="ml-1 tabular-nums text-blue-600">{counts.total.toLocaleString('ko-KR')}</span><span className="sr-only">건</span>
          </button>
        )}
      </div>
      {!counts && !current?.error && (
        <p className="flex items-center gap-2 py-3 text-sm text-slate-500" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />용도별 건수를 불러오는 중
        </p>
      )}
      {current?.error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <p>{current.error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="font-bold text-blue-600 underline underline-offset-4">건수 다시 불러오기</button>
        </div>
      )}
      {counts && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
          {counts.items.map(({ value, count }) => (
            <button key={value} type="button" aria-label={`${value} ${count.toLocaleString('ko-KR')}건`} aria-pressed={selected.includes(value)} onClick={() => onSelect(value)}
              className={`min-w-0 rounded-md px-2 py-2.5 text-left text-sm font-semibold leading-6 break-words transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${selected.includes(value) ? 'bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'}`}>
              {value}<span className="ml-1.5 whitespace-nowrap font-bold tabular-nums text-blue-600">{count.toLocaleString('ko-KR')}<span className="sr-only">건</span></span>
            </button>
          ))}
          {counts.missing > 0 && (
            <p className="px-2 py-2.5 text-sm leading-6 text-slate-400">용도 미등록 <span className="ml-1 tabular-nums">{counts.missing.toLocaleString('ko-KR')}건</span></p>
          )}
        </div>
      )}
    </section>
  )
}
