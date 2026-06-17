import { isSupabaseConfigured } from "@/lib/config";

const KPIS = [
  "Days to next deadline",
  "Tasks due today",
  "Overdue tasks",
  "Applications in progress",
  "Essays not final",
];

export default function DashboardPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="banner warn">
          Backend not connected yet — add your Supabase keys to <code>.env.local</code> to start saving to the cloud.
        </div>
      )}

      <div className="kpis">
        {KPIS.map((l) => (
          <div className="kpi" key={l}>
            <div className="v">—</div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Welcome to Compass v2</h3>
        </div>
        <div className="card-b">
          <div className="empty">
            <div className="big">Cloud-backed · multi-device</div>
            Your data lives in Supabase and syncs across devices. Once the backend is connected, every section
            saves automatically as you work.
          </div>
        </div>
      </div>
    </>
  );
}
