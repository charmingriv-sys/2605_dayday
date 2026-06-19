// authUsers.js - Users, Authentication, Roles, Join Requests Domain State Module

export const authUsersMethods = {
    // --- AUTHENTICATION & USER MANAGEMENT ---
    getCurrentUser() {
        const userId = localStorage.getItem('turing_user_id') || localStorage.getItem('harmonia_user_id');
        if (userId) {
            if (!this.db.users) this.db.users = [];
            const user = this.db.users.find(u => u.id === userId);
            if (user) return user;
        }
        const role = localStorage.getItem('turing_role') || localStorage.getItem('harmonia_role');
        if (role) {
            if (!this.db.users) this.db.users = [];
            if (role === 'director') return this.db.users.find(u => u.id === 'USR_DIR_DEMO');
            if (role === 'teacher') return this.db.users.find(u => u.id === 'USR_TEA_DEMO');
            if (role === 'parent' || role === 'student') return this.db.users.find(u => u.id === 'USR_PAR_DEMO');
        }
        return null;
    },

    setCurrentUser(userId) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (user) {
            localStorage.setItem('turing_user_id', userId);
            localStorage.setItem('turing_role', user.role);
            
            // Sync settings with director's academy
            if (user.role === 'director' && user.academyId) {
                const academy = this.getAcademy(user.academyId);
                if (academy) {
                    this.db.settings = {
                        ...this.db.settings,
                        academyName: academy.name,
                        phone: academy.phone || this.db.settings.phone,
                        address: academy.address || this.db.settings.address,
                        representative: user.name || this.db.settings.representative
                    };
                    this.saveDB();
                }
            }
        }
    },

    logoutUser() {
        localStorage.removeItem('turing_user_id');
        localStorage.removeItem('turing_role');
        localStorage.removeItem('harmonia_user_id');
        localStorage.removeItem('harmonia_role');
    },

    getUser(id) {
        if (!this.db.users) this.db.users = [];
        return this.db.users.find(u => u.id === id);
    },

    getUserBySnsId(provider, snsId) {
        if (!this.db.users) this.db.users = [];
        return this.db.users.find(u => u.provider === provider && u.snsId === snsId);
    },


    registerUser(data) {
        if (!this.db.users) this.db.users = [];
        if (!this.db.academies) this.db.academies = [];

        const { provider, snsId, name, phone, role, inviteCode, childName, academyName, academyPhone, academyAddress, termsAgreement } = data;
        
        // 필수 동의 항목 검증 (서버/상태 저장소 측 검증)
        if (!termsAgreement ||
            !termsAgreement.serviceUse || !termsAgreement.serviceUse.agreed ||
            !termsAgreement.privacyPolicy || !termsAgreement.privacyPolicy.agreed ||
            !termsAgreement.locationService || !termsAgreement.locationService.agreed) {
            throw new Error('회원가입을 진행하려면 필수 약관에 동의하셔야 합니다.');
        }

        // Check if user already exists
        const existingUser = this.db.users.find(u => u.provider === provider && u.snsId === snsId);
        if (existingUser) return existingUser;

        const userId = 'USR_' + Date.now();
        let userAcademyId = null;
        let status = 'pending';
        let method = 'invite_code';

        if (role === 'director') {
            const academyId = 'AC_' + Date.now();
            const code = this.generateUniqueInviteCode();
            const newAcademy = {
                id: academyId,
                name: academyName || '신규 음악학원',
                phone: academyPhone || '',
                businessRegistrationNumber: '',
                ownerName: name,
                postcode: data.academyPostcode || '',
                address: academyAddress || '',
                detailAddress: data.academyDetailAddress || '',
                inviteCode: code,
                ownerUserId: userId,
                systemPassword: '0000',
                tabletPassword: '0000',
                createdAt: new Date().toISOString().slice(0, 10),
                updatedAt: new Date().toISOString().slice(0, 10)
            };
            this.db.academies.push(newAcademy);

            if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
            this.db.academyInviteCodes.push({
                id: 'INV_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                academyId: academyId,
                ownerUserId: userId,
                inviteCode: code,
                status: 'active',
                createdAt: new Date().toISOString().slice(0, 10),
                updatedAt: new Date().toISOString().slice(0, 10)
            });

            userAcademyId = academyId;
            status = 'approved';
            
            // Sync settings with new director's academy info
            this.db.settings = {
                ...this.db.settings,
                academyName: newAcademy.name,
                phone: newAcademy.phone,
                address: newAcademy.address,
                representative: name
            };
        } else {
            let acad = null;
            if (inviteCode) {
                const inviteRecord = this.getAcademyInviteCodeObject(inviteCode);
                if (!inviteRecord || inviteRecord.status !== 'active') {
                    throw new Error(!inviteRecord ? '일치하는 학원 초대코드가 없습니다.' : '현재 사용할 수 없는 초대코드입니다.');
                }
                acad = this.getAcademy(inviteRecord.academyId);
                method = 'invite_code';
            } else if (data.academyId) {
                acad = this.getAcademy(data.academyId);
                method = 'academy_search';
            }

            if (!acad) {
                throw new Error('학원 정보를 찾을 수 없습니다.');
            }
            userAcademyId = acad.id;
        }

        const newUser = {
            id: userId,
            provider,
            snsId,
            name,
            phone,
            role,
            status,
            academyId: userAcademyId,
            academies: [{ academyId: userAcademyId, status: status, role: role }],
            childName: childName || null,
            termsAgreement, // 동의 여부, 동의 시각, 버전을 포함한 데이터 저장
            createdAt: new Date().toISOString().slice(0, 10)
        };

        this.db.users.push(newUser);

        if (role !== 'director') {
            if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
            this.db.academyJoinRequests.push({
                id: 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                academyId: userAcademyId,
                userId: userId,
                userType: role,
                requestMethod: method,
                status: 'pending',
                requestedAt: new Date().toISOString().slice(0, 10),
                approvedAt: null,
                rejectedAt: null,
                approvedBy: null
            });
        }

        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        if (role !== 'director') {
            this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        }
        return newUser;
    },

    updateUserRegistration(userId, data) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        const { name, phone, inviteCode, childName } = data;
        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.childName = childName || user.childName;

        let targetAcademyId = user.academyId;
        let method = 'invite_code';

        if (inviteCode) {
            const inviteRecord = this.getAcademyInviteCodeObject(inviteCode);
            if (!inviteRecord || inviteRecord.status !== 'active') {
                throw new Error(!inviteRecord ? '일치하는 학원 초대코드가 없습니다.' : '현재 사용할 수 없는 초대코드입니다.');
            }
            const acad = this.getAcademy(inviteRecord.academyId);
            if (!acad) throw new Error('학원 정보를 찾을 수 없습니다.');
            targetAcademyId = acad.id;
        } else if (data.academyId) {
            const acad = this.getAcademy(data.academyId);
            if (!acad) throw new Error('학원 정보를 찾을 수 없습니다.');
            targetAcademyId = acad.id;
            method = 'academy_search';
        }

        user.academyId = targetAcademyId;
        user.status = 'pending';
        if (user.rejectReason) delete user.rejectReason;

        // Sync with academies list
        if (!user.academies) user.academies = [];
        user.academies = user.academies.filter(a => a.status !== 'pending');
        user.academies.push({ academyId: targetAcademyId, status: 'pending', role: user.role });

        // Update academyJoinRequests table
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        this.db.academyJoinRequests = this.db.academyJoinRequests.filter(r => !(r.userId === userId && r.status === 'pending'));
        
        this.db.academyJoinRequests.push({
            id: 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            academyId: targetAcademyId,
            userId: userId,
            userType: user.role,
            requestMethod: method,
            status: 'pending',
            requestedAt: new Date().toISOString().slice(0, 10),
            approvedAt: null,
            rejectedAt: null,
            approvedBy: null
        });

        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        return user;
    },

    updateUserProfile(userId, data) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        user.name = data.name || user.name;
        user.phone = data.phone || user.phone;
        
        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        
        if (user.id === 'USR_DIR_DEMO') {
            this.db.settings.representative = user.name;
            this.db.settings.phone = user.phone;
            this.saveDB();
        }
        return user;
    },

    withdrawUser(userId) {
        if (!this.db.users) this.db.users = [];
        const userIndex = this.db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) throw new Error('사용자를 찾을 수 없습니다.');
        const user = this.db.users[userIndex];

        // 1. Clear social mapping values to allow re-registration
        localStorage.removeItem(`turing_mock_sns_id_${user.provider}`);
        localStorage.removeItem(`harmonia_mock_sns_id_${user.provider}`);

        // 2. Soft-delete user account (change status, clear active credentials, anonymize name)
        user.status = 'withdrawn';
        user.originalSnsId = user.snsId;
        user.snsId = null;
        user.originalProvider = user.provider;
        user.provider = null;
        user.name = `${user.name} (탈퇴회원)`;

        // 3. Mark linked students as discharged ("퇴원")
        if (user.role === 'parent') {
            const siblings = this.getStudentsForParent(userId);
            siblings.forEach(student => {
                student.status = 'withdrawn';
                student.withdrawalDate = new Date().toISOString().slice(0, 10);
                student.leaveDate = student.withdrawalDate;
            });
        }

        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.logoutUser();
    },

    getPendingUsers(academyId) {
        if (!this.db.users) this.db.users = [];
        return this.db.users.filter(u => u.academyId === academyId && u.status === 'pending');
    },

    approveUser(userId, studentIdForParent = null) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        user.status = 'approved';
        
        if (user.role === 'parent' && studentIdForParent) {
            if (!this.db.parentStudentLinks) this.db.parentStudentLinks = [];
            const studentIds = Array.isArray(studentIdForParent) ? studentIdForParent : [studentIdForParent];
            studentIds.forEach(sid => {
                const exists = this.db.parentStudentLinks.some(link => link.parentUserId === userId && link.studentId === sid);
                if (!exists) {
                    this.db.parentStudentLinks.push({ parentUserId: userId, studentId: sid });
                }
            });
        }
        
        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('PARENT_STUDENT_LINKS_CHANGED', this.db.parentStudentLinks);
        return user;
    },

    rejectUser(userId, reason = '') {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        user.status = 'rejected';
        user.rejectReason = reason;
        
        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        return user;
    },

    getJoinRequests(academyId) {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        return this.db.academyJoinRequests.filter(r => r.academyId === academyId);
    },

    getPendingJoinRequests(academyId) {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        return this.db.academyJoinRequests.filter(r => r.academyId === academyId && r.status === 'pending');
    },

    createJoinRequest(userId, academyId, requestMethod) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');

        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];

        // Check if already pending
        const isPending = this.db.academyJoinRequests.some(r => r.userId === userId && r.academyId === academyId && r.status === 'pending');
        if (isPending) throw new Error('이미 해당 학원에 가입신청되어 있습니다.');

        // Check if already approved
        const isApproved = user.academies && user.academies.some(a => a.academyId === academyId && a.status === 'approved');
        if (isApproved || (user.academyId === academyId && user.status === 'approved')) {
            throw new Error('이미 해당 학원에 가입되어 있습니다.');
        }

        const reqId = 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.db.academyJoinRequests.push({
            id: reqId,
            academyId,
            userId,
            userType: user.role,
            requestMethod, // 'invite_code' or 'academy_search'
            status: 'pending',
            requestedAt: new Date().toISOString().slice(0, 10),
            approvedAt: null,
            rejectedAt: null,
            approvedBy: null
        });

        // Add to user academies list
        if (!user.academies) user.academies = [];
        const uAcad = user.academies.find(a => a.academyId === academyId);
        if (!uAcad) {
            user.academies.push({ academyId, status: 'pending', role: user.role });
        } else {
            uAcad.status = 'pending';
        }

        this.saveDB();
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        this.notify('USERS_CHANGED', this.db.users);
        return reqId;
    },

    approveJoinRequest(requestId, studentIdForParent = null, directorUserId) {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        const req = this.db.academyJoinRequests.find(r => r.id === requestId);
        if (!req) throw new Error('가입 신청 내역을 찾을 수 없습니다.');

        req.status = 'approved';
        req.approvedAt = new Date().toISOString().slice(0, 10);
        req.approvedBy = directorUserId;

        const user = this.db.users.find(u => u.id === req.userId);
        if (user) {
            user.status = 'approved';
            user.academyId = req.academyId;

            if (!user.academies) user.academies = [];
            const uAcad = user.academies.find(a => a.academyId === req.academyId);
            if (uAcad) {
                uAcad.status = 'approved';
            } else {
                user.academies.push({ academyId: req.academyId, status: 'approved', role: user.role });
            }

            if (user.role === 'parent' && studentIdForParent) {
                if (!this.db.parentStudentLinks) this.db.parentStudentLinks = [];
                const sids = Array.isArray(studentIdForParent) ? studentIdForParent : [studentIdForParent];
                sids.forEach(sid => {
                    const exists = this.db.parentStudentLinks.some(link => link.parentUserId === user.id && link.studentId === sid);
                    if (!exists) {
                        this.db.parentStudentLinks.push({ parentUserId: user.id, studentId: sid });
                    }
                });
            }
        }

        this.saveDB();
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('PARENT_STUDENT_LINKS_CHANGED', this.db.parentStudentLinks || []);
    },

    rejectJoinRequest(requestId, directorUserId, reason = '') {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        const req = this.db.academyJoinRequests.find(r => r.id === requestId);
        if (!req) throw new Error('가입 신청 내역을 찾을 수 없습니다.');

        req.status = 'rejected';
        req.rejectedAt = new Date().toISOString().slice(0, 10);
        req.approvedBy = directorUserId;

        const user = this.db.users.find(u => u.id === req.userId);
        if (user) {
            if (!user.academies) user.academies = [];
            const uAcad = user.academies.find(a => a.academyId === req.academyId);
            if (uAcad) {
                uAcad.status = 'rejected';
            }

            if (user.academyId === req.academyId) {
                user.status = 'rejected';
                user.rejectReason = reason;
            }
        }

        this.saveDB();
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        this.notify('USERS_CHANGED', this.db.users);
    }
};
