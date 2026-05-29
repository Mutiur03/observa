import { NewProjectForm } from "@/components/NewProjectForm";
import { serverApiFetch } from "@/lib/server-api";
import type { Organization } from "@/types";

export default async function NewProjectPage() {
  const organizations = await serverApiFetch<Organization[]>("/organizations");
  return (
    <main className="min-h-screen bg-canvas p-6">
      <NewProjectForm organizations={organizations} />
    </main>
  );
}
