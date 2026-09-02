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
  originalCategoryId?: string;
  originalCategory?: ComplaintCategory | null;
  departmentId?: string;
  department?: { id: string; name: string } | null;
  location?: ComplaintLocation | null;
  evidence: ComplaintEvidence[];
  statusHistory: StatusHistoryItem[];
  citizenId: string;
  citizenName?: string;
  citizenMobile?: string;
  isVoiceInput?: boolean;
  voiceTranscript?: string;
  reopenCount?: number;
  reopenedAt?: string;
  reopenReason?: string;
  resolutionNotes?: string;
  feedback?: ComplaintFeedback;
  assignedFieldWorkerId?: string;
  assignedFieldWorker?: { id: string; name: string; email?: string; mobileNumber?: string } | null;
  readyForReview?: boolean;
  fieldWorkerRemarks?: string;
  assignedAt?: string;
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
    originalCategoryId: 'cat-roads',
    originalCategory: DEFAULT_CATEGORIES[1],
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
    citizenId: 'citizen_9876543210',
    citizenName: 'Bajrang Kumar',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 21600000).toISOString(),
    aiPrediction: {
      rawResponse: {
        recommendation: 'Categorized under Roads & Infrastructure. High priority due to traffic safety hazard.',
        statusMessage: 'AI Triage completed. Assigned to Roads Department.',
      },
    },
  },
  {
    id: 'cmp-resolved-demo',
    ticketId: 'INC-2026-0902-8821',
    title: 'Water Pipe Leakage Fixed on Sector 14 Main Road',
    description: 'Clean drinking water was overflowing onto the footpath near Civic Hospital entrance.',
    status: 'RESOLVED',
    priority: 'MEDIUM',
    categoryId: 'cat-water',
    category: DEFAULT_CATEGORIES[2],
    originalCategoryId: 'cat-water',
    originalCategory: DEFAULT_CATEGORIES[2],
    department: { id: 'dept-water', name: 'Water Supply & Sewerage Department' },
    location: { address: 'Sector 14 Main Road, near Civic Hospital', latitude: 28.614, longitude: 77.21 },
    evidence: [],
    statusHistory: [
      { id: 'sh-res-1', toStatus: 'SUBMITTED', changedAt: new Date(Date.now() - 172800000).toISOString() },
      { id: 'sh-res-2', fromStatus: 'SUBMITTED', toStatus: 'RESOLVED', changedAt: new Date(Date.now() - 3600000).toISOString(), changedByUser: { name: 'Officer Verma' }, notes: 'Pipe patch repaired and pressure tested.' },
    ],
    citizenId: 'citizen_9876543210',
    citizenName: 'Bajrang Kumar',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'cmp-rejected-demo',
    ticketId: 'INC-2026-0902-9904',
    title: 'Garbage Dumped in Private Residential Compound',
    description: 'Requesting municipal staff to clean garbage dumped inside private building courtyard.',
    status: 'REJECTED',
    priority: 'LOW',
    categoryId: 'cat-sanitation',
    category: DEFAULT_CATEGORIES[0],
    originalCategoryId: 'cat-roads',
    originalCategory: DEFAULT_CATEGORIES[1],
    department: { id: 'dept-sanitation', name: 'Sanitation & Waste Management Department' },
    location: { address: 'Plot 42, Private Colony, Sector 14', latitude: 28.615, longitude: 77.211 },
    evidence: [],
    statusHistory: [
      { id: 'sh-rej-1', toStatus: 'SUBMITTED', changedAt: new Date(Date.now() - 259200000).toISOString() },
      { id: 'sh-rej-2', fromStatus: 'SUBMITTED', toStatus: 'REJECTED', changedAt: new Date(Date.now() - 86400000).toISOString(), changedByUser: { name: 'Dept Head Sharma' }, notes: 'Municipal sanitation services only cover public property. Private courtyard maintenance is the responsibility of the building society.' },
    ],
    resolutionNotes: 'Municipal sanitation services cover public roads and municipal bins only. Private residential property cleanup must be handled by private management.',
    citizenId: 'citizen_9876543210',
    citizenName: 'Bajrang Kumar',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'cmp-field-assigned',
    ticketId: 'INC-2026-0902-7711',
    title: 'Broken Traffic Light Wiring at Ring Road Crossing',
    description: 'Traffic signal control box door damaged. Wires exposed causing traffic light disruption.',
    status: 'ASSIGNED',
    priority: 'HIGH',
    categoryId: 'cat-safety',
    category: DEFAULT_CATEGORIES[3],
    department: { id: 'dept-traffic', name: 'Traffic & Public Safety Department' },
    location: { address: 'Ring Road Crossing, Near Gate 4', latitude: 28.616, longitude: 77.212 },
    evidence: [
      { id: 'ev-fw-1', imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600', stage: 'BEFORE', uploadedAt: new Date(Date.now() - 43200000).toISOString() }
    ],
    statusHistory: [
      { id: 'sh-fw-1', toStatus: 'SUBMITTED', changedAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'sh-fw-2', fromStatus: 'SUBMITTED', toStatus: 'ASSIGNED', changedAt: new Date(Date.now() - 43200000).toISOString(), changedByUser: { name: 'Officer Sharma' } }
    ],
    assignedFieldWorkerId: 'fw-demo-1',
    assignedFieldWorker: { id: 'fw-demo-1', name: 'Ramesh Kumar' },
    citizenId: 'citizen_9876543210',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'cmp-field-review-ready',
    ticketId: 'INC-2026-0902-7722',
    title: 'Severe Asphalt Pothole Repair on Central Flyover',
    description: 'Large 3-foot pothole on northbound lane repaired by field crew with cold-mix asphalt.',
    status: 'IN_PROGRESS',
    priority: 'CRITICAL',
    categoryId: 'cat-roads',
    category: DEFAULT_CATEGORIES[1],
    department: { id: 'dept-roads', name: 'Roads & Infrastructure Department' },
    location: { address: 'Central Flyover Northbound Lane', latitude: 28.617, longitude: 77.213 },
    evidence: [
      { id: 'ev-fw-b1', imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600', stage: 'BEFORE', uploadedAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'ev-fw-a1', imageUrl: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600', stage: 'AFTER', uploadedAt: new Date(Date.now() - 7200000).toISOString() }
    ],
    statusHistory: [
      { id: 'sh-fw-r1', toStatus: 'SUBMITTED', changedAt: new Date(Date.now() - 172800000).toISOString() },
      { id: 'sh-fw-r2', fromStatus: 'SUBMITTED', toStatus: 'IN_PROGRESS', changedAt: new Date(Date.now() - 86400000).toISOString(), changedByUser: { name: 'Officer Sharma' } }
    ],
    assignedFieldWorkerId: 'fw-demo-1',
    assignedFieldWorker: { id: 'fw-demo-1', name: 'Ramesh Kumar' },
    readyForReview: true,
    fieldWorkerRemarks: 'Pothole patch sealed with cold-mix asphalt and steam roller compacted. Traffic lane reopened safely.',
    citizenId: 'citizen_9876543210',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
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

// -----------------------------------------------------------------------------
// DUPLICATE DETECTION (Haversine distance + Jaccard text similarity)
// -----------------------------------------------------------------------------

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
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

export function checkDuplicateComplaints(input: {
  title: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
}): { matched: boolean; potentialDuplicates: PotentialDuplicate[] } {
  const potentialDuplicates: PotentialDuplicate[] = [];
  const activeComplaints = complaintsStore.filter(
    (c) => !['CLOSED', 'REJECTED', 'RESOLVED'].includes(c.status),
  );

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

    // Similarity threshold rules:
    // 1) Text similarity >= 0.35 AND GPS distance <= 0.5 km (500 meters)
    // 2) OR High text similarity >= 0.65 anywhere
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
        createdAt: comp.createdAt,
      });
    }
  }

  // Sort by highest similarity score
  potentialDuplicates.sort((a, b) => b.similarityScore - a.similarityScore);

  return {
    matched: potentialDuplicates.length > 0,
    potentialDuplicates: potentialDuplicates.slice(0, 3), // Return top 3 matches
  };
}

// -----------------------------------------------------------------------------
// CREATE COMPLAINT
// -----------------------------------------------------------------------------

export function createComplaint(data: {
  title: string;
  description: string;
  categoryId?: string;
  location?: ComplaintLocation;
  citizenId: string;
  citizenName?: string;
  citizenMobile?: string;
  isVoiceInput?: boolean;
  voiceTranscript?: string;
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
    originalCategoryId: data.categoryId || category?.id,
    originalCategory: category,
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
    isVoiceInput: Boolean(data.isVoiceInput),
    voiceTranscript: data.voiceTranscript || undefined,
    reopenCount: 0,
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

// -----------------------------------------------------------------------------
// LIST COMPLAINTS (with Search + Date Range Filters)
// -----------------------------------------------------------------------------

export function listComplaints(filters?: {
  citizenId?: string;
  status?: string;
  categoryId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
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

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.ticketId.toLowerCase().includes(q),
    );
  }

  if (filters?.fromDate) {
    const fromTime = new Date(filters.fromDate).getTime();
    if (!isNaN(fromTime)) {
      list = list.filter((c) => new Date(c.createdAt).getTime() >= fromTime);
    }
  }

  if (filters?.toDate) {
    // End of selected day
    const toTime = new Date(filters.toDate).setHours(23, 59, 59, 999);
    if (!isNaN(toTime)) {
      list = list.filter((c) => new Date(c.createdAt).getTime() <= toTime);
    }
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

// -----------------------------------------------------------------------------
// POST-RESOLUTION ACTIONS (Mark Satisfactory, Reopen, Feedback)
// -----------------------------------------------------------------------------

export function markComplaintSatisfactory(
  id: string,
  citizenId: string,
): { ok: boolean; status: number; message: string; complaint?: Complaint } {
  const complaint = getComplaintById(id);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.citizenId !== citizenId) {
    return { ok: false, status: 403, message: 'Forbidden: You do not own this complaint.' };
  }

  if (complaint.status !== 'RESOLVED') {
    return { ok: false, status: 400, message: 'Only RESOLVED complaints can be marked satisfactory.' };
  }

  const now = new Date().toISOString();
  complaint.status = 'CLOSED';
  complaint.updatedAt = now;

  complaint.statusHistory.push({
    id: `sh-${Date.now()}`,
    fromStatus: 'RESOLVED',
    toStatus: 'CLOSED',
    changedAt: now,
    changedByUser: { name: 'Citizen (Satisfactory Resolution)' },
    notes: 'Citizen confirmed resolution is satisfactory.',
  });

  return { ok: true, status: 200, message: 'Complaint closed successfully.', complaint };
}

export function reopenComplaint(
  id: string,
  citizenId: string,
  reason: string,
): { ok: boolean; status: number; message: string; complaint?: Complaint } {
  const complaint = getComplaintById(id);
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

  const now = new Date().toISOString();
  const nextStatus = complaint.department ? 'IN_PROGRESS' : 'PENDING_DEPT_REVIEW';

  complaint.status = nextStatus;
  complaint.reopenCount = (complaint.reopenCount || 0) + 1;
  complaint.reopenedAt = now;
  complaint.reopenReason = reason.trim();
  complaint.updatedAt = now;

  complaint.statusHistory.push({
    id: `sh-${Date.now()}`,
    fromStatus: 'RESOLVED',
    toStatus: nextStatus,
    changedAt: now,
    changedByUser: { name: 'Citizen (Reopened Ticket)' },
    notes: `Citizen disputed resolution: "${reason.trim()}"`,
  });

  return { ok: true, status: 200, message: 'Complaint reopened successfully.', complaint };
}

export function addFeedbackToComplaint(
  id: string,
  citizenId: string,
  rating: number,
  comment?: string,
): { ok: boolean; status: number; message: string; feedback?: ComplaintFeedback } {
  const complaint = getComplaintById(id);
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

  const newFeedback: ComplaintFeedback = {
    id: `fb-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    rating: Math.round(rating),
    comment: comment?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  complaint.feedback = newFeedback;
  complaint.updatedAt = new Date().toISOString();

  return { ok: true, status: 200, message: 'Feedback submitted successfully.', feedback: newFeedback };
}

// -----------------------------------------------------------------------------
// FIELD WORKER PORTAL STORE FUNCTIONS
// -----------------------------------------------------------------------------

export function listFieldWorkerComplaints(params: {
  fieldWorkerId: string;
  status?: string;
  page?: number;
  limit?: number;
}): {
  data: Complaint[];
  meta: { total: number; page: number; limit: number; totalPages: number };
} {
  const { fieldWorkerId, status, page = 1, limit = 10 } = params;

  let filtered = complaintsStore.filter(
    (c) => c.assignedFieldWorkerId === fieldWorkerId,
  );

  if (status) {
    if (status === 'ACTIVE') {
      filtered = filtered.filter((c) => ['ASSIGNED', 'IN_PROGRESS'].includes(c.status));
    } else {
      filtered = filtered.filter((c) => c.status === status);
    }
  }

  // Sort: ASSIGNED/IN_PROGRESS first, then newest created
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedData = filtered.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    meta: { total, page, limit, totalPages },
  };
}

export function startFieldWorkerTask(
  complaintId: string,
  fieldWorkerId: string,
): { ok: boolean; status: number; message: string; complaint?: Complaint } {
  const complaint = getComplaintById(complaintId);
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

  const now = new Date().toISOString();
  const prevStatus = complaint.status;
  complaint.status = 'IN_PROGRESS';
  complaint.updatedAt = now;

  complaint.statusHistory.push({
    id: `sh-${Date.now()}`,
    fromStatus: prevStatus,
    toStatus: 'IN_PROGRESS',
    changedAt: now,
    changedByUser: { name: 'Field Worker' },
    notes: 'Field worker initiated repair work on site.',
  });

  return { ok: true, status: 200, message: 'Work started successfully.', complaint };
}

export function addFieldWorkerEvidenceToComplaint(
  complaintId: string,
  fieldWorkerId: string,
  stage: 'BEFORE' | 'DURING' | 'AFTER',
  imageUrl: string,
  notes?: string,
): { ok: boolean; status: number; message: string; evidence?: ComplaintEvidence } {
  const complaint = getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.assignedFieldWorkerId !== fieldWorkerId) {
    return { ok: false, status: 403, message: 'Forbidden: Ticket not assigned to this field worker.' };
  }

  if (!imageUrl || !imageUrl.trim()) {
    return { ok: false, status: 400, message: 'Image URL is required.' };
  }

  // Sequence Guard: Cannot upload AFTER photo until at least one BEFORE photo exists
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

  const newEvidence: ComplaintEvidence = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    imageUrl: imageUrl.trim(),
    stage,
    uploadedAt: new Date().toISOString(),
  };

  complaint.evidence.push(newEvidence);
  complaint.updatedAt = new Date().toISOString();

  return { ok: true, status: 201, message: `${stage} photo evidence uploaded successfully.`, evidence: newEvidence };
}

export function submitFieldWorkerForReview(
  complaintId: string,
  fieldWorkerId: string,
  remarks: string,
): { ok: boolean; status: number; message: string; complaint?: Complaint } {
  const complaint = getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.assignedFieldWorkerId !== fieldWorkerId) {
    return { ok: false, status: 403, message: 'Forbidden: Ticket not assigned to this field worker.' };
  }

  if (!remarks || remarks.trim().length < 5) {
    return { ok: false, status: 400, message: 'Completion remarks (min 5 characters) are required.' };
  }

  // Guard: Require at least one BEFORE and one AFTER photo
  const hasBefore = complaint.evidence.some((e) => e.stage === 'BEFORE');
  const hasAfter = complaint.evidence.some((e) => e.stage === 'AFTER');

  if (!hasBefore || !hasAfter) {
    return {
      ok: false,
      status: 400,
      message: 'Evidence Violation: Both BEFORE and AFTER repair photos are required before submitting work for officer review.',
    };
  }

  const now = new Date().toISOString();
  complaint.readyForReview = true;
  complaint.fieldWorkerRemarks = remarks.trim();
  complaint.updatedAt = now;

  complaint.statusHistory.push({
    id: `sh-${Date.now()}`,
    fromStatus: complaint.status,
    toStatus: complaint.status,
    changedAt: now,
    changedByUser: { name: 'Field Worker' },
    notes: `Field worker submitted work for review: "${remarks.trim()}"`,
  });

  return { ok: true, status: 200, message: 'Work submitted for officer review successfully.', complaint };
}

export function assignFieldWorkerToComplaint(
  complaintId: string,
  fieldWorkerId: string,
  fieldWorkerName: string,
  officerUserId: string,
): { ok: boolean; status: number; message: string; complaint?: Complaint } {
  const complaint = getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  const now = new Date().toISOString();
  const prevStatus = complaint.status;
  complaint.assignedFieldWorkerId = fieldWorkerId;
  complaint.assignedFieldWorker = { id: fieldWorkerId, name: fieldWorkerName };
  complaint.status = 'ASSIGNED';
  complaint.assignedAt = now;
  complaint.updatedAt = now;

  complaint.statusHistory.push({
    id: `sh-${Date.now()}`,
    fromStatus: prevStatus,
    toStatus: 'ASSIGNED',
    changedAt: now,
    changedByUser: { name: 'Department Officer' },
    notes: `Assigned field worker ${fieldWorkerName} to carry out repair work on site.`,
  });

  return { ok: true, status: 200, message: 'Field worker assigned successfully.', complaint };
}
