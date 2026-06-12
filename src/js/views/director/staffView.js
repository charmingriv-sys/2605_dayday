import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { PhoneNumberInput } from '../../utils/inputHelper.js';
import { formatPhoneNumber, showKakaoTalkToast, showLocalConfirm } from './shared.js';

export function renderTeachers(container) {
    let editingTeacherId = null; // Stored ID if editing, otherwise null (means add mode)
    let phoneBinder = null;
    let currentFilter = 'active'; // 'active' | 'resigned' | 'all'
    let searchQuery = '';

    const handleDeleteAction = (id) => {
        const teacher = stateStore.getTeacher(id);
        if (!teacher) return;
        
        const check = stateStore.canDeleteTeacher(id);
        if (check.canDelete) {
            if (confirm(`정말로 ${teacher.name} 강사의 정보를 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) {
                stateStore.deleteTeacherIfUnused(id);
                showKakaoTalkToast("강사 정보가 삭제되었습니다.");
                if (editingTeacherId === id) {
                    resetForm();
                }
            }
        } else {
            const mapReasonToUserFriendly = (reason) => {
                if (reason.includes('teacherAttendanceLogs') || reason.includes('출퇴근 근태 기록')) {
                    return '출퇴근 기록이 있습니다.';
                }
                if (reason.includes('teacherAttendanceEditLogs') || reason.includes('근태 수정')) {
                    return '근태 수정 이력이 있습니다.';
                }
                if (reason.includes('teacherShifts') || reason.includes('일정(근무 시간표)') || reason.includes('근무 시간표')) {
                    return '강사 시간표에 등록된 기록이 있습니다.';
                }
                if (reason.includes('students') || reason.includes('담당 수강생')) {
                    return '담당 원생이 배정되어 있습니다.';
                }
                if (reason.includes('scheduleSnapshots') || reason.includes('스냅샷')) {
                    return '수업/출결 기록에 연결되어 있습니다.';
                }
                if (reason.includes('scheduleOverrides') || reason.includes('오버라이드')) {
                    return '수업 변경 이력이 있습니다.';
                }
                if (reason.includes('scheduleOperationLogs') || reason.includes('조작 로그')) {
                    return '시간표 변경 이력이 있습니다.';
                }
                if (reason.includes('majorSchedules') || reason.includes('주요 일정')) {
                    return '주요 일정 담당자로 연결되어 있습니다.';
                }
                if (reason.includes('todayTasks') || reason.includes('업무 카드')) {
                    return '오늘 업무 카드에 연결되어 있습니다.';
                }
                return reason;
            };

            const reasonsHtml = check.reasons.map(r => `
                <li style="margin-bottom: 6px; line-height: 1.45; display: flex; align-items: center; gap: 6px;">
                    <span style="color: #dc2626;">•</span>
                    <span>${mapReasonToUserFriendly(r)}</span>
                </li>
            `).join('');

            const modalHtml = `
                <div class="modal-header">
                    <h3 class="modal-title" style="color: var(--danger, #dc2626); font-weight: 700;">
                        <i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>
                        강사 정보 삭제 제한 안내
                    </h3>
                    <button class="modal-close" data-close-modal>×</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 16px;">
                    <div style="font-weight: 700; color: var(--text-main); font-size: 1rem; line-height: 1.5; margin-bottom: 4px;">
                        이 강사는 기존 근태/시간표 기록이 존재하여 삭제할 수 없습니다.
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text-muted, #64748b); line-height: 1.5;">
                        기록을 안전하게 보존하기 위해 삭제 대신 '퇴사 처리'로 관리해 주세요.
                    </div>
                    
                    <div style="margin-top: 8px;">
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted, #64748b); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-link" style="font-size: 0.8rem;"></i> 연결된 기록
                        </div>
                        <div style="max-height: 100px; overflow-y: auto; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #b91c1c; font-size: 0.85rem; font-weight: 600;">
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${reasonsHtml}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border-color);">
                    <button class="btn btn-secondary" data-close-modal style="min-width: 80px; justify-content: center;">닫기</button>
                    <button class="btn" id="go-to-resign-btn" style="min-width: 140px; justify-content: center; background: #e28743; border-color: #e28743; color: #fff; font-weight: bold;">퇴사 처리하기</button>
                </div>
            `;
            openModal(modalHtml, (modalArea) => {
                const goToResignBtn = modalArea.querySelector('#go-to-resign-btn');
                if (goToResignBtn) {
                    goToResignBtn.addEventListener('click', () => {
                        closeModal();
                        setTimeout(() => {
                            handleResignAction(id);
                        }, 350);
                    });
                }
            });
        }
    };

    const handleResignAction = (id) => {
        const teacher = stateStore.getTeacher(id);
        if (!teacher) return;

        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const todayStr = new Date(now.getTime() - offset).toISOString().slice(0, 10);

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fa-solid fa-user-slash" style="color: var(--warning, #f59e0b); margin-right: 8px;"></i>
                    강사 퇴사 처리
                </h3>
                <button class="modal-close" data-close-modal>×</button>
            </div>
            <form id="resign-form">
                <div class="modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 16px;">
                    <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px; padding: 12px; font-size: 0.85rem; font-weight: 650; color: #b45309; line-height: 1.5;">
                        퇴사 처리 시 강사는 배정 목록에서 숨김 처리되나,<br>
                        과거의 출결 및 매출 내역 등에서는 실명으로 안전하게 보존됩니다.
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 700; font-size: 0.85rem; margin-bottom: 6px; color: var(--text-main);">퇴사일자 <span style="color: var(--danger);">*</span></label>
                        <input type="date" id="resign-date-input" class="form-control" value="${todayStr}" required style="width: 100%;">
                        <span id="resign-date-error" style="color: var(--danger); font-size: 0.75rem; display: none; margin-top: 4px; font-weight: bold;">퇴사일자를 입력해 주세요.</span>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 700; font-size: 0.85rem; margin-bottom: 6px; color: var(--text-main);">퇴사 메모</label>
                        <textarea id="resign-memo-input" class="form-control" placeholder="퇴사 사유 및 인수인계 사항 등 입력 (선택)" rows="3" style="resize: vertical; width: 100%;"></textarea>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 1rem 1.5rem; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border-color);">
                    <button type="button" class="btn btn-secondary" data-close-modal style="min-width: 80px; justify-content: center;">취소</button>
                    <button type="submit" class="btn btn-primary" style="min-width: 100px; justify-content: center; background: #e28743; border-color: #e28743;">퇴사 완료</button>
                </div>
            </form>
        `;

        openModal(modalHtml, (modalArea) => {
            const form = modalArea.querySelector('#resign-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const resignedAt = modalArea.querySelector('#resign-date-input').value.trim();
                const memo = modalArea.querySelector('#resign-memo-input').value.trim();
                const dateError = modalArea.querySelector('#resign-date-error');

                if (!resignedAt) {
                    dateError.style.display = 'block';
                    return;
                }
                dateError.style.display = 'none';

                if (confirm(`정말로 ${teacher.name} 강사를 퇴사 처리하시겠습니까?\n퇴사 처리 후에는 새 배정 선택 목록에서 제외됩니다.`)) {
                    stateStore.resignTeacher(id, { resignedAt, memo });
                    showKakaoTalkToast("강사 퇴사 처리가 완료되었습니다.");
                    closeModal();
                    resetForm();
                }
            });
        });
    };

    const handleRestoreAction = (id) => {
        const teacher = stateStore.getTeacher(id);
        if (!teacher) return;

        if (confirm("이 강사를 복직(재직) 처리하시겠습니까?")) {
            const res = stateStore.restoreTeacher(id);
            if (res.success) {
                showKakaoTalkToast("강사 복직(재직 전환) 처리가 완료되었습니다.");
                if (currentFilter === 'resigned') {
                    resetForm();
                } else {
                    startEditMode(id);
                }
            } else {
                alert(res.message || "오류가 발생했습니다.");
            }
        }
    };

    const render = () => {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;" class="teachers-layout-grid">
                <!-- Column 1: Teacher List Table -->
                <div class="glass-card" style="display: flex; flex-direction: column;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-user-group" style="color: var(--primary);"></i>
                        학원 등록 강사 현황
                    </h3>

                    <!-- Search and Filter controls -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
                        <!-- Left: Status Filter Buttons -->
                        <div style="display: flex; gap: 4px; background: rgba(0, 0, 0, 0.05); padding: 4px; border-radius: 8px;" id="teacher-status-filter-group">
                            <button type="button" class="filter-btn active" data-status="active" style="padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s;">
                                재직 <span id="count-active" style="font-size: 0.75rem; font-weight: 800; margin-left: 2px;">(0)</span>
                            </button>
                            <button type="button" class="filter-btn" data-status="resigned" style="padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s;">
                                퇴사 <span id="count-resigned" style="font-size: 0.75rem; font-weight: 800; margin-left: 2px;">(0)</span>
                            </button>
                            <button type="button" class="filter-btn" data-status="all" style="padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s;">
                                전체 <span id="count-all" style="font-size: 0.75rem; font-weight: 800; margin-left: 2px;">(0)</span>
                            </button>
                        </div>
                        
                        <!-- Right: Search input -->
                        <div style="position: relative; flex-grow: 1; max-width: 280px; min-width: 180px;">
                            <input type="text" id="teacher-search-input" class="form-control" placeholder="이름 또는 과목 검색..." style="width: 100%; padding-left: 36px; height: 34px; font-size: 0.85rem; border-radius: 8px; border: 1px solid var(--border-color, #cbd5e1); margin-bottom: 0;">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted, #64748b); font-size: 0.85rem;"></i>
                        </div>
                    </div>

                    <div class="table-wrapper" style="margin-top: 0; flex-grow: 1;">
                        <table class="custom-table" id="teachers-table">
                            <thead>
                                <tr>
                                    <th>이름</th>
                                    <th>담당 과목 / 악기</th>
                                    <th>연락처</th>
                                    <th>이메일</th>
                                    <th style="text-align: right;">관리</th>
                                </tr>
                            </thead>
                            <tbody id="teachers-table-body">
                                <!-- Loaded dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Column 2: Add/Edit Glass Card Form -->
                <div class="glass-card" id="teacher-form-card" style="height: fit-content; align-self: start;">
                    <h3 id="form-heading" style="font-size: 1.15rem; font-weight: 700; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-user-plus" style="color: var(--accent);"></i>
                        신규 강사 등록
                    </h3>
                    <form id="teacher-form">
                        <div id="teacher-info-banner" style="display: none;"></div>
                        <div class="form-group">
                            <label for="teacher-name-input">강사 이름 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="teacher-name-input" class="form-control" placeholder="성함 입력" required>
                        </div>
                        <div class="form-group">
                            <label for="teacher-instrument-input">담당 과목 / 악기 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="teacher-instrument-input" class="form-control" placeholder="예: 피아노, 플루트, 성악" required>
                        </div>
                        <div class="form-group">
                            <label for="teacher-phone-input">전화번호 <span style="color: var(--danger);">*</span></label>
                            <input type="tel" id="teacher-phone-input" class="form-control" placeholder="010-0000-0000" required>
                            <span id="teacher-phone-error" style="color: var(--danger); font-size: 0.8rem; display: none; margin-top: 4px; font-weight: bold;">전화번호 오류</span>
                        </div>
                        <div class="form-group">
                            <label for="teacher-email-input">이메일 주소</label>
                            <input type="email" id="teacher-email-input" class="form-control" placeholder="example@turing.com">
                        </div>
                        <div class="form-group">
                            <label for="teacher-notes-input">시간표 및 출퇴근 특이사항</label>
                            <textarea id="teacher-notes-input" class="form-control" placeholder="예: 화요일 16시 출근, 목요일 18시 조기 퇴근 등 특이사항 입력" rows="3" style="resize: vertical;"></textarea>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 1.8rem;" id="form-buttons-container">
                            <button type="submit" class="btn btn-primary" style="flex-grow: 1; justify-content: center; height: 42px; white-space: nowrap; word-break: keep-all; min-width: 120px;">
                                <i class="fa-solid fa-check"></i> <span id="submit-btn-label">등록 완료</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style>
                @media (max-width: 1024px) {
                    .teachers-layout-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
                #teacher-status-filter-group .filter-btn {
                    background: transparent;
                    color: var(--text-main, #334155);
                }
                #teacher-status-filter-group .filter-btn.active {
                    background: var(--primary, #3b82f6);
                    color: #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
            </style>
        `;

        const form = container.querySelector('#teacher-form');
        const phoneInput = container.querySelector('#teacher-phone-input');
        const phoneError = container.querySelector('#teacher-phone-error');

        if (phoneBinder) {
            phoneBinder.destroy();
        }
        phoneBinder = PhoneNumberInput.bind(phoneInput, phoneError);

        // Bind Search/Filter Listeners
        const searchInput = container.querySelector('#teacher-search-input');
        if (searchInput) {
            searchInput.value = searchQuery; // Preserve query across renders if any
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                renderTableBody();
            });
        }

        const filterGroup = container.querySelector('#teacher-status-filter-group');
        if (filterGroup) {
            // Restore active state based on currentFilter
            filterGroup.querySelectorAll('.filter-btn').forEach(btn => {
                if (btn.dataset.status === currentFilter) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
                btn.addEventListener('click', (e) => {
                    filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    currentFilter = e.currentTarget.dataset.status;
                    renderTableBody();
                });
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = container.querySelector('#teacher-name-input').value.trim();
            const instrument = container.querySelector('#teacher-instrument-input').value.trim();
            const phone = phoneInput.value.trim();
            const email = container.querySelector('#teacher-email-input').value.trim();
            const scheduleNotes = container.querySelector('#teacher-notes-input').value.trim();

            if (!phoneBinder.isValid()) {
                phoneInput.focus();
                return;
            }

            if (editingTeacherId) {
                stateStore.updateTeacher(editingTeacherId, { name, instrument, phone, email, scheduleNotes });
                resetForm();
            } else {
                stateStore.addTeacher({ name, instrument, phone, email, scheduleNotes });
                form.reset();
                if (phoneBinder) phoneBinder.validate();
                showKakaoTalkToast("등록이 완료되었습니다.");
            }
        });

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#teachers-table-body');
        if (!tbody) return;

        const teachers = stateStore.getTeachers();

        // 1. Calculate and update counts
        const countActive = teachers.filter(t => t.employmentStatus !== 'resigned').length;
        const countResigned = teachers.filter(t => t.employmentStatus === 'resigned').length;
        const countAll = teachers.length;

        const activeBadge = container.querySelector('#count-active');
        const resignedBadge = container.querySelector('#count-resigned');
        const allBadge = container.querySelector('#count-all');

        if (activeBadge) activeBadge.textContent = `(${countActive})`;
        if (resignedBadge) resignedBadge.textContent = `(${countResigned})`;
        if (allBadge) allBadge.textContent = `(${countAll})`;

        // 2. Filter by employmentStatus
        let filtered = teachers;
        if (currentFilter === 'active') {
            filtered = filtered.filter(t => t.employmentStatus !== 'resigned');
        } else if (currentFilter === 'resigned') {
            filtered = filtered.filter(t => t.employmentStatus === 'resigned');
        }

        // 3. Filter by search query (name or instrument)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t => 
                t.name.toLowerCase().includes(query) || 
                (t.instrument && t.instrument.toLowerCase().includes(query))
            );
        }

        // 4. Handle empty state messages
        if (filtered.length === 0) {
            let emptyMessage = '등록된 강사가 없습니다.';
            if (searchQuery) {
                emptyMessage = '검색 결과가 없습니다.';
            } else if (currentFilter === 'active') {
                emptyMessage = '재직 강사가 없습니다.';
            } else if (currentFilter === 'resigned') {
                emptyMessage = '퇴사 처리된 강사가 없습니다.';
            }

            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: rgba(255,255,255,0.05); margin-bottom: 8px; display: block;"></i>
                        ${emptyMessage}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(t => {
            const isResigned = t.employmentStatus === 'resigned';
            const nameHtml = isResigned 
                ? `${t.name} <span style="display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; padding: 1px 5px; font-size: 11px; font-weight: 900; margin-left: 6px;">퇴사</span>`
                : t.name;
            const rowStyle = isResigned ? 'opacity: 0.7; background: #f8fafc;' : '';
            return `
                <tr style="${rowStyle}">
                    <td style="font-weight: 600; color: var(--text-main);">${nameHtml}</td>
                    <td><span class="badge badge-info" style="font-size: 0.8rem;">${t.instrument}</span></td>
                    <td style="font-size: 0.85rem; font-weight: 500;">${t.phone}</td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${t.email}</td>
                    <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 8px;">
                            <button class="btn btn-secondary btn-icon-only edit-teacher-btn" data-id="${t.id}" title="수정">
                                <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only delete-teacher-btn" data-id="${t.id}" title="삭제">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Action bindings
        tbody.querySelectorAll('.edit-teacher-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                startEditMode(id);
            });
        });

        tbody.querySelectorAll('.delete-teacher-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                handleDeleteAction(id);
            });
        });
    };

    const startEditMode = (teacherId) => {
        editingTeacherId = teacherId;
        const teacher = stateStore.getTeacher(teacherId);
        if (!teacher) return;

        // Populate fields
        container.querySelector('#teacher-name-input').value = teacher.name;
        container.querySelector('#teacher-instrument-input').value = teacher.instrument;
        container.querySelector('#teacher-phone-input').value = teacher.phone;
        container.querySelector('#teacher-email-input').value = teacher.email;
        container.querySelector('#teacher-notes-input').value = teacher.scheduleNotes || '';
        if (phoneBinder) phoneBinder.validate();

        // Update info banner if resigned
        const infoBanner = container.querySelector('#teacher-info-banner');
        if (infoBanner) {
            if (teacher.employmentStatus === 'resigned') {
                infoBanner.innerHTML = `
                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-weight: 800; color: #475569; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-user-slash" style="color: #64748b;"></i>
                            퇴사한 강사 정보 수정 중
                        </div>
                        <div style="color: #64748b; font-weight: 600;">
                            퇴사일: <span style="font-family: monospace; color: var(--text-main); font-weight: 750;">${teacher.resignedAt || '-'}</span>
                        </div>
                        ${teacher.resignMemo ? `<div style="color: #64748b; font-weight: 600;">퇴사 사유: <span style="color: var(--text-main); font-weight: 750;">${teacher.resignMemo}</span></div>` : ''}
                    </div>
                `;
                infoBanner.style.display = 'block';
            } else {
                infoBanner.style.display = 'none';
                infoBanner.innerHTML = '';
            }
        }

        // Change layout elements to Edit Mode style
        container.querySelector('#form-heading').innerHTML = `
            <i class="fa-solid fa-user-pen" style="color: var(--primary);"></i>
            강사 정보 수정
        `;

        const buttonsContainer = container.querySelector('#form-buttons-container');
        if (buttonsContainer) {
            buttonsContainer.innerHTML = '';

            // 수정 완료 button
            const submitBtn = document.createElement('button');
            submitBtn.type = 'submit';
            submitBtn.className = 'btn btn-primary';
            submitBtn.style.flexGrow = '1';
            submitBtn.style.justifyContent = 'center';
            submitBtn.style.height = '42px';
            submitBtn.style.whiteSpace = 'nowrap';
            submitBtn.style.wordBreak = 'keep-all';
            submitBtn.style.minWidth = '120px';
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> 수정 완료`;
            buttonsContainer.appendChild(submitBtn);

            // 퇴사 처리 button - only if active
            if (teacher.employmentStatus !== 'resigned') {
                const resignBtn = document.createElement('button');
                resignBtn.type = 'button';
                resignBtn.className = 'btn';
                resignBtn.id = 'resign-teacher-btn';
                resignBtn.style.flexGrow = '1';
                resignBtn.style.justifyContent = 'center';
                resignBtn.style.height = '42px';
                resignBtn.style.background = '#e28743'; // Beautiful warm accent
                resignBtn.style.borderColor = '#e28743';
                resignBtn.style.color = '#fff';
                resignBtn.style.fontWeight = 'bold';
                resignBtn.style.whiteSpace = 'nowrap';
                resignBtn.style.wordBreak = 'keep-all';
                resignBtn.style.minWidth = '120px';
                resignBtn.innerHTML = `<i class="fa-solid fa-user-slash"></i> 퇴사 처리`;
                resignBtn.addEventListener('click', () => handleResignAction(teacherId));
                buttonsContainer.appendChild(resignBtn);
            }

            // 퇴사 취소 button - only if resigned
            if (teacher.employmentStatus === 'resigned') {
                const restoreBtn = document.createElement('button');
                restoreBtn.type = 'button';
                restoreBtn.className = 'btn';
                restoreBtn.id = 'restore-teacher-btn';
                restoreBtn.style.flexGrow = '1';
                restoreBtn.style.justifyContent = 'center';
                restoreBtn.style.height = '42px';
                restoreBtn.style.background = '#10b981'; // Emerald Green
                restoreBtn.style.borderColor = '#10b981';
                restoreBtn.style.color = '#fff';
                restoreBtn.style.fontWeight = 'bold';
                restoreBtn.style.whiteSpace = 'nowrap';
                restoreBtn.style.wordBreak = 'keep-all';
                restoreBtn.style.minWidth = '120px';
                restoreBtn.innerHTML = `<i class="fa-solid fa-user-check"></i> 퇴사 취소`;
                restoreBtn.addEventListener('click', () => handleRestoreAction(teacherId));
                buttonsContainer.appendChild(restoreBtn);
            }

            // 삭제 button
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn';
            deleteBtn.id = 'delete-teacher-form-btn';
            deleteBtn.style.flexGrow = '1';
            deleteBtn.style.justifyContent = 'center';
            deleteBtn.style.height = '42px';
            deleteBtn.style.background = '#dc2626'; // Soft red
            deleteBtn.style.borderColor = '#dc2626';
            deleteBtn.style.color = '#fff';
            deleteBtn.style.fontWeight = 'bold';
            deleteBtn.style.whiteSpace = 'nowrap';
            deleteBtn.style.wordBreak = 'keep-all';
            deleteBtn.style.minWidth = '120px';
            deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> 삭제`;
            deleteBtn.addEventListener('click', () => handleDeleteAction(teacherId));
            buttonsContainer.appendChild(deleteBtn);

            // 취소 button
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.style.flexGrow = '1';
            cancelBtn.style.justifyContent = 'center';
            cancelBtn.style.height = '42px';
            cancelBtn.style.whiteSpace = 'nowrap';
            cancelBtn.style.wordBreak = 'keep-all';
            cancelBtn.style.minWidth = '120px';
            cancelBtn.textContent = '취소';
            cancelBtn.addEventListener('click', resetForm);
            buttonsContainer.appendChild(cancelBtn);
        }
    };

    const resetForm = () => {
        editingTeacherId = null;
        
        const form = container.querySelector('#teacher-form');
        if (form) form.reset();

        const phoneInput = container.querySelector('#teacher-phone-input');
        if (phoneBinder) phoneBinder.validate();

        const heading = container.querySelector('#form-heading');
        if (heading) {
            heading.innerHTML = `
                <i class="fa-solid fa-user-plus" style="color: var(--accent);"></i>
                신규 강사 등록
            `;
        }
        
        const infoBanner = container.querySelector('#teacher-info-banner');
        if (infoBanner) {
            infoBanner.style.display = 'none';
            infoBanner.innerHTML = '';
        }

        const buttonsContainer = container.querySelector('#form-buttons-container');
        if (buttonsContainer) {
            buttonsContainer.innerHTML = `
                <button type="submit" class="btn btn-primary" style="flex-grow: 1; justify-content: center; height: 42px; white-space: nowrap; word-break: keep-all; min-width: 120px;">
                    <i class="fa-solid fa-check"></i> <span id="submit-btn-label">등록 완료</span>
                </button>
            `;
        }
    };

    render();

    // Subscribe to teachers changes
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', renderTableBody);

    return () => {
        if (phoneBinder) {
            phoneBinder.destroy();
        }
        unsubTeachers();
    };
}

