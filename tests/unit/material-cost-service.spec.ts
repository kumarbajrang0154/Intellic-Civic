import { test, expect } from '@playwright/test';
import {
  checkComplaintMaterialAccess,
  computeLineTotalPaise,
  getDepartmentMaterialCostSummary,
  listComplaintMaterials,
  MATERIAL_ALLOWED_UNITS,
  materialCostReportQuerySchema,
  MaterialServiceError,
  MAX_MATERIAL_COST_RANGE_DAYS,
  recordComplaintMaterialEntry,
  summarizeComplaintCost,
  summarizeDepartmentMaterialCosts,
  validateMaterialEntry,
  type MaterialCostDbClient,
} from '@/services/material-cost-service';

function makeMockDb(overrides?: {
  complaint?: {
    id: string;
    ticketNumber: string;
    title: string;
    departmentId: string | null;
    assignment: { departmentOfficerId: string | null } | null;
  } | null;
  entries?: Array<{
    id: string;
    complaintId: string;
    name: string;
    quantity: number;
    unit: string;
    unitCostPaise: number;
    recordedByUserId: string;
    createdAt: Date;
    recordedByUser: { name: string };
  }>;
  summaryRows?: unknown[];
}): MaterialCostDbClient {
  const entries = overrides?.entries ? [...overrides.entries] : [];

  return {
    complaint: {
      async findUnique() {
        return overrides?.complaint === undefined
          ? {
              id: 'cmp-1',
              ticketNumber: 'IC-2026-101',
              title: 'Broken manhole cover',
              departmentId: 'dept-roads',
              assignment: { departmentOfficerId: 'officer-1' },
            }
          : overrides.complaint;
      },
    },
    complaintMaterialEntry: {
      async findMany(args) {
        if (overrides?.summaryRows && 'complaint' in (args.select ?? {})) {
          return overrides.summaryRows;
        }
        return entries;
      },
      async create(args) {
        const created = {
          id: `mat-${entries.length + 1}`,
          complaintId: args.data.complaintId,
          name: args.data.name,
          quantity: args.data.quantity,
          unit: args.data.unit,
          unitCostPaise: args.data.unitCostPaise,
          recordedByUserId: args.data.recordedByUserId,
          createdAt: new Date('2026-11-12T10:00:00.000Z'),
          recordedByUser: { name: 'Field Engineer' },
        };
        entries.unshift(created);
        return created;
      },
    },
  };
}

test.describe('Material & Cost Tracking Service', () => {
  test('computeLineTotalPaise handles rounding, zero, and negative values', () => {
    expect(computeLineTotalPaise(2.33, 1505)).toBe(3507);
    expect(computeLineTotalPaise(1.5, 333)).toBe(500);
    expect(computeLineTotalPaise('2.50', 4000)).toBe(10000);
    expect(computeLineTotalPaise(5, 0)).toBe(0);
    expect(computeLineTotalPaise(0, 500)).toBe(0);
    expect(computeLineTotalPaise(-2, 500)).toBe(0);
    expect(computeLineTotalPaise(2, -500)).toBe(0);
  });

  test('summarizeComplaintCost computes totalPaise and item count', () => {
    const empty = summarizeComplaintCost([]);
    expect(empty).toEqual({ totalPaise: 0, count: 0 });

    const summary = summarizeComplaintCost([
      { quantity: 2.33, unitCostPaise: 1505 },
      { quantity: 4, unitCostPaise: 25000 },
      { quantity: 1, unitCostPaise: 0 },
    ]);
    expect(summary).toEqual({ totalPaise: 103507, count: 3 });
  });

  test('validateMaterialEntry enforces unit allowlist, positive quantity, and non-negative integer cost', () => {
    for (const unit of MATERIAL_ALLOWED_UNITS) {
      const ok = validateMaterialEntry({
        name: ' Bitumen Patch ',
        quantity: 2.5,
        unit,
        unitCostPaise: 12000,
      });
      expect(ok.success).toBe(true);
      if (ok.success) {
        expect(ok.data.name).toBe('Bitumen Patch');
      }
    }

    const badUnit = validateMaterialEntry({
      name: 'Tar',
      quantity: 2,
      unit: 'gallon',
      unitCostPaise: 1000,
    });
    expect(badUnit.success).toBe(false);

    const negativeCost = validateMaterialEntry({
      name: 'Cement Bag',
      quantity: 1,
      unit: 'bag',
      unitCostPaise: -1,
    });
    expect(negativeCost.success).toBe(false);

    const fractionalPaise = validateMaterialEntry({
      name: 'Cement Bag',
      quantity: 1,
      unit: 'bag',
      unitCostPaise: 10.5,
    });
    expect(fractionalPaise.success).toBe(false);

    const zeroQuantity = validateMaterialEntry({
      name: 'Cement Bag',
      quantity: 0,
      unit: 'bag',
      unitCostPaise: 35000,
    });
    expect(zeroQuantity.success).toBe(false);

    const shortName = validateMaterialEntry({
      name: 'A',
      quantity: 1,
      unit: 'nos',
      unitCostPaise: 100,
    });
    expect(shortName.success).toBe(false);
  });

  test('materialCostReportQuerySchema caps date ranges at 366 inclusive days', () => {
    expect(MAX_MATERIAL_COST_RANGE_DAYS).toBe(366);

    const exactLimit = materialCostReportQuerySchema.safeParse({
      from: '2024-01-01',
      to: '2024-12-31',
    });
    expect(exactLimit.success).toBe(true);

    const overLimit = materialCostReportQuerySchema.safeParse({
      from: '2024-01-01',
      to: '2025-01-01',
    });
    expect(overLimit.success).toBe(false);

    const inverted = materialCostReportQuerySchema.safeParse({
      from: '2026-06-01',
      to: '2026-05-01',
    });
    expect(inverted.success).toBe(false);
  });

  test('checkComplaintMaterialAccess isolates department heads and restricts officers to assigned complaints', () => {
    const complaint = {
      departmentId: 'dept-roads',
      assignment: { departmentOfficerId: 'officer-1' },
    };

    expect(
      checkComplaintMaterialAccess(
        { id: 'admin-1', role: 'ADMIN', departmentId: null },
        complaint,
      ).allowed,
    ).toBe(true);

    expect(
      checkComplaintMaterialAccess(
        { id: 'head-roads', role: 'DEPARTMENT_HEAD', departmentId: 'dept-roads' },
        complaint,
      ).allowed,
    ).toBe(true);

    expect(
      checkComplaintMaterialAccess(
        { id: 'head-water', role: 'DEPARTMENT_HEAD', departmentId: 'dept-water' },
        complaint,
      ).allowed,
    ).toBe(false);

    expect(
      checkComplaintMaterialAccess(
        { id: 'officer-1', role: 'DEPARTMENT_OFFICER', departmentId: 'dept-roads' },
        complaint,
      ).allowed,
    ).toBe(true);

    expect(
      checkComplaintMaterialAccess(
        { id: 'officer-2', role: 'DEPARTMENT_OFFICER', departmentId: 'dept-roads' },
        complaint,
      ).allowed,
    ).toBe(false);

    expect(
      checkComplaintMaterialAccess(
        { id: 'citizen-1', role: 'CITIZEN', departmentId: null },
        complaint,
      ).allowed,
    ).toBe(false);
  });

  test('listComplaintMaterials and recordComplaintMaterialEntry enforce scoping and update summary', async () => {
    const db = makeMockDb();

    const deniedOfficer = await listComplaintMaterials(
      'cmp-1',
      { id: 'officer-other', role: 'DEPARTMENT_OFFICER', departmentId: 'dept-roads' },
      db,
    ).catch((err: unknown) => err);
    expect(deniedOfficer).toBeInstanceOf(MaterialServiceError);
    expect((deniedOfficer as MaterialServiceError).status).toBe(403);

    const created = await recordComplaintMaterialEntry(
      'cmp-1',
      {
        name: 'Precast Slab',
        quantity: 2,
        unit: 'nos',
        unitCostPaise: 150000,
      },
      { id: 'officer-1', role: 'DEPARTMENT_OFFICER', departmentId: 'dept-roads' },
      db,
    );
    expect(created.entry.lineTotalPaise).toBe(300000);
    expect(created.summary).toEqual({ totalPaise: 300000, count: 1 });

    const listed = await listComplaintMaterials(
      'cmp-1',
      { id: 'head-1', role: 'DEPARTMENT_HEAD', departmentId: 'dept-roads' },
      db,
    );
    expect(listed.entries).toHaveLength(1);
    expect(listed.summary.totalPaise).toBe(300000);
  });

  test('getDepartmentMaterialCostSummary enforces admin roles and aggregates per department', async () => {
    const summaryRows = [
      {
        complaintId: 'cmp-1',
        quantity: 2,
        unitCostPaise: 50000,
        complaint: {
          departmentId: 'dept-roads',
          department: { id: 'dept-roads', code: 'ROADS', name: 'Roads & Bridges' },
        },
      },
      {
        complaintId: 'cmp-1',
        quantity: 1,
        unitCostPaise: 25000,
        complaint: {
          departmentId: 'dept-roads',
          department: { id: 'dept-roads', code: 'ROADS', name: 'Roads & Bridges' },
        },
      },
      {
        complaintId: 'cmp-2',
        quantity: 3,
        unitCostPaise: 70000,
        complaint: {
          departmentId: 'dept-water',
          department: { id: 'dept-water', code: 'WATER', name: 'Water Supply' },
        },
      },
    ];
    const db = makeMockDb({ summaryRows });

    const forbidden = await getDepartmentMaterialCostSummary(
      { from: '2026-11-01', to: '2026-11-12' },
      { role: 'DEPARTMENT_HEAD' },
      db,
    ).catch((err: unknown) => err);
    expect(forbidden).toBeInstanceOf(MaterialServiceError);
    expect((forbidden as MaterialServiceError).status).toBe(403);

    const report = await getDepartmentMaterialCostSummary(
      { from: '2026-11-01', to: '2026-11-12' },
      { role: 'SUPER_ADMIN' },
      db,
    );
    expect(report.totalPaise).toBe(335000);
    expect(report.entryCount).toBe(3);
    expect(report.departments).toEqual([
      {
        departmentId: 'dept-water',
        departmentCode: 'WATER',
        departmentName: 'Water Supply',
        totalPaise: 210000,
        entryCount: 1,
        complaintCount: 1,
      },
      {
        departmentId: 'dept-roads',
        departmentCode: 'ROADS',
        departmentName: 'Roads & Bridges',
        totalPaise: 125000,
        entryCount: 2,
        complaintCount: 1,
      },
    ]);

    const pureAgg = summarizeDepartmentMaterialCosts([], {
      from: '2026-11-01',
      to: '2026-11-12',
    });
    expect(pureAgg.departments).toEqual([]);
    expect(pureAgg.totalPaise).toBe(0);
  });
});

