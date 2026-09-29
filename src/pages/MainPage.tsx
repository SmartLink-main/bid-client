
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { BadgePercent, CalendarRange, Landmark, Search, SlidersHorizontal } from 'lucide-react';

const shortcuts = [
  { label: '법원 검색', to: '/court-search', icon: Landmark },
  { label: '경매 일정', to: '/schedules', icon: CalendarRange },
  { label: '반값 검색', to: '/search?half_price=true', icon: BadgePercent },
  { label: '상세 검색', to: '/advanced-search', icon: SlidersHorizontal },
];

export default function MainPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const searchParams = new URLSearchParams();

    if (query.trim()) {
      searchParams.set('q', query.trim());
    }

    navigate(`/search${searchParams.toString() ? `?${searchParams}` : ''}`);
  };

  const goToRecommendedSearch = (params: Record<string, string>) => {
    navigate(`/search?${new URLSearchParams(params)}`);
  };

  return (
    <Layout>
      <div className="flex-grow flex flex-col items-center justify-center w-full pt-10 pb-16 md:pt-12 md:pb-20">
        <h1 className="px-4 text-3xl md:text-5xl font-bold text-center text-balance break-keep leading-tight mb-4 tracking-tight">
          어떤 경매 물건을 찾으시나요?
        </h1>
        <p className="px-6 text-gray-500 text-center break-keep leading-relaxed mb-10 text-sm md:text-base">
          사건번호, 법원, 소재지 등 원하는 조건으로 쉽고 빠르게 검색해 보세요.
        </p>

        <form className="w-full max-w-3xl relative group px-4" onSubmit={handleSubmit}>
          <div className="absolute inset-y-0 left-4 pl-5 flex items-center pointer-events-none">
            <Search className="w-6 h-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input 
            type="search"
            aria-label="경매 물건 검색어"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full py-4 pl-14 pr-6 text-lg border border-gray-200 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-300"
            placeholder="예: 2023타경1234, 서울중앙지방법원, 강남구 아파트"
          />

        </form>

        {/* 추천 검색어 태그들 */}
        <div className="flex flex-wrap justify-center gap-2 mt-8 px-4">
          <button onClick={() => goToRecommendedSearch({ q: '서울 아파트' })} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 서울 아파트</button>
          <button onClick={() => goToRecommendedSearch({ min_failed_count: '2', sort_by: 'failed_count_desc' })} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 유찰 2회 이상</button>
          <button onClick={() => goToRecommendedSearch({ q: '서울 다세대' })} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 서울 다세대/빌라</button>
          <button onClick={() => goToRecommendedSearch({ status: '신건' })} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 신건</button>
        </div>

        <div className="mt-10 w-full max-w-[42rem] px-4">
          <nav aria-label="주요 서비스 바로가기" className="relative grid grid-cols-2 gap-1 rounded-[28px] border border-gray-200 bg-slate-50 p-2 shadow-[0_2px_6px_rgba(15,23,42,0.08)] sm:grid-cols-4 sm:rounded-full">
            {/* SVG preserves fractional stroke widths that CSS borders round to whole pixels. */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-2 stroke-slate-300/60 [stroke-width:1.5px]">
              <svg data-divider-axis="vertical" className="absolute inset-x-0 top-4 h-[calc(100%-2rem)] w-full overflow-visible">
                {[25, 50, 75].map((position) => (
                  <line
                    key={position}
                    x1={`${position}%`}
                    x2={`${position}%`}
                    y1="0"
                    y2="100%"
                    className={position === 50 ? undefined : 'hidden sm:block'}
                  />
                ))}
              </svg>
              <svg className="absolute inset-x-4 top-1/2 h-px w-[calc(100%-2rem)] overflow-visible sm:hidden">
                <line x1="0" x2="100%" y1="0" y2="0" />
              </svg>
            </span>
            {shortcuts.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex min-h-[64px] items-center justify-center gap-2.5 rounded-full px-2 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </Layout>
  );
}
