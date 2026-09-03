import { FilteredComplaintsPage } from '@/components/admin/filtered-complaints-page';

export default function PendingComplaintsPage() {
  return (
    <FilteredComplaintsPage
      filterStatus={['SUBMITTED', 'PENDING_DEPT_REVIEW']}
      pageTitle="Pending Complaints"
      pageDescription="Complaints submitted or awaiting department review — requires triage action"
      emptyMessage="No pending complaints. All issues have been reviewed."
      statusLabel="PENDING_DEPT_REVIEW"
    />
  );
}
