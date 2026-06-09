// majorSchedule.js - Major Schedule Domain State Module

export const majorScheduleMethods = {
    getMajorSchedules() {
        if (!this.db.majorSchedules) {
            this.db.majorSchedules = [];
        }
        return this.db.majorSchedules;
    },

    addMajorSchedule(payload) {
        if (!this.db.majorSchedules) {
            this.db.majorSchedules = [];
        }

        // Validate mandatory fields
        const required = ['name', 'type', 'eventDate', 'ownerId'];
        for (const field of required) {
            if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
                throw new Error(`Required field [${field}] missing`);
            }
        }

        // Build clean event object, omitting non-database fields (like status/openCount)
        const id = 'ev-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const newEvent = {
            id,
            name: String(payload.name).trim(),
            type: String(payload.type).trim(),
            eventDate: String(payload.eventDate).trim(),
            dueDate: payload.dueDate ? String(payload.dueDate).trim() : null,
            ownerId: String(payload.ownerId).trim(),
            place: payload.place ? String(payload.place).trim() : null,
            visible: payload.visible !== undefined ? Boolean(payload.visible) : false,
            memo: payload.memo ? String(payload.memo).trim() : null,
            participantStudentIds: Array.isArray(payload.participantStudentIds) ? [...payload.participantStudentIds] : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.db.majorSchedules.push(newEvent);
        this.saveDB();
        this.notify('MAJOR_SCHEDULES_CHANGED', newEvent);
        return newEvent;
    },

    updateMajorSchedule(eventId, patch) {
        if (!this.db.majorSchedules) {
            this.db.majorSchedules = [];
        }

        const index = this.db.majorSchedules.findIndex(e => e.id === eventId);
        if (index === -1) {
            throw new Error(`Major schedule not found for ID: ${eventId}`);
        }

        const current = this.db.majorSchedules[index];
        
        // Merge allowed patch fields, explicitly omitting non-database fields
        const allowed = ['name', 'type', 'eventDate', 'dueDate', 'ownerId', 'place', 'visible', 'memo', 'participantStudentIds'];
        const merged = { ...current };

        allowed.forEach(field => {
            if (patch[field] !== undefined) {
                if (field === 'participantStudentIds') {
                    merged[field] = Array.isArray(patch[field]) ? [...patch[field]] : [];
                } else if (field === 'visible') {
                    merged[field] = Boolean(patch[field]);
                } else {
                    merged[field] = patch[field] !== null ? String(patch[field]).trim() : null;
                }
            }
        });

        merged.updatedAt = new Date().toISOString();

        this.db.majorSchedules[index] = merged;
        this.saveDB();
        this.notify('MAJOR_SCHEDULES_CHANGED', merged);
        return merged;
    },

    deleteMajorSchedule(eventId) {
        if (!this.db.majorSchedules) {
            this.db.majorSchedules = [];
            return false;
        }

        const initialLength = this.db.majorSchedules.length;
        this.db.majorSchedules = this.db.majorSchedules.filter(e => e.id !== eventId);
        
        if (this.db.majorSchedules.length < initialLength) {
            this.saveDB();
            this.notify('MAJOR_SCHEDULES_CHANGED', { id: eventId, deleted: true });
            return true;
        }
        return false;
    }
};
