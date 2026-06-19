/**
 * todayTaskTextbook.js
 * Extracted textbook recommendation sync module for Phase 17G-5B
 */

export function syncTextbookRecommendations(ctx, options) {
    const { parsedNow, y, m, d, silent, addValidatedSystemTodayTask } = options;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    if (ctx.db.bookIssueRequests) {
        const students = typeof ctx.getStudents === 'function' ? ctx.getStudents() : (ctx.db.students || []);
        const teachers = typeof ctx.getTeachers === 'function' ? ctx.getTeachers() : (ctx.db.teachers || []);
        const books = typeof ctx.getBooks === 'function' ? ctx.getBooks() : (ctx.db.books || []);
        const payments = typeof ctx.getPayments === 'function' ? ctx.getPayments() : (ctx.db.payments || []);
        const bookIssueRequests = ctx.db.bookIssueRequests || [];
        const activeBookKeys = [];

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

            const hasResolved = ctx.db.todayTasks.some(t =>
                t.source === 'system' &&
                (t.status === 'done' || t.status === 'dismissed') &&
                t.dedupeKey === dedupeKey
            );

            if (!hasResolved) {
                const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                if (!isAlreadyOpen) {
                    const nowIso = parsedNow.toISOString();
                    addValidatedSystemTodayTask(ctx, {
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
                const msgExists = ctx.db.parentMessages && ctx.db.parentMessages.some(m => m.dedupeKey === msgDedupeKey);
                if (!msgExists && typeof ctx.triggerPaymentParentMessage === 'function') {
                    ctx.triggerPaymentParentMessage(payment.id, 'book_overdue');
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

            const hasResolved = ctx.db.todayTasks.some(t =>
                t.source === 'system' &&
                (t.status === 'done' || t.status === 'dismissed') &&
                t.dedupeKey === dedupeKey
            );

            if (!hasResolved) {
                const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                if (!isAlreadyOpen) {
                    const nowIso = parsedNow.toISOString();
                    addValidatedSystemTodayTask(ctx, {
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
        const studentBooks = typeof ctx.getStudentBooks === 'function' ? ctx.getStudentBooks() : (ctx.db.studentBooks || []);
        const attendance = typeof ctx.getAttendance === 'function' ? ctx.getAttendance() : (ctx.db.attendance || []);

        students.forEach(student => {
            // 휴원(on_leave) 또는 퇴원(withdrawn) 원생 제외 (Phase 18A-Repair)
            if (student.status === 'on_leave' || student.status === 'withdrawn') return;

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
            
            // Count attendance on or after regDate and on or before dateStr (Phase 18A-Repair)
            const attendedCount = attendance.filter(a => {
                return a.studentId === student.id &&
                       a.date >= latestSB.regDate &&
                       a.date <= dateStr &&
                       (a.status === 'present' || a.status === 'late');
            }).length;

            const ratio = recommendedDays > 0 ? (attendedCount / recommendedDays) : 0;
            
            if (ratio >= 0.9) {
                const dedupeKey = `SYSTEM_RECOMMEND_BOOK_RECOMMENDATION_${student.id}_${latestSB.bookId}_${latestSB.regDate}`;
                activeBookKeys.push(dedupeKey);

                // Check if manually completed / dismissed / snoozed
                const hasResolved = ctx.db.todayTasks.some(t =>
                    t.source === 'system' &&
                    (t.status === 'done' || t.status === 'dismissed' || (t.status === 'snoozed' && new Date(t.snoozedUntil).getTime() > parsedNow.getTime())) &&
                    t.dedupeKey === dedupeKey
                );

                if (!hasResolved) {
                    const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                    if (!isAlreadyOpen) {
                        const nowIso = parsedNow.toISOString();
                        addValidatedSystemTodayTask(ctx, {
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
        ctx.db.todayTasks = ctx.db.todayTasks.map(t => {
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
        ctx.db.todayTasks = ctx.db.todayTasks.filter(t => {
            if (t.source === 'system' && t.status === 'open' && t.type === 'book') {
                if (t.category === 'book_check' || t.category === 'book_billing' || t.category === 'book_recommendation') {
                    return activeBookKeys.includes(t.dedupeKey);
                }
            }
            return true;
        });
    }
}
