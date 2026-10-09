-- ============================================================================
-- IntelliCivic Platform - Test Data Audit Script
-- STRICTLY READ-ONLY (SELECT ONLY, NO WRITES, NO MODIFICATIONS, NO DELETIONS)
-- Safe to execute directly in Neon SQL Editor or psql on production branch
-- ============================================================================

-- ============================================================================
-- SECTION 1: AUDIT SUMMARY COUNTS PER TABLE
-- ============================================================================

WITH flagged_users AS (
  SELECT u.id
  FROM users u
  WHERE
    u.name ILIKE 'Thiru Balasubramaniam%'
    OR u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other')
    OR u.id LIKE 'usr_dept_head_%'
    OR u.id LIKE 'usr_officer_%'
    OR u.id LIKE 'citizen_%'
    OR u.id LIKE 'staff-seed-%'
    OR u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in')
    OR u.email ILIKE '%@example.com'
    OR u.email ILIKE '%.test@%'
    OR u.email ILIKE '%test%@%'
    OR u.email ILIKE '%@test.%'
    OR u.email ILIKE 'e2e%@%'
    OR u."mobileNumber" IN ('9999999999', '9876543210', '9123456789')
    OR u."mobileNumber" LIKE '9999%'
    OR u."mobileNumber" LIKE '0000%'
    OR u.name ILIKE '%Test%'
    OR u.name ILIKE '%E2E%'
    OR u.name ILIKE '%Spec%'
),
flagged_complaints AS (
  SELECT c.id
  FROM complaints c
  WHERE
    c."ticketId" IN ('TCK-LONG-150', 'TCK-TML-002', 'TCK-CLOSE-001')
    OR c."ticketId" LIKE 'TCK-OVF-%'
    OR c."ticketId" LIKE 'TCK-TEST-%'
    OR c."ticketId" LIKE 'TCK-AUTO-%'
    OR c."ticketId" LIKE 'TCK-SEC-%'
    OR c."ticketId" LIKE 'TCK-BULK-%'
    OR c."ticketId" LIKE 'TCK-E2E-%'
    OR c."ticketId" LIKE 'TCK-DUP-%'
    OR c.title ILIKE 'Road Crater & Severe Pavement Subsidence%'
    OR c.title LIKE '%குடிநீர் விநியோக குழாய் உடைப்பு%'
    OR c."citizenId" IN (SELECT id FROM flagged_users)
),
flagged_evidence AS (
  SELECT e.id
  FROM evidence e
  WHERE
    e."complaintId" IN (SELECT id FROM flagged_complaints)
    OR e."uploadedByUserId" IN (SELECT id FROM flagged_users)
    OR e."imageUrl" LIKE 'data:image%'
    OR e."imageUrl" LIKE 'blob:%'
    OR e."imageUrl" ILIKE '%placeholder%'
),
flagged_notifications AS (
  SELECT n.id
  FROM notifications n
  WHERE
    n."complaintId" IN (SELECT id FROM flagged_complaints)
    OR n."recipientUserId" IN (SELECT id FROM flagged_users)
),
flagged_audit_logs AS (
  SELECT a.id
  FROM audit_logs a
  WHERE
    a."userId" IN (SELECT id FROM flagged_users)
    OR a."entityId" IN (SELECT id FROM flagged_users)
    OR a."entityId" IN (SELECT id FROM flagged_complaints)
    OR a.action ILIKE '%TEST%'
    OR a.action ILIKE '%BULK_TEST%'
)
SELECT 'users' AS table_name, COUNT(*) AS flagged_test_rows FROM flagged_users
UNION ALL
SELECT 'complaints', COUNT(*) FROM flagged_complaints
UNION ALL
SELECT 'evidence', COUNT(*) FROM flagged_evidence
UNION ALL
SELECT 'notifications', COUNT(*) FROM flagged_notifications
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM flagged_audit_logs;

-- ============================================================================
-- SECTION 2: FLAGGED USERS (PARTIALLY MASKED EMAILS AND PHONES)
-- ============================================================================

SELECT
  u.id,
  u."createdAt",
  CASE
    WHEN u.name ILIKE 'Thiru Balasubramaniam%' THEN 'Seed: Long name staff member (Thiru Balasubramaniam)'
    WHEN u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other') OR u.id LIKE 'usr_dept_head_%' OR u.id LIKE 'usr_officer_%' OR u.id LIKE 'citizen_%' OR u.id LIKE 'staff-seed-%' THEN 'Known seed / dev user ID (' || u.id || ')'
    WHEN u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in') THEN 'Known seed staff email'
    WHEN u.email ILIKE '%@example.com' OR u.email ILIKE '%.test@%' OR u.email ILIKE '%test%@%' OR u.email ILIKE '%@test.%' OR u.email ILIKE 'e2e%@%' THEN 'Test email domain/pattern'
    WHEN u."mobileNumber" IN ('9999999999', '9876543210', '9123456789') OR u."mobileNumber" LIKE '9999%' OR u."mobileNumber" LIKE '0000%' THEN 'Known test mobile number'
    WHEN u.name ILIKE '%Test%' OR u.name ILIKE '%E2E%' OR u.name ILIKE '%Spec%' THEN 'Name contains test/spec pattern'
    ELSE 'Other test user pattern'
  END AS why_flagged,
  u.name,
  CASE
    WHEN u.email IS NULL THEN NULL
    WHEN POSITION('@' IN u.email) > 2 THEN
      SUBSTRING(u.email FROM 1 FOR 2) || '***@' || SPLIT_PART(u.email, '@', 2)
    ELSE '***@' || SPLIT_PART(u.email, '@', 2)
  END AS masked_email,
  CASE
    WHEN u."mobileNumber" IS NULL THEN NULL
    WHEN LENGTH(u."mobileNumber") >= 6 THEN
      SUBSTRING(u."mobileNumber" FROM 1 FOR 2) || '******' || RIGHT(u."mobileNumber", 2)
    ELSE '******'
  END AS masked_phone,
  u.role::text AS role
FROM users u
WHERE
  u.name ILIKE 'Thiru Balasubramaniam%'
  OR u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other')
  OR u.id LIKE 'usr_dept_head_%'
  OR u.id LIKE 'usr_officer_%'
  OR u.id LIKE 'citizen_%'
  OR u.id LIKE 'staff-seed-%'
  OR u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in')
  OR u.email ILIKE '%@example.com'
  OR u.email ILIKE '%.test@%'
  OR u.email ILIKE '%test%@%'
  OR u.email ILIKE '%@test.%'
  OR u.email ILIKE 'e2e%@%'
  OR u."mobileNumber" IN ('9999999999', '9876543210', '9123456789')
  OR u."mobileNumber" LIKE '9999%'
  OR u."mobileNumber" LIKE '0000%'
  OR u.name ILIKE '%Test%'
  OR u.name ILIKE '%E2E%'
  OR u.name ILIKE '%Spec%'
ORDER BY u."createdAt" DESC;

-- ============================================================================
-- SECTION 3: FLAGGED COMPLAINTS
-- ============================================================================

WITH flagged_user_ids AS (
  SELECT u.id FROM users u
  WHERE
    u.name ILIKE 'Thiru Balasubramaniam%'
    OR u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other')
    OR u.id LIKE 'usr_dept_head_%'
    OR u.id LIKE 'usr_officer_%'
    OR u.id LIKE 'citizen_%'
    OR u.id LIKE 'staff-seed-%'
    OR u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in')
    OR u.email ILIKE '%@example.com'
    OR u.email ILIKE '%.test@%'
    OR u.email ILIKE '%test%@%'
    OR u.email ILIKE '%@test.%'
    OR u.email ILIKE 'e2e%@%'
    OR u."mobileNumber" IN ('9999999999', '9876543210', '9123456789')
    OR u."mobileNumber" LIKE '9999%'
    OR u."mobileNumber" LIKE '0000%'
    OR u.name ILIKE '%Test%'
    OR u.name ILIKE '%E2E%'
    OR u.name ILIKE '%Spec%'
)
SELECT
  c.id,
  c."createdAt",
  CASE
    WHEN c."ticketId" = 'TCK-LONG-150' THEN 'Known leftover: TCK-LONG-150 (150-char overflow test)'
    WHEN c."ticketId" = 'TCK-TML-002' THEN 'Known leftover: TCK-TML-002 (Tamil unicode test)'
    WHEN c."ticketId" = 'TCK-CLOSE-001' THEN 'Known leftover: TCK-CLOSE-001 (Ticket lifecycle test)'
    WHEN c."ticketId" LIKE 'TCK-OVF-%' THEN 'Test ticket prefix: TCK-OVF- (Mobile overflow test)'
    WHEN c."ticketId" LIKE 'TCK-TEST-%' THEN 'Test ticket prefix: TCK-TEST-'
    WHEN c."ticketId" LIKE 'TCK-AUTO-%' THEN 'Test ticket prefix: TCK-AUTO-'
    WHEN c."ticketId" LIKE 'TCK-SEC-%' THEN 'Test ticket prefix: TCK-SEC-'
    WHEN c."ticketId" LIKE 'TCK-BULK-%' THEN 'Test ticket prefix: TCK-BULK-'
    WHEN c."ticketId" LIKE 'TCK-E2E-%' THEN 'Test ticket prefix: TCK-E2E-'
    WHEN c."ticketId" LIKE 'TCK-DUP-%' THEN 'Test ticket prefix: TCK-DUP-'
    WHEN c.title ILIKE 'Road Crater & Severe Pavement Subsidence%' THEN 'Known overflow test title'
    WHEN c.title LIKE '%குடிநீர் விநியோக குழாய் உடைப்பு%' THEN 'Known Tamil test title'
    WHEN c."citizenId" IN (SELECT id FROM flagged_user_ids) THEN 'Created by flagged test citizen (' || c."citizenId" || ')'
    ELSE 'Complaint matching test criteria'
  END AS why_flagged,
  c."ticketId",
  c.title,
  c."citizenId",
  c.status::text AS status
FROM complaints c
WHERE
  c."ticketId" IN ('TCK-LONG-150', 'TCK-TML-002', 'TCK-CLOSE-001')
  OR c."ticketId" LIKE 'TCK-OVF-%'
  OR c."ticketId" LIKE 'TCK-TEST-%'
  OR c."ticketId" LIKE 'TCK-AUTO-%'
  OR c."ticketId" LIKE 'TCK-SEC-%'
  OR c."ticketId" LIKE 'TCK-BULK-%'
  OR c."ticketId" LIKE 'TCK-E2E-%'
  OR c."ticketId" LIKE 'TCK-DUP-%'
  OR c.title ILIKE 'Road Crater & Severe Pavement Subsidence%'
  OR c.title LIKE '%குடிநீர் விநியோக குழாய் உடைப்பு%'
  OR c."citizenId" IN (SELECT id FROM flagged_user_ids)
ORDER BY c."createdAt" DESC;

-- ============================================================================
-- SECTION 4: FLAGGED EVIDENCE
-- ============================================================================

WITH flagged_user_ids AS (
  SELECT u.id FROM users u
  WHERE
    u.name ILIKE 'Thiru Balasubramaniam%'
    OR u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other')
    OR u.id LIKE 'usr_dept_head_%'
    OR u.id LIKE 'usr_officer_%'
    OR u.id LIKE 'citizen_%'
    OR u.id LIKE 'staff-seed-%'
    OR u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in')
    OR u.email ILIKE '%@example.com'
    OR u.email ILIKE '%.test@%'
    OR u.email ILIKE '%test%@%'
    OR u.email ILIKE '%@test.%'
    OR u.email ILIKE 'e2e%@%'
    OR u."mobileNumber" IN ('9999999999', '9876543210', '9123456789')
    OR u."mobileNumber" LIKE '9999%'
    OR u."mobileNumber" LIKE '0000%'
    OR u.name ILIKE '%Test%'
    OR u.name ILIKE '%E2E%'
    OR u.name ILIKE '%Spec%'
),
flagged_complaint_ids AS (
  SELECT c.id FROM complaints c
  WHERE
    c."ticketId" IN ('TCK-LONG-150', 'TCK-TML-002', 'TCK-CLOSE-001')
    OR c."ticketId" LIKE 'TCK-OVF-%'
    OR c."ticketId" LIKE 'TCK-TEST-%'
    OR c."ticketId" LIKE 'TCK-AUTO-%'
    OR c."ticketId" LIKE 'TCK-SEC-%'
    OR c."ticketId" LIKE 'TCK-BULK-%'
    OR c."ticketId" LIKE 'TCK-E2E-%'
    OR c."ticketId" LIKE 'TCK-DUP-%'
    OR c.title ILIKE 'Road Crater & Severe Pavement Subsidence%'
    OR c.title LIKE '%குடிநீர் விநியோக குழாய் உடைப்பு%'
    OR c."citizenId" IN (SELECT id FROM flagged_user_ids)
)
SELECT
  e.id,
  e."uploadedAt" AS "createdAt",
  CASE
    WHEN e."complaintId" IN (SELECT id FROM flagged_complaint_ids) THEN 'Attached to flagged complaint (' || e."complaintId" || ')'
    WHEN e."uploadedByUserId" IN (SELECT id FROM flagged_user_ids) THEN 'Uploaded by flagged test user (' || e."uploadedByUserId" || ')'
    WHEN e."imageUrl" LIKE 'data:image%' OR e."imageUrl" LIKE 'blob:%' OR e."imageUrl" ILIKE '%placeholder%' THEN 'Mock or inline data URL evidence'
    ELSE 'Evidence matching test criteria'
  END AS why_flagged,
  e."complaintId",
  e.stage::text AS stage,
  e."uploadedByName",
  e."uploadedByUserId"
FROM evidence e
WHERE
  e."complaintId" IN (SELECT id FROM flagged_complaint_ids)
  OR e."uploadedByUserId" IN (SELECT id FROM flagged_user_ids)
  OR e."imageUrl" LIKE 'data:image%'
  OR e."imageUrl" LIKE 'blob:%'
  OR e."imageUrl" ILIKE '%placeholder%'
ORDER BY e."uploadedAt" DESC;

-- ============================================================================
-- SECTION 5: FLAGGED NOTIFICATIONS
-- ============================================================================

WITH flagged_user_ids AS (
  SELECT u.id FROM users u
  WHERE
    u.name ILIKE 'Thiru Balasubramaniam%'
    OR u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other')
    OR u.id LIKE 'usr_dept_head_%'
    OR u.id LIKE 'usr_officer_%'
    OR u.id LIKE 'citizen_%'
    OR u.id LIKE 'staff-seed-%'
    OR u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in')
    OR u.email ILIKE '%@example.com'
    OR u.email ILIKE '%.test@%'
    OR u.email ILIKE '%test%@%'
    OR u.email ILIKE '%@test.%'
    OR u.email ILIKE 'e2e%@%'
    OR u."mobileNumber" IN ('9999999999', '9876543210', '9123456789')
    OR u."mobileNumber" LIKE '9999%'
    OR u."mobileNumber" LIKE '0000%'
    OR u.name ILIKE '%Test%'
    OR u.name ILIKE '%E2E%'
    OR u.name ILIKE '%Spec%'
),
flagged_complaint_ids AS (
  SELECT c.id FROM complaints c
  WHERE
    c."ticketId" IN ('TCK-LONG-150', 'TCK-TML-002', 'TCK-CLOSE-001')
    OR c."ticketId" LIKE 'TCK-OVF-%'
    OR c."ticketId" LIKE 'TCK-TEST-%'
    OR c."ticketId" LIKE 'TCK-AUTO-%'
    OR c."ticketId" LIKE 'TCK-SEC-%'
    OR c."ticketId" LIKE 'TCK-BULK-%'
    OR c."ticketId" LIKE 'TCK-E2E-%'
    OR c."ticketId" LIKE 'TCK-DUP-%'
    OR c.title ILIKE 'Road Crater & Severe Pavement Subsidence%'
    OR c.title LIKE '%குடிநீர் விநியோக குழாய் உடைப்பு%'
    OR c."citizenId" IN (SELECT id FROM flagged_user_ids)
)
SELECT
  n.id,
  n."createdAt",
  CASE
    WHEN n."complaintId" IN (SELECT id FROM flagged_complaint_ids) THEN 'Linked to flagged complaint (' || n."complaintId" || ')'
    WHEN n."recipientUserId" IN (SELECT id FROM flagged_user_ids) THEN 'Sent to flagged test user (' || n."recipientUserId" || ')'
    ELSE 'Notification matching test criteria'
  END AS why_flagged,
  n."complaintId",
  n."recipientUserId",
  n.type::text AS type
FROM notifications n
WHERE
  n."complaintId" IN (SELECT id FROM flagged_complaint_ids)
  OR n."recipientUserId" IN (SELECT id FROM flagged_user_ids)
ORDER BY n."createdAt" DESC;

-- ============================================================================
-- SECTION 6: FLAGGED AUDIT LOGS
-- ============================================================================

WITH flagged_user_ids AS (
  SELECT u.id FROM users u
  WHERE
    u.name ILIKE 'Thiru Balasubramaniam%'
    OR u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other')
    OR u.id LIKE 'usr_dept_head_%'
    OR u.id LIKE 'usr_officer_%'
    OR u.id LIKE 'citizen_%'
    OR u.id LIKE 'staff-seed-%'
    OR u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in')
    OR u.email ILIKE '%@example.com'
    OR u.email ILIKE '%.test@%'
    OR u.email ILIKE '%test%@%'
    OR u.email ILIKE '%@test.%'
    OR u.email ILIKE 'e2e%@%'
    OR u."mobileNumber" IN ('9999999999', '9876543210', '9123456789')
    OR u."mobileNumber" LIKE '9999%'
    OR u."mobileNumber" LIKE '0000%'
    OR u.name ILIKE '%Test%'
    OR u.name ILIKE '%E2E%'
    OR u.name ILIKE '%Spec%'
),
flagged_complaint_ids AS (
  SELECT c.id FROM complaints c
  WHERE
    c."ticketId" IN ('TCK-LONG-150', 'TCK-TML-002', 'TCK-CLOSE-001')
    OR c."ticketId" LIKE 'TCK-OVF-%'
    OR c."ticketId" LIKE 'TCK-TEST-%'
    OR c."ticketId" LIKE 'TCK-AUTO-%'
    OR c."ticketId" LIKE 'TCK-SEC-%'
    OR c."ticketId" LIKE 'TCK-BULK-%'
    OR c."ticketId" LIKE 'TCK-E2E-%'
    OR c."ticketId" LIKE 'TCK-DUP-%'
    OR c.title ILIKE 'Road Crater & Severe Pavement Subsidence%'
    OR c.title LIKE '%குடிநீர் விநியோக குழாய் உடைப்பு%'
    OR c."citizenId" IN (SELECT id FROM flagged_user_ids)
)
SELECT
  a.id,
  a."createdAt",
  CASE
    WHEN a."userId" IN (SELECT id FROM flagged_user_ids) THEN 'Triggered by flagged test user (' || a."userId" || ')'
    WHEN a."entityId" IN (SELECT id FROM flagged_user_ids) THEN 'Targets flagged test user (' || a."entityId" || ')'
    WHEN a."entityId" IN (SELECT id FROM flagged_complaint_ids) THEN 'Targets flagged test complaint (' || a."entityId" || ')'
    WHEN a.action ILIKE '%TEST%' OR a.action ILIKE '%BULK_TEST%' THEN 'Test action type (' || a.action || ')'
    ELSE 'Audit log matching test criteria'
  END AS why_flagged,
  a."userId",
  a.action,
  a."entityType",
  a."entityId"
FROM audit_logs a
WHERE
  a."userId" IN (SELECT id FROM flagged_user_ids)
  OR a."entityId" IN (SELECT id FROM flagged_user_ids)
  OR a."entityId" IN (SELECT id FROM flagged_complaint_ids)
  OR a.action ILIKE '%TEST%'
  OR a.action ILIKE '%BULK_TEST%'
ORDER BY a."createdAt" DESC;

-- ============================================================================
-- SECTION 7: UNIFIED MASTER LIST (id, createdAt, why_flagged across all tables)
-- ============================================================================

WITH flagged_user_ids AS (
  SELECT u.id FROM users u
  WHERE
    u.name ILIKE 'Thiru Balasubramaniam%'
    OR u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other')
    OR u.id LIKE 'usr_dept_head_%'
    OR u.id LIKE 'usr_officer_%'
    OR u.id LIKE 'citizen_%'
    OR u.id LIKE 'staff-seed-%'
    OR u.email IN ('superadmin.test@smartcity.gov.in', 'head.roads@smartcity.gov.in', 'officer.roads@smartcity.gov.in', 'fieldworker@intellicivic.gov.in', 'otherfieldworker@intellicivic.gov.in', 'staff.longname@smartcity.gov.in', 'admin@smartcity.gov.in')
    OR u.email ILIKE '%@example.com'
    OR u.email ILIKE '%.test@%'
    OR u.email ILIKE '%test%@%'
    OR u.email ILIKE '%@test.%'
    OR u.email ILIKE 'e2e%@%'
    OR u."mobileNumber" IN ('9999999999', '9876543210', '9123456789')
    OR u."mobileNumber" LIKE '9999%'
    OR u."mobileNumber" LIKE '0000%'
    OR u.name ILIKE '%Test%'
    OR u.name ILIKE '%E2E%'
    OR u.name ILIKE '%Spec%'
),
flagged_complaint_ids AS (
  SELECT c.id FROM complaints c
  WHERE
    c."ticketId" IN ('TCK-LONG-150', 'TCK-TML-002', 'TCK-CLOSE-001')
    OR c."ticketId" LIKE 'TCK-OVF-%'
    OR c."ticketId" LIKE 'TCK-TEST-%'
    OR c."ticketId" LIKE 'TCK-AUTO-%'
    OR c."ticketId" LIKE 'TCK-SEC-%'
    OR c."ticketId" LIKE 'TCK-BULK-%'
    OR c."ticketId" LIKE 'TCK-E2E-%'
    OR c."ticketId" LIKE 'TCK-DUP-%'
    OR c.title ILIKE 'Road Crater & Severe Pavement Subsidence%'
    OR c.title LIKE '%குடிநீர் விநியோக குழாய் உடைப்பு%'
    OR c."citizenId" IN (SELECT id FROM flagged_user_ids)
)
SELECT 'users' AS table_name, u.id, u."createdAt",
  CASE
    WHEN u.name ILIKE 'Thiru Balasubramaniam%' THEN 'Seed: Long name staff member (Thiru Balasubramaniam)'
    WHEN u.id IN ('usr_super_admin', 'fw-demo-1', 'fw-demo-other') OR u.id LIKE 'usr_dept_head_%' OR u.id LIKE 'usr_officer_%' OR u.id LIKE 'citizen_%' OR u.id LIKE 'staff-seed-%' THEN 'Known seed / dev user ID (' || u.id || ')'
    ELSE 'Test staff/citizen pattern'
  END AS why_flagged
FROM users u WHERE u.id IN (SELECT id FROM flagged_user_ids)
UNION ALL
SELECT 'complaints', c.id, c."createdAt",
  CASE
    WHEN c."ticketId" IN ('TCK-LONG-150', 'TCK-TML-002', 'TCK-CLOSE-001') THEN 'Known ticket leftover (' || c."ticketId" || ')'
    WHEN c."ticketId" LIKE 'TCK-%' THEN 'Test ticket prefix (' || c."ticketId" || ')'
    ELSE 'Complaint created by flagged test user'
  END
FROM complaints c WHERE c.id IN (SELECT id FROM flagged_complaint_ids)
UNION ALL
SELECT 'evidence', e.id, e."uploadedAt" AS "createdAt", 'Evidence linked to flagged complaint or user'
FROM evidence e
WHERE e."complaintId" IN (SELECT id FROM flagged_complaint_ids) OR e."uploadedByUserId" IN (SELECT id FROM flagged_user_ids) OR e."imageUrl" LIKE 'data:image%'
UNION ALL
SELECT 'notifications', n.id, n."createdAt", 'Notification linked to flagged complaint or user'
FROM notifications n
WHERE n."complaintId" IN (SELECT id FROM flagged_complaint_ids) OR n."recipientUserId" IN (SELECT id FROM flagged_user_ids)
UNION ALL
SELECT 'audit_logs', a.id, a."createdAt", 'Audit log associated with flagged test entities'
FROM audit_logs a
WHERE a."userId" IN (SELECT id FROM flagged_user_ids) OR a."entityId" IN (SELECT id FROM flagged_user_ids) OR a."entityId" IN (SELECT id FROM flagged_complaint_ids) OR a.action ILIKE '%TEST%'
ORDER BY table_name, "createdAt" DESC;
