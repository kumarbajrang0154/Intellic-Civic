import prisma from '@/lib/prisma';
import { ComplaintStatus, PriorityLevel, EvidenceStage, UserRole } from '@prisma/client';

export interface ComplaintCategory {
  id: string;
  name: string;
  description: string;
  departmentId: string;
  icon?: string;
}

export interface ComplaintLocation {
  address?: string;
  latitude: number;
  longitude: number;
}

export interface ComplaintEvidence {
  id: string;
  imageUrl: string;
  stage?: 'BEFORE' | 'DURING' | 'AFTER';
  uploadedAt: string;
}

export interface StatusHistoryItem {
  id: string;
  fromStatus?: string;
  toStatus: string;
  changedAt: string;
  changedByUser?: {
    name: string;
  };
  notes?: string;
}

export interface ComplaintFeedback {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface PotentialDuplicate {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  address?: string;
  similarityScore: number;
  createdAt: string;
}

export interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: 'SUBMITTED' | 'AI_PROCESSING' | 'PENDING_DEPT_REVIEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REJECTED' | 'DUPLICATE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categoryId?: string;
  category?: ComplaintCategory | null;
  originalCategoryId?: string;
  originalCategory?: ComplaintCategory | null;
  departmentId?: string;
  department?: { id: string; name: string } | null;
  aiRecommendedDepartmentId?: string;
  aiRecommendedDepartment?: { id: string; name: string } | null;
  location?: ComplaintLocation | null;
  evidence: ComplaintEvidence[];
  statusHistory: StatusHistoryItem[];
  feedback?: ComplaintFeedback | null;
  citizenId: string;
  citizenName?: string;
  citizenMobile?: string;
  assignedFieldWorkerId?: string | null;
  assignedFieldWorker?: { id: string; name: string } | null;
  readyForReview?: boolean;
  fieldWorkerRemarks?: string;
  isVoiceInput?: boolean;
  voiceTranscript?: string;
  reopenCount?: number;
  reopenedAt?: string;
  reopenReason?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  aiPrediction?: {
    rawResponse?: {
      recommendation?: string;
      statusMessage?: string;
    };
  };
}

export const DEFAULT_CATEGORIES: ComplaintCategory[] = [
  {
    id: 'cat-sanitation',
    name: 'Sanitation & Solid Waste',
    description: 'Garbage collection, street cleaning, overflow dumpsters, waste disposal.',
    departmentId: 'dept_solid_waste',
    icon: 'Trash2',
  },
  {
    id: 'cat-roads',
    name: 'Roads & Infrastructure',
    description: 'Potholes, broken footpaths, damaged bridges, missing manhole covers.',
    departmentId: 'dept_roads_infra',
    icon: 'Construction',
  },
  {
    id: 'cat-water',
    name: 'Water Supply & Sanitation',
    description: 'Pipeline leaks, contaminated water supply, low pressure, drainage blockage.',
    departmentId: 'dept_water_sanitation',
    icon: 'Droplets',
  },
  {
    id: 'cat-electricity',
    name: 'Electricity & Streetlights',
    description: 'Non-functional streetlights, dangerous loose wiring, transformer spark.',
    departmentId: 'dept_electricity_lights',
    icon: 'Zap',
  },
];

export async function listCategories(): Promise<ComplaintCategory[]> {
  const cats = await prisma.category.findMany();
  if (cats.length === 0) return DEFAULT_CATEGORIES;
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    departmentId: c.departmentId,
    icon: DEFAULT_CATEGORIES.find((d) => d.id === c.id)?.icon || 'FileText',
  }));
}

export function generateTicketId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `INC-${dateStr}-${randomNum}`;
}

const DEFAULT_INCLUDE = {
  citizen: true,
  category: true,
  department: true,
  aiRecommendedDepartment: true,
  assignedFieldWorker: true,
  location: true,
  images: true,
  evidence: true,
  statusHistory: {
    include: {
      changedByUser: true,
    },
    orderBy: { changedAt: 'asc' as const },
  },
  feedback: true,
  aiPrediction: true,
};

function formatComplaint(raw: any): Complaint {
  const evidenceList: ComplaintEvidence[] = [];

  // Include images uploaded by citizen
  if (Array.isArray(raw.images)) {
    raw.images.forEach((img: any) => {
      evidenceList.push({
        id: img.id,
        imageUrl: img.imageUrl,
        stage: 'BEFORE',
        uploadedAt: img.uploadedAt instanceof Date ? img.uploadedAt.toISOString() : new Date(img.uploadedAt).toISOString(),
      });
    });
  }

  // Include repair evidence uploaded by field worker
  if (Array.isArray(raw.evidence)) {
    raw.evidence.forEach((ev: any) => {
      evidenceList.push({
        id: ev.id,
        imageUrl: ev.imageUrl,
        stage: ev.stage,
        uploadedAt: ev.uploadedAt instanceof Date ? ev.uploadedAt.toISOString() : new Date(ev.uploadedAt).toISOString(),
      });
    });
  }

  const statusHistory: StatusHistoryItem[] = Array.isArray(raw.statusHistory)
    ? raw.statusHistory.map((sh: any) => ({
        id: sh.id,
        fromStatus: sh.fromStatus || undefined,
        toStatus: sh.toStatus,
        changedAt: sh.changedAt instanceof Date ? sh.changedAt.toISOString() : new Date(sh.changedAt).toISOString(),
        changedByUser: sh.changedByUser ? { name: sh.changedByUser.name } : undefined,
        notes: sh.notes || undefined,
      }))
    : [];

  const feedback: ComplaintFeedback | null = raw.feedback
    ? {
        id: raw.feedback.id,
        rating: raw.feedback.rating,
        comment: raw.feedback.comment || undefined,
        createdAt: raw.feedback.createdAt instanceof Date ? raw.feedback.createdAt.toISOString() : new Date(raw.feedback.createdAt).toISOString(),
      }
    : null;

  return {
    id: raw.id,
    ticketId: raw.ticketId,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    priority: raw.priority || 'MEDIUM',
    categoryId: raw.categoryId || undefined,
    category: raw.category
      ? {
          id: raw.category.id,
          name: raw.category.name,
          description: raw.category.description,
          departmentId: raw.category.departmentId,
          icon: DEFAULT_CATEGORIES.find((d) => d.id === raw.category.id)?.icon || 'FileText',
        }
      : null,
    originalCategoryId: raw.originalCategoryId || undefined,
    originalCategory: raw.originalCategoryId
      ? DEFAULT_CATEGORIES.find((d) => d.id === raw.originalCategoryId) || null
      : null,
    departmentId: raw.departmentId || undefined,
    department: raw.department ? { id: raw.department.id, name: raw.department.name } : null,
    aiRecommendedDepartmentId: raw.aiRecommendedDepartmentId || undefined,
    aiRecommendedDepartment: raw.aiRecommendedDepartment
      ? { id: raw.aiRecommendedDepartment.id, name: raw.aiRecommendedDepartment.name }
      : null,
    location: raw.location
      ? {
          latitude: raw.location.latitude,
          longitude: raw.location.longitude,
          address: raw.location.address || undefined,
        }
      : null,
    evidence: evidenceList,
    statusHistory,
    feedback,
    citizenId: raw.citizenId,
    citizenName: raw.citizen?.name || 'Citizen User',
    citizenMobile: raw.citizen?.mobileNumber || undefined,
    assignedFieldWorkerId: raw.assignedFieldWorkerId || null,
    assignedFieldWorker: raw.assignedFieldWorker
      ? { id: raw.assignedFieldWorker.id, name: raw.assignedFieldWorker.name }
      : null,
    readyForReview: Boolean(raw.readyForReview),
    fieldWorkerRemarks: raw.fieldWorkerRemarks || undefined,
    isVoiceInput: Boolean(raw.isVoiceInput),
    voiceTranscript: raw.voiceTranscript || undefined,
    reopenCount: raw.reopenCount || 0,
    reopenedAt: raw.reopenedAt ? (raw.reopenedAt instanceof Date ? raw.reopenedAt.toISOString() : new Date(raw.reopenedAt).toISOString()) : undefined,
    reopenReason: raw.reopenReason || undefined,
    resolutionNotes: raw.resolutionNotes || undefined,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : new Date(raw.createdAt).toISOString(),
    updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : new Date(raw.updatedAt).toISOString(),
    resolvedAt: raw.resolvedAt ? (raw.resolvedAt instanceof Date ? raw.resolvedAt.toISOString() : new Date(raw.resolvedAt).toISOString()) : undefined,
    closedAt: raw.closedAt ? (raw.closedAt instanceof Date ? raw.closedAt.toISOString() : new Date(raw.closedAt).toISOString()) : undefined,
    aiPrediction: raw.aiPrediction
      ? {
          rawResponse: raw.aiPrediction.rawResponse as any,
        }
      : {
          rawResponse: {
            recommendation: `Automated AI Triage assigned issue. Priority evaluated as ${raw.priority || 'MEDIUM'}.`,
            statusMessage: 'AI Triage completed successfully.',
          },
        },
  };
}

// -----------------------------------------------------------------------------
// DUPLICATE DETECTION
// -----------------------------------------------------------------------------

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const tokenize = (str: string) =>
    new Set(
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const set1 = tokenize(text1);
  const set2 = tokenize(text2);
  if (set1.size === 0 || set2.size === 0) return 0;
  let intersection = 0;
  set1.forEach((val) => {
    if (set2.has(val)) intersection++;
  });
  const union = new Set([...Array.from(set1), ...Array.from(set2)]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function checkDuplicateComplaints(input: {
  title: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ matched: boolean; potentialDuplicates: PotentialDuplicate[] }> {
  const potentialDuplicates: PotentialDuplicate[] = [];
  const activeComplaints = await prisma.complaint.findMany({
    where: {
      status: { notIn: [ComplaintStatus.CLOSED, ComplaintStatus.REJECTED, ComplaintStatus.RESOLVED] },
    },
    include: { location: true },
  });

  for (const comp of activeComplaints) {
    const textSim = calculateTextSimilarity(
      `${input.title} ${input.description}`,
      `${comp.title} ${comp.description}`,
    );

    let geoDistanceKm: number | null = null;
    if (
      input.latitude &&
      input.longitude &&
      comp.location?.latitude &&
      comp.location?.longitude
    ) {
      geoDistanceKm = calculateHaversineDistanceKm(
        input.latitude,
        input.longitude,
        comp.location.latitude,
        comp.location.longitude,
      );
    }

    const isGeoNear = geoDistanceKm !== null && geoDistanceKm <= 0.5;
    let score = 0;

    if (isGeoNear && textSim >= 0.2) {
      score = Math.min(0.95, textSim + 0.4);
    } else if (textSim >= 0.5) {
      score = textSim;
    }

    if (score >= 0.4) {
      potentialDuplicates.push({
        id: comp.id,
        ticketId: comp.ticketId,
        title: comp.title,
        description: comp.description,
        address: comp.location?.address ?? undefined,
        similarityScore: Math.round(score * 100) / 100,
        createdAt: comp.createdAt.toISOString(),
      });
    }
  }

  potentialDuplicates.sort((a, b) => b.similarityScore - a.similarityScore);

  return {
    matched: potentialDuplicates.length > 0,
    potentialDuplicates: potentialDuplicates.slice(0, 3),
  };
}

// -----------------------------------------------------------------------------
// CREATE COMPLAINT
// -----------------------------------------------------------------------------

export async function createComplaint(data: {
  title: string;
  description: string;
  categoryId?: string;
  location?: ComplaintLocation;
  citizenId: string;
  citizenName?: string;
  citizenMobile?: string;
  isVoiceInput?: boolean;
  voiceTranscript?: string;
}): Promise<Complaint> {
  const ticketId = generateTicketId();

  let categoryId = data.categoryId;
  if (!categoryId) {
    const text = (data.title + ' ' + data.description).toLowerCase();
    if (text.includes('garbage') || text.includes('waste') || text.includes('clean') || text.includes('trash')) {
      categoryId = 'cat-sanitation';
    } else if (text.includes('road') || text.includes('pothole') || text.includes('path') || text.includes('bridge')) {
      categoryId = 'cat-roads';
    } else if (text.includes('water') || text.includes('leak') || text.includes('sewer') || text.includes('drain')) {
      categoryId = 'cat-water';
    } else if (text.includes('light') || text.includes('wire') || text.includes('electric') || text.includes('power')) {
      categoryId = 'cat-electricity';
    } else {
      categoryId = 'cat-sanitation';
    }
  }

  // Ensure category exists
  const targetCategory = await prisma.category.findUnique({ where: { id: categoryId } });
  const finalCategoryId = targetCategory ? targetCategory.id : (await prisma.category.findFirst())?.id || null;

  // AI Priority Heuristic
  const descLower = data.description.toLowerCase();
  let priority: PriorityLevel = PriorityLevel.MEDIUM;
  if (descLower.includes('danger') || descLower.includes('hazard') || descLower.includes('emergency') || descLower.includes('fire')) {
    priority = PriorityLevel.CRITICAL;
  } else if (descLower.includes('severe') || descLower.includes('urgent') || descLower.includes('block')) {
    priority = PriorityLevel.HIGH;
  }

  // Ensure citizen user exists
  let citizen = await prisma.user.findUnique({ where: { id: data.citizenId } });
  if (!citizen) {
    citizen = await prisma.user.create({
      data: {
        id: data.citizenId,
        name: data.citizenName || 'Citizen User',
        mobileNumber: data.citizenMobile || undefined,
        role: UserRole.CITIZEN,
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
      },
    });
  }

  const created = await prisma.complaint.create({
    data: {
      ticketId,
      title: data.title,
      description: data.description,
      status: ComplaintStatus.SUBMITTED,
      priority,
      citizenId: citizen.id,
      categoryId: finalCategoryId,
      originalCategoryId: finalCategoryId,
      departmentId: targetCategory?.departmentId || undefined,
      isVoiceInput: Boolean(data.isVoiceInput),
      voiceTranscript: data.voiceTranscript || undefined,
      location: data.location
        ? {
            create: {
              latitude: data.location.latitude,
              longitude: data.location.longitude,
              address: data.location.address || undefined,
            },
          }
        : undefined,
      statusHistory: {
        create: {
          toStatus: ComplaintStatus.SUBMITTED,
          changedByUserId: citizen.id,
        },
      },
      aiPrediction: {
        create: {
          suggestedCategoryId: finalCategoryId || undefined,
          suggestedDepartmentId: targetCategory?.departmentId || undefined,
          suggestedPriority: priority,
          confidenceScore: 0.92,
          rawResponse: {
            recommendation: `Automated AI Triage assigned issue. Priority evaluated as ${priority}.`,
            statusMessage: 'AI Triage completed successfully.',
          },
        },
      },
    },
    include: DEFAULT_INCLUDE,
  });

  return formatComplaint(created);
}

export async function getComplaintById(id: string): Promise<Complaint | null> {
  const raw = await prisma.complaint.findFirst({
    where: {
      OR: [{ id }, { ticketId: id }],
    },
    include: DEFAULT_INCLUDE,
  });

  return raw ? formatComplaint(raw) : null;
}

// -----------------------------------------------------------------------------
// LIST COMPLAINTS
// -----------------------------------------------------------------------------

export async function listComplaints(filters?: {
  citizenId?: string;
  status?: string;
  categoryId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Complaint[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
  const where: any = {};

  if (filters?.citizenId) {
    where.citizenId = filters.citizenId;
  }

  if (filters?.status && filters.status !== 'ALL') {
    where.status = filters.status as ComplaintStatus;
  }

  if (filters?.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters?.search) {
    const q = filters.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { ticketId: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (filters?.fromDate || filters?.toDate) {
    where.createdAt = {};
    if (filters.fromDate) {
      where.createdAt.gte = new Date(filters.fromDate);
    }
    if (filters.toDate) {
      where.createdAt.lte = new Date(new Date(filters.toDate).setHours(23, 59, 59, 999));
    }
  }

  const page = filters?.page || 1;
  const limit = filters?.limit || 10;
  const skip = (page - 1) * limit;

  const [total, rawList] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      include: DEFAULT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: rawList.map(formatComplaint),
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

export async function addEvidenceToComplaint(
  complaintId: string,
  evidenceData: { imageUrl: string; stage?: 'BEFORE' | 'DURING' | 'AFTER' },
): Promise<ComplaintEvidence | null> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) return null;

  const newEv = await prisma.evidence.create({
    data: {
      complaintId: complaint.id,
      stage: (evidenceData.stage as EvidenceStage) || EvidenceStage.BEFORE,
      imageUrl: evidenceData.imageUrl,
      uploadedByUserId: complaint.citizenId,
    },
  });

  return {
    id: newEv.id,
    imageUrl: newEv.imageUrl,
    stage: newEv.stage,
    uploadedAt: newEv.uploadedAt.toISOString(),
  };
}

// -----------------------------------------------------------------------------
// POST-RESOLUTION ACTIONS
// -----------------------------------------------------------------------------

export async function markComplaintSatisfactory(
  id: string,
  citizenId: string,
): Promise<{ ok: boolean; status: number; message: string; complaint?: Complaint }> {
  const complaint = await getComplaintById(id);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.citizenId !== citizenId) {
    return { ok: false, status: 403, message: 'Forbidden: You do not own this complaint.' };
  }

  if (complaint.status !== 'RESOLVED') {
    return { ok: false, status: 400, message: 'Only RESOLVED complaints can be marked satisfactory.' };
  }

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      status: ComplaintStatus.CLOSED,
      closedAt: new Date(),
      statusHistory: {
        create: {
          fromStatus: ComplaintStatus.RESOLVED,
          toStatus: ComplaintStatus.CLOSED,
          changedByUserId: citizenId,
          notes: 'Citizen confirmed resolution is satisfactory.',
        },
      },
    },
    include: DEFAULT_INCLUDE,
  });

  return { ok: true, status: 200, message: 'Complaint closed successfully.', complaint: formatComplaint(updated) };
}

export async function reopenComplaint(
  id: string,
  citizenId: string,
  reason: string,
): Promise<{ ok: boolean; status: number; message: string; complaint?: Complaint }> {
  const complaint = await getComplaintById(id);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.citizenId !== citizenId) {
    return { ok: false, status: 403, message: 'Forbidden: You do not own this complaint.' };
  }

  if (complaint.status !== 'RESOLVED') {
    return { ok: false, status: 400, message: 'Only RESOLVED complaints can be reopened.' };
  }

  if (!reason || reason.trim().length < 10) {
    return { ok: false, status: 400, message: 'A detailed reason (min 10 characters) is required to reopen.' };
  }

  const nextStatus = complaint.departmentId ? ComplaintStatus.IN_PROGRESS : ComplaintStatus.PENDING_DEPT_REVIEW;

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      status: nextStatus,
      reopenCount: { increment: 1 },
      reopenedAt: new Date(),
      reopenReason: reason.trim(),
      statusHistory: {
        create: {
          fromStatus: ComplaintStatus.RESOLVED,
          toStatus: nextStatus,
          changedByUserId: citizenId,
          notes: `Citizen disputed resolution: "${reason.trim()}"`,
        },
      },
    },
    include: DEFAULT_INCLUDE,
  });

  return { ok: true, status: 200, message: 'Complaint reopened successfully.', complaint: formatComplaint(updated) };
}

export async function addFeedbackToComplaint(
  id: string,
  citizenId: string,
  rating: number,
  comment?: string,
): Promise<{ ok: boolean; status: number; message: string; feedback?: ComplaintFeedback }> {
  const complaint = await getComplaintById(id);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.citizenId !== citizenId) {
    return { ok: false, status: 403, message: 'Forbidden: You do not own this complaint.' };
  }

  if (!['RESOLVED', 'CLOSED'].includes(complaint.status)) {
    return { ok: false, status: 400, message: 'Feedback can only be submitted for RESOLVED or CLOSED complaints.' };
  }

  if (complaint.feedback) {
    return { ok: false, status: 409, message: 'Feedback has already been submitted for this complaint.' };
  }

  if (!rating || rating < 1 || rating > 5) {
    return { ok: false, status: 400, message: 'Rating must be an integer between 1 and 5.' };
  }

  const created = await prisma.feedback.create({
    data: {
      complaintId: complaint.id,
      citizenId,
      rating: Math.round(rating),
      comment: comment?.trim() || undefined,
    },
  });

  return {
    ok: true,
    status: 200,
    message: 'Feedback submitted successfully.',
    feedback: {
      id: created.id,
      rating: created.rating,
      comment: created.comment || undefined,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

// -----------------------------------------------------------------------------
// FIELD WORKER STORE FUNCTIONS
// -----------------------------------------------------------------------------

export async function listFieldWorkerComplaints(params: {
  fieldWorkerId: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: Complaint[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const { fieldWorkerId, status, page = 1, limit = 10 } = params;

  const where: any = {
    assignedFieldWorkerId: fieldWorkerId,
  };

  if (status) {
    if (status === 'ACTIVE') {
      where.status = { in: [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS] };
    } else {
      where.status = status as ComplaintStatus;
    }
  }

  const skip = (page - 1) * limit;

  const [total, rawList] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where,
      include: DEFAULT_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: rawList.map(formatComplaint),
    meta: { total, page, limit, totalPages },
  };
}

export async function startFieldWorkerTask(
  complaintId: string,
  fieldWorkerId: string,
): Promise<{ ok: boolean; status: number; message: string; complaint?: Complaint }> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.assignedFieldWorkerId !== fieldWorkerId) {
    return { ok: false, status: 403, message: 'Forbidden: Ticket not assigned to this field worker.' };
  }

  if (complaint.status !== 'ASSIGNED') {
    return {
      ok: false,
      status: 400,
      message: `Cannot start work: ticket status is currently ${complaint.status}. Expected ASSIGNED.`,
    };
  }

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      status: ComplaintStatus.IN_PROGRESS,
      statusHistory: {
        create: {
          fromStatus: ComplaintStatus.ASSIGNED,
          toStatus: ComplaintStatus.IN_PROGRESS,
          changedByUserId: fieldWorkerId,
          notes: 'Field worker initiated repair work on site.',
        },
      },
    },
    include: DEFAULT_INCLUDE,
  });

  return { ok: true, status: 200, message: 'Work started successfully.', complaint: formatComplaint(updated) };
}

export async function addFieldWorkerEvidenceToComplaint(
  complaintId: string,
  fieldWorkerId: string,
  stage: 'BEFORE' | 'DURING' | 'AFTER',
  imageUrl: string,
  notes?: string,
): Promise<{ ok: boolean; status: number; message: string; evidence?: ComplaintEvidence }> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.assignedFieldWorkerId !== fieldWorkerId) {
    return { ok: false, status: 403, message: 'Forbidden: Ticket not assigned to this field worker.' };
  }

  if (!imageUrl || !imageUrl.trim()) {
    return { ok: false, status: 400, message: 'Image URL is required.' };
  }

  if (stage === 'AFTER') {
    const hasBeforePhoto = complaint.evidence.some((e) => e.stage === 'BEFORE');
    if (!hasBeforePhoto) {
      return {
        ok: false,
        status: 400,
        message: 'Sequence Violation: At least one BEFORE repair photo must be uploaded prior to uploading AFTER photos.',
      };
    }
  }

  const newEv = await prisma.evidence.create({
    data: {
      complaintId: complaint.id,
      stage: stage as EvidenceStage,
      imageUrl: imageUrl.trim(),
      uploadedByUserId: fieldWorkerId,
      notes: notes || undefined,
    },
  });

  return {
    ok: true,
    status: 201,
    message: `${stage} photo evidence uploaded successfully.`,
    evidence: {
      id: newEv.id,
      imageUrl: newEv.imageUrl,
      stage: newEv.stage,
      uploadedAt: newEv.uploadedAt.toISOString(),
    },
  };
}

export async function submitFieldWorkerForReview(
  complaintId: string,
  fieldWorkerId: string,
  remarks: string,
): Promise<{ ok: boolean; status: number; message: string; complaint?: Complaint }> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.assignedFieldWorkerId !== fieldWorkerId) {
    return { ok: false, status: 403, message: 'Forbidden: Ticket not assigned to this field worker.' };
  }

  if (!remarks || remarks.trim().length < 5) {
    return { ok: false, status: 400, message: 'Completion remarks (min 5 characters) are required.' };
  }

  const hasBefore = complaint.evidence.some((e) => e.stage === 'BEFORE');
  const hasAfter = complaint.evidence.some((e) => e.stage === 'AFTER');

  if (!hasBefore || !hasAfter) {
    return {
      ok: false,
      status: 400,
      message: 'Evidence Violation: Both BEFORE and AFTER repair photos are required before submitting work for officer review.',
    };
  }

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      readyForReview: true,
      fieldWorkerRemarks: remarks.trim(),
      statusHistory: {
        create: {
          fromStatus: complaint.status as ComplaintStatus,
          toStatus: complaint.status as ComplaintStatus,
          changedByUserId: fieldWorkerId,
          notes: `Field worker submitted work for review: "${remarks.trim()}"`,
        },
      },
    },
    include: DEFAULT_INCLUDE,
  });

  return { ok: true, status: 200, message: 'Work submitted for officer review successfully.', complaint: formatComplaint(updated) };
}

export async function assignFieldWorkerToComplaint(
  complaintId: string,
  fieldWorkerId: string,
  fieldWorkerName: string,
  officerUserId: string,
): Promise<{ ok: boolean; status: number; message: string; complaint?: Complaint }> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  const prevStatus = complaint.status;

  const updated = await prisma.complaint.update({
    where: { id: complaint.id },
    data: {
      assignedFieldWorkerId: fieldWorkerId,
      status: ComplaintStatus.ASSIGNED,
      statusHistory: {
        create: {
          fromStatus: prevStatus as ComplaintStatus,
          toStatus: ComplaintStatus.ASSIGNED,
          changedByUserId: officerUserId,
          notes: `Assigned field worker ${fieldWorkerName} to carry out repair work on site.`,
        },
      },
    },
    include: DEFAULT_INCLUDE,
  });

  return { ok: true, status: 200, message: 'Field worker assigned successfully.', complaint: formatComplaint(updated) };
}
