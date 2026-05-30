// scratch/supabase_adapter_mock_test.mjs
// Verification of read-only adapter query mappings using Mock client interface

import { SupabaseAdapter } from '../../src/js/state/adapters/supabaseAdapter.js';
import { SupabaseClientFactory } from '../../src/js/state/adapters/supabaseClientFactory.js';

console.log('--- Starting SupabaseAdapter Mock Client Integration Test ---');

// 1. Mock DB Data Set
const MOCK_DB = {
    organizations: [
        { id: 'AC1', name: '튜링 음악학원', phone: '02-1234-5678', post_code: '06543' }
    ],
    students: [
        { id: 'S1', name: '최다은', organization_id: 'AC1', enroll_date: '2026-01-10', payment_status: 'unpaid' },
        { id: 'S2', name: '김제나', organization_id: 'AC1', enroll_date: '2026-02-12', payment_status: 'paid' }
    ],
    teachers: [
        { id: 'T1', name: '문승현', organization_id: 'AC1', color_code: '#ffb3c1' }
    ],
    payments: [
        { id: 'P1', student_id: 'S1', amount: 150000, month: '2026-05', status: 'unpaid', organization_id: 'AC1' }
    ]
};

// 2. Mock Builder class to replicate Supabase Query Chain (.from().select().eq())
class MockQueryBuilder {
    constructor(tableName, shouldFail = false) {
        this.tableName = tableName;
        this.shouldFail = shouldFail;
        this.filters = [];
        this.isSingle = false;
    }

    select() {
        return this;
    }

    eq(field, value) {
        this.filters.push({ field, value });
        return this;
    }

    single() {
        this.isSingle = true;
        return this;
    }

    // Resolves mock promise results
    then(onfulfilled) {
        if (this.shouldFail) {
            return Promise.resolve(onfulfilled({ data: null, error: new Error(`Mock Database Error for ${this.tableName}`) }));
        }

        let results = MOCK_DB[this.tableName] || [];
        
        // Apply filter mappings
        for (const filter of this.filters) {
            results = results.filter(row => row[filter.field] === filter.value);
        }

        if (this.isSingle) {
            return Promise.resolve(onfulfilled({ data: results[0] || null, error: null }));
        }
        return Promise.resolve(onfulfilled({ data: results, error: null }));
    }
}

// 3. Mock Client Factory
const createMockClient = (shouldFail = false) => {
    const client = {
        lastUpsert: null,
        lastInsert: null,
        from: (table) => {
            const builder = new MockQueryBuilder(table, shouldFail);
            // Inject spy bindings referencing the client state
            builder.upsert = (data) => {
                client.lastUpsert = { table, data };
                return Promise.resolve({ data, error: shouldFail ? new Error(`Mock Write Error for ${table}`) : null });
            };
            builder.insert = (data) => {
                client.lastInsert = { table, data };
                return Promise.resolve({ data, error: shouldFail ? new Error(`Mock Write Error for ${table}`) : null });
            };
            return builder;
        }
    };
    return client;
};

let hasError = false;

// 4. Test Execution
async function runTests() {
    try {
        // --- 4.1 Client Factory Security Guard Tests ---
        console.log('\n[Factory Verification]');
        
        // Safe null configuration fallback check
        const disabledClient = SupabaseClientFactory.createOptionalClient({ supabaseUrl: null, supabaseAnonKey: null });
        if (disabledClient === null) {
            console.log('✓ Factory safely returns null for missing configuration.');
        } else {
            console.error('❌ Factory should return null when configuration is empty.');
            hasError = true;
        }

        // Security violation intercept check
        const originalConsoleError = console.error;
        try {
            // Silence console.error for expected security violation test
            console.error = () => {};
            
            SupabaseClientFactory.createOptionalClient({
                supabaseUrl: 'https://test-instance.supabase.co',
                supabaseAnonKey: 'some-key-with-service_role-inside'
            });
            
            console.error = originalConsoleError;
            console.error('❌ Security intercept failed! Client was initialized with service_role signature.');
            hasError = true;
        } catch (err) {
            console.error = originalConsoleError;
            console.log('✓ Factory correctly threw exception upon detecting service_role signature:', err.message);
        }

        // --- 4.2 Adapter Query Mapping Tests ---
        console.log('\n[Adapter Operations Verification]');
        const mockClient = createMockClient(false);
        const adapter = new SupabaseAdapter({ client: mockClient, organizationId: 'AC1' });

        // Health check status
        const status = await adapter.healthCheck();
        if (status.status === 'configured') {
            console.log('✓ Adapter HealthCheck reported: ok / configured.');
        } else {
            console.error('❌ Unexpected healthCheck status:', status);
            hasError = true;
        }

        // fetchAcademy verification
        const academy = await adapter.fetchAcademy();
        if (academy && academy.name === '튜링 음악학원' && academy.postCode === '06543' && academy.academyId === 'AC1') {
            console.log('✓ fetchAcademy mapping success (snake_case -> camelCase & id -> academyId alias conversion verified).');
        } else {
            console.error('❌ fetchAcademy mapping mismatch:', academy);
            hasError = true;
        }

        // fetchStudents verification
        const students = await adapter.fetchStudents();
        if (students.length === 2 && students[0].enrollDate === '2026-01-10' && students[1].paymentStatus === 'paid') {
            console.log('✓ fetchStudents array mapping verified.');
        } else {
            console.error('❌ fetchStudents mapping mismatch:', students);
            hasError = true;
        }

        // fetchAllDomainData aggregation check
        const snapshot = await adapter.fetchAllDomainData();
        if (snapshot.academies.length === 1 && snapshot.students.length === 2 && snapshot.teachers.length === 1 && snapshot.payments.length === 1) {
            console.log('✓ fetchAllDomainData parallel mapping successfully aggregated to snapshot format.');
        } else {
            console.error('❌ snapshot aggregation mismatch:', snapshot);
            hasError = true;
        }

        // --- 4.3 Adapter Error Handling Verification ---
        console.log('\n[Adapter Error Validation]');
        const failingClient = createMockClient(true);
        const failingAdapter = new SupabaseAdapter({ client: failingClient, organizationId: 'AC1' });

        try {
            await failingAdapter.fetchStudents();
            console.error('❌ Error handling failed: Query did not propagate database failure.');
            hasError = true;
        } catch (err) {
            console.log('✓ Adapter correctly propagated mock database exception:', err.message);
        }

        // fetchAllDomainData error recovery validation
        const emptySnapshot = await failingAdapter.fetchAllDomainData();
        if (emptySnapshot.academies.length === 0 && emptySnapshot.students.length === 0) {
            console.log('✓ fetchAllDomainData safely recovered from failures, supplying clean empty fallbacks.');
        } else {
            console.error('❌ Error recovery mapping mismatch:', emptySnapshot);
            hasError = true;
        }

        // --- 4.4 Adapter Write Contract Verification (Phase 6J) ---
        console.log('\n[Adapter Write Operations Verification]');
        const writeContext = { organizationId: 'AC1', authUserId: 'USR_DIR_DEMO', role: 'director' };

        // Test saveStudent (upsert)
        const newStudent = { id: 'S99', name: '테스트학생', enrollDate: '2026-05-30' };
        await adapter.saveStudent(newStudent, writeContext);
        const lastUpsert = mockClient.lastUpsert;
        if (lastUpsert && lastUpsert.table === 'students' && lastUpsert.data.name === '테스트학생' && lastUpsert.data.organization_id === 'AC1' && lastUpsert.data.enroll_date === '2026-05-30') {
            console.log('✓ saveStudent mapping and upsert execution verified (camelCase to snake_case confirmed).');
        } else {
            console.error('❌ saveStudent verification failed:', lastUpsert);
            hasError = true;
        }

        // Test saveTeacher (upsert)
        const newTeacher = { id: 'T99', name: '테스트강사', colorCode: '#ffffff' };
        await adapter.saveTeacher(newTeacher, writeContext);
        if (mockClient.lastUpsert && mockClient.lastUpsert.table === 'teachers' && mockClient.lastUpsert.data.color_code === '#ffffff') {
            console.log('✓ saveTeacher mapping and upsert execution verified.');
        } else {
            console.error('❌ saveTeacher verification failed:', mockClient.lastUpsert);
            hasError = true;
        }

        // Test savePaymentRecord & auto Audit Log trigger
        mockClient.lastInsert = null;
        const newPayment = { id: 'P99', studentId: 'S1', amount: 120000, status: 'paid' };
        await adapter.savePaymentRecord(newPayment, writeContext);
        if (mockClient.lastUpsert && mockClient.lastUpsert.table === 'payments' && mockClient.lastUpsert.data.student_id === 'S1') {
            console.log('✓ savePaymentRecord query mapping and upsert verified.');
        } else {
            console.error('❌ savePaymentRecord verification failed:', mockClient.lastUpsert);
            hasError = true;
        }

        // Verify the payment audit log insert
        const lastInsert = mockClient.lastInsert;
        if (lastInsert && lastInsert.table === 'audit_logs' && lastInsert.data.action === 'payment_record_upsert' && lastInsert.data.actor_user_id === 'USR_DIR_DEMO') {
            console.log('✓ Audit log insertion automatically triggered and verified for payment updates.');
        } else {
            console.error('❌ Audit log validation for payment updates failed:', lastInsert);
            hasError = true;
        }

        // Test saveAttendanceRecord & auto Audit Log trigger
        await adapter.saveAttendanceRecord({ id: 'A99', studentId: 'S1', status: 'present' }, writeContext);
        if (mockClient.lastInsert && mockClient.lastInsert.table === 'audit_logs' && mockClient.lastInsert.data.action === 'attendance_record_upsert') {
            console.log('✓ saveAttendanceRecord and corresponding audit log verified.');
        } else {
            console.error('❌ saveAttendanceRecord verification failed.');
            hasError = true;
        }

        // Test missing organizationId guard
        try {
            await adapter.saveStudent(newStudent, { authUserId: 'USR_DIR_DEMO', role: 'director' });
            console.error('❌ Context validation failed: write query did not throw on missing organizationId.');
            hasError = true;
        } catch (err) {
            console.log('✓ Adapter resolveOrganizationId check successfully blocked write with missing tenant:', err.message);
        }

        // Test missing authUserId guard
        try {
            await adapter.saveStudent(newStudent, { organizationId: 'AC1', role: 'director' });
            console.error('❌ Context validation failed: write query did not throw on missing authUserId.');
            hasError = true;
        } catch (err) {
            console.log('✓ Adapter writeContext check successfully blocked write with missing authUserId:', err.message);
        }

    } catch (e) {
        console.error('Test framework encountered unexpected exception:', e);
        hasError = true;
    }

    if (hasError) {
        console.log('\n❌ Mock client mapping verification FAILED.');
        process.exit(1);
    } else {
        console.log('\n✓ All Mock client mapping verification tests PASSED successfully.');
        process.exit(0);
    }
}

runTests();
