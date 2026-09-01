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

const globalForUsers = global as unknown as { userProfiles: Map<string, CitizenProfile> };

export const userProfiles = globalForUsers.userProfiles || new Map<string, CitizenProfile>();

if (process.env.NODE_ENV !== 'production') {
  globalForUsers.userProfiles = userProfiles;
}

export function getOrCreateCitizenProfile(mobileNumber: string): CitizenProfile {
  const cleanNumber = mobileNumber.replace(/\D/g, '');
  const id = `citizen_${cleanNumber}`;

  if (!userProfiles.has(cleanNumber)) {
    userProfiles.set(cleanNumber, {
      id,
      mobileNumber: cleanNumber,
      name: '',
      email: '',
      address: '',
      avatarUrl: '',
      role: 'CITIZEN',
      isProfileComplete: false,
      createdAt: new Date().toISOString(),
    });
  }

  return userProfiles.get(cleanNumber)!;
}

export function updateCitizenProfile(
  mobileNumber: string,
  updates: Partial<CitizenProfile>,
): CitizenProfile {
  const cleanNumber = mobileNumber.replace(/\D/g, '');
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

  userProfiles.set(cleanNumber, updated);
  return updated;
}
