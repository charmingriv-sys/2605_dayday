import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { formatPhoneNumber, showKakaoTalkToast, openStudentDetailModalRef } from './shared.js';

const printReceiptRegister = (selectedMonth) => {
    console.log("[Print Debug] Button clicked: btn-print-receipt-register");
    try {
        const payments = stateStore.getPayments();
        const students = stateStore.getStudents();
        const rawSettings = stateStore.getSettings() || {};
        
        const settings = {
            academyName: rawSettings.academyName || '튜링 음악학원',
            businessNumber: rawSettings.businessNumber || '120-00-00000',
            representative: rawSettings.representative || '김하은',
            address: rawSettings.address || '서울시 서초구 반포동 123-4',
            phone: rawSettings.phone || '02-1234-5678',
            ...rawSettings
        };

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            console.error("[Print Debug] printReceiptRegister popup window blocked");
            alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
            return;
        }
        console.log("[Print Debug] printReceiptRegister popup window opened successfully");

        const monthPaidPayments = payments.filter(p => p.month === selectedMonth && p.status === 'paid');
        monthPaidPayments.sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''));

        const yearStr = selectedMonth.slice(0, 4);
        const monthStr = selectedMonth.slice(5, 7);

        let rowsHtml = monthPaidPayments.map((p) => {
            const student = students.find(s => s.id === p.studentId);
            const studentName = student ? student.name : '퇴원 원생';
            const birthDate = student && student.age ? `${2026 - student.age}-01-01` : '-';
            const studentId = student ? student.id : '-';
            const subject = student ? student.instrument : '-';
            const categoryLabel = p.type === 'education' ? '교습비(수강료)' : '교재비';
            const methodLabel = {
                'toss': '토스페이',
                'kakao': '카카오페이',
                'card': '신용카드',
                'cash': '현금 수납'
            }[p.method] || p.method || '-';

            return `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.paidDate || '-'}</td>
                    <td><strong>${studentName}</strong></td>
                    <td>${birthDate}</td>
                    <td>${studentId}</td>
                    <td>${subject}</td>
                    <td style="text-align: right; font-weight: bold;">${p.amount.toLocaleString()}원</td>
                    <td>${categoryLabel}</td>
                    <td>${methodLabel}</td>
                </tr>
            `;
        }).join('');

        if (monthPaidPayments.length === 0) {
            rowsHtml = `<tr><td colspan="9" style="text-align:center; padding: 20px;">해당 월의 수납 완료 내역이 없습니다.</td></tr>`;
        }

        const totalPaidSum = monthPaidPayments.reduce((sum, p) => sum + p.amount, 0);

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>교습비등 영수증 원부 [별지 제24호서식]</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 15mm 10mm;
                    }
                    body {
                        font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                        color: #000;
                        background: #fff;
                        margin: 0;
                        padding: 0;
                        font-size: 9.5pt;
                        line-height: 1.4;
                    }
                    .container {
                        width: 100%;
                    }
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-bottom: 15px;
                    }
                    .form-title {
                        font-size: 18pt;
                        font-weight: bold;
                        letter-spacing: 2px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 5px;
                        margin: 0;
                    }
                    .law-ref {
                        font-size: 8pt;
                        color: #555;
                        margin-bottom: 10px;
                    }
                    .academy-info {
                        font-size: 9.5pt;
                        font-weight: bold;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px 5px;
                        text-align: center;
                        vertical-align: middle;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                        font-size: 9pt;
                    }
                    td {
                        font-size: 9pt;
                    }
                    .total-row {
                        font-weight: bold;
                        background-color: #fafafa;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: right;
                        font-size: 8pt;
                        color: #555;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="law-ref">■ 학원의 설립ㆍ운영 및 과외교습에 관한 법률 시행규칙 [별지 제24호서식] &lt;개정 2020. 02. 12.&gt;</div>
                    <div class="header-container">
                        <h1 class="form-title">교습비등 영수증 원부 (${yearStr}년 ${monthStr}월)</h1>
                        <div class="academy-info">
                            학원명: ${settings.academyName} &nbsp;|&nbsp; 사업자번호: ${settings.businessNumber} &nbsp;|&nbsp; 대표자: ${settings.representative}
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 10%;">영수증 번호</th>
                                <th style="width: 12%;">영수연월일</th>
                                <th style="width: 12%;">성명</th>
                                <th style="width: 12%;">생년월일</th>
                                <th style="width: 10%;">원생 등록번호</th>
                                <th style="width: 12%;">교습과목</th>
                                <th style="width: 12%;">영수액</th>
                                <th style="width: 10%;">구분</th>
                                <th style="width: 10%;">수납방법</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            <tr class="total-row">
                                <td colspan="6" style="text-align: right; padding-right: 15px;">합 계</td>
                                <td style="text-align: right; padding-right: 5px;">${totalPaidSum.toLocaleString()}원</td>
                                <td colspan="2">건수: ${monthPaidPayments.length}건</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="footer">
                        출력일시: ${new Date().toISOString().slice(0, 10)} / ${settings.academyName} 관리 시스템
                    </div>
                </div>
                <script>
                    setTimeout(function() {
                        try {
                            window.print();
                            window.close();
                        } catch(e) {}
                    }, 300);
                </script>
            </body>
            </html>
        `;

        console.log("[Print Debug] printReceiptRegister writing to popup document");
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
    } catch (err) {
        console.error("[Print Debug] printReceiptRegister generation failed:", err);
        alert("인쇄 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
};

const printCashBook = (selectedMonth) => {
    console.log("[Print Debug] Button clicked: btn-print-cash-book");
    try {
        const payments = stateStore.getPayments();
        const students = stateStore.getStudents();
        const rawSettings = stateStore.getSettings() || {};

        const settings = {
            academyName: rawSettings.academyName || '튜링 음악학원',
            businessNumber: rawSettings.businessNumber || '120-00-00000',
            representative: rawSettings.representative || '김하은',
            address: rawSettings.address || '서울시 서초구 반포동 123-4',
            phone: rawSettings.phone || '02-1234-5678',
            ...rawSettings
        };

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            console.error("[Print Debug] printCashBook popup window blocked");
            alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
            return;
        }
        console.log("[Print Debug] printCashBook popup window opened successfully");

        const monthPaidPayments = payments.filter(p => p.month === selectedMonth && p.status === 'paid');
        monthPaidPayments.sort((a, b) => (a.paidDate || '').localeCompare(b.paidDate || ''));

        const yearStr = selectedMonth.slice(0, 4);
        const monthStr = selectedMonth.slice(5, 7);

        let cumulativeBalance = 0;
        let rowsHtml = monthPaidPayments.map((p) => {
            const student = students.find(s => s.id === p.studentId);
            const studentName = student ? student.name : '퇴원 원생';
            const typeStr = p.type === 'education' ? '교육비 수납' : '교재비 수납';
            const desc = `${studentName} ${typeStr} (${p.id})`;
            const income = p.amount;
            const expense = 0;
            cumulativeBalance += income;

            return `
                <tr>
                    <td>${p.paidDate || '-'}</td>
                    <td style="text-align: left; padding-left: 15px;">${desc}</td>
                    <td style="text-align: right; font-weight: bold;">${income.toLocaleString()}원</td>
                    <td style="text-align: right; color: #888;">0원</td>
                    <td style="text-align: right; font-weight: bold;">${cumulativeBalance.toLocaleString()}원</td>
                </tr>
            `;
        }).join('');

        if (monthPaidPayments.length === 0) {
            rowsHtml = `<tr><td colspan="5" style="text-align:center; padding: 20px;">해당 월의 수납 출납 내역이 없습니다.</td></tr>`;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>현금출납부</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 15mm 10mm;
                    }
                    body {
                        font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                        color: #000;
                        background: #fff;
                        margin: 0;
                        padding: 0;
                        font-size: 9.5pt;
                        line-height: 1.4;
                    }
                    .container {
                        width: 100%;
                    }
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-bottom: 15px;
                    }
                    .form-title {
                        font-size: 18pt;
                        font-weight: bold;
                        letter-spacing: 2px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 5px;
                        margin: 0;
                    }
                    .law-ref {
                        font-size: 8pt;
                        color: #555;
                        margin-bottom: 10px;
                    }
                    .academy-info {
                        font-size: 9.5pt;
                        font-weight: bold;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px 5px;
                        text-align: center;
                        vertical-align: middle;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                        font-size: 9pt;
                    }
                    td {
                        font-size: 9pt;
                    }
                    .total-row {
                        font-weight: bold;
                        background-color: #fafafa;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: right;
                        font-size: 8pt;
                        color: #555;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="law-ref">■ 학원 회계 및 재무 관리 비치 대장</div>
                    <div class="header-container">
                        <h1 class="form-title">현 금 출 납 부 (${yearStr}년 ${monthStr}월)</h1>
                        <div class="academy-info">
                            학원명: ${settings.academyName} &nbsp;|&nbsp; 사업자번호: ${settings.businessNumber} &nbsp;|&nbsp; 대표자: ${settings.representative}
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%;">수납 날짜</th>
                                <th style="width: 40%; text-align: left; padding-left: 15px;">적요</th>
                                <th style="width: 15%;">수입액 (Income)</th>
                                <th style="width: 15%;">지출액 (Expense)</th>
                                <th style="width: 15%;">누적 잔액 (Balance)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            <tr class="total-row">
                                <td colspan="2" style="text-align: right; padding-right: 15px;">월계 합계</td>
                                <td style="text-align: right; padding-right: 5px;">${cumulativeBalance.toLocaleString()}원</td>
                                <td style="text-align: right; padding-right: 5px;">0원</td>
                                <td style="text-align: right; padding-right: 5px;">${cumulativeBalance.toLocaleString()}원</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="footer">
                        출력일시: ${new Date().toISOString().slice(0, 10)} / ${settings.academyName} 관리 시스템
                    </div>
                </div>
                <script>
                    setTimeout(function() {
                        try {
                            window.print();
                            window.close();
                        } catch(e) {}
                    }, 300);
                </script>
            </body>
            </html>
        `;

        console.log("[Print Debug] printCashBook writing to popup document");
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
    } catch (err) {
        console.error("[Print Debug] printCashBook generation failed:", err);
        alert("인쇄 화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
};

/**
 * 3. 수납 및 결제 현황 (renderPayments)
 * Renders a tuition payment table, showing each student's payment status for the current month.
 * Includes a toggle/modal to mark as paid and a button to simulate KakaoTalk alerts.
 */
export function renderPayments(container) {
    const todayStr = new Date().toISOString().slice(0, 7); // Default to current month
    let selectedMonth = '2026-05'; // Default mock month matching seed data

    const render = () => {
        const payments = stateStore.getPayments();
        
        // Find all unique months available in payment database records
        const uniqueMonths = [...new Set(payments.map(p => p.month))].sort((a, b) => b.localeCompare(a));
        if (uniqueMonths.length === 0) {
            uniqueMonths.push(selectedMonth);
        }

        container.innerHTML = `
            <!-- Top Controls -->
            <div class="glass-card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <label for="payment-month-select" style="font-weight: 600; font-size: 0.9rem; color: var(--text-muted);">청구 월별 조회:</label>
                        <select id="payment-month-select" class="form-control" style="min-width: 150px; margin-bottom: 0;">
                            ${uniqueMonths.map(m => `<option value="${m}" ${selectedMonth === m ? 'selected' : ''}>${m.slice(0, 4)}년 ${m.slice(5, 7)}월</option>`).join('')}
                        </select>
                        <button class="btn btn-secondary" id="btn-print-receipt-register" style="height: 38px; border-color: rgba(0, 206, 201, 0.4); background: rgba(0, 206, 201, 0.15); color: var(--accent); font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-print"></i> 영수증 원부 인쇄
                        </button>
                        <button class="btn btn-secondary" id="btn-print-cash-book" style="height: 38px; border-color: rgba(0, 206, 201, 0.4); background: rgba(0, 206, 201, 0.15); color: var(--accent); font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-print"></i> 현금출납부 인쇄
                        </button>
                    </div>

                    <div style="display: flex; gap: 16px; font-size: 0.85rem; flex-wrap: wrap;" id="payment-summary-stats">
                        <!-- Stats filled dynamically -->
                    </div>
                </div>
            </div>

            <!-- Tuition Payments Table -->
            <div class="glass-card">
                <div class="table-wrapper">
                    <table class="custom-table" id="payments-table">
                        <thead>
                            <tr>
                                <th>원생명</th>
                                <th>수납 구분</th>
                                <th>청구 금액</th>
                                <th>청구일 (납부 기한)</th>
                                <th>수납 상태</th>
                                <th>수납 처리 정보</th>
                                <th style="text-align: right;">수납 행정 관리</th>
                            </tr>
                        </thead>
                        <tbody id="payments-table-body">
                            <!-- Rows loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const monthSelect = container.querySelector('#payment-month-select');
        monthSelect.addEventListener('change', (e) => {
            selectedMonth = e.target.value;
            renderTableBody();
        });

        const btnPrintReceiptRegister = container.querySelector('#btn-print-receipt-register');
        if (btnPrintReceiptRegister) {
            btnPrintReceiptRegister.addEventListener('click', () => {
                printReceiptRegister(selectedMonth);
            });
        }

        const btnPrintCashBook = container.querySelector('#btn-print-cash-book');
        if (btnPrintCashBook) {
            btnPrintCashBook.addEventListener('click', () => {
                printCashBook(selectedMonth);
            });
        }

        renderTableBody();
    };

    const sendPaymentRequestNotification = ({ message_type, receiver_type, receiver_phone, student_id, payment_id, academy_id }) => {
        console.log("Simulating Kakao Biz message sending via payment request API:", {
            message_type,
            receiver_type,
            receiver_phone,
            student_id,
            payment_id,
            academy_id
        });
    };

    const openPaymentRequestModal = (paymentId) => {
        const paymentRecord = stateStore.getPayments().find(p => p.id === paymentId);
        if (!paymentRecord) return;
        const student = stateStore.getStudent(paymentRecord.studentId);
        if (!student) return;

        const selfPhone = student.phone ? student.phone.trim() : '';
        const parentPhone = student.parentPhone ? student.parentPhone.trim() : '';

        const hasSelfPhone = !!selfPhone;
        const hasParentPhone = !!parentPhone;

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">메시지 받을 사람 선택</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="margin-bottom: 1.5rem; text-align: center;">
                <p style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 0;">원생명: <strong>${student.name}</strong></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div class="receiver-option ${hasSelfPhone ? '' : 'disabled'}" id="modal-receiver-self" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: ${hasSelfPhone ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'}; cursor: ${hasSelfPhone ? 'pointer' : 'not-allowed'}; opacity: ${hasSelfPhone ? '1' : '0.5'}; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 1rem; color: ${hasSelfPhone ? 'var(--text-main)' : 'var(--text-muted)'};">본인 (원생)</span>
                        ${hasSelfPhone ? '<i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>' : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        ${hasSelfPhone ? formatPhoneNumber(selfPhone) : '연락 정보가 없습니다.'}
                    </div>
                </div>

                <div class="receiver-option ${hasParentPhone ? '' : 'disabled'}" id="modal-receiver-parent" style="padding: 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: ${hasParentPhone ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'}; cursor: ${hasParentPhone ? 'pointer' : 'not-allowed'}; opacity: ${hasParentPhone ? '1' : '0.5'}; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; font-size: 1rem; color: ${hasParentPhone ? 'var(--text-main)' : 'var(--text-muted)'};">학부모</span>
                        ${hasParentPhone ? '<i class="fa-solid fa-chevron-right" style="color: var(--text-muted); font-size: 0.8rem;"></i>' : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        ${hasParentPhone ? `${student.parentName ? student.parentName + ' - ' : ''}${formatPhoneNumber(parentPhone)}` : '연락 정보가 없습니다.'}
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" data-close-modal style="width: 100%; display: flex; justify-content: center; align-items: center;">취소</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            const options = contentArea.querySelectorAll('.receiver-option:not(.disabled)');
            options.forEach(opt => {
                opt.addEventListener('mouseenter', () => {
                    opt.style.borderColor = 'var(--primary)';
                    opt.style.background = 'rgba(var(--primary-rgb), 0.1)';
                });
                opt.style.borderColor = 'var(--border-color)';
                opt.addEventListener('mouseleave', () => {
                    opt.style.borderColor = 'var(--border-color)';
                    opt.style.background = 'rgba(255,255,255,0.03)';
                });

                opt.addEventListener('click', () => {
                    const type = opt.id === 'modal-receiver-self' ? 'self' : 'parent';
                    const phone = type === 'self' ? selfPhone : parentPhone;
                    confirmSendPaymentRequest(paymentRecord, student, type, phone);
                });
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const confirmSendPaymentRequest = (paymentRecord, student, receiverType, receiverPhone) => {
        const academy = stateStore.getSettings();
        const academyId = academy.academyId || 'academy_1';

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">결제 요청 확인</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="text-align: center; margin: 1.5rem 0; font-size: 1.05rem; line-height: 1.5;">
                <p style="margin-bottom: 12px; font-weight: 500;">결제 요청 메시지를 보내시겠습니까?</p>
                <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-sm); font-size: 0.88rem; text-align: left; display: inline-block; width: 100%; box-sizing: border-box;">
                    <div>• <strong>수신 구분:</strong> ${receiverType === 'self' ? '본인' : '학부모'}</div>
                    <div>• <strong>연락처:</strong> ${formatPhoneNumber(receiverPhone)}</div>
                    <div>• <strong>청구 구분:</strong> ${paymentRecord.type === 'education' ? '교육비' : '교재비'}</div>
                    <div>• <strong>청구 금액:</strong> ${paymentRecord.amount.toLocaleString()}원</div>
                </div>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; display: flex; justify-content: center; align-items: center;">아니오</button>
                <button class="btn btn-primary" id="btn-confirm-send-payment" style="flex: 1; display: flex; justify-content: center; align-items: center;">예</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            contentArea.querySelector('#btn-confirm-send-payment').addEventListener('click', () => {
                sendPaymentRequestNotification({
                    message_type: 'payment_request',
                    receiver_type: receiverType,
                    receiver_phone: receiverPhone,
                    student_id: student.id,
                    payment_id: paymentRecord.id,
                    academy_id: academyId
                });

                stateStore.requestBookPayment(paymentRecord.id);
                closeModal();
                showKakaoTalkToast("결제 요청 메시지가 발송되었습니다.");
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const openEditPaymentModal = (paymentId) => {
        const payment = stateStore.getPayments().find(p => p.id === paymentId);
        if (!payment) return;

        const student = stateStore.getStudent(payment.studentId);
        const studentName = student ? student.name : '퇴원 원생';

        const statusOptions = [
            { value: 'unpaid', label: '미납' },
            { value: 'paid', label: '수납 완료' },
            { value: 'partial', label: '부분수납' },
            { value: 'refunded', label: '환불' },
            { value: 'cancelled', label: '취소' }
        ];

        const methodOptions = [
            { value: '', label: '선택 없음' },
            { value: 'card', label: '카드' },
            { value: 'cash', label: '현금' },
            { value: 'transfer', label: '계좌이체' },
            { value: 'other', label: '기타' }
        ];

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">수납정보 수정</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="margin-bottom: 1rem; text-align: center;">
                <span style="font-size: 1.05rem; font-weight: bold;">${studentName}</span>
                <span style="font-size: 0.9rem; color: var(--text-muted);">님의 청구 정보 수정</span>
            </div>
            <form id="edit-payment-form" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납 상태</label>
                    <select id="edit-payment-status" class="form-control" style="width: 100%;">
                        ${statusOptions.map(o => `<option value="${o.value}" ${payment.status === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납 방법</label>
                    <select id="edit-payment-method" class="form-control" style="width: 100%;">
                        ${methodOptions.map(o => `<option value="${o.value}" ${payment.method === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납일</label>
                    <input type="date" id="edit-payment-date" class="form-control" value="${payment.paidDate || ''}" style="width: 100%;">
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">수납 금액</label>
                    <input type="number" id="edit-payment-amount" class="form-control" value="${payment.amount}" style="width: 100%;" required>
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; margin-bottom: 4px; display: block; font-size: 0.85rem;">메모</label>
                    <textarea id="edit-payment-notes" class="form-control" style="width: 100%; height: 60px; resize: none; font-size: 0.82rem;">${payment.notes || ''}</textarea>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 10px;">
                    <button type="button" class="btn btn-secondary" data-close-modal style="flex: 1; display: flex; justify-content: center; align-items: center;">취소</button>
                    <button type="submit" class="btn btn-primary" style="flex: 1; display: flex; justify-content: center; align-items: center;">저장</button>
                </div>
            </form>
        `;

        const onInitModal = (contentArea) => {
            const form = contentArea.querySelector('#edit-payment-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const status = contentArea.querySelector('#edit-payment-status').value;
                const method = contentArea.querySelector('#edit-payment-method').value;
                const paidDate = contentArea.querySelector('#edit-payment-date').value;
                const amount = parseInt(contentArea.querySelector('#edit-payment-amount').value, 10) || 0;
                const notes = contentArea.querySelector('#edit-payment-notes').value.trim();

                stateStore.updatePayment(paymentId, {
                    status,
                    method: method || null,
                    paidDate: paidDate || null,
                    amount,
                    notes: notes || null
                });

                closeModal();
                showKakaoTalkToast("수납 정보가 수정되었습니다.");
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const revertPaymentToUnpaid = (paymentId) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">상태 변경 확인</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="text-align: center; margin: 1.5rem 0; font-size: 1.05rem;">
                <p style="margin-bottom: 0; font-weight: 500;">해당 수납 건을 미납 상태로 변경하시겠습니까?</p>
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; display: flex; justify-content: center; align-items: center;">아니오</button>
                <button class="btn btn-primary" id="btn-confirm-revert" style="flex: 1; display: flex; justify-content: center; align-items: center;">예</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            contentArea.querySelector('#btn-confirm-revert').addEventListener('click', () => {
                stateStore.updatePayment(paymentId, {
                    status: 'unpaid',
                    method: null,
                    paidDate: null
                });
                closeModal();
                showKakaoTalkToast("미납 상태로 변경되었습니다.");
            });
        };

        openModal(modalHtml, onInitModal);
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#payments-table-body');
        const statsEl = container.querySelector('#payment-summary-stats');
        if (!tbody || !statsEl) return;

        const payments = stateStore.getPayments();
        const students = stateStore.getStudents();

        // Filter payments for chosen month and sort by date descending (newest first)
        const monthPayments = payments.filter(p => p.month === selectedMonth);
        monthPayments.sort((a, b) => {
            const dateCompare = b.invoiceDate.localeCompare(a.invoiceDate);
            if (dateCompare !== 0) return dateCompare;
            // Numeric comparison of the ID (e.g. 'P10' > 'P9') to fix lexicographical sorting order
            const idA = parseInt(a.id.replace(/[^\d]/g, '')) || 0;
            const idB = parseInt(b.id.replace(/[^\d]/g, '')) || 0;
            return idB - idA;
        });

        // Summaries calculations (including 'requested' as unpaid)
        const totalBilled = monthPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalPaid = monthPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
        const totalUnpaid = monthPayments.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0);
        const paidCount = monthPayments.filter(p => p.status === 'paid').length;
        const totalCount = monthPayments.length;

        statsEl.innerHTML = `
            <span>청구 합계: <strong style="color: var(--text-main);">${totalBilled.toLocaleString()}원</strong></span>
            <span style="color: var(--success);">완납: <strong>${totalPaid.toLocaleString()}원 (${paidCount}/${totalCount}건)</strong></span>
            <span style="color: var(--danger);">미납: <strong>${totalUnpaid.toLocaleString()}원</strong></span>
        `;

        if (monthPayments.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        해당 수납 청구 기간에 등록된 내역이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = monthPayments.map(p => {
            const student = students.find(s => s.id === p.studentId);
            const studentName = student ? student.name : '<span style="color:var(--text-muted)">퇴원 원생</span>';
            const dueDay = student ? student.dueDay : '-';
            const parentPhone = student ? student.parentPhone : '';

            let typeBadge = '';
            if (p.type === 'book') {
                typeBadge = `<span class="badge badge-info" style="font-size: 0.8rem; background: rgba(9, 132, 227, 0.15); color: #74b9ff; border: 1px solid rgba(9, 132, 227, 0.3);">교재비</span>`;
            } else {
                typeBadge = `<span class="badge badge-success" style="font-size: 0.8rem; background: rgba(0, 184, 148, 0.15); color: #55efc4; border: 1px solid rgba(0, 184, 148, 0.3);">교육비</span>`;
            }

            let statusBadge = '';
            let paymentDetail = '';
            let actionHtml = '';

            const methodLabel = {
                'toss': '토스페이',
                'kakao': '카카오페이',
                'card': '신용카드',
                'cash': '현금 수납',
                'transfer': '계좌이체',
                'other': '기타'
            }[p.method] || p.method || '-';

            if (p.status === 'paid') {
                statusBadge = `<span class="badge badge-success" style="font-size:0.8rem;"><i class="fa-solid fa-circle-check"></i> 완납</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">수납 완료 (${methodLabel})</span>`;

                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미납 상태로 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'requested') {
                statusBadge = `<span class="badge badge-warning" style="font-size:0.8rem; background: var(--primary); color: white;"><i class="fa-solid fa-paper-plane"></i> 결제 요청됨</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">결제 요청 상태</span>`;

                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-success btn-pay-action" data-id="${p.id}" data-student="${studentName}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-check"></i> 수납 처리
                        </button>
                        <button class="btn btn-secondary btn-send-reminder" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-comment" style="color: #3c1e1e;"></i> 재요청
                        </button>
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미납 상태로 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'partial') {
                statusBadge = `<span class="badge badge-warning" style="font-size:0.8rem; background: rgba(243, 156, 18, 0.15); color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.3);"><i class="fa-solid fa-circle-minus"></i> 부분수납</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">일부 납부 완료</span>`;
                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-success btn-pay-action" data-id="${p.id}" data-student="${studentName}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-check"></i> 추가 수납
                        </button>
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미납 상태로 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'refunded') {
                statusBadge = `<span class="badge badge-secondary" style="font-size:0.8rem; background: rgba(255,255,255,0.1); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.15);"><i class="fa-solid fa-arrow-rotate-left"></i> 환불</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">환불 완료</span>`;
                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미납 상태로 변경
                        </button>
                    </div>
                `;
            } else if (p.status === 'cancelled') {
                statusBadge = `<span class="badge badge-secondary" style="font-size:0.8rem; background: rgba(255,255,255,0.1); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.15);"><i class="fa-solid fa-ban"></i> 취소</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">청구 취소</span>`;
                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                        <button class="btn btn-secondary btn-revert-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-arrow-rotate-left"></i> 미납 상태로 변경
                        </button>
                    </div>
                `;
            } else {
                statusBadge = `<span class="badge badge-danger" style="font-size:0.8rem;"><i class="fa-solid fa-circle-exclamation"></i> 미납</span>`;
                paymentDetail = `<span style="color: var(--text-muted); font-size: 0.85rem;">미납 상태</span>`;

                let reminderLabel = p.type === 'book' ? '결제 요청' : '알림 발송';

                actionHtml = `
                    <div style="display: inline-flex; gap: 8px; align-items: center;">
                        <button class="btn btn-success btn-pay-action" data-id="${p.id}" data-student="${studentName}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-check"></i> 수납 처리
                        </button>
                        <button class="btn btn-secondary btn-send-reminder" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-comment" style="color: #3c1e1e;"></i> ${reminderLabel}
                        </button>
                        <button class="btn btn-secondary btn-edit-payment" data-id="${p.id}" style="padding: 5px 10px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-pen"></i> 수정
                        </button>
                    </div>
                `;
            }

            return `
                <tr data-testid="payment-row-${p.id}">
                    <td style="font-weight: 600;">
                        <span class="student-name-link" data-id="${p.studentId}" style="font-size: 0.95rem; color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${studentName}</span>
                        ${student ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">학부모: ${parentPhone}</div>` : ''}
                    </td>
                    <td>${typeBadge}</td>
                    <td style="font-weight: 600; color: var(--text-main);">${p.amount.toLocaleString()}원</td>
                    <td>
                        <div style="font-size: 0.85rem;">청구: ${p.invoiceDate}</div>
                        ${p.type === 'education' ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">매월 ${dueDay}일 납부 약정</div>` : `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">교재 배부 등록일 기준</div>`}
                    </td>
                    <td data-testid="payment-status-${p.id}" data-status="${p.status}">${statusBadge}</td>
                    <td data-testid="payment-detail-${p.id}">${paymentDetail}</td>
                    <td style="text-align: right;">${actionHtml}</td>
                </tr>
            `;
        }).join('');

        // Action button click bindings
        tbody.querySelectorAll('.btn-pay-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const studentName = e.currentTarget.dataset.student;
                openPayOptionsModal(id, studentName);
            });
        });

        tbody.querySelectorAll('.btn-send-reminder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openPaymentRequestModal(id);
            });
        });

        tbody.querySelectorAll('.btn-edit-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openEditPaymentModal(id);
            });
        });

        tbody.querySelectorAll('.btn-revert-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                revertPaymentToUnpaid(id);
            });
        });

        tbody.querySelectorAll('.student-name-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const studentId = e.currentTarget.dataset.id;
                if (studentId && openStudentDetailModalRef) {
                    openStudentDetailModalRef(studentId);
                }
            });
        });
    };

    // Pop up modal to select payment tool
    const openPayOptionsModal = (paymentId, studentName) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">수강료 결제 처리</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <p style="font-size: 1.05rem; margin-bottom: 4px;"><strong>${studentName}</strong> 원생의 결제를 등록합니다.</p>
                <p style="font-size: 0.85rem; color: var(--text-muted);">납부 받으신 결제 수단을 하단에서 선택해 주세요.</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button class="btn btn-secondary btn-pay-toss" id="modal-pay-toss" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                    <i class="fa-solid fa-wallet"></i> 토스페이
                </button>
                <button class="btn btn-secondary btn-pay-kakao" id="modal-pay-kakao" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                    <i class="fa-solid fa-comment" style="color: #3c1e1e;"></i> 카카오페이
                </button>
                <button class="btn btn-primary" id="modal-pay-card" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md);">
                    <i class="fa-solid fa-credit-card"></i> 신용카드
                </button>
                <button class="btn btn-secondary" id="modal-pay-cash" style="padding: 12px; justify-content: center; font-weight: 700; border-radius: var(--radius-md); background: rgba(255,255,255,0.06);">
                    <i class="fa-solid fa-coins"></i> 현금 수납
                </button>
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem;">
                <button type="button" class="btn btn-secondary" data-close-modal style="width: 100%; display: flex; justify-content: center; align-items: center;">취소</button>
            </div>
        `;

        const onInitModal = (contentArea) => {
            const registerPayment = (method) => {
                stateStore.payInvoice(paymentId, method);
                closeModal();
            };

            contentArea.querySelector('#modal-pay-toss').addEventListener('click', () => registerPayment('toss'));
            contentArea.querySelector('#modal-pay-kakao').addEventListener('click', () => registerPayment('kakao'));
            contentArea.querySelector('#modal-pay-card').addEventListener('click', () => registerPayment('card'));
            contentArea.querySelector('#modal-pay-cash').addEventListener('click', () => registerPayment('cash'));
        };

        openModal(modalHtml, onInitModal);
    };

    render();

    // Subscriptions setup
    const unsubPayments = stateStore.subscribe('PAYMENTS_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);

    return () => {
        unsubPayments();
        unsubStudents();
    };
}

/**
 * 8. 학원 교재 마스터 관리 (renderBooks)
 * Renders master list of textbooks and curriculum sheets.
 * Includes category grouping, status switch toggle, and textbook editing form.
 */
export function renderBooks(container) {
    let filterQuery = '';
    let filterCategory = '';
    let editingBookId = null;

    const render = () => {
        const books = stateStore.getBooks();
        const categories = [...new Set(books.map(b => b.category))].filter(Boolean);

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;" class="books-layout-grid">
                <!-- Column 1: Books Table -->
                <div class="glass-card" style="display: flex; flex-direction: column;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-book" style="color: var(--primary);"></i>
                        학원 교재 마스터 현황
                    </h3>
                    
                    <!-- Search & Filter row -->
                    <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                        <div style="position: relative; flex-grow: 1; min-width: 180px;">
                            <input type="text" id="book-search-input" class="form-control" placeholder="교재 이름 검색..." style="width: 100%; padding-left: 40px; margin-bottom: 0;" value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        </div>
                        <select id="book-category-filter" class="form-control" style="width: 150px; margin-bottom: 0;">
                            <option value="">카테고리 전체</option>
                            ${categories.map(cat => `<option value="${cat}" ${filterCategory === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                        </select>
                    </div>

                    <div class="table-wrapper" style="margin-top: 0; flex-grow: 1;">
                        <table class="custom-table" id="books-table">
                            <thead>
                                <tr>
                                    <th>교재명</th>
                                    <th>가격 (교육비)</th>
                                    <th>과목 / 카테고리</th>
                                    <th>권장 일수</th>
                                    <th>사용 상태</th>
                                    <th style="text-align: right;">관리</th>
                                </tr>
                            </thead>
                            <tbody id="books-table-body">
                                <!-- Loaded dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Column 2: Add/Edit Form -->
                <div class="glass-card" id="book-form-card" style="height: fit-content; align-self: start;">
                    <h3 id="book-form-heading" style="font-size: 1.15rem; font-weight: 700; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                        신규 교재 등록
                    </h3>
                    <form id="book-form">
                        <div class="form-group">
                            <label for="book-name-input">교재명 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="book-name-input" class="form-control" placeholder="예: 도시락 바이엘 1" required>
                        </div>
                        <div class="form-group">
                            <label for="book-price-input">가격 (원) <span style="color: var(--danger);">*</span></label>
                            <input type="number" id="book-price-input" class="form-control" placeholder="예: 6000" min="0" step="500" required>
                        </div>
                        <div class="form-group">
                            <label for="book-category-input">카테고리 / 과목 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="book-category-input" class="form-control" list="book-category-presets" placeholder="예: 바이엘/체르니, 이론, 게이름" required>
                            <datalist id="book-category-presets">
                                <option value="바이엘/체르니"></option>
                                <option value="이론"></option>
                                <option value="게이름"></option>
                                <option value="피아노소곡"></option>
                            </datalist>
                        </div>
                        <div class="form-group">
                            <label for="book-recommended-days-select">권장 학습 일수 <span style="color: var(--danger);">*</span></label>
                            <select id="book-recommended-days-select" class="form-control" required style="width: 100%;">
                                <option value="30">30일</option>
                                <option value="60">60일</option>
                                <option value="90" selected>90일</option>
                                <option value="180">180일</option>
                                <option value="360">360일</option>
                                <option value="custom">기타(직접입력)</option>
                            </select>
                        </div>
                        <div class="form-group" id="book-recommended-days-custom-group" style="display: none;">
                            <label for="book-recommended-days-custom">권장 일수 직접 입력 (일) <span style="color: var(--danger);">*</span></label>
                            <input type="number" id="book-recommended-days-custom" class="form-control" placeholder="예: 45" min="1">
                        </div>

                        <div style="display: flex; gap: 12px; margin-top: 1.8rem;" id="book-form-buttons-container">
                            <button type="submit" class="btn btn-primary" style="flex-grow: 1; justify-content: center; height: 42px;">
                                <i class="fa-solid fa-check"></i> <span id="book-submit-btn-label">등록 완료</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            <style>
                @media (max-width: 1024px) {
                    .books-layout-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>
        `;

        // Event listeners
        const searchInput = container.querySelector('#book-search-input');
        const catFilter = container.querySelector('#book-category-filter');
        const form = container.querySelector('#book-form');
        const selectEl = container.querySelector('#book-recommended-days-select');
        const customGroupEl = container.querySelector('#book-recommended-days-custom-group');
        const customInputEl = container.querySelector('#book-recommended-days-custom');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterQuery = e.target.value;
                renderTableBody();
            });
        }

        if (catFilter) {
            catFilter.addEventListener('change', (e) => {
                filterCategory = e.target.value;
                renderTableBody();
            });
        }

        if (selectEl) {
            selectEl.addEventListener('change', () => {
                if (selectEl.value === 'custom') {
                    customGroupEl.style.display = 'block';
                    customInputEl.required = true;
                } else {
                    customGroupEl.style.display = 'none';
                    customInputEl.required = false;
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = container.querySelector('#book-name-input').value.trim();
                const price = parseInt(container.querySelector('#book-price-input').value) || 0;
                const category = container.querySelector('#book-category-input').value.trim();

                const recDaysSelect = container.querySelector('#book-recommended-days-select').value;
                let recommendedDays = 90;
                if (recDaysSelect === 'custom') {
                    recommendedDays = parseInt(container.querySelector('#book-recommended-days-custom').value) || 90;
                } else {
                    recommendedDays = parseInt(recDaysSelect) || 90;
                }

                if (editingBookId) {
                    stateStore.updateBook(editingBookId, { name, price, category, recommendedDays });
                    resetForm();
                } else {
                    stateStore.addBook({ name, price, category, recommendedDays });
                    form.reset();
                    // Reset custom fields
                    customGroupEl.style.display = 'none';
                    customInputEl.required = false;
                    customInputEl.value = '';
                    selectEl.value = '90';
                }
            });
        }

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#books-table-body');
        if (!tbody) return;

        const books = stateStore.getBooks();

        const filtered = books.filter(b => {
            const queryMatch = !filterQuery || b.name.toLowerCase().includes(filterQuery.toLowerCase());
            const catMatch = !filterCategory || b.category === filterCategory;
            return queryMatch && catMatch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        등록된 교재가 없거나 검색 결과가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(b => {
            const isChecked = b.status === 'active' ? 'checked' : '';
            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-main);">${b.name}</td>
                    <td style="font-weight: 600;">${b.price.toLocaleString()}원</td>
                    <td><span class="badge badge-info" style="font-size: 0.8rem;">${b.category}</span></td>
                    <td style="font-weight: 600; color: var(--accent);">${b.recommendedDays || 90}일</td>
                    <td>
                        <label class="switch-toggle" style="display: inline-flex; align-items: center; cursor: pointer; gap: 8px;">
                            <input type="checkbox" class="book-status-checkbox" data-id="${b.id}" ${isChecked} style="accent-color: var(--primary);">
                            <span style="font-size: 0.8rem; color: ${b.status === 'active' ? 'var(--success)' : 'var(--text-muted)'}; font-weight: bold;">
                                ${b.status === 'active' ? '사용중' : '미사용'}
                            </span>
                        </label>
                    </td>
                    <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 8px;">
                            <button class="btn btn-secondary btn-icon-only edit-book-btn" data-id="${b.id}" title="수정">
                                <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only delete-book-btn" data-id="${b.id}" title="삭제">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Action bindings
        tbody.querySelectorAll('.edit-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                startEditMode(id);
            });
        });

        tbody.querySelectorAll('.delete-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const book = stateStore.getBook(id);
                if (confirm(`정말로 '${book.name}' 교재를 삭제하시겠습니까?\n이 교재가 지정된 원생들의 교재 수강 이력에서도 함께 제거됩니다.`)) {
                    stateStore.deleteBook(id);
                    if (editingBookId === id) {
                        resetForm();
                    }
                }
            });
        });

        tbody.querySelectorAll('.book-status-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const active = e.target.checked;
                stateStore.updateBook(id, { status: active ? 'active' : 'inactive' });
            });
        });
    };

    const startEditMode = (bookId) => {
        editingBookId = bookId;
        const book = stateStore.getBook(bookId);
        if (!book) return;

        container.querySelector('#book-name-input').value = book.name;
        container.querySelector('#book-price-input').value = book.price;
        container.querySelector('#book-category-input').value = book.category;

        const recommendedDays = book.recommendedDays || 90;
        const selectEl = container.querySelector('#book-recommended-days-select');
        const customGroupEl = container.querySelector('#book-recommended-days-custom-group');
        const customInputEl = container.querySelector('#book-recommended-days-custom');

        if (['30', '60', '90', '180', '360'].includes(String(recommendedDays))) {
            selectEl.value = String(recommendedDays);
            customGroupEl.style.display = 'none';
            customInputEl.required = false;
        } else {
            selectEl.value = 'custom';
            customGroupEl.style.display = 'block';
            customInputEl.value = recommendedDays;
            customInputEl.required = true;
        }

        container.querySelector('#book-form-heading').innerHTML = `
            <i class="fa-solid fa-pen" style="color: var(--primary);"></i>
            교재 정보 수정
        `;
        container.querySelector('#book-submit-btn-label').textContent = '수정 완료';

        const buttonsContainer = container.querySelector('#book-form-buttons-container');
        if (!container.querySelector('#cancel-book-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.id = 'cancel-book-edit-btn';
            cancelBtn.style.flexGrow = '1';
            cancelBtn.style.justifyContent = 'center';
            cancelBtn.textContent = '취소';
            cancelBtn.addEventListener('click', resetForm);
            buttonsContainer.appendChild(cancelBtn);
        }
    };

    const resetForm = () => {
        editingBookId = null;
        const form = container.querySelector('#book-form');
        if (form) form.reset();

        const customGroupEl = container.querySelector('#book-recommended-days-custom-group');
        if (customGroupEl) customGroupEl.style.display = 'none';
        const customInputEl = container.querySelector('#book-recommended-days-custom');
        if (customInputEl) {
            customInputEl.value = '';
            customInputEl.required = false;
        }
        const selectEl = container.querySelector('#book-recommended-days-select');
        if (selectEl) selectEl.value = '90';

        const heading = container.querySelector('#book-form-heading');
        if (heading) {
            heading.innerHTML = `
                <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                신규 교재 등록
            `;
        }
        const label = container.querySelector('#book-submit-btn-label');
        if (label) label.textContent = '등록 완료';

        const cancelBtn = container.querySelector('#cancel-book-edit-btn');
        if (cancelBtn) cancelBtn.remove();
    };

    render();

    // Subscribe to state changes
    const unsubBooks = stateStore.subscribe('BOOKS_CHANGED', render);
    return () => {
        unsubBooks();
    };
}

/**
 * 9. 원생별 교재 등록 경과일 관리 (renderBooksElapsed)
 * Monitors the elapsed days since the last book registration for each student.
 * Highlight warnings for long intervals and triggers Kakaotalk billing request alerts.
 */
export function renderBooksElapsed(container) {
    let filterQuery = '';
    let filterDaysGroup = ''; // '', 'normal', 'warning', 'recommended'

    const render = () => {
        container.innerHTML = `
            <div class="glass-card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-clock" style="color: var(--accent);"></i>
                        원생별 교재 등록 및 경과일 현황
                    </h3>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <div style="position: relative; width: 220px;">
                            <input type="text" id="elapsed-search-input" class="form-control" placeholder="원생 이름 검색..." style="width: 100%; padding-left: 40px; margin-bottom: 0;" value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        </div>
                        <select id="elapsed-days-filter" class="form-control" style="width: 170px; margin-bottom: 0;">
                            <option value="">경과 상태 전체</option>
                            <option value="recommended" ${filterDaysGroup === 'recommended' ? 'selected' : ''}>교재 추천 (90% 이상)</option>
                            <option value="warning" ${filterDaysGroup === 'warning' ? 'selected' : ''}>주의 (80% ~ 90%)</option>
                            <option value="normal" ${filterDaysGroup === 'normal' ? 'selected' : ''}>정상 (80% 미만)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Student Books Elapsed Table -->
            <div class="glass-card">
                <div class="table-wrapper">
                    <table class="custom-table" id="elapsed-table">
                        <thead>
                            <tr>
                                <th>원생명</th>
                                <th>수강 과목 / 담당강사</th>
                                <th>최근 등록 교재</th>
                                <th>교재 등록일</th>
                                <th>경과 기간 (출석 / 권장)</th>
                                <th>청구/결제 상태</th>
                                <th style="text-align: right;">관리 행정</th>
                            </tr>
                        </thead>
                        <tbody id="elapsed-table-body">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const searchInput = container.querySelector('#elapsed-search-input');
        const daysFilter = container.querySelector('#elapsed-days-filter');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterQuery = e.target.value;
                renderTableBody();
            });
        }

        if (daysFilter) {
            daysFilter.addEventListener('change', (e) => {
                filterDaysGroup = e.target.value;
                renderTableBody();
            });
        }

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#elapsed-table-body');
        if (!tbody) return;

        const students = stateStore.getStudents();
        const teachers = stateStore.getTeachers();
        const books = stateStore.getBooks();
        const studentBooks = stateStore.getStudentBooks();
        const attendance = stateStore.getAttendance();
        const payments = stateStore.getPayments();

        // Process student elapsed status
        const elapsedList = students.map(s => {
            const teacher = teachers.find(t => t.id === s.teacherId);
            
            // Get all books registered to this student
            const sBooks = studentBooks.filter(sb => sb.studentId === s.id);
            
            // Sort to find the latest one
            sBooks.sort((a, b) => (b.regDate || '').localeCompare(a.regDate || ''));
            const latestSB = sBooks[0] || null;
            const bookInfo = latestSB ? books.find(b => b.id === latestSB.bookId) : null;

            let attendedCount = 0;
            let recommendedDays = 90;
            let ratio = 0;
            let statusGroup = 'normal';

            if (latestSB) {
                recommendedDays = bookInfo ? (bookInfo.recommendedDays || 90) : 90;
                // Count attendance on or after regDate
                attendedCount = attendance.filter(a => {
                    return a.studentId === s.id && a.date >= latestSB.regDate && (a.status === 'present' || a.status === 'late');
                }).length;

                ratio = recommendedDays > 0 ? (attendedCount / recommendedDays) : 0;
                if (ratio >= 0.9) {
                    statusGroup = 'recommended';
                } else if (ratio >= 0.8) {
                    statusGroup = 'warning';
                }
            }

            return {
                student: s,
                teacher: teacher,
                latestSB: latestSB,
                book: bookInfo,
                attendedCount: attendedCount,
                recommendedDays: recommendedDays,
                ratio: ratio,
                statusGroup: statusGroup
            };
        });

        // Apply filters
        const filtered = elapsedList.filter(item => {
            const nameMatch = !filterQuery || item.student.name.toLowerCase().includes(filterQuery.toLowerCase());
            
            let daysMatch = true;
            if (filterDaysGroup) {
                daysMatch = item.statusGroup === filterDaysGroup;
            }

            return nameMatch && daysMatch;
        });

        // Sort descending by ratio so students closest to recommendation show first
        filtered.sort((a, b) => b.ratio - a.ratio);

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        등록된 교재 경과일 정보가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const student = item.student;
            const teacher = item.teacher;
            const book = item.book;
            const sb = item.latestSB;
            
            let bookNameText = '<span style="color: var(--text-muted); font-style: italic;">미등록</span>';
            let regDateText = '-';
            let elapsedText = '<span style="color: var(--text-muted);">-</span>';
            let statusBadge = '-';
            let actionHtml = '-';

            if (sb && book) {
                bookNameText = `${book.name} <span style="font-size: 0.75rem; color: var(--secondary);">(${sb.orderNo}권)</span>`;
                regDateText = sb.regDate;

                // Elapsed calculation and badge
                const A = item.attendedCount;
                const R = item.recommendedDays;
                
                if (item.statusGroup === 'recommended') {
                    elapsedText = `<span class="badge badge-danger" style="padding: 4px 10px; font-weight: 800;">${A}일 / ${R}일 (교재 추천)</span>`;
                } else if (item.statusGroup === 'warning') {
                    elapsedText = `<span class="badge badge-warning" style="padding: 4px 10px; font-weight: 800; background: #e67e22; color: white;">${A}일 / ${R}일 (주의)</span>`;
                } else {
                    elapsedText = `<span class="badge badge-success" style="padding: 4px 10px; font-weight: 700;">${A}일 / ${R}일 (정상)</span>`;
                }

                // Retrieve payment from payments table
                const payRecord = sb.paymentId ? payments.find(p => p.id === sb.paymentId) : payments.find(p => p.studentId === student.id && p.bookId === sb.bookId && p.type === 'book');
                const paymentStatus = payRecord ? payRecord.status : 'unpaid';

                // Payment Status Badge & Action
                if (paymentStatus === 'paid') {
                    statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> 완납</span>`;
                    actionHtml = `<span style="color: var(--success); font-size: 0.8rem; font-weight: bold;"><i class="fa-solid fa-circle-check"></i> 수납 완료</span>`;
                } else if (paymentStatus === 'requested') {
                    statusBadge = `<span class="badge badge-warning" style="background: var(--primary); color: white;"><i class="fa-solid fa-paper-plane"></i> 결제 요청됨</span>`;
                    actionHtml = `
                        <button class="btn btn-secondary btn-request-payment" data-id="${payRecord ? payRecord.id : sb.id}" style="padding: 4px 8px; font-size: 0.75rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-rotate-right"></i> 재요청
                        </button>
                    `;
                } else {
                    statusBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-exclamation"></i> 청구전</span>`;
                    actionHtml = `
                        <button class="btn btn-primary btn-request-payment" data-id="${payRecord ? payRecord.id : sb.id}" style="padding: 4px 8px; font-size: 0.75rem; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-paper-plane"></i> 결제 요청
                        </button>
                    `;
                }
            }

            return `
                <tr>
                    <td style="font-weight: 600;">
                        <span style="font-size: 0.95rem; color: var(--text-main);">${student.name}</span>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal; margin-top: 2px;">학부모: ${student.parentPhone}</div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--accent); font-size: 0.9rem;">${student.instrument}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">강사: ${teacher ? teacher.name : '미지정'}</div>
                    </td>
                    <td style="font-weight: 600; color: var(--text-main);">${bookNameText}</td>
                    <td>${regDateText}</td>
                    <td>${elapsedText}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: right;">${actionHtml}</td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-request-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                stateStore.requestBookPayment(id);
            });
        });
    };

    const unsubStudentBooks = stateStore.subscribe('STUDENT_BOOKS_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubPayments = stateStore.subscribe('PAYMENTS_CHANGED', render);
    const unsubAttendance = stateStore.subscribe('ATTENDANCE_CHANGED', render);

    render();

    return () => {
        unsubStudentBooks();
        unsubStudents();
        unsubPayments();
        unsubAttendance();
    };
}

/**
 * 8.5. 수강과목 관리 (renderSubjects)
 * Renders list of subjects/courses and handles CRUD.
 */
export function renderSubjects(container) {
    let filterQuery = '';
    let editingSubjectId = null;

    const render = () => {
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px;" class="subjects-layout-grid">
                <!-- Column 1: Subjects Table -->
                <div class="glass-card" style="display: flex; flex-direction: column;">
                    <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-graduation-cap" style="color: var(--primary);"></i>
                        수강과목 관리
                    </h3>
                    
                    <!-- Search row -->
                    <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                        <div style="position: relative; flex-grow: 1; min-width: 180px;">
                            <input type="text" id="subject-search-input" class="form-control" placeholder="과목명 검색..." value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                        </div>
                    </div>

                    <div class="table-wrapper" style="margin-top: 0;">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    <th>과목명</th>
                                    <th style="width: 100px;">상태</th>
                                    <th style="width: 120px;">등록일</th>
                                    <th style="width: 120px;">수정일</th>
                                    <th style="width: 100px; text-align: right;">관리</th>
                                </tr>
                            </thead>
                            <tbody id="subjects-table-body"></tbody>
                        </table>
                    </div>
                </div>

                <!-- Column 2: Subject Form -->
                <div class="glass-card" style="align-self: start;">
                    <h3 id="subject-form-heading" style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                        <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                        신규 과목 추가
                    </h3>

                    <form id="subject-form">
                        <div class="form-group">
                            <label for="subject-name-input">과목명 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="subject-name-input" class="form-control" placeholder="예: 체르니 100" required>
                        </div>
                        <div class="form-group">
                            <label for="subject-active-select">사용 여부</label>
                            <select id="subject-active-select" class="form-control">
                                <option value="true">사용</option>
                                <option value="false">미사용</option>
                            </select>
                        </div>

                        <div id="subject-form-buttons-container" style="display: flex; gap: 8px; margin-top: 20px;">
                            <button type="submit" class="btn btn-primary" style="flex-grow: 2; justify-content: center;">
                                <i class="fa-solid fa-check"></i> <span id="subject-submit-btn-label">추가 완료</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Bind events inside render
        const searchInput = container.querySelector('#subject-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filterQuery = e.target.value;
                renderTableBody();
            });
        }

        const form = container.querySelector('#subject-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = container.querySelector('#subject-name-input').value.trim();
                const isActive = container.querySelector('#subject-active-select').value === 'true';

                if (editingSubjectId) {
                    stateStore.updateSubject(editingSubjectId, { name, isActive });
                    resetForm();
                } else {
                    stateStore.addSubject(name, isActive);
                    form.reset();
                }
            });
        }

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#subjects-table-body');
        if (!tbody) return;

        const subjects = stateStore.getSubjects();

        const filtered = subjects.filter(s => {
            return !filterQuery || s.name.toLowerCase().includes(filterQuery.toLowerCase());
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        등록된 과목이 없거나 검색 결과가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(s => {
            const isChecked = s.isActive ? 'checked' : '';
            return `
                <tr>
                    <td style="font-weight: 600; color: var(--text-main);">${s.name}</td>
                    <td>
                        <label class="switch-toggle" style="display: inline-flex; align-items: center; cursor: pointer; gap: 8px;">
                            <input type="checkbox" class="subject-status-checkbox" data-id="${s.id}" ${isChecked} style="accent-color: var(--primary);">
                            <span style="font-size: 0.8rem; color: ${s.isActive ? 'var(--success)' : 'var(--text-muted)'}; font-weight: bold;">
                                ${s.isActive ? '사용' : '미사용'}
                            </span>
                        </label>
                    </td>
                    <td>${s.regDate || '-'}</td>
                    <td>${s.updateDate || '-'}</td>
                    <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 8px;">
                            <button class="btn btn-secondary btn-icon-only edit-subject-btn" data-id="${s.id}" title="수정">
                                <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only delete-subject-btn" data-id="${s.id}" title="삭제">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Action bindings
        tbody.querySelectorAll('.edit-subject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                startEditMode(id);
            });
        });

        tbody.querySelectorAll('.delete-subject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const subjects = stateStore.getSubjects();
                const subject = subjects.find(s => s.id === id);
                if (confirm(`정말로 '${subject.name}' 과목을 삭제하시겠습니까?`)) {
                    stateStore.deleteSubject(id);
                    if (editingSubjectId === id) {
                        resetForm();
                    }
                }
            });
        });

        tbody.querySelectorAll('.subject-status-checkbox').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const active = e.target.checked;
                stateStore.updateSubject(id, { isActive: active });
            });
        });
    };

    const startEditMode = (id) => {
        editingSubjectId = id;
        const subjects = stateStore.getSubjects();
        const subject = subjects.find(s => s.id === id);
        if (!subject) return;

        container.querySelector('#subject-name-input').value = subject.name;
        container.querySelector('#subject-active-select').value = String(subject.isActive);

        container.querySelector('#subject-form-heading').innerHTML = `
            <i class="fa-solid fa-pen" style="color: var(--primary);"></i>
            과목 정보 수정
        `;
        container.querySelector('#subject-submit-btn-label').textContent = '수정 완료';

        const buttonsContainer = container.querySelector('#subject-form-buttons-container');
        if (!container.querySelector('#cancel-subject-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.id = 'cancel-subject-edit-btn';
            cancelBtn.style.flexGrow = '1';
            cancelBtn.style.justifyContent = 'center';
            cancelBtn.textContent = '취소';
            cancelBtn.addEventListener('click', resetForm);
            buttonsContainer.appendChild(cancelBtn);
        }
    };

    const resetForm = () => {
        editingSubjectId = null;
        const form = container.querySelector('#subject-form');
        if (form) form.reset();

        const heading = container.querySelector('#subject-form-heading');
        if (heading) {
            heading.innerHTML = `
                <i class="fa-solid fa-plus" style="color: var(--accent);"></i>
                신규 과목 추가
            `;
        }
        const label = container.querySelector('#subject-submit-btn-label');
        if (label) label.textContent = '추가 완료';

        const cancelBtn = container.querySelector('#cancel-subject-edit-btn');
        if (cancelBtn) cancelBtn.remove();
    };

    render();

    // Subscribe to state changes
    const unsubSubjects = stateStore.subscribe('SUBJECTS_CHANGED', render);
    return () => {
        unsubSubjects();
    };
}
