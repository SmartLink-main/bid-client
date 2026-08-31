
import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { User, Lock } from 'lucide-react';
import { login } from '../lib/auth';
import { getKoreanErrorMessage } from '../lib/api';
import { getSafeInternalReturnTo } from '../lib/navigation';
import { storeAuthSession } from '../lib/session';
import KakaoAuthButton from '../components/KakaoAuthButton';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { returnTo?: unknown; message?: unknown } | null;
  const returnTo = getSafeInternalReturnTo(locationState?.returnTo);
  const loginPrompt = typeof locationState?.message === 'string' ? locationState.message : '';
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (!loginId.trim()) {
      setMessage('아이디를 입력해 주세요.');
      return;
    }

    if (!password) {
      setMessage('비밀번호를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login({
        login_id: loginId.trim(),
        password,
        remember_me: keepSignedIn,
      });
      storeAuthSession(response);

      setMessage('로그인되었습니다.');
      navigate(returnTo, { replace: true });
    } catch (error) {
      setMessage(getKoreanErrorMessage(error, '로그인에 실패했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* 아랫부분에 여백(pb-24 md:pb-40)을 더 주어 박스가 자연스럽게 위로 올라가도록 수정했습니다. */}
      <div className="w-full flex-grow flex items-center justify-center p-4 pt-10 pb-24 md:pt-16 md:pb-40">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-8 md:p-10 border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight mt-2">환영합니다</h1>
            <p className="text-gray-500 mt-3 text-sm leading-relaxed">스마트한 법원경매의 시작, bid와 함께하세요.</p>
          </div>

          {loginPrompt && (
            <p className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-sm font-bold text-blue-800" role="status">
              {loginPrompt}
            </p>
          )}

          <KakaoAuthButton
            label="카카오 로그인"
            returnTo={returnTo}
            rememberMe={keepSignedIn}
            disabled={isSubmitting}
          />

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400">또는 아이디로 로그인</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="userid" className="sr-only">아이디</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="text" id="userid" value={loginId} onChange={(event) => setLoginId(event.target.value)} required autoComplete="username" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition-all bg-white placeholder-gray-400 text-sm shadow-inner" placeholder="아이디를 입력해 주세요" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">비밀번호</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="password" id="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-800 focus:border-blue-800 transition-all bg-white placeholder-gray-400 text-sm shadow-inner" placeholder="비밀번호를 입력해 주세요" />
              </div>
            </div>

            <div className="flex items-center mt-1 mb-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={keepSignedIn} onChange={(event) => setKeepSignedIn(event.target.checked)} className="w-4 h-4 text-blue-900 bg-gray-100 border-gray-300 rounded focus:ring-blue-900 focus:ring-2 cursor-pointer" />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">로그인 상태 유지</span>
              </label>
            </div>

            {message && (
              <p className="text-center text-sm font-medium text-blue-800" role="status">
                {message}
              </p>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-900 hover:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-colors shadow-md mt-2 text-base">
              {isSubmitting ? '로그인 중' : '로그인'}
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
