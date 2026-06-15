// communication.js - Announcements, Messages, Surveys Domain State Module

export const communicationMethods = {
    // --- ANNOUNCEMENTS ---
    getAnnouncements() {
        if (!this.db.announcements) this.db.announcements = [];
        return this.db.announcements;
    },

    addAnnouncement(title, content) {
        if (!this.db.announcements) this.db.announcements = [];
        const id = 'AN' + (this.db.announcements.length ? Math.max(...this.db.announcements.map(a => parseInt(a.id.slice(2)) || 0)) + 1 : 1);
        const date = new Date().toISOString().slice(0, 10);
        const created_at = new Date().toISOString();
        const newAnnouncement = { id, title, content, date, views: 0, created_at };
        this.db.announcements.push(newAnnouncement);
        this.saveDB();
        this.notify('ANNOUNCEMENTS_CHANGED', this.db.announcements);
        return newAnnouncement;
    },

    deleteAnnouncement(id) {
        this.db.announcements = this.getAnnouncements().filter(a => a.id !== id);
        this.saveDB();
        this.notify('ANNOUNCEMENTS_CHANGED', this.db.announcements);
    },

    incrementAnnouncementViews(id) {
        const announcement = this.getAnnouncements().find(a => a.id === id);
        if (announcement) {
            announcement.views = (announcement.views || 0) + 1;
            this.saveDB();
            this.notify('ANNOUNCEMENTS_CHANGED', this.db.announcements);
        }
    },

    // --- MESSAGES ---
    getMessages() {
        if (!this.db.messages) this.db.messages = [];
        return this.db.messages;
    },

    getMessagesForStudent(studentId) {
        return this.getMessages().filter(m => m.studentId === studentId);
    },

    addMessage(studentId, title, content) {
        if (!this.db.messages) this.db.messages = [];
        const id = 'MSG' + (this.db.messages.length ? Math.max(...this.db.messages.map(m => parseInt(m.id.slice(3)) || 0)) + 1 : 1);
        const date = new Date().toISOString().slice(0, 10);
        const created_at = new Date().toISOString();
        const newMessage = { id, studentId, title, content, date, isRead: false, created_at };
        this.db.messages.push(newMessage);
        this.saveDB();
        this.notify('MESSAGES_CHANGED', this.db.messages);

        if (this.db.settings.sendKakaoAlert) {
            const student = this.getStudent(studentId);
            if (student) {
                const alertMsg = `[튜링 알림톡]\n안녕하세요, ${student.name} 학부모님.\n개별 안내장(메시지)이 도착했습니다.\n\n■ 제목: ${title}\n\n학부모 포털에서 확인 부탁드립니다.`;
                const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
                window.dispatchEvent(event);
            }
        }
        return newMessage;
    },

    deleteMessage(id) {
        this.db.messages = this.getMessages().filter(m => m.id !== id);
        this.saveDB();
        this.notify('MESSAGES_CHANGED', this.db.messages);
    },

    markMessageAsRead(id) {
        const message = this.getMessages().find(m => m.id === id);
        if (message && !message.isRead) {
            message.isRead = true;
            this.saveDB();
            this.notify('MESSAGES_CHANGED', this.db.messages);
        }
    },

    // --- SURVEYS & RESPONSES ---
    getSurveys() {
        if (!this.db.surveys) this.db.surveys = [];
        return this.db.surveys;
    },

    getSurvey(id) {
        return this.getSurveys().find(s => s.id === id);
    },

    addSurvey(title, description, questions) {
        if (!this.db.surveys) this.db.surveys = [];
        const id = 'SUR' + (this.db.surveys.length ? Math.max(...this.db.surveys.map(s => parseInt(s.id.slice(3)) || 0)) + 1 : 1);
        const date = new Date().toISOString().slice(0, 10);
        const created_at = new Date().toISOString();
        const newSurvey = { id, title, description, date, isActive: true, questions, created_at };
        this.db.surveys.push(newSurvey);
        this.saveDB();
        this.notify('SURVEYS_CHANGED', this.db.surveys);

        if (this.db.settings.sendKakaoAlert) {
            const alertMsg = `[튜링 알림톡]\n안녕하세요, 학부모님.\n${this.db.settings.academyName || '튜링 음악학원'}에서 설문조사를 배포하였습니다.\n\n■ 설문명: ${title}\n\n학부모 안심 포털에서 설문 참여를 부탁드립니다.`;
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
            window.dispatchEvent(event);
        }
        return newSurvey;
    },

    deleteSurvey(id) {
        this.db.surveys = this.getSurveys().filter(s => s.id !== id);
        if (this.db.surveyResponses) {
            this.db.surveyResponses = this.db.surveyResponses.filter(r => r.surveyId !== id);
        }
        this.saveDB();
        this.notify('SURVEYS_CHANGED', this.db.surveys);
        this.notify('SURVEY_RESPONSES_CHANGED', this.db.surveyResponses);
    },

    getSurveyResponses(surveyId) {
        if (!this.db.surveyResponses) this.db.surveyResponses = [];
        return this.db.surveyResponses.filter(r => r.surveyId === surveyId);
    },

    submitSurveyResponse(surveyId, studentId, answers) {
        if (!this.db.surveyResponses) this.db.surveyResponses = [];
        const existingIdx = this.db.surveyResponses.findIndex(r => r.surveyId === surveyId && r.studentId === studentId);
        const date = new Date().toISOString().slice(0, 10);
        
        if (existingIdx !== -1) {
            this.db.surveyResponses[existingIdx].answers = answers;
            this.db.surveyResponses[existingIdx].date = date;
        } else {
            const id = 'SRES' + (this.db.surveyResponses.length ? Math.max(...this.db.surveyResponses.map(r => parseInt(r.id.slice(4)) || 0)) + 1 : 1);
            this.db.surveyResponses.push({ id, surveyId, studentId, answers, date });
        }

        this.saveDB();
        this.notify('SURVEY_RESPONSES_CHANGED', this.db.surveyResponses);
    },

    hasStudentAnsweredSurvey(surveyId, studentId) {
        if (!this.db.surveyResponses) return false;
        return this.db.surveyResponses.some(r => r.surveyId === surveyId && r.studentId === studentId);
    },

    // --- OUTBOUND MESSAGE LOGS ---
    getOutboundMessageLogs() {
        if (!this.db.outboundMessageLogs) {
            this.db.outboundMessageLogs = [];
            this.saveDB();
        }
        return this.db.outboundMessageLogs;
    },

    addOutboundMessageLog(log) {
        if (!this.db.outboundMessageLogs) {
            this.getOutboundMessageLogs();
        }
        const id = 'msglog_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const newLog = {
            id,
            createdAt: new Date().toISOString(),
            ...log
        };
        this.db.outboundMessageLogs.unshift(newLog);
        this.saveDB();
        this.notify('OUTBOUND_MESSAGE_LOGS_CHANGED', this.db.outboundMessageLogs);
        return newLog;
    },

    updateOutboundMessageLog(logId, patch) {
        if (!this.db.outboundMessageLogs) return null;
        const index = this.db.outboundMessageLogs.findIndex(l => l.id === logId);
        if (index === -1) return null;
        const current = this.db.outboundMessageLogs[index];
        const updated = {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString()
        };
        this.db.outboundMessageLogs[index] = updated;
        this.saveDB();
        this.notify('OUTBOUND_MESSAGE_LOGS_CHANGED', this.db.outboundMessageLogs);
        return updated;
    },

    deleteOutboundMessageLog(logId) {
        if (!this.db.outboundMessageLogs) return;
        this.db.outboundMessageLogs = this.db.outboundMessageLogs.filter(l => l.id !== logId);
        this.saveDB();
        this.notify('OUTBOUND_MESSAGE_LOGS_CHANGED', this.db.outboundMessageLogs);
    },

    // --- MESSAGE TEMPLATES ---
    getMessageTemplates() {
        if (!this.db.messageTemplates) {
            this.db.messageTemplates = [];
            this.saveDB();
        }
        return [...this.db.messageTemplates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    addMessageTemplate(payload) {
        if (!this.db.messageTemplates) {
            this.db.messageTemplates = [];
        }
        if (!payload.title || !payload.title.trim()) {
            throw new Error("템플릿 제목은 필수 입력 항목입니다.");
        }
        if (!payload.body || !payload.body.trim()) {
            throw new Error("템플릿 본문은 필수 입력 항목입니다.");
        }

        const id = 'tmpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const now = new Date().toISOString();
        const newTemplate = {
            id,
            createdAt: now,
            updatedAt: now,
            title: payload.title.trim(),
            body: payload.body.trim(),
            method: payload.method || 'SMS',
            category: payload.category || 'custom',
            imageName: payload.imageName || null,
            favorite: payload.favorite || false
        };
        this.db.messageTemplates.unshift(newTemplate);
        this.saveDB();
        this.notify('MESSAGE_TEMPLATES_CHANGED', this.db.messageTemplates);
        return newTemplate;
    },

    updateMessageTemplate(templateId, patch) {
        if (!this.db.messageTemplates) {
            this.db.messageTemplates = [];
        }
        const index = this.db.messageTemplates.findIndex(t => t.id === templateId);
        if (index === -1) {
            throw new Error("수정할 템플릿을 찾을 수 없습니다.");
        }
        if (patch.title !== undefined && !patch.title.trim()) {
            throw new Error("템플릿 제목은 필수 입력 항목입니다.");
        }
        if (patch.body !== undefined && !patch.body.trim()) {
            throw new Error("템플릿 본문은 필수 입력 항목입니다.");
        }

        const current = this.db.messageTemplates[index];
        const updated = {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString()
        };
        if (patch.title !== undefined) updated.title = patch.title.trim();
        if (patch.body !== undefined) updated.body = patch.body.trim();

        this.db.messageTemplates[index] = updated;
        this.saveDB();
        this.notify('MESSAGE_TEMPLATES_CHANGED', this.db.messageTemplates);
        return updated;
    },

    deleteMessageTemplate(templateId) {
        if (!this.db.messageTemplates) {
            this.db.messageTemplates = [];
        }
        this.db.messageTemplates = this.db.messageTemplates.filter(t => t.id !== templateId);
        this.saveDB();
        this.notify('MESSAGE_TEMPLATES_CHANGED', this.db.messageTemplates);
    },

    migrateParentContacts() {
        if (!this.db.parentContacts) {
            this.db.parentContacts = [];
        }
        if (!this.db.students) {
            return;
        }

        let migrated = false;
        this.db.students.forEach(student => {
            if (!student.parentPhone) return;

            const studentId = student.id;
            const phone = student.parentPhone;
            const normalizedPhone = phone.replace(/[^0-9]/g, '');

            // 1. 이미 동일 studentId에 slot이 'parent1'인 parentContact가 있는지 확인
            const hasSlot1 = this.db.parentContacts.some(c => c.studentId === studentId && c.slot === 'parent1');

            // 2. 이미 동일 studentId에 동일 normalizedPhone을 가진 parentContact가 있는지 확인
            const hasPhone = this.db.parentContacts.some(c => c.studentId === studentId && c.normalizedPhone === normalizedPhone);

            if (hasSlot1 || hasPhone) {
                return; // 멱등성 유지 (중복 생성 차단)
            }

            const name = student.parentName || `${student.name} 보호자`;
            const id = 'pc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
            const now = new Date().toISOString();

            const newContact = {
                id,
                studentId,
                slot: 'parent1',
                name,
                relation: 'guardian',
                phone,
                normalizedPhone,
                isPrimary: true,
                canReceiveMessage: true,
                canReceiveAttendanceMessage: true,
                canReceivePaymentMessage: true,
                canReceiveNoticeMessage: true,
                linkedUserId: null,
                appInstalled: false,
                pushEnabled: false,
                pushTokenStatus: 'unknown',
                lastAppLoginAt: null,
                memo: 'MIGRATED',
                createdAt: now,
                updatedAt: now
            };

            this.db.parentContacts.push(newContact);
            migrated = true;
        });

        if (migrated) {
            this.saveDB();
            this.notify('PARENT_CONTACTS_CHANGED', this.db.parentContacts);
        }
    },

    getParentContactsByStudent(studentId) {
        if (!this.db.parentContacts) this.db.parentContacts = [];
        return this.db.parentContacts.filter(c => c.studentId === studentId);
    },

    getPrimaryParentContact(studentId) {
        if (!this.db.parentContacts) this.db.parentContacts = [];
        return this.db.parentContacts.find(c => c.studentId === studentId && c.isPrimary === true) || null;
    },

    createParentMessage(input) {
        if (!this.db.parentMessages) this.db.parentMessages = [];

        // dedupeKey 중복 체크
        if (input.dedupeKey) {
            const existing = this.db.parentMessages.find(m => m.dedupeKey === input.dedupeKey);
            if (existing) {
                // 중복될 때는 기존 메시지 반환
                return existing;
            }
        }

        const id = 'pm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        const createdAt = new Date().toISOString();

        const pushRequired = input.pushRequired !== undefined ? input.pushRequired : false;
        const pushStatus = input.pushStatus || (pushRequired ? 'pending' : 'not_required');

        const newMessage = {
            id,
            studentId: input.studentId || null,
            parentContactId: input.parentContactId || null,
            parentSlot: input.parentSlot || null,
            recipientName: input.recipientName || null,
            recipientRelation: input.recipientRelation || null,
            recipientPhone: input.recipientPhone || null,
            recipientUserId: input.recipientUserId || null,
            category: input.category || null,
            type: input.type || null,
            title: input.title || null,
            body: input.body || null,
            summary: input.summary || null,
            status: input.status || 'unread',
            isImportant: input.isImportant !== undefined ? input.isImportant : false,
            pushRequired,
            pushStatus,
            relatedDomainType: input.relatedDomainType || null,
            relatedDomainId: input.relatedDomainId || null,
            dedupeKey: input.dedupeKey || null,
            createdAt,
            readAt: input.readAt || null,
            archivedAt: input.archivedAt || null,
            deletedAt: input.deletedAt || null
        };

        this.db.parentMessages.push(newMessage);
        this.saveDB();
        this.notify('PARENT_MESSAGES_CHANGED', this.db.parentMessages);
        return newMessage;
    }
};
