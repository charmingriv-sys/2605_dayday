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
    let isEndTimeManuallyChanged = false; // Track manual override of end time
    let editingTaskId = null; // Track editing task ID
    let selectedDateStr = null; // Track clicked calendar date
    let activeTab = 'active'; // Tab state: active, done, hidden, all
    let selectedCategoryFilter = 'all'; // Filter by category: 'all', 'overdue', 'staff_warning', 'absent', 'schedule', 'billing', 'attendance_warning', 'book_check', 'book_billing', 'memo'

    const isSystemCheck = (item) => {
        if (!item) return false;
        const src = item.taskSource || item.source;
        const cat = item.category;
        return src === 'system' || src === 'auto' || cat === 'system_check';
    };

    const isTodayTask = (task) => {
        const dateStr = task.startAt || task.dueAt;
        if (!dateStr) return false;
        try {
            const date = new Date(dateStr);
            const now = new Date();
            return date.getFullYear() === now.getFullYear() &&
                   date.getMonth() === now.getMonth() &&
                   date.getDate() === now.getDate();
        } catch (e) {
            return false;
        }
    };

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
                let catVal = foundEvent.category || 'memo';
                if (catVal === 'closing') catVal = 'check';
                if (categoryInput) categoryInput.value = catVal;

                if (startDateInput) startDateInput.value = startDecomp.dateStr;
                if (startAmpmInput) startAmpmInput.value = startDecomp.ampm;
                if (startHourInput) startHourInput.value = startDecomp.hourStr;
                if (startMinInput) startMinInput.value = startDecomp.minStr;

                if (endDateInput) endDateInput.value = endDecomp.dateStr;
                if (endAmpmInput) endAmpmInput.value = endDecomp.ampm;
                if (endHourInput) endHourInput.value = endDecomp.hourStr;
                if (endMinInput) endMinInput.value = endDecomp.minStr;

                // Reset isEndTimeManuallyChanged when form values are freshly loaded
                isEndTimeManuallyChanged = false;
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

        popover.dataset.date = dateStr;

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
            let categoryLabel = '운영업무';

            if (event.source === 'mockCalendar') {
                chipBg = 'rgba(241, 196, 15, 0.08)';
                chipBorder = '1px solid rgba(241, 196, 15, 0.25)';
                accentColor = '#f1c40f';
                const providerLabel = event.provider === 'google' ? 'Google' : '캘린더';
                prefix = `<span style="font-size: 0.58rem; color: #f1c40f; font-weight: 700; margin-right: 3px; background: rgba(241, 196, 15, 0.15); padding: 1px 3px; border-radius: 2px; white-space: nowrap; flex-shrink: 0;">${providerLabel}</span>`;
                sourceBadge = `<span style="font-size: 0.65rem; background: rgba(241, 196, 15, 0.15); color: #f1c40f; padding: 2px 6px; border-radius: 4px; font-weight: 700; white-space: nowrap; flex-shrink: 0;">${providerLabel === 'Google' ? 'Google 캘린더' : '로컬 캘린더'}</span>`;
            } else {
                const cat = event.category;
                const isSys = isSystemCheck(event);
                let badgeBg = 'rgba(9, 132, 227, 0.12)';
                let badgeColor = 'var(--primary)';

                if (isSys) {
                    categoryLabel = '추천확인';
                    chipBg = 'rgba(165, 94, 234, 0.08)';
                    chipBorder = '1px solid rgba(165, 94, 234, 0.25)';
                    accentColor = '#a55eea';
                    badgeBg = 'rgba(165, 94, 234, 0.12)';
                    badgeColor = '#a55eea';
                } else if (cat === 'check' || cat === 'urgent' || cat === 'closing' || event.priority === 'urgent' || event.priority === 'closing') {
                    categoryLabel = '확인필요';
                    chipBg = 'rgba(214, 48, 49, 0.08)';
                    chipBorder = '1px solid rgba(214, 48, 49, 0.25)';
                    accentColor = 'var(--danger)';
                    badgeBg = 'rgba(214, 48, 49, 0.12)';
                    badgeColor = 'var(--danger)';
                } else if (cat === 'consult' || cat === 'today' || event.priority === 'today') {
                    categoryLabel = '상담예약';
                    chipBg = 'rgba(0, 184, 148, 0.08)';
                    chipBorder = '1px solid rgba(0, 184, 148, 0.25)';
                    accentColor = 'var(--success)';
                    badgeBg = 'rgba(0, 184, 148, 0.12)';
                    badgeColor = 'var(--success)';
                } else if (cat === 'memo' || cat === 'info' || event.priority === 'info') {
                    categoryLabel = '메모';
                    chipBg = 'rgba(9, 132, 227, 0.06)';
                    chipBorder = '1px solid rgba(9, 132, 227, 0.2)';
                    accentColor = 'var(--primary)';
                    badgeBg = 'rgba(9, 132, 227, 0.12)';
                    badgeColor = 'var(--primary)';
                } else {
                    categoryLabel = '운영업무';
                    chipBg = 'rgba(9, 132, 227, 0.06)';
                    chipBorder = '1px solid rgba(9, 132, 227, 0.2)';
                    accentColor = 'var(--primary)';
                    badgeBg = 'rgba(9, 132, 227, 0.12)';
                    badgeColor = 'var(--primary)';
                }

                prefix = `<span style="font-size: 0.58rem; color: ${badgeColor}; font-weight: 700; margin-right: 3px; background: ${badgeBg}; padding: 1px 3px; border-radius: 2px; white-space: nowrap; flex-shrink: 0;">${categoryLabel}</span>`;
                sourceBadge = `<span style="font-size: 0.65rem; background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-weight: 700; white-space: nowrap; flex-shrink: 0;">${categoryLabel}</span>`;
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
            const doneIcon = isDone ? '<i class="fa-solid fa-check" style="color: var(--success); margin-right: 2px; font-weight: 900;"></i>' : '';

            // Adjust styles if completed (styles only)
            if (isDone) {
                chipBg = 'rgba(100, 116, 139, 0.06)';
                chipBorder = '1px solid rgba(100, 116, 139, 0.15)';
                accentColor = 'var(--text-muted)';
            }

            return `
                <div class="popover-event-item" data-id="${escapeHtml(event.id)}" data-source="${escapeHtml(event.source)}" style="padding: 10px; border-radius: 6px; background: ${chipBg}; border: ${chipBorder}; border-left: 4px solid ${accentColor}; cursor: pointer; user-select: none; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <div style="font-weight: 700; font-size: 0.82rem; ${textStyle} overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 4px; min-width: 0; flex: 1;">
                            ${prefix}
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${doneIcon}${escapeHtml(event.title)}</span>
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
        const savedScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
        if (typeof window !== 'undefined' && container) {
            container.style.minHeight = container.scrollHeight + 'px';
        }
        // Opt-in check for manual recommendations verification
        let enableDemo = false;
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('demoRecommendations') === '1') {
                enableDemo = true;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('DAYDAY_ENABLE_DEMO_RECOMMENDATIONS', 'true');
                }
            } else if (typeof localStorage !== 'undefined' && localStorage.getItem('DAYDAY_ENABLE_DEMO_RECOMMENDATIONS') === 'true') {
                enableDemo = true;
            }
        }

        // Seed demo data for manual verification only in non-automated user browsers
        const isAutomation = typeof navigator !== 'undefined' && navigator.webdriver;
        const isE2E = typeof window !== 'undefined' && window.__DAYDAY_E2E__ === true;
        if (enableDemo && !isAutomation && !isE2E && typeof stateStore.seedDemoRecommendationsData === 'function') {
            stateStore.seedDemoRecommendationsData();
        }

        const demoModeBadge = (enableDemo && !isAutomation && !isE2E)
            ? `<span class="badge" id="demo-badge" style="font-size: 0.72rem; padding: 4px 8px; font-weight: 700; background-color: rgba(165, 94, 234, 0.15); color: #a55eea; border: 1px solid rgba(165, 94, 234, 0.25); margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-flask"></i> 추천확인 데모 데이터 활성화됨</span>`
            : '';

        // Sync system recommendations silently to prevent infinite notification loops before retrieving active tasks
        stateStore.syncSystemRecommendations(new Date(), true);

        // Fetch active tasks using detailed today filtering logic
        const isTodayTaskDetailed = (task) => {
            if (task.status === 'open') {
                return true; // Keep open tasks visible regardless of date (legacy carryover / unpaid recommendations)
            }
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth();
            const d = now.getDate();
            const isSameDay = (isoStr) => {
                if (!isoStr) return false;
                try {
                    const date = new Date(isoStr);
                    return date.getFullYear() === y &&
                           date.getMonth() === m &&
                           date.getDate() === d;
                } catch (e) {
                    return false;
                }
            };
            return isSameDay(task.startAt) || isSameDay(task.dueAt) || isSameDay(task.completedAt) || isSameDay(task.createdAt) || isSameDay(task.dismissedAt) || (task.snoozedUntil && isSameDay(task.snoozedUntil));
        };

        const todayTasksAll = stateStore.getTodayTasks().filter(isTodayTaskDetailed);
        const activeTasksList = todayTasksAll.filter(t => t.status === 'open' || (t.status === 'snoozed' && new Date(t.snoozedUntil).getTime() <= Date.now()));
        const doneTasksList = todayTasksAll.filter(t => t.status === 'done');
        const hiddenTasksList = todayTasksAll.filter(t => t.status === 'dismissed' || (t.snoozedUntil && new Date(t.snoozedUntil).getTime() > Date.now()));
        const allTasksList = todayTasksAll;

        // ==========================================
        // Placeholder counts for Phase 13B ~ 13E domain integrations
        // ==========================================
        const getOverdueCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'billing' && t.category === 'overdue') {
                        cat = 'overdue';
                    }
                }
                return cat === 'overdue';
            }).length;
        };
        const getStaffWarningCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'attendance' && t.category === 'staff_warning') {
                        cat = 'staff_warning';
                    }
                }
                return cat === 'staff_warning';
            }).length;
        };
        const getAbsentCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'attendance' && t.category === 'absent') {
                        cat = 'absent';
                    }
                }
                return cat === 'absent';
            }).length;
        };
        const getScheduleCount = () => {
            const list = activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'schedule' && t.category === 'schedule') {
                        cat = 'schedule';
                    }
                }
                const match = cat === 'schedule';
                if (match) {
                    console.log('DEBUG [getScheduleCount] MATCHED TASK:', JSON.stringify(t));
                }
                return match;
            });
            console.log('DEBUG [getScheduleCount] total count:', list.length, 'from activeTasksList length:', activeTasksList.length);
            return list.length;
        };
        const getBillingCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'billing' && t.category === 'billing') {
                        cat = 'billing';
                    }
                }
                return cat === 'billing';
            }).length;
        };
        const getAttendanceWarningCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'attendance') {
                        if (t.category !== 'absent' && t.category !== 'staff_warning') {
                            cat = 'attendance_warning';
                        }
                    }
                }
                return cat === 'attendance_warning';
            }).length;
        };
        const getBookCheckCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'book') {
                        if (t.category === 'book_check') {
                            cat = 'book_check';
                        }
                    }
                }
                return cat === 'book_check';
            }).length;
        };
        const getBookBillingCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category;
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'book') {
                        if (t.category === 'book_billing') {
                            cat = 'book_billing';
                        }
                    }
                }
                return cat === 'book_billing';
            }).length;
        };
        const getMemoCount = () => {
            return activeTasksList.filter(t => {
                let cat = t.category || 'memo';
                if (t.source === 'system' || t.source === 'auto') {
                    if (t.type === 'billing') {
                        if (t.category === 'billing') cat = 'billing';
                        else cat = 'overdue';
                    }
                    else if (t.type === 'attendance') {
                        if (t.category === 'absent') cat = 'absent';
                        else if (t.category === 'staff_warning') cat = 'staff_warning';
                        else cat = 'attendance_warning';
                    }
                }
                return cat === 'memo';
            }).length;
        };

        const cardsData = [
            { id: 'memo', label: '운영메모', count: getMemoCount(), color: 'var(--primary)', icon: 'fa-note-sticky' },
            { id: 'absent', label: '결석 확인', count: getAbsentCount(), color: 'var(--danger)', icon: 'fa-user-slash' },
            { id: 'attendance_warning', label: '특이출결', count: getAttendanceWarningCount(), color: 'var(--danger)', icon: 'fa-triangle-exclamation' },
            { id: 'staff_warning', label: '특이근태', count: getStaffWarningCount(), color: '#f1c40f', icon: 'fa-user-clock' },
            { id: 'billing', label: '수납확인', count: getBillingCount(), color: 'var(--success)', icon: 'fa-receipt' },
            { id: 'overdue', label: '미수납 확인', count: getOverdueCount(), color: 'var(--danger)', icon: 'fa-file-invoice-dollar' },
            { id: 'schedule', label: '일정확인', count: getScheduleCount(), color: 'var(--primary)', icon: 'fa-calendar-day' },
            { id: 'book_check', label: '교재 확인', count: getBookCheckCount(), color: '#a55eea', icon: 'fa-book' },
            { id: 'book_billing', label: '교재 결제 확인', count: getBookBillingCount(), color: '#f1c40f', icon: 'fa-wallet' }
        ];

        const chipsHtml = cardsData.map(card => {
            const isSelected = selectedCategoryFilter === card.id;
            const cardClass = isSelected ? 'kpi-chip-card selected' : 'kpi-chip-card';
            const textClass = isSelected ? 'color: var(--text-main); font-weight: 800;' : 'color: var(--text-muted); font-weight: 600;';
            const countBadgeStyle = card.count > 0 
                ? `background-color: ${card.color}; color: #fff; font-weight: 700;` 
                : `background-color: rgba(255,255,255,0.08); color: var(--text-muted);`;

            return `
                <div class="${cardClass}" data-filter-id="${card.id}" title="${card.id === 'memo' ? '오늘 등록된 운영 메모 및 할 일 수' : `${card.label} (향후 비즈니스 연동 예정)`}" style="--card-color: ${card.color};">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        <i class="fa-solid ${card.icon}" style="color: ${card.color}; font-size: 0.95rem; flex-shrink: 0;"></i>
                        <span style="font-size: 0.76rem; ${textClass} overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.label}</span>
                    </div>
                    <span class="badge" style="font-size: 0.72rem; padding: 3px 7px; border-radius: 12px; margin: 0; flex-shrink: 0; ${countBadgeStyle}">${card.count}</span>
                </div>
            `;
        }).join('');

        let filteredTasks = [];
        if (activeTab === 'active') {
            filteredTasks = activeTasksList;
        } else if (activeTab === 'done') {
            filteredTasks = doneTasksList;
        } else if (activeTab === 'hidden') {
            filteredTasks = hiddenTasksList;
        } else {
            filteredTasks = allTasksList;
        }

        // Apply selectedCategoryFilter for Phase 13A-1 UI skeleton
        if (selectedCategoryFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => {
                let cat = task.category || 'memo';
                if (task.source === 'system' || task.source === 'auto') {
                    if (task.type === 'billing') {
                        if (task.category === 'billing') cat = 'billing';
                        else cat = 'overdue';
                    }
                    else if (task.type === 'attendance') {
                        if (task.category === 'absent') cat = 'absent';
                        else if (task.category === 'staff_warning') cat = 'staff_warning';
                        else cat = 'attendance_warning';
                    }
                    else if (task.type === 'book') {
                        if (task.category === 'book_check') cat = 'book_check';
                        else if (task.category === 'book_billing') cat = 'book_billing';
                    }
                    else if (task.type === 'schedule') {
                        if (task.category === 'schedule') cat = 'schedule';
                    }
                }
                return cat === selectedCategoryFilter;
            });
        }

        // Apply startAt/dueAt time-based sorting policy for Phase 8C-3E
        const getTaskSortTime = (task) => {
            if (task.startAt) {
                const t = new Date(task.startAt).getTime();
                if (!isNaN(t)) return t;
            }
            if (task.dueAt) {
                const t = new Date(task.dueAt).getTime();
                if (!isNaN(t)) return t;
            }
            return Number.POSITIVE_INFINITY;
        };

        filteredTasks = [...filteredTasks].sort((a, b) => {
            const timeA = getTaskSortTime(a);
            const timeB = getTaskSortTime(b);
            if (timeA !== timeB) return timeA - timeB;
            const createA = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
            const createB = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
            return createA - createB;
        });

        const activeTasks = activeTasksList;
        const doneTasks = doneTasksList;

        const urgentCount = activeTasksList.filter(t => t.priority === 'urgent').length;
        const totalCount = todayTasksAll.length;
        const doneCount = doneTasksList.length;

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
                let categoryLabel = '운영업무';

                if (event.source === 'mockCalendar') {
                    chipBg = 'rgba(241, 196, 15, 0.12)';
                    chipBorder = '1px solid rgba(241, 196, 15, 0.35)';
                    accentColor = '#f1c40f';
                    const providerLabel = event.provider === 'google' ? 'Google' : '캘린더';
                    prefix = `<span style="font-size: 0.58rem; color: #f1c40f; font-weight: 700; margin-right: 3px; background: rgba(241, 196, 15, 0.15); padding: 1px 3px; border-radius: 2px;">${providerLabel}</span>`;
                } else {
                    const cat = event.category;
                    const isSys = isSystemCheck(event);
                    let badgeBg = 'rgba(9, 132, 227, 0.12)';
                    let badgeColor = 'var(--primary)';

                    if (isSys) {
                        categoryLabel = '추천확인';
                        chipBg = 'rgba(165, 94, 234, 0.12)';
                        chipBorder = '1px solid rgba(165, 94, 234, 0.35)';
                        accentColor = '#a55eea';
                        badgeBg = 'rgba(165, 94, 234, 0.15)';
                        badgeColor = '#a55eea';
                    } else if (cat === 'check' || cat === 'urgent' || cat === 'closing' || event.priority === 'urgent' || event.priority === 'closing') {
                        categoryLabel = '확인필요';
                        chipBg = 'rgba(214, 48, 49, 0.12)';
                        chipBorder = '1px solid rgba(214, 48, 49, 0.35)';
                        accentColor = 'var(--danger)';
                        badgeBg = 'rgba(214, 48, 49, 0.15)';
                        badgeColor = 'var(--danger)';
                    } else if (cat === 'consult' || cat === 'today' || event.priority === 'today') {
                        categoryLabel = '상담예약';
                        chipBg = 'rgba(46, 204, 113, 0.12)';
                        chipBorder = '1px solid rgba(46, 204, 113, 0.35)';
                        accentColor = 'var(--success)';
                        badgeBg = 'rgba(46, 204, 113, 0.15)';
                        badgeColor = 'var(--success)';
                    } else if (cat === 'memo' || cat === 'info' || event.priority === 'info') {
                        categoryLabel = '메모';
                        chipBg = 'rgba(9, 132, 227, 0.12)';
                        chipBorder = '1px solid rgba(9, 132, 227, 0.35)';
                        accentColor = 'var(--primary)';
                        badgeBg = 'rgba(9, 132, 227, 0.15)';
                        badgeColor = 'var(--primary)';
                    } else {
                        categoryLabel = '운영업무';
                        chipBg = 'rgba(9, 132, 227, 0.12)';
                        chipBorder = '1px solid rgba(9, 132, 227, 0.35)';
                        accentColor = 'var(--primary)';
                        badgeBg = 'rgba(9, 132, 227, 0.15)';
                        badgeColor = 'var(--primary)';
                    }
                    prefix = `<span style="flex-shrink: 0; font-size: 0.58rem; color: ${badgeColor}; font-weight: 700; margin-right: 3px; background: ${badgeBg}; padding: 1px 3px; border-radius: 2px; white-space: nowrap;">${categoryLabel}</span>`;
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
                const doneIcon = isDone ? '<i class="fa-solid fa-check" style="color: var(--success); margin-right: 2px; font-size: 0.58rem; font-weight: 900;"></i>' : '';

                // Overwrite background/border if completed (keep badge prefix label)
                if (isDone) {
                    chipBg = 'rgba(255, 255, 255, 0.02)';
                    chipBorder = '1px solid rgba(255, 255, 255, 0.08)';
                    accentColor = 'var(--text-muted)';
                    borderLeftStyle = `2px solid ${accentColor}`;
                }

                return `
                    <div class="calendar-event-chip" data-id="${escapeHtml(event.id)}" data-source="${escapeHtml(event.source)}" style="box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0; margin-top: 3px; padding: 2px 4px; border-radius: ${borderRadius}; background: ${chipBg}; border: ${chipBorder}; border-left: ${borderLeftStyle}; font-size: 0.65rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: flex-start;" title="${escapeHtml(event.title)} (${escapeHtml(event.description || '상세 없음')})">
                        ${prefix}
                        <span style="${textStyle} flex: 1 1 auto; min-width: 0; cursor: pointer; user-select: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doneIcon}${escapeHtml(event.title)}</span>
                    </div>
                `;
            }).join('');

            const moreHtml = hiddenCount > 0 
                ? `<div style="font-size: 0.58rem; color: var(--text-muted); font-weight: 700; margin-top: 2px; padding-left: 4px;">+${hiddenCount}개</div>` 
                : '';

            let cellStyle = 'min-height: 70px; padding: 4px; display: flex; flex-direction: column; justify-content: flex-start; position: relative; border-bottom: 1px solid rgba(255,255,255,0.03); border-right: 1px solid rgba(255,255,255,0.03); overflow: hidden !important; cursor: pointer; user-select: none; box-sizing: border-box;';
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
                    <div style="flex-grow: 1; min-width: 0; width: 100%; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box;">
                        ${eventsHtml}
                        ${moreHtml}
                    </div>
                </div>
            `);
        }

        // Custom Priority badge helper (mapped to Categories for Phase 8C-3A)
        const getPriorityBadge = (task) => {
            if (isSystemCheck(task)) {
                return '<span class="badge" style="padding: 4px 10px; font-weight: 700; background-color: #a55eea; color: #ffffff;">추천확인</span>';
            }
            const priority = task.priority;
            const category = task.category;
            const safePriority = escapeHtml(priority);
            
            if (priority === 'urgent' || priority === 'closing' || category === 'check' || category === 'closing' || category === 'urgent') {
                return '<span class="badge badge-danger" style="padding: 4px 10px; font-weight: 700;">확인필요</span>';
            }
            switch (priority) {
                case 'today':
                     return '<span class="badge badge-info" style="padding: 4px 10px; font-weight: 700; background-color: var(--primary); color: #ffffff;">상담예약</span>';
                case 'info':
                    return '<span class="badge badge-success" style="padding: 4px 10px; font-weight: 700;">메모</span>';
                default:
                    return `<span class="badge" style="padding: 4px 10px; font-weight: 700; background-color: var(--text-muted); color: #ffffff;">${safePriority}</span>`;
            }
        };

        const getTaskUserTags = (task) => {
            let character = '자동점검';
            let domain = '메모';

            // source 구분
            if (task.source === 'manual') {
                character = '직접등록';
            } else if (task.source === 'system') {
                character = '자동점검';
            }

            // 상담예약성 수동 처리
            if (task.priority === 'today' && task.source !== 'system') {
                character = '상담예약';
                domain = '상담';
                return { character, domain };
            }

            const category = task.category || '';
            const type = task.type || '';

            if (category === 'memo' || type === 'memo') {
                domain = '메모';
            } else if (category === 'absent' || category === 'attendance_warning') {
                domain = '출결';
            } else if (category === 'staff_warning') {
                domain = '근태';
            } else if (category === 'billing_due') {
                domain = '수납';
            } else if (category === 'billing_overdue') {
                domain = '미수납';
            } else if (type === 'schedule' || category === 'schedule') {
                domain = '주요일정';
            } else if (category === 'book_check') {
                domain = '교재';
            } else if (category === 'book_billing') {
                domain = '교재결제';
            } else if (type === 'counseling' || category === 'counseling') {
                domain = '상담';
            } else {
                if (type === 'attendance') {
                    domain = '출결';
                } else if (type === 'billing') {
                    domain = '수납';
                } else if (type === 'book') {
                    domain = '교재';
                }
            }

            return { character, domain };
        };

        const getDomainBadgeColor = (domain) => {
            switch (domain) {
                case '메모': return 'var(--success)';
                case '출결': return 'var(--danger)';
                case '근태': return '#f1c40f';
                case '수납': return 'var(--success)';
                case '미수납': return 'var(--danger)';
                case '주요일정': return 'var(--primary)';
                case '교재': return '#a55eea';
                case '교재결제': return '#f1c40f';
                case '상담': return 'var(--primary)';
                default: return 'var(--text-muted)';
            }
        };

        const formatTaskDateTime = (isoString) => {
            if (!isoString) return '';
            try {
                const date = new Date(isoString);
                const now = new Date();
                const isSameDay = date.getFullYear() === now.getFullYear() &&
                                  date.getMonth() === now.getMonth() &&
                                  date.getDate() === now.getDate();
                
                const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                if (isSameDay) {
                    return `오늘 ${timeStr}`;
                } else {
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    return `${mm}-${dd} ${timeStr}`;
                }
            } catch (e) {
                return escapeHtml(isoString);
            }
        };

        const formatTaskDateTimeRange = (startISO, endISO) => {
            if (!startISO) return '';
            try {
                const startDate = new Date(startISO);
                const now = new Date();
                const isStartToday = startDate.getFullYear() === now.getFullYear() &&
                                     startDate.getMonth() === now.getMonth() &&
                                     startDate.getDate() === now.getDate();
                
                const startTimeStr = startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                if (!endISO) {
                    if (isStartToday) {
                        return `오늘 ${startTimeStr}`;
                    } else {
                        const mm = String(startDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(startDate.getDate()).padStart(2, '0');
                        return `${mm}-${dd} ${startTimeStr}`;
                    }
                }

                const endDate = new Date(endISO);
                const endTimeStr = endDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                if (isStartToday) {
                    return `오늘 ${startTimeStr} ~ ${endTimeStr}`;
                } else {
                    const mm = String(startDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(startDate.getDate()).padStart(2, '0');
                    
                    const isSameDay = startDate.getFullYear() === endDate.getFullYear() &&
                                      startDate.getMonth() === endDate.getMonth() &&
                                      startDate.getDate() === endDate.getDate();
                    
                    if (isSameDay) {
                        return `${mm}-${dd} ${startTimeStr} ~ ${endTimeStr}`;
                    } else {
                        const endMm = String(endDate.getMonth() + 1).padStart(2, '0');
                        const endDd = String(endDate.getDate()).padStart(2, '0');
                        return `${mm}-${dd} ${startTimeStr} ~ ${endMm}-${endDd} ${endTimeStr}`;
                    }
                }
            } catch (e) {
                return '';
            }
        };

        const nextHourDate = getNextHourDate();
        let startComponents = decomposeDate(nextHourDate);
        let endComponents = decomposeDate(new Date(nextHourDate.getTime() + 60 * 60 * 1000));
        let taskContent = '';
        let taskCategory = 'memo';

        if (editingTaskId) {
            const allTasks = stateStore.getTodayTasks();
            const editingTask = allTasks.find(t => t.id === editingTaskId);
            if (editingTask) {
                let reconstructedContent = editingTask.rawContent;
                if (!reconstructedContent) {
                    if (editingTask.description) {
                        const firstLine = editingTask.description.split('\n')[0].trim();
                        if (firstLine === editingTask.title.trim()) {
                            reconstructedContent = editingTask.description;
                        } else {
                            reconstructedContent = `${editingTask.title}\n${editingTask.description}`;
                        }
                    } else {
                        reconstructedContent = editingTask.title;
                    }
                }
                taskContent = reconstructedContent;
                taskCategory = editingTask.category || 'memo';
                if (editingTask.startAt) {
                    try {
                        startComponents = decomposeDate(new Date(editingTask.startAt));
                    } catch (e) {}
                }
                if (editingTask.endAt) {
                    try {
                        endComponents = decomposeDate(new Date(editingTask.endAt));
                        isEndTimeManuallyChanged = false;
                    } catch (e) {}
                }
            } else {
                editingTaskId = null;
            }
        }
        
        if (!editingTaskId) {
            if (selectedDateStr) {
                startComponents.dateStr = selectedDateStr;
                endComponents.dateStr = selectedDateStr;
            }
            isEndTimeManuallyChanged = false;
        }

        // Capture popover state before setting container.innerHTML
        const oldPopover = container.querySelector('#calendar-popover-container');
        const popoverOpen = oldPopover && oldPopover.style.display !== 'none';
        const popoverDate = oldPopover ? oldPopover.dataset.date : null;

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
                @media (max-width: 768px) {
                    .calendar-event-chip {
                        font-size: 0.55rem !important;
                        padding: 1px 2px !important;
                        margin-top: 2px !important;
                    }
                    .calendar-event-chip span {
                        font-size: 0.55rem !important;
                    }
                }
            </style>
            <!-- Header Summary Card (Rich Glassmorphism UI) -->
            <div class="glass-card" style="padding: 1.8rem; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <h2 style="margin: 0; font-size: 1.45rem; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-list-check" style="color: var(--primary);"></i>
                        오늘 원장 콘솔
                        ${demoModeBadge}
                    </h2>
                    <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem;">오늘 처리할 운영 업무를 확인합니다.</p>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button type="button" id="btn-reset-filters" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.82rem; font-weight: 700; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin: 0; background: ${selectedCategoryFilter === 'all' ? 'rgba(255,255,255,0.03)' : 'var(--primary)'}; color: ${selectedCategoryFilter === 'all' ? 'var(--text-muted)' : '#fff'}; border: 1px solid rgba(255,255,255,0.06);">
                        <i class="fa-solid fa-arrows-rotate"></i> 필터 초기화 (전체보기)
                    </button>
                    
                    <div style="display: flex; gap: 8px; margin-left: 8px;">
                        <div class="glass-card" style="padding: 6px 12px; min-width: 70px; text-align: center; border-color: rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); margin: 0;">
                            <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600;">총 업무</div>
                            <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin-top: 2px;">${totalCount}개</div>
                        </div>
                        <div class="glass-card" style="padding: 6px 12px; min-width: 70px; text-align: center; border-color: var(--success-light); background: rgba(46, 204, 113, 0.05); margin: 0;">
                            <div style="font-size: 0.65rem; color: var(--success); font-weight: 600;">완료</div>
                            <div style="font-size: 1.15rem; font-weight: 800; color: var(--success); margin-top: 2px;">${doneCount}개</div>
                        </div>
                        <div class="glass-card" style="padding: 6px 12px; min-width: 70px; text-align: center; border-color: var(--danger-light); background: rgba(235, 94, 85, 0.05); margin: 0;">
                            <div style="font-size: 0.65rem; color: var(--danger); font-weight: 600;">확인필요</div>
                            <div style="font-size: 1.15rem; font-weight: 800; color: var(--danger); margin-top: 2px;">${urgentCount}개</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Upper 9 Work KPI Card Chips Row -->
            <div class="kpi-chips-container" id="kpi-chips-row-container">
                ${chipsHtml}
            </div>

            <!-- Main Grid Layout (Parallel Columns: Form & Calendar) -->
            <div class="today-console-workspace" style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 24px; align-items: start; margin-bottom: 24px;">
                <!-- Left Column: Manual Task Form Card -->
                <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; height: 100%;">
                    <h3 id="form-add-task-title" style="font-size: 1.05rem; font-weight: 700; margin: 0 0 1.2rem 0; display: flex; align-items: center; gap: 8px;">
                        <i id="form-title-icon" class="fa-solid ${editingTaskId ? 'fa-pen-to-square' : 'fa-circle-plus'}" style="color: ${editingTaskId ? 'var(--accent)' : 'var(--primary)'};"></i>
                        <span id="form-title-text">${editingTaskId ? '운영 메모 수정' : '새로운 운영 메모 / 할 일 추가'}</span>
                        ${editingTaskId ? '<span class="badge badge-accent form-edit-indicator" style="margin-left: auto; font-size: 0.65rem; background: var(--accent); color: #fff;">수정 중</span>' : ''}
                    </h3>
                    <form id="form-add-task" style="display: flex; flex-direction: column; gap: 16px;">
                        <!-- Row 1: Quick Memo Textarea -->
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">운영 메모 (첫 줄은 제목, 이후 줄은 설명)</label>
                            <textarea id="task-content-input" placeholder="오늘 메모할 내용을 입력하세요.&#10;예:&#10;신규 회원 상담 예약&#10;오후 3시에 방문하여 수강 일정 및 악기 대여 문의 예정" rows="4" required style="width: 100%; padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; resize: vertical; line-height: 1.5; outline: none;">${escapeHtml(taskContent)}</textarea>
                        </div>
                        
                        <!-- Row 2: Category & Submit Button -->
                        <div style="display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end;">
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">구분</label>
                                <select id="task-category-input" style="width: 100%; height: 38px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; margin: 0; cursor: pointer; outline: none;">
                                    <option value="memo" ${taskCategory === 'memo' ? 'selected' : ''}>메모</option>
                                    <option value="consult" ${taskCategory === 'consult' ? 'selected' : ''}>상담예약</option>
                                    <option value="check" ${taskCategory === 'check' ? 'selected' : ''}>확인필요</option>
                                </select>
                            </div>
                            <div style="display: flex; gap: 6px; align-items: end;">
                                <button type="submit" id="btn-add-task" class="btn btn-primary" style="height: 38px; padding: 0 24px; font-size: 0.85rem; display: ${editingTaskId ? 'none' : 'flex'}; align-items: center; justify-content: center; margin: 0;">추가</button>
                                <button type="button" id="btn-save-task" class="btn btn-accent" style="height: 38px; padding: 0 16px; font-size: 0.85rem; display: ${editingTaskId ? 'flex' : 'none'}; align-items: center; justify-content: center; margin: 0; background: var(--accent); color: #fff;">수정 완료</button>
                                <button type="button" id="btn-cancel-edit" class="btn btn-secondary" style="height: 38px; padding: 0 16px; font-size: 0.85rem; display: ${editingTaskId ? 'flex' : 'none'}; align-items: center; justify-content: center; margin: 0; background: var(--secondary); color: var(--text-main);">수정 취소</button>
                                <button type="button" id="btn-delete-task" class="btn btn-danger" style="height: 38px; padding: 0 16px; font-size: 0.85rem; display: ${editingTaskId ? 'flex' : 'none'}; align-items: center; justify-content: center; margin: 0; background: var(--danger); color: #fff;">삭제</button>
                            </div>
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
                        <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-template-rows: repeat(${numWeeks}, 1fr); gap: 0; flex-grow: 1; min-width: 0; overflow: hidden; border-top: 1px solid rgba(255,255,255,0.03); border-left: 1px solid rgba(255,255,255,0.03);" id="calendar-days-grid">
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

                <!-- Filter Tabs for Phase 8C-5B -->
                <div class="queue-filter-tabs" style="display: flex; gap: 8px; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; flex-wrap: wrap;">
                    <button type="button" class="tab-btn ${activeTab === 'active' ? 'active' : ''}" data-tab="active" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid ${activeTab === 'active' ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}; background: ${activeTab === 'active' ? 'rgba(9, 132, 227, 0.15)' : 'rgba(255,255,255,0.01)'}; color: ${activeTab === 'active' ? 'var(--primary)' : 'var(--text-muted)'}; margin: 0;">
                        대기 (${activeTasks.length})
                    </button>
                    <button type="button" class="tab-btn ${activeTab === 'done' ? 'active' : ''}" data-tab="done" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid ${activeTab === 'done' ? 'var(--success)' : 'rgba(255,255,255,0.05)'}; background: ${activeTab === 'done' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.01)'}; color: ${activeTab === 'done' ? 'var(--success)' : 'var(--text-muted)'}; margin: 0;">
                        완료 (${doneTasks.length})
                    </button>
                    <button type="button" class="tab-btn ${activeTab === 'hidden' ? 'active' : ''}" data-tab="hidden" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid ${activeTab === 'hidden' ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}; background: ${activeTab === 'hidden' ? 'rgba(165, 94, 234, 0.15)' : 'rgba(255,255,255,0.01)'}; color: ${activeTab === 'hidden' ? 'var(--accent)' : 'var(--text-muted)'}; margin: 0;">
                        제외/보류 (${hiddenTasksList.length})
                    </button>
                    <button type="button" class="tab-btn ${activeTab === 'all' ? 'active' : ''}" data-tab="all" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid ${activeTab === 'all' ? 'var(--text-main)' : 'rgba(255,255,255,0.05)'}; background: ${activeTab === 'all' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.01)'}; color: ${activeTab === 'all' ? 'var(--text-main)' : 'var(--text-muted)'}; margin: 0;">
                        전체 (${allTasksList.length})
                    </button>
                </div>
                
                <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 12px;">
                    ${
                        filteredTasks.length === 0
                            ? `
                            <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3rem 0; gap: 12px; color: var(--text-muted);">
                                <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(9, 132, 227, 0.06); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--primary);">
                                    <i class="fa-solid fa-check"></i>
                                </div>
                                <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-main);">해당 상태의 업무가 없습니다.</span>
                            </div>
                            `
                            : `
                            <div style="display: flex; flex-direction: column; gap: 12px;" id="tasks-list-container">
                                ${filteredTasks.map(task => {
                                    const safeId = escapeHtml(task.id);
                                    const safeTitle = escapeHtml(task.title);

                                    const isDone = task.status === 'done';
                                    const isDismissed = task.status === 'dismissed';
                                    const isSnoozed = task.status === 'snoozed' && new Date(task.snoozedUntil).getTime() > Date.now();
                                    const isRestorable = isDone || isDismissed || isSnoozed;

                                    const cardStyle = isRestorable
                                        ? `padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-color: rgba(255,255,255,0.04); transition: all 0.2s ease-in-out; background: rgba(255,255,255,0.01); opacity: 0.55;`
                                        : `padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-color: rgba(255,255,255,0.06); transition: all 0.2s ease-in-out; background: rgba(255,255,255,0.01);`;

                                    const titleStyle = isDone
                                        ? `font-weight: 700; color: var(--text-muted); font-size: 0.95rem; text-decoration: line-through;`
                                        : `font-weight: 700; color: var(--text-main); font-size: 0.95rem;`;

                                    let badgeHtml = '';
                                    if (isDone) {
                                        badgeHtml = `<span class="badge badge-success" style="padding: 4px 10px; font-weight: 700; background-color: var(--success); color: #ffffff;">완료</span>`;
                                    } else if (task.status === 'dismissed') {
                                        badgeHtml = `<span class="badge" style="padding: 4px 10px; font-weight: 700; background-color: var(--text-muted); color: #ffffff;">제외</span>`;
                                    } else if (task.status === 'snoozed' && new Date(task.snoozedUntil).getTime() > Date.now()) {
                                        badgeHtml = `<span class="badge" style="padding: 4px 10px; font-weight: 700; background-color: var(--warning); color: #ffffff;">보류</span>`;
                                    } else {
                                        badgeHtml = getPriorityBadge(task);
                                    }

                                    let timeText = '';
                                    if (task.startAt) {
                                        timeText = formatTaskDateTimeRange(task.startAt, task.endAt);
                                    } else {
                                        timeText = formatTaskDateTime(task.dueAt);
                                    }

                                    const todayBadge = isTodayTask(task) && !isRestorable
                                        ? `<span class="badge-today" style="display: inline-block; font-size: 0.58rem; background: var(--accent); color: #fff; padding: 2px 5px; border-radius: 3px; font-weight: 700; margin-bottom: 2px; text-align: center; white-space: nowrap; flex-shrink: 0; width: fit-content; margin-left: auto;">TODAY</span>`
                                        : '';

                                    let timeTextHtml = '';
                                    if (isDone) {
                                        timeTextHtml = `<div style="font-size: 0.8rem; font-weight: 600; color: var(--success);"><i class="fa-solid fa-circle-check" style="margin-right: 4px;"></i>${formatTaskDateTime(task.completedAt)} 완료</div>`;
                                    } else if (task.status === 'dismissed') {
                                        timeTextHtml = `<div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);"><i class="fa-solid fa-eye-slash" style="margin-right: 4px;"></i>제외 처리됨</div>`;
                                    } else if (task.status === 'snoozed' && new Date(task.snoozedUntil).getTime() > Date.now()) {
                                        timeTextHtml = `<div style="font-size: 0.8rem; font-weight: 600; color: var(--accent);"><i class="fa-solid fa-hourglass" style="margin-right: 4px;"></i>${formatTaskDateTime(task.snoozedUntil)}까지 보류</div>`;
                                    } else {
                                        timeTextHtml = `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                                            ${todayBadge}
                                            <div style="font-size: 0.8rem; font-weight: 600; color: var(--accent); white-space: nowrap;"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${timeText}</div>
                                           </div>`;
                                    }

                                    let actionsHtml = '';
                                    if (task.category === 'book_check') {
                                        actionsHtml = `
                                            <button type="button" class="btn btn-sm btn-primary" data-action="confirm-book" data-id="${safeId}" style="padding: 6px 12px; font-size: 0.75rem; margin: 0; background: var(--primary); color: #fff; justify-content: center; border-radius: 4px; font-weight: 600;" title="교재 지급 승인">
                                                교재 확인
                                            </button>
                                        `;
                                    } else if (isRestorable) {
                                        actionsHtml = `
                                            <button type="button" class="btn btn-sm" data-action="reopen" data-id="${safeId}" style="padding: 6px 10px; font-size: 0.75rem; margin: 0; background: var(--primary); color: #fff; justify-content: center; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" title="대기로 복원">
                                                <i class="fa-solid fa-rotate-left"></i> 복원
                                            </button>
                                        `;
                                    } else {
                                        actionsHtml = `
                                            <button type="button" class="btn btn-link btn-sm" data-action="done" data-id="${safeId}" style="padding: 4px 6px; font-size: 0.75rem; margin: 0; background: transparent; border: none; color: var(--success); font-weight: 600; cursor: pointer;" title="완료 처리">
                                                완료
                                            </button>
                                            <button type="button" class="btn btn-link btn-sm" data-action="snooze" data-id="${safeId}" style="padding: 4px 6px; font-size: 0.75rem; margin: 0; background: transparent; border: none; color: var(--accent); font-weight: 600; cursor: pointer;" title="보류 처리">
                                                보류
                                            </button>
                                            <button type="button" class="btn btn-link btn-sm" data-action="dismiss" data-id="${safeId}" style="padding: 4px 6px; font-size: 0.75rem; margin: 0; background: transparent; border: none; color: var(--text-muted); font-weight: 500; cursor: pointer;" title="오늘 큐에서 제외">
                                                제외
                                            </button>
                                        `;
                                    }

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
                                    const userTags = getTaskUserTags(task);

                                    return `
                                        <div class="glass-card" style="${cardStyle}" ${!isRestorable ? `onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(255,255,255,0.01)'"` : ''}>
                                            <div style="display: flex; align-items: center; gap: 16px; flex-grow: 1; cursor: ${!isSystemCheck(task) ? 'pointer' : 'default'};" class="${!isSystemCheck(task) ? 'task-card-click-zone' : ''}" data-id="${safeId}">
                                                <div style="flex-shrink: 0;">
                                                    ${badgeHtml}
                                                </div>
                                                <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                                                    <div style="${titleStyle}" class="card-title-text">${safeTitle}</div>
                                                    ${previewDescription ? `<div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; white-space: pre-wrap;">${safeDescription}</div>` : ''}
                                                </div>
                                            </div>
                                            <!-- Right side actions & metadata -->
                                            <div style="display: flex; align-items: center; gap: 20px; flex-shrink: 0;" class="task-action-wrapper">
                                                <div style="text-align: right; display: flex; flex-direction: column; gap: 4px; min-width: 100px;">
                                                    ${timeTextHtml}
                                                    <div style="display: none;">
                                                        ${escapeHtml(userTags.character)} · ${escapeHtml(userTags.domain)}
                                                    </div>
                                                </div>
                                                
                                                <div style="display: flex; gap: 6px;">
                                                    ${actionsHtml}
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

        if (popoverOpen && popoverDate) {
            showDayEventsPopover(popoverDate);
        }

        // Restore scroll position and release height lock (Phase 8C-5B-Repair-A)
        if (typeof window !== 'undefined') {
            window.scrollTo(0, savedScrollY);
            requestAnimationFrame(() => {
                window.scrollTo(0, savedScrollY);
                if (container) {
                    container.style.minHeight = '';
                }
            });
        }
    };

    // Shared Event Handler for event delegation
    const handleEvents = (e) => {
        // Monitor user manual override of the end time
        if (e.type === 'change' && e.target && (
            e.target.id === 'task-end-date-input' ||
            e.target.id === 'task-end-ampm-input' ||
            e.target.id === 'task-end-hour-input' ||
            e.target.id === 'task-end-minute-input'
        )) {
            isEndTimeManuallyChanged = true;
            return;
        }

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

            if (startDateInput && endDateInput && !isEndTimeManuallyChanged) {
                if (e.target.id === 'task-start-date-input') {
                    // Start Date updated manually: copy same date to end date
                    endDateInput.value = startDateInput.value;
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

            if (editingTaskId) {
                stateStore.updateTodayTask(editingTaskId, {
                    title,
                    description,
                    rawContent: content,
                    priority,
                    category,
                    startAt,
                    endAt,
                    dueAt
                });
                editingTaskId = null;
                render();
            } else {
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
            }
            contentInput.value = '';
            selectedDateStr = null;
            return;
        }

        // Click actions
        if (e.type === 'click') {
            // Intercept KPI chip filter click
            const chip = e.target.closest('.kpi-chip-card');
            if (chip) {
                const filterId = chip.dataset.filterId;
                if (selectedCategoryFilter === filterId) {
                    selectedCategoryFilter = 'all'; // Toggle back to all
                } else {
                    selectedCategoryFilter = filterId;
                }
                render();
                return;
            }

            // Reset filters click
            const btnReset = e.target.closest('#btn-reset-filters');
            if (btnReset) {
                selectedCategoryFilter = 'all';
                render();
                return;
            }

            // Intercept task card click zone to trigger Edit mode
            const clickZone = e.target.closest('.task-card-click-zone');
            if (clickZone) {
                const taskId = clickZone.dataset.id;
                const task = stateStore.getTodayTasks().find(t => t.id === taskId);
                if (task && !isSystemCheck(task)) {
                    editingTaskId = taskId;
                    render();
                    return;
                }
            }

            // Intercept save button click to trigger submit
            const btnSave = e.target.closest('#btn-save-task');
            if (btnSave) {
                e.stopPropagation();
                e.preventDefault();
                const form = container.querySelector('#form-add-task');
                if (form) {
                    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
                return;
            }

            // Intercept cancel edit button click
            const btnCancel = e.target.closest('#btn-cancel-edit');
            if (btnCancel) {
                e.stopPropagation();
                e.preventDefault();
                editingTaskId = null;
                selectedDateStr = null;
                render();
                return;
            }

            // Intercept delete task button click
            const btnDelete = e.target.closest('#btn-delete-task');
            if (btnDelete) {
                e.stopPropagation();
                e.preventDefault();
                if (confirm('이 운영 메모를 삭제할까요?')) {
                    stateStore.deleteTodayTask(editingTaskId);
                    editingTaskId = null;
                    render();
                }
                return;
            }

            // Intercept calendar event chip click first to open its day's popover
            const calendarChip = e.target.closest('.calendar-event-chip');
            if (calendarChip) {
                e.stopPropagation();
                e.preventDefault();
                const cell = calendarChip.closest('.calendar-day-cell');
                if (cell) {
                    const clickedDateStr = cell.dataset.date;
                    selectedDateStr = clickedDateStr;
                    
                    if (editingTaskId) {
                        editingTaskId = null;
                        render();
                    } else {
                        const startDateInput = container.querySelector('#task-start-date-input');
                        const endDateInput = container.querySelector('#task-end-date-input');
                        if (startDateInput && clickedDateStr) {
                            const oldStartVal = startDateInput.value;
                            startDateInput.value = clickedDateStr;
                            startDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                            
                            if (endDateInput && endDateInput.value === oldStartVal) {
                                endDateInput.value = clickedDateStr;
                                endDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                    showDayEventsPopover(clickedDateStr);
                }
                return;
            }

            // Intercept popover event item click to load its values or edit task
            const popoverItem = e.target.closest('.popover-event-item');
            if (popoverItem) {
                e.stopPropagation();
                e.preventDefault();
                const eventId = popoverItem.dataset.id;
                const eventSource = popoverItem.dataset.source;
                if (eventSource === 'todayTask') {
                    const task = stateStore.getTodayTasks().find(t => t.id === eventId);
                    if (task) {
                        if (!isSystemCheck(task)) {
                            editingTaskId = eventId;
                            render();
                        }
                    }
                } else {
                    editingTaskId = null;
                    render();
                    loadEventToForm(eventId, eventSource);
                }
                return;
            }

            // Intercept popover close button click
            const btnClose = e.target.closest('#calendar-popover-close');
            if (btnClose) {
                e.stopPropagation();
                e.preventDefault();
                editingTaskId = null;
                const popover = container.querySelector('#calendar-popover-container');
                if (popover) popover.style.display = 'none';
                render();
                return;
            }

            // Intercept popover backdrop click
            if (e.target && e.target.id === 'calendar-popover-container') {
                e.stopPropagation();
                e.preventDefault();
                editingTaskId = null;
                e.target.style.display = 'none';
                render();
                return;
            }

            // Calendar Day Cell Click Action
            const cell = e.target.closest('.calendar-day-cell');
            if (cell) {
                const clickedDateStr = cell.dataset.date;
                selectedDateStr = clickedDateStr;

                if (editingTaskId) {
                    editingTaskId = null;
                    render();
                }

                const startDateInput = container.querySelector('#task-start-date-input');
                const endDateInput = container.querySelector('#task-end-date-input');
                if (startDateInput && clickedDateStr) {
                    const oldStartVal = startDateInput.value;
                    startDateInput.value = clickedDateStr;
                    startDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    if (endDateInput && endDateInput.value === oldStartVal) {
                        endDateInput.value = clickedDateStr;
                        endDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
                
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

            // Confirm Book Action (Phase 13E-3)
            const btnConfirmBook = e.target.closest('[data-action="confirm-book"]');
            if (btnConfirmBook) {
                const taskId = btnConfirmBook.dataset.id;
                const task = stateStore.getTodayTasks().find(t => t.id === taskId);
                if (task) {
                    const birId = task.dedupeKey.replace('SYSTEM_RECOMMEND_BOOK_CHECK_', '');
                    const confirmed = confirm('이 교재 지급 요청을 확인 처리할까요?');
                    if (confirmed) {
                        try {
                            stateStore.confirmBookIssueRequest(birId);
                            alert('교재 지급 요청이 확인 처리되었습니다.');
                        } catch (err) {
                            alert(err.message);
                        }
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

            // Reopen Action
            const btnReopen = e.target.closest('[data-action="reopen"]');
            if (btnReopen) {
                const taskId = btnReopen.dataset.id;
                stateStore.reopenTodayTask(taskId);
                return;
            }

            // Tab Switch Action
            const tabBtn = e.target.closest('.tab-btn');
            if (tabBtn) {
                activeTab = tabBtn.dataset.tab;
                render();
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
                if (confirm('이 업무를 오늘 큐에서 제외할까요?\n같은 조건의 자동 업무는 다시 표시되지 않을 수 있습니다.')) {
                    stateStore.dismissTodayTask(taskId);
                }
                return;
            }
        }
    };

    render();

    // Bind event listeners to top-level container (Delegation)
    container.addEventListener('submit', handleEvents);
    container.addEventListener('click', handleEvents);
    container.addEventListener('change', handleEvents);

    // Subscribe to TodayTask, Payments, StudentBooks, and Attendance store changes to reflect real-time queue states
    const unsubTodayTasks = stateStore.subscribe('TODAY_TASKS_CHANGED', render);
    const unsubPayments = stateStore.subscribe('PAYMENTS_CHANGED', render);
    const unsubStudentBooks = stateStore.subscribe('STUDENT_BOOKS_CHANGED', render);
    const unsubAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', render);

    // View cleanup to prevent event listener and subscriber memory leaks
    return () => {
        unsubTodayTasks();
        unsubPayments();
        unsubStudentBooks();
        unsubAttendance();
        container.removeEventListener('submit', handleEvents);
        container.removeEventListener('click', handleEvents);
        container.removeEventListener('change', handleEvents);
    };
}
