import { SlaEscalationsView } from '@/components/admin/sla-escalations-view';

export default function DeptHeadSlaEscalationsPage() {
  return <SlaEscalationsView defaultRole="DEPARTMENT_HEAD" portalPrefix="/dept-head" />;
}
