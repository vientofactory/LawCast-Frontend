# LawCast 프론트엔드

LawCast 서비스의 웹 프론트엔드 애플리케이션입니다.

## 기능

- **웹훅 등록**: 디스코드 웹훅 URL 등록 및 관리
- **최근 공지 조회**: 입법예고 변동사항 실시간 확인
- **AI 브리핑 카드**: 전체 입법예고 페이지에서 법률안별 AI 요약을 에이전트 스타일 카드로 제공
- **원문 조회 페이지**: 법률안별 "제안이유 및 주요내용" 원문 상세 페이지 제공
- **주의 안내 고지**: AI 요약은 참고용이며 오류가 있을 수 있음을 UI에 명시
- **검색 편의 필터**: 키워드 + 날짜 범위 + 의안번호 오름/내림 정렬 + 빠른 기간(최근 7일/30일/이번 달)
- **시스템 통계**: 웹훅 및 캐시 상태 모니터링
- **반응형 디자인**: 모바일 친화적인 UI
- **HashGuard(PoW) 통합**: 스팸 방지 기능 제공

## 기술 스택

- **프레임워크**: SvelteKit
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **아이콘**: FontAwesome
- **HTTP 클라이언트**: Axios
- **빌드 도구**: Vite

## 설치 및 실행

### 사전 요구사항

- Node.js 24.22.1 (권장, `.node-version` 참조). 지원 범위: 22.23.4 이상인 22.x, 24.22.1 이상인 24.x, 26.12.1 이상인 26.x.
- npm 또는 yarn

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하세요.

### Diffchain UI mock 모드

Project Diffchain 관련 UI를 가짜 데이터로 확인하려면 아래처럼 환경변수를 켠 뒤 개발 서버를 실행하세요.

```bash
DIFFCHAIN_UI_MOCK=1 npm run dev
```

이 모드에서는 홈, 입법예고 목록, 상세/리비전 비교, 상태 페이지가 mock 데이터로 렌더링됩니다.

### 빌드

```bash
npm run build
```

### 미리보기

```bash
npm run preview
```

## 프로젝트 구조

```text
src/
├── lib/
│   ├── components/     # 재사용 가능한 컴포넌트
│   ├── api/           # API 클라이언트
│   ├── types/         # 타입 정의
│   └── utils/         # 유틸리티 함수
├── routes/            # 페이지 라우트
│   ├── +page.svelte   # 메인 페이지
│   └── notices/       # 전체 입법예고 및 상세(원문 조회) 페이지
└── app.html           # HTML 템플릿
```

### 주요 페이지

- `/`: 웹훅 등록 + 최근 입법예고 요약 없는 빠른 목록
- `/notices`: AI 브리핑 카드 포함 전체 입법예고 목록 (검색 방식/검색/날짜 필터/정렬/빠른 기간)
- `/notices/[num]`: 법률안 상세(원문: 제안이유 및 주요내용)

## 백엔드 연동 API (요약/원문)

- `GET /api/notices/recent`: 목록 + (선택적) aiSummary 필드
- `GET /api/notices/:num/detail`: 법률안 상세 + 원문(proposalReason)
- `GET /api/notices/archive`: 전체 아카이브 목록 + `searchMode`(`keyword`/`semantic`/`auto`)
- `GET /api/notices/semantic-search`: 의미 검색(`query`, `k`), 엔진 상태는 `GET /api/notices/semantic-search/health`

프론트는 SSR 로드(`+page.server.ts`)에서 위 API를 호출해 SEO 친화적으로 페이지를 렌더링합니다.

### 전체 입법예고 필터 UX

`/notices` 페이지에는 아래 기능이 들어 있습니다.

- 검색 방식 선택 (자동/키워드/의미, `searchMode`) — `PUBLIC_SEMANTIC_SEARCH_ENABLED`가 켜져 있을 때만 나타난다
- 키워드 검색 (법률안명·소관위원회·제안자·제안 이유)
- 날짜 범위 직접 입력 (`startDate`, `endDate`)
- 빠른 기간 버튼 (최근 7일, 최근 30일, 이번 달, 기간 해제)
- 의안번호 정렬 (`desc`, `asc`)
- 현재 적용된 필터 요약 배지 표시

필터를 적용한 채로 페이지를 이동해도 쿼리 파라미터가 유지돼 탐색 흐름이 끊기지 않습니다.

### 검색 방식 (자동/키워드/의미)

선택한 검색 방식은 `searchMode` 쿼리 파라미터로 유지됩니다. 플래그가 켜져 있으면 컨트롤이 항상 `searchMode`를 명시적으로 기록하므로, 파라미터를 지워 기본값으로 되돌아가는 일이 없습니다.

- **자동**(`auto`, 기본값): 엔진을 쓸 수 있으면 의미 검색, 아니면 키워드로 처리한다. `searchMode`가 없는 URL도 이 방식으로 해석된다.
- **키워드**(`keyword`): 법률안명·소관위원회·제안자와 제안 이유(원문)를 그대로 찾는 빠짐없는(exhaustive) 경로다.
- **의미**(`semantic`): 질의와 뜻이 가까운 법률안을 관련도순으로 보여준다. 후보 수가 서버 설정(`SEMANTIC_SEARCH_HYBRID_MAX_NOTICES`)으로 제한되므로 같은 조건의 키워드 결과보다 좁을 수 있다.

의미 검색으로 처리된 응답(`appliedMode === 'semantic'`)에는 결과 카드마다 관련도 칩(점수·섹션·발췌)이 붙고, 정렬 자리는 관련도순 표시로 바뀝니다. 결과 위에는 “관련도순 상위 결과” 범위 안내와 키워드 모드로 넘어가는 링크, 같은 조건의 키워드 건수를 필요할 때만 조회하는 버튼이 있고, 관련도가 낮은 결과는 기본으로 숨기고 10건씩 나눠 보여줍니다. 요청한 방식과 실제 적용된 방식이 다를 때(키워드 폴백)는 키워드 결과와 폴백 안내 배너가 함께 나옵니다. UI 문자열과 힌트는 `src/lib/utils/semantic-search.ts`에 모여 있습니다.

콜드 스타트의 예시 검색어 칩은 요청마다 18개 풀에서 서로 다른 3개를 뽑습니다(하루 고정이 아님). 그래서 두 라우트(`/notices`, `/notices/semantic-search`)는 `Cache-Control: private, no-cache`를 내보내, 공유 캐시가 한 방문자의 추출 결과를 다른 방문자에게 재사용해 칩이 고정된 것처럼 보이는 상황을 막습니다.

## 환경 설정

필요하면 `.env` 파일을 만들어 API 엔드포인트 등을 설정할 수 있습니다.

```env
# API 베이스 URL
API_BASE_URL=http://localhost:3000
PUBLIC_HASHGUARD_URL=https://hashguard.viento.me

# Cloudflare Under Attack 챌린지 감지 시 자동 리로드 활성화
# true, 1, yes, on 중 하나면 활성화
PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED=false

# 의미 검색 활성화 (보드의 검색 방식 컨트롤, /notices/semantic-search 진입점·라우트)
# true, 1, yes, on 중 하나면 활성화. 미설정이면 꺼진 상태로 동작한다.
PUBLIC_SEMANTIC_SEARCH_ENABLED=true

# Google Tag Manager 컨테이너 ID (빌드 타임 주입, 공식 gtm.js 스니펫으로 로드)
# 미설정이면 GTM 로딩과 페이지뷰 전송이 모두 생략된다.
# 값을 바꾸면 재빌드/재배포가 필요하다. GTM 측에서도 컨테이너 게시(Publish),
# GA4 태그 + `virtual_pageview` Custom Event 트리거(클라이언트 SPA 페이지뷰용)
# 설정이 끝나야 데이터가 들어온다.
PUBLIC_GTM_CONTAINER_ID=GTM-XXXXXXX
```

### 방문 통계와 동의 연동

- 최초 방문은 분석·광고 동의를 모두 `denied`로 시작합니다. 방문자가 동의하면
  `analytics_storage`만 `granted`로 업데이트하며, 광고 관련 동의는 허용하지 않습니다.
- 동의 명령은 Google의 `gtag` 규격(`dataLayer.push(arguments)`)으로 전달합니다.
  일반 배열로 바꾸면 GTM이 동의 명령으로 처리하지 않습니다.
- 재방문은 GTM 로드 전에 저장된 선택을 `update`로 복원합니다. 거부·동의 철회·저장 실패 시
  페이지뷰를 보내지 않으며, 같은 페이지에서 다시 동의해도 페이지뷰를 중복 전송하지 않습니다.
- GTM 기본 Google Analytics 태그는 `send_page_view=false`로 설정하고, GA4 이벤트 태그는
  `virtual_pageview` 맞춤 이벤트에서 `page_view`를 보냅니다. `page_location`과 `page_title`은
  같은 이름의 데이터 영역 변수(버전 2), `page_path`는 기본 제공 `Page Path` 변수로 매핑합니다.
- GTM의 **자동 이벤트 감지 관리 → 브라우저 기록의 페이지 조회수 변경**은 끕니다.
  GA4 스트림의 향상된 측정에서도 자동 History 페이지뷰를 함께 켜지 않습니다.
- GTM의 **데이터 전송 관리**에서 광고 데이터 전송 방지, 행동 분석 데이터 전송 방지,
  진단 데이터 전송 방지를 켜서 해당 동의가 거부된 상태의 요청도 차단합니다.
  **동의 모드 기본값 재정의**의 거부 기본값은 유지하며 사이트의 명시적 업데이트를 받습니다.
- JavaScript 없이 저장된 동의를 확인할 수 없어 `noscript` 추적 iframe은 넣지 않습니다.
- 회귀 테스트: `npx playwright test --config playwright-configs/playwright.analytics.config.ts`.
  전용 포트 5193과 모의 데이터를 사용하며 Google 네트워크 요청을 차단합니다.

## 개발 명령어

```bash
# 코드 포맷팅
npm run format

# 린팅 및 자동 수정
npm run lint

# 타입 체크
npm run check
```

## E2E 테스트 (Playwright)

프론트엔드에는 Playwright 기반 브라우저 E2E 테스트가 들어 있습니다. 실행하면 SvelteKit 개발 서버를 자동으로 띄우고 Chromium 브라우저에서 주요 페이지와 사용자 흐름을 검증합니다.

스펙은 `e2e/*.spec.ts`에 23개가 있고, **스펙마다 필요한 실행 환경(모의 데이터 게이트, 전용 포트, 전용 환경변수)이 다릅니다.** 주요 스펙의 실행 방법은 아래 표를 참고하세요.

### 사전 요구사항

- Node.js 24.22.1 (`.node-version` 참조)
- `npm install` 완료 상태
- Chromium 브라우저 (`npx playwright install chromium`으로 설치)

### 스펙별 실행 방법

"기본"은 아래 `playwright.config.ts`(5173 포트)로 돌리는 설정을 뜻합니다. mock 게이트가 있는 스펙은 명령 앞에 `DIFFCHAIN_UI_MOCK=1`을 붙여야 하며, 없으면 `test.skip`으로 전부 건너뜁니다.

| 스펙                             | 검증 내용                                                                       | 실행 방법                                                           |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `navigation.spec.ts`             | 헤더/주요 내비게이션, 활성 링크, skip-to-content, 푸터, 테마 토글               | 기본 (`npm run test:e2e`)                                           |
| `home.spec.ts`                   | 홈 히어로·검색 폼·퀵워드·상태 카드, SEO(JSON-LD, canonical)                     | 기본                                                                |
| `notices.spec.ts`                | 목록 필터폼/검색/페이지네이션 기본 + 교차 필터 조합                             | 기본, 교차 필터 describe는 `DIFFCHAIN_UI_MOCK=1`                    |
| `notice-detail.spec.ts`          | 상세(요약·원문·공유·구조화 데이터). 공지 데이터가 없으면 skip                   | 기본                                                                |
| `changes.spec.ts`                | 변동 이력 필터(이벤트 타입/정렬/의안번호)와 결과 영역                           | 기본                                                                |
| `proposals.spec.ts`              | 제안 통계 페이지(그래뉼러리티/차트 타입/기간/요약 카드)                         | 기본                                                                |
| `crawling-transparency.spec.ts`  | 크롤링 투명성 페이지와 출처 정보                                                | 기본                                                                |
| `status.spec.ts`                 | 시스템 상태(웹훅/캐시/웹푸시/AI 요약) 섹션                                      | 기본                                                                |
| `license.spec.ts`                | 라이선스 페이지(패키지 라이선스 표)                                             | 기본                                                                |
| `webhook.spec.ts`                | 알림 설정 페이지 + 웹 푸시 전체 해지 확인 모달(첫 오픈 트랜지션, Esc/취소/확인) | 기본                                                                |
| `discussions.spec.ts`            | 토론 목록/스레드/답글, 신규 토론·의견 수정/삭제·상태 변경·인용 알림 동의 모달   | **`DIFFCHAIN_UI_MOCK=1` 필수**                                      |
| `rate-limit-client.spec.ts`      | 클라이언트 429 카운트다운(신규 토론 모달, 스레드 재로딩)                        | **`DIFFCHAIN_UI_MOCK=1` 필수**                                      |
| `rate-limit-ssr.spec.ts`         | SSR 429 폴백 UI 8종(리트라이 오버레이 포함)                                     | **`npm run test:e2e:rate-limit`**                                   |
| `ip-forwarding.spec.ts`          | SSR/프록시의 클라이언트 IP 헤더 전달·스푸핑 값 제거                             | **`npm run test:e2e:ip-forwarding`**                                |
| `dark-mode-color-scheme.spec.ts` | 자동 다크모드 충돌 방지, `color-scheme`/`data-theme` 동기화                     | **`npm run test:e2e:dark-mode`**                                    |
| `cloudflare-challenge.spec.ts`   | Cloudflare Under Attack 챌린지 감지/복구 UI                                     | **`npm run test:e2e:cloudflare-challenge`** (기본 설정은 자동 스킵) |
| `semantic-search.spec.ts`        | 의미 검색 전용 페이지(입력·결과·폴백·약한 결과·엔진 상태)                       | **`npm run test:e2e:semantic-search`** (기본 설정은 자동 스킵)      |
| `semantic-search-board.spec.ts`  | `/notices` 검색 방식 컨트롤·관련도 칩·키워드 건수 대조·약한 결과 페이징         | **`npm run test:e2e:semantic-search`** (기본 설정은 자동 스킵)      |

### 설정별 실행 방법

설정마다 dev 서버 기동 방식이 다릅니다.

- `rate-limit`(5199), `ip-forwarding`(5223), `cloudflare-challenge`(5201), `semantic-search`(5202)은 전용 포트에 `reuseExistingServer: false`로 별도 dev 서버를 띄웁니다. 전용 환경변수는 이 서버에만 적용되므로 반드시 해당 스크립트로 실행하세요. (전용 포트가 이미 점유돼 있으면 실행이 실패합니다.)
- `dark-mode`는 기본 포트 5173을 그대로 사용하며 기본 설정은 기존에 떠 있는 dev 서버를 재사용합니다. `integration`도 전용 환경변수(`DIFFCHAIN_UI_MOCK=0`, `E2E_DISTINCT_CLIENT_IPS=1`)가 필요하므로 재사용하지 않습니다. 이미 5173에 서버가 떠 있으면 몇 초 내에 `http://localhost:5173 is already used...` 오류로 즉시 실패합니다.

| npm 스크립트                            | 설정 파일                                   | 포트              | 범위                             | 전용 환경                                                                                            |
| --------------------------------------- | ------------------------------------------- | ----------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run test:e2e`                      | `playwright.config.ts`                      | 5173              | 전체 스펙 (기본)                 | dev 서버 mock 기본값 `DIFFCHAIN_UI_MOCK=1`                                                           |
| `npm run test:e2e:integration`          | `playwright.config.integration.ts`          | 5173              | 전체 스펙, 실제 백엔드           | `DIFFCHAIN_UI_MOCK=0`, `E2E_DISTINCT_CLIENT_IPS=1` 고정                                              |
| `npm run test:e2e:rate-limit`           | `playwright.rate-limit.config.ts`           | 5199              | `rate-limit-ssr.spec.ts`         | `E2E_RATE_LIMIT_SIM=1`, `E2E_FORCE_429_PATHS`                                                        |
| `npm run test:e2e:ip-forwarding`        | `playwright.ip-forwarding.config.ts`        | 5223 (+에코 3999) | `ip-forwarding.spec.ts`          | `E2E_IP_ECHO=1`, `API_BASE_URL=http://127.0.0.1:3999/api`                                            |
| `npm run test:e2e:dark-mode`            | `playwright.dark-mode.config.ts`            | 5173              | `dark-mode-color-scheme.spec.ts` | Chromium `--force-prefers-color-scheme=light` + `AutoDarkModeForWebContents`                         |
| `npm run test:e2e:cloudflare-challenge` | `playwright.cloudflare-challenge.config.ts` | 5201              | `cloudflare-challenge.spec.ts`   | `E2E_CF_CHALLENGE=1`(스펙 게이트), `PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED=true`, `E2E_FORCE_403=1`   |
| `npm run test:e2e:semantic-search`      | `playwright.semantic-search.config.ts`      | 5202              | `semantic-search*.spec.ts`       | `E2E_SEMANTIC_SEARCH=1`(스펙 게이트), `PUBLIC_SEMANTIC_SEARCH_ENABLED=1`, `DIFFCHAIN_UI_MOCK=1` 고정 |

전체 실행은 기본 설정 하나로 처리됩니다. 전용 설정 스펙(`rate-limit-ssr`, `ip-forwarding`, `cloudflare-challenge`, `semantic-search*`)은 전용 환경변수가 없으면 자동으로 skip되므로, 빠뜨리지 않으려면 전용 스크립트를 한 번씩 더 돌려야 합니다.

```bash
# 1) 전체 실행 (mock 게이트 스펙 포함, 전용 설정 스펙은 자동 skip)
DIFFCHAIN_UI_MOCK=1 npm run test:e2e

# 2) 전용 설정이 필요한 스펙 4종
npm run test:e2e:rate-limit
npm run test:e2e:ip-forwarding
npm run test:e2e:cloudflare-challenge
npm run test:e2e:semantic-search
```

### 단일 스펙 / 단일 테스트 실행

```bash
# mock 게이트 스펙 (discussions, rate-limit-client, notices 교차 필터)
DIFFCHAIN_UI_MOCK=1 npx playwright test --config playwright-configs/playwright.config.ts e2e/discussions.spec.ts

# mock 게이트가 없는 스펙
npx playwright test --config playwright-configs/playwright.config.ts e2e/webhook.spec.ts

# 테스트 이름으로 필터 (-g는 정규식, 스펙 파일 필터와 함께 사용)
npx playwright test --config playwright-configs/playwright.config.ts e2e/webhook.spec.ts -g "Full unsubscribe"

# 전용 설정 스펙은 스크립트 + 파일/제목 필터 조합
npm run test:e2e:rate-limit -- -g "friendly rate-limit"
```

### 기타 실행 모드

```bash
# UI 모드 (브라우저에서 테스트 조작 가능)
DIFFCHAIN_UI_MOCK=1 npm run test:e2e:ui

# 디버그 모드 (단계별 디버깅, DIFFCHAIN_UI_MOCK=0이라 모의 데이터 스펙은 스킵)
npm run test:e2e:debug

# 테스트 리포트 열기
npm run test:e2e:report
```

### 주의사항

- **`DIFFCHAIN_UI_MOCK=1`은 테스트 프로세스 앞에 붙여야 합니다.** 설정 파일은 dev 서버에 mock 값을 넘기지만, 스펙의 `test.skip` 조건은 테스트 프로세스의 `process.env`를 읽습니다. 플래그가 없으면 해당 스펙이 전부 skip으로 표시됩니다.
- `rate-limit-ssr.spec.ts`, `ip-forwarding.spec.ts`, `cloudflare-challenge.spec.ts`, `semantic-search*.spec.ts`는 전용 설정이 아닌 기본 설정으로 실행하면 전용 환경변수(`E2E_RATE_LIMIT_SIM`, `E2E_IP_ECHO`, `E2E_CF_CHALLENGE`, `E2E_SEMANTIC_SEARCH`·`PUBLIC_SEMANTIC_SEARCH_ENABLED`)가 없어 skip됩니다. 이들 스펙은 반드시 전용 스크립트로 실행하세요.
- **통합 설정은 이미 떠 있는 dev 서버를 재사용하지 않습니다** (`reuseExistingServer: false`). 재사용한 서버는 이 설정의 환경변수(`DIFFCHAIN_UI_MOCK=0`, `E2E_DISTINCT_CLIENT_IPS=1`) 없이 기동한 것이므로, 실제 백엔드의 `읽기 30건/60초` 제한이 실행 중간에 걸려 `RateLimitOverlay`가 클릭을 막고 nondeterministic하게 실패합니다(2~10개씩 매번 다르게). 429 로그는 dev 서버 로그에만 남아 테스트 결과에는 보이지 않습니다. 그래서 5173에 서버가 떠 있으면 몇 초 내에 `http://localhost:5173 is already used ...` 오류로 즉시 실패하고, 재사용이 필요하면 `PLAYWRIGHT_BASE_URL=http://localhost:5173` 처럼 대상을 명시해서 실행하세요(그 서버의 환경변수는 사용자가 책임집니다). see `src/lib/server/e2e-client-ip.ts`.
- `notice-detail.spec.ts`는 서버에 공지 데이터가 없을 때 `No notices available`로 skip됩니다.
- CI 환경에서는 `PLAYWRIGHT_BASE_URL` 환경 변수로 외부 서버 주소를 지정할 수 있습니다.

```bash
PLAYWRIGHT_BASE_URL=https://your-staging.example.com npm run test:e2e
```

## 배포

이 프로젝트는 `@sveltejs/adapter-cloudflare`와 `wrangler.jsonc` 구성이라 Cloudflare Pages에 배포할 수 있습니다. 빌드 결과는 `.svelte-kit/cloudflare` 디렉토리에 생깁니다.

### Cloudflare 대시보드에서 배포

Git 저장소를 Cloudflare Pages에 연결한 뒤 아래 빌드 설정을 입력합니다.

- 루트 디렉토리: `frontend` (저장소 전체를 연결한 경우)
- 빌드 명령어: `npm run build`
- 빌드 출력 디렉토리: `.svelte-kit/cloudflare`
- Node.js 버전: 24.22.1 (`.node-version` 참조). Pages의 `NODE_VERSION` 환경 변수가 있다면 같은 버전으로 맞춥니다.

Pages 프로젝트의 **Settings > Variables and Secrets**에서 아래 환경 변수를 설정합니다.

```env
API_BASE_URL=https://your-api.example.com/api
PUBLIC_HASHGUARD_URL=https://hashguard.viento.me
PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED=false
```

`API_BASE_URL`은 Cloudflare에서 접근 가능한 백엔드의 공개 HTTPS 주소여야 합니다. 프리뷰 배포와 프로덕션 배포의 API가 다르면 각 환경에 별도로 값을 지정합니다.

### Wrangler CLI로 배포

Cloudflare에 로그인한 뒤 프론트엔드 디렉토리에서 빌드하고 배포합니다.

```bash
npm run build
npx wrangler pages deploy
```

`wrangler.jsonc`의 Pages 출력 경로와 `nodejs_compat` 호환성 플래그가 배포 시 자동 적용됩니다.

### 셀프호스팅 (Node 서버) 배포

`node build/index.js`로 직접 서빙하는 프로덕션은 **어답터 선택이 필요합니다.** 기본 `npm run build`는 Cloudflare 산출물(`.svelte-kit/cloudflare`)만 갱신하고 `build/`는 건드리지 않으므로, 기본 빌드만 반복하면 `node build/index.js`가 낡은 구버전 아티팩트를 그대로 서빙합니다.

```bash
npm run build:node   # SVELTE_ADAPTER=node → build/index.js 생성/갱신
npm run start:node   # node --env-file-if-exists=.env build/index.js
```

- `start:node`의 `--env-file-if-exists`는 `.env`를 런타임에 읽습니다. `$env/dynamic/public`(`PUBLIC_DISCORD_SERVER_URL`, `PUBLIC_SEMANTIC_SEARCH_ENABLED` 등)은 서버 시작 시 `process.env`에서만 풀리므로, 플래그 없이 `node build/index.js`를 실행하면 해당 기능 게이트(디스코드 섹션·시맨틱 검색 등)가 빠집니다.
- Docker 이미지는 Dockerfile이 `SVELTE_ADAPTER=node` 빌드와 `--env-file-if-exists=.env` 시작을 자동 적용합니다.
- Cloudflare Pages(CI 포함)의 기본 `npm run build` 경로는 변경되지 않았습니다.

## PWA 설치 및 오프라인 동작

HTTPS 환경(로컬 테스트는 localhost 허용)에서 `manifest.webmanifest`와 기존 웹푸시 서비스워커 `/sw.js`를 사용합니다. 아이콘은 `static/brand/icon-192.png`, `icon-512.png`를 재사용합니다.

브라우저가 `beforeinstallprompt`로 설치 가능 여부를 알리면 설치 안내를 표시합니다. 사용자가 **앱 설치**를 누르면 브라우저 내장 설치 창을 엽니다. 이미 앱으로 실행 중이거나 설치를 완료하면 안내를 숨기며, **나중에** 또는 내장 설치 창의 취소를 선택하면 7일간 안내를 미룹니다. 이 이벤트를 제공하지 않는 iOS Safari 등에서는 브라우저 메뉴의 홈 화면 추가 기능을 사용합니다.

오프라인에서는 연결 안내와 재시도 링크를 표시합니다. 최신 입법예고·API 응답·로그인 정보는 오프라인 저장하지 않습니다. 오프라인 문서와 앱 아이콘만 캐시하며, 해당 에셋을 변경할 때는 `static/sw.js`의 `CACHE_NAME` 버전도 올려야 합니다.

전용 Playwright 스위트는 Node 프로덕션 빌드를 만들고 별도 포트 `4185`에 mock 서버를 실행합니다.

```bash
npm run test:e2e:pwa
```

매니페스트와 아이콘, Chromium 설치 적합성, 기존 웹푸시와의 등록 공유, 오프라인 복구, 설치 안내·취소·재표시·모바일 배치를 검사합니다. 헤드리스 테스트에서는 설치 이벤트를 주입하여 내장 창 호출 계약을 검증하며, OS에 앱을 실제 설치하지는 않습니다.

## 라이선스

MIT License
