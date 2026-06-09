// messageSendView.js - Message sending view skeleton (Phase 11A)
import { stateStore } from '../../state.js';

// --- HSL Design Tokens & Styles ----------------------------------------------
const TONES = {
  green:  { fg: "#15803D", bg: "#E7F6EC", bd: "#BBE6C9" },
  amber:  { fg: "#B45309", bg: "#FEF3DD", bd: "#FADFA9" },
  red:    { fg: "#DC2626", bg: "#FDEBEB", bd: "#F6C6C6" },
  slate:  { fg: "#475569", bg: "#EEF2F7", bd: "#DCE3EC" },
  violet: { fg: "#6D28D9", bg: "#F2ECFD", bd: "#DCCFFA" },
  sky:    { fg: "#0369A1", bg: "#E4F3FB", bd: "#BBE3F3" },
  blue:   { fg: "#1D4ED8", bg: "#E7EEFE", bd: "#C3D4FB" },
  rose:   { fg: "#BE185D", bg: "#FCEAF1", bd: "#F6C9DC" },
  indigo: { fg: "#4338CA", bg: "#ECEDFD", bd: "#CDCEF8" },
  teal:   { fg: "#0F766E", bg: "#E2F4F1", bd: "#B7E2DB" },
};

const PAY_META = {
  paid:      { label: "완납", tone: "green" },
  requested: { label: "결제요청", tone: "sky" },
  unpaid:    { label: "미납", tone: "red" },
  none:      { label: "미등록", tone: "slate" },
};

const CLASSES = ["피아노", "바이올린", "첼로", "플루트", "성악", "기타/우쿨렐레"];

const MACROS = [
  { token: "#{이름}", label: "학생 이름" },
  { token: "#{반}", label: "반(악기)" },
  { token: "#{보호자}", label: "보호자 호칭" },
  { token: "#{학원명}", label: "학원명" },
  { token: "#{원장명}", label: "원장 이름" },
  { token: "#{수납액}", label: "수납 금액" },
  { token: "#{미납액}", label: "미납 금액" },
  { token: "#{다음수업}", label: "다음 수업일시" },
];

const SENDER_NUMBERS = [
  { value: "0212345678", label: "02-1234-5678 (대표)", verified: true, main: true },
  { value: "01076141683", label: "010-7614-1683", verified: true, main: false },
  { value: "0507130022", label: "0507-1300-22", verified: false, main: false },
];

const MOCK_RECOMMENDED = [
  { id: "rec1", name: "신규 원장 인사", title: "[튜링음악학원] 신임 원장 인사드립니다", body: "안녕하세요, 학부모님 :)\n이번에 학부모님들과 소중한 인연을 맺게 된 신임 원장, 피아니스트 OOO입니다. 앞으로 아이들의 음악 성장을 정성껏 함께하겠습니다.", kind: "LMS", ad: false },
  { id: "rec2", name: "수강료 납부 안내", title: "[튜링음악학원] 수강료 납부 안내", body: "안녕하세요, #{이름} 학생 보호자님.\n#{학원명} 이번 달 수강료 납부 안내드립니다. 미납액 #{미납액}, 납부기한은 매월 10일입니다.", kind: "LMS", ad: false },
  { id: "rec3", name: "결석/출결 안내", title: "[튜링음악학원] 출결 안내", body: "#{이름} 학생이 오늘 #{다음수업} 수업에 출석하지 않았습니다. 확인 부탁드립니다.", kind: "SMS", ad: false },
  { id: "rec4", name: "발표회 초대", title: "[튜링음악학원] 정기 발표회 초대", body: "안녕하세요 :)\n#{학원명} 정기 발표회에 #{이름} 학생과 가족분들을 초대합니다. 자세한 일정은 추후 안내드리겠습니다.", kind: "LMS", ad: true },
  { id: "rec5", name: "여름특강 모집(광고)", title: "[튜링음악학원] 여름방학 특강 모집", body: "(광고) #{학원명} 여름 집중 특강을 모집합니다! 선착순 마감. 무료수신거부 080-123-4567", kind: "LMS", ad: true },
  { id: "rec6", name: "휴원 안내", title: "[튜링음악학원] 휴원 안내", body: "#{학원명} 내부 사정으로 금일 휴원합니다. 보강은 개별 안내드리겠습니다.", kind: "SMS", ad: false },
];

const MOCK_SAVED_TEMPLATES = [
  { id: "t1", name: "월 수강료 안내", title: "[튜링음악학원] 6월 수강료 안내", body: "안녕하세요, 튜링음악학원입니다.\n6월 수강료 납부 안내드립니다. 납부기한은 6월 10일까지이며, 자세한 내용은 첨부를 확인해 주세요.\n감사합니다.", kind: "LMS", ad: true, savedAt: "2026-06-01" },
  { id: "t2", name: "결석 안내", title: "[튜링음악학원] 수업 결석 안내", body: "안녕하세요, 오늘 자녀의 레슨 출석이 확인되지 않았습니다. 확인 부탁드립니다.", kind: "SMS", ad: false, savedAt: "2026-05-28" },
  { id: "t3", name: "콩쿠르 일정 안내", title: "[튜링음악학원] 콩쿠르 일정 안내", body: "안녕하세요. 다가오는 콩쿠르 일정과 준비 사항을 안내드립니다. 리허설은 행사 3일 전 진행됩니다.", kind: "LMS", ad: false, savedAt: "2026-05-25" },
  { id: "t4", name: "정기 음악회 초청", title: "[튜링음악학원] 여름 정기 음악회 초대", body: "안녕하세요. 튜링 여름 정기 음악회에 학부모님을 초대합니다.\n일시: 6월 27일 오후 4시\n장소: 튜링 그랜드홀\n많은 참석 부탁드립니다.", kind: "LMS", ad: true, savedAt: "2026-05-20" },
];

const MOCK_RECENT_MESSAGES = [
  { id: "r1", title: "[튜링음악학원] 6월 수강료 안내", body: "안녕하세요, 튜링음악학원입니다. 6월 수강료 납부 안내드립니다. 납부기한은 6월 10일까지입니다.", kind: "LMS", ad: true, sentAt: "2026-06-04 14:20", count: 38, success: 38 },
  { id: "r2", title: "[튜링음악학원] 콩쿠르 리허설 안내", body: "콩쿠르 참가자 대상 리허설을 6월 11일 진행합니다. 시간 엄수 부탁드립니다.", kind: "SMS", ad: false, sentAt: "2026-06-03 18:05", count: 9, success: 9 },
  { id: "r3", title: "[튜링음악학원] 결석 안내", body: "오늘 자녀의 레슨 출석이 확인되지 않았습니다. 확인 부탁드립니다.", kind: "SMS", ad: false, sentAt: "2026-06-03 16:40", count: 3, success: 3 },
];

const SCENARIOS = [
  {
    key: "unpaid", label: "미납 수강료 안내", icon: "ticket", tone: "red",
    desc: "미납 학생 보호자",
    filter: s => s.pay === "unpaid",
    types: ["g1"],
    title: "[튜링음악학원] 수강료 납부 안내",
    body: "안녕하세요, #{이름} 학생 #{보호자}님.\n#{학원명} 이번 달 수강료 미납액은 #{미납액}이며, 납부기한은 매월 10일입니다. 확인 부탁드립니다.",
  },
  {
    key: "absent", label: "오늘 결석 안내", icon: "clock", tone: "amber",
    desc: "금일 미출석 학생",
    filter: s => s.absentToday,
    types: ["g1"],
    title: "[튜링음악학원] 출결 안내",
    body: "#{이름} 학생이 오늘 #{다음수업} 수업에 출석하지 않았습니다. 확인 부탁드립니다.",
  },
  {
    key: "recital", label: "발표회 초대", icon: "music", tone: "rose",
    desc: "전체 재원생",
    filter: s => s.pay !== "none",
    types: ["g1"],
    ad: true,
    title: "[튜링음악학원] 정기 발표회 초대",
    body: "안녕하세요 :)\n#{학원명} 정기 발표회에 #{이름} 학생과 가족분들을 초대합니다. 자세한 일정은 추후 안내드리겠습니다.",
  },
];

const ORG = { academy: "튜링음악학원", director: "주재경", unsubscribe: "080-123-4567" };

// --- Icon Renderer -----------------------------------------------------------
function renderIcon(name, size = 16, color = "currentColor", stroke = 1.7) {
  const paths = {
    calendar: `<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>`,
    search:   `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>`,
    chevronD: `<path d="m6 9 6 6 6-6"/>`,
    chevronR: `<path d="m9 6 6 6-6 6"/>`,
    user:     `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/>`,
    message:  `<path d="M21 11.5a8.4 8.4 0 0 1-9 8.3L3 21l1.2-4.2A8.4 8.4 0 1 1 21 11.5Z"/>`,
    alert:    `<path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>`,
    close:    `<path d="M18 6 6 18M6 6l12 12"/>`,
    clock:    `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
    phone:    `<path d="M6.6 3.5 9 4l1.2 3.3-1.8 1.3a12 12 0 0 0 5 5l1.3-1.8L18 14l.5 2.4a1.6 1.6 0 0 1-1.6 1.9A14 14 0 0 1 3.2 5.1 1.6 1.6 0 0 1 5.1 3.5Z"/>`,
    send:     `<path d="M21 3 10.5 13.5M21 3l-7 18-4-8-8-4 19-6Z"/>`,
    filter:   `<path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/>`,
    refresh:  `<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>`,
    check:    `<path d="m5 12 5 5L20 6"/>`,
    dot:      `<circle cx="12" cy="12" r="4" fill="${color}" stroke="none"/>`,
    music:    `<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>`,
    grid:     `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,
    trophy:   `<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 18h6M10 18v-2.5M14 18v-2.5M8 21h8"/>`,
    cap:      `<path d="M12 4 2 9l10 5 10-5-10-5Z"/><path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5M22 9v5"/>`,
    ticket:   `<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Z"/><path d="M14 5v14" stroke-dasharray="2 2"/>`,
    star:     `<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8 6.6 19.5l1.2-6-4.5-4.2 6.1-.7L12 3Z"/>`,
    pin:      `<path d="M12 21s-6.5-5.5-6.5-10a6.5 6.5 0 0 1 13 0c0 4.5-6.5 10-6.5 10Z"/><circle cx="12" cy="11" r="2.4"/>`,
    note:     `<path d="M5 3h10l4 4v14a0 0 0 0 1 0 0H5a0 0 0 0 1 0 0V3Z"/><path d="M14 3v4h4M8.5 12h7M8.5 16h5"/>`,
    plus:     `<path d="M12 5v14M5 12h14"/>`,
    edit:     `<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>`,
    chart:    `<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx=".6"/><rect x="12.5" y="7" width="3" height="10" rx=".6"/><rect x="18" y="13" width="3" height="4" rx=".6"/>`,
    bell:     `<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>`,
    repeat:   `<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`,
    flag:     `<path d="M4 21V4M4 4h11l-1.5 3L15 10H4"/>`,
    dots:     `<circle cx="5" cy="12" r="1.6" fill="${color}" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="${color}" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="${color}" stroke="none"/>`,
    arrowR:   `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  };
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; display: block;">
      ${paths[name] || ''}
    </svg>
  `;
}

// --- Chosung Helper ----------------------------------------------------------
const chosung = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const getChosungStr = (str) => {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code >= 0 && code < 11172) {
      res += chosung[Math.floor(code / 588)];
    } else {
      res += str.charAt(i);
    }
  }
  return res;
};

// --- Local View State --------------------------------------------------------
const viewState = {
  studentFilterKlass: "all",
  studentFilterPay: "all",
  studentSearchQuery: "",
  selectedStudentIds: new Set(),
  contactTypes: {
    student: false,
    g1: true,
    g2: false
  },
  dedupe: true,

  recipients: [],
  senderNumber: "0212345678",
  customSenderNumber: "",
  senderSelectValue: "",
  method: "SMS",
  schedule: {
    on: false,
    date: "2026-06-08",
    time: "10:00"
  },
  title: "",
  body: "",
  image: null,

  vaultActiveTab: "recommend",
  vaultSearchQuery: "",
  vaultPages: { recommend: 0, saved: 0, recent: 0 },

  focusOpen: false,
  scenarioKey: null,

  // Template creation modal state
  saveModalOpen: false,
  saveModalTitle: "",
  saveModalBody: "",
  saveModalError: "",
  savedTemplates: [...MOCK_SAVED_TEMPLATES],
  isComposing: false,

  // New modal states
  directAddModalOpen: false,
  excelImportModalOpen: false,
  recipientDetailModalOpen: false,
  recipientDetailLogId: null,
  expandedCardIds: new Set()
};

// --- Data Adapter mapping stateStore -----------------------------------------
const getAdaptedStudents = () => {
  const dbStudents = stateStore.getStudents() || [];
  const dbPayments = stateStore.db.payments || [];
  const dbClasses = stateStore.db.classes || [];
  const dbTeachers = stateStore.getTeachers() || [];

  return dbStudents.map(student => {
    // Resolve classes & lesson time
    const studentClasses = dbClasses.filter(c => c.studentId === student.id);
    const nextLessonText = studentClasses.length > 0 
      ? studentClasses.map(c => `${c.dayOfWeek} ${c.time}`).join(', ')
      : '수업 없음';

    // Resolve teacher name
    const teacherObj = dbTeachers.find(t => t.id === student.teacherId);
    const teacherName = teacherObj ? teacherObj.name : '기타';

    // Resolve payment status
    const studentPayments = dbPayments.filter(p => p.studentId === student.id && p.type === 'education');
    let pay = "none";
    let unpaidAmount = 0;
    
    if (studentPayments.length > 0) {
      const hasUnpaid = studentPayments.some(p => p.status === 'unpaid');
      const hasRequested = studentPayments.some(p => p.status === 'requested');
      
      if (hasUnpaid) {
        pay = "unpaid";
        unpaidAmount = studentPayments
          .filter(p => p.status === 'unpaid')
          .reduce((sum, p) => sum + p.amount, 0);
      } else if (hasRequested) {
        pay = "requested";
      } else {
        pay = "paid";
      }
    }

    // Resolve guardian 2 defensively
    let guardian2 = null;
    const g2Phone = student.parentPhone2 || student.guardian2Phone || student.secondParentPhone || null;
    if (g2Phone) {
      guardian2 = { label: "보호자2", phone: g2Phone };
    }

    // Resolve optOut defensively
    const optOut = !!(student.optOut || student.smsOptOut || student.messageOptOut || student.marketingOptOut);

    // Parse school and age to grade
    const grade = student.school ? `${student.school} ${student.age ? student.age + '세' : ''}` : (student.age ? `${student.age}세` : '일반');

    // Simulate absentToday for specific students for scenario testing
    const absentToday = student.name === "곽도현" || student.name === "신서하";

    return {
      id: student.id,
      name: student.name,
      grade: grade,
      klass: student.instrument || '피아노',
      pay: pay,
      studentPhone: student.phone || '010-0000-0000',
      guardian1: { label: "모", phone: student.parentPhone || '010-0000-0000' },
      guardian2: guardian2,
      unpaidAmount: unpaidAmount,
      tuitionAmount: student.fee || 150000,
      absentToday: absentToday,
      concours: student.name === "최다은" ? { name: "한국청소년 피아노 콩쿠르", date: "6/14" } : null,
      optOut: optOut,
      nextLessonText: nextLessonText
    };
  });
};

const byteLen = (str) => {
  let n = 0;
  for (const ch of (str || "")) n += ch.charCodeAt(0) > 0x7F ? 2 : 1;
  return n;
};

const msgKind = (title, body, hasImage) => {
  if (hasImage) return "MMS";
  const total = byteLen(title) + byteLen(body);
  return total <= 90 ? "SMS" : "LMS";
};

// --- View rendering entry point ----------------------------------------------
export function renderMessageSend(container) {
  // Set up common header items
  const headerActions = document.querySelector('.header-actions');
  const settingsQuickBar = document.getElementById('settings-quick-bar');
  const currentDateEl = document.getElementById('current-date');

  if (settingsQuickBar) settingsQuickBar.style.display = 'none';
  if (currentDateEl) currentDateEl.style.display = 'none';

  // Mount header elements
  let syncTimeContainer = document.getElementById('message-send-global-header-actions');
  if (!syncTimeContainer) {
    syncTimeContainer = document.createElement('div');
    syncTimeContainer.id = 'message-send-global-header-actions';
    syncTimeContainer.style.display = 'flex';
    syncTimeContainer.style.alignItems = 'center';
    syncTimeContainer.style.gap = '8px';
    if (headerActions) {
      headerActions.appendChild(syncTimeContainer);
    }
  }

  // Scoped CSS styles for message sending center
  container.innerHTML = `
    <style>
      .message-send-root {
        --bg-card: #ffffff;
        --border-color: #e2e8f0;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --text-muted-light: #94a3b8;
        --primary: #2563eb;
        --primary-light: #eff6ff;
        --success: #16a34a;
        --success-light: #ecfdf3;
        --warning: #b45309;
        --warning-light: #fff3dd;
        --danger: #dc2626;
        --danger-light: #fdebeb;
        --violet: #6d28d9;
        --violet-light: #f2ecfd;
        --sky: #0369a1;
        --sky-light: #e4f3fb;
        --slate: #475569;
        --slate-light: #eef2f7;
        --radius: 16px;
        --shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        --shadow-sm: 0 4px 16px rgba(15, 23, 42, 0.04);
        
        display: flex;
        flex-direction: column;
        gap: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: var(--text-main);
        padding-bottom: 110px; /* Space for SendBar */
        box-sizing: border-box;
      }
      .message-send-root * {
        box-sizing: border-box;
      }
      .message-send-root select,
      .message-send-root input,
      .message-send-root textarea {
        font-family: inherit;
        outline: none;
      }
      .message-send-card {
        background: var(--bg-card);
        border-radius: var(--radius);
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .message-send-card-header {
        padding: 14px 16px 12px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .message-send-card-title {
        margin: 0;
        font-size: 15.5px;
        font-weight: 800;
        color: var(--text-main);
      }
      .message-send-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .message-send-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
        border-radius: 999px;
        white-space: nowrap;
      }
      
      /* Grid and responsiveness */
      .message-send-grid {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) minmax(360px, 1.3fr) minmax(320px, 1fr);
        gap: 16px;
        align-items: stretch;
      }
      .message-send-col-vault {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      @media (max-width: 1100px) {
        .message-send-grid {
          grid-template-columns: 1fr 1.2fr;
        }
        .message-send-col-vault {
          grid-column: span 2;
        }
      }
      @media (max-width: 768px) {
        .message-send-grid {
          grid-template-columns: 1fr;
        }
        .message-send-col-vault {
          grid-column: span 1;
        }
      }
      
      /* Scoped tone variables helper class */
      .tone-green { background: var(--success-light); color: var(--success); border: 1px solid #bbe6c9; }
      .tone-red { background: var(--danger-light); color: var(--danger); border: 1px solid #f6c6c6; }
      .tone-slate { background: var(--slate-light); color: var(--slate); border: 1px solid var(--border-color); }
      .tone-blue { background: var(--primary-light); color: var(--primary); border: 1px solid #c3d4fb; }
      .tone-sky { background: var(--sky-light); color: var(--sky); border: 1px solid #bbe3f3; }
      .tone-amber { background: var(--warning-light); color: var(--warning); border: 1px solid #fadfa9; }
      .tone-violet { background: var(--violet-light); color: var(--violet); border: 1px solid #dccffa; }
      
      /* Phone frame styles */
      .phone-frame {
        width: 296px;
        margin: 0 auto;
        background: #fff;
        border-radius: 30px;
        border: 1px solid #dce3ec;
        box-shadow: 0 18px 40px -20px rgba(16,24,40,.4), 0 0 0 7px #f1f4f8;
        overflow: hidden;
        position: relative;
      }
      
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes popIn { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
    </style>
    <div class="message-send-root">
      <div id="messageSendDisclaimer"></div>
      <div id="messageSendScenarioStrip"></div>
      <div class="message-send-grid">
        <!-- Column 1: Students list and recipients list -->
        <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0;">
          <div id="studentListPanel"></div>
          <div id="recipientListPanel"></div>
        </div>
        
        <!-- Column 2: Compose text message form -->
        <div id="composePanel"></div>
        
        <!-- Column 3: Message Vault templates -->
        <div class="message-send-col-vault" id="messageVaultPanel"></div>
      </div>
      <div id="globalSendBar"></div>
      <div id="focusConfirmOverlay"></div>
      <div id="templateSaveModalOverlay"></div>
      <div id="directAddModalOverlay"></div>
      <div id="excelImportModalOverlay"></div>
      <div id="recipientDetailModalOverlay"></div>
    </div>
  `;

  // Render Header Actions
  const syncTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  syncTimeContainer.innerHTML = `
    <div class="major-schedule-clock" id="major-schedule-last-sync">마지막 동기화 ${syncTime}</div>
    <button class="btn btn-primary" id="message-send-refresh-btn">새로고침</button>
  `;

  document.getElementById('message-send-refresh-btn').addEventListener('click', () => {
    render();
  });

  // Main render loop
  const render = () => {
    renderDisclaimer();
    renderScenarioStrip();
    renderStudentList();
    renderRecipientList();
    renderComposePanel();
    renderMessageVault();
    renderSendBar();
    renderFocusConfirm();
    renderTemplateSaveModal();
    renderDirectAddModal();
    renderExcelImportModal();
    renderRecipientDetailModal();
  };

  // 1. Disclaimer Yellow Box
  const renderDisclaimer = () => {
    const block = container.querySelector('#messageSendDisclaimer');
    block.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 11px; padding: 12px 16px; background: #FFFBF2; border: 1px solid #FAE9C4; border-radius: 13px; margin-bottom: 2px;">
        <span style="width: 26px; height: 26px; border-radius: 8px; background: #FEF0CF; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${renderIcon('alert', 15, '#B45309', 2.2)}
        </span>
        <div style="flex: 1; font-size: 12.5px; color: #92610F; line-height: 1.55;">
          <b style="color: #7A4F0B;">광고성 정보 전송 의무사항 안내</b> — 광고성 메시지는 <b>(광고)</b> 표기, <b>전송자 명시</b>, <b>무료수신거부</b> 방법을 반드시 포함해야 합니다.
          의무사항 미준수 시 관련 법령(정보통신망법)에 따라 <b>메시지 발송이 중단될 수 있습니다.</b> (실제 발송 기능은 연동되지 않은 UI 스텁 화면입니다)
        </div>
      </div>
    `;
  };

  // 2. Scenario Strip (Templates)
  const renderScenarioStrip = () => {
    const block = container.querySelector('#messageSendScenarioStrip');
    block.innerHTML = `
      <div style="background: #fff; border-radius: 16px; border: 1px solid #E9EEF4; box-shadow: var(--shadow-sm); padding: 13px 16px; margin-bottom: 2px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 11px;">
          <span style="width: 24px; height: 24px; border-radius: 7px; background: #EAF1FE; display: flex; align-items: center; justify-content: center;">
            ${renderIcon('star', 14, '#2563EB')}
          </span>
          <h3 style="margin: 0; font-size: 14.5px; font-weight: 800; color: var(--text-main);">자주 쓰는 상황별 메시지 템플릿</h3>
          <span style="font-size: 11.5px; color: var(--text-muted);">원하는 상황에 맞는 템플릿 문구를 즉시 본문에 불러옵니다.</span>
        </div>
        <div style="display: flex; gap: 9px; flex-wrap: wrap;">
          ${SCENARIOS.map(sc => {
            const t = TONES[sc.tone];
            const active = viewState.scenarioKey === sc.key;
            const btnBg = active ? t.fg : "#fff";
            const btnBd = active ? t.fg : t.bd;
            const titleColor = active ? "#fff" : "#0F172A";
            const descColor = active ? "rgba(255,255,255,.85)" : "#94A3B8";
            const activeIconColor = active ? "#fff" : t.fg;
            const activeIconBg = active ? "rgba(255,255,255,.2)" : t.bg;
            
            return `
              <button class="btn-scenario" data-key="${sc.key}" style="
                display: flex; align-items: center; gap: 9px; padding: 9px 13px; border-radius: 11px; cursor: pointer;
                background: ${btnBg}; border: 1.5px solid ${btnBd}; transition: all .12s;
                box-shadow: ${active ? `0 4px 12px ${t.fg}33` : "none"};
                font-family: inherit; margin-bottom: 0;
              ">
                <span style="width: 28px; height: 28px; border-radius: 8px; background: ${activeIconBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${renderIcon(sc.icon, 15, activeIconColor, 2)}
                </span>
                <span style="text-align: left;">
                  <span style="display: block; fontSize: 13px; fontWeight: 700; color: ${titleColor}; line-height: 1.25;">${sc.label}</span>
                  <span style="display: block; fontSize: 11px; color: ${descColor};">${sc.desc}</span>
                </span>
                ${sc.ad ? `<span style="font-size: 9.5px; font-weight: 800; color: ${active ? '#fff' : '#B45309'}; background: ${active ? 'rgba(255,255,255,.2)' : '#FEF3DD'}; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">광고</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    block.querySelectorAll('.btn-scenario').forEach(btn => {
      btn.addEventListener('click', () => {
        const scKey = btn.dataset.key;
        const sc = SCENARIOS.find(s => s.key === scKey);
        if (!sc) return;

        viewState.scenarioKey = scKey;
        
        // Load only template content
        viewState.title = sc.title;
        viewState.body = sc.body;
        viewState.image = null;
        viewState.method = "SMS";

        render();
      });
    });
  };

  // 3. Column 1: Student List
  const renderStudentList = (isFullRender = true) => {
    const block = container.querySelector('#studentListPanel');
    const students = getAdaptedStudents();

    // Filter students
    const filtered = students.filter(s => {
      if (viewState.studentFilterKlass !== "all" && s.klass !== viewState.studentFilterKlass) return false;
      if (viewState.studentFilterPay !== "all" && s.pay !== viewState.studentFilterPay) return false;
      if (viewState.studentSearchQuery) {
        const clean = viewState.studentSearchQuery.trim().toLowerCase();
        const isChosungOnly = /^[ㄱ-ㅎ\s]+$/.test(clean);
        if (isChosungOnly) {
          if (!getChosungStr(s.name.toLowerCase()).includes(clean)) return false;
        } else {
          if (!s.name.toLowerCase().includes(clean)) return false;
        }
      }
      return true;
    });

    const allChecked = filtered.length > 0 && filtered.every(s => viewState.selectedStudentIds.has(s.id));
    const someChecked = filtered.some(s => viewState.selectedStudentIds.has(s.id));

    // Calculate recipient count preview
    let contactCount = 0;
    students.forEach(s => {
      if (!viewState.selectedStudentIds.has(s.id)) return;
      if (viewState.contactTypes.student) contactCount++;
      if (viewState.contactTypes.g1) contactCount++;
      if (viewState.contactTypes.g2 && s.guardian2) contactCount++;
    });

    const isPartial = !isFullRender && block && block.querySelector('#studentTableRows');

    if (isPartial) {
      // 1. Update list count label
      const countHeaderSpan = block.querySelector('.message-send-card-header span:last-child');
      if (countHeaderSpan) countHeaderSpan.textContent = `${filtered.length}명`;

      // 2. Update Table Header Checkbox
      const btnToggleAll = block.querySelector('#btnToggleAllStudents');
      if (btnToggleAll) {
        btnToggleAll.style.borderColor = allChecked || someChecked ? 'var(--primary)' : '#cbd5e1';
        btnToggleAll.style.background = allChecked ? 'var(--primary)' : someChecked ? 'var(--primary)' : '#fff';
        btnToggleAll.innerHTML = allChecked ? renderIcon('check', 10, '#fff', 3) : someChecked ? `<span style="width: 8px; height: 2px; background: #fff; border-radius: 1px;"></span>` : '';
      }

      // 3. Update Rows HTML
      const tableRowsDiv = block.querySelector('#studentTableRows');
      if (tableRowsDiv) {
        tableRowsDiv.innerHTML = filtered.map(s => {
          const checked = viewState.selectedStudentIds.has(s.id);
          const meta = PAY_META[s.pay] || { label: "미등록", tone: "slate" };
          const badgeText = s.pay === "paid" ? "완납" : s.pay === "requested" ? "결제요청" : s.pay === "unpaid" ? "미납" : "미등록";

          const initial = s.name.slice(-2);
          const hue = (s.id.charCodeAt(1) || 5) % 6;
          const avBg = ["#eff6ff", "#f5f3ff", "#ecfdf3", "#fff7ed", "#fef2f2", "#f5f5f5"][hue];
          const avFg = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#4b5563"][hue];

          return `
            <div class="student-row" data-id="${s.id}" style="
              display: grid; grid-template-columns: 32px 1fr 70px; gap: 8px; padding: 8px 16px;
              border-top: 1px solid #f1f5f9; align-items: center; cursor: pointer;
              background: ${checked ? '#fafcff' : 'transparent'};
            ">
              <button class="row-checkbox" data-id="${s.id}" style="
                width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
                border: 1.5px solid ${checked ? 'var(--primary)' : '#cbd5e1'}; background: ${checked ? 'var(--primary)' : '#fff'};
                cursor: pointer; padding: 0; margin-bottom: 0;
              ">
                ${checked ? renderIcon('check', 10, '#fff', 3) : ''}
              </button>
              <span style="display: flex; align-items: center; gap: 9px; min-width: 0;">
                <span class="message-send-avatar" style="width: 28px; height: 28px; font-size: 11px; background: ${avBg}; color: ${avFg};">${initial}</span>
                <span style="min-width: 0;">
                  <span style="display: block; font-size: 12.5px; font-weight: 700; color: var(--text-main);">${s.name}</span>
                  <span style="display: block; font-size: 10.5px; color: var(--text-muted);">${s.grade} · ${s.klass}</span>
                </span>
              </span>
              <span style="display: flex; justify-content: center;">
                <span class="message-send-chip tone-${meta.tone}" style="font-size: 10px; padding: 2px 7px;">${badgeText}</span>
              </span>
            </div>
          `;
        }).join('');
      }

      // 4. Update Footer count & button
      const selectedCountB = block.querySelector('#selectedStudentsCount');
      if (selectedCountB) selectedCountB.textContent = viewState.selectedStudentIds.size;

      const addToRecipientsBtn = block.querySelector('#btnAddToRecipients');
      if (addToRecipientsBtn) {
        const disabled = viewState.selectedStudentIds.size === 0 || (!viewState.contactTypes.student && !viewState.contactTypes.g1 && !viewState.contactTypes.g2);
        addToRecipientsBtn.disabled = disabled;
        addToRecipientsBtn.style.background = disabled ? '#c9d3e0' : 'var(--primary)';
        addToRecipientsBtn.style.cursor = disabled ? 'default' : 'pointer';
        addToRecipientsBtn.style.boxShadow = disabled ? 'none' : '0 4px 12px rgba(37,99,235,.2)';
        addToRecipientsBtn.innerHTML = `${renderIcon('arrowR', 15, '#fff')} 발송인원 추가 ${contactCount > 0 ? `(${contactCount}건)` : ''}`;
      }

      // Re-bind row click listener
      block.querySelectorAll('.student-row').forEach(row => {
        row.addEventListener('click', (e) => {
          const id = row.dataset.id;
          if (viewState.selectedStudentIds.has(id)) {
            viewState.selectedStudentIds.delete(id);
          } else {
            viewState.selectedStudentIds.add(id);
          }
          renderStudentList(false);
        });
      });
      return;
    }

    block.className = 'message-send-card';
    block.innerHTML = `
      <div class="message-send-card-header" style="flex-direction: column; align-items: stretch; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="width: 26px; height: 26px; border-radius: 7px; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; fontSize: 12px; fontWeight: 800;">1</span>
          <h2 class="message-send-card-title">원생 리스트</h2>
          <span style="font-size: 11.5px; color: var(--text-muted-light);">${filtered.length}명</span>
        </div>
        <div style="display: flex; align-items: center; gap: 7px;">
          <!-- Class Filter -->
          <div style="position: relative; flex: 1;">
            <select id="studentClassFilter" style="
              appearance: none; width: 100%; padding: 7px 24px 7px 10px; font-size: 12px; font-weight: 600; color: var(--slate);
              background: #fff; border: 1px solid var(--border-color); border-radius: 9px; cursor: pointer;
            ">
              <option value="all">전체 반</option>
              ${CLASSES.map(c => `<option value="${c}" ${viewState.studentFilterKlass === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); pointer-events: none;">${renderIcon('chevronD', 12, '#94A3B8')}</span>
          </div>
          <!-- Pay Filter -->
          <div style="position: relative; flex: 1;">
            <select id="studentPayFilter" style="
              appearance: none; width: 100%; padding: 7px 24px 7px 10px; font-size: 12px; font-weight: 600; color: var(--slate);
              background: #fff; border: 1px solid var(--border-color); border-radius: 9px; cursor: pointer;
            ">
              <option value="all">납부 전체</option>
              <option value="paid" ${viewState.studentFilterPay === 'paid' ? 'selected' : ''}>완납</option>
              <option value="requested" ${viewState.studentFilterPay === 'requested' ? 'selected' : ''}>결제요청</option>
              <option value="unpaid" ${viewState.studentFilterPay === 'unpaid' ? 'selected' : ''}>미납</option>
              <option value="none" ${viewState.studentFilterPay === 'none' ? 'selected' : ''}>미등록</option>
            </select>
            <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); pointer-events: none;">${renderIcon('chevronD', 12, '#94A3B8')}</span>
          </div>
        </div>
        <!-- Search bar -->
        <div style="display: flex; align-items: center; gap: 7px; padding: 7px 11px; background: #fff; border: 1px solid var(--border-color); border-radius: 9px;">
          ${renderIcon('search', 14, '#94A3B8')}
          <input id="studentSearchInput" value="${viewState.studentSearchQuery}" placeholder="원생 이름 검색" style="border: none; outline: none; fontSize: 12px; flex: 1; background: transparent; padding: 0;" />
        </div>
      </div>

      <!-- Table Header -->
      <div style="display: grid; grid-template-columns: 32px 1fr 70px; gap: 8px; padding: 8px 16px; background: #fafbfd; font-size: 11px; font-weight: 700; color: #8a97a8; align-items: center;">
        <button id="btnToggleAllStudents" style="
          width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1.5px solid ${allChecked || someChecked ? 'var(--primary)' : '#cbd5e1'};
          background: ${allChecked ? 'var(--primary)' : someChecked ? 'var(--primary)' : '#fff'}; cursor: pointer; padding: 0; margin-bottom: 0;
        ">
          ${allChecked ? renderIcon('check', 10, '#fff', 3) : someChecked ? `<span style="width: 8px; height: 2px; background: #fff; border-radius: 1px;"></span>` : ''}
        </button>
        <span>이름 / 반</span>
        <span style="text-align: center;">납부현황</span>
      </div>

      <!-- Table Rows -->
      <div id="studentTableRows" style="overflow-y: auto; flex: 1; max-height: 350px;">
        ${filtered.map(s => {
          const checked = viewState.selectedStudentIds.has(s.id);
          const meta = PAY_META[s.pay] || { label: "미등록", tone: "slate" };
          const badgeText = s.pay === "paid" ? "완납" : s.pay === "requested" ? "결제요청" : s.pay === "unpaid" ? "미납" : "미등록";

          // Determinate initials for avatar
          const initial = s.name.slice(-2);
          const hue = (s.id.charCodeAt(1) || 5) % 6;
          const avBg = ["#eff6ff", "#f5f3ff", "#ecfdf3", "#fff7ed", "#fef2f2", "#f5f5f5"][hue];
          const avFg = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#4b5563"][hue];

          return `
            <div class="student-row" data-id="${s.id}" style="
              display: grid; grid-template-columns: 32px 1fr 70px; gap: 8px; padding: 8px 16px;
              border-top: 1px solid #f1f5f9; align-items: center; cursor: pointer;
              background: ${checked ? '#fafcff' : 'transparent'};
            ">
              <button class="row-checkbox" data-id="${s.id}" style="
                width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
                border: 1.5px solid ${checked ? 'var(--primary)' : '#cbd5e1'}; background: ${checked ? 'var(--primary)' : '#fff'};
                cursor: pointer; padding: 0; margin-bottom: 0;
              ">
                ${checked ? renderIcon('check', 10, '#fff', 3) : ''}
              </button>
              <span style="display: flex; align-items: center; gap: 9px; min-width: 0;">
                <span class="message-send-avatar" style="width: 28px; height: 28px; font-size: 11px; background: ${avBg}; color: ${avFg};">${initial}</span>
                <span style="min-width: 0;">
                  <span style="display: block; font-size: 12.5px; font-weight: 700; color: var(--text-main);">${s.name}</span>
                  <span style="display: block; font-size: 10.5px; color: var(--text-muted);">${s.grade} · ${s.klass}</span>
                </span>
              </span>
              <span style="display: flex; justify-content: center;">
                <span class="message-send-chip tone-${meta.tone}" style="font-size: 10px; padding: 2px 7px;">${badgeText}</span>
              </span>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Column Footer -->
      <div style="padding: 12px 16px; border-top: 1px solid #f1f5f9; background: #fafbfd;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px;">
          <span style="font-size: 12px; color: var(--slate); font-weight: 700;">선택 <b id="selectedStudentsCount" style="color: var(--primary); font-size: 13.5px;">${viewState.selectedStudentIds.size}</b>명</span>
          <button id="btnToggleDedupe" style="display: inline-flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; margin-bottom: 0; padding: 0;">
            <span style="
              width: 15px; height: 15px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
              background: ${viewState.dedupe ? 'var(--primary)' : '#fff'}; border: 1.5px solid ${viewState.dedupe ? 'var(--primary)' : '#cbd5e1'}
            ">${viewState.dedupe ? renderIcon('check', 9, '#fff', 3) : ''}</span>
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">추가 시 중복제거</span>
          </button>
        </div>
        <div style="font-size: 10.5px; font-weight: 700; color: #8a97a8; margin-bottom: 6px;">수신인 연락처 구성</div>
        <div style="display: flex; gap: 6px; margin-bottom: 11px; flex-wrap: wrap;">
          <!-- Contact Type: Student -->
          <button class="btn-toggle-contact-type" data-type="student" style="
            display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 8px; cursor: pointer;
            background: ${viewState.contactTypes.student ? '#eaf1fe' : '#fff'}; border: 1px solid ${viewState.contactTypes.student ? '#c9dbfb' : '#e2e8f0'};
            font-family: inherit; margin-bottom: 0;
          ">
            <span style="width: 14px; height: 14px; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: ${viewState.contactTypes.student ? 'var(--primary)' : '#fff'}; border: 1.5px solid ${viewState.contactTypes.student ? 'var(--primary)' : '#cbd5e1'};">
              ${viewState.contactTypes.student ? renderIcon('check', 8, '#fff', 3) : ''}
            </span>
            <span style="font-size: 11.5px; font-weight: 700; color: ${viewState.contactTypes.student ? 'var(--primary)' : 'var(--text-muted)'};">학생 본인</span>
          </button>
          <!-- Contact Type: Guardian 1 -->
          <button class="btn-toggle-contact-type" data-type="g1" style="
            display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 8px; cursor: pointer;
            background: ${viewState.contactTypes.g1 ? '#eaf1fe' : '#fff'}; border: 1px solid ${viewState.contactTypes.g1 ? '#c9dbfb' : '#e2e8f0'};
            font-family: inherit; margin-bottom: 0;
          ">
            <span style="width: 14px; height: 14px; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: ${viewState.contactTypes.g1 ? 'var(--primary)' : '#fff'}; border: 1.5px solid ${viewState.contactTypes.g1 ? 'var(--primary)' : '#cbd5e1'};">
              ${viewState.contactTypes.g1 ? renderIcon('check', 8, '#fff', 3) : ''}
            </span>
            <span style="font-size: 11.5px; font-weight: 700; color: ${viewState.contactTypes.g1 ? 'var(--primary)' : 'var(--text-muted)'};">보호자1</span>
          </button>
          <!-- Contact Type: Guardian 2 -->
          <button class="btn-toggle-contact-type" data-type="g2" style="
            display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 8px; cursor: pointer;
            background: ${viewState.contactTypes.g2 ? '#eaf1fe' : '#fff'}; border: 1px solid ${viewState.contactTypes.g2 ? '#c9dbfb' : '#e2e8f0'};
            font-family: inherit; margin-bottom: 0;
          ">
            <span style="width: 14px; height: 14px; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: ${viewState.contactTypes.g2 ? 'var(--primary)' : '#fff'}; border: 1.5px solid ${viewState.contactTypes.g2 ? 'var(--primary)' : '#cbd5e1'};">
              ${viewState.contactTypes.g2 ? renderIcon('check', 8, '#fff', 3) : ''}
            </span>
            <span style="font-size: 11.5px; font-weight: 700; color: ${viewState.contactTypes.g2 ? 'var(--primary)' : 'var(--text-muted)'};">보호자2</span>
          </button>
        </div>
        <button id="btnAddToRecipients" ${viewState.selectedStudentIds.size === 0 || (!viewState.contactTypes.student && !viewState.contactTypes.g1 && !viewState.contactTypes.g2) ? 'disabled' : ''} style="
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 10px; font-size: 13px; font-weight: 700;
          color: #fff; background: ${viewState.selectedStudentIds.size === 0 || (!viewState.contactTypes.student && !viewState.contactTypes.g1 && !viewState.contactTypes.g2) ? '#c9d3e0' : 'var(--primary)'};
          border: none; border-radius: 9px; cursor: ${viewState.selectedStudentIds.size === 0 ? 'default' : 'pointer'};
          box-shadow: ${viewState.selectedStudentIds.size === 0 ? 'none' : '0 4px 12px rgba(37,99,235,.2)'}; font-family: inherit;
        ">
          ${renderIcon('arrowR', 15, '#fff')} 발송인원 추가 ${contactCount > 0 ? `(${contactCount}건)` : ''}
        </button>
      </div>
    `;

    // Hook listeners
    const classFilter = block.querySelector('#studentClassFilter');
    classFilter.addEventListener('change', (e) => {
      viewState.studentFilterKlass = e.target.value;
      renderStudentList(true);
    });

    const payFilter = block.querySelector('#studentPayFilter');
    payFilter.addEventListener('change', (e) => {
      viewState.studentFilterPay = e.target.value;
      renderStudentList(true);
    });

    const searchInput = block.querySelector('#studentSearchInput');
    searchInput.addEventListener('input', (e) => {
      viewState.studentSearchQuery = e.target.value;
      renderStudentList(false);
    });

    block.querySelectorAll('.student-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const id = row.dataset.id;
        if (viewState.selectedStudentIds.has(id)) {
          viewState.selectedStudentIds.delete(id);
        } else {
          viewState.selectedStudentIds.add(id);
        }
        renderStudentList(false);
      });
    });

    block.querySelector('#btnToggleAllStudents').addEventListener('click', () => {
      if (allChecked) {
        filtered.forEach(s => viewState.selectedStudentIds.delete(s.id));
      } else {
        filtered.forEach(s => viewState.selectedStudentIds.add(s.id));
      }
      renderStudentList(false);
    });

    block.querySelector('#btnToggleDedupe').addEventListener('click', () => {
      viewState.dedupe = !viewState.dedupe;
      renderStudentList(false);
    });

    block.querySelectorAll('.btn-toggle-contact-type').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        viewState.contactTypes[type] = !viewState.contactTypes[type];
        renderStudentList(false);
      });
    });

    block.querySelector('#btnAddToRecipients').addEventListener('click', () => {
      const incoming = [];
      students.forEach(s => {
        if (!viewState.selectedStudentIds.has(s.id)) return;
        
        if (viewState.contactTypes.student) {
          incoming.push({ name: s.name, phone: s.studentPhone, role: "본인", no: s.id, optOut: s.optOut, key: s.studentPhone + "|본인", source: "student" });
        }
        if (viewState.contactTypes.g1) {
          incoming.push({ name: s.name, phone: s.guardian1.phone, role: `보호자(${s.guardian1.label})`, no: s.id, optOut: s.optOut, key: s.guardian1.phone + "|g1", source: "student" });
        }
        if (viewState.contactTypes.g2 && s.guardian2) {
          incoming.push({ name: s.name, phone: s.guardian2.phone, role: `보호자(${s.guardian2.label})`, no: s.id, optOut: s.optOut, key: s.guardian2.phone + "|g2", source: "student" });
        }
      });

      // Update recipients list
      const next = [...viewState.recipients];
      const exist = new Set(viewState.recipients.map(r => r.phone));
      incoming.forEach(it => {
        if (viewState.dedupe && exist.has(it.phone)) return;
        exist.add(it.phone);
        next.push(it);
      });
      viewState.recipients = next;

      // Clear selection
      viewState.selectedStudentIds.clear();
      
      renderStudentList(true);
      renderRecipientList();
      renderComposePanel();
      renderSendBar();
    });
  };

  // 4. Column 2 Top: Recipient List
  const renderRecipientList = () => {
    const block = container.querySelector('#recipientListPanel');
    block.className = 'message-send-card';
    
    const ghostBtnStyle = `display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; font-size: 12px; font-weight: 700; border-radius: 8px; cursor: pointer; font-family: inherit; margin-bottom: 0;`;

    block.innerHTML = `
      <div class="message-send-card-header" style="flex-wrap: wrap;">
        <span style="width: 26px; height: 26px; border-radius: 7px; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; fontSize: 12px; fontWeight: 800;">2</span>
        <h2 class="message-send-card-title">발송 인원</h2>
        <span style="font-size: 12px; font-weight: 700; color: #0f766e; background: #e2f4f1; padding: 2px 9px; border-radius: 999px; margin-left: 6px; ${viewState.recipients.length === 0 ? 'display: none;' : ''}" id="totalRecipientsLabel">${viewState.recipients.length}건</span>
        
        <div style="margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap;">
          <button id="btnExcelImportStub" style="${ghostBtnStyle} color: #0f766e; background: #e2f4f1; border: 1px solid #b7e2db;">
            ${renderIcon('grid', 13, '#0f766e')} 엑셀 추가
          </button>
          <button id="btnDirectAddStub" style="${ghostBtnStyle} color: #b45309; background: #fef3dd; border: 1px solid #fadfa9;">
            ${renderIcon('plus', 13, '#b45309')} 직접 입력
          </button>
          ${viewState.recipients.length > 0 ? `
            <button id="btnClearRecipients" style="${ghostBtnStyle} color: #64748b; background: #fff; border: 1px solid #e2e8f0;">
              ${renderIcon('close', 12, '#64748b')} 전체 삭제
            </button>
          ` : ''}
        </div>
      </div>

      <div style="min-height: 80px; max-height: 150px; overflow-y: auto; padding: 12px; background: #fafbfe;">
        ${viewState.recipients.length === 0 ? `
          <div style="padding: 16px 10px; text-align: center; font-size: 12px; color: var(--text-muted); line-height: 1.6;">
            왼쪽 리스트에서 학생을 추가하거나,<br>엑셀 추가·직접 입력 버튼을 활용해 수신인을 지정하세요.
          </div>
        ` : `
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${viewState.recipients.map((r, i) => {
              const hue = (r.no || i) % 6;
              const avBg = ["#eff6ff", "#f5f3ff", "#ecfdf3", "#fff7ed", "#fef2f2", "#f5f5f5"][hue];
              const avFg = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#4b5563"][hue];
              
              let roleTone = "slate";
              if (r.role.includes("모")) roleTone = "violet";
              else if (r.role.includes("부")) roleTone = "violet";
              else if (r.role === "본인") roleTone = "blue";
              else if (r.role === "직접입력") roleTone = "amber";
              else if (r.role === "엑셀") roleTone = "teal";
              
              return `
                <span class="message-send-recipient-card" style="
                  display: inline-flex; align-items: center; gap: 7px; padding: 5px 8px;
                  background: #fff; border: 1px solid var(--border-color); border-radius: 9px;
                  box-shadow: var(--shadow-sm); position: relative;
                ">
                  <span class="message-send-avatar" style="width: 22px; height: 22px; font-size: 9px; background: ${avBg}; color: ${avFg};">${r.name.slice(-2)}</span>
                  <span>
                    <span style="display: flex; align-items: center; gap: 4px; line-height: 1.2;">
                      <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">${r.name}</span>
                      <span class="message-send-chip tone-${roleTone}" style="padding: 0px 5px; font-size: 9px; border-radius: 4px; font-weight: 800;">${r.role}</span>
                    </span>
                    <span style="display: block; font-size: 10px; color: var(--text-muted-light); margin-top: 1px;">${r.phone}</span>
                  </span>
                  <button class="btn-remove-recipient" data-key="${r.key}" style="
                    width: 18px; height: 18px; border-radius: 4px; border: none; background: #f1f5f9; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; margin-left: 2px; padding: 0;
                  ">${renderIcon('close', 10, '#64748b')}</button>
                </span>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    // Hook listeners
    block.querySelectorAll('.btn-remove-recipient').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        viewState.recipients = viewState.recipients.filter(r => r.key !== key);
        renderRecipientList();
        renderComposePanel();
        renderSendBar();
      });
    });

    const clearBtn = block.querySelector('#btnClearRecipients');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        viewState.recipients = [];
        renderRecipientList();
        renderComposePanel();
        renderSendBar();
      });
    }

    block.querySelector('#btnExcelImportStub').addEventListener('click', () => {
      viewState.excelImportModalOpen = true;
      renderExcelImportModal();
    });

    block.querySelector('#btnDirectAddStub').addEventListener('click', () => {
      viewState.directAddModalOpen = true;
      renderDirectAddModal();
    });
  };

  // 5. Column 2: Compose Panel
  const renderComposePanel = () => {
    const block = container.querySelector('#composePanel');
    const kind = viewState.method === "PUSH" ? "PUSH" : viewState.method === "알림톡" ? "알림톡" : msgKind(viewState.title, viewState.body, !!viewState.image);
    const bytes = byteLen(viewState.title) + byteLen(viewState.body);
    const limit = kind === "SMS" ? 90 : 2000;
    const isOver = bytes > limit;
    
    // 동적 발신번호 목록 구성
    const getSenderNumbers = () => {
      const numbers = [];
      const settings = stateStore.getSettings() || {};
      const currentUser = stateStore.getCurrentUser() || {};
      
      if (settings.phone) {
        numbers.push({ label: `대표번호: ${settings.phone}`, value: settings.phone.replace(/[^0-9]/g, '') });
      }
      if (currentUser.phone) {
        numbers.push({ label: `대표자: ${currentUser.phone}`, value: currentUser.phone.replace(/[^0-9]/g, '') });
      }
      
      const dbSettings = stateStore.db.settings || {};
      if (dbSettings.senderNumber) {
        numbers.push({ label: `설정 발신번호: ${dbSettings.senderNumber}`, value: dbSettings.senderNumber.replace(/[^0-9]/g, '') });
      }
      if (dbSettings.representativePhone) {
        numbers.push({ label: `대표자 연락처: ${dbSettings.representativePhone}`, value: dbSettings.representativePhone.replace(/[^0-9]/g, '') });
      }

      const uniqueMap = new Map();
      numbers.forEach(n => {
        if (n.value && !uniqueMap.has(n.value)) {
          uniqueMap.set(n.value, n);
        }
      });

      const list = Array.from(uniqueMap.values());
      if (list.length === 0) {
        list.push({ label: "기본 발신번호: 02-1234-5678", value: "0212345678" });
      }
      list.push({ label: "직접 입력...", value: "custom" });
      return list;
    };
    
    const senderNumbers = getSenderNumbers();
    if (!viewState.senderSelectValue) {
      viewState.senderSelectValue = senderNumbers[0].value;
      viewState.senderNumber = senderNumbers[0].value;
    }
    
    block.className = 'message-send-card';
    block.innerHTML = `
      <div class="message-send-card-header">
        <span style="width: 26px; height: 26px; border-radius: 7px; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800;">2</span>
        <h2 class="message-send-card-title">보낼 메시지 작성</h2>
        <span style="
          margin-left: auto; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px;
          color: ${kind === "SMS" ? "var(--sky)" : kind === "LMS" ? "var(--violet)" : kind === "MMS" ? "var(--rose)" : kind === "PUSH" ? "var(--success)" : "var(--primary)"};
          background: ${kind === "SMS" ? "var(--sky-light)" : kind === "LMS" ? "var(--violet-light)" : kind === "MMS" ? "var(--rose-light)" : kind === "PUSH" ? "var(--success-light)" : "var(--primary-light)"};
        ">${kind}</span>
      </div>

      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
        <!-- Sender number -->
        <div>
          <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-muted); margin-bottom: 5px;">발신 번호</label>
          <div style="display: flex; flex-direction: column; gap: 7px;">
            <div style="position: relative; width: 100%;">
              <select id="senderNumberSelect" style="
                width: 100%; padding: 8px 30px 8px 10px; font-size: 13px; color: var(--text-main);
                background: #f8fafc; border: 1px solid var(--border-color); border-radius: 9px; appearance: none; font-weight: 600; cursor: pointer;
              ">
                ${senderNumbers.map(n => `<option value="${n.value}" ${viewState.senderSelectValue === n.value ? 'selected' : ''}>${n.label}</option>`).join('')}
              </select>
              <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none;">${renderIcon('chevronD', 14, '#94A3B8')}</span>
            </div>
            
            ${viewState.senderSelectValue === "custom" ? `
              <input type="text" id="customSenderNumberInput" value="${viewState.customSenderNumber}" placeholder="발신 전화번호 직접 입력 (예: 01012345678)" style="
                width: 100%; padding: 8px 11px; font-size: 13px; color: var(--text-main); background: #ffffff;
                border: 1px solid var(--border-color); border-radius: 9px; margin-top: 2px;
              " />
            ` : ''}
          </div>
        </div>

        <!-- Channel + Scheduling -->
        <div style="display: flex; gap: 10px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: var(--text-muted); margin-bottom: 5px;">발송방식</label>
            <div style="display: flex; gap: 3px; padding: 3px; background: #f1f5f9; border-radius: 9px;">
              ${["SMS", "PUSH", "알림톡"].map(m => `
                <button class="btn-toggle-method" data-method="${m}" style="
                  padding: 6px 14px; font-size: 12px; font-weight: 700; border-radius: 7px; border: none; cursor: pointer; margin-bottom: 0;
                  color: ${viewState.method === m ? 'var(--primary)' : '#8a97a8'};
                  background: ${viewState.method === m ? '#fff' : 'transparent'};
                  box-shadow: ${viewState.method === m ? '0 1px 2px rgba(16,24,40,.08)' : 'none'};
                  font-family: inherit;
                ">${m}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <div style="height: 1px; background: #f1f5f9;"></div>

        <!-- Macro variables -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
          <label style="font-size: 11.5px; font-weight: 700; color: var(--text-muted);">제목</label>
          <div style="position: relative;">
            <select id="macroInsertSelect" style="
              appearance: none; padding: 4px 24px 4px 10px; font-size: 11px; font-weight: 700; color: var(--primary);
              background: var(--primary-light); border: 1px solid #c3d4fb; border-radius: 7px; cursor: pointer;
            ">
              <option value="">+ 치환 변수</option>
              ${MACROS.map(m => `<option value="${m.token}">${m.label}</option>`).join('')}
            </select>
            <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); pointer-events: none;">${renderIcon('chevronD', 11, 'var(--primary)')}</span>
          </div>
        </div>

        <!-- Title input -->
        <input type="text" id="composeTitleInput" value="${viewState.title}" placeholder="메시지 제목 입력 (LMS/MMS만 전송됨)" style="
          width: 100%; padding: 8px 11px; font-size: 13px; color: var(--text-main); background: #f8fafc;
          border: 1px solid var(--border-color); border-radius: 9px;
        " />

        <!-- Phone screen style compose textarea -->
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <label style="font-size: 11.5px; font-weight: 700; color: var(--text-muted);">메시지 본문 입력</label>
            <span style="font-size: 11px; font-weight: 700; color: ${isOver ? 'var(--danger)' : 'var(--text-muted)'};" fontvariantnumeric="tabular-nums">
              ${bytes} / ${limit} byte ${isOver ? '· 초과' : ''}
            </span>
          </div>
          
          <textarea id="composeBodyInput" placeholder="여기에 발송할 메시지 내용을 입력하세요." style="
            width: 100%; min-height: 110px; padding: 12px 14px; font-size: 13.5px; line-height: 1.55;
            color: var(--text-main); background: #ffffff; border: 1.5px solid var(--border-color);
            border-radius: 10px; outline: none; transition: all 0.2s ease; resize: vertical;
            box-shadow: 0 1px 2px rgba(16,24,40,.05); font-family: inherit; margin-bottom: 12px;
          " onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 3px rgba(37,99,235,.15)';" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none';">${viewState.body}</textarea>
          
          <!-- Realistic Smartphone Preview Container -->
          <div class="phone-frame">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 16px 3px; font-size: 11px; font-weight: 700; color: var(--text-main);">
              <span>오후 2:56</span>
              <span style="display: flex; align-items: center; gap: 5px;">
                <svg width="14" height="10" viewBox="0 0 16 11"><g fill="currentColor"><rect x="0" y="7" width="2" height="4" rx="0.5"/><rect x="3" y="5" width="2" height="6" rx="0.5"/><rect x="6" y="3" width="2" height="8" rx="0.5"/><rect x="9" y="1" width="2" height="10" rx="0.5"/></g></svg>
                ${renderIcon('clock', 12)}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid #f1f5f9;">
              <span style="width: 24px; height: 24px; border-radius: 999px; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800;">튜</span>
              <span style="font-size: 12px; font-weight: 700;">${ORG.academy}</span>
              <span style="margin-left: auto;">${renderIcon('phone', 14, '#94a3b8')}</span>
            </div>
            <div style="background: #eef2f6; height: 160px; overflow-y: auto; padding: 12px; display: flex; flex-direction: column;">
              <div style="margin: 0 auto 10px; text-align: center;"><span style="font-size: 9px; color: #94a3b8; background: #e2e8f0; padding: 2px 8px; border-radius: 999px;">오늘 오후 2:56</span></div>
              <div style="max-width: 220px; background: #fff; border-radius: 5px 15px 15px 15px; padding: 9px 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); margin-right: auto; position: relative; font-size: 12.5px; line-height: 1.5; color: var(--text-main); word-break: break-all;">
                ${viewState.image ? `<div style="height: 50px; background: #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; margin-bottom: 6px;">[이미지 첨부됨]</div>` : ''}
                ${(() => {
                  const val = viewState.body || "";
                  if (!val.trim()) return '<span style="color: #94a3b8;">작성된 메시지가 없습니다.</span>';
                  return val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
                })()}
              </div>
            </div>
            <div style="height: 16px; background: #eef2f6; display: flex; justify-content: center; align-items: center; padding-bottom: 6px;">
              <span style="width: 80px; height: 3px; background: #cbd5e1; border-radius: 999px;"></span>
            </div>
          </div>
        </div>

        <!-- Image attachment -->
        <div>
          ${viewState.image ? `
            <div style="display: flex; align-items: center; gap: 8px; padding: 7px 11px; background: var(--violet-light); border: 1px solid var(--violet); border-radius: 9px;">
              <span style="width: 26px; height: 26px; border-radius: 6px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--violet);">${renderIcon('note', 14, 'var(--violet)')}</span>
              <span style="flex: 1; min-width: 0;">
                <span style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${viewState.image}</span>
                <span style="font-size: 9.5px; color: var(--text-muted);">MMS 자동 전환</span>
              </span>
              <button id="btnRemoveImage" style="width: 20px; height: 20px; border-radius: 4px; border: none; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">${renderIcon('close', 10, '#64748b')}</button>
            </div>
          ` : `
            <button id="btnComposeAddImage" style="
              width: 100%; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 8px;
              font-size: 12px; font-weight: 700; color: var(--slate); background: #f8fafc;
              border: 1.5px dashed var(--border-color); border-radius: 999px; cursor: pointer; margin-bottom: 0; font-family: inherit;
            ">
              ${renderIcon('plus', 14, '#94a3b8')} 이미지 첨부 (MMS 전환)
            </button>
          `}
        </div>

        <!-- Save Template Button -->
        <div style="margin-top: 8px;">
          <button id="btnOpenSaveTemplateModal" style="
            width: 100%; padding: 9px; display: flex; align-items: center; justify-content: center; gap: 6px;
            font-size: 12px; font-weight: 700; color: var(--primary); background: var(--primary-light);
            border: 1px solid #c3d4fb; border-radius: 9px; cursor: pointer; margin-bottom: 0; font-family: inherit;
          ">
            ${renderIcon('star', 13, 'var(--primary)')} 현재 내용을 템플릿으로 저장
          </button>
        </div>

        <!-- Action Buttons Split -->
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button id="btnReviewSend" ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? 'disabled' : ''} style="
            flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 11px; font-size: 13.5px; font-weight: 800;
            color: #fff; background: ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#cbd5e0' : 'var(--primary)'};
            border: none; border-radius: 10px; cursor: ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? 'default' : 'pointer'};
            box-shadow: ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? 'none' : '0 4px 12px rgba(37,99,235,.15)'};
            font-family: inherit; margin-bottom: 0;
          ">
            ${renderIcon('send', 14, '#fff')} ${viewState.recipients.length}명 즉시발송
          </button>
          
          <button id="btnReserveSend" ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? 'disabled' : ''} style="
            flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 11px; font-size: 13.5px; font-weight: 800;
            color: ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#94a3b8' : 'var(--slate)'};
            background: ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#f1f5f9' : '#e2e8f0'};
            border: none; border-radius: 10px; cursor: ${viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? 'default' : 'pointer'};
            font-family: inherit; margin-bottom: 0;
          ">
            ${renderIcon('clock', 14, viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#94a3b8' : 'var(--slate)')} ${viewState.recipients.length}명 예약발송
          </button>
        </div>
      </div>
    `;

    // Hook listeners
    const senderSelect = block.querySelector('#senderNumberSelect');
    senderSelect.addEventListener('change', (e) => {
      viewState.senderSelectValue = e.target.value;
      if (e.target.value === "custom") {
        viewState.senderNumber = viewState.customSenderNumber;
      } else {
        viewState.senderNumber = e.target.value;
      }
      renderComposePanel();
      renderSendBar();
    });

    const customSenderInput = block.querySelector('#customSenderNumberInput');
    if (customSenderInput) {
      customSenderInput.addEventListener('input', (e) => {
        viewState.customSenderNumber = e.target.value;
        viewState.senderNumber = e.target.value;
      });
    }

    block.querySelectorAll('.btn-toggle-method').forEach(btn => {
      btn.addEventListener('click', () => {
        viewState.method = btn.dataset.method;
        renderComposePanel();
        renderSendBar();
      });
    });

    const macroSelect = block.querySelector('#macroInsertSelect');
    macroSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      
      const ta = block.querySelector('#composeBodyInput');
      if (!ta) return;

      const start = ta.selectionStart || viewState.body.length;
      const end = ta.selectionEnd || viewState.body.length;
      viewState.body = viewState.body.slice(0, start) + val + viewState.body.slice(end);

      renderComposePanel();
    });

    const titleInp = block.querySelector('#composeTitleInput');
    titleInp.addEventListener('input', (e) => {
      viewState.title = e.target.value;
      const kindSpan = block.querySelector('.message-send-card-header span:last-child');
      const calculatedKind = viewState.method === "PUSH" ? "PUSH" : viewState.method === "알림톡" ? "알림톡" : msgKind(viewState.title, viewState.body, !!viewState.image);
      kindSpan.textContent = calculatedKind;

      const reviewBtn = block.querySelector('#btnReviewSend');
      if (reviewBtn) {
        reviewBtn.disabled = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image);
      }

      const reserveSendBtn = block.querySelector('#btnReserveSend');
      if (reserveSendBtn) {
        reserveSendBtn.disabled = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image);
        reserveSendBtn.style.color = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#94a3b8' : 'var(--slate)';
        reserveSendBtn.style.background = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#f1f5f9' : '#e2e8f0';
      }

      const sendBarMsgType = container.querySelector('#sendBarMsgType');
      if (sendBarMsgType) {
        sendBarMsgType.textContent = calculatedKind;
        sendBarMsgType.style.color = calculatedKind === 'SMS' ? 'var(--sky)' : calculatedKind === 'LMS' ? 'var(--violet)' : calculatedKind === 'MMS' ? 'var(--rose)' : calculatedKind === 'PUSH' ? 'var(--success)' : 'var(--primary)';
      }
    });

    const bodyInp = block.querySelector('#composeBodyInput');
    bodyInp.addEventListener('input', (e) => {
      viewState.body = e.target.value;
      
      // Update byte counter and live preview in UI
      const countLabel = block.querySelector('span[fontvariantnumeric="tabular-nums"]');
      const currentBytes = byteLen(viewState.title) + byteLen(viewState.body);
      const calculatedKind = viewState.method === "PUSH" ? "PUSH" : viewState.method === "알림톡" ? "알림톡" : msgKind(viewState.title, viewState.body, !!viewState.image);
      const limitVal = calculatedKind === "SMS" ? 90 : 2000;
      if (countLabel) {
        countLabel.textContent = `${currentBytes} / ${limitVal} byte`;
      }
      
      // Real-time live text preview update
      const previewTextDiv = block.querySelector('.phone-frame div[style*="background: #fff; border-radius: 5px 15px 15px 15px"]');
      if (previewTextDiv) {
        const innerText = viewState.body.trim()
          ? viewState.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
          : '<span style="color: #94a3b8;">작성된 메시지가 없습니다.</span>';
        
        previewTextDiv.innerHTML = `
          ${viewState.image ? `<div style="height: 50px; background: #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; margin-bottom: 6px;">[이미지 첨부됨]</div>` : ''}
          ${innerText}
        `;
      }

      const reviewBtn = block.querySelector('#btnReviewSend');
      if (reviewBtn) {
        reviewBtn.disabled = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image);
      }

      const reserveSendBtn = block.querySelector('#btnReserveSend');
      if (reserveSendBtn) {
        reserveSendBtn.disabled = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image);
        reserveSendBtn.style.color = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#94a3b8' : 'var(--slate)';
        reserveSendBtn.style.background = viewState.recipients.length === 0 || (!viewState.body.trim() && !viewState.image) ? '#f1f5f9' : '#e2e8f0';
      }

      const sendBarMsgType = container.querySelector('#sendBarMsgType');
      if (sendBarMsgType) {
        sendBarMsgType.textContent = calculatedKind;
        sendBarMsgType.style.color = calculatedKind === 'SMS' ? 'var(--sky)' : calculatedKind === 'LMS' ? 'var(--violet)' : calculatedKind === 'MMS' ? 'var(--rose)' : calculatedKind === 'PUSH' ? 'var(--success)' : 'var(--primary)';
      }
    });

    // Handle blur and focus mapping
    bodyInp.addEventListener('blur', (e) => {
      viewState.body = e.target.value;
    });

    const addImgBtn = block.querySelector('#btnComposeAddImage');
    if (addImgBtn) {
      addImgBtn.addEventListener('click', () => {
        viewState.image = "학원안내_홍보물.png";
        renderComposePanel();
        renderSendBar();
      });
    }

    const openSaveModalBtn = block.querySelector('#btnOpenSaveTemplateModal');
    if (openSaveModalBtn) {
      openSaveModalBtn.addEventListener('click', () => {
        viewState.saveModalOpen = true;
        viewState.saveModalTitle = viewState.title;
        viewState.saveModalBody = viewState.body;
        viewState.saveModalError = "";
        renderTemplateSaveModal();
      });
    }

    const removeImgBtn = block.querySelector('#btnRemoveImage');
    if (removeImgBtn) {
      removeImgBtn.addEventListener('click', () => {
        viewState.image = null;
        renderComposePanel();
        renderSendBar();
      });
    }

    block.querySelector('#btnReviewSend').addEventListener('click', () => {
      viewState.focusOpen = true;
      renderFocusConfirm();
    });
  };

  // 6. Column 3: Message Vault (Templates / History)
  const renderMessageVault = () => {
    const block = container.querySelector('#messageVaultPanel');
    block.className = 'message-send-col-vault message-send-card';

    let listData = [];
    if (viewState.vaultActiveTab === "recommend") {
      listData = MOCK_RECOMMENDED;
    } else if (viewState.vaultActiveTab === "saved") {
      listData = viewState.savedTemplates;
    } else {
      listData = stateStore.getOutboundMessageLogs();
    }

    // Filter
    if (viewState.vaultSearchQuery) {
      const q = viewState.vaultSearchQuery.trim().toLowerCase();
      listData = listData.filter(item => 
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.body && item.body.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q))
      );
    }

    const currentPage = viewState.vaultPages[viewState.vaultActiveTab] || 0;
    const itemsPerPage = 3; // Smaller size for skeleton viewport
    const totalPages = Math.ceil(listData.length / itemsPerPage);
    const paginatedData = listData.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    const formatDate = (isoString) => {
      if (!isoString) return '';
      try {
        const clean = isoString.replace('T', ' ');
        return clean.slice(0, 16);
      } catch (e) {
        return isoString;
      }
    };

    block.innerHTML = `
      <!-- Tab Header -->
      <div style="display: flex; align-items: center; padding: 12px 12px 0; border-bottom: 1px solid #f1f5f9; gap: 2px;">
        ${[
          { key: "recommend", label: "추천", icon: "star", count: MOCK_RECOMMENDED.length },
          { key: "saved", label: "저장", icon: "note", count: viewState.savedTemplates.length },
          { key: "recent", label: "최근", icon: "clock", count: stateStore.getOutboundMessageLogs().length }
        ].map(tab => {
          const active = viewState.vaultActiveTab === tab.key;
          return `
            <button class="btn-vault-tab" data-tab="${tab.key}" style="
              display: flex; align-items: center; gap: 4px; padding: 8px 10px; cursor: pointer; background: none; border: none;
              border-bottom: 2.5px solid ${active ? 'var(--primary)' : 'transparent'}; margin-bottom: -1px;
              font-size: 13px; font-weight: 700; color: ${active ? 'var(--primary-light-fg, #1d4ed8)' : '#8a97a8'};
              font-family: inherit;
            ">
              ${renderIcon(tab.icon, 13, active ? 'var(--primary)' : '#a6b0bd')} ${tab.label}
              <span style="font-size: 9.5px; font-weight: 800; color: ${active ? '#1D4ED8' : '#b6c0cc'}; background: ${active ? '#eaf1fe' : '#f1f5f9'}; padding: 0 5px; border-radius: 999px; margin-left: 2px;">${tab.count}</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Search bar -->
      <div style="display: flex; gap: 7px; padding: 12px 14px 0;">
        <div style="display: flex; align-items: center; gap: 7px; padding: 7px 10px; background: #fff; border: 1px solid var(--border-color); border-radius: 9px; flex: 1;">
          ${renderIcon('search', 13, '#94A3B8')}
          <input id="vaultSearchInput" value="${viewState.vaultSearchQuery}" placeholder="제목·내용 검색" style="border: none; outline: none; fontSize: 12px; flex: 1; background: transparent; padding: 0;" />
        </div>
      </div>

      <!-- Paginated List with Speech Bubble Previews -->
      <div style="padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 180px; overflow-y: auto;">
        ${paginatedData.length === 0 ? `
          <div style="padding: 40px 10px; text-align: center; font-size: 12px; color: var(--text-muted);">
            ${viewState.vaultSearchQuery 
              ? "검색 결과가 없습니다." 
              : viewState.vaultActiveTab === "recent" 
                ? "최근 발송한 메시지 내역이 없습니다." 
                : viewState.vaultActiveTab === "saved" 
                  ? "저장된 메시지 템플릿이 없습니다." 
                  : "추천 메시지 템플릿이 없습니다."}
          </div>
        ` : paginatedData.map(item => {
          const isRecent = viewState.vaultActiveTab === "recent";
          let kindLabel = item.kind || "";
          let dateLabel = item.sentAt || "";
          let typeBadge = "";
          let recipientLabel = "";

          if (isRecent) {
            kindLabel = item.method === "ALIMTALK" ? "알림톡" : item.method;
            dateLabel = item.sendType === "scheduled" 
              ? formatDate(item.scheduledAt) 
              : formatDate(item.createdAt);

            const typeColor = item.sendType === "scheduled" ? "#d97706" : "#2563eb";
            const typeBg = item.sendType === "scheduled" ? "#fef3dd" : "#eff6ff";
            typeBadge = `<span style="font-size: 9px; font-weight: 800; color: ${typeColor}; background: ${typeBg}; padding: 2px 6px; border-radius: 6px;">${item.sendType === 'scheduled' ? '예약' : '즉시'}</span>`;

            if (item.recipientCount === 1) {
              const name = item.recipients && item.recipients[0] ? item.recipients[0].name : "수신자";
              recipientLabel = `<span style="font-size: 12px; font-weight: 800; color: var(--text-main);">${name}</span>`;
            } else {
              recipientLabel = `<button class="btn-show-recipients-modal" data-id="${item.id}" style="
                border: none; background: none; padding: 0; font-size: 12px; font-weight: 800; color: var(--primary);
                cursor: pointer; text-decoration: underline; font-family: inherit; margin: 0;
              ">단체</button>`;
            }
          } else {
            recipientLabel = item.name ? `<span style="font-size: 12px; font-weight: 800; color: var(--text-main);">${item.name}</span>` : "";
          }

          const typeColor = kindLabel === 'SMS' ? 'var(--sky)' : kindLabel === 'LMS' ? 'var(--violet)' : kindLabel === 'MMS' ? 'var(--rose)' : kindLabel === 'PUSH' ? 'var(--success)' : 'var(--primary)';
          const typeBg = kindLabel === 'SMS' ? 'var(--sky-light)' : kindLabel === 'LMS' ? 'var(--violet-light)' : kindLabel === 'MMS' ? 'var(--rose-light)' : kindLabel === 'PUSH' ? 'var(--success-light)' : 'var(--primary-light)';
          
          const isExpanded = viewState.expandedCardIds.has(item.id);
          const bodyText = item.body || "";
          const showToggle = bodyText.length > 70;
          let displayedBody = bodyText;
          if (showToggle && !isExpanded) {
            displayedBody = bodyText.slice(0, 70) + "...";
          }

          return `
            <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; background: #ffffff; border: 1.5px solid #f1f5f9; box-shadow: 0 2px 8px rgba(0,0,0,0.02); transition: all 0.2s ease;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                ${typeBadge}
                ${recipientLabel}
                <span style="font-size: 9px; font-weight: 800; color: ${typeColor}; background: ${typeBg}; padding: 2px 6px; border-radius: 6px; margin-left: 2px;">${kindLabel}</span>
                ${item.ad ? `<span style="font-size: 9px; font-weight: 800; color: #b45309; background: #fef3dd; padding: 2px 6px; border-radius: 6px;">광고</span>` : ''}
                <span style="margin-left: auto; font-size: 10.5px; color: var(--success); font-weight: 800;">${item.recipientCount || item.count || 0}/${item.recipientCount || item.count || 0}명 발송</span>
              </div>
              
              <!-- Smartphone Message Bubble Style -->
              <div class="message-body-container" data-id="${item.id}" style="
                background: #f1f5f9; border-radius: 5px 12px 12px 12px; padding: 9px 12px; font-size: 11.5px;
                line-height: 1.5; color: #334155; position: relative; border-left: 3px solid ${typeColor};
                cursor: ${showToggle ? 'pointer' : 'default'};
              ">
                <div style="white-space: pre-wrap;">${displayedBody}</div>
                ${showToggle ? `
                  <div class="btn-toggle-body" data-id="${item.id}" style="
                    font-size: 10px; font-weight: 700; color: var(--primary); text-align: right; margin-top: 4px;
                    cursor: pointer; text-decoration: underline;
                  ">${isExpanded ? '접기' : '전체보기'}</div>
                ` : ''}
              </div>
              
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 2px;">
                <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 700;">${dateLabel}</span>
                <div style="display: flex; gap: 6px;">
                  <button class="btn-apply-template" data-id="${item.id}" style="
                    display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; font-size: 11.5px; font-weight: 700;
                    color: #fff; background: var(--primary); border: none; border-radius: 7px; cursor: pointer; font-family: inherit; margin-bottom: 0;
                  ">${renderIcon('check', 11, '#fff', 2.5)} 적용</button>
                  <button class="btn-edit-template-stub" style="
                    display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; font-size: 11.5px; font-weight: 700;
                    color: var(--slate); background: #fff; border: 1px solid var(--border-color); border-radius: 7px; cursor: pointer; font-family: inherit; margin-bottom: 0;
                  ">${renderIcon('edit', 11, 'var(--slate)')} 수정</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Pagination controls -->
      <div style="padding: 0 14px 12px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; align-items: center;">
        ${totalPages > 1 ? `
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 0 4px;">
            <button id="btnPrevVaultPage" ${currentPage === 0 ? 'disabled' : ''} style="width: 24px; height: 24px; border-radius: 6px; border: none; background: #f1f5f9; cursor: ${currentPage === 0 ? 'default' : 'pointer'}; display: flex; align-items: center; justify-content: center; padding: 0; margin-bottom: 0;">
              <span style="transform: scaleX(-1);">${renderIcon('chevronR', 12, currentPage === 0 ? '#cbd5e1' : '#64748b')}</span>
            </button>
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); min-width: 40px; text-align: center;">${currentPage + 1} / ${totalPages}</span>
            <button id="btnNextVaultPage" ${currentPage === totalPages - 1 ? 'disabled' : ''} style="width: 24px; height: 24px; border-radius: 6px; border: none; background: #f1f5f9; cursor: ${currentPage === totalPages - 1 ? 'default' : 'pointer'}; display: flex; align-items: center; justify-content: center; padding: 0; margin-bottom: 0;">
              ${renderIcon('chevronR', 12, currentPage === totalPages - 1 ? '#cbd5e1' : '#64748b')}
            </button>
          </div>
        ` : ''}
        <p style="margin: 4px 0 0; font-size: 10px; color: var(--text-muted-light); text-align: center;">
          ${viewState.vaultActiveTab === "recommend" ? "추천 문구 · 화면 입력칸에 즉시 대입" : "저장 템플릿 · 적용 단추로 덮어쓰기"}
        </p>
      </div>
    `;

    // Hook listeners
    block.querySelectorAll('.btn-vault-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        viewState.vaultActiveTab = btn.dataset.tab;
        renderMessageVault();
      });
    });

    const searchInp = block.querySelector('#vaultSearchInput');
    searchInp.addEventListener('input', (e) => {
      viewState.vaultSearchQuery = e.target.value;
      viewState.vaultPages[viewState.vaultActiveTab] = 0;
      renderMessageVault();
    });

    block.querySelectorAll('.btn-apply-template').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = listData.find(d => d.id === id);
        if (!item) return;

        viewState.title = item.title || "";
        viewState.body = item.body || "";
        
        const isMms = (item.kind === "MMS" || item.method === "MMS" || item.imageName);
        viewState.image = isMms ? (item.imageName || "안내_포스터.jpg") : null;
        
        const kind = item.kind || item.method;
        if (kind === "PUSH") {
          viewState.method = "PUSH";
        } else if (kind === "알림톡" || kind === "ALIMTALK") {
          viewState.method = "알림톡";
        } else {
          viewState.method = "SMS";
        }

        renderComposePanel();
        renderSendBar();
      });
    });

    block.querySelectorAll('.btn-edit-template-stub').forEach(btn => {
      btn.addEventListener('click', () => {
        alert("템플릿 관리(신규 템플릿 저장, 기존 템플릿 편집) 기능은 추후 고도화 단계에서 연동됩니다.");
      });
    });

    // Body expand/collapse click handlers
    block.querySelectorAll('.message-body-container').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const item = listData.find(d => d.id === id);
        if (!item || (item.body || "").length <= 70) return;
        
        if (viewState.expandedCardIds.has(id)) {
          viewState.expandedCardIds.delete(id);
        } else {
          viewState.expandedCardIds.add(id);
        }
        renderMessageVault();
      });
    });

    block.querySelectorAll('.btn-toggle-body').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (viewState.expandedCardIds.has(id)) {
          viewState.expandedCardIds.delete(id);
        } else {
          viewState.expandedCardIds.add(id);
        }
        renderMessageVault();
      });
    });

    // Group recipient modal handler
    block.querySelectorAll('.btn-show-recipients-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        viewState.recipientDetailLogId = id;
        viewState.recipientDetailModalOpen = true;
        renderRecipientDetailModal();
      });
    });

    const prevBtn = block.querySelector('#btnPrevVaultPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 0) {
          viewState.vaultPages[viewState.vaultActiveTab] = currentPage - 1;
          renderMessageVault();
        }
      });
    }

    const nextBtn = block.querySelector('#btnNextVaultPage');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages - 1) {
          viewState.vaultPages[viewState.vaultActiveTab] = currentPage + 1;
          renderMessageVault();
        }
      });
    }
  };

  const processMessageSend = (isScheduled) => {
    if (viewState.recipients.length === 0) {
      alert("수신자가 없습니다.");
      return;
    }
    if (!viewState.body.trim() && !viewState.image) {
      alert("메시지 제목이나 본문을 입력해 주세요.");
      return;
    }

    const sendType = isScheduled ? "scheduled" : "immediate";
    const status = isScheduled ? "scheduled_stub" : "stub_saved";
    const method = viewState.method === "알림톡" ? "ALIMTALK" : viewState.method === "PUSH" ? "PUSH" : "SMS";

    const logData = {
      sendType,
      status,
      method,
      senderNumber: viewState.senderNumber || "0212345678",
      title: viewState.title || "",
      body: viewState.body || "",
      recipients: viewState.recipients.map(r => ({
        name: r.name,
        phone: r.phone,
        role: r.role || "직접입력",
        studentId: r.no || null,
        source: r.source || "student"
      })),
      recipientCount: viewState.recipients.length,
      scheduledAt: isScheduled ? `${viewState.schedule.date}T${viewState.schedule.time}:00+09:00` : null,
      imageName: viewState.image
    };

    stateStore.addOutboundMessageLog(logData);

    if (isScheduled) {
      alert("실제 예약발송은 아직 연동되지 않았고, 예약이력만 저장되었습니다.");
    } else {
      alert("실제 발송은 아직 연동되지 않았고, 발송이력만 저장되었습니다.");
    }

    viewState.recipients = [];
    viewState.selectedStudentIds.clear();
    viewState.title = "";
    viewState.body = "";
    viewState.image = null;
    viewState.schedule.on = false;
    viewState.focusOpen = false;
    
    // Auto toggle to recent tab to show the new item immediately
    viewState.vaultActiveTab = "recent";
    viewState.vaultPages["recent"] = 0;

    render();
  };

  // 7. Sticky bottom SendBar
  const renderSendBar = () => {
    const block = container.querySelector('#globalSendBar');
    if (viewState.recipients.length === 0) {
      block.innerHTML = '';
      return;
    }

    const excluded = viewState.recipients.filter(r => r.optOut).length;
    const sendable = viewState.recipients.length - excluded;
    const kind = viewState.method === "PUSH" ? "PUSH" : viewState.method === "알림톡" ? "알림톡" : msgKind(viewState.title, viewState.body, !!viewState.image);

    block.innerHTML = `
      <div style="
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 60;
        background: rgba(255,255,255,.94); backdrop-filter: blur(10px); border-top: 1px solid var(--border-color);
        box-shadow: 0 -8px 24px -12px rgba(16,24,40,.15);
      ">
        <div style="max-width: 1200px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 9px;">
            <span style="width: 38px; height: 38px; border-radius: 11px; background: var(--primary-light); display: flex; align-items: center; justify-content: center;">
              ${renderIcon('send', 19, 'var(--primary)')}
            </span>
            <div>
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">받는 사람</div>
              <div style="font-size: 15px; font-weight: 800; color: var(--text-main); line-height: 1.1;">
                <span id="sendBarSendableCount">${sendable}명</span> 
                ${excluded > 0 ? `<span style="font-size: 11px; color: var(--text-muted-light); font-weight: 600;"> (거부 ${excluded} 제외)</span>` : ''}
              </div>
            </div>
          </div>
          <div style="height: 30px; width: 1px; background: var(--border-color);" class="sendbar-divider"></div>
          
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="display: flex; flex-direction: column;">
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">유형</span>
              <span id="sendBarMsgType" style="font-size: 13px; font-weight: 800; color: ${kind === 'SMS' ? 'var(--sky)' : kind === 'LMS' ? 'var(--violet)' : kind === 'MMS' ? 'var(--rose)' : kind === 'PUSH' ? 'var(--success)' : 'var(--primary)'};">${kind}</span>
            </span>
            ${viewState.schedule.on ? `
              <span style="display: flex; flex-direction: column;">
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">예약발송</span>
                <span style="font-size: 13px; font-weight: 800; color: var(--warning);">${viewState.schedule.date.slice(5)} ${viewState.schedule.time}</span>
              </span>
            ` : ''}
          </div>
          
          <div style="margin-left: auto; display: flex; gap: 8px;">
            <button id="btnSendBarDirect" style="
              display: flex; align-items: center; gap: 6px; padding: 11px 20px; font-size: 13.5px; font-weight: 800;
              color: #fff; background: var(--primary); border: none; border-radius: 10px; cursor: pointer;
              box-shadow: 0 4px 12px rgba(37,99,235,.2); font-family: inherit; margin-bottom: 0;
            ">
              ${renderIcon('send', 14, '#fff')} ${sendable}명 즉시발송
            </button>
            <button id="btnSendBarReserve" style="
              display: flex; align-items: center; gap: 6px; padding: 11px 20px; font-size: 13.5px; font-weight: 800;
              color: var(--slate); background: #e2e8f0; border: none; border-radius: 10px; cursor: pointer;
              font-family: inherit; margin-bottom: 0;
            ">
              ${renderIcon('clock', 14, 'var(--slate)')} ${sendable}명 예약발송
            </button>
          </div>
        </div>
      </div>
    `;

    block.querySelector('#btnSendBarDirect').addEventListener('click', () => {
      processMessageSend(false);
    });

    block.querySelector('#btnSendBarReserve').addEventListener('click', () => {
      processMessageSend(true);
    });
  };

  // 8. Focus Review Confirm Overlay Modal
  const renderFocusConfirm = () => {
    const block = container.querySelector('#focusConfirmOverlay');
    if (!viewState.focusOpen) {
      block.style.display = 'none';
      block.style.position = '';
      block.style.inset = '';
      block.style.zIndex = '';
      block.innerHTML = '';
      return;
    }
    block.style.display = 'flex';
    block.style.position = 'fixed';
    block.style.inset = '0';
    block.style.zIndex = '95';
    block.style.alignItems = 'center';
    block.style.justifyContent = 'center';
    block.style.padding = '20px';
    block.style.background = 'rgba(15, 23, 42, 0.42)';
    block.style.animation = 'fadeIn 0.15s ease-out';

    const excluded = viewState.recipients.filter(r => r.optOut).length;
    const sendable = viewState.recipients.length - excluded;
    const kind = viewState.method === "PUSH" ? "PUSH" : viewState.method === "알림톡" ? "알림톡" : msgKind(viewState.title, viewState.body, !!viewState.image);
    const unitPrice = kind === "SMS" ? 20 : kind === "LMS" ? 50 : kind === "MMS" ? 200 : kind === "알림톡" ? 15 : 0;
    const cost = unitPrice * sendable;
    const chipToneClass = kind === 'SMS' ? 'sky' : kind === 'LMS' ? 'violet' : kind === 'MMS' ? 'red' : kind === 'PUSH' ? 'green' : 'blue';

    block.innerHTML = `
      <!-- Close overlay clicking backdrop -->
      <div id="btnFocusCloseBackdrop" style="position: absolute; inset: 0;"></div>
      
      <div style="
        position: relative; width: 680px; max-width: 100%; background: #f8fafc; border-radius: 20px;
        box-shadow: 0 30px 80px -20px rgba(16,24,40,.3); overflow: hidden; display: flex; flex-direction: column;
        animation: popIn 0.15s ease-out; z-index: 96;
      ">
        <!-- Header -->
          <div style="display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #edf2f7;">
            <span style="width: 28px; height: 28px; border-radius: 8px; background: var(--primary-light); display: flex; align-items: center; justify-content: center;">
              ${renderIcon('send', 14, 'var(--primary)')}
            </span>
            <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-main);">발송 검토 (가상 스텁)</h3>
            <button id="btnFocusClose" style="
              margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border-color);
              background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
            ">${renderIcon('close', 14, '#64748b')}</button>
          </div>

          <!-- Body -->
          <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; max-height: 70vh;">
            <!-- Metrics Summary Cards -->
            <div style="display: flex; gap: 10px;">
              <div style="flex: 1; padding: 10px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;">
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">수신 대상</div>
                <div style="font-size: 16px; font-weight: 800; color: var(--text-main);" id="focusSendableCount">${sendable}명</div>
                <div style="font-size: 9.5px; color: var(--text-muted-light); margin-top: 2px;">거부 ${excluded}명 제외</div>
              </div>
              <div style="flex: 1; padding: 10px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;">
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; margin-bottom: 2px;">발송 방식</div>
                <div style="font-size: 16px; font-weight: 800; color: ${kind === 'SMS' ? 'var(--sky)' : kind === 'LMS' ? 'var(--violet)' : kind === 'MMS' ? 'var(--rose)' : kind === 'PUSH' ? 'var(--success)' : 'var(--primary)'};">${kind}</div>
                <div style="font-size: 9.5px; color: var(--text-muted-light); margin-top: 2px;">발신: ${viewState.senderNumber}</div>
              </div>
            </div>

            <!-- Schedule Date/Time -->
            <div style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: ${viewState.schedule.on ? '#fff8eb' : '#f1f5f9'}; border: 1px solid ${viewState.schedule.on ? '#fadfa9' : '#e2e8f0'}; border-radius: 10px; font-size: 12.5px;">
              ${renderIcon(viewState.schedule.on ? 'clock' : 'send', 14, viewState.schedule.on ? 'var(--warning)' : 'var(--slate)')}
              <span style="font-weight: 700; color: var(--text-main);">
                ${viewState.schedule.on ? `예약 발송 예정: ${viewState.schedule.date} ${viewState.schedule.time}` : '즉시 발송 (가상 실행)'}
              </span>
            </div>

            <!-- Scoped Message bubble preview -->
            <div style="background: #fff; border: 1px solid #edf2f7; border-radius: 12px; padding: 12px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">전송 내용 미리보기</div>
              <div style="background: #eef2f6; border-radius: 10px; padding: 10px; max-width: 280px; margin: 0 auto; border: 1px solid #e2e8f0;">
                <div style="font-size: 10px; color: var(--text-muted); border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                  <span>수신화면 미리보기</span>
                  <span class="message-send-chip tone-${chipToneClass}" style="padding: 0 4px; font-size: 8px; border-radius: 3px;">${kind}</span>
                </div>
                ${viewState.image ? `<div style="height: 60px; background: #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #475569; margin-bottom: 6px;">[이미지 첨부: ${viewState.image}]</div>` : ''}
                ${viewState.title ? `<div style="font-weight: 700; font-size: 12px; color: #000; margin-bottom: 4px;">${viewState.title}</div>` : ''}
                <div style="font-size: 12px; color: #334155; line-height: 1.45; white-space: pre-wrap;">${viewState.body}</div>
              </div>
            </div>
            
            <!-- Compliance check stub warning -->
            <div style="padding: 10px 12px; background: #fff8eb; border: 1px solid #fce3b5; border-radius: 10px; display: flex; gap: 8px; align-items: flex-start;">
              <span style="margin-top: 2px;">${renderIcon('alert', 14, 'var(--warning)', 2.2)}</span>
              <span style="font-size: 11.5px; color: #92610f; line-height: 1.45;">
                <b>법적 의무 점검 (가상)</b>: 실제 발송 기능이 억제되어 있으므로, 수신거부 필터링 및 광고성 필수 문구 점검 프로세스가 자동으로 보류되었습니다.
              </span>
            </div>
          </div>

          <!-- Footer -->
          <div style="display: flex; gap: 10px; padding: 12px 20px; background: #fff; border-top: 1px solid #edf2f7; justify-content: flex-end;">
            <button id="btnFocusCancel" style="
              display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; font-size: 13.5px; font-weight: 700;
              color: var(--slate); background: #f1f5f9; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; margin-bottom: 0;
            ">취소</button>
            <button id="btnFocusSendConfirm" style="
              display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; font-size: 13.5px; font-weight: 800;
              color: #fff; background: var(--primary); border: none; border-radius: 10px; cursor: pointer;
              box-shadow: 0 4px 12px rgba(37,99,235,.2); font-family: inherit; margin-bottom: 0;
            ">${renderIcon('check', 14, '#fff', 2.5)} 전송하기</button>
          </div>
        </div>
    `;

    // Hook listeners
    const closeOverlay = () => {
      viewState.focusOpen = false;
      renderFocusConfirm();
    };

    block.querySelector('#btnFocusCloseBackdrop').addEventListener('click', closeOverlay);
    block.querySelector('#btnFocusClose').addEventListener('click', closeOverlay);
    block.querySelector('#btnFocusCancel').addEventListener('click', closeOverlay);
    
    block.querySelector('#btnFocusSendConfirm').addEventListener('click', () => {
      processMessageSend(viewState.schedule.on);
    });
  };

  // 9. Template Save Modal Dialog
  const renderTemplateSaveModal = () => {
    const block = container.querySelector('#templateSaveModalOverlay');
    if (!viewState.saveModalOpen) {
      block.style.display = 'none';
      block.style.position = '';
      block.style.inset = '';
      block.style.zIndex = '';
      block.innerHTML = '';
      return;
    }
    block.style.display = 'flex';
    block.style.position = 'fixed';
    block.style.inset = '0';
    block.style.zIndex = '100';
    block.style.alignItems = 'center';
    block.style.justifyContent = 'center';
    block.style.padding = '20px';
    block.style.background = 'rgba(15, 23, 42, 0.42)';
    block.style.animation = 'fadeIn 0.15s ease-out';

    // Escape helper for input values
    const escVal = (str) => (str || "").replace(/"/g, '&quot;');
    const escHtml = (str) => (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    block.innerHTML = `
      <div id="btnSaveModalCloseBackdrop" style="position: absolute; inset: 0;"></div>
      <div style="
        position: relative; background: #fff; border-radius: 16px; width: 100%; max-width: 420px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; overflow: hidden;
      ">
        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #edf2f7;">
          <span style="width: 28px; height: 28px; border-radius: 8px; background: var(--warning-light); display: flex; align-items: center; justify-content: center;">
            ${renderIcon('star', 14, 'var(--warning)')}
          </span>
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-main);">템플릿 신규 저장</h3>
          <button id="btnSaveModalClose" style="
            margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border-color);
            background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
          ">${renderIcon('close', 14, '#64748b')}</button>
        </div>

        <!-- Body -->
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">템플릿 제목</label>
            <input type="text" id="saveModalTitleInp" value="${escVal(viewState.saveModalTitle)}" placeholder="템플릿 제목을 입력해 주세요" style="
              width: 100%; padding: 10px 12px; font-size: 13px; border-radius: 8px; border: 1px solid var(--border-color);
              box-sizing: border-box; outline: none; transition: border-color 0.15s;
            ">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">템플릿 내용</label>
            <textarea id="saveModalBodyInp" placeholder="템플릿 내용을 입력해 주세요" style="
              width: 100%; height: 120px; padding: 10px 12px; font-size: 13px; border-radius: 8px; border: 1px solid var(--border-color);
              box-sizing: border-box; outline: none; transition: border-color 0.15s; resize: none; font-family: inherit;
            ">${escHtml(viewState.saveModalBody)}</textarea>
          </div>
          ${viewState.saveModalError ? `<div style="font-size: 11.5px; color: var(--danger); font-weight: 700;">${viewState.saveModalError}</div>` : ''}
        </div>

        <!-- Footer -->
        <div style="display: flex; gap: 10px; padding: 12px 20px; background: #fff; border-top: 1px solid #edf2f7; justify-content: flex-end;">
          <button id="btnSaveModalCancel" style="
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; font-size: 13.5px; font-weight: 700;
            color: var(--slate); background: #f1f5f9; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; margin-bottom: 0;
          ">취소</button>
          <button id="btnSaveModalSubmit" style="
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; font-size: 13.5px; font-weight: 800;
            color: #fff; background: var(--primary); border: none; border-radius: 10px; cursor: pointer;
            box-shadow: 0 4px 12px rgba(37,99,235,.2); font-family: inherit; margin-bottom: 0;
          ">저장</button>
        </div>
      </div>
    `;

    // Hook listeners
    const closeSaveModal = () => {
      viewState.saveModalOpen = false;
      renderTemplateSaveModal();
    };

    block.querySelector('#btnSaveModalCloseBackdrop').addEventListener('click', closeSaveModal);
    block.querySelector('#btnSaveModalClose').addEventListener('click', closeSaveModal);
    block.querySelector('#btnSaveModalCancel').addEventListener('click', closeSaveModal);

    const titleInp = block.querySelector('#saveModalTitleInp');
    titleInp.addEventListener('input', (e) => {
      viewState.saveModalTitle = e.target.value;
    });

    const bodyInp = block.querySelector('#saveModalBodyInp');
    bodyInp.addEventListener('input', (e) => {
      viewState.saveModalBody = e.target.value;
    });

    block.querySelector('#btnSaveModalSubmit').addEventListener('click', () => {
      if (!viewState.saveModalTitle.trim()) {
        viewState.saveModalError = "제목을 입력해 주세요.";
        renderTemplateSaveModal();
        return;
      }
      if (!viewState.saveModalBody.trim()) {
        viewState.saveModalError = "내용을 입력해 주세요.";
        renderTemplateSaveModal();
        return;
      }

      // Add to template list in state
      const nextId = "t" + (viewState.savedTemplates.length + 1);
      const newTemplate = {
        id: nextId,
        name: viewState.saveModalTitle.trim(),
        title: viewState.saveModalTitle.trim(),
        body: viewState.saveModalBody.trim(),
        kind: viewState.method === "PUSH" ? "PUSH" : viewState.method === "알림톡" ? "알림톡" : msgKind(viewState.saveModalTitle.trim(), viewState.saveModalBody.trim(), !!viewState.image),
        ad: false,
        savedAt: new Date().toISOString().slice(0, 10)
      };
      
      viewState.savedTemplates.unshift(newTemplate);
      
      // Setup dynamic alert behavior
      alert(`템플릿 "${newTemplate.name}"이(가) 보관함에 임시 저장되었습니다.`);
      
      // Auto-toggle tab to Saved
      viewState.vaultActiveTab = "saved";
      viewState.vaultPages["saved"] = 0;
      
      viewState.saveModalOpen = false;
      renderTemplateSaveModal();
      renderMessageVault();
    });
  };

  const renderDirectAddModal = () => {
    const block = container.querySelector('#directAddModalOverlay');
    if (!viewState.directAddModalOpen) {
      block.style.display = 'none';
      block.style.position = '';
      block.style.inset = '';
      block.style.zIndex = '';
      block.innerHTML = '';
      return;
    }

    block.style.display = 'flex';
    block.style.position = 'fixed';
    block.style.inset = '0';
    block.style.zIndex = '105';
    block.style.alignItems = 'center';
    block.style.justifyContent = 'center';
    block.style.padding = '20px';
    block.style.background = 'rgba(15, 23, 42, 0.42)';
    block.style.animation = 'fadeIn 0.15s ease-out';

    block.innerHTML = `
      <div id="btnDirectAddCloseBackdrop" style="position: absolute; inset: 0;"></div>
      <div style="
        position: relative; background: #fff; border-radius: 16px; width: 100%; max-width: 400px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; overflow: hidden;
      ">
        <div style="display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #edf2f7;">
          <span style="width: 28px; height: 28px; border-radius: 8px; background: #fef3dd; display: flex; align-items: center; justify-content: center;">
            ${renderIcon('plus', 14, '#b45309')}
          </span>
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-main);">수신자 직접 입력</h3>
          <button id="btnDirectAddClose" style="
            margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border-color);
            background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
          ">${renderIcon('close', 14, '#64748b')}</button>
        </div>

        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">이름</label>
            <input type="text" id="directAddNameInp" placeholder="이름을 입력해 주세요" style="
              width: 100%; padding: 10px 12px; font-size: 13px; border-radius: 8px; border: 1px solid var(--border-color);
              box-sizing: border-box; outline: none; transition: border-color 0.15s;
            ">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">휴대폰 번호</label>
            <input type="text" id="directAddPhoneInp" placeholder="숫자와 하이픈만 입력 (예: 010-1234-5678)" style="
              width: 100%; padding: 10px 12px; font-size: 13px; border-radius: 8px; border: 1px solid var(--border-color);
              box-sizing: border-box; outline: none; transition: border-color 0.15s;
            ">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">역할 / 구분</label>
            <input type="text" value="직접입력" disabled style="
              width: 100%; padding: 10px 12px; font-size: 13px; border-radius: 8px; border: 1px solid var(--border-color);
              background: #f1f5f9; color: #64748b; box-sizing: border-box; cursor: not-allowed;
            ">
          </div>
          <div id="directAddErrorMsg" style="display: none; font-size: 11.5px; color: var(--danger); font-weight: 700;"></div>
        </div>

        <div style="display: flex; gap: 10px; padding: 12px 20px; background: #fff; border-top: 1px solid #edf2f7; justify-content: flex-end;">
          <button id="btnDirectAddCancel" style="
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; font-size: 13.5px; font-weight: 700;
            color: var(--slate); background: #f1f5f9; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; margin-bottom: 0;
          ">취소</button>
          <button id="btnDirectAddSubmit" style="
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; font-size: 13.5px; font-weight: 800;
            color: #fff; background: var(--primary); border: none; border-radius: 10px; cursor: pointer;
            box-shadow: 0 4px 12px rgba(37,99,235,.2); font-family: inherit; margin-bottom: 0;
          ">추가</button>
        </div>
      </div>
    `;

    const closeDirect = () => {
      viewState.directAddModalOpen = false;
      renderDirectAddModal();
    };

    block.querySelector('#btnDirectAddCloseBackdrop').addEventListener('click', closeDirect);
    block.querySelector('#btnDirectAddClose').addEventListener('click', closeDirect);
    block.querySelector('#btnDirectAddCancel').addEventListener('click', closeDirect);

    const nameInp = block.querySelector('#directAddNameInp');
    const phoneInp = block.querySelector('#directAddPhoneInp');
    const errMsgDiv = block.querySelector('#directAddErrorMsg');

    block.querySelector('#btnDirectAddSubmit').addEventListener('click', () => {
      const name = nameInp.value.trim();
      const phone = phoneInp.value.trim();

      if (!name) {
        errMsgDiv.textContent = "이름을 입력해 주세요.";
        errMsgDiv.style.display = 'block';
        return;
      }
      if (!phone) {
        errMsgDiv.textContent = "휴대폰 번호를 입력해 주세요.";
        errMsgDiv.style.display = 'block';
        return;
      }

      const phoneRegex = /^[0-9-]+$/;
      if (!phoneRegex.test(phone)) {
        errMsgDiv.textContent = "올바른 휴대폰 번호 형식이 아닙니다. (숫자, 하이픈만 허용)";
        errMsgDiv.style.display = 'block';
        return;
      }

      const alreadyExists = viewState.recipients.some(r => r.phone === phone);
      if (viewState.dedupe && alreadyExists) {
        viewState.directAddModalOpen = false;
        renderDirectAddModal();
        return;
      }

      viewState.recipients.push({
        name,
        phone,
        role: "직접입력",
        source: "manual",
        key: phone + "|manual"
      });

      viewState.directAddModalOpen = false;
      renderDirectAddModal();

      renderRecipientList();
      renderComposePanel();
      renderSendBar();
    });
  };

  const renderExcelImportModal = () => {
    const block = container.querySelector('#excelImportModalOverlay');
    if (!viewState.excelImportModalOpen) {
      block.style.display = 'none';
      block.style.position = '';
      block.style.inset = '';
      block.style.zIndex = '';
      block.innerHTML = '';
      return;
    }

    block.style.display = 'flex';
    block.style.position = 'fixed';
    block.style.inset = '0';
    block.style.zIndex = '105';
    block.style.alignItems = 'center';
    block.style.justifyContent = 'center';
    block.style.padding = '20px';
    block.style.background = 'rgba(15, 23, 42, 0.42)';
    block.style.animation = 'fadeIn 0.15s ease-out';

    block.innerHTML = `
      <div id="btnExcelImportCloseBackdrop" style="position: absolute; inset: 0;"></div>
      <div style="
        position: relative; background: #fff; border-radius: 16px; width: 100%; max-width: 440px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; overflow: hidden;
      ">
        <div style="display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #edf2f7;">
          <span style="width: 28px; height: 28px; border-radius: 8px; background: #e2f4f1; display: flex; align-items: center; justify-content: center;">
            ${renderIcon('grid', 14, '#0f766e')}
          </span>
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-main);">엑셀/CSV 붙여넣기 추가</h3>
          <button id="btnExcelImportClose" style="
            margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border-color);
            background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
          ">${renderIcon('close', 14, '#64748b')}</button>
        </div>

        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div style="background: #f8fafc; border: 1px dashed var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.5; color: var(--text-muted);">
            <div style="font-weight: 800; color: var(--text-main); margin-bottom: 4px;">형식 안내 (쉼표로 구분)</div>
            <code style="display: block; background: #edf2f7; padding: 6px 8px; border-radius: 4px; font-family: monospace; font-size: 11px;">
              이름,휴대폰번호<br>
              김지원,010-1111-2222<br>
              박서준,010-3333-4444
            </code>
          </div>
          
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">붙여넣기 영역</label>
            <textarea id="excelImportTextarea" placeholder="여기에 복사한 행들을 붙여넣으세요" style="
              width: 100%; height: 160px; padding: 10px 12px; font-size: 13px; border-radius: 8px; border: 1px solid var(--border-color);
              box-sizing: border-box; outline: none; transition: border-color 0.15s; resize: none; font-family: inherit;
            "></textarea>
          </div>
          
          <div id="excelImportErrorMsg" style="display: none; font-size: 11.5px; color: var(--danger); font-weight: 700;"></div>
        </div>

        <div style="display: flex; gap: 10px; padding: 12px 20px; background: #fff; border-top: 1px solid #edf2f7; justify-content: flex-end;">
          <button id="btnExcelImportCancel" style="
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; font-size: 13.5px; font-weight: 700;
            color: var(--slate); background: #f1f5f9; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; margin-bottom: 0;
          ">취소</button>
          <button id="btnExcelImportSubmit" style="
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; font-size: 13.5px; font-weight: 800;
            color: #fff; background: var(--primary); border: none; border-radius: 10px; cursor: pointer;
            box-shadow: 0 4px 12px rgba(37,99,235,.2); font-family: inherit; margin-bottom: 0;
          ">저장</button>
        </div>
      </div>
    `;

    const closeExcel = () => {
      viewState.excelImportModalOpen = false;
      renderExcelImportModal();
    };

    block.querySelector('#btnExcelImportCloseBackdrop').addEventListener('click', closeExcel);
    block.querySelector('#btnExcelImportClose').addEventListener('click', closeExcel);
    block.querySelector('#btnExcelImportCancel').addEventListener('click', closeExcel);

    const textarea = block.querySelector('#excelImportTextarea');
    const errMsgDiv = block.querySelector('#excelImportErrorMsg');

    block.querySelector('#btnExcelImportSubmit').addEventListener('click', () => {
      const text = textarea.value;
      if (!text.trim()) {
        errMsgDiv.textContent = "가져올 텍스트를 입력해 주세요.";
        errMsgDiv.style.display = 'block';
        return;
      }

      const lines = text.split('\n');
      const next = [...viewState.recipients];
      const exist = new Set(viewState.recipients.map(r => r.phone));
      let parseErrorCount = 0;

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (trimmed.startsWith('이름,') || trimmed.startsWith('이름 ,')) return;

        const parts = trimmed.split(',');
        if (parts.length < 2) {
          parseErrorCount++;
          return;
        }

        const name = parts[0].trim();
        const phone = parts[1].trim();

        const phoneRegex = /^[0-9-]+$/;
        if (!name || !phone || !phoneRegex.test(phone)) {
          parseErrorCount++;
          return;
        }

        if (viewState.dedupe && exist.has(phone)) {
          return;
        }

        exist.add(phone);
        next.push({
          name,
          phone,
          role: "엑셀",
          source: "excel",
          key: phone + "|excel"
        });
      });

      if (parseErrorCount > 0) {
        alert(`가져오기 완료! (건너뛴 줄: ${parseErrorCount}개)`);
        viewState.recipients = next;
        viewState.excelImportModalOpen = false;
        renderExcelImportModal();
        renderRecipientList();
        renderComposePanel();
        renderSendBar();
      } else {
        viewState.recipients = next;
        viewState.excelImportModalOpen = false;
        renderExcelImportModal();
        renderRecipientList();
        renderComposePanel();
        renderSendBar();
      }
    });
  };

  const renderRecipientDetailModal = () => {
    const block = container.querySelector('#recipientDetailModalOverlay');
    if (!viewState.recipientDetailModalOpen || !viewState.recipientDetailLogId) {
      block.style.display = 'none';
      block.style.position = '';
      block.style.inset = '';
      block.style.zIndex = '';
      block.innerHTML = '';
      return;
    }
    const log = stateStore.getOutboundMessageLogs().find(l => l.id === viewState.recipientDetailLogId);
    if (!log) {
      viewState.recipientDetailModalOpen = false;
      block.style.display = 'none';
      return;
    }

    block.style.display = 'flex';
    block.style.position = 'fixed';
    block.style.inset = '0';
    block.style.zIndex = '110';
    block.style.alignItems = 'center';
    block.style.justifyContent = 'center';
    block.style.padding = '20px';
    block.style.background = 'rgba(15, 23, 42, 0.42)';
    block.style.animation = 'fadeIn 0.15s ease-out';

    block.innerHTML = `
      <div id="btnRecipientDetailCloseBackdrop" style="position: absolute; inset: 0;"></div>
      <div style="
        position: relative; background: #fff; border-radius: 16px; width: 100%; max-width: 460px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
        animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; max-height: 80vh; overflow: hidden;
      ">
        <div style="display: flex; align-items: center; gap: 10px; padding: 14px 20px; background: #fff; border-bottom: 1px solid #edf2f7;">
          <span style="width: 28px; height: 28px; border-radius: 8px; background: var(--primary-light); display: flex; align-items: center; justify-content: center;">
            ${renderIcon('user', 14, 'var(--primary)')}
          </span>
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-main);">전체 수신자 목록 (${log.recipientCount}명)</h3>
          <button id="btnRecipientDetailClose" style="
            margin-left: auto; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border-color);
            background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;
          ">${renderIcon('close', 14, '#64748b')}</button>
        </div>

        <div style="padding: 20px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1;">
          ${log.recipients.map(r => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 800; color: var(--text-main);">${r.name}</span>
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; background: #e2e8f0; padding: 1px 6px; border-radius: 4px;">${r.role || '보호자'}</span>
              </div>
              <div style="font-weight: 700; color: var(--text-main); font-family: monospace;">${r.phone}</div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 10px; padding: 12px 20px; background: #fff; border-top: 1px solid #edf2f7; justify-content: flex-end;">
          <button id="btnRecipientDetailCloseBtn" style="
            display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; font-size: 13.5px; font-weight: 800;
            color: #fff; background: var(--primary); border: none; border-radius: 10px; cursor: pointer; font-family: inherit; margin-bottom: 0;
          ">닫기</button>
        </div>
      </div>
    `;

    const closeDetail = () => {
      viewState.recipientDetailModalOpen = false;
      renderRecipientDetailModal();
    };

    block.querySelector('#btnRecipientDetailCloseBackdrop').addEventListener('click', closeDetail);
    block.querySelector('#btnRecipientDetailClose').addEventListener('click', closeDetail);
    block.querySelector('#btnRecipientDetailCloseBtn').addEventListener('click', closeDetail);
  };

  // Run initial render
  render();

  // Return clean-up handler
  return () => {
    if (syncTimeContainer && syncTimeContainer.parentNode) {
      syncTimeContainer.remove();
    }
  };
}
