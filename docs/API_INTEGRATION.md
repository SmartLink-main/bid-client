# `bid_auction_app` API 연동표

이 문서는 `bid_auction_app`의 실제 FastAPI 라우터와 repository 반환값을 기준으로
`bid-client`의 호출 함수와 사용자 화면을 연결한 목록이다. 문서 예시와 코드가 다른
경우 실행 코드와 백엔드 테스트의 계약을 우선한다.

| Method | Backend path | Client integration |
|---|---|---|
| `GET` | `/api/v1/admin/users` | `/admin/users` 관리자 회원 목록 |
| `POST` | `/api/v1/signup/sms` | `/signup` SMS 발송 단계 |
| `POST` | `/api/v1/signup/sms/verify` | `/signup` SMS 확인 단계 |
| `POST` | `/api/v1/signup` | `/signup` 회원 생성 단계 |
| `POST` | `/api/v1/login` | `/login` 로그인 및 가입 직후 fallback |
| `GET` | `/api/v1/oauth/kakao/start` | `/login`, `/signup` 카카오 인증 시작 및 state cookie 설정 |
| `POST` | `/api/v1/oauth/kakao/exchange` | `/auth/kakao/callback` 일회용 ticket을 앱 세션으로 교환 |
| `POST` | `/api/v1/oauth/kakao/delete/start` | `/account` 카카오 전용 계정의 재인증 탈퇴 시작 |
| `POST` | `/api/v1/refresh` | 공통 API 계층의 단일-flight token 회전 |
| `POST` | `/api/v1/logout` | 공통 레이아웃 로그아웃 |
| `GET` | `/api/v1/me` | 앱 시작 세션 검증 및 `/account` 프로필 |
| `DELETE` | `/api/v1/me` | `/account` 현재 비밀번호 확인 후 탈퇴 |
| `GET` | `/api/v1/health` | `/system-status` 상태 확인 |
| `GET` | `/api/v1/schedule` | `/schedules` 공고 일정 목록 |
| `GET` | `/api/v1/auction-detail/{schedule_id}` | `/schedules/:scheduleId` 공고 JSON 상세 |
| `GET` | `/api/v1/auction-detail/{schedule_id}/page` | 일정·검색·질문 결과의 새 탭 HTML 링크 |
| `GET` | `/api/v1/search` | `/search` 빠른/기본 검색 |
| `GET` | `/api/v1/search/comprehensive` | `/advanced-search` 조건을 사용한 `/search?search_type=comprehensive` |
| `GET` | `/api/v1/npl/candidates` | `/npl-search` 구조화 사건·권리 근거 기반 NPL 후보 분석 |
| `GET` | `/api/v1/search/npl` | 구조화 NPL 후보 API의 비공개 호환 별칭 |
| `GET` | `/api/v1/search/special` | `/special-search`에서 선택한 특수물건 검색 |
| `GET` | `/api/v1/search/special/types` | `/special-search` 선택 유형 동적 조회 |
| `GET` | `/api/v1/geo/stations` | `/subway-search` 서버 역 스냅샷 자동완성 |
| `GET` | `/api/v1/geo/map` | `/map-search` WGS84 지도 뷰포트 검색 |
| `GET` | `/api/v1/geo/subway` | `/subway-search` 서버 `station_id` 기준 반경 검색 |
| `GET` | `/api/v1/search/map` | 원천 X/Y 기반 이전 지도 검색 호환 경로 |
| `GET` | `/api/v1/search/subway` | 클라이언트 X/Y 기반 이전 역 검색 호환 경로 |
| `GET` | `/api/v1/search/scheduled` | `/scheduled-search` 첫 매각기일 미지정 물건 검색 |
| `GET` | `/api/v1/goods/{auction_goods_id}` | `/goods/:auctionGoodsId` 통합 상세·미지원 섹션·안전한 사진 URL |
| `GET` | `/api/v1/goods/{auction_goods_id}/photos/{photo_id}` | 상세 화면 사진 body proxy |
| `GET` | `/api/v1/goods/{auction_goods_id}/homepage` | 이전 클라이언트 호환용 deprecated 섹션 응답 |
| `POST` | `/api/v1/question/goods` | `/question-search` 자연어 규칙 기반 추천 |

## 계약상 주의사항

- 지도 화면은 WGS84 뷰포트를 보내고 백엔드가 법원 원문의 KATEC/TM128
  `stXcrd`, `stYcrd`로 변환해 조회한다. 응답 물건은 다시 WGS84 위·경도로
  변환되며 원천 X/Y는 노출하지 않는다.
- 역세권 화면은 서버가 보유한 전국 874개 역 스냅샷을 자동완성으로 조회한다.
  사용자는 `station_id`와 반경만 보내며 임의 X/Y를 입력하지 않는다. `city`는
  행정구역 시·군이 아니라 원본의 도시철도 권역 값이다.
- NPL 화면은 사건 당사자 역할·청구액·감정가·현재 최저가·등기 권리를 근거로
  후보 점수와 위험 신호를 보여준다. 응답의 `availability_verified=false`와
  `is_tradable_inventory=false`는 실제 매입 가능한 채권 목록이 아님을 뜻한다.
- 예정물건은 단순히 미래 날짜 물건이 아니라 `auction_schedule_goods` 연결 이력이
  한 번도 없는 물건이다.
- `/search`와 `/search/comprehensive`는 같은 백엔드 함수의 두 경로다. 클라이언트는
  빠른 검색과 상세검색을 구분해 두 경로를 모두 사용한다.
- 계정 탈퇴의 잘못된 현재 비밀번호도 `401`이므로, 이 요청은 token 만료용 `401`
  처리와 분리해 사용자 세션을 임의로 폐기하지 않는다.
- 상세 화면은 `/goods/{id}`를 한 번만 호출하며 12초 timeout과 명시적 재시도를
  제공한다. 사진은 상세와 독립적으로 렌더링해 한 장의 실패가 나머지 섹션을 막지 않는다.
- 사진 메타데이터에는 S3 object key와 원본 경로가 없다. 클라이언트는 서버가 제공한
  `/api/v1/goods/{숫자}/photos/{숫자}` 형식의 상대 `content_url`만 API base URL에
  결합한다. 절대 외부 URL이나 S3 key 형태는 이미지 주소로 사용하지 않으며, 사진
  proxy 실패 시 해당 카드에서만 fallback과 재시도를 표시한다.
- 지도는 물건 또는 역의 focus key가 실제로 바뀔 때만 한 번 `flyTo`한다. 같은 선택을
  유지한 채 결과가 갱신되거나 사용자가 지도를 드래그한 뒤에는 자동으로 되돌리지 않는다.

`/admin/**` SQLAdmin 웹 UI와 조건부 `/docs`, `/redoc`, `/openapi.json`은
`/api/v1` 서비스 API 집계에서 제외한다.
