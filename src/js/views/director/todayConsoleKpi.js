/**
 * todayConsoleKpi.js
 * Extracted KPI helper module for the Director Today Console (Phase 17G-5D)
 */

export const KPI_CONFIGS = [
    { id: 'memo', label: '운영메모', color: 'var(--primary)', icon: 'fa-note-sticky' },
    { id: 'absent', label: '결석 확인', color: 'var(--danger)', icon: 'fa-user-slash' },
    { id: 'attendance_warning', label: '특이출결', color: 'var(--danger)', icon: 'fa-triangle-exclamation' },
    { id: 'staff_warning', label: '특이근태', color: '#f1c40f', icon: 'fa-user-clock' },
    { id: 'billing', label: '수납확인', color: 'var(--success)', icon: 'fa-receipt' },
    { id: 'overdue', label: '미수납 확인', color: 'var(--danger)', icon: 'fa-file-invoice-dollar' },
    { id: 'schedule', label: '일정확인', color: 'var(--primary)', icon: 'fa-calendar-day' },
    { id: 'book_check', label: '교재 지급 확인', color: '#a55eea', icon: 'fa-book' },
    { id: 'book_billing', label: '교재 결제 확인', color: '#f1c40f', icon: 'fa-wallet' },
    { id: 'book_recommendation', label: '교재 확인', color: '#a55eea', icon: 'fa-book-open' }
];

/**
 * Resolves the KPI category for a given task.
 * Exposes exact categorization logic used for counts and filters.
 */
export function getTaskKpiCategory(task) {
    let cat = task.category || 'memo';
    if (task.source === 'system' || task.source === 'auto') {
        if (task.type === 'billing') {
            if (task.category === 'billing') cat = 'billing';
            else cat = 'overdue';
        } else if (task.type === 'attendance') {
            if (task.category === 'absent') cat = 'absent';
            else if (task.category === 'staff_warning') cat = 'staff_warning';
            else cat = 'attendance_warning';
        } else if (task.type === 'book') {
            if (task.category === 'book_check') cat = 'book_check';
            else if (task.category === 'book_billing') cat = 'book_billing';
            else if (task.category === 'book_recommendation') cat = 'book_recommendation';
        } else if (task.type === 'schedule') {
            if (task.category === 'schedule' || task.category === 'schedule_check') cat = 'schedule';
        }
    }
    return cat;
}

/**
 * Counts active tasks belonging to each KPI category.
 */
export function getKpiCounts(activeTasksList) {
    const counts = {
        memo: 0,
        absent: 0,
        attendance_warning: 0,
        staff_warning: 0,
        billing: 0,
        overdue: 0,
        schedule: 0,
        book_check: 0,
        book_billing: 0,
        book_recommendation: 0
    };

    activeTasksList.forEach(task => {
        const cat = getTaskKpiCategory(task);
        if (counts[cat] !== undefined) {
            counts[cat]++;
        }
    });

    return counts;
}

/**
 * Generates the HTML string for KPI cards row.
 */
export function renderKpiChipsHtml(activeTasksList, selectedCategoryFilter) {
    const counts = getKpiCounts(activeTasksList);

    return KPI_CONFIGS.map(card => {
        const isSelected = selectedCategoryFilter === card.id;
        const cardClass = isSelected ? 'kpi-chip-card selected' : 'kpi-chip-card';
        const textClass = isSelected ? 'color: var(--text-main); font-weight: 800;' : 'color: var(--text-muted); font-weight: 600;';
        
        const count = counts[card.id] || 0;
        const countBadgeStyle = count > 0 
            ? `background-color: ${card.color}; color: #fff; font-weight: 700;` 
            : `background-color: rgba(255,255,255,0.08); color: var(--text-muted);`;
        
        const tooltip = card.id === 'memo' 
            ? '오늘 등록된 운영 메모 및 할 일 수' 
            : `${card.label} (향후 비즈니스 연동 예정)`;

        return `
            <div class="${cardClass}" data-filter-id="${card.id}" title="${tooltip}" style="--card-color: ${card.color};">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <i class="fa-solid ${card.icon}" style="color: ${card.color}; font-size: 0.95rem; flex-shrink: 0;"></i>
                    <span style="font-size: 0.76rem; ${textClass} overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.label}</span>
                </div>
                <span class="badge" style="font-size: 0.72rem; padding: 3px 7px; border-radius: 12px; margin: 0; flex-shrink: 0; ${countBadgeStyle}">${count}</span>
            </div>
        `;
    }).join('');
}

/**
 * Filters the list of tasks by selected KPI category.
 */
export function filterTasksByKpi(tasks, selectedCategoryFilter) {
    if (selectedCategoryFilter === 'all') return tasks;
    return tasks.filter(task => {
        return getTaskKpiCategory(task) === selectedCategoryFilter;
    });
}
