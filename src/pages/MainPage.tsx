
import Layout from '../components/Layout';
import { Search } from 'lucide-react';

export default function MainPage() {
  return (
    <Layout>
      {/* 윗단 여백을 없애고, 아랫단 여백을 pb-16(이전과 처음의 딱 중간)으로 설정하여 시각적 중앙에 배치했습니다. */}
      <div className="flex-grow flex flex-col items-center justify-center w-full pb-16 md:pb-20">
        <h1 className="text-3xl md:text-5xl font-bold text-center mb-4 tracking-tight">
          어떤 경매 물건을 찾으시나요?
        </h1>
        <p className="text-gray-500 text-center mb-10 text-sm md:text-base">
          사건번호, 법원, 소재지 등 원하는 조건으로 쉽고 빠르게 검색해 보세요.
        </p>

        <div className="w-full max-w-3xl relative group px-4">
          <div className="absolute inset-y-0 left-4 pl-5 flex items-center pointer-events-none">
            <Search className="w-6 h-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input 
            type="text" 
            className="w-full py-4 pl-14 pr-24 text-lg border border-gray-200 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-300" 
            placeholder="예: 2023타경1234, 서울중앙지방법원, 강남구 아파트"
          />
          <button className="absolute inset-y-0 right-6 flex items-center px-6 my-2 bg-blue-900 hover:bg-blue-800 text-white rounded-full transition-colors font-medium text-sm md:text-base">
            검색
          </button>
        </div>

        {/* 추천 검색어 태그들 */}
        <div className="flex flex-wrap justify-center gap-2 mt-8 px-4">
          <button className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 서울 아파트</button>
          <button className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 유찰 2회 이상</button>
          <button className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 수도권 다세대/빌라</button>
          <button className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors"># 신건</button>
        </div>
      </div>
    </Layout>
  );
}