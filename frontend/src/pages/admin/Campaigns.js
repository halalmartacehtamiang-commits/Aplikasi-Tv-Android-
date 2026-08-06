import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Megaphone, Pencil, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const today = () => new Date().toISOString().slice(0, 10);
const empty = { id: null, name: "", playlist_id: "", start_date: today(), end_date: today(), target_tv_ids: [], enabled: true };

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [tvs, setTvs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [c, p, t] = await Promise.all([api.get("/campaigns"), api.get("/playlists"), api.get("/tvs")]);
    setCampaigns(c.data);
    setPlaylists(p.data);
    setTvs(t.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (c) => { setForm({ ...c, target_tv_ids: [...(c.target_tv_ids || [])] }); setOpen(true); };

  const toggleTv = (id) => {
    setForm((f) => ({
      ...f,
      target_tv_ids: f.target_tv_ids.includes(id) ? f.target_tv_ids.filter((x) => x !== id) : [...f.target_tv_ids, id],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Campaign name required");
    if (!form.playlist_id) return toast.error("Select a playlist");
    const payload = {
      name: form.name, playlist_id: form.playlist_id,
      start_date: form.start_date, end_date: form.end_date,
      target_tv_ids: form.target_tv_ids, enabled: form.enabled,
    };
    if (form.id) await api.put(`/campaigns/${form.id}`, payload);
    else await api.post("/campaigns", payload);
    toast.success("Campaign saved & pushed to screens");
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    await api.delete(`/campaigns/${id}`);
    toast.success("Campaign deleted");
    load();
  };

  const playlistName = (id) => playlists.find((p) => p.id === id)?.name || "—";

  return (
    <div className="space-y-8" data-testid="campaigns-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Scheduling</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-2">Campaigns</h1>
        </div>
        <Button data-testid="campaign-new-button" onClick={openNew} className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2">
          <Plus className="h-5 w-5" /> New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-20 text-center">
          <Megaphone className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No campaigns yet.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="campaigns-list">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-5 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3">
                  <h3 className="font-display font-semibold text-lg">{c.name}</h3>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${c.enabled ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {c.enabled ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Playlist: <span className="text-foreground">{playlistName(c.playlist_id)}</span> · {c.start_date} → {c.end_date} · {(c.target_tv_ids?.length || 0) === 0 ? "All TVs" : `${c.target_tv_ids.length} TV(s)`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" data-testid={`campaign-edit-${c.id}`} onClick={() => openEdit(c)} className="gap-2">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="ghost" size="icon" data-testid={`campaign-delete-${c.id}`} onClick={() => remove(c.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label>Campaign Name</Label>
              <Input data-testid="campaign-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 bg-background" placeholder="e.g. Weekend Sale" />
            </div>
            <div>
              <Label>Playlist</Label>
              <Select value={form.playlist_id} onValueChange={(v) => setForm({ ...form, playlist_id: v })}>
                <SelectTrigger className="mt-2 bg-background" data-testid="campaign-playlist-select"><SelectValue placeholder="Select playlist" /></SelectTrigger>
                <SelectContent>
                  {playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input type="date" data-testid="campaign-start-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-2 bg-background" />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" data-testid="campaign-end-input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-2 bg-background" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Target TVs (none = all)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tvs.map((t) => {
                  const sel = form.target_tv_ids.includes(t.id);
                  return (
                    <button key={t.id} data-testid={`campaign-tv-${t.id}`} onClick={() => toggleTv(t.id)} className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${sel ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
                      {sel && <Check className="h-3.5 w-3.5" />} {t.name}
                    </button>
                  );
                })}
                {tvs.length === 0 && <p className="text-sm text-muted-foreground">No TVs registered.</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} data-testid="campaign-enabled-switch" onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button data-testid="campaign-save-button" onClick={save} className="bg-primary hover:bg-primary/90 text-primary-foreground">Save Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
