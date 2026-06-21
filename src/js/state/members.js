// members.js - Students, Parent Student Links Domain State Module

export const membersMethods = {
    autoAttendingReturnFromLeave(customDateStr = null) {
        if (!this.db || !this.db.students) return;

        let dateStr = customDateStr;
        if (!dateStr) {
            let parsedNow = new Date();
            if (this.db.settings && this.db.settings.DAYDAY_DEBUG_EVAL_TIME) {
                parsedNow = new Date(this.db.settings.DAYDAY_DEBUG_EVAL_TIME);
            }
            const y = parsedNow.getFullYear();
            const m = parsedNow.getMonth();
            const d = parsedNow.getDate();
            dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }

        if (this._lastAutoReturnDate === dateStr) {
            return;
        }
        this._lastAutoReturnDate = dateStr;

        let hasChanged = false;

        this.db.students = this.db.students.map(student => {
            if (student.status !== 'on_leave' || student.isDeleted) {
                return student;
            }

            let periods = [];
            if (student.leavePeriods && student.leavePeriods.length > 0) {
                periods = [...student.leavePeriods];
            } else if (student.leaveStartDate && student.leaveEndDate) {
                periods = [{ startDate: student.leaveStartDate, endDate: student.leaveEndDate }];
            }

            const hasPastPeriod = periods.some(p => p.endDate && p.endDate < dateStr);
            const isInAnyPeriod = periods.some(p => p.startDate && p.endDate && p.startDate <= dateStr && dateStr <= p.endDate);

            if (hasPastPeriod && !isInAnyPeriod) {
                hasChanged = true;
                return { ...student, status: 'attending' };
            }
            return student;
        });

        if (hasChanged) {
            this.saveDB();
            this.notify('STUDENTS_CHANGED', this.db.students);
        }
    },

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
        this.autoAttendingReturnFromLeave();
        if (!this.db.students) this.db.students = [];
        return this.db.students.filter(s => !s.isDeleted);
    },

    getStudent(id) {
        this.autoAttendingReturnFromLeave();
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
    },

    // --- ENROLLMENT ADAPTER METHODS (Phase 18B-7) ---
    getLegacyEnrollmentFromStudent(student) {
        if (!student) return null;
        return {
            id: `legacy-${student.id}`,
            studentId: student.id,
            subject: student.instrument || '',
            instrument: student.instrument || '',
            teacherId: student.teacherId || '',
            billingType: 'monthly',
            fee: Number(student.fee || 0),
            dueDay: student.dueDay || null,
            defaultClassDuration: student.defaultClassDuration || 50,
            status: student.status || 'attending',
            source: 'legacy',
            isLegacy: true
        };
    },

    getStudentEnrollments(studentId, options = {}) {
        const student = this.getStudent(studentId);
        if (!student) return [];

        this.ensureEnrollmentsCollection();

        const allEnrollments = this.db.enrollments.filter(e => e.studentId === studentId);

        if (allEnrollments.length > 0) {
            if (options.includeArchived) {
                return allEnrollments;
            }
            return allEnrollments.filter(e => e.status !== 'archived' && !e.deletedAt);
        }

        const legacy = this.getLegacyEnrollmentFromStudent(student);
        return legacy ? [legacy] : [];
    },

    getPrimaryEnrollment(studentId) {
        const enrollments = this.getStudentEnrollments(studentId);
        if (enrollments.length === 0) return null;

        const sorted = [...enrollments].sort((a, b) => {
            const aIsAttendingMonthly = a.status === 'attending' && a.courseType === 'monthly';
            const bIsAttendingMonthly = b.status === 'attending' && b.courseType === 'monthly';

            if (aIsAttendingMonthly && !bIsAttendingMonthly) return -1;
            if (!aIsAttendingMonthly && bIsAttendingMonthly) return 1;

            const aStartDate = a.startDate || '';
            const bStartDate = b.startDate || '';
            if (aStartDate !== bStartDate) {
                return bStartDate.localeCompare(aStartDate);
            }

            const aCreatedAt = a.createdAt || '';
            const bCreatedAt = b.createdAt || '';
            return bCreatedAt.localeCompare(aCreatedAt);
        });

        return sorted[0];
    },

    ensureEnrollmentsCollection() {
        if (!this.db) return;
        if (!this.db.enrollments) {
            this.db.enrollments = [];
        }
    },

    createEnrollment(studentId, payload) {
        this.ensureEnrollmentsCollection();

        let maxNum = 0;
        this.db.enrollments.forEach(e => {
            if (typeof e.id === 'string' && e.id.startsWith('ENR_')) {
                const num = parseInt(e.id.substring(4), 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        const newId = `ENR_${maxNum + 1}`;

        const courseType = payload.courseType === 'session_pass' ? 'session_pass' : 'monthly';

        const newEnrollment = {
            id: newId,
            studentId: studentId,
            source: 'manual',
            status: payload.status || 'attending',
            courseType: courseType,
            subjectName: payload.subjectName || payload.subject || '',
            instrument: payload.instrument || payload.subject || '',
            className: payload.className || '',
            level: payload.level || '',
            teacherId: payload.teacherId || '',
            startDate: payload.startDate || new Date().toISOString().slice(0, 10),
            endDate: payload.endDate || null,
            defaultWeekday: payload.defaultWeekday || '',
            defaultStartTime: payload.defaultStartTime || '',
            defaultDurationMinutes: parseInt(payload.defaultDurationMinutes || payload.defaultClassDuration, 10) || 50,
            fee: Number(payload.fee || 0),
            dueDay: payload.dueDay !== undefined ? Number(payload.dueDay) : 1,
            firstBillingMonth: payload.firstBillingMonth || '',
            autoBilling: payload.autoBilling !== undefined ? payload.autoBilling : true,
            pauseBillingOnLeave: payload.pauseBillingOnLeave !== undefined ? payload.pauseBillingOnLeave : true,
            memo: payload.memo || '',
            ...payload,
            id: newId,
            studentId: studentId,
            source: 'manual',
            courseType: courseType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.db.enrollments.push(newEnrollment);

        this.syncStudentFlatFieldsFromPrimaryEnrollment(studentId);

        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);

        return { ok: true, data: newEnrollment };
    },

    updateEnrollment(enrollmentId, patch) {
        this.ensureEnrollmentsCollection();

        if (typeof enrollmentId === 'string' && enrollmentId.startsWith('legacy-')) {
            return { ok: false, reason: 'legacy_readonly' };
        }

        const enrollment = this.db.enrollments.find(e => e.id === enrollmentId);
        if (!enrollment) {
            return { ok: false, reason: 'not_found' };
        }
        if (enrollment.source === 'legacy') {
            return { ok: false, reason: 'legacy_readonly' };
        }

        Object.keys(patch).forEach(key => {
            if (key !== 'id' && key !== 'studentId' && key !== 'source') {
                enrollment[key] = patch[key];
            }
        });
        enrollment.updatedAt = new Date().toISOString();

        this.syncStudentFlatFieldsFromPrimaryEnrollment(enrollment.studentId);

        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);

        return { ok: true, data: enrollment };
    },

    deleteEnrollment(enrollmentId) {
        this.ensureEnrollmentsCollection();

        if (typeof enrollmentId === 'string' && enrollmentId.startsWith('legacy-')) {
            return { ok: false, reason: 'legacy_readonly' };
        }

        const enrollment = this.db.enrollments.find(e => e.id === enrollmentId);
        if (!enrollment) {
            return { ok: false, reason: 'not_found' };
        }
        if (enrollment.source === 'legacy') {
            return { ok: false, reason: 'legacy_readonly' };
        }

        enrollment.status = 'archived';
        enrollment.deletedAt = new Date().toISOString();
        enrollment.updatedAt = new Date().toISOString();

        this.syncStudentFlatFieldsFromPrimaryEnrollment(enrollment.studentId);

        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);

        return { ok: true };
    },

    syncStudentFlatFieldsFromPrimaryEnrollment(studentId) {
        if (!this.db || !this.db.students) return;

        const student = this.db.students.find(s => s.id === studentId);
        if (!student) return;

        const primary = this.getPrimaryEnrollment(studentId);
        if (!primary) {
            return;
        }

        student.instrument = primary.instrument || primary.subjectName || '';
        student.className = primary.className || '';
        student.classGroup = primary.className || '';
        student.teacherId = primary.teacherId || '';
        student.fee = Number(primary.fee || 0);
        student.dueDay = primary.dueDay !== undefined ? Number(primary.dueDay) : null;
        student.defaultClassDuration = primary.defaultDurationMinutes || primary.defaultClassDuration || 50;
    },

    getEnrollmentById(enrollmentId) {
        if (!enrollmentId) return null;
        
        if (enrollmentId.startsWith('legacy-')) {
            const studentId = enrollmentId.substring(7);
            const student = this.getStudent(studentId);
            return this.getLegacyEnrollmentFromStudent(student);
        }
        
        if (this.db && Array.isArray(this.db.enrollments)) {
            return this.db.enrollments.find(e => e.id === enrollmentId) || null;
        }
        
        return null;
    },

    formatEnrollmentTeacherName(enrollment) {
        if (!enrollment || !enrollment.teacherId) return '-';
        
        const teachers = typeof this.getTeachers === 'function' ? this.getTeachers() : (this.db && this.db.teachers || []);
        const teacher = teachers.find(t => t.id === enrollment.teacherId);
        if (!teacher) return '-';
        
        const name = teacher.name || '';
        if (name.endsWith('T')) return name;
        return `${name}T`;
    },

    isEnrollmentActive(enrollment) {
        if (!enrollment) return false;
        const status = enrollment.status;
        if (status === undefined || status === 'attending') return true;
        return false;
    }
};
