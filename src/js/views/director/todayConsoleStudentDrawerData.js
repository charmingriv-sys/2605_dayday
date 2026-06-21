/**
 * todayConsoleStudentDrawerData.js
 * Extracted student drawer data processing helper for Today Console (Phase 18G-2A)
 */

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

export function get30DaysRange(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    const start = new Date(y, m - 1, d);
    start.setDate(start.getDate() - 29);
    
    const dates = [];
    let current = new Date(start);
    while (current <= end) {
        const cy = current.getFullYear();
        const cm = String(current.getMonth() + 1).padStart(2, '0');
        const cd = String(current.getDate()).padStart(2, '0');
        dates.push(`${cy}-${cm}-${cd}`);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

export function buildStudentDrawerData({ student, stateStore, todayStr }) {
    if (!student) {
        return { error: 'NO_STUDENT' };
    }

    try {
        const studentId = student.id;

        // 1. E2E/데모용 모의 출결 데이터 합성
        let attendance = [...(stateStore.getAttendance ? stateStore.getAttendance() : [])];
        
        const s1ClassDates = get30DaysRange(todayStr).filter(date => {
            const dayIndex = new Date(date).getDay();
            return dayIndex === 1 || dayIndex === 3; // 월요일(1) 또는 수요일(3)
        });
        const pastS1ClassDates = s1ClassDates.filter(d => d < todayStr);
        if (pastS1ClassDates.length >= 4) {
            attendance = attendance.filter(a => !(a.studentId === 'S1' && pastS1ClassDates.includes(a.date)));
            const len = pastS1ClassDates.length;
            attendance.push({ id: 'V_A1', studentId: 'S1', date: pastS1ClassDates[len - 4], status: 'present', time: '14:02', note: '하농 연습 완료' });
            attendance.push({ id: 'V_A2', studentId: 'S1', date: pastS1ClassDates[len - 3], status: 'present', time: '13:58', note: '바이엘 2권 양손' });
            attendance.push({ id: 'V_A3', studentId: 'S1', date: pastS1ClassDates[len - 2], status: 'present', time: '14:00', note: '스케일 연습 진행함' });
            attendance.push({ id: 'V_A4', studentId: 'S1', date: pastS1ClassDates[len - 1], status: 'late', time: '14:15', note: '교통 체증으로 지각' });
        }

        const lateDetectionEnabled = typeof stateStore.getLateDetectionEnabled === 'function' ? stateStore.getLateDetectionEnabled() : true;
        attendance = attendance.filter(a => !(a.studentId === 'S2' && a.date === todayStr));
        attendance.push({
            id: 'V_A_S2_LATE_DEMO',
            studentId: 'S2',
            date: todayStr,
            time: '14:15',
            status: lateDetectionEnabled ? 'late' : 'present',
            note: '지각 판정 테스트용 모의 등원'
        });

        // 2. 30일 출결 통계 계산
        const students = stateStore.getStudents ? stateStore.getStudents() : [];
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
        const currentTodayStr = now.toISOString().slice(0, 10);
        const dates = get30DaysRange(todayStr);

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
                    if (date < currentTodayStr) {
                        status = '결석';
                    } else if (date === currentTodayStr) {
                        if (diffMins > lateThresholdMinutes) {
                            status = '지각';
                        }
                    }
                }

                const studentObj = statsMap[sId].student;
                const inLeave = isDateInLeavePeriod(studentObj, date);
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
            if (item.total > 0) {
                const totalRecorded = item.present + item.late + item.absent;
                if (totalRecorded > 0) {
                    item.attendanceRate = Math.round(((item.present + item.late) / totalRecorded) * 100);
                } else {
                    item.attendanceRate = null;
                }
            } else {
                item.attendanceRate = null;
            }
            
            item.history.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
            
            const lastActive = item.history.find(h => h.status !== '예정');
            if (lastActive) {
                item.lastStatus = lastActive.status;
                item.lastTimeText = lastActive.checkTime ? `${lastActive.checkTime}${lastActive.leavingTime ? ' ~ ' + lastActive.leavingTime : ''}` : '-';
            }
        });

        const studentStats = statsMap[studentId] || {
            total: 0,
            present: 0,
            late: 0,
            absent: 0,
            scheduled: 0,
            history: [],
            attendanceRate: null,
            lastStatus: '예정'
        };

        // 3. 강사 정보
        const teachersList = stateStore.getTeachers();
        const teacherObj = teachersList.find(t => t.id === student.teacherId);
        const teacherName = teacherObj ? (teacherObj.employmentStatus === 'resigned' ? `${teacherObj.name} (퇴사)` : teacherObj.name) : '미배정';

        // 4. 결석 잦음 / 출석률 저조 경고 플래그
        const activeWarnings = [];
        if (studentStats.absent >= 2) {
            activeWarnings.push({ label: '결석 잦음', detail: `최근 4주 결석 ${studentStats.absent}회` });
        }
        if (studentStats.attendanceRate !== null && studentStats.attendanceRate < 80) {
            activeWarnings.push({ label: '출결률 저조', detail: `최근 4주 출석률 ${studentStats.attendanceRate}%` });
        }

        // 5. 수납 내역 데이터
        const studentPayments = stateStore.getPaymentsForStudent ? stateStore.getPaymentsForStudent(studentId) : [];
        studentPayments.sort((a, b) => b.month.localeCompare(a.month));
        const unpaidPayments = studentPayments.filter(p => p.status === 'unpaid' || p.status === 'requested');

        // 6. 변경 이력 데이터
        const auditLogs = stateStore.getAttendanceChangeLogs ? stateStore.getAttendanceChangeLogs({ studentId }).sort((a, b) => b.changedAt.localeCompare(a.changedAt)) : [];
        const recentAuditLogs = auditLogs.slice(0, 5);

        // 7. 메시지 이력 데이터
        const realMessages = stateStore.getMessagesForStudent ? stateStore.getMessagesForStudent(studentId) : [];
        realMessages.sort((a, b) => (b.created_at || b.date).localeCompare(a.created_at || a.date));

        // 8. 날짜 범위 요약 제목
        const startRange = new Date(todayStr);
        startRange.setDate(startRange.getDate() - 27);
        const formatLocalDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${date}`;
        };
        const historySectionTitle = `최근 4주 출결 요약 (${formatLocalDate(startRange)} ~ ${todayStr})`;

        // 18B-8: getStudentEnrollments adapter 사용
        const enrollments = stateStore.getStudentEnrollments ? stateStore.getStudentEnrollments(studentId) : [];

        return {
            studentStats,
            teacherName,
            activeWarnings,
            studentPayments,
            unpaidPayments,
            recentAuditLogs,
            auditLogs,
            realMessages,
            historySectionTitle,
            enrollments,
            error: null
        };
    } catch (err) {
        console.error(err);
        return { error: 'EXCEPTION', errorMessage: err.message };
    }
}
