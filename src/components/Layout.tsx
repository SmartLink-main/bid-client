import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Gavel, Menu, X, Landmark, MapPin, Building, BadgePercent, 
  ArrowDownToLine, ArrowUpToLine, Gem, Briefcase, 
  BookOpen, Headphones, Info 
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="bg-slate-50 min-h-screen w-full flex flex-col text-gray-800 font-sans">
      
      {/* 상단 헤더 */}
      <header className="flex justify-center w-full z-10 bg-white shadow-sm relative">
        <div className="w-full max-w-7xl flex justify-between items-center px-6 py-4 md:px-10">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <Gavel className="w-8 h-8 text-blue-900" />
            <span className="text-3xl font-extrabold text-blue-900 tracking-tighter">bid</span>
          </Link>
          <nav className="flex items-center gap-2 md:gap-4">
            <Link to="/login" className="px-4 py-2 text-sm md:text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              로그인
            </Link>
            <Link to="/signup" className="px-5 py-2 text-sm md:text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm inline-block text-center shrink-0">
              회원가입
            </Link>
            <button onClick={toggleSidebar} className="p-2 ml-1 md:ml-2 text-gray-600 hover:text-blue-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Menu className="w-6 h-6 md:w-7 md:h-7" />
            </button>
          </nav>
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-grow flex flex-col items-center w-full relative">
        {children}
      </main>

      {/* 푸터 */}
      <footer className="w-full flex justify-center py-6 text-gray-400 text-sm bg-white mt-10 border-t border-gray-100">
        <div className="w-full max-w-7xl px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4 text-center">
          <div className="flex justify-center gap-4">
            <a href="#" className="hover:text-gray-600 transition-colors">이용약관</a>
            <a href="#" className="hover:text-gray-600 transition-colors">개인정보처리방침</a>
            <a href="#" className="hover:text-gray-600 transition-colors">고객센터</a>
          </div>
          <p className="mt-2 md:mt-0">&copy; 2026 bid. All rights reserved.</p>
        </div>
      </footer>

      {/* 사이드바 오버레이 */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300" onClick={toggleSidebar} />
      )}

      {/* 우측 슬라이드 사이드바 */}
      <div className={`fixed top-0 right-0 w-72 h-full bg-white z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <Link to="/" className="text-xl font-extrabold text-blue-900 flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0" onClick={toggleSidebar}>
            <Gavel className="w-5 h-5" /> bid
          </Link>
          <button onClick={toggleSidebar} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-1">
          
          {/* 1. 경매 검색 카테고리 */}
          <div className="text-xs font-bold text-gray-400 mb-2 pl-3 mt-2">경매 검색</div>
          <Link to="/court-search" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <Landmark className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> 법원별검색
          </Link>
          <Link to="/region-search" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <MapPin className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> 지역별검색
          </Link>
          <Link to="/type-search" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <Building className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> 용도별검색
          </Link>
          <Link to="#" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <BadgePercent className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> 반값검색
          </Link>
          <Link to="#" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <ArrowDownToLine className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> 최저가검색
          </Link>
          <Link to="#" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <ArrowUpToLine className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> 최고가검색
          </Link>
          <Link to="#" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <Gem className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> 특수물건검색
          </Link>
          <Link to="#" className="flex items-center gap-3 p-3 hover:bg-blue-50 hover:text-blue-700 rounded-lg text-gray-700 font-medium transition-colors group">
            <Briefcase className="w-5 h-5 text-gray-400 group-hover:text-blue-600" /> npl물건검색
          </Link>

          {/* 구분선 */}
          <hr className="my-3 border-gray-100" />

          {/* 2. 지식 & 커뮤니티 카테고리 (분리 요청하신 부분!) */}
          <div className="text-xs font-bold text-gray-400 mb-2 pl-3 mt-1">경매 지식</div>
          {/* to="#" 대신 to="/knowledge" 로 변경 */}
        <Link to="/knowledge" className="flex items-center gap-3 p-3 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-gray-700 font-medium transition-colors group" onClick={toggleSidebar}>
        <BookOpen className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600" /> 경매지식창고
        </Link>

          {/* 구분선 */}
          <hr className="my-3 border-gray-100" />

          {/* 3. 고객지원 카테고리 */}
          <div className="text-xs font-bold text-gray-400 mb-2 pl-3 mt-1">고객지원</div>
          <Link to="#" className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-gray-700 font-medium transition-colors group">
            <Headphones className="w-5 h-5 text-gray-400 group-hover:text-gray-600" /> 고객센터
          </Link>
          <Link to="#" className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-gray-700 font-medium transition-colors group">
            <Info className="w-5 h-5 text-gray-400 group-hover:text-gray-600" /> 이용안내
          </Link>

        </div>
      </div>
    </div>
  );
}