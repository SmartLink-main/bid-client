import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, MapPin, Search } from 'lucide-react'
import Layout from '../components/Layout'
import { getApiUrl, getKoreanErrorMessage } from '../lib/api'
import { formatMoney } from '../lib/format'
import {
  askGoodsQuestion,
  type QuestionGoodsResponse,
} from '../lib/goods'

function displayText(value: string | number | null | undefined, fallback = '-') {
  if (typeof value === 'number') {
    return value.toLocaleString('ko-KR')
  }
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  return fallback
}

function interpretationBadge(result: QuestionGoodsResponse) {
  if (result.interpretation.method === 'ai') {
    return {
      label: 'AI 분석',
      className: 'bg-violet-100 text-violet-700',
    }
  }
  if (result.interpretation.fallback_used) {
    return {
      label: '기본 분석으로 검색',
      className: 'bg-amber-100 text-amber-800',
    }
  }
  return {
    label: '기본 분석',
    className: 'bg-slate-100 text-slate-700',
  }
}

export default function QuestionGoodsPage() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<QuestionGoodsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const requestVersion = useRef(0)

  useEffect(() => () => { requestVersion.current += 1 }, [])

  const searchQuestion = (value: string) => {
    const normalizedQuestion = value.trim()
    const version = ++requestVersion.current
    setQuestion(value)

    if (normalizedQuestion.length < 2) {
      setIsLoading(false)
      setErrorMessage('질문을 두 글자 이상 입력해 주세요.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setResult(null)

    void askGoodsQuestion({ question: normalizedQuestion })
      .then((response) => {
        if (version === requestVersion.current) setResult(response)
      })
      .catch((error: unknown) => {
        if (version !== requestVersion.current) return
        setErrorMessage(
          getKoreanErrorMessage(error, '질문에 맞는 경매 물건을 찾지 못했습니다.'),
        )
      })
      .finally(() => {
        if (version === requestVersion.current) setIsLoading(false)
      })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    searchQuestion(question)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-5">
        <div className="mx-auto w-full max-w-5xl">
          <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-blue-800 px-6 py-10 text-white shadow-lg md:px-10">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-indigo-100">
                질문 기반 물건 추천
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
                원하는 경매 물건을 문장으로 찾아보세요
              </h1>
              <p className="mt-3 text-sm leading-7 text-indigo-100 md:text-base">
                AI가 지역, 용도, 건물명, 권리관계와 예산을 해석하고 서버가 검증한 조건으로 저장된 물건을 검색합니다. AI를 사용할 수 없을 때는 기본 분석으로 이어집니다.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 rounded-xl bg-white p-3 text-slate-900 shadow-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="sr-only" htmlFor="goods-question">찾고 싶은 경매 물건</label>
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-slate-50 px-4">
                  <Search className="h-5 w-5 shrink-0 text-indigo-600" />
                  <input
                    id="goods-question"
                    enterKeyHint="search"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="예: 서울 강남 7억 이하 아파트 찾아줘"
                    className="h-14 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-gray-400"
                    minLength={2}
                    required
                  />
                </div>

              </div>
            </form>
            <p className="mt-3 text-xs text-indigo-100">문장 입력 후 Enter를 누르거나 아래 추천 항목을 선택하세요.</p>
          </section>

          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-gray-500">
            <button type="button" onClick={() => searchQuestion('서울 5억 이하 아파트 찾아줘')} className="rounded-full border border-gray-200 bg-white px-3 py-2 hover:border-indigo-300 hover:text-indigo-700">
              서울 5억 이하 아파트
            </button>
            <button type="button" onClick={() => searchQuestion('유치권 있는 주거용 물건 찾아줘')} className="rounded-full border border-gray-200 bg-white px-3 py-2 hover:border-indigo-300 hover:text-indigo-700">
              유치권 있는 주거용
            </button>
            <button type="button" onClick={() => searchQuestion('부산 상가 경매 물건 추천')} className="rounded-full border border-gray-200 bg-white px-3 py-2 hover:border-indigo-300 hover:text-indigo-700">
              부산 상가
            </button>
          </div>

          {errorMessage && (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          {isLoading && (
            <div className="mt-6 flex min-h-64 items-center justify-center rounded-xl border border-gray-200 bg-white" role="status">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <span className="sr-only">질문에 맞는 물건을 찾는 중</span>
            </div>
          )}

          {!isLoading && result && (
            <section className="mt-8">
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-extrabold text-indigo-600">분석한 질문</p>
                    <span
                      aria-label={interpretationBadge(result).label}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${interpretationBadge(result).className}`}
                      role="status"
                    >
                      {interpretationBadge(result).label}
                    </span>
                  </div>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">“{result.question}”</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.parsed.terms.map((term) => (
                      <span key={term} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">#{term}</span>
                    ))}
                    {result.parsed.max_price !== null && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        예산 상한 {formatMoney(result.parsed.max_price)}
                      </span>
                    )}
                    {result.parsed.terms.length === 0 && result.parsed.max_price === null && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-gray-600">일반 추천</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-5 py-3 text-center">
                  <div className="text-2xl font-extrabold text-slate-900">{result.total.toLocaleString('ko-KR')}</div>
                  <div className="text-xs font-bold text-gray-400">매칭 후보</div>
                </div>
              </div>

              {result.items.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
                  <p className="font-extrabold text-slate-800">질문과 일치하는 물건이 없습니다.</p>
                  <p className="mt-2 text-sm text-gray-500">지역이나 용도 조건을 줄여 다시 검색해 보세요.</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {result.items.map((item) => (
                    <article key={item.auction_goods_id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2 text-xs font-bold text-indigo-700">
                            <span>{displayText(item.court_name)}</span>
                            {item.branch_name && <span className="text-gray-400">{item.branch_name}</span>}
                          </div>
                          <h3 className="mt-2 text-lg font-extrabold text-slate-900">
                            {displayText(item.case_name, `경매 물건 ${item.auction_goods_id}`)}
                          </h3>
                        </div>
                        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-center">
                          <div className="text-lg font-extrabold text-indigo-700">{item.score}</div>
                          <div className="text-[10px] font-bold text-indigo-500">매칭 점수</div>
                        </div>
                      </div>

                      <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-gray-600">
                        <MapPin className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                        {displayText(item.address, '주소 정보 없음')}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <div className="text-xs font-bold text-gray-400">감정가</div>
                          <div className="mt-1 font-extrabold text-slate-800">{formatMoney(item.appraisal_amount)}</div>
                        </div>
                        <div className="rounded-lg bg-blue-50 p-3">
                          <div className="text-xs font-bold text-blue-500">최저가</div>
                          <div className="mt-1 font-extrabold text-blue-900">{formatMoney(item.lowest_sale_price)}</div>
                        </div>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div><dt className="font-bold text-gray-400">용도</dt><dd className="mt-1 font-bold text-slate-700">{displayText(item.goods_usage_name || item.main_building_usage)}</dd></div>
                        <div><dt className="font-bold text-gray-400">상태</dt><dd className="mt-1 font-bold text-slate-700">{displayText(item.goods_status_name || item.progress_status_name)}</dd></div>
                        <div><dt className="font-bold text-gray-400">매각기일</dt><dd className="mt-1 font-bold text-slate-700">{[item.auction_date, item.auction_time].filter(Boolean).join(' ') || '-'}</dd></div>
                        <div><dt className="font-bold text-gray-400">물건번호</dt><dd className="mt-1 font-bold text-slate-700">{displayText(item.disposal_goods_sequence)}</dd></div>
                      </dl>

                      <div className="mt-5">
                        <p className="text-xs font-extrabold text-gray-400">선정 이유</p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {item.match_reasons.map((reason) => (
                            <li key={reason} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{reason}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-auto flex flex-wrap gap-2 pt-6">
                        <Link
                          to={`/goods/${item.auction_goods_id}`}
                          className="inline-flex flex-1 items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-indigo-700"
                        >
                          물건 상세 보기
                        </Link>
                        {item.page_url && (
                          <a
                            href={getApiUrl(item.page_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-3 text-sm font-extrabold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                          >
                            공고 화면
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </Layout>
  )
}
