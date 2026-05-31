// sessions.js - Class schedules, sessions Domain State Module

function getDayOfWeekKo(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[d.getDay()];
}

function calculateEndTime(startTimeStr, slotMinutes) {
    const [h, m] = startTimeStr.split(':').map(Number);
    let totalMinutes = h * 60 + m + slotMinutes;
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export const sessionsMethods = {
    // --- CLASSES ---
    getClasses() {
        return this.db.classes;
    },

    getClassesForStudent(studentId) {
        return this.db.classes.filter(c => c.studentId === studentId);
    },

    // --- SCHEDULE SNAPSHOTS & OVERRIDES ---
    
    getTeacherStudentScheduleForDate(date, options = {}) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const isFuture = date > todayStr;
        let entries = [];
        const dayOfWeekKo = getDayOfWeekKo(date);

        if (!isFuture) {
            // 과거 및 오늘 날짜: snapshot 우선 사용
            let snapshot = this.db.scheduleSnapshots.find(s => s.date === date);
            if (!snapshot) {
                snapshot = this.ensureScheduleSnapshotForDate(date, options);
            }
            
            entries = snapshot.entries.map(entry => ({
                id: entry.id,
                studentId: entry.studentId,
                dayOfWeek: dayOfWeekKo,
                time: entry.startTime,
                teacherId: entry.teacherId,
                source: entry.source || 'default'
            }));
        } else {
            // 미래 날짜: 기본 시간표 + 날짜별 override 동적 생성
            const baseClasses = this.db.classes.filter(c => c.dayOfWeek === dayOfWeekKo);
            const overrides = this.db.scheduleOverrides.filter(o => o.date === date);

            entries = baseClasses.map(c => {
                const student = this.db.students.find(s => s.id === c.studentId);
                const defaultTeacherId = student ? student.teacherId : null;
                const ovr = overrides.find(o => o.studentId === c.studentId);

                if (ovr) {
                    return {
                        id: c.id,
                        studentId: c.studentId,
                        dayOfWeek: dayOfWeekKo,
                        time: ovr.toStartTime,
                        teacherId: ovr.toTeacherId,
                        source: 'override'
                    };
                }

                return {
                    id: c.id,
                    studentId: c.studentId,
                    dayOfWeek: dayOfWeekKo,
                    time: c.time,
                    teacherId: defaultTeacherId,
                    source: 'default'
                };
            });
        }

        // Apply filters
        if (options.teacherId) {
            entries = entries.filter(e => e.teacherId === options.teacherId);
        }
        if (options.subjectFilter && options.subjectFilter !== 'all') {
            entries = entries.filter(e => {
                const student = this.db.students.find(s => s.id === e.studentId);
                return student && student.instrument === options.subjectFilter;
            });
        }

        return entries;
    },

    ensureScheduleSnapshotForDate(date, options = {}) {
        let snapshot = this.db.scheduleSnapshots.find(s => s.date === date);
        if (snapshot) {
            return snapshot;
        }

        const dayOfWeekKo = getDayOfWeekKo(date);
        const baseClasses = this.db.classes.filter(c => c.dayOfWeek === dayOfWeekKo);
        const overrides = this.db.scheduleOverrides.filter(o => o.date === date);
        const slotMinutes = (this.db.settings && this.db.settings.scheduleSlotMinutes) || 30;

        const entries = baseClasses.map((c, idx) => {
            const student = this.db.students.find(s => s.id === c.studentId);
            const defaultTeacherId = student ? student.teacherId : null;
            const ovr = overrides.find(o => o.studentId === c.studentId);

            if (ovr) {
                return {
                    id: `ENTRY_${date}_${c.studentId}_${idx}`,
                    studentId: c.studentId,
                    teacherId: ovr.toTeacherId,
                    startTime: ovr.toStartTime,
                    endTime: calculateEndTime(ovr.toStartTime, slotMinutes),
                    subjectId: student ? student.instrument : '',
                    source: 'override'
                };
            }

            return {
                id: `ENTRY_${date}_${c.studentId}_${idx}`,
                studentId: c.studentId,
                teacherId: defaultTeacherId,
                startTime: c.time,
                endTime: calculateEndTime(c.time, slotMinutes),
                subjectId: student ? student.instrument : '',
                source: 'default'
            };
        });

        const newSnapshot = {
            id: `SNAP_${date}_${options.academyId || 'AC1'}`,
            academyId: options.academyId || 'AC1',
            date: date,
            type: 'teacherStudentSchedule',
            entries: entries,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.db.scheduleSnapshots.push(newSnapshot);
        this.saveDB();
        return newSnapshot;
    },

    moveStudentScheduleForDate(date, movePayload) {
        // 1. Ensure snapshot exists
        const snapshot = this.ensureScheduleSnapshotForDate(date, { academyId: movePayload.academyId || 'AC1' });
        
        // 2. Find target entry in snapshot
        const entry = snapshot.entries.find(e => e.studentId === movePayload.studentId);
        
        let beforeTeacherId = null;
        let beforeStartTime = null;

        if (entry) {
            beforeTeacherId = entry.teacherId;
            beforeStartTime = entry.startTime;

            // Update entry in snapshot
            entry.teacherId = movePayload.toTeacherId;
            entry.startTime = movePayload.toStartTime;
            entry.endTime = calculateEndTime(movePayload.toStartTime, (this.db.settings && this.db.settings.scheduleSlotMinutes) || 30);
            entry.source = 'override';
            snapshot.updatedAt = new Date().toISOString();
        } else {
            // Entry not found in snapshot (e.g. this student didn't have classes originally scheduled on this day)
            // Create a new entry
            const student = this.db.students.find(s => s.id === movePayload.studentId);
            beforeTeacherId = student ? student.teacherId : null;
            beforeStartTime = movePayload.fromStartTime || '14:00';

            const newEntry = {
                id: `ENTRY_${date}_${movePayload.studentId}_${snapshot.entries.length}`,
                studentId: movePayload.studentId,
                teacherId: movePayload.toTeacherId,
                startTime: movePayload.toStartTime,
                endTime: calculateEndTime(movePayload.toStartTime, (this.db.settings && this.db.settings.scheduleSlotMinutes) || 30),
                subjectId: student ? student.instrument : '',
                source: 'override'
            };
            snapshot.entries.push(newEntry);
            snapshot.updatedAt = new Date().toISOString();
        }

        // 3. Add override history
        const override = {
            id: `OVR_${date}_${movePayload.studentId}_${Date.now()}`,
            academyId: movePayload.academyId || 'AC1',
            date: date,
            studentId: movePayload.studentId,
            fromTeacherId: beforeTeacherId,
            toTeacherId: movePayload.toTeacherId,
            fromStartTime: beforeStartTime,
            toStartTime: movePayload.toStartTime,
            reason: movePayload.reason || 'daily-adjustment',
            createdBy: movePayload.createdBy || 'USR_DIR_DEMO',
            createdAt: new Date().toISOString()
        };
        this.db.scheduleOverrides.push(override);

        // 4. Add operation log
        const log = {
            id: `LOG_${date}_${movePayload.studentId}_${Date.now()}`,
            academyId: movePayload.academyId || 'AC1',
            date: date,
            action: 'move_student_schedule',
            studentId: movePayload.studentId,
            before: {
                teacherId: beforeTeacherId,
                startTime: beforeStartTime
            },
            after: {
                teacherId: movePayload.toTeacherId,
                startTime: movePayload.toStartTime
            },
            createdBy: movePayload.createdBy || 'USR_DIR_DEMO',
            createdAt: new Date().toISOString()
        };
        this.db.scheduleOperationLogs.push(log);

        // 5. Save database
        this.saveDB();
        this.notify('scheduleChanged', { date, studentId: movePayload.studentId });
    },

    getScheduleOverridesForDate(date, options = {}) {
        return this.db.scheduleOverrides.filter(o => o.date === date);
    },

    getScheduleOperationLogs(date, options = {}) {
        return this.db.scheduleOperationLogs.filter(l => l.date === date);
    }
};
