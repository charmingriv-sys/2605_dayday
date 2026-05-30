// app.js - Core Router and View Orchestrator
import { stateStore } from './state.js';
import { PhoneNumberInput, AddressInput } from './utils/inputHelper.js';
import { 
    TERMS_LABELS, 
    TERMS_VERSIONS, 
    SERVICE_USE_TERMS, 
    PRIVACY_POLICY, 
    LOCATION_SERVICES_TERMS, 
    MARKETING_RECEIVE_CONSENT, 
    MARKETING_USAGE_CONSENT 
} from './termsText.js';

// Dom references
const loginOverlay = document.getElementById('login-overlay');
const appRoot = document.getElementById('app-root');
const dashboardContent = document.getElementById('dashboard-content');
const btnLogout = document.getElementById('btn-logout');
const userAvatar = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name');
const userRoleLabel = document.getElementById('user-role-label');
const pageTitle = document.getElementById('page-title');
const currentDateEl = document.getElementById('current-date');
const kakaotalkToggle = document.getElementById('kakaotalk-alert-toggle');
const settingsQuickBar = document.getElementById('settings-quick-bar');
const toastContainer = document.getElementById('toast-container');
const commonModal = document.getElementById('common-modal');

// Active view mapping
let currentRole = null;
let currentView = null;
let viewCleanup = null; // Store function to cleanup view listeners

const VIEW_TITLES = {
    // Director views
    'dir-dashboard': '종합 분석 대시보드',
    'dir-students': '원생 명부 관리',
    'dir-payments': '수납 및 결제 현황',
    'dir-teachers': '강사 명부 관리',
    'dir-schedules': '강사 출근 및 시간표 관리',
    'dir-attendance': '원생 출결 종합 관리',
    'dir-kiosk-attendance': '태블릿 출결 키오스크',
    'dir-books': '학원 교재 마스터 관리',
    'dir-books-elapsed': '원생별 교재 등록 경과일 관리',
    'dir-subjects': '수강과목 관리',
    'dir-approvals': '가입 및 권한 승인 관리',
    'dir-communication': '학부모 소통 종합 관리',
    'dir-academy-info': '학원정보 관리',
    // Teacher views
    'tea-attendance': '담당 원생 출결 입력',
    'tea-lessons': '오늘의 레슨 일지',
    'tea-schedule': '주간 수업 시간표',
    // Student views
    'stu-calendar': '출석 및 레슨 기록',
    'stu-billing': '수강료 청구 및 결제',
    'stu-journal': '선생님 피드백 코멘트',
    'stu-communication': '학부모 알림 및 설문 조사'
};

// Map of view names to module renderer functions
const viewModules = {};

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    // Current date representation
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    currentDateEl.textContent = `${yyyy}년 ${mm}월 ${dd}일 (${days[today.getDay()]})`;

    // KakaoTalk quick toggle sync
    const settings = stateStore.getSettings();
    kakaotalkToggle.checked = settings.sendKakaoAlert;
    kakaotalkToggle.addEventListener('change', (e) => {
        stateStore.updateSettings({ sendKakaoAlert: e.target.checked });
    });

    // Login role buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.dataset.role;
            let demoUserId = '';
            if (role === 'director') demoUserId = 'USR_DIR_DEMO';
            else if (role === 'teacher') demoUserId = 'USR_TEA_DEMO';
            else if (role === 'student') demoUserId = 'USR_PAR_DEMO';
            
            stateStore.setCurrentUser(demoUserId);
            checkAuthAndRoute();
        });
    });

    // Sidebar navigation clicks
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const targetView = e.currentTarget.dataset.view;
            if (targetView) {
                // Update active tab styles
                document.querySelectorAll('.menu-list:not([style*="display: none"]) .menu-item').forEach(el => {
                    el.classList.remove('active');
                });
                e.currentTarget.classList.add('active');
                switchView(targetView);
            }
        });
    });

    // Profile settings gear icon
    const btnEditProfile = document.getElementById('btn-edit-profile');
    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', () => {
            const user = stateStore.getCurrentUser();
            if (user) {
                openProfileEditModal(user);
            }
        });
    }

    // Logout
    btnLogout.addEventListener('click', logout);

    // Setup KakaoTalk Toast notification listener
    window.addEventListener('kakaotalk-alert', (e) => {
        showKakaoTalkToast(e.detail.message);
    });

    // Setup modal close click (outside modal content)
    commonModal.addEventListener('click', (e) => {
        if (e.target === commonModal) {
            // Block closing if the student modal form is currently open
            if (document.getElementById('student-modal-form')) {
                return;
            }
            closeModal();
        }
    });

    // Check login state on load
    checkAuthAndRoute();
});

// Authentication handlers
function handleSocialLogin(provider) {
    openModal(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem; gap: 1.2rem; min-width: 320px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.8rem; color: var(--primary);"></i>
            <h3 style="margin: 0; font-weight: 800; font-size: 1.15rem;">보안 로그인 처리 중</h3>
            <p style="margin: 0; color: var(--text-muted); font-size: 0.85rem; text-align: center; line-height: 1.4;">
                ${provider.toUpperCase()} 계정 인증 세션을 연결 중입니다.<br>잠시만 기다려 주세요.
            </p>
        </div>
    `);

    setTimeout(() => {
        closeModal();
        
        let snsId = localStorage.getItem(`turing_mock_sns_id_${provider}`) || localStorage.getItem(`harmonia_mock_sns_id_${provider}`);
        if (!snsId) {
            snsId = `mock_sns_${provider}_` + Math.floor(Math.random() * 100000);
        }

        const existingUser = stateStore.db.users.find(u => u.provider === provider && u.snsId === snsId);
        
        if (existingUser) {
            localStorage.setItem(`turing_mock_sns_id_${provider}`, snsId);
            stateStore.setCurrentUser(existingUser.id);
            checkAuthAndRoute();
            showKakaoTalkToast(`${existingUser.name} 님, 환영합니다!`);
        } else {
            renderTermsAgreementScreen(provider, snsId);
        }
    }, 1000);
}

function checkAuthAndRoute() {
    const user = stateStore.getCurrentUser();
    
    if (!user) {
        appRoot.style.display = 'none';
        loginOverlay.style.display = 'flex';
        renderDefaultLoginCard();
        return;
    }

    if (user.status === 'pending') {
        appRoot.style.display = 'none';
        loginOverlay.style.display = 'flex';
        renderPendingScreen(user);
        return;
    }

    if (user.status === 'rejected') {
        appRoot.style.display = 'none';
        loginOverlay.style.display = 'flex';
        renderRejectedScreen(user);
        return;
    }

    // Approved status: Show dashboard
    loginOverlay.style.display = 'none';
    appRoot.style.display = 'flex';

    // Show appropriate menu list
    document.getElementById('menu-director').style.display = 'none';
    document.getElementById('menu-teacher').style.display = 'none';
    document.getElementById('menu-student').style.display = 'none';

    currentRole = user.role;
    let defaultView = '';
    
    if (user.role === 'director') {
        document.getElementById('menu-director').style.display = 'flex';
        defaultView = 'dir-dashboard';
        userNameEl.textContent = `${user.name} 원장`;
        userRoleLabel.textContent = '총괄 원장';
        userAvatar.textContent = '원';
        userAvatar.style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
        settingsQuickBar.style.display = 'flex';
    } else if (user.role === 'teacher') {
        document.getElementById('menu-teacher').style.display = 'flex';
        defaultView = 'tea-attendance';
        userNameEl.textContent = `${user.name} 강사`;
        userRoleLabel.textContent = '음악 전임강사';
        userAvatar.textContent = '선';
        userAvatar.style.background = 'linear-gradient(135deg, var(--accent), var(--secondary))';
        settingsQuickBar.style.display = 'flex';
    } else if (user.role === 'parent') {
        document.getElementById('menu-student').style.display = 'flex';
        defaultView = 'stu-calendar';
        
        // Find children
        const students = stateStore.getStudentsForParent(user.id);
        const childNameText = students.length > 0 ? students.map(s => s.name).join(', ') : (user.childName || '자녀');
        
        userNameEl.textContent = `${user.name} 학부모`;
        userRoleLabel.textContent = `원생 학부모 (자녀: ${childNameText})`;
        userAvatar.textContent = '학';
        userAvatar.style.background = 'linear-gradient(135deg, var(--success), var(--accent))';
        settingsQuickBar.style.display = 'none';
    }

    // Set default menu active tab
    document.querySelectorAll(`.menu-list .menu-item`).forEach(el => el.classList.remove('active'));
    const defaultTab = document.querySelector(`.menu-item[data-view="${defaultView}"]`);
    if (defaultTab) defaultTab.classList.add('active');

    switchView(defaultView);
}

function logout() {
    stateStore.logoutUser();
    currentRole = null;
    currentView = null;
    
    // Clean up current view listeners
    if (viewCleanup) {
        viewCleanup();
        viewCleanup = null;
    }

    appRoot.style.display = 'none';
    loginOverlay.style.display = 'flex';
    dashboardContent.innerHTML = '';
    renderDefaultLoginCard();
}

// UI Screen Renderers for Auth Flow
function renderDefaultLoginCard() {
    const settings = stateStore.getSettings();
    const academyName = settings.academyName || '튜링 음악학원';
    loginOverlay.innerHTML = `
        <div class="glass-card login-card">
            <div class="login-logo">
                <i class="fa-solid fa-music"></i>
            </div>
            <h1 class="login-title">${academyName}</h1>
            <p class="login-subtitle">통합 관리 시스템에 오신 것을 환영합니다.</p>
            
            <div class="role-grid">
                <button class="role-btn director" data-role="director">
                    <i class="fa-solid fa-user-tie"></i>
                    <div>
                        <strong>원장님 로그인</strong>
                        <span class="role-btn-desc">원생 관리, 강사 관리, 수납 분석 및 설정</span>
                    </div>
                </button>
                <button class="role-btn teacher" data-role="teacher">
                    <i class="fa-solid fa-chalkboard-user"></i>
                    <div>
                        <strong>강사 로그인</strong>
                        <span class="role-btn-desc">출결 관리, 주간 학습 진도 및 피드백 작성</span>
                    </div>
                </button>
                <button class="role-btn student" data-role="student">
                    <i class="fa-solid fa-graduation-cap"></i>
                    <div>
                        <strong>학생 / 학부모 로그인</strong>
                        <span class="role-btn-desc">출결 현황 캘린더, 수강료 청구 및 모의 결제</span>
                    </div>
                </button>
            </div>

            <div class="login-divider">
                <span>또는 간편 소셜 로그인/회원가입</span>
            </div>

            <div class="social-login-grid">
                <button class="social-btn kakao" data-provider="kakao">
                    <i class="fa-solid fa-comment"></i> 카카오 로그인
                </button>
                <button class="social-btn naver" data-provider="naver">
                    <span class="naver-n">N</span> 네이버 로그인
                </button>
                <button class="social-btn google" data-provider="google">
                    <i class="fa-brands fa-google"></i> 구글 로그인
                </button>
            </div>
        </div>
    `;

    // Rebind events
    loginOverlay.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.dataset.role;
            let demoUserId = '';
            if (role === 'director') demoUserId = 'USR_DIR_DEMO';
            else if (role === 'teacher') demoUserId = 'USR_TEA_DEMO';
            else if (role === 'student') demoUserId = 'USR_PAR_DEMO';
            
            stateStore.setCurrentUser(demoUserId);
            checkAuthAndRoute();
        });
    });

    loginOverlay.querySelectorAll('.social-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.dataset.provider;
            handleSocialLogin(provider);
        });
    });
}

// Simple Markdown-to-HTML parser helper for Terms detail modals
function parseMarkdownToHtml(mdText) {
    if (!mdText) return '';
    let html = mdText;
    
    // Escape HTML special characters
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    // Blockquotes: > text
    html = html.replace(/^\s*&gt;\s+(.*)$/gm, '<blockquote style="border-left: 4px solid var(--border-color); padding-left: 12px; color: var(--text-muted); margin: 8px 0; font-style: italic;">$1</blockquote>');
    
    // Headers
    html = html.replace(/^\s*#\s+(.*)$/gm, '<h1 style="font-size: 1.3rem; font-weight: 800; margin: 16px 0 10px 0; color: var(--text-dark);">$1</h1>');
    html = html.replace(/^\s*##\s+(.*)$/gm, '<h2 style="font-size: 1.1rem; font-weight: 700; margin: 14px 0 8px 0; color: var(--text-dark); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">$1</h2>');
    html = html.replace(/^\s*###\s+(.*)$/gm, '<h3 style="font-size: 0.95rem; font-weight: 700; margin: 12px 0 6px 0; color: var(--text-main);">$1</h3>');
    
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Underline/Highlight: ==text==
    html = html.replace(/==(.*?)==/g, '<mark style="background-color: rgba(9, 132, 227, 0.08); color: var(--primary); padding: 2px 4px; border-radius: 4px; font-weight: 600;">$1</mark>');
    
    // Code ticks
    html = html.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.04); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');
    
    // Unordered lists: - text or * text
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li style="margin-left: 20px; list-style-type: disc; margin-bottom: 4px;">$1</li>');
    
    // Ordered lists: 1. text
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gm, '<li style="margin-left: 20px; list-style-type: decimal; margin-bottom: 4px;">$2</li>');
    
    // Tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let finalHtml = [];
    
    for (let line of lines) {
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = '<table class="terms-table" style="width:100%; border-collapse:collapse; margin: 12px 0; font-size:0.8rem; text-align:left;">';
            }
            const cells = line.split('|').slice(1, -1).map(c => c.trim());
            const isSeparator = cells.every(c => c.startsWith('-') || c.endsWith('-'));
            if (!isSeparator) {
                const isHeader = !tableHtml.includes('<tbody>') && !tableHtml.includes('<tr>');
                tableHtml += '<tr>';
                for (let cell of cells) {
                    const tag = isHeader ? 'th' : 'td';
                    const styles = isHeader 
                        ? 'border:1px solid var(--border-color); padding:8px; background:rgba(0,0,0,0.02); font-weight:600;'
                        : 'border:1px solid var(--border-color); padding:8px;';
                    tableHtml += `<${tag} style="${styles}">${cell}</${tag}>`;
                }
                tableHtml += '</tr>';
            }
        } else {
            if (inTable) {
                inTable = false;
                tableHtml += '</table>';
                finalHtml.push(tableHtml);
                tableHtml = '';
            }
            finalHtml.push(line);
        }
    }
    if (inTable) {
        tableHtml += '</table>';
        finalHtml.push(tableHtml);
    }
    
    html = finalHtml.join('\n');
    
    // Paragraphs
    html = html.split('\n\n').map(p => {
        const trimmed = p.trim();
        if (trimmed.startsWith('<h') || trimmed.startsWith('<li') || trimmed.startsWith('<table') || trimmed.startsWith('<blockquote') || trimmed.startsWith('</table')) {
            return p;
        }
        return `<p style="margin-bottom: 10px;">${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    
    return html;
}

function renderTermsAgreementScreen(provider, snsId, previousTermsData = null) {
    // Check initial states from previousTermsData if it exists
    let initServiceUse = false;
    let initPrivacyPolicy = false;
    let initLocationService = false;
    let initMarketingReceive = false;
    let initMarketingUsage = false;
    
    if (previousTermsData) {
        initServiceUse = !!previousTermsData.serviceUse?.agreed;
        initPrivacyPolicy = !!previousTermsData.privacyPolicy?.agreed;
        initLocationService = !!previousTermsData.locationService?.agreed;
        initMarketingReceive = !!previousTermsData.marketingReceive?.agreed;
        initMarketingUsage = !!previousTermsData.marketingUsage?.agreed;
    }
    
    const allChecked = initServiceUse && initPrivacyPolicy && initLocationService && initMarketingReceive && initMarketingUsage;
    
    loginOverlay.innerHTML = `
        <div class="glass-card auth-flow-card terms-agreement-card">
            <h2 class="auth-form-title" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-file-shield" style="color: var(--primary);"></i>
                약관 동의
            </h2>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: -8px; text-align: center; margin-bottom: 1.5rem;">
                튜링 서비스 이용을 위해 약관 동의가 필요합니다.
            </p>

            <!-- 전체 동의 영역 -->
            <div class="terms-all-agree-box">
                <label class="terms-checkbox-label all-agree">
                    <input type="checkbox" id="terms-agree-all" ${allChecked ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                    <span class="terms-label-text bold">모두 동의합니다.</span>
                </label>
            </div>

            <div class="terms-divider"></div>

            <!-- 개별 동의 영역 -->
            <div class="terms-list">
                <div class="terms-item-row">
                    <label class="terms-checkbox-label">
                        <input type="checkbox" class="terms-item-chk" id="terms-service-use" data-key="serviceUse" ${initServiceUse ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                        <span class="terms-label-text">${TERMS_LABELS.serviceUse} <span class="tag-required">(필수)</span></span>
                    </label>
                    <button type="button" class="btn-terms-detail" data-key="serviceUse" title="약관 상세보기">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <div class="terms-item-row">
                    <label class="terms-checkbox-label">
                        <input type="checkbox" class="terms-item-chk" id="terms-privacy-policy" data-key="privacyPolicy" ${initPrivacyPolicy ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                        <span class="terms-label-text">${TERMS_LABELS.privacyPolicy} <span class="tag-required">(필수)</span></span>
                    </label>
                    <button type="button" class="btn-terms-detail" data-key="privacyPolicy" title="약관 상세보기">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <div class="terms-item-row">
                    <label class="terms-checkbox-label">
                        <input type="checkbox" class="terms-item-chk" id="terms-location-service" data-key="locationService" ${initLocationService ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                        <span class="terms-label-text">${TERMS_LABELS.locationService} <span class="tag-required">(필수)</span></span>
                    </label>
                    <button type="button" class="btn-terms-detail" data-key="locationService" title="약관 상세보기">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <div class="terms-item-row">
                    <label class="terms-checkbox-label">
                        <input type="checkbox" class="terms-item-chk" id="terms-marketing-receive" data-key="marketingReceive" ${initMarketingReceive ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                        <span class="terms-label-text">${TERMS_LABELS.marketingReceive} <span class="tag-optional">(선택)</span></span>
                    </label>
                    <button type="button" class="btn-terms-detail" data-key="marketingReceive" title="약관 상세보기">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>

                <div class="terms-item-row">
                    <label class="terms-checkbox-label">
                        <input type="checkbox" class="terms-item-chk" id="terms-marketing-usage" data-key="marketingUsage" ${initMarketingUsage ? 'checked' : ''}>
                        <span class="checkbox-custom"></span>
                        <span class="terms-label-text">${TERMS_LABELS.marketingUsage} <span class="tag-optional">(선택)</span></span>
                    </label>
                    <button type="button" class="btn-terms-detail" data-key="marketingUsage" title="약관 상세보기">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            </div>

            <!-- 선택 동의 안내 및 마케팅 수신동의 안내 가이드 -->
            <div class="terms-guide-box">
                <p class="guide-text">
                    <i class="fa-solid fa-circle-info"></i> 
                    선택 동의 항목에 동의하지 않아도 서비스 이용은 가능합니다. 다만, 이벤트, 혜택, 맞춤형 안내 등 일부 정보 제공이 제한될 수 있습니다.
                </p>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 1.5rem; width: 100%;">
                <button type="button" class="btn btn-secondary" id="btn-cancel-agreement" style="flex: 1; padding: 12px; justify-content: center;">이전으로</button>
                <button type="button" class="btn btn-primary" id="btn-submit-agreement" style="flex: 2; padding: 12px; justify-content: center;">동의 후 가입하기</button>
            </div>
        </div>
    `;

    const chkAll = document.getElementById('terms-agree-all');
    const chkServiceUse = document.getElementById('terms-service-use');
    const chkPrivacyPolicy = document.getElementById('terms-privacy-policy');
    const chkLocationService = document.getElementById('terms-location-service');
    const chkMarketingReceive = document.getElementById('terms-marketing-receive');
    const chkMarketingUsage = document.getElementById('terms-marketing-usage');
    
    const btnCancel = document.getElementById('btn-cancel-agreement');
    const btnSubmit = document.getElementById('btn-submit-agreement');
    
    const individualChks = [chkServiceUse, chkPrivacyPolicy, chkLocationService, chkMarketingReceive, chkMarketingUsage];

    function updateSubmitButtonState() {
        const mandatoryChecked = chkServiceUse.checked && chkPrivacyPolicy.checked && chkLocationService.checked;
        if (mandatoryChecked) {
            btnSubmit.disabled = false;
            btnSubmit.style.background = 'var(--primary)';
            btnSubmit.style.color = '#ffffff';
            btnSubmit.style.cursor = 'pointer';
            btnSubmit.style.opacity = '1';
        } else {
            btnSubmit.disabled = true;
            btnSubmit.style.background = '#e2e8f0';
            btnSubmit.style.color = '#94a3b8';
            btnSubmit.style.cursor = 'not-allowed';
            btnSubmit.style.opacity = '0.75';
        }
    }

    function checkAllSync() {
        const allChecked = individualChks.every(chk => chk.checked);
        chkAll.checked = allChecked;
    }

    // Initialize button state
    updateSubmitButtonState();

    // All check toggle
    chkAll.addEventListener('change', () => {
        const isChecked = chkAll.checked;
        individualChks.forEach(chk => {
            chk.checked = isChecked;
        });
        updateSubmitButtonState();
    });

    // Individual check toggle
    individualChks.forEach(chk => {
        chk.addEventListener('change', () => {
            checkAllSync();
            updateSubmitButtonState();
        });
    });

    // Detail modal open
    loginOverlay.querySelectorAll('.btn-terms-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = btn.dataset.key;
            let title = TERMS_LABELS[key];
            let rawText = '';
            
            if (key === 'serviceUse') rawText = SERVICE_USE_TERMS;
            else if (key === 'privacyPolicy') rawText = PRIVACY_POLICY;
            else if (key === 'locationService') rawText = LOCATION_SERVICES_TERMS;
            else if (key === 'marketingReceive') rawText = MARKETING_RECEIVE_CONSENT;
            else if (key === 'marketingUsage') rawText = MARKETING_USAGE_CONSENT;
            
            let htmlContent = parseMarkdownToHtml(rawText);
            
            // Add custom info messages inside detail modal
            if (key === 'marketingReceive') {
                htmlContent += `
                    <div style="margin-top: 1.5rem; background: rgba(9, 132, 227, 0.04); border-left: 4px solid var(--primary); padding: 14px; border-radius: 4px; font-size: 0.85rem; line-height: 1.5; color: var(--text-main);">
                        <strong>[상세 안내 문구]</strong><br>
                        서비스의 소식, 이벤트, 혜택, 프로모션 정보를 휴대전화, 문자메시지, 카카오 알림톡, 앱 PUSH 알림, 이메일 등을 통해 받을 수 있습니다.
                    </div>
                `;
            } else if (key === 'marketingUsage') {
                htmlContent += `
                    <div style="margin-top: 1.5rem; background: rgba(0, 206, 201, 0.04); border-left: 4px solid var(--accent); padding: 14px; border-radius: 4px; font-size: 0.85rem; line-height: 1.5; color: var(--text-main);">
                        <strong>[수집·이용 항목 및 활용 안내]</strong><br>
                        본 약관에 따라 수집된 학원 이용정보 등은 서비스 홍보, 분석, 통계 개발 목적에 한해 투명하게 활용되며 수신 채널과는 구분되어 관리됩니다.
                    </div>
                `;
            }
            
            openModal(`
                <div class="terms-modal-container" style="display: flex; flex-direction: column; gap: 1rem; width: 100%; max-height: 70vh;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 8px;">
                        <h3 style="margin: 0; font-weight: 700; font-size: 1.15rem; color: var(--text-dark);">${title}</h3>
                        <button type="button" class="modal-close" data-close-modal style="background:none; border:none; font-size: 1.5rem; color: var(--text-muted); cursor:pointer;">&times;</button>
                    </div>
                    <div class="terms-modal-body text-markdown-body" style="overflow-y: auto; padding-right: 8px; font-size: 0.88rem; line-height: 1.6; color: var(--text-main);">
                        ${htmlContent}
                    </div>
                    <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px;">
                        <button type="button" class="btn btn-primary" data-close-modal style="padding: 8px 24px; font-size: 0.85rem;">확인</button>
                    </div>
                </div>
            `);
        });
    });

    btnCancel.addEventListener('click', renderDefaultLoginCard);

    btnSubmit.addEventListener('click', () => {
        const agreedAt = new Date().toISOString();
        const termsAgreement = {
            serviceUse: {
                agreed: chkServiceUse.checked,
                agreedAt: agreedAt,
                version: TERMS_VERSIONS.serviceUse
            },
            privacyPolicy: {
                agreed: chkPrivacyPolicy.checked,
                agreedAt: agreedAt,
                version: TERMS_VERSIONS.privacyPolicy
            },
            locationService: {
                agreed: chkLocationService.checked,
                agreedAt: agreedAt,
                version: TERMS_VERSIONS.locationService
            },
            marketingReceive: {
                agreed: chkMarketingReceive.checked,
                agreedAt: agreedAt,
                version: TERMS_VERSIONS.marketingReceive,
                channels: {
                    sms: chkMarketingReceive.checked,
                    email: chkMarketingReceive.checked,
                    appPush: chkMarketingReceive.checked,
                    kakaoTalk: chkMarketingReceive.checked,
                    phone: chkMarketingReceive.checked,
                    etc: chkMarketingReceive.checked
                }
            },
            marketingUsage: {
                agreed: chkMarketingUsage.checked,
                agreedAt: agreedAt,
                version: TERMS_VERSIONS.marketingUsage
            }
        };
        
        renderSignUpForm(provider, snsId, termsAgreement);
    });
}

function renderSignUpForm(provider, snsId, termsAgreement) {
    loginOverlay.innerHTML = `
        <div class="glass-card auth-flow-card">
            <h2 class="auth-form-title">
                <i class="fa-solid fa-user-plus" style="color: var(--primary); margin-right: 8px;"></i>
                신규 회원가입 (${provider.toUpperCase()})
            </h2>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: -10px; text-align: center;">
                학원 서비스를 이용하기 위해 회원 정보를 입력해 주세요.
            </p>
            
            <form id="signup-form" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="auth-form-group">
                    <label for="signup-name">이름</label>
                    <input type="text" id="signup-name" placeholder="홍길동" required>
                </div>
                
                <div class="auth-form-group">
                    <label for="signup-phone">연락처</label>
                    <input type="tel" id="signup-phone" placeholder="010-1234-5678" required>
                </div>
                
                <div class="auth-form-group">
                    <label for="signup-role">사용자 유형</label>
                    <select id="signup-role" required>
                        <option value="" disabled selected>유형을 선택해 주세요</option>
                        <option value="director">학원장 (원장님)</option>
                        <option value="teacher">선생님 (강사)</option>
                        <option value="parent">학부모</option>
                    </select>
                </div>

                <!-- Director Only Fields -->
                <div id="director-fields" style="display: none; flex-direction: column; gap: 1rem;">
                    <div class="auth-form-group">
                        <label for="signup-academy-name">학원 이름</label>
                        <input type="text" id="signup-academy-name" placeholder="예: 튜링 음악학원">
                    </div>
                    <div class="auth-form-group">
                        <label for="signup-academy-phone">학원 연락처</label>
                        <input type="tel" id="signup-academy-phone" placeholder="예: 010-1234-5678">
                    </div>
                    <div class="auth-form-group">
                        <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; display: block;">학원 주소</label>
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <input type="text" id="signup-academy-postcode" placeholder="우편번호" readonly style="flex: 1; margin-bottom: 0;">
                            <button type="button" id="btn-signup-academy-search" class="btn btn-secondary" style="padding: 0 12px; font-size: 0.85rem; flex-shrink: 0; margin-bottom: 0; justify-content: center;">주소 검색</button>
                        </div>
                        <input type="text" id="signup-academy-address" placeholder="기본 주소지" readonly style="margin-bottom: 8px;">
                        <input type="text" id="signup-academy-detail-address" placeholder="상세주소 입력">
                    </div>
                </div>

                <!-- Teacher & Parent Common Fields (Tabs) -->
                <div id="invite-fields" style="display: none; flex-direction: column; gap: 1rem;">
                    <div class="tab-container" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 0.5rem;">
                        <button type="button" id="tab-btn-invite" class="auth-tab-btn active" style="flex: 1; padding: 10px; background: none; border: none; border-bottom: 2px solid var(--primary); color: var(--text-main); font-weight: bold; cursor: pointer;">초대코드 입력</button>
                        <button type="button" id="tab-btn-search" class="auth-tab-btn" style="flex: 1; padding: 10px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: normal; cursor: pointer;">학원명 검색</button>
                    </div>

                    <!-- Invite Code Form -->
                    <div id="signup-invite-section" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="auth-form-group">
                            <label for="signup-invite-code">학원 초대 코드</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="signup-invite-code" placeholder="학원 초대코드를 입력해주세요." maxlength="6" style="text-transform: uppercase; flex: 1; margin-bottom: 0;">
                                <button type="button" id="btn-verify-invite" class="btn btn-secondary" style="padding: 0 16px; font-size: 0.85rem; margin-bottom: 0; justify-content: center;">확인</button>
                            </div>
                            <span id="invite-code-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                            
                            <!-- Valid invite code target display card -->
                            <div id="invite-academy-info-card" style="display: none; background: rgba(9, 132, 227, 0.05); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 8px; font-size: 0.85rem; line-height: 1.5;">
                                <div style="font-weight: bold; color: var(--primary); margin-bottom: 4px;">입력하신 초대코드는 아래 학원과 연결되어 있습니다.</div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <div><strong>학원명:</strong> <span id="invite-academy-name">-</span></div>
                                    <div><strong>주소:</strong> <span id="invite-academy-address">-</span></div>
                                    <div><strong>관리자:</strong> <span id="invite-academy-owner">-</span> 원장</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Academy Search Form -->
                    <div id="signup-search-section" style="display: none; flex-direction: column; gap: 1rem;">
                        <div class="auth-form-group">
                            <label for="signup-academy-search-input">가입할 학원명 검색</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="signup-academy-search-input" placeholder="가입할 학원명을 검색해주세요." style="margin-bottom: 0; flex: 1;">
                                <button type="button" id="btn-academy-search" class="btn btn-secondary" style="padding: 0 16px; font-size: 0.85rem; margin-bottom: 0; justify-content: center;">검색</button>
                            </div>
                            <!-- Search results listing -->
                            <div id="search-results-container" style="max-height: 200px; overflow-y: auto; display: none; border: 1px solid var(--border-color); border-radius: 8px; margin-top: 8px; background: rgba(255,255,255,0.05); padding: 4px;">
                                <!-- results list -->
                            </div>
                            <span id="search-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                            
                            <input type="hidden" id="signup-selected-academy-id">
                            <!-- Selected academy card -->
                            <div id="selected-academy-info-card" style="display: none; background: rgba(0, 184, 148, 0.05); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 8px; font-size: 0.85rem; line-height: 1.5;">
                                <div style="font-weight: bold; color: var(--success); margin-bottom: 4px;">선택한 학원 정보:</div>
                                <div style="display: flex; flex-direction: column; gap: 4px;">
                                    <div><strong>학원명:</strong> <span id="selected-academy-name">-</span></div>
                                    <div><strong>주소:</strong> <span id="selected-academy-address">-</span></div>
                                    <div><strong>관리자:</strong> <span id="selected-academy-owner">-</span> 원장</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Parent Only Fields -->
                <div id="parent-fields" style="display: none; flex-direction: column; gap: 1rem;">
                    <div class="auth-form-group">
                        <label for="signup-child-name">원생(자녀) 이름</label>
                        <input type="text" id="signup-child-name" placeholder="예: 최다은">
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 1rem;">
                    <button type="button" class="btn btn-secondary" id="btn-cancel-signup" style="flex: 1; padding: 12px; justify-content: center;">이전으로</button>
                    <button type="submit" class="btn btn-primary" style="flex: 2; padding: 12px; justify-content: center;">가입 신청</button>
                </div>
            </form>
        </div>
    `;

    const form = document.getElementById('signup-form');
    const roleSelect = document.getElementById('signup-role');
    const directorFields = document.getElementById('director-fields');
    const inviteFields = document.getElementById('invite-fields');
    const parentFields = document.getElementById('parent-fields');
    const btnCancel = document.getElementById('btn-cancel-signup');
    
    // Tabs control
    const tabBtnInvite = document.getElementById('tab-btn-invite');
    const tabBtnSearch = document.getElementById('tab-btn-search');
    const inviteSection = document.getElementById('signup-invite-section');
    const searchSection = document.getElementById('signup-search-section');
    let activeTab = 'invite'; // 'invite' or 'search'

    // Form inputs and bindings
    const phoneInput = PhoneNumberInput.bind(document.getElementById('signup-phone'));
    const academyPhoneInput = PhoneNumberInput.bind(document.getElementById('signup-academy-phone'), null, true);
    const academyAddressInput = AddressInput.bind({
        postcodeEl: document.getElementById('signup-academy-postcode'),
        addressEl: document.getElementById('signup-academy-address'),
        detailAddressEl: document.getElementById('signup-academy-detail-address'),
        searchBtnEl: document.getElementById('btn-signup-academy-search')
    });

    tabBtnInvite.addEventListener('click', () => {
        activeTab = 'invite';
        tabBtnInvite.style.borderBottom = '2px solid var(--primary)';
        tabBtnInvite.style.fontWeight = 'bold';
        tabBtnInvite.style.color = 'var(--text-main)';
        
        tabBtnSearch.style.borderBottom = '2px solid transparent';
        tabBtnSearch.style.fontWeight = 'normal';
        tabBtnSearch.style.color = 'var(--text-muted)';
        
        inviteSection.style.display = 'flex';
        searchSection.style.display = 'none';
    });

    tabBtnSearch.addEventListener('click', () => {
        activeTab = 'search';
        tabBtnSearch.style.borderBottom = '2px solid var(--primary)';
        tabBtnSearch.style.fontWeight = 'bold';
        tabBtnSearch.style.color = 'var(--text-main)';
        
        tabBtnInvite.style.borderBottom = '2px solid transparent';
        tabBtnInvite.style.fontWeight = 'normal';
        tabBtnInvite.style.color = 'var(--text-muted)';
        
        searchSection.style.display = 'flex';
        inviteSection.style.display = 'none';
    });

    // Verification of Invite Code
    const inviteCodeInput = document.getElementById('signup-invite-code');
    const btnVerifyInvite = document.getElementById('btn-verify-invite');
    const inviteFeedback = document.getElementById('invite-code-feedback');
    const inviteInfoCard = document.getElementById('invite-academy-info-card');
    
    let verifiedAcademyId = null;

    btnVerifyInvite.addEventListener('click', () => {
        const val = inviteCodeInput.value.trim().toUpperCase();
        if (val.length === 0) {
            inviteFeedback.textContent = '초대코드를 입력해주세요.';
            inviteFeedback.style.color = 'var(--danger)';
            inviteFeedback.style.display = 'block';
            inviteInfoCard.style.display = 'none';
            verifiedAcademyId = null;
            return;
        }

        const inviteRecord = stateStore.getAcademyInviteCodeObject(val);
        if (!inviteRecord) {
            inviteFeedback.textContent = '일치하는 학원 초대코드가 없습니다.';
            inviteFeedback.style.color = 'var(--danger)';
            inviteFeedback.style.display = 'block';
            inviteInfoCard.style.display = 'none';
            verifiedAcademyId = null;
        } else if (inviteRecord.status !== 'active') {
            inviteFeedback.textContent = '현재 사용할 수 없는 초대코드입니다.';
            inviteFeedback.style.color = 'var(--danger)';
            inviteFeedback.style.display = 'block';
            inviteInfoCard.style.display = 'none';
            verifiedAcademyId = null;
        } else {
            const acad = stateStore.getAcademy(inviteRecord.academyId);
            if (acad) {
                const owner = stateStore.getUser(acad.ownerUserId);
                const ownerName = owner ? owner.name : '알 수 없음';
                
                inviteFeedback.style.display = 'none';
                inviteInfoCard.style.display = 'block';
                document.getElementById('invite-academy-name').textContent = acad.name;
                document.getElementById('invite-academy-address').textContent = `${acad.address} ${acad.detailAddress || ''}`;
                document.getElementById('invite-academy-owner').textContent = ownerName;
                verifiedAcademyId = acad.id;
            } else {
                inviteFeedback.textContent = '학원 정보를 찾을 수 없습니다.';
                inviteFeedback.style.color = 'var(--danger)';
                inviteFeedback.style.display = 'block';
                inviteInfoCard.style.display = 'none';
                verifiedAcademyId = null;
            }
        }
    });

    // Academy Search
    const searchInput = document.getElementById('signup-academy-search-input');
    const btnAcademySearch = document.getElementById('btn-academy-search');
    const resultsContainer = document.getElementById('search-results-container');
    const searchFeedback = document.getElementById('search-feedback');
    const selectedInfoCard = document.getElementById('selected-academy-info-card');
    const selectedAcademyIdInput = document.getElementById('signup-selected-academy-id');

    btnAcademySearch.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query.length === 0) {
            searchFeedback.textContent = '검색어를 입력해 주세요.';
            searchFeedback.style.color = 'var(--danger)';
            searchFeedback.style.display = 'block';
            resultsContainer.style.display = 'none';
            return;
        }

        const results = stateStore.searchAcademies(query);
        if (results.length === 0) {
            searchFeedback.textContent = '일치하는 학원을 찾을 수 없습니다. 학원명 또는 주소를 다시 확인해주세요.';
            searchFeedback.style.color = 'var(--danger)';
            searchFeedback.style.display = 'block';
            resultsContainer.style.display = 'none';
        } else {
            searchFeedback.style.display = 'none';
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = results.map(a => {
                const owner = stateStore.getUser(a.ownerUserId);
                const ownerName = owner ? owner.name : '알 수 없음';
                return `
                    <div class="search-result-item" data-id="${a.id}" style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;">
                        <div style="font-weight: bold; color: var(--text-main);">${a.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${a.address} ${a.detailAddress || ''}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">대표 관리자: ${ownerName} 원장</div>
                    </div>
                `;
            }).join('');

            resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const acad = results.find(a => a.id === id);
                    if (acad) {
                        const owner = stateStore.getUser(acad.ownerUserId);
                        const ownerName = owner ? owner.name : '알 수 없음';
                        
                        selectedAcademyIdInput.value = acad.id;
                        selectedInfoCard.style.display = 'block';
                        document.getElementById('selected-academy-name').textContent = acad.name;
                        document.getElementById('selected-academy-address').textContent = `${acad.address} ${acad.detailAddress || ''}`;
                        document.getElementById('selected-academy-owner').textContent = ownerName;
                        
                        resultsContainer.style.display = 'none';
                    }
                });
            });
        }
    });

    // Role select change visibility
    roleSelect.addEventListener('change', () => {
        const role = roleSelect.value;
        if (role === 'director') {
            directorFields.style.display = 'flex';
            inviteFields.style.display = 'none';
            parentFields.style.display = 'none';
            document.getElementById('signup-academy-name').required = true;
            document.getElementById('signup-academy-detail-address').required = true;
        } else if (role === 'teacher') {
            directorFields.style.display = 'none';
            inviteFields.style.display = 'flex';
            parentFields.style.display = 'none';
            document.getElementById('signup-academy-name').required = false;
            document.getElementById('signup-academy-detail-address').required = false;
        } else if (role === 'parent') {
            directorFields.style.display = 'none';
            inviteFields.style.display = 'flex';
            parentFields.style.display = 'flex';
            document.getElementById('signup-academy-name').required = false;
            document.getElementById('signup-academy-detail-address').required = false;
            document.getElementById('signup-child-name').required = true;
        }
    });

    btnCancel.addEventListener('click', () => {
        phoneInput.destroy();
        academyPhoneInput.destroy();
        academyAddressInput.destroy();
        renderTermsAgreementScreen(provider, snsId, termsAgreement);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // Validate phone number
        if (!phoneInput.isValid()) {
            document.getElementById('signup-phone').focus();
            return;
        }

        const role = roleSelect.value;
        const name = document.getElementById('signup-name').value.trim();
        const phone = document.getElementById('signup-phone').value.trim();
        
        let registerData = {
            provider,
            snsId,
            name,
            phone,
            role,
            termsAgreement
        };

        if (role === 'director') {
            if (!academyPhoneInput.isValid()) {
                document.getElementById('signup-academy-phone').focus();
                return;
            }
            if (!academyAddressInput.isValid()) {
                alert('학원 주소를 상세주소까지 올바르게 채워주세요.');
                document.getElementById('signup-academy-detail-address').focus();
                return;
            }

            registerData.academyName = document.getElementById('signup-academy-name').value.trim();
            registerData.academyPhone = document.getElementById('signup-academy-phone').value.trim();
            registerData.academyPostcode = document.getElementById('signup-academy-postcode').value.trim();
            registerData.academyAddress = document.getElementById('signup-academy-address').value.trim();
            registerData.academyDetailAddress = document.getElementById('signup-academy-detail-address').value.trim();
        } else {
            let targetAcademyId = null;
            if (activeTab === 'invite') {
                if (!verifiedAcademyId) {
                    inviteFeedback.textContent = '초대코드 확인 버튼을 눌러 먼저 학원을 확인해 주세요.';
                    inviteFeedback.style.color = 'var(--danger)';
                    inviteFeedback.style.display = 'block';
                    inviteCodeInput.focus();
                    return;
                }
                registerData.inviteCode = inviteCodeInput.value.trim().toUpperCase();
                targetAcademyId = verifiedAcademyId;
            } else {
                targetAcademyId = selectedAcademyIdInput.value;
                if (!targetAcademyId) {
                    searchFeedback.textContent = '가입할 학원을 검색 후 선택해 주세요.';
                    searchFeedback.style.color = 'var(--danger)';
                    searchFeedback.style.display = 'block';
                    searchInput.focus();
                    return;
                }
                registerData.academyId = targetAcademyId;
            }

            if (role === 'parent') {
                registerData.childName = document.getElementById('signup-child-name').value.trim();
            }
        }

        try {
            const newUser = stateStore.registerUser(registerData);
            localStorage.setItem(`turing_mock_sns_id_${provider}`, snsId);
            stateStore.setCurrentUser(newUser.id);
            
            // Clean up binders
            phoneInput.destroy();
            academyPhoneInput.destroy();
            academyAddressInput.destroy();

            showKakaoTalkToast(`회원가입 신청이 완료되었습니다!`);
            checkAuthAndRoute();
        } catch (err) {
            alert(err.message);
        }
    });
}

function renderPendingScreen(user) {
    const academy = stateStore.getAcademy(user.academyId);
    const academyName = academy ? academy.name : '지정된 학원';
    
    loginOverlay.innerHTML = `
        <div class="glass-card auth-flow-card" style="text-align: center;">
            <div style="font-size: 3.5rem; color: var(--danger); margin-bottom: 1rem;">
                <i class="fa-solid fa-hourglass-half fa-spin" style="animation-duration: 2.5s;"></i>
            </div>
            <span class="status-badge-pending">승인 대기 중 ⏳</span>
            <h2 class="auth-form-title" style="margin-bottom: 0.5rem;">가입 승인 대기 중</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem;">
                <strong>${user.name}</strong> 님의 가입 신청이 접수되었습니다.<br>
                원장님의 가입 승인을 기다리고 있습니다.
            </p>

            <div class="glass-card" style="background: rgba(0,0,0,0.01); text-align: left; padding: 16px; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 8px;">
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>신청 학원:</span> <strong>${academyName}</strong>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>사용자 구분:</span> <strong>${user.role === 'teacher' ? '선생님' : '학부모'}</strong>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>연락처:</span> <strong>${user.phone}</strong>
                </div>
                ${user.childName ? `
                <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>자녀 이름:</span> <strong>${user.childName}</strong>
                </div>` : ''}
            </div>

            <!-- Next Steps Guide -->
            <div class="glass-card" style="background: rgba(9, 132, 227, 0.03); border: 1px solid var(--border-color); text-align: left; padding: 16px; margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 8px 0; font-size: 0.88rem; font-weight: 700; color: var(--primary);">승인 완료 시 자동으로 로그인됩니다.</h4>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                    승인이 완료되면 이 화면이 닫히고 대시보드로 이동합니다. 정보 수정이 필요하시면 아래 버튼을 눌러 변경해 주세요.
                </p>
            </div>

            <div id="pending-edit-section" style="display: none; border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 0.5rem; text-align: left;">
                <h4 style="margin: 0 0 1rem 0; font-weight: 700; font-size: 0.95rem;">신청 정보 수정</h4>
                <form id="pending-edit-form" style="display: flex; flex-direction: column; gap: 0.8rem;">
                    <div class="auth-form-group">
                        <label for="edit-name">이름</label>
                        <input type="text" id="edit-name" value="${user.name}" required>
                    </div>
                    <div class="auth-form-group">
                        <label for="edit-phone">연락처</label>
                        <input type="tel" id="edit-phone" value="${user.phone}" required>
                    </div>
                    <div class="auth-form-group">
                        <label for="edit-invite-code">학원 초대 코드</label>
                        <input type="text" id="edit-invite-code" value="${academy ? academy.inviteCode : ''}" required maxlength="6" style="text-transform: uppercase;">
                        <span id="edit-invite-feedback" style="font-size: 0.75rem; color: var(--danger); display: none;"></span>
                    </div>
                    ${user.role === 'parent' ? `
                    <div class="auth-form-group">
                        <label for="edit-child-name">자녀 이름</label>
                        <input type="text" id="edit-child-name" value="${user.childName || ''}" required>
                    </div>` : ''}
                    <div style="display: flex; gap: 8px; margin-top: 0.5rem;">
                        <button type="button" class="btn btn-secondary" id="btn-cancel-edit" style="flex: 1; padding: 10px; justify-content: center;">취소</button>
                        <button type="submit" class="btn btn-primary" style="flex: 2; padding: 10px; justify-content: center;">수정 완료 및 재신청</button>
                    </div>
                </form>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;" id="pending-actions-section">
                <button class="btn btn-primary" id="btn-refresh-status" style="width: 100%; padding: 12px; font-weight: bold; justify-content: center;">
                    <i class="fa-solid fa-rotate" style="margin-right: 6px;"></i> 승인 상태 새로고침
                </button>
                <div style="display: flex; gap: 10px; width: 100%;">
                    <button class="btn btn-secondary" id="btn-show-edit" style="flex: 1; padding: 10px; justify-content: center;">신청 정보 수정 ✏️</button>
                    <button class="btn btn-secondary" id="btn-pending-logout" style="flex: 1; padding: 10px; color: var(--danger); justify-content: center;">로그아웃 🚪</button>
                </div>
            </div>
        </div>
    `;
    
    
    const btnRefresh = document.getElementById('btn-refresh-status');
    const btnShowEdit = document.getElementById('btn-show-edit');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const btnLogout = document.getElementById('btn-pending-logout');
    
    const editSection = document.getElementById('pending-edit-section');
    const actionsSection = document.getElementById('pending-actions-section');
    const editForm = document.getElementById('pending-edit-form');
    const editInviteInput = document.getElementById('edit-invite-code');
    const editInviteFeedback = document.getElementById('edit-invite-feedback');

    const phoneInputEl = document.getElementById('edit-phone');
    const phoneInput = PhoneNumberInput.bind(phoneInputEl);

    btnRefresh.addEventListener('click', () => {
        phoneInput.destroy();
        checkAuthAndRoute();
        showKakaoTalkToast("가입 승인 상태를 확인했습니다.");
    });

    btnShowEdit.addEventListener('click', () => {
        editSection.style.display = 'block';
        actionsSection.style.display = 'none';
    });

    btnCancelEdit.addEventListener('click', () => {
        editSection.style.display = 'none';
        actionsSection.style.display = 'flex';
    });

    btnLogout.addEventListener('click', () => {
        phoneInput.destroy();
        stateStore.logoutUser();
        checkAuthAndRoute();
    });

    editInviteInput.addEventListener('input', () => {
        const val = editInviteInput.value.trim().toUpperCase();
        if (val.length === 6) {
            const acad = stateStore.getAcademyByInviteCode(val);
            if (acad) {
                editInviteFeedback.style.color = 'var(--success)';
                editInviteFeedback.textContent = `✓ 확인됨: ${acad.name}`;
                editInviteFeedback.style.display = 'block';
            } else {
                editInviteFeedback.style.color = 'var(--danger)';
                editInviteFeedback.textContent = '❌ 유효하지 않은 학원 초대 코드입니다.';
                editInviteFeedback.style.display = 'block';
            }
        } else {
            editInviteFeedback.style.display = 'none';
        }
    });

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!phoneInput.isValid()) {
            phoneInputEl.focus();
            return;
        }

        const code = editInviteInput.value.trim().toUpperCase();
        const acad = stateStore.getAcademyByInviteCode(code);
        if (!acad) {
            editInviteFeedback.style.color = 'var(--danger)';
            editInviteFeedback.textContent = '❌ 유효하지 않은 학원 초대 코드입니다.';
            editInviteFeedback.style.display = 'block';
            editInviteInput.focus();
            return;
        }

        const name = document.getElementById('edit-name').value.trim();
        const phone = phoneInputEl.value.trim();
        const childName = user.role === 'parent' ? document.getElementById('edit-child-name').value.trim() : null;

        try {
            stateStore.updateUserRegistration(user.id, {
                name,
                phone,
                inviteCode: code,
                childName
            });
            phoneInput.destroy();
            showKakaoTalkToast("가입 신청 정보가 수정되어 재신청되었습니다.");
            checkAuthAndRoute();
        } catch (err) {
            alert(err.message);
        }
    });
}

function renderRejectedScreen(user) {
    const academy = stateStore.getAcademy(user.academyId);
    const academyName = academy ? academy.name : '지정된 학원';

    loginOverlay.innerHTML = `
        <div class="glass-card auth-flow-card" style="text-align: center;">
            <div style="font-size: 3.5rem; color: #d63031; margin-bottom: 1rem;">
                <i class="fa-solid fa-circle-xmark"></i>
            </div>
            <span class="status-badge-rejected">가입 반려됨 ❌</span>
            <h2 class="auth-form-title" style="margin-bottom: 0.5rem;">가입 승인이 거절되었습니다</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem;">
                신청에 아래와 같은 반려 사유가 있습니다.<br>
                정보를 수정한 후 재신청해 주시기 바랍니다.
            </p>

            <div class="glass-card" style="background: rgba(214, 48, 49, 0.05); text-align: left; padding: 16px; border: 1px solid rgba(214, 48, 49, 0.15); margin-bottom: 1.5rem;">
                <div style="font-size: 0.85rem; font-weight: 700; color: #d63031; margin-bottom: 6px;">반려 사유:</div>
                <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">${user.rejectReason || '사유가 기재되지 않았습니다.'}</div>
            </div>

            <div id="rejected-edit-section" style="display: none; border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 0.5rem; text-align: left;">
                <h4 style="margin: 0 0 1rem 0; font-weight: 700; font-size: 0.95rem;">가입 정보 수정 후 재신청</h4>
                <form id="rejected-edit-form" style="display: flex; flex-direction: column; gap: 0.8rem;">
                    <div class="auth-form-group">
                        <label for="rej-edit-name">이름</label>
                        <input type="text" id="rej-edit-name" value="${user.name}" required>
                    </div>
                    <div class="auth-form-group">
                        <label for="rej-edit-phone">연락처</label>
                        <input type="tel" id="rej-edit-phone" value="${user.phone}" required>
                    </div>
                    <div class="auth-form-group">
                        <label for="rej-edit-invite-code">학원 초대 코드</label>
                        <input type="text" id="rej-edit-invite-code" value="${academy ? academy.inviteCode : ''}" required maxlength="6" style="text-transform: uppercase;">
                        <span id="rej-edit-invite-feedback" style="font-size: 0.75rem; color: var(--danger); display: none;"></span>
                    </div>
                    ${user.role === 'parent' ? `
                    <div class="auth-form-group">
                        <label for="rej-edit-child-name">자녀 이름</label>
                        <input type="text" id="rej-edit-child-name" value="${user.childName || ''}" required>
                    </div>` : ''}
                    <div style="display: flex; gap: 8px; margin-top: 0.5rem;">
                        <button type="button" class="btn btn-secondary" id="btn-rej-cancel-edit" style="flex: 1; padding: 10px; justify-content: center;">취소</button>
                        <button type="submit" class="btn btn-primary" style="flex: 2; padding: 10px; justify-content: center;">수정 완료 및 재신청</button>
                    </div>
                </form>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;" id="rejected-actions-section">
                <button class="btn btn-primary" id="btn-rej-show-edit" style="width: 100%; padding: 12px; font-weight: bold; justify-content: center;">
                    정보 수정 후 재신청 ✏️
                </button>
                <button class="btn btn-secondary" id="btn-rej-logout" style="width: 100%; padding: 10px; color: var(--danger); justify-content: center;">
                    로그아웃 🚪
                </button>
            </div>
        </div>
    `;

    const btnShowEdit = document.getElementById('btn-rej-show-edit');
    const btnCancelEdit = document.getElementById('btn-rej-cancel-edit');
    const btnLogout = document.getElementById('btn-rej-logout');
    
    const editSection = document.getElementById('rejected-edit-section');
    const actionsSection = document.getElementById('rejected-actions-section');
    const editForm = document.getElementById('rejected-edit-form');
    const editInviteInput = document.getElementById('rej-edit-invite-code');
    const editInviteFeedback = document.getElementById('rej-edit-invite-feedback');

    const phoneInputEl = document.getElementById('rej-edit-phone');
    const phoneInput = PhoneNumberInput.bind(phoneInputEl);

    btnShowEdit.addEventListener('click', () => {
        editSection.style.display = 'block';
        actionsSection.style.display = 'none';
    });

    btnCancelEdit.addEventListener('click', () => {
        editSection.style.display = 'none';
        actionsSection.style.display = 'flex';
    });

    btnLogout.addEventListener('click', () => {
        phoneInput.destroy();
        stateStore.logoutUser();
        checkAuthAndRoute();
    });

    editInviteInput.addEventListener('input', () => {
        const val = editInviteInput.value.trim().toUpperCase();
        if (val.length === 6) {
            const acad = stateStore.getAcademyByInviteCode(val);
            if (acad) {
                editInviteFeedback.style.color = 'var(--success)';
                editInviteFeedback.textContent = `✓ 확인됨: ${acad.name}`;
                editInviteFeedback.style.display = 'block';
            } else {
                editInviteFeedback.style.color = 'var(--danger)';
                editInviteFeedback.textContent = '❌ 유효하지 않은 학원 초대 코드입니다.';
                editInviteFeedback.style.display = 'block';
            }
        } else {
            editInviteFeedback.style.display = 'none';
        }
    });

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!phoneInput.isValid()) {
            phoneInputEl.focus();
            return;
        }

        const code = editInviteInput.value.trim().toUpperCase();
        const acad = stateStore.getAcademyByInviteCode(code);
        if (!acad) {
            editInviteFeedback.style.color = 'var(--danger)';
            editInviteFeedback.textContent = '❌ 유효하지 않은 학원 초대 코드입니다.';
            editInviteFeedback.style.display = 'block';
            editInviteInput.focus();
            return;
        }

        const name = document.getElementById('rej-edit-name').value.trim();
        const phone = phoneInputEl.value.trim();
        const childName = user.role === 'parent' ? document.getElementById('rej-edit-child-name').value.trim() : null;

        try {
            stateStore.updateUserRegistration(user.id, {
                name,
                phone,
                inviteCode: code,
                childName
            });
            phoneInput.destroy();
            showKakaoTalkToast("정보를 수정하여 가입을 재신청하였습니다.");
            checkAuthAndRoute();
        } catch (err) {
            alert(err.message);
        }
    });
}

function openProfileEditModal(user) {
    openModal(`
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <h3 style="margin: 0; font-weight: 700; font-size: 1.25rem;">
                <i class="fa-solid fa-user-pen" style="color: var(--primary); margin-right: 8px;"></i>
                내 정보 수정
            </h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: -10px;">
                계정의 기본 프로필 및 학원 연결 정보를 설정합니다.
            </p>
            
            <form id="profile-edit-form" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="auth-form-group">
                    <label for="edit-profile-name">이름</label>
                    <input type="text" id="edit-profile-name" value="${user.name}" required>
                </div>
                <div class="auth-form-group">
                    <label for="edit-profile-phone">연락처</label>
                    <input type="tel" id="edit-profile-phone" value="${user.phone}" required>
                </div>

                <!-- Academy switching (if more than 1 approved academy) -->
                ${(user.academies && user.academies.filter(a => a.status === 'approved').length > 1) ? `
                <div class="auth-form-group">
                    <label for="profile-active-academy">활성 학원 전환</label>
                    <select id="profile-active-academy" class="form-control" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 8px;">
                        ${user.academies.filter(a => a.status === 'approved').map(ua => {
                            const acad = stateStore.getAcademy(ua.academyId);
                            return `<option value="${ua.academyId}" ${ua.academyId === user.academyId ? 'selected' : ''}>${acad ? acad.name : '알 수 없는 학원'}</option>`;
                        }).join('')}
                    </select>
                </div>
                ` : `
                <div style="font-size: 0.85rem; color: var(--text-muted); padding: 8px; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <strong>소속 학원:</strong> ${stateStore.getAcademy(user.academyId)?.name || '없음'}
                </div>
                `}
                
                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 0.5rem;">
                    <button type="button" class="btn btn-secondary" id="btn-cancel-profile-edit" data-close-modal style="width: 120px; padding: 10px; justify-content: center; margin-bottom: 0;">취소</button>
                    <button type="submit" class="btn btn-primary" style="width: 140px; padding: 10px; justify-content: center; margin-bottom: 0;">저장 완료</button>
                </div>
            </form>

            <!-- Accordion for Additional Academy Join Request -->
            ${user.role !== 'director' ? `
            <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
                <button type="button" id="btn-toggle-add-academy" class="btn btn-secondary" style="width: 100%; justify-content: space-between; font-size: 0.85rem; padding: 10px;">
                    <span><i class="fa-solid fa-plus" style="margin-right: 6px;"></i> 새로운 학원 추가 가입신청</span>
                    <i class="fa-solid fa-chevron-down" id="arrow-add-academy"></i>
                </button>
                
                <div id="add-academy-section" style="display: none; flex-direction: column; gap: 1rem; margin-top: 1rem; padding: 1rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: rgba(0,0,0,0.02);">
                    <div class="tab-container" style="display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 0.5rem;">
                        <button type="button" id="add-tab-btn-invite" class="auth-tab-btn active" style="flex: 1; padding: 8px; background: none; border: none; border-bottom: 2px solid var(--primary); color: var(--text-main); font-weight: bold; cursor: pointer; font-size: 0.8rem;">초대코드</button>
                        <button type="button" id="add-tab-btn-search" class="auth-tab-btn" style="flex: 1; padding: 8px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: normal; cursor: pointer; font-size: 0.8rem;">학원명 검색</button>
                    </div>

                    <!-- Invite Code Form -->
                    <div id="add-invite-section" style="display: flex; flex-direction: column; gap: 0.8rem;">
                        <div class="auth-form-group">
                            <label for="add-invite-code" style="font-size: 0.8rem;">학원 초대 코드</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="add-invite-code" placeholder="초대코드를 입력해주세요." maxlength="6" style="text-transform: uppercase; flex: 1; margin-bottom: 0; font-size: 0.85rem;">
                                <button type="button" id="btn-add-verify-invite" class="btn btn-secondary btn-sm" style="padding: 0 12px; font-size: 0.8rem; margin-bottom: 0; justify-content: center;">확인</button>
                            </div>
                            <span id="add-invite-code-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                            
                            <div id="add-invite-academy-card" style="display: none; background: rgba(9, 132, 227, 0.05); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px; margin-top: 6px; font-size: 0.8rem; line-height: 1.4;">
                                <div><strong>학원명:</strong> <span id="add-invite-name">-</span></div>
                                <div><strong>주소:</strong> <span id="add-invite-address">-</span></div>
                                <div><strong>관리자:</strong> <span id="add-invite-owner">-</span> 원장</div>
                            </div>
                        </div>
                    </div>

                    <!-- Academy Search Form -->
                    <div id="add-search-section" style="display: none; flex-direction: column; gap: 0.8rem;">
                        <div class="auth-form-group">
                            <label for="add-academy-search-input" style="font-size: 0.8rem;">학원명 검색</label>
                            <div style="display: flex; gap: 8px;">
                                <input type="text" id="add-academy-search-input" placeholder="학원명을 입력해 주세요." style="margin-bottom: 0; flex: 1; font-size: 0.85rem;">
                                <button type="button" id="btn-add-academy-search" class="btn btn-secondary" style="padding: 0 12px; font-size: 0.8rem; margin-bottom: 0; justify-content: center;">검색</button>
                            </div>
                            
                            <div id="add-search-results-container" style="max-height: 120px; overflow-y: auto; display: none; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-top: 6px; background: rgba(255,255,255,0.05); padding: 4px;"></div>
                            <span id="add-search-feedback" style="font-size: 0.75rem; color: var(--danger); display: none; margin-top: 4px;"></span>
                            
                            <input type="hidden" id="add-selected-academy-id">
                            <div id="add-selected-academy-card" style="display: none; background: rgba(0, 184, 148, 0.05); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px; margin-top: 6px; font-size: 0.8rem; line-height: 1.4;">
                                <div><strong>학원명:</strong> <span id="add-selected-name">-</span></div>
                                <div><strong>주소:</strong> <span id="add-selected-address">-</span></div>
                                <div><strong>관리자:</strong> <span id="add-selected-owner">-</span> 원장</div>
                            </div>
                        </div>
                    </div>

                    <button type="button" id="btn-submit-additional-join" class="btn btn-primary" style="width: 100%; justify-content: center; font-size: 0.85rem; padding: 10px; margin-top: 0.5rem; margin-bottom: 0;">이 학원에 가입신청하기</button>
                </div>
            </div>
            ` : ''}

            <div style="border-top: 1px solid var(--border-color); margin-top: 0.5rem; padding-top: 1rem; display: flex; justify-content: flex-end;">
                <button type="button" id="btn-request-withdrawal" style="background: none; border: none; color: var(--danger); font-size: 0.8rem; text-decoration: underline; cursor: pointer; opacity: 0.8;">
                    회원 탈퇴하기
                </button>
            </div>
        </div>
    `, (contentArea) => {
        // Set dynamic width and padding directly on modal content container to avoid double padding/nested glass card issues
        contentArea.style.maxWidth = '480px';
        contentArea.style.padding = '1.8rem 2rem';
        const form = contentArea.querySelector('#profile-edit-form');
        const phoneInputEl = contentArea.querySelector('#edit-profile-phone');
        const phoneInput = PhoneNumberInput.bind(phoneInputEl);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!phoneInput.isValid()) {
                phoneInputEl.focus();
                return;
            }

            const name = contentArea.querySelector('#edit-profile-name').value.trim();
            const phone = phoneInputEl.value.trim();
            
            try {
                const activeAcademySelect = contentArea.querySelector('#profile-active-academy');
                if (activeAcademySelect && activeAcademySelect.value !== user.academyId) {
                    user.academyId = activeAcademySelect.value;
                    stateStore.saveDB();
                }

                stateStore.updateUserProfile(user.id, { name, phone });
                phoneInput.destroy();

                showKakaoTalkToast("내 정보가 성공적으로 수정되었습니다.");
                closeModal();
                checkAuthAndRoute();
            } catch (err) {
                alert(err.message);
            }
        });

        // Add handler for close buttons to clean up phoneInput
        const cancelBtn = contentArea.querySelector('#btn-cancel-profile-edit');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                phoneInput.destroy();
            });
        }

        const btnWithdrawal = contentArea.querySelector('#btn-request-withdrawal');
        if (btnWithdrawal) {
            btnWithdrawal.addEventListener('click', () => {
                phoneInput.destroy();
                openWithdrawalModal(user);
            });
        }

        // Accordion toggle
        const btnToggleAdd = contentArea.querySelector('#btn-toggle-add-academy');
        const addSection = contentArea.querySelector('#add-academy-section');
        const arrowAdd = contentArea.querySelector('#arrow-add-academy');

        if (btnToggleAdd && addSection) {
            btnToggleAdd.addEventListener('click', () => {
                if (addSection.style.display === 'none') {
                    addSection.style.display = 'flex';
                    arrowAdd.className = 'fa-solid fa-chevron-up';
                } else {
                    addSection.style.display = 'none';
                    arrowAdd.className = 'fa-solid fa-chevron-down';
                }
            });

            // Tabs inside additional request
            const addTabBtnInvite = contentArea.querySelector('#add-tab-btn-invite');
            const addTabBtnSearch = contentArea.querySelector('#add-tab-btn-search');
            const addInviteSec = contentArea.querySelector('#add-invite-section');
            const addSearchSec = contentArea.querySelector('#add-search-section');
            let additionalActiveTab = 'invite';

            addTabBtnInvite.addEventListener('click', () => {
                additionalActiveTab = 'invite';
                addTabBtnInvite.style.borderBottom = '2px solid var(--primary)';
                addTabBtnInvite.style.fontWeight = 'bold';
                addTabBtnInvite.style.color = 'var(--text-main)';
                
                addTabBtnSearch.style.borderBottom = '2px solid transparent';
                addTabBtnSearch.style.fontWeight = 'normal';
                addTabBtnSearch.style.color = 'var(--text-muted)';
                
                addInviteSec.style.display = 'flex';
                addSearchSec.style.display = 'none';
            });

            addTabBtnSearch.addEventListener('click', () => {
                additionalActiveTab = 'search';
                addTabBtnSearch.style.borderBottom = '2px solid var(--primary)';
                addTabBtnSearch.style.fontWeight = 'bold';
                addTabBtnSearch.style.color = 'var(--text-main)';
                
                addTabBtnInvite.style.borderBottom = '2px solid transparent';
                addTabBtnInvite.style.fontWeight = 'normal';
                addTabBtnInvite.style.color = 'var(--text-muted)';
                
                addSearchSec.style.display = 'flex';
                addInviteSec.style.display = 'none';
            });

            // Verify Code for addition
            const addInviteInput = contentArea.querySelector('#add-invite-code');
            const btnAddVerify = contentArea.querySelector('#btn-add-verify-invite');
            const addInviteFeedback = contentArea.querySelector('#add-invite-code-feedback');
            const addInviteCard = contentArea.querySelector('#add-invite-academy-card');
            let addVerifiedAcademyId = null;

            btnAddVerify.addEventListener('click', () => {
                const val = addInviteInput.value.trim().toUpperCase();
                if (val.length === 0) {
                    addInviteFeedback.textContent = '초대코드를 입력해주세요.';
                    addInviteFeedback.style.color = 'var(--danger)';
                    addInviteFeedback.style.display = 'block';
                    addInviteCard.style.display = 'none';
                    addVerifiedAcademyId = null;
                    return;
                }

                const inviteRecord = stateStore.getAcademyInviteCodeObject(val);
                if (!inviteRecord) {
                    addInviteFeedback.textContent = '일치하는 학원 초대코드가 없습니다.';
                    addInviteFeedback.style.color = 'var(--danger)';
                    addInviteFeedback.style.display = 'block';
                    addInviteCard.style.display = 'none';
                    addVerifiedAcademyId = null;
                } else if (inviteRecord.status !== 'active') {
                    addInviteFeedback.textContent = '현재 사용할 수 없는 초대코드입니다.';
                    addInviteFeedback.style.color = 'var(--danger)';
                    addInviteFeedback.style.display = 'block';
                    addInviteCard.style.display = 'none';
                    addVerifiedAcademyId = null;
                } else {
                    const acad = stateStore.getAcademy(inviteRecord.academyId);
                    if (acad) {
                        const owner = stateStore.getUser(acad.ownerUserId);
                        const ownerName = owner ? owner.name : '알 수 없음';
                        
                        addInviteFeedback.style.display = 'none';
                        addInviteCard.style.display = 'block';
                        contentArea.querySelector('#add-invite-name').textContent = acad.name;
                        contentArea.querySelector('#add-invite-address').textContent = `${acad.address} ${acad.detailAddress || ''}`;
                        contentArea.querySelector('#add-invite-owner').textContent = ownerName;
                        addVerifiedAcademyId = acad.id;
                    } else {
                        addInviteFeedback.textContent = '학원 정보를 찾을 수 없습니다.';
                        addInviteFeedback.style.color = 'var(--danger)';
                        addInviteFeedback.style.display = 'block';
                        addInviteCard.style.display = 'none';
                        addVerifiedAcademyId = null;
                    }
                }
            });

            // Search for addition
            const addSearchInput = contentArea.querySelector('#add-academy-search-input');
            const btnAddSearch = contentArea.querySelector('#btn-add-academy-search');
            const addResultsCont = contentArea.querySelector('#add-search-results-container');
            const addSearchFeedback = contentArea.querySelector('#add-search-feedback');
            const addSelectedCard = contentArea.querySelector('#add-selected-academy-card');
            const addSelectedIdInput = contentArea.querySelector('#add-selected-academy-id');

            btnAddSearch.addEventListener('click', () => {
                const query = addSearchInput.value.trim();
                if (query.length === 0) {
                    addSearchFeedback.textContent = '검색어를 입력해 주세요.';
                    addSearchFeedback.style.color = 'var(--danger)';
                    addSearchFeedback.style.display = 'block';
                    addResultsCont.style.display = 'none';
                    return;
                }

                const results = stateStore.searchAcademies(query);
                if (results.length === 0) {
                    addSearchFeedback.textContent = '일치하는 학원을 찾을 수 없습니다. 학원명 또는 주소를 다시 확인해주세요.';
                    addSearchFeedback.style.color = 'var(--danger)';
                    addSearchFeedback.style.display = 'block';
                    addResultsCont.style.display = 'none';
                } else {
                    addSearchFeedback.style.display = 'none';
                    addResultsCont.style.display = 'block';
                    addResultsCont.innerHTML = results.map(a => {
                        const owner = stateStore.getUser(a.ownerUserId);
                        const ownerName = owner ? owner.name : '알 수 없음';
                        return `
                            <div class="add-search-item" data-id="${a.id}" style="padding: 8px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; font-size: 0.85rem;">
                                <div style="font-weight: bold; color: var(--text-main);">${a.name}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${a.address} ${a.detailAddress || ''}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">대표 관리자: ${ownerName} 원장</div>
                            </div>
                        `;
                    }).join('');

                    addResultsCont.querySelectorAll('.add-search-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const id = item.dataset.id;
                            const acad = results.find(a => a.id === id);
                            if (acad) {
                                const owner = stateStore.getUser(acad.ownerUserId);
                                const ownerName = owner ? owner.name : '알 수 없음';
                                
                                addSelectedIdInput.value = acad.id;
                                addSelectedCard.style.display = 'block';
                                contentArea.querySelector('#add-selected-name').textContent = acad.name;
                                contentArea.querySelector('#add-selected-address').textContent = `${acad.address} ${acad.detailAddress || ''}`;
                                contentArea.querySelector('#add-selected-owner').textContent = ownerName;
                                
                                addResultsCont.style.display = 'none';
                            }
                        });
                    });
                }
            });

            // Submit additional request
            const btnSubmitAdd = contentArea.querySelector('#btn-submit-additional-join');
            btnSubmitAdd.addEventListener('click', () => {
                let targetAcademyId = null;
                let method = 'invite_code';

                if (additionalActiveTab === 'invite') {
                    if (!addVerifiedAcademyId) {
                        addInviteFeedback.textContent = '초대코드 확인 버튼을 눌러 먼저 학원을 확인해 주세요.';
                        addInviteFeedback.style.color = 'var(--danger)';
                        addInviteFeedback.style.display = 'block';
                        addInviteInput.focus();
                        return;
                    }
                    targetAcademyId = addVerifiedAcademyId;
                    method = 'invite_code';
                } else {
                    targetAcademyId = addSelectedIdInput.value;
                    if (!targetAcademyId) {
                        addSearchFeedback.textContent = '가입할 학원을 검색 후 선택해 주세요.';
                        addSearchFeedback.style.color = 'var(--danger)';
                        addSearchFeedback.style.display = 'block';
                        addSearchInput.focus();
                        return;
                    }
                    method = 'academy_search';
                }

                try {
                    stateStore.createJoinRequest(user.id, targetAcademyId, method);
                    phoneInput.destroy();
                    showKakaoTalkToast("학원 추가 가입신청이 성공적으로 접수되었습니다. 원장님의 승인을 기다려주세요.");
                    closeModal();
                    checkAuthAndRoute();
                } catch (err) {
                    alert(err.message);
                }
            });
        }
    });
}

function openWithdrawalModal(user) {
    openModal(`
        <div class="glass-card" style="padding: 2.2rem; width: 440px; display: flex; flex-direction: column; gap: 1.5rem;">
            <h3 style="margin: 0; font-weight: 700; font-size: 1.25rem; color: var(--danger);">
                <i class="fa-solid fa-user-slash" style="margin-right: 8px;"></i> 회원 탈퇴 안내
            </h3>
            <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; margin-top: -5px;">
                탈퇴 시 고객님의 개인 정보 및 소셜 로그인 연동 값은 소프트 델리트(비식별화) 처리됩니다.<br>
                단, 기존의 출결 증명서, 수납 대장, 통계 분석 자료 등 **학원의 행정 증빙 보관**을 위해 고객님과 연계된 원생 정보는 삭제되지 않고 **'퇴원(discharged)' 상태로 전환되어 안전하게 보관**됩니다.
            </p>
            
            <form id="withdrawal-confirm-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.88rem; cursor: pointer; user-select: none; line-height: 1.4;">
                    <input type="checkbox" id="withdrawal-agree-chk" required style="accent-color: var(--danger); margin-top: 3px;">
                    <span>위 안내 사항을 모두 읽었으며, 데이터 보존 및 탈퇴 처리에 동의합니다. <span style="color: var(--danger);">*</span></span>
                </label>
                
                <div style="display: flex; gap: 10px; margin-top: 1rem;">
                    <button type="button" class="btn btn-secondary" id="btn-cancel-withdrawal" style="flex: 1; padding: 10px; justify-content: center;">취소</button>
                    <button type="submit" class="btn btn-danger" style="flex: 2; padding: 10px; justify-content: center;">탈퇴 완료</button>
                </div>
            </form>
        </div>
    `, (contentArea) => {
        const cancelBtn = contentArea.querySelector('#btn-cancel-withdrawal');
        cancelBtn.addEventListener('click', () => {
            openProfileEditModal(user);
        });

        const form = contentArea.querySelector('#withdrawal-confirm-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const chk = contentArea.querySelector('#withdrawal-agree-chk');
            if (!chk || !chk.checked) {
                alert('안내 사항 동의 체크박스를 선택해야 탈퇴가 가능합니다.');
                return;
            }

            try {
                stateStore.withdrawUser(user.id);
                showKakaoTalkToast("회원 탈퇴 및 원생 퇴원 처리가 완료되었습니다.");
                closeModal();
                checkAuthAndRoute();
            } catch (err) {
                alert(err.message);
            }
        });
    });
}


// Routing - View Swap Controller
async function switchView(viewName) {
    if (currentView === viewName) return;

    // Toggle kiosk mode body class
    if (viewName === 'dir-kiosk-attendance') {
        document.body.classList.add('kiosk-mode');
    } else {
        document.body.classList.remove('kiosk-mode');
    }

    // Clean up previous view subscribers
    if (viewCleanup) {
        viewCleanup();
        viewCleanup = null;
    }

    currentView = viewName;
    pageTitle.textContent = VIEW_TITLES[viewName] || '대시보드';

    // Show loading state
    dashboardContent.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 16px; color: var(--text-muted);">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            <span>화면을 구성 중입니다...</span>
        </div>
    `;

    try {
        // Load and render modules dynamically
        let renderFn = viewModules[viewName];

        if (!renderFn) {
            let modulePath = '';
            if (viewName.startsWith('dir-')) {
                modulePath = './views/director.js';
            } else if (viewName.startsWith('tea-')) {
                modulePath = './views/teacher.js';
            } else if (viewName.startsWith('stu-')) {
                modulePath = './views/student.js';
            }

            const module = await import(modulePath);
            // Save routes
            viewModules['dir-dashboard'] = module.renderDashboard;
            viewModules['dir-students'] = module.renderStudents;
            viewModules['dir-payments'] = module.renderPayments;
            viewModules['dir-teachers'] = module.renderTeachers;
            viewModules['dir-schedules'] = module.renderSchedules;
            viewModules['dir-attendance'] = module.renderDirectorAttendance;
            viewModules['dir-kiosk-attendance'] = module.renderKioskAttendance;
            viewModules['dir-books'] = module.renderBooks;
            viewModules['dir-books-elapsed'] = module.renderBooksElapsed;
            viewModules['dir-subjects'] = module.renderSubjects;
            viewModules['dir-approvals'] = module.renderApprovals;
            viewModules['dir-communication'] = module.renderCommunication;
            viewModules['dir-academy-info'] = module.renderAcademyInfo;

            viewModules['tea-attendance'] = module.renderAttendance;
            viewModules['tea-lessons'] = module.renderLessons;
            viewModules['tea-schedule'] = module.renderSchedule;

            viewModules['stu-calendar'] = module.renderCalendar;
            viewModules['stu-billing'] = module.renderBilling;
            viewModules['stu-journal'] = module.renderJournal;
            viewModules['stu-communication'] = module.renderStudentCommunication;

            renderFn = viewModules[viewName];
        }

        if (renderFn) {
            // Render view and capture any subscription unsubscribe callbacks
            viewCleanup = renderFn(dashboardContent);
        } else {
            dashboardContent.innerHTML = `<div class="glass-card">구현되지 않은 뷰입니다. (${viewName})</div>`;
        }
    } catch (err) {
        console.error('Error switching views', err);
        dashboardContent.innerHTML = `
            <div class="glass-card" style="text-align: center; border-color: var(--danger-light); padding: 3rem;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--danger); margin-bottom: 1rem;"></i>
                <h3 style="margin-bottom: 0.5rem;">화면을 로드하지 못했습니다.</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem;">${err.message}</p>
            </div>
        `;
    }
}

// KakaoTalk Toast simulation drawer
function showKakaoTalkToast(message) {
    const toast = document.createElement('div');
    toast.className = 'kakaotalk-toast'; // Visual styling is adjusted in CSS to match a dark system toast card
    
    let title = '시스템 알림';
    let cleanMessage = message;
    if (message.startsWith('[튜링 알림톡]')) {
        title = '알림톡 발송 (가상)';
        cleanMessage = message.replace('[튜링 알림톡]\n', '');
    } else if (message.includes('완료') || message.includes('성공')) {
        title = '성공';
    }
    
    const formattedMessage = cleanMessage.replace(/\n/g, '<br>');

    toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px; margin-bottom: 2px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-circle-info" style="color: var(--primary); font-size: 0.95rem;"></i>
                <span style="font-weight: 700; font-size: 0.88rem; color: #f8fafc;">${title}</span>
            </div>
            <button class="toast-close-btn" style="line-height: 1; padding: 0;" title="닫기">&times;</button>
        </div>
        <div class="toast-message-body" style="color: #cbd5e1;">${formattedMessage}</div>
    `;

    toastContainer.appendChild(toast);

    // Toast Close click
    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
        removeToast(toast);
    });

    // Auto dismiss after 6 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            removeToast(toast);
        }
    }, 6000);
}

function removeToast(toast) {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    toast.addEventListener('animationend', (e) => {
        if (e.animationName === 'fadeOut' && toast.parentNode) {
            toast.remove();
        }
    });
}

// Common Modal Open / Close Helpers
export function openModal(htmlContent, onInit = null) {
    const contentArea = document.getElementById('modal-content-area');
    contentArea.style.maxWidth = ''; // Reset custom max-width override
    contentArea.style.padding = ''; // Reset custom padding override
    contentArea.style.height = ''; // Reset custom height override
    contentArea.innerHTML = htmlContent;
    commonModal.classList.add('show');
    
    if (onInit) {
        onInit(contentArea);
    }

    // Add default close trigger to any button marked with data-close-modal or .modal-close after onInit content builds
    const closeTriggers = contentArea.querySelectorAll('[data-close-modal], .modal-close');
    closeTriggers.forEach(el => {
        el.addEventListener('click', closeModal);
    });
}

export function closeModal() {
    commonModal.classList.remove('show');
    // Allow animation to finish before clearing
    setTimeout(() => {
        const contentArea = document.getElementById('modal-content-area');
        contentArea.style.maxWidth = ''; // Reset custom max-width override
        contentArea.style.padding = ''; // Reset custom padding override
        contentArea.style.height = ''; // Reset custom height override
        contentArea.innerHTML = '';
        contentArea.classList.remove('layout-fixed');
    }, 300);
}

window.closeModal = closeModal; // Allow inline triggers if needed
