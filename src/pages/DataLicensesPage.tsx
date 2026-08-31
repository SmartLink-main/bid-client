import { Database, ExternalLink, FileText, MapPinned, ShieldCheck } from 'lucide-react'
import leafletLicense from '../../node_modules/leaflet/LICENSE?raw'
import reactLeafletLicense from '../../node_modules/react-leaflet/LICENSE.md?raw'
import Layout from '../components/Layout'
import { DONG_VIEWPORT_SOURCE } from '../lib/dong-viewports'
import { REGION_VIEWPORT_SOURCE } from '../lib/region-viewports'

const externalLinkClass =
  'inline-flex items-center gap-1 font-bold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900'

function ExternalSourceLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={externalLinkClass}>
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">(새 창)</span>
    </a>
  )
}

export default function DataLicensesPage() {
  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <header>
            <p className="mb-2 w-fit rounded-full bg-blue-100 px-3 py-1 text-[11px] font-extrabold text-blue-700">
              지도 데이터 이용 고지
            </p>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
              <ShieldCheck className="h-6 w-6 text-blue-600" aria-hidden="true" />
              지도·데이터 출처 및 라이선스
            </h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              지도 화면과 지역 확대 기능에 사용된 데이터의 출처, 이용조건과 지도 라이브러리 고지를 안내합니다.
            </p>
          </header>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
              <MapPinned className="h-5 w-5 text-blue-600" aria-hidden="true" />
              베이스 지도 · OpenStreetMap
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              지도 타일과 지도 데이터는 OpenStreetMap 및 기여자가 제공하며 ODbL 1.0 조건에 따라 이용합니다.
              지도 화면 모서리의 출처표시는 항상 유지됩니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <ExternalSourceLink href="https://www.openstreetmap.org/copyright">OpenStreetMap 저작권·ODbL 안내</ExternalSourceLink>
              <ExternalSourceLink href="https://operations.osmfoundation.org/policies/tiles/">공식 타일 이용정책</ExternalSourceLink>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
              <Database className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              행정구역 확대 데이터
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                <h3 className="font-extrabold text-slate-800">시·도 및 시·군·구 범위</h3>
                <dl className="mt-3 space-y-2 text-sm text-gray-600">
                  <div><dt className="font-bold text-gray-500">출처</dt><dd>{REGION_VIEWPORT_SOURCE.provider}</dd></div>
                  <div><dt className="font-bold text-gray-500">기준일</dt><dd>{REGION_VIEWPORT_SOURCE.snapshotDate}</dd></div>
                  <div><dt className="font-bold text-gray-500">이용조건</dt><dd>{REGION_VIEWPORT_SOURCE.license}</dd></div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-gray-500">
                  OpenStreetMap 행정구역 관계의 WGS84 경계 상자를 정규화했으며, OSM 파생 범위 데이터는 ODbL 1.0으로 제공합니다.
                </p>
              </article>

              <article className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                <h3 className="font-extrabold text-slate-800">읍·면·동 범위</h3>
                <dl className="mt-3 space-y-2 text-sm text-gray-600">
                  <div><dt className="font-bold text-gray-500">출처</dt><dd>{DONG_VIEWPORT_SOURCE.provider} {DONG_VIEWPORT_SOURCE.layer}</dd></div>
                  <div><dt className="font-bold text-gray-500">기준일</dt><dd>{DONG_VIEWPORT_SOURCE.snapshotDate}</dd></div>
                  <div><dt className="font-bold text-gray-500">이용조건</dt><dd>{DONG_VIEWPORT_SOURCE.license}</dd></div>
                </dl>
                <div className="mt-3 flex flex-col items-start gap-2 text-sm">
                  <ExternalSourceLink href={DONG_VIEWPORT_SOURCE.dataPortalUrl}>국토교통부 행정구역도 공식 데이터</ExternalSourceLink>
                  <ExternalSourceLink href={DONG_VIEWPORT_SOURCE.codeSourceUrl}>행정표준코드관리시스템</ExternalSourceLink>
                </div>
              </article>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
              <FileText className="h-5 w-5 text-slate-600" aria-hidden="true" />
              지도 라이브러리 고지
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              지도 UI는 Leaflet과 React Leaflet을 사용합니다. 아래 항목에서 배포에 포함된 각 라이선스 전문을 확인할 수 있습니다.
            </p>
            <div className="mt-4 space-y-3">
              <details className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-extrabold text-slate-800">Leaflet · BSD 2-Clause License</summary>
                <pre className="mt-4 whitespace-pre-wrap break-words text-xs leading-5 text-gray-600">{leafletLicense}</pre>
              </details>
              <details className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-extrabold text-slate-800">React Leaflet · Hippocratic License 2.1 / MIT</summary>
                <pre className="mt-4 whitespace-pre-wrap break-words text-xs leading-5 text-gray-600">{reactLeafletLicense}</pre>
              </details>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
