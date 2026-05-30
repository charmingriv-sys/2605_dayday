// attendance.js - Attendance, Checking in and out Domain State Module

export const attendanceMethods = {
    // --- ATTENDANCE ---
    getAttendance() {
        return this.db.attendance;
    },

    getAttendanceForStudent(studentId) {
        return this.db.attendance.filter(a => a.studentId === studentId);
    },

    markAttendance(studentId, date, status, time = '', note = '', videoUrl = '', images = []) {
        // Check if attendance already marked for this day
        const existing = this.db.attendance.find(a => a.studentId === studentId && a.date === date);
        let alertTriggered = false;
        let alertMessage = '';

        if (existing) {
            if (status === 'none') {
                // Remove record
                this.db.attendance = this.db.attendance.filter(a => a.id !== existing.id);
            } else {
                existing.status = status;
                existing.time = time;
                existing.note = note;
                existing.videoUrl = videoUrl;
                existing.images = images;
            }
        } else if (status !== 'none') {
            const id = 'A' + (this.db.attendance.length ? Math.max(...this.db.attendance.map(a => parseInt(a.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendance.push({ id, studentId, date, status, time, note, videoUrl, images });
            
            // Set up simulated KakaoTalk notification
            if (this.db.settings.sendKakaoAlert) {
                const student = this.getStudent(studentId);
                const statusKo = status === 'present' ? '등원' : (status === 'late' ? '지각' : '결석');
                alertTriggered = true;
                alertMessage = `[튜링 알림톡]\n안녕하세요. 학부모님.\n${student.name} 원생이 금일(${date} ${time})에 ${statusKo}하였습니다.`;
            }
        }

        this.saveDB();
        this.notify('ATTENDANCE_CHANGED', this.db.attendance);

        // If KakaoTalk alert needs to be dispatched, fire custom DOM event for toast notification
        if (alertTriggered) {
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMessage } });
            window.dispatchEvent(event);
        }
    },

    leaveAttendance(studentId, date, time) {
        // Find existing attendance for this day
        const existing = this.db.attendance.find(a => a.studentId === studentId && a.date === date);
        let alertTriggered = false;
        let alertMessage = '';

        if (existing) {
            // Update the existing record with leavingTime
            existing.leavingTime = time;
        } else {
            // If no attendance record exists, create one with leavingTime
            const id = 'A' + (this.db.attendance.length ? Math.max(...this.db.attendance.map(a => parseInt(a.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendance.push({ id, studentId, date, status: 'present', time: '', leavingTime: time, note: '하원 우선 기록' });
        }

        // Set up simulated KakaoTalk notification for check-out
        if (this.db.settings.sendKakaoAlert) {
            const student = this.getStudent(studentId);
            alertTriggered = true;
            alertMessage = `[튜링 알림톡]\n안녕하세요. 학부모님.\n${student.name} 원생이 금일(${date} ${time})에 하원하였습니다.`;
        }

        this.saveDB();
        this.notify('ATTENDANCE_CHANGED', this.db.attendance);

        if (alertTriggered) {
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMessage } });
            window.dispatchEvent(event);
        }
    }
};
