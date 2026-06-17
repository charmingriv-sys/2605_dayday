// tests/unit/outbound_provider_test.mjs - Verify SMS Mock Provider and Outbound Delivery API
import assert from 'assert';

// Mock global window and localStorage for node environment
global.localStorage = {
  getItem: (key) => null,
  setItem: (key, val) => {}
};
global.window = {
  dispatchEvent: () => {},
  localStorage: global.localStorage
};

console.log('--- Mocking environment completed ---');

// Dynamically import stateStore
const { stateStore } = await import('../../src/js/state.js');

console.log('--- Starting Outbound Provider Mock Gateway API Verification ---');

try {
  // Clear collections for isolation
  stateStore.db.outboundMessageDeliveries = [];
  stateStore.db.outboundMessageLogs = [];

  // 1. Verify Default Collection Initialization
  console.log('1. Verifying default collection state...');
  const initialDeliveries = stateStore.getOutboundMessageDeliveries();
  assert.ok(Array.isArray(initialDeliveries), 'Deliveries should initialize as an array');
  assert.strictEqual(initialDeliveries.length, 0, 'Deliveries should start empty');

  // 2. Verify createOutboundRequest
  console.log('2. Verifying request builder mapping...');
  const input = {
    method: 'SMS',
    senderNumber: '02-1234-5678',
    title: '테스트 제목',
    body: '테스트 본문 내용 #{이름}',
    recipients: [
      { name: '최다은', phone: '010-9999-1111', no: 'S1', role: '보호자1' },
      { name: '홍길동', phone: '010-0000-0000', no: 'S2', role: '보호자2' },
      { name: '번호없음', phone: '', no: 'S3', role: '본인' },
      { name: '잘못된번호', phone: '123', no: 'S4', role: '직접입력' }
    ],
    relatedTaskId: 'task_123',
    relatedDomainType: 'task',
    relatedDomainId: 'task_123'
  };

  const request = stateStore.createOutboundRequest(input);
  assert.ok(request.id.startsWith('req_'), 'Request should have ID starting with req_');
  assert.strictEqual(request.method, 'SMS');
  assert.strictEqual(request.recipients.length, 4);
  assert.strictEqual(request.recipients[0].name, '최다은');
  assert.strictEqual(request.recipients[0].studentId, 'S1');
  assert.strictEqual(request.relatedTaskId, 'task_123');

  // 3. Verify sendSmsViaMockProvider success & failure logic
  console.log('3. Verifying mock provider routing & failure states...');
  const providerResult = stateStore.sendSmsViaMockProvider(request);
  assert.strictEqual(providerResult.provider, 'mock_sms');
  assert.strictEqual(providerResult.results.length, 4);

  // [Recipient 0]: Valid phone, valid body -> sent
  const res0 = providerResult.results[0];
  assert.strictEqual(res0.status, 'sent');
  assert.strictEqual(res0.normalizedPhone, '01099991111');
  assert.strictEqual(res0.recipientPhoneMasked, '010-****-1111');
  assert.strictEqual(res0.failureCode, null);
  assert.ok(res0.sentAt, 'Should have sentAt timestamp');
  assert.strictEqual(res0.failedAt, null);

  // [Recipient 1]: Test fail number "010-0000-0000" -> failed, MOCK_TEST_FAIL
  const res1 = providerResult.results[1];
  assert.strictEqual(res1.status, 'failed');
  assert.strictEqual(res1.failureCode, 'MOCK_TEST_FAIL');
  assert.ok(res1.failedAt, 'Should have failedAt timestamp');
  assert.strictEqual(res1.sentAt, null);

  // [Recipient 2]: Empty phone -> failed, EMPTY_PHONE
  const res2 = providerResult.results[2];
  assert.strictEqual(res2.status, 'failed');
  assert.strictEqual(res2.failureCode, 'EMPTY_PHONE');

  // [Recipient 3]: Invalid phone length -> failed, INVALID_PHONE_LENGTH
  const res3 = providerResult.results[3];
  assert.strictEqual(res3.status, 'failed');
  assert.strictEqual(res3.failureCode, 'INVALID_PHONE_LENGTH');

  // Test Empty Body condition
  console.log('3.1. Verifying empty body validation...');
  const emptyBodyRequest = stateStore.createOutboundRequest({
    ...input,
    body: ''
  });
  const emptyBodyResult = stateStore.sendSmsViaMockProvider(emptyBodyRequest);
  assert.strictEqual(emptyBodyResult.results[0].status, 'failed');
  assert.strictEqual(emptyBodyResult.results[0].failureCode, 'EMPTY_BODY');

  // 4. Verify buildOutboundDeliveries & Database saving
  console.log('4. Verifying building and saving delivery records...');
  request.logId = 'msglog_test123';
  const newDeliveries = stateStore.buildOutboundDeliveries(request, providerResult);
  assert.strictEqual(newDeliveries.length, 4);
  assert.ok(newDeliveries[0].id.startsWith('del_'), 'Delivery should have ID starting with del_');
  assert.strictEqual(newDeliveries[0].requestId, request.id);
  assert.strictEqual(newDeliveries[0].outboundMessageLogId, 'msglog_test123');
  assert.strictEqual(newDeliveries[0].recipientName, '최다은');
  assert.strictEqual(newDeliveries[0].recipientPhoneMasked, '010-****-1111');
  assert.strictEqual(newDeliveries[0].normalizedPhone, '01099991111');
  assert.strictEqual(newDeliveries[0].status, 'sent');
  assert.strictEqual(newDeliveries[1].status, 'failed');

  // Check state store save
  const savedDeliveries = stateStore.getOutboundMessageDeliveries();
  assert.strictEqual(savedDeliveries.length, 4);
  assert.strictEqual(savedDeliveries[0].id, newDeliveries[0].id);

  // 5. Verify getOutboundDeliveryStatus lookup
  console.log('5. Verifying lookup of delivery status...');
  const status0 = stateStore.getOutboundDeliveryStatus(newDeliveries[0].id);
  assert.strictEqual(status0, 'sent');
  const status1 = stateStore.getOutboundDeliveryStatus(newDeliveries[1].id);
  assert.strictEqual(status1, 'failed');
  const nonExistentStatus = stateStore.getOutboundDeliveryStatus('del_nonexistent');
  assert.strictEqual(nonExistentStatus, null);

  console.log('✓ All Outbound Provider Unit Tests passed successfully.');
} catch (error) {
  console.error('❌ Assertion failed:', error);
  process.exit(1);
}
