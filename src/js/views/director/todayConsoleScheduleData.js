/**
 * todayConsoleScheduleData.js
 * Extracted major schedule details data helper for Today Console (Phase 18G-4)
 */

export function buildTodayConsoleScheduleDrawerData(selectedScheduleId, stateStore) {
    if (!selectedScheduleId) {
        return { event: null, error: 'NO_ID' };
    }

    try {
        const event = stateStore.getMajorSchedules().find(item => item.id === selectedScheduleId);
        if (!event) {
            return { event: null, error: 'NOT_FOUND' };
        }

        const eventTypes = {
            academy: { label: "학원 행사" },
            lesson: { label: "보강/수업" },
            billing: { label: "수납/결제" },
            counsel: { label: "상담/학부모" },
            etc: { label: "기타" }
        };
        const meta = eventTypes[event.type] || { label: "기타" };
        
        const getAdaptedStudents = () => {
            return stateStore.getStudents ? stateStore.getStudents() : [];
        };
        const parts = getAdaptedStudents().filter(s => event.participantStudentIds && event.participantStudentIds.includes(s.id));

        const fmt = (isoStr) => {
            if (!isoStr) return "-";
            return isoStr.slice(0, 10);
        };
        
        const dday = (dateStr) => {
            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);
            const target = new Date(dateStr);
            const today = new Date(todayStr);
            const diffTime = target - today;
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };
        
        const formatDdayLabel = (diffDays) => {
            if (diffDays === 0) return "오늘 진행";
            if (diffDays < 0) return `종료 (${Math.abs(diffDays)}일 경과)`;
            return `진행 예정 (D-${diffDays})`;
        };

        const task = stateStore.getTodayTasks().find(t => 
            t.dedupeKey && t.dedupeKey.startsWith(`SYSTEM_RECOMMEND_MAJOR_SCHEDULE_${selectedScheduleId}`)
        );

        return {
            event,
            meta,
            parts,
            formattedDate: fmt(event.eventDate),
            ddayLabel: formatDdayLabel(dday(event.eventDate)),
            place: event.place || "-",
            ownerName: stateStore.getTeacherDisplayName ? stateStore.getTeacherDisplayName(event.ownerId) : event.ownerId,
            formattedDueDate: event.dueDate ? fmt(event.dueDate) + " · " + formatDdayLabel(dday(event.dueDate)) : "접수마감 없음",
            visibleText: event.visible ? "학부모 공개" : "비공개",
            memoText: event.memo || "등록된 메모가 없습니다.",
            task,
            error: null
        };
    } catch (err) {
        console.error(err);
        return { event: null, error: 'EXCEPTION', errorMessage: err.message };
    }
}
