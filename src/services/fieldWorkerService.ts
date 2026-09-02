/**
 * fieldWorkerService.ts — Business logic for Field Worker Portal
 * Handles assigned complaint listing, work initiation, evidence uploads, and submission for officer review.
 */

import { addAuditLog } from '@/lib/audit-store';
import {
  addFieldWorkerEvidenceToComplaint,
  getComplaintById,
  listFieldWorkerComplaints,
  startFieldWorkerTask,
  submitFieldWorkerForReview,
  type Complaint,
  type ComplaintEvidence,
} from '@/lib/complaints-store';

export interface FieldWorkerComplaintsQuery {
  fieldWorkerId: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function getAssignedComplaints(query: FieldWorkerComplaintsQuery) {
  return listFieldWorkerComplaints(query);
}

export function getAssignedComplaintById(complaintId: string, fieldWorkerId: string) {
  const complaint = getComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, status: 404, message: 'Complaint ticket not found.' };
  }

  if (complaint.assignedFieldWorkerId !== fieldWorkerId) {
    return { ok: false, status: 403, message: 'Forbidden: This complaint is not assigned to you.' };
  }

  return { ok: true, status: 200, complaint };
}

export function startComplaintWork(complaintId: string, fieldWorkerId: string, actorName = 'Field Worker') {
  const result = startFieldWorkerTask(complaintId, fieldWorkerId);
  if (result.ok && result.complaint) {
    addAuditLog({
      actorId: fieldWorkerId,
      actorName,
      action: 'FIELD_WORK_STARTED',
      entityType: 'Complaint',
      targetId: complaintId,
      targetName: result.complaint.ticketId,
      metadata: { newStatus: 'IN_PROGRESS' },
    });
  }
  return result;
}

export function uploadWorkEvidence(
  complaintId: string,
  fieldWorkerId: string,
  stage: 'BEFORE' | 'DURING' | 'AFTER',
  imageUrl: string,
  notes?: string,
  actorName = 'Field Worker',
) {
  const result = addFieldWorkerEvidenceToComplaint(complaintId, fieldWorkerId, stage, imageUrl, notes);
  if (result.ok && result.evidence) {
    addAuditLog({
      actorId: fieldWorkerId,
      actorName,
      action: 'FIELD_EVIDENCE_UPLOADED',
      entityType: 'Evidence',
      targetId: result.evidence.id,
      targetName: complaintId,
      metadata: { stage, imageUrl },
    });
  }
  return result;
}

export function submitWorkForReview(
  complaintId: string,
  fieldWorkerId: string,
  remarks: string,
  actorName = 'Field Worker',
) {
  const result = submitFieldWorkerForReview(complaintId, fieldWorkerId, remarks);
  if (result.ok && result.complaint) {
    addAuditLog({
      actorId: fieldWorkerId,
      actorName,
      action: 'FIELD_WORK_SUBMITTED_FOR_REVIEW',
      entityType: 'Complaint',
      targetId: complaintId,
      targetName: result.complaint.ticketId,
      metadata: { remarks, readyForReview: true },
    });
  }
  return result;
}
