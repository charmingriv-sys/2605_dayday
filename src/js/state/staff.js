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
    }
};
