import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Landmark,
  Loader2,
  Search,
} from 'lucide-react'
import Layout from '../components/Layout'
import {
  getAuctionDetailPageUrl,
  getAuctionSchedules,
  type AuctionScheduleListItem,
  type AuctionScheduleQuery,
} from '../lib/auction-extra'
import { getKoreanErrorMessage } from '../lib/api'
import {
  buildMonthCalendar,
  formatKoreanDate,
  formatKoreanMonth,
  getLocalDateKey,
  getLocalMonthKey,
  getMonthBounds,
  normalizeMonthKey,
  shiftMonth,
  type CalendarDay,
} from '../lib/schedule-calendar'
import { COURT_OPTIONS } from '../lib/search-filter-options'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
const VISIBLE_EVENTS_PER_DAY = 2
const COURT_NAMES = [...new Set(COURT_OPTIONS.map((court) => court.courtName))]

function compactBranchName(branchName: string) {
  return branchName.replace(/지방법원$/, '').replace(/지원$/, '')
}

function scheduleTime(schedule: AuctionScheduleListItem) {
  return schedule.auction_time || '시간 미정'
}

function compareSchedules(left: AuctionScheduleListItem, right: AuctionScheduleListItem) {
  return (
    left.auction_date.localeCompare(right.auction_date) ||
    (left.auction_time || '99:99').localeCompare(right.auction_time || '99:99') ||
    left.branch_name.localeCompare(right.branch_name, 'ko') ||
    left.division_number - right.division_number
  )
}

function uniqueSortedSchedules(items: AuctionScheduleListItem[]) {
  return [...new Map(items.map((item) => [item.schedule_id, item])).values()].sort(compareSchedules)
}

function ScheduleAgendaCard({ schedule }: { schedule: AuctionScheduleListItem }) {
  const linkLabel = `${schedule.branch_name} 경매 ${schedule.division_number}계`

  return (
    <article className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />
            <span>{scheduleTime(schedule)}</span>
            <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
              경매 {schedule.division_number}계
            </span>
          </div>
          <p className="mt-2 flex min-w-0 items-center gap-2 text-sm font-bold text-slate-600">
            <Landmark className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{schedule.court_name} / {schedule.branch_name}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={getAuctionDetailPageUrl(schedule.schedule_id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`${linkLabel} 원문형 공고`}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            원문 <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Link
            to={`/schedules/${schedule.schedule_id}`}
            aria-label={`${linkLabel} 공고 상세`}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            상세 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  )
}

type ScheduleCalendarProps = {
  monthKey: string
  days: CalendarDay[]
  schedulesByDate: Map<string, AuctionScheduleListItem[]>
  selectedDate: string
  today: string
  onSelectDate: (date: string) => void
  onOpenAdjacentMonth: (month: string, date: string) => void
}

function ScheduleCalendar({
  monthKey,
  days,
  schedulesByDate,
  selectedDate,
  today,
  onSelectDate,
  onOpenAdjacentMonth,
}: ScheduleCalendarProps) {
  const monthLabel = formatKoreanMonth(monthKey)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table aria-label={`${monthLabel} 경매 공고 달력`} className="w-full table-fixed border-collapse">
        <caption className="sr-only">{monthLabel} 날짜별 경매 공고</caption>
        <thead>
          <tr className="border-b border-gray-200 bg-slate-50">
            {WEEKDAY_LABELS.map((weekday, index) => (
              <th
                key={weekday}
                scope="col"
                className={`py-2.5 text-center text-xs font-extrabold sm:text-sm ${
                  index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-600' : 'text-slate-600'
                }`}
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, weekIndex) => (
            <tr key={days[weekIndex * 7].date}>
              {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
                const schedules = schedulesByDate.get(day.date) || []
                const isToday = day.date === today
                const isSelected = day.date === selectedDate
                const hiddenCount = Math.max(0, schedules.length - VISIBLE_EVENTS_PER_DAY)

                return (
                  <td
                    key={day.date}
                    data-testid="schedule-calendar-day"
                    data-date={day.date}
                    className={`border-b border-r border-gray-100 align-top last:border-r-0 ${
                      isSelected ? 'bg-indigo-50/70' : day.isCurrentMonth ? 'bg-white' : 'bg-slate-50/70'
                    }`}
                  >
                    <div className="min-h-14 min-w-0 p-1 sm:min-h-20 sm:p-1.5 md:min-h-28 md:p-2">
                      <button
                        type="button"
                        aria-label={`${formatKoreanDate(day.date)}, 공고 ${schedules.length}개`}
                        aria-current={isToday ? 'date' : undefined}
                        aria-pressed={isSelected}
                        onClick={() => (
                          day.isCurrentMonth
                            ? onSelectDate(day.date)
                            : onOpenAdjacentMonth(day.date.slice(0, 7), day.date)
                        )}
                        className={`flex min-h-10 w-full items-start justify-between rounded-lg px-1.5 py-1 text-left text-xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:min-h-0 sm:text-sm ${
                          isToday
                            ? 'bg-indigo-600 text-white'
                            : day.isCurrentMonth
                              ? day.weekday === 0
                                ? 'text-rose-500 hover:bg-rose-50'
                                : day.weekday === 6
                                  ? 'text-blue-600 hover:bg-blue-50'
                                  : 'text-slate-700 hover:bg-slate-50'
                              : 'text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span>{day.dayNumber}</span>
                        {schedules.length > 0 && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] md:text-[11px] ${
                            isToday ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {schedules.length}
                          </span>
                        )}
                      </button>

                      <div className="mt-1 hidden min-w-0 flex-col gap-1 md:flex">
                        {schedules.slice(0, VISIBLE_EVENTS_PER_DAY).map((schedule) => (
                          <Link
                            key={schedule.schedule_id}
                            to={`/schedules/${schedule.schedule_id}`}
                            title={`${schedule.branch_name} 경매 ${schedule.division_number}계 · ${scheduleTime(schedule)}`}
                            aria-label={`${schedule.branch_name} 경매 ${schedule.division_number}계 ${scheduleTime(schedule)} 공고 상세`}
                            className="min-w-0 rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-1 text-[11px] font-bold text-indigo-800 hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            <span className="block truncate">{compactBranchName(schedule.branch_name)} · {schedule.division_number}계</span>
                            <span className="block truncate text-[10px] font-medium text-indigo-500">{scheduleTime(schedule)}</span>
                          </Link>
                        ))}
                        {hiddenCount > 0 && (
                          <button
                            type="button"
                            onClick={() => onSelectDate(day.date)}
                            className="rounded px-1 py-0.5 text-left text-[11px] font-extrabold text-indigo-600 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            +{hiddenCount}개 더보기
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchKey = searchParams.toString()
  const currentParams = useMemo(() => new URLSearchParams(searchKey), [searchKey])
  const legacyMonth = currentParams.get('start_date')?.slice(0, 7)
  const monthKey = normalizeMonthKey(currentParams.get('month') || legacyMonth)
  const requestedCourtFilter = currentParams.get('court_name') || ''
  const requestedBranchFilter = currentParams.get('branch_name') || ''
  const courtFilter = COURT_NAMES.includes(requestedCourtFilter) ? requestedCourtFilter : ''
  const branchFilter = COURT_OPTIONS.some((court) => (
    court.courtName === courtFilter && court.branchName === requestedBranchFilter
  )) ? requestedBranchFilter : ''
  const scheduleQuery = useMemo<AuctionScheduleQuery>(() => {
    const bounds = getMonthBounds(monthKey)
    return {
      start_date: bounds.startDate,
      end_date: bounds.endDate,
      court_name: courtFilter || undefined,
      branch_name: branchFilter || undefined,
    }
  }, [branchFilter, courtFilter, monthKey])
  const [courtName, setCourtName] = useState(courtFilter)
  const [branchName, setBranchName] = useState(branchFilter)
  const [items, setItems] = useState<AuctionScheduleListItem[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const calendarDays = useMemo(() => buildMonthCalendar(monthKey), [monthKey])
  const branchOptions = useMemo(
    () => COURT_OPTIONS.filter((court) => court.courtName === courtName),
    [courtName],
  )
  const today = getLocalDateKey()
  const schedulesByDate = useMemo(() => {
    const grouped = new Map<string, AuctionScheduleListItem[]>()
    items.forEach((item) => {
      grouped.set(item.auction_date, [...(grouped.get(item.auction_date) || []), item])
    })
    return grouped
  }, [items])
  const selectedItems = selectedDate ? schedulesByDate.get(selectedDate) || [] : []

  useEffect(() => {
    queueMicrotask(() => {
      setCourtName(courtFilter)
      setBranchName(branchFilter)
    })
  }, [branchFilter, courtFilter])

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    queueMicrotask(() => {
      if (isActive) {
        setIsLoading(true)
        setErrorMessage('')
      }
    })

    getAuctionSchedules(scheduleQuery, controller.signal)
      .then((response) => {
        if (!isActive) return

        const nextItems = uniqueSortedSchedules(response.items)
        setItems(nextItems)
        setSelectedDate((current) => {
          const hasCurrentSelection = current.startsWith(`${monthKey}-`) &&
            nextItems.some((item) => item.auction_date === current)
          if (hasCurrentSelection) return current

          const shouldSelectToday = today.startsWith(`${monthKey}-`) &&
            nextItems.some((item) => item.auction_date === today)
          if (shouldSelectToday) return today
          return nextItems[0]?.auction_date || `${monthKey}-01`
        })
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setItems([])
          setSelectedDate(`${monthKey}-01`)
          setErrorMessage(getKoreanErrorMessage(error, '경매 일정 조회에 실패했습니다.'))
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [monthKey, scheduleQuery, today])

  const updateMonth = (nextMonth: string, nextSelectedDate = '') => {
    const next = new URLSearchParams(currentParams)
    next.set('month', nextMonth)
    next.delete('start_date')
    next.delete('end_date')
    next.delete('page')
    setSelectedDate(nextSelectedDate)
    setSearchParams(next)
  }

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = new URLSearchParams({ month: monthKey })
    if (courtName.trim()) next.set('court_name', courtName.trim())
    if (branchName.trim()) next.set('branch_name', branchName.trim())
    setSearchParams(next)
  }

  const handleCourtChange = (nextCourtName: string) => {
    setCourtName(nextCourtName)
    setBranchName('')
  }

  const goToToday = () => {
    const currentDate = getLocalDateKey()
    updateMonth(getLocalMonthKey(), currentDate)
  }

  const monthLabel = formatKoreanMonth(monthKey)

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
              <CalendarDays className="h-6 w-6 text-indigo-600" /> 경매 공고 일정
            </h1>
            <p className="mt-1 text-sm text-gray-500">월별 매각기일을 달력에서 확인하고 날짜별 공고로 바로 이동합니다.</p>
          </div>

          <form onSubmit={handleFilterSubmit} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label htmlFor="schedule-court" className="text-xs font-bold text-gray-500">관할법원</label>
              <select
                id="schedule-court"
                value={courtName}
                onChange={(event) => handleCourtChange(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">전체 관할법원</option>
                {COURT_NAMES.map((court) => <option key={court} value={court}>{court}지방법원</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="schedule-branch" className="text-xs font-bold text-gray-500">법원·지원</label>
              <select
                id="schedule-branch"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                disabled={!courtName}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-gray-400"
              >
                <option value="">{courtName ? '전체 법원·지원' : '관할법원을 먼저 선택해 주세요'}</option>
                {branchOptions.map((court) => (
                  <option key={court.courtCode} value={court.branchName}>{court.branchName}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <Search className="h-4 w-4" /> 필터 적용
            </button>
          </form>

          <section aria-labelledby="schedule-month-heading" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="이전 달"
                  title={`${formatKoreanMonth(shiftMonth(monthKey, -1))} 보기`}
                  onClick={() => updateMonth(shiftMonth(monthKey, -1))}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 id="schedule-month-heading" aria-live="polite" className="min-w-28 text-center text-lg font-extrabold text-slate-900 sm:min-w-36 sm:text-xl">
                  {monthLabel}
                </h2>
                <button
                  type="button"
                  aria-label="다음 달"
                  title={`${formatKoreanMonth(shiftMonth(monthKey, 1))} 보기`}
                  onClick={() => updateMonth(shiftMonth(monthKey, 1))}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {!isLoading && !errorMessage && (
                  <span className="text-xs font-bold text-slate-500 sm:text-sm">이번 달 공고 {items.length.toLocaleString('ko-KR')}개</span>
                )}
                <button
                  type="button"
                  aria-label="오늘"
                  onClick={goToToday}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-extrabold text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:text-sm"
                >
                  오늘
                </button>
              </div>
            </div>

            {isLoading && (
              <div role="status" className="flex min-h-80 items-center justify-center rounded-xl border border-gray-200 bg-white">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                <span className="sr-only">경매 공고 달력을 불러오는 중입니다.</span>
              </div>
            )}

            {!isLoading && errorMessage && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">{errorMessage}</div>
            )}

            {!isLoading && !errorMessage && (
              <>
                <ScheduleCalendar
                  monthKey={monthKey}
                  days={calendarDays}
                  schedulesByDate={schedulesByDate}
                  selectedDate={selectedDate}
                  today={today}
                  onSelectDate={setSelectedDate}
                  onOpenAdjacentMonth={updateMonth}
                />

                {items.length === 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                    <p className="font-extrabold text-slate-900">이 달의 경매 공고가 없습니다.</p>
                    <p className="mt-1 text-sm text-gray-500">다른 달로 이동하거나 법원 필터를 조정해 보세요.</p>
                  </div>
                )}

                <section aria-labelledby="selected-date-heading" className="rounded-xl border border-gray-200 bg-slate-100/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 id="selected-date-heading" className="text-base font-extrabold text-slate-900 sm:text-lg">
                      {formatKoreanDate(selectedDate)} 공고
                    </h2>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-indigo-700 shadow-sm">
                      {selectedItems.length}개
                    </span>
                  </div>
                  {selectedItems.length > 0 ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {selectedItems.map((schedule) => <ScheduleAgendaCard key={schedule.schedule_id} schedule={schedule} />)}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-white p-4 text-center text-sm font-medium text-gray-500">선택한 날짜에 등록된 공고가 없습니다.</p>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </Layout>
  )
}
