import { z } from 'zod';
import prisma from '@/lib/prisma';

export const createMunicipalitySchema = z.object({
  name: z.string().trim().min(2).max(140),
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must use letters, numbers, dashes, or underscores'),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  starterDepartmentName: z.string().trim().min(2).max(120).optional(),
  starterDepartmentDescription: z.string().trim().max(400).optional(),
});

export const updateMunicipalitySchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
});

export class MunicipalityServiceError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'MunicipalityServiceError';
    this.statusCode = statusCode;
  }
}

export interface MunicipalityDbClient {
  municipality: {
    findMany: (args: any) => Promise<any[]>;
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  department: {
    create: (args: any) => Promise<any>;
  };
  $transaction?: <T>(fn: (tx: MunicipalityDbClient) => Promise<T>) => Promise<T>;
}

export async function listMunicipalities(
  actor: { role: string; municipalityId?: string | null },
  db: MunicipalityDbClient = prisma as unknown as MunicipalityDbClient,
) {
  const where =
    actor.role !== 'SUPER_ADMIN' && actor.municipalityId ? { id: actor.municipalityId } : {};

  const items = await db.municipality.findMany({
    where,
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      state: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          users: true,
          departments: true,
          complaints: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return items.map((m) => ({
    id: m.id,
    name: m.name,
    code: m.code,
    city: m.city,
    state: m.state,
    createdAt: m.createdAt,
    counts: {
      users: m._count?.users ?? 0,
      departments: m._count?.departments ?? 0,
      complaints: m._count?.complaints ?? 0,
    },
    onboardingReady: Boolean((m._count?.departments ?? 0) > 0 && m.city && m.state),
  }));
}

export async function onboardMunicipality(
  input: z.infer<typeof createMunicipalitySchema>,
  db: MunicipalityDbClient = prisma as unknown as MunicipalityDbClient,
) {
  const normalizedCode = input.code.toUpperCase();

  const runCreate = async (tx: MunicipalityDbClient) => {
    const municipality = await tx.municipality.create({
      data: {
        name: input.name,
        code: normalizedCode,
        city: input.city,
        state: input.state,
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        state: true,
        createdAt: true,
      },
    });

    let starterDepartment: { id: string; name: string } | null = null;
    if (input.starterDepartmentName) {
      starterDepartment = await tx.department.create({
        data: {
          name: input.starterDepartmentName,
          description:
            input.starterDepartmentDescription ||
            `Primary civic operations department for ${input.name}`,
          municipalityId: municipality.id,
        },
        select: { id: true, name: true },
      });
    }

    return { municipality, starterDepartment };
  };

  try {
    if (typeof db.$transaction === 'function') {
      return await db.$transaction(runCreate);
    }
    return await runCreate(db);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new MunicipalityServiceError(
        'A municipality or starter department with this name or code already exists.',
        409,
      );
    }
    throw err;
  }
}

export async function updateMunicipality(
  id: string,
  input: z.infer<typeof updateMunicipalitySchema>,
  db: MunicipalityDbClient = prisma as unknown as MunicipalityDbClient,
) {
  const existing = await db.municipality.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new MunicipalityServiceError('Municipality not found.', 404);
  }

  try {
    return await db.municipality.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        state: true,
        updatedAt: true,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new MunicipalityServiceError('A municipality with this name already exists.', 409);
    }
    throw err;
  }
}

