# DayDay 환경변수 관리 및 격리 설계서 (Phase 6F)

본 문서는 DayDay 서비스의 출시 및 샌드박스 테스팅 과정에서 보안 자격 증명(Secrets)과 환경 설정을 다중 환경별로 분리하고 보호하기 위한 환경변수 수립 계획서입니다.

---

## 1. 기본 원칙
1. **로컬/스켈레톤 단계 하드코딩 금지**:
   - 현재 단계에서는 실제 환경변수 파일(`.env` 등)을 생성하여 실서버 비밀키 값을 기입하지 않습니다.
   - 모든 변수는 향후 런타임 주입을 대기하는 스키마 형태로 설계합니다.
2. **Git 추적 배제 규칙**:
   - 비밀키와 개발 환경변수가 담기는 파일은 절대로 Git Repository에 업로드하지 않습니다.

---

## 2. 환경변수 스키마 및 노출 범위 정의

SaaS 환경에서 변수들은 **클라이언트 측 노출 가능 변수**와 **서버 측 은닉 기밀 변수**로 엄격하게 이중화 격리됩니다.

### 2.1 클라이언트 사이드 (브라우저 노출 가능)
브라우저 자바스크립트가 직접 읽을 수 있는 식별 정보입니다. 단, Row-Level Security(RLS)가 가동된다는 전제하에 작동합니다.
- **`SUPABASE_URL`**: Supabase 프로젝트 주소 (예: `https://xxxx.supabase.co`).
- **`SUPABASE_ANON_KEY`**: 익명 조회용 키 (RLS가 보안의 가드를 전담).
- **`TOSS_CLIENT_KEY`**: 토스페이먼츠 결제창 연동용 공개 클라이언트 식별자.
- **`KAKAO_CLIENT_ID`**: 카카오 소셜 인증 연결용 앱 아이디.

### 2.2 서버 사이드 (브라우저 노출 절대 엄금)
클라이언트가 절대 알아서는 안 되며, 오직 API/Edge Function 실행 영역 내부의 보안 메모리에만 실려 동작하는 핵심 자격 증명입니다.
- **`SUPABASE_SERVICE_ROLE_KEY`**: 
  - RLS를 완전히 우회하는 어드민 권한의 마스터 키.
  - 브라우저 정적 번들링 결과물(`dist` 또는 정적 js)에 포함되지 않도록 빌드 툴체인 및 소스 참조를 차단합니다.
- **`TOSS_SECRET_KEY`**:
  - 결제 승인 최종 거래 서명 확인용 PG 시크릿 키.
- **`KAKAO_CLIENT_SECRET`**:
  - OAuth 토큰을 카카오 API로부터 교환하기 위한 인증 비밀키.
- **알림톡 발송 API Secret**:
  - 알림톡 공급사(비즈엠, 솔라피 등)와 통신하는 보안 API 자격 증명.

---

## 3. Netlify / Vercel 환경변수 분리 전략

### 3.1 호스팅 플랫폼 설정 위치
- **Netlify**:
  - `Site settings` -> `Environment variables` 메뉴에서 키-값 설정 가능.
  - 빌드 전용 스코프(`Builds`), 서버리스 전용 스코프(`Functions`)를 구분 지정하여 브라우저 유출을 원천 방지할 수 있습니다.
- **Vercel**:
  - `Project Settings` -> `Environment Variables` 메뉴에서 주입 가능.
  - `Production`, `Preview`, `Development` 3개 스코프별로 각각 다른 값을 바인딩하여 환경별 격리 자동화를 지원합니다.

### 3.2 로컬 개발 환경용 격리 (.env)
- 로컬 PC에서 어댑터 개발 검증 시, 정본 폴더 내에 `.env` 또는 `.env.local` 텍스트 파일을 생성하고 환경변수를 구성합니다.
- 빌드 도구 도입 시 `process.env.XXX` 혹은 `import.meta.env.XXX`를 통해 환경변수를 참조하도록 구성하고, 변수 치환 플러그인이 실수로 `SERVICE_ROLE`을 빌드 산출물에 인라인(Inline) 하드코딩해 넣지 않는지 검증 프로세스를 둡니다.

---

## 4. Git 추적 차단 및 .gitignore 점검

실제 자격 증명이 누수되는 주요 경로는 `.env` 파일의 실수에 의한 커밋입니다. 프로젝트 정본의 `.gitignore` 파일에 아래의 자원들이 포함되어 있는지 검토하고 선제 반영합니다.

- **차단 대상 목록**:
  ```gitignore
  # Environment secrets
  .env
  .env.local
  .env.development.local
  .env.test.local
  .env.production.local
  
  # API Credentials keys
  *.pem
  *.key
  ```
---

## 5. 정적 ESM 프로젝트에서의 환경변수 처리 방식 (Phase 6H 추가)

### 5.1 번들러 없는 정적 ESM의 한계
- 본 프로젝트는 Webpack/Vite 등의 번들러 및 빌드 도구를 쓰지 않는 순수 정적 브라우저 ESM 구조입니다.
- 브라우저는 Node.js의 `process.env`를 해석할 수 없으므로, 빌드 타임의 환경변수를 실시간으로 주입하거나 인라인화할 수 없습니다.

### 5.2 런타임 설정 방식 (Runtime Config)
- **`config.js` 또는 `config.json`을 통한 비동기 페치**:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` 같은 **공개 비민감 변수**들을 로컬 JSON 파일(`/config.json` 등) 또는 런타임 글로벌 자바스크립트 객체(`window.APP_CONFIG` 등)에 실어 초기화 시점에 비동기로 수집합니다.
  - 빌드/배포 서버(Netlify/Vercel)에서는 이 `config.json` 파일을 빌드 후 스크립트를 통해 환경변수로부터 동적 생성(Build-time File Generation)하여 public 디렉토리에 위치시킵니다.
- **안전한 기본 거부 가드 (Disabled State)**:
  - 이 `config.json`을 읽지 못하거나, 변수가 비어있는 경우에는 `SupabaseClientFactory`가 `null`을 반환하여 Supabase 기능을 비활성화(`disabled`)하고, 앱 전체가 정지하지 않고 `LocalStorageAdapter` 기반으로 부드럽게 fallback 하도록 설계합니다.

### 5.3 서비스 롤 키 감지 및 초기화 차단
- 브라우저에 배포된 스크립트나 환경 설정(JSON)에 실수로 `service_role` 등의 민감 단어가 매칭되면 `SupabaseClientFactory`가 런타임 레벨에서 강제로 초기화를 중단하고 오류를 발생시켜 기밀 유출을 원천적으로 막습니다.

