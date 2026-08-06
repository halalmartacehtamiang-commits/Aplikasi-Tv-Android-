import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import { Tv, Wifi, WifiOff, Megaphone, Image, ListVideo, ArrowUpRight } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, tone, testid }) => (
  <div
    data-testid={testid}
    className="group relative bg-card border border-border rounded-xl p-6 transition-transform hover:-translate-y-1"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="font-display text-4xl font-bold mt-3">{value}</p>
      </div>
      <div
        className={`h-11 w-11 rounded-lg flex items-center justify-center ${
          tone === "green" ? "bg-accent/15 text-accent" : tone === "red" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);

  const load = async () => {
    const [s, l] = await Promise.all([api.get("/dashboard/stats"), api.get("/logs")]);
    setStats(s.data);
    setLogs(l.data.slice(0, 8));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Overview</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-2">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard testid="stat-total-tvs" icon={Tv} label="Total TVs" value={stats?.total_tvs ?? "—"} tone="orange" />
        <StatCard testid="stat-online" icon={Wifi} label="TV Online" value={stats?.online ?? "—"} tone="green" />
        <StatCard testid="stat-offline" icon={WifiOff} label="TV Offline" value={stats?.offline ?? "—"} tone="red" />
        <StatCard testid="stat-campaigns" icon={Megaphone} label="Campaigns" value={stats?.total_campaigns ?? "—"} tone="orange" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold mb-5">Quick Actions</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { to: "/admin/media", label: "Upload Media", icon: Image },
              { to: "/admin/playlists", label: "Build Playlist", icon: ListVideo },
              { to: "/admin/tvs", label: "Register TV", icon: Tv },
            ].map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group flex flex-col gap-3 p-5 rounded-lg border border-border bg-background hover:border-primary transition-colors"
              >
                <q.icon className="h-6 w-6 text-primary" />
                <span className="font-medium flex items-center justify-between">
                  {q.label}
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-background border border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Media Files</p>
              <p className="font-display text-2xl font-bold mt-1">{stats?.total_media ?? "—"}</p>
            </div>
            <div className="p-4 rounded-lg bg-background border border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Playlists</p>
              <p className="font-display text-2xl font-bold mt-1">{stats?.total_playlists ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-display text-lg font-semibold mb-5">Activity Log</h2>
          <div className="space-y-4">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-3 text-sm">
                <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="font-medium">{l.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{l.detail || l.actor}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
