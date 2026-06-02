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

    const render = () => {
        // Fetch active tasks using store public API
        const activeTasks = stateStore.getActiveTodayTasks(new Date());

        const urgentCount = activeTasks.filter(t => t.priority === 'urgent').length;
        const totalCount = activeTasks.length;

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
        const defaultStartVal = getLocalISOString(nextHourDate);
        const defaultEndVal = getLocalISOString(new Date(nextHourDate.getTime() + 60 * 60 * 1000));
        
        if (!lastAutoEndTime) {
            lastAutoEndTime = defaultEndVal;
        }

        container.innerHTML = `
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
                    <div class="glass-card" style="padding: 8px 16px; min-width: 100px; text-align: center; border-color: var(--danger-light); background: rgba(235, 94, 85, 0.05);">
                        <div style="font-size: 0.75rem; color: var(--danger); font-weight: 600;">확인필요</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: var(--danger); margin-top: 4px;">${urgentCount}개</div>
                    </div>
                </div>
            </div>

            <!-- Manual Task Addition Form Card -->
            <div class="glass-card" style="padding: 1.5rem; margin-bottom: 24px;">
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
                    
                    <!-- Row 2: Category & Times & Button -->
                    <div style="display: grid; grid-template-columns: 1fr 1.2fr 1.2fr auto; gap: 12px; align-items: end;" class="task-form-grid">
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">구분</label>
                            <select id="task-category-input" style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                <option value="memo" selected>메모</option>
                                <option value="consult">상담예약</option>
                                <option value="check">확인필요</option>
                                <option value="closing">마감체크</option>
                            </select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">시작 시각</label>
                            <input type="datetime-local" id="task-start-input" value="${defaultStartVal}" required style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; outline: none;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">종료 시각</label>
                            <input type="datetime-local" id="task-end-input" value="${defaultEndVal}" required style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; outline: none;">
                        </div>
                        <button type="submit" class="btn btn-primary" style="height: 38px; padding: 0 24px; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; margin: 0;">추가</button>
                    </div>
                </form>
            </div>

            <!-- Tasks Queue Section -->
            <div class="glass-card" style="padding: 2rem; min-height: 400px; display: flex; flex-direction: column;">
                <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-hourglass-half" style="color: var(--accent);"></i>
                    운영 대기 업무 (Active Queue)
                </h3>
                
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px;">
                    ${
                        activeTasks.length === 0
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
                                ${activeTasks.map(task => {
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
                                    return `
                                        <div class="glass-card" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-color: rgba(255,255,255,0.06); transition: all 0.2s ease-in-out; background: rgba(255,255,255,0.01);" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'">
                                            <div style="display: flex; align-items: center; gap: 16px; flex-grow: 1;">
                                                <div style="flex-shrink: 0;">
                                                    ${getPriorityBadge(task.priority)}
                                                </div>
                                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${safeTitle}</div>
                                                    ${previewDescription ? `<div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; white-space: pre-wrap;">${safeDescription}</div>` : ''}
                                                </div>
                                            </div>
                                            
                                            <!-- Right side actions & metadata -->
                                            <div style="display: flex; align-items: center; gap: 20px; flex-shrink: 0;" class="task-action-wrapper">
                                                <div style="text-align: right; display: flex; flex-direction: column; gap: 4px; min-width: 70px;">
                                                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--accent);"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${formatTime(task.dueAt)}</div>
                                                    <div style="font-size: 0.72rem; color: var(--text-muted);">${safeType}</div>
                                                </div>
                                                
                                                <div style="display: flex; gap: 6px;">
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
                @media (max-width: 768px) {
                    .task-form-grid {
                        grid-template-columns: 1fr !important;
                        gap: 16px !important;
                    }
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
        if (e.type === 'change' && e.target && e.target.id === 'task-start-input') {
            const startInput = container.querySelector('#task-start-input');
            const endInput = container.querySelector('#task-end-input');
            if (startInput && endInput) {
                const currentEnd = endInput.value;
                if (!currentEnd || currentEnd === lastAutoEndTime) {
                    try {
                        const startDate = new Date(startInput.value);
                        if (!isNaN(startDate.getTime())) {
                            const newEndDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                            const newEndVal = getLocalISOString(newEndDate);
                            endInput.value = newEndVal;
                            lastAutoEndTime = newEndVal;
                        }
                    } catch (err) {
                        // ignore invalid dates
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
            const startInput = container.querySelector('#task-start-input');
            const endInput = container.querySelector('#task-end-input');

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

            const startAt = startInput.value ? new Date(startInput.value).toISOString() : new Date().toISOString();
            const endAt = endInput.value ? new Date(endInput.value).toISOString() : new Date().toISOString();
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
