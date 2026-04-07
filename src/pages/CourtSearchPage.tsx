import { useState } from 'react';
import Layout from '../components/Layout';
import { Search, Landmark } from 'lucide-react';

// ==========================================
// 전국 법원 데이터 (한 페이지 전체 출력용 평면 구조)
// ==========================================
const courtDataList = [
  { group: '서울지방법원', items: ['서울중앙', '서울동부', '서울서부', '서울남부', '서울북부'] },
  { group: '의정부지방법원', items: ['의정부', '고양', '남양주'] },
  { group: '인천지방법원', items: ['인천', '부천'] },
  { group: '수원지방법원', items: ['수원', '성남', '여주', '평택', '안산', '안양'] },
  { group: '청주지방법원', items: ['청주', '충주', '제천', '영동'] },
  { group: '대전지방법원', items: ['대전', '홍성', '논산', '천안', '공주', '서산'] },
  { group: '춘천지방법원', items: ['춘천', '강릉', '원주', '속초', '영월'] },
  { group: '부산지방법원', items: ['부산', '동부', '서부'] },
  { group: '울산지방법원', items: ['울산'] },
  { group: '창원지방법원', items: ['창원', '진주', '통영', '밀양', '거창', '마산'] },
  { group: '대구지방법원', items: ['대구', '서부', '안동', '경주', '김천', '상주', '의성', '영덕', '포항'] },
  { group: '광주지방법원', items: ['광주', '목포', '장흥', '순천', '해남'] },
  { group: '전주지방법원', items: ['전주', '군산', '정읍', '남원'] },
  { group: '제주지방법원', items: ['제주'] }
];

export default function CourtSearchPage() {
  const [selectedCourt, setSelectedCourt] = useState('서울중앙');

  const handleSearch = () => {
    alert(`선택된 법원: [${selectedCourt}]\n해당 법원의 경매 물건을 검색합니다.\n* 실제 매물 DB 연동은 추후 진행됩니다.`);
  };

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-5 px-4 flex flex-col min-h-[85vh]">
        <div className="w-full max-w-5xl mx-auto flex-grow flex flex-col">

          {/* 상단 타이틀 영역 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <Landmark className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0.5">법원별검색</h2>
              <p className="text-gray-500 text-[13.5px]">전국 관할 법원을 한눈에 확인하고 원하시는 법원을 선택해 보세요.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-grow mb-3">
            
            {/* 법원 리스트 영역 (스크롤 가능, 한 줄씩 구분선 적용) */}
            <div className="flex flex-col divide-y divide-gray-100 bg-white">
              {courtDataList.map((section) => (
                // md:flex-row를 써서 PC에서는 옆으로 나란히, 모바일에서는 위아래로 떨어지게 반응형 적용!
                <div key={section.group} className="flex flex-col md:flex-row md:items-start py-5 px-5 hover:bg-slate-50/50 transition-colors">
                  
                  {/* 왼쪽: 메인 지방법원 이름 */}
                  <div className="w-full md:w-44 flex-shrink-0 mb-3 md:mb-0 flex items-center md:pt-1.5">
                    <h3 className="text-[14.5px] font-extrabold text-slate-800 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                      {section.group}
                    </h3>
                  </div>

                  {/* 오른쪽: 관할 세부 법원 버튼들 */}
                  <div className="flex flex-wrap gap-2.5 flex-grow">
                    {section.items.map((court) => {
                      const isChecked = selectedCourt === court;
                      return (
                        <button
                          key={court}
                          onClick={() => setSelectedCourt(court)}
                          className={`px-4 py-2 text-[14px] font-bold rounded-lg transition-all border ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-500'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-indigo-50/50 hover:border-indigo-300 hover:text-indigo-600'
                          }`}
                        >
                          {court}
                        </button>
                      );
                    })}
                  </div>
                  
                </div>
              ))}
            </div>

            {/* 하단 고정 검색 바 */}
            <div className="bg-indigo-50 py-4 px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto border-t border-indigo-100 sticky bottom-0">
              <div className="flex items-center gap-3 text-indigo-900 w-full sm:w-auto">
                <span className="text-indigo-600 text-[14.5px] font-bold shrink-0">선택된 법원:</span>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 px-4 py-2.5 rounded-xl shadow-sm w-full truncate">
                  <Landmark className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-extrabold text-[15px] tracking-tight text-indigo-900 truncate">
                    {selectedCourt}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={handleSearch}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-10 rounded-xl shadow-md transition-all text-[15.5px] shrink-0"
              >
                <Search className="w-5 h-5" /> 검색하기
              </button>
            </div>

          </div>

        </div>
      </div>
    </Layout>
  );
}