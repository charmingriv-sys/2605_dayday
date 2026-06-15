# Phase 16B 설계 정의서: 학부모 메시지함 데이터 모델 및 스키마 설계

본 문서는 Phase 16A에서 정의된 학부모 대상 메시징 정책을 시스템적으로 영속화하고, 중복 발송 방지 및 알림 상태 추적을 실현하기 위한 데이터 모델 및 데이터베이스 스키마 설계서입니다.

---

## 1. Phase 16B 범위 정의

### 1) 포함 범위 (In-Scope)
* **신규 `parentMessages` 데이터 모델 및 테이블 스키마 설계**
* **메시지 카테고리 및 도메인별 타입(Type) 분류체계 정의**
* **학부모별 읽음/안읽음(`unread`/`read`) 상태 관리 설계**
* **다중 학부모 수신(학부모1/2)에 따른 노출 대상 매핑 설계**
* **원생 정보 및 도메인 원본 엔티티(출결 로그, 수강료 청구서 등)와의 관계 연결성 설계**
* **기기 푸시 발송 상태 및 타임스탬프 필드 정의**
* **수납/출결 중복 생성 방지를 위한 고유 식별키(`dedupeKey`) 규칙 정의**
* **메시지 보존 및 소프트 삭제(Soft Delete)/보관(Archive) 정책**

### 2) 제외 범위 (Out-of-Scope)
* **학부모 포털 UI 화면 및 인앱 메시지함 실제 마크업 구현**
* **기기 푸시 실제 발송(APNs/FCM) 및 백엔드 토큰 핸들러 구현**
* **알림톡 및 SMS 실제 전송 API 연동 코드 개발**
* **원생 정보 테이블 내 학부모 연락처 2개 필드 추가(Phase 16C) 및 메시지 발송 UI 개편**
* **오늘 원장 콘솔과 외부 메시지 보내기 화면 간의 실제 라우팅 구현**
* **알림톡/문자/푸시 실제 API 연동은 이번 Phase에 포함되지 않습니다.**

---

## 2. 현재 메시지 관련 데이터 구조 분석

현재 `turing_academy_db`에 존재하는 주요 도메인 엔티티들의 데이터 구조와 메시지함 설계에 미치는 한계점은 다음과 같습니다.

### 1) 기존 `messages` 테이블 (수동 알림용)
* **현재 필드:** `id`, `studentId`, `title`, `content`, `date` (YYYY-MM-DD), `isRead` (boolean), `created_at`
* **재사용 여부:** 수동 등록 메시지용으로 사용 중이나, 학부모 메시지함 구조로 재사용하기에는 부적합함 (폐기 또는 마이그레이션 필요).
* **한계점:**
  * **일대일 매핑 한계:** 자녀 한 명당 메시지가 1개만 매핑되므로, 부모가 2명(부/모)일 때 각 사용자의 개별 읽음 처리가 불가함.
  * **메시지 유형 부재:** 공지/알림/출결/결제를 구분할 카테고리(`category`) 및 상세 이벤트 분류(`type`)가 없음.
  * **푸시/외부 발송 추적 불가:** 발송 대기 상태 및 푸시 성공 여부를 추적할 컬럼이 누락되어 있음.

### 2) 기존 `outboundMessageLogs` 테이블 (외부 문자 로그)
* **현재 필드:** `id`, `createdAt`, `receiver`, `content`, `status`, `channel` 등
* **재사용 여부:** SMS/알림톡 발송 모의 결과를 남기는 기록 대장으로 유지함.
* **추가 필요 사항:** 해당 로그 레코드에 `parentMessageId` 외래키(Foreign Key)를 연결하여 어떤 인앱 메시지에 의해 파생된 외부 발송인지 추적 가능하게 함.

### 3) 기존 도메인 테이블 분석 및 외래키 연계성
* **`payments` (수납):** `id`, `studentId`, `month`, `amount`, `status`('unpaid'/'paid'), `type`('education'/'book').
  * *메시지 연계:* 완납 및 청구 시 메시지 생성 트리거에 활용. `paymentId`를 메시지 테이블에 보관하여 결제 내역 바로가기 지원.
* **`attendance` (출결):** `id`, `studentId`, `date`, `status`('present'/'late'/'absent'), `time`, `leavingTime`.
  * *메시지 연계:* 등하원 시각을 포함한 등하원 메시지함 트리거용 외래키로 `attendanceId` 필요.
* **`bookIssueRequests` (교재 지급):** `id`, `studentId`, `bookId`, `teacherId`, `status`('requested'/'confirmed'/'paid').
  * *메시지 연계:* 원장 승인(`confirmed`) 상태 전환 시 교재비 청구서가 발행되면서 `bookIssueRequestId`를 매핑한 메시지 생성.
* **`majorSchedules` (주요일정):** `id`, `name`, `type`, `eventDate`, `dueDate`, `participantStudentIds`.
  * *메시지 연계:* 원장 선택에 따른 학부모 알림 생성 시 `scheduleId`를 매핑.

---

## 3. 신규 `parentMessages` 데이터 모델 제안

학부모 인앱 메시지함의 핵심 엔티티인 `parentMessages` 데이터 모델을 제안합니다.

### 1) 테이블 스키마 상세

| 필드명 | 데이터 타입 | 필수/선택 | 설명 |
| :--- | :--- | :--- | :--- |
| `id` | String | 필수 | 고유 식별자 (UUID 또는 `PARMSG_` 접두사 자동 생성 키) |
| `academyId` | String | 필수 | 소속 학원(학교) ID |
| `studentId` | String | 필수 | 대상 수강생(자녀) ID |
| `parentUserId` | String | 선택 | 수신받는 학부모 사용자의 고유 ID (회원가입 안 한 경우 Null) |
| `parentSlot` | String | 필수 | 수신 위치 구분 (`parent1` / `parent2`) |
| `recipientPhone` | String | 필수 | 수신 연락처 (개인정보 보호를 위해 마스킹 처리 대상) |
| `recipientName` | String | 필수 | 수신인 이름 |
| `recipientRelation` | String | 필수 | 관계 (`부`, `모`, `조부모` 등) |
| `category` | String | 필수 | 탭 구분 (`notice`, `alert`, `attendance`, `payment`) |
| `type` | String | 필수 | 상세 유형 (카테고리별 세부 타입 매핑) |
| `title` | String | 필수 | 메시지 제목 |
| `body` | String | 필수 | 메시지 본문 내용 |
| `summary` | String | 선택 | 푸시 알림 바디 및 요약 텍스트 |
| `status` | String | 필수 | 메시지함 내 상태 (`unread`, `read`, `archived`, `deleted`) |
| `pushRequired` | Boolean | 필수 | 모바일 기기 푸시 알림 발송 필요 여부 |
| `pushStatus` | String | 필수 | 푸시 전송 상태 (`pending`, `sent`, `failed`, `skipped`) |
| `pushSentAt` | String | 선택 | 푸시 발송 완료 일시 (ISO String) |
| `domainType` | String | 선택 | 원본 도메인 유형 (`attendance`, `payment`, `book_request`, `schedule`) |
| `domainId` | String | 선택 | 원본 도메인의 고유 ID |
| `dedupeKey` | String | 필수 | 중복 발송 및 생성 방지용 고유 비즈니스 키 |
| `createdAt` | String | 필수 | 메시지 생성 일시 (ISO String) |
| `readAt` | String | 선택 | 학부모 읽음 확인 일시 (ISO String) |
| `archivedAt` | String | 선택 | 보관함 보관 처리 일시 (ISO String) |
| `deletedAt` | String | 선택 | 소프트 삭제 처리 일시 (ISO String) |

---

## 4. 카테고리(Category) / 타입(Type) 매핑표

Phase 16A에서 도출된 학부모 대상 소통 정책을 기술적 카테고리와 타입으로 일대일 매핑합니다.

| 카테고리 (`category`) | 상세 타입 (`type`) | 동작 상세 및 전송 정책 |
| :--- | :--- | :--- |
| **`attendance`** | `attendance_check_in` | 등원: 등원 시간 기록 시 발생 (메시지함 + 푸시 즉시 발송) |
| | `attendance_check_out` | 하원: 하원 시간 기록 시 발생 (메시지함 + 푸시 즉시 발송) |
| **`payment`** | `tuition_billing` | 수강료 청구 (수납 안내): 청구서 발행 시 발생 (메시지함 + 푸시) |
| | `tuition_overdue` | 수강료 연체 (미수납 안내): 납기 경과 시 발생 (메시지함 + 푸시) |
| | `tuition_paid` | 수강료 완납 (수납 완료): 납부 완료 시 영수증 형태로 발생 (메시지함 + 푸시) |
| | `book_billing` | 교재비 청구 (교재비 수납 안내): 원장 교재 확인 승인 시 발생 (메시지함 + 푸시) |
| | `book_overdue` | 교재비 연체 (교재비 미수납 확인): 납기 경과 시 발생 (메시지함 + 푸시) |
| | `book_paid` | 교재비 완납 (교재비 수납 완료): 교재비 납부 완료 시 발생 (메시지함 + 푸시) |
| **`alert`** | `schedule_notice` | 주요 일정 안내: 원장이 "학부모 알림에 등록"을 수동 체크 시 발생 |
| **`notice`** | `general_notice` | 학원 전체 공지: 원장이 수동으로 공지사항 발행 시 발생 (푸시 여부 선택) |

### ⚠️ 학부모 메시지 자동 발송 제외 대상 (원장 내부 큐 전용)
* **출결:** `결석 확인`, `지각`, `하원누락`, `연속결석/출결워닝`
* **인사/행정:** `강사 지각`, `강사 미출근`, `강사 퇴근누락`, `강사 지각+퇴근누락`, `강사 라이프사이클`
* **상담/메모:** `운영메모`, `상담 리마인드`, `상담 취소 자동 알림`
* **일정/기타:** `원장 승인 전 강사 교재 요청`, `일정 등록 시 미선택 일정`, `시간표 변경/보강/수업취소`

---

## 5. 학부모1 / 학부모2 수신자 관계 정책

하나의 원생에 대해 학부모 연락처가 최대 2개까지 확장됨에 따라 발생하는 다중 수신 관계 정책입니다.

### 1) 관계성 설계 속성
* `parentSlot` 필드에 `parent1`, `parent2` 값을 할당하여 수신 권한을 분류합니다.
* `recipientPhone`, `recipientName`, `recipientRelation` 정보를 메시지 레코드에 직접 기록(Denormalize)함으로써 학부모 개인의 연락 정보 변경에 유연하게 대응합니다.

### 2) 메시지 생성 정책 후보군
* **A안:** 주 보호자(`parent1`)에게만 메시지 레코드를 생성하고 푸시를 보낸다. (SMS 비용 절감 위주)
* **B안:** 앱 설치/푸시 수신이 활성화된 모든 보호자(`parent1` & `parent2`)에게 각각 개별 레코드를 생성하여 발송한다. (동시 확인 위주)
* **C안 (추천안):** 원생별 수신 설정 및 기기 활성 상태 결합 정책.
  * **원칙:** 등하원, 결제 영수증 등 실시간 확인이 모두 필요한 핵심 도메인은 B안을 적용하여 `parent1`, `parent2` 양쪽에 모두 `parentMessages`를 생성하고 발송합니다.
  * **장점:** 부모가 서로 다른 기기에서 개별적으로 앱을 사용하더라도, 각자의 기기에서 읽음/안읽음(`unread`/`read`) 상태를 온전히 제어할 수 있습니다.

---

## 6. 메시지함과 기기 푸시의 논리적 결합도

시스템 안정성 확보를 위해 메시지 저장소와 푸시 발송 큐는 엄격히 분리되어 관리됩니다.

```
[비즈니스 트리거] 
       │
       ▼
[parentMessages 레코드 생성] ── (실패 시 트랜잭션 롤백)
       │
       ├─► 인앱 메시지함 상태: 'unread'로 즉시 노출 가능
       │
       ▼ (pushRequired = true 인 경우)
[Push Queue 적재: pushStatus = 'pending']
       │
       ├─► FCM/APNs 연동 모듈 발송 시도
       │
       ├───► 성공: pushStatus = 'sent' / pushSentAt 기록
       ├───► 실패: pushStatus = 'failed' (재시도 큐 대기)
       └───► 미설치/수신불가: pushStatus = 'skipped'
```

* **로그 일관성:** 앱 미설치나 기기 알림 차단으로 푸시 발송이 실패하더라도 인앱 메시지함 레코드는 `unread` 상태로 온전히 남아있어 학부모가 앱을 켜면 언제든지 조회가 가능합니다.

---

## 7. 중복 생성 및 발송 방지 정책 (`dedupeKey`)

동일한 출결 태그나 수강료 완납 건에 대해 일시적 네트워크 지연 또는 중복 클릭으로 메시지가 다중 생성되는 사고를 예방하기 위해, 비즈니스 도메인 아이덴티티를 조합한 `dedupeKey` 유일성 제한을 적용합니다.

### 1) 카테고리별 `dedupeKey` 규칙

* **등원:** `ATTENDANCE_CHECK_IN_{studentId}_{date}_{attendanceLogId}`
* **하원:** `ATTENDANCE_CHECK_OUT_{studentId}_{date}_{attendanceLogId}`
* **수납 안내 (청구):** `TUITION_BILLING_{paymentId}`
* **미수납 안내 (연체):** `TUITION_OVERDUE_{paymentId}_{cycle}` 
  * *확장 고려:* 1차 정책은 연체안내 최초 1회만 발송하지만, 향후 n차 독촉을 위해 뒤에 발송 차수 또는 일자 단위(`cycle`) 필드를 열어두어 중복을 제어합니다.
* **수납 완료:** `TUITION_PAID_{paymentId}`
* **교재비 수납 안내:** `BOOK_BILLING_{paymentId}`
* **교재비 미수납 안내:** `BOOK_OVERDUE_{paymentId}_{cycle}`
* **교재비 수납 완료:** `BOOK_PAID_{paymentId}`
* **일정 안내:** `SCHEDULE_NOTICE_{scheduleId}_{noticeVersion}`
  * *버전 관리:* 원장이 알림 문구를 대대적으로 수정한 뒤 명시적으로 "재발송"을 누르는 경우를 대비해 `noticeVersion`을 키에 결합합니다.

---

## 8. 읽음 / 보관 / 삭제 정책

* **상태 전이 흐름:** `unread` ➔ `read` ➔ `archived` ➔ `deleted` (Soft Delete)
* **보관 처리 (`archived`):** 3개월 이상 지난 출결이나 결제 영수증 등은 일반 리스트에서 숨기고 사용자가 필요할 때만 열 수 있도록 보관함으로 자동 이관합니다.
* **소프트 삭제 (`deleted`):** 학부모가 메시지를 삭제하면 `status = 'deleted'` 및 `deletedAt = timestamp`로 마크하여 화면에서 완전히 제외합니다.
* **원장부 영속성:** 학부모가 자신의 앱 화면에서 메시지를 삭제하더라도, 학원의 정산 감사 및 원장의 전송 히스토리 추적을 위해 **실제 DB 레코드는 물리적으로 지우지 않고 보존**합니다.
* **메시지 보존 기간 (정책 확정 필요 후보):** 수강료 완납 영수증 및 출결 데이터는 세무 증빙 및 원생 관리를 위해 최소 **3년 이상 보존(자동 보관함 이동 정책 결합)하는 것을 정책 확정 필요 후보 및 추천안**으로 제시합니다.

---

## 9. 보안 및 개인정보 보호 설계

* **민감 정보 제어:** 모바일 푸시 알림 바디(`summary`)에는 상세 결제 금액, 청구 월, 원생의 실제 상세 위치 정보 등의 민감 데이터를 생략하거나 마스킹하여 표시합니다.
  * *나쁜 예:* "최다은 원생의 6월 수강료 150,000원이 연체되었습니다. 010-8888-2222로 연락 바랍니다."
  * *좋은 예:* "수강료 미납 안내 메시지가 도착했습니다. 학부모 안심 포털에서 상세 내용을 확인해 주세요."
* **전화번호 마스킹:** DB 조회 및 전송 UI 노출 시 학부모 연락처는 `010-****-2222` 형태로 중앙 마스킹 처리하여 운영자의 고의적 정보 유출을 예방합니다.
* **조회 권한 통제:** API 단에서 세션 내 `parentUserId`가 `parentStudentLinks`를 통해 타겟 `studentId`와 정식으로 맺어져 있는지 강제 검증을 거친 후 메시지 데이터를 반환합니다.

---

## 10. 기존 `messages` 및 `outboundMessageLogs`와의 관계

```
[parentMessages (학부모 앱 메시지함)]  ─── (1:N 연관 관계) ───►  [outboundMessageLogs (외부 문자 로그)]
- 카테고리별 비즈니스 원장                 - 알림톡 발송 이력 및 전송 성공 여부
- 읽음 상태 및 보관 관리                  - SMS 통신사 수신 완료 상태 기록
```

* **역할 분리 권고:**
  * `parentMessages`는 학부모 앱 인앱 메시지함의 읽음 상태와 자녀 데이터 매핑을 관리하는 **비즈니스 메인 테이블**입니다.
  * `outboundMessageLogs`는 알림톡/문자 게이트웨이를 거쳐 실제 학부모 휴대폰 망으로 전송된 물리적 로그를 저장하는 **인프라 기록 대장**입니다.
* **연결 설계:** 외부 메시징 모듈에서 알림톡 발송 시, 로그 레코드에 `parentMessageId` 컬럼을 외래키로 추가 적재하여 추후 메시지 상세 화면에서 "알림톡 발송 결과 확인" 링크를 유기적으로 연결합니다.

---

## 11. 구현 단계 로드맵 제안

1. **Phase 16B-1: `parentMessages` 스키마 설계 및 Mock DB 이관**
   * default_db 내 `parentMessages` 초기 리스트 스키마 바인딩 및 state.js 연동 메소드 구축.
2. **Phase 16B-2: 출결 훅(Attendance Hook) 연동 자동 생성**
   * 등하원 키패드 태그 및 출결 변경 시점에 `parentMessages` 레코드를 자동 생성하는 트리거 비즈니스 로직 연동.
3. **Phase 16B-3: 수납/교재 훅(Billing/Book Hook) 연동 자동 생성**
   * 수강료 청구서 발행, 완납 상태 업데이트, 교재 승인 프로세스 내 메시지 자동 발송 트리거 연동.
4. **Phase 16B-4: 학부모 포털 메시지함 UI 및 읽음 처리 구현**
   * 학부모 전용 뷰 화면에 공지/알림/출결/결제 탭 및 목록 제공, 클릭 시 읽음 처리(`read`) API 동기화.
5. **Phase 16B-5: 푸시 전송 Mock 및 예외 처리 고도화**
   * `pushStatus` 변경 시뮬레이션 연동. 푸시 실패 또는 미설치 시 알림톡/문자 대체 채널 발송 정책은 후속 Phase에서 결정하고 연계함.

---

## 12. 최종 권고안 및 요약

1. **독립 모델 구축:** 학부모 앱 메시지함은 기존 messages 모델과 격리하여 **`parentMessages`라는 신규 물리 독립 모델로 구현**합니다.
2. **Push Status 분리:** 메시지함 등록 자체는 즉시 성공하되, 푸시 전송은 별도 백그라운드 처리가 되므로 `pushStatus` 필드를 도입하여 결합도를 느슨하게 유지합니다.
3. **Dedupe Key 필수 적용:** 중복 결제 및 중복 출결 전송 사고는 학원 신뢰도와 직접 연결되므로, 메시지 작성 API 입구 단계에서 **`dedupeKey` 검증을 강제하는 유니크 제약**을 필수 도입합니다.
4. **부모 1/2 확장 유연성 확보:** 1차 정책상 주 보호자 발송을 위주로 하더라도 스키마에는 `parentSlot` 및 `parentUserId` 개별 적재 공간을 사전에 반영하여, 추후 다중 부모 개별 수신 기능 추가 시 스키마 변경 없이 UI와 비즈니스 로직만으로 대응할 수 있도록 구조를 선 보장합니다.
