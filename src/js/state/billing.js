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
            const wasPaid = invoice.status === 'paid';
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

            // Sync bookIssueRequests if book payment is paid
            if (invoice.type === 'book') {
                if (this.db.bookIssueRequests) {
                    const req = this.db.bookIssueRequests.find(r => r.paymentId === invoice.id);
                    if (req) {
                        req.status = 'paid';
                        req.paidAt = invoice.paidDate;
                        this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
                    }
                }
            }

            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);

            // Trigger tuition_paid message if status transitioned to paid
            if (!wasPaid) {
                this.triggerPaymentParentMessage(invoice.id, 'tuition_paid');
            }

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

        // Trigger tuition_billing message
        this.triggerPaymentParentMessage(newInvoice.id, 'tuition_billing');

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
            const wasPaid = payment.status === 'paid';
            Object.assign(payment, updates);

            // Sync bookIssueRequests if book payment is paid
            if (payment.type === 'book' && payment.status === 'paid') {
                if (this.db.bookIssueRequests) {
                    const req = this.db.bookIssueRequests.find(r => r.paymentId === payment.id);
                    if (req) {
                        req.status = 'paid';
                        req.paidAt = payment.paidDate || new Date().toISOString().slice(0, 10);
                        this.notify('BOOK_ISSUE_REQUESTS_CHANGED', this.db.bookIssueRequests);
                    }
                }
            }

            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);

            // Trigger tuition_paid message if status transitioned to paid
            if (!wasPaid && payment.status === 'paid') {
                this.triggerPaymentParentMessage(payment.id, 'tuition_paid');
            }

            return true;
        }
        return false;
    },

    triggerPaymentParentMessage(paymentId, eventType) {
        const payment = this.db.payments.find(p => p.id === paymentId);
        if (!payment || payment.type !== 'education') return;

        const student = typeof this.getStudent === 'function' ? this.getStudent(payment.studentId) : null;
        if (!student) return;

        const primaryContact = typeof this.getPrimaryParentContact === 'function' ? this.getPrimaryParentContact(payment.studentId) : null;
        if (!primaryContact) return;

        if (!primaryContact.phone || primaryContact.canReceiveMessage === false) {
            return;
        }

        const settings = typeof this.getParentMessageSettings === 'function' ? this.getParentMessageSettings() : null;
        if (!settings) return;

        let eventKey = '';
        if (eventType === 'tuition_billing') {
            eventKey = 'tuitionBilling';
        } else if (eventType === 'tuition_paid') {
            eventKey = 'tuitionPaid';
        } else if (eventType === 'tuition_overdue') {
            eventKey = 'tuitionOverdue';
        } else {
            return;
        }

        const setting = settings[eventKey];
        if (!setting || setting.messageEnabled === false) {
            return;
        }

        const parts = payment.month.split('-');
        const formattedMonth = parts.length === 2 ? `${parts[0]}년 ${parts[1]}월` : payment.month;

        let title = '';
        let body = '';
        let dedupeKey = '';

        if (eventType === 'tuition_billing') {
            title = `${student.name} 원생 수강료 수납 안내`;
            body = `${student.name} 원생의 ${formattedMonth} 수강료 ${payment.amount.toLocaleString()}원이 청구되었습니다.`;
            dedupeKey = `TUITION_BILLING_${payment.id}`;
        } else if (eventType === 'tuition_paid') {
            title = `${student.name} 원생 수강료 수납 완료`;
            body = `${student.name} 원생의 ${formattedMonth} 수강료 ${payment.amount.toLocaleString()}원이 수납 완료되었습니다.`;
            dedupeKey = `TUITION_PAID_${payment.id}`;
        } else if (eventType === 'tuition_overdue') {
            title = `${student.name} 원생 수강료 미수납 안내`;
            body = `${student.name} 원생의 ${formattedMonth} 수강료 ${payment.amount.toLocaleString()}원이 아직 수납되지 않았습니다.`;
            dedupeKey = `TUITION_OVERDUE_${payment.id}`;
        } else {
            return;
        }

        const pushRequired = setting.pushEnabled === true;
        const pushStatus = pushRequired ? 'pending' : 'not_required';

        if (typeof this.createParentMessage === 'function') {
            this.createParentMessage({
                studentId: payment.studentId,
                parentContactId: primaryContact.id,
                parentSlot: primaryContact.slot,
                recipientName: primaryContact.name,
                recipientRelation: primaryContact.relation,
                recipientPhone: primaryContact.phone,
                recipientUserId: primaryContact.linkedUserId,
                category: 'payment',
                type: eventType,
                title,
                body,
                pushRequired,
                pushStatus,
                relatedDomainType: 'payment',
                relatedDomainId: payment.id,
                dedupeKey
            });
        }
    }
};
