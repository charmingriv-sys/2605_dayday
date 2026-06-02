import { stateStore } from '../../state.js';

const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export function renderTodayConsole(container) {
    const segmentId = 'academy_director_console'; // Segment-First Architecture Token
    let lastAutoEndTime = '';

    // Datetime default offset helper (Local ISO formatting)
    const getLocalISOString = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    };

    const getNextHourDate = () => {
        const date = new Date();
        date.setHours(date.getHours() + 1, 0, 0, 0);
        return date;
    };

    const decomposeDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const rawHours = date.getHours();
        const ampm = rawHours >= 12 ? 'PM' : 'AM';
        let hour = rawHours % 12;
        if (hour === 0) hour = 12;
        
        let min = 5 * Math.round(date.getMinutes() / 5);
        if (min === 60) {
            const adjustedDate = new Date(date.getTime() + 60 * 60 * 1000);
            adjustedDate.setMinutes(0, 0, 0);
            return decomposeDate(adjustedDate);
        }
        
        const minStr = String(min).padStart(2, '0');
        return {
            dateStr,
            ampm,
            hourStr: String(hour),
            minStr
        };
    };

    const composeISOString = (dateVal, ampmVal, hourVal, minuteVal) => {
        if (!dateVal) return new Date().toISOString();
        const [year, month, day] = dateVal.split('-').map(Number);
        let hour = Number(hourVal);
        if (ampmVal === 'PM' && hour < 12) {
            hour += 12;
        } else if (ampmVal === 'AM' && hour === 12) {
            hour = 0;
        }
        const min = Number(minuteVal);
        const dateObj = new Date(year, month - 1, day, hour, min, 0, 0);
        return dateObj.toISOString();
    };

    const loadEventToForm = (eventId, eventSource) => {
        // Query details directly from stateStore
        let foundEvent = null;
        if (eventSource === 'todayTask') {
            const tasks = stateStore.getTodayTasks();
            const task = tasks.find(t => t.id === eventId);
            if (task) {
                foundEvent = {
                    id: task.id,
                    source: 'todayTask',
                    title: task.title,
                    description: task.description || '',
                    rawContent: task.rawContent || task.description || task.title,
                    startsAt: task.startAt,
                    endsAt: task.endAt,
                    category: task.category || 'memo'
                };
            }
        } else if (eventSource === 'mockCalendar') {
            const events = stateStore.getMockCalendarEvents();
            const event = events.find(e => e.id === eventId);
            if (event) {
                foundEvent = {
                    id: event.id,
                    source: 'mockCalendar',
                    title: event.title,
                    description: event.description || '',
                    rawContent: `${event.title}\n${event.description || ''}`.trim(),
                    startsAt: event.startsAt,
                    endsAt: event.endsAt,
                    category: 'memo'
                };
            }
        }

        if (foundEvent) {
            const contentInput = container.querySelector('#task-content-input');
            const categoryInput = container.querySelector('#task-category-input');

            const startDateInput = container.querySelector('#task-start-date-input');
            const startAmpmInput = container.querySelector('#task-start-ampm-input');
            const startHourInput = container.querySelector('#task-start-hour-input');
            const startMinInput = container.querySelector('#task-start-minute-input');

            const endDateInput = container.querySelector('#task-end-date-input');
            const endAmpmInput = container.querySelector('#task-end-ampm-input');
            const endHourInput = container.querySelector('#task-end-hour-input');
            const endMinInput = container.querySelector('#task-end-minute-input');

            try {
                const startDecomp = decomposeDate(new Date(foundEvent.startsAt));
                const endDecomp = decomposeDate(new Date(foundEvent.endsAt));

                if (contentInput) contentInput.value = foundEvent.rawContent || '';
                if (categoryInput) categoryInput.value = foundEvent.category || 'memo';

                if (startDateInput) startDateInput.value = startDecomp.dateStr;
                if (startAmpmInput) startAmpmInput.value = startDecomp.ampm;
                if (startHourInput) startHourInput.value = startDecomp.hourStr;
                if (startMinInput) startMinInput.value = startDecomp.minStr;

                if (endDateInput) endDateInput.value = endDecomp.dateStr;
                if (endAmpmInput) endAmpmInput.value = endDecomp.ampm;
                if (endHourInput) endHourInput.value = endDecomp.hourStr;
                if (endMinInput) endMinInput.value = endDecomp.minStr;

                // Align lastAutoEndTime to loaded endsAt so subsequent start time changes auto-synchronize
                lastAutoEndTime = new Date(foundEvent.endsAt).toISOString();
            } catch (err) {
                // ignore invalid dates in event
            }
        }
    };

    const showDayEventsPopover = (dateStr) => {
        const popover = container.querySelector('#calendar-popover-container');
        const title = container.querySelector('#calendar-popover-title');
        const body = container.querySelector('#calendar-popover-body');
        if (!popover || !body || !title) return;

        const [y, m, d] = dateStr.split('-').map(Number);
        const cellStart = new Date(y, m - 1, d, 0, 0, 0, 0);
        const cellEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

        // Fetch events for this specific date range
        const dayEvents = stateStore.getCalendarEventsForRange
            ? stateStore.getCalendarEventsForRange(cellStart, cellEnd)
            : (stateStore.getTodayCalendarEvents ? stateStore.getTodayCalendarEvents(new Date()) : []);

        if (dayEvents.length === 0) {
            popover.style.display = 'none';
            return;
        }

        title.textContent = `${y}년 ${m}월 ${d}일 일정 목록`;

        const eventsHtml = dayEvents.map(event => {
            const isDone = event.status === 'done';
            let chipBg = 'rgba(9, 132, 227, 0.12)';
            let chipBorder = '1px solid rgba(9, 132, 227, 0.35)';
            let accentColor = 'var(--primary)';
            let prefix = '';
            let sourceBadge = '';

            if (isDone) {
                chipBg = 'rgba(100, 116, 139, 0.06)';
                chipBorder = '1px solid rgba(100, 116, 139, 0.15)';
                accentColor = 'var(--text-muted)';
            } else if (event.source === 'mockCalendar') {
                chipBg = 'rgba(241, 196, 15, 0.08)';
                chipBorder = '1px solid rgba(241, 196, 15, 0.25)';
                accentColor = '#f1c40f';
                const providerLabel = event.provider === 'google' ? 'Google' : (event.provider || 'mock');
                prefix = `<span style="font-size: 0.58rem; color: #f1c40f; font-weight: 700; margin-right: 3px; background: rgba(241, 196, 15, 0.15); padding: 1px 3px; border-radius: 2px;">${providerLabel}</span>`;
                sourceBadge = `<span style="font-size: 0.65rem; background: rgba(241,196,15,0.15); color: #f1c40f; padding: 2px 6px; border-radius: 4px; font-weight: 700;">로컬 캘린더</span>`;
            } else {
                sourceBadge = `<span style="font-size: 0.65rem; background: rgba(9,132,227,0.12); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-weight: 700;">운영 업무</span>`;
                if (event.category === 'check' || event.category === 'urgent') {
                    chipBg = 'rgba(214, 48, 49, 0.08)';
                    chipBorder = '1px solid rgba(214, 48, 49, 0.25)';
                    accentColor = 'var(--danger)';
                } else if (event.category === 'consult' || event.category === 'today') {
                    chipBg = 'rgba(0, 184, 148, 0.08)';
                    chipBorder = '1px solid rgba(0, 184, 148, 0.25)';
                    accentColor = 'var(--success)';
                } else if (event.category === 'closing') {
                    chipBg = 'rgba(165, 94, 234, 0.08)';
                    chipBorder = '1px solid rgba(165, 94, 234, 0.25)';
                    accentColor = '#a55eea';
                } else {
                    chipBg = 'rgba(9, 132, 227, 0.06)';
                    chipBorder = '1px solid rgba(9, 132, 227, 0.2)';
                    accentColor = 'var(--primary)';
                }
            }

            const formatHM = (isoStr) => {
                if (!isoStr) return '';
                try {
                    const date = new Date(isoStr);
                    const h = String(date.getHours()).padStart(2, '0');
                    const min = String(date.getMinutes()).padStart(2, '0');
                    return `${h}:${min}`;
                } catch (e) {
                    return '';
                }
            };

            const timeRange = `${formatHM(event.startsAt)} ~ ${formatHM(event.endsAt)}`;
            const textStyle = isDone ? 'text-decoration: line-through; color: var(--text-muted); opacity: 0.6;' : 'color: var(--text-main);';

            return `
                <div class="popover-event-item" data-id="${escapeHtml(event.id)}" data-source="${escapeHtml(event.source)}" style="padding: 10px; border-radius: 6px; background: ${chipBg}; border: ${chipBorder}; border-left: 4px solid ${accentColor}; cursor: pointer; user-select: none; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <div style="font-weight: 700; font-size: 0.82rem; ${textStyle} overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${prefix}${escapeHtml(event.title)}
                        </div>
                        ${sourceBadge}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted);">
                        <span><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${timeRange}</span>
                        ${event.status === 'done' ? '<span style="color: var(--success); font-weight: 700;">완료</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        body.innerHTML = eventsHtml;
        popover.style.display = 'flex';
    };

    const render = () => {
        // Fetch active tasks using store public API
        const activeTasks = stateStore.getActiveTodayTasks(new Date());
        const doneTasks = stateStore.getDoneTodayTasks ? stateStore.getDoneTodayTasks(new Date()) : [];

        const urgentCount = activeTasks.filter(t => t.priority === 'urgent').length;
        const totalCount = activeTasks.length + doneTasks.length;
        const doneCount = doneTasks.length;

        // Calculate Month Calendar Grid Days (Phase 8C-3D-Repair-A)
        const viewDate = new Date();
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth(); // 0-indexed

        // Calculate variable weeks grid (35 or 42 cells depending on the month layout)
        const firstDayOfMonth = new Date(year, month, 1);
        const startDayOfWeek = firstDayOfMonth.getDay();
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const numWeeks = Math.ceil((startDayOfWeek + daysInMonth) / 7);
        const totalCells = numWeeks * 7;

        const gridStart = new Date(year, month, 1 - startDayOfWeek, 0, 0, 0, 0);
        const gridEnd = new Date(gridStart.getTime() + (totalCells - 1) * 24 * 60 * 60 * 1000);
        gridEnd.setHours(23, 59, 59, 999);

        // Fetch events for this range
        const calendarEvents = stateStore.getCalendarEventsForRange
            ? stateStore.getCalendarEventsForRange(gridStart, gridEnd)
            : (stateStore.getTodayCalendarEvents ? stateStore.getTodayCalendarEvents(new Date()) : []);

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const daysOfWeekHtml = dayNames.map(name => `
            <div style="text-align: center; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); padding: 4px 0;">${name}</div>
        `).join('');

        const today = new Date();
        const todayY = today.getFullYear();
        const todayM = today.getMonth();
        const todayD = today.getDate();

        const cellsHtml = [];
        for (let i = 0; i < totalCells; i++) {
            const cellDate = new Date(gridStart.getTime() + i * 24 * 60 * 60 * 1000);
            const cellY = cellDate.getFullYear();
            const cellM = cellDate.getMonth();
            const cellD = cellDate.getDate();

            const isToday = cellY === todayY && cellM === todayM && cellD === todayD;
            const isCurrentMonth = cellM === month;

            // Filter events for this cell date (range overlap: cell starts at cellStart and ends at cellEnd)
            const cellStart = new Date(cellY, cellM, cellD, 0, 0, 0, 0).getTime();
            const cellEnd = new Date(cellY, cellM, cellD, 23, 59, 59, 999).getTime();

            const dayEvents = calendarEvents.filter(event => {
                try {
                    const eventStart = new Date(event.startsAt).getTime();
                    const eventEnd = new Date(event.endsAt).getTime();
                    if (isNaN(eventStart) || isNaN(eventEnd)) return false;
                    return eventStart <= cellEnd && eventEnd >= cellStart;
                } catch (err) {
                    return false;
                }
            });

            const maxVisibleEvents = 2;
            const visibleEvents = dayEvents.slice(0, maxVisibleEvents);
            const hiddenCount = dayEvents.length - maxVisibleEvents;

            const eventsHtml = visibleEvents.map(event => {
                const isDone = event.status === 'done';
                let chipBg = 'rgba(9, 132, 227, 0.12)';
                let chipBorder = '1px solid rgba(9, 132, 227, 0.35)';
                let accentColor = 'var(--primary)';
                let prefix = '';

                if (isDone) {
                    chipBg = 'rgba(255, 255, 255, 0.02)';
                    chipBorder = '1px solid rgba(255, 255, 255, 0.08)';
                    accentColor = 'var(--text-muted)';
                } else if (event.source === 'mockCalendar') {
                    chipBg = 'rgba(241, 196, 15, 0.12)';
                    chipBorder = '1px solid rgba(241, 196, 15, 0.35)';
                    accentColor = '#f1c40f';
                    const providerLabel = event.provider === 'google' ? 'Google' : (event.provider || 'mock');
                    prefix = `<span style="font-size: 0.58rem; color: #f1c40f; font-weight: 700; margin-right: 3px; background: rgba(241, 196, 15, 0.15); padding: 1px 3px; border-radius: 2px;">${providerLabel}</span>`;
                } else {
                    if (event.category === 'check' || event.category === 'urgent') {
                        chipBg = 'rgba(235, 94, 85, 0.12)';
                        chipBorder = '1px solid rgba(235, 94, 85, 0.35)';
                        accentColor = 'var(--danger)';
                    } else if (event.category === 'consult' || event.category === 'today') {
                        chipBg = 'rgba(46, 204, 113, 0.12)';
                        chipBorder = '1px solid rgba(46, 204, 113, 0.35)';
                        accentColor = 'var(--success)';
                    } else if (event.category === 'closing') {
                        chipBg = 'rgba(165, 94, 234, 0.12)';
                        chipBorder = '1px solid rgba(165, 94, 234, 0.35)';
                        accentColor = '#a55eea';
                    }
                }

                // Determine multi-day connection styles
                let borderRadius = '3px';
                let borderLeftStyle = `2px solid ${accentColor}`;
                
                try {
                    const eStart = new Date(event.startsAt);
                    const eEnd = new Date(event.endsAt);
                    if (eStart.toDateString() !== eEnd.toDateString()) {
                        const isFirst = cellDate.toDateString() === eStart.toDateString();
                        const isLast = cellDate.toDateString() === eEnd.toDateString();
                        if (isFirst) {
                            borderRadius = '3px 0 0 3px';
                            borderLeftStyle = `2px solid ${accentColor}`;
                        } else if (isLast) {
                            borderRadius = '0 3px 3px 0';
                            borderLeftStyle = 'none';
                        } else {
                            borderRadius = '0';
                            borderLeftStyle = 'none';
                        }
                    }
                } catch (err) {
                    // fallback
                }

                const textStyle = isDone ? 'text-decoration: line-through; color: var(--text-muted); opacity: 0.6;' : 'color: var(--text-main);';

                return `
                    <div class="calendar-event-chip" data-id="${escapeHtml(event.id)}" data-source="${escapeHtml(event.source)}" style="margin-top: 3px; padding: 2px 4px; border-radius: ${borderRadius}; background: ${chipBg}; border: ${chipBorder}; border-left: ${borderLeftStyle}; font-size: 0.65rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: flex-start; max-width: 100%;" title="${escapeHtml(event.title)} (${escapeHtml(event.description || '상세 없음')})">
                        ${prefix}
                        <span style="${textStyle} cursor: pointer; user-select: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(event.title)}</span>
                    </div>
                `;
            }).join('');

            const moreHtml = hiddenCount > 0 
                ? `<div style="font-size: 0.58rem; color: var(--text-muted); font-weight: 700; margin-top: 2px; padding-left: 4px;">+${hiddenCount}개</div>` 
                : '';

            let cellStyle = 'min-height: 70px; padding: 4px; display: flex; flex-direction: column; justify-content: flex-start; position: relative; border-bottom: 1px solid rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.03); overflow: hidden; cursor: pointer; user-select: none;';
            let dayNumStyle = 'font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%;';

            if (!isCurrentMonth) {
                cellStyle += ' opacity: 0.35; background: rgba(0, 0, 0, 0.1);';
                dayNumStyle += ' color: var(--text-muted);';
            } else {
                dayNumStyle += ' color: var(--text-main);';
            }

            if (isToday) {
                cellStyle += ' background: rgba(9, 132, 227, 0.04);';
                dayNumStyle += ' background: var(--primary); color: #fff; box-shadow: 0 0 8px var(--primary);';
            }

            cellsHtml.push(`
                <div class="calendar-day-cell" style="${cellStyle}" data-date="${cellY}-${String(cellM+1).padStart(2,'0')}-${String(cellD).padStart(2,'0')}">
                    <div>
                        <span style="${dayNumStyle}">${cellD}</span>
                    </div>
                    <div style="flex-grow: 1; overflow: hidden; display: flex; flex-direction: column;">
                        ${eventsHtml}
                        ${moreHtml}
                    </div>
                </div>
            `);
        }

        // Custom Priority badge helper (mapped to Categories for Phase 8C-3A)
        const getPriorityBadge = (priority) => {
            const safePriority = escapeHtml(priority);
            switch (priority) {
                case 'urgent':
                    return '<span class="badge badge-danger" style="padding: 4px 10px; font-weight: 700;">확인필요</span>';
                case 'today':
                    return '<span class="badge badge-info" style="padding: 4px 10px; font-weight: 700; background-color: var(--primary); color: #ffffff;">상담예약</span>';
                case 'closing':
                    return '<span class="badge" style="padding: 4px 10px; font-weight: 700; background-color: #a55eea; color: #ffffff;">마감체크</span>';
                case 'info':
                    return '<span class="badge badge-success" style="padding: 4px 10px; font-weight: 700;">메모</span>';
                default:
                    return `<span class="badge" style="padding: 4px 10px; font-weight: 700; background-color: var(--text-muted); color: #ffffff;">${safePriority}</span>`;
            }
        };

        // Date format helper
        const formatTime = (isoString) => {
            if (!isoString) return '';
            try {
                const date = new Date(isoString);
                return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            } catch (e) {
                return escapeHtml(isoString);
            }
        };

        const nextHourDate = getNextHourDate();
        const startComponents = decomposeDate(nextHourDate);
        const endComponents = decomposeDate(new Date(nextHourDate.getTime() + 60 * 60 * 1000));
        
        const defaultEndValISO = composeISOString(endComponents.dateStr, endComponents.ampm, endComponents.hourStr, endComponents.minStr);
        if (!lastAutoEndTime) {
            lastAutoEndTime = defaultEndValISO;
        }

        container.innerHTML = `
            <style>
                .popover-event-item {
                    transition: all 0.2s ease-in-out;
                }
                .popover-event-item:hover {
                    filter: brightness(0.96) contrast(1.02);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(9, 132, 227, 0.08);
                }
            </style>
            <!-- Header Summary Card (Rich Glassmorphism UI) -->
            <div class="glass-card" style="padding: 1.8rem; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <h2 style="margin: 0; font-size: 1.45rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-list-check" style="color: var(--primary);"></i>
                        오늘 원장 콘솔
                    </h2>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem;">오늘 처리할 운영 업무를 확인합니다.</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <div class="glass-card" style="padding: 8px 16px; min-width: 100px; text-align: center; border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02);">
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">총 업무</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-top: 4px;">${totalCount}개</div>
                    </div>
                    <div class="glass-card" style="padding: 8px 16px; min-width: 100px; text-align: center; border-color: var(--success-light); background: rgba(46, 204, 113, 0.05);">
                        <div style="font-size: 0.75rem; color: var(--success); font-weight: 600;">완료 업무</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--success); margin-top: 4px;">${doneCount}개</div>
                    </div>
                    <div class="glass-card" style="padding: 8px 16px; min-width: 100px; text-align: center; border-color: var(--danger-light); background: rgba(235, 94, 85, 0.05);">
                        <div style="font-size: 0.75rem; color: var(--danger); font-weight: 600;">확인필요</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--danger); margin-top: 4px;">${urgentCount}개</div>
                    </div>
                </div>
            </div>

            <!-- Main Grid Layout (Parallel Columns: Form & Calendar) -->
            <div class="today-console-workspace" style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; align-items: start; margin-bottom: 24px;">
                <!-- Left Column: Manual Task Form Card -->
                <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; height: 100%;">
                    <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0 0 1.2rem 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-circle-plus" style="color: var(--primary);"></i>
                        새로운 운영 메모 / 할 일 추가
                    </h3>
                    <form id="form-add-task" style="display: flex; flex-direction: column; gap: 16px;">
                        <!-- Row 1: Quick Memo Textarea -->
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">운영 메모 (첫 줄은 제목, 이후 줄은 설명)</label>
                            <textarea id="task-content-input" placeholder="오늘 메모할 내용을 입력하세요.&#10;예:&#10;신규 회원 상담 예약&#10;오후 3시에 방문하여 수강 일정 및 악기 대여 문의 예정" rows="4" required style="width: 100%; padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; resize: vertical; line-height: 1.5; outline: none;"></textarea>
                        </div>
                        
                        <!-- Row 2: Category & Submit Button -->
                        <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">구분</label>
                                <select id="task-category-input" style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                    <option value="memo" selected>메모</option>
                                    <option value="consult">상담예약</option>
                                    <option value="check">확인필요</option>
                                    <option value="closing">마감체크</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary" style="height: 38px; padding: 0 24px; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; margin: 0;">추가</button>
                        </div>

                        <!-- Row 3: Start and End Times -->
                        <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">시작 시각</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                    <input type="date" id="task-start-date-input" value="${startComponents.dateStr}" required style="flex: 1 1 120px; min-width: 120px; height: 38px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; outline: none;">
                                    <select id="task-start-ampm-input" style="flex: 0 0 auto; height: 38px; padding: 0 4px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                        <option value="AM" ${startComponents.ampm === 'AM' ? 'selected' : ''}>오전</option>
                                        <option value="PM" ${startComponents.ampm === 'PM' ? 'selected' : ''}>오후</option>
                                    </select>
                                    <select id="task-start-hour-input" style="flex: 0 0 auto; height: 38px; padding: 0 4px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                        ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `
                                            <option value="${h}" ${startComponents.hourStr === String(h) ? 'selected' : ''}>${h}시</option>
                                        `).join('')}
                                    </select>
                                    <select id="task-start-minute-input" style="flex: 0 0 auto; height: 38px; padding: 0 4px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                        ${Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => `
                                            <option value="${m}" ${startComponents.minStr === m ? 'selected' : ''}>${m}분</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">종료 시각</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                    <input type="date" id="task-end-date-input" value="${endComponents.dateStr}" required style="flex: 1 1 120px; min-width: 120px; height: 38px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; outline: none;">
                                    <select id="task-end-ampm-input" style="flex: 0 0 auto; height: 38px; padding: 0 4px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                        <option value="AM" ${endComponents.ampm === 'AM' ? 'selected' : ''}>오전</option>
                                        <option value="PM" ${endComponents.ampm === 'PM' ? 'selected' : ''}>오후</option>
                                    </select>
                                    <select id="task-end-hour-input" style="flex: 0 0 auto; height: 38px; padding: 0 4px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                        ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `
                                            <option value="${h}" ${endComponents.hourStr === String(h) ? 'selected' : ''}>${h}시</option>
                                        `).join('')}
                                    </select>
                                    <select id="task-end-minute-input" style="flex: 0 0 auto; height: 38px; padding: 0 4px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                        ${Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => `
                                            <option value="${m}" ${endComponents.minStr === m ? 'selected' : ''}>${m}분</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Right Column: Calendar Monthly Grid Section -->
                <div class="glass-card" style="padding: 1.5rem; min-height: 450px; display: flex; flex-direction: column;" id="calendar-timeline-section">
                    <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="display: flex; align-items: center; gap: 8px;">
                            <i class="fa-regular fa-calendar-days" style="color: var(--primary);"></i>
                            오늘 일정
                        </span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${year}년 ${month + 1}월</span>
                    </h3>

                    <div style="flex-grow: 1; display: flex; flex-direction: column; position: relative;">
                        <!-- Days of Week Header Grid -->
                        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 4px;" id="calendar-days-header">
                            ${daysOfWeekHtml}
                        </div>

                        <!-- Days Dates Grid -->
                        <div style="display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(${numWeeks}, 1fr); gap: 0; flex-grow: 1; border-top: 1px solid rgba(255,255,255,0.03); border-left: 1px solid rgba(255,255,255,0.03);" id="calendar-days-grid">
                            ${cellsHtml.join('')}
                        </div>

                        <!-- Overlay message for pending integrations -->
                        ${
                            calendarEvents.length === 0
                                ? `
                                <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.45); backdrop-filter: blur(1.5px); text-align: center; padding: 24px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);" id="calendar-skeleton-overlay">
                                    <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(9, 132, 227, 0.08); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; color: var(--primary); margin-bottom: 12px;">
                                        <i class="fa-solid fa-link-slash"></i>
                                    </div>
                                    <h4 style="margin: 0 0 6px 0; font-size: 0.92rem; font-weight: 700; color: var(--text-main);">캘린더 일정 연동 대기</h4>
                                    <p style="margin: 0; font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">이번 달 등록된 일정이 없습니다.</p>
                                </div>
                                `
                                : ''
                        }

                        <!-- Hidden Day Events Popover Modal (Phase 8C-3D-Repair-E) -->
                        <div id="calendar-popover-container" style="position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); backdrop-filter: blur(1.5px); z-index: 100; display: none; align-items: center; justify-content: center; padding: 16px; border-radius: 8px;">
                            <div class="glass-card" style="width: 100%; max-width: 320px; background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(9, 132, 227, 0.15); border-radius: 12px; padding: 16px; box-shadow: 0 10px 25px rgba(9, 132, 227, 0.08); backdrop-filter: blur(10px); display: flex; flex-direction: column; max-height: 90%; overflow: hidden;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(9, 132, 227, 0.08); padding-bottom: 8px; margin-bottom: 12px;">
                                    <h4 id="calendar-popover-title" style="margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--text-main);">일정 목록</h4>
                                    <button type="button" id="calendar-popover-close" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem; padding: 0 4px; display: flex; align-items: center; justify-content: center;">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                                <div id="calendar-popover-body" style="overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; gap: 8px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bottom Layout: Tasks Queue Section (Full Width Card) -->
            <div class="glass-card" style="padding: 1.8rem; min-height: 250px; display: flex; flex-direction: column; margin-bottom: 24px;" id="tasks-queue-section">
                <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-hourglass-half" style="color: var(--accent);"></i>
                    운영 대기 업무 (Active & Completed Queue)
                </h3>
                
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px;">
                    ${
                        (activeTasks.length + doneTasks.length) === 0
                            ? `
                            <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3rem 0; gap: 12px; color: var(--text-muted);">
                                <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(9, 132, 227, 0.06); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--primary);">
                                    <i class="fa-solid fa-check"></i>
                                </div>
                                <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">오늘 표시할 업무가 없습니다.</span>
                                <span style="font-size: 0.8rem;">모든 업무가 완료되었거나 대기 중인 일정이 없습니다.</span>
                            </div>
                            `
                            : `
                            <div style="display: flex; flex-direction: column; gap: 12px;" id="tasks-list-container">
                                ${[...activeTasks, ...doneTasks].map(task => {
                                    const safeId = escapeHtml(task.id);
                                    const safeTitle = escapeHtml(task.title);
                                    
                                    // Extract preview description (everything after the title line if duplicated)
                                    let previewDescription = '';
                                    if (task.description) {
                                        const descLines = task.description.split('\n');
                                        if (descLines.length > 0 && descLines[0].trim() === task.title.trim()) {
                                            previewDescription = descLines.slice(1).join('\n').trim();
                                        } else {
                                            previewDescription = task.description.trim();
                                        }
                                    }
                                    const safeDescription = escapeHtml(previewDescription);
                                    const safeType = escapeHtml(task.type);

                                    const isDone = task.status === 'done';

                                    // Card styles based on status
                                    const cardStyle = isDone
                                        ? `padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-color: rgba(255,255,255,0.04); transition: all 0.2s ease-in-out; background: rgba(255,255,255,0.01); opacity: 0.55;`
                                        : `padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-color: rgba(255,255,255,0.06); transition: all 0.2s ease-in-out; background: rgba(255,255,255,0.01);`;

                                    const titleStyle = isDone
                                        ? `font-weight: 700; color: var(--text-muted); font-size: 0.95rem; text-decoration: line-through;`
                                        : `font-weight: 700; color: var(--text-main); font-size: 0.95rem;`;

                                    const badgeHtml = isDone
                                        ? `<span class="badge badge-success" style="padding: 4px 10px; font-weight: 700; background-color: var(--success); color: #ffffff;">완료</span>`
                                        : getPriorityBadge(task.priority);

                                    const timeTextHtml = isDone
                                        ? `<div style="font-size: 0.8rem; font-weight: 600; color: var(--success);"><i class="fa-solid fa-circle-check" style="margin-right: 4px;"></i>${formatTime(task.completedAt)} 완료</div>`
                                        : `<div style="font-size: 0.8rem; font-weight: 600; color: var(--accent);"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${formatTime(task.dueAt)}</div>`;

                                    return `
                                        <div class="glass-card" style="${cardStyle}" ${!isDone ? `onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'"` : ''}>
                                            <div style="display: flex; align-items: center; gap: 16px; flex-grow: 1;">
                                                <div style="flex-shrink: 0;">
                                                    ${badgeHtml}
                                                </div>
                                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                                    <div style="${titleStyle}">${safeTitle}</div>
                                                    ${previewDescription ? `<div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; white-space: pre-wrap;">${safeDescription}</div>` : ''}
                                                </div>
                                            </div>
                                            
                                            <!-- Right side actions & metadata -->
                                            <div style="display: flex; align-items: center; gap: 20px; flex-shrink: 0;" class="task-action-wrapper">
                                                <div style="text-align: right; display: flex; flex-direction: column; gap: 4px; min-width: 80px;">
                                                    ${timeTextHtml}
                                                    <div style="font-size: 0.72rem; color: var(--text-muted);">${safeType}</div>
                                                </div>
                                                
                                                <div style="display: flex; gap: 6px; ${isDone ? 'visibility: hidden; pointer-events: none;' : ''}">
                                                    <button type="button" class="btn btn-sm" data-action="done" data-id="${safeId}" style="padding: 6px 10px; font-size: 0.75rem; margin: 0; background: var(--success); color: #fff; justify-content: center; border-radius: 4px;" title="완료 처리">
                                                        <i class="fa-solid fa-check"></i>
                                                    </button>
                                                    <button type="button" class="btn btn-sm" data-action="snooze" data-id="${safeId}" style="padding: 6px 10px; font-size: 0.75rem; margin: 0; background: var(--secondary); color: var(--text-main); justify-content: center; border-radius: 4px;" title="1시간 보류">
                                                        <i class="fa-solid fa-hourglass"></i>
                                                    </button>
                                                    <button type="button" class="btn btn-sm" data-action="dismiss" data-id="${safeId}" style="padding: 6px 10px; font-size: 0.75rem; margin: 0; background: var(--danger); color: #fff; justify-content: center; border-radius: 4px;" title="제외 및 숨김">
                                                        <i class="fa-solid fa-eye-slash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            `
                    }
                </div>
            </div>

            <style>
                @media (max-width: 992px) {
                    .today-console-workspace {
                        grid-template-columns: 1fr !important;
                        gap: 24px !important;
                    }
                }
                @media (max-width: 768px) {
                    .task-action-wrapper {
                        flex-direction: column !important;
                        align-items: flex-end !important;
                        gap: 10px !important;
                    }
                }
            </style>
        `;
    };

    // Shared Event Handler for event delegation
    const handleEvents = (e) => {
        // Automatic end-time synchronization when start time is updated
        if (e.type === 'change' && e.target && (
            e.target.id === 'task-start-date-input' ||
            e.target.id === 'task-start-ampm-input' ||
            e.target.id === 'task-start-hour-input' ||
            e.target.id === 'task-start-minute-input'
        )) {
            const startDateInput = container.querySelector('#task-start-date-input');
            const startAmpmInput = container.querySelector('#task-start-ampm-input');
            const startHourInput = container.querySelector('#task-start-hour-input');
            const startMinInput = container.querySelector('#task-start-minute-input');

            const endDateInput = container.querySelector('#task-end-date-input');
            const endAmpmInput = container.querySelector('#task-end-ampm-input');
            const endHourInput = container.querySelector('#task-end-hour-input');
            const endMinInput = container.querySelector('#task-end-minute-input');

            if (startDateInput && endDateInput) {
                const currentEndISO = composeISOString(
                    endDateInput.value,
                    endAmpmInput ? endAmpmInput.value : 'AM',
                    endHourInput ? endHourInput.value : '12',
                    endMinInput ? endMinInput.value : '00'
                );

                if (!lastAutoEndTime || currentEndISO === lastAutoEndTime) {
                    if (e.target.id === 'task-start-date-input') {
                        // Start Date updated manually: copy same date to end date, keep select times
                        endDateInput.value = startDateInput.value;
                        lastAutoEndTime = composeISOString(
                            endDateInput.value,
                            endAmpmInput ? endAmpmInput.value : 'AM',
                            endHourInput ? endHourInput.value : '12',
                            endMinInput ? endMinInput.value : '00'
                        );
                    } else {
                        // Start Time selectors updated manually: apply +1 hour policy
                        try {
                            const startISO = composeISOString(
                                startDateInput.value,
                                startAmpmInput ? startAmpmInput.value : 'AM',
                                startHourInput ? startHourInput.value : '12',
                                startMinInput ? startMinInput.value : '00'
                            );
                            const startDate = new Date(startISO);
                            if (!isNaN(startDate.getTime())) {
                                const newEndDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                                const newEndComponents = decomposeDate(newEndDate);
                                
                                if (endDateInput) endDateInput.value = newEndComponents.dateStr;
                                if (endAmpmInput) endAmpmInput.value = newEndComponents.ampm;
                                if (endHourInput) endHourInput.value = newEndComponents.hourStr;
                                if (endMinInput) endMinInput.value = newEndComponents.minStr;

                                lastAutoEndTime = composeISOString(
                                    newEndComponents.dateStr,
                                    newEndComponents.ampm,
                                    newEndComponents.hourStr,
                                    newEndComponents.minStr
                                );
                            }
                        } catch (err) {
                            // ignore invalid dates
                        }
                    }
                }
            }
            return;
        }

        // Form submit intercept
        if (e.type === 'submit' && e.target && e.target.id === 'form-add-task') {
            e.preventDefault();
            const contentInput = container.querySelector('#task-content-input');
            const categoryInput = container.querySelector('#task-category-input');

            const startDateInput = container.querySelector('#task-start-date-input');
            const startAmpmInput = container.querySelector('#task-start-ampm-input');
            const startHourInput = container.querySelector('#task-start-hour-input');
            const startMinInput = container.querySelector('#task-start-minute-input');

            const endDateInput = container.querySelector('#task-end-date-input');
            const endAmpmInput = container.querySelector('#task-end-ampm-input');
            const endHourInput = container.querySelector('#task-end-hour-input');
            const endMinInput = container.querySelector('#task-end-minute-input');

            const content = contentInput.value.trim();
            if (!content) return;

            // Extract title as first line, description as the entire raw input content
            const lines = content.split('\n');
            const title = lines[0].trim();
            const description = content;

            if (!title) return;

            const category = categoryInput.value;
            // Map category to priority
            let priority = 'info';
            if (category === 'consult') priority = 'today';
            else if (category === 'check') priority = 'urgent';
            else if (category === 'closing') priority = 'closing';

            const startAt = composeISOString(
                startDateInput ? startDateInput.value : '',
                startAmpmInput ? startAmpmInput.value : 'AM',
                startHourInput ? startHourInput.value : '12',
                startMinInput ? startMinInput.value : '00'
            );
            const endAt = composeISOString(
                endDateInput ? endDateInput.value : '',
                endAmpmInput ? endAmpmInput.value : 'AM',
                endHourInput ? endHourInput.value : '12',
                endMinInput ? endMinInput.value : '00'
            );
            const dueAt = startAt; // For sorting and selector backward compatibility

            stateStore.addTodayTask({
                title,
                description,
                rawContent: content,
                priority,
                category,
                startAt,
                endAt,
                dueAt,
                source: 'manual',
                type: 'memo',
                segment: segmentId,
                domain: 'academy',
                visibilityRoles: ['director']
            });
            contentInput.value = '';
            return;
        }

        // Click actions
        if (e.type === 'click') {
            // Intercept calendar event chip click first to open its day's popover (Phase 8C-3D-Repair-F)
            const chip = e.target.closest('.calendar-event-chip');
            if (chip) {
                e.stopPropagation();
                e.preventDefault();
                const cell = chip.closest('.calendar-day-cell');
                if (cell) {
                    const clickedDateStr = cell.dataset.date;
                    const startDateInput = container.querySelector('#task-start-date-input');
                    const endDateInput = container.querySelector('#task-end-date-input');
                    if (startDateInput && clickedDateStr) {
                        const oldStartVal = startDateInput.value;
                        startDateInput.value = clickedDateStr;
                        
                        // Dispatch change event to let start time listener trigger auto end time calculations
                        startDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // Also if the end date was same as old start date, update end date to clicked date
                        if (endDateInput && endDateInput.value === oldStartVal) {
                            endDateInput.value = clickedDateStr;
                            endDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                    // Since a chip exists, dayEvents.length is guaranteed to be > 0. Open the popover.
                    showDayEventsPopover(clickedDateStr);
                }
                return;
            }

            // Intercept popover event item click to load its values
            const popoverItem = e.target.closest('.popover-event-item');
            if (popoverItem) {
                e.stopPropagation();
                e.preventDefault();
                loadEventToForm(popoverItem.dataset.id, popoverItem.dataset.source);
                return;
            }

            // Intercept popover close button click
            const btnClose = e.target.closest('#calendar-popover-close');
            if (btnClose) {
                e.stopPropagation();
                e.preventDefault();
                const popover = container.querySelector('#calendar-popover-container');
                if (popover) popover.style.display = 'none';
                return;
            }

            // Intercept popover backdrop click
            if (e.target && e.target.id === 'calendar-popover-container') {
                e.stopPropagation();
                e.preventDefault();
                e.target.style.display = 'none';
                return;
            }

            // Calendar Day Cell Click Action
            const cell = e.target.closest('.calendar-day-cell');
            if (cell) {
                const clickedDateStr = cell.dataset.date;
                const startDateInput = container.querySelector('#task-start-date-input');
                const endDateInput = container.querySelector('#task-end-date-input');
                if (startDateInput && clickedDateStr) {
                    const oldStartVal = startDateInput.value;
                    startDateInput.value = clickedDateStr;
                    
                    // Dispatch change event to let start time listener trigger auto end time calculations
                    startDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Also if the end date was same as old start date, update end date to clicked date
                    if (endDateInput && endDateInput.value === oldStartVal) {
                        endDateInput.value = clickedDateStr;
                        // Dispatch change event on end date to update lastAutoEndTime
                        endDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
                
                // Show pop-over for the clicked day's events if it has at least one event
                const [y, m, d] = clickedDateStr.split('-').map(Number);
                const cellStart = new Date(y, m - 1, d, 0, 0, 0, 0);
                const cellEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
                const dayEvents = stateStore.getCalendarEventsForRange
                    ? stateStore.getCalendarEventsForRange(cellStart, cellEnd)
                    : [];

                if (dayEvents.length > 0) {
                    showDayEventsPopover(clickedDateStr);
                } else {
                    const popover = container.querySelector('#calendar-popover-container');
                    if (popover) {
                        popover.style.display = 'none';
                    }
                }
                return;
            }

            // Done Action
            const btnDone = e.target.closest('[data-action="done"]');
            if (btnDone) {
                const taskId = btnDone.dataset.id;
                stateStore.markTodayTaskDone(taskId);
                return;
            }

            // Snooze Action (1 hour)
            const btnSnooze = e.target.closest('[data-action="snooze"]');
            if (btnSnooze) {
                const taskId = btnSnooze.dataset.id;
                const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                stateStore.snoozeTodayTask(taskId, snoozedUntil);
                return;
            }

            // Dismiss Action
            const btnDismiss = e.target.closest('[data-action="dismiss"]');
            if (btnDismiss) {
                const taskId = btnDismiss.dataset.id;
                stateStore.dismissTodayTask(taskId);
                return;
            }
        }
    };

    render();

    // Bind event listeners to top-level container (Delegation)
    container.addEventListener('submit', handleEvents);
    container.addEventListener('click', handleEvents);
    container.addEventListener('change', handleEvents);

    // Subscribe to TodayTask store changes to reflect real-time queue states
    const unsubTodayTasks = stateStore.subscribe('TODAY_TASKS_CHANGED', render);

    // View cleanup to prevent event listener and subscriber memory leaks
    return () => {
        unsubTodayTasks();
        container.removeEventListener('submit', handleEvents);
        container.removeEventListener('click', handleEvents);
        container.removeEventListener('change', handleEvents);
    };
}
