# DayDay 정적 배포 및 Preview 환경 구성 전략 (Phase 6F)

본 문서는 DayDay 음악학원 MVP 애플리케이션을 외부 클라우드 플랫폼에 정적으로 서빙하고, 안정적으로 다중 환경(Preview, Production)을 운영하기 위한 배포 계획서입니다.

---

## 1. 현재 프로젝트 구조 기준 배포 방식 판단

### 1.1 배포 환경 판단
- **정적 서빙 프로젝트**:
  - 현재 DayDay는 Webpack/Vite 등의 번들러가 없는 순수 정적 HTML/CSS와 브라우저 기본 지원 ES Modules(ESM) JavaScript 구조입니다.
  - 별도의 트랜스파일링이나 빌드 프로세스가 필요하지 않으므로, 정적 호스팅(Static Web Hosting) 방식을 기본적으로 사용합니다.
- **`server.js` 배포 불필요성**:
  - 로컬 환경의 `server.js`는 단순한 정적 파일 반환 및 ESM 파일의 MIME-type 처리를 돕는 Node-Static 로컬 데브 서버입니다.
  - 클라우드 배포(Netlify/Vercel 등) 환경에서는 자체 CDN에서 이 호스팅 서빙 처리를 전담하므로 **`server.js`를 프로덕션 서버에서 기동할 필요가 없습니다.**

---

## 2. 호스팅 플랫폼 비교 (Netlify vs Vercel)

| 비교 항목 | Netlify | Vercel | DayDay 적합도 |
| :--- | :--- | :--- | :--- |
| **정적 ESM 서빙** | 매우 우수 (설정 없이 즉시 호스팅) | 매우 우수 (설정 없이 즉시 호스팅) | 공통 우수 |
| **Preview 배포** | Pull Request 단위 프리뷰 링크 제공 | Pull Request 단위 프리뷰 링크 제공 | 공통 우수 |
| **서버리스 연동** | Netlify Functions 제공 (AWS Lambda 기반) | Vercel Serverless/Edge Functions 제공 | 공통 우수 |
| **환경변수 관리** | UI 상에서 다중 환경변수 및 스코프(Context) 관리 편리 | 프로젝트 설정 내 환경변수 관리 및 세분화 우수 | 공통 우수 |
| **추천 결론** | **Netlify 또는 Vercel 모두 적합**. 초기에는 프리뷰 빌드 속도가 일정하며 헤드리스 정적 자원 전달에 최적화된 **Netlify**를 1순위로 하되, 향후 Next.js/Vite 등의 프레임워크 확장 시에는 **Vercel** 전환을 염두에 둡니다. |

---

## 3. 다중 배포 환경 및 브랜치 운영 전략

안정적인 릴리즈를 위해 환경을 3단계로 분리하여 격리합니다.

```txt
[ local dev (Localhost) ]  ──►  [ preview (Netlify Preview) ]  ──►  [ production (Main Service) ]
   - Local DB / Mock               - Staging DB / Sandbox              - Real Production DB
   - git checkout branch           - git pull request                  - git merge to 'main'
```

### 3.1 환경의 정의
1. **Local (로컬 개발 환경)**:
   - 개발자의 로컬 PC. `localStorage` 및 `smoke_test.mjs` 검증 중심.
2. **Preview / Staging (프리뷰 테스트 환경)**:
   - 외부 테스터(원장, 학부모 대표) 피드백 확인용 환경.
   - GitHub에 PR(Pull Request)이 생성될 때 자동으로 고유 Preview URL이 생성되어 배포됩니다.
   - 데이터베이스는 프로덕션과 분리된 **Supabase Sandbox 프로젝트**를 연결합니다.
3. **Production (운영 서비스 환경)**:
   - 실제 고객이 사용하는 라이브 환경.
   - `main` 브랜치에 코드가 머지될 때 자동으로 배포됩니다.
   - 실제 운영용 **Supabase Production 프로젝트**를 단독 연동합니다.

### 3.2 GitHub 브랜치 운영 규칙
- **`main` 브랜치**: 운영 배포(Production)의 기점이 되며, 항상 즉시 빌드/실행 가능한 100% 안정 상태를 유지합니다.
- **`feature/기능명` 브랜치**: 개별 기능 추가 및 마이그레이션 작업을 담당합니다.
- **Pull Request(PR) 규칙**:
  - `main`으로 머지 요청을 생성하면 Netlify/Vercel 봇이 자동으로 변경 사항을 정적으로 올려 Preview 링크를 제공합니다.
  - 이 Preview 링크에서 핵심 동선 검증이 끝나기 전까지는 `main`에 머지하지 않습니다.

---

## 4. 수동 검증 및 롤백 전략

### 4.1 배포 전/후 수동 검증 플로우
1. **로컬 빌드/체크 사전 실행**:
   - `node --check` 구문 검사 및 `smoke_test.mjs` 확인을 반드시 완료합니다.
2. **역할별 시나리오 수동 체크**:
   - 프리뷰 링크 배포 확인 후 아래 3대 시나리오를 직접 브라우저에서 수행합니다:
     - 원장: 로그인 선택 -> 대시보드 지표 -> 수납 관리 -> 태블릿 비밀번호 수정
     - 강사: 강사 진입 -> 시프트 스케줄링 -> 오늘 일정
     - 학부모/Kiosk: 자녀 출결 상태 입력 -> 학부모 뷰 확인 -> 새로고침 후 데이터 보존 확인
3. **콘솔 로그 검증**:
   - 브라우저 개발자 도구를 켜고 붉은색 예외(`Unhandled Promise Rejection`, `404 Not Found`)가 없는지 확인합니다.

### 4.2 배포 롤백(Rollback) 전략
- **Netlify/Vercel 대시보드 활용**:
  - 만일 배포 후 치명적 오류가 인지되면, GitHub 머지를 되돌리기(Revert) 전 즉각적으로 Netlify/Vercel 대시보드의 **"Deploys" -> "Rollback to active deploy"** 기능을 눌러 이전 정상 동작 버전을 즉시 라이브 서빙 상태로 되돌립니다.
- **Git 롤백**:
  - `git revert <commit_hash>` 명령을 통해 변경 사항을 되돌리는 커밋을 배포하여 히스토리를 정렬합니다.

---

## 5. 고객 테스트 링크 공유 시 주의사항

- **데이터 휘발성 사전 공지**:
  - 현재 MVP는 `LocalStorageAdapter` 기반이므로 기기를 바꾸거나 브라우저 캐시를 지우면 데이터가 유실됨을 테스터에게 명확히 고지해야 합니다.
- **테스트 가이드 제공**:
  - "이 사이트는 데모용 버전으로 브라우저 로컬 저장소를 활용합니다. 실제 개인정보나 실제 카드 정보를 입력하지 마시고, 가상의 더미 데이터를 통해 수납 및 출결 흐름을 눌러봐 주세요." 문구를 테스트 접근 경로 하단에 명시합니다.
