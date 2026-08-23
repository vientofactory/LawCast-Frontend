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
