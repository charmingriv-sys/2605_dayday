// attendance.js - Attendance, Checking in and out Domain State Module

export const attendanceMethods = {
    // --- ATTENDANCE ---
    getAttendance() {
        return this.db.attendance;
    },

    getAttendanceForStudent(studentId) {
        return this.db.attendance.filter(a => a.studentId === studentId);
    },

    markAttendance(studentId, date, status, time = '', note = '', videoUrl = '', images = []) {
        // Check if attendance already marked for this day
        const existing = this.db.attendance.find(a => a.studentId === studentId && a.date === date);
        let alertTriggered = false;
        let alertMessage = '';

        let classTimeVal = '';
        const dailySchedule = typeof this.getTeacherStudentScheduleForDate === 'function' ? this.getTeacherStudentScheduleForDate(date) : [];
        const studentClass = dailySchedule.find(c => c.studentId === studentId);
        if (studentClass && studentClass.time) {
            classTimeVal = studentClass.time;
        }

        if (status === 'present' && time && studentClass && studentClass.time) {
            const lateDetectionEnabled = typeof this.getLateDetectionEnabled === 'function' ? this.getLateDetectionEnabled() : true;
            if (lateDetectionEnabled) {
                const [actH, actM] = time.split(':').map(Number);
                const [schH, schM] = studentClass.time.split(':').map(Number);
                if (!isNaN(actH) && !isNaN(actM) && !isNaN(schH) && !isNaN(schM)) {
                    const diffMins = (actH * 60 + actM) - (schH * 60 + schM);
                    const threshold = typeof this.getLateThresholdMinutes === 'function' ? this.getLateThresholdMinutes() : 10;
                    if (diffMins > threshold) {
                        status = 'late';
                    }
                }
            }
        }

        if (existing) {
            if (status === 'none') {
                // Remove record
                this.db.attendance = this.db.attendance.filter(a => a.id !== existing.id);
            } else {
                existing.status = status;
                existing.time = time;
                existing.note = note;
                existing.videoUrl = videoUrl;
                existing.images = images;
                if (classTimeVal) {
                    existing.classTime = classTimeVal;
                }
            }
        } else if (status !== 'none') {
            const id = 'A' + (this.db.attendance.length ? Math.max(...this.db.attendance.map(a => parseInt(a.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendance.push({ id, studentId, date, status, time, classTime: classTimeVal || '', note, videoUrl, images });
            
            // Set up simulated KakaoTalk notification
            if (this.db.settings.sendKakaoAlert) {
                const student = this.getStudent(studentId);
                const statusKo = status === 'present' ? '등원' : (status === 'late' ? '지각' : '결석');
                alertTriggered = true;
                alertMessage = `[튜링 알림톡]\n안녕하세요. 학부모님.\n${student.name} 원생이 금일(${date} ${time})에 ${statusKo}하였습니다.`;
            }
        }

        this.saveDB();
        this.notify('ATTENDANCE_CHANGED', this.db.attendance);

        // If KakaoTalk alert needs to be dispatched, fire custom DOM event for toast notification
        if (alertTriggered) {
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMessage } });
            window.dispatchEvent(event);
        }
    },

    leaveAttendance(studentId, date, time) {
        // Find existing attendance for this day
        const existing = this.db.attendance.find(a => a.studentId === studentId && a.date === date);
        let alertTriggered = false;
        let alertMessage = '';

        if (existing) {
            // Update the existing record with leavingTime
            existing.leavingTime = time;
        } else {
            // If no attendance record exists, create one with leavingTime
            const id = 'A' + (this.db.attendance.length ? Math.max(...this.db.attendance.map(a => parseInt(a.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendance.push({ id, studentId, date, status: 'present', time: '', leavingTime: time, note: '하원 우선 기록' });
        }

        // Set up simulated KakaoTalk notification for check-out
        if (this.db.settings.sendKakaoAlert) {
            const student = this.getStudent(studentId);
            alertTriggered = true;
            alertMessage = `[튜링 알림톡]\n안녕하세요. 학부모님.\n${student.name} 원생이 금일(${date} ${time})에 하원하였습니다.`;
        }

        this.saveDB();
        this.notify('ATTENDANCE_CHANGED', this.db.attendance);

        if (alertTriggered) {
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMessage } });
            window.dispatchEvent(event);
        }
    },

    markAttendanceStatus(payload) {
        const {
            studentId,
            date,
            classTime,
            teacherId,
            status,
            checkedAt,
            source = 'director_manual',
            note = ''
        } = payload;

        const existing = this.db.attendance.find(a => 
            a.studentId === studentId && 
            a.date === date && 
            (a.classTime === classTime || !a.classTime)
        );

        // Capture previous and next status (Phase 9C-5E Audit Logging)
        const previousStatus = existing ? existing.status : null;
        const nextStatus = status;

        let time = '';
        if (status !== 'absent') {
            if (checkedAt) {
                const checkedDate = new Date(checkedAt);
                const hrs = String(checkedDate.getHours()).padStart(2, '0');
                const mins = String(checkedDate.getMinutes()).padStart(2, '0');
                time = `${hrs}:${mins}`;
            } else {
                time = classTime || '';
            }
        }

        if (existing) {
            existing.status = status;
            existing.classTime = classTime;
            existing.time = time;
            existing.source = source;
            existing.checkedAt = checkedAt || null;
            if (note) {
                existing.note = note;
            }
        } else {
            const id = 'A' + (this.db.attendance.length ? Math.max(...this.db.attendance.map(a => parseInt(a.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendance.push({
                id,
                studentId,
                date,
                status,
                time,
                classTime,
                source,
                checkedAt: checkedAt || null,
                note,
                leavingTime: ''
            });
        }

        // Audit Logging Logic
        if (previousStatus !== nextStatus) {
            if (!this.db.attendanceChangeLogs) {
                this.db.attendanceChangeLogs = [];
            }
            const logId = 'L' + (this.db.attendanceChangeLogs.length ? Math.max(...this.db.attendanceChangeLogs.map(l => parseInt(l.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendanceChangeLogs.push({
                id: logId,
                studentId,
                date,
                classTime: classTime || '',
                previousStatus,
                nextStatus,
                changedAt: new Date().toISOString(),
                source
            });
        }

        this.saveDB();
        this.notify('ATTENDANCE_CHANGED', this.db.attendance);
    },

    getAttendanceChangeLogs(options = {}) {
        const { studentId, date } = options;
        let logs = this.db.attendanceChangeLogs || [];
        if (studentId) {
            logs = logs.filter(log => log.studentId === studentId);
        }
        if (date) {
            logs = logs.filter(log => log.date === date);
        }
        return logs;
    },

    getAttendanceWarnings(options = {}) {
        const {
            endDate = new Date().toISOString().slice(0, 10),
            windowDays = 28
        } = options;

        let lateThresholdMinutes = options.lateThresholdMinutes;
        if (lateThresholdMinutes === undefined || lateThresholdMinutes === null) {
            if (typeof this.getLateThresholdMinutes === 'function') {
                lateThresholdMinutes = this.getLateThresholdMinutes();
            } else {
                lateThresholdMinutes = 10;
            }
        }

        const students = this.db.students || [];
        const teachers = this.db.teachers || [];
        const attendance = this.db.attendance || [];

        const getRangeDates = (endStr, days) => {
            const end = new Date(endStr);
            const dates = [];
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(end);
                d.setDate(d.getDate() - i);
                dates.push(d.toISOString().slice(0, 10));
            }
            return dates;
        };
        const rangeDates = getRangeDates(endDate, windowDays);

        const studentSchedules = {};
        students.forEach(s => {
            studentSchedules[s.id] = [];
        });

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        rangeDates.forEach(date => {
            const dailySchedule = this.getTeacherStudentScheduleForDate(date) || [];
            dailySchedule.forEach(entry => {
                const sId = entry.studentId;
                if (!studentSchedules[sId]) return;

                const att = attendance.find(a => a.studentId === sId && a.date === date && (a.classTime === entry.time || !a.classTime));
                let status = '예정';
                let checkTime = '';
                let leavingTime = '';
                let isTodayNoTagOverdue = false;

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
                        const lateDetectionEnabled = typeof this.getLateDetectionEnabled === 'function' ? this.getLateDetectionEnabled() : true;
                        if (lateDetectionEnabled && diffMins > lateThresholdMinutes) {
                            status = '지각';
                            isTodayNoTagOverdue = true;
                        }
                    }
                }

                studentSchedules[sId].push({
                    date,
                    time: entry.time,
                    status,
                    checkTime,
                    leavingTime,
                    isTodayNoTagOverdue
                });
            });
        });

        const warnings = [];

        const lateDetectionEnabled = typeof this.getLateDetectionEnabled === 'function' ? this.getLateDetectionEnabled() : true;

        students.forEach(student => {
            const list = studentSchedules[student.id] || [];
            if (list.length === 0) return;

            const plannedCount = list.length;
            const presentCount = list.filter(c => c.status === '출석').length;
            const lateCount = list.filter(c => c.status === '지각').length;
            const absentCount = list.filter(c => c.status === '결석').length;

            const attendanceRate = Math.round(((presentCount + lateCount) / plannedCount) * 100);
            const absentRate = Math.round((absentCount / plannedCount) * 100);
            const lateRate = Math.round((lateCount / plannedCount) * 100);

            const isMinor = student.isAdult === false || 
                            student.isAdult === 'minor' || 
                            (student.age !== undefined && student.age < 19) || 
                            (student.parentPhone && student.parentPhone.trim() !== '');

            const sortedClasses = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
            const activeClasses = sortedClasses.filter(c => c.status !== '예정');

            let severity = null;
            let warningType = null;
            let title = '';
            let reason = '';
            let evidenceText = '';

            if (isMinor && activeClasses.length >= 2 && activeClasses[0].status === '결석' && activeClasses[1].status === '결석') {
                severity = 'critical';
                warningType = 'consecutive_absences';
                title = '연속 결석';
                reason = '비성인 원생 최근 2회 연속 결석';
                evidenceText = `최근 2회 연속 결석 (비성인)`;
            }
            else if (lateDetectionEnabled && list.some(c => c.isTodayNoTagOverdue)) {
                severity = 'critical';
                warningType = 'today_no_tag_overdue';
                title = '미태그 지각';
                reason = '수업 시작 후 15분 경과 미태그';
                evidenceText = `오늘 수업 시작 15분 경과 미태그`;
            }
            else if (absentRate >= 30) {
                severity = 'red';
                warningType = 'high_absent_rate';
                title = '출결 위험';
                reason = '최근 4주 결석률 30% 이상';
                evidenceText = `최근 4주 예정 ${plannedCount}회 중 결석 ${absentCount}회, 결석률 ${absentRate}%`;
            }
            else if (attendanceRate < 75) {
                severity = 'amber';
                warningType = 'low_attendance_rate';
                title = '출결 저조';
                reason = '최근 4주 출석률 75% 미만';
                evidenceText = `최근 4주 예정 ${plannedCount}회 중 출석/지각 ${presentCount + lateCount}회, 출석률 ${attendanceRate}%`;
            }
            else if (lateDetectionEnabled && lateRate >= 25) {
                severity = 'amber';
                warningType = 'high_late_rate';
                title = '지각 반복';
                reason = '최근 4주 지각률 25% 이상';
                evidenceText = `최근 4주 예정 ${plannedCount}회 중 지각 ${lateCount}회, 지각률 ${lateRate}%`;
            }

            if (severity) {
                const teacherObj = teachers.find(t => t.id === student.teacherId);
                warnings.push({
                    id: `W_${student.id}`,
                    studentId: student.id,
                    studentName: student.name,
                    memberNo: student.studentMemberNo || student.memberNo || student.id,
                    instrument: student.instrument || '미지정',
                    teacherName: teacherObj ? teacherObj.name : '미배정',
                    severity,
                    warningType,
                    title,
                    reason,
                    plannedCount,
                    presentCount,
                    lateCount,
                    absentCount,
                    attendanceRate,
                    absentRate,
                    lateRate,
                    evidenceText
                });
            }
        });

        const severityOrder = { critical: 3, red: 2, amber: 1 };
        warnings.sort((a, b) => {
            const sevDiff = severityOrder[b.severity] - severityOrder[a.severity];
            if (sevDiff !== 0) return sevDiff;

            const absentDiff = b.absentRate - a.absentRate;
            if (absentDiff !== 0) return absentDiff;

            const attendDiff = a.attendanceRate - b.attendanceRate;
            if (attendDiff !== 0) return attendDiff;

            return a.studentName.localeCompare(b.studentName);
        });

        return warnings;
    }
};
