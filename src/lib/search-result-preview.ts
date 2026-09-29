import { useEffect, useRef, useState } from 'react'
import type { AuctionGoodsSearchItem } from './auction'
import { getGoodsDetail, getGoodsPhotoUrl, type GoodsDetailResponse } from './goods'
import { getRepresentativeGoodsPhoto } from './goods-photo-display'

export type SearchResultPreview = { caseNumber: string | null; photoUrl: string | null }
export type SearchResultPreviewCache = {
  goods: Map<number, SearchResultPreview>
  caseNumbers: Map<string, string>
}

function validCaseNumber(value: string | null | undefined) {
  const number = value?.trim()
  return number && number !== '-' ? number : null
}

export function getSearchResultPreview(detail: GoodsDetailResponse, goodsId: number): SearchResultPreview {
  const photo = getRepresentativeGoodsPhoto(detail.photos?.items ?? [], goodsId)
  return {
    caseNumber: validCaseNumber(detail.case_display_number) || validCaseNumber(detail.case?.case_display_number),
    photoUrl: getGoodsPhotoUrl(photo?.content_url, photo?.cdn_path),
  }
}

// 사진과 사건번호를 같은 상세 응답에서 읽고, 화면에 가까운 카드만 조회한다.
export function useSearchResultPreview(goods: AuctionGoodsSearchItem, cache: SearchResultPreviewCache) {
  const cardRef = useRef<HTMLElement>(null)
  const goodsId = goods.auction_goods_id
  const caseKey = goods.case_id || `goods:${goodsId}`
  const cached = cache.goods.get(goodsId)
  const [result, setResult] = useState<{ goodsId: number; preview?: SearchResultPreview; failed?: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (cached) return
    const controller = new AbortController()
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      setResult({ goodsId })
      getGoodsDetail(goodsId, controller.signal)
        .then((detail) => {
          if (controller.signal.aborted) return
          const preview = getSearchResultPreview(detail, goodsId)
          cache.goods.set(goodsId, preview)
          if (preview.caseNumber) cache.caseNumbers.set(caseKey, preview.caseNumber)
          setResult({ goodsId, preview })
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ goodsId, failed: true })
        })
    }, { rootMargin: '200px' })
    if (cardRef.current) observer.observe(cardRef.current)
    return () => {
      observer.disconnect()
      controller.abort()
    }
  }, [cache, cached, caseKey, goodsId, attempt])

  const current = result?.goodsId === goodsId ? result : null
  const preview = cached || current?.preview
  return {
    cardRef,
    caseNumber: validCaseNumber(goods.case_number) || cache.caseNumbers.get(caseKey) || preview?.caseNumber,
    photoUrl: preview?.photoUrl,
    status: preview ? 'ready' as const : current?.failed ? 'error' as const : 'loading' as const,
    retry: () => setAttempt((value) => value + 1),
  }
}
