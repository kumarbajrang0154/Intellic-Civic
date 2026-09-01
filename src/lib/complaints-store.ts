export interface ComplaintCategory {
  id: string;
  name: string;
  description?: string;
  departmentId?: string;
}

export interface ComplaintLocation {
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface ComplaintEvidence {
  id: string;
  imageUrl: string;
  stage: 'BEFORE' | 'DURING' | 'AFTER';
  uploadedAt: string;
}

export interface StatusHistoryItem {
  id: string;
  fromStatus?: string;
  toStatus: string;
  changedAt: string;
  changedByUser?: { name: string };
}

export interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status:
    | 'SUBMITTED'
    | 'AI_PROCESSING'
    | 'PENDING_DEPT_REVIEW'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'RESOLVED'
    | 'CLOSED'
    | 'REJECTED'
    | 'DUPLICATE';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  categoryId?: string;
  category?: ComplaintCategory | null;
  departmentId?: string;
  department?: { id: string; name: string } | null;
  location?: ComplaintLocation | null;
  evidence: ComplaintEvidence[];
  statusHistory: StatusHistoryItem[];
  citizenId: string;
  citizenName?: string;
  citizenMobile?: string;
  createdAt: string;
  updatedAt: string;
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
    name: 'Sanitation & Waste Management',
    description: 'Uncollected garbage, overflow bins, public littering',
    departmentId: 'dept-sanitation',
  },
  {
    id: 'cat-roads',
    name: 'Roads & Infrastructure',
    description: 'Potholes, broken asphalt, damaged footpaths, open manholes',
    departmentId: 'dept-roads',
  },
  {
    id: 'cat-water',
    name: 'Water Supply & Sewerage',
    description: 'Water pipe leaks, low pressure, dirty water, sewer overflow',
    departmentId: 'dept-water',
  },
  {
    id: 'cat-electricity',
    name: 'Electricity & Street Lighting',
    description: 'Faulty streetlights, hanging wires, transformer sparks',
    departmentId: 'dept-electrical',
  },
  {
    id: 'cat-health',
    name: 'Public Health & Stray Animals',
    description: 'Stagnant water breeding mosquitoes, stray animal control',
    departmentId: 'dept-health',
  },
  {
    id: 'cat-safety',
    name: 'Traffic & Public Safety',
    description: 'Broken traffic signals, illegal parking, hazard barriers',
    departmentId: 'dept-traffic',
  },
];

const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'cmp-sample-1',
    ticketId: 'INC-2026-0901-1001',
    title: 'Severe pothole causing traffic congestion near Central Metro',
    description: 'A deep 2-foot pothole has opened up on Main Arterial Road near Metro Gate 3. Vehicles are swerving into oncoming traffic to avoid it, causing hazards.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    categoryId: 'cat-roads',
    category: DEFAULT_CATEGORIES[1],
    department: { id: 'dept-roads', name: 'Roads & Infrastructure Department' },
    location: {
      address: 'Main Arterial Road, Near Central Metro Gate 3',
      latitude: 28.6139,
      longitude: 77.209,
    },
    evidence: [
      {
        id: 'ev-1',
        imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600',
        stage: 'BEFORE',
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    statusHistory: [
      {
        id: 'sh-1',
        toStatus: 'SUBMITTED',
        changedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'sh-2',
        fromStatus: 'SUBMITTED',
        toStatus: 'ASSIGNED',
        changedAt: new Date(Date.now() - 43200000).toISOString(),
        changedByUser: { name: 'Super Admin' },
      },
      {
        id: 'sh-3',
        fromStatus: 'ASSIGNED',
        toStatus: 'IN_PROGRESS',
        changedAt: new Date(Date.now() - 21600000).toISOString(),
        changedByUser: { name: 'Officer Sharma' },
      },
    ],
    citizenId: 'citizen_demo',
    citizenName: 'Sample Citizen',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 21600000).toISOString(),
    aiPrediction: {
      rawResponse: {
        recommendation: 'Categorized under Roads & Infrastructure. High priority due to traffic safety hazard.',
        statusMessage: 'AI Triage completed. Assigned to Roads Department.',
      },
    },
  },
];

const globalForComplaints = global as unknown as {
  complaintsStore: Complaint[];
  categoriesStore: ComplaintCategory[];
};

export const complaintsStore: Complaint[] =
  globalForComplaints.complaintsStore || [...INITIAL_COMPLAINTS];

export const categoriesStore: ComplaintCategory[] =
  globalForComplaints.categoriesStore || [...DEFAULT_CATEGORIES];

if (process.env.NODE_ENV !== 'production') {
  globalForComplaints.complaintsStore = complaintsStore;
  globalForComplaints.categoriesStore = categoriesStore;
}

export function generateTicketId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `INC-${dateStr}-${randomNum}`;
}

export function createComplaint(data: {
  title: string;
  description: string;
  categoryId?: string;
  location?: ComplaintLocation;
  citizenId: string;
  citizenName?: string;
  citizenMobile?: string;
}): Complaint {
  const id = `cmp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const ticketId = generateTicketId();

  // Determine category
  let category: ComplaintCategory | null = null;
  if (data.categoryId) {
    category = categoriesStore.find((c) => c.id === data.categoryId) || null;
  }

  // Gemini AI Auto Triage Rule (Fallback heuristic if category omitted)
  if (!category) {
    const text = (data.title + ' ' + data.description).toLowerCase();
    if (text.includes('garbage') || text.includes('waste') || text.includes('clean') || text.includes('trash')) {
      category = categoriesStore.find((c) => c.id === 'cat-sanitation') || DEFAULT_CATEGORIES[0];
    } else if (text.includes('road') || text.includes('pothole') || text.includes('path') || text.includes('bridge')) {
      category = categoriesStore.find((c) => c.id === 'cat-roads') || DEFAULT_CATEGORIES[1];
    } else if (text.includes('water') || text.includes('leak') || text.includes('sewer') || text.includes('drain')) {
      category = categoriesStore.find((c) => c.id === 'cat-water') || DEFAULT_CATEGORIES[2];
    } else if (text.includes('light') || text.includes('wire') || text.includes('electric') || text.includes('power')) {
      category = categoriesStore.find((c) => c.id === 'cat-electricity') || DEFAULT_CATEGORIES[3];
    } else {
      category = DEFAULT_CATEGORIES[0];
    }
  }

  // AI Priority Heuristic
  const descLower = data.description.toLowerCase();
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  if (descLower.includes('danger') || descLower.includes('hazard') || descLower.includes('emergency') || descLower.includes('fire')) {
    priority = 'CRITICAL';
  } else if (descLower.includes('severe') || descLower.includes('urgent') || descLower.includes('block')) {
    priority = 'HIGH';
  }

  const now = new Date().toISOString();

  const newComplaint: Complaint = {
    id,
    ticketId,
    title: data.title,
    description: data.description,
    status: 'SUBMITTED',
    priority,
    categoryId: category?.id,
    category,
    location: data.location || null,
    evidence: [],
    statusHistory: [
      {
        id: `sh-${Date.now()}`,
        toStatus: 'SUBMITTED',
        changedAt: now,
      },
    ],
    citizenId: data.citizenId,
    citizenName: data.citizenName || 'Citizen User',
    citizenMobile: data.citizenMobile,
    createdAt: now,
    updatedAt: now,
    aiPrediction: {
      rawResponse: {
        recommendation: `Automated AI Triage assigned issue to ${category?.name || 'Municipal Services'}. Priority evaluated as ${priority}.`,
        statusMessage: 'AI Triage completed successfully.',
      },
    },
  };

  complaintsStore.unshift(newComplaint);
  return newComplaint;
}

export function getComplaintById(id: string): Complaint | null {
  return complaintsStore.find((c) => c.id === id || c.ticketId === id) || null;
}

export function listComplaints(filters?: {
  citizenId?: string;
  status?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}): { data: Complaint[]; meta: { total: number; page: number; limit: number; totalPages: number } } {
  let list = [...complaintsStore];

  if (filters?.citizenId) {
    list = list.filter((c) => c.citizenId === filters.citizenId);
  }

  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((c) => c.status === filters.status);
  }

  if (filters?.categoryId) {
    list = list.filter((c) => c.categoryId === filters.categoryId);
  }

  const page = filters?.page || 1;
  const limit = filters?.limit || 10;
  const total = list.length;
  const totalPages = Math.ceil(total / limit) || 1;

  const start = (page - 1) * limit;
  const paginatedData = list.slice(start, start + limit);

  return {
    data: paginatedData,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

export function addEvidenceToComplaint(
  complaintId: string,
  evidenceData: { imageUrl: string; stage?: 'BEFORE' | 'DURING' | 'AFTER' },
): ComplaintEvidence | null {
  const complaint = getComplaintById(complaintId);
  if (!complaint) return null;

  const newEv: ComplaintEvidence = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    imageUrl: evidenceData.imageUrl,
    stage: evidenceData.stage || 'BEFORE',
    uploadedAt: new Date().toISOString(),
  };

  complaint.evidence.push(newEv);
  complaint.updatedAt = new Date().toISOString();
  return newEv;
}
