import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter, Search, SlidersHorizontal } from 'lucide-react'
import Layout from '../components/Layout'
import { getCourtDivisionOptions } from '../lib/auction'
import { getDongOptions } from '../lib/dong-filter-options'
import {
  COURT_OPTIONS,
  GOODS_USAGE_VALUES_BY_PROPERTY_TYPE,
  INTERESTED_PARTY_ROLE_OPTIONS,
  PROPERTY_TYPE_GROUPS,
  PROVINCE_SEARCH_TERMS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from '../lib/search-filter-options'

type AdvancedDraft = {
  q: string
  start_date: string
  end_date: string
  court_code: string
  division_name: string
  sido: string
  sigungu: string
  dong: string
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
  goods_usage: string[]
  sort_by: string
  half_price: boolean
}

const initialDraft: AdvancedDraft = {
  q: '', start_date: '', end_date: '', court_code: '', division_name: '',
  sido: '', sigungu: '', dong: '', case_serial: '', auction_kind: '',
  interested_party_role: '', interested_party_name: '', min_appraisal_amount: '', max_appraisal_amount: '',
  min_lowest_sale_price: '', max_lowest_sale_price: '', min_failed_count: '', max_failed_count: '',
  min_building_area_pyeong: '', max_building_area_pyeong: '', min_land_area_pyeong: '', max_land_area_pyeong: '',
  building_name: '', status: '', goods_usage: [], sort_by: 'auction_date_asc', half_price: false,
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

type SelectFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  disabled?: boolean
  helperText?: string
  helperIsError?: boolean
  className?: string
}

function SelectField({ id, label, value, onChange, children, disabled = false, helperText, helperIsError = false, className = '' }: SelectFieldProps) {
  const helperId = helperText ? `${id}-helper` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-bold text-gray-500">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-describedby={helperId}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-gray-400"
      >
        {children}
      </select>
      {helperText && <p id={helperId} className={`mt-1 text-xs font-medium ${helperIsError ? 'text-red-600' : 'text-gray-500'}`}>{helperText}</p>}
    </div>
  )
}

const integerKeys: (keyof AdvancedDraft)[] = [
  'case_serial', 'min_appraisal_amount', 'max_appraisal_amount', 'min_lowest_sale_price',
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

type DivisionSelectOption = {
  value: string
  label: string
  divisionNumber: number
}

type DivisionLoadState = 'idle' | 'loading' | 'loaded' | 'error'

const COURT_REGION_NAMES = [...new Set(COURT_OPTIONS.map((court) => court.courtName))]

export default function AdvancedSearchPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<AdvancedDraft>(initialDraft)
  const [errorMessage, setErrorMessage] = useState('')
  const [divisionOptions, setDivisionOptions] = useState<DivisionSelectOption[]>([])
  const [divisionLoadState, setDivisionLoadState] = useState<DivisionLoadState>('idle')
  const [divisionErrorMessage, setDivisionErrorMessage] = useState('')

  const selectedCourt = useMemo(
    () => COURT_OPTIONS.find((court) => court.courtCode === draft.court_code),
    [draft.court_code],
  )
  const selectedProvince = useMemo(
    () => REGION_PROVINCES.find((province) => PROVINCE_SEARCH_TERMS[province] === draft.sido) || '',
    [draft.sido],
  )
  const sigunguOptions = selectedProvince ? SIGUNGU_BY_PROVINCE[selectedProvince] || [] : []
  const dongOptions = selectedProvince && draft.sigungu
    ? getDongOptions(selectedProvince, draft.sigungu)
    : []
  const divisionPrompt = !selectedCourt
    ? '관할법원을 먼저 선택해 주세요'
    : divisionLoadState === 'loading'
      ? '경매계 목록을 불러오는 중입니다'
      : divisionLoadState === 'error'
        ? '경매계 목록을 불러오지 못했습니다'
        : divisionOptions.length === 0
          ? '등록된 경매계가 없습니다'
          : '전체 경매계'
  const divisionHelperText = divisionLoadState === 'error'
    ? divisionErrorMessage
    : divisionLoadState === 'loaded' && divisionOptions.length === 0
      ? '이 법원에는 현재 등록된 경매계가 없습니다.'
      : undefined

  useEffect(() => {
    if (!selectedCourt) return

    const controller = new AbortController()
    let isActive = true

    getCourtDivisionOptions(selectedCourt.courtCode, controller.signal)
      .then((response) => {
        if (!isActive) return

        const optionsByNumber = new Map<number, DivisionSelectOption>()
        response.items.forEach((item) => {
          const divisionNumber = Number(item.division_number)
          if (!Number.isInteger(divisionNumber) || divisionNumber < 0) return

          const divisionName = item.division_name?.trim()
          optionsByNumber.set(divisionNumber, {
            divisionNumber,
            label: divisionName || `경매${divisionNumber}계`,
            value: divisionName || `${divisionNumber}계`,
          })
        })
        setDivisionOptions([...optionsByNumber.values()].sort((a, b) => a.divisionNumber - b.divisionNumber))
        setDivisionLoadState('loaded')
        setDivisionErrorMessage('')
      })
      .catch(() => {
        if (!isActive || controller.signal.aborted) return
        setDivisionOptions([])
        setDivisionLoadState('error')
        setDivisionErrorMessage('경매계 목록을 불러오지 못했습니다. 관할법원을 다시 선택해 주세요.')
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [selectedCourt])

  const update = <K extends keyof AdvancedDraft>(key: K, value: AdvancedDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleCourtChange = (courtCode: string) => {
    setDraft((current) => ({ ...current, court_code: courtCode, division_name: '' }))
    setDivisionOptions([])
    setDivisionLoadState(courtCode ? 'loading' : 'idle')
    setDivisionErrorMessage('')
    setErrorMessage('')
  }

  const handleProvinceChange = (province: string) => {
    setDraft((current) => ({
      ...current,
      sido: province ? PROVINCE_SEARCH_TERMS[province] : '',
      sigungu: '',
      dong: '',
    }))
  }

  const handleSigunguChange = (sigungu: string) => {
    setDraft((current) => ({ ...current, sigungu, dong: '' }))
  }

  const toggleGoodsUsage = (item: string) => {
    setDraft((current) => ({
      ...current,
      goods_usage: current.goods_usage.includes(item)
        ? current.goods_usage.filter((selected) => selected !== item)
        : [...current.goods_usage, item],
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.start_date && draft.end_date && draft.start_date > draft.end_date) {
      setErrorMessage('매각기일 시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    for (const key of integerKeys) {
      const value = String(draft[key]).trim()
      if (value && (!Number.isInteger(Number(value)) || Number(value) < 0)) {
        setErrorMessage('사건번호·금액·유찰수는 0 이상의 정수로 입력해 주세요.')
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
    const goodsUsageValues = new Set(
      draft.goods_usage.flatMap((item) => GOODS_USAGE_VALUES_BY_PROPERTY_TYPE[item] || []),
    )
    goodsUsageValues.forEach((item) => params.append('goods_usage', item))
    if (draft.half_price) params.set('half_price', 'true')
    navigate(`/search?${params.toString()}`)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><SlidersHorizontal className="h-6 w-6 text-indigo-600" /> 경매 종합 상세검색</h1><p className="mt-1 text-sm text-gray-500">일정·법원·사건·가격·유찰·면적 조건을 조합해 검색합니다.</p></div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900"><Search className="h-4 w-4 text-indigo-600" /> 기본 및 일정</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2"><TextField label="통합 검색어" value={draft.q} onChange={(value) => update('q', value)} /></div>
                <fieldset className="sm:col-span-2">
                  <legend className="text-xs font-bold text-gray-500">매각기일</legend>
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <div className="min-w-0">
                      <label htmlFor="advanced-auction-date-start" className="sr-only">매각기일 시작일</label>
                      <input
                        id="advanced-auction-date-start"
                        type="date"
                        value={draft.start_date}
                        onChange={(event) => update('start_date', event.target.value)}
                        className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <span aria-hidden="true" className="text-sm font-bold text-gray-400">~</span>
                    <div className="min-w-0">
                      <label htmlFor="advanced-auction-date-end" className="sr-only">매각기일 종료일</label>
                      <input
                        id="advanced-auction-date-end"
                        type="date"
                        value={draft.end_date}
                        onChange={(event) => update('end_date', event.target.value)}
                        className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                </fieldset>
                <SelectField id="advanced-court" label="관할법원" value={draft.court_code} onChange={handleCourtChange} className="sm:col-span-2">
                  <option value="">전체 법원</option>
                  {COURT_REGION_NAMES.map((courtName) => (
                    <optgroup key={courtName} label={courtName}>
                      {COURT_OPTIONS.filter((court) => court.courtName === courtName).map((court) => (
                        <option key={court.courtCode} value={court.courtCode}>{court.branchName}</option>
                      ))}
                    </optgroup>
                  ))}
                </SelectField>
                <SelectField
                  id="advanced-division"
                  label="경매계"
                  value={draft.division_name}
                  onChange={(value) => update('division_name', value)}
                  disabled={!selectedCourt || divisionLoadState !== 'loaded' || divisionOptions.length === 0}
                  helperText={divisionHelperText}
                  helperIsError={divisionLoadState === 'error'}
                  className="sm:col-span-2"
                >
                  <option value="">{divisionPrompt}</option>
                  {divisionOptions.map((division) => (
                    <option key={division.divisionNumber} value={division.value}>{division.label}</option>
                  ))}
                </SelectField>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900"><Filter className="h-4 w-4 text-indigo-600" /> 지역·사건·물건</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SelectField id="advanced-sido" label="시/도" value={selectedProvince} onChange={handleProvinceChange}>
                  <option value="">전체 시/도</option>
                  {REGION_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                </SelectField>
                <SelectField id="advanced-sigungu" label="시/군/구" value={draft.sigungu} onChange={handleSigunguChange} disabled={!selectedProvince}>
                  <option value="">{selectedProvince ? '전체 시/군/구' : '시/도를 먼저 선택해 주세요'}</option>
                  {sigunguOptions.map((sigungu) => <option key={sigungu} value={sigungu}>{sigungu}</option>)}
                </SelectField>
                <SelectField
                  id="advanced-dong"
                  label="읍/면/동"
                  value={draft.dong}
                  onChange={(value) => update('dong', value)}
                  disabled={!selectedProvince || !draft.sigungu}
                >
                  <option value="">
                    {!selectedProvince
                      ? '시/도를 먼저 선택해 주세요'
                      : !draft.sigungu
                        ? '시/군/구를 먼저 선택해 주세요'
                        : '전체 읍/면/동'}
                  </option>
                  {dongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}
                </SelectField>
                <TextField label="사건번호" inputMode="numeric" value={draft.case_serial} onChange={(value) => update('case_serial', value)} />
                <SelectField id="advanced-auction-kind" label="경매종류" value={draft.auction_kind} onChange={(value) => update('auction_kind', value)}>
                  <option value="">전체 경매종류</option>
                  <option value="임의경매">임의경매</option>
                  <option value="강제경매">강제경매</option>
                </SelectField>
                <TextField label="건물명" value={draft.building_name} onChange={(value) => update('building_name', value)} />
                <SelectField id="advanced-party-role" label="이해관계인 구분" value={draft.interested_party_role} onChange={(value) => update('interested_party_role', value)}>
                  <option value="">전체 구분</option>
                  {INTERESTED_PARTY_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                </SelectField>
                <TextField label="이해관계인 이름" value={draft.interested_party_name} onChange={(value) => update('interested_party_name', value)} />
                <TextField label="현재상태" value={draft.status} onChange={(value) => update('status', value)} placeholder="사건·결과·물건 상태" />
                <fieldset className="sm:col-span-2 lg:col-span-4">
                  <legend className="text-xs font-bold text-gray-500">물건종류 (복수 선택 가능)</legend>
                  <div className="mt-1 grid gap-2 rounded-xl border border-gray-200 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-5">
                    {PROPERTY_TYPE_GROUPS.map((group) => (
                      <div key={group.id} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-100">
                        <p className="mb-2 text-xs font-extrabold text-slate-700">{group.title}</p>
                        <div className="flex flex-col gap-2">
                          {group.items.map((item) => (
                            <label key={item} className="flex cursor-pointer items-center gap-2 pl-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={draft.goods_usage.includes(item)}
                                onChange={() => toggleGoodsUsage(item)}
                                className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
                              />
                              {item}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>
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
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 py-2.5 pl-5 pr-1 text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.half_price} onChange={(event) => update('half_price', event.target.checked)} className="h-4 w-4 accent-indigo-600" /> 감정가 대비 최저가 50% 이하</label>
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
