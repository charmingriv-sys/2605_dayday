# DayDay Chat v2 Context

## 1. 정본 작업 폴더
- **정본 경로**: `C:\Users\charm\OneDrive\문서\2605_dayday`
- **사용 금지 카피 경로**: `C:\Users\charm\Dropbox\100. LLM WIKI\2605_dayday-codex-copy`
- **주의**: 모든 파일 수정, 읽기, E2E 및 유닛 테스트, 커밋 빌드는 반드시 **정본 경로**에서만 수행해야 합니다. 카피 경로는 절대 참조하거나 사용하지 않습니다.

---

## 2. 현재 Git 상태
- **작업 시작 시 Git Status**: `## main...origin/main [ahead 7]`, Working tree is clean.
- **최근 커밋 8개 요약**:
  - `34c54bb` Phase 7F: Add orientation tip to print modal and fix general schedule settings E2E regression flow
  - `1288b6b` docs & feat: Phase 7E-3 print preview export enhancements and clipboard copy
  - `6a7cd9d` [Phase 7E] Refactor print layout selection logic and strengthen print layout bindings in sessionsView.js
  - `1780147` feat: Phase 7E-1 Print preview layout implementation and tests integration
  - `66b949a` docs & feat: complete Phase 7D-3 match schedule operation logs and UI display
  - `0e88561` chore: harden Phase 7D-2 drag E2E bridge and documentation
  - `0109eab` feat(director): complete Phase 7C daily-weekly schedule view enhancements & E2E navigation stability
  - `61f28e8` test: lock Phase 7D-1 schedule override snapshot behavior
- **특이사항**: 로컬 브랜치가 원격 저장소(`origin/main`) 대비 7개의 커밋이 앞서(ahead 7) 있습니다.

---

## 3. 현재까지 완료된 주요 Phase
- **Phase 7A**: 운영 요일/시간/슬롯 설정, 강사/원생 scheduleNotes
- **Phase 7B**: 강사 출근표 일간/주간 뷰 및 UI 토글/필터 연동
- **Phase 7C**: 강사-원생 시간표 일간/주간 뷰 렌더링 및 필터링 기능
- **Phase 7D**: 일정 스냅샷 생성 규칙, 날짜별 일정 Override 및 이동 로그 UI, 드래그앤드롭 영속화 및 Playwright E2E 검증
- **Phase 7E**: A4 규격 프린트 미리보기 팝업, 인쇄 CSS 바인딩, PNG 이미지 파일 다운로드 및 클립보드 복사(캡처 중 로더 표시 포함)
- **Phase 7F**: 설정 이동 완료(학원정보 관리 탭 내에 있던 시간표/인쇄 설정은 강사 시간표 설정 안의 설정 버튼으로 병합) 및 가이드 팁 보완. 단, 주요 기능 QA 중 누락된 핵심 버그가 남아 있음

---

## 4. 현재 미해결 이슈 (실제 브라우저 확인 기준)
자동 E2E 테스트 통과 여부와 상관없이, 실제 사용자가 브라우저에서 아래 버그를 확인하였습니다:

1. **프린트 모달 미작동**
   - 강사 출근표 관리의 주간/일간 출력 버튼이 클릭 시 미리보기 모달을 열지 않습니다.
   - 강사-원생 시간표 관리의 주간/일간 출력 버튼도 클릭 시 모달을 열지 않습니다.
   - 모달이 열리지 않아 PNG 저장 및 이미지 복사 기능도 작동 확인이 불가한 상태입니다.

2. **중복 버튼/필터 미정리**
   - 강사-원생 시간표 관리의 주간 보기 필터 영역에 여전히 중복된 '출력하기' 버튼이 노출되고 있습니다.
   - `당일 수업 강사만` 토글 버튼이 사라지지 않고 남아 있습니다.
   - 일간 보기 전환 시 당일 수업/출근 일정이 없는 강사까지 기본으로 리스트에 노출되는 문제가 있습니다.

3. **원생 특이사항 패널 구조 불일치**
   - 특이사항 영역이 오른쪽 고정 패널 형태로 통일되지 않았습니다.
   - 원생 특이사항 카드가 여전히 3줄 구조(첫 줄: 원생명, 둘째 줄: 담당강사명, 셋째 줄: 특이사항 텍스트)로 노출되고 있습니다.
   - **요구 구조**: 첫 줄 `원생명 담당강사명`, 둘째 줄 `특이사항 텍스트` (2줄 구조)

4. **강사 검색/드롭다운 및 포커스 유실**
   - 일간 보기에서 강사명 검색이 `input + dropdown/datalist` 구조로 제공되지 않고 단순 텍스트 입력만으로 구현되어 있습니다.
   - 검색 input에 한 글자를 입력할 때마다 화면이 리렌더링되어 focus가 날아가는 버그(blur)가 발생하고 있습니다.

5. **설정 버튼 위치 변경 (완료 상태)**
   - 학원정보 관리 탭 내에 있던 시간표/인쇄 설정은 제거되고, 강사 시간표 관리 우측 상단의 설정 버튼을 통해 제어하는 것으로 마이그레이션이 완료되었습니다. (추가 작업 불필요)

---

## 5. 다음 우선순위 (작은 Phase/Repair Phase 원칙)
순서대로 하나씩 독립적인 Repair Phase로 쪼개어 개발을 진행합니다.

1. **Phase 7F-Repair-A: 출력 버튼 실제 동작 복구**
   - 강사 출근표 관리 및 강사-원생 시간표 관리 뷰 우측 상단의 출력 버튼들이 프린트 미리보기 모달을 정상적으로 열도록 복구합니다.
2. **Phase 7F-Repair-B: 참여 강사 기본 필터 및 당일 강사 버튼 제거**
   - 일간 보기에서 선택한 날짜에 근무/수업 일정이 있는 강사만 기본 노출하도록 수정하고, 중복 필터 버튼인 `당일 수업 강사만` 토글을 제거합니다.
3. **Phase 7F-Repair-C: 원생 특이사항 패널 구조 통일**
   - 오른쪽 고정 패널 구조로 UI를 통일하며, 특이사항 표시 카드를 2줄 포맷(`원생명 담당강사명` / `특이사항 텍스트`)으로 수정합니다.
4. **Phase 7F-Repair-D: 강사 검색 input + dropdown 및 포커스 이탈 수정**
   - 강사명 검색 필드를 `input + dropdown` 또는 `datalist` 구조로 구현하고, 입력 중 리렌더링으로 포커스가 이탈하는 현상을 수정합니다.
5. **Phase 7F-Repair-E: 프린트/PNG/클립보드 복사 수동 검증 보정**
   - 출력 모달의 용지 방향 가이드(1개: 가로 권장, 2/3개: 세로 권장)와 복사/다운로드 안정성을 브라우저 수동 검증을 통해 최종 튜닝합니다.

---

## 6. 완료 판단 규칙
1. **자동 테스트 검증**: 로컬 CLI에서 `cmd /c npm run test:full`을 통과해야 합니다.
2. **실제 브라우저 수동 확인 (필수)**: E2E 성공 여부와 무관하게, 수동 확인이 필요한 UI(출력 모달, 검색 포커스, 특이사항 포맷)는 완료 보고서에 **"사용자 확인 필요"** 상태로 표시한 후 사용자가 최종 수동 확인한 뒤에 완전 종결합니다.
3. **커밋**: 작업 완료 시 로컬에 작은 단위로 커밋을 생성합니다.
4. **push 보류**: 사용자가 명시적으로 요청하기 전까지 `git push`는 수행하지 않고 보류합니다.

---

## 7. 다음 LLM에게 주는 작업 전 체크리스트
- [ ] 현재 터미널의 working directory와 작업 경로가 정본 폴더(`C:\Users\charm\OneDrive\문서\2605_dayday`)인지 반드시 확인합니다.
- [ ] `git status` 및 `git log` 명령을 실행해 브랜치 및 커밋 상태를 점검합니다.
- [ ] `chatv2.md` 파일을 끝까지 정독합니다.
- [ ] `pj_daday_skill.md` 파일을 끝까지 정독합니다.
- [ ] 현재 지정된 Repair Phase 범위를 벗어난 다른 파일의 수정이나 대규모 리팩토링은 절대 금지합니다.
