/**
 * supabaseClientFactory.js
 * 
 * Safely creates a Supabase client.
 * Provides a client dynamically ONLY if both SUPABASE_URL and SUPABASE_ANON_KEY are configured.
 * 
 * SECURITY WARNING:
 * 1. SUPABASE_SERVICE_ROLE_KEY is strictly disallowed.
 * 2. If any token matching service_role is detected, the initialization is aborted immediately.
 */

export class SupabaseClientFactory {
    /**
     * Safely constructs a Supabase client using configuration.
     * Since this is a pure ESM project without build-time bundler plugins by default,
     * we expect configuration to be loaded via a runtime config object/script or a secure dynamic loader.
     * 
     * @param {Object} config
     * @param {string} config.supabaseUrl
     * @param {string} config.supabaseAnonKey
     * @param {string} [config.serviceRoleKey] - Disallowed, used strictly for validation warning
     * @param {Function} [createClientFn] - Injectable SDK client creation factory (e.g. from CDN or SDK import)
     * @returns {Object|null} Configured Supabase client or null/disabled descriptor
     */
    static createOptionalClient({ supabaseUrl, supabaseAnonKey, serviceRoleKey } = {}, createClientFn = null) {
        // Strict runtime guard against service_role leakages
        if (serviceRoleKey || this._detectServiceRolePattern(supabaseAnonKey) || this._detectServiceRolePattern(supabaseUrl)) {
            console.error('CRITICAL SECURITY ERROR: Supabase service_role key detected in client-side bundle initializer!');
            throw new Error('Initialization aborted due to security violation: service_role key must never be loaded in the browser.');
        }

        if (!supabaseUrl || !supabaseAnonKey) {
            // Disabled descriptor to prevent runtime exceptions
            return null;
        }

        if (typeof createClientFn !== 'function') {
            // No direct require/import of @supabase/supabase-js to keep decoupled ESM baseline
            console.warn('Supabase Client Factory: client initialization deferred. SDK creator function is missing.');
            return null;
        }

        try {
            return createClientFn(supabaseUrl, supabaseAnonKey);
        } catch (e) {
            console.error('Failed to initialize Supabase client instance:', e);
            return null;
        }
    }

    /**
     * Scan candidate keys for service_role indicators.
     */
    static _detectServiceRolePattern(val) {
        if (!val || typeof val !== 'string') return false;
        const lowerVal = val.toLowerCase();
        return lowerVal.includes('service_role') || lowerVal.includes('service-role') || lowerVal.includes('supabase_service_role');
    }
}
