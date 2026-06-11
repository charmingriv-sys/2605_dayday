// majorScheduleView.js - Major Schedule Management View
import { stateStore } from '../../state.js';

const chosung = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const getChosungStr = (str) => {
    let res = "";
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i) - 44032;
        if (code > -1 && code < 11172) {
            res += chosung[Math.floor(code / 588)];
        } else {
            res += str.charAt(i);
        }
    }
    return res;
};

const matchStudent = (student, cleanQuery, isChosungOnly, exactMatchExists) => {
  if (!cleanQuery) return true;
  
  // Name match
  let nameMatch = false;
  if (isChosungOnly) {
    nameMatch = getChosungStr(student.name.toLowerCase()).includes(cleanQuery);
  } else {
    nameMatch = student.name.toLowerCase().includes(cleanQuery);
  }

  // Instrument/Class (grade) match
  const instrumentMatch = student.instrument && student.instrument.toLowerCase().includes(cleanQuery);
  const gradeMatch = student.grade && student.grade.toLowerCase().includes(cleanQuery);

  // Teacher match
  const teacherMatch = student.teacher && student.teacher.toLowerCase().includes(cleanQuery);

  // Member ID match
  const studentMemberNoStr = student.studentMemberNo !== undefined && student.studentMemberNo !== null ? String(student.studentMemberNo).toLowerCase() : "";
  const memberNoStr = student.memberNo !== undefined && student.memberNo !== null ? String(student.memberNo).toLowerCase() : "";
  const idStr = student.id !== undefined && student.id !== null ? String(student.id).toLowerCase() : "";

  let idMatch = false;
  if (exactMatchExists) {
    idMatch = (studentMemberNoStr === cleanQuery || memberNoStr === cleanQuery || idStr === cleanQuery);
  } else {
    idMatch = (studentMemberNoStr.includes(cleanQuery) || memberNoStr.includes(cleanQuery) || idStr.includes(cleanQuery));
  }

  return nameMatch || instrumentMatch || gradeMatch || idMatch || teacherMatch;
};

const formatNoteDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${min}`;
  } catch (e) {
    return "-";
  }
};

const eventTypes = {
  all: { label: "전체", tone: "slate" },
  concours: { label: "콩쿠르", tone: "blue" },
  exam: { label: "입시", tone: "red" },
  makeup: { label: "보강", tone: "amber" },
  event: { label: "행사", tone: "violet" },
  counsel: { label: "상담", tone: "green" },
  etc: { label: "기타", tone: "slate" }
};

function getToday() {
  if (typeof window !== 'undefined' && window.__DAYDAY_E2E__) {
    return new Date(2026, 5, 4);
  }
  return new Date();
}

function dday(dateStr) {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = getToday();
  // Clear time components for pure date difference
  target.setHours(0, 0, 0, 0);
  const todayClear = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - todayClear) / 86400000);
}

function formatDdayLabel(days) {
  if (days > 0) {
    return `D-${days}`;
  } else if (days === 0) {
    return `D-day`;
  } else {
    return `D+${Math.abs(days)}`;
  }
}

function fmt(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${m}.${d}(${dow})`;
}

function typeChip(type) {
  const meta = eventTypes[type] || { label: "기타", tone: "slate" };
  return `<span class="type-chip tone-${meta.tone}">${meta.label}</span>`;
}

function visibilityChip(visible) {
  return `<span class="status-chip ${visible ? "tone-green" : "tone-slate"}">${visible ? "학부모 공개" : "비공개"}</span>`;
}

function getUpcomingLessonsForStudent(student, baselineDate, limit = 4) {
  const dbClasses = stateStore.db.classes || [];
  const studentClasses = dbClasses.filter(c => c.studentId === student.id);
  if (studentClasses.length === 0) return [];

  const dayKoToNum = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  
  const occurrences = [];
  const baseTime = baselineDate.getTime();

  studentClasses.forEach(c => {
    const classDayNum = dayKoToNum[c.dayOfWeek];
    if (classDayNum === undefined) return;
    
    const [hour, min] = c.time.split(':').map(Number);
    
    for (let weekOffset = 0; weekOffset < limit + 1; weekOffset++) {
      const occurrenceDate = new Date(baselineDate.getFullYear(), baselineDate.getMonth(), baselineDate.getDate());
      occurrenceDate.setHours(hour, min, 0, 0);
      
      const currentDayNum = baselineDate.getDay();
      let dayDiff = classDayNum - currentDayNum;
      
      if (dayDiff < 0) {
        dayDiff += 7;
      } else if (dayDiff === 0) {
        const classDateTime = new Date(baselineDate.getFullYear(), baselineDate.getMonth(), baselineDate.getDate());
        classDateTime.setHours(hour, min, 0, 0);
        if (classDateTime.getTime() < baseTime) {
          dayDiff += 7;
        }
      }
      
      const totalDiff = dayDiff + (weekOffset * 7);
      occurrenceDate.setDate(occurrenceDate.getDate() + totalDiff);
      
      occurrences.push({
        dayOfWeek: c.dayOfWeek,
        time: c.time,
        date: occurrenceDate,
        teacher: student.teacher,
        instrument: student.instrument
      });
    }
  });

  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());

  return occurrences.slice(0, limit);
}

export function renderMajorSchedule(container) {
  const headerActions = document.querySelector('.header-actions');
  const settingsQuickBar = document.getElementById('settings-quick-bar');
  const currentDateEl = document.getElementById('current-date');

  // Hide default items
  if (settingsQuickBar) settingsQuickBar.style.display = 'none';
  if (currentDateEl) currentDateEl.style.display = 'none';

  // Create our action container in global header
  let majorHeaderActions = document.getElementById('major-schedule-global-header-actions');
  if (!majorHeaderActions) {
      majorHeaderActions = document.createElement('div');
      majorHeaderActions.id = 'major-schedule-global-header-actions';
      majorHeaderActions.style.display = 'flex';
      majorHeaderActions.style.alignItems = 'center';
      majorHeaderActions.style.gap = '8px';
      if (headerActions) {
          headerActions.appendChild(majorHeaderActions);
      }
  }

  let activeType = "all";
  let tableView = "event";
  let selectedOwner = "전체";
  let searchQuery = "";
  let lastSyncTime = "16:40";

  // State adapter to map real db tables to structure required by the UI
  const getAdaptedStudents = () => {
    const dbStudents = stateStore.getStudents() || [];
    const dbTeachers = stateStore.getTeachers() || [];
    const dbClasses = stateStore.db.classes || [];
    const dbSchedules = stateStore.getMajorSchedules() || [];

    return dbStudents.map(student => {
      // Resolve teacher name
      const teacherObj = dbTeachers.find(t => t.id === student.teacherId);
      const teacherName = teacherObj ? teacherObj.name : (student.teacher || '기타');
      
      // Resolve related event IDs
      const eventIds = dbSchedules
        .filter(ev => ev.participantStudentIds && ev.participantStudentIds.includes(student.id))
        .map(ev => ev.id);

      // Resolve lesson time
      const studentClasses = dbClasses.filter(c => c.studentId === student.id);
      const lesson = studentClasses.length > 0 
        ? studentClasses.map(c => `${c.dayOfWeek} ${c.time}`).join(', ')
        : '수업 없음';

      // Parse school and age to grade
      const grade = student.school ? `${student.school} ${student.age ? student.age + '세' : ''}` : (student.age ? `${student.age}세` : '일반');

      // Notes
      let notes = stateStore.getMajorScheduleStudentNotes(student.id) || [];
      
      return {
        id: student.id,
        studentMemberNo: student.studentMemberNo,
        memberNo: student.memberNo,
        name: student.name,
        grade: grade,
        instrument: student.instrument || '피아노',
        teacher: teacherName,
        eventIds: eventIds,
        lesson: lesson,
        lessonSource: studentClasses.length > 0 ? "정규 수업 배정" : "미정",
        memo: student.scheduleNotes || '-',
        notes: notes
      };
    });
  };

  const getFilteredEventsList = () => {
    const list = stateStore.getMajorSchedules() || [];
    const adaptedStudents = getAdaptedStudents();
    
    const cleanQuery = searchQuery.trim().toLowerCase();
    const isChosungOnly = cleanQuery ? /^[ㄱ-ㅎ\s]+$/.test(cleanQuery) : false;

    let exactMatchExists = false;
    if (cleanQuery) {
      exactMatchExists = adaptedStudents.some(student => {
        const studentMemberNoStr = student.studentMemberNo !== undefined && student.studentMemberNo !== null ? String(student.studentMemberNo).toLowerCase() : "";
        const memberNoStr = student.memberNo !== undefined && student.memberNo !== null ? String(student.memberNo).toLowerCase() : "";
        const idStr = student.id !== undefined && student.id !== null ? String(student.id).toLowerCase() : "";
        return studentMemberNoStr === cleanQuery || memberNoStr === cleanQuery || idStr === cleanQuery;
      });
    }

    return list.filter((event) => {
      const parts = adaptedStudents.filter(s => event.participantStudentIds && event.participantStudentIds.includes(s.id));
      if (activeType !== "all" && event.type !== activeType) return false;
      const ownerName = stateStore.getTeacherDisplayName(event.ownerId);
      if (selectedOwner !== "전체" && ownerName !== selectedOwner) return false;
      
      if (cleanQuery) {
        const eventNameMatch = event.name.toLowerCase().includes(cleanQuery);
        const eventPlaceMatch = event.place && event.place.toLowerCase().includes(cleanQuery);
        const eventOwnerMatch = ownerName && ownerName.toLowerCase().includes(cleanQuery);
        const anyStudentMatches = parts.some(student => matchStudent(student, cleanQuery, isChosungOnly, exactMatchExists));
        if (!eventNameMatch && !eventPlaceMatch && !eventOwnerMatch && !anyStudentMatches) return false;
      }
      return true;
    }).sort((a, b) => dday(a.eventDate) - dday(b.eventDate));
  };

  const render = () => {
    const allEvents = stateStore.getMajorSchedules() || [];
    const adaptedStudents = getAdaptedStudents();
    const dbClasses = stateStore.db.classes || [];
    const dbStudents = stateStore.getStudents() || [];

    const monthEvents = allEvents.filter((event) => dday(event.eventDate) >= 0).length;
    const deadline = allEvents.filter((event) => event.dueDate && dday(event.dueDate) >= 0 && dday(event.dueDate) <= 7).length;
    
    // Resolve today's lessons count dynamically
    const dayOfWeekKo = ["일", "월", "화", "수", "목", "금", "토"][getToday().getDay()];
    const todayLessons = dbStudents.filter(s => dbClasses.some(c => c.studentId === s.id && c.dayOfWeek === dayOfWeekKo)).length;

    const owners = [...new Set(allEvents.map((event) => stateStore.getTeacherDisplayName(event.ownerId)))];

    if (majorHeaderActions) {
      majorHeaderActions.innerHTML = `
        <div class="major-schedule-clock" id="major-schedule-last-sync">마지막 동기화 ${lastSyncTime}</div>
        <button class="btn btn-primary" id="major-schedule-refresh-btn">새로고침</button>
      `;
    }

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

        .major-schedule-clock {
          padding: 6px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.82rem;
          font-weight: 700;
          background: var(--bg-card);
          color: var(--text-main);
          display: flex;
          align-items: center;
        }

        .major-schedule-root .page-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 4px;
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
          padding-bottom: 8px;
          scroll-snap-type: x proximity;
        }
        .major-schedule-root .event-strip::-webkit-scrollbar {
          height: 10px;
        }
        .major-schedule-root .event-strip::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 5px;
        }
        .major-schedule-root .event-strip::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 5px;
        }
        .major-schedule-root .event-strip::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
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
          font-size: 13.5px;
          line-height: 1.28;
          font-weight: 950;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          height: 36px;
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
        .major-schedule-root .event-meta span {
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
              <select id="ownerFilter">
                <option value="전체">전체 담당자</option>
                ${owners.map(o => `<option value="${o}" ${selectedOwner === o ? "selected" : ""}>${o}</option>`).join('')}
              </select>
            </div>
            <div class="search-box">
              <input id="searchInput" placeholder="일정명, 장소, 원생명, 초성, 악기, 회원번호, 담당자 검색" value="${searchQuery}" />
            </div>
          </section>

          <section class="content-grid">
            <div class="card">
              <div class="card-head">
                <div>
                  <h2>주요 일정 목록</h2>
                  <p>임박 일정과 포함 원생을 기준으로 먼저 확인합니다.</p>
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
    const refreshBtn = document.getElementById('major-schedule-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        lastSyncTime = `${hh}:${mm}`;
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
      addTrigger.addEventListener('click', () => openForm());
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

  const renderEventStrip = () => {
    const list = getFilteredEventsList();
    const adaptedStudents = getAdaptedStudents();
    const strip = container.querySelector('#eventStrip');
    if (!strip) return;

    if (list.length === 0) {
      strip.innerHTML = `
        <div style="width: 100%; text-align: center; color: var(--muted); padding: 40px 20px; font-size: 14px; background: var(--panel); border: 1px dashed var(--line); border-radius: 8px; box-sizing: border-box;">
          검색 조건에 맞는 일정이 없습니다.
        </div>
      `;
      return;
    }

    strip.innerHTML = list.map((event) => {
      const parts = adaptedStudents.filter(s => event.participantStudentIds && event.participantStudentIds.includes(s.id));
      const urgent = event.dueDate && dday(event.dueDate) <= 5;
      const meta = eventTypes[event.type] || { tone: "slate" };
      return `
        <article class="event-card" data-id="${event.id}">
          <div class="event-bar" style="background:var(--${meta.tone === "slate" ? "blue" : meta.tone})"></div>
          <div class="event-body">
            <div class="event-head">
              ${typeChip(event.type)}
              <div class="dday">진행/종료 ${formatDdayLabel(dday(event.eventDate))}</div>
            </div>
            <div class="event-title">${event.name}</div>
            <div class="event-meta">
              <span>${fmt(event.eventDate)} · ${event.place || "-"}</span>
            </div>
            <div class="event-due-box ${urgent ? "urgent" : ""}">
              <span>${event.dueDate ? `접수마감 ${fmt(event.dueDate)}` : "접수마감 없음"}</span>
              <span class="due-dday">${event.dueDate ? formatDdayLabel(dday(event.dueDate)) : "-"}</span>
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

    const adaptedStudents = getAdaptedStudents();

    if (tableView === "participant") {
      tableViewHelp.textContent = "원생 단위로 관련 일정과 다가오는 수업 정보를 봅니다.";
      eventHead.innerHTML = `
        <tr>
          <th>참여 원생</th>
          <th>관련 일정</th>
          <th>구분</th>
          <th>진행/종료일</th>
          <th>D-day</th>
          <th>다가오는 수업</th>
          <th>담당자</th>
          <th>메모</th>
          <th>확인</th>
        </tr>
      `;

      let list = getFilteredEventsList().flatMap((event) => {
        const parts = adaptedStudents.filter(s => event.participantStudentIds && event.participantStudentIds.includes(s.id));
        return parts.map((student) => ({ event, student }));
      });

      if (searchQuery) {
        const cleanQuery = searchQuery.trim().toLowerCase();
        const isChosungOnly = /^[ㄱ-ㅎ\s]+$/.test(cleanQuery);
        const exactMatchExists = adaptedStudents.some(student => {
          const studentMemberNoStr = student.studentMemberNo !== undefined && student.studentMemberNo !== null ? String(student.studentMemberNo).toLowerCase() : "";
          const memberNoStr = student.memberNo !== undefined && student.memberNo !== null ? String(student.memberNo).toLowerCase() : "";
          const idStr = student.id !== undefined && student.id !== null ? String(student.id).toLowerCase() : "";
          return studentMemberNoStr === cleanQuery || memberNoStr === cleanQuery || idStr === cleanQuery;
        });

        list = list.filter(({ event, student }) => {
          const eventNameMatch = event.name.toLowerCase().includes(cleanQuery);
          const eventPlaceMatch = event.place && event.place.toLowerCase().includes(cleanQuery);
          const studentMatch = matchStudent(student, cleanQuery, isChosungOnly, exactMatchExists);
          return eventNameMatch || eventPlaceMatch || studentMatch;
        });
      }

      if (list.length === 0) {
        eventBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; color: var(--muted); padding: 30px 20px; font-size: 14px;">
              검색 결과가 없습니다.
            </td>
          </tr>
        `;
      } else {
        eventBody.innerHTML = list.map(({ event, student }) => {
          const baseline = getToday();
          const upcoming = getUpcomingLessonsForStudent(student, baseline, 2);
          const lessonStr = upcoming.length === 0 ? "예정된 수업 없음" : upcoming.map(l => `${l.dayOfWeek} ${l.time}`).join(', ');

          return `
            <tr data-student-id="${student.id}">
              <td><div class="event-name"><strong>${student.name} (${student.studentMemberNo || student.memberNo || student.id})</strong><span>${student.grade} · ${student.instrument}</span></div></td>
              <td><div class="event-name"><strong>${event.name}</strong><span>${event.memo || ""}</span></div></td>
              <td>${typeChip(event.type)}</td>
              <td>${fmt(event.eventDate)}</td>
              <td><b style="color:${dday(event.eventDate) <= 7 ? "var(--red)" : "var(--ink)"}">${formatDdayLabel(dday(event.eventDate))}</b></td>
              <td>${lessonStr}</td>
              <td>${student.teacher}</td>
              <td>
                <span class="mini-chip ${student.notes.length > 0 ? "tone-blue" : "tone-green"}">
                  ${student.notes.length > 0 ? "메모 있음" : "메모 없음"}
                </span>
              </td>
              <td><button class="primary btn-row-action" data-student-id="${student.id}">확인</button></td>
            </tr>
          `;
        }).join("");

        eventBody.querySelectorAll('tr').forEach(row => {
          row.addEventListener('click', (e) => {
            if (e.target.closest('.btn-row-action')) return;
            openStudent(row.dataset.studentId);
          });

          const btn = row.querySelector('.btn-row-action');
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              openStudent(btn.dataset.studentId);
            });
          }
        });
      }

    } else {
      tableViewHelp.textContent = "일정 단위로 마감/공개/참여 원생을 봅니다.";
      eventHead.innerHTML = `
        <tr>
          <th>일정</th>
          <th>구분</th>
          <th>진행/종료일</th>
          <th>D-day</th>
          <th>참여 원생</th>
          <th>담당자</th>
          <th>공개</th>
          <th>확인</th>
        </tr>
      `;

      const list = getFilteredEventsList();

      if (list.length === 0) {
        eventBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; color: var(--muted); padding: 30px 20px; font-size: 14px;">
              검색 결과가 없습니다.
            </td>
          </tr>
        `;
      } else {
        eventBody.innerHTML = list.map((event) => {
          const parts = adaptedStudents.filter(s => event.participantStudentIds && event.participantStudentIds.includes(s.id));
          return `
            <tr data-event-id="${event.id}">
              <td><div class="event-name"><strong>${event.name}</strong><span>${event.memo || ""}</span></div></td>
              <td>${typeChip(event.type)}</td>
              <td>${fmt(event.eventDate)}</td>
              <td><b style="color:${dday(event.eventDate) <= 7 ? "var(--red)" : "var(--ink)"}">${formatDdayLabel(dday(event.eventDate))}</b></td>
              <td>${parts.length === 0 ? "참여 없음" : `${parts.length}명`}</td>
              <td>${stateStore.getTeacherDisplayName(event.ownerId)}</td>
              <td>${visibilityChip(event.visible)}</td>
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
    }
  };

  const openEvent = (id) => {
    const event = stateStore.getMajorSchedules().find((item) => item.id === id);
    if (!event) return;
    const adaptedStudents = getAdaptedStudents();
    const parts = adaptedStudents.filter(s => event.participantStudentIds && event.participantStudentIds.includes(s.id));
    
    const drawerHead = container.querySelector('#drawerHead');
    const drawerBody = container.querySelector('#drawerBody');
    const drawerFooter = container.querySelector('#drawerFooter');

    const meta = eventTypes[event.type] || { label: "기타" };

    drawerHead.innerHTML = `
      <div class="drawer-student-card">
        <div class="avatar">${meta.label.slice(0, 2)}</div>
        <div class="drawer-student-main">
          <strong>${event.name}</strong>
          <span>${fmt(event.eventDate)} · 진행/종료 ${formatDdayLabel(dday(event.eventDate))} · ${event.place || "-"} · ${stateStore.getTeacherDisplayName(event.ownerId)}</span>
        </div>
      </div>
    `;

    drawerBody.innerHTML = `
      <section class="drawer-section">
        <h3>일정 정보</h3>
        <div class="section-body">
          <div class="detail-grid">
            <div class="detail-item"><span>구분</span><strong>${meta.label}</strong></div>
            <div class="detail-item"><span>진행/종료일</span><strong>${fmt(event.eventDate)} · ${formatDdayLabel(dday(event.eventDate))}</strong></div>
            <div class="detail-item"><span>접수마감</span><strong>${event.dueDate ? fmt(event.dueDate) + " · " + formatDdayLabel(dday(event.dueDate)) : "접수마감 없음"}</strong></div>
            <div class="detail-item"><span>장소</span><strong>${event.place || "-"}</strong></div>
            <div class="detail-item"><span>담당자</span><strong>${stateStore.getTeacherDisplayName(event.ownerId)}</strong></div>
            <div class="detail-item"><span>공개여부</span><strong>${event.visible ? "학부모 공개" : "비공개"}</strong></div>
          </div>
          <p class="note" style="white-space: pre-wrap; font-size: 13px; color: var(--ink); margin-top: 10px; padding: 10px; border-radius: 6px; background: #f8fafc; border: 1px solid var(--line);">${event.memo || "등록된 메모가 없습니다."}</p>
        </div>
      </section>
      <section class="drawer-section">
        <h3>참여 원생 ${parts.length === 0 ? "0" : parts.length}명</h3>
        <div class="section-body">
          ${parts.length === 0 ? `<div style="font-size: 13px; color: var(--muted); text-align: center; padding: 12px;">참여 원생이 없습니다.</div>` : parts.map((student) => `
            <div class="student-mini" data-student-id="${student.id}">
              <div class="mini-avatar">${student.name.slice(-2)}</div>
              <div class="queue-main">
                <strong>${student.name} (${student.studentMemberNo || student.memberNo || student.id}) · ${student.grade} · ${student.instrument}</strong>
                <span>담당강사: ${student.teacher}</span>
              </div>
              <span class="mini-chip ${student.notes.length > 0 ? "tone-blue" : "tone-green"}">
                ${student.notes.length > 0 ? "메모 있음" : "메모 없음"}
              </span>
            </div>
          `).join("")}
        </div>
      </section>
    `;

    drawerBody.querySelectorAll('.student-mini').forEach(mini => {
      mini.addEventListener('click', (e) => {
        e.stopPropagation();
        openStudent(mini.dataset.studentId);
      });
    });

    drawerFooter.innerHTML = `
      <button id="btn-drawer-delete" class="btn" style="color: var(--red); border-color: var(--red-soft);">삭제</button>
      <button id="btn-drawer-edit" class="btn primary">수정</button>
    `;

    const editBtn = drawerFooter.querySelector('#btn-drawer-edit');
    const deleteBtn = drawerFooter.querySelector('#btn-drawer-delete');

    editBtn.addEventListener('click', () => {
      openForm(event);
    });

    deleteBtn.addEventListener('click', () => {
      const confirmDelete = confirm('이 일정을 삭제할까요?');
      if (confirmDelete) {
        stateStore.deleteMajorSchedule(event.id);
        closeDrawer();
        render();
      }
    });

    drawerFooter.classList.add("open");
    showDrawer();
  };

  const openStudent = (studentId) => {
    const refreshStudentData = () => {
      const dbStudents = getAdaptedStudents();
      return dbStudents.find(s => s.id === studentId);
    };

    let student = refreshStudentData();
    if (!student) return;

    const allEvents = stateStore.getMajorSchedules() || [];
    const related = student.eventIds.map((eventId) => allEvents.find((event) => event.id === eventId)).filter(Boolean);

    const drawerHead = container.querySelector('#drawerHead');
    const drawerBody = container.querySelector('#drawerBody');
    const drawerFooter = container.querySelector('#drawerFooter');

    drawerHead.innerHTML = `
      <div class="drawer-student-card">
        <div class="avatar">${student.name.slice(-2)}</div>
        <div class="drawer-student-main">
          <strong>${student.name}</strong>
          <span>(${student.studentMemberNo || student.memberNo || student.id}) · ${student.grade} · ${student.instrument} · ${student.teacher} 강사</span>
        </div>
      </div>
    `;

    // Calculate next lesson dates based on actual student classes
    const baselineDate = getToday();
    const upcomingLessons = getUpcomingLessonsForStudent(student, baselineDate, 4);

    const renderMemoList = () => {
      const containerEl = drawerBody.querySelector('#drawer-memo-list-container');
      if (!containerEl) return;
      
      const currentStudent = refreshStudentData();
      if (!currentStudent) return;
      
      if (currentStudent.notes.length === 0) {
        containerEl.innerHTML = `<div style="font-size: 13px; color: var(--muted); text-align: center; padding: 12px;">등록된 메모가 없습니다.</div>`;
      } else {
        containerEl.innerHTML = currentStudent.notes.map((note) => {
          const formattedDate = formatNoteDate(note.createdAt || note.updatedAt);
          return `
            <div class="memo-item" data-note-id="${note.id}" style="cursor: pointer;">
              <div class="student-mini" style="border: 0; padding: 9px 0;">
                <div class="mini-avatar">메모</div>
                <div class="queue-main" style="margin-left: 8px;">
                  <strong style="font-size: 11px; color: var(--muted);">${formattedDate}</strong>
                  <span>${note.content}</span>
                </div>
                <span class="mini-chip tone-blue">확인</span>
              </div>
              <div class="memo-actions">
                <button class="btn btn-edit-note" style="min-height: 26px; padding: 0 9px; font-size: 11px; margin-bottom: 0;">수정</button>
                <button class="btn btn-delete-note" style="min-height: 26px; padding: 0 9px; font-size: 11px; margin-bottom: 0; color: var(--red); border-color: var(--red-soft);">삭제</button>
              </div>
            </div>
          `;
        }).join("");

        containerEl.querySelectorAll('.memo-item').forEach(itemEl => {
          itemEl.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-note') || e.target.closest('.btn-delete-note')) {
              return;
            }
            itemEl.classList.toggle('open');
          });

          const editBtn = itemEl.querySelector('.btn-edit-note');
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteId = itemEl.dataset.noteId;
            const currentStudent = refreshStudentData();
            const note = currentStudent.notes.find(n => n.id === noteId);
            if (note) {
              openMemoForm(note);
            }
          });

          const deleteBtn = itemEl.querySelector('.btn-delete-note');
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteId = itemEl.dataset.noteId;
            const approve = confirm('이 메모를 삭제할까요?');
            if (approve) {
              stateStore.deleteMajorScheduleStudentNote(noteId);
              renderMemoList();
            }
          });
        });
      }
    };

    const openMemoForm = (noteToEdit = null) => {
      const formArea = drawerBody.querySelector('#memo-form-area');
      const formTitle = drawerBody.querySelector('#memo-form-title');
      const inputEl = drawerBody.querySelector('#memo-input');
      const errorEl = drawerBody.querySelector('#memo-error-msg');

      errorEl.style.display = 'none';
      errorEl.textContent = '';
      
      if (noteToEdit) {
        formTitle.textContent = '메모 수정';
        formArea.dataset.noteId = noteToEdit.id;
        inputEl.value = noteToEdit.content;
      } else {
        formTitle.textContent = '새 메모 작성';
        delete formArea.dataset.noteId;
        inputEl.value = '';
      }

      formArea.style.display = 'block';
      inputEl.focus();
      drawerBody.scrollTop = 0;
    };

    const closeMemoForm = () => {
      const formArea = drawerBody.querySelector('#memo-form-area');
      const inputEl = drawerBody.querySelector('#memo-input');
      const errorEl = drawerBody.querySelector('#memo-error-msg');

      formArea.style.display = 'none';
      delete formArea.dataset.noteId;
      inputEl.value = '';
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    };

    drawerBody.innerHTML = `
      <section class="drawer-section memo-section">
        <h3>메모</h3>
        <div class="section-body">
          <div id="memo-form-area" style="display: none; margin-bottom: 12px; padding: 12px; border: 1px solid var(--blue-soft); border-radius: 8px; background: #f0f9ff;">
            <div style="font-size: 12px; font-weight: 850; color: var(--blue); margin-bottom: 6px;" id="memo-form-title">새 메모 작성</div>
            <textarea id="memo-input" placeholder="메모 내용을 입력하세요" style="width: 100%; min-height: 60px; padding: 8px; font-size: 13px; border: 1px solid var(--line); border-radius: 6px; resize: vertical; box-sizing: border-box;"></textarea>
            <div id="memo-error-msg" style="display: none; color: var(--red); font-size: 11px; font-weight: 850; margin: 4px 0 6px 0;"></div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
              <button class="btn" id="btn-memo-cancel" style="min-height: 28px; padding: 0 12px; font-size: 12px; background: #fff;">취소</button>
              <button class="btn primary" id="btn-memo-save" style="min-height: 28px; padding: 0 12px; font-size: 12px; background: var(--blue); color: #fff; border-color: var(--blue);">저장</button>
            </div>
          </div>
          <div id="drawer-memo-list-container"></div>
        </div>
      </section>
      <section class="drawer-section">
        <h3>다가오는 수업</h3>
        <div class="section-body">
          ${upcomingLessons.length === 0 ? `
            <div style="font-size: 13px; color: var(--muted); text-align: center; padding: 12px;">예정된 수업 없음</div>
          ` : `
            <div class="drawer-lesson-list">
              ${upcomingLessons.map((lesson, idx) => {
                const label = idx === 0 ? "다음" : `${idx + 1}회차`;
                const date = lesson.date;
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const hh = String(date.getHours()).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                const dayKo = days[date.getDay()];
                const atStr = `${mm}/${dd}(${dayKo}) ${hh}:${min}`;
                return `
                  <div class="drawer-lesson-row">
                    <strong>${label}</strong>
                    <span>${lesson.teacher}(${lesson.instrument}) ${atStr}</span>
                    <span class="mini-chip tone-slate">정규</span>
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>
      </section>
      <section class="drawer-section">
        <h3>관련 일정</h3>
        <div class="section-body">
          ${related.length === 0 ? `<div style="font-size: 13px; color: var(--muted); text-align: center; padding: 12px;">참여 중인 주요 일정이 없습니다.</div>` : related.map((event) => `
            <div class="student-mini" data-event-id="${event.id}">
              <div class="mini-avatar">${(eventTypes[event.type] || { label: "기" }).label[0]}</div>
              <div class="queue-main">
                <strong>${event.name}</strong>
                <span>${fmt(event.eventDate)} · ${formatDdayLabel(dday(event.eventDate))} · ${stateStore.getTeacherDisplayName(event.ownerId)}</span>
              </div>
              ${visibilityChip(event.visible)}
            </div>
          `).join("")}
        </div>
      </section>
    `;

    renderMemoList();

    const cancelMemoBtn = drawerBody.querySelector('#btn-memo-cancel');
    const saveMemoBtn = drawerBody.querySelector('#btn-memo-save');
    const memoInputEl = drawerBody.querySelector('#memo-input');
    const memoFormArea = drawerBody.querySelector('#memo-form-area');
    const memoErrorEl = drawerBody.querySelector('#memo-error-msg');

    cancelMemoBtn.addEventListener('click', closeMemoForm);

    saveMemoBtn.addEventListener('click', () => {
      memoErrorEl.style.display = 'none';
      memoErrorEl.textContent = '';

      const content = memoInputEl.value.trim();
      if (!content) {
        memoErrorEl.textContent = '메모 내용을 입력해 주세요.';
        memoErrorEl.style.display = 'block';
        return;
      }

      const noteId = memoFormArea.dataset.noteId;
      try {
        if (noteId) {
          stateStore.updateMajorScheduleStudentNote(noteId, { content });
        } else {
          stateStore.addMajorScheduleStudentNote(studentId, content);
        }
        closeMemoForm();
        renderMemoList();
      } catch (err) {
        memoErrorEl.textContent = `저장 실패: ${err.message}`;
        memoErrorEl.style.display = 'block';
      }
    });

    drawerBody.querySelectorAll('.student-mini[data-event-id]').forEach(mini => {
      mini.addEventListener('click', (e) => {
        e.stopPropagation();
        openEvent(mini.dataset.eventId);
      });
    });

    drawerFooter.innerHTML = `
      <button id="btn-student-memo" class="btn primary-action">메모</button>
      <button id="btn-student-lesson" class="btn">레슨편성</button>
      <button id="btn-student-message" class="btn">메시지</button>
      <button id="btn-student-close" class="btn" style="min-width: 60px;">닫기</button>
    `;

    drawerFooter.querySelector('#btn-student-close').addEventListener('click', closeDrawer);
    
    drawerFooter.querySelector('#btn-student-memo').addEventListener('click', () => {
      openMemoForm();
    });

    drawerFooter.querySelector('#btn-student-lesson').addEventListener('click', () => {
      alert('레슨편성 연결 방식은 검토 중입니다.');
    });

    drawerFooter.querySelector('#btn-student-message').addEventListener('click', () => {
      alert('메시지 기능은 추후 학부모 소통 화면과 연결 예정입니다.');
    });

    drawerFooter.classList.add("open");
    showDrawer();
  };

  const openForm = (event = null) => {
    const isEdit = !!event;
    const drawerHead = container.querySelector('#drawerHead');
    const drawerBody = container.querySelector('#drawerBody');
    const drawerFooter = container.querySelector('#drawerFooter');

    drawerHead.innerHTML = `
      <span class="type-chip tone-blue">${isEdit ? "수정" : "신규"}</span>
      <div class="drawer-title" style="margin-top: 6px;">${isEdit ? "일정 수정" : "일정 추가"}</div>
    `;

    // Fetch teachers for ownerId dropdown
    const teachers = stateStore.getTeachers() || [];
    const ownerOptions = [
      `<option value="">담당자 선택</option>`,
      ...teachers
        .filter(t => t.employmentStatus !== 'resigned' || (event && (event.ownerId === t.id || event.ownerId === t.name || stateStore.findTeacherByIdOrName(event.ownerId)?.id === t.id)))
        .map(t => {
          const resignedSuffix = t.employmentStatus === 'resigned' ? ' (퇴사)' : '';
          return `<option value="${t.id}" ${event && (event.ownerId === t.id || event.ownerId === t.name || stateStore.findTeacherByIdOrName(event.ownerId)?.id === t.id) ? "selected" : ""}>${t.name}${resignedSuffix}</option>`;
        })
    ].join("");

    // Visibility toggle state
    let isVisible = event ? !!event.visible : false;
    
    // Checked student IDs tracked in memory to survive filtering/searching
    const checkedIds = new Set(event ? event.participantStudentIds : []);

    drawerBody.innerHTML = `
      <div id="drawer-error-msg" style="display: none; padding: 8px 12px; margin-bottom: 12px; background: var(--red-soft); border: 1px solid #fecaca; border-radius: 6px; color: var(--red); font-size: 12.5px; font-weight: 850;"></div>
      
      <section class="drawer-section">
        <h3>기본 정보</h3>
        <div class="section-body" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 850; color: var(--muted);">일정명 <span style="color: var(--red)">*</span></label>
            <input id="form-event-name" type="text" placeholder="일정명을 입력하세요" value="${event ? event.name : ""}" style="width: 100%;" />
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; font-weight: 850; color: var(--muted);">구분 <span style="color: var(--red)">*</span></label>
              <select id="form-event-type" style="width: 100%;">
                <option value="">구분 선택</option>
                <option value="concours" ${event && event.type === "concours" ? "selected" : ""}>콩쿠르</option>
                <option value="exam" ${event && event.type === "exam" ? "selected" : ""}>입시</option>
                <option value="makeup" ${event && event.type === "makeup" ? "selected" : ""}>보강</option>
                <option value="event" ${event && event.type === "event" ? "selected" : ""}>행사</option>
                <option value="counsel" ${event && event.type === "counsel" ? "selected" : ""}>상담</option>
                <option value="etc" ${event && event.type === "etc" ? "selected" : ""}>기타</option>
              </select>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; font-weight: 850; color: var(--muted);">담당자 <span style="color: var(--red)">*</span></label>
              <select id="form-owner-id" style="width: 100%;">
                ${ownerOptions}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; font-weight: 850; color: var(--muted);">진행/종료일 <span style="color: var(--red)">*</span></label>
              <input id="form-event-date" type="date" value="${event ? event.eventDate : ""}" style="width: 100%;" />
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 11px; font-weight: 850; color: var(--muted);">접수마감일</label>
              <input id="form-due-date" type="date" value="${event ? event.dueDate || "" : ""}" style="width: 100%;" />
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 850; color: var(--muted);">장소</label>
            <input id="form-place" type="text" placeholder="장소를 입력하세요" value="${event ? event.place || "" : ""}" style="width: 100%;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 11px; font-weight: 850; color: var(--muted);">메모</label>
            <textarea id="form-memo" placeholder="메모를 입력하세요" style="width: 100%; min-height: 70px; border: 1px solid var(--line); border-radius: 7px; padding: 8px 10px; font-size: 13px; font-family: inherit; font-weight: 750; resize: vertical;">${event ? event.memo || "" : ""}</textarea>
          </div>
        </div>
      </section>

      <section class="drawer-section">
        <h3>공개 설정</h3>
        <div class="section-body" style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div>
            <div style="font-size: 13.5px; font-weight: 950; color: var(--ink);">학부모/원생 공개 여부</div>
            <div style="font-size: 11px; color: var(--muted); font-weight: 750; margin-top: 3px;">공개 설정 시 학부모/원생 화면에 일정이 노출됩니다.</div>
          </div>
          <button type="button" id="form-visible-toggle" class="btn" style="min-width: 170px; min-height: 36px; font-size: 12.5px; font-weight: 900; border-radius: 20px; transition: all 0.1s ease; border-color: ${isVisible ? "var(--green)" : "var(--line)"}; background: ${isVisible ? "var(--green-soft)" : "#f8fafc"}; color: ${isVisible ? "var(--green)" : "#475569"};">
            ${isVisible ? "학부모/원생 공개 ON" : "학부모/원생 공개 OFF"}
          </button>
        </div>
      </section>

      <section class="drawer-section">
        <h3 id="selected-participants-count">선택된 원생: ${checkedIds.size}명</h3>
        <div class="section-body">
          <input id="form-participant-search" type="text" placeholder="원생명, 회원번호, 초성 검색" style="width: 100%; margin-bottom: 8px; box-sizing: border-box;" />
          <div id="form-participants-list" style="max-height: 200px; overflow-y: auto; padding: 10px; border: 1px solid var(--line-2); border-radius: 7px; background: #fff;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </section>
    `;

    const checkboxesList = drawerBody.querySelector('#form-participants-list');
    const allStudents = getAdaptedStudents();

    // Checkboxes rendering with query filtering (including Chosung search)
    const renderCheckboxes = (query = "") => {
      const cleanQuery = query.trim().toLowerCase();
      const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(cleanQuery);

      const filteredStudents = allStudents.filter(student => {
        if (!cleanQuery) return true;
        const cleanName = student.name.toLowerCase();
        const cleanId = String(student.id).toLowerCase();
        const cleanMemberNo = student.memberNo ? String(student.memberNo).toLowerCase() : "";
        const cleanStudentMemberNo = student.studentMemberNo ? String(student.studentMemberNo).toLowerCase() : "";
        const cleanInstrument = student.instrument.toLowerCase();
        const cleanTeacher = student.teacher.toLowerCase();

        if (isChosungOnly) {
          return getChosungStr(cleanName).includes(cleanQuery) ||
                 getChosungStr(cleanInstrument).includes(cleanQuery) ||
                 getChosungStr(cleanTeacher).includes(cleanQuery);
        } else {
          return cleanName.includes(cleanQuery) ||
                 cleanId.includes(cleanQuery) ||
                 cleanMemberNo.includes(cleanQuery) ||
                 cleanStudentMemberNo.includes(cleanQuery) ||
                 cleanInstrument.includes(cleanQuery) ||
                 cleanTeacher.includes(cleanQuery);
        }
      });

      checkboxesList.innerHTML = filteredStudents.map(student => {
        const isChecked = checkedIds.has(student.id);
        return `
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--ink);">
            <input type="checkbox" name="participantStudentIds" value="${student.id}" ${isChecked ? "checked" : ""}>
            <span>${student.name} (${student.studentMemberNo || student.memberNo || student.id}) (${student.instrument}/${student.teacher})</span>
          </label>
        `;
      }).join("");
    };

    // Initial render of student checkboxes
    renderCheckboxes();

    // Filter list on search input (safe from IME composition breaks)
    const searchInput = drawerBody.querySelector('#form-participant-search');
    searchInput.addEventListener('input', (e) => {
      renderCheckboxes(e.target.value);
    });

    // Bind visible toggle event
    const toggleBtn = drawerBody.querySelector('#form-visible-toggle');
    toggleBtn.addEventListener('click', () => {
      if (!isVisible) {
        // Turning ON: confirm first
        const approve = confirm('학부모/원생에게 공개 상태로 저장할까요?');
        if (approve) {
          isVisible = true;
          toggleBtn.textContent = '학부모/원생 공개 ON';
          toggleBtn.style.borderColor = 'var(--green)';
          toggleBtn.style.background = 'var(--green-soft)';
          toggleBtn.style.color = 'var(--green)';
        }
      } else {
        // Turning OFF: direct toggle
        isVisible = false;
        toggleBtn.textContent = '학부모/원생 공개 OFF';
        toggleBtn.style.borderColor = 'var(--line)';
        toggleBtn.style.background = '#f8fafc';
        toggleBtn.style.color = '#475569';
      }
    });

    // Handle selected count updates and preserve state in memory
    const updateSelectedCount = () => {
      const countEl = drawerBody.querySelector('#selected-participants-count');
      if (countEl) {
        countEl.textContent = `선택된 원생: ${checkedIds.size}명`;
      }
    };

    checkboxesList.addEventListener('change', (e) => {
      if (e.target.name === 'participantStudentIds') {
        const studentId = e.target.value;
        if (e.target.checked) {
          checkedIds.add(studentId);
        } else {
          checkedIds.delete(studentId);
        }
        updateSelectedCount();
      }
    });

    drawerFooter.innerHTML = `
      <button id="btn-form-cancel" class="btn">취소</button>
      <button id="btn-form-save" class="btn primary">저장</button>
    `;

    const cancelBtn = drawerFooter.querySelector('#btn-form-cancel');
    const saveBtn = drawerFooter.querySelector('#btn-form-save');

    cancelBtn.addEventListener('click', () => {
      if (isEdit) {
        openEvent(event.id);
      } else {
        closeDrawer();
      }
    });

    saveBtn.addEventListener('click', () => {
      const errorMsgEl = drawerBody.querySelector('#drawer-error-msg');
      errorMsgEl.style.display = 'none';

      // Gather input values
      const name = drawerBody.querySelector('#form-event-name').value.trim();
      const type = drawerBody.querySelector('#form-event-type').value;
      const ownerId = drawerBody.querySelector('#form-owner-id').value;
      const eventDate = drawerBody.querySelector('#form-event-date').value;
      const dueDate = drawerBody.querySelector('#form-due-date').value || null;
      const place = drawerBody.querySelector('#form-place').value.trim() || null;
      const memo = drawerBody.querySelector('#form-memo').value.trim() || null;

      // Gather checked students from the Set directly (to include filtered out ones)
      const participantStudentIds = Array.from(checkedIds);

      // Validate required fields
      if (!name || !type || !ownerId || !eventDate) {
        errorMsgEl.textContent = '필수값을 모두 입력하세요 (일정명, 구분, 담당자, 진행/종료일)';
        errorMsgEl.style.display = 'block';
        drawerBody.scrollTop = 0;
        return;
      }

      const payload = {
        name,
        type,
        ownerId,
        eventDate,
        dueDate,
        place,
        memo,
        visible: isVisible,
        participantStudentIds
      };

      try {
        if (isEdit) {
          stateStore.updateMajorSchedule(event.id, payload);
        } else {
          stateStore.addMajorSchedule(payload);
        }
        closeDrawer();
        render(); // Re-render page
      } catch (err) {
        errorMsgEl.textContent = `저장 실패: ${err.message}`;
        errorMsgEl.style.display = 'block';
        drawerBody.scrollTop = 0;
      }
    });

    drawerFooter.classList.add('open');
    showDrawer();
  };

  const showDrawer = () => {
    const backdrop = container.querySelector('#drawerBackdrop');
    const drawer = container.querySelector('#drawer');
    const body = container.querySelector('#drawerBody');

    if (backdrop) backdrop.classList.add('open');
    if (drawer) drawer.classList.open = true;
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

    render();
  };

  render();

  return () => {
    // Clean up global header actions and restore defaults
    const dynamicActions = document.getElementById('major-schedule-global-header-actions');
    if (dynamicActions) {
        dynamicActions.remove();
    }
    if (settingsQuickBar) settingsQuickBar.style.display = '';
    if (currentDateEl) currentDateEl.style.display = '';
  };
}
