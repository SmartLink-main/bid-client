import { useState } from 'react';
import Layout from '../components/Layout';
import { Search, Landmark, MapPin } from 'lucide-react';

// ==========================================
// 전국 법원 데이터 (권역별 탭 구조)
// ==========================================
type RegionType = '수도권' | '충청권' | '강원권' | '경상권' | '전라권' | '제주권';

const courtData: Record<RegionType, { group: string, items: string[] }[]> = {
  '수도권': [
    { group: '서울지방법원', items: ['서울중앙', '서울동부', '서울서부', '서울남부', '서울북부'] },
    { group: '의정부지방법원', items: ['의정부', '고양', '남양주'] },
    { group: '인천지방법원', items: ['인천', '부천'] },
    { group: '수원지방법원', items: ['수원', '성남', '여주', '평택', '안산', '안양'] }
  ],
  '충청권': [
    { group: '대전지방법원', items: ['대전', '홍성', '논산', '천안', '공주', '서산'] },
    { group: '청주지방법원', items: ['청주', '충주', '제천', '영동'] }
  ],
  '강원권': [
    { group: '춘천지방법원', items: ['춘천', '강릉', '원주', '속초', '영월'] }
  ],
  '경상권': [
    { group: '부산지방법원', items: ['부산', '동부', '서부'] },
    { group: '울산지방법원', items: ['울산'] },
    { group: '창원지방법원', items: ['창원', '진주', '통영', '밀양', '거창', '마산'] },
    { group: '대구지방법원', items: ['대구', '서부', '안동', '경주', '김천', '상주', '의성', '영덕', '포항'] }
  ],
  '전라권': [
    { group: '광주지방법원', items: ['광주', '목포', '장흥', '순천', '해남'] },
    { group: '전주지방법원', items: ['전주', '군산', '정읍', '남원'] }
  ],
  '제주권': [
    { group: '제주지방법원', items: ['제주'] }
  ]
};

export default function CourtSearchPage() {
  const [activeRegion, setActiveRegion] = useState<RegionType>('수도권');
  const [selectedCourt, setSelectedCourt] = useState('서울중앙');

  const handleSearch = () => {
    alert(`선택된 법원: [${selectedCourt}]\n해당 법원의 경매 물건을 검색합니다.\n* 실제 매물 DB 연동은 추후 진행됩니다.`);
  };

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-3 px-4 flex flex-col">
        <div className="w-full max-w-5xl mx-auto flex-grow flex flex-col">

          {/* 타이틀 영역 */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
              <Landmark className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-0.5">법원별검색</h2>
              <p className="text-gray-500 text-[13px]">경매에 참여할 관할 법원을 선택하여 물건을 조회해 보세요.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-grow mb-1">
            
            {/* 1. 광역 권역 탭 */}
            <div className="flex flex-wrap items-center p-2.5 bg-slate-50/50 border-b border-gray-200 gap-1.5">
              {(Object.keys(courtData) as RegionType[]).map((region) => (
                <button
                  key={region}
                  onClick={() => setActiveRegion(region)}
                  className={`px-4 py-2 rounded-xl text-[14px] font-bold transition-all ${
                    activeRegion === region
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>

            {/* 2. 세부 법원 버튼 리스트 */}
            {/* 💡 핵심 포인트: 기존 380px이었던 최소 높이를 280px로 팍 줄여서 과도한 여백 제거! */}
            <div className="px-4 pt-5 pb-3 md:px-6 md:pt-6 md:pb-3 flex-grow min-h-[280px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
                {courtData[activeRegion].map((section) => (
                  <div key={section.group} className="flex flex-col">
                    <h3 className="text-[14px] font-extrabold text-indigo-900 mb-2.5 pb-1.5 border-b-2 border-indigo-50 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {section.group}
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {section.items.map((court) => (
                        <button
                          key={court}
                          onClick={() => setSelectedCourt(court)}
                          className={`px-3.5 py-1.5 text-[14px] font-bold rounded-lg transition-all border ${
                            selectedCourt === court
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-500'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                          }`}
                        >
                          {court}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 하단 고정 검색 바 */}
            <div className="bg-indigo-50 py-3 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto border-t border-indigo-100">
              <div className="flex items-center gap-3 text-indigo-900">
                <span className="text-indigo-600 text-[14px] font-medium">선택된 법원</span>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm">
                  <Landmark className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-[15px] tracking-tight text-indigo-900">
                    {selectedCourt}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={handleSearch}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm text-[14.5px]"
              >
                <Search className="w-4.5 h-4.5" /> 물건 검색하기
              </button>
            </div>

          </div>

        </div>
      </div>
    </Layout>
  );
}