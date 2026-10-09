import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decodeJwtToken } from '@/lib/auth-jwt';

function getDashboardForRole(role?: string): string {
  switch (role) {
    case 'CITIZEN':
      return '/citizen';
    case 'DEPARTMENT_HEAD':
      return '/dept-head';
    case 'DEPARTMENT_OFFICER':
      return '/officer';
    case 'FIELD_WORKER':
      return '/field-worker';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin';
    default:
      return '/login/citizen';
  }
}

export default function RootPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('ic_access_token')?.value;

  if (token) {
    const payload = decodeJwtToken(token);
    if (payload && (!payload.exp || payload.exp * 1000 > Date.now())) {
      if (payload.isAuthorized === false) {
        redirect('/pending-approval');
      }
      if (payload.role === 'CITIZEN' && payload.isProfileComplete === false) {
        redirect('/citizen/profile?complete=required');
      }
      redirect(getDashboardForRole(payload.role));
    }
  }

  redirect('/login/citizen');
}