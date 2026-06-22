import { stateStore } from '../../state.js';
import { calculateEndTime } from '../../state/sessions.js';
import { formatPhoneNumber, showKakaoTalkToast, openStudentDetailModalRef } from './shared.js';
import { openModal, closeModal } from '../../app.js';

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

function isDateInLeavePeriod(student, dateStr) {
    if (!student) return false;
    let periods = [];
    if (student.leavePeriods && student.leavePeriods.length > 0) {
        periods = [...student.leavePeriods];
    } else if (student.leaveStartDate && student.leaveEndDate) {
        periods = [{ startDate: student.leaveStartDate, endDate: student.leaveEndDate }];
    }
    return periods.some(p => p.startDate <= dateStr && dateStr <= p.endDate);
}

/**
 * Phase 9B-Repair-C: 출결관제 정합성 보정 (renderDirectorAttendanceControl)
 * Renders an exception-focused attendance control console suitable for 100+ students,
 * exactly matching the layout and UX structure of dayday_attendance_mixed_console.html.
 */
export function renderDirectorAttendanceControl(container) {
    // Global header integration for Last Sync & Refresh buttons
    const headerActions = document.querySelector('.header-actions');
    const settingsQuickBar = document.getElementById('settings-quick-bar');
    const currentDateEl = document.getElementById('current-date');
    
    // Hide default items
    if (settingsQuickBar) settingsQuickBar.style.display = 'none';
    if (currentDateEl) currentDateEl.style.display = 'none';
    
    // Create our action container in global header
    let acHeaderActions = document.getElementById('ac-global-header-actions');
    if (!acHeaderActions) {
        acHeaderActions = document.createElement('div');
        acHeaderActions.id = 'ac-global-header-actions';
        acHeaderActions.className = 'ac-header-actions';
        acHeaderActions.style.display = 'flex';
        acHeaderActions.style.alignItems = 'center';
        acHeaderActions.style.gap = '8px';
        if (headerActions) {
            headerActions.appendChild(acHeaderActions);
        }
    }

    // Tab and filter states
    let activeTab = 'daily'; // 'daily' | 'student' | 'class' | 'teacher'
    let isBoardExpanded = false; // Phase 9C-5D-Repair-B: 시간별 출결요약 펼침/접힘 상태
    let selectedDate = new Date().toISOString().slice(0, 10);
    let selectedStatus = '전체'; // '전체', '출석', '지각', '결석'
    let selectedInstrument = '전체';
    let selectedTeacherId = '전체';
    let searchQuery = '';
    let searchType = 'name'; // 'name' | 'id'
    let selectedRangeMode = 'today'; // 'today' | 'week' | 'month' | 'last_week' | 'last_month'
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth() + 1;
    let customRangeStart = null;
    let customRangeEnd = null;
    
    // UI state
    let selectedStudentId = null;
    let isComposing = false;
    let searchDebounceTimer = null;
    let latestStatsMap = {};
    let currentAttendance = [];
    let openAttendanceEditModal = null;

    const handleDocumentClick = (e) => {
        const popover = container.querySelector('#ac-period-popover');
        const btn = container.querySelector('#ac-period-btn');
        if (popover && btn && !popover.contains(e.target) && !btn.contains(e.target)) {
            popover.style.display = 'none';
        }
    };
    document.addEventListener('click', handleDocumentClick);

    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const get30DaysRange = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const end = new Date(y, m - 1, d);
        const start = new Date(y, m - 1, d);
        start.setDate(start.getDate() - 29);
        
        const dates = [];
        let current = new Date(start);
        while (current <= end) {
            dates.push(formatDate(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    const getRangeDates = (dateStr, mode) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const target = new Date(y, m - 1, d);
        const dates = [];
        if (mode === 'today') {
            dates.push(dateStr);
        } else if (mode === 'custom') {
            if (customRangeStart && customRangeEnd) {
                const [sy, sm, sd] = customRangeStart.split('-').map(Number);
                const [ey, em, ed] = customRangeEnd.split('-').map(Number);
                const start = new Date(sy, sm - 1, sd);
                const end = new Date(ey, em - 1, ed);
                let current = new Date(start);
                while (current <= end) {
                    dates.push(formatDate(current));
                    current.setDate(current.getDate() + 1);
                }
            } else {
                dates.push(dateStr);
            }
        } else if (mode === 'week') {
            const day = target.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(target);
            monday.setDate(target.getDate() + diffToMonday);
            for (let i = 0; i < 7; i++) {
                const current = new Date(monday);
                current.setDate(monday.getDate() + i);
                dates.push(formatDate(current));
            }
        } else if (mode === 'last_week') {
            const day = target.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(target);
            monday.setDate(target.getDate() + diffToMonday - 7);
            for (let i = 0; i < 7; i++) {
                const current = new Date(monday);
                current.setDate(monday.getDate() + i);
                dates.push(formatDate(current));
            }
        } else if (mode === 'month') {
            const year = target.getFullYear();
            const month = target.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            let current = new Date(firstDay);
            while (current <= lastDay) {
                dates.push(formatDate(current));
                current.setDate(current.getDate() + 1);
            }
        } else if (mode === 'last_month') {
            const year = target.getFullYear();
            const month = target.getMonth();
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            let current = new Date(firstDay);
            while (current <= lastDay) {
                dates.push(formatDate(current));
                current.setDate(current.getDate() + 1);
            }
        }
        return dates;
    };

    const getRangeLabelText = () => {
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        if (selectedRangeMode === 'today') {
            return `오늘: ${selectedDate}`;
        }
        if (selectedRangeMode === 'custom') {
            return `기간: ${customRangeStart} ~ ${customRangeEnd}`;
        }
        const modeKo = {
            'today': '오늘',
            'week': '이번주',
            'last_week': '저번주',
            'month': '이번달',
            'last_month': '지난달'
        };
        const start = rangeDates[0];
        const end = rangeDates[rangeDates.length - 1];
        return `${modeKo[selectedRangeMode] || '기간'}: ${start} ~ ${end}`;
    };

    const getPeriodUrgentList = (rangeDates) => {
        const studentsList = stateStore.getStudents();
        const attendanceList = currentAttendance;
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const urgent = [];
        
        rangeDates.forEach(date => {
            const dailySchedule = stateStore.getTeacherStudentScheduleForDate(date) || [];
            dailySchedule.forEach(entry => {
                const s = studentsList.find(stud => stud.id === entry.studentId);
                if (!s) return;
                
                const att = attendanceList.find(a => a.studentId === s.id && a.date === date && (a.classTime === entry.time || !a.classTime));
                let status = '예정';
                
                if (att) {
                    if (att.status === 'present') status = '출석';
                    else if (att.status === 'late') status = '지각';
                    else if (att.status === 'absent') status = '결석';
                } else {
                    const [classHour, classMin] = entry.time.split(':').map(Number);
                    const classTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), classHour, classMin);
                    const diffMins = (now - classTimeToday) / (1000 * 60);
                    
                    const lateThresholdMinutes = stateStore.getLateThresholdMinutes();
                    if (date < todayStr) {
                        status = '결석';
                    } else if (date === todayStr) {
                        if (diffMins > lateThresholdMinutes) {
                            status = '지각';
                        }
                    }
                }
                
                if (status === '지각' || status === '결석') {
                    const duplicate = urgent.find(x => x.student.id === s.id && x.date === date && x.time === entry.time);
                    if (!duplicate) {
                        urgent.push({ student: s, status, date, time: entry.time, note: att ? (att.note || '') : '' });
                    }
                }
            });
        });
        
        urgent.sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
        return urgent;
    };

    const drawCalendarGrid = (year, month) => {
        const grid = container.querySelector('#ac-cal-days-grid');
        const monthLabel = container.querySelector('#ac-cal-month-label');
        if (!grid || !monthLabel) return;
        
        monthLabel.textContent = `${year}년 ${month}월`;
        
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0).getDate();
        const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        
        const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
        
        let html = '';
        
        // Prev month days
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const prevM = month === 1 ? 12 : month - 1;
            const prevY = month === 1 ? year - 1 : year;
            const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            html += `<div class="ac-cal-day-cell other-month" data-date="${dateStr}">${d}</div>`;
        }
        
        // Current month days
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate ? 'selected' : '';
            const cellColorStyle = new Date(year, month - 1, d).getDay() === 0 ? 'color: #e74c3c;' : 'color: var(--text-main);';
            const selectedStyle = isSelected ? 'background: var(--primary) !important; color: #fff !important; font-weight: 700;' : '';
            html += `<div class="ac-cal-day-cell ${isSelected}" data-date="${dateStr}" style="${cellColorStyle} ${selectedStyle}">${d}</div>`;
        }
        
        // Next month days to fill 42 cells
        const totalFilled = startOffset + lastDay;
        const nextDays = 42 - totalFilled;
        for (let d = 1; d <= nextDays; d++) {
            const nextM = month === 12 ? 1 : month + 1;
            const nextY = month === 12 ? year + 1 : year;
            const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            html += `<div class="ac-cal-day-cell other-month" data-date="${dateStr}">${d}</div>`;
        }
        
        grid.innerHTML = html;
        
        // Add click listener to cells
        grid.querySelectorAll('.ac-cal-day-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                selectedDate = cell.dataset.date;
                const parts = selectedDate.split('-');
                calYear = parseInt(parts[0]);
                calMonth = parseInt(parts[1]);
                selectedRangeMode = 'today';
                customRangeStart = null;
                customRangeEnd = null;
                const popover = container.querySelector('#ac-period-popover');
                if (popover) popover.style.display = 'none';
                isBoardExpanded = false;
                render();
            });
        });
    };

    const getRangeAttendanceStats = (dateStr, mode, studentsList, attendanceList) => {
        const dates = getRangeDates(dateStr, mode);
        const statsMap = {};
        const teachersList = stateStore.getTeachers();

        studentsList.forEach(s => {
            statsMap[s.id] = {
                student: s,
                total: 0,
                present: 0,
                late: 0,
                absent: 0,
                scheduled: 0,
                history: [],
                lastStatus: '예정',
                lastTimeText: '-'
            };
        });

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        dates.forEach(date => {
            const dailySchedule = stateStore.getTeacherStudentScheduleForDate(date) || [];
            dailySchedule.forEach(entry => {
                const sId = entry.studentId;
                if (!statsMap[sId]) return;

                const att = attendanceList.find(a => a.studentId === sId && a.date === date && (a.classTime === entry.time || !a.classTime));
                let status = '예정';
                let checkTime = '';
                let leavingTime = '';

                if (att) {
                    checkTime = att.time || '';
                    leavingTime = att.leavingTime || '';
                    if (att.status === 'present') status = '출석';
                    else if (att.status === 'late') status = '지각';
                    else if (att.status === 'absent') status = '결석';
                } else {
                    const [classHour, classMin] = entry.time.split(':').map(Number);
                    const classTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), classHour, classMin);
                    const diffMins = (now - classTimeToday) / (1000 * 60);

                    const lateThresholdMinutes = stateStore.getLateThresholdMinutes();
                    if (date < todayStr) {
                        status = '결석';
                    } else if (date === todayStr) {
                        if (diffMins > lateThresholdMinutes) {
                            status = '지각';
                        }
                    }
                }

                const student = statsMap[sId].student;
                const inLeave = isDateInLeavePeriod(student, date);
                if (inLeave) {
                    if (status === '출석' || status === '지각') {
                        statsMap[sId].total++;
                        if (status === '출석') statsMap[sId].present++;
                        else if (status === '지각') statsMap[sId].late++;
                    } else {
                        status = '휴원';
                    }
                } else {
                    statsMap[sId].total++;
                    if (status === '출석') statsMap[sId].present++;
                    else if (status === '지각') statsMap[sId].late++;
                    else if (status === '결석') statsMap[sId].absent++;
                    else statsMap[sId].scheduled++;
                }

                statsMap[sId].history.push({ date, time: entry.time, status, checkTime, leavingTime, note: att ? (att.note || '') : '' });
            });
        });

        Object.keys(statsMap).forEach(sId => {
            const item = statsMap[sId];
            const plannedCount = item.total;
            item.attendanceRate = plannedCount > 0 ? Math.round(((item.present + item.late) / plannedCount) * 100) : null;
            
            if (item.history.length > 0) {
                item.history.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
                const lastActive = item.history.find(h => h.status !== '예정') || item.history[0];
                item.lastStatus = lastActive.status;
                item.lastTimeText = lastActive.checkTime ? `${lastActive.checkTime}${lastActive.leavingTime ? ' ~ ' + lastActive.leavingTime : ''}` : '-';
            }
        });

        return statsMap;
    };

    const get30DaysAttendanceStats = (dateStr, students, attendance) => {
        const dates = get30DaysRange(dateStr);
        const statsMap = {};
        students.forEach(s => {
            statsMap[s.id] = {
                student: s,
                total: 0,
                present: 0,
                late: 0,
                absent: 0,
                scheduled: 0,
                history: [],
                lastStatus: '예정',
                lastTimeText: '-'
            };
        });

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        dates.forEach(date => {
            const dailySchedule = stateStore.getTeacherStudentScheduleForDate(date) || [];
            dailySchedule.forEach(entry => {
                const sId = entry.studentId;
                if (!statsMap[sId]) return;

                const att = attendance.find(a => a.studentId === sId && a.date === date && (a.classTime === entry.time || !a.classTime));
                let status = '예정';
                let checkTime = '';
                let leavingTime = '';

                if (att) {
                    checkTime = att.time || '';
                    leavingTime = att.leavingTime || '';
                    if (att.status === 'present') status = '출석';
                    else if (att.status === 'late') status = '지각';
                    else if (att.status === 'absent') status = '결석';
                } else {
                    const [classHour, classMin] = entry.time.split(':').map(Number);
                    const classTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), classHour, classMin);
                    const diffMins = (now - classTimeToday) / (1000 * 60);

                    const lateThresholdMinutes = stateStore.getLateThresholdMinutes();
                    if (date < todayStr) {
                        status = '결석';
                    } else if (date === todayStr) {
                        if (diffMins > lateThresholdMinutes) {
                            status = '지각';
                        }
                    }
                }

                const student = statsMap[sId].student;
                const inLeave = isDateInLeavePeriod(student, date);
                if (inLeave) {
                    if (status === '출석' || status === '지각') {
                        statsMap[sId].total++;
                        if (status === '출석') statsMap[sId].present++;
                        else if (status === '지각') statsMap[sId].late++;
                    } else {
                        status = '휴원';
                    }
                } else {
                    statsMap[sId].total++;
                    if (status === '출석') statsMap[sId].present++;
                    else if (status === '지각') statsMap[sId].late++;
                    else if (status === '결석') statsMap[sId].absent++;
                    else statsMap[sId].scheduled++;
                }

                statsMap[sId].history.push({ date, time: entry.time, status, checkTime, leavingTime, note: att ? (att.note || '') : '' });
            });
        });

        Object.keys(statsMap).forEach(sId => {
            const item = statsMap[sId];
            const plannedCount = item.total;
            item.attendanceRate = plannedCount > 0 ? Math.round(((item.present + item.late) / plannedCount) * 100) : null;
            
            if (item.history.length > 0) {
                item.history.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
                const lastActive = item.history.find(h => h.status !== '예정') || item.history[0];
                item.lastStatus = lastActive.status;
                item.lastTimeText = lastActive.checkTime ? `${lastActive.checkTime}${lastActive.leavingTime ? ' ~ ' + lastActive.leavingTime : ''}` : '-';
            }
        });

        return statsMap;
    };

    // Stable mock generator for student detail metrics
    const getStudentMetrics = (studentId) => {
        const hash = studentId.charCodeAt(0) + (studentId.charCodeAt(1) || 0);
        const absentCount = hash % 3; // 0, 1, 2
        const lateCount = (hash + 1) % 4; // 0, 1, 2, 3
        const monthRate = 100 - (absentCount * 10) - (lateCount * 5); // 100%, 90% etc.
        const studentsList = stateStore.getStudents();
        const teachersList = stateStore.getTeachers();
        const stud = studentsList.find(s => s.id === studentId);
        
        return {
            absentCount,
            lateCount,
            monthRate,
            teacher: stud ? (() => {
                const t = teachersList.find(t => t.id === stud.teacherId);
                return t ? (t.employmentStatus === 'resigned' ? `${t.name} (퇴사)` : t.name) : '미배정';
            })() : '미배정',
            status: stud ? (absentCount > 1 ? '결석' : '출석') : '예정',
            reason: absentCount > 1 ? '결석 (사유 확인필요)' : '정상 수업',
            warningLabel: absentCount > 1 ? '연속 결석' : '',
            cal: Array.from({ length: 30 }, (_, i) => {
                if (i === 2) return 'present'; // 06-03 today
                if (i % 7 === 0) return 'absent';
                if (i % 8 === 0) return 'late';
                return 'present';
            })
        };
    };

    const debounceRender = (delay = 150) => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            const activeEl = document.activeElement;
            if (activeEl && activeEl.id === 'ac-search-input') {
                if (activeEl.dataset.composing === 'true' || isComposing) {
                    return;
                }
            }
            
            // Save focus and selection range
            const activeInput = document.activeElement;
            let selectionStart = null;
            let selectionEnd = null;
            let hasFocus = false;
            
            if (activeInput && activeInput.id === 'ac-search-input') {
                hasFocus = true;
                selectionStart = activeInput.selectionStart;
                selectionEnd = activeInput.selectionEnd;
            }

            render();

            // Restore focus and selection range
            if (hasFocus) {
                const newInput = container.querySelector('#ac-search-input');
                if (newInput) {
                    newInput.focus();
                    if (selectionStart !== null && selectionEnd !== null) {
                        newInput.setSelectionRange(selectionStart, selectionEnd);
                    }
                }
            }
        }, delay);
    };

    const render = () => {
        // Render global header actions dynamically
        if (acHeaderActions) {
            acHeaderActions.innerHTML = `
                <div class="ac-clock" id="ac-last-sync">마지막 동기화 16:18</div>
                <button class="btn btn-primary" id="ac-refresh-btn">새로고침</button>
            `;
            
            const refreshBtn = acHeaderActions.querySelector('#ac-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    showKakaoTalkToast('출결 상태가 동기화되었습니다.');
                    render();
                });
            }
        }

        const students = stateStore.getStudents();
        const teachers = stateStore.getTeachers();
        let attendance = [...stateStore.getAttendance()];

        // Phase 9C-3-Repair-B: Synthesize past attendance records for S1 (최다은)
        // Ensure present, late, and absent records are visible on any chosen selectedDate.
        const s1ClassDates = get30DaysRange(selectedDate).filter(date => {
            const dayIndex = new Date(date).getDay();
            return dayIndex === 1 || dayIndex === 3; // Monday (1) or Wednesday (3)
        });
        const pastS1ClassDates = s1ClassDates.filter(d => d < selectedDate);
        if (pastS1ClassDates.length >= 4) {
            attendance = attendance.filter(a => !(a.studentId === 'S1' && pastS1ClassDates.includes(a.date)));
            const len = pastS1ClassDates.length;
            // 3 presents, 1 late assigned to the latest 4 past class dates.
            // Rest of the past class dates remain unrecorded (defaults to absent).
            attendance.push({ id: 'V_A1', studentId: 'S1', date: pastS1ClassDates[len - 4], status: 'present', time: '14:02', note: '하농 연습 완료' });
            attendance.push({ id: 'V_A2', studentId: 'S1', date: pastS1ClassDates[len - 3], status: 'present', time: '13:58', note: '바이엘 2권 양손' });
            attendance.push({ id: 'V_A3', studentId: 'S1', date: pastS1ClassDates[len - 2], status: 'present', time: '14:00', note: '스케일 연습 진행함' });
            attendance.push({ id: 'V_A4', studentId: 'S1', date: pastS1ClassDates[len - 1], status: 'late', time: '14:15', note: '교통 체증으로 지각' });
        }

        // Phase 9C-5D-Repair-A: Synthesize a "late check-in" demo sample for today (S2)
        // This sample should show '지각' when lateDetectionEnabled is true, and '출석' when false,
        // without polluting the database.
        const lateDetectionEnabled = typeof stateStore.getLateDetectionEnabled === 'function' ? stateStore.getLateDetectionEnabled() : true;
        attendance = attendance.filter(a => !(a.studentId === 'S2' && a.date === selectedDate));
        attendance.push({
            id: 'V_A_S2_LATE_DEMO',
            studentId: 'S2',
            date: selectedDate,
            time: '14:15',
            status: lateDetectionEnabled ? 'late' : 'present',
            note: '지각 판정 테스트용 모의 등원'
        });

        currentAttendance = attendance;

        // 1. Process attendance lists for the selected range of dates
        const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        
        let dailyClasses = [];
        
        rangeDates.forEach(date => {
            const dateObj = new Date(date);
            const dayKo = daysKo[dateObj.getDay()];
            const dailySchedule = stateStore.getTeacherStudentScheduleForDate(date) || [];
            
            const classesForDate = dailySchedule
                .filter(entry => {
                    if (entry.teacherId) {
                        const teacher = teachers.find(t => t.id === entry.teacherId);
                        if (teacher && teacher.employmentStatus === 'resigned') {
                            const student = students.find(s => s.id === entry.studentId);
                            if (!student) return false;
                            const isOverride = entry.source === 'override';
                            
                            const now = new Date();
                            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                            const isCurrentOrFuture = date >= todayStr;
                            if (isCurrentOrFuture) {
                                const isCurrentTeacher = student.teacherId === teacher.id;
                                if (!isOverride && !isCurrentTeacher) {
                                    return false; // Filter out stale default classes for resigned teachers
                                }
                            }
                        }
                    }
                    return true;
                })
                .map(entry => {
                    const s = students.find(stud => stud.id === entry.studentId);
                    const enrollment = typeof stateStore.getClassEnrollment === 'function' ? stateStore.getClassEnrollment(entry) : null;
                    
                    const tId = entry.teacherId || (enrollment ? enrollment.teacherId : null) || (s ? s.teacherId : null);
                    const t = teachers.find(teach => teach.id === tId) || null;
                    const att = s ? attendance.find(a => a.studentId === s.id && a.date === date && (a.classTime === entry.time || !a.classTime)) : null;
                    
                    let status = '예정';
                    let checkTime = '';
                    let leavingTime = '';
                    let note = '';
                    
                    if (att) {
                        checkTime = att.time || '';
                        leavingTime = att.leavingTime || '';
                        note = att.note || '';
                        
                        if (att.status === 'present') status = '출석';
                        else if (att.status === 'late') status = '지각';
                        else if (att.status === 'absent') status = '결석';
                    } else {
                        const [classHour, classMin] = entry.time.split(':').map(Number);
                        const now = new Date();
                        const classTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), classHour, classMin);
                        const diffMins = (now - classTimeToday) / (1000 * 60);
                        
                        const lateThresholdMinutes = stateStore.getLateThresholdMinutes();
                        if (date < now.toISOString().slice(0, 10)) {
                            status = '결석';
                        } else if (date === now.toISOString().slice(0, 10)) {
                            const lateDetectionEnabled = typeof stateStore.getLateDetectionEnabled === 'function' ? stateStore.getLateDetectionEnabled() : true;
                            if (lateDetectionEnabled && diffMins > lateThresholdMinutes) {
                                status = '지각';
                            }
                        }
                    }
                    
                    const duration = entry.classDuration || (enrollment ? enrollment.defaultDurationMinutes : null) || (s ? s.defaultClassDuration : null) || 50;
                    const endTime = entry.endTime || calculateEndTime(entry.time, duration);
                    const instrumentText = enrollment ? (enrollment.subjectName || enrollment.subject || enrollment.instrument) : (s ? s.instrument : '');
                    
                    return {
                        classId: entry.id,
                        date: date,
                        dayOfWeek: dayKo,
                        time: entry.time,
                        endTime: endTime,
                        student: s,
                        teacher: t,
                        status: status,
                        checkTime: checkTime,
                        leavingTime: leavingTime,
                        note: note,
                        instrument: instrumentText || '미지정'
                    };
                })
                .filter(row => row.student);
            dailyClasses = dailyClasses.concat(classesForDate);
        });

        // Extract instrument list for filter dropdown
        const instruments = ['전체', ...new Set(students.map(s => s.instrument).filter(Boolean))];

        // Filter data based on filter bar inputs
        let filteredRows = dailyClasses.filter(row => {
            // Status filter
            if (selectedStatus !== '전체') {
                if (row.status !== selectedStatus) return false;
            }
            // Instrument filter
            if (selectedInstrument !== '전체' && row.instrument !== selectedInstrument) return false;
            // Teacher filter
            if (selectedTeacherId !== '전체' && (!row.teacher || row.teacher.id !== selectedTeacherId)) return false;
            // Search query filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase().replace(/\s+/g, '');
                if (searchType === 'name') {
                    const cleanName = row.student.name.toLowerCase().replace(/\s+/g, '');
                    const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(query);
                    let nameMatch = false;
                    if (isChosungOnly) {
                        nameMatch = getChosungStr(cleanName).includes(query);
                    } else {
                        nameMatch = cleanName.includes(query);
                    }
                    const phoneMatch = (row.student.phone && row.student.phone.replace(/[^0-9]/g, '').includes(query)) ||
                                       (row.student.parentPhone && row.student.parentPhone.replace(/[^0-9]/g, '').includes(query));
                    if (!nameMatch && !phoneMatch) return false;
                } else if (searchType === 'id') {
                    const studentMemberNo = row.student.studentMemberNo !== undefined && row.student.studentMemberNo !== null ? String(row.student.studentMemberNo) : null;
                    const memberNo = row.student.memberNo !== undefined && row.student.memberNo !== null ? String(row.student.memberNo) : null;
                    const cleanId = row.student.id.toLowerCase().replace(/\s+/g, '');
                    
                    let idMatch = (cleanId === query);
                    if (!idMatch) {
                        if (studentMemberNo !== null) {
                            const cleanMemberNo = studentMemberNo.toLowerCase().replace(/\s+/g, '');
                            idMatch = cleanMemberNo === query;
                        } else if (memberNo !== null) {
                            const cleanMemberNo = memberNo.toLowerCase().replace(/\s+/g, '');
                            idMatch = cleanMemberNo === query;
                        }
                    }
                    if (!idMatch) return false;
                }
            }
            return true;
        });

        // Sort rows by time
        filteredRows.sort((a, b) => a.time.localeCompare(b.time));

        const statsMap = getRangeAttendanceStats(selectedDate, selectedRangeMode, students, attendance);
        latestStatsMap = statsMap;

        // Filter student list based on selected filters and search
        let filteredStudents = students.map(s => {
            const stats = statsMap[s.id] || {
                student: s,
                total: 0,
                present: 0,
                late: 0,
                absent: 0,
                scheduled: 0,
                attendanceRate: null,
                lastStatus: '예정',
                lastTimeText: '-'
            };
            const teacherObj = teachers.find(t => t.id === s.teacherId);
            return {
                student: s,
                stats,
                teacher: teacherObj
            };
        }).filter(item => {
            // Status filter
            if (selectedStatus !== '전체' && item.stats.lastStatus !== selectedStatus) return false;
            
            // Instrument filter
            if (selectedInstrument !== '전체' && item.student.instrument !== selectedInstrument) return false;
            
            // Teacher filter
            if (selectedTeacherId !== '전체' && item.student.teacherId !== selectedTeacherId) return false;
            
            // Search query filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase().replace(/\s+/g, '');
                if (searchType === 'name') {
                    const cleanName = item.student.name.toLowerCase().replace(/\s+/g, '');
                    const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(query);
                    let nameMatch = false;
                    if (isChosungOnly) {
                        nameMatch = getChosungStr(cleanName).includes(query);
                    } else {
                        nameMatch = cleanName.includes(query);
                    }
                    const phoneMatch = (item.student.phone && item.student.phone.replace(/[^0-9]/g, '').includes(query)) ||
                                       (item.student.parentPhone && item.student.parentPhone.replace(/[^0-9]/g, '').includes(query));
                    if (!nameMatch && !phoneMatch) return false;
                } else if (searchType === 'id') {
                    const studentMemberNo = item.student.studentMemberNo !== undefined && item.student.studentMemberNo !== null ? String(item.student.studentMemberNo) : null;
                    const memberNo = item.student.memberNo !== undefined && item.student.memberNo !== null ? String(item.student.memberNo) : null;
                    const cleanId = item.student.id.toLowerCase().replace(/\s+/g, '');
                    
                    let idMatch = (cleanId === query);
                    if (!idMatch) {
                        if (studentMemberNo !== null) {
                            const cleanMemberNo = studentMemberNo.toLowerCase().replace(/\s+/g, '');
                            idMatch = cleanMemberNo === query;
                        } else if (memberNo !== null) {
                            const cleanMemberNo = memberNo.toLowerCase().replace(/\s+/g, '');
                            idMatch = cleanMemberNo === query;
                        }
                    }
                    if (!idMatch) return false;
                }
            }
            return true;
        });

        // Helper: Render Student-wise view table
        const renderStudentTable = () => {
            const sorted = [...filteredStudents].sort((a, b) => a.student.name.localeCompare(b.student.name));
            return `
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>회원번호</th>
                            <th>원생이름</th>
                            <th>악기/반</th>
                            <th>담당강사</th>
                            <th>총수업일수</th>
                            <th>출석</th>
                            <th>지각</th>
                            <th>결석</th>
                            <th>출석률</th>
                            <th>오늘/최근 상태</th>
                            <th>특이사항</th>
                            <th style="text-align: center;">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(item => {
                            const memberNoText = item.student.studentMemberNo || item.student.memberNo || item.student.id;
                            let statusBadge = `<span class="badge gray">예정</span>`;
                            if (item.stats.lastStatus === '출석') statusBadge = `<span class="badge good">출석</span>`;
                            else if (item.stats.lastStatus === '지각') statusBadge = `<span class="badge warn">지각</span>`;
                            else if (item.stats.lastStatus === '결석') statusBadge = `<span class="badge danger">결석</span>`;

                            return `
                                <tr class="ac-student-row ${item.student.id === selectedStudentId ? 'selected' : ''}" data-student-id="${item.student.id}">
                                    <td>${memberNoText}</td>
                                    <td>
                                        <div class="student-cell">
                                            <b class="student-name-text" style="font-weight:800; color:var(--text-main);">${item.student.name}</b>
                                        </div>
                                    </td>
                                    <td>${item.student.instrument || '미지정'}</td>
                                    <td>${item.teacher ? (item.teacher.employmentStatus === 'resigned' ? `${item.teacher.name} (퇴사)` : item.teacher.name) : '미배정'}</td>
                                    <td>${item.stats.total}회</td>
                                    <td>${item.stats.present}회</td>
                                    <td>${item.stats.late}회</td>
                                    <td>${item.stats.absent}회</td>
                                    <td><b>${item.stats.attendanceRate !== null ? `${item.stats.attendanceRate}%` : '-'}</b></td>
                                    <td>${statusBadge}</td>
                                    <td style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">
                                        ${item.student.scheduleNotes || '-'}
                                    </td>
                                    <td style="text-align: center;">
                                        <button class="btn mini-btn ac-student-edit-btn" data-student-id="${item.student.id}" data-student-name="${item.student.name}" style="padding: 4px 8px; font-size: 0.75rem; border: 1px solid var(--border-color); background: transparent; color: var(--text-main); border-radius: 4px; cursor: pointer; transition: all 0.2s ease; margin-bottom: 0;">출결수정</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        };

        // Helper: Render Instrument/Class-wise groups
        const renderClassGroups = () => {
            const classGroups = {};
            filteredStudents.forEach(item => {
                const inst = item.student.instrument || '미지정';
                if (!classGroups[inst]) {
                    classGroups[inst] = [];
                }
                classGroups[inst].push(item);
            });

            const sortedInstruments = Object.keys(classGroups).sort();
            if (sortedInstruments.length === 0) {
                return '<div style="padding: 20px; text-align: center; color: var(--text-muted);">조건에 맞는 악기/반 데이터가 없습니다.</div>';
            }

            return `
                <div class="class-groups-container">
                    <div class="group-grid">
                        ${sortedInstruments.map(inst => {
                            const list = classGroups[inst];
                            list.sort((a, b) => a.student.name.localeCompare(b.student.name));
                            
                            let total = 0, present = 0, late = 0, absent = 0;
                            list.forEach(item => {
                                total += item.stats.total;
                                present += item.stats.present;
                                late += item.stats.late;
                                absent += item.stats.absent;
                            });
                            const groupRate = total > 0 ? Math.round(((present + late) / total) * 100) : null;

                            return `
                                <div class="group-card">
                                    <div class="group-top">
                                        <div class="group-title">
                                            <b>${inst}</b>
                                            <span>오늘 ${list.length}명</span>
                                        </div>
                                        <div class="group-rate">
                                            <strong>${groupRate !== null ? `${groupRate}%` : '-'}</strong>
                                            <span>출석률</span>
                                        </div>
                                    </div>
                                    <div class="count-row">
                                        <span class="count-chip">예정 ${total}</span>
                                        <span class="count-chip good">출석 ${present}</span>
                                        <span class="count-chip warn">지각 ${late}</span>
                                        <span class="count-chip danger">결석 ${absent}</span>
                                    </div>
                                    <button class="btn btn-none mini-btn toggle-group-btn" style="width:100%; margin-top:8px; border-color:var(--border-color); color:var(--text-muted); font-size:0.75rem;">명단 펼치기</button>
                                    <div class="group-list">
                                        ${list.map(item => {
                                            const memberNoText = item.student.studentMemberNo || item.student.memberNo || item.student.id;
                                            let statusBadge = `<span class="badge gray">예정</span>`;
                                            if (item.stats.lastStatus === '출석') statusBadge = `<span class="badge good">출석</span>`;
                                            else if (item.stats.lastStatus === '지각') statusBadge = `<span class="badge warn">지각</span>`;
                                            else if (item.stats.lastStatus === '결석') statusBadge = `<span class="badge danger">결석</span>`;

                                            const teacherName = item.teacher ? item.teacher.name : '미배정';

                                            return `
                                                <div class="group-student ac-student-row ${item.student.id === selectedStudentId ? 'selected' : ''}" data-student-id="${item.student.id}">
                                                    <div class="student-main">
                                                        <span class="student-meta" style="font-size:0.68rem; color:var(--text-muted);">#${memberNoText}</span>
                                                        <span class="student-name"><b>${item.student.name}</b></span>
                                                        <span class="student-meta" style="font-size:0.7rem; color:var(--text-muted);">담당: ${teacherName}</span>
                                                    </div>
                                                    <span class="student-rate" style="margin-left:auto; margin-right:12px; font-size:0.75rem; color:var(--text-muted);">
                                                        출석률: <b>${item.stats.attendanceRate !== null ? `${item.stats.attendanceRate}%` : '-'}</b>
                                                    </span>
                                                    ${statusBadge}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        };

        // Helper: Render Teacher-wise groups
        const renderTeacherGroups = () => {
            const teacherGroups = {};
            filteredStudents.forEach(item => {
                const tName = item.teacher ? (item.teacher.employmentStatus === 'resigned' ? `${item.teacher.name} (퇴사)` : item.teacher.name) : '미배정';
                const tId = item.teacher ? item.teacher.id : 'unassigned';
                if (!teacherGroups[tId]) {
                    teacherGroups[tId] = {
                        teacherName: tName,
                        teacher: item.teacher,
                        list: []
                    };
                }
                teacherGroups[tId].list.push(item);
            });

            const sortedTeachers = Object.values(teacherGroups).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
            if (sortedTeachers.length === 0) {
                return '<div style="padding: 20px; text-align: center; color: var(--text-muted);">조건에 맞는 강사 데이터가 없습니다.</div>';
            }

            return `
                <div class="teacher-groups-container">
                    <div class="group-grid">
                        ${sortedTeachers.map(group => {
                            const list = group.list;
                            list.sort((a, b) => a.student.name.localeCompare(b.student.name));
                            
                            let total = 0, present = 0, late = 0, absent = 0;
                            list.forEach(item => {
                                total += item.stats.total;
                                present += item.stats.present;
                                late += item.stats.late;
                                absent += item.stats.absent;
                            });
                            const groupRate = total > 0 ? Math.round(((present + late) / total) * 100) : null;

                            return `
                                <div class="group-card">
                                    <div class="group-top">
                                        <div class="group-title">
                                            <b>${group.teacherName} 강사</b>
                                            <span>오늘 ${list.length}명</span>
                                        </div>
                                        <div class="group-rate">
                                            <strong>${groupRate !== null ? `${groupRate}%` : '-'}</strong>
                                            <span>출석률</span>
                                        </div>
                                    </div>
                                    <div class="count-row">
                                        <span class="count-chip">예정 ${total}</span>
                                        <span class="count-chip good">출석 ${present}</span>
                                        <span class="count-chip warn">지각 ${late}</span>
                                        <span class="count-chip danger">결석 ${absent}</span>
                                    </div>
                                    <button class="btn btn-none mini-btn toggle-group-btn" style="width:100%; margin-top:8px; border-color:var(--border-color); color:var(--text-muted); font-size:0.75rem;">명단 펼치기</button>
                                    <div class="group-list">
                                        ${list.map(item => {
                                            const memberNoText = item.student.studentMemberNo || item.student.memberNo || item.student.id;
                                            let statusBadge = `<span class="badge gray">예정</span>`;
                                            if (item.stats.lastStatus === '출석') statusBadge = `<span class="badge good">출석</span>`;
                                            else if (item.stats.lastStatus === '지각') statusBadge = `<span class="badge warn">지각</span>`;
                                            else if (item.stats.lastStatus === '결석') statusBadge = `<span class="badge danger">결석</span>`;

                                            const instrument = item.student.instrument || '미지정';

                                            return `
                                                <div class="group-student ac-student-row ${item.student.id === selectedStudentId ? 'selected' : ''}" data-student-id="${item.student.id}">
                                                    <div class="student-main">
                                                        <span class="student-meta" style="font-size:0.68rem; color:var(--text-muted);">#${memberNoText}</span>
                                                        <span class="student-name"><b>${item.student.name}</b></span>
                                                        <span class="student-meta" style="font-size:0.7rem; color:var(--text-muted);">악기: ${instrument}</span>
                                                    </div>
                                                    <span class="student-rate" style="margin-left:auto; margin-right:12px; font-size:0.75rem; color:var(--text-muted);">
                                                        출석률: <b>${item.stats.attendanceRate !== null ? `${item.stats.attendanceRate}%` : '-'}</b>
                                                    </span>
                                                    ${statusBadge}
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        };

        // Calculate KPI metrics
        const kpi = {
            total: dailyClasses.length,
            present: dailyClasses.filter(r => r.status === '출석').length,
            late: dailyClasses.filter(r => r.status === '지각').length,
            pending: dailyClasses.filter(r => r.status === '결석').length
        };

        // Calculate urgent counts for selected range
        const urgentList = getPeriodUrgentList(rangeDates);
        const urgentAbsentCount = urgentList.filter(x => x.status === '결석').length;
        const urgentLateCount = urgentList.filter(x => x.status === '지각').length;

        // Operating hours config for compact-board
        const settings = stateStore.getSettings() || {};
        const startTimeSetting = settings.scheduleStartTime || '14:00';
        const endTimeSetting = settings.scheduleEndTime || '21:00';
        const slotMinutesSetting = settings.scheduleSlotMinutes || 30;

        const generateOperatingHours = (start, end, interval) => {
            const slots = [];
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);
            let cur = startH * 60 + startM;
            const limit = endH * 60 + endM;
            while (cur <= limit) {
                const h = Math.floor(cur / 60);
                const m = cur % 60;
                slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                cur += interval;
            }
            return slots;
        };

        const operatingHours = generateOperatingHours(startTimeSetting, endTimeSetting, slotMinutesSetting);
        const hourGroups = {};
        operatingHours.forEach(t => hourGroups[t] = []);

        const findClosestSlot = (classTimeStr, slots) => {
            if (!slots || slots.length === 0) return null;
            const [cH, cM] = classTimeStr.split(':').map(Number);
            const classMins = cH * 60 + cM;
            let closestSlot = slots[0];
            let minDiff = Infinity;
            slots.forEach(slot => {
                const [sH, sM] = slot.split(':').map(Number);
                const slotMins = sH * 60 + sM;
                const diff = Math.abs(classMins - slotMins);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestSlot = slot;
                }
            });
            return closestSlot;
        };

        dailyClasses.forEach(row => {
            const key = findClosestSlot(row.time, operatingHours);
            if (key && hourGroups[key]) {
                hourGroups[key].push(row);
            }
        });

        // Retrieve real warnings from stateStore
        const warnings = stateStore.getAttendanceWarnings({ endDate: selectedDate });

        container.innerHTML = `
            <style>
                .attendance-control-root {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }
                .ac-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ac-clock {
                    padding: 6px 12px;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    font-size: 0.82rem;
                    font-weight: 700;
                    background: var(--bg-card);
                }
                
                .ac-tabs {
                    display: flex;
                    border: 1px solid rgba(9, 132, 227, 0.25);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    background: var(--bg-card);
                    padding: 4px;
                    gap: 6px;
                }
                .ac-tab {
                    flex: 1;
                    padding: 10px 16px;
                    border: 1px solid transparent;
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-muted);
                    font-weight: 700;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s ease;
                }
                .ac-tab:hover {
                    background: rgba(9, 132, 227, 0.08);
                    color: var(--text-main);
                }
                .ac-tab.active {
                    color: var(--primary);
                    background: rgba(9, 132, 227, 0.12);
                    border-color: rgba(9, 132, 227, 0.2);
                    box-shadow: 0 2px 6px rgba(9, 132, 227, 0.08);
                }
                
                .ac-filters-card {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 12px;
                    flex-wrap: wrap;
                    padding: 12px 16px;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    background: var(--bg-card);
                }
                .ac-filters-card select.form-control,
                .ac-filters-card select {
                    height: 36px;
                    padding: 6px 12px;
                    font-size: 0.82rem;
                    line-height: 1.4;
                    box-sizing: border-box;
                }
                .ac-filters-card input.form-control,
                .ac-filters-card input {
                    height: 36px;
                    padding: 6px 12px;
                    font-size: 0.82rem;
                    line-height: 1.4;
                    box-sizing: border-box;
                }
                .ac-period-selector {
                    position: relative;
                    display: inline-block;
                }
                .period-popover {
                    display: none;
                    position: absolute;
                    top: 40px;
                    left: 0;
                    z-index: 1000;
                    background: #ffffff !important;
                    opacity: 1 !important;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    padding: 12px;
                    min-width: 380px;
                    box-sizing: border-box;
                }
                @media (max-width: 480px) {
                    .period-popover {
                        min-width: 320px;
                        width: calc(100vw - 32px);
                    }
                }
                .btn-preset-quick, .ac-preset-btn {
                    min-height: 28px;
                    padding: 0 10px;
                    font-size: 0.75rem;
                    border: 1px solid var(--border-color);
                    background: var(--bg-body);
                    color: var(--text-main);
                    cursor: pointer;
                    border-radius: 4px;
                    box-sizing: border-box;
                    transition: all 0.15s ease;
                }
                .btn-preset-quick:hover, .ac-preset-btn:hover {
                    background: rgba(9, 132, 227, 0.05) !important;
                    border-color: var(--primary) !important;
                }
                .btn-preset-quick.active, .ac-preset-btn.active {
                    background: var(--primary) !important;
                    color: #fff !important;
                    border-color: var(--primary) !important;
                }
                .ac-cal-day-cell {
                    height: 24px;
                    line-height: 24px;
                    font-size: 11px;
                    border-radius: 4px;
                    cursor: pointer;
                    color: var(--text-main);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }
                .ac-cal-day-cell:hover {
                    background: rgba(9, 132, 227, 0.08);
                }
                .ac-cal-day-cell.selected {
                    background: var(--primary) !important;
                    color: #fff !important;
                    font-weight: 700;
                }
                .ac-cal-day-cell.other-month {
                    color: var(--text-muted);
                    opacity: 0.4;
                }
                
                .ac-search-combo {
                    display: flex;
                    align-items: center;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    box-sizing: border-box;
                }
                .ac-search-combo select {
                    border: none;
                    background: rgba(0,0,0,0.02);
                    padding: 0 8px;
                    height: 36px;
                    font-size: 0.82rem;
                    line-height: 1.4;
                    outline: none;
                    box-sizing: border-box;
                }
                .ac-search-combo input {
                    border: none;
                    padding: 0 12px;
                    height: 36px;
                    width: 160px;
                    font-size: 0.82rem;
                    line-height: 1.4;
                    outline: none;
                    box-sizing: border-box;
                }

                .kpi-row {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 12px;
                }
                .metric-card {
                    min-height: 94px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding: 16px;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    background: var(--bg-card);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .metric-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .metric-card.active {
                    border-color: var(--primary);
                    background: rgba(9, 132, 227, 0.05);
                }
                .metric-card h3 {
                    margin: 0 0 4px 0;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    font-weight: 700;
                }
                .metric-card .value {
                    font-size: 1.5rem;
                    font-weight: 800;
                }
                .metric-card .desc {
                    margin-top: 3px;
                    font-size: 0.72rem;
                    color: var(--text-muted);
                }
                .metric-icon {
                    width: 38px;
                    height: 38px;
                    display: grid;
                    place-items: center;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: 700;
                }
                .metric-icon.all { background: rgba(100,116,139,0.1); color: #475569; }
                .metric-icon.present { background: rgba(46,204,113,0.1); color: #2ecc71; }
                .metric-icon.late { background: rgba(241,196,15,0.1); color: #f1c40f; }
                .metric-icon.absent { background: rgba(231,76,60,0.1); color: #e74c3c; }

                .radar-banner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                    border: 1px solid rgba(231,76,60,0.2);
                    border-left: 4px solid #e74c3c;
                    border-radius: var(--radius-md);
                    background: rgba(231,76,60,0.05);
                }
                .radar-banner p {
                    margin: 0;
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: #e74c3c;
                }

                .main-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .left-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .board-note {
                    padding: 10px 12px 0;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--text-muted);
                }
                .board-note b {
                    color: var(--text-main);
                }

                .compact-board {
                    display: grid;
                    grid-template-rows: repeat(2, minmax(130px, auto));
                    grid-auto-flow: column;
                    grid-auto-columns: minmax(220px, 220px);
                    overflow-x: auto;
                    gap: 12px;
                    padding: 16px 16px 22px 16px;
                    background: var(--bg-card);
                    border-bottom: 1px solid var(--border-color);
                    scroll-behavior: smooth;
                    -webkit-overflow-scrolling: touch;
                }
                .compact-board.collapsed {
                    grid-template-rows: repeat(2, minmax(52px, auto));
                    grid-auto-flow: column;
                    grid-auto-columns: minmax(160px, 160px);
                    gap: 8px;
                    padding: 8px 16px 14px 16px;
                }
                .compact-board.collapsed .time-tile {
                    min-width: 160px;
                    min-height: 52px;
                    height: 52px;
                    padding: 6px 10px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .compact-board.collapsed .time-tile .tile-head,
                .compact-board.collapsed .time-tile .tile-stats,
                .compact-board.collapsed .time-tile .mini-students {
                    display: none !important;
                }
                .compact-board.collapsed .time-tile .tile-stats-compact {
                    display: flex !important;
                    flex-direction: column;
                    justify-content: center;
                    width: 100%;
                }
                .tile-stats-compact {
                    display: none;
                }
                .compact-board::-webkit-scrollbar {
                    height: 10px;
                }
                .compact-board::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 5px;
                }
                .compact-board::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 5px;
                }
                .compact-board::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.5);
                }
                .time-tile {
                    min-width: 220px;
                    min-height: 130px;
                    padding: 12px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: var(--bg-body);
                    box-sizing: border-box;
                }
                .time-tile.empty {
                    background: rgba(0,0,0,0.02);
                    opacity: 0.7;
                }
                .tile-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .tile-time {
                    font-size: 20px;
                    font-weight: 800;
                }
                .tile-count {
                    font-size: 17px;
                    color: var(--text-muted);
                }
                .tile-stats {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 6px;
                    margin-bottom: 10px;
                }
                .tile-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    background: rgba(0,0,0,0.04);
                    font-size: 15px;
                    font-weight: 700;
                    line-height: 1.2;
                    text-align: center;
                    padding: 6px 0;
                }
                .tile-stat.good { background: rgba(46,204,113,0.1); color: #2ecc71; }
                .tile-stat.warn { background: rgba(241,196,15,0.1); color: #f1c40f; }
                .tile-stat.danger { background: rgba(231,76,60,0.1); color: #e74c3c; }
 
                .mini-students {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    max-height: 160px;
                    overflow-y: auto;
                    padding-right: 2px;
                }
                .mini-row {
                    display: grid;
                    grid-template-columns: 14px 1fr auto;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 8px;
                    border-radius: 4px;
                    font-size: 15px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                }
                .mini-row:hover {
                    background-color: rgba(9, 132, 227, 0.08) !important;
                }
                .mini-row.present { background: rgba(46,204,113,0.1); color: #2ecc71; }
                .mini-row.late { background: rgba(241,196,15,0.1); color: #f1c40f; }
                .mini-row.absent { background: rgba(231,76,60,0.1); color: #e74c3c; }
                .mini-row.pending { background: rgba(0,0,0,0.05); color: var(--text-muted); }
                .mini-row.none { background: transparent; border: 1px dashed var(--border-color); color: var(--text-muted); }
                .mini-name {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .mini-meta {
                    font-size: 15px;
                    opacity: 0.8;
                }
 
                .table-container {
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    background: var(--bg-card);
                    overflow: hidden;
                }
                
                /* Warning Console Section */
                .warning-console {
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    background: var(--bg-card);
                    overflow: hidden;
                    margin-top: 10px;
                }
                .warning-console-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 14px;
                    padding: 13px 16px 10px;
                    border-bottom: 1px solid var(--border-color);
                }
                .warning-title {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    margin-bottom: 4px;
                    font-size: 0.95rem;
                    font-weight: 800;
                }
                .warning-title .warn-mark {
                    color: #e74c3c;
                }
                .warning-console-head p {
                    margin: 0;
                    color: var(--text-muted);
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .warning-total {
                    color: var(--text-muted);
                    font-size: 0.8rem;
                    font-weight: 700;
                }
                .warning-list {
                    display: flex;
                    flex-direction: column;
                }
                .warning-row {
                    display: grid;
                    grid-template-columns: 38px minmax(0, 1fr) 70px;
                    gap: 12px;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border-color);
                    cursor: pointer;
                }
                .warning-rate {
                    text-align: right;
                    white-space: nowrap;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: center;
                    min-width: 60px;
                }
                .warning-evidence {
                    font-size: 0.72rem !important;
                    color: var(--text-muted);
                    display: inline-block;
                    word-break: break-all;
                }
                .warning-row:last-child {
                    border-bottom: none;
                }
                .warning-row:hover {
                    background: rgba(0,0,0,0.02);
                }
                .warning-avatar {
                    width: 32px;
                    height: 32px;
                    display: grid;
                    place-items: center;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 800;
                }
                .warning-avatar.red { background: rgba(231,76,60,0.1); color: #e74c3c; }
                .warning-avatar.amber { background: rgba(241,196,15,0.1); color: #f1c40f; }
                .warning-avatar.green { background: rgba(46,204,113,0.1); color: #2ecc71; }
                .warning-avatar.cyan { background: rgba(9,132,227,0.1); color: #0984e3; }
                
                .warning-student {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-bottom: 4px;
                }
                .warning-student b {
                    font-size: 0.85rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .warning-severity {
                    padding: 1px 5px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1.2;
                }
                .warning-severity.critical {
                    background: rgba(231,76,60,0.1);
                    color: #e74c3c;
                    border: 1px solid rgba(231,76,60,0.2);
                }
                .warning-severity.red {
                    background: rgba(231,76,60,0.1);
                    color: #e74c3c;
                    border: 1px solid rgba(231,76,60,0.2);
                }
                .warning-severity.amber {
                    background: rgba(241,196,15,0.1);
                    color: #f1c40f;
                    border: 1px solid rgba(241,196,15,0.2);
                }
                .warning-student-meta {
                    font-size: 0.72rem;
                    color: var(--text-muted);
                }
                .warning-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                }
                .warning-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    padding: 1px 6px;
                    border-radius: 999px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    border: 1px solid rgba(231,76,60,0.2);
                    background: rgba(231,76,60,0.05);
                    color: #e74c3c;
                }
                .warning-chip.amber {
                    border-color: rgba(241,196,15,0.2);
                    background: rgba(241,196,15,0.05);
                    color: #f1c40f;
                }
                .warning-rate strong {
                    display: block;
                    font-size: 0.95rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .warning-rate span {
                    display: block;
                    font-size: 0.65rem;
                    color: var(--text-muted);
                    margin-top: 2px;
                }
                
                /* Common Badge Styles */
                .badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 3px 8px;
                    border-radius: 999px;
                    font-size: 13px;
                    font-weight: 700;
                    line-height: 1;
                    border: 1px solid transparent;
                }
                .badge.good {
                    background: rgba(46,204,113,0.15) !important;
                    color: #2ecc71 !important;
                    border-color: rgba(46,204,113,0.2) !important;
                }
                .badge.warn {
                    background: rgba(241,196,15,0.15) !important;
                    color: #f1c40f !important;
                    border-color: rgba(241,196,15,0.2) !important;
                }
                .badge.danger {
                    background: rgba(231,76,60,0.15) !important;
                    color: #e74c3c !important;
                    border-color: rgba(231,76,60,0.2) !important;
                }
                .badge.gray {
                    background: rgba(100,116,139,0.15) !important;
                    color: #64748b !important;
                    border-color: rgba(100,116,139,0.2) !important;
                }
                
                /* Inspector slide Drawer */
                .inspector-panel {
                    position: fixed;
                    top: 0;
                    right: 0;
                    display: flex;
                    flex-direction: column;
                    width: min(460px, 94vw);
                    height: 100vh;
                    z-index: 50;
                    transform: translateX(110%);
                    transition: transform .22s ease;
                    border-left: 1px solid var(--border-color);
                    background: #ffffff !important;
                    box-shadow: -10px 0 30px rgba(0,0,0,0.15);
                }
                .inspector-panel.open {
                    transform: translateX(0);
                }
                .drawer-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 45;
                    display: none;
                    background: rgba(0,0,0,0.3);
                }
                .drawer-backdrop.open {
                    display: block;
                }
                .drawer-close {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 32px;
                    height: 32px;
                    border: 1px solid var(--border-color);
                    border-radius: 50%;
                    background: var(--bg-card);
                    display: grid;
                    place-items: center;
                    font-size: 1.2rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .inspector-head {
                    padding: 20px 48px 16px 20px;
                    border-bottom: 1px solid var(--border-color);
                }
                .head-student-card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .head-student-card .avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: var(--primary);
                    color: #fff;
                    display: grid;
                    place-items: center;
                    font-weight: 800;
                    font-size: 1.25rem;
                }
                .profile-main {
                    display: flex;
                    flex-direction: column;
                }
                .profile-main strong {
                    font-size: 1.15rem;
                    font-weight: 800;
                }
                .profile-main span {
                    font-size: 13px;
                    color: var(--text-muted);
                }
                .inspector-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .drawer-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .section-title {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .section-title h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 800;
                }
                .section-title span {
                    font-size: 13px;
                    color: var(--text-muted);
                }
                .ac-stat-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
                .ac-stat-box {
                    padding: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: rgba(0,0,0,0.02);
                    text-align: center;
                }
                .ac-stat-box span {
                    display: block;
                    font-size: 13px;
                    color: var(--text-muted);
                }
                .ac-stat-box strong {
                    display: block;
                    font-size: 1.25rem;
                    font-weight: 800;
                    margin-top: 4px;
                }
                .warning-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .warning-box {
                    padding: 10px 12px;
                    border-radius: 6px;
                    font-size: 14px;
                    line-height: 1.5;
                    display: flex;
                    justify-content: space-between;
                }
                .warning-box.danger { background: rgba(231,76,60,0.1); color: #e74c3c; }
                .warning-box.muted { background: rgba(0,0,0,0.03); color: var(--text-muted); }
                
                .tuition-notice {
                    padding: 12px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: rgba(0,0,0,0.02);
                }
                .tuition-notice.overdue {
                    border-color: rgba(231,76,60,0.2);
                    background: rgba(231,76,60,0.02);
                }
                .tuition-notice-head {
                    display: flex;
                    justify-content: space-between;
                    font-weight: 700;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .tuition-notice-body {
                    font-size: 14px;
                    color: var(--text-muted);
                    margin-top: 4px;
                    line-height: 1.5;
                }
                
                .cal-mini {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 4px;
                }
                .cal-cell {
                    aspect-ratio: 1;
                    display: grid;
                    place-items: center;
                    font-size: 12px;
                    font-weight: 700;
                    border-radius: 4px;
                    background: rgba(0,0,0,0.02);
                }
                .cal-cell.present { background: rgba(46,204,113,0.2); color: #2ecc71; }
                .cal-cell.absent { background: rgba(231,76,60,0.2); color: #e74c3c; }
                .cal-cell.late { background: rgba(241,196,15,0.2); color: #f1c40f; }
                .cal-cell.today { outline: 2px solid var(--primary); }
                
                .log-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .log-item {
                    padding: 10px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .log-item-head {
                    display: flex;
                    justify-content: space-between;
                    font-weight: 700;
                }
                
                .ac-student-row {
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                }
                .ac-student-row:hover {
                    background-color: rgba(9, 132, 227, 0.04) !important;
                }
                .student-name-text {
                    cursor: pointer;
                }
                .group-student {
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                }
                .group-student:hover {
                    background-color: rgba(9, 132, 227, 0.04) !important;
                }
                
                /* Group Inquiry Cards CSS */
                .group-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                    padding: 12px;
                }
                .group-card {
                    display: flex;
                    flex-direction: column;
                    padding: 16px;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    background: var(--bg-card);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .group-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    gap: 12px;
                }
                .group-title {
                    display: flex;
                    flex-direction: column;
                }
                .group-title b {
                    font-size: 0.95rem;
                    color: var(--primary);
                    font-weight: 800;
                }
                .group-title span {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-top: 2px;
                }
                .group-rate {
                    text-align: right;
                }
                .group-rate strong {
                    display: block;
                    font-size: 1.25rem;
                    font-weight: 900;
                    color: var(--text-color);
                }
                .group-rate span {
                    font-size: 0.68rem;
                    color: var(--text-muted);
                }
                .count-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-bottom: 12px;
                }
                .count-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 3px 8px;
                    border-radius: 999px;
                    background: rgba(0,0,0,0.05);
                    color: var(--text-color);
                    font-size: 0.72rem;
                    font-weight: 700;
                }
                .count-chip.good { background: rgba(46,204,113,0.15); color: #2ecc71; }
                .count-chip.warn { background: rgba(241,196,15,0.15); color: #f1c40f; }
                .count-chip.danger { background: rgba(231,76,60,0.15); color: #e74c3c; }

                .group-list {
                    display: none;
                    flex-direction: column;
                    gap: 6px;
                    margin-top: 6px;
                }
                .group-card.open .group-list {
                    display: flex;
                }
                .group-student {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 10px;
                    border-radius: 6px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-body);
                    cursor: pointer;
                    font-size: 0.8rem;
                    transition: background 0.15s, border-color 0.15s;
                }
                .group-student:hover {
                    background: rgba(9, 132, 227, 0.05);
                    border-color: var(--primary);
                }
                .group-student.selected {
                    background: rgba(9, 132, 227, 0.08);
                    border-color: var(--primary);
                }
                .group-student .student-main {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .group-student .student-name {
                    font-weight: 700;
                }
                .group-student .student-meta {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }
                .group-student .student-rate {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
            </style>

            <div class="attendance-control-root">
                <!-- 1. Tabs Row (Header Section Removed) -->
                <div class="ac-tabs">
                    <button class="ac-tab ${activeTab === 'daily' ? 'active' : ''}" data-tab="daily">일자별 조회</button>
                    <button class="ac-tab ${activeTab === 'student' ? 'active' : ''}" data-tab="student">원생별 조회</button>
                    <button class="ac-tab ${activeTab === 'class' ? 'active' : ''}" data-tab="class">악기/반 별 조회</button>
                    <button class="ac-tab ${activeTab === 'teacher' ? 'active' : ''}" data-tab="teacher">강사별 조회</button>
                </div>

                <!-- 2. Filter Bar (Search combo merged inside) -->
                <div class="ac-filters-card">
                    <!-- Period selector -->
                    <div class="ac-period-selector" style="position: relative; display: inline-block;">
                        <button type="button" id="ac-period-btn" class="form-control" style="width: 260px; height: 36px; text-align: left; background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; color: var(--text-main); font-weight: 600; display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 0 12px; box-sizing: border-box;">
                            <span id="ac-period-label">${getRangeLabelText()}</span>
                            <span style="font-size: 10px; color: var(--text-muted);">▼</span>
                        </button>
                        
                        <!-- Popover panel -->
                        <div id="ac-period-popover" class="period-popover" style="display: none; position: absolute; top: 40px; left: 0; z-index: 1000; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: var(--shadow-md); padding: 12px; min-width: 380px; box-sizing: border-box; max-width: calc(100vw - 32px);">
                            <div style="display: flex; gap: 12px;">
                                <!-- Left: Small Mini Calendar -->
                                <div class="mini-datepicker-calendar" style="flex: 1;">
                                    <div class="calendar-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                        <button type="button" id="ac-cal-prev-btn" style="border: none; background: transparent; cursor: pointer; padding: 4px; font-weight: 700; color: var(--text-main);">〈</button>
                                        <span id="ac-cal-month-label" style="font-size: 13px; font-weight: 700; color: var(--text-main);"></span>
                                        <button type="button" id="ac-cal-next-btn" style="border: none; background: transparent; cursor: pointer; padding: 4px; font-weight: 700; color: var(--text-main);">〉</button>
                                    </div>
                                    <!-- Days grid header -->
                                    <div class="calendar-grid-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">
                                        <span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span style="color: #e74c3c;">일</span>
                                    </div>
                                    <!-- Days grid cells -->
                                    <div id="ac-cal-days-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center;">
                                        <!-- filled dynamically -->
                                    </div>
                                    
                                    <div class="manual-date-picker" style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">직접 기간 선택</span>
                                        <div style="display: flex; align-items: center; gap: 4px;">
                                            <input type="date" id="ac-start-date" value="${customRangeStart || selectedDate}" class="form-control" style="width: 115px; height: 28px; font-size: 11px; padding: 0 6px; box-sizing: border-box;">
                                            <span style="font-size: 11px; color: var(--text-muted);">~</span>
                                            <input type="date" id="ac-end-date" value="${customRangeEnd || selectedDate}" class="form-control" style="width: 115px; height: 28px; font-size: 11px; padding: 0 6px; box-sizing: border-box;">
                                            <button type="button" id="ac-custom-range-apply-btn" class="btn btn-primary" style="height: 28px; font-size: 11px; padding: 0 8px; min-width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700;">적용</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Right: Quick Preset Buttons (Vertical) -->
                                <div class="quick-presets" style="width: 90px; border-left: 1px solid var(--border-color); padding-left: 12px; display: flex; flex-direction: column; gap: 6px; justify-content: center;">
                                    <button type="button" class="btn-preset-quick ac-preset-btn ${selectedRangeMode === 'today' ? 'active' : ''}" data-range="today" style="width: 100%; height: 28px; font-size: 12px; font-weight: 600; padding: 0; cursor: pointer;">오늘</button>
                                    <button type="button" class="btn-preset-quick ac-preset-btn ${selectedRangeMode === 'week' ? 'active' : ''}" data-range="week" style="width: 100%; height: 28px; font-size: 12px; font-weight: 600; padding: 0; cursor: pointer;">이번주</button>
                                    <button type="button" class="btn-preset-quick ac-preset-btn ${selectedRangeMode === 'last_week' ? 'active' : ''}" data-range="last_week" style="width: 100%; height: 28px; font-size: 12px; font-weight: 600; padding: 0; cursor: pointer;">저번주</button>
                                    <button type="button" class="btn-preset-quick ac-preset-btn ${selectedRangeMode === 'month' ? 'active' : ''}" data-range="month" style="width: 100%; height: 28px; font-size: 12px; font-weight: 600; padding: 0; cursor: pointer;">이번달</button>
                                    <button type="button" class="btn-preset-quick ac-preset-btn ${selectedRangeMode === 'last_month' ? 'active' : ''}" data-range="last_month" style="width: 100%; height: 28px; font-size: 12px; font-weight: 600; padding: 0; cursor: pointer;">지난달</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <select id="ac-status-select" class="form-control" style="width: 130px; height:36px;">
                        <option value="전체" ${selectedStatus === '전체' ? 'selected' : ''}>전체 상태</option>
                        <option value="예정" ${selectedStatus === '예정' ? 'selected' : ''}>예정</option>
                        <option value="출석" ${selectedStatus === '출석' ? 'selected' : ''}>출석</option>
                        <option value="지각" ${selectedStatus === '지각' ? 'selected' : ''}>지각</option>
                        <option value="결석" ${selectedStatus === '결석' ? 'selected' : ''}>결석</option>
                    </select>

                    <select id="ac-instrument-select" class="form-control" style="width: 130px; height:36px;">
                        <option value="전체">전체 악기</option>
                        ${instruments.filter(inst => inst !== '전체').map(inst => `
                            <option value="${inst}" ${selectedInstrument === inst ? 'selected' : ''}>${inst}</option>
                        `).join('')}
                    </select>

                    <select id="ac-teacher-select" class="form-control" style="width: 130px; height:36px;">
                        <option value="전체">전체 강사</option>
                        ${teachers.filter(t => {
                            if (t.employmentStatus !== 'resigned') return true;
                            if (selectedTeacherId === t.id) return true;
                            
                            const dates = getRangeDates(selectedDate, selectedRangeMode);
                            const shifts = stateStore.getTeacherShifts() || [];
                            const logs = stateStore.getTeacherAttendanceLogs() || [];
                            
                            const hasLog = logs.some(log => log.teacherId === t.id && dates.includes(log.date));
                            const hasShift = shifts.some(s => s.teacherId === t.id && dates.includes(s.date) && s.slots && s.slots.length > 0);
                            const hasClass = dates.some(d => {
                                const todayClasses = stateStore.getTeacherStudentScheduleForDate(d) || [];
                                return todayClasses.some(c => {
                                    if (c.teacherId !== t.id) return false;
                                    const student = students.find(s => s.id === c.studentId);
                                    if (!student) return false;
                                    if (c.source === 'override') return true;
                                    
                                    const now = new Date();
                                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                    const isCurrentOrFuture = d >= todayStr;
                                    if (isCurrentOrFuture) {
                                        return student.teacherId === t.id;
                                    }
                                    return true;
                                });
                            });
                            
                            return hasLog || hasShift || hasClass;
                        }).map(t => {
                            const resignedSuffix = t.employmentStatus === 'resigned' ? ' (퇴사)' : '';
                            return `<option value="${t.id}" ${selectedTeacherId === t.id ? 'selected' : ''}>${t.name}${resignedSuffix}</option>`;
                        }).join('')}
                    </select>

                    <div class="ac-search-combo">
                        <select id="ac-search-type">
                            <option value="name" ${searchType === 'name' ? 'selected' : ''}>이름</option>
                            <option value="id" ${searchType === 'id' ? 'selected' : ''}>회원번호</option>
                        </select>
                        <input type="text" id="ac-search-input" value="${searchQuery}" placeholder="원생 검색">
                    </div>

                    <div class="ac-late-policy-info" style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(9, 132, 227, 0.08); border: 1px solid rgba(9, 132, 227, 0.2); border-radius: 999px; font-size: 11px; color: var(--primary); font-weight: 700; height: 26px; box-sizing: border-box;">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span>현재 지각 기준: ${stateStore.getLateDetectionEnabled() ? `수업 시작 후 ${String(stateStore.getLateThresholdMinutes()).padStart(2, '0')}분` : '미사용'}</span>
                    </div>
                </div>

                <!-- 4. KPI Cards -->
                <section class="kpi-row" aria-label="상단 출결 콘솔">
                    <div class="metric-card ${selectedStatus === '전체' ? 'active' : ''}" data-status="전체">
                        <div>
                            <h3>전체 예정</h3>
                            <div class="value">${kpi.total}명</div>
                            <div class="desc">오늘 수업 대상자</div>
                        </div>
                        <div class="metric-icon all">◎</div>
                    </div>
                    <div class="metric-card ${selectedStatus === '출석' ? 'active' : ''}" data-status="출석">
                        <div>
                            <h3>출석</h3>
                            <div class="value">${kpi.present}명</div>
                            <div class="desc">정상 등원 완료</div>
                        </div>
                        <div class="metric-icon present">✓</div>
                    </div>
                    <div class="metric-card ${selectedStatus === '지각' ? 'active' : ''}" data-status="지각">
                        <div>
                            <h3>지각</h3>
                            <div class="value">${kpi.late}명</div>
                            <div class="desc">지연 등원 누적</div>
                        </div>
                        <div class="metric-icon late">!</div>
                    </div>
                    <div class="metric-card ${selectedStatus === '결석' ? 'active' : ''}" data-status="결석">
                        <div>
                            <h3>결석</h3>
                            <div class="value">${kpi.pending}명</div>
                            <div class="desc">결석 확인 필요</div>
                        </div>
                        <div class="metric-icon absent">×</div>
                    </div>
                </section>

                <!-- 5. Urgent Queue Banner -->
                <section class="radar-banner">
                    <div>
                        <p id="urgentBannerText">${selectedRangeMode === 'today' ? `오늘 발생한 결석 ${urgentAbsentCount}명, 지각 ${urgentLateCount}명입니다.` : `선택 기간 결석 ${urgentAbsentCount}명, 지각 ${urgentLateCount}명입니다.`}</p>
                    </div>
                    <div>
                        <button class="btn btn-none mini-btn" id="ac-urgent-btn" style="background:#fff;">전체 보기</button>
                    </div>
                </section>
                <div class="queue-popover" id="ac-urgent-queue-panel" style="display:none; border:1px solid var(--border-color); border-radius:var(--radius-md); background:var(--bg-card); box-shadow:var(--shadow-sm); margin-top:8px;"></div>

                <!-- 6. Main Grid (Vertical stack of Left Panel + Warning Console) -->
                <div class="main-grid">
                    <div class="left-panel">
                        <div class="table-container">
                            ${activeTab === 'daily' ? `
                                <div class="board-note" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px 6px;">
                                    <span><b>시간별 출결 요약</b></span>
                                    <button type="button" class="btn btn-secondary mini-btn" id="ac-toggle-board-btn" style="padding: 2px 8px; font-size: 11px; height: 24px; line-height: 18px; font-weight: 700; margin-bottom: 0; width: 100px; display: inline-flex; justify-content: center; align-items: center; box-sizing: border-box;">${isBoardExpanded ? '출결요약 접기' : '출결요약 펼치기'}</button>
                                </div>
                                
                                <!-- Compact Board -->
                                <div class="compact-board ${isBoardExpanded ? '' : 'collapsed'}" id="compactBoard">
                                    ${operatingHours.map(time => {
                                        const list = hourGroups[time] || [];
                                        const pres = list.filter(r => r.status === '출석').length;
                                        const l = list.filter(r => r.status === '지각').length;
                                        const abs = list.filter(r => r.status === '결석').length;
                                        
                                        const exceptions = list.filter(r => r.status !== '출석' && r.status !== '예정');
                                        
                                        let noteMarkup = '';
                                        if (list.length === 0) {
                                            noteMarkup = '<div class="mini-row none"><span>-</span><span class="mini-name">수업 없음</span><span class="mini-meta"></span></div>';
                                        } else if (exceptions.length > 0) {
                                            noteMarkup = exceptions.map(row => {
                                                const isLate = row.status === '지각';
                                                const classTone = isLate ? 'late' : 'absent';
                                                const mark = isLate ? '!' : '×';
                                                return `
                                                    <div class="mini-row ${classTone}" data-student-id="${row.student.id}">
                                                        <span>${mark}</span>
                                                        <span class="mini-name">${row.student.name}</span>
                                                        <span class="mini-meta">${row.checkTime || row.time}</span>
                                                    </div>
                                                `;
                                            }).join('');
                                        } else {
                                            noteMarkup = '<div class="mini-row pending"><span>✓</span><span class="mini-name">주의 없음</span><span class="mini-meta">정상</span></div>';
                                        }

                                        return `
                                            <div class="time-tile ${list.length === 0 ? 'empty' : ''}">
                                                <div class="tile-head">
                                                    <div class="tile-time">${time}</div>
                                                    <div class="tile-count">${list.length}명</div>
                                                </div>
                                                <div class="tile-stats">
                                                    <div class="tile-stat">전체<br>${list.length}</div>
                                                    <div class="tile-stat good">출석<br>${pres}</div>
                                                    <div class="tile-stat danger">결석<br>${abs}</div>
                                                    <div class="tile-stat warn">지각<br>${l}</div>
                                                </div>
                                                <div class="mini-students">
                                                    ${noteMarkup}
                                                </div>
                                                <!-- Compact Mode Slot Contents -->
                                                <div class="tile-stats-compact">
                                                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                                        <span style="font-size: 14px; font-weight: 800; color: var(--text-main);">${time}</span>
                                                        <span style="font-size: 12px; color: var(--text-muted); font-weight: 700;">${list.length}명</span>
                                                    </div>
                                                    <div style="display: flex; gap: 8px; font-size: 11px; font-weight: 700; margin-top: 2px;">
                                                        <span style="color: #e74c3c;">결석 ${abs}</span>
                                                        <span style="color: #f1c40f;">지각 ${l}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>

                                <!-- Real Table -->
                                <table class="custom-table">
                                    <thead>
                                        <tr>
                                            <th>요일</th>
                                            <th>수업시간</th>
                                            <th>이름</th>
                                            <th>악기/반</th>
                                            <th>담당강사</th>
                                            <th>출결상태</th>
                                            <th>등원시각</th>
                                            <th>메시지</th>
                                            <th>확인/관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${filteredRows.map(row => {
                                            let statusBadge = `<span class="badge gray">예정</span>`;
                                            if (row.status === '출석') statusBadge = `<span class="badge good">출석</span>`;
                                            else if (row.status === '지각') statusBadge = `<span class="badge warn">지각</span>`;
                                            else if (row.status === '결석') statusBadge = `<span class="badge danger">결석</span>`;

                                            const timeText = row.checkTime ? `${row.checkTime}${row.leavingTime ? ' ~ ' + row.leavingTime : ''}` : '-';
                                            
                                            // Mock messaging status based on class status
                                            let msgText = '<span style="opacity:0.5;">-</span>';
                                             if (row.status === '출석' || row.status === '지각') msgText = '<span style="color:#27ae60; font-weight:700;">발송완료</span>';
                                             else if (row.status === '결석') msgText = '<span style="color:#e74c3c; font-weight:700;">발송대기</span>';

                                            return `
                                                <tr class="ac-student-row ${row.student.id === selectedStudentId ? 'selected' : ''}" data-student-id="${row.student.id}">
                                                    <td>${row.dayOfWeek}</td>
                                                    <td><b>${row.time} - ${row.endTime}</b></td>
                                                    <td>
                                                        <div class="student-cell">
                                                            <b class="student-name-text" style="font-weight:800; color:var(--text-main);">${row.student.name}</b>
                                                        </div>
                                                    </td>
                                                    <td>${row.instrument || '-'}</td>
                                                    <td>${row.teacher ? (row.teacher.employmentStatus === 'resigned' ? `${row.teacher.name} (퇴사)` : row.teacher.name) : '미배정'}</td>
                                                    <td>${statusBadge}</td>
                                                    <td style="font-weight: 600; font-size: 0.8rem;">${timeText}</td>
                                                    <td style="font-size: 0.78rem;">${msgText}</td>
                                                    <td>
                                                        <div class="ac-quick-actions" style="display: flex; gap: 4px; align-items: center; justify-content: center;">
                                                            <button class="btn mini-btn ac-edit-btn" data-student-id="${row.student.id}" data-student-name="${row.student.name}" data-date="${row.date}" data-time="${row.time}" data-status="${row.status === '출석' ? 'present' : (row.status === '지각' ? 'late' : (row.status === '결석' ? 'absent' : ''))}" style="padding: 4px 8px; font-size: 0.75rem; border: 1px solid var(--border-color); background: transparent; color: var(--text-main); border-radius: 4px; cursor: pointer; transition: all 0.2s ease; margin-bottom: 0;">출결수정</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            ` : activeTab === 'student' ? renderStudentTable() : activeTab === 'class' ? renderClassGroups() : renderTeacherGroups()}
                        </div>
                    </div>

                    <!-- 7. Warning Console (At the bottom of main-grid) -->
                    <aside class="warning-console" aria-label="출결 워닝 콘솔">
                        <div class="warning-console-head">
                            <div>
                                <div class="warning-title"><span class="warn-mark">△</span> 출결 워닝</div>
                                <p>최근 4주 기준 예정 수업 대비 결석률 30%↑ · 출석률 75%↓ · 지각률 25%↑ · 연속 결석 패턴 감지</p>
                            </div>
                            <div class="warning-total" id="attendanceWarningTotal">상담/관리 필요 ${warnings.length}</div>
                        </div>
                        <div class="warning-list" id="attendanceWarningList">
                            ${warnings.length > 0 ? warnings.map(w => {
                                let avatarTone = 'green';
                                if (w.severity === 'critical') avatarTone = 'red';
                                else if (w.severity === 'red') avatarTone = 'red';
                                else if (w.severity === 'amber') avatarTone = 'amber';

                                return `
                                    <div class="warning-row" data-student-id="${w.studentId}">
                                        <div class="warning-avatar ${avatarTone}">${w.studentName.slice(-2)}</div>
                                        <div class="warning-main">
                                            <div class="warning-student">
                                                <b>${w.studentName}</b>
                                                <span class="warning-severity ${w.severity}">${w.severity === 'critical' ? '긴급' : (w.severity === 'red' ? '경고' : '주의')}</span>
                                                <span class="warning-student-meta">${w.instrument} · ${w.teacherName}</span>
                                            </div>
                                            <div class="warning-tags" style="margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                                                <span class="warning-chip ${w.severity === 'amber' ? 'amber' : ''}">△ ${w.title}</span>
                                            </div>
                                            <div class="warning-evidence" style="margin-top: 4px; font-size: 0.72rem; color: var(--text-muted); line-height: 1.35; display: block;">
                                                <span class="warning-reason" style="display:block; font-weight:700; color:var(--text-main);">${w.reason}</span>
                                                <span class="warning-detail" style="display:block; margin-top:2px;">${w.evidenceText}</span>
                                            </div>
                                        </div>
                                        <div class="warning-rate">
                                            <strong>${w.attendanceRate !== undefined && w.attendanceRate !== null ? w.attendanceRate : 0}%</strong>
                                            <span>출석률</span>
                                        </div>
                                    </div>
                                `;
                            }).join('') : `
                                <div style="text-align:center; padding:25px; color:var(--text-muted); font-size:14px;" class="warning-empty-state">
                                    상태 이상 원생이 없습니다. (이상 없음)
                                </div>
                            `}
                        </div>
                    </aside>
                </div>
            </div>

            <!-- Backdrop and Student Inspector slide Drawer -->
            <div class="drawer-backdrop" id="ac-drawer-backdrop"></div>
            <aside class="inspector-panel" id="ac-inspector-panel" aria-label="원생 상세 인스펙터">
                <button class="drawer-close" id="ac-drawer-close">×</button>
                <div class="inspector-head">
                    <div class="head-student-card">
                        <div class="avatar" id="ac-inspector-avatar">김</div>
                        <div class="profile-main">
                            <strong id="ac-inspector-name">-</strong>
                            <span id="ac-inspector-meta">-</span>
                        </div>
                    </div>
                </div>
                <div class="inspector-body">
                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>수강중인 과목</h3>
                        </div>
                        <div id="ac-inspector-enrollments-box" style="display: flex; flex-direction: column; gap: 6px;">
                            <!-- Filled dynamically -->
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>수납 정보</h3>
                        </div>
                        <div class="tuition-notice" id="ac-inspector-tuition-box">
                            <div class="tuition-notice-head">
                                <span id="ac-inspector-tuition-state">결제예정</span>
                                <span id="ac-inspector-tuition-due">D-3</span>
                            </div>
                            <div class="tuition-notice-body" id="ac-inspector-tuition-text">
                                6월 수강료 · 6/10 예정
                            </div>
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>휴원/퇴원 이력</h3>
                        </div>
                        <div id="ac-inspector-leave-history-box" style="padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.01); line-height: 1.5; font-size: 14px;">
                            이력 없음
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3 id="ac-inspector-history-section-title">출결 정보</h3>
                            <span id="ac-inspector-warning-count">정상</span>
                        </div>
                        <div class="ac-stat-grid" style="grid-template-columns: repeat(5, 1fr); gap: 6px;">
                            <div class="ac-stat-box" style="padding: 8px 4px;">
                                <span>예정 수업</span>
                                <strong id="ac-inspector-stat-done" style="font-size: 1.15rem;">0</strong>
                            </div>
                            <div class="ac-stat-box" style="padding: 8px 4px;">
                                <span>출석</span>
                                <strong id="ac-inspector-stat-present" style="font-size: 1.15rem; color: #2ecc71;">0</strong>
                            </div>
                            <div class="ac-stat-box" style="padding: 8px 4px;">
                                <span>지각</span>
                                <strong id="ac-inspector-stat-late" style="font-size: 1.15rem; color: #f1c40f;">0</strong>
                            </div>
                            <div class="ac-stat-box" style="padding: 8px 4px;">
                                <span>결석</span>
                                <strong id="ac-inspector-stat-absent" style="font-size: 1.15rem; color: #e74c3c;">0</strong>
                            </div>
                            <div class="ac-stat-box" style="padding: 8px 4px;">
                                <span>출석률</span>
                                <strong id="ac-inspector-stat-rate" style="font-size: 1.15rem; color: var(--primary);">-</strong>
                            </div>
                        </div>
                        <div class="warning-stack" id="ac-inspector-warning-list">
                            <div class="warning-box muted">
                                <b>정상 범위</b>
                                <span>이상 없음</span>
                            </div>
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>최근 30일 출결 현황</h3>
                        </div>
                        <div class="cal-mini" id="ac-inspector-calendar-mini">
                            <!-- Cells filled dynamically -->
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>최근 출결 이력</h3>
                            <span id="ac-inspector-history-count">0건</span>
                        </div>
                        <div class="log-list" id="ac-inspector-history-list" style="max-height: 200px; overflow-y: auto;">
                            <!-- Filled dynamically -->
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>최근 수정 이력</h3>
                            <span id="ac-inspector-audit-count">0건</span>
                        </div>
                        <div class="log-list" id="ac-inspector-audit-list" style="max-height: 150px; overflow-y: auto;">
                            <!-- Filled dynamically -->
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>메시지 이력</h3>
                            <span id="ac-inspector-msg-count">0건</span>
                        </div>
                        <div class="log-list" id="ac-inspector-msg-list">
                            <!-- logs filled dynamically -->
                        </div>
                    </section>
                </div>
                <div class="inspector-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; gap: 10px; background: #ffffff;">
                    <button type="button" class="btn btn-secondary" id="ac-inspector-btn-message" style="flex: 1; justify-content: center; height: 38px; font-weight: 600; margin-bottom: 0;">메시지 보내기</button>
                    <button type="button" class="btn btn-primary" id="ac-inspector-btn-detail" style="flex: 1; justify-content: center; height: 38px; font-weight: 600; margin-bottom: 0;">상세정보</button>
                </div>
            </aside>
        `;

        // Bind event listeners
        const toggleBoardBtn = container.querySelector('#ac-toggle-board-btn');
        if (toggleBoardBtn) {
            toggleBoardBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isBoardExpanded = !isBoardExpanded;
                render();
            });
        }

        const applyBtn = container.querySelector('#ac-custom-range-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const startInput = container.querySelector('#ac-start-date');
                const endInput = container.querySelector('#ac-end-date');
                if (startInput && endInput) {
                    let startVal = startInput.value;
                    let endVal = endInput.value;
                    if (!startVal || !endVal) {
                        const popover = container.querySelector('#ac-period-popover');
                        if (popover) popover.style.display = 'none';
                        return;
                    }
                    if (startVal > endVal) {
                        endVal = startVal;
                        endInput.value = startVal;
                    }
                    customRangeStart = startVal;
                    customRangeEnd = endVal;
                    selectedRangeMode = 'custom';
                    selectedDate = startVal;
                    const parts = selectedDate.split('-');
                    if (parts.length === 3) {
                        calYear = parseInt(parts[0]);
                        calMonth = parseInt(parts[1]);
                    }
                }
                const popover = container.querySelector('#ac-period-popover');
                if (popover) popover.style.display = 'none';
                render();
            });
        }

        const statusSelect = container.querySelector('#ac-status-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                selectedStatus = e.target.value;
                isBoardExpanded = false;
                render();
            });
        }

        const instrumentSelect = container.querySelector('#ac-instrument-select');
        if (instrumentSelect) {
            instrumentSelect.addEventListener('change', (e) => {
                selectedInstrument = e.target.value;
                isBoardExpanded = false;
                render();
            });
        }

        const teacherSelect = container.querySelector('#ac-teacher-select');
        if (teacherSelect) {
            teacherSelect.addEventListener('change', (e) => {
                selectedTeacherId = e.target.value;
                isBoardExpanded = false;
                render();
            });
        }

        const searchTypeSelect = container.querySelector('#ac-search-type');
        if (searchTypeSelect) {
            searchTypeSelect.addEventListener('change', (e) => {
                searchType = e.target.value;
                isBoardExpanded = false;
                render();
            });
        }

        const filterDOMRows = (q, type) => {
            const query = q.toLowerCase().replace(/\s+/g, '');
            const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(query);

            const rows = container.querySelectorAll('.ac-student-row');
            rows.forEach(row => {
                const studentId = row.dataset.studentId;
                const student = stateStore.getStudent(studentId);
                if (!student) return;

                let match = false;
                if (!query) {
                    match = true;
                } else if (type === 'name') {
                    const cleanName = student.name.toLowerCase().replace(/\s+/g, '');
                    let nameMatch = false;
                    if (isChosungOnly) {
                        nameMatch = getChosungStr(cleanName).includes(query);
                    } else {
                        nameMatch = cleanName.includes(query);
                    }
                    const phoneMatch = (student.phone && student.phone.replace(/[^0-9]/g, '').includes(query)) ||
                                       (student.parentPhone && student.parentPhone.replace(/[^0-9]/g, '').includes(query));
                    match = nameMatch || phoneMatch;
                } else if (type === 'id') {
                    const studentMemberNo = student.studentMemberNo !== undefined && student.studentMemberNo !== null ? String(student.studentMemberNo) : null;
                    const memberNo = student.memberNo !== undefined && student.memberNo !== null ? String(student.memberNo) : null;
                    const cleanId = student.id.toLowerCase().replace(/\s+/g, '');
                    
                    let idMatch = (cleanId === query);
                    if (!idMatch) {
                        if (studentMemberNo !== null) {
                            idMatch = studentMemberNo.toLowerCase().replace(/\s+/g, '') === query;
                        } else if (memberNo !== null) {
                            idMatch = memberNo.toLowerCase().replace(/\s+/g, '') === query;
                        }
                    }
                    match = idMatch;
                }

                if (match) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        };

        const searchInput = container.querySelector('#ac-search-input');
        if (searchInput) {
            searchInput.addEventListener('compositionstart', () => {
                isComposing = true;
                searchInput.dataset.composing = 'true';
            });
            searchInput.addEventListener('compositionend', (e) => {
                isComposing = false;
                searchInput.dataset.composing = 'false';
                searchQuery = e.target.value;
                filterDOMRows(searchQuery, searchType);
                debounceRender(150);
            });
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                filterDOMRows(searchQuery, searchType);
                if (!isComposing) {
                    debounceRender(150);
                }
            });
        }

        // Range presets click
        const presetBtns = container.querySelectorAll('.ac-preset-btn');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                selectedRangeMode = btn.dataset.range;
                customRangeStart = null;
                customRangeEnd = null;
                const popover = container.querySelector('#ac-period-popover');
                if (popover) popover.style.display = 'none';
                isBoardExpanded = false;
                render();
            });
        });

        // Tabs click
        const tabBtns = container.querySelectorAll('.ac-tab');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                isBoardExpanded = false;
                render();
            });
        });

        // KPI cards click to update status filter
        const kpiCards = container.querySelectorAll('.metric-card');
        kpiCards.forEach(card => {
            card.addEventListener('click', () => {
                selectedStatus = card.dataset.status;
                isBoardExpanded = false;
                render();
            });
        });

        // Urgent banner click & Urgent Queue Toggle
        const urgentBtn = container.querySelector('#ac-urgent-btn');
        if (urgentBtn) {
            urgentBtn.addEventListener('click', () => {
                toggleUrgentQueue();
            });
        }

        // Refresh console button was handled globally in header actions

        // Bind table rows click to select student
        const studentRows = container.querySelectorAll('.ac-student-row');
        studentRows.forEach(row => {
            row.addEventListener('click', () => {
                const sid = row.dataset.studentId;
                selectStudent(sid);
            });
        });

        // Bind warning row click to select student
        const warningRows = container.querySelectorAll('.warning-row');
        warningRows.forEach(row => {
            row.addEventListener('click', () => {
                const sid = row.dataset.studentId;
                selectStudent(sid);
            });
        });

        // Bind compact board mini row click to select student
        const miniRows = container.querySelectorAll('.mini-students .mini-row');
        miniRows.forEach(row => {
            if (row.dataset.studentId) {
                row.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const sid = row.dataset.studentId;
                    selectStudent(sid);
                });
            }
        });

        // Helper to resolve target classTime for a student on a specific date
        const resolveTargetClassTime = (studentId, date) => {
            const dailySchedule = stateStore.getTeacherStudentScheduleForDate(date) || [];
            const studentClasses = dailySchedule.filter(entry => entry.studentId === studentId);
            if (studentClasses.length > 0) {
                return studentClasses[0].time;
            }
            const existing = stateStore.getAttendance().find(a => a.studentId === studentId && a.date === date);
            if (existing && existing.classTime) {
                return existing.classTime;
            }
            const defaultClasses = stateStore.getClassesForStudent(studentId);
            if (defaultClasses.length > 0) {
                return defaultClasses[0].time;
            }
            return '14:00';
        };

        // Helper to get attendance status of student for specific date and classTime
        const getAttendanceStatusForClass = (studentId, date, classTime) => {
            const record = stateStore.getAttendance().find(a => 
                a.studentId === studentId && 
                a.date === date && 
                (a.classTime === classTime || !a.classTime)
            );
            if (record) return record.status;
            
            const dailySchedule = stateStore.getTeacherStudentScheduleForDate(date) || [];
            const entry = dailySchedule.find(e => e.studentId === studentId && e.time === classTime);
            if (entry) {
                const now = new Date();
                const lateThresholdMinutes = stateStore.getLateThresholdMinutes();
                const [classHour, classMin] = classTime.split(':').map(Number);
                const classTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), classHour, classMin);
                const diffMins = (now - classTimeToday) / (1000 * 60);
                
                if (date < now.toISOString().slice(0, 10)) {
                    return 'absent';
                } else if (date === now.toISOString().slice(0, 10)) {
                    if (diffMins > lateThresholdMinutes) {
                        return 'late';
                    }
                }
            }
            return 'none';
        };

        // Common function to open attendance edit modal
        openAttendanceEditModal = (studentId, studentName, date, classTime, currentStatus) => {
            const currentStatusKo = currentStatus === 'present' ? '출석' : (currentStatus === 'late' ? '지각' : (currentStatus === 'absent' ? '결석' : '예정'));
            
            const modalHtml = `
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <h3 style="margin: 0; font-weight: 700; font-size: 1.25rem;">출결 수정</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.8rem; background: rgba(255,255,255,0.03); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color); font-size: 0.9rem;">
                        <div><strong>원생명:</strong> <span style="margin-left: 8px;">${studentName}</span></div>
                        <div><strong>수업일:</strong> <span style="margin-left: 8px;">${date}</span></div>
                        <div><strong>수업시간:</strong> <span style="margin-left: 8px;">${classTime}</span></div>
                        <div><strong>현재 상태:</strong> <span style="margin-left: 8px; font-weight: bold;" class="modal-current-status-text">${currentStatusKo}</span></div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label style="font-weight: 600; font-size: 0.85rem;">변경할 상태</label>
                        <div class="segmented-control" style="display: flex; background: rgba(255,255,255,0.02); padding: 4px; border-radius: var(--radius-md); gap: 4px; border: 1px solid var(--border-color);">
                            <button type="button" class="segment-btn ${currentStatus === 'present' ? 'active' : ''}" data-status="present" style="flex: 1; border: none; padding: 10px 0; border-radius: var(--radius-sm); font-weight: ${currentStatus === 'present' ? '700' : '500'}; cursor: pointer; transition: all 0.2s; background: ${currentStatus === 'present' ? '#27ae60' : 'transparent'}; color: ${currentStatus === 'present' ? '#fff' : 'var(--text-muted)'}; margin-bottom: 0;">출석</button>
                            <button type="button" class="segment-btn ${currentStatus === 'late' ? 'active' : ''}" data-status="late" style="flex: 1; border: none; padding: 10px 0; border-radius: var(--radius-sm); font-weight: ${currentStatus === 'late' ? '700' : '500'}; cursor: pointer; transition: all 0.2s; background: ${currentStatus === 'late' ? '#f39c12' : 'transparent'}; color: ${currentStatus === 'late' ? '#fff' : 'var(--text-muted)'}; margin-bottom: 0;">지각</button>
                            <button type="button" class="segment-btn ${currentStatus === 'absent' ? 'active' : ''}" data-status="absent" style="flex: 1; border: none; padding: 10px 0; border-radius: var(--radius-sm); font-weight: ${currentStatus === 'absent' ? '700' : '500'}; cursor: pointer; transition: all 0.2s; background: ${currentStatus === 'absent' ? '#c0392b' : 'transparent'}; color: ${currentStatus === 'absent' ? '#fff' : 'var(--text-muted)'}; margin-bottom: 0;">결석</button>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 0.5rem;">
                        <button type="button" class="btn btn-secondary" data-close-modal style="width: 100px; padding: 10px; justify-content: center; margin-bottom: 0;">취소</button>
                        <button type="button" class="btn btn-primary" id="btn-submit-attendance-edit" style="width: 120px; padding: 10px; justify-content: center; margin-bottom: 0;">수정하기</button>
                    </div>
                </div>
            `;
            
            openModal(modalHtml, (contentArea) => {
                contentArea.style.maxWidth = '400px';
                contentArea.style.padding = '1.8rem 2rem';
                
                let activeStatus = currentStatus;
                const segmentBtns = contentArea.querySelectorAll('.segment-btn');
                
                segmentBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        segmentBtns.forEach(b => {
                            b.classList.remove('active');
                            b.style.background = 'transparent';
                            b.style.color = 'var(--text-muted)';
                            b.style.fontWeight = '500';
                        });
                        
                        btn.classList.add('active');
                        activeStatus = btn.dataset.status;
                        btn.style.fontWeight = '700';
                        btn.style.color = '#fff';
                        
                        if (activeStatus === 'present') {
                            btn.style.background = '#27ae60';
                        } else if (activeStatus === 'late') {
                            btn.style.background = '#f39c12';
                        } else if (activeStatus === 'absent') {
                            btn.style.background = '#c0392b';
                        }
                    });
                });
                
                const submitBtn = contentArea.querySelector('#btn-submit-attendance-edit');
                submitBtn.addEventListener('click', () => {
                    if (!activeStatus || activeStatus === 'none') {
                        alert('변경할 출결 상태를 선택해주세요.');
                        return;
                    }
                    if (confirm('출결 상태를 수정하시겠습니까?')) {
                        const checkedAt = activeStatus === 'absent' ? null : new Date().toISOString();
                        
                        stateStore.markAttendanceStatus({
                            studentId,
                            date,
                            classTime,
                            status: activeStatus,
                            checkedAt,
                            source: 'director_manual'
                        });
                        
                        closeModal();
                        renderDirectorAttendanceControl(container);
                    }
                });
            });
        };

        // Bind click event for Daily schedule table Edit button
        const editBtns = container.querySelectorAll('.ac-edit-btn');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const studentId = btn.dataset.studentId;
                const studentName = btn.dataset.studentName;
                const date = btn.dataset.date;
                const classTime = btn.dataset.time;
                const rawStatus = btn.dataset.status;
                const currentStatus = rawStatus === '출석' ? 'present' : (rawStatus === '지각' ? 'late' : (rawStatus === '결석' ? 'absent' : ''));
                
                openAttendanceEditModal(studentId, studentName, date, classTime, currentStatus);
            });
        });

        // Bind click event for Student-wise view Edit button
        const studentEditBtns = container.querySelectorAll('.ac-student-edit-btn');
        studentEditBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const studentId = btn.dataset.studentId;
                const studentName = btn.dataset.studentName;
                
                const date = selectedDate;
                const classTime = resolveTargetClassTime(studentId, date);
                const currentStatus = getAttendanceStatusForClass(studentId, date, classTime);
                
                openAttendanceEditModal(studentId, studentName, date, classTime, currentStatus);
            });
        });

        // Toggle class / teacher group list open/close
        const toggleBtns = container.querySelectorAll('.toggle-group-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.group-card');
                if (card) {
                    const isOpen = card.classList.toggle('open');
                    btn.textContent = isOpen ? '명단 접기' : '명단 펼치기';
                }
            });
        });

        // Drawer close
        const closeBtn = container.querySelector('#ac-drawer-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeInspector);
        }

        const backdrop = container.querySelector('#ac-drawer-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeInspector);
        }

        // Draw calendar grid
        drawCalendarGrid(calYear, calMonth);

        // Period popover toggle event
        const periodBtn = container.querySelector('#ac-period-btn');
        const periodPopover = container.querySelector('#ac-period-popover');
        if (periodBtn && periodPopover) {
            periodBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = periodPopover.style.display === 'none';
                periodPopover.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    drawCalendarGrid(calYear, calMonth);
                }
            });
            
            periodPopover.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Calendar prev/next month buttons
        const prevCalBtn = container.querySelector('#ac-cal-prev-btn');
        const nextCalBtn = container.querySelector('#ac-cal-next-btn');
        if (prevCalBtn) {
            prevCalBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                calMonth--;
                if (calMonth < 1) {
                    calMonth = 12;
                    calYear--;
                }
                drawCalendarGrid(calYear, calMonth);
            });
        }
        if (nextCalBtn) {
            nextCalBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                calMonth++;
                if (calMonth > 12) {
                    calMonth = 1;
                    calYear++;
                }
                drawCalendarGrid(calYear, calMonth);
            });
        }

        // If a student was selected, keep drawer open on re-render
        if (selectedStudentId) {
            selectStudent(selectedStudentId, false);
        }

        // Keep urgent queue panel updated on re-render if it was open
        const panel = container.querySelector('#ac-urgent-queue-panel');
        if (panel && panel.classList.contains('open')) {
            panel.style.display = 'block';
            drawUrgentQueueList();
        }
    };

    const drawUrgentQueueList = () => {
        const panel = container.querySelector('#ac-urgent-queue-panel');
        if (!panel) return;

        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const urgent = getPeriodUrgentList(rangeDates);

        if (urgent.length > 0) {
            panel.innerHTML = `
                <div class="action-list" style="display:grid; gap:8px; padding:12px;">
                    ${urgent.map(row => {
                        let badgeTone = row.status === '지각' ? 'warn' : 'danger';
                        const reasonText = row.note || (row.status === '지각' ? '지각 등원' : '결석 확인 필요');
                        const dateLabel = selectedRangeMode === 'today' ? '' : `${row.date} `;
                        return `
                            <div class="action-item ac-queue-item" data-student-id="${row.student.id}" style="display:flex; align-items:center; justify-content:space-between; padding:9px 10px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-card); cursor:pointer; box-sizing:border-box;">
                                <div class="ac-queue-info" style="flex: 1;">
                                    <b style="font-size:13px; color:var(--text-main);">${row.student.name}</b>
                                    <small style="display:block; font-size:11px; color:var(--text-muted); margin-top:2px;">${dateLabel}${row.time} · ${reasonText}</small>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span class="badge ${badgeTone}">${row.status}</span>
                                    <button class="btn mini-btn ac-queue-edit-btn" data-student-id="${row.student.id}" data-student-name="${row.student.name}" data-date="${row.date}" data-time="${row.time}" data-status="${row.status}" style="padding: 2px 6px; font-size: 10px; height: 20px; line-height: 14px; border: 1px solid var(--border-color); color: var(--text-main); background: transparent; border-radius: 4px; font-weight: 700; cursor: pointer; margin-bottom: 0;">출결수정</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            panel.querySelectorAll('.ac-queue-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const studentId = btn.dataset.studentId;
                    const studentName = btn.dataset.studentName;
                    const date = btn.dataset.date;
                    const classTime = btn.dataset.time;
                    const rawStatus = btn.dataset.status;
                    const currentStatus = rawStatus === '출석' ? 'present' : (rawStatus === '지각' ? 'late' : (rawStatus === '결석' ? 'absent' : ''));
                    openAttendanceEditModal(studentId, studentName, date, classTime, currentStatus);
                });
            });

            panel.querySelectorAll('.ac-queue-info').forEach(info => {
                info.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = info.closest('.ac-queue-item');
                    const sid = item.dataset.studentId;
                    selectStudent(sid);
                });
            });
        } else {
            const noQueueText = selectedRangeMode === 'today' ? '오늘 처리할 결석/지각 큐가 없습니다.' : '선택 기간 처리할 결석/지각 큐가 없습니다.';
            panel.innerHTML = `<div class="placeholder-panel" style="padding:16px; text-align:center; color:var(--text-muted); font-size:13px;">${noQueueText}</div>`;
        }
    };

    const toggleUrgentQueue = () => {
        const panel = container.querySelector('#ac-urgent-queue-panel');
        if (!panel) return;
        
        const isOpen = panel.classList.toggle('open');
        if (isOpen) {
            panel.style.display = 'block';
            drawUrgentQueueList();
        } else {
            panel.style.display = 'none';
        }
    };

    const selectStudent = (studentId, shouldOpen = true) => {
        selectedStudentId = studentId;
        const students = stateStore.getStudents();
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        // Retrieve 30-day fixed stats for inspector drawer display
        const statsMap30Days = get30DaysAttendanceStats(selectedDate, students, currentAttendance);
        const studentStats = statsMap30Days[studentId] || {
            total: 0,
            present: 0,
            late: 0,
            absent: 0,
            scheduled: 0,
            history: [],
            attendanceRate: null,
            lastStatus: '예정'
        };

        const teachersList = stateStore.getTeachers();
        const teacherObj = student ? teachersList.find(t => t.id === student.teacherId) : null;
        const teacherName = teacherObj ? (teacherObj.employmentStatus === 'resigned' ? `${teacherObj.name} (퇴사)` : teacherObj.name) : '미배정';

        // 1. Profile information
        const avatar = container.querySelector('#ac-inspector-avatar');
        const name = container.querySelector('#ac-inspector-name');
        const meta = container.querySelector('#ac-inspector-meta');
        
        if (avatar) avatar.textContent = student.name[0];
        if (name) name.textContent = student.name;
        if (meta) {
            const memberNoText = student.studentMemberNo || student.memberNo || student.id;
            const isAdultText = (student.isAdult === true || student.isAdult === 'adult') ? '성인' : ((student.isAdult === false || student.isAdult === 'minor') ? '비성인' : '-');
            const ageText = student.age ? `${student.age}세` : '';
            const adultAgeInfo = [isAdultText !== '-' ? isAdultText : '', ageText].filter(Boolean).join(' · ');
            const phoneText = student.phone ? `본인: ${student.phone}` : '';
            const parentNameText = student.parentName ? `보호자명: ${student.parentName}` : '';
            const parentPhoneText = student.parentPhone ? `보호자1: ${student.parentPhone}` : '';
            const parentPhone2Text = student.parentPhone2 ? `보호자2: ${student.parentPhone2}` : '';

            const contactItems = [];
            if (phoneText) contactItems.push(`<div>${phoneText}</div>`);
            if (parentNameText) contactItems.push(`<div>${parentNameText}</div>`);
            if (parentPhoneText) contactItems.push(`<div>${parentPhoneText}</div>`);
            if (parentPhone2Text) contactItems.push(`<div>${parentPhone2Text}</div>`);
            
            const contactsHtml = contactItems.join('');

            meta.innerHTML = `
                <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">
                    회원번호: #${memberNoText}
                </div>
                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
                    악기/반: ${student.instrument || '미지정'} · 강사: ${teacherName}
                </div>
                ${adultAgeInfo ? `<div style="font-size:13px; color:var(--text-muted); margin-top:2px;">구분: ${adultAgeInfo}</div>` : ''}
                ${contactsHtml ? `
                    <div class="ac-inspector-contacts" style="font-size:13px; color:var(--text-muted); margin-top:6px; font-weight:600; line-height:1.4; word-break:break-all;">
                        ${contactsHtml}
                    </div>
                ` : ''}
            `;
        }

        // 2. Stats Summary
        const statDone = container.querySelector('#ac-inspector-stat-done');
        const statPresent = container.querySelector('#ac-inspector-stat-present');
        const statLate = container.querySelector('#ac-inspector-stat-late');
        const statAbsent = container.querySelector('#ac-inspector-stat-absent');
        const statRate = container.querySelector('#ac-inspector-stat-rate');

        if (statDone) statDone.textContent = studentStats.total;
        if (statPresent) statPresent.textContent = studentStats.present;
        if (statLate) statLate.textContent = studentStats.late;
        if (statAbsent) statAbsent.textContent = studentStats.absent;
        if (statRate) statRate.textContent = studentStats.attendanceRate !== null ? `${studentStats.attendanceRate}%` : '-';

        // 3. Warnings stack
        const warningStack = container.querySelector('#ac-inspector-warning-list');
        const warningCount = container.querySelector('#ac-inspector-warning-count');
        const activeWarnings = [];
        
        if (studentStats.absent >= 2) {
            activeWarnings.push({ label: '결석 잦음', detail: `최근 4주 결석 ${studentStats.absent}회` });
        }
        if (studentStats.attendanceRate !== null && studentStats.attendanceRate < 80) {
            activeWarnings.push({ label: '출결률 저조', detail: `최근 4주 출석률 ${studentStats.attendanceRate}%` });
        }
        
        if (warningCount) warningCount.textContent = activeWarnings.length ? `워닝 ${activeWarnings.length}건` : '정상';
        if (warningStack) {
            if (activeWarnings.length > 0) {
                warningStack.innerHTML = activeWarnings.map(w => `
                    <div class="warning-box danger">
                        <b>${w.label}</b>
                        <span>${w.detail}</span>
                    </div>
                `).join('');
            } else {
                warningStack.innerHTML = `
                    <div class="warning-box muted">
                        <b>정상 범위</b>
                        <span>이상 없음</span>
                    </div>
                `;
            }
        }

        // 18B-8: Enrollments information (using stateStore adapter and unified formats)
        const enrollmentsBox = container.querySelector('#ac-inspector-enrollments-box');
        if (enrollmentsBox) {
            const enrollments = stateStore.getStudentEnrollments(studentId) || [];
            if (enrollments.length > 0) {
                enrollmentsBox.innerHTML = enrollments.map(e => renderEnrollmentRowForInspector(e, stateStore)).join('');
            } else {
                enrollmentsBox.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); padding: 6px 8px;">수강중인 과목 없음</div>`;
            }
        }

        // 4. Tuition/Payment information
        const studentPayments = stateStore.getPaymentsForStudent(studentId) || [];
        studentPayments.sort((a, b) => b.month.localeCompare(a.month));
        const unpaidPayments = studentPayments.filter(p => p.status === 'unpaid' || p.status === 'requested');

        const tuitionBox = container.querySelector('#ac-inspector-tuition-box');
        if (tuitionBox) {
            if (studentPayments.length > 0) {
                const htmlList = studentPayments.map(p => {
                    const statusKo = p.status === 'paid' ? '완납' : (p.status === 'requested' ? '결제요청' : '미납');
                    const statusColor = p.status === 'paid' ? '#2ecc71' : (p.status === 'requested' ? '#f1c40f' : '#e74c3c');
                    const paidDateText = p.paidDate ? ` (결제일: ${p.paidDate})` : '';
                    
                    let paymentTitle = `${p.month.slice(0, 4)}년 ${p.month.slice(5, 7)}월 수강료`;
                    if (p.type === 'book') {
                        const book = stateStore.getBook ? stateStore.getBook(p.bookId) : null;
                        paymentTitle = `${p.month.slice(0, 4)}년 ${p.month.slice(5, 7)}월 교재비 [${book ? book.name : '교재'}]`;
                    }
                    
                    return `
                        <div style="padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.01); margin-top: 6px; font-size: 14px; line-height: 1.5;">
                            <div style="display:flex; justify-content:space-between; font-weight:700;">
                                <span>${paymentTitle}</span>
                                <span style="color: ${statusColor};">${statusKo}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; margin-top:4px; color:var(--text-muted); font-size:13px;">
                                <span>청구액: ${p.amount.toLocaleString()}원</span>
                                <span>${paidDateText}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                
                tuitionBox.className = unpaidPayments.length > 0 ? 'tuition-notice overdue' : 'tuition-notice';
                tuitionBox.style.background = 'transparent';
                tuitionBox.style.border = 'none';
                tuitionBox.style.padding = '0';
                tuitionBox.innerHTML = htmlList;
            } else {
                tuitionBox.className = 'tuition-notice';
                tuitionBox.style.background = '';
                tuitionBox.style.border = '';
                tuitionBox.style.padding = '';
                tuitionBox.innerHTML = `
                    <div class="tuition-notice-head">
                        <span id="ac-inspector-tuition-state">연동 대기</span>
                        <span id="ac-inspector-tuition-due">-</span>
                    </div>
                    <div class="tuition-notice-body" id="ac-inspector-tuition-text">
                        등록된 청구/결제 정보가 없습니다.
                    </div>
                `;
            }
        }

        // 4b. Leave/Withdrawal History Information
        const leaveHistoryBox = container.querySelector('#ac-inspector-leave-history-box');
        if (leaveHistoryBox) {
            let leavePeriods = [];
            if (student.leavePeriods && student.leavePeriods.length > 0) {
                leavePeriods = [...student.leavePeriods];
            } else if (student.leaveStartDate && student.leaveEndDate) {
                leavePeriods = [{ startDate: student.leaveStartDate, endDate: student.leaveEndDate }];
            }

            leavePeriods.sort((a, b) => b.startDate.localeCompare(a.startDate));

            const today = new Date().toISOString().slice(0, 10);
            let activePeriod = null;
            if (student.status === 'on_leave') {
                activePeriod = leavePeriods.find(p => p.startDate <= today && today <= p.endDate);
            }

            const calculateLeaveDays = (start, end) => {
                if (!start || !end) return 0;
                const s = new Date(start);
                const e = new Date(end);
                if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
                const diff = e.getTime() - s.getTime();
                if (diff < 0) return 0;
                return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
            };

            const hasWithdrawal = student.withdrawalDate || student.leaveDate;

            if (leavePeriods.length === 0 && !hasWithdrawal) {
                leaveHistoryBox.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">이력 없음</div>`;
            } else {
                const statusText = student.status === 'withdrawn' ? '퇴원' : (student.status === 'on_leave' ? '휴원' : '재원');
                
                let activePeriodHtml = '';
                if (student.status === 'on_leave' && activePeriod) {
                    const days = calculateLeaveDays(activePeriod.startDate, activePeriod.endDate);
                    activePeriodHtml = `
                        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:13px; color:var(--text-muted);">
                            <span>현재 휴원 기간</span>
                            <strong style="color: var(--text-main);">${activePeriod.startDate} ~ ${activePeriod.endDate} (${days}일)</strong>
                        </div>
                    `;
                }

                let withdrawalHtml = '';
                if (hasWithdrawal) {
                    withdrawalHtml = `
                        <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:13px; color:var(--text-muted);">
                            <span>퇴원일</span>
                            <strong style="color: var(--text-main);">${student.withdrawalDate || student.leaveDate}</strong>
                        </div>
                    `;
                }

                let periodsListHtml = '';
                if (leavePeriods.length > 0) {
                    const items = leavePeriods.map(p => {
                        const days = calculateLeaveDays(p.startDate, p.endDate);
                        return `
                            <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:13px; color:var(--text-muted);">
                                <span>휴원 ${p.startDate} ~ ${p.endDate}</span>
                                <span>(${days}일)</span>
                            </div>
                        `;
                    }).join('');
                    
                    periodsListHtml = `
                        <div style="margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                            <div style="font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:4px;">휴원 이력:</div>
                            ${items}
                        </div>
                    `;
                }

                leaveHistoryBox.innerHTML = `
                    <div style="display:flex; justify-content:space-between; font-weight:700; font-size:14px; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                        <span>현재 상태</span>
                        <span>${statusText}</span>
                    </div>
                    ${activePeriodHtml}
                    ${withdrawalHtml}
                    ${periodsListHtml}
                `;
            }
        }

        // 5. Mini calendar (30 days)
        const calMini = container.querySelector('#ac-inspector-calendar-mini');
        if (calMini) {
            const todayStr = new Date().toISOString().slice(0, 10);
            const rangeDates = get30DaysRange(selectedDate);
            
            calMini.innerHTML = rangeDates.map(date => {
                const dayNum = parseInt(date.slice(8, 10));
                const historyEntry = studentStats.history.find(h => h.date === date);
                
                let tone = '';
                if (historyEntry) {
                    if (historyEntry.status === '출석') tone = 'present';
                    else if (historyEntry.status === '지각') tone = 'late';
                    else if (historyEntry.status === '결석') tone = 'absent';
                }
                
                const isHighlighted = (date === selectedDate || date === todayStr) ? 'today' : '';
                return `<div class="cal-cell ${tone} ${isHighlighted}" title="${date} (${historyEntry ? historyEntry.status : '수업 없음'})">${dayNum}</div>`;
            }).join('');
        }

        // 6. Recent Attendance History List
        const historyList = container.querySelector('#ac-inspector-history-list');
        const historyCount = container.querySelector('#ac-inspector-history-count');
        if (historyCount) historyCount.textContent = `${studentStats.history.length}건`;
        if (historyList) {
            if (studentStats.history.length > 0) {
                historyList.innerHTML = studentStats.history.map(h => {
                    const getDayOfWeekKo = (dateStr) => {
                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                        const [y, m, d] = dateStr.split('-').map(Number);
                        const dayIndex = new Date(y, m - 1, d).getDay();
                        return days[dayIndex];
                    };
                    const dayOfWeekKo = getDayOfWeekKo(h.date);
                    
                    let statusBadge = `<span class="badge gray" style="font-size:0.75rem;">예정</span>`;
                    if (h.status === '출석') statusBadge = `<span class="badge good" style="font-size:0.75rem;">출석</span>`;
                    else if (h.status === '지각') statusBadge = `<span class="badge warn" style="font-size:0.75rem;">지각</span>`;
                    else if (h.status === '결석') statusBadge = `<span class="badge danger" style="font-size:0.75rem;">결석</span>`;
                    else if (h.status === '휴원') statusBadge = `<span class="badge" style="font-size:0.75rem; background: #64748b; color: #ffffff;">휴원</span>`;

                    const checkTimeText = h.checkTime ? `${h.checkTime}${h.leavingTime ? ' ~ ' + h.leavingTime : ''}` : '-';

                    return `
                        <div class="log-item" style="margin-top: 6px;">
                            <div class="log-item-head">
                                <span>${h.date} (${dayOfWeekKo}) ${h.time}</span>
                                ${statusBadge}
                            </div>
                            <div class="log-item-body" style="margin-top:4px; font-size:14px; color:var(--text-muted); line-height:1.5;">
                                <div>등하원: <b>${checkTimeText}</b></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                historyList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.75rem;">출결 이력이 없습니다.</div>`;
            }
        }

        // 6b. Recent Audit Logs (Phase 9C-5E)
        const auditList = container.querySelector('#ac-inspector-audit-list');
        const auditCount = container.querySelector('#ac-inspector-audit-count');
        const auditLogs = stateStore.getAttendanceChangeLogs({ studentId }).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
        
        // Show only the 3~5 most recent logs
        const recentAuditLogs = auditLogs.slice(0, 5);

        if (auditCount) auditCount.textContent = `${auditLogs.length}건`;
        if (auditList) {
            if (recentAuditLogs.length > 0) {
                auditList.innerHTML = recentAuditLogs.map(log => {
                    const statusMapping = {
                        present: '출석',
                        late: '지각',
                        absent: '결석',
                        null: '예정'
                    };
                    const prevText = statusMapping[log.previousStatus] || '예정';
                    const nextText = statusMapping[log.nextStatus] || '예정';
                    const prevBadgeClass = log.previousStatus === 'present' ? 'good' : (log.previousStatus === 'late' ? 'warn' : (log.previousStatus === 'absent' ? 'danger' : 'gray'));
                    const nextBadgeClass = log.nextStatus === 'present' ? 'good' : (log.nextStatus === 'late' ? 'warn' : (log.nextStatus === 'absent' ? 'danger' : 'gray'));
                    
                    const timeLabel = log.classTime ? ` (${log.classTime})` : '';
                    const formatChangedAt = (isoStr) => {
                        const d = new Date(isoStr);
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const hrs = String(d.getHours()).padStart(2, '0');
                        const mins = String(d.getMinutes()).padStart(2, '0');
                        return `${m}/${day} ${hrs}:${mins}`;
                    };
                    const dateDisplay = formatChangedAt(log.changedAt);

                    return `
                        <div class="log-item" style="margin-top: 6px; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.01);">
                            <div class="log-item-head" style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                                <span><b>${log.date}</b>${timeLabel}</span>
                                <span style="font-size: 11px; color: var(--text-muted);">${dateDisplay}</span>
                            </div>
                            <div class="log-item-body" style="margin-top: 4px; display: flex; align-items: center; gap: 6px; font-size: 13px;">
                                <span class="badge ${prevBadgeClass}" style="font-size:10px; padding: 2px 4px;">${prevText}</span>
                                <span style="color: var(--text-muted); font-size: 11px;">→</span>
                                <span class="badge ${nextBadgeClass}" style="font-size:10px; padding: 2px 4px;">${nextText}</span>
                                <span style="margin-left: auto; font-size: 11px; color: var(--text-muted);">수동변경</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                auditList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.75rem;">변경 이력이 없습니다.</div>`;
            }
        }

        // 7. Recent Message History Logs
        const msgList = container.querySelector('#ac-inspector-msg-list');
        const msgCount = container.querySelector('#ac-inspector-msg-count');
        const realMessages = stateStore.getMessagesForStudent(studentId) || [];
        realMessages.sort((a, b) => (b.created_at || b.date).localeCompare(a.created_at || a.date));
        
        if (msgCount) msgCount.textContent = `${realMessages.length}건`;
        if (msgList) {
            if (realMessages.length > 0) {
                msgList.innerHTML = realMessages.map(msg => {
                    const formattedDate = msg.created_at ? msg.created_at.slice(5, 16).replace('T', ' ') : msg.date;
                    const statusText = '발송완료';
                    return `
                        <div class="log-item" style="margin-top: 6px;">
                            <div class="log-item-head" style="align-items: flex-start; gap: 8px;">
                                <span style="flex: 1; min-width: 0; word-break: break-all;">■ 제목: ${msg.title} (알림톡)</span>
                                <span style="color:#2ecc71; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center;">${statusText}</span>
                            </div>
                            <div class="log-item-body" style="margin-top:4px; font-size:14px; line-height:1.5;">
                                ${msg.content || ''}
                                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">${formattedDate}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                msgList.innerHTML = `<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.75rem;">메시지 전송 이력이 없습니다.</div>`;
            }
        }

        // 8. Dynamic Date range for recent 4 weeks in history title
        const historyTitle = container.querySelector('#ac-inspector-history-section-title');
        if (historyTitle) {
            const end = new Date(selectedDate);
            const start = new Date(selectedDate);
            start.setDate(start.getDate() - 27);
            const formatLocalDate = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const date = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${date}`;
            };
            historyTitle.textContent = `최근 4주 출결 요약 (${formatLocalDate(start)} ~ ${formatLocalDate(end)})`;
        }

        // 9. Bind Drawer Footer Buttons (using cloneNode to prevent duplicate listeners)
        const btnMessage = container.querySelector('#ac-inspector-btn-message');
        const btnDetail = container.querySelector('#ac-inspector-btn-detail');
        if (btnMessage) {
            const newBtnMessage = btnMessage.cloneNode(true);
            btnMessage.parentNode.replaceChild(newBtnMessage, btnMessage);
            newBtnMessage.addEventListener('click', (e) => {
                e.stopPropagation();
                const commMenuItem = document.querySelector('.menu-item[data-view="dir-communication"]');
                if (commMenuItem) {
                    closeInspector();
                    commMenuItem.click();
                } else {
                    alert('메시지 보내기 기능은 다음 단계에서 구현됩니다.');
                }
            });
        }
        if (btnDetail) {
            const newBtnDetail = btnDetail.cloneNode(true);
            btnDetail.parentNode.replaceChild(newBtnDetail, btnDetail);
            newBtnDetail.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!openStudentDetailModalRef) {
                    await import('./membersView.js');
                }
                if (openStudentDetailModalRef) {
                    closeInspector();
                    openStudentDetailModalRef(studentId);
                }
            });
        }

        // Slide open panel
        if (shouldOpen) {
            const panel = container.querySelector('#ac-inspector-panel');
            const backdrop = container.querySelector('#ac-drawer-backdrop');
            if (panel) panel.classList.add('open');
            if (backdrop) backdrop.classList.add('open');
        }
    };

    const closeInspector = () => {
        selectedStudentId = null;
        const panel = container.querySelector('#ac-inspector-panel');
        const backdrop = container.querySelector('#ac-drawer-backdrop');
        if (panel) panel.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
    };

    render();

    // Subscribe to stores to reflect state changes
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', render);
    const unsubClasses = stateStore.subscribe('CLASSES_CHANGED', render);
    const unsubAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', render);

    return () => {
        unsubStudents();
        unsubTeachers();
        unsubClasses();
        unsubAttendance();
        document.removeEventListener('click', handleDocumentClick);

        // Clean up global header actions and restore defaults
        const dynamicActions = document.getElementById('ac-global-header-actions');
        if (dynamicActions) {
            dynamicActions.remove();
        }
        if (settingsQuickBar) settingsQuickBar.style.display = '';
        if (currentDateEl) currentDateEl.style.display = '';
    };
}

function renderEnrollmentRowForInspector(e, stateStore) {
    const tName = stateStore.formatEnrollmentTeacherName(e);
    const courseType = e.courseType || e.billingType || 'monthly';
    const badgeHtml = e.source === 'legacy' ? `<span style="background: #eef2f3; color: #7f8c8d; font-size: 0.7rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; margin-left: 4px; display: inline-block;">기존 등록</span>` : '';
    
    if (courseType === 'monthly') {
        return `
            <div style="padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.01); font-size: 13px; line-height: 1.4;">
                <div style="font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                    <span>${e.subject || e.instrument || '미지정 과목'} · ${tName} · 월정액 · 월 ${e.fee ? e.fee.toLocaleString() : 0}원</span>
                    ${badgeHtml}
                </div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">
                    기본 ${e.defaultClassDuration || 50}분 · 납부일 ${e.dueDay || 10}일
                </div>
            </div>
        `;
    } else {
        const summary = stateStore.getSessionPassSummaryForEnrollment(e.id);
        let total = e.totalSessions !== undefined ? e.totalSessions : 10;
        let remaining = e.remainingSessions !== undefined ? e.remainingSessions : 10;
        let expiresAt = null;
        let statusBadgeHtml = '';
        let textSuffix = '';

        if (summary) {
            total = summary.totalSessions !== undefined ? summary.totalSessions : total;
            remaining = summary.remainingSessions !== undefined ? summary.remainingSessions : remaining;
            expiresAt = summary.expiresAt;
            if (summary.isEmpty) {
                statusBadgeHtml = `<span style="background: #e74c3c; color: white; font-size: 0.7rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; margin-left: 4px; display: inline-block;">소진</span>`;
                textSuffix = ' · 소진';
            } else if (summary.isExpired) {
                statusBadgeHtml = `<span style="background: #7f8c8d; color: white; font-size: 0.7rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; margin-left: 4px; display: inline-block;">만료</span>`;
                textSuffix = ' · 만료';
            } else if (summary.isLowBalance) {
                statusBadgeHtml = `<span style="background: #e67e22; color: white; font-size: 0.7rem; padding: 1px 4px; border-radius: 4px; font-weight: 600; margin-left: 4px; display: inline-block;">충전 필요</span>`;
                textSuffix = ' · 충전 필요';
            }
        }

        const subjectText = e.subject || e.subjectName || e.instrument || '미지정 과목';
        const expireText = expiresAt ? ` · 만료 ${expiresAt}` : '';

        return `
            <div style="padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(0,0,0,0.01); font-size: 13px; line-height: 1.4;">
                <div style="font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                    <span>${subjectText} · ${tName} · 횟수제 · 잔여 ${remaining}/${total}회${textSuffix}</span>
                    ${statusBadgeHtml}
                    ${badgeHtml}
                </div>
                <div style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">
                    기본 ${e.defaultClassDuration || 50}분${expireText}
                </div>
            </div>
        `;
    }
}
