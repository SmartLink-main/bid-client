import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Search, Map, MapPin } from 'lucide-react';

// ==========================================
// 1. 전국 광역 자치단체 (시/도)
// ==========================================
const provinces = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
];

const provinceSearchTerms: Record<string, string> = {
  '서울': '서울특별시',
  '부산': '부산광역시',
  '대구': '대구광역시',
  '인천': '인천광역시',
  '광주': '광주광역시',
  '대전': '대전광역시',
  '울산': '울산광역시',
  '세종': '세종특별자치시',
  '경기': '경기도',
  '강원': '강원특별자치도',
  '충북': '충청북도',
  '충남': '충청남도',
  '전북': '전북특별자치도',
  '전남': '전라남도',
  '경북': '경상북도',
  '경남': '경상남도',
  '제주': '제주특별자치도',
};

// ==========================================
// 2. 대한민국 전체 시/군/구 데이터 (100% 반영)
// ==========================================
const siGunGuData: Record<string, string[]> = {
  '서울': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
  '부산': ['강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구', '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구'],
  '대구': ['남구', '달서구', '달성군', '동구', '북구', '서구', '수성구', '중구', '군위군'],
  '인천': ['강화군', '계양구', '남동구', '동구', '미추홀구', '부평구', '서구', '연수구', '옹진군', '중구'],
  '광주': ['광산구', '남구', '동구', '북구', '서구'],
  '대전': ['대덕구', '동구', '서구', '유성구', '중구'],
  '울산': ['남구', '동구', '북구', '울주군', '중구'],
  '세종': ['세종특별자치시'],
  '경기': ['가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시', '김포시', '남양주시', '동두천시', '부천시', '성남시', '수원시', '시흥시', '안산시', '안성시', '안양시', '양주시', '양평군', '여주시', '연천군', '오산시', '용인시', '의왕시', '의정부시', '이천시', '파주시', '평택시', '포천시', '하남시', '화성시'],
  '강원': ['강릉시', '고성군', '동해시', '삼척시', '속초시', '양구군', '양양군', '영월군', '원주시', '인제군', '정선군', '철원군', '춘천시', '태백시', '평창군', '홍천군', '화천군', '횡성군'],
  '충북': ['괴산군', '단양군', '보은군', '영동군', '옥천군', '음성군', '제천시', '증평군', '진천군', '청주시', '충주시'],
  '충남': ['계룡시', '공주시', '금산군', '논산시', '당진시', '보령시', '부여군', '서산시', '서천군', '아산시', '예산군', '천안시', '청양군', '태안군', '홍성군'],
  '전북': ['고창군', '군산시', '김제시', '남원시', '무주군', '부안군', '순창군', '완주군', '익산시', '임실군', '장수군', '전주시', '정읍시', '진안군'],
  '전남': ['강진군', '고흥군', '곡성군', '광양시', '구례군', '나주시', '담양군', '목포시', '무안군', '보성군', '순천시', '신안군', '여수시', '영광군', '영암군', '완도군', '장성군', '장흥군', '진도군', '함평군', '해남군', '화순군'],
  '경북': ['경산시', '경주시', '고령군', '구미시', '김천시', '문경시', '봉화군', '상주시', '성주군', '안동시', '영덕군', '영양군', '영주시', '영천시', '예천군', '울릉군', '울진군', '의성군', '청도군', '청송군', '칠곡군', '포항시 남구', '포항시 북구'],
  '경남': ['거제시', '거창군', '고성군', '김해시', '남해군', '밀양시', '사천시', '산청군', '양산시', '의령군', '진주시', '창녕군', '창원시', '통영시', '하동군', '함안군', '함양군', '합천군'],
  '제주': ['서귀포시', '제주시']
};

export default function RegionSearchPage() {
  const navigate = useNavigate();
  const [selectedProvince, setSelectedProvince] = useState<string>('경북');
  const [selectedGuList, setSelectedGuList] = useState<string[]>([]);

  const currentGuList = siGunGuData[selectedProvince] || [];

  const selectProvince = (province: string) => {
    setSelectedProvince(province);
    setSelectedGuList([]);
  };

  const toggleGu = (guName: string) => {
    setSelectedGuList(prev => prev[0] === guName ? [] : [guName]);
  };

  const handleSearch = () => {
    if (selectedGuList.length === 0) {
      alert('검색할 시/군/구를 선택해 주세요.');
      return;
    }

    const searchParams = new URLSearchParams({
      sido: provinceSearchTerms[selectedProvince],
      sigungu: selectedGuList[0],
    });

    navigate(`/search?${searchParams}`);
  };

  return (
    <Layout>
      <div className="w-full flex-grow bg-slate-50 py-5 px-4 flex flex-col min-h-[85vh]">
        <div className="w-full max-w-6xl mx-auto flex-grow flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">
              <Map className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-0.5">지역별 검색</h2>
              <p className="text-gray-500 text-[13.5px]">원하시는 지역을 시/군/구 단위로 선택하여 빠르고 정확하게 매물을 찾아보세요.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-grow overflow-hidden">
            <div className="flex flex-wrap items-center p-3.5 bg-slate-50/80 border-b border-gray-200 gap-2">
              {provinces.map((province) => (
                <button
                  key={province}
                  onClick={() => selectProvince(province)}
                  className={`px-5 py-2.5 rounded-xl text-[14.5px] font-bold transition-all ${
                    selectedProvince === province
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600 ring-offset-1'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
                  }`}
                >
                  {province}
                </button>
              ))}
            </div>

            <div className="flex flex-col flex-grow bg-white">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/30">
                <span className="text-indigo-700 font-bold text-[14.5px]">
                  시/군/구 한 곳을 선택해 주세요
                </span>
                <div className="text-[14.5px] text-gray-600 font-medium bg-white px-4 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                  <span className="text-indigo-700 font-bold mr-1">{selectedProvince}</span>
                  관할 시/군/구 (총 <span className="font-bold text-gray-900">{currentGuList.length}</span>개)
                </div>
              </div>

              <div className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-5 content-start">
                {currentGuList.map((gu) => {
                  const isChecked = selectedGuList.includes(gu);
                  return (
                    <button
                      key={gu}
                      onClick={() => toggleGu(gu)}
                      className="flex items-center gap-3 text-left group transition-all"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors shadow-sm ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border border-gray-300 group-hover:border-indigo-400'}`}>
                        {isChecked && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[15px] ${isChecked ? 'font-extrabold text-indigo-900' : 'font-medium text-gray-700 group-hover:text-indigo-600'}`}>
                        {gu}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-indigo-50 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-indigo-100 mt-auto">
              <div className="flex items-center gap-3 text-indigo-900 w-full sm:w-auto overflow-hidden">
                <span className="font-bold text-indigo-600 text-[14.5px] shrink-0">선택된 지역:</span>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 px-4 py-2.5 rounded-xl shadow-sm w-full truncate">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-extrabold text-[15px] text-slate-800 shrink-0">
                    {selectedProvince}
                  </span>
                  {selectedGuList.length === 1 && (
                    <>
                      <span className="text-indigo-300 mx-1">|</span>
                      <span className="font-bold text-[14.5px] text-indigo-900 truncate">
                        {selectedGuList[0]}
                      </span>
                    </>
                  )}
                  {selectedGuList.length === 0 && (
                    <>
                      <span className="text-indigo-300 mx-1">|</span>
                      <span className="font-medium text-[14px] text-gray-400 truncate">
                        시/군/구를 선택해 주세요
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={handleSearch}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-10 rounded-xl shadow-md transition-all text-[15.5px] shrink-0"
              >
                <Search className="w-5 h-5" /> 물건 검색하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
