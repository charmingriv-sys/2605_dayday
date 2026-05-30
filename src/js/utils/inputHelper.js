// inputHelper.js - Common Helper Components for Phone Numbers and Address Inputs

export function formatPhoneNumber(val, isAcademy = false) {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (!isAcademy) {
        if (cleaned.length <= 3) {
            return cleaned;
        }
        if (cleaned.length <= 7) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        }
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
    }

    // Academy phone format (allows 02, 031, 070, 0507, 010, etc.)
    if (cleaned.startsWith('02')) {
        if (cleaned.length <= 2) return cleaned;
        if (cleaned.length <= 5) return `02-${cleaned.slice(2)}`;
        if (cleaned.length <= 9) return `02-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
        return `02-${cleaned.slice(2, 6)}-${cleaned.slice(6, 10)}`;
    } else {
        // 3-digit prefixes (010, 031, 070, etc.) or 4-digit (0507, etc.)
        let prefixLen = 3;
        if (cleaned.startsWith('050')) { // e.g. 0507, 0505
            prefixLen = 4;
        }
        if (cleaned.length <= prefixLen) return cleaned;
        const prefix = cleaned.slice(0, prefixLen);
        const rest = cleaned.slice(prefixLen);
        if (rest.length <= 3) {
            return `${prefix}-${rest}`;
        } else if (rest.length <= 7) {
            return `${prefix}-${rest.slice(0, 3)}-${rest.slice(3)}`;
        } else {
            return `${prefix}-${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
        }
    }
}

export class PhoneNumberInput {
    static bind(inputEl, errorEl = null, isAcademy = false) {
        if (!inputEl) return null;

        // Create error message element if not provided
        if (!errorEl) {
            const nextEl = inputEl.nextElementSibling;
            if (nextEl && nextEl.classList.contains('phone-error-msg')) {
                errorEl = nextEl;
            } else {
                errorEl = document.createElement('span');
                errorEl.className = 'phone-error-msg input-error-msg';
                errorEl.style.color = 'var(--danger)';
                errorEl.style.fontSize = '0.75rem';
                errorEl.style.marginTop = '4px';
                errorEl.style.display = 'none';
                inputEl.parentNode.insertBefore(errorEl, inputEl.nextSibling);
            }
        }

        const validate = () => {
            if (inputEl.disabled) {
                errorEl.style.display = 'none';
                return true;
            }

            const val = inputEl.value.trim();
            if (val.length === 0) {
                // If it is required, HTML5 validation will block submit.
                // We don't show custom phone error if it's just empty.
                errorEl.style.display = 'none';
                return !inputEl.required;
            }

            const cleaned = val.replace(/[^0-9]/g, '');

            if (!isAcademy) {
                if (!cleaned.startsWith('010')) {
                    errorEl.textContent = '연락처는 010으로 시작해야 합니다.';
                    errorEl.style.display = 'block';
                    inputEl.style.borderColor = 'var(--danger)';
                    return false;
                }

                const parts = val.split('-');
                if (parts.length < 2 || parts[1].length !== 4) {
                    errorEl.textContent = '가운데 번호는 4자리로 입력해주세요.';
                    errorEl.style.display = 'block';
                    inputEl.style.borderColor = 'var(--danger)';
                    return false;
                }

                if (parts.length < 3 || parts[2].length !== 4) {
                    errorEl.textContent = '마지막 번호는 4자리로 입력해주세요.';
                    errorEl.style.display = 'block';
                    inputEl.style.borderColor = 'var(--danger)';
                    return false;
                }

                const regex = /^010-\d{4}-\d{4}$/;
                if (!regex.test(val)) {
                    errorEl.textContent = '연락처 형식에 맞게 입력해주세요.';
                    errorEl.style.display = 'block';
                    inputEl.style.borderColor = 'var(--danger)';
                    return false;
                }
            } else {
                const regex = /^(02|0[3-6]\d|070|050\d|01\d)-\d{3,4}-\d{4}$/;
                if (!regex.test(val)) {
                    errorEl.textContent = '전화번호 형식에 맞게 입력해주세요.';
                    errorEl.style.display = 'block';
                    inputEl.style.borderColor = 'var(--danger)';
                    return false;
                }
            }

            errorEl.style.display = 'none';
            inputEl.style.borderColor = '';
            return true;
        };

        const handleInput = (e) => {
            const originalVal = e.target.value;
            const cursorPosition = e.target.selectionStart;
            const formatted = formatPhoneNumber(originalVal, isAcademy);
            e.target.value = formatted;

            // Restore cursor position roughly
            const diff = formatted.length - originalVal.length;
            const newCursor = cursorPosition + diff;
            e.target.setSelectionRange(newCursor, newCursor);

            validate();
        };

        inputEl.addEventListener('input', handleInput);
        inputEl.addEventListener('blur', validate);

        // Run initial validation
        validate();

        return {
            validate,
            isValid: () => validate(),
            destroy: () => {
                inputEl.removeEventListener('input', handleInput);
                inputEl.removeEventListener('blur', validate);
            }
        };
    }
}

export class AddressInput {
    static bind({ postcodeEl, addressEl, detailAddressEl, searchBtnEl, errorEl = null }) {
        if (!postcodeEl || !addressEl || !detailAddressEl || !searchBtnEl) return null;

        postcodeEl.readOnly = true;
        addressEl.readOnly = true;

        if (!errorEl) {
            const parent = detailAddressEl.parentNode;
            const existingError = parent.querySelector('.address-error-msg');
            if (existingError) {
                errorEl = existingError;
            } else {
                errorEl = document.createElement('span');
                errorEl.className = 'address-error-msg input-error-msg';
                errorEl.style.color = 'var(--danger)';
                errorEl.style.fontSize = '0.75rem';
                errorEl.style.marginTop = '4px';
                errorEl.style.display = 'none';
                parent.appendChild(errorEl);
            }
        }

        const validate = () => {
            const pc = postcodeEl.value.trim();
            const addr = addressEl.value.trim();
            const det = detailAddressEl.value.trim();

            if (pc.length === 0 && addr.length === 0 && det.length === 0) {
                errorEl.style.display = 'none';
                detailAddressEl.style.borderColor = '';
                return true;
            }

            if (pc.length === 0 || addr.length === 0) {
                errorEl.textContent = '주소 검색을 통해 기본 주소를 입력해주세요.';
                errorEl.style.display = 'block';
                detailAddressEl.style.borderColor = 'var(--danger)';
                return false;
            }

            if (det.length === 0) {
                errorEl.textContent = '상세주소를 입력해주세요.';
                errorEl.style.display = 'block';
                detailAddressEl.style.borderColor = 'var(--danger)';
                return false;
            }

            errorEl.style.display = 'none';
            detailAddressEl.style.borderColor = '';
            return true;
        };

        const handleSearch = (e) => {
            e.preventDefault();
            if (typeof kakao === 'undefined' || !kakao.Postcode) {
                alert('카카오 우편번호 서비스 API가 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');
                return;
            }
            new kakao.Postcode({
                oncomplete: (data) => {
                    const zonecode = data.zonecode;
                    const address = data.roadAddress || data.jibunAddress;

                    postcodeEl.value = zonecode;
                    addressEl.value = address;
                    
                    // Trigger input event for frameworks/listeners
                    postcodeEl.dispatchEvent(new Event('input'));
                    addressEl.dispatchEvent(new Event('input'));

                    errorEl.style.display = 'none';
                    detailAddressEl.style.borderColor = '';
                    
                    detailAddressEl.focus();
                    validate();
                }
            }).open();
        };

        searchBtnEl.addEventListener('click', handleSearch);
        detailAddressEl.addEventListener('input', validate);
        detailAddressEl.addEventListener('blur', validate);

        return {
            validate,
            isValid: () => {
                const pc = postcodeEl.value.trim();
                const addr = addressEl.value.trim();
                const det = detailAddressEl.value.trim();
                return pc.length > 0 && addr.length > 0 && det.length > 0;
            },
            destroy: () => {
                searchBtnEl.removeEventListener('click', handleSearch);
                detailAddressEl.removeEventListener('input', validate);
                detailAddressEl.removeEventListener('blur', validate);
            }
        };
    }
}
