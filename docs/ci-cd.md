# 스마트링크 웹 CI/CD

`.github/workflows/ci.yml`은 `main` 대상 PR, `main` push, 수동 실행에서 같은 검증을 수행한다.
Node 24와 `package-lock.json`으로 설치한 뒤 ESLint, Vitest, TypeScript/Vite 빌드,
Playwright Chromium을 순서대로 실행한다. 실행 중 새 커밋이 도착하면 이전 CI를 취소한다.

브라우저 검증은 기존 `playwright.main.config.ts`, `playwright.sidebar.config.ts`,
`playwright.legal.config.ts`를 사용한다. 홈의 데스크톱·모바일 이동, 검색·오류 복구,
법원·일정·메뉴·결과 카드, 약관 화면을 실제 입력·클릭으로 검사한다.
로컬 Vite와 가짜 API 응답만 사용하며 운영 API, 운영 DB와 외부 결제·로그인 제공자에
연결하지 않는다. 별도 백엔드 worktree가 필요한 인증·상세·지도 시나리오는
이 기본 CI의 검증 범위에 포함되지 않는다.

Playwright 보고서와 실패 trace·영상·스크린샷은 Actions의
`frontend-playwright-*` 아티팩트에 14일 보관된다. 모바일 전용 화면에서 필요 없는
데스크톱 구분선 시나리오의 기존 skip은 유지한다. 그 외 실패와 `.only`는 CI를 실패시킨다.

## Render 자동 배포 연결

기존 `smartlink-bid-client` 정적 사이트의 연결 저장소는
`SmartLink-main/bid-client`, 배포 브랜치는 `main`이다.
Render Settings → Auto-Deploy를 **After CI Checks Pass**로 설정해야 한다.
이 설정은 GitHub Actions 결과를 기다린 뒤 해당 커밋을 자동 배포한다.
검사가 없거나 실패한 커밋은 배포하지 않는다.
별도 deploy hook이나 GitHub 배포 비밀키는 필요하지 않다.

Render의 기존 빌드 명령 `npm ci && npm run build`, 게시 디렉터리
`dist`, SPA rewrite `/* → /index.html`과 배포 환경변수는 유지한다.
CI의 `VITE_API_BASE_URL`은 합성 검증용 루프백 주소다. 운영 빌드에 들어갈
`VITE_API_BASE_URL`·`VITE_PHOTO_CDN_BASE_URL`은 Render의 환경변수로 관리한다.

GitHub 브랜치 보호를 사용할 경우 `Frontend checks`를 필수 검사로 지정한다.
CI 파일을 PR로 검증하고 `main`에 반영한 뒤 Actions와 Render의 새 배포 결과를 확인한다.
기존 성공 배포는 새 빌드가 실패해도 계속 서비스된다.
긴급 복구는 Render에서 마지막 정상 배포로 rollback하고 원인 수정 커밋을 재검증한다.
Dashboard rollback은 자동 배포를 끄므로, 복구 후 Auto-Deploy를 다시
**After CI Checks Pass**로 설정한다.

- [Render CI 연동 및 배포 동작](https://render.com/docs/deploys#integrating-with-ci)
- [Actions 실행과 아티팩트](https://github.com/SmartLink-main/bid-client/actions)

## 로컬 재현

```sh
npm ci --no-audit --no-fund
npm run lint
npm test
npm run build
npx --no-install playwright install chromium
npx --no-install playwright test --config=playwright.main.config.ts --forbid-only
npx --no-install playwright test --config=playwright.sidebar.config.ts --forbid-only
npx --no-install playwright test --config=playwright.legal.config.ts --forbid-only
```

## 실제 배포의 읽기 전용 smoke

`.github/workflows/deployment-smoke.yml`은 main의 **Frontend CI**가 성공한 뒤
고정 실행 태그 `deployment-smoke-v1`에 배포 검사를 요청한다. main에는 짧은
`Queue deployment smoke` 작업만 붙고 배포 대기는 태그 SHA에서 실행하므로
Render의 **After CI Checks Pass**와 배포 후 검사 사이에 순환 대기가 생기지 않는다.
기본 `GITHUB_TOKEN`만 사용하며 새 secrets는 필요하지 않다.

처음 연결할 때 이 workflow가 들어 있는 PR의 마지막 커밋에 lightweight 태그
`deployment-smoke-v1`을 만들고 원격에 push한다. PR은 merge commit으로 병합하여
main과 실행 태그의 SHA를 다르게 유지한다. 실행은 현재 main SHA를 확인하고 해당
커밋의 테스트를 checkout한다. 오래된 main이나 다른 저장소 실행은 거절한다.
태그는 브랜치 정리 대상이 아니며 기존 태그를 옮기지 않는다. 실행 workflow 자체를
바꾸려면 새 태그 버전과 main의 dispatch 대상을 함께 갱신한다.

Actions의 **Frontend deployment smoke → Run workflow → main**에서 수동 재검사가
가능하다. SHA 입력을 비우면 최신 main을 검사한다. 보고서와 실패 자료는
`frontend-deployment-*` 아티팩트로 14일 보관한다. 실패는 배포 후 오류로 보고하며
자동 rollback은 수행하지 않는다.

기본 CI는 격리된 기능 회귀 검사다. 배포 smoke는 Render가 기대한 커밋을 게시한 뒤
실제 정적 파일·SPA 경로·브라우저와 API의 CORS 연결을 확인하는 별도 검사다.
`npm run build`는 Vite 빌드 뒤 `dist/deployment.json`에 공개 Git `revision`과
`source`를 기록한다. Render에서는 `RENDER_GIT_COMMIT`을 사용한다. 로컬 빌드의
Git HEAD fallback은 `source: git`으로 표시하며 운영 배포 확인에는 인정하지 않는다.
매번 다른 query와 no-cache 요청으로 기대 revision을 기다려 오래된 배포의 200이나
SPA fallback HTML을 성공으로 판단하지 않는다. 기본 대기 상한은 1,200초다.

```sh
DEPLOYMENT_SMOKE_RUN=1 \
DEPLOYMENT_SITE_URL=https://smartlink-bid-client.onrender.com \
DEPLOYMENT_API_URL=https://smartlink-bid-api.onrender.com \
DEPLOYMENT_EXPECTED_SHA=<배포할_전체_40자리_Git_SHA> \
DEPLOYMENT_WAIT_SECONDS=1200 \
npm run test:e2e:deployment
```

새 브라우저에서 앱 mount, 메뉴의 법원별검색, 약관·개인정보처리방침 이동과
정책 경로 직접 진입을 확인한다. 초기 앱이 시도하는 POST refresh는 전송 전에 막고,
그 요청에서 관찰한 실제 빌드 API origin의 `/api/v1/me`를 브라우저 GET으로 읽어
비회원 401과 CORS를 검사한다. 로그인·결제·데이터 변경은 수행하지 않는다.
브라우저의 GET/HEAD 외 요청, WebSocket 및 site/API 외 origin은 차단한다.
JavaScript 파일 로딩 실패와 앱 예외도 실패로 처리한다.

`playwright.deployment.config.ts`는 `e2e/deployment/`만 수집하며 기존 하네스의
`test:e2e:all`에는 포함되지 않는다. 실행은 `DEPLOYMENT_SMOKE_RUN=1`로 명시적으로
활성화해야 한다. 로컬 리허설은 site/API 모두 loopback origin으로 지정하고
`DEPLOYMENT_SMOKE_ALLOW_LOOPBACK=1`, `DEPLOYMENT_WAIT_SECONDS=30`을 추가한다.
리허설 서버는 별도로 준비하며 이 설정은 기존 백엔드 하네스를 자동 실행하지 않는다.
보고서는 `playwright-report/deployment/`, 실패 trace·스크린샷·영상은
`test-results/playwright-deployment/`에 남긴다.

보호할 동작은 새 배포의 실제 앱 연결과 익명 접근이다(P1). 기존 홈·약관 테스트는
로컬 Vite/가짜 API를 사용하므로 잘못된 배포 revision, 배포 asset 누락, 실제 API
origin·CORS 설정 오류와 SPA rewrite 누락을 놓친다. 이 검사는 그 배포 경계만 추가하며
기능 회귀의 입력 조합이나 인증된 사용자 흐름을 다시 실행하지 않는다.
