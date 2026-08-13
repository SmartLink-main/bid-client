import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, Gem, Loader2, Search, Square } from 'lucide-react'
import Layout from '../components/Layout'
import { getSpecialGoodsTypes } from '../lib/auction'
import { getKoreanErrorMessage } from '../lib/api'

export default function SpecialSearchPage() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any')
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isActive = true

    getSpecialGoodsTypes()
      .then((response) => {
        if (isActive) {
          setTypes(response.items)
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setMessage(getKoreanErrorMessage(error, '특수물건 유형을 불러오지 못했습니다.'))
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const toggleType = (type: string) => {
    setSelectedTypes((current) => (
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    ))
  }

  const handleSearch = () => {
    if (selectedTypes.length === 0) {
      setMessage('특수물건 유형을 하나 이상 선택해 주세요.')
      return
    }

    const params = new URLSearchParams({
      search_type: 'special',
      match_mode: matchMode,
    })
    selectedTypes.forEach((type) => params.append('special_type', type))
    navigate(`/search?${params}`)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
              <Gem className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">특수물건 검색</h1>
              <p className="mt-1 text-sm text-gray-500">권리와 임차인 정보에서 찾을 특수 유형을 선택해 주세요.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-extrabold text-slate-800">유형 복수 선택</span>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-600">
                일치 방식
                <select
                  value={matchMode}
                  onChange={(event) => setMatchMode(event.target.value as 'any' | 'all')}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="any">하나라도 일치</option>
                  <option value="all">모두 일치</option>
                </select>
              </label>
            </div>

            {isLoading && (
              <div className="flex min-h-48 items-center justify-center" role="status">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              </div>
            )}

            {!isLoading && types.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {types.map((type) => {
                  const isSelected = selectedTypes.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-bold transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50'
                      }`}
                    >
                      {isSelected
                        ? <CheckSquare className="h-5 w-5 shrink-0 text-indigo-600" />
                        : <Square className="h-5 w-5 shrink-0 text-gray-400" />}
                      {type}
                    </button>
                  )
                })}
              </div>
            )}

            {message && (
              <p className="mt-5 text-center text-sm font-bold text-red-600" role="status">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={handleSearch}
              disabled={isLoading || selectedTypes.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-base font-extrabold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Search className="h-5 w-5" /> 선택한 특수물건 검색하기
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
