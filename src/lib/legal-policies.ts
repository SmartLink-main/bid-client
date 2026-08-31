export type LegalPolicyKind = 'terms' | 'privacy'

export type LegalPolicyMeta = {
  kind: LegalPolicyKind
  path: string
  title: string
  shortTitle: string
  description: string
  documentVersion: string
  kakaoConsentRecordVersion: string
  effectiveDate: string
}

// The Kakao authentication backend currently records this identifier when a
// user accepts the service terms and privacy notice. The effective date is kept
// separately because a consent record identifier does not have to be a date.
export const LEGAL_POLICY_DOCUMENT_VERSION = 'v1.0'
export const KAKAO_CONSENT_RECORD_VERSION = '2026-08-12'
export const LEGAL_POLICY_EFFECTIVE_DATE = '2026년 8월 28일'

export const LEGAL_POLICY_RELEASE_CHECKS = [
  '법적 운영주체의 상호·대표자·주소·사업자등록번호와 비회원도 이용할 수 있는 개인정보 연락처 확정',
  '운영 클라우드·데이터베이스·Redis·백업 수탁자와 접속로그 항목·보유기간 확정',
  '일반 아이디 가입의 약관·개인정보 동의 버전 서버 저장과 만 14세 미만 가입 차단 구현',
  '법원 공개자료 속 개인정보의 처리 근거·정당한 이익 형량, 원문 응답 보유·파기주기와 정정 요청 절차 확정',
] as const

export const SERVICE_OPERATOR = {
  serviceName: 'bid',
  operatorName: '스마트링크 운영자',
  privacyDepartment: '스마트링크 개인정보 보호 담당',
  supportPath: '/support',
} as const

export const SERVICE_TERMS: LegalPolicyMeta = {
  kind: 'terms',
  path: '/terms-of-service',
  title: '스마트링크 서비스 이용약관',
  shortTitle: '이용약관',
  description: '경매정보 검색과 회원 기능을 이용할 때 적용되는 기본 약속입니다.',
  documentVersion: LEGAL_POLICY_DOCUMENT_VERSION,
  kakaoConsentRecordVersion: KAKAO_CONSENT_RECORD_VERSION,
  effectiveDate: LEGAL_POLICY_EFFECTIVE_DATE,
}

export const PRIVACY_POLICY: LegalPolicyMeta = {
  kind: 'privacy',
  path: '/privacy-policy',
  title: '스마트링크 개인정보처리방침',
  shortTitle: '개인정보처리방침',
  description: '서비스가 어떤 개인정보를 왜 처리하고 언제 파기하는지 안내합니다.',
  documentVersion: LEGAL_POLICY_DOCUMENT_VERSION,
  kakaoConsentRecordVersion: KAKAO_CONSENT_RECORD_VERSION,
  effectiveDate: LEGAL_POLICY_EFFECTIVE_DATE,
}

export const LEGAL_POLICIES = [SERVICE_TERMS, PRIVACY_POLICY] as const

export const SIGNUP_COLLECTION_SUMMARY = [
  {
    category: '공통 필수',
    items: '휴대폰 번호, 회원 식별값(UUID), 접근그룹, 가입·최근 로그인 일시',
    purpose: '휴대전화 번호 확인, 회원가입, 계정 보안과 부정 이용 방지',
    retention: '회원 탈퇴 시까지',
  },
  {
    category: 'SMS 인증 필수·단기',
    items: '휴대폰 번호, 인증 용도, 인증번호의 HMAC 변환값, 시도횟수, 발급·만료시각, 인증완료 토큰',
    purpose: '휴대폰 점유 확인과 인증 남용 방지',
    retention: '인증번호 정보는 기본 5분, 인증완료 토큰은 기본 10분. 가입 성공 시 즉시 소비',
  },
  {
    category: '아이디 가입 필수',
    items: '로그인 아이디, 단방향 암호화된 비밀번호',
    purpose: '계정 생성과 로그인 인증',
    retention: '회원 탈퇴 시까지',
  },
  {
    category: '카카오 가입 필수',
    items: '카카오 이용자 식별값, 약관·개인정보 동의 버전과 동의 일시',
    purpose: '간편가입·로그인, 계정 연결, 동의 사실 확인',
    retention: '회원 탈퇴 시까지. 동의 기록도 계정과 함께 삭제',
  },
  {
    category: '선택',
    items: '이름',
    purpose: '회원 식별과 고객 문의 응대',
    retention: '회원 탈퇴 시까지',
  },
] as const

export const PRIVACY_PROCESSING_TABLE = [
  ...SIGNUP_COLLECTION_SUMMARY,
  {
    category: '관심물건 이용 시',
    items: '회원 식별값, 관심 등록한 경매물건 식별값, 등록 일시',
    purpose: '관심물건 저장과 목록 제공',
    retention: '관심 등록 해제 또는 회원 탈퇴 시까지',
  },
  {
    category: '1:1 문의 이용 시',
    items: '회원 식별값, 문의 제목·내용, 답변, 작성·수정·답변 일시',
    purpose: '문의 접수, 본인 문의 조회, 답변과 분쟁 대응',
    retention: '회원 탈퇴 시까지. 관계 법령상 보존 의무가 생기면 해당 기간 별도 보관',
  },
  {
    category: '인증 요청 제한(자동 생성)',
    items: 'IP 주소·로그인 아이디·휴대폰 번호의 HMAC 변환값, 요청 횟수',
    purpose: '무차별 로그인·인증 요청과 부정 이용 방지',
    retention: '기본 10분 후 자동 삭제',
  },
  {
    category: '로그인 세션(자동 생성)',
    items: '회원 식별값, 토큰 패밀리·세대·지속 여부·만료시각, 필수 쿠키 식별자',
    purpose: '로그인 유지, 토큰 회전과 탈취 재사용 방지',
    retention: '접속 토큰은 기본 15분, 갱신 세션은 기본 14일 단위·최대 30일. 로그아웃·탈퇴 후 사용할 수 없고 유효기간 내 자동 삭제',
  },
  {
    category: 'HTTP 접속기록(운영환경에서 생성 가능)',
    items: 'IP 주소, 브라우저·기기 정보, 접속 일시, 요청 경로와 응답 상태. URL 방식 검색조건은 접속기록에 포함될 수 있음',
    purpose: '장애 분석, 보안과 비정상 이용 방지',
    retention: '실제 기록 항목과 보유기간은 운영 인프라 확정 후 정식 공개 전에 고지',
  },
  {
    category: '법원경매 공개자료의 정보주체',
    items: '사건 당사자·항고 신청인·이해관계인·집행관계자 이름, 임차인 이름과 점유·전입·확정·배당요구·보증금·월세 정보, 등기 권리자 이름과 채권액, 물건 주소, 법원 공개 원문 응답',
    purpose: '법원경매 사건·물건 검색과 상세정보 제공, 원천자료 확인과 오류 정정',
    retention: '현재 서비스 데이터베이스에 저장. 운영 보유기간과 원문 응답 파기주기는 정식 공개 전에 확정하여 고지',
  },
] as const

export const PRIVACY_PROCESSORS = [
  {
    company: '네이버클라우드 주식회사',
    task: 'SENS를 통한 휴대전화 번호 확인용 SMS 발송',
    data: '휴대폰 번호, 인증번호가 포함된 메시지',
    retention: '문자 발송 완료 후 수탁사의 관계 법령 및 계약상 보유기간까지',
  },
] as const

export const REQUIRED_PRIVACY_SECTION_TITLES = [
  '개인정보의 처리 목적',
  '처리하는 개인정보와 보유기간',
  '개인정보의 제3자 제공',
  '개인정보 처리의 위탁',
  '개인정보의 파기',
  '정보주체의 권리와 행사 방법',
  '개인정보의 안전성 확보 조치',
  '쿠키와 인증정보',
  '개인정보 보호 담당과 권익침해 구제',
] as const
