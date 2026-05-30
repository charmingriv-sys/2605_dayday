/**
 * src/js/state/adapters/dataAdapter.js
 * 
 * DataAdapter Interface (Base Class)
 * Phase 6B.5 Refined Design Draft
 * 
 * Defines the standard API contract for retrieving and saving DayDay data.
 * Both LocalStorageAdapter and SupabaseAdapter will extend this class.
 * 
 * Context Object Specification:
 * The `context` parameter passed to methods should contain:
 * {
 *   organizationId: string (UUID, canonical DB tenant key),
 *   academyId: string (backward-compatibility alias for UI mappings),
 *   authUserId: string (identifier of the executing user),
 *   role: string (role of the user: 'director', 'teacher', etc.),
 *   mode: string ('local' or 'remote')
 * }
 * 
 * Multi-Tenant Key Mapping:
 * - organizationId is the canonical tenant key for DB adapters.
 * - academyId is kept as a UI/backward-compatibility alias during migration.
 */
export class DataAdapter {
    constructor() {
        if (this.constructor === DataAdapter) {
            throw new Error("DataAdapter is an abstract class and cannot be instantiated directly.");
        }
    }

    // =========================================================================
    // 1. Core Lifecycle & Synchronization (Required for Phase 6C)
    // =========================================================================
    /**
     * Initializes the adapter (e.g., establishing DB connections, loading local state).
     * @param {object} context - Execution context.
     * @returns {Promise<void>}
     */
    async initialize(context) {
        throw new Error("DataAdapter.initialize() must be implemented by a concrete adapter.");
    }

    /**
     * Loads the entire database snapshot for memory injection.
     * Critical for backward-compatibility with current synchronous get methods.
     * @param {object} context - Execution context.
     * @returns {Promise<object>} Entire database tree structure.
     */
    async loadSnapshot(context) {
        throw new Error("DataAdapter.loadSnapshot() must be implemented by a concrete adapter.");
    }

    /**
     * Saves the entire database snapshot (like saveDB for localStorage).
     * Used for full-state synchronization.
     * @param {object} snapshot - Entire DB tree snapshot.
     * @param {object} context - Execution context.
     * @returns {Promise<void>}
     */
    async saveSnapshot(snapshot, context) {
        throw new Error("DataAdapter.saveSnapshot() must be implemented by a concrete adapter.");
    }

    /**
     * Fetches all domain data at once to populate the memory cache.
     * @param {object} context - Execution context.
     * @returns {Promise<object>} Map of all domain collections (students, teachers, etc.)
     */
    async fetchAllDomainData(context) {
        throw new Error("DataAdapter.fetchAllDomainData() must be implemented by a concrete adapter.");
    }

    /**
     * Persists a specific domain dataset (e.g., only 'students' or 'attendance').
     * Used for database write optimization instead of full snapshots.
     * @param {string} domainName - The name of the domain database table/collection.
     * @param {any} domainData - The dataset to save.
     * @param {object} context - Execution context.
     * @returns {Promise<void>}
     */
    async persistDomain(domainName, domainData, context) {
        throw new Error("DataAdapter.persistDomain() must be implemented by a concrete adapter.");
    }

    /**
     * Writes audit logging events.
     * Operational Warning: Must be enforced in production for administrative compliance and RLS tracking.
     * @param {object} context - Execution context.
     * @param {object} logData - Log action details.
     * @returns {Promise<void>}
     */
    async writeAuditLog(context, logData) {
        throw new Error("DataAdapter.writeAuditLog() must be implemented by a concrete adapter.");
    }

    // =========================================================================
    // 2. Optional Fine-Grained Domain Methods
    // Note: Phase 6C does not need to implement every method immediately.
    // These are placeholders for selective remote sync (e.g., SupabaseAdapter).
    // =========================================================================

    // --- Organization / Tenant ---
    async fetchAcademy(academyId) {
        throw new Error("DataAdapter.fetchAcademy() optional method is not implemented.");
    }
    
    /**
     * Operational Warning: Modifying password configurations requires elevated RLS check and security logging.
     */
    async saveAcademy(academyId, academyData) {
        throw new Error("DataAdapter.saveAcademy() optional method is not implemented.");
    }
    
    async fetchAcademyInviteCode(academyId) {
        throw new Error("DataAdapter.fetchAcademyInviteCode() optional method is not implemented.");
    }
    
    async saveAcademyInviteCode(academyId, inviteCodeData) {
        throw new Error("DataAdapter.saveAcademyInviteCode() optional method is not implemented.");
    }
    
    async fetchAcademyJoinRequests(academyId) {
        throw new Error("DataAdapter.fetchAcademyJoinRequests() optional method is not implemented.");
    }
    
    async saveAcademyJoinRequest(academyId, requestData) {
        throw new Error("DataAdapter.saveAcademyJoinRequest() optional method is not implemented.");
    }

    // --- User / Profile ---
    async fetchUsers(academyId) {
        throw new Error("DataAdapter.fetchUsers() optional method is not implemented.");
    }
    
    async saveUser(userData) {
        throw new Error("DataAdapter.saveUser() optional method is not implemented.");
    }
    
    /**
     * Operational Warning: Deleting accounts must perform data anonymization and trigger downstream cascade.
     */
    async deleteUser(userId) {
        throw new Error("DataAdapter.deleteUser() optional method is not implemented.");
    }

    // --- Students & Parents ---
    async fetchStudents(academyId) {
        throw new Error("DataAdapter.fetchStudents() optional method is not implemented.");
    }
    
    async saveStudent(academyId, studentData) {
        throw new Error("DataAdapter.saveStudent() optional method is not implemented.");
    }
    
    async fetchParentStudentLinks(academyId) {
        throw new Error("DataAdapter.fetchParentStudentLinks() optional method is not implemented.");
    }
    
    async saveParentStudentLink(parentUserId, studentId) {
        throw new Error("DataAdapter.saveParentStudentLink() optional method is not implemented.");
    }

    // --- Teachers & Shifts ---
    async fetchTeachers(academyId) {
        throw new Error("DataAdapter.fetchTeachers() optional method is not implemented.");
    }
    
    async saveTeacher(academyId, teacherData) {
        throw new Error("DataAdapter.saveTeacher() optional method is not implemented.");
    }
    
    async fetchTeacherShifts(academyId) {
        throw new Error("DataAdapter.fetchTeacherShifts() optional method is not implemented.");
    }
    
    async saveTeacherShift(academyId, shiftData) {
        throw new Error("DataAdapter.saveTeacherShift() optional method is not implemented.");
    }

    // --- Classes & Sessions ---
    async fetchClasses(academyId) {
        throw new Error("DataAdapter.fetchClasses() optional method is not implemented.");
    }
    
    async saveClass(classData) {
        throw new Error("DataAdapter.saveClass() optional method is not implemented.");
    }
    
    async deleteClass(classId) {
        throw new Error("DataAdapter.deleteClass() optional method is not implemented.");
    }

    // --- Attendance ---
    async fetchAttendance(academyId) {
        throw new Error("DataAdapter.fetchAttendance() optional method is not implemented.");
    }
    
    async saveAttendanceRecord(academyId, recordData) {
        throw new Error("DataAdapter.saveAttendanceRecord() optional method is not implemented.");
    }

    // --- Billing & Catalog ---
    async fetchPayments(academyId) {
        throw new Error("DataAdapter.fetchPayments() optional method is not implemented.");
    }
    
    /**
     * Operational Warning: Changing financial transactions requires audit trailing and verified director/manager context.
     */
    async savePaymentRecord(academyId, paymentData) {
        throw new Error("DataAdapter.savePaymentRecord() optional method is not implemented.");
    }
    
    async fetchSubjects(academyId) {
        throw new Error("DataAdapter.fetchSubjects() optional method is not implemented.");
    }
    
    async saveSubject(academyId, subjectData) {
        throw new Error("DataAdapter.saveSubject() optional method is not implemented.");
    }
    
    async fetchBooks(academyId) {
        throw new Error("DataAdapter.fetchBooks() optional method is not implemented.");
    }
    
    async saveBook(academyId, bookData) {
        throw new Error("DataAdapter.saveBook() optional method is not implemented.");
    }
    
    async fetchStudentBooks(academyId) {
        throw new Error("DataAdapter.fetchStudentBooks() optional method is not implemented.");
    }
    
    async saveStudentBook(academyId, studentBookData) {
        throw new Error("DataAdapter.saveStudentBook() optional method is not implemented.");
    }

    // --- Communication ---
    async fetchAnnouncements(academyId) {
        throw new Error("DataAdapter.fetchAnnouncements() optional method is not implemented.");
    }
    
    async saveAnnouncement(academyId, announcementData) {
        throw new Error("DataAdapter.saveAnnouncement() optional method is not implemented.");
    }
    
    async fetchMessages(academyId) {
        throw new Error("DataAdapter.fetchMessages() optional method is not implemented.");
    }
    
    async saveMessage(academyId, messageData) {
        throw new Error("DataAdapter.saveMessage() optional method is not implemented.");
    }
    
    async fetchSurveys(academyId) {
        throw new Error("DataAdapter.fetchSurveys() optional method is not implemented.");
    }
    
    async saveSurvey(academyId, surveyData) {
        throw new Error("DataAdapter.saveSurvey() optional method is not implemented.");
    }
    
    async fetchSurveyResponses(academyId) {
        throw new Error("DataAdapter.fetchSurveyResponses() optional method is not implemented.");
    }
    
    async saveSurveyResponse(academyId, responseData) {
        throw new Error("DataAdapter.saveSurveyResponse() optional method is not implemented.");
    }

    // --- Settings & Metadata ---
    async fetchSettings(academyId) {
        throw new Error("DataAdapter.fetchSettings() optional method is not implemented.");
    }
    
    async saveSettings(academyId, settingsData) {
        throw new Error("DataAdapter.saveSettings() optional method is not implemented.");
    }
}
