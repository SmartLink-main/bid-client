# bid client

`bid_auction_app`이 제공하는 경매·인증 API를 사용하는 React/Vite 클라이언트다.

백엔드의 실제 `/api/v1` 라우트와 화면 진입점은
[API 연동표](docs/API_INTEGRATION.md)에 정리되어 있다.

주요 화면:

- 기본·종합·구조화 NPL 후보·특수물건 검색
- WGS84 지도 뷰포트와 서버 역 스냅샷 기반 역세권 검색
- 첫 매각기일 미지정 예정물건 검색
- 월간 경매 일정과 상세공고 JSON/HTML
- 단일 API 기반 물건 상세와 S3 key를 숨기는 사진 proxy 표시
- 자연어 규칙 기반 물건 추천
- 로그인·회원가입·세션 회전·회원정보·회원탈퇴
- 카카오 OIDC 간편가입·로그인·기존 계정 연결(일회용 ticket 교환, URL token 미노출)
- 회원 1:1 문의와 관리자 답변
- 이용약관·개인정보처리방침·지도 데이터 출처
- 관리자 회원·문의 목록과 API 생존 상태

## 로컬 실행

```bash
copy .env.example .env
npm install
npm run dev
```

기본 개발 주소는 다음과 같다.

- 클라이언트: `http://127.0.0.1:3000`
- `bid_auction_app`: `http://127.0.0.1:8000`

`bid_auction_app`은 경매 조회와 인증 라우트를 모두 `/api/v1` 아래에서 제공한다.
앱 프로젝트의 `.env.local`에 필수 환경 변수를 준비한 뒤 `8000` 포트로 실행한다.

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env.local
```

환경별 주소는 `.env`에서 설정한다.

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

access token은 페이지 메모리에만 두며 local/session Web Storage에는 인증 token을 저장하지
않는다. refresh token은 백엔드의 HttpOnly·Secure·SameSite 쿠키로만 관리한다. 새로고침하면
쿠키로 세션을 bootstrap하고, access token 만료 또는 인증 요청의 `401`에서는 refresh 요청을
single-flight로 한 번만 회전시킨 뒤 원래 요청을 재시도한다. 로그인 상태 유지를 선택하면
백엔드가 지속 쿠키를, 선택하지 않으면 브라우저 세션 쿠키를 발급한다.
초기 bootstrap은 2.5초 단일 시도로 제한하며 로그인·회원가입 화면을 가리지 않는다. 사용자가
새 인증을 시작하면 진행 중인 bootstrap을 취소하고, 늦게 끝난 이전 refresh 응답이 새 메모리
세션을 덮어쓰거나 지우지 않게 요청 시작 시점의 세션을 확인한다.

카카오 간편가입은 클라이언트가 `/api/v1/oauth/kakao/start`로 최상위 이동해 시작한다.
백엔드 콜백은 클라이언트의 `/auth/kakao/callback` fragment에 짧은 수명의 일회용
ticket만 전달하며, 클라이언트는 fragment를 즉시 주소창에서 지운 뒤 ticket을 앱 세션으로
교환한다. 카카오 authorization code, provider token, 앱 access token은 URL에 노출하지 않는다.
로컬에서도 쿠키가 정상 전달되도록 클라이언트와 API를 모두 `127.0.0.1`로 접속한다.

Tailwind CSS와 Pretendard Variable 글꼴은 npm 의존성에서 Vite 빌드에 포함되므로 런타임 CDN에
의존하지 않는다.

## 검사

```bash
npm test
npm run lint
npm run build
npm run test:e2e:install
npm run test:e2e:all
```

Playwright 설정은 형제 백엔드 worktree의 격리 하네스와 로컬 전용 SQLite/Redis DB를
사용한다. 각 suite는 전용 포트를 사용하지만 전체 검사는 포트 충돌을 피하도록 순서대로
실행한다. `playwright-report/`와 `test-results/`에는 테스트 계정 정보가 담길 수 있으므로
Git에 포함하거나 확인 없이 공유하지 않는다.
