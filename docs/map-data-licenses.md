# 지도 데이터와 라이브러리 이용 고지

## OpenStreetMap 베이스 지도

- 타일 URL: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- 데이터 및 타일 출처: OpenStreetMap 및 기여자
- 데이터 라이선스: Open Data Commons Open Database License 1.0(ODbL 1.0)
- 출처·라이선스: <https://www.openstreetmap.org/copyright>
- 타일 정책: <https://operations.osmfoundation.org/policies/tiles/>

지도 모서리에 `© OpenStreetMap contributors`와 저작권 페이지 링크를 항상 표시한다.
공식 커뮤니티 타일 서버는 사용자가 보는 현재 화면의 타일만 브라우저 기본 캐시 정책으로
요청하며, 오프라인 다운로드·대량 선조회·타일 수집 기능에는 사용하지 않는다. 운영 트래픽이
커지면 정책과 SLA가 명시된 공급자 또는 자체 호스팅으로 교체한다.

## 행정구역 확대 범위

### 시·도 및 시·군·구

`src/lib/region-viewports.ts`는 2026-08-25 기준 OpenStreetMap Overpass API의
행정구역 관계에서 계산한 WGS84 축 정렬 경계 상자를 기본으로 사용한다. 2026-07-01
인천 행정구역 개편의 이전 선택값 세 건은 국토교통부 VWorld 법정동 경계 합집합으로
호환한다.

OpenStreetMap에서 파생된 범위 데이터는 ODbL 1.0에 따라 제공하며, 파일의
`REGION_VIEWPORT_SOURCE` 메타데이터에 제공자·기준일·라이선스를 함께 둔다.

### 읍·면·동

`src/lib/dong-viewports.ts`는 국토교통부 VWorld `LT_C_ADEMD_INFO`
행정구역_읍면동(법정동) 데이터를 WGS84 경계 상자로 변환하고 행정표준코드와 대조한 결과다.

- 공식 데이터: <https://www.data.go.kr/data/15059008/openapi.do>
- 제공기관: 국토교통부
- 이용조건: 공공누리 제1유형(출처표시)
- 기준일: 2026-08-25

## 역지오코딩

지도 중심의 소재지는 서버가 Kakao 좌표→행정구역 API를 우선 사용한다. 공개 Nominatim은
개발·소규모 환경에서 명시적으로 활성화한 경우에만 보조로 사용하며, 운영 환경은 Kakao,
정책과 SLA가 있는 공급자 또는 자체 Nominatim을 사용한다.

## 지도 라이브러리 라이선스

서비스의 `/data-licenses` 화면에서 다음 배포 라이선스 전문을 제공한다.

- Leaflet: BSD 2-Clause License
- React Leaflet: Hippocratic License 2.1 및 이전 MIT 적용 부분
