import { stateStore } from '../../state.js';
import { PhoneNumberInput, AddressInput } from '../../utils/inputHelper.js';
import { showKakaoTalkToast } from './shared.js';

let isAcademyInfoAuthenticated = false;
export function renderAcademyInfo(container) {
    const currentUser = stateStore.getCurrentUser();
    const academyId = currentUser ? currentUser.academyId : null;
    const academy = academyId ? stateStore.getAcademy(academyId) : null;
    const settings = stateStore.getSettings();

    if (!academy) {
        container.innerHTML = `<div class="glass-card" style="padding: 2rem; text-align: center; color: var(--text-muted);">학원 정보가 존재하지 않습니다.</div>`;
        return () => {};
    }

    function formatBusinessNumber(val) {
        const cleaned = val.replace(/[^0-9]/g, '');
        if (cleaned.length <= 3) {
            return cleaned;
        } else if (cleaned.length <= 5) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        } else {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 10)}`;
        }
    }

    let cleanupFn = null;

    const renderEditForm = () => {
        container.innerHTML = `
            <div class="glass-card" style="padding: 2.2rem; max-width: 700px; margin: 0 auto; min-height: 500px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-school" style="color: var(--primary);"></i> 학원정보 관리
                </h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">
                    학원의 기본 정보와 출결 태블릿 비밀번호 등 시스템 핵심 설정을 구성합니다.
                </p>
                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 20px 0;">

                <form id="academy-info-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원명</label>
                            <input type="text" id="acad-name" class="form-control" value="${academy.name || ''}" style="margin-bottom: 0;" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">대표자명</label>
                            <input type="text" id="acad-owner" class="form-control" value="${academy.ownerName || ''}" style="margin-bottom: 0;" required>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원 연락처 (일반/인터넷/대표번호)</label>
                            <input type="tel" id="acad-phone" class="form-control" value="${academy.phone || ''}" style="margin-bottom: 0;" required>
                            <span id="acad-phone-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">사업자등록번호</label>
                            <input type="text" id="acad-biz-no" class="form-control" placeholder="000-00-00000" maxlength="12" value="${academy.businessRegistrationNumber || ''}" style="margin-bottom: 0;" required>
                            <span id="acad-biz-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원 주소</label>
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <input type="text" id="acad-postcode" class="form-control" placeholder="우편번호" style="width: 120px; margin-bottom: 0;" value="${academy.postcode || ''}" readonly required>
                            <button type="button" id="btn-search-acad-address" class="btn btn-secondary" style="margin-bottom: 0; padding: 0 16px; font-size: 0.85rem; white-space: nowrap;">주소 검색</button>
                        </div>
                        <input type="text" id="acad-address" class="form-control" placeholder="기본 주소" style="margin-bottom: 8px;" value="${academy.address || ''}" readonly required>
                        <input type="text" id="acad-detail-address" class="form-control" placeholder="상세 주소" style="margin-bottom: 0;" value="${academy.detailAddress || ''}">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">시스템 비밀번호 (4자리 숫자)</label>
                            <input type="password" id="acad-sys-pw" class="form-control" placeholder="••••" maxlength="4" value="${academy.systemPassword || '0000'}" style="text-align: center; font-size: 1.2rem; letter-spacing: 0.3rem; margin-bottom: 0;" required>
                            <span id="acad-sys-pw-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">태블릿 출결 비밀번호 (4자리 숫자)</label>
                            <input type="password" id="acad-tab-pw" class="form-control" placeholder="••••" maxlength="4" value="${academy.tabletPassword || '0000'}" style="text-align: center; font-size: 1.2rem; letter-spacing: 0.3rem; margin-bottom: 0;" required>
                            <span id="acad-tab-pw-error" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">지각 판정 기준</label>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <select id="acad-late-threshold" class="form-control" style="width: 100px; margin-bottom: 0; display: inline-block;">
                                ${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(m => `
                                    <option value="${m}" ${stateStore.getLateThresholdMinutes() === m ? 'selected' : ''}>${String(m).padStart(2, '0')}분</option>
                                `).join('')}
                            </select>
                            <span id="acad-late-threshold-text" style="font-size: 0.85rem; color: var(--text-main); font-weight: 600;">수업 시작 후 10분 초과 시 지각 처리</span>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 6px; color: var(--text-main);">학원장 서명 이미지 업로드</label>
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: rgba(255, 255, 255, 0.03); border: 1px dashed var(--border-color); padding: 12px; border-radius: var(--radius-sm);">
                            <div id="signature-preview-container" style="width: 80px; height: 80px; border: 1px solid var(--border-color); border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden; position: relative; flex-shrink: 0;">
                                ${academy.directorSignature ? `<img src="${academy.directorSignature}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : `<span style="color: #bbb; font-size: 0.75rem;">이미지 없음</span>`}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <input type="file" id="acad-signature-file" accept="image/*" style="display: none;">
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" id="btn-upload-signature" class="btn btn-secondary" style="margin-bottom: 0; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 4px; border-color: var(--border-color);">
                                        <i class="fa-solid fa-upload"></i> 파일 선택
                                    </button>
                                    ${academy.directorSignature ? `
                                    <button type="button" id="btn-delete-signature" class="btn btn-danger" style="margin-bottom: 0; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 4px; background: var(--danger); border-color: var(--danger); color: white;">
                                        <i class="fa-solid fa-trash"></i> 삭제
                                    </button>` : ''}
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">권장 크기: 정방형 (예: 150x150), 배경이 투명한 PNG 이미지</span>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
                        <button type="submit" class="btn btn-primary" style="padding: 12px 30px; font-weight: bold; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 8px; margin-bottom: 0; justify-content: center;">
                            <i class="fa-solid fa-floppy-disk"></i> 설정 저장하기
                        </button>
                    </div>
                </form>
            </div>
        `;

        const nameInput = container.querySelector('#acad-name');
        const ownerInput = container.querySelector('#acad-owner');
        const phoneInputEl = container.querySelector('#acad-phone');
        const phoneError = container.querySelector('#acad-phone-error');
        const bizInput = container.querySelector('#acad-biz-no');
        const bizError = container.querySelector('#acad-biz-error');
        const postcodeEl = container.querySelector('#acad-postcode');
        const addressEl = container.querySelector('#acad-address');
        const detailAddressEl = container.querySelector('#acad-detail-address');
        const searchAddressBtn = container.querySelector('#btn-search-acad-address');
        const sysPwInput = container.querySelector('#acad-sys-pw');
        const sysPwError = container.querySelector('#acad-sys-pw-error');
        const tabPwInput = container.querySelector('#acad-tab-pw');
        const tabPwError = container.querySelector('#acad-tab-pw-error');
        const form = container.querySelector('#academy-info-form');

        const lateThresholdSelect = container.querySelector('#acad-late-threshold');
        const lateThresholdText = container.querySelector('#acad-late-threshold-text');
        if (lateThresholdSelect && lateThresholdText) {
            const updateText = () => {
                const val = lateThresholdSelect.value;
                const displayVal = String(val).padStart(2, '0');
                lateThresholdText.textContent = `수업 시작 후 ${displayVal}분 초과 시 지각 처리`;
            };
            lateThresholdSelect.addEventListener('change', updateText);
            updateText();
        }

        let uploadedSignatureDataUrl = academy.directorSignature || '';

        const fileInput = container.querySelector('#acad-signature-file');
        const uploadBtn = container.querySelector('#btn-upload-signature');
        const deleteBtn = container.querySelector('#btn-delete-signature');
        const previewContainer = container.querySelector('#signature-preview-container');

        const updateDeleteButtonVisibility = (show) => {
            const btnContainer = container.querySelector('#btn-upload-signature').parentElement;
            let delBtn = btnContainer.querySelector('#btn-delete-signature');
            if (show) {
                if (!delBtn) {
                    const newDelBtn = document.createElement('button');
                    newDelBtn.type = 'button';
                    newDelBtn.id = 'btn-delete-signature';
                    newDelBtn.className = 'btn btn-danger';
                    newDelBtn.style = 'margin-bottom: 0; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 4px; background: var(--danger); border-color: var(--danger); color: white;';
                    newDelBtn.innerHTML = `<i class="fa-solid fa-trash"></i> 삭제`;
                    newDelBtn.addEventListener('click', handleDelete);
                    btnContainer.appendChild(newDelBtn);
                }
            } else {
                if (delBtn) {
                    delBtn.remove();
                }
            }
        };

        const handleDelete = () => {
            uploadedSignatureDataUrl = '';
            previewContainer.innerHTML = `<span style="color: #bbb; font-size: 0.75rem;">이미지 없음</span>`;
            if (fileInput) fileInput.value = '';
            updateDeleteButtonVisibility(false);
        };

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxDim = 150;
                            let width = img.width;
                            let height = img.height;
                            if (width > height) {
                                if (width > maxDim) {
                                    height = Math.round((height * maxDim) / width);
                                    width = maxDim;
                                }
                            } else {
                                if (height > maxDim) {
                                    width = Math.round((width * maxDim) / height);
                                    height = maxDim;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            uploadedSignatureDataUrl = canvas.toDataURL('image/png');
                            previewContainer.innerHTML = `<img src="${uploadedSignatureDataUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                            updateDeleteButtonVisibility(true);
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', handleDelete);
        }

        // Binders
        const phoneInput = PhoneNumberInput.bind(phoneInputEl, phoneError, true);
        const addressInput = AddressInput.bind({
            postcodeEl,
            addressEl,
            detailAddressEl,
            searchBtnEl: searchAddressBtn
        });

        // Biz number formatter
        bizInput.addEventListener('input', (e) => {
            e.target.value = formatBusinessNumber(e.target.value);
            bizError.style.display = 'none';
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // Validate phone
            if (!phoneInput.isValid()) {
                phoneInputEl.focus();
                return;
            }

            // Validate business number
            const bizVal = bizInput.value.replace(/[^0-9]/g, '');
            if (bizVal.length !== 10) {
                bizError.textContent = '사업자등록번호는 10자리 숫자여야 합니다 (000-00-00000).';
                bizError.style.display = 'block';
                bizInput.focus();
                return;
            }

            // Validate passwords
            const sysPw = sysPwInput.value;
            const tabPw = tabPwInput.value;
            if (!/^\d{4}$/.test(sysPw)) {
                sysPwError.textContent = '시스템 비밀번호는 4자리 숫자여야 합니다.';
                sysPwError.style.display = 'block';
                sysPwInput.focus();
                return;
            } else {
                sysPwError.style.display = 'none';
            }

            if (!/^\d{4}$/.test(tabPw)) {
                tabPwError.textContent = '태블릿 출결 비밀번호는 4자리 숫자여야 합니다.';
                tabPwError.style.display = 'block';
                tabPwInput.focus();
                return;
            } else {
                tabPwError.style.display = 'none';
            }

            try {
                const lateThresholdVal = parseInt(container.querySelector('#acad-late-threshold').value);
                stateStore.setLateThresholdMinutes(lateThresholdVal);

                stateStore.updateAcademy(academy.id, {
                    name: nameInput.value.trim(),
                    ownerName: ownerInput.value.trim(),
                    phone: phoneInputEl.value.trim(),
                    businessRegistrationNumber: bizInput.value.trim(),
                    postcode: postcodeEl.value.trim(),
                    address: addressEl.value.trim(),
                    detailAddress: detailAddressEl.value.trim(),
                    systemPassword: sysPw,
                    tabletPassword: tabPw,
                    directorSignature: uploadedSignatureDataUrl
                });

                showKakaoTalkToast("학원 정보 및 시간표 설정이 성공적으로 저장되었습니다.");
            } catch (err) {
                alert(err.message || '저장 도중 오류가 발생했습니다.');
            }
        });

        cleanupFn = () => {
            phoneInput.destroy();
            if (addressInput && typeof addressInput.destroy === 'function') {
                addressInput.destroy();
            }
        };
    };

    const renderAuthScreen = () => {
        container.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; min-height: 450px;">
                <div class="glass-card" style="width: 100%; max-width: 400px; padding: 2.5rem; text-align: center;">
                    <div style="font-size: 3rem; color: var(--primary); margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">학원정보 관리 인증</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4;">
                        학원 핵심 정보 및 시스템 설정을 수정하려면<br><strong>시스템 비밀번호</strong>를 입력해야 합니다.
                    </p>
                    <div class="form-group" style="margin-bottom: 1.5rem; text-align: left;">
                        <label for="academy-auth-password" style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 6px;">시스템 비밀번호 (4자리)</label>
                        <input type="password" id="academy-auth-password" class="form-control" placeholder="••••" maxlength="4" style="text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem; height: 50px; margin-bottom: 0;">
                        <span id="academy-auth-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 6px;"></span>
                    </div>
                    <button id="btn-submit-academy-auth" class="btn btn-primary" style="width: 100%; padding: 12px; font-weight: bold; justify-content: center; margin-bottom: 0;">인증하기</button>
                </div>
            </div>
        `;

        const passwordInput = container.querySelector('#academy-auth-password');
        const submitBtn = container.querySelector('#btn-submit-academy-auth');
        const feedback = container.querySelector('#academy-auth-feedback');

        const doAuth = () => {
            const val = passwordInput.value;
            if (val === academy.systemPassword) {
                isAcademyInfoAuthenticated = true;
                renderEditForm();
            } else {
                feedback.textContent = '비밀번호 오류';
                feedback.style.display = 'block';
                passwordInput.value = '';
                passwordInput.focus();
            }
        };

        submitBtn.addEventListener('click', doAuth);
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doAuth();
        });
    };

    if (isAcademyInfoAuthenticated) {
        renderEditForm();
    } else {
        renderAuthScreen();
    }

    return () => {
        isAcademyInfoAuthenticated = false;
        if (cleanupFn) {
            cleanupFn();
        }
    };
}
