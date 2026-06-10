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
        if (!db.attendanceChangeLogs) {
            db.attendanceChangeLogs = [];
            migrated = true;
        }
        if (!db.teacherAttendanceLogs) {
            db.teacherAttendanceLogs = [];
            migrated = true;
        }
        if (!db.teacherAttendanceEditLogs) {
            db.teacherAttendanceEditLogs = [];
            migrated = true;
        }

        if (!db.majorSchedules) {
            db.majorSchedules = [
              { id: "ev1", type: "concours", name: "한국청소년 피아노 콩쿠르", eventDate: "2026-06-14", dueDate: "2026-06-07", ownerId: "정은비", place: "예술의전당", visible: false, memo: "접수 마감 전 보호자 확인 필요", participantStudentIds: ["S1", "S5"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              { id: "ev2", type: "exam", name: "예원학교 입시 실기고사", eventDate: "2026-07-05", dueDate: "2026-06-09", ownerId: "한지섭", place: "예원학교 음악관", visible: false, memo: "입시 상담 예약과 원서 접수 확인", participantStudentIds: ["S3", "S7"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              { id: "ev3", type: "concours", name: "영 첼리스트 콩쿠르", eventDate: "2026-06-21", dueDate: "2026-06-11", ownerId: "성여진", place: "금호아트홀", visible: false, memo: "결석 학생 보강 배정 필요", participantStudentIds: ["S2"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              { id: "ev4", type: "event", name: "여름 정기 음악회", eventDate: "2026-06-27", dueDate: null, ownerId: "윤채린", place: "튜링 그랜드홀", visible: false, memo: "전체 리허설 6월 25일", participantStudentIds: ["S1", "S4"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              { id: "ev5", type: "makeup", name: "6월 결석자 보강 편성", eventDate: "2026-06-12", dueDate: null, ownerId: "운영실", place: "원내", visible: false, memo: "최근 결석 원생 보강 시간 확정", participantStudentIds: ["S2", "S6"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
              { id: "ev6", type: "counsel", name: "입시반 학부모 상담 주간", eventDate: "2026-06-18", dueDate: null, ownerId: "원장", place: "상담실", visible: false, memo: "입시반 학부모 상담 후보 자동 큐", participantStudentIds: ["S3", "S7"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            ];
            migrated = true;
        }

        const teachers = db.teachers || [];
        const teacherNames = teachers.map(t => t.name);
        const firstTeacherName = teacherNames[0] || "";

        db.majorSchedules.forEach(e => {
            if (e.type === 'recital') {
                e.type = 'event';
                migrated = true;
            }
            if (e.status !== undefined) {
                delete e.status;
                migrated = true;
            }
            if (e.openCount !== undefined) {
                delete e.openCount;
                migrated = true;
            }
            
            // Normalize ownerId to match a registered teacher
            if (e.ownerId) {
                if (!teacherNames.includes(e.ownerId)) {
                    if (e.ownerId === "성여진" && teacherNames.includes("성어진")) {
                        e.ownerId = "성어진";
                        migrated = true;
                    } else {
                        e.ownerId = firstTeacherName;
                        migrated = true;
                    }
                }
            } else {
                e.ownerId = firstTeacherName;
                migrated = true;
            }
        });

        if (!db.majorScheduleStudentNotes) {
            db.majorScheduleStudentNotes = [
              { id: "msn_1", studentId: "S1", content: "06.04 콩쿠르 접수 보호자 확인 필요", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
              { id: "msn_2", studentId: "S1", content: "06.01 템포 흔들림, 다음 레슨에서 재점검", createdAt: "2026-06-01T10:00:00.000Z", updatedAt: "2026-06-01T10:00:00.000Z" },
              { id: "msn_3", studentId: "S2", content: "06.04 결석 보강 후보", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
              { id: "msn_4", studentId: "S2", content: "05.30 암보 불안정, 보호자 안내 완료", createdAt: "2026-05-30T10:00:00.000Z", updatedAt: "2026-05-30T10:00:00.000Z" },
              { id: "msn_5", studentId: "S3", content: "06.04 입시 상담 일정 조율 필요", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
              { id: "msn_6", studentId: "S3", content: "06.02 원서 제출 서류 안내", createdAt: "2026-06-02T10:00:00.000Z", updatedAt: "2026-06-02T10:00:00.000Z" },
              { id: "msn_7", studentId: "S4", content: "06.03 리허설 안내 문자 발송", createdAt: "2026-06-03T10:00:00.000Z", updatedAt: "2026-06-03T10:00:00.000Z" },
              { id: "msn_8", studentId: "S5", content: "06.04 추가 레슨 편성 검토", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
              { id: "msn_9", studentId: "S5", content: "06.01 곡 완성도 낮음, 원장 확인", createdAt: "2026-06-01T10:00:00.000Z", updatedAt: "2026-06-01T10:00:00.000Z" },
              { id: "msn_10", studentId: "S6", content: "06.04 보강 가능 시간 확인 필요", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
              { id: "msn_11", studentId: "S6", content: "05.29 결석 사유 입력", createdAt: "2026-05-29T10:00:00.000Z", updatedAt: "2026-05-29T10:00:00.000Z" },
              { id: "msn_12", studentId: "S7", content: "06.04 학부모 상담 후보", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
              { id: "msn_13", studentId: "S7", content: "06.02 입시곡 진도 양호", createdAt: "2026-06-02T10:00:00.000Z", updatedAt: "2026-06-02T10:00:00.000Z" }
            ];
            migrated = true;
        }
 
        return migrated;
    }
}
