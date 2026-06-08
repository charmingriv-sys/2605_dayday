// settings.js - Settings & Organization Domain State Module

export const settingsMethods = {
    // --- SETTINGS ---
    getLateThresholdMinutes() {
        const settings = this.db.settings || {};
        const val = settings.lateThresholdMinutes;
        if (typeof val === 'number' && val >= 0 && val <= 60 && val % 5 === 0) {
            return val;
        }
        return 10;
    },

    setLateThresholdMinutes(minutes) {
        let val = Number(minutes);
        if (isNaN(val) || val < 0 || val > 60 || val % 5 !== 0) {
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
