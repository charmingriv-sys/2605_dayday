import { DataAdapter } from './dataAdapter.js';

export class LocalStorageAdapter extends DataAdapter {
    constructor({ storageKey, defaultDB, storage } = {}) {
        super();
        this.storageKey = storageKey;
        this.defaultDB = defaultDB;
        this.storage = storage || (typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : undefined));
    }

    async initialize(context = {}) {
        // localStorage requires no connection setup, so no-op.
    }

    // --- Async DataAdapter API Implementations ---
    async loadSnapshot(context = {}) {
        return this.loadSnapshotSync(context);
    }

    async saveSnapshot(snapshot, context = {}) {
        this.saveSnapshotSync(snapshot, context);
    }

    async fetchAllDomainData(context = {}) {
        return this.loadSnapshot(context);
    }

    async persistDomain(domainName, domainData, context = {}) {
        const snapshot = await this.loadSnapshot(context);
        snapshot[domainName] = domainData;
        await this.saveSnapshot(snapshot, context);
    }

    /**
     * Operational Warning: Enforce audit logging capability in local simulation.
     */
    async writeAuditLog(context = {}, logData = {}) {
        const snapshot = await this.loadSnapshot(context);
        if (!snapshot.auditLogs) {
            snapshot.auditLogs = [];
        }
        snapshot.auditLogs.push({
            id: 'AUD_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            timestamp: new Date().toISOString(),
            actorUserId: context.authUserId || 'system',
            ...logData
        });
        await this.saveSnapshot(snapshot, context);
    }

    // --- Sync Compatibility API Methods (Enables zero-downtime View integration) ---
    loadSnapshotSync(context = {}) {
        // Redirection/session migration from Harmonia to Turing (v3 legacy)
        const oldStored = this.storage.getItem('harmonia_academy_db_v3');
        const stored = this.storage.getItem(this.storageKey);
        if (!stored && oldStored) {
            this.storage.setItem(this.storageKey, oldStored);
        }

        const oldUserId = this.storage.getItem('harmonia_user_id');
        if (oldUserId && !this.storage.getItem('turing_user_id')) {
            this.storage.setItem('turing_user_id', oldUserId);
        }
        const oldRole = this.storage.getItem('harmonia_role');
        if (oldRole && !this.storage.getItem('turing_role')) {
            this.storage.setItem('turing_role', oldRole);
        }

        const currentStored = this.storage.getItem(this.storageKey);
        if (currentStored) {
            try {
                const db = JSON.parse(currentStored);
                const migrated = this.normalizeSnapshot(db);
                if (migrated) {
                    this.saveSnapshotSync(db, context);
                }
                return db;
            } catch (e) {
                console.warn('Failed to parse or migrate DB. Reverting to fallback default data.', e);
                const fallback = JSON.parse(JSON.stringify(this.defaultDB));
                this.saveSnapshotSync(fallback, context);
                return fallback;
            }
        } else {
            const fallback = JSON.parse(JSON.stringify(this.defaultDB));
            this.saveSnapshotSync(fallback, context);
            return fallback;
        }
    }

    saveSnapshotSync(snapshot, context = {}) {
        this.storage.setItem(this.storageKey, JSON.stringify(snapshot));
    }

    // --- Normalization & Database Structure Migration Logic ---
    normalizeSnapshot(db) {
        let migrated = false;

        // Ensure users exist
        if (!db.users) {
            db.users = JSON.parse(JSON.stringify(this.defaultDB.users));
            migrated = true;
        }
        // Ensure academies exist
        if (!db.academies) {
            db.academies = JSON.parse(JSON.stringify(this.defaultDB.academies));
            migrated = true;
        } else {
            db.academies.forEach(acad => {
                if (acad.systemPassword === undefined || acad.systemPassword === null) {
                    acad.systemPassword = '0000';
                    migrated = true;
                }
                if (acad.tabletPassword === undefined || acad.tabletPassword === null) {
                    acad.tabletPassword = '0000';
                    migrated = true;
                }
                if (acad.businessRegistrationNumber === undefined || acad.businessRegistrationNumber === null) {
                    acad.businessRegistrationNumber = '120-00-00000';
                    migrated = true;
                }
                if (acad.ownerName === undefined || acad.ownerName === null) {
                    acad.ownerName = '김하은';
                    migrated = true;
                }
            });
        }
        // Ensure invite codes exist
        if (!db.academyInviteCodes) {
            db.academyInviteCodes = JSON.parse(JSON.stringify(this.defaultDB.academyInviteCodes));
            migrated = true;
        }
        // Ensure join requests exist
        if (!db.academyJoinRequests) {
            db.academyJoinRequests = JSON.parse(JSON.stringify(this.defaultDB.academyJoinRequests));
            migrated = true;
        }
        // Ensure parent student links exist
        if (!db.parentStudentLinks) {
            db.parentStudentLinks = JSON.parse(JSON.stringify(this.defaultDB.parentStudentLinks));
            migrated = true;
        }
        
        // Migrate users to support multi-academy array
        db.users.forEach(u => {
            if (!u.academies) {
                u.academies = [{ academyId: u.academyId || 'AC1', status: u.status || 'approved', role: u.role }];
                migrated = true;
            }
        });
        // Ensure subjects exist
        if (!db.subjects) {
            db.subjects = [
                { id: 'SUB1', name: '피아노', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB2', name: '바이올린', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB3', name: '첼로', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB4', name: '플루트', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB5', name: '기타', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' }
            ];
            migrated = true;
        }

        // Check for other standard tables and seed if missing
        if (!db.teachers || !db.students || !db.books || !db.studentBooks || !db.announcements || !db.messages || !db.surveys || !db.surveyResponses) {
            console.log('Old critical tables missing, resetting to DEFAULT_DB.');
            Object.assign(db, JSON.parse(JSON.stringify(this.defaultDB)));
            migrated = true;
        } else {
            // Add academyId to existing elements if missing
            db.students.forEach(s => {
                if (!s.academyId) {
                    s.academyId = 'AC1';
                    migrated = true;
                }
            });
            db.teachers.forEach(t => {
                if (!t.academyId) {
                    t.academyId = 'AC1';
                    migrated = true;
                }
            });
            db.announcements.forEach(a => {
                if (!a.academyId) {
                    a.academyId = 'AC1';
                    migrated = true;
                }
            });
        }

        // Migrate studentMemberNo and paymentStatus for existing students
        let memberNoCounter = 1;
        db.students.forEach(s => {
            if (!s.studentMemberNo) {
                s.studentMemberNo = memberNoCounter++;
                migrated = true;
            } else {
                if (s.studentMemberNo >= memberNoCounter) {
                    memberNoCounter = s.studentMemberNo + 1;
                }
            }
            if (s.paymentStatus === undefined || s.paymentStatus === null) {
                s.paymentStatus = 'unpaid';
                migrated = true;
            }
        });

        // Migrate default settings if missing
        db.settings = {
            sendKakaoAlert: true,
            academyName: '튜링 음악학원',
            businessNumber: '120-00-00000',
            representative: '김하은',
            phone: '02-1234-5678',
            address: '서울시 서초구 반포동 123-4',
            corporateName: '비아렙스',
            ...db.settings
        };

        const defaultScheduleSettings = {
            scheduleDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
            scheduleStartTime: "14:00",
            scheduleEndTime: "21:00",
            scheduleSlotMinutes: 30,
            printLayoutDefault: "one-per-page"
        };
        
        for (const [key, val] of Object.entries(defaultScheduleSettings)) {
            if (db.settings[key] === undefined) {
                db.settings[key] = val;
                migrated = true;
            }
        }

        // Migrate teachers scheduleNotes
        if (db.teachers) {
            db.teachers.forEach(t => {
                if (t.scheduleNotes === undefined || t.scheduleNotes === null) {
                    t.scheduleNotes = "";
                    migrated = true;
                }
            });
        }

        // Migrate students scheduleNotes
        if (db.students) {
            db.students.forEach(s => {
                if (s.scheduleNotes === undefined || s.scheduleNotes === null) {
                    s.scheduleNotes = "";
                    migrated = true;
                }
            });
        }

        // Migrate schedule overrides, snapshots and operation logs if missing
        if (!db.scheduleSnapshots) {
            db.scheduleSnapshots = [];
            migrated = true;
        }
        if (!db.scheduleOverrides) {
            db.scheduleOverrides = [];
            migrated = true;
        }
        if (!db.scheduleOperationLogs) {
            db.scheduleOperationLogs = [];
            migrated = true;
        }

        // Migrate todayTasks, routines, and mock calendar if missing
        if (!db.todayTasks) {
            db.todayTasks = [];
            migrated = true;
        }
        if (!db.todayTaskRoutines) {
            db.todayTaskRoutines = [];
            migrated = true;
        }
        if (!db.mockCalendarEvents) {
            db.mockCalendarEvents = [];
            migrated = true;
        }
 
        return migrated;
    }
}
