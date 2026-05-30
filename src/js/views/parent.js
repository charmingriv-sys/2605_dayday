// parent.js - App-less Mobile Parent Portal View
import { stateStore } from '../state.js';

const escapeHtml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export function renderParentPortal(container, initialStudentId) {
    let studentId = initialStudentId;
    let activeTab = 'journal'; // 'journal', 'attendance', 'billing', 'communication'
    let payingInvoiceId = null; // Stored if paying mock invoice
    let showMockPaymentModal = false;
    let communicationSubTab = 'announcements'; // 'announcements', 'messages', 'surveys'
    let viewingAnnouncementId = null;
    let viewingMessageId = null;
    let answeringSurveyId = null;

    const render = () => {
        const student = stateStore.getStudent(studentId);
        if (!student) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--danger);">원생 정보를 찾을 수 없습니다.</div>`;
            return;
        }

        const teacher = stateStore.getTeacher(student.teacherId);
        const payments = stateStore.getPaymentsForStudent(studentId);
        const attendance = stateStore.getAttendanceForStudent(studentId)
            .sort((a, b) => b.date.localeCompare(a.date));

        const announcements = stateStore.getAnnouncements().sort((a, b) => b.date.localeCompare(a.date));
        const messages = stateStore.getMessagesForStudent(studentId).sort((a, b) => b.date.localeCompare(a.date));
        const surveys = stateStore.getSurveys().sort((a, b) => b.date.localeCompare(a.date));

        // Find siblings if linked
        const linksForStudent = stateStore.db.parentStudentLinks ? stateStore.db.parentStudentLinks.filter(link => link.studentId === studentId) : [];
        const parentUserId = linksForStudent.length > 0 ? linksForStudent[0].parentUserId : null;
        const siblings = parentUserId ? stateStore.getStudentsForParent(parentUserId) : [];

        let siblingSelectorHtml = '';
        if (siblings.length > 1) {
            siblingSelectorHtml = `
                <div style="margin-top: -4px; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 6px 10px; border: 1px solid rgba(255,255,255,0.15);">
                    <span style="font-size: 0.75rem; color: #ffffff; font-weight: 700;"><i class="fa-solid fa-child-reaching"></i> 자녀 선택:</span>
                    <select class="mobile-sibling-dropdown" style="background: rgba(255,255,255,0.25); border: none; color: #ffffff; font-size: 0.75rem; font-weight: 700; outline: none; border-radius: 4px; padding: 2px 6px; cursor: pointer;">
                        ${siblings.map(s => `
                            <option value="${s.id}" ${s.id === studentId ? 'selected' : ''} style="color: var(--text-main);">
                                ${s.name} (${s.instrument})
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        // Unpaid bills count
        const unpaidCount = payments.filter(p => p.status !== 'paid').length;

        // Unread messages and unanswered surveys counts
        const unreadMsgCount = messages.filter(m => !m.isRead).length;
        const unansweredSurveyCount = surveys.filter(s => s.isActive && !stateStore.hasStudentAnsweredSurvey(s.id, studentId)).length;

        container.innerHTML = `
            <div class="parent-portal-mobile-wrapper" style="font-family: 'Inter', sans-serif; color: var(--text-main); display: flex; flex-direction: column; height: 100%; max-height: 756px; position: relative;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #0984e3, #74b9ff); padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.15); display: flex; flex-direction: column; gap: 12px; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 0.95rem; font-weight: 800; tracking-wide: 0.05em; color: #ffffff;">TURING MUSIC</span>
                        <span style="font-size: 0.72rem; background: rgba(255,255,255,0.25); color: #ffffff; padding: 3px 8px; border-radius: 20px; font-weight: 600;">학부모 안심 포털</span>
                    </div>
                    ${siblingSelectorHtml}
                    
                    <!-- Student Card -->
                    <div style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.20); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 42px; height: 42px; border-radius: 50%; background: #ffffff; display: flex; justify-content: center; align-items: center; font-weight: 700; font-size: 1rem; color: var(--primary);">
                            ${student.name.slice(0, 1)}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff;">${student.name} 원생</div>
                            <div style="font-size: 0.75rem; color: #e0f2fe; font-weight: 500;">
                                ${student.instrument} | 담당 ${teacher ? teacher.name : '미배정'} 강사
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tab Menu Links -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; background: #ffffff; border-bottom: 1px solid rgba(0,0,0,0.06); text-align: center; flex-shrink: 0;">
                    <button class="parent-tab-link ${activeTab === 'journal' ? 'active' : ''}" data-tab="journal" style="background: none; border: none; padding: 12px 4px; font-size: 0.78rem; font-weight: 600; color: ${activeTab === 'journal' ? 'var(--primary)' : '#64748b'}; border-bottom: 2px solid ${activeTab === 'journal' ? 'var(--primary)' : 'transparent'}; cursor: pointer;">
                        <i class="fa-solid fa-journal-whills" style="margin-right: 2px;"></i>수업일지
                    </button>
                    <button class="parent-tab-link ${activeTab === 'attendance' ? 'active' : ''}" data-tab="attendance" style="background: none; border: none; padding: 12px 4px; font-size: 0.78rem; font-weight: 600; color: ${activeTab === 'attendance' ? 'var(--primary)' : '#64748b'}; border-bottom: 2px solid ${activeTab === 'attendance' ? 'var(--primary)' : 'transparent'}; cursor: pointer;">
                        <i class="fa-solid fa-calendar-check" style="margin-right: 2px;"></i>출결조회
                    </button>
                    <button class="parent-tab-link ${activeTab === 'billing' ? 'active' : ''}" data-tab="billing" style="background: none; border: none; padding: 12px 4px; font-size: 0.78rem; font-weight: 600; color: ${activeTab === 'billing' ? 'var(--primary)' : '#64748b'}; border-bottom: 2px solid ${activeTab === 'billing' ? 'var(--primary)' : 'transparent'}; cursor: pointer; position: relative;">
                        <i class="fa-solid fa-credit-card" style="margin-right: 2px;"></i>교육비
                        ${unpaidCount > 0 ? `<span style="position: absolute; top: 4px; right: 2px; background: var(--danger); color: white; border-radius: 50%; font-size: 0.6rem; width: 14px; height: 14px; display: inline-flex; justify-content: center; align-items: center; font-weight: 700;">${unpaidCount}</span>` : ''}
                    </button>
                    <button class="parent-tab-link ${activeTab === 'communication' ? 'active' : ''}" data-tab="communication" style="background: none; border: none; padding: 12px 4px; font-size: 0.78rem; font-weight: 600; color: ${activeTab === 'communication' ? 'var(--primary)' : '#64748b'}; border-bottom: 2px solid ${activeTab === 'communication' ? 'var(--primary)' : 'transparent'}; cursor: pointer; position: relative;">
                        <i class="fa-solid fa-envelope-open-text" style="margin-right: 2px;"></i>소통알림
                        ${unreadMsgCount + unansweredSurveyCount > 0 ? `<span style="position: absolute; top: 4px; right: 2px; background: var(--danger); color: white; border-radius: 50%; font-size: 0.6rem; width: 14px; height: 14px; display: inline-flex; justify-content: center; align-items: center; font-weight: 700;">${unreadMsgCount + unansweredSurveyCount}</span>` : ''}
                    </button>
                </div>

                <!-- Tab Content Body Area -->
                <div class="mobile-tab-content-area" style="flex: 1; overflow-y: auto; padding: 16px; background: #f8fafc;">
                    ${renderContent(student, teacher, attendance, payments, announcements, messages, surveys)}
                </div>

                <!-- Footer Navigation Bar -->
                <div style="padding: 12px; background: #ffffff; text-align: center; border-top: 1px solid rgba(0,0,0,0.06); font-size: 0.72rem; color: var(--text-muted); flex-shrink: 0;">
                    학습 결과 및 모바일 결제 제공. 문의: 학원 행정실
                </div>

                <!-- Mock Payment Modal Overlay -->
                ${showMockPaymentModal ? renderMockPaymentOverlay(payments.find(p => p.id === payingInvoiceId)) : ''}

                <!-- Communication Detail/Form Overlays -->
                ${viewingAnnouncementId ? renderAnnouncementOverlay(announcements.find(a => a.id === viewingAnnouncementId)) : ''}
                ${viewingMessageId ? renderMessageOverlay(messages.find(m => m.id === viewingMessageId)) : ''}
                ${answeringSurveyId ? renderSurveyOverlay(surveys.find(s => s.id === answeringSurveyId)) : ''}
            </div>
        `;

        // Bind sibling dropdown event
        if (siblings.length > 1) {
            const selectEl = container.querySelector('.mobile-sibling-dropdown');
            if (selectEl) {
                selectEl.addEventListener('change', (e) => {
                    studentId = e.target.value;
                    render();
                });
            }
        }

        // Bind tab navigation click events
        container.querySelectorAll('.parent-tab-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeTab = e.currentTarget.dataset.tab;
                render();
            });
        });

        // Bind billing events
        container.querySelectorAll('.btn-pay-mock-invoice').forEach(btn => {
            btn.addEventListener('click', (e) => {
                payingInvoiceId = e.currentTarget.dataset.pid;
                showMockPaymentModal = true;
                render();
            });
        });

        // Bind communication events if communication tab is active
        if (activeTab === 'communication') {
            container.querySelectorAll('.mobile-comm-subtab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    communicationSubTab = e.currentTarget.dataset.subtab;
                    render();
                });
            });

            container.querySelectorAll('.mobile-ann-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    stateStore.incrementAnnouncementViews(id);
                    viewingAnnouncementId = id;
                    render();
                });
            });

            container.querySelectorAll('.mobile-msg-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    stateStore.markMessageAsRead(id);
                    viewingMessageId = id;
                    render();
                });
            });

            container.querySelectorAll('.mobile-surv-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    answeringSurveyId = id;
                    render();
                });
            });
        }
    };

    const renderContent = (student, teacher, attendance, payments, announcements, messages, surveys) => {
        if (activeTab === 'journal') {
            const lessonsWithNotes = attendance.filter(a => a.note || a.videoUrl || (a.images && a.images.length > 0));
            if (lessonsWithNotes.length === 0) {
                return `
                    <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
                        <i class="fa-solid fa-comment-slash" style="font-size: 2.2rem; display: block; margin-bottom: 12px; color: rgba(0,0,0,0.08);"></i>
                        등록된 수업일지가 없습니다.
                    </div>
                `;
            }

            return lessonsWithNotes.map(item => {
                const statusKo = item.status === 'present' ? '출석' : (item.status === 'late' ? '지각' : '결석');
                const statusClass = item.status === 'present' ? 'badge-success' : (item.status === 'late' ? 'badge-warning' : 'badge-danger');
                
                // Photos grid (Max 10)
                let imagesHtml = '';
                if (item.images && item.images.length > 0) {
                    const cleanImages = item.images.slice(0, 10);
                    imagesHtml = `
                        <div style="margin-top: 10px;">
                            <div style="font-size: 0.72rem; color: var(--primary); font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-images"></i> 수업 활동 사진 (${cleanImages.length}장)
                            </div>
                            <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
                                ${cleanImages.map((img, idx) => `
                                    <img src="${img}" alt="활동사진 ${idx+1}" style="width: 105px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08); flex-shrink: 0;">
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                // Video player
                let videoHtml = '';
                if (item.videoUrl) {
                    videoHtml = `
                        <div style="margin-top: 12px;">
                            <div style="font-size: 0.72rem; color: var(--primary); font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-circle-play"></i> 📹 연주 동영상 재생
                            </div>
                            <div style="position: relative; border-radius: 10px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); background: #000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                                <video src="${item.videoUrl}" controls style="width: 100%; display: block; max-height: 180px; object-fit: contain;"></video>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div style="background: #ffffff; border: 1px solid rgba(0,0,0,0.06); border-radius: 14px; padding: 14px; margin-bottom: 14px; box-shadow: 0 4px 12px rgba(9, 132, 227, 0.04);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed rgba(0,0,0,0.08); padding-bottom: 8px;">
                            <span style="font-size: 0.78rem; font-weight: 700; color: var(--primary);">${item.date} ${item.time ? `(${item.time})` : ''}</span>
                            <span class="badge ${statusClass}" style="font-size: 0.65rem; padding: 2px 6px;">${statusKo}</span>
                        </div>
                        <p style="font-size: 0.85rem; line-height: 1.52; color: var(--text-main); margin: 0; white-space: pre-wrap; word-break: break-all;">${item.note || '수업 진행 내용 기록 완료'}</p>
                        ${imagesHtml}
                        ${videoHtml}
                    </div>
                `;
            }).join('');
        }

        if (activeTab === 'attendance') {
            if (attendance.length === 0) {
                return `<div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">최근 출결 내역이 없습니다.</div>`;
            }

            return `
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    ${attendance.map(item => {
                        const statusKo = item.status === 'present' ? '출석' : (item.status === 'late' ? '지각' : '결석');
                        const statusClass = item.status === 'present' ? 'badge-success' : (item.status === 'late' ? 'badge-warning' : 'badge-danger');
                        const isKicked = item.leavingTime;

                        return `
                            <div style="background: #ffffff; border: 1px solid rgba(0,0,0,0.05); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 8px rgba(9, 132, 227, 0.02);">
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${item.date}</div>
                                    <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                                        <span><i class="fa-solid fa-right-to-bracket" style="color:var(--success)"></i> 등원: ${item.time || '기록 없음'}</span>
                                        ${isKicked ? `<span>|</span> <span><i class="fa-solid fa-right-from-bracket" style="color:var(--accent)"></i> 하원: ${item.leavingTime}</span>` : ''}
                                    </div>
                                </div>
                                <span class="badge ${statusClass}" style="font-size: 0.65rem; padding: 2px 6px;">${statusKo}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (activeTab === 'billing') {
            if (payments.length === 0) {
                return `<div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">수납 청구 내역이 없습니다.</div>`;
            }

            return `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${payments.map(p => {
                        const typeKo = p.type === 'education' ? '교육비(수강료)' : '교재비';
                        const typeBadgeColor = p.type === 'education' ? 'linear-gradient(135deg, #74b9ff, #0984e3)' : 'linear-gradient(135deg, #00cec9, #00b894)';
                        const isPaid = p.status === 'paid';

                        return `
                            <div style="background: #ffffff; border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 3px 10px rgba(9, 132, 227, 0.03);">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-size: 0.72rem; background: ${typeBadgeColor}; color: white; padding: 2px 6px; border-radius: 6px; font-weight: 700;">${typeKo}</span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">청구월: ${p.month.slice(0,4)}년 ${p.month.slice(5,7)}월</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                    <span style="font-size: 1.15rem; font-weight: 800; color: var(--text-main);">${p.amount.toLocaleString()}원</span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted);">기한: ${p.invoiceDate}</span>
                                </div>
                                
                                <div style="margin-top: 4px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 8px;">
                                    <span style="font-size: 0.78rem; color: var(--text-muted);">수납 상태:</span>
                                    ${isPaid ? `
                                        <span style="color: var(--success); font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                            <i class="fa-solid fa-circle-check"></i> 완납 (${p.paidDate} | ${p.method === 'toss' ? '토스페이' : (p.method === 'kakao' ? '카카오페이' : (p.method === 'card' ? '신용카드' : '현금'))})
                                        </span>
                                    ` : `
                                        <button class="btn btn-primary btn-pay-mock-invoice" data-pid="${p.id}" style="font-size: 0.75rem; padding: 6px 12px; height: 30px; font-weight: 700; border-radius: 6px;">
                                            <i class="fa-solid fa-credit-card" style="margin-right: 4px;"></i> 비대면 결제
                                        </button>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (activeTab === 'communication') {
            const subAnnActive = communicationSubTab === 'announcements' ? 'background: var(--primary); color: white;' : 'background: rgba(0,0,0,0.03); color: #64748b;';
            const subMsgActive = communicationSubTab === 'messages' ? 'background: var(--primary); color: white;' : 'background: rgba(0,0,0,0.03); color: #64748b;';
            const subSurvActive = communicationSubTab === 'surveys' ? 'background: var(--primary); color: white;' : 'background: rgba(0,0,0,0.03); color: #64748b;';

            let listContentHtml = '';

            if (communicationSubTab === 'announcements') {
                if (announcements.length === 0) {
                    listContentHtml = `<div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 0.85rem;">등록된 공지사항이 없습니다.</div>`;
                } else {
                    listContentHtml = announcements.map(ann => `
                        <div class="mobile-ann-item" data-id="${ann.id}" style="background: #ffffff; border: 1px solid rgba(0,0,0,0.05); border-radius: 10px; padding: 12px; margin-bottom: 10px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.01);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;">${escapeHtml(ann.title)}</span>
                                <span style="font-size: 0.7rem; color: var(--text-muted);">${ann.date}</span>
                            </div>
                            <p style="margin: 0 0 6px 0; color: var(--text-muted); font-size: 0.78rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                ${escapeHtml(ann.content)}
                            </p>
                            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--primary); font-weight: 600;">
                                <span>조회 ${ann.views || 0}회</span>
                                <span style="color: var(--text-muted);">자세히 <i class="fa-solid fa-chevron-right" style="font-size: 0.6rem;"></i></span>
                            </div>
                        </div>
                    `).join('');
                }
            } else if (communicationSubTab === 'messages') {
                if (messages.length === 0) {
                    listContentHtml = `<div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 0.85rem;">수신된 개별 안내가 없습니다.</div>`;
                } else {
                    listContentHtml = messages.map(msg => `
                        <div class="mobile-msg-item" data-id="${msg.id}" style="background: ${msg.isRead ? '#ffffff' : 'rgba(9, 132, 227, 0.02)'}; border: 1px solid ${msg.isRead ? 'rgba(0,0,0,0.05)' : 'rgba(9, 132, 227, 0.2)'}; border-radius: 10px; padding: 12px; margin-bottom: 10px; cursor: pointer; position: relative; box-shadow: 0 2px 6px rgba(0,0,0,0.01);">
                            ${!msg.isRead ? `<span style="position: absolute; top: 12px; left: 6px; width: 6px; height: 6px; background: var(--danger); border-radius: 50%;"></span>` : ''}
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-left: ${msg.isRead ? '0' : '8px'};">
                                <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;">${escapeHtml(msg.title)}</span>
                                <span style="font-size: 0.7rem; color: var(--text-muted);">${msg.date}</span>
                            </div>
                            <p style="margin: 0 0 6px 0; color: var(--text-muted); font-size: 0.78rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; padding-left: ${msg.isRead ? '0' : '8px'};">
                                ${escapeHtml(msg.content)}
                            </p>
                            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; padding-left: ${msg.isRead ? '0' : '8px'};">
                                <span>${msg.isRead ? '<span style="color: var(--text-muted);"><i class="fa-solid fa-envelope-open"></i> 읽음</span>' : '<span style="color: var(--danger); font-weight: bold;"><i class="fa-solid fa-envelope"></i> 읽지 않음</span>'}</span>
                                <span style="color: var(--text-muted);">자세히 <i class="fa-solid fa-chevron-right" style="font-size: 0.6rem;"></i></span>
                            </div>
                        </div>
                    `).join('');
                }
            } else if (communicationSubTab === 'surveys') {
                if (surveys.length === 0) {
                    listContentHtml = `<div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 0.85rem;">등록된 설문이 없습니다.</div>`;
                } else {
                    listContentHtml = surveys.map(surv => {
                        const hasAnswered = stateStore.hasStudentAnsweredSurvey(surv.id, studentId);
                        const statusBadge = hasAnswered 
                            ? `<span style="font-size: 0.68rem; background: var(--success-light); color: var(--success); padding: 1px 5px; border-radius: 4px; font-weight: bold;">완료</span>`
                            : `<span style="font-size: 0.68rem; background: var(--primary-light); color: var(--primary); padding: 1px 5px; border-radius: 4px; font-weight: bold;">참여 대기</span>`;

                        return `
                            <div class="mobile-surv-item" data-id="${surv.id}" style="background: #ffffff; border: 1px solid rgba(0,0,0,0.05); border-radius: 10px; padding: 12px; margin-bottom: 10px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.01);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;">${escapeHtml(surv.title)}</span>
                                    <span style="font-size: 0.7rem; color: var(--text-muted);">${surv.date}</span>
                                </div>
                                <p style="margin: 0 0 6px 0; color: var(--text-muted); font-size: 0.78rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                    ${escapeHtml(surv.description)}
                                </p>
                                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; align-items: center;">
                                    <span>${statusBadge}</span>
                                    <span style="color: var(--text-muted); font-weight: 500;">${hasAnswered ? '답변 조회' : '설문 참여'} <i class="fa-solid fa-chevron-right" style="font-size: 0.6rem;"></i></span>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }

            return `
                <div>
                    <!-- Mini Sub Tab Buttons -->
                    <div style="display: flex; gap: 6px; margin-bottom: 14px;">
                        <button class="mobile-comm-subtab-btn" data-subtab="announcements" style="flex:1; border: none; font-size: 0.75rem; font-weight: 700; padding: 6px 4px; border-radius: 15px; cursor: pointer; transition: all 0.2s; ${subAnnActive}">
                            공지사항
                        </button>
                        <button class="mobile-comm-subtab-btn" data-subtab="messages" style="flex:1; border: none; font-size: 0.75rem; font-weight: 700; padding: 6px 4px; border-radius: 15px; cursor: pointer; transition: all 0.2s; ${subMsgActive}">
                            개별 안내
                        </button>
                        <button class="mobile-comm-subtab-btn" data-subtab="surveys" style="flex:1; border: none; font-size: 0.75rem; font-weight: 700; padding: 6px 4px; border-radius: 15px; cursor: pointer; transition: all 0.2s; ${subSurvActive}">
                            설문
                        </button>
                    </div>

                    <!-- List Area -->
                    <div style="display: flex; flex-direction: column;">
                        ${listContentHtml}
                    </div>
                </div>
            `;
        }
    };

    const renderMockPaymentOverlay = (payment) => {
        if (!payment) return '';
        
        const onClickCancel = () => {
            showMockPaymentModal = false;
            render();
        };

        const onClickPay = (method) => {
            stateStore.payInvoice(payment.id, method);
            showMockPaymentModal = false;
            alert(`[납부 완료]\n${payment.amount.toLocaleString()}원이 모바일 ${method === 'toss' ? '토스페이' : '카카오페이'}로 안전하게 납부되었습니다.`);
            render();
        };

        window.parentMockCancel = onClickCancel;
        window.parentMockPay = onClickPay;

        return `
            <div id="parent-mock-payment-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(15, 23, 42, 0.4); z-index: 100; display: flex; flex-direction: column; justify-content: flex-end; animation: slideUpMobile 0.25s ease-out;">
                <div style="background: #ffffff; border-top: 1px solid var(--border-color); border-radius: 20px 20px 0 0; padding: 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 -8px 30px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; font-size: 1rem; color: var(--text-main);">안전 간편결제</span>
                        <button onclick="parentMockCancel()" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>

                    <div style="background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.06); padding: 12px; border-radius: 8px;">
                        <div style="font-size: 0.72rem; color: var(--text-muted);">수납 항목</div>
                        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
                            ${payment.type === 'education' ? '교육비(수강료)' : '교재비'}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">결제 금액</div>
                        <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">
                            ${payment.amount.toLocaleString()}원
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="parentMockPay('toss')" style="background: #0050ff; border: none; border-radius: 10px; padding: 12px; color: white; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; height: 44px;">
                            <i class="fa-solid fa-wallet"></i> 토스페이로 결제
                        </button>
                        <button onclick="parentMockPay('kakao')" style="background: #fee500; border: none; border-radius: 10px; padding: 12px; color: #191919; font-weight: 700; font-size: 0.88rem; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; height: 44px;">
                            <i class="fa-solid fa-comment" style="color: #191919;"></i> 카카오페이로 결제
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes slideUpMobile {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            </style>
        `;
    };

    const renderAnnouncementOverlay = (ann) => {
        if (!ann) return '';
        window.closeAnnOverlay = () => {
            viewingAnnouncementId = null;
            render();
        };
        return `
            <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: #ffffff; z-index: 100; display: flex; flex-direction: column; animation: slideUpMobile 0.25s ease-out;">
                <div style="background: linear-gradient(135deg, #0984e3, #74b9ff); padding: 14px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <span style="color: white; font-weight: bold; font-size: 0.9rem;">공지사항 상세</span>
                    <button onclick="closeAnnOverlay()" style="background: none; border: none; color: white; font-size: 1.4rem; cursor: pointer; line-height: 1;">&times;</button>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 16px;">
                    <h4 style="margin: 0 0 6px 0; font-weight: 800; font-size: 1.05rem; color: var(--text-main); line-height: 1.35;">${escapeHtml(ann.title)}</h4>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 8px;">
                        작성일: ${ann.date} | 조회: ${ann.views || 0}회
                    </div>
                    <div style="font-size: 0.85rem; line-height: 1.6; color: var(--text-main); white-space: pre-wrap; word-break: break-all;">${escapeHtml(ann.content)}</div>
                </div>
            </div>
        `;
    };

    const renderMessageOverlay = (msg) => {
        if (!msg) return '';
        window.closeMsgOverlay = () => {
            viewingMessageId = null;
            render();
        };
        return `
            <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: #ffffff; z-index: 100; display: flex; flex-direction: column; animation: slideUpMobile 0.25s ease-out;">
                <div style="background: linear-gradient(135deg, #0984e3, #74b9ff); padding: 14px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <span style="color: white; font-weight: bold; font-size: 0.9rem;">개별 안내</span>
                    <button onclick="closeMsgOverlay()" style="background: none; border: none; color: white; font-size: 1.4rem; cursor: pointer; line-height: 1;">&times;</button>
                </div>
                <div style="flex: 1; overflow-y: auto; padding: 16px;">
                    <h4 style="margin: 0 0 6px 0; font-weight: 800; font-size: 1.05rem; color: var(--text-main); line-height: 1.35;">${escapeHtml(msg.title)}</h4>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 8px;">
                        발송일: ${msg.date}
                    </div>
                    <div style="font-size: 0.85rem; line-height: 1.6; color: var(--text-main); white-space: pre-wrap; word-break: break-all;">${escapeHtml(msg.content)}</div>
                </div>
            </div>
        `;
    };

    const renderSurveyOverlay = (surv) => {
        if (!surv) return '';
        const hasAnswered = stateStore.hasStudentAnsweredSurvey(surv.id, studentId);
        
        window.closeSurvOverlay = () => {
            answeringSurveyId = null;
            render();
        };

        window.submitMobileSurvey = () => {
            const form = container.querySelector('#mobile-survey-form');
            if (!form) return;
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

            // Validate that choice questions are answered
            let valid = true;
            surv.questions.forEach(q => {
                if (q.type === 'choice' && !answers[q.id]) {
                    valid = false;
                }
            });

            if (!valid) {
                alert('모든 필수 항목(객관식 문항)에 답변해주세요.');
                return;
            }

            stateStore.submitSurveyResponse(surv.id, studentId, answers);
            alert('설문 답변이 성공적으로 제출되었습니다.');
            answeringSurveyId = null;
            render();
        };

        let questionsHtml = '';
        if (hasAnswered) {
            const responses = stateStore.getSurveyResponses(surv.id);
            const myResp = responses.find(r => r.studentId === studentId);
            const myAnswers = myResp ? myResp.answers : {};

            questionsHtml = surv.questions.map((q, idx) => {
                const answer = myAnswers[q.id] || '(답변 없음)';
                return `
                    <div style="background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.06); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                        <span style="font-size: 0.65rem; color: var(--primary); font-weight: bold; display: block; margin-bottom: 2px;">Q${idx + 1}. ${q.type === 'choice' ? '객관식' : '주관식'}</span>
                        <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-main); margin-bottom: 6px;">${escapeHtml(q.questionText)}</div>
                        <div style="background: #ffffff; padding: 8px; border-radius: 6px; border: 1px solid rgba(9, 132, 227, 0.15); font-size: 0.78rem; font-weight: 600; color: var(--primary);">
                            ${escapeHtml(answer)}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: #ffffff; z-index: 100; display: flex; flex-direction: column; animation: slideUpMobile 0.25s ease-out;">
                    <div style="background: linear-gradient(135deg, #0984e3, #74b9ff); padding: 14px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <span style="color: white; font-weight: bold; font-size: 0.9rem;">설문 제출 확인</span>
                        <button onclick="closeSurvOverlay()" style="background: none; border: none; color: white; font-size: 1.4rem; cursor: pointer; line-height: 1;">&times;</button>
                    </div>
                    <div style="flex: 1; overflow-y: auto; padding: 16px;">
                        <div style="background: rgba(46, 204, 113, 0.06); border: 1px solid var(--success); padding: 8px 10px; border-radius: 8px; margin-bottom: 12px; text-align: center; color: #27ae60; font-weight: bold; font-size: 0.75rem;">
                            <i class="fa-solid fa-circle-check"></i> 설문 응답 제출이 완료되었습니다.
                        </div>
                        <h4 style="margin: 0 0 4px 0; font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(surv.title)}</h4>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 14px 0; line-height: 1.35;">${escapeHtml(surv.description)}</p>
                        <div>
                            ${questionsHtml}
                        </div>
                    </div>
                </div>
            `;
        } else {
            questionsHtml = surv.questions.map((q, idx) => {
                if (q.type === 'choice') {
                    const radios = q.options.map(opt => `
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; cursor: pointer; padding: 4px 0;">
                            <input type="radio" name="question_${q.id}" value="${opt}" required style="accent-color: var(--primary);">
                            <span>${escapeHtml(opt)}</span>
                        </label>
                    `).join('');
                    
                    return `
                        <div style="background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                            <span style="font-size: 0.65rem; color: var(--primary); font-weight: bold; display: block; margin-bottom: 2px;">Q${idx + 1}. 객관식</span>
                            <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-main); margin-bottom: 6px;">${escapeHtml(q.questionText)}</div>
                            <div style="display: flex; flex-direction: column;">
                                ${radios}
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div style="background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                            <span style="font-size: 0.65rem; color: var(--primary); font-weight: bold; display: block; margin-bottom: 2px;">Q${idx + 1}. 주관식</span>
                            <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-main); margin-bottom: 6px;">${escapeHtml(q.questionText)}</div>
                            <textarea name="question_${q.id}" class="form-control" rows="2" placeholder="답변을 작성해주세요." required style="resize: none; font-family: inherit; font-size: 0.78rem; padding: 6px;"></textarea>
                        </div>
                    `;
                }
            }).join('');

            return `
                <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: #ffffff; z-index: 100; display: flex; flex-direction: column; animation: slideUpMobile 0.25s ease-out;">
                    <div style="background: linear-gradient(135deg, #0984e3, #74b9ff); padding: 14px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                        <span style="color: white; font-weight: bold; font-size: 0.9rem;">설문 참여</span>
                        <button onclick="closeSurvOverlay()" style="background: none; border: none; color: white; font-size: 1.4rem; cursor: pointer; line-height: 1;">&times;</button>
                    </div>
                    <div style="flex: 1; overflow-y: auto; padding: 16px;">
                        <h4 style="margin: 0 0 4px 0; font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(surv.title)}</h4>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 14px 0; line-height: 1.35;">${escapeHtml(surv.description)}</p>
                        <form id="mobile-survey-form">
                            ${questionsHtml}
                        </form>
                    </div>
                    <div style="padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: #ffffff; border-top: 1px solid rgba(0,0,0,0.06); display: flex; gap: 8px; flex-shrink: 0; position: relative;">
                        <button onclick="closeSurvOverlay()" style="flex: 1; border: 1px solid var(--border-color); background: #ffffff; color: var(--text-muted); border-radius: 8px; font-weight: 700; height: 38px; font-size: 0.8rem; cursor: pointer;">취소</button>
                        <button onclick="submitMobileSurvey()" style="flex: 2; border: none; background: var(--primary); color: white; border-radius: 8px; font-weight: 700; height: 38px; font-size: 0.8rem; cursor: pointer;">답변 제출하기 🚀</button>
                    </div>
                </div>
            `;
        }
    };

    render();

    // Auto-reactive rendering using Pub/Sub with auto-cleanup when container is disconnected from DOM
    const unsubAnn = stateStore.subscribe('ANNOUNCEMENTS_CHANGED', () => {
        if (!container.isConnected) { unsubAnn(); return; }
        render();
    });
    const unsubMsg = stateStore.subscribe('MESSAGES_CHANGED', () => {
        if (!container.isConnected) { unsubMsg(); return; }
        render();
    });
    const unsubSurv = stateStore.subscribe('SURVEYS_CHANGED', () => {
        if (!container.isConnected) { unsubSurv(); return; }
        render();
    });
    const unsubResp = stateStore.subscribe('SURVEY_RESPONSES_CHANGED', () => {
        if (!container.isConnected) { unsubResp(); return; }
        render();
    });
    const unsubPay = stateStore.subscribe('PAYMENTS_CHANGED', () => {
        if (!container.isConnected) { unsubPay(); return; }
        render();
    });
}
