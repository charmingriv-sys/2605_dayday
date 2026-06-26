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

            // Trigger messages if status transitioned to paid
            if (!wasPaid) {
                if (invoice.type === 'education') {
                    this.triggerPaymentParentMessage(invoice.id, 'tuition_paid');
                } else if (invoice.type === 'book') {
                    this.triggerPaymentParentMessage(invoice.id, 'book_paid');
                }
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

            // Trigger messages if status transitioned to paid
            if (!wasPaid && payment.status === 'paid') {
                if (payment.type === 'education') {
                    this.triggerPaymentParentMessage(payment.id, 'tuition_paid');
                } else if (payment.type === 'book') {
                    this.triggerPaymentParentMessage(payment.id, 'book_paid');
                }
            }

            return true;
        }
        return false;
    },

    triggerPaymentParentMessage(paymentId, eventType) {
        const payment = this.db.payments.find(p => p.id === paymentId);
        if (!payment) return;
        if (eventType.startsWith('tuition_') && payment.type !== 'education') return;
        if (eventType.startsWith('book_') && payment.type !== 'book') return;

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
        } else if (eventType === 'book_billing') {
            eventKey = 'bookBilling';
        } else if (eventType === 'book_paid') {
            eventKey = 'bookPaid';
        } else if (eventType === 'book_overdue') {
            eventKey = 'bookOverdue';
        } else {
            return;
        }

        const setting = settings[eventKey];
        if (!setting || setting.messageEnabled === false) {
            return;
        }

        const parts = payment.month.split('-');
        const formattedMonth = parts.length === 2 ? `${parts[0]}년 ${parts[1]}월` : payment.month;

        let bookName = '';
        if (payment.type === 'book') {
            const book = payment.bookId && typeof this.getBook === 'function' ? this.getBook(payment.bookId) : null;
            if (book) {
                bookName = book.name;
            } else if (this.db.bookIssueRequests) {
                const req = this.db.bookIssueRequests.find(r => r.paymentId === payment.id);
                if (req) {
                    bookName = req.bookNameSnapshot || '';
                }
            }
        }

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
        } else if (eventType === 'book_billing') {
            title = `${student.name} 원생 교재비 수납 안내`;
            body = bookName
                ? `${student.name} 원생의 ${bookName} 교재비 ${payment.amount.toLocaleString()}원이 청구되었습니다.`
                : `${student.name} 원생의 교재비 ${payment.amount.toLocaleString()}원이 청구되었습니다.`;
            dedupeKey = `BOOK_BILLING_${payment.id}`;
        } else if (eventType === 'book_paid') {
            title = `${student.name} 원생 교재비 수납 완료`;
            body = bookName
                ? `${student.name} 원생의 ${bookName} 교재비 ${payment.amount.toLocaleString()}원이 수납 완료되었습니다.`
                : `${student.name} 원생의 교재비 ${payment.amount.toLocaleString()}원이 수납 완료되었습니다.`;
            dedupeKey = `BOOK_PAID_${payment.id}`;
        } else if (eventType === 'book_overdue') {
            title = `${student.name} 원생 교재비 미수납 안내`;
            body = bookName
                ? `${student.name} 원생의 ${bookName} 교재비 ${payment.amount.toLocaleString()}원이 아직 수납되지 않았습니다.`
                : `${student.name} 원생의 교재비 ${payment.amount.toLocaleString()}원이 아직 수납되지 않았습니다.`;
            dedupeKey = `BOOK_OVERDUE_${payment.id}`;
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
    },

    // --- PAYMENT TRANSACTIONS & BATCHES COLLECTION INITIALIZATION ---
    ensurePaymentTransactionsCollection() {
        if (!this.db.paymentTransactions) {
            this.db.paymentTransactions = [];
        }
    },

    ensurePaymentBatchesCollection() {
        if (!this.db.paymentBatches) {
            this.db.paymentBatches = [];
        }
    },

    // --- PAYMENT TRANSACTION STORAGE API ---
    createPaymentTransaction(payload) {
        this.ensurePaymentTransactionsCollection();
        this.ensurePaymentBatchesCollection();

        const {
            paymentId,
            batchId,
            provider,
            transactionType,
            paymentKey,
            approvalNo,
            amount,
            method,
            status,
            approvedAt,
            canceledAt,
            rawResponse
        } = payload;

        // Validation
        if (amount === undefined || amount === null || typeof amount !== 'number' || amount < 0) {
            throw new Error('Transaction amount must be a non-negative number');
        }
        if (!provider) {
            throw new Error('Transaction provider is required');
        }
        if (!transactionType || (transactionType !== 'approval' && transactionType !== 'cancel')) {
            throw new Error("Transaction type must be 'approval' or 'cancel'");
        }
        if (!status) {
            throw new Error('Transaction status is required');
        }
        if (!paymentId && !batchId) {
            throw new Error('Either paymentId or batchId must be provided');
        }

        if (paymentId) {
            const paymentExists = this.db.payments.some(p => p.id === paymentId);
            if (!paymentExists) {
                throw new Error(`Payment with ID ${paymentId} does not exist`);
            }
        }

        if (batchId) {
            const batchExists = this.db.paymentBatches.some(b => b.id === batchId);
            if (!batchExists) {
                throw new Error(`Payment batch with ID ${batchId} does not exist`);
            }
        }

        // Generate high-collision-safe unique ID (TX_N)
        const id = 'TX_' + (this.db.paymentTransactions.length 
            ? Math.max(...this.db.paymentTransactions.map(tx => {
                const num = parseInt(tx.id.replace('TX_', ''), 10);
                return isNaN(num) ? 0 : num;
              })) + 1 
            : 1);

        const newTx = {
            id,
            paymentId: paymentId || null,
            batchId: batchId || null,
            provider,
            transactionType,
            paymentKey: paymentKey || null,
            approvalNo: approvalNo || null,
            amount,
            method: method || null,
            status,
            approvedAt: approvedAt || null,
            canceledAt: canceledAt || null,
            rawResponse: rawResponse || null,
            createdAt: new Date().toISOString()
        };

        // Append-only write
        this.db.paymentTransactions.push(newTx);
        this.saveDB();

        // Trigger Status Recalculation if Transaction was Successful
        if (status === 'success') {
            if (paymentId) {
                this.recalculatePaymentStatus(paymentId);
            }
            if (batchId) {
                this.recalculatePaymentBatchStatus(batchId);
            }
        }

        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return newTx;
    },

    // --- PAYMENT STATUS RECALCULATION API ---
    recalculatePaymentStatus(paymentId) {
        this.ensurePaymentTransactionsCollection();
        const payment = this.db.payments.find(p => p.id === paymentId);
        if (!payment) return null;

        // filter successful transactions linked to this payment
        const successfulTxs = this.db.paymentTransactions.filter(tx => 
            tx.paymentId === paymentId && tx.status === 'success'
        );

        let approvalsSum = 0;
        let cancelsSum = 0;

        successfulTxs.forEach(tx => {
            if (tx.transactionType === 'approval') {
                approvalsSum += tx.amount;
            } else if (tx.transactionType === 'cancel') {
                cancelsSum += tx.amount;
            }
        });

        const paidAmount = Math.max(0, approvalsSum - cancelsSum);
        payment.paidAmount = paidAmount;

        const wasPaid = payment.status === 'paid';

        if (paidAmount <= 0) {
            payment.status = 'unpaid';
            payment.paidDate = null;
        } else if (paidAmount < payment.amount) {
            payment.status = 'partial';
            payment.paidDate = null;
        } else {
            payment.status = 'paid';
            if (!payment.paidDate) {
                payment.paidDate = new Date().toISOString().slice(0, 10);
            }
        }

        this.saveDB();
        this.notify('PAYMENTS_CHANGED', this.db.payments);

        // Sync to student's paymentStatus if current month's education invoice and transitions to paid
        if (payment.status === 'paid' && !wasPaid) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            if (payment.type === 'education' && payment.month === currentMonth) {
                const student = this.db.students.find(s => s.id === payment.studentId);
                if (student) {
                    student.paymentStatus = 'paid';
                    this.notify('STUDENTS_CHANGED', this.db.students);
                }
            }
        }

        return payment;
    },

    // --- PAYMENT BATCH STORAGE API ---
    createPaymentBatch(paymentIds, options = {}) {
        this.ensurePaymentBatchesCollection();

        if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
            throw new Error('paymentIds must be a non-empty array');
        }

        const linkedPayments = [];
        paymentIds.forEach(id => {
            const p = this.db.payments.find(pm => pm.id === id);
            if (!p) {
                throw new Error(`Linked payment with ID ${id} does not exist`);
            }
            linkedPayments.push(p);
        });

        const totalAmount = linkedPayments.reduce((sum, p) => sum + p.amount, 0);

        // Generate unique batch ID (PB_N)
        const id = 'PB_' + (this.db.paymentBatches.length 
            ? Math.max(...this.db.paymentBatches.map(b => {
                const num = parseInt(b.id.replace('PB_', ''), 10);
                return isNaN(num) ? 0 : num;
              })) + 1 
            : 1);

        const firstStudentId = linkedPayments[0].studentId;

        const newBatch = {
            id,
            paymentIds: [...paymentIds],
            studentId: options.studentId || firstStudentId,
            payerId: options.payerId || options.studentId || firstStudentId,
            totalAmount,
            paidAmount: 0,
            status: 'unpaid',
            provider: options.provider || 'manual',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.db.paymentBatches.push(newBatch);
        this.saveDB();
        this.notify('PAYMENTS_CHANGED', this.db.payments);

        return newBatch;
    },

    recalculatePaymentBatchStatus(batchId) {
        this.ensurePaymentBatchesCollection();
        this.ensurePaymentTransactionsCollection();

        const batch = this.db.paymentBatches.find(b => b.id === batchId);
        if (!batch) return null;

        const successfulTxs = this.db.paymentTransactions.filter(tx => 
            tx.batchId === batchId && tx.status === 'success'
        );

        let approvalsSum = 0;
        let cancelsSum = 0;

        successfulTxs.forEach(tx => {
            if (tx.transactionType === 'approval') {
                approvalsSum += tx.amount;
            } else if (tx.transactionType === 'cancel') {
                cancelsSum += tx.amount;
            }
        });

        const paidAmount = Math.max(0, approvalsSum - cancelsSum);
        batch.paidAmount = paidAmount;

        const hasCancels = successfulTxs.some(tx => tx.transactionType === 'cancel');

        if (paidAmount <= 0) {
            batch.status = hasCancels ? 'canceled' : 'unpaid';
        } else if (paidAmount < batch.totalAmount) {
            batch.status = 'partial';
        } else {
            batch.status = 'paid';
        }

        batch.updatedAt = new Date().toISOString();

        // Sync and propagate status to linked payments
        batch.paymentIds.forEach(pId => {
            const payment = this.db.payments.find(p => p.id === pId);
            if (!payment) return;

            if (batch.status === 'paid') {
                payment.status = 'paid';
                payment.paidAmount = payment.amount;
                if (!payment.paidDate) {
                    payment.paidDate = new Date().toISOString().slice(0, 10);
                }
            } else if (batch.status === 'canceled' || batch.status === 'unpaid') {
                payment.status = 'unpaid';
                payment.paidAmount = 0;
                payment.paidDate = null;
            }
            // If batch is partial, do not propagate to linked payments automatically (leave them as-is)
        });

        this.saveDB();
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return batch;
    },

    // --- TRANSACTIONS & BATCHES GETTER APIS ---
    getPaymentTransactionsByPaymentId(paymentId) {
        this.ensurePaymentTransactionsCollection();
        return this.db.paymentTransactions
            .filter(tx => tx.paymentId === paymentId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    getPaymentTransactionsByBatchId(batchId) {
        this.ensurePaymentTransactionsCollection();
        return this.db.paymentTransactions
            .filter(tx => tx.batchId === batchId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    getPaymentBatchById(batchId) {
        this.ensurePaymentBatchesCollection();
        return this.db.paymentBatches.find(b => b.id === batchId) || null;
    },

    getPaymentBatchesByPaymentId(paymentId) {
        this.ensurePaymentBatchesCollection();
        return this.db.paymentBatches
            .filter(b => b.paymentIds.includes(paymentId))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
};
