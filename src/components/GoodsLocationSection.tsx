import { ExternalLink, MapPin } from 'lucide-react'
import type { GoodsDetailResponse } from '../lib/goods'
import { goodsLocationLinks } from '../lib/goods-detail-display'

/** 위치 정보가 확인된 물건만 지도·로드뷰로 연결한다. 자동 외부 요청은 없다. */
export default function GoodsLocationSection({ location, address }: {
  location: GoodsDetailResponse['location']
  address: string | null
}) {
  const links = goodsLocationLinks(location)
  return (
    <section aria-labelledby="goods-location-heading" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <h2 id="goods-location-heading" className="text-lg font-extrabold text-slate-900">위치 확인</h2>
      <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-600"><MapPin className="mt-1 h-4 w-4 shrink-0" />{address || '주소 미확인'}</p>
      {links ? (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            {[['지도 보기', links.map], ['로드뷰 보기', links.roadview]].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-800">
                {label}<ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">카카오맵에서 새 창으로 열립니다. 로드뷰 제공 여부는 위치에 따라 다릅니다.</p>
        </>
      ) : <p className="mt-4 text-sm text-gray-500">위치 좌표가 확인되지 않아 지도 바로가기를 제공할 수 없습니다.</p>}
    </section>
  )
}
