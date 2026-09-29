import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import Layout from '../components/Layout'
import { getCourtDivisionOptions } from '../lib/auction'
import { getDongOptions } from '../lib/dong-filter-options'
import {
  AUCTION_STATUS_OPTIONS,
  COURT_OPTIONS,
  GOODS_USAGE_VALUES_BY_PROPERTY_TYPE,
  INTERESTED_PARTY_ROLE_OPTIONS,
  PROPERTY_TYPE_GROUPS,
  PROVINCE_SEARCH_TERMS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from '../lib/search-filter-options'

type AdvancedDraft = {
  start_date: string
  end_date: string
  court_code: string
  division_name: string
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
  goods_usage: string[]
}

const initialDraft: AdvancedDraft = {
  start_date: '', end_date: '', court_code: '', division_name: '',
  sido: '', sigungu: '', dong: '', case_year: '', case_serial: '', auction_kind: '',
  interested_party_role: '', interested_party_name: '', min_appraisal_amount: '', max_appraisal_amount: '',
  min_lowest_sale_price: '', max_lowest_sale_price: '', min_failed_count: '', max_failed_count: '',
  min_building_area_pyeong: '', max_building_area_pyeong: '', min_land_area_pyeong: '', max_land_area_pyeong: '',
  building_name: '', status: '', goods_usage: [],
}

const controlClassName = 'h-8.5 w-full min-w-0 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
const labelClassName = 'text-xs font-bold text-gray-500'

function FieldGroup({ label, children, testId, className = '' }: {
  label: string
  children: ReactNode
  testId?: string
  className?: string
}) {
  return (
    <fieldset data-testid={testId} className={`min-w-0 ${className}`}>
      <legend className={labelClassName}>{label}</legend>
      <div className="mt-1 min-w-0">{children}</div>
    </fieldset>
  )
}

type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <label className={`block min-w-0 ${labelClassName}`}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 ${controlClassName}`} />
    </label>
  )
}

type RangeFieldProps = {
  label: string
  minimum: string
  maximum: string
  onMinimumChange: (value: string) => void
  onMaximumChange: (value: string) => void
  inputMode?: 'numeric' | 'decimal'
}

function RangeField({ label, minimum, maximum, onMinimumChange, onMaximumChange, inputMode = 'numeric' }: RangeFieldProps) {
  return (
    <FieldGroup label={label} className="col-span-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
        <input aria-label={`최소 ${label}`} inputMode={inputMode} value={minimum} onChange={(event) => onMinimumChange(event.target.value)} className={controlClassName} />
        <span aria-hidden="true" className="text-sm text-gray-400">~</span>
        <input aria-label={`최대 ${label}`} inputMode={inputMode} value={maximum} onChange={(event) => onMaximumChange(event.target.value)} className={controlClassName} />
      </div>
    </FieldGroup>
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
}

function SelectField({ id, label, value, onChange, children, disabled = false, helperText, helperIsError = false }: SelectFieldProps) {
  const helperId = helperText ? `${id}-helper` : undefined

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={`block ${labelClassName}`}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-describedby={helperId}
        className={`mt-1 ${controlClassName} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-gray-400`}
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
const currentCaseYear = new Date().getFullYear()
const CASE_YEAR_OPTIONS = Array.from({ length: currentCaseYear - 2010 + 1 }, (_, index) => String(currentCaseYear - index))

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

    const params = new URLSearchParams({ search_type: 'comprehensive', sort_by: 'auction_date_asc', limit: '50', offset: '0' })
    Object.entries(draft).forEach(([key, rawValue]) => {
      if (key === 'goods_usage') return
      const value = String(rawValue).trim()
      if (value) params.set(key, value)
    })
    const goodsUsageValues = new Set(
      draft.goods_usage.flatMap((item) => GOODS_USAGE_VALUES_BY_PROPERTY_TYPE[item] || []),
    )
    goodsUsageValues.forEach((item) => params.append('goods_usage', item))
    navigate(`/search?${params.toString()}`)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <div><h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900"><SlidersHorizontal className="h-5 w-5 text-indigo-600" /> 경매 종합 상세검색</h1><p className="mt-1 text-xs text-gray-500">일정·법원·사건·가격·유찰·면적 조건을 조합해 검색합니다.</p></div>

          <form data-testid="advanced-search-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div data-testid="advanced-basic-filters" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <FieldGroup label="사건번호" testId="advanced-case-number" className="col-span-2">
                <div className="grid grid-cols-2 items-center gap-2">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <select
                      aria-label="사건 연도"
                      value={draft.case_year}
                      onChange={(event) => update('case_year', event.target.value)}
                      className={controlClassName}
                    >
                      <option value="">전체</option>
                      {CASE_YEAR_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <span className="whitespace-nowrap text-sm text-gray-600">타경</span>
                  </div>
                  <input aria-label="사건번호" inputMode="numeric" value={draft.case_serial} onChange={(event) => update('case_serial', event.target.value)} className={controlClassName} />
                </div>
              </FieldGroup>
              <TextField label="건물명" value={draft.building_name} onChange={(value) => update('building_name', value)} />
              <SelectField id="advanced-sido" label="시/도" value={selectedProvince} onChange={handleProvinceChange}>
                <option value="">전체 시/도</option>
                {REGION_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
              </SelectField>
              <SelectField id="advanced-sigungu" label="시/군/구" value={draft.sigungu} onChange={handleSigunguChange} disabled={!selectedProvince}>
                <option value="">{selectedProvince ? '전체 시/군/구' : '시/도를 먼저 선택해 주세요'}</option>
                {sigunguOptions.map((sigungu) => <option key={sigungu} value={sigungu}>{sigungu}</option>)}
              </SelectField>
              <SelectField id="advanced-dong" label="읍/면/동" value={draft.dong} onChange={(value) => update('dong', value)} disabled={!selectedProvince || !draft.sigungu}>
                <option value="">
                  {!selectedProvince
                    ? '시/도를 먼저 선택해 주세요'
                    : !draft.sigungu
                      ? '시/군/구를 먼저 선택해 주세요'
                      : '전체 읍/면/동'}
                </option>
                {dongOptions.map((dong) => <option key={dong} value={dong}>{dong}</option>)}
              </SelectField>
            </div>

            <div data-testid="advanced-property-filters" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="min-w-0">
                <SelectField id="advanced-court" label="관할법원" value={draft.court_code} onChange={handleCourtChange}>
                  <option value="">전체 법원</option>
                  {COURT_REGION_NAMES.map((courtName) => (
                    <optgroup key={courtName} label={courtName}>
                      {COURT_OPTIONS.filter((court) => court.courtName === courtName).map((court) => (
                        <option key={court.courtCode} value={court.courtCode}>{court.branchName}</option>
                      ))}
                    </optgroup>
                  ))}
                </SelectField>
              </div>
              <div className="min-w-0">
                <SelectField
                  id="advanced-division"
                  label="경매계"
                  value={draft.division_name}
                  onChange={(value) => update('division_name', value)}
                  disabled={!selectedCourt || divisionLoadState !== 'loaded' || divisionOptions.length === 0}
                  helperText={divisionHelperText}
                  helperIsError={divisionLoadState === 'error'}
                >
                  <option value="">{divisionPrompt}</option>
                  {divisionOptions.map((division) => (
                    <option key={division.divisionNumber} value={division.value}>{division.label}</option>
                  ))}
                </SelectField>
              </div>
              <SelectField id="advanced-auction-kind" label="경매종류" value={draft.auction_kind} onChange={(value) => update('auction_kind', value)}>
                <option value="">전체 경매종류</option>
                <option value="임의경매">임의경매</option>
                <option value="강제경매">강제경매</option>
              </SelectField>
              <SelectField id="advanced-status" label="현재상태" value={draft.status} onChange={(value) => update('status', value)}>
                <option value="">전체 상태</option>
                {AUCTION_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </SelectField>
              <FieldGroup label="매각기일" className="col-span-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
                  <input aria-label="매각기일 시작일" type="date" value={draft.start_date} onChange={(event) => update('start_date', event.target.value)} className={controlClassName} />
                  <span aria-hidden="true" className="text-sm font-bold text-gray-400">~</span>
                  <input aria-label="매각기일 종료일" type="date" value={draft.end_date} onChange={(event) => update('end_date', event.target.value)} className={controlClassName} />
                </div>
              </FieldGroup>
            </div>

            <div data-testid="advanced-range-filters" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <SelectField id="advanced-party-role" label="이해관계인 구분" value={draft.interested_party_role} onChange={(value) => update('interested_party_role', value)}>
                <option value="">전체 구분</option>
                {INTERESTED_PARTY_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
              </SelectField>
              <TextField label="이해관계인 이름" value={draft.interested_party_name} onChange={(value) => update('interested_party_name', value)} />
              <RangeField label="건물면적(평)" inputMode="decimal" minimum={draft.min_building_area_pyeong} maximum={draft.max_building_area_pyeong} onMinimumChange={(value) => update('min_building_area_pyeong', value)} onMaximumChange={(value) => update('max_building_area_pyeong', value)} />
              <RangeField label="토지면적(평)" inputMode="decimal" minimum={draft.min_land_area_pyeong} maximum={draft.max_land_area_pyeong} onMinimumChange={(value) => update('min_land_area_pyeong', value)} onMaximumChange={(value) => update('max_land_area_pyeong', value)} />
            </div>

            <div data-testid="advanced-area-filters" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <RangeField label="유찰수" minimum={draft.min_failed_count} maximum={draft.max_failed_count} onMinimumChange={(value) => update('min_failed_count', value)} onMaximumChange={(value) => update('max_failed_count', value)} />
              <RangeField label="감정가" minimum={draft.min_appraisal_amount} maximum={draft.max_appraisal_amount} onMinimumChange={(value) => update('min_appraisal_amount', value)} onMaximumChange={(value) => update('max_appraisal_amount', value)} />
              <RangeField label="최저가" minimum={draft.min_lowest_sale_price} maximum={draft.max_lowest_sale_price} onMinimumChange={(value) => update('min_lowest_sale_price', value)} onMaximumChange={(value) => update('max_lowest_sale_price', value)} />
            </div>

            <FieldGroup label="물건종류 (복수 선택 가능)" testId="advanced-usage-options">
              <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-gray-200 bg-slate-50/60 p-2 sm:grid-cols-3 lg:grid-cols-5">
                {PROPERTY_TYPE_GROUPS.map((group) => (
                  <div key={group.id} className="min-w-0 rounded-md bg-white p-2 shadow-sm ring-1 ring-gray-100">
                    <p className="mb-1 text-xs font-extrabold text-slate-700">{group.title}</p>
                    <div className="flex flex-col">
                      {group.items.map((item) => (
                        <label key={item} className="flex min-h-6 cursor-pointer items-center gap-1.5 py-0.5 text-xs font-medium text-slate-700">
                          <input type="checkbox" checked={draft.goods_usage.includes(item)} onChange={() => toggleGoodsUsage(item)} className="h-4 w-4 shrink-0 rounded border-gray-300 accent-indigo-600" />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FieldGroup>

            {errorMessage && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{errorMessage}</div>}
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700"><Search className="h-4 w-4" /> 종합검색 결과 보기</button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
