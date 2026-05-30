-- DayDay Supabase/PostgreSQL Schema Draft
-- Phase 6A
-- This file is a draft and must be reviewed before applying to production.

-- =========================================================================
-- 1. Extensions
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 2. Common helper functions
-- =========================================================================
-- Automatically update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- 3. Core tenant tables
-- =========================================================================
-- Multi-vertical expansion strategy: DB level uses 'organizations' for compatibility.
-- UI can map 'organizations' to 'academy' (music academy vertical).
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    business_registration_number TEXT,
    owner_name TEXT,
    postcode TEXT,
    address TEXT,
    detail_address TEXT,
    invite_code TEXT UNIQUE,
    -- Security note: PIN values must not be stored in plaintext in production.
    -- Store only hashed PINs or move verification into an authenticated server-side flow.
    system_pin_hash TEXT,
    tablet_pin_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_organizations_modtime
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Mapping table of users inside organizations
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    auth_user_id UUID NOT NULL, -- references auth.users(id) in Supabase Auth
    role TEXT NOT NULL CHECK (role IN ('director', 'manager', 'teacher', 'parent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, auth_user_id)
);

CREATE TRIGGER update_organization_members_modtime
    BEFORE UPDATE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Registration invitation codes
CREATE TABLE IF NOT EXISTS academy_invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_academy_invite_codes_modtime
    BEFORE UPDATE ON academy_invite_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Join requests
CREATE TABLE IF NOT EXISTS academy_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('teacher', 'parent')),
    request_method TEXT NOT NULL CHECK (request_method IN ('invite_code', 'academy_search')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    approved_by UUID
);

-- =========================================================================
-- 4. User profile and roles
-- =========================================================================
-- Extended profiles referencing Supabase Auth's auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- REFERENCES auth.users(id) ON DELETE SET NULL
    name TEXT NOT NULL,
    phone TEXT,
    provider TEXT,
    sns_id TEXT,
    role TEXT NOT NULL CHECK (role IN ('director', 'manager', 'teacher', 'parent', 'student')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    child_name TEXT, -- Fallback child field for simple parent mapping
    terms_agreement JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_user_profiles_modtime
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 5. Members/students/parents/teachers
-- =========================================================================
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_member_no INTEGER NOT NULL,
    name TEXT NOT NULL,
    instrument TEXT, -- e.g. Piano, Violin. Generalizable as 'subject_category'
    phone TEXT,
    parent_phone TEXT,
    school TEXT,
    grade TEXT,
    memo TEXT,
    fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
    leave_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_students_modtime
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS parent_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(parent_user_id, student_id)
);

CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    instrument TEXT, -- e.g. Piano, Violin
    joined_date DATE,
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_teachers_modtime
    BEFORE UPDATE ON teachers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS teacher_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_teacher_shifts_modtime
    BEFORE UPDATE ON teacher_shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 6. Sessions and attendance
-- =========================================================================
-- Named 'classes' for backward matching with DEFAULT_DB.classes
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', '월', '화', '수', '목', '금', '토', '일')),
    time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_classes_modtime
    BEFORE UPDATE ON classes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'pending')),
    time TIME, -- check-in time
    leaving_time TIME, -- check-out time
    note TEXT,
    video_url TEXT,
    images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, date)
);

CREATE TRIGGER update_attendance_records_modtime
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 7. Billing/catalog
-- =========================================================================
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_subjects_modtime
    BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER update_books_modtime
    BEFORE UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS student_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_student_books_modtime
    BEFORE UPDATE ON student_books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Combined bill/invoice list
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    month VARCHAR(7) NOT NULL, -- YYYY-MM
    type TEXT NOT NULL CHECK (type IN ('education', 'book')),
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
    invoice_date DATE NOT NULL,
    paid_date DATE,
    method TEXT CHECK (method IN ('cash', 'card', 'toss', 'kakao')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_payments_modtime
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 8. Communication
-- =========================================================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_announcements_modtime
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date DATE NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_messages_modtime
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of question objects
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_surveys_modtime
    BEFORE UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb, -- Key-value answers
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(survey_id, student_id)
);

CREATE TRIGGER update_survey_responses_modtime
    BEFORE UPDATE ON survey_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- 9. Settings and audit logs
-- =========================================================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    send_kakao_alert BOOLEAN NOT NULL DEFAULT TRUE,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_settings_modtime
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_user_id UUID, -- References user_profiles(id)
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 10. Indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_org_members_auth_user ON organization_members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_org ON students(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_org ON teachers(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(organization_id, month);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_student_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON parent_student_links(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_student ON classes(student_id);

-- =========================================================================
-- 11. RLS enable statements
-- =========================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 12. RLS policy drafts
-- =========================================================================

-- Helper policy logic description:
-- Directors/Managers: Authorized when they have an active record in organization_members.
-- Teachers: Authorized when their organization_members roles matches 'teacher'.
-- Parents: Authorized when parent_student_links references their user profile.

-- [Director / Owner Policy Draft]
-- CREATE POLICY director_all_access ON students
--     FOR ALL
--     USING (
--         EXISTS (
--             SELECT 1 FROM organization_members
--             WHERE organization_members.organization_id = students.organization_id
--               AND organization_members.auth_user_id = auth.uid()
--               AND organization_members.role = 'director'
--               AND organization_members.status = 'approved'
--         )
--     );

-- [Teacher Policy Draft]
-- CREATE POLICY teacher_restricted_access ON students
--     FOR SELECT
--     USING (
--         EXISTS (
--             SELECT 1 FROM organization_members
--             WHERE organization_members.organization_id = students.organization_id
--               AND organization_members.auth_user_id = auth.uid()
--               AND organization_members.role = 'teacher'
--         )
--     );

-- [Parent Policy Draft]
-- CREATE POLICY parent_student_access ON students
--     FOR SELECT
--     USING (
--         EXISTS (
--             SELECT 1 FROM parent_student_links
--             JOIN user_profiles ON user_profiles.id = parent_student_links.parent_user_id
--             WHERE parent_student_links.student_id = students.id
--               AND user_profiles.auth_user_id = auth.uid()
--         )
--     );

-- [Kiosk Tablet Policy Draft]
-- CREATE POLICY kiosk_insert_attendance ON attendance_records
--     FOR INSERT
--     WITH CHECK (
--         EXISTS (
--             SELECT 1 FROM organizations
--             WHERE organizations.id = attendance_records.organization_id
--             -- Authenticate using kiosk-authorized device credentials/profiles
--         )
--     );

-- =========================================================================
-- 13. Future extension tables
-- =========================================================================
-- Future Extension: plans
-- Used for lesson plans, pricing subscriptions, or class membership passes.
-- CREATE TABLE IF NOT EXISTS plans (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
--     name TEXT NOT NULL,
--     lessons_count INTEGER,
--     validity_days INTEGER,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Future Extension: enrollments
-- Used to track student course registration history.
-- CREATE TABLE IF NOT EXISTS enrollments (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
--     plan_id UUID,
--     start_date DATE NOT NULL,
--     end_date DATE,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Future Extension: usage_ledger
-- Logs balance usage deduction for PT session packs or lesson counting.
-- CREATE TABLE IF NOT EXISTS usage_ledger (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
--     action_type TEXT NOT NULL CHECK (action_type IN ('deduct', 'charge')),
--     amount INTEGER NOT NULL,
--     note TEXT,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Future Extension: makeup_credits
-- Tracks makeup lesson balances ("보강 크레딧").
-- CREATE TABLE IF NOT EXISTS makeup_credits (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
--     balance INTEGER NOT NULL DEFAULT 0,
--     expiry_date DATE,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
