# SupabaseAdapter 원격 저장소 마이그레이션 계획 및 설계서 (Phase 6D.5)

본 문서는 브라우저 `localStorage` 기반 상태 관리에서 원격 데이터베이스 서비스인 `Supabase + PostgreSQL` 구조로 안전하게 마이그레이션하기 위한 설계 및 매핑 계획서이다.

---

## 1. SupabaseAdapter의 설계 및 역할

`SupabaseAdapter`는 `DataAdapter` 인터페이스 규격을 상속받아 구현되며, 로컬 메모리 상태 엔진(`StateStore`)과 원격 Supabase 백엔드 간의 데이터 동기화를 책임진다.

### 1.1 DataAdapter와의 관계
- `DataAdapter`의 추상 규격(`initialize`, `loadSnapshot`, `saveSnapshot`, `fetchAllDomainData`, `persistDomain`, `writeAuditLog`)을 성실히 상속합니다.
- `saveSnapshot`은 전체 스냅샷 일괄 덮어쓰기로 작동하므로, 네트워크 전송량 낭비 및 동시성 훼손을 방지하기 위해 Supabase 어댑터에서는 이를 공식적으로 지원하지 않으며(throw error), 대신 `persistDomain` 또는 개별 도메인 단위의 증분 저장 방식을 채택합니다.

### 1.2 SDK 미설치 및 Client 주입 방식 설계 이유
- **관심사 분리 (Decoupling)**: 어댑터 내부에 `@supabase/supabase-js` 또는 `createClient` 라이브러리를 직접 import하여 하드코딩하지 않습니다. 이는 특정 SDK 버전에 대한 결합도를 차단하고, 향후 Node.js 테스트 환경 및 브라우저 환경에서 Mocking이 용이하도록 하기 위함입니다.
- **클라이언트 주입 (Dependency Injection)**: 어댑터 생성 시 외부로부터 설정이 완료된 `client` 객체를 주입받아 작동하도록 구성합니다.

### 1.3 StateStore 미연결 사유
- 현재 View 레이어의 모든 API가 동기식 캐시 반환에 완전히 묶여있어 즉각적인 비동기 API 전환 시 렌더링 대란이 일어납니다.
- 이에 1단계에서는 `LocalStorageAdapter`만 `StateStore` 본체에 연동하여 100% 동기 작동을 보장하고, `SupabaseAdapter`는 스켈레톤 상태로 격리하여 뷰 안정성을 보존합니다.

### 1.4 LocalStorageAdapter와 SupabaseAdapter의 책임 차이
- **LocalStorageAdapter**: 브라우저의 로컬 동기 저장소 입출력을 관장하며, 오프라인 상태에서도 정상 동작하는 동기 fallback 샌드박스를 보장합니다.
- **SupabaseAdapter**: PostgreSQL 서버 I/O 및 RLS 보안 규칙이 포함된 원격 API 호출을 수행하며 비동기/증분 갱신 전략을 수행합니다.

---

## 2. 환경 설정 및 보안 원칙

### 2.1 클라이언트 사이드 노출 환경변수
SaaS 애플리케이션 프론트엔드 환경에서 사용될 수 있는 Supabase 연결 정보는 다음과 같다.
- `SUPABASE_URL`: Supabase 프로젝트 API Endpoint 주소.
- `SUPABASE_ANON_KEY`: Row-Level Security(RLS) 정책이 유효할 때 공개적으로 노출 가능한 익명 접근 API Key. 반드시 RLS 보안 적용을 선행해야 합니다.

### 2.2 서버 사이드 격리 민감정보 (Browser 금지)
- **`SUPABASE_SERVICE_ROLE_KEY` (절대 프론트엔드 노출 금지)**:
  - RLS를 완전히 무시하고 모든 데이터에 접근 가능한 어드민 키입니다.
  - 브라우저 스크립트 번들에 포함되거나 빌드 결과물에 노출되지 않도록 철저히 통제합니다.
  - 회원가입 승인, 데이터 정리 등 특수 비즈니스 로직은 브라우저 클라이언트가 아닌 **Supabase Edge Functions** 또는 **서버리스 백엔드**에서 이 Key를 장착해 실행합니다.
- **Toss Payments / Kakao Alimtalk API Secret, OAuth API Secrets**:
  - 결제 서명 검증 및 SNS 공급자 연동용 시크릿 키는 반드시 보안 환경변수가 로드된 서버리스 함수 안에서만 실행되며 클라이언트로 직접 유실되지 않도록 합니다.

### 2.3 Supabase 클라이언트 생성 위치
향후 SDK 통합 시 클라이언트 인스턴스화의 분리 설계 후보 위치:
1. `src/js/services/supabaseClient.js`: 글로벌 서비스 접근용 래퍼 함수 및 클라이언트 캐싱.
2. `src/js/state/adapters/createSupabaseClient.js`: 어댑터 레이어 전용 인스턴스 팩토리.

---

## 3. 데이터베이스 테이블 및 스냅샷 객체 매핑 계획

원격 DB로의 점진적 전환 과정에서 UI 깨짐을 예방하기 위해, Supabase에서 데이터를 페치해 `StateStore` 메모리 캐시를 구성할 때 아래의 규칙에 따라 `this.db`의 snapshot 구조로 역정규화/조립 및 필드 맵핑을 수행한다.

### 3.1 맵핑 매트릭스

| Supabase Table | StateStore Snapshot Key | mapping & UI Alias 비고 |
| :--- | :--- | :--- |
| **`organizations`** | `academies` | 레거시 UI 구조와의 호환을 위해 `academies`라는 이름의 Alias 배열로 변환하여 메모리 로드. 어댑터 내에서 `mapOrganizationToAcademy` 사용. |
| **`user_profiles`** | `users` | Supabase Auth의 UUID(`auth.users.id`)와 맵핑된 프로필 정보를 API 스키마(`users`) 포맷에 맞게 변환. |
| **`students`** | `students` | 필드명 및 기본 규격 유지. |
| **`teachers`** | `teachers` | 필드명 및 기본 규격 유지. |
| **`classes`** | `classes` | 요일별 수업 매트릭스 구조 유지. |
| **`attendance_records`** | `attendance` | 레거시 테이블명 단축을 위해 `attendance` 스냅샷 키로 변환. |
| **`payments`** | `payments` | 수납 내역 데이터 규격 호환. |
| **`subjects`** | `subjects` | 개설 과목 데이터 규격 호환. |
| **`books`** | `books` | 교재 목록 정보 호환. |
| **`student_books`** | `studentBooks` | camelCase 변환 (`student_books` -> `studentBooks`). |
| **`announcements`** | `announcements` | 학원 전체 공지사항 매칭. |
| **`messages`** | `messages` | 학부모 알림장 개별 내역 매칭. |
| **`surveys`** | `surveys` | 설문조사 마스터 정보 매칭. |
| **`survey_responses`** | `surveyResponses` | camelCase 변환 (`survey_responses` -> `surveyResponses`). |
| **`settings`** | `settings` | 각 조직(`organizationId`)에 해당하는 JSON 설정 필드를 파싱하여 최상위 `settings` 키로 공급. |

### 3.2 camelCase <-> snake_case 변환 정책
- **데이터 로드 시**: Supabase 테이블의 `snake_case` 컬럼 필드들을 어댑터 헬퍼 `mapSnakeToCamel()`을 통해 프론트엔드가 요구하는 `camelCase` 스타일로 일괄 재조립하여 주입한다.
- **데이터 영속화 시**: UI 단의 신규 데이터나 업데이트 사항을 서버에 저장 요청할 때, `mapCamelToSnake()` 헬퍼를 통해 PostgreSQL 컬럼 양식으로 매핑하여 트랜잭션을 실행한다.

---

## 4. 구현 및 보안 적용 순서 원칙

1. **원격 연결 비활성 원칙**: Row Level Security (RLS) 정책이 DB에 물리적으로 세팅되어 작동하지 않는 최초 개발 기간 동안은, 어댑터의 원격 연결 활성화를 명시적으로 금지합니다. (즉, RLS 검증 전까진 LocalStorage 모드로만 구동)
2. **구현 완료 상태 (Phase 6I)**:
   - `fetchAcademy()`, `fetchStudents()`, `fetchTeachers()`, `fetchPayments()` 및 `fetchAllDomainData()`의 읽기 전용 질의 로직 및 스냅샷 병합 처리가 완료되었습니다.
   - `mapSnakeToCamel()`, `mapCamelToSnake()`, `mapOrganizationToAcademy()` 헬퍼가 구현되어 snake_case <-> camelCase 변환 및 `academyId`/`organizationId` 별칭 바인딩이 완벽하게 가동됩니다.
3. **향후 진행 범위 (Phase 6J)**:
   - `persistDomain()` 및 `writeAuditLog()` 증분 쓰기 갱신 구현 예정.
