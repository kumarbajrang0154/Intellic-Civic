# IntelliCivic — Database Backup, Data Protection & Disaster Recovery Runbook

## 1. Database Architecture & Storage Engine

IntelliCivic utilizes **PostgreSQL 15+** provisioned via **Neon Serverless Database**:
- **Connection Pooler URL (`DATABASE_URL`)**: Utilizes PgBouncer connection pooling (`port 5432` with `sslmode=require` and pool timeouts). Ideal for serverless Next.js edge and lambda environments.
- **Direct Connection URL (`DIRECT_URL`)**: Direct connection to PostgreSQL compute node, reserved for schema migrations (`prisma db push`, `prisma migrate`).
- **Cold-Start Resilience**: Configured with `connect_timeout=25&pool_timeout=25` to withstand serverless auto-suspend wakeups (~6-8s) without dropped requests.

---

## 2. Backup Strategy & Point-In-Time Recovery (PITR)

### 2.1 Automated Continuous Archiving
- Neon provides continuous write-ahead logging (WAL) archiving and storage snapshots at the page level.
- **Backup Retention Window**: Configured for 7 days in standard tier and up to 30 days in production tier.
- **Continuous Backups**: Backups are performed automatically at storage layer with zero compute downtime or table locks.

### 2.2 Recovery Objectives
| Metric | Target | Rationale |
|---|---|---|
| **RPO (Recovery Point Objective)** | **< 60 seconds** | With continuous WAL streaming, maximum potential data loss in catastrophic compute loss is under 1 minute. |
| **RTO (Recovery Time Objective)** | **< 15 minutes** | Instant branch creation from point-in-time snapshot allows restoring database compute within minutes. |

---

## 3. Step-by-Step Disaster Recovery Procedure

### Scenario A: Accidental Data Corruption or Malicious Deletion
In the event of accidental table deletion or data corruption:

1. **Identify Timestamp of Clean State**:
   - Inspect `AuditLog` table or server logs to find the exact ISO timestamp prior to the incident:
     ```sql
     SELECT createdAt, action, entityType, metadata FROM audit_logs ORDER BY createdAt DESC LIMIT 20;
     ```
2. **Create Branch at Point-In-Time**:
   - In Neon Console (or via Neon CLI `neon branches create`):
     ```bash
     neon branches create \
       --project-id <PROJECT_ID> \
       --name recovery-branch-$(date +%s) \
       --parent main \
       --timestamp "2026-10-12T23:30:00Z"
     ```
3. **Verify Restored Data in Recovery Branch**:
   - Connect via `psql` to the recovery branch connection string.
   - Run row count and integrity checks:
     ```sql
     SELECT COUNT(*) FROM complaints;
     SELECT COUNT(*) FROM users;
     SELECT COUNT(*) FROM audit_logs;
     ```
4. **Switch Production Application Connection**:
   - Update `DATABASE_URL` and `DIRECT_URL` in the deployment environment (e.g. Vercel Project Settings) to point to the validated recovery branch.
   - Trigger zero-downtime redeployment.

### Scenario B: Offline Data Dump & Cold Storage
For scheduled weekly cold backups to encrypted S3 / Cloud Storage:
```bash
# Export schema + data using pg_dump with SSL
pg_dump -d "$DIRECT_URL" -Fc -f "intellicivic_backup_$(date +%Y%m%d_%H%M%S).dump"

# Verify dump archive integrity
pg_restore -l "intellicivic_backup_$(date +%Y%m%d_%H%M%S).dump" | head -n 20
```

---

## 4. Data Protection & Least-Privilege Access

1. **TLS 1.3 Transport Encryption**:
   - All client-to-database connections enforce `sslmode=require`. Plaintext connections are rejected at the firewall.
2. **Storage Encryption**:
   - Provider-managed AES-256 encryption at rest covers all tables, indexes, WAL segments, and backups.
3. **Soft Deletion & Audit Trail**:
   - Active users and complaints support soft-deletion tracking (`deletedAt`, `isSuspended`).
   - Permanent staff deletion executes within an atomic `prisma.$transaction` preserving historical audit and evidence attribution without breaking relational referential integrity.
