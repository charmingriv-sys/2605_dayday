# Phase 8B: TodayTask 데이터 모델 및 LocalStorageAdapter 반영 설계 문서

본 문서는 오늘 할 일 큐(TodayTask Queue)를 영속화하고, 비즈니스 및 상태 로직을 구현하기 위해 `stateStore` 및 `LocalStorageAdapter`를 고도화하는 데이터 스토어 설계 지침입니다.

---

## 1. 현재 stateStore / LocalStorageAdapter 구조 요약

DayDay 어플리케이션은 상태 데이터를 다음과 같이 격리하여 관리하고 있습니다.
*   **`src/js/state.js`**: `StateStore` 클래스를 정의하고, 단일 싱글톤 인스턴스인 `stateStore`를 생성하여 노출합니다. 또한 앱 최초 구동 시 사용하는 디폴트 데이터 구조인 `DEFAULT_DB` 상수를 들고 있습니다.
*   **`src/js/state/` 하위 모듈**: 도메인별 기능 메소드(예: `attendance.js`, `billing.js` 등)를 분리 정의한 뒤, `state.js`에서 `Object.assign(StateStore.prototype, ...)` 방식으로 동적 주입(Prototype Injection)합니다.
*   **`src/js/state/adapters/localStorageAdapter.js`**: `localStorage`에 데이터를 동기식/비동기식으로 영속화하는 어댑터 클래스입니다. `normalizeSnapshot(db)` 메소드를 내장하여, 앱이 구동될 때 데이터베이스 스키마 마이그레이션 및 누락된 테이블/속성의 기본값 자동 초기화(Seeding)를 통합 제어합니다.

### 1.1 StateStore Public API 엄격 준수 원칙
*   **직접 접근 금지**: UI 화면이나 외부 어댑터 모듈에서 `stateStore.db` 내부 원본 데이터 속성에 직접 조회하거나 수정하는 행위를 절대 금지합니다.
*   **독립 차단**: TodayTask 기능 또한 외부 파일에서 상태 조작을 할 때 반드시 `stateStore`에 정의될 `addTodayTask`, `updateTodayTask`, `getTodayTasks` 및 공식 셀렉터(Selector) API만을 경유하여 안전하게 호출하도록 통제합니다.

---

## 2. TodayTask 및 관련 컬렉션 추가 방식

어플리케이션 구동 및 기존 유저의 데이터 보존성을 확보하기 위해 다음 두 단계로 컬렉션들을 추가합니다.

### 2.1 신규 생성 테이블
1.  `todayTasks`: 당일 생성된 실행 태스크 인스턴스 저장소
2.  `todayTaskRoutines`: 매일/매주/매월 반복되는 루틴 업무의 **원본 규칙(Rule/Template)** 저장소
3.  `mockCalendarEvents`: Google Calendar 읽기 동작을 모사하기 위한 로컬 모크 데이터 저장소

### 2.2 `src/js/state.js` 디폴트 세팅
*   `DEFAULT_DB` 객체 내부에 `todayTasks: []`, `todayTaskRoutines: []`, `mockCalendarEvents: []` 컬렉션을 신설하여 신규 진입 유저에게 공백 배열을 할당합니다.

### 2.3 `localStorageAdapter.js` 마이그레이션 등록
*   `normalizeSnapshot(db)` 함수 내부에 다음의 자동 마이그레이션 코드를 주입하여 하위 호환성을 보장합니다.
    ```javascript
    if (!db.todayTasks) {
        db.todayTasks = [];
        migrated = true;
    }
    if (!db.todayTaskRoutines) {
        db.todayTaskRoutines = [];
        migrated = true;
    }
    if (!db.mockCalendarEvents) {
        db.mockCalendarEvents = [];
        migrated = true;
    }
    ```

---

## 3. 다중 출처 데이터의 TodayTask 정규화(Normalization) 모델

다양한 비즈니스 데이터 출처로부터 들어오는 정보는 `Academy Adapter` 및 `Provider Layer` 인터페이스를 거쳐 `TodayTask` 표준 규격으로 일관성 있게 규격화(Normalize)됩니다.

```
[출처: System Alert]     ---> s.attendance / p.status 판단 ---> TodayTask { source: 'system', type: 'attendance'|'billing' }
[출처: Manual Memo]      ---> 원장 수동 스케줄 입력 ----------> TodayTask { source: 'manual', type: 'memo' }
[출처: Google Calendar]  ---> OAuth / API 읽기 오버레이 ------> TodayTask { source: 'google_calendar', type: 'calendar' }
[출처: Recurring Rule]    ───(스토어 생성 스크립트 가동)─────> TodayTask { source: 'recurring', type: 'closing' } (실행 인스턴스)
```

### 3.1 원본 규칙(Rule) vs 실행 인스턴스(Instance)의 분리
*   **반복 규칙 (`todayTaskRoutines`)**:
    - 반복 업무의 스펙(예: "매주 월요일 오후 9시 마감 정산", "매월 10일 세무 자료 전송")을 정의하는 **메타데이터 템플릿(Rule)**입니다.
    - 필드 구성: `id`, `title`, `description`, `recurrence` (daily|weekly|monthly), `recurrenceDetail` (요일 또는 날짜), `priority`, `visibilityRoles`, `createdAt` 등
*   **실행 태스크 (`todayTasks`)**:
    - 위 규칙에 기반하여 특정 날짜에 맞춰 생성된 **실제 실행 레코드(Instance)**입니다.
    - 예를 들어, 매주 월요일 루틴 규칙에 의해 "2026-06-02" 날짜에 대응하는 인스턴스 `TodayTask`가 자동으로 발급되어 큐에 적재되고, 완료 여부(`status`)가 인스턴스별로 추적됩니다.

### 3.2 정규화 매핑 설계
*   **System Alert (출결 누락 경보)**:
    - 수업 시작 후 `attendanceLateThresholdMinutes` 분이 지나도 출결 체크가 없는 학생을 감지하여 태스크로 변환합니다.
    - `dueAt`은 수업 시작 시각 + 지연 한계값으로 자동 계산됩니다.
*   **Manual Memo (수동 메모)**:
    - 원장이 지정한 대상 일자(`dueAt`)에 맞춰 태스크로 취급됩니다.
*   **Google Calendar (외부 일정)**:
    - Google API에서 가져온 `event` 목록을 어댑터에서 일일이 파싱하여 `externalId`를 맵핑하고 큐에 합류시킵니다.
*   **Recurring Routine (반복 루틴)**:
    - `todayTaskRoutines`에 보존된 규칙을 검사하여, 오늘 날짜에 생성된 인스턴스가 존재하지 않는 경우 `todayTasks`에 생성 및 주입합니다.
    - `dueAt`은 당일 자정 부근(`23:59`)으로 자동 계산됩니다.

---

## 4. TodayTask 필드 최종 스펙

TodayTask 객체의 세부 자료형 명세서입니다.

```typescript
interface TodayTask {
    id: string;                         // UUID 고유 식별자
    organizationId: string;             // 테넌트 격리 키 ('academyId'와 1:1 호환)
    segment: string;                    // 활성 세그먼트 (예: 'academy_director_console')
    domain: 'academy' | 'fitness' | 'general'; // 비즈니스 영역
    source: 'system' | 'manual' | 'google_calendar' | 'recurring'; // 데이터 출처
    type: 'attendance' | 'billing' | 'pickup' | 'book' | 'risk' | 'praise' | 'marketing' | 'calendar' | 'closing' | 'memo'; // 태스크 유형
    priority: 'urgent' | 'today' | 'closing' | 'info'; // 우선순위
    status: 'open' | 'snoozed' | 'done' | 'dismissed'; // 상태 코드
    dueAt: string;                      // 마감 예정 시각 (ISO 8601 String)
    title: string;                      // 화면 노출용 간략 제목
    description?: string;               // 세부 기술 설명
    relatedStudentIds?: string[];       // 연관 학생(고객) ID 목록
    relatedTeacherIds?: string[];       // 연관 강사(직원) ID 목록
    dedupeKey?: string;                 // 중복 방지용 고유 비즈니스 키
    externalId?: string;                // 구글 캘린더 등 외부 원본 식별 ID
    provider?: string;                  // 연동 제공자 식별자 (예: 'google_calendar')
    snoozedUntil?: string;              // 보류 상태의 해제/재노출 시각 (ISO String)
    completedAt?: string;               // 완료 처리된 시각 (ISO String)
    dismissedAt?: string;               // 숨김/제외 처리된 시각 (ISO String)
    visibilityRoles: string[];          // 화면 노출 권한 필터 (예: ['director'])
    actionType?: 'NAVIGATE' | 'SEND_SMS' | 'MODAL_OPEN'; // 클릭 시 실행할 동작 유형
    actionPayload?: Record<string, any>; // 동작 수행을 위한 메타데이터 객체
    createdAt: string;                  // 생성 일시 (ISO String)
    updatedAt: string;                  // 수정 일시 (ISO String)
}
```

---

## 5. 중복 생성 방지 규칙 (De-duplication Rules)

동일한 비즈니스 사유로 태스크가 중복 쌓여 큐를 도배하지 않도록 `dedupeKey` 속성을 기준으로 강제 중복 검사를 수행합니다.

### 5.1 dedupeKey 생성 공식 예시
*   **출결 지연 경보**: `ATTENDANCE_LATE_[StudentId]_[YYYY-MM-DD]`
*   **수납 납부 알림**: `BILLING_UNPAID_[StudentId]_[BillingMonth]`
*   **구글 캘린더 연계**: `GOOGLE_CALENDAR_[EventId]`
*   **일일 반복 마감 루틴**: `RECURRING_CLOSING_[RoutineKey]_[YYYY-MM-DD]`

### 5.2 큐 적재 프로세스
```
[태스크 생성 요청] 
      │
      ▼
[dedupeKey 존재 여부 확인] ──(없음)──> [큐에 즉시 삽입]
      │
     (있음)
      ▼
[기존 큐 내 동일 dedupeKey 검색]
      │
     (발견됨) ──> [기존 태스크의 title, description, updatedAt 최신 업데이트 (Upsert)]
      │
     (미발견) ──> [큐에 신규 삽입]
```

---

## 6. Status 상태 전환 규칙 (State Transition Engine)

태스크의 생명 주기는 다음과 같은 유한 상태 기계(FSM) 흐름을 따릅니다.

```
                  ┌────────────── snoozed (보류) ──────────────┐
                  │                 ▲  │                      │
                  │             (보류) │ (대기 시간 만료)       │
                  ▼                 │  ▼                      ▼
  [생성] ───> open (대기) ───────────────────────────────> done (완료)
                  │
                (숨김)
                  ▼
            dismissed (제외)
```

1.  **`open` $\rightarrow$ `done` (완료)**:
    - 원장이 화면에서 완료 버튼을 누르거나, 시스템 연동 조건이 달성되면 상태가 `done`으로 변경되며 `completedAt`에 현재 시간이 기록됩니다.
2.  **`open` $\rightarrow$ `snoozed` (보류)**:
    - 원장이 "1시간 뒤 다시 알림" 또는 "내일 다시 알림"을 지정하면, 상태가 `snoozed`로 변경되며 `snoozedUntil`에 노출 재개 시점이 설정됩니다.
3.  **`snoozed` $\rightarrow$ `open` (활성 상태 복구)**:
    - 현재 시스템 시각(인자로 전달받을 `now`)이 `snoozedUntil` 값보다 늦거나 같아지면 (`snoozedUntil <= now`), 셀렉터 레벨에서 자동으로 활성(`open`) 상태인 것처럼 판단하여 화면에 다시 노출시킵니다.
4.  **`open` $\rightarrow$ `dismissed` (제외/숨김)**:
    - 처리 대상은 아니지만 큐에서 지우고자 할 때 제외 처리를 수행하며, `dismissedAt`에 처리 일시가 매핑됩니다.

---

## 7. MVP 외부 연동 모킹(Mocking) 설계

MVP 단계에서는 복잡한 Google API 연동 환경(OAuth 인증, 리디렉션, Token 리프레시) 구축에 대한 결함을 차단하기 위해 **Mock Provider**를 활용하여 데이터 결합 안정성을 선 검증합니다.

### 7.1 Mock 데이터 컬렉션 (`mockCalendarEvents`) 구조
실제 Google Calendar의 API 응답 구조를 모사하여 `LocalStorage` 내에 저장될 데이터 필드 정의입니다.
*   `externalId`: 외부 캘린더 원본 고유 ID (예: `evt_10928301982`)
*   `provider`: 연동 제공자 식별용 (`'google_calendar'`)
*   `calendarId`: 대상 캘린더 ID (예: `primary` 또는 `academy_schedule`)
*   `title`: 일정 제목
*   `description`: 일정 상세 내용
*   `startsAt`: 일정 시작 시간 (ISO 8601 String)
*   `endsAt`: 일정 종료 시간 (ISO 8601 String)

### 7.2 Provider Layer 설계 및 API 호환성
*   **인터페이스 기반 구조**: `mockCalendarEvents`를 파싱하여 `TodayTask` 큐에 동적으로 투영해주는 인터페이스를 둡니다.
*   **교체 확장성**: **Phase 8D**에 도달할 때 이 Mock 로컬 데이터 스토어 대신, 실제 OAuth 자격 증명 기반의 Google Calendar API 네트워크 커넥터 모듈(`GoogleCalendarProvider`)로 투명하게 구현체를 스왑할 수 있도록 추상화 설계합니다.

### 7.3 테스트 검증 흐름
*   임의의 구글 캘린더 일정 JSON 데이터를 모크로 적재 $\rightarrow$ `stateStore`에 연동 $\rightarrow$ `todayTasks` 목록 내에 `google_calendar` 타입의 태스크가 정상 정렬되어 노출되는지 브라우저 및 단위 테스트에서 점검합니다.

---

## 8. Phase 8B 세부 마일스톤 제안

구조적 안전을 위해 Phase 8B를 다음과 같이 4단계의 마일스톤으로 세분화하여 순차 구현할 것을 제안합니다.

*   **Phase 8B-1: 데이터 스키마 설계 및 어댑터 마이그레이션**
    - `src/js/state.js` 내에 `DEFAULT_DB.todayTasks`, `DEFAULT_DB.todayTaskRoutines`, `DEFAULT_DB.mockCalendarEvents` 기본 구조를 세팅합니다.
    - `localStorageAdapter.js` 내에 누락이 감지되었을 경우의 normalization 분기를 구축하고 하위 호환성을 검증합니다.
*   **Phase 8B-2: `stateStore` Public API 구현**
    - 뷰(View)에서 원본 스토어에 직접 접근하는 것을 원천 금지하고, 엄격하게 Public API만을 경유하여 데이터를 관리하도록 랩핑합니다.
    - 태스크 추가(`addTodayTask`), 수정(`updateTodayTask`), 조회(`getTodayTasks`) 메소드를 포함하는 [todayTask.js](file:///C:/Users/charm/OneDrive/문서/2605_dayday/src/js/state/todayTask.js) 모듈을 신설하고 `StateStore.prototype`에 주입합니다.
*   **Phase 8B-3: TodayTask Merge 및 Selectors 로직 작성**
    - 수동 메모 데이터, 시스템 이벤트 알람, 모크 구글 캘린더 데이터를 취합하여 정렬하는 셀렉터 API(`getActiveTodayTasks(now)`)를 개발합니다.
    - **테스트 편의성 제공**: 셀렉터가 외부로부터 `now` 인자(기준 시각)를 주입받아 작동하도록 설계하여, `snoozedUntil` 판단 시각을 모크 시점으로 강제 제어할 수 있는 유닛 테스트 환경을 제공합니다.
    - **우선순위 가중치 맵핑**:
      - `urgent`: 0
      - `today`: 1
      - `closing`: 2
      - `info`: 3
    - **정렬 파이프라인**: 1차 `priority` 오름차순(숫자가 작을수록 높은 순위), 2차 `dueAt` 오름차순(시간이 빠를수록 우선순위), 3차 `createdAt` 오름차순 순서로 정렬 규칙을 강제 적용합니다.
*   **Phase 8B-4: 데이터 비즈니스 유닛 테스트 작성**
    - `tests/unit/today_task_store_test.mjs` 파일을 신설하여 상태 로깅, 중복 제거 검증, 우선순위 정렬 정합성, 그리고 `now` 주입에 따른 `snoozedUntil` 보류 상태 해제 및 재노출이 로직대로 잘 굴러가는지 E2E 구동 전에 유닛 테스트로 완벽하게 선 검증합니다.
