import fs from 'fs';
import path from 'path';

export interface DepartmentItem {
  id: string;
  name: string;
  description: string;
  headOfficeAddress: string;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'DEPARTMENT_HEAD' | 'DEPARTMENT_OFFICER' | 'FIELD_WORKER' | 'CITIZEN' | null;
  departmentId: string | null;
  isAuthorized: boolean;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORE_FILE_PATH = path.join(process.cwd(), '.staff_dept_store.json');

const INITIAL_DEPARTMENTS: DepartmentItem[] = [
  {
    id: 'dept_roads_infra',
    name: 'Roads & Infrastructure',
    description: 'Maintenance of municipal roads, bridges, flyovers, potholes, stormwater drains, and traffic corridors.',
    headOfficeAddress: 'Civic Centre, Floor 3, Block A, Central City Avenue',
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_water_sanitation',
    name: 'Water Supply & Sanitation',
    description: 'Potable water pipelines, sewage treatment, drainage clearance, and water quality control.',
    headOfficeAddress: 'Jal Bhawan, Sector 12, Smart City Corridor',
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_solid_waste',
    name: 'Solid Waste Management',
    description: 'Garbage collection, community dumpsters, recycling plants, street sweeping, and hazardous waste disposal.',
    headOfficeAddress: 'Swachh Tower, Ring Road Complex, North Zone',
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_electricity_lights',
    name: 'Electricity & Streetlights',
    description: 'Public streetlight networks, electrical poles, transformer maintenance, and solar grid infrastructure.',
    headOfficeAddress: 'Urja Bhawan, Power Grid Road, East District',
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_health_sanitation',
    name: 'Health & Public Sanitation',
    description: 'Vector control, public toilets hygiene, food safety inspections, and stray animal management.',
    headOfficeAddress: 'Health Headquarters, Civic Hospital Campus, West Ward',
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'dept_urban_planning',
    name: 'Urban Planning & Encroachment',
    description: 'Zoning enforcement, anti-encroachment drives, illegal construction checks, and public park maintenance.',
    headOfficeAddress: 'Vikas Bhawan, Master Plan Enclave, South Zone',
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SUPER_ADMIN_EMAIL = 'kumarbajrang325@gmail.com';

const INITIAL_USERS: UserItem[] = [
  {
    id: 'usr_super_admin',
    name: 'Bajrang Kumar (Super Admin)',
    email: SUPER_ADMIN_EMAIL,
    role: 'ADMIN',
    departmentId: null,
    isAuthorized: true,
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr_dept_head_roads',
    name: 'Rajesh Sharma',
    email: 'head.roads@smartcity.gov.in',
    role: 'DEPARTMENT_HEAD',
    departmentId: 'dept_roads_infra',
    isAuthorized: true,
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr_officer_roads_1',
    name: 'Amit Patel',
    email: 'officer.roads@smartcity.gov.in',
    role: 'DEPARTMENT_OFFICER',
    departmentId: 'dept_roads_infra',
    isAuthorized: true,
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr_dept_head_water',
    name: 'Priya Verma',
    email: 'head.water@smartcity.gov.in',
    role: 'DEPARTMENT_HEAD',
    departmentId: 'dept_water_sanitation',
    isAuthorized: true,
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr_officer_water_1',
    name: 'Suresh Kumar',
    email: 'officer.water@smartcity.gov.in',
    role: 'DEPARTMENT_OFFICER',
    departmentId: 'dept_water_sanitation',
    isAuthorized: true,
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'usr_pending_1',
    name: 'Vikram Singh',
    email: 'vikram.singh@gmail.com',
    role: null,
    departmentId: null,
    isAuthorized: false,
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface StoreData {
  departments: DepartmentItem[];
  users: UserItem[];
}

function loadStoreFromDisk(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE_PATH)) {
      const fileData = fs.readFileSync(STORE_FILE_PATH, 'utf-8');
      const json = JSON.parse(fileData);
      if (json && Array.isArray(json.departments) && Array.isArray(json.users)) {
        // Ensure Super Admin exists & remains ADMIN
        const adminIndex = json.users.findIndex(
          (u: UserItem) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
        );
        if (adminIndex === -1) {
          json.users.unshift(INITIAL_USERS[0]);
        } else {
          json.users[adminIndex].role = 'ADMIN';
          json.users[adminIndex].isAuthorized = true;
          json.users[adminIndex].isSuspended = false;
        }
        return json;
      }
    }
  } catch (err) {
    console.error('Error loading staff & dept store from disk:', err);
  }

  return {
    departments: [...INITIAL_DEPARTMENTS],
    users: [...INITIAL_USERS],
  };
}

function saveStoreToDisk(data: StoreData) {
  try {
    fs.writeFileSync(STORE_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving staff & dept store to disk:', err);
  }
}

const globalForStore = global as unknown as { staffDeptStore: StoreData };

export const staffDeptStore = globalForStore.staffDeptStore || loadStoreFromDisk();

if (process.env.NODE_ENV !== 'production') {
  globalForStore.staffDeptStore = staffDeptStore;
}

// -----------------------------------------------------------------------------
// Department Management Helpers
// -----------------------------------------------------------------------------

export function listDepartments(): DepartmentItem[] {
  return [...staffDeptStore.departments];
}

export function getDepartment(id: string): DepartmentItem | undefined {
  return staffDeptStore.departments.find((d) => d.id === id);
}

export function addDepartment(input: {
  name: string;
  description: string;
  headOfficeAddress?: string;
}): DepartmentItem {
  const newDept: DepartmentItem = {
    id: `dept_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: input.name.trim(),
    description: input.description.trim(),
    headOfficeAddress: input.headOfficeAddress?.trim() || 'Civic Center Complex, Main City Sector',
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  staffDeptStore.departments.push(newDept);
  saveStoreToDisk(staffDeptStore);
  return newDept;
}

export function updateDepartment(
  id: string,
  updates: Partial<Pick<DepartmentItem, 'name' | 'description' | 'headOfficeAddress' | 'isSuspended'>>,
): DepartmentItem | null {
  const index = staffDeptStore.departments.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const current = staffDeptStore.departments[index];
  const updated: DepartmentItem = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    description: updates.description !== undefined ? updates.description.trim() : current.description,
    headOfficeAddress:
      updates.headOfficeAddress !== undefined ? updates.headOfficeAddress.trim() : current.headOfficeAddress,
    isSuspended: updates.isSuspended !== undefined ? updates.isSuspended : current.isSuspended,
    updatedAt: new Date().toISOString(),
  };

  staffDeptStore.departments[index] = updated;
  saveStoreToDisk(staffDeptStore);
  return updated;
}

export function suspendDepartment(id: string, isSuspended: boolean): DepartmentItem | null {
  return updateDepartment(id, { isSuspended });
}

export function deleteDepartment(id: string): boolean {
  const initialLen = staffDeptStore.departments.length;
  staffDeptStore.departments = staffDeptStore.departments.filter((d) => d.id !== id);

  // Unassign users belonging to deleted department
  staffDeptStore.users.forEach((u) => {
    if (u.departmentId === id) {
      u.departmentId = null;
    }
  });

  if (staffDeptStore.departments.length !== initialLen) {
    saveStoreToDisk(staffDeptStore);
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// User / Officer Management Helpers
// -----------------------------------------------------------------------------

export function listUsers(filters?: {
  role?: string;
  departmentId?: string;
  pendingOnly?: boolean;
  search?: string;
}): UserItem[] {
  let list = [...staffDeptStore.users];

  if (filters?.pendingOnly) {
    list = list.filter((u) => !u.isAuthorized && u.role !== 'ADMIN');
  }

  if (filters?.role && filters.role !== 'ALL') {
    list = list.filter((u) => u.role === filters.role);
  }

  if (filters?.departmentId && filters.departmentId !== 'ALL') {
    list = list.filter((u) => u.departmentId === filters.departmentId);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }

  return list;
}

export function getUser(id: string): UserItem | undefined {
  return staffDeptStore.users.find((u) => u.id === id);
}

export function getUserByEmail(email: string): UserItem | undefined {
  return staffDeptStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function ensureSuperAdminUser(email: string = SUPER_ADMIN_EMAIL, name: string = 'Bajrang Kumar (Super Admin)'): UserItem {
  let admin = getUserByEmail(email);

  if (admin) {
    admin.role = 'ADMIN';
    admin.isAuthorized = true;
    admin.isSuspended = false;
    admin.name = admin.name || name;
  } else {
    admin = {
      id: 'usr_super_admin',
      name,
      email: email.toLowerCase(),
      role: 'ADMIN',
      departmentId: null,
      isAuthorized: true,
      isSuspended: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    staffDeptStore.users.unshift(admin);
  }

  saveStoreToDisk(staffDeptStore);
  return admin;
}

export function addUser(input: {
  name: string;
  email: string;
  role: UserItem['role'];
  departmentId?: string | null;
  isAuthorized?: boolean;
}): UserItem {
  const existing = getUserByEmail(input.email);
  if (existing) {
    return updateUser(existing.id, {
      name: input.name,
      role: input.role,
      departmentId: input.departmentId,
      isAuthorized: input.isAuthorized ?? true,
      isSuspended: false,
    })!;
  }

  const newUser: UserItem = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    departmentId: input.departmentId || null,
    isAuthorized: input.isAuthorized ?? true,
    isSuspended: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  staffDeptStore.users.push(newUser);
  saveStoreToDisk(staffDeptStore);
  return newUser;
}

export function updateUser(
  id: string,
  updates: Partial<Pick<UserItem, 'name' | 'email' | 'role' | 'departmentId' | 'isAuthorized' | 'isSuspended'>>,
): UserItem | null {
  const index = staffDeptStore.users.findIndex((u) => u.id === id);
  if (index === -1) return null;

  const current = staffDeptStore.users[index];

  // Prevent revoking Super Admin role from kumarbajrang325@gmail.com
  let updatedRole = updates.role !== undefined ? updates.role : current.role;
  let updatedAuthorized = updates.isAuthorized !== undefined ? updates.isAuthorized : current.isAuthorized;
  let updatedSuspended = updates.isSuspended !== undefined ? updates.isSuspended : current.isSuspended;

  if (current.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    updatedRole = 'ADMIN';
    updatedAuthorized = true;
    updatedSuspended = false;
  }

  const updated: UserItem = {
    ...current,
    name: updates.name !== undefined ? updates.name.trim() : current.name,
    email: updates.email !== undefined ? updates.email.trim().toLowerCase() : current.email,
    role: updatedRole,
    departmentId: updates.departmentId !== undefined ? updates.departmentId : current.departmentId,
    isAuthorized: updatedAuthorized,
    isSuspended: updatedSuspended,
    updatedAt: new Date().toISOString(),
  };

  staffDeptStore.users[index] = updated;
  saveStoreToDisk(staffDeptStore);
  return updated;
}

export function suspendUser(id: string, isSuspended: boolean): UserItem | null {
  return updateUser(id, { isSuspended });
}

export function deleteUser(id: string): boolean {
  const user = getUser(id);
  if (!user) return false;

  // Protect Super Admin from deletion
  if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return false;
  }

  const initialLen = staffDeptStore.users.length;
  staffDeptStore.users = staffDeptStore.users.filter((u) => u.id !== id);

  if (staffDeptStore.users.length !== initialLen) {
    saveStoreToDisk(staffDeptStore);
    return true;
  }
  return false;
}

export function approveUser(
  id: string,
  role: UserItem['role'],
  departmentId?: string | null,
): UserItem | null {
  return updateUser(id, {
    role,
    departmentId: role === 'ADMIN' ? null : departmentId,
    isAuthorized: true,
    isSuspended: false,
  });
}

export function rejectUser(id: string): boolean {
  return deleteUser(id);
}
