# DayDay 출시 전 보안 체크리스트

## 1. 문서 목적

이 문서는 DayDay 음악학원 MVP를 실제 고객에게 배포하기 전에 반드시 점검하고 제거해야 할 보안 부채를 정리한다. 현재 프로젝트는 프로토타입 단계이므로 데모 데이터, localStorage 저장, 기본 PIN, 하드코딩된 관리자 값이 일부 남아 있을 수 있다. 이 항목들은 개발 중에는 허용될 수 있지만, 배포 전에는 반드시 제거하거나 운영용 구조로 교체해야 한다.

DayDay는 이후 일반 학원, 개인 레슨, 헬스장, 소규모 F&B 등으로 확장될 수 있으므로, 여기의 보안 원칙은 음악학원 버전뿐 아니라 모든 업종 버전에 공통 적용한다.

## 2. 현재 상태 요약

- 현재 앱은 정적 HTML/CSS/ES modules 기반이며, `server.js`는 파일 서빙 역할을 한다.
- 현재 데이터는 브라우저 `localStorage`에 저장된다.
- `src/js/state.js`와 `src/js/state/*.js`는 프로토타입용 기본 데이터를 포함한다.
- 원장, 강사, 학부모/학생 화면은 분리되어 있으나 서버 API 레벨의 권한 검증은 아직 없다.
- GitHub 연동 초기 설정 과정에서 Personal Access Token이 노출된 이력이 있다.
- 일부 기본 PIN과 관리자 우회값이 코드에 남아 있다.

## 3. 반드시 배포 전 처리할 항목

| 우선순위 | 항목 | 현재 상태 | 배포 전 조치 | 담당 Phase |
|---|---|---|---|---|
| Critical | GitHub token 노출 이력 | 초기 연동 과정에서 `ghp_...` 형태 토큰이 노출된 이력 있음 | GitHub에서 해당 토큰 Revoke/Delete, remote URL 토큰 제거 | 즉시 |
| Critical | 하드코딩 관리자 PIN | 조치 완료 (동적 태블릿 비밀번호로 변경됨) | 하드코딩 제거, 사업장 설정(`tabletPassword`) 기반 인증으로 대체 완료 | Phase 4.5 |
| High | 기본 비밀번호 `0000` | 데모용 시스템/태블릿 PIN 기본값 존재 | 최초 설정 플로우 도입, 운영 모드에서 기본값 금지 | Phase 5 또는 배포 전 |
| High | localStorage 민감정보 저장 | 데모 데이터가 브라우저 저장소에 보관됨 | 실제 고객/결제/개인정보는 서버 DB와 권한 체계로 이전 | 배포 전 |
| High | 평문 비밀번호/PIN 저장 | 문자열 비교 또는 평문 저장 가능성 존재 | 운영 환경에서는 인증 제공자, 해시, 서버 검증 구조 사용 | DB 전환 시 |
| Medium | 백업 파일 잔존 | `.backup`, `.bak`, `.old` 파일이 남을 수 있음 | `.gitignore` 적용 및 커밋 전 검색/삭제 | 즉시 |
| Medium | 역할/권한 검증 부족 | 화면 분리 중심, API 레벨 권한 없음 | 원장/매니저/강사/학부모/학생/키오스크 권한 분리 | DB/API 도입 시 |

## 4. 확인된 프로토타입 보안 부채

### 4.1 GitHub token 노출 이력

초기 GitHub remote 설정 과정에서 Personal Access Token을 remote URL에 포함한 이력이 있다. `ghp_...` 형태의 토큰이 채팅, 터미널 출력, 보고서, 문서, 커밋 기록에 한 번이라도 노출되면 더 이상 안전하지 않은 것으로 간주한다.

배포 전 조치:

- GitHub 웹 설정에서 노출된 토큰을 즉시 Revoke/Delete 한다.
- `.git/config`와 `git remote -v` 출력에서 토큰이 포함되어 있지 않은지 확인한다.
- remote URL은 토큰 없는 HTTPS 또는 SSH 방식으로 재설정한다.
- 문서에는 실제 토큰 원문을 절대 기록하지 않고 `ghp_***` 또는 `<REDACTED_TOKEN>`처럼 마스킹한다.

### 4.2 기본 비밀번호 `0000`

현재 데모 데이터에는 시스템 비밀번호 또는 태블릿 비밀번호 기본값으로 `0000`이 사용된다. 데모 단계에서는 빠른 검증을 위해 허용될 수 있으나, 실제 운영 환경에서는 위험하다.

배포 전 조치:

- 학원/사업장 생성 시 원장이 직접 시스템 PIN과 태블릿 PIN을 설정하도록 한다.
- 운영 모드에서는 빈 값, `0000`, `1234` 같은 약한 기본값을 허용하지 않는다.
- PIN 변경 이력과 최소 검증 규칙을 둔다.
- 실제 DB 전환 시 PIN/비밀번호를 평문으로 저장하지 않는다.

### 4.3 하드코딩 관리자 비밀번호 (조치 완료)

`src/js/views/director.js`에 존재했던 키오스크 모드 해제용 하드코딩 PIN(`ADMIN_PASSWORD = '6990'`)은 Phase 4.5에서 완전히 제거되었습니다.

조치 결과:
- `attendanceView.js` 내에 하드코딩 패스워드를 제거하고, 로그인된 원장의 소속 학원 `tabletPassword`를 실시간으로 조회하여 매칭하는 구조로 대체하였습니다.
- 이로써 코드 노출로 인한 보안 위협을 해결하였습니다.

### 4.4 백업 파일 커밋 위험

`director.js.backup` 같은 파일에는 이전 코드, 임시 비밀번호, 토큰, 고객 정보가 남아 있을 수 있다. 백업 파일은 커밋 대상에서 제외해야 한다.

권장 `.gitignore` 규칙:

```gitignore
*.backup
*.bak
*.old
```

배포 전 조치:

- 백업 파일이 Git에 추적되고 있는지 확인한다.
- 이미 추적 중이면 `git rm --cached`로 인덱스에서 제거한다.
- 커밋 전 민감정보 검색을 수행한다.

### 4.5 localStorage 데이터 저장

현재 localStorage는 MVP 데모와 빠른 프로토타입 검증에는 적합하다. 하지만 실제 고객 데이터, 결제 정보, 학생/학부모 정보, 직원 정보 저장에는 적합하지 않다.

배포 전 조치:

- 실제 고객 데이터는 서버 DB로 이전한다.
- 인증/권한/백업/복구 정책을 마련한다.
- localStorage에는 운영 민감정보를 저장하지 않는다.
- DB 전환 전까지는 데모/테스트용 데이터만 사용한다.

### 4.6 평문 비밀번호/PIN 저장

현재 프로토타입은 PIN이나 비밀번호를 문자열로 비교할 수 있다. 운영 환경에서는 평문 저장과 클라이언트 검증만으로는 충분하지 않다.

배포 전 조치:

- 사용자 비밀번호는 인증 제공자 또는 안전한 해시 기반으로 처리한다.
- PIN도 서버 검증 또는 해시 저장 구조를 검토한다.
- 클라이언트 코드에 인증 우회값을 넣지 않는다.

### 4.7 역할/권한 검증 부족

원장, 강사, 학부모/학생 화면이 분리되어 있어도 그것만으로 권한이 보장되지는 않는다. 서버 DB와 API가 도입되면 데이터 접근 권한을 반드시 검증해야 한다.

배포 전 조치:

- 원장, 매니저, 강사, 학부모/학생, 태블릿/키오스크 역할을 분리한다.
- 강사는 본인 수업과 담당 원생 범위만 접근한다.
- 학부모는 본인 자녀 정보만 접근한다.
- 매니저는 상담, 수납, 일정 등 권한을 세분화한다.
- Supabase/PostgreSQL 전환 시 RLS 또는 API 레벨 권한 검증을 설계한다.

## 5. 배포 전 필수 명령어

### Git remote 확인

```powershell
git remote -v
```

정상 예시:

```txt
origin  https://github.com/charmingriv-sys/2605_dayday.git (fetch)
origin  https://github.com/charmingriv-sys/2605_dayday.git (push)
```

### 토큰 없는 remote로 재설정

```powershell
git remote set-url origin https://github.com/charmingriv-sys/2605_dayday.git
```

또는 SSH 사용 시:

```powershell
git remote set-url origin git@github.com:charmingriv-sys/2605_dayday.git
```

### 민감정보 검색

`rg`가 없는 Windows PowerShell 환경에서는 아래 명령을 사용한다.

```powershell
Get-ChildItem -Recurse -File |
  Where-Object {
    $_.FullName -notmatch "\\.git\\" -and
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\dist\\" -and
    $_.FullName -notmatch "\\build\\"
  } |
  Select-String -Pattern "ghp_|github_pat_|BEGIN .*PRIVATE KEY|api[_-]?key|secret|token|password"
```

### Git 상태 확인

```powershell
git status --short
```

### 백업 파일 확인

```powershell
Get-ChildItem -Recurse -File |
  Where-Object {
    $_.Name -match "\.(backup|bak|old)$"
  }
```

### 백업 파일이 이미 Git에 추적되는지 확인

```powershell
git ls-files "*.backup" "*.bak" "*.old"
```

추적 중인 파일이 있을 때만 아래 명령을 사용한다.

```powershell
git rm --cached <파일경로>
```

## 6. Phase 4 진행 중 주의할 보안 규칙

1. `director.js` 분리 중 하드코딩된 PIN, 관리자 우회값, 테스트용 인증값을 새 파일로 그대로 복사하지 않는다.
2. 새 뷰 파일은 `stateStore.db`에 직접 접근하지 않는다.
3. 인증/권한/보안 관련 처리는 별도 API 또는 설정 계층으로 분리할 수 있도록 표시한다.
4. 데모용 값과 운영용 값을 주석이나 문서에서 명확히 구분한다.
5. 업종 공통으로 재사용할 보안 원칙은 `pj_daday_skill.md`에 반영한다.
6. Git 작업 전에는 항상 민감정보 검색과 `git status --short` 확인을 수행한다.

## 7. Phase 5 또는 배포 전 해결 권장 순서

1. GitHub 노출 토큰 폐기 및 remote URL 정리
2. `.gitignore` 백업 파일 규칙 적용 및 백업 파일 추적 제거
3. 하드코딩 관리자 PIN 제거
4. 기본 PIN `0000` 제거 및 최초 설정 플로우 도입
5. localStorage 운영 데이터 저장 금지 정책 수립
6. 서버 DB, 인증, 권한 구조 설계
7. 평문 비밀번호/PIN 저장 제거
8. 역할별 접근 제어 테스트 작성
## 8. 최종 배포 가능 판정 기준

배포 가능으로 판단하려면 최소한 아래 조건을 만족해야 한다.

- GitHub remote URL에 토큰이 없다.
- 노출된 Personal Access Token은 GitHub에서 폐기되어 있다.
- 소스코드와 문서에 실제 토큰, API key, 비밀키가 없다.
- `.backup`, `.bak`, `.old` 파일이 커밋되지 않는다.
- 운영 모드에서 기본 PIN `0000`이 허용되지 않는다.
- 하드코딩 관리자 PIN이 제거되어 있다.
- 실제 고객 데이터는 localStorage에 저장하지 않는다.
- 원장/매니저/강사/학부모/학생/키오스크 권한 경계가 문서화되어 있다.
- 서버 DB 전환 시 API 또는 RLS 수준의 권한 검증 계획이 있다.

## 9. Supabase 연동 보안 지침 (Phase 6D/6E 추가)

- **`SUPABASE_ANON_KEY` 노출 통제**: 익명 클라이언트 키는 공개가 가능하지만, 모든 테이블에 Row-Level Security(RLS) 정책이 안전하게 걸려 있어야 데이터 탈취를 예방할 수 있다. RLS 적용 확인 전까지는 Anon Key를 활성화 배포하지 않는다.
- **기본 차단 정책 (Default Deny) 적용**: 모든 테이블에 RLS를 활성화(`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)하여, 별도의 명시적 허용 정책(Policy)이 정의되지 않은 모든 조작 요청을 기본적으로 차단하게 설계한다.
- **`SUPABASE_SERVICE_ROLE_KEY` 브라우저 유출 차단**: 이 키는 RLS를 완전 우회하므로, 클라이언트 번들에 절대 포함시키지 않는다. 반드시 백엔드/서버리스 Edge Functions에서만 사용하여 보안을 격리한다.
- **기타 타사 Secret**: Toss Payments, 알림톡 API 시크릿 등의 결제/통신 비밀키 역시 브라우저에 유출되지 않도록 서버리스 함수(Edge Functions) 환경변수 내부에서만 실행되도록 규정한다.
- **태블릿/키오스크용 권한 마스킹**: 키오스크 브라우저에서 구동하는 클라이언트가 원생 전체 테이블에 접근하지 못하도록, 검색용 최소 필드만 반환하는 전용 데이터베이스 뷰(VIEW)를 구성해 격리한다.
- **빌드 파이프라인 환경변수 격리 (Phase 6F 추가)**: Netlify/Vercel 호스팅 설정 상에서 `SUPABASE_SERVICE_ROLE_KEY` 또는 PG 시크릿 키 등을 세팅할 때, 빌드 시점 변수 치환 도구(Webpack EnvironmentPlugin, Vite define 등)가 해당 민감 키들을 클라이언트 사이드 자바스크립트 소스코드 영역에 인라인 문자열로 구워 넣지(Embed) 않도록 차단 필터를 둔다.
- **클라이언트 쓰기 컨텍스트 및 감사로그 의존성 검증 (Phase 6J 추가)**:
  - 브라우저 클라이언트가 Supabase 팩토리에 `service_role` 키를 입력할 경우 즉시 예외를 발생시키며 초기화를 거부하는 가드가 실시간 작동합니다.
  - 모든 DB 쓰기 트랜잭션 수행 시 `organizationId`/`academyId`, `authUserId`, `role` 정보의 존재성 및 정합성을 체크하여 부실한 쿼리 발행을 미연에 방지합니다.
  - 민감한 데이터 영역(수납 및 출결)의 쓰기 메서드 호출 시 데이터베이스 감사로그(`audit_logs` 테이블) 연동을 보증하며, 로그의 임의 수정(UPDATE/DELETE)이 불가능하도록 인서트 전용(Insert Only) 정책을 엄격히 규정합니다.