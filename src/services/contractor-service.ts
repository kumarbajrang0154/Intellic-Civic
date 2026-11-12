import { z } from 'zod';
import prisma from '@/lib/prisma';

export const createContractorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(160),
  registrationCode: z.string().trim().min(2).max(60),
  specialty: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal('')),
  departmentId: z.string().min(1).max(120).optional().nullable(),
  municipalityId: z.string().min(1).max(120).optional().nullable(),
});

export const updateContractorSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  companyName: z.string().trim().min(2).max(160).optional(),
  specialty: z.string().trim().min(2).max(120).optional(),
  contactEmail: z.string().trim().email().max(160).optional().nullable().or(z.literal('')),
  departmentId: z.string().min(1).max(120).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const assignContractorWorkOrderSchema = z.object({
  contractorId: z.string().min(1).max(120),
  estimatedCostPaise: z.number().int().min(0).max(500_000_000).default(0),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('ASSIGNED'),
});

export class ContractorServiceError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ContractorServiceError';
    this.statusCode = statusCode;
  }
}

export interface ContractorActor {
  id: string;
  role: string;
  municipalityId?: string | null;
}

export interface ContractorDbClient {
  contractor: {
    findMany: (args: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  contractorWorkOrder: {
    findMany: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
  };
  complaint: {
    findUnique: (args: any) => Promise<any>;
  };
}

export async function listContractors(
  actor: ContractorActor,
  filters?: { activeOnly?: boolean; departmentId?: string },
  db: ContractorDbClient = prisma as unknown as ContractorDbClient,
) {
  const where: any = {};
  if (actor.role !== 'SUPER_ADMIN' && actor.municipalityId) {
    where.municipalityId = actor.municipalityId;
  }
  if (filters?.activeOnly) {
    where.isActive = true;
  }
  if (filters?.departmentId) {
    where.departmentId = filters.departmentId;
  }

  try {
    const items = await db.contractor.findMany({
      where,
      select: {
        id: true,
        name: true,
        companyName: true,
        registrationCode: true,
        specialty: true,
        contactEmail: true,
        municipalityId: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        municipality: { select: { id: true, name: true, code: true } },
        _count: { select: { workOrders: true } },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return { items, migrationPending: false };
  } catch (err: any) {
    if (err?.code === 'P2021') {
      return { items: [], migrationPending: true };
    }
    throw err;
  }
}

export async function createContractor(
  actor: ContractorActor,
  input: z.infer<typeof createContractorSchema>,
  db: ContractorDbClient = prisma as unknown as ContractorDbClient,
) {
  const targetMunicipalityId =
    actor.role === 'SUPER_ADMIN'
      ? input.municipalityId ?? actor.municipalityId ?? null
      : actor.municipalityId ?? null;

  try {
    return await db.contractor.create({
      data: {
        name: input.name,
        companyName: input.companyName,
        registrationCode: input.registrationCode.toUpperCase(),
        specialty: input.specialty,
        contactEmail: input.contactEmail ? input.contactEmail.toLowerCase() : null,
        departmentId: input.departmentId ?? null,
        municipalityId: targetMunicipalityId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        registrationCode: true,
        specialty: true,
        contactEmail: true,
        municipalityId: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new ContractorServiceError('A contractor with this registration code already exists.', 409);
    }
    if (err?.code === 'P2021') {
      throw new ContractorServiceError('Contractor table migration has not been applied yet.', 503);
    }
    throw err;
  }
}

export async function updateContractor(
  contractorId: string,
  actor: ContractorActor,
  input: z.infer<typeof updateContractorSchema>,
  db: ContractorDbClient = prisma as unknown as ContractorDbClient,
) {
  const existing = await db.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, municipalityId: true },
  });
  if (!existing) {
    throw new ContractorServiceError('Contractor not found.', 404);
  }
  if (
    actor.role !== 'SUPER_ADMIN' &&
    actor.municipalityId &&
    existing.municipalityId &&
    actor.municipalityId !== existing.municipalityId
  ) {
    throw new ContractorServiceError('Forbidden: Cross-municipality contractor edit denied.', 403);
  }

  return await db.contractor.update({
    where: { id: contractorId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.specialty !== undefined ? { specialty: input.specialty } : {}),
      ...(input.contactEmail !== undefined
        ? { contactEmail: input.contactEmail ? input.contactEmail.toLowerCase() : null }
        : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      registrationCode: true,
      specialty: true,
      contactEmail: true,
      municipalityId: true,
      departmentId: true,
      isActive: true,
      updatedAt: true,
    },
  });
}

export async function assignContractorWorkOrder(
  complaintId: string,
  actor: ContractorActor,
  input: z.infer<typeof assignContractorWorkOrderSchema>,
  db: ContractorDbClient = prisma as unknown as ContractorDbClient,
) {
  const [complaint, contractor] = await Promise.all([
    db.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, ticketId: true, municipalityId: true },
    }),
    db.contractor.findUnique({
      where: { id: input.contractorId },
      select: { id: true, name: true, companyName: true, municipalityId: true, isActive: true },
    }),
  ]);

  if (!complaint) {
    throw new ContractorServiceError('Complaint not found.', 404);
  }
  if (!contractor) {
    throw new ContractorServiceError('Contractor not found.', 404);
  }
  if (!contractor.isActive) {
    throw new ContractorServiceError('Cannot assign work order to an inactive contractor.', 400);
  }

  if (
    actor.role !== 'SUPER_ADMIN' &&
    actor.municipalityId &&
    ((complaint.municipalityId && complaint.municipalityId !== actor.municipalityId) ||
      (contractor.municipalityId && contractor.municipalityId !== actor.municipalityId))
  ) {
    throw new ContractorServiceError('Forbidden: Cross-municipality assignment denied.', 403);
  }

  if (
    complaint.municipalityId &&
    contractor.municipalityId &&
    complaint.municipalityId !== contractor.municipalityId
  ) {
    throw new ContractorServiceError('Contractor and complaint belong to different municipalities.', 400);
  }

  const order = await db.contractorWorkOrder.create({
    data: {
      contractorId: contractor.id,
      complaintId: complaint.id,
      status: input.status,
      estimatedCostPaise: input.estimatedCostPaise,
      notes: input.notes ?? null,
      assignedByUserId: actor.id,
      completedAt: input.status === 'COMPLETED' ? new Date() : null,
    },
    select: {
      id: true,
      contractorId: true,
      complaintId: true,
      status: true,
      estimatedCostPaise: true,
      notes: true,
      createdAt: true,
    },
  });

  return { order, ticketId: complaint.ticketId, contractorName: contractor.companyName };
}

