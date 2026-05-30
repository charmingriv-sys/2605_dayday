# Supabase/PostgreSQL 스키마 보조 설명서 (Phase 6A)

본 문서는 `docs/supabase-schema-draft.sql`에 설계된 출시형 DB 스키마 초안에 대한 네이밍 배경, RLS 정책 가이드 및 기존 `DEFAULT_DB` 로컬스토리지 컬렉션과의 상세 매핑 가이드를 제공합니다.

---

## 1. 핵심 네이밍 의사결정

### 1.1 `organizations` vs `academies` (최종 결정: **`organizations`**)
- **이유**: 현재 MVP 코드는 음악학원 중심 용어(`academies`)를 사용하고 있으나, 향후 개인 레슨, 헬스장, 소규모 F&B 등으로 확장성을 열어두기 위해 DB 수준의 컬럼 및 테이블 명칭은 최상위 격리 단위를 `organizations`로 결정했습니다.
- **마이그레이션 방안**: 뷰단 코드와의 불일치를 줄이기 위해, 화면 레이아웃 및 JS 단어 치환기(용어 사전 포맷터) 레벨에서 `organization`을 학원(academy) 및 매장 등으로 번역해 매핑 서빙합니다.

### 1.2 `classes` vs `sessions` (최종 결정: **`classes`**)
- **이유**: 시간표와 매칭되는 고정식 클래스 스케줄 데이터를 `DEFAULT_DB.classes`에 저장하고 있었습니다. 관계형 DB 전환 시 기존 코드의 변동을 방지하기 위해 `classes` 네이밍을 승계하였습니다.

### 1.3 `payments` vs `invoices` (최종 결정: **`payments`**)
- **이유**: 현재 MVP 수납 대장은 `payments`라는 단일 컬렉션에 청구서 정보와 수납 완료 상태 및 납부 수단을 함께 기록하고 있습니다. 이를 1:1 관계형 모델로 설계하여 전환 난이도를 최적화하였습니다. (추후 고도화 시 청구서용 `invoices`와 상세 결제 내역용 `payments`로 정규화 분리 가능)

---

## 2. DEFAULT_DB (LocalStorage)와 Supabase 스키마 매핑표

| DEFAULT_DB 컬렉션 | Supabase 테이블 | 조치 내용 및 비고 |
| :--- | :--- | :--- |
| **`academies`** | `organizations` | 최상위 테넌트로 격리. `invite_code`, `system_password`, `tablet_password` 보관 |
| **`users`** | `user_profiles` | Supabase `auth.users`를 외래키 `auth_user_id`로 참조 연동 |
| **`parentStudentLinks`**| `parent_student_links`| 학부모 유저 프로필과 자녀(원생) 간의 1:N 링크 맵핑 |
| **`students`** | `students` | `organization_id` 외래키 추가. Soft Delete를 위한 `deleted_at` 적용 |
| **`teachers`** | `teachers` | `organization_id` 외래키 추가. 강사 상세 메타 데이터 보관 |
| **`shifts`** | `teacher_shifts` | 강사별 스케줄 근무표 데이터 |
| **`classes`** | `classes` | 요일별, 교시별 고정 수강 스케줄 맵핑 |
| **`attendance`** | `attendance_records` | 출결 이력 보관. 이미지 및 비디오 주소 컬럼 규격 적용 |
| **`subjects`** | `subjects` | 수강 교습 과목 정보 |
| **`books`** | `books` | 교재 정보 대장 |
| **`studentBooks`** | `student_books` | 원생별 배정 교재 및 진도일 맵핑 |
| **`payments`** | `payments` | 수납 완료/미납 처리 대장 |
| **`announcements`** | `announcements` | 학원 전체 공지사항 게시판 |
| **`messages`** | `messages` | 개별 부모 타겟 알림 메시지 |
| **`surveys`** | `surveys` | 설문조사 문항 데이터 (JSONB 활용) |
| **`surveyResponses`** | `survey_responses` | 원생별 설문 응답 결과 적재 (JSONB 활용) |
| **`settings`** | `settings` | 카카오 알림톡 발송 토글 및 학원 로고 설정 메타 |

---

## 3. 보안 및 운영 관리 방침

1. **비밀번호/PIN 암호화**:
   - `organizations` 테이블에 저장되는 `system_password_hash` 및 `tablet_password_hash`는 MVP의 `'0000'` 기본값을 뒤집어, 단방향 해시 알고리즘(bcrypt 등)으로 해싱되어 DB에 저장됩니다.
2. **Supabase 서비스 롤 키(Service Role Key) 보류**:
   - RLS 정책을 무시하고 데이터를 전면 스캔할 수 있는 `service_role` 토큰은 클라이언트에 전달되지 않으며, 환경변수 및 Netlify Edge Functions와 같은 보안 클라우드 공간 내에서만 사용되어야 함을 RLS 주석에 남겨 두었습니다.
3. **Soft Delete(부드러운 삭제) 전략**:
   - `students`, `teachers`, `subjects`, `books` 테이블 등 복구 및 통계 이력 추적이 필수적인 핵심 데이터들은 `deleted_at` 필드를 갱신하여 뷰 노출을 차단(Soft Delete)하고, 과거 결제 및 출결 기록이 함께 훼손되지 않도록 통제합니다.
