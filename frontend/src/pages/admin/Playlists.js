import React, { useEffect, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, ListVideo, Pencil, Film, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const empty = { id: null, name: "", items: [], enabled: true };

export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [media, setMedia] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [p, m] = await Promise.all([api.get("/playlists"), api.get("/media")]);
    setPlaylists(p.data);
    setMedia(m.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (pl) => { setForm({ ...pl, items: [...pl.items] }); setOpen(true); };

  const toggleMedia = (mid) => {
    setForm((f) => {
      const exists = f.items.find((i) => i.media_id === mid);
      if (exists) return { ...f, items: f.items.filter((i) => i.media_id !== mid) };
      return { ...f, items: [...f.items, { media_id: mid, duration: 8 }] };
    });
  };

  const setDuration = (mid, val) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.media_id === mid ? { ...i, duration: Math.max(1, parseInt(val || 1)) } : i)),
    }));
  };

  const move = (idx, dir) => {
    setForm((f) => {
      const items = [...f.items];
      const j = idx + dir;
      if (j < 0 || j >= items.length) return f;
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...f, items };
    });
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Playlist name is required");
    const payload = { name: form.name, items: form.items, enabled: form.enabled };
    if (form.id) await api.put(`/playlists/${form.id}`, payload);
    else await api.post("/playlists", payload);
    toast.success("Playlist saved");
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    await api.delete(`/playlists/${id}`);
    toast.success("Playlist deleted");
    load();
  };

  const mediaById = (id) => media.find((m) => m.id === id);

  return (
    <div className="space-y-8" data-testid="playlists-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Content</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-2">Playlists</h1>
        </div>
        <Button data-testid="playlist-new-button" onClick={openNew} className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2">
          <Plus className="h-5 w-5" /> New Playlist
        </Button>
      </div>

      {playlists.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-20 text-center">
          <ListVideo className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No playlists yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="playlists-grid">
          {playlists.map((pl) => (
            <div key={pl.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold text-lg">{pl.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{pl.items.length} items</p>
                </div>
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${pl.enabled ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                  {pl.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex -space-x-2 mt-4">
                {pl.items.slice(0, 5).map((it) => {
                  const m = mediaById(it.media_id);
                  return (
                    <div key={it.media_id} className="h-10 w-10 rounded-md border border-border overflow-hidden bg-secondary flex items-center justify-center">
                      {m?.type === "image" ? <img src={mediaUrl(m.id)} className="h-full w-full object-cover" alt="" /> : <Film className="h-4 w-4 text-primary" />}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-5">
                <Button variant="secondary" size="sm" data-testid={`playlist-edit-${pl.id}`} onClick={() => openEdit(pl)} className="gap-2 flex-1">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="ghost" size="icon" data-testid={`playlist-delete-${pl.id}`} onClick={() => remove(pl.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Playlist" : "New Playlist"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1">
                <Label>Playlist Name</Label>
                <Input data-testid="playlist-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 bg-background" placeholder="e.g. Ramadan Promo" />
              </div>
              <div className="flex items-center gap-3">
                <Label>Enabled</Label>
                <Switch checked={form.enabled} data-testid="playlist-enabled-switch" onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              </div>
            </div>

            {form.items.length > 0 && (
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Order & Duration (seconds)</Label>
                <div className="mt-2 space-y-2">
                  {form.items.map((it, idx) => {
                    const m = mediaById(it.media_id);
                    return (
                      <div key={it.media_id} className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border">
                        <div className="h-10 w-10 rounded-md overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                          {m?.type === "image" ? <img src={mediaUrl(m.id)} className="h-full w-full object-cover" alt="" /> : <Film className="h-4 w-4 text-primary" />}
                        </div>
                        <span className="flex-1 text-sm truncate">{m?.name || "Missing"}</span>
                        <Input type="number" min="1" value={it.duration} onChange={(e) => setDuration(it.media_id, e.target.value)} className="w-20 h-9 bg-card" data-testid={`playlist-duration-${it.media_id}`} />
                        <div className="flex flex-col">
                          <button onClick={() => move(idx, -1)} className="text-muted-foreground hover:text-primary"><ArrowUp className="h-4 w-4" /></button>
                          <button onClick={() => move(idx, 1)} className="text-muted-foreground hover:text-primary"><ArrowDown className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Select Media</Label>
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
                {media.map((m) => {
                  const selected = form.items.find((i) => i.media_id === m.id);
                  return (
                    <button
                      key={m.id}
                      data-testid={`playlist-media-select-${m.id}`}
                      onClick={() => toggleMedia(m.id)}
                      className={`relative rounded-lg overflow-hidden border-2 aspect-square ${selected ? "border-primary" : "border-border"}`}
                    >
                      {m.type === "image" ? <img src={mediaUrl(m.id)} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-secondary flex items-center justify-center"><Film className="h-6 w-6 text-primary" /></div>}
                      {selected && <div className="absolute inset-0 bg-primary/30 flex items-center justify-center"><Check className="h-6 w-6 text-white" /></div>}
                    </button>
                  );
                })}
                {media.length === 0 && <p className="col-span-4 text-sm text-muted-foreground">Upload media first.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button data-testid="playlist-save-button" onClick={save} className="bg-primary hover:bg-primary/90 text-primary-foreground">Save Playlist</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
