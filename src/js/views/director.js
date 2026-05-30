import { stateStore } from '../state.js';
import { openModal, closeModal } from '../app.js';
import { PhoneNumberInput, AddressInput } from '../utils/inputHelper.js';
import { renderParentPortal } from './parent.js';

let isAcademyInfoAuthenticated = false;

function formatPhoneNumber(value) {
    if (!value) return value;
    const clean = value.replace(/[^\d]/g, '');
    const digits = clean.slice(0, 11);
    const len = digits.length;
    if (len < 4) {
        return digits;
    } else if (len < 8) {
        return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
}

function isIncompleteStudent(student) {
    if (!student) return false;
    // Incomplete status logic:
    // 1. Both contacts are missing/empty/null/None
    const hasPhone = student.phone && student.phone !== '없음' && String(student.phone).trim() !== '';
    const hasParentPhone = student.parentPhone && student.parentPhone !== '없음' && String(student.parentPhone).trim() !== '';
    const contactMissing = !hasPhone && !hasParentPhone;

    // 2. Teacher is missing/empty
    const teacherMissing = !student.teacherId;

    // 3. Billing due day is missing
    const dueDayMissing = student.dueDay === undefined || student.dueDay === null || student.dueDay === '';

    // 4. Tuition fee is missing or null
    const feeMissing = student.fee === undefined || student.fee === null || student.fee === '';

    return contactMissing || teacherMissing || dueDayMissing || feeMissing;
}

const showKakaoTalkToast = (message) => {
    const event = new CustomEvent('kakaotalk-alert', {
        detail: { message }
    });
    window.dispatchEvent(event);
};

const showLocalConfirm = (container, message, onYes) => {
    container.style.position = 'relative';
    const confirmOverlay = document.createElement('div');
    confirmOverlay.style.position = 'absolute';
    confirmOverlay.style.top = '0';
    confirmOverlay.style.left = '0';
    confirmOverlay.style.width = '100%';
    confirmOverlay.style.height = '100%';
    confirmOverlay.style.background = 'rgba(15, 23, 42, 0.8)';
    confirmOverlay.style.backdropFilter = 'blur(4px)';
    confirmOverlay.style.webkitBackdropFilter = 'blur(4px)';
    confirmOverlay.style.display = 'flex';
    confirmOverlay.style.flexDirection = 'column';
    confirmOverlay.style.justifyContent = 'center';
    confirmOverlay.style.alignItems = 'center';
    confirmOverlay.style.padding = '20px';
    confirmOverlay.style.boxSizing = 'border-box';
    confirmOverlay.style.borderRadius = 'var(--radius-lg)';
    confirmOverlay.style.zIndex = '100';

    confirmOverlay.innerHTML = `
        <div style="background: #ffffff; padding: 24px; max-width: 320px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; border-radius: var(--radius-lg); box-sizing: border-box; transition: none;">
            <p style="font-size: 1rem; font-weight: 700; color: #000000; margin-bottom: 20px; line-height: 1.5; text-align: center; font-family: inherit;">${message}</p>
            <div style="display: flex; gap: 12px;">
                <button type="button" class="btn btn-secondary btn-confirm-no" style="flex: 1; display: flex; justify-content: center; align-items: center; height: 38px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-size: 0.9rem; font-weight: 600; margin: 0; padding: 0 16px; border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">아니오</button>
                <button type="button" class="btn btn-primary btn-confirm-yes" style="flex: 1; display: flex; justify-content: center; align-items: center; height: 38px; background: var(--primary); color: #ffffff; border: 1px solid var(--primary); font-size: 0.9rem; font-weight: 600; margin: 0; padding: 0 16px; border-radius: var(--radius-md); cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">예</button>
            </div>
        </div>
    `;

    container.appendChild(confirmOverlay);

    confirmOverlay.querySelector('.btn-confirm-no').addEventListener('click', () => {
        confirmOverlay.remove();
    });

    confirmOverlay.querySelector('.btn-confirm-yes').addEventListener('click', () => {
        confirmOverlay.remove();
        onYes();
    });
};

/**
 * 1. 종합 분석 대시보드 (renderDashboard)
 * Renders KPI cards, a stylized SVG monthly revenue chart (comparing April & May),
 * today's class schedule, and today's alert panel (students marked absent or late).
 */
export function renderDashboard(container) {
    const render = () => {
        const students = stateStore.getStudents();
        const teachers = stateStore.getTeachers();
        const payments = stateStore.getPayments();
        const classes = stateStore.getClasses();
        const attendance = stateStore.getAttendance();

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const currentMonthPayments = payments.filter(p => p.month === currentMonth);
        const paidTuition = currentMonthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
        const unpaidTuition = currentMonthPayments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + p.amount, 0);

        // Revenue chart calculations (April vs May)
        const aprilPayments = payments.filter(p => p.month === '2026-04');
        const mayPayments = payments.filter(p => p.month === '2026-05');

        const aprilBilled = aprilPayments.reduce((sum, p) => sum + p.amount, 0);
        const aprilPaid = aprilPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

        const mayBilled = mayPayments.reduce((sum, p) => sum + p.amount, 0);
        const mayPaid = mayPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

        // Dynamic scale computation for SVG bar chart
        const maxVal = Math.max(aprilBilled, mayBilled, 100000) * 1.15;
        const chartHeight = 140; // Max height of bars in pixels
        const getH = (val) => (val / maxVal) * chartHeight;

        const hApBilled = getH(aprilBilled);
        const hApPaid = getH(aprilPaid);
        const hMayBilled = getH(mayBilled);
        const hMayPaid = getH(mayPaid);

        const yApBilled = 160 - hApBilled;
        const yApPaid = 160 - hApPaid;
        const yMayBilled = 160 - hMayBilled;
        const yMayPaid = 160 - hMayPaid;

        // Today's classes schedule
        const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
        const todayKo = daysKo[new Date().getDay()];
        const todayDateStr = new Date().toISOString().slice(0, 10);
        
        const todayClasses = classes
            .filter(c => c.dayOfWeek === todayKo)
            .map(c => {
                const s = students.find(stud => stud.id === c.studentId);
                const t = s ? teachers.find(teach => teach.id === s.teacherId) : null;
                const att = s ? attendance.find(a => a.studentId === s.id && a.date === todayDateStr) : null;
                return { ...c, student: s, teacher: t, attendance: att };
            })
            .filter(c => c.student) // Filter out orphaned class records if any
            .sort((a, b) => a.time.localeCompare(b.time));

        // Today's alerts (absent or late)
        const todayAlerts = attendance
            .filter(a => a.date === todayDateStr && (a.status === 'absent' || a.status === 'late'))
            .map(a => {
                const s = students.find(stud => stud.id === a.studentId);
                const t = s ? teachers.find(teach => teach.id === s.teacherId) : null;
                return { ...a, student: s, teacher: t };
            })
            .filter(a => a.student);

        container.innerHTML = `
            <!-- KPI Metrics -->
            <div class="metrics-grid">
                <div class="glass-card metric-card">
                    <div class="metric-icon purple">
                        <i class="fa-solid fa-graduation-cap"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label">총 원생 수</span>
                        <span class="metric-value">${students.filter(s => s.status !== 'withdrawn').length}명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon cyan">
                        <i class="fa-solid fa-chalkboard-user"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label">활동 강사 수</span>
                        <span class="metric-value">${teachers.length}명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon green">
                        <i class="fa-solid fa-wallet"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label">이번 달 납부 완료</span>
                        <span class="metric-value">${paidTuition.toLocaleString()}원</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon red">
                        <i class="fa-solid fa-receipt"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label">이번 달 미납 수강료</span>
                        <span class="metric-value">${unpaidTuition.toLocaleString()}원</span>
                    </div>
                </div>
            </div>

            <!-- Lower Sections Grid -->
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-top: 24px;" class="dashboard-details-grid">
                <!-- Column 1: Today's Classes (Larger, more visible) -->
                <div class="glass-card" style="display: flex; flex-direction: column; min-height: 440px;">
                    <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-calendar-day" style="color: var(--accent);"></i>
                        오늘의 수업 일정 (${todayKo}요일)
                    </h3>
                    <div class="table-wrapper" style="overflow-y: auto; margin-top: 0; flex-grow: 1;">
                        ${
                            todayClasses.length === 0
                                ? `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">오늘 예정된 수업이 없습니다.</div>`
                                : `
                                <table class="custom-table" style="font-size: 0.85rem;">
                                    <thead>
                                        <tr>
                                            <th style="padding: 10px 8px;">시간</th>
                                            <th style="padding: 10px 8px;">원생 (악기)</th>
                                            <th style="padding: 10px 8px;">담당 강사</th>
                                            <th style="padding: 10px 8px; text-align: right;">출결</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${todayClasses.map(c => {
                                            let statusBadge = `<span class="badge badge-info" style="padding: 2px 6px;">수업 대기</span>`;
                                            if (c.attendance) {
                                                if (c.attendance.status === 'present') {
                                                    statusBadge = `<span class="badge badge-success" style="padding: 2px 6px;">등원 (${c.attendance.time})</span>`;
                                                } else if (c.attendance.status === 'late') {
                                                    statusBadge = `<span class="badge badge-warning" style="padding: 2px 6px;">지각 (${c.attendance.time})</span>`;
                                                } else if (c.attendance.status === 'absent') {
                                                    statusBadge = `<span class="badge badge-danger" style="padding: 2px 6px;">결석</span>`;
                                                }
                                            }
                                            return `
                                                <tr>
                                                    <td style="padding: 8px; font-weight: 600; color: var(--accent);">${c.time}</td>
                                                    <td style="padding: 8px; font-weight: 600;">${c.student.name} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${c.student.instrument})</span></td>
                                                    <td style="padding: 8px;">${c.teacher ? c.teacher.name : '미지정'}</td>
                                                    <td style="padding: 8px; text-align: right;">${statusBadge}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                                `
                        }
                    </div>
                </div>

                <!-- Column 2: SVG Revenue Chart & Attendance Alerts -->
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <!-- Monthly Revenue Analysis -->
                    <div class="glass-card" style="display: flex; flex-direction: column; min-height: 260px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0;">
                                <i class="fa-solid fa-chart-simple" style="color: var(--primary);"></i>
                                월별 수납 분석
                            </h3>
                            <div style="display: flex; gap: 12px; font-size: 0.7rem;">
                                <span style="display: flex; align-items: center; gap: 4px;">
                                    <span style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%;"></span>
                                    청구
                                </span>
                                <span style="display: flex; align-items: center; gap: 4px;">
                                    <span style="width: 8px; height: 8px; background: var(--success); border-radius: 50%;"></span>
                                    수납
                                </span>
                            </div>
                        </div>
                        
                        <div class="chart-container" style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 5px 0;">
                            <svg viewBox="0 0 380 200" style="width: 100%; height: 100%; overflow: visible;">
                                <defs>
                                    <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="var(--success)" />
                                        <stop offset="100%" stop-color="var(--success-light)" stop-opacity="0.2" />
                                    </linearGradient>
                                    <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="var(--primary)" />
                                        <stop offset="100%" stop-color="var(--primary-light)" stop-opacity="0.2" />
                                    </linearGradient>
                                </defs>
                                
                                <!-- Grid lines -->
                                <line x1="50" y1="20" x2="350" y2="20" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3" />
                                <line x1="50" y1="90" x2="350" y2="90" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3" />
                                <line x1="50" y1="160" x2="350" y2="160" stroke="rgba(255,255,255,0.12)" />

                                <!-- Y Axis Labels -->
                                <text x="42" y="23" fill="var(--text-muted)" font-size="9" text-anchor="end">${(maxVal * 1.0).toFixed(0) >= 100000 ? Math.round(maxVal / 10000) + '만원' : Math.round(maxVal) + '원'}</text>
                                <text x="42" y="93" fill="var(--text-muted)" font-size="9" text-anchor="end">${(maxVal * 0.5).toFixed(0) >= 100000 ? Math.round((maxVal * 0.5) / 10000) + '만원' : Math.round(maxVal * 0.5) + '원'}</text>
                                <text x="42" y="163" fill="var(--text-muted)" font-size="9" text-anchor="end">0원</text>

                                <!-- April Bars -->
                                <rect x="95" y="${yApBilled}" width="22" height="${hApBilled}" rx="4" fill="url(#billedGrad)" stroke="var(--primary)" stroke-width="1.5">
                                    <title>4월 청구액: ${aprilBilled.toLocaleString()}원</title>
                                </rect>
                                <rect x="122" y="${yApPaid}" width="22" height="${hApPaid}" rx="4" fill="url(#paidGrad)" stroke="var(--success)" stroke-width="1.5">
                                    <title>4월 수납액: ${aprilPaid.toLocaleString()}원</title>
                                </rect>
                                <text x="120" y="180" fill="var(--text-muted)" font-size="9" text-anchor="middle">청구:${Math.round(aprilBilled/10000)}만/수납:${Math.round(aprilPaid/10000)}만</text>

                                <!-- May Bars -->
                                <rect x="225" y="${yMayBilled}" width="22" height="${hMayBilled}" rx="4" fill="url(#billedGrad)" stroke="var(--primary)" stroke-width="1.5">
                                    <title>5월 청구액: ${mayBilled.toLocaleString()}원</title>
                                </rect>
                                <rect x="252" y="${yMayPaid}" width="22" height="${hMayPaid}" rx="4" fill="url(#paidGrad)" stroke="var(--success)" stroke-width="1.5">
                                    <title>5월 수납액: ${mayPaid.toLocaleString()}원</title>
                                </rect>
                                <text x="250" y="180" fill="var(--text-muted)" font-size="9" text-anchor="middle">청구:${Math.round(mayBilled/10000)}만/수납:${Math.round(mayPaid/10000)}만</text>

                                <!-- X Axis Labels -->
                                <text x="120" y="196" fill="var(--text-main)" font-size="10.5" text-anchor="middle" font-weight="600">4월 수납</text>
                                <text x="250" y="196" fill="var(--text-main)" font-size="10.5" text-anchor="middle" font-weight="600">5월 (당월)</text>
                            </svg>
                        </div>
                    </div>

                    <!-- Attendance Alerts -->
                    <div class="glass-card" style="display: flex; flex-direction: column; min-height: 180px;">
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>
                            실시간 출결 특이사항
                        </h3>
                        <div style="overflow-y: auto; flex-grow: 1; max-height: 160px;">
                            ${
                                todayAlerts.length === 0
                                    ? `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem 0; font-size: 0.9rem;">오늘의 지각/결석 학생이 없습니다.</div>`
                                    : todayAlerts.map(a => {
                                        const badgeClass = a.status === 'late' ? 'badge-warning' : 'badge-danger';
                                        const statusLabel = a.status === 'late' ? '지각' : '결석';
                                        return `
                                            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                                                <span class="badge ${badgeClass}" style="flex-shrink: 0; min-width: 46px; text-align: center; padding: 4px 8px;">${statusLabel}</span>
                                                <div style="flex-grow: 1; font-size: 0.85rem;">
                                                    <div style="font-weight: 600; color: var(--text-main);">
                                                        ${a.student.name} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${a.student.instrument} | 담당: ${a.teacher ? a.teacher.name : '없음'})</span>
                                                    </div>
                                                    ${a.time ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">체크 시간: ${a.time}</div>` : ''}
                                                    ${a.note ? `<div style="font-size: 0.8rem; color: var(--secondary); margin-top: 4px; font-style: italic; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 4px;">사유: ${a.note}</div>` : ''}
                                                </div>
                                            </div>
                                        `;
                                    }).join('')
                            }
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @media (max-width: 1024px) {
                    .dashboard-details-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>
        `;
    };

    render();

    // Subscribe to state updates
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', render);
    const unsubClasses = stateStore.subscribe('CLASSES_CHANGED', render);
    const unsubAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', render);
    const unsubPayments = stateStore.subscribe('PAYMENTS_CHANGED', render);

    // Return cleanup to avoid memory leaks
    return () => {
        unsubStudents();
        unsubTeachers();
        unsubClasses();
        unsubAttendance();
        unsubPayments();
    };
}

/**
 * 2. 원생 명부 관리 (renderStudents)
 * Renders a list of students with filter/search capability.
 * Includes "Add Student" modal trigger, editing, and deletion.
 */
    const openDeleteAuthModal = (studentId, onSuccess) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-lock" style="color: var(--danger); margin-right: 8px;"></i>삭제 보안 인증</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.2rem;">
                    원생 정보를 삭제하려면 <strong>시스템 비밀번호</strong>를 입력해 주세요.
                </p>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="delete-system-password" style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 6px;">시스템 비밀번호 (4자리)</label>
                    <input type="password" id="delete-system-password" class="form-control" placeholder="••••" maxlength="4" style="text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem; height: 50px;">
                    <span id="delete-auth-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 6px;"></span>
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; display: flex; gap: 10px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; margin-bottom: 0;">취소</button>
                <button class="btn btn-danger" id="btn-confirm-delete-auth" style="flex: 1; margin-bottom: 0;">확인</button>
            </div>
        `;
        
        const onInit = (contentArea) => {
            const passwordInput = contentArea.querySelector('#delete-system-password');
            const confirmBtn = contentArea.querySelector('#btn-confirm-delete-auth');
            const feedback = contentArea.querySelector('#delete-auth-feedback');
            
            confirmBtn.addEventListener('click', () => {
                const enteredPassword = passwordInput.value;
                const activeAcademy = stateStore.getAcademy(stateStore.getCurrentUser().academyId);
                const systemPassword = activeAcademy ? activeAcademy.systemPassword : '0000';
                
                if (enteredPassword === systemPassword) {
                    closeModal();
                    onSuccess();
                } else {
                    feedback.textContent = '비밀번호가 일치하지 않습니다.';
                    feedback.style.display = 'block';
                    passwordInput.focus();
                }
            });

            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                }
            });
        };

        openModal(modalHtml, onInit);
    };

    const openParentPreviewModal = (studentId) => {
        const student = stateStore.getStudent(studentId);
    if (!student) return;

    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-mobile-screen-button" style="color: var(--accent); margin-right: 8px;"></i><strong>${student.name}</strong> 학부모 화면 미리보기</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.25);">
            <!-- Smartphone frame mockup wrapper -->
            <div class="smartphone-preview-frame" style="width: 360px; height: 680px; border: 12px solid #2d3436; border-radius: 36px; box-shadow: 0 15px 35px rgba(0,0,0,0.6); background: #0f0f1b; overflow: hidden; position: relative; display: flex; flex-direction: column; border-color: #2b2b3a;">
                <!-- Speaker slot -->
                <div class="smartphone-speaker-slot" style="width: 50px; height: 4px; background: #2b2b3a; border-radius: 2px; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 10;"></div>
                
                <!-- Simulated content container -->
                <div id="smartphone-content-container" style="flex: 1; overflow: hidden; height: 100%; display: flex; flex-direction: column;">
                    <!-- Rendered parent portal inside -->
                </div>
            </div>
        </div>
    `;

    const onInit = (contentArea) => {
        const smartContainer = contentArea.querySelector('#smartphone-content-container');
        if (smartContainer) {
            renderParentPortal(smartContainer, studentId);
        }
    };

    openModal(modalHtml, onInit);
};

// --- PRINT AUTOMATION HELPER FUNCTIONS ---
const printStudentRegister = () => {
    const students = stateStore.getStudents();
    const teachers = stateStore.getTeachers();
    const rawSettings = stateStore.getSettings() || {};
    const settings = {
        academyName: rawSettings.academyName || '튜링 음악학원',
        businessNumber: rawSettings.businessNumber || '120-00-00000',
        representative: rawSettings.representative || '김하은',
        address: rawSettings.address || '서울시 서초구 반포동 123-4',
        phone: rawSettings.phone || '02-1234-5678',
        ...rawSettings
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
        return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

    let rowsHtml = sortedStudents.map((s, idx) => {
        const teacher = teachers.find(t => t.id === s.teacherId);
        const birthDate = s.age ? `${2026 - s.age}-01-01` : '-';
        const ageStr = s.age ? ` (${s.age}세)` : '';
        const teacherName = teacher ? teacher.name : '미배정';
        
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td>${birthDate}${ageStr}</td>
                <td>[주소지 미기입 (보안)]</td>
                <td>${s.phone || '-'}</td>
                <td>${s.instrument || '-'}</td>
                <td>${teacherName}</td>
                <td>${s.enrollDate || '-'}</td>
                <td>${s.leaveDate || '-'}</td>
            </tr>
        `;
    }).join('');

    if (sortedStudents.length === 0) {
        rowsHtml = `<tr><td colspan="10" style="text-align:center; padding: 20px;">등록된 원생이 없습니다.</td></tr>`;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>수강생 대장 [별지 제25호서식]</title>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 15mm 10mm;
                }
                body {
                    font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                    color: #000;
                    background: #fff;
                    margin: 0;
                    padding: 0;
                    font-size: 9.5pt;
                    line-height: 1.4;
                }
                .container {
                    width: 100%;
                }
                .header-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 15px;
                }
                .form-title {
                    font-size: 18pt;
                    font-weight: bold;
                    letter-spacing: 2px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 5px;
                    margin: 0;
                }
                .law-ref {
                    font-size: 8pt;
                    color: #555;
                    margin-bottom: 10px;
                }
                .academy-info {
                    font-size: 9.5pt;
                    font-weight: bold;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 8px 5px;
                    text-align: center;
                    vertical-align: middle;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                    font-size: 9pt;
                }
                td {
                    font-size: 9pt;
                }
                .footer {
                    margin-top: 20px;
                    text-align: right;
                    font-size: 8pt;
                    color: #555;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="law-ref">■ 학원의 설립ㆍ운영 및 과외교습에 관한 법률 시행규칙 [별지 제25호서식] &lt;개정 2020. 02. 12.&gt;</div>
                <div class="header-container">
                    <h1 class="form-title">수 강 생 대 장</h1>
                    <div class="academy-info">
                        학원명: ${settings.academyName} &nbsp;|&nbsp; 대표자: ${settings.representative} &nbsp;|&nbsp; 사업자번호: ${settings.businessNumber}
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">연번</th>
                            <th style="width: 10%;">원생 등록번호</th>
                            <th style="width: 10%;">성명</th>
                            <th style="width: 12%;">생년월일(나이)</th>
                            <th style="width: 20%;">주소</th>
                            <th style="width: 12%;">전화번호</th>
                            <th style="width: 10%;">교습과목</th>
                            <th style="width: 8%;">담당강사</th>
                            <th style="width: 10%;">입원(수강)일</th>
                            <th style="width: 10%;">퇴원일</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    출력일시: ${today} / ${settings.academyName} 관리 시스템
                </div>
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                    window.close();
                }, 300);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

const printReceiptRegister = (selectedMonth) => {
    console.log("[Print Debug] Button clicked: btn-print-receipt-register");
    try {
        const payments = stateStore.getPayments();
        const students = stateStore.getStudents();
        const rawSettings = stateStore.getSettings() || {};
        
        const settings = {
            academyName: rawSettings.academyName || '튜링 음악학원',
            businessNumber: rawSettings.businessNumber || '120-00-00000',
            representative: rawSettings.representative || '김하은',
            address: rawSettings.address || '서울시 서초구 반포동 123-4',
            phone: rawSettings.phone || '02-1234-5678',
            ...rawSettings
        };

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            console.error("[Print Debug] printReceiptRegister popup window blocked");
            alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
            return;
        }
        console.log("[Print Debug] printReceiptRegister popup window opened successfully");

        const monthPaidPayments = payments.filter(p => p.month === selectedMonth && p.status === 'paid');
        monthPaidPayments.sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''));

        const yearStr = selectedMonth.slice(0, 4);
        const monthStr = selectedMonth.slice(5, 7);

        let rowsHtml = monthPaidPayments.map((p) => {
            const student = students.find(s => s.id === p.studentId);
            const studentName = student ? student.name : '퇴원 원생';
            const birthDate = student && student.age ? `${2026 - student.age}-01-01` : '-';
            const studentId = student ? student.id : '-';
            const subject = student ? student.instrument : '-';
            const categoryLabel = p.type === 'education' ? '교습비(수강료)' : '교재비';
            const methodLabel = {
                'toss': '토스페이',
                'kakao': '카카오페이',
                'card': '신용카드',
                'cash': '현금 수납'
            }[p.method] || p.method || '-';

            return `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.paidDate || '-'}</td>
                    <td><strong>${studentName}</strong></td>
                    <td>${birthDate}</td>
                    <td>${studentId}</td>
                    <td>${subject}</td>
                    <td style="text-align: right; font-weight: bold;">${p.amount.toLocaleString()}원</td>
                    <td>${categoryLabel}</td>
                    <td>${methodLabel}</td>
                </tr>
            `;
        }).join('');

        if (monthPaidPayments.length === 0) {
            rowsHtml = `<tr><td colspan="9" style="text-align:center; padding: 20px;">해당 월의 수납 완료 내역이 없습니다.</td></tr>`;
        }

        const totalPaidSum = monthPaidPayments.reduce((sum, p) => sum + p.amount, 0);

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>교습비등 영수증 원부 [별지 제24호서식]</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 15mm 10mm;
                    }
                    body {
                        font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                        color: #000;
                        background: #fff;
                        margin: 0;
                        padding: 0;
                        font-size: 9.5pt;
                        line-height: 1.4;
                    }
                    .container {
                        width: 100%;
                    }
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-bottom: 15px;
                    }
                    .form-title {
                        font-size: 18pt;
                        font-weight: bold;
                        letter-spacing: 2px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 5px;
                        margin: 0;
                    }
                    .law-ref {
                        font-size: 8pt;
                        color: #555;
                        margin-bottom: 10px;
                    }
                    .academy-info {
                        font-size: 9.5pt;
                        font-weight: bold;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px 5px;
                        text-align: center;
                        vertical-align: middle;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                        font-size: 9pt;
                    }
                    td {
                        font-size: 9pt;
                    }
                    .total-row {
                        font-weight: bold;
                        background-color: #fafafa;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: right;
                        font-size: 8pt;
                        color: #555;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="law-ref">■ 학원의 설립ㆍ운영 및 과외교습에 관한 법률 시행규칙 [별지 제24호서식] &lt;개정 2020. 02. 12.&gt;</div>
                    <div class="header-container">
                        <h1 class="form-title">교습비등 영수증 원부 (${yearStr}년 ${monthStr}월)</h1>
                        <div class="academy-info">
                            학원명: ${settings.academyName} &nbsp;|&nbsp; 사업자번호: ${settings.businessNumber} &nbsp;|&nbsp; 대표자: ${settings.representative}
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 10%;">영수증 번호</th>
                                <th style="width: 12%;">영수연월일</th>
                                <th style="width: 12%;">성명</th>
                                <th style="width: 12%;">생년월일</th>
                                <th style="width: 10%;">원생 등록번호</th>
                                <th style="width: 12%;">교습과목</th>
                                <th style="width: 12%;">영수액</th>
                                <th style="width: 10%;">구분</th>
                                <th style="width: 10%;">결제방법</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            <tr class="total-row">
                                <td colspan="6" style="text-align: right; padding-right: 15px;">합 계</td>
                                <td style="text-align: right; padding-right: 5px;">${totalPaidSum.toLocaleString()}원</td>
                                <td colspan="2">건수: ${monthPaidPayments.length}건</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="footer">
                        출력일시: ${new Date().toISOString().slice(0, 10)} / ${settings.academyName} 관리 시스템
                    </div>
                </div>
                <script>
                    setTimeout(function() {
                        try {
                            window.print();
                            window.close();
                        } catch(e) {}
                    }, 300);
                </script>
            </body>
            </html>
        `;

        console.log("[Print Debug] printReceiptRegister writing to popup document");
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
    } catch (err) {
        console.error("[Print Debug] printReceiptRegister generation failed:", err);
        alert("인쇄 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
};

const printCashBook = (selectedMonth) => {
    console.log("[Print Debug] Button clicked: btn-print-cash-book");
    try {
        const payments = stateStore.getPayments();
        const students = stateStore.getStudents();
        const rawSettings = stateStore.getSettings() || {};

        const settings = {
            academyName: rawSettings.academyName || '튜링 음악학원',
            businessNumber: rawSettings.businessNumber || '120-00-00000',
            representative: rawSettings.representative || '김하은',
            address: rawSettings.address || '서울시 서초구 반포동 123-4',
            phone: rawSettings.phone || '02-1234-5678',
            ...rawSettings
        };

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            console.error("[Print Debug] printCashBook popup window blocked");
            alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
            return;
        }
        console.log("[Print Debug] printCashBook popup window opened successfully");

        const monthPaidPayments = payments.filter(p => p.month === selectedMonth && p.status === 'paid');
        monthPaidPayments.sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''));

        const yearStr = selectedMonth.slice(0, 4);
        const monthStr = selectedMonth.slice(5, 7);

        let cumulativeBalance = 0;
        let rowsHtml = monthPaidPayments.map((p) => {
            const student = students.find(s => s.id === p.studentId);
            const studentName = student ? student.name : '퇴원 원생';
            const typeStr = p.type === 'education' ? '교육비 수납' : '교재비 수납';
            const desc = `${studentName} ${typeStr} (${p.id})`;
            const income = p.amount;
            const expense = 0;
            cumulativeBalance += income;

            return `
                <tr>
                    <td>${p.paidDate || '-'}</td>
                    <td style="text-align: left; padding-left: 15px;">${desc}</td>
                    <td style="text-align: right; font-weight: bold;">${income.toLocaleString()}원</td>
                    <td style="text-align: right; color: #888;">0원</td>
                    <td style="text-align: right; font-weight: bold;">${cumulativeBalance.toLocaleString()}원</td>
                </tr>
            `;
        }).join('');

        if (monthPaidPayments.length === 0) {
            rowsHtml = `<tr><td colspan="5" style="text-align:center; padding: 20px;">해당 월의 현금 및 결제 출납 내역이 없습니다.</td></tr>`;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>현금출납부</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 15mm 10mm;
                    }
                    body {
                        font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                        color: #000;
                        background: #fff;
                        margin: 0;
                        padding: 0;
                        font-size: 9.5pt;
                        line-height: 1.4;
                    }
                    .container {
                        width: 100%;
                    }
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-bottom: 15px;
                    }
                    .form-title {
                        font-size: 18pt;
                        font-weight: bold;
                        letter-spacing: 2px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 5px;
                        margin: 0;
                    }
                    .law-ref {
                        font-size: 8pt;
                        color: #555;
                        margin-bottom: 10px;
                    }
                    .academy-info {
                        font-size: 9.5pt;
                        font-weight: bold;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px 5px;
                        text-align: center;
                        vertical-align: middle;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                        font-size: 9pt;
                    }
                    td {
                        font-size: 9pt;
                    }
                    .total-row {
                        font-weight: bold;
                        background-color: #fafafa;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: right;
                        font-size: 8pt;
                        color: #555;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="law-ref">■ 학원 회계 및 재무 관리 비치 대장</div>
                    <div class="header-container">
                        <h1 class="form-title">현 금 출 납 부 (${yearStr}년 ${monthStr}월)</h1>
                        <div class="academy-info">
                            학원명: ${settings.academyName} &nbsp;|&nbsp; 사업자번호: ${settings.businessNumber} &nbsp;|&nbsp; 대표자: ${settings.representative}
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%;">수납 날짜</th>
                                <th style="width: 40%; text-align: left; padding-left: 15px;">적요</th>
                                <th style="width: 15%;">수입액 (Income)</th>
                                <th style="width: 15%;">지출액 (Expense)</th>
                                <th style="width: 15%;">누적 잔액 (Balance)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            <tr class="total-row">
                                <td colspan="2" style="text-align: right; padding-right: 15px;">월계 합계</td>
                                <td style="text-align: right; padding-right: 5px;">${cumulativeBalance.toLocaleString()}원</td>
                                <td style="text-align: right; padding-right: 5px;">0원</td>
                                <td style="text-align: right; padding-right: 5px;">${cumulativeBalance.toLocaleString()}원</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="footer">
                        출력일시: ${new Date().toISOString().slice(0, 10)} / ${settings.academyName} 관리 시스템
                    </div>
                </div>
                <script>
                    setTimeout(function() {
                        try {
                            window.print();
                            window.close();
                        } catch(e) {}
                    }, 300);
                </script>
            </body>
            </html>
        `;

        console.log("[Print Debug] printCashBook writing to popup document");
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
    } catch (err) {
        console.error("[Print Debug] printCashBook generation failed:", err);
        alert("인쇄 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
};

const generateNtsCertificatePrintout = (studentId, parentInfo) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;
    const rawSettings = stateStore.getSettings() || {};
    const settings = {
        academyName: rawSettings.academyName || '튜링 음악학원',
        businessNumber: rawSettings.businessNumber || '120-00-00000',
        representative: rawSettings.representative || '김하은',
        address: rawSettings.address || '서울시 서초구 반포동 123-4',
        phone: rawSettings.phone || '02-1234-5678',
        ...rawSettings
    };

    const allPayments = stateStore.getPayments();
    const filteredPayments = allPayments.filter(p => {
        const isPaid = p.status === 'paid';
        const isEdu = p.type === 'education';
        const isStudent = p.studentId === studentId;
        if (!isPaid || !isEdu || !isStudent) return false;
        
        const payDateVal = p.paidDate || p.invoiceDate;
        return payDateVal && payDateVal.startsWith(parentInfo.year.toString());
    });

    filteredPayments.sort((a, b) => (a.paidDate || a.invoiceDate).localeCompare(b.paidDate || b.invoiceDate));

    let totalBilled = 0;
    let tableIRows = '';
    filteredPayments.forEach(p => {
        const payDateVal = p.paidDate || p.invoiceDate;
        const yearMonth = payDateVal ? payDateVal.substring(0, 7).replace('-', '.') : '';
        totalBilled += p.amount;
        tableIRows += `
            <tr>
                <td style="height: 25px;">${yearMonth}</td>
                <td>학원</td>
                <td>수업료</td>
                <td style="text-align: right; padding-right: 8px;">${p.amount.toLocaleString()}</td>
                <td style="text-align: right; padding-right: 8px;">0</td>
                <td style="text-align: right; padding-right: 8px; font-weight: bold;">${p.amount.toLocaleString()}</td>
            </tr>
        `;
    });

    const minTableIRows = 4;
    if (filteredPayments.length < minTableIRows) {
        const padCount = minTableIRows - filteredPayments.length;
        for (let i = 0; i < padCount; i++) {
            tableIRows += `
                <tr>
                    <td style="height: 25px;">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
            `;
        }
    }

    tableIRows += `
        <tr style="background-color: #fcfcfc; font-weight: bold;">
            <td style="height: 25px;">계</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td style="text-align: right; padding-right: 8px;">${totalBilled.toLocaleString()}</td>
            <td style="text-align: right; padding-right: 8px;">0</td>
            <td style="text-align: right; padding-right: 8px;">${totalBilled.toLocaleString()}</td>
        </tr>
    `;

    let tableIIRows = '';
    for (let i = 0; i < 3; i++) {
        tableIIRows += `
            <tr>
                <td style="height: 25px;">&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
            </tr>
        `;
    }
    tableIIRows += `
        <tr style="background-color: #fcfcfc; font-weight: bold;">
            <td style="height: 25px;">계</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td style="text-align: right; padding-right: 8px;">0</td>
        </tr>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
        return;
    }

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const dateStrFormatted = `${todayYear}년 ${todayMonth}월 ${todayDay}일`;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>교육비 납입 증명서 [별지 제44호서식]</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 15mm 15mm 15mm 15mm;
                }
                body {
                    font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                    color: #000;
                    background: #fff;
                    margin: 0;
                    padding: 0;
                    font-size: 9pt;
                    line-height: 1.4;
                }
                .container {
                    width: 100%;
                }
                .law-title {
                    font-size: 7.5pt;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 1.5px solid #000;
                    padding-bottom: 4px;
                    margin-bottom: 20px;
                }
                .main-title {
                    text-align: center;
                    font-size: 20pt;
                    font-weight: bold;
                    margin: 15px 0 25px 0;
                    letter-spacing: 4px;
                }
                table.form-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                table.form-table th, table.form-table td {
                    border: 1px solid #000;
                    padding: 6px 8px;
                    text-align: left;
                    vertical-align: middle;
                }
                table.form-table th {
                    background-color: #f2f2f2;
                    font-weight: normal;
                    text-align: center;
                    font-size: 8.5pt;
                }
                table.form-table td {
                    font-size: 8.5pt;
                }
                .section-title {
                    font-weight: bold;
                    font-size: 10pt;
                    margin: 15px 0 6px 0;
                }
                .cert-text {
                    text-align: center;
                    font-size: 10.5pt;
                    line-height: 1.8;
                    margin: 35px 0;
                }
                .signature-block {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 25px 0;
                }
                .signature-row {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    margin-top: 10px;
                    font-size: 11pt;
                    position: relative;
                }
                .red-stamp {
                    position: absolute;
                    right: calc(50% - 100px);
                    width: 44px;
                    height: 44px;
                    border: 2px solid #ff0000;
                    border-radius: 50%;
                    color: #ff0000;
                    font-size: 7pt;
                    font-family: 'Batang', 'Gungsuh', serif;
                    font-weight: bold;
                    line-height: 12px;
                    text-align: center;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    transform: rotate(-3deg);
                    user-select: none;
                    background: transparent;
                }
                .how-to-write {
                    margin-top: 25px;
                    border-top: 1px dashed #777;
                    padding-top: 10px;
                    font-size: 7.5pt;
                    color: #444;
                    line-height: 1.5;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="law-title">
                    <span>■ 소득세법 시행규칙 [별지 제44호서식] &lt;개정 2018. 3. 21.&gt;</span>
                    <span>(앞 쪽)</span>
                </div>
                
                <h1 class="main-title">교 육 비 납 입 증 명 서</h1>
                
                <table class="form-table">
                    <tr>
                        <th style="width: 15%; height: 32px;">① 상 호</th>
                        <td style="width: 35%;">${settings.academyName}</td>
                        <th style="width: 18%;">② 사업자등록번호</th>
                        <td style="width: 32%;">${settings.businessNumber}</td>
                    </tr>
                    <tr>
                        <th style="height: 32px;">③ 대표자</th>
                        <td>${settings.representative}</td>
                        <th>④ 전 화 번 호</th>
                        <td>${settings.phone}</td>
                    </tr>
                    <tr>
                        <th style="height: 32px;">⑤ 주 소</th>
                        <td colspan="3">${settings.address}</td>
                    </tr>
                    <tr>
                        <th rowspan="2" style="text-align: center;">신청인</th>
                        <th style="height: 32px;">⑥ 성 명</th>
                        <td>${parentInfo.parentName}</td>
                        <th>⑦ 주민등록번호</th>
                        <td>${parentInfo.parentResidentId}</td>
                    </tr>
                    <tr>
                        <th style="height: 32px;">⑧ 주 소</th>
                        <td colspan="3">${parentInfo.parentAddress}</td>
                    </tr>
                    <tr>
                        <th rowspan="2" style="text-align: center;">대상자</th>
                        <th style="height: 32px;">⑨ 성 명</th>
                        <td><strong>${student.name}</strong></td>
                        <th>⑩ 신청인과의 관계</th>
                        <td>${parentInfo.relationship}</td>
                    </tr>
                </table>

                <div class="section-title">Ⅰ. 교육비 부담 명세</div>
                <table class="form-table" style="text-align: center;">
                    <thead>
                        <tr>
                            <th style="width: 15%; height: 28px;">⑪ 납부연월</th>
                            <th style="width: 15%;">⑫ 종 류</th>
                            <th style="width: 15%;">⑬ 구 분</th>
                            <th style="width: 18%;">⑭ 총교육비(A)</th>
                            <th style="width: 15%;">장학금 등(B)</th>
                            <th style="width: 22%;">공제대상 교육비부담액<br>(C=A-B)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableIRows}
                    </tbody>
                </table>

                <div class="section-title">Ⅱ. 교복 구입 명세</div>
                <table class="form-table" style="text-align: center;">
                    <thead>
                        <tr>
                            <th style="width: 15%; height: 28px;">구입연월</th>
                            <th style="width: 25%;">품 목</th>
                            <th style="width: 15%;">수 량</th>
                            <th style="width: 20%;">단 가</th>
                            <th style="width: 25%;">금 액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableIIRows}
                    </tbody>
                </table>

                <table class="form-table">
                    <tr>
                        <th style="width: 15%; height: 32px; text-align: center;">사용목적</th>
                        <td>교육비공제 신청용</td>
                    </tr>
                </table>

                <div class="cert-text">
                    「소득세법 시행령」 제113조제1항에 따라 위와 같이 교육비를 지출하였음을 증명해 주시기 바랍니다.
                </div>

                <div class="signature-block">
                    <div style="font-size: 10pt;">${dateStrFormatted}</div>
                    <div class="signature-row" style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 4px;">
                        <span>신청인 :</span>
                        <span style="font-weight: bold; border-bottom: 1px solid #000; min-width: 120px; text-align: center; display: inline-block; margin: 0 8px;">${parentInfo.parentName}</span>
                        <span>(서명 또는 인)</span>
                    </div>
                </div>

                <div style="border-top: 1px solid #000; margin: 20px 0;"></div>

                <div class="cert-text" style="margin: 25px 0 15px 0;">
                    위와 같이 교육비를 지출하였음을 증명합니다.
                </div>

                <div class="signature-block" style="margin-top: 10px;">
                    <div style="font-size: 10pt;">${dateStrFormatted}</div>
                    <div class="signature-row" style="margin-top: 15px; font-weight: bold; font-size: 12pt; display: flex; justify-content: center; align-items: center; gap: 4px;">
                        <span>확인자 : ${settings.academyName} 대표자 ${settings.representative}</span>
                        <span style="position: relative; display: inline-block; margin-left: 8px;">
                            (서명 또는 인)
                            ${settings.directorSignature ? `
                                <img src="${settings.directorSignature}" class="director-stamp-img" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; object-fit: contain;">
                            ` : ''}
                        </span>
                    </div>
                </div>

                <div class="how-to-write">
                    <span style="font-weight: bold; display: block; margin-bottom: 4px;">&lt;작성방법&gt;</span>
                    1. "신청인" 란에는 교육비를 지출한 소득자의 인적사항을 적습니다.<br>
                    2. "대상자" 란에는 지출된 교육비의 수혜자를 적습니다.<br>
                    3. "Ⅰ. 교육비부담명세"란에는 교복구입비용은 적지 않습니다. 교복구입비용(중ㆍ고등학생에 한정함)은 "Ⅱ. 교복구입명세"란에 적습니다.<br>
                    4. "⑫ 종류" 란에는 학원 등으로 구분하여 적습니다. "⑬ 구분" 란에는 수업료 등으로 구분하여 적습니다.
                </div>
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                    window.close();
                }, 300);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

const openNtsCertificatePrintModal = (studentId) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;

    const currentYear = new Date().getFullYear();
    let yearOptions = '';
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
        yearOptions += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}년</option>`;
    }

    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-print" style="color: #00adb5; margin-right: 8px;"></i>교육비 납입 증명서 정보 입력</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.2rem;">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">
                <i class="fa-solid fa-circle-info" style="color: #00adb5; margin-right: 4px;"></i>
                주민등록번호 등 개인정보는 저장되지 않으며, 일회성 인쇄 문서 생성 목적으로만 사용됩니다.
            </p>
            <form id="nts-input-form" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="form-group">
                    <label for="nts-year">귀속 연도</label>
                    <select id="nts-year" class="form-control" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                        ${yearOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="nts-parent-name">신청인(학부모) 성명</label>
                    <input type="text" id="nts-parent-name" class="form-control" required placeholder="예: 김학부" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
                <div class="form-group">
                    <label for="nts-parent-resident-id">주민등록번호</label>
                    <input type="text" id="nts-parent-resident-id" class="form-control" required placeholder="예: 800101-1234567" maxlength="14" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
                <div class="form-group">
                    <label for="nts-relationship">대상자(학생)와의 관계</label>
                    <input type="text" id="nts-relationship" class="form-control" value="자" required placeholder="예: 자, 녀, 부, 모" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; display: block;">주소 <span style="color: var(--danger);">*</span></label>
                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                        <input type="text" id="nts-parent-postcode" class="form-control" readonly placeholder="우편번호" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem; flex-grow: 1; margin-bottom: 0;">
                        <button type="button" id="btn-nts-parent-address-search" class="btn btn-secondary" style="padding: 0 12px; font-size: 0.85rem; margin-bottom: 0; flex-shrink: 0; justify-content: center; background: var(--secondary); color: var(--text-main);">주소 검색</button>
                    </div>
                    <input type="text" id="nts-parent-address" class="form-control" readonly placeholder="기본 주소지" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem; margin-bottom: 8px;">
                    <input type="text" id="nts-parent-address-detail" class="form-control" placeholder="상세주소 입력" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
            </form>
        </div>
        <div class="modal-footer" style="padding: 1.2rem; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
            <button class="btn btn-secondary" data-close-modal style="flex: 1; justify-content: center;">취소</button>
            <button class="btn btn-primary" id="btn-submit-nts-print" style="flex: 1; justify-content: center; background: #00adb5; border-color: #00adb5; color: #fff;">인쇄하기</button>
        </div>
    `;

    const onInit = (contentArea) => {
        const addressBinder = AddressInput.bind({
            postcodeEl: contentArea.querySelector('#nts-parent-postcode'),
            addressEl: contentArea.querySelector('#nts-parent-address'),
            detailAddressEl: contentArea.querySelector('#nts-parent-address-detail'),
            searchBtnEl: contentArea.querySelector('#btn-nts-parent-address-search')
        });

        const destroyBinder = () => {
            addressBinder.destroy();
        };

        contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
            el.addEventListener('click', destroyBinder);
        });

        const residentInput = contentArea.querySelector('#nts-parent-resident-id');
        if (residentInput) {
            residentInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/[^0-9]/g, '');
                if (val.length > 6) {
                    val = val.substring(0, 6) + '-' + val.substring(6, 13);
                }
                e.target.value = val;
            });
        }

        const submitBtn = contentArea.querySelector('#btn-submit-nts-print');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const year = parseInt(contentArea.querySelector('#nts-year').value);
                const parentName = contentArea.querySelector('#nts-parent-name').value.trim();
                const parentResidentId = contentArea.querySelector('#nts-parent-resident-id').value.trim();
                const relationship = contentArea.querySelector('#nts-relationship').value.trim();
                
                const parentPostcode = contentArea.querySelector('#nts-parent-postcode').value.trim();
                const parentAddressBasic = contentArea.querySelector('#nts-parent-address').value.trim();
                const parentAddressDetail = contentArea.querySelector('#nts-parent-address-detail').value.trim();

                if (!parentName || !parentResidentId || !relationship || !addressBinder.isValid()) {
                    alert('모든 필수 입력 값을 채워주세요.');
                    return;
                }

                if (parentResidentId.length < 14) {
                    alert('올바른 주민등록번호 13자리를 입력해주세요.');
                    return;
                }

                destroyBinder();
                closeModal();

                const parentAddress = `[${parentPostcode}] ${parentAddressBasic} ${parentAddressDetail}`;

                generateNtsCertificatePrintout(studentId, {
                    year,
                    parentName,
                    parentResidentId,
                    relationship,
                    parentAddress
                });
            });
        }
    };

    openModal(modalHtml, onInit);
};

// Shared Modal Manager for Student Detailed Info Profile
const openStudentDetailModal = (studentId) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;
    const teachers = stateStore.getTeachers();
    const teacher = teachers.find(t => t.id === student.teacherId);
    const classSchedules = stateStore.getClassesForStudent(studentId);
    const scheduleText = classSchedules.map(c => `${c.dayOfWeek} ${c.time}`).join(', ');

    const enrollDateVal = new Date(student.enrollDate || new Date().toISOString().slice(0, 10));
    const currentDate = new Date();
    const monthsElapsed = (currentDate.getFullYear() - enrollDateVal.getFullYear()) * 12 + (currentDate.getMonth() - enrollDateVal.getMonth());
    const elapsedText = monthsElapsed <= 0 ? '1개월 미만' : `${monthsElapsed}개월`;

    const isIncomplete = isIncompleteStudent(student);
    const teacherMissing = !student.teacherId;

    let warningBannerHtml = '';
    if (isIncomplete) {
        let warningText = '필수 운영 정보가 입력되지 않은 원생입니다. 담당 강사, 정기 청구일, 수강료 정보를 입력하면 모든 기능을 사용할 수 있습니다.';
        if (teacherMissing) {
            warningText += '<br><strong>담당 강사가 배정되지 않은 원생입니다. 수업 관리 기능을 사용하려면 담당 강사를 먼저 지정해 주세요.</strong>';
        }
        warningBannerHtml = `
            <div style="background: var(--warning-light); border: 1px solid var(--warning); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 1.2rem; color: #a04000; font-size: 0.85rem; line-height: 1.5; display: flex; align-items: flex-start; gap: 8px;">
                <i class="fa-solid fa-circle-exclamation" style="margin-top: 2px; font-size: 1.15rem; color: var(--warning); flex-shrink: 0;"></i>
                <div>${warningText}</div>
            </div>
        `;
    }

    const html = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-graduation-cap" style="color: var(--primary); margin-right: 8px;"></i><strong>${student.name}</strong> 원생 상세 정보</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-form-scroll-body text-markdown-body" style="padding: 1.2rem;">
            ${warningBannerHtml}
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">1. 기본 인적 사항</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">원생 이름</span>
                    <strong>${student.name}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">생년월일</span>
                    <strong>${student.birthDate || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">소속 (학교 / 학년 / 반)</span>
                    <strong>${[student.school, student.gradeClass].filter(Boolean).join(' | ') || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">나이 / 구분</span>
                    <strong>${[(student.isAdult === true || student.isAdult === 'adult') ? '성인' : ((student.isAdult === false || student.isAdult === 'minor') ? '비성인' : '-'), student.age ? `${student.age}세` : ''].filter(Boolean).join(' | ') || '정보 없음'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">주소</span>
                    <strong>${student.address || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">본인 연락처</span>
                    <strong>${student.phone || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">학부모 성함</span>
                    <strong>${student.parentName || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">학부모 연락처</span>
                    <strong>${student.parentPhone || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">최초 등록일</span>
                    <strong>${student.enrollDate || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">수강 경과 개월수</span>
                    <strong style="color: var(--success);">${elapsedText}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">2. 음악학습경험 및 희망악기</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">학습 경험</span>
                    <strong>${(student.experienceType === null || student.experienceType === undefined || student.experienceType === '') ? '-' : student.experienceType}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">학습 기간</span>
                    <strong>${student.experiencePeriod || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">수강/희망 악기</span>
                    <strong>${student.instrument || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">소장 악기 유무</span>
                    <strong>${student.hasInstrument || '-'}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">3. 수강목적 및 레슨 방식</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">수강 목적</span>
                    <strong>${student.purpose || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">원하는 레슨 방식</span>
                    <strong>${student.lessonStyle || '-'}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">4. 학원 행정 및 수업 시간표</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">수강 교육비 / 청구일</span>
                    <strong>${(student.fee || 0).toLocaleString()}원 (매월 ${student.dueDay || 10}일)</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">배정 담당강사</span>
                    <strong>${teacher ? teacher.name : '미배정'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">주간 고정 수업 시간표</span>
                    <strong>${scheduleText || '미지정'}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">5. 레슨 상담 및 특이사항</div>
            <div style="font-size: 0.9rem; background: rgba(0,0,0,0.01); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); min-height: 80px; white-space: pre-wrap; color: var(--text-main); line-height: 1.5;">${student.consultationNotes || '기록된 상담 및 특이사항이 없습니다.'}</div>

        </div>
        <div class="modal-footer" style="padding: 1.2rem; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary" id="btn-edit-student-from-detail" style="width: 100%; justify-content: center; height: 38px; font-weight: 600;">정보 수정하기</button>
            <button class="btn btn-success" id="btn-preview-parent-view" style="width: 100%; justify-content: center; height: 38px; font-weight: 600; background: var(--accent); border-color: var(--accent); color: var(--bg-main);">
                <i class="fa-solid fa-mobile-screen-button" style="margin-right: 6px;"></i>학부모 화면 미리보기
            </button>
            <button class="btn btn-info" id="btn-nts-certificate" style="width: 100%; justify-content: center; height: 38px; font-weight: 600; background: #00adb5; border-color: #00adb5; color: #fff;">
                <i class="fa-solid fa-file-invoice" style="margin-right: 6px;"></i>교육비 납입증명서 출력
            </button>
            <button class="btn btn-secondary" data-close-modal style="width: 100%; justify-content: center; height: 38px; font-weight: 600;">닫기</button>
        </div>
    `;
    
    const onInitDetailModal = (contentArea) => {
        contentArea.classList.add('layout-fixed');
        const editBtn = contentArea.querySelector('#btn-edit-student-from-detail');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openStudentModal(studentId);
            });
        }
        const previewBtn = contentArea.querySelector('#btn-preview-parent-view');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                openParentPreviewModal(studentId);
            });
        }
        const ntsBtn = contentArea.querySelector('#btn-nts-certificate');
        if (ntsBtn) {
            ntsBtn.addEventListener('click', () => {
                openNtsCertificatePrintModal(studentId);
            });
        }
    };
    
    openModal(html, onInitDetailModal);
};

// Shared Modal Manager for Student Books History Management
const openStudentBooksModal = (studentId) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;

    const renderModalContent = (contentArea) => {
        const books = stateStore.getBooks().filter(b => b.status === 'active');
        const studentBooks = stateStore.getBooksForStudent(studentId);
        
        let bookRows = '';
        if (studentBooks.length === 0) {
            bookRows = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.9rem;">
                        등록된 교재 수강 이력이 없습니다.
                    </td>
                </tr>
            `;
        } else {
            // Sort by registration date descending (latest first)
            const sortedSB = [...studentBooks].sort((a, b) => b.regDate.localeCompare(a.regDate));
            bookRows = sortedSB.map(sb => {
                const book = stateStore.getBook(sb.bookId);
                const bookName = book ? book.name : '삭제된 교재';
                const bookPrice = book ? `${book.price.toLocaleString()}원` : '-';
                
                let payBadge = '';
                if (sb.paymentStatus === 'paid') {
                    payBadge = '<span class="badge badge-success" style="padding: 2px 6px;">완납</span>';
                } else if (sb.paymentStatus === 'requested') {
                    payBadge = '<span class="badge badge-warning" style="padding: 2px 6px; background: var(--primary); color: white;">결제 요청됨</span>';
                } else {
                    payBadge = '<span class="badge badge-danger" style="padding: 2px 6px;">청구전</span>';
                }

                return `
                    <tr style="font-size: 0.85rem;">
                        <td style="font-weight: 600; color: var(--text-main); padding: 10px 8px;">${bookName}</td>
                        <td style="padding: 10px 8px;">${sb.regDate}</td>
                        <td style="text-align: center; padding: 10px 8px;">${sb.orderNo}권</td>
                        <td style="text-align: center; padding: 10px 8px;">${payBadge}</td>
                        <td style="text-align: right; padding: 10px 8px;">
                            <button class="btn btn-danger btn-icon-only delete-student-book-btn" data-sbid="${sb.id}" style="width: 28px; height: 28px; padding: 0; border-radius: var(--radius-sm); justify-content: center; display: inline-flex;">
                                <i class="fa-solid fa-xmark" style="font-size: 0.75rem;"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-book" style="color: var(--primary); margin-right: 8px;"></i><strong>${student.name}</strong> 원생 교재 수강 관리</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.2rem;">
                <!-- Add Book Mini Form -->
                <div class="glass-card" style="padding: 1.2rem; margin-bottom: 1.5rem; background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-md);">
                    <h4 style="font-size: 0.95rem; font-weight: 700; margin-top:0; margin-bottom: 12px; color: var(--accent); display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-circle-plus"></i> 신규 교재 수강 배부 등록
                    </h4>
                    <form id="assign-book-form" style="display: grid; grid-template-columns: 1.2fr 0.8fr 1.1fr auto; gap: 12px; align-items: flex-end; margin-bottom: 0;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="assign-book-select" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 6px;">배부 교재 선택</label>
                            <select id="assign-book-select" class="form-control" required style="margin-bottom:0; font-size: 0.82rem; padding: 8px 12px; height: 38px;">
                                <option value="" disabled selected>학원 교재 선택</option>
                                ${books.map(b => `<option value="${b.id}">${b.name} (${b.price.toLocaleString()}원)</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="assign-book-order" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 6px;">진도 회차 / 권수</label>
                            <input type="number" id="assign-book-order" class="form-control" value="1" min="1" max="50" required style="margin-bottom:0; font-size: 0.82rem; padding: 8px 12px; height: 38px;">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="assign-book-date" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 6px;">교재 수령일</label>
                            <input type="date" id="assign-book-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required style="margin-bottom:0; font-size: 0.82rem; padding: 8px 12px; height: 38px;">
                        </div>
                        <button type="submit" class="btn btn-primary" style="height: 38px; padding: 0 16px; font-size: 0.85rem; justify-content: center; font-weight: 700; border-radius: var(--radius-sm); white-space: nowrap;">
                            <i class="fa-solid fa-plus" style="margin-right: 4px;"></i> 배부
                        </button>
                    </form>
                </div>

                <!-- Books History Table -->
                <div class="table-wrapper" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: rgba(0,0,0,0.15); margin-top:0;">
                    <table class="custom-table" style="margin-top: 0; width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="font-size: 0.8rem; background: rgba(0,0,0,0.25);">
                                <th style="padding: 10px 8px; width: 40%;">교재명</th>
                                <th style="padding: 10px 8px; width: 25%;">수령 등록일</th>
                                <th style="padding: 10px 8px; text-align: center; width: 12%;">진도</th>
                                <th style="padding: 10px 8px; text-align: center; width: 13%;">결제구분</th>
                                <th style="padding: 10px 8px; text-align: right; width: 10%;">회수</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bookRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="modal-footer" style="padding: 1.2rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" data-close-modal style="width: 100%; justify-content: center; height: 40px; font-weight: 600;">닫기</button>
            </div>
        `;

        contentArea.innerHTML = modalHtml;

        // Form Submit
        const addForm = contentArea.querySelector('#assign-book-form');
        if (addForm) {
            addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const bookId = contentArea.querySelector('#assign-book-select').value;
                const orderNo = contentArea.querySelector('#assign-book-order').value;
                const regDate = contentArea.querySelector('#assign-book-date').value;

                stateStore.assignBookToStudent(studentId, bookId, regDate, orderNo);
                
                // Re-render modal content
                renderModalContent(contentArea);
            });
        }

        // Delete Row Action
        contentArea.querySelectorAll('.delete-student-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sbid = e.currentTarget.dataset.sbid;
                if (confirm('해당 교재 수강 배부 이력을 삭제하시겠습니까?')) {
                    stateStore.removeStudentBook(sbid);
                    renderModalContent(contentArea);
                }
            });
        });

        // Re-bind close triggers manually since HTML gets re-rendered
        contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
            el.addEventListener('click', closeModal);
        });
    };

    openModal('', renderModalContent);
};

// Shared Modal Manager for Student Registration & Editing
const openStudentModal = (studentId = null) => {
    const isEdit = !!studentId;
    const student = isEdit ? stateStore.getStudent(studentId) : null;
    const teachers = stateStore.getTeachers();
    const studentClasses = isEdit ? stateStore.getClassesForStudent(studentId) : [];

    let stPostcode = '';
    let stBasicAddress = '';
    let stDetailAddress = '';

    if (student) {
        stPostcode = student.postcode || '';
        stBasicAddress = student.address || '';
        stDetailAddress = student.detailAddress || '';
        
        if (!stPostcode && stBasicAddress) {
            const match = stBasicAddress.match(/^\[(\d{5})\]\s*([^|]+?)(?:\s*\|\s*(.*))?$/);
            if (match) {
                stPostcode = match[1];
                stBasicAddress = match[2].trim();
                stDetailAddress = (match[3] || '').trim();
            } else {
                const match2 = stBasicAddress.match(/^(\d{5})\s+(.*)$/);
                if (match2) {
                    stPostcode = match2[1];
                    stBasicAddress = match2[2].trim();
                }
            }
        }
    }

    // Build teacher list selections
    const teacherOptionsHtml = teachers.map(t => `
        <option value="${t.id}" ${student && student.teacherId === t.id ? 'selected' : ''}>
            ${t.name} (${t.instrument})
        </option>
    `).join('');

    // Dynamic subjects selection (filter active or matches student's current instrument)
    const subjects = stateStore.getSubjects();
    const studentInstrument = student ? student.instrument : '';
    const filteredSubjects = subjects.filter(sub => {
        if (sub.isActive) return true;
        if (isEdit && sub.name === studentInstrument) return true;
        return false;
    });
    const isInstrumentInList = filteredSubjects.some(sub => sub.name === studentInstrument);
    if (isEdit && studentInstrument && !isInstrumentInList) {
        filteredSubjects.push({ id: 'temp-subject', name: studentInstrument, isActive: true });
    }
    const subjectOptionsHtml = filteredSubjects.map(sub => `
        <option value="${sub.name}" ${student && student.instrument === sub.name ? 'selected' : ''}>
            ${sub.name}
        </option>
    `).join('');

    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title">${isEdit ? '원생 정보 수정' : '신규 원생 등록'}</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <form id="student-modal-form" style="display: flex; flex-direction: column; height: 100%;">
            <div class="modal-form-scroll-body" style="flex-grow: 1; overflow-y: auto; padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Section 1: 기본 인적 사항 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">1. 기본 인적 사항</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-name">학생 이름 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="modal-student-name" class="form-control" value="${student ? student.name : ''}" required placeholder="예: 홍길동">
                        </div>
                        <div class="form-group">
                            <label for="modal-student-birthdate">생년월일</label>
                            <input type="date" id="modal-student-birthdate" class="form-control" value="${student ? student.birthDate || '' : ''}">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-school">학교/유치원(소속)</label>
                            <input type="text" id="modal-student-school" class="form-control" value="${student && student.school ? student.school : ''}" placeholder="예: 하모초등학교">
                        </div>
                        <div class="form-group">
                            <label for="modal-student-grade-class">학년/반</label>
                            <input type="text" id="modal-student-grade-class" class="form-control" value="${student && student.gradeClass ? student.gradeClass : ''}" placeholder="예: 3학년 2반, 햇살반">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-adult">성인/비성인 구분</label>
                            <select id="modal-student-adult" class="form-control">
                                <option value="" ${(!student || student.isAdult === null || student.isAdult === undefined || student.isAdult === '') ? 'selected' : ''}>선택하세요</option>
                                <option value="adult" ${(student && (student.isAdult === 'adult' || student.isAdult === true)) ? 'selected' : ''}>성인</option>
                                <option value="minor" ${(student && (student.isAdult === 'minor' || student.isAdult === false)) ? 'selected' : ''}>비성인</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-age">나이</label>
                            <input type="number" id="modal-student-age" class="form-control" value="${student && student.age !== undefined && student.age !== null ? student.age : ''}" placeholder="예: 10" min="1" max="100">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-phone">본인 연락처</label>
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <input type="tel" id="modal-student-phone" class="form-control" style="flex-grow: 1; margin-bottom: 0;" placeholder="010-0000-0000">
                                <select id="modal-student-phone-status" class="form-control" style="width: 100px; margin-bottom: 0; flex-shrink: 0;">
                                    <option value="direct">직접입력</option>
                                    <option value="none">없음</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-parent-name">학부모 성함</label>
                            <input type="text" id="modal-student-parent-name" class="form-control" value="${student ? student.parentName || '' : ''}" placeholder="예: 김철수">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-parent-phone">학부모 연락처</label>
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <input type="tel" id="modal-student-parent-phone" class="form-control" style="flex-grow: 1; margin-bottom: 0;" placeholder="010-0000-0000">
                                <select id="modal-student-parent-phone-status" class="form-control" style="width: 100px; margin-bottom: 0; flex-shrink: 0;">
                                    <option value="direct">직접입력</option>
                                    <option value="none">없음</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; display: block;">주소 <span style="color: var(--danger);">*</span></label>
                            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <input type="text" id="modal-student-postcode" class="form-control" style="flex-grow: 1; margin-bottom: 0;" placeholder="우편번호" readonly value="${stPostcode}">
                                <button type="button" id="btn-modal-student-address-search" class="btn btn-secondary" style="padding: 0 12px; font-size: 0.85rem; margin-bottom: 0; flex-shrink: 0; justify-content: center;">주소 검색</button>
                            </div>
                            <input type="text" id="modal-student-address-basic" class="form-control" style="margin-bottom: 8px;" placeholder="기본 주소지" readonly value="${stBasicAddress}">
                            <input type="text" id="modal-student-address-detail" class="form-control" placeholder="상세주소 입력" value="${stDetailAddress}">
                        </div>
                    </div>
                </div>

                <!-- Section 2: 음악학습경험 및 희망악기 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">2. 음악학습경험 및 희망악기</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-experience-type">학습 경험</label>
                            <select id="modal-student-experience-type" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="처음">처음</option>
                                <option value="바이엘">바이엘</option>
                                <option value="체100">체100</option>
                                <option value="체30">체30</option>
                                <option value="체40">체40</option>
                                <option value="체50">체50</option>
                                <option value="custom">직접입력</option>
                            </select>
                            <input type="text" id="modal-student-experience-type-custom" class="form-control" style="margin-top: 8px; display: none;" placeholder="경험 직접 입력 (예: 체르니 40 단계)">
                        </div>
                        <div class="form-group">
                            <label for="modal-student-experience-period">학습 기간</label>
                            <input type="text" id="modal-student-experience-period" class="form-control" value="${student ? student.experiencePeriod || '' : ''}" placeholder="예: 6개월, 1년">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-instrument">수강 악기/과목 <span style="color: var(--danger);">*</span></label>
                            <select id="modal-student-instrument" class="form-control" required>
                                <option value="" disabled ${!student ? 'selected' : ''}>과목을 선택하세요</option>
                                ${subjectOptionsHtml}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-has-instrument">소장 악기 유무</label>
                            <select id="modal-student-has-instrument" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="없음">없음</option>
                                <option value="구매예정">구매예정</option>
                                <option value="디지털피아노">디지털피아노</option>
                                <option value="어쿠스틱피아노">어쿠스틱피아노</option>
                                <option value="바이올린">바이올린</option>
                                <option value="custom">직접입력</option>
                            </select>
                            <input type="text" id="modal-student-has-instrument-custom" class="form-control" style="margin-top: 8px; display: none;" placeholder="소장 악기 직접 입력">
                        </div>
                    </div>
                </div>

                <!-- Section 3: 수강목적 및 원하는 레슨 방식 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">3. 수강목적 및 원하는 레슨 방식</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-purpose">수강 목적</label>
                            <select id="modal-student-purpose" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="정서발달 및 취미" ${student && student.purpose === '정서발달 및 취미' ? 'selected' : ''}>정서발달 및 취미</option>
                                <option value="자격증 및 콩쿨" ${student && student.purpose === '자격증 및 콩쿨' ? 'selected' : ''}>자격증 및 콩쿨</option>
                                <option value="전공준비" ${student && student.purpose === '전공준비' ? 'selected' : ''}>전공준비</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-lesson-style">원하는 레슨 방식</label>
                            <select id="modal-student-lesson-style" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="진도가 늦더라도 꼼꼼하게" ${student && student.lessonStyle === '진도가 늦더라도 꼼꼼하게' ? 'selected' : ''}>진도가 늦더라도 꼼꼼하게</option>
                                <option value="이론공부에 중점" ${student && student.lessonStyle === '이론공부에 중점' ? 'selected' : ''}>이론공부에 중점</option>
                                <option value="진도향상 위주로" ${student && student.lessonStyle === '진도향상 위주로' ? 'selected' : ''}>진도향상 위주로</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Section 4: 학원 행정 및 수업 시간표 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">4. 학원 행정 및 수업 시간표</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-teacher">배정 담당 강사 <span style="color: var(--danger);">*</span></label>
                            <select id="modal-student-teacher" class="form-control" required>
                                <option value="" disabled ${!student ? 'selected' : ''}>학원 강사를 선택하세요</option>
                                ${teacherOptionsHtml}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-due-day">정기 청구 희망일 <span style="color: var(--danger);">*</span></label>
                            <input type="number" id="modal-student-due-day" class="form-control" value="${student ? student.dueDay : '10'}" required min="1" max="31" placeholder="예: 10">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-fee">수강료 (원) <span style="color: var(--danger);">*</span></label>
                            <div class="fee-input-wrapper">
                                <input type="number" id="modal-student-fee" class="form-control" value="${student ? student.fee : '150000'}" required min="0" step="5000" placeholder="예: 150000">
                                <button type="button" class="fee-dropdown-toggle" id="btn-fee-dropdown">
                                    <i class="fa-solid fa-chevron-down"></i>
                                </button>
                                <div class="fee-dropdown-menu" id="fee-dropdown-menu"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>수납현황</label>
                            <div class="custom-check-group">
                                <label class="custom-check-card">
                                    <input type="radio" name="modal-student-payment-status" value="unpaid" ${!student || student.paymentStatus !== 'paid' ? 'checked' : ''} required>
                                    <div class="custom-check-card-body">
                                        <i class="fa-solid fa-circle-check"></i> 미납
                                    </div>
                                </label>
                                <label class="custom-check-card">
                                    <input type="radio" name="modal-student-payment-status" value="paid" ${student && student.paymentStatus === 'paid' ? 'checked' : ''} required>
                                    <div class="custom-check-card-body">
                                        <i class="fa-solid fa-circle-check"></i> 완납
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 수업일정 동적 추가 필드 -->
                    <div class="form-group" style="margin-top: 1rem; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <label style="margin-bottom: 0; font-weight: 600; color: var(--text-muted);">수업 일정 시간표 <span style="color: var(--text-muted); font-size: 0.75rem;">(복수 요일 입력 가능)</span></label>
                            <button type="button" class="btn btn-secondary" id="btn-add-schedule-row" style="padding: 4px 8px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                                <i class="fa-solid fa-plus"></i> 요일 추가
                            </button>
                        </div>
                        <div id="modal-schedule-rows-container" style="display: flex; flex-direction: column; gap: 8px;">
                            <!-- Time rows generated dynamically here -->
                        </div>
                    </div>
                </div>

                <!-- Section 5: 레슨 상담 및 특이사항 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">5. 레슨 상담 및 특이사항</div>
                    
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="modal-student-consultation-notes">레슨 상담 및 특이사항</label>
                        <textarea id="modal-student-consultation-notes" class="form-control" rows="4" placeholder="예: 집중력이 다소 부족하나 피아노를 매우 좋아함. 레슨 시 진도가 다소 늦더라도 기초 이론을 꼼꼼히 짚고 넘어갈 것을 희망함.">${student ? student.consultationNotes || '' : ''}</textarea>
                    </div>
                </div>

            </div>

            <div class="modal-footer" style="padding: 1rem 2rem 1.5rem 2rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 8px; background: rgba(0, 0, 0, 0.01);">
                <button type="button" class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" class="btn btn-primary">${isEdit ? '수정 저장' : '신규 등록'}</button>
            </div>
        </form>
    `;

    const onInitModal = (contentArea) => {
        // Fix layout of modal content area (locks header/footer and scrolls central area)
        contentArea.classList.add('layout-fixed');

        const container = contentArea.querySelector('#modal-schedule-rows-container');
        const btnAddRow = contentArea.querySelector('#btn-add-schedule-row');

        // Render a single schedule row selection
        const addScheduleRow = (dayOfWeek = '월', time = '15:00') => {
            const [hStr, mStr] = (time || '15:00').split(':');
            const currentHour = String(parseInt(hStr) || 0).padStart(2, '0');
            const currentMinute = String(parseInt(mStr) || 0).padStart(2, '0');

            const row = document.createElement('div');
            row.className = 'modal-schedule-row';
            
            // Generate hour options
            let hourOpts = '';
            for (let h = 0; h <= 23; h++) {
                const val = String(h).padStart(2, '0');
                hourOpts += `<option value="${val}" ${val === currentHour ? 'selected' : ''}>${val}시</option>`;
            }
            
            // Generate minute options
            let minuteOpts = '';
            for (let m = 0; m <= 59; m++) {
                const val = String(m).padStart(2, '0');
                minuteOpts += `<option value="${val}" ${val === currentMinute ? 'selected' : ''}>${val}분</option>`;
            }

            const hourVal = parseInt(currentHour);
            const amPmText = (hourVal >= 0 && hourVal <= 11) ? '오전' : '오후';

            row.innerHTML = `
                <select class="form-control schedule-day" required style="margin-bottom:0; width: 100px;">
                    ${['월', '화', '수', '목', '금', '토', '일'].map(d => `<option value="${d}" ${d === dayOfWeek ? 'selected' : ''}>${d}요일</option>`).join('')}
                </select>
                
                <div class="schedule-time-container" style="display: flex; align-items: center; gap: 6px; width: 100%;">
                    <span class="ampm-indicator" style="font-size: 0.82rem; font-weight: 700; color: var(--primary); min-width: 32px; text-align: center;">${amPmText}</span>
                    <select class="form-control schedule-hour" required style="margin-bottom:0; flex-grow: 1; min-width: 55px; font-size: 0.82rem;">
                        ${hourOpts}
                    </select>
                    <span style="font-weight: 700; color: var(--text-muted);">:</span>
                    <select class="form-control schedule-minute" required style="margin-bottom:0; flex-grow: 1; min-width: 55px; font-size: 0.82rem;">
                        ${minuteOpts}
                    </select>
                </div>

                <button type="button" class="btn btn-danger btn-icon-only remove-schedule-row-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;

            const hourSelect = row.querySelector('.schedule-hour');
            const ampmIndicator = row.querySelector('.ampm-indicator');
            
            hourSelect.addEventListener('change', () => {
                const h = parseInt(hourSelect.value) || 0;
                ampmIndicator.textContent = (h >= 0 && h <= 11) ? '오전' : '오후';
            });

            row.querySelector('.remove-schedule-row-btn').addEventListener('click', () => {
                row.remove();
            });

            container.appendChild(row);
        };

        // Pre-populate schedules
        if (studentClasses.length > 0) {
            studentClasses.forEach(c => addScheduleRow(c.dayOfWeek, c.time));
        } else {
            addScheduleRow('월', '15:00'); // Default row
        }

        btnAddRow.addEventListener('click', () => {
            addScheduleRow('월', '15:00');
        });

        // Tuition presets custom combo dropdown
        const feeInput = contentArea.querySelector('#modal-student-fee');
        const btnFeeDropdown = contentArea.querySelector('#btn-fee-dropdown');
        const feeDropdownMenu = contentArea.querySelector('#fee-dropdown-menu');

        let feeMenuHtml = '';
        for (let val = 5000; val <= 1000000; val += 5000) {
            feeMenuHtml += `<div class="fee-dropdown-item" data-value="${val}">${val.toLocaleString()}원</div>`;
        }
        feeDropdownMenu.innerHTML = feeMenuHtml;

        const toggleFeeMenu = (e) => {
            e.stopPropagation();
            feeDropdownMenu.classList.toggle('show');
        };

        btnFeeDropdown.addEventListener('click', toggleFeeMenu);
        feeInput.addEventListener('click', (e) => {
            e.stopPropagation();
            feeDropdownMenu.classList.add('show');
        });
        feeInput.addEventListener('focus', () => {
            feeDropdownMenu.classList.add('show');
        });

        document.addEventListener('click', (e) => {
            if (!feeDropdownMenu.contains(e.target) && e.target !== btnFeeDropdown && e.target !== feeInput) {
                feeDropdownMenu.classList.remove('show');
            }
        });

        feeDropdownMenu.querySelectorAll('.fee-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const val = e.currentTarget.dataset.value;
                feeInput.value = val;
                feeDropdownMenu.classList.remove('show');
                feeInput.dispatchEvent(new Event('input'));
                feeInput.dispatchEvent(new Event('change'));
            });
        });

        // Phone inputs logic
        const phoneInput = contentArea.querySelector('#modal-student-phone');
        const phoneStatus = contentArea.querySelector('#modal-student-phone-status');
        const parentPhoneInput = contentArea.querySelector('#modal-student-parent-phone');
        const parentPhoneStatus = contentArea.querySelector('#modal-student-parent-phone-status');

        const phoneBinder = PhoneNumberInput.bind(phoneInput);
        const parentPhoneBinder = PhoneNumberInput.bind(parentPhoneInput);

        const addressBinder = AddressInput.bind({
            postcodeEl: contentArea.querySelector('#modal-student-postcode'),
            addressEl: contentArea.querySelector('#modal-student-address-basic'),
            detailAddressEl: contentArea.querySelector('#modal-student-address-detail'),
            searchBtnEl: contentArea.querySelector('#btn-modal-student-address-search')
        });

        const updatePhoneUI = (input, statusSelect, binder) => {
            if (statusSelect.value === 'none') {
                input.value = '';
                input.disabled = false;
                if (binder) binder.validate();
            } else {
                input.disabled = false;
                if (binder) binder.validate();
            }
        };

        phoneStatus.addEventListener('change', () => updatePhoneUI(phoneInput, phoneStatus, phoneBinder));
        parentPhoneStatus.addEventListener('change', () => updatePhoneUI(parentPhoneInput, parentPhoneStatus, parentPhoneBinder));

        // Auto-switch status to 'direct' when digits are typed in 'none' state
        const setupPhoneAutoSwitch = (input, statusSelect, binder) => {
            input.addEventListener('input', (e) => {
                if (statusSelect.value === 'none' && input.value.trim() !== '') {
                    if (/\d/.test(input.value)) {
                        statusSelect.value = 'direct';
                        if (binder) binder.validate();
                    }
                }
            });
        };

        setupPhoneAutoSwitch(phoneInput, phoneStatus, phoneBinder);
        setupPhoneAutoSwitch(parentPhoneInput, parentPhoneStatus, parentPhoneBinder);

        const destroyAllBinders = () => {
            phoneBinder.destroy();
            parentPhoneBinder.destroy();
            addressBinder.destroy();
        };

        contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
            el.addEventListener('click', destroyAllBinders);
        });

        // Pre-fill phone fields
        if (student) {
            const isPhoneEmpty = !student.phone || student.phone === '없음';
            const isParentPhoneEmpty = !student.parentPhone || student.parentPhone === '없음';

            if (isPhoneEmpty) {
                phoneStatus.value = 'none';
                updatePhoneUI(phoneInput, phoneStatus, phoneBinder);
            } else {
                phoneStatus.value = 'direct';
                phoneInput.value = student.phone;
                phoneInput.disabled = false;
                if (phoneBinder) phoneBinder.validate();
            }

            if (isParentPhoneEmpty) {
                parentPhoneStatus.value = 'none';
                updatePhoneUI(parentPhoneInput, parentPhoneStatus, parentPhoneBinder);
            } else {
                parentPhoneStatus.value = 'direct';
                parentPhoneInput.value = student.parentPhone;
                parentPhoneInput.disabled = false;
                if (parentPhoneBinder) parentPhoneBinder.validate();
            }
        } else {
            phoneStatus.value = 'direct';
            parentPhoneStatus.value = 'direct';
            phoneInput.disabled = false;
            parentPhoneInput.disabled = false;
            if (phoneBinder) phoneBinder.validate();
            if (parentPhoneBinder) parentPhoneBinder.validate();
        }

        // Custom selects logic for learning experience & instrument ownership
        const expSelect = contentArea.querySelector('#modal-student-experience-type');
        const expCustom = contentArea.querySelector('#modal-student-experience-type-custom');
        const instSelect = contentArea.querySelector('#modal-student-has-instrument');
        const instCustom = contentArea.querySelector('#modal-student-has-instrument-custom');

        const handleCustomSelect = (selectEl, customEl) => {
            if (selectEl.value === 'custom') {
                customEl.style.display = 'block';
            } else {
                customEl.style.display = 'none';
                customEl.value = '';
            }
        };

        expSelect.addEventListener('change', () => handleCustomSelect(expSelect, expCustom));
        instSelect.addEventListener('change', () => handleCustomSelect(instSelect, instCustom));

        if (student) {
            const expVal = student.experienceType || '';
            const predefinedExp = ['처음', '바이엘', '체100', '체30', '체40', '체50', ''];
            if (predefinedExp.includes(expVal)) {
                expSelect.value = expVal;
                expCustom.style.display = 'none';
            } else {
                expSelect.value = 'custom';
                expCustom.value = expVal;
                expCustom.style.display = 'block';
            }

            const hasInstVal = student.hasInstrument || '';
            const predefinedInst = ['없음', '구매예정', '디지털피아노', '어쿠스틱피아노', '바이올린', ''];
            if (predefinedInst.includes(hasInstVal)) {
                instSelect.value = hasInstVal;
                instCustom.style.display = 'none';
            } else {
                instSelect.value = 'custom';
                instCustom.value = hasInstVal;
                instCustom.style.display = 'block';
            }
        }

        // Enable real-time validation reset style when inputs are edited
        const resetErrorStyle = (el) => {
            el.addEventListener('input', () => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
            el.addEventListener('change', () => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
        };

        const requiredInputs = [
            contentArea.querySelector('#modal-student-name'),
            contentArea.querySelector('#modal-student-teacher'),
            contentArea.querySelector('#modal-student-due-day'),
            contentArea.querySelector('#modal-student-fee'),
            contentArea.querySelector('#modal-student-instrument'),
            phoneInput,
            parentPhoneInput
        ];
        requiredInputs.forEach(el => {
            if (el) resetErrorStyle(el);
        });

        // Form Submit Handler
        const form = contentArea.querySelector('#student-modal-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameEl = contentArea.querySelector('#modal-student-name');
            const birthdateEl = contentArea.querySelector('#modal-student-birthdate');
            const schoolEl = contentArea.querySelector('#modal-student-school');
            const gradeClassEl = contentArea.querySelector('#modal-student-grade-class');
            const ageEl = contentArea.querySelector('#modal-student-age');
            const parentNameEl = contentArea.querySelector('#modal-student-parent-name');
            
            const postcodeEl = contentArea.querySelector('#modal-student-postcode');
            const addressBasicEl = contentArea.querySelector('#modal-student-address-basic');
            const addressDetailEl = contentArea.querySelector('#modal-student-address-detail');

            const teacherEl = contentArea.querySelector('#modal-student-teacher');
            const dueDayEl = contentArea.querySelector('#modal-student-due-day');
            const feeEl = contentArea.querySelector('#modal-student-fee');
            const instrumentEl = contentArea.querySelector('#modal-student-instrument');
            const notesEl = contentArea.querySelector('#modal-student-consultation-notes');
            const expPeriodEl = contentArea.querySelector('#modal-student-experience-period');

            // Reset borders before check
            requiredInputs.forEach(el => {
                if (el) {
                    el.style.borderColor = '';
                    el.style.boxShadow = '';
                }
            });

            let validationPassed = true;

            if (!nameEl.value.trim()) {
                nameEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!teacherEl.value) {
                teacherEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!dueDayEl.value.trim() || parseInt(dueDayEl.value) < 1 || parseInt(dueDayEl.value) > 31) {
                dueDayEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!feeEl.value.trim() || parseInt(feeEl.value) < 0) {
                feeEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!instrumentEl.value) {
                instrumentEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }

            // Contact Multi-validation
            const isPhoneNone = phoneStatus.value === 'none';
            const isParentPhoneNone = parentPhoneStatus.value === 'none';
            const phoneVal = phoneInput.value.trim();
            const parentPhoneVal = parentPhoneInput.value.trim();

            const hasPhoneInput = !isPhoneNone && phoneVal !== '';
            const hasParentPhoneInput = !isParentPhoneNone && parentPhoneVal !== '';

            // Check if both are empty/None
            if (!hasPhoneInput && !hasParentPhoneInput) {
                alert('연락 가능한 번호 하나를 꼭 입력해 주세요.');
                validationPassed = false;
            } else {
                if (hasPhoneInput && !phoneBinder.isValid()) {
                    validationPassed = false;
                }
                if (hasParentPhoneInput && !parentPhoneBinder.isValid()) {
                    validationPassed = false;
                }
            }

            // Address Validation
            if (!addressBinder.isValid()) {
                alert('주소 검색을 통해 기본 주소와 상세주소를 모두 입력해 주세요.');
                validationPassed = false;
            }

            if (!validationPassed) {
                return;
            }

            // Gather inputs
            const name = nameEl.value.trim();
            const birthDate = birthdateEl.value;
            const school = schoolEl.value.trim();
            const gradeClass = gradeClassEl.value.trim();
            const ageVal = ageEl.value.trim();
            const age = ageVal ? parseInt(ageVal) : null;
            
            // For None value, save as null or empty string (using null as per design)
            const phone = isPhoneNone ? null : phoneVal;
            const parentName = parentNameEl.value.trim();
            const parentPhone = isParentPhoneNone ? null : parentPhoneVal;
            
            const postcode = postcodeEl.value.trim();
            const address = addressBasicEl.value.trim();
            const detailAddress = addressDetailEl.value.trim();

            const teacherId = teacherEl.value;
            const dueDay = parseInt(dueDayEl.value) || 10;
            const fee = parseInt(feeEl.value) || 0;
            const instrument = instrumentEl.value;
            const experiencePeriod = expPeriodEl.value.trim();
            const consultationNotes = notesEl.value.trim();

            const adultSelect = contentArea.querySelector('#modal-student-adult');
            const isAdult = (adultSelect.value === 'adult') ? 'adult' : ((adultSelect.value === 'minor') ? 'minor' : null);

            const checkedPaymentStatusEl = contentArea.querySelector('input[name="modal-student-payment-status"]:checked');
            const paymentStatus = checkedPaymentStatusEl ? checkedPaymentStatusEl.value : 'unpaid';

            const experienceType = expSelect.value === 'custom' ? expCustom.value.trim() : expSelect.value;
            const hasInstrument = instSelect.value === 'custom' ? instCustom.value.trim() : instSelect.value;
            const purpose = contentArea.querySelector('#modal-student-purpose').value;
            const lessonStyle = contentArea.querySelector('#modal-student-lesson-style').value;

            // Extract schedules from dynamic rows
            const scheduleRows = container.querySelectorAll('.modal-schedule-row');
            const classSchedules = Array.from(scheduleRows).map(row => {
                const dayOfWeek = row.querySelector('.schedule-day').value;
                const hour = row.querySelector('.schedule-hour').value;
                const minute = row.querySelector('.schedule-minute').value;
                const time = `${hour}:${minute}`;
                return { dayOfWeek, time };
            });

            if (isEdit) {
                stateStore.updateStudent(studentId, {
                    name,
                    instrument,
                    phone,
                    parentName,
                    parentPhone,
                    fee,
                    dueDay,
                    teacherId,
                    age,
                    school,
                    isAdult,
                    birthDate,
                    gradeClass,
                    postcode,
                    address,
                    detailAddress,
                    experienceType,
                    experiencePeriod,
                    hasInstrument,
                    purpose,
                    lessonStyle,
                    consultationNotes,
                    paymentStatus
                }, classSchedules);
            } else {
                const enrollDate = new Date().toISOString().slice(0, 10);
                stateStore.addStudent({
                    name,
                    instrument,
                    phone,
                    parentName,
                    parentPhone,
                    fee,
                    dueDay,
                    teacherId,
                    enrollDate,
                    age,
                    school,
                    isAdult,
                    birthDate,
                    gradeClass,
                    postcode,
                    address,
                    detailAddress,
                    experienceType,
                    experiencePeriod,
                    hasInstrument,
                    purpose,
                    lessonStyle,
                    consultationNotes,
                    paymentStatus
                }, classSchedules);
            }

            destroyAllBinders();
            closeModal();
        });
    };

    openModal(modalHtml, onInitModal);
}

// ----------------------------------------------------
// 신규 원생 대량 등록을 위한 엑셀 업로드 모달 및 데이터 처리
// ----------------------------------------------------
const openExcelUploadModal = () => {
    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-file-excel" style="color: var(--primary); margin-right: 8px;"></i>신규 원생 엑셀 업로드</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-form-scroll-body" style="padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto; display: flex; flex-direction: column; gap: 1.2rem;">
            
            <!-- Template download section -->
            <div style="background: rgba(9, 132, 227, 0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div style="font-size: 0.82rem; color: var(--text-main); max-width: 480px;">
                    <strong>신규 원생 등록용 엑셀 서식</strong>을 다운로드하여 양식에 맞춰 작성하신 후 업로드해 주세요.
                </div>
                <button type="button" class="btn btn-secondary" id="btn-download-excel-template" style="font-size: 0.8rem; padding: 6px 12px; height: 32px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-download"></i> 양식 다운로드
                </button>
            </div>

            <!-- Upload drag-drop area -->
            <div class="excel-drag-drop-zone" id="excel-drop-zone">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <p>엑셀 또는 CSV 파일을 이 영역으로 드래그 앤 드롭 하거나 클릭하세요</p>
                <span>지원 파일 형식: .xlsx, .xls, .csv</span>
                <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;">
            </div>

            <!-- Guide Box -->
            <div style="background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                <p style="margin: 0 0 6px 0; font-weight: 700; color: var(--text-main);"><i class="fa-solid fa-circle-info" style="color: var(--primary); margin-right: 4px;"></i> 업로드 안내 및 유효성 기준</p>
                <ul style="margin: 0; padding-left: 16px;">
                    <li><strong>순번</strong>과 <strong>이름</strong>은 필수 입력값입니다. (이름이 없는 행은 오류로 처리되어 등록되지 않습니다.)</li>
                    <li>나머지 필드는 비어 있어도 <strong>정보 미완성</strong> 상태로 우선 등록되며, 원생 상세 정보 수정에서 보완할 수 있습니다.</li>
                    <li>생년월일은 <code>YYYY-MM-DD</code> 형식으로 기입해 주세요.</li>
                    <li>기존 원생과 이름 및 연락처(본인 또는 학부모)가 같은 경우 <strong>중복 의심</strong>으로 표시되지만 차단되지 않고 함께 등록됩니다. (연락처가 없는 경우는 중복으로 판단하지 않습니다.)</li>
                </ul>
            </div>

            <!-- Preview panel (Hidden initially) -->
            <div id="excel-preview-panel" style="display: none; flex-direction: column; gap: 8px;">
                <h4 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--primary);" id="excel-preview-summary"></h4>
                <div class="excel-preview-wrapper">
                    <table class="excel-preview-table">
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">순번</th>
                                <th style="width: 100px; text-align: center;">상태</th>
                                <th style="width: 100px;">이름</th>
                                <th style="width: 110px;">본인 연락처</th>
                                <th style="width: 100px;">과목</th>
                                <th style="width: 90px;">담당 강사</th>
                                <th style="width: 80px;">수강료</th>
                                <th>메모 / 실패 사유</th>
                            </tr>
                        </thead>
                        <tbody id="excel-preview-tbody"></tbody>
                    </table>
                </div>
            </div>

        </div>
        <div class="modal-footer" style="padding: 1rem 2rem 1.5rem 2rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 8px; background: rgba(0, 0, 0, 0.01);">
            <button type="button" class="btn btn-secondary" data-close-modal>취소</button>
            <button type="button" class="btn btn-primary" id="btn-excel-submit" disabled>최종 등록 완료</button>
        </div>
    `;

    const onInitModal = (contentArea) => {
        contentArea.classList.add('layout-fixed');

        const btnDownload = contentArea.querySelector('#btn-download-excel-template');
        const dropZone = contentArea.querySelector('#excel-drop-zone');
        const fileInput = contentArea.querySelector('#excel-file-input');
        const previewPanel = contentArea.querySelector('#excel-preview-panel');
        const summaryText = contentArea.querySelector('#excel-preview-summary');
        const tbody = contentArea.querySelector('#excel-preview-tbody');
        const btnSubmit = contentArea.querySelector('#btn-excel-submit');

        let parsedStudents = []; // Stores valid students to import
        let parsedClasses = [];    // Stores corresponding class schedules

        // Template download trigger
        btnDownload.addEventListener('click', () => {
            const headers = [
                '순번', '이름', '생년월일', '학교/유치원(소속)', '학년/반', '성인구분', '나이', 
                '본인 연락처', '학부모 성함', '학부모 연락처', '주소', '수강 악기/과목', 
                '학습 경험', '학습 기간', '소장 악기 유무', '수강 목적', '원하는 레슨 방식', 
                '배정 담당 강사', '정기 청구 희망일', '수강료', '수업 요일', 
                '수업 시작 시간', '수업 종료 시간', '메모'
            ];
            const sampleData = [
                [
                    1, '홍길동', '2016-05-10', '하모초등학교', '3학년 2반', '비성인', 10,
                    '010-1234-5678', '김철수', '010-8765-4321', '서울시 마포구', '피아노',
                    '바이엘', '6개월', '디지털피아노', '정서발달 및 취미', '진도가 늦더라도 꼼꼼하게',
                    '정은비', 10, 150000, '월', '15:00', '16:00', '특이사항 메모'
                ],
                [
                    2, '김영희', '', '', '', '비성인', '',
                    '', '', '', '', '바이올린',
                    '', '', '', '', '',
                    '', '', '', '', '', '', '임시 등록 원생 (정보 미완성 예시)'
                ]
            ];

            if (window.XLSX) {
                const wb = XLSX.utils.book_new();
                const wsData = [headers, ...sampleData];
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "원생등록양식");
                XLSX.writeFile(wb, "신규_원생_등록_양식.xlsx");
            } else {
                // Fallback to CSV (UTF-8 BOM)
                let csvContent = "\uFEFF";
                csvContent += headers.join(",") + "\n";
                sampleData.forEach(row => {
                    csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",") + "\n";
                });
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", "신규_원생_등록_양식.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });

        // Click to open file dialog
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag & Drop event bindings
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                processFile(files[0]);
            }
        });

        // Process selected file
        const processFile = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                try {
                    if (!window.XLSX) {
                        alert('XLSX 파싱 라이브러리가 로드되지 않았습니다. 인터넷 상태를 확인해 주세요.');
                        return;
                    }
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    
                    // Parse as array of arrays (AOA) to ensure strict column mapping by index
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    if (rows.length <= 1) {
                        alert('가공할 데이터 행이 없습니다.');
                        return;
                    }
                    
                    // Skip header row
                    const dataRows = rows.slice(1);
                    parseAndPreview(dataRows);
                } catch (err) {
                    console.error(err);
                    alert('파일 파싱 중 에러가 발생했습니다: ' + err.message);
                }
            };
            reader.readAsBinaryString(file);
        };

        // Parse rows and render preview
        const parseAndPreview = (dataRows) => {
            tbody.innerHTML = '';
            parsedStudents = [];
            parsedClasses = [];

            const existingStudents = stateStore.getStudents();
            const teachers = stateStore.getTeachers();

            let totalCount = 0;
            let successCount = 0;
            let errorCount = 0;
            let incompleteCount = 0;
            let duplicateCount = 0;

            let trsHtml = '';

            dataRows.forEach((row, idx) => {
                // Ignore completely empty rows
                if (row.length === 0 || row.every(val => val === null || val === undefined || String(val).trim() === '')) {
                    return;
                }

                totalCount++;

                const seq = row[0];
                const name = row[1] ? String(row[1]).trim() : '';
                const birthDateRaw = row[2] ? String(row[2]).trim() : '';
                const school = row[3] ? String(row[3]).trim() : '';
                const gradeClass = row[4] ? String(row[4]).trim() : '';
                const adultRaw = row[5] ? String(row[5]).trim() : '';
                const ageRaw = row[6] ? String(row[6]).trim() : '';
                const phoneRaw = row[7] ? String(row[7]).trim() : '';
                const parentName = row[8] ? String(row[8]).trim() : '';
                const parentPhoneRaw = row[9] ? String(row[9]).trim() : '';
                const address = row[10] ? String(row[10]).trim() : '';
                const instrumentRaw = row[11] ? String(row[11]).trim() : '';
                const expType = row[12] ? String(row[12]).trim() : '';
                const expPeriod = row[13] ? String(row[13]).trim() : '';
                const hasInst = row[14] ? String(row[14]).trim() : '';
                const purpose = row[15] ? String(row[15]).trim() : '';
                const lessonStyle = row[16] ? String(row[16]).trim() : '';
                const teacherName = row[17] ? String(row[17]).trim() : '';
                const dueDayRaw = row[18] ? String(row[18]).trim() : '';
                const feeRaw = row[19] ? String(row[19]).trim() : '';
                const scheduleDay = row[20] ? String(row[20]).trim() : '';
                const scheduleStart = row[21] ? String(row[21]).trim() : '';
                const scheduleEnd = row[22] ? String(row[22]).trim() : '';
                const memo = row[23] ? String(row[23]).trim() : '';

                let status = 'ready'; // 'ready', 'incomplete', 'error', 'duplicate'
                let errorMsg = '';

                // 1. Check required fields
                if (seq === undefined || seq === null || String(seq).trim() === '') {
                    status = 'error';
                    errorMsg = '순번이 비어 있습니다.';
                } else if (!name) {
                    status = 'error';
                    errorMsg = '이름이 비어 있습니다.';
                }

                // 2. Validate date format (if provided)
                let birthDate = '';
                if (status !== 'error' && birthDateRaw) {
                    // Try parsing date or Excel serial date
                    if (/^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw)) {
                        birthDate = birthDateRaw;
                    } else if (!isNaN(birthDateRaw)) {
                        // Excel serial date conversion
                        const serial = parseFloat(birthDateRaw);
                        const utc_days  = Math.floor(serial - 25569);
                        const utc_value = utc_days * 86400;
                        const date_info = new Date(utc_value * 1000);
                        const y = date_info.getUTCFullYear();
                        const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
                        const d = String(date_info.getUTCDate()).padStart(2, '0');
                        birthDate = `${y}-${m}-${d}`;
                    } else {
                        status = 'error';
                        errorMsg = '지원하지 않는 날짜 형식입니다. (YYYY-MM-DD)';
                    }
                }

                // Format phone numbers
                const phone = phoneRaw ? formatPhoneNumber(phoneRaw) : null;
                const parentPhone = parentPhoneRaw ? formatPhoneNumber(parentPhoneRaw) : null;

                // 3. Check duplicates (name + phone, name + parentPhone)
                if (status !== 'error') {
                    const isDup = existingStudents.some(es => {
                        const phoneMatch = phone && es.phone && es.phone !== '없음' && es.phone === phone;
                        const parentPhoneMatch = parentPhone && es.parentPhone && es.parentPhone !== '없음' && es.parentPhone === parentPhone;
                        return es.name === name && (phoneMatch || parentPhoneMatch);
                    });
                    if (isDup) {
                        status = 'duplicate';
                        duplicateCount++;
                    }
                }

                // Map teacher name to id
                let teacherId = '';
                if (teacherName) {
                    const foundTeacher = teachers.find(t => t.name === teacherName);
                    if (foundTeacher) {
                        teacherId = foundTeacher.id;
                    }
                }

                // Parse numeric fields
                const age = ageRaw ? parseInt(ageRaw) || null : null;
                const dueDay = dueDayRaw ? parseInt(dueDayRaw) || null : null;
                const fee = feeRaw ? parseInt(feeRaw) || 0 : 0;
                
                // Determine adult status
                const isAdult = adultRaw ? (adultRaw.includes('성인') && !adultRaw.includes('비성인')) : false;

                // Default instrument to 피아노 if empty
                const instrument = instrumentRaw || '피아노';

                // 4. Check incomplete (if not already error or duplicate)
                if (status !== 'error' && status !== 'duplicate') {
                    const contactMissing = !phone && !parentPhone;
                    const teacherMissing = !teacherId;
                    const dueDayMissing = dueDay === null || dueDay === undefined;
                    const feeMissing = feeRaw === null || feeRaw === undefined || feeRaw === '';

                    if (contactMissing || teacherMissing || dueDayMissing || feeMissing) {
                        status = 'incomplete';
                        incompleteCount++;
                    } else {
                        successCount++;
                    }
                }

                if (status === 'error') {
                    errorCount++;
                }

                // Add to list if not error
                if (status !== 'error') {
                    const tempStudent = {
                        name,
                        instrument,
                        phone,
                        parentName,
                        parentPhone,
                        fee,
                        dueDay,
                        teacherId,
                        age,
                        school,
                        isAdult,
                        birthDate,
                        gradeClass,
                        address,
                        experienceType: expType,
                        experiencePeriod: expPeriod,
                        hasInstrument: hasInst,
                        purpose,
                        lessonStyle,
                        consultationNotes: memo,
                        status: 'active'
                    };

                    const schedules = [];
                    if (scheduleDay && scheduleStart) {
                        // Format scheduleStart to HH:MM if it is a serial number or decimals
                        let time = scheduleStart;
                        if (!isNaN(scheduleStart) && parseFloat(scheduleStart) < 1) {
                            // Excel time decimals to HH:MM conversion
                            const totalMinutes = Math.round(parseFloat(scheduleStart) * 24 * 60);
                            const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
                            const m = String(totalMinutes % 60).padStart(2, '0');
                            time = `${h}:${m}`;
                        } else if (/^\d{1,2}:\d{2}$/.test(time)) {
                            // Normalize 9:30 to 09:30
                            const [h, m] = time.split(':');
                            time = `${h.padStart(2, '0')}:${m}`;
                        }
                        schedules.push({ dayOfWeek: scheduleDay, time });
                    }

                    parsedStudents.push({ rowIdx: idx, seq, studentData: tempStudent, schedules });
                }

                // Map status badges styling
                let badgeClass = 'status-badge ready';
                let badgeText = '등록 가능';
                if (status === 'incomplete') {
                    badgeClass = 'status-badge incomplete';
                    badgeText = '정보 미완성';
                } else if (status === 'error') {
                    badgeClass = 'status-badge error';
                    badgeText = '오류';
                } else if (status === 'duplicate') {
                    badgeClass = 'status-badge duplicate';
                    badgeText = '중복 의심';
                }

                trsHtml += `
                    <tr>
                        <td style="text-align: center;">${seq || idx + 1}</td>
                        <td style="text-align: center;"><span class="${badgeClass}">${badgeText}</span></td>
                        <td style="font-weight: 700; color: ${status === 'error' ? 'var(--danger)' : 'inherit'};">${name || '-'}</td>
                        <td>${phone || parentPhone || '-'}</td>
                        <td>${instrumentRaw || '-'}</td>
                        <td>${teacherName || '<span style="color:var(--danger)">없음</span>'}</td>
                        <td>${feeRaw ? parseInt(feeRaw).toLocaleString() + '원' : '0원'}</td>
                        <td style="font-size: 0.78rem; color: ${status === 'error' ? 'var(--danger)' : 'var(--text-muted)'};">
                            ${status === 'error' ? errorMsg : (status === 'duplicate' ? '동일 연락처의 원생이 이미 존재합니다.' : memo || '-')}
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = trsHtml;
            summaryText.innerHTML = `총 <strong style="color:var(--primary);">${totalCount}</strong>건 중 등록 가능 <strong style="color:var(--success);">${successCount}</strong>건, 정보 미완성 <strong style="color:var(--warning);">${incompleteCount}</strong>건, 중복 의심 <strong style="color:var(--accent);">${duplicateCount}</strong>건, 오류 <strong style="color:var(--danger);">${errorCount}</strong>건`;
            previewPanel.style.display = 'flex';

            // Enable submit if we have valid records
            if (parsedStudents.length > 0) {
                btnSubmit.disabled = false;
            } else {
                btnSubmit.disabled = true;
            }
        };

        // Form Submit trigger (Bulk Insert)
        btnSubmit.addEventListener('click', () => {
            if (parsedStudents.length === 0) return;

            // Sort parsedStudents in descending order of seq
            parsedStudents.sort((a, b) => {
                const seqA = parseInt(a.seq) || 0;
                const seqB = parseInt(b.seq) || 0;
                return seqB - seqA;
            });

            let successImport = 0;
            let incompleteImport = 0;
            const studentsList = [];

            parsedStudents.forEach(item => {
                const sData = item.studentData;
                const schedules = item.schedules;

                // Safe defaults for dueDay and fee to avoid database issues
                if (sData.dueDay === null || sData.dueDay === undefined) {
                    sData.dueDay = 10; // System default billing day
                }

                // Check if this student is incomplete
                const contactMissing = !sData.phone && !sData.parentPhone;
                const teacherMissing = !sData.teacherId;
                const feeMissing = sData.fee === undefined || sData.fee === null;
                const isIncomplete = contactMissing || teacherMissing || feeMissing;

                if (isIncomplete) {
                    incompleteImport++;
                } else {
                    successImport++;
                }

                const enrollDate = new Date().toISOString().slice(0, 10);
                sData.enrollDate = enrollDate;

                studentsList.push({ studentData: sData, schedules });
            });

            try {
                // Call batch insert
                stateStore.addStudentsBatch(studentsList);

                closeModal();

                // Display Toast notification
                const totalImported = parsedStudents.length;
                const alertMsg = `총 ${totalImported}건 중 ${totalImported}건 일괄 등록 완료 (${successImport}건 등록 성공, ${incompleteImport}건 정보 미완성 상태)`;
                
                // Dispatch a KakaoTalk notification look-alike toast as feedback
                const event = new CustomEvent('kakaotalk-alert', {
                    detail: { message: alertMsg }
                });
                window.dispatchEvent(event);
            } catch (err) {
                console.error("Excel upload failed:", err);
                alert("엑셀 데이터 등록 중 오류가 발생했습니다. 브라우저 저장 용량이 초과되었을 수 있습니다.\n오류 내용: " + err.message);
            }
        });
    };

    openModal(modalHtml, onInitModal);
};
export function renderStudents(container) {
    let filterQuery = '';
    let filterTeacherId = '';
    let filterDayOfWeek = '';
    let filterStatus = 'active'; // 'active', 'discharged', 'all'

    // Sorting state
    let sortKey = 'studentMemberNo'; // 'studentMemberNo', 'enrollDate', 'name'
    let sortDirection = 'desc'; // 'asc', 'desc'

    // Pagination state
    let currentPage = 1;
    const itemsPerPage = 100;

    const toggleSort = (key) => {
        if (sortKey === key) {
            sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
            sortKey = key;
            sortDirection = 'desc'; // Default to descending on new click
        }
        currentPage = 1;
        renderTableBody();
    };

    const getSortIcon = (key) => {
        if (sortKey !== key) {
            return '<i class="fa-solid fa-sort" style="margin-left: 4px; opacity: 0.3;"></i>';
        }
        return sortDirection === 'asc' 
            ? '<i class="fa-solid fa-sort-up" style="margin-left: 4px; color: var(--primary);"></i>'
            : '<i class="fa-solid fa-sort-down" style="margin-left: 4px; color: var(--primary);"></i>';
    };

    const render = () => {
        const teachers = stateStore.getTeachers();

        container.innerHTML = `
            <!-- Filter Bar Card -->
            <div class="glass-card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <div style="display: flex; gap: 12px; flex-grow: 1; flex-wrap: wrap; max-width: 900px;">
                        <!-- Search input -->
                        <div style="position: relative; flex-grow: 1; min-width: 220px;">
                            <input type="text" id="student-search-input" class="form-control" placeholder="원생 이름 또는 수강 과목 검색..." style="width: 100%; padding-left: 40px; margin-bottom: 0;" value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        </div>
                        
                        <!-- Teacher filter -->
                        <select id="student-teacher-filter" class="form-control" style="min-width: 160px; margin-bottom: 0;">
                            <option value="">강사 전체</option>
                            ${teachers.map(t => `<option value="${t.id}" ${filterTeacherId === t.id ? 'selected' : ''}>${t.name} (${t.instrument})</option>`).join('')}
                        </select>

                        <!-- Day filter -->
                        <select id="student-day-filter" class="form-control" style="min-width: 130px; margin-bottom: 0;">
                            <option value="">수업 요일 전체</option>
                            ${['월', '화', '수', '목', '금', '토', '일'].map(d => `<option value="${d}" ${filterDayOfWeek === d ? 'selected' : ''}>${d}요일</option>`).join('')}
                        </select>

                        <!-- Enrollment Status filter -->
                        <select id="student-status-filter" class="form-control" style="min-width: 130px; margin-bottom: 0;">
                            <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>재원생 전체</option>
                            <option value="discharged" ${filterStatus === 'discharged' ? 'selected' : ''}>퇴원생 전체</option>
                            <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>원생 전체</option>
                        </select>
                    </div>

                    <div class="student-action-buttons-group">
                        <button class="btn btn-secondary btn-student-action" id="btn-print-student-register" style="border-color: rgba(0, 206, 201, 0.4); background: rgba(0, 206, 201, 0.15); color: var(--accent); display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-print"></i> 수강생 대장 인쇄
                        </button>
                        <button class="btn btn-secondary btn-student-action" id="btn-excel-upload" style="border-color: rgba(9, 132, 227, 0.4); background: rgba(9, 132, 227, 0.15); color: var(--primary); display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-file-excel"></i> 엑셀 업로드
                        </button>
                        <button class="btn btn-primary btn-student-action" id="btn-add-student" style="display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-plus"></i> 원생 등록
                        </button>
                    </div>
                </div>
            </div>

            <!-- Student List Table Card -->
            <div class="glass-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 5px 5px 0 5px;">
                    <h4 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        원생 목록 <span id="student-total-count" style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">(총 -명)</span>
                    </h4>
                </div>
                <div class="table-wrapper">
                    <table class="custom-table" id="students-table" style="table-layout: fixed; width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 100px; text-align: center; cursor: pointer; user-select: none;" id="th-student-member-no">
                                    회원번호 ${getSortIcon('studentMemberNo')}
                                </th>
                                <th style="width: 140px; cursor: pointer; user-select: none;" id="th-student-name">
                                    원생명 ${getSortIcon('name')}
                                </th>
                                <th style="width: 120px; cursor: pointer; user-select: none;" id="th-student-enroll-date">
                                    등록일 ${getSortIcon('enrollDate')}
                                </th>
                                <th style="width: 150px;">연락처</th>
                                <th style="width: 130px;">담당 강사</th>
                                <th style="width: 250px;">수업 시간표</th>
                                <th style="width: 150px;">수강료 (납부 약정일)</th>
                                <th style="width: 140px; text-align: right;">관리</th>
                            </tr>
                        </thead>
                        <tbody id="students-table-body">
                            <!-- Rows rendered dynamically -->
                        </tbody>
                    </table>
                </div>
                <div id="students-pagination-container"></div>
            </div>
        `;

        // Attach event listeners to filters
        const searchInput = container.querySelector('#student-search-input');
        const teacherFilter = container.querySelector('#student-teacher-filter');
        const dayFilter = container.querySelector('#student-day-filter');
        const statusFilter = container.querySelector('#student-status-filter');
        const btnAddStudent = container.querySelector('#btn-add-student');
        const btnPrintStudentRegister = container.querySelector('#btn-print-student-register');
        const btnExcelUpload = container.querySelector('#btn-excel-upload');

        if (btnPrintStudentRegister) {
            btnPrintStudentRegister.addEventListener('click', () => {
                printStudentRegister();
            });
        }

        if (btnExcelUpload) {
            btnExcelUpload.addEventListener('click', () => {
                openExcelUploadModal();
            });
        }

        searchInput.addEventListener('input', (e) => {
            filterQuery = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        teacherFilter.addEventListener('change', (e) => {
            filterTeacherId = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        dayFilter.addEventListener('change', (e) => {
            filterDayOfWeek = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        statusFilter.addEventListener('change', (e) => {
            filterStatus = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        btnAddStudent.addEventListener('click', () => {
            openStudentModal();
        });

        // Attach header sort click events
        container.querySelector('#th-student-member-no').addEventListener('click', () => toggleSort('studentMemberNo'));
        container.querySelector('#th-student-name').addEventListener('click', () => toggleSort('name'));
        container.querySelector('#th-student-enroll-date').addEventListener('click', () => toggleSort('enrollDate'));

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#students-table-body');
        const paginationContainer = container.querySelector('#students-pagination-container');
        if (!tbody) return;

        const students = stateStore.getStudents();
        const teachers = stateStore.getTeachers();
        const classes = stateStore.getClasses();

        // Apply filtering logic
        const filteredStudents = students.filter(s => {
            const queryMatch = !filterQuery || 
                s.name.toLowerCase().includes(filterQuery.toLowerCase()) || 
                s.instrument.toLowerCase().includes(filterQuery.toLowerCase());

            const teacherMatch = !filterTeacherId || s.teacherId === filterTeacherId;

            let dayMatch = true;
            if (filterDayOfWeek) {
                const studentClasses = classes.filter(c => c.studentId === s.id);
                dayMatch = studentClasses.some(c => c.dayOfWeek === filterDayOfWeek);
            }

            let statusMatch = true;
            if (filterStatus === 'active') {
                statusMatch = s.status !== 'withdrawn';
            } else if (filterStatus === 'discharged') {
                statusMatch = s.status === 'withdrawn';
            }

            return queryMatch && teacherMatch && dayMatch && statusMatch;
        });

        // Update total student count in the header
        const totalCountEl = container.querySelector('#student-total-count');
        if (totalCountEl) {
            totalCountEl.textContent = `(총 ${filteredStudents.length}명)`;
        }

        // Apply Sorting logic
        filteredStudents.sort((a, b) => {
            let valA, valB;
            if (sortKey === 'studentMemberNo') {
                valA = a.studentMemberNo || 0;
                valB = b.studentMemberNo || 0;
            } else if (sortKey === 'enrollDate') {
                valA = a.enrollDate || '';
                valB = b.enrollDate || '';
            } else if (sortKey === 'name') {
                valA = a.name || '';
                valB = b.name || '';
            }

            if (typeof valA === 'string') {
                return sortDirection === 'asc' 
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            } else {
                return sortDirection === 'asc'
                    ? valA - valB
                    : valB - valA;
            }
        });

        // Update sorting icons
        const thMemberNo = container.querySelector('#th-student-member-no');
        const thName = container.querySelector('#th-student-name');
        const thEnrollDate = container.querySelector('#th-student-enroll-date');
        if (thMemberNo) thMemberNo.innerHTML = `회원번호 ${getSortIcon('studentMemberNo')}`;
        if (thName) thName.innerHTML = `원생명 ${getSortIcon('name')}`;
        if (thEnrollDate) thEnrollDate.innerHTML = `등록일 ${getSortIcon('enrollDate')}`;

        // Apply Pagination logic
        const totalItems = filteredStudents.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        if (paginatedStudents.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: rgba(255,255,255,0.05); margin-bottom: 8px; display: block;"></i>
                        검색 조건에 일치하는 원생이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredStudents.map(s => {
            const teacher = teachers.find(t => t.id === s.teacherId);
            const studentClasses = classes.filter(c => c.studentId === s.id);
            
            // Format schedule blocks nicely
            const scheduleText = studentClasses.length > 0
                ? studentClasses.map(c => `<span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-color); white-space: nowrap;">${c.dayOfWeek} ${c.time}</span>`).join(' ')
                : '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">미등록</span>';

            const ageSchoolText = [
                (s.isAdult === true || s.isAdult === 'adult') ? '성인' : ((s.isAdult === false || s.isAdult === 'minor') ? '비성인' : '-'),
                s.age ? `${s.age}세` : '',
                s.school ? s.school : ''
            ].filter(Boolean).join(' | ');

            const isDischarged = s.status === 'withdrawn';
            const statusBadge = isDischarged ? `<span class="badge badge-danger" style="margin-left: 6px; padding: 2px 8px; border-radius: 12px; background: var(--danger-light); color: var(--danger);">퇴원</span>` : '';

            const isIncomplete = isIncompleteStudent(s);
            const incompleteBadge = isIncomplete ? `<span class="badge badge-warning" style="margin-left: 6px; padding: 2px 8px; border-radius: 12px; background: var(--warning-light); color: var(--warning); border: 1px solid rgba(241, 196, 15, 0.3); font-size: 0.72rem; font-weight: bold;">정보 미완성</span>` : '';

            return `
                <tr>
                    <!-- 1. 회원번호 -->
                    <td style="text-align: center; font-weight: bold; color: var(--text-main); font-size: 0.9rem; word-break: break-all;">
                        ${s.studentMemberNo || '-'}
                    </td>
                    <!-- 2. 원생명 -->
                    <td style="font-weight: 600; word-break: break-word;">
                        <span class="student-name-link" data-id="${s.id}" style="font-size: 0.95rem; color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${s.name}</span>
                        ${statusBadge}
                        ${incompleteBadge}
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">구분: ${s.status === 'withdrawn' ? '퇴원' : '재원'}</div>
                        ${ageSchoolText ? `<div style="font-size: 0.75rem; color: var(--secondary); font-weight: 500; margin-top: 2px;">${ageSchoolText}</div>` : ''}
                    </td>
                    <!-- 3. 등록일 -->
                    <td style="font-size: 0.85rem; color: var(--text-main); text-align: center; word-break: break-all;">
                        <div>${s.enrollDate || '-'}</div>
                        ${isDischarged && s.leaveDate ? `<div style="font-size: 0.72rem; color: var(--danger); font-weight: bold; margin-top: 2px;">퇴원: ${s.leaveDate}</div>` : ''}
                    </td>
                    <!-- 4. 연락처 -->
                    <td style="word-break: break-all;">
                        <div style="font-size: 0.85rem; font-weight: 500;">본인: ${s.phone || '-'}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">학부모: ${s.parentPhone || '-'}</div>
                    </td>
                    <!-- 5. 담당 강사 -->
                    <td style="word-break: break-word;">
                        <div style="font-weight: 600; color: var(--accent); font-size: 0.9rem;">${s.instrument}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">강사: ${teacher ? teacher.name : '<span style="color:var(--danger)">미지정</span>'}</div>
                    </td>
                    <!-- 6. 수업 시간표 -->
                    <td style="word-break: break-word;">
                        <div style="display: flex; gap: 4px 6px; flex-wrap: wrap; align-items: center; line-height: 1.5;">
                            ${scheduleText}
                        </div>
                    </td>
                    <!-- 7. 수강료 (납부 약정일) -->
                    <td style="word-break: break-word;">
                        <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${s.fee.toLocaleString()}원</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">매월 ${s.dueDay}일 청구</div>
                    </td>
                    <!-- 8. 관리 -->
                    <td style="text-align: right; word-break: break-word;">
                        <div style="display: inline-flex; gap: 8px;">
                            ${s.status !== 'withdrawn' ? `
                            <button class="btn btn-secondary btn-icon-only discharge-student-btn" data-id="${s.id}" title="퇴원" style="background: rgba(225, 112, 85, 0.15); border-color: rgba(225, 112, 85, 0.4); color: #e17055;">
                                <i class="fa-solid fa-user-minus" style="font-size: 0.85rem;"></i>
                            </button>` : ''}
                            <button class="btn btn-secondary btn-icon-only manage-student-books-btn" data-id="${s.id}" title="교재 관리" style="background: rgba(0, 206, 201, 0.15); border-color: rgba(0, 206, 201, 0.4); color: var(--accent);">
                                <i class="fa-solid fa-book" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-secondary btn-icon-only edit-student-btn" data-id="${s.id}" title="수정" style="background: rgba(9, 132, 227, 0.15); border-color: rgba(9, 132, 227, 0.4); color: var(--primary);">
                                <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only delete-student-btn" data-id="${s.id}" title="삭제">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Action button click handlers
        tbody.querySelectorAll('.student-name-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openStudentDetailModal(id);
            });
        });

        tbody.querySelectorAll('.manage-student-books-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openStudentBooksModal(id);
            });
        });

        tbody.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openStudentModal(id);
            });
        });

        tbody.querySelectorAll('.discharge-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = stateStore.getStudent(id);
                if (confirm(`정말로 '${student.name}' 원생을 퇴원 처리하시겠습니까?\n퇴원 처리 시 대시보드 현황에서 제외되며 수강생 대장에 퇴원일이 기록됩니다.`)) {
                    stateStore.dischargeStudent(id);
                    showKakaoTalkToast(`'${student.name}' 원생이 퇴원 처리되었습니다.`);
                }
            });
        });

        tbody.querySelectorAll('.delete-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = stateStore.getStudent(id);
                
                openDeleteAuthModal(id, () => {
                    if (confirm(`정말로 '${student.name}' 원생의 명부를 삭제하시겠습니까?\n해당 원생의 모든 출석부 및 수강료 수납 내역이 삭제됩니다.`)) {
                        stateStore.deleteStudent(id);
                        showKakaoTalkToast(`'${student.name}' 원생 정보가 삭제(Soft Delete)되었습니다.`);
                    }
                });
            });
        });
    };

    // Modal Manager for Student Registration & Editing
    ;

    render();

    // Pub/Sub wiring
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', renderTableBody);
    const unsubClasses = stateStore.subscribe('CLASSES_CHANGED', renderTableBody);
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', render); // Needs full redraw to sync teacher dropdown options

    return () => {
        unsubStudents();
        unsubClasses();
        unsubTeachers();
    };
}

/**
 * 3. 수납 및 결제 현황 (renderPayments)
 * Renders a tuition payment table, showing each student's payment status for the current month.
 * Includes a toggle/modal to mark as paid and a button to simulate KakaoTalk alerts.
 */
export function renderPayments(container) {
    const todayStr = new Date().toISOString().slice(0, 7); // Default to current month
    let selectedMonth = '2026-05'; // Default mock month matching seed data

    const render = () => {
        const payments = stateStore.getPayments();
        
        // Find all unique months available in payment database records
        const uniqueMonths = [...new Set(payments.map(p => p.month))].sort((a, b) => b.localeCompare(a));
        if (uniqueMonths.length === 0) {
            uniqueMonths.push(selectedMonth);
        }

        container.innerHTML = `
            <!-- Top Controls -->
            <div class="glass-card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <label for="payment-month-select" style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted);">청구 월별 조회:</label>
                        <select id="payment-month-select" class="form-control" style="min-width: 150px; margin-bottom: 0;">
                            ${uniqueMonths.map(m => `<option value="${m}" ${selectedMonth === m ? 'selected' : ''}>${m.slice(0, 4)}년 ${m.slice(5, 7)}월</option>`).join('')}
                        </select>
                        <button class="btn btn-secondary" id="btn-print-receipt-register" style="height: 38px; border-color: rgba(0, 206, 201, 0.4); background: rgba(0, 206, 201, 0.15); color: var(--accent); font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-print"></i> 영수증 원부 인쇄
                        </button>
                        <button class="btn btn-secondary" id="btn-print-cash-book" style="height: 38px; border-color: rgba(0, 206, 201, 0.4); background: rgba(0, 206, 201, 0.15); color: var(--accent); font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-print"></i> 현금출납부 인쇄
                        </button>
                    </div>

                    <div style="display: flex; gap: 16px; font-size: 0.85rem; flex-wrap: wrap;" id="payment-summary-stats">
                        <!-- Stats filled dynamically -->
                    </div>
                </div>
            </div>

            <!-- Tuition Payments Table -->
            <div class="glass-card">
                <div class="table-wrapper">
                    <table class="custom-table" id="payments-table">
                        <thead>
                            <tr>
                                <th>원생명</th>
                                <th>수납 구분</th>
                                <th>청구 금액</th>
                                <th>청구일 (납부 기한)</th>
                                <th>수납 상태</th>
                                <th>수납 처리 정보</th>
                                <th style="text-align: right;">수납 행정 관리</th>
                            </tr>
                        </thead>
                        <tbody id="payments-table-body">
                            <!-- Rows loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const monthSelect = container.querySelector('#payment-month-select');
        monthSelect.addEventListener('change', (e) => {
            selectedMonth = e.target.value;
            renderTableBody();
        });

        const btnPrintReceiptRegister = container.querySelector('#btn-print-receipt-register');
        if (btnPrintReceiptRegister) {
            btnPrintReceiptRegister.addEventListener('click', () => {
                printReceiptRegister(selectedMonth);
            });
        }

        const btnPrintCashBook = container.querySelector('#btn-print-cash-book');
        if (btnPrintCashBook) {
            btnPrintCashBook.addEventListener('click', () => {
                printCashBook(selectedMonth);
            });
        }

        renderTableBody();
    };

    const sendPaymentRequestNotification = ({ message_type, receiver_type, receiver_phone, student_id, payment_id, academy_id }) => {
        console.log("Simulating Kakao Biz message sending via payment request API:", {
            message_type,
            receiver_type,
            receiver_phone,
            student_id,
            payment_id,
            academy_id
        });
    };

    const openPaymentRequestModal = (paymentId) => {
        const paymentRecord = stateStore.db.payments.find(p => p.id === paymentId);
        if (!paymentRecord) return;
        const student = stateStore.getStudent(paymentRecord.studentId);
        if (!student) return;

        const selfPhone = student.phone ? student.phone.trim() : '';
        const parentPhone = student.parentPhone ? student.parentPhone.trim() : '';

        const hasSelfPhone = !!selfPhone;
        const hasParentPhone = !!parentPhone;

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">메세지 받을 사람 선택</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="margin-bottom: 1.5rem; text-align: center;">
                <p style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 0;">원생명: <strong>${student.name}</strong></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div class="receiver-option ${hasSelfPhone ? '' : 'disabled'}" id="modal-receiver-self" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: ${hasSelfPhone ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'}; cursor: ${hasSelfPhone ? 'pointer' : 'not-allowed'}; opacity: ${hasSelfPhone ? '1' : '0.5'}; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 1rem; color: ${hasSelfPhone ? 'var(--text-main)' : 'var(--text-muted)'};">본인 (원생)</span>
                        ${hasSelfPhone ? '<i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>' : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        ${hasSelfPhone ? formatPhoneNumber(selfPhone) : '연락 정보가 없습니다.'}
                    </div>
                </div>

                <div class="receiver-option ${hasParentPhone ? '' : 'disabled'}" id="modal-receiver-parent" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: ${hasParentPhone ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'}; cursor: ${hasParentPhone ? 'pointer' : 'not-allowed'}; opacity: ${hasParentPhone ? '1' : '0.5'}; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 1rem; color: ${hasParentPhone ? 'var(--text-main)' : 'var(--text-muted)'};">학부모</span>
                        ${hasParentPhone ? '<i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>' : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        ${hasParentPhone ? `${student.parentName ? student.parentName + ' - ' : ''}${formatPhoneNumber(parentPhone)}` : '연락 정보가 없습니다.'}
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" data-close-modal style="width: 100%; display: flex; justify-content: center; align-items: center;">취소</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            const options = contentArea.querySelectorAll('.receiver-option:not(.disabled)');
            options.forEach(opt => {
                opt.addEventListener('mouseenter', () => {
                    opt.style.borderColor = 'var(--primary)';
                    opt.style.background = 'rgba(var(--primary-rgb), 0.1)';
                });
                opt.style.borderColor = 'var(--border-color)';
                opt.addEventListener('mouseleave', () => {
                    opt.style.borderColor = 'var(--border-color)';
                    opt.style.background = 'rgba(255,255,255,0.03)';
                });

                opt.addEventListener('click', () => {
                    const type = opt.id === 'modal-receiver-self' ? 'self' : 'parent';
                    const phone = type === 'self' ? selfPhone : parentPhone;
                    confirmSendPaymentRequest(paymentRecord, student, type, phone);
                });
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const confirmSendPaymentRequest = (paymentRecord, student, receiverType, receiverPhone) => {
        const academy = stateStore.getSettings();
        const academyId = academy.academyId || 'academy_1';

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">결제 요청 확인</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="text-align: center; margin: 1.5rem 0; font-size: 1.05rem; line-height: 1.5;">
                <p style="margin-bottom: 12px; font-weight: 500;">결제 요청 메세지를 보내시겠습니까?</p>
                <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm); font-size: 0.88rem; text-align: left; display: inline-block; width: 100%; box-sizing: border-box;">
                    <div>• <strong>수신 구분:</strong> ${receiverType === 'self' ? '본인' : '학부모'}</div>
                    <div>• <strong>연락처:</strong> ${formatPhoneNumber(receiverPhone)}</div>
                    <div>• <strong>청구 구분:</strong> ${paymentRecord.type === 'education' ? '교육비' : '교재비'}</div>
                    <div>• <strong>청구 금액:</strong> ${paymentRecord.amount.toLocaleString()}원</div>
                </div>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; display: flex; justify-content: center; align-items: center;">아니오</button>
                <button class="btn btn-primary" id="btn-confirm-send-payment" style="flex: 1; display: flex; justify-content: center; align-items: center;">예</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            contentArea.querySelector('#btn-confirm-send-payment').addEventListener('click', () => {
                sendPaymentRequestNotification({
                    message_type: 'payment_request',
                    receiver_type: receiverType,
                    receiver_phone: receiverPhone,
                    student_id: student.id,
                    payment_id: paymentRecord.id,
                    academy_id: academyId
                });

                stateStore.requestBookPayment(paymentRecord.id);
                closeModal();
                showKakaoTalkToast("결제 요청 메시지가 발송되었습니다.");
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const openEditPaymentModal = (paymentId) => {
        const payment = stateStore.db.payments.find(p => p.id === paymentId);
        if (!payment) return;

        const student = stateStore.getStudent(payment.studentId);
        const studentName = student ? student.name : '퇴원 학생';

        const statusOptions = [
            { value: 'unpaid', label: '미수납' },
            { value: 'paid', label: '수납완료' },
            { value: 'partial', label: '부분수납' },
            { value: 'refunded', label: '환불' },
            { value: 'cancelled', label: '취소' }
        ];

        const methodOptions = [
            { value: '', label: '선택 없음' },
            { value: 'card', label: '카드' },
            { value: 'cash', label: '현금' },
            { value: 'transfer', label: '계좌이체' },
            { value: 'other', label: '기타' }
        ];

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">수납정보 수정</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="margin-bottom: 1rem; text-align: center;">
                <span style="font-size: 1.05rem; font-weight: bold;">${studentName}</span>
                <span style="font-size: 0.9rem; color: var(--text-muted);">님의 청구 정보 수정</span>
            </div>
            <form id="edit-payment-form" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납 상태</label>
                    <select id="edit-payment-status" class="form-control" style="width: 100%;">
                        ${statusOptions.map(o => `<option value="${o.value}" ${payment.status === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납 방법</label>
                    <select id="edit-payment-method" class="form-control" style="width: 100%;">
                        ${methodOptions.map(o => `<option value="${o.value}" ${payment.method === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납일</label>
                    <input type="date" id="edit-payment-date" class="form-control" value="${payment.paidDate || ''}" style="width: 100%;">
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납 금액</label>
                    <input type="number" id="edit-payment-amount" class="form-control" value="${payment.amount}" style="width: 100%;" required>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">메모</label>
                    <textarea id="edit-payment-notes" class="form-control" style="width: 100%; height: 60px; resize: none; font-size: 0.82rem;">${payment.notes || ''}</textarea>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 10px;">
                    <button type="button" class="btn btn-secondary" data-close-modal style="flex: 1; display: flex; justify-content: center; align-items: center;">취소</button>
                    <button type="submit" class="btn btn-primary" style="flex: 1; display: flex; justify-content: center; align-items: center;">저장</button>
                </div>
            </form>
        `;

        const onInitModal = (contentArea) => {
            const form = contentArea.querySelector('#edit-payment-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const status = contentArea.querySelector('#edit-payment-status').value;
                const method = contentArea.querySelector('#edit-payment-method').value;
                const paidDate = contentArea.querySelector('#edit-payment-date').value;
                const amount = parseInt(contentArea.querySelector('#edit-payment-amount').value, 10) || 0;
                const notes = contentArea.querySelector('#edit-payment-notes').value.trim();

                stateStore.updatePayment(paymentId, {
                    status,
                    method: method || null,
                    paidDate: paidDate || null,
                    amount,
                    notes: notes || null
                });

                closeModal();
                showKakaoTalkToast("수납 정보가 수정되었습니다.");
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const revertPaymentToUnpaid = (paymentId) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">상태 변경 확인</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="text-align: center; margin: 1.5rem 0; font-size: 1.05rem;">
                <p style="margin-bottom: 0; font-weight: 500;">해당 수납 건을 미수납 상태로 변경하시겠습니까?</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; display: flex; justify-content: center; align-items: center;">아니오</button>
                <button class="btn btn-primary" id="btn-confirm-revert" style="flex: 1; display: flex; justify-content: center; align-items: center;">예</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            contentArea.querySelector('#btn-confirm-revert').addEventListener('click', () => {
                stateStore.updatePayment(paymentId, {
                    status: 'unpaid',
                    method: null,
                    paidDate: null
                });
                closeModal();
                showKakaoTalkToast("미수납 상태로 변경되었습니다.");
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#payments-table-body');
        const statsEl = container.querySelector('#payment-summary-stats');
        if (!tbody || !statsEl) return;

        const payments = stateStore.getPayments();
        const students = stateStore.getStudents();

        // Filter payments for chosen month and sort by date descending (newest first)
        const monthPayments = payments.filter(p => p.month === selectedMonth);
        monthPayments.sort((a, b) => {
            const dateCompare = b.invoiceDate.localeCompare(a.invoiceDate);
            if (dateCompare !== 0) return dateCompare;
            // Numeric comparison of the ID (e.g. 'P10' > 'P9') to fix lexicographical sorting order
            const idA = parseInt(a.id.replace(/[^\d]/g, '')) || 0;
            const idB = parseInt(b.id.replace(/[^\d]/g, '')) || 0;
            return idB - idA;
        });

        // Summaries calculations (including 'requested' as unpaid)
        const totalBilled = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPaid = monthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
        const totalUnpaid = monthPayments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0);
        const paidCount = monthPayments.filter(p => p.status === 'paid').length;
        const totalCount = monthPayments.length;

        statsEl.innerHTML = `
            <span>청구 합계: <strong style="color: var(--text-main);">${totalBilled.toLocaleString()}원</strong></span>
            <span style="color: var(--success);">완납: <strong>${totalPaid.toLocaleString()}원 (${paidCount}/${totalCount}건)</strong></span>
            <span style="color: var(--danger);">미납: <strong>${totalUnpaid.toLocaleString()}원</strong></span>
        `;

        if (monthPayments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        해당 수납 청구 기간에 등록된 내역이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = monthPayments.map(p => {
            const student = students.find(s => s.id === p.studentId);
            const studentName = student ? student.name : '<span style="color:var(--text-muted)">퇴원 학생</span>';
            const dueDay = student ? student.dueDay : '-';
            const parentPhone = student ? student.parentPhone : '';

            let typeBadge = '';
            if (p.type === 'book') {
                typeBadge = `<span class="badge badge-info" style="font-size: 0.8rem; background: rgba(9, 132, 227, 0.15); color: #74b9ff; border: 1px solid rgba(9, 132, 227, 0.3);">교재비</span>`;
            } else {
                typeBadge = `<span class="badge badge-success" style="font-size: 0.8rem; background: rgba(0, 184, 148, 0.15); color: #55efc4; border: 1px solid rgba(0, 184, 148, 0.3);">교육비</span>`;
            }

            let statusBadge = '';
            let paymentDetail = '';
            let actionHtml = '';

            const methodLabel = {
                'toss': '토스페이',
                'kakao': '카카오페이',
                'card': '신용카드',
                'cash': '현금 수납',
                'transfer': '계좌이체',
                'other': '기타'
            }[p.method] || p.method || '-';

            if (p.status === 'paid') {
                statusBadge = `<span class="badge badge-success" style="font-size:0.8rem;"><i class="fa-solid fa-circle-check"></i> 완납</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">결제완료 (${methodLabel})</span>`;

                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미수납 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'requested') {
                statusBadge = `<span class="badge badge-warning" style="font-size:0.8rem; background: var(--primary); color: white;"><i class="fa-solid fa-paper-plane"></i> 결제 요청됨</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">결제 요청 상태</span>`;

                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-success btn-pay-action" data-id="${p.id}" data-student="${studentName}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-check"></i> 수납 처리
                        </button>
                        <button class="btn btn-secondary btn-send-reminder" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-comment" style="color: #3c1e1e;"></i> 재요청
                        </button>
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미수납 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'partial') {
                statusBadge = `<span class="badge badge-warning" style="font-size:0.8rem; background: rgba(243, 156, 18, 0.15); color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.3);"><i class="fa-solid fa-circle-minus"></i> 부분수납</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">일부 납부 완료</span>`;
                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-success btn-pay-action" data-id="${p.id}" data-student="${studentName}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-check"></i> 추가 수납
                        </button>
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미수납 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'refunded') {
                statusBadge = `<span class="badge badge-secondary" style="font-size:0.8rem; background: rgba(255,255,255,0.1); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.15);"><i class="fa-solid fa-arrow-rotate-left"></i> 환불</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">환불 완료</span>`;
                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미수납 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'cancelled') {
                statusBadge = `<span class="badge badge-secondary" style="font-size:0.8rem; background: rgba(255,255,255,0.1); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.15);"><i class="fa-solid fa-ban"></i> 취소</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">청구 취소</span>`;
                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미수납 변경
                        </button>
                    </div>
                `;
            } else {
                statusBadge = `<span class="badge badge-danger" style="font-size:0.8rem;"><i class="fa-solid fa-circle-exclamation"></i> 미납</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">미납 상태</span>`;

                let reminderLabel = p.type === 'book' ? '결제 요청' : '알림 발송';

                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-success btn-pay-action" data-id="${p.id}" data-student="${studentName}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-check"></i> 수납 처리
                        </button>
                        <button class="btn btn-secondary btn-send-reminder" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-comment" style="color: #3c1e1e;"></i> ${reminderLabel}
                        </button>
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                    </div>
                `;
            }

            return `
                <tr>
                    <td style="font-weight: 600;">
                        <span class="student-name-link" data-id="${p.studentId}" style="font-size: 0.95rem; color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${studentName}</span>
                        ${student ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">학부모: ${parentPhone}</div>` : ''}
                    </td>
                    <td>${typeBadge}</td>
                    <td style="font-weight: 600; color: var(--text-main);">${p.amount.toLocaleString()}원</td>
                    <td>
                        <div style="font-size: 0.85rem;">청구: ${p.invoiceDate}</div>
                        ${p.type === 'education' ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">매월 ${dueDay}일 납부 약정</div>` : `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">교재 배부 등록일 기준</div>`}
                    </td>
                    <td>${statusBadge}</td>
                    <td>${paymentDetail}</td>
                    <td style="text-align: right;">${actionHtml}</td>
                </tr>
            `;
        }).join('');

        // Action button click bindings
        tbody.querySelectorAll('.btn-pay-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const studentName = e.currentTarget.dataset.student;
                openPayOptionsModal(id, studentName);
            });
        });

        tbody.querySelectorAll('.btn-send-reminder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openPaymentRequestModal(id);
            });
        });

        tbody.querySelectorAll('.btn-edit-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openEditPaymentModal(id);
            });
        });

        tbody.querySelectorAll('.btn-revert-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                revertPaymentToUnpaid(id);
            });
        });

        tbody.querySelectorAll('.student-name-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const studentId = e.currentTarget.dataset.id;
                if (studentId) {
                    openStudentDetailModal(studentId);
                }
            });
        });
    };

    // Pop up modal to select payment tool
    const openPayOptionsModal = (paymentId, studentName) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">수강료 결제 처리</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <p style="font-size: 1.05rem; margin-bottom: 4px;"><strong>${studentName}</strong> 원생의 결제를 등록합니다.</p>
                <p style="font-size: 0.85rem; color: var(--text-muted);">납부 받으신 결제 수단을 하단에서 선택해 주세요.</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button class="btn btn-secondary btn-pay-toss" id="modal-pay-toss" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                    <i class="fa-solid fa-wallet"></i> 토스페이
                </button>
                <button class="btn btn-secondary btn-pay-kakao" id="modal-pay-kakao" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                    <i class="fa-solid fa-comment" style="color: #3c1e1e;"></i> 카카오페이
                </button>
                <button class="btn btn-primary" id="modal-pay-card" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                    <i class="fa-solid fa-credit-card"></i> 신용카드
                </button>
                <button class="btn btn-secondary" id="modal-pay-cash" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md); background: rgba(255,255,255,0.06);">
                    <i class="fa-solid fa-coins"></i> 현금 수납
                </button>
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" data-close-modal style="width: 100%; display: flex; justify-content: center; align-items: center;">취소</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            const registerPayment = (method) => {
                stateStore.payInvoice(paymentId, method);
                closeModal();
            };

            contentArea.querySelector('#modal-pay-toss').addEventListener('click', () => registerPayment('toss'));
            contentArea.querySelector('#modal-pay-kakao').addEventListener('click', () => registerPayment('kakao'));
            contentArea.querySelector('#modal-pay-card').addEventListener('click', () => registerPayment('card'));
            contentArea.querySelector('#modal-pay-cash').addEventListener('click', () => registerPayment('cash'));
        };

        openModal(modalHtml, onInitModal);
    };

    render();

    // Subscriptions setup
    const unsubPayments = stateStore.subscribe('PAYMENTS_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);

    return () => {
        unsubPayments();
        unsubStudents();
    };
}

/**
 * 4. 강사 명부 관리 (renderTeachers)
 * Renders list of teachers, with forms to add, edit, or delete teachers.
 * Built with a responsive 2-column layout.
 */
export function renderTeachers(container) {
    let editingTeacherId = null; // Stored ID if editing, otherwise null (means add mode)
    let phoneBinder = null;

    const render = () => {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;" class="teachers-layout-grid">
                <!-- Column 1: Teacher List Table -->
                <div class="glass-card" style="display: flex; flex-direction: column;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-user-group" style="color: var(--primary);"></i>
                        학원 등록 강사 현황
                    </h3>
                    <div class="table-wrapper" style="margin-top: 0; flex-grow: 1;">
                        <table class="custom-table" id="teachers-table">
                            <thead>
                                <tr>
                                    <th>이름</th>
                                    <th>담당 과목 / 악기</th>
                                    <th>연락처</th>
                                    <th>이메일</th>
                                    <th style="text-align: right;">관리</th>
                                </tr>
                            </thead>
                            <tbody id="teachers-table-body">
                                <!-- Loaded dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Column 2: Add/Edit Glass Card Form -->
                <div class="glass-card" id="teacher-form-card" style="height: fit-content; align-self: start;">
                    <h3 id="form-heading" style="font-size: 1.15rem; font-weight: 700; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-user-plus" style="color: var(--accent);"></i>
                        신규 강사 등록
                    </h3>
                    <form id="teacher-form">
                        <div class="form-group">
                            <label for="teacher-name-input">강사 이름 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="teacher-name-input" class="form-control" placeholder="성함 입력" required>
                        </div>
                        <div class="form-group">
                            <label for="teacher-instrument-input">담당 과목 / 악기 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="teacher-instrument-input" class="form-control" placeholder="예: 피아노, 플루트, 성악" required>
                        </div>
                        <div class="form-group">
                            <label for="teacher-phone-input">전화번호 <span style="color: var(--danger);">*</span></label>
                            <input type="tel" id="teacher-phone-input" class="form-control" placeholder="010-0000-0000" required>
                            <span id="teacher-phone-error" style="color: var(--danger); font-size: 0.8rem; display: none; margin-top: 4px; font-weight: bold;">전화번호 오류</span>
                        </div>
                        <div class="form-group">
                            <label for="teacher-email-input">이메일 주소</label>
                            <input type="email" id="teacher-email-input" class="form-control" placeholder="example@turing.com">
                        </div>

                        <div style="display: flex; gap: 12px; margin-top: 1.8rem;" id="form-buttons-container">
                            <button type="submit" class="btn btn-primary" style="flex-grow: 1; justify-content: center; height: 42px;">
                                <i class="fa-solid fa-check"></i> <span id="submit-btn-label">등록 완료</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style>
                @media (max-width: 1024px) {
                    .teachers-layout-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>
        `;

        const form = container.querySelector('#teacher-form');
        const phoneInput = container.querySelector('#teacher-phone-input');
        const phoneError = container.querySelector('#teacher-phone-error');

        if (phoneBinder) {
            phoneBinder.destroy();
        }
        phoneBinder = PhoneNumberInput.bind(phoneInput, phoneError);

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = container.querySelector('#teacher-name-input').value.trim();
            const instrument = container.querySelector('#teacher-instrument-input').value.trim();
            const phone = phoneInput.value.trim();
            const email = container.querySelector('#teacher-email-input').value.trim();

            if (!phoneBinder.isValid()) {
                phoneInput.focus();
                return;
            }

            if (editingTeacherId) {
                stateStore.updateTeacher(editingTeacherId, { name, instrument, phone, email });
                resetForm();
            } else {
                stateStore.addTeacher({ name, instrument, phone, email });
                form.reset();
                if (phoneBinder) phoneBinder.validate();
                showKakaoTalkToast("등록이 완료되었습니다.");
            }
        });

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#teachers-table-body');
        if (!tbody) return;

        const teachers = stateStore.getTeachers();

        if (teachers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: rgba(255,255,255,0.05); margin-bottom: 8px; display: block;"></i>
                        등록된 강사가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = teachers.map(t => `
            <tr>
                <td style="font-weight: 600; color: var(--text-main);">${t.name}</td>
                <td><span class="badge badge-info" style="font-size: 0.8rem;">${t.instrument}</span></td>
                <td style="font-size: 0.85rem; font-weight: 500;">${t.phone}</td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">${t.email}</td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 8px;">
                        <button class="btn btn-secondary btn-icon-only edit-teacher-btn" data-id="${t.id}" title="수정">
                            <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                        </button>
                        <button class="btn btn-danger btn-icon-only delete-teacher-btn" data-id="${t.id}" title="삭제">
                            <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Action bindings
        tbody.querySelectorAll('.edit-teacher-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                startEditMode(id);
            });
        });

        tbody.querySelectorAll('.delete-teacher-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const teacher = stateStore.getTeacher(id);
                if (confirm(`정말로 ${teacher.name} 강사의 정보를 삭제하시겠습니까?\n강사 정보 삭제 시 기존 원생 배정 및 담당 정보가 영향을 받을 수 있습니다.`)) {
                    stateStore.deleteTeacher(id);
                    if (editingTeacherId === id) {
                        resetForm();
                    }
                }
            });
        });
    };

    const startEditMode = (teacherId) => {
        editingTeacherId = teacherId;
        const teacher = stateStore.getTeacher(teacherId);
        if (!teacher) return;

        // Populate fields
        container.querySelector('#teacher-name-input').value = teacher.name;
        container.querySelector('#teacher-instrument-input').value = teacher.instrument;
        container.querySelector('#teacher-phone-input').value = teacher.phone;
        container.querySelector('#teacher-email-input').value = teacher.email;
        if (phoneBinder) phoneBinder.validate();

        // Change layout elements to Edit Mode style
        container.querySelector('#form-heading').innerHTML = `
            <i class="fa-solid fa-user-pen" style="color: var(--primary);"></i>
            강사 정보 수정
        `;
        container.querySelector('#submit-btn-label').textContent = '수정 완료';

        const buttonsContainer = container.querySelector('#form-buttons-container');
        if (!container.querySelector('#cancel-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.style.flexGrow = '1';
            cancelBtn.style.justifyContent = 'center';
            cancelBtn.textContent = '취소';
            cancelBtn.addEventListener('click', resetForm);
            buttonsContainer.appendChild(cancelBtn);
        }
    };

    const resetForm = () => {
        editingTeacherId = null;
        
        const form = container.querySelector('#teacher-form');
        if (form) form.reset();

        const phoneInput = container.querySelector('#teacher-phone-input');
        if (phoneBinder) phoneBinder.validate();

        const heading = container.querySelector('#form-heading');
        if (heading) {
            heading.innerHTML = `
                <i class="fa-solid fa-user-plus" style="color: var(--accent);"></i>
                신규 강사 등록
            `;
        }
        
        const label = container.querySelector('#submit-btn-label');
        if (label) label.textContent = '등록 완료';

        const cancelBtn = container.querySelector('#cancel-edit-btn');
        if (cancelBtn) cancelBtn.remove();
    };

    render();

    // Subscribe to teachers changes
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', renderTableBody);

    return () => {
        if (phoneBinder) {
            phoneBinder.destroy();
        }
        unsubTeachers();
    };
}

// --- TAB SCHEDULES: TEACHER SHIFTS & STUDENT TIMETABLE ---
export function renderSchedules(container) {
    let activeSubTab = 'shift_view'; // 'shift_view', 'shift_edit', or 'match'
    let currentFilterTeacherId = ''; // For filtering matching timetable
    let selectedTeacherId = 'T8'; // Default teacher for shift editor (정은비 T8)
    
    // For weekly calendar reference
    let referenceDate = new Date('2026-05-18'); // Mon of the seed week
    
    // Temporary overrides Map for visual drag-and-drop simulation (Reset when DB changes or filter reset)
    let tempClassOverrides = {}; // Key: classId, Value: { dayOfWeek, time }
    
    const render = () => {
        container.innerHTML = `
            <div class="schedules-view-container">
                <!-- Sub Tab Navigation Card -->
                <div class="glass-card" style="margin-bottom: 24px; padding: 1.2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="btn ${activeSubTab === 'shift_view' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-shift-view">
                                <i class="fa-solid fa-calendar-week"></i> 강사 출근표 관리
                            </button>
                            <button class="btn ${activeSubTab === 'shift_edit' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-shift-edit">
                                <i class="fa-solid fa-clock-rotate-left"></i> 강사 출근시간 관리
                            </button>
                            <button class="btn ${activeSubTab === 'match' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-match">
                                <i class="fa-solid fa-network-wired"></i> 강사-원생 시간표 관리
                            </button>
                        </div>
                        <div id="schedule-date-controls" style="display: ${(activeSubTab === 'shift_view' || activeSubTab === 'shift_edit') ? 'flex' : 'none'}; align-items: center; gap: 12px;">
                            <button class="btn btn-secondary btn-icon-only" id="btn-prev-week"><i class="fa-solid fa-chevron-left"></i></button>
                            <span style="font-weight: 600; font-size: 0.95rem;" id="week-range-label">5월 18일 ~ 5월 24일</span>
                            <button class="btn btn-secondary btn-icon-only" id="btn-next-week"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                    </div>
                </div>

                <!-- Active View Workspace -->
                <div id="schedules-workspace"></div>
            </div>
        `;

        // Subtab event bindings
        container.querySelector('#btn-subtab-shift-view').addEventListener('click', () => {
            activeSubTab = 'shift_view';
            render();
        });
        container.querySelector('#btn-subtab-shift-edit').addEventListener('click', () => {
            activeSubTab = 'shift_edit';
            render();
        });
        container.querySelector('#btn-subtab-match').addEventListener('click', () => {
            activeSubTab = 'match';
            render();
        });

        if (activeSubTab === 'shift_view' || activeSubTab === 'shift_edit') {
            const prevBtn = container.querySelector('#btn-prev-week');
            const nextBtn = container.querySelector('#btn-next-week');
            prevBtn.addEventListener('click', () => {
                referenceDate.setDate(referenceDate.getDate() - 7);
                renderWorkspace();
            });
            nextBtn.addEventListener('click', () => {
                referenceDate.setDate(referenceDate.getDate() + 7);
                renderWorkspace();
            });
        }

        renderWorkspace();
    };

    const renderWorkspace = () => {
        const workspace = container.querySelector('#schedules-workspace');
        if (!workspace) return;

        if (activeSubTab === 'shift_view') {
            renderShiftView(workspace);
        } else if (activeSubTab === 'shift_edit') {
            renderShiftEditView(workspace);
        } else {
            renderMatchView(workspace);
        }
    };

    // TAB 1: Shift View (통합 주간 출근 현황판)
    const renderShiftView = (ws) => {
        const teachers = stateStore.getTeachers();
        const shifts = stateStore.getTeacherShifts();
        
        // Compute week dates based on referenceDate (Monday)
        const weekDates = [];
        const daysOfWeekKo = ['월', '화', '수', '목', '금', '토', '일'];
        
        const labelStart = `${referenceDate.getMonth() + 1}월 ${referenceDate.getDate()}일`;
        const sunday = new Date(referenceDate);
        sunday.setDate(sunday.getDate() + 6);
        const labelEnd = `${sunday.getMonth() + 1}월 ${sunday.getDate()}일`;
        
        const rangeLabel = container.querySelector('#week-range-label');
        if (rangeLabel) {
            rangeLabel.textContent = `${labelStart} ~ ${labelEnd}`;
        }

        for (let i = 0; i < 7; i++) {
            const d = new Date(referenceDate);
            d.setDate(d.getDate() + i);
            weekDates.push({
                dateStr: d.toISOString().slice(0, 10),
                dayKo: daysOfWeekKo[i],
                dayNum: d.getDate()
            });
        }

        ws.innerHTML = `
            <div class="glass-card" style="padding: 1.8rem; overflow-x: auto; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
                    <h3 style="font-weight: 700; font-size: 1.2rem; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-chart-gantt" style="color: var(--primary);"></i> 주간 강사 출근 현황
                    </h3>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                        ${teachers.map(t => `<span style="background: ${t.color}; color:#111; font-size:0.7rem; font-weight:bold; padding:3px 10px; border-radius:12px; display:inline-block; white-space:nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${t.name}</span>`).join(' ')}
                        <button class="btn btn-primary" id="btn-print-shifts" style="font-size: 0.75rem; padding: 4px 12px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;">
                            <i class="fa-solid fa-print"></i> 출력하기
                        </button>
                    </div>
                </div>
                
                <div style="position: relative; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: transparent; padding: 16px; min-width: 700px;">
                    <!-- Timeline container header -->
                    <div style="display: grid; grid-template-columns: 80px repeat(7, 1fr); border-bottom: 2px solid var(--border-color); background: var(--primary-light); padding: 12px 0; border-radius: var(--radius-md) var(--radius-md) 0 0; margin: -16px -16px 8px -16px;">
                        <div style="font-weight: 700; text-align: center; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; justify-content: center;"><i class="fa-regular fa-clock"></i></div>
                        ${weekDates.slice(0, 7).map(wd => `
                            <div style="font-weight: 700; text-align: center; font-size: 0.9rem; color: var(--text-main);">
                                ${wd.dayKo}요일
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; display: block; margin-top: 2px;">${wd.dateStr.slice(5).replace('-', '/')}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="display: flex; position: relative; height: 800px; margin-top: 8px;">
                        <!-- Time row labels (08:00 ~ 24:00) -->
                        <div style="width: 80px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid var(--border-color); padding-right: 12px; font-size: 0.72rem; color: var(--text-muted); text-align: right; padding-top: 5px; padding-bottom: 5px; font-weight: 600;">
                            <div>08:00</div>
                            <div>09:00</div>
                            <div>10:00</div>
                            <div>11:00</div>
                            <div>12:00</div>
                            <div>13:00</div>
                            <div>14:00</div>
                            <div>15:00</div>
                            <div>16:00</div>
                            <div>17:00</div>
                            <div>18:00</div>
                            <div>19:00</div>
                            <div>20:00</div>
                            <div>21:00</div>
                            <div>22:00</div>
                            <div>23:00</div>
                            <div>24:00</div>
                        </div>
                        
                        <!-- Day columns with absolute positioned shifts -->
                        <div style="flex-grow: 1; display: grid; grid-template-columns: repeat(7, 1fr); position: relative; height: 100%;">
                            <!-- Grid horizontal lines for alignment -->
                            ${(() => {
                                let lines = '';
                                for (let h = 1; h < 16; h++) {
                                    lines += `<div style="position: absolute; width: 100%; top: ${(h / 16) * 100}%; border-top: 1px dashed rgba(255,255,255,0.035); z-index: 1;"></div>`;
                                }
                                return lines;
                            })()}

                            ${weekDates.slice(0, 7).map((wd) => {
                                // Find all shifts on this date
                                const dayShifts = shifts.filter(ts => ts.date === wd.dateStr);
                                
                                // Generate elements for each teacher on shift
                                let shiftBlocksHtml = '';
                                if (dayShifts.length > 0) {
                                    const count = dayShifts.length;
                                    dayShifts.forEach((ds, index) => {
                                        const teacher = teachers.find(t => t.id === ds.teacherId);
                                        if (!teacher) return;
                                        
                                        if (!ds.slots || ds.slots.length === 0) return;
                                        
                                        const parseTimeToHour = (timeStr) => {
                                            const [h, m] = timeStr.split(':').map(Number);
                                            return h + m / 60.0;
                                        };

                                        const getShiftEndTimeStr = (lastSlot) => {
                                            if (!lastSlot) return '';
                                            const [hStr, mStr] = lastSlot.split(':');
                                            let h = parseInt(hStr);
                                            let m = parseInt(mStr) + 30;
                                            if (m >= 60) {
                                                h += 1;
                                                m = 0;
                                            }
                                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                        };

                                        const getWorkingRanges = (slots) => {
                                             if (!slots || slots.length === 0) return [];
                                             const sorted = [...slots].sort();
                                             const parseToMinutes = (timeStr) => {
                                                 const [h, m] = timeStr.split(':').map(Number);
                                                 return h * 60 + m;
                                             };

                                             const ranges = [];
                                             let currentRange = [sorted[0]];

                                             for (let i = 1; i < sorted.length; i++) {
                                                 const prevMinutes = parseToMinutes(sorted[i - 1]);
                                                 const currMinutes = parseToMinutes(sorted[i]);
                                                 if (currMinutes - prevMinutes === 30) {
                                                     currentRange.push(sorted[i]);
                                                 } else {
                                                     ranges.push(currentRange);
                                                     currentRange = [sorted[i]];
                                                 }
                                             }
                                             ranges.push(currentRange);
                                             return ranges;
                                        };

                                        const timelineStart = 8.0;
                                        const timelineEnd = 24.0;
                                        const totalHours = timelineEnd - timelineStart;
                                        const widthPercent = 100 / count;
                                        const leftPercent = index * widthPercent;

                                        const ranges = getWorkingRanges(ds.slots);
                                        ranges.forEach((range) => {
                                            const sortedSlots = range;
                                            const startHour = parseTimeToHour(sortedSlots[0]);
                                            const endHour = parseTimeToHour(getShiftEndTimeStr(sortedSlots[sortedSlots.length - 1]));
                                            
                                            const topPercent = Math.max(0, (startHour - timelineStart) / totalHours * 100);
                                            const heightPercent = Math.min(100 - topPercent, (endHour - startHour) / totalHours * 100);
                                            
                                            shiftBlocksHtml += `
                                                <div class="shift-bar-block" style="
                                                    position: absolute;
                                                    top: ${topPercent}%;
                                                    height: ${heightPercent}%;
                                                    left: ${leftPercent}%;
                                                    width: ${widthPercent - 2}%;
                                                    background-color: ${teacher.color || 'var(--primary-light)'};
                                                    border: 1px solid rgba(0,0,0,0.15);
                                                    border-top: 3px solid rgba(255,255,255,0.4);
                                                    border-radius: 4px;
                                                    padding: 2px;
                                                    font-size: 0.72rem;
                                                    color: #111;
                                                    font-weight: 800;
                                                    overflow: hidden;
                                                    text-align: center;
                                                    display: flex;
                                                    flex-direction: column;
                                                    justify-content: center;
                                                    align-items: center;
                                                    box-shadow: 0 3px 6px rgba(0,0,0,0.2);
                                                    z-index: 2;
                                                    line-height: 1.1;
                                                " title="${teacher.name} (${teacher.instrument}): ${sortedSlots[0]} ~ ${getShiftEndTimeStr(sortedSlots[sortedSlots.length-1])}">
                                                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">${teacher.name}</span>
                                                    <span style="font-size: 0.62rem; opacity: 0.85; font-weight: normal; margin-top: 2px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${sortedSlots[0]}~${getShiftEndTimeStr(sortedSlots[sortedSlots.length-1])}</span>
                                                </div>
                                            `;
                                        });
                                    });
                                }

                                return `
                                    <div style="position: relative; border-right: 1px solid var(--border-color); height: 100%;">
                                        ${shiftBlocksHtml}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const printBtn = ws.querySelector('#btn-print-shifts');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
    };

    // TAB 2: Shift Edit View (개별 출근 시간대 설정)
    const renderShiftEditView = (ws) => {
        const scrollContainer = ws.querySelector('#shift-editor-scroll-container');
        const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        const savedWindowScrollY = window.scrollY;

        const teachers = stateStore.getTeachers();
        const shifts = stateStore.getTeacherShifts();
        
        // Compute week dates based on referenceDate (Monday)
        const weekDates = [];
        const daysOfWeekKo = ['월', '화', '수', '목', '금', '토', '일'];
        
        const labelStart = `${referenceDate.getMonth() + 1}월 ${referenceDate.getDate()}일`;
        const sunday = new Date(referenceDate);
        sunday.setDate(sunday.getDate() + 6);
        const labelEnd = `${sunday.getMonth() + 1}월 ${sunday.getDate()}일`;
        
        const rangeLabel = container.querySelector('#week-range-label');
        if (rangeLabel) {
            rangeLabel.textContent = `${labelStart} ~ ${labelEnd}`;
        }

        for (let i = 0; i < 7; i++) {
            const d = new Date(referenceDate);
            d.setDate(d.getDate() + i);
            weekDates.push({
                dateStr: d.toISOString().slice(0, 10),
                dayKo: daysOfWeekKo[i],
                dayNum: d.getDate()
            });
        }

        const teacherOptions = teachers.map(t => `<option value="${t.id}" ${t.id === selectedTeacherId ? 'selected' : ''}>${t.name} (${t.instrument})</option>`).join('');

        ws.innerHTML = `
            <div class="glass-card" style="padding: 1.8rem; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 16px;">
                    <h3 style="font-weight: 700; font-size: 1.2rem; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-user-pen" style="color: var(--accent);"></i> 강사 개별 출근 시간대 설정
                    </h3>
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 250px;">
                        <label for="shift-teacher-select" style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted); white-space: nowrap; margin-bottom: 0;">대상 강사 선택:</label>
                        <select id="shift-teacher-select" class="form-control" style="margin-bottom: 0;">
                            ${teacherOptions}
                        </select>
                    </div>
                </div>

                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">
                    <i class="fa-solid fa-info-circle" style="color: var(--primary);"></i> 설정할 강사를 고른 뒤, 요일별 30분 단위 시간 슬롯 격자를 클릭하여 출근 시간대를 활성화/비활성화할 수 있습니다. 변경 사항은 즉시 데이터베이스에 기록됩니다.
                </p>

                <!-- Slot Selector Matrix (08:00 to 24:00) -->
                <div id="shift-editor-scroll-container" style="max-height: 480px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: transparent; padding: 12px;">
                    <table class="custom-table" style="table-layout: fixed; width: 100%; border: 1px solid var(--border-color); border-collapse: collapse;" id="shift-editor-table">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); background: var(--primary-light);">
                                <th style="width: 80px; text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px 4px; font-weight: bold;"><i class="fa-regular fa-clock"></i></th>
                                ${weekDates.slice(0, 7).map(wd => `
                                    <th style="text-align: center; font-size: 0.85rem; padding: 12px 6px;">
                                        ${wd.dayKo}요일
                                        <span style="display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 4px;">${wd.dateStr.slice(5).replace('-', '/')}</span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${
                                (() => {
                                    let rowsHtml = '';
                                    // Range: 08:00 to 24:00 (including 24:00)
                                    for (let h = 8; h <= 24; h++) {
                                        for (let m = 0; m < 60; m += 30) {
                                            if (h === 24 && m > 0) continue;
                                            const timeSlot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                            rowsHtml += `
                                                <tr style="border-bottom: 1px solid var(--border-color);">
                                                    <td style="text-align: center; font-weight: bold; color: var(--text-muted); font-size: 0.8rem; padding: 10px 4px; border-right: 1px solid var(--border-color); background: var(--primary-light);">${timeSlot}</td>
                                                    ${weekDates.slice(0, 7).map(wd => {
                                                        const hasShift = shifts.some(ts => ts.teacherId === selectedTeacherId && ts.date === wd.dateStr && ts.slots.includes(timeSlot));
                                                        const cellColor = hasShift ? 'var(--primary)' : 'transparent';
                                                        const checkedIcon = hasShift ? '<i class="fa-solid fa-check" style="font-size:0.65rem; color:white;"></i>' : '';
                                                        return `
                                                            <td style="padding: 6px; text-align: center; border-right: 1px solid var(--border-color); vertical-align: middle;">
                                                                <div class="shift-slot-cell" 
                                                                    data-date="${wd.dateStr}" 
                                                                    data-slot="${timeSlot}" 
                                                                    style="
                                                                        height: 24px; 
                                                                        width: 90%; 
                                                                        margin: 0 auto;
                                                                        background: ${cellColor}; 
                                                                        border: 1px solid var(--border-color); 
                                                                        border-radius: 4px; 
                                                                        cursor: pointer;
                                                                        transition: all 0.15s;
                                                                        display: flex;
                                                                        align-items: center;
                                                                        justify-content: center;
                                                                    "
                                                                    onmouseover="this.style.borderColor='var(--primary)'"
                                                                    onmouseout="this.style.borderColor='var(--border-color)'">
                                                                    ${checkedIcon}
                                                                </div>
                                                            </td>
                                                        `;
                                                    }).join('')}
                                                </tr>
                                            `;
                                        }
                                    }
                                    return rowsHtml;
                                })()
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const teacherSelect = ws.querySelector('#shift-teacher-select');
        teacherSelect.addEventListener('change', (e) => {
            selectedTeacherId = e.target.value;
            renderWorkspace();
        });

        ws.querySelectorAll('.shift-slot-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const date = target.dataset.date;
                const slot = target.dataset.slot;

                const dayShifts = shifts.find(ts => ts.teacherId === selectedTeacherId && ts.date === date);
                let activeSlots = dayShifts ? [...dayShifts.slots] : [];

                if (activeSlots.includes(slot)) {
                    activeSlots = activeSlots.filter(s => s !== slot);
                } else {
                    activeSlots.push(slot);
                }

                stateStore.saveTeacherShift(selectedTeacherId, date, activeSlots);
            });
        });

        // Restore scroll positions
        const newScrollContainer = ws.querySelector('#shift-editor-scroll-container');
        if (newScrollContainer) {
            newScrollContainer.scrollTop = savedScrollTop;
        }
        window.scrollTo(window.scrollX, savedWindowScrollY);
    };

    // TAB 3: Match View (Image 2 style)
    const renderMatchView = (ws) => {
        const teachers = stateStore.getTeachers();
        const students = stateStore.getStudents();
        const rawClasses = stateStore.getClasses();

        // Apply visual drag-and-drop overrides
        const classes = rawClasses.map(c => {
            if (tempClassOverrides[c.id]) {
                return { ...c, dayOfWeek: tempClassOverrides[c.id].dayOfWeek, time: tempClassOverrides[c.id].time };
            }
            return c;
        });
        
        // Define day columns
        const days = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
        const daysKo = ['월', '화', '수', '목', '금', '토', '일'];
        
        // Map dayKo to date label for 5/18 ~ 5/24 week representation dynamically
        const dateLabels = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date('2026-05-18');
            d.setDate(d.getDate() + i);
            dateLabels[daysKo[i]] = `${d.getMonth() + 1}/${d.getDate()}`;
        }

        // Time slots rows (08:00 to 24:00 in 30-min intervals)
        const timeSlots = [];
        for (let h = 8; h <= 24; h++) {
            timeSlots.push(`${String(h).padStart(2, '0')}:00`);
            if (h !== 24) {
                timeSlots.push(`${String(h).padStart(2, '0')}:30`);
            }
        }

        // Render Top color buttons list of teachers
        const teacherBadgesHtml = teachers.map(t => `
            <button class="btn btn-filter-teacher" 
                data-id="${t.id}" 
                style="
                    background-color: ${t.color || 'var(--primary)'}; 
                    color: #111; 
                    font-weight: 700; 
                    border-radius: 20px; 
                    padding: 6px 14px; 
                    border: 2px solid transparent;
                    transition: var(--transition);
                    font-size: 0.8rem;
                ">
                ${t.name}
            </button>
        `).join('');

        ws.innerHTML = `
            <div class="glass-card" style="padding: 1.5rem;">
                
                <!-- Top Teacher filter capsules (Image 2 Top) -->
                <div style="display: flex; gap: 8px; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center;" id="teacher-filter-row">
                    ${teacherBadgesHtml}
                    <button class="btn btn-secondary" id="btn-clear-match-filter" style="border-radius: 20px; font-weight: 600; padding: 5px 12px; font-size: 0.8rem;">필터 초기화</button>
                    <button class="btn btn-primary" id="btn-print-match" style="border-radius: 20px; font-weight: 600; padding: 5px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;">
                        <i class="fa-solid fa-print"></i> 출력하기
                    </button>
                </div>

                <!-- Match timetable (Image 2 Matrix) -->
                <div class="table-wrapper">
                    <table class="custom-table" style="table-layout: fixed; width: 100%; border: 1px solid var(--border-color); border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); background: var(--primary-light);">
                                <th style="width: 70px; text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px 4px; font-weight: bold;"><i class="fa-regular fa-clock"></i></th>
                                ${days.map((day, idx) => `
                                    <th style="text-align: center; font-size: 0.85rem; padding: 12px 6px;">
                                        ${day}
                                        <span style="display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 4px;">${dateLabels[daysKo[idx]]}</span>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${timeSlots.map(time => {
                                return `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <!-- Time header -->
                                        <td style="text-align: center; font-weight: bold; color: var(--text-muted); font-size: 0.8rem; padding: 10px 4px; border-right: 1px solid var(--border-color); background: var(--primary-light);">${time}</td>
                                        
                                        <!-- Days -->
                                        ${daysKo.map(dayKo => {
                                            // Find all classes at this day and time
                                            const hourClasses = classes.filter(c => c.dayOfWeek === dayKo && c.time === time);
                                            
                                            let pillsHtml = '';
                                            hourClasses.forEach(c => {
                                                const student = students.find(s => s.id === c.studentId);
                                                if (student) {
                                                    const teacher = teachers.find(t => t.id === student.teacherId);
                                                    const bgColor = teacher ? teacher.color : '#e2e8f0';
                                                    pillsHtml += `
                                                        <span class="student-match-pill" 
                                                            data-teacher-id="${student.teacherId}" 
                                                            data-student-id="${student.id}"
                                                            data-class-id="${c.id}"
                                                            draggable="true"
                                                            style="
                                                                background-color: ${bgColor}; 
                                                                color: #111; 
                                                                padding: 4px 10px; 
                                                                border-radius: 20px; 
                                                                font-size: 0.75rem; 
                                                                font-weight: 800; 
                                                                display: inline-flex; 
                                                                align-items: center;
                                                                gap: 4px;
                                                                cursor: pointer;
                                                                box-shadow: 0 1px 3px rgba(9, 132, 227, 0.08);
                                                                transition: all 0.25s;
                                                                margin: 3px;
                                                            ">
                                                            ${student.name}
                                                        </span>
                                                    `;
                                                }
                                            });

                                            return `
                                                <td class="match-cell-drop" data-day="${dayKo}" data-time="${time}" style="padding: 6px; text-align: center; border-right: 1px solid var(--border-color); vertical-align: middle; min-height: 48px;">
                                                    <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; min-height: 32px;">
                                                        ${pillsHtml || '<span style="color: var(--text-muted); opacity: 0.2; font-size: 0.7rem;">-</span>'}
                                                    </div>
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    // Highlight filters logic
    const buttons = ws.querySelectorAll('.btn-filter-teacher');
    const pills = ws.querySelectorAll('.student-match-pill');
    const clearFilterBtn = ws.querySelector('#btn-clear-match-filter');

    const applyFilter = (teacherId) => {
        currentFilterTeacherId = teacherId;

        // Highlight chosen button
        buttons.forEach(btn => {
            if (btn.dataset.id === teacherId) {
                btn.style.borderColor = 'white';
                btn.style.boxShadow = '0 0 10px rgba(255,255,255,0.3)';
                btn.style.transform = 'scale(1.08)';
            } else {
                btn.style.borderColor = 'transparent';
                btn.style.boxShadow = 'none';
                btn.style.transform = 'scale(1)';
            }
        });

        // Dim or light pills
        pills.forEach(pill => {
            if (pill.dataset.teacherId === teacherId) {
                pill.style.opacity = '1';
                pill.style.transform = 'scale(1.05)';
                pill.style.boxShadow = '0 3px 8px rgba(9, 132, 227, 0.15)';
            } else {
                pill.style.opacity = '0.12';
                pill.style.transform = 'scale(0.9)';
                pill.style.boxShadow = 'none';
            }
        });
    };

    const clearFilter = () => {
        currentFilterTeacherId = '';
        tempClassOverrides = {}; // Reset temporary simulation drag-and-drops
        buttons.forEach(btn => {
            btn.style.borderColor = 'transparent';
            btn.style.boxShadow = 'none';
            btn.style.transform = 'scale(1)';
        });
        pills.forEach(pill => {
            pill.style.opacity = '1';
            pill.style.transform = 'scale(1)';
            pill.style.boxShadow = '0 1px 3px rgba(9, 132, 227, 0.08)';
        });
        renderWorkspace(); // Full redraw to restore original positions
    };

    // Attach filter click handlers
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (currentFilterTeacherId === id) {
                clearFilter();
            } else {
                applyFilter(id);
            }
        });
    });

    clearFilterBtn.addEventListener('click', clearFilter);

    // Attach print handler
    const printBtn = ws.querySelector('#btn-print-match');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Restore active filter on redrawing
    if (currentFilterTeacherId) {
        applyFilter(currentFilterTeacherId);
    }

    // HTML5 Drag and Drop Handlers
    pills.forEach(pill => {
        pill.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/class-id', pill.dataset.classId);
            e.dataTransfer.effectAllowed = 'move';
            pill.style.opacity = '0.5';
        });
        pill.addEventListener('dragend', () => {
            pill.style.opacity = '1';
        });
    });

    ws.querySelectorAll('.match-cell-drop').forEach(cell => {
        cell.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            cell.style.background = 'rgba(9, 132, 227, 0.15)';
        });
        cell.addEventListener('dragleave', () => {
            cell.style.background = 'transparent';
        });
        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            cell.style.background = 'transparent';
            const classId = e.dataTransfer.getData('text/class-id');
            const targetDay = cell.dataset.day;
            const targetTime = cell.dataset.time;
            
            if (classId && targetDay && targetTime) {
                tempClassOverrides[classId] = { dayOfWeek: targetDay, time: targetTime };
                renderWorkspace(); // Reactive visual shift
            }
        });
    });

    // Student Pill Click Details Modal
    ws.querySelectorAll('.student-match-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid double cell trigger
            const studentId = pill.dataset.studentId;
            const student = students.find(s => s.id === studentId);
            const teacher = teachers.find(t => t.id === student.teacherId);
            
            if (student) {
                const classSchedules = stateStore.getClassesForStudent(studentId);
                const scheduleText = classSchedules.map(c => `${c.dayOfWeek} ${c.time}`).join(', ');

                const isIncomplete = isIncompleteStudent(student);
                const teacherMissing = !student.teacherId;

                let warningBannerHtml = '';
                if (isIncomplete) {
                    let warningText = '필수 운영 정보가 입력되지 않은 원생입니다. 담당 강사, 정기 청구일, 수강료 정보를 입력하면 모든 기능을 사용할 수 있습니다.';
                    if (teacherMissing) {
                        warningText += '<br><strong>담당 강사가 배정되지 않은 원생입니다. 수업 관리 기능을 사용하려면 담당 강사를 지정해 주세요.</strong>';
                    }
                    warningBannerHtml = `
                        <div style="background: var(--warning-light); border: 1px solid var(--warning); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 12px; color: #a04000; font-size: 0.8rem; line-height: 1.45; display: flex; align-items: flex-start; gap: 8px;">
                            <i class="fa-solid fa-circle-exclamation" style="margin-top: 2px; font-size: 1rem; color: var(--warning); flex-shrink: 0;"></i>
                            <div>${warningText}</div>
                        </div>
                    `;
                }

                const html = `
                    <div class="modal-header">
                        <h3 class="modal-title">${student.name} 원생 시간표 상세</h3>
                        <button class="modal-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body" style="padding-top: 10px;">
                        ${warningBannerHtml}
                        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.95rem;">
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                                <span style="color: var(--text-muted);">원생 이름</span>
                                <strong>${student.name}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                                <span style="color: var(--text-muted);">나이 / 학교</span>
                                <strong>${[student.age ? `${student.age}세` : '', student.school].filter(Boolean).join(' | ') || '정보 없음'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                                <span style="color: var(--text-muted);">수강 과목</span>
                                <strong style="color: var(--accent);">${student.instrument}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                                <span style="color: var(--text-muted);">담당 강사</span>
                                <strong>${teacher ? teacher.name : '없음'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                                <span style="color: var(--text-muted);">학부모 연락처</span>
                                <strong>${student.parentPhone || '-'}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                                <span style="color: var(--text-muted);">수강료 / 납부 정기일</span>
                                <strong>${student.fee.toLocaleString()}원 (매월 ${student.dueDay}일)</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">
                                <span style="color: var(--text-muted);">주간 수업 시간표</span>
                                <strong>${scheduleText}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 8px;">
                        <button class="btn btn-primary" id="btn-edit-student-from-detail" style="width: 100%; justify-content: center;">정보 수정하기</button>
                        <button class="btn btn-secondary" data-close-modal style="width: 100%; justify-content: center;">닫기</button>
                    </div>
                `;
                
                const onInitDetailModal = (contentArea) => {
                    const editBtn = contentArea.querySelector('#btn-edit-student-from-detail');
                    if (editBtn) {
                        editBtn.addEventListener('click', () => {
                            openStudentModal(studentId);
                        });
                    }
                };
                
                openModal(html, onInitDetailModal);
            }
        });
    });
};

    render();

    // Pub/Sub listeners
    const unsubShifts = stateStore.subscribe('SHIFTS_CHANGED', renderWorkspace);
    const unsubClasses = stateStore.subscribe('CLASSES_CHANGED', () => {
        tempClassOverrides = {}; // Reset overrides on true DB schema change
        renderWorkspace();
    });
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', () => {
        tempClassOverrides = {}; // Reset overrides on student detail edits
        renderWorkspace();
    });

    return () => {
        unsubShifts();
        unsubClasses();
        unsubStudents();
    };
}

/**
 * 6. 원장 출결 종합 관리 (renderDirectorAttendance)
 * Renders date-based and range-based student attendance records.
 * Supports date picker for historical records and date range filtering for individual students.
 */
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

export function renderDirectorAttendance(container) {
    let activeSubTab = 'daily'; // 'daily' or 'student'
    
    // Daily tab state
    let selectedDailyDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    // Student tab state
    let selectedStudentId = '';
    
    // Date range: default from 30 days ago to today
    const todayObj = new Date();
    const thirtyDaysAgoObj = new Date();
    thirtyDaysAgoObj.setDate(todayObj.getDate() - 30);
    
    let filterStartDate = thirtyDaysAgoObj.toISOString().slice(0, 10);
    let filterEndDate = todayObj.toISOString().slice(0, 10);
    
    const render = () => {
        const students = stateStore.getStudents().sort((a, b) => a.name.localeCompare(b.name));
        const teachers = stateStore.getTeachers();
        const classes = stateStore.getClasses();
        const attendance = stateStore.getAttendance();
        
        // If student tab and selectedStudentId is empty, set to first student in the list as default
        if (students.length > 0 && !selectedStudentId) {
            selectedStudentId = students[0].id;
        }
        
        // Daily Attendance Data Processing
        const daysKo = ['일', '월', '화', '수', '목', '금', '토'];
        const targetDateObj = new Date(selectedDailyDate);
        const dayOfWeekKo = daysKo[targetDateObj.getDay()];
        
        // Find classes that are scheduled on the selected day's dayOfWeek
        const dailyClasses = classes
            .filter(c => c.dayOfWeek === dayOfWeekKo)
            .map(c => {
                const s = students.find(stud => stud.id === c.studentId);
                const t = s ? teachers.find(teach => teach.id === s.teacherId) : null;
                const att = s ? attendance.find(a => a.studentId === s.id && a.date === selectedDailyDate) : null;
                return { ...c, student: s, teacher: t, attendance: att };
            })
            .filter(c => c.student)
            .sort((a, b) => a.time.localeCompare(b.time));
            
        // Student Attendance Data Processing
        let studentStats = { total: 0, present: 0, late: 0, absent: 0, pending: 0, rate: 0 };
        let studentAttendanceList = [];
        
        if (selectedStudentId) {
            const currentStudent = students.find(s => s.id === selectedStudentId);
            
            // Loop through all dates from startDate to endDate
            let start = new Date(filterStartDate);
            let end = new Date(filterEndDate);
            let dateCursor = new Date(start);
            
            // Get classes assigned to this student
            const studentClasses = classes.filter(c => c.studentId === selectedStudentId);
            const classDays = studentClasses.map(c => c.dayOfWeek); // e.g. ['월', '수']
            
            while (dateCursor <= end) {
                const dateStr = dateCursor.toISOString().slice(0, 10);
                const cursorDayKo = daysKo[dateCursor.getDay()];
                
                // If the student has a class on this day of the week
                if (classDays.includes(cursorDayKo)) {
                    // Find if there is an attendance record
                    const attRecord = attendance.find(a => a.studentId === selectedStudentId && a.date === dateStr);
                    const classInfo = studentClasses.find(c => c.dayOfWeek === cursorDayKo);
                    const teacher = currentStudent ? teachers.find(t => t.id === currentStudent.teacherId) : null;
                    
                    let status = 'pending';
                    let time = '';
                    let note = '';
                    
                    if (attRecord) {
                        status = attRecord.status; // 'present', 'late', 'absent'
                        time = attRecord.time || '';
                        note = attRecord.note || '';
                    }
                    
                    studentAttendanceList.push({
                        date: dateStr,
                        dayOfWeek: cursorDayKo,
                        time: classInfo ? classInfo.time : '',
                        teacherName: teacher ? teacher.name : '미지정',
                        status: status,
                        checkTime: time,
                        note: note
                    });
                    
                    studentStats.total++;
                    if (status === 'present') studentStats.present++;
                    else if (status === 'late') studentStats.late++;
                    else if (status === 'absent') studentStats.absent++;
                    else if (status === 'pending') studentStats.pending++;
                }
                
                dateCursor.setDate(dateCursor.getDate() + 1);
            }
            
            // Sort attendance list descending (newest first)
            studentAttendanceList.sort((a, b) => b.date.localeCompare(a.date));
            
            // Compute attendance rate (present + late) / total
            const attendedCount = studentStats.present + studentStats.late;
            studentStats.rate = studentStats.total > 0 ? Math.round((attendedCount / studentStats.total) * 100) : 0;
        }

        // Layout template
        container.innerHTML = `
            <div class="glass-card" style="padding: 1.5rem; margin-bottom: 24px;">
                <!-- Sub Tab Navigation -->
                <div style="display: flex; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 20px;">
                    <button class="btn ${activeSubTab === 'daily' ? 'btn-primary' : 'btn-none'}" id="tab-btn-daily" style="font-weight: 600;">
                        <i class="fa-solid fa-calendar-day" style="margin-right: 6px;"></i>일자별 출결 조회
                    </button>
                    <button class="btn ${activeSubTab === 'student' ? 'btn-primary' : 'btn-none'}" id="tab-btn-student" style="font-weight: 600;">
                        <i class="fa-solid fa-user-graduate" style="margin-right: 6px;"></i>원생별 출결 조회
                    </button>
                </div>
                
                <!-- Tab Content 1: Daily Attendance -->
                <div id="subtab-content-daily" style="display: ${activeSubTab === 'daily' ? 'block' : 'none'};">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <label for="daily-date-picker" style="font-weight: 600; font-size: 0.95rem; color: var(--text-muted);">조회 일자 선택:</label>
                            <input type="date" id="daily-date-picker" value="${selectedDailyDate}" class="form-control" style="width: 180px; padding: 8px 12px;">
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-muted); font-weight: 500;">
                            선택일 요일: <span style="color: var(--primary); font-weight: 700;">${dayOfWeekKo}요일</span> | 총 수업 예정: <span style="color: var(--accent); font-weight: 700;">${dailyClasses.length}건</span>
                        </div>
                    </div>
                    
                    <div class="table-wrapper">
                        ${
                            dailyClasses.length === 0
                                ? `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">선택하신 날짜(${selectedDailyDate}, ${dayOfWeekKo}요일)에는 예정된 수업이 없습니다.</div>`
                                : `
                                <table class="custom-table">
                                    <thead>
                                        <tr>
                                            <th>수업 시간</th>
                                            <th>원생 (악기)</th>
                                            <th>담당 강사</th>
                                            <th>출결 상태</th>
                                            <th>등원 시각</th>
                                            <th>특이사항 / 사유</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${dailyClasses.map(c => {
                                            let statusBadge = `<span class="badge badge-info">수업 대기</span>`;
                                            let timeText = '-';
                                            let noteText = c.attendance && c.attendance.note ? c.attendance.note : '-';
                                            
                                            if (c.attendance) {
                                                if (c.attendance.status === 'present') {
                                                    statusBadge = `<span class="badge badge-success">등원</span>`;
                                                    timeText = c.attendance.time || '-';
                                                } else if (c.attendance.status === 'late') {
                                                    statusBadge = `<span class="badge badge-warning">지각</span>`;
                                                    timeText = c.attendance.time || '-';
                                                } else if (c.attendance.status === 'absent') {
                                                    statusBadge = `<span class="badge badge-danger">결석</span>`;
                                                    timeText = '-';
                                                }
                                            }
                                            return `
                                                <tr>
                                                    <td style="font-weight: 600; color: var(--accent);">${c.time}</td>
                                                    <td style="font-weight: 600;">${c.student.name} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${c.student.instrument})</span></td>
                                                    <td>${c.teacher ? c.teacher.name : '미지정'}</td>
                                                    <td>${statusBadge}</td>
                                                    <td style="font-weight: 500;">${timeText}</td>
                                                    <td style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${noteText}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                                `
                        }
                    </div>
                </div>
                
                <!-- Tab Content 2: Student-based Period Attendance -->
                <div id="subtab-content-student" style="display: ${activeSubTab === 'student' ? 'block' : 'none'};">
                    <!-- Filters Grid -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 1.5rem; align-items: flex-end;">
                        <div>
                            <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">원생 선택</label>
                            <div class="custom-dropdown" id="student-selector-dropdown" style="position: relative; width: 100%;">
                                <div class="custom-dropdown-trigger form-control" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; height: 38px; background: rgba(0,0,0,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
                                    <span id="selected-student-display">${(() => {
                                        const selected = students.find(s => s.id === selectedStudentId);
                                        return selected ? `${selected.name} (${selected.instrument})` : '원생을 선택하세요';
                                    })()}</span>
                                    <i class="fa-solid fa-chevron-down" style="font-size: 0.8rem; color: var(--text-muted);"></i>
                                </div>
                                <div class="custom-dropdown-menu glass-card" style="display: none; position: absolute; top: 105%; left: 0; width: 100%; z-index: 1000; padding: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); max-height: 250px; overflow-y: auto; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); flex-direction: column; gap: 4px;">
                                    <div style="position: relative; width: 100%; margin-bottom: 8px;">
                                        <input type="text" id="student-search-input" placeholder="원생명 검색 (초성 지원)" class="form-control" style="padding: 6px 10px; padding-left: 30px; font-size: 0.85rem; height: 34px; margin-bottom: 0;">
                                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.75rem;"></i>
                                    </div>
                                    <div id="student-options-list" style="display: flex; flex-direction: column; gap: 2px;">
                                        <!-- Loaded dynamically -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label for="start-date-picker" style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">조회 시작일</label>
                            <input type="date" id="start-date-picker" value="${filterStartDate}" class="form-control" style="width: 100%; padding: 8px 12px;">
                        </div>
                        <div>
                            <label for="end-date-picker" style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">조회 종료일</label>
                            <input type="date" id="end-date-picker" value="${filterEndDate}" class="form-control" style="width: 100%; padding: 8px 12px;">
                        </div>
                    </div>
                    
                    ${
                        !selectedStudentId 
                            ? `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">원생을 선택해주세요.</div>`
                            : `
                            <!-- Stats Cards -->
                            <div class="metrics-grid" style="margin-bottom: 20px;">
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon purple" style="width: 36px; height: 36px; font-size: 0.95rem;">
                                        <i class="fa-solid fa-list-ol"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">총 수업 일수</span>
                                        <span class="metric-value" style="font-size: 1.1rem;">${studentStats.total}회</span>
                                    </div>
                                </div>
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon green" style="width: 36px; height: 36px; font-size: 0.95rem;">
                                        <i class="fa-solid fa-circle-check"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">출석률 (등원+지각)</span>
                                        <span class="metric-value" style="font-size: 1.1rem; color: var(--success);">${studentStats.rate}%</span>
                                    </div>
                                </div>
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon yellow" style="width: 36px; height: 36px; font-size: 0.95rem; background: rgba(241, 196, 15, 0.15); color: var(--warning);">
                                        <i class="fa-solid fa-clock"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">지각 횟수</span>
                                        <span class="metric-value" style="font-size: 1.1rem; color: var(--warning);">${studentStats.late}회</span>
                                    </div>
                                </div>
                                <div class="glass-card metric-card" style="padding: 12px 16px;">
                                    <div class="metric-icon red" style="width: 36px; height: 36px; font-size: 0.95rem;">
                                        <i class="fa-solid fa-circle-xmark"></i>
                                    </div>
                                    <div class="metric-info">
                                        <span class="metric-label" style="font-size: 0.75rem;">결석 / 수업대기</span>
                                        <span class="metric-value" style="font-size: 1.1rem; color: var(--danger);">${studentStats.absent} / ${studentStats.pending}회</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Detailed History Table -->
                            <div class="table-wrapper">
                                ${
                                    studentAttendanceList.length === 0
                                        ? `<div style="text-align: center; color: var(--text-muted); padding: 3rem;">지정된 기간 동안의 예정된 수업이 없습니다.</div>`
                                        : `
                                        <table class="custom-table">
                                            <thead>
                                                <tr>
                                                    <th>일자 (요일)</th>
                                                    <th>수업 시간</th>
                                                    <th>담당 강사</th>
                                                    <th>출결 상태</th>
                                                    <th>등원 시각</th>
                                                    <th>상세 사유 / 비고</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${studentAttendanceList.map(item => {
                                                    let badge = `<span class="badge badge-info">수업 대기</span>`;
                                                    let timeText = '-';
                                                    if (item.status === 'present') {
                                                        badge = `<span class="badge badge-success">등원</span>`;
                                                        timeText = item.checkTime;
                                                    } else if (item.status === 'late') {
                                                        badge = `<span class="badge badge-warning">지각</span>`;
                                                        timeText = item.checkTime;
                                                    } else if (item.status === 'absent') {
                                                        badge = `<span class="badge badge-danger">결석</span>`;
                                                    }
                                                    
                                                    return `
                                                        <tr>
                                                            <td style="font-weight: 600;">${item.date} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${item.dayOfWeek})</span></td>
                                                            <td style="font-weight: 600; color: var(--accent);">${item.time}</td>
                                                            <td>${item.teacherName}</td>
                                                            <td>${badge}</td>
                                                            <td style="font-weight: 500;">${timeText}</td>
                                                            <td style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">${item.note || '-'}</td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                        `
                                }
                            </div>
                            `
                    }
                </div>
            </div>
        `;
        
        // Add event listeners
        const btnDaily = container.querySelector('#tab-btn-daily');
        const btnStudent = container.querySelector('#tab-btn-student');
        
        if (btnDaily) {
            btnDaily.addEventListener('click', () => {
                activeSubTab = 'daily';
                render();
            });
        }
        
        if (btnStudent) {
            btnStudent.addEventListener('click', () => {
                activeSubTab = 'student';
                render();
            });
        }
        
        const dailyDatePicker = container.querySelector('#daily-date-picker');
        if (dailyDatePicker) {
            dailyDatePicker.addEventListener('change', (e) => {
                selectedDailyDate = e.target.value;
                render();
            });
        }
        
        const trigger = container.querySelector('.custom-dropdown-trigger');
        const menu = container.querySelector('.custom-dropdown-menu');
        const searchInput = container.querySelector('#student-search-input');
        const optionsList = container.querySelector('#student-options-list');

        const filterOptions = (query) => {
            const cleanQuery = query.replace(/\s+/g, '').toLowerCase();
            const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(cleanQuery);
            const filtered = students.filter(s => {
                const cleanName = s.name.replace(/\s+/g, '').toLowerCase();
                if (isChosungOnly) {
                    return getChosungStr(cleanName).includes(cleanQuery);
                }
                return cleanName.includes(cleanQuery);
            });

            if (filtered.length === 0) {
                optionsList.innerHTML = `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 0.85rem; font-style: italic;">일치하는 원생이 없습니다.</div>`;
            } else {
                optionsList.innerHTML = filtered.map(s => `
                    <div class="student-option-item ${s.id === selectedStudentId ? 'active' : ''}" data-id="${s.id}" style="padding: 8px 10px; cursor: pointer; border-radius: var(--radius-sm); font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center; color: var(--text-main); transition: background 0.2s;">
                        <span>${s.name} (${s.instrument})</span>
                        ${s.id === selectedStudentId ? '<i class="fa-solid fa-check" style="color: var(--primary); font-size: 0.8rem;"></i>' : ''}
                    </div>
                `).join('');

                optionsList.querySelectorAll('.student-option-item').forEach(item => {
                    item.addEventListener('click', () => {
                        selectedStudentId = item.dataset.id;
                        menu.style.display = 'none';
                        render();
                    });
                });
            }
        };

        if (trigger && menu) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = menu.style.display === 'flex';
                menu.style.display = isVisible ? 'none' : 'flex';
                if (!isVisible) {
                    if (searchInput) {
                        searchInput.value = '';
                        filterOptions('');
                    }
                    setTimeout(() => { if (searchInput) searchInput.focus(); }, 50);
                }
            });

            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && !trigger.contains(e.target)) {
                    menu.style.display = 'none';
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterOptions(e.target.value.trim());
            });
            searchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        const startDatePicker = container.querySelector('#start-date-picker');
        if (startDatePicker) {
            startDatePicker.addEventListener('change', (e) => {
                filterStartDate = e.target.value;
                render();
            });
        }
        
        const endDatePicker = container.querySelector('#end-date-picker');
        if (endDatePicker) {
            endDatePicker.addEventListener('change', (e) => {
                filterEndDate = e.target.value;
                render();
            });
        }
    };
    
    render();
    
    // Subscribe to state stores
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', render);
    const unsubClasses = stateStore.subscribe('CLASSES_CHANGED', render);
    const unsubAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', render);
    
    return () => {
        unsubStudents();
        unsubTeachers();
        unsubClasses();
        unsubAttendance();
    };
}

/**
 * 7. 태블릿 출결 키오스크 (renderKioskAttendance)
 * Renders a full-screen kiosk interface for student check-in/out.
 * Students enter their phone digits to search, select their names,
 * and choose between check-in (등원) or check-out (하원).
 */
export function renderKioskAttendance(container) {
    let activeStep = 'keypad'; // 'keypad', 'select-student', 'select-status', 'complete', 'admin-auth'
    let inputDigits = '';
    let adminAuthDigits = ''; // For admin pass authorization
    let matchedStudents = [];
    let selectedStudent = null;
    let completeStatus = ''; // 'in' or 'out'
    let autoResetTimeout = null;

    const ADMIN_PASSWORD = '6990';

    // Reset Kiosk state to keypad
    const resetKiosk = () => {
        if (autoResetTimeout) {
            clearTimeout(autoResetTimeout);
            autoResetTimeout = null;
        }
        activeStep = 'keypad';
        inputDigits = '';
        adminAuthDigits = '';
        matchedStudents = [];
        selectedStudent = null;
        completeStatus = '';
        render();
    };

    // Global Keydown Handler for physical keyboards
    const handlePhysicalKeydown = (e) => {
        if (activeStep !== 'keypad' && activeStep !== 'admin-auth') return;

        if (e.key >= '0' && e.key <= '9') {
            handleKeyPress(e.key);
        } else if (e.key === 'Backspace') {
            handleKeyPress('back');
        } else if (e.key === 'Escape') {
            handleKeyPress('clear');
        }
    };

    const handleKeyPress = (key) => {
        if (activeStep === 'admin-auth') {
            handleAdminAuthKeyPress(key);
            return;
        }

        if (key === 'clear') {
            inputDigits = '';
        } else if (key === 'back') {
            inputDigits = inputDigits.slice(0, -1);
        } else if (inputDigits.length < 4) {
            inputDigits += key;
            
            // Check matching when exactly 4 digits entered
            if (inputDigits.length === 4) {
                const students = stateStore.getStudents();
                const matched = students.filter(s => {
                    const parentLast4 = s.parentPhone ? s.parentPhone.replace(/[^0-9]/g, '').slice(-4) : '';
                    const studentLast4 = s.phone ? s.phone.replace(/[^0-9]/g, '').slice(-4) : '';
                    return parentLast4 === inputDigits || studentLast4 === inputDigits;
                });

                if (matched.length > 0) {
                    matchedStudents = matched;
                    // Auto transition to student selection
                    setTimeout(() => {
                        activeStep = 'select-student';
                        render();
                    }, 200);
                } else {
                    // No match found
                    const displayMsg = container.querySelector('#kiosk-message-banner');
                    if (displayMsg) {
                        displayMsg.textContent = '일치하는 원생이 없습니다. 번호를 다시 확인해주세요.';
                        displayMsg.style.color = 'var(--danger)';
                    }
                    // Shake effect on keypad dots
                    const dots = container.querySelectorAll('.kiosk-pin-dot');
                    dots.forEach(d => {
                        d.style.borderColor = 'var(--danger)';
                        d.style.boxShadow = '0 0 12px rgba(214, 48, 49, 0.4)';
                    });
                    setTimeout(() => {
                        inputDigits = '';
                        render();
                    }, 1200);
                }
            }
        }
        render();
    };

    const handleAdminAuthKeyPress = (key) => {
        if (key === 'clear') {
            adminAuthDigits = '';
        } else if (key === 'back') {
            adminAuthDigits = adminAuthDigits.slice(0, -1);
        } else if (adminAuthDigits.length < 4) {
            adminAuthDigits += key;

            if (adminAuthDigits.length === 4) {
                if (adminAuthDigits === ADMIN_PASSWORD) {
                    // Password correct, exit kiosk mode
                    setTimeout(() => {
                        const event = new CustomEvent('kiosk-exit-request');
                        window.dispatchEvent(event);
                    }, 200);
                } else {
                    // Incorrect password
                    const displayMsg = container.querySelector('#kiosk-admin-message-banner');
                    if (displayMsg) {
                        displayMsg.textContent = '비밀번호가 일치하지 않습니다. 다시 입력해주세요.';
                        displayMsg.style.color = 'var(--danger)';
                    }
                    const dots = container.querySelectorAll('.kiosk-pin-dot');
                    dots.forEach(d => {
                        d.style.borderColor = 'var(--danger)';
                        d.style.boxShadow = '0 0 12px rgba(214, 48, 49, 0.4)';
                    });
                    setTimeout(() => {
                        adminAuthDigits = '';
                        render();
                    }, 1200);
                }
            }
        }
        render();
    };

    const triggerCheckIn = (studentId) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const nowTimeStr = new Date().toTimeString().slice(0, 5); // HH:MM
        
        stateStore.markAttendance(studentId, todayStr, 'present', nowTimeStr, '태블릿 등원 자동 입력');
        
        completeStatus = 'in';
        activeStep = 'complete';
        render();

        // 5 second auto reset
        autoResetTimeout = setTimeout(() => {
            resetKiosk();
        }, 5000);
    };

    const triggerCheckOut = (studentId) => {
        const todayStr = new Date().toISOString().slice(0, 10);
        const nowTimeStr = new Date().toTimeString().slice(0, 5); // HH:MM
        
        stateStore.leaveAttendance(studentId, todayStr, nowTimeStr);
        
        completeStatus = 'out';
        activeStep = 'complete';
        render();

        // 5 second auto reset
        autoResetTimeout = setTimeout(() => {
            resetKiosk();
        }, 5000);
    };

    const render = () => {
        const settings = stateStore.getSettings();
        // 1. Render outer shell first if not already present to avoid shaking/animation replay on input
        if (!container.querySelector('.kiosk-layout-container')) {
            container.innerHTML = `
                <button class="btn-kiosk-return" id="kiosk-return-to-admin">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> 관리자 모드로 돌아가기
                </button>
                <div class="kiosk-layout-container" id="kiosk-step-wrapper"></div>
            `;
            
            const returnBtn = container.querySelector('#kiosk-return-to-admin');
            if (returnBtn) {
                returnBtn.addEventListener('click', () => {
                    activeStep = 'admin-auth';
                    adminAuthDigits = '';
                    render();
                });
            }
        }

        const stepWrapper = container.querySelector('#kiosk-step-wrapper');
        let kioskHtml = '';

        if (activeStep === 'keypad') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <i class="fa-solid fa-music" style="font-size: 3rem; color: var(--primary); margin-bottom: 1rem; text-shadow: var(--shadow-glow);"></i>
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">${settings.academyName || '튜링 음악학원'} 출결 키오스크</h2>
                    <p id="kiosk-message-banner" style="color: var(--text-muted); font-size: 0.95rem;">휴대폰 번호 뒷자리 4자리를 터치해 주세요.</p>
                </div>

                <!-- Pin display dots -->
                <div class="kiosk-pin-display">
                    ${[0, 1, 2, 3].map(i => {
                        const val = inputDigits[i] || '';
                        return `<div class="kiosk-pin-dot ${val ? 'active' : ''}">${val ? val : ''}</div>`;
                    }).join('')}
                </div>

                <!-- Kiosk Grid Keypad -->
                <div class="kiosk-keypad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                        <button class="kiosk-key" data-key="${num}">${num}</button>
                    `).join('')}
                    <button class="kiosk-key key-clear" data-key="clear">전체지움</button>
                    <button class="kiosk-key" data-key="0">0</button>
                    <button class="kiosk-key key-back" data-key="back">
                        <i class="fa-solid fa-delete-left"></i>
                    </button>
                </div>
            `;
        } else if (activeStep === 'admin-auth') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <i class="fa-solid fa-lock" style="font-size: 3rem; color: var(--danger); margin-bottom: 1rem; text-shadow: var(--shadow-glow);"></i>
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">관리자 본인 인증</h2>
                    <p id="kiosk-admin-message-banner" style="color: var(--text-muted); font-size: 0.95rem;">비밀번호 4자리를 입력해주세요.</p>
                </div>

                <!-- Pin display dots for password -->
                <div class="kiosk-pin-display">
                    ${[0, 1, 2, 3].map(i => {
                        const val = adminAuthDigits[i] || '';
                        return `<div class="kiosk-pin-dot ${val ? 'active' : ''}">${val ? '*' : ''}</div>`;
                    }).join('')}
                </div>

                <!-- Kiosk Grid Keypad for password -->
                <div class="kiosk-keypad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                        <button class="kiosk-key" data-key="${num}">${num}</button>
                    `).join('')}
                    <button class="kiosk-key key-clear" data-key="clear">전체지움</button>
                    <button class="kiosk-key" data-key="0">0</button>
                    <button class="kiosk-key key-back" data-key="back">
                        <i class="fa-solid fa-delete-left"></i>
                    </button>
                </div>

                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-none" id="kiosk-admin-cancel" style="padding: 10px 24px; font-weight: 600; color: var(--text-muted);">
                        <i class="fa-solid fa-xmark" style="margin-right: 8px;"></i> 출결 화면으로 돌아가기
                    </button>
                </div>
            `;
        } else if (activeStep === 'select-student') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 2rem;">
                    <i class="fa-solid fa-circle-question" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 1rem;"></i>
                    <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 8px;">원생 이름 선택</h2>
                    <p style="color: var(--text-muted); font-size: 0.95rem;">본인의 이름을 터치해 주세요.</p>
                </div>

                <!-- Student selection grid -->
                <div class="kiosk-student-grid">
                    ${matchedStudents.map(student => `
                        <div class="kiosk-student-card" data-student-id="${student.id}">
                            <div class="kiosk-student-name">${student.name}</div>
                            <div class="kiosk-student-desc">${student.instrument} / ${student.school || '학원생'}</div>
                        </div>
                    `).join('')}
                </div>

                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-none" id="kiosk-back-to-keypad" style="padding: 10px 24px; font-weight: 600; color: var(--text-muted);">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 8px;"></i> 처음으로 돌아가기
                    </button>
                </div>
            `;
        } else if (activeStep === 'select-status') {
            kioskHtml = `
                <div style="text-align: center; margin-bottom: 1.5rem;">
                    <div class="profile-avatar" style="width: 70px; height: 70px; font-size: 1.8rem; margin: 0 auto 1rem auto; background: linear-gradient(135deg, var(--primary), var(--accent));">
                        ${selectedStudent.name[0]}
                    </div>
                    <h2 style="font-size: 1.7rem; font-weight: 800; margin-bottom: 8px;">${selectedStudent.name} 원생님</h2>
                    <p style="color: var(--text-muted); font-size: 0.95rem;">원하시는 출결 상태를 터치해 주세요.</p>
                </div>

                <!-- Status Select Buttons -->
                <div class="kiosk-status-container">
                    <div class="kiosk-status-card status-in" id="kiosk-action-checkin">
                        <i class="fa-solid fa-door-open"></i>
                        <span class="kiosk-status-title">등원 (출석)</span>
                        <span class="kiosk-status-desc">학원에 도착했습니다.</span>
                    </div>
                    <div class="kiosk-status-card status-out" id="kiosk-action-checkout">
                        <i class="fa-solid fa-door-closed"></i>
                        <span class="kiosk-status-title">하원</span>
                        <span class="kiosk-status-desc">수업 후 귀가합니다.</span>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 1.5rem;">
                    <button class="btn btn-none" id="kiosk-back-to-student" style="padding: 10px 24px; font-weight: 600; color: var(--text-muted);">
                        <i class="fa-solid fa-arrow-left" style="margin-right: 8px;"></i> 이전 단계로
                    </button>
                </div>
            `;
        } else if (activeStep === 'complete') {
            const isCheckIn = completeStatus === 'in';
            const actionLabel = isCheckIn ? '등원' : '하원';
            const actionDesc = isCheckIn ? '학원에 안전하게 등원하였습니다.' : '수업을 마치고 안전하게 하원하였습니다.';
            const iconClass = isCheckIn ? 'fa-circle-check' : 'fa-circle-chevron-right';
            const iconColor = isCheckIn ? 'var(--success)' : 'var(--warning)';

            kioskHtml = `
                <div style="text-align: center; max-width: 480px; margin: 0 auto;">
                    <i class="fa-solid ${iconClass}" style="font-size: 4.5rem; color: ${iconColor}; margin-bottom: 1.5rem; filter: drop-shadow(0 0 15px rgba(255,255,255,0.05));"></i>
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 10px; color: var(--text-main);">${selectedStudent.name} 님</h2>
                    <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">${actionLabel}이 완료되었습니다!</p>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 2rem;">${actionDesc}</p>

                    <button class="btn btn-primary" id="kiosk-complete-reset" style="padding: 12px 30px; font-weight: 600; border-radius: var(--radius-md);">
                        즉시 처음 화면으로
                    </button>

                    <!-- Auto redirect timer progress -->
                    <div class="kiosk-timer-wrapper">
                        <div class="kiosk-timer-bar"></div>
                    </div>
                </div>
            `;
        }

        stepWrapper.innerHTML = kioskHtml;

        // Register interactive events inside wrapper
        if (activeStep === 'keypad' || activeStep === 'admin-auth') {
            stepWrapper.querySelectorAll('.kiosk-key').forEach(button => {
                button.addEventListener('click', (e) => {
                    const key = e.currentTarget.dataset.key;
                    handleKeyPress(key);
                });
            });

            const cancelBtn = stepWrapper.querySelector('#kiosk-admin-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    resetKiosk();
                });
            }
        } else if (activeStep === 'select-student') {
            stepWrapper.querySelectorAll('.kiosk-student-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.studentId;
                    selectedStudent = matchedStudents.find(s => s.id === id);
                    activeStep = 'select-status';
                    render();
                });
            });

            const backBtn = stepWrapper.querySelector('#kiosk-back-to-keypad');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    resetKiosk();
                });
            }
        } else if (activeStep === 'select-status') {
            const btnIn = stepWrapper.querySelector('#kiosk-action-checkin');
            if (btnIn) {
                btnIn.addEventListener('click', () => {
                    triggerCheckIn(selectedStudent.id);
                });
            }

            const btnOut = stepWrapper.querySelector('#kiosk-action-checkout');
            if (btnOut) {
                btnOut.addEventListener('click', () => {
                    triggerCheckOut(selectedStudent.id);
                });
            }

            const backBtn = stepWrapper.querySelector('#kiosk-back-to-student');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    activeStep = 'select-student';
                    render();
                });
            }
        } else if (activeStep === 'complete') {
            const resetBtn = stepWrapper.querySelector('#kiosk-complete-reset');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    resetKiosk();
                });
            }
        }
    };

    // Initialize kiosk
    render();
    window.addEventListener('keydown', handlePhysicalKeydown);

    // Register exit event listener to bridge with app.js router
    const handleExitRequest = () => {
        // Find sidebar menu item for dashboard and trigger click programmatically
        const menuDashboard = document.querySelector('.menu-item[data-view="dir-dashboard"]');
        if (menuDashboard) {
            menuDashboard.click();
        }
    };
    window.addEventListener('kiosk-exit-request', handleExitRequest);

    // Return cleanup to detach keydown and timeout listeners
    return () => {
        window.removeEventListener('keydown', handlePhysicalKeydown);
        window.removeEventListener('kiosk-exit-request', handleExitRequest);
        if (autoResetTimeout) {
            clearTimeout(autoResetTimeout);
        }
    };
}

/**
 * 8. 학원 교재 마스터 관리 (renderBooks)
 * Renders master list of textbooks and curriculum sheets.
 * Includes category grouping, status switch toggle, and textbook editing form.
 */
export function renderBooks(container) {
    let filterQuery = '';
    let filterCategory = '';
    let editingBookId = null;

    const render = () => {
        const books = stateStore.getBooks();
        const categories = [...new Set(books.map(b => b.category))].filter(Boolean);

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;" class="books-layout-grid">
                <!-- Column 1: Books Table -->
                <div class="glass-card" style="display: flex; flex-direction: column;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-book" style="color: var(--primary);"></i>
                        학원 교재 마스터 현황
                    </h3>
                    
                    <!-- Search & Filter row -->
                    <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                        <div style="position: relative; flex-grow: 1; min-width: 180px;">
                            <input type="text" id="book-search-input" class="form-control" placeholder="교재 이름 검색..." style="width: 100%; padding-left: 40px; margin-bottom: 0;" value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        </div>
                        <select id="book-category-filter" class="form-control" style="width: 150px; margin-bottom: 0;">
                            <option value="">카테고리 전체</option>
                            ${categories.map(cat => `<option value="${cat}" ${filterCategory === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                        </select>
                    </div>

                    <div class="table-wrapper" style="margin-top: 0; flex-grow: 1;">
                        <table class="custom-table" id="books-table">
                            <thead>
                                <tr>
                                    <th>교재명</th>
                                    <th>가격 (교육비)</th>
                                    <th>과목 / 카테고리</th>
                                    <th>권장 일수</th>
                                    <th>사용 상태</th>
                                    <th style="text-align: right;">관리</th>
                                </tr>
                            </thead>
                            <tbody id="books-table-body">
                                <!-- Loaded dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Column 2: Add/Edit Form -->
                <div class="glass-card" id="book-form-card" style="height: fit-content; align-self: start;">
                    <h3 id="book-form-heading" style="font-size: 1.15rem; font-weight: 700; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                        신규 교재 등록
                    </h3>
                    <form id="book-form">
                        <div class="form-group">
                            <label for="book-name-input">교재명 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="book-name-input" class="form-control" placeholder="예: 도시락 바이엘 1" required>
                        </div>
                        <div class="form-group">
                            <label for="book-price-input">가격 (원) <span style="color: var(--danger);">*</span></label>
                            <input type="number" id="book-price-input" class="form-control" placeholder="예: 6000" min="0" step="500" required>
                        </div>
                        <div class="form-group">
                            <label for="book-category-input">카테고리 / 과목 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="book-category-input" class="form-control" list="book-category-presets" placeholder="예: 바이엘/체르니, 이론, 게이름" required>
                            <datalist id="book-category-presets">
                                <option value="바이엘/체르니"></option>
                                <option value="이론"></option>
                                <option value="게이름"></option>
                                <option value="피아노소곡"></option>
                            </datalist>
                        </div>
                        <div class="form-group">
                            <label for="book-recommended-days-select">권장 학습 일수 <span style="color: var(--danger);">*</span></label>
                            <select id="book-recommended-days-select" class="form-control" required style="width: 100%;">
                                <option value="30">30일</option>
                                <option value="60">60일</option>
                                <option value="90" selected>90일</option>
                                <option value="180">180일</option>
                                <option value="360">360일</option>
                                <option value="custom">기타(직접입력)</option>
                            </select>
                        </div>
                        <div class="form-group" id="book-recommended-days-custom-group" style="display: none;">
                            <label for="book-recommended-days-custom">권장 일수 직접 입력 (일) <span style="color: var(--danger);">*</span></label>
                            <input type="number" id="book-recommended-days-custom" class="form-control" placeholder="예: 45" min="1">
                        </div>

                        <div style="display: flex; gap: 12px; margin-top: 1.8rem;" id="book-form-buttons-container">
                            <button type="submit" class="btn btn-primary" style="flex-grow: 1; justify-content: center; height: 42px;">
                                <i class="fa-solid fa-check"></i> <span id="book-submit-btn-label">등록 완료</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            <style>
                @media (max-width: 1024px) {
                    .books-layout-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>
        `;

        // Event listeners
        const searchInput = container.querySelector('#book-search-input');
        const catFilter = container.querySelector('#book-category-filter');
        const form = container.querySelector('#book-form');
        const selectEl = container.querySelector('#book-recommended-days-select');
        const customGroupEl = container.querySelector('#book-recommended-days-custom-group');
        const customInputEl = container.querySelector('#book-recommended-days-custom');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterQuery = e.target.value;
                renderTableBody();
            });
        }

        if (catFilter) {
            catFilter.addEventListener('change', (e) => {
                filterCategory = e.target.value;
                renderTableBody();
            });
        }

        if (selectEl) {
            selectEl.addEventListener('change', () => {
                if (selectEl.value === 'custom') {
                    customGroupEl.style.display = 'block';
                    customInputEl.required = true;
                } else {
                    customGroupEl.style.display = 'none';
                    customInputEl.required = false;
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = container.querySelector('#book-name-input').value.trim();
                const price = parseInt(container.querySelector('#book-price-input').value) || 0;
                const category = container.querySelector('#book-category-input').value.trim();

                const recDaysSelect = container.querySelector('#book-recommended-days-select').value;
                let recommendedDays = 90;
                if (recDaysSelect === 'custom') {
                    recommendedDays = parseInt(container.querySelector('#book-recommended-days-custom').value) || 90;
                } else {
                    recommendedDays = parseInt(recDaysSelect) || 90;
                }

                if (editingBookId) {
                    stateStore.updateBook(editingBookId, { name, price, category, recommendedDays });
                    resetForm();
                } else {
                    stateStore.addBook({ name, price, category, recommendedDays });
                    form.reset();
                    // Reset custom fields
                    customGroupEl.style.display = 'none';
                    customInputEl.required = false;
                    customInputEl.value = '';
                    selectEl.value = '90';
                }
            });
        }

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#books-table-body');
        if (!tbody) return;

        const books = stateStore.getBooks();

        const filtered = books.filter(b => {
            const queryMatch = !filterQuery || b.name.toLowerCase().includes(filterQuery.toLowerCase());
            const catMatch = !filterCategory || b.category === filterCategory;
            return queryMatch && catMatch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        등록된 교재가 없거나 검색 결과가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(b => {
            const isChecked = b.status === 'active' ? 'checked' : '';
            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-main);">${b.name}</td>
                    <td style="font-weight: 600;">${b.price.toLocaleString()}원</td>
                    <td><span class="badge badge-info" style="font-size: 0.8rem;">${b.category}</span></td>
                    <td style="font-weight: 600; color: var(--accent);">${b.recommendedDays || 90}일</td>
                    <td>
                        <label class="switch-toggle" style="display: inline-flex; align-items: center; cursor: pointer; gap: 8px;">
                            <input type="checkbox" class="book-status-checkbox" data-id="${b.id}" ${isChecked} style="accent-color: var(--primary);">
                            <span style="font-size: 0.8rem; color: ${b.status === 'active' ? 'var(--success)' : 'var(--text-muted)'}; font-weight: bold;">
                                ${b.status === 'active' ? '사용중' : '미사용'}
                            </span>
                        </label>
                    </td>
                    <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 8px;">
                            <button class="btn btn-secondary btn-icon-only edit-book-btn" data-id="${b.id}" title="수정">
                                <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only delete-book-btn" data-id="${b.id}" title="삭제">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Action bindings
        tbody.querySelectorAll('.edit-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                startEditMode(id);
            });
        });

        tbody.querySelectorAll('.delete-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const book = stateStore.getBook(id);
                if (confirm(`정말로 '${book.name}' 교재를 삭제하시겠습니까?\n이 교재가 지정된 원생들의 교재 수강 이력에서도 함께 제거됩니다.`)) {
                    stateStore.deleteBook(id);
                    if (editingBookId === id) {
                        resetForm();
                    }
                }
            });
        });

        tbody.querySelectorAll('.book-status-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const active = e.target.checked;
                stateStore.updateBook(id, { status: active ? 'active' : 'inactive' });
            });
        });
    };

    const startEditMode = (bookId) => {
        editingBookId = bookId;
        const book = stateStore.getBook(bookId);
        if (!book) return;

        container.querySelector('#book-name-input').value = book.name;
        container.querySelector('#book-price-input').value = book.price;
        container.querySelector('#book-category-input').value = book.category;

        const recommendedDays = book.recommendedDays || 90;
        const selectEl = container.querySelector('#book-recommended-days-select');
        const customGroupEl = container.querySelector('#book-recommended-days-custom-group');
        const customInputEl = container.querySelector('#book-recommended-days-custom');

        if (['30', '60', '90', '180', '360'].includes(String(recommendedDays))) {
            selectEl.value = String(recommendedDays);
            customGroupEl.style.display = 'none';
            customInputEl.required = false;
        } else {
            selectEl.value = 'custom';
            customGroupEl.style.display = 'block';
            customInputEl.value = recommendedDays;
            customInputEl.required = true;
        }

        container.querySelector('#book-form-heading').innerHTML = `
            <i class="fa-solid fa-pen" style="color: var(--primary);"></i>
            교재 정보 수정
        `;
        container.querySelector('#book-submit-btn-label').textContent = '수정 완료';

        const buttonsContainer = container.querySelector('#book-form-buttons-container');
        if (!container.querySelector('#cancel-book-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.id = 'cancel-book-edit-btn';
            cancelBtn.style.flexGrow = '1';
            cancelBtn.style.justifyContent = 'center';
            cancelBtn.textContent = '취소';
            cancelBtn.addEventListener('click', resetForm);
            buttonsContainer.appendChild(cancelBtn);
        }
    };

    const resetForm = () => {
        editingBookId = null;
        const form = container.querySelector('#book-form');
        if (form) form.reset();

        const customGroupEl = container.querySelector('#book-recommended-days-custom-group');
        if (customGroupEl) customGroupEl.style.display = 'none';
        const customInputEl = container.querySelector('#book-recommended-days-custom');
        if (customInputEl) {
            customInputEl.value = '';
            customInputEl.required = false;
        }
        const selectEl = container.querySelector('#book-recommended-days-select');
        if (selectEl) selectEl.value = '90';

        const heading = container.querySelector('#book-form-heading');
        if (heading) {
            heading.innerHTML = `
                <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                신규 교재 등록
            `;
        }
        const label = container.querySelector('#book-submit-btn-label');
        if (label) label.textContent = '등록 완료';

        const cancelBtn = container.querySelector('#cancel-book-edit-btn');
        if (cancelBtn) cancelBtn.remove();
    };

    render();

    // Subscribe to state changes
    const unsubBooks = stateStore.subscribe('BOOKS_CHANGED', render);
    return () => {
        unsubBooks();
    };
}

/**
 * 9. 원생별 교재 등록 경과일 관리 (renderBooksElapsed)
 * Monitors the elapsed days since the last book registration for each student.
 * Highlight warnings for long intervals and triggers Kakaotalk billing request alerts.
 */
export function renderBooksElapsed(container) {
    let filterQuery = '';
    let filterDaysGroup = ''; // '', 'normal', 'warning', 'recommended'

    const render = () => {
        container.innerHTML = `
            <div class="glass-card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-clock" style="color: var(--accent);"></i>
                        원생별 교재 등록 및 경과일 현황
                    </h3>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <div style="position: relative; width: 220px;">
                            <input type="text" id="elapsed-search-input" class="form-control" placeholder="원생 이름 검색..." style="width: 100%; padding-left: 40px; margin-bottom: 0;" value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        </div>
                        <select id="elapsed-days-filter" class="form-control" style="width: 170px; margin-bottom: 0;">
                            <option value="">경과 상태 전체</option>
                            <option value="recommended" ${filterDaysGroup === 'recommended' ? 'selected' : ''}>교재 추천 (90% 이상)</option>
                            <option value="warning" ${filterDaysGroup === 'warning' ? 'selected' : ''}>주의 (80% ~ 90%)</option>
                            <option value="normal" ${filterDaysGroup === 'normal' ? 'selected' : ''}>정상 (80% 미만)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Student Books Elapsed Table -->
            <div class="glass-card">
                <div class="table-wrapper">
                    <table class="custom-table" id="elapsed-table">
                        <thead>
                            <tr>
                                <th>원생명</th>
                                <th>수강 과목 / 담당강사</th>
                                <th>최근 등록 교재</th>
                                <th>교재 등록일</th>
                                <th>경과 기간 (출석 / 권장)</th>
                                <th>청구/결제 상태</th>
                                <th style="text-align: right;">관리 행정</th>
                            </tr>
                        </thead>
                        <tbody id="elapsed-table-body">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const searchInput = container.querySelector('#elapsed-search-input');
        const daysFilter = container.querySelector('#elapsed-days-filter');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterQuery = e.target.value;
                renderTableBody();
            });
        }

        if (daysFilter) {
            daysFilter.addEventListener('change', (e) => {
                filterDaysGroup = e.target.value;
                renderTableBody();
            });
        }

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#elapsed-table-body');
        if (!tbody) return;

        const students = stateStore.getStudents();
        const teachers = stateStore.getTeachers();
        const books = stateStore.getBooks();
        const studentBooks = stateStore.getStudentBooks();
        const attendance = stateStore.getAttendance();
        const payments = stateStore.getPayments();

        // Process student elapsed status
        const elapsedList = students.map(s => {
            const teacher = teachers.find(t => t.id === s.teacherId);
            
            // Get all books registered to this student
            const sBooks = studentBooks.filter(sb => sb.studentId === s.id);
            
            // Sort to find the latest one
            sBooks.sort((a, b) => (b.regDate || '').localeCompare(a.regDate || ''));
            const latestSB = sBooks[0] || null;
            const bookInfo = latestSB ? books.find(b => b.id === latestSB.bookId) : null;

            let attendedCount = 0;
            let recommendedDays = 90;
            let ratio = 0;
            let statusGroup = 'normal';

            if (latestSB) {
                recommendedDays = bookInfo ? (bookInfo.recommendedDays || 90) : 90;
                // Count attendance on or after regDate
                attendedCount = attendance.filter(a => {
                    return a.studentId === s.id && a.date >= latestSB.regDate && (a.status === 'present' || a.status === 'late');
                }).length;

                ratio = recommendedDays > 0 ? (attendedCount / recommendedDays) : 0;
                if (ratio >= 0.9) {
                    statusGroup = 'recommended';
                } else if (ratio >= 0.8) {
                    statusGroup = 'warning';
                }
            }

            return {
                student: s,
                teacher: teacher,
                latestSB: latestSB,
                book: bookInfo,
                attendedCount: attendedCount,
                recommendedDays: recommendedDays,
                ratio: ratio,
                statusGroup: statusGroup
            };
        });

        // Apply filters
        const filtered = elapsedList.filter(item => {
            const nameMatch = !filterQuery || item.student.name.toLowerCase().includes(filterQuery.toLowerCase());
            
            let daysMatch = true;
            if (filterDaysGroup) {
                daysMatch = item.statusGroup === filterDaysGroup;
            }

            return nameMatch && daysMatch;
        });

        // Sort descending by ratio so students closest to recommendation show first
        filtered.sort((a, b) => b.ratio - a.ratio);

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        등록된 교재 경과일 정보가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const student = item.student;
            const teacher = item.teacher;
            const book = item.book;
            const sb = item.latestSB;
            
            let bookNameText = '<span style="color: var(--text-muted); font-style: italic;">미등록</span>';
            let regDateText = '-';
            let elapsedText = '<span style="color: var(--text-muted);">-</span>';
            let statusBadge = '-';
            let actionHtml = '-';

            if (sb && book) {
                bookNameText = `${book.name} <span style="font-size: 0.75rem; color: var(--secondary);">(${sb.orderNo}권)</span>`;
                regDateText = sb.regDate;

                // Elapsed calculation and badge
                const A = item.attendedCount;
                const R = item.recommendedDays;
                
                if (item.statusGroup === 'recommended') {
                    elapsedText = `<span class="badge badge-danger" style="padding: 4px 10px; font-weight: 800;">${A}일 / ${R}일 (교재 추천)</span>`;
                } else if (item.statusGroup === 'warning') {
                    elapsedText = `<span class="badge badge-warning" style="padding: 4px 10px; font-weight: 800; background: #e67e22; color: white;">${A}일 / ${R}일 (주의)</span>`;
                } else {
                    elapsedText = `<span class="badge badge-success" style="padding: 4px 10px; font-weight: 700;">${A}일 / ${R}일 (정상)</span>`;
                }

                // Retrieve payment from payments table
                const payRecord = sb.paymentId ? payments.find(p => p.id === sb.paymentId) : payments.find(p => p.studentId === student.id && p.bookId === sb.bookId && p.type === 'book');
                const paymentStatus = payRecord ? payRecord.status : 'unpaid';

                // Payment Status Badge & Action
                if (paymentStatus === 'paid') {
                    statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> 완납</span>`;
                    actionHtml = `<span style="color: var(--success); font-size: 0.8rem; font-weight: bold;"><i class="fa-solid fa-circle-check"></i> 수납 완료</span>`;
                } else if (paymentStatus === 'requested') {
                    statusBadge = `<span class="badge badge-warning" style="background: var(--primary); color: white;"><i class="fa-solid fa-paper-plane"></i> 결제 요청됨</span>`;
                    actionHtml = `
                        <button class="btn btn-secondary btn-request-payment" data-id="${payRecord ? payRecord.id : sb.id}" style="padding: 4px 8px; font-size: 0.75rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-rotate-right"></i> 재요청
                        </button>
                    `;
                } else {
                    statusBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-exclamation"></i> 청구전</span>`;
                    actionHtml = `
                        <button class="btn btn-primary btn-request-payment" data-id="${payRecord ? payRecord.id : sb.id}" style="padding: 4px 8px; font-size: 0.75rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-paper-plane"></i> 결제 요청
                        </button>
                    `;
                }
            }

            return `
                <tr>
                    <td style="font-weight: 600;">
                        <span style="font-size: 0.95rem; color: var(--text-main);">${student.name}</span>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">학부모: ${student.parentPhone}</div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--accent); font-size: 0.9rem;">${student.instrument}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">강사: ${teacher ? teacher.name : '미지정'}</div>
                    </td>
                    <td style="font-weight: 600; color: var(--text-main);">${bookNameText}</td>
                    <td>${regDateText}</td>
                    <td>${elapsedText}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right;">${actionHtml}</td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-request-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                stateStore.requestBookPayment(id);
            });
        });
    };

    const unsubStudentBooks = stateStore.subscribe('STUDENT_BOOKS_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubPayments = stateStore.subscribe('PAYMENTS_CHANGED', render);
    const unsubAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', render);

    render();

    return () => {
        unsubStudentBooks();
        unsubStudents();
        unsubPayments();
        unsubAttendance();
    };
}

/**
 * 8.5. 수강과목 관리 (renderSubjects)
 * Renders list of subjects/courses and handles CRUD.
 */
export function renderSubjects(container) {
    let filterQuery = '';
    let editingSubjectId = null;

    const render = () => {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;" class="subjects-layout-grid">
                <!-- Column 1: Subjects Table -->
                <div class="glass-card" style="display: flex; flex-direction: column;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-graduation-cap" style="color: var(--primary);"></i>
                        수강과목 관리
                    </h3>
                    
                    <!-- Search row -->
                    <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                        <div style="position: relative; flex-grow: 1; min-width: 180px;">
                            <input type="text" id="subject-search-input" class="form-control" placeholder="과목명 검색..." value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                        </div>
                    </div>

                    <div class="table-wrapper" style="margin-top: 0;">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>과목명</th>
                                    <th style="width: 100px;">상태</th>
                                    <th style="width: 120px;">등록일</th>
                                    <th style="width: 120px;">수정일</th>
                                    <th style="width: 100px; text-align: right;">관리</th>
                                </tr>
                            </thead>
                            <tbody id="subjects-table-body"></tbody>
                        </table>
                    </div>
                </div>

                <!-- Column 2: Subject Form -->
                <div class="glass-card" style="align-self: start;">
                    <h3 id="subject-form-heading" style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                        신규 과목 추가
                    </h3>

                    <form id="subject-form">
                        <div class="form-group">
                            <label for="subject-name-input">과목명 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="subject-name-input" class="form-control" placeholder="예: 체르니 100" required>
                        </div>
                        <div class="form-group">
                            <label for="subject-active-select">사용 여부</label>
                            <select id="subject-active-select" class="form-control">
                                <option value="true">사용</option>
                                <option value="false">미사용</option>
                            </select>
                        </div>

                        <div id="subject-form-buttons-container" style="display: flex; gap: 8px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex-grow: 2; justify-content: center;">
                                <i class="fa-solid fa-check"></i> <span id="subject-submit-btn-label">추가 완료</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Bind events inside render
        const searchInput = container.querySelector('#subject-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterQuery = e.target.value;
                renderTableBody();
            });
        }

        const form = container.querySelector('#subject-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = container.querySelector('#subject-name-input').value.trim();
                const isActive = container.querySelector('#subject-active-select').value === 'true';

                if (editingSubjectId) {
                    stateStore.updateSubject(editingSubjectId, { name, isActive });
                    resetForm();
                } else {
                    stateStore.addSubject(name, isActive);
                    form.reset();
                }
            });
        }

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#subjects-table-body');
        if (!tbody) return;

        const subjects = stateStore.getSubjects();

        const filtered = subjects.filter(s => {
            return !filterQuery || s.name.toLowerCase().includes(filterQuery.toLowerCase());
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        등록된 과목이 없거나 검색 결과가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(s => {
            const isChecked = s.isActive ? 'checked' : '';
            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-main);">${s.name}</td>
                    <td>
                        <label class="switch-toggle" style="display: inline-flex; align-items: center; cursor: pointer; gap: 8px;">
                            <input type="checkbox" class="subject-status-checkbox" data-id="${s.id}" ${isChecked} style="accent-color: var(--primary);">
                            <span style="font-size: 0.8rem; color: ${s.isActive ? 'var(--success)' : 'var(--text-muted)'}; font-weight: bold;">
                                ${s.isActive ? '사용' : '미사용'}
                            </span>
                        </label>
                    </td>
                    <td>${s.regDate || '-'}</td>
                    <td>${s.updateDate || '-'}</td>
                    <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 8px;">
                            <button class="btn btn-secondary btn-icon-only edit-subject-btn" data-id="${s.id}" title="수정">
                                <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only delete-subject-btn" data-id="${s.id}" title="삭제">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Action bindings
        tbody.querySelectorAll('.edit-subject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                startEditMode(id);
            });
        });

        tbody.querySelectorAll('.delete-subject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const subjects = stateStore.getSubjects();
                const subject = subjects.find(s => s.id === id);
                if (confirm(`정말로 '${subject.name}' 과목을 삭제하시겠습니까?`)) {
                    stateStore.deleteSubject(id);
                    if (editingSubjectId === id) {
                        resetForm();
                    }
                }
            });
        });

        tbody.querySelectorAll('.subject-status-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const active = e.target.checked;
                stateStore.updateSubject(id, { isActive: active });
            });
        });
    };

    const startEditMode = (id) => {
        editingSubjectId = id;
        const subjects = stateStore.getSubjects();
        const subject = subjects.find(s => s.id === id);
        if (!subject) return;

        container.querySelector('#subject-name-input').value = subject.name;
        container.querySelector('#subject-active-select').value = String(subject.isActive);

        container.querySelector('#subject-form-heading').innerHTML = `
            <i class="fa-solid fa-pen" style="color: var(--primary);"></i>
            과목 정보 수정
        `;
        container.querySelector('#subject-submit-btn-label').textContent = '수정 완료';

        const buttonsContainer = container.querySelector('#subject-form-buttons-container');
        if (!container.querySelector('#cancel-subject-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.id = 'cancel-subject-edit-btn';
            cancelBtn.style.flexGrow = '1';
            cancelBtn.style.justifyContent = 'center';
            cancelBtn.textContent = '취소';
            cancelBtn.addEventListener('click', resetForm);
            buttonsContainer.appendChild(cancelBtn);
        }
    };

    const resetForm = () => {
        editingSubjectId = null;
        const form = container.querySelector('#subject-form');
        if (form) form.reset();

        const heading = container.querySelector('#subject-form-heading');
        if (heading) {
            heading.innerHTML = `
                <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                신규 과목 추가
            `;
        }
        const label = container.querySelector('#subject-submit-btn-label');
        if (label) label.textContent = '추가 완료';

        const cancelBtn = container.querySelector('#cancel-subject-edit-btn');
        if (cancelBtn) cancelBtn.remove();
    };

    render();

    // Subscribe to state changes
    const unsubSubjects = stateStore.subscribe('SUBJECTS_CHANGED', render);
    return () => {
        unsubSubjects();
    };
}

export function renderCommunication(container) {
    let activeSubTab = 'announcements'; // 'announcements', 'messages', 'surveys'
    let annQuery = '', msgQuery = '', survQuery = '';
    let annPage = 1, msgPage = 1, survPage = 1;
    const itemsPerPage = 10;

    const render = () => {
        container.innerHTML = `
            <div class="glass-card" style="padding: 1.8rem; min-height: 500px;">
                <!-- Tab Menu Header -->
                <div style="display: flex; gap: 10px; margin-bottom: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; flex-wrap: wrap;">
                    <button class="btn ${activeSubTab === 'announcements' ? 'btn-primary' : 'btn-secondary'}" id="tab-comm-ann" style="border-radius: 20px; font-weight: 700; padding: 8px 16px;">
                        <i class="fa-solid fa-bullhorn" style="margin-right: 4px;"></i> 공지사항 관리
                    </button>
                    <button class="btn ${activeSubTab === 'messages' ? 'btn-primary' : 'btn-secondary'}" id="tab-comm-msg" style="border-radius: 20px; font-weight: 700; padding: 8px 16px;">
                        <i class="fa-solid fa-envelope" style="margin-right: 4px;"></i> 개별 안내장 발송
                    </button>
                    <button class="btn ${activeSubTab === 'surveys' ? 'btn-primary' : 'btn-secondary'}" id="tab-comm-surv" style="border-radius: 20px; font-weight: 700; padding: 8px 16px;">
                        <i class="fa-solid fa-square-poll-vertical" style="margin-right: 4px;"></i> 설문조사 시스템
                    </button>
                </div>

                <!-- Sub-tab Content Area -->
                <div id="communication-subtab-content"></div>
            </div>
        `;

        // Bind tab events
        container.querySelector('#tab-comm-ann').addEventListener('click', () => {
            activeSubTab = 'announcements';
            render();
        });
        container.querySelector('#tab-comm-msg').addEventListener('click', () => {
            activeSubTab = 'messages';
            render();
        });
        container.querySelector('#tab-comm-surv').addEventListener('click', () => {
            activeSubTab = 'surveys';
            render();
        });

        const subContainer = container.querySelector('#communication-subtab-content');
        if (activeSubTab === 'announcements') renderAnnouncementsTab(subContainer);
        else if (activeSubTab === 'messages') renderMessagesTab(subContainer);
        else if (activeSubTab === 'surveys') renderSurveysTab(subContainer);
    };

    const renderAnnouncementsTab = (tabContainer) => {
        tabContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-bullhorn" style="color: var(--primary);"></i> 학원 공지사항
                </h3>
                <button class="btn btn-primary btn-sm" id="btn-write-announcement" style="font-weight: 700; height: 36px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-pen-nib"></i> 신규 공지 작성
                </button>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">학원 전체 원생/학부모를 대상으로 공지사항을 등록하고 조회수를 모니터링합니다.</p>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
            <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                <div style="position: relative; max-width: 320px; margin: 0;">
                    <input type="text" id="ann-search-input" class="form-control" placeholder="공지 제목 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${annQuery}">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                </div>
            </div>
            <div class="table-wrapper" style="margin-top: 0;">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">번호</th>
                            <th>제목</th>
                            <th style="width: 140px;">작성일</th>
                            <th style="width: 100px; text-align: center;">조회수</th>
                            <th style="width: 100px; text-align: right;">관리</th>
                        </tr>
                    </thead>
                    <tbody id="ann-table-body"></tbody>
                </table>
            </div>
            <div id="ann-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
        `;

        const searchInput = tabContainer.querySelector('#ann-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                annQuery = e.target.value;
                annPage = 1;
                renderTable();
            });
        }
        tabContainer.querySelector('#btn-write-announcement').addEventListener('click', openWriteAnnouncementModal);

        const renderTable = () => {
            const tbody = tabContainer.querySelector('#ann-table-body');
            const paginator = tabContainer.querySelector('#ann-pagination');
            if (!tbody) return;

            const allAnn = stateStore.getAnnouncements().sort((a, b) => {
                const timeA = a.created_at || a.date || '';
                const timeB = b.created_at || b.date || '';
                const dateCompare = timeB.localeCompare(timeA);
                if (dateCompare !== 0) return dateCompare;
                const idA = parseInt(a.id.replace(/[^\d]/g, ''), 10) || 0;
                const idB = parseInt(b.id.replace(/[^\d]/g, ''), 10) || 0;
                return idB - idA;
            });
            const filtered = allAnn.filter(a => !annQuery || a.title.toLowerCase().includes(annQuery.toLowerCase()));

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">등록된 공지사항이 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (annPage - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map((ann, idx) => `
                <tr>
                    <td style="text-align: center; font-size: 0.9rem;">${startIdx + idx + 1}</td>
                    <td style="font-size: 0.9rem; font-weight: 600;">
                        <span class="ann-title-link" data-id="${ann.id}" style="color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${escapeHtml(ann.title)}</span>
                    </td>
                    <td style="font-size: 0.85rem; text-align: center;">${ann.date}</td>
                    <td style="text-align: center; font-size: 0.85rem;"><span style="font-weight: 700; color: var(--primary);">${ann.views || 0}회</span></td>
                    <td style="text-align: right;">
                        <button class="btn btn-danger btn-sm btn-delete-ann" data-id="${ann.id}" style="padding: 4px 8px; font-size: 0.75rem;">
                            <i class="fa-solid fa-trash"></i> 삭제
                        </button>
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.ann-title-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const ann = stateStore.getAnnouncements().find(a => a.id === id);
                    if (ann) {
                        openAnnouncementDetailModal(ann);
                    }
                });
            });

            tbody.querySelectorAll('.btn-delete-ann').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (confirm('해당 공지사항을 정말 삭제하시겠습니까?')) {
                        stateStore.deleteAnnouncement(id);
                    }
                });
            });

            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-ann-prev" ${annPage === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${annPage === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-ann-next" ${annPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    annPage = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-ann-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (annPage > 1) { annPage--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-ann-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (annPage < totalPages) { annPage++; renderTable(); } });
        };

        renderTable();
    };

    const renderMessagesTab = (tabContainer) => {
        const students = stateStore.getStudents();
        tabContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-envelope" style="color: var(--primary);"></i> 개별 안내장 및 메시지 발송 목록
                </h3>
                <button class="btn btn-primary btn-sm" id="btn-write-message" style="font-weight: 700; height: 36px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-paper-plane"></i> 개별 안내장 발송
                </button>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">특정 원생의 학부모에게 개별 알림이나 일지를 안전하게 전송합니다.</p>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
            <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                <div style="position: relative; max-width: 320px; margin: 0;">
                    <input type="text" id="msg-search-input" class="form-control" placeholder="수신 원생 또는 제목 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${msgQuery}">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                </div>
            </div>
            <div class="table-wrapper" style="margin-top: 0;">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th style="width: 120px;">수신 원생</th>
                            <th>메시지 제목 및 요약</th>
                            <th style="width: 140px;">발송 일시</th>
                            <th style="width: 100px;">학부모 열람</th>
                            <th style="width: 100px; text-align: right;">관리</th>
                        </tr>
                    </thead>
                    <tbody id="msg-table-body"></tbody>
                </table>
            </div>
            <div id="msg-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
        `;

        const searchInput = tabContainer.querySelector('#msg-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                msgQuery = e.target.value;
                msgPage = 1;
                renderTable();
            });
        }
        tabContainer.querySelector('#btn-write-message').addEventListener('click', () => openWriteMessageModal(students));

        const renderTable = () => {
            const tbody = tabContainer.querySelector('#msg-table-body');
            const paginator = tabContainer.querySelector('#msg-pagination');
            if (!tbody) return;

            const allMsg = stateStore.getMessages().sort((a, b) => {
                const timeA = a.created_at || a.date || '';
                const timeB = b.created_at || b.date || '';
                const dateCompare = timeB.localeCompare(timeA);
                if (dateCompare !== 0) return dateCompare;
                const idA = parseInt(a.id.replace(/[^\d]/g, ''), 10) || 0;
                const idB = parseInt(b.id.replace(/[^\d]/g, ''), 10) || 0;
                return idB - idA;
            });
            const filtered = allMsg.filter(msg => {
                const s = students.find(stud => stud.id === msg.studentId);
                const sName = s ? s.name : '';
                return !msgQuery || sName.toLowerCase().includes(msgQuery.toLowerCase()) || msg.title.toLowerCase().includes(msgQuery.toLowerCase());
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">발송된 개별 안내장이 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (msgPage - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map(msg => {
                const student = students.find(s => s.id === msg.studentId);
                const readBadge = msg.isRead 
                    ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 읽음</span>`
                    : `<span class="badge badge-warning" style="background: var(--danger); color: white;"><i class="fa-solid fa-circle-exclamation"></i> 안읽음</span>`;
                
                return `
                    <tr>
                        <td style="font-size: 0.9rem;"><strong>${student ? student.name : '알 수 없음'}</strong></td>
                        <td style="font-size: 0.9rem;">
                            <span class="msg-title-link" data-id="${msg.id}" style="color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700; display: block; margin-bottom: 2px;">${escapeHtml(msg.title)}</span>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 0 0; max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(msg.content)}
                            </p>
                        </td>
                        <td style="font-size: 0.85rem; text-align: center;">${msg.date}</td>
                        <td style="text-align: center;">${readBadge}</td>
                        <td style="text-align: right;">
                            <button class="btn btn-danger btn-sm btn-delete-msg" data-id="${msg.id}" style="padding: 4px 8px; font-size: 0.75rem;">
                                <i class="fa-solid fa-trash"></i> 삭제
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.msg-title-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const msg = stateStore.getMessages().find(m => m.id === id);
                    if (msg) {
                        openMessageDetailModal(msg, students);
                    }
                });
            });

            tbody.querySelectorAll('.btn-delete-msg').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (confirm('해당 메시지를 정말 삭제하시겠습니까?')) {
                        stateStore.deleteMessage(id);
                    }
                });
            });

            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-msg-prev" ${msgPage === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${msgPage === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-msg-next" ${msgPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    msgPage = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-msg-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (msgPage > 1) { msgPage--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-msg-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (msgPage < totalPages) { msgPage++; renderTable(); } });
        };

        renderTable();
    };

    const renderSurveysTab = (tabContainer) => {
        tabContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-square-poll-vertical" style="color: var(--primary);"></i> 학부모 설문조사 시스템
                </h3>
                <button class="btn btn-primary btn-sm" id="btn-create-survey" style="font-weight: 700; height: 36px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-square-plus"></i> 신규 설문지 만들기
                </button>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">학원 일정, 연주회 참가 여부 등 학부모 의견을 수집하고 분석합니다.</p>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
            <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                <div style="position: relative; max-width: 320px; margin: 0;">
                    <input type="text" id="surv-search-input" class="form-control" placeholder="설문 제목 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${survQuery}">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                </div>
            </div>
            <div class="table-wrapper" style="margin-top: 0;">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>설문 제목</th>
                            <th style="width: 140px;">배포일</th>
                            <th style="width: 100px;">상태</th>
                            <th style="width: 180px;">응답 비율 (참여/전체)</th>
                            <th style="width: 180px; text-align: right; white-space: nowrap;">관리</th>
                        </tr>
                    </thead>
                    <tbody id="surv-table-body"></tbody>
                </table>
            </div>
            <div id="surv-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
        `;

        const searchInput = tabContainer.querySelector('#surv-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                survQuery = e.target.value;
                survPage = 1;
                renderTable();
            });
        }
        tabContainer.querySelector('#btn-create-survey').addEventListener('click', openCreateSurveyModal);

        const renderTable = () => {
            const tbody = tabContainer.querySelector('#surv-table-body');
            const paginator = tabContainer.querySelector('#surv-pagination');
            if (!tbody) return;

            const allSurv = stateStore.getSurveys().sort((a, b) => {
                const timeA = a.created_at || a.date || '';
                const timeB = b.created_at || b.date || '';
                const dateCompare = timeB.localeCompare(timeA);
                if (dateCompare !== 0) return dateCompare;
                const idA = parseInt(a.id.replace(/[^\d]/g, ''), 10) || 0;
                const idB = parseInt(b.id.replace(/[^\d]/g, ''), 10) || 0;
                return idB - idA;
            });
            const filtered = allSurv.filter(surv => !survQuery || surv.title.toLowerCase().includes(survQuery.toLowerCase()));
            const students = stateStore.getStudents();

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">등록된 설문지가 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (survPage - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map(surv => {
                const responses = stateStore.getSurveyResponses(surv.id);
                const totalStudents = students.length;
                const ratePercent = totalStudents > 0 ? Math.round((responses.length / totalStudents) * 100) : 0;
                
                return `
                    <tr>
                        <td style="font-size: 0.9rem;">
                            <span class="surv-title-link" data-id="${surv.id}" style="color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${escapeHtml(surv.title)}</span>
                        </td>
                        <td style="font-size: 0.85rem; text-align: center;">${surv.date}</td>
                        <td style="text-align: center;">
                            <span class="badge ${surv.isActive ? 'badge-success' : 'badge-info'}" style="${surv.isActive ? '' : 'background: #bdc3c7; color: white;'}">
                                ${surv.isActive ? '진행 중' : '종료'}
                            </span>
                        </td>
                        <td style="text-align: center; font-size: 0.85rem;">
                            <strong style="color: var(--primary);">${responses.length} / ${totalStudents}명</strong> (${ratePercent}%)
                        </td>
                        <td style="text-align: right; white-space: nowrap;">
                            <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: nowrap;">
                                <button class="btn btn-secondary btn-sm btn-view-survey-stats" data-id="${surv.id}" style="padding: 4px 8px; font-size: 0.75rem; white-space: nowrap;">
                                    <i class="fa-solid fa-chart-bar"></i> 통계 분석
                                </button>
                                <button class="btn btn-danger btn-sm btn-delete-survey" data-id="${surv.id}" style="padding: 4px 8px; font-size: 0.75rem; white-space: nowrap;">
                                    <i class="fa-solid fa-trash"></i> 삭제
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.surv-title-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const surv = stateStore.getSurveys().find(s => s.id === id);
                    if (surv) {
                        openSurveyDetailModal(surv);
                    }
                });
            });

            tbody.querySelectorAll('.btn-view-survey-stats').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    openSurveyStatsModal(id, students);
                });
            });

            tbody.querySelectorAll('.btn-delete-survey').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (confirm('설문지 및 모든 답변 데이터를 정말 삭제하시겠습니까?')) {
                        stateStore.deleteSurvey(id);
                    }
                });
            });

            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-surv-prev" ${survPage === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${survPage === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-surv-next" ${survPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    survPage = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-surv-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (survPage > 1) { survPage--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-surv-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (survPage < totalPages) { survPage++; renderTable(); } });
        };

        renderTable();
    };

    const openWriteAnnouncementModal = () => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">학원 전체 공지사항 배포</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <form id="form-create-announcement">
                    <div class="form-group">
                        <label for="ann-title">공지 제목</label>
                        <input type="text" id="ann-title" class="form-control" placeholder="학부모 전체 공지 제목을 기입해주세요." required>
                    </div>
                    <div class="form-group">
                        <label for="ann-content">공지 내용</label>
                        <textarea id="ann-content" class="form-control" rows="8" placeholder="학부모 공지 상세 안내문을 작성해주세요." required style="resize: none; font-family: inherit; line-height: 1.5;"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" form="form-create-announcement" class="btn btn-primary">공지사항 발행</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const form = modalArea.querySelector('#form-create-announcement');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = form.querySelector('#ann-title').value.trim();
                const content = form.querySelector('#ann-content').value.trim();
                
                if (title && content) {
                    showLocalConfirm(modalArea, "공지사항을 발행하시겠습니까?", () => {
                        stateStore.addAnnouncement(title, content);
                        closeModal();
                        showKakaoTalkToast("공지사항이 발행되었습니다.");
                    });
                }
            });
        });
    };

    const openWriteMessageModal = (students) => {
        const studentOptions = students.map(s => `<option value="${s.id}">${s.name} (${s.instrument} | 학부모: ${s.parentPhone})</option>`).join('');
        
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">학부모 개별 안내장 발송</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <form id="form-create-message">
                    <div class="form-group">
                        <label for="msg-student-id">대상 수강생 선택</label>
                        <select id="msg-student-id" class="form-control" required>
                            <option value="">-- 대상 원생을 고르세요 --</option>
                            ${studentOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="msg-title">안내장 제목</label>
                        <input type="text" id="msg-title" class="form-control" placeholder="개별 안내장 제목을 입력하세요." required>
                    </div>
                    <div class="form-group">
                        <label for="msg-content">안내 및 전언 내용</label>
                        <textarea id="msg-content" class="form-control" rows="6" placeholder="학부모님께 개별 전송할 구체적인 내용 및 피드백을 전달해주세요." required style="resize: none; font-family: inherit; line-height: 1.5;"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" form="form-create-message" class="btn btn-primary">안내장 발송하기</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const form = modalArea.querySelector('#form-create-message');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const studentId = form.querySelector('#msg-student-id').value;
                const title = form.querySelector('#msg-title').value.trim();
                const content = form.querySelector('#msg-content').value.trim();
                
                if (studentId && title && content) {
                    showLocalConfirm(modalArea, "공지사항을 발행하시겠습니까?", () => {
                        stateStore.addMessage(studentId, title, content);
                        closeModal();
                        showKakaoTalkToast("안내장이 발송되었습니다.");
                    });
                }
            });
        });
    };

    const openCreateSurveyModal = () => {
        let tempQuestions = [];

        const updateTempQuestionsUI = (modalArea) => {
            const container = modalArea.querySelector('#modal-survey-questions-list');
            if (tempQuestions.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-sm);">추가된 문항이 없습니다. [+ 질문 추가] 버튼으로 문항을 생성해주세요.</div>`;
                return;
            }

            container.innerHTML = tempQuestions.map((q, idx) => {
                const typeText = q.type === 'choice' ? '객관식 선택' : '주관식 단답';
                const optsText = q.type === 'choice' ? `<div style="font-size: 0.8rem; color: var(--secondary); margin-top: 4px;"><strong>선택 옵션:</strong> ${q.options.join(', ')}</div>` : '';
                
                return `
                    <div style="background: rgba(9, 132, 227, 0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: flex-start; justify-content: space-between;">
                        <div>
                            <span class="badge badge-info" style="font-size: 0.65rem; margin-bottom: 4px;">문항 ${idx + 1} (${typeText})</span>
                            <div style="font-weight: bold; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(q.questionText)}</div>
                            ${optsText}
                        </div>
                        <button type="button" class="btn-delete-temp-q" data-index="${idx}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.9rem;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.btn-delete-temp-q').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    tempQuestions.splice(idx, 1);
                    updateTempQuestionsUI(modalArea);
                });
            });
        };

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">신규 설문지 만들기</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px; max-height: 60vh; overflow-y: auto;">
                <form id="form-create-survey">
                    <div class="form-group">
                        <label for="surv-title">설문 조사 제목</label>
                        <input type="text" id="surv-title" class="form-control" placeholder="예: 2026 연주회 만족도 피드백 설문" required>
                    </div>
                    <div class="form-group">
                        <label for="surv-desc">설문 설명문</label>
                        <textarea id="surv-desc" class="form-control" rows="3" placeholder="학부모님들께 설문 목적과 기한 등을 간략히 소개해주세요." required style="resize: none; font-family: inherit; line-height: 1.4;"></textarea>
                    </div>
                    
                    <div style="margin-top: 1.5rem; margin-bottom: 1rem;">
                        <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 8px;">문항 추가 리스트</label>
                        <div id="modal-survey-questions-list"></div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-top: 1.5rem;">
                        <label style="font-weight: 700; font-size: 0.85rem; color: var(--primary); display: block; margin-bottom: 8px;"><i class="fa-solid fa-plus-circle"></i> 문항 추가 폼</label>
                        
                        <div class="form-group">
                            <input type="text" id="temp-q-text" class="form-control" placeholder="질문 내용을 입력하세요." style="font-size:0.85rem; padding:8px 12px;">
                        </div>
                        <div class="form-row" style="grid-template-columns: 1fr 1fr; margin-bottom: 10px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:0.75rem;">문항 유형</label>
                                <select id="temp-q-type" class="form-control" style="font-size:0.85rem; padding:8px;">
                                    <option value="choice">객관식 (단일 선택)</option>
                                    <option value="text">주관식 (서술 답변)</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:0;" id="temp-q-opts-wrapper">
                                <label style="font-size:0.75rem;">객관식 옵션 (쉼표로 구분)</label>
                                <input type="text" id="temp-q-options" class="form-control" placeholder="예: 참석, 불참, 미정" style="font-size:0.85rem; padding:8px 12px;">
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary" id="btn-add-q-to-temp" style="width: 100%; justify-content: center; font-size: 0.8rem; padding: 6px 10px;">
                            <i class="fa-solid fa-plus"></i> 질문 문항 목록에 추가
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" form="form-create-survey" class="btn btn-primary">설문지 배포하기</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const form = modalArea.querySelector('#form-create-survey');
            const qTypeSelect = modalArea.querySelector('#temp-q-type');
            const qOptsWrapper = modalArea.querySelector('#temp-q-opts-wrapper');
            const btnAddQ = modalArea.querySelector('#btn-add-q-to-temp');
            
            qTypeSelect.addEventListener('change', () => {
                if (qTypeSelect.value === 'choice') {
                    qOptsWrapper.style.display = 'block';
                } else {
                    qOptsWrapper.style.display = 'none';
                }
            });

            updateTempQuestionsUI(modalArea);

            btnAddQ.addEventListener('click', () => {
                const qText = modalArea.querySelector('#temp-q-text').value.trim();
                const qType = qTypeSelect.value;
                let options = [];

                if (!qText) {
                    alert('질문 내용을 기입해주세요.');
                    return;
                }

                if (qType === 'choice') {
                    const rawOptions = modalArea.querySelector('#temp-q-options').value;
                    options = rawOptions.split(',').map(o => o.trim()).filter(Boolean);
                    if (options.length === 0) {
                        alert('객관식 문항일 경우 쉼표로 구분하여 최소 1개 이상의 옵션을 적어주세요.');
                        return;
                    }
                }

                const newQId = 'Q' + (tempQuestions.length + 1);
                tempQuestions.push({ id: newQId, type: qType, questionText: qText, options });

                // Reset fields
                modalArea.querySelector('#temp-q-text').value = '';
                modalArea.querySelector('#temp-q-options').value = '';

                // Redraw temp list
                updateTempQuestionsUI(modalArea);
            });

            // Submit form
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = form.querySelector('#surv-title').value.trim();
                const desc = form.querySelector('#surv-desc').value.trim();

                if (tempQuestions.length === 0) {
                    alert('최소 1개 이상의 질문 문항을 설계해야 설문 배포가 가능합니다.');
                    return;
                }

                showLocalConfirm(modalArea, "공지사항을 발행하시겠습니까?", () => {
                    stateStore.addSurvey(title, desc, tempQuestions);
                    closeModal();
                    showKakaoTalkToast("설문조사가 배포되었습니다.");
                });
            });
        });
    };

    // Show survey statistics modal
    const openSurveyStatsModal = (surveyId, students) => {
        const survey = stateStore.getSurvey(surveyId);
        if (!survey) return;

        const responses = stateStore.getSurveyResponses(surveyId);
        const totalRespCount = responses.length;

        // Compile statistics for each question
        let statsHtml = '';
        survey.questions.forEach((q, idx) => {
            let qStatsContent = '';
            
            if (q.type === 'choice') {
                // Initialize option counts
                const optionCounts = {};
                q.options.forEach(opt => { optionCounts[opt] = 0; });
                
                // Accumulate choices
                responses.forEach(r => {
                    const ansVal = r.answers[q.id];
                    if (ansVal !== undefined && optionCounts[ansVal] !== undefined) {
                        optionCounts[ansVal]++;
                    }
                });

                // Ratios html bar
                qStatsContent = q.options.map(opt => {
                    const count = optionCounts[opt];
                    const percent = totalRespCount > 0 ? Math.round((count / totalRespCount) * 100) : 0;
                    return `
                        <div style="margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                                <span style="font-weight: 600; color: var(--text-main);">${opt}</span>
                                <span style="color: var(--text-muted); font-weight: bold;">${count}표 (${percent}%)</span>
                            </div>
                            <div style="width: 100%; height: 12px; background: rgba(9, 132, 227, 0.04); border-radius: 6px; overflow: hidden;">
                                <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 6px;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                // List text answers
                const textAnswers = responses
                    .map(r => {
                        const stdName = students.find(s => s.id === r.studentId)?.name || '알 수 없음';
                        const ans = r.answers[q.id] || '(답변 없음)';
                        return `
                            <div style="padding: 10px; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem;">
                                <span style="font-weight: 700; color: var(--primary); display: block; margin-bottom: 2px;">${stdName} 학부모</span>
                                <p style="margin: 0; color: var(--text-main); line-height: 1.4; white-space: pre-wrap;">${escapeHtml(ans)}</p>
                            </div>
                        `;
                    })
                    .join('');
                
                qStatsContent = `
                    <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 220px; overflow-y: auto; background: rgba(9, 132, 227, 0.01);">
                        ${textAnswers || '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">제출된 서술형 답변이 없습니다.</div>'}
                    </div>
                `;
            }

            statsHtml += `
                <div style="background: #ffffff; border: 1px solid var(--border-color); padding: 18px; border-radius: var(--radius-md); margin-bottom: 1.5rem; box-shadow: var(--shadow-main);">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: bold; margin-bottom: 4px;">질문 ${idx + 1} (${q.type === 'choice' ? '객관식' : '주관식'})</div>
                    <h4 style="font-weight: 700; font-size: 1rem; color: var(--text-main); margin-bottom: 12px; line-height: 1.3;">${escapeHtml(q.questionText)}</h4>
                    ${qStatsContent}
                </div>
            `;
        });

        // Individual response records table
        const individualRowsHtml = responses.map((r, index) => {
            const student = students.find(s => s.id === r.studentId);
            return `
                <tr>
                    <td style="font-size:0.85rem;">${index + 1}</td>
                    <td style="font-weight:600; font-size:0.88rem;">${student ? student.name : '알 수 없음'}</td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${r.date}</td>
                    <td style="font-size:0.85rem; color:var(--text-main);">
                        <ul style="margin: 0; padding-left: 14px; list-style: circle;">
                            ${survey.questions.map(q => `<li><strong>${escapeHtml(q.questionText.slice(0, 10))}:</strong> ${escapeHtml(r.answers[q.id] || '-')}</li>`).join('')}
                        </ul>
                    </td>
                </tr>
            `;
        }).join('');

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">설문 통계 분석</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px; max-height: 65vh; overflow-y: auto;">
                <!-- Summary bar -->
                <div style="background: linear-gradient(135deg, var(--primary-light), rgba(116, 185, 255, 0.04)); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
                    <h4 style="font-weight: 800; font-size: 1.15rem; margin-bottom: 4px; color: var(--text-main);">${escapeHtml(survey.title)}</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">${escapeHtml(survey.description)}</p>
                    <div style="display: flex; gap: 20px; font-size: 0.8rem; color: var(--text-muted); margin-top: 10px; font-weight: 500;">
                        <span>배포일: ${survey.date}</span>
                        <span>총 응답 수: <strong style="color:var(--primary); font-size:0.85rem;">${totalRespCount}명</strong></span>
                    </div>
                </div>

                <!-- Tabs: '통계 집계' / '개별 답변 데이터' -->
                <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 1.5rem;">
                    <button class="btn btn-secondary btn-sm" id="btn-stats-tab-aggregate" style="font-weight: bold; padding: 6px 12px; border-radius:12px; background:var(--primary); color:white;">차트 요약 통계</button>
                    <button class="btn btn-secondary btn-sm" id="btn-stats-tab-individual" style="font-weight: bold; padding: 6px 12px; border-radius:12px;">개별 응답 일지</button>
                </div>

                <!-- aggregate view -->
                <div id="stats-tab-aggregate-view">
                    ${statsHtml}
                </div>

                <!-- individual list view (default hidden) -->
                <div id="stats-tab-individual-view" style="display: none;">
                    <div class="table-wrapper" style="margin-top: 0;">
                        <table class="custom-table" style="font-size: 0.85rem;">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">#</th>
                                    <th style="width: 100px;">수강생</th>
                                    <th style="width: 100px;">제출일</th>
                                    <th>답변 요약</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${individualRowsHtml || `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">응답자가 없습니다.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const btnAgg = modalArea.querySelector('#btn-stats-tab-aggregate');
            const btnInd = modalArea.querySelector('#btn-stats-tab-individual');
            const viewAgg = modalArea.querySelector('#stats-tab-aggregate-view');
            const viewInd = modalArea.querySelector('#stats-tab-individual-view');

            btnAgg.addEventListener('click', () => {
                btnAgg.style.background = 'var(--primary)';
                btnAgg.style.color = 'white';
                btnInd.style.background = '';
                btnInd.style.color = '';
                viewAgg.style.display = 'block';
                viewInd.style.display = 'none';
            });

            btnInd.addEventListener('click', () => {
                btnInd.style.background = 'var(--primary)';
                btnInd.style.color = 'white';
                btnAgg.style.background = '';
                btnAgg.style.color = '';
                viewAgg.style.display = 'none';
                viewInd.style.display = 'block';
            });
        });
    };

    const openAnnouncementDetailModal = (ann) => {
        stateStore.incrementAnnouncementViews(ann.id);
        
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-bullhorn" style="color: var(--primary); margin-right: 8px;"></i>공지사항 상세</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; color: var(--text-main);">
                <div style="margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <h4 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 8px 0; line-height: 1.4; color: var(--text-main);">${escapeHtml(ann.title)}</h4>
                    <div style="display: flex; gap: 16px; font-size: 0.8rem; color: var(--text-muted);">
                        <span><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>작성일: ${ann.date}</span>
                        <span><i class="fa-regular fa-eye" style="margin-right: 4px;"></i>조회수: ${(stateStore.getAnnouncements().find(a => a.id === ann.id)?.views || 0)}회</span>
                    </div>
                </div>
                <div style="font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: 8px; border: 1px solid var(--border-color); max-height: 400px; overflow-y: auto;">${escapeHtml(ann.content)}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const openMessageDetailModal = (msg, students) => {
        const student = students.find(s => s.id === msg.studentId);
        const readBadge = msg.isRead 
            ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 읽음</span>`
            : `<span class="badge badge-warning" style="background: var(--danger); color: white;"><i class="fa-solid fa-circle-exclamation"></i> 안읽음</span>`;

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-envelope" style="color: var(--primary); margin-right: 8px;"></i>보낸 개별 안내장 상세 ✉️</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; color: var(--text-main);">
                <div style="margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <h4 style="font-size: 1.15rem; font-weight: 700; margin: 0 0 8px 0; line-height: 1.4; color: var(--text-main);">${escapeHtml(msg.title)}</h4>
                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--text-muted);">
                        <div><i class="fa-solid fa-user" style="margin-right: 6px; width: 14px;"></i><strong>수신 원생:</strong> ${student ? student.name : '알 수 없음'}</div>
                        <div><i class="fa-regular fa-calendar-days" style="margin-right: 6px; width: 14px;"></i><strong>발송 일시:</strong> ${msg.date}</div>
                        <div style="display: flex; align-items: center; gap: 4px;"><i class="fa-regular fa-eye" style="margin-right: 2px; width: 14px;"></i><strong>학부모 열람 여부:</strong> ${readBadge}</div>
                    </div>
                </div>
                <div style="font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: 8px; border: 1px solid var(--border-color); max-height: 400px; overflow-y: auto;">${escapeHtml(msg.content)}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const openSurveyDetailModal = (surv) => {
        const statusBadge = surv.isActive 
            ? `<span class="badge badge-success">진행 중</span>`
            : `<span class="badge badge-info" style="background: #bdc3c7; color: white;">종료</span>`;

        const questionsHtml = surv.questions && surv.questions.length > 0
            ? surv.questions.map((q, idx) => {
                const typeText = q.type === 'choice' ? '객관식 선택' : '주관식 단답';
                const optsText = q.type === 'choice' && q.options
                    ? `<div style="font-size: 0.8rem; color: var(--secondary); margin-top: 4px;"><strong>선택 옵션:</strong> ${q.options.join(', ')}</div>`
                    : '';
                return `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                        <span class="badge badge-info" style="font-size: 0.65rem; margin-bottom: 4px;">문항 ${idx + 1} (${typeText})</span>
                        <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(q.questionText)}</div>
                        ${optsText}
                    </div>
                `;
            }).join('')
            : `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">문항이 존재하지 않습니다.</div>`;

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-square-poll-vertical" style="color: var(--primary); margin-right: 8px;"></i>설문조사 상세</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; color: var(--text-main); max-height: 60vh; overflow-y: auto;">
                <div style="margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <h4 style="font-size: 1.15rem; font-weight: 700; margin: 0; line-height: 1.4; color: var(--text-main);">${escapeHtml(surv.title)}</h4>
                        ${statusBadge}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">
                        <i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>배포일: ${surv.date}
                    </div>
                    <div style="font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; color: var(--text-muted); background: rgba(0,0,0,0.1); padding: 10px; border-radius: 6px;">${escapeHtml(surv.description || '')}</div>
                </div>
                
                <div>
                    <h5 style="font-weight: bold; font-size: 0.9rem; color: var(--text-main); margin: 0 0 10px 0;">설문 문항 구성</h5>
                    <div>${questionsHtml}</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    render();

    const unsubAnn = stateStore.subscribe('ANNOUNCEMENTS_CHANGED', render);
    const unsubMsg = stateStore.subscribe('MESSAGES_CHANGED', render);
    const unsubSurv = stateStore.subscribe('SURVEYS_CHANGED', render);
    const unsubResp = stateStore.subscribe('SURVEY_RESPONSES_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubUsers = stateStore.subscribe('USERS_CHANGED', render);
    const unsubLinks = stateStore.subscribe('PARENT_STUDENT_LINKS_CHANGED', render);

    return () => {
        unsubAnn();
        unsubMsg();
        unsubSurv();
        unsubResp();
        unsubStudents();
        unsubUsers();
        unsubLinks();
    };
}


export function renderApprovals(container) {
    let query = '';
    let page = 1;
    const itemsPerPage = 10;

    // Track selected student IDs for parent users being approved
    // Format: { requestId: studentId }
    const parentLinks = {};

    const render = () => {
        const currentUser = stateStore.getCurrentUser();
        const academyId = currentUser ? currentUser.academyId : null;
        const academy = academyId ? stateStore.getAcademy(academyId) : null;
        const inviteCodeObj = academyId ? stateStore.getAcademyInviteCode(academyId) : null;
        
        // Get all pending join requests for this academy
        const pendingRequests = academyId ? stateStore.getPendingJoinRequests(academyId) : [];
        
        // Get all students to populate link dropdown
        const students = stateStore.getStudents();

        // Title / Header layout unified with communication board style
        container.innerHTML = `
            <div class="glass-card" style="padding: 1.8rem; min-height: 500px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                    <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-user-check" style="color: var(--primary);"></i> 가입 및 권한 승인 관리
                    </h3>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">
                    학원 가입 신청 및 부모-원생 관계 설정을 검토하고 승인 또는 반려합니다.
                </p>
                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
                
                <!-- Invite Code Management Panel -->
                ${academy ? `
                <div class="glass-card" style="padding: 1.5rem; margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; background: rgba(255, 255, 255, 0.02);">
                    <div>
                        <h4 style="font-weight: 700; margin: 0 0 6px 0; font-size: 1rem; color: var(--text-main);">학원 초대코드 관리</h4>
                        <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;">
                            <span><strong>학원명:</strong> ${academy.name}</span>
                            <span><strong>주소:</strong> ${academy.address} ${academy.detailAddress || ''}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 16px; display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">초대코드:</span>
                            <strong id="invite-code-display" style="font-size: 1.25rem; font-family: monospace; color: var(--primary); letter-spacing: 1px;">${inviteCodeObj ? inviteCodeObj.inviteCode : '-'}</strong>
                            <span id="invite-code-status-badge" class="badge ${inviteCodeObj && inviteCodeObj.status === 'active' ? 'badge-success' : 'badge-danger'}" style="font-size: 0.75rem;">
                                ${inviteCodeObj && inviteCodeObj.status === 'active' ? '활성' : '비활성'}
                            </span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="btn-copy-invite-code" class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; margin-bottom: 0;" ${inviteCodeObj ? '' : 'disabled'}>
                                <i class="fa-regular fa-copy"></i> 초대코드 복사
                            </button>
                            <button id="btn-toggle-invite-status" class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; margin-bottom: 0;" ${inviteCodeObj ? '' : 'disabled'}>
                                ${inviteCodeObj && inviteCodeObj.status === 'active' ? '<i class="fa-solid fa-toggle-on" style="color:var(--success)"></i> 비활성화' : '<i class="fa-solid fa-toggle-off"></i> 활성화'}
                            </button>
                            <button id="btn-regenerate-invite-code" class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; margin-bottom: 0;">
                                <i class="fa-solid fa-rotate"></i> 초대코드 재생성
                            </button>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                    <div style="position: relative; max-width: 320px; margin: 0;">
                        <input type="text" id="approval-search-input" class="form-control" placeholder="가입 신청자 이름 또는 연락처 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${query}">
                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                    </div>
                </div>

                <div class="table-wrapper" style="margin-top: 0;">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>신청자 이름</th>
                                <th>회원 유형</th>
                                <th>연락처</th>
                                <th>신청 방식</th>
                                <th>신청일</th>
                                <th>연관 원생 지정</th>
                                <th style="width: 180px; text-align: right;">관리</th>
                            </tr>
                        </thead>
                        <tbody id="approvals-table-body"></tbody>
                    </table>
                </div>
                <div id="approvals-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
            </div>
        `;

        // Bind invite code management events
        const btnCopy = container.querySelector('#btn-copy-invite-code');
        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                const code = inviteCodeObj ? inviteCodeObj.inviteCode : '';
                navigator.clipboard.writeText(code).then(() => {
                    showKakaoTalkToast("초대코드가 복사되었습니다.");
                });
            });
        }

        const btnToggle = container.querySelector('#btn-toggle-invite-status');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                const isActive = inviteCodeObj && inviteCodeObj.status === 'active';
                try {
                    stateStore.updateAcademyInviteCodeStatus(academyId, !isActive);
                    showKakaoTalkToast(`초대코드가 ${!isActive ? '활성화' : '비활성화'}되었습니다.`);
                    render();
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        const btnRegen = container.querySelector('#btn-regenerate-invite-code');
        if (btnRegen) {
            btnRegen.addEventListener('click', () => {
                if (confirm("초대코드를 재생성하면 기존 초대코드는 더 이상 사용할 수 없습니다. 계속하시겠습니까?")) {
                    try {
                        const newCode = stateStore.regenerateAcademyInviteCode(academyId);
                        showKakaoTalkToast(`새 초대코드 (${newCode})가 생성되었습니다.`);
                        render();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        }

        const searchInput = container.querySelector('#approval-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                query = e.target.value;
                page = 1;
                renderTable();
            });
        }

        const renderTable = () => {
            const tbody = container.querySelector('#approvals-table-body');
            const paginator = container.querySelector('#approvals-pagination');
            if (!tbody) return;

            // Filter pending requests
            const filtered = pendingRequests.filter(r => {
                const u = stateStore.getUser(r.userId);
                if (!u) return false;
                const nameMatch = u.name.toLowerCase().includes(query.toLowerCase());
                const phoneMatch = u.phone.toLowerCase().includes(query.toLowerCase());
                return !query || nameMatch || phoneMatch;
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">대기 중인 가입 신청이 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (page - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map(r => {
                const u = stateStore.getUser(r.userId);
                if (!u) return '';

                let roleLabel = '';
                if (r.userType === 'director') roleLabel = '<span class="badge" style="background: rgba(155, 89, 182, 0.1); color: #8e44ad; font-weight: 700;">원장</span>';
                else if (r.userType === 'teacher') roleLabel = '<span class="badge" style="background: rgba(52, 152, 219, 0.1); color: #2980b9; font-weight: 700;">선생님</span>';
                else if (r.userType === 'parent') roleLabel = '<span class="badge" style="background: rgba(46, 204, 113, 0.1); color: #27ae60; font-weight: 700;">학부모</span>';
                else roleLabel = `<span class="badge badge-secondary">${r.userType}</span>`;

                const methodLabel = r.requestMethod === 'invite_code' 
                    ? '<span style="color: var(--primary);"><i class="fa-solid fa-ticket"></i> 초대코드</span>' 
                    : '<span style="color: var(--success);"><i class="fa-solid fa-magnifying-glass"></i> 학원명 검색</span>';

                // If parent, render a select dropdown containing all active students
                let studentSelectHtml = '-';
                if (r.userType === 'parent') {
                    const studentOptions = students.map(s => `
                        <option value="${s.id}" ${parentLinks[r.id] === s.id ? 'selected' : ''}>
                            ${s.name} (${s.instrument})
                        </option>
                    `).join('');
                    studentSelectHtml = `
                        <select class="form-control select-link-student" data-req-id="${r.id}" style="margin-bottom: 0; padding: 4px 8px; font-size: 0.85rem; height: 32px; width: 200px;">
                            <option value="">-- 원생 연결 선택 --</option>
                            ${studentOptions}
                        </select>
                    `;
                }

                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${escapeHtml(u.name)}</td>
                        <td>${roleLabel}</td>
                        <td style="font-size: 0.9rem;">${escapeHtml(u.phone)}</td>
                        <td>${methodLabel}</td>
                        <td style="font-size: 0.9rem; color: var(--text-muted);">${r.requestedAt}</td>
                        <td>${studentSelectHtml}</td>
                        <td style="text-align: right;">
                            <div style="display: inline-flex; gap: 8px;">
                                <button class="btn btn-primary btn-sm btn-approve-request" data-id="${r.id}" style="padding: 4px 10px; font-size: 0.8rem; font-weight: bold; margin-bottom: 0;">
                                    <i class="fa-solid fa-circle-check"></i> 승인
                                </button>
                                <button class="btn btn-danger btn-sm btn-reject-request" data-id="${r.id}" style="padding: 4px 10px; font-size: 0.8rem; font-weight: bold; margin-bottom: 0;">
                                    <i class="fa-solid fa-circle-xmark"></i> 반려
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Bind change listener for dropdowns
            tbody.querySelectorAll('.select-link-student').forEach(select => {
                select.addEventListener('change', (e) => {
                    const reqId = e.target.dataset.reqId;
                    parentLinks[reqId] = e.target.value;
                });
            });

            // Bind approve/reject button events
            tbody.querySelectorAll('.btn-approve-request').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reqId = e.currentTarget.dataset.id;
                    const req = pendingRequests.find(r => r.id === reqId);
                    if (!req) return;
                    const u = stateStore.getUser(req.userId);
                    if (!u) return;

                    let studentId = null;
                    if (req.userType === 'parent') {
                        studentId = parentLinks[reqId];
                        if (!studentId) {
                            alert('학부모 가입 승인을 위해서는 연결할 원생을 반드시 선택해주세요.');
                            return;
                        }
                    }

                    if (confirm(`'${u.name}' 사용자의 가입 신청을 승인하시겠습니까?`)) {
                        try {
                            stateStore.approveJoinRequest(reqId, studentId, currentUser.id);
                            showKakaoTalkToast(`가입 승인 알림톡이 '${u.name}' 님에게 발송되었습니다.`);
                            render();
                        } catch (err) {
                            alert(err.message || '가입 승인 도중 오류가 발생했습니다.');
                        }
                    }
                });
            });

            tbody.querySelectorAll('.btn-reject-request').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reqId = e.currentTarget.dataset.id;
                    const req = pendingRequests.find(r => r.id === reqId);
                    if (!req) return;
                    const u = stateStore.getUser(req.userId);
                    if (!u) return;

                    const reason = prompt(`'${u.name}' 사용자의 가입 신청을 반려하는 사유를 입력하세요 (선택 사항):`, '');
                    if (reason !== null) {
                        try {
                            stateStore.rejectJoinRequest(reqId, currentUser.id, reason);
                            showKakaoTalkToast(`가입 반려 알림톡이 '${u.name}' 님에게 발송되었습니다.`);
                            render();
                        } catch (err) {
                            alert(err.message || '가입 반려 도중 오류가 발생했습니다.');
                        }
                    }
                });
            });

            // Pagination layout
            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-appr-prev" ${page === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem; margin-bottom: 0;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${page === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px; margin-bottom: 0;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-appr-next" ${page === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem; margin-bottom: 0;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    page = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-appr-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (page > 1) { page--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-appr-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (page < totalPages) { page++; renderTable(); } });
        };

        renderTable();
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    render();

    // Subscribe to state changes
    const unsubRequests = stateStore.subscribe('ACADEMY_JOIN_REQUESTS_CHANGED', render);
    const unsubUsers = stateStore.subscribe('USERS_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);

    return () => {
        unsubRequests();
        unsubUsers();
        unsubStudents();
    };
}

export function renderAcademyInfo(container) {
    const currentUser = stateStore.getCurrentUser();
    const academyId = currentUser ? currentUser.academyId : null;
    const academy = academyId ? stateStore.getAcademy(academyId) : null;

    if (!academy) {
        container.innerHTML = `<div class="glass-card" style="padding: 2rem; text-align: center; color: var(--text-muted);">학원 정보가 존재하지 않습니다.</div>`;
        return () => {};
    }

    function formatBusinessNumber(val) {
        const cleaned = val.replace(/[^0-9]/g, '');
        if (cleaned.length <= 3) {
            return cleaned;
        } else if (cleaned.length <= 5) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        } else {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 10)}`;
        }
    }

    let cleanupFn = null;

    const renderEditForm = () => {
        container.innerHTML = `
            <div class="glass-card" style="padding: 2.2rem; max-width: 700px; margin: 0 auto; min-height: 500px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-school" style="color: var(--primary);"></i> 학원정보 관리
                </h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">
                    학원의 기본 정보와 출결 태블릿 비밀번호 등 시스템 핵심 설정을 구성합니다.
                </p>
                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 20px 0;">

                <form id="academy-info-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원명</label>
                            <input type="text" id="acad-name" class="form-control" value="${academy.name || ''}" style="margin-bottom: 0;" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">대표자명</label>
                            <input type="text" id="acad-owner" class="form-control" value="${academy.ownerName || ''}" style="margin-bottom: 0;" required>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원 연락처 (일반/인터넷/대표번호)</label>
                            <input type="tel" id="acad-phone" class="form-control" value="${academy.phone || ''}" style="margin-bottom: 0;" required>
                            <span id="acad-phone-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">사업자등록번호</label>
                            <input type="text" id="acad-biz-no" class="form-control" placeholder="000-00-00000" maxlength="12" value="${academy.businessRegistrationNumber || ''}" style="margin-bottom: 0;" required>
                            <span id="acad-biz-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원 주소</label>
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <input type="text" id="acad-postcode" class="form-control" placeholder="우편번호" style="width: 120px; margin-bottom: 0;" value="${academy.postcode || ''}" readonly required>
                            <button type="button" id="btn-search-acad-address" class="btn btn-secondary" style="margin-bottom: 0; padding: 0 16px; font-size: 0.85rem; white-space: nowrap;">주소 검색</button>
                        </div>
                        <input type="text" id="acad-address" class="form-control" placeholder="기본 주소" style="margin-bottom: 8px;" value="${academy.address || ''}" readonly required>
                        <input type="text" id="acad-detail-address" class="form-control" placeholder="상세 주소" style="margin-bottom: 0;" value="${academy.detailAddress || ''}">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">시스템 비밀번호 (4자리 숫자)</label>
                            <input type="password" id="acad-sys-pw" class="form-control" placeholder="••••" maxlength="4" value="${academy.systemPassword || '0000'}" style="text-align: center; font-size: 1.2rem; letter-spacing: 0.3rem; margin-bottom: 0;" required>
                            <span id="acad-sys-pw-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">태블릿 출결 비밀번호 (4자리 숫자)</label>
                            <input type="password" id="acad-tab-pw" class="form-control" placeholder="••••" maxlength="4" value="${academy.tabletPassword || '0000'}" style="text-align: center; font-size: 1.2rem; letter-spacing: 0.3rem; margin-bottom: 0;" required>
                            <span id="acad-tab-pw-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원장 서명 이미지 업로드</label>
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: rgba(255, 255, 255, 0.03); border: 1px dashed var(--border-color); padding: 12px; border-radius: var(--radius-sm);">
                            <div id="signature-preview-container" style="width: 80px; height: 80px; border: 1px solid var(--border-color); border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden; position: relative; flex-shrink: 0;">
                                ${academy.directorSignature ? `<img src="${academy.directorSignature}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : `<span style="color: #bbb; font-size: 0.75rem;">이미지 없음</span>`}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <input type="file" id="acad-signature-file" accept="image/*" style="display: none;">
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" id="btn-upload-signature" class="btn btn-secondary" style="margin-bottom: 0; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 4px; border-color: var(--border-color);">
                                        <i class="fa-solid fa-upload"></i> 파일 선택
                                    </button>
                                    ${academy.directorSignature ? `
                                    <button type="button" id="btn-delete-signature" class="btn btn-danger" style="margin-bottom: 0; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 4px; background: var(--danger); border-color: var(--danger); color: white;">
                                        <i class="fa-solid fa-trash"></i> 삭제
                                    </button>` : ''}
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">권장 크기: 정방형 (예: 150x150), 배경이 투명한 PNG 이미지</span>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
                        <button type="submit" class="btn btn-primary" style="padding: 12px 30px; font-weight: bold; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 0; justify-content: center;">
                            <i class="fa-solid fa-floppy-disk"></i> 설정 저장하기
                        </button>
                    </div>
                </form>
            </div>
        `;

        const nameInput = container.querySelector('#acad-name');
        const ownerInput = container.querySelector('#acad-owner');
        const phoneInputEl = container.querySelector('#acad-phone');
        const phoneError = container.querySelector('#acad-phone-error');
        const bizInput = container.querySelector('#acad-biz-no');
        const bizError = container.querySelector('#acad-biz-error');
        const postcodeEl = container.querySelector('#acad-postcode');
        const addressEl = container.querySelector('#acad-address');
        const detailAddressEl = container.querySelector('#acad-detail-address');
        const searchAddressBtn = container.querySelector('#btn-search-acad-address');
        const sysPwInput = container.querySelector('#acad-sys-pw');
        const sysPwError = container.querySelector('#acad-sys-pw-error');
        const tabPwInput = container.querySelector('#acad-tab-pw');
        const tabPwError = container.querySelector('#acad-tab-pw-error');
        const form = container.querySelector('#academy-info-form');

        let uploadedSignatureDataUrl = academy.directorSignature || '';

        const fileInput = container.querySelector('#acad-signature-file');
        const uploadBtn = container.querySelector('#btn-upload-signature');
        const deleteBtn = container.querySelector('#btn-delete-signature');
        const previewContainer = container.querySelector('#signature-preview-container');

        const updateDeleteButtonVisibility = (show) => {
            const btnContainer = container.querySelector('#btn-upload-signature').parentElement;
            let delBtn = btnContainer.querySelector('#btn-delete-signature');
            if (show) {
                if (!delBtn) {
                    const newDelBtn = document.createElement('button');
                    newDelBtn.type = 'button';
                    newDelBtn.id = 'btn-delete-signature';
                    newDelBtn.className = 'btn btn-danger';
                    newDelBtn.style = 'margin-bottom: 0; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 4px; background: var(--danger); border-color: var(--danger); color: white;';
                    newDelBtn.innerHTML = `<i class="fa-solid fa-trash"></i> 삭제`;
                    newDelBtn.addEventListener('click', handleDelete);
                    btnContainer.appendChild(newDelBtn);
                }
            } else {
                if (delBtn) {
                    delBtn.remove();
                }
            }
        };

        const handleDelete = () => {
            uploadedSignatureDataUrl = '';
            previewContainer.innerHTML = `<span style="color: #bbb; font-size: 0.75rem;">이미지 없음</span>`;
            if (fileInput) fileInput.value = '';
            updateDeleteButtonVisibility(false);
        };

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxDim = 150;
                            let width = img.width;
                            let height = img.height;
                            if (width > height) {
                                if (width > maxDim) {
                                    height = Math.round((height * maxDim) / width);
                                    width = maxDim;
                                }
                            } else {
                                if (height > maxDim) {
                                    width = Math.round((width * maxDim) / height);
                                    height = maxDim;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            uploadedSignatureDataUrl = canvas.toDataURL('image/png');
                            previewContainer.innerHTML = `<img src="${uploadedSignatureDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                            updateDeleteButtonVisibility(true);
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', handleDelete);
        }

        // Binders
        const phoneInput = PhoneNumberInput.bind(phoneInputEl, phoneError, true);
        const addressInput = AddressInput.bind({
            postcodeEl,
            addressEl,
            detailAddressEl,
            searchBtnEl: searchAddressBtn
        });

        // Biz number formatter
        bizInput.addEventListener('input', (e) => {
            e.target.value = formatBusinessNumber(e.target.value);
            bizError.style.display = 'none';
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Validate phone
            if (!phoneInput.isValid()) {
                phoneInputEl.focus();
                return;
            }

            // Validate business number
            const bizVal = bizInput.value.replace(/[^0-9]/g, '');
            if (bizVal.length !== 10) {
                bizError.textContent = '사업자등록번호는 10자리 숫자여야 합니다 (000-00-00000).';
                bizError.style.display = 'block';
                bizInput.focus();
                return;
            }

            // Validate passwords
            const sysPw = sysPwInput.value;
            const tabPw = tabPwInput.value;
            if (!/^\d{4}$/.test(sysPw)) {
                sysPwError.textContent = '시스템 비밀번호는 4자리 숫자여야 합니다.';
                sysPwError.style.display = 'block';
                sysPwInput.focus();
                return;
            } else {
                sysPwError.style.display = 'none';
            }

            if (!/^\d{4}$/.test(tabPw)) {
                tabPwError.textContent = '태블릿 출결 비밀번호는 4자리 숫자여야 합니다.';
                tabPwError.style.display = 'block';
                tabPwInput.focus();
                return;
            } else {
                tabPwError.style.display = 'none';
            }

            try {
                stateStore.updateAcademy(academy.id, {
                    name: nameInput.value.trim(),
                    ownerName: ownerInput.value.trim(),
                    phone: phoneInputEl.value.trim(),
                    businessRegistrationNumber: bizInput.value.trim(),
                    postcode: postcodeEl.value.trim(),
                    address: addressEl.value.trim(),
                    detailAddress: detailAddressEl.value.trim(),
                    systemPassword: sysPw,
                    tabletPassword: tabPw,
                    directorSignature: uploadedSignatureDataUrl
                });

                showKakaoTalkToast("학원 정보가 성공적으로 저장되었습니다.");
            } catch (err) {
                alert(err.message || '저장 도중 오류가 발생했습니다.');
            }
        });

        cleanupFn = () => {
            phoneInput.destroy();
            if (addressInput && typeof addressInput.destroy === 'function') {
                addressInput.destroy();
            }
        };
    };

    const renderAuthScreen = () => {
        container.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 450px;">
                <div class="glass-card" style="width: 100%; max-width: 400px; padding: 2.5rem; text-align: center;">
                    <div style="font-size: 3rem; color: var(--primary); margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">학원정보 관리 인증</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4;">
                        학원 핵심 정보 및 시스템 설정을 수정하려면<br><strong>시스템 비밀번호</strong>를 입력해야 합니다.
                    </p>
                    <div class="form-group" style="margin-bottom: 1.5rem; text-align: left;">
                        <label for="academy-auth-password" style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 6px;">시스템 비밀번호 (4자리)</label>
                        <input type="password" id="academy-auth-password" class="form-control" placeholder="••••" maxlength="4" style="text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem; height: 50px; margin-bottom: 0;">
                        <span id="academy-auth-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 6px;"></span>
                    </div>
                    <button id="btn-submit-academy-auth" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: bold; justify-content: center; margin-bottom: 0;">인증하기</button>
                </div>
            </div>
        `;

        const passwordInput = container.querySelector('#academy-auth-password');
        const submitBtn = container.querySelector('#btn-submit-academy-auth');
        const feedback = container.querySelector('#academy-auth-feedback');

        const doAuth = () => {
            const val = passwordInput.value;
            if (val === academy.systemPassword) {
                isAcademyInfoAuthenticated = true;
                renderEditForm();
            } else {
                feedback.textContent = '비밀번호 오류';
                feedback.style.display = 'block';
                passwordInput.value = '';
                passwordInput.focus();
            }
        };

        submitBtn.addEventListener('click', doAuth);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doAuth();
        });
    };

    if (isAcademyInfoAuthenticated) {
        renderEditForm();
    } else {
        renderAuthScreen();
    }

    return () => {
        if (cleanupFn) {
            cleanupFn();
        }
    };
}
