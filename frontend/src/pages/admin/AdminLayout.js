import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Image, ListVideo, Megaphone, Tv, Settings as SettingsIcon,
  LogOut, MonitorPlay, Menu, X,
} from "lucide-react";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/admin/media", label: "Media", icon: Image, testid: "nav-media" },
  { to: "/admin/playlists", label: "Playlists", icon: ListVideo, testid: "nav-playlists" },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone, testid: "nav-campaigns" },
  { to: "/admin/tvs", label: "TV Screens", icon: Tv, testid: "nav-tvs" },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 h-20 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <MonitorPlay className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="font-display font-extrabold tracking-tight">HALALMART</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Signage</p>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={n.testid}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`
            }
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="px-2 mb-3">
          <p className="text-sm font-medium truncate">{user?.name || "Admin"}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          data-testid="logout-button"
          onClick={doLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-5 w-5" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card/40 flex-col fixed inset-y-0">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-card border-r border-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 md:ml-64">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between h-16 px-4 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <MonitorPlay className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">HALALMART</span>
          </div>
          <Button size="icon" variant="ghost" data-testid="mobile-menu-toggle" onClick={() => setOpen(!open)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </header>
        <main className="p-5 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
