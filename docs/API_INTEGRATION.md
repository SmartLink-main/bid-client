# `bid_auction_app` API 연동표

이 문서는 `bid_auction_app`의 실제 FastAPI 라우터와 repository 반환값을 기준으로
`bid-client`의 호출 함수와 사용자 화면을 연결한 목록이다. 문서 예시와 코드가 다른
경우 실행 코드와 백엔드 테스트의 계약을 우선한다.

| Method | Backend path | Client integration |
|---|---|---|
| `GET` | `/api/v1/admin/users` | `/admin/users` 관리자 회원 목록 |
| `GET` | `/api/v1/admin/inquiries` | `/admin/inquiries` 관리자 전체 문의 목록 |
| `PUT` | `/api/v1/admin/inquiries/{inquiry_id}/answer` | `/admin/inquiries` 관리자 답변 등록·수정 |
| `POST` | `/api/v1/signup/sms` | `/signup` SMS 발송 단계 |
| `POST` | `/api/v1/signup/sms/verify` | `/signup` SMS 확인 단계 |
| `POST` | `/api/v1/signup` | `/signup` 회원 생성 단계 |
| `POST` | `/api/v1/login` | `/login` 로그인 및 가입 직후 fallback |
| `GET` | `/api/v1/oauth/kakao/start` | `/login`, `/signup` 카카오 인증 시작 및 state cookie 설정 |
| `POST` | `/api/v1/oauth/kakao/exchange` | `/auth/kakao/callback` 일회용 ticket을 앱 세션으로 교환 |
| `POST` | `/api/v1/oauth/kakao/signup-context` | `/auth/kakao/callback` 가입 완료에 필요한 카카오 제공정보 확인 |
| `POST` | `/api/v1/oauth/kakao/link` | `/auth/kakao/callback` 기존 계정과 카카오 계정 연결 완료 |
| `POST` | `/api/v1/oauth/kakao/link/sms` | `/auth/kakao/callback` 기존 계정 연결용 SMS 발송 |
| `POST` | `/api/v1/oauth/kakao/link/sms/verify` | `/auth/kakao/callback` 기존 계정 연결용 SMS 확인 |
| `POST` | `/api/v1/oauth/kakao/link/start` | `/account` 로그인 사용자의 카카오 계정 연결 시작 |
| `POST` | `/api/v1/oauth/kakao/delete/start` | `/account` 카카오 전용 계정의 재인증 탈퇴 시작 |
| `POST` | `/api/v1/refresh` | 공통 API 계층의 단일-flight token 회전 |
| `POST` | `/api/v1/logout` | 공통 레이아웃 로그아웃 |
| `GET` | `/api/v1/me` | 앱 시작 세션 검증 및 `/account` 프로필 |
| `DELETE` | `/api/v1/me` | `/account` 현재 비밀번호 확인 후 탈퇴 |
| `POST` | `/api/v1/inquiries` | `/support` 로그인 회원 문의 접수 |
| `GET` | `/api/v1/inquiries` | `/support` 본인 문의와 답변 목록 |
| `GET` | `/api/v1/health` | `/system-status` 상태 확인 |
| `GET` | `/api/v1/schedule` | `/schedules` 공고 일정 목록 |
| `GET` | `/api/v1/auction-detail/{schedule_id}` | `/schedules/:scheduleId` 공고 JSON 상세 |
| `GET` | `/api/v1/auction-detail/{schedule_id}/page` | 일정·검색·질문 결과의 새 탭 HTML 링크 |
| `GET` | `/api/v1/search` | `/search` 빠른/기본 검색 |
| `GET` | `/api/v1/search/comprehensive` | `/advanced-search` 조건을 사용한 `/search?search_type=comprehensive` |
| `GET` | `/api/v1/search/special` | `/special-search`에서 선택한 특수물건 검색 |
| `GET` | `/api/v1/search/special/types` | `/special-search` 선택 유형 동적 조회 |
| `GET` | `/api/v1/search/options/courts/{court_code}/divisions` | `/advanced-search` 선택 법원의 경매계 목록 |
| `GET` | `/api/v1/geo/stations` | `/subway-search` 서버 역 스냅샷 자동완성 |
| `GET` | `/api/v1/geo/reverse-region` | `/map-search` 사용자 지도 이동 뒤 중심 법정동 선택 동기화 |
| `GET` | `/api/v1/geo/map` | 일반 지도 검색의 WGS84 지도 뷰포트 조회 API |
| `GET` | `/api/v1/geo/subway` | `/subway-search` 서버 `station_id` 기준 반경 검색 |
| `GET` | `/api/v1/search/scheduled` | `/scheduled-search` 첫 매각기일 미지정 물건 검색 |
| `GET` | `/api/v1/goods/{auction_goods_id}` | `/goods/:auctionGoodsId` 통합 상세·미지원 섹션·안전한 사진 URL |
| `GET` | `/api/v1/goods/{auction_goods_id}/comments` | `/goods/:auctionGoodsId` 공개 전문가 댓글 목록 |
| `POST` | `/api/v1/goods/{auction_goods_id}/comments` | `/goods/:auctionGoodsId` 인증된 법무사·관리자 댓글 등록 |
| `GET` | `/api/v1/goods/{auction_goods_id}/photos/{photo_id}` | 상세 화면 사진 body proxy |
| `GET` | `/api/v1/goods/{auction_goods_id}/homepage` | 이전 클라이언트 호환용 deprecated 섹션 응답 |
| `POST` | `/api/v1/question/goods` | `/question-search` 자연어 규칙 기반 추천 |

## 계약상 주의사항

- 검색·일정·지도 API의 쿼리 생성은 `src/lib/api.ts`의 `withQuery`를 공유한다.
  빈 문자열과 `null`·`undefined`는 생략하고, `0`·`false`는 유지한다. 복수 검색
  조건은 쉼표로 합치지 않고 같은 키를 반복해서 전달한다.
- 지도·역세권의 가격 입력은 `src/lib/format.ts`의 동일한 정규화 함수를 사용한다.
  입력에는 천 단위 쉼표를 표시하고 요청에는 0 이상의 안전한 정수를 전달하며,
  빈 값은 가격 조건을 적용하지 않는다.
- 지도 화면은 WGS84 뷰포트를 보내고 백엔드가 법원 원문의 KATEC/TM128
  `stXcrd`, `stYcrd`로 변환해 조회한다. 응답 물건은 다시 WGS84 위·경도로
  변환되며 원천 X/Y는 노출하지 않는다. 사용자가 지도를 직접 이동하거나 확대·
  축소하면 중심 좌표의 법정동 코드를 역조회해 소재지 선택값을 갱신한다. 이 자동
  선택값은 현재 중심을 표시하기 위한 값이며 경계에 걸친 물건을 누락하지 않도록
  지도 범위 검색의 추가 지역 필터로 보내지 않는다. 드롭다운을 직접 고른 경우에만
  선택 지역 필터와 해당 지역의 지도 경계를 함께 적용한다.
- 역세권 화면은 서버가 보유한 KRIC 공식 자료 기반 전국 945개 역 스냅샷을
  자동완성으로 조회한다.
  사용자는 `station_id`와 반경만 보내며 임의 X/Y를 입력하지 않는다. `city`는
  행정구역 시·군이 아니라 원본의 도시철도 권역 값이다. 사용자는 역명·도시권·
  세부 지역·노선을 확인해 자동완성 항목을 선택해야 하며, 역이나 역 필터를 바꾸면
  이전 반경 검색 결과를 초기화한다. 구로디지털단지처럼 `역`을 생략한 부분 역명도
  검색할 수 있다. 구로디지털단지역·삼성역처럼 단일 항목인 역은 바로 선택할 수 있고,
  서울역처럼 같은 이름이 여러 지역·노선으로 제공되면 선택 요약을 확인하거나
  `다른 역 선택`으로 다시 고른다. 반경은 실제 보행 경로가 아닌 직선거리다.
- 법원 경매 수집 데이터만으로 개별 채권의 공식 NPL 상태를 확인할 수 없어
  점수 기반 NPL 후보 분석 화면과 API를 제거했다. 기존 `/npl-search` 주소는
  홈으로 이동하며, `/search?search_type=npl` 주소는 일반 검색으로 처리한다.
- 예정물건은 단순히 미래 날짜 물건이 아니라 `auction_schedule_goods` 연결 이력이
  한 번도 없는 물건이다.
- `/search`와 `/search/comprehensive`는 같은 백엔드 함수의 두 경로다. 클라이언트는
  빠른 검색과 상세검색을 구분해 두 경로를 모두 사용한다.
- 일반·상세·특수 검색 결과의 용도 필터는 `용도명 + 전체 결과 건수` 목록이다.
  결과 카드의 용도는 대표 사진 바로 오른쪽에 배경·테두리 없이 굵은 글씨로 표시한다.
  PC에서는 사진 → 용도 → 사건정보 → 가격 순서이며, 모바일에서는 사진과 용도를
  나란히 배치하고 사건정보·가격은 아래에 표시한다. 긴 복합 용도는 줄바꿈한다.
  용도 값이 없으면 `용도 미등록`으로 표시한다. 물건번호·매각상태 배지는 표시하지 않는다.
  제목은 사건번호(`2026타경12345`)이고 아래에는 주소를 표시하며 건물명 줄은 생략한다. 검색 응답의
  `case_number`가 없으면 기존 물건 상세의 `case_display_number`로 보완한다.
  카드 왼쪽에는 같은 물건의 `photos.items`에서 대표 사진 한 장을 배치한다.
  `photo_division_code` 기준 관련사진(`000245`) → 전경도(`000241`) → 위치도(`000244`)
  순으로 우선하며 같은 유형 안에서는 기존 목록 순서를 유지한다. 세 유형이 모두 없으면
  다른 유형의 첫 표시 가능한 사진을 사용한다. URL이 잘못되거나 다른 물건의 사진은 제외한다.
  화면 근처 카드만 상세 API를 조회하고 사건번호와 사진 정보를 한 응답에서 읽는다.
  사진 정보는 물건별로, 확인된 사건번호는 사건별로 화면 내에서 재사용한다.
  사진이 없으면 빈 상태를 표시하고, 상세 조회·이미지 로딩 실패는 카드에서 재시도한다.
  검색 결과에는 관심 저장 버튼과 관심 상태 조회가 없다.
  매각기일은 `9월 14일`처럼 월·일만 표시하며 연도와 매각시간은 생략한다.
  매각일자는 사건번호·주소 오른쪽에 배치하고 아래에 한국 날짜 기준 `입찰 3일 전`,
  `입찰 당일`, `입찰 2일 경과`를 표시한다. 날짜가 없거나 잘못되면 `기일 미정`으로 안내한다.
  한국 날짜는 매분 및 탭 복귀 시 갱신한다. 사진 크기와 여백을 줄여 카드 높이를 낮췄다.
  검색 결과 카드에는 경매법정 등 매각장소와 장소 미정 문구를 표시하지 않는다.
  법원 표시에는 담당 법원(`branch_name`)과 경매계만 사용하고, 앞쪽 본원명(`court_name`)과 구분선은 표시하지 않는다.
  사건번호 오른쪽에 토지·건물 면적(`land_area_pyeong`, `building_area_pyeong`)을 평 단위로 소수 둘째 자리까지 표시한다. 누락·잘못된 값은 `-`로 표시하고, 좁은 화면에서는 줄바꿈한다.
  PC에서는 사건번호·주소 영역과 매각일자 사이에 32px 여백을 두어 정보 영역의 오른쪽 폭을 조금 줄인다.
  용도·정렬·페이지를 제외한 현재 조건으로 기존 검색 API를 100개씩 조회해 집계하며,
  모든 페이지를 확인한 뒤 건수를 표시한다. 첫 응답에 전체 결과가 있으면 재사용한다.
  추가 페이지 요청은 최대 두 건씩 실행하고 조건 변경 시 중단한다. 집계 실패는
  빈 결과나 0건으로 처리하지 않고 재시도를 제공한다. 결과가 많으면 집계에 시간이 걸릴 수 있다.
  용도 선택·페이지·정렬 변경은 완료된 집계를 재사용한다. 항목을 누르면 해당 원본
  `goods_usage_name` 값 하나로 다시 검색해 표시 건수와 조건을 일치시킨다. 복합 용도는
  임의로 나누지 않는다. 용도 미등록 건수는 정보로 표시한다. `전체`는 용도 조건만
  해제하고 나머지 조건은 유지한다. 용도 변경 시 첫 페이지로 이동하고 방문 기록을 복원한다.
- 계정 탈퇴의 잘못된 현재 비밀번호도 `401`이므로, 이 요청은 token 만료용 `401`
  처리와 분리해 사용자 세션을 임의로 폐기하지 않는다.
- 상세 화면은 `/goods/{id}`를 한 번만 호출하며 12초 timeout과 명시적 재시도를
  제공한다. 사진은 상세와 독립적으로 렌더링해 한 장의 실패가 나머지 섹션을 막지 않는다.
- 전문가 댓글 목록은 로그인 여부와 관계없이 조회할 수 있다. 댓글 작성 UI와 `POST`
  요청은 현재 DB 접근 그룹이 `legal_agent` 또는 `admin`인 회원에게만 허용하며,
  클라이언트의 역할 확인과 별개로 서버가 작성 권한을 최종 검증한다. 공개 작성자
  정보는 서버가 `access_group`에서 계산한 `법무사` 또는 `관리자` 역할 라벨뿐이며
  회원 실명과 계정 식별자는 응답하지 않는다.
- 사진 메타데이터에는 S3 object key와 원본 경로가 없다. 클라이언트는 서버가 제공한
  `/api/v1/goods/{숫자}/photos/{숫자}` 형식의 상대 `content_url`만 API base URL에
  결합한다. 절대 외부 URL이나 S3 key 형태는 이미지 주소로 사용하지 않으며, 사진
  proxy 실패 시 해당 카드에서만 fallback과 재시도를 표시한다.
- 지도는 물건 또는 역의 focus key가 실제로 바뀔 때만 한 번 `flyTo`한다. 같은 선택을
  유지한 채 결과가 갱신되거나 사용자가 지도를 드래그한 뒤에는 자동으로 되돌리지 않는다.

`/admin/**` SQLAdmin 웹 UI와 조건부 `/docs`, `/redoc`, `/openapi.json`은
`/api/v1` 서비스 API 집계에서 제외한다.

## 물건 첨부파일

물건 상세의 `photos`는 기존 사진 API를 사용한다. `documents`의 명세서는
`GET /api/v1/goods/{goodsId}/documents/{documentId}`에서 PDF로 받는다.
상세 화면에 PDF 미리보기·다운로드·재시도와 미수집 상태를 표시한다.
`npm run test:e2e:media`는 격리 DB/가짜 저장소로 정상·실패 흐름을 검증한다.
