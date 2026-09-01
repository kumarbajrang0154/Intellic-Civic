import fs from 'fs';
import path from 'path';

export interface CitizenProfile {
  id: string;
  mobileNumber: string;
  name: string;
  email: string;
  address: string;
  avatarUrl: string;
  role: 'CITIZEN';
  isProfileComplete: boolean;
  createdAt: string;
}

const PROFILE_FILE_PATH = path.join(process.cwd(), '.user_profiles.json');

export function normalizeMobileNumber(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

function loadProfilesFromDisk(): Map<string, CitizenProfile> {
  const map = new Map<string, CitizenProfile>();

  // Pre-seed demo account for 9876543210
  map.set('9876543210', {
    id: 'citizen_9876543210',
    mobileNumber: '9876543210',
    name: 'Bajrang Kumar',
    email: 'kumarbajrang0154@gmail.com',
    address: 'House No. 102, Civic Heights, Sector 14, Smart City',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bajrang',
    role: 'CITIZEN',
    isProfileComplete: true,
    createdAt: new Date().toISOString(),
  });

  try {
    if (fs.existsSync(PROFILE_FILE_PATH)) {
      const fileData = fs.readFileSync(PROFILE_FILE_PATH, 'utf-8');
      const json = JSON.parse(fileData);
      if (Array.isArray(json)) {
        json.forEach((p: CitizenProfile) => {
          if (p && p.mobileNumber) {
            const clean = normalizeMobileNumber(p.mobileNumber);
            map.set(clean, p);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error loading profiles from disk:', err);
  }

  return map;
}

function saveProfilesToDisk(map: Map<string, CitizenProfile>) {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(PROFILE_FILE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving profiles to disk:', err);
  }
}

const globalForUsers = global as unknown as { userProfilesMap: Map<string, CitizenProfile> };

export const userProfilesMap =
  globalForUsers.userProfilesMap || loadProfilesFromDisk();

if (process.env.NODE_ENV !== 'production') {
  globalForUsers.userProfilesMap = userProfilesMap;
}

export function getOrCreateCitizenProfile(mobileNumber: string): CitizenProfile {
  const cleanNumber = normalizeMobileNumber(mobileNumber);
  const id = `citizen_${cleanNumber}`;

  if (!userProfilesMap.has(cleanNumber)) {
    const newProfile: CitizenProfile = {
      id,
      mobileNumber: cleanNumber,
      name: '',
      email: '',
      address: '',
      avatarUrl: '',
      role: 'CITIZEN',
      isProfileComplete: false,
      createdAt: new Date().toISOString(),
    };
    userProfilesMap.set(cleanNumber, newProfile);
    saveProfilesToDisk(userProfilesMap);
  }

  return userProfilesMap.get(cleanNumber)!;
}

export function updateCitizenProfile(
  mobileNumber: string,
  updates: Partial<CitizenProfile>,
): CitizenProfile {
  const cleanNumber = normalizeMobileNumber(mobileNumber);
  const current = getOrCreateCitizenProfile(cleanNumber);

  const name = (updates.name !== undefined ? updates.name : current.name).trim();
  const email = (updates.email !== undefined ? updates.email : current.email).trim();
  const address = (updates.address !== undefined ? updates.address : current.address).trim();
  const avatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl;

  const isProfileComplete = Boolean(name && email && address);

  const updated: CitizenProfile = {
    ...current,
    name,
    email,
    address,
    avatarUrl,
    isProfileComplete,
  };

  userProfilesMap.set(cleanNumber, updated);
  saveProfilesToDisk(userProfilesMap);

  return updated;
}
