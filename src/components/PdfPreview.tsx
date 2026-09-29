import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

function PdfPage({ pdf, pageNumber, title }: { pdf: PDFDocumentProxy; pageNumber: number; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let render: RenderTask | undefined
    void pdf.getPage(pageNumber).then(async page => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      const original = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(1500 / original.width, 3) })
      canvas.width = viewport.width
      canvas.height = viewport.height
      render = page.render({ canvas, viewport })
      await render.promise
      if (!cancelled) setReady(true)
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; render?.cancel() }
  }, [pdf, pageNumber])

  return <div>
    {!ready && !error && <p role="status" className="p-3 text-sm text-gray-500">페이지를 표시하는 중입니다.</p>}
    {error && <p role="alert" className="p-3 text-sm text-red-700">페이지를 표시하지 못했습니다. 미리보기를 다시 열거나 다운로드해 확인해 주세요.</p>}
    <canvas ref={canvasRef} role="img" aria-label={`${title} ${pageNumber}페이지`} data-rendered={ready} className={`h-auto w-full bg-white ${ready ? '' : 'hidden'}`} />
  </div>
}

/** 브라우저 내장 PDF 플러그인 없이 원본 문서를 표시한다. */
export default function PdfPreview({ url, title }: { url: string; title: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined
    void import('pdfjs-dist').then(async pdfjs => {
      if (cancelled) return
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      const task = pdfjs.getDocument({ url, useSystemFonts: true })
      destroy = () => { void task.destroy() }
      const document = await task.promise
      if (!cancelled) setPdf(document)
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; destroy?.() }
  }, [url])

  return <div className="overflow-hidden rounded border border-gray-200 bg-white">
    {error && <p role="alert" className="p-3 text-sm text-red-700">PDF를 표시하지 못했습니다. 미리보기를 다시 열거나 다운로드해 확인해 주세요.</p>}
    {!pdf && !error && <p role="status" className="p-3 text-sm text-gray-500">PDF를 준비하는 중입니다.</p>}
    {pdf && <>
      <div className="flex items-center justify-center gap-4 border-b border-gray-200 bg-slate-50 p-3 text-sm">
        <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(value => value - 1)} className="rounded border px-3 py-1 disabled:opacity-40">이전 페이지</button>
        <span aria-live="polite">{pageNumber} / {pdf.numPages} 페이지</span>
        <button type="button" disabled={pageNumber >= pdf.numPages} onClick={() => setPageNumber(value => value + 1)} className="rounded border px-3 py-1 disabled:opacity-40">다음 페이지</button>
      </div>
      <PdfPage key={pageNumber} pdf={pdf} pageNumber={pageNumber} title={title} />
    </>}
  </div>
}
