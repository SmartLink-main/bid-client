import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gem, Loader2 } from 'lucide-react'
import Layout from '../components/Layout'
import { getSpecialGoodsTypes } from '../lib/auction'
import { getKoreanErrorMessage } from '../lib/api'

export default function SpecialSearchPage() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<string[]>([])
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

  const handleSearch = (type: string) => {
    const params = new URLSearchParams({
      search_type: 'special',
      match_mode: 'any',
      special_type: type,
    })
    navigate(`/search?${params}`)
  }

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 px-4 py-5">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm">
              <Gem className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">특수물건 검색</h1>
              <p className="mt-1 text-sm text-gray-500">특수 유형을 누르면 해당 조건의 물건을 바로 검색합니다.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {isLoading && (
              <div className="flex min-h-48 items-center justify-center" role="status">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              </div>
            )}

            {!isLoading && types.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {types.map((type) => (
                  <button key={type} type="button" onClick={() => handleSearch(type)} className="rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-bold text-gray-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800">
                    {type}
                  </button>
                ))}
              </div>
            )}

            {message && (
              <p className="mt-5 text-center text-sm font-bold text-red-600" role="status">
                {message}
              </p>
            )}

            {!isLoading && !message && types.length === 0 && (
              <p className="py-10 text-center text-sm text-gray-500" role="status">검색 가능한 특수물건 유형이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
