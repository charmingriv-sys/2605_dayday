// members.js - Students, Parent Student Links Domain State Module

export const membersMethods = {
    // --- STUDENTS STATUS HELPERS ---
    normalizeStudentStatus(status) {
        const allowed = ['attending', 'on_leave', 'withdrawn'];
        if (allowed.includes(status)) {
            return status;
        }
        return 'attending';
    },

    normalizeStudentRecord(student) {
        if (!student) return student;
        const normalized = this.normalizeStudentStatus(student.status);
        if (student.status !== normalized) {
            student.status = normalized;
        }
        return student;
    },

    getStudentStatus(student) {
        if (!student) return 'attending';
        return this.normalizeStudentStatus(student.status);
    },

    // --- STUDENTS ---
    getStudents() {
        if (!this.db.students) this.db.students = [];
        return this.db.students.filter(s => !s.isDeleted);
    },

    getStudent(id) {
        return this.db.students.find(s => s.id === id);
    },

    addStudent(student, classSchedules = []) {
        const id = 'S' + (this.db.students.length ? Math.max(...this.db.students.map(s => parseInt(s.id.slice(1)) || 0)) + 1 : 1);
        const maxMemberNo = this.db.students.length ? Math.max(...this.db.students.map(s => s.studentMemberNo || 0)) : 0;
        const studentMemberNo = maxMemberNo + 1;
        const paymentStatus = student.paymentStatus || 'unpaid';
        const defaultClassDuration = parseInt(student.defaultClassDuration) || 50;
        const status = this.normalizeStudentStatus(student.status);
        let leavePeriods = student.leavePeriods || [];
        if (status === 'on_leave' && student.leaveStartDate && student.leaveEndDate) {
            const exists = leavePeriods.some(p => p.startDate === student.leaveStartDate && p.endDate === student.leaveEndDate);
            if (!exists) {
                leavePeriods.push({ startDate: student.leaveStartDate, endDate: student.leaveEndDate });
            }
            leavePeriods.sort((a, b) => a.startDate.localeCompare(b.startDate));
        }
        
        const newStudent = { id, studentMemberNo, ...student, paymentStatus, defaultClassDuration, status, leavePeriods };
        this.db.students.push(newStudent);

        // Add class schedules
        classSchedules.forEach(schedule => {
            const classId = 'C' + (this.db.classes.length ? Math.max(...this.db.classes.map(c => parseInt(c.id.slice(1)) || 0)) + 1 : 1);
            this.db.classes.push({ id: classId, studentId: id, dayOfWeek: schedule.dayOfWeek, time: schedule.time });
        });

        // Auto create initial invoice for current month
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const invoiceDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
        
        this.db.payments.push({
            id: payId,
            studentId: id,
            amount: newStudent.fee,
            month: currentMonth,
            type: 'education',
            status: paymentStatus,
            invoiceDate: invoiceDate,
            paidDate: paymentStatus === 'paid' ? invoiceDate : null,
            method: paymentStatus === 'paid' ? 'cash' : null
        });

        if (student.parentPhone || student.parentName) {
            this.upsertParentContact({
                studentId: id,
                slot: 'parent1',
                name: student.parentName || `${student.name} 보호자`,
                relation: 'guardian',
                phone: student.parentPhone || ''
            });
        }

        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.notify('CLASSES_CHANGED', this.db.classes);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return newStudent;
    },

    addStudentsBatch(studentsList) {
        if (!Array.isArray(studentsList) || studentsList.length === 0) return [];
        
        const addedStudents = [];
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const invoiceDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        
        let nextStudentNum = this.db.students.length ? Math.max(...this.db.students.map(s => parseInt(s.id.slice(1)) || 0)) + 1 : 1;
        let nextMemberNo = (this.db.students.length ? Math.max(...this.db.students.map(s => s.studentMemberNo || 0)) : 0) + 1;
        let nextClassNum = this.db.classes.length ? Math.max(...this.db.classes.map(c => parseInt(c.id.slice(1)) || 0)) + 1 : 1;
        let nextPayNum = this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1;

        studentsList.forEach(item => {
            const student = item.studentData;
            const classSchedules = item.schedules || [];
            
            const id = 'S' + nextStudentNum++;
            const studentMemberNo = nextMemberNo++;
            const paymentStatus = student.paymentStatus || 'unpaid';
            const defaultClassDuration = parseInt(student.defaultClassDuration) || 50;
            const status = this.normalizeStudentStatus(student.status);
            let leavePeriods = student.leavePeriods || [];
            if (status === 'on_leave' && student.leaveStartDate && student.leaveEndDate) {
                const exists = leavePeriods.some(p => p.startDate === student.leaveStartDate && p.endDate === student.leaveEndDate);
                if (!exists) {
                    leavePeriods.push({ startDate: student.leaveStartDate, endDate: student.leaveEndDate });
                }
                leavePeriods.sort((a, b) => a.startDate.localeCompare(b.startDate));
            }
            
            const newStudent = { id, studentMemberNo, ...student, paymentStatus, defaultClassDuration, status, leavePeriods };
            this.db.students.push(newStudent);
            addedStudents.push(newStudent);

            // Add class schedules
            classSchedules.forEach(schedule => {
                const classId = 'C' + nextClassNum++;
                this.db.classes.push({ id: classId, studentId: id, dayOfWeek: schedule.dayOfWeek, time: schedule.time });
            });

            // Auto create initial invoice for current month
            const payId = 'P' + nextPayNum++;
            this.db.payments.push({
                id: payId,
                studentId: id,
                amount: newStudent.fee,
                month: currentMonth,
                type: 'education',
                status: paymentStatus,
                invoiceDate: invoiceDate,
                paidDate: paymentStatus === 'paid' ? invoiceDate : null,
                method: paymentStatus === 'paid' ? 'cash' : null
            });
        });

        this.saveDB();
        
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.notify('CLASSES_CHANGED', this.db.classes);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        
        return addedStudents;
    },

    updateStudent(id, data, classSchedules = null) {
        const updatedData = { ...data };
        if (updatedData.defaultClassDuration !== undefined) {
            updatedData.defaultClassDuration = parseInt(updatedData.defaultClassDuration) || 50;
        }
        if (updatedData.status !== undefined) {
            updatedData.status = this.normalizeStudentStatus(updatedData.status);
        }

        if (updatedData.withdrawalDate !== undefined) {
            updatedData.leaveDate = updatedData.withdrawalDate;
        }

        // Cumulative leave history logic
        if (updatedData.leavePeriods !== undefined) {
            updatedData.leavePeriods = [...updatedData.leavePeriods];
            updatedData.leavePeriods.sort((a, b) => a.startDate.localeCompare(b.startDate));
        } else if (updatedData.status === 'on_leave' && updatedData.leaveStartDate && updatedData.leaveEndDate) {
            const student = this.getStudent(id);
            if (student) {
                const leavePeriods = student.leavePeriods ? [...student.leavePeriods] : [];
                
                // Fallback migration: if there was leaveStartDate/leaveEndDate, but no leavePeriods, seed it
                if (leavePeriods.length === 0 && student.leaveStartDate && student.leaveEndDate) {
                    leavePeriods.push({ startDate: student.leaveStartDate, endDate: student.leaveEndDate });
                }

                // Check for duplicate
                const exists = leavePeriods.some(p => p.startDate === updatedData.leaveStartDate && p.endDate === updatedData.leaveEndDate);
                if (!exists) {
                    leavePeriods.push({ startDate: updatedData.leaveStartDate, endDate: updatedData.leaveEndDate });
                }

                // Sort by startDate ascending
                leavePeriods.sort((a, b) => a.startDate.localeCompare(b.startDate));
                
                updatedData.leavePeriods = leavePeriods;
            }
        }

        this.db.students = this.db.students.map(s => s.id === id ? { ...s, ...updatedData } : s);
        
        // Sync paymentStatus with monthly education payments
        if (data.paymentStatus !== undefined) {
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const invoice = this.db.payments.find(p => p.studentId === id && p.month === currentMonth && p.type === 'education');
            if (invoice) {
                invoice.status = data.paymentStatus;
                if (data.paymentStatus === 'paid') {
                    invoice.paidDate = invoice.paidDate || new Date().toISOString().slice(0, 10);
                    invoice.method = invoice.method || 'cash';
                } else {
                    invoice.paidDate = null;
                    invoice.method = null;
                }
            } else if (data.paymentStatus === 'paid' || data.paymentStatus === 'unpaid') {
                const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
                const invoiceDate = new Date().toISOString().slice(0, 10);
                const s = this.getStudent(id);
                this.db.payments.push({
                    id: payId,
                    studentId: id,
                    amount: s ? s.fee : 150000,
                    month: currentMonth,
                    type: 'education',
                    status: data.paymentStatus,
                    invoiceDate: invoiceDate,
                    paidDate: data.paymentStatus === 'paid' ? invoiceDate : null,
                    method: data.paymentStatus === 'paid' ? 'cash' : null
                });
            }
            this.notify('PAYMENTS_CHANGED', this.db.payments);
        }

        if (classSchedules !== null) {
            // Delete old class schedules for student
            this.db.classes = this.db.classes.filter(c => c.studentId !== id);
            // Insert new ones
            classSchedules.forEach(schedule => {
                const classId = 'C' + (this.db.classes.length ? Math.max(...this.db.classes.map(c => parseInt(c.id.slice(1)) || 0)) + 1 : 1);
                this.db.classes.push({ id: classId, studentId: id, dayOfWeek: schedule.dayOfWeek, time: schedule.time });
            });
        }

        if (data.parentPhone !== undefined || data.parentName !== undefined) {
            const s = this.db.students.find(x => x.id === id);
            if (s && (s.parentPhone || s.parentName)) {
                this.upsertParentContact({
                    studentId: id,
                    slot: 'parent1',
                    name: s.parentName || `${s.name} 보호자`,
                    relation: 'guardian',
                    phone: s.parentPhone || ''
                });
            } else if (s && !s.parentPhone && !s.parentName) {
                this.clearParentContact(id, 'parent1');
            }
        }

        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.notify('CLASSES_CHANGED', this.db.classes);
    },

    deleteStudent(id) {
        const student = this.db.students.find(s => s.id === id);
        if (student) {
            student.isDeleted = true;
            student.deletedAt = new Date().toISOString().slice(0, 10);
            this.saveDB();
            this.notify('STUDENTS_CHANGED', this.db.students);
        }
    },

    dischargeStudent(id) {
        const student = this.db.students.find(s => s.id === id);
        if (!student) throw new Error('원생을 찾을 수 없습니다.');
        student.status = 'withdrawn';
        student.withdrawalDate = new Date().toISOString().slice(0, 10);
        student.leaveDate = student.withdrawalDate;
        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);
    },

    // --- PARENT STUDENTS ---
    getStudentsForParent(parentUserId) {
        if (!this.db.parentStudentLinks) this.db.parentStudentLinks = [];
        const links = this.db.parentStudentLinks.filter(link => link.parentUserId === parentUserId);
        const studentIds = links.map(link => link.studentId);
        return this.db.students.filter(s => studentIds.includes(s.id));
    },

    getParentLinksForStudent(studentId) {
        if (!this.db.parentStudentLinks) this.db.parentStudentLinks = [];
        return this.db.parentStudentLinks.filter(link => link.studentId === studentId);
    }
};
