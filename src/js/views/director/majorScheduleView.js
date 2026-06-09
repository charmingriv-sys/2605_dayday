// majorScheduleView.js - Major Schedule Management View
import { stateStore } from '../../state.js';

const eventTypes = {
  all: { label: "전체", tone: "slate" },
  concours: { label: "콩쿠르", tone: "blue" },
  exam: { label: "시험/평가", tone: "red" },
  recital: { label: "발표/행사", tone: "violet" },
  makeup: { label: "보강/휴강", tone: "amber" },
  counsel: { label: "상담/관리", tone: "green" }
};

const events = [
  { id: "ev1", type: "concours", name: "한국청소년 피아노 콩쿠르", date: "2026-06-14", due: "2026-06-07", owner: "정은비", place: "예술의전당", status: "확인필요", visible: false, memo: "접수 마감 전 보호자 확인 필요" },
  { id: "ev2", type: "exam", name: "예원학교 입시 실기고사", date: "2026-07-05", due: "2026-06-09", owner: "한지섭", place: "예원학교 음악관", status: "확인필요", visible: false, memo: "입시 상담 예약과 원서 접수 확인" },
  { id: "ev3", type: "concours", name: "영 첼리스트 콩쿠르", date: "2026-06-21", due: "2026-06-11", owner: "성여진", place: "금호아트홀", status: "진행중", visible: false, memo: "결석 학생 보강 배정 필요" },
  { id: "ev4", type: "recital", name: "여름 정기 음악회", date: "2026-06-27", due: null, owner: "윤채린", place: "튜링 그랜드홀", status: "진행중", visible: false, memo: "전체 리허설 6월 25일" },
  { id: "ev5", type: "makeup", name: "6월 결석자 보강 편성", date: "2026-06-12", due: null, owner: "운영실", place: "원내", status: "확인필요", visible: false, memo: "최근 결석 원생 보강 시간 확정" },
  { id: "ev6", type: "counsel", name: "입시반 학부모 상담 주간", date: "2026-06-18", due: null, owner: "원장", place: "상담실", status: "진행중", visible: false, memo: "입시반 학부모 상담 후보 자동 큐" }
];

const students = [
  { id: 1, name: "이서윤", grade: "초6", instrument: "피아노", teacher: "정은비", eventIds: ["ev1", "ev4"], lesson: "16:00 A-3", lessonSource: "정규 수업 배정", memo: "콩쿠르 자유곡 템포 점검", notes: ["06.04 콩쿠르 접수 보호자 확인 필요", "06.01 템포 흔들림, 다음 레슨에서 재점검"] },
  { id: 2, name: "박도현", grade: "중2", instrument: "첼로", teacher: "성여진", eventIds: ["ev3", "ev5"], lesson: "18:00 C-1", lessonSource: "정규 수업 배정", memo: "지난주 결석 1회, 보강 미정", notes: ["06.04 결석 보강 후보", "05.30 암보 불안정, 보호자 안내 완료"] },
  { id: 3, name: "김하린", grade: "중3", instrument: "피아노", teacher: "한지섭", eventIds: ["ev2", "ev6"], lesson: "토 11:00 A-1", lessonSource: "주말 정규 수업", memo: "입시 원서 마감 임박", notes: ["06.04 입시 상담 일정 조율 필요", "06.02 원서 제출 서류 안내"] },
  { id: 4, name: "정시우", grade: "초5", instrument: "바이올린", teacher: "윤채린", eventIds: ["ev4"], lesson: "금 17:30 B-2", lessonSource: "정규 수업 배정", memo: "무대 리허설 일정만 확인", notes: ["06.03 리허설 안내 문자 발송"] },
  { id: 5, name: "최예준", grade: "중1", instrument: "피아노", teacher: "정은비", eventIds: ["ev1"], lesson: "17:00 A-2", lessonSource: "정규 수업 배정", memo: "D-10 완성도 낮음", notes: ["06.04 추가 레슨 편성 검토", "06.01 곡 완성도 낮음, 원장 확인"] },
  { id: 6, name: "윤서아", grade: "초6", instrument: "바이올린", teacher: "성여진", eventIds: ["ev5"], lesson: "16:30 B-1", lessonSource: "정규 수업 배정", memo: "결석 2회 누적", notes: ["06.04 보강 가능 시간 확인 필요", "05.29 결석 사유 입력"] },
  { id: 7, name: "백서진", grade: "고2", instrument: "피아노", teacher: "한지섭", eventIds: ["ev2", "ev6"], lesson: "금 19:30 A-1", lessonSource: "입시반 정규 수업", memo: "예고 입시 상담 필요", notes: ["06.04 학부모 상담 후보", "06.02 입시곡 진도 양호"] }
];

const today = new Date(2026, 5, 4);

function dday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

function fmt(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${m}.${d}(${dow})`;
}

function eventParts(eventId) {
  return students.filter((student) => student.eventIds.includes(eventId));
}

function hasStudentMemo(student) {
  return student.notes && student.notes.length > 0;
}

function typeChip(type) {
  const meta = eventTypes[type];
  return `<span class="type-chip tone-${meta.tone}">${meta.label}</span>`;
}

function statusChip(status) {
  const tone = status === "완료" ? "green" : status === "진행중" ? "blue" : "red";
  return `<span class="status-chip tone-${tone}">${status}</span>`;
}

function visibilityChip(visible) {
  return `<span class="status-chip ${visible ? "tone-green" : "tone-slate"}">${visible ? "학부모 공개" : "비공개"}</span>`;
}

function memoStateChip(student) {
  return `<span class="mini-chip ${hasStudentMemo(student) ? "tone-blue" : "tone-green"}">${hasStudentMemo(student) ? "메모 있음" : "메모 없음"}</span>`;
}

function eventMemoItems(event) {
  return event.notes && event.notes.length ? event.notes : [event.memo];
}

function lessonTime(student) {
  const token = student.lesson.split(" ").find((part) => /\d{1,2}:\d{2}/.test(part));
  return token || "-";
}

function lessonDateTime(student, offset = 0) {
  const base = new Date(today);
  base.setDate(today.getDate() + offset);
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const date = String(base.getDate()).padStart(2, "0");
  return `${month}/${date} ${lessonTime(student)}`;
}

function upcomingLessons(student) {
  return [
    { label: "다음", at: lessonDateTime(student, 0), type: "정규" },
    { label: "2회차", at: lessonDateTime(student, 3), type: "정규" },
    { label: "3회차", at: lessonDateTime(student, 7), type: "정규" },
    { label: "4회차", at: lessonDateTime(student, 10), type: "정규" }
  ];
}

export function renderMajorSchedule(container) {
  let activeType = "all";
  let tableView = "event";
  let selectedStatus = "전체";
  let selectedOwner = "전체";
  let searchQuery = "";

  const render = () => {
    const monthEvents = events.filter((event) => dday(event.date) >= 0).length;
    const deadline = events.filter((event) => event.due && dday(event.due) >= 0 && dday(event.due) <= 7).length;
    const todayLessons = students.filter((student) => /^\d/.test(student.lesson)).length;

    const owners = [...new Set(events.map((event) => event.owner))];

    container.innerHTML = `
      <style>
        .major-schedule-root {
          --bg: #f3f6fb;
          --panel: #ffffff;
          --ink: #0f172a;
          --muted: #64748b;
          --muted-2: #94a3b8;
          --line: #e2e8f0;
          --line-2: #edf2f7;
          --blue: #2563eb;
          --blue-soft: #eff6ff;
          --green: #16a34a;
          --green-soft: #ecfdf3;
          --amber: #d97706;
          --amber-soft: #fff7ed;
          --red: #dc2626;
          --red-soft: #fef2f2;
          --violet: #7c3aed;
          --violet-soft: #f5f3ff;
          --shadow: 0 10px 30px rgba(15, 23, 42, .08);
          --shadow-sm: 0 4px 16px rgba(15, 23, 42, .06);
          --radius: 8px;
        }

        .major-schedule-root * { box-sizing: border-box; }

        .major-schedule-root button,
        .major-schedule-root select,
        .major-schedule-root input {
          font: inherit;
        }

        .major-schedule-root button {
          min-height: 32px;
          border: 1px solid var(--line);
          border-radius: 7px;
          padding: 0 11px;
          background: #fff;
          color: #334155;
          font-weight: 800;
          cursor: pointer;
        }

        .major-schedule-root button:hover { background: #f8fafc; }
        .major-schedule-root button.primary {
          border-color: var(--blue);
          background: var(--blue);
          color: #fff;
        }

        .major-schedule-root header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 14px;
        }

        .major-schedule-root h1 {
          margin: 0;
          font-size: 24px;
          line-height: 1.18;
          font-weight: 950;
        }

        .major-schedule-root .sub {
          margin-top: 6px;
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
        }

        .major-schedule-root .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .major-schedule-root .sync {
          min-height: 32px;
          display: flex;
          align-items: center;
          padding: 0 11px;
          border: 1px solid var(--line);
          border-radius: 7px;
          background: #fff;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
        }

        .major-schedule-root .page-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .major-schedule-root .kpi-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
        }

        .major-schedule-root .kpi-card {
          min-height: 62px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
          box-shadow: var(--shadow-sm);
        }

        .major-schedule-root .kpi-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .major-schedule-root .kpi-label {
          color: var(--muted);
          font-size: 11px;
          font-weight: 850;
        }

        .major-schedule-root .kpi-value {
          margin-top: 3px;
          font-size: 19px;
          font-weight: 950;
        }

        .major-schedule-root .kpi-desc {
          margin-top: 1px;
          color: var(--muted-2);
          font-size: 10.5px;
          font-weight: 750;
        }

        .major-schedule-root .icon-box {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 950;
        }

        .major-schedule-root .icon-box.blue { background: var(--blue-soft); color: var(--blue); }
        .major-schedule-root .icon-box.red { background: var(--red-soft); color: var(--red); }
        .major-schedule-root .icon-box.amber { background: var(--amber-soft); color: var(--amber); }
        .major-schedule-root .icon-box.green { background: var(--green-soft); color: var(--green); }
        .major-schedule-root .icon-box.violet { background: var(--violet-soft); color: var(--violet); }

        .major-schedule-root .event-strip {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: 210px;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 2px;
          scroll-snap-type: x proximity;
        }

        .major-schedule-root .event-card {
          min-width: 0;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          cursor: pointer;
          scroll-snap-align: start;
        }

        .major-schedule-root .event-card:hover {
          border-color: #bfdbfe;
          box-shadow: var(--shadow);
        }

        .major-schedule-root .event-bar {
          height: 4px;
          background: var(--blue);
        }

        .major-schedule-root .event-body {
          padding: 11px;
        }

        .major-schedule-root .event-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .major-schedule-root .type-chip,
        .major-schedule-root .status-chip,
        .major-schedule-root .mini-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 3px 8px;
          font-size: 11px;
          line-height: 1.2;
          font-weight: 900;
          white-space: nowrap;
        }

        .major-schedule-root .event-card .type-chip {
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 850;
        }

        .major-schedule-root .tone-blue { background: var(--blue-soft); color: var(--blue); border-color: #bfdbfe; }
        .major-schedule-root .tone-red { background: var(--red-soft); color: var(--red); border-color: #fecaca; }
        .major-schedule-root .tone-amber { background: var(--amber-soft); color: var(--amber); border-color: #fed7aa; }
        .major-schedule-root .tone-green { background: var(--green-soft); color: var(--green); border-color: #bbf7d0; }
        .major-schedule-root .tone-violet { background: var(--violet-soft); color: var(--violet); border-color: #ddd6fe; }
        .major-schedule-root .tone-slate { background: #f8fafc; color: #475569; border-color: var(--line); }

        .major-schedule-root .dday {
          color: var(--red);
          font-size: 15px;
          font-weight: 950;
          line-height: 1.15;
        }

        .major-schedule-root .event-title {
          min-height: 36px;
          font-size: 13.5px;
          line-height: 1.28;
          font-weight: 950;
        }

        .major-schedule-root .event-meta {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 750;
        }

        .major-schedule-root .event-due-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 28px;
          margin-top: 9px;
          padding: 0 9px;
          border: 1px solid var(--line);
          border-radius: 7px;
          background: #f8fafc;
          color: #475569;
          font-size: 11.5px;
          font-weight: 900;
        }

        .major-schedule-root .event-due-box.urgent {
          border-color: #fecaca;
          background: var(--red-soft);
          color: var(--red);
        }

        .major-schedule-root .event-due-box .due-dday {
          margin-left: auto;
          font-size: 11px;
          font-weight: 950;
          color: inherit;
        }

        .major-schedule-root .mini-avatars {
          display: flex;
          align-items: center;
          margin-top: 11px;
        }

        .major-schedule-root .avatar-sm {
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          margin-right: -6px;
          border: 2px solid #fff;
          border-radius: 999px;
          background: var(--blue-soft);
          color: var(--blue);
          font-size: 11px;
          font-weight: 950;
        }

        .major-schedule-root .filters-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          padding: 11px 12px;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
          box-shadow: var(--shadow-sm);
        }

        .major-schedule-root .filter-left,
        .major-schedule-root .search-box {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .major-schedule-root .segmented {
          display: inline-flex;
          gap: 3px;
          padding: 3px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #f8fafc;
        }

        .major-schedule-root .segmented button {
          min-height: 28px;
          border: 0;
          padding: 0 10px;
          background: transparent;
          font-size: 12px;
          margin-bottom: 0;
        }

        .major-schedule-root .segmented button.active {
          background: #fff;
          color: var(--blue);
          box-shadow: 0 1px 4px rgba(15, 23, 42, .08);
        }

        .major-schedule-root select,
        .major-schedule-root input {
          min-height: 34px;
          border: 1px solid var(--line);
          border-radius: 7px;
          padding: 0 10px;
          background: #fff;
          color: #334155;
          font-size: 13px;
          font-weight: 750;
          outline: none;
        }

        .major-schedule-root input::placeholder { color: #94a3b8; }

        .major-schedule-root .content-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: start;
        }

        .major-schedule-root .card {
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
          box-shadow: var(--shadow-sm);
        }

        .major-schedule-root .card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 13px 14px;
          border-bottom: 1px solid var(--line-2);
        }

        .major-schedule-root .card-head h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 950;
        }

        .major-schedule-root .card-head p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .major-schedule-root .table-wrap {
          overflow: auto;
        }

        .major-schedule-root .table-view-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--line-2);
          background: #fbfdff;
        }

        .major-schedule-root .view-tabs {
          display: inline-flex;
          gap: 5px;
          padding: 4px;
          border: 1px solid #dbeafe;
          border-radius: 8px;
          background: var(--blue-soft);
        }

        .major-schedule-root .view-tabs button {
          min-height: 30px;
          border: 0;
          padding: 0 13px;
          background: transparent;
          color: #475569;
          font-size: 12.5px;
          font-weight: 950;
          margin-bottom: 0;
        }

        .major-schedule-root .view-tabs button.active {
          background: var(--blue);
          color: #fff;
          box-shadow: 0 2px 8px rgba(37, 99, 235, .18);
        }

        .major-schedule-root .view-help {
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
        }

        .major-schedule-root table {
          width: 100%;
          border-collapse: collapse;
          min-width: 860px;
        }

        .major-schedule-root th {
          padding: 10px 12px;
          border-bottom: 1px solid var(--line);
          background: #f8fafc;
          color: var(--muted);
          text-align: left;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .major-schedule-root td {
          padding: 11px 12px;
          border-bottom: 1px solid var(--line-2);
          color: #334155;
          font-size: 13px;
          font-weight: 700;
          vertical-align: middle;
        }

        .major-schedule-root tbody tr {
          cursor: pointer;
        }

        .major-schedule-root tbody tr:hover {
          background: #f8fafc;
        }

        .major-schedule-root .event-name {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .major-schedule-root .event-name strong {
          color: var(--ink);
          font-size: 13.5px;
          font-weight: 950;
        }

        .major-schedule-root .event-name span {
          color: var(--muted-2);
          font-size: 11px;
          font-weight: 750;
        }

        .major-schedule-root .drawer-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 9998;
          background: rgba(15, 23, 42, .24);
        }

        .major-schedule-root .drawer {
          position: fixed;
          top: 0;
          right: 0;
          z-index: 9999;
          width: 520px;
          max-width: calc(100vw - 24px);
          height: 100vh;
          display: flex;
          flex-direction: column;
          transform: translateX(105%);
          transition: transform .18s ease;
          background: #fff;
          box-shadow: -18px 0 40px rgba(15, 23, 42, .16);
        }

        .major-schedule-root .drawer.open {
          transform: translateX(0);
        }

        .major-schedule-root .drawer-backdrop.open {
          display: block;
        }

        .major-schedule-root .drawer-head {
          padding: 16px 18px;
          border-bottom: 1px solid var(--line);
          position: relative;
        }

        .major-schedule-root .drawer-student-card {
          width: calc(100% - 42px);
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .major-schedule-root .drawer-student-card .avatar {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: var(--blue-soft);
          color: var(--blue);
          font-size: 15px;
          display: grid;
          place-items: center;
          font-weight: bold;
        }

        .major-schedule-root .drawer-student-main {
          min-width: 0;
        }

        .major-schedule-root .drawer-student-main strong {
          display: block;
          color: var(--ink);
          font-size: 18px;
          font-weight: 950;
        }

        .major-schedule-root .drawer-student-main span {
          display: block;
          margin-top: 4px;
          overflow: hidden;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .major-schedule-root .drawer-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 32px;
          padding: 0;
          font-size: 18px;
          min-height: 32px;
          display: grid;
          place-items: center;
          z-index: 10;
        }

        .major-schedule-root .drawer-title {
          width: calc(100% - 42px);
          margin: 9px 0 0;
          font-size: 20px;
          line-height: 1.25;
          font-weight: 950;
        }

        .major-schedule-root .drawer-meta {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .major-schedule-root .drawer-body {
          flex: 1;
          overflow: auto;
          padding: 14px 18px 18px;
          background: #f8fafc;
        }

        .major-schedule-root .drawer-footer {
          display: none;
          gap: 8px;
          padding: 12px 18px;
          border-top: 1px solid var(--line);
          background: #fff;
        }

        .major-schedule-root .drawer-footer.open {
          display: flex;
        }

        .major-schedule-root .drawer-footer button {
          flex: 1;
          margin-bottom: 0;
        }

        .major-schedule-root .drawer-footer button.primary-action {
          border-color: var(--blue);
          background: var(--blue);
          color: #fff;
        }

        .major-schedule-root .drawer-section {
          margin-bottom: 12px;
          border: 1px solid var(--line);
          border-radius: var(--radius);
          background: #fff;
        }

        .major-schedule-root .drawer-section h3 {
          margin: 0;
          padding: 12px 13px;
          border-bottom: 1px solid var(--line-2);
          font-size: 14px;
          font-weight: 950;
        }

        .major-schedule-root .section-body {
          padding: 12px 13px;
        }

        .major-schedule-root .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .major-schedule-root .detail-item {
          padding: 10px;
          border: 1px solid var(--line-2);
          border-radius: 7px;
          background: #fff;
        }

        .major-schedule-root .detail-item span {
          display: block;
          color: var(--muted);
          font-size: 11px;
          font-weight: 850;
        }

        .major-schedule-root .detail-item strong {
          display: block;
          margin-top: 4px;
          font-size: 13px;
          font-weight: 950;
        }

        .major-schedule-root .student-mini {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          padding: 9px 0;
          border-bottom: 1px solid var(--line-2);
          cursor: pointer;
        }

        .major-schedule-root .student-mini:last-child { border-bottom: 0; }

        .major-schedule-root .mini-avatar {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: var(--violet-soft);
          color: var(--violet);
          font-weight: 950;
          font-size: 12px;
        }

        .major-schedule-root .queue-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .major-schedule-root .queue-main strong {
          font-size: 13.5px;
          font-weight: 950;
        }

        .major-schedule-root .queue-main span {
          overflow: hidden;
          color: var(--muted);
          font-size: 11.5px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .major-schedule-root .note {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
          font-weight: 750;
          margin-top: 8px;
        }

        .major-schedule-root .memo-section {
          border-color: #bfdbfe;
          background: #eff6ff;
        }

        .major-schedule-root .memo-section h3 {
          border-bottom-color: #dbeafe;
          color: #1d4ed8;
        }

        .major-schedule-root .memo-item {
          position: relative;
          border-bottom: 1px solid #dbeafe;
        }

        .major-schedule-root .memo-actions {
          display: none;
          justify-content: flex-end;
          gap: 6px;
          padding: 0 0 9px 42px;
        }

        .major-schedule-root .memo-item.open .memo-actions {
          display: flex;
        }

        .major-schedule-root .memo-actions button {
          min-height: 26px;
          padding: 0 9px;
          font-size: 11px;
          margin-bottom: 0;
        }

        .major-schedule-root .drawer-lesson-list {
          margin-top: 10px;
          border-top: 1px solid var(--line-2);
        }

        .major-schedule-root .drawer-lesson-row {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          padding: 9px 0;
          border-bottom: 1px solid var(--line-2);
          font-size: 12px;
          font-weight: 850;
        }

        .major-schedule-root .drawer-lesson-row:last-child { border-bottom: 0; }

        .major-schedule-root .drawer-lesson-row strong {
          color: var(--blue);
          font-size: 12px;
          font-weight: 950;
        }

        .major-schedule-root .drawer-lesson-row span {
          overflow: hidden;
          color: var(--ink);
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      </style>

      <div class="major-schedule-root">
        <header>
          <div>
            <h1>주요일정 관리</h1>
            <div class="sub">다가오는 일정과 그 일정 때문에 챙겨야 할 원생을 한 화면에서 확인합니다.</div>
          </div>
          <div class="header-actions">
            <div class="sync" id="lastSync">마지막 동기화 16:40</div>
            <button class="primary" id="btn-refresh-page">새로고침</button>
          </div>
        </header>

        <div class="page-stack">
          <section class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-top"><span class="kpi-label">이번 달 주요 일정</span><span class="icon-box blue">일</span></div>
              <div class="kpi-value" id="kpiEvents">${monthEvents}</div>
              <div class="kpi-desc">오늘 이후 진행 예정</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-top"><span class="kpi-label">접수 마감 임박</span><span class="icon-box red">마</span></div>
              <div class="kpi-value" id="kpiDeadline">${deadline}</div>
              <div class="kpi-desc">D-7 이내 확인 필요</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-top"><span class="kpi-label">오늘 레슨 대상</span><span class="icon-box green">레</span></div>
              <div class="kpi-value" id="kpiLessons">${todayLessons}</div>
              <div class="kpi-desc">다가오는 수업 기준</div>
            </div>
          </section>

          <section class="event-strip" id="eventStrip"></section>

          <section class="filters-card">
            <div class="filter-left">
              <div class="segmented" id="typeTabs"></div>
              <select id="statusFilter">
                <option value="전체" ${selectedStatus === "전체" ? "selected" : ""}>전체 상태</option>
                <option value="확인필요" ${selectedStatus === "확인필요" ? "selected" : ""}>확인필요</option>
                <option value="진행중" ${selectedStatus === "진행중" ? "selected" : ""}>진행중</option>
                <option value="완료" ${selectedStatus === "완료" ? "selected" : ""}>완료</option>
              </select>
              <select id="ownerFilter">
                <option value="전체">전체 담당자</option>
                ${owners.map(o => `<option value="${o}" ${selectedOwner === o ? "selected" : ""}>${o}</option>`).join('')}
              </select>
            </div>
            <div class="search-box">
              <input id="searchInput" placeholder="일정명, 학생명 검색" value="${searchQuery}" />
            </div>
          </section>

          <section class="content-grid">
            <div class="card">
              <div class="card-head">
                <div>
                  <h2>주요 일정 목록</h2>
                  <p>임박 일정과 미처리 학생 수를 기준으로 먼저 확인합니다.</p>
                </div>
                <div class="header-actions">
                  <button id="btn-add-schedule-trigger">일정 추가</button>
                </div>
              </div>
              <div class="table-view-bar">
                <div class="view-tabs">
                  <button id="eventViewBtn" class="${tableView === "event" ? "active" : ""}">주요일정보기</button>
                  <button id="participantViewBtn" class="${tableView === "participant" ? "active" : ""}">일정참여학생보기</button>
                </div>
                <div class="view-help" id="tableViewHelp">일정 단위로 마감/공개/참여 원생을 봅니다.</div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead id="eventHead"></thead>
                  <tbody id="eventBody"></tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <div class="drawer-backdrop" id="drawerBackdrop"></div>
        <aside class="drawer" id="drawer">
          <button class="drawer-close" id="btn-drawer-close">×</button>
          <div class="drawer-head" id="drawerHead"></div>
          <div class="drawer-body" id="drawerBody"></div>
          <div class="drawer-footer" id="drawerFooter"></div>
        </aside>
      </div>
    `;

    bindEvents();
    renderEventStrip();
    renderTableContent();
  };

  const bindEvents = () => {
    // Refresh Page
    const refreshBtn = container.querySelector('#btn-refresh-page');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const syncEl = container.querySelector('#lastSync');
        if (syncEl) syncEl.textContent = `마지막 동기화 ${hh}:${mm}`;
        render();
      });
    }

    // Type Tabs (Segmented Control)
    const tabsContainer = container.querySelector('#typeTabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = Object.entries(eventTypes).map(([key, meta]) => `
        <button class="segmented-tab-btn ${key === activeType ? "active" : ""}" data-type="${key}">${meta.label}</button>
      `).join("");

      tabsContainer.querySelectorAll('.segmented-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeType = btn.dataset.type;
          render();
        });
      });
    }

    // Status filter
    const statusSelect = container.querySelector('#statusFilter');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        selectedStatus = e.target.value;
        render();
      });
    }

    // Owner filter
    const ownerSelect = container.querySelector('#ownerFilter');
    if (ownerSelect) {
      ownerSelect.addEventListener('change', (e) => {
        selectedOwner = e.target.value;
        render();
      });
    }

    // Search input
    const searchInput = container.querySelector('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderTableContent();
        renderEventStrip();
      });
    }

    // Table view mode buttons
    const eventViewBtn = container.querySelector('#eventViewBtn');
    const participantViewBtn = container.querySelector('#participantViewBtn');

    if (eventViewBtn) {
      eventViewBtn.addEventListener('click', () => {
        tableView = "event";
        render();
      });
    }

    if (participantViewBtn) {
      participantViewBtn.addEventListener('click', () => {
        tableView = "participant";
        render();
      });
    }

    // Add schedule trigger
    const addTrigger = container.querySelector('#btn-add-schedule-trigger');
    if (addTrigger) {
      addTrigger.addEventListener('click', openCreateStub);
    }

    // Drawer close events
    const drawerCloseBtn = container.querySelector('#btn-drawer-close');
    if (drawerCloseBtn) {
      drawerCloseBtn.addEventListener('click', closeDrawer);
    }

    const backdrop = container.querySelector('#drawerBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeDrawer);
    }
  };

  const getFilteredEventsList = () => {
    return events.filter((event) => {
      const parts = eventParts(event.id);
      if (activeType !== "all" && event.type !== activeType) return false;
      if (selectedStatus !== "전체" && event.status !== selectedStatus) return false;
      if (selectedOwner !== "전체" && event.owner !== selectedOwner) return false;
      if (searchQuery) {
        const haystack = [event.name, event.owner, event.memo, ...parts.map((student) => student.name)].join(" ");
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    }).sort((a, b) => dday(a.date) - dday(b.date));
  };

  const renderEventStrip = () => {
    const list = getFilteredEventsList();
    const strip = container.querySelector('#eventStrip');
    if (!strip) return;

    strip.innerHTML = list.map((event) => {
      const parts = eventParts(event.id);
      const urgent = event.due && dday(event.due) <= 5;
      const meta = eventTypes[event.type];
      return `
        <article class="event-card" data-id="${event.id}">
          <div class="event-bar" style="background:var(--${meta.tone === "slate" ? "blue" : meta.tone})"></div>
          <div class="event-body">
            <div class="event-head">
              ${typeChip(event.type)}
              <div class="dday">일정 D-${dday(event.date)}</div>
            </div>
            <div class="event-title">${event.name}</div>
            <div class="event-meta">
              <span>${fmt(event.date)} · ${event.place}</span>
            </div>
            <div class="event-due-box ${urgent ? "urgent" : ""}">
              <span>${event.due ? `접수마감 ${fmt(event.due)}` : "접수마감 없음"}</span>
              <span class="due-dday">${event.due ? `D-${dday(event.due)}` : "-"}</span>
            </div>
            <div class="mini-avatars">
              ${parts.slice(0, 4).map((student) => `<span class="avatar-sm">${student.name.slice(-2)}</span>`).join("")}
              <span style="margin-left:10px;color:var(--muted);font-size:12px;font-weight:850">참여인원 ${parts.length}명</span>
            </div>
          </div>
        </article>
      `;
    }).join("");

    strip.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => {
        openEvent(card.dataset.id);
      });
    });
  };

  const renderTableContent = () => {
    const eventHead = container.querySelector('#eventHead');
    const eventBody = container.querySelector('#eventBody');
    const tableViewHelp = container.querySelector('#tableViewHelp');
    if (!eventHead || !eventBody) return;

    if (tableView === "participant") {
      tableViewHelp.textContent = "원생 단위로 관련 일정과 다가오는 수업 정보를 봅니다.";
      eventHead.innerHTML = `
        <tr>
          <th>참여 원생</th>
          <th>관련 일정</th>
          <th>구분</th>
          <th>일자</th>
          <th>D-day</th>
          <th>다가오는 수업</th>
          <th>담당자</th>
          <th>메모</th>
          <th>확인</th>
        </tr>
      `;

      const list = getFilteredEventsList().flatMap((event) => {
        return eventParts(event.id).map((student) => ({ event, student }));
      });

      eventBody.innerHTML = list.map(({ event, student }) => `
        <tr data-student-id="${student.id}">
          <td><div class="event-name"><strong>${student.name}</strong><span>${student.grade} · ${student.instrument}</span></div></td>
          <td><div class="event-name"><strong>${event.name}</strong><span>${event.memo}</span></div></td>
          <td>${typeChip(event.type)}</td>
          <td>${fmt(event.date)}</td>
          <td><b style="color:${dday(event.date) <= 7 ? "var(--red)" : "var(--ink)"}">D-${dday(event.date)}</b></td>
          <td>${lessonDateTime(student)}</td>
          <td>${student.teacher}</td>
          <td>${memoStateChip(student)}</td>
          <td><button class="primary btn-row-action" data-student-id="${student.id}">확인</button></td>
        </tr>
      `).join("");

      eventBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.btn-row-action')) return;
          openStudent(Number(row.dataset.studentId));
        });

        const btn = row.querySelector('.btn-row-action');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openStudent(Number(btn.dataset.studentId));
          });
        }
      });

    } else {
      tableViewHelp.textContent = "일정 단위로 마감/공개/참여 원생을 봅니다.";
      eventHead.innerHTML = `
        <tr>
          <th>일정</th>
          <th>구분</th>
          <th>일자</th>
          <th>D-day</th>
          <th>포함 원생</th>
          <th>미처리</th>
          <th>담당자</th>
          <th>공개</th>
          <th>상태</th>
          <th>확인</th>
        </tr>
      `;

      const list = getFilteredEventsList();

      eventBody.innerHTML = list.map((event) => {
        const parts = eventParts(event.id);
        const openCount = parts.filter(hasStudentMemo).length;
        return `
          <tr data-event-id="${event.id}">
            <td><div class="event-name"><strong>${event.name}</strong><span>${event.memo}</span></div></td>
            <td>${typeChip(event.type)}</td>
            <td>${fmt(event.date)}</td>
            <td><b style="color:${dday(event.date) <= 7 ? "var(--red)" : "var(--ink)"}">D-${dday(event.date)}</b></td>
            <td>${parts.length}명</td>
            <td><span class="mini-chip ${openCount ? "tone-red" : "tone-green"}">${openCount}명</span></td>
            <td>${event.owner}</td>
            <td>${visibilityChip(event.visible)}</td>
            <td>${statusChip(event.status)}</td>
            <td><button class="primary btn-row-action" data-event-id="${event.id}">확인</button></td>
          </tr>
        `;
      }).join("");

      eventBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', (e) => {
          if (e.target.closest('.btn-row-action')) return;
          openEvent(row.dataset.eventId);
        });

        const btn = row.querySelector('.btn-row-action');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEvent(btn.dataset.eventId);
          });
        }
      });
    }
  };

  const openEvent = (id) => {
    const event = events.find((item) => item.id === id);
    const parts = eventParts(id);
    
    const drawerHead = container.querySelector('#drawerHead');
    const drawerBody = container.querySelector('#drawerBody');
    const drawerFooter = container.querySelector('#drawerFooter');

    drawerHead.innerHTML = `
      <div class="drawer-student-card">
        <div class="avatar">${eventTypes[event.type].label.slice(0, 2)}</div>
        <div class="drawer-student-main">
          <strong>${event.name}</strong>
          <span>${fmt(event.date)} · 일정 D-${dday(event.date)} · ${event.place} · ${event.owner}</span>
        </div>
      </div>
    `;

    drawerBody.innerHTML = `
      <section class="drawer-section memo-section">
        <h3>메모</h3>
        <div class="section-body">
          ${eventMemoItems(event).map((note) => `
            <div class="memo-item">
              <div class="student-mini">
                <div class="mini-avatar">메모</div>
                <div class="queue-main">
                  <strong>${note.split(" ")[0]}</strong>
                  <span>${note.replace(note.split(" ")[0] + " ", "")}</span>
                </div>
                <span class="mini-chip tone-blue">확인</span>
              </div>
              <div class="memo-actions">
                <button class="btn-memo-edit">수정</button>
                <button class="btn-memo-delete">삭제</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
      <section class="drawer-section">
        <h3>일정 정보</h3>
        <div class="section-body">
          <div class="detail-grid">
            <div class="detail-item"><span>일자</span><strong>${fmt(event.date)}</strong></div>
            <div class="detail-item"><span>장소</span><strong>${event.place}</strong></div>
            <div class="detail-item"><span>접수마감</span><strong>${event.due ? fmt(event.due) + " · D-" + dday(event.due) : "없음"}</strong></div>
            <div class="detail-item"><span>담당자</span><strong>${event.owner}</strong></div>
            <div class="detail-item"><span>학부모/학생 노출</span><strong>${event.visible ? "공개 중" : "비공개"}</strong></div>
            <div class="detail-item"><span>공개 기본값</span><strong>보여주지 않음</strong></div>
          </div>
          <p class="note">${event.memo}</p>
        </div>
      </section>
      <section class="drawer-section">
        <h3>포함 원생 ${parts.length}명</h3>
        <div class="section-body">
          ${parts.map((student) => `
            <div class="student-mini" data-student-id="${student.id}">
              <div class="mini-avatar">${student.name.slice(-2)}</div>
              <div class="queue-main">
                <strong>${student.name} · ${student.instrument}</strong>
                <span>${student.teacher} · ${student.memo}</span>
              </div>
              ${memoStateChip(student)}
            </div>
          `).join("")}
        </div>
      </section>
    `;

    drawerBody.querySelectorAll('.memo-item').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('open');
      });
    });

    drawerBody.querySelectorAll('.student-mini').forEach(mini => {
      mini.addEventListener('click', (e) => {
        e.stopPropagation();
        openStudent(Number(mini.dataset.studentId));
      });
    });

    drawerFooter.innerHTML = `
      <button class="primary-action" id="btn-drawer-memo">메모</button>
      <button id="btn-drawer-message">메세지</button>
      <button id="btn-drawer-visibility-toggle">공개 변경</button>
    `;

    const visToggle = drawerFooter.querySelector('#btn-drawer-visibility-toggle');
    if (visToggle) {
      visToggle.addEventListener('click', () => {
        alert(`${event.name} 일정을 학부모/원생에게 공개하려면 공개 대상과 문구를 한 번 더 확인합니다. 기본값은 비공개입니다.`);
      });
    }

    drawerFooter.classList.add("open");
    showDrawer();
  };

  const openStudent = (id) => {
    const student = students.find((item) => item.id === id);
    const related = student.eventIds.map((eventId) => events.find((event) => event.id === eventId));

    const drawerHead = container.querySelector('#drawerHead');
    const drawerBody = container.querySelector('#drawerBody');
    const drawerFooter = container.querySelector('#drawerFooter');

    drawerHead.innerHTML = `
      <div class="drawer-student-card">
        <div class="avatar">${student.name.slice(-2)}</div>
        <div class="drawer-student-main">
          <strong>${student.name}</strong>
          <span>${student.grade} · ${student.instrument} · ${student.teacher} 강사</span>
        </div>
      </div>
    `;

    drawerBody.innerHTML = `
      <section class="drawer-section memo-section">
        <h3>메모</h3>
        <div class="section-body">
          ${student.notes.map((note) => `
            <div class="memo-item">
              <div class="student-mini">
                <div class="mini-avatar">메모</div>
                <div class="queue-main">
                  <strong>${note.split(" ")[0]}</strong>
                  <span>${note.replace(note.split(" ")[0] + " ", "")}</span>
                </div>
                <span class="mini-chip tone-blue">확인</span>
              </div>
              <div class="memo-actions">
                <button class="btn-memo-edit">수정</button>
                <button class="btn-memo-delete">삭제</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
      <section class="drawer-section">
        <h3>다가오는 수업</h3>
        <div class="section-body">
          <div class="detail-grid">
            <div class="detail-item"><span>담당강사</span><strong>${student.teacher}</strong></div>
            <div class="detail-item"><span>악기</span><strong>${student.instrument}</strong></div>
          </div>
          <div class="drawer-lesson-list">
            ${upcomingLessons(student).map((lesson) => `
              <div class="drawer-lesson-row">
                <strong>${lesson.label}</strong>
                <span>${lesson.at}</span>
                <span class="mini-chip tone-slate">${lesson.type}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </section>
      <section class="drawer-section">
        <h3>관련 일정</h3>
        <div class="section-body">
          ${related.map((event) => `
            <div class="student-mini" data-event-id="${event.id}">
              <div class="mini-avatar">${eventTypes[event.type].label[0]}</div>
              <div class="queue-main">
                <strong>${event.name}</strong>
                <span>${fmt(event.date)} · D-${dday(event.date)} · ${event.owner}</span>
              </div>
              ${statusChip(event.status)}
            </div>
          `).join("")}
        </div>
      </section>
    `;

    drawerBody.querySelectorAll('.memo-item').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('open');
      });
    });

    drawerBody.querySelectorAll('.student-mini').forEach(mini => {
      mini.addEventListener('click', (e) => {
        e.stopPropagation();
        openEvent(mini.dataset.eventId);
      });
    });

    drawerFooter.innerHTML = `
      <button class="primary-action" id="btn-drawer-memo">메모</button>
      <button id="btn-drawer-arrange">레슨편성</button>
      <button id="btn-drawer-message">메세지</button>
    `;

    drawerFooter.classList.add("open");
    showDrawer();
  };

  const openCreateStub = () => {
    const drawerHead = container.querySelector('#drawerHead');
    const drawerBody = container.querySelector('#drawerBody');
    const drawerFooter = container.querySelector('#drawerFooter');

    drawerHead.innerHTML = `
      <span class="type-chip tone-blue">신규</span>
      <div class="drawer-title">일정 추가</div>
      <div class="drawer-meta"><span class="mini-chip tone-slate">입력 부담 최소화 버전</span></div>
    `;

    drawerBody.innerHTML = `
      <section class="drawer-section">
        <h3>필수 입력값</h3>
        <div class="section-body">
          <div class="detail-grid">
            <div class="detail-item"><span>일정명</span><strong>필수</strong></div>
            <div class="detail-item"><span>일자</span><strong>필수</strong></div>
            <div class="detail-item"><span>구분</span><strong>필수</strong></div>
            <div class="detail-item"><span>참여 원생</span><strong>검색/필터 후 체크박스 추가</strong></div>
            <div class="detail-item"><span>학부모/원생 노출</span><strong>기본 OFF</strong></div>
            <div class="detail-item"><span>ON 전환</span><strong>추가 확인 필요</strong></div>
          </div>
          <p class="note">참여 원생은 원생 검색, 반/악기별 필터, 강사별 필터로 찾고 체크박스로 여러 명을 한 번에 추가합니다. 전체선택으로 반이나 강사 단위 추가도 가능합니다. 학부모/원생 로그인 권한에 노출할 수 있지만 기본값은 비공개이며, 공개로 바꿀 때 한 번 더 확인합니다.</p>
        </div>
      </section>
      <section class="drawer-section">
        <h3>참여 원생 추가 방식</h3>
        <div class="section-body">
          <div class="detail-grid">
            <div class="detail-item"><span>검색</span><strong>이름/회원번호 입력</strong></div>
            <div class="detail-item"><span>필터</span><strong>반/악기 · 담당강사</strong></div>
            <div class="detail-item"><span>선택</span><strong>체크박스 다중 선택</strong></div>
            <div class="detail-item"><span>일괄</span><strong>전체선택 후 추가</strong></div>
          </div>
        </div>
      </section>
    `;

    drawerFooter.innerHTML = `
      <button id="btn-create-cancel">취소</button>
      <button class="primary" id="btn-create-save">일정 저장</button>
    `;

    const cancelBtn = drawerFooter.querySelector('#btn-create-cancel');
    const saveBtn = drawerFooter.querySelector('#btn-create-save');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeDrawer);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        closeDrawer();
      });
    }

    drawerFooter.classList.add("open");
    showDrawer();
  };

  const showDrawer = () => {
    const backdrop = container.querySelector('#drawerBackdrop');
    const drawer = container.querySelector('#drawer');
    const body = container.querySelector('#drawerBody');

    if (backdrop) backdrop.classList.add('open');
    if (drawer) drawer.classList.add('open');
    if (body) body.scrollTop = 0;
  };

  const closeDrawer = () => {
    const backdrop = container.querySelector('#drawerBackdrop');
    const drawer = container.querySelector('#drawer');
    const footer = container.querySelector('#drawerFooter');

    if (backdrop) backdrop.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
    if (footer) footer.classList.remove('open');
  };

  render();

  return () => {
    // Cleanup routines if needed
  };
}
