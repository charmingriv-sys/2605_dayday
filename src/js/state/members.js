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

        if (Array.isArray(classSchedules)) {
            // Determine enrollmentId
            let enrollmentId = data.enrollmentId || updatedData.enrollmentId;
            let primaryEnrollment = null;
            if (!enrollmentId && typeof this.getPrimaryEnrollment === 'function') {
                primaryEnrollment = this.getPrimaryEnrollment(id);
                if (primaryEnrollment) {
                    enrollmentId = primaryEnrollment.id;
                }
            } else if (enrollmentId && typeof this.getEnrollmentById === 'function') {
                primaryEnrollment = this.getEnrollmentById(enrollmentId);
            }

            const isManualEnrollment = primaryEnrollment && (primaryEnrollment.source === 'manual' || !primaryEnrollment.isLegacy);
            const isLegacyId = typeof enrollmentId === 'string' && enrollmentId.startsWith('legacy-');

            if (enrollmentId && isManualEnrollment && !isLegacyId) {
                if (typeof this.replaceClassesForEnrollment === 'function') {
                    const payload = classSchedules.map(sch => ({
                        dayOfWeek: sch.dayOfWeek,
                        time: sch.time,
                        durationMinutes: sch.durationMinutes !== undefined ? sch.durationMinutes : undefined,
                        teacherId: sch.teacherId !== undefined ? sch.teacherId : undefined
                    }));
                    this.replaceClassesForEnrollment(enrollmentId, payload);
                }
            } else {
                // legacy fallback path
                // Remove ONLY legacy classes (c.studentId === id && !c.enrollmentId)
                this.db.classes = this.db.classes.filter(c => {
                    if (c.studentId === id && !c.enrollmentId) {
                        return false; // delete legacy class
                    }
                    return true; // retain all other classes
                });

                // Insert new legacy classes
                classSchedules.forEach(schedule => {
                    let maxNum = 0;
                    let hasValidNum = false;
                    if (this.db && Array.isArray(this.db.classes)) {
                        this.db.classes.forEach(c => {
                            if (typeof c.id === 'string' && c.id.startsWith('C')) {
                                const num = parseInt(c.id.substring(1), 10);
                                if (!isNaN(num)) {
                                    hasValidNum = true;
                                    if (num > maxNum) {
                                        maxNum = num;
                                    }
                                }
                            }
                        });
                    }
                    const newId = hasValidNum ? `C${maxNum + 1}` : `C_${Date.now()}`;
                    
                    const newLegacyClass = {
                        id: newId,
                        studentId: id,
                        dayOfWeek: schedule.dayOfWeek,
                        time: schedule.time
                    };

                    if (schedule.durationMinutes !== undefined) {
                        newLegacyClass.durationMinutes = Number(schedule.durationMinutes);
                    }
                    if (schedule.teacherId !== undefined) {
                        newLegacyClass.teacherId = schedule.teacherId;
                    }

                    this.db.classes.push(newLegacyClass);
                });

                this.saveDB();
                this.notify('CLASSES_CHANGED', this.db.classes);
            }
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

    applyCourseToStudent(studentId, courseId, options = {}) {
        const student = this.getStudent(studentId);
        if (!student) {
            return { ok: false, reason: 'student_not_found' };
        }
        
        const course = typeof this.getCourseMasterById === 'function' ? this.getCourseMasterById(courseId) : null;
        if (!course || course.status !== 'active') {
            return { ok: false, reason: 'course_not_found' };
        }

        const warnings = [];
        let enrollment = null;
        let sessionPass = null;
        let classRecord = null;
        let payment = null;

        const enrollmentPayload = {
            status: options.status || 'attending',
            courseType: course.courseType,
            subjectName: course.subjectName,
            instrument: course.subjectName,
            className: options.className || '',
            level: options.level || '',
            teacherId: options.teacherId || '',
            startDate: options.startDate || new Date().toISOString().slice(0, 10),
            endDate: options.endDate || null,
            defaultWeekday: options.dayOfWeek || '',
            defaultStartTime: options.time || '',
            defaultDurationMinutes: options.durationMinutesOverride !== undefined ? Number(options.durationMinutesOverride) : course.defaultDurationMinutes,
            fee: options.feeOverride !== undefined ? Number(options.feeOverride) : course.defaultFee,
            dueDay: course.courseType === 'monthly' ? (options.dueDayOverride !== undefined ? Number(options.dueDayOverride) : (course.defaultDueDay || 10)) : null,
            courseId: courseId,
            autoBilling: options.autoBilling !== undefined ? options.autoBilling : true,
            pauseBillingOnLeave: options.pauseBillingOnLeave !== undefined ? options.pauseBillingOnLeave : true,
            memo: options.memo || ''
        };

        const enrollmentResult = this.createEnrollment(studentId, enrollmentPayload);
        if (!enrollmentResult || !enrollmentResult.ok) {
            return { ok: false, reason: 'enrollment_creation_failed' };
        }
        enrollment = enrollmentResult.data;

        if (course.courseType === 'session_pass') {
            try {
                const total = options.totalSessionsOverride !== undefined ? Number(options.totalSessionsOverride) : (course.defaultTotalSessions || 10);
                const remaining = options.remainingSessionsOverride !== undefined ? Number(options.remainingSessionsOverride) : total;
                const amount = options.feeOverride !== undefined ? Number(options.feeOverride) : course.defaultFee;
                const threshold = course.defaultLowBalanceThreshold !== undefined ? course.defaultLowBalanceThreshold : 2;
                const purchaseDate = options.startDate || new Date().toISOString().slice(0, 10);
                const expiresAt = options.expiresAtOverride || null;

                const passPayload = {
                    passName: course.name,
                    totalSessions: total,
                    remainingSessions: remaining,
                    purchaseAmount: amount,
                    purchaseDate: purchaseDate,
                    expiresAt: expiresAt,
                    lowBalanceThreshold: threshold
                };

                const passResult = this.createSessionPass(enrollment.id, passPayload);
                if (passResult && passResult.ok) {
                    sessionPass = passResult.data;
                } else {
                    warnings.push(passResult ? passResult.reason : 'session_pass_creation_failed');
                }
            } catch (err) {
                warnings.push('session_pass_creation_failed');
            }
        }

        if (options.dayOfWeek && options.time) {
            try {
                if (typeof this.createClassForEnrollment === 'function') {
                    const classPayload = {
                        dayOfWeek: options.dayOfWeek,
                        time: options.time,
                        teacherId: options.teacherId || enrollment.teacherId || '',
                        durationMinutes: enrollment.defaultDurationMinutes
                    };
                    const classResult = this.createClassForEnrollment(enrollment.id, classPayload);
                    if (classResult && classResult.ok) {
                        classRecord = classResult.data;
                    } else {
                        warnings.push(classResult ? classResult.reason : 'class_creation_failed');
                    }
                } else {
                    warnings.push('createClassForEnrollment_helper_not_found');
                }
            } catch (err) {
                warnings.push('class_creation_failed');
            }
        }

        const paymentStatus = options.paymentStatus || 'none';
        if (paymentStatus === 'unpaid' || paymentStatus === 'paid') {
            try {
                const amount = options.feeOverride !== undefined ? Number(options.feeOverride) : course.defaultFee;
                const month = options.paymentMonth || (options.startDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
                const invoiceDate = options.startDate || new Date().toISOString().slice(0, 10);

                if (!this.db.payments) {
                    this.db.payments = [];
                }
                const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
                
                const newPayment = {
                    id: payId,
                    studentId: studentId,
                    amount: amount,
                    month: month,
                    type: 'education',
                    status: paymentStatus,
                    invoiceDate: invoiceDate,
                    paidDate: paymentStatus === 'paid' ? invoiceDate : null,
                    method: paymentStatus === 'paid' ? (options.paymentMethod || 'cash') : null,
                    enrollmentId: enrollment.id,
                    courseId: courseId,
                    sessionPassId: sessionPass ? sessionPass.id : null
                };

                this.db.payments.push(newPayment);
                payment = newPayment;
                
                this.saveDB();
                this.notify('PAYMENTS_CHANGED', this.db.payments);
            } catch (err) {
                warnings.push('payment_creation_failed');
            }
        }

        try {
            this.syncStudentFlatFieldsFromPrimaryEnrollment(studentId);
            this.saveDB();
            this.notify('STUDENTS_CHANGED', this.db.students);
        } catch (err) {
            warnings.push('student_flat_fields_sync_failed');
        }

        return {
            ok: true,
            data: {
                enrollment,
                sessionPass,
                classRecord,
                payment,
                warnings
            }
        };
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
    },

    // --- SESSION PASSES Storage API (Phase 18B-25) ---
    ensureSessionPassesCollection() {
        if (!this.db) return;
        if (!this.db.sessionPasses) {
            this.db.sessionPasses = [];
        }
    },

    validateSessionPassPayload(payload) {
        const total = Number(payload.totalSessions);
        const remaining = Number(payload.remainingSessions);
        const amount = Number(payload.purchaseAmount);
        const threshold = Number(payload.lowBalanceThreshold);
        
        if (isNaN(total) || total < 1) return { ok: false, reason: 'invalid_total_sessions' };
        if (isNaN(remaining) || remaining < 0) return { ok: false, reason: 'invalid_remaining_sessions' };
        if (remaining > total) return { ok: false, reason: 'remaining_greater_than_total' };
        if (isNaN(amount) || amount < 0) return { ok: false, reason: 'invalid_purchase_amount' };
        if (isNaN(threshold) || threshold < 0) return { ok: false, reason: 'invalid_threshold' };
        if (threshold > total) return { ok: false, reason: 'threshold_greater_than_total' };
        
        if (payload.expiresAt && payload.purchaseDate) {
            if (payload.expiresAt < payload.purchaseDate) {
                return { ok: false, reason: 'expires_before_purchase' };
            }
        }
        return { ok: true };
    },

    createSessionPass(enrollmentId, payload) {
        this.ensureSessionPassesCollection();

        const enrollment = this.getEnrollmentById(enrollmentId);
        if (!enrollment || enrollment.source === 'legacy' || enrollment.isLegacy || (typeof enrollmentId === 'string' && enrollmentId.startsWith('legacy-'))) {
            return { ok: false, reason: 'invalid_enrollment' };
        }

        if (enrollment.courseType !== 'session_pass') {
            return { ok: false, reason: 'not_session_pass_enrollment' };
        }

        const val = this.validateSessionPassPayload(payload);
        if (!val.ok) return val;

        let maxNum = 0;
        this.db.sessionPasses.forEach(sp => {
            if (typeof sp.id === 'string' && sp.id.startsWith('SP_')) {
                const num = parseInt(sp.id.substring(3), 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        const newId = `SP_${maxNum + 1}`;

        const newPass = {
            id: newId,
            enrollmentId: enrollmentId,
            studentId: enrollment.studentId,
            passName: payload.passName || payload.ticketName || '수강권',
            totalSessions: Number(payload.totalSessions),
            remainingSessions: Number(payload.remainingSessions),
            purchaseAmount: Number(payload.purchaseAmount),
            purchaseDate: payload.purchaseDate || new Date().toISOString().slice(0, 10),
            expiresAt: payload.expiresAt || null,
            lowBalanceThreshold: Number(payload.lowBalanceThreshold !== undefined ? payload.lowBalanceThreshold : 2),
            deductionPolicy: 'attendance',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // status recalculation during creation if expired or used_up
        const todayStr = new Date().toISOString().slice(0, 10);
        if (newPass.remainingSessions <= 0) {
            newPass.status = 'used_up';
        } else if (newPass.expiresAt && newPass.expiresAt < todayStr) {
            newPass.status = 'expired';
        }

        this.db.sessionPasses.push(newPass);
        this.saveDB();
        this.notify('SESSION_PASSES_CHANGED', this.db.sessionPasses);

        return { ok: true, data: newPass };
    },

    getSessionPassesByEnrollmentId(enrollmentId, options = {}) {
        this.ensureSessionPassesCollection();

        let list = this.db.sessionPasses.filter(sp => sp.enrollmentId === enrollmentId);

        // archived filtering
        if (!options.includeArchived) {
            list = list.filter(sp => sp.status !== 'archived' && !sp.deletedAt);
        }

        // inactive filtering
        if (!options.includeInactive) {
            list = list.filter(sp => sp.status === 'active');
        }

        // sorting: expiresAt ascending (null at end) -> purchaseDate ascending -> createdAt ascending
        list.sort((a, b) => {
            const aExp = a.expiresAt || '';
            const bExp = b.expiresAt || '';
            if (aExp && bExp) {
                const comp = aExp.localeCompare(bExp);
                if (comp !== 0) return comp;
            } else if (aExp) {
                return -1;
            } else if (bExp) {
                return 1;
            }

            const aPur = a.purchaseDate || '';
            const bPur = b.purchaseDate || '';
            const compPur = aPur.localeCompare(bPur);
            if (compPur !== 0) return compPur;

            const aCre = a.createdAt || '';
            const bCre = b.createdAt || '';
            return aCre.localeCompare(bCre);
        });

        return list;
    },

    getActiveSessionPassForEnrollment(enrollmentId) {
        const activePasses = this.getSessionPassesByEnrollmentId(enrollmentId, { includeInactive: false })
            .filter(sp => sp.remainingSessions > 0);
        return activePasses.length > 0 ? activePasses[0] : null;
    },

    updateSessionPass(passId, patch) {
        this.ensureSessionPassesCollection();

        const pass = this.db.sessionPasses.find(sp => sp.id === passId);
        if (!pass) {
            return { ok: false, reason: 'not_found' };
        }

        // Apply patch
        Object.keys(patch).forEach(key => {
            if (key !== 'id' && key !== 'enrollmentId' && key !== 'studentId') {
                pass[key] = patch[key];
            }
        });

        // Recalculate status with priority: archived -> used_up -> expired -> active
        if (pass.status !== 'archived') {
            const todayStr = new Date().toISOString().slice(0, 10);
            if (Number(pass.remainingSessions) <= 0) {
                pass.status = 'used_up';
            } else if (pass.expiresAt && pass.expiresAt < todayStr) {
                pass.status = 'expired';
            } else {
                pass.status = 'active';
            }
        }

        pass.updatedAt = new Date().toISOString();
        this.saveDB();
        this.notify('SESSION_PASSES_CHANGED', this.db.sessionPasses);

        return { ok: true, data: pass };
    },

    archiveSessionPass(passId, memo = '') {
        this.ensureSessionPassesCollection();

        const pass = this.db.sessionPasses.find(sp => sp.id === passId);
        if (!pass) {
            return { ok: false, reason: 'not_found' };
        }

        if (pass.status === 'archived') {
            return { ok: true, data: pass }; // no-op
        }

        pass.status = 'archived';
        pass.deletedAt = new Date().toISOString();
        pass.updatedAt = new Date().toISOString();

        // 수동 보관 로그 생성 (createSessionPassLog 내에서 saveDB() 호출하므로, pass.status 변경사항이 자동 저장됨)
        const log = this.createSessionPassLog({
            passId: pass.id,
            enrollmentId: pass.enrollmentId,
            studentId: pass.studentId,
            delta: 0,
            reason: 'manual_archive',
            memo: memo || ''
        });

        this.notify('SESSION_PASSES_CHANGED', this.db.sessionPasses);

        if (typeof this.syncSystemRecommendations === 'function') {
            this.syncSystemRecommendations(new Date(), true);
        }

        return { ok: true, data: pass, log };
    },

    adjustSessionPassManually(passId, patch) {
        if (!passId) {
            return { ok: false, reason: 'no_pass_id' };
        }
        if (!patch || !patch.memo || typeof patch.memo !== 'string' || !patch.memo.trim()) {
            return { ok: false, reason: 'memo_required' };
        }

        this.ensureSessionPassesCollection();
        const pass = this.db.sessionPasses.find(sp => sp.id === passId);
        if (!pass) {
            return { ok: false, reason: 'pass_not_found' };
        }

        if (pass.status === 'archived') {
            return { ok: false, reason: 'archived_pass_cannot_be_modified' };
        }

        // remainingSessions validation
        if (patch.remainingSessions !== undefined) {
            const rem = Number(patch.remainingSessions);
            if (isNaN(rem) || rem < 0) {
                return { ok: false, reason: 'invalid_remaining_sessions' };
            }
            if (rem > pass.totalSessions) {
                return { ok: false, reason: 'remaining_sessions_cannot_exceed_total_sessions' };
            }
        }

        // expiresAt validation
        if (patch.expiresAt !== undefined && patch.expiresAt !== null) {
            if (typeof patch.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(patch.expiresAt)) {
                return { ok: false, reason: 'invalid_expires_at_format' };
            }
            if (isNaN(Date.parse(patch.expiresAt))) {
                return { ok: false, reason: 'invalid_expires_at' };
            }
        }

        const prevRemaining = pass.remainingSessions;
        const prevExpiresAt = pass.expiresAt;

        if (patch.remainingSessions !== undefined) {
            pass.remainingSessions = Number(patch.remainingSessions);
        }
        if (patch.expiresAt !== undefined) {
            pass.expiresAt = patch.expiresAt;
        }

        // Recalculate status
        const todayStr = new Date().toISOString().slice(0, 10);
        if (pass.remainingSessions <= 0) {
            pass.status = 'used_up';
        } else if (pass.expiresAt && pass.expiresAt < todayStr) {
            pass.status = 'expired';
        } else {
            pass.status = 'active';
        }

        const delta = (patch.remainingSessions !== undefined) ? (pass.remainingSessions - prevRemaining) : 0;
        pass.updatedAt = new Date().toISOString();

        // Log manual adjustment (createSessionPassLog 내에서 saveDB()가 호출되므로, pass의 상태 변경 내역도 자동 동시 저장됨)
        const log = this.createSessionPassLog({
            passId: pass.id,
            enrollmentId: pass.enrollmentId,
            studentId: pass.studentId,
            delta: delta,
            reason: 'manual_adjustment',
            memo: patch.memo,
            prevRemainingSessions: prevRemaining,
            postRemainingSessions: pass.remainingSessions,
            prevExpiresAt: prevExpiresAt,
            postExpiresAt: pass.expiresAt
        });

        this.notify('SESSION_PASSES_CHANGED', this.db.sessionPasses);

        if (typeof this.syncSystemRecommendations === 'function') {
            this.syncSystemRecommendations(new Date(), true);
        }

        return { ok: true, data: pass, log };
    },

    extendSessionPass(passId, expiresAt, memo) {
        return this.adjustSessionPassManually(passId, { expiresAt, memo });
    },

    rechargeSessionPass(enrollmentId, payload) {
        if (!enrollmentId) {
            return { ok: false, reason: 'no_enrollment_id' };
        }
        if (!payload || !payload.memo || typeof payload.memo !== 'string' || !payload.memo.trim()) {
            return { ok: false, reason: 'memo_required' };
        }

        const enrollment = this.getEnrollmentById(enrollmentId);
        if (!enrollment) {
            return { ok: false, reason: 'enrollment_not_found' };
        }
        if (enrollment.courseType !== 'session_pass') {
            return { ok: false, reason: 'not_session_pass_enrollment' };
        }

        // Validations for total/remaining sessions
        const total = Number(payload.totalSessions);
        const remaining = Number(payload.remainingSessions);
        if (isNaN(total) || total < 1) {
            return { ok: false, reason: 'invalid_total_sessions' };
        }
        if (isNaN(remaining) || remaining < 0) {
            return { ok: false, reason: 'invalid_remaining_sessions' };
        }
        if (remaining > total) {
            return { ok: false, reason: 'remaining_greater_than_total' };
        }

        // Validate expiresAt format/validity
        if (payload.expiresAt !== undefined && payload.expiresAt !== null) {
            if (typeof payload.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.expiresAt)) {
                return { ok: false, reason: 'invalid_expires_at_format' };
            }
            if (isNaN(Date.parse(payload.expiresAt))) {
                return { ok: false, reason: 'invalid_expires_at' };
            }
        }

        // Call existing createSessionPass
        const res = this.createSessionPass(enrollmentId, payload);
        if (!res.ok) return res;

        const newPass = res.data;

        // Log manual recharge
        const log = this.createSessionPassLog({
            passId: newPass.id,
            enrollmentId: enrollmentId,
            studentId: newPass.studentId,
            delta: newPass.remainingSessions,
            reason: 'manual_recharge',
            memo: payload.memo,
            totalSessions: newPass.totalSessions,
            remainingSessions: newPass.remainingSessions,
            postRemainingSessions: newPass.remainingSessions
        });

        if (typeof this.syncSystemRecommendations === 'function') {
            this.syncSystemRecommendations(new Date(), true);
        }

        return { ok: true, data: newPass, log };
    },

    migrateSessionPassFromEnrollment(enrollmentId) {
        const enrollment = this.getEnrollmentById(enrollmentId);
        if (!enrollment || enrollment.source === 'legacy' || enrollment.isLegacy || (typeof enrollmentId === 'string' && enrollmentId.startsWith('legacy-'))) {
            return { ok: false, reason: 'invalid_enrollment' };
        }

        if (enrollment.courseType !== 'session_pass') {
            return { ok: false, reason: 'not_session_pass_enrollment' };
        }

        // Check if there is an existing sessionPass
        const existing = this.getSessionPassesByEnrollmentId(enrollmentId, { includeInactive: true, includeArchived: true });
        if (existing.length > 0) {
            return { ok: true, data: existing[0] };
        }

        const payload = {
            passName: enrollment.ticketName || enrollment.subjectName || '수강권',
            totalSessions: enrollment.totalSessions !== undefined ? enrollment.totalSessions : 1,
            remainingSessions: enrollment.remainingSessions !== undefined ? enrollment.remainingSessions : 1,
            purchaseAmount: enrollment.purchaseAmount !== undefined ? enrollment.purchaseAmount : 0,
            purchaseDate: enrollment.purchaseDate || new Date().toISOString().slice(0, 10),
            expiresAt: enrollment.expiresAt || null,
            lowBalanceThreshold: enrollment.lowBalanceThreshold !== undefined ? enrollment.lowBalanceThreshold : 2
        };

        const res = this.createSessionPass(enrollmentId, payload);
        return res;
    },

    getSessionPassSummaryForEnrollment(enrollmentId) {
        this.ensureSessionPassesCollection();

        // 1. archived 및 deletedAt 패스는 제외
        const validPasses = this.db.sessionPasses.filter(sp => 
            sp.enrollmentId === enrollmentId && 
            sp.status !== 'archived' && 
            !sp.deletedAt
        );

        if (validPasses.length === 0) return null;

        // 2. Active Pass 선택 (FIFO 기준)
        const activePasses = validPasses.filter(sp => sp.status === 'active' && sp.remainingSessions > 0);
        
        let pass = null;
        if (activePasses.length > 0) {
            // FIFO 정렬: expiresAt 오름차순(null 뒤로) -> purchaseDate 오름차순 -> createdAt 오름차순
            activePasses.sort((a, b) => {
                const aExp = a.expiresAt || '';
                const bExp = b.expiresAt || '';
                if (aExp && bExp) {
                    const comp = aExp.localeCompare(bExp);
                    if (comp !== 0) return comp;
                } else if (aExp) {
                    return -1;
                } else if (bExp) {
                    return 1;
                }

                const aPur = a.purchaseDate || '';
                const bPur = b.purchaseDate || '';
                const compPur = aPur.localeCompare(bPur);
                if (compPur !== 0) return compPur;

                const aCre = a.createdAt || '';
                const bCre = b.createdAt || '';
                return aCre.localeCompare(bCre);
            });
            pass = activePasses[0];
        }

        // 3. Fallback Pass 선택 (최신 이력 기준)
        if (!pass) {
            const fallbackPasses = validPasses.filter(sp => sp.status === 'used_up' || sp.status === 'expired');
            if (fallbackPasses.length > 0) {
                // 최신 이력 기준: purchaseDate 내림차순 -> createdAt 내림차순
                fallbackPasses.sort((a, b) => {
                    const aPur = a.purchaseDate || '';
                    const bPur = b.purchaseDate || '';
                    const compPur = bPur.localeCompare(aPur); // 내림차순
                    if (compPur !== 0) return compPur;

                    const aCre = a.createdAt || '';
                    const bCre = b.createdAt || '';
                    return bCre.localeCompare(aCre); // 내림차순
                });
                pass = fallbackPasses[0];
            }
        }

        if (!pass) return null;

        // 4. 상태 정의
        const isEmpty = pass.remainingSessions === 0 || pass.status === 'used_up';
        const isExpired = pass.status === 'expired';
        const isLowBalance = pass.status === 'active' && pass.remainingSessions > 0 && pass.remainingSessions <= pass.lowBalanceThreshold;

        return {
            totalSessions: pass.totalSessions !== undefined ? pass.totalSessions : 10,
            remainingSessions: pass.remainingSessions !== undefined ? pass.remainingSessions : 10,
            lowBalanceThreshold: pass.lowBalanceThreshold !== undefined ? pass.lowBalanceThreshold : 2,
            status: pass.status,
            passName: pass.passName || '수강권',
            expiresAt: pass.expiresAt || null,
            isEmpty,
            isExpired,
            isLowBalance
        };
    },

    // --- SESSION PASS DEDUCTION & REVERSAL ENGINE API (Phase 18B-32) ---
    ensureSessionPassLogsCollection() {
        if (!this.db) return;
        if (!this.db.sessionPassLogs) {
            this.db.sessionPassLogs = [];
        }
    },

    createSessionPassLog(payload) {
        this.ensureSessionPassLogsCollection();

        let maxNum = 0;
        let hasParsingError = false;
        this.db.sessionPassLogs.forEach(log => {
            if (typeof log.id === 'string' && log.id.startsWith('SPL_')) {
                const numStr = log.id.substring(4);
                const num = parseInt(numStr, 10);
                if (isNaN(num)) {
                    hasParsingError = true;
                } else if (num > maxNum) {
                    maxNum = num;
                }
            } else {
                hasParsingError = true;
            }
        });

        let newId;
        if (hasParsingError) {
            newId = `SPL_${Date.now()}`;
        } else {
            newId = `SPL_${maxNum + 1}`;
        }

        const log = {
            id: newId,
            passId: payload.passId,
            enrollmentId: payload.enrollmentId,
            studentId: payload.studentId,
            classId: payload.classId || null,
            attendanceId: payload.attendanceId || null,
            date: payload.date || null,
            time: payload.time || null,
            delta: Number(payload.delta !== undefined ? payload.delta : 0),
            reason: payload.reason || 'deduction',
            createdAt: payload.createdAt || new Date().toISOString(),
            // 수동 조정/충전/보관 필드 추가
            memo: payload.memo || null,
            prevRemainingSessions: payload.prevRemainingSessions !== undefined ? payload.prevRemainingSessions : null,
            postRemainingSessions: payload.postRemainingSessions !== undefined ? payload.postRemainingSessions : null,
            prevExpiresAt: payload.prevExpiresAt || null,
            postExpiresAt: payload.postExpiresAt || null,
            totalSessions: payload.totalSessions !== undefined ? payload.totalSessions : null,
            remainingSessions: payload.remainingSessions !== undefined ? payload.remainingSessions : null
        };

        this.db.sessionPassLogs.push(log);
        this.saveDB();
        this.notify('SESSION_PASS_LOGS_CHANGED', this.db.sessionPassLogs);
        return log;
    },

    deductSessionPassForAttendance(payload) {
        const { enrollmentId, studentId, classId, attendanceId, date, time, attendanceStatus } = payload;

        if (attendanceStatus !== 'present' && attendanceStatus !== 'late') {
            return { ok: false, reason: 'not_target_attendance_status' };
        }

        if (!enrollmentId) {
            return { ok: false, reason: 'no_enrollment_id' };
        }

        const enrollment = this.getEnrollmentById(enrollmentId);
        if (!enrollment || enrollment.source === 'legacy' || enrollment.isLegacy || (typeof enrollmentId === 'string' && enrollmentId.startsWith('legacy-'))) {
            return { ok: false, reason: 'invalid_enrollment' };
        }

        if (enrollment.courseType !== 'session_pass') {
            return { ok: false, reason: 'not_session_pass_enrollment' };
        }

        // 중복 차감 방지: deduction 로그 개수가 reversal 로그 개수보다 많으면 차단
        const logsForAttendance = this.getSessionPassLogsByAttendanceId(attendanceId);
        const deductionCount = logsForAttendance.filter(l => l.reason === 'deduction' && l.delta === -1).length;
        const reversalCount = logsForAttendance.filter(l => l.reason === 'reversal' && l.delta === 1).length;
        if (deductionCount > reversalCount) {
            return { ok: false, reason: 'already_deducted' };
        }

        // active sessionPass 중 remainingSessions > 0인 pass를 FIFO로 선택
        const activePasses = this.getSessionPassesByEnrollmentId(enrollmentId, { includeInactive: false })
            .filter(sp => sp.remainingSessions > 0);

        if (activePasses.length === 0) {
            return { ok: false, reason: 'no_active_pass' };
        }

        const pass = activePasses[0];

        // remainingSessions 1 감소 및 status 업데이트
        const updateRes = this.updateSessionPass(pass.id, { remainingSessions: pass.remainingSessions - 1 });
        if (!updateRes.ok) return updateRes;
        const updatedPass = updateRes.data;

        // 로그 적재
        const log = this.createSessionPassLog({
            passId: pass.id,
            enrollmentId,
            studentId,
            classId,
            attendanceId,
            date,
            time,
            delta: -1,
            reason: 'deduction'
        });

        return {
            ok: true,
            pass: updatedPass,
            log,
            deductedPassId: pass.id
        };
    },

    reverseSessionPassDeduction(payload) {
        const { deductedPassId, enrollmentId, studentId, classId, attendanceId, date, time } = payload;

        if (!deductedPassId) {
            return { ok: false, reason: 'no_deducted_pass_id' };
        }

        this.ensureSessionPassesCollection();
        const pass = this.db.sessionPasses.find(sp => sp.id === deductedPassId);
        if (!pass) {
            return { ok: false, reason: 'pass_not_found' };
        }

        // 중복 복원 방지: attendanceId가 존재하고, reversal 로그 개수가 deduction 로그 개수 이상이면 차단
        if (attendanceId) {
            const logsForAttendance = this.getSessionPassLogsByAttendanceId(attendanceId);
            const deductionCount = logsForAttendance.filter(l => l.reason === 'deduction' && l.delta === -1).length;
            const reversalCount = logsForAttendance.filter(l => l.reason === 'reversal' && l.delta === 1).length;
            if (reversalCount >= deductionCount) {
                return { ok: false, reason: 'already_reversed' };
            }
        }

        // remainingSessions 1 증가 및 status 업데이트
        const updateRes = this.updateSessionPass(pass.id, { remainingSessions: pass.remainingSessions + 1 });
        if (!updateRes.ok) return updateRes;
        const updatedPass = updateRes.data;

        // 로그 적재
        const log = this.createSessionPassLog({
            passId: pass.id,
            enrollmentId,
            studentId,
            classId,
            attendanceId,
            date,
            time,
            delta: 1,
            reason: 'reversal'
        });

        return {
            ok: true,
            pass: updatedPass,
            log,
            restoredPassId: pass.id
        };
    },

    getSessionPassLogsByAttendanceId(attendanceId) {
        this.ensureSessionPassLogsCollection();
        if (!attendanceId) return [];
        return this.db.sessionPassLogs
            .filter(log => log.attendanceId === attendanceId)
            .sort((a, b) => {
                const aCre = a.createdAt || '';
                const bCre = b.createdAt || '';
                return aCre.localeCompare(bCre);
            });
    },

    getSessionPassLogsByPassId(passId) {
        this.ensureSessionPassLogsCollection();
        if (!passId) return [];
        return this.db.sessionPassLogs
            .filter(log => log.passId === passId)
            .sort((a, b) => {
                const aCre = a.createdAt || '';
                const bCre = b.createdAt || '';
                return aCre.localeCompare(bCre);
            });
    }
};
