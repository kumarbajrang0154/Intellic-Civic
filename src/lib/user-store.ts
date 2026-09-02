import prisma from '@/lib/prisma';
import { UserRole, AuthProvider } from '@prisma/client';

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

function formatCitizenProfile(user: any): CitizenProfile {
  const name = user.name || '';
  const email = user.email || '';
  const isProfileComplete = Boolean(name.trim() && email.trim());

  return {
    id: user.id,
    mobileNumber: user.mobileNumber || '',
    name,
    email,
    address: 'Civic Area',
    avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || 'Citizen')}`,
    role: 'CITIZEN',
    isProfileComplete,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt || Date.now()).toISOString(),
  };
}

export async function getOrCreateCitizenProfile(mobileNumber: string): Promise<CitizenProfile> {
  const cleanNumber = normalizeMobileNumber(mobileNumber);

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ mobileNumber: cleanNumber }, { id: `citizen_${cleanNumber}` }],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: `citizen_${cleanNumber}`,
        mobileNumber: cleanNumber,
        name: '',
        role: UserRole.CITIZEN,
        authProvider: AuthProvider.MOBILE_OTP,
        isAuthorized: true,
      },
    });
  }

  return formatCitizenProfile(user);
}

export async function updateCitizenProfile(
  mobileNumber: string,
  updates: Partial<CitizenProfile>,
): Promise<CitizenProfile> {
  const cleanNumber = normalizeMobileNumber(mobileNumber);
  const current = await getOrCreateCitizenProfile(cleanNumber);

  const name = (updates.name !== undefined ? updates.name : current.name).trim();
  const email = (updates.email !== undefined ? updates.email : current.email).trim();
  const avatarUrl = updates.avatarUrl !== undefined ? updates.avatarUrl : current.avatarUrl;

  const updatedUser = await prisma.user.update({
    where: { id: current.id },
    data: {
      name,
      email: email || undefined,
      avatarUrl: avatarUrl || undefined,
    },
  });

  return formatCitizenProfile(updatedUser);
}
