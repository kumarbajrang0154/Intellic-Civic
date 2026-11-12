import { SlaEscalationsView } from '@/components/admin/sla-escalations-view';

export default function AdminSlaEscalationsPage() {
  return <SlaEscalationsView defaultRole="ADMIN" portalPrefix="/admin" />;
}
