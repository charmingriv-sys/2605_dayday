import { stateStore } from '../../state.js';

export function renderDashboard(container) {
    const render = () => {
        const students = stateStore.getStudents();
        const teachers = stateStore.getTeachers();
        const payments = stateStore.getPayments();
        const classes = stateStore.getClasses();
        const attendance = stateStore.getAttendance();

        // 1. Calculate student status counts (attending, on_leave, withdrawn)
        // Attending counts include undefined/null/empty status for backward compatibility
        const attendingCount = students.filter(s => !s.status || s.status === 'attending').length;
        const leaveCount = students.filter(s => s.status === 'on_leave').length;
        const withdrawnCount = students.filter(s => s.status === 'withdrawn').length;

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const currentMonthPayments = payments.filter(p => p.month === currentMonth);
        const paidTuition = currentMonthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

        // 2. Separate unpaid tuition for attending/on_leave vs withdrawn students
        let unpaidTuition = 0;
        let withdrawnUnpaidTuition = 0;
        
        currentMonthPayments.filter(p => p.status === 'unpaid').forEach(p => {
            const student = students.find(s => s.id === p.studentId);
            const status = student ? (student.status || 'attending') : 'attending';
            if (status === 'withdrawn') {
                withdrawnUnpaidTuition += p.amount;
            } else {
                unpaidTuition += p.amount;
            }
        });

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
                <div class="glass-card metric-card" title="재원생 수는 현재 상태가 재원인 원생만 집계합니다. 휴원/퇴원 원생은 보조 요약에 별도 표시됩니다.">
                    <div class="metric-icon purple">
                        <i class="fa-solid fa-graduation-cap"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label">재원생 수</span>
                        <span class="metric-value">${attendingCount}명</span>
                        <span class="metric-sublabel" style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block;">휴원 ${leaveCount}명 | 퇴원 ${withdrawnCount}명</span>
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
                <div class="glass-card metric-card" title="납부 완료 금액은 결제 이력 기준입니다. 원생 상태 기준과 다를 수 있습니다.">
                    <div class="metric-icon green">
                        <i class="fa-solid fa-wallet"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label">이번 달 납부 완료</span>
                        <span class="metric-value">${paidTuition.toLocaleString()}원</span>
                        <span class="metric-sublabel" style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block;">결제 이력 기준</span>
                    </div>
                </div>
                <div class="glass-card metric-card" title="기본 미납 수강료는 운영 대상 원생 기준입니다. 퇴원생 미수금은 별도로 표시합니다.">
                    <div class="metric-icon red">
                        <i class="fa-solid fa-receipt"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label">이번 달 미납 수강료</span>
                        <span class="metric-value">${unpaidTuition.toLocaleString()}원</span>
                        <span class="metric-sublabel" style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block;">퇴원생 미수금 ${withdrawnUnpaidTuition.toLocaleString()}원 별도</span>
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
                                    ? `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem 0; font-size: 0.9rem;">오늘의 지각/결석 원생이 없습니다.</div>`
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