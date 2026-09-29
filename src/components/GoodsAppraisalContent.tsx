import { Fragment, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { AppraisalItem } from '../lib/goods'
import { appraisalDisplay } from '../lib/goods-appraisal-display'

export default function GoodsAppraisalContent({ items }: { items: AppraisalItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const display = appraisalDisplay(items, expanded)

  if (items.length === 0) {
    return <p className="py-4 text-sm text-gray-500">등록된 감정평가 항목이 없습니다.</p>
  }

  return (
    <div role="region" aria-label="감정평가 설명" className="min-w-0 border-t border-gray-200 pt-5">
      <div id={contentId} className="space-y-4 text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">
        {display.items.map((item, index) => (
          <Fragment key={index}>
            {item.startsGroup && (
              <h3 className={`${index > 0 ? 'border-t border-gray-100 pt-5 ' : ''}font-extrabold text-indigo-700`}>
                {item.groupTitle}
              </h3>
            )}
            <div>
              <h4 className="font-bold text-slate-900">{item.title}</h4>
              <p className="mt-1 whitespace-pre-wrap">{item.content}</p>
            </div>
          </Fragment>
        ))}
      </div>
      {display.canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded(value => !value)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {expanded ? '감정평가 접기' : '감정평가 전체 내용 보기'}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
