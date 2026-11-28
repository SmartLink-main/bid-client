import { useEffect, useState } from 'react'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { fetchGoodsDocument, type GoodsDocument } from '../lib/goods-documents'

type Dates = { source: string; moveIn: string; fixed: string; demand: string }

type Result = Dates[] | 'no-tenancy' | null

async function readDates(goodsId: number, document: GoodsDocument, signal: AbortSignal): Promise<Result> {
  const blob = await fetchGoodsDocument(goodsId, document, signal)
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) })

  try {
    const page = await (await task.promise).getPage(1)
    const { items } = await page.getTextContent()
    const text = items.flatMap(item => 'str' in item && item.str.trim() ? [{
      value: item.str.trim(),
      center: item.transform[4] + item.width / 2,
      y: item.transform[5],
    }] : [])
    const moveIn = text.find(item => /^전입신고일자[·ㆍ]?$/.test(item.value))
    const fixed = text.find(item => item.value === '확정일자')
    const demand = text.find(item => item.value === '(배당요구일자)')
    const end = text.find(item => /^<\s*비고\s*>$/.test(item.value))
    if (!moveIn || !fixed || !demand || !end || end.y >= demand.y ||
        !(moveIn.center < fixed.center && fixed.center < demand.center)) return null
    const table = text.filter(item => item.y < demand.y && item.y > end.y)
    if (table.some(item => item.value.replace(/\s/g, '') === '조사된임차내역없음')) return 'no-tenancy'

    function readColumn(center: number, rowY: number) {
      const matches = table.filter(item =>
        Math.abs(item.y - rowY) <= 3 &&
        Math.abs(item.center - center) <= 15 &&
        /^\d{4}\.\d{1,2}\.\d{1,2}\.?$/.test(item.value),
      )
      const date = matches.length === 1 && matches[0].value.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\.?$/)
      return date ? date.slice(1).map(part => part.padStart(2, '0')).join('-') : '미확인'
    }

    const rows = table.filter(item => item.center < moveIn.center / 2 &&
      /^(현황조사|권리신고|등기사항전(?:부증명서)?)$/.test(item.value))
      .sort((a, b) => b.y - a.y)
    if (!rows.length) return null
    return rows.map(row => ({
      source: row.value.startsWith('등기사항전') ? '등기사항전부증명서' : row.value,
      moveIn: readColumn(moveIn.center, row.y),
      fixed: readColumn(fixed.center, row.y),
      demand: readColumn(demand.center, row.y),
    }))
  } finally {
    await task.destroy()
  }
}

export default function SaleSpecificationTenantDates({ goodsId, document }: { goodsId: number; document: GoodsDocument }) {
  const [dates, setDates] = useState<Result>()

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      controller.abort()
      setDates(null)
    }, 20_000)
    void readDates(goodsId, document, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDates(result) })
      .catch(() => { if (!controller.signal.aborted) setDates(null) })
      .finally(() => window.clearTimeout(timer))
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [goodsId, document])

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="font-extrabold text-slate-900">매각물건명세서 기재 날짜</h3>
      {Array.isArray(dates) ? (
        <ol className="mt-3 divide-y divide-gray-200">
          {dates.map((row, index) => (
            <li key={index} className="py-3 first:pt-0 last:pb-0">
              <p className="text-xs font-bold text-slate-600">명세서 기재 {index + 1} · {row.source}</p>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-slate-500">전입일</dt><dd className="font-bold">{row.moveIn}</dd></div>
                <div><dt className="text-slate-500">확정일자</dt><dd className="font-bold">{row.fixed}</dd></div>
                <div><dt className="text-slate-500">배당요구일</dt><dd className="font-bold">{row.demand}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      ) : (
        <p role="status" className="mt-2 text-sm text-slate-500">
          {dates === 'no-tenancy' ? '명세서에 조사된 임차내역이 없다고 기재되어 있습니다.'
            : dates === undefined ? '명세서에서 날짜를 확인하고 있습니다.'
              : '명세서의 전입일·확정일자·배당요구일은 미확인입니다.'}
        </p>
      )}
    </div>
  )
}
