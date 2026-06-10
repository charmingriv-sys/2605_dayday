// staff.js - Teachers, Instructors, Shifts schedules Domain State Module

export const staffMethods = {
    // --- TEACHERS ---
    getTeachers() {
        return this.db.teachers;
    },

    getTeacher(id) {
        return this.db.teachers.find(t => t.id === id);
    },

    addTeacher(teacher) {
        const id = 'T' + (Math.max(...this.db.teachers.map(t => parseInt(t.id.slice(1)) || 0)) + 1);
        const newTeacher = { id, ...teacher };
        this.db.teachers.push(newTeacher);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
        return newTeacher;
    },

    updateTeacher(id, data) {
        this.db.teachers = this.db.teachers.map(t => t.id === id ? { ...t, ...data } : t);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
    },

    deleteTeacher(id) {
        this.db.teachers = this.db.teachers.filter(t => t.id !== id);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
    },

    // --- TEACHER SHIFTS ---
    getTeacherShifts() {
        if (!this.db.teacherShifts) {
            this.db.teacherShifts = [];
        }
        return this.db.teacherShifts;
    },

    getShiftsForTeacher(teacherId) {
        return this.getTeacherShifts().filter(ts => ts.teacherId === teacherId);
    },

    saveTeacherShift(teacherId, date, slots) {
        if (!this.db.teacherShifts) {
            this.db.teacherShifts = [];
        }
        // Remove existing record for this teacher and date if it exists
        this.db.teacherShifts = this.db.teacherShifts.filter(ts => !(ts.teacherId === teacherId && ts.date === date));
        
        // Add new record if there are active slots
        if (slots && slots.length > 0) {
            const id = 'TS' + (this.db.teacherShifts.length ? Math.max(...this.db.teacherShifts.map(ts => parseInt(ts.id.slice(2)) || 0)) + 1 : 1);
            this.db.teacherShifts.push({ id, teacherId, date, slots });
        }

        this.saveDB();
        this.notify('SHIFTS_CHANGED', this.db.teacherShifts);
    },

    // --- TEACHER ATTENDANCE ---
    getTeacherAttendanceLogs(options = {}) {
        if (!this.db.teacherAttendanceLogs) {
            this.db.teacherAttendanceLogs = [];
        }
        let logs = this.db.teacherAttendanceLogs;
        if (options.teacherId) {
            logs = logs.filter(log => log.teacherId === options.teacherId);
        }
        if (options.date) {
            logs = logs.filter(log => log.date === options.date);
        }
        return logs;
    },

    markTeacherAttendanceByTeacherId(teacherId, timestamp) {
        if (!this.db.teacherAttendanceLogs) {
            this.db.teacherAttendanceLogs = [];
        }
        
        const dateStr = timestamp.slice(0, 10);
        const existing = this.db.teacherAttendanceLogs.find(log => log.teacherId === teacherId && log.date === dateStr);

        if (!existing) {
            const id = 'tal_' + (this.db.teacherAttendanceLogs.length ? Math.max(...this.db.teacherAttendanceLogs.map(log => parseInt(log.id.slice(4)) || 0)) + 1 : 1);
            const newLog = {
                id,
                teacherId,
                date: dateStr,
                checkInAt: timestamp,
                checkOutAt: null,
                source: 'tablet_pin',
                createdAt: timestamp,
                updatedAt: timestamp
            };
            this.db.teacherAttendanceLogs.push(newLog);
            this.saveDB();
            this.notify('TEACHER_ATTENDANCE_CHANGED', this.db.teacherAttendanceLogs);
            return {
                status: 'checked_in',
                log: newLog
            };
        } else if (existing.checkInAt && !existing.checkOutAt) {
            existing.checkOutAt = timestamp;
            existing.updatedAt = timestamp;
            this.saveDB();
            this.notify('TEACHER_ATTENDANCE_CHANGED', this.db.teacherAttendanceLogs);
            return {
                status: 'checked_out',
                log: existing
            };
        } else {
            return {
                status: 'already_completed',
                log: existing
            };
        }
    },

    getTeacherAttendanceSummary(date) {
        if (!this.db.teacherAttendanceLogs) {
            this.db.teacherAttendanceLogs = [];
        }
        const teachers = this.db.teachers || [];
        const logsToday = this.db.teacherAttendanceLogs.filter(log => log.date === date);

        const checkedInCount = logsToday.filter(log => log.checkInAt).length;
        const absentCount = teachers.length - checkedInCount;
        const checkedOutCount = logsToday.filter(log => log.checkOutAt).length;
        const workingCount = logsToday.filter(log => log.checkInAt && !log.checkOutAt).length;

        return {
            checkedInCount,
            absentCount,
            checkedOutCount,
            workingCount
        };
    },

    getTeacherAttendanceRangeSummary(startDate, endDate) {
        if (!this.db.teacherAttendanceLogs) {
            this.db.teacherAttendanceLogs = [];
        }
        const teachers = this.db.teachers || [];
        const logsInRange = this.db.teacherAttendanceLogs.filter(log => log.date >= startDate && log.date <= endDate);

        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        const end = new Date(ey, em - 1, ed);
        const diffMs = end - start;
        const daysCount = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

        const checkedInCount = logsInRange.filter(log => log.checkInAt).length;
        const absentCount = (teachers.length * daysCount) - checkedInCount;
        const checkedOutCount = logsInRange.filter(log => log.checkOutAt).length;
        const workingCount = logsInRange.filter(log => log.checkInAt && !log.checkOutAt).length;

        return {
            checkedInCount,
            absentCount,
            checkedOutCount,
            workingCount
        };
    },

    getTeacherWorkHourSummary(startDate, endDate) {
        if (!this.db.teacherAttendanceLogs) {
            this.db.teacherAttendanceLogs = [];
        }
        const teachers = this.db.teachers || [];
        const logs = this.db.teacherAttendanceLogs;

        return teachers.map(t => {
            const teacherLogs = logs.filter(log => log.teacherId === t.id && log.date >= startDate && log.date <= endDate);
            
            let checkInDays = 0;
            let completedDays = 0;
            let openDays = 0;
            let totalMinutes = 0;

            teacherLogs.forEach(log => {
                if (log.checkInAt) {
                    checkInDays++;
                    if (log.checkOutAt) {
                        completedDays++;
                        const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                        const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                        totalMinutes += diffMins;
                    } else {
                        openDays++;
                    }
                }
            });

            const averageMinutes = completedDays > 0 ? Math.round(totalMinutes / completedDays) : 0;

            return {
                teacherId: t.id,
                teacherName: t.name,
                instrument: t.instrument || '미지정',
                checkInDays,
                completedDays,
                openDays,
                totalMinutes,
                averageMinutes
            };
        });
    },

    updateTeacherAttendanceLog(logId, patch, meta = {}) {
        if (!this.db.teacherAttendanceLogs) {
            this.db.teacherAttendanceLogs = [];
        }
        const log = this.db.teacherAttendanceLogs.find(l => l.id === logId);
        if (!log) {
            throw new Error('근태 기록을 찾을 수 없습니다.');
        }

        const before = {
            checkInAt: log.checkInAt,
            checkOutAt: log.checkOutAt
        };

        const checkInAt = patch.checkInAt || null;
        const checkOutAt = patch.checkOutAt || null;

        // Validation
        if (!checkInAt) {
            throw new Error('출근시각을 입력해 주세요.');
        }

        const checkInDate = new Date(checkInAt);
        if (isNaN(checkInDate.getTime())) {
            throw new Error('시간 형식을 확인해 주세요.');
        }

        if (checkOutAt) {
            const checkOutDate = new Date(checkOutAt);
            if (isNaN(checkOutDate.getTime())) {
                throw new Error('시간 형식을 확인해 주세요.');
            }
            if (checkOutDate <= checkInDate) {
                throw new Error('퇴근시각은 출근시각 이후여야 합니다.');
            }
        }

        // Apply modifications
        log.checkInAt = checkInAt;
        log.checkOutAt = checkOutAt;
        log.updatedAt = new Date().toISOString();

        // Create edit log
        if (!this.db.teacherAttendanceEditLogs) {
            this.db.teacherAttendanceEditLogs = [];
        }

        const editLogId = 'tael_' + (this.db.teacherAttendanceEditLogs.length ? Math.max(...this.db.teacherAttendanceEditLogs.map(l => parseInt(l.id.slice(5)) || 0)) + 1 : 1);
        const editLog = {
            id: editLogId,
            attendanceLogId: logId,
            teacherId: log.teacherId,
            date: log.date,
            before,
            after: {
                checkInAt,
                checkOutAt
            },
            note: meta.note || '',
            changedAt: new Date().toISOString(),
            changedBy: 'director',
            source: 'director_manual'
        };

        this.db.teacherAttendanceEditLogs.push(editLog);
        this.saveDB();
        this.notify('TEACHER_ATTENDANCE_CHANGED', this.db.teacherAttendanceLogs);
        return log;
    },

    getTeacherAttendanceEditLogs(options = {}) {
        if (!this.db.teacherAttendanceEditLogs) {
            this.db.teacherAttendanceEditLogs = [];
        }
        let logs = this.db.teacherAttendanceEditLogs;
        if (options.teacherId) {
            logs = logs.filter(log => log.teacherId === options.teacherId);
        }
        if (options.date) {
            logs = logs.filter(log => log.date === options.date);
        }
        // Return sorted by changedAt descending
        return [...logs].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    },

    getActiveTeachers() {
        return this.getTeachers().filter(t => t.employmentStatus !== 'resigned');
    },

    resignTeacher(teacherId, payload) {
        if (!payload || !payload.resignedAt) {
            throw new Error('퇴사 일자는 필수 항목입니다.');
        }
        const teacher = this.db.teachers.find(t => t.id === teacherId);
        if (!teacher) {
            throw new Error('강사를 찾을 수 없습니다.');
        }
        teacher.employmentStatus = 'resigned';
        teacher.resignedAt = payload.resignedAt;
        teacher.resignMemo = payload.memo || '';
        teacher.updatedAt = new Date().toISOString();
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
        return teacher;
    },

    canDeleteTeacher(teacherId) {
        const teacher = this.db.teachers.find(t => t.id === teacherId);
        if (!teacher) {
            return { canDelete: false, reasons: ['해당 강사를 찾을 수 없습니다.'] };
        }

        const reasons = [];

        // 1. teacherAttendanceLogs 검사
        const hasAttendance = this.db.teacherAttendanceLogs && this.db.teacherAttendanceLogs.some(log => log.teacherId === teacherId);
        if (hasAttendance) {
            reasons.push('강사의 출퇴근 근태 기록이 존재합니다.');
        }

        // 2. teacherShifts 검사
        const hasShifts = this.db.teacherShifts && this.db.teacherShifts.some(ts => ts.teacherId === teacherId);
        if (hasShifts) {
            reasons.push('강사의 일정(근무 시간표) 설정 데이터가 존재합니다.');
        }

        // 3. students 검사
        const hasStudents = this.db.students && this.db.students.some(s => s.teacherId === teacherId);
        if (hasStudents) {
            reasons.push('해당 강사가 배정되어 있는 담당 수강생이 존재합니다.');
        }

        // 4. scheduleSnapshots 검사
        const hasSnapshots = this.db.scheduleSnapshots && this.db.scheduleSnapshots.some(snap => 
            snap.entries && snap.entries.some(entry => entry.teacherId === teacherId)
        );
        if (hasSnapshots) {
            reasons.push('수업 시간표 스냅샷에 해당 강사의 배정 이력이 존재합니다.');
        }

        // 5. scheduleOverrides 검사
        const hasOverrides = this.db.scheduleOverrides && this.db.scheduleOverrides.some(o => 
            o.toTeacherId === teacherId || o.fromTeacherId === teacherId
        );
        if (hasOverrides) {
            reasons.push('수업 일정 변경 이력(오버라이드)에 해당 강사의 배정 기록이 존재합니다.');
        }

        // 6. scheduleOperationLogs 검사
        const hasOperationLogs = this.db.scheduleOperationLogs && this.db.scheduleOperationLogs.some(log => 
            (log.before && log.before.teacherId === teacherId) || (log.after && log.after.teacherId === teacherId)
        );
        if (hasOperationLogs) {
            reasons.push('시간표 조작 로그에 해당 강사의 배정 이력이 존재합니다.');
        }

        // 7. majorSchedules 검사
        const hasMajorSchedules = this.db.majorSchedules && this.db.majorSchedules.some(e => 
            e.ownerId && e.ownerId.trim() === teacher.name.trim()
        );
        if (hasMajorSchedules) {
            reasons.push('학원 주요 일정에 담당자로 지정되어 있습니다.');
        }

        return {
            canDelete: reasons.length === 0,
            reasons
        };
    },

    deleteTeacherIfUnused(teacherId) {
        const check = this.canDeleteTeacher(teacherId);
        if (!check.canDelete) {
            return {
                canDelete: false,
                reasons: check.reasons
            };
        }

        const initialLength = this.db.teachers.length;
        this.db.teachers = this.db.teachers.filter(t => t.id !== teacherId);
        
        if (this.db.teachers.length < initialLength) {
            this.saveDB();
            this.notify('TEACHERS_CHANGED', this.db.teachers);
            return {
                canDelete: true,
                reasons: []
            };
        }

        return {
            canDelete: false,
            reasons: ['데이터 삭제 처리에 실패했습니다.']
        };
    }
};
