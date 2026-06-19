/**
 * todayTaskSchedule.js
 * Extracted schedule recommendation sync module for Phase 18D
 */

export function syncScheduleRecommendations(ctx, options) {
    const { parsedNow, y, m, d, silent, addValidatedSystemTodayTask } = options;

    const activeScheduleKeys = [];

    if (ctx.db.majorSchedules) {
        const majorSchedules = ctx.db.majorSchedules || [];
        const students = typeof ctx.getStudents === 'function' ? ctx.getStudents() : (ctx.db.students || []);
        const todayMidnight = new Date(y, m, d, 0, 0, 0, 0);

        const getDiffDays = (dateStr) => {
            if (!dateStr) return null;
            const [ey, em, ed] = dateStr.split('-').map(Number);
            const eventMidnight = new Date(ey, em - 1, ed, 0, 0, 0, 0);
            const diffTime = eventMidnight.getTime() - todayMidnight.getTime();
            return Math.round(diffTime / (24 * 60 * 60 * 1000));
        };

        majorSchedules.forEach(event => {
            // 관련 원생 실명 매핑
            const participantNames = (event.participantStudentIds || [])
                .map(sid => {
                    const s = students.find(student => student.id === sid);
                    return s ? s.name : null;
                })
                .filter(Boolean)
                .join(', ');

            const milestones = [];

            // A. 접수마감 일정 (dueDate)
            if (event.dueDate) {
                const diff = getDiffDays(event.dueDate);
                if (diff !== null && diff >= 0 && diff <= 3) {
                    milestones.push({
                        type: 'registration_deadline',
                        date: event.dueDate,
                        diffDays: diff,
                        label: '접수마감',
                        title: `[일정확인] ${event.name} 접수마감 일정이 ${diff === 0 ? 'D-day' : `D-${diff}`}입니다.`
                    });
                }
            }

            // B. 진행/종료 일정 (eventDate 또는 endDate)
            const targetEventDate = event.eventDate || event.endDate;
            if (targetEventDate) {
                const diff = getDiffDays(targetEventDate);
                if (diff !== null && diff >= 0 && diff <= 3) {
                    milestones.push({
                        type: 'event_end',
                        date: targetEventDate,
                        diffDays: diff,
                        label: '진행·종료',
                        title: `[일정확인] ${event.name} 진행/종료일정이 ${diff === 0 ? 'D-day' : `D-${diff}`}입니다.`
                    });
                }
            }

            milestones.forEach(ms => {
                const dLabel = ms.diffDays === 0 ? 'D-day' : `D-${ms.diffDays}`;
                const dedupeKey = `SYSTEM_RECOMMEND_MAJOR_SCHEDULE_${event.id}_${ms.type}_${ms.date}`;
                activeScheduleKeys.push(dedupeKey);

                // 수동 완료/삭제 여부 검사
                const hasResolved = ctx.db.todayTasks.some(t =>
                    t.source === 'system' &&
                    (t.status === 'done' || t.status === 'dismissed') &&
                    t.dedupeKey === dedupeKey
                );

                if (!hasResolved) {
                    const isAlreadyOpen = ctx.db.todayTasks.some(t => t.dedupeKey === dedupeKey && t.status === 'open');
                    if (!isAlreadyOpen) {
                        let description = '일정 내용과 준비 사항을 확인해 주세요.';
                        const details = [];
                        details.push(`• 일정명: ${event.name}`);
                        details.push(`• 마일스톤 유형: ${ms.label}`);
                        details.push(`• D-day 표기: ${dLabel}`);
                        details.push(`• 날짜: ${ms.date}`);
                        details.push(`• 장소: ${event.place || '원내'}`);
                        details.push(`• 담당자: ${event.ownerId || '없음'}`);
                        details.push(`• 관련 원생: ${participantNames || '없음'}`);
                        details.push(`• 메모: ${event.memo || '없음'}`);
                        description += `\n` + details.join('\n');

                        // D-3의 9:00 AM 생성 (우선순위 오늘, 임박할수록 앞 순위 배치하기 위해 분 단위 차등 적용)
                        const dueTime = new Date(y, m, d, 9, ms.diffDays, 0, 0);
                        const endTime = new Date(y, m, d, 10, ms.diffDays, 0, 0);

                        addValidatedSystemTodayTask(ctx, {
                            organizationId: '',
                            segment: 'academy_director_console',
                            domain: 'academy',
                            source: 'system',
                            type: 'schedule',
                            category: 'schedule',
                            priority: 'today',
                            status: 'open',
                            dueAt: dueTime.toISOString(),
                            startAt: dueTime.toISOString(),
                            endAt: endTime.toISOString(),
                            title: ms.title,
                            description: description,
                            relatedStudentIds: event.participantStudentIds || [],
                            dedupeKey: dedupeKey,
                            visibilityRoles: ['director']
                        }, { domain: 'schedule', silent });
                    }
                }
            });
        });

        // 4.2 Mute / remove obsolete schedule recommendations (자동 제거 / 무효화)
        ctx.db.todayTasks = ctx.db.todayTasks.filter(t => {
            if (t.source === 'system' && t.status === 'open' && t.type === 'schedule') {
                return activeScheduleKeys.includes(t.dedupeKey);
            }
            return true;
        });
    }
}
