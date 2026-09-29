import { lazy, Suspense, type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import MainPage from './pages/MainPage';
import { useAuthSession } from './hooks/useAuthSession';
import { initializeAuthSession } from './lib/api';
import { getSafeInternalReturnTo } from './lib/navigation';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const CourtSearchPage = lazy(() => import('./pages/CourtSearchPage'));
const RegionSearchPage = lazy(() => import('./pages/RegionSearchPage'));
const PropertyTypeSearchPage = lazy(() => import('./pages/PropertyTypeSearchPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const GoodsDetailPage = lazy(() => import('./pages/GoodsDetailPage'));
const SpecialSearchPage = lazy(() => import('./pages/SpecialSearchPage'));
const AdvancedSearchPage = lazy(() => import('./pages/AdvancedSearchPage'));
const MapSearchPage = lazy(() => import('./pages/MapSearchPage'));
const SubwaySearchPage = lazy(() => import('./pages/SubwaySearchPage'));
const ScheduledSearchPage = lazy(() => import('./pages/ScheduledSearchPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage'));
const AuctionScheduleDetailPage = lazy(() => import('./pages/AuctionScheduleDetailPage'));
const QuestionGoodsPage = lazy(() => import('./pages/QuestionGoodsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminInquiriesPage = lazy(() => import('./pages/AdminInquiriesPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const SystemStatusPage = lazy(() => import('./pages/SystemStatusPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const KakaoAuthCallbackPage = lazy(() => import('./pages/KakaoAuthCallbackPage'));
const DataLicensesPage = lazy(() => import('./pages/DataLicensesPage'));
const PrivacyPolicyPage = lazy(() =>
  import('./pages/LegalPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })),
);
const ServiceTermsPage = lazy(() =>
  import('./pages/LegalPolicyPage').then((module) => ({ default: module.ServiceTermsPage })),
);

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
    <Suspense
      fallback={(
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-500" role="status">
          화면을 불러오고 있습니다.
        </div>
      )}
    >
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
      <Route path="/map-search" element={<MapSearchPage />} />
      <Route path="/subway-search" element={<SubwaySearchPage />} />
      <Route path="/scheduled-search" element={<ScheduledSearchPage />} />
      <Route path="/schedules" element={<SchedulePage />} />
      <Route path="/schedules/:scheduleId" element={<AuctionScheduleDetailPage />} />
      <Route path="/question-search" element={<QuestionGoodsPage />} />
      <Route path="/search" element={<SearchResultsPage />} />
      <Route path="/goods/:auctionGoodsId" element={<GoodsDetailPage />} />
      <Route path="/system-status" element={<SystemStatusPage />} />
      <Route path="/data-licenses" element={<DataLicensesPage />} />
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
    </Suspense>
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
