import { EventPage } from "@/components/EventPage";

export default function Page({ params }: { params: { projectId: string } }) {
  return <EventPage projectId={params.projectId} title="Events" endpoint="/dashboard/events" />;
}
