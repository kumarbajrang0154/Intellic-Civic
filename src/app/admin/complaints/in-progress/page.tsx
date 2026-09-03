import { FilteredComplaintsPage } from '@/components/admin/filtered-complaints-page';

export default function InProgressComplaintsPage() {
  return (
    <FilteredComplaintsPage
      filterStatus="IN_PROGRESS"
      pageTitle="In Progress"
      pageDescription="Complaints currently being worked on by field workers"
      emptyMessage="No complaints currently in progress."
      statusLabel="IN_PROGRESS"
    />
  );
}
