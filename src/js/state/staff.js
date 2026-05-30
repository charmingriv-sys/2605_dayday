// staff.js - Teachers, Instructors, Shifts schedules Domain State Module

export const staffMethods = {
    // --- TEACHERS ---
    getTeachers() {
        return this.db.teachers;
    },

    getTeacher(id) {
        return this.db.teachers.find(t => t.id === id);
    },

    addTeacher(teacher) {
        const id = 'T' + (Math.max(...this.db.teachers.map(t => parseInt(t.id.slice(1)) || 0)) + 1);
        const newTeacher = { id, ...teacher };
        this.db.teachers.push(newTeacher);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
        return newTeacher;
    },

    updateTeacher(id, data) {
        this.db.teachers = this.db.teachers.map(t => t.id === id ? { ...t, ...data } : t);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
    },

    deleteTeacher(id) {
        this.db.teachers = this.db.teachers.filter(t => t.id !== id);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
    },

    // --- TEACHER SHIFTS ---
    getTeacherShifts() {
        if (!this.db.teacherShifts) {
            this.db.teacherShifts = [];
        }
        return this.db.teacherShifts;
    },

    getShiftsForTeacher(teacherId) {
        return this.getTeacherShifts().filter(ts => ts.teacherId === teacherId);
    },

    saveTeacherShift(teacherId, date, slots) {
        if (!this.db.teacherShifts) {
            this.db.teacherShifts = [];
        }
        // Remove existing record for this teacher and date if it exists
        this.db.teacherShifts = this.db.teacherShifts.filter(ts => !(ts.teacherId === teacherId && ts.date === date));
        
        // Add new record if there are active slots
        if (slots && slots.length > 0) {
            const id = 'TS' + (this.db.teacherShifts.length ? Math.max(...this.db.teacherShifts.map(ts => parseInt(ts.id.slice(2)) || 0)) + 1 : 1);
            this.db.teacherShifts.push({ id, teacherId, date, slots });
        }

        this.saveDB();
        this.notify('SHIFTS_CHANGED', this.db.teacherShifts);
    }
};
