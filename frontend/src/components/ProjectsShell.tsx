"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import type { Project } from "@/types";

export function ProjectsShell({ children, projects }: { children: ReactNode; projects: Project[] }) {
  const params = useParams<{ projectId?: string }>();
  const projectId = typeof params.projectId === "string" ? params.projectId : undefined;

  if (!projectId) return <>{children}</>;

  return (
    <AppShell projectId={projectId} projects={projects}>
      {children}
    </AppShell>
  );
}
