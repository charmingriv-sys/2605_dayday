import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { PhoneNumberInput } from '../../utils/inputHelper.js';
import { formatPhoneNumber, showKakaoTalkToast, showLocalConfirm } from './shared.js';

export function renderTeachers(container) {
    let editingTeacherId = null; // Stored ID if editing, otherwise null (means add mode)
    let phoneBinder = null;

    const render = () => {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;" class="teachers-layout-grid">
                <!-- Column 1: Teacher List Table -->
                <div class="glass-card" style="display: flex; flex-direction: column;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-user-group" style="color: var(--primary);"></i>
                        학원 등록 강사 현황
                    </h3>
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

                        <div style="display: flex; gap: 12px; margin-top: 1.8rem;" id="form-buttons-container">
                            <button type="submit" class="btn btn-primary" style="flex-grow: 1; justify-content: center; height: 42px;">
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
            </style>
        `;

        const form = container.querySelector('#teacher-form');
        const phoneInput = container.querySelector('#teacher-phone-input');
        const phoneError = container.querySelector('#teacher-phone-error');

        if (phoneBinder) {
            phoneBinder.destroy();
        }
        phoneBinder = PhoneNumberInput.bind(phoneInput, phoneError);

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = container.querySelector('#teacher-name-input').value.trim();
            const instrument = container.querySelector('#teacher-instrument-input').value.trim();
            const phone = phoneInput.value.trim();
            const email = container.querySelector('#teacher-email-input').value.trim();

            if (!phoneBinder.isValid()) {
                phoneInput.focus();
                return;
            }

            if (editingTeacherId) {
                stateStore.updateTeacher(editingTeacherId, { name, instrument, phone, email });
                resetForm();
            } else {
                stateStore.addTeacher({ name, instrument, phone, email });
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

        if (teachers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: rgba(255,255,255,0.05); margin-bottom: 8px; display: block;"></i>
                        등록된 강사가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = teachers.map(t => `
            <tr>
                <td style="font-weight: 600; color: var(--text-main);">${t.name}</td>
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
        `).join('');

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
                const teacher = stateStore.getTeacher(id);
                if (confirm(`정말로 ${teacher.name} 강사의 정보를 삭제하시겠습니까?\n강사 정보 삭제 시 기존 원생 배정 및 담당 정보가 영향을 받을 수 있습니다.`)) {
                    stateStore.deleteTeacher(id);
                    if (editingTeacherId === id) {
                        resetForm();
                    }
                }
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
        if (phoneBinder) phoneBinder.validate();

        // Change layout elements to Edit Mode style
        container.querySelector('#form-heading').innerHTML = `
            <i class="fa-solid fa-user-pen" style="color: var(--primary);"></i>
            강사 정보 수정
        `;
        container.querySelector('#submit-btn-label').textContent = '수정 완료';

        const buttonsContainer = container.querySelector('#form-buttons-container');
        if (!container.querySelector('#cancel-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.style.flexGrow = '1';
            cancelBtn.style.justifyContent = 'center';
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
        
        const label = container.querySelector('#submit-btn-label');
        if (label) label.textContent = '등록 완료';

        const cancelBtn = container.querySelector('#cancel-edit-btn');
        if (cancelBtn) cancelBtn.remove();
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

