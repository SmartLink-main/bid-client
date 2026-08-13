import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Search, CheckSquare, Square, Layers, X } from 'lucide-react';

const propertyTypes = [
  {
    id: 'residential',
    title: '주거용',
    items: [
      '아파트',
      '단독주택',
      '다가구주택',
      '연립주택',
      '다세대/빌라'
    ]
  },
  {
    id: 'commercial-industrial',
    title: '상업용',
    items: [
      '상가',
      '오피스텔',
      '근린시설'
    ]
  },
  {
    id: 'land',
    title: '토지',
    items: [
      '대지',
      '임야',
      '전답'
    ]
  },
  {
    id: 'vehicle-heavy-equipment',
    title: '차량 및 중장비',
    items: ['자동차', '중기']
  },
  {
    id: 'other',
    title: '기타',
    items: ['기타']
  }
];

const allPropertyItems = propertyTypes.flatMap((category) => category.items);

const goodsUsageValues: Record<string, string[]> = {
  '아파트': ['아파트'],
  '단독주택': ['단독주택', '단독주택,다가구주택'],
  '다가구주택': ['다가구주택', '단독주택,다가구주택'],
  '연립주택': ['연립주택', '연립주택,다세대,빌라'],
  '다세대/빌라': ['다세대', '빌라', '연립주택,다세대,빌라'],
  '상가': ['상가', '상가,오피스텔,근린시설'],
  '오피스텔': ['오피스텔', '상가,오피스텔,근린시설'],
  '근린시설': ['근린시설', '상가,오피스텔,근린시설'],
  '대지': ['대지', '대지,임야,전답'],
  '임야': ['임야', '대지,임야,전답'],
  '전답': ['전답', '대지,임야,전답'],
  '자동차': ['자동차', '자동차,중기'],
  '중기': ['중기', '자동차,중기'],
  '기타': ['기타'],
};

export default function PropertyTypeSearchPage() {
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const isAllSelected = selectedTypes.length === allPropertyItems.length;

  const toggleType = (item: string) => {
    setSelectedTypes((prev) =>
      prev.includes(item) ? prev.filter((type) => type !== item) : [...prev, item]
    );
  };

  const toggleAll = () => {
    setSelectedTypes(isAllSelected ? [] : allPropertyItems);
  };

  const toggleCategory = (items: string[]) => {
    const isCategoryAllSelected = items.every((item) => selectedTypes.includes(item));

    if (isCategoryAllSelected) {
      setSelectedTypes((prev) => prev.filter((type) => !items.includes(type)));
      return;
    }

    setSelectedTypes((prev) => [...prev, ...items.filter((item) => !prev.includes(item))]);
  };

  const removeType = (itemToRemove: string) => {
    setSelectedTypes((prev) => prev.filter((item) => item !== itemToRemove));
  };

  const handleSearch = () => {
    if (selectedTypes.length === 0) {
      alert('검색할 물건종류를 최소 1개 이상 선택해주세요.');
      return;
    }

    const searchParams = new URLSearchParams();
    const apiValues = new Set(
      selectedTypes.flatMap((type) => goodsUsageValues[type] || []),
    );
    if (apiValues.size === 0) {
      alert('선택한 물건종류는 현재 검색 API에서 지원하지 않습니다.');
      return;
    }
    apiValues.forEach((value) => searchParams.append('goods_usage', value));
    navigate(`/search?${searchParams}`);
  };

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-5 px-4 flex flex-col min-h-[85vh]">
        <div className="w-full max-w-6xl mx-auto flex-grow flex flex-col">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0.5">물건종류 검색</h2>
              <p className="text-gray-500 text-[13.5px]">대분류별 물건종류를 복수 선택해 검색해보세요.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-grow overflow-hidden mb-3">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-200 bg-white">
              <div className="text-[14px] font-extrabold text-slate-800">물건종류 복수선택</div>
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 rounded-lg px-2 py-1 text-[14px] font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
                전체보기
              </button>
            </div>

            <div className="divide-y divide-gray-100 bg-white">
              {propertyTypes.map((category) => {
                const selectedCount = category.items.filter((item) => selectedTypes.includes(item)).length;
                const isCategoryAllSelected = selectedCount === category.items.length;
                const hasCategorySelection = selectedCount > 0;

                return (
                  <div key={category.id} className="flex flex-col md:flex-row md:items-start">
                    <button
                      onClick={() => toggleCategory(category.items)}
                      className="flex w-full items-center gap-2 bg-slate-50 px-5 py-4 text-left transition-colors hover:bg-indigo-50 md:w-48 md:self-stretch md:border-r md:border-gray-100"
                    >
                      {isCategoryAllSelected ? (
                        <CheckSquare className="w-5 h-5 shrink-0 text-indigo-600" />
                      ) : (
                        <Square
                          className={`w-5 h-5 shrink-0 ${
                            hasCategorySelection ? 'text-indigo-500' : 'text-slate-400'
                          }`}
                        />
                      )}
                      <span className="text-[14.5px] font-extrabold text-slate-800">{category.title}</span>
                      {hasCategorySelection && (
                        <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-extrabold text-indigo-700">
                          {selectedCount}
                        </span>
                      )}
                    </button>

                    <div className="grid flex-grow grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {category.items.map((item) => {
                        const isChecked = selectedTypes.includes(item);

                        return (
                          <button
                            key={item}
                            onClick={() => toggleType(item)}
                            className={`flex min-h-8 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                              isChecked ? 'bg-indigo-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border shadow-sm transition-colors ${
                                isChecked
                                  ? 'border-indigo-600 bg-indigo-600'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isChecked && (
                                <svg
                                  className="h-3.5 w-3.5 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={4}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span
                              className={`break-keep text-[14px] ${
                                isChecked ? 'font-extrabold text-indigo-900' : 'font-medium text-gray-700'
                              }`}
                            >
                              {item}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedTypes.length > 0 && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 mb-3 flex flex-wrap gap-2 items-center">
              <span className="text-[13px] font-bold text-indigo-600 mr-2 shrink-0">선택목록 :</span>
              {selectedTypes.map((item) => (
                <span
                  key={item}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[13.5px] font-bold rounded-lg border border-indigo-100"
                >
                  {item}
                  <button
                    onClick={() => removeType(item)}
                    className="hover:bg-indigo-200 p-0.5 rounded-full transition-colors ml-1"
                    aria-label={`${item} 선택 해제`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto">
            <button
              onClick={handleSearch}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all text-[15.5px]"
            >
              <Search className="w-5 h-5" />
              {selectedTypes.length > 0 ? `선택한 ${selectedTypes.length}개 물건 검색하기` : '물건종류를 선택해주세요'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
