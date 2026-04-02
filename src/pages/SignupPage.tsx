
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { User, AtSign, Lock, CheckCircle, Smartphone, ShieldCheck } from 'lucide-react';

export default function SignupPage() {
  return (
    <Layout>
      {/* 로그인 페이지와 동일하게 아랫부분에 여백(pb-24 md:pb-40)을 더 주어 박스를 위로 올렸습니다. */}
      <div className="w-full flex-grow flex items-center justify-center p-4 pt-10 pb-24 md:pt-16 md:pb-40">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-10 md:p-12 border border-gray-100">
          
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">계정 만들기</h1>
            <p className="text-gray-500 mt-3 text-sm leading-relaxed">bid의 회원이 되어 다양한 경매 정보를 누려보세요.</p>
          </div>

          <form className="flex flex-col gap-6">
            
            {/* 1. 이름 */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">이름</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="text" id="username" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white placeholder-gray-400 text-sm shadow-inner transition-colors" placeholder="실명을 입력해 주세요" />
              </div>
            </div>

            {/* 2. 아이디 */}
            <div>
              <label htmlFor="userid" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">아이디</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AtSign className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="text" id="userid" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white placeholder-gray-400 text-sm shadow-inner transition-colors" placeholder="영문, 숫자 조합 4~12자리" />
              </div>
            </div>

            {/* 3. 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">비밀번호</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="password" id="password" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white placeholder-gray-400 text-sm shadow-inner transition-colors" placeholder="비밀번호 (영문, 숫자, 특수문자 포함 8자 이상)" />
              </div>
            </div>

            {/* 4. 비밀번호 확인 */}
            <div>
              <label htmlFor="password_confirm" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">비밀번호 확인</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CheckCircle className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="password" id="password_confirm" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white placeholder-gray-400 text-sm shadow-inner transition-colors" placeholder="비밀번호를 다시 한 번 입력해 주세요" />
              </div>
            </div>

            {/* 5. 휴대폰 번호 및 인증번호 받기 */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">휴대폰 번호</label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-grow group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Smartphone className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                  </div>
                  <input type="tel" id="phone" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white placeholder-gray-400 text-sm shadow-inner transition-colors" placeholder="숫자만 입력해 주세요" />
                </div>
                <button type="button" className="shrink-0 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold px-6 py-4 rounded-2xl transition-colors text-sm shadow-sm">
                  인증번호 받기
                </button>
              </div>
            </div>

            {/* 6. 인증번호 입력 */}
            <div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <ShieldCheck className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="text" id="verify_code" className="w-full py-4 pl-12 pr-20 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white placeholder-gray-400 text-sm shadow-inner transition-colors" placeholder="인증번호 6자리 입력" />
                <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                  <span className="text-red-500 text-sm font-semibold">03:00</span>
                </div>
              </div>
            </div>

            {/* 약관 동의 */}
            <div className="mt-2 pl-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" className="w-5 h-5 mt-0.5 text-blue-900 bg-gray-100 border-gray-300 rounded focus:ring-blue-900 focus:ring-2 cursor-pointer" />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors leading-relaxed">
                  [필수] 이용약관 및 개인정보 수집·이용에 동의합니다.
                </span>
              </label>
            </div>

            {/* 가입 완료 버튼 */}
            <button type="button" className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-4 rounded-2xl transition-colors shadow-md mt-6 text-base">
              회원가입 완료
            </button>
          </form>

          {/* 로그인 유도 */}
          <p className="text-center text-sm text-gray-500 mt-12 border-t border-gray-100 pt-10">
            이미 계정이 있으신가요? 
            <Link to="/login" className="text-blue-700 hover:text-blue-900 font-bold ml-1.5 transition-colors underline underline-offset-4">로그인</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}