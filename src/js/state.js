// state.js - Central State Store and Database for Turing Music Academy
 
const DB_KEY = 'turing_academy_db_v3';
 
// Default initial database structure
const DEFAULT_DB = {
    settings: {
        sendKakaoAlert: true, // Whether to simulate KakaoTalk alerts
        academyName: '튜링 음악학원',
        businessNumber: '120-00-00000',
        representative: '김하은',
        phone: '02-1234-5678',
        address: '서울시 서초구 반포동 123-4',
        corporateName: '비아렙스'
    },
    teachers: [
        { id: 'T1', name: '문승현', instrument: '피아노', phone: '010-1111-1001', email: 'shmoon@turing.com', color: '#ffb3c1' },
        { id: 'T2', name: '성어진', instrument: '바이올린', phone: '010-1111-1002', email: 'ejseong@turing.com', color: '#d6b3ff' },
        { id: 'T3', name: '안혜림', instrument: '기타/우쿨렐레', phone: '010-1111-1003', email: 'hrahn@turing.com', color: '#ffd699' },
        { id: 'T4', name: '양지숙', instrument: '보컬', phone: '010-1111-1004', email: 'jsyang@turing.com', color: '#ffcc99' },
        { id: 'T5', name: '엄소연', instrument: '피아노', phone: '010-1111-1005', email: 'syeom@turing.com', color: '#b3f0e1' },
        { id: 'T6', name: '이동은', instrument: '바이올린', phone: '010-1111-1006', email: 'delee@turing.com', color: '#b3f2b3' },
        { id: 'T7', name: '이해원', instrument: '플루트', phone: '010-1111-1007', email: 'hwlee@turing.com', color: '#b3e0ff' },
        { id: 'T8', name: '정은비', instrument: '오보에/피아노', phone: '010-1111-1008', email: 'ebjung@turing.com', color: '#99ccff' }
    ],
    students: [
        { id: 'S1', name: '최다은', phone: '010-9999-1111', parentPhone: '010-8888-2222', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-01-10', age: 10, school: '하모초등학교' },
        { id: 'S2', name: '김제나', phone: '010-9999-0002', parentPhone: '010-8888-0002', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-02-12', age: 11, school: '예술초등학교' },
        { id: 'S3', name: '박수호', phone: '010-9999-0003', parentPhone: '010-8888-0003', teacherId: 'T8', instrument: '오보에', fee: 180000, dueDay: 15, enrollDate: '2026-03-05', age: 9, school: '음악초등학교' },
        { id: 'S4', name: '신지준', phone: '010-9999-0004', parentPhone: '010-8888-0004', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 5, enrollDate: '2026-04-18', age: 8, school: '하모초등학교' },
        { id: 'S5', name: '채은재', phone: '010-9999-0005', parentPhone: '010-8888-0005', teacherId: 'T8', instrument: '오보에', fee: 190000, dueDay: 20, enrollDate: '2026-04-20', age: 12, school: '예술중학교' },
        { id: 'S6', name: '곽도현', phone: '010-9999-0006', parentPhone: '010-8888-0006', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 10, enrollDate: '2026-02-10', age: 11, school: '음악초등학교' },
        { id: 'S7', name: '연우주', phone: '010-9999-0007', parentPhone: '010-8888-0007', teacherId: 'T2', instrument: '바이올린', fee: 180000, dueDay: 15, enrollDate: '2026-03-12', age: 13, school: '예술중학교' },
        { id: 'S8', name: '신서하', phone: '010-9999-0008', parentPhone: '010-8888-0008', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 5, enrollDate: '2026-01-05', age: 9, school: '하모초등학교' },
        { id: 'S9', name: '신유원', phone: '010-9999-0009', parentPhone: '010-8888-0009', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 25, enrollDate: '2026-03-24', age: 10, school: '하모초등학교' },
        { id: 'S10', name: '박소윤', phone: '010-9999-0010', parentPhone: '010-8888-0010', teacherId: 'T5', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-05-01', age: 7, school: '하모유치원' },
        { id: 'S11', name: '이유림', phone: '010-9999-0011', parentPhone: '010-8888-0011', teacherId: 'T5', instrument: '피아노', fee: 150000, dueDay: 12, enrollDate: '2026-04-05', age: 8, school: '음악초등학교' },
        { id: 'S12', name: '고세민', phone: '010-9999-0012', parentPhone: '010-8888-0012', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 10, enrollDate: '2026-03-20', age: 10, school: '음악초등학교' },
        { id: 'S13', name: '고승현', phone: '010-9999-0013', parentPhone: '010-8888-0013', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 15, enrollDate: '2026-04-10', age: 9, school: '하모초등학교' },
        { id: 'S14', name: '이혜원', phone: '010-9999-0014', parentPhone: '010-8888-0014', teacherId: 'T1', instrument: '피아노', fee: 160000, dueDay: 10, enrollDate: '2026-01-15', age: 12, school: '음악초등학교' },
        { id: 'S15', name: '한주원', phone: '010-9999-0015', parentPhone: '010-8888-0015', teacherId: 'T5', instrument: '피아노', fee: 150000, dueDay: 12, enrollDate: '2026-05-02', age: 11, school: '하모초등학교' },
        { id: 'S16', name: '반하온', phone: '010-9999-0016', parentPhone: '010-8888-0016', teacherId: 'T3', instrument: '기타', fee: 170000, dueDay: 15, enrollDate: '2026-02-20', age: 8, school: '하모초등학교' },
        { id: 'S17', name: '신하율', phone: '010-9999-0017', parentPhone: '010-8888-0017', teacherId: 'T3', instrument: '기타', fee: 170000, dueDay: 15, enrollDate: '2026-03-05', age: 9, school: '하모초등학교' },
        { id: 'S18', name: '김도하', phone: '010-9999-0018', parentPhone: '010-8888-0018', teacherId: 'T6', instrument: '바이올린', fee: 180000, dueDay: 10, enrollDate: '2026-02-11', age: 10, school: '음악초등학교' },
        { id: 'S19', name: '김윤슬', phone: '010-9999-0019', parentPhone: '010-8888-0019', teacherId: 'T6', instrument: '바이올린', fee: 180000, dueDay: 12, enrollDate: '2026-03-14', age: 11, school: '하모초등학교' },
        { id: 'S20', name: '남지환', phone: '010-9999-0020', parentPhone: '010-8888-0020', teacherId: 'T6', instrument: '바이올린', fee: 180000, dueDay: 25, enrollDate: '2026-04-05', age: 12, school: '하모초등학교' },
        { id: 'S21', name: '김규희', phone: '010-9999-0001', parentPhone: '010-8888-0001', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-01-10', age: 10, school: '하모초등학교' },
        { id: 'S22', name: '윤하은', phone: '010-9999-5555', parentPhone: '010-8888-6666', teacherId: 'T1', instrument: '피아노', fee: 160000, dueDay: 12, enrollDate: '2026-05-01', age: 9, school: '음악초등학교' },
        { id: 'S23', name: '정우진', phone: '010-9999-2222', parentPhone: '010-8888-3333', teacherId: 'T2', instrument: '바이올린', fee: 180000, dueDay: 15, enrollDate: '2026-02-15', age: 11, school: '하모초등학교' },
        { id: 'S24', name: '한예지', phone: '010-9999-3333', parentPhone: '010-8888-4444', teacherId: 'T1', instrument: '피아노', fee: 150000, dueDay: 5, enrollDate: '2026-03-05', age: 10, school: '음악초등학교' },
        { id: 'S25', name: '이민재', phone: '010-9999-4444', parentPhone: '010-8888-5555', teacherId: 'T3', instrument: '우쿨렐레', fee: 200000, dueDay: 25, enrollDate: '2026-04-20', age: 12, school: '예술중학교' }
    ],
    classes: [
        // Monday (월) schedule matching Image 2
        { id: 'C1', studentId: 'S1', dayOfWeek: '월', time: '14:00' },
        { id: 'C2', studentId: 'S2', dayOfWeek: '월', time: '14:00' },
        { id: 'C3', studentId: 'S3', dayOfWeek: '월', time: '14:00' },
        { id: 'C4', studentId: 'S4', dayOfWeek: '월', time: '14:00' },
        { id: 'C5', studentId: 'S5', dayOfWeek: '월', time: '14:00' },
        { id: 'C6', studentId: 'S7', dayOfWeek: '월', time: '14:30' },
        { id: 'C7', studentId: 'S10', dayOfWeek: '월', time: '15:00' },
        { id: 'C8', studentId: 'S11', dayOfWeek: '월', time: '15:00' },
        { id: 'C9', studentId: 'S12', dayOfWeek: '월', time: '15:00' },
        { id: 'C10', studentId: 'S13', dayOfWeek: '월', time: '15:00' },
        { id: 'C11', studentId: 'S14', dayOfWeek: '월', time: '15:30' },
        { id: 'C12', studentId: 'S15', dayOfWeek: '월', time: '15:30' },
        { id: 'C13', studentId: 'S16', dayOfWeek: '월', time: '16:00' },
        { id: 'C14', studentId: 'S17', dayOfWeek: '월', time: '16:00' },
        { id: 'C15', studentId: 'S18', dayOfWeek: '월', time: '16:00' },
        { id: 'C16', studentId: 'S19', dayOfWeek: '월', time: '16:00' },
        { id: 'C17', studentId: 'S20', dayOfWeek: '월', time: '16:00' },
        { id: 'C18', studentId: 'S21', dayOfWeek: '월', time: '17:00' },
        { id: 'C19', studentId: 'S22', dayOfWeek: '월', time: '17:00' },
        { id: 'C20', studentId: 'S23', dayOfWeek: '월', time: '18:00' },
        { id: 'C21', studentId: 'S24', dayOfWeek: '월', time: '17:00' },
        { id: 'C22', studentId: 'S25', dayOfWeek: '월', time: '18:00' },
 
        // Tuesday (화) schedule matching Image 2
        { id: 'C23', studentId: 'S6', dayOfWeek: '화', time: '14:00' },
        { id: 'C24', studentId: 'S8', dayOfWeek: '화', time: '14:30' },
        { id: 'C25', studentId: 'S9', dayOfWeek: '화', time: '14:30' },
        { id: 'C26', studentId: 'S22', dayOfWeek: '화', time: '15:00' },
        { id: 'C27', studentId: 'S23', dayOfWeek: '화', time: '16:00' },
        { id: 'C28', studentId: 'S19', dayOfWeek: '화', time: '16:00' },
        { id: 'C29', studentId: 'S11', dayOfWeek: '화', time: '15:30' },
 
        // Wednesday (수) schedule matching Image 2
        { id: 'C30', studentId: 'S1', dayOfWeek: '수', time: '14:00' },
        { id: 'C31', studentId: 'S2', dayOfWeek: '수', time: '14:00' },
        { id: 'C32', studentId: 'S3', dayOfWeek: '수', time: '15:00' },
        { id: 'C33', studentId: 'S10', dayOfWeek: '수', time: '15:00' },
        { id: 'C34', studentId: 'S11', dayOfWeek: '수', time: '15:00' },
        { id: 'C35', studentId: 'S12', dayOfWeek: '수', time: '15:00' },
        { id: 'C36', studentId: 'S13', dayOfWeek: '수', time: '15:00' },
        { id: 'C37', studentId: 'S14', dayOfWeek: '수', time: '15:30' },
        { id: 'C38', studentId: 'S21', dayOfWeek: '수', time: '17:00' },
        { id: 'C39', studentId: 'S24', dayOfWeek: '수', time: '17:00' },
 
        // Thursday (목) schedule matching Image 2
        { id: 'C40', studentId: 'S4', dayOfWeek: '목', time: '15:00' },
        { id: 'C41', studentId: 'S16', dayOfWeek: '목', time: '16:00' },
        { id: 'C42', studentId: 'S17', dayOfWeek: '목', time: '16:00' },
        { id: 'C43', studentId: 'S18', dayOfWeek: '목', time: '16:00' },
 
        // Friday (금) schedule matching Image 2
        { id: 'C44', studentId: 'S5', dayOfWeek: '금', time: '14:00' },
        { id: 'C45', studentId: 'S7', dayOfWeek: '금', time: '14:30' },
        { id: 'C46', studentId: 'S15', dayOfWeek: '금', time: '15:00' },
        { id: 'C47', studentId: 'S20', dayOfWeek: '금', time: '15:00' },
        { id: 'C48', studentId: 'S25', dayOfWeek: '금', time: '18:00' }
    ],
    attendance: [
        // Past records for demo (using present/late for attendance days calculation)
        { id: 'A1', studentId: 'S1', date: '2026-05-11', status: 'present', time: '14:02', note: '하농 연습 완료' },
        { id: 'A2', studentId: 'S1', date: '2026-05-13', status: 'present', time: '13:58', note: '바이엘 2권' },
        { id: 'A3', studentId: 'S1', date: '2026-05-18', status: 'present', time: '14:00', note: '' },
        { id: 'A4', studentId: 'S1', date: '2026-05-20', status: 'late', time: '14:15', note: '' },
        { id: 'A5', studentId: 'S2', date: '2026-05-11', status: 'present', time: '14:05', note: '' },
        { id: 'A6', studentId: 'S2', date: '2026-05-13', status: 'present', time: '14:00', note: '' },
        { id: 'A7', studentId: 'S2', date: '2026-05-18', status: 'present', time: '13:55', note: '' },
        { id: 'A8', studentId: 'S2', date: '2026-05-20', status: 'present', time: '14:01', note: '' },
        { id: 'A9', studentId: 'S21', date: '2026-05-18', status: 'present', time: '14:58', note: '쇼팽 녹턴 프레이징 연습 진행함' },
        { id: 'A10', studentId: 'S24', date: '2026-05-18', status: 'present', time: '16:55', note: '바이엘 4권 양손 연습 완료' },
        { id: 'A11', studentId: 'S23', date: '2026-05-19', status: 'present', time: '15:59', note: '서드 포지션 활 쓰기 훈련' },
        { id: 'A12', studentId: 'S22', date: '2026-05-19', status: 'late', time: '15:15', note: '차가 막혀서 15분 늦음. 하농 연습.' },
        { id: 'A13', studentId: 'S21', date: '2026-05-20', status: 'present', time: '14:55', note: '녹턴 전반부 템포 셋팅 완료' },
        { id: 'A14', studentId: 'S24', date: '2026-05-20', status: 'absent', time: '', note: '가족 행사로 사전 결석 처리' }
    ],
    payments: [
        // 4월 (All paid)
        { id: 'P1', studentId: 'S21', amount: 150000, month: '2026-04', type: 'education', status: 'paid', invoiceDate: '2026-04-10', paidDate: '2026-04-10', method: 'toss' },
        { id: 'P2', studentId: 'S23', amount: 180000, month: '2026-04', type: 'education', status: 'paid', invoiceDate: '2026-04-15', paidDate: '2026-04-14', method: 'kakao' },
        { id: 'P3', studentId: 'S24', amount: 150000, month: '2026-04', type: 'education', status: 'paid', invoiceDate: '2026-04-05', paidDate: '2026-04-05', method: 'card' },
        { id: 'P4', studentId: 'S25', amount: 200000, month: '2026-04', type: 'education', status: 'paid', invoiceDate: '2026-04-25', paidDate: '2026-04-25', method: 'cash' },
        // 5월 (Some unpaid)
        { id: 'P5', studentId: 'S24', amount: 150000, month: '2026-05', type: 'education', status: 'paid', invoiceDate: '2026-05-05', paidDate: '2026-05-05', method: 'kakao' },
        { id: 'P6', studentId: 'S21', amount: 150000, month: '2026-05', type: 'education', status: 'paid', invoiceDate: '2026-05-10', paidDate: '2026-05-09', method: 'toss' },
        { id: 'P7', studentId: 'S22', amount: 160000, month: '2026-05', type: 'education', status: 'unpaid', invoiceDate: '2026-05-12', paidDate: null, method: null },
        { id: 'P8', studentId: 'S23', amount: 180000, month: '2026-05', type: 'education', status: 'unpaid', invoiceDate: '2026-05-15', paidDate: null, method: null },
        { id: 'P9', studentId: 'S25', amount: 200000, month: '2026-05', type: 'education', status: 'unpaid', invoiceDate: '2026-05-25', paidDate: null, method: null }
    ],
    teacherShifts: [],
    books: [
        { id: 'B1', name: '세모둥이네꼬마바이엘 1', price: 5000, category: '바이엘/체르니', status: 'active', recommendedDays: 30 },
        { id: 'B2', name: '세모둥이네꼬마바이엘 2', price: 5000, category: '바이엘/체르니', status: 'active', recommendedDays: 30 },
        { id: 'B3', name: '동이네뮤직스쿨 1', price: 6000, category: '게이름', status: 'active', recommendedDays: 60 },
        { id: 'B4', name: '동이네 음악아동 1', price: 6000, category: '이론', status: 'active', recommendedDays: 60 },
        { id: 'B5', name: '도시락바이엘 3', price: 5000, category: '바이엘/체르니', status: 'active', recommendedDays: 90 },
        { id: 'B6', name: '굴리굴리바이엘 4', price: 5000, category: '바이엘/체르니', status: 'active', recommendedDays: 90 }
    ],
    studentBooks: [
        { id: 'SB1', studentId: 'S1', bookId: 'B1', regDate: '2026-03-02', orderNo: 1, paymentId: null },
        { id: 'SB2', studentId: 'S1', bookId: 'B2', regDate: '2026-05-10', orderNo: 2, paymentId: null },
        { id: 'SB3', studentId: 'S2', bookId: 'B1', regDate: '2026-01-30', orderNo: 1, paymentId: null },
        { id: 'SB4', studentId: 'S3', bookId: 'B3', regDate: '2026-02-02', orderNo: 2, paymentId: null },
        { id: 'SB5', studentId: 'S4', bookId: 'B4', regDate: '2026-02-05', orderNo: 1, paymentId: null },
        { id: 'SB6', studentId: 'S5', bookId: 'B1', regDate: '2026-02-06', orderNo: 1, paymentId: null },
        { id: 'SB7', studentId: 'S8', bookId: 'B1', regDate: '2026-03-02', orderNo: 2, paymentId: null }
    ],
    announcements: [
        { id: 'AN1', title: '5월 가정의 달 학원 정기 연주회 일정 안내', content: '안녕하세요, 튜링 음악학원 원장 김하은입니다.\n학부모님들의 아낌없는 지지 덕분에 올해도 정기 연주회를 개최하게 되었습니다.\n\n■ 일시: 2026년 5월 30일(토) 오후 3시\n■ 장소: 학원 콘서트홀\n\n아이들이 그동안 열심히 준비한 연주 곡들을 들려드릴 예정이오니, 바쁘시더라도 부디 오셔서 자리를 빛내 주시고 많은 격려와 박수를 보내주시기 바랍니다.\n\n감사합니다.', date: '2026-05-15', views: 12 },
        { id: 'AN2', title: '여름방학 특별 단기 피아노 마스터 클래스 모집', content: '여름방학을 맞아 음악적 기량을 한층 높일 수 있는 피아노 마스터 클래스를 개설합니다.\n\n■ 모집 대상: 바이엘 4권 이상 학습자\n■ 정원: 선착순 10명\n■ 혜택: 전임 강사와의 1:1 집중 클리닉 및 마스터클래스 수료증 발부\n\n자세한 상담은 학원 행정실로 연락 바랍니다.', date: '2026-05-24', views: 3 }
    ],
    messages: [
        { id: 'MSG1', studentId: 'S1', title: '체르니 100 도입부 양손 프레이징 개별 안내', content: '다은이가 체르니 100번에 진입하여 양손 프레이징 연결을 연습하고 있습니다.\n왼손 반주와 오른손 멜로디의 균형을 맞추는 데 다소 어려움이 있지만, 집중력이 좋아 금방 터득하고 있네요.\n가정에서도 하루 15분씩 메트로놈 연습을 지도해 주시면 큰 도움이 되겠습니다.', date: '2026-05-22', isRead: false },
        { id: 'MSG2', studentId: 'S1', title: '주간 연습 시간 추가 제안', content: '다은이의 음악적 몰입도가 최근 눈에 띄게 높아져 주간 연습을 주 3회에서 4회로 늘려 진행해보고자 합니다.\n의견 있으시면 편하게 답장이나 유선으로 연락 주시기 바랍니다.', date: '2026-05-24', isRead: true }
    ],
    surveys: [
        {
            id: 'SUR1',
            title: '2026 정기 연주회 참석 희망 조사',
            description: '금년 튜링 음악학원 정기 연주회 진행을 위한 참석 희망 여부 및 학부모 의견을 수집합니다.',
            date: '2026-05-26',
            isActive: true,
            questions: [
                { id: 'Q1', type: 'choice', questionText: '연주회 참가 여부 선택', options: ['참가 희망', '불참', '조율 필요'] },
                { id: 'Q2', type: 'text', questionText: '기타 건의 사항 및 연주 희망 곡' }
            ]
        }
    ],
    surveyResponses: [
        { id: 'SRES1', surveyId: 'SUR1', studentId: 'S2', answers: { Q1: '참가 희망', Q2: '베토벤 엘리제를 연주하고 싶어 합니다.' }, date: '2026-05-26' },
        { id: 'SRES2', surveyId: 'SUR1', studentId: 'S3', answers: { Q1: '조율 필요', Q2: '토요일 3시 이후 시간대면 좋겠습니다.' }, date: '2026-05-26' }
    ],
    users: [
        { id: 'USR_DIR_DEMO', provider: 'kakao', snsId: 'demo_dir', name: '김하은', phone: '010-8888-9999', role: 'director', status: 'approved', academyId: 'AC1', academies: [{ academyId: 'AC1', status: 'approved', role: 'director' }], createdAt: '2026-05-10' },
        { id: 'USR_TEA_DEMO', provider: 'google', snsId: 'demo_tea', name: '김민수', phone: '010-1111-1001', role: 'teacher', status: 'approved', academyId: 'AC1', academies: [{ academyId: 'AC1', status: 'approved', role: 'teacher' }], createdAt: '2026-05-11' },
        { id: 'USR_PAR_DEMO', provider: 'naver', snsId: 'demo_par', name: '최수원', phone: '010-8888-2222', role: 'parent', status: 'approved', academyId: 'AC1', academies: [{ academyId: 'AC1', status: 'approved', role: 'parent' }], createdAt: '2026-05-12' }
    ],
    academies: [
        { id: 'AC1', name: '튜링 음악학원', phone: '02-1234-5678', businessRegistrationNumber: '120-00-00000', ownerName: '김하은', postcode: '06543', address: '서울시 서초구 반포동', detailAddress: '123-4', inviteCode: 'TM903A', ownerUserId: 'USR_DIR_DEMO', systemPassword: '0000', tabletPassword: '0000', createdAt: '2026-05-10', updatedAt: '2026-05-10' }
    ],
    academyInviteCodes: [
        { id: 'INV_AC1', academyId: 'AC1', ownerUserId: 'USR_DIR_DEMO', inviteCode: 'TM903A', status: 'active', createdAt: '2026-05-10', updatedAt: '2026-05-10' }
    ],
    academyJoinRequests: [],
    parentStudentLinks: [
        { parentUserId: 'USR_PAR_DEMO', studentId: 'S1' }
    ],
    subjects: [
        { id: 'SUB1', name: '피아노', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
        { id: 'SUB2', name: '바이올린', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
        { id: 'SUB3', name: '첼로', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
        { id: 'SUB4', name: '플루트', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
        { id: 'SUB5', name: '기타', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' }
    ]
};

class StateStore {
    constructor() {
        this.listeners = {};
        this.loadDB();
        this.seedInitialBookPayments(); // Seed payments for default student books
    }
 
    // Load from local storage
    loadDB() {
        // Safe database key and session migration from Harmonia to Turing
        const oldStored = localStorage.getItem('harmonia_academy_db_v3');
        const stored = localStorage.getItem(DB_KEY);
        if (!stored && oldStored) {
            localStorage.setItem(DB_KEY, oldStored);
        }

        const oldUserId = localStorage.getItem('harmonia_user_id');
        if (oldUserId && !localStorage.getItem('turing_user_id')) {
            localStorage.setItem('turing_user_id', oldUserId);
        }
        const oldRole = localStorage.getItem('harmonia_role');
        if (oldRole && !localStorage.getItem('turing_role')) {
            localStorage.setItem('turing_role', oldRole);
        }

        const currentStored = localStorage.getItem(DB_KEY);
        if (currentStored) {
            try {
                this.db = JSON.parse(currentStored);
                
                let migrated = false;
                
                // Safe database migration for v3 auth system
                if (!this.db.users) {
                    this.db.users = JSON.parse(JSON.stringify(DEFAULT_DB.users));
                    migrated = true;
                }
                if (!this.db.academies) {
                    this.db.academies = JSON.parse(JSON.stringify(DEFAULT_DB.academies));
                    migrated = true;
                } else {
                    this.db.academies.forEach(acad => {
                        if (acad.systemPassword === undefined || acad.systemPassword === null) {
                            acad.systemPassword = '0000';
                            migrated = true;
                        }
                        if (acad.tabletPassword === undefined || acad.tabletPassword === null) {
                            acad.tabletPassword = '0000';
                            migrated = true;
                        }
                        if (acad.businessRegistrationNumber === undefined || acad.businessRegistrationNumber === null) {
                            acad.businessRegistrationNumber = '120-00-00000';
                            migrated = true;
                        }
                        if (acad.ownerName === undefined || acad.ownerName === null) {
                            acad.ownerName = '김하은';
                            migrated = true;
                        }
                    });
                }
                if (!this.db.academyInviteCodes) {
                    this.db.academyInviteCodes = JSON.parse(JSON.stringify(DEFAULT_DB.academyInviteCodes));
                    migrated = true;
                }
                if (!this.db.academyJoinRequests) {
                    this.db.academyJoinRequests = JSON.parse(JSON.stringify(DEFAULT_DB.academyJoinRequests));
                    migrated = true;
                }
                if (!this.db.parentStudentLinks) {
                    this.db.parentStudentLinks = JSON.parse(JSON.stringify(DEFAULT_DB.parentStudentLinks));
                    migrated = true;
                }
                
                // Migrate users to support multi-academy array
                this.db.users.forEach(u => {
                    if (!u.academies) {
                        u.academies = [{ academyId: u.academyId || 'AC1', status: u.status || 'approved', role: u.role }];
                        migrated = true;
                    }
                });
                if (!this.db.subjects) {
                    this.db.subjects = [
                        { id: 'SUB1', name: '피아노', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                        { id: 'SUB2', name: '바이올린', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                        { id: 'SUB3', name: '첼로', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                        { id: 'SUB4', name: '플루트', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                        { id: 'SUB5', name: '기타', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' }
                    ];
                    migrated = true;
                }

                // Check for other standard tables and seed if missing
                if (!this.db.teachers || !this.db.students || !this.db.books || !this.db.studentBooks || !this.db.announcements || !this.db.messages || !this.db.surveys || !this.db.surveyResponses) {
                    console.log('Old critical tables missing, resetting to DEFAULT_DB.');
                    this.db = JSON.parse(JSON.stringify(DEFAULT_DB));
                    migrated = true;
                } else {
                    // Add academyId to existing elements if missing
                    this.db.students.forEach(s => {
                        if (!s.academyId) {
                            s.academyId = 'AC1';
                            migrated = true;
                        }
                    });
                    this.db.teachers.forEach(t => {
                        if (!t.academyId) {
                            t.academyId = 'AC1';
                            migrated = true;
                        }
                    });
                    this.db.announcements.forEach(a => {
                        if (!a.academyId) {
                            a.academyId = 'AC1';
                            migrated = true;
                        }
                    });
                }

                // Migrate studentMemberNo and paymentStatus for existing students
                let memberNoCounter = 1;
                this.db.students.forEach(s => {
                    if (!s.studentMemberNo) {
                        s.studentMemberNo = memberNoCounter++;
                        migrated = true;
                    } else {
                        if (s.studentMemberNo >= memberNoCounter) {
                            memberNoCounter = s.studentMemberNo + 1;
                        }
                    }
                    if (s.paymentStatus === undefined || s.paymentStatus === null) {
                        s.paymentStatus = 'unpaid';
                        migrated = true;
                    }
                });

                // Migrate default settings if missing
                this.db.settings = {
                    sendKakaoAlert: true,
                    academyName: '튜링 음악학원',
                    businessNumber: '120-00-00000',
                    representative: '김하은',
                    phone: '02-1234-5678',
                    address: '서울시 서초구 반포동 123-4',
                    corporateName: '비아렙스',
                    ...this.db.settings
                };
                
                if (migrated) {
                    this.saveDB();
                }
            } catch (e) {
                console.error('Failed to parse DB, using defaults', e);
                this.db = JSON.parse(JSON.stringify(DEFAULT_DB));
                this.saveDB();
            }
        } else {
            this.db = JSON.parse(JSON.stringify(DEFAULT_DB));
            this.saveDB();
        }
    }

    // Save to local storage
    saveDB() {
        localStorage.setItem(DB_KEY, JSON.stringify(this.db));
    }

    // Pub/Sub pattern
    subscribe(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    }

    notify(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in listener for event ${event}`, e);
                }
            });
        }
    }

    // --- SETTINGS ---
    getSettings() {
        const base = this.db.settings || { sendKakaoAlert: true };
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.academyId) {
            const acad = this.getAcademy(currentUser.academyId);
            if (acad) {
                return {
                    ...base,
                    academyName: acad.name,
                    phone: acad.phone || '',
                    businessNumber: acad.businessRegistrationNumber || '',
                    representative: acad.ownerName || '',
                    address: `${acad.address || ''} ${acad.detailAddress || ''}`.trim(),
                    postcode: acad.postcode || '',
                    directorSignature: acad.directorSignature || ''
                };
            }
        }
        return base;
    }

    updateSettings(settings) {
        this.db.settings = { ...this.db.settings, ...settings };
        this.saveDB();
        this.notify('SETTINGS_CHANGED', this.db.settings);
    }

    // --- TEACHERS ---
    getTeachers() {
        return this.db.teachers;
    }

    getTeacher(id) {
        return this.db.teachers.find(t => t.id === id);
    }

    addTeacher(teacher) {
        const id = 'T' + (Math.max(...this.db.teachers.map(t => parseInt(t.id.slice(1)) || 0)) + 1);
        const newTeacher = { id, ...teacher };
        this.db.teachers.push(newTeacher);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
        return newTeacher;
    }

    updateTeacher(id, data) {
        this.db.teachers = this.db.teachers.map(t => t.id === id ? { ...t, ...data } : t);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
    }

    deleteTeacher(id) {
        this.db.teachers = this.db.teachers.filter(t => t.id !== id);
        this.saveDB();
        this.notify('TEACHERS_CHANGED', this.db.teachers);
    }

    // --- STUDENTS ---
    getStudents() {
        if (!this.db.students) this.db.students = [];
        return this.db.students.filter(s => !s.isDeleted);
    }

    getStudent(id) {
        return this.db.students.find(s => s.id === id);
    }

    addStudent(student, classSchedules = []) {
        const id = 'S' + (this.db.students.length ? Math.max(...this.db.students.map(s => parseInt(s.id.slice(1)) || 0)) + 1 : 1);
        const maxMemberNo = this.db.students.length ? Math.max(...this.db.students.map(s => s.studentMemberNo || 0)) : 0;
        const studentMemberNo = maxMemberNo + 1;
        const paymentStatus = student.paymentStatus || 'unpaid';
        
        const newStudent = { id, studentMemberNo, ...student, paymentStatus };
        this.db.students.push(newStudent);

        // Add class schedules
        classSchedules.forEach(schedule => {
            const classId = 'C' + (this.db.classes.length ? Math.max(...this.db.classes.map(c => parseInt(c.id.slice(1)) || 0)) + 1 : 1);
            this.db.classes.push({ id: classId, studentId: id, dayOfWeek: schedule.dayOfWeek, time: schedule.time });
        });

        // Auto create initial invoice for current month
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const invoiceDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
        
        this.db.payments.push({
            id: payId,
            studentId: id,
            amount: newStudent.fee,
            month: currentMonth,
            type: 'education',
            status: paymentStatus,
            invoiceDate: invoiceDate,
            paidDate: paymentStatus === 'paid' ? invoiceDate : null,
            method: paymentStatus === 'paid' ? 'cash' : null
        });

        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.notify('CLASSES_CHANGED', this.db.classes);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return newStudent;
    }

    addStudentsBatch(studentsList) {
        if (!Array.isArray(studentsList) || studentsList.length === 0) return [];
        
        const addedStudents = [];
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const invoiceDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        
        let nextStudentNum = this.db.students.length ? Math.max(...this.db.students.map(s => parseInt(s.id.slice(1)) || 0)) + 1 : 1;
        let nextMemberNo = (this.db.students.length ? Math.max(...this.db.students.map(s => s.studentMemberNo || 0)) : 0) + 1;
        let nextClassNum = this.db.classes.length ? Math.max(...this.db.classes.map(c => parseInt(c.id.slice(1)) || 0)) + 1 : 1;
        let nextPayNum = this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1;

        studentsList.forEach(item => {
            const student = item.studentData;
            const classSchedules = item.schedules || [];
            
            const id = 'S' + nextStudentNum++;
            const studentMemberNo = nextMemberNo++;
            const paymentStatus = student.paymentStatus || 'unpaid';
            
            const newStudent = { id, studentMemberNo, ...student, paymentStatus };
            this.db.students.push(newStudent);
            addedStudents.push(newStudent);

            // Add class schedules
            classSchedules.forEach(schedule => {
                const classId = 'C' + nextClassNum++;
                this.db.classes.push({ id: classId, studentId: id, dayOfWeek: schedule.dayOfWeek, time: schedule.time });
            });

            // Auto create initial invoice for current month
            const payId = 'P' + nextPayNum++;
            this.db.payments.push({
                id: payId,
                studentId: id,
                amount: newStudent.fee,
                month: currentMonth,
                type: 'education',
                status: paymentStatus,
                invoiceDate: invoiceDate,
                paidDate: paymentStatus === 'paid' ? invoiceDate : null,
                method: paymentStatus === 'paid' ? 'cash' : null
            });
        });

        this.saveDB();
        
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.notify('CLASSES_CHANGED', this.db.classes);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        
        return addedStudents;
    }

    updateStudent(id, data, classSchedules = null) {
        this.db.students = this.db.students.map(s => s.id === id ? { ...s, ...data } : s);
        
        // Sync paymentStatus with monthly education payments
        if (data.paymentStatus !== undefined) {
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const invoice = this.db.payments.find(p => p.studentId === id && p.month === currentMonth && p.type === 'education');
            if (invoice) {
                invoice.status = data.paymentStatus;
                if (data.paymentStatus === 'paid') {
                    invoice.paidDate = invoice.paidDate || new Date().toISOString().slice(0, 10);
                    invoice.method = invoice.method || 'cash';
                } else {
                    invoice.paidDate = null;
                    invoice.method = null;
                }
            } else if (data.paymentStatus === 'paid' || data.paymentStatus === 'unpaid') {
                const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
                const invoiceDate = new Date().toISOString().slice(0, 10);
                const s = this.getStudent(id);
                this.db.payments.push({
                    id: payId,
                    studentId: id,
                    amount: s ? s.fee : 150000,
                    month: currentMonth,
                    type: 'education',
                    status: data.paymentStatus,
                    invoiceDate: invoiceDate,
                    paidDate: data.paymentStatus === 'paid' ? invoiceDate : null,
                    method: data.paymentStatus === 'paid' ? 'cash' : null
                });
            }
            this.notify('PAYMENTS_CHANGED', this.db.payments);
        }

        if (classSchedules !== null) {
            // Delete old class schedules for student
            this.db.classes = this.db.classes.filter(c => c.studentId !== id);
            // Insert new ones
            classSchedules.forEach(schedule => {
                const classId = 'C' + (this.db.classes.length ? Math.max(...this.db.classes.map(c => parseInt(c.id.slice(1)) || 0)) + 1 : 1);
                this.db.classes.push({ id: classId, studentId: id, dayOfWeek: schedule.dayOfWeek, time: schedule.time });
            });
        }

        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.notify('CLASSES_CHANGED', this.db.classes);
    }

    deleteStudent(id) {
        const student = this.db.students.find(s => s.id === id);
        if (student) {
            student.isDeleted = true;
            student.deletedAt = new Date().toISOString().slice(0, 10);
            this.saveDB();
            this.notify('STUDENTS_CHANGED', this.db.students);
        }
    }

    dischargeStudent(id) {
        const student = this.db.students.find(s => s.id === id);
        if (!student) throw new Error('원생을 찾을 수 없습니다.');
        student.status = 'withdrawn';
        student.leaveDate = new Date().toISOString().slice(0, 10);
        this.saveDB();
        this.notify('STUDENTS_CHANGED', this.db.students);
    }

    // --- CLASSES ---
    getClasses() {
        return this.db.classes;
    }

    getClassesForStudent(studentId) {
        return this.db.classes.filter(c => c.studentId === studentId);
    }

    // --- ATTENDANCE ---
    getAttendance() {
        return this.db.attendance;
    }

    getAttendanceForStudent(studentId) {
        return this.db.attendance.filter(a => a.studentId === studentId);
    }

    markAttendance(studentId, date, status, time = '', note = '', videoUrl = '', images = []) {
        // Check if attendance already marked for this day
        const existing = this.db.attendance.find(a => a.studentId === studentId && a.date === date);
        let alertTriggered = false;
        let alertMessage = '';

        if (existing) {
            if (status === 'none') {
                // Remove record
                this.db.attendance = this.db.attendance.filter(a => a.id !== existing.id);
            } else {
                existing.status = status;
                existing.time = time;
                existing.note = note;
                existing.videoUrl = videoUrl;
                existing.images = images;
            }
        } else if (status !== 'none') {
            const id = 'A' + (this.db.attendance.length ? Math.max(...this.db.attendance.map(a => parseInt(a.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendance.push({ id, studentId, date, status, time, note, videoUrl, images });
            
            // Set up simulated KakaoTalk notification
            if (this.db.settings.sendKakaoAlert) {
                const student = this.getStudent(studentId);
                const statusKo = status === 'present' ? '등원' : (status === 'late' ? '지각' : '결석');
                alertTriggered = true;
                alertMessage = `[튜링 알림톡]\n안녕하세요. 학부모님.\n${student.name} 원생이 금일(${date} ${time})에 ${statusKo}하였습니다.`;
            }
        }

        this.saveDB();
        this.notify('ATTENDANCE_CHANGED', this.db.attendance);

        // If KakaoTalk alert needs to be dispatched, fire custom DOM event for toast notification
        if (alertTriggered) {
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMessage } });
            window.dispatchEvent(event);
        }
    }

    leaveAttendance(studentId, date, time) {
        // Find existing attendance for this day
        const existing = this.db.attendance.find(a => a.studentId === studentId && a.date === date);
        let alertTriggered = false;
        let alertMessage = '';

        if (existing) {
            // Update the existing record with leavingTime
            existing.leavingTime = time;
        } else {
            // If no attendance record exists, create one with leavingTime
            const id = 'A' + (this.db.attendance.length ? Math.max(...this.db.attendance.map(a => parseInt(a.id.slice(1)) || 0)) + 1 : 1);
            this.db.attendance.push({ id, studentId, date, status: 'present', time: '', leavingTime: time, note: '하원 우선 기록' });
        }

        // Set up simulated KakaoTalk notification for check-out
        if (this.db.settings.sendKakaoAlert) {
            const student = this.getStudent(studentId);
            alertTriggered = true;
            alertMessage = `[튜링 알림톡]\n안녕하세요. 학부모님.\n${student.name} 원생이 금일(${date} ${time})에 하원하였습니다.`;
        }

        this.saveDB();
        this.notify('ATTENDANCE_CHANGED', this.db.attendance);

        if (alertTriggered) {
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMessage } });
            window.dispatchEvent(event);
        }
    }

    // --- PAYMENTS ---
    getPayments() {
        return this.db.payments;
    }

    getPaymentsForStudent(studentId) {
        return this.db.payments.filter(p => p.studentId === studentId);
    }

    payInvoice(paymentId, method) {
        const invoice = this.db.payments.find(p => p.id === paymentId);
        if (invoice) {
            invoice.status = 'paid';
            invoice.paidDate = new Date().toISOString().slice(0, 10);
            invoice.method = method;
            
            // Sync back to student's paymentStatus if current month's education invoice
            const currentMonth = new Date().toISOString().slice(0, 7);
            if (invoice.type === 'education' && invoice.month === currentMonth) {
                const student = this.db.students.find(s => s.id === invoice.studentId);
                if (student) {
                    student.paymentStatus = 'paid';
                    this.notify('STUDENTS_CHANGED', this.db.students);
                }
            }

            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            return invoice;
        }
        return null;
    }

    createInvoice(studentId, amount, month) {
        // Check if invoice for this student and month already exists
        const existing = this.db.payments.find(p => p.studentId === studentId && p.month === month);
        if (existing) return existing;

        const id = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
        const invoiceDate = new Date().toISOString().slice(0, 10);
        const newInvoice = {
            id,
            studentId,
            amount,
            month,
            type: 'education',
            status: 'unpaid',
            invoiceDate,
            paidDate: null,
            method: null
        };
        this.db.payments.push(newInvoice);
        this.saveDB();
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return newInvoice;
    }

    // --- TEACHER SHIFTS ---
    getTeacherShifts() {
        if (!this.db.teacherShifts) {
            this.db.teacherShifts = [];
        }
        return this.db.teacherShifts;
    }

    getShiftsForTeacher(teacherId) {
        return this.getTeacherShifts().filter(ts => ts.teacherId === teacherId);
    }

    saveTeacherShift(teacherId, date, slots) {
        if (!this.db.teacherShifts) {
            this.db.teacherShifts = [];
        }
        // Remove existing record for this teacher and date if it exists
        this.db.teacherShifts = this.db.teacherShifts.filter(ts => !(ts.teacherId === teacherId && ts.date === date));
        
        // Add new record if there are active slots
        if (slots && slots.length > 0) {
            const id = 'TS' + (this.db.teacherShifts.length ? Math.max(...this.db.teacherShifts.map(ts => parseInt(ts.id.slice(2)) || 0)) + 1 : 1);
            this.db.teacherShifts.push({ id, teacherId, date, slots });
        }

        this.saveDB();
        this.notify('SHIFTS_CHANGED', this.db.teacherShifts);
    }

    // --- SEED BOOK PAYMENTS ---
    seedInitialBookPayments() {
        if (!this.db.studentBooks) return;
        let dbChanged = false;

        this.db.studentBooks.forEach(sb => {
            if (!sb.paymentId) {
                // Find if there is an existing payment for this book and student
                const book = this.getBook(sb.bookId);
                if (!book) return;

                const month = sb.regDate.slice(0, 7); // YYYY-MM
                let payRecord = this.db.payments.find(p => p.studentId === sb.studentId && p.bookId === sb.bookId && p.type === 'book');
                
                if (!payRecord) {
                    const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
                    payRecord = {
                        id: payId,
                        studentId: sb.studentId,
                        amount: book.price,
                        month: month,
                        type: 'book',
                        status: sb.id === 'SB2' ? 'requested' : 'paid', // Match initial requested status for SB2 demo, paid for others
                        invoiceDate: sb.regDate,
                        paidDate: sb.id === 'SB2' ? null : sb.regDate,
                        method: sb.id === 'SB2' ? null : 'cash',
                        bookId: sb.bookId
                    };
                    this.db.payments.push(payRecord);
                }
                sb.paymentId = payRecord.id;
                dbChanged = true;
            }
        });

        if (dbChanged) {
            this.saveDB();
        }
    }

    // --- BOOKS ---
    getBooks() {
        if (!this.db.books) {
            this.db.books = [];
        }
        return this.db.books;
    }

    getBook(id) {
        return this.getBooks().find(b => b.id === id);
    }

    addBook(book) {
        if (!this.db.books) {
            this.db.books = [];
        }
        const id = 'B' + (this.db.books.length ? Math.max(...this.db.books.map(b => parseInt(b.id.slice(1)) || 0)) + 1 : 1);
        const recommendedDays = parseInt(book.recommendedDays) || 90;
        const newBook = { id, status: 'active', ...book, recommendedDays };
        this.db.books.push(newBook);
        this.saveDB();
        this.notify('BOOKS_CHANGED', this.db.books);
        return newBook;
    }

    updateBook(id, data) {
        if (data.recommendedDays !== undefined) {
            data.recommendedDays = parseInt(data.recommendedDays) || 90;
        }
        this.db.books = this.getBooks().map(b => b.id === id ? { ...b, ...data } : b);
        this.saveDB();
        this.notify('BOOKS_CHANGED', this.db.books);
    }

    deleteBook(id) {
        this.db.books = this.getBooks().filter(b => b.id !== id);
        
        // Remove related student books and unpaid book payments
        if (this.db.studentBooks) {
            const sbsToDelete = this.db.studentBooks.filter(sb => sb.bookId === id);
            sbsToDelete.forEach(sb => {
                if (sb.paymentId) {
                    this.db.payments = this.db.payments.filter(p => p.id !== sb.paymentId || p.status === 'paid');
                }
            });
            this.db.studentBooks = this.db.studentBooks.filter(sb => sb.bookId !== id);
        }
        this.db.payments = this.db.payments.filter(p => !(p.bookId === id && p.status === 'unpaid'));

        this.saveDB();
        this.notify('BOOKS_CHANGED', this.db.books);
        this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
    }

    // --- SUBJECTS ---
    getSubjects() {
        if (!this.db.subjects) {
            this.db.subjects = [
                { id: 'SUB1', name: '피아노', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB2', name: '바이올린', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB3', name: '첼로', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB4', name: '플루트', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' },
                { id: 'SUB5', name: '기타', isActive: true, regDate: '2026-05-10', updateDate: '2026-05-10' }
            ];
            this.saveDB();
        }
        return this.db.subjects;
    }

    addSubject(name, isActive = true) {
        const subjects = this.getSubjects();
        const id = 'SUB' + (subjects.length ? Math.max(...subjects.map(s => parseInt(s.id.slice(3)) || 0)) + 1 : 1);
        const today = new Date().toISOString().slice(0, 10);
        const newSubject = { id, name, isActive, regDate: today, updateDate: today };
        this.db.subjects.push(newSubject);
        this.saveDB();
        this.notify('SUBJECTS_CHANGED', this.db.subjects);
        return newSubject;
    }

    updateSubject(id, data) {
        const today = new Date().toISOString().slice(0, 10);
        this.db.subjects = this.getSubjects().map(s => s.id === id ? { ...s, ...data, updateDate: today } : s);
        this.saveDB();
        this.notify('SUBJECTS_CHANGED', this.db.subjects);
    }

    deleteSubject(id) {
        this.db.subjects = this.getSubjects().filter(s => s.id !== id);
        this.saveDB();
        this.notify('SUBJECTS_CHANGED', this.db.subjects);
    }

    // --- STUDENT BOOKS ---
    getStudentBooks() {
        if (!this.db.studentBooks) {
            this.db.studentBooks = [];
        }
        return this.db.studentBooks;
    }

    getBooksForStudent(studentId) {
        return this.getStudentBooks().filter(sb => sb.studentId === studentId);
    }

    assignBookToStudent(studentId, bookId, regDate, orderNo) {
        if (!this.db.studentBooks) {
            this.db.studentBooks = [];
        }
        const book = this.getBook(bookId);
        if (!book) return null;

        // 1. Create a payment record (type: 'book')
        const payId = 'P' + (this.db.payments.length ? Math.max(...this.db.payments.map(p => parseInt(p.id.slice(1)) || 0)) + 1 : 1);
        const month = regDate.slice(0, 7); // YYYY-MM
        const newPayment = {
            id: payId,
            studentId,
            amount: book.price,
            month: month,
            type: 'book',
            status: 'unpaid',
            invoiceDate: regDate,
            paidDate: null,
            method: null,
            bookId: bookId
        };
        this.db.payments.push(newPayment);

        // 2. Create the student book record referencing the payment
        const id = 'SB' + (this.db.studentBooks.length ? Math.max(...this.db.studentBooks.map(sb => parseInt(sb.id.slice(2)) || 0)) + 1 : 1);
        const newSB = { id, studentId, bookId, regDate, orderNo: parseInt(orderNo) || 1, paymentId: payId };
        this.db.studentBooks.push(newSB);

        this.saveDB();
        this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
        this.notify('PAYMENTS_CHANGED', this.db.payments);
        return newSB;
    }

    removeStudentBook(id) {
        const sb = this.getStudentBooks().find(item => item.id === id);
        if (sb) {
            // Delete invoice associated with it only if it is unpaid or requested
            if (sb.paymentId) {
                this.db.payments = this.db.payments.filter(p => !(p.id === sb.paymentId && p.status !== 'paid'));
            }
            this.db.studentBooks = this.db.studentBooks.filter(item => item.id !== id);
            this.saveDB();
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
            this.notify('PAYMENTS_CHANGED', this.db.payments);
        }
    }

    requestBookPayment(paymentIdOrStudentBookId) {
        // Handle both payment ID or studentBookId
        let paymentRecord = this.db.payments.find(p => p.id === paymentIdOrStudentBookId);
        let sbRecord = null;
        
        if (!paymentRecord) {
            sbRecord = this.getStudentBooks().find(sb => sb.id === paymentIdOrStudentBookId);
            if (sbRecord && sbRecord.paymentId) {
                paymentRecord = this.db.payments.find(p => p.id === sbRecord.paymentId);
            }
        } else {
            sbRecord = this.getStudentBooks().find(sb => sb.paymentId === paymentRecord.id);
        }

        if (paymentRecord && paymentRecord.status !== 'paid') {
            paymentRecord.status = 'requested';
            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);

            if (this.db.settings.sendKakaoAlert) {
                const student = this.getStudent(paymentRecord.studentId);
                if (paymentRecord.type === 'book') {
                    const book = this.getBook(paymentRecord.bookId);
                    if (student && book) {
                        const alertMsg = `[튜링 알림톡]\n안녕하세요, ${student.name} 학부모님.\n신규 교재 [${book.name}]의 교재비 ${book.price.toLocaleString()}원 결제 요청이 도착했습니다.\n\n해당 수강 월 청구 내역과 함께 결제를 부탁드립니다. 감사합니다.`;
                        const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
                        window.dispatchEvent(event);
                    }
                } else {
                    if (student) {
                        const alertMsg = `[튜링 알림톡]\n안녕하세요, ${student.name} 학부모님.\n${this.db.settings.academyName || '튜링 음악학원'} ${paymentRecord.month.slice(5)}월분 교육비 ${paymentRecord.amount.toLocaleString()}원 결제 요청이 도착했습니다.\n(정기 수납일: 매월 ${student.dueDay || 10}일)\n\n아래의 수단을 통하여 수강료 납부 처리를 부탁드립니다. 감사합니다.`;
                        const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
                        window.dispatchEvent(event);
                    }
                }
            }
        }
    }

    updatePayment(paymentId, updates) {
        const payment = this.db.payments.find(p => p.id === paymentId);
        if (payment) {
            Object.assign(payment, updates);
            this.saveDB();
            this.notify('PAYMENTS_CHANGED', this.db.payments);
            this.notify('STUDENT_BOOKS_CHANGED', this.db.studentBooks);
            return true;
        }
        return false;
    }

    // --- ANNOUNCEMENTS ---
    getAnnouncements() {
        if (!this.db.announcements) this.db.announcements = [];
        return this.db.announcements;
    }

    addAnnouncement(title, content) {
        if (!this.db.announcements) this.db.announcements = [];
        const id = 'AN' + (this.db.announcements.length ? Math.max(...this.db.announcements.map(a => parseInt(a.id.slice(2)) || 0)) + 1 : 1);
        const date = new Date().toISOString().slice(0, 10);
        const created_at = new Date().toISOString();
        const newAnnouncement = { id, title, content, date, views: 0, created_at };
        this.db.announcements.push(newAnnouncement);
        this.saveDB();
        this.notify('ANNOUNCEMENTS_CHANGED', this.db.announcements);
        return newAnnouncement;
    }

    deleteAnnouncement(id) {
        this.db.announcements = this.getAnnouncements().filter(a => a.id !== id);
        this.saveDB();
        this.notify('ANNOUNCEMENTS_CHANGED', this.db.announcements);
    }

    incrementAnnouncementViews(id) {
        const announcement = this.getAnnouncements().find(a => a.id === id);
        if (announcement) {
            announcement.views = (announcement.views || 0) + 1;
            this.saveDB();
            this.notify('ANNOUNCEMENTS_CHANGED', this.db.announcements);
        }
    }

    // --- MESSAGES ---
    getMessages() {
        if (!this.db.messages) this.db.messages = [];
        return this.db.messages;
    }

    getMessagesForStudent(studentId) {
        return this.getMessages().filter(m => m.studentId === studentId);
    }

    addMessage(studentId, title, content) {
        if (!this.db.messages) this.db.messages = [];
        const id = 'MSG' + (this.db.messages.length ? Math.max(...this.db.messages.map(m => parseInt(m.id.slice(3)) || 0)) + 1 : 1);
        const date = new Date().toISOString().slice(0, 10);
        const created_at = new Date().toISOString();
        const newMessage = { id, studentId, title, content, date, isRead: false, created_at };
        this.db.messages.push(newMessage);
        this.saveDB();
        this.notify('MESSAGES_CHANGED', this.db.messages);

        if (this.db.settings.sendKakaoAlert) {
            const student = this.getStudent(studentId);
            if (student) {
                const alertMsg = `[튜링 알림톡]\n안녕하세요, ${student.name} 학부모님.\n개별 안내장(메시지)이 도착했습니다.\n\n■ 제목: ${title}\n\n학부모 포털에서 확인 부탁드립니다.`;
                const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
                window.dispatchEvent(event);
            }
        }
        return newMessage;
    }

    deleteMessage(id) {
        this.db.messages = this.getMessages().filter(m => m.id !== id);
        this.saveDB();
        this.notify('MESSAGES_CHANGED', this.db.messages);
    }

    markMessageAsRead(id) {
        const message = this.getMessages().find(m => m.id === id);
        if (message && !message.isRead) {
            message.isRead = true;
            this.saveDB();
            this.notify('MESSAGES_CHANGED', this.db.messages);
        }
    }

    // --- SURVEYS & RESPONSES ---
    getSurveys() {
        if (!this.db.surveys) this.db.surveys = [];
        return this.db.surveys;
    }

    getSurvey(id) {
        return this.getSurveys().find(s => s.id === id);
    }

    addSurvey(title, description, questions) {
        if (!this.db.surveys) this.db.surveys = [];
        const id = 'SUR' + (this.db.surveys.length ? Math.max(...this.db.surveys.map(s => parseInt(s.id.slice(3)) || 0)) + 1 : 1);
        const date = new Date().toISOString().slice(0, 10);
        const created_at = new Date().toISOString();
        const newSurvey = { id, title, description, date, isActive: true, questions, created_at };
        this.db.surveys.push(newSurvey);
        this.saveDB();
        this.notify('SURVEYS_CHANGED', this.db.surveys);

        if (this.db.settings.sendKakaoAlert) {
            const alertMsg = `[튜링 알림톡]\n안녕하세요, 학부모님.\n${this.db.settings.academyName || '튜링 음악학원'}에서 설문조사를 배포하였습니다.\n\n■ 설문명: ${title}\n\n학부모 안심 포털에서 설문 참여를 부탁드립니다.`;
            const event = new CustomEvent('kakaotalk-alert', { detail: { message: alertMsg } });
            window.dispatchEvent(event);
        }
        return newSurvey;
    }

    deleteSurvey(id) {
        this.db.surveys = this.getSurveys().filter(s => s.id !== id);
        if (this.db.surveyResponses) {
            this.db.surveyResponses = this.db.surveyResponses.filter(r => r.surveyId !== id);
        }
        this.saveDB();
        this.notify('SURVEYS_CHANGED', this.db.surveys);
        this.notify('SURVEY_RESPONSES_CHANGED', this.db.surveyResponses);
    }

    getSurveyResponses(surveyId) {
        if (!this.db.surveyResponses) this.db.surveyResponses = [];
        return this.db.surveyResponses.filter(r => r.surveyId === surveyId);
    }

    submitSurveyResponse(surveyId, studentId, answers) {
        if (!this.db.surveyResponses) this.db.surveyResponses = [];
        const existingIdx = this.db.surveyResponses.findIndex(r => r.surveyId === surveyId && r.studentId === studentId);
        const date = new Date().toISOString().slice(0, 10);
        
        if (existingIdx !== -1) {
            this.db.surveyResponses[existingIdx].answers = answers;
            this.db.surveyResponses[existingIdx].date = date;
        } else {
            const id = 'SRES' + (this.db.surveyResponses.length ? Math.max(...this.db.surveyResponses.map(r => parseInt(r.id.slice(4)) || 0)) + 1 : 1);
            this.db.surveyResponses.push({ id, surveyId, studentId, answers, date });
        }

        this.saveDB();
        this.notify('SURVEY_RESPONSES_CHANGED', this.db.surveyResponses);
    }

    hasStudentAnsweredSurvey(surveyId, studentId) {
        if (!this.db.surveyResponses) return false;
        return this.db.surveyResponses.some(r => r.surveyId === surveyId && r.studentId === studentId);
    }

    // --- AUTHENTICATION & USER MANAGEMENT ---
    getCurrentUser() {
        const userId = localStorage.getItem('turing_user_id') || localStorage.getItem('harmonia_user_id');
        if (userId) {
            if (!this.db.users) this.db.users = [];
            const user = this.db.users.find(u => u.id === userId);
            if (user) return user;
        }
        const role = localStorage.getItem('turing_role') || localStorage.getItem('harmonia_role');
        if (role) {
            if (!this.db.users) this.db.users = [];
            if (role === 'director') return this.db.users.find(u => u.id === 'USR_DIR_DEMO');
            if (role === 'teacher') return this.db.users.find(u => u.id === 'USR_TEA_DEMO');
            if (role === 'parent' || role === 'student') return this.db.users.find(u => u.id === 'USR_PAR_DEMO');
        }
        return null;
    }

    setCurrentUser(userId) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (user) {
            localStorage.setItem('turing_user_id', userId);
            localStorage.setItem('turing_role', user.role);
            
            // Sync settings with director's academy
            if (user.role === 'director' && user.academyId) {
                const academy = this.getAcademy(user.academyId);
                if (academy) {
                    this.db.settings = {
                        ...this.db.settings,
                        academyName: academy.name,
                        phone: academy.phone || this.db.settings.phone,
                        address: academy.address || this.db.settings.address,
                        representative: user.name || this.db.settings.representative
                    };
                    this.saveDB();
                }
            }
        }
    }

    logoutUser() {
        localStorage.removeItem('turing_user_id');
        localStorage.removeItem('turing_role');
        localStorage.removeItem('harmonia_user_id');
        localStorage.removeItem('harmonia_role');
    }

    getUser(id) {
        if (!this.db.users) this.db.users = [];
        return this.db.users.find(u => u.id === id);
    }

    getAcademy(id) {
        if (!this.db.academies) this.db.academies = [];
        return this.db.academies.find(a => a.id === id);
    }

    getAcademyByInviteCode(code) {
        if (!code) return null;
        if (!this.db.academies) this.db.academies = [];
        return this.db.academies.find(a => a.inviteCode.toUpperCase() === code.toUpperCase().trim());
    }

    getAcademyInviteCodeObject(code) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        return this.db.academyInviteCodes.find(c => c.inviteCode.toUpperCase() === code.toUpperCase().trim());
    }

    updateAcademy(academyId, data) {
        if (!this.db.academies) this.db.academies = [];
        const acad = this.db.academies.find(a => a.id === academyId);
        if (!acad) throw new Error('학원을 찾을 수 없습니다.');

        acad.name = data.name || acad.name;
        acad.phone = data.phone || '';
        acad.businessRegistrationNumber = data.businessRegistrationNumber || '';
        acad.postcode = data.postcode || '';
        acad.address = data.address || '';
        acad.detailAddress = data.detailAddress || '';
        acad.ownerName = data.ownerName || '';
        if (data.systemPassword !== undefined) {
            acad.systemPassword = data.systemPassword;
        }
        if (data.tabletPassword !== undefined) {
            acad.tabletPassword = data.tabletPassword;
        }
        if (data.directorSignature !== undefined) {
            acad.directorSignature = data.directorSignature;
        }
        acad.updatedAt = new Date().toISOString().slice(0, 10);

        // Also sync settings representation if it's the active academy
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.academyId === academyId) {
            this.db.settings = {
                ...this.db.settings,
                academyName: acad.name,
                phone: acad.phone,
                address: acad.address,
                representative: acad.ownerName
            };
        }

        this.saveDB();
        this.notify('ACADEMIES_CHANGED', this.db.academies);
        this.notify('USERS_CHANGED', this.db.users);
        if (currentUser && currentUser.academyId === academyId) {
            this.notify('SETTINGS_CHANGED', this.db.settings);
        }
    }

    registerUser(data) {
        if (!this.db.users) this.db.users = [];
        if (!this.db.academies) this.db.academies = [];

        const { provider, snsId, name, phone, role, inviteCode, childName, academyName, academyPhone, academyAddress, termsAgreement } = data;
        
        // 필수 동의 항목 검증 (서버/상태 저장소 측 검증)
        if (!termsAgreement ||
            !termsAgreement.serviceUse || !termsAgreement.serviceUse.agreed ||
            !termsAgreement.privacyPolicy || !termsAgreement.privacyPolicy.agreed ||
            !termsAgreement.locationService || !termsAgreement.locationService.agreed) {
            throw new Error('회원가입을 진행하려면 필수 약관에 동의하셔야 합니다.');
        }

        // Check if user already exists
        const existingUser = this.db.users.find(u => u.provider === provider && u.snsId === snsId);
        if (existingUser) return existingUser;

        const userId = 'USR_' + Date.now();
        let userAcademyId = null;
        let status = 'pending';
        let method = 'invite_code';

        if (role === 'director') {
            const academyId = 'AC_' + Date.now();
            const code = this.generateUniqueInviteCode();
            const newAcademy = {
                id: academyId,
                name: academyName || '신규 음악학원',
                phone: academyPhone || '',
                businessRegistrationNumber: '',
                ownerName: name,
                postcode: data.academyPostcode || '',
                address: academyAddress || '',
                detailAddress: data.academyDetailAddress || '',
                inviteCode: code,
                ownerUserId: userId,
                systemPassword: '0000',
                tabletPassword: '0000',
                createdAt: new Date().toISOString().slice(0, 10),
                updatedAt: new Date().toISOString().slice(0, 10)
            };
            this.db.academies.push(newAcademy);

            if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
            this.db.academyInviteCodes.push({
                id: 'INV_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                academyId: academyId,
                ownerUserId: userId,
                inviteCode: code,
                status: 'active',
                createdAt: new Date().toISOString().slice(0, 10),
                updatedAt: new Date().toISOString().slice(0, 10)
            });

            userAcademyId = academyId;
            status = 'approved';
            
            // Sync settings with new director's academy info
            this.db.settings = {
                ...this.db.settings,
                academyName: newAcademy.name,
                phone: newAcademy.phone,
                address: newAcademy.address,
                representative: name
            };
        } else {
            let acad = null;
            if (inviteCode) {
                const inviteRecord = this.getAcademyInviteCodeObject(inviteCode);
                if (!inviteRecord || inviteRecord.status !== 'active') {
                    throw new Error(!inviteRecord ? '일치하는 학원 초대코드가 없습니다.' : '현재 사용할 수 없는 초대코드입니다.');
                }
                acad = this.getAcademy(inviteRecord.academyId);
                method = 'invite_code';
            } else if (data.academyId) {
                acad = this.getAcademy(data.academyId);
                method = 'academy_search';
            }

            if (!acad) {
                throw new Error('학원 정보를 찾을 수 없습니다.');
            }
            userAcademyId = acad.id;
        }

        const newUser = {
            id: userId,
            provider,
            snsId,
            name,
            phone,
            role,
            status,
            academyId: userAcademyId,
            academies: [{ academyId: userAcademyId, status: status, role: role }],
            childName: childName || null,
            termsAgreement, // 동의 여부, 동의 시각, 버전을 포함한 데이터 저장
            createdAt: new Date().toISOString().slice(0, 10)
        };

        this.db.users.push(newUser);

        if (role !== 'director') {
            if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
            this.db.academyJoinRequests.push({
                id: 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                academyId: userAcademyId,
                userId: userId,
                userType: role,
                requestMethod: method,
                status: 'pending',
                requestedAt: new Date().toISOString().slice(0, 10),
                approvedAt: null,
                rejectedAt: null,
                approvedBy: null
            });
        }

        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        if (role !== 'director') {
            this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        }
        return newUser;
    }

    updateUserRegistration(userId, data) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        const { name, phone, inviteCode, childName } = data;
        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.childName = childName || user.childName;

        let targetAcademyId = user.academyId;
        let method = 'invite_code';

        if (inviteCode) {
            const inviteRecord = this.getAcademyInviteCodeObject(inviteCode);
            if (!inviteRecord || inviteRecord.status !== 'active') {
                throw new Error(!inviteRecord ? '일치하는 학원 초대코드가 없습니다.' : '현재 사용할 수 없는 초대코드입니다.');
            }
            const acad = this.getAcademy(inviteRecord.academyId);
            if (!acad) throw new Error('학원 정보를 찾을 수 없습니다.');
            targetAcademyId = acad.id;
        } else if (data.academyId) {
            const acad = this.getAcademy(data.academyId);
            if (!acad) throw new Error('학원 정보를 찾을 수 없습니다.');
            targetAcademyId = acad.id;
            method = 'academy_search';
        }

        user.academyId = targetAcademyId;
        user.status = 'pending';
        if (user.rejectReason) delete user.rejectReason;

        // Sync with academies list
        if (!user.academies) user.academies = [];
        user.academies = user.academies.filter(a => a.status !== 'pending');
        user.academies.push({ academyId: targetAcademyId, status: 'pending', role: user.role });

        // Update academyJoinRequests table
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        this.db.academyJoinRequests = this.db.academyJoinRequests.filter(r => !(r.userId === userId && r.status === 'pending'));
        
        this.db.academyJoinRequests.push({
            id: 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            academyId: targetAcademyId,
            userId: userId,
            userType: user.role,
            requestMethod: method,
            status: 'pending',
            requestedAt: new Date().toISOString().slice(0, 10),
            approvedAt: null,
            rejectedAt: null,
            approvedBy: null
        });

        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        return user;
    }

    updateUserProfile(userId, data) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        user.name = data.name || user.name;
        user.phone = data.phone || user.phone;
        
        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        
        if (user.id === 'USR_DIR_DEMO') {
            this.db.settings.representative = user.name;
            this.db.settings.phone = user.phone;
            this.saveDB();
        }
        return user;
    }

    withdrawUser(userId) {
        if (!this.db.users) this.db.users = [];
        const userIndex = this.db.users.findIndex(u => u.id === userId);
        if (userIndex === -1) throw new Error('사용자를 찾을 수 없습니다.');
        const user = this.db.users[userIndex];

        // 1. Clear social mapping values to allow re-registration
        localStorage.removeItem(`turing_mock_sns_id_${user.provider}`);
        localStorage.removeItem(`harmonia_mock_sns_id_${user.provider}`);

        // 2. Soft-delete user account (change status, clear active credentials, anonymize name)
        user.status = 'withdrawn';
        user.originalSnsId = user.snsId;
        user.snsId = null;
        user.originalProvider = user.provider;
        user.provider = null;
        user.name = `${user.name} (탈퇴회원)`;

        // 3. Mark linked students as discharged ("퇴원")
        if (user.role === 'parent') {
            const siblings = this.getStudentsForParent(userId);
            siblings.forEach(student => {
                student.status = 'discharged';
                student.leaveDate = new Date().toISOString().slice(0, 10);
            });
        }

        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('STUDENTS_CHANGED', this.db.students);
        this.logoutUser();
    }

    getPendingUsers(academyId) {
        if (!this.db.users) this.db.users = [];
        return this.db.users.filter(u => u.academyId === academyId && u.status === 'pending');
    }

    approveUser(userId, studentIdForParent = null) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        user.status = 'approved';
        
        if (user.role === 'parent' && studentIdForParent) {
            if (!this.db.parentStudentLinks) this.db.parentStudentLinks = [];
            const studentIds = Array.isArray(studentIdForParent) ? studentIdForParent : [studentIdForParent];
            studentIds.forEach(sid => {
                const exists = this.db.parentStudentLinks.some(link => link.parentUserId === userId && link.studentId === sid);
                if (!exists) {
                    this.db.parentStudentLinks.push({ parentUserId: userId, studentId: sid });
                }
            });
        }
        
        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('PARENT_STUDENT_LINKS_CHANGED', this.db.parentStudentLinks);
        return user;
    }

    rejectUser(userId, reason = '') {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');
        
        user.status = 'rejected';
        user.rejectReason = reason;
        
        this.saveDB();
        this.notify('USERS_CHANGED', this.db.users);
        return user;
    }

    getStudentsForParent(parentUserId) {
        if (!this.db.parentStudentLinks) this.db.parentStudentLinks = [];
        const links = this.db.parentStudentLinks.filter(link => link.parentUserId === parentUserId);
        const studentIds = links.map(link => link.studentId);
        return this.db.students.filter(s => studentIds.includes(s.id));
    }

    getJoinRequests(academyId) {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        return this.db.academyJoinRequests.filter(r => r.academyId === academyId);
    }

    getPendingJoinRequests(academyId) {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        return this.db.academyJoinRequests.filter(r => r.academyId === academyId && r.status === 'pending');
    }

    generateUniqueInviteCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded O, 0, I, 1
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        
        let code;
        let isDuplicate = true;
        while (isDuplicate) {
            code = '';
            for (let i = 0; i < 5; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            isDuplicate = this.db.academyInviteCodes.some(c => c.inviteCode === code && c.status === 'active') ||
                          this.db.academies.some(a => a.inviteCode === code);
        }
        return code;
    }

    getAcademyInviteCode(academyId) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        return this.db.academyInviteCodes.find(c => c.academyId === academyId && c.status === 'active') || 
               this.db.academyInviteCodes.filter(c => c.academyId === academyId).pop();
    }

    regenerateAcademyInviteCode(academyId) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        if (!this.db.academies) this.db.academies = [];

        const acad = this.db.academies.find(a => a.id === academyId);
        if (!acad) throw new Error('학원을 찾을 수 없습니다.');

        // Deactivate old codes
        this.db.academyInviteCodes.forEach(c => {
            if (c.academyId === academyId) {
                c.status = 'inactive';
                c.updatedAt = new Date().toISOString().slice(0, 10);
            }
        });

        // Generate and insert new code
        const newCode = this.generateUniqueInviteCode();
        const codeRecord = {
            id: 'INV_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            academyId: academyId,
            ownerUserId: acad.ownerUserId || 'USR_DIR_DEMO',
            inviteCode: newCode,
            status: 'active',
            createdAt: new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString().slice(0, 10)
        };
        this.db.academyInviteCodes.push(codeRecord);

        // Sync with academies table
        acad.inviteCode = newCode;

        this.saveDB();
        this.notify('ACADEMY_INVITE_CODES_CHANGED', this.db.academyInviteCodes);
        this.notify('ACADEMIES_CHANGED', this.db.academies);
        return newCode;
    }

    updateAcademyInviteCodeStatus(academyId, isActive) {
        if (!this.db.academyInviteCodes) this.db.academyInviteCodes = [];
        const codeObj = this.getAcademyInviteCode(academyId);
        if (!codeObj) throw new Error('초대코드가 존재하지 않습니다.');

        codeObj.status = isActive ? 'active' : 'inactive';
        codeObj.updatedAt = new Date().toISOString().slice(0, 10);

        this.saveDB();
        this.notify('ACADEMY_INVITE_CODES_CHANGED', this.db.academyInviteCodes);
    }

    searchAcademies(query) {
        if (!this.db.academies) this.db.academies = [];
        if (!query || query.trim() === '') return [];

        const chosung = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
        const getChosungStr = (str) => {
            let res = "";
            for (let i = 0; i < str.length; i++) {
                const code = str.charCodeAt(i) - 44032;
                if (code > -1 && code < 11172) {
                    res += chosung[Math.floor(code / 588)];
                } else {
                    res += str.charAt(i);
                }
            }
            return res;
        };

        const cleanQuery = query.replace(/\s+/g, '').toLowerCase();
        const isChosungOnly = /^[ㄱ-ㅎ]+$/.test(cleanQuery);

        return this.db.academies.filter(a => {
            const cleanName = a.name.replace(/\s+/g, '').toLowerCase();
            const cleanAddr = (a.address || '').replace(/\s+/g, '').toLowerCase();

            if (isChosungOnly) {
                return getChosungStr(cleanName).includes(cleanQuery) || getChosungStr(cleanAddr).includes(cleanQuery);
            }
            return cleanName.includes(cleanQuery) || cleanAddr.includes(cleanQuery);
        });
    }

    createJoinRequest(userId, academyId, requestMethod) {
        if (!this.db.users) this.db.users = [];
        const user = this.db.users.find(u => u.id === userId);
        if (!user) throw new Error('사용자를 찾을 수 없습니다.');

        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];

        // Check if already pending
        const isPending = this.db.academyJoinRequests.some(r => r.userId === userId && r.academyId === academyId && r.status === 'pending');
        if (isPending) throw new Error('이미 해당 학원에 가입신청되어 있습니다.');

        // Check if already approved
        const isApproved = user.academies && user.academies.some(a => a.academyId === academyId && a.status === 'approved');
        if (isApproved || (user.academyId === academyId && user.status === 'approved')) {
            throw new Error('이미 해당 학원에 가입되어 있습니다.');
        }

        const reqId = 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.db.academyJoinRequests.push({
            id: reqId,
            academyId,
            userId,
            userType: user.role,
            requestMethod, // 'invite_code' or 'academy_search'
            status: 'pending',
            requestedAt: new Date().toISOString().slice(0, 10),
            approvedAt: null,
            rejectedAt: null,
            approvedBy: null
        });

        // Add to user academies list
        if (!user.academies) user.academies = [];
        const uAcad = user.academies.find(a => a.academyId === academyId);
        if (!uAcad) {
            user.academies.push({ academyId, status: 'pending', role: user.role });
        } else {
            uAcad.status = 'pending';
        }

        this.saveDB();
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        this.notify('USERS_CHANGED', this.db.users);
        return reqId;
    }

    approveJoinRequest(requestId, studentIdForParent = null, directorUserId) {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        const req = this.db.academyJoinRequests.find(r => r.id === requestId);
        if (!req) throw new Error('가입 신청 내역을 찾을 수 없습니다.');

        req.status = 'approved';
        req.approvedAt = new Date().toISOString().slice(0, 10);
        req.approvedBy = directorUserId;

        const user = this.db.users.find(u => u.id === req.userId);
        if (user) {
            user.status = 'approved';
            user.academyId = req.academyId;

            if (!user.academies) user.academies = [];
            const uAcad = user.academies.find(a => a.academyId === req.academyId);
            if (uAcad) {
                uAcad.status = 'approved';
            } else {
                user.academies.push({ academyId: req.academyId, status: 'approved', role: user.role });
            }

            if (user.role === 'parent' && studentIdForParent) {
                if (!this.db.parentStudentLinks) this.db.parentStudentLinks = [];
                const sids = Array.isArray(studentIdForParent) ? studentIdForParent : [studentIdForParent];
                sids.forEach(sid => {
                    const exists = this.db.parentStudentLinks.some(link => link.parentUserId === user.id && link.studentId === sid);
                    if (!exists) {
                        this.db.parentStudentLinks.push({ parentUserId: user.id, studentId: sid });
                    }
                });
            }
        }

        this.saveDB();
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        this.notify('USERS_CHANGED', this.db.users);
        this.notify('PARENT_STUDENT_LINKS_CHANGED', this.db.parentStudentLinks || []);
    }

    rejectJoinRequest(requestId, directorUserId, reason = '') {
        if (!this.db.academyJoinRequests) this.db.academyJoinRequests = [];
        const req = this.db.academyJoinRequests.find(r => r.id === requestId);
        if (!req) throw new Error('가입 신청 내역을 찾을 수 없습니다.');

        req.status = 'rejected';
        req.rejectedAt = new Date().toISOString().slice(0, 10);
        req.approvedBy = directorUserId;

        const user = this.db.users.find(u => u.id === req.userId);
        if (user) {
            if (!user.academies) user.academies = [];
            const uAcad = user.academies.find(a => a.academyId === req.academyId);
            if (uAcad) {
                uAcad.status = 'rejected';
            }

            if (user.academyId === req.academyId) {
                user.status = 'rejected';
                user.rejectReason = reason;
            }
        }

        this.saveDB();
        this.notify('ACADEMY_JOIN_REQUESTS_CHANGED', this.db.academyJoinRequests);
        this.notify('USERS_CHANGED', this.db.users);
    }
}

// Export a single instance to be used globally
export const stateStore = new StateStore();
window.stateStore = stateStore; // Make available in console
