// state.js - Central State Store and Database for Turing Music Academy

import { settingsMethods } from './state/settings.js';
import { catalogMethods } from './state/catalog.js';
import { communicationMethods } from './state/communication.js';
import { billingMethods } from './state/billing.js';
import { attendanceMethods } from './state/attendance.js';
import { membersMethods } from './state/members.js';
import { staffMethods } from './state/staff.js';
import { authUsersMethods } from './state/authUsers.js';
import { sessionsMethods } from './state/sessions.js';
import { todayTaskMethods } from './state/todayTask.js';
import { majorScheduleMethods } from './state/majorSchedule.js';

import { LocalStorageAdapter } from './state/adapters/localStorageAdapter.js';

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
        corporateName: '비아렙스',
        scheduleDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
        scheduleStartTime: "14:00",
        scheduleEndTime: "21:00",
        scheduleSlotMinutes: 30,
        printLayoutDefault: "one-per-page",
        lateDetectionEnabled: true,
        lateThresholdMinutes: 10,
        studentAbsenceWarningEnabled: true,
        studentCheckoutMissingWarningEnabled: true,
        studentCheckoutMissingGraceMinutes: 10,
        teacherLateWarningEnabled: true,
        teacherLateWarningGraceMinutes: 5,
        teacherNoShowWarningEnabled: true,
        teacherNoShowWarningGraceMinutes: 10,
        teacherCheckoutMissingWarningEnabled: true,
        teacherCheckoutMissingGraceMinutes: 10,
        parentMessageSettings: {
            attendanceCheckIn: { messageEnabled: true, pushEnabled: true },
            attendanceCheckOut: { messageEnabled: true, pushEnabled: true },
            tuitionBilling: { messageEnabled: true, pushEnabled: true },
            tuitionOverdue: { messageEnabled: true, pushEnabled: true },
            tuitionPaid: { messageEnabled: true, pushEnabled: true },
            bookBilling: { messageEnabled: true, pushEnabled: true },
            bookOverdue: { messageEnabled: true, pushEnabled: true },
            bookPaid: { messageEnabled: true, pushEnabled: true }
        }
    },
    teachers: [
        { id: 'T1', name: '문승현', instrument: '피아노', phone: '010-1111-1001', email: 'shmoon@turing.com', color: '#ffb3c1', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" },
        { id: 'T2', name: '성어진', instrument: '바이올린', phone: '010-1111-1002', email: 'ejseong@turing.com', color: '#d6b3ff', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" },
        { id: 'T3', name: '안혜림', instrument: '기타/우쿨렐레', phone: '010-1111-1003', email: 'hrahn@turing.com', color: '#ffd699', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" },
        { id: 'T4', name: '양지숙', instrument: '보컬', phone: '010-1111-1004', email: 'jsyang@turing.com', color: '#ffcc99', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" },
        { id: 'T5', name: '엄소연', instrument: '피아노', phone: '010-1111-1005', email: 'syeom@turing.com', color: '#b3f0e1', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" },
        { id: 'T6', name: '이동은', instrument: '바이올린', phone: '010-1111-1006', email: 'delee@turing.com', color: '#b3f2b3', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" },
        { id: 'T7', name: '이해원', instrument: '플루트', phone: '010-1111-1007', email: 'hwlee@turing.com', color: '#b3e0ff', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" },
        { id: 'T8', name: '정은비', instrument: '오보에/피아노', phone: '010-1111-1008', email: 'ebjung@turing.com', color: '#99ccff', scheduleNotes: "", employmentStatus: "active", resignedAt: null, resignMemo: "" }
    ],
    students: [
        { id: 'S1', name: '최다은', phone: '010-9999-1111', parentPhone: '010-8888-2222', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-01-10', age: 10, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S2', name: '김제나', phone: '010-9999-0002', parentPhone: '010-8888-0002', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-02-12', age: 11, school: '예술초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S3', name: '박수호', phone: '010-9999-0003', parentPhone: '010-8888-0003', teacherId: 'T8', instrument: '오보에', fee: 180000, dueDay: 15, enrollDate: '2026-03-05', age: 9, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S4', name: '신지준', phone: '010-9999-0004', parentPhone: '010-8888-0004', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 5, enrollDate: '2026-04-18', age: 8, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S5', name: '채은재', phone: '010-9999-0005', parentPhone: '010-8888-0005', teacherId: 'T8', instrument: '오보에', fee: 190000, dueDay: 20, enrollDate: '2026-04-20', age: 12, school: '예술중학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S6', name: '곽도현', phone: '010-9999-0006', parentPhone: '010-8888-0006', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 10, enrollDate: '2026-02-10', age: 11, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S7', name: '연우주', phone: '010-9999-0007', parentPhone: '010-8888-0007', teacherId: 'T2', instrument: '바이올린', fee: 180000, dueDay: 15, enrollDate: '2026-03-12', age: 13, school: '예술중학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S8', name: '신서하', phone: '010-9999-0008', parentPhone: '010-8888-0008', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 5, enrollDate: '2026-01-05', age: 9, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S9', name: '신유원', phone: '010-9999-0009', parentPhone: '010-8888-0009', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 25, enrollDate: '2026-03-24', age: 10, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S10', name: '박소윤', phone: '010-9999-0010', parentPhone: '010-8888-0010', teacherId: 'T5', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-05-01', age: 7, school: '하모유치원', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S11', name: '이유림', phone: '010-9999-0011', parentPhone: '010-8888-0011', teacherId: 'T5', instrument: '피아노', fee: 150000, dueDay: 12, enrollDate: '2026-04-05', age: 8, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S12', name: '고세민', phone: '010-9999-0012', parentPhone: '010-8888-0012', teacherId: 'T7', instrument: '플루트', fee: 170000, dueDay: 10, enrollDate: '2026-03-20', age: 10, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S13', name: '고승현', phone: '010-9999-0013', parentPhone: '010-8888-0013', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 15, enrollDate: '2026-04-10', age: 9, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S14', name: '이혜원', phone: '010-9999-0014', parentPhone: '010-8888-0014', teacherId: 'T1', instrument: '피아노', fee: 160000, dueDay: 10, enrollDate: '2026-01-15', age: 12, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S15', name: '한주원', phone: '010-9999-0015', parentPhone: '010-8888-0015', teacherId: 'T5', instrument: '피아노', fee: 150000, dueDay: 12, enrollDate: '2026-05-02', age: 11, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S16', name: '반하온', phone: '010-9999-0016', parentPhone: '010-8888-0016', teacherId: 'T3', instrument: '기타', fee: 170000, dueDay: 15, enrollDate: '2026-02-20', age: 8, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S17', name: '신하율', phone: '010-9999-0017', parentPhone: '010-8888-0017', teacherId: 'T3', instrument: '기타', fee: 170000, dueDay: 15, enrollDate: '2026-03-05', age: 9, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S18', name: '김도하', phone: '010-9999-0018', parentPhone: '010-8888-0018', teacherId: 'T6', instrument: '바이올린', fee: 180000, dueDay: 10, enrollDate: '2026-02-11', age: 10, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S19', name: '김윤슬', phone: '010-9999-0019', parentPhone: '010-8888-0019', teacherId: 'T6', instrument: '바이올린', fee: 180000, dueDay: 12, enrollDate: '2026-03-14', age: 11, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S20', name: '남지환', phone: '010-9999-0020', parentPhone: '010-8888-0020', teacherId: 'T6', instrument: '바이올린', fee: 180000, dueDay: 25, enrollDate: '2026-04-05', age: 12, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S21', name: '김규희', phone: '010-9999-0001', parentPhone: '010-8888-0001', teacherId: 'T8', instrument: '피아노', fee: 150000, dueDay: 10, enrollDate: '2026-01-10', age: 10, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S22', name: '윤하은', phone: '010-9999-5555', parentPhone: '010-8888-6666', teacherId: 'T1', instrument: '피아노', fee: 160000, dueDay: 12, enrollDate: '2026-05-01', age: 9, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S23', name: '정우진', phone: '010-9999-2222', parentPhone: '010-8888-3333', teacherId: 'T2', instrument: '바이올린', fee: 180000, dueDay: 15, enrollDate: '2026-02-15', age: 11, school: '하모초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S24', name: '한예지', phone: '010-9999-3333', parentPhone: '010-8888-4444', teacherId: 'T1', instrument: '피아노', fee: 150000, dueDay: 5, enrollDate: '2026-03-05', age: 10, school: '음악초등학교', scheduleNotes: "", defaultClassDuration: 50 },
        { id: 'S25', name: '이민재', phone: '010-9999-4444', parentPhone: '010-8888-5555', teacherId: 'T3', instrument: '우쿨렐레', fee: 200000, dueDay: 25, enrollDate: '2026-04-20', age: 12, school: '예술중학교', scheduleNotes: "", defaultClassDuration: 50 }
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
    teacherShifts: [
        { id: 'TS1', teacherId: 'T8', date: '2026-05-18', slots: ['14:00', '14:30', '15:00', '15:30', '16:00'] },
        { id: 'TS2', teacherId: 'T1', date: '2026-05-18', slots: ['14:00', '14:30', '15:00'] },
        { id: 'TS3', teacherId: 'T8', date: '2026-05-20', slots: ['14:00', '14:30', '15:00'] }
    ],
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
    bookIssueRequests: [],
    announcements: [
        { id: 'AN1', title: '5월 가정의 달 학원 정기 연주회 일정 안내', content: '안녕하세요, 튜링 음악학원 원장 김하은입니다.\n학부모님들의 아낌없는 지지 덕분에 올해도 정기 연주회를 개최하게 되었습니다.\n\n■ 일시: 2026년 5월 30일(토) 오후 3시\n■ 장소: 학원 콘서트홀\n\n아이들이 그동안 열심히 준비한 연주 곡들을 들려드릴 예정이오니, 바쁘시더라도 부디 오셔서 자리를 빛내 주시고 많은 격려와 박수를 보내주시기 바랍니다.\n\n감사합니다.', date: '2026-05-15', views: 12 },
        { id: 'AN2', title: '여름방학 특별 단기 피아노 마스터 클래스 모집', content: '여름방학을 맞아 음악적 기량을 한층 높일 수 있는 피아노 마스터 클래스를 개설합니다.\n\n■ 모집 대상: 바이엘 4권 이상 학습자\n■ 정원: 선착순 10명\n■ 혜택: 전임 강사와의 1:1 집중 클리닉 및 마스터클래스 수료증 발부\n\n자세한 상담은 학원 행정실로 연락 바랍니다.', date: '2026-05-24', views: 3 }
    ],
    messages: [
        { id: 'MSG1', studentId: 'S1', title: '체르니 100 도입부 양손 프레이징 개별 안내', content: '다은이가 체르니 100번에 진입하여 양손 프레이징 연결을 연습하고 있습니다.\n왼손 반주 and 오른손 멜로디의 균형을 맞추는 데 다소 어려움이 있지만, 집중력이 좋아 금방 터득하고 있네요.\n가정에서도 하루 15분씩 메트로놈 연습을 지도해 주시면 큰 도움이 되겠습니다.', date: '2026-05-22', isRead: false },
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
    ],
    scheduleSnapshots: [],
    scheduleOverrides: [],
    scheduleOperationLogs: [],
    todayTasks: [],
    todayTaskRoutines: [],
    mockCalendarEvents: [],
    attendanceChangeLogs: [],
    majorSchedules: [
      { id: "ev1", type: "concours", name: "한국청소년 피아노 콩쿠르", eventDate: "2026-06-14", dueDate: "2026-06-07", ownerId: "정은비", place: "예술의전당", visible: false, memo: "접수 마감 전 보호자 확인 필요", participantStudentIds: ["S1", "S5"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ev2", type: "exam", name: "예원학교 입시 실기고사", eventDate: "2026-07-05", dueDate: "2026-06-09", ownerId: "한지섭", place: "예원학교 음악관", visible: false, memo: "입시 상담 예약과 원서 접수 확인", participantStudentIds: ["S3", "S7"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ev3", type: "concours", name: "영 첼리스트 콩쿠르", eventDate: "2026-06-21", dueDate: "2026-06-11", ownerId: "성여진", place: "금호아트홀", visible: false, memo: "결석 학생 보강 배정 필요", participantStudentIds: ["S2"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ev4", type: "event", name: "여름 정기 음악회", eventDate: "2026-06-27", dueDate: null, ownerId: "윤채린", place: "튜링 그랜드홀", visible: false, memo: "전체 리허설 6월 25일", participantStudentIds: ["S1", "S4"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ev5", type: "makeup", name: "6월 결석자 보강 편성", eventDate: "2026-06-12", dueDate: null, ownerId: "운영실", place: "원내", visible: false, memo: "최근 결석 원생 보강 시간 확정", participantStudentIds: ["S2", "S6"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ev6", type: "counsel", name: "입시반 학부모 상담 주간", eventDate: "2026-06-18", dueDate: null, ownerId: "원장", place: "상담실", visible: false, memo: "입시반 학부모 상담 후보 자동 큐", participantStudentIds: ["S3", "S7"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    majorScheduleStudentNotes: [
      { id: "msn_1", studentId: "S1", content: "06.04 콩쿠르 접수 보호자 확인 필요", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
      { id: "msn_2", studentId: "S1", content: "06.01 템포 흔들림, 다음 레슨에서 재점검", createdAt: "2026-06-01T10:00:00.000Z", updatedAt: "2026-06-01T10:00:00.000Z" },
      { id: "msn_3", studentId: "S2", content: "06.04 결석 보강 후보", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
      { id: "msn_4", studentId: "S2", content: "05.30 암보 불안정, 보호자 안내 완료", createdAt: "2026-05-30T10:00:00.000Z", updatedAt: "2026-05-30T10:00:00.000Z" },
      { id: "msn_5", studentId: "S3", content: "06.04 입시 상담 일정 조율 필요", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
      { id: "msn_6", studentId: "S3", content: "06.02 원서 제출 서류 안내", createdAt: "2026-06-02T10:00:00.000Z", updatedAt: "2026-06-02T10:00:00.000Z" },
      { id: "msn_7", studentId: "S4", content: "06.03 리허설 안내 문자 발송", createdAt: "2026-06-03T10:00:00.000Z", updatedAt: "2026-06-03T10:00:00.000Z" },
      { id: "msn_8", studentId: "S5", content: "06.04 추가 레슨 편성 검토", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
      { id: "msn_9", studentId: "S5", content: "06.01 곡 완성도 낮음, 원장 확인", createdAt: "2026-06-01T10:00:00.000Z", updatedAt: "2026-06-01T10:00:00.000Z" },
      { id: "msn_10", studentId: "S6", content: "06.04 보강 가능 시간 확인 필요", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
      { id: "msn_11", studentId: "S6", content: "05.29 결석 사유 입력", createdAt: "2026-05-29T10:00:00.000Z", updatedAt: "2026-05-29T10:00:00.000Z" },
      { id: "msn_12", studentId: "S7", content: "06.04 학부모 상담 후보", createdAt: "2026-06-04T10:00:00.000Z", updatedAt: "2026-06-04T10:00:00.000Z" },
      { id: "msn_13", studentId: "S7", content: "06.02 입시곡 진도 양호", createdAt: "2026-06-02T10:00:00.000Z", updatedAt: "2026-06-02T10:00:00.000Z" }
    ],
    teacherAttendanceLogs: [],
    teacherAttendanceEditLogs: [],
    parentContacts: [],
    parentMessages: []
};

const adapter = new LocalStorageAdapter({
    storageKey: DB_KEY,
    defaultDB: DEFAULT_DB
});

class StateStore {
    constructor() {
        this.listeners = {};
        this.loadDB();
        this.seedInitialBookPayments(); // Seed payments for default student books
        if (typeof this.migrateStudentBooksToIssueRequests === 'function') {
            this.migrateStudentBooksToIssueRequests();
        }
        if (typeof this.migrateParentContacts === 'function') {
            this.migrateParentContacts();
        }
    }

    seedDemoRecommendationsData() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();
        const currentMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
        
        // 1. Seed demo student
        if (!this.db.students) {
            this.db.students = [];
        }
        let demoStudent = this.db.students.find(s => s.id === 'S_DEMO_REC');
        if (!demoStudent) {
            demoStudent = {
                id: 'S_DEMO_REC',
                name: '김추천(데모)',
                phone: '010-9999-9999',
                parentPhone: '010-8888-8888',
                teacherId: 'T8',
                instrument: '피아노',
                fee: 150000,
                dueDay: 1, // Invoice due date has passed (current day is at least 3)
                enrollDate: '2026-05-01',
                age: 10,
                school: '데모초등학교',
                scheduleNotes: '',
                studentMemberNo: 9999,
                paymentStatus: 'unpaid'
            };
            this.db.students.push(demoStudent);
        }

        // 2. Seed unpaid payment for demo student
        if (!this.db.payments) {
            this.db.payments = [];
        }
        let demoPayment = this.db.payments.find(p => p.studentId === 'S_DEMO_REC' && p.month === currentMonth && p.type === 'education');
        if (!demoPayment) {
            demoPayment = {
                id: 'P_DEMO_REC',
                studentId: 'S_DEMO_REC',
                amount: 150000,
                month: currentMonth,
                type: 'education',
                status: 'unpaid',
                invoiceDate: `${currentMonth}-01`,
                paidDate: null,
                method: null
            };
            this.db.payments.push(demoPayment);
        }

        // 3. Seed delayed attendance class for today
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayOfWeekKo = days[now.getDay()]; // 오늘 요일 (일~토)
        
        // Calculate a time 30 minutes prior to now (e.g. 13:06 -> 12:36)
        const classTime = new Date(now.getTime() - 30 * 60 * 1000);
        const classHour = classTime.getHours();
        const classMin = classTime.getMinutes();
        const classTimeStr = `${String(classHour).padStart(2, '0')}:${String(classMin).padStart(2, '0')}`;

        if (!this.db.classes) {
            this.db.classes = [];
        }

        let demoClass = this.db.classes.find(c => c.id === 'C_DEMO_REC');
        if (!demoClass) {
            demoClass = {
                id: 'C_DEMO_REC',
                studentId: 'S_DEMO_REC',
                dayOfWeek: dayOfWeekKo,
                time: classTimeStr
            };
            this.db.classes.push(demoClass);
        } else {
            // Update class time and day dynamically to keep it "30 minutes prior to now" for testing
            demoClass.dayOfWeek = dayOfWeekKo;
            demoClass.time = classTimeStr;
        }

        this.saveDB();
    }
 
    // Load from local storage via adapter wrapper
    loadDB() {
        this.db = adapter.loadSnapshotSync({ mode: 'local' });
        
        if (this.db) {
            let migrated = false;
            if (!this.db.bookIssueRequests) {
                this.db.bookIssueRequests = [];
                migrated = true;
            }
            if (!this.db.parentContacts) {
                this.db.parentContacts = [];
                migrated = true;
            }
            if (!this.db.parentMessages) {
                this.db.parentMessages = [];
                migrated = true;
            }
            if (migrated) {
                this.saveDB();
            }
        }
        
        // Migrate existing student records to have defaultClassDuration if missing
        if (this.db && Array.isArray(this.db.students)) {
            let migrated = false;
            this.db.students.forEach(s => {
                if (s.defaultClassDuration === undefined || s.defaultClassDuration === null) {
                    s.defaultClassDuration = 50;
                    migrated = true;
                }
            });
            if (migrated) {
                this.saveDB();
            }
        }

        // Migrate settings to have warning configurations if missing or invalid
        if (this.db && this.db.settings) {
            let migrated = false;
            const defaults = {
                lateDetectionEnabled: true,
                lateThresholdMinutes: 10,
                studentAbsenceWarningEnabled: true,
                studentCheckoutMissingWarningEnabled: true,
                studentCheckoutMissingGraceMinutes: 10,
                teacherLateWarningEnabled: true,
                teacherLateWarningGraceMinutes: 5,
                teacherNoShowWarningEnabled: true,
                teacherNoShowWarningGraceMinutes: 10,
                teacherCheckoutMissingWarningEnabled: true,
                teacherCheckoutMissingGraceMinutes: 10
            };
            
            // 1. Fill missing configurations
            for (const key in defaults) {
                if (this.db.settings[key] === undefined || this.db.settings[key] === null) {
                    this.db.settings[key] = defaults[key];
                    migrated = true;
                }
            }

            // 2. Validate and clean Boolean values
            const booleanKeys = [
                'lateDetectionEnabled',
                'studentAbsenceWarningEnabled',
                'studentCheckoutMissingWarningEnabled',
                'teacherLateWarningEnabled',
                'teacherNoShowWarningEnabled',
                'teacherCheckoutMissingWarningEnabled'
            ];
            booleanKeys.forEach(key => {
                if (typeof this.db.settings[key] !== 'boolean') {
                    this.db.settings[key] = !!this.db.settings[key];
                    migrated = true;
                }
            });

            // 3. Validate and clean graceMinutes (0~90 min, multiples of 5)
            const minutesKeys = {
                lateThresholdMinutes: 10,
                studentCheckoutMissingGraceMinutes: 10,
                teacherLateWarningGraceMinutes: 5,
                teacherNoShowWarningGraceMinutes: 10,
                teacherCheckoutMissingGraceMinutes: 10
            };
            for (const key in minutesKeys) {
                const val = Number(this.db.settings[key]);
                const defaultVal = minutesKeys[key];
                if (isNaN(val) || val < 0 || val > 90 || val % 5 !== 0) {
                    this.db.settings[key] = defaultVal;
                    migrated = true;
                }
            }

            // 4. Validate and clean parentMessageSettings
            if (!this.db.settings.parentMessageSettings || typeof this.db.settings.parentMessageSettings !== 'object') {
                this.db.settings.parentMessageSettings = this.normalizeParentMessageSettings({});
                migrated = true;
            } else {
                const normalized = this.normalizeParentMessageSettings(this.db.settings.parentMessageSettings);
                if (JSON.stringify(this.db.settings.parentMessageSettings) !== JSON.stringify(normalized)) {
                    this.db.settings.parentMessageSettings = normalized;
                    migrated = true;
                }
            }

            // 5. Validate and clean parentCommunicationTabSettings
            if (!this.db.settings.parentCommunicationTabSettings || typeof this.db.settings.parentCommunicationTabSettings !== 'object') {
                this.db.settings.parentCommunicationTabSettings = {
                    announcements: { enabled: false },
                    surveys: { enabled: true },
                    messages: { enabled: true }
                };
                migrated = true;
            } else {
                const currentSettings = this.db.settings.parentCommunicationTabSettings;
                let subMigrated = false;
                
                if (!currentSettings.announcements || typeof currentSettings.announcements.enabled !== 'boolean') {
                    currentSettings.announcements = { enabled: currentSettings.announcements ? !!currentSettings.announcements.enabled : false };
                    subMigrated = true;
                }
                if (!currentSettings.surveys || typeof currentSettings.surveys.enabled !== 'boolean') {
                    currentSettings.surveys = { enabled: currentSettings.surveys ? !!currentSettings.surveys.enabled : true };
                    subMigrated = true;
                }
                if (!currentSettings.messages || typeof currentSettings.messages.enabled !== 'boolean') {
                    currentSettings.messages = { enabled: currentSettings.messages ? !!currentSettings.messages.enabled : true };
                    subMigrated = true;
                }
                
                if (subMigrated) {
                    migrated = true;
                }
            }

            if (migrated) {
                this.saveDB();
            }
        }
    }

    // Save to local storage via adapter wrapper
    saveDB() {
        adapter.saveSnapshotSync(this.db, { mode: 'local' });
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
}

// Inject partitioned domain methods into StateStore prototype
Object.assign(StateStore.prototype, settingsMethods);
Object.assign(StateStore.prototype, catalogMethods);
Object.assign(StateStore.prototype, communicationMethods);
Object.assign(StateStore.prototype, billingMethods);
Object.assign(StateStore.prototype, attendanceMethods);
Object.assign(StateStore.prototype, membersMethods);
Object.assign(StateStore.prototype, staffMethods);
Object.assign(StateStore.prototype, authUsersMethods);
Object.assign(StateStore.prototype, sessionsMethods);
Object.assign(StateStore.prototype, todayTaskMethods);
Object.assign(StateStore.prototype, majorScheduleMethods);

// Export a single instance to be used globally
export const stateStore = new StateStore();
window.stateStore = stateStore; // Make available in console

// Phase 13C-Repair-A: Developer/QA Debug Seed Helper
if (typeof localStorage !== 'undefined' && localStorage.getItem('DAYDAY_DEBUG_WARNING_SEED') === 'enabled') {
    window.seedWarningDemoData = function() {
        if (window.__daydayWarningSeedBackup) {
            alert("이미 주입된 검수용 데이터가 존재합니다. 먼저 clearWarningDemoData()를 실행하여 복원하세요.");
            return;
        }
        if (!confirm("현재 브라우저의 검수용 데이터를 임시로 주입합니다. 계속할까요?")) {
            return;
        }

        // Backup original database snapshot and mockTime
        window.__daydayWarningSeedBackup = JSON.stringify(stateStore.db);
        window.__daydayWarningSeedMockTimeBackup = window.__mockTime;

        const db = stateStore.db;

        // Ensure arrays exist
        if (!db.students) db.students = [];
        if (!db.teachers) db.teachers = [];
        if (!db.schedules) db.schedules = [];
        if (!db.attendance) db.attendance = [];
        if (!db.teacherShifts) db.teacherShifts = [];
        if (!db.teacherAttendanceLogs) db.teacherAttendanceLogs = [];
        if (!db.todayTasks) db.todayTasks = [];
        if (!db.scheduleSnapshots) db.scheduleSnapshots = [];

        // Clean up existing DEBUG- data to prevent duplicates
        db.students = db.students.filter(s => !s.id.startsWith('DEBUG-STUDENT-'));
        db.teachers = db.teachers.filter(t => !t.id.startsWith('DEBUG-TEACHER-'));
        db.schedules = db.schedules.filter(s => !s.id.startsWith('DEBUG-WARNING-'));
        db.attendance = db.attendance.filter(a => !a.id.startsWith('DEBUG-WARNING-'));
        db.teacherShifts = db.teacherShifts.filter(s => !s.id.startsWith('DEBUG-WARNING-'));
        db.teacherAttendanceLogs = db.teacherAttendanceLogs.filter(l => !l.id.startsWith('DEBUG-WARNING-'));
        db.todayTasks = db.todayTasks.filter(t => !t.id.startsWith('DEBUG-WARNING-') && !(t.dedupeKey && t.dedupeKey.includes('DEBUG-')));

        const date = new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // Ensure warning thresholds and switches are active for evaluations
        db.settings = {
            ...db.settings,
            lateDetectionEnabled: true,
            lateThresholdMinutes: 10,
            studentAbsenceWarningEnabled: true,
            studentCheckoutMissingWarningEnabled: true,
            studentCheckoutMissingGraceMinutes: 10,
            teacherLateWarningEnabled: true,
            teacherLateGraceMinutes: 5,
            teacherNoShowWarningEnabled: true,
            teacherNoShowGraceMinutes: 15,
            teacherCheckoutMissingWarningEnabled: true,
            teacherCheckoutMissingGraceMinutes: 10
        };

        // 1. Students Warning Seed Data
        // Find or create today's schedule snapshot to push entries directly
        let todaySnapshot = db.scheduleSnapshots.find(s => s.date === todayStr);
        if (!todaySnapshot) {
            todaySnapshot = {
                id: `SNAP_${todayStr}_AC1`,
                academyId: 'AC1',
                date: todayStr,
                type: 'teacherStudentSchedule',
                entries: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            db.scheduleSnapshots.push(todaySnapshot);
        }

        // Clean up debug entries in today's snapshot to prevent duplicates
        todaySnapshot.entries = todaySnapshot.entries.filter(e => !e.id.startsWith('DEBUG-WARNING-'));

        // 1.1 Absent warning (1 student/schedule, early finished, no attendance log)
        db.students.push({ id: 'DEBUG-STUDENT-ABSENT', name: '디버그결석', academyId: 'AC1', defaultClassDuration: 50 });
        todaySnapshot.entries.push({
            id: 'DEBUG-WARNING-SCH-ABSENT',
            studentId: 'DEBUG-STUDENT-ABSENT',
            teacherId: 'T8',
            startTime: '09:00',
            endTime: '09:50',
            classDuration: 50,
            subjectId: 'piano',
            source: 'default'
        });

        // 1.2 Late warning (1 student/schedule/attendance log, 10:00 -> 10:15 checkin)
        db.students.push({ id: 'DEBUG-STUDENT-LATE', name: '디버그지각', academyId: 'AC1', defaultClassDuration: 50 });
        todaySnapshot.entries.push({
            id: 'DEBUG-WARNING-SCH-LATE',
            studentId: 'DEBUG-STUDENT-LATE',
            teacherId: 'T8',
            startTime: '10:00',
            endTime: '10:50',
            classDuration: 50,
            subjectId: 'piano',
            source: 'default'
        });
        db.attendance.push({
            id: 'DEBUG-WARNING-ATT-LATE',
            studentId: 'DEBUG-STUDENT-LATE',
            date: todayStr,
            classTime: '10:00',
            time: '10:15',
            status: 'present',
            leavingTime: '10:50'
        });

        // 1.3 Late + Checkout Missing warning (1 student/schedule/attendance log, 11:00 -> 11:15, no leavingTime)
        db.students.push({ id: 'DEBUG-STUDENT-LATEMISSING', name: '디버그지각하원누락', academyId: 'AC1', defaultClassDuration: 50 });
        todaySnapshot.entries.push({
            id: 'DEBUG-WARNING-SCH-LATEMISSING',
            studentId: 'DEBUG-STUDENT-LATEMISSING',
            teacherId: 'T8',
            startTime: '11:00',
            endTime: '11:50',
            classDuration: 50,
            subjectId: 'piano',
            source: 'default'
        });
        db.attendance.push({
            id: 'DEBUG-WARNING-ATT-LATEMISSING',
            studentId: 'DEBUG-STUDENT-LATEMISSING',
            date: todayStr,
            classTime: '11:00',
            time: '11:15',
            status: 'present',
            leavingTime: null
        });

        // 2. Teachers Warning Seed Data
        // 2.1 Late warning (13:00 -> 13:10 checkin)
        db.teachers.push({ id: 'DEBUG-TEACHER-LATE', name: '디버그강사지각', academyId: 'AC1', employmentStatus: 'active' });
        db.teacherShifts.push({
            id: 'DEBUG-WARNING-SHIFT-LATE',
            teacherId: 'DEBUG-TEACHER-LATE',
            date: todayStr,
            slots: ['13:00', '13:30']
        });
        db.teacherAttendanceLogs.push({
            id: 'DEBUG-WARNING-LOG-LATE',
            teacherId: 'DEBUG-TEACHER-LATE',
            date: todayStr,
            checkInAt: `${todayStr}T13:10:00`,
            checkOutAt: `${todayStr}T14:00:00`
        });

        // 2.2 No-show warning (14:00 slot, no checkIn log)
        db.teachers.push({ id: 'DEBUG-TEACHER-NOSHOW', name: '디버그강사미출근', academyId: 'AC1', employmentStatus: 'active' });
        db.teacherShifts.push({
            id: 'DEBUG-WARNING-SHIFT-NOSHOW',
            teacherId: 'DEBUG-TEACHER-NOSHOW',
            date: todayStr,
            slots: ['14:00', '14:30']
        });

        // 2.3 Checkout Missing warning (15:00 slot, checkIn 15:00, no checkOut log)
        db.teachers.push({ id: 'DEBUG-TEACHER-MISSING', name: '디버그강사퇴근누락', academyId: 'AC1', employmentStatus: 'active' });
        db.teacherShifts.push({
            id: 'DEBUG-WARNING-SHIFT-MISSING',
            teacherId: 'DEBUG-TEACHER-MISSING',
            date: todayStr,
            slots: ['15:00', '15:30']
        });
        db.teacherAttendanceLogs.push({
            id: 'DEBUG-WARNING-LOG-MISSING',
            teacherId: 'DEBUG-TEACHER-MISSING',
            date: todayStr,
            checkInAt: `${todayStr}T15:00:00`,
            checkOutAt: null
        });

        // 2.4 Late + Checkout Missing warning (16:00 slot, checkIn 16:10, no checkOut log)
        db.teachers.push({ id: 'DEBUG-TEACHER-LATEMISSING', name: '디버그강사지각퇴근누락', academyId: 'AC1', employmentStatus: 'active' });
        db.teacherShifts.push({
            id: 'DEBUG-WARNING-SHIFT-LATEMISSING',
            teacherId: 'DEBUG-TEACHER-LATEMISSING',
            date: todayStr,
            slots: ['16:00', '16:30']
        });
        db.teacherAttendanceLogs.push({
            id: 'DEBUG-WARNING-LOG-LATEMISSING',
            teacherId: 'DEBUG-TEACHER-LATEMISSING',
            date: todayStr,
            checkInAt: `${todayStr}T16:10:00`,
            checkOutAt: null
        });

        // Set debug evaluation override time in settings
        const evalTime = new Date(`${todayStr}T18:00:00`);
        db.settings.DAYDAY_DEBUG_EVAL_TIME = evalTime.toISOString();

        // Save state changes
        stateStore.saveDB();

        // Mute stateStore.notify to prevent infinite rendering cascade during evaluation
        const originalNotify = stateStore.notify;
        stateStore.notify = function() {};

        try {
            // Evaluate recommendations
            stateStore.syncSystemRecommendations(evalTime);
        } finally {
            // Restore notify
            stateStore.notify = originalNotify;
        }

        // Trigger console rerender exactly once
        stateStore.notify('TODAY_TASKS_CHANGED', stateStore.db.todayTasks || []);

        console.log("DAYDAY WARNING SEED: Demo warning data has been successfully injected!");
    };

    window.clearWarningDemoData = function() {
        if (!window.__daydayWarningSeedBackup) {
            alert("복원할 백업 데이터가 없습니다.");
            return;
        }
        if (!confirm("임시 주입한 검수용 데이터를 삭제하고 백업으로 복원합니다. 계속할까요?")) {
            return;
        }

        try {
            stateStore.db = JSON.parse(window.__daydayWarningSeedBackup);
            delete window.__daydayWarningSeedBackup;

            if (window.__daydayWarningSeedMockTimeBackup !== undefined) {
                window.__mockTime = window.__daydayWarningSeedMockTimeBackup;
                delete window.__daydayWarningSeedMockTimeBackup;
            } else {
                delete window.__mockTime;
            }

            stateStore.saveDB();
            stateStore.notify('TODAY_TASKS_CHANGED', stateStore.db.todayTasks || []);
            console.log("DAYDAY WARNING SEED: DB successfully restored from backup!");
        } catch (e) {
            console.error("DAYDAY WARNING SEED: Failed to restore backup DB", e);
        }
    };
}
