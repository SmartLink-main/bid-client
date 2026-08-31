import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Search, Map, MapPin } from 'lucide-react';
import {
  PROVINCE_SEARCH_TERMS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from '../lib/search-filter-options';

export default function RegionSearchPage() {
  const navigate = useNavigate();
  const [selectedProvince, setSelectedProvince] = useState<string>('경북');
  const [selectedGuList, setSelectedGuList] = useState<string[]>([]);

  const currentGuList = SIGUNGU_BY_PROVINCE[selectedProvince] || [];

  const selectProvince = (province: string) => {
    setSelectedProvince(province);
    setSelectedGuList([]);
  };

  const toggleGu = (guName: string) => {
    setSelectedGuList(prev => prev[0] === guName ? [] : [guName]);
  };

  const handleSearch = () => {
    if (selectedGuList.length === 0) {
      alert('검색할 시/군/구를 선택해 주세요.');
      return;
    }

    const searchParams = new URLSearchParams({
      sido: PROVINCE_SEARCH_TERMS[selectedProvince],
      sigungu: selectedGuList[0],
    });

    navigate(`/search?${searchParams}`);
  };

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-5 px-4 flex flex-col min-h-[85vh]">
        <div className="w-full max-w-5xl mx-auto flex-grow flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <Map className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0.5">지역별 검색</h2>
              <p className="text-gray-500 text-[13.5px]">원하시는 지역을 시/군/구 단위로 선택하여 빠르고 정확하게 매물을 찾아보세요.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-grow overflow-hidden">
            <div data-testid="region-province-options" className="grid grid-cols-4 gap-2 border-b border-gray-200 bg-slate-50/80 p-3.5 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-[repeat(13,minmax(0,1fr))]">
              {REGION_PROVINCES.map((province) => (
                <button
                  key={province}
                  onClick={() => selectProvince(province)}
                  className={`w-full px-3 py-2.5 rounded-xl text-[14.5px] font-bold transition-all ${
                    selectedProvince === province
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600 ring-offset-1'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
                  }`}
                >
                  {province}
                </button>
              ))}
            </div>

            <div className="flex flex-col flex-grow bg-white">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/30">
                <span className="text-indigo-700 font-bold text-[14.5px]">
                  시/군/구 한 곳을 선택해 주세요
                </span>
                <div className="text-[14.5px] text-gray-600 font-medium bg-white px-4 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-indigo-700 font-bold mr-1">{selectedProvince}</span>
                  관할 시/군/구 (총 <span className="font-bold text-gray-900">{currentGuList.length}</span>개)
                </div>
              </div>

              <div
                data-testid="region-district-options"
                className="grid grid-cols-2 content-start gap-x-6 gap-y-5 p-6 sm:grid-cols-3 md:grid-cols-4 md:p-8 lg:grid-cols-5"
              >
                {currentGuList.map((gu) => {
                  const isChecked = selectedGuList.includes(gu);
                  return (
                    <button
                      key={gu}
                      onClick={() => toggleGu(gu)}
                      className="flex items-center gap-3 pl-2 text-left group transition-all"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors shadow-sm ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border border-gray-300 group-hover:border-indigo-400'}`}>
                        {isChecked && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[15px] ${isChecked ? 'font-extrabold text-indigo-900' : 'font-medium text-gray-700 group-hover:text-indigo-600'}`}>
                        {gu}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-indigo-50 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-indigo-100 mt-auto">
              <div className="flex items-center gap-3 text-indigo-900 w-full sm:w-auto overflow-hidden">
                <span className="font-bold text-indigo-600 text-[14.5px] shrink-0">선택된 지역:</span>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 px-4 py-2.5 rounded-xl shadow-sm w-full truncate">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-extrabold text-[15px] text-slate-800 shrink-0">
                    {selectedProvince}
                  </span>
                  {selectedGuList.length === 1 && (
                    <>
                      <span className="text-indigo-300 mx-1">|</span>
                      <span className="font-bold text-[14.5px] text-indigo-900 truncate">
                        {selectedGuList[0]}
                      </span>
                    </>
                  )}
                  {selectedGuList.length === 0 && (
                    <>
                      <span className="text-indigo-300 mx-1">|</span>
                      <span className="font-medium text-[14px] text-gray-400 truncate">
                        시/군/구를 선택해 주세요
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handleSearch}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-10 rounded-xl shadow-md transition-all text-[15.5px] shrink-0"
              >
                <Search className="w-5 h-5" /> 물건 검색하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
