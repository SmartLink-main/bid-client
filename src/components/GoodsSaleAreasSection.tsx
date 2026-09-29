import type { GoodsSaleAreasSection as SaleAreas, GoodsSaleAreaValue } from '../lib/goods'
import { saleAreaComponentDisplay } from '../lib/goods-sale-area-display'

// 전체값을 모를 때 확인된 소계를 확정 면적으로 표시하지 않는다.
function areaDisplay(area: GoodsSaleAreaValue) {
  if (area.status === 'not_applicable') return '해당 없음'
  if (area.status === 'unknown') return '미확인'
  const partial = area.status === 'partial'
  const sqm = partial ? area.known_sqm : area.sqm
  const pyeong = partial ? area.known_pyeong : area.pyeong
  if (sqm == null || pyeong == null) return '미확인'
  const format = (value: number) => value.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
  const text = partial
    ? `${format(pyeong)}평 (${format(sqm)}㎡)`
    : `${area.pyeong_text || `${format(pyeong)}평`} (${area.sqm_text || `${format(sqm)}㎡`})`
  return partial ? `확인된 소계 ${text}` : text
}

function AreaValue({ area }: { area: GoodsSaleAreaValue }) {
  return (
    <>
      <span>{areaDisplay(area)}</span>
      {area.verification_status === 'needs_review' && area.status !== 'not_applicable' && (
        <span className="mt-1 block text-xs font-medium text-amber-700">원문 확인 필요</span>
      )}
    </>
  )
}

// 공부·매각목록 면적은 건축물대장의 대지·건축·연면적과 따로 제공한다.
export default function GoodsSaleAreasSection({ areas }: { areas?: SaleAreas }) {
  return (
    <section aria-labelledby="sale-areas-heading" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
      <h2 id="sale-areas-heading" className="text-lg font-extrabold text-slate-900">매각목록 면적</h2>
      <p className="mt-1 text-sm leading-6 text-gray-500">
        공부·매각목록의 기재 면적에 매각 지분과 포함·제외 조건을 적용합니다. 실측면적은 반영하지 않습니다.
      </p>
      {areas?.available ? (
        <div className="mt-5 space-y-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ['토지·대지권 합계', areas.land],
              ['본건 건물', areas.main_building],
              ['건물·제시외 포함 합계', areas.listed_total],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg bg-slate-50 p-4">
                <dt className="text-xs font-bold text-gray-500">{label as string}</dt>
                <dd className="mt-2 break-words text-sm font-extrabold leading-6 text-slate-900">
                  <AreaValue area={value as GoodsSaleAreaValue} />
                </dd>
              </div>
            ))}
          </dl>
          <details>
            <summary className="cursor-pointer text-sm font-bold text-indigo-700">면적 구분별 보기</summary>
            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm" aria-label="매각목록 면적 구분">
                <thead className="bg-slate-50 text-xs font-bold text-gray-500">
                  <tr><th scope="col" className="px-4 py-3">구분</th><th scope="col" className="px-4 py-3">면적</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['토지 필지', areas.land_parcel],
                    ['대지권', areas.land_rights],
                    ['본건 건물', areas.main_building],
                    ['공유 부분', areas.shared_building],
                    ['제시외 건물', areas.extra_building],
                    ['제시외 시설', areas.extra_facility],
                    ['건물·제시외 포함 합계', areas.listed_total],
                  ].map(([label, value]) => (
                    <tr key={label as string}>
                      <th scope="row" className="px-4 py-3 font-bold text-slate-700">{label as string}</th>
                      <td className="px-4 py-3 text-slate-700"><AreaValue area={value as GoodsSaleAreaValue} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              포함 합계는 본건과 매각에 포함된 제시외 건물·시설의 기재 면적을 합한 값입니다. 공유 부분은 따로 표시합니다.
              미확인 부분이 있으면 전체 합계 대신 확인된 소계만 표시합니다.
            </p>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-bold text-indigo-700">목록별 면적·지분</summary>
            {(areas.components ?? []).length > 0 ? (
              <>
                <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200" role="region" aria-label="목록별 면적·지분 표 가로 스크롤" tabIndex={0}>
                  <table className="w-full min-w-[780px] text-left text-sm" aria-label="목록별 면적·지분">
                    <thead className="bg-slate-50 text-xs font-bold text-gray-500">
                      <tr>
                        {['목록/상세', '구분', '공부면적', '매각지분', '매각면적', '매각 포함 여부'].map(label => (
                          <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {areas.components.map((component, index) => {
                        const row = saleAreaComponentDisplay(component)
                        return (
                          <tr key={component.component_key || index} className="align-top text-slate-700">
                            <th scope="row" className="whitespace-nowrap px-4 py-3 font-bold">
                              {row.object}
                              {row.detail && <span className="mt-1 block text-xs font-normal text-gray-500">{row.detail}</span>}
                            </th>
                            <td className="px-4 py-3">
                              <span className="whitespace-nowrap">{row.kind}</span>
                              {component.item_label && <span className="mt-1 block whitespace-nowrap text-xs font-medium text-slate-700">{component.item_label}</span>}
                              {row.notes.map(note => <span key={note} className="mt-1 block min-w-32 text-xs leading-5 text-gray-500">{note}</span>)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums">{row.sourceArea}</td>
                            <td className="px-4 py-3 tabular-nums">{row.share}</td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums">{row.saleArea}</td>
                            <td className="whitespace-nowrap px-4 py-3">{row.inclusion}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  매각면적은 공부면적에 지분을 적용한 값입니다. 대지권의 지분은 대지권 비율과 매각 지분을 함께 반영합니다.
                  포함 여부나 지분이 미확인인 항목은 확정 면적으로 표시하지 않습니다. 제외 항목은 합계에 더하지 않습니다.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-gray-500">수집된 목록별 면적·지분이 없습니다.</p>
            )}
          </details>
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-gray-200 bg-slate-50 px-4 py-8 text-center text-sm text-gray-500">
          아직 수집된 매각목록 면적이 없습니다.
        </p>
      )}
    </section>
  )
}
