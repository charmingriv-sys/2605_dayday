# Supabase Auth, 역할/권한 및 RLS 상세 마이그레이션 설계서 (Phase 6E)

본 문서는 DayDay 음악학원 MVP 및 향후 확장될 멀티 버티컬 SaaS 환경에서 안전하게 사용자를 식별하고 데이터를 격리(Multi-Tenant Isolation)하기 위한 Auth/RLS 상세 설계 계획서입니다.

---

## 1. DayDay 인증/권한 설계의 목표

1. **테넌트 간 완벽한 데이터 격리 (Multi-Tenant Isolation)**:
   - 학원 A의 구성원(원장, 강사, 학부모 등)은 어떠한 우회 경로를 통해서도 학원 B의 데이터를 열람하거나 수정할 수 없도록 DB 레벨에서 강제합니다.
2. **역할 기반 접근 제어 (RBAC - Role-Based Access Control)**:
   - 원장(owner), 운영진(manager), 강사(teacher), 학부모(parent), 출결 태블릿(kiosk) 등 서비스 참여 주체별로 필요한 최소한의 데이터만 읽기/쓰기를 보장합니다.
3. **영속성 교체 시 화면 안정성**:
   - `StateStore` 캐시 구조를 그대로 두어 프론트엔드 UI 변경을 최소화하고 백그라운드 어댑터를 통해 Supabase의 세션을 안전하게 동기화합니다.

---

## 2. 계정 및 테넌트(조직) 관계 설계

### 2.1 Supabase Auth와 User Profiles, Organization Members
사용자의 인증 및 소속 정보는 단일 테이블에 다 넣지 않고, 결합도를 낮추기 위해 **인증 계정, 프로필 정보, 조직 멤버십 정보**의 3단계 구조로 격리 설계합니다.

```txt
  [ Supabase Auth (auth.users) ]
               │  (1:1 UUID mapping)
               ▼
   [ user_profiles (public) ]
               │  (1:N)
               ▼
  [ organization_members ]  ──────►  [ organizations ]
    - organization_id                 - id (UUID)
    - role (owner, manager...)
    - status (approved, pending)
```

- **`auth.users` (Supabase Auth 스키마)**: 
  - 이메일, 패스워드, 소셜 로그인 연동 정보 등을 보관하는 Supabase 내부 인증 영역.
- **`public.user_profiles` (애플리케이션 스키마)**:
  - `auth_user_id` (UUID) 필드를 통해 `auth.users.id`와 1:1 관계를 가집니다.
  - 사용자의 실제 이름, 연락처, SNS 공급자(snsId, provider) 등의 서비스 메타데이터를 저장합니다.
- **`public.organization_members` (조직 멤버십)**:
  - 한 유저가 여러 학원에 속하거나 역할을 가지는 구조를 지원합니다.
  - `organization_id`와 `user_id`를 외래키로 참조하며, 해당 테넌트 내부에서의 역할(`role`) 및 가입 승인 상태(`status`)를 기록합니다.

### 2.2 테넌트 격리 및 과도기 UI 매핑 원칙
- **테넌트 식별자**: 데이터베이스 레벨에서는 범용 SaaS 표준인 `organization_id`를 물리 컬럼 키로 사용합니다.
- **UI 호환성 맵핑**: 기존 음악학원 중심의 UI 소스 코드(`src/js/views/director/*.js` 등)는 `academyId` 변수명을 주로 사용하므로, 어댑터 레이어(`SupabaseAdapter`)가 API 결과 공급 시 `organizationId` 값을 `academyId` 별칭(Alias)으로 래핑하여 뷰에 제공합니다.

---

## 3. 역할별 권한 매트릭스 (Role Matrix)

DayDay의 비즈니스 롤에 기반한 세부 데이터 읽기/쓰기 권한 기준입니다. RLS 정책 수립의 기본 전제는 **모든 테이블에 대한 기본 차단(Default Deny)**입니다.

| 역할 (Role) | 대상 및 설명 | 조회 가능 범위 (SELECT) | 생성/수정 가능 범위 (INSERT/UPDATE) | 금지 및 제한 사항 |
| :--- | :--- | :--- | :--- | :--- |
| **`owner / director`** | 학원 소유주 (원장) | 소속 조직 전체 데이터 | 소속 조직 전체 데이터 및 설정, 관리자 PIN, 멤버십 상태 변경 | 타 조직 데이터 접근 절대 불가 |
| **`manager`** | 학원 행정 운영진 | 소속 조직 전체 데이터 | 원생 관리, 수업 예약, 청구/수납 처리 | 조직 중요 정보(비즈니스 소유권 변경, 정산 설정 등) 변경 불가능 |
| **`teacher`** | 수업 강사 | 본인 배정 수업 목록, 담당 원생 정보, 출결 현황, 강사 시프트 | 출결 마킹, 수업 피드백 코멘트, 배정 교재 진도율 입력 | 학원 전체 매출 지표 조회 금지, 타 강사 프로필 및 타 원생 사생활 정보 조회 차단 |
| **`parent`** | 원생 보호자 | 자녀의 정보, 출결 기록, 청구서 내역, 공지사항, 메시지, 설문조사 | 설문조사 응답, 수납 요청(결제 승인) | 타인 자녀 정보 및 강사 시프트 등 행정 데이터 접근 금지 |
| **`kiosk / tablet`** | 키오스크/출결 태블릿 기기 | 출결 마킹에 필요한 최소 원생 목록 (이름, ID, 키패드 매칭용 전화번호 뒷자리) | 등하원 출결 마킹 (`INSERT` / `UPDATE`) | 원생 개인정보(상세 주소, 학부모 연락처, 수납 내역) 일체 노출 금지 |
| **`accountant / auditor`** | (향후 추가) 외부 정산 회계 담당 | 소속 조직 수납 내역, 매출 대장, 감사 로그(Audit Logs) | 없음 (조회 전용) | 원생 인적사항, 메시지, 시간표 등 수업 정보 접근 권한 제약 |

---

## 4. 테이블별 RLS(Row Level Security) 접근 정책 요약

RLS의 각 테이블 격리는 `organization_id`를 기반으로 사용자의 멤버십 자격(`organization_members` 내 해당 org의 approved 상태) 여부를 평가해 통제합니다.

- **`organizations`**
  - **SELECT**: 소속 테넌트의 승인된 멤버.
  - **INSERT/UPDATE**: `owner` 역할을 가진 멤버만 허용.
- **`organization_members`**
  - **SELECT**: 소속 테넌트의 승인된 멤버.
  - **INSERT/UPDATE**: `owner` 권한을 가진 유저가 가입 승인(`status` = 'approved') 또는 역할 강등/승격 처리.
- **`user_profiles`**
  - **SELECT**: 본인의 프로필 및 동일 테넌트에 소속된 강사/원장 프로필 정보.
  - **INSERT/UPDATE**: 본인 소유의 레코드만 가능.
- **`students`**
  - **SELECT**: 소속 테넌트의 원장, 매니저, 담당 강사, 그리고 보호자(연결 관계 매핑 검증).
  - **INSERT/UPDATE**: 원장, 매니저만 허용 (강사는 정보 수정 불가).
- **`parent_student_links`**
  - **SELECT**: 소속 테넌트 멤버 및 본인이 관계된 레코드.
  - **INSERT/UPDATE**: 원장 및 매니저가 매핑 승인 처리.
- **`teachers` & `teacher_shifts`**
  - **SELECT**: 소속 테넌트 멤버.
  - **INSERT/UPDATE**: 원장, 매니저만 허용. 강사는 본인의 시프트 신청에 대해서만 제한적 작성 허용.
- **`classes` (sessions)**
  - **SELECT**: 소속 테넌트 멤버 및 보호자(자녀 수업 스케줄 조회).
  - **INSERT/UPDATE**: 원장, 매니저만 가능.
- **`attendance_records`**
  - **SELECT**: 소속 테넌트 멤버 및 보호자.
  - **INSERT/UPDATE**: 원장, 매니저, 담당 강사 및 태블릿(kiosk) 기기 세션.
- **`payments`**
  - **SELECT**: 소속 테넌트 원장/매니저/회계, 그리고 해당 청구서 대상 학생의 보호자.
  - **INSERT/UPDATE**: 원장, 매니저만 가능. (수납 처리 시 반드시 변경 이력 `audit_logs` 유도 주석 적용)
- **`announcements`**
  - **SELECT**: 소속 테넌트 구성원 모두.
  - **INSERT/UPDATE**: 원장, 매니저만 등록 가능.
- **`messages` (알림장)**
  - **SELECT**: 작성 강사, 원장, 매니저 및 수신 대상 보호자.
  - **INSERT/UPDATE**: 강사, 원장, 매니저만 작성 가능.
- **`surveys` & `survey_responses`**
  - **SELECT**: 소속 테넌트 구성원. (응답 상세는 원장/매니저 및 제출 보호자 본인)
  - **INSERT/UPDATE**: 설문 생성은 원장/매니저만, 설문 응답은 보호자만 가능.
- **`audit_logs` (감사 로그)**
  - **SELECT**: `owner` 및 회계 감사역(`auditor`).
  - **INSERT**: 백엔드 Edge Function 및 지정 어댑터. (UPDATE/DELETE는 전체 사용자 금지)
- **`settings`**
  - **SELECT**: 소속 테넌트 구성원.
  - **INSERT/UPDATE**: `owner` 전용.

---

## 5. 키오스크/태블릿 보안 아키텍처 가이드

단순히 브라우저 로컬 저장소나 UI에 `tabletPassword` 단독 텍스트 비밀번호만 가지고 전체 원생 정보에 접근 권한을 주는 것은 보안상 대단히 취약합니다. (태블릿 분실 또는 브라우저 디버거 탈취 시 원생 개인정보 유출 위험)

### 5.1 보안 아키텍처 개선 로드맵
1. **디바이스 고유 인증 키 도입**:
   - 운영자가 키오스크 기기를 최초 등록할 때 고유 디바이스 토큰(`device_token`)을 발급하고 `kiosk_devices` 테이블에 저장합니다.
   - 키오스크 모드로 구동 중인 브라우저는 오직 이 암호화된 토큰을 지참하여 Supabase 요청을 전송합니다.
2. **조회 데이터의 극단적 차단**:
   - 키오스크 기기 토큰 권한은 원생 전체 정보를 SELECT할 수 없습니다.
   - 오직 등원/하원 키패드 매치용 필드(`student_id`, `name`, `phone_last_4_digits`)만 선택적으로 볼 수 있도록 별도의 데이터베이스 VIEW(`kiosk_students_view`)를 생성하고, 본 뷰에 대해서만 RLS 읽기를 부여합니다.
3. **Edge Function을 통한 출결 변경 트랜잭션 처리**:
   - 클라이언트가 직접 `attendance_records` 테이블을 insert하지 않고, 등하원 핀 코드 매치 시 안전한 `Edge Function` API를 1회성 호출하여 백엔드에서 출결 처리 및 카카오 안심 알림톡 발송을 아토믹하게 처리합니다.

---

## 6. 클라이언트와 Edge Function의 책임 분리

민감정보 기밀 유지와 트랜잭션 안정성을 확보하기 위해 로직 실행 위치를 엄격히 규정합니다.

### 6.1 Edge Function 강제 적용 대상 (서버사이드)
- **Toss Payments / Kakao Pay 실결제 승인 및 영수증 서명 검증**:
  - 클라이언트 사이드에서 PG사 비밀키를 가질 수 없으므로, Edge Function 내에서 Toss API를 최종 호출한 뒤 검증에 성공했을 때만 `payments` 행의 `status`를 'paid'로 변경합니다.
- **카카오 안심 알림톡 발송**:
  - 알림톡 연동용 토큰 및 API 주소를 노출하지 않고, 출결 마킹 트리거 발생 시 Edge Function 백그라운드에서 보안 요청을 처리합니다.
- **초대코드 발행 및 가입 신청 승인 처리**:
  - 해킹을 통한 멤버십 우회 등록을 차단하기 위해, 초대코드 유효성 판정 및 멤버 매핑 처리를 트랜잭션 범위 안에서 서버사이드 검증합니다.
- **기기 세션 등록 및 강제 감사로그 (`audit_logs`) 생성**:
  - 프론트엔드가 감사로그를 누락하거나 임의 조작하지 못하도록 데이터 변경 Edge Function 실행 시 자동으로 행을 주입합니다.

### 6.2 브라우저 어댑터 처리 권장 대상 (클라이언트 사이드)
- **도메인 데이터 쿼리**:
  - RLS가 안전하게 걸려있는 일반 테이블(`students`, `classes` 등)의 읽기(SELECT) 및 사용자 직접 입력 양식의 저장(UPDATE/INSERT).
- **소셜 로그인을 통한 인증 초기 토큰 획득**:
  - Supabase Auth를 이용한 Google/Kakao 소셜 팝업 실행 및 JWT 수집.

---

## 7. Phase 6J 구현 검증 완료 및 RLS 검증 준비

- **감사 로그(Audit Logs) 강제**: `payments` 및 `attendance` 관련 도메인 쓰기 작업(`savePaymentRecord`, `saveAttendanceRecord`) 시 어댑터가 내부적으로 `writeAuditLog`를 강제 호출하여 변경 사항을 자동으로 기록하도록 구현되었습니다.
- **안전장치 설계**:
  - `audit_logs` 테이블에 대한 `UPDATE`/`DELETE` 행위를 데이터베이스 수준에서 원천 차단하는 RLS 및 DB 트리거/규칙 권장사항을 수립하였습니다.
  - 클라이언트에서 보내는 `role` 정보는 감사로그의 보조 메타데이터로만 활용하며, 실제 권한 제어는 Supabase RLS 정책에 전적으로 의존하는 구조를 확보하였습니다.
  - 팩토리 초기화 단에서 브라우저 환경에 `service_role` 키가 유입될 경우 로딩을 에러와 함께 원천 차단(Aborted)하여 시큐리티 누출을 방지하였습니다.
