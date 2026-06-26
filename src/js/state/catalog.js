// catalog.js - Catalog (Books, Subjects) Domain State Module

export const catalogMethods = {
    // --- BOOKS ---
    getBooks() {
        if (!this.db.books) {
            this.db.books = [];
        }
        return this.db.books;
    },

    getBook(id) {
        return this.getBooks().find(b => b.id === id);
    },

    addBook(book) {
        if (!this.db.books) {
            this.db.books = [];
        }
        const id = 'B' + (this.db.books.length ? Math.max(...this.db.books.map(b => parseInt(b.id.slice(1)) || 0)) + 1 : 1);
        const recommendedDays = parseInt(book.recommendedDays) || 90;
        const newBook = { id, status: 'active', ...book, recommendedDays };
        this.db.books.push(newBook);
        this.saveDB();
        this.notify('BOOKS_CHANGED', this.db.books);
        return newBook;
    },

    updateBook(id, data) {
        if (data.recommendedDays !== undefined) {
            data.recommendedDays = parseInt(data.recommendedDays) || 90;
        }
        this.db.books = this.getBooks().map(b => b.id === id ? { ...b, ...data } : b);
        this.saveDB();
        this.notify('BOOKS_CHANGED', this.db.books);
    },

    deleteBook(id) {
        this.db.books = this.getBooks().filter(b => b.id !== id);
        
        // Remove related student books and unpaid book payments
        if (this.db.studentBooks) {
            const sbsToDelete = this.db.studentBooks.filter(sb => sb.bookId === id);
            sbsToDelete.forEach(sb => {
                if (sb.paymentId) {
                    this.db.payments = this.db.payments.filter(p => p.id !== sb.paymentId || p.status === 'paid');
                }
            });
            this.db.studentBooks = this.db.studentBooks.filter(sb => sb.bookId !== id);
        }
        this.db.payments = this.db.payments.filter(p => !(p.bookId === id && p.status === 'unpaid'));

        this.saveDB();
        this.notify('BOOKS_CHANGED', this.db.books);
        this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
    },

    // --- SUBJECTS ---
    getSubjects() {
        if (!this.db.subjects) {
            this.db.subjects = [
                { id: 'SUB1', name: '피아노', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB2', name: '바이올린', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB3', name: '첼로', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB4', name: '플루트', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB5', name: '기타', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' }
            ];
            this.saveDB();
        }
        return this.db.subjects;
    },

    addSubject(name, isActive = true) {
        const subjects = this.getSubjects();
        const id = 'SUB' + (subjects.length ? Math.max(...subjects.map(s => parseInt(s.id.slice(3)) || 0)) + 1 : 1);
        const today = new Date().toISOString().slice(0, 10);
        const newSubject = { id, name, isActive, regDate: today, updateDate: today };
        this.db.subjects.push(newSubject);
        this.saveDB();
        this.notify('SUBJECTS_CHANGED', this.db.subjects);
        return newSubject;
    },

    updateSubject(id, data) {
        const today = new Date().toISOString().slice(0, 10);
        this.db.subjects = this.getSubjects().map(s => s.id === id ? { ...s, ...data, updateDate: today } : s);
        this.saveDB();
        this.notify('SUBJECTS_CHANGED', this.db.subjects);
    },

    deleteSubject(id) {
        this.db.subjects = this.getSubjects().filter(s => s.id !== id);
        this.saveDB();
        this.notify('SUBJECTS_CHANGED', this.db.subjects);
    },

    // --- STUDENT BOOKS ---
    getStudentBooks() {
        if (!this.db.studentBooks) {
            this.db.studentBooks = [];
        }
        return this.db.studentBooks;
    },

    getBooksForStudent(studentId) {
        return this.getStudentBooks().filter(sb => sb.studentId === studentId);
    },

    assignBookToStudent(studentId, bookId, regDate, orderNo) {
        if (!this.db.studentBooks) {
            this.db.studentBooks = [];
        }
        const book = this.getBook(bookId);
        if (!book) return null;

        // 1. Create a payment record (type: 'book')
        const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
        const month = regDate.slice(0, 7); // YYYY-MM
        const newPayment = {
            id: payId,
            studentId,
            amount: book.price,
            month: month,
            type: 'book',
            status: 'unpaid',
            invoiceDate: regDate,
            paidDate: null,
            method: null,
            bookId: bookId
        };
        this.db.payments.push(newPayment);

        // 2. Create the student book record referencing the payment
        const id = 'SB' + (this.db.studentBooks.length ? Math.max(...this.db.studentBooks.map(sb => parseInt(sb.id.slice(2)) || 0)) + 1 : 1);
        const newSB = { id, studentId, bookId, regDate, orderNo: parseInt(orderNo) || 1, paymentId: payId };
        this.db.studentBooks.push(newSB);

        // 3. Create the confirmed book issue request
        if (!this.db.bookIssueRequests) {
            this.db.bookIssueRequests = [];
        }
        const birId = 'BIR' + (this.db.bookIssueRequests.length ? Math.max(...this.db.bookIssueRequests.map(r => parseInt(r.id.slice(3)) || 0)) + 1 : 1);
        const newBIR = {
            id: birId,
            studentId,
            teacherId: null,
            bookId,
            bookNameSnapshot: book.name,
            amountSnapshot: book.price,
            status: 'confirmed',
            requestedAt: regDate,
            confirmedAt: regDate,
            paymentRequestedAt: null,
            paidAt: null,
            paymentId: payId,
            studentBookId: id,
            memo: '원장 직접 등록',
            messageRequestId: null,
            outboundMessageLogId: null
        };
        this.db.bookIssueRequests.push(newBIR);

        this.saveDB();
        this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
        return newSB;
    },

    removeStudentBook(id) {
        const sb = this.getStudentBooks().find(item => item.id === id);
        if (sb) {
            // If payment is already paid, block deletion to prevent ledger discrepancy
            if (sb.paymentId) {
                const payments = this.db.payments || [];
                const payment = payments.find(p => p.id === sb.paymentId);
                if (payment && payment.status === 'paid') {
                    return false; // Block deletion
                }
                
                // Delete payment if it is unpaid/requested
                this.db.payments = this.db.payments.filter(p => !(p.id === sb.paymentId && p.status !== 'paid'));
            }
            
            // Update associated bookIssueRequests status to 'cancelled'
            if (this.db.bookIssueRequests) {
                const req = this.db.bookIssueRequests.find(r => r.studentBookId === id);
                if (req) {
                    req.status = 'cancelled';
                }
            }

            this.db.studentBooks = this.db.studentBooks.filter(item => item.id !== id);

            this.saveDB();
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
            return true;
        }
        return false;
    },

    // --- BOOK ISSUE REQUESTS ---
    getBookIssueRequests() {
        if (!this.db.bookIssueRequests) {
            this.db.bookIssueRequests = [];
        }
        return this.db.bookIssueRequests;
    },

    addBookIssueRequest(req) {
        if (!this.db.bookIssueRequests) {
            this.db.bookIssueRequests = [];
        }
        const requestedAt = req.requestedAt || new Date().toISOString().slice(0, 10);
        const teacherId = req.teacherId || null;
        const studentId = req.studentId;
        const bookId = req.bookId;

        // Duplicate prevention check
        const isDuplicate = this.db.bookIssueRequests.some(r => 
            r.studentId === studentId &&
            r.bookId === bookId &&
            r.requestedAt === requestedAt &&
            (r.status === 'requested' || r.status === 'confirmed' || r.status === 'payment_requested')
        );
        if (isDuplicate) {
            throw new Error('동일한 원생에게 동일한 교재가 이미 지급 요청 또는 등록되어 있습니다.');
        }

        const id = 'BIR' + (this.db.bookIssueRequests.length ? Math.max(...this.db.bookIssueRequests.map(b => parseInt(b.id.slice(3)) || 0)) + 1 : 1);
        const newReq = {
            id,
            teacherId,
            studentId,
            bookId,
            bookNameSnapshot: req.bookNameSnapshot || '',
            amountSnapshot: req.amountSnapshot || 0,
            status: req.status || 'requested',
            requestedAt,
            confirmedAt: req.confirmedAt || null,
            paymentRequestedAt: req.paymentRequestedAt || null,
            paidAt: req.paidAt || null,
            paymentId: req.paymentId || null,
            studentBookId: req.studentBookId || null,
            memo: req.memo || '',
            messageRequestId: req.messageRequestId || null,
            outboundMessageLogId: req.outboundMessageLogId || null
        };
        this.db.bookIssueRequests.push(newReq);

        if (typeof this.syncSystemRecommendations === 'function') {
            this.syncSystemRecommendations();
        }

        this.saveDB();
        this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
        this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks || []);
        return newReq;
    },

    updateBookIssueRequest(id, updates) {
        const reqIndex = this.getBookIssueRequests().findIndex(r => r.id === id);
        if (reqIndex !== -1) {
            this.db.bookIssueRequests[reqIndex] = {
                ...this.db.bookIssueRequests[reqIndex],
                ...updates
            };
            this.saveDB();
            this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
            return true;
        }
        return false;
    },

    migrateStudentBooksToIssueRequests() {
        if (!this.db.bookIssueRequests) {
            this.db.bookIssueRequests = [];
        }
        const studentBooks = this.getStudentBooks();
        const payments = this.db.payments || [];
        const books = this.db.books || [];
        let dbChanged = false;

        studentBooks.forEach(sb => {
            // Check if there is already a bookIssueRequest referencing this studentBookId or paymentId
            const exists = this.db.bookIssueRequests.some(req => 
                req.studentBookId === sb.id || (sb.paymentId && req.paymentId === sb.paymentId)
            );
            if (!exists) {
                let status = 'confirmed';
                let paidAt = null;
                const paymentId = sb.paymentId || null;
                const payment = paymentId ? payments.find(p => p.id === paymentId) : null;
                if (payment) {
                    if (payment.status === 'paid') {
                        status = 'paid';
                        paidAt = payment.paidDate || sb.regDate;
                    }
                }

                const book = books.find(b => b.id === sb.bookId);
                const bookNameSnapshot = book ? book.name : '알 수 없는 교재';
                const amountSnapshot = book ? book.price : 0;

                const id = 'BIR' + (this.db.bookIssueRequests.length ? Math.max(...this.db.bookIssueRequests.map(r => parseInt(r.id.slice(3)) || 0)) + 1 : 1);
                const newReq = {
                    id,
                    studentId: sb.studentId,
                    teacherId: null,
                    bookId: sb.bookId,
                    bookNameSnapshot,
                    amountSnapshot,
                    status,
                    requestedAt: sb.regDate,
                    confirmedAt: sb.regDate,
                    paymentRequestedAt: payment && payment.status === 'requested' ? sb.regDate : null,
                    paidAt,
                    paymentId,
                    studentBookId: sb.id,
                    memo: '이전 지급 데이터 마이그레이션',
                    messageRequestId: null,
                    outboundMessageLogId: null
                };
                this.db.bookIssueRequests.push(newReq);
                dbChanged = true;
            }
        });

        if (dbChanged) {
            this.saveDB();
            this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
        }
    },

    confirmBookIssueRequest(id) {
        const req = this.getBookIssueRequests().find(r => r.id === id);
        if (!req) {
            throw new Error('해당 교재 지급 요청을 찾을 수 없습니다.');
        }
        if (req.status !== 'requested') {
            throw new Error('이미 확인 처리되었거나 대기 중인 요청이 아닙니다.');
        }

        const book = this.getBook(req.bookId);
        if (!book) {
            throw new Error('교재 정보를 찾을 수 없습니다.');
        }

        let today = new Date().toISOString().slice(0, 10);
        if (this.db && this.db.settings && this.db.settings.DAYDAY_DEBUG_EVAL_TIME) {
            today = new Date(this.db.settings.DAYDAY_DEBUG_EVAL_TIME).toISOString().slice(0, 10);
        }

        // 1. Create payment if not already exists
        let paymentId = req.paymentId;
        if (!paymentId) {
            if (!this.db.payments) this.db.payments = [];
            const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
            const month = today.slice(0, 7);
            const newPayment = {
                id: payId,
                studentId: req.studentId,
                amount: req.amountSnapshot || book.price,
                month: month,
                type: 'book',
                status: 'unpaid',
                invoiceDate: today,
                paidDate: null,
                method: null,
                bookId: req.bookId
            };
            this.db.payments.push(newPayment);
            paymentId = payId;

            if (typeof this.triggerPaymentParentMessage === 'function') {
                this.triggerPaymentParentMessage(payId, 'book_billing');
            }
        }

        // 2. Create student book record if not already exists
        let studentBookId = req.studentBookId;
        if (!studentBookId) {
            if (!this.db.studentBooks) this.db.studentBooks = [];
            const sbId = 'SB' + (this.db.studentBooks.length ? Math.max(...this.db.studentBooks.map(sb => parseInt(sb.id.slice(2)) || 0)) + 1 : 1);
            
            // Calculate orderNo
            const studentBooks = this.getStudentBooks().filter(sb => sb.studentId === req.studentId && sb.bookId === req.bookId);
            const nextOrderNo = studentBooks.length + 1;

            const newSB = {
                id: sbId,
                studentId: req.studentId,
                bookId: req.bookId,
                regDate: today,
                orderNo: nextOrderNo,
                paymentId: paymentId
            };
            this.db.studentBooks.push(newSB);
            studentBookId = sbId;
        }

        // 3. Update the request status
        req.status = 'confirmed';
        req.confirmedAt = today;
        req.paymentId = paymentId;
        req.studentBookId = studentBookId;

        // 4. Sync recommendations
        if (typeof this.syncSystemRecommendations === 'function') {
            this.syncSystemRecommendations();
        }

        this.saveDB();
        
        // 5. Notify events
        this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
        this.notify('TODAY_TASKS_CHANGED', this.db.todayTasks || []);
        
        return req;
    },

    ensureCoursesCollection() {
        if (!this.db) return;
        if (!this.db.courses) {
            this.db.courses = [];
        }
    },

    seedDefaultCoursesIfEmpty() {
        this.ensureCoursesCollection();
        if (this.db.courses.length === 0) {
            const today = new Date().toISOString();
            this.db.courses = [
                {
                    id: 'CRS_1',
                    name: '피아노 정규반',
                    subjectName: '피아노',
                    courseType: 'monthly',
                    defaultFee: 150000,
                    defaultDurationMinutes: 50,
                    defaultDueDay: 10,
                    isActive: true,
                    status: 'active',
                    createdAt: today,
                    updatedAt: today
                },
                {
                    id: 'CRS_2',
                    name: '바이올린 쿠폰 10회',
                    subjectName: '바이올린',
                    courseType: 'session_pass',
                    defaultFee: 180000,
                    defaultTotalSessions: 10,
                    defaultLowBalanceThreshold: 2,
                    defaultDurationMinutes: 50,
                    isActive: true,
                    status: 'active',
                    createdAt: today,
                    updatedAt: today
                }
            ];
            this.saveDB();
            this.notify('COURSES_CHANGED', this.db.courses);
        }
    },

    createCourseMaster(payload) {
        this.ensureCoursesCollection();
        
        if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
            throw new Error('이름은 필수 입력 항목입니다.');
        }
        if (!payload.subjectName || typeof payload.subjectName !== 'string' || !payload.subjectName.trim()) {
            throw new Error('과목명은 필수 입력 항목입니다.');
        }
        if (payload.courseType !== 'monthly' && payload.courseType !== 'session_pass') {
            throw new Error('수강 구분은 monthly 또는 session_pass만 허용됩니다.');
        }
        const defaultFee = Number(payload.defaultFee);
        if (isNaN(defaultFee) || defaultFee < 0) {
            throw new Error('기본 금액은 0 이상이어야 합니다.');
        }
        const defaultDurationMinutes = Number(payload.defaultDurationMinutes);
        if (isNaN(defaultDurationMinutes) || defaultDurationMinutes <= 0) {
            throw new Error('기본 수업 시간은 0보다 커야 합니다.');
        }
        
        const newCourse = {
            name: payload.name.trim(),
            subjectName: payload.subjectName.trim(),
            courseType: payload.courseType,
            defaultFee: defaultFee,
            defaultDurationMinutes: defaultDurationMinutes,
            isActive: payload.isActive !== undefined ? !!payload.isActive : true,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (payload.courseType === 'monthly') {
            const defaultDueDay = Number(payload.defaultDueDay);
            if (isNaN(defaultDueDay) || defaultDueDay < 1 || defaultDueDay > 31) {
                throw new Error('정기 수납일은 1에서 31 사이여야 합니다.');
            }
            newCourse.defaultDueDay = defaultDueDay;
        } else if (payload.courseType === 'session_pass') {
            const defaultTotalSessions = Number(payload.defaultTotalSessions);
            if (isNaN(defaultTotalSessions) || defaultTotalSessions < 1) {
                throw new Error('기본 횟수는 1 이상이어야 합니다.');
            }
            const defaultLowBalanceThreshold = Number(payload.defaultLowBalanceThreshold !== undefined ? payload.defaultLowBalanceThreshold : 2);
            if (isNaN(defaultLowBalanceThreshold) || defaultLowBalanceThreshold < 0) {
                throw new Error('알림 기준 횟수는 0 이상이어야 합니다.');
            }
            if (defaultLowBalanceThreshold > defaultTotalSessions) {
                throw new Error('알림 기준 횟수는 기본 횟수 이하이어야 합니다.');
            }
            newCourse.defaultTotalSessions = defaultTotalSessions;
            newCourse.defaultLowBalanceThreshold = defaultLowBalanceThreshold;
        }

        let maxNum = 0;
        this.db.courses.forEach(c => {
            if (typeof c.id === 'string' && c.id.startsWith('CRS_')) {
                const num = parseInt(c.id.substring(4), 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        newCourse.id = `CRS_${maxNum + 1}`;

        this.db.courses.push(newCourse);
        this.saveDB();
        this.notify('COURSES_CHANGED', this.db.courses);
        return newCourse;
    },

    updateCourseMaster(courseId, patch) {
        this.ensureCoursesCollection();
        const course = this.db.courses.find(c => c.id === courseId);
        if (!course) {
            throw new Error('수강과목을 찾을 수 없습니다.');
        }
        if (course.status === 'archived') {
            throw new Error('보관된 수강과목은 수정할 수 없습니다.');
        }

        if (patch.name !== undefined) {
            if (typeof patch.name !== 'string' || !patch.name.trim()) {
                throw new Error('이름은 필수 입력 항목입니다.');
            }
            course.name = patch.name.trim();
        }
        if (patch.subjectName !== undefined) {
            if (typeof patch.subjectName !== 'string' || !patch.subjectName.trim()) {
                throw new Error('과목명은 필수 입력 항목입니다.');
            }
            course.subjectName = patch.subjectName.trim();
        }
        if (patch.defaultFee !== undefined) {
            const fee = Number(patch.defaultFee);
            if (isNaN(fee) || fee < 0) {
                throw new Error('기본 금액은 0 이상이어야 합니다.');
            }
            course.defaultFee = fee;
        }
        if (patch.defaultDurationMinutes !== undefined) {
            const duration = Number(patch.defaultDurationMinutes);
            if (isNaN(duration) || duration <= 0) {
                throw new Error('기본 수업 시간은 0보다 커야 합니다.');
            }
            course.defaultDurationMinutes = duration;
        }
        if (course.courseType === 'monthly') {
            if (patch.defaultDueDay !== undefined) {
                const dueDay = Number(patch.defaultDueDay);
                if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
                    throw new Error('정기 수납일은 1에서 31 사이여야 합니다.');
                }
                course.defaultDueDay = dueDay;
            }
        } else if (course.courseType === 'session_pass') {
            const totalSessions = patch.defaultTotalSessions !== undefined ? Number(patch.defaultTotalSessions) : course.defaultTotalSessions;
            if (patch.defaultTotalSessions !== undefined) {
                if (isNaN(totalSessions) || totalSessions < 1) {
                    throw new Error('기본 횟수는 1 이상이어야 합니다.');
                }
                course.defaultTotalSessions = totalSessions;
            }
            if (patch.defaultLowBalanceThreshold !== undefined) {
                const threshold = Number(patch.defaultLowBalanceThreshold);
                if (isNaN(threshold) || threshold < 0) {
                    throw new Error('알림 기준 횟수는 0 이상이어야 합니다.');
                }
                if (threshold > totalSessions) {
                    throw new Error('알림 기준 횟수는 기본 횟수 이하이어야 합니다.');
                }
                course.defaultLowBalanceThreshold = threshold;
            }
        }

        if (patch.isActive !== undefined) {
            course.isActive = !!patch.isActive;
        }

        course.updatedAt = new Date().toISOString();
        this.saveDB();
        this.notify('COURSES_CHANGED', this.db.courses);
        return course;
    },

    archiveCourseMaster(courseId) {
        this.ensureCoursesCollection();
        const course = this.db.courses.find(c => c.id === courseId);
        if (!course) {
            throw new Error('수강과목을 찾을 수 없습니다.');
        }
        course.status = 'archived';
        course.isActive = false;
        course.archivedAt = new Date().toISOString();
        course.updatedAt = new Date().toISOString();
        this.saveDB();
        this.notify('COURSES_CHANGED', this.db.courses);
        return course;
    },

    getActiveCourseMasters(options = {}) {
        this.ensureCoursesCollection();
        let list = this.db.courses.filter(c => c.status === 'active');
        if (options.onlyActive === true) {
            list = list.filter(c => c.isActive);
        }
        return list;
    },

    getCourseMasterById(courseId) {
        this.ensureCoursesCollection();
        return this.db.courses.find(c => c.id === courseId) || null;
    }
};
