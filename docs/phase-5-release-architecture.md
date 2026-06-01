# DayDay 출시형 아키텍처 설계 및 데이터 전환 전략 (Phase 5)

본 문서는 DayDay 음악학원 MVP를 실제 고객이 신뢰하고 사용할 수 있는 SaaS 제품으로 전환하기 위한 DB, 인증, 권한, 배포 구조와 점진적 마이그레이션 전략을 정의한다. 현재 프로젝트는 localStorage 기반의 프로토타입이지만, Phase 3~4.5를 거치며 StateStore와 View 레이어가 분리되어 서버 DB 전환을 준비할 수 있는 기반을 갖추었다.

## 1. 현재 localStorage 구조 평가

현재 DayDay는 브라우저 `localStorage`와 `src/js/state.js`의 메모리 캐시를 결합해 데이터를 관리한다.

### 1.1 MVP 검증에 적합했던 이유

- 백엔드 서버와 DB 없이 정적 파일 서빙만으로 원장, 강사, 학부모 흐름을 빠르게 검증할 수 있었다.
- 모든 데이터가 로컬에 있으므로 화면 렌더링 속도가 빠르고 네트워크 지연이 없다.
- 새로고침 후에도 데모 데이터가 유지되어 프로토타입 시연에 유리하다.
- Phase 3 이후 `stateStore` Public API 중심으로 접근하면서 뷰 레이어가 내부 DB 구조에 덜 묶이게 되었다.

### 1.2 실제 배포에는 부족한 이유

- 브라우저 캐시 삭제, 기기 변경, 시크릿 모드 사용 시 데이터가 유실될 수 있다.
- 원장, 강사, 학부모가 여러 기기에서 같은 데이터를 공유할 수 없다.
- 학생/학부모 연락처, 결제 내역, 출결 기록 같은 개인정보를 localStorage에 장기 보관하는 것은 부적합하다.
- 권한 없는 사용자가 브라우저 개발자 도구를 통해 데이터를 보거나 조작할 수 있다.
- 백업, 복구, 감사로그, 권한 추적이 어렵다.

### 1.3 배포 전 localStorage에 저장하면 안 되는 데이터

- 실제 학생/학부모/강사 개인정보
- 실제 결제 승인 정보와 PG secret key
- 인증 토큰, refresh token, 관리자 PIN, 시스템 비밀번호
- 사업자 정보, 정산 정보, 민감한 상담 기록

### 1.4 현재 구조의 장점과 한계

장점:

- Phase 4.5 기준으로 뷰 레이어의 `stateStore.db` 직접 접근이 제거되었다.
- 화면은 `stateStore.getStudents()`, `stateStore.getPayments()` 같은 Public API를 통해 데이터를 가져온다.
- 이 구조 덕분에 화면 전체를 한 번에 다시 만들지 않고도 StateStore 내부 데이터 공급 방식을 교체할 수 있다.

한계:

- 현재 Public API는 대부분 동기 반환 방식이다.
- Supabase/PostgreSQL 같은 서버 DB는 네트워크 I/O가 필요하므로 기본적으로 비동기다.
- 뷰 전체를 한 번에 `async/await`로 바꾸는 것은 리스크가 크다.
- 따라서 StateStore 내부에 adapter 계층과 메모리 캐시를 두는 점진적 전환이 필요하다.

## 2. DB 후보 비교 및 추천

| 후보 | 장점 | 한계 | DayDay 적합도 |
|---|---|---|---|
| Supabase + PostgreSQL | 관계형 데이터, Auth, RLS, SQL, 백업/확장성 | RLS 설계 학습 필요, 요금/쿼터 확인 필요 | 매우 높음 |
| Firebase Firestore | 빠른 시작, 실시간 동기화, Auth | 관계형 조인/정산/수납 모델이 복잡해질 수 있음 | 중간 |
| Netlify Blobs / Functions | 정적 앱과 결합 쉬움, 단순 저장에 적합 | 관계형 데이터/권한/복잡한 쿼리에 한계 | 낮음 |
| 자체 Node/Express + PostgreSQL | 가장 자유로운 구조 | 서버 운영, 보안, 배포, 유지보수 부담 큼 | 중간 |
| localStorage 유지 | 구현 없음, 빠른 데모 | 실제 배포 불가 수준의 데이터/권한 한계 | 데모 한정 |

### 2.1 추천안: Supabase + PostgreSQL

DayDay는 학원, 사용자, 원생, 강사, 학부모 연결, 수업, 출결, 청구, 결제, 보강 같은 관계형 데이터가 많다. 따라서 PostgreSQL 기반이 적합하다. Supabase는 PostgreSQL, Supabase Auth, Row Level Security(RLS)를 함께 사용할 수 있어 소규모 SaaS MVP에 적합하다.

단, 문서에는 특정 무료 제공량을 고정값처럼 쓰지 않는다. Supabase와 Netlify/Vercel 요금제는 변동될 수 있으므로 실제 도입 전 공식 가격 페이지에서 최신 조건을 확인한다.

## 3. 테넌트 구조 설계

DayDay는 여러 학원 또는 사업장이 함께 사용할 수 있는 multi-tenant SaaS를 지향한다. 모든 주요 테이블에는 `academy_id` 또는 `organization_id`가 있어야 한다.

### 3.1 핵심 테이블 후보

| 테이블 | 역할 | 주요 필드 후보 |
|---|---|---|
| `academies` 또는 `organizations` | 학원/사업장 루트 | `id`, `name`, `phone`, `owner_user_id`, `invite_code`, `settings` |
| `users` | 인증 사용자 프로필 | `id`, `auth_user_id`, `academy_id`, `role`, `name`, `phone`, `provider` |
| `organization_members` | 사용자-조직 멤버십 | `id`, `organization_id`, `user_id`, `role`, `status` |
| `students` | 원생/회원 | `id`, `academy_id`, `name`, `phone`, `status`, `teacher_id` |
| `parent_student_links` | 학부모-자녀 연결 | `id`, `academy_id`, `parent_user_id`, `student_id` |
| `teachers` | 강사/직원 | `id`, `academy_id`, `user_id`, `name`, `subjects`, `status` |
| `classes` 또는 `sessions` | 수업/일정 | `id`, `academy_id`, `student_id`, `teacher_id`, `date`, `start_time`, `duration` |
| `attendance` | 출결 기록 | `id`, `academy_id`, `student_id`, `session_id`, `status`, `checked_at` |
| `payments` | 청구/수납 | `id`, `academy_id`, `student_id`, `amount`, `status`, `due_date`, `paid_at` |
| `announcements` | 공지 | `id`, `academy_id`, `target_role`, `title`, `body`, `created_by` |
| `audit_logs` | 중요 변경 기록 | `id`, `academy_id`, `actor_user_id`, `action`, `entity`, `created_at` |

### 3.2 데이터 격리 원칙

- 원장은 자기 학원 전체 데이터를 볼 수 있다.
- 매니저는 학원 운영 데이터를 보되, 핵심 설정과 보안 설정은 제한할 수 있다.
- 강사는 자기 담당 수업과 원생 범위만 볼 수 있다.
- 학부모는 본인 자녀 정보만 볼 수 있다.
- 키오스크/태블릿은 출결 입력에 필요한 최소 권한만 가진다.
- Super Admin은 운영 장애 대응용으로 최소한의 접근 원칙을 따른다.

## 4. 인증/권한 구조

화면이 나뉘었다고 보안이 보장되는 것은 아니다. 실제 배포에서는 Supabase Auth 또는 동등한 인증 시스템과 DB/RLS/API 레벨 권한 검증이 필요하다.

| 역할 | 볼 수 있는 데이터 | 수정 가능한 데이터 | 금지해야 할 작업 |
|---|---|---|---|
| Owner / Director | 소속 학원 전체 데이터 | 설정, 원생, 강사, 수납, 공지, 출결 | 타 학원 데이터 접근 |
| Manager | 운영에 필요한 학원 데이터 | 상담, 수납, 원생, 일정 일부 | 보안 설정, 시스템 PIN 변경 제한 가능 |
| Teacher | 담당 수업/원생 | 출결, 수업일지, 코멘트 | 전체 매출, 타 강사/타 원생 개인정보 |
| Parent | 본인 자녀 데이터 | 결제, 설문 응답, 일부 요청 | 타 학생 정보, 원장/강사 내부 기록 |
| Student | 본인 출결/과제 일부 | 제한적 응답 | 결제/설정/타인 정보 |
| Kiosk / Tablet | 출결 입력에 필요한 최소 데이터 | 등원/하원 입력 | 개인정보 전체 조회, 수납/설정 접근 |
| Super Admin | 장애 대응에 필요한 최소 범위 | 긴급 복구, 운영 점검 | 고객 데이터 무단 열람 |

## 5. StateStore 전환 전략

추천 구조는 adapter 패턴이다.

```txt
View Layer
  -> StateStore Public API
    -> Memory Cache
      -> DataAdapter Interface
        -> LocalStorageAdapter 또는 SupabaseAdapter
```

### 5.1 권장 이유

- 기존 View 코드를 한 번에 비동기화하지 않아도 된다.
- 현재 동기 Public API 형태를 최대한 유지할 수 있다.
- 초기에는 localStorageAdapter를 유지하면서 구조만 분리할 수 있다.
- 이후 SupabaseAdapter를 붙여 읽기/쓰기 API를 단계적으로 원격화할 수 있다.
- 오프라인 또는 네트워크 불안정 상황에 대한 캐시 전략을 넣기 쉽다.

### 5.2 adapter 인터페이스 후보

```js
export class DataAdapter {
  async loadInitialData(context) { throw new Error('Not implemented'); }
  async fetchStudents(academyId) { throw new Error('Not implemented'); }
  async saveStudent(academyId, student) { throw new Error('Not implemented'); }
  async fetchPayments(academyId) { throw new Error('Not implemented'); }
  async savePayment(academyId, payment) { throw new Error('Not implemented'); }
  async fetchAttendance(academyId, params) { throw new Error('Not implemented'); }
  async saveAttendance(academyId, attendance) { throw new Error('Not implemented'); }
}
```

### 5.3 초기 운영 방식

- 앱 시작 시 adapter가 필요한 데이터를 비동기로 로드한다.
- StateStore는 메모리 캐시에 데이터를 보관한다.
- View는 기존처럼 StateStore Public API를 호출한다.
- 쓰기 작업은 메모리 캐시를 먼저 갱신하고 UI를 즉시 갱신한다.
- 이후 adapter가 서버 저장을 수행한다.
- 실패 시 동기화 실패 큐 또는 재시도 정책을 둔다.

## 6. 마이그레이션 단계

1. DEFAULT_DB 구조와 현재 Public API 목록을 스키마 문서로 정리한다.
2. `docs/supabase-schema-draft.sql`에 테이블 DDL 초안을 작성한다.
3. DataAdapter 인터페이스를 설계한다.
4. 현재 localStorage 입출력을 LocalStorageAdapter로 격리한다.
5. StateStore가 adapter를 통해 데이터를 로드/저장하도록 내부 구조를 바꾼다.
6. SupabaseAdapter를 실험적으로 추가한다.
7. 읽기 API부터 Supabase로 전환한다.
8. 쓰기 API를 write-through 방식으로 전환한다.
9. 인증/권한/RLS를 연결한다.
10. localStorage는 데모/캐시/오프라인 보조 용도로 축소한다.
11. 실제 고객 데이터 입력 전 보안 검증을 수행한다.

## 7. 보안 및 개인정보 원칙

- GitHub token, PG secret key, API key는 코드와 문서에 기록하지 않는다.
- Supabase anon key는 공개 가능한 클라이언트 키지만, RLS가 없으면 위험하므로 RLS 정책을 반드시 설계한다.
- service role key는 절대 브라우저로 전달하지 않는다.
- Toss Payments, Kakao Alimtalk, Naver/Google OAuth secret은 서버리스 함수 또는 서버 환경변수에만 둔다.
- 기본 PIN `0000`은 배포 전 제거하거나 최초 설정 플로우로 대체한다.
- 비밀번호/PIN은 운영 환경에서 평문 저장하지 않는다.
- `.backup`, `.bak`, `.old` 파일은 커밋하지 않는다.
- 학부모/학생 개인정보는 localStorage에 저장하지 않는다.

## 8. 배포 후보 비교

| 후보 | 장점 | 한계 | 추천도 |
|---|---|---|---|
| Netlify | 정적 앱 배포 쉬움, Forms/Functions/환경변수 지원, preview 배포 편함 | 사용량/크레딧 정책 확인 필요 | 높음 |
| Vercel | 프론트 배포와 preview 경험 우수 | 함수/과금 정책 확인 필요 | 높음 |
| Supabase Hosting 연계 | DB/Auth와 같은 플랫폼에서 관리 가능 | 프론트 호스팅 선택지는 별도 검토 필요 | 중간 |
| GitHub Pages | 간단한 정적 배포 | 환경변수/서버리스/API에 약함 | 낮음 |
| 자체 VPS | 자유도 높음 | 운영/보안/백업 부담 큼 | 낮음 |

추천 조합:

- 초기 MVP 프론트: Netlify 또는 Vercel
- DB/Auth: Supabase
- 서버리스 비즈니스 로직: Supabase Edge Functions 또는 Netlify Functions
- 결제 승인/알림톡 발송: 반드시 서버리스 함수에서 처리

## 9. Phase 6 구현 계획

### Phase 6A: DB 스키마 DDL 초안 작성 (완료)

- **목표**: Supabase/PostgreSQL 테이블 초안 작성
- **산출물**: [supabase-schema-draft.sql](file:///c:/Users/charm/OneDrive/문서/2605_dayday/docs/supabase-schema-draft.sql) 및 [supabase-schema-notes.md](file:///c:/Users/charm/OneDrive/문서/2605_dayday/docs/supabase-schema-notes.md) 작성 완료
- **검증**: PostgreSQL DDL 문법 및 복잡한 RLS 정책 후보 시나리오, Soft Delete, 인덱싱 설계 완료

### Phase 6B: DataAdapter 인터페이스 설계 (완료)

- **목표**: StateStore와 저장소 구현을 분리하기 위한 추상 데이터 어댑터 설계
- **산출물**: [dataAdapter.js](file:///c:/Users/charm/OneDrive/문서/2605_dayday/src/js/state/adapters/dataAdapter.js) 생성 완료
- **검증**: `initialize()`, `loadSnapshot()`, `saveSnapshot()`, `fetchAllDomainData()`, `persistDomain()`, `writeAuditLog()` 등 코어 수명주기 정의 및 `context` 인자 설계 완료

### Phase 6C: LocalStorageAdapter 분리 (완료)
 
- **목표**: 현재 `localStorage` 로드/저장 로직을 `LocalStorageAdapter`로 이동
- **1차 범위**: 모든 세부 도메인 API 구현이 아닌, `loadSnapshot`/`saveSnapshot` 중심의 일괄 저장 구조 분리에 1차 우선순위 부여
- **산출물**: `src/js/state/adapters/localStorageAdapter.js` 생성 및 `state.js` 통합 완료
- **검증**: 기존 화면 동작 방식 및 smoke test 정합성 100% 유지 확인

### Phase 6D: SupabaseAdapter 실험 (완료: 스켈레톤 및 문서화)
 
- **목표**: 실제 Supabase 연동 전 adapter 골격 작성
- **산출물**: `src/js/state/adapters/supabaseAdapter.js` 골격 구현 및 `docs/supabase-adapter-plan.md` 수립 완료
- **검증**: 환경변수/키 하드코딩 없음, 외부 client 주입 설계, StateStore 미연결 유지
- **다음 단계**: 향후 mock 또는 실제 client 주입 실험 예정

### Phase 6E: 인증/권한 연결 계획 (완료: 설계서 및 DDL DRAFT 수립)
 
- **목표**: Supabase Auth, user profile, role, organization membership 연결 및 RLS 정책 설계
- **산출물**: `docs/auth-rls-plan.md` 및 `docs/supabase-rls-policy-draft.sql` 작성 완료
- **검증**: 원장/매니저/강사/학부모/태블릿 권한 매트릭스 도출 및 PostgreSQL RLS 구문 초안 설계 완료
- **다음 단계**: 실제 인증 로직 연동 설계 준비 완료 (연결 코드는 StateStore 미결합 유지)

### Phase 6I: SupabaseAdapter Mock Client 주입 테스트 및 Read-Only 매핑 준비 (완료)
 
- **목표**: 실제 서버 연결 없이 Mock Client를 활용한 SupabaseAdapter 읽기 전용 매핑 구조 검증
- **산출물**: `scratch/supabase_adapter_mock_test.mjs` 생성 및 `supabaseAdapter.js` 내 read-only 쿼리 함수 구현 완료
- **검증**: organizations/students/teachers/payments 등의 snake_case -> camelCase 맵핑 및 `academyId`/`organizationId` 별칭 바인딩 검증용 모킹 테스트 통과 완료
- **결과**: 기존 LocalStorageAdapter를 기본으로 하는 동기 MVP 작동 방식 유지 및 에러 복구/비활성 fallback 확인 완료

### Phase 6I.5: SupabaseAdapter Read-Only 구현 정합성 정리 (완료)
 
- **목표**: 쓰기 기능 추가 전 어댑터 읽기 모듈 정리 및 오류 복구 정책 고도화
- **산출물**: `src/js/state/adapters/supabaseAdapter.js` 중복 코드 리팩토링 및 테스트 로깅 출력 정돈 완료
- **검증**: `resolveOrganizationId` 예외 처리 차단, Mock 테스트 보안 위반 로그 가림 처리 및 smoke test 최종 구동 확인

### Phase 6J: SupabaseAdapter Write Contract 및 감사로그 Mock 구현 (완료)

- **목표**: 실제 DB 연결 없이 Mock Client를 사용하여 SupabaseAdapter의 쓰기 메서드 계약과 감사로그 연동 방식을 설계 및 검증
- **산출물**: `src/js/state/adapters/supabaseAdapter.js` 내 upsert 기반 쓰기 후보 메서드 구현, `scratch/supabase_adapter_mock_test.mjs` 검증 기능 확장
- **검증**:
  - `saveStudent()`, `saveTeacher()`, `savePaymentRecord()`, `saveAttendanceRecord()` 호출 시 camelCase -> snake_case 매핑 및 `organization_id` 바인딩 검증 완료
  - 결제(`payments`) 및 출결(`attendance`) 정보 변경 트랜잭션 시 감사로그(`audit_logs`) 자동 연동 기록 및 `INSERT` 전용 규격 준수 확인
  - `organizationId`/`academyId`, `authUserId`, `role` 필수 값에 대한 `_validateWriteContext` 검증 가드 구현 및 Mock 테스트를 통한 오작동/유실 차단 성공
  - 기존 `LocalStorageAdapter` 기반 MVP의 동기 런타임에 아무런 영향을 주지 않는 격리 설계 유지

### Phase 6K: 전체 기능 자동 점검기 구축 (완료)

- **목표**: 개발 단계에서 핵심 기능이나 아키텍처가 손상되었는지 검증하기 위한 통합 자동 점검 체계를 마련
- **산출물**:
  - `tests/` 디렉터리 구성 및 스모크 테스트(`tests/unit/state_smoke_test.mjs`), 어댑터 Mock 계약 검증(`tests/unit/supabase_adapter_mock_test.mjs`), 보안 검사기(`tests/security/security_scan_test.mjs`) 이동 및 배치
  - 통합 실행 스크립트(`npm run test:all`) 및 `package.json` 신규 초기화
- **검증**:
  - `test:state`를 통한 StateStore의 핵심 12개 Public API 바인딩 테스트 성공
  - `test:supabase-adapter`를 통한 DB 모델 데이터 매핑 및 멀티 테넌트 격리/보안 검사 통과
  - `test:security`를 이용해 실제 API 토큰 및 시크릿 키 유출 여부를 정적 스캔 완료
  - 로컬 테스트 실행 리포트(`tests/reports/latest-test-report.md`) 자동 생성

### Phase 6L: 브라우저 화면 자동 테스트 구축 (완료)

- **목표**: 원장/강사/학부모/키오스크 핵심 화면이 브라우저에서 깨지지 않는지 자동으로 확인하는 E2E 테스트 기반을 구축
- **산출물**:
  - Playwright 프레임워크 도입 및 `devDependencies` 패키지 추가
  - `playwright.config.js` 작성 및 로컬 개발용 `server.js` 서버 생명주기 자동화 결합
  - `tests/e2e/app-load.spec.js` (기본 로드 및 콘솔 에러 모니터링), `tests/e2e/role-entry.spec.js` (역할군별 사이드바 활성화 여부), `tests/e2e/director-flow.spec.js` (대시보드 렌더링 및 모달 열림 검사) 테스트 스펙 추가
- **검증**:
  - `test:e2e` 실행을 통해 로컬 서버 기반 Chromium E2E 시나리오 6개 검사 100% 통과 완료
  - 통합 실행 스크립트 `test:full` 추가 (`npm run test:all && npm run test:e2e`)

## 10. Phase 5 결론

Phase 5의 추천 방향은 다음과 같다.

```txt
DB: Supabase + PostgreSQL
Auth: Supabase Auth
Authorization: PostgreSQL RLS + application role mapping
Hosting: Netlify 또는 Vercel
Serverless: Supabase Edge Functions 또는 Netlify Functions
StateStore 전환: DataAdapter + Memory Cache + 점진적 SupabaseAdapter
자동 검증: tests/ 스위트를 통한 배포 전 무결성 및 E2E 브라우저 체크리스트 실행
```

Phase 6에서는 바로 대규모 DB 연동을 시작하지 말고, 스키마 DDL 초안, DataAdapter 인터페이스와 자동화 E2E 테스트 스크립트를 먼저 확립한다. 이 순서가 현재 localStorage 기반 MVP를 안정적으로 출시형 구조로 전환하는 가장 안전한 경로다.

## 11. Phase 7 구현 계획

### Phase 7A: 시간표 운영 설정 및 특이사항 필드 기반 구축 (완료)
- **목표**: 강사 출근표와 강사-원생 시간표 고도화의 기반이 되는 설정/데이터 필드를 구축하고 정규화(Normalization) 처리를 수행.
- **산출물**:
  - `DEFAULT_DB.settings` 시간표 메타 설정 필드 확장 (`scheduleDays`, `scheduleStartTime`, `scheduleEndTime`, `scheduleSlotMinutes`, `printLayoutDefault`).
  - `DEFAULT_DB.teachers` 및 `students` 컬렉션에 `scheduleNotes: ""` 필드 기본값 추가.
  - `LocalStorageAdapter` 내에 기존 로컬스토리지 데이터를 보정하는 `normalizeSnapshot` 정규화 로직 적용.
  - 원장 `settingsView`, `staffView`, `membersView` 입력 양식 textarea 및 모달 폼 UI 수정 완료.
- **검증**:
  - `tests/unit/state_smoke_test.mjs`에 신규 필드 존재 및 유효성 단언(Assertion) 추가.
  - `tests/e2e/schedule-setup-flow.spec.js` Playwright E2E 테스트 케이스 신규 구현을 통한 상태 수정 후 새로고침 및 영속성 보장 검증 100% 통과.

### Phase 7B: 강사 출근표 일간/주간 보기 UI 개발 (완료)
- **목표**: 강사의 주간/일간 근무 가능 타임라인 UI 및 특이사항 필터링을 화면상에 구현.
- **산출물**:
  - `src/js/views/director/sessionsView.js` 내에 주간/일간 보기 모드 전환, 특이사항 표시 토글 및 필터링 기능 구현.
  - `tests/e2e/teacher-shift-flow.spec.js` Playwright E2E 테스트 추가 (원장 로그인, 강사 출근표 주간/일간 보기 확인, 필터링 및 특이사항 패널 제어 검증).
- **검증**:
  - 네비게이션 안정화 규칙을 적용하여 Chromium E2E 시나리오 12개에 대한 안정적인 테스트 성공.
  - 시간표 렌더링 시 timelineStart, timelineEnd, totalHours를 동적 파싱하여 topPercent 및 heightPercent를 HSL 테마에 따라 absolute layout으로 정확히 계산하여 겹침을 방지함.

### Phase 7C: 강사-원생 시간표 일간/주간 UI 개발 (완료)
- **목표**: 강사-원생 일간/주간 운영표의 기본 UI 및 필터링, 특이사항 패널 구현.
- **산출물**:
  - `src/js/views/director/sessionsView.js` 내의 `renderMatchView` 함수 대폭 고도화 및 주간/일간 전환, 필터, 검색 기능 추가.
  - `tests/e2e/teacher-student-schedule-flow.spec.js` Playwright E2E 테스트 신규 추가.
- **검증**:
  - Playwright E2E 13개 시나리오 전체 100% 통과 검증 완료.
  - `node --check`를 통한 문법적 유효성 자체 검사 패스.

### Phase 7D-1.5: 날짜별 강사-원생 운영표 Override/Snapshot 정합성 검증 및 보강 (완료)
- **목표**: 날짜별 운영표의 과거/오늘/미래 처리 규칙 정합성을 재검증하고 부족한 Public API, 마이그레이션 예방 로직, 단위 테스트를 완비.
- **산출물**:
  - `tests/unit/schedule_override_test.mjs` 유닛 테스트 신규 구현 및 `package.json` 파이프라인 연동.
  - `sessions.js` 내의 `calculateEndTime` 비정상 입력 방어 조치 및 날짜별 스케줄(Override/Snapshot) 조회 규칙 검증.
- **검증**:
  - `npm run test:full` 실행을 통해 신규 `test:schedule-override`를 포함하여 총 14개의 테스트(유닛 테스트 3개, E2E 테스트 11개) 100% 통과 확인.
  - `node --check`를 통한 문법적 유효성 자체 검사 패스.

### Phase 7D-2: 강사-원생 일간 운영표 드래그 이동 UI 구현 및 영속화 (완료)
- **목표**: 일간 보기에서 수업 카드를 다른 강사/시간 슬롯으로 드래그 이동하여 해당 날짜의 스케줄 오버라이드를 영속 저장하고, 새로고침 시에도 유지되게 구현하며, 다른 날짜에 영향이 없도록 격리성을 검증.
- **산출물**:
  - `sessionsView.js` 내에 HTML5 Drag & Drop 이벤트 핸들러 고도화.
  - 상단 컨트롤바에 피드백 알림 배너 (`teacher-student-move-status`) 추가 및 연동.
  - `tests/e2e/teacher-student-schedule-flow.spec.js`에 드래그앤드롭, 새로고침 영속성, 날짜별 독립 격리 검증 시나리오 추가.
- **검증**:
  - `npm run test:full`을 구동하여 14개 E2E 및 유닛 통합 테스트 통과 완료.

### Phase 7D-2.5: E2E 전용 드롭 트리거 안전화 및 Phase 정합성 정리 (완료)
- **목표**: 테스트용 드롭 트리거(`__triggerDrop`)가 일반 배포 환경에서 노출되지 않도록 `window.__DAYDAY_E2E__` 플래그로 보호하고 기획/아키텍처 문서 상의 Phase 명칭 및 테스트 용어 정합성을 일괄 정비.
- **산출물**:
  - `sessionsView.js` 내에 E2E 실행 조건절 가드문 추가.
  - `teacher-student-schedule-flow.spec.js` 내에 E2E 플래그 자동 주입용 `page.addInitScript()` 구문 추가 및 테스트 브리지 주석 정돈.
  - 아키텍처 및 전략 문서 일괄 갱신.
- **검증**:
  - `node --check` 문법 검사 통과 및 `npm run test:full` 14개 통합/E2E 테스트 100% 통과 확인.

### Phase 7D-3: 날짜별 이동 로그 감사/UI 보강 (완료)
- **목표**: 일간 일정 드래그 이동 시 생성되는 시간표 변경 이동 감사 로그를 조회하여 우측 영역에 "시간표 이동 이력" 패널로 연동하고 원장 권한 UI에서 실시간 확인 및 가시성 토글이 가능하게 설계.
- **산출물**:
  - `sessionsView.js` 내에 우측 사이드바 구조(수업 특이사항 패널 + 시간표 이동 이력 패널) 구축.
  - 상단 컨트롤바에 "이동 이력 숨기기/보이기" 토글 버튼 및 `matchShowLogs` 상태 연동.
  - `tests/e2e/teacher-student-schedule-flow.spec.js`에 감사 로그 생성, 새로고침 영속성, 날짜별 격리, 토글 기능 검증용 E2E 시나리오 신규 추가.
- **검증**:
  - `node --check` 문법 검사 패스 및 신규 E2E 시나리오를 포함하여 총 15개 통합/E2E 테스트 구동 및 패널 감사 동작 확인.