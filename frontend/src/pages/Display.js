import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Marquee from "react-fast-marquee";
import { api, mediaUrl, wsUrl } from "@/lib/api";

const CACHE_KEY = (id) => `hm_display_${id}`;

export default function Display() {
  const { tvId } = useParams();
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  const fetchContent = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/display/${tvId}`);
      setData(d);
      setError("");
      localStorage.setItem(CACHE_KEY(tvId), JSON.stringify(d));
    } catch (e) {
      const cached = localStorage.getItem(CACHE_KEY(tvId));
      if (cached) {
        setData(JSON.parse(cached));
      } else if (e.response?.status === 404) {
        setError("This TV is not registered. Register it in the admin panel.");
      } else {
        setError("Unable to load content.");
      }
    }
  }, [tvId]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Online/offline
  useEffect(() => {
    const on = () => { setOnline(true); fetchContent(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [fetchContent]);

  // Initial fetch + WebSocket realtime
  useEffect(() => {
    fetchContent();
    let alive = true;
    let hb;
    const connect = () => {
      if (!alive) return;
      try {
        const ws = new WebSocket(wsUrl(tvId));
        wsRef.current = ws;
        ws.onopen = () => {
          hb = setInterval(() => { try { ws.send("ping"); } catch (e) {} }, 20000);
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "reload") { setIndex(0); fetchContent(); }
            if (msg.type === "restart") window.location.reload();
          } catch (e) {}
        };
        ws.onclose = () => { clearInterval(hb); if (alive) setTimeout(connect, 4000); };
        ws.onerror = () => { try { ws.close(); } catch (e) {} };
      } catch (e) {
        setTimeout(connect, 4000);
      }
    };
    connect();
    return () => { alive = false; clearInterval(hb); if (wsRef.current) wsRef.current.close(); };
  }, [tvId, fetchContent]);

  const items = data?.items || [];
  const current = items[index];

  // Preload next images
  useEffect(() => {
    items.forEach((it) => { if (it.type === "image") { const img = new Image(); img.src = mediaUrl(it.id); } });
  }, [items]);

  // Slideshow advance (images use duration; videos advance on end)
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!current || items.length === 0) return;
    if (current.type === "image") {
      timerRef.current = setTimeout(() => setIndex((i) => (i + 1) % items.length), (current.duration || 8) * 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [current, items.length]);

  const settings = data?.settings || {};
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  if (error) {
    return (
      <div className="tv-display flex items-center justify-center text-center px-8">
        <div>
          <h1 className="font-display text-4xl font-bold text-primary">HALALMART</h1>
          <p className="mt-4 text-xl text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-display relative" data-testid="tv-display">
      {/* Media layer z-0 */}
      <div className="absolute inset-0 z-0 bg-black">
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={`${current.id}-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute inset-0"
            >
              {current.type === "image" ? (
                <motion.img
                  src={mediaUrl(current.id)}
                  alt=""
                  className="w-full h-full object-cover"
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.06 }}
                  transition={{ duration: (current.duration || 8) + 1, ease: "linear" }}
                />
              ) : (
                <video
                  src={mediaUrl(current.id)}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                  onEnded={() => setIndex((i) => (i + 1) % items.length)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h1 className="font-display text-6xl font-bold text-primary">{settings.store_name || "HALALMART"}</h1>
              <p className="mt-4 text-2xl text-white/50">Awaiting content…</p>
            </div>
          </div>
        )}
      </div>

      {/* Gradient overlay z-10 */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/90 via-black/10 to-black/40" />

      {/* Logo top-left z-20 */}
      <div className="absolute top-8 left-10 z-20 flex items-center gap-4">
        {settings.logo_media_id ? (
          <img src={mediaUrl(settings.logo_media_id)} alt="logo" className="h-16 max-w-[220px] object-contain drop-shadow-lg" />
        ) : (
          <span className="font-display text-3xl font-extrabold text-white drop-shadow-lg tracking-tight">
            {settings.store_name || "HALALMART"}
          </span>
        )}
      </div>

      {/* Clock top-right z-20 */}
      <div className="absolute top-8 right-10 z-20 text-right">
        <p className="font-mono text-6xl font-bold text-white leading-none drop-shadow-lg tabular-nums">{timeStr}</p>
        <p className="text-white/70 text-lg mt-2 font-medium">{dateStr}</p>
      </div>

      {/* Connection dot */}
      <div className="absolute bottom-28 right-10 z-20 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-[#10B981]" : "bg-[#ef4444]"}`} />
      </div>

      {/* Running text ticker z-30 */}
      {settings.ticker_text && (
        <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black via-black/90 to-transparent pt-8 pb-5">
          <div className="border-t-2 border-primary/60 pt-4">
            <Marquee gradient={false} speed={70} className="overflow-hidden">
              <span className="text-4xl md:text-5xl font-bold tracking-tight uppercase text-white px-8">
                {settings.ticker_text}
              </span>
              <span className="text-primary text-4xl md:text-5xl px-4">•</span>
            </Marquee>
          </div>
        </div>
      )}
    </div>
  );
}
