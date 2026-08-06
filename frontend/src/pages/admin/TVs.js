import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Tv, Pencil, RotateCw, ExternalLink, Copy } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const empty = { id: null, name: "", branch: "" };

const fmt = (iso) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString();
};

export default function TVs() {
  const [tvs, setTvs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const { data } = await api.get("/tvs");
    setTvs(data);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (t) => { setForm({ id: t.id, name: t.name, branch: t.branch || "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("TV name required");
    if (form.id) await api.put(`/tvs/${form.id}`, { name: form.name, branch: form.branch });
    else await api.post("/tvs", { name: form.name, branch: form.branch });
    toast.success("TV saved");
    setOpen(false);
    load();
  };

  const remove = async (id) => { await api.delete(`/tvs/${id}`); toast.success("TV removed"); load(); };

  const restart = async (id) => {
    const { data } = await api.post(`/tvs/${id}/restart`);
    toast[data.online ? "success" : "warning"](data.online ? "Restart command sent" : "TV offline — will apply on reconnect");
  };

  const displayLink = (id) => `${window.location.origin}/display/${id}`;

  const copyLink = (id) => {
    navigator.clipboard.writeText(displayLink(id));
    toast.success("Display URL copied");
  };

  return (
    <div className="space-y-8" data-testid="tvs-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Devices</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-2">TV Screens</h1>
        </div>
        <Button data-testid="tv-new-button" onClick={openNew} className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2">
          <Plus className="h-5 w-5" /> Register TV
        </Button>
      </div>

      {tvs.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-20 text-center">
          <Tv className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No TVs registered. Register one and open its display link on the Android TV.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="tvs-table">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Branch</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Last Seen</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {tvs.map((t) => (
            <div key={t.id} className="grid grid-cols-2 md:grid-cols-12 gap-4 px-6 py-4 border-b border-border last:border-0 items-center" data-testid={`tv-row-${t.id}`}>
              <div className="md:col-span-3 font-medium">{t.name}</div>
              <div className="md:col-span-2 text-sm text-muted-foreground">{t.branch || "—"}</div>
              <div className="md:col-span-2">
                <span className={`inline-flex items-center gap-2 text-sm ${t.status === "online" ? "text-accent" : "text-destructive"}`}>
                  <span className={`h-2 w-2 rounded-full ${t.status === "online" ? "bg-accent" : "bg-destructive"}`} />
                  {t.status === "online" ? "Online" : "Offline"}
                </span>
              </div>
              <div className="md:col-span-3 text-sm text-muted-foreground">{fmt(t.last_seen)}</div>
              <div className="md:col-span-2 flex justify-end gap-1">
                <Button size="icon" variant="ghost" title="Copy display URL" data-testid={`tv-copy-${t.id}`} onClick={() => copyLink(t.id)}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" title="Open display" data-testid={`tv-open-${t.id}`} onClick={() => window.open(displayLink(t.id), "_blank")}><ExternalLink className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" title="Restart" data-testid={`tv-restart-${t.id}`} onClick={() => restart(t.id)}><RotateCw className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" data-testid={`tv-edit-${t.id}`} onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" data-testid={`tv-delete-${t.id}`} onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit TV" : "Register TV"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <Label>TV Name</Label>
              <Input data-testid="tv-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2 bg-background" placeholder="e.g. Entrance Screen" />
            </div>
            <div>
              <Label>Branch</Label>
              <Input data-testid="tv-branch-input" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} className="mt-2 bg-background" placeholder="e.g. Downtown" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button data-testid="tv-save-button" onClick={save} className="bg-primary hover:bg-primary/90 text-primary-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
