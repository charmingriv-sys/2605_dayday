/**
 * src/js/utils/messageTemplates.js
 * Message Template & Copy Mapping Engine (Phase 18A-3)
 */

export const MESSAGE_TEMPLATES = {
  general_notice: '안녕하세요, #{이름} 원생 관련 안내드립니다. #{메모}\n- #{학원명}',
  tuition_due: '안녕하세요, #{이름} 학생 보호자님. #{학원명} #{청구월} #{수납구분} 수납일 안내드립니다. 청구 금액은 #{미납액}이며, 납부 기한은 #{납부기한}까지입니다. 감사합니다.',
  tuition_unpaid: '안녕하세요, #{이름} 학생 보호자님. #{학원명} #{청구월} #{수납구분}의 수납 상태는 #{납부상태} 상태입니다. 미납 금액은 #{미납액}이며, 납부 기한(#{납부기한})이 경과하였습니다. 빠른 확인 부탁드립니다.',
  book_unpaid: '안녕하세요, #{이름} 학생 보호자님. #{학원명} #{교재명} 교재비가 아직 납부되지 않았습니다. 미납 금액은 #{교재비}이며, 납부 기한은 #{납부기한}까지입니다. 빠른 확인 부탁드립니다.',
  attendance_absent: '안녕하세요, #{이름} 학생 보호자님. #{학원명} #{수업일} #{수업시간} 수업에 대한 출결이 #{출결상태} 상태로 기록되었습니다. 확인 부탁드립니다.',
  attendance_late: '안녕하세요, #{이름} 학생 보호자님. #{학원명} #{수업일} #{수업시간} 수업에 #{이름} 학생이 #{출결상태} 상태입니다. 확인 부탁드립니다.',
  attendance_checkout_missing: '안녕하세요, #{이름} 학생 보호자님. #{학원명} #{수업일} #{수업시간} 수업의 하원 시간이 기록되지 않아 #{출결상태} 상태로 확인되었습니다. 확인 부탁드립니다.',
  consultation_notice: '안녕하세요, #{이름} 학생 보호자님. #{학원명} 상담 예약 일정 안내드립니다. 일시: #{상담일시}. 메모: #{메모}',
  schedule_notice: '안녕하세요, #{이름} 학생 보호자님. #{학원명} #{일정명} 안내드립니다. 일시: #{일정일시}. 메모: #{메모}'
};

export const REQUIRED_MESSAGE_FIELDS = {
  general_notice: ['이름', '학원명'],
  tuition_due: ['이름', '학원명', '미납액', '납부기한', '청구월', '수납구분'],
  tuition_unpaid: ['이름', '학원명', '미납액', '납부기한', '청구월', '수납구분', '납부상태'],
  book_unpaid: ['이름', '학원명', '교재명', '교재비', '납부기한'],
  attendance_absent: ['이름', '학원명', '수업일', '수업시간', '출결상태'],
  attendance_late: ['이름', '학원명', '수업일', '수업시간', '출결상태'],
  attendance_checkout_missing: ['이름', '학원명', '수업일', '수업시간', '출결상태'],
  consultation_notice: ['이름', '학원명', '상담일시'],
  schedule_notice: ['이름', '학원명', '일정명', '일정일시']
};

export const HIGH_RISK_REQUIRED_FIELDS = [
  '미납액',
  '납부기한',
  '청구월',
  '교재명',
  '교재비',
  '수업일',
  '수업시간'
];

export function replaceMacros(template, payload) {
  if (!template) return '';
  let result = template;
  
  // Payload의 키를 기준으로 모두 치환
  Object.keys(payload || {}).forEach(key => {
    const value = payload[key];
    const safeValue = (value !== undefined && value !== null) ? String(value) : '';
    const regex = new RegExp(`#{${key}}`, 'g');
    result = result.replace(regex, safeValue);
  });

  // 누락된 선택 변수들에 대한 기본 fallback 처리 (메모 등은 빈 값 처리)
  const remainingMacros = result.match(/#\{[^\}]+\}/g) || [];
  remainingMacros.forEach(macro => {
    const key = macro.slice(2, -1);
    if (!HIGH_RISK_REQUIRED_FIELDS.includes(key)) {
      // 고위험이 아닌 경우 빈 문자 처리
      result = result.replace(new RegExp(`#{${key}}`, 'g'), '');
    }
  });

  return result;
}

export function validateMessagePayload(templateId, payload) {
  const required = REQUIRED_MESSAGE_FIELDS[templateId] || [];
  const missingFields = [];
  
  required.forEach(field => {
    const val = payload ? payload[field] : undefined;
    if (val === undefined || val === null || String(val).trim() === '') {
      missingFields.push(field);
    }
  });

  return missingFields;
}

export function validateRenderedMessage(text) {
  return text.match(/#\{[^\}]+\}/g) || [];
}

export function buildMessage(templateId, payload) {
  const template = MESSAGE_TEMPLATES[templateId];
  if (!template) {
    return {
      ok: false,
      text: '',
      templateId,
      missingFields: [],
      unresolvedMacros: [],
      reason: '등록되지 않은 템플릿입니다.'
    };
  }

  // 1. 필수 변수 검증
  const missingFields = validateMessagePayload(templateId, payload);
  
  // 고위험 필수 변수 누락 여부 확인
  const hasHighRiskMissing = missingFields.some(field => HIGH_RISK_REQUIRED_FIELDS.includes(field));
  
  if (hasHighRiskMissing) {
    const unresolvedMacros = missingFields.map(field => `#{${field}}`);
    return {
      ok: false,
      text: '',
      templateId,
      missingFields,
      unresolvedMacros,
      reason: '필수 정보가 없어 메시지를 만들 수 없습니다.'
    };
  }

  // 2. 매크로 치환 진행
  const renderedText = replaceMacros(template, payload);

  // 3. 미해결 매크로 검증
  const unresolvedMacros = validateRenderedMessage(renderedText);
  if (unresolvedMacros.length > 0) {
    return {
      ok: false,
      text: '',
      templateId,
      missingFields: unresolvedMacros.map(m => m.slice(2, -1)),
      unresolvedMacros,
      reason: '필수 정보가 없어 메시지를 만들 수 없습니다.'
    };
  }

  return {
    ok: true,
    text: renderedText,
    templateId,
    missingFields: [],
    unresolvedMacros: []
  };
}

export function validateRecipients(recipients, options = {}) {
  const blockedRecipients = [];
  const warnings = [];

  const list = Array.isArray(recipients) ? recipients : [recipients].filter(Boolean);

  list.forEach(r => {
    const status = r.status || '';
    const name = r.name || '알 수 없는 수신자';

    // 퇴원생 차단 정책
    if (status === 'withdrawn') {
      if (!options.allowWithdrawn) {
        blockedRecipients.push({ ...r, reason: '퇴원생 상태' });
      }
    }

    // 휴원생 경고 정책
    if (status === 'on_leave') {
      let isWarning = true;
      // attendance 템플릿 계열에 따라 경고 내용 고도화 가능
      let warnReason = '휴원 상태의 원생입니다.';
      if (options.templateId && options.templateId.startsWith('attendance_')) {
        warnReason = '휴원 상태인 원생의 출결 안내는 오발송 우려가 높습니다.';
      }
      warnings.push({ ...r, reason: warnReason });
    }
  });

  if (blockedRecipients.length > 0) {
    return {
      ok: false,
      blockedRecipients,
      warnings,
      reason: `발송 불가능한 수신자(${blockedRecipients.map(r => r.name).join(', ')})가 포함되어 있습니다.`
    };
  }

  return {
    ok: true,
    blockedRecipients: [],
    warnings
  };
}
