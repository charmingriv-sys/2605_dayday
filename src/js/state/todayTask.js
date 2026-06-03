// todayTask.js - TodayTask Domain State Module

export const todayTaskMethods = {
    // --- TODAY TASKS ---
    getTodayTasks() {
        return [...(this.db.todayTasks || [])];
    },

    getActiveTodayTasks(now = new Date()) {
        const parsedNow = now instanceof Date ? now : new Date(now);
        const nowTime = parsedNow.getTime();

        const activeTasks = (this.db.todayTasks || []).filter(task => {
            if (task.status === 'open') {
                return true;
            }
            if (task.status === 'snoozed' && task.snoozedUntil) {
                return new Date(task.snoozedUntil).getTime() <= nowTime;
            }
            return false;
        });

        const getPriorityWeight = (priority) => {
            const weights = { urgent: 0, today: 1, closing: 2, info: 3 };
            return weights[priority] !== undefined ? weights[priority] : 99;
        };

        const toSortableTime = (value, fallback = Number.POSITIVE_INFINITY) => {
            const time = value ? new Date(value).getTime() : NaN;
            return Number.isFinite(time) ? time : fallback;
        };

        activeTasks.sort((a, b) => {
            // 1. Priority Weight ascending
            const wA = getPriorityWeight(a.priority);
            const wB = getPriorityWeight(b.priority);
            if (wA !== wB) return wA - wB;

            // 2. dueAt ascending
            const dueA = toSortableTime(a.dueAt);
            const dueB = toSortableTime(b.dueAt);
            if (dueA !== dueB) return dueA - dueB;

            // 3. createdAt ascending
            const createA = toSortableTime(a.createdAt);
            const createB = toSortableTime(b.createdAt);
            if (createA !== createB) return createA - createB;

            return 0;
        });

        return [...activeTasks];
    },

    getDoneTodayTasks(now = new Date()) {
        const parsedNow = now instanceof Date ? now : new Date(now);
        const y = parsedNow.getFullYear();
        const m = parsedNow.getMonth();
        const d = parsedNow.getDate();

        const isSameDay = (isoStr) => {
            if (!isoStr) return false;
            try {
                const date = new Date(isoStr);
                return date.getFullYear() === y &&
                       date.getMonth() === m &&
                       date.getDate() === d;
            } catch (e) {
                return false;
            }
        };

        const doneTasks = (this.db.todayTasks || []).filter(task => {
            if (task.status !== 'done') return false;
            return isSameDay(task.completedAt) ||
                   isSameDay(task.dueAt) ||
                   isSameDay(task.startAt);
        });

        doneTasks.sort((a, b) => {
            const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return timeA - timeB;
        });

        return [...doneTasks];
    },

    addTodayTask(task) {
        if (!task) return null;

        const nowIso = new Date().toISOString();

        // 1. Resolve duplicate using dedupeKey if provided
        if (task.dedupeKey) {
            const existingIndex = this.db.todayTasks.findIndex(t => t.dedupeKey === task.dedupeKey);
            if (existingIndex !== -1) {
                const existing = this.db.todayTasks[existingIndex];
                const updated = {
                    ...existing,
                    ...task,
                    id: existing.id, // preserve original id
                    createdAt: existing.createdAt, // preserve original createdAt
                    updatedAt: nowIso
                };

                // Adjust status related timestamps only when status field is provided
                if (task.status !== undefined) {
                    if (task.status === 'done') {
                        updated.completedAt = task.completedAt || existing.completedAt || nowIso;
                    } else {
                        updated.completedAt = undefined;
                    }

                    if (task.status === 'snoozed') {
                        updated.snoozedUntil = task.snoozedUntil || existing.snoozedUntil || new Date(Date.now() + 60 * 60 * 1000).toISOString();
                    } else {
                        updated.snoozedUntil = undefined;
                    }

                    if (task.status === 'dismissed') {
                        updated.dismissedAt = task.dismissedAt || existing.dismissedAt || nowIso;
                    } else {
                        updated.dismissedAt = undefined;
                    }
                } else {
                    // status is omitted, preserve all existing status timestamps
                    updated.completedAt = existing.completedAt;
                    updated.snoozedUntil = existing.snoozedUntil;
                    updated.dismissedAt = existing.dismissedAt;
                }

                this.db.todayTasks[existingIndex] = updated;
                this.saveDB();
                this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks);
                return updated;
            }
        }

        // 2. Insert new task with defaults
        const newTask = {
            id: task.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'TASK_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
            organizationId: task.organizationId || '',
            segment: task.segment || 'academy_director_console',
            domain: task.domain || 'academy',
            source: task.source || 'manual',
            type: task.type || 'memo',
            priority: task.priority || 'today',
            status: task.status || 'open',
            dueAt: task.dueAt || nowIso,
            title: task.title || '',
            description: task.description || '',
            visibilityRoles: task.visibilityRoles || ['director'],
            createdAt: task.createdAt || nowIso,
            updatedAt: task.updatedAt || nowIso,
            ...task
        };

        // Initialize status-related timestamps
        if (newTask.status === 'done') {
            newTask.completedAt = newTask.completedAt || nowIso;
        } else {
            newTask.completedAt = undefined;
        }

        if (newTask.status === 'snoozed') {
            newTask.snoozedUntil = newTask.snoozedUntil || new Date(Date.now() + 60 * 60 * 1000).toISOString();
        } else {
            newTask.snoozedUntil = undefined;
        }

        if (newTask.status === 'dismissed') {
            newTask.dismissedAt = newTask.dismissedAt || nowIso;
        } else {
            newTask.dismissedAt = undefined;
        }

        this.db.todayTasks.push(newTask);
        this.saveDB();
        this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks);
        return newTask;
    },

    updateTodayTask(taskId, patch) {
        if (!patch) return null;

        const existingIndex = this.db.todayTasks.findIndex(t => t.id === taskId);
        if (existingIndex === -1) return null;

        const existing = this.db.todayTasks[existingIndex];
        const nowIso = new Date().toISOString();

        const updated = {
            ...existing,
            ...patch,
            id: existing.id, // prevent id change
            createdAt: existing.createdAt, // prevent createdAt change
            updatedAt: nowIso
        };

        // Adjust status related timestamps only when status field is provided
        if (patch.status !== undefined) {
            if (patch.status === 'done') {
                updated.completedAt = patch.completedAt || existing.completedAt || nowIso;
            } else {
                updated.completedAt = undefined;
            }

            if (patch.status === 'snoozed') {
                updated.snoozedUntil = patch.snoozedUntil || existing.snoozedUntil || new Date(Date.now() + 60 * 60 * 1000).toISOString();
            } else {
                updated.snoozedUntil = undefined;
            }

            if (patch.status === 'dismissed') {
                updated.dismissedAt = patch.dismissedAt || existing.dismissedAt || nowIso;
            } else {
                updated.dismissedAt = undefined;
            }
        } else {
            // preserve existing status timestamps when status is not in the patch
            updated.completedAt = existing.completedAt;
            updated.snoozedUntil = existing.snoozedUntil;
            updated.dismissedAt = existing.dismissedAt;
        }

        this.db.todayTasks[existingIndex] = updated;
        this.saveDB();
        this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks);
        return updated;
    },

    deleteTodayTask(taskId) {
        const originalLength = this.db.todayTasks.length;
        this.db.todayTasks = this.db.todayTasks.filter(t => t.id !== taskId);
        
        if (this.db.todayTasks.length !== originalLength) {
            this.saveDB();
            this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks);
            return true;
        }
        return false;
    },

    removeTodayTask(taskId) {
        return this.deleteTodayTask(taskId);
    },

    markTodayTaskDone(taskId) {
        return this.updateTodayTask(taskId, { status: 'done' });
    },

    snoozeTodayTask(taskId, snoozedUntil) {
        return this.updateTodayTask(taskId, { status: 'snoozed', snoozedUntil });
    },

    dismissTodayTask(taskId) {
        return this.updateTodayTask(taskId, { status: 'dismissed' });
    },

    reopenTodayTask(taskId) {
        return this.updateTodayTask(taskId, { status: 'open' });
    },

    // --- MOCK CALENDAR EVENTS ---
    getMockCalendarEvents() {
        return [...(this.db.mockCalendarEvents || [])];
    },

    addMockCalendarEvent(event) {
        if (!event) return null;
        const newEvent = {
            id: event.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'CAL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
            externalId: event.externalId || '',
            provider: event.provider || 'local',
            calendarId: event.calendarId || 'default',
            title: event.title || '',
            description: event.description || '',
            startsAt: event.startsAt || '',
            endsAt: event.endsAt || '',
            ...event
        };
        if (!this.db.mockCalendarEvents) {
            this.db.mockCalendarEvents = [];
        }
        this.db.mockCalendarEvents.push(newEvent);
        this.saveDB();
        this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks);
        return newEvent;
    },

    clearMockCalendarEvents() {
        this.db.mockCalendarEvents = [];
        this.saveDB();
        this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks);
    },

    getTodayCalendarEvents(now = new Date()) {
        const parsedNow = now instanceof Date ? now : new Date(now);
        const y = parsedNow.getFullYear();
        const m = parsedNow.getMonth();
        const d = parsedNow.getDate();

        const startOfDay = new Date(y, m, d, 0, 0, 0, 0);
        const endOfDay = new Date(y, m, d, 23, 59, 59, 999);
        return this.getCalendarEventsForRange(startOfDay, endOfDay);
    },

    getCalendarEventsForRange(startDate, endDate) {
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();

        const overlapsRange = (startsISO, endsISO) => {
            if (!startsISO || !endsISO) return false;
            try {
                const s = new Date(startsISO).getTime();
                const e = new Date(endsISO).getTime();
                if (isNaN(s) || isNaN(e)) return false;
                return s <= endMs && e >= startMs;
            } catch (err) {
                return false;
            }
        };

        // 1. Map and filter TodayTask events
        const taskEvents = (this.db.todayTasks || [])
            .filter(task => {
                if (task.status !== 'open' && task.status !== 'done') return false;
                return task.startAt && task.endAt && overlapsRange(task.startAt, task.endAt);
            })
            .map(task => ({
                id: task.id,
                source: 'todayTask',
                title: task.title,
                description: task.description || '',
                startsAt: task.startAt,
                endsAt: task.endAt,
                status: task.status,
                category: task.category || '',
                priority: task.priority || '',
                provider: 'app',
                taskSource: task.source || 'manual'
            }));

        // 2. Map and filter mockCalendarEvents
        const calendarEvents = (this.db.mockCalendarEvents || [])
            .filter(event => {
                return event.startsAt && event.endsAt && overlapsRange(event.startsAt, event.endsAt);
            })
            .map(event => ({
                id: event.id,
                source: 'mockCalendar',
                title: event.title,
                description: event.description || '',
                startsAt: event.startsAt,
                endsAt: event.endsAt,
                status: 'open',
                category: '',
                provider: event.provider || 'local'
            }));

        // 3. Merge and sort
        const merged = [...taskEvents, ...calendarEvents];
        merged.sort((a, b) => {
            const timeA = new Date(a.startsAt).getTime();
            const timeB = new Date(b.startsAt).getTime();
            return timeA - timeB;
        });

        return merged;
    },

    // --- SYSTEM RECOMMENDATIONS ---
    syncSystemRecommendations(now = new Date()) {
        const parsedNow = now instanceof Date ? now : new Date(now);
        const y = parsedNow.getFullYear();
        const m = parsedNow.getMonth();
        const d = parsedNow.getDate();
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

        const newRecommendations = [];

        // 1. Billing Unpaid Rule
        if (typeof this.getStudents === 'function' && typeof this.getPayments === 'function') {
            const students = this.getStudents();
            const payments = this.getPayments();
            students.forEach(student => {
                const payment = payments.find(p => p.studentId === student.id && p.type === 'education' && p.month === monthStr);
                if (payment && payment.status !== 'paid') {
                    const dueDay = student.dueDay || 10;
                    if (d >= dueDay) {
                        const dedupeKey = `SYSTEM_RECOMMEND_BILLING_UNPAID_${payment.id}_${monthStr}`;
                        const dueTime = new Date(y, m, dueDay, 9, 0, 0, 0);
                        const endTime = new Date(y, m, dueDay, 10, 0, 0, 0);
                        newRecommendations.push({
                            organizationId: student.academyId || '',
                            segment: 'academy_director_console',
                            domain: 'academy',
                            source: 'system',
                            type: 'billing',
                            category: 'system_check',
                            priority: 'today',
                            status: 'open',
                            dueAt: dueTime.toISOString(),
                            startAt: dueTime.toISOString(),
                            endAt: endTime.toISOString(),
                            title: `${student.name} 원생 수강료 미납 확인 필요`,
                            description: `${student.name} 원생의 ${y}년 ${m + 1}월 교육비 수강료(${payment.amount.toLocaleString()}원) 정기 수납일(매월 ${dueDay}일)이 경과하였으나 미납 상태입니다. 수납 상태 확인 및 학부모 안내가 필요합니다.`,
                            relatedStudentIds: [student.id],
                            dedupeKey: dedupeKey,
                            visibilityRoles: ['director'],
                            actionType: 'NAVIGATE',
                            actionPayload: { route: '/billing', studentId: student.id }
                        });
                    }
                }
            });
        }

        // 2. Attendance Delay Rule
        if (typeof this.getTeacherStudentScheduleForDate === 'function' && typeof this.getAttendance === 'function') {
            const todaySchedule = this.getTeacherStudentScheduleForDate(dateStr) || [];
            const attendanceList = this.getAttendance() || [];
            todaySchedule.forEach(entry => {
                const att = attendanceList.find(a => a.studentId === entry.studentId && a.date === dateStr);
                const hasAttendance = att && att.status !== 'none';
                if (!hasAttendance) {
                    const timePart = entry.time || '14:00';
                    const [h, min] = timePart.split(':').map(Number);
                    const classStartTime = new Date(y, m, d, h, min, 0, 0);
                    // Check if 15 minutes have passed
                    if (parsedNow.getTime() - classStartTime.getTime() >= 15 * 60 * 1000) {
                        const dedupeKey = `SYSTEM_RECOMMEND_ATTENDANCE_LATE_${entry.studentId}_${dateStr}`;
                        const student = typeof this.getStudent === 'function' ? this.getStudent(entry.studentId) : null;
                        const studentName = student ? student.name : '원생';
                        newRecommendations.push({
                            organizationId: student ? (student.academyId || '') : '',
                            segment: 'academy_director_console',
                            domain: 'academy',
                            source: 'system',
                            type: 'attendance',
                            category: 'system_check',
                            priority: 'today',
                            status: 'open',
                            dueAt: new Date(classStartTime.getTime() + 15 * 60 * 1000).toISOString(),
                            startAt: classStartTime.toISOString(),
                            endAt: new Date(classStartTime.getTime() + 60 * 60 * 1000).toISOString(),
                            title: `${studentName} 원생 출결 입력 지연`,
                            description: `${studentName} 원생의 오늘 ${timePart} 수업 시작 후 15분이 경과하였으나 출결 기록이 완료되지 않았습니다. 등원 여부 확인 및 출결 태깅 지도가 필요합니다.`,
                            relatedStudentIds: [entry.studentId],
                            relatedTeacherIds: [entry.teacherId].filter(Boolean),
                            dedupeKey: dedupeKey,
                            visibilityRoles: ['director'],
                            actionType: 'NAVIGATE',
                            actionPayload: { route: '/attendance', studentId: entry.studentId }
                        });
                    }
                }
            });
        }

        // Apply dedupe/upsert check
        newRecommendations.forEach(rec => {
            if (rec.dedupeKey) {
                const existing = this.db.todayTasks.find(t => t.dedupeKey === rec.dedupeKey);
                if (existing) {
                    const isChanged = 
                        existing.title !== rec.title ||
                        existing.description !== rec.description ||
                        existing.status !== rec.status ||
                        existing.dueAt !== rec.dueAt ||
                        existing.startAt !== rec.startAt ||
                        existing.endAt !== rec.endAt;
                    if (!isChanged) {
                        return; // Skip upsert if identical to avoid infinite notify loop
                    }
                }
            }
            this.addTodayTask(rec);
        });

        // 3. Auto-Resolve Conditions
        const existingTasks = this.getTodayTasks() || [];
        existingTasks.forEach(task => {
            if (task.source === 'system' && task.status === 'open') {
                if (task.dedupeKey && task.dedupeKey.startsWith('SYSTEM_RECOMMEND_BILLING_UNPAID_')) {
                    const prefix = 'SYSTEM_RECOMMEND_BILLING_UNPAID_';
                    const rest = task.dedupeKey.substring(prefix.length);
                    const lastUnderscore = rest.lastIndexOf('_');
                    const paymentId = lastUnderscore !== -1 ? rest.substring(0, lastUnderscore) : rest;
                    if (typeof this.getPayments === 'function') {
                        const payments = this.getPayments();
                        const payment = payments.find(p => p.id === paymentId);
                        if (payment && payment.status === 'paid') {
                            this.updateTodayTask(task.id, { status: 'done', completedAt: parsedNow.toISOString() });
                        }
                    }
                } else if (task.dedupeKey && task.dedupeKey.startsWith('SYSTEM_RECOMMEND_ATTENDANCE_LATE_')) {
                    const prefix = 'SYSTEM_RECOMMEND_ATTENDANCE_LATE_';
                    const rest = task.dedupeKey.substring(prefix.length);
                    const lastUnderscore = rest.lastIndexOf('_');
                    const studentId = lastUnderscore !== -1 ? rest.substring(0, lastUnderscore) : rest;
                    const targetDate = lastUnderscore !== -1 ? rest.substring(lastUnderscore + 1) : '';
                    if (typeof this.getAttendance === 'function') {
                        const attendanceList = this.getAttendance() || [];
                        const att = attendanceList.find(a => a.studentId === studentId && a.date === targetDate);
                        if (att && att.status !== 'none') {
                            this.updateTodayTask(task.id, { status: 'done', completedAt: parsedNow.toISOString() });
                        }
                    }
                }
            }
        });

        return this.getTodayTasks();
    }
};
