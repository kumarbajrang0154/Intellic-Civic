/**
 * delete-failure-resolutions.ts
 *
 * Maps structured deletion failure reasons to clear, user-facing error messages
 * and recommended alternative actions in the administrative UI.
 */

export interface DeleteFailureResolution {
  reason: string;
  message: string;
  alternativeAction: string;
  actionType:
    | 'suspend'
    | 'reassign_complaints'
    | 'reassign_workers'
    | 'promote_admin'
    | 'archive'
    | 'review_blockers'
    | 'refresh'
    | 'none';
}

export const DELETE_FAILURE_RESOLUTIONS: Record<string, DeleteFailureResolution> = {
  CITIZEN_HAS_COMPLAINTS: {
    reason: 'CITIZEN_HAS_COMPLAINTS',
    message: 'Citizen has complaints linked to their account.',
    alternativeAction: 'Citizen has complaints. Suspend instead.',
    actionType: 'suspend',
  },
  CITIZEN_HAS_FEEDBACK: {
    reason: 'CITIZEN_HAS_FEEDBACK',
    message: 'Citizen has submitted feedback and ratings.',
    alternativeAction: 'Citizen has feedback. Suspend instead.',
    actionType: 'suspend',
  },
  SUPER_ADMIN_PROTECTED: {
    reason: 'SUPER_ADMIN_PROTECTED',
    message: 'Super Admin accounts cannot be suspended, deactivated, or deleted.',
    alternativeAction: 'Super Admin is protected. Action blocked.',
    actionType: 'none',
  },
  LAST_ADMIN_PROTECTED: {
    reason: 'LAST_ADMIN_PROTECTED',
    message: 'Cannot delete the last remaining active Administrator account.',
    alternativeAction: 'Last administrator account. Promote another admin first.',
    actionType: 'promote_admin',
  },
  SELF_DELETE_PROTECTED: {
    reason: 'SELF_DELETE_PROTECTED',
    message: 'You cannot delete your own account while logged in.',
    alternativeAction: 'Self-deletion forbidden. Ask another administrator to manage this account.',
    actionType: 'none',
  },
  STAFF_HAS_OPEN_COMPLAINTS: {
    reason: 'STAFF_HAS_OPEN_COMPLAINTS',
    message: 'Staff member has open assigned complaints.',
    alternativeAction: 'Staff has open complaints. Reassign complaints first.',
    actionType: 'reassign_complaints',
  },
  STAFF_HAS_FIELD_WORKERS: {
    reason: 'STAFF_HAS_FIELD_WORKERS',
    message: 'Department Officer has assigned field workers.',
    alternativeAction: 'Officer has supervised workers. Reassign field workers first.',
    actionType: 'reassign_workers',
  },
  BLOCKERS_EXIST: {
    reason: 'BLOCKERS_EXIST',
    message: 'Account has active dependencies blocking deletion.',
    alternativeAction: 'Dependencies found. Review and resolve preflight blockers.',
    actionType: 'review_blockers',
  },
  NOT_FOUND: {
    reason: 'NOT_FOUND',
    message: 'Target user account not found or already deleted.',
    alternativeAction: 'Account not found. Refresh list.',
    actionType: 'refresh',
  },
  INTERNAL_ERROR: {
    reason: 'INTERNAL_ERROR',
    message: 'An unexpected database error occurred during deletion.',
    alternativeAction: 'Database error. Retry operation.',
    actionType: 'none',
  },
};

export function resolveDeleteFailure(reason?: string | null): DeleteFailureResolution {
  if (reason && DELETE_FAILURE_RESOLUTIONS[reason]) {
    return DELETE_FAILURE_RESOLUTIONS[reason];
  }
  return {
    reason: reason || 'UNKNOWN_ERROR',
    message: 'Cannot delete this account due to system constraints.',
    alternativeAction: 'Review account details or suspend instead.',
    actionType: 'none',
  };
}
