import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { formatPhoneNumber, showKakaoTalkToast, showLocalConfirm } from './shared.js';

// --- TAB SCHEDULES: TEACHER SHIFTS & STUDENT TIMETABLE ---
export function renderSchedules(container) {
    let activeSubTab = 'shift_view'; // 'shift_view', 'shift_edit', or 'match'
    let currentFilterTeacherId = ''; // For filtering matching timetable
    let selectedTeacherId = 'T8'; // Default teacher for shift editor (정은비 T8)
    
    // For weekly/daily shifts view
    let shiftViewMode = 'week'; // 'week' or 'day'
    let selectedDateStr = '2026-05-18'; // For daily view default
    let showNotes = true; // Toggle for scheduleNotes panel
    let filterType = 'all'; // For daily view filter
    let filterSearchQuery = ''; // For daily view search
    
    // For Match View (Phase 7C)
    let matchViewMode = 'week'; // 'week' or 'day'
    let matchSelectedDateStr = '2026-05-18'; // Default date for daily match view
    let matchShowNotes = true; // Toggle for student scheduleNotes panel
    let matchShowLogs = true; // Toggle for daily schedule operation logs panel
    let matchFilterActiveOnly = false; // "당일 수업 있는 강사만" 필터
    let matchInstrumentFilter = 'all'; // 과목/악기 필터
    let matchSearchQuery = ''; // 강사명 검색
    let matchStatusText = ''; // 일정 이동 성공/실패 텍스트
    let matchStatusColor = ''; // 일정 이동 성공/실패 텍스트 색상
    
    // For weekly calendar reference
    let referenceDate = new Date('2026-05-18'); // Mon of the seed week
    
    // Temporary overrides Map for visual drag-and-drop simulation (Reset when DB changes or filter reset)
    let tempClassOverrides = {}; // Key: classId, Value: { dayOfWeek, time }
    
    const openSettingsModal = () => {
        const settings = stateStore.getSettings() || {};
        const html = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-gear" style="color: var(--primary);"></i> 시간표 운영 설정</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <form id="schedule-settings-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">시간표 시작 시간</label>
                            <input type="time" id="modal-sched-start-time" class="form-control" value="${settings.scheduleStartTime || '14:00'}" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">시간표 종료 시간</label>
                            <input type="time" id="modal-sched-end-time" class="form-control" value="${settings.scheduleEndTime || '21:00'}" required>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">시간표 칸 간격 (분)</label>
                        <select id="modal-sched-slot-minutes" class="form-control">
                            <option value="10" ${settings.scheduleSlotMinutes == 10 ? 'selected' : ''}>10분</option>
                            <option value="15" ${settings.scheduleSlotMinutes == 15 ? 'selected' : ''}>15분</option>
                            <option value="20" ${settings.scheduleSlotMinutes == 20 ? 'selected' : ''}>20분</option>
                            <option value="30" ${settings.scheduleSlotMinutes == 30 ? 'selected' : ''}>30분</option>
                            <option value="60" ${settings.scheduleSlotMinutes == 60 ? 'selected' : ''}>60분</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">시간표 노출 요일</label>
                        <div style="display: flex; gap: 12px; flex-wrap: wrap; background: rgba(255, 255, 255, 0.02); padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 0;">
                            ${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                                const dayKo = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }[day];
                                const checked = (settings.scheduleDays || []).includes(day) ? 'checked' : '';
                                return `
                                    <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer; color: var(--text-main); margin-bottom: 0;">
                                        <input type="checkbox" name="modal-sched-days" value="${day}" ${checked} style="margin: 0; width: 16px; height: 16px;">
                                        ${dayKo}
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" data-close-modal>취소</button>
                <button type="button" id="btn-save-schedule-settings" class="btn btn-primary" data-testid="save-schedule-settings-button">저장하기</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            const saveBtn = contentArea.querySelector('#btn-save-schedule-settings');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const startTime = contentArea.querySelector('#modal-sched-start-time').value;
                    const endTime = contentArea.querySelector('#modal-sched-end-time').value;
                    const slotMinutes = parseInt(contentArea.querySelector('#modal-sched-slot-minutes').value, 10);
                    const dayCheckboxes = contentArea.querySelectorAll('input[name="modal-sched-days"]:checked');
                    const scheduleDays = Array.from(dayCheckboxes).map(cb => cb.value);

                    stateStore.updateSettings({
                        scheduleStartTime: startTime,
                        scheduleEndTime: endTime,
                        scheduleSlotMinutes: slotMinutes,
                        scheduleDays: scheduleDays
                    });

                    showKakaoTalkToast("시간표 설정이 변경되었습니다.");
                    closeModal();
                    render(); // Refresh schedules view
                });
            }
        };

        openModal(html, onInitModal);
    };

    const render = () => {
        container.innerHTML = `
            <div class="schedules-view-container">
                <!-- Sub Tab Navigation Card -->
                <div class="glass-card" style="margin-bottom: 24px; padding: 1.2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                        <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                            <button class="btn ${activeSubTab === 'shift_view' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-shift-view">
                                <i class="fa-solid fa-calendar-week"></i> 강사 출근표 관리
                            </button>
                            <button class="btn ${activeSubTab === 'shift_edit' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-shift-edit">
                                <i class="fa-solid fa-clock-rotate-left"></i> 강사 출근시간 관리
                            </button>
                            <button class="btn ${activeSubTab === 'match' ? 'btn-primary' : 'btn-secondary'}" id="btn-subtab-match">
                                <i class="fa-solid fa-network-wired"></i> 강사-원생 시간표 관리
                            </button>
                            <button class="btn btn-secondary" id="btn-schedule-settings" data-testid="schedule-settings-button" style="display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-gear"></i> 설정
                            </button>
                        </div>
                        <div id="schedule-date-controls" style="display: ${(activeSubTab === 'shift_view' || activeSubTab === 'shift_edit' || (activeSubTab === 'match' && matchViewMode === 'week')) ? 'flex' : 'none'}; align-items: center; gap: 12px;">
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
        container.querySelector('#btn-schedule-settings').addEventListener('click', () => {
            openSettingsModal();
        });

        if (activeSubTab === 'shift_view' || activeSubTab === 'shift_edit' || (activeSubTab === 'match' && matchViewMode === 'week')) {
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

    // --- PRINT PREVIEW UTILITY (Phase 7E-1) ---
    const openPrintPreview = (type) => {
        // Ensure print CSS is injected
        if (!document.getElementById('print-preview-style')) {
            const style = document.createElement('style');
            style.id = 'print-preview-style';
            style.innerHTML = `
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #schedule-print-modal,
                    #schedule-print-modal * {
                        visibility: visible !important;
                    }
                    #schedule-print-modal {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: white !important;
                        z-index: 99999 !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    #schedule-print-modal > div {
                        box-shadow: none !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        max-height: 100% !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        border-radius: 0 !important;
                    }
                    #schedule-print-modal .btn,
                    #schedule-print-modal h3,
                    #schedule-print-modal select,
                    #schedule-print-modal label,
                    #schedule-print-modal > div > div:first-child {
                        display: none !important;
                    }
                    #print-preview-content {
                        background: white !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                        width: 100% !important;
                    }
                    .print-preview-a4 {
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        min-height: 0 !important;
                        page-break-inside: avoid !important;
                    }
                    .print-preview-a4 table {
                        table-layout: fixed !important;
                        width: 100% !important;
                    }
                    .print-preview-a4 th, .print-preview-a4 td {
                        word-break: break-all !important;
                    }
                    .print-layout-shell {
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 12px !important;
                        width: 100% !important;
                        align-items: flex-start !important;
                        box-sizing: border-box !important;
                    }
                    .print-main-column {
                        width: 70% !important;
                        flex-shrink: 0 !important;
                        box-sizing: border-box !important;
                    }
                    .print-side-column {
                        width: 28% !important;
                        flex-shrink: 0 !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 8px !important;
                    }
                    .print-notes-card, .print-logs-card {
                        width: 100% !important;
                        box-sizing: border-box !important;
                        margin-top: 0 !important;
                    }
                }

                .print-layout-shell {
                    display: flex !important;
                    flex-direction: row !important;
                    gap: 12px !important;
                    width: 100% !important;
                    align-items: flex-start !important;
                    box-sizing: border-box !important;
                }
                .print-main-column {
                    width: 70% !important;
                    flex-shrink: 0 !important;
                    box-sizing: border-box !important;
                }
                .print-side-column {
                    width: 28% !important;
                    flex-shrink: 0 !important;
                    box-sizing: border-box !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 8px !important;
                }
                .print-notes-card, .print-logs-card {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    margin-top: 0 !important;
                }

                /* Layout 1: Default A4 (Compact Style) */
                .print-layout-1 .print-preview-a4 {
                    width: 210mm;
                    min-height: 297mm;
                    padding: 10mm 12mm;
                    box-sizing: border-box;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .print-layout-1 .print-preview-a4 h1 {
                    font-size: 1.3rem !important;
                    margin-bottom: 2px !important;
                }
                .print-layout-1 .print-preview-a4 table {
                    table-layout: fixed !important;
                    width: 100% !important;
                    font-size: 0.7rem !important;
                    margin-top: 4px !important;
                }
                .print-layout-1 .print-preview-a4 th, .print-layout-1 .print-preview-a4 td {
                    padding: 1px 3px !important;
                    line-height: 1.05 !important;
                    word-break: break-all !important;
                }
                .print-layout-1 .print-preview-a4 td div {
                    font-size: 0.65rem !important;
                    padding: 0.5px 1.5px !important;
                }
                .print-layout-1 .print-notes-card,
                .print-layout-1 .print-logs-card {
                    margin-top: 0 !important;
                    padding: 6px 10px !important;
                    font-size: 0.7rem !important;
                }

                /* Layout 2: 2 copies per page */
                .print-layout-2 {
                    display: flex;
                    flex-direction: column;
                    gap: 15mm;
                    width: 210mm;
                }
                .print-layout-2 .print-preview-a4 {
                    width: 210mm;
                    height: 135mm;
                    padding: 8mm 12mm;
                    box-sizing: border-box;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    border: 1px dashed #ccc;
                    overflow: hidden;
                    page-break-inside: avoid !important;
                }
                .print-layout-2 .print-preview-a4 h1 {
                    font-size: 1.3rem !important;
                    margin-bottom: 2px !important;
                }
                .print-layout-2 .print-preview-a4 div {
                    font-size: 0.8rem !important;
                }
                .print-layout-2 .print-preview-a4 table {
                    font-size: 0.72rem !important;
                    margin-top: 4px !important;
                }
                .print-layout-2 .print-preview-a4 th, .print-layout-2 .print-preview-a4 td {
                    padding: 4px !important;
                }
                .print-layout-2 [data-testid="schedule-print-notes"],
                .print-layout-2 [data-testid="schedule-print-logs"] {
                    margin-top: 8px !important;
                    padding: 6px !important;
                    font-size: 0.72rem !important;
                }

                /* Layout 3: 3 copies per page */
                .print-layout-3 {
                    display: flex;
                    flex-direction: column;
                    gap: 8mm;
                    width: 210mm;
                }
                .print-layout-3 .print-preview-a4 {
                    width: 210mm;
                    height: 88mm;
                    padding: 5mm 10mm;
                    box-sizing: border-box;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    border: 1px dashed #ccc;
                    overflow: hidden;
                    page-break-inside: avoid !important;
                }
                .print-layout-3 .print-preview-a4 h1 {
                    font-size: 1.1rem !important;
                    margin-bottom: 2px !important;
                }
                .print-layout-3 .print-preview-a4 div {
                    font-size: 0.72rem !important;
                }
                .print-layout-3 .print-preview-a4 table {
                    font-size: 0.65rem !important;
                    margin-top: 2px !important;
                }
                .print-layout-3 .print-preview-a4 th, .print-layout-3 .print-preview-a4 td {
                    padding: 2px 3px !important;
                }
                .print-layout-3 [data-testid="schedule-print-notes"],
                .print-layout-3 [data-testid="schedule-print-logs"] {
                    margin-top: 4px !important;
                    padding: 4px !important;
                    font-size: 0.65rem !important;
                }
            `;
            document.head.appendChild(style);
        }

        const settings = stateStore.getSettings() || {};
        const academyName = settings.academyName || '음악학원';
        const scheduleDays = settings.scheduleDays || ["mon", "tue", "wed", "thu", "fri", "sat"];
        const scheduleStartTime = settings.scheduleStartTime || "14:00";
        const scheduleEndTime = settings.scheduleEndTime || "21:00";
        const scheduleSlotMinutes = settings.scheduleSlotMinutes || 30;

        let defaultLayout = 1;
        if (settings.printLayoutDefault === 'two-per-page') {
            defaultLayout = 2;
        } else if (settings.printLayoutDefault === 'three-per-page') {
            defaultLayout = 3;
        }

        const teachers = stateStore.getTeachers();
        const students = stateStore.getStudents();
        let activeTeachers = [];

        const getSlotsList = () => {
            const slots = [];
            const [startH, startM] = scheduleStartTime.split(':').map(Number);
            const [endH, endM] = scheduleEndTime.split(':').map(Number);
            let curr = startH * 60 + startM;
            const end = endH * 60 + endM;
            while (curr <= end) {
                const h = Math.floor(curr / 60);
                const m = curr % 60;
                slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                curr += scheduleSlotMinutes;
            }
            return slots;
        };

        const timeSlots = getSlotsList();
        const daysOfWeekKo = ['월', '화', '수', '목', '금', '토', '일'];
        const dayKoToEn = { '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun' };

        let titleText = '';
        let subtitleText = '';
        let filterSummaryText = '';
        let tableHtml = '';
        let notesHtml = '';
        let logsHtml = '';

        if (type === 'shifts') {
            titleText = `${academyName} 강사 출근표`;
            if (shiftViewMode === 'week') {
                const selectedTeacher = teachers.find(t => t.id === selectedTeacherId) || teachers[0] || { id: '', name: '', instrument: '', scheduleNotes: '' };
                const shifts = stateStore.getTeacherShifts();
                subtitleText = `[주간 보기] ${referenceDate.getFullYear()}년 ${referenceDate.getMonth() + 1}월 ${referenceDate.getDate()}일 주차`;
                filterSummaryText = `선택 강사: ${selectedTeacher.name || '미선택'} (${selectedTeacher.instrument || '과목 없음'})`;

                const weekDates = [];
                for (let i = 0; i < 7; i++) {
                    const d = new Date(referenceDate);
                    d.setDate(d.getDate() + i);
                    weekDates.push({
                        dateStr: d.toISOString().slice(0, 10),
                        dayKo: daysOfWeekKo[i],
                        dayEn: dayKoToEn[daysOfWeekKo[i]]
                    });
                }
                const activeWeekDates = weekDates.filter(wd => scheduleDays.includes(wd.dayEn));

                tableHtml = `
                    <table data-testid="schedule-print-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="border: 1px solid #111; padding: 6px; text-align: center; width: 80px;">시간</th>
                                ${activeWeekDates.map(wd => `<th style="border: 1px solid #111; padding: 6px; text-align: center;">${wd.dayKo} (${wd.dateStr.slice(5)})</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${timeSlots.map(time => {
                                return `
                                    <tr>
                                        <td style="border: 1px solid #111; padding: 6px; text-align: center; font-weight: bold; background-color: #fafafa;">${time}</td>
                                        ${activeWeekDates.map(wd => {
                                            const dayShift = shifts.find(s => s.teacherId === selectedTeacher.id && s.date === wd.dateStr);
                                            let isWorking = false;
                                            if (dayShift && dayShift.slots) {
                                                isWorking = dayShift.slots.includes(time);
                                            }
                                            return `
                                                <td style="border: 1px solid #111; padding: 6px; text-align: center; background-color: ${isWorking ? '#e2e8f0' : 'transparent'};">
                                                    ${isWorking ? '출근' : ''}
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;

                if (showNotes) {
                    const noteContent = selectedTeacher.scheduleNotes ? selectedTeacher.scheduleNotes.replace(/\n/g, '<br>') : '등록된 특이사항이 없습니다.';
                    notesHtml = `
                        <div class="print-notes-card" data-testid="schedule-print-notes" style="border: 1px solid #111; padding: 12px; border-radius: 4px; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                            <h4 style="margin: 0 0 6px 0; font-weight: bold;">[강사 특이사항]</h4>
                            <div><strong>${selectedTeacher.name} T:</strong> ${noteContent}</div>
                        </div>
                    `;
                }
            } else {
                subtitleText = `[일간 보기] 날짜: ${selectedDateStr}`;
                const parsedDate = new Date(selectedDateStr);
                const dayKo = daysOfWeekKo[parsedDate.getDay() === 0 ? 6 : parsedDate.getDay() - 1];
                filterSummaryText = `요일: ${dayKo}요일`;

                const shifts = stateStore.getTeacherShifts();
                const filteredTeachers = teachers.filter(t => {
                    if (filterType !== 'all') {
                        if (filterType === 'active') {
                            const dayShift = shifts.find(s => s.teacherId === t.id && s.date === selectedDateStr);
                            if (!dayShift || !dayShift.slots || dayShift.slots.length === 0) return false;
                        } else {
                            if (t.instrument !== filterType) return false;
                        }
                    }
                    if (filterSearchQuery) {
                        if (!t.name.toLowerCase().includes(filterSearchQuery.toLowerCase())) return false;
                    }
                    return true;
                });

                tableHtml = `
                    <table data-testid="schedule-print-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="border: 1px solid #111; padding: 6px; text-align: center; width: 80px;">시간</th>
                                ${filteredTeachers.map(t => `<th style="border: 1px solid #111; padding: 6px; text-align: center;">${t.name} (${t.instrument})</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${timeSlots.map(time => {
                                return `
                                    <tr>
                                        <td style="border: 1px solid #111; padding: 6px; text-align: center; font-weight: bold; background-color: #fafafa;">${time}</td>
                                        ${filteredTeachers.map(t => {
                                            const dayShift = shifts.find(s => s.teacherId === t.id && s.date === selectedDateStr);
                                            const isWorking = dayShift && dayShift.slots && dayShift.slots.includes(time);
                                            return `
                                                <td style="border: 1px solid #111; padding: 6px; text-align: center; background-color: ${isWorking ? '#e2e8f0' : 'transparent'};">
                                                    ${isWorking ? '출근' : ''}
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;

                if (showNotes) {
                    const notesList = filteredTeachers.filter(t => t.scheduleNotes);
                    const noteContent = notesList.length > 0 
                        ? notesList.map(t => `<div style="margin-bottom: 4px;"><strong>${t.name} T:</strong> ${t.scheduleNotes.replace(/\n/g, '<br>')}</div>`).join('')
                        : '<div style="color: #666; font-style: italic;">등록된 특이사항이 없습니다.</div>';
                    notesHtml = `
                        <div class="print-notes-card" data-testid="schedule-print-notes" style="border: 1px solid #111; padding: 12px; border-radius: 4px; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                            <h4 style="margin: 0 0 6px 0; font-weight: bold;">[강사 특이사항 목록]</h4>
                            <div>${noteContent}</div>
                        </div>
                    `;
                }
            }
        } else if (type === 'matches') {
            titleText = `${academyName} 강사-원생 수업 시간표`;
            if (matchViewMode === 'week') {
                subtitleText = `[주간 보기] ${referenceDate.getFullYear()}년 ${referenceDate.getMonth() + 1}월 ${referenceDate.getDate()}일 주차`;
                const filterTeacher = teachers.find(t => t.id === currentFilterTeacherId);
                filterSummaryText = filterTeacher ? `강사: ${filterTeacher.name} (${filterTeacher.instrument})` : '전체 강사';

                const weekDates = [];
                for (let i = 0; i < 7; i++) {
                    const d = new Date(referenceDate);
                    d.setDate(d.getDate() + i);
                    weekDates.push({
                        dateStr: d.toISOString().slice(0, 10),
                        dayKo: daysOfWeekKo[i],
                        dayEn: dayKoToEn[daysOfWeekKo[i]]
                    });
                }
                const activeWeekDates = weekDates.filter(wd => scheduleDays.includes(wd.dayEn));

                tableHtml = `
                    <table data-testid="schedule-print-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="border: 1px solid #111; padding: 6px; text-align: center; width: 80px;">시간</th>
                                ${activeWeekDates.map(wd => `<th style="border: 1px solid #111; padding: 6px; text-align: center;">${wd.dayKo} (${wd.dateStr.slice(5)})</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${timeSlots.map(time => {
                                return `
                                    <tr>
                                        <td style="border: 1px solid #111; padding: 6px; text-align: center; font-weight: bold; background-color: #fafafa;">${time}</td>
                                        ${activeWeekDates.map(wd => {
                                            const dayClasses = stateStore.getClasses().filter(c => c.dayOfWeek === wd.dayKo && c.time === time);
                                            const filteredClasses = currentFilterTeacherId ? dayClasses.filter(c => c.teacherId === currentFilterTeacherId) : dayClasses;
                                            
                                            const content = filteredClasses.map(c => {
                                                const s = students.find(std => std.id === c.studentId) || { name: '알수없음' };
                                                const t = teachers.find(tchr => tchr.id === c.teacherId);
                                                const teacherNameText = (t && t.name !== '알수없음') ? ` (${t.name})` : '';
                                                return `<div style="padding: 2px; font-weight: 500; font-size: 0.8rem; background-color: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 2px; border-radius: 2px;">
                                                    ${s.name}${teacherNameText}
                                                </div>`;
                                            }).join('');
                                            return `
                                                <td style="border: 1px solid #111; padding: 6px; vertical-align: top;">
                                                    ${content}
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;

                if (matchShowNotes) {
                    const studentNotesList = [];
                    stateStore.getClasses().forEach(c => {
                        const s = students.find(std => std.id === c.studentId);
                        if (s && s.scheduleNotes && !studentNotesList.some(item => item.id === s.id)) {
                            studentNotesList.push(s);
                        }
                    });
                    const noteContent = studentNotesList.length > 0
                        ? studentNotesList.map(s => `<div style="margin-bottom: 4px;"><strong>${s.name}:</strong> ${s.scheduleNotes.replace(/\n/g, '<br>')}</div>`).join('')
                        : '<div style="color: #666; font-style: italic;">등록된 특이사항이 없습니다.</div>';
                    notesHtml = `
                        <div class="print-notes-card" data-testid="schedule-print-notes" style="border: 1px solid #111; padding: 12px; border-radius: 4px; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                            <h4 style="margin: 0 0 6px 0; font-weight: bold;">[원생 일정 특이사항 목록]</h4>
                            <div>${noteContent}</div>
                        </div>
                    `;
                }
            } else {
                subtitleText = `[일간 보기] 날짜: ${matchSelectedDateStr}`;
                const parsedDate = new Date(matchSelectedDateStr);
                const dayKo = daysOfWeekKo[parsedDate.getDay() === 0 ? 6 : parsedDate.getDay() - 1];
                filterSummaryText = `요일: ${dayKo}요일`;

                const dayOfWeekEn = dayKoToEn[dayKo];
                const dayShifts = stateStore.getTeacherShifts().filter(s => s.date === matchSelectedDateStr);
                const todayClasses = stateStore.getTeacherStudentScheduleForDate(matchSelectedDateStr) || [];
                
                activeTeachers = teachers.filter(t => {
                    if (matchFilterActiveOnly) {
                        const hasClassToday = todayClasses.some(c => c.teacherId === t.id);
                        if (!hasClassToday) return false;
                    }
                    if (matchInstrumentFilter !== 'all' && t.instrument !== matchInstrumentFilter) {
                        return false;
                    }
                    if (matchSearchQuery && !t.name.toLowerCase().includes(matchSearchQuery.toLowerCase())) {
                        return false;
                    }
                    return true;
                });

                tableHtml = `
                    <table data-testid="schedule-print-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="border: 1px solid #111; padding: 6px; text-align: center; width: 80px;">시간</th>
                                ${activeTeachers.map(t => `<th style="border: 1px solid #111; padding: 6px; text-align: center;">${t.name} (${t.instrument})</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${timeSlots.map(time => {
                                return `
                                    <tr>
                                        <td style="border: 1px solid #111; padding: 6px; text-align: center; font-weight: bold; background-color: #fafafa;">${time}</td>
                                        ${activeTeachers.map(t => {
                                            const cellClasses = todayClasses.filter(c => c.teacherId === t.id && c.time === time);
                                            const cellContent = cellClasses.map(c => {
                                                const s = students.find(std => std.id === c.studentId) || { name: '알수없음' };
                                                return `<div style="font-weight: bold; font-size: 0.85rem; color: #1e293b;">${s.name}</div>`;
                                            }).join('');
                                            return `
                                                <td style="border: 1px solid #111; padding: 6px; text-align: center; vertical-align: middle;">
                                                    ${cellContent}
                                                </td>
                                            `;
                                        }).join('')}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;

                if (matchShowNotes) {
                    const studentNotesList = [];
                    todayClasses.forEach(c => {
                        const s = students.find(std => std.id === c.studentId);
                        if (s && s.scheduleNotes && !studentNotesList.some(item => item.id === s.id)) {
                            studentNotesList.push(s);
                        }
                    });
                    const noteContent = studentNotesList.length > 0
                        ? studentNotesList.map(s => `<div style="margin-bottom: 4px;"><strong>${s.name}:</strong> ${s.scheduleNotes.replace(/\n/g, '<br>')}</div>`).join('')
                        : '<div style="color: #666; font-style: italic;">등록된 특이사항이 없습니다.</div>';
                    notesHtml = `
                        <div class="print-notes-card" data-testid="schedule-print-notes" style="border: 1px solid #111; padding: 12px; border-radius: 4px; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                            <h4 style="margin: 0 0 6px 0; font-weight: bold;">[원생 일정 특이사항 목록]</h4>
                            <div>${noteContent}</div>
                        </div>
                    `;
                }

                if (matchShowLogs) {
                    const logs = stateStore.getScheduleOperationLogs(matchSelectedDateStr) || [];
                    logsHtml = `
                        <div class="print-logs-card" data-testid="schedule-print-logs" style="border: 1px solid #111; padding: 12px; border-radius: 4px; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                            <h4 style="margin: 0 0 6px 0; font-weight: bold;">[시간표 변경 이력 로그]</h4>
                            ${logs.length > 0 ? logs.map(log => {
                                const s = students.find(std => std.id === log.studentId) || { name: '알수없음' };
                                const beforeTeacher = teachers.find(t => t.id === log.before.teacherId) || { name: '알수없음' };
                                const afterTeacher = teachers.find(t => t.id === log.after.teacherId) || { name: '알수없음' };
                                const reason = log.before.teacherId !== log.after.teacherId ? '강사 및 시간 변경' : '시간 변경';
                                return `
                                    <div style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0; line-height: 1.4;">
                                        <span style="font-weight: bold; color: var(--primary);">${s.name}</span>:
                                        ${beforeTeacher.name} (${log.before.startTime}) &rarr; ${afterTeacher.name} (${log.after.startTime})
                                        <span style="color: #666; font-style: italic; font-size: 0.78rem;"> (사유: ${reason})</span>
                                    </div>
                                `;
                            }).join('') : '<div style="color: #666; font-style: italic;">이동 이력이 없습니다.</div>'}
                        </div>
                    `;
                }
            }
        }

        const modal = document.createElement('div');
        modal.id = 'schedule-print-modal';
        modal.className = 'modal-overlay show';
        modal.setAttribute('data-testid', 'schedule-print-modal');
        modal.style.cssText = `
            display: flex; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;
            opacity: 1; pointer-events: auto;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; width: 90%; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e0e0e0; background: #f8fafc;">
                     <div style="display: flex; align-items: center; gap: 16px;">
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #1e293b;">프린트 미리보기</h3>
                        <span id="print-export-status" data-testid="schedule-print-export-status" style="font-size: 0.85rem; font-weight: 600; color: var(--primary); display: none; padding: 4px 8px; background: #e0f2fe; border-radius: 4px;"></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label for="schedule-print-layout-select" style="display: none;">출력 배치:</label>
                            <select id="schedule-print-layout-select" data-testid="schedule-print-layout-select" class="form-control" style="display: none;">
                                <option value="1" data-testid="schedule-print-layout-option-1" selected>1개 크게 출력</option>
                            </select>
                            <span id="print-orientation-tip" data-testid="schedule-print-orientation-tip" style="font-size: 0.75rem; color: #6b7280; font-weight: 500; margin-left: 4px;"></span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary" id="btn-print-copy-image" data-testid="schedule-print-copy-image" style="display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-copy"></i> 이미지 복사
                            </button>
                            <button class="btn btn-secondary" id="btn-print-download-png" data-testid="schedule-print-download-png" style="display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-download"></i> PNG 다운로드
                            </button>
                            <button class="btn btn-primary" id="btn-print-confirm" data-testid="schedule-print-action" style="display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-print"></i> 인쇄
                            </button>
                            <button class="btn btn-secondary" id="btn-print-close" data-testid="schedule-print-close">닫기</button>
                        </div>
                    </div>
                </div>
                <div id="print-preview-content" data-testid="schedule-print-content" style="flex: 1; overflow-y: auto; padding: 40px; background: #f1f5f9; display: flex; justify-content: center;">
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const showExportStatus = (message, isSuccess = true) => {
            const statusEl = modal.querySelector('#print-export-status');
            if (!statusEl) return;
            statusEl.textContent = message;
            statusEl.style.display = 'inline-block';
            statusEl.style.color = isSuccess ? '#0369a1' : '#b91c1c';
            statusEl.style.background = isSuccess ? '#e0f2fe' : '#fee2e2';
            
            if (modal.__statusTimeout) clearTimeout(modal.__statusTimeout);
            modal.__statusTimeout = setTimeout(() => {
                statusEl.style.display = 'none';
            }, 4000);
        };

        const captureContentAsBlob = async () => {
            const containerEl = modal.querySelector('#print-preview-content');
            if (!containerEl) throw new Error('Capture target not found');

            const width = 800;
            const height = containerEl.scrollHeight || 1130;

            const styleEl = document.getElementById('print-preview-style');
            const stylesText = styleEl ? styleEl.innerHTML : '';

            const captureStyles = `
                * { box-sizing: border-box; }
                #print-preview-content {
                    background: #f1f5f9;
                    padding: 40px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100%;
                }
                .print-preview-a4 {
                    background: white;
                    width: 100%;
                    max-width: 720px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    color: #111;
                    margin-bottom: 20px;
                    padding: 20px;
                    border: 1px solid #ddd;
                }
                .print-layout-1 .print-preview-a4 {
                    min-height: 1000px;
                }
                .print-layout-2 {
                    display: flex;
                    flex-direction: column;
                    gap: 15mm;
                    width: 100%;
                    max-width: 720px;
                }
                .print-layout-2 .print-preview-a4 {
                    height: 500px;
                    overflow: hidden;
                }
                .print-layout-3 {
                    display: flex;
                    flex-direction: column;
                    gap: 8mm;
                    width: 100%;
                    max-width: 720px;
                }
                .print-layout-3 .print-preview-a4 {
                    height: 330px;
                    overflow: hidden;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1rem;
                    font-size: 0.85rem;
                }
                th, td {
                    border: 1px solid #111;
                    padding: 6px;
                    text-align: center;
                    vertical-align: middle;
                }
                thead tr {
                    background-color: #f1f5f9;
                }
                ${stylesText}
            `;

            const s = new XMLSerializer();
            const contentHtml = s.serializeToString(containerEl);

            const svgString = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                    <foreignObject width="100%" height="100%">
                        <style>${captureStyles}</style>
                        <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; font-family: sans-serif;">
                            ${contentHtml}
                        </div>
                    </foreignObject>
                </svg>
            `;

            return new Promise((resolve, reject) => {
                const img = new Image();
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    ctx.fillStyle = '#f1f5f9';
                    ctx.fillRect(0, 0, width, height);

                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas conversion failed'));
                        }
                    }, 'image/png');
                };

                img.onerror = (err) => {
                    URL.revokeObjectURL(url);
                    reject(err);
                };

                img.src = url;
            });
        };

        const recommendLandscape = false;

        const applyPrintOrientation = () => {
            let styleEl = document.getElementById('dynamic-print-orientation-style');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = 'dynamic-print-orientation-style';
                document.head.appendChild(styleEl);
            }
            styleEl.innerHTML = `
                @media print {
                    @page {
                        size: ${recommendLandscape ? 'landscape' : 'portrait'};
                        margin: 10mm;
                    }
                }
                ${recommendLandscape ? `
                    .print-layout-1 .print-preview-a4 {
                        width: 297mm !important;
                        min-height: 210mm !important;
                    }
                ` : `
                    .print-layout-1 .print-preview-a4 {
                        width: 210mm !important;
                        min-height: 297mm !important;
                    }
                `}
            `;
            
            const tipEl = modal.querySelector('#print-orientation-tip');
            if (tipEl) {
                tipEl.textContent = recommendLandscape ? '* 가로 인쇄 권장' : '* 세로 인쇄 권장';
            }
        };

        const updatePrintLayout = (count) => {
            const containerEl = modal.querySelector('#print-preview-content');
            if (!containerEl) return;
            
            const activeCount = 1;
            containerEl.className = `print-layout-${activeCount}`;
            
            let copiesHtml = '';
            for (let i = 1; i <= activeCount; i++) {
                copiesHtml += `
                    <div class="print-preview-a4" data-testid="schedule-print-copy" data-index="${i}" style="background: white; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.1); box-sizing: border-box; display: flex; flex-direction: column; color: #111; margin-bottom: 20px;">
                        <span data-testid="schedule-print-copy-index" data-index="${i}" style="display: none;"></span>
                        <div style="text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 8px;">
                            <h1 data-testid="schedule-print-title" style="margin: 0 0 6px 0; font-size: 1.8rem; font-weight: 800; color: #111;">${titleText}</h1>
                            <div style="font-size: 0.95rem; color: #444; font-weight: 500;">
                                ${subtitleText} | ${filterSummaryText}
                            </div>
                        </div>
                        <div class="print-layout-shell">
                            <div class="print-main-column">
                                ${tableHtml}
                            </div>
                            <div class="print-side-column">
                                ${notesHtml}
                                ${logsHtml}
                            </div>
                        </div>
                    </div>
                `;
            }
            containerEl.innerHTML = copiesHtml;
            applyPrintOrientation();
        };

        updatePrintLayout(defaultLayout);

        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${date}`;
        };

        const dateStr = (type === 'shifts') 
            ? (shiftViewMode === 'week' ? formatDate(referenceDate) : selectedDateStr)
            : (matchViewMode === 'week' ? formatDate(referenceDate) : matchSelectedDateStr);
        const filename = type === 'shifts' ? `teacher-shift-${dateStr}.png` : `teacher-student-schedule-${dateStr}.png`;

        const triggerDownload = (blob, filename) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        };

        const btnDownload = modal.querySelector('#btn-print-download-png');
        const btnCopy = modal.querySelector('#btn-print-copy-image');

        btnDownload.addEventListener('click', async () => {
            btnDownload.disabled = true;
            btnDownload.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 처리 중...`;
            showExportStatus('이미지 다운로드를 준비했습니다.', true);
            try {
                const blob = await captureContentAsBlob();
                triggerDownload(blob, filename);
                showExportStatus('이미지 다운로드를 준비했습니다.', true);
            } catch (err) {
                console.error(err);
                showExportStatus('이미지 생성에 실패했습니다.', false);
            } finally {
                btnDownload.disabled = false;
                btnDownload.innerHTML = `<i class="fa-solid fa-download"></i> PNG 다운로드`;
            }
        });

        btnCopy.addEventListener('click', async () => {
            btnCopy.disabled = true;
            btnCopy.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 처리 중...`;
            showExportStatus('이미지를 복사하는 중입니다...', true);
            try {
                const blob = await captureContentAsBlob();
                if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                    showExportStatus('이미지가 클립보드에 복사되었습니다.', true);
                } else {
                    throw new Error('Clipboard API not supported');
                }
            } catch (err) {
                console.warn(err);
                showExportStatus('이 브라우저에서는 이미지 복사가 제한되어 PNG 다운로드로 대체합니다.', false);
                try {
                    const blob = await captureContentAsBlob();
                    triggerDownload(blob, filename);
                } catch (dlErr) {
                    console.error(dlErr);
                    showExportStatus('이미지 생성에 실패했습니다.', false);
                }
            } finally {
                btnCopy.disabled = false;
                btnCopy.innerHTML = `<i class="fa-solid fa-copy"></i> 이미지 복사`;
            }
        });

        modal.querySelector('#schedule-print-layout-select').addEventListener('change', (e) => {
            const count = parseInt(e.target.value) || 1;
            updatePrintLayout(count);
        });

        modal.querySelector('#btn-print-close').addEventListener('click', () => {
            const styleEl = document.getElementById('dynamic-print-orientation-style');
            if (styleEl) styleEl.remove();
            modal.remove();
        });

        modal.querySelector('#btn-print-confirm').addEventListener('click', () => {
            window.print();
        });
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
        const settings = stateStore.getSettings() || {};
        
        const scheduleDays = settings.scheduleDays || ["mon", "tue", "wed", "thu", "fri", "sat"];
        const scheduleStartTime = settings.scheduleStartTime || "14:00";
        const scheduleEndTime = settings.scheduleEndTime || "21:00";
        const scheduleSlotMinutes = settings.scheduleSlotMinutes || 30;
        
        const parseTimeToHour = (timeStr) => {
            if (!timeStr) return 0;
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

        const getSlotsList = () => {
            const slots = [];
            const [startH, startM] = scheduleStartTime.split(':').map(Number);
            const [endH, endM] = scheduleEndTime.split(':').map(Number);
            let curr = startH * 60 + startM;
            const end = endH * 60 + endM;
            while (curr <= end) {
                const h = Math.floor(curr / 60);
                const m = curr % 60;
                slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                curr += scheduleSlotMinutes;
            }
            return slots;
        };

        const timelineStart = parseTimeToHour(scheduleStartTime);
        const timelineEnd = parseTimeToHour(scheduleEndTime);
        const totalHours = timelineEnd - timelineStart;

        // Days helper
        const daysOfWeekKo = ['월', '화', '수', '목', '금', '토', '일'];
        const dayKoToEn = { '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun' };
        
        // Calculate week range
        const weekDates = [];
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
                dayEn: dayKoToEn[daysOfWeekKo[i]],
                dayNum: d.getDate()
            });
        }

        const activeWeekDates = weekDates.filter(wd => scheduleDays.includes(wd.dayEn));
        const timeSlots = getSlotsList();

        // Mode Toggles HTML
        let controlsHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; gap: 8px; align-items: center;" data-testid="teacher-shift-view-mode">
                    <button class="btn ${shiftViewMode === 'week' ? 'btn-primary' : 'btn-secondary'}" id="btn-shift-mode-week" data-testid="teacher-shift-week-view">주간 보기</button>
                    <button class="btn ${shiftViewMode === 'day' ? 'btn-primary' : 'btn-secondary'}" id="btn-shift-mode-day" data-testid="teacher-shift-day-view">일간 보기</button>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-secondary" id="btn-shift-notes-toggle" data-testid="teacher-shift-notes-toggle">
                        <i class="fa-solid fa-eye${showNotes ? '-slash' : ''}"></i> 특이사항 ${showNotes ? '숨기기' : '보이기'}
                    </button>
                    <button class="btn btn-primary" id="btn-print-shifts" data-testid="teacher-shift-print-preview" style="display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-print"></i> 출력하기
                    </button>
                </div>
            </div>
        `;

        if (shiftViewMode === 'week') {
            const selectedTeacher = teachers.find(t => t.id === selectedTeacherId) || teachers[0] || { id: '', name: '', instrument: '', scheduleNotes: '' };
            
            ws.innerHTML = `
                <div class="glass-card" style="padding: 1.8rem; overflow-x: auto; width: 100%;">
                    ${controlsHtml}
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px; min-width: 250px;">
                            <label for="shift-teacher-select-week" style="font-weight: 600; font-size: 0.95rem; color: var(--text-muted); white-space: nowrap; margin-bottom: 0;">강사 선택:</label>
                            <select id="shift-teacher-select-week" class="form-control" style="margin-bottom: 0;" data-testid="teacher-shift-teacher-filter">
                                ${teachers.map(t => `<option value="${t.id}" ${t.id === selectedTeacher.id ? 'selected' : ''}>${t.name} (${t.instrument})</option>`).join('')}
                            </select>
                        </div>
                        <h4 style="font-weight: 700; margin: 0; color: var(--primary);">${selectedTeacher.name} 강사 주간 출근표</h4>
                    </div>

                    <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: stretch; width: 100%;">
                        <!-- Timetable grid -->
                        <div style="flex-grow: 3; position: relative; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: transparent; padding: 16px; min-width: 600px;" data-testid="teacher-shift-table">
                            <!-- Timeline container header -->
                            <div style="display: grid; grid-template-columns: 80px repeat(${activeWeekDates.length}, 1fr); border-bottom: 2px solid var(--border-color); background: var(--primary-light); padding: 12px 0; border-radius: var(--radius-md) var(--radius-md) 0 0; margin: -16px -16px 8px -16px;">
                                <div style="font-weight: 700; text-align: center; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; justify-content: center;"><i class="fa-regular fa-clock"></i></div>
                                ${activeWeekDates.map(wd => `
                                    <div style="font-weight: 700; text-align: center; font-size: 0.9rem; color: var(--text-main);">
                                        ${wd.dayKo}요일
                                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; display: block; margin-top: 2px;">${wd.dateStr.slice(5).replace('-', '/')}</span>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div style="display: flex; position: relative; height: 500px; margin-top: 8px;">
                                <!-- Time column labels -->
                                <div style="width: 80px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid var(--border-color); padding-right: 12px; font-size: 0.72rem; color: var(--text-muted); text-align: right; padding-top: 5px; padding-bottom: 5px; font-weight: 600;">
                                    ${timeSlots.map(ts => `<div>${ts}</div>`).join('')}
                                </div>
                                
                                <!-- Columns with active slots -->
                                <div style="flex-grow: 1; display: grid; grid-template-columns: repeat(${activeWeekDates.length}, 1fr); position: relative; height: 100%;">
                                    ${activeWeekDates.map(wd => {
                                        const dayShifts = shifts.filter(ts => ts.teacherId === selectedTeacher.id && ts.date === wd.dateStr);
                                        let shiftBlocksHtml = '';
                                        
                                        dayShifts.forEach(ds => {
                                            if (!ds.slots || ds.slots.length === 0) return;
                                            
                                            const ranges = getWorkingRanges(ds.slots);
                                            ranges.forEach(range => {
                                                const startHour = parseTimeToHour(range[0]);
                                                const endHour = parseTimeToHour(getShiftEndTimeStr(range[range.length - 1]));
                                                
                                                const topPercent = Math.max(0, (startHour - timelineStart) / totalHours * 100);
                                                const heightPercent = Math.min(100 - topPercent, (endHour - startHour) / totalHours * 100);
                                                
                                                shiftBlocksHtml += `
                                                    <div class="shift-bar-block" style="
                                                        position: absolute;
                                                        top: ${topPercent}%;
                                                        height: ${heightPercent}%;
                                                        left: 2%;
                                                        width: 96%;
                                                        background-color: ${selectedTeacher.color || 'var(--primary-light)'};
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
                                                        box-shadow: 0 3px 6px rgba(0,0,0,0.15);
                                                        z-index: 2;
                                                    ">
                                                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; width: 100%;">출근</span>
                                                        <span style="font-size: 0.62rem; opacity: 0.85; font-weight: normal; margin-top: 2px;">${range[0]}~${getShiftEndTimeStr(range[range.length-1])}</span>
                                                    </div>
                                                `;
                                            });
                                        });

                                        return `
                                            <div style="position: relative; border-right: 1px solid var(--border-color); height: 100%;">
                                                ${shiftBlocksHtml}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Notes Panel -->
                        <div id="teacher-shift-notes-panel" data-testid="teacher-shift-notes-panel" style="flex-grow: 1; width: 250px; display: ${showNotes ? 'block' : 'none'}; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: var(--bg-card);">
                            <h4 style="font-weight: 700; font-size: 1rem; margin-top: 0; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-clipboard-question" style="color: var(--primary);"></i> 강사 일정 특이사항
                            </h4>
                            <div style="border-left: 3px solid var(--primary); padding-left: 12px; font-size: 0.9rem; line-height: 1.5; color: var(--text-main); font-style: italic;">
                                ${selectedTeacher.scheduleNotes ? selectedTeacher.scheduleNotes.replace(/\n/g, '<br>') : '등록된 특이사항이 없습니다.'}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            ws.querySelector('#shift-teacher-select-week').addEventListener('change', (e) => {
                selectedTeacherId = e.target.value;
                render();
            });

        } else {
            // 일간 보기
            let filteredTeachers = teachers;
            
            if (filterType === 'active') {
                filteredTeachers = teachers.filter(t => shifts.some(ts => ts.teacherId === t.id && ts.date === selectedDateStr && ts.slots.length > 0));
            } else if (filterType !== 'all') {
                filteredTeachers = teachers.filter(t => t.instrument.includes(filterType));
            }

            if (filterSearchQuery.trim() !== '') {
                filteredTeachers = filteredTeachers.filter(t => t.name.includes(filterSearchQuery.trim()));
            }

            ws.innerHTML = `
                <div class="glass-card" style="padding: 1.8rem; overflow-x: auto; width: 100%;">
                    ${controlsHtml}

                    <div style="display: flex; gap: 12px; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center; background: var(--primary-light); padding: 12px; border-radius: var(--radius-sm);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label for="shift-date-input" style="font-weight: 700; font-size: 0.85rem; white-space: nowrap; margin-bottom:0;">날짜:</label>
                            <input type="date" id="shift-date-input" class="form-control" style="margin-bottom:0; font-size: 0.85rem; padding: 4px 8px; width: 150px;" value="${selectedDateStr}" data-testid="teacher-shift-date-input">
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label for="shift-filter-select" style="font-weight: 700; font-size: 0.85rem; white-space: nowrap; margin-bottom:0;">필터:</label>
                            <select id="shift-filter-select" class="form-control" style="margin-bottom:0; font-size: 0.85rem; padding: 4px 8px; width: 140px;" data-testid="teacher-shift-teacher-filter">
                                <option value="all" ${filterType === 'all' ? 'selected' : ''}>전체 강사</option>
                                <option value="active" ${filterType === 'active' ? 'selected' : ''}>출근 강사만</option>
                                <option value="피아노" ${filterType === '피아노' ? 'selected' : ''}>피아노 전담</option>
                                <option value="바이올린" ${filterType === '바이올린' ? 'selected' : ''}>바이올린 전담</option>
                                <option value="플루트" ${filterType === '플루트' ? 'selected' : ''}>플루트 전담</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-grow: 1; max-width: 250px;">
                            <input type="text" id="shift-search-input" class="form-control" style="margin-bottom:0; font-size: 0.85rem; padding: 4px 8px;" placeholder="강사명 검색" value="${filterSearchQuery}">
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: stretch; width: 100%;">
                        <!-- Daily grid -->
                        <div style="flex-grow: 3; position: relative; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: transparent; padding: 16px; min-width: 600px;" data-testid="teacher-shift-table">
                            <!-- Headers -->
                            <div style="display: grid; grid-template-columns: 80px repeat(${Math.max(1, filteredTeachers.length)}, 1fr); border-bottom: 2px solid var(--border-color); background: var(--primary-light); padding: 12px 0; border-radius: var(--radius-md) var(--radius-md) 0 0; margin: -16px -16px 8px -16px;">
                                <div style="font-weight: 700; text-align: center; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; justify-content: center;"><i class="fa-regular fa-clock"></i></div>
                                ${filteredTeachers.length > 0 ? filteredTeachers.map(t => `
                                    <div style="font-weight: 700; text-align: center; font-size: 0.9rem; color: var(--text-main); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                                        <span>${t.name}</span>
                                        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: normal;">${t.instrument}</span>
                                    </div>
                                `).join('') : '<div style="text-align:center; font-size:0.85rem; color:var(--text-muted); padding: 4px; grid-column: 2 / span 1;">출근 강사 없음</div>'}
                            </div>

                            <div style="display: flex; position: relative; height: 500px; margin-top: 8px;">
                                <div style="width: 80px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid var(--border-color); padding-right: 12px; font-size: 0.72rem; color: var(--text-muted); text-align: right; padding-top: 5px; padding-bottom: 5px; font-weight: 600;">
                                    ${timeSlots.map(ts => `<div>${ts}</div>`).join('')}
                                </div>

                                <div style="flex-grow: 1; display: grid; grid-template-columns: repeat(${Math.max(1, filteredTeachers.length)}, 1fr); position: relative; height: 100%;">
                                    ${filteredTeachers.length > 0 ? filteredTeachers.map(t => {
                                        const dayShifts = shifts.filter(ts => ts.teacherId === t.id && ts.date === selectedDateStr);
                                        let shiftBlocksHtml = '';

                                        dayShifts.forEach(ds => {
                                            if (!ds.slots || ds.slots.length === 0) return;
                                            const ranges = getWorkingRanges(ds.slots);
                                            ranges.forEach(range => {
                                                const startHour = parseTimeToHour(range[0]);
                                                const endHour = parseTimeToHour(getShiftEndTimeStr(range[range.length - 1]));
                                                
                                                const topPercent = Math.max(0, (startHour - timelineStart) / totalHours * 100);
                                                const heightPercent = Math.min(100 - topPercent, (endHour - startHour) / totalHours * 100);
                                                
                                                shiftBlocksHtml += `
                                                    <div class="shift-bar-block" style="
                                                        position: absolute;
                                                        top: ${topPercent}%;
                                                        height: ${heightPercent}%;
                                                        left: 4%;
                                                        width: 92%;
                                                        background-color: ${t.color || 'var(--primary-light)'};
                                                        border: 1px solid rgba(0,0,0,0.15);
                                                        border-top: 3px solid rgba(255,255,255,0.4);
                                                        border-radius: 4px;
                                                        padding: 2px;
                                                        font-size: 0.7rem;
                                                        color: #111;
                                                        font-weight: 800;
                                                        overflow: hidden;
                                                        text-align: center;
                                                        display: flex;
                                                        flex-direction: column;
                                                        justify-content: center;
                                                        align-items: center;
                                                        box-shadow: 0 3px 5px rgba(0,0,0,0.15);
                                                        z-index: 2;
                                                    ">
                                                        <span>출근</span>
                                                        <span style="font-size: 0.6rem; font-weight: normal;">${range[0]}~${getShiftEndTimeStr(range[range.length-1])}</span>
                                                    </div>
                                                `;
                                            });
                                        });

                                        return `
                                            <div style="position: relative; border-right: 1px solid var(--border-color); height: 100%;">
                                                ${shiftBlocksHtml}
                                            </div>
                                        `;
                                    }).join('') : '<div style="position:relative; height:100%;"></div>'}
                                </div>
                            </div>
                        </div>

                        <!-- Notes Panel -->
                        <div id="teacher-shift-notes-panel" data-testid="teacher-shift-notes-panel" style="flex-grow: 1; width: 250px; display: ${showNotes ? 'block' : 'none'}; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: var(--bg-card); max-height: 560px; overflow-y: auto;">
                            <h4 style="font-weight: 700; font-size: 1rem; margin-top: 0; margin-bottom: 12px;">
                                <i class="fa-solid fa-clipboard-question" style="color: var(--primary);"></i> 당일 강사 특이사항
                            </h4>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${filteredTeachers.map(t => `
                                    <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                        <strong>${t.name} (${t.instrument})</strong>
                                        <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px; font-style:italic;">
                                            ${t.scheduleNotes ? t.scheduleNotes.replace(/\n/g, '<br>') : '등록된 특이사항 없음'}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            ws.querySelector('#shift-date-input').addEventListener('change', (e) => {
                selectedDateStr = e.target.value;
                const d = new Date(selectedDateStr);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                referenceDate = new Date(d.setDate(diff));
                render();
            });

            ws.querySelector('#shift-filter-select').addEventListener('change', (e) => {
                filterType = e.target.value;
                render();
            });

            const searchInput = ws.querySelector('#shift-search-input');
            searchInput.addEventListener('input', (e) => {
                filterSearchQuery = e.target.value;
                renderWorkspace();
            });
        }

        // Common events
        ws.querySelector('#btn-shift-mode-week').addEventListener('click', () => {
            shiftViewMode = 'week';
            render();
        });
        ws.querySelector('#btn-shift-mode-day').addEventListener('click', () => {
            shiftViewMode = 'day';
            render();
        });
        ws.querySelector('#btn-shift-notes-toggle').addEventListener('click', () => {
            showNotes = !showNotes;
            render();
        });
        ws.querySelector('#btn-print-shifts').addEventListener('click', () => {
            openPrintPreview('shifts');
        });
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
        /*
         * [날짜별 기록 규칙 - Phase 7C 설계]
         * - 과거 날짜와 오늘 날짜는 당시 기록된 운영표 이력을 기준으로 본다.
         * - 오늘 또는 과거 날짜에서 누군가 원생 시간을 이동했다면, 그 날짜의 운영표는 이동된 상태로 고정(영속화)되어야 한다.
         * - 단, 미래 날짜 또는 다음 주차의 시간표는 원생 기본 시간표 값을 기준으로 다시 생성된다.
         * - 기본값 자체를 바꾸려면 원생 정보의 기본 시간표를 수정해야 한다.
         * - 이번 Phase 7C에서는 읽기/표시/필터/특이사항 기반을 우선 구현하며,
         *   드래그 이동 및 날짜별 override 저장은 다음 Phase(7D)로 위임하여 구현한다.
         */

        const teachers = stateStore.getTeachers();
        const students = stateStore.getStudents();
        const rawClasses = stateStore.getClasses();
        const settings = stateStore.getSettings() || {};
        
        const scheduleDays = settings.scheduleDays || ["mon", "tue", "wed", "thu", "fri", "sat"];
        const scheduleStartTime = settings.scheduleStartTime || "14:00";
        const scheduleEndTime = settings.scheduleEndTime || "21:00";
        const scheduleSlotMinutes = settings.scheduleSlotMinutes || 30;

        // 7일간의 날짜에 대해 각각 스케줄을 가져와서 병합 (주간용)
        let weekClasses = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(referenceDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().slice(0, 10);
            const daySchedule = stateStore.getTeacherStudentScheduleForDate(dateStr);
            weekClasses.push(...daySchedule);
        }

        // Time slots rows (settings 기반으로 동적 생성)
        const getSlotsList = () => {
            const slots = [];
            const [startH, startM] = scheduleStartTime.split(':').map(Number);
            const [endH, endM] = scheduleEndTime.split(':').map(Number);
            let curr = startH * 60 + startM;
            const end = endH * 60 + endM;
            while (curr <= end) {
                const h = Math.floor(curr / 60);
                const m = curr % 60;
                slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                curr += scheduleSlotMinutes;
            }
            return slots;
        };

        const timeSlots = getSlotsList();

        // Days mapping
        const days = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
        const daysOfWeekKo = ['월', '화', '수', '목', '금', '토', '일'];
        const dayKoToEn = { '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun' };
        
        // Calculate week range dates dynamically
        const weekDates = [];
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
                dayEn: dayKoToEn[daysOfWeekKo[i]],
                dayNum: d.getDate()
            });
        }

        const activeWeekDates = weekDates.filter(wd => scheduleDays.includes(wd.dayEn));

        // Mode Toggles HTML (data-testid 보강)
        let controlsHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; gap: 8px; align-items: center;" data-testid="teacher-student-schedule-view-mode">
                    <button class="btn ${matchViewMode === 'week' ? 'btn-primary' : 'btn-secondary'}" id="btn-match-mode-week" data-testid="teacher-student-week-view">주간 보기</button>
                    <button class="btn ${matchViewMode === 'day' ? 'btn-primary' : 'btn-secondary'}" id="btn-match-mode-day" data-testid="teacher-student-day-view">일간 보기</button>
                    <span id="teacher-student-move-status" data-testid="teacher-student-move-status" style="font-size: 0.85rem; font-weight: bold; margin-left: 12px; transition: all 0.3s; color: ${matchStatusColor};">${matchStatusText}</span>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <button class="btn btn-secondary" id="btn-match-notes-toggle" data-testid="teacher-student-notes-toggle">
                        <i class="fa-solid fa-eye${matchShowNotes ? '-slash' : ''}"></i> 특이사항 ${matchShowNotes ? '숨기기' : '보이기'}
                    </button>
                    ${matchViewMode === 'day' ? `
                    <button class="btn btn-secondary" id="btn-match-log-toggle" data-testid="teacher-student-log-toggle">
                        <i class="fa-solid fa-eye${matchShowLogs ? '-slash' : ''}"></i> 이동 이력 ${matchShowLogs ? '숨기기' : '보이기'}
                    </button>
                    ` : ''}
                    <button class="btn btn-primary" id="btn-print-matches" data-testid="teacher-student-print-preview" style="display: inline-flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-print"></i> 출력하기
                    </button>
                </div>
            </div>
        `;

        if (matchViewMode === 'week') {
            // 주간 보기
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

            // Filtered student notes for panel
            const activeStudents = currentFilterTeacherId 
                ? students.filter(s => s.teacherId === currentFilterTeacherId && s.scheduleNotes) 
                : students.filter(s => s.scheduleNotes);

            ws.innerHTML = `
                <div class="glass-card" style="padding: 1.5rem;">
                    ${controlsHtml}

                    <div style="display: flex; gap: 8px; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center;" id="teacher-filter-row" data-testid="teacher-student-teacher-filter">
                        ${teacherBadgesHtml}
                        <button class="btn btn-secondary" id="btn-clear-match-filter" style="border-radius: 20px; font-weight: 600; padding: 5px 12px; font-size: 0.8rem;">필터 초기화</button>
                    </div>

                    <div class="teacher-student-layout" style="display: flex; gap: 20px; flex-wrap: nowrap; align-items: flex-start; width: 100%;">
                        <!-- Timetable wrapper -->
                        <div class="table-wrapper teacher-student-main" style="flex: 1 1 auto; min-width: 0; overflow-x: auto;" data-testid="teacher-student-schedule-table">
                            <table class="custom-table" style="table-layout: fixed; width: 100%; border: 1px solid var(--border-color); border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color); background: var(--primary-light);">
                                        <th style="width: 70px; text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px 4px; font-weight: bold;"><i class="fa-regular fa-clock"></i></th>
                                        ${activeWeekDates.map(wd => `
                                            <th style="text-align: center; font-size: 0.85rem; padding: 12px 6px;">
                                                ${wd.dayKo}요일
                                                <span style="display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 4px;">${wd.dateStr.slice(5).replace('-', '/')}</span>
                                            </th>
                                        `).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${timeSlots.map(time => {
                                        return `
                                            <tr style="border-bottom: 1px solid var(--border-color);">
                                                <td style="text-align: center; font-weight: bold; color: var(--text-muted); font-size: 0.8rem; padding: 10px 4px; border-right: 1px solid var(--border-color); background: var(--primary-light);">${time}</td>
                                                ${activeWeekDates.map(wd => {
                                                    const hourClasses = weekClasses.filter(c => c.dayOfWeek === wd.dayKo && c.time === time);
                                                    let pillsHtml = '';
                                                    hourClasses.forEach(c => {
                                                        const student = students.find(s => s.id === c.studentId);
                                                        if (student) {
                                                            const currentTeacherId = c.teacherId || student.teacherId;
                                                            const teacher = teachers.find(t => t.id === currentTeacherId);
                                                            const bgColor = teacher ? teacher.color : '#e2e8f0';
                                                            pillsHtml += `
                                                                <span class="student-match-pill" 
                                                                    data-teacher-id="${currentTeacherId}" 
                                                                    data-student-id="${student.id}"
                                                                    data-class-id="${c.id}"
                                                                    data-testid="teacher-student-schedule-card"
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
                                                        <td class="match-cell-drop" data-day="${wd.dayKo}" data-time="${time}" data-testid="teacher-student-drop-slot" style="padding: 6px; text-align: center; border-right: 1px solid var(--border-color); vertical-align: middle; min-height: 48px;">
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

                        <!-- Notes Panel -->
                        <div id="student-match-notes-panel" class="teacher-student-side" data-testid="teacher-student-notes-panel" style="flex: 0 0 280px; width: 280px; box-sizing: border-box; display: ${matchShowNotes ? 'block' : 'none'}; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: var(--bg-card); max-height: 600px; overflow-y: auto;">
                            <h4 style="font-weight: 700; font-size: 1rem; margin-top: 0; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-clipboard-question" style="color: var(--primary);"></i> 원생 수업 특이사항
                            </h4>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${activeStudents.length > 0 ? activeStudents.map(s => {
                                    const teacher = teachers.find(t => t.id === s.teacherId);
                                    return `
                                        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                            <strong>${s.name} (${s.instrument})</strong>
                                            <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:2px;">담당: ${teacher ? teacher.name : '미지정'}</span>
                                            <div style="font-size:0.85rem; color:var(--text-main); margin-top:4px; font-style:italic;">
                                                ${s.scheduleNotes.replace(/\n/g, '<br>')}
                                            </div>
                                        </div>
                                    `;
                                }).join('') : '<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">등록된 특이사항이 없습니다.</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // 일간 보기
            const filterRowHtml = `
                <div style="display: flex; gap: 12px; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center; background: var(--primary-light); padding: 12px; border-radius: var(--radius-sm);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label for="match-date-input" style="font-weight: 700; font-size: 0.85rem; white-space: nowrap; margin-bottom:0;">날짜 선택:</label>
                        <input type="date" id="match-date-input" class="form-control" style="margin-bottom:0; font-size: 0.85rem; padding: 4px 8px; width: 150px;" value="${matchSelectedDateStr}" data-testid="teacher-student-date-input">
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label for="match-instrument-select" style="font-weight: 700; font-size: 0.85rem; white-space: nowrap; margin-bottom:0;">과목 필터:</label>
                        <select id="match-instrument-select" class="form-control" style="margin-bottom:0; font-size: 0.85rem; padding: 4px 8px; width: 140px;" data-testid="teacher-student-teacher-filter">
                            <option value="all" ${matchInstrumentFilter === 'all' ? 'selected' : ''}>전체 과목</option>
                            <option value="피아노" ${matchInstrumentFilter === '피아노' ? 'selected' : ''}>피아노</option>
                            <option value="바이올린" ${matchInstrumentFilter === '바이올린' ? 'selected' : ''}>바이올린</option>
                            <option value="플루트" ${matchInstrumentFilter === '플루트' ? 'selected' : ''}>플루트</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-grow: 1; max-width: 250px;">
                        <input type="text" id="match-search-input" class="form-control" style="margin-bottom:0; font-size: 0.85rem; padding: 4px 8px;" placeholder="강사명 검색" value="${matchSearchQuery}" data-testid="teacher-student-search-input">
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn ${matchFilterActiveOnly ? 'btn-primary' : 'btn-secondary'}" id="btn-match-active-only" data-testid="teacher-student-active-filter" style="font-size: 0.85rem; padding: 5px 12px;">
                            당일 수업 강사만
                        </button>
                    </div>
                </div>
            `;

            const targetDateObj = new Date(matchSelectedDateStr);
            const targetDayIdx = targetDateObj.getDay(); // 0 is Sunday, 1 is Monday
            const targetDayKo = daysOfWeekKo[targetDayIdx === 0 ? 6 : targetDayIdx - 1]; // 월~일

            const daySchedule = stateStore.getTeacherStudentScheduleForDate(matchSelectedDateStr);

            let filteredTeachers = teachers;
            if (matchFilterActiveOnly) {
                const activeTeacherIds = new Set();
                daySchedule.forEach(c => {
                    if (c.teacherId) {
                        activeTeacherIds.add(c.teacherId);
                    }
                });
                filteredTeachers = teachers.filter(t => activeTeacherIds.has(t.id));
            }

            if (matchInstrumentFilter !== 'all') {
                filteredTeachers = filteredTeachers.filter(t => t.instrument.includes(matchInstrumentFilter));
            }

            if (matchSearchQuery.trim() !== '') {
                filteredTeachers = filteredTeachers.filter(t => t.name.includes(matchSearchQuery.trim()));
            }

            const dayStudentIds = new Set();
            daySchedule.forEach(c => {
                const student = students.find(s => s.id === c.studentId);
                if (student) {
                    if (filteredTeachers.some(t => t.id === c.teacherId)) {
                        dayStudentIds.add(student.id);
                    }
                }
            });
            const activeStudents = students.filter(s => dayStudentIds.has(s.id) && s.scheduleNotes);
            const dayLogs = stateStore.getScheduleOperationLogs(matchSelectedDateStr) || [];

            ws.innerHTML = `
                <div class="glass-card" style="padding: 1.5rem;">
                    ${controlsHtml}
                    ${filterRowHtml}

                    <div class="teacher-student-layout" style="display: flex; gap: 20px; flex-wrap: nowrap; align-items: flex-start; width: 100%;">
                        <!-- Daily Matrix Table -->
                        <div class="table-wrapper teacher-student-main" style="flex: 1 1 auto; min-width: 0; overflow-x: auto;" data-testid="teacher-student-schedule-table">
                            <table class="custom-table" style="table-layout: fixed; width: 100%; border: 1px solid var(--border-color); border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 2px solid var(--border-color); background: var(--primary-light);">
                                        <th style="width: 70px; text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px 4px; font-weight: bold;"><i class="fa-regular fa-clock"></i></th>
                                        ${filteredTeachers.length > 0 ? filteredTeachers.map(t => `
                                            <th style="text-align: center; font-size: 0.85rem; padding: 12px 6px;">
                                                ${t.name}
                                                <span style="display: block; font-size: 0.72rem; color: var(--text-muted); font-weight: normal; margin-top: 4px;">${t.instrument}</span>
                                            </th>
                                        `).join('') : '<th style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">해당 조건 강사 없음</th>'}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${timeSlots.map(time => {
                                        return `
                                            <tr style="border-bottom: 1px solid var(--border-color);">
                                                <td style="text-align: center; font-weight: bold; color: var(--text-muted); font-size: 0.8rem; padding: 10px 4px; border-right: 1px solid var(--border-color); background: var(--primary-light);">${time}</td>
                                                ${filteredTeachers.length > 0 ? filteredTeachers.map(t => {
                                                    const cellClasses = daySchedule.filter(c => c.time === time);
                                                    let pillsHtml = '';
                                                    cellClasses.forEach(c => {
                                                        const student = students.find(s => s.id === c.studentId && c.teacherId === t.id);
                                                        if (student) {
                                                            pillsHtml += `
                                                                <span class="student-match-pill" 
                                                                    data-teacher-id="${c.teacherId}" 
                                                                    data-student-id="${student.id}"
                                                                    data-class-id="${c.id}"
                                                                    data-testid="teacher-student-schedule-card" draggable="true"
                                                                    style="
                                                                        background-color: ${t.color || 'var(--primary-light)'}; 
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
                                                        <td class="match-cell-drop" data-day="${targetDayKo}" data-time="${time}" data-teacher-id="${t.id}" data-testid="teacher-student-drop-slot" style="padding: 6px; text-align: center; border-right: 1px solid var(--border-color); vertical-align: middle; min-height: 48px;">
                                                            <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; min-height: 32px;">
                                                                ${pillsHtml || '<span style="color: var(--text-muted); opacity: 0.2; font-size: 0.7rem;">-</span>'}
                                                            </div>
                                                        </td>
                                                    `;
                                                }).join('') : '<td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">-</td>'}
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Right Sidebar Column -->
                        <div id="teacher-student-right-sidebar" class="teacher-student-side" style="display: ${(!matchShowNotes && !matchShowLogs) ? 'none' : 'flex'}; flex-direction: column; gap: 20px; flex: 0 0 280px; width: 280px; box-sizing: border-box;">
                            <!-- Notes Panel -->
                            <div id="student-match-notes-panel" data-testid="teacher-student-notes-panel" style="display: ${matchShowNotes ? 'block' : 'none'}; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: var(--bg-card); max-height: 400px; overflow-y: auto; box-sizing: border-box; width: 100%;">
                                <h4 style="font-weight: 700; font-size: 1rem; margin-top: 0; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-clipboard-question" style="color: var(--primary);"></i> 원생 수업 특이사항
                                </h4>
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    ${activeStudents.length > 0 ? activeStudents.map(s => {
                                        const teacher = teachers.find(t => t.id === s.teacherId);
                                        return `
                                            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                                                <strong>${s.name} (${s.instrument})</strong>
                                                <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:2px;">담당: ${teacher ? teacher.name : '미지정'}</span>
                                                <div style="font-size:0.85rem; color:var(--text-main); margin-top:4px; font-style:italic;">
                                                    ${s.scheduleNotes.replace(/\n/g, '<br>')}
                                                </div>
                                            </div>
                                        `;
                                    }).join('') : '<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">등록된 특이사항이 없습니다.</div>'}
                                </div>
                            </div>

                            <!-- Operation Logs Panel -->
                            <div id="student-match-log-panel" data-testid="teacher-student-log-panel" style="display: ${matchShowLogs ? 'block' : 'none'}; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: var(--bg-card); max-height: 400px; overflow-y: auto; box-sizing: border-box; width: 100%;">
                                <h4 style="font-weight: 700; font-size: 1rem; margin-top: 0; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fa-solid fa-clock-rotate-left" style="color: var(--primary);"></i> 시간표 이동 이력
                                </h4>
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    ${dayLogs.length > 0 ? dayLogs.map(log => {
                                        const logStudent = students.find(s => s.id === log.studentId);
                                        const studentName = logStudent ? logStudent.name : log.studentId;

                                        const beforeTeacher = teachers.find(t => t.id === log.before.teacherId);
                                        const beforeTeacherName = beforeTeacher ? beforeTeacher.name : (log.before.teacherId || '미지정');

                                        const afterTeacher = teachers.find(t => t.id === log.after.teacherId);
                                        const afterTeacherName = afterTeacher ? afterTeacher.name : (log.after.teacherId || '미지정');
                                        
                                        const creatorName = log.createdBy === 'USR_DIR_DEMO' ? '원장' : log.createdBy;
                                        
                                        return `
                                            <div data-testid="teacher-student-log-row" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px; font-size: 0.85rem;">
                                                <div style="font-weight: bold; margin-bottom: 4px; display: flex; justify-content: space-between;">
                                                    <span data-testid="teacher-student-log-student" style="color: var(--primary);">${studentName}</span>
                                                    <span style="font-size: 0.72rem; color: var(--text-muted);">${creatorName}</span>
                                                </div>
                                                <div style="margin-top: 2px;">
                                                    <span data-testid="teacher-student-log-before" style="text-decoration: line-through; color: var(--text-muted); font-size: 0.78rem;">
                                                        ${beforeTeacherName} (${log.before.startTime})
                                                    </span>
                                                    <span style="margin: 0 4px; color: var(--text-muted);">→</span>
                                                    <span data-testid="teacher-student-log-after" style="font-weight: 700; color: var(--good-color, #087443); font-size: 0.78rem;">
                                                        ${afterTeacherName} (${log.after.startTime})
                                                    </span>
                                                </div>
                                                <div data-testid="teacher-student-log-reason" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">
                                                    사유: ${log.before.teacherId !== log.after.teacherId ? '강사 및 시간 변경' : '시간 변경'}
                                                </div>
                                            </div>
                                        `;
                                    }).join('') : '<div data-testid="teacher-student-log-empty" style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">선택한 날짜의 시간표 이동 이력이 없습니다.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Common event handlers
        ws.querySelector('#btn-match-mode-week').addEventListener('click', () => {
            matchViewMode = 'week';
            render();
        });
        ws.querySelector('#btn-match-mode-day').addEventListener('click', () => {
            matchViewMode = 'day';
            render();
        });
        ws.querySelector('#btn-match-notes-toggle').addEventListener('click', () => {
            matchShowNotes = !matchShowNotes;
            render();
        });
        const matchLogToggleBtn = ws.querySelector('#btn-match-log-toggle');
        if (matchLogToggleBtn) {
            matchLogToggleBtn.addEventListener('click', () => {
                matchShowLogs = !matchShowLogs;
                render();
            });
        }

        const printMatchesBtn = ws.querySelector('#btn-print-matches');
        if (printMatchesBtn) {
            printMatchesBtn.addEventListener('click', () => {
                openPrintPreview('matches');
            });
        }

        // Mode specific event handlers
        if (matchViewMode === 'week') {
            const buttons = ws.querySelectorAll('.btn-filter-teacher');
            const pills = ws.querySelectorAll('.student-match-pill');

            const applyFilter = (teacherId) => {
                currentFilterTeacherId = teacherId;
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
                renderWorkspace();
            };

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

            ws.querySelector('#btn-clear-match-filter').addEventListener('click', clearFilter);



            if (currentFilterTeacherId) {
                applyFilter(currentFilterTeacherId);
            }
        } else {
            // Day mode handlers
            ws.querySelector('#match-date-input').addEventListener('change', (e) => {
                matchSelectedDateStr = e.target.value;
                const d = new Date(matchSelectedDateStr);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                referenceDate = new Date(d.setDate(diff));
                render();
            });

            ws.querySelector('#match-instrument-select').addEventListener('change', (e) => {
                matchInstrumentFilter = e.target.value;
                render();
            });

            const searchInput = ws.querySelector('#match-search-input');
            searchInput.addEventListener('input', (e) => {
                matchSearchQuery = e.target.value;
                renderWorkspace();
            });

            ws.querySelector('#btn-match-active-only').addEventListener('click', () => {
                matchFilterActiveOnly = !matchFilterActiveOnly;
                render();
            });
        }

        // HTML5 Drag and Drop Handlers
        const pills = ws.querySelectorAll('.student-match-pill');
        pills.forEach(pill => {
            pill.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/class-id', pill.dataset.classId || '');
                e.dataTransfer.setData('text/student-id', pill.dataset.studentId || '');
                e.dataTransfer.setData('text/from-teacher-id', pill.dataset.teacherId || '');
                const parentCell = pill.closest('.match-cell-drop');
                const fromTime = parentCell ? parentCell.dataset.time : '';
                e.dataTransfer.setData('text/from-time', fromTime || '');

                e.dataTransfer.effectAllowed = 'move';
                pill.style.opacity = '0.5';
            });
            pill.addEventListener('dragend', () => {
                pill.style.opacity = '1';
            });
        });

        ws.querySelectorAll('.match-cell-drop').forEach(cell => {
            console.log('BINDING DROP LISTENER ON: ', cell.dataset.teacherId, cell.dataset.time);
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                cell.style.background = 'rgba(9, 132, 227, 0.15)';
            });
            cell.addEventListener('dragleave', () => {
                cell.style.background = 'transparent';
            });
            const dropHandler = (e) => {
                if (e && e.preventDefault) e.preventDefault();
                cell.style.background = 'transparent';
                console.log('--- DROP EVENT EMITTED ---', { matchViewMode, targetDay: cell.dataset.day, targetTime: cell.dataset.time, targetTeacherId: cell.dataset.teacherId });

                if (matchViewMode === 'day') {
                    const classId = e.dataTransfer.getData('text/class-id') || (window.__mockDragData && window.__mockDragData.classId);
                    const studentId = e.dataTransfer.getData('text/student-id') || (window.__mockDragData && window.__mockDragData.studentId);
                    const fromTeacherId = e.dataTransfer.getData('text/from-teacher-id') || (window.__mockDragData && window.__mockDragData.fromTeacherId);
                    const fromStartTime = e.dataTransfer.getData('text/from-time') || (window.__mockDragData && window.__mockDragData.fromStartTime);
                    const toTeacherId = cell.dataset.teacherId;
                    const toStartTime = cell.dataset.time;

                    if (!studentId || !toTeacherId || !toStartTime) {
                        return;
                    }

                    if (fromTeacherId === toTeacherId && fromStartTime === toStartTime) {
                        return;
                    }

                    try {
                        const movePayload = {
                            studentId,
                            fromTeacherId,
                            toTeacherId,
                            fromStartTime,
                            toStartTime,
                            reason: 'daily-drag-move',
                            academyId: 'AC1',
                            createdBy: 'USR_DIR_DEMO'
                        };

                        stateStore.moveStudentScheduleForDate(matchSelectedDateStr, movePayload);

                        matchStatusText = '일정이 성공적으로 이동되었습니다.';
                        matchStatusColor = '#2ed573';
                        setTimeout(() => {
                            matchStatusText = '';
                            matchStatusColor = '';
                            renderWorkspace();
                        }, 3000);

                        renderWorkspace();
                    } catch (err) {
                        console.error('Error moving student schedule:', err);
                        matchStatusText = '일정 이동 중 에러가 발생했습니다.';
                        matchStatusColor = '#ff4757';
                        renderWorkspace();
                    }
                } else {
                    const classId = e.dataTransfer.getData('text/class-id') || (window.__mockDragData && window.__mockDragData.classId);
                    const targetDay = cell.dataset.day;
                    const targetTime = cell.dataset.time;
                    
                    if (classId && targetDay && targetTime) {
                        tempClassOverrides[classId] = { dayOfWeek: targetDay, time: targetTime };
                        renderWorkspace();
                    }
                }
            };

            cell.addEventListener('drop', dropHandler);
            const isE2E = typeof window !== 'undefined' && window.__DAYDAY_E2E__ === true;
            if (isE2E) {
                cell.__triggerDrop = dropHandler;
            }
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

