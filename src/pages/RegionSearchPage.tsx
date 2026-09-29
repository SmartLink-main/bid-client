import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Map, MapPin } from 'lucide-react';
import {
  PROVINCE_SEARCH_TERMS,
  REGION_PROVINCES,
  SIGUNGU_BY_PROVINCE,
} from '../lib/search-filter-options';

export default function RegionSearchPage() {
  const navigate = useNavigate();
  const [selectedProvince, setSelectedProvince] = useState<string>('경북');

  const currentGuList = SIGUNGU_BY_PROVINCE[selectedProvince] || [];

  const selectProvince = (province: string) => {
    setSelectedProvince(province);
  };

  const handleSearch = (gu: string) => {
    const searchParams = new URLSearchParams({
      sido: PROVINCE_SEARCH_TERMS[selectedProvince],
      sigungu: gu,
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
              <p className="text-gray-500 text-[13.5px]">시/도를 고른 뒤 시/군/구를 누르면 바로 검색합니다.</p>
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
              <div className="flex items-center px-6 py-4 border-b border-gray-100 bg-slate-50/30">
                <span className="text-indigo-700 font-bold text-[14.5px]">
                  시/군/구 한 곳을 선택해 주세요
                </span>
              </div>

              <div
                data-testid="region-district-options"
                className="grid grid-cols-2 content-start gap-x-6 gap-y-5 p-6 sm:grid-cols-3 md:grid-cols-4 md:p-8 lg:grid-cols-5"
              >
                {currentGuList.map((gu) => (
                  <button
                    key={gu}
                    type="button"
                    onClick={() => handleSearch(gu)}
                    className="flex items-center gap-3 rounded-lg p-2 text-left text-[15px] font-medium text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-indigo-400" />
                    {gu}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
