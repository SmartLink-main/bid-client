
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { User, Lock } from 'lucide-react';

export default function LoginPage() {
  return (
    <Layout>
      {/* 아랫부분에 여백(pb-24 md:pb-40)을 더 주어 박스가 자연스럽게 위로 올라가도록 수정했습니다. */}
      <div className="w-full flex-grow flex items-center justify-center p-4 pt-10 pb-24 md:pt-16 md:pb-40">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-8 md:p-10 border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight mt-2">환영합니다</h1>
            <p className="text-gray-500 mt-3 text-sm leading-relaxed">스마트한 법원경매의 시작, bid와 함께하세요.</p>
          </div>

          <form className="flex flex-col gap-5 mt-2">
            <div>
              <label htmlFor="userid" className="sr-only">아이디</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="text" id="userid" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition-all bg-white placeholder-gray-400 text-sm shadow-inner" placeholder="아이디를 입력해 주세요" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">비밀번호</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="password" id="password" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition-all bg-white placeholder-gray-400 text-sm shadow-inner" placeholder="비밀번호를 입력해 주세요" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-1 mb-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 text-blue-900 bg-gray-100 border-gray-300 rounded focus:ring-blue-900 focus:ring-2 cursor-pointer" />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">로그인 상태 유지</span>
              </label>
              <a href="#" className="text-sm text-blue-700 hover:text-blue-900 font-medium transition-colors">비밀번호 찾기</a>
            </div>

            <button type="button" className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-4 rounded-2xl transition-colors shadow-md mt-2 text-base">
              로그인
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-10 border-t border-gray-100 pt-8">
            아직 bid 회원이 아니신가요? 
            <Link to="/signup" className="text-blue-700 hover:text-blue-900 font-bold ml-1.5 transition-colors underline underline-offset-4">회원가입</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}