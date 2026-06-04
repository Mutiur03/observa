import { ProjectSettingsForm } from "@/components/ProjectSettingsForm";
import { serverApiFetch } from "@/lib/server-api";
import type { Project } from "@/types";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await serverApiFetch<Project>(`/projects/${projectId}`, { next: { revalidate: 30 } });
  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Settings</h1>
      <ProjectSettingsForm initialProject={project} />
    </>
  );
}
