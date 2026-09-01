import { ComplaintStatus } from '@prisma/client';

/**
 * Valid state transitions for ComplaintStatus.
 * Transitioning outside of these mapped pathways will throw a 400 BadRequestException.
 */
export const VALID_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.SUBMITTED]: [
    ComplaintStatus.AI_PROCESSING,
    ComplaintStatus.PENDING_DEPT_REVIEW,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.REJECTED,
    ComplaintStatus.DUPLICATE,
  ],
  [ComplaintStatus.AI_PROCESSING]: [
    ComplaintStatus.PENDING_DEPT_REVIEW,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.REJECTED,
    ComplaintStatus.DUPLICATE,
  ],
  [ComplaintStatus.PENDING_DEPT_REVIEW]: [
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.REJECTED,
    ComplaintStatus.DUPLICATE,
  ],
  [ComplaintStatus.ASSIGNED]: [
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.RESOLVED,
    ComplaintStatus.REJECTED,
  ],
  [ComplaintStatus.IN_PROGRESS]: [
    ComplaintStatus.RESOLVED,
    ComplaintStatus.REJECTED,
    ComplaintStatus.CLOSED,
  ],
  [ComplaintStatus.RESOLVED]: [
    ComplaintStatus.CLOSED,
    ComplaintStatus.IN_PROGRESS,
  ],
  [ComplaintStatus.CLOSED]: [],
  [ComplaintStatus.REJECTED]: [],
  [ComplaintStatus.DUPLICATE]: [],
};
