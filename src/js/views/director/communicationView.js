import { stateStore } from '../../state.js';
import { openModal, closeModal } from '../../app.js';
import { formatPhoneNumber, showKakaoTalkToast, showLocalConfirm } from './shared.js';


export function renderCommunication(container) {
    let activeSubTab = 'announcements'; // 'announcements', 'messages', 'surveys'
    let annQuery = '', msgQuery = '', survQuery = '';
    let annPage = 1, msgPage = 1, survPage = 1;
    const itemsPerPage = 10;

    const render = () => {
        const tabSettings = stateStore.getSettings()?.parentCommunicationTabSettings || {};
        const isAnnOff = tabSettings.announcements?.enabled === false;
        const isSurvOff = tabSettings.surveys?.enabled === false;
        const isMsgOff = tabSettings.messages?.enabled === false;

        const offBadge = `<span class="badge-tab-off" style="font-size: 10px; padding: 2px 6px; background: #fee2e2; color: #ef4444; border-radius: 4px; margin-left: 6px; font-weight: 800; border: 1px solid #fecaca; display: inline-block; vertical-align: middle;">학부모 화면 숨김</span>`;

        container.innerHTML = `
            <div class="glass-card" style="padding: 1.8rem; min-height: 500px;">
                <!-- Tab Menu Header -->
                <div style="display: flex; gap: 10px; margin-bottom: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; flex-wrap: wrap;">
                    <button class="btn ${activeSubTab === 'announcements' ? 'btn-primary' : 'btn-secondary'}" id="tab-comm-ann" style="border-radius: 20px; font-weight: 700; padding: 8px 16px; display: inline-flex; align-items: center;">
                        <i class="fa-solid fa-bullhorn" style="margin-right: 4px;"></i> 공지사항 관리
                        ${isAnnOff ? offBadge : ''}
                    </button>
                    <button class="btn ${activeSubTab === 'surveys' ? 'btn-primary' : 'btn-secondary'}" id="tab-comm-surv" style="border-radius: 20px; font-weight: 700; padding: 8px 16px; display: inline-flex; align-items: center;">
                        <i class="fa-solid fa-square-poll-vertical" style="margin-right: 4px;"></i> 설문조사 시스템
                        ${isSurvOff ? offBadge : ''}
                    </button>
                    <button class="btn ${activeSubTab === 'messages' ? 'btn-primary' : 'btn-secondary'}" id="tab-comm-msg" style="border-radius: 20px; font-weight: 700; padding: 8px 16px; display: inline-flex; align-items: center;">
                        <i class="fa-solid fa-envelope" style="margin-right: 4px;"></i> 안내사항 관리
                        ${isMsgOff ? offBadge : ''}
                    </button>
                </div>

                <!-- Sub-tab Content Area -->
                <div id="communication-subtab-content"></div>
            </div>
        `;

        // Bind tab events
        container.querySelector('#tab-comm-ann').addEventListener('click', () => {
            activeSubTab = 'announcements';
            render();
        });
        container.querySelector('#tab-comm-msg').addEventListener('click', () => {
            activeSubTab = 'messages';
            render();
        });
        container.querySelector('#tab-comm-surv').addEventListener('click', () => {
            activeSubTab = 'surveys';
            render();
        });

        const subContainer = container.querySelector('#communication-subtab-content');
        if (activeSubTab === 'announcements') renderAnnouncementsTab(subContainer);
        else if (activeSubTab === 'messages') renderMessagesTab(subContainer);
        else if (activeSubTab === 'surveys') renderSurveysTab(subContainer);
    };

    const renderAnnouncementsTab = (tabContainer) => {
        const tabSettings = stateStore.getSettings()?.parentCommunicationTabSettings || {};
        const isAnnOff = tabSettings.announcements?.enabled === false;

        tabContainer.innerHTML = `
            ${isAnnOff ? `
            <div class="alert-info-banner" style="padding: 12px 16px; background: #fff8eb; border: 1px solid #fce3b5; border-radius: 10px; display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning, #d97706); font-size: 1rem;"></i>
                <span style="font-size: 0.85rem; color: #92610f; font-weight: 600;">현재 학부모 화면에는 표시되지 않습니다. 학원정보관리에서 ON으로 변경할 수 있습니다.</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-bullhorn" style="color: var(--primary);"></i> 학원 공지사항
                </h3>
                <button class="btn btn-primary btn-sm" id="btn-write-announcement" style="font-weight: 700; height: 36px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-pen-nib"></i> 신규 공지 작성
                </button>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">학원 전체 원생/학부모를 대상으로 공지사항을 등록하고 조회수를 모니터링합니다.</p>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
            <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                <div style="position: relative; max-width: 320px; margin: 0;">
                    <input type="text" id="ann-search-input" class="form-control" placeholder="공지 제목 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${annQuery}">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                </div>
            </div>
            <div class="table-wrapper" style="margin-top: 0;">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">번호</th>
                            <th>제목</th>
                            <th style="width: 140px;">작성일</th>
                            <th style="width: 100px; text-align: center;">조회수</th>
                            <th style="width: 100px; text-align: right;">관리</th>
                        </tr>
                    </thead>
                    <tbody id="ann-table-body"></tbody>
                </table>
            </div>
            <div id="ann-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
        `;

        const searchInput = tabContainer.querySelector('#ann-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                annQuery = e.target.value;
                annPage = 1;
                renderTable();
            });
        }
        tabContainer.querySelector('#btn-write-announcement').addEventListener('click', openWriteAnnouncementModal);

        const renderTable = () => {
            const tbody = tabContainer.querySelector('#ann-table-body');
            const paginator = tabContainer.querySelector('#ann-pagination');
            if (!tbody) return;

            const allAnn = stateStore.getAnnouncements().sort((a, b) => {
                const timeA = a.created_at || a.date || '';
                const timeB = b.created_at || b.date || '';
                const dateCompare = timeB.localeCompare(timeA);
                if (dateCompare !== 0) return dateCompare;
                const idA = parseInt(a.id.replace(/[^\d]/g, ''), 10) || 0;
                const idB = parseInt(b.id.replace(/[^\d]/g, ''), 10) || 0;
                return idB - idA;
            });
            const filtered = allAnn.filter(a => !annQuery || a.title.toLowerCase().includes(annQuery.toLowerCase()));

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">등록된 공지사항이 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (annPage - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map((ann, idx) => `
                <tr>
                    <td style="text-align: center; font-size: 0.9rem;">${startIdx + idx + 1}</td>
                    <td style="font-size: 0.9rem; font-weight: 600;">
                        <span class="ann-title-link" data-id="${ann.id}" style="color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${escapeHtml(ann.title)}</span>
                    </td>
                    <td style="font-size: 0.85rem; text-align: center;">${ann.date}</td>
                    <td style="text-align: center; font-size: 0.85rem;"><span style="font-weight: 700; color: var(--primary);">${ann.views || 0}회</span></td>
                    <td style="text-align: right;">
                        <button class="btn btn-danger btn-sm btn-delete-ann" data-id="${ann.id}" style="padding: 4px 8px; font-size: 0.75rem;">
                            <i class="fa-solid fa-trash"></i> 삭제
                        </button>
                    </td>
                </tr>
            `).join('');

            tbody.querySelectorAll('.ann-title-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const ann = stateStore.getAnnouncements().find(a => a.id === id);
                    if (ann) {
                        openAnnouncementDetailModal(ann);
                    }
                });
            });

            tbody.querySelectorAll('.btn-delete-ann').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (confirm('해당 공지사항을 정말 삭제하시겠습니까?')) {
                        stateStore.deleteAnnouncement(id);
                    }
                });
            });

            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-ann-prev" ${annPage === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${annPage === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-ann-next" ${annPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    annPage = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-ann-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (annPage > 1) { annPage--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-ann-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (annPage < totalPages) { annPage++; renderTable(); } });
        };

        renderTable();
    };

    const renderMessagesTab = (tabContainer) => {
        const students = stateStore.getStudents();
        const tabSettings = stateStore.getSettings()?.parentCommunicationTabSettings || {};
        const isMsgOff = tabSettings.messages?.enabled === false;

        tabContainer.innerHTML = `
            ${isMsgOff ? `
            <div class="alert-info-banner" style="padding: 12px 16px; background: #fff8eb; border: 1px solid #fce3b5; border-radius: 10px; display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning, #d97706); font-size: 1rem;"></i>
                <span style="font-size: 0.85rem; color: #92610f; font-weight: 600;">현재 학부모 화면에는 표시되지 않습니다. 학원정보관리에서 ON으로 변경할 수 있습니다.</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-envelope" style="color: var(--primary);"></i> 개별 안내장 및 메시지 발송 목록
                </h3>
                <button class="btn btn-primary btn-sm" id="btn-write-message" style="font-weight: 700; height: 36px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-paper-plane"></i> 개별 안내장 발송
                </button>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">특정 원생의 학부모에게 개별 알림이나 일지를 안전하게 전송합니다.</p>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
            <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                <div style="position: relative; max-width: 320px; margin: 0;">
                    <input type="text" id="msg-search-input" class="form-control" placeholder="수신 원생 또는 제목 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${msgQuery}">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                </div>
            </div>
            <div class="table-wrapper" style="margin-top: 0;">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th style="width: 120px;">수신 원생</th>
                            <th>메시지 제목 및 요약</th>
                            <th style="width: 140px;">발송 일시</th>
                            <th style="width: 100px;">학부모 열람</th>
                            <th style="width: 100px; text-align: right;">관리</th>
                        </tr>
                    </thead>
                    <tbody id="msg-table-body"></tbody>
                </table>
            </div>
            <div id="msg-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
        `;

        const searchInput = tabContainer.querySelector('#msg-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                msgQuery = e.target.value;
                msgPage = 1;
                renderTable();
            });
        }
        tabContainer.querySelector('#btn-write-message').addEventListener('click', () => openWriteMessageModal(students));

        const renderTable = () => {
            const tbody = tabContainer.querySelector('#msg-table-body');
            const paginator = tabContainer.querySelector('#msg-pagination');
            if (!tbody) return;

            const allMsg = stateStore.getMessages().sort((a, b) => {
                const timeA = a.created_at || a.date || '';
                const timeB = b.created_at || b.date || '';
                const dateCompare = timeB.localeCompare(timeA);
                if (dateCompare !== 0) return dateCompare;
                const idA = parseInt(a.id.replace(/[^\d]/g, ''), 10) || 0;
                const idB = parseInt(b.id.replace(/[^\d]/g, ''), 10) || 0;
                return idB - idA;
            });
            const filtered = allMsg.filter(msg => {
                const s = students.find(stud => stud.id === msg.studentId);
                const sName = s ? s.name : '';
                return !msgQuery || sName.toLowerCase().includes(msgQuery.toLowerCase()) || msg.title.toLowerCase().includes(msgQuery.toLowerCase());
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">발송된 개별 안내장이 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (msgPage - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map(msg => {
                const student = students.find(s => s.id === msg.studentId);
                const readBadge = msg.isRead 
                    ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 읽음</span>`
                    : `<span class="badge badge-warning" style="background: var(--danger); color: white;"><i class="fa-solid fa-circle-exclamation"></i> 안읽음</span>`;
                
                return `
                    <tr>
                        <td style="font-size: 0.9rem;"><strong>${student ? student.name : '알 수 없음'}</strong></td>
                        <td style="font-size: 0.9rem;">
                            <span class="msg-title-link" data-id="${msg.id}" style="color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700; display: block; margin-bottom: 2px;">${escapeHtml(msg.title)}</span>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 0 0; max-width: 500px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(msg.content)}
                            </p>
                        </td>
                        <td style="font-size: 0.85rem; text-align: center;">${msg.date}</td>
                        <td style="text-align: center;">${readBadge}</td>
                        <td style="text-align: right;">
                            <button class="btn btn-danger btn-sm btn-delete-msg" data-id="${msg.id}" style="padding: 4px 8px; font-size: 0.75rem;">
                                <i class="fa-solid fa-trash"></i> 삭제
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.msg-title-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const msg = stateStore.getMessages().find(m => m.id === id);
                    if (msg) {
                        openMessageDetailModal(msg, students);
                    }
                });
            });

            tbody.querySelectorAll('.btn-delete-msg').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (confirm('해당 메시지를 정말 삭제하시겠습니까?')) {
                        stateStore.deleteMessage(id);
                    }
                });
            });

            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-msg-prev" ${msgPage === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${msgPage === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-msg-next" ${msgPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    msgPage = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-msg-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (msgPage > 1) { msgPage--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-msg-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (msgPage < totalPages) { msgPage++; renderTable(); } });
        };

        renderTable();
    };

    const renderSurveysTab = (tabContainer) => {
        const tabSettings = stateStore.getSettings()?.parentCommunicationTabSettings || {};
        const isSurvOff = tabSettings.surveys?.enabled === false;

        tabContainer.innerHTML = `
            ${isSurvOff ? `
            <div class="alert-info-banner" style="padding: 12px 16px; background: #fff8eb; border: 1px solid #fce3b5; border-radius: 10px; display: flex; gap: 8px; align-items: center; margin-bottom: 16px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning, #d97706); font-size: 1rem;"></i>
                <span style="font-size: 0.85rem; color: #92610f; font-weight: 600;">현재 학부모 화면에는 표시되지 않습니다. 학원정보관리에서 ON으로 변경할 수 있습니다.</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-square-poll-vertical" style="color: var(--primary);"></i> 학부모 설문조사 시스템
                </h3>
                <button class="btn btn-primary btn-sm" id="btn-create-survey" style="font-weight: 700; height: 36px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-square-plus"></i> 신규 설문지 만들기
                </button>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">학원 일정, 연주회 참가 여부 등 학부모 의견을 수집하고 분석합니다.</p>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
            <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                <div style="position: relative; max-width: 320px; margin: 0;">
                    <input type="text" id="surv-search-input" class="form-control" placeholder="설문 제목 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${survQuery}">
                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                </div>
            </div>
            <div class="table-wrapper" style="margin-top: 0;">
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>설문 제목</th>
                            <th style="width: 140px;">배포일</th>
                            <th style="width: 100px;">상태</th>
                            <th style="width: 180px;">응답 비율 (참여/전체)</th>
                            <th style="width: 180px; text-align: right; white-space: nowrap;">관리</th>
                        </tr>
                    </thead>
                    <tbody id="surv-table-body"></tbody>
                </table>
            </div>
            <div id="surv-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
        `;

        const searchInput = tabContainer.querySelector('#surv-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                survQuery = e.target.value;
                survPage = 1;
                renderTable();
            });
        }
        tabContainer.querySelector('#btn-create-survey').addEventListener('click', openCreateSurveyModal);

        const renderTable = () => {
            const tbody = tabContainer.querySelector('#surv-table-body');
            const paginator = tabContainer.querySelector('#surv-pagination');
            if (!tbody) return;

            const allSurv = stateStore.getSurveys().sort((a, b) => {
                const timeA = a.created_at || a.date || '';
                const timeB = b.created_at || b.date || '';
                const dateCompare = timeB.localeCompare(timeA);
                if (dateCompare !== 0) return dateCompare;
                const idA = parseInt(a.id.replace(/[^\d]/g, ''), 10) || 0;
                const idB = parseInt(b.id.replace(/[^\d]/g, ''), 10) || 0;
                return idB - idA;
            });
            const filtered = allSurv.filter(surv => !survQuery || surv.title.toLowerCase().includes(survQuery.toLowerCase()));
            const students = stateStore.getStudents();

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">등록된 설문지가 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (survPage - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map(surv => {
                const responses = stateStore.getSurveyResponses(surv.id);
                const totalStudents = students.length;
                const ratePercent = totalStudents > 0 ? Math.round((responses.length / totalStudents) * 100) : 0;
                
                return `
                    <tr>
                        <td style="font-size: 0.9rem;">
                            <span class="surv-title-link" data-id="${surv.id}" style="color: var(--secondary); cursor: pointer; text-decoration: underline; font-weight: 700;">${escapeHtml(surv.title)}</span>
                        </td>
                        <td style="font-size: 0.85rem; text-align: center;">${surv.date}</td>
                        <td style="text-align: center;">
                            <span class="badge ${surv.isActive ? 'badge-success' : 'badge-info'}" style="${surv.isActive ? '' : 'background: #bdc3c7; color: white;'}">
                                ${surv.isActive ? '진행 중' : '종료'}
                            </span>
                        </td>
                        <td style="text-align: center; font-size: 0.85rem;">
                            <strong style="color: var(--primary);">${responses.length} / ${totalStudents}명</strong> (${ratePercent}%)
                        </td>
                        <td style="text-align: right; white-space: nowrap;">
                            <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: nowrap;">
                                <button class="btn btn-secondary btn-sm btn-view-survey-stats" data-id="${surv.id}" style="padding: 4px 8px; font-size: 0.75rem; white-space: nowrap;">
                                    <i class="fa-solid fa-chart-bar"></i> 통계 분석
                                </button>
                                <button class="btn btn-danger btn-sm btn-delete-survey" data-id="${surv.id}" style="padding: 4px 8px; font-size: 0.75rem; white-space: nowrap;">
                                    <i class="fa-solid fa-trash"></i> 삭제
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.querySelectorAll('.surv-title-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    const surv = stateStore.getSurveys().find(s => s.id === id);
                    if (surv) {
                        openSurveyDetailModal(surv);
                    }
                });
            });

            tbody.querySelectorAll('.btn-view-survey-stats').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    openSurveyStatsModal(id, students);
                });
            });

            tbody.querySelectorAll('.btn-delete-survey').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (confirm('설문지 및 모든 답변 데이터를 정말 삭제하시겠습니까?')) {
                        stateStore.deleteSurvey(id);
                    }
                });
            });

            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-surv-prev" ${survPage === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${survPage === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-surv-next" ${survPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    survPage = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-surv-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (survPage > 1) { survPage--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-surv-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (survPage < totalPages) { survPage++; renderTable(); } });
        };

        renderTable();
    };

    const openWriteAnnouncementModal = () => {
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">학원 전체 공지사항 배포</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <form id="form-create-announcement">
                    <div class="form-group">
                        <label for="ann-title">공지 제목</label>
                        <input type="text" id="ann-title" class="form-control" placeholder="학부모 전체 공지 제목을 기입해주세요." required>
                    </div>
                    <div class="form-group">
                        <label for="ann-content">공지 내용</label>
                        <textarea id="ann-content" class="form-control" rows="8" placeholder="학부모 공지 상세 안내문을 작성해주세요." required style="resize: none; font-family: inherit; line-height: 1.5;"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" form="form-create-announcement" class="btn btn-primary">공지사항 발행</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const form = modalArea.querySelector('#form-create-announcement');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = form.querySelector('#ann-title').value.trim();
                const content = form.querySelector('#ann-content').value.trim();
                
                if (title && content) {
                    showLocalConfirm(modalArea, "공지사항을 발행하시겠습니까?", () => {
                        stateStore.addAnnouncement(title, content);
                        closeModal();
                        showKakaoTalkToast("공지사항이 발행되었습니다.");
                    });
                }
            });
        });
    };

    const openWriteMessageModal = (students) => {
        const studentOptions = students.map(s => `<option value="${s.id}">${s.name} (${s.instrument} | 학부모: ${s.parentPhone})</option>`).join('');
        
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">학부모 개별 안내장 발송</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <form id="form-create-message">
                    <div class="form-group">
                        <label for="msg-student-id">대상 수강생 선택</label>
                        <select id="msg-student-id" class="form-control" required>
                            <option value="">-- 대상 원생을 고르세요 --</option>
                            ${studentOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="msg-title">안내장 제목</label>
                        <input type="text" id="msg-title" class="form-control" placeholder="개별 안내장 제목을 입력하세요." required>
                    </div>
                    <div class="form-group">
                        <label for="msg-content">안내 및 전언 내용</label>
                        <textarea id="msg-content" class="form-control" rows="6" placeholder="학부모님께 개별 전송할 구체적인 내용 및 피드백을 전달해주세요." required style="resize: none; font-family: inherit; line-height: 1.5;"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" form="form-create-message" class="btn btn-primary">안내장 발송하기</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const form = modalArea.querySelector('#form-create-message');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const studentId = form.querySelector('#msg-student-id').value;
                const title = form.querySelector('#msg-title').value.trim();
                const content = form.querySelector('#msg-content').value.trim();
                
                if (studentId && title && content) {
                    showLocalConfirm(modalArea, "공지사항을 발행하시겠습니까?", () => {
                        stateStore.addMessage(studentId, title, content);
                        closeModal();
                        showKakaoTalkToast("안내장이 발송되었습니다.");
                    });
                }
            });
        });
    };

    const openCreateSurveyModal = () => {
        let tempQuestions = [];

        const updateTempQuestionsUI = (modalArea) => {
            const container = modalArea.querySelector('#modal-survey-questions-list');
            if (tempQuestions.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-sm);">추가된 문항이 없습니다. [+ 질문 추가] 버튼으로 문항을 생성해주세요.</div>`;
                return;
            }

            container.innerHTML = tempQuestions.map((q, idx) => {
                const typeText = q.type === 'choice' ? '객관식 선택' : '주관식 단답';
                const optsText = q.type === 'choice' ? `<div style="font-size: 0.8rem; color: var(--secondary); margin-top: 4px;"><strong>선택 옵션:</strong> ${q.options.join(', ')}</div>` : '';
                
                return `
                    <div style="background: rgba(9, 132, 227, 0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: flex-start; justify-content: space-between;">
                        <div>
                            <span class="badge badge-info" style="font-size: 0.65rem; margin-bottom: 4px;">문항 ${idx + 1} (${typeText})</span>
                            <div style="font-weight: bold; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(q.questionText)}</div>
                            ${optsText}
                        </div>
                        <button type="button" class="btn-delete-temp-q" data-index="${idx}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.9rem;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.btn-delete-temp-q').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    tempQuestions.splice(idx, 1);
                    updateTempQuestionsUI(modalArea);
                });
            });
        };

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">신규 설문지 만들기</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px; max-height: 60vh; overflow-y: auto;">
                <form id="form-create-survey">
                    <div class="form-group">
                        <label for="surv-title">설문 조사 제목</label>
                        <input type="text" id="surv-title" class="form-control" placeholder="예: 2026 연주회 만족도 피드백 설문" required>
                    </div>
                    <div class="form-group">
                        <label for="surv-desc">설문 설명문</label>
                        <textarea id="surv-desc" class="form-control" rows="3" placeholder="학부모님들께 설문 목적과 기한 등을 간략히 소개해주세요." required style="resize: none; font-family: inherit; line-height: 1.4;"></textarea>
                    </div>
                    
                    <div style="margin-top: 1.5rem; margin-bottom: 1rem;">
                        <label style="font-weight: bold; font-size: 0.85rem; color: var(--text-main); display: block; margin-bottom: 8px;">문항 추가 리스트</label>
                        <div id="modal-survey-questions-list"></div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-top: 1.5rem;">
                        <label style="font-weight: 700; font-size: 0.85rem; color: var(--primary); display: block; margin-bottom: 8px;"><i class="fa-solid fa-plus-circle"></i> 문항 추가 폼</label>
                        
                        <div class="form-group">
                            <input type="text" id="temp-q-text" class="form-control" placeholder="질문 내용을 입력하세요." style="font-size:0.85rem; padding:8px 12px;">
                        </div>
                        <div class="form-row" style="grid-template-columns: 1fr 1fr; margin-bottom: 10px;">
                            <div class="form-group" style="margin-bottom:0;">
                                <label style="font-size:0.75rem;">문항 유형</label>
                                <select id="temp-q-type" class="form-control" style="font-size:0.85rem; padding:8px;">
                                    <option value="choice">객관식 (단일 선택)</option>
                                    <option value="text">주관식 (서술 답변)</option>
                                </select>
                            </div>
                            <div class="form-group" style="margin-bottom:0;" id="temp-q-opts-wrapper">
                                <label style="font-size:0.75rem;">객관식 옵션 (쉼표로 구분)</label>
                                <input type="text" id="temp-q-options" class="form-control" placeholder="예: 참석, 불참, 미정" style="font-size:0.85rem; padding:8px 12px;">
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary" id="btn-add-q-to-temp" style="width: 100%; justify-content: center; font-size: 0.8rem; padding: 6px 10px;">
                            <i class="fa-solid fa-plus"></i> 질문 문항 목록에 추가
                        </button>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>취소</button>
                <button type="submit" form="form-create-survey" class="btn btn-primary">설문지 배포하기</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const form = modalArea.querySelector('#form-create-survey');
            const qTypeSelect = modalArea.querySelector('#temp-q-type');
            const qOptsWrapper = modalArea.querySelector('#temp-q-opts-wrapper');
            const btnAddQ = modalArea.querySelector('#btn-add-q-to-temp');
            
            qTypeSelect.addEventListener('change', () => {
                if (qTypeSelect.value === 'choice') {
                    qOptsWrapper.style.display = 'block';
                } else {
                    qOptsWrapper.style.display = 'none';
                }
            });

            updateTempQuestionsUI(modalArea);

            btnAddQ.addEventListener('click', () => {
                const qText = modalArea.querySelector('#temp-q-text').value.trim();
                const qType = qTypeSelect.value;
                let options = [];

                if (!qText) {
                    alert('질문 내용을 기입해주세요.');
                    return;
                }

                if (qType === 'choice') {
                    const rawOptions = modalArea.querySelector('#temp-q-options').value;
                    options = rawOptions.split(',').map(o => o.trim()).filter(Boolean);
                    if (options.length === 0) {
                        alert('객관식 문항일 경우 쉼표로 구분하여 최소 1개 이상의 옵션을 적어주세요.');
                        return;
                    }
                }

                const newQId = 'Q' + (tempQuestions.length + 1);
                tempQuestions.push({ id: newQId, type: qType, questionText: qText, options });

                // Reset fields
                modalArea.querySelector('#temp-q-text').value = '';
                modalArea.querySelector('#temp-q-options').value = '';

                // Redraw temp list
                updateTempQuestionsUI(modalArea);
            });

            // Submit form
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = form.querySelector('#surv-title').value.trim();
                const desc = form.querySelector('#surv-desc').value.trim();

                if (tempQuestions.length === 0) {
                    alert('최소 1개 이상의 질문 문항을 설계해야 설문 배포가 가능합니다.');
                    return;
                }

                showLocalConfirm(modalArea, "공지사항을 발행하시겠습니까?", () => {
                    stateStore.addSurvey(title, desc, tempQuestions);
                    closeModal();
                    showKakaoTalkToast("설문조사가 배포되었습니다.");
                });
            });
        });
    };

    // Show survey statistics modal
    const openSurveyStatsModal = (surveyId, students) => {
        const survey = stateStore.getSurvey(surveyId);
        if (!survey) return;

        const responses = stateStore.getSurveyResponses(surveyId);
        const totalRespCount = responses.length;

        // Compile statistics for each question
        let statsHtml = '';
        survey.questions.forEach((q, idx) => {
            let qStatsContent = '';
            
            if (q.type === 'choice') {
                // Initialize option counts
                const optionCounts = {};
                q.options.forEach(opt => { optionCounts[opt] = 0; });
                
                // Accumulate choices
                responses.forEach(r => {
                    const ansVal = r.answers[q.id];
                    if (ansVal !== undefined && optionCounts[ansVal] !== undefined) {
                        optionCounts[ansVal]++;
                    }
                });

                // Ratios html bar
                qStatsContent = q.options.map(opt => {
                    const count = optionCounts[opt];
                    const percent = totalRespCount > 0 ? Math.round((count / totalRespCount) * 100) : 0;
                    return `
                        <div style="margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                                <span style="font-weight: 600; color: var(--text-main);">${opt}</span>
                                <span style="color: var(--text-muted); font-weight: bold;">${count}표 (${percent}%)</span>
                            </div>
                            <div style="width: 100%; height: 12px; background: rgba(9, 132, 227, 0.04); border-radius: 6px; overflow: hidden;">
                                <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 6px;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                // List text answers
                const textAnswers = responses
                    .map(r => {
                        const stdName = students.find(s => s.id === r.studentId)?.name || '알 수 없음';
                        const ans = r.answers[q.id] || '(답변 없음)';
                        return `
                            <div style="padding: 10px; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem;">
                                <span style="font-weight: 700; color: var(--primary); display: block; margin-bottom: 2px;">${stdName} 학부모</span>
                                <p style="margin: 0; color: var(--text-main); line-height: 1.4; white-space: pre-wrap;">${escapeHtml(ans)}</p>
                            </div>
                        `;
                    })
                    .join('');
                
                qStatsContent = `
                    <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 220px; overflow-y: auto; background: rgba(9, 132, 227, 0.01);">
                        ${textAnswers || '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">제출된 서술형 답변이 없습니다.</div>'}
                    </div>
                `;
            }

            statsHtml += `
                <div style="background: #ffffff; border: 1px solid var(--border-color); padding: 18px; border-radius: var(--radius-md); margin-bottom: 1.5rem; box-shadow: var(--shadow-main);">
                    <div style="font-size: 0.75rem; color: var(--secondary); font-weight: bold; margin-bottom: 4px;">질문 ${idx + 1} (${q.type === 'choice' ? '객관식' : '주관식'})</div>
                    <h4 style="font-weight: 700; font-size: 1rem; color: var(--text-main); margin-bottom: 12px; line-height: 1.3;">${escapeHtml(q.questionText)}</h4>
                    ${qStatsContent}
                </div>
            `;
        });

        // Individual response records table
        const individualRowsHtml = responses.map((r, index) => {
            const student = students.find(s => s.id === r.studentId);
            return `
                <tr>
                    <td style="font-size:0.85rem;">${index + 1}</td>
                    <td style="font-weight:600; font-size:0.88rem;">${student ? student.name : '알 수 없음'}</td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${r.date}</td>
                    <td style="font-size:0.85rem; color:var(--text-main);">
                        <ul style="margin: 0; padding-left: 14px; list-style: circle;">
                            ${survey.questions.map(q => `<li><strong>${escapeHtml(q.questionText.slice(0, 10))}:</strong> ${escapeHtml(r.answers[q.id] || '-')}</li>`).join('')}
                        </ul>
                    </td>
                </tr>
            `;
        }).join('');

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">설문 통계 분석</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding-top: 10px; max-height: 65vh; overflow-y: auto;">
                <!-- Summary bar -->
                <div style="background: linear-gradient(135deg, var(--primary-light), rgba(116, 185, 255, 0.04)); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
                    <h4 style="font-weight: 800; font-size: 1.15rem; margin-bottom: 4px; color: var(--text-main);">${escapeHtml(survey.title)}</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.4;">${escapeHtml(survey.description)}</p>
                    <div style="display: flex; gap: 20px; font-size: 0.8rem; color: var(--text-muted); margin-top: 10px; font-weight: 500;">
                        <span>배포일: ${survey.date}</span>
                        <span>총 응답 수: <strong style="color:var(--primary); font-size:0.85rem;">${totalRespCount}명</strong></span>
                    </div>
                </div>

                <!-- Tabs: '통계 집계' / '개별 답변 데이터' -->
                <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 1.5rem;">
                    <button class="btn btn-secondary btn-sm" id="btn-stats-tab-aggregate" style="font-weight: bold; padding: 6px 12px; border-radius:12px; background:var(--primary); color:white;">차트 요약 통계</button>
                    <button class="btn btn-secondary btn-sm" id="btn-stats-tab-individual" style="font-weight: bold; padding: 6px 12px; border-radius:12px;">개별 응답 일지</button>
                </div>

                <!-- aggregate view -->
                <div id="stats-tab-aggregate-view">
                    ${statsHtml}
                </div>

                <!-- individual list view (default hidden) -->
                <div id="stats-tab-individual-view" style="display: none;">
                    <div class="table-wrapper" style="margin-top: 0;">
                        <table class="custom-table" style="font-size: 0.85rem;">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">#</th>
                                    <th style="width: 100px;">수강생</th>
                                    <th style="width: 100px;">제출일</th>
                                    <th>답변 요약</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${individualRowsHtml || `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">응답자가 없습니다.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;

        openModal(modalHtml, (modalArea) => {
            const btnAgg = modalArea.querySelector('#btn-stats-tab-aggregate');
            const btnInd = modalArea.querySelector('#btn-stats-tab-individual');
            const viewAgg = modalArea.querySelector('#stats-tab-aggregate-view');
            const viewInd = modalArea.querySelector('#stats-tab-individual-view');

            btnAgg.addEventListener('click', () => {
                btnAgg.style.background = 'var(--primary)';
                btnAgg.style.color = 'white';
                btnInd.style.background = '';
                btnInd.style.color = '';
                viewAgg.style.display = 'block';
                viewInd.style.display = 'none';
            });

            btnInd.addEventListener('click', () => {
                btnInd.style.background = 'var(--primary)';
                btnInd.style.color = 'white';
                btnAgg.style.background = '';
                btnAgg.style.color = '';
                viewAgg.style.display = 'none';
                viewInd.style.display = 'block';
            });
        });
    };

    const openAnnouncementDetailModal = (ann) => {
        stateStore.incrementAnnouncementViews(ann.id);
        
        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-bullhorn" style="color: var(--primary); margin-right: 8px;"></i>공지사항 상세</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; color: var(--text-main);">
                <div style="margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <h4 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 8px 0; line-height: 1.4; color: var(--text-main);">${escapeHtml(ann.title)}</h4>
                    <div style="display: flex; gap: 16px; font-size: 0.8rem; color: var(--text-muted);">
                        <span><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>작성일: ${ann.date}</span>
                        <span><i class="fa-regular fa-eye" style="margin-right: 4px;"></i>조회수: ${(stateStore.getAnnouncements().find(a => a.id === ann.id)?.views || 0)}회</span>
                    </div>
                </div>
                <div style="font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: 8px; border: 1px solid var(--border-color); max-height: 400px; overflow-y: auto;">${escapeHtml(ann.content)}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const openMessageDetailModal = (msg, students) => {
        const student = students.find(s => s.id === msg.studentId);
        const readBadge = msg.isRead 
            ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> 읽음</span>`
            : `<span class="badge badge-warning" style="background: var(--danger); color: white;"><i class="fa-solid fa-circle-exclamation"></i> 안읽음</span>`;

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-envelope" style="color: var(--primary); margin-right: 8px;"></i>보낸 개별 안내장 상세 ✉️</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; color: var(--text-main);">
                <div style="margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <h4 style="font-size: 1.15rem; font-weight: 700; margin: 0 0 8px 0; line-height: 1.4; color: var(--text-main);">${escapeHtml(msg.title)}</h4>
                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--text-muted);">
                        <div><i class="fa-solid fa-user" style="margin-right: 6px; width: 14px;"></i><strong>수신 원생:</strong> ${student ? student.name : '알 수 없음'}</div>
                        <div><i class="fa-regular fa-calendar-days" style="margin-right: 6px; width: 14px;"></i><strong>발송 일시:</strong> ${msg.date}</div>
                        <div style="display: flex; align-items: center; gap: 4px;"><i class="fa-regular fa-eye" style="margin-right: 2px; width: 14px;"></i><strong>학부모 열람 여부:</strong> ${readBadge}</div>
                    </div>
                </div>
                <div style="font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all; background: rgba(255,255,255,0.02); padding: 1.2rem; border-radius: 8px; border: 1px solid var(--border-color); max-height: 400px; overflow-y: auto;">${escapeHtml(msg.content)}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const openSurveyDetailModal = (surv) => {
        const statusBadge = surv.isActive 
            ? `<span class="badge badge-success">진행 중</span>`
            : `<span class="badge badge-info" style="background: #bdc3c7; color: white;">종료</span>`;

        const questionsHtml = surv.questions && surv.questions.length > 0
            ? surv.questions.map((q, idx) => {
                const typeText = q.type === 'choice' ? '객관식 선택' : '주관식 단답';
                const optsText = q.type === 'choice' && q.options
                    ? `<div style="font-size: 0.8rem; color: var(--secondary); margin-top: 4px;"><strong>선택 옵션:</strong> ${q.options.join(', ')}</div>`
                    : '';
                return `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                        <span class="badge badge-info" style="font-size: 0.65rem; margin-bottom: 4px;">문항 ${idx + 1} (${typeText})</span>
                        <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(q.questionText)}</div>
                        ${optsText}
                    </div>
                `;
            }).join('')
            : `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">문항이 존재하지 않습니다.</div>`;

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title"><i class="fa-solid fa-square-poll-vertical" style="color: var(--primary); margin-right: 8px;"></i>설문조사 상세</h3>
                <button class="modal-close" data-close-modal>&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; color: var(--text-main); max-height: 60vh; overflow-y: auto;">
                <div style="margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <h4 style="font-size: 1.15rem; font-weight: 700; margin: 0; line-height: 1.4; color: var(--text-main);">${escapeHtml(surv.title)}</h4>
                        ${statusBadge}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;">
                        <i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>배포일: ${surv.date}
                    </div>
                    <div style="font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; color: var(--text-muted); background: rgba(0,0,0,0.1); padding: 10px; border-radius: 6px;">${escapeHtml(surv.description || '')}</div>
                </div>
                
                <div>
                    <h5 style="font-weight: bold; font-size: 0.9rem; color: var(--text-main); margin: 0 0 10px 0;">설문 문항 구성</h5>
                    <div>${questionsHtml}</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" data-close-modal>닫기</button>
            </div>
        `;
        openModal(modalHtml);
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    render();

    const unsubAnn = stateStore.subscribe('ANNOUNCEMENTS_CHANGED', render);
    const unsubMsg = stateStore.subscribe('MESSAGES_CHANGED', render);
    const unsubSurv = stateStore.subscribe('SURVEYS_CHANGED', render);
    const unsubResp = stateStore.subscribe('SURVEY_RESPONSES_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);
    const unsubUsers = stateStore.subscribe('USERS_CHANGED', render);
    const unsubLinks = stateStore.subscribe('PARENT_STUDENT_LINKS_CHANGED', render);

    return () => {
        unsubAnn();
        unsubMsg();
        unsubSurv();
        unsubResp();
        unsubStudents();
        unsubUsers();
        unsubLinks();
    };
}


export function renderApprovals(container) {
    let query = '';
    let page = 1;
    const itemsPerPage = 10;

    // Track selected student IDs for parent users being approved
    // Format: { requestId: studentId }
    const parentLinks = {};

    const render = () => {
        const currentUser = stateStore.getCurrentUser();
        const academyId = currentUser ? currentUser.academyId : null;
        const academy = academyId ? stateStore.getAcademy(academyId) : null;
        const inviteCodeObj = academyId ? stateStore.getAcademyInviteCode(academyId) : null;
        
        // Get all pending join requests for this academy
        const pendingRequests = academyId ? stateStore.getPendingJoinRequests(academyId) : [];
        
        // Get all students to populate link dropdown
        const students = stateStore.getStudents();

        // Title / Header layout unified with communication board style
        container.innerHTML = `
            <div class="glass-card" style="padding: 1.8rem; min-height: 500px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
                    <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-user-check" style="color: var(--primary);"></i> 가입 및 권한 승인 관리
                    </h3>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 12px 0;">
                    학원 가입 신청 및 부모-원생 관계 설정을 검토하고 승인 또는 반려합니다.
                </p>
                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 0 0 16px 0;">
                
                <!-- Invite Code Management Panel -->
                ${academy ? `
                <div class="glass-card" style="padding: 1.5rem; margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; background: rgba(255, 255, 255, 0.02);">
                    <div>
                        <h4 style="font-weight: 700; margin: 0 0 6px 0; font-size: 1rem; color: var(--text-main);">학원 초대코드 관리</h4>
                        <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;">
                            <span><strong>학원명:</strong> ${academy.name}</span>
                            <span><strong>주소:</strong> ${academy.address} ${academy.detailAddress || ''}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px 16px; display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 0.8rem; color: var(--text-muted);">초대코드:</span>
                            <strong id="invite-code-display" style="font-size: 1.25rem; font-family: monospace; color: var(--primary); letter-spacing: 1px;">${inviteCodeObj ? inviteCodeObj.inviteCode : '-'}</strong>
                            <span id="invite-code-status-badge" class="badge ${inviteCodeObj && inviteCodeObj.status === 'active' ? 'badge-success' : 'badge-danger'}" style="font-size: 0.75rem;">
                                ${inviteCodeObj && inviteCodeObj.status === 'active' ? '활성' : '비활성'}
                            </span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="btn-copy-invite-code" class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; margin-bottom: 0;" ${inviteCodeObj ? '' : 'disabled'}>
                                <i class="fa-regular fa-copy"></i> 초대코드 복사
                            </button>
                            <button id="btn-toggle-invite-status" class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; margin-bottom: 0;" ${inviteCodeObj ? '' : 'disabled'}>
                                ${inviteCodeObj && inviteCodeObj.status === 'active' ? '<i class="fa-solid fa-toggle-on" style="color:var(--success)"></i> 비활성화' : '<i class="fa-solid fa-toggle-off"></i> 활성화'}
                            </button>
                            <button id="btn-regenerate-invite-code" class="btn btn-secondary" style="padding: 8px 12px; font-size: 0.85rem; margin-bottom: 0;">
                                <i class="fa-solid fa-rotate"></i> 초대코드 재생성
                            </button>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="glass-card" style="padding: 14px; margin-bottom: 16px;">
                    <div style="position: relative; max-width: 320px; margin: 0;">
                        <input type="text" id="approval-search-input" class="form-control" placeholder="가입 신청자 이름 또는 연락처 검색..." style="width: 100%; padding-left: 36px; margin-bottom: 0;" value="${query}">
                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
                    </div>
                </div>

                <div class="table-wrapper" style="margin-top: 0;">
                    <table class="custom-table">
                        <thead>
                            <tr>
                                <th>신청자 이름</th>
                                <th>회원 유형</th>
                                <th>연락처</th>
                                <th>신청 방식</th>
                                <th>신청일</th>
                                <th>연관 원생 지정</th>
                                <th style="width: 180px; text-align: right;">관리</th>
                            </tr>
                        </thead>
                        <tbody id="approvals-table-body"></tbody>
                    </table>
                </div>
                <div id="approvals-pagination" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;"></div>
            </div>
        `;

        // Bind invite code management events
        const btnCopy = container.querySelector('#btn-copy-invite-code');
        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                const code = inviteCodeObj ? inviteCodeObj.inviteCode : '';
                navigator.clipboard.writeText(code).then(() => {
                    showKakaoTalkToast("초대코드가 복사되었습니다.");
                });
            });
        }

        const btnToggle = container.querySelector('#btn-toggle-invite-status');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                const isActive = inviteCodeObj && inviteCodeObj.status === 'active';
                try {
                    stateStore.updateAcademyInviteCodeStatus(academyId, !isActive);
                    showKakaoTalkToast(`초대코드가 ${!isActive ? '활성화' : '비활성화'}되었습니다.`);
                    render();
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        const btnRegen = container.querySelector('#btn-regenerate-invite-code');
        if (btnRegen) {
            btnRegen.addEventListener('click', () => {
                if (confirm("초대코드를 재생성하면 기존 초대코드는 더 이상 사용할 수 없습니다. 계속하시겠습니까?")) {
                    try {
                        const newCode = stateStore.regenerateAcademyInviteCode(academyId);
                        showKakaoTalkToast(`새 초대코드 (${newCode})가 생성되었습니다.`);
                        render();
                    } catch (err) {
                        alert(err.message);
                    }
                }
            });
        }

        const searchInput = container.querySelector('#approval-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                query = e.target.value;
                page = 1;
                renderTable();
            });
        }

        const renderTable = () => {
            const tbody = container.querySelector('#approvals-table-body');
            const paginator = container.querySelector('#approvals-pagination');
            if (!tbody) return;

            // Filter pending requests
            const filtered = pendingRequests.filter(r => {
                const u = stateStore.getUser(r.userId);
                if (!u) return false;
                const nameMatch = u.name.toLowerCase().includes(query.toLowerCase());
                const phoneMatch = u.phone.toLowerCase().includes(query.toLowerCase());
                return !query || nameMatch || phoneMatch;
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem;">대기 중인 가입 신청이 없습니다.</td></tr>`;
                paginator.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIdx = (page - 1) * itemsPerPage;
            const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

            tbody.innerHTML = pageItems.map(r => {
                const u = stateStore.getUser(r.userId);
                if (!u) return '';

                let roleLabel = '';
                if (r.userType === 'director') roleLabel = '<span class="badge" style="background: rgba(155, 89, 182, 0.1); color: #8e44ad; font-weight: 700;">원장</span>';
                else if (r.userType === 'teacher') roleLabel = '<span class="badge" style="background: rgba(52, 152, 219, 0.1); color: #2980b9; font-weight: 700;">선생님</span>';
                else if (r.userType === 'parent') roleLabel = '<span class="badge" style="background: rgba(46, 204, 113, 0.1); color: #27ae60; font-weight: 700;">학부모</span>';
                else roleLabel = `<span class="badge badge-secondary">${r.userType}</span>`;

                const methodLabel = r.requestMethod === 'invite_code' 
                    ? '<span style="color: var(--primary);"><i class="fa-solid fa-ticket"></i> 초대코드</span>' 
                    : '<span style="color: var(--success);"><i class="fa-solid fa-magnifying-glass"></i> 학원명 검색</span>';

                // If parent, render a select dropdown containing all active students
                let studentSelectHtml = '-';
                if (r.userType === 'parent') {
                    const studentOptions = students.map(s => `
                        <option value="${s.id}" ${parentLinks[r.id] === s.id ? 'selected' : ''}>
                            ${s.name} (${s.instrument})
                        </option>
                    `).join('');
                    studentSelectHtml = `
                        <select class="form-control select-link-student" data-req-id="${r.id}" style="margin-bottom: 0; padding: 4px 8px; font-size: 0.85rem; height: 32px; width: 200px;">
                            <option value="">-- 원생 연결 선택 --</option>
                            ${studentOptions}
                        </select>
                    `;
                }

                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${escapeHtml(u.name)}</td>
                        <td>${roleLabel}</td>
                        <td style="font-size: 0.9rem;">${escapeHtml(u.phone)}</td>
                        <td>${methodLabel}</td>
                        <td style="font-size: 0.9rem; color: var(--text-muted);">${r.requestedAt}</td>
                        <td>${studentSelectHtml}</td>
                        <td style="text-align: right;">
                            <div style="display: inline-flex; gap: 8px;">
                                <button class="btn btn-primary btn-sm btn-approve-request" data-id="${r.id}" style="padding: 4px 10px; font-size: 0.8rem; font-weight: bold; margin-bottom: 0;">
                                    <i class="fa-solid fa-circle-check"></i> 승인
                                </button>
                                <button class="btn btn-danger btn-sm btn-reject-request" data-id="${r.id}" style="padding: 4px 10px; font-size: 0.8rem; font-weight: bold; margin-bottom: 0;">
                                    <i class="fa-solid fa-circle-xmark"></i> 반려
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Bind change listener for dropdowns
            tbody.querySelectorAll('.select-link-student').forEach(select => {
                select.addEventListener('change', (e) => {
                    const reqId = e.target.dataset.reqId;
                    parentLinks[reqId] = e.target.value;
                });
            });

            // Bind approve/reject button events
            tbody.querySelectorAll('.btn-approve-request').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reqId = e.currentTarget.dataset.id;
                    const req = pendingRequests.find(r => r.id === reqId);
                    if (!req) return;
                    const u = stateStore.getUser(req.userId);
                    if (!u) return;

                    let studentId = null;
                    if (req.userType === 'parent') {
                        studentId = parentLinks[reqId];
                        if (!studentId) {
                            alert('학부모 가입 승인을 위해서는 연결할 원생을 반드시 선택해주세요.');
                            return;
                        }
                    }

                    if (confirm(`'${u.name}' 사용자의 가입 신청을 승인하시겠습니까?`)) {
                        try {
                            stateStore.approveJoinRequest(reqId, studentId, currentUser.id);
                            showKakaoTalkToast(`가입 승인 알림톡이 '${u.name}' 님에게 발송되었습니다.`);
                            render();
                        } catch (err) {
                            alert(err.message || '가입 승인 도중 오류가 발생했습니다.');
                        }
                    }
                });
            });

            tbody.querySelectorAll('.btn-reject-request').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const reqId = e.currentTarget.dataset.id;
                    const req = pendingRequests.find(r => r.id === reqId);
                    if (!req) return;
                    const u = stateStore.getUser(req.userId);
                    if (!u) return;

                    const reason = prompt(`'${u.name}' 사용자의 가입 신청을 반려하는 사유를 입력하세요 (선택 사항):`, '');
                    if (reason !== null) {
                        try {
                            stateStore.rejectJoinRequest(reqId, currentUser.id, reason);
                            showKakaoTalkToast(`가입 반려 알림톡이 '${u.name}' 님에게 발송되었습니다.`);
                            render();
                        } catch (err) {
                            alert(err.message || '가입 반려 도중 오류가 발생했습니다.');
                        }
                    }
                });
            });

            // Pagination layout
            let pagesHtml = `<button class="btn btn-secondary btn-sm" id="btn-appr-prev" ${page === 1 ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem; margin-bottom: 0;">이전</button>`;
            for (let p = 1; p <= totalPages; p++) {
                pagesHtml += `<button class="btn btn-sm ${page === p ? 'btn-primary' : 'btn-secondary'}" data-page="${p}" style="padding: 4px 8px; font-size: 0.8rem; min-width: 28px; margin-bottom: 0;">${p}</button>`;
            }
            pagesHtml += `<button class="btn btn-secondary btn-sm" id="btn-appr-next" ${page === totalPages ? 'disabled' : ''} style="padding: 4px 8px; font-size: 0.8rem; margin-bottom: 0;">다음</button>`;
            paginator.innerHTML = pagesHtml;

            paginator.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    page = parseInt(e.currentTarget.dataset.page);
                    renderTable();
                });
            });

            const btnPrev = paginator.querySelector('#btn-appr-prev');
            if (btnPrev) btnPrev.addEventListener('click', () => { if (page > 1) { page--; renderTable(); } });
            const btnNext = paginator.querySelector('#btn-appr-next');
            if (btnNext) btnNext.addEventListener('click', () => { if (page < totalPages) { page++; renderTable(); } });
        };

        renderTable();
    };

    const escapeHtml = (text) => {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    render();

    // Subscribe to state changes
    const unsubRequests = stateStore.subscribe('ACADEMY_JOIN_REQUESTS_CHANGED', render);
    const unsubUsers = stateStore.subscribe('USERS_CHANGED', render);
    const unsubStudents = stateStore.subscribe('STUDENTS_CHANGED', render);

    return () => {
        unsubRequests();
        unsubUsers();
        unsubStudents();
    };
}

