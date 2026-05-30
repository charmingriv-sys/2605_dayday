import { DataAdapter } from './dataAdapter.js';

/**
 * SupabaseAdapter skeleton for remote repository transitions.
 * 
 * DESIGN PRINCIPLES & SECURITY WARNINGS:
 * 1. Do NOT import or instantiate createClient here. The SDK client should be injected dynamically.
 * 2. NEVER import or reference the service_role key within client-side code.
 *    Any administrative actions must be processed via secure serverless Edge Functions.
 * 3. Row-Level Security (RLS) policies on Supabase must be fully configured before moving from Local to Supabase mode.
 */
export class SupabaseAdapter extends DataAdapter {
    constructor({ client = null, organizationId = null } = {}) {
        super();
        this.client = client;
        this.organizationId = organizationId;
    }

    async initialize(context = {}) {
        if (!this.isConfigured()) {
            throw new Error(
                'SupabaseAdapter requires a Supabase client. Do not instantiate it without configured environment.'
            );
        }
    }

    /**
     * Check if adapter is properly configured with a client instance.
     */
    isConfigured() {
        return this.client !== null;
    }

    /**
     * Optional healthCheck capability.
     */
    async healthCheck() {
        if (!this.isConfigured()) {
            return { status: 'disabled', message: 'Client configuration missing.' };
        }
        return { status: 'configured', message: 'Supabase client instance bound successfully.' };
    }

    async loadSnapshot(context = {}) {
        throw new Error('SupabaseAdapter.loadSnapshot() is not implemented yet.');
    }

    async saveSnapshot(snapshot, context = {}) {
        throw new Error('SupabaseAdapter.saveSnapshot() is intentionally unsupported for full snapshot writes.');
    }

    async persistDomain(domainName, domainData, context = {}) {
        throw new Error('SupabaseAdapter.persistDomain() is not implemented yet.');
    }

    async writeAuditLog(context = {}, logData = {}) {
        throw new Error('SupabaseAdapter.writeAuditLog() is not implemented yet.');
    }

    // --- Read-Only Domain Query Implementations ---

    async fetchAcademy(context = {}) {
        const client = this.requireClient();
        const orgId = this.resolveOrganizationId(context);
        const { data, error } = await client
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (error) throw error;
        return this.mapOrganizationToAcademy(data);
    }

    async fetchStudents(context = {}) {
        const client = this.requireClient();
        const orgId = this.resolveOrganizationId(context);
        const { data, error } = await client
            .from('students')
            .select('*')
            .eq('organization_id', orgId);

        if (error) throw error;
        return data.map(item => this.mapSnakeToCamel(item));
    }

    async fetchTeachers(context = {}) {
        const client = this.requireClient();
        const orgId = this.resolveOrganizationId(context);
        const { data, error } = await client
            .from('teachers')
            .select('*')
            .eq('organization_id', orgId);

        if (error) throw error;
        return data.map(item => this.mapSnakeToCamel(item));
    }

    async fetchPayments(context = {}) {
        const client = this.requireClient();
        const orgId = this.resolveOrganizationId(context);
        const { data, error } = await client
            .from('payments')
            .select('*')
            .eq('organization_id', orgId);

        if (error) throw error;
        return data.map(item => this.mapSnakeToCamel(item));
    }

    async fetchAllDomainData(context = {}) {
        // Parallel aggregation of read-only domains
        const [academy, students, teachers, payments] = await Promise.all([
            this.fetchAcademy(context).catch(() => null),
            this.fetchStudents(context).catch(() => []),
            this.fetchTeachers(context).catch(() => []),
            this.fetchPayments(context).catch(() => [])
        ]);

        return {
            academies: academy ? [academy] : [],
            students,
            teachers,
            payments
        };
    }

    // --- Helper Candidates (Map database structures to StateStore schema) ---
    
    /**
     * Map Supabase organization row to StateStore academy format.
     */
    mapOrganizationToAcademy(row) {
        if (!row) return null;
        const camelObj = this.mapSnakeToCamel(row);
        // Map organizationId to academyId as UI alias
        camelObj.academyId = camelObj.id;
        return camelObj;
    }

    /**
     * Map StateStore academy structure to Supabase organization row.
     */
    mapAcademyToOrganization(academy) {
        if (!academy) return null;
        const snakeObj = this.mapCamelToSnake(academy);
        if (academy.academyId) {
            snakeObj.id = academy.academyId;
        }
        return snakeObj;
    }

    /**
     * Convert database snake_case row columns to camelCase object fields.
     */
    mapSnakeToCamel(row) {
        if (!row) return null;
        const obj = {};
        for (const key of Object.keys(row)) {
            const camelKey = key.replace(/_([a-z0-9])/g, g => g[1].toUpperCase());
            obj[camelKey] = row[key];
        }
        // Handle alias mapping for organizationId to academyId
        if (obj.organizationId) {
            obj.academyId = obj.organizationId;
        }
        return obj;
    }

    /**
     * Convert camelCase object fields to database snake_case columns.
     */
    mapCamelToSnake(object) {
        if (!object) return null;
        const obj = {};
        for (const key of Object.keys(object)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            obj[snakeKey] = object[key];
        }
        // Ensure organization_id is set if academyId is present
        if (object.academyId && !obj.organization_id) {
            obj.organization_id = object.academyId;
        }
        return obj;
    }

    /**
     * Ensure client is present before operations.
     */
    requireClient() {
        if (!this.client) {
            throw new Error('Supabase client is not initialized.');
        }
        return this.client;
    }

    resolveOrganizationId(context) {
        const orgId = context.organizationId || this.organizationId;
        if (!orgId) {
            throw new Error('SupabaseAdapter Error: organizationId / academyId cannot be resolved from context or configuration.');
        }
        return orgId;
    }
}
