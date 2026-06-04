import type { ReactNode } from "react";
import { ProjectsShell } from "@/components/ProjectsShell";
import { serverApiFetch } from "@/lib/server-api";
import type { Project } from "@/types";

export default async function ProjectsLayout({ children }: { children: ReactNode }) {
  const projects = await serverApiFetch<Project[]>("/projects", { next: { revalidate: 60 } });

  return <ProjectsShell projects={projects}>{children}</ProjectsShell>;
}
