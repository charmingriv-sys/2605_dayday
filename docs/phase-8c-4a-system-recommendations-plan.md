# Phase 8C-4A: 오늘 원장 콘솔 추천확인 Local Provider MVP 설계 문서

본 문서는 오늘 원장 콘솔의 핵심 기능인 **[추천확인]**이 LocalStorage/StateStore 기반의 Local Provider MVP로서 동작하기 위한 비즈니스 정의, 데이터 모델 정책, 시스템 추천 규칙, 아키텍처 제약 및 단계별 구현 계획을 정의합니다.

---

## 1. 추천확인의 제품적 정의
오늘 원장 콘솔의 업무 분류 중 사용자가 직접 기록하는 영역과 시스템이 선제적으로 제기하는 리스크 관리 영역을 명확히 구분합니다.

* **수동 [확인필요] (User-defined Alert)**
  * **주체/출처**: 원장 또는 강사가 운영 중 직접 발견하고 대기 큐에 기입한 업무입니다.
  * **성격**: "XX 어머님 교재 반품 문의 전화 필요", "학원 셔틀 차량 뒷문 잠금장치 수리 확인" 등 사람이 인지하여 명시적으로 생성한 건입니다.
* **시스템 [추천확인] (System-generated Risk Check)**
  * **주체/출처**: 시스템이 학원 데이터(출결, 청구, 수납 등)를 실시간/주기적으로 모니터링하여 자동으로 생성하는 업무입니다.
  * **성격**: 바쁜 원장이나 행정 직원이 일상 속에서 간과하기 쉬운 **운영상의 리스크(Operational Risk)**를 예방하기 위해 시스템이 먼저 캐치하여 상단 큐에 밀어 올려주는 안내/경보입니다.
  * **목적**: 무단 결석 방치 예방, 수당 및 수강료 결제 누락 방지, 원생 이탈 징후에 대한 빠른 대응 등 비즈니스 안정성을 유지합니다.

---

## 2. MVP 추천 규칙 후보 조사
음악학원 MVP의 기존 데이터 스펙 및 API(출결, 수납, 교재 등)를 기반으로 하여 구현 가능한 추천 규칙 후보들을 분석합니다.

### 후보 1: 출결 입력 지연 경보 (Attendance Delay)
* **내용**: 당일 수업(class) 시작 시각으로부터 일정 시간($N$분)이 경과하였음에도 해당 원생에 대한 출결(`attendance`) 기록이 없는 경우 발생합니다.
* **데이터 구조 연계**: `stateStore.getClasses()`를 통해 요일별/시간별 수업을 추출하고, `stateStore.getAttendance()`를 조회하여 당일(date)에 해당 학생의 출결 레코드가 없는지 검사합니다.
* **구현 가능 여부**: **즉시 구현 가능 (MVP 선정)**. 기존 Mock 데이터에 수업 시간과 출결 기록이 잘 분리되어 있어 판단 논리가 명확합니다.

### 후보 2: 교육비 수강료 미납 알림 (Education Billing Unpaid)
* **내용**: 이번 달(YYYY-MM)의 정기 교육비 청구서가 발행되었으나 정기 수납 예정일이 지났음에도 수납 상태가 `paid`가 아닌 상태입니다.
* **데이터 구조 연계**: `stateStore.getPayments()`를 조회하여 `type === 'education'`이고 `month === currentMonth`인 레코드 중 `status !== 'paid'`인 건을 추출합니다. 원생 프로필(`student.dueDay`) 또는 기본 설정의 수납일이 지났는지 비교합니다.
* **구현 가능 여부**: **즉시 구현 가능 (MVP 선정)**. 납부일 경과 여부를 `now` 시점과 비교하여 직관적으로 연산할 수 있습니다.

### 후보 3: 교재비 청구 누락 및 수납 요청 누적 (Book Payment Pending)
* **내용**: 원생에게 새로운 교재가 배정(`studentBooks` 테이블에 매칭 등록)되었으나, 이에 따른 교재비 청구 레코드(`payments.type === 'book'`)가 아예 누락되었거나 `requested` 상태에 머물러 있는 경우 발생합니다.
* **데이터 구조 연계**: `stateStore.getStudentBooks()` 목록의 `paymentId`를 조회하고, 해당하는 `payments` 데이터가 존재하지 않거나 결제가 완료(`paid`)되지 않았는지 체크합니다.
* **구현 가능 여부**: **추후 확인 필요 (MVP 보류)**. 현재 데모 데이터 세팅 시 `seedInitialBookPayments()`가 수행되어 초기에 강제 바인딩되는 로직이 얽혀 있어, 실시간 결제 요청 흐름에 관한 데이터 정합성을 해치지 않도록 세밀한 라이프사이클 설계가 추가로 필요합니다.

### 후보 4: 학부모 상담 예정일 리마인드 (Counseling Reminder)
* **내용**: 원생의 마지막 상담일로부터 일정 기간(예: 30일)이 지났거나, 예약된 상담 날짜가 다가왔을 때 알림을 띄웁니다.
* **데이터 구조 연계**: 현재 `stateStore` 내에 원생별 "마지막 상담일", "상담 주기", "상담 예약 테이블" 등의 정형화된 필드 또는 컬렉션이 표준화되어 있지 않습니다.
* **구현 가능 여부**: **추후 확인 필요 (MVP 보류)**. 원생 메모나 별도 히스토리 테이블 구조의 선행 설계가 필요하므로 이번 MVP 범위에서 제외합니다.

### 후보 5: 오늘 미완료 일정 체크 (Overdue Scheduled Event)
* **내용**: 오늘 예정된 수동 메모나 일정 중 종료 시각(`endAt`) 또는 마감 시각(`dueAt`)이 지났음에도 여전히 완료(`done`)되지 않고 `open` 상태에 머물러 있는 건을 경고합니다.
* **데이터 구조 연계**: `stateStore.getTodayTasks()`의 `endAt`/`dueAt` 값을 `now`와 비교하여 미완료 건을 강조합니다.
* **구현 가능 여부**: **추후 확인 필요 (MVP 보류)**. 이것은 신규 추천 업무의 생성이라기보다는 기존 태스크 카드의 CSS/스타일 경고(Overdue 강조)에 가까우므로, 별도의 추천 규칙 Provider로 두기보다는 뷰 렌더링 영역의 고도화로 분리합니다.

---

## 3. Phase 8C-4A-1 실제 구현할 추천 규칙 선정
가장 명확하고 부작용이 없으며, 기존 로컬 Mock 데이터를 활용해 즉시 검증할 수 있는 **2가지 규칙**을 MVP 대상으로 최종 선정합니다.

1. **[선정] 규칙 1: 출결 입력 지연 (Attendance Delay Check)**
   * **지연 판단 기준**: 수업 시작 시각(`class.time`)으로부터 **15분** 경과 시점.
   * **검증 가능성**: 오늘 예약된 수업 명단 중 현재 시각 기준 15분이 지났으나 출결(`attendance`) 상태가 'none'이거나 기록 자체가 없는 건을 찾아 추천 카드를 발행합니다.
   * **격리**: 외부 출결 태깅기 API나 기기 통신 없이, `stateStore`에 적재된 로컬 데이터만을 기반으로 연산합니다.
2. **[선정] 규칙 2: 당월 수강료 미납 (Unpaid Billing Check)**
   * **미납 판단 기준**: 당월(YYYY-MM) 교육비 수강료(`type === 'education'`) 중 결제일(`student.dueDay` 또는 기본값 10일)이 지났음에도 `status !== 'paid'`인 건.
   * **검증 가능성**: `stateStore.getPayments()` 및 `stateStore.getStudent(id)`의 dueDay 속성을 크로스 체킹하여 추천 카드를 발행합니다.
   * **격리**: 외부 토스/카카오페이 PG API나 가상 계좌 조회 없이, `stateStore` 내 수납 상태 필드만을 참조합니다.

---

## 4. TodayTask 생성 정책
시스템 추천으로 생성되는 `TodayTask` 인스턴스는 아래의 표준 필드 정책을 엄격히 준수하여 정규화됩니다.

* **`source`**: `'system'` (시스템이 자동 발행한 추천 업무임을 식별)
* **`category`**: `'system_check'` (뷰 렌더러에서 보라색 '추천확인' 뱃지 표시용)
* **`priority`**: `'today'` (과도한 시각 경보를 막기 위해 'today' 가중치 부여, 단 출결 지연 등 즉각 조치 필요 건은 `'urgent'` 지정 가능)
* **`dedupeKey` 규칙**:
  * 중복 적재 및 큐 도배 방지를 위해 고유한 비즈니스 키를 강제합니다.
  * **출결 지연**: `SYSTEM_RECOMMEND_ATTENDANCE_LATE_[studentId]_[YYYY-MM-DD]`
  * **수납 미납**: `SYSTEM_RECOMMEND_BILLING_UNPAID_[paymentId]_[month]`
* **`status`**: 기본값 `'open'`
* **시간 값 (`startAt` / `endAt` / `dueAt`)**:
  * **출결 지연**: `dueAt = 수업 시작 시각 + 15분`, `startAt = 수업 시작 시각`, `endAt = 수업 시작 시각 + 1시간` (일정 타임라인과 캘린더에 병렬 노출될 수 있도록 시간 값 매핑)
  * **수납 미납**: `dueAt = 당월 결제일의 09:00`, `startAt = 당월 결제일 09:00`, `endAt = 당월 결제일 10:00`
* **`visibilityRoles`**: `['director']` (원장용 권한 제한)
* **동작 바인딩 (`actionType` & `actionPayload`)**:
  * 해당 추천 카드를 클릭하거나 조치할 때 관련 화면으로 바로 이동하도록 액션을 부여합니다.
  * **출결 지연**: `{ actionType: 'NAVIGATE', actionPayload: { route: '/attendance', studentId: '[studentId]' } }`
  * **수납 미납**: `{ actionType: 'NAVIGATE', actionPayload: { route: '/billing', studentId: '[studentId]' } }`

---

## 5. Provider 구조 제안
화면 렌더링 뷰(`todayConsoleView.js`) 내부에 비즈니스 분석 및 추천 생성 로직을 섞어 짜는 기존 방식을 피하고, **Segment-First Architecture**에 의거하여 추천 관리 계층을 분리 설계합니다.

```
[ stateStore.syncSystemRecommendations(now) ]
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
 [AttendanceRecommendation] [BillingRecommendation]
        │                         │
        └────────────┬────────────┘
                     ▼
  [ stateStore.addTodayTask() (Dedupe 적용) ]
```

* **StateStore Public API 설계**
  * `stateStore` 싱글톤 프로토타입에 아래 API를 추가합니다:
  * **`stateStore.syncSystemRecommendations(now = new Date())`**
    * 매 콘솔 화면 로딩 시점, 혹은 출결/수납 이벤트가 발생할 때 호출되는 트리거 역할을 합니다.
    * 내부적으로 각 추천 룰(Provider)을 순회하며 추천이 필요한 태스크를 `addTodayTask`를 통해 큐에 자동 적재(Upsert)하고, 기존 추천 중 이미 원인이 해소된 건(예: 출결이 등원 처리되었거나, 수강료가 수납 완료된 건)을 자동 감지하여 `'done'` 처리하거나 만료시킵니다.
* **Segment-First Recommendation Rules (중립 구조)**
  * 각각의 추천 규칙을 독립적인 클래스 혹은 룰 객체로 구현하여 `rules` 배열에 관리합니다:
    ```javascript
    const systemRecommendationRules = [
        attendanceDelayRule,
        billingUnpaidRule
    ];
    ```
  * 각 룰 객체는 `check(db, now)` 인터페이스를 지니며, 조건 만족 시 `TodayTask` 규격에 맞는 객체 배열을 반환합니다.
  * 이러한 구조를 통해, 향후 구글 캘린더나 외부 알림톡 연동(Provider)이 고도화되거나 음악학원 외에 피트니스(PT), 개인 레슨 등 타 업종 세그먼트로 확장되더라도 룰 리스트만 config에 맞게 조합 교체하여 사용할 수 있게 설계합니다.

---

## 6. 사용자 수동 확인 방식
추천을 통해 등록된 태스크가 화면 상에서 어떻게 표시되고 완결되는지 UX 흐름을 확정합니다.

* **시각적 노출**
  * **운영대기업무 리스트 (하단 좌측)**: 보라색 `추천확인` 뱃지와 함께 목록 상에 정렬되어 배치됩니다. (시간순 정렬 정책에 따라 `startAt` 또는 `dueAt` 시간에 맞춰 스케줄링됨)
  * **오늘 일정 캘린더 (하단 우측)**: `startAt`과 `endAt`이 설정된 추천 태스크는 일간 캘린더 타임라인의 해당 시간대에 보라색 칩으로 투영되어 표시됩니다.
* **완결(수동 확인) 방식**
  * 원장이 추천 카드의 `[확인 완료]` 버튼(혹은 완료 아이콘)을 누르면 해당 태스크는 `'done'` 상태로 전환됩니다.
  * **완료 피드백 유지**: 완료 처리된 추천확인 역시 일반 완료 업무와 동일하게 취소선, 50% 반투명도, 회색 필터링을 입고 화면(캘린더 칩 및 대기업무 큐)에 오늘 하루 동안 보존되어 성취감을 제공합니다.
* **자동 완료 피드백 (Auto-resolve)**
  * 사용자가 수동으로 버튼을 누르지 않더라도, 원천 데이터의 상태가 해결(예: 출결 지연 추천 대상자가 등원으로 체크인되거나, unpaid 상태였던 billing 내역이 paid로 전환됨)되면 `syncSystemRecommendations` 구동 시 해당 태스크를 `'done'` 상태로 자동 업데이트하여 큐를 정리합니다.

---

## 7. 다음 Phase 제안

### Phase 8C-4A-1: 추천확인 Local Provider 구현
* **목표**: StateStore 영역에 추천 규칙 엔진(Attendance, Billing) 및 `syncSystemRecommendations` API를 구축하고 단위 테스트를 완결합니다.
* **주요 작업**:
  * [ ] `src/js/state/todayTask.js` 내에 추천 규칙 동기화 메소드 구현
  * [ ] `dedupeKey` 매핑 및 이미 해결된 추천에 대한 자동 `done` 처리 로직 개발
  * [ ] `tests/unit/today_recommendations_test.mjs` 신설을 통한 유닛 테스트(과거/현재 시점 mock 검증) 100% 통과 보장

### Phase 8C-4A-2: 추천확인 UI 렌더링 및 수동 확인 보강
* **목표**: 렌더링 파이프라인에 추천 동기화 트리거를 연결하고, UI 상에서 추천확인 카드의 액션 버튼 및 자동 리렌더링 흐름을 안정화합니다.
* **주요 작업**:
  * [ ] `todayConsoleView.js` 렌더링 진입 시 `stateStore.syncSystemRecommendations()` 호출 연동
  * [ ] 출결 변경 및 수납 변경 시점에 동기화 트리거를 연동하여 추천 카드 실시간 반응 확보
  * [ ] 추천확인 뱃지 및 캘린더 보라색 칩 스타일 고도화 및 E2E 테스트(Playwright) 시나리오 작성

### Phase 8D: Google Calendar 실제 읽기 연동
* **목표**: Mock 데이터로 다루던 외부 일정을 실제 Google API 및 OAuth 클라이언트 연동으로 전환하고 캘린더 오버레이를 완결합니다.
