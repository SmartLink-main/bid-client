import { getApiUrl } from './api'

/** 물건 상세에 연결된 매각물건명세서의 공개 메타데이터. */
export type GoodsDocument = {
  document_id: number
  document_type: 'sale_specification'
  title: string
  content_type: string
  file_size_bytes: number
  collected_at: string
  content_url: string
  download_url: string
}

/** 현재 물건에 속한 문서의 앱 경로만 파일 요청에 사용한다. */
export function getGoodsDocumentUrl(goodsId: number, document: GoodsDocument) {
  if (
    !Number.isSafeInteger(goodsId) || goodsId < 1 ||
    !Number.isSafeInteger(document.document_id) || document.document_id < 1 ||
    document.document_type !== 'sale_specification' ||
    document.content_url !== `/api/v1/goods/${goodsId}/documents/${document.document_id}`
  ) {
    throw new Error('이 물건에 연결된 명세서 주소가 올바르지 않습니다.')
  }
  return getApiUrl(document.content_url)
}

/** 오류 JSON을 PDF로 저장하지 않고 정상 PDF만 반환한다. */
export async function fetchGoodsDocument(
  goodsId: number,
  document: GoodsDocument,
  signal: AbortSignal,
) {
  const response = await fetch(getGoodsDocumentUrl(goodsId, document), {
    signal,
    credentials: 'omit',
    headers: { Accept: 'application/pdf' },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(
      typeof payload?.detail === 'string'
        ? payload.detail
        : '명세서를 불러오지 못했습니다. 다시 시도해 주세요.',
    )
  }
  if (response.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/pdf') {
    throw new Error('올바른 PDF 문서가 아닙니다.')
  }
  return response.blob()
}
