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

        this.saveDB();
        this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return newSB;
    },

    removeStudentBook(id) {
        const sb = this.getStudentBooks().find(item => item.id === id);
        if (sb) {
            // Delete invoice associated with it only if it is unpaid or requested
            if (sb.paymentId) {
                this.db.payments = this.db.payments.filter(p => !(p.id === sb.paymentId && p.status !== 'paid'));
            }
            this.db.studentBooks = this.db.studentBooks.filter(item => item.id !== id);
            this.saveDB();
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
            this.notify('PAYMENTS_CHANGED', this.db.payments);
        }
    }
};
