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
    }
};
