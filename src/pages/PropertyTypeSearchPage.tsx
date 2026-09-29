import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Layers } from 'lucide-react';
import {
  ALL_PROPERTY_TYPE_ITEMS,
  GOODS_USAGE_VALUES_BY_PROPERTY_TYPE,
  PROPERTY_TYPE_GROUPS,
} from '../lib/search-filter-options';

export default function PropertyTypeSearchPage() {
  const navigate = useNavigate();

  const handleSearch = (types: string[]) => {
    const searchParams = new URLSearchParams();
    const apiValues = new Set(types.flatMap((type) => GOODS_USAGE_VALUES_BY_PROPERTY_TYPE[type] || []));
    if (apiValues.size === 0) return;
    apiValues.forEach((value) => searchParams.append('goods_usage', value));
    navigate(`/search?${searchParams}`);
  };

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-5 px-4 flex flex-col min-h-[85vh]">
        <div className="w-full max-w-5xl mx-auto flex-grow flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0.5">물건종류 검색</h2>
              <p className="text-gray-500 text-[13.5px]">물건종류나 대분류를 누르면 해당 물건을 바로 검색합니다.</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-3">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-200">
              <div className="text-[14px] font-extrabold text-slate-800">물건종류 선택</div>
              <button type="button" onClick={() => handleSearch(ALL_PROPERTY_TYPE_ITEMS)} className="rounded-lg px-3 py-2 text-[14px] font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700">전체보기</button>
            </div>
            <div className="divide-y divide-gray-100">
              {PROPERTY_TYPE_GROUPS.map((category) => (
                <div key={category.id} className="flex flex-col md:flex-row md:items-start">
                  <button type="button" onClick={() => handleSearch(category.items)} className="w-full bg-slate-50 py-4 pl-7 pr-3 text-left text-[14.5px] font-extrabold text-slate-800 transition-colors hover:bg-indigo-50 hover:text-indigo-700 md:w-48 md:shrink-0 md:self-stretch md:border-r md:border-gray-100">
                    {category.title}
                  </button>
                  <div className="grid flex-grow grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {category.items.map((item) => (
                      <button key={item} type="button" onClick={() => handleSearch([item])} className="min-h-8 rounded-lg px-3 py-2 text-left text-[14px] font-medium text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
