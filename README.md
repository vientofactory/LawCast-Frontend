# LawCast 프론트엔드

LawCast 서비스의 웹 프론트엔드 애플리케이션입니다. SvelteKit 프레임워크를 기반으로 구축되었으며, 사용자가 디스코드 웹훅을 등록하고 입법예고 정보를 확인할 수 있는 인터페이스를 제공합니다.

## 기능

- **웹훅 등록**: 디스코드 웹훅 URL 등록 및 관리
- **최근 공지 조회**: 입법예고 변동사항 실시간 확인
- **시스템 통계**: 웹훅 및 캐시 상태 모니터링
- **반응형 디자인**: 모바일 친화적인 UI
- **reCAPTCHA 통합**: 봇 방지 검증

## 기술 스택

- **프레임워크**: SvelteKit
- **언어**: TypeScript
- **스타일링**: Tailwind CSS
- **아이콘**: Lucide Svelte
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

### 빌드

```bash
npm run build
```

### 미리보기

```bash
npm run preview
```

## 프로젝트 구조

```
src/
├── lib/
│   ├── components/     # 재사용 가능한 컴포넌트
│   ├── api/           # API 클라이언트
│   ├── types/         # 타입 정의
│   └── utils/         # 유틸리티 함수
├── routes/            # 페이지 라우트
│   ├── +page.svelte   # 메인 페이지
│   └── notices/       # 공지 페이지
└── app.html           # HTML 템플릿
```

## 환경 설정

필요한 경우 `.env` 파일을 생성하여 API 엔드포인트 등을 설정할 수 있습니다.

```env
# API 베이스 URL
VITE_API_BASE_URL=http://localhost:3000
PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
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

빌드된 파일은 `build/` 디렉토리에 생성됩니다. Node.js 어댑터를 사용하여 서버에 배포할 수 있습니다.

## 라이선스

MIT License
