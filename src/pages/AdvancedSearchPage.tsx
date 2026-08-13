import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter, Search, SlidersHorizontal } from 'lucide-react'
import Layout from '../components/Layout'

type AdvancedDraft = {
  q: string
  start_date: string
  end_date: string
  court_code: string
  court_name: string
  branch_name: string
  division_name: string
  region: string
  sido: string
  sigungu: string
  dong: string
  case_year: string
  case_serial: string
  auction_kind: string
  interested_party_role: string
  interested_party_name: string
  min_appraisal_amount: string
  max_appraisal_amount: string
  min_lowest_sale_price: string
  max_lowest_sale_price: string
  min_failed_count: string
  max_failed_count: string
  min_building_area_pyeong: string
  max_building_area_pyeong: string
  min_land_area_pyeong: string
  max_land_area_pyeong: string
  building_name: string
  status: string
  goods_usage: string
  sort_by: string
  half_price: boolean
}

const initialDraft: AdvancedDraft = {
  q: '', start_date: '', end_date: '', court_code: '', court_name: '', branch_name: '', division_name: '',
  region: '', sido: '', sigungu: '', dong: '', case_year: '', case_serial: '', auction_kind: '',
  interested_party_role: '', interested_party_name: '', min_appraisal_amount: '', max_appraisal_amount: '',
  min_lowest_sale_price: '', max_lowest_sale_price: '', min_failed_count: '', max_failed_count: '',
  min_building_area_pyeong: '', max_building_area_pyeong: '', min_land_area_pyeong: '', max_land_area_pyeong: '',
  building_name: '', status: '', goods_usage: '', sort_by: 'auction_date_asc', half_price: false,
}

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'date'
  inputMode?: 'text' | 'numeric' | 'decimal'
}

function TextField({ label, value, onChange, placeholder, type = 'text', inputMode = 'text' }: TextFieldProps) {
  return (
    <label className="text-xs font-bold text-gray-500">{label}
      <input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
    </label>
  )
}

const integerKeys: (keyof AdvancedDraft)[] = [
  'case_year', 'case_serial', 'min_appraisal_amount', 'max_appraisal_amount', 'min_lowest_sale_price',
  'max_lowest_sale_price', 'min_failed_count', 'max_failed_count',
]

const decimalKeys: (keyof AdvancedDraft)[] = [
  'min_building_area_pyeong', 'max_building_area_pyeong', 'min_land_area_pyeong', 'max_land_area_pyeong',
]

const rangePairs: [keyof AdvancedDraft, keyof AdvancedDraft][] = [
  ['min_appraisal_amount', 'max_appraisal_amount'],
  ['min_lowest_sale_price', 'max_lowest_sale_price'],
  ['min_failed_count', 'max_failed_count'],
  ['min_building_area_pyeong', 'max_building_area_pyeong'],
  ['min_land_area_pyeong', 'max_land_area_pyeong'],
]

export default function AdvancedSearchPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<AdvancedDraft>(initialDraft)
  const [errorMessage, setErrorMessage] = useState('')

  const update = <K extends keyof AdvancedDraft>(key: K, value: AdvancedDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) {
      setErrorMessage('조회 시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    for (const key of integerKeys) {
      const value = String(draft[key]).trim()
      if (value && (!Number.isInteger(Number(value)) || Number(value) < (key === 'case_year' ? 1900 : 0))) {
        setErrorMessage('사건연도는 1900 이상, 사건번호·금액·유찰수는 0 이상의 정수로 입력해 주세요.')
        return
      }
    }
    for (const key of decimalKeys) {
      const value = String(draft[key]).trim()
      if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        setErrorMessage('면적은 0 이상의 숫자로 입력해 주세요.')
        return
      }
    }
    for (const [minimumKey, maximumKey] of rangePairs) {
      const minimum = String(draft[minimumKey]).trim()
      const maximum = String(draft[maximumKey]).trim()
      if (minimum && maximum && Number(minimum) > Number(maximum)) {
        setErrorMessage('각 범위의 최소값은 최대값보다 클 수 없습니다.')
        return
      }
    }

    const params = new URLSearchParams({ search_type: 'comprehensive', sort_by: draft.sort_by, limit: '50', offset: '0' })
    Object.entries(draft).forEach(([key, rawValue]) => {
      if (key === 'sort_by' || key === 'half_price' || key === 'goods_usage') return
      const value = String(rawValue).trim()
      if (value) params.set(key, value)
    })
    draft.goods_usage.split(',').map((item) => item.trim()).filter(Boolean).forEach((item) => params.append('goods_usage', item))
    if (draft.half_price) params.set('half_price', 'true')
    navigate(`/search?${params.toString()}`)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><SlidersHorizontal className="h-6 w-6 text-indigo-600" /> 경매 종합 상세검색</h1><p className="mt-1 text-sm text-gray-500">일정·법원·사건·가격·유찰·면적 조건을 조합해 검색합니다.</p></div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900"><Search className="h-4 w-4 text-indigo-600" /> 기본 및 일정</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2"><TextField label="통합 검색어" value={draft.q} onChange={(value) => update('q', value)} placeholder="공백으로 나눈 모든 단어를 만족" /></div>
                <TextField label="조회 시작일" type="date" value={draft.start_date} onChange={(value) => update('start_date', value)} />
                <TextField label="조회 종료일" type="date" value={draft.end_date} onChange={(value) => update('end_date', value)} />
                <TextField label="법원 코드 (정확히 일치)" value={draft.court_code} onChange={(value) => update('court_code', value)} />
                <TextField label="법원명" value={draft.court_name} onChange={(value) => update('court_name', value)} />
                <TextField label="지원명" value={draft.branch_name} onChange={(value) => update('branch_name', value)} />
                <TextField label="경매계" value={draft.division_name} onChange={(value) => update('division_name', value)} />
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900"><Filter className="h-4 w-4 text-indigo-600" /> 지역·사건·물건</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TextField label="지역 통합 (주소·건물명)" value={draft.region} onChange={(value) => update('region', value)} />
                <TextField label="시/도" value={draft.sido} onChange={(value) => update('sido', value)} />
                <TextField label="시/군/구" value={draft.sigungu} onChange={(value) => update('sigungu', value)} />
                <TextField label="읍/면/동" value={draft.dong} onChange={(value) => update('dong', value)} />
                <TextField label="사건 연도 (1900 이상)" inputMode="numeric" value={draft.case_year} onChange={(value) => update('case_year', value)} />
                <TextField label="사건 일련번호" inputMode="numeric" value={draft.case_serial} onChange={(value) => update('case_serial', value)} />
                <TextField label="경매종류" value={draft.auction_kind} onChange={(value) => update('auction_kind', value)} placeholder="임의경매, 강제경매" />
                <TextField label="건물명" value={draft.building_name} onChange={(value) => update('building_name', value)} />
                <TextField label="이해관계인 구분" value={draft.interested_party_role} onChange={(value) => update('interested_party_role', value)} placeholder="예: 채권자" />
                <TextField label="이해관계인 이름" value={draft.interested_party_name} onChange={(value) => update('interested_party_name', value)} />
                <TextField label="현재상태" value={draft.status} onChange={(value) => update('status', value)} placeholder="사건·결과·물건 상태" />
                <TextField label="물건종류 (쉼표로 반복 지정)" value={draft.goods_usage} onChange={(value) => update('goods_usage', value)} placeholder="아파트,오피스텔" />
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-extrabold text-slate-900">가격·유찰·면적 범위</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TextField label="최소 감정가" inputMode="numeric" value={draft.min_appraisal_amount} onChange={(value) => update('min_appraisal_amount', value)} />
                <TextField label="최대 감정가" inputMode="numeric" value={draft.max_appraisal_amount} onChange={(value) => update('max_appraisal_amount', value)} />
                <TextField label="최소 최저가" inputMode="numeric" value={draft.min_lowest_sale_price} onChange={(value) => update('min_lowest_sale_price', value)} />
                <TextField label="최대 최저가" inputMode="numeric" value={draft.max_lowest_sale_price} onChange={(value) => update('max_lowest_sale_price', value)} />
                <TextField label="최소 유찰수" inputMode="numeric" value={draft.min_failed_count} onChange={(value) => update('min_failed_count', value)} />
                <TextField label="최대 유찰수" inputMode="numeric" value={draft.max_failed_count} onChange={(value) => update('max_failed_count', value)} />
                <TextField label="최소 건물면적(평)" inputMode="decimal" value={draft.min_building_area_pyeong} onChange={(value) => update('min_building_area_pyeong', value)} />
                <TextField label="최대 건물면적(평)" inputMode="decimal" value={draft.max_building_area_pyeong} onChange={(value) => update('max_building_area_pyeong', value)} />
                <TextField label="최소 토지면적(평)" inputMode="decimal" value={draft.min_land_area_pyeong} onChange={(value) => update('min_land_area_pyeong', value)} />
                <TextField label="최대 토지면적(평)" inputMode="decimal" value={draft.max_land_area_pyeong} onChange={(value) => update('max_land_area_pyeong', value)} />
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.half_price} onChange={(event) => update('half_price', event.target.checked)} className="h-4 w-4 accent-indigo-600" /> 감정가 대비 최저가 50% 이하</label>
                <label className="text-xs font-bold text-gray-500">정렬
                  <select value={draft.sort_by} onChange={(event) => update('sort_by', event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
                    <option value="auction_date_asc">매각일 빠른순</option><option value="auction_date_desc">매각일 늦은순</option><option value="case_old">사건 오래된순</option><option value="case_new">사건 최신순</option><option value="appraisal_desc">감정가 높은순</option><option value="appraisal_asc">감정가 낮은순</option><option value="lowest_desc">최저가 높은순</option><option value="lowest_asc">최저가 낮은순</option><option value="failed_count_desc">유찰 많은순</option><option value="failed_count_asc">유찰 적은순</option>
                  </select>
                </label>
              </div>
            </section>

            {errorMessage && <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{errorMessage}</div>}
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-base font-extrabold text-white shadow-sm hover:bg-indigo-700"><Search className="h-5 w-5" /> 종합검색 결과 보기</button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
