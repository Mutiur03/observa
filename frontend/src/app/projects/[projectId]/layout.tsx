import { AppShell } from "@/components/AppShell";
import { serverApiFetch } from "@/lib/server-api";
import type { ReactNode } from "react";
import type { Project } from "@/types";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [projects, project] = await Promise.all([
    serverApiFetch<Project[]>('/projects'),
    serverApiFetch<Project>(`/projects/${projectId}`),
  ]);

  return (
    <AppShell projectId={projectId} projectName={project.name} projects={projects}>
      {children}
    </AppShell>
  );
}