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
    }
};
