// settings.js - Settings & Organization Domain State Module

export const settingsMethods = {
    // --- SETTINGS ---
    getLateThresholdMinutes() {
        const settings = this.db.settings || {};
        const val = settings.lateThresholdMinutes;
        if (typeof val === 'number' && val >= 0 && val <= 90 && val % 5 === 0) {
            return val;
        }
        return 10;
    },

    setLateThresholdMinutes(minutes) {
        let val = Number(minutes);
        if (isNaN(val) || val < 0 || val > 90 || val % 5 !== 0) {
            val = 10;
        }
        this.db.settings = {
            ...this.db.settings,
            lateThresholdMinutes: val
        };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getLateDetectionEnabled() {
        const settings = this.db.settings || {};
        return settings.lateDetectionEnabled !== false;
    },

    setLateDetectionEnabled(enabled) {
        this.db.settings = {
            ...this.db.settings,
            lateDetectionEnabled: !!enabled
        };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getStudentLateWarningEnabled() {
        return this.getLateDetectionEnabled();
    },
    setStudentLateWarningEnabled(enabled) {
        this.setLateDetectionEnabled(enabled);
    },

    getStudentLateWarningGraceMinutes() {
        return this.getLateThresholdMinutes();
    },
    setStudentLateWarningGraceMinutes(minutes) {
        this.setLateThresholdMinutes(minutes);
    },

    getStudentAbsenceWarningEnabled() {
        const settings = this.db.settings || {};
        return settings.studentAbsenceWarningEnabled !== false;
    },
    setStudentAbsenceWarningEnabled(enabled) {
        this.db.settings = { ...this.db.settings, studentAbsenceWarningEnabled: !!enabled };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getStudentCheckoutMissingWarningEnabled() {
        const settings = this.db.settings || {};
        return settings.studentCheckoutMissingWarningEnabled !== false;
    },
    setStudentCheckoutMissingWarningEnabled(enabled) {
        this.db.settings = { ...this.db.settings, studentCheckoutMissingWarningEnabled: !!enabled };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getStudentCheckoutMissingGraceMinutes() {
        const settings = this.db.settings || {};
        const val = settings.studentCheckoutMissingGraceMinutes;
        if (typeof val === 'number' && val >= 0 && val <= 90 && val % 5 === 0) {
            return val;
        }
        return 10;
    },
    setStudentCheckoutMissingGraceMinutes(minutes) {
        let val = Number(minutes);
        if (isNaN(val) || val < 0 || val > 90 || val % 5 !== 0) {
            val = 10;
        }
        this.db.settings = { ...this.db.settings, studentCheckoutMissingGraceMinutes: val };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getTeacherLateWarningEnabled() {
        const settings = this.db.settings || {};
        return settings.teacherLateWarningEnabled !== false;
    },
    setTeacherLateWarningEnabled(enabled) {
        this.db.settings = { ...this.db.settings, teacherLateWarningEnabled: !!enabled };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getTeacherLateWarningGraceMinutes() {
        const settings = this.db.settings || {};
        const val = settings.teacherLateWarningGraceMinutes;
        if (typeof val === 'number' && val >= 0 && val <= 90 && val % 5 === 0) {
            return val;
        }
        return 5;
    },
    setTeacherLateWarningGraceMinutes(minutes) {
        let val = Number(minutes);
        if (isNaN(val) || val < 0 || val > 90 || val % 5 !== 0) {
            val = 5;
        }
        this.db.settings = { ...this.db.settings, teacherLateWarningGraceMinutes: val };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getTeacherNoShowWarningEnabled() {
        const settings = this.db.settings || {};
        return settings.teacherNoShowWarningEnabled !== false;
    },
    setTeacherNoShowWarningEnabled(enabled) {
        this.db.settings = { ...this.db.settings, teacherNoShowWarningEnabled: !!enabled };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getTeacherNoShowWarningGraceMinutes() {
        const settings = this.db.settings || {};
        const val = settings.teacherNoShowWarningGraceMinutes;
        if (typeof val === 'number' && val >= 0 && val <= 90 && val % 5 === 0) {
            return val;
        }
        return 10;
    },
    setTeacherNoShowWarningGraceMinutes(minutes) {
        let val = Number(minutes);
        if (isNaN(val) || val < 0 || val > 90 || val % 5 !== 0) {
            val = 10;
        }
        this.db.settings = { ...this.db.settings, teacherNoShowWarningGraceMinutes: val };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getTeacherCheckoutMissingWarningEnabled() {
        const settings = this.db.settings || {};
        return settings.teacherCheckoutMissingWarningEnabled !== false;
    },
    setTeacherCheckoutMissingWarningEnabled(enabled) {
        this.db.settings = { ...this.db.settings, teacherCheckoutMissingWarningEnabled: !!enabled };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getTeacherCheckoutMissingGraceMinutes() {
        const settings = this.db.settings || {};
        const val = settings.teacherCheckoutMissingGraceMinutes;
        if (typeof val === 'number' && val >= 0 && val <= 90 && val % 5 === 0) {
            return val;
        }
        return 10;
    },
    setTeacherCheckoutMissingGraceMinutes(minutes) {
        let val = Number(minutes);
        if (isNaN(val) || val < 0 || val > 90 || val % 5 !== 0) {
            val = 10;
        }
        this.db.settings = { ...this.db.settings, teacherCheckoutMissingGraceMinutes: val };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getSettings() {
        const base = this.db.settings || { sendKakaoAlert: true };
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.academyId) {
            const acad = this.getAcademy(currentUser.academyId);
            if (acad) {
                return {
                    ...base,
                    academyName: acad.name,
                    phone: acad.phone || '',
                    businessNumber: acad.businessRegistrationNumber || '',
                    representative: acad.ownerName || '',
                    address: `${acad.address || ''} ${acad.detailAddress || ''}`.trim(),
                    postcode: acad.postcode || '',
                    directorSignature: acad.directorSignature || ''
                };
            }
        }
        return base;
    },

    updateSettings(settings) {
        this.db.settings = { ...this.db.settings, ...settings };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    normalizeParentMessageSettings(parentMessageSettings) {
        const defaultEvents = [
            'attendanceCheckIn',
            'attendanceCheckOut',
            'tuitionBilling',
            'tuitionOverdue',
            'tuitionPaid',
            'bookBilling',
            'bookOverdue',
            'bookPaid'
        ];
        const normalized = {};
        const src = parentMessageSettings || {};
        for (const eventKey of defaultEvents) {
            const original = src[eventKey] || {};
            let messageEnabled = original.messageEnabled !== false;
            let pushEnabled = original.pushEnabled !== false;
            
            if (!messageEnabled) {
                pushEnabled = false;
            }
            
            normalized[eventKey] = {
                messageEnabled,
                pushEnabled
            };
        }
        return normalized;
    },

    getParentMessageSettings() {
        if (!this.db.settings) {
            this.db.settings = {};
        }
        this.db.settings.parentMessageSettings = this.normalizeParentMessageSettings(this.db.settings.parentMessageSettings);
        return this.db.settings.parentMessageSettings;
    },

    updateParentMessageSetting(eventKey, partial) {
        if (!this.db.settings) {
            this.db.settings = {};
        }
        if (!this.db.settings.parentMessageSettings) {
            this.db.settings.parentMessageSettings = this.normalizeParentMessageSettings({});
        }
        const current = this.db.settings.parentMessageSettings[eventKey] || { messageEnabled: true, pushEnabled: true };
        const updated = { ...current, ...partial };
        
        if (updated.messageEnabled === false) {
            updated.pushEnabled = false;
        }
        
        this.db.settings.parentMessageSettings[eventKey] = updated;
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    updateParentMessageSettingsBulk(settingsMap) {
        if (!this.db.settings) {
            this.db.settings = {};
        }
        if (!this.db.settings.parentMessageSettings) {
            this.db.settings.parentMessageSettings = this.normalizeParentMessageSettings({});
        }
        for (const [eventKey, partial] of Object.entries(settingsMap)) {
            const current = this.db.settings.parentMessageSettings[eventKey] || { messageEnabled: true, pushEnabled: true };
            const updated = { ...current, ...partial };
            if (updated.messageEnabled === false) {
                updated.pushEnabled = false;
            }
            this.db.settings.parentMessageSettings[eventKey] = updated;
        }
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    getParentCommunicationTabSettings() {
        if (!this.db.settings) {
            this.db.settings = {};
        }
        if (!this.db.settings.parentCommunicationTabSettings || typeof this.db.settings.parentCommunicationTabSettings !== 'object') {
            this.db.settings.parentCommunicationTabSettings = {
                announcements: { enabled: false },
                surveys: { enabled: true },
                messages: { enabled: true }
            };
        }
        return this.db.settings.parentCommunicationTabSettings;
    },

    updateParentCommunicationTabSettings(settingsMap) {
        if (!this.db.settings) {
            this.db.settings = {};
        }
        if (!this.db.settings.parentCommunicationTabSettings || typeof this.db.settings.parentCommunicationTabSettings !== 'object') {
            this.db.settings.parentCommunicationTabSettings = {
                announcements: { enabled: false },
                surveys: { enabled: true },
                messages: { enabled: true }
            };
        }
        for (const [key, val] of Object.entries(settingsMap)) {
            if (this.db.settings.parentCommunicationTabSettings[key]) {
                this.db.settings.parentCommunicationTabSettings[key].enabled = !!val.enabled;
            }
        }
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    },

    // --- ACADEMIES ---
    getAcademy(id) {
        if (!this.db.academies) this.db.academies = [];
        return this.db.academies.find(a => a.id === id);
    },

    getAcademyByInviteCode(code) {
        if (!code) return null;
        if (!this.db.academies) this.db.academies = [];
        return this.db.academies.find(a => a.inviteCode.toUpperCase() === code.toUpperCase().trim());
    },

    getAcademyInviteCodeObject(code) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        return this.db.academyInviteCodes.find(c => c.inviteCode.toUpperCase() === code.toUpperCase().trim());
    },

    updateAcademy(academyId, data) {
        if (!this.db.academies) this.db.academies = [];
        const acad = this.db.academies.find(a => a.id === academyId);
        if (!acad) throw new Error('학원을 찾을 수 없습니다.');

        acad.name = data.name || acad.name;
        acad.phone = data.phone || '';
        acad.businessRegistrationNumber = data.businessRegistrationNumber || '';
        acad.postcode = data.postcode || '';
        acad.address = data.address || '';
        acad.detailAddress = data.detailAddress || '';
        acad.ownerName = data.ownerName || '';
        if (data.systemPassword !== undefined) {
            acad.systemPassword = data.systemPassword;
        }
        if (data.tabletPassword !== undefined) {
            acad.tabletPassword = data.tabletPassword;
        }
        if (data.directorSignature !== undefined) {
            acad.directorSignature = data.directorSignature;
        }
        acad.updatedAt = new Date().toISOString().slice(0, 10);

        // Also sync settings representation if it's the active academy
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.academyId === academyId) {
            this.db.settings = {
                ...this.db.settings,
                academyName: acad.name,
                phone: acad.phone,
                address: acad.address,
                representative: acad.ownerName
            };
        }

        this.saveDB();
        this.notify('ACADEMIES_CHANGED', this.db.academies);
        this.notify('USERS_CHANGED', this.db.users);
        if (currentUser && currentUser.academyId === academyId) {
            this.notify('SETTINGS_CHANGED', this.db.settings);
        }
    },

    // --- INVITE CODES ---
    generateUniqueInviteCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded O, 0, I, 1
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        
        let code;
        let isDuplicate = true;
        while (isDuplicate) {
            code = '';
            for (let i = 0; i < 5; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            isDuplicate = this.db.academyInviteCodes.some(c => c.inviteCode === code && c.status === 'active') ||
                          this.db.academies.some(a => a.inviteCode === code);
        }
        return code;
    },

    getAcademyInviteCode(academyId) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        return this.db.academyInviteCodes.find(c => c.academyId === academyId && c.status === 'active') || 
               this.db.academyInviteCodes.filter(c => c.academyId === academyId).pop();
    },

    regenerateAcademyInviteCode(academyId) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        if (!this.db.academies) this.db.academies = [];

        const acad = this.db.academies.find(a => a.id === academyId);
        if (!acad) throw new Error('학원을 찾을 수 없습니다.');

        // Deactivate old codes
        this.db.academyInviteCodes.forEach(c => {
            if (c.academyId === academyId) {
                c.status = 'inactive';
                c.updatedAt = new Date().toISOString().slice(0, 10);
            }
        });

        // Generate and insert new code
        const newCode = this.generateUniqueInviteCode();
        const codeRecord = {
            id: 'INV_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            academyId: academyId,
            ownerUserId: acad.ownerUserId || 'USR_DIR_DEMO',
            inviteCode: newCode,
            status: 'active',
            createdAt: new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString().slice(0, 10)
        };
        this.db.academyInviteCodes.push(codeRecord);

        // Sync with academies table
        acad.inviteCode = newCode;

        this.saveDB();
        this.notify('ACADEMY_INVITE_CODES_CHANGED', this.db.academyInviteCodes);
        this.notify('ACADEMIES_CHANGED', this.db.academies);
        return newCode;
    },

    updateAcademyInviteCodeStatus(academyId, isActive) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        const codeObj = this.getAcademyInviteCode(academyId);
        if (!codeObj) throw new Error('초대코드가 존재하지 않습니다.');

        codeObj.status = isActive ? 'active' : 'inactive';
        codeObj.updatedAt = new Date().toISOString().slice(0, 10);

        this.saveDB();
        this.notify('ACADEMY_INVITE_CODES_CHANGED', this.db.academyInviteCodes);
    },

    searchAcademies(query) {
        if (!this.db.academies) this.db.academies = [];
        if (!query || query.trim() === '') return [];

        const chosung = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
        const getChosungStr = (str) => {
            let res = "";
            for (let i = 0; i < str.length; i++) {
                const code = str.charCodeAt(i) - 44032;
                if (code > -1 && code < 11172) {
                    res += chosung[Math.floor(code / 588)];
                } else {
                    res += str.charAt(i);
                }
            }
            return res;
        };

        const cleanQuery = query.replace(/\s+/g, '').toLowerCase();
        const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(cleanQuery);

        return this.db.academies.filter(a => {
            const cleanName = a.name.replace(/\s+/g, '').toLowerCase();
            const cleanAddr = (a.address || '').replace(/\s+/g, '').toLowerCase();

            if (isChosungOnly) {
                return getChosungStr(cleanName).includes(cleanQuery) || getChosungStr(cleanAddr).includes(cleanQuery);
            }
            return cleanName.includes(cleanQuery) || cleanAddr.includes(cleanQuery);
        });
    }
};
