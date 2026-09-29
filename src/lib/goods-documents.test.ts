import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGoodsDocument, getGoodsDocumentUrl, type GoodsDocument } from './goods-documents'

const document: GoodsDocument = {
  document_id: 7,
  document_type: 'sale_specification',
  title: '매각물건명세서',
  content_type: 'application/pdf',
  file_size_bytes: 500,
  collected_at: '2026-09-10T00:00:00Z',
  content_url: '/api/v1/goods/42/documents/7',
  download_url: '/api/v1/goods/42/documents/7?download=true',
}

afterEach(() => vi.unstubAllGlobals())

describe('물건 명세서 파일 연결', () => {
  it('현재 물건에 속한 앱 URL만 허용한다', () => {
    expect(getGoodsDocumentUrl(42, document)).toMatch(/\/api\/v1\/goods\/42\/documents\/7$/)
    for (const url of ['https://elsewhere.example/file.pdf', '/api/v1/goods/43/documents/7', '/api/v1/goods/42/documents/8', '//elsewhere.example/file.pdf']) {
      expect(() => getGoodsDocumentUrl(42, { ...document, content_url: url })).toThrow()
    }
    expect(() => getGoodsDocumentUrl(43, document)).toThrow()
  })

  it('정상 PDF를 바이너리로 반환하고 인증정보를 전송하지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('%PDF-1.4\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } }))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    const blob = await fetchGoodsDocument(42, document, signal)
    expect(await blob.text()).toContain('%PDF-1.4')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal, credentials: 'omit' })
  })

  it('실패 JSON과 성공 상태의 HTML을 파일로 저장하지 않는다', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ detail: '명세서 파일이 저장소에 없습니다.' }, { status: 404 }))
      .mockResolvedValueOnce(new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchGoodsDocument(42, document, new AbortController().signal)).rejects.toThrow('저장소에 없습니다')
    await expect(fetchGoodsDocument(42, document, new AbortController().signal)).rejects.toThrow('올바른 PDF')
  })
})
