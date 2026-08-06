import React, { useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Upload, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const TIMEZONES = ["Asia/Jakarta", "Asia/Kuala_Lumpur", "Asia/Dubai", "Asia/Riyadh", "Europe/London", "America/New_York", "UTC"];

export default function Settings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef();

  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/media", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setS((prev) => ({ ...prev, logo_media_id: data.id }));
      toast.success("Logo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", {
        store_name: s.store_name, logo_media_id: s.logo_media_id, theme: s.theme,
        timezone: s.timezone, branch: s.branch, ticker_text: s.ticker_text,
      });
      toast.success("Settings saved & pushed to all screens");
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 max-w-3xl" data-testid="settings-page">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Configuration</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-2">Settings</h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
            {s.logo_media_id ? <img src={mediaUrl(s.logo_media_id)} className="w-full h-full object-contain" alt="logo" /> : <span className="text-xs text-muted-foreground">No logo</span>}
          </div>
          <div>
            <Label>Store Logo</Label>
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={uploadLogo} data-testid="settings-logo-input" />
            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading} data-testid="settings-logo-upload" className="gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Logo
              </Button>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <Label>Store Name</Label>
            <Input data-testid="settings-store-name" value={s.store_name || ""} onChange={(e) => setS({ ...s, store_name: e.target.value })} className="mt-2 bg-background" />
          </div>
          <div>
            <Label>Branch</Label>
            <Input data-testid="settings-branch" value={s.branch || ""} onChange={(e) => setS({ ...s, branch: e.target.value })} className="mt-2 bg-background" />
          </div>
          <div>
            <Label>Timezone</Label>
            <Select value={s.timezone} onValueChange={(v) => setS({ ...s, timezone: v })}>
              <SelectTrigger className="mt-2 bg-background" data-testid="settings-timezone"><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Theme</Label>
            <Select value={s.theme} onValueChange={(v) => setS({ ...s, theme: v })}>
              <SelectTrigger className="mt-2 bg-background" data-testid="settings-theme"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark (Orange/Green)</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Running Text (Ticker)</Label>
          <Textarea data-testid="settings-ticker" value={s.ticker_text || ""} onChange={(e) => setS({ ...s, ticker_text: e.target.value })} className="mt-2 bg-background" rows={3} placeholder="Text scrolling at the bottom of every screen" />
        </div>

        <Button data-testid="settings-save-button" onClick={save} disabled={saving} className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Save Settings
        </Button>
      </div>
    </div>
  );
}
