import { stateStore } from '../../state.js';
import { formatPhoneNumber } from './shared.js';

export function renderTeacherAttendance(container) {
    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    let selectedDate = formatDate(new Date());
    let selectedRangeMode = 'today';
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth() + 1;
    let customRangeStart = null;
    let customRangeEnd = null;
    let selectedTeacherId = '';
    let selectedStatus = '';

    // Slide drawer state
    let drawerTeacherId = null;
    let drawerYear = new Date().getFullYear();
    let drawerMonth = new Date().getMonth() + 1;

    const getRangeDates = (dateStr, mode) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const target = new Date(y, m - 1, d);
        const dates = [];
        if (mode === 'today') {
            dates.push(dateStr);
        } else if (mode === 'custom') {
            if (customRangeStart && customRangeEnd) {
                const [sy, sm, sd] = customRangeStart.split('-').map(Number);
                const [ey, em, ed] = customRangeEnd.split('-').map(Number);
                const start = new Date(sy, sm - 1, sd);
                const end = new Date(ey, em - 1, ed);
                let current = new Date(start);
                while (current <= end) {
                    dates.push(formatDate(current));
                    current.setDate(current.getDate() + 1);
                }
            } else {
                dates.push(dateStr);
            }
        } else if (mode === 'week') {
            const day = target.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(target);
            monday.setDate(target.getDate() + diffToMonday);
            for (let i = 0; i < 7; i++) {
                const current = new Date(monday);
                current.setDate(monday.getDate() + i);
                dates.push(formatDate(current));
            }
        } else if (mode === 'last_week') {
            const day = target.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(target);
            monday.setDate(target.getDate() + diffToMonday - 7);
            for (let i = 0; i < 7; i++) {
                const current = new Date(monday);
                current.setDate(monday.getDate() + i);
                dates.push(formatDate(current));
            }
        } else if (mode === 'month') {
            const year = target.getFullYear();
            const month = target.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            let current = new Date(firstDay);
            while (current <= lastDay) {
                dates.push(formatDate(current));
                current.setDate(current.getDate() + 1);
            }
        } else if (mode === 'last_month') {
            const year = target.getFullYear();
            const month = target.getMonth();
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            let current = new Date(firstDay);
            while (current <= lastDay) {
                dates.push(formatDate(current));
                current.setDate(current.getDate() + 1);
            }
        }
        return dates;
    };

    const getRangeLabelText = () => {
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        if (selectedRangeMode === 'today') {
            return `오늘: ${selectedDate}`;
        }
        if (selectedRangeMode === 'custom') {
            return `기간: ${customRangeStart || selectedDate} ~ ${customRangeEnd || selectedDate}`;
        }
        const modeKo = {
            'today': '오늘',
            'week': '이번주',
            'last_week': '저번주',
            'month': '이번달',
            'last_month': '지난달'
        };
        const start = rangeDates[0];
        const end = rangeDates[rangeDates.length - 1];
        return `${modeKo[selectedRangeMode] || '기간'}: ${start} ~ ${end}`;
    };

    const formatDetailedTimestamp = (ts, showDate = false) => {
        if (!ts) return '-';
        const date = new Date(ts);
        const MM = String(date.getMonth() + 1).padStart(2, '0');
        const DD = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return showDate ? `${MM}-${DD} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
    };

    // Calculate monthly summary statistics locally
    const getMonthlySummaryForTeacher = (teacherId, year, month) => {
        const logs = stateStore.getTeacherAttendanceLogs({ teacherId });
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        const monthlyLogs = logs.filter(log => log.date.startsWith(monthPrefix));
        
        let checkInDays = 0;
        let completedDays = 0;
        let openDays = 0;
        let totalMinutes = 0;

        monthlyLogs.forEach(log => {
            if (log.checkInAt) {
                checkInDays++;
                if (log.checkOutAt) {
                    completedDays++;
                    const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    totalMinutes += diffMins;
                } else {
                    openDays++;
                }
            }
        });

        const averageMinutes = completedDays > 0 ? Math.round(totalMinutes / completedDays) : 0;

        return {
            checkInDays,
            completedDays,
            openDays,
            totalMinutes,
            averageMinutes
        };
    };

    const render = () => {
        container.innerHTML = `
            <style>
                .ta-filters-card input.form-control,
                .ta-filters-card input,
                .ta-filters-card select {
                    height: 36px;
                    padding: 6px 12px;
                    font-size: 0.88rem;
                    line-height: 1.4;
                    box-sizing: border-box;
                }
                .ta-period-selector {
                    position: relative;
                    display: inline-block;
                }
                .ta-period-popover {
                    display: none;
                    position: absolute;
                    top: 60px;
                    left: 0;
                    z-index: 1000;
                    background: #ffffff !important;
                    opacity: 1 !important;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    padding: 12px;
                    min-width: 380px;
                    box-sizing: border-box;
                }
                @media (max-width: 480px) {
                    .ta-period-popover {
                        min-width: 320px;
                        width: calc(100vw - 32px);
                    }
                }
                .ta-preset-btn {
                    min-height: 28px;
                    padding: 0 10px;
                    font-size: 0.75rem;
                    border: 1px solid var(--border-color);
                    background: var(--bg-body);
                    color: var(--text-main);
                    cursor: pointer;
                    border-radius: 4px;
                    box-sizing: border-box;
                    transition: all 0.15s ease;
                    text-align: center;
                }
                .ta-preset-btn:hover {
                    background: rgba(9, 132, 227, 0.05) !important;
                    border-color: var(--primary) !important;
                }
                .ta-preset-btn.active {
                    background: var(--primary) !important;
                    color: #fff !important;
                    border-color: var(--primary) !important;
                }
                .ta-cal-day-cell {
                    height: 24px;
                    line-height: 24px;
                    font-size: 11px;
                    border-radius: 4px;
                    cursor: pointer;
                    color: var(--text-main);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }
                .ta-cal-day-cell:hover {
                    background: rgba(9, 132, 227, 0.08);
                }
                .ta-cal-day-cell.selected {
                    background: var(--primary) !important;
                    color: #fff !important;
                    font-weight: 700;
                }
                .ta-cal-day-cell.other-month {
                    color: var(--text-muted);
                    opacity: 0.4;
                }

                /* Custom Premium Tooltip styling */
                .ta-tooltip-container {
                    position: relative;
                    display: inline-block;
                }
                .ta-tooltip-text {
                    visibility: hidden;
                    width: 200px;
                    background-color: #2d3436 !important;
                    color: #ffffff !important;
                    text-align: center;
                    border-radius: 6px;
                    padding: 8px 12px;
                    position: absolute;
                    z-index: 1005;
                    top: 100%;
                    right: 0;
                    left: auto;
                    margin-left: 0;
                    margin-top: 6px;
                    opacity: 0;
                    transition: opacity 0.2s;
                    font-size: 11px;
                    line-height: 1.4;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
                    pointer-events: none;
                    font-weight: 500;
                    white-space: normal;
                }
                .ta-tooltip-container:hover .ta-tooltip-text {
                    visibility: visible;
                    opacity: 1;
                }
                @media (max-width: 480px) {
                    .ta-tooltip-text {
                        display: none !important;
                    }
                }

                /* Inspector slide Drawer */
                .ta-inspector-panel {
                    position: fixed;
                    top: 0;
                    right: 0;
                    display: flex;
                    flex-direction: column;
                    width: min(460px, 94vw);
                    height: 100vh;
                    z-index: 1001;
                    transform: translateX(110%);
                    transition: transform .22s ease;
                    border-left: 1px solid var(--border-color);
                    background: #ffffff !important;
                    box-shadow: -10px 0 30px rgba(0,0,0,0.15);
                }
                .ta-inspector-panel.open {
                    transform: translateX(0);
                }
                .ta-drawer-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 1000;
                    display: none;
                    background: rgba(0,0,0,0.3);
                }
                .ta-drawer-backdrop.open {
                    display: block;
                }
                .ta-drawer-close {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 32px;
                    height: 32px;
                    border: 1px solid var(--border-color);
                    border-radius: 50%;
                    background: var(--bg-card);
                    display: grid;
                    place-items: center;
                    font-size: 1.2rem;
                    font-weight: 700;
                    cursor: pointer;
                    color: var(--text-main);
                    border-color: var(--border-color);
                }
                .ta-inspector-head {
                    padding: 20px 48px 16px 20px;
                    border-bottom: 1px solid var(--border-color);
                    background: var(--bg-body);
                }
                .ta-profile-main {
                    display: flex;
                    flex-direction: column;
                }
                .ta-profile-main strong {
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .ta-profile-main span {
                    font-size: 13px;
                    color: var(--text-muted);
                }
                .ta-inspector-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    background: #ffffff;
                }
                .ta-drawer-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
            </style>

            <!-- 1. KPI Cards Grid -->
            <div class="metrics-grid">
                <div class="glass-card metric-card">
                    <div class="metric-icon purple">
                        <i class="fa-solid fa-chalkboard-user"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-checked-in">오늘 출근</span>
                        <span class="metric-value" id="kpi-checked-in">0명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon red">
                        <i class="fa-solid fa-user-slash"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-absent">오늘 미출근</span>
                        <span class="metric-value" id="kpi-absent">0명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon green">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-checked-out">퇴근 완료</span>
                        <span class="metric-value" id="kpi-checked-out">0명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon cyan">
                        <i class="fa-solid fa-business-time"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-working">미퇴근</span>
                        <span class="metric-value" id="kpi-working">0명</span>
                    </div>
                </div>
            </div>

            <!-- 2. Filters Card -->
            <div class="glass-card ta-filters-card" style="margin-bottom: 2rem; padding: 1.2rem 1.8rem;">
                <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
                    
                    <!-- Period selector -->
                    <div class="form-group ta-period-selector" style="margin-bottom: 0; flex-grow: 1; min-width: 260px; position: relative;">
                        <label style="font-weight: 600; font-size: 0.8rem; display: block; margin-bottom: 4px;">날짜/기간 선택</label>
                        <button type="button" id="ta-period-btn" class="form-control" style="width: 100%; height: 36px; text-align: left; background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; color: var(--text-main); font-weight: 600; display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 0 12px; box-sizing: border-box;">
                            <span id="ta-period-label">${getRangeLabelText()}</span>
                            <span style="font-size: 10px; color: var(--text-muted);">▼</span>
                        </button>
                        
                        <!-- Popover panel -->
                        <div id="ta-period-popover" class="ta-period-popover" style="display: none; position: absolute; top: 60px; left: 0; z-index: 1000; background: #ffffff !important; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: var(--shadow-md); padding: 12px; min-width: 380px; box-sizing: border-box; max-width: calc(100vw - 32px);">
                            <div style="display: flex; gap: 12px;">
                                <!-- Left: Mini Calendar -->
                                <div class="ta-mini-datepicker-calendar" style="flex: 1;">
                                    <div class="calendar-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                        <button type="button" id="ta-cal-prev-btn" style="border: none; background: transparent; cursor: pointer; padding: 4px; font-weight: 700; color: var(--text-main);">〈</button>
                                        <span id="ta-cal-month-label" style="font-size: 13px; font-weight: 700; color: var(--text-main);"></span>
                                        <button type="button" id="ta-cal-next-btn" style="border: none; background: transparent; cursor: pointer; padding: 4px; font-weight: 700; color: var(--text-main);">〉</button>
                                    </div>
                                    <!-- Days grid header -->
                                    <div class="calendar-grid-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">
                                        <span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span style="color: #e74c3c;">일</span>
                                    </div>
                                    <!-- Days grid cells -->
                                    <div id="ta-cal-days-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center;">
                                        <!-- filled dynamically -->
                                    </div>
                                    
                                    <div class="manual-date-picker" style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">직접 기간 선택</span>
                                        <div style="display: flex; align-items: center; gap: 4px;">
                                            <input type="date" id="ta-start-date" value="${customRangeStart || selectedDate}" class="form-control" style="width: 115px; height: 28px; font-size: 11px; padding: 0 6px; box-sizing: border-box;">
                                            <span style="font-size: 11px; color: var(--text-muted);">~</span>
                                            <input type="date" id="ta-end-date" value="${customRangeEnd || selectedDate}" class="form-control" style="width: 115px; height: 28px; font-size: 11px; padding: 0 6px; box-sizing: border-box;">
                                            <button type="button" id="ta-custom-range-apply-btn" class="btn btn-primary" style="height: 28px; font-size: 11px; padding: 0 8px; min-width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700;">적용</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Right: Preset Buttons (Vertical) -->
                                <div class="ta-quick-presets" style="width: 90px; border-left: 1px solid var(--border-color); padding-left: 12px; display: flex; flex-direction: column; gap: 6px; justify-content: center;">
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'today' ? 'active' : ''}" data-range="today">오늘</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'week' ? 'active' : ''}" data-range="week">이번주</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'last_week' ? 'active' : ''}" data-range="last_week">저번주</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'month' ? 'active' : ''}" data-range="month">이번달</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'last_month' ? 'active' : ''}" data-range="last_month">지난달</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; flex-grow: 1; min-width: 150px;">
                        <label for="filter-teacher" style="font-weight: 600; font-size: 0.8rem;">강사 선택</label>
                        <select id="filter-teacher" class="form-control" style="padding: 8px 12px; font-size: 0.88rem;">
                            <option value="">전체 강사</option>
                            ${stateStore.getTeachers().map(t => `<option value="${t.id}" ${t.id === selectedTeacherId ? 'selected' : ''}>${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0; flex-grow: 1; min-width: 150px;">
                        <label for="filter-status" style="font-weight: 600; font-size: 0.8rem;">상태 선택</label>
                        <select id="filter-status" class="form-control" style="padding: 8px 12px; font-size: 0.88rem;">
                            <option value="" ${selectedStatus === '' ? 'selected' : ''}>전체 상태</option>
                            <option value="미출근" ${selectedStatus === '미출근' ? 'selected' : ''}>미출근</option>
                            <option value="출근" ${selectedStatus === '출근' ? 'selected' : ''}>출근</option>
                            <option value="퇴근 완료" ${selectedStatus === '퇴근 완료' ? 'selected' : ''}>퇴근 완료</option>
                            <option value="미퇴근" ${selectedStatus === '미퇴근' ? 'selected' : ''}>미퇴근</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- 3. Instructor Work Hours Summary Section -->
            <div class="glass-card" style="margin-bottom: 2rem; padding: 1.2rem 1.8rem;">
                <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                    <i class="fa-solid fa-clock" style="color: var(--primary);"></i>
                    강사별 근무시간
                </h3>
                <div class="table-wrapper" style="margin-top: 0; overflow-x: auto;">
                    <table class="custom-table compact-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th>강사명</th>
                                <th>담당 악기/반</th>
                                <th>출근일수</th>
                                <th>총 근무시간</th>
                                <th>평균 근무시간</th>
                                <th style="position: relative;">
                                    미퇴근 횟수
                                    <span class="ta-tooltip-container" title="미퇴근 시 총 근무시간에 산정되지 않습니다." aria-label="미퇴근 시 총 근무시간에 산정되지 않습니다." style="display: inline-block; cursor: pointer; font-size: 11px; margin-left: 4px; color: var(--text-muted);">
                                        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                                        <span class="ta-tooltip-text" role="tooltip">미퇴근 시 총 근무시간에 산정되지 않습니다.</span>
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody id="teacher-summary-table-body">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 4. Table Card (Detailed Record) -->
            <div class="glass-card" style="display: flex; flex-direction: column;">
                <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                    <i class="fa-solid fa-business-time" style="color: var(--primary);"></i>
                    강사 근태 기록 현황
                </h3>
                <div class="table-wrapper" style="margin-top: 0; flex-grow: 1;">
                    <table class="custom-table" id="teacher-attendance-table">
                        <thead>
                            <tr>
                                <th>강사명</th>
                                <th>연락처</th>
                                <th>담당 악기/반</th>
                                <th>출근시각</th>
                                <th>퇴근시각</th>
                                <th>근무시간</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody id="teacher-attendance-table-body">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 5. Backdrop and Teacher Inspector Drawer -->
            <div class="ta-drawer-backdrop" id="ta-drawer-backdrop"></div>
            <div class="ta-inspector-panel" id="ta-drawer-panel">
                <button type="button" class="ta-drawer-close" id="ta-drawer-close">×</button>
                <div class="ta-inspector-head">
                    <div class="head-student-card">
                        <div class="avatar" id="ta-drawer-avatar" style="width: 44px; height: 44px; border-radius: 50%; background: var(--primary); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 1.25rem;">강</div>
                        <div class="ta-profile-main">
                            <strong id="ta-drawer-name">-</strong>
                            <span id="ta-drawer-phone" style="font-size: 12px; margin-top: 2px;">-</span>
                            <span id="ta-drawer-instrument" style="font-size: 12px;">-</span>
                        </div>
                    </div>
                </div>
                <div class="ta-inspector-body">
                    <!-- Monthly Summary -->
                    <div class="ta-drawer-section">
                        <div style="background: var(--bg-body); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">월 출근일</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-days">0일</strong>
                                </div>
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">월 총 근무시간</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-hours">0시간</strong>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">평균 근무시간</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-avg">평균 0분</strong>
                                </div>
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">미퇴근 횟수</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-misses">미퇴근 0회</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Monthly Calendar -->
                    <div class="ta-drawer-section">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <button type="button" id="ta-drawer-month-prev" class="ta-preset-btn" style="padding: 2px 8px; min-height: 24px; font-size: 11px;">〈</button>
                            <strong style="font-size: 14px; color: var(--text-main);" id="ta-drawer-month-label">2026년 6월</strong>
                            <button type="button" id="ta-drawer-month-next" class="ta-preset-btn" style="padding: 2px 8px; min-height: 24px; font-size: 11px;">〉</button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">
                            <span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span style="color: #e74c3c;">일</span>
                        </div>
                        <div id="ta-drawer-calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
                            <!-- Filled dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindPeriodEvents();
        bindDrawerEvents();

        container.querySelector('#filter-teacher').addEventListener('change', (e) => {
            selectedTeacherId = e.target.value;
            updateData();
        });
        container.querySelector('#filter-status').addEventListener('change', (e) => {
            selectedStatus = e.target.value;
            updateData();
        });

        updateData();
    };

    const drawCalendarGrid = (year, month) => {
        const grid = container.querySelector('#ta-cal-days-grid');
        const monthLabel = container.querySelector('#ta-cal-month-label');
        if (!grid || !monthLabel) return;
        
        monthLabel.textContent = `${year}년 ${month}월`;
        
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0).getDate();
        const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        
        const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
        
        let html = '';
        
        // Prev month days
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const prevM = month === 1 ? 12 : month - 1;
            const prevY = month === 1 ? year - 1 : year;
            const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            html += `<div class="ta-cal-day-cell other-month" data-date="${dateStr}">${d}</div>`;
        }
        
        // Current month days
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate ? 'selected' : '';
            const cellColorStyle = new Date(year, month - 1, d).getDay() === 0 ? 'color: #e74c3c;' : 'color: var(--text-main);';
            const selectedStyle = isSelected ? 'background: var(--primary) !important; color: #fff !important; font-weight: 700;' : '';
            html += `<div class="ta-cal-day-cell ${isSelected}" data-date="${dateStr}" style="${cellColorStyle} ${selectedStyle}">${d}</div>`;
        }
        
        // Next month days to fill 42 cells
        const totalFilled = startOffset + lastDay;
        const nextDays = 42 - totalFilled;
        for (let d = 1; d <= nextDays; d++) {
            const nextM = month === 12 ? 1 : month + 1;
            const nextY = month === 12 ? year + 1 : year;
            const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            html += `<div class="ta-cal-day-cell other-month" data-date="${dateStr}">${d}</div>`;
        }
        
        grid.innerHTML = html;
        
        grid.querySelectorAll('.ta-cal-day-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                selectedDate = cell.dataset.date;
                const parts = selectedDate.split('-');
                calYear = parseInt(parts[0]);
                calMonth = parseInt(parts[1]);
                selectedRangeMode = 'today';
                customRangeStart = null;
                customRangeEnd = null;
                
                const popover = container.querySelector('#ta-period-popover');
                if (popover) popover.style.display = 'none';
                
                const labelEl = container.querySelector('#ta-period-label');
                if (labelEl) labelEl.textContent = getRangeLabelText();
                
                updateData();
            });
        });
    };

    const bindPeriodEvents = () => {
        const periodBtn = container.querySelector('#ta-period-btn');
        const periodPopover = container.querySelector('#ta-period-popover');
        if (periodBtn && periodPopover) {
            periodBtn.addEventListener('click', (e) => {
                const isHidden = periodPopover.style.display === 'none';
                periodPopover.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    drawCalendarGrid(calYear, calMonth);
                }
            });
            
            periodPopover.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        const prevBtn = container.querySelector('#ta-cal-prev-btn');
        const nextBtn = container.querySelector('#ta-cal-next-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                calMonth--;
                if (calMonth < 1) {
                    calMonth = 12;
                    calYear--;
                }
                drawCalendarGrid(calYear, calMonth);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                calMonth++;
                if (calMonth > 12) {
                    calMonth = 1;
                    calYear++;
                }
                drawCalendarGrid(calYear, calMonth);
            });
        }

        container.querySelectorAll('.ta-quick-presets .ta-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;
                selectedRangeMode = range;
                customRangeStart = null;
                customRangeEnd = null;

                container.querySelectorAll('.ta-quick-presets .ta-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (periodPopover) periodPopover.style.display = 'none';
                
                const labelEl = container.querySelector('#ta-period-label');
                if (labelEl) labelEl.textContent = getRangeLabelText();

                updateData();
            });
        });

        const applyBtn = container.querySelector('#ta-custom-range-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const startVal = container.querySelector('#ta-start-date').value;
                const endVal = container.querySelector('#ta-end-date').value;
                if (startVal && endVal) {
                    selectedRangeMode = 'custom';
                    customRangeStart = startVal;
                    customRangeEnd = endVal;

                    container.querySelectorAll('.ta-quick-presets .ta-preset-btn').forEach(b => b.classList.remove('active'));

                    if (periodPopover) periodPopover.style.display = 'none';
                    
                    const labelEl = container.querySelector('#ta-period-label');
                    if (labelEl) labelEl.textContent = getRangeLabelText();

                    updateData();
                }
            });
        }
    };

    const bindDrawerEvents = () => {
        const closeBtn = container.querySelector('#ta-drawer-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeDrawer();
            });
        }

        const backdrop = container.querySelector('#ta-drawer-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                closeDrawer();
            });
        }

        const mPrev = container.querySelector('#ta-drawer-month-prev');
        if (mPrev) {
            mPrev.addEventListener('click', () => {
                drawerMonth--;
                if (drawerMonth < 1) {
                    drawerMonth = 12;
                    drawerYear--;
                }
                renderDrawerCalendar();
            });
        }

        const mNext = container.querySelector('#ta-drawer-month-next');
        if (mNext) {
            mNext.addEventListener('click', () => {
                drawerMonth++;
                if (drawerMonth > 12) {
                    drawerMonth = 1;
                    drawerYear++;
                }
                renderDrawerCalendar();
            });
        }
    };

    const openDrawer = (teacherId) => {
        drawerTeacherId = teacherId;
        const teacher = stateStore.getTeacher(teacherId);
        if (!teacher) return;

        const drawer = container.querySelector('#ta-drawer-panel');
        const backdrop = container.querySelector('#ta-drawer-backdrop');
        
        if (drawer) drawer.classList.add('open');
        if (backdrop) backdrop.classList.add('open');

        container.querySelector('#ta-drawer-name').textContent = teacher.name;
        container.querySelector('#ta-drawer-phone').textContent = formatPhoneNumber(teacher.phone || teacher.mobile || teacher.teacherPhone || teacher.contact || '-');
        container.querySelector('#ta-drawer-instrument').textContent = `담당: ${teacher.instrument || '미지정'}`;

        const summaryThisMonth = getMonthlySummaryForTeacher(teacherId, drawerYear, drawerMonth);
        renderDrawerCalendar();
    };

    const closeDrawer = () => {
        const drawer = container.querySelector('#ta-drawer-panel');
        const backdrop = container.querySelector('#ta-drawer-backdrop');
        if (drawer) drawer.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
        drawerTeacherId = null;
    };

    const renderDrawerCalendar = () => {
        if (!drawerTeacherId) return;

        container.querySelector('#ta-drawer-month-label').textContent = `${drawerYear}년 ${drawerMonth}월`;

        const summary = getMonthlySummaryForTeacher(drawerTeacherId, drawerYear, drawerMonth);
        
        let totalStr = '-';
        if (summary.totalMinutes > 0) {
            const hrs = Math.floor(summary.totalMinutes / 60);
            const mins = summary.totalMinutes % 60;
            totalStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
        } else if (summary.checkInDays > 0) {
            totalStr = '0시간';
        }

        let avgStr = '-';
        if (summary.averageMinutes > 0) {
            const hrs = Math.floor(summary.averageMinutes / 60);
            const mins = summary.averageMinutes % 60;
            avgStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
        } else if (summary.completedDays > 0) {
            avgStr = '0분';
        }

        container.querySelector('#ta-drawer-monthly-days').textContent = `${summary.checkInDays}일`;
        container.querySelector('#ta-drawer-monthly-hours').textContent = totalStr;
        container.querySelector('#ta-drawer-monthly-avg').textContent = `평균 ${avgStr}`;
        container.querySelector('#ta-drawer-monthly-misses').textContent = `미퇴근 ${summary.openDays}회`;

        const grid = container.querySelector('#ta-drawer-calendar-grid');
        if (!grid) return;

        const firstDayDay = new Date(drawerYear, drawerMonth - 1, 1).getDay();
        const startOffset = firstDayDay === 0 ? 6 : firstDayDay - 1;
        const lastDay = new Date(drawerYear, drawerMonth, 0).getDate();
        const prevMonthLastDay = new Date(drawerYear, drawerMonth - 1, 0).getDate();
        const todayStr = formatDate(new Date());
        const teacherLogs = stateStore.getTeacherAttendanceLogs({ teacherId: drawerTeacherId });

        let html = '';

        // Prev month days
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            html += `
                <div style="display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px; padding: 4px; min-height: 64px; box-sizing: border-box; font-size: 9px; line-height: 1.2; text-align: left; background: rgba(0,0,0,0.02); color: var(--text-muted); opacity: 0.3; pointer-events: none;">
                    <div style="font-weight: 700; font-size: 10px;">${d}</div>
                </div>
            `;
        }

        // Current month days
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${drawerYear}-${String(drawerMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;

            let cellState = 'absent';
            let cellTitle = '미출근';
            let checkInTimeStr = '';
            let checkOutTimeStr = '';
            let workingTimeStr = '';
            let cellStyle = 'background: rgba(149, 165, 166, 0.1); color: var(--text-main); border: 1px solid rgba(149, 165, 166, 0.15);';

            const log = teacherLogs.find(l => l.date === dateStr);

            if (log) {
                if (log.checkInAt) {
                    const checkInDate = new Date(log.checkInAt);
                    const ciH = String(checkInDate.getHours()).padStart(2, '0');
                    const ciM = String(checkInDate.getMinutes()).padStart(2, '0');
                    checkInTimeStr = `${ciH}:${ciM}`;
                    
                    if (log.checkOutAt) {
                        const checkOutDate = new Date(log.checkOutAt);
                        const coH = String(checkOutDate.getHours()).padStart(2, '0');
                        const coM = String(checkOutDate.getMinutes()).padStart(2, '0');
                        checkOutTimeStr = `${coH}:${coM}`;
                        
                        const diffMs = checkOutDate - checkInDate;
                        const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                        const hrs = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        workingTimeStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
                        cellStyle = 'background: rgba(46, 204, 113, 0.12); color: #27ae60; border: 1px solid rgba(46, 204, 113, 0.25);';
                        cellState = 'completed';
                        cellTitle = `출근: ${checkInTimeStr} | 퇴근: ${checkOutTimeStr} (${workingTimeStr})`;
                    } else {
                        checkOutTimeStr = '-';
                        workingTimeStr = '0시간';
                        if (dateStr === todayStr) {
                            workingTimeStr = '근무중';
                            cellStyle = 'background: rgba(46, 204, 113, 0.12); color: #27ae60; border: 1px solid rgba(46, 204, 113, 0.25);';
                            cellState = 'today-working';
                            cellTitle = `출근: ${checkInTimeStr} | 근무중`;
                        } else {
                            cellStyle = 'background: rgba(241, 196, 15, 0.12); color: #d35400; border: 1px solid rgba(241, 196, 15, 0.25);';
                            cellState = 'missed';
                            cellTitle = `출근: ${checkInTimeStr} | 퇴근 누락(미퇴근)`;
                        }
                    }
                }
            }

            const todayBorder = isToday ? 'border: 2px solid var(--primary) !important;' : '';
            const isFuture = dateStr > todayStr;

            html += `
                <div data-state="${cellState}" title="${cellTitle}" style="display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px; padding: 6px 4px; min-height: 64px; box-sizing: border-box; font-size: 10px; line-height: 1.2; text-align: left; cursor: help; ${cellStyle} ${todayBorder}">
                    <div style="font-weight: 700; font-size: 11px;">${d}</div>
                    ${checkInTimeStr ? `
                        <div style="font-weight: 800; font-size: 11px; text-align: center; margin-top: 6px; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${workingTimeStr}
                        </div>
                    ` : `
                        ${isFuture ? '' : '<div style="color: var(--text-muted); font-size: 10px; font-weight: 500; text-align: center; margin-top: 6px;">미출근</div>'}
                    `}
                </div>
            `;
        }

        // Next month days to fill 42 cells
        const totalFilled = startOffset + lastDay;
        const nextDays = 42 - totalFilled;
        for (let d = 1; d <= nextDays; d++) {
            html += `
                <div style="display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px; padding: 4px; min-height: 64px; box-sizing: border-box; font-size: 9px; line-height: 1.2; text-align: left; background: rgba(0,0,0,0.02); color: var(--text-muted); opacity: 0.3; pointer-events: none;">
                    <div style="font-weight: 700; font-size: 10px;">${d}</div>
                </div>
            `;
        }

        grid.innerHTML = html;
    };

    const updateData = () => {
        renderSummary();
        renderSummaryTable();
        renderTableBody();
        if (drawerTeacherId) {
            renderDrawerCalendar();
        }
    };

    const renderSummary = () => {
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const startDate = rangeDates[0];
        const endDate = rangeDates[rangeDates.length - 1];

        let summary;
        let labels = {};

        if (selectedRangeMode === 'today') {
            summary = stateStore.getTeacherAttendanceSummary(selectedDate);
            labels = {
                checkedIn: '오늘 출근',
                absent: '오늘 미출근',
                checkedOut: '퇴근 완료',
                working: '미퇴근'
            };
        } else {
            summary = stateStore.getTeacherAttendanceRangeSummary(startDate, endDate);
            labels = {
                checkedIn: '기간 출근',
                absent: '미출근',
                checkedOut: '퇴근 완료',
                working: '미퇴근'
            };
        }

        container.querySelector('#kpi-label-checked-in').textContent = labels.checkedIn;
        container.querySelector('#kpi-label-absent').textContent = labels.absent;
        container.querySelector('#kpi-label-checked-out').textContent = labels.checkedOut;
        container.querySelector('#kpi-label-working').textContent = labels.working;

        const unit = selectedRangeMode === 'today' ? '명' : '회';
        container.querySelector('#kpi-checked-in').textContent = `${summary.checkedInCount}${unit}`;
        container.querySelector('#kpi-absent').textContent = `${summary.absentCount}${unit}`;
        container.querySelector('#kpi-checked-out').textContent = `${summary.checkedOutCount}${unit}`;
        container.querySelector('#kpi-working').textContent = `${summary.workingCount}${unit}`;
    };

    const renderSummaryTable = () => {
        const tbody = container.querySelector('#teacher-summary-table-body');
        if (!tbody) return;

        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const startDate = rangeDates[0];
        const endDate = rangeDates[rangeDates.length - 1];

        const summaries = stateStore.getTeacherWorkHourSummary(startDate, endDate);

        // Filter: only show teachers with at least 1 check-in in the selected range
        let filteredSummaries = summaries.filter(s => s.checkInDays >= 1);
        if (selectedTeacherId) {
            filteredSummaries = filteredSummaries.filter(s => s.teacherId === selectedTeacherId);
        }

        if (filteredSummaries.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        일치하는 강사 요약 데이터가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredSummaries.map(s => {
            let totalStr = '-';
            if (s.totalMinutes > 0) {
                const hrs = Math.floor(s.totalMinutes / 60);
                const mins = s.totalMinutes % 60;
                totalStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
            } else if (s.checkInDays > 0) {
                totalStr = '0분';
            }

            let avgStr = '-';
            if (s.averageMinutes > 0) {
                const hrs = Math.floor(s.averageMinutes / 60);
                const mins = s.averageMinutes % 60;
                avgStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
            } else if (s.completedDays > 0) {
                avgStr = '0분';
            }

            return `
                <tr data-testid="teacher-summary-row-${s.teacherId}">
                    <td style="font-weight: 600; color: var(--text-main);">
                        <a href="#" class="ta-teacher-link" data-teacher-id="${s.teacherId}" style="text-decoration: underline; color: var(--primary); font-weight: 700; cursor: pointer;">${s.teacherName}</a>
                    </td>
                    <td><span class="badge badge-info" style="font-size: 0.8rem; background: rgba(9, 132, 227, 0.08); color: var(--primary);">${s.instrument}</span></td>
                    <td style="font-weight: 500;">${s.checkInDays}일</td>
                    <td style="font-weight: 500;">${totalStr}</td>
                    <td style="font-weight: 500;">평균 ${avgStr}</td>
                    <td style="font-weight: 500;">미퇴근 ${s.openDays}회</td>
                </tr>
            `;
        }).join('');
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#teacher-attendance-table-body');
        if (!tbody) return;

        const teachers = stateStore.getTeachers();
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const startDate = rangeDates[0];
        const endDate = rangeDates[rangeDates.length - 1];
        const todayStr = formatDate(new Date());

        let items = [];

        if (selectedRangeMode === 'today') {
            const logs = stateStore.getTeacherAttendanceLogs({ date: selectedDate });
            items = teachers.map(t => {
                const log = logs.find(l => l.teacherId === t.id);
                let checkInTime = '-';
                let checkOutTime = '-';
                let workingTime = '-';
                let status = '미출근';

                if (log) {
                    if (log.checkInAt) {
                        checkInTime = formatDetailedTimestamp(log.checkInAt, false);
                    }
                    if (log.checkOutAt) {
                        checkOutTime = formatDetailedTimestamp(log.checkOutAt, false);
                    }

                    if (log.checkInAt && log.checkOutAt) {
                        const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                        const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                        const hrs = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        workingTime = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
                        status = '퇴근 완료';
                    } else if (log.checkInAt) {
                        if (selectedDate === todayStr) {
                            status = '출근';
                        } else if (selectedDate < todayStr) {
                            status = '미퇴근';
                            workingTime = '0시간'; // 미퇴근 근무시간 0시간으로 노출
                        } else {
                            status = '출근';
                        }
                    }
                }

                return {
                    id: t.id,
                    name: t.name,
                    phone: t.phone || t.mobile || t.teacherPhone || t.contact || '-',
                    instrument: t.instrument || '미지정',
                    checkInTime,
                    checkOutTime,
                    workingTime,
                    status
                };
            }).filter(item => item.status !== '미출근');
        } else {
            const logs = stateStore.getTeacherAttendanceLogs().filter(log => log.date >= startDate && log.date <= endDate);
            
            logs.sort((a, b) => b.checkInAt.localeCompare(a.checkInAt));

            items = logs.map(log => {
                const t = teachers.find(teacher => teacher.id === log.teacherId);
                if (!t) return null;

                let checkInTime = formatDetailedTimestamp(log.checkInAt, true);
                let checkOutTime = formatDetailedTimestamp(log.checkOutAt, true);
                let workingTime = '-';
                let status = '미출근';

                if (log.checkInAt && log.checkOutAt) {
                    const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    const hrs = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    workingTime = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
                    status = '퇴근 완료';
                } else if (log.checkInAt) {
                    if (log.date === todayStr) {
                        status = '출근';
                    } else {
                        status = '미퇴근';
                        workingTime = '0시간'; // 미퇴근 근무시간 0시간으로 노출
                    }
                }

                return {
                    id: t.id,
                    logId: log.id,
                    name: t.name,
                    phone: t.phone || t.mobile || t.teacherPhone || t.contact || '-',
                    instrument: t.instrument || '미지정',
                    checkInTime,
                    checkOutTime,
                    workingTime,
                    status
                };
            }).filter(Boolean);
        }

        if (selectedTeacherId) {
            items = items.filter(item => item.id === selectedTeacherId);
        }
        if (selectedStatus) {
            items = items.filter(item => item.status === selectedStatus);
        }

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: rgba(255,255,255,0.05); margin-bottom: 8px; display: block;"></i>
                        일치하는 기록이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => {
            let badgeClass = 'badge-danger';
            if (item.status === '출근') {
                badgeClass = 'badge-info';
            } else if (item.status === '퇴근 완료') {
                badgeClass = 'badge-success';
            } else if (item.status === '미퇴근') {
                badgeClass = 'badge-warning';
            }

            const rowTestId = selectedRangeMode === 'today' 
                ? `teacher-row-${item.id}` 
                : `teacher-log-row-${item.logId}`;

            return `
                <tr data-testid="${rowTestId}">
                    <td style="font-weight: 600; color: var(--text-main);">
                        <a href="#" class="ta-teacher-link" data-teacher-id="${item.id}" style="text-decoration: underline; color: var(--primary); font-weight: 700; cursor: pointer;">${item.name}</a>
                    </td>
                    <td style="font-size: 0.85rem; font-weight: 500;">${formatPhoneNumber(item.phone)}</td>
                    <td><span class="badge badge-info" style="font-size: 0.8rem; background: rgba(9, 132, 227, 0.08); color: var(--primary);">${item.instrument}</span></td>
                    <td style="font-family: monospace; font-size: 0.9rem;">${item.checkInTime}</td>
                    <td style="font-family: monospace; font-size: 0.9rem;">${item.checkOutTime}</td>
                    <td style="font-weight: 500; font-size: 0.9rem;">${item.workingTime}</td>
                    <td><span class="badge ${badgeClass}">${item.status}</span></td>
                </tr>
            `;
        }).join('');
    };

    const handleDocumentClick = (e) => {
        const popover = container.querySelector('#ta-period-popover');
        const btn = container.querySelector('#ta-period-btn');
        if (popover && btn && !popover.contains(e.target) && !btn.contains(e.target)) {
            popover.style.display = 'none';
        }
    };
    document.addEventListener('click', handleDocumentClick);

    // Event delegation for opening drawer when instructor name is clicked
    const handleTeacherLinkClick = (e) => {
        const link = e.target.closest('.ta-teacher-link');
        if (link) {
            e.preventDefault();
            const teacherId = link.dataset.teacherId;
            openDrawer(teacherId);
        }
    };
    container.addEventListener('click', handleTeacherLinkClick);

    render();

    const unsubAttendance = stateStore.subscribe('TEACHER_ATTENDANCE_CHANGED', updateData);

    return () => {
        unsubAttendance();
        document.removeEventListener('click', handleDocumentClick);
        container.removeEventListener('click', handleTeacherLinkClick);
    };
}
