import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { User, AtSign, Lock, CheckCircle, Smartphone, ShieldCheck } from 'lucide-react';
import { login, requestSignupSmsCode, signup, verifySignupSmsCode } from '../lib/auth';
import { ApiError, getKoreanErrorMessage } from '../lib/api';
import { storeAuthSession } from '../lib/session';
import { useCountdown } from '../hooks/useCountdown';
import KakaoAuthButton from '../components/KakaoAuthButton';

const LOGIN_ID_MIN_LENGTH = 4;
const LOGIN_ID_MAX_LENGTH = 20;
const NAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 50;
const PHONE_NUMBER_LENGTH = 11;
const VERIFICATION_CODE_LENGTH = 6;

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function normalizeLoginId(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, LOGIN_ID_MAX_LENGTH);
}

function normalizeDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function isValidPhoneNumber(value: string) {
  return value.length === PHONE_NUMBER_LENGTH && value.startsWith('010');
}

function isValidLoginId(value: string) {
  return (
    value.length >= LOGIN_ID_MIN_LENGTH &&
    value.length <= LOGIN_ID_MAX_LENGTH &&
    /^[A-Za-z0-9]+$/.test(value)
  );
}

function isValidPassword(value: string) {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    value === value.trim() &&
    /^[ -~]+$/.test(value)
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [smsVerificationToken, setSmsVerificationToken] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    seconds: challengeSeconds,
    startCountdown: startChallengeCountdown,
    stopCountdown: stopChallengeCountdown,
  } = useCountdown();
  const {
    seconds: verificationSeconds,
    startCountdown: startVerificationCountdown,
    stopCountdown: stopVerificationCountdown,
  } = useCountdown();
  const isCodeVerified = smsVerificationToken !== '' && verificationSeconds > 0;
  const shouldShowPasswordMismatch = password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleLoginIdChange = (value: string) => {
    setLoginId(normalizeLoginId(value));
  };

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(normalizeDigits(value, PHONE_NUMBER_LENGTH));
    setChallengeId('');
    stopChallengeCountdown();
    setCode('');
    setSmsVerificationToken('');
    stopVerificationCountdown();
  };

  const handleCodeChange = (value: string) => {
    setCode(normalizeDigits(value, VERIFICATION_CODE_LENGTH));
    setSmsVerificationToken('');
    stopVerificationCountdown();
  };

  const handleRequestCode = async () => {
    setMessage('');

    if (!isValidPhoneNumber(phoneNumber)) {
      setMessage('휴대폰 번호는 010으로 시작하는 숫자 11자리로 입력해 주세요.');
      return;
    }

    setIsRequestingCode(true);

    try {
      const response = await requestSignupSmsCode(phoneNumber);
      setChallengeId(response.challenge_id);
      startChallengeCountdown(response.expires_in);
      setCode('');
      setSmsVerificationToken('');
      stopVerificationCountdown();
      setMessage('인증번호를 전송했습니다.');
    } catch (error) {
      setMessage(getKoreanErrorMessage(error));
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    setMessage('');

    if (!challengeId) {
      setMessage('휴대폰 인증번호를 먼저 받아주세요.');
      return;
    }

    if (challengeSeconds === 0) {
      setChallengeId('');
      stopChallengeCountdown();
      setMessage('인증번호가 만료되었습니다. 인증번호를 다시 받아주세요.');
      return;
    }

    if (code.length !== VERIFICATION_CODE_LENGTH) {
      setMessage('인증번호는 숫자 6자리로 입력해 주세요.');
      return;
    }

    setIsVerifyingCode(true);

    try {
      const response = await verifySignupSmsCode({
        phone_number: phoneNumber.trim(),
        code: code.trim(),
        challenge_id: challengeId,
      });

      setChallengeId('');
      stopChallengeCountdown();
      setSmsVerificationToken(response.sms_verification_token);
      startVerificationCountdown(response.expires_in);
      setMessage('인증번호가 확인되었습니다.');
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.message.toLowerCase().includes('verification attempts exceeded')
      ) {
        setChallengeId('');
        setCode('');
        stopChallengeCountdown();
      }
      setMessage(getKoreanErrorMessage(error, '인증번호 확인에 실패했습니다.'));
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (!isValidLoginId(loginId)) {
      setMessage('아이디는 영문 또는 숫자로 4~20자리 입력해 주세요.');
      return;
    }

    if (!isValidPassword(password)) {
      setMessage('비밀번호는 앞뒤 공백 없이 영문, 숫자, 특수문자로 8~50자리 입력해 주세요.');
      return;
    }

    if (!passwordConfirm) {
      setMessage('비밀번호 확인을 입력해 주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      setMessage('휴대폰 번호는 010으로 시작하는 숫자 11자리로 입력해 주세요.');
      return;
    }

    if (!smsVerificationToken) {
      setMessage('인증번호 확인을 완료해 주세요.');
      return;
    }

    if (verificationSeconds === 0) {
      setSmsVerificationToken('');
      stopVerificationCountdown();
      setMessage('휴대폰 인증 확인이 만료되었습니다. 인증을 다시 진행해 주세요.');
      return;
    }

    if (!agreed) {
      setMessage('필수 약관에 동의해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await signup({
        phone_number: phoneNumber.trim(),
        sms_verification_token: smsVerificationToken,
        login_id: loginId,
        password,
        name: name.trim() || undefined,
      });

      storeAuthSession(response);
      setMessage('회원가입이 완료되었습니다.');
      navigate('/');
    } catch (error) {
      if (error instanceof ApiError && error.status >= 500) {
        try {
          const response = await login({
            login_id: loginId,
            password,
            remember_me: false,
          });
          storeAuthSession(response);
          navigate('/');
          return;
        } catch {
          // 계정이 생성되지 않았다면 원래 회원가입 오류를 보여준다.
        }
      }
      setMessage(getKoreanErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="w-full flex-grow flex items-center justify-center p-4 pt-10 pb-24 md:pt-16 md:pb-40">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-10 md:p-12 border border-gray-100">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">계정 만들기</h1>
            <p className="text-gray-500 mt-3 text-sm leading-relaxed">bid의 회원이 되어 다양한 경매 정보를 누려보세요.</p>
          </div>

          <KakaoAuthButton
            label="카카오 로그인"
            returnTo="/"
            disabled={isSubmitting}
          />

          <div className="my-7 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400">또는 휴대폰으로 가입</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">이름</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input type="text" id="username" value={name} onChange={(event) => setName(event.target.value.slice(0, NAME_MAX_LENGTH))} maxLength={NAME_MAX_LENGTH} className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl bg-white placeholder-gray-400 text-sm shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0" placeholder="실명을 입력해 주세요" />
              </div>
            </div>

            <div>
              <label htmlFor="userid" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">아이디</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AtSign className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input
                  type="text"
                  id="userid"
                  value={loginId}
                  onChange={(event) => handleLoginIdChange(event.target.value)}
                  required
                  minLength={LOGIN_ID_MIN_LENGTH}
                  maxLength={LOGIN_ID_MAX_LENGTH}
                  pattern="[A-Za-z0-9]*"
                  autoComplete="username"
                  disabled={isSubmitting}
                  className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl bg-white placeholder-gray-400 text-sm shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0"
                  placeholder="영문 또는 숫자 4~20자리"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">비밀번호</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                  className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl bg-white placeholder-gray-400 text-sm shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0"
                  placeholder="비밀번호 (영문, 숫자, 특수문자 8~50자리)"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password_confirm" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">비밀번호 확인</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CheckCircle className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                </div>
                <input
                  type="password"
                  id="password_confirm"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                  className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl bg-white placeholder-gray-400 text-sm shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0"
                  placeholder="비밀번호를 다시 한 번 입력해 주세요"
                />
              </div>
              {shouldShowPasswordMismatch && (
                <p className="mt-2 ml-1.5 text-xs font-bold text-red-600">
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1.5">휴대폰 번호</label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-grow group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Smartphone className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    value={phoneNumber}
                    onChange={(event) => handlePhoneNumberChange(event.target.value)}
                    required
                    inputMode="numeric"
                    minLength={PHONE_NUMBER_LENGTH}
                    maxLength={PHONE_NUMBER_LENGTH}
                    pattern="010[0-9]{8}"
                    autoComplete="tel"
                    disabled={isRequestingCode || isVerifyingCode || isSubmitting}
                    className="w-full py-4 pl-12 pr-4 text-gray-800 border border-gray-200 rounded-2xl bg-white placeholder-gray-400 text-sm shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0"
                    placeholder="010으로 시작하는 휴대폰 번호"
                  />
                </div>
                <button type="button" onClick={handleRequestCode} disabled={!isValidPhoneNumber(phoneNumber) || isRequestingCode || isVerifyingCode || isSubmitting} className="shrink-0 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed font-semibold px-6 py-4 rounded-2xl transition-colors text-sm shadow-sm">
                  {isRequestingCode ? '전송 중' : '인증번호 받기'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="verify_code" className="sr-only">인증번호</label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-grow group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <ShieldCheck className="w-5 h-5 text-gray-400 group-focus-within:text-blue-700 transition-colors" />
                  </div>
                  <input
                    type="text"
                    id="verify_code"
                    value={code}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    required
                    inputMode="numeric"
                    minLength={VERIFICATION_CODE_LENGTH}
                    maxLength={VERIFICATION_CODE_LENGTH}
                    pattern="[0-9]{6}"
                    disabled={!challengeId || isVerifyingCode || isCodeVerified || isSubmitting}
                    className="w-full py-4 pl-12 pr-20 text-gray-800 border border-gray-200 rounded-2xl bg-white placeholder-gray-400 text-sm shadow-inner outline-none transition-colors focus:border-blue-700 focus:ring-0"
                    placeholder="인증번호 6자리 입력"
                  />
                  <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
                    <span className={isCodeVerified ? 'text-blue-600 text-sm font-semibold' : 'text-red-500 text-sm font-semibold'}>
                      {isCodeVerified ? `완료 ${formatCountdown(verificationSeconds)}` : challengeId ? formatCountdown(challengeSeconds) : '--:--'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={!challengeId || challengeSeconds === 0 || code.length !== VERIFICATION_CODE_LENGTH || isCodeVerified || isVerifyingCode || isSubmitting}
                  className="shrink-0 bg-blue-900 text-white hover:bg-blue-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-semibold px-6 py-4 rounded-2xl transition-colors text-sm shadow-sm"
                >
                  {isVerifyingCode ? '확인 중' : isCodeVerified ? '확인 완료' : '인증번호 확인'}
                </button>
              </div>
            </div>

            <div className="mt-2 pl-1">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="w-5 h-5 mt-0.5 text-blue-900 bg-gray-100 border-gray-300 rounded focus:ring-blue-900 focus:ring-2 cursor-pointer" />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors leading-relaxed">
                  [필수] 이용약관 및 개인정보 수집·이용에 동의합니다.
                </span>
              </label>
            </div>

            {message && (
              <p className="text-center text-sm font-medium text-blue-800" role="status">
                {message}
              </p>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-900 hover:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-colors shadow-md mt-6 text-base">
              {isSubmitting ? '가입 처리 중' : '회원가입 완료'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-12 border-t border-gray-100 pt-10">
            이미 계정이 있으신가요?
            <Link to="/login" className="text-blue-700 hover:text-blue-900 font-bold ml-1.5 transition-colors underline underline-offset-4">로그인</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
