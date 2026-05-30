import { renderDashboard } from './dashboardView.js';
import { renderStudents } from './membersView.js';
import { renderTeachers } from './staffView.js';
import { renderSchedules } from './sessionsView.js';
import { renderDirectorAttendance, renderKioskAttendance } from './attendanceView.js';
import { renderCommunication, renderApprovals } from './communicationView.js';
import { renderPayments, renderBooks, renderBooksElapsed, renderSubjects } from './billingView.js';
import { renderAcademyInfo } from './settingsView.js';

export {
    renderDashboard,
    renderStudents,
    renderTeachers,
    renderSchedules,
    renderDirectorAttendance,
    renderKioskAttendance,
    renderCommunication,
    renderApprovals,
    renderPayments,
    renderBooks,
    renderBooksElapsed,
    renderSubjects,
    renderAcademyInfo
};
