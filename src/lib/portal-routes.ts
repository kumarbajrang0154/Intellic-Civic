export function getPortalRouteForRole(role?: string | null): string {
  switch (role) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin';
    case 'DEPARTMENT_HEAD':
      return '/dept-head';
    case 'DEPARTMENT_OFFICER':
      return '/officer';
    case 'FIELD_WORKER':
      return '/field-worker';
    case 'CITIZEN':
      return '/citizen';
    default:
      return '/pending-approval';
  }
}

