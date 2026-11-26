# 법적 고지 판본 관리

## 저장과 표시

- 각 JSON 파일은 고지 본문, 출처, 검토 기준일, 기록일, 변경 요약을 함께 담은 독립적인 판본입니다.
- 공개 전 편집 과정은 이력에 포함하지 않습니다. 최초 본문은 `2026-11-26.1.json`에 보존되어 있으며 변경 요약은 `최초 법적 고지`입니다. `2026-11-26.2.json`의 재이용·권리 요청 보강을 거쳐, 확인된 법령·판례 중심으로 이용 근거를 정리한 `2026-11-26.3.json`에 이어 MIT 오픈소스 배포와 제3자 사이트의 독립 운영·책임 범위를 명시한 현재 판본은 `2026-11-27.1.json`입니다. 기록일은 배포일이나 법적 효력 발생일을 뜻하지 않습니다.
- `../legal-notices.ts`가 등록된 판본을 선택합니다. 배열의 마지막 판본을 `/legal`에서 표시합니다. URL 입력으로 파일을 열거나 외부 저장소에 접근하지 않습니다.
- `/legal/versions/{id}`는 해당 판본의 고정 주소입니다. 알 수 없는 판본에는 최신 본문을 대신 보여주지 않고 HTTP 404를 반환합니다.
- `LegalNoticeDocument.svelte`는 전달받은 판본만 표시합니다. 본문과 과거 판본은 정적으로 import하므로 Cloudflare에서도 런타임 파일시스템이나 별도 데이터베이스가 필요하지 않습니다.

## 새 판본 기록하기

1. 공개 전 초안 수정은 최초 판본에 반영하고 검증 해시를 함께 갱신합니다. **공개한 뒤에는 기존 JSON을 덮어쓰지 않습니다.** 최신 JSON을 새 파일로 복사합니다. 날짜가 같으면 `.2`처럼 순번을 올립니다.
2. 새 파일의 `id`, `recordedOn`, `reviewedOn`, `changeSummary`와 변경할 본문을 수정합니다. `recordedOn`은 기록일이며 배포일·시행일이 아닙니다. `reviewedOn`은 실제 법적 검토 기준일로 유지하거나 검토 후 갱신합니다.
3. 문단은 `paragraphs`에 저장합니다. 일반 문구는 `{ "text": "문구" }`, 링크는 `{ "text": "표시 문구", "href": "주소" }`, 각주는 `{ "source": 1 }` 형식입니다. 원문 HTML을 저장하거나 실행하지 않습니다. 이메일 양식이 필요한 절에는 `emailTemplate`에 `to`, `subject`, `body`를 저장합니다. 이메일 작성 링크는 이 값으로 만들며, 본문 줄바꿈은 `\n`으로 기록합니다.
4. 출처는 각 판본의 `sources`에 함께 보관합니다. `source` 번호는 배열의 1부터 시작하는 순번입니다. 각주 번호와 본문 복귀 링크가 맞도록 한 출처당 한 인용을 유지합니다. 필요한 출처가 바뀌어도 과거 판본의 출처는 수정하지 않습니다.
5. `../legal-notices.ts`에서 새 JSON을 import하고 `notices` 배열 끝에 추가합니다. 고정 주소는 이후에도 바꾸지 않습니다. 이전 파일을 제거하지 않습니다.
6. `e2e/legal-notices.spec.ts`의 `hashes`에 새 판본의 본문 해시를 추가합니다. 해시는 `title`, `intro`, `sections`, `sources`를 이 순서로 담은 객체의 `JSON.stringify` 결과에 SHA-256을 적용합니다. 기존 판본의 해시는 바꾸지 않습니다.
7. `npx playwright test --config playwright-configs/playwright.legal-notices.config.ts`, `npm run check`, `PLAYWRIGHT_BASE_URL=http://localhost:5198 npx playwright test --config playwright-configs/playwright.config.ts e2e/legal.spec.ts --project=chromium`을 실행합니다. 새 현재 판본에 맞춰 브라우저 테스트의 예상 판본을 갱신하되, 기존 판본의 보존 검증은 유지합니다.

## 보존과 되돌리기

각 보관본의 본문·출처 해시는 `e2e/legal-notices.spec.ts`에 고정되어 있습니다. 새 판본을 추가하기 위해 기존 해시를 바꾸지 않습니다. 내용 정정도 기존 판본 수정이 아니라 새 판본 추가로 기록합니다. 공개된 판본을 삭제하거나 순서를 바꾸는 대신, 이전 내용으로 되돌려야 할 때도 그 사유를 담은 새 판본을 추가합니다.

데이터 보존 검증은 기존 E2E와 같은 Playwright TypeScript 형식입니다. 전용 설정은 브라우저나 개발 서버를 시작하지 않으며, 배포 전 단계에서 실행합니다. `tsconfig.legal-tests.json`은 데이터 검증·페이지 E2E·전용 설정을 엄격하게 타입 검사합니다. TypeScript 6과 네이티브 컴파일러 모두 `--project tsconfig.legal-tests.json`으로 검사합니다.
