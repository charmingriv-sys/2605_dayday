import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { formatPhoneNumber, showKakaoTalkToast, showLocalConfirm } from './shared.js';

// --- PRINT AUTOMATION HELPER FUNCTIONS ---
/**
 * 6. 원장 출결 종합 관리 (renderDirectorAttendance)
 * Renders date-based and range-based student attendance records.
 * Supports date picker for historical records and date range filtering for individual students.
 */
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

export function renderDirectorAttendance(container) {
    let activeSubTab = 'daily'; // 'daily' or 'student'
    
    // Daily tab state
    let selectedDailyDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    // Student tab state
    let selectedStudentId = '';
    
    // Date range: default from 30 days ago to today
    const todayObj = new Date();
    const thirtyDaysAgoObj = new Date();
    thirtyDaysAgoObj.setDate(todayObj.getDate() - 30);
    
    let filterStartDate = thirtyDaysAgoObj.toISOString().slice(0, 10);
    let filterEndDate = todayObj.toISOString().slice(0, 10);
    
    const render = () => {
        const students = stateStore.getStudents().sort((a, b) => a.name.localeCompare(b.name));
        const teachers = stateStore.getTeachers();
        const classes = stateStore.getClasses();
        const attendance = stateStore.getAttendance();
        
        // If student tab and selectedStudentId is empty, set to first student in the list as default
        if (students.length > 0 && !selectedStudentId) {
            selectedStudentId = students[0].id;
        }
        
        // Daily Attendance Data Processing
        const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
        const targetDateObj = new Date(selectedDailyDate);
        const dayOfWeekKo = daysKo[targetDateObj.getDay()];
        
        // Find classes that are scheduled on the selected day's dayOfWeek
        const dailyClasses = classes
            .filter(c => c.dayOfWeek === dayOfWeekKo)
            .map(c => {
                const s = students.find(stud => stud.id === c.studentId);
                const t = s ? teachers.find(teach => teach.id === s.teacherId) : null;
                const att = s ? attendance.find(a => a.studentId === s.id && a.date === selectedDailyDate) : null;
                return { ...c, student: s, teacher: t, attendance: att };
            })
            .filter(c => c.student)
            .sort((a, b) => a.time.localeCompare(b.time));
            
        // Student Attendance Data Processing
        let studentStats = { total: 0, present: 0, late: 0, absent: 0, pending: 0, rate: 0 };
        let studentAttendanceList = [];
        
        if (selectedStudentId) {
            const currentStudent = students.find(s => s.id === selectedStudentId);
            
            // Loop through all dates from startDate to endDate
            let start = new Date(filterStartDate);
            let end = new Date(filterEndDate);
            let dateCursor = new Date(start);
            
            // Get classes assigned to this student
            const studentClasses = classes.filter(c => c.studentId === selectedStudentId);
            const classDays = studentClasses.map(c => c.dayOfWeek); // e.g. ['월', '수']
            
            while (dateCursor <= end) {
                const dateStr = dateCursor.toISOString().slice(0, 10);
                const cursorDayKo = daysKo[dateCursor.getDay()];
                
                // If the student has a class on this day of the week
                if (classDays.includes(cursorDayKo)) {
                    // Find if there is an attendance record
                    const attRecord = attendance.find(a => a.studentId === selectedStudentId && a.date === dateStr);
                    const classInfo = studentClasses.find(c => c.dayOfWeek === cursorDayKo);
                    const teacher = currentStudent ? teachers.find(t => t.id === currentStudent.teacherId) : null;
                    
                    let status = 'pending';
                    let time = '';
                    let note = '';
                    
                    if (attRecord) {
                        status = attRecord.status; // 'present', 'late', 'absent'
                        time = attRecord.time || '';
                        note = attRecord.note || '';
                    }
                    
                    studentAttendanceList.push({
                        date: dateStr,
                        dayOfWeek: cursorDayKo,
                        time: classInfo ? classInfo.time : '',
                        teacherName: teacher ? teacher.name : '미지정',
                        status: status,
                        checkTime: time,
                        note: note
                    });
                    
                    studentStats.total++;
                    if (status === 'present') studentStats.present++;
                    else if (status === 'late') studentStats.late++;
                    else if (status === 'absent') studentStats.absent++;
                    else if (status === 'pending') studentStats.pending++;
                }
                
                dateCursor.setDate(dateCursor.getDate() + 1);
            }
            
            // Sort attendance list descending (newest first)
            studentAttendanceList.sort((a, b) => b.date.localeCompare(a.date));
            
            // Compute attendance rate (present + late) / total
            const attendedCount = studentStats.present + studentStats.late;
            studentStats.rate = studentStats.total > 0 ? Math.round((attendedCount / studentStats.total) * 100) : 0;
        }

        // Layout template
        container.innerHTML = `
            <div class="glass-card" style="padding: 1.5rem; margin-bottom: 24px;">
                <!-- Sub Tab Navigation -->
                <div style="display: flex; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 20px;">
                    <button class="btn ${activeSubTab === 'daily' ? 'btn-primary' : 'btn-none'}" id="tab-btn-daily" style="font-weight: 600;">
                        <i class="fa-solid fa-calendar-day" style="margin-right: 6px;"></i>일자별 출결 조회
                    </button>
                    <button class="btn ${activeSubTab === 'student' ? 'btn-primary' : 'btn-none'}" id="tab-btn-student" style="font-weight: 600;">
                        <i class="fa-solid fa-user-graduate" style="margin-right: 6px;"></i>원생별 출결 조회
                    </button>
                </div>
                
                <!-- Tab Content 1: Daily Attendance -->
                <div id="subtab-content-daily" style="display: ${activeSubTab === 'daily' ? 'block' : 'none'};">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <label for="daily-date-picker" style="font-weight: 600; font-size: 0.95rem; color: var(--text-muted);">조회 일자 선택:</label>
                            <input type="date" id="daily-date-picker" value="${selectedDailyDate}" class="form-control" style="width: 180px; padding: 8px 12px;">
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">
                            선택일 요일: <span style="color: var(--primary); font-weight: 700;">${dayOfWeekKo}요일</span> | 총 수업 예정: <span style="color: var(--accent); font-weight: 700;">${dailyClasses.length}건</span>
                        </div>
                    </div>
                    
                    <div class="table-wrapper">
                        ${
                            dailyClasses.length === 0
                                ? `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">선택하신 날짜(${selectedDailyDate}, ${dayOfWeekKo}요일)에는 예정된 수업이 없습니다.</div>`
                                : `
                                <table class="custom-table">
                                    <thead>
                                        <tr>
                                            <th>수업 시간</th>
                                            <th>원생 (악기)</th>
                                            <th>담당 강사</th>
                                            <th>출결 상태</th>
                                            <th>등원 시각</th>
                                            <th>특이사항 / 사유</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${dailyClasses.map(c => {
                                            let statusBadge = `<span class="badge badge-info">수업 대기</span>`;
                                            let timeText = '-';
                                            let noteText = c.attendance && c.attendance.note ? c.attendance.note : '-';
                                            
                                            if (c.attendance) {
                                                if (c.attendance.status === 'present') {
                                                    statusBadge = `<span class="badge badge-success">등원</span>`;
                                                    timeText = c.attendance.time || '-';
                                                } else if (c.attendance.status === 'late') {
                                                    statusBadge = `<span class="badge badge-warning">지각</span>`;
                                                    timeText = c.attendance.time || '-';
                                                } else if (c.attendance.status === 'absent') {
                                                    statusBadge = `<span class="badge badge-danger">결석</span>`;
                                                    timeText = '-';
                                                }
                                            }
                                            return `
                                                <tr data-testid="attendance-row-${c.student.id}">
                                                    <td style="font-weight: 600; color: var(--accent);">${c.time}</td>
                                                    <td style="font-weight: 600;">${c.student.name} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${c.student.instrument})</span></td>
                                                    <td>${c.teacher ? c.teacher.name : '미지정'}</td>
                                                    <td data-testid="attendance-status-badge-${c.student.id}" data-status="${c.attendance ? c.attendance.status : 'pending'}">${statusBadge}</td>
                                                    <td style="font-weight: 500;">${timeText}</td>
                                                    <td style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${noteText}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                                `
                        }
                    </div>
                </div>
                
                <!-- Tab Content 2: Student-based Period Attendance -->
                <div id="subtab-content-student" style="display: ${activeSubTab === 'student' ? 'block' : 'none'};">
                    <!-- Filters Grid -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 1.5rem; align-items: flex-end;">
                        <div>
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">원생 선택</label>
                            <div class="custom-dropdown" id="student-selector-dropdown" style="position: relative; width: 100%;">
                                <div class="custom-dropdown-trigger form-control" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; height: 38px; background: rgba(0,0,0,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                                    <span id="selected-student-display">${(() => {
                                        const selected = students.find(s => s.id === selectedStudentId);
                                        return selected ? `${selected.name} (${selected.instrument})` : '원생을 선택하세요';
                                    })()}</span>
                                    <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; color: var(--text-muted);"></i>
                                </div>
                                <div class="custom-dropdown-menu glass-card" style="display: none; position: absolute; top: 105%; left: 0; width: 100%; z-index: 1000; padding: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); max-height: 250px; overflow-y: auto; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); flex-direction: column; gap: 4px;">
                                    <div style="position: relative; width: 100%; margin-bottom: 8px;">
                                        <input type="text" id="student-search-input" placeholder="원생명 검색 (초성 지원)" class="form-control" style="padding: 6px 10px; padding-left: 30px; font-size: 0.85rem; height: 34px; margin-bottom: 0;">
                                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.75rem;"></i>
                                    </div>
                                    <div id="student-options-list" style="display: flex; flex-direction: column; gap: 2px;">
                                        <!-- Loaded dynamically -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label for="start-date-picker" style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">조회 시작일</label>
                            <input type="date" id="start-date-picker" value="${filterStartDate}" class="form-control" style="width: 100%; padding: 8px 12px;">
                        </div>
                        <div>
                            <label for="end-date-picker" style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">조회 종료일</label>
                            <input type="date" id="end-date-picker" value="${filterEndDate}" class="form-control" style="width: 100%; padding: 8px 12px;">
                        </div>
                    </div>
                    
                    ${
                        !selectedStudentId 
                            ? `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">원생을 선택해주세요.</div>`
                            : `
                            <!-- Stats Cards -->
                            <div class="metrics-grid" style="margin-bottom: 20px;">
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon purple" style="width: 36px; height: 36px; font-size: 0.95rem;">
                                        <i class="fa-solid fa-list-ol"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">총 수업 일수</span>
                                        <span class="metric-value" style="font-size: 1.1rem;">${studentStats.total}회</span>
                                    </div>
                                </div>
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon green" style="width: 36px; height: 36px; font-size: 0.95rem;">
                                        <i class="fa-solid fa-circle-check"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">출석률 (등원+지각)</span>
                                        <span class="metric-value" style="font-size: 1.1rem; color: var(--success);">${studentStats.rate}%</span>
                                    </div>
                                </div>
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon yellow" style="width: 36px; height: 36px; font-size: 0.95rem; background: rgba(241, 196, 15, 0.15); color: var(--warning);">
                                        <i class="fa-solid fa-clock"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">지각 횟수</span>
                                        <span class="metric-value" style="font-size: 1.1rem; color: var(--warning);">${studentStats.late}회</span>
                                    </div>
                                </div>
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon red" style="width: 36px; height: 36px; font-size: 0.95rem;">
                                        <i class="fa-solid fa-circle-xmark"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">결석 / 수업대기</span>
                                        <span class="metric-value" style="font-size: 1.1rem; color: var(--danger);">${studentStats.absent} / ${studentStats.pending}회</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Detailed History Table -->
                            <div class="table-wrapper">
                                ${
                                    studentAttendanceList.length === 0
                                        ? `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">지정된 기간 동안의 예정된 수업이 없습니다.</div>`
                                        : `
                                        <table class="custom-table">
                                            <thead>
                                                <tr>
                                                    <th>일자 (요일)</th>
                                                    <th>수업 시간</th>
                                                    <th>담당 강사</th>
                                                    <th>출결 상태</th>
                                                    <th>등원 시각</th>
                                                    <th>상세 사유 / 비고</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${studentAttendanceList.map(item => {
                                                    let badge = `<span class="badge badge-info" data-testid="attendance-history-status" data-status="pending">수업 대기</span>`;
                                                    let timeText = '-';
                                                    if (item.status === 'present') {
                                                        badge = `<span class="badge badge-success" data-testid="attendance-history-status" data-status="present">등원</span>`;
                                                        timeText = item.checkTime;
                                                    } else if (item.status === 'late') {
                                                        badge = `<span class="badge badge-warning" data-testid="attendance-history-status" data-status="late">지각</span>`;
                                                        timeText = item.checkTime;
                                                    } else if (item.status === 'absent') {
                                                        badge = `<span class="badge badge-danger" data-testid="attendance-history-status" data-status="absent">결석</span>`;
                                                    }
                                                    
                                                    return `
                                                        <tr data-testid="attendance-history-row" data-date="${item.date}">
                                                            <td style="font-weight: 600;">${item.date} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${item.dayOfWeek})</span></td>
                                                            <td style="font-weight: 600; color: var(--accent);">${item.time}</td>
                                                            <td>${item.teacherName}</td>
                                                            <td>${badge}</td>
                                                            <td style="font-weight: 500;">${timeText}</td>
                                                            <td style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${item.note || '-'}</td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                        `
                                }
                            </div>
                            `
                    }
                </div>
            </div>
        `;
        
        // Add event listeners
        const btnDaily = container.querySelector('#tab-btn-daily');
        const btnStudent = container.querySelector('#tab-btn-student');
        
        if (btnDaily) {
            btnDaily.addEventListener('click', () => {
                activeSubTab = 'daily';
                render();
            });
        }
        
        if (btnStudent) {
            btnStudent.addEventListener('click', () => {
                activeSubTab = 'student';
                render();
            });
        }
        
        const dailyDatePicker = container.querySelector('#daily-date-picker');
        if (dailyDatePicker) {
            dailyDatePicker.addEventListener('change', (e) => {
                selectedDailyDate = e.target.value;
                render();
            });
        }
        
        const trigger = container.querySelector('.custom-dropdown-trigger');
        const menu = container.querySelector('.custom-dropdown-menu');
        const searchInput = container.querySelector('#student-search-input');
        const optionsList = container.querySelector('#student-options-list');

        const filterOptions = (query) => {
            const cleanQuery = query.replace(/\s+/g, '').toLowerCase();
            const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(cleanQuery);
            const filtered = students.filter(s => {
                const cleanName = s.name.replace(/\s+/g, '').toLowerCase();
                if (isChosungOnly) {
                    return getChosungStr(cleanName).includes(cleanQuery);
                }
                return cleanName.includes(cleanQuery);
            });

            if (filtered.length === 0) {
                optionsList.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 0.85rem; font-style: italic;">일치하는 원생이 없습니다.</div>`;
            } else {
                optionsList.innerHTML = filtered.map(s => `
                    <div class="student-option-item ${s.id === selectedStudentId ? 'active' : ''}" data-id="${s.id}" style="padding: 8px 10px; cursor: pointer; border-radius: var(--radius-sm); font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center; color: var(--text-main); transition: background 0.2s;">
                        <span>${s.name} (${s.instrument})</span>
                        ${s.id === selectedStudentId ? '<i class="fa-solid fa-check" style="color: var(--primary); font-size: 0.8rem;"></i>' : ''}
                    </div>
                `).join('');

                optionsList.querySelectorAll('.student-option-item').forEach(item => {
                    item.addEventListener('click', () => {
                        selectedStudentId = item.dataset.id;
                        menu.style.display = 'none';
                        render();
                    });
                });
            }
        };

        if (trigger && menu) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = menu.style.display === 'flex';
                menu.style.display = isVisible ? 'none' : 'flex';
                if (!isVisible) {
                    if (searchInput) {
                        searchInput.value = '';
                        filterOptions('');
                    }
                    setTimeout(() => { if (searchInput) searchInput.focus(); }, 50);
                }
            });

            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && !trigger.contains(e.target)) {
                    menu.style.display = 'none';
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterOptions(e.target.value.trim());
            });
            searchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        const startDatePicker = container.querySelector('#start-date-picker');
        if (startDatePicker) {
            startDatePicker.addEventListener('change', (e) => {
                filterStartDate = e.target.value;
                render();
            });
        }
        
        const endDatePicker = container.querySelector('#end-date-picker');
        if (endDatePicker) {
            endDatePicker.addEventListener('change', (e) => {
                filterEndDate = e.target.value;
                render();
            });
        }
    };
    
    render();
    
    // Subscribe to state stores
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', render);
    const unsubClasses = stateStore.subscribe('CLASSES_CHANGED', render);
    const unsubAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', render);
    
    return () => {
        unsubStudents();
        unsubTeachers();
        unsubClasses();
        unsubAttendance();
    };
}

/**
 * 7. 태블릿 출결 키오스크 (renderKioskAttendance)
 * Renders a full-screen kiosk interface for student check-in/out.
 * Students enter their phone digits to search, select their names,
 * and choose between check-in (등원) or check-out (하원).
 */
export function renderKioskAttendance(container) {
    let activeStep = 'keypad'; // 'keypad', 'select-student', 'select-status', 'complete', 'admin-auth'
    let inputDigits = '';
    let adminAuthDigits = ''; // For admin pass authorization
    let matchedStudents = [];
    let selectedStudent = null;
    let completeStatus = ''; // 'in' or 'out'
    let autoResetTimeout = null;

    const getKioskPassword = () => {
        const currentUser = stateStore.getCurrentUser();
        if (currentUser && currentUser.academyId) {
            const acad = stateStore.getAcademy(currentUser.academyId);
            if (acad && acad.tabletPassword) {
                return acad.tabletPassword;
            }
        }
        return '6990'; // Default fallback PIN
    };

    // Reset Kiosk state to keypad
    const resetKiosk = () => {
        if (autoResetTimeout) {
            clearTimeout(autoResetTimeout);
            autoResetTimeout = null;
        }
        activeStep = 'keypad';
        inputDigits = '';
        adminAuthDigits = '';
        matchedStudents = [];
        selectedStudent = null;
        completeStatus = '';
        render();
    };

    // Global Keydown Handler for physical keyboards
    const handlePhysicalKeydown = (e) => {
        if (activeStep !== 'keypad' && activeStep !== 'admin-auth') return;

        if (e.key >= '0' && e.key <= '9') {
            handleKeyPress(e.key);
        } else if (e.key === 'Backspace') {
            handleKeyPress('back');
        } else if (e.key === 'Escape') {
            handleKeyPress('clear');
        }
    };

    const handleKeyPress = (key) => {
        if (activeStep === 'admin-auth') {
            handleAdminAuthKeyPress(key);
            return;
        }

        if (key === 'clear') {
            inputDigits = '';
        } else if (key === 'back') {
            inputDigits = inputDigits.slice(0, -1);
        } else if (inputDigits.length < 4) {
            inputDigits += key;
            
            // Check matching when exactly 4 digits entered
            if (inputDigits.length === 4) {
                const students = stateStore.getStudents();
                const matched = students.filter(s => {
                    const parentLast4 = s.parentPhone ? s.parentPhone.replace(/[^0-9]/g, '').slice(-4) : '';
                    const studentLast4 = s.phone ? s.phone.replace(/[^0-9]/g, '').slice(-4) : '';
                    return parentLast4 === inputDigits || studentLast4 === inputDigits;
                });

                if (matched.length > 0) {
                    matchedStudents = matched;
                    // Auto transition to student selection
                    setTimeout(() => {
                        activeStep = 'select-student';
                        render();
                    }, 200);
                } else {
                    // No match found
                    const displayMsg = container.querySelector('#kiosk-message-banner');
                    if (displayMsg) {
                        displayMsg.textContent = '일치하는 원생이 없습니다. 번호를 다시 확인해주세요.';
                        displayMsg.style.color = 'var(--danger)';
                    }
                    // Shake effect on keypad dots
                    const dots = container.querySelectorAll('.kiosk-pin-dot');
                    dots.forEach(d => {
                        d.style.borderColor = 'var(--danger)';
                        d.style.boxShadow = '0 0 12px rgba(214, 48, 49, 0.4)';
                    });
                    setTimeout(() => {
                        inputDigits = '';
                        render();
                    }, 1200);
                }
            }
        }
        render();
    };

    const handleAdminAuthKeyPress = (key) => {
        if (key === 'clear') {
            adminAuthDigits = '';
        } else if (key === 'back') {
            adminAuthDigits = adminAuthDigits.slice(0, -1);
        } else if (adminAuthDigits.length < 4) {
            adminAuthDigits += key;

            if (adminAuthDigits.length === 4) {
                if (adminAuthDigits === getKioskPassword()) {
                    // Password correct, exit kiosk mode
                    setTimeout(() => {
                        const event = new CustomEvent('kiosk-exit-request');
                        window.dispatchEvent(event);
                    }, 200);
                } else {
                    // Incorrect password
                    const displayMsg = container.querySelector('#kiosk-admin-message-banner');
                    if (displayMsg) {
                        displayMsg.textContent = '비밀번호가 일치하지 않습니다. 다시 입력해주세요.';
                        displayMsg.style.color = 'var(--danger)';
                    }
                    const dots = container.querySelectorAll('.kiosk-pin-dot');
                    dots.forEach(d => {
                        d.style.borderColor = 'var(--danger)';
                        d.style.boxShadow = '0 0 12px rgba(214, 48, 49, 0.4)';
                    });
                    setTimeout(() => {
                        adminAuthDigits = '';
                        render();
                    }, 1200);
                }
            }
        }
        render();
    };

    const triggerCheckIn = (studentId) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const nowTimeStr = new Date().toTimeString().slice(0, 5); // HH:MM
        
        stateStore.markAttendance(studentId, todayStr, 'present', nowTimeStr, '태블릿 등원 자동 입력');
        
        completeStatus = 'in';
        activeStep = 'complete';
        render();

        // 5 second auto reset
        autoResetTimeout = setTimeout(() => {
            resetKiosk();
        }, 5000);
    };

    const triggerCheckOut = (studentId) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const nowTimeStr = new Date().toTimeString().slice(0, 5); // HH:MM
        
        stateStore.leaveAttendance(studentId, todayStr, nowTimeStr);
        
        completeStatus = 'out';
        activeStep = 'complete';
        render();

        // 5 second auto reset
        autoResetTimeout = setTimeout(() => {
            resetKiosk();
        }, 5000);
    };

    const render = () => {
        const settings = stateStore.getSettings();
        // 1. Render outer shell first if not already present to avoid shaking/animation replay on input
        if (!container.querySelector('.kiosk-layout-container')) {
            container.innerHTML = `
                <button class="btn-kiosk-return" id="kiosk-return-to-admin">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> 관리자 모드로 돌아가기
                </button>
                <div class="kiosk-layout-container" id="kiosk-step-wrapper"></div>
            `;
            
            const returnBtn = container.querySelector('#kiosk-return-to-admin');
            if (returnBtn) {
                returnBtn.addEventListener('click', () => {
                    activeStep = 'admin-auth';
                    adminAuthDigits = '';
                    render();
                });
            }
        }

        const stepWrapper = container.querySelector('#kiosk-step-wrapper');
        let kioskHtml = '';

        if (activeStep === 'keypad') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <i class="fa-solid fa-music" style="font-size: 3rem; color: var(--primary); margin-bottom: 1rem; text-shadow: var(--shadow-glow);"></i>
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">${settings.academyName || '튜링 음악학원'} 출결 키오스크</h2>
                    <p id="kiosk-message-banner" style="color: var(--text-muted); font-size: 0.95rem;">휴대폰 번호 뒷자리 4자리를 터치해 주세요.</p>
                </div>

                <!-- Pin display dots -->
                <div class="kiosk-pin-display">
                    ${[0, 1, 2, 3].map(i => {
                        const val = inputDigits[i] || '';
                        return `<div class="kiosk-pin-dot ${val ? 'active' : ''}">${val ? val : ''}</div>`;
                    }).join('')}
                </div>

                <!-- Kiosk Grid Keypad -->
                <div class="kiosk-keypad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                        <button class="kiosk-key" data-key="${num}">${num}</button>
                    `).join('')}
                    <button class="kiosk-key key-clear" data-key="clear">전체지움</button>
                    <button class="kiosk-key" data-key="0">0</button>
                    <button class="kiosk-key key-back" data-key="back">
                        <i class="fa-solid fa-delete-left"></i>
                    </button>
                </div>
            `;
        } else if (activeStep === 'admin-auth') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <i class="fa-solid fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 1rem; text-shadow: var(--shadow-glow);"></i>
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">관리자 본인 인증</h2>
                    <p id="kiosk-admin-message-banner" style="color: var(--text-muted); font-size: 0.95rem;">비밀번호 4자리를 입력해주세요.</p>
                </div>

                <!-- Pin display dots for password -->
                <div class="kiosk-pin-display">
                    ${[0, 1, 2, 3].map(i => {
                        const val = adminAuthDigits[i] || '';
                        return `<div class="kiosk-pin-dot ${val ? 'active' : ''}">${val ? '*' : ''}</div>`;
                    }).join('')}
                </div>

                <!-- Kiosk Grid Keypad for password -->
                <div class="kiosk-keypad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                        <button class="kiosk-key" data-key="${num}">${num}</button>
                    `).join('')}
                    <button class="kiosk-key key-clear" data-key="clear">전체지움</button>
                    <button class="kiosk-key" data-key="0">0</button>
                    <button class="kiosk-key key-back" data-key="back">
                        <i class="fa-solid fa-delete-left"></i>
                    </button>
                </div>

                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-none" id="kiosk-admin-cancel" style="padding: 10px 24px; font-weight: 600; color: var(--text-muted);">
                        <i class="fa-solid fa-xmark" style="margin-right: 8px;"></i> 출결 화면으로 돌아가기
                    </button>
                </div>
            `;
        } else if (activeStep === 'select-student') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <i class="fa-solid fa-circle-question" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 1rem;"></i>
                    <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 8px;">원생 이름 선택</h2>
                    <p style="color: var(--text-muted); font-size: 0.95rem;">본인의 이름을 터치해 주세요.</p>
                </div>

                <!-- Student selection grid -->
                <div class="kiosk-student-grid">
                    ${matchedStudents.map(student => `
                        <div class="kiosk-student-card" data-student-id="${student.id}" data-testid="kiosk-student-card-${student.id}">
                            <div class="kiosk-student-name">${student.name}</div>
                            <div class="kiosk-student-desc">${student.instrument} / ${student.school || '학원생'}</div>
                        </div>
                    `).join('')}
                </div>

                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-none" id="kiosk-back-to-keypad" style="padding: 10px 24px; font-weight: 600; color: var(--text-muted);">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 8px;"></i> 처음으로 돌아가기
                    </button>
                </div>
            `;
        } else if (activeStep === 'select-status') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div class="profile-avatar" style="width: 70px; height: 70px; font-size: 1.8rem; margin: 0 auto 1rem auto; background: linear-gradient(135deg, var(--primary), var(--accent));">
                        ${selectedStudent.name[0]}
                    </div>
                    <h2 style="font-size: 1.7rem; font-weight: 800; margin-bottom: 8px;">${selectedStudent.name} 원생님</h2>
                    <p style="color: var(--text-muted); font-size: 0.95rem;">원하시는 출결 상태를 터치해 주세요.</p>
                </div>

                <!-- Status Select Buttons -->
                <div class="kiosk-status-container">
                    <div class="kiosk-status-card status-in" id="kiosk-action-checkin" data-testid="kiosk-checkin-btn">
                        <i class="fa-solid fa-door-open"></i>
                        <span class="kiosk-status-title">등원 (출석)</span>
                        <span class="kiosk-status-desc">학원에 도착했습니다.</span>
                    </div>
                    <div class="kiosk-status-card status-out" id="kiosk-action-checkout" data-testid="kiosk-checkout-btn">
                        <i class="fa-solid fa-door-closed"></i>
                        <span class="kiosk-status-title">하원</span>
                        <span class="kiosk-status-desc">수업 후 귀가합니다.</span>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 1.5rem;">
                    <button class="btn btn-none" id="kiosk-back-to-student" style="padding: 10px 24px; font-weight: 600; color: var(--text-muted);">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 8px;"></i> 이전 단계로
                    </button>
                </div>
            `;
        } else if (activeStep === 'complete') {
            const isCheckIn = completeStatus === 'in';
            const actionLabel = isCheckIn ? '등원' : '하원';
            const actionDesc = isCheckIn ? '학원에 안전하게 등원하였습니다.' : '수업을 마치고 안전하게 하원하였습니다.';
            const iconClass = isCheckIn ? 'fa-circle-check' : 'fa-circle-chevron-right';
            const iconColor = isCheckIn ? 'var(--success)' : 'var(--warning)';

            kioskHtml = `
                <div style="text-align: center; max-width: 480px; margin: 0 auto;">
                    <i class="fa-solid ${iconClass}" style="font-size: 4.5rem; color: ${iconColor}; margin-bottom: 1.5rem; filter: drop-shadow(0 0 15px rgba(255,255,255,0.05));"></i>
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 10px; color: var(--text-main);">${selectedStudent.name} 님</h2>
                    <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">${actionLabel}이 완료되었습니다!</p>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 2rem;">${actionDesc}</p>

                    <button class="btn btn-primary" id="kiosk-complete-reset" style="padding: 12px 30px; font-weight: 600; border-radius: var(--radius-md);">
                        즉시 처음 화면으로
                    </button>

                    <!-- Auto redirect timer progress -->
                    <div class="kiosk-timer-wrapper">
                        <div class="kiosk-timer-bar"></div>
                    </div>
                </div>
            `;
        }

        stepWrapper.innerHTML = kioskHtml;

        // Register interactive events inside wrapper
        if (activeStep === 'keypad' || activeStep === 'admin-auth') {
            stepWrapper.querySelectorAll('.kiosk-key').forEach(button => {
                button.addEventListener('click', (e) => {
                    const key = e.currentTarget.dataset.key;
                    handleKeyPress(key);
                });
            });

            const cancelBtn = stepWrapper.querySelector('#kiosk-admin-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    resetKiosk();
                });
            }
        } else if (activeStep === 'select-student') {
            stepWrapper.querySelectorAll('.kiosk-student-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.studentId;
                    selectedStudent = matchedStudents.find(s => s.id === id);
                    activeStep = 'select-status';
                    render();
                });
            });

            const backBtn = stepWrapper.querySelector('#kiosk-back-to-keypad');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    resetKiosk();
                });
            }
        } else if (activeStep === 'select-status') {
            const btnIn = stepWrapper.querySelector('#kiosk-action-checkin');
            if (btnIn) {
                btnIn.addEventListener('click', () => {
                    triggerCheckIn(selectedStudent.id);
                });
            }

            const btnOut = stepWrapper.querySelector('#kiosk-action-checkout');
            if (btnOut) {
                btnOut.addEventListener('click', () => {
                    triggerCheckOut(selectedStudent.id);
                });
            }

            const backBtn = stepWrapper.querySelector('#kiosk-back-to-student');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    activeStep = 'select-student';
                    render();
                });
            }
        } else if (activeStep === 'complete') {
            const resetBtn = stepWrapper.querySelector('#kiosk-complete-reset');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    resetKiosk();
                });
            }
        }
    };

    // Initialize kiosk
    render();
    window.addEventListener('keydown', handlePhysicalKeydown);

    // Register exit event listener to bridge with app.js router
    const handleExitRequest = () => {
        // Find sidebar menu item for dashboard and trigger click programmatically
        const menuDashboard = document.querySelector('.menu-item[data-view="dir-dashboard"]');
        if (menuDashboard) {
            menuDashboard.click();
        }
    };
    window.addEventListener('kiosk-exit-request', handleExitRequest);

    // Return cleanup to detach keydown and timeout listeners
    return () => {
        window.removeEventListener('keydown', handlePhysicalKeydown);
        window.removeEventListener('kiosk-exit-request', handleExitRequest);
        if (autoResetTimeout) {
            clearTimeout(autoResetTimeout);
        }
    };
}

