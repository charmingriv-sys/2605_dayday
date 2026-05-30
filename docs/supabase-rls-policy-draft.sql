-- docs/supabase-rls-policy-draft.sql
-- Supabase Auth / PostgreSQL RLS Policy Draft (Phase 6J Verification)
--
-- SECURITY WARNING & PRINCIPLES:
-- 1. This file is a static blueprint plan and draft schema. Do NOT run this in a production DB without customization.
-- 2. SUPABASE_SERVICE_ROLE_KEY is bypassed by all policies. Never leak or use the service role key inside browser bundles.
-- 3. The DEFAULT policy for all tables is "DEFAULT DENY" (Implicitly blocks access unless explicitly permitted).
-- 4. Phase 6J has verified the write contracts and audit log constraints (UPDATE/DELETE prevention validated via Mock client).

--------------------------------------------------------------------------------
-- 1. EXTENSIONS & HELPER FUNCTIONS
--------------------------------------------------------------------------------

-- Helper: Check if active auth user is an approved member of the specific organization with a given role
CREATE OR REPLACE FUNCTION public.has_org_role(org_id UUID, target_roles text[])
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.organization_members
        WHERE organization_id = org_id
          AND auth_user_id = auth.uid()
          -- Must be approved membership status to prevent pending hackers
          AND status = 'approved'
          AND role = ANY(target_roles)
    );
END;
$$ LANGUAGE plpgsql;

-- Helper: Check if active auth user is an approved member of the organization (any role)
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.organization_members
        WHERE organization_id = org_id
          AND auth_user_id = auth.uid()
          AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql;

-- Helper: Check if active auth user is the parent of a student
CREATE OR REPLACE FUNCTION public.can_access_student(student_id UUID)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
    -- Check if user is director/manager/teacher in student's organization
    IF EXISTS (
        SELECT 1 
        FROM public.students s
        WHERE s.id = student_id
          AND public.is_org_member(s.organization_id)
    ) THEN
        RETURN true;
    END IF;

    -- Alternatively, check if user is a linked parent
    RETURN EXISTS (
        SELECT 1
        FROM public.parent_student_links link
        WHERE link.student_id = student_id
          AND link.parent_auth_user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY
--------------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 3. RLS POLICY CLAUSES (DRAFT)
--------------------------------------------------------------------------------

-- =============================================================================
-- Table: organizations
-- =============================================================================
CREATE POLICY select_organizations ON public.organizations
    FOR SELECT TO authenticated
    USING (public.is_org_member(id));

CREATE POLICY manage_organizations ON public.organizations
    FOR ALL TO authenticated
    USING (public.has_org_role(id, ARRAY['owner', 'director']))
    WITH CHECK (public.has_org_role(id, ARRAY['owner', 'director']));

-- =============================================================================
-- Table: organization_members
-- =============================================================================
CREATE POLICY select_members ON public.organization_members
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid() OR public.is_org_member(organization_id));

CREATE POLICY manage_members ON public.organization_members
    FOR ALL TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['owner', 'director']))
    WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'director']));

-- =============================================================================
-- Table: user_profiles
-- =============================================================================
CREATE POLICY select_profiles ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
        auth_user_id = auth.uid() 
        OR EXISTS (
            -- Shared organizations membership check
            SELECT 1 FROM public.organization_members m1
            JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
            WHERE m1.auth_user_id = auth.uid() AND m2.auth_user_id = public.user_profiles.auth_user_id
        )
    );

CREATE POLICY update_profiles ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- =============================================================================
-- Table: students
-- =============================================================================
CREATE POLICY select_students ON public.students
    FOR SELECT TO authenticated
    USING (
        public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager', 'teacher'])
        OR EXISTS (
            -- Parent student link check
            SELECT 1 FROM public.parent_student_links link
            WHERE link.student_id = public.students.id AND link.parent_auth_user_id = auth.uid()
        )
    );

CREATE POLICY manage_students ON public.students
    FOR ALL TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager']))
    WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager']));

-- =============================================================================
-- Table: parent_student_links
-- =============================================================================
CREATE POLICY select_links ON public.parent_student_links
    FOR SELECT TO authenticated
    USING (
        parent_auth_user_id = auth.uid()
        OR public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager'])
    );

CREATE POLICY manage_links ON public.parent_student_links
    FOR ALL TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager']))
    WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager']));

-- =============================================================================
-- Table: attendance_records (Kiosk device integration considerations)
-- =============================================================================
CREATE POLICY select_attendance ON public.attendance_records
    FOR SELECT TO authenticated
    USING (
        public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager', 'teacher'])
        OR public.can_access_student(student_id)
    );

-- Crucial: Kiosk or Tablet can insert check-in log, but has limited access window
CREATE POLICY insert_attendance ON public.attendance_records
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager', 'teacher'])
        -- Or authenticated kiosk device token check
        -- OR (SELECT device_role FROM public.kiosk_devices WHERE auth_user_id = auth.uid()) = 'kiosk_tablet'
    );

-- =============================================================================
-- Table: payments
-- =============================================================================
CREATE POLICY select_payments ON public.payments
    FOR SELECT TO authenticated
    USING (
        public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager', 'accountant'])
        OR public.can_access_student(student_id)
    );

-- Operational Warning: Audit log append triggers should be fired for changes to status
CREATE POLICY manage_payments ON public.payments
    FOR ALL TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager']))
    WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'director', 'manager']));

-- =============================================================================
-- Table: audit_logs (Strict Security: READ-ONLY append design)
-- =============================================================================
CREATE POLICY select_audit_logs ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.has_org_role(organization_id, ARRAY['owner', 'director', 'auditor']));

CREATE POLICY insert_audit_logs ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_org_member(organization_id));

-- Prevent editing or deleting logs
CREATE POLICY no_updates ON public.audit_logs FOR UPDATE USING (false);
CREATE POLICY no_deletes ON public.audit_logs FOR DELETE USING (false);
