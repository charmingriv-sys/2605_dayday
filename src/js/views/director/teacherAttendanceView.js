import { stateStore } from '../../state.js';
import { formatPhoneNumber } from './shared.js';
import { openModal, closeModal } from '../../app.js';

export function renderTeacherAttendance(container) {
    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const toLocalISOString = (date) => {
        const tzOffset = -date.getTimezoneOffset();
        const diff = tzOffset >= 0 ? '+' : '-';
        const pad = (num) => String(num).padStart(2, '0');
        const offsetHours = pad(Math.floor(Math.abs(tzOffset) / 60));
        const offsetMinutes = pad(Math.abs(tzOffset) % 60);

        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const min = pad(date.getMinutes());
        const s = pad(date.getSeconds());

        return `${y}-${m}-${d}T${h}:${min}:${s}${diff}${offsetHours}:${offsetMinutes}`;
    };

    const decomposeTimestamp = (ts) => {
        if (!ts) return null;
        const date = new Date(ts);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const rawHours = date.getHours();
        const ampm = rawHours >= 12 ? '오후' : '오전';
        let hour = rawHours % 12;
        if (hour === 0) hour = 12;
        const min = date.getMinutes();
        const minStr = String(min).padStart(2, '0');
        return {
            dateStr,
            ampm,
            hourStr: String(hour),
            minStr
        };
    };

    const composeISOString = (dateVal, ampmVal, hourVal, minuteVal) => {
        if (!dateVal) return '';
        const [year, month, day] = dateVal.split('-').map(Number);
        let hour = Number(hourVal);
        if (ampmVal === 'PM' || ampmVal === '오후') {
            if (hour < 12) hour += 12;
        } else if (ampmVal === 'AM' || ampmVal === '오전') {
            if (hour === 12) hour = 0;
        }
        const min = Number(minuteVal);
        const dateObj = new Date(year, month - 1, day, hour, min, 0, 0);
        return toLocalISOString(dateObj);
    };

    let selectedDate = formatDate(new Date());
    let selectedRangeMode = 'today';
    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth() + 1;
    let customRangeStart = null;
    let customRangeEnd = null;
    let selectedTeacherId = '';
    let selectedStatus = '';

    // Slide drawer state
    let drawerTeacherId = null;
    let drawerYear = new Date().getFullYear();
    let drawerMonth = new Date().getMonth() + 1;

    const getRangeDates = (dateStr, mode) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const target = new Date(y, m - 1, d);
        const dates = [];
        if (mode === 'today') {
            dates.push(dateStr);
        } else if (mode === 'custom') {
            if (customRangeStart && customRangeEnd) {
                const [sy, sm, sd] = customRangeStart.split('-').map(Number);
                const [ey, em, ed] = customRangeEnd.split('-').map(Number);
                const start = new Date(sy, sm - 1, sd);
                const end = new Date(ey, em - 1, ed);
                let current = new Date(start);
                while (current <= end) {
                    dates.push(formatDate(current));
                    current.setDate(current.getDate() + 1);
                }
            } else {
                dates.push(dateStr);
            }
        } else if (mode === 'week') {
            const day = target.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(target);
            monday.setDate(target.getDate() + diffToMonday);
            for (let i = 0; i < 7; i++) {
                const current = new Date(monday);
                current.setDate(monday.getDate() + i);
                dates.push(formatDate(current));
            }
        } else if (mode === 'last_week') {
            const day = target.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const monday = new Date(target);
            monday.setDate(target.getDate() + diffToMonday - 7);
            for (let i = 0; i < 7; i++) {
                const current = new Date(monday);
                current.setDate(monday.getDate() + i);
                dates.push(formatDate(current));
            }
        } else if (mode === 'month') {
            const year = target.getFullYear();
            const month = target.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            let current = new Date(firstDay);
            while (current <= lastDay) {
                dates.push(formatDate(current));
                current.setDate(current.getDate() + 1);
            }
        } else if (mode === 'last_month') {
            const year = target.getFullYear();
            const month = target.getMonth();
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            let current = new Date(firstDay);
            while (current <= lastDay) {
                dates.push(formatDate(current));
                current.setDate(current.getDate() + 1);
            }
        }
        return dates;
    };

    const getRangeLabelText = () => {
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        if (selectedRangeMode === 'today') {
            return `오늘: ${selectedDate}`;
        }
        if (selectedRangeMode === 'custom') {
            return `기간: ${customRangeStart || selectedDate} ~ ${customRangeEnd || selectedDate}`;
        }
        const modeKo = {
            'today': '오늘',
            'week': '이번주',
            'last_week': '저번주',
            'month': '이번달',
            'last_month': '지난달'
        };
        const start = rangeDates[0];
        const end = rangeDates[rangeDates.length - 1];
        return `${modeKo[selectedRangeMode] || '기간'}: ${start} ~ ${end}`;
    };

    const formatDetailedTimestamp = (ts, showDate = false) => {
        if (!ts) return '-';
        const date = new Date(ts);
        const MM = String(date.getMonth() + 1).padStart(2, '0');
        const DD = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return showDate ? `${MM}-${DD} ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
    };

    // Calculate monthly summary statistics locally
    const getMonthlySummaryForTeacher = (teacherId, year, month) => {
        const logs = stateStore.getTeacherAttendanceLogs({ teacherId });
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        const monthlyLogs = logs.filter(log => log.date.startsWith(monthPrefix));
        
        let checkInDays = 0;
        let completedDays = 0;
        let openDays = 0;
        let totalMinutes = 0;

        monthlyLogs.forEach(log => {
            if (log.checkInAt) {
                checkInDays++;
                if (log.checkOutAt) {
                    completedDays++;
                    const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    totalMinutes += diffMins;
                } else {
                    openDays++;
                }
            }
        });

        const averageMinutes = completedDays > 0 ? Math.round(totalMinutes / completedDays) : 0;

        return {
            checkInDays,
            completedDays,
            openDays,
            totalMinutes,
            averageMinutes
        };
    };

    const downloadExcel = () => {
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const startDate = rangeDates[0];
        const endDate = rangeDates[rangeDates.length - 1];

        let fileName = '';
        if (selectedRangeMode === 'custom' && customRangeStart && customRangeEnd) {
            fileName = `teacher-attendance-${customRangeStart}_${customRangeEnd}.xls`;
        } else {
            fileName = `teacher-attendance-${selectedDate.slice(0, 7)}.xls`;
        }

        const escapeXml = (unsafe) => {
            if (unsafe === null || unsafe === undefined) return '';
            return String(unsafe)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        const getDayOfWeekKo = (dateStr) => {
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            return days[new Date(dateStr).getDay()];
        };

        const formatTimeOnly = (iso) => {
            if (!iso) return '-';
            const date = new Date(iso);
            const hh = String(date.getHours()).padStart(2, '0');
            const mm = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
        };

        const formatDuration = (mins) => {
            if (mins <= 0) return '0분';
            const hrs = Math.floor(mins / 60);
            const m = mins % 60;
            return hrs > 0 ? `${hrs}시간 ${m}분` : `${m}분`;
        };

        const teachers = stateStore.getTeachers();
        const logs = stateStore.getTeacherAttendanceLogs().filter(log => log.date >= startDate && log.date <= endDate);

        // Filter teachers who have at least one attendance log in this period
        const activeAndLogTeachers = teachers.filter(t => {
            const hasLog = logs.some(log => log.teacherId === t.id && log.checkInAt);
            return hasLog;
        });

        // Initialize unique sheet name generator
        const sheetNameMap = new Map();
        const sanitizeSheetName = (name) => {
            let clean = name.replace(/[\\/?*\[\]:]/g, '');
            if (clean.length > 31) clean = clean.slice(0, 31);
            return clean || '강사';
        };
        const getUniqueSheetName = (originalName) => {
            const base = sanitizeSheetName(originalName);
            if (!sheetNameMap.has(base)) {
                sheetNameMap.set(base, 1);
                return base;
            } else {
                const count = sheetNameMap.get(base) + 1;
                sheetNameMap.set(base, count);
                const uniqueName = `${base}_${count}`;
                if (uniqueName.length > 31) {
                    return uniqueName.slice(uniqueName.length - 31);
                }
                return uniqueName;
            }
        };

        // XML Template starts
        let xml = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>DayDay</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Malgun Gothic" x:CharSet="129" x:Family="Modern" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Malgun Gothic" x:CharSet="129" x:Family="Modern" ss:Size="16" ss:Bold="1" ss:Color="#2d3436"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#b2bec3"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#b2bec3"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#b2bec3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#b2bec3"/>
   </Borders>
   <Font ss:FontName="Malgun Gothic" x:CharSet="129" x:Family="Modern" ss:Size="10" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0984e3" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TableCell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
   </Borders>
   <Font ss:FontName="Malgun Gothic" x:CharSet="129" x:Family="Modern" ss:Size="10"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TableCellLeft">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#dfe6e9"/>
   </Borders>
   <Font ss:FontName="Malgun Gothic" x:CharSet="129" x:Family="Modern" ss:Size="10"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SummaryLabel">
   <Font ss:FontName="Malgun Gothic" x:CharSet="129" x:Family="Modern" ss:Size="10" ss:Bold="1" ss:Color="#636e72"/>
   <Interior ss:Color="#f5f6fa" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SummaryValue">
   <Font ss:FontName="Malgun Gothic" x:CharSet="129" x:Family="Modern" ss:Size="10" ss:Bold="1" ss:Color="#2d3436"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
 </Styles>
`;

        // 1. 월간 합산 Worksheet
        xml += ` <Worksheet ss:Name="월간 합산">
  <Table ss:ExpandedColumnCount="11" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="160"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="80"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Row ss:AutoFitHeight="0" ss:Height="30">
    <Cell ss:StyleID="Title" ss:MergeAcross="10"><Data ss:Type="String">강사별 월간 근태 합산 리포트 (${startDate} ~ ${endDate})</Data></Cell>
   </Row>
   <Row ss:Index="3" ss:AutoFitHeight="0" ss:Height="24">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">기간</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">강사명</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">재직상태</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">담당 악기/과목</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">출근일수</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">퇴근완료일수</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">미퇴근횟수</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">총 근무시간</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">평균 근무시간</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">수동추가횟수</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">태블릿기록횟수</Data></Cell>
   </Row>
`;

        const periodStr = `${startDate} ~ ${endDate}`;
        activeAndLogTeachers.forEach(t => {
            const teacherLogs = logs.filter(log => log.teacherId === t.id);
            
            let checkInDays = 0;
            let completedDays = 0;
            let openDays = 0;
            let totalMins = 0;
            let manualCount = 0;
            let tabletCount = 0;

            teacherLogs.forEach(log => {
                if (log.checkInAt) {
                    checkInDays++;
                    if (log.checkOutAt) {
                        completedDays++;
                        const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                        totalMins += Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    } else {
                        openDays++;
                    }
                    if (log.source === 'director_manual') {
                        manualCount++;
                    } else if (log.source === 'tablet_pin') {
                        tabletCount++;
                    }
                }
            });

            const avgMins = completedDays > 0 ? Math.round(totalMins / completedDays) : 0;
            const statusKo = t.employmentStatus === 'resigned' ? '퇴사' : '재직';

            xml += `   <Row ss:AutoFitHeight="0" ss:Height="20">
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(periodStr)}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(t.name)}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(statusKo)}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(t.instrument || '미지정')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${checkInDays}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${completedDays}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${openDays}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(formatDuration(totalMins))}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(completedDays > 0 ? formatDuration(avgMins) : '-')}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${manualCount}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="Number">${tabletCount}</Data></Cell>
   </Row>
`;
        });

        xml += `  </Table>
 </Worksheet>
`;

        // 2. 강사별 개별 Worksheet
        activeAndLogTeachers.forEach(t => {
            const sheetName = getUniqueSheetName(t.name);
            const teacherLogs = logs.filter(log => log.teacherId === t.id);
            teacherLogs.sort((a, b) => a.date.localeCompare(b.date));

            let checkInDays = 0;
            let completedDays = 0;
            let openDays = 0;
            let totalMins = 0;
            let manualCount = 0;
            let tabletCount = 0;

            teacherLogs.forEach(log => {
                if (log.checkInAt) {
                    checkInDays++;
                    if (log.checkOutAt) {
                        completedDays++;
                        const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                        totalMins += Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    } else {
                        openDays++;
                    }
                    if (log.source === 'director_manual') {
                        manualCount++;
                    } else if (log.source === 'tablet_pin') {
                        tabletCount++;
                    }
                }
            });

            const avgMins = completedDays > 0 ? Math.round(totalMins / completedDays) : 0;
            const statusKo = t.employmentStatus === 'resigned' ? '퇴사' : '재직';

            xml += ` <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table ss:ExpandedColumnCount="8" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="110"/>
   <Column ss:Width="60"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="100"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="200"/>
   <Row ss:AutoFitHeight="0" ss:Height="24">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">강사명</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${escapeXml(t.name)}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">기간</Data></Cell>
    <Cell ss:StyleID="SummaryValue" ss:MergeAcross="1"><Data ss:Type="String">${escapeXml(periodStr)}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">재직상태</Data></Cell>
    <Cell ss:StyleID="SummaryValue" ss:MergeAcross="1"><Data ss:Type="String">${escapeXml(statusKo)}</Data></Cell>
   </Row>
   <Row ss:AutoFitHeight="0" ss:Height="24">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">담당 과목</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${escapeXml(t.instrument || '미지정')}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">출근일수</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${checkInDays}일</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">퇴근완료</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${completedDays}일</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">미퇴근횟수</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${openDays}회</Data></Cell>
   </Row>
   <Row ss:AutoFitHeight="0" ss:Height="24">
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">총 근무시간</Data></Cell>
    <Cell ss:StyleID="SummaryValue" ss:MergeAcross="1"><Data ss:Type="String">${escapeXml(formatDuration(totalMins))}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">평균 근무시간</Data></Cell>
    <Cell ss:StyleID="SummaryValue"><Data ss:Type="String">${escapeXml(completedDays > 0 ? formatDuration(avgMins) : '-')}</Data></Cell>
    <Cell ss:StyleID="SummaryLabel"><Data ss:Type="String">수동/태블릿</Data></Cell>
    <Cell ss:StyleID="SummaryValue" ss:MergeAcross="1"><Data ss:Type="String">수동 ${manualCount}회 / 태블릿 ${tabletCount}회</Data></Cell>
   </Row>
   <Row ss:Height="20"/>
   <Row ss:AutoFitHeight="0" ss:Height="24">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">날짜</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">요일</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">출근시각</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">퇴근시각</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">근무시간</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">상태</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">기록 방식</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">메모</Data></Cell>
   </Row>
`;

            teacherLogs.forEach(log => {
                let durationStr = '-';
                if (log.checkInAt && log.checkOutAt) {
                    const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    durationStr = formatDuration(diffMins);
                } else if (log.checkInAt) {
                    durationStr = '0시간';
                }

                const statusKo = log.checkOutAt ? '퇴근완료' : '미퇴근';
                const sourceKo = log.source === 'director_manual' ? '수동추가' : (log.source === 'tablet_pin' ? '태블릿' : '기타');

                xml += `   <Row ss:AutoFitHeight="0" ss:Height="20">
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(log.date)}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(getDayOfWeekKo(log.date))}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(formatTimeOnly(log.checkInAt))}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(formatTimeOnly(log.checkOutAt))}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(durationStr)}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(statusKo)}</Data></Cell>
    <Cell ss:StyleID="TableCell"><Data ss:Type="String">${escapeXml(sourceKo)}</Data></Cell>
    <Cell ss:StyleID="TableCellLeft"><Data ss:Type="String">${escapeXml(log.note || '')}</Data></Cell>
   </Row>
`;
            });

            xml += `  </Table>
 </Worksheet>
`;
        });

        xml += `</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const render = () => {
        container.innerHTML = `
            <style>
                .ta-filters-card input.form-control,
                .ta-filters-card input,
                .ta-filters-card select {
                    height: 36px;
                    padding: 6px 12px;
                    font-size: 0.88rem;
                    line-height: 1.4;
                    box-sizing: border-box;
                }
                .ta-period-selector {
                    position: relative;
                    display: inline-block;
                }
                .ta-period-popover {
                    display: none;
                    position: absolute;
                    top: 60px;
                    left: 0;
                    z-index: 1000;
                    background: #ffffff !important;
                    opacity: 1 !important;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    padding: 12px;
                    min-width: 380px;
                    box-sizing: border-box;
                }
                @media (max-width: 480px) {
                    .ta-period-popover {
                        min-width: 320px;
                        width: calc(100vw - 32px);
                    }
                }
                .ta-preset-btn {
                    min-height: 28px;
                    padding: 0 10px;
                    font-size: 0.75rem;
                    border: 1px solid var(--border-color);
                    background: var(--bg-body);
                    color: var(--text-main);
                    cursor: pointer;
                    border-radius: 4px;
                    box-sizing: border-box;
                    transition: all 0.15s ease;
                    text-align: center;
                }
                .ta-preset-btn:hover {
                    background: rgba(9, 132, 227, 0.05) !important;
                    border-color: var(--primary) !important;
                }
                .ta-preset-btn.active {
                    background: var(--primary) !important;
                    color: #fff !important;
                    border-color: var(--primary) !important;
                }
                .ta-cal-day-cell {
                    height: 24px;
                    line-height: 24px;
                    font-size: 11px;
                    border-radius: 4px;
                    cursor: pointer;
                    color: var(--text-main);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }
                .ta-cal-day-cell:hover {
                    background: rgba(9, 132, 227, 0.08);
                }
                .ta-cal-day-cell.selected {
                    background: var(--primary) !important;
                    color: #fff !important;
                    font-weight: 700;
                }
                .ta-cal-day-cell.other-month {
                    color: var(--text-muted);
                    opacity: 0.4;
                }

                /* Custom Premium Tooltip styling */
                .ta-tooltip-container {
                    position: relative;
                    display: inline-block;
                }
                .ta-tooltip-text {
                    visibility: hidden;
                    width: 200px;
                    background-color: #2d3436 !important;
                    color: #ffffff !important;
                    text-align: center;
                    border-radius: 6px;
                    padding: 8px 12px;
                    position: absolute;
                    z-index: 1005;
                    top: 100%;
                    right: 0;
                    left: auto;
                    margin-left: 0;
                    margin-top: 6px;
                    opacity: 0;
                    transition: opacity 0.2s;
                    font-size: 11px;
                    line-height: 1.4;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
                    pointer-events: none;
                    font-weight: 500;
                    white-space: normal;
                }
                .ta-tooltip-container:hover .ta-tooltip-text {
                    visibility: visible;
                    opacity: 1;
                }
                @media (max-width: 480px) {
                    .ta-tooltip-text {
                        display: none !important;
                    }
                }

                /* Inspector slide Drawer */
                .ta-inspector-panel {
                    position: fixed;
                    top: 0;
                    right: 0;
                    display: flex;
                    flex-direction: column;
                    width: min(460px, 94vw);
                    height: 100vh;
                    z-index: 1001;
                    transform: translateX(110%);
                    transition: transform .22s ease;
                    border-left: 1px solid var(--border-color);
                    background: #ffffff !important;
                    box-shadow: -10px 0 30px rgba(0,0,0,0.15);
                }
                .ta-inspector-panel.open {
                    transform: translateX(0);
                }
                .ta-drawer-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 1000;
                    display: none;
                    background: rgba(0,0,0,0.3);
                }
                .ta-drawer-backdrop.open {
                    display: block;
                }
                .ta-drawer-close {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 32px;
                    height: 32px;
                    border: 1px solid var(--border-color);
                    border-radius: 50%;
                    background: var(--bg-card);
                    display: grid;
                    place-items: center;
                    font-size: 1.2rem;
                    font-weight: 700;
                    cursor: pointer;
                    color: var(--text-main);
                    border-color: var(--border-color);
                }
                .ta-inspector-head {
                    padding: 20px 48px 16px 20px;
                    border-bottom: 1px solid var(--border-color);
                    background: var(--bg-body);
                }
                .ta-profile-main {
                    display: flex;
                    flex-direction: column;
                }
                .ta-profile-main strong {
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .ta-profile-main span {
                    font-size: 13px;
                    color: var(--text-muted);
                }
                .ta-inspector-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    background: #ffffff;
                }
                .ta-drawer-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                @media (max-width: 480px) {
                    .ta-filter-actions {
                        justify-content: stretch !important;
                    }
                    .ta-filter-actions button {
                        flex: 1;
                        justify-content: center;
                    }
                }
            </style>

            <!-- 1. KPI Cards Grid -->
            <div class="metrics-grid">
                <div class="glass-card metric-card">
                    <div class="metric-icon purple">
                        <i class="fa-solid fa-chalkboard-user"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-checked-in">오늘 출근</span>
                        <span class="metric-value" id="kpi-checked-in">0명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon red">
                        <i class="fa-solid fa-user-slash"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-absent">오늘 미출근</span>
                        <span class="metric-value" id="kpi-absent">0명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon green">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-checked-out">퇴근 완료</span>
                        <span class="metric-value" id="kpi-checked-out">0명</span>
                    </div>
                </div>
                <div class="glass-card metric-card">
                    <div class="metric-icon cyan">
                        <i class="fa-solid fa-business-time"></i>
                    </div>
                    <div class="metric-info">
                        <span class="metric-label" id="kpi-label-working">미퇴근</span>
                        <span class="metric-value" id="kpi-working">0명</span>
                    </div>
                </div>
            </div>

            <!-- 2. Filters Card -->
            <div class="glass-card ta-filters-card" style="margin-bottom: 2rem; padding: 1.2rem 1.8rem; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; width: 100%;">
                    
                    <!-- Period selector -->
                    <div class="form-group ta-period-selector" style="margin-bottom: 0; flex-grow: 1; min-width: 260px; position: relative;">
                        <label style="font-weight: 600; font-size: 0.8rem; display: block; margin-bottom: 4px;">날짜/기간 선택</label>
                        <button type="button" id="ta-period-btn" class="form-control" style="width: 100%; height: 36px; text-align: left; background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 4px; font-size: 13px; color: var(--text-main); font-weight: 600; display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 0 12px; box-sizing: border-box;">
                            <span id="ta-period-label">${getRangeLabelText()}</span>
                            <span style="font-size: 10px; color: var(--text-muted);">▼</span>
                        </button>
                        
                        <!-- Popover panel -->
                        <div id="ta-period-popover" class="ta-period-popover" style="display: none; position: absolute; top: 60px; left: 0; z-index: 1000; background: #ffffff !important; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: var(--shadow-md); padding: 12px; min-width: 380px; box-sizing: border-box; max-width: calc(100vw - 32px);">
                            <div style="display: flex; gap: 12px;">
                                <!-- Left: Mini Calendar -->
                                <div class="ta-mini-datepicker-calendar" style="flex: 1;">
                                    <div class="calendar-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                        <button type="button" id="ta-cal-prev-btn" style="border: none; background: transparent; cursor: pointer; padding: 4px; font-weight: 700; color: var(--text-main);">〈</button>
                                        <span id="ta-cal-month-label" style="font-size: 13px; font-weight: 700; color: var(--text-main);"></span>
                                        <button type="button" id="ta-cal-next-btn" style="border: none; background: transparent; cursor: pointer; padding: 4px; font-weight: 700; color: var(--text-main);">〉</button>
                                    </div>
                                    <!-- Days grid header -->
                                    <div class="calendar-grid-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">
                                        <span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span style="color: #e74c3c;">일</span>
                                    </div>
                                    <!-- Days grid cells -->
                                    <div id="ta-cal-days-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center;">
                                        <!-- filled dynamically -->
                                    </div>
                                    
                                    <div class="manual-date-picker" style="margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">직접 기간 선택</span>
                                        <div style="display: flex; align-items: center; gap: 4px;">
                                            <input type="date" id="ta-start-date" value="${customRangeStart || selectedDate}" class="form-control" style="width: 115px; height: 28px; font-size: 11px; padding: 0 6px; box-sizing: border-box;">
                                            <span style="font-size: 11px; color: var(--text-muted);">~</span>
                                            <input type="date" id="ta-end-date" value="${customRangeEnd || selectedDate}" class="form-control" style="width: 115px; height: 28px; font-size: 11px; padding: 0 6px; box-sizing: border-box;">
                                            <button type="button" id="ta-custom-range-apply-btn" class="btn btn-primary" style="height: 28px; font-size: 11px; padding: 0 8px; min-width: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700;">적용</button>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Right: Preset Buttons (Vertical) -->
                                <div class="ta-quick-presets" style="width: 90px; border-left: 1px solid var(--border-color); padding-left: 12px; display: flex; flex-direction: column; gap: 6px; justify-content: center;">
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'today' ? 'active' : ''}" data-range="today">오늘</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'week' ? 'active' : ''}" data-range="week">이번주</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'last_week' ? 'active' : ''}" data-range="last_week">저번주</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'month' ? 'active' : ''}" data-range="month">이번달</button>
                                    <button type="button" class="ta-preset-btn ${selectedRangeMode === 'last_month' ? 'active' : ''}" data-range="last_month">지난달</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; flex-grow: 1; min-width: 150px;">
                        <label for="filter-teacher" style="font-weight: 600; font-size: 0.8rem;">강사 선택</label>
                        <select id="filter-teacher" class="form-control" style="padding: 8px 12px; font-size: 0.88rem;">
                            <option value="">전체 강사</option>
                            ${stateStore.getTeachers().filter(t => {
                                if (t.employmentStatus !== 'resigned') return true;
                                if (selectedTeacherId === t.id) return true;
                                
                                const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
                                const shifts = stateStore.getTeacherShifts() || [];
                                const logs = stateStore.getTeacherAttendanceLogs() || [];
                                
                                const hasLog = logs.some(log => log.teacherId === t.id && rangeDates.includes(log.date));
                                const hasShift = shifts.some(s => s.teacherId === t.id && rangeDates.includes(s.date) && s.slots && s.slots.length > 0);
                                const hasClass = rangeDates.some(date => {
                                    const todayClasses = stateStore.getTeacherStudentScheduleForDate(date) || [];
                                    return todayClasses.some(c => {
                                        if (c.teacherId !== t.id) return false;
                                        const student = stateStore.getStudents().find(s => s.id === c.studentId);
                                        if (!student) return false;
                                        if (c.source === 'override') return true;
                                        
                                        const now = new Date();
                                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                        const isCurrentOrFuture = date >= todayStr;
                                        if (isCurrentOrFuture) {
                                            return student.teacherId === t.id;
                                        }
                                        return true;
                                    });
                                });
                                
                                return hasLog || hasShift || hasClass;
                            }).map(t => {
                                const resignedSuffix = t.employmentStatus === 'resigned' ? ' (퇴사)' : '';
                                return `<option value="${t.id}" ${t.id === selectedTeacherId ? 'selected' : ''}>${t.name}${resignedSuffix}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0; flex-grow: 1; min-width: 150px;">
                        <label for="filter-status" style="font-weight: 600; font-size: 0.8rem;">상태 선택</label>
                        <select id="filter-status" class="form-control" style="padding: 8px 12px; font-size: 0.88rem;">
                            <option value="" ${selectedStatus === '' ? 'selected' : ''}>전체 상태</option>
                            <option value="미출근" ${selectedStatus === '미출근' ? 'selected' : ''}>미출근</option>
                            <option value="출근" ${selectedStatus === '출근' ? 'selected' : ''}>출근</option>
                            <option value="퇴근 완료" ${selectedStatus === '퇴근 완료' ? 'selected' : ''}>퇴근 완료</option>
                            <option value="미퇴근" ${selectedStatus === '미퇴근' ? 'selected' : ''}>미퇴근</option>
                        </select>
                    </div>
                </div>
                <div class="ta-filter-actions" style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; width: 100%; margin-top: 4px;">
                    <button type="button" id="ta-download-excel-btn" class="btn btn-outline-primary" style="height: 36px; font-size: 0.85rem; font-weight: 600; padding: 0 16px; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; white-space: nowrap;">
                        <i class="fa-solid fa-file-excel"></i> 엑셀 다운로드
                    </button>
                    <button type="button" id="ta-add-log-btn" class="btn btn-primary" style="height: 36px; font-size: 0.85rem; font-weight: 600; padding: 0 16px; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 4px; white-space: nowrap;">
                        <i class="fa-solid fa-plus"></i> 근무 추가
                    </button>
                </div>
            </div>

            <!-- 3. Instructor Work Hours Summary Section -->
            <div class="glass-card" style="margin-bottom: 2rem; padding: 1.2rem 1.8rem;">
                <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                    <i class="fa-solid fa-clock" style="color: var(--primary);"></i>
                    강사별 근무시간
                </h3>
                <div class="table-wrapper" style="margin-top: 0; overflow-x: auto;">
                    <table class="custom-table compact-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th>강사명</th>
                                <th>담당 악기/반</th>
                                <th>출근일수</th>
                                <th>총 근무시간</th>
                                <th>평균 근무시간</th>
                                <th style="position: relative;">
                                    미퇴근 횟수
                                    <span class="ta-tooltip-container" title="퇴근 기록이 누락된 근무는 총 근무시간 합산에서 제외됩니다." aria-label="퇴근 기록이 누락된 근무는 총 근무시간 합산에서 제외됩니다." style="display: inline-block; cursor: pointer; font-size: 11px; margin-left: 4px; color: var(--text-muted);">
                                        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                                        <span class="ta-tooltip-text" role="tooltip">퇴근 기록이 누락된 근무는 총 근무시간 합산에서 제외됩니다.</span>
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody id="teacher-summary-table-body">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 4. Table Card (Detailed Record) -->
            <div class="glass-card" style="display: flex; flex-direction: column;">
                <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 8px; margin-top:0;">
                    <i class="fa-solid fa-business-time" style="color: var(--primary);"></i>
                    강사 근태 기록 현황
                </h3>
                <div class="table-wrapper" style="margin-top: 0; flex-grow: 1;">
                    <table class="custom-table" id="teacher-attendance-table">
                        <thead>
                            <tr>
                                <th>강사명</th>
                                <th>연락처</th>
                                <th>담당 악기/반</th>
                                <th>출근시각</th>
                                <th>퇴근시각</th>
                                <th>근무시간</th>
                                <th>상태</th>
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody id="teacher-attendance-table-body">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 5. Backdrop and Teacher Inspector Drawer -->
            <div class="ta-drawer-backdrop" id="ta-drawer-backdrop"></div>
            <div class="ta-inspector-panel" id="ta-drawer-panel">
                <button type="button" class="ta-drawer-close" id="ta-drawer-close">×</button>
                <div class="ta-inspector-head">
                    <div class="head-student-card">
                        <div class="avatar" id="ta-drawer-avatar" style="width: 44px; height: 44px; border-radius: 50%; background: var(--primary); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 1.25rem;">강</div>
                        <div class="ta-profile-main">
                            <strong id="ta-drawer-name">-</strong>
                            <span id="ta-drawer-phone" style="font-size: 12px; margin-top: 2px;">-</span>
                            <span id="ta-drawer-instrument" style="font-size: 12px;">-</span>
                        </div>
                    </div>
                </div>
                <div class="ta-inspector-body">
                    <!-- Monthly Summary -->
                    <div class="ta-drawer-section">
                        <div style="background: var(--bg-body); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">월 출근일</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-days">0일</strong>
                                </div>
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">월 총 근무시간</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-hours">0시간</strong>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 8px;">
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">평균 근무시간</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-avg">평균 0분</strong>
                                </div>
                                <div>
                                    <span style="font-size: 11px; color: var(--text-muted); display: block;">미퇴근 횟수</span>
                                    <strong style="font-size: 15px; color: var(--text-main);" id="ta-drawer-monthly-misses">미퇴근 0회</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Monthly Calendar -->
                    <div class="ta-drawer-section">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <button type="button" id="ta-drawer-month-prev" class="ta-preset-btn" style="padding: 2px 8px; min-height: 24px; font-size: 11px;">〈</button>
                            <strong style="font-size: 14px; color: var(--text-main);" id="ta-drawer-month-label">2026년 6월</strong>
                            <button type="button" id="ta-drawer-month-next" class="ta-preset-btn" style="padding: 2px 8px; min-height: 24px; font-size: 11px;">〉</button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 10px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">
                            <span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span style="color: #e74c3c;">일</span>
                        </div>
                        <div id="ta-drawer-calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
                            <!-- Filled dynamically -->
                        </div>
                    </div>

                    <!-- Recent Edit History -->
                    <div class="ta-drawer-section" id="ta-drawer-history-section" style="margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; color: var(--text-main); display: flex; align-items: center; gap: 6px; margin-top:0;">
                            <i class="fa-solid fa-history" style="color: var(--primary);"></i>
                            최근 수정 이력
                        </h4>
                        <div id="ta-drawer-history-list" style="display: flex; flex-direction: column; gap: 8px;">
                            <!-- Filled dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindPeriodEvents();
        bindDrawerEvents();

        container.querySelector('#filter-teacher').addEventListener('change', (e) => {
            selectedTeacherId = e.target.value;
            updateData();
        });
        container.querySelector('#filter-status').addEventListener('change', (e) => {
            selectedStatus = e.target.value;
            updateData();
        });

        const addLogBtn = container.querySelector('#ta-add-log-btn');
        if (addLogBtn) {
            addLogBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openAddModal();
            });
        }

        const downloadExcelBtn = container.querySelector('#ta-download-excel-btn');
        if (downloadExcelBtn) {
            downloadExcelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                downloadExcel();
            });
        }

        updateData();
    };

    const drawCalendarGrid = (year, month) => {
        const grid = container.querySelector('#ta-cal-days-grid');
        const monthLabel = container.querySelector('#ta-cal-month-label');
        if (!grid || !monthLabel) return;
        
        monthLabel.textContent = `${year}년 ${month}월`;
        
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0).getDate();
        const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        
        const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
        
        let html = '';
        
        // Prev month days
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const prevM = month === 1 ? 12 : month - 1;
            const prevY = month === 1 ? year - 1 : year;
            const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            html += `<div class="ta-cal-day-cell other-month" data-date="${dateStr}">${d}</div>`;
        }
        
        // Current month days
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate ? 'selected' : '';
            const cellColorStyle = new Date(year, month - 1, d).getDay() === 0 ? 'color: #e74c3c;' : 'color: var(--text-main);';
            const selectedStyle = isSelected ? 'background: var(--primary) !important; color: #fff !important; font-weight: 700;' : '';
            html += `<div class="ta-cal-day-cell ${isSelected}" data-date="${dateStr}" style="${cellColorStyle} ${selectedStyle}">${d}</div>`;
        }
        
        // Next month days to fill 42 cells
        const totalFilled = startOffset + lastDay;
        const nextDays = 42 - totalFilled;
        for (let d = 1; d <= nextDays; d++) {
            const nextM = month === 12 ? 1 : month + 1;
            const nextY = month === 12 ? year + 1 : year;
            const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            html += `<div class="ta-cal-day-cell other-month" data-date="${dateStr}">${d}</div>`;
        }
        
        grid.innerHTML = html;
        
        grid.querySelectorAll('.ta-cal-day-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                selectedDate = cell.dataset.date;
                const parts = selectedDate.split('-');
                calYear = parseInt(parts[0]);
                calMonth = parseInt(parts[1]);
                selectedRangeMode = 'today';
                customRangeStart = null;
                customRangeEnd = null;
                
                const popover = container.querySelector('#ta-period-popover');
                if (popover) popover.style.display = 'none';
                
                const labelEl = container.querySelector('#ta-period-label');
                if (labelEl) labelEl.textContent = getRangeLabelText();
                
                updateData();
            });
        });
    };

    const bindPeriodEvents = () => {
        const periodBtn = container.querySelector('#ta-period-btn');
        const periodPopover = container.querySelector('#ta-period-popover');
        if (periodBtn && periodPopover) {
            periodBtn.addEventListener('click', (e) => {
                const isHidden = periodPopover.style.display === 'none';
                periodPopover.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    drawCalendarGrid(calYear, calMonth);
                }
            });
            
            periodPopover.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        const prevBtn = container.querySelector('#ta-cal-prev-btn');
        const nextBtn = container.querySelector('#ta-cal-next-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                calMonth--;
                if (calMonth < 1) {
                    calMonth = 12;
                    calYear--;
                }
                drawCalendarGrid(calYear, calMonth);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                calMonth++;
                if (calMonth > 12) {
                    calMonth = 1;
                    calYear++;
                }
                drawCalendarGrid(calYear, calMonth);
            });
        }

        container.querySelectorAll('.ta-quick-presets .ta-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;
                selectedRangeMode = range;
                customRangeStart = null;
                customRangeEnd = null;

                container.querySelectorAll('.ta-quick-presets .ta-preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (periodPopover) periodPopover.style.display = 'none';
                
                const labelEl = container.querySelector('#ta-period-label');
                if (labelEl) labelEl.textContent = getRangeLabelText();

                updateData();
            });
        });

        const applyBtn = container.querySelector('#ta-custom-range-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const startVal = container.querySelector('#ta-start-date').value;
                const endVal = container.querySelector('#ta-end-date').value;
                if (startVal && endVal) {
                    selectedRangeMode = 'custom';
                    customRangeStart = startVal;
                    customRangeEnd = endVal;

                    container.querySelectorAll('.ta-quick-presets .ta-preset-btn').forEach(b => b.classList.remove('active'));

                    if (periodPopover) periodPopover.style.display = 'none';
                    
                    const labelEl = container.querySelector('#ta-period-label');
                    if (labelEl) labelEl.textContent = getRangeLabelText();

                    updateData();
                }
            });
        }
    };

    const bindDrawerEvents = () => {
        const closeBtn = container.querySelector('#ta-drawer-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeDrawer();
            });
        }

        const backdrop = container.querySelector('#ta-drawer-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => {
                closeDrawer();
            });
        }

        const mPrev = container.querySelector('#ta-drawer-month-prev');
        if (mPrev) {
            mPrev.addEventListener('click', () => {
                drawerMonth--;
                if (drawerMonth < 1) {
                    drawerMonth = 12;
                    drawerYear--;
                }
                renderDrawerCalendar();
            });
        }

        const mNext = container.querySelector('#ta-drawer-month-next');
        if (mNext) {
            mNext.addEventListener('click', () => {
                drawerMonth++;
                if (drawerMonth > 12) {
                    drawerMonth = 1;
                    drawerYear++;
                }
                renderDrawerCalendar();
            });
        }
    };

    const openDrawer = (teacherId) => {
        drawerTeacherId = teacherId;
        const teacher = stateStore.getTeacher(teacherId);
        if (!teacher) return;

        const drawer = container.querySelector('#ta-drawer-panel');
        const backdrop = container.querySelector('#ta-drawer-backdrop');
        
        if (drawer) drawer.classList.add('open');
        if (backdrop) backdrop.classList.add('open');

        container.querySelector('#ta-drawer-name').textContent = teacher.name;
        container.querySelector('#ta-drawer-phone').textContent = formatPhoneNumber(teacher.phone || teacher.mobile || teacher.teacherPhone || teacher.contact || '-');
        container.querySelector('#ta-drawer-instrument').textContent = `담당: ${teacher.instrument || '미지정'}`;

        const summaryThisMonth = getMonthlySummaryForTeacher(teacherId, drawerYear, drawerMonth);
        renderDrawerCalendar();
    };

    const closeDrawer = () => {
        const drawer = container.querySelector('#ta-drawer-panel');
        const backdrop = container.querySelector('#ta-drawer-backdrop');
        if (drawer) drawer.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
        drawerTeacherId = null;
    };

    const renderDrawerCalendar = () => {
        if (!drawerTeacherId) return;

        container.querySelector('#ta-drawer-month-label').textContent = `${drawerYear}년 ${drawerMonth}월`;

        const summary = getMonthlySummaryForTeacher(drawerTeacherId, drawerYear, drawerMonth);
        
        let totalStr = '-';
        if (summary.totalMinutes > 0) {
            const hrs = Math.floor(summary.totalMinutes / 60);
            const mins = summary.totalMinutes % 60;
            totalStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
        } else if (summary.checkInDays > 0) {
            totalStr = '0시간';
        }

        let avgStr = '-';
        if (summary.averageMinutes > 0) {
            const hrs = Math.floor(summary.averageMinutes / 60);
            const mins = summary.averageMinutes % 60;
            avgStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
        } else if (summary.completedDays > 0) {
            avgStr = '0분';
        }

        container.querySelector('#ta-drawer-monthly-days').textContent = `${summary.checkInDays}일`;
        container.querySelector('#ta-drawer-monthly-hours').textContent = totalStr;
        container.querySelector('#ta-drawer-monthly-avg').textContent = `평균 ${avgStr}`;
        container.querySelector('#ta-drawer-monthly-misses').textContent = `미퇴근 ${summary.openDays}회`;

        const grid = container.querySelector('#ta-drawer-calendar-grid');
        if (!grid) return;

        const firstDayDay = new Date(drawerYear, drawerMonth - 1, 1).getDay();
        const startOffset = firstDayDay === 0 ? 6 : firstDayDay - 1;
        const lastDay = new Date(drawerYear, drawerMonth, 0).getDate();
        const prevMonthLastDay = new Date(drawerYear, drawerMonth - 1, 0).getDate();
        const todayStr = formatDate(new Date());
        const teacherLogs = stateStore.getTeacherAttendanceLogs({ teacherId: drawerTeacherId });

        let html = '';

        // Prev month days
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            html += `
                <div style="display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px; padding: 4px; min-height: 64px; box-sizing: border-box; font-size: 9px; line-height: 1.2; text-align: left; background: rgba(0,0,0,0.02); color: var(--text-muted); opacity: 0.3; pointer-events: none;">
                    <div style="font-weight: 700; font-size: 10px;">${d}</div>
                </div>
            `;
        }

        // Current month days
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${drawerYear}-${String(drawerMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;

            let cellState = 'absent';
            let cellTitle = '미출근';
            let checkInTimeStr = '';
            let checkOutTimeStr = '';
            let workingTimeStr = '';
            let cellStyle = 'background: rgba(149, 165, 166, 0.1); color: var(--text-main); border: 1px solid rgba(149, 165, 166, 0.15);';

            const log = teacherLogs.find(l => l.date === dateStr);

            if (log) {
                if (log.checkInAt) {
                    const checkInDate = new Date(log.checkInAt);
                    const ciH = String(checkInDate.getHours()).padStart(2, '0');
                    const ciM = String(checkInDate.getMinutes()).padStart(2, '0');
                    checkInTimeStr = `${ciH}:${ciM}`;
                    
                    if (log.checkOutAt) {
                        const checkOutDate = new Date(log.checkOutAt);
                        const coH = String(checkOutDate.getHours()).padStart(2, '0');
                        const coM = String(checkOutDate.getMinutes()).padStart(2, '0');
                        checkOutTimeStr = `${coH}:${coM}`;
                        
                        const diffMs = checkOutDate - checkInDate;
                        const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                        const hrs = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        workingTimeStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
                        cellStyle = 'background: rgba(46, 204, 113, 0.12); color: #27ae60; border: 1px solid rgba(46, 204, 113, 0.25);';
                        cellState = 'completed';
                        cellTitle = `출근: ${checkInTimeStr} | 퇴근: ${checkOutTimeStr} (${workingTimeStr})`;
                    } else {
                        checkOutTimeStr = '-';
                        workingTimeStr = '0시간';
                        if (dateStr === todayStr) {
                            workingTimeStr = '근무중';
                            cellStyle = 'background: rgba(46, 204, 113, 0.12); color: #27ae60; border: 1px solid rgba(46, 204, 113, 0.25);';
                            cellState = 'today-working';
                            cellTitle = `출근: ${checkInTimeStr} | 근무중`;
                        } else {
                            cellStyle = 'background: rgba(241, 196, 15, 0.12); color: #d35400; border: 1px solid rgba(241, 196, 15, 0.25);';
                            cellState = 'missed';
                            cellTitle = `출근: ${checkInTimeStr} | 퇴근 누락(미퇴근)`;
                        }
                    }
                }
            }

            const todayBorder = isToday ? 'border: 2px solid var(--primary) !important;' : '';
            const isFuture = dateStr > todayStr;

            html += `
                <div data-state="${cellState}" title="${cellTitle}" style="display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px; padding: 6px 4px; min-height: 64px; box-sizing: border-box; font-size: 10px; line-height: 1.2; text-align: left; cursor: help; ${cellStyle} ${todayBorder}">
                    <div style="font-weight: 700; font-size: 11px;">${d}</div>
                    ${checkInTimeStr ? `
                        <div style="font-weight: 800; font-size: 11px; text-align: center; margin-top: 6px; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${workingTimeStr}
                        </div>
                    ` : `
                        ${isFuture ? '' : '<div style="color: var(--text-muted); font-size: 10px; font-weight: 500; text-align: center; margin-top: 6px;">미출근</div>'}
                    `}
                </div>
            `;
        }

        // Next month days to fill 42 cells
        const totalFilled = startOffset + lastDay;
        const nextDays = 42 - totalFilled;
        for (let d = 1; d <= nextDays; d++) {
            html += `
                <div style="display: flex; flex-direction: column; justify-content: space-between; border-radius: 4px; padding: 4px; min-height: 64px; box-sizing: border-box; font-size: 9px; line-height: 1.2; text-align: left; background: rgba(0,0,0,0.02); color: var(--text-muted); opacity: 0.3; pointer-events: none;">
                    <div style="font-weight: 700; font-size: 10px;">${d}</div>
                </div>
            `;
        }

        grid.innerHTML = html;

        // Render recent edit history for this teacher
        const historyList = container.querySelector('#ta-drawer-history-list');
        if (historyList) {
            const editLogs = stateStore.getTeacherAttendanceEditLogs({ teacherId: drawerTeacherId });
            const recentLogs = editLogs.slice(0, 5); // recent 3~5 logs

            if (recentLogs.length === 0) {
                historyList.innerHTML = `
                    <div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 16px; background: rgba(0,0,0,0.01); border: 1px dashed var(--border-color); border-radius: 6px;">
                        수정 이력이 없습니다.
                    </div>
                `;
            } else {
                historyList.innerHTML = recentLogs.map(log => {
                    const formatTimeShort = (iso) => {
                        if (!iso) return '퇴근 누락';
                        const date = new Date(iso);
                        const h = String(date.getHours()).padStart(2, '0');
                        const m = String(date.getMinutes()).padStart(2, '0');
                        return `${h}:${m}`;
                    };
                    const beforeIn = formatTimeShort(log.before.checkInAt);
                    const beforeOut = formatTimeShort(log.before.checkOutAt);
                    const afterIn = formatTimeShort(log.after.checkInAt);
                    const afterOut = formatTimeShort(log.after.checkOutAt);

                    const changedDate = new Date(log.changedAt);
                    const mm = String(changedDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(changedDate.getDate()).padStart(2, '0');
                    const hh = String(changedDate.getHours()).padStart(2, '0');
                    const min = String(changedDate.getMinutes()).padStart(2, '0');
                    const changedAtStr = `${mm}-${dd} ${hh}:${min}`;

                    return `
                        <div style="background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; font-size: 0.78rem; display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 0.7rem;">
                                <span>기록 날짜: ${log.date}</span>
                                <span>수정일: ${changedAtStr}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text-main); margin-top: 2px;">
                                <span>수정 전:</span>
                                <span style="color: var(--text-muted); font-family: monospace;">${beforeIn} ~ ${beforeOut}</span>
                                <i class="fa-solid fa-arrow-right" style="font-size: 10px; color: var(--primary);"></i>
                                <span>수정 후:</span>
                                <span style="color: var(--primary); font-family: monospace;">${afterIn} ~ ${afterOut}</span>
                            </div>
                            ${log.note ? `<div style="color: var(--text-muted); font-size: 0.72rem; margin-top: 2px; border-top: 1px dotted var(--border-color); padding-top: 4px;">사유: ${log.note}</div>` : ''}
                        </div>
                    `;
                }).join('');
            }
        }
    };

    const updateData = () => {
        renderSummary();
        renderSummaryTable();
        renderTableBody();
        if (drawerTeacherId) {
            renderDrawerCalendar();
        }
    };

    const renderSummary = () => {
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const startDate = rangeDates[0];
        const endDate = rangeDates[rangeDates.length - 1];

        let summary;
        let labels = {};

        if (selectedRangeMode === 'today') {
            summary = stateStore.getTeacherAttendanceSummary(selectedDate);
            labels = {
                checkedIn: '오늘 출근',
                absent: '오늘 미출근',
                checkedOut: '퇴근 완료',
                working: '미퇴근'
            };
        } else {
            summary = stateStore.getTeacherAttendanceRangeSummary(startDate, endDate);
            labels = {
                checkedIn: '기간 출근',
                absent: '미출근',
                checkedOut: '퇴근 완료',
                working: '미퇴근'
            };
        }

        container.querySelector('#kpi-label-checked-in').textContent = labels.checkedIn;
        container.querySelector('#kpi-label-absent').textContent = labels.absent;
        container.querySelector('#kpi-label-checked-out').textContent = labels.checkedOut;
        container.querySelector('#kpi-label-working').textContent = labels.working;

        const unit = selectedRangeMode === 'today' ? '명' : '회';
        container.querySelector('#kpi-checked-in').textContent = `${summary.checkedInCount}${unit}`;
        container.querySelector('#kpi-absent').textContent = `${summary.absentCount}${unit}`;
        container.querySelector('#kpi-checked-out').textContent = `${summary.checkedOutCount}${unit}`;
        container.querySelector('#kpi-working').textContent = `${summary.workingCount}${unit}`;
    };

    const renderSummaryTable = () => {
        const tbody = container.querySelector('#teacher-summary-table-body');
        if (!tbody) return;

        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const startDate = rangeDates[0];
        const endDate = rangeDates[rangeDates.length - 1];

        const summaries = stateStore.getTeacherWorkHourSummary(startDate, endDate);
        const teachers = stateStore.getTeachers();

        // Filter: only show teachers with at least 1 check-in in the selected range
        let filteredSummaries = summaries.filter(s => s.checkInDays >= 1);
        if (selectedTeacherId) {
            filteredSummaries = filteredSummaries.filter(s => s.teacherId === selectedTeacherId);
        }

        if (filteredSummaries.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        일치하는 강사 요약 데이터가 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredSummaries.map(s => {
            let totalStr = '-';
            if (s.totalMinutes > 0) {
                const hrs = Math.floor(s.totalMinutes / 60);
                const mins = s.totalMinutes % 60;
                totalStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
            } else if (s.checkInDays > 0) {
                totalStr = '0분';
            }

            let avgStr = '-';
            if (s.averageMinutes > 0) {
                const hrs = Math.floor(s.averageMinutes / 60);
                const mins = s.averageMinutes % 60;
                avgStr = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
            } else if (s.completedDays > 0) {
                avgStr = '0분';
            }

            return `
                <tr data-testid="teacher-summary-row-${s.teacherId}">
                    <td style="font-weight: 600; color: var(--text-main);">
                        <a href="#" class="ta-teacher-link" data-teacher-id="${s.teacherId}" style="text-decoration: underline; color: var(--primary); font-weight: 700; cursor: pointer;">${s.teacherName}${teachers.find(t => t.id === s.teacherId)?.employmentStatus === 'resigned' ? ' (퇴사)' : ''}</a>
                    </td>
                    <td><span class="badge badge-info" style="font-size: 0.8rem; background: rgba(9, 132, 227, 0.08); color: var(--primary);">${s.instrument}</span></td>
                    <td style="font-weight: 500;">${s.checkInDays}일</td>
                    <td style="font-weight: 500;">${totalStr}</td>
                    <td style="font-weight: 500;">평균 ${avgStr}</td>
                    <td style="font-weight: 500;">미퇴근 ${s.openDays}회</td>
                </tr>
            `;
        }).join('');
    };

    const renderTableBody = () => {
        const tbody = container.querySelector('#teacher-attendance-table-body');
        if (!tbody) return;

        const teachers = stateStore.getTeachers();
        const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
        const startDate = rangeDates[0];
        const endDate = rangeDates[rangeDates.length - 1];
        const todayStr = formatDate(new Date());

        let items = [];

        if (selectedRangeMode === 'today') {
            const logs = stateStore.getTeacherAttendanceLogs({ date: selectedDate });
            const shiftsToday = (stateStore.getTeacherShifts() || []).filter(s => s.date === selectedDate && Array.isArray(s.slots) && s.slots.length > 0);
            const shiftTeacherIds = new Set(shiftsToday.map(s => s.teacherId));

            items = teachers.filter(t => {
                if (t.employmentStatus !== 'resigned') return true;
                const hasLog = logs.some(l => l.teacherId === t.id);
                const hasShift = shiftTeacherIds.has(t.id);
                const todayClasses = stateStore.getTeacherStudentScheduleForDate(selectedDate) || [];
                const hasClass = todayClasses.some(c => {
                    if (c.teacherId !== t.id) return false;
                    const student = stateStore.getStudents().find(s => s.id === c.studentId);
                    if (!student) return false;
                    if (c.source === 'override') return true;
                    
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const isCurrentOrFuture = selectedDate >= todayStr;
                    if (isCurrentOrFuture) {
                        return student.teacherId === t.id;
                    }
                    return true;
                });
                return hasLog || hasShift || hasClass;
            }).map(t => {
                const log = logs.find(l => l.teacherId === t.id);
                let checkInTime = '-';
                let checkOutTime = '-';
                let workingTime = '-';
                let status = '미출근';

                if (log) {
                    if (log.checkInAt) {
                        checkInTime = formatDetailedTimestamp(log.checkInAt, false);
                    }
                    if (log.checkOutAt) {
                        checkOutTime = formatDetailedTimestamp(log.checkOutAt, false);
                    }

                    if (log.checkInAt && log.checkOutAt) {
                        const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                        const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                        const hrs = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        workingTime = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
                        status = '퇴근 완료';
                    } else if (log.checkInAt) {
                        if (selectedDate === todayStr) {
                            status = '출근';
                        } else if (selectedDate < todayStr) {
                            status = '미퇴근';
                            workingTime = '0시간'; // 미퇴근 근무시간 0시간으로 노출
                        } else {
                            status = '출근';
                        }
                    }
                }

                return {
                    id: t.id,
                    logId: log ? log.id : null,
                    name: t.name + (t.employmentStatus === 'resigned' ? ' (퇴사)' : ''),
                    phone: t.phone || t.mobile || t.teacherPhone || t.contact || '-',
                    instrument: t.instrument || '미지정',
                    checkInTime,
                    checkOutTime,
                    workingTime,
                    status
                };
            }).filter(item => item.status !== '미출근' || shiftTeacherIds.has(item.id));
        } else {
            const logs = stateStore.getTeacherAttendanceLogs().filter(log => log.date >= startDate && log.date <= endDate);
            
            logs.sort((a, b) => b.checkInAt.localeCompare(a.checkInAt));

            items = logs.map(log => {
                const t = teachers.find(teacher => teacher.id === log.teacherId);
                if (!t) return null;

                let checkInTime = formatDetailedTimestamp(log.checkInAt, true);
                let checkOutTime = formatDetailedTimestamp(log.checkOutAt, true);
                let workingTime = '-';
                let status = '미출근';

                if (log.checkInAt && log.checkOutAt) {
                    const diffMs = new Date(log.checkOutAt) - new Date(log.checkInAt);
                    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    const hrs = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    workingTime = hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
                    status = '퇴근 완료';
                } else if (log.checkInAt) {
                    if (log.date === todayStr) {
                        status = '출근';
                    } else {
                        status = '미퇴근';
                        workingTime = '0시간'; // 미퇴근 근무시간 0시간으로 노출
                    }
                }

                return {
                    id: t.id,
                    logId: log.id,
                    name: t.name + (t.employmentStatus === 'resigned' ? ' (퇴사)' : ''),
                    phone: t.phone || t.mobile || t.teacherPhone || t.contact || '-',
                    instrument: t.instrument || '미지정',
                    checkInTime,
                    checkOutTime,
                    workingTime,
                    status
                };
            }).filter(Boolean);
        }

        if (selectedTeacherId) {
            items = items.filter(item => item.id === selectedTeacherId);
        }
        if (selectedStatus) {
            items = items.filter(item => item.status === selectedStatus);
        }

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        <i class="fa-solid fa-user-slash" style="font-size: 2rem; color: rgba(255,255,255,0.05); margin-bottom: 8px; display: block;"></i>
                        일치하는 기록이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map(item => {
            let badgeClass = 'badge-danger';
            if (item.status === '출근') {
                badgeClass = 'badge-info';
            } else if (item.status === '퇴근 완료') {
                badgeClass = 'badge-success';
            } else if (item.status === '미퇴근') {
                badgeClass = 'badge-warning';
            }

            const rowTestId = selectedRangeMode === 'today' 
                ? `teacher-row-${item.id}` 
                : `teacher-log-row-${item.logId}`;

            return `
                <tr data-testid="${rowTestId}">
                    <td style="font-weight: 600; color: var(--text-main);">
                        <a href="#" class="ta-teacher-link" data-teacher-id="${item.id}" style="text-decoration: underline; color: var(--primary); font-weight: 700; cursor: pointer;">${item.name}</a>
                    </td>
                    <td style="font-size: 0.85rem; font-weight: 500;">${formatPhoneNumber(item.phone)}</td>
                    <td><span class="badge badge-info" style="font-size: 0.8rem; background: rgba(9, 132, 227, 0.08); color: var(--primary);">${item.instrument}</span></td>
                    <td style="font-family: monospace; font-size: 0.9rem;">${item.checkInTime}</td>
                    <td style="font-family: monospace; font-size: 0.9rem;">${item.checkOutTime}</td>
                    <td style="font-weight: 500; font-size: 0.9rem;">${item.workingTime}</td>
                    <td><span class="badge ${badgeClass}">${item.status}</span></td>
                    <td>
                        <button type="button" class="btn btn-sm btn-outline-primary ta-edit-btn" data-log-id="${item.logId}" style="padding: 2px 8px; font-size: 0.78rem; font-weight: 600; margin: 0;">수정</button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    const openEditModal = (logId) => {
        if (!logId) return;
        const logs = stateStore.getTeacherAttendanceLogs();
        const log = logs.find(l => l.id === logId);
        if (!log) return;
        const teacher = stateStore.getTeacher(log.teacherId);
        if (!teacher) return;

        const decompIn = decomposeTimestamp(log.checkInAt) || {
            dateStr: log.date,
            ampm: '오전',
            hourStr: '9',
            minStr: '00'
        };
        const decompOut = decomposeTimestamp(log.checkOutAt) || {
            dateStr: log.date,
            ampm: '오후',
            hourStr: '6',
            minStr: '00'
        };

        const hasCheckout = !!log.checkOutAt;

        const beforeInStr = log.checkInAt ? formatDetailedTimestamp(log.checkInAt, false) : '-';
        const beforeOutStr = log.checkOutAt ? formatDetailedTimestamp(log.checkOutAt, false) : '퇴근 누락';

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fa-solid fa-user-clock" style="color: var(--primary); margin-right: 8px;"></i>
                    근무 기록 수정
                </h3>
                <button class="modal-close" data-close-modal>×</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 16px;">
                <!-- 강사 및 기록일 요약 정보 -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <div>
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">강사명</span>
                        <strong style="font-size: 0.95rem; color: var(--text-main);">${teacher.name}</strong>
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 2px;">기록 날짜</span>
                        <strong style="font-size: 0.95rem; color: var(--text-main);">${log.date}</strong>
                    </div>
                </div>

                <!-- 기록 상태 -->
                <div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">기록 상태</span>
                    <span class="badge ${log.checkOutAt ? 'badge-success' : 'badge-warning'}" id="ta-edit-record-status-badge">
                        ${log.checkOutAt ? '퇴근 완료' : '미퇴근'}
                    </span>
                </div>

                <!-- 수정 전 / 수정 후 대비 테이블 또는 정보 제공 -->
                <div style="background: rgba(230, 240, 255, 0.15); border: 1px solid rgba(9, 132, 227, 0.2); border-radius: 6px; padding: 10px 12px; font-size: 0.78rem;">
                    <div style="font-weight: 700; color: var(--primary); margin-bottom: 6px;">수정 전 기록 정보</div>
                    <div style="display: flex; gap: 16px; color: var(--text-main);">
                        <div>기록된 출근시각: <strong style="font-family: monospace;">${beforeInStr}</strong></div>
                        <div>기록된 퇴근시각: <strong style="font-family: monospace;">${beforeOutStr}</strong></div>
                    </div>
                </div>

                <!-- 출근시각 조절 UI -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">출근시각</label>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <select id="ta-edit-checkin-ampm" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer;">
                            <option value="오전" ${decompIn.ampm === '오전' ? 'selected' : ''}>오전</option>
                            <option value="오후" ${decompIn.ampm === '오후' ? 'selected' : ''}>오후</option>
                        </select>
                        <select id="ta-edit-checkin-hour" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<option value="${h}" ${decompIn.hourStr === String(h) ? 'selected' : ''}>${h}시</option>`).join('')}
                        </select>
                        <select id="ta-edit-checkin-minute" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => `<option value="${m}" ${decompIn.minStr === m ? 'selected' : ''}>${m}분</option>`).join('')}
                        </select>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-arrows-up-down"></i> 스크롤</span>
                    </div>
                </div>

                <!-- 퇴근시각 조절 UI -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">퇴근시각</label>
                        <label style="font-size: 0.78rem; display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; margin-bottom: 0; color: var(--text-main); font-weight: 600;">
                            <input type="checkbox" id="ta-edit-no-checkout" style="margin: 0; cursor: pointer;" ${!hasCheckout ? 'checked' : ''}> 퇴근 기록 없음 (미퇴근 처리)
                        </label>
                    </div>
                    <div id="ta-edit-checkout-selectors" style="display: ${hasCheckout ? 'flex' : 'none'}; gap: 6px; align-items: center;">
                        <select id="ta-edit-checkout-ampm" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer;">
                            <option value="오전" ${decompOut.ampm === '오전' ? 'selected' : ''}>오전</option>
                            <option value="오후" ${decompOut.ampm === '오후' ? 'selected' : ''}>오후</option>
                        </select>
                        <select id="ta-edit-checkout-hour" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<option value="${h}" ${decompOut.hourStr === String(h) ? 'selected' : ''}>${h}시</option>`).join('')}
                        </select>
                        <select id="ta-edit-checkout-minute" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => `<option value="${m}" ${decompOut.minStr === m ? 'selected' : ''}>${m}분</option>`).join('')}
                        </select>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-arrows-up-down"></i> 스크롤</span>
                    </div>
                </div>

                <!-- 수정 사유 -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label for="ta-edit-reason" style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">수정 사유</label>
                    <input type="text" id="ta-edit-reason" class="form-control" placeholder="수정 사유 입력 (예: 태블릿 오작동 보정)" style="width: 100%; margin-bottom: 0; height: 36px; padding: 6px 10px; font-size: 0.85rem;">
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; margin-bottom: 0; justify-content: center; height: 36px; font-size: 0.88rem; font-weight: 600;">취소</button>
                <button class="btn btn-primary" id="ta-edit-save-btn" style="flex: 1; margin-bottom: 0; justify-content: center; height: 36px; font-size: 0.88rem; font-weight: 600;">저장</button>
            </div>
        `;

        const onInit = (contentArea) => {
            const noCheckoutCheckbox = contentArea.querySelector('#ta-edit-no-checkout');
            const checkoutSelectors = contentArea.querySelector('#ta-edit-checkout-selectors');
            const saveBtn = contentArea.querySelector('#ta-edit-save-btn');
            const reasonInput = contentArea.querySelector('#ta-edit-reason');
            const badge = contentArea.querySelector('#ta-edit-record-status-badge');

            noCheckoutCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    checkoutSelectors.style.display = 'none';
                    if (badge) {
                        badge.className = 'badge badge-warning';
                        badge.textContent = '미퇴근';
                    }
                } else {
                    checkoutSelectors.style.display = 'flex';
                    if (badge) {
                        badge.className = 'badge badge-success';
                        badge.textContent = '퇴근 완료';
                    }
                }
            });

            // Bind close buttons
            contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
                el.addEventListener('click', closeModal);
            });

            saveBtn.addEventListener('click', () => {
                try {
                    const checkinAmpm = contentArea.querySelector('#ta-edit-checkin-ampm').value;
                    const checkinHour = contentArea.querySelector('#ta-edit-checkin-hour').value;
                    const checkinMinute = contentArea.querySelector('#ta-edit-checkin-minute').value;
                    const isNoCheckout = noCheckoutCheckbox.checked;

                    if (!checkinAmpm || !checkinHour || !checkinMinute) {
                        alert('출근시각을 입력해 주세요.');
                        return;
                    }

                    const newCheckInAt = composeISOString(log.date, checkinAmpm, checkinHour, checkinMinute);
                    let newCheckOutAt = null;

                    const checkInDate = new Date(newCheckInAt);
                    if (isNaN(checkInDate.getTime())) {
                        alert('시간 형식을 확인해 주세요.');
                        return;
                    }

                    if (!isNoCheckout) {
                        const checkoutAmpm = contentArea.querySelector('#ta-edit-checkout-ampm').value;
                        const checkoutHour = contentArea.querySelector('#ta-edit-checkout-hour').value;
                        const checkoutMinute = contentArea.querySelector('#ta-edit-checkout-minute').value;

                        if (!checkoutAmpm || !checkoutHour || !checkoutMinute) {
                            alert('시간 형식을 확인해 주세요.');
                            return;
                        }

                        newCheckOutAt = composeISOString(log.date, checkoutAmpm, checkoutHour, checkoutMinute);
                        const checkOutDate = new Date(newCheckOutAt);
                        if (isNaN(checkOutDate.getTime())) {
                            alert('시간 형식을 확인해 주세요.');
                            return;
                        }

                        if (checkOutDate <= checkInDate) {
                            alert('퇴근시각은 출근시각 이후여야 합니다.');
                            return;
                        }
                    }

                    // Confirm check before save
                    if (confirm('이 근무 기록을 수정하시겠습니까?')) {
                        stateStore.updateTeacherAttendanceLog(log.id, {
                            checkInAt: newCheckInAt,
                            checkOutAt: newCheckOutAt
                        }, {
                            note: reasonInput.value.trim()
                        });
                        closeModal();
                    }
                } catch (err) {
                    alert(err.message || '수정 중 오류가 발생했습니다.');
                }
            });
        };

        openModal(modalHtml, onInit);
    };

    const openAddModal = () => {
        const activeTeachers = stateStore.getActiveTeachers() || [];
        const todayStr = selectedDate;

        const modalHtml = `
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fa-solid fa-user-plus" style="color: var(--primary); margin-right: 8px;"></i>
                    근무 기록 추가
                </h3>
                <button class="modal-close" data-close-modal>×</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 16px;">
                <!-- 날짜 선택 -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label for="ta-add-date" style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">날짜</label>
                    <input type="date" id="ta-add-date" class="form-control" value="${todayStr}" style="width: 100%; margin-bottom: 0; height: 36px; padding: 6px 10px; font-size: 0.85rem;">
                </div>

                <!-- 강사 선택 -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label for="ta-add-teacher" style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">강사 선택</label>
                    <select id="ta-add-teacher" class="form-control" style="width: 100%; margin-bottom: 0; padding: 4px 8px; height: 36px; font-size: 0.85rem; cursor: pointer;">
                        <option value="">강사를 선택하세요</option>
                        ${activeTeachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                </div>

                <!-- 출근시각 조절 UI -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">출근시각</label>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <select id="ta-add-checkin-ampm" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer;">
                            <option value="오전" selected>오전</option>
                            <option value="오후">오후</option>
                        </select>
                        <select id="ta-add-checkin-hour" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<option value="${h}" ${h === 9 ? 'selected' : ''}>${h}시</option>`).join('')}
                        </select>
                        <select id="ta-add-checkin-minute" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => `<option value="${m}" ${m === '00' ? 'selected' : ''}>${m}분</option>`).join('')}
                        </select>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-arrows-up-down"></i> 스크롤</span>
                    </div>
                </div>

                <!-- 퇴근시각 조절 UI -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">퇴근시각</label>
                        <label style="font-size: 0.78rem; display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; margin-bottom: 0; color: var(--text-main); font-weight: 600;">
                            <input type="checkbox" id="ta-add-no-checkout" style="margin: 0; cursor: pointer;"> 퇴근 기록 없음 (미퇴근 처리)
                        </label>
                    </div>
                    <div id="ta-add-checkout-selectors" style="display: flex; gap: 6px; align-items: center;">
                        <select id="ta-add-checkout-ampm" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer;">
                            <option value="오전">오전</option>
                            <option value="오후" selected>오후</option>
                        </select>
                        <select id="ta-add-checkout-hour" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<option value="${h}" ${h === 6 ? 'selected' : ''}>${h}시</option>`).join('')}
                        </select>
                        <select id="ta-add-checkout-minute" class="form-control" style="width: 80px; margin-bottom: 0; padding: 4px 8px; height: 34px; font-size: 0.85rem; cursor: pointer; overflow-y: auto;">
                            ${Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => `<option value="${m}" ${m === '00' ? 'selected' : ''}>${m}분</option>`).join('')}
                        </select>
                        <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-arrows-up-down"></i> 스크롤</span>
                    </div>
                </div>

                <!-- 메모 -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label for="ta-add-note" style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0;">메모</label>
                    <input type="text" id="ta-add-note" class="form-control" placeholder="수동 추가 사유 입력 (예: 태블릿 체크 누락)" style="width: 100%; margin-bottom: 0; height: 36px; padding: 6px 10px; font-size: 0.85rem;">
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; gap: 8px;">
                <button class="btn btn-secondary" data-close-modal style="flex: 1; margin-bottom: 0; justify-content: center; height: 36px; font-size: 0.88rem; font-weight: 600;">취소</button>
                <button class="btn btn-primary" id="ta-add-save-btn" style="flex: 1; margin-bottom: 0; justify-content: center; height: 36px; font-size: 0.88rem; font-weight: 600;">저장</button>
            </div>
        `;

        const onInit = (contentArea) => {
            const noCheckoutCheckbox = contentArea.querySelector('#ta-add-no-checkout');
            const checkoutSelectors = contentArea.querySelector('#ta-add-checkout-selectors');
            const saveBtn = contentArea.querySelector('#ta-add-save-btn');
            const dateInput = contentArea.querySelector('#ta-add-date');
            const teacherSelect = contentArea.querySelector('#ta-add-teacher');
            const noteInput = contentArea.querySelector('#ta-add-note');

            noCheckoutCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    checkoutSelectors.style.display = 'none';
                } else {
                    checkoutSelectors.style.display = 'flex';
                }
            });

            // Bind close buttons
            contentArea.querySelectorAll('[data-close-modal], .modal-close').forEach(el => {
                el.addEventListener('click', closeModal);
            });

            saveBtn.addEventListener('click', () => {
                try {
                    const dateVal = dateInput.value;
                    const teacherIdVal = teacherSelect.value;
                    const checkinAmpm = contentArea.querySelector('#ta-add-checkin-ampm').value;
                    const checkinHour = contentArea.querySelector('#ta-add-checkin-hour').value;
                    const checkinMinute = contentArea.querySelector('#ta-add-checkin-minute').value;
                    const isNoCheckout = noCheckoutCheckbox.checked;

                    if (!dateVal) {
                        alert('날짜를 선택해 주세요.');
                        return;
                    }
                    if (!teacherIdVal) {
                        alert('강사를 선택해 주세요.');
                        return;
                    }

                    if (!checkinAmpm || !checkinHour || !checkinMinute) {
                        alert('출근시각을 입력해 주세요.');
                        return;
                    }

                    const newCheckInAt = composeISOString(dateVal, checkinAmpm, checkinHour, checkinMinute);
                    let newCheckOutAt = null;

                    const checkInDate = new Date(newCheckInAt);
                    if (isNaN(checkInDate.getTime())) {
                        alert('시간 형식을 확인해 주세요.');
                        return;
                    }

                    if (!isNoCheckout) {
                        const checkoutAmpm = contentArea.querySelector('#ta-add-checkout-ampm').value;
                        const checkoutHour = contentArea.querySelector('#ta-add-checkout-hour').value;
                        const checkoutMinute = contentArea.querySelector('#ta-add-checkout-minute').value;

                        if (!checkoutAmpm || !checkoutHour || !checkoutMinute) {
                            alert('시간 형식을 확인해 주세요.');
                            return;
                        }

                        newCheckOutAt = composeISOString(dateVal, checkoutAmpm, checkoutHour, checkoutMinute);
                        const checkOutDate = new Date(newCheckOutAt);
                        if (isNaN(checkOutDate.getTime())) {
                            alert('시간 형식을 확인해 주세요.');
                            return;
                        }

                        if (checkOutDate <= checkInDate) {
                            alert('퇴근시각은 출근시각 이후여야 합니다.');
                            return;
                        }
                    }

                    // Confirm check before save
                    if (confirm('이 강사의 근무 기록을 새로 추가하시겠습니까?')) {
                        const res = stateStore.addTeacherAttendanceLog({
                            teacherId: teacherIdVal,
                            date: dateVal,
                            checkInAt: newCheckInAt,
                            checkOutAt: newCheckOutAt,
                            note: noteInput.value.trim()
                        });

                        if (res.success) {
                            closeModal();
                            const rangeDates = getRangeDates(selectedDate, selectedRangeMode);
                            if (!rangeDates.includes(dateVal)) {
                                alert('선택한 날짜에 기록이 추가되었습니다.');
                            }
                        } else {
                            if (res.message === '이미 해당 날짜의 근태 기록이 있습니다.') {
                                alert('이미 해당 날짜의 근태 기록이 있습니다. 기존 기록을 수정해 주세요.');
                            } else {
                                alert(res.message || '저장 중 오류가 발생했습니다.');
                            }
                        }
                    }
                } catch (err) {
                    alert(err.message || '추가 중 오류가 발생했습니다.');
                }
            });
        };

        openModal(modalHtml, onInit);
    };

    const handleDocumentClick = (e) => {
        const popover = container.querySelector('#ta-period-popover');
        const btn = container.querySelector('#ta-period-btn');
        if (popover && btn && !popover.contains(e.target) && !btn.contains(e.target)) {
            popover.style.display = 'none';
        }
    };
    document.addEventListener('click', handleDocumentClick);

    // Event delegation for opening drawer when instructor name is clicked
    const handleTeacherLinkClick = (e) => {
        const link = e.target.closest('.ta-teacher-link');
        if (link) {
            e.preventDefault();
            const teacherId = link.dataset.teacherId;
            openDrawer(teacherId);
        }
    };
    container.addEventListener('click', handleTeacherLinkClick);

    // Event delegation for opening edit modal when edit button is clicked
    const handleEditBtnClick = (e) => {
        const btn = e.target.closest('.ta-edit-btn');
        if (btn) {
            e.preventDefault();
            const logId = btn.dataset.logId;
            openEditModal(logId);
        }
    };
    container.addEventListener('click', handleEditBtnClick);

    render();

    const unsubAttendance = stateStore.subscribe('TEACHER_ATTENDANCE_CHANGED', updateData);

    return () => {
        unsubAttendance();
        document.removeEventListener('click', handleDocumentClick);
        container.removeEventListener('click', handleTeacherLinkClick);
        container.removeEventListener('click', handleEditBtnClick);
    };
}
