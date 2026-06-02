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

    // Datetime default offset helper (Local ISO formatting)
    const getLocalISOString = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    };

    const render = () => {
        // Fetch active tasks using store public API
        const activeTasks = stateStore.getActiveTodayTasks(new Date());

        const urgentCount = activeTasks.filter(t => t.priority === 'urgent').length;
        const totalCount = activeTasks.length;

        // Custom Priority badge helper
        const getPriorityBadge = (priority) => {
            const safePriority = escapeHtml(priority);
            switch (priority) {
                case 'urgent':
                    return '<span class="badge badge-danger" style="padding: 4px 10px; font-weight: 700;">긴급</span>';
                case 'today':
                    return '<span class="badge badge-info" style="padding: 4px 10px; font-weight: 700; background-color: var(--primary); color: #ffffff;">오늘</span>';
                case 'closing':
                    return '<span class="badge" style="padding: 4px 10px; font-weight: 700; background-color: #a55eea; color: #ffffff;">마감</span>';
                case 'info':
                    return '<span class="badge badge-success" style="padding: 4px 10px; font-weight: 700;">안내</span>';
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

        const defaultDueVal = getLocalISOString(new Date(Date.now() + 60 * 60 * 1000)); // Default due is +1 hour

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
                        <div style="font-size: 0.75rem; color: var(--danger); font-weight: 600;">긴급 업무</div>
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
                <form id="form-add-task" style="display: grid; grid-template-columns: 1fr 1.2fr 0.8fr 1fr auto; gap: 12px; align-items: end;" class="task-form-grid">
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">제목</label>
                        <input type="text" id="task-title-input" placeholder="업무 제목" required style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">설명 (선택)</label>
                        <input type="text" id="task-desc-input" placeholder="세부 내용 입력" style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">우선순위</label>
                        <select id="task-priority-input" style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer;">
                            <option value="today" selected>오늘</option>
                            <option value="urgent">긴급</option>
                            <option value="closing">마감</option>
                            <option value="info">안내</option>
                        </select>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">마감 시각</label>
                        <input type="datetime-local" id="task-due-input" value="${defaultDueVal}" required style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0;">
                    </div>
                    <button type="submit" class="btn btn-primary" style="height: 38px; padding: 0 16px; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; margin: 0;">추가</button>
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
                                    const safeDescription = escapeHtml(task.description);
                                    const safeType = escapeHtml(task.type);
                                    return `
                                        <div class="glass-card" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-color: rgba(255,255,255,0.06); transition: all 0.2s ease-in-out; background: rgba(255,255,255,0.01);" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'">
                                            <div style="display: flex; align-items: center; gap: 16px; flex-grow: 1;">
                                                <div style="flex-shrink: 0;">
                                                    ${getPriorityBadge(task.priority)}
                                                </div>
                                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${safeTitle}</div>
                                                    ${task.description ? `<div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">${safeDescription}</div>` : ''}
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
        // Form submit intercept
        if (e.type === 'submit' && e.target && e.target.id === 'form-add-task') {
            e.preventDefault();
            const titleInput = container.querySelector('#task-title-input');
            const descInput = container.querySelector('#task-desc-input');
            const priorityInput = container.querySelector('#task-priority-input');
            const dueInput = container.querySelector('#task-due-input');

            const title = titleInput.value.trim();
            const description = descInput.value.trim();
            const priority = priorityInput.value;
            const dueAt = dueInput.value ? new Date(dueInput.value).toISOString() : new Date().toISOString();

            stateStore.addTodayTask({
                title,
                description,
                priority,
                dueAt,
                source: 'manual',
                type: 'memo',
                segment: segmentId,
                domain: 'academy',
                visibilityRoles: ['director']
            });
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

    // Subscribe to TodayTask store changes to reflect real-time queue states
    const unsubTodayTasks = stateStore.subscribe('TODAY_TASKS_CHANGED', render);

    // View cleanup to prevent event listener and subscriber memory leaks
    return () => {
        unsubTodayTasks();
        container.removeEventListener('submit', handleEvents);
        container.removeEventListener('click', handleEvents);
    };
}
