# DayDay 릴리즈 베이스라인 고정 및 검증 명세서 (Phase 6G)

본 문서는 DayDay 음악학원 관리 ERP MVP의 Phase 3부터 Phase 6F까지 누적된 상태 관리 고도화, 뷰 레이어 모듈 분할, 데이터 어댑터 아키텍처 수립 및 보안/배포 기획안 수립 상태를 확증하고 릴리즈 베이스라인을 고정하기 위한 문서입니다.

---

## 1. 현재 베이스라인의 의미 및 완성 아키텍처

본 단계의 완료는 실제 상용 원격 백엔드(Supabase) 및 정적 호스팅(Netlify/Vercel) 배포로 전환하기 전, **프론트엔드 모듈의 결합도 해제와 가상 입출력 캡슐화가 완결**되었음을 의미합니다.

### 1.1 분리 및 캡슐화 완성도
- **StateStore 도메인 모듈화**: `state.js` 본문이 9대 하위 도메인 모듈로 분할되어 주입되는 구조가 안착되었습니다.
- **View 레이어 직접 접근 차단**: 모든 뷰(View) 컴포넌트는 `stateStore.db` 내부 구조에 직접 침투하지 않고 Public API 메소드만을 호출합니다.
- **데이터 어댑터(Adapter) 레이어 격리**: 
  - `dataAdapter.js` 인터페이스에 부합하는 `LocalStorageAdapter`가 영속성을 전담하도록 StateStore 본문과의 분리가 완료되었습니다.
  - `SupabaseAdapter` 스켈레톤 클래스가 SDK 결합 없이 설계되어 런타임에 영향을 주지 않고 안전하게 대기 중입니다.

---

## 2. 아직 실제 연결하지 않은 사항 (격리 준수 범위)

안정적인 로컬 MVP 동작을 위해 본 베이스라인에서는 다음 사항들을 모킹/설계 문서 수준으로 유지하며, 소스코드 및 외부 SDK 결합을 배제합니다.
1. **Supabase SDK**: `@supabase/supabase-js` 패키지 미설치 및 클라이언트 미생성.
2. **Supabase Auth**: 소셜 로그인 및 사용자 계정 DB 연동 없음 (가상 데모 로그인 유지).
3. **PostgreSQL RLS**: 행 레벨 보안 정책의 실제 DB 테이블 바인딩 미실행 (설계 DDL DRAFT 문서로만 존재).
4. **Toss Pay**: Toss 가상 결제창 연동 상태 유지 (실결제 API 미연동).
5. **Kakao 알림톡**: 브라우저 알림 및 콘솔 로그 출력 (실제 발송 API 미연동).
6. **Netlify / Vercel 배포**: 빌드 설정 및 플랫폼 릴리즈 미실행 (배포 시나리오 및 변수 전략 문서로만 존재).

---

## 3. 현재 안전하게 완료된 아키텍처 결과물

- **[인터페이스]** [dataAdapter.js](file:///C:/Users/charm/OneDrive/문서/2605_dayday/src/js/state/adapters/dataAdapter.js)
- **[로컬어댑터]** [localStorageAdapter.js](file:///C:/Users/charm/OneDrive/문서/2605_dayday/src/js/state/adapters/localStorageAdapter.js) (load/save 스냅샷 및 DB normalization 분리 구현 완비)
- **[스켈레톤]** [supabaseAdapter.js](file:///C:/Users/charm/OneDrive/문서/2605_dayday/src/js/state/adapters/supabaseAdapter.js) (의존성 주입 형태의 Mock/Stub 구조 수립)
- **[설계서 및 기획안]**
  - [supabase-adapter-plan.md](file:///C:/Users/charm/OneDrive/문서/2605_dayday/docs/supabase-adapter-plan.md) (어댑터 맵핑 계획)
  - [auth-rls-plan.md](file:///C:/Users/charm/OneDrive/문서/2605_dayday/docs/auth-rls-plan.md) (인증/권한 격리 기획안)
  - [supabase-rls-policy-draft.sql](file:///C:/Users/charm/OneDrive/문서/2605_dayday/docs/supabase-rls-policy-draft.sql) (PostgreSQL RLS SQL 초안)
  - [deployment-preview-plan.md](file:///C:/Users/charm/OneDrive/문서/2605_dayday/docs/deployment-preview-plan.md) (배포 프로세스 전략)
  - [environment-variable-plan.md](file:///C:/Users/charm/OneDrive/문서/2605_dayday/docs/environment-variable-plan.md) (환경변수 기밀 격리)
  - [release-readiness-checklist.md](file:///C:/Users/charm/OneDrive/문서/2605_dayday/docs/release-readiness-checklist.md) (자가 검증 체크리스트)

---

## 4. 다음 단계 (Phase 6H)에서 수행할 작업

1. **Supabase 클라이언트 통합 준비**:
   - `supabase-js` 라이브러리를 안전하게 import 하는 비동기 인스턴스 팩토리 설계.
2. **SupabaseAdapter 읽기 쿼리 구현**:
   - `fetchAllDomainData()`를 통해 organizations, user_profiles, students 등 주요 테이블을 select 하여 동기식 스냅샷으로 바인딩하는 최초의 연동 구현.
3. **점진적 쓰기 갱신**:
   - `persistDomain()`을 이용한 도메인 영역별 비동기 백엔드 플러시 구현.

---

## 5. 커밋 전 최종 확인 체크리스트

- [ ] `node --check` 및 `smoke_test.mjs` 검사 정상 통과 완료.
- [ ] `.env` 및 백업용 파일이 `.gitignore`를 통해 Git 추적 범위에서 배제되었는지 검증.
- [ ] 정본 폴더(`C:\Users\charm\OneDrive\문서\2605_dayday`) 내 파일들만 수정 범위에 들어갔는지 git status 확인.
- [ ] 원장, 강사, 학부모, 태블릿 화면이 로컬스토리지 환경에서 기존과 100% 동일하게 렌더링되고 에러가 없는지 수동 작동 확인.
- [ ] Git Remote URL에 기밀 토큰 정보 미검출 최종 확증.
