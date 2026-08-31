# bid client

`bid_auction_app`이 제공하는 경매·인증 API를 사용하는 React/Vite 클라이언트다.

백엔드의 실제 `/api/v1` 라우트와 화면 진입점은
[API 연동표](docs/API_INTEGRATION.md)에 정리되어 있다.

주요 화면:

- 기본·종합·구조화 NPL 후보·특수물건 검색
- WGS84 지도 뷰포트와 서버 역 스냅샷 기반 역세권 검색
- 첫 매각기일 미지정 예정물건 검색
- 경매 일정과 상세공고 JSON/HTML
- 단일 API 기반 물건 상세와 S3 key를 숨기는 사진 proxy 표시
- 자연어 규칙 기반 물건 추천
- 로그인·회원가입·세션 회전·회원정보·회원탈퇴
- 카카오 OIDC 간편가입·로그인(일회용 ticket 교환, URL token 미노출)
- 관리자 회원 목록과 API 생존 상태

## 로컬 실행

```bash
copy .env.example .env.local
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

프런트 `.env.local`에는 API 주소 한 항목만 설정한다. 원본 worktree의 `.env`에 남아 있는
테스트 아이디·비밀번호는 앱에서 사용하지 않으므로 복사하지 않는다.

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

## 보관 브랜치 결제 연동 계약

결제 페이지와 사용자 진입점은 `archive/billing-ui-pages` 브랜치에 보관한다. 현재
`feat/frontend-no-billing` 빌드에는 결제 라우트와 메뉴가 없으며, 아래 계약은 보관 브랜치를
다시 활성화할 때만 적용한다. 보관된 결제 프런트는 토스페이먼츠 V2 표준
카드·간편결제창과 백엔드 `/api/v1/billing` API를 사용한다.

- Vite 환경에는 `VITE_API_BASE_URL`만 설정한다. 토스 secret/client key를 `VITE_*`, 정적 파일 또는 프런트 소스에 넣지 않는다. client key는 인증된 백엔드 checkout session 응답으로만 받고, secret key는 백엔드에서만 사용한다.
- 약관 개정 시 새 버전의 불변 본문을 `src/lib/billing-policies.ts` registry에 먼저 추가해 프런트를 배포한 뒤 백엔드 `BILLING_TERMS_VERSION`과 `BILLING_REFUND_POLICY_VERSION`을 전환한다. 순서를 반대로 하면 프런트는 본문이 없는 버전의 판매를 fail-closed로 차단한다. 이미 결제에 사용한 본문은 수정하거나 삭제하지 않는다.
- SPA 호스팅은 `/payments/success`, `/payments/fail`, `/terms`, `/refund-policy` 직접 진입을 `index.html`로 rewrite한다. 결제 callback query는 React·인증 초기화 전에 session storage에 보존하고 URL에서 제거한다. `index.html`의 `referrer=no-referrer` 설정도 유지한다.
- CSP 적용 시 토스 공식 V2 Standard SDK·결제창에 필요한 `script-src`, `frame-src`, `connect-src`를 토스페이먼츠 최신 공식 문서에 따라 검증하고, 앱 API origin도 `connect-src`에 허용한다. 변경될 수 있는 결제 호스트를 이 저장소에서 추측하거나 광범위한 wildcard로 허용하지 않는다.
- 실제 PG E2E는 토스 테스트 `ck/sk`와 테스트 백엔드에서만 수행한다. 운영 키로 자동화 테스트하거나 실결제를 만들지 않는다.
- 현재 범위는 `method: CARD` 기반 1회성 카드·카드사 간편결제다. 자동갱신·빌링키·가상계좌·계좌이체·입금대기 흐름은 UI와 checkout에서 차단하며, 관련 원장·웹훅·환불 정책을 별도로 구현하기 전에는 활성화하지 않는다.

## 검사

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
```

인증 초기화 회귀는 격리된 로컬 인증 하네스에서 느린 refresh, 로그인 성공·실패와 보호 경로를
실제 브라우저로 검증한다. 현재 실행용 `../bid-client`와 결제 UI worktree를 같은 시나리오로
각각 실행한다.

```bash
npm run test:e2e:auth
```

## 보관 브랜치 결제 Playwright E2E

이 절의 명령은 `archive/billing-ui-pages` 브랜치에서만 실행한다. 로컬 결제 E2E는 실제 앱
라우터·인증 쿠키·데이터베이스·Redis를 사용하되, 외부 SMS 발송과
토스 승인 API만 백엔드의 루프백 전용 하네스로 교체한다. 브라우저에는 앱 JavaScript가
실행되기 전에 `window.TossPayments` 테스트 구현을 주입한다. 운영 프런트 코드에는 가짜
결제 공급자를 활성화하는 플래그나 경로가 없다.

사전 조건:

- 형제 worktree `../bid_auction/bid_auction_billing`에 E2E 하네스가 있어야 한다.
- 로컬 Redis가 실행 중이어야 한다. 기본값은 운영 기본 DB 0과 분리한
  `redis://127.0.0.1:6379/15`다. Playwright 프로세스가 실행별 고유 `BILLING_E2E_RUN_ID`를
  자동 생성하고, 백엔드는 이 값으로 Redis 키 namespace를 분리한다.
- Python 환경에 백엔드 런타임 의존성이 설치되어 있어야 한다.
- `127.0.0.1:8100`과 `127.0.0.1:3100` 포트가 비어 있어야 한다. 기존 서버를 재사용하지
  않으므로 잘못된 개발·운영 서버를 테스트 대상으로 삼지 않는다.

최초 한 번 Chromium을 설치한 뒤 실행한다.

```bash
npm run test:e2e:install
npm run test:e2e:billing
```

테스트 설정은 다음 안전장치를 적용한다.

- 백엔드는 `127.0.0.1:8100`에만 열리고 `BILLING_E2E_HARNESS=1`을 요구한다.
- 실행별 Redis namespace를 사용하므로 같은 논리 DB의 이전 하네스 잠금·인증 키를 재사용하지 않는다.
- 매 실행마다 `sqlite:///:memory:`를 사용하고, 각 시나리오가 고유한 아이디·휴대폰 번호로 직접 회원가입한다. 테스트 간 회원 상태를 공유하지 않는다.
- 하네스 키는 형식 검사용 `test_ck/test_sk` 더미이며 실제 토스에 전송되지 않는다.
- SMS 인증번호 기본값은 하네스가 제공하는 `123456`이며 외부 SMS를 보내지 않는다.
- 결제 성공, 같은 콜백의 재전송, 결제창 취소, 금액 변조 차단을 Chromium 한 worker에서
  검증하며, 메모리 DB의 일부 상태를 재사용하는 재시도는 CI에서도 활성화하지 않는다.

기본 주소가 아닌 전용 Redis를 사용할 때만 실행 셸에서 아래 값을 덮어쓴다. 이 값은 Vite가
읽는 `.env.local` 항목이 아니다. 회원·인증번호·포트·실행 명령과 테스트용 인증 키는 하네스가
안전한 로컬 값으로 자동 생성하거나 고정하므로 별도 환경변수로 받지 않는다.

```bash
BILLING_E2E_REDIS_URL=redis://127.0.0.1:6379/14 npm run test:e2e:billing
```

Playwright trace·스크린샷·영상에는 테스트 회원 정보와 주문번호가 포함될 수 있다.
`playwright-report/`, `test-results/`, `blob-report/`는 Git에서 제외되어 있으며 공유 전에
민감정보 포함 여부를 확인한다. 실제 카드번호·OTP·토스 secret key는 E2E 환경변수나
Playwright 입력값으로 사용하지 않는다.

이미 별도로 띄운 격리 서버를 대상으로 실행할 때만 다음처럼 자동 서버 시작을 끈다.
이 모드는 로컬 가짜 토스 브라우저 흐름용이며, 운영 주소나 운영 DB에는 실행하지 않는다.
이 세 값도 `.env.local`이 아니라 실행 셸에서만 전달한다.

```bash
E2E_EXTERNAL_SERVERS=1 \
E2E_BASE_URL=http://127.0.0.1:3100 \
E2E_API_BASE_URL=http://127.0.0.1:8100 \
npm run test:e2e:billing
```

실제 토스 테스트 키를 사용하는 HTTPS 스테이징은 이 자동 테스트와 분리한다. 카드 인증이나
OTP를 CI로 자동 입력하지 말고, 백엔드 `scripts/check_billing_staging.py`의 읽기 전용 점검을
통과한 뒤 사람이 테스트 결제 한 건을 완료하고 주문 원장·이용권·토스 테스트 결제내역·웹훅
기록을 대조한다. 키는 Git, `VITE_*`, Playwright report에 넣지 않는다.

## 자연어 검색 Playwright E2E

자연어 물건 검색은 형제 worktree `../bid_auction/bid_auction_app`의 실제 FastAPI 라우트와
검색 저장소를 사용한다. 전용 하네스가 `test-results/` 아래 SQLite 파일을 매번 새로 만들고
기존 합성 데이터를 적재하므로 운영 API, 운영 DB, Redis, 크롤러에는 접근하지 않는다.

```bash
npm run test:e2e:search
```

검색 E2E는 `127.0.0.1:3101`의 Vite와 `127.0.0.1:8101`의 API를 새로 시작하며 기존 서버를
재사용하지 않는다. 원형 검색과 조사·복수형 문장의 1위, 점수와 선정 이유가 같은지 확인하고,
`신고가` 같은 명사의 과잉 절단 방지 및 일치 물건이 없는 화면도 Chromium에서 검증한다.
현재 브랜치의 `npm run test:e2e`는 결제 UI 비노출 검증과 검색 E2E를 순서대로 실행한다.
