
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import KnowledgePage from './pages/KnowledgePage'; 
import CourtSearchPage from './pages/CourtSearchPage';
import RegionSearchPage from './pages/RegionSearchPage';
import PropertyTypeSearchPage from './pages/PropertyTypeSearchPage';// 1. 새로 만든 페이지 불러오기

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        {/* 2. /knowledge 주소로 접속하면 지식경매창고를 띄우도록 설정 */}
        <Route path="/knowledge" element={<KnowledgePage />} /> 
        <Route path="/court-search" element={<CourtSearchPage />} />
        <Route path="/region-search" element={<RegionSearchPage />} />
        <Route path="/type-search" element={<PropertyTypeSearchPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;