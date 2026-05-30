# StateStore API 및 도메인 의존성 지도 (Phase 4B)

본 문서는 `src/js/state.js`를 9개의 도메인 모듈로 분할한 구조와 Phase 4B에서 최종 완료된 `src/js/views/director.js` 완전 분할 구조를 기준으로 작성되었습니다. 이 지도는 개발자가 상태 관리 흐름을 파악하고 안전하게 유지 보수하기 위한 가이드라인 역할을 합니다.

---

## 1. 현재 구조 요약 (Architecture Overview)

`StateStore`는 애플리케이션 전체의 **임시 데이터베이스(DB)**이자 **상태 관리자** 역할을 합니다. 

*   **저장소 메커니즘**: 현재 버전은 별도의 백엔드 데이터베이스 없이 브라우저의 `localStorage`에 데이터를 직렬화(JSON)하여 보존합니다.
*   **분할 담당제 (도메인 모듈)**: `src/js/state/` 디렉토리 하위의 9개 모듈은 각각 특정 업무(예: 수납 담당, 출결 담당)를 전담합니다.
*   **Prototype Injection 바인딩**: 중앙 `state.js`는 가볍게 유지되며, 런타임에 `Object.assign(StateStore.prototype, ...)` 방식으로 하위 모듈의 메소드들을 동적으로 주입받아 합쳐집니다.
*   **원장 화면 모듈화 (Phase 4B)**: `src/js/views/director.js`는 단순 re-export를 처리하는 entry wrapper로 간소화되었고, 모든 개별 화면 뷰는 `src/js/views/director/` 아래의 각 모듈 파일(dashboardView.js, billingView.js, membersView.js, staffView.js, sessionsView.js, attendanceView.js, communicationView.js, settingsView.js)로 완전히 분리되었습니다. `src/js/views/director/index.js`는 모든 개별 뷰를 다시 묶어 내보내는 얇은 허브 역할을 합니다.
*   **캡슐화 지침**: 모든 뷰(View) 파일은 직접 데이터를 조회·수정해서는 안 되며, 반드시 `stateStore.getStudents()`, `stateStore.markAttendance()`와 같이 `stateStore` 인스턴스가 제공하는 공개 API(Public API)를 거쳐서만 통신해야 합니다.

---

## 2. 9개 도메인 모듈별 책임 및 제공 API

각 모듈이 담당하는 데이터 영역과 핵심 메소드를 정리한 일람입니다.

| 파일명 (모듈) | 담당 데이터 및 영역 | 대표 Public API | 관련 연동 화면 | 업종 확장 시 성격 |
| :--- | :--- | :--- | :--- | :--- |
| **`settings.js`** | 학원 기본 정보, 초대코드, 알림톡 토글 등 매장 기본 메타 데이터 | `getSettings`, `updateSettings`, `updateAcademy`, `regenerateAcademyInviteCode` | 설정, 학원 관리, 로그인/회원가입 | **공통** (매장명, 연락처 등은 모든 소상공인 공통) |
| **`catalog.js`** | 교습 과목 정보, 학원 보유 교재 목록, 원생별 배정 교재 매핑 | `getSubjects`, `addSubject`, `getBooks`, `assignBookToStudent`, `removeStudentBook` | 원생 상세, 교재/과목 설정 | **특화** (음악학원의 악기/교재에 해당하며 타 업종 시 PT 이용권 등으로 대체) |
| **`communication.js`** | 학원 전체 공지사항, 학부모 개별 알림장 메시지, 학원 만족도 설문조사 및 응답 | `getAnnouncements`, `addAnnouncement`, `addMessage`, `addSurvey`, `submitSurveyResponse` | 공지사항, 메시지 전송, 설문조사 | **공통** (고객 알림 및 피드백 기능은 전 업종 동일 필요) |
| **`billing.js`** | 수강료 청구서 발행, 교재 대금 청구서 발행, 수납(결제) 상태 처리 및 미납 제어 | `getPayments`, `payInvoice`, `createInvoice`, `requestBookPayment` | 수납 관리, 대시보드, 학부모 결제 | **공통** (매출 청구 및 수납은 ERP 필수 범용 기능) |
| **`attendance.js`** | 원생 등원/하원/지각/결석 상태 기록 및 안심 알림톡 발송 | `getAttendance`, `markAttendance`, `leaveAttendance` | 출결 관리, 강사 전용 입력, 학부모 알림 | **공통 변형** (헬스장은 무인 입장 체크인, 식당은 방문 예약 이력으로 치환) |
| **`members.js`** | 원생 인적사항, 엑셀 일괄 등록, 학부모 계정과 원생 매핑 링크 | `getStudents`, `getStudent`, `addStudent`, `addStudentsBatch`, `dischargeStudent` | 원생 관리, 대시보드, 학부모 회원가입 | **공통** (고객/회원 기본 원장은 SaaS의 핵심) |
| **`staff.js`** | 강사 프로필 목록, 강사별 일자별 시프트(shift) 근무 계획표 | `getTeachers`, `getTeacher`, `addTeacher`, `getTeacherShifts`, `saveTeacherShift` | 강사 관리, 강사 대시보드 | **공통** (직원/파트타임 근무 관리는 전 업종 재사용 가능) |
| **`authUsers.js`** | 로그인 유저 인증 정보, 소셜 SNS 연동 데이터, 가입 신청 대기자 관리 | `getCurrentUser`, `setCurrentUser`, `registerUser`, `approveJoinRequest`, `withdrawUser` | 로그인/회원가입, 가입 승인 | **공통** (인증 및 다중 계정 권한 관리는 범용 시스템 핵심) |
| **`sessions.js`** | 요일별/교시별 고정 시간표 목록 및 원생별 배정 교시 정보 | `getClasses`, `getClassesForStudent` | 스케줄/시간표 설정, 대시보드 | **공통 변형** (피트니스는 PT 예약 세션, 식당은 시간대 예약 테이블로 변환) |

---

## 3. 원장 화면별 State API 의존성 지도 (완료된 분리 구조)

`director.js`에 밀집되어 있던 원장 화면 모듈들을 기능 단위로 분할하여 배치한 각 컴포넌트 파일들과 의존하는 `stateStore` API 리스트입니다.

### 3.1 대시보드 (Dashboard)
- **설명**: 메인 대시보드 지표(총 원생 수, 강사 수, 오늘 출석 현황, 당월 교육비 수납율) 출력
- **의존 API**: `getStudents()`, `getTeachers()`, `getClasses()`, `getAttendance()`, `getPayments()`
- **구독 이벤트**: `STUDENTS_CHANGED`, `TEACHERS_CHANGED`, `CLASSES_CHANGED`, `ATTENDANCE_CHANGED`, `PAYMENTS_CHANGED`

### 3.2 원생 관리 (Members)
- **설명**: 원생 목록 렌더링, 원생 등록/수정 모달, 엑셀 배치 업로드, 퇴원 및 정보 삭제 처리
- **의존 API**: `getStudents()`, `getStudent()`, `addStudent()`, `addStudentsBatch()`, `updateStudent()`, `dischargeStudent()`, `deleteStudent()`, `getClassesForStudent()`, `getTeachers()`
- **구독 이벤트**: `STUDENTS_CHANGED`, `CLASSES_CHANGED`

### 3.3 수납/청구 관리 (Billing)
- **설명**: 월간 청구서 현황판, 수납 완료/미납 처리, 도서비 개별 청구 및 Toss/KakaoPay 수납 확인
- **의존 API**: `getPayments()`, `payInvoice()`, `updatePayment()`, `requestBookPayment()`, `getStudents()`
- **구독 이벤트**: `PAYMENTS_CHANGED`, `STUDENTS_CHANGED`

### 3.4 출결 관리 (Attendance)
- **설명**: 일자별/원생별 등하원 현황 테이블, 수동 등하원 마킹 및 카카오톡 알림톡 발송 연계
- **의존 API**: `getAttendance()`, `getStudents()`, `markAttendance()`, `leaveAttendance()`
- **구독 이벤트**: `ATTENDANCE_CHANGED`

### 3.5 수업/시간표 관리 (Sessions)
- **설명**: 요일별/강사별 수업 캘린더 시간표 매트릭스 렌더링
- **의존 API**: `getClasses()`, `getTeachers()`, `getStudents()`
- **구독 이벤트**: `CLASSES_CHANGED`, `STUDENTS_CHANGED`

### 3.6 강사 관리 (Staff)
- **설명**: 강사 목록 및 프로필 관리, 강사별 일자별 시프트 근무 스케줄 설정 모달
- **의존 API**: `getTeachers()`, `getTeacher()`, `addTeacher()`, `updateTeacher()`, `deleteTeacher()`, `getTeacherShifts()`, `saveTeacherShift()`
- **구독 이벤트**: `TEACHERS_CHANGED`, `SHIFTS_CHANGED`

### 3.7 공지/메시지/설문 (Communication)
- **설명**: 전체 공지사항 게시판, 학부모 알림장 발송 및 내역 보관, 설문조사 발송 및 응답률 차트
- **의존 API**: `getAnnouncements()`, `addAnnouncement()`, `deleteAnnouncement()`, `getMessages()`, `addMessage()`, `deleteMessage()`, `getSurveys()`, `getSurveyResponses()`, `addSurvey()`, `deleteSurvey()`
- **구독 이벤트**: `ANNOUNCEMENTS_CHANGED`, `MESSAGES_CHANGED`, `SURVEYS_CHANGED`, `SURVEY_RESPONSES_CHANGED`

### 3.8 설정 및 학원 정보 관리 (Settings & Organization)
- **설명**: 학원 기본 프로필(사업자번호, 대표자, 연락처) 편집, 서명 Canvas 이미지 리사이징 업로드, 초대코드 발행/중단 제어
- **의존 API**: `getSettings()`, `updateAcademy()`, `getAcademyInviteCode()`, `regenerateAcademyInviteCode()`, `updateAcademyInviteCodeStatus()`, `getPendingJoinRequests()`, `approveJoinRequest()`, `rejectJoinRequest()`
- **구독 이벤트**: `ACADEMIES_CHANGED`, `SETTINGS_CHANGED`, `ACADEMY_INVITE_CODES_CHANGED`, `ACADEMY_JOIN_REQUESTS_CHANGED`

---

## 4. 직접 DB 접근 리스크 및 개선안 (Direct Access Warning)

현재 코드베이스 상에서 `stateStore`가 제공하는 API 메소드를 우회하여 `stateStore.db` 내부 속성에 직접 침투해 데이터를 가공/조회하던 구문들은 Phase 4.5에서 모두 완전히 조치되었습니다.

### 4.1 직접 접근 검출 및 조치 상태
- **[조치 완료]** `src/js/views/director.js` (현 `billingView.js` 내): `stateStore.db.payments.find(...)` 2곳 -> `stateStore.getPayments().find(...)`로 교체 완료.
- **[조치 완료]** `src/js/app.js` (기존 163라인): `stateStore.db.users.find(...)` -> `stateStore.getUserBySnsId(provider, snsId)`로 교체 완료.
- **[조치 완료]** `src/js/views/parent.js` (기존 41라인): `stateStore.db.parentStudentLinks` 직접 필터링 -> `stateStore.getParentLinksForStudent(studentId)`로 교체 완료.

### 4.2 왜 직접 접근(`stateStore.db.xxx`)이 위험한가?
`stateStore.db` 직접 접근은 현재 모킹용 `localStorage` 구조와 메모리 로딩 변수 형태에서는 일시적으로 돌아가지만, 다음과 같은 중대한 아키텍처적 결함을 발생시킵니다:

1.  **밀접 결합(Tight Coupling) 및 캡슐화 파괴**: 뷰 파일이 상태 저장소 내부의 물리적 필드명(예: `parentStudentLinks`)을 그대로 파악하고 있기 때문에, DB 스키마가 조금만 바뀌어도 모든 뷰 파일의 렌더링 코드가 동시다발적으로 깨지게 됩니다.
2.  **데이터 무결성 훼손**: 뷰단에서 `stateStore.db.payments.push()`와 같이 데이터를 직접 수정해 버리면, 로컬스토리지 파일에 변경 사항이 안전하게 플러시(`saveDB()`)되지 않고 뷰 갱신 이벤트(`notify()`)도 발생하지 않아 데이터 불일치 버그가 생깁니다.
3.  **데이터베이스(Supabase/PostgreSQL) 마이그레이션 장애**: 서버 데이터베이스로 이관하면 네트워크 호출을 통해 데이터를 비동기로 들고 옵니다. 뷰단에서 `stateStore.db`를 동기적으로 바로 참조하여 탐색을 시도하는 모든 코드는 `null reference error`를 동반하며 완전히 붕괴하게 됩니다.

> [!NOTE]
> **해소 완료**: 이제 모든 뷰 레이어는 데이터베이스 레이어(`stateStore.db`)에 직접 침투하지 않으며, 캡슐화된 정식 Public API를 거쳐서만 통신합니다.

### 4.3 Supabase 테이블 후보 매핑
로컬 스토리지의 임시 컬렉션 데이터 모델과 `docs/supabase-schema-draft.sql`에 설계된 PostgreSQL/Supabase 테이블 구조의 대응 기준입니다:
- `academies` -> `organizations` (테넌트 격리 루트)
- `users` -> `user_profiles` (인증 유저 프로필)
- `students` -> `students` (원생 관리)
- `teachers` -> `teachers` (강사 정보)
- `attendance` -> `attendance_records` (출결 로그)
- `classes` -> `classes` (스케줄 시간표)
- `payments` -> `payments` (수납 청구 대장)

### 4.4 StateStore 데이터 어댑터 아키텍처 (전환 계획)
향후 백엔드 데이터 동기화를 위해 아래의 어댑터 레이어가 가동됩니다:
```txt
View -> StateStore Public API -> Memory Cache -> LocalStorageAdapter -> localStorage
```
**Phase 6C/6D/6E/6F/6G 현재 상태:**
- `src/js/state/adapters/dataAdapter.js` 인터페이스(규격 클래스) 생성 완료.
- `src/js/state/adapters/localStorageAdapter.js` 구현 및 StateStore 연동 완료.
- `src/js/state/adapters/supabaseAdapter.js` 스켈레톤 및 마이그레이션 계획 문서(`docs/supabase-adapter-plan.md`) 작성 완료.
- `docs/auth-rls-plan.md` 및 `docs/supabase-rls-policy-draft.sql`을 통한 역할 권한 정의 및 RLS 정책 기본 설계 완료.
- `docs/deployment-preview-plan.md`, `docs/environment-variable-plan.md`, `docs/release-readiness-checklist.md` 기반의 Netlify/Vercel 호스팅 정적 배포 준비 및 자격증명 관리 표준 정립 완료.
- `docs/baseline-phase-6g.md` 수립을 통한 전체 누적 변경 및 릴리즈 베이스라인 고정 완료.
- SupabaseAdapter는 아직 StateStore에 연결되지 않았으며, 뷰(View) 레이어는 동기 Public API 및 `LocalStorageAdapter`를 거쳐 `localStorage`에 연결된 상태를 기본 유지함.

---

## 5. 프로젝트 보안 점검 참고 사항

*   **보안 메모**: 초기 론칭 및 로컬 깃 연동 설정 시 리모트(remote) 저장소 주소에 깃허브 토큰(GitHub Personal Access Token) 정보가 포함되어 관리되고 있을 가능성이 존재합니다.
*   **조치 권고**: 프로젝트를 클라우드 환경에 배포하거나 타인과 공유하기 전, 반드시 `.git/config` 파일 또는 `git remote -v` 출력을 확인하여 토큰이 노출되어 있다면 이를 폐기하고, 토큰리스 HTTPS 주소나 SSH Key 인증 기반으로 리모트 구성을 리셋하시기 바랍니다.

