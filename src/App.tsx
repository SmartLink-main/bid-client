import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import MainPage from './pages/MainPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import KnowledgePage from './pages/KnowledgePage'; 
import CourtSearchPage from './pages/CourtSearchPage';
import RegionSearchPage from './pages/RegionSearchPage';
import PropertyTypeSearchPage from './pages/PropertyTypeSearchPage';// 1. 새로 만든 페이지 불러오기
import SearchResultsPage from './pages/SearchResultsPage';
import GoodsDetailPage from './pages/GoodsDetailPage';
import SpecialSearchPage from './pages/SpecialSearchPage';
import AdvancedSearchPage from './pages/AdvancedSearchPage';
import SubwaySearchPage from './pages/SubwaySearchPage';
import NplSearchPage from './pages/NplSearchPage';
import ScheduledSearchPage from './pages/ScheduledSearchPage';
import SchedulePage from './pages/SchedulePage';
import AuctionScheduleDetailPage from './pages/AuctionScheduleDetailPage';
import QuestionGoodsPage from './pages/QuestionGoodsPage';
import AccountPage from './pages/AccountPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminInquiriesPage from './pages/AdminInquiriesPage';
import SupportPage from './pages/SupportPage';
import SystemStatusPage from './pages/SystemStatusPage';
import FavoritesPage from './pages/FavoritesPage';
import KakaoAuthCallbackPage from './pages/KakaoAuthCallbackPage';
import { PrivacyPolicyPage, ServiceTermsPage } from './pages/LegalPolicyPage';
import { useAuthSession } from './hooks/useAuthSession';
import { initializeAuthSession } from './lib/api';
import { getSafeInternalReturnTo } from './lib/navigation';

function PublicOnlyRoute({
  children,
}: {
  children: ReactNode;
}) {
  const authSession = useAuthSession();
  const location = useLocation();
  const locationState = location.state as { returnTo?: unknown } | null;
  const returnTo = getSafeInternalReturnTo(locationState?.returnTo);
  return authSession ? <Navigate to={returnTo} replace /> : children;
}

function AuthenticatedRoute({
  children,
  isInitializingSession,
  message = '관심물건과 내 계정 기능은 로그인 후 이용할 수 있습니다.',
}: {
  children: ReactNode;
  isInitializingSession: boolean;
  message?: string;
}) {
  const authSession = useAuthSession();
  const location = useLocation();
  if (isInitializingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500" role="status">
        인증 정보를 확인하고 있습니다.
      </div>
    );
  }
  return authSession ? children : (
    <Navigate
      to="/login"
      replace
      state={{
        returnTo: `${location.pathname}${location.search}${location.hash}`,
        message,
      }}
    />
  );
}

function AppRoutes() {
  const location = useLocation();
  const [shouldInitializeSession] = useState(
    () => location.pathname !== '/auth/kakao/callback',
  );
  const [isInitializingSession, setIsInitializingSession] = useState(shouldInitializeSession);

  useEffect(() => {
    if (!shouldInitializeSession) {
      return;
    }
    let isCurrentRequest = true;
    void initializeAuthSession()
      .catch(() => undefined)
      .finally(() => {
        if (isCurrentRequest) {
          setIsInitializingSession(false);
        }
      });
    return () => {
      isCurrentRequest = false;
    };
  }, [shouldInitializeSession]);

  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
      <Route path="/auth/kakao/callback" element={<KakaoAuthCallbackPage />} />
      {/* 2. /knowledge 주소로 접속하면 지식경매창고를 띄우도록 설정 */}
      <Route path="/knowledge" element={<KnowledgePage />} />
      <Route path="/court-search" element={<CourtSearchPage />} />
      <Route path="/region-search" element={<RegionSearchPage />} />
      <Route path="/type-search" element={<PropertyTypeSearchPage />} />
      <Route path="/special-search" element={<SpecialSearchPage />} />
      <Route path="/advanced-search" element={<AdvancedSearchPage />} />
      <Route path="/subway-search" element={<SubwaySearchPage />} />
      <Route path="/npl-search" element={<NplSearchPage />} />
      <Route path="/scheduled-search" element={<ScheduledSearchPage />} />
      <Route path="/schedules" element={<SchedulePage />} />
      <Route path="/schedules/:scheduleId" element={<AuctionScheduleDetailPage />} />
      <Route path="/question-search" element={<QuestionGoodsPage />} />
      <Route path="/search" element={<SearchResultsPage />} />
      <Route path="/goods/:auctionGoodsId" element={<GoodsDetailPage />} />
      <Route path="/system-status" element={<SystemStatusPage />} />
      <Route path="/terms-of-service" element={<ServiceTermsPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route
        path="/favorites"
        element={(
          <AuthenticatedRoute isInitializingSession={isInitializingSession}>
            <FavoritesPage />
          </AuthenticatedRoute>
        )}
      />
      <Route
        path="/account"
        element={(
          <AuthenticatedRoute isInitializingSession={isInitializingSession}>
            <AccountPage />
          </AuthenticatedRoute>
        )}
      />
      <Route
        path="/support"
        element={(
          <AuthenticatedRoute
            isInitializingSession={isInitializingSession}
            message="1:1 문의는 로그인 후 이용할 수 있습니다."
          >
            <SupportPage />
          </AuthenticatedRoute>
        )}
      />
      <Route
        path="/admin/users"
        element={(
          <AuthenticatedRoute isInitializingSession={isInitializingSession}>
            <AdminUsersPage />
          </AuthenticatedRoute>
        )}
      />
      <Route
        path="/admin/inquiries"
        element={(
          <AuthenticatedRoute
            isInitializingSession={isInitializingSession}
            message="관리자 기능은 로그인 후 이용할 수 있습니다."
          >
            <AdminInquiriesPage />
          </AuthenticatedRoute>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
