import type { ReactNode } from 'react'

export default function SearchCaseNumber({ caseNumber, status, onRetry, children }: {
  caseNumber: string | null | undefined
  status: 'ready' | 'error' | 'loading'
  onRetry: () => void
  children?: ReactNode
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 className="text-xl font-extrabold break-words text-slate-900">
        {caseNumber || (status === 'ready' ? '사건번호 정보 없음' : status === 'error' ? '사건번호 확인 불가' : '사건번호 확인 중')}
      </h2>
      {children}
      {!caseNumber && status === 'error' && (
        <button type="button" onClick={onRetry} className="text-xs font-bold text-indigo-600 underline underline-offset-4">
          사건번호 다시 불러오기
        </button>
      )}
    </div>
  )
}
