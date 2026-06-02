import { stateStore } from '../../state.js';

// Secure escape helper to prevent XSS in rendering
const escapeHtml = (str) => {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export function renderTodayConsole(container) {
    const segmentId = 'academy_director_console'; // Segment-First Architecture Token

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
                    return '<span class="badge badge-info" style="padding: 4px 10px; font-weight: 700; background-color: var(--primary);">오늘</span>';
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
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${activeTasks.map(task => {
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
                                            <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px;">
                                                <div style="font-size: 0.8rem; font-weight: 600; color: var(--accent);"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${formatTime(task.dueAt)}</div>
                                                <div style="font-size: 0.72rem; color: var(--text-muted);">${safeType}</div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            `
                    }
                </div>
            </div>
        `;
    };

    render();

    // Subscribe to TodayTask store changes to reflect real-time queue states
    const unsubTodayTasks = stateStore.subscribe('TODAY_TASKS_CHANGED', render);

    return () => {
        unsubTodayTasks();
    };
}
