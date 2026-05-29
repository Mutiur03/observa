import { EventPage } from "@/components/EventPage";

export default function Page({ params }: { params: { projectId: string } }) {
  return <EventPage projectId={params.projectId} title="API Requests" endpoint="/dashboard/requests" />;
}
