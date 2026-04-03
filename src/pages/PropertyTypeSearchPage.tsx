import { useState } from 'react';
import Layout from '../components/Layout';
import { Search, Home, Building2, TreePine, Car, CheckSquare, Square, Layers, X } from 'lucide-react';

// ==========================================
// 용도별 카테고리 및 세부 항목 데이터
// ==========================================
const propertyTypes = [
  {
    id: 'residential',
    title: '주거용',
    icon: Home,
    color: 'text-orange-600',
    activeBorder: 'border-orange-500',
    items: ['아파트', '주택', '다세대(빌라)', '다가구주택', '근린주택', '오피스텔', '도시형생활주택']
  },
  {
    id: 'commercial',
    title: '상업용',
    icon: Building2,
    color: 'text-blue-600',
    activeBorder: 'border-blue-500',
    items: ['근린시설', '근린상가', '상가', '공장', '아파트형공장', '숙박시설', '주유소', '병원', '아파트상가', '창고', '목욕시설', '콘도(호텔)', '운동시설', '휴게시설', '노유자시설', '자동차관련시설', '펜션(캠핑장)', '교육시설', '장례관련시설']
  },
  {
    id: 'land',
    title: '토지',
    icon: TreePine,
    color: 'text-emerald-600',
    activeBorder: 'border-emerald-500',
    items: ['대지', '임야', '전', '답', '과수원', '잡종지', '공장용지', '도로', '목장용지', '창고용지', '유지', '하천', '구거', '기타토지', '주차장', '묘지']
  },
  {
    id: 'other',
    title: '기타',
    icon: Car,
    color: 'text-slate-600',
    activeBorder: 'border-slate-500',
    items: ['축사(농가시설)', '학교', '광업권', '어업권', '양어장', '종교시설', '기타', '선박', '차량', '중장비']
  }
];

export default function PropertyTypeSearchPage() {
  const [activeTab, setActiveTab] = useState<string>('residential');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // 현재 활성화된 탭의 데이터 찾기
  const currentCategory = propertyTypes.find(cat => cat.id === activeTab)!;

  // 현재 탭의 모든 항목이 선택되었는지 확인
  const isCurrentTabAllSelected = currentCategory.items.every(item => selectedTypes.includes(item));

  // 개별 토글
  const toggleType = (item: string) => {
    setSelectedTypes(prev => 
      prev.includes(item) ? prev.filter(t => t !== item) : [...prev, item]
    );
  };

  // 현재 탭의 전체선택 토글
  const toggleCurrentTabAll = () => {
    if (isCurrentTabAllSelected) {
      setSelectedTypes(prev => prev.filter(t => !currentCategory.items.includes(t)));
    } else {
      const newSelections = currentCategory.items.filter(item => !selectedTypes.includes(item));
      setSelectedTypes(prev => [...prev, ...newSelections]);
    }
  };

  // 선택된 항목 하나 지우기
  const removeType = (itemToRemove: string) => {
    setSelectedTypes(prev => prev.filter(item => item !== itemToRemove));
  };

  // 검색 실행
  const handleSearch = () => {
    if (selectedTypes.length === 0) {
      alert("검색할 물건 용도를 최소 1개 이상 선택해주세요.");
      return;
    }
    alert(`[검색 완료]\n선택된 용도: ${selectedTypes.join(', ')}\n\n* 실제 DB 연동 시 해당 용도의 매물이 나열됩니다.`);
  };

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-5 px-4 flex flex-col min-h-[85vh]">
        <div className="w-full max-w-5xl mx-auto flex-grow flex flex-col">

          {/* 상단 타이틀 */}
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0.5">용도별 검색</h2>
              <p className="text-gray-500 text-[13.5px]">원하시는 대분류를 선택한 후, 세부 용도를 골라주세요.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-grow overflow-hidden mb-3">
            
            {/* 1. 대분류 탭 메뉴 (여기는 고유 색상 유지) */}
            <div className="grid grid-cols-4 border-b border-gray-200 bg-slate-50">
              {propertyTypes.map((category) => {
                const Icon = category.icon;
                const isActive = activeTab === category.id;
                const selectedCount = category.items.filter(item => selectedTypes.includes(item)).length;

                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={`relative flex flex-col items-center justify-center py-4 transition-all ${
                      isActive 
                        ? `bg-white ${category.color}` 
                        : 'text-gray-500 hover:bg-gray-100/50 hover:text-gray-700'
                    }`}
                  >
                    {isActive && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${category.activeBorder}`} />
                    )}
                    
                    <Icon className={`w-5 h-5 mb-1.5 ${isActive ? category.color : 'text-gray-400'}`} />
                    <span className={`text-[14.5px] ${isActive ? 'font-extrabold' : 'font-bold'}`}>
                      {category.title}
                    </span>
                    
                    {selectedCount > 0 && (
                      <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                        {selectedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 2. 세부 항목 내용 영역 */}
            <div className="flex flex-col flex-grow bg-white">
              
              {/* 상단 컨트롤 바 */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100 bg-white">
                <button 
                  onClick={toggleCurrentTabAll}
                  className="flex items-center gap-1.5 text-[14px] font-bold text-slate-600 hover:text-indigo-600 transition-colors group"
                >
                  {isCurrentTabAllSelected ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                  )}
                  {currentCategory.title} 전체선택
                </button>
              </div>

              {/* 세부 항목 체크박스 그리드 (모두 파란색 테마로 통일!) */}
              <div className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 content-start">
                {currentCategory.items.map((item) => {
                  const isChecked = selectedTypes.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleType(item)}
                      className={`flex items-center gap-3 text-left group transition-all p-2 rounded-xl ${
                        isChecked ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors shadow-sm shrink-0 ${
                        isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border border-gray-300 group-hover:border-indigo-400'
                      }`}>
                        {isChecked && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[14.5px] truncate ${
                        isChecked ? 'font-extrabold text-indigo-900' : 'font-medium text-gray-700 group-hover:text-indigo-600'
                      }`}>
                        {item}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* 3. 내가 담은 용도 바구니 */}
          {selectedTypes.length > 0 && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 mb-3 flex flex-wrap gap-2 items-center">
              <span className="text-[13px] font-bold text-indigo-600 mr-2 shrink-0">선택목록 :</span>
              {selectedTypes.map(item => (
                <span key={item} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[13.5px] font-bold rounded-lg border border-indigo-100">
                  {item}
                  <button onClick={() => removeType(item)} className="hover:bg-indigo-200 p-0.5 rounded-full transition-colors ml-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 하단 고정 검색 버튼 */}
          <div className="mt-auto">
            <button 
              onClick={handleSearch}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all text-[15.5px]"
            >
              <Search className="w-5 h-5" /> 
              {selectedTypes.length > 0 ? `선택한 ${selectedTypes.length}개 용도 검색하기` : '용도를 선택해주세요'}
            </button>
          </div>

        </div>
      </div>
    </Layout>
  );
}