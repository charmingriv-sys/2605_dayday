import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { PhoneNumberInput, AddressInput } from '../../utils/inputHelper.js';
import { renderParentPortal } from '../parent.js';
import { formatPhoneNumber, isIncompleteStudent, showKakaoTalkToast, showLocalConfirm, setOpenStudentDetailModal } from './shared.js';


/**
 * 2. 원생 명부 관리 (renderStudents)
 * Renders a list of students with filter/search capability.
 * Includes "Add Student" modal trigger, editing, and deletion.
 */
    const openDeleteAuthModal = (studentId, onSuccess) => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-lock" style="color: var(--danger); margin-right: 8px;"></i>삭제 보안 인증</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.2rem;">
                    원생 정보를 삭제하려면 <strong>시스템 비밀번호</strong>를 입력해 주세요.
                </p>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="delete-system-password" style="font-weight: 600; font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 6px;">시스템 비밀번호 (4자리)</label>
                    <input type="password" id="delete-system-password" class="form-control" placeholder="••••" maxlength="4" style="text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem; height: 50px;">
                    <span id="delete-auth-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 6px;"></span>
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; display: flex; gap: 10px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; margin-bottom: 0;">취소</button>
                <button class="btn btn-danger" id="btn-confirm-delete-auth" style="flex: 1; margin-bottom: 0;">확인</button>
            </div>
        `;
        
        const onInit = (contentArea) => {
            const passwordInput = contentArea.querySelector('#delete-system-password');
            const confirmBtn = contentArea.querySelector('#btn-confirm-delete-auth');
            const feedback = contentArea.querySelector('#delete-auth-feedback');
            
            confirmBtn.addEventListener('click', () => {
                const enteredPassword = passwordInput.value;
                const activeAcademy = stateStore.getAcademy(stateStore.getCurrentUser().academyId);
                const systemPassword = activeAcademy ? activeAcademy.systemPassword : '0000';
                
                if (enteredPassword === systemPassword) {
                    closeModal();
                    onSuccess();
                } else {
                    feedback.textContent = '비밀번호가 일치하지 않습니다.';
                    feedback.style.display = 'block';
                    passwordInput.focus();
                }
            });

            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                }
            });
        };

        openModal(modalHtml, onInit);
    };

    const openParentPreviewModal = (studentId) => {
        const student = stateStore.getStudent(studentId);
    if (!student) return;

    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-mobile-screen-button" style="color: var(--accent); margin-right: 8px;"></i><strong>${student.name}</strong> 학부모 화면 미리보기</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.25);">
            <!-- Smartphone frame mockup wrapper -->
            <div class="smartphone-preview-frame" style="width: 360px; height: 680px; border: 12px solid #2d3436; border-radius: 36px; box-shadow: 0 15px 35px rgba(0,0,0,0.6); background: #0f0f1b; overflow: hidden; position: relative; display: flex; flex-direction: column; border-color: #2b2b3a;">
                <!-- Speaker slot -->
                <div class="smartphone-speaker-slot" style="width: 50px; height: 4px; background: #2b2b3a; border-radius: 2px; position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 10;"></div>
                
                <!-- Simulated content container -->
                <div id="smartphone-content-container" style="flex: 1; overflow: hidden; height: 100%; display: flex; flex-direction: column;">
                    <!-- Rendered parent portal inside -->
                </div>
            </div>
        </div>
    `;

    const onInit = (contentArea) => {
        const smartContainer = contentArea.querySelector('#smartphone-content-container');
        if (smartContainer) {
            renderParentPortal(smartContainer, studentId);
        }
    };

    openModal(modalHtml, onInit);
};


const printStudentRegister = () => {
    const students = stateStore.getStudents();
    const teachers = stateStore.getTeachers();
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
        alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
        return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));

    let rowsHtml = sortedStudents.map((s, idx) => {
        const teacher = teachers.find(t => t.id === s.teacherId);
        const birthDate = s.age ? `${2026 - s.age}-01-01` : '-';
        const ageStr = s.age ? ` (${s.age}세)` : '';
        const teacherName = teacher ? (teacher.employmentStatus === 'resigned' ? `${teacher.name}(퇴사)` : teacher.name) : '미배정';
        
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td>${birthDate}${ageStr}</td>
                <td>[주소지 미기입 (보안)]</td>
                <td>${s.phone || '-'}</td>
                <td>${s.instrument || '-'}</td>
                <td>${teacherName}</td>
                <td>${s.enrollDate || '-'}</td>
                <td>${s.leaveDate || '-'}</td>
            </tr>
        `;
    }).join('');

    if (sortedStudents.length === 0) {
        rowsHtml = `<tr><td colspan="10" style="text-align:center; padding: 20px;">등록된 원생이 없습니다.</td></tr>`;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>원생 대장 [별지 제25호서식]</title>
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
                <div class="law-ref">■ 학원의 설립ㆍ운영 및 과외교습에 관한 법률 시행규칙 [별지 제25호서식] &lt;개정 2020. 02. 12.&gt;</div>
                <div class="header-container">
                    <h1 class="form-title">수 강 생 대 장</h1>
                    <div class="academy-info">
                        학원명: ${settings.academyName} &nbsp;|&nbsp; 대표자: ${settings.representative} &nbsp;|&nbsp; 사업자번호: ${settings.businessNumber}
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">연번</th>
                            <th style="width: 10%;">원생 등록번호</th>
                            <th style="width: 10%;">성명</th>
                            <th style="width: 12%;">생년월일(나이)</th>
                            <th style="width: 20%;">주소</th>
                            <th style="width: 12%;">전화번호</th>
                            <th style="width: 10%;">교습과목</th>
                            <th style="width: 8%;">담당강사</th>
                            <th style="width: 10%;">입원(수강)일</th>
                            <th style="width: 10%;">퇴원일</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    출력일시: ${today} / ${settings.academyName} 관리 시스템
                </div>
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                    window.close();
                }, 300);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

const generateNtsCertificatePrintout = (studentId, parentInfo) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;
    const rawSettings = stateStore.getSettings() || {};
    const settings = {
        academyName: rawSettings.academyName || '튜링 음악학원',
        businessNumber: rawSettings.businessNumber || '120-00-00000',
        representative: rawSettings.representative || '김하은',
        address: rawSettings.address || '서울시 서초구 반포동 123-4',
        phone: rawSettings.phone || '02-1234-5678',
        ...rawSettings
    };

    const allPayments = stateStore.getPayments();
    const filteredPayments = allPayments.filter(p => {
        const isPaid = p.status === 'paid';
        const isEdu = p.type === 'education';
        const isStudent = p.studentId === studentId;
        if (!isPaid || !isEdu || !isStudent) return false;
        
        const payDateVal = p.paidDate || p.invoiceDate;
        return payDateVal && payDateVal.startsWith(parentInfo.year.toString());
    });

    filteredPayments.sort((a, b) => (a.paidDate || a.invoiceDate).localeCompare(b.paidDate || b.invoiceDate));

    let totalBilled = 0;
    let tableIRows = '';
    filteredPayments.forEach(p => {
        const payDateVal = p.paidDate || p.invoiceDate;
        const yearMonth = payDateVal ? payDateVal.substring(0, 7).replace('-', '.') : '';
        totalBilled += p.amount;
        tableIRows += `
            <tr>
                <td style="height: 25px;">${yearMonth}</td>
                <td>학원</td>
                <td>수업료</td>
                <td style="text-align: right; padding-right: 8px;">${p.amount.toLocaleString()}</td>
                <td style="text-align: right; padding-right: 8px;">0</td>
                <td style="text-align: right; padding-right: 8px; font-weight: bold;">${p.amount.toLocaleString()}</td>
            </tr>
        `;
    });

    const minTableIRows = 4;
    if (filteredPayments.length < minTableIRows) {
        const padCount = minTableIRows - filteredPayments.length;
        for (let i = 0; i < padCount; i++) {
            tableIRows += `
                <tr>
                    <td style="height: 25px;">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                </tr>
            `;
        }
    }

    tableIRows += `
        <tr style="background-color: #fcfcfc; font-weight: bold;">
            <td style="height: 25px;">계</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td style="text-align: right; padding-right: 8px;">${totalBilled.toLocaleString()}</td>
            <td style="text-align: right; padding-right: 8px;">0</td>
            <td style="text-align: right; padding-right: 8px;">${totalBilled.toLocaleString()}</td>
        </tr>
    `;

    let tableIIRows = '';
    for (let i = 0; i < 3; i++) {
        tableIIRows += `
            <tr>
                <td style="height: 25px;">&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
            </tr>
        `;
    }
    tableIIRows += `
        <tr style="background-color: #fcfcfc; font-weight: bold;">
            <td style="height: 25px;">계</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td style="text-align: right; padding-right: 8px;">0</td>
        </tr>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
        return;
    }

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const dateStrFormatted = `${todayYear}년 ${todayMonth}월 ${todayDay}일`;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>교육비 납입 증명서 [별지 제44호서식]</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 15mm 15mm 15mm 15mm;
                }
                body {
                    font-family: 'Malgun Gothic', 'Dotum', sans-serif;
                    color: #000;
                    background: #fff;
                    margin: 0;
                    padding: 0;
                    font-size: 9pt;
                    line-height: 1.4;
                }
                .container {
                    width: 100%;
                }
                .law-title {
                    font-size: 7.5pt;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 1.5px solid #000;
                    padding-bottom: 4px;
                    margin-bottom: 20px;
                }
                .main-title {
                    text-align: center;
                    font-size: 20pt;
                    font-weight: bold;
                    margin: 15px 0 25px 0;
                    letter-spacing: 4px;
                }
                table.form-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                table.form-table th, table.form-table td {
                    border: 1px solid #000;
                    padding: 6px 8px;
                    text-align: left;
                    vertical-align: middle;
                }
                table.form-table th {
                    background-color: #f2f2f2;
                    font-weight: normal;
                    text-align: center;
                    font-size: 8.5pt;
                }
                table.form-table td {
                    font-size: 8.5pt;
                }
                .section-title {
                    font-weight: bold;
                    font-size: 10pt;
                    margin: 15px 0 6px 0;
                }
                .cert-text {
                    text-align: center;
                    font-size: 10.5pt;
                    line-height: 1.8;
                    margin: 35px 0;
                }
                .signature-block {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 25px 0;
                }
                .signature-row {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 100%;
                    margin-top: 10px;
                    font-size: 11pt;
                    position: relative;
                }
                .red-stamp {
                    position: absolute;
                    right: calc(50% - 100px);
                    width: 44px;
                    height: 44px;
                    border: 2px solid #ff0000;
                    border-radius: 50%;
                    color: #ff0000;
                    font-size: 7pt;
                    font-family: 'Batang', 'Gungsuh', serif;
                    font-weight: bold;
                    line-height: 12px;
                    text-align: center;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    transform: rotate(-3deg);
                    user-select: none;
                    background: transparent;
                }
                .how-to-write {
                    margin-top: 25px;
                    border-top: 1px dashed #777;
                    padding-top: 10px;
                    font-size: 7.5pt;
                    color: #444;
                    line-height: 1.5;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="law-title">
                    <span>■ 소득세법 시행규칙 [별지 제44호서식] &lt;개정 2018. 3. 21.&gt;</span>
                    <span>(앞 쪽)</span>
                </div>
                
                <h1 class="main-title">교 육 비 납 입 증 명 서</h1>
                
                <table class="form-table">
                    <tr>
                        <th style="width: 15%; height: 32px;">① 상 호</th>
                        <td style="width: 35%;">${settings.academyName}</td>
                        <th style="width: 18%;">② 사업자등록번호</th>
                        <td style="width: 32%;">${settings.businessNumber}</td>
                    </tr>
                    <tr>
                        <th style="height: 32px;">③ 대표자</th>
                        <td>${settings.representative}</td>
                        <th>④ 전 화 번 호</th>
                        <td>${settings.phone}</td>
                    </tr>
                    <tr>
                        <th style="height: 32px;">⑤ 주 소</th>
                        <td colspan="3">${settings.address}</td>
                    </tr>
                    <tr>
                        <th rowspan="2" style="text-align: center;">신청인</th>
                        <th style="height: 32px;">⑥ 성 명</th>
                        <td>${parentInfo.parentName}</td>
                        <th>⑦ 주민등록번호</th>
                        <td>${parentInfo.parentResidentId}</td>
                    </tr>
                    <tr>
                        <th style="height: 32px;">⑧ 주 소</th>
                        <td colspan="3">${parentInfo.parentAddress}</td>
                    </tr>
                    <tr>
                        <th rowspan="2" style="text-align: center;">대상자</th>
                        <th style="height: 32px;">⑨ 성 명</th>
                        <td><strong>${student.name}</strong></td>
                        <th>⑩ 신청인과의 관계</th>
                        <td>${parentInfo.relationship}</td>
                    </tr>
                </table>

                <div class="section-title">Ⅰ. 교육비 부담 명세</div>
                <table class="form-table" style="text-align: center;">
                    <thead>
                        <tr>
                            <th style="width: 15%; height: 28px;">⑪ 납부연월</th>
                            <th style="width: 15%;">⑫ 종 류</th>
                            <th style="width: 15%;">⑬ 구 분</th>
                            <th style="width: 18%;">⑭ 총교육비(A)</th>
                            <th style="width: 15%;">장학금 등(B)</th>
                            <th style="width: 22%;">공제대상 교육비부담액<br>(C=A-B)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableIRows}
                    </tbody>
                </table>

                <div class="section-title">Ⅱ. 교복 구입 명세</div>
                <table class="form-table" style="text-align: center;">
                    <thead>
                        <tr>
                            <th style="width: 15%; height: 28px;">구입연월</th>
                            <th style="width: 25%;">품 목</th>
                            <th style="width: 15%;">수 량</th>
                            <th style="width: 20%;">단 가</th>
                            <th style="width: 25%;">금 액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableIIRows}
                    </tbody>
                </table>

                <table class="form-table">
                    <tr>
                        <th style="width: 15%; height: 32px; text-align: center;">사용목적</th>
                        <td>교육비공제 신청용</td>
                    </tr>
                </table>

                <div class="cert-text">
                    「소득세법 시행령」 제113조제1항에 따라 위와 같이 교육비를 지출하였음을 증명해 주시기 바랍니다.
                </div>

                <div class="signature-block">
                    <div style="font-size: 10pt;">${dateStrFormatted}</div>
                    <div class="signature-row" style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 4px;">
                        <span>신청인 :</span>
                        <span style="font-weight: bold; border-bottom: 1px solid #000; min-width: 120px; text-align: center; display: inline-block; margin: 0 8px;">${parentInfo.parentName}</span>
                        <span>(서명 또는 인)</span>
                    </div>
                </div>

                <div style="border-top: 1px solid #000; margin: 20px 0;"></div>

                <div class="cert-text" style="margin: 25px 0 15px 0;">
                    위와 같이 교육비를 지출하였음을 증명합니다.
                </div>

                <div class="signature-block" style="margin-top: 10px;">
                    <div style="font-size: 10pt;">${dateStrFormatted}</div>
                    <div class="signature-row" style="margin-top: 15px; font-weight: bold; font-size: 12pt; display: flex; justify-content: center; align-items: center; gap: 4px;">
                        <span>확인자 : ${settings.academyName} 대표자 ${settings.representative}</span>
                        <span style="position: relative; display: inline-block; margin-left: 8px;">
                            (서명 또는 인)
                            ${settings.directorSignature ? `
                                <img src="${settings.directorSignature}" class="director-stamp-img" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; object-fit: contain;">
                            ` : ''}
                        </span>
                    </div>
                </div>

                <div class="how-to-write">
                    <span style="font-weight: bold; display: block; margin-bottom: 4px;">&lt;작성방법&gt;</span>
                    1. "신청인" 란에는 교육비를 지출한 소득자의 인적사항을 적습니다.<br>
                    2. "대상자" 란에는 지출된 교육비의 수혜자를 적습니다.<br>
                    3. "Ⅰ. 교육비부담명세"란에는 교복구입비용은 적지 않습니다. 교복구입비용(중ㆍ고등학생에 한정함)은 "Ⅱ. 교복구입명세"란에 적습니다.<br>
                    4. "⑫ 종류" 란에는 학원 등으로 구분하여 적습니다. "⑬ 구분" 란에는 수업료 등으로 구분하여 적습니다.
                </div>
            </div>
            <script>
                setTimeout(function() {
                    window.print();
                    window.close();
                }, 300);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

const openNtsCertificatePrintModal = (studentId) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;

    const currentYear = new Date().getFullYear();
    let yearOptions = '';
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
        yearOptions += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}년</option>`;
    }

    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-print" style="color: #00adb5; margin-right: 8px;"></i>교육비 납입 증명서 정보 입력</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.2rem;">
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">
                <i class="fa-solid fa-circle-info" style="color: #00adb5; margin-right: 4px;"></i>
                주민등록번호 등 개인정보는 저장되지 않으며, 일회성 인쇄 문서 생성 목적으로만 사용됩니다.
            </p>
            <form id="nts-input-form" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="form-group">
                    <label for="nts-year">귀속 연도</label>
                    <select id="nts-year" class="form-control" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                        ${yearOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label for="nts-parent-name">신청인(학부모) 성명</label>
                    <input type="text" id="nts-parent-name" class="form-control" required placeholder="예: 김학부" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
                <div class="form-group">
                    <label for="nts-parent-resident-id">주민등록번호</label>
                    <input type="text" id="nts-parent-resident-id" class="form-control" required placeholder="예: 800101-1234567" maxlength="14" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
                <div class="form-group">
                    <label for="nts-relationship">대상자(원생)와의 관계</label>
                    <input type="text" id="nts-relationship" class="form-control" value="자" required placeholder="예: 자, 녀, 부, 모" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
                <div class="form-group">
                    <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; display: block;">주소 <span style="color: var(--danger);">*</span></label>
                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                        <input type="text" id="nts-parent-postcode" class="form-control" readonly placeholder="우편번호" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem; flex-grow: 1; margin-bottom: 0;">
                        <button type="button" id="btn-nts-parent-address-search" class="btn btn-secondary" style="padding: 0 12px; font-size: 0.85rem; margin-bottom: 0; flex-shrink: 0; justify-content: center; background: var(--secondary); color: var(--text-main);">주소 검색</button>
                    </div>
                    <input type="text" id="nts-parent-address" class="form-control" readonly placeholder="기본 주소지" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem; margin-bottom: 8px;">
                    <input type="text" id="nts-parent-address-detail" class="form-control" placeholder="상세주소 입력" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; font-size: 0.9rem;">
                </div>
            </form>
        </div>
        <div class="modal-footer" style="padding: 1.2rem; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
            <button class="btn btn-secondary" data-close-modal style="flex: 1; justify-content: center;">취소</button>
            <button class="btn btn-primary" id="btn-submit-nts-print" style="flex: 1; justify-content: center; background: #00adb5; border-color: #00adb5; color: #fff;">인쇄하기</button>
        </div>
    `;

    const onInit = (contentArea) => {
        const addressBinder = AddressInput.bind({
            postcodeEl: contentArea.querySelector('#nts-parent-postcode'),
            addressEl: contentArea.querySelector('#nts-parent-address'),
            detailAddressEl: contentArea.querySelector('#nts-parent-address-detail'),
            searchBtnEl: contentArea.querySelector('#btn-nts-parent-address-search')
        });

        const destroyBinder = () => {
            addressBinder.destroy();
        };

        contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
            el.addEventListener('click', destroyBinder);
        });

        const residentInput = contentArea.querySelector('#nts-parent-resident-id');
        if (residentInput) {
            residentInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/[^0-9]/g, '');
                if (val.length > 6) {
                    val = val.substring(0, 6) + '-' + val.substring(6, 13);
                }
                e.target.value = val;
            });
        }

        const submitBtn = contentArea.querySelector('#btn-submit-nts-print');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const year = parseInt(contentArea.querySelector('#nts-year').value);
                const parentName = contentArea.querySelector('#nts-parent-name').value.trim();
                const parentResidentId = contentArea.querySelector('#nts-parent-resident-id').value.trim();
                const relationship = contentArea.querySelector('#nts-relationship').value.trim();
                
                const parentPostcode = contentArea.querySelector('#nts-parent-postcode').value.trim();
                const parentAddressBasic = contentArea.querySelector('#nts-parent-address').value.trim();
                const parentAddressDetail = contentArea.querySelector('#nts-parent-address-detail').value.trim();

                if (!parentName || !parentResidentId || !relationship || !addressBinder.isValid()) {
                    alert('모든 필수 입력 값을 채워주세요.');
                    return;
                }

                if (parentResidentId.length < 14) {
                    alert('올바른 주민등록번호 13자리를 입력해주세요.');
                    return;
                }

                destroyBinder();
                closeModal();

                const parentAddress = `[${parentPostcode}] ${parentAddressBasic} ${parentAddressDetail}`;

                generateNtsCertificatePrintout(studentId, {
                    year,
                    parentName,
                    parentResidentId,
                    relationship,
                    parentAddress
                });
            });
        }
    };

    openModal(modalHtml, onInit);
};

// Helper to calculate leave duration in days (inclusive)
const calculateLeaveDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 0;
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// Shared Modal Manager for Student Detailed Info Profile
const openStudentDetailModal = (studentId) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;
    const teachers = stateStore.getTeachers();
    const teacher = teachers.find(t => t.id === student.teacherId);
    const classSchedules = stateStore.getClassesForStudent(studentId);
    const scheduleText = classSchedules.map(c => `${c.dayOfWeek} ${c.time}`).join(', ');

    const enrollDateVal = new Date(student.enrollDate || new Date().toISOString().slice(0, 10));
    const currentDate = new Date();
    const monthsElapsed = (currentDate.getFullYear() - enrollDateVal.getFullYear()) * 12 + (currentDate.getMonth() - enrollDateVal.getMonth());
    const elapsedText = monthsElapsed <= 0 ? '1개월 미만' : `${monthsElapsed}개월`;

    const isIncomplete = isIncompleteStudent(student);
    const teacherMissing = !student.teacherId;

    let warningBannerHtml = '';
    if (isIncomplete) {
        let warningText = '필수 운영 정보가 입력되지 않은 원생입니다. 담당 강사, 정기 청구일, 수강료 정보를 입력하면 모든 기능을 사용할 수 있습니다.';
        if (teacherMissing) {
            warningText += '<br><strong>담당 강사가 배정되지 않은 원생입니다. 수업 관리 기능을 사용하려면 담당 강사를 먼저 지정해 주세요.</strong>';
        }
        warningBannerHtml = `
            <div style="background: var(--warning-light); border: 1px solid var(--warning); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 1.2rem; color: #a04000; font-size: 0.85rem; line-height: 1.5; display: flex; align-items: flex-start; gap: 8px;">
                <i class="fa-solid fa-circle-exclamation" style="margin-top: 2px; font-size: 1.15rem; color: var(--warning); flex-shrink: 0;"></i>
                <div>${warningText}</div>
            </div>
        `;
    }

    const contacts = stateStore.getParentContactsByStudent(studentId) || [];
    const parent1 = contacts.find(c => c.slot === 'parent1');
    const parent2 = contacts.find(c => c.slot === 'parent2');

    const relationKo = {
        mother: '모',
        father: '부',
        grandmother: '조모',
        grandfather: '조부',
        guardian: '보호자',
        etc: '기타'
    };

    const p1Name = parent1 ? parent1.name : (student.parentName || '');
    const p1Phone = parent1 ? parent1.phone : (student.parentPhone || '');
    const p1Relation = parent1 ? parent1.relation : 'guardian';
    const p1RelationText = relationKo[p1Relation] || p1Relation || '보호자';

    const p2Name = parent2 ? parent2.name : '';
    const p2Phone = parent2 ? parent2.phone : '';
    const p2Relation = parent2 ? parent2.relation : '';
    const p2RelationText = relationKo[p2Relation] || p2Relation || '';

    // Cumulative leave periods history
    let periods = [];
    if (student.leavePeriods && student.leavePeriods.length > 0) {
        periods = [...student.leavePeriods];
    } else if (student.leaveStartDate && student.leaveEndDate) {
        periods = [{ startDate: student.leaveStartDate, endDate: student.leaveEndDate }];
    }

    const today = new Date().toISOString().slice(0, 10);
    let currentLeavePeriod = null;
    if (student.status === 'on_leave') {
        currentLeavePeriod = periods.find(p => p.startDate <= today && today <= p.endDate);
    }

    let statusDatesHtml = '';
    if (student.status === 'on_leave' && currentLeavePeriod) {
        const days = calculateLeaveDays(currentLeavePeriod.startDate, currentLeavePeriod.endDate);
        statusDatesHtml += `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                <span style="color: var(--text-muted);">현재 휴원 기간</span>
                <strong>휴원 ${currentLeavePeriod.startDate} ~ ${currentLeavePeriod.endDate} (${days}일)</strong>
            </div>
        `;
    } else if (student.status === 'withdrawn') {
        statusDatesHtml += `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                <span style="color: var(--text-muted);">퇴원일</span>
                <strong>${student.withdrawalDate || student.leaveDate || '-'}</strong>
            </div>
        `;
    }

    if (periods.length > 0) {
        // Sort descending by startDate to show latest first
        periods.sort((a, b) => b.startDate.localeCompare(a.startDate));

        const historyRows = periods.map(p => {
            const days = calculateLeaveDays(p.startDate, p.endDate);
            return `<div style="font-weight: 500; font-size: 0.85rem; color: var(--text-main); text-align: right; margin-bottom: 2px;">
                휴원 ${p.startDate} ~ ${p.endDate} (${days}일)
            </div>`;
        }).join('');

        statusDatesHtml += `
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px; align-items: flex-start;">
                <span style="color: var(--text-muted);">휴원 이력</span>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    ${historyRows}
                </div>
            </div>
        `;
    }

    const html = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-graduation-cap" style="color: var(--primary); margin-right: 8px;"></i><strong>${student.name}</strong> 원생 상세 정보</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-form-scroll-body text-markdown-body" style="padding: 1.2rem;">
            ${warningBannerHtml}
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">1. 기본 인적 사항</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">원생 이름</span>
                    <strong>${student.name}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">원생 상태</span>
                    <strong>${student.status === 'withdrawn' ? '퇴원' : (student.status === 'on_leave' ? '휴원' : '재원')}</strong>
                </div>
                ${statusDatesHtml}
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">생년월일</span>
                    <strong>${student.birthDate || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">소속 (학교 / 학년 / 반)</span>
                    <strong>${[student.school, student.gradeClass].filter(Boolean).join(' | ') || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">나이 / 구분</span>
                    <strong>${[(student.isAdult === true || student.isAdult === 'adult') ? '성인' : ((student.isAdult === false || student.isAdult === 'minor') ? '비성인' : '-'), student.age ? `${student.age}세` : ''].filter(Boolean).join(' | ') || '정보 없음'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">주소</span>
                    <strong>${student.address || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">본인 연락처</span>
                    <strong>${student.phone || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">보호자 1 (대표)</span>
                    <strong>${p1Name ? `${p1Name} (${p1RelationText}) | ${p1Phone || '-'}` : '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">보호자 2</span>
                    <strong>${p2Name ? `${p2Name} (${p2RelationText}) | ${p2Phone || '-'}` : '<span style="color: var(--text-muted); font-weight: normal;">등록되지 않음</span>'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">최초 등록일</span>
                    <strong>${student.enrollDate || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">수강 경과 개월수</span>
                    <strong style="color: var(--success);">${elapsedText}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">2. 음악학습경험 및 희망악기</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">학습 경험</span>
                    <strong>${(student.experienceType === null || student.experienceType === undefined || student.experienceType === '') ? '-' : student.experienceType}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">학습 기간</span>
                    <strong>${student.experiencePeriod || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">수강/희망 악기</span>
                    <strong>${student.instrument || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">소장 악기 유무</span>
                    <strong>${student.hasInstrument || '-'}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">3. 수강목적 및 레슨 방식</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">수강 목적</span>
                    <strong>${student.purpose || '-'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">원하는 레슨 방식</span>
                    <strong>${student.lessonStyle || '-'}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">4. 학원 행정 및 수업 시간표</div>
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.9rem; margin-bottom: 1.5rem; background: rgba(0,0,0,0.01); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">수강 교육비 / 청구일</span>
                    <strong>${(student.fee || 0).toLocaleString()}원 (매월 ${student.dueDay || 10}일)</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">배정 담당강사</span>
                    <strong>${teacher ? (teacher.employmentStatus === 'resigned' ? `${teacher.name} (퇴사)` : teacher.name) : '미배정'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.03); padding-bottom: 6px;">
                    <span style="color: var(--text-muted);">기본 수업시간</span>
                    <strong>${student.defaultClassDuration || 50}분</strong>
                </div>
                <div style="display: flex; justify-content: space-between; padding-bottom: 2px;">
                    <span style="color: var(--text-muted);">주간 고정 수업 시간표</span>
                    <strong>${scheduleText || '미지정'}</strong>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">5. 레슨 상담 및 특이사항</div>
            <div style="font-size: 0.9rem; background: rgba(0,0,0,0.01); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); min-height: 80px; white-space: pre-wrap; color: var(--text-main); line-height: 1.5; margin-bottom: 1.5rem;">${student.consultationNotes || '기록된 상담 및 특이사항이 없습니다.'}</div>

            <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 10px 0; border-left: 3px solid var(--primary); padding-left: 8px;">6. 시간표 등 일정 특이사항</div>
            <div style="font-size: 0.9rem; background: rgba(0,0,0,0.01); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); min-height: 60px; white-space: pre-wrap; color: var(--text-main); line-height: 1.5;">${student.scheduleNotes || '기록된 시간표 일정 특이사항이 없습니다.'}</div>

        </div>
        <div class="modal-footer" style="padding: 1.2rem; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary" id="btn-edit-student-from-detail" style="width: 100%; justify-content: center; height: 38px; font-weight: 600;">정보 수정하기</button>
            <button class="btn btn-warning" id="btn-change-status-from-detail" style="width: 100%; justify-content: center; height: 38px; font-weight: 600; background: #ff9f43; border-color: #ff9f43; color: #fff;">원생 상태 변경하기</button>
            <button class="btn btn-success" id="btn-preview-parent-view" style="width: 100%; justify-content: center; height: 38px; font-weight: 600; background: var(--accent); border-color: var(--accent); color: var(--bg-main);">
                <i class="fa-solid fa-mobile-screen-button" style="margin-right: 6px;"></i>학부모 화면 미리보기
            </button>
            <button class="btn btn-info" id="btn-nts-certificate" style="width: 100%; justify-content: center; height: 38px; font-weight: 600; background: #00adb5; border-color: #00adb5; color: #fff;">
                <i class="fa-solid fa-file-invoice" style="margin-right: 6px;"></i>교육비 납입증명서 출력
            </button>
            <button class="btn btn-secondary" data-close-modal style="width: 100%; justify-content: center; height: 38px; font-weight: 600;">닫기</button>
        </div>
    `;
    
    const onInitDetailModal = (contentArea) => {
        contentArea.classList.add('layout-fixed');
        const editBtn = contentArea.querySelector('#btn-edit-student-from-detail');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openStudentModal(studentId);
            });
        }
        const changeStatusBtn = contentArea.querySelector('#btn-change-status-from-detail');
        if (changeStatusBtn) {
            changeStatusBtn.addEventListener('click', () => {
                openStudentStatusModal(studentId);
            });
        }
        const previewBtn = contentArea.querySelector('#btn-preview-parent-view');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                openParentPreviewModal(studentId);
            });
        }
        const ntsBtn = contentArea.querySelector('#btn-nts-certificate');
        if (ntsBtn) {
            ntsBtn.addEventListener('click', () => {
                openNtsCertificatePrintModal(studentId);
            });
        }
    };
    
    openModal(html, onInitDetailModal);
};

const openStudentStatusModal = (studentId) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;

    const statusOptions = `
        <option value="attending" ${student.status === 'attending' ? 'selected' : ''}>재원</option>
        <option value="on_leave" ${student.status === 'on_leave' ? 'selected' : ''}>휴원</option>
        <option value="withdrawn" ${student.status === 'withdrawn' ? 'selected' : ''}>퇴원</option>
    `;

    const html = `
        <div class="modal-header">
            <h3 class="modal-title">
                <i class="fa-solid fa-user-gear" style="color: var(--primary); margin-right: 8px;"></i>
                <strong>${student.name}</strong> 원생 상태 변경
            </h3>
            <button class="modal-close" data-close-modal><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
            
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="modal-student-status" style="font-weight: 600;">원생 상태 <span style="color: var(--danger);">*</span></label>
                    <select id="modal-student-status" class="form-control" required style="width: 100%;">
                        ${statusOptions}
                    </select>
                </div>
            </div>

            <!-- 상태 날짜 정보 섹션 -->
            <div id="modal-status-dates-section" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01); display: none;">
                <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">상태 날짜 정보</div>
                <div id="modal-status-dates-row" class="form-row" style="display: flex; gap: 1rem;">
                    <!-- Dynamically populated date inputs -->
                </div>
            </div>

        </div>
        <div class="modal-footer" style="padding: 1.2rem; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="btn-status-cancel" style="flex: 1; justify-content: center; height: 38px; font-weight: 600;">취소</button>
            <button class="btn btn-primary" id="btn-status-submit" style="flex: 1; justify-content: center; height: 38px; font-weight: 600;">저장</button>
        </div>
    `;

    const onInitStatusModal = (contentArea) => {
        const statusEl = contentArea.querySelector('#modal-student-status');
        const statusDatesSection = contentArea.querySelector('#modal-status-dates-section');
        const statusDatesRow = contentArea.querySelector('#modal-status-dates-row');
        const cancelBtn = contentArea.querySelector('#btn-status-cancel');
        const submitBtn = contentArea.querySelector('#btn-status-submit');

        const resetErrorStyle = (el) => {
            if (!el) return;
            el.addEventListener('input', () => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
            el.addEventListener('change', () => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
        };

        const updateStatusDatesUI = () => {
            const currentStatus = statusEl.value;
            if (currentStatus === 'on_leave') {
                statusDatesSection.style.display = 'block';
                statusDatesRow.style.display = 'flex';
                const defaultStart = student.leaveStartDate || new Date().toISOString().slice(0, 10);
                const defaultEnd = student.leaveEndDate || new Date().toISOString().slice(0, 10);
                statusDatesRow.innerHTML = `
                    <div class="form-group" style="flex: 1;">
                        <label for="modal-student-leave-start-date">휴원 시작일 <span style="color: var(--danger);">*</span></label>
                        <input type="date" id="modal-student-leave-start-date" class="form-control" value="${defaultStart}" required style="width: 100%;">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="modal-student-leave-end-date">휴원 종료일 <span style="color: var(--danger);">*</span></label>
                        <input type="date" id="modal-student-leave-end-date" class="form-control" value="${defaultEnd}" required style="width: 100%;">
                    </div>
                `;
                const startEl = statusDatesRow.querySelector('#modal-student-leave-start-date');
                const endEl = statusDatesRow.querySelector('#modal-student-leave-end-date');
                resetErrorStyle(startEl);
                resetErrorStyle(endEl);
            } else if (currentStatus === 'withdrawn') {
                statusDatesSection.style.display = 'block';
                statusDatesRow.style.display = 'flex';
                const defaultWithdrawn = student.withdrawalDate || student.leaveDate || new Date().toISOString().slice(0, 10);
                statusDatesRow.innerHTML = `
                    <div class="form-group" style="flex: 1;">
                        <label for="modal-student-withdrawal-date">퇴원일 <span style="color: var(--danger);">*</span></label>
                        <input type="date" id="modal-student-withdrawal-date" class="form-control" value="${defaultWithdrawn}" required style="width: 100%;">
                    </div>
                    <div class="form-group" style="flex: 1;"></div>
                `;
                const withdrawEl = statusDatesRow.querySelector('#modal-student-withdrawal-date');
                resetErrorStyle(withdrawEl);
            } else {
                statusDatesSection.style.display = 'none';
                statusDatesRow.innerHTML = '';
            }
        };

        if (statusEl && statusDatesRow) {
            statusEl.addEventListener('change', updateStatusDatesUI);
            updateStatusDatesUI();
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                openStudentDetailModal(studentId);
            });
        }

        const closeBtn = contentArea.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.removeAttribute('data-close-modal');
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openStudentDetailModal(studentId);
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const status = statusEl.value;
                let leaveStartDate = student.leaveStartDate || null;
                let leaveEndDate = student.leaveEndDate || null;
                let withdrawalDate = student.withdrawalDate || null;
                let validationPassed = true;

                if (status === 'on_leave') {
                    const leaveStartEl = contentArea.querySelector('#modal-student-leave-start-date');
                    const leaveEndEl = contentArea.querySelector('#modal-student-leave-end-date');
                    const leaveStartVal = leaveStartEl ? leaveStartEl.value : '';
                    const leaveEndVal = leaveEndEl ? leaveEndEl.value : '';

                    if (!leaveStartVal) {
                        alert('휴원 시작일을 입력해 주세요.');
                        if (leaveStartEl) leaveStartEl.style.borderColor = 'var(--danger)';
                        validationPassed = false;
                    } else {
                        leaveStartDate = leaveStartVal;
                    }

                    if (!leaveEndVal) {
                        alert('휴원 종료일을 입력해 주세요.');
                        if (leaveEndEl) leaveEndEl.style.borderColor = 'var(--danger)';
                        validationPassed = false;
                    } else {
                        leaveEndDate = leaveEndVal;
                    }

                    if (leaveStartVal && leaveEndVal && leaveEndVal < leaveStartVal) {
                        alert('휴원 종료일은 휴원 시작일보다 빠를 수 없습니다.');
                        if (leaveEndEl) leaveEndEl.style.borderColor = 'var(--danger)';
                        validationPassed = false;
                    }
                } else if (status === 'withdrawn') {
                    const withdrawalDateEl = contentArea.querySelector('#modal-student-withdrawal-date');
                    const withdrawalDateVal = withdrawalDateEl ? withdrawalDateEl.value : '';

                    if (!withdrawalDateVal) {
                        alert('퇴원일을 입력해 주세요.');
                        if (withdrawalDateEl) withdrawalDateEl.style.borderColor = 'var(--danger)';
                        validationPassed = false;
                    } else {
                        withdrawalDate = withdrawalDateVal;
                    }
                }

                if (!validationPassed) {
                    return;
                }

                // Confirm status change
                if (student.status === 'attending' && status === 'on_leave') {
                    if (!confirm("원생 상태를 휴원으로 변경하시겠습니까?")) {
                        return;
                    }
                } else if (student.status !== 'withdrawn' && status === 'withdrawn') {
                    if (!confirm("원생 상태를 퇴원으로 변경하시겠습니까?\n퇴원은 삭제가 아니며 기존 이력은 보존됩니다.")) {
                        return;
                    }
                }

                // Preserve dates logic
                if (status === 'attending') {
                    leaveStartDate = student.leaveStartDate || null;
                    leaveEndDate = student.leaveEndDate || null;
                    withdrawalDate = student.withdrawalDate || null;
                } else if (status === 'on_leave') {
                    withdrawalDate = student.withdrawalDate || null;
                } else if (status === 'withdrawn') {
                    leaveStartDate = student.leaveStartDate || null;
                    leaveEndDate = student.leaveEndDate || null;
                }

                stateStore.updateStudent(studentId, {
                    status,
                    leaveStartDate,
                    leaveEndDate,
                    withdrawalDate
                });

                openStudentDetailModal(studentId);
            });
        }
    };

    openModal(html, onInitStatusModal);
};

// Shared Modal Manager for Student Books History Management
const openStudentBooksModal = (studentId) => {
    const student = stateStore.getStudent(studentId);
    if (!student) return;

    const renderModalContent = (contentArea) => {
        const books = stateStore.getBooks().filter(b => b.status === 'active');
        const studentBooks = stateStore.getBooksForStudent(studentId);
        
        let bookRows = '';
        if (studentBooks.length === 0) {
            bookRows = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem 0; font-size: 0.9rem;">
                        등록된 교재 수강 이력이 없습니다.
                    </td>
                </tr>
            `;
        } else {
            // Sort by registration date descending (latest first)
            const sortedSB = [...studentBooks].sort((a, b) => b.regDate.localeCompare(a.regDate));
            bookRows = sortedSB.map(sb => {
                const book = stateStore.getBook(sb.bookId);
                const bookName = book ? book.name : '삭제된 교재';
                const bookPrice = book ? `${book.price.toLocaleString()}원` : '-';
                
                let payBadge = '';
                if (sb.paymentStatus === 'paid') {
                    payBadge = '<span class="badge badge-success" style="padding: 2px 6px;">완납</span>';
                } else if (sb.paymentStatus === 'requested') {
                    payBadge = '<span class="badge badge-warning" style="padding: 2px 6px; background: var(--primary); color: white;">결제 요청됨</span>';
                } else {
                    payBadge = '<span class="badge badge-danger" style="padding: 2px 6px;">청구전</span>';
                }

                return `
                    <tr style="font-size: 0.85rem;">
                        <td style="font-weight: 600; color: var(--text-main); padding: 10px 8px;">${bookName}</td>
                        <td style="padding: 10px 8px;">${sb.regDate}</td>
                        <td style="text-align: center; padding: 10px 8px;">${sb.orderNo}권</td>
                        <td style="text-align: center; padding: 10px 8px;">${payBadge}</td>
                        <td style="text-align: right; padding: 10px 8px;">
                            <button class="btn btn-danger btn-icon-only delete-student-book-btn" data-sbid="${sb.id}" style="width: 28px; height: 28px; padding: 0; border-radius: var(--radius-sm); justify-content: center; display: inline-flex;">
                                <i class="fa-solid fa-xmark" style="font-size: 0.75rem;"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-book" style="color: var(--primary); margin-right: 8px;"></i><strong>${student.name}</strong> 원생 교재 수강 관리</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.2rem;">
                <!-- Add Book Mini Form -->
                <div class="glass-card" style="padding: 1.2rem; margin-bottom: 1.5rem; background: rgba(255, 255, 255, 0.02); border-color: rgba(255, 255, 255, 0.05); border-radius: var(--radius-md);">
                    <h4 style="font-size: 0.95rem; font-weight: 700; margin-top:0; margin-bottom: 12px; color: var(--accent); display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-circle-plus"></i> 신규 교재 수강 배부 등록
                    </h4>
                    <form id="assign-book-form" style="display: grid; grid-template-columns: 1.2fr 0.8fr 1.1fr auto; gap: 12px; align-items: flex-end; margin-bottom: 0;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="assign-book-select" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 6px;">배부 교재 선택</label>
                            <select id="assign-book-select" class="form-control" required style="margin-bottom:0; font-size: 0.82rem; padding: 8px 12px; height: 38px;">
                                <option value="" disabled selected>학원 교재 선택</option>
                                ${books.map(b => `<option value="${b.id}">${b.name} (${b.price.toLocaleString()}원)</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="assign-book-order" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 6px;">진도 회차 / 권수</label>
                            <input type="number" id="assign-book-order" class="form-control" value="1" min="1" max="50" required style="margin-bottom:0; font-size: 0.82rem; padding: 8px 12px; height: 38px;">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="assign-book-date" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 6px;">교재 수령일</label>
                            <input type="date" id="assign-book-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required style="margin-bottom:0; font-size: 0.82rem; padding: 8px 12px; height: 38px;">
                        </div>
                        <button type="submit" class="btn btn-primary" style="height: 38px; padding: 0 16px; font-size: 0.85rem; justify-content: center; font-weight: 700; border-radius: var(--radius-sm); white-space: nowrap;">
                            <i class="fa-solid fa-plus" style="margin-right: 4px;"></i> 배부
                        </button>
                    </form>
                </div>

                <!-- Books History Table -->
                <div class="table-wrapper" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: rgba(0,0,0,0.15); margin-top:0;">
                    <table class="custom-table" style="margin-top: 0; width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="font-size: 0.8rem; background: rgba(0,0,0,0.25);">
                                <th style="padding: 10px 8px; width: 40%;">교재명</th>
                                <th style="padding: 10px 8px; width: 25%;">수령 등록일</th>
                                <th style="padding: 10px 8px; text-align: center; width: 12%;">진도</th>
                                <th style="padding: 10px 8px; text-align: center; width: 13%;">결제구분</th>
                                <th style="padding: 10px 8px; text-align: right; width: 10%;">회수</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bookRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="modal-footer" style="padding: 1.2rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" data-close-modal style="width: 100%; justify-content: center; height: 40px; font-weight: 600;">닫기</button>
            </div>
        `;

        contentArea.innerHTML = modalHtml;

        // Form Submit
        const addForm = contentArea.querySelector('#assign-book-form');
        if (addForm) {
            addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const bookId = contentArea.querySelector('#assign-book-select').value;
                const orderNo = contentArea.querySelector('#assign-book-order').value;
                const regDate = contentArea.querySelector('#assign-book-date').value;

                stateStore.assignBookToStudent(studentId, bookId, regDate, orderNo);
                
                // Re-render modal content
                renderModalContent(contentArea);
            });
        }

        // Delete Row Action
        contentArea.querySelectorAll('.delete-student-book-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sbid = e.currentTarget.dataset.sbid;
                if (confirm('해당 교재 수강 배부 이력을 삭제하시겠습니까?')) {
                    stateStore.removeStudentBook(sbid);
                    renderModalContent(contentArea);
                }
            });
        });

        // Re-bind close triggers manually since HTML gets re-rendered
        contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
            el.addEventListener('click', closeModal);
        });
    };

    openModal('', renderModalContent);
};

// Shared Modal Manager for Student Registration & Editing
const openStudentModal = (studentId = null) => {
    const isEdit = !!studentId;
    const student = isEdit ? stateStore.getStudent(studentId) : null;
    const teachers = stateStore.getTeachers();
    const studentClasses = isEdit ? stateStore.getClassesForStudent(studentId) : [];

    const durationOptionsHtml = Array.from({ length: 18 }, (_, i) => (i + 1) * 5)
        .map(d => `<option value="${d}" ${(!student && d === 50) || (student && student.defaultClassDuration === d) ? 'selected' : ''}>${d}분</option>`)
        .join('');

    let stPostcode = '';
    let stBasicAddress = '';
    let stDetailAddress = '';

    if (student) {
        stPostcode = student.postcode || '';
        stBasicAddress = student.address || '';
        stDetailAddress = student.detailAddress || '';
        
        if (!stPostcode && stBasicAddress) {
            const match = stBasicAddress.match(/^\[(\d{5})\]\s*([^|]+?)(?:\s*\|\s*(.*))?$/);
            if (match) {
                stPostcode = match[1];
                stBasicAddress = match[2].trim();
                stDetailAddress = (match[3] || '').trim();
            } else {
                const match2 = stBasicAddress.match(/^(\d{5})\s+(.*)$/);
                if (match2) {
                    stPostcode = match2[1];
                    stBasicAddress = match2[2].trim();
                }
            }
        }
    }

    let parent1 = null;
    let parent2 = null;
    if (student) {
        const contacts = stateStore.getParentContactsByStudent(studentId) || [];
        parent1 = contacts.find(c => c.slot === 'parent1');
        parent2 = contacts.find(c => c.slot === 'parent2');
    }

    const p1Name = parent1 ? parent1.name : (student ? student.parentName || '' : '');
    const p1Phone = parent1 ? parent1.phone : (student ? student.parentPhone || '' : '');
    const p1Relation = parent1 ? parent1.relation : 'guardian';

    const p2Name = parent2 ? parent2.name : '';
    const p2Phone = parent2 ? parent2.phone : '';
    const p2Relation = parent2 ? parent2.relation : 'etc';

    // Build teacher list selections
    const teacherOptionsHtml = teachers
        .filter(t => t.employmentStatus !== 'resigned' || (student && student.teacherId === t.id))
        .map(t => {
            const resignedSuffix = t.employmentStatus === 'resigned' ? ' (퇴사)' : '';
            return `
                <option value="${t.id}" ${student && student.teacherId === t.id ? 'selected' : ''}>
                    ${t.name}${resignedSuffix} (${t.instrument})
                </option>
            `;
        }).join('');

    // Dynamic subjects selection (filter active or matches student's current instrument)
    const subjects = stateStore.getSubjects();
    const studentInstrument = student ? student.instrument : '';
    const filteredSubjects = subjects.filter(sub => {
        if (sub.isActive) return true;
        if (isEdit && sub.name === studentInstrument) return true;
        return false;
    });
    const isInstrumentInList = filteredSubjects.some(sub => sub.name === studentInstrument);
    if (isEdit && studentInstrument && !isInstrumentInList) {
        filteredSubjects.push({ id: 'temp-subject', name: studentInstrument, isActive: true });
    }
    const subjectOptionsHtml = filteredSubjects.map(sub => `
        <option value="${sub.name}" ${student && student.instrument === sub.name ? 'selected' : ''}>
            ${sub.name}
        </option>
    `).join('');

    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title">${isEdit ? '원생 정보 수정' : '신규 원생 등록'}</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <form id="student-modal-form" style="display: flex; flex-direction: column; height: 100%;">
            <div class="modal-form-scroll-body" style="flex-grow: 1; overflow-y: auto; padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Section 1: 기본 인적 사항 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">1. 기본 인적 사항</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-name">원생 이름 <span style="color: var(--danger);">*</span></label>
                            <input type="text" id="modal-student-name" class="form-control" value="${student ? student.name : ''}" required placeholder="예: 홍길동">
                        </div>
                        <div class="form-group">
                            <label for="modal-student-birthdate">생년월일</label>
                            <input type="date" id="modal-student-birthdate" class="form-control" value="${student ? student.birthDate || '' : ''}">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-school">학교/유치원(소속)</label>
                            <input type="text" id="modal-student-school" class="form-control" value="${student && student.school ? student.school : ''}" placeholder="예: 하모초등학교">
                        </div>
                        <div class="form-group">
                            <label for="modal-student-grade-class">학년/반</label>
                            <input type="text" id="modal-student-grade-class" class="form-control" value="${student && student.gradeClass ? student.gradeClass : ''}" placeholder="예: 3학년 2반, 햇살반">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-adult">성인/비성인 구분</label>
                            <select id="modal-student-adult" class="form-control">
                                <option value="" ${(!student || student.isAdult === null || student.isAdult === undefined || student.isAdult === '') ? 'selected' : ''}>선택하세요</option>
                                <option value="adult" ${(student && (student.isAdult === 'adult' || student.isAdult === true)) ? 'selected' : ''}>성인</option>
                                <option value="minor" ${(student && (student.isAdult === 'minor' || student.isAdult === false)) ? 'selected' : ''}>비성인</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-age">나이</label>
                            <input type="number" id="modal-student-age" class="form-control" value="${student && student.age !== undefined && student.age !== null ? student.age : ''}" placeholder="예: 10" min="1" max="100">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-phone">본인 연락처</label>
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <input type="tel" id="modal-student-phone" class="form-control" style="flex-grow: 1; margin-bottom: 0;" placeholder="010-0000-0000">
                                <select id="modal-student-phone-status" class="form-control" style="width: 100px; margin-bottom: 0; flex-shrink: 0;">
                                    <option value="direct">직접입력</option>
                                    <option value="none">없음</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; display: block;">주소 <span style="color: var(--danger);">*</span></label>
                            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <input type="text" id="modal-student-postcode" class="form-control" style="flex-grow: 1; margin-bottom: 0;" placeholder="우편번호" readonly value="${stPostcode}">
                                <button type="button" id="btn-modal-student-address-search" class="btn btn-secondary" style="padding: 0 12px; font-size: 0.85rem; margin-bottom: 0; flex-shrink: 0; justify-content: center;">주소 검색</button>
                            </div>
                            <input type="text" id="modal-student-address-basic" class="form-control" style="margin-bottom: 8px;" placeholder="기본 주소지" readonly value="${stBasicAddress}">
                            <input type="text" id="modal-student-address-detail" class="form-control" placeholder="상세주소 입력" value="${stDetailAddress}">
                        </div>
                    </div>

                    <!-- 보호자 연락처 영역 -->
                    <div style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <div style="font-weight: 700; font-size: 0.9rem; color: var(--primary); margin-bottom: 1rem;">보호자 정보</div>
                        
                        <!-- 보호자 1 (대표) -->
                        <div style="background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
                            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-color); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                                <span>보호자 1 (대표)</span>
                                <span style="font-size: 0.75rem; color: var(--primary); font-weight: normal;">* 필수 수신처 지정 가능</span>
                            </div>
                            <div class="form-row" style="margin-bottom: 8px;">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="modal-student-parent-name" style="font-size: 0.8rem; margin-bottom: 2px;">성함</label>
                                    <input type="text" id="modal-student-parent-name" class="form-control" style="margin-bottom: 0; font-size: 0.85rem; height: 32px;" value="${p1Name}" placeholder="예: 김철수">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="modal-student-parent-relation" style="font-size: 0.8rem; margin-bottom: 2px;">관계</label>
                                    <select id="modal-student-parent-relation" class="form-control" style="margin-bottom: 0; font-size: 0.85rem; height: 32px; padding: 4px 8px;">
                                        <option value="mother" ${p1Relation === 'mother' ? 'selected' : ''}>모</option>
                                        <option value="father" ${p1Relation === 'father' ? 'selected' : ''}>부</option>
                                        <option value="grandmother" ${p1Relation === 'grandmother' ? 'selected' : ''}>조모</option>
                                        <option value="grandfather" ${p1Relation === 'grandfather' ? 'selected' : ''}>조부</option>
                                        <option value="guardian" ${p1Relation === 'guardian' ? 'selected' : ''}>보호자</option>
                                        <option value="etc" ${p1Relation === 'etc' ? 'selected' : ''}>기타</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom: 0; margin-top: 8px;">
                                <label for="modal-student-parent-phone" style="font-size: 0.8rem; margin-bottom: 2px;">연락처</label>
                                <div style="display: flex; gap: 8px; width: 100%;">
                                    <input type="tel" id="modal-student-parent-phone" class="form-control" style="flex-grow: 1; margin-bottom: 0; font-size: 0.85rem; height: 32px;" placeholder="010-0000-0000">
                                    <select id="modal-student-parent-phone-status" class="form-control" style="width: 100px; margin-bottom: 0; flex-shrink: 0; font-size: 0.85rem; height: 32px; padding: 4px 8px;">
                                        <option value="direct">직접입력</option>
                                        <option value="none">없음</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- 보호자 2 (선택) -->
                        <div style="background: rgba(0, 0, 0, 0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 0;">
                            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-color); margin-bottom: 8px;">보호자 2 (선택)</div>
                            <div class="form-row" style="margin-bottom: 8px;">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="modal-student-parent2-name" style="font-size: 0.8rem; margin-bottom: 2px;">성함</label>
                                    <input type="text" id="modal-student-parent2-name" class="form-control" style="margin-bottom: 0; font-size: 0.85rem; height: 32px;" value="${p2Name}" placeholder="예: 이영희">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label for="modal-student-parent2-relation" style="font-size: 0.8rem; margin-bottom: 2px;">관계</label>
                                    <select id="modal-student-parent2-relation" class="form-control" style="margin-bottom: 0; font-size: 0.85rem; height: 32px; padding: 4px 8px;">
                                        <option value="mother" ${p2Relation === 'mother' ? 'selected' : ''}>모</option>
                                        <option value="father" ${p2Relation === 'father' ? 'selected' : ''}>부</option>
                                        <option value="grandmother" ${p2Relation === 'grandmother' ? 'selected' : ''}>조모</option>
                                        <option value="grandfather" ${p2Relation === 'grandfather' ? 'selected' : ''}>조부</option>
                                        <option value="guardian" ${p2Relation === 'guardian' ? 'selected' : ''}>보호자</option>
                                        <option value="etc" ${p2Relation === 'etc' ? 'selected' : ''}>기타</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom: 0; margin-top: 8px;">
                                <label for="modal-student-parent2-phone" style="font-size: 0.8rem; margin-bottom: 2px;">연락처</label>
                                <div style="display: flex; gap: 8px; width: 100%;">
                                    <input type="tel" id="modal-student-parent2-phone" class="form-control" style="flex-grow: 1; margin-bottom: 0; font-size: 0.85rem; height: 32px;" placeholder="010-0000-0000">
                                    <select id="modal-student-parent2-phone-status" class="form-control" style="width: 100px; margin-bottom: 0; flex-shrink: 0; font-size: 0.85rem; height: 32px; padding: 4px 8px;">
                                        <option value="direct">직접입력</option>
                                        <option value="none">없음</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 2: 음악학습경험 및 희망악기 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">2. 음악학습경험 및 희망악기</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-experience-type">학습 경험</label>
                            <select id="modal-student-experience-type" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="처음">처음</option>
                                <option value="바이엘">바이엘</option>
                                <option value="체100">체100</option>
                                <option value="체30">체30</option>
                                <option value="체40">체40</option>
                                <option value="체50">체50</option>
                                <option value="custom">직접입력</option>
                            </select>
                            <input type="text" id="modal-student-experience-type-custom" class="form-control" style="margin-top: 8px; display: none;" placeholder="경험 직접 입력 (예: 체르니 40 단계)">
                        </div>
                        <div class="form-group">
                            <label for="modal-student-experience-period">학습 기간</label>
                            <input type="text" id="modal-student-experience-period" class="form-control" value="${student ? student.experiencePeriod || '' : ''}" placeholder="예: 6개월, 1년">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-instrument">수강 악기/과목 <span style="color: var(--danger);">*</span></label>
                            <select id="modal-student-instrument" class="form-control" required>
                                <option value="" disabled ${!student ? 'selected' : ''}>과목을 선택하세요</option>
                                ${subjectOptionsHtml}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-has-instrument">소장 악기 유무</label>
                            <select id="modal-student-has-instrument" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="없음">없음</option>
                                <option value="구매예정">구매예정</option>
                                <option value="디지털피아노">디지털피아노</option>
                                <option value="어쿠스틱피아노">어쿠스틱피아노</option>
                                <option value="바이올린">바이올린</option>
                                <option value="custom">직접입력</option>
                            </select>
                            <input type="text" id="modal-student-has-instrument-custom" class="form-control" style="margin-top: 8px; display: none;" placeholder="소장 악기 직접 입력">
                        </div>
                    </div>
                </div>

                <!-- Section 3: 수강목적 및 원하는 레슨 방식 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">3. 수강목적 및 원하는 레슨 방식</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-purpose">수강 목적</label>
                            <select id="modal-student-purpose" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="정서발달 및 취미" ${student && student.purpose === '정서발달 및 취미' ? 'selected' : ''}>정서발달 및 취미</option>
                                <option value="자격증 및 콩쿨" ${student && student.purpose === '자격증 및 콩쿨' ? 'selected' : ''}>자격증 및 콩쿨</option>
                                <option value="전공준비" ${student && student.purpose === '전공준비' ? 'selected' : ''}>전공준비</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-lesson-style">원하는 레슨 방식</label>
                            <select id="modal-student-lesson-style" class="form-control">
                                <option value="">선택하세요</option>
                                <option value="진도가 늦더라도 꼼꼼하게" ${student && student.lessonStyle === '진도가 늦더라도 꼼꼼하게' ? 'selected' : ''}>진도가 늦더라도 꼼꼼하게</option>
                                <option value="이론공부에 중점" ${student && student.lessonStyle === '이론공부에 중점' ? 'selected' : ''}>이론공부에 중점</option>
                                <option value="진도향상 위주로" ${student && student.lessonStyle === '진도향상 위주로' ? 'selected' : ''}>진도향상 위주로</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Section 4: 학원 행정 및 수업 시간표 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">4. 학원 행정 및 수업 시간표</div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-teacher">배정 담당 강사 <span style="color: var(--danger);">*</span></label>
                            <select id="modal-student-teacher" class="form-control" required>
                                <option value="" disabled ${!student ? 'selected' : ''}>학원 강사를 선택하세요</option>
                                ${teacherOptionsHtml}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="modal-student-due-day">정기 청구 희망일 <span style="color: var(--danger);">*</span></label>
                            <input type="number" id="modal-student-due-day" class="form-control" value="${student ? student.dueDay : '10'}" required min="1" max="31" placeholder="예: 10">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-default-class-duration">기본 수업시간 <span style="color: var(--danger);">*</span></label>
                            <select id="modal-student-default-class-duration" class="form-control" required>
                                ${durationOptionsHtml}
                            </select>
                        </div>
                        <div class="form-group"></div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modal-student-fee">수강료 (원) <span style="color: var(--danger);">*</span></label>
                            <div class="fee-input-wrapper">
                                <input type="number" id="modal-student-fee" class="form-control" value="${student ? student.fee : '150000'}" required min="0" step="5000" placeholder="예: 150000">
                                <button type="button" class="fee-dropdown-toggle" id="btn-fee-dropdown">
                                    <i class="fa-solid fa-chevron-down"></i>
                                </button>
                                <div class="fee-dropdown-menu" id="fee-dropdown-menu"></div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>수납현황</label>
                            <div class="custom-check-group">
                                <label class="custom-check-card">
                                    <input type="radio" name="modal-student-payment-status" value="unpaid" ${!student || student.paymentStatus !== 'paid' ? 'checked' : ''} required>
                                    <div class="custom-check-card-body">
                                        <i class="fa-solid fa-circle-check"></i> 미납
                                    </div>
                                </label>
                                <label class="custom-check-card">
                                    <input type="radio" name="modal-student-payment-status" value="paid" ${student && student.paymentStatus === 'paid' ? 'checked' : ''} required>
                                    <div class="custom-check-card-body">
                                        <i class="fa-solid fa-circle-check"></i> 완납
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 수업일정 동적 추가 필드 -->
                    <div class="form-group" style="margin-top: 1rem; border-top: 1px dashed var(--border-color); padding-top: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <label style="margin-bottom: 0; font-weight: 600; color: var(--text-muted);">수업 일정 시간표 <span style="color: var(--text-muted); font-size: 0.75rem;">(복수 요일 입력 가능)</span></label>
                            <button type="button" class="btn btn-secondary" id="btn-add-schedule-row" style="padding: 4px 8px; font-size: 0.8rem; border-radius: var(--radius-sm);">
                                <i class="fa-solid fa-plus"></i> 요일 추가
                            </button>
                        </div>
                        <div id="modal-schedule-rows-container" style="display: flex; flex-direction: column; gap: 8px;">
                            <!-- Time rows generated dynamically here -->
                        </div>
                    </div>
                </div>

                <!-- Section 5: 레슨 상담 및 특이사항 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">5. 레슨 상담 및 특이사항</div>
                    
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="modal-student-consultation-notes">레슨 상담 및 특이사항</label>
                        <textarea id="modal-student-consultation-notes" class="form-control" rows="4" placeholder="예: 집중력이 다소 부족하나 피아노를 매우 좋아함. 레슨 시 진도가 다소 늦더라도 기초 이론을 꼼꼼히 짚고 넘어갈 것을 희망함.">${student ? student.consultationNotes || '' : ''}</textarea>
                    </div>
                </div>

                <!-- Section 6: 시간표 등 일정 특이사항 -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; background: rgba(0, 0, 0, 0.01);">
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--primary); margin: 0 0 1.2rem 0; border-left: 3px solid var(--primary); padding-left: 8px;">6. 시간표 등 일정 특이사항</div>
                    
                    <div class="form-group" style="margin-bottom: 0;">
                        <label for="modal-student-schedule-notes">시간표 등 일정 특이사항</label>
                        <textarea id="modal-student-schedule-notes" class="form-control" rows="3" placeholder="예: 매월 둘째 주 화요일은 17시 등원 예정, 목요일은 1시간 조기 등원 등 시간표 일정에 대한 특이사항 입력">${student ? student.scheduleNotes || '' : ''}</textarea>
                    </div>
                </div>

            </div>

            <div class="modal-footer" style="padding: 1rem 2rem 1.5rem 2rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 8px; background: rgba(0, 0, 0, 0.01);">
                <button type="button" class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" id="btn-student-submit" class="btn btn-primary">${isEdit ? '수정 저장' : '신규 등록'}</button>
            </div>
        </form>
    `;

    const onInitModal = (contentArea) => {
        // Fix layout of modal content area (locks header/footer and scrolls central area)
        contentArea.classList.add('layout-fixed');

        const container = contentArea.querySelector('#modal-schedule-rows-container');
        const btnAddRow = contentArea.querySelector('#btn-add-schedule-row');

        // Render a single schedule row selection
        const addScheduleRow = (dayOfWeek = '월', time = '15:00') => {
            const [hStr, mStr] = (time || '15:00').split(':');
            const currentHour = String(parseInt(hStr) || 0).padStart(2, '0');
            const currentMinute = String(parseInt(mStr) || 0).padStart(2, '0');

            const row = document.createElement('div');
            row.className = 'modal-schedule-row';
            
            // Generate hour options
            let hourOpts = '';
            for (let h = 0; h <= 23; h++) {
                const val = String(h).padStart(2, '0');
                hourOpts += `<option value="${val}" ${val === currentHour ? 'selected' : ''}>${val}시</option>`;
            }
            
            // Generate minute options
            let minuteOpts = '';
            for (let m = 0; m <= 59; m++) {
                const val = String(m).padStart(2, '0');
                minuteOpts += `<option value="${val}" ${val === currentMinute ? 'selected' : ''}>${val}분</option>`;
            }

            const hourVal = parseInt(currentHour);
            const amPmText = (hourVal >= 0 && hourVal <= 11) ? '오전' : '오후';

            row.innerHTML = `
                <select class="form-control schedule-day" required style="margin-bottom:0; width: 100px;">
                    ${['월', '화', '수', '목', '금', '토', '일'].map(d => `<option value="${d}" ${d === dayOfWeek ? 'selected' : ''}>${d}요일</option>`).join('')}
                </select>
                
                <div class="schedule-time-container" style="display: flex; align-items: center; gap: 6px; width: 100%;">
                    <span class="ampm-indicator" style="font-size: 0.82rem; font-weight: 700; color: var(--primary); min-width: 32px; text-align: center;">${amPmText}</span>
                    <select class="form-control schedule-hour" required style="margin-bottom:0; flex-grow: 1; min-width: 55px; font-size: 0.82rem;">
                        ${hourOpts}
                    </select>
                    <span style="font-weight: 700; color: var(--text-muted);">:</span>
                    <select class="form-control schedule-minute" required style="margin-bottom:0; flex-grow: 1; min-width: 55px; font-size: 0.82rem;">
                        ${minuteOpts}
                    </select>
                </div>

                <button type="button" class="btn btn-danger btn-icon-only remove-schedule-row-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;

            const hourSelect = row.querySelector('.schedule-hour');
            const ampmIndicator = row.querySelector('.ampm-indicator');
            
            hourSelect.addEventListener('change', () => {
                const h = parseInt(hourSelect.value) || 0;
                ampmIndicator.textContent = (h >= 0 && h <= 11) ? '오전' : '오후';
            });

            row.querySelector('.remove-schedule-row-btn').addEventListener('click', () => {
                row.remove();
            });

            container.appendChild(row);
        };

        // Pre-populate schedules
        if (studentClasses.length > 0) {
            studentClasses.forEach(c => addScheduleRow(c.dayOfWeek, c.time));
        } else {
            addScheduleRow('월', '15:00'); // Default row
        }

        btnAddRow.addEventListener('click', () => {
            addScheduleRow('월', '15:00');
        });

        // Tuition presets custom combo dropdown
        const feeInput = contentArea.querySelector('#modal-student-fee');
        const btnFeeDropdown = contentArea.querySelector('#btn-fee-dropdown');
        const feeDropdownMenu = contentArea.querySelector('#fee-dropdown-menu');

        let feeMenuHtml = '';
        for (let val = 5000; val <= 1000000; val += 5000) {
            feeMenuHtml += `<div class="fee-dropdown-item" data-value="${val}">${val.toLocaleString()}원</div>`;
        }
        feeDropdownMenu.innerHTML = feeMenuHtml;

        const toggleFeeMenu = (e) => {
            e.stopPropagation();
            feeDropdownMenu.classList.toggle('show');
        };

        btnFeeDropdown.addEventListener('click', toggleFeeMenu);
        feeInput.addEventListener('click', (e) => {
            e.stopPropagation();
            feeDropdownMenu.classList.add('show');
        });
        feeInput.addEventListener('focus', () => {
            feeDropdownMenu.classList.add('show');
        });

        document.addEventListener('click', (e) => {
            if (!feeDropdownMenu.contains(e.target) && e.target !== btnFeeDropdown && e.target !== feeInput) {
                feeDropdownMenu.classList.remove('show');
            }
        });

        feeDropdownMenu.querySelectorAll('.fee-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const val = e.currentTarget.dataset.value;
                feeInput.value = val;
                feeDropdownMenu.classList.remove('show');
                feeInput.dispatchEvent(new Event('input'));
                feeInput.dispatchEvent(new Event('change'));
            });
        });

        // Phone inputs logic
        const phoneInput = contentArea.querySelector('#modal-student-phone');
        const phoneStatus = contentArea.querySelector('#modal-student-phone-status');
        const parentPhoneInput = contentArea.querySelector('#modal-student-parent-phone');
        const parentPhoneStatus = contentArea.querySelector('#modal-student-parent-phone-status');
        const parent2PhoneInput = contentArea.querySelector('#modal-student-parent2-phone');
        const parent2PhoneStatus = contentArea.querySelector('#modal-student-parent2-phone-status');

        const phoneBinder = PhoneNumberInput.bind(phoneInput);
        const parentPhoneBinder = PhoneNumberInput.bind(parentPhoneInput);
        const parent2PhoneBinder = PhoneNumberInput.bind(parent2PhoneInput);

        const addressBinder = AddressInput.bind({
            postcodeEl: contentArea.querySelector('#modal-student-postcode'),
            addressEl: contentArea.querySelector('#modal-student-address-basic'),
            detailAddressEl: contentArea.querySelector('#modal-student-address-detail'),
            searchBtnEl: contentArea.querySelector('#btn-modal-student-address-search')
        });

        const updatePhoneUI = (input, statusSelect, binder) => {
            if (statusSelect.value === 'none') {
                input.value = '';
                input.disabled = false;
                if (binder) binder.validate();
            } else {
                input.disabled = false;
                if (binder) binder.validate();
            }
        };

        phoneStatus.addEventListener('change', () => updatePhoneUI(phoneInput, phoneStatus, phoneBinder));
        parentPhoneStatus.addEventListener('change', () => updatePhoneUI(parentPhoneInput, parentPhoneStatus, parentPhoneBinder));
        parent2PhoneStatus.addEventListener('change', () => updatePhoneUI(parent2PhoneInput, parent2PhoneStatus, parent2PhoneBinder));

        // Auto-switch status to 'direct' when digits are typed in 'none' state
        const setupPhoneAutoSwitch = (input, statusSelect, binder) => {
            input.addEventListener('input', (e) => {
                if (statusSelect.value === 'none' && input.value.trim() !== '') {
                    if (/\d/.test(input.value)) {
                        statusSelect.value = 'direct';
                        if (binder) binder.validate();
                    }
                }
            });
        };

        setupPhoneAutoSwitch(phoneInput, phoneStatus, phoneBinder);
        setupPhoneAutoSwitch(parentPhoneInput, parentPhoneStatus, parentPhoneBinder);
        setupPhoneAutoSwitch(parent2PhoneInput, parent2PhoneStatus, parent2PhoneBinder);

        const destroyAllBinders = () => {
            phoneBinder.destroy();
            parentPhoneBinder.destroy();
            parent2PhoneBinder.destroy();
            addressBinder.destroy();
        };

        contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
            el.addEventListener('click', destroyAllBinders);
        });

        // Pre-fill phone fields
        if (student) {
            const isPhoneEmpty = !student.phone || student.phone === '없음';
            const isParentPhoneEmpty = !p1Phone || p1Phone === '없음';
            const isParent2PhoneEmpty = !p2Phone || p2Phone === '없음';

            if (isPhoneEmpty) {
                phoneStatus.value = 'none';
                updatePhoneUI(phoneInput, phoneStatus, phoneBinder);
            } else {
                phoneStatus.value = 'direct';
                phoneInput.value = student.phone;
                phoneInput.disabled = false;
                if (phoneBinder) phoneBinder.validate();
            }

            if (isParentPhoneEmpty) {
                parentPhoneStatus.value = 'none';
                updatePhoneUI(parentPhoneInput, parentPhoneStatus, parentPhoneBinder);
            } else {
                parentPhoneStatus.value = 'direct';
                parentPhoneInput.value = p1Phone;
                parentPhoneInput.disabled = false;
                if (parentPhoneBinder) parentPhoneBinder.validate();
            }

            if (isParent2PhoneEmpty) {
                parent2PhoneStatus.value = 'none';
                updatePhoneUI(parent2PhoneInput, parent2PhoneStatus, parent2PhoneBinder);
            } else {
                parent2PhoneStatus.value = 'direct';
                parent2PhoneInput.value = p2Phone;
                parent2PhoneInput.disabled = false;
                if (parent2PhoneBinder) parent2PhoneBinder.validate();
            }
        } else {
            phoneStatus.value = 'direct';
            parentPhoneStatus.value = 'direct';
            parent2PhoneStatus.value = 'none';
            phoneInput.disabled = false;
            parentPhoneInput.disabled = false;
            parent2PhoneInput.disabled = false;
            if (phoneBinder) phoneBinder.validate();
            if (parentPhoneBinder) parentPhoneBinder.validate();
            if (parent2PhoneBinder) parent2PhoneBinder.validate();
        }

        // Custom selects logic for learning experience & instrument ownership
        const expSelect = contentArea.querySelector('#modal-student-experience-type');
        const expCustom = contentArea.querySelector('#modal-student-experience-type-custom');
        const instSelect = contentArea.querySelector('#modal-student-has-instrument');
        const instCustom = contentArea.querySelector('#modal-student-has-instrument-custom');

        const handleCustomSelect = (selectEl, customEl) => {
            if (selectEl.value === 'custom') {
                customEl.style.display = 'block';
            } else {
                customEl.style.display = 'none';
                customEl.value = '';
            }
        };

        expSelect.addEventListener('change', () => handleCustomSelect(expSelect, expCustom));
        instSelect.addEventListener('change', () => handleCustomSelect(instSelect, instCustom));

        if (student) {
            const expVal = student.experienceType || '';
            const predefinedExp = ['처음', '바이엘', '체100', '체30', '체40', '체50', ''];
            if (predefinedExp.includes(expVal)) {
                expSelect.value = expVal;
                expCustom.style.display = 'none';
            } else {
                expSelect.value = 'custom';
                expCustom.value = expVal;
                expCustom.style.display = 'block';
            }

            const hasInstVal = student.hasInstrument || '';
            const predefinedInst = ['없음', '구매예정', '디지털피아노', '어쿠스틱피아노', '바이올린', ''];
            if (predefinedInst.includes(hasInstVal)) {
                instSelect.value = hasInstVal;
                instCustom.style.display = 'none';
            } else {
                instSelect.value = 'custom';
                instCustom.value = hasInstVal;
                instCustom.style.display = 'block';
            }
        }

        // Enable real-time validation reset style when inputs are edited
        const resetErrorStyle = (el) => {
            if (!el) return;
            el.addEventListener('input', () => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
            el.addEventListener('change', () => {
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
        };


        const requiredInputs = [
            contentArea.querySelector('#modal-student-name'),
            contentArea.querySelector('#modal-student-teacher'),
            contentArea.querySelector('#modal-student-due-day'),
            contentArea.querySelector('#modal-student-fee'),
            contentArea.querySelector('#modal-student-instrument'),
            contentArea.querySelector('#modal-student-default-class-duration'),
            phoneInput,
            parentPhoneInput
        ];
        requiredInputs.forEach(el => {
            if (el) resetErrorStyle(el);
        });

        // Form Submit Handler
        const form = contentArea.querySelector('#student-modal-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            let leaveStartDate = null;
            let leaveEndDate = null;
            let withdrawalDate = null;

            const nameEl = contentArea.querySelector('#modal-student-name');
            const birthdateEl = contentArea.querySelector('#modal-student-birthdate');
            const schoolEl = contentArea.querySelector('#modal-student-school');
            const gradeClassEl = contentArea.querySelector('#modal-student-grade-class');
            const ageEl = contentArea.querySelector('#modal-student-age');
            const parentNameEl = contentArea.querySelector('#modal-student-parent-name');
            
            const postcodeEl = contentArea.querySelector('#modal-student-postcode');
            const addressBasicEl = contentArea.querySelector('#modal-student-address-basic');
            const addressDetailEl = contentArea.querySelector('#modal-student-address-detail');

            const teacherEl = contentArea.querySelector('#modal-student-teacher');
            const dueDayEl = contentArea.querySelector('#modal-student-due-day');
            const feeEl = contentArea.querySelector('#modal-student-fee');
            const instrumentEl = contentArea.querySelector('#modal-student-instrument');
            const notesEl = contentArea.querySelector('#modal-student-consultation-notes');
            const scheduleNotesEl = contentArea.querySelector('#modal-student-schedule-notes');
            const expPeriodEl = contentArea.querySelector('#modal-student-experience-period');

            // Reset borders before check
            requiredInputs.forEach(el => {
                if (el) {
                    el.style.borderColor = '';
                    el.style.boxShadow = '';
                }
            });

            let validationPassed = true;

            if (!nameEl.value.trim()) {
                nameEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!teacherEl.value) {
                teacherEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!dueDayEl.value.trim() || parseInt(dueDayEl.value) < 1 || parseInt(dueDayEl.value) > 31) {
                dueDayEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!feeEl.value.trim() || parseInt(feeEl.value) < 0) {
                feeEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }
            if (!instrumentEl.value) {
                instrumentEl.style.borderColor = 'var(--danger)';
                validationPassed = false;
            }

            // Contact Multi-validation
            const isPhoneNone = phoneStatus.value === 'none';
            const isParentPhoneNone = parentPhoneStatus.value === 'none';
            const isParent2PhoneNone = parent2PhoneStatus.value === 'none';
            const phoneVal = phoneInput.value.trim();
            const parentPhoneVal = parentPhoneInput.value.trim();
            const parent2PhoneVal = parent2PhoneInput.value.trim();

            const hasPhoneInput = !isPhoneNone && phoneVal !== '';
            const hasParentPhoneInput = !isParentPhoneNone && parentPhoneVal !== '';
            const hasParent2PhoneInput = !isParent2PhoneNone && parent2PhoneVal !== '';

            // Check if both are empty/None
            if (!hasPhoneInput && !hasParentPhoneInput) {
                alert('연락 가능한 번호 하나를 꼭 입력해 주세요.');
                validationPassed = false;
            } else {
                if (hasPhoneInput && !phoneBinder.isValid()) {
                    validationPassed = false;
                }
                if (hasParentPhoneInput && !parentPhoneBinder.isValid()) {
                    validationPassed = false;
                }
                if (hasParent2PhoneInput && !parent2PhoneBinder.isValid()) {
                    validationPassed = false;
                }
            }

            // Address Validation
            const addressValid = addressBinder.isValid();
            if (!addressValid) {
                alert('주소 검색을 통해 기본 주소와 상세주소를 모두 입력해 주세요.');
                validationPassed = false;
            }

            // Preserve status and date fields from the existing student record
            const status = student ? student.status : 'attending';
            leaveStartDate = student ? student.leaveStartDate : null;
            leaveEndDate = student ? student.leaveEndDate : null;
            withdrawalDate = student ? student.withdrawalDate : null;

            if (!validationPassed) {
                return;
            }

            // Gather inputs
            const name = nameEl.value.trim();
            const birthDate = birthdateEl.value;
            const school = schoolEl.value.trim();
            const gradeClass = gradeClassEl.value.trim();
            const ageVal = ageEl.value.trim();
            const age = ageVal ? parseInt(ageVal) : null;
            
            // For None value, save as null or empty string (using null as per design)
            const phone = isPhoneNone ? null : phoneVal;
            const parentName = parentNameEl.value.trim();
            const parentPhone = isParentPhoneNone ? null : parentPhoneVal;
            const parent1Relation = contentArea.querySelector('#modal-student-parent-relation').value;

            const parent2Name = contentArea.querySelector('#modal-student-parent2-name').value.trim();
            const parent2Relation = contentArea.querySelector('#modal-student-parent2-relation').value;
            const parent2Phone = isParent2PhoneNone ? null : parent2PhoneVal;
            
            const postcode = postcodeEl.value.trim();
            const address = addressBasicEl.value.trim();
            const detailAddress = addressDetailEl.value.trim();

            const teacherId = teacherEl.value;
            const dueDay = parseInt(dueDayEl.value) || 10;
            const fee = parseInt(feeEl.value) || 0;
            const instrument = instrumentEl.value;
            const experiencePeriod = expPeriodEl.value.trim();
            const consultationNotes = notesEl.value.trim();
            const scheduleNotes = scheduleNotesEl.value.trim();
            const durationEl = contentArea.querySelector('#modal-student-default-class-duration');
            const defaultClassDuration = parseInt(durationEl.value) || 50;

            const adultSelect = contentArea.querySelector('#modal-student-adult');
            const isAdult = (adultSelect.value === 'adult') ? 'adult' : ((adultSelect.value === 'minor') ? 'minor' : null);

            const checkedPaymentStatusEl = contentArea.querySelector('input[name="modal-student-payment-status"]:checked');
            const paymentStatus = checkedPaymentStatusEl ? checkedPaymentStatusEl.value : 'unpaid';

            const experienceType = expSelect.value === 'custom' ? expCustom.value.trim() : expSelect.value;
            const hasInstrument = instSelect.value === 'custom' ? instCustom.value.trim() : instSelect.value;
            const purpose = contentArea.querySelector('#modal-student-purpose').value;
            const lessonStyle = contentArea.querySelector('#modal-student-lesson-style').value;

            // Extract schedules from dynamic rows
            const scheduleRows = container.querySelectorAll('.modal-schedule-row');
            const classSchedules = Array.from(scheduleRows).map(row => {
                const dayOfWeek = row.querySelector('.schedule-day').value;
                const hour = row.querySelector('.schedule-hour').value;
                const minute = row.querySelector('.schedule-minute').value;
                const time = `${hour}:${minute}`;
                return { dayOfWeek, time };
            });

            let savedStudentId = studentId;

            if (isEdit) {
                stateStore.updateStudent(studentId, {
                    name,
                    status,
                    instrument,
                    phone,
                    parentName,
                    parentPhone,
                    fee,
                    dueDay,
                    teacherId,
                    age,
                    school,
                    isAdult,
                    birthDate,
                    gradeClass,
                    postcode,
                    address,
                    detailAddress,
                    experienceType,
                    experiencePeriod,
                    hasInstrument,
                    purpose,
                    lessonStyle,
                    consultationNotes,
                    scheduleNotes,
                    paymentStatus,
                    defaultClassDuration,
                    leaveStartDate,
                    leaveEndDate,
                    withdrawalDate
                }, classSchedules);
            } else {
                const enrollDate = new Date().toISOString().slice(0, 10);
                const newStudent = stateStore.addStudent({
                    name,
                    status,
                    instrument,
                    phone,
                    parentName,
                    parentPhone,
                    fee,
                    dueDay,
                    teacherId,
                    enrollDate,
                    age,
                    school,
                    isAdult,
                    birthDate,
                    gradeClass,
                    postcode,
                    address,
                    detailAddress,
                    experienceType,
                    experiencePeriod,
                    hasInstrument,
                    purpose,
                    lessonStyle,
                    consultationNotes,
                    scheduleNotes,
                    paymentStatus,
                    defaultClassDuration,
                    leaveStartDate,
                    leaveEndDate,
                    withdrawalDate
                }, classSchedules);
                savedStudentId = newStudent.id;
            }

            // Save Parent 1 contact details
            stateStore.upsertParentContact({
                studentId: savedStudentId,
                slot: 'parent1',
                name: parentName,
                relation: parent1Relation,
                phone: parentPhone || ''
            });

            // Save Parent 2 contact details
            if (!parent2Name && !parent2Phone) {
                stateStore.clearParentContact(savedStudentId, 'parent2');
            } else {
                stateStore.upsertParentContact({
                    studentId: savedStudentId,
                    slot: 'parent2',
                    name: parent2Name,
                    relation: parent2Relation,
                    phone: parent2Phone || ''
                });
            }

            destroyAllBinders();
            closeModal();
        });
    };

    openModal(modalHtml, onInitModal);
}

// ----------------------------------------------------
// 신규 원생 대량 등록을 위한 엑셀 업로드 모달 및 데이터 처리
// ----------------------------------------------------
const openExcelUploadModal = () => {
    const modalHtml = `
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-file-excel" style="color: var(--primary); margin-right: 8px;"></i>신규 원생 엑셀 업로드</h3>
            <button class="modal-close" data-close-modal>&times;</button>
        </div>
        <div class="modal-form-scroll-body" style="padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto; display: flex; flex-direction: column; gap: 1.2rem;">
            
            <!-- Template download section -->
            <div style="background: rgba(9, 132, 227, 0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                <div style="font-size: 0.82rem; color: var(--text-main); max-width: 480px;">
                    <strong>신규 원생 등록용 엑셀 서식</strong>을 다운로드하여 양식에 맞춰 작성하신 후 업로드해 주세요.
                </div>
                <button type="button" class="btn btn-secondary" id="btn-download-excel-template" style="font-size: 0.8rem; padding: 6px 12px; height: 32px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-download"></i> 양식 다운로드
                </button>
            </div>

            <!-- Upload drag-drop area -->
            <div class="excel-drag-drop-zone" id="excel-drop-zone">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <p>엑셀 또는 CSV 파일을 이 영역으로 드래그 앤 드롭 하거나 클릭하세요</p>
                <span>지원 파일 형식: .xlsx, .xls, .csv</span>
                <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;">
            </div>

            <!-- Guide Box -->
            <div style="background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                <p style="margin: 0 0 6px 0; font-weight: 700; color: var(--text-main);"><i class="fa-solid fa-circle-info" style="color: var(--primary); margin-right: 4px;"></i> 업로드 안내 및 유효성 기준</p>
                <ul style="margin: 0; padding-left: 16px;">
                    <li><strong>순번</strong>과 <strong>이름</strong>은 필수 입력값입니다. (이름이 없는 행은 오류로 처리되어 등록되지 않습니다.)</li>
                    <li>나머지 필드는 비어 있어도 <strong>정보 미완성</strong> 상태로 우선 등록되며, 원생 상세 정보 수정에서 보완할 수 있습니다.</li>
                    <li>생년월일은 <code>YYYY-MM-DD</code> 형식으로 기입해 주세요.</li>
                    <li>기존 원생과 이름 및 연락처(본인 또는 학부모)가 같은 경우 <strong>중복 의심</strong>으로 표시되지만 차단되지 않고 함께 등록됩니다. (연락처가 없는 경우는 중복으로 판단하지 않습니다.)</li>
                </ul>
            </div>

            <!-- Preview panel (Hidden initially) -->
            <div id="excel-preview-panel" style="display: none; flex-direction: column; gap: 8px;">
                <h4 style="margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--primary);" id="excel-preview-summary"></h4>
                <div class="excel-preview-wrapper">
                    <table class="excel-preview-table">
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">순번</th>
                                <th style="width: 100px; text-align: center;">상태</th>
                                <th style="width: 100px;">이름</th>
                                <th style="width: 110px;">본인 연락처</th>
                                <th style="width: 100px;">과목</th>
                                <th style="width: 90px;">담당 강사</th>
                                <th style="width: 80px;">수강료</th>
                                <th>메모 / 실패 사유</th>
                            </tr>
                        </thead>
                        <tbody id="excel-preview-tbody"></tbody>
                    </table>
                </div>
            </div>

        </div>
        <div class="modal-footer" style="padding: 1rem 2rem 1.5rem 2rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 8px; background: rgba(0, 0, 0, 0.01);">
            <button type="button" class="btn btn-secondary" data-close-modal>취소</button>
            <button type="button" class="btn btn-primary" id="btn-excel-submit" disabled>최종 등록 완료</button>
        </div>
    `;

    const onInitModal = (contentArea) => {
        contentArea.classList.add('layout-fixed');

        const btnDownload = contentArea.querySelector('#btn-download-excel-template');
        const dropZone = contentArea.querySelector('#excel-drop-zone');
        const fileInput = contentArea.querySelector('#excel-file-input');
        const previewPanel = contentArea.querySelector('#excel-preview-panel');
        const summaryText = contentArea.querySelector('#excel-preview-summary');
        const tbody = contentArea.querySelector('#excel-preview-tbody');
        const btnSubmit = contentArea.querySelector('#btn-excel-submit');

        let parsedStudents = []; // Stores valid students to import
        let parsedClasses = [];    // Stores corresponding class schedules

        // Template download trigger
        btnDownload.addEventListener('click', () => {
            const headers = [
                '순번', '이름', '생년월일', '학교/유치원(소속)', '학년/반', '성인구분', '나이', 
                '본인 연락처', '학부모 성함', '학부모 연락처', '주소', '수강 악기/과목', 
                '학습 경험', '학습 기간', '소장 악기 유무', '수강 목적', '원하는 레슨 방식', 
                '배정 담당 강사', '정기 청구 희망일', '수강료', '수업 요일', 
                '수업 시작 시간', '수업 종료 시간', '메모'
            ];
            const sampleData = [
                [
                    1, '홍길동', '2016-05-10', '하모초등학교', '3학년 2반', '비성인', 10,
                    '010-1234-5678', '김철수', '010-8765-4321', '서울시 마포구', '피아노',
                    '바이엘', '6개월', '디지털피아노', '정서발달 및 취미', '진도가 늦더라도 꼼꼼하게',
                    '정은비', 10, 150000, '월', '15:00', '16:00', '특이사항 메모'
                ],
                [
                    2, '김영희', '', '', '', '비성인', '',
                    '', '', '', '', '바이올린',
                    '', '', '', '', '',
                    '', '', '', '', '', '', '임시 등록 원생 (정보 미완성 예시)'
                ]
            ];

            if (window.XLSX) {
                const wb = XLSX.utils.book_new();
                const wsData = [headers, ...sampleData];
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                XLSX.utils.book_append_sheet(wb, ws, "원생등록양식");
                XLSX.writeFile(wb, "신규_원생_등록_양식.xlsx");
            } else {
                // Fallback to CSV (UTF-8 BOM)
                let csvContent = "\uFEFF";
                csvContent += headers.join(",") + "\n";
                sampleData.forEach(row => {
                    csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",") + "\n";
                });
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", "신규_원생_등록_양식.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });

        // Click to open file dialog
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag & Drop event bindings
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                processFile(files[0]);
            }
        });

        // Process selected file
        const processFile = (file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                try {
                    if (!window.XLSX) {
                        alert('XLSX 파싱 라이브러리가 로드되지 않았습니다. 인터넷 상태를 확인해 주세요.');
                        return;
                    }
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    
                    // Parse as array of arrays (AOA) to ensure strict column mapping by index
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    if (rows.length <= 1) {
                        alert('가공할 데이터 행이 없습니다.');
                        return;
                    }
                    
                    // Skip header row
                    const dataRows = rows.slice(1);
                    parseAndPreview(dataRows);
                } catch (err) {
                    console.error(err);
                    alert('파일 파싱 중 에러가 발생했습니다: ' + err.message);
                }
            };
            reader.readAsBinaryString(file);
        };

        // Parse rows and render preview
        const parseAndPreview = (dataRows) => {
            tbody.innerHTML = '';
            parsedStudents = [];
            parsedClasses = [];

            const existingStudents = stateStore.getStudents();
            const teachers = stateStore.getTeachers();

            let totalCount = 0;
            let successCount = 0;
            let errorCount = 0;
            let incompleteCount = 0;
            let duplicateCount = 0;

            let trsHtml = '';

            dataRows.forEach((row, idx) => {
                // Ignore completely empty rows
                if (row.length === 0 || row.every(val => val === null || val === undefined || String(val).trim() === '')) {
                    return;
                }

                totalCount++;

                const seq = row[0];
                const name = row[1] ? String(row[1]).trim() : '';
                const birthDateRaw = row[2] ? String(row[2]).trim() : '';
                const school = row[3] ? String(row[3]).trim() : '';
                const gradeClass = row[4] ? String(row[4]).trim() : '';
                const adultRaw = row[5] ? String(row[5]).trim() : '';
                const ageRaw = row[6] ? String(row[6]).trim() : '';
                const phoneRaw = row[7] ? String(row[7]).trim() : '';
                const parentName = row[8] ? String(row[8]).trim() : '';
                const parentPhoneRaw = row[9] ? String(row[9]).trim() : '';
                const address = row[10] ? String(row[10]).trim() : '';
                const instrumentRaw = row[11] ? String(row[11]).trim() : '';
                const expType = row[12] ? String(row[12]).trim() : '';
                const expPeriod = row[13] ? String(row[13]).trim() : '';
                const hasInst = row[14] ? String(row[14]).trim() : '';
                const purpose = row[15] ? String(row[15]).trim() : '';
                const lessonStyle = row[16] ? String(row[16]).trim() : '';
                const teacherName = row[17] ? String(row[17]).trim() : '';
                const dueDayRaw = row[18] ? String(row[18]).trim() : '';
                const feeRaw = row[19] ? String(row[19]).trim() : '';
                const scheduleDay = row[20] ? String(row[20]).trim() : '';
                const scheduleStart = row[21] ? String(row[21]).trim() : '';
                const scheduleEnd = row[22] ? String(row[22]).trim() : '';
                const memo = row[23] ? String(row[23]).trim() : '';

                let status = 'ready'; // 'ready', 'incomplete', 'error', 'duplicate'
                let errorMsg = '';

                // 1. Check required fields
                if (seq === undefined || seq === null || String(seq).trim() === '') {
                    status = 'error';
                    errorMsg = '순번이 비어 있습니다.';
                } else if (!name) {
                    status = 'error';
                    errorMsg = '이름이 비어 있습니다.';
                }

                // 2. Validate date format (if provided)
                let birthDate = '';
                if (status !== 'error' && birthDateRaw) {
                    // Try parsing date or Excel serial date
                    if (/^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw)) {
                        birthDate = birthDateRaw;
                    } else if (!isNaN(birthDateRaw)) {
                        // Excel serial date conversion
                        const serial = parseFloat(birthDateRaw);
                        const utc_days  = Math.floor(serial - 25569);
                        const utc_value = utc_days * 86400;
                        const date_info = new Date(utc_value * 1000);
                        const y = date_info.getUTCFullYear();
                        const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
                        const d = String(date_info.getUTCDate()).padStart(2, '0');
                        birthDate = `${y}-${m}-${d}`;
                    } else {
                        status = 'error';
                        errorMsg = '지원하지 않는 날짜 형식입니다. (YYYY-MM-DD)';
                    }
                }

                // Format phone numbers
                const phone = phoneRaw ? formatPhoneNumber(phoneRaw) : null;
                const parentPhone = parentPhoneRaw ? formatPhoneNumber(parentPhoneRaw) : null;

                // 3. Check duplicates (name + phone, name + parentPhone)
                if (status !== 'error') {
                    const isDup = existingStudents.some(es => {
                        const phoneMatch = phone && es.phone && es.phone !== '없음' && es.phone === phone;
                        const parentPhoneMatch = parentPhone && es.parentPhone && es.parentPhone !== '없음' && es.parentPhone === parentPhone;
                        return es.name === name && (phoneMatch || parentPhoneMatch);
                    });
                    if (isDup) {
                        status = 'duplicate';
                        duplicateCount++;
                    }
                }

                // Map teacher name to id
                let teacherId = '';
                if (teacherName) {
                    const foundTeacher = teachers.find(t => t.name === teacherName);
                    if (foundTeacher) {
                        teacherId = foundTeacher.id;
                    }
                }

                // Parse numeric fields
                const age = ageRaw ? parseInt(ageRaw) || null : null;
                const dueDay = dueDayRaw ? parseInt(dueDayRaw) || null : null;
                const fee = feeRaw ? parseInt(feeRaw) || 0 : 0;
                
                // Determine adult status
                const isAdult = adultRaw ? (adultRaw.includes('성인') && !adultRaw.includes('비성인')) : false;

                // Default instrument to 피아노 if empty
                const instrument = instrumentRaw || '피아노';

                // 4. Check incomplete (if not already error or duplicate)
                if (status !== 'error' && status !== 'duplicate') {
                    const contactMissing = !phone && !parentPhone;
                    const teacherMissing = !teacherId;
                    const dueDayMissing = dueDay === null || dueDay === undefined;
                    const feeMissing = feeRaw === null || feeRaw === undefined || feeRaw === '';

                    if (contactMissing || teacherMissing || dueDayMissing || feeMissing) {
                        status = 'incomplete';
                        incompleteCount++;
                    } else {
                        successCount++;
                    }
                }

                if (status === 'error') {
                    errorCount++;
                }

                // Add to list if not error
                if (status !== 'error') {
                    const tempStudent = {
                        name,
                        instrument,
                        phone,
                        parentName,
                        parentPhone,
                        fee,
                        dueDay,
                        teacherId,
                        age,
                        school,
                        isAdult,
                        birthDate,
                        gradeClass,
                        address,
                        experienceType: expType,
                        experiencePeriod: expPeriod,
                        hasInstrument: hasInst,
                        purpose,
                        lessonStyle,
                        consultationNotes: memo,
                        status: 'active'
                    };

                    const schedules = [];
                    if (scheduleDay && scheduleStart) {
                        // Format scheduleStart to HH:MM if it is a serial number or decimals
                        let time = scheduleStart;
                        if (!isNaN(scheduleStart) && parseFloat(scheduleStart) < 1) {
                            // Excel time decimals to HH:MM conversion
                            const totalMinutes = Math.round(parseFloat(scheduleStart) * 24 * 60);
                            const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
                            const m = String(totalMinutes % 60).padStart(2, '0');
                            time = `${h}:${m}`;
                        } else if (/^\d{1,2}:\d{2}$/.test(time)) {
                            // Normalize 9:30 to 09:30
                            const [h, m] = time.split(':');
                            time = `${h.padStart(2, '0')}:${m}`;
                        }
                        schedules.push({ dayOfWeek: scheduleDay, time });
                    }

                    parsedStudents.push({ rowIdx: idx, seq, studentData: tempStudent, schedules });
                }

                // Map status badges styling
                let badgeClass = 'status-badge ready';
                let badgeText = '등록 가능';
                if (status === 'incomplete') {
                    badgeClass = 'status-badge incomplete';
                    badgeText = '정보 미완성';
                } else if (status === 'error') {
                    badgeClass = 'status-badge error';
                    badgeText = '오류';
                } else if (status === 'duplicate') {
                    badgeClass = 'status-badge duplicate';
                    badgeText = '중복 의심';
                }

                trsHtml += `
                    <tr>
                        <td style="text-align: center;">${seq || idx + 1}</td>
                        <td style="text-align: center;"><span class="${badgeClass}">${badgeText}</span></td>
                        <td style="font-weight: 700; color: ${status === 'error' ? 'var(--danger)' : 'inherit'};">${name || '-'}</td>
                        <td>${phone || parentPhone || '-'}</td>
                        <td>${instrumentRaw || '-'}</td>
                        <td>${teacherName || '<span style="color:var(--danger)">없음</span>'}</td>
                        <td>${feeRaw ? parseInt(feeRaw).toLocaleString() + '원' : '0원'}</td>
                        <td style="font-size: 0.78rem; color: ${status === 'error' ? 'var(--danger)' : 'var(--text-muted)'};">
                            ${status === 'error' ? errorMsg : (status === 'duplicate' ? '동일 연락처의 원생이 이미 존재합니다.' : memo || '-')}
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = trsHtml;
            summaryText.innerHTML = `총 <strong style="color:var(--primary);">${totalCount}</strong>건 중 등록 가능 <strong style="color:var(--success);">${successCount}</strong>건, 정보 미완성 <strong style="color:var(--warning);">${incompleteCount}</strong>건, 중복 의심 <strong style="color:var(--accent);">${duplicateCount}</strong>건, 오류 <strong style="color:var(--danger);">${errorCount}</strong>건`;
            previewPanel.style.display = 'flex';

            // Enable submit if we have valid records
            if (parsedStudents.length > 0) {
                btnSubmit.disabled = false;
            } else {
                btnSubmit.disabled = true;
            }
        };

        // Form Submit trigger (Bulk Insert)
        btnSubmit.addEventListener('click', () => {
            if (parsedStudents.length === 0) return;

            // Sort parsedStudents in descending order of seq
            parsedStudents.sort((a, b) => {
                const seqA = parseInt(a.seq) || 0;
                const seqB = parseInt(b.seq) || 0;
                return seqB - seqA;
            });

            let successImport = 0;
            let incompleteImport = 0;
            const studentsList = [];

            parsedStudents.forEach(item => {
                const sData = item.studentData;
                const schedules = item.schedules;

                // Safe defaults for dueDay and fee to avoid database issues
                if (sData.dueDay === null || sData.dueDay === undefined) {
                    sData.dueDay = 10; // System default billing day
                }

                // Check if this student is incomplete
                const contactMissing = !sData.phone && !sData.parentPhone;
                const teacherMissing = !sData.teacherId;
                const feeMissing = sData.fee === undefined || sData.fee === null;
                const isIncomplete = contactMissing || teacherMissing || feeMissing;

                if (isIncomplete) {
                    incompleteImport++;
                } else {
                    successImport++;
                }

                const enrollDate = new Date().toISOString().slice(0, 10);
                sData.enrollDate = enrollDate;

                studentsList.push({ studentData: sData, schedules });
            });

            try {
                // Call batch insert
                stateStore.addStudentsBatch(studentsList);

                closeModal();

                // Display Toast notification
                const totalImported = parsedStudents.length;
                const alertMsg = `총 ${totalImported}건 중 ${totalImported}건 일괄 등록 완료 (${successImport}건 등록 성공, ${incompleteImport}건 정보 미완성 상태)`;
                
                // Dispatch a KakaoTalk notification look-alike toast as feedback
                const event = new CustomEvent('kakaotalk-alert', {
                    detail: { message: alertMsg }
                });
                window.dispatchEvent(event);
            } catch (err) {
                console.error("Excel upload failed:", err);
                alert("엑셀 데이터 등록 중 오류가 발생했습니다. 브라우저 저장 용량이 초과되었을 수 있습니다.\n오류 내용: " + err.message);
            }
        });
    };

    openModal(modalHtml, onInitModal);
};
export function renderStudents(container) {
    let filterQuery = '';
    let filterTeacherId = '';
    let filterDayOfWeek = '';
    let filterStatus = 'active'; // 'active', 'discharged', 'all'

    // Sorting state
    let sortKey = 'studentMemberNo'; // 'studentMemberNo', 'enrollDate', 'name'
    let sortDirection = 'desc'; // 'asc', 'desc'

    // Pagination state
    let currentPage = 1;
    const itemsPerPage = 100;

    const toggleSort = (key) => {
        if (sortKey === key) {
            sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
        } else {
            sortKey = key;
            sortDirection = 'desc'; // Default to descending on new click
        }
        currentPage = 1;
        renderTableBody();
    };

    const getSortIcon = (key) => {
        if (sortKey !== key) {
            return '<i class="fa-solid fa-sort" style="margin-left: 4px; opacity: 0.3;"></i>';
        }
        return sortDirection === 'asc' 
            ? '<i class="fa-solid fa-sort-up" style="margin-left: 4px; color: var(--primary);"></i>'
            : '<i class="fa-solid fa-sort-down" style="margin-left: 4px; color: var(--primary);"></i>';
    };

    const render = () => {
        const teachers = stateStore.getTeachers();
        const students = stateStore.getStudents() || [];

        container.innerHTML = `
            <!-- Filter Bar Card -->
            <div class="glass-card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <div style="display: flex; gap: 12px; flex-grow: 1; flex-wrap: wrap; max-width: 900px;">
                        <!-- Search input -->
                        <div style="position: relative; flex-grow: 1; min-width: 220px;">
                            <input type="text" id="student-search-input" class="form-control" placeholder="원생 이름 또는 수강 과목 검색..." style="width: 100%; padding-left: 40px; margin-bottom: 0;" value="${filterQuery}">
                            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        </div>
                        
                        <!-- Teacher filter -->
                        <select id="student-teacher-filter" class="form-control" style="min-width: 160px; margin-bottom: 0;">
                            <option value="">강사 전체</option>
                            ${teachers.filter(t => t.employmentStatus !== 'resigned' || filterTeacherId === t.id || students.some(s => s.teacherId === t.id)).map(t => {
                                const resignedSuffix = t.employmentStatus === 'resigned' ? ' (퇴사)' : '';
                                return `<option value="${t.id}" ${filterTeacherId === t.id ? 'selected' : ''}>${t.name}${resignedSuffix} (${t.instrument})</option>`;
                            }).join('')}
                        </select>

                        <!-- Day filter -->
                        <select id="student-day-filter" class="form-control" style="min-width: 130px; margin-bottom: 0;">
                            <option value="">수업 요일 전체</option>
                            ${['월', '화', '수', '목', '금', '토', '일'].map(d => `<option value="${d}" ${filterDayOfWeek === d ? 'selected' : ''}>${d}요일</option>`).join('')}
                        </select>

                        <!-- Enrollment Status filter -->
                        <select id="student-status-filter" class="form-control" style="min-width: 130px; margin-bottom: 0;">
                            <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>재원생 전체</option>
                            <option value="discharged" ${filterStatus === 'discharged' ? 'selected' : ''}>퇴원생 전체</option>
                            <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>원생 전체</option>
                        </select>
                    </div>

                    <div class="student-action-buttons-group">
                        <button class="btn btn-secondary btn-student-action" id="btn-print-student-register" style="border-color: rgba(0, 206, 201, 0.4); background: rgba(0, 206, 201, 0.15); color: var(--accent); display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-print"></i> 수강생 대장 인쇄
                        </button>
                        <button class="btn btn-secondary btn-student-action" id="btn-excel-upload" style="border-color: rgba(9, 132, 227, 0.4); background: rgba(9, 132, 227, 0.15); color: var(--primary); display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-file-excel"></i> 엑셀 업로드
                        </button>
                        <button class="btn btn-primary btn-student-action" id="btn-add-student" style="display: inline-flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-plus"></i> 원생 등록
                        </button>
                    </div>
                </div>
            </div>

            <!-- Student List Table Card -->
            <div class="glass-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 5px 5px 0 5px;">
                    <h4 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                        원생 목록 <span id="student-total-count" style="font-size: 0.9rem; font-weight: normal; color: var(--text-muted);">(총 -명)</span>
                    </h4>
                </div>
                <div class="table-wrapper">
                    <table class="custom-table" id="students-table" style="table-layout: fixed; width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 100px; text-align: center; cursor: pointer; user-select: none;" id="th-student-member-no">
                                    회원번호 ${getSortIcon('studentMemberNo')}
                                </th>
                                <th style="width: 140px; cursor: pointer; user-select: none;" id="th-student-name">
                                    원생명 ${getSortIcon('name')}
                                </th>
                                <th style="width: 120px; cursor: pointer; user-select: none;" id="th-student-enroll-date">
                                    등록일 ${getSortIcon('enrollDate')}
                                </th>
                                <th style="width: 150px;">연락처</th>
                                <th style="width: 130px;">담당 강사</th>
                                <th style="width: 250px;">수업 시간표</th>
                                <th style="width: 150px;">수강료 (납부 약정일)</th>
                                <th style="width: 140px; text-align: right;">관리</th>
                            </tr>
                        </thead>
                        <tbody id="students-table-body">
                            <!-- Rows rendered dynamically -->
                        </tbody>
                    </table>
                </div>
                <div id="students-pagination-container"></div>
            </div>
        `;

        // Attach event listeners to filters
        const searchInput = container.querySelector('#student-search-input');
        const teacherFilter = container.querySelector('#student-teacher-filter');
        const dayFilter = container.querySelector('#student-day-filter');
        const statusFilter = container.querySelector('#student-status-filter');
        const btnAddStudent = container.querySelector('#btn-add-student');
        const btnPrintStudentRegister = container.querySelector('#btn-print-student-register');
        const btnExcelUpload = container.querySelector('#btn-excel-upload');

        if (btnPrintStudentRegister) {
            btnPrintStudentRegister.addEventListener('click', () => {
                printStudentRegister();
            });
        }

        if (btnExcelUpload) {
            btnExcelUpload.addEventListener('click', () => {
                openExcelUploadModal();
            });
        }

        searchInput.addEventListener('input', (e) => {
            filterQuery = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        teacherFilter.addEventListener('change', (e) => {
            filterTeacherId = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        dayFilter.addEventListener('change', (e) => {
            filterDayOfWeek = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        statusFilter.addEventListener('change', (e) => {
            filterStatus = e.target.value;
            currentPage = 1;
            renderTableBody();
        });

        btnAddStudent.addEventListener('click', () => {
            openStudentModal();
        });

        // Attach header sort click events
        container.querySelector('#th-student-member-no').addEventListener('click', () => toggleSort('studentMemberNo'));
        container.querySelector('#th-student-name').addEventListener('click', () => toggleSort('name'));
        container.querySelector('#th-student-enroll-date').addEventListener('click', () => toggleSort('enrollDate'));

        renderTableBody();
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#students-table-body');
        const paginationContainer = container.querySelector('#students-pagination-container');
        if (!tbody) return;

        const students = stateStore.getStudents();
        const teachers = stateStore.getTeachers();
        const classes = stateStore.getClasses();

        // Apply filtering logic
        const filteredStudents = students.filter(s => {
            let teacherName = '';
            let teacherDispName = '';
            if (s.teacherId || s.teacher) {
                const teacherObj = stateStore.findTeacherByIdOrName(s.teacherId || s.teacher);
                if (teacherObj) {
                    teacherName = teacherObj.name;
                    teacherDispName = teacherObj.employmentStatus === 'resigned' ? `${teacherObj.name} (퇴사)` : teacherObj.name;
                } else if (typeof s.teacher === 'string') {
                    teacherName = s.teacher;
                    teacherDispName = s.teacher;
                }
            }

            const queryMatch = !filterQuery || 
                s.name.toLowerCase().includes(filterQuery.toLowerCase()) || 
                s.instrument.toLowerCase().includes(filterQuery.toLowerCase()) ||
                (teacherName && teacherName.toLowerCase().includes(filterQuery.toLowerCase())) ||
                (teacherDispName && teacherDispName.toLowerCase().includes(filterQuery.toLowerCase()));

            const teacherMatch = !filterTeacherId || s.teacherId === filterTeacherId;

            let dayMatch = true;
            if (filterDayOfWeek) {
                const studentClasses = classes.filter(c => c.studentId === s.id);
                dayMatch = studentClasses.some(c => c.dayOfWeek === filterDayOfWeek);
            }

            let statusMatch = true;
            if (filterStatus === 'active') {
                statusMatch = s.status !== 'withdrawn';
            } else if (filterStatus === 'discharged') {
                statusMatch = s.status === 'withdrawn';
            }

            return queryMatch && teacherMatch && dayMatch && statusMatch;
        });

        // Update total student count in the header
        const totalCountEl = container.querySelector('#student-total-count');
        if (totalCountEl) {
            totalCountEl.textContent = `(총 ${filteredStudents.length}명)`;
        }

        // Apply Sorting logic
        filteredStudents.sort((a, b) => {
            let valA, valB;
            if (sortKey === 'studentMemberNo') {
                valA = a.studentMemberNo || 0;
                valB = b.studentMemberNo || 0;
            } else if (sortKey === 'enrollDate') {
                valA = a.enrollDate || '';
                valB = b.enrollDate || '';
            } else if (sortKey === 'name') {
                valA = a.name || '';
                valB = b.name || '';
            }

            if (typeof valA === 'string') {
                return sortDirection === 'asc' 
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            } else {
                return sortDirection === 'asc'
                    ? valA - valB
                    : valB - valA;
            }
        });

        // Update sorting icons
        const thMemberNo = container.querySelector('#th-student-member-no');
        const thName = container.querySelector('#th-student-name');
        const thEnrollDate = container.querySelector('#th-student-enroll-date');
        if (thMemberNo) thMemberNo.innerHTML = `회원번호 ${getSortIcon('studentMemberNo')}`;
        if (thName) thName.innerHTML = `원생명 ${getSortIcon('name')}`;
        if (thEnrollDate) thEnrollDate.innerHTML = `등록일 ${getSortIcon('enrollDate')}`;

        // Apply Pagination logic
        const totalItems = filteredStudents.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

        if (paginatedStudents.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: rgba(255,255,255,0.05); margin-bottom: 8px; display: block;"></i>
                        검색 조건에 일치하는 원생이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredStudents.map(s => {
            const teacher = teachers.find(t => t.id === s.teacherId);
            const studentClasses = classes.filter(c => c.studentId === s.id);
            
            // Format schedule blocks nicely
            const scheduleText = studentClasses.length > 0
                ? studentClasses.map(c => `<span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-color); white-space: nowrap;">${c.dayOfWeek} ${c.time}</span>`).join(' ')
                : '<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">미등록</span>';

            const ageSchoolText = [
                (s.isAdult === true || s.isAdult === 'adult') ? '성인' : ((s.isAdult === false || s.isAdult === 'minor') ? '비성인' : '-'),
                s.age ? `${s.age}세` : '',
                s.school ? s.school : ''
            ].filter(Boolean).join(' | ');

            const isDischarged = s.status === 'withdrawn';
            let statusBadge = '';
            if (isDischarged) {
                statusBadge = `<span class="badge badge-danger" style="margin-left: 6px; padding: 2px 8px; border-radius: 12px; background: var(--danger-light); color: var(--danger);">퇴원</span>`;
            } else if (s.status === 'on_leave') {
                statusBadge = `<span class="badge badge-warning" style="margin-left: 6px; padding: 2px 8px; border-radius: 12px; background: var(--warning-light); color: #d5a300;">휴원</span>`;
            }

            const isIncomplete = isIncompleteStudent(s);
            const incompleteBadge = isIncomplete ? `<span class="badge badge-warning" style="margin-left: 6px; padding: 2px 8px; border-radius: 12px; background: var(--warning-light); color: var(--warning); border: 1px solid rgba(241, 196, 15, 0.3); font-size: 0.72rem; font-weight: bold;">정보 미완성</span>` : '';

            return `
                <tr>
                    <!-- 1. 회원번호 -->
                    <td style="text-align: center; font-weight: bold; color: var(--text-main); font-size: 0.9rem; word-break: break-all;">
                        ${s.studentMemberNo || '-'}
                    </td>
                    <!-- 2. 원생명 -->
                    <td style="font-weight: 600; word-break: break-word;">
                        <span class="student-name-link" data-id="${s.id}" style="font-size: 0.95rem; color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${s.name}</span>
                        ${statusBadge}
                        ${incompleteBadge}
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">구분: ${s.status === 'withdrawn' ? '퇴원' : (s.status === 'on_leave' ? '휴원' : '재원')}</div>
                        ${ageSchoolText ? `<div style="font-size: 0.75rem; color: var(--secondary); font-weight: 500; margin-top: 2px;">${ageSchoolText}</div>` : ''}
                    </td>
                    <!-- 3. 등록일 -->
                    <td style="font-size: 0.85rem; color: var(--text-main); text-align: center; word-break: break-all;">
                        <div>${s.enrollDate || '-'}</div>
                        ${isDischarged && s.leaveDate ? `<div style="font-size: 0.72rem; color: var(--danger); font-weight: bold; margin-top: 2px;">퇴원: ${s.leaveDate}</div>` : ''}
                    </td>
                    <!-- 4. 연락처 -->
                    <td style="word-break: break-all;">
                        <div style="font-size: 0.85rem; font-weight: 500;">본인: ${s.phone || '-'}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">학부모: ${s.parentPhone || '-'}</div>
                    </td>
                    <!-- 5. 담당 강사 -->
                    <td style="word-break: break-word;">
                        <div style="font-weight: 600; color: var(--accent); font-size: 0.9rem;">${s.instrument}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">강사: ${teacher ? (teacher.employmentStatus === 'resigned' ? `${teacher.name} (퇴사)` : teacher.name) : '<span style="color:var(--danger)">미지정</span>'}</div>
                    </td>
                    <!-- 6. 수업 시간표 -->
                    <td style="word-break: break-word;">
                        <div style="display: flex; gap: 4px 6px; flex-wrap: wrap; align-items: center; line-height: 1.5;">
                            ${scheduleText}
                        </div>
                    </td>
                    <!-- 7. 수강료 (납부 약정일) -->
                    <td style="word-break: break-word;">
                        <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${s.fee.toLocaleString()}원</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">매월 ${s.dueDay}일 청구</div>
                    </td>
                    <!-- 8. 관리 -->
                    <td style="text-align: right; word-break: break-word;">
                        <div style="display: inline-flex; gap: 8px;">
                            ${s.status !== 'withdrawn' ? `
                            <button class="btn btn-secondary btn-icon-only discharge-student-btn" data-id="${s.id}" title="퇴원" style="background: rgba(225, 112, 85, 0.15); border-color: rgba(225, 112, 85, 0.4); color: #e17055;">
                                <i class="fa-solid fa-user-minus" style="font-size: 0.85rem;"></i>
                            </button>` : ''}
                            <button class="btn btn-secondary btn-icon-only manage-student-books-btn" data-id="${s.id}" title="교재 관리" style="background: rgba(0, 206, 201, 0.15); border-color: rgba(0, 206, 201, 0.4); color: var(--accent);">
                                <i class="fa-solid fa-book" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-secondary btn-icon-only edit-student-btn" data-id="${s.id}" title="수정" style="background: rgba(9, 132, 227, 0.15); border-color: rgba(9, 132, 227, 0.4); color: var(--primary);">
                                <i class="fa-solid fa-pen" style="font-size: 0.85rem;"></i>
                            </button>
                            <button class="btn btn-danger btn-icon-only delete-student-btn" data-id="${s.id}" title="삭제">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Action button click handlers
        tbody.querySelectorAll('.student-name-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openStudentDetailModal(id);
            });
        });

        tbody.querySelectorAll('.manage-student-books-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openStudentBooksModal(id);
            });
        });

        tbody.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                openStudentModal(id);
            });
        });

        tbody.querySelectorAll('.discharge-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = stateStore.getStudent(id);
                if (confirm(`정말로 '${student.name}' 원생을 퇴원 처리하시겠습니까?\n퇴원은 삭제가 아니며 기존 이력은 보존됩니다.\n출결/수납/메시지/대시보드 반영은 후속 정책에 따라 별도 적용됩니다.`)) {
                    stateStore.dischargeStudent(id);
                    showKakaoTalkToast(`'${student.name}' 원생이 퇴원 처리되었습니다.`);
                }
            });
        });

        tbody.querySelectorAll('.delete-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = stateStore.getStudent(id);
                
                openDeleteAuthModal(id, () => {
                    if (confirm(`정말로 '${student.name}' 원생의 명부를 삭제하시겠습니까?\n해당 원생의 모든 출석부 및 수강료 수납 내역이 삭제됩니다.`)) {
                        stateStore.deleteStudent(id);
                        showKakaoTalkToast(`'${student.name}' 원생 정보가 삭제(Soft Delete)되었습니다.`);
                    }
                });
            });
        });
    };

    // Modal Manager for Student Registration & Editing
    ;

    render();

    // Pub/Sub wiring
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', renderTableBody);
    const unsubClasses = stateStore.subscribe('CLASSES_CHANGED', renderTableBody);
    const unsubTeachers = stateStore.subscribe('TEACHERS_CHANGED', render); // Needs full redraw to sync teacher dropdown options

    return () => {
        unsubStudents();
        unsubClasses();
        unsubTeachers();
    };
}

/**
 * 4. 강사 명부 관리 (renderTeachers)
 * Renders list of teachers, with forms to add, edit, or delete teachers.
 * Built with a responsive 2-column layout.
 */

// Register openStudentDetailModal to the shared registry
setOpenStudentDetailModal(openStudentDetailModal);
