import React, { useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, Film, ImageIcon, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function Media() {
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    const { data } = await api.get("/media");
    setMedia(data);
  };
  useEffect(() => { load(); }, []);

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post("/media", fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      toast.success(`${files.length} file(s) uploaded`);
      await load();
    } catch (err) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id) => {
    await api.delete(`/media/${id}`);
    toast.success("Media deleted");
    load();
  };

  return (
    <div className="space-y-8" data-testid="media-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Assets</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-2">Media Manager</h1>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          data-testid="media-file-input"
          onChange={onUpload}
        />
        <Button
          data-testid="media-upload-button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          Upload
        </Button>
      </div>

      {media.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-20 text-center">
          <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No media yet. Upload images or videos to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="media-grid">
          {media.map((m) => (
            <div key={m.id} className="group relative rounded-xl overflow-hidden border border-border bg-card aspect-square">
              <button className="w-full h-full" onClick={() => setPreview(m)} data-testid={`media-item-${m.id}`}>
                {m.type === "image" ? (
                  <img src={mediaUrl(m.id)} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <Film className="h-10 w-10 text-primary" />
                  </div>
                )}
              </button>
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                <p className="text-xs truncate font-medium">{m.name}</p>
                <span className="text-[10px] uppercase tracking-wider text-primary">{m.type}</span>
              </div>
              <Button
                size="icon"
                variant="destructive"
                data-testid={`media-delete-${m.id}`}
                onClick={() => remove(m.id)}
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            preview.type === "image" ? (
              <img src={mediaUrl(preview.id)} alt={preview.name} className="w-full rounded-lg max-h-[70vh] object-contain" />
            ) : (
              <video src={mediaUrl(preview.id)} controls autoPlay className="w-full rounded-lg max-h-[70vh]" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
