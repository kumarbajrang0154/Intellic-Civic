import { FilteredComplaintsPage } from '@/components/admin/filtered-complaints-page';

export default function EscalatedComplaintsPage() {
  return (
    <FilteredComplaintsPage
      filterStatus={['ASSIGNED', 'IN_PROGRESS']}
      pageTitle="Escalated / Overdue"
      pageDescription="Complaints that are assigned or in-progress and may need escalation attention"
      emptyMessage="No escalated complaints at this time."
      statusLabel="ASSIGNED"
    />
  );
}
