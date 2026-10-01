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
