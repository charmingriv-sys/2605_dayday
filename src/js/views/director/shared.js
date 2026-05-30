export function formatPhoneNumber(value) {
    if (!value) return value;
    const clean = value.replace(/[^\d]/g, '');
    const digits = clean.slice(0, 11);
    const len = digits.length;
    if (len < 4) {
        return digits;
    } else if (len < 8) {
        return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
}

export function isIncompleteStudent(student) {
    if (!student) return false;
    // Incomplete status logic:
    // 1. Both contacts are missing/empty/null/None
    const hasPhone = student.phone && student.phone !== '없음' && String(student.phone).trim() !== '';
    const hasParentPhone = student.parentPhone && student.parentPhone !== '없음' && String(student.parentPhone).trim() !== '';
    const contactMissing = !hasPhone && !hasParentPhone;

    // 2. Teacher is missing/empty
    const teacherMissing = !student.teacherId;

    // 3. Billing due day is missing
    const dueDayMissing = student.dueDay === undefined || student.dueDay === null || student.dueDay === '';

    // 4. Tuition fee is missing or null
    const feeMissing = student.fee === undefined || student.fee === null || student.fee === '';

    return contactMissing || teacherMissing || dueDayMissing || feeMissing;
}

export const showKakaoTalkToast = (message) => {
    const event = new CustomEvent('kakaotalk-alert', {
        detail: { message }
    });
    window.dispatchEvent(event);
};

export const showLocalConfirm = (container, message, onYes) => {
    container.style.position = 'relative';
    const confirmOverlay = document.createElement('div');
    confirmOverlay.style.position = 'absolute';
    confirmOverlay.style.top = '0';
    confirmOverlay.style.left = '0';
    confirmOverlay.style.width = '100%';
    confirmOverlay.style.height = '100%';
    confirmOverlay.style.background = 'rgba(15, 23, 42, 0.8)';
    confirmOverlay.style.backdropFilter = 'blur(4px)';
    confirmOverlay.style.webkitBackdropFilter = 'blur(4px)';
    confirmOverlay.style.display = 'flex';
    confirmOverlay.style.flexDirection = 'column';
    confirmOverlay.style.justifyContent = 'center';
    confirmOverlay.style.alignItems = 'center';
    confirmOverlay.style.padding = '20px';
    confirmOverlay.style.boxSizing = 'border-box';
    confirmOverlay.style.borderRadius = 'var(--radius-lg)';
    confirmOverlay.style.zIndex = '100';

    confirmOverlay.innerHTML = `
        <div style="background: #ffffff; padding: 24px; max-width: 320px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; border-radius: var(--radius-lg); box-sizing: border-box; transition: none;">
            <p style="font-size: 1rem; font-weight: 700; color: #000000; margin-bottom: 20px; line-height: 1.5; text-align: center; font-family: inherit;">${message}</p>
            <div style="display: flex; gap: 12px;">
                <button type="button" class="btn btn-secondary btn-confirm-no" style="flex: 1; display: flex; justify-content: center; align-items: center; height: 38px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-size: 0.9rem; font-weight: 600; margin: 0; padding: 0 16px; border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">아니오</button>
                <button type="button" class="btn btn-primary btn-confirm-yes" style="flex: 1; display: flex; justify-content: center; align-items: center; height: 38px; background: var(--primary); color: #ffffff; border: 1px solid var(--primary); font-size: 0.9rem; font-weight: 600; margin: 0; padding: 0 16px; border-radius: var(--radius-md); cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">예</button>
            </div>
        </div>
    `;

    container.appendChild(confirmOverlay);

    confirmOverlay.querySelector('.btn-confirm-no').addEventListener('click', () => {
        confirmOverlay.remove();
    });

    confirmOverlay.querySelector('.btn-confirm-yes').addEventListener('click', () => {
        confirmOverlay.remove();
        onYes();
    });
};

export const escapeHtml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export let openStudentDetailModalRef = null;
export function setOpenStudentDetailModal(fn) {
    openStudentDetailModalRef = fn;
}

