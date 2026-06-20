import { stateStore } from '../../state.js';
import { validateRecipients } from '../../utils/messageTemplates.js';

/**
 * todayConsoleHandoff.js
 * Extracted message handoff helper for the Director Today Console (Phase 18A-3)
 */
export function triggerTodayConsoleMessageHandoff(taskId) {
    const task = stateStore.getTodayTasks().find(t => t.id === taskId);
    if (!task) {
        alert('해당 업무 정보를 찾을 수 없습니다.');
        return;
    }

    const studentId = (task.relatedStudentIds && task.relatedStudentIds.length > 0) ? task.relatedStudentIds[0] : (task.studentId || '');
    if (!studentId) {
        alert('해당 업무에 연계된 원생 정보가 없습니다.');
        return;
    }
    
    let suggestedTemplateType = 'general';
    let relatedDomainType = task.type || '';
    if (task.category === 'absent') {
        suggestedTemplateType = 'absent';
        relatedDomainType = 'attendance';
    } else if (task.category === 'billing') {
        suggestedTemplateType = 'tuition_info';
        relatedDomainType = 'billing';
    } else if (task.category === 'overdue') {
        suggestedTemplateType = 'tuition_unpaid';
        relatedDomainType = 'billing';
    } else if (task.category === 'book_billing') {
        suggestedTemplateType = 'book_unpaid';
        relatedDomainType = 'book';
    } else if (task.category === 'consult' || task.category === 'counseling' || task.type === 'counseling') {
        suggestedTemplateType = 'consulting';
        relatedDomainType = 'counseling';
    }

    const student = stateStore.getStudent(studentId);
    const studentName = student ? student.name : '';

    // 1. 수업시간 또는 결석 관련 정보
    let classTime = '';
    if (task.startAt) {
        const startDate = new Date(task.startAt);
        const startTimeStr = startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (task.endAt) {
            const endDate = new Date(task.endAt);
            const endTimeStr = endDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
            classTime = `${startTimeStr} ~ ${endTimeStr}`;
        } else {
            classTime = startTimeStr;
        }
    }
    const timeMatch = task.description && task.description.match(/• 수업 시간:\s*([^\n]+)/);
    if (timeMatch) {
        classTime = timeMatch[1].trim();
    }

    // 2. 청구 월/금액/납부 예정일
    let billingMonth = '';
    let billingAmount = 0;
    let billingDueDate = '';
    if (task.type === 'billing') {
        const key = task.dedupeKey || '';
        let paymentId = '';
        if (key.startsWith('SYSTEM_RECOMMEND_BILLING_DUE_')) {
            paymentId = key.substring('SYSTEM_RECOMMEND_BILLING_DUE_'.length).split('_')[0];
        } else if (key.startsWith('SYSTEM_RECOMMEND_BILLING_UNPAID_')) {
            paymentId = key.substring('SYSTEM_RECOMMEND_BILLING_UNPAID_'.length).split('_')[0];
        }
        if (paymentId) {
            const payment = stateStore.db.payments && stateStore.db.payments.find(p => p.id === paymentId);
            if (payment) {
                billingMonth = payment.month;
                billingAmount = payment.amount;
                const dueDay = student ? (student.dueDay || 10) : 10;
                const [py, pm] = payment.month.split('-').map(Number);
                const lastDay = new Date(py, pm, 0).getDate();
                const safeDueDay = Math.min(dueDay, lastDay);
                billingDueDate = `${py}-${String(pm).padStart(2, '0')}-${String(safeDueDay).padStart(2, '0')}`;
            }
        }
    }

    // 3. 교재명/금액/납부 예정일
    let bookName = '';
    let bookAmount = 0;
    let bookDueDate = '';
    if (task.category === 'book_billing') {
        const key = task.dedupeKey || '';
        const paymentId = key.replace('SYSTEM_RECOMMEND_BOOK_BILLING_', '');
        if (paymentId) {
            const payment = stateStore.db.payments && stateStore.db.payments.find(p => p.id === paymentId);
            if (payment) {
                bookAmount = payment.amount;
                const book = stateStore.db.books && stateStore.db.books.find(b => b.id === payment.bookId);
                bookName = book ? book.name : '교재';
                const [py, pm] = payment.month.split('-').map(Number);
                const safeDueDay = Math.min(student ? (student.dueDay || 14) : 14, new Date(py, pm, 0).getDate());
                let paymentDueAt = new Date(py, pm - 1, safeDueDay, 0, 0, 0, 0);
                const invoiceDateStr = payment.invoiceDate || payment.createdAt || new Date().toISOString().slice(0, 10);
                const [iy, im, id] = invoiceDateStr.slice(0, 10).split('-').map(Number);
                const invoiceDateAt = new Date(iy, im - 1, id, 0, 0, 0, 0);
                if (invoiceDateAt.getTime() >= paymentDueAt.getTime()) {
                    let nextYear = py;
                    let nextMonth = pm + 1;
                    if (nextMonth > 12) {
                        nextMonth = 1;
                        nextYear += 1;
                    }
                    const nextSafeDueDay = Math.min(student ? (student.dueDay || 14) : 14, new Date(nextYear, nextMonth, 0).getDate());
                    paymentDueAt = new Date(nextYear, nextMonth - 1, nextSafeDueDay, 0, 0, 0, 0);
                }
                const dy = paymentDueAt.getFullYear();
                const dm = String(paymentDueAt.getMonth() + 1).padStart(2, '0');
                const dd = String(paymentDueAt.getDate()).padStart(2, '0');
                bookDueDate = `${dy}-${dm}-${dd}`;
            }
        }
    }

    // 4. 상담 예정일/메모 등
    let consultDate = '';
    let consultMemo = '';
    if (task.category === 'consult' || task.category === 'counseling' || task.type === 'counseling') {
        if (task.startAt) {
            const startDate = new Date(task.startAt);
            consultDate = startDate.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
        }
        consultMemo = task.description || '';
    }

    // 5. 템플릿 매핑 정책 (Phase 18A-3)
    let templateId = 'general_notice';
    const keyStr = task.dedupeKey || '';
    
    if (task.category === 'billing') {
        templateId = 'tuition_due';
    } else if (task.category === 'overdue') {
        templateId = 'tuition_unpaid';
    } else if (task.category === 'book_billing') {
        templateId = 'book_unpaid';
    } else if (task.category === 'absent' || keyStr.includes('_ABSENT_')) {
        templateId = 'attendance_absent';
    } else if (keyStr.includes('_LATE_CHECKOUT_MISSING_') || keyStr.includes('_CHECKOUT_MISSING_')) {
        templateId = 'attendance_checkout_missing';
    } else if (keyStr.includes('_LATE_')) {
        templateId = 'attendance_late';
    } else if (task.category === 'consult' || task.category === 'counseling' || task.type === 'counseling') {
        templateId = 'consultation_notice';
    } else if (task.category === 'schedule') {
        templateId = 'schedule_notice';
    }

    // 6. 템플릿 변수 Payload 바인딩
    const settings = stateStore.getSettings ? stateStore.getSettings() : {};
    const dbSettings = stateStore.db.settings || {};
    const academyName = settings.academy || dbSettings.academy || '튜링음악학원';
    const directorName = settings.director || dbSettings.director || '주재경';
    const todayDateStr = new Date().toISOString().slice(0, 10);

    const billingMonthLabel = billingMonth ? `${billingMonth.split('-')[0]}년 ${parseInt(billingMonth.split('-')[1])}월` : '';
    const teacherMatch = task.description && task.description.match(/• 담당 강사:\s*([^\n]+)/);
    const teacherName = teacherMatch ? teacherMatch[1].trim() : '미배정';
    
    const schedNameMatch = task.description && task.description.match(/• 일정명:\s*([^\n]+)/);
    const scheduleName = schedNameMatch ? schedNameMatch[1].trim() : (task.title || '');
    
    const schedDateMatch = task.description && task.description.match(/• 날짜:\s*([^\n]+)/);
    const scheduleDate = schedDateMatch ? schedDateMatch[1].trim() : '';

    const templatePayload = {
        '이름': studentName,
        '학원명': academyName,
        '원장명': directorName,
        '발송일': todayDateStr,
        '미납액': billingAmount ? `${billingAmount.toLocaleString()}원` : '',
        '납부기한': billingDueDate || bookDueDate,
        '청구월': billingMonthLabel,
        '수납구분': task.category === 'book_billing' ? '교재비' : '원비',
        '납부상태': '미납',
        '교재명': bookName,
        '교재비': bookAmount ? `${bookAmount.toLocaleString()}원` : '',
        '교재지급일': task.createdAt ? task.createdAt.slice(0, 10) : '',
        '교재상태': '미납',
        '수업일': todayDateStr,
        '수업시간': classTime,
        '출결상태': templateId === 'attendance_absent' ? '결석' : (templateId === 'attendance_late' ? '지각' : '하원 누락'),
        '강사명': teacherName,
        '상담일시': consultDate,
        '일정명': scheduleName,
        '일정일시': scheduleDate,
        '메모': (task.category === 'consult' || task.category === 'counseling' || task.type === 'counseling') ? consultMemo : (task.description || '')
    };

    // 7. 수신자 세이프가드 검증
    const recipientValidation = student ? validateRecipients([student], { templateId }) : { ok: false, reason: '원생 정보 없음' };

    const handoffPayload = {
        source: 'today_console',
        taskId: task.id,
        studentId: studentId,
        relatedDomainType: relatedDomainType,
        relatedDomainId: (task.dedupeKey || '').split('_').slice(-1)[0] || '',
        suggestedTemplateType: suggestedTemplateType,
        returnView: 'dir-today-console',
        templateId: templateId,
        templatePayload: templatePayload,
        recipientValidation: recipientValidation,
        meta: {
            studentName: studentName,
            classTime: classTime,
            billingMonth: billingMonth,
            billingAmount: billingAmount,
            billingDueDate: billingDueDate,
            bookName: bookName,
            bookAmount: bookAmount,
            bookDueDate: bookDueDate,
            consultDate: consultDate,
            consultMemo: consultMemo
        }
    };

    sessionStorage.setItem('dayday_handoff_payload', JSON.stringify(handoffPayload));
    
    const menuItem = document.querySelector('.menu-item[data-view="dir-message-send"]');
    if (menuItem) {
        menuItem.click();
    }
}
