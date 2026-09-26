# LawCast 프론트엔드

LawCast 서비스의 웹 프론트엔드 애플리케이션입니다. SvelteKit 기반으로 작성되었고, 사용자가 디스코드 웹훅을 등록하고 입법예고 정보를 확인할 수 있는 인터페이스를 제공합니다.

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

- Node.js (버전 18 이상)
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
- `/notices`: AI 브리핑 카드 포함 전체 입법예고 목록 (검색/날짜 필터/정렬/빠른 기간)
- `/notices/[num]`: 법률안 상세(원문: 제안이유 및 주요내용)

## 백엔드 연동 API (요약/원문)

- `GET /api/notices/recent`: 목록 + (선택적) aiSummary 필드
- `GET /api/notices/:num/detail`: 법률안 상세 + 원문(proposalReason)

프론트는 SSR 로드(`+page.server.ts`)에서 위 API를 호출해 SEO 친화적으로 페이지를 렌더링합니다.

### 전체 입법예고 필터 UX

`/notices` 페이지에서 아래 기능을 제공합니다.

- 키워드 검색
- 날짜 범위 직접 입력 (`startDate`, `endDate`)
- 빠른 기간 버튼 (최근 7일, 최근 30일, 이번 달, 기간 해제)
- 의안번호 정렬 (`desc`, `asc`)
- 현재 적용된 필터 요약 배지 표시

필터 적용 상태에서 페이지를 이동해도 쿼리 파라미터를 유지해 탐색 흐름이 끊기지 않게 구성했습니다.

## 환경 설정

필요하면 `.env` 파일을 만들어 API 엔드포인트 등을 설정할 수 있습니다.

```env
# API 베이스 URL
API_BASE_URL=http://localhost:3000
PUBLIC_HASHGUARD_URL=https://hashguard.viento.me

# Cloudflare Under Attack 챌린지 감지 시 자동 리로드 활성화
# true, 1, yes, on 중 하나면 활성화
PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED=false
```

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

프론트엔드에는 Playwright 기반 브라우저 E2E 테스트가 포함되어 있습니다. SvelteKit 개발 서버를 자동으로 시작하고 Chromium 브라우저에서 주요 페이지와 사용자 흐름을 검증합니다.

스펙은 `e2e/*.spec.ts`에 16개가 있고, **스펙마다 필요한 실행 환경(모의 데이터 게이트, 전용 포트, 전용 환경변수)이 다릅니다.** 스펙별 실행 방법은 아래 표를 참고하세요.

### 사전 요구사항

- Node.js 18 이상
- `npm install` 완료 상태
- Chromium 브라우저 (`npx playwright install chromium`으로 설치)

### 스펙별 실행 방법

"기본"은 아래 `playwright.config.ts`(5173 포트)를 의미합니다. mock 게이트가 있는 스펙은 명령 앞에 `DIFFCHAIN_UI_MOCK=1`을 붙여야 하며, 없으면 `test.skip`으로 전부 건너뜁니다.

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

### 설정별 실행 방법

설정마다 dev 서버 기동 방식이 다릅니다.

- `rate-limit`(5199), `ip-forwarding`(5223), `cloudflare-challenge`(5201)은 전용 포트에 `reuseExistingServer: false`로 별도 dev 서버를 띄웁니다. 전용 환경변수는 이 서버에만 적용되므로 반드시 해당 스크립트로 실행하세요. (전용 포트가 이미 점유돼 있으면 실행이 실패합니다.)
- `dark-mode`는 기본 포트 5173을 그대로 사용하며, 기본/통합 설정은 기존에 떠 있는 dev 서버를 재사용합니다.

| npm 스크립트                            | 설정 파일                                   | 포트              | 범위                             | 전용 환경                                                                                          |
| --------------------------------------- | ------------------------------------------- | ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run test:e2e`                      | `playwright.config.ts`                      | 5173              | 전체 스펙 (기본)                 | dev 서버 mock 기본값 `DIFFCHAIN_UI_MOCK=1`                                                         |
| `npm run test:e2e:integration`          | `playwright.config.integration.ts`          | 5173              | 전체 스펙, 실제 백엔드           | `DIFFCHAIN_UI_MOCK=0` 고정                                                                         |
| `npm run test:e2e:rate-limit`           | `playwright.rate-limit.config.ts`           | 5199              | `rate-limit-ssr.spec.ts`         | `E2E_RATE_LIMIT_SIM=1`, `E2E_FORCE_429_PATHS`                                                      |
| `npm run test:e2e:ip-forwarding`        | `playwright.ip-forwarding.config.ts`        | 5223 (+에코 3999) | `ip-forwarding.spec.ts`          | `E2E_IP_ECHO=1`, `API_BASE_URL=http://127.0.0.1:3999/api`                                          |
| `npm run test:e2e:dark-mode`            | `playwright.dark-mode.config.ts`            | 5173              | `dark-mode-color-scheme.spec.ts` | Chromium `--force-prefers-color-scheme=light` + `AutoDarkModeForWebContents`                       |
| `npm run test:e2e:cloudflare-challenge` | `playwright.cloudflare-challenge.config.ts` | 5201              | `cloudflare-challenge.spec.ts`   | `E2E_CF_CHALLENGE=1`(스펙 게이트), `PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED=true`, `E2E_FORCE_403=1` |

전체 실행은 기본 설정 하나로 처리됩니다. 전용 설정 스펙(`rate-limit-ssr`, `ip-forwarding`, `cloudflare-challenge`)은 전용 환경변수가 없으면 자동으로 skip되므로, 빠뜨리지 않으려면 전용 스크립트를 한 번씩 더 돌려야 합니다.

```bash
# 1) 전체 실행 (mock 게이트 스펙 포함, 전용 설정 스펙은 자동 skip)
DIFFCHAIN_UI_MOCK=1 npm run test:e2e

# 2) 전용 설정이 필요한 스펙 3종
npm run test:e2e:rate-limit
npm run test:e2e:ip-forwarding
npm run test:e2e:cloudflare-challenge
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
- `rate-limit-ssr.spec.ts`, `ip-forwarding.spec.ts`, `cloudflare-challenge.spec.ts`는 전용 설정이 아닌 기본 설정으로 실행하면 전용 환경변수(`E2E_RATE_LIMIT_SIM`, `E2E_IP_ECHO`, `E2E_CF_CHALLENGE`)가 없어 skip됩니다. 이들 스펙은 반드시 전용 스크립트로 실행하세요.
- `notice-detail.spec.ts`는 서버에 공지 데이터가 없을 때 `No notices available`로 skip됩니다.
- CI 환경에서는 `PLAYWRIGHT_BASE_URL` 환경 변수로 외부 서버 주소를 지정할 수 있습니다.

```bash
PLAYWRIGHT_BASE_URL=https://your-staging.example.com npm run test:e2e
```

## 배포

이 프로젝트는 `@sveltejs/adapter-cloudflare`와 `wrangler.jsonc`가 설정되어 있어 Cloudflare Pages에 배포할 수 있습니다. 빌드 결과는 `.svelte-kit/cloudflare` 디렉토리에 생성됩니다.

### Cloudflare 대시보드에서 배포

Git 저장소를 Cloudflare Pages에 연결한 뒤 아래 빌드 설정을 입력합니다.

- 루트 디렉토리: `frontend` (저장소 전체를 연결한 경우)
- 빌드 명령어: `npm run build`
- 빌드 출력 디렉토리: `.svelte-kit/cloudflare`
- Node.js 버전: 18 이상

Pages 프로젝트의 **Settings > Variables and Secrets**에서 아래 환경 변수를 설정합니다.

```env
API_BASE_URL=https://your-api.example.com/api
PUBLIC_HASHGUARD_URL=https://hashguard.viento.me
PUBLIC_CF_UNDER_ATTACK_RELOAD_ENABLED=false
```

`API_BASE_URL`은 Cloudflare에서 접근 가능한 백엔드의 공개 HTTPS 주소여야 합니다. 프리뷰 배포와 프로덕션 배포의 API가 다르면 각 환경에 별도로 값을 지정합니다.

### Wrangler CLI로 배포

Cloudflare에 로그인한 뒤 프론트엔드 디렉토리에서 빌드/배포를 진행합니다.

```bash
npm run build
npx wrangler pages deploy
```

`wrangler.jsonc`의 Pages 출력 경로와 `nodejs_compat` 호환성 플래그가 배포 시 자동 적용됩니다.

## 라이선스

MIT License
