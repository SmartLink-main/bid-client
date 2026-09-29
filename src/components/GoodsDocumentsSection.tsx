import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Loader2, X } from 'lucide-react'
import { fetchGoodsDocument, type GoodsDocument } from '../lib/goods-documents'
import PdfPreview from './PdfPreview'

/** 수집된 명세서 원본의 미리보기와 다운로드를 제공한다. */
function DocumentCard({ goodsId, document }: { goodsId: number; document: GoodsDocument }) {
  const [url, setUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  async function openDocument(download: boolean) {
    if (busy) return
    setBusy(true)
    setError(null)
    const controller = new AbortController()
    controllerRef.current = controller
    const timer = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const objectUrl = url ?? URL.createObjectURL(await fetchGoodsDocument(goodsId, document, controller.signal))
      if (controller.signal.aborted) {
        if (!url) URL.revokeObjectURL(objectUrl)
        return
      }
      setUrl(objectUrl)
      if (download) {
        const anchor = window.document.createElement('a')
        anchor.href = objectUrl
        anchor.download = `sale-specification-${goodsId}-${document.document_id}.pdf`
        window.document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      } else {
        setPreview(true)
      }
    } catch (cause) {
      setError(controller.signal.aborted
        ? '문서 요청 시간이 초과되었습니다. 다시 시도해 주세요.'
        : cause instanceof Error ? cause.message : '명세서를 불러오지 못했습니다.')
    } finally {
      window.clearTimeout(timer)
      setBusy(false)
    }
  }

  return (
    <article className="rounded-lg border border-gray-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">{document.title}</h3>
          <p className="mt-1 text-xs text-gray-500">
            수집일 {new Date(document.collected_at).toLocaleDateString('ko-KR')} · PDF · {Math.ceil(document.file_size_bytes / 1024).toLocaleString('ko-KR')} KB
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void openDocument(false)} className="inline-flex items-center gap-1 rounded-lg bg-blue-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF 보기
          </button>
          <button type="button" disabled={busy} onClick={() => void openDocument(true)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
            <Download className="h-4 w-4" /> 다운로드
          </button>
        </div>
      </div>
      {busy && <p role="status" className="mt-3 text-sm text-gray-500">명세서를 불러오는 중입니다.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} 위 버튼으로 다시 시도할 수 있습니다.</p>}
      {preview && url && (
        <div className="mt-4">
          <button type="button" onClick={() => setPreview(false)} className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-slate-600"><X className="h-4 w-4" /> 미리보기 닫기</button>
          <PdfPreview key={url} url={url} title={document.title} />
        </div>
      )}
    </article>
  )
}

/** 문서가 없는 물건과 수집된 명세서 이력을 구분해 표시한다. */
export default function GoodsDocumentsSection({ goodsId, documents }: { goodsId: number; documents: GoodsDocument[] }) {
  if (!documents.length) {
    return <p className="rounded-lg border border-dashed border-gray-200 bg-slate-50 px-4 py-8 text-center text-sm text-gray-500">아직 수집된 매각물건명세서가 없습니다.</p>
  }
  return <div className="space-y-4">{documents.map(document => <DocumentCard key={`${goodsId}-${document.document_id}`} goodsId={goodsId} document={document} />)}</div>
}
