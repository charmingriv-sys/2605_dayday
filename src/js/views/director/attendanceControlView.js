import { stateStore } from '../../state.js';
import { formatPhoneNumber, showKakaoTalkToast } from './shared.js';

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
    let selectedDate = new Date().toISOString().slice(0, 10);
    let selectedStatus = '전체'; // '전체', '출석', '지각', '결석', '미확인', '하원누락'
    let selectedInstrument = '전체';
    let selectedTeacherId = '전체';
    let searchQuery = '';
    let searchType = 'name'; // 'name' | 'id'
    
    // UI state
    let selectedStudentId = null;
    let isComposing = false;
    let searchDebounceTimer = null;

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
            className: stud ? stud.instrument : '피아노',
            teacher: stud ? (teachersList.find(t => t.id === stud.teacherId)?.name || '미배정') : '미배정',
            status: stud ? (absentCount > 1 ? '결석' : '출석') : '예정',
            reason: absentCount > 1 ? '미등원 (사유 확인필요)' : '정상 수업',
            warningLabel: absentCount > 1 ? '미등원 연속' : '',
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
        const attendance = stateStore.getAttendance();

        // 1. Process attendance lists for the selected date
        const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
        const targetDateObj = new Date(selectedDate);
        const dayOfWeekKo = daysKo[targetDateObj.getDay()];

        // Generate base rows from schedule snapshots / overrides using the unified API
        const dailySchedule = stateStore.getTeacherStudentScheduleForDate(selectedDate) || [];
        const dailyClasses = dailySchedule
            .map(entry => {
                const s = students.find(stud => stud.id === entry.studentId);
                const t = teachers.find(teach => teach.id === entry.teacherId) || (s ? teachers.find(teach => teach.id === s.teacherId) : null);
                const att = s ? attendance.find(a => a.studentId === s.id && a.date === selectedDate) : null;
                
                // Determine display status based on class time and attendance record
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
                    // Check if class time has passed today (default 지연 기준: 15분)
                    const [classHour, classMin] = entry.time.split(':').map(Number);
                    const now = new Date();
                    const classTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), classHour, classMin);
                    const diffMins = (now - classTimeToday) / (1000 * 60);
                    
                    if (selectedDate < now.toISOString().slice(0, 10)) {
                        status = '결석'; // Past date defaults to absent
                    } else if (selectedDate === now.toISOString().slice(0, 10)) {
                        if (diffMins > 15) {
                            status = '지각'; // Overdue class today is mapped to late (지각)
                        }
                    }
                }

                return {
                    classId: entry.id,
                    time: entry.time,
                    student: s,
                    teacher: t,
                    status: status,
                    checkTime: checkTime,
                    leavingTime: leavingTime,
                    note: note,
                    instrument: s ? s.instrument : ''
                };
            })
            .filter(row => row.student); // Ensure student exists

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
                    const nameMatch = row.student.name.toLowerCase().replace(/\s+/g, '').includes(query);
                    const phoneMatch = (row.student.phone && row.student.phone.replace(/[^0-9]/g, '').includes(query)) ||
                                       (row.student.parentPhone && row.student.parentPhone.replace(/[^0-9]/g, '').includes(query));
                    if (!nameMatch && !phoneMatch) return false;
                } else if (searchType === 'id') {
                    const studentMemberNo = row.student.studentMemberNo !== undefined && row.student.studentMemberNo !== null ? String(row.student.studentMemberNo) : null;
                    const memberNo = row.student.memberNo !== undefined && row.student.memberNo !== null ? String(row.student.memberNo) : null;
                    
                    let idMatch = false;
                    if (studentMemberNo !== null) {
                        const cleanMemberNo = studentMemberNo.toLowerCase().replace(/\s+/g, '');
                        idMatch = cleanMemberNo === query || cleanMemberNo.includes(query);
                    } else if (memberNo !== null) {
                        const cleanMemberNo = memberNo.toLowerCase().replace(/\s+/g, '');
                        idMatch = cleanMemberNo === query || cleanMemberNo.includes(query);
                    } else {
                        const cleanId = row.student.id.toLowerCase().replace(/\s+/g, '');
                        idMatch = cleanId === query;
                    }
                    if (!idMatch) return false;
                }
            }
            return true;
        });

        // Sort rows by time
        filteredRows.sort((a, b) => a.time.localeCompare(b.time));

        // 30-day range and attendance stats calculation helpers
        const get30DaysRange = (dateStr) => {
            const end = new Date(dateStr);
            const start = new Date(dateStr);
            start.setDate(start.getDate() - 29);
            
            const dates = [];
            let current = new Date(start);
            while (current <= end) {
                dates.push(current.toISOString().slice(0, 10));
                current.setDate(current.getDate() + 1);
            }
            return dates;
        };

        const get30DaysAttendanceStats = (dateStr) => {
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

                    const att = attendance.find(a => a.studentId === sId && a.date === date);
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

                        if (date < todayStr) {
                            status = '결석';
                        } else if (date === todayStr) {
                            if (diffMins > 15) {
                                status = '지각';
                            }
                        }
                    }

                    statsMap[sId].total++;
                    if (status === '출석') statsMap[sId].present++;
                    else if (status === '지각') statsMap[sId].late++;
                    else if (status === '결석') statsMap[sId].absent++;
                    else statsMap[sId].scheduled++;

                    statsMap[sId].history.push({ date, time: entry.time, status, checkTime, leavingTime });
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

        const statsMap = get30DaysAttendanceStats(selectedDate);

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
                    const nameMatch = item.student.name.toLowerCase().replace(/\s+/g, '').includes(query);
                    const phoneMatch = (item.student.phone && item.student.phone.replace(/[^0-9]/g, '').includes(query)) ||
                                       (item.student.parentPhone && item.student.parentPhone.replace(/[^0-9]/g, '').includes(query));
                    if (!nameMatch && !phoneMatch) return false;
                } else if (searchType === 'id') {
                    const studentMemberNo = item.student.studentMemberNo !== undefined && item.student.studentMemberNo !== null ? String(item.student.studentMemberNo) : null;
                    const memberNo = item.student.memberNo !== undefined && item.student.memberNo !== null ? String(item.student.memberNo) : null;
                    
                    let idMatch = false;
                    if (studentMemberNo !== null) {
                        const cleanMemberNo = studentMemberNo.toLowerCase().replace(/\s+/g, '');
                        idMatch = cleanMemberNo === query || cleanMemberNo.includes(query);
                    } else if (memberNo !== null) {
                        const cleanMemberNo = memberNo.toLowerCase().replace(/\s+/g, '');
                        idMatch = cleanMemberNo === query || cleanMemberNo.includes(query);
                    } else {
                        const cleanId = item.student.id.toLowerCase().replace(/\s+/g, '');
                        idMatch = cleanId === query;
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
                            <th>예정 수업</th>
                            <th>출석</th>
                            <th>지각</th>
                            <th>결석</th>
                            <th>출석률</th>
                            <th>오늘/최근 상태</th>
                            <th>특이사항</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(item => {
                            const memberNoText = item.student.studentMemberNo || item.student.memberNo || item.student.id;
                            let statusBadge = `<span class="badge gray">예정</span>`;
                            if (item.stats.lastStatus === '출석') statusBadge = `<span class="badge good">✓ 출석</span>`;
                            else if (item.stats.lastStatus === '지각') statusBadge = `<span class="badge warn">! 지각</span>`;
                            else if (item.stats.lastStatus === '결석') statusBadge = `<span class="badge danger">× 결석</span>`;

                            return `
                                <tr class="ac-student-row ${item.student.id === selectedStudentId ? 'selected' : ''}" data-student-id="${item.student.id}">
                                    <td>${memberNoText}</td>
                                    <td>
                                        <div class="student-cell">
                                            <button class="student-link" style="font-weight:900;">${item.student.name}</button>
                                        </div>
                                    </td>
                                    <td>${item.student.instrument || '미지정'}</td>
                                    <td>${item.teacher ? item.teacher.name : '미배정'}</td>
                                    <td>${item.stats.total}회</td>
                                    <td>${item.stats.present}회</td>
                                    <td>${item.stats.late}회</td>
                                    <td>${item.stats.absent}회</td>
                                    <td><b>${item.stats.attendanceRate !== null ? `${item.stats.attendanceRate}%` : '-'}</b></td>
                                    <td>${statusBadge}</td>
                                    <td style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">
                                        ${item.student.scheduleNotes || '-'}
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
                                            if (item.stats.lastStatus === '출석') statusBadge = `<span class="badge good">✓ 출석</span>`;
                                            else if (item.stats.lastStatus === '지각') statusBadge = `<span class="badge warn">! 지각</span>`;
                                            else if (item.stats.lastStatus === '결석') statusBadge = `<span class="badge danger">× 결석</span>`;

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
                const tName = item.teacher ? item.teacher.name : '미배정';
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
                                            if (item.stats.lastStatus === '출석') statusBadge = `<span class="badge good">✓ 출석</span>`;
                                            else if (item.stats.lastStatus === '지각') statusBadge = `<span class="badge warn">! 지각</span>`;
                                            else if (item.stats.lastStatus === '결석') statusBadge = `<span class="badge danger">× 결석</span>`;

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

        // Operating hours config for compact-board
        const operatingHours = ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
        const hourGroups = {};
        operatingHours.forEach(t => hourGroups[t] = []);
        dailyClasses.forEach(row => {
            const [h] = row.time.split(':');
            const key = `${h.padStart(2, '0')}:00`;
            if (hourGroups[key]) {
                hourGroups[key].push(row);
            }
        });

        // Warning students calculation
        const warningStudentsList = students.map(student => {
            const metrics = getStudentMetrics(student.id);
            const hasWarning = metrics.absentCount >= 2 || metrics.monthRate < 80 || metrics.lateCount >= 3 || metrics.status === '결석';
            return { student, metrics, hasWarning };
        }).filter(item => item.hasWarning);

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
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    background: var(--bg-card);
                }
                .ac-tab {
                    flex: 1;
                    padding: 12px;
                    border: none;
                    background: transparent;
                    color: var(--text-muted);
                    font-weight: 700;
                    cursor: pointer;
                    text-align: center;
                    border-bottom: 2px solid transparent;
                }
                .ac-tab.active {
                    color: var(--primary);
                    border-bottom-color: var(--primary);
                    background: rgba(9, 132, 227, 0.05);
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
                .ac-presets {
                    display: flex;
                    gap: 4px;
                    padding: 3px;
                    border-radius: 6px;
                    background: rgba(0,0,0,0.05);
                    box-sizing: border-box;
                }
                .ac-preset-btn {
                    min-height: 28px;
                    padding: 0 10px;
                    font-size: 0.75rem;
                    border: none;
                    background: transparent;
                    color: var(--text-muted);
                    cursor: pointer;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                .ac-preset-btn.active {
                    background: var(--bg-body);
                    color: var(--primary);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
                    grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
                    gap: 8px;
                    padding: 12px;
                    background: var(--bg-card);
                    border-bottom: 1px solid var(--border-color);
                }
                .time-tile {
                    min-height: 104px;
                    padding: 9px;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    background: var(--bg-body);
                }
                .time-tile.empty {
                    background: rgba(0,0,0,0.02);
                    opacity: 0.7;
                }
                .tile-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                .tile-time {
                    font-size: 0.82rem;
                    font-weight: 800;
                }
                .tile-count {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }
                .tile-stats {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 3px;
                    margin-bottom: 6px;
                }
                .tile-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    background: rgba(0,0,0,0.04);
                    font-size: 0.55rem;
                    font-weight: 700;
                    line-height: 1.2;
                    text-align: center;
                    padding: 2px 0;
                }
                .tile-stat.good { background: rgba(46,204,113,0.1); color: #2ecc71; }
                .tile-stat.warn { background: rgba(241,196,15,0.1); color: #f1c40f; }
                .tile-stat.danger { background: rgba(231,76,60,0.1); color: #e74c3c; }

                .mini-students {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .mini-row {
                    display: grid;
                    grid-template-columns: 14px 1fr auto;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 4px;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    cursor: pointer;
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
                    font-size: 0.55rem;
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
                    grid-template-columns: 38px 1fr 60px;
                    gap: 10px;
                    align-items: center;
                    padding: 10px 16px;
                    border-bottom: 1px solid var(--border-color);
                    cursor: pointer;
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
                    align-items: baseline;
                    gap: 7px;
                    margin-bottom: 4px;
                }
                .warning-student b {
                    font-size: 0.85rem;
                    font-weight: 800;
                }
                .warning-student span {
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
                .warning-rate {
                    text-align: right;
                }
                .warning-rate strong {
                    display: block;
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #e74c3c;
                }
                .warning-rate span {
                    display: block;
                    font-size: 0.6rem;
                    color: var(--text-muted);
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
                    font-size: 1.1rem;
                    font-weight: 800;
                }
                .profile-main span {
                    font-size: 0.8rem;
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
                    font-size: 0.9rem;
                    font-weight: 800;
                }
                .section-title span {
                    font-size: 0.72rem;
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
                    font-size: 0.65rem;
                    color: var(--text-muted);
                }
                .ac-stat-box strong {
                    display: block;
                    font-size: 1.15rem;
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
                    font-size: 0.75rem;
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
                    font-size: 0.8rem;
                }
                .tuition-notice-body {
                    font-size: 0.72rem;
                    color: var(--text-muted);
                    margin-top: 4px;
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
                    font-size: 0.7rem;
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
                    font-size: 0.72rem;
                }
                .log-item-head {
                    display: flex;
                    justify-content: space-between;
                    font-weight: 700;
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
                    <div class="ac-presets">
                        <button class="ac-preset-btn active">오늘</button>
                        <button class="ac-preset-btn">주간</button>
                        <button class="ac-preset-btn">월간</button>
                    </div>
                    
                    <input type="date" id="ac-date-picker" value="${selectedDate}" class="form-control" style="width: 150px; height:36px;">
                    
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
                        ${teachers.map(t => `
                            <option value="${t.id}" ${selectedTeacherId === t.id ? 'selected' : ''}>${t.name}</option>
                        `).join('')}
                    </select>

                    <div class="ac-search-combo">
                        <select id="ac-search-type">
                            <option value="name" ${searchType === 'name' ? 'selected' : ''}>이름</option>
                            <option value="id" ${searchType === 'id' ? 'selected' : ''}>회원번호</option>
                        </select>
                        <input type="text" id="ac-search-input" value="${searchQuery}" placeholder="원생 검색">
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
                            <div class="desc">미등원 확인 필요</div>
                        </div>
                        <div class="metric-icon absent">×</div>
                    </div>
                </section>

                <!-- 5. Urgent Queue Banner -->
                <section class="radar-banner">
                    <div>
                        <p id="urgentBannerText">오늘 발생한 미등원, 하원 누락, 지각 처리 큐입니다.</p>
                    </div>
                    <div>
                        <button class="btn btn-none mini-btn" id="ac-urgent-btn" style="background:#fff;">전체 보기</button>
                    </div>
                </section>

                <!-- 6. Main Grid (Vertical stack of Left Panel + Warning Console) -->
                <div class="main-grid">
                    <div class="left-panel">
                        <div class="table-container">
                            ${activeTab === 'daily' ? `
                                <div class="board-note">
                                    <span><b>시간별 출결 요약</b></span>
                                </div>
                                
                                <!-- Compact Board -->
                                <div class="compact-board" id="compactBoard">
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
                                            <th>원생이름</th>
                                            <th>담당강사</th>
                                            <th>출결상태</th>
                                            <th>등원시각</th>
                                            <th>특이사항/사유</th>
                                            <th>메세지</th>
                                            <th>확인</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${filteredRows.map(row => {
                                            let statusBadge = `<span class="badge gray">수업 예정</span>`;
                                            if (row.status === '출석') statusBadge = `<span class="badge good">✓ 출석</span>`;
                                            else if (row.status === '지각') statusBadge = `<span class="badge warn">! 지각</span>`;
                                            else if (row.status === '결석') statusBadge = `<span class="badge danger">× 결석</span>`;

                                            const timeText = row.checkTime ? `${row.checkTime}${row.leavingTime ? ' ~ ' + row.leavingTime : ''}` : '-';
                                            
                                            // Mock messaging status based on class status
                                            let msgText = '<span style="opacity:0.5;">-</span>';
                                             if (row.status === '출석' || row.status === '지각') msgText = '<span style="color:#27ae60; font-weight:700;">발송완료</span>';
                                             else if (row.status === '결석') msgText = '<span style="color:#e74c3c; font-weight:700;">발송대기</span>';

                                            return `
                                                <tr class="ac-student-row ${row.student.id === selectedStudentId ? 'selected' : ''}" data-student-id="${row.student.id}">
                                                    <td>${dayOfWeekKo}</td>
                                                    <td><b>${row.time}</b></td>
                                                    <td>
                                                        <div class="student-cell">
                                                            <button class="student-link" style="font-weight:900;">${row.student.name}</button>
                                                        </div>
                                                    </td>
                                                    <td>${row.teacher ? row.teacher.name : '미배정'}</td>
                                                    <td>${statusBadge}</td>
                                                    <td style="font-weight: 600; font-size: 0.8rem;">${timeText}</td>
                                                    <td style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;">
                                                        ${row.note || '-'}
                                                    </td>
                                                    <td style="font-size: 0.78rem;">${msgText}</td>
                                                    <td>
                                                        <button class="btn btn-none mini-btn ac-action-check-btn" style="padding: 2px 8px; font-size:0.75rem; border-color:var(--border-color); color:var(--primary);">
                                                            ${row.status === '출석' ? '완료' : '확인'}
                                                        </button>
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
                                <p>최근 2주 결석 3회↑ · 월 출석률 70%↓ · 미등원 연속 등 누적 패턴 감지</p>
                            </div>
                            <div class="warning-total" id="attendanceWarningTotal">상담/관리 필요 ${warningStudentsList.length}</div>
                        </div>
                        <div class="warning-list" id="attendanceWarningList">
                            ${warningStudentsList.map(({ student, metrics }) => {
                                const avatarTone = metrics.monthRate < 70 ? 'red' : metrics.lateCount >= 3 ? 'amber' : 'green';
                                return `
                                    <div class="warning-row" data-student-id="${student.id}">
                                        <div class="warning-avatar ${avatarTone}">${student.name.slice(-2)}</div>
                                        <div class="warning-main">
                                            <div class="warning-student">
                                                <b>${student.name}</b>
                                                <span>${student.instrument} · ${metrics.teacher}</span>
                                            </div>
                                            <div class="warning-tags">
                                                ${metrics.absentCount >= 2 ? '<span class="warning-chip">△ 결석 잦음</span>' : ''}
                                                ${metrics.monthRate < 80 ? '<span class="warning-chip">△ 출석률 저조</span>' : ''}
                                                ${metrics.lateCount >= 3 ? '<span class="warning-chip amber">△ 지각 반복</span>' : ''}
                                                ${metrics.status === '결석' ? '<span class="warning-chip">△ 미등원 연속</span>' : ''}
                                            </div>
                                        </div>
                                        <div class="warning-rate">
                                            <strong>${metrics.monthRate}%</strong>
                                            <span>월 출석률</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
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
                            <h3>출결 정보</h3>
                            <span id="ac-inspector-warning-count">정상</span>
                        </div>
                        <div class="ac-stat-grid">
                            <div class="ac-stat-box">
                                <span>완료 수업</span>
                                <strong id="ac-inspector-stat-done">0</strong>
                            </div>
                            <div class="ac-stat-box">
                                <span>출석</span>
                                <strong id="ac-inspector-stat-present">0</strong>
                            </div>
                            <div class="ac-stat-box">
                                <span>지각</span>
                                <strong id="ac-inspector-stat-late">0</strong>
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
                            <h3>최근 30일 출결 현황</h3>
                        </div>
                        <div class="cal-mini" id="ac-inspector-calendar-mini">
                            <!-- Cells filled dynamically -->
                        </div>
                    </section>

                    <section class="drawer-section">
                        <div class="section-title">
                            <h3>최근 전송 메시지</h3>
                            <span id="ac-inspector-msg-count">0건</span>
                        </div>
                        <div class="log-list" id="ac-inspector-msg-list">
                            <!-- logs filled dynamically -->
                        </div>
                    </section>
                </div>
            </aside>
        `;

        // Bind event listeners
        const datePicker = container.querySelector('#ac-date-picker');
        if (datePicker) {
            datePicker.addEventListener('change', (e) => {
                selectedDate = e.target.value;
                render();
            });
        }

        const statusSelect = container.querySelector('#ac-status-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                selectedStatus = e.target.value;
                render();
            });
        }

        const instrumentSelect = container.querySelector('#ac-instrument-select');
        if (instrumentSelect) {
            instrumentSelect.addEventListener('change', (e) => {
                selectedInstrument = e.target.value;
                render();
            });
        }

        const teacherSelect = container.querySelector('#ac-teacher-select');
        if (teacherSelect) {
            teacherSelect.addEventListener('change', (e) => {
                selectedTeacherId = e.target.value;
                render();
            });
        }

        const searchTypeSelect = container.querySelector('#ac-search-type');
        if (searchTypeSelect) {
            searchTypeSelect.addEventListener('change', (e) => {
                searchType = e.target.value;
                render();
            });
        }

        const searchInput = container.querySelector('#ac-search-input');
        if (searchInput) {
            searchInput.addEventListener('compositionstart', () => {
                isComposing = true;
                searchInput.dataset.composing = 'true';
            });
            searchInput.addEventListener('compositionend', (e) => {
                isComposing = false;
                searchInput.dataset.composing = 'false';
                searchQuery = e.target.value.trim();
                debounceRender(150);
            });
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                if (!isComposing) {
                    debounceRender(150);
                }
            });
        }

        // Tabs click
        const tabBtns = container.querySelectorAll('.ac-tab');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                render();
            });
        });

        // KPI cards click to update status filter
        const kpiCards = container.querySelectorAll('.metric-card');
        kpiCards.forEach(card => {
            card.addEventListener('click', () => {
                selectedStatus = card.dataset.status;
                render();
            });
        });

        // Urgent banner click
        const urgentBtn = container.querySelector('#ac-urgent-btn');
        if (urgentBtn) {
            urgentBtn.addEventListener('click', () => {
                showKakaoTalkToast('[가상 알림] 오늘 발생한 미등원/지각 등의 긴급 확인 필요 리스트 팝업은 다음 Phase에서 연계 지원 예정입니다.');
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

        // Action check buttons click
        const checkBtns = container.querySelectorAll('.ac-action-check-btn');
        checkBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showKakaoTalkToast('출결 확인 상태 변경은 실제 DB와 다음 Phase에 연계 구현됩니다.');
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

        // If a student was selected, keep drawer open on re-render
        if (selectedStudentId) {
            selectStudent(selectedStudentId, false);
        }
    };

    const selectStudent = (studentId, shouldOpen = true) => {
        selectedStudentId = studentId;
        const students = stateStore.getStudents();
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        const metrics = getStudentMetrics(studentId);
        
        // Update DOM
        const avatar = container.querySelector('#ac-inspector-avatar');
        const name = container.querySelector('#ac-inspector-name');
        const meta = container.querySelector('#ac-inspector-meta');
        
        if (avatar) avatar.textContent = student.name[0];
        if (name) name.textContent = student.name;
        if (meta) meta.textContent = `${metrics.className} · ${metrics.teacher} 강사`;

        // Update stats
        const done = 12;
        const present = Math.max(0, done - metrics.absentCount);
        
        const statDone = container.querySelector('#ac-inspector-stat-done');
        const statPresent = container.querySelector('#ac-inspector-stat-present');
        const statLate = container.querySelector('#ac-inspector-stat-late');
        
        if (statDone) statDone.textContent = done;
        if (statPresent) statPresent.textContent = present;
        if (statLate) statLate.textContent = metrics.lateCount;

        // Warnings list inside inspector
        const warningStack = container.querySelector('#ac-inspector-warning-list');
        const warningCount = container.querySelector('#ac-inspector-warning-count');
        const activeWarnings = [];
        if (metrics.absentCount >= 2) activeWarnings.push({ label: '결석 잦음', detail: `최근 4주 결석 ${metrics.absentCount}회` });
        if (metrics.monthRate < 80) activeWarnings.push({ label: '출결률 저조', detail: `최근 4주 출석률 ${metrics.monthRate}%` });
        
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

        // Tuition notice
        const tuitionRisk = metrics.absentCount >= 2;
        const tuitionBox = container.querySelector('#ac-inspector-tuition-box');
        const tuitionState = container.querySelector('#ac-inspector-tuition-state');
        const tuitionDue = container.querySelector('#ac-inspector-tuition-due');
        const tuitionText = container.querySelector('#ac-inspector-tuition-text');
        
        if (tuitionState) tuitionState.textContent = tuitionRisk ? '미납' : '결제예정';
        if (tuitionDue) tuitionDue.textContent = tuitionRisk ? 'D+5' : 'D-3';
        if (tuitionText) tuitionText.textContent = tuitionRisk ? '6월 수강료 · 5일 경과' : '6월 수강료 · 6/10 예정';
        if (tuitionBox) {
            tuitionBox.className = tuitionRisk ? 'tuition-notice overdue' : 'tuition-notice';
        }

        // Mini calendar
        const calMini = container.querySelector('#ac-inspector-calendar-mini');
        if (calMini) {
            const currentDay = new Date().getDate();
            calMini.innerHTML = Array.from({ length: 30 }, (_, index) => {
                const day = index + 1;
                const tone = metrics.cal[index] || '';
                const today = day === currentDay ? 'today' : '';
                return `<div class="cal-cell ${tone} ${today}">${day}</div>`;
            }).join('');
        }

        // Msg logs
        const msgList = container.querySelector('#ac-inspector-msg-list');
        const msgCount = container.querySelector('#ac-inspector-msg-count');
        const messageLogs = [
            { title: '미등원 안내', message: '현재 등원이 확인되지 않았습니다. 확인 부탁드립니다.', date: '06-03 15:21', channel: '알림톡', state: metrics.absentCount >= 2 ? '발송실패' : '발송완료' },
            { title: '결석 확인', message: '오늘 결석 사유 확인이 필요합니다.', date: '06-03 15:25', channel: '알림톡', state: '발송완료' }
        ];
        if (msgCount) msgCount.textContent = `${messageLogs.length}건`;
        if (msgList) {
            msgList.innerHTML = messageLogs.map(log => `
                <div class="log-item">
                    <div class="log-item-head">
                        <span>${log.title} (${log.channel})</span>
                        <span style="color:${log.state === '발송실패' ? '#e74c3c' : '#2ecc71'};">${log.state}</span>
                    </div>
                    <div class="log-item-body">
                        ${log.message}
                        <div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">${log.date}</div>
                    </div>
                </div>
            `).join('');
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

        // Clean up global header actions and restore defaults
        const dynamicActions = document.getElementById('ac-global-header-actions');
        if (dynamicActions) {
            dynamicActions.remove();
        }
        if (settingsQuickBar) settingsQuickBar.style.display = '';
        if (currentDateEl) currentDateEl.style.display = '';
    };
}
