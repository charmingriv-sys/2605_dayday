import { renderDashboard } from './dashboardView.js';
import { renderStudents } from './membersView.js';
import { renderTeachers } from './staffView.js';
import { renderSchedules } from './sessionsView.js';
import { renderDirectorAttendance, renderKioskAttendance } from './attendanceView.js';
import { renderDirectorAttendanceControl } from './attendanceControlView.js';
import { renderCommunication, renderApprovals } from './communicationView.js';
import { renderPayments, renderBooks, renderBooksElapsed, renderSubjects } from './billingView.js';
import { renderAcademyInfo } from './settingsView.js';
import { renderTodayConsole } from './todayConsoleView.js';

export {
    renderDashboard,
    renderStudents,
    renderTeachers,
    renderSchedules,
    renderDirectorAttendance,
    renderKioskAttendance,
    renderDirectorAttendanceControl,
    renderCommunication,
    renderApprovals,
    renderPayments,
    renderBooks,
    renderBooksElapsed,
    renderSubjects,
    renderAcademyInfo,
    renderTodayConsole
};
