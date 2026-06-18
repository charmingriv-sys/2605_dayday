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
    syncSystemRecommendations(now = new Date(), silent = false) {
        let parsedNow = now instanceof Date ? now : new Date(now);
        if (this.db && this.db.settings && this.db.settings.DAYDAY_DEBUG_EVAL_TIME) {
            parsedNow = new Date(this.db.settings.DAYDAY_DEBUG_EVAL_TIME);
        }
        const y = parsedNow.getFullYear();
        const m = parsedNow.getMonth();
        const d = parsedNow.getDate();
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

        // Ensure database lists are initialized
        if (!this.db.todayTasks) this.db.todayTasks = [];

        // 1. Billing & Overdue Warning Engine (Phase 13D)
        const activeBillingKeys = [];
        runTodayTaskRecommendationDomain(this, 'billing', () => {
            if (typeof this.getStudents === 'function' && typeof this.getPayments === 'function') {
                const students = this.getStudents();
                const payments = this.getPayments();

                payments.forEach(payment => {
                    // 이번 Phase 13D에서는 교육비(education)만 처리, 교재비는 제외
                    if (payment.type !== 'education') return;

                    // 이미 결제 완료된 건은 경고 생성 안 함
                    if (payment.status === 'paid') return;

                    const student = students.find(s => s.id === payment.studentId);
                    if (!student) return;

                    const dueDay = student.dueDay || 10;
                    
                    // 납부 예정일 계산 (Clamping dueDay to max day of payment's month to avoid Date roll-overs)
                    const [py, pm] = payment.month.split('-').map(Number);
                    const lastDayOfMonth = new Date(py, pm, 0).getDate();
                    const safeDueDay = Math.min(dueDay, lastDayOfMonth);
                    
                    const paymentDueAt = new Date(py, pm - 1, safeDueDay, 0, 0, 0, 0);
                    const todayMidnight = new Date(y, m, d, 0, 0, 0, 0);

                    let isDueToday = false;
                    let isOverdue = false;

                    if (paymentDueAt.getTime() === todayMidnight.getTime()) {
                        isDueToday = true;
                    } else if (paymentDueAt.getTime() < todayMidnight.getTime()) {
                        isOverdue = true;
                    }

                    if (isDueToday) {
                        const dedupeKey = `SYSTEM_RECOMMEND_BILLING_DUE_${payment.id}_${payment.month}`;
                        activeBillingKeys.push(dedupeKey);

                        // 수동 완료/삭제 여부 검사
                        const hasResolved = this.db.todayTasks.some(t =>
                            t.source === 'system' &&
                            (t.status === 'done' || t.status === 'dismissed') &&
                            t.dedupeKey === dedupeKey
                        );

                        if (!hasResolved) {
                            const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                            if (!isAlreadyOpen) {
                                const dueTime = new Date(py, pm - 1, safeDueDay, 9, 0, 0, 0);
                                const endTime = new Date(py, pm - 1, safeDueDay, 10, 0, 0, 0);
                                addValidatedSystemTodayTask(this, {
                                    organizationId: student.academyId || '',
                                    segment: 'academy_director_console',
                                    domain: 'academy',
                                    source: 'system',
                                    type: 'billing',
                                    category: 'billing',
                                    priority: 'today',
                                    status: 'open',
                                    dueAt: dueTime.toISOString(),
                                    startAt: dueTime.toISOString(),
                                    endAt: endTime.toISOString(),
                                    title: `[수납확인] ${student.name} 원생 ${py}년 ${pm}월 수강료`,
                                    description: `${student.name} 원생의 ${py}년 ${pm}월 수강료 ${payment.amount.toLocaleString()}원 정기 수납일입니다. 수납 안내 또는 결제 확인이 필요합니다.`,
                                    relatedStudentIds: [student.id],
                                    dedupeKey: dedupeKey,
                                    visibilityRoles: ['director'],
                                    actionType: 'NAVIGATE',
                                    actionPayload: { route: '/billing', studentId: student.id }
                                }, { domain: 'billing', silent });
                            }
                        }
                    } else if (isOverdue) {
                        const dedupeKey = `SYSTEM_RECOMMEND_BILLING_UNPAID_${payment.id}_${payment.month}`;
                        activeBillingKeys.push(dedupeKey);

                        // Trigger tuition_overdue parent message if not already created
                        const msgDedupeKey = `TUITION_OVERDUE_${payment.id}`;
                        const msgExists = this.db.parentMessages && this.db.parentMessages.some(m => m.dedupeKey === msgDedupeKey);
                        if (!msgExists && typeof this.triggerPaymentParentMessage === 'function') {
                            this.triggerPaymentParentMessage(payment.id, 'tuition_overdue');
                        }

                        // 수동 완료/삭제 여부 검사
                        const hasResolved = this.db.todayTasks.some(t =>
                            t.source === 'system' &&
                            (t.status === 'done' || t.status === 'dismissed') &&
                            t.dedupeKey === dedupeKey
                        );

                        if (!hasResolved) {
                            const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                            if (!isAlreadyOpen) {
                                const dueTime = new Date(py, pm - 1, safeDueDay, 9, 0, 0, 0);
                                const endTime = new Date(py, pm - 1, safeDueDay, 10, 0, 0, 0);
                                const formattedDueDate = `${py}-${String(pm).padStart(2, '0')}-${String(safeDueDay).padStart(2, '0')}`;
                                addValidatedSystemTodayTask(this, {
                                    organizationId: student.academyId || '',
                                    segment: 'academy_director_console',
                                    domain: 'academy',
                                    source: 'system',
                                    type: 'billing',
                                    category: 'overdue',
                                    priority: 'today',
                                    status: 'open',
                                    dueAt: dueTime.toISOString(),
                                    startAt: dueTime.toISOString(),
                                    endAt: endTime.toISOString(),
                                    title: `[미수납 확인] ${student.name} 원생 ${py}년 ${pm}월 수강료`,
                                    description: `${student.name} 원생의 ${py}년 ${pm}월 수강료 ${payment.amount.toLocaleString()}원이 납부 예정일(${formattedDueDate})을 지났지만 아직 미수납 상태입니다. 수납 상태 확인 또는 학부모 안내가 필요합니다.`,
                                    relatedStudentIds: [student.id],
                                    dedupeKey: dedupeKey,
                                    visibilityRoles: ['director'],
                                    actionType: 'NAVIGATE',
                                    actionPayload: { route: '/billing', studentId: student.id }
                                }, { domain: 'billing', silent });
                            }
                        }
                    }
                });

                // 1.2 Mute / remove obsolete billing recommendations (automatic invalidation on paid or transition)
                const getPaymentIdFromDedupeKey = (key) => {
                    if (!key) return null;
                    if (key.startsWith('SYSTEM_RECOMMEND_BILLING_DUE_')) {
                        const rest = key.substring('SYSTEM_RECOMMEND_BILLING_DUE_'.length);
                        const idx = rest.lastIndexOf('_');
                        return idx !== -1 ? rest.substring(0, idx) : rest;
                    }
                    if (key.startsWith('SYSTEM_RECOMMEND_BILLING_UNPAID_')) {
                        const rest = key.substring('SYSTEM_RECOMMEND_BILLING_UNPAID_'.length);
                        const idx = rest.lastIndexOf('_');
                        return idx !== -1 ? rest.substring(0, idx) : rest;
                    }
                    return null;
                };

                // First, resolve (mark 'done') if payment status becomes 'paid'
                this.db.todayTasks = this.db.todayTasks.map(t => {
                    if (t.source === 'system' && t.status === 'open' && t.type === 'billing') {
                        const paymentId = getPaymentIdFromDedupeKey(t.dedupeKey);
                        if (paymentId) {
                            const payment = payments.find(p => p.id === paymentId);
                            if (payment && payment.status === 'paid') {
                                return {
                                    ...t,
                                    status: 'done',
                                    completedAt: parsedNow.toISOString(),
                                    updatedAt: parsedNow.toISOString()
                                };
                            }
                        }
                    }
                    return t;
                });

                // Second, remove obsolete recommendations (e.g. state transition from billing to overdue)
                this.db.todayTasks = this.db.todayTasks.filter(t => {
                    if (t.source === 'system' && t.status === 'open' && t.type === 'billing') {
                        // Category must be billing or overdue
                        if (t.category === 'billing' || t.category === 'overdue' || t.category === 'system_check') {
                            return activeBillingKeys.includes(t.dedupeKey);
                        }
                    }
                    return true;
                });
            }
        }, { silent });

        // 1.5 Textbook Warning Engine (Phase 13E-1)
        const activeBookKeys = [];
        runTodayTaskRecommendationDomain(this, 'book', () => {
            if (this.db.bookIssueRequests) {
                const students = typeof this.getStudents === 'function' ? this.getStudents() : (this.db.students || []);
                const teachers = typeof this.getTeachers === 'function' ? this.getTeachers() : (this.db.teachers || []);
                const books = typeof this.getBooks === 'function' ? this.getBooks() : (this.db.books || []);
                const payments = typeof this.getPayments === 'function' ? this.getPayments() : (this.db.payments || []);
                const bookIssueRequests = this.db.bookIssueRequests || [];

                // A. 교재 지급 확인 (book_check) - status: 'requested'인 BIR
                bookIssueRequests.forEach(request => {
                    if (request.status !== 'requested') return;

                    const student = students.find(s => s.id === request.studentId);
                    if (!student) return;

                    const book = books.find(b => b.id === request.bookId);
                    const bookName = book ? book.name : request.bookNameSnapshot;

                    const teacher = teachers.find(t => t.id === request.teacherId);
                    const teacherName = teacher ? teacher.name : (request.teacherId === null ? '원장 직접 등록' : '강사');

                    const dedupeKey = `SYSTEM_RECOMMEND_BOOK_CHECK_${request.id}`;
                    activeBookKeys.push(dedupeKey);

                    const hasResolved = this.db.todayTasks.some(t =>
                        t.source === 'system' &&
                        (t.status === 'done' || t.status === 'dismissed') &&
                        t.dedupeKey === dedupeKey
                    );

                    if (!hasResolved) {
                        const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                        if (!isAlreadyOpen) {
                            const nowIso = parsedNow.toISOString();
                            addValidatedSystemTodayTask(this, {
                                organizationId: student.academyId || '',
                                segment: 'academy_director_console',
                                domain: 'academy',
                                source: 'system',
                                type: 'book',
                                category: 'book_check',
                                priority: 'today',
                                status: 'open',
                                dueAt: nowIso,
                                startAt: nowIso,
                                endAt: nowIso,
                                title: `[교재 지급 확인] ${student.name} 원생 ${bookName}`,
                                description: `${teacherName}가 ${student.name} 원생에게 ${bookName} 교재 지급 승인을 요청했습니다.${request.memo ? ` (메모: ${request.memo})` : ''}`,
                                relatedStudentIds: [student.id],
                                dedupeKey: dedupeKey,
                                visibilityRoles: ['director'],
                                actionType: 'NAVIGATE',
                                actionPayload: { route: '/catalog', studentId: student.id }
                            }, { domain: 'book', silent });
                        }
                    }
                });

                // B. 교재 결제 확인 (book_billing) - payment.type === 'book' && payment.status !== 'paid'
                payments.forEach(payment => {
                    if (payment.type !== 'book') return;
                    if (payment.status === 'paid') return;

                    const student = students.find(s => s.id === payment.studentId);
                    if (!student) return;

                    const book = books.find(b => b.id === payment.bookId);
                    const bookName = book ? book.name : '교재';

                    // Calculate due date and check if it is overdue
                    const [py, pm] = payment.month.split('-').map(Number);
                    const safeDueDay = Math.min(student.dueDay || 14, new Date(py, pm, 0).getDate());
                    let paymentDueAt = new Date(py, pm - 1, safeDueDay, 0, 0, 0, 0);

                    const invoiceDateStr = payment.invoiceDate || payment.createdAt || new Date().toISOString().slice(0, 10);
                    const [iy, im, id] = invoiceDateStr.split('-').map(Number);
                    const invoiceDateAt = new Date(iy, im - 1, id, 0, 0, 0, 0);

                    if (invoiceDateAt.getTime() >= paymentDueAt.getTime()) {
                        // 교재 지급 확인 승인 직후 바로 미수납 안내가 생성되지 않도록 납부 예정일을 다음 달로 이월(Rollover)합니다.
                        let nextYear = py;
                        let nextMonth = pm + 1;
                        if (nextMonth > 12) {
                            nextMonth = 1;
                            nextYear += 1;
                        }
                        const nextSafeDueDay = Math.min(student.dueDay || 14, new Date(nextYear, nextMonth, 0).getDate());
                        paymentDueAt = new Date(nextYear, nextMonth - 1, nextSafeDueDay, 0, 0, 0, 0);
                    }

                    const todayMidnight = new Date(y, m, d, 0, 0, 0, 0);
                    const isOverdue = paymentDueAt.getTime() < todayMidnight.getTime();

                    if (isOverdue) {
                        const msgDedupeKey = `BOOK_OVERDUE_${payment.id}`;
                        const msgExists = this.db.parentMessages && this.db.parentMessages.some(m => m.dedupeKey === msgDedupeKey);
                        if (!msgExists && typeof this.triggerPaymentParentMessage === 'function') {
                            this.triggerPaymentParentMessage(payment.id, 'book_overdue');
                        }
                    }

                    // 요청 출처 역추적
                    const matchingReq = bookIssueRequests.find(r => 
                        r.studentId === payment.studentId && 
                        r.bookId === payment.bookId && 
                        (r.status === 'confirmed' || r.status === 'paid')
                    );
                    
                    let sourceLabel = '직접 등록';
                    if (matchingReq && matchingReq.teacherId !== null) {
                        const reqTeacher = teachers.find(t => t.id === matchingReq.teacherId);
                        const teacherName = reqTeacher ? reqTeacher.name : '강사';
                        sourceLabel = `${teacherName} 선생님 요청`;
                    }

                    const dedupeKey = `SYSTEM_RECOMMEND_BOOK_BILLING_${payment.id}`;
                    activeBookKeys.push(dedupeKey);

                    const hasResolved = this.db.todayTasks.some(t =>
                        t.source === 'system' &&
                        (t.status === 'done' || t.status === 'dismissed') &&
                        t.dedupeKey === dedupeKey
                    );

                    if (!hasResolved) {
                        const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                        if (!isAlreadyOpen) {
                            const nowIso = parsedNow.toISOString();
                            addValidatedSystemTodayTask(this, {
                                organizationId: student.academyId || '',
                                segment: 'academy_director_console',
                                domain: 'academy',
                                source: 'system',
                                type: 'book',
                                category: 'book_billing',
                                priority: 'today',
                                status: 'open',
                                dueAt: nowIso,
                                startAt: nowIso,
                                endAt: nowIso,
                                title: `[교재 결제 확인] ${student.name} 원생 ${bookName} / ${sourceLabel}`,
                                description: `학부모 안내 및 수납 확인이 필요합니다.`,
                                relatedStudentIds: [student.id],
                                dedupeKey: dedupeKey,
                                visibilityRoles: ['director'],
                                actionType: 'NAVIGATE',
                                actionPayload: { route: '/billing', studentId: student.id }
                            }, { domain: 'book', silent });
                        }
                    }
                });

                // C. 교재 추천 (book_recommendation) - 출석 횟수가 권장일수의 90% 이상인 경우
                const studentBooks = typeof this.getStudentBooks === 'function' ? this.getStudentBooks() : (this.db.studentBooks || []);
                const attendance = typeof this.getAttendance === 'function' ? this.getAttendance() : (this.db.attendance || []);

                students.forEach(student => {
                    const sBooks = studentBooks.filter(sb => sb.studentId === student.id);
                    if (sBooks.length === 0) return;

                    // Sort to find the latest one (latest by regDate descending, then orderNo descending if regDate is equal)
                    sBooks.sort((a, b) => {
                        const cmp = (b.regDate || '').localeCompare(a.regDate || '');
                        if (cmp !== 0) return cmp;
                        return (b.orderNo || 0) - (a.orderNo || 0);
                    });
                    const latestSB = sBooks[0];
                    const book = books.find(b => b.id === latestSB.bookId);
                    if (!book) return;

                    const recommendedDays = parseInt(book.recommendedDays) || 90;
                    
                    // Count attendance on or after regDate
                    const attendedCount = attendance.filter(a => {
                        return a.studentId === student.id && a.date >= latestSB.regDate && (a.status === 'present' || a.status === 'late');
                    }).length;

                    const ratio = recommendedDays > 0 ? (attendedCount / recommendedDays) : 0;
                    
                    if (ratio >= 0.9) {
                        const dedupeKey = `SYSTEM_RECOMMEND_BOOK_RECOMMENDATION_${student.id}_${latestSB.bookId}_${latestSB.regDate}`;
                        activeBookKeys.push(dedupeKey);

                        // Check if manually completed / dismissed / snoozed
                        const hasResolved = this.db.todayTasks.some(t =>
                            t.source === 'system' &&
                            (t.status === 'done' || t.status === 'dismissed' || (t.status === 'snoozed' && new Date(t.snoozedUntil).getTime() > parsedNow.getTime())) &&
                            t.dedupeKey === dedupeKey
                        );

                        if (!hasResolved) {
                            const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                            if (!isAlreadyOpen) {
                                const nowIso = parsedNow.toISOString();
                                addValidatedSystemTodayTask(this, {
                                    organizationId: student.academyId || '',
                                    segment: 'academy_director_console',
                                    domain: 'academy',
                                    source: 'system',
                                    type: 'book',
                                    category: 'book_recommendation',
                                    priority: 'today',
                                    status: 'open',
                                    dueAt: nowIso,
                                    startAt: nowIso,
                                    endAt: nowIso,
                                    title: `[교재 확인] ${student.name} 원생 (${book.name})`,
                                    description: `${student.name} 원생이 ${book.name} 교재를 등록한 후 ${attendedCount}회 출석했습니다. 권장 학습일수(${recommendedDays}회)의 90% 이상이 경과하여 교체/추천이 필요합니다.`,
                                    relatedStudentIds: [student.id],
                                    dedupeKey: dedupeKey,
                                    visibilityRoles: ['director'],
                                    actionType: 'NAVIGATE',
                                    actionPayload: { route: '/catalog', studentId: student.id }
                                }, { domain: 'book', silent });
                            }
                        }
                    }
                });

                // D. Mute / remove obsolete textbook recommendations
                // Resolve to 'done' if the status changed (e.g. payment status becomes 'paid', which syncs BIR status to 'paid')
                this.db.todayTasks = this.db.todayTasks.map(t => {
                    if (t.source === 'system' && t.status === 'open' && t.type === 'book') {
                        if (t.category === 'book_check') {
                            const reqId = t.dedupeKey.replace('SYSTEM_RECOMMEND_BOOK_CHECK_', '');
                            const req = bookIssueRequests.find(r => r.id === reqId);
                            if (req && req.status !== 'requested') {
                                return {
                                    ...t,
                                    status: 'done',
                                    completedAt: parsedNow.toISOString(),
                                    updatedAt: parsedNow.toISOString()
                                };
                            }
                        } else if (t.category === 'book_billing') {
                            const payId = t.dedupeKey.replace('SYSTEM_RECOMMEND_BOOK_BILLING_', '');
                            const payment = payments.find(p => p.id === payId);
                            if (payment && payment.status === 'paid') {
                                return {
                                    ...t,
                                    status: 'done',
                                    completedAt: parsedNow.toISOString(),
                                    updatedAt: parsedNow.toISOString()
                                };
                            }
                        } else if (t.category === 'book_recommendation') {
                            const parts = t.dedupeKey.replace('SYSTEM_RECOMMEND_BOOK_RECOMMENDATION_', '').split('_');
                            const studentId = parts[0];
                            const bookId = parts[1];
                            const regDate = parts[2];

                            const sBooks = studentBooks.filter(sb => sb.studentId === studentId);
                            const hasNewerSB = sBooks.some(sb => {
                                const dateCmp = (sb.regDate || '').localeCompare(regDate || '');
                                if (dateCmp > 0) return true;
                                if (dateCmp === 0 && (sb.orderNo || 0) > (sBooks.find(item => item.bookId === bookId && item.regDate === regDate)?.orderNo || 0)) {
                                    return true;
                                }
                                return false;
                            });

                            if (hasNewerSB) {
                                return {
                                    ...t,
                                    status: 'done',
                                    completedAt: parsedNow.toISOString(),
                                    updatedAt: parsedNow.toISOString()
                                };
                            }
                        }
                    }
                    return t;
                });

                // Filter out any open recommendations that are no longer active
                this.db.todayTasks = this.db.todayTasks.filter(t => {
                    if (t.source === 'system' && t.status === 'open' && t.type === 'book') {
                        if (t.category === 'book_check' || t.category === 'book_billing' || t.category === 'book_recommendation') {
                            return activeBookKeys.includes(t.dedupeKey);
                        }
                    }
                    return true;
                });
            }
        }, { silent });

        // 2. Student Attendance Warnings (Phase 13C Core Warning Engine)
        runTodayTaskRecommendationDomain(this, 'studentAttendance', () => {
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
                                title = `[결석 확인] ${studentName} 원생 결석 확인`;
                                warningTypeLabel = '결석 확인';
                                reason = '수업이 끝났지만 출석 기록이 없습니다.';
                                dueAt = scheduledEndAt.toISOString();
                            } else if (currentWarningState === 'LATE') {
                                title = `[특이출결] ${studentName} 원생 지각`;
                                warningTypeLabel = '지각';
                                reason = '수업 시작 후 출석했습니다.';
                                dueAt = new Date(scheduledStartAt.getTime() + lateThresholdMinutes * 60 * 1000).toISOString();
                            } else if (currentWarningState === 'CHECKOUT_MISSING') {
                                title = `[특이출결] ${studentName} 원생 하원 누락`;
                                warningTypeLabel = '하원 누락';
                                reason = '수업 시간이 종료되었지만 하원 기록이 없습니다.';
                                dueAt = checkoutLimit ? checkoutLimit.toISOString() : scheduledEndAt.toISOString();
                            } else if (currentWarningState === 'LATE_CHECKOUT_MISSING') {
                                title = `[특이출결] ${studentName} 원생 지각 및 하원 누락`;
                                warningTypeLabel = '지각 + 하원 누락';
                                reason = '지각 출석 후 수업 시간이 종료되었지만 하원 기록이 없습니다.';
                                dueAt = checkoutLimit ? checkoutLimit.toISOString() : scheduledEndAt.toISOString();
                            }

                            const startHM = entry.time;
                            const pad = (n) => String(n).padStart(2, '0');
                            const endHM = entry.endTime || `${pad(scheduledEndAt.getHours())}:${pad(scheduledEndAt.getMinutes())}`;
                            const teacher = entry.teacherId ? (typeof this.getTeacher === 'function' ? this.getTeacher(entry.teacherId) : null) : null;
                            const teacherName = teacher ? teacher.name : '미지정';
                            const instrument = student ? (student.instrument || '미지정') : '미지정';

                            description = `• 원생명: ${studentName}\n• 수업 시간: ${startHM} ~ ${endHM}\n• 담당 강사: ${teacherName}\n• 과목/악기: ${instrument}\n• 워닝 유형: ${warningTypeLabel}\n• 간단 사유: ${reason}`;

                            addValidatedSystemTodayTask(this, {
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
                            }, { domain: 'studentAttendance', silent });
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
        }, { silent });

        // 3. Teacher Attendance Warnings (Phase 13C-4 Core Staff Warning Engine)
        runTodayTaskRecommendationDomain(this, 'staffAttendance', () => {
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
                                title = `[특이근태] ${t.name} 강사 미출근`;
                                warningTypeLabel = '미출근';
                                reason = '출근 예정시간이 지났지만 출근 기록이 없습니다.';
                                dueAt = new Date(scheduledStartAt.getTime() + teacherNoShowGraceMinutes * 60 * 1000).toISOString();
                            } else if (currentWarningState === 'LATE') {
                                title = `[특이근태] ${t.name} 강사 지각`;
                                warningTypeLabel = '지각';
                                reason = '출근 예정시간보다 늦게 출근했습니다.';
                                dueAt = new Date(scheduledStartAt.getTime() + teacherLateGraceMinutes * 60 * 1000).toISOString();
                            } else if (currentWarningState === 'CHECKOUT_MISSING') {
                                title = `[특이근태] ${t.name} 강사 퇴근 누락`;
                                warningTypeLabel = '퇴근 누락';
                                reason = '근무 시간이 종료되었지만 퇴근 기록이 없습니다.';
                                dueAt = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000).toISOString();
                            } else if (currentWarningState === 'LATE_CHECKOUT_MISSING') {
                                title = `[특이근태] ${t.name} 강사 지각 및 퇴근 누락`;
                                warningTypeLabel = '지각 + 퇴근 누락';
                                reason = '늦게 출근했고, 근무 시간이 종료되었지만 퇴근 기록이 없습니다.';
                                dueAt = new Date(scheduledEndAt.getTime() + teacherCheckoutMissingGraceMinutes * 60 * 1000).toISOString();
                            }

                            const pad = (n) => String(n).padStart(2, '0');
                            const startHM = startTimeStr;
                            const endHM = `${pad(scheduledEndAt.getHours())}:${pad(scheduledEndAt.getMinutes())}`;
                            const actualCheckInStr = actualCheckInAt ? `${pad(actualCheckInAt.getHours())}:${pad(actualCheckInAt.getMinutes())}` : '기록 없음';
                            const actualCheckOutStr = hasCheckedOut ? '기록 있음' : '기록 없음';

                            description = `• 강사명: ${t.name}\n• 예정 출근시간: ${startHM}\n• 마지막 근무 종료시간: ${endHM}\n• 실제 출퇴근 기록: 출근(${actualCheckInStr}) / 퇴근(${actualCheckOutStr})\n• 워닝 유형: ${warningTypeLabel}\n• 간단 사유: ${reason}`;

                            addValidatedSystemTodayTask(this, {
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
                            }, { domain: 'staffAttendance', silent });
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
        }, { silent });

        // 4. Major Schedule Warning Engine (Phase 13F-Repair-A)
        const activeScheduleKeys = [];
        runTodayTaskRecommendationDomain(this, 'schedule', () => {
            if (this.db.majorSchedules) {
                const majorSchedules = this.db.majorSchedules || [];
                const students = typeof this.getStudents === 'function' ? this.getStudents() : (this.db.students || []);
                const todayMidnight = new Date(y, m, d, 0, 0, 0, 0);

                const getDiffDays = (dateStr) => {
                    if (!dateStr) return null;
                    const [ey, em, ed] = dateStr.split('-').map(Number);
                    const eventMidnight = new Date(ey, em - 1, ed, 0, 0, 0, 0);
                    const diffTime = eventMidnight.getTime() - todayMidnight.getTime();
                    return Math.round(diffTime / (24 * 60 * 60 * 1000));
                };

                majorSchedules.forEach(event => {
                    // 관련 원생 실명 매핑
                    const participantNames = (event.participantStudentIds || [])
                        .map(sid => {
                            const s = students.find(student => student.id === sid);
                            return s ? s.name : null;
                        })
                        .filter(Boolean)
                        .join(', ');

                    const milestones = [];

                    // A. 접수마감 일정 (dueDate)
                    if (event.dueDate) {
                        const diff = getDiffDays(event.dueDate);
                        if (diff !== null && diff >= 0 && diff <= 3) {
                            milestones.push({
                                type: 'registration_deadline',
                                date: event.dueDate,
                                diffDays: diff,
                                label: '접수마감',
                                title: `[일정확인] ${event.name} 접수마감 일정이 ${diff === 0 ? 'D-day' : `D-${diff}`}입니다.`
                            });
                        }
                    }

                    // B. 진행/종료 일정 (eventDate 또는 endDate)
                    const targetEventDate = event.eventDate || event.endDate;
                    if (targetEventDate) {
                        const diff = getDiffDays(targetEventDate);
                        if (diff !== null && diff >= 0 && diff <= 3) {
                            milestones.push({
                                type: 'event_end',
                                date: targetEventDate,
                                diffDays: diff,
                                label: '진행·종료',
                                title: `[일정확인] ${event.name} 진행/종료일정이 ${diff === 0 ? 'D-day' : `D-${diff}`}입니다.`
                            });
                        }
                    }

                    milestones.forEach(ms => {
                        const dLabel = ms.diffDays === 0 ? 'D-day' : `D-${ms.diffDays}`;
                        const dedupeKey = `SYSTEM_RECOMMEND_MAJOR_SCHEDULE_${event.id}_${ms.type}_${ms.date}`;
                        activeScheduleKeys.push(dedupeKey);

                        // 수동 완료/삭제 여부 검사
                        const hasResolved = this.db.todayTasks.some(t =>
                            t.source === 'system' &&
                            (t.status === 'done' || t.status === 'dismissed') &&
                            t.dedupeKey === dedupeKey
                        );

                        if (!hasResolved) {
                            const isAlreadyOpen = this.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                            if (!isAlreadyOpen) {
                                let description = '일정 내용과 준비 사항을 확인해 주세요.';
                                const details = [];
                                details.push(`• 일정명: ${event.name}`);
                                details.push(`• 마일스톤 유형: ${ms.label}`);
                                details.push(`• D-day 표기: ${dLabel}`);
                                details.push(`• 날짜: ${ms.date}`);
                                details.push(`• 장소: ${event.place || '원내'}`);
                                details.push(`• 담당자: ${event.ownerId || '없음'}`);
                                details.push(`• 관련 원생: ${participantNames || '없음'}`);
                                details.push(`• 메모: ${event.memo || '없음'}`);
                                description += `\n` + details.join('\n');

                                // D-3의 9:00 AM 생성 (우선순위 오늘, 임박할수록 앞 순위 배치하기 위해 분 단위 차등 적용)
                                const dueTime = new Date(y, m, d, 9, ms.diffDays, 0, 0);
                                const endTime = new Date(y, m, d, 10, ms.diffDays, 0, 0);

                                addValidatedSystemTodayTask(this, {
                                    organizationId: '',
                                    segment: 'academy_director_console',
                                    domain: 'academy',
                                    source: 'system',
                                    type: 'schedule',
                                    category: 'schedule',
                                    priority: 'today',
                                    status: 'open',
                                    dueAt: dueTime.toISOString(),
                                    startAt: dueTime.toISOString(),
                                    endAt: endTime.toISOString(),
                                    title: ms.title,
                                    description: description,
                                    relatedStudentIds: event.participantStudentIds || [],
                                    dedupeKey: dedupeKey,
                                    visibilityRoles: ['director']
                                }, { domain: 'schedule', silent });
                            }
                        }
                    });
                });

                // 4.2 Mute / remove obsolete schedule recommendations (자동 제거 / 무효화)
                this.db.todayTasks = this.db.todayTasks.filter(t => {
                    if (t.source === 'system' && t.status === 'open' && t.type === 'schedule') {
                        return activeScheduleKeys.includes(t.dedupeKey);
                    }
                    return true;
                });
            }
        }, { silent });

        // 5. Auto-Resolve Conditions (for Unpaid billing)
        runTodayTaskRecommendationDomain(this, 'billing', () => {
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
        }, { silent });

        this.saveDB();
        if (!silent) {
            this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks);
        }
        return this.getTodayTasks();
    },

    // E2E test validation helper only (not used in production flow)
    _testValidateTask(task, meta) {
        const result = addValidatedSystemTodayTask(this, task, meta);
        this.saveDB();
        return result;
    }
};

// --- Modularization Helper Functions for Phase 17G-5A ---

function recordTodayTaskSyncError(ctx, domain, error, meta) {
    if (!ctx.db) return;
    if (!ctx.db.todayTaskSyncErrors) {
        ctx.db.todayTaskSyncErrors = [];
    }
    ctx.db.todayTaskSyncErrors.push({
        domain: domain,
        errorMessage: error.message || String(error),
        timestamp: new Date().toISOString(),
        caller: 'syncSystemRecommendations',
        silent: meta && meta.silent !== undefined ? meta.silent : false,
        details: meta && meta.details ? meta.details : {}
    });
    // Limit to 30 records to prevent infinite growth
    if (ctx.db.todayTaskSyncErrors.length > 30) {
        ctx.db.todayTaskSyncErrors = ctx.db.todayTaskSyncErrors.slice(-30);
    }
}

function runTodayTaskRecommendationDomain(ctx, domain, fn, meta) {
    try {
        fn();
    } catch (err) {
        console.warn(`[todayTaskSyncError] Domain: ${domain}, Error: ${err.message}`);
        recordTodayTaskSyncError(ctx, domain, err, meta);
    }
}

function addValidatedSystemTodayTask(ctx, task, meta) {
    const requiredFields = ['title', 'category', 'type', 'source', 'status', 'dedupeKey'];
    const missingFields = requiredFields.filter(f => !task || task[f] === undefined || task[f] === null || String(task[f]).trim() === '');
    
    if (missingFields.length > 0) {
        const error = new Error(`Validation failed. Missing required fields: ${missingFields.join(', ')}`);
        recordTodayTaskSyncError(ctx, meta && meta.domain ? meta.domain : 'validation', error, {
            details: { taskTitle: task ? task.title : 'unknown', taskDedupeKey: task ? task.dedupeKey : 'unknown' },
            silent: meta && meta.silent
        });
        return null;
    }
    return ctx.addTodayTask(task);
}

