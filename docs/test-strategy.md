# E2E Test Strategy & Playwright Roadmap

This document outlines the testing architecture and Playwright E2E verification plan for 튜링 (DayDay).

## Automated Test Suites

Currently, Phase 6K has established three automated validation checks:
1. **State Injection Smoke Test** (`npm run test:state`): Verifies all crucial stateStore API endpoints exist and are functions.
2. **Supabase Client & Query Adapter Mock Test** (`npm run test:supabase-adapter`): Verifies database query mappings, error fallbacks, tenant safety guards, and write audit logging.
3. **Static Security Credential Scan** (`npm run test:security`): Recursively inspects codebases for exposed API tokens, Private Keys, or `.env` files.

---

## Playwright E2E Test Plan (Next Phase Projections)

E2E testing will simulate native browser interactions. Below is the proposed environment configuration and script structure.

### 1. Installation Requirements (Requires Approval)
```bash
npm install -D @playwright/test
npx playwright install
```

### 2. Playwright Configuration (`playwright.config.js`)
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000', // Matches server.js dev port
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3. Core Testing Scenarios

#### Scenario A: Director Login & Dashboard Loading
- **Pre-conditions**: LocalStorage populated with base fixtures.
- **Actions**:
  1. Open `http://localhost:3000`.
  2. Perform login credentials input as `director`.
  3. Wait for URL/hash redirect or router state change.
- **Assertions**:
  - Verify dashboard container is visible.
  - Verify no console error exists (`page.on('console', msg => { if (msg.type() === 'error') throw new Error(msg.text()); })`).
  - Verify student registry counts match mock data.

#### Scenario B: Student Registration and Modal Updates
- **Pre-conditions**: Logged in as director.
- **Actions**:
  1. Click "원생 등록" (Add Student) button.
  2. Verify student registry modal pops up.
  3. Fill out name, parent contact, instrument, and class schedules.
  4. Submit form.
- **Assertions**:
  - Modal is closed.
  - New student name is visible in the student data table.
  - LocalStorage contains the newly updated student entry.

#### Scenario C: Attendance Kiosk PIN Entry Flow
- **Pre-conditions**: Navigate to Kiosk view.
- **Actions**:
  1. Input 4-digit tablet PIN.
  2. Select target student name from results.
  3. Click "등원 (출석)" or "하원".
- **Assertions**:
  - Success message displays ("등원이 완료되었습니다!").
  - Kiosk resets automatically to PIN pad after timeout.
  - stateStore attendance record registers the check-in timestamp.
