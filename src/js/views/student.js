// student.js - Views for Student/Parent Portal (Student S1: 최다은)
import { stateStore } from '../state.js';
import { openModal, closeModal } from '../app.js';

// Helper to format currency
const formatCurrency = (amount) => {
    return amount.toLocaleString() + '원';
};

// Helper to format date
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${y}년 ${m}월 ${d}일`;
};

// Map status to Korean and color classes
const STATUS_MAP = {
    present: { text: '등원', badge: 'badge-success', color: 'var(--success)' },
    late: { text: '지각', badge: 'badge-warning', color: 'var(--warning)' },
    absent: { text: '결석', badge: 'badge-danger', color: 'var(--danger)' }
};

// Map payment status
const PAYMENT_STATUS_MAP = {
    paid: { text: '납부 완료', badge: 'badge-success' },
    unpaid: { text: '미납', badge: 'badge-danger' }
};

// Map payment methods to readable Korean
const PAYMENT_METHOD_MAP = {
    toss: '토스페이',
    kakao: '카카오페이',
    card: '신용카드',
    cash: '현금'
};

// --- SIBLING SELECTOR HELPERS ---
function getActiveStudentId() {
    const user = stateStore.getCurrentUser();
    if (user && user.role === 'parent') {
        const siblings = stateStore.getStudentsForParent(user.id);
        if (siblings.length > 0) {
            const stored = sessionStorage.getItem('turing_active_student_id') || sessionStorage.getItem('harmonia_active_student_id');
            const valid = siblings.some(s => s.id === stored);
            if (valid) return stored;
            return siblings[0].id;
        }
    }
    return 'S1'; // fallback
}

function renderSiblingSelectorHeader(container, reRenderFn) {
    const user = stateStore.getCurrentUser();
    if (!user || user.role !== 'parent') return '';
    
    const siblings = stateStore.getStudentsForParent(user.id);
    if (siblings.length <= 1) return '';

    const activeId = getActiveStudentId();
    
    const selectHtml = `
        <div class="sibling-selector-container">
            <div class="sibling-selector-label">
                <i class="fa-solid fa-child-reaching" style="color: var(--primary);"></i>
                <span>학습 및 수납 정보를 조회할 자녀를 선택하세요:</span>
            </div>
            <select class="sibling-dropdown" id="app-sibling-select">
                ${siblings.map(s => `
                    <option value="${s.id}" ${s.id === activeId ? 'selected' : ''}>
                        ${s.name} (${s.instrument} | ${s.school || '학교 미지정'})
                    </option>
                `).join('')}
            </select>
        </div>
    `;
    
    return selectHtml;
}

function bindSiblingSelector(container, reRenderFn) {
    const select = container.querySelector('#app-sibling-select');
    if (select) {
        select.addEventListener('change', (e) => {
            sessionStorage.setItem('turing_active_student_id', e.target.value);
            reRenderFn();
        });
    }
}

// Calendar view for S1
export function renderCalendar(container) {
    const render = () => {
        const studentId = getActiveStudentId();
        const attendanceList = stateStore.getAttendanceForStudent(studentId);
        
        // Filter attendance for May 2026
        const mayAttendance = attendanceList.filter(a => a.date.startsWith('2026-05'));
        const presentCount = mayAttendance.filter(a => a.status === 'present').length;
        const lateCount = mayAttendance.filter(a => a.status === 'late').length;
        const absentCount = mayAttendance.filter(a => a.status === 'absent').length;

        // Calendar header days
        const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

        // Generate cells for May 2026
        const cells = [];
        // April 2026 padding: Apr 26 to Apr 30
        for (let d = 26; d <= 30; d++) {
            cells.push({ day: d, dateStr: `2026-04-${d}`, isCurrent: false });
        }
        // May 2026: May 1 to May 31
        for (let d = 1; d <= 31; d++) {
            const dayStr = String(d).padStart(2, '0');
            cells.push({ day: d, dateStr: `2026-05-${dayStr}`, isCurrent: true });
        }
        // June 2026 padding: Jun 1 to Jun 6
        for (let d = 1; d <= 6; d++) {
            const dayStr = String(d).padStart(2, '0');
            cells.push({ day: d, dateStr: `2026-06-${dayStr}`, isCurrent: false });
        }

        let cellsHtml = '';
        cells.forEach(cell => {
            if (!cell.isCurrent) {
                const record = attendanceList.find(a => a.date === cell.dateStr);
                const hasRecordClass = record ? 'has-record' : '';
                const pointerStyle = record ? 'style="cursor: pointer; background: rgba(9, 132, 227, 0.04);"' : '';
                
                let statusDot = '';
                if (record) {
                    statusDot = `<span class="calendar-day-status ${record.status}" title="${STATUS_MAP[record.status]?.text}"></span>`;
                }

                cellsHtml += `
                    <div class="calendar-day-cell other-month ${hasRecordClass}" data-date="${cell.dateStr}" ${pointerStyle}>
                        <span class="calendar-day-number">${cell.day}</span>
                        ${statusDot}
                    </div>
                `;
            } else {
                const record = attendanceList.find(a => a.date === cell.dateStr);
                const hasRecordClass = record ? 'has-record' : '';
                const pointerStyle = record ? 'style="cursor: pointer; background: rgba(9, 132, 227, 0.04);"' : '';
                
                let statusDot = '';
                if (record) {
                    statusDot = `<span class="calendar-day-status ${record.status}" title="${STATUS_MAP[record.status]?.text}"></span>`;
                }

                cellsHtml += `
                    <div class="calendar-day-cell ${hasRecordClass}" data-date="${cell.dateStr}" ${pointerStyle}>
                        <span class="calendar-day-number">${cell.day}</span>
                        ${statusDot}
                    </div>
                `;
            }
        });

        container.innerHTML = `
            ${renderSiblingSelectorHeader(container, render)}
            <div class="metrics-grid">
                <div class="glass-card metric-card">
                    <div class="metric-icon green">
                        <i class="fa-solid fa-calendar-check"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-value">${presentCount}회</span>
                        <span class="metric-label">등원 완료</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon cyan">
                        <i class="fa-solid fa-clock"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-value">${lateCount}회</span>
                        <span class="metric-label">지각</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon red">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-value">${absentCount}회</span>
                        <span class="metric-label">결석</span>
                    </div>
                </div>
            </div>

            <div class="glass-card" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
                    <h3 style="font-weight: 700; font-size: 1.25rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-calendar-days" style="color: var(--primary);"></i>
                        2026년 5월 출결 및 수업일지 캘린더
                    </h3>
                    <div style="display: flex; gap: 12px; font-size: 0.8rem;">
                        <span style="display: flex; align-items: center; gap: 6px; color: var(--text-muted);">
                            <span class="calendar-day-status present" style="margin: 0; display: inline-block;"></span> 등원
                        </span>
                        <span style="display: flex; align-items: center; gap: 6px; color: var(--text-muted);">
                            <span class="calendar-day-status late" style="margin: 0; display: inline-block;"></span> 지각
                        </span>
                        <span style="display: flex; align-items: center; gap: 6px; color: var(--text-muted);">
                            <span class="calendar-day-status absent" style="margin: 0; display: inline-block;"></span> 결석
                        </span>
                    </div>
                </div>

                <div class="attendance-calendar-grid">
                    ${daysOfWeek.map(d => `<div class="calendar-header-day">${d}</div>`).join('')}
                    ${cellsHtml}
                </div>
                
                <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); text-align: center;">
                    <i class="fa-solid fa-circle-info"></i> 출석 표시가 있는 날짜를 클릭하면 해당일 수업일지 내용을 확인할 수 있습니다.
                </p>
            </div>
        `;

        // Bind click events for records
        const recordCells = container.querySelectorAll('.calendar-day-cell.has-record');
        recordCells.forEach(cell => {
            cell.addEventListener('click', () => {
                const date = cell.dataset.date;
                const record = attendanceList.find(a => a.date === date);
                if (record) {
                    showAttendanceModal(record);
                }
            });
        });
        bindSiblingSelector(container, render);
    };

    render();

    const unsubscribe = stateStore.subscribe('ATTENDANCE_CHANGED', () => {
        render();
    });

    return () => {
        unsubscribe();
    };
}

function showAttendanceModal(record) {
    const statusInfo = STATUS_MAP[record.status] || { text: record.status, badge: 'badge-info' };
    const htmlContent = `
        <div class="modal-header">
            <h3 class="modal-title">출결 및 수업일지 상세 정보</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" style="padding-top: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.2rem;">
                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">
                    <i class="fa-solid fa-calendar-day" style="color: var(--primary); margin-right: 6px;"></i>
                    ${formatDate(record.date)}
                </div>
                <span class="badge ${statusInfo.badge}">${statusInfo.text}</span>
            </div>
            
            <div style="background: rgba(9, 132, 227, 0.02); border: 1px solid var(--border-color); padding: 1.2rem; border-radius: var(--radius-md); margin-bottom: 1.2rem;">
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.8rem; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-clock"></i>
                    <span>등원 기록 시간: ${record.time ? record.time : '기록 없음'}</span>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 0.8rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-main);">
                    <strong style="color: var(--secondary); display: block; margin-bottom: 6px;">
                        <i class="fa-solid fa-feather-pointed"></i> 선생님 수업일지
                    </strong>
                    <div style="white-space: pre-wrap;">${record.note || '선생님이 작성한 수업일지 코멘트가 없습니다.'}</div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" data-close-modal>닫기</button>
        </div>
    `;

    openModal(htmlContent);
}

// Billing view for S1
export function renderBilling(container) {
    const render = () => {
        const studentId = getActiveStudentId();
        const payments = stateStore.getPaymentsForStudent(studentId);
        
        // Sort payments by month descending (newest month first)
        payments.sort((a, b) => b.month.localeCompare(a.month));

        // Get unpaid count
        const unpaidCount = payments.filter(p => p.status === 'unpaid').length;
        const totalUnpaidAmount = payments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + p.amount, 0);

        let tableRowsHtml = '';
        if (payments.length === 0) {
            tableRowsHtml = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-receipt" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; color: var(--text-muted);"></i>
                        청구된 수강료 내역이 없습니다.
                    </td>
                </tr>
            `;
        } else {
            payments.forEach(p => {
                const statusInfo = PAYMENT_STATUS_MAP[p.status] || { text: p.status, badge: 'badge-info' };
                
                let methodInfo = '-';
                if (p.status === 'paid') {
                    const methodText = PAYMENT_METHOD_MAP[p.method] || p.method || '일반';
                    methodInfo = `${p.paidDate ? p.paidDate : '-'} (${methodText})`;
                }

                let actionButtonHtml = '-';
                if (p.status === 'unpaid') {
                    actionButtonHtml = `
                        <button class="btn btn-success btn-sm btn-pay" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.8rem; font-weight: bold; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-wallet"></i> 모의 결제하기
                        </button>
                    `;
                }

                tableRowsHtml += `
                    <tr>
                        <td><strong>${p.month}</strong></td>
                        <td style="font-weight: 600; color: var(--text-main);">${formatCurrency(p.amount)}</td>
                        <td>${p.invoiceDate}</td>
                        <td><span class="badge ${statusInfo.badge}">${statusInfo.text}</span></td>
                        <td style="font-size: 0.85rem; color: var(--text-muted);">${methodInfo}</td>
                        <td>${actionButtonHtml}</td>
                    </tr>
                `;
            });
        }

        container.innerHTML = `
            ${renderSiblingSelectorHeader(container, render)}
            <div class="metrics-grid">
                <div class="glass-card metric-card">
                    <div class="metric-icon red">
                        <i class="fa-solid fa-receipt"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-value">${unpaidCount}건</span>
                        <span class="metric-label">미납 수강료</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon purple">
                        <i class="fa-solid fa-won-sign"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-value">${formatCurrency(totalUnpaidAmount)}</span>
                        <span class="metric-label">결제 대기 총액</span>
                    </div>
                </div>
            </div>

            <div class="glass-card" style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 12px;">
                    <h3 style="font-weight: 700; font-size: 1.25rem; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-receipt" style="color: var(--primary);"></i>
                        수강료 청구 및 납부 현황
                    </h3>
                    <button class="btn btn-secondary" id="btn-create-mock-invoice" style="padding: 8px 14px; font-size: 0.8rem; font-weight: 600;">
                        <i class="fa-solid fa-plus-circle" style="color: var(--accent);"></i> 테스트 청구서 생성
                    </button>
                </div>

                <div class="table-wrapper">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>청구월</th>
                                <th>청구 금액</th>
                                <th>청구일자</th>
                                <th>납부 상태</th>
                                <th>납부 완료일 (결제수단)</th>
                                <th>결제 처리</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>
                
                <p style="margin-top: 1.2rem; font-size: 0.85rem; color: var(--text-muted); text-align: left; line-height: 1.5;">
                    <i class="fa-solid fa-circle-info"></i> 모의 결제하기 버튼을 클릭하면 토스페이, 카카오페이를 연동한 가상 결제 시뮬레이터 창이 실행됩니다.<br>
                    <i class="fa-solid fa-circle-info"></i> 상단의 '테스트 청구서 생성' 버튼을 클릭하면 테스트를 위한 다음 달 미납 청구서를 즉시 발행합니다.
                </p>
            </div>
        `;

        // Bind mock billing invoice creation
        const createMockBtn = container.querySelector('#btn-create-mock-invoice');
        if (createMockBtn) {
            createMockBtn.addEventListener('click', () => {
                const s1Payments = stateStore.getPaymentsForStudent(studentId);
                let nextMonth = '2026-06';
                if (s1Payments.length > 0) {
                    const months = s1Payments.map(p => p.month);
                    months.sort();
                    const maxMonth = months[months.length - 1]; // e.g. "2026-05"
                    const [year, month] = maxMonth.split('-').map(Number);
                    let nextM = month + 1;
                    let nextY = year;
                    if (nextM > 12) {
                        nextM = 1;
                        nextY += 1;
                    }
                    nextMonth = `${nextY}-${String(nextM).padStart(2, '0')}`;
                }
                
                // Add new mock invoice
                stateStore.createInvoice(studentId, 150000, nextMonth);
            });
        }

        // Bind pay buttons click
        const payBtns = container.querySelectorAll('.btn-pay');
        payBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const paymentId = btn.dataset.id;
                const invoice = payments.find(p => p.id === paymentId);
                if (invoice) {
                    openPaymentModal(invoice);
                }
            });
        });
        bindSiblingSelector(container, render);
    };

    render();

    const unsubscribe = stateStore.subscribe('PAYMENTS_CHANGED', () => {
        render();
    });

    return () => {
        unsubscribe();
    };
}

function openPaymentModal(invoice) {
    const htmlContent = `
        <div class="modal-header">
            <h3 class="modal-title">튜링 결제 시뮬레이터</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" id="payment-modal-body" style="padding-top: 10px;">
            <div style="background: rgba(9, 132, 227, 0.02); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius-md); text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 6px;">청구 대상월: ${invoice.month}</div>
                <div style="font-size: 1.8rem; font-weight: 700; color: var(--text-main);">${formatCurrency(invoice.amount)}</div>
            </div>
            
            <div class="simulator-box" style="margin: 0; border-color: var(--border-color); background: rgba(9, 132, 227, 0.02); text-align: center;">
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px; line-height: 1.4;">
                    <i class="fa-solid fa-shield-halved" style="color: var(--accent); margin-right: 4px;"></i>
                    본 결제는 모의 결제이며 실제로 결제 금액이 청구되지 않습니다.
                </div>
                <div class="pay-btn-group">
                    <button class="btn btn-pay-kakao" id="pay-kakao-btn" style="justify-content: center; height: 50px; font-weight: bold; border-radius: var(--radius-md); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-comment" style="font-size: 1.2rem;"></i> 카카오페이 결제
                    </button>
                    <button class="btn btn-pay-toss" id="pay-toss-btn" style="justify-content: center; height: 50px; font-weight: bold; border-radius: var(--radius-md); display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-wallet" style="font-size: 1.2rem;"></i> 토스페이 결제
                    </button>
                </div>
            </div>
        </div>
    `;

    openModal(htmlContent, (modalContent) => {
        const payKakaoBtn = modalContent.querySelector('#pay-kakao-btn');
        const payTossBtn = modalContent.querySelector('#pay-toss-btn');

        const processPay = (method) => {
            const methodText = method === 'kakao' ? '카카오페이' : '토스페이';
            const brandColor = method === 'kakao' ? '#fee500' : '#0064ff';
            
            // 1. Show Mock Spinner Screen
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h3 class="modal-title">${methodText} 간편 결제</h3>
                    <button class="modal-close" data-close-modal>&times;</button>
                </div>
                <div class="modal-body" style="text-align: center; padding: 3rem 1.5rem;">
                    <div style="margin-bottom: 2rem; display: inline-block; position: relative;">
                        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3.8rem; color: ${method === 'kakao' ? 'var(--warning)' : 'var(--primary)'};"></i>
                    </div>
                    <h4 style="font-size: 1.2rem; color: var(--text-main); margin-bottom: 0.6rem; font-weight: 700;">결제 승인 진행 중</h4>
                    <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.5;">
                        선택하신 결제 수단으로 보안 승인을 수행하고 있습니다.<br>
                        결제가 완료될 때까지 브라우저를 종료하지 마십시오.
                    </p>
                </div>
            `;

            // Bind close triggers on spinner screen
            modalContent.querySelector('[data-close-modal]').addEventListener('click', closeModal);

            // 2. Delayed execution
            setTimeout(() => {
                // Perform state modification
                stateStore.payInvoice(invoice.id, method);

                // 3. Show animated success screen
                modalContent.innerHTML = `
                    <div class="modal-header">
                        <h3 class="modal-title">결제 완료</h3>
                        <button class="modal-close" data-close-modal>&times;</button>
                    </div>
                    <div class="modal-body" style="text-align: center; padding: 2.5rem 1.5rem;">
                        <div style="margin-bottom: 1.5rem; display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 50%; background: var(--success-light); border: 2px solid var(--success); color: var(--success); font-size: 2.5rem; animation: pulse 2s infinite ease-in-out;">
                            <i class="fa-solid fa-check"></i>
                        </div>
                        <h4 style="font-size: 1.3rem; color: var(--text-main); margin-bottom: 0.8rem; font-weight: 700;">결제 완료되었습니다!</h4>
                        <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 2rem;">
                            수강료가 안전하게 승인되어 납부 처리되었습니다.<br>
                            <strong>결제 방식:</strong> ${methodText}<br>
                            <strong>납부 금액:</strong> ${formatCurrency(invoice.amount)}
                        </p>
                        <button class="btn btn-primary" id="btn-payment-success-close" style="width: 100%; justify-content: center; font-weight: bold; height: 46px; border-radius: var(--radius-md);">
                            확인
                        </button>
                    </div>
                `;

                // Bind close clicks
                modalContent.querySelector('[data-close-modal]').addEventListener('click', closeModal);
                modalContent.querySelector('#btn-payment-success-close').addEventListener('click', closeModal);
            }, 1800); // 1.8 second delay for realism
        };

        if (payKakaoBtn) {
            payKakaoBtn.addEventListener('click', () => processPay('kakao'));
        }
        if (payTossBtn) {
            payTossBtn.addEventListener('click', () => processPay('toss'));
        }
    });
}

// Journal view for S1
export function renderJournal(container) {
    const render = () => {
        const studentId = getActiveStudentId();
        const attendance = stateStore.getAttendanceForStudent(studentId);
        
        // Retrieve student S1 details and their teacher
        const student = stateStore.getStudent(studentId);
        const teacher = student ? stateStore.getTeacher(student.teacherId) : null;

        // Sort attendance chronologically descending (latest first)
        attendance.sort((a, b) => b.date.localeCompare(a.date));

        let timelineHtml = '';
        if (attendance.length === 0) {
            timelineHtml = `
                <div class="glass-card" style="text-align: center; padding: 4rem 2rem; color: var(--text-muted); margin-top: 1.5rem;">
                    <i class="fa-solid fa-feather-pointed" style="font-size: 3rem; margin-bottom: 1.2rem; display: block; color: var(--text-muted);"></i>
                    <h3>기록된 수업일지가 없습니다.</h3>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">선생님이 수업일지 및 코멘트를 등록하면 여기에 표시됩니다.</p>
                </div>
            `;
        } else {
            attendance.forEach(record => {
                const statusInfo = STATUS_MAP[record.status] || { text: record.status, badge: 'badge-info', color: 'var(--primary)' };
                
                timelineHtml += `
                    <div class="glass-card" style="margin-bottom: 1.5rem; border-left: 4px solid ${statusInfo.color}; background: var(--bg-card); transition: var(--transition);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="fa-solid fa-calendar-day" style="color: var(--primary);"></i>
                                <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-main);">${formatDate(record.date)}</span>
                                ${record.time ? `<span style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-solid fa-clock" style="margin-right: 4px;"></i>${record.time}</span>` : ''}
                            </div>
                            <span class="badge ${statusInfo.badge}">${statusInfo.text}</span>
                        </div>
                        <div style="background: rgba(9, 132, 227, 0.02); border: 1px solid var(--border-color); padding: 1.2rem; border-radius: var(--radius-md);">
                            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">
                                <i class="fa-solid fa-clipboard-user" style="color: var(--accent); margin-right: 6px;"></i>수업일지 및 코멘트
                            </div>
                            <div style="font-size: 0.95rem; line-height: 1.6; color: var(--text-main); white-space: pre-wrap;">${record.note || '이날은 별도의 수업일지 코멘트가 등록되지 않았습니다.'}</div>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = `
            ${renderSiblingSelectorHeader(container, render)}
            <div class="glass-card" style="margin-bottom: 2rem; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; background: linear-gradient(135deg, rgba(9, 132, 227, 0.08) 0%, rgba(116, 185, 255, 0.04) 100%); border-color: rgba(9, 132, 227, 0.15);">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: white; box-shadow: var(--shadow-glow);">
                    <i class="fa-solid fa-chalkboard-user"></i>
                </div>
                <div>
                    <h3 style="font-weight: 700; font-size: 1.2rem; color: var(--text-main); margin-bottom: 4px;">
                        ${teacher ? `${teacher.name} 선생님 피드백 센터` : '담당 강사 정보 없음'}
                    </h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">
                        수강 원생: <strong>${student ? student.name : '최다은'}</strong> | 수강 과목: <strong>${student ? student.instrument : '피아노'}</strong> ${teacher ? `| 선생님 연락처: ${teacher.phone}` : ''}
                    </p>
                </div>
            </div>

            <div style="margin-top: 1rem;">
                ${timelineHtml}
            </div>
        `;
        bindSiblingSelector(container, render);
    };

    render();

    const unsubscribe = stateStore.subscribe('ATTENDANCE_CHANGED', () => {
        render();
    });

    return () => {
        unsubscribe();
    };
}

const escapeHtml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export function renderStudentCommunication(container) {
    let activeSubTab = 'announcements'; // 'announcements', 'messages', 'surveys'
    let studentId = getActiveStudentId();

    const render = () => {
        studentId = getActiveStudentId();
        const announcements = stateStore.getAnnouncements().sort((a, b) => b.date.localeCompare(a.date));
        const messages = stateStore.getMessagesForStudent(studentId).sort((a, b) => b.date.localeCompare(a.date));
        const surveys = stateStore.getSurveys().sort((a, b) => b.date.localeCompare(a.date));

        // Get unread count for messages
        const unreadMsgCount = messages.filter(m => !m.isRead).length;
        // Get unanswered survey count
        const unansweredSurveyCount = surveys.filter(s => s.isActive && !stateStore.hasStudentAnsweredSurvey(s.id, studentId)).length;

        container.innerHTML = `
            ${renderSiblingSelectorHeader(container, render)}
            <div class="glass-card" style="padding: 1.8rem; min-height: 500px; background: rgba(255, 255, 255, 0.7); border: 1px solid var(--border-color);">
                <!-- Tab Menu Header -->
                <div style="display: flex; gap: 10px; margin-bottom: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; flex-wrap: wrap;">
                    <button class="btn ${activeSubTab === 'announcements' ? 'btn-primary' : 'btn-secondary'}" id="tab-stu-ann" style="border-radius: 20px; font-weight: 700; padding: 8px 16px;">
                        <i class="fa-solid fa-bullhorn" style="margin-right: 4px;"></i> 공지사항
                    </button>
                    <button class="btn ${activeSubTab === 'messages' ? 'btn-primary' : 'btn-secondary'}" id="tab-stu-msg" style="border-radius: 20px; font-weight: 700; padding: 8px 16px; position: relative;">
                        <i class="fa-solid fa-envelope" style="margin-right: 4px;"></i> 개별 안내
                        ${unreadMsgCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.65rem; display: flex; align-items: center; justify-content: center; font-weight: bold;">${unreadMsgCount}</span>` : ''}
                    </button>
                    <button class="btn ${activeSubTab === 'surveys' ? 'btn-primary' : 'btn-secondary'}" id="tab-stu-surv" style="border-radius: 20px; font-weight: 700; padding: 8px 16px; position: relative;">
                        <i class="fa-solid fa-square-poll-vertical" style="margin-right: 4px;"></i> 설문
                        ${unansweredSurveyCount > 0 ? `<span style="position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.65rem; display: flex; align-items: center; justify-content: center; font-weight: bold;">${unansweredSurveyCount}</span>` : ''}
                    </button>
                </div>

                <!-- Sub-tab Content Area -->
                <div id="student-communication-content">
                    ${renderSubTabContent(announcements, messages, surveys)}
                </div>
            </div>
        `;

        // Bind events
        container.querySelector('#tab-stu-ann').addEventListener('click', () => {
            activeSubTab = 'announcements';
            render();
        });
        container.querySelector('#tab-stu-msg').addEventListener('click', () => {
            activeSubTab = 'messages';
            render();
        });
        container.querySelector('#tab-stu-surv').addEventListener('click', () => {
            activeSubTab = 'surveys';
            render();
        });

        // Bind list item click events
        if (activeSubTab === 'announcements') {
            container.querySelectorAll('.announcement-card-item').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    const ann = announcements.find(a => a.id === id);
                    if (ann) {
                        stateStore.incrementAnnouncementViews(ann.id);
                        openAnnouncementDetailModal(ann);
                    }
                });
            });
        } else if (activeSubTab === 'messages') {
            container.querySelectorAll('.message-card-item').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    const msg = messages.find(m => m.id === id);
                    if (msg) {
                        stateStore.markMessageAsRead(msg.id);
                        openMessageDetailModal(msg);
                    }
                });
            });
        } else if (activeSubTab === 'surveys') {
            container.querySelectorAll('.survey-card-item').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    const surv = surveys.find(s => s.id === id);
                    if (surv) {
                        openSurveyResponseModal(surv);
                    }
                });
            });
        }
    };

    const renderSubTabContent = (announcements, messages, surveys) => {
        if (activeSubTab === 'announcements') {
            if (announcements.length === 0) {
                return `<div style="text-align: center; color: var(--text-muted); padding: 4rem 2rem;">등록된 공지사항이 없습니다.</div>`;
            }
            return `
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    ${announcements.map(ann => `
                        <div class="announcement-card-item glass-card" data-id="${ann.id}" style="padding: 1.2rem; cursor: pointer; border: 1px solid var(--border-color); transition: transform 0.2s, box-shadow 0.2s; background: #ffffff;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <h4 style="margin: 0; font-weight: 700; color: var(--text-main); font-size: 1.05rem;">${escapeHtml(ann.title)}</h4>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">${ann.date}</span>
                            </div>
                            <p style="margin: 0 0 10px 0; color: var(--text-muted); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(ann.content)}
                            </p>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                                <span style="color: var(--primary); font-weight: bold;">조회수 ${ann.views || 0}회</span>
                                <span style="color: var(--text-muted);">자세히 보기 <i class="fa-solid fa-chevron-right" style="font-size: 0.75rem;"></i></span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (activeSubTab === 'messages') {
            if (messages.length === 0) {
                return `<div style="text-align: center; color: var(--text-muted); padding: 4rem 2rem;">수신된 개별 안내가 없습니다.</div>`;
            }
            return `
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    ${messages.map(msg => `
                        <div class="message-card-item glass-card" data-id="${msg.id}" style="padding: 1.2rem; cursor: pointer; border: 1px solid ${msg.isRead ? 'var(--border-color)' : 'rgba(9, 132, 227, 0.3)'}; transition: transform 0.2s, box-shadow 0.2s; background: ${msg.isRead ? '#ffffff' : 'rgba(9, 132, 227, 0.02)'}; position: relative;">
                            ${!msg.isRead ? `<span style="position: absolute; top: 12px; left: 12px; width: 8px; height: 8px; background: var(--danger); border-radius: 50%;"></span>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-left: ${msg.isRead ? '0' : '12px'};">
                                <h4 style="margin: 0; font-weight: 700; color: var(--text-main); font-size: 1.05rem;">
                                    ${escapeHtml(msg.title)}
                                </h4>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">${msg.date}</span>
                            </div>
                            <p style="margin: 0 0 10px 0; color: var(--text-muted); font-size: 0.9rem; padding-left: ${msg.isRead ? '0' : '12px'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(msg.content)}
                            </p>
                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; padding-left: ${msg.isRead ? '0' : '12px'};">
                                <span>
                                    ${msg.isRead 
                                        ? `<span style="color: var(--text-muted);"><i class="fa-solid fa-envelope-open" style="margin-right: 4px;"></i> 읽음</span>` 
                                        : `<span style="color: var(--danger); font-weight: bold;"><i class="fa-solid fa-envelope" style="margin-right: 4px;"></i> 읽지 않음</span>`
                                    }
                                </span>
                                <span style="color: var(--text-muted);">자세히 보기 <i class="fa-solid fa-chevron-right" style="font-size: 0.75rem;"></i></span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (activeSubTab === 'surveys') {
            if (surveys.length === 0) {
                return `<div style="text-align: center; color: var(--text-muted); padding: 4rem 2rem;">등록된 설문이 없습니다.</div>`;
            }
            return `
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    ${surveys.map(surv => {
                        const hasAnswered = stateStore.hasStudentAnsweredSurvey(surv.id, studentId);
                        const statusBadge = hasAnswered 
                            ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 제출 완료</span>`
                            : (surv.isActive 
                                ? `<span class="badge badge-warning" style="background: var(--primary); color: white;"><i class="fa-solid fa-circle-question"></i> 설문 참여 대기</span>`
                                : `<span class="badge" style="background: #bdc3c7; color: white;">종료됨</span>`);
                        
                        return `
                            <div class="survey-card-item glass-card" data-id="${surv.id}" style="padding: 1.2rem; cursor: pointer; border: 1px solid var(--border-color); transition: transform 0.2s, box-shadow 0.2s; background: #ffffff;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                    <h4 style="margin: 0; font-weight: 700; color: var(--text-main); font-size: 1.05rem;">${escapeHtml(surv.title)}</h4>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">${surv.date}</span>
                                </div>
                                <p style="margin: 0 0 10px 0; color: var(--text-muted); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${escapeHtml(surv.description)}
                                </p>
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                                    <span>${statusBadge}</span>
                                    <span style="color: var(--text-muted);">
                                        ${hasAnswered ? '답변 조회' : '설문 참여'} <i class="fa-solid fa-chevron-right" style="font-size: 0.75rem;"></i>
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    };

    const openAnnouncementDetailModal = (ann) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">학원 공지사항</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
                    ${escapeHtml(ann.title)}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem; display: flex; gap: 15px;">
                    <span>작성일: ${ann.date}</span>
                    <span>조회수: ${ann.views || 0}회</span>
                </div>
                <div style="background: rgba(9, 132, 227, 0.01); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius-md); font-size: 0.95rem; line-height: 1.6; color: var(--text-main); white-space: pre-wrap; min-height: 180px;">${escapeHtml(ann.content)}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const openMessageDetailModal = (msg) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">학부모 개별 안내</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
                    ${escapeHtml(msg.title)}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                    발송일: ${msg.date}
                </div>
                <div style="background: rgba(9, 132, 227, 0.01); border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius-md); font-size: 0.95rem; line-height: 1.6; color: var(--text-main); white-space: pre-wrap; min-height: 150px;">${escapeHtml(msg.content)}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const openSurveyResponseModal = (surv) => {
        const hasAnswered = stateStore.hasStudentAnsweredSurvey(surv.id, studentId);
        
        let questionsHtml = '';
        if (hasAnswered) {
            const responses = stateStore.getSurveyResponses(surv.id);
            const myResp = responses.find(r => r.studentId === studentId);
            const myAnswers = myResp ? myResp.answers : {};

            questionsHtml = surv.questions.map((q, idx) => {
                const answer = myAnswers[q.id] || '(답변 없음)';
                return `
                    <div style="background: #ffffff; border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 12px;">
                        <span style="font-size: 0.75rem; color: var(--primary); font-weight: bold;">질문 ${idx + 1} (${q.type === 'choice' ? '객관식' : '주관식'})</span>
                        <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); margin-bottom: 8px;">${escapeHtml(q.questionText)}</div>
                        <div style="background: rgba(9, 132, 227, 0.02); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.9rem; font-weight: 600; color: var(--primary);">
                            제출한 답변: ${escapeHtml(answer)}
                        </div>
                    </div>
                `;
            }).join('');

            const modalHtml = `
                <div class="modal-header">
                    <h3 class="modal-title">설문 참여 완료</h3>
                    <button class="modal-close" data-close-modal>&times;</button>
                </div>
                <div class="modal-body" style="padding-top: 10px; max-height: 60vh; overflow-y: auto;">
                    <div style="background: rgba(46, 204, 113, 0.08); border: 1px solid var(--success); padding: 12px; border-radius: 8px; margin-bottom: 1.5rem; text-align: center; color: #27ae60; font-weight: bold; font-size: 0.9rem;">
                        <i class="fa-solid fa-circle-check"></i> 이미 제출이 완료된 설문입니다. (제출일: ${myResp ? myResp.date : surv.date})
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="font-weight: 800; font-size: 1.1rem; color: var(--text-main); margin-bottom: 4px;">${escapeHtml(surv.title)}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">${escapeHtml(surv.description)}</p>
                    </div>
                    <div>
                        ${questionsHtml}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-close-modal>닫기</button>
                </div>
            `;
            openModal(modalHtml);
        } else {
            // Render active response form
            questionsHtml = surv.questions.map((q, idx) => {
                if (q.type === 'choice') {
                    const radios = q.options.map(opt => `
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; padding: 6px 0;">
                            <input type="radio" name="question_${q.id}" value="${opt}" required style="accent-color: var(--primary);">
                            <span>${escapeHtml(opt)}</span>
                        </label>
                    `).join('');
                    
                    return `
                        <div class="form-group" style="background: #ffffff; border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 12px;">
                            <span style="font-size: 0.75rem; color: var(--primary); font-weight: bold;">질문 ${idx + 1} (객관식)</span>
                            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); margin-bottom: 10px;">${escapeHtml(q.questionText)}</div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                ${radios}
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="form-group" style="background: #ffffff; border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 12px;">
                            <span style="font-size: 0.75rem; color: var(--primary); font-weight: bold;">질문 ${idx + 1} (주관식)</span>
                            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); margin-bottom: 8px;">${escapeHtml(q.questionText)}</div>
                            <textarea name="question_${q.id}" class="form-control" rows="3" placeholder="의견을 적어주세요." required style="resize: none; font-family: inherit; font-size: 0.88rem;"></textarea>
                        </div>
                    `;
                }
            }).join('');

            const modalHtml = `
                <div class="modal-header">
                    <h3 class="modal-title">설문 참여 📊</h3>
                    <button class="modal-close" data-close-modal>&times;</button>
                </div>
                <div class="modal-body" style="padding-top: 10px; max-height: 60vh; overflow-y: auto;">
                    <div style="background: rgba(9, 132, 227, 0.03); border: 1px solid var(--border-color); padding: 14px; border-radius: 8px; margin-bottom: 1.5rem;">
                        <h4 style="font-weight: 800; font-size: 1.1rem; color: var(--text-main); margin-bottom: 4px;">${escapeHtml(surv.title)}</h4>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">${escapeHtml(surv.description)}</p>
                    </div>
                    <form id="form-submit-survey-response">
                        ${questionsHtml}
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-close-modal>취소</button>
                    <button type="submit" form="form-submit-survey-response" class="btn btn-primary">답변 제출하기 🚀</button>
                </div>
            `;

            openModal(modalHtml, (modalArea) => {
                const form = modalArea.querySelector('#form-submit-survey-response');
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    
                    const answers = {};
                    surv.questions.forEach(q => {
                        if (q.type === 'choice') {
                            const selected = form.querySelector(`input[name="question_${q.id}"]:checked`);
                            answers[q.id] = selected ? selected.value : '';
                        } else {
                            const val = form.querySelector(`textarea[name="question_${q.id}"]`).value.trim();
                            answers[q.id] = val;
                        }
                    });

                    stateStore.submitSurveyResponse(surv.id, studentId, answers);
                    closeModal();
                });
            });
        }
        bindSiblingSelector(container, render);
    };

    render();

    const unsubAnn = stateStore.subscribe('ANNOUNCEMENTS_CHANGED', render);
    const unsubMsg = stateStore.subscribe('MESSAGES_CHANGED', render);
    const unsubSurv = stateStore.subscribe('SURVEYS_CHANGED', render);
    const unsubResp = stateStore.subscribe('SURVEY_RESPONSES_CHANGED', render);

    return () => {
        unsubAnn();
        unsubMsg();
        unsubSurv();
        unsubResp();
    };
}
