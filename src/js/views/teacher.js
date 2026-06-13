// teacher.js - Teacher Views for Turing Music Academy
import { stateStore } from '../state.js';
import { openModal, closeModal } from '../app.js';

// --- Global Helpers ---

// Helper: get current time in HH:MM format
const getCurrentTimeStr = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

// Helper: escape HTML string to prevent XSS and DOM breakage in data attributes
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper: get current teacher ID dynamically
function getCurrentTeacherId() {
    const user = stateStore.getCurrentUser();
    if (user && user.role === 'teacher') {
        const teacher = stateStore.getTeachers().find(t => t.phone === user.phone || t.name === user.name);
        if (teacher) return teacher.id;
    }
    return 'T1';
}

// Keep track of unsaved input changes in attendance tab to prevent loss of focus or data on re-render
// Key: `${studentId}_${selectedDate}`
const pendingAttendanceEdits = {};

/**
 * 1. Render Attendance View
 * Displays a list of students with filters: "오늘의 수업 원생" and "전체 원생".
 * Toggles for attendance state (출석/지각/결석/없음).
 * Defaults time to current time when marked present/late.
 * Provide notes field for today's lesson.
 * Triggers KakaoTalk notification alert automatically.
 */
export function renderAttendance(container) {
    let selectedDate = new Date().toISOString().slice(0, 10);
    let currentFilter = 'today'; // 'today' or 'all'

    // Initial outer container shell
    container.innerHTML = `
        <div class="attendance-view">
            <!-- Filter Bar -->
            <div class="filter-bar glass-card" style="margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 1.2rem;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button class="btn btn-filter" id="btn-filter-today">
                        <i class="fa-solid fa-calendar-day"></i> 오늘의 수업 원생
                    </button>
                    <button class="btn btn-filter" id="btn-filter-all">
                        <i class="fa-solid fa-users"></i> 전체 담당 원생
                    </button>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.9rem; color: var(--text-muted);">조회 일자:</span>
                    <input type="date" id="attendance-date" class="form-control" value="${selectedDate}" style="padding: 6px 12px; font-size: 0.9rem; width: 150px;">
                </div>
            </div>

            <!-- Students List Container -->
            <div id="attendance-list-container">
                <!-- Injected dynamically -->
            </div>
        </div>
    `;

    // DOM references
    const btnToday = container.querySelector('#btn-filter-today');
    const btnAll = container.querySelector('#btn-filter-all');
    const dateInput = container.querySelector('#attendance-date');
    const listContainer = container.querySelector('#attendance-list-container');

    const daysOfWeekKo = ['일', '월', '화', '수', '목', '금', '토'];

    // Update active filter button styles
    const updateFilterButtons = () => {
        if (currentFilter === 'today') {
            btnToday.className = 'btn btn-primary';
            btnAll.className = 'btn btn-secondary';
        } else {
            btnToday.className = 'btn btn-secondary';
            btnAll.className = 'btn btn-primary';
        }
    };

    // Main render list function
    const renderList = () => {
        updateFilterButtons();

        // Get all students assigned to T1 (default teacher)
        const t1Students = stateStore.getStudents().filter(s => s.teacherId === getCurrentTeacherId());
        let filteredStudents = [];

        if (currentFilter === 'today') {
            const dayOfWeek = daysOfWeekKo[new Date(selectedDate).getDay()];
            const classesToday = stateStore.getClasses().filter(c => c.dayOfWeek === dayOfWeek);
            const studentIdsToday = classesToday.map(c => c.studentId);
            filteredStudents = t1Students.filter(s => studentIdsToday.includes(s.id));
        } else {
            filteredStudents = t1Students;
        }

        if (filteredStudents.length === 0) {
            listContainer.innerHTML = `
                <div class="glass-card" style="text-align: center; padding: 4rem; color: var(--text-muted);">
                    <i class="fa-solid fa-clipboard-user" style="font-size: 3rem; margin-bottom: 1rem; color: var(--primary); opacity: 0.7;"></i>
                    <p style="font-size: 1.1rem; font-weight: 500;">조회된 원생이 없습니다.</p>
                    <p style="font-size: 0.85rem; margin-top: 4px; color: var(--text-muted);">조회 일자나 필터를 변경해 보세요.</p>
                </div>
            `;
            return;
        }

        const attendanceData = stateStore.getAttendance();

        listContainer.innerHTML = `
            <div class="students-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">
                ${filteredStudents.map(student => {
                    const record = attendanceData.find(a => a.studentId === student.id && a.date === selectedDate);
                    const dbStatus = record ? record.status : 'none';
                    const dbTime = record ? record.time : '';
                    const dbNote = record ? record.note : '';

                    // Retrieve pending edits if they exist for this key
                    const editKey = `${student.id}_${selectedDate}`;
                    const pending = pendingAttendanceEdits[editKey] || {};
                    const currentStatus = pending.status !== undefined ? pending.status : dbStatus;
                    const currentTime = pending.time !== undefined ? pending.time : dbTime;
                    const currentNote = pending.note !== undefined ? pending.note : dbNote;

                    const studentClasses = stateStore.getClassesForStudent(student.id);
                    const scheduleText = studentClasses.map(c => `${c.dayOfWeek} ${c.time}`).join(', ');

                    let badgeHtml = '';
                    const hasUnsavedChanges = pending.status !== undefined || pending.time !== undefined || pending.note !== undefined;
                    if (hasUnsavedChanges) {
                        badgeHtml = `<span class="badge badge-warning"><i class="fa-solid fa-pen"></i> 변경됨</span>`;
                    } else if (dbStatus !== 'none') {
                        badgeHtml = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> 저장됨</span>`;
                    } else {
                        badgeHtml = `<span class="badge badge-info" style="background: rgba(9, 132, 227, 0.04); color: var(--text-muted);"><i class="fa-solid fa-minus"></i> 기록 없음</span>`;
                    }

                    return `
                        <div class="glass-card student-attendance-card" data-student-id="${student.id}" style="display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
                            <div>
                                <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                                    <div>
                                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">
                                            ${student.name}
                                            <span style="font-size: 0.8rem; font-weight: 500; padding: 2px 8px; border-radius: 12px; background: var(--primary-light); color: var(--secondary); margin-left: 6px;">
                                                ${student.instrument}
                                            </span>
                                        </h3>
                                        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; display: flex; align-items: center; gap: 4px;">
                                            <i class="fa-regular fa-clock"></i> 수업 일정: ${scheduleText || '없음'}
                                        </p>
                                    </div>
                                    <div class="save-status-badge" data-db-status="${dbStatus}" data-db-time="${dbTime}" data-db-note="${escapeHtml(dbNote)}">
                                        ${badgeHtml}
                                    </div>
                                </div>

                                <!-- Attendance Toggles -->
                                <div class="status-btn-group" style="display: flex; gap: 4px; background: rgba(9, 132, 227, 0.04); padding: 4px; border-radius: var(--radius-md); margin-top: 16px;">
                                    <button type="button" class="status-btn btn-present ${currentStatus === 'present' ? 'active' : ''}" data-status="present" style="flex: 1; padding: 8px; font-size: 0.85rem; border: 1px solid transparent; background: transparent; color: var(--text-muted); border-radius: 10px; cursor: pointer; transition: var(--transition); font-weight: 600;">출석</button>
                                    <button type="button" class="status-btn btn-late ${currentStatus === 'late' ? 'active' : ''}" data-status="late" style="flex: 1; padding: 8px; font-size: 0.85rem; border: 1px solid transparent; background: transparent; color: var(--text-muted); border-radius: 10px; cursor: pointer; transition: var(--transition); font-weight: 600;">지각</button>
                                    <button type="button" class="status-btn btn-absent ${currentStatus === 'absent' ? 'active' : ''}" data-status="absent" style="flex: 1; padding: 8px; font-size: 0.85rem; border: 1px solid transparent; background: transparent; color: var(--text-muted); border-radius: 10px; cursor: pointer; transition: var(--transition); font-weight: 600;">결석</button>
                                    <button type="button" class="status-btn btn-none ${currentStatus === 'none' ? 'active' : ''}" data-status="none" style="flex: 1; padding: 8px; font-size: 0.85rem; border: 1px solid transparent; background: transparent; color: var(--text-muted); border-radius: 10px; cursor: pointer; transition: var(--transition); font-weight: 600;">없음</button>
                                </div>

                                <!-- Time Input -->
                                <div class="form-group" style="margin-top: 14px; margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
                                        <i class="fa-regular fa-clock"></i> 등원 시간
                                    </label>
                                    <input type="text" class="form-control time-input" value="${currentTime}" ${currentStatus === 'present' || currentStatus === 'late' ? '' : 'disabled'} placeholder="15:00" style="padding: 8px 12px; font-size: 0.9rem;">
                                </div>

                                <!-- Notes Input -->
                                <div class="form-group" style="margin-top: 14px; margin-bottom: 0;">
                                    <label style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-bottom: 6px;">
                                        <i class="fa-regular fa-comment-dots"></i> 수업일지 / 특이사항
                                    </label>
                                    <textarea class="form-control note-input" rows="2" placeholder="오늘 수업 피드백을 적어주세요." style="padding: 8px 12px; font-size: 0.9rem; resize: none; font-family: inherit;">${currentNote}</textarea>
                                </div>
                            </div>

                            <button type="button" class="btn btn-primary btn-save-attendance" style="width: 100%; justify-content: center; margin-top: 8px;">
                                <i class="fa-solid fa-floppy-disk"></i> 출결 저장
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Inject dynamic button styling into document if not already loaded
        if (!document.getElementById('attendance-toggle-styles')) {
            const styles = document.createElement('style');
            styles.id = 'attendance-toggle-styles';
            styles.innerHTML = `
                .status-btn-group .status-btn:hover {
                    background: rgba(9, 132, 227, 0.08);
                    color: var(--text-main);
                }
                .status-btn-group .status-btn.active.btn-present {
                    background: var(--success-light);
                    color: #00b894;
                    border-color: rgba(0, 184, 148, 0.3);
                }
                .status-btn-group .status-btn.active.btn-late {
                    background: var(--warning-light);
                    color: #d5a300;
                    border-color: rgba(241, 196, 15, 0.3);
                }
                .status-btn-group .status-btn.active.btn-absent {
                    background: var(--danger-light);
                    color: var(--danger);
                    border-color: rgba(214, 48, 49, 0.3);
                }
                .status-btn-group .status-btn.active.btn-none {
                    background: rgba(9, 132, 227, 0.08);
                    color: var(--text-muted);
                    border-color: var(--border-color);
                }
            `;
            document.head.appendChild(styles);
        }

        // Set up event listeners for each card's toggles, inputs, and buttons
        listContainer.querySelectorAll('.student-attendance-card').forEach(card => {
            const studentId = card.dataset.studentId;
            const editKey = `${studentId}_${selectedDate}`;
            const timeInput = card.querySelector('.time-input');
            const noteInput = card.querySelector('.note-input');
            const badgeEl = card.querySelector('.save-status-badge');
            
            const dbStatus = badgeEl.dataset.dbStatus;
            const dbTime = badgeEl.dataset.dbTime;
            const dbNote = badgeEl.dataset.dbNote;

            const updateSaveStatus = () => {
                const activeBtn = card.querySelector('.status-btn.active');
                const currentStatus = activeBtn ? activeBtn.dataset.status : 'none';
                const currentTime = timeInput.value.trim();
                const currentNote = noteInput.value.trim();

                const isChanged = currentStatus !== dbStatus || currentTime !== dbTime || currentNote !== dbNote;
                if (isChanged) {
                    pendingAttendanceEdits[editKey] = { status: currentStatus, time: currentTime, note: currentNote };
                    badgeEl.innerHTML = `<span class="badge badge-warning"><i class="fa-solid fa-pen"></i> 변경됨</span>`;
                } else {
                    delete pendingAttendanceEdits[editKey]; // Back in sync with DB
                    if (dbStatus !== 'none') {
                        badgeEl.innerHTML = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> 저장됨</span>`;
                    } else {
                        badgeEl.innerHTML = `<span class="badge badge-info" style="background: rgba(9, 132, 227, 0.04); color: var(--text-muted);"><i class="fa-solid fa-minus"></i> 기록 없음</span>`;
                    }
                }
            };

            // Status toggles
            card.querySelectorAll('.status-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    card.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const status = btn.dataset.status;
                    if (status === 'present' || status === 'late') {
                        timeInput.disabled = false;
                        if (!timeInput.value.trim()) {
                            timeInput.value = getCurrentTimeStr();
                        }
                    } else {
                        timeInput.value = '';
                        timeInput.disabled = true;
                    }
                    updateSaveStatus();
                });
            });

            // Input handlers
            timeInput.addEventListener('input', updateSaveStatus);
            noteInput.addEventListener('input', updateSaveStatus);

            // Save button click
            card.querySelector('.btn-save-attendance').addEventListener('click', () => {
                const activeBtn = card.querySelector('.status-btn.active');
                const status = activeBtn ? activeBtn.dataset.status : 'none';
                const time = timeInput.value.trim();
                const note = noteInput.value.trim();

                // Clear temporary edit history for this specific action
                delete pendingAttendanceEdits[editKey];

                // Write to database
                stateStore.markAttendance(studentId, selectedDate, status, time, note);
            });
        });
    };

    // Subscriptions
    const unsubscribeAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', renderList);
    const unsubscribeStudents = stateStore.subscribe('STUDENTS_CHANGED', renderList);
    const unsubscribeClasses = stateStore.subscribe('CLASSES_CHANGED', renderList);

    // Filter handlers
    const handleFilterTodayClick = () => {
        currentFilter = 'today';
        renderList();
    };
    const handleFilterAllClick = () => {
        currentFilter = 'all';
        renderList();
    };
    const handleDateChange = (e) => {
        selectedDate = e.target.value;
        renderList();
    };

    btnToday.addEventListener('click', handleFilterTodayClick);
    btnAll.addEventListener('click', handleFilterAllClick);
    dateInput.addEventListener('change', handleDateChange);

    // Initial render
    renderList();

    // Cleanup
    return () => {
        unsubscribeAttendance();
        unsubscribeStudents();
        unsubscribeClasses();
        btnToday.removeEventListener('click', handleFilterTodayClick);
        btnAll.removeEventListener('click', handleFilterAllClick);
        dateInput.removeEventListener('change', handleDateChange);
    };
}

/**
 * 2. Render Lessons View
 * Allows searching student lesson remarks.
 * Review previous remarks and write new detailed lesson reports for students, writing to student lesson history.
 */
export function renderLessons(container) {
    const currentTeacherId = getCurrentTeacherId();
    const currentTeacher = stateStore.getTeachers().find(t => t.id === currentTeacherId);
    const isResigned = currentTeacher && currentTeacher.employmentStatus === 'resigned';
    const t1Students = stateStore.getStudents().filter(s => s.teacherId === currentTeacherId);
    let selectedStudentId = t1Students.length > 0 ? t1Students[0].id : '';
    let searchQuery = '';

    // Helper to trigger kakaotalk-alert toast
    const showToast = (message) => {
        const event = new CustomEvent('kakaotalk-alert', { detail: { message } });
        window.dispatchEvent(event);
    };

    // Main layout shell
    container.innerHTML = `
        <div class="lessons-layout" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start;">
            <!-- Left Column: Writing Form & Book Issue Form -->
            <div style="display: flex; flex-direction: column; gap: 24px;">
                <!-- 수업일지 작성 -->
                <div class="glass-card">
                    <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i> 수업일지 작성
                    </h3>
                    <form id="lesson-form">
                        <div class="form-group">
                            <label for="student-select">원생 선택</label>
                            <select id="student-select" class="form-control">
                                ${t1Students.map(s => `<option value="${s.id}">${s.name} (${s.instrument})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="lesson-date">수업 일자</label>
                                <input type="date" id="lesson-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}">
                            </div>
                            <div class="form-group">
                                <label for="lesson-time">수업 시간</label>
                                <input type="text" id="lesson-time" class="form-control" placeholder="15:00" value="${getCurrentTimeStr()}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="lesson-status">수업 상태</label>
                            <select id="lesson-status" class="form-control">
                                <option value="present">출석</option>
                                <option value="late">지각</option>
                                <option value="absent">결석</option>
                                <option value="none">수업 없음 (취소)</option>
                            </select>
                        </div>
                        <div class="form-row" style="margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="lesson-video">📹 연주 동영상 첨부 (선택)</label>
                                <select id="lesson-video" class="form-control" style="margin-bottom: 0;">
                                    <option value="">동영상 첨부 안 함</option>
                                    <option value="/refer_0525.mp4">🎹 바이엘 1권 완곡 연주.mp4</option>
                                    <option value="/refer_0525.mp4">🎹 소나티네 3악장 연습 과정.mp4</option>
                                    <option value="/refer_0525.mp4">🎻 바이올린 기초 수업.mp4</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="lesson-photos">🖼️ 사진 첨부 (선택)</label>
                                <select id="lesson-photos" class="form-control" style="margin-bottom: 0;">
                                    <option value="0">사진 첨부 안 함</option>
                                    <option value="1">🖼️ 사진 1장</option>
                                    <option value="3">🖼️ 사진 3장</option>
                                    <option value="5">🖼️ 사진 5장</option>
                                    <option value="8">🖼️ 사진 8장 (최대)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="lesson-note">피드백 및 수업 내용</label>
                            <textarea id="lesson-note" class="form-control" rows="5" placeholder="수업 진행 사항, 연습 과제, 태도 등을 자세히 기록해주세요." style="resize: none;"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
                            <i class="fa-solid fa-floppy-disk"></i> 일지 저장하기
                        </button>
                    </form>
                </div>

                <!-- 교재 지급 등록 -->
                ${isResigned ? '' : `
                <div class="glass-card" id="book-issue-section">
                    <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-book" style="color: var(--primary);"></i> 교재 지급 등록
                    </h3>
                    <form id="book-issue-form">
                        <div class="form-group">
                            <label for="book-issue-student-select">원생 선택</label>
                            <select id="book-issue-student-select" class="form-control">
                                <!-- Will be populated dynamically -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="book-select">교재 선택</label>
                            <select id="book-select" class="form-control">
                                <!-- Will be populated dynamically -->
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="book-issue-memo">메모 (선택)</label>
                            <input type="text" id="book-issue-memo" class="form-control" placeholder="지급 사유나 관련 메모를 입력하세요." value="">
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
                            <i class="fa-solid fa-plus"></i> 교재 지급 등록
                        </button>
                    </form>
                </div>
                `}
            </div>

            <!-- Right Column: History Timeline -->
            <div class="glass-card">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
                    <h3 style="display: flex; align-items: center; gap: 8px; margin: 0;">
                        <i class="fa-solid fa-clock-rotate-left" style="color: var(--accent);"></i> 수업일지 히스토리
                    </h3>
                    <input type="text" id="history-search" class="form-control" placeholder="내용 검색..." style="width: 160px; padding: 6px 12px; font-size: 0.85rem;">
                </div>
                <div id="history-timeline" style="max-height: 480px; overflow-y: auto; padding-right: 8px; display: flex; flex-direction: column; gap: 12px;">
                    <!-- Timeline items will be injected here -->
                </div>
            </div>
        </div>
    `;

    // DOM references
    const form = container.querySelector('#lesson-form');
    const studentSelect = container.querySelector('#student-select');
    const lessonDateInput = container.querySelector('#lesson-date');
    const lessonTimeInput = container.querySelector('#lesson-time');
    const lessonStatusSelect = container.querySelector('#lesson-status');
    const lessonVideoSelect = container.querySelector('#lesson-video');
    const lessonPhotosSelect = container.querySelector('#lesson-photos');
    const lessonNoteTextarea = container.querySelector('#lesson-note');
    const historySearchInput = container.querySelector('#history-search');
    const historyTimeline = container.querySelector('#history-timeline');

    const bookIssueForm = container.querySelector('#book-issue-form');
    const bookIssueStudentSelect = container.querySelector('#book-issue-student-select');
    const bookSelect = container.querySelector('#book-select');
    const bookIssueMemoInput = container.querySelector('#book-issue-memo');

    // Populate dropdowns function
    const updateBookFormDropdowns = () => {
        const curTeacherId = getCurrentTeacherId();
        const currentTStudents = stateStore.getStudents().filter(s => s.teacherId === curTeacherId);
        const activeBooks = stateStore.getBooks().filter(b => b.status === 'active');

        if (bookIssueStudentSelect) {
            const submitBtn = bookIssueForm ? bookIssueForm.querySelector('button[type="submit"]') : null;
            if (currentTStudents.length === 0) {
                bookIssueStudentSelect.innerHTML = `<option value="">담당 원생이 없습니다.</option>`;
                bookIssueStudentSelect.disabled = true;
                if (submitBtn) submitBtn.disabled = true;
            } else {
                bookIssueStudentSelect.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
                const prevVal = bookIssueStudentSelect.value;
                bookIssueStudentSelect.innerHTML = currentTStudents.map(s => `<option value="${s.id}">${s.name} (${s.instrument})</option>`).join('');
                if (currentTStudents.some(s => s.id === prevVal)) {
                    bookIssueStudentSelect.value = prevVal;
                } else if (currentTStudents.length > 0) {
                    bookIssueStudentSelect.value = currentTStudents[0].id;
                }
            }
        }

        if (bookSelect) {
            const prevVal = bookSelect.value;
            bookSelect.innerHTML = `<option value="">교재를 선택하세요</option>` + activeBooks.map(b => `<option value="${b.id}">${b.name} (${b.price.toLocaleString()}원)</option>`).join('');
            if (activeBooks.some(b => b.id === prevVal)) {
                bookSelect.value = prevVal;
            } else {
                bookSelect.value = '';
            }
        }
    };

    // Sync default select value
    if (selectedStudentId) {
        studentSelect.value = selectedStudentId;
    }

    // Initial populate for book dropdowns
    updateBookFormDropdowns();

    // Function to render timeline history
    const renderTimeline = () => {
        const studentId = studentSelect.value;
        if (!studentId) {
            historyTimeline.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">선택된 원생이 없습니다.</div>`;
            return;
        }

        const query = searchQuery.toLowerCase().trim();
        const allAttendance = stateStore.getAttendance()
            .filter(a => a.studentId === studentId)
            .sort((a, b) => b.date.localeCompare(a.date)); // Sort newest first

        const filtered = allAttendance.filter(a => {
            const noteMatch = a.note && a.note.toLowerCase().includes(query);
            const dateMatch = a.date.includes(query);
            const statusMatch = (a.status === 'present' ? '출석' : a.status === 'late' ? '지각' : '결석').includes(query);
            return noteMatch || dateMatch || statusMatch;
        });

        if (filtered.length === 0) {
            historyTimeline.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 3rem;">
                    <i class="fa-regular fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; color: var(--text-muted);"></i>
                    작성된 수업일지가 없습니다.
                </div>
            `;
            return;
        }

        historyTimeline.innerHTML = filtered.map(item => {
            const statusKo = item.status === 'present' ? '출석' : item.status === 'late' ? '지각' : '결석';
            const statusClass = item.status === 'present' ? 'badge-success' : item.status === 'late' ? 'badge-warning' : 'badge-danger';
            const mediaHtml = [];
            if (item.videoUrl) {
                mediaHtml.push(`<span style="font-size: 0.75rem; color: var(--accent); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-video"></i> 동영상 1개</span>`);
            }
            if (item.images && item.images.length > 0) {
                mediaHtml.push(`<span style="font-size: 0.75rem; color: var(--primary); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-image"></i> 사진 ${item.images.length}장</span>`);
            }
            const mediaBar = mediaHtml.length > 0 ? `<div style="display: flex; gap: 12px; margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 8px;">${mediaHtml.join('')}</div>` : '';

            return `
                <div class="timeline-item glass-card" style="padding: 1.2rem; border-radius: var(--radius-md); background: #ffffff;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">${item.date} ${item.time ? `(${item.time})` : ''}</span>
                        <span class="badge ${statusClass}">${statusKo}</span>
                    </div>
                    <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-main); white-space: pre-wrap; margin-bottom: 10px;">${escapeHtml(item.note) || '(내용 없음)'}</p>
                    ${mediaBar}
                    <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                        <button type="button" class="btn btn-secondary btn-edit-log btn-icon-only" style="width: 32px; height: 32px; font-size: 0.8rem;" 
                            data-date="${item.date}" 
                            data-time="${item.time || ''}" 
                            data-status="${item.status}" 
                            data-note="${escapeHtml(item.note || '')}" 
                            data-video="${item.videoUrl || ''}"
                            data-photos="${item.images ? item.images.length : 0}"
                            title="수정">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Subscriptions
    const unsubscribeAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', renderTimeline);
    const unsubscribeStudents = stateStore.subscribe('STUDENTS_CHANGED', () => {
        const curTeacherId = getCurrentTeacherId();
        const currentTStudents = stateStore.getStudents().filter(s => s.teacherId === curTeacherId);
        const prevValue = studentSelect.value;
        
        studentSelect.innerHTML = currentTStudents.map(s => `<option value="${s.id}">${s.name} (${s.instrument})</option>`).join('');
        
        if (currentTStudents.some(s => s.id === prevValue)) {
            studentSelect.value = prevValue;
        } else if (currentTStudents.length > 0) {
            studentSelect.value = currentTStudents[0].id;
        }
        
        updateBookFormDropdowns();
        renderTimeline();
    });
    const unsubscribeBooks = stateStore.subscribe('BOOKS_CHANGED', updateBookFormDropdowns);

    // Action handlers
    const handleStudentChange = () => {
        selectedStudentId = studentSelect.value;
        renderTimeline();
    };

    const handleSearchInput = (e) => {
        searchQuery = e.target.value;
        renderTimeline();
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const studentId = studentSelect.value;
        if (!studentId) return;

        const date = lessonDateInput.value;
        const time = lessonTimeInput.value;
        const status = lessonStatusSelect.value;
        const note = lessonNoteTextarea.value;
        const videoUrl = lessonVideoSelect.value;
        
        // Generate simulated mock image URLs
        const photoCount = parseInt(lessonPhotosSelect.value) || 0;
        const images = [];
        for (let i = 1; i <= photoCount; i++) {
            images.push(`https://picsum.photos/400/300?random=${studentId}_${Date.now()}_${i}`);
        }

        // Submit to database
        stateStore.markAttendance(studentId, date, status, time, note, videoUrl, images);
        
        // Reset notes, video, photos and reset default time
        lessonNoteTextarea.value = '';
        lessonVideoSelect.value = '';
        lessonPhotosSelect.value = '0';
        lessonTimeInput.value = getCurrentTimeStr();
    };

    const handleTimelineClick = (e) => {
        const editBtn = e.target.closest('.btn-edit-log');
        if (editBtn) {
            const date = editBtn.dataset.date;
            const time = editBtn.dataset.time;
            const status = editBtn.dataset.status;
            const note = editBtn.dataset.note;
            const video = editBtn.dataset.video || '';
            const photoCount = editBtn.dataset.photos || '0';

            lessonDateInput.value = date;
            lessonTimeInput.value = time;
            lessonStatusSelect.value = status;
            lessonNoteTextarea.value = note;
            lessonVideoSelect.value = video;
            lessonPhotosSelect.value = photoCount;

            lessonNoteTextarea.focus();
        }
    };

    const handleBookIssueSubmit = (e) => {
        e.preventDefault();
        const studentId = bookIssueStudentSelect.value;
        const bookId = bookSelect.value;
        const memo = bookIssueMemoInput.value.trim();

        if (!studentId) {
            showToast('원생을 선택해주세요.');
            return;
        }
        if (!bookId) {
            showToast('교재를 선택해주세요.');
            return;
        }

        const student = stateStore.getStudent(studentId);
        const book = stateStore.getBook(bookId);
        if (!student || !book) {
            showToast('원생 또는 교재 정보를 찾을 수 없습니다.');
            return;
        }

        const confirmed = confirm(`[${student.name}] 원생에게 [${book.name}] 교재 지급 요청을 등록하시겠습니까?`);
        if (!confirmed) return;

        try {
            const curTeacherId = getCurrentTeacherId();
            stateStore.addBookIssueRequest({
                teacherId: curTeacherId,
                studentId: studentId,
                bookId: bookId,
                bookNameSnapshot: book.name,
                amountSnapshot: book.price,
                status: 'requested',
                requestedAt: new Date().toISOString().slice(0, 10),
                memo: memo,
                paymentId: null,
                studentBookId: null
            });

            showToast(`${student.name} 원생에게 ${book.name} 교재 지급 요청이 등록되었습니다.`);
            
            // Reset fields
            bookSelect.value = '';
            bookIssueMemoInput.value = '';
        } catch (err) {
            showToast(err.message);
        }
    };

    // Attach listeners
    studentSelect.addEventListener('change', handleStudentChange);
    historySearchInput.addEventListener('input', handleSearchInput);
    form.addEventListener('submit', handleFormSubmit);
    historyTimeline.addEventListener('click', handleTimelineClick);
    if (bookIssueForm) {
        bookIssueForm.addEventListener('submit', handleBookIssueSubmit);
    }

    // Initial render
    renderTimeline();

    // Cleanup
    return () => {
        unsubscribeAttendance();
        unsubscribeStudents();
        unsubscribeBooks();
        studentSelect.removeEventListener('change', handleStudentChange);
        historySearchInput.removeEventListener('input', handleSearchInput);
        form.removeEventListener('submit', handleFormSubmit);
        historyTimeline.removeEventListener('click', handleTimelineClick);
        if (bookIssueForm) {
            bookIssueForm.removeEventListener('submit', handleBookIssueSubmit);
        }
    };
}

/**
 * 3. Render Schedule View
 * Displays a grid view of the weekly schedule (Mon-Fri) for the logged-in teacher (T1 by default).
 * Mark time blocks (e.g. 13:00 to 20:00) showing student lesson hours.
 */
export function renderSchedule(container) {
    const updateSchedule = () => {
        // Find teacher T1 students and classes
        const t1Students = stateStore.getStudents().filter(s => s.teacherId === getCurrentTeacherId());
        const t1StudentIds = t1Students.map(s => s.id);
        const t1Classes = stateStore.getClasses().filter(c => t1StudentIds.includes(c.studentId));

        const hours = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
        const days = ['월', '화', '수', '목', '금'];

        let rowsHtml = '';
        hours.forEach(hour => {
            rowsHtml += `<tr>`;
            rowsHtml += `<td style="font-weight: 600; color: var(--text-muted); text-align: center; border-right: 1px solid var(--border-color);">${hour}</td>`;
            days.forEach(day => {
                const cellClasses = t1Classes.filter(c => c.dayOfWeek === day && c.time === hour);
                rowsHtml += `<td style="padding: 10px; position: relative; height: 85px; vertical-align: middle; border-right: 1px solid var(--border-color);">`;
                
                if (cellClasses.length > 0) {
                    cellClasses.forEach(c => {
                        const student = t1Students.find(s => s.id === c.studentId);
                        if (student) {
                            rowsHtml += `
                                <div class="schedule-block" data-student-id="${student.id}" style="
                                    background: var(--primary-light);
                                    border: 1px solid var(--primary);
                                    color: var(--text-main);
                                    border-radius: var(--radius-sm);
                                    padding: 8px;
                                    font-size: 0.85rem;
                                    cursor: pointer;
                                    transition: var(--transition);
                                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                                    text-align: center;
                                ">
                                    <div style="font-weight: bold;">${student.name}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${student.instrument}</div>
                                </div>
                            `;
                        }
                    });
                } else {
                    rowsHtml += `<span style="color: var(--text-muted); opacity: 0.2; font-size: 0.8rem;">-</span>`;
                }
                rowsHtml += `</td>`;
            });
            rowsHtml += `</tr>`;
        });

        container.innerHTML = `
            <div class="glass-card" style="margin-top: 1rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
                    <h3 style="display: flex; align-items: center; gap: 8px; margin: 0;">
                        <i class="fa-solid fa-calendar-days" style="color: var(--primary);"></i> 주간 수업 시간표
                    </h3>
                    <span class="badge badge-info" style="font-size: 0.8rem;"><i class="fa-solid fa-circle-info"></i> 수업 카드를 클릭하면 원생 상세 정보를 조회합니다.</span>
                </div>
                <div class="table-wrapper">
                    <table class="custom-table schedule-table" style="table-layout: fixed; width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 100px; text-align: center;">시간</th>
                                <th style="text-align: center;">월요일 (Mon)</th>
                                <th style="text-align: center;">화요일 (Tue)</th>
                                <th style="text-align: center;">수요일 (Wed)</th>
                                <th style="text-align: center;">목요일 (Thu)</th>
                                <th style="text-align: center;">금요일 (Fri)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Inject dynamic hover styles if not already present
        if (!document.getElementById('schedule-block-styles')) {
            const styles = document.createElement('style');
            styles.id = 'schedule-block-styles';
            styles.innerHTML = `
                .schedule-block:hover {
                    background: var(--primary) !important;
                    border-color: var(--secondary) !important;
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-glow);
                }
            `;
            document.head.appendChild(styles);
        }
    };

    // Subscriptions
    const unsubscribeStudents = stateStore.subscribe('STUDENTS_CHANGED', updateSchedule);
    const unsubscribeClasses = stateStore.subscribe('CLASSES_CHANGED', updateSchedule);

    // Handle schedule block clicks to show modal details
    const handleBlockClick = (e) => {
        const block = e.target.closest('.schedule-block');
        if (block) {
            const studentId = block.dataset.studentId;
            const student = stateStore.getStudent(studentId);
            if (student) {
                showStudentDetailsModal(student);
            }
        }
    };
    container.addEventListener('click', handleBlockClick);

    // Initial render
    updateSchedule();

    // Cleanup
    return () => {
        unsubscribeStudents();
        unsubscribeClasses();
        container.removeEventListener('click', handleBlockClick);
    };
}

// Private helper to show student details in modal
function showStudentDetailsModal(student) {
    const htmlContent = `
        <div class="modal-header">
            <h3 class="modal-title">${student.name} 원생 상세 정보</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" style="color: var(--text-main); padding-top: 10px;">
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">원생 이름</span>
                    <strong style="font-size: 0.95rem;">${student.name}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">수강 악기</span>
                    <strong style="font-size: 0.95rem; color: var(--accent);">${student.instrument}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">원생 연락처</span>
                    <strong style="font-size: 0.95rem;">${student.phone || '등록 없음'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">학부모 연락처</span>
                    <strong style="font-size: 0.95rem;">${student.parentPhone || '등록 없음'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">등록 일자</span>
                    <strong style="font-size: 0.95rem;">${student.enrollDate}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.9rem;">수강료 / 납부일</span>
                    <strong style="font-size: 0.95rem;">${student.fee.toLocaleString()}원 (매월 ${student.dueDay}일)</strong>
                </div>
            </div>
        </div>
        <div class="modal-footer" style="margin-top: 1.5rem;">
            <button class="btn btn-secondary" data-close-modal>닫기</button>
        </div>
    `;
    openModal(htmlContent);
}
