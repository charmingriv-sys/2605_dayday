// outboundProvider.js - SMS Provider Mock Gateway abstraction and db collections

const byteLen = (str) => {
  let n = 0;
  for (const ch of (str || "")) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
};

const msgKind = (title, body, hasImage) => {
  if (hasImage) return "mms";
  const total = byteLen(title) + byteLen(body);
  return total <= 90 ? "sms" : "lms";
};

const maskPhone = (phone) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 7) return phone;
  const len = cleaned.length;
  if (len === 11) {
    return `${cleaned.slice(0, 3)}-****-${cleaned.slice(7)}`;
  } else if (len === 10) {
    return `${cleaned.slice(0, 3)}-***-${cleaned.slice(6)}`;
  }
  return phone;
};

const computeBodyHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

const computePhoneHash = (phone) => {
  if (!phone) return 'no_phone';
  const cleaned = phone.replace(/\D/g, '');
  return computeBodyHash(cleaned);
};

const generateIdempotencyKey = (logOrRequestId, phoneHash, channel, bodyHash) => {
  // TODO: 향후 실제 provider 전환 시 phoneHash 또는 tokenizedPhone으로 대체할 수 있습니다.
  return `${logOrRequestId || 'no_log'}_${phoneHash || 'no_phone'}_${channel}_${bodyHash}`;
};

export const outboundProviderMethods = {
  // Getter for outboundMessageDeliveries
  getOutboundMessageDeliveries() {
    if (!this.db.outboundMessageDeliveries) {
      this.db.outboundMessageDeliveries = [];
      this.saveDB();
    }
    return this.db.outboundMessageDeliveries;
  },

  createOutboundRequest(input) {
    return {
      id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
      method: input.method || 'SMS',
      senderNumber: input.senderNumber || '02-1234-5678',
      title: input.title || '',
      body: input.body || '',
      imageName: input.imageName || null,
      recipients: (input.recipients || []).map(r => ({
        name: r.name,
        phone: r.phone,
        role: r.role || '직접입력',
        studentId: r.studentId || r.no || null,
        source: r.source || 'student'
      })),
      relatedTaskId: input.relatedTaskId || null,
      relatedDomainType: input.relatedDomainType || null,
      relatedDomainId: input.relatedDomainId || null,
      createdAt: new Date().toISOString()
    };
  },

  sendSmsViaMockProvider(request) {
    const results = (request.recipients || []).map(recipient => {
      const normalizedPhone = (recipient.phone || '').replace(/\D/g, '');
      const maskedPhone = maskPhone(recipient.phone);
      
      const isPush = request.method === 'PUSH';
      const isAlimtalk = request.method === 'ALIMTALK' || request.method === '알림톡';
      
      let channel = 'sms';
      if (isPush) {
        channel = 'push';
      } else if (isAlimtalk) {
        channel = 'alimtalk';
      } else {
        channel = msgKind(request.title, request.body, !!request.imageName);
      }

      let status = 'sent';
      let failureCode = null;
      let failureReason = null;

      if (!recipient.phone || !recipient.phone.trim()) {
        status = 'failed';
        failureCode = 'EMPTY_PHONE';
        failureReason = '수신 번호가 없습니다.';
      } else if (normalizedPhone.length < 9 || normalizedPhone.length > 11) {
        status = 'failed';
        failureCode = 'INVALID_PHONE_LENGTH';
        failureReason = '전화번호 길이가 올바르지 않습니다.';
      } else if (!request.body || !request.body.trim()) {
        status = 'failed';
        failureCode = 'EMPTY_BODY';
        failureReason = '메시지 본문이 비어 있습니다.';
      } else if (normalizedPhone === '01000000000') {
        status = 'failed';
        failureCode = 'MOCK_TEST_FAIL';
        failureReason = '테스트용 실패 번호입니다.';
      }

      const providerMessageId = 'mock_msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const timestamp = new Date().toISOString();

      return {
        recipientName: recipient.name,
        recipientPhoneMasked: maskedPhone,
        normalizedPhone: normalizedPhone,
        channel: channel,
        provider: 'mock_sms',
        providerMessageId: providerMessageId,
        status: status,
        failureCode: failureCode,
        failureReason: failureReason,
        createdAt: request.createdAt || timestamp,
        sentAt: status === 'sent' ? timestamp : null,
        failedAt: status === 'failed' ? timestamp : null,
        relatedTaskId: request.relatedTaskId || null,
        relatedDomainType: request.relatedDomainType || null,
        relatedDomainId: request.relatedDomainId || null
      };
    });

    return {
      provider: 'mock_sms',
      results
    };
  },

  buildOutboundDeliveries(request, providerResult) {
    if (!this.db.outboundMessageDeliveries) {
      this.db.outboundMessageDeliveries = [];
    }

    const existingDeliveries = this.db.outboundMessageDeliveries;
    const newDeliveries = [];

    (providerResult.results || []).forEach(res => {
      const bodyHash = computeBodyHash(request.body || '');
      const logOrRequestId = request.logId || request.id;
      const phoneHash = computePhoneHash(res.normalizedPhone);
      const idempotencyKey = generateIdempotencyKey(logOrRequestId, phoneHash, res.channel, bodyHash);

      const duplicate = existingDeliveries.find(d => d.idempotencyKey === idempotencyKey);
      if (duplicate) {
        newDeliveries.push(duplicate);
        return;
      }

      let retryable = false;
      let retryPolicyReason = 'UNKNOWN_ERROR';

      if (res.status === 'sent') {
        retryable = false;
        retryPolicyReason = 'SENT_NO_RETRY';
      } else if (res.status === 'failed') {
        if (res.failureCode === 'EMPTY_PHONE') {
          retryable = false;
          retryPolicyReason = 'HARD_FAILURE_EMPTY_PHONE';
        } else if (res.failureCode === 'INVALID_PHONE_LENGTH') {
          retryable = false;
          retryPolicyReason = 'HARD_FAILURE_INVALID_PHONE';
        } else if (res.failureCode === 'EMPTY_BODY') {
          retryable = false;
          retryPolicyReason = 'HARD_FAILURE_EMPTY_BODY';
        } else if (res.failureCode === 'MOCK_TEST_FAIL') {
          retryable = false;
          retryPolicyReason = 'HARD_FAILURE_TEST_FAIL';
        }
      }

      const id = 'del_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const del = {
        id,
        requestId: request.id,
        outboundMessageLogId: request.logId || null,
        recipientName: res.recipientName,
        recipientPhoneMasked: res.recipientPhoneMasked,
        normalizedPhone: res.normalizedPhone,
        channel: res.channel,
        provider: res.provider,
        providerMessageId: res.providerMessageId,
        status: res.status,
        failureCode: res.failureCode,
        failureReason: res.failureReason,
        createdAt: res.createdAt,
        sentAt: res.sentAt,
        failedAt: res.failedAt,
        relatedTaskId: res.relatedTaskId,
        relatedDomainType: res.relatedDomainType,
        relatedDomainId: res.relatedDomainId,
        
        // Expanded fields (16W-4)
        idempotencyKey,
        retryOfDeliveryId: null,
        retryAttempt: 0,
        retryable,
        retryPolicyReason,
        bodyHash
      };

      existingDeliveries.push(del);
      newDeliveries.push(del);
    });

    this.saveDB();
    this.notify('OUTBOUND_MESSAGE_DELIVERIES_CHANGED', this.db.outboundMessageDeliveries);
    return newDeliveries;
  },

  getOutboundDeliveryStatus(deliveryId) {
    const deliveries = this.getOutboundMessageDeliveries();
    const found = deliveries.find(d => d.id === deliveryId);
    return found ? found.status : null;
  }
};
