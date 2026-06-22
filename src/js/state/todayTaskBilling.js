/**
 * todayTaskBilling.js
 * Extracted billing recommendation sync module for Phase 18A
 */

export function syncBillingRecommendations(ctx, options) {
    const { parsedNow, y, m, d, silent, addValidatedSystemTodayTask } = options;

    if (typeof ctx.getStudents === 'function' && typeof ctx.getPayments === 'function') {
        const students = ctx.getStudents();
        const payments = ctx.getPayments();
        const enrollments = (ctx.db && ctx.db.enrollments) || [];
        const sessionPasses = (ctx.db && ctx.db.sessionPasses) || [];
        const activeBillingKeys = [];
        // 0. Normalize existing withdrawn_unpaid task titles and descriptions to latest guidelines
        if (ctx.db && ctx.db.todayTasks) {
            ctx.db.todayTasks = ctx.db.todayTasks.map(t => {
                if (t.type === 'withdrawn_unpaid') {
                    const studentId = (t.relatedStudentIds && t.relatedStudentIds.length > 0) ? t.relatedStudentIds[0] : null;
                    const student = studentId ? students.find(s => s.id === studentId) : null;
                    const studentName = student ? student.name : '';

                    let updatedTitle = t.title || '';
                    if (updatedTitle.startsWith('[퇴원생 미수] ') || updatedTitle.startsWith('[퇴원생 미수납] ')) {
                        if (!updatedTitle.startsWith('[퇴원생 미수납 확인] ')) {
                            updatedTitle = updatedTitle
                                .replace(/^\[퇴원생 미수납\]/, '[퇴원생 미수납 확인]')
                                .replace(/^\[퇴원생 미수\]/, '[퇴원생 미수납 확인]');
                        }
                    }

                    let updatedDesc = t.description || '';
                    if (studentName) {
                        updatedDesc = `퇴원생 ${studentName} 원생의 미납 수강료가 남아 있습니다.`;
                    }

                    return {
                        ...t,
                        title: updatedTitle,
                        description: updatedDesc
                    };
                }
                return t;
            });
        }

        // 1. Generate/Mute Billing recommendations (Due / Unpaid)
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

            if (student.status === 'withdrawn') {
                if (isDueToday || isOverdue) {
                    const dedupeKey = `SYSTEM_RECOMMEND_WITHDRAWN_UNPAID_${payment.id}_${payment.month}`;
                    activeBillingKeys.push(dedupeKey);

                    // 수동 완료/삭제 여부 검사
                    const hasResolved = ctx.db.todayTasks.some(t =>
                        t.source === 'system' &&
                        (t.status === 'done' || t.status === 'dismissed') &&
                        t.dedupeKey === dedupeKey
                    );

                    if (!hasResolved) {
                        const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                        if (!isAlreadyOpen) {
                            const dueTime = new Date(py, pm - 1, safeDueDay, 9, 0, 0, 0);
                            const endTime = new Date(py, pm - 1, safeDueDay, 10, 0, 0, 0);
                            addValidatedSystemTodayTask(ctx, {
                                organizationId: student.academyId || '',
                                segment: 'academy_director_console',
                                domain: 'academy',
                                source: 'system',
                                type: 'withdrawn_unpaid',
                                category: 'billing',
                                priority: 'today',
                                status: 'open',
                                dueAt: dueTime.toISOString(),
                                startAt: dueTime.toISOString(),
                                endAt: endTime.toISOString(),
                                title: `[퇴원생 미수납 확인] ${student.name} 원생 미수금 확인`,
                                description: `퇴원생 ${student.name} 원생의 미납 수강료가 남아 있습니다.`,
                                relatedStudentIds: [student.id],
                                dedupeKey: dedupeKey,
                                visibilityRoles: ['director'],
                                actionType: 'NAVIGATE',
                                actionPayload: { route: '/billing', studentId: student.id }
                            }, { domain: 'billing', silent });
                        }
                    }
                }
            } else {
                const upcomingTime = paymentDueAt.getTime() - 2 * 24 * 60 * 60 * 1000;
                let isUpcoming = false;
                if (upcomingTime === todayMidnight.getTime()) {
                    isUpcoming = true;
                }

                if (isDueToday) {
                    const dedupeKey = `SYSTEM_RECOMMEND_BILLING_DUE_${payment.id}_${payment.month}`;
                    activeBillingKeys.push(dedupeKey);

                    // 수동 완료/삭제 여부 검사
                    const hasResolved = ctx.db.todayTasks.some(t =>
                        t.source === 'system' &&
                        (t.status === 'done' || t.status === 'dismissed') &&
                        t.dedupeKey === dedupeKey
                    );

                    if (!hasResolved) {
                        const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                        if (!isAlreadyOpen) {
                            const dueTime = new Date(py, pm - 1, safeDueDay, 9, 0, 0, 0);
                            const endTime = new Date(py, pm - 1, safeDueDay, 10, 0, 0, 0);
                            addValidatedSystemTodayTask(ctx, {
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
                    const msgExists = ctx.db.parentMessages && ctx.db.parentMessages.some(m => m.dedupeKey === msgDedupeKey);
                    if (!msgExists && typeof ctx.triggerPaymentParentMessage === 'function') {
                        ctx.triggerPaymentParentMessage(payment.id, 'tuition_overdue');
                    }

                    // 수동 완료/삭제 여부 검사
                    const hasResolved = ctx.db.todayTasks.some(t =>
                        t.source === 'system' &&
                        (t.status === 'done' || t.status === 'dismissed') &&
                        t.dedupeKey === dedupeKey
                    );

                    if (!hasResolved) {
                        const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                        if (!isAlreadyOpen) {
                            const dueTime = new Date(py, pm - 1, safeDueDay, 9, 0, 0, 0);
                            const endTime = new Date(py, pm - 1, safeDueDay, 10, 0, 0, 0);
                            const formattedDueDate = `${py}-${String(pm).padStart(2, '0')}-${String(safeDueDay).padStart(2, '0')}`;
                            addValidatedSystemTodayTask(ctx, {
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
                } else if (isUpcoming) {
                    const dedupeKey = `SYSTEM_RECOMMEND_BILLING_UPCOMING_${payment.id}_${payment.month}`;
                    activeBillingKeys.push(dedupeKey);

                    // 수동 완료/삭제 여부 검사
                    const hasResolved = ctx.db.todayTasks.some(t =>
                        t.source === 'system' &&
                        (t.status === 'done' || t.status === 'dismissed') &&
                        t.dedupeKey === dedupeKey
                    );

                    if (!hasResolved) {
                        const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                        if (!isAlreadyOpen) {
                            const dueTime = new Date(y, m, d, 9, 0, 0, 0);
                            const endTime = new Date(y, m, d, 10, 0, 0, 0);
                            addValidatedSystemTodayTask(ctx, {
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
                                title: `[수납 예정 확인] ${student.name} 원생 ${py}년 ${pm}월 수강료`,
                                description: `${student.name} 원생의 ${py}년 ${pm}월 수강료 ${payment.amount.toLocaleString()}원이 수납 예정입니다.`,
                                relatedStudentIds: [student.id],
                                dedupeKey: dedupeKey,
                                visibilityRoles: ['director'],
                                actionType: 'NAVIGATE',
                                actionPayload: { route: '/billing', studentId: student.id }
                            }, { domain: 'billing', silent });
                        }
                    }
                }
            }
        });

        // 1.3 SessionPass Remaining Session Warnings
        sessionPasses.forEach(pass => {
            if (pass.status === 'archived' || pass.status === 'deleted') return;

            const enrollment = enrollments.find(e => e.id === pass.enrollmentId);
            if (!enrollment || enrollment.courseType !== 'session_pass') return;
            if (enrollment.status === 'archived' || enrollment.status === 'deleted') return;

            const student = students.find(s => s.id === pass.studentId);
            if (!student) return;
            if (student.status === 'withdrawn') return;

            const subjectName = enrollment.subjectName || enrollment.instrument || pass.passName || '수강권';
            const totalSessions = pass.totalSessions;
            const remaining = pass.remainingSessions;

            const todayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            let isPassUnpaid = (remaining === 0 || pass.status === 'used_up');
            let isPassExpired = !isPassUnpaid && (pass.expiresAt && (pass.expiresAt < todayStr || pass.status === 'expired') && remaining > 0);
            let isPassDue = !isPassUnpaid && !isPassExpired && (remaining === 1);

            if (isPassDue) {
                const dedupeKey = `SYSTEM_RECOMMEND_SESSION_PASS_DUE_${student.id}_${enrollment.id}_${pass.id}`;
                activeBillingKeys.push(dedupeKey);

                // 수동 완료/삭제 여부 검사
                const hasResolved = ctx.db.todayTasks.some(t =>
                    t.source === 'system' &&
                    (t.status === 'done' || t.status === 'dismissed') &&
                    t.dedupeKey === dedupeKey
                );

                if (!hasResolved) {
                    const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                    if (!isAlreadyOpen) {
                        const dueTime = new Date(y, m, d, 9, 0, 0, 0);
                        const endTime = new Date(y, m, d, 10, 0, 0, 0);
                        addValidatedSystemTodayTask(ctx, {
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
                            title: `[수납 예정 확인] ${student.name} 원생 ${subjectName} ${totalSessions}회 수업`,
                            description: `${student.name} 원생의 ${subjectName} ${totalSessions}회 수업 잔여 수업 횟수가 1회입니다.`,
                            relatedStudentIds: [student.id],
                            dedupeKey: dedupeKey,
                            visibilityRoles: ['director'],
                            actionType: 'NAVIGATE',
                            actionPayload: { route: '/billing', studentId: student.id }
                        }, { domain: 'billing', silent });
                    }
                }
            } else if (isPassUnpaid) {
                const dedupeKey = `SYSTEM_RECOMMEND_SESSION_PASS_UNPAID_${student.id}_${enrollment.id}_${pass.id}`;
                activeBillingKeys.push(dedupeKey);

                // 수동 완료/삭제 여부 검사
                const hasResolved = ctx.db.todayTasks.some(t =>
                    t.source === 'system' &&
                    (t.status === 'done' || t.status === 'dismissed') &&
                    t.dedupeKey === dedupeKey
                );

                if (!hasResolved) {
                    const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                    if (!isAlreadyOpen) {
                        const dueTime = new Date(y, m, d, 9, 0, 0, 0);
                        const endTime = new Date(y, m, d, 10, 0, 0, 0);
                        addValidatedSystemTodayTask(ctx, {
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
                            title: `[미수납 확인] ${student.name} 원생 ${subjectName} ${totalSessions}회 수업`,
                            description: `${student.name} 원생의 ${subjectName} ${totalSessions}회 수업 잔여 수업 횟수가 0회입니다.`,
                            relatedStudentIds: [student.id],
                            dedupeKey: dedupeKey,
                            visibilityRoles: ['director'],
                            actionType: 'NAVIGATE',
                            actionPayload: { route: '/billing', studentId: student.id }
                        }, { domain: 'billing', silent });
                    }
                }
            } else if (isPassExpired) {
                const dedupeKey = `SYSTEM_RECOMMEND_SESSION_PASS_EXPIRED_${student.id}_${enrollment.id}_${pass.id}`;
                activeBillingKeys.push(dedupeKey);

                // 수동 완료/삭제 여부 검사
                const hasResolved = ctx.db.todayTasks.some(t =>
                    t.source === 'system' &&
                    (t.status === 'done' || t.status === 'dismissed') &&
                    t.dedupeKey === dedupeKey
                );

                if (!hasResolved) {
                    const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                    if (!isAlreadyOpen) {
                        const dueTime = new Date(y, m, d, 9, 0, 0, 0);
                        const endTime = new Date(y, m, d, 10, 0, 0, 0);
                        addValidatedSystemTodayTask(ctx, {
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
                            title: `[미수납 확인] ${student.name} 원생 ${subjectName} 수강권 만료`,
                            description: `${student.name} 원생의 ${subjectName} 수강권 만료일(${pass.expiresAt})이 지났습니다. 잔여 수업 횟수 확인 또는 새 수강권 등록이 필요합니다.`,
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

        // 1.4 Mute / remove obsolete billing recommendations (automatic invalidation on paid or transition)
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
            if (key.startsWith('SYSTEM_RECOMMEND_WITHDRAWN_UNPAID_')) {
                const rest = key.substring('SYSTEM_RECOMMEND_WITHDRAWN_UNPAID_'.length);
                const idx = rest.lastIndexOf('_');
                return idx !== -1 ? rest.substring(0, idx) : rest;
            }
            if (key.startsWith('SYSTEM_RECOMMEND_BILLING_UPCOMING_')) {
                const rest = key.substring('SYSTEM_RECOMMEND_BILLING_UPCOMING_'.length);
                const idx = rest.lastIndexOf('_');
                return idx !== -1 ? rest.substring(0, idx) : rest;
            }
            return null;
        };

        // First, resolve (mark 'done') if payment status becomes 'paid'
        ctx.db.todayTasks = ctx.db.todayTasks.map(t => {
            if (t.source === 'system' && t.status === 'open' && (t.type === 'billing' || t.type === 'withdrawn_unpaid')) {
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
        ctx.db.todayTasks = ctx.db.todayTasks.filter(t => {
            if (t.source === 'system' && t.status === 'open' && (t.type === 'billing' || t.type === 'withdrawn_unpaid')) {
                // Category must be billing or overdue
                if (t.category === 'billing' || t.category === 'overdue' || t.category === 'system_check') {
                    return activeBillingKeys.includes(t.dedupeKey);
                }
            }
            return true;
        });

        // 2. Auto-Resolve Conditions (for Unpaid billing)
        const existingTasks = ctx.getTodayTasks() || [];
        existingTasks.forEach(task => {
            if (task.source === 'system' && task.status === 'open') {
                if (task.dedupeKey && task.dedupeKey.startsWith('SYSTEM_RECOMMEND_BILLING_UNPAID_')) {
                    const prefix = 'SYSTEM_RECOMMEND_BILLING_UNPAID_';
                    const rest = task.dedupeKey.substring(prefix.length);
                    const lastUnderscore = rest.lastIndexOf('_');
                    const paymentId = lastUnderscore !== -1 ? rest.substring(0, lastUnderscore) : rest;
                    const payment = payments.find(p => p.id === paymentId);
                    if (payment && payment.status === 'paid') {
                        ctx.updateTodayTask(task.id, { status: 'done', completedAt: parsedNow.toISOString() });
                    }
                } else if (task.dedupeKey && task.dedupeKey.startsWith('SYSTEM_RECOMMEND_WITHDRAWN_UNPAID_')) {
                    const prefix = 'SYSTEM_RECOMMEND_WITHDRAWN_UNPAID_';
                    const rest = task.dedupeKey.substring(prefix.length);
                    const lastUnderscore = rest.lastIndexOf('_');
                    const paymentId = lastUnderscore !== -1 ? rest.substring(0, lastUnderscore) : rest;
                    const payment = payments.find(p => p.id === paymentId);
                    if (payment && payment.status === 'paid') {
                        ctx.updateTodayTask(task.id, { status: 'done', completedAt: parsedNow.toISOString() });
                    }
                } else if (task.dedupeKey && task.dedupeKey.startsWith('SYSTEM_RECOMMEND_BILLING_UPCOMING_')) {
                    const prefix = 'SYSTEM_RECOMMEND_BILLING_UPCOMING_';
                    const rest = task.dedupeKey.substring(prefix.length);
                    const lastUnderscore = rest.lastIndexOf('_');
                    const paymentId = lastUnderscore !== -1 ? rest.substring(0, lastUnderscore) : rest;
                    const payment = payments.find(p => p.id === paymentId);
                    if (payment && payment.status === 'paid') {
                        ctx.updateTodayTask(task.id, { status: 'done', completedAt: parsedNow.toISOString() });
                    }
                }
            }
        });
    }
}
