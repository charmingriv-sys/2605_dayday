// sessions.js - Class schedules, sessions Domain State Module

export const sessionsMethods = {
    // --- CLASSES ---
    getClasses() {
        return this.db.classes;
    },

    getClassesForStudent(studentId) {
        return this.db.classes.filter(c => c.studentId === studentId);
    }
};
