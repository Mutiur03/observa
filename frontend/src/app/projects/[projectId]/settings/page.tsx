import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-semibold">Settings</h1>
      <div className="rounded-md border border-border bg-white p-6 text-sm text-muted">
        Project settings placeholder for retention, environments, and SDK setup notes.
      </div>
    </AppShell>
  );
}
