import { FilteredComplaintsPage } from '@/components/admin/filtered-complaints-page';

export default function ResolvedComplaintsPage() {
  return (
    <FilteredComplaintsPage
      filterStatus={['RESOLVED', 'CLOSED']}
      pageTitle="Resolved Complaints"
      pageDescription="Complaints that have been resolved and closed by departments"
      emptyMessage="No resolved complaints yet."
      statusLabel="RESOLVED"
    />
  );
}
