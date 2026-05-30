// billing.js - Payments, Invoices, Book Payments Domain State Module

export const billingMethods = {
    // --- PAYMENTS ---
    getPayments() {
        return this.db.payments;
    },

    getPaymentsForStudent(studentId) {
        return this.db.payments.filter(p => p.studentId === studentId);
    },

    payInvoice(paymentId, method) {
        const invoice = this.db.payments.find(p => p.id === paymentId);
        if (invoice) {
            invoice.status = 'paid';
            invoice.paidDate = new Date().toISOString().slice(0, 10);
            invoice.method = method;
            
            // Sync back to student's paymentStatus if current month's education invoice
            const currentMonth = new Date().toISOString().slice(0, 7);
            if (invoice.type === 'education' && invoice.month === currentMonth) {
                const student = this.db.students.find(s => s.id === invoice.studentId);
                if (student) {
                    student.paymentStatus = 'paid';
                    this.notify('STUDENTS_CHANGED', this.db.students);
                }
            }

            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            return invoice;
        }
        return null;
    },

    createInvoice(studentId, amount, month) {
        // Check if invoice for this student and month already exists
        const existing = this.db.payments.find(p => p.studentId === studentId && p.month === month);
        if (existing) return existing;

        const id = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
        const invoiceDate = new Date().toISOString().slice(0, 10);
        const newInvoice = {
            id,
            studentId,
            amount,
            month,
            type: 'education',
            status: 'unpaid',
            invoiceDate,
            paidDate: null,
            method: null
        };
        this.db.payments.push(newInvoice);
        this.saveDB();
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return newInvoice;
    },

    // --- SEED BOOK PAYMENTS ---
    seedInitialBookPayments() {
        if (!this.db.studentBooks) return;
        let dbChanged = false;

        this.db.studentBooks.forEach(sb => {
            if (!sb.paymentId) {
                // Find if there is an existing payment for this book and student
                const book = this.getBook(sb.bookId);
                if (!book) return;

                const month = sb.regDate.slice(0, 7); // YYYY-MM
                let payRecord = this.db.payments.find(p => p.studentId === sb.studentId && p.bookId === sb.bookId && p.type === 'book');
                
                if (!payRecord) {
                    const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
                    payRecord = {
                        id: payId,
                        studentId: sb.studentId,
                        amount: book.price,
                        month: month,
                        type: 'book',
                        status: sb.id === 'SB2' ? 'requested' : 'paid', // Match initial requested status for SB2 demo, paid for others
                        invoiceDate: sb.regDate,
                        paidDate: sb.id === 'SB2' ? null : sb.regDate,
                        method: sb.id === 'SB2' ? null : 'cash',
                        bookId: sb.bookId
                    };
                    this.db.payments.push(payRecord);
                }
                sb.paymentId = payRecord.id;
                dbChanged = true;
            }
        });

        if (dbChanged) {
            this.saveDB();
        }
    },

    requestBookPayment(paymentIdOrStudentBookId) {
        // Handle both payment ID or studentBookId
        let paymentRecord = this.db.payments.find(p => p.id === paymentIdOrStudentBookId);
        let sbRecord = null;
        
        if (!paymentRecord) {
            sbRecord = this.getStudentBooks().find(sb => sb.id === paymentIdOrStudentBookId);
            if (sbRecord && sbRecord.paymentId) {
                paymentRecord = this.db.payments.find(p => p.id === sbRecord.paymentId);
            }
        } else {
            sbRecord = this.getStudentBooks().find(sb => sb.paymentId === paymentRecord.id);
        }

        if (paymentRecord && paymentRecord.status !== 'paid') {
            paymentRecord.status = 'requested';
            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);

            if (this.db.settings.sendKakaoAlert) {
                const student = this.getStudent(paymentRecord.studentId);
                if (paymentRecord.type === 'book') {
                    const book = this.getBook(paymentRecord.bookId);
                    if (student && book) {
                        const alertMsg = `[튜링 알림톡]\n안녕하세요, ${student.name} 학부모님.\n신규 교재 [${book.name}]의 교재비 ${book.price.toLocaleString()}원 결제 요청이 도착했습니다.\n\n해당 수강 월 청구 내역과 함께 결제를 부탁드립니다. 감사합니다.`;
                        const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
                        window.dispatchEvent(event);
                    }
                } else {
                    if (student) {
                        const alertMsg = `[튜링 알림톡]\n안녕하세요, ${student.name} 학부모님.\n${this.db.settings.academyName || '튜링 음악학원'} ${paymentRecord.month.slice(5)}월분 교육비 ${paymentRecord.amount.toLocaleString()}원 결제 요청이 도착했습니다.\n(정기 수납일: 매월 ${student.dueDay || 10}일)\n\n아래의 수단을 통하여 수강료 납부 처리를 부탁드립니다. 감사합니다.`;
                        const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
                        window.dispatchEvent(event);
                    }
                }
            }
        }
    },

    updatePayment(paymentId, updates) {
        const payment = this.db.payments.find(p => p.id === paymentId);
        if (payment) {
            Object.assign(payment, updates);
            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
            return true;
        }
        return false;
    }
};
