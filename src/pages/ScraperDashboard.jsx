import { useState, useEffect, useRef } from "react";
import {
  Search, Database, Activity, Settings, Zap,
  Play, BarChart2, Filter, Globe, Instagram,
  MapPin, ArrowUpRight, Clock, CheckCircle2,
  AlertCircle, Loader2, ChevronRight, Terminal
} from "lucide-react";

// ─── Mock data ────────────────────────────────────────────────────────────────
const SOURCES = [
  { id: "gm",  label: "Google Maps", icon: MapPin,     leads: 1842, pct: 65, trend: +12 },
  { id: "ig",  label: "Instagram",   icon: Instagram,  leads: 681,  pct: 24, trend: +3  },
  { id: "web", label: "Websites",    icon: Globe,      leads: 324,  pct: 11, trend: -1  },
];

const FEED = [
  { id: 1, type: "success", dot: "#c8f04a", msg: "Google Maps · Restaurante El Portal — extraído",   ts: "09:41:02" },
  { id: 2, type: "success", dot: "#c8f04a", msg: "Google Maps · Café Lumière — extraído",             ts: "09:40:58" },
  { id: 3, type: "dup",     dot: "#555",    msg: "Dedup · Panadería Central — duplicado removido",    ts: "09:40:55" },
  { id: 4, type: "info",    dot: "#4a90f0", msg: "Instagram · @peluqueria.ba — perfil scrapeado",     ts: "09:40:51" },
  { id: 5, type: "warn",    dot: "#f0a04a", msg: "Website · sin datos de contacto — descartado",      ts: "09:40:48" },
  { id: 6, type: "success", dot: "#c8f04a", msg: "Google Maps · Ferretería Sur — extraído",           ts: "09:40:44" },
  { id: 7, type: "info",    dot: "#4a90f0", msg: "Instagram · @barbershop.cba — perfil scrapeado",    ts: "09:40:41" },
  { id: 8, type: "success", dot: "#c8f04a", msg: "Google Maps · Óptica Visión Total — extraído",      ts: "09:40:38" },
  { id: 9, type: "dup",     dot: "#555",    msg: "Dedup · La Esquina Pizzería — duplicado removido",  ts: "09:40:34" },
  { id: 10,type: "success", dot: "#c8f04a", msg: "Website · tallercito.com.ar — email capturado",     ts: "09:40:30" },
];

const MINI_STATS = [
  { label: "FUENTES ACTIVAS",      value: "3",      unit: "",    },
  { label: "DEDUP REMOVIDOS",      value: "412",    unit: "",    },
  { label: "TASA DE ÉXITO",        value: "94.2",   unit: "%",   },
  { label: "TIEMPO PROMEDIO",      value: "2:34",   unit: "min", },
];

const NAV = [
  { icon: Activity,   label: "Dashboard",   active: true  },
  { icon: Search,     label: "Búsquedas",   active: false },
  { icon: Database,   label: "Leads",       active: false },
  { icon: BarChart2,  label: "Reportes",    active: false },
  { icon: Filter,     label: "Filtros",     active: false },
];

// ─── Inline style tokens ──────────────────────────────────────────────────────
const C = {
  bg:       "#000000",
  panel:    "#080808",
  border:   "#111111",
  lime:     "#c8f04a",
  dimText:  "#555555",
  midText:  "#888888",
  white:    "#ffffff",
};

// ─── Tiny sub-components ─────────────────────────────────────────────────────
function Dot({ color, pulse = false }) {
  return (
    <span style={{
      display: "inline-block",
      width: 6, height: 6,
      borderRadius: "50%",
      background: color,
      flexShrink: 0,
      animation: pulse ? "pulse 2s ease-in-out infinite" : "none",
    }} />
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 3, background: C.border, borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${pct}%`,
        background: C.lime,
        borderRadius: 99,
        transition: "width 1s ease",
      }} />
    </div>
  );
}

function Label11({ children, style }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: "1.5px",
      textTransform: "uppercase",
      color: C.dimText,
      ...style,
    }}>
      {children}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ScraperDashboard() {
  const [tick, setTick] = useState(0);
  const [heroVal, setHeroVal] = useState(2847);
  const [running, setRunning] = useState(true);
  const [feedItems, setFeedItems] = useState(FEED);
  const feedRef = useRef(null);

  // Simulate live counter
  useEffect(() => {
    const t = setInterval(() => {
      if (running) {
        setTick(p => p + 1);
        if (Math.random() > 0.6) setHeroVal(p => p + 1);
      }
    }, 1800);
    return () => clearInterval(t);
  }, [running]);

  // Simulate new feed events
  useEffect(() => {
    const t = setInterval(() => {
      if (!running) return;
      const now = new Date();
      const ts = now.toTimeString().slice(0, 8);
      const msgs = [
        { type: "success", dot: "#c8f04a", msg: `Google Maps · nuevo negocio extraído` },
        { type: "info",    dot: "#4a90f0", msg: `Instagram · perfil scrapeado` },
        { type: "dup",     dot: "#555",    msg: `Dedup · duplicado removido` },
      ];
      const next = msgs[Math.floor(Math.random() * msgs.length)];
      setFeedItems(prev => [{ id: Date.now(), ...next, ts }, ...prev.slice(0, 19)]);
    }, 3200);
    return () => clearInterval(t);
  }, [running]);

  const gridStyle = {
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
  };

  const glowRadial = {
    position: "absolute",
    top: 0, right: 0,
    width: 600, height: 600,
    background: "radial-gradient(circle at top right, rgba(200,240,74,0.06) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  };

  return (
    <>
      {/* Keyframe animations injected once */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .feed-item { animation: fadeInDown 0.3s ease; }
        .nav-icon:hover { background: #111 !important; }
        .hero-card { position: relative; overflow: hidden; }
        .hero-card::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 30% 50%, rgba(200,240,74,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .source-row:hover { background: #0a0a0a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 99px; }
      `}</style>

      {/* Root: full-screen takeover */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: C.bg,
        fontFamily: "'Inter', sans-serif",
        color: C.white,
        display: "flex",
        overflow: "hidden",
        ...gridStyle,
      }}>
        {/* Radial glow */}
        <div style={glowRadial} />

        {/* ── Sidebar (60px) ────────────────────────────── */}
        <aside style={{
          width: 60,
          height: "100%",
          background: C.bg,
          borderRight: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 16,
          paddingBottom: 16,
          zIndex: 1,
          flexShrink: 0,
        }}>
          {/* Logo mark */}
          <div style={{
            width: 32, height: 32,
            background: C.lime,
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 28,
            flexShrink: 0,
          }}>
            <Zap size={16} color="#000" strokeWidth={2.5} />
          </div>

          {/* Nav icons */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            {NAV.map(({ icon: Icon, label, active }) => (
              <button
                key={label}
                title={label}
                className="nav-icon"
                style={{
                  width: 40, height: 40,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: active ? "#111" : "transparent",
                  transition: "background 0.15s",
                  position: "relative",
                }}
              >
                <Icon size={16} color={active ? C.lime : C.dimText} strokeWidth={active ? 2 : 1.5} />
                {active && (
                  <div style={{
                    position: "absolute", right: -1, top: "50%",
                    transform: "translateY(-50%)",
                    width: 2, height: 20,
                    background: C.lime,
                    borderRadius: 99,
                  }} />
                )}
              </button>
            ))}
          </nav>

          {/* Bottom settings */}
          <button
            title="Settings"
            className="nav-icon"
            style={{
              width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <Settings size={16} color={C.dimText} strokeWidth={1.5} />
          </button>
        </aside>

        {/* ── Main area ──────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1 }}>

          {/* ── Header ──────────────────────────────────── */}
          <header style={{
            height: 52,
            borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center",
            paddingLeft: 24, paddingRight: 24,
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: C.dimText }}>System</span>
              <ChevronRight size={12} color={C.dimText} />
              <span style={{ fontSize: 12, color: C.midText }}>Scraper</span>
              <ChevronRight size={12} color={C.dimText} />
              <span style={{ fontSize: 12, color: C.white, fontWeight: 500 }}>Dashboard</span>
            </div>

            {/* Right controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Live badge */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px",
                borderRadius: 99,
                border: `1px solid #1a1a1a`,
                background: "rgba(200,240,74,0.06)",
              }}>
                <Dot color={running ? C.lime : "#555"} pulse={running} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: "1px",
                  color: running ? C.lime : C.dimText,
                  fontFamily: "monospace",
                }}>
                  {running ? "LIVE" : "PAUSED"}
                </span>
              </div>

              {/* Toggle run button */}
              <button
                onClick={() => setRunning(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: running ? "#1a1a1a" : C.white,
                  color: running ? C.midText : "#000",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.3px",
                  transition: "all 0.15s",
                }}
              >
                {running
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Pause</>
                  : <><Play size={13} />New Run</>
                }
              </button>
            </div>
          </header>

          {/* ── Content: 2 columns ───────────────────────── */}
          <div style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            gap: 0,
            overflow: "hidden",
          }}>

            {/* ── LEFT COLUMN ─────────────────────────────── */}
            <div style={{
              display: "flex", flexDirection: "column",
              padding: "24px 20px 24px 24px",
              gap: 16,
              overflow: "hidden",
              borderRight: `1px solid ${C.border}`,
            }}>

              {/* Hero stat card */}
              <div
                className="hero-card"
                style={{
                  background: "#050505",
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "24px 28px",
                  boxShadow: "0 0 40px rgba(200,240,74,0.04), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <Label11 style={{ display: "block", marginBottom: 10 }}>LEADS CAPTURADOS</Label11>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{
                        fontSize: 48,
                        fontWeight: 700,
                        letterSpacing: "-2px",
                        color: C.white,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {heroVal.toLocaleString("es-AR")}
                      </span>
                      <span style={{ fontSize: 14, color: C.lime, fontWeight: 600 }}>
                        +{Math.floor(tick * 0.7)}
                      </span>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                      <Label11>esta sesión</Label11>
                      <span style={{ color: C.border }}>·</span>
                      <span style={{ fontSize: 11, color: C.midText, fontFamily: "monospace" }}>
                        v2.1.0
                      </span>
                    </div>
                  </div>

                  {/* Pill badge */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px",
                    borderRadius: 99,
                    background: "rgba(200,240,74,0.08)",
                    border: "1px solid rgba(200,240,74,0.15)",
                    alignSelf: "flex-start",
                  }}>
                    <Dot color={C.lime} pulse />
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: C.lime,
                      letterSpacing: "0.8px",
                    }}>ACTIVO</span>
                  </div>
                </div>

                {/* Wide progress bar at bottom */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <Label11>progreso de ejecución</Label11>
                    <span style={{ fontSize: 11, color: C.midText, fontFamily: "monospace" }}>
                      {Math.min(100, Math.floor((tick / 60) * 100) % 101)}%
                    </span>
                  </div>
                  <ProgressBar pct={Math.min(100, Math.floor((tick / 60) * 100) % 101)} />
                </div>
              </div>

              {/* Mini stats 2×2 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1,
                background: C.border,
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${C.border}`,
                flexShrink: 0,
              }}>
                {MINI_STATS.map(({ label, value, unit }) => (
                  <div key={label} style={{
                    background: "#050505",
                    padding: "16px 18px",
                  }}>
                    <Label11 style={{ display: "block", marginBottom: 6 }}>{label}</Label11>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{
                        fontSize: 22, fontWeight: 700,
                        color: C.white,
                        letterSpacing: "-0.5px",
                        fontVariantNumeric: "tabular-nums",
                      }}>{value}</span>
                      {unit && (
                        <span style={{ fontSize: 12, color: C.dimText, fontWeight: 500 }}>{unit}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Activity feed */}
              <div style={{
                flex: 1,
                background: "#050505",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}>
                <div style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Terminal size={13} color={C.dimText} />
                    <Label11>ACTIVIDAD EN VIVO</Label11>
                  </div>
                  <span style={{ fontSize: 11, color: C.dimText, fontFamily: "monospace" }}>
                    {feedItems.length} eventos
                  </span>
                </div>
                <div
                  ref={feedRef}
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "8px 0",
                  }}
                >
                  {feedItems.map((item) => (
                    <div
                      key={item.id}
                      className="feed-item"
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "7px 18px",
                        transition: "background 0.1s",
                      }}
                    >
                      <Dot color={item.dot} />
                      <span style={{
                        fontSize: 12, color: C.midText,
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>{item.msg}</span>
                      <span style={{
                        fontSize: 10, color: C.dimText,
                        fontFamily: "monospace",
                        flexShrink: 0,
                      }}>{item.ts}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ────────────────────────────── */}
            <div style={{
              display: "flex", flexDirection: "column",
              padding: "24px",
              gap: 16,
              overflowY: "auto",
            }}>

              {/* Source ranking */}
              <div style={{
                background: "#050505",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <BarChart2 size={13} color={C.dimText} />
                  <Label11>FUENTES — RANKING</Label11>
                </div>
                <div style={{ padding: "8px 0" }}>
                  {SOURCES.map(({ id, label, icon: Icon, leads, pct, trend }) => (
                    <div
                      key={id}
                      className="source-row"
                      style={{
                        padding: "12px 18px",
                        cursor: "default",
                        transition: "background 0.1s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon size={13} color={C.midText} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.white }}>
                            {label}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: C.white,
                            fontVariantNumeric: "tabular-nums",
                          }}>
                            {leads.toLocaleString("es-AR")}
                          </span>
                          <span style={{
                            fontSize: 10,
                            color: trend > 0 ? C.lime : "#f04a4a",
                            display: "flex", alignItems: "center", gap: 1,
                          }}>
                            <ArrowUpRight size={9} style={{ transform: trend < 0 ? "rotate(90deg)" : "none" }} />
                            {Math.abs(trend)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar pct={pct} />
                        </div>
                        <span style={{ fontSize: 10, color: C.dimText, fontFamily: "monospace", width: 28, textAlign: "right" }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Run status card */}
              <div style={{
                background: "#050505",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Activity size={13} color={C.dimText} />
                  <Label11>STATUS DE EJECUCIÓN</Label11>
                </div>
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Google Maps scraper", status: running ? "running" : "idle" },
                    { label: "Instagram scraper",   status: running ? "running" : "idle" },
                    { label: "Website scraper",     status: "idle"                       },
                    { label: "Deduplicación",       status: running ? "running" : "idle" },
                    { label: "Export CSV / JSON",   status: "done"                       },
                  ].map(({ label, status }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: C.midText }}>{label}</span>
                      <StatusBadge status={status} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Config snapshot */}
              <div style={{
                background: "#050505",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Settings size={13} color={C.dimText} />
                    <Label11>CONFIGURACIÓN</Label11>
                  </div>
                  <span style={{
                    fontSize: 10, color: C.dimText,
                    fontFamily: "monospace",
                    padding: "2px 6px",
                    background: "#0d0d0d",
                    borderRadius: 4,
                    border: `1px solid ${C.border}`,
                  }}>
                    .env
                  </span>
                </div>
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
                  {[
                    { key: "KEYWORDS",  val: "restaurante, cafetería" },
                    { key: "CIUDADES",  val: "Córdoba, Bs. As."        },
                    { key: "LÍMITE",    val: "50 por fuente"           },
                    { key: "HEADLESS",  val: "true"                    },
                    { key: "SENSIB.",   val: "media"                   },
                  ].map(({ key, val }) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{
                        fontSize: 10, color: C.dimText,
                        fontFamily: "monospace",
                        letterSpacing: "0.5px",
                      }}>{key}</span>
                      <span style={{ fontSize: 11, color: C.midText }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer timestamp */}
              <div style={{
                padding: "10px 4px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 10, color: C.dimText, fontFamily: "monospace" }}>
                  business-scraper
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Dot color={C.border} />
                  <span style={{ fontSize: 10, color: C.dimText, fontFamily: "monospace" }}>
                    {new Date().toLocaleTimeString("es-AR")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Status badge sub-component ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    running: { dot: "#c8f04a", label: "RUNNING",  pulse: true  },
    done:    { dot: "#4a90f0", label: "DONE",      pulse: false },
    idle:    { dot: "#333",    label: "IDLE",      pulse: false },
    error:   { dot: "#f04a4a", label: "ERROR",     pulse: true  },
  };
  const { dot, label, pulse } = config[status] ?? config.idle;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "3px 8px",
      borderRadius: 99,
      background: "#0d0d0d",
      border: "1px solid #151515",
    }}>
      <Dot color={dot} pulse={pulse} />
      <span style={{
        fontSize: 10, fontWeight: 600,
        letterSpacing: "0.8px",
        color: status === "running" ? "#c8f04a" : status === "done" ? "#4a90f0" : "#333",
        fontFamily: "monospace",
      }}>{label}</span>
    </div>
  );
}
