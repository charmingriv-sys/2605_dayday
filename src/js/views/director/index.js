import { renderDashboard } from './dashboardView.js';
import { renderStudents } from './membersView.js';
import { renderTeachers } from './staffView.js';
import { renderSchedules } from './sessionsView.js';
import { renderDirectorAttendance, renderKioskAttendance } from './attendanceView.js';
import { renderDirectorAttendanceControl } from './attendanceControlView.js';
import { renderMajorSchedule } from './majorScheduleView.js';
import { renderCommunication, renderApprovals } from './communicationView.js';
import { renderPayments, renderBooks, renderBooksElapsed, renderSubjects } from './billingView.js';
import { renderAcademyInfo } from './settingsView.js';
import { renderTodayConsole } from './todayConsoleView.js';
import { renderMessageSend } from './messageSendView.js';

export {
    renderDashboard,
    renderStudents,
    renderTeachers,
    renderSchedules,
    renderDirectorAttendance,
    renderKioskAttendance,
    renderDirectorAttendanceControl,
    renderMajorSchedule,
    renderCommunication,
    renderApprovals,
    renderPayments,
    renderBooks,
    renderBooksElapsed,
    renderSubjects,
    renderAcademyInfo,
    renderTodayConsole,
    renderMessageSend
};
