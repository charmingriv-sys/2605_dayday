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

        // Ensure database lists are initialized
        if (!this.db.todayTasks) this.db.todayTasks = [];

        // 1. Billing Unpaid Rule (Phase 13D Placeholder)
        const unpaidBills = [];
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
                        unpaidBills.push({
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

        // Apply Unpaid bills
        unpaidBills.forEach(rec => {
            const existing = this.db.todayTasks.find(t => t.dedupeKey === rec.dedupeKey);
            if (!existing) {
                this.addTodayTask(rec);
            }
        });

        // 2. Student Attendance Warnings (Phase 13C Core Warning Engine)
        if (typeof this.getTeacherStudentScheduleForDate === 'function' && typeof this.getAttendance === 'function') {
            const todaySchedule = this.getTeacherStudentScheduleForDate(dateStr) || [];
            const attendanceList = this.getAttendance() || [];

            // Warning policy settings
            const lateDetectionEnabled = typeof this.getLateDetectionEnabled === 'function' ? this.getLateDetectionEnabled() : true;
            const lateThresholdMinutes = typeof this.getLateThresholdMinutes === 'function' ? this.getLateThresholdMinutes() : 10;
            const studentAbsenceWarningEnabled = typeof this.getStudentAbsenceWarningEnabled === 'function' ? this.getStudentAbsenceWarningEnabled() : true;
            const studentCheckoutMissingWarningEnabled = typeof this.getStudentCheckoutMissingWarningEnabled === 'function' ? this.getStudentCheckoutMissingWarningEnabled() : true;
            const studentCheckoutMissingGraceMinutes = typeof this.getStudentCheckoutMissingGraceMinutes === 'function' ? this.getStudentCheckoutMissingGraceMinutes() : 10;

            const activeSessionKeys = [];

            todaySchedule.forEach(entry => {
                const sessionKey = `${entry.studentId}_${dateStr}_${entry.time}`;
                activeSessionKeys.push(sessionKey);

                // 2.2 Calculate schedule timings
                const student = typeof this.getStudent === 'function' ? this.getStudent(entry.studentId) : null;
                const studentName = student ? student.name : '원생';
                const [sh, smin] = entry.time.split(':').map(Number);
                const scheduledStartAt = new Date(y, m, d, sh, smin, 0, 0);
                const duration = entry.classDuration || (student ? student.defaultClassDuration : 50) || 50;
                const scheduledEndAt = new Date(scheduledStartAt.getTime() + duration * 60 * 1000);

                // 2.3 Retrieve attendance details
                const att = attendanceList.find(a => a.studentId === entry.studentId && a.date === dateStr && (a.classTime === entry.time || !a.classTime));
                const hasAttendance = att && att.status !== 'none';

                // 2.4 State transition warning evaluation
                let currentWarningState = 'NONE';
                let checkoutLimit = null;

                if (!hasAttendance) {
                    // 수업 종료 후 출석이 없으면 결석 확인 대상
                    if (studentAbsenceWarningEnabled && parsedNow.getTime() > scheduledEndAt.getTime()) {
                        currentWarningState = 'ABSENT';
                    }
                } else if (att.status !== 'absent') {
                    // 출석한 경우
                    let isLate = false;
                    let actualCheckInAt = null;

                    if (lateDetectionEnabled && att.time) {
                        const [actH, actM] = att.time.split(':').map(Number);
                        actualCheckInAt = new Date(y, m, d, actH, actM, 0, 0);
                        const lateLimit = new Date(scheduledStartAt.getTime() + lateThresholdMinutes * 60 * 1000);
                        // 지각 판단 (초과 시)
                        if (actualCheckInAt.getTime() > lateLimit.getTime()) {
                            isLate = true;
                        }
                    }

                    let isCheckoutMissing = false;
                    // 하원이 찍혀있지 않을 때만 하원누락 대상
                    if (studentCheckoutMissingWarningEnabled && !att.leavingTime) {
                        // 기준 종료 시각 산정
                        if (isLate && actualCheckInAt) {
                            checkoutLimit = new Date(actualCheckInAt.getTime() + (duration + studentCheckoutMissingGraceMinutes) * 60 * 1000);
                        } else {
                            checkoutLimit = new Date(scheduledStartAt.getTime() + (duration + studentCheckoutMissingGraceMinutes) * 60 * 1000);
                        }

                        if (parsedNow.getTime() > checkoutLimit.getTime()) {
                            isCheckoutMissing = true;
                        }
                    }

                    // 상태 결합
                    if (isLate && isCheckoutMissing) {
                        currentWarningState = 'LATE_CHECKOUT_MISSING';
                    } else if (isLate) {
                        currentWarningState = 'LATE';
                    } else if (isCheckoutMissing) {
                        currentWarningState = 'CHECKOUT_MISSING';
                    }
                }

                // 2.4.1 Calculate dedupe keys and check if already resolved by user
                const warningKeys = [
                    `SYSTEM_RECOMMEND_ABSENT_${sessionKey}`,
                    `SYSTEM_RECOMMEND_LATE_${sessionKey}`,
                    `SYSTEM_RECOMMEND_CHECKOUT_MISSING_${sessionKey}`,
                    `SYSTEM_RECOMMEND_LATE_CHECKOUT_MISSING_${sessionKey}`
                ];
                const targetDedupeKey = currentWarningState !== 'NONE' ? `SYSTEM_RECOMMEND_${currentWarningState}_${sessionKey}` : null;

                const hasResolvedWarning = targetDedupeKey && this.db.todayTasks.some(t => 
                    t.source === 'system' && 
                    (t.status === 'done' || t.status === 'dismissed') && 
                    t.dedupeKey === targetDedupeKey
                );

                // 2.5 Clear obsolete warnings that are no longer matching the current state
                this.db.todayTasks = this.db.todayTasks.filter(t => {
                    if (t.source === 'system' && t.status === 'open' && t.dedupeKey && warningKeys.includes(t.dedupeKey)) {
                        // Keep only if it matches the newly evaluated target state
                        return t.dedupeKey === targetDedupeKey;
                    }
                    return true;
                });

                // 2.6 Add new warning if applicable and not already created or resolved by user
                if (currentWarningState !== 'NONE' && !hasResolvedWarning) {
                    const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === targetDedupeKey && t.status === 'open');
                    if (!isAlreadyOpen) {
                        let title = '';
                        let description = '';
                        let category = 'attendance_warning';
                        let dueAt = scheduledEndAt.toISOString();
                        let warningTypeLabel = '';
                        let reason = '';

                        if (currentWarningState === 'ABSENT') {
                            category = 'absent';
                            title = `${studentName} 원생 결석 확인 필요`;
                            warningTypeLabel = '결석 확인';
                            reason = '수업이 끝났지만 출석 기록이 없습니다.';
                            dueAt = scheduledEndAt.toISOString();
                        } else if (currentWarningState === 'LATE') {
                            title = `${studentName} 원생 지각 출석`;
                            warningTypeLabel = '지각';
                            reason = '수업 시작 후 출석했습니다.';
                            dueAt = new Date(scheduledStartAt.getTime() + lateThresholdMinutes * 60 * 1000).toISOString();
                        } else if (currentWarningState === 'CHECKOUT_MISSING') {
                            title = `${studentName} 원생 하원누락 확인 필요`;
                            warningTypeLabel = '하원누락';
                            reason = '수업 시간이 지났지만 하원 기록이 없습니다.';
                            dueAt = checkoutLimit ? checkoutLimit.toISOString() : scheduledEndAt.toISOString();
                        } else if (currentWarningState === 'LATE_CHECKOUT_MISSING') {
                            title = `${studentName} 원생 지각 출석 및 하원누락`;
                            warningTypeLabel = '지각 + 하원누락';
                            reason = '지각 출석 후 하원 기록이 없습니다.';
                            dueAt = checkoutLimit ? checkoutLimit.toISOString() : scheduledEndAt.toISOString();
                        }

                        const startHM = entry.time;
                        const pad = (n) => String(n).padStart(2, '0');
                        const endHM = entry.endTime || `${pad(scheduledEndAt.getHours())}:${pad(scheduledEndAt.getMinutes())}`;
                        const teacher = entry.teacherId ? (typeof this.getTeacher === 'function' ? this.getTeacher(entry.teacherId) : null) : null;
                        const teacherName = teacher ? teacher.name : '미지정';
                        const instrument = student ? (student.instrument || '미지정') : '미지정';

                        description = `• 원생명: ${studentName}\n• 수업 시간: ${startHM} ~ ${endHM}\n• 담당 강사: ${teacherName}\n• 과목/악기: ${instrument}\n• 워닝 유형: ${warningTypeLabel}\n• 간단 사유: ${reason}`;

                        this.addTodayTask({
                            organizationId: student ? (student.academyId || '') : '',
                            segment: 'academy_director_console',
                            domain: 'academy',
                            source: 'system',
                            type: 'attendance',
                            category: category,
                            priority: 'today',
                            status: 'open',
                            dueAt: dueAt,
                            startAt: scheduledStartAt.toISOString(),
                            endAt: scheduledEndAt.toISOString(),
                            title: title,
                            description: description,
                            relatedStudentIds: [entry.studentId],
                            relatedTeacherIds: [entry.teacherId].filter(Boolean),
                            dedupeKey: targetDedupeKey,
                            visibilityRoles: ['director'],
                            actionType: 'NAVIGATE',
                            actionPayload: { route: '/attendance', studentId: entry.studentId }
                        });
                    }
                }
            });

            // 3. Clean up warnings for cancelled schedules or changed teachers
            this.db.todayTasks = this.db.todayTasks.filter(t => {
                if (t.source === 'system' && t.status === 'open' && t.dedupeKey) {
                    const isStudentWarning = 
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_ABSENT_') ||
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_LATE_') ||
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_CHECKOUT_MISSING_') ||
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_LATE_CHECKOUT_MISSING_');
                        
                    if (isStudentWarning) {
                        const hasActiveSchedule = activeSessionKeys.some(key => t.dedupeKey.includes(key));
                        if (!hasActiveSchedule) {
                            return false; // Obsolete session warning removed
                        }
                    }
                }
                return true;
            });
        }

        // 3. Teacher Attendance Warnings (Phase 13C-4 Core Staff Warning Engine)
        if (typeof this.getTeachers === 'function' && typeof this.getTeacherShifts === 'function' && typeof this.getTeacherAttendanceLogs === 'function') {
            const teachers = this.getTeachers() || [];
            const shifts = this.getTeacherShifts() || [];
            const attendanceLogs = this.getTeacherAttendanceLogs() || [];

            // Warning policy settings for teachers
            const settings = this.db.settings || {};
            const getSettingValue = (key, legacyGetter, defaultValue) => {
                if (settings[key] !== undefined) {
                    const val = settings[key];
                    if (typeof val === 'boolean') return val;
                    const num = Number(val);
                    if (!isNaN(num) && num >= 0 && num <= 90) return num;
                }
                if (typeof legacyGetter === 'function') {
                    return legacyGetter();
                }
                return defaultValue;
            };

            const teacherLateWarningEnabled = getSettingValue(
                'teacherLateWarningEnabled',
                this.getTeacherLateWarningEnabled ? this.getTeacherLateWarningEnabled.bind(this) : null,
                true
            );
            const teacherLateGraceMinutes = getSettingValue(
                'teacherLateGraceMinutes',
                this.getTeacherLateWarningGraceMinutes ? this.getTeacherLateWarningGraceMinutes.bind(this) : null,
                5
            );
            const teacherNoShowWarningEnabled = getSettingValue(
                'teacherNoShowWarningEnabled',
                this.getTeacherNoShowWarningEnabled ? this.getTeacherNoShowWarningEnabled.bind(this) : null,
                true
            );
            const teacherNoShowGraceMinutes = getSettingValue(
                'teacherNoShowGraceMinutes',
                this.getTeacherNoShowWarningGraceMinutes ? this.getTeacherNoShowWarningGraceMinutes.bind(this) : null,
                10
            );
            const teacherCheckoutMissingWarningEnabled = getSettingValue(
                'teacherCheckoutMissingWarningEnabled',
                this.getTeacherCheckoutMissingWarningEnabled ? this.getTeacherCheckoutMissingWarningEnabled.bind(this) : null,
                true
            );
            const teacherCheckoutMissingGraceMinutes = getSettingValue(
                'teacherCheckoutMissingGraceMinutes',
                this.getTeacherCheckoutMissingGraceMinutes ? this.getTeacherCheckoutMissingGraceMinutes.bind(this) : null,
                10
            );

            const activeStaffKeys = [];

            teachers.forEach(t => {
                const shiftToday = shifts.find(s => s.teacherId === t.id && s.date === dateStr);
                const logsToday = attendanceLogs.filter(log => log.teacherId === t.id && log.date === dateStr);
                const log = logsToday[0];

                const hasShiftToday = shiftToday && Array.isArray(shiftToday.slots) && shiftToday.slots.length > 0;
                const hasLogToday = !!log;

                // 퇴사 강사 필터링: 퇴사 강사인데 shift 설정도 없고 근태 로그도 없으면 제외
                if (t.employmentStatus === 'resigned' && !hasShiftToday && !hasLogToday) {
                    return;
                }

                // 당일 출근시간관리 설정(slots)이 없는 경우:
                // 당일에는 퇴근누락, 지각, 미출근 워닝을 모두 생성하지 않습니다.
                if (!hasShiftToday) {
                    return;
                }

                const staffKey = `${t.id}_${dateStr}`;
                activeStaffKeys.push(staffKey);

                // slots 파싱
                const sortedSlots = [...shiftToday.slots].sort();
                const startTimeStr = sortedSlots[0];
                const [sh, smin] = startTimeStr.split(':').map(Number);
                const scheduledStartAt = new Date(y, m, d, sh, smin, 0, 0);

                // lastEndTime 구하기 (가장 마지막 슬롯 시작 시간 + slotMinutes)
                const lastTimeStr = sortedSlots[sortedSlots.length - 1];
                const [eh, emin] = lastTimeStr.split(':').map(Number);
                const lastSlotStartAt = new Date(y, m, d, eh, emin, 0, 0);
                const slotMinutes = (this.db.settings && this.db.settings.scheduleSlotMinutes) || 30;
                const scheduledEndAt = new Date(lastSlotStartAt.getTime() + slotMinutes * 60 * 1000);

                // 출근 체크 분석
                const hasCheckedIn = log && !!log.checkInAt;
                const hasCheckedOut = log && !!log.checkOutAt;

                let actualCheckInAt = null;
                if (hasCheckedIn) {
                    actualCheckInAt = new Date(log.checkInAt);
                }

                let currentWarningState = 'NONE';
                let isLate = false;
                let isNoShow = false;
                let isCheckoutMissing = false;

                // 1) 출근 체크가 없는 경우
                if (!hasCheckedIn) {
                    const noShowLimit = new Date(scheduledStartAt.getTime() + teacherNoShowGraceMinutes * 60 * 1000);
                    const lateLimit = new Date(scheduledStartAt.getTime() + teacherLateGraceMinutes * 60 * 1000);

                    // 미출근 판단
                    if (teacherNoShowWarningEnabled && parsedNow.getTime() > noShowLimit.getTime()) {
                        isNoShow = true;
                    } 
                    // 지각 판단 (미출근 이전)
                    else if (teacherLateWarningEnabled && parsedNow.getTime() > lateLimit.getTime()) {
                        isLate = true;
                    }
                } 
                // 2) 출근 체크가 있는 경우
                else {
                    // 지각 판단
                    if (teacherLateWarningEnabled && actualCheckInAt) {
                        const lateLimit = new Date(scheduledStartAt.getTime() + teacherLateGraceMinutes * 60 * 1000);
                        if (actualCheckInAt.getTime() > lateLimit.getTime()) {
                            isLate = true;
                        }
                    }

                    // 퇴근누락 판단
                    if (teacherCheckoutMissingWarningEnabled && !hasCheckedOut) {
                        const checkoutLimit = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000);
                        if (parsedNow.getTime() > checkoutLimit.getTime()) {
                            isCheckoutMissing = true;
                        }
                    }
                }

                // 상태 결합
                if (isNoShow) {
                    currentWarningState = 'ABSENT';
                } else if (isLate && isCheckoutMissing) {
                    currentWarningState = 'LATE_CHECKOUT_MISSING';
                } else if (isLate) {
                    currentWarningState = 'LATE';
                } else if (isCheckoutMissing) {
                    currentWarningState = 'CHECKOUT_MISSING';
                }

                // dedupe keys & user resolution check
                const warningKeys = [
                    `SYSTEM_RECOMMEND_STAFF_ABSENT_${staffKey}`,
                    `SYSTEM_RECOMMEND_STAFF_LATE_${staffKey}`,
                    `SYSTEM_RECOMMEND_STAFF_CHECKOUT_MISSING_${staffKey}`,
                    `SYSTEM_RECOMMEND_STAFF_LATE_CHECKOUT_MISSING_${staffKey}`
                ];
                const targetDedupeKey = currentWarningState !== 'NONE' ? `SYSTEM_RECOMMEND_STAFF_${currentWarningState}_${staffKey}` : null;

                const hasResolvedWarning = targetDedupeKey && this.db.todayTasks.some(t => 
                    t.source === 'system' && 
                    (t.status === 'done' || t.status === 'dismissed') && 
                    t.dedupeKey === targetDedupeKey
                );

                console.log('EVAL STAFF:', t.id, 'State:', currentWarningState, 'Resolved:', hasResolvedWarning);

                // Clear obsolete warnings that are no longer matching the current state
                this.db.todayTasks = this.db.todayTasks.filter(t => {
                    if (t.source === 'system' && t.status === 'open' && t.dedupeKey && warningKeys.includes(t.dedupeKey)) {
                        return t.dedupeKey === targetDedupeKey;
                    }
                    return true;
                });

                // Add new warning if applicable
                if (currentWarningState !== 'NONE' && !hasResolvedWarning) {
                    const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === targetDedupeKey && t.status === 'open');
                    console.log('isAlreadyOpen:', isAlreadyOpen, 'targetDedupeKey:', targetDedupeKey);
                    if (!isAlreadyOpen) {
                        let title = '';
                        let description = '';
                        let warningTypeLabel = '';
                        let reason = '';
                        let dueAt = scheduledEndAt.toISOString();

                        if (currentWarningState === 'ABSENT') {
                            title = `${t.name} 강사 미출근`;
                            warningTypeLabel = '미출근';
                            reason = '출근 예정시간이 지났지만 출근 기록이 없습니다.';
                            dueAt = new Date(scheduledStartAt.getTime() + teacherNoShowGraceMinutes * 60 * 1000).toISOString();
                        } else if (currentWarningState === 'LATE') {
                            title = `${t.name} 강사 지각`;
                            warningTypeLabel = '지각';
                            reason = '출근 예정시간이 지났지만 정시에 출근 기록이 없습니다.';
                            dueAt = new Date(scheduledStartAt.getTime() + teacherLateGraceMinutes * 60 * 1000).toISOString();
                        } else if (currentWarningState === 'CHECKOUT_MISSING') {
                            title = `${t.name} 강사 퇴근누락`;
                            warningTypeLabel = '퇴근누락';
                            reason = '근무 시간이 지났지만 퇴근 기록이 없습니다.';
                            dueAt = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000).toISOString();
                        } else if (currentWarningState === 'LATE_CHECKOUT_MISSING') {
                            title = `${t.name} 강사 지각 및 퇴근누락`;
                            warningTypeLabel = '지각 + 퇴근누락';
                            reason = '지각 출근 후 퇴근 기록이 없습니다.';
                            dueAt = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000).toISOString();
                        }

                        const pad = (n) => String(n).padStart(2, '0');
                        const startHM = startTimeStr;
                        const endHM = `${pad(scheduledEndAt.getHours())}:${pad(scheduledEndAt.getMinutes())}`;
                        const actualCheckInStr = actualCheckInAt ? `${pad(actualCheckInAt.getHours())}:${pad(actualCheckInAt.getMinutes())}` : '기록 없음';
                        const actualCheckOutStr = hasCheckedOut ? '기록 있음' : '기록 없음';

                        description = `• 강사명: ${t.name}\n• 예정 출근시간: ${startHM}\n• 마지막 근무 종료시간: ${endHM}\n• 실제 출퇴근 기록: 출근(${actualCheckInStr}) / 퇴근(${actualCheckOutStr})\n• 워닝 유형: ${warningTypeLabel}\n• 간단 사유: ${reason}`;

                        this.addTodayTask({
                            organizationId: t.academyId || '',
                            segment: 'academy_director_console',
                            domain: 'academy',
                            source: 'system',
                            type: 'attendance',
                            category: 'staff_warning',
                            priority: 'today',
                            status: 'open',
                            dueAt: dueAt,
                            startAt: scheduledStartAt.toISOString(),
                            endAt: scheduledEndAt.toISOString(),
                            title: title,
                            description: description,
                            relatedTeacherIds: [t.id],
                            dedupeKey: targetDedupeKey,
                            visibilityRoles: ['director'],
                            actionType: 'NAVIGATE',
                            actionPayload: { route: '/staff-attendance', teacherId: t.id }
                        });
                    }
                }
            });

            // Clean up obsolete staff warnings if schedule cancelled
            this.db.todayTasks = this.db.todayTasks.filter(t => {
                if (t.source === 'system' && t.status === 'open' && t.dedupeKey) {
                    const isStaffWarning = 
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_ABSENT_') ||
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_LATE_') ||
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_CHECKOUT_MISSING_') ||
                        t.dedupeKey.startsWith('SYSTEM_RECOMMEND_STAFF_LATE_CHECKOUT_MISSING_');
                    if (isStaffWarning) {
                        const parts = t.dedupeKey.split('_');
                        const dateToken = parts[parts.length - 1];
                        const teacherIdToken = parts[parts.length - 2];
                        const keyToFind = `${teacherIdToken}_${dateToken}`;
                        const hasActiveStaff = activeStaffKeys.includes(keyToFind);
                        if (!hasActiveStaff) {
                            return false;
                        }
                    }
                }
                return true;
            });
        }

        // 4. Auto-Resolve Conditions (for Unpaid billing)
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
                }
            }
        });

        return this.getTodayTasks();
    }
};
