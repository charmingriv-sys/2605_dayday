import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { formatPhoneNumber, showKakaoTalkToast, showLocalConfirm } from './shared.js';

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

