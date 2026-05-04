import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Zap, Loader2, Download, Save, Upload, MessageCircle, Play,
} from "lucide-react";

const STORAGE_KEY = "leadsscraper-search-config-v1";

function parseListInput(text) {
  return String(text || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Dígitos internacionales para wa.me (sin +) */
function phoneToWaDigits(phone) {
  if (phone == null || phone === "") return null;
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function phoneToWaMeUrl(phone) {
  const d = phoneToWaDigits(phone);
  if (!d) return null;
  return `https://wa.me/${d}`;
}

function normalizeImportedLead(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    nombre: raw.nombre ?? "",
    apellido: raw.apellido ?? "",
    nombreLocal: raw.nombreLocal ?? "",
    ciudad: raw.ciudad ?? "",
    direccion: raw.direccion ?? "",
    email: raw.email ?? "",
    telefono: raw.telefono ?? "",
    instagram: raw.instagram ?? "",
    tipoNegocio: raw.tipoNegocio ?? "",
    productos: Array.isArray(raw.productos) ? raw.productos : [],
    fuente: raw.fuente ?? "",
    urlFuente: raw.urlFuente ?? "",
    fechaExtraccion: raw.fechaExtraccion ?? "",
  };
}

function leadsToExcelRows(leads) {
  return leads.map((lead) => {
    const wa = phoneToWaMeUrl(lead.telefono);
    return {
      Nombre: lead.nombre ?? "",
      Apellido: lead.apellido ?? "",
      "Nombre Local": lead.nombreLocal ?? "",
      Ciudad: lead.ciudad ?? "",
      Dirección: lead.direccion ?? "",
      Email: lead.email ?? "",
      Teléfono: lead.telefono ?? "",
      WhatsApp: wa ?? "",
      Instagram: lead.instagram ?? "",
      "Tipo de Negocio": lead.tipoNegocio ?? "",
      Productos: Array.isArray(lead.productos) ? lead.productos.join("; ") : "",
      Fuente: lead.fuente ?? "",
      "URL Fuente": lead.urlFuente ?? "",
      "Fecha Extracción":
        typeof lead.fechaExtraccion === "string" && lead.fechaExtraccion
          ? lead.fechaExtraccion
          : lead.fechaExtraccion
            ? new Date(lead.fechaExtraccion).toISOString()
            : "",
    };
  });
}

function exportLeadsToXlsx(leads, filename = "leads.xlsx") {
  const rows = leadsToExcelRows(leads);
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  XLSX.writeFile(wb, filename);
}

const C = {
  bg: "#000000",
  border: "#111111",
  lime: "#c8f04a",
  dimText: "#555555",
  midText: "#888888",
  white: "#ffffff",
  wa: "#25D366",
};

function Label11({ children, style }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        color: C.dimText,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

const inputStyle = {
  width: "100%",
  background: "#050505",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  color: C.white,
  fontSize: 13,
  padding: "12px 14px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

export default function ScraperDashboard() {
  const [searchKeywordsText, setSearchKeywordsText] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.keywordsText != null) return data.keywordsText;
      }
    } catch { /* ignore */ }
    return "restaurante, cafetería";
  });
  const [searchCitiesText, setSearchCitiesText] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.citiesText != null) return data.citiesText;
      }
    } catch { /* ignore */ }
    return "Córdoba, Buenos Aires";
  });
  const [searchLimit, setSearchLimit] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.limit != null) return String(data.limit);
      }
    } catch { /* ignore */ }
    return "30";
  });
  /** Tope máximo de filas en previsualización / respuesta (vacío = sin tope) */
  const [maxTotalLeads, setMaxTotalLeads] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.maxTotalLeads != null) return String(data.maxTotalLeads);
      }
    } catch { /* ignore */ }
    return "";
  });

  const [leads, setLeads] = useState([]);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [scrapeStatus, setScrapeStatus] = useState("idle");
  const [lastError, setLastError] = useState("");
  const [lastDetail, setLastDetail] = useState("");
  const leadsFileRef = useRef(null);

  const persistSearchConfig = () => {
    const limit = Math.max(1, parseInt(searchLimit, 10) || 30);
    const maxRaw = maxTotalLeads.trim();
    const maxParsed = maxRaw === "" ? "" : Math.max(0, parseInt(maxRaw, 10) || 0);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        keywordsText: searchKeywordsText,
        citiesText: searchCitiesText,
        limit,
        maxTotalLeads: maxParsed === "" ? "" : maxParsed,
      })
    );
  };

  const onLeadsJsonSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const arr = Array.isArray(parsed) ? parsed : parsed.leads;
        if (!Array.isArray(arr)) return;
        const next = arr.map(normalizeImportedLead).filter(Boolean);
        setLeads(next);
        setPreviewMeta({ totalBeforeCap: next.length, capped: false, fromFile: true });
        setLastError("");
        setLastDetail("");
        setScrapeStatus("idle");
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const runScrape = async () => {
    persistSearchConfig();
    const keywords = parseListInput(searchKeywordsText);
    const cities = parseListInput(searchCitiesText);
    if (!keywords.length) {
      setLastError("Agregá al menos una keyword.");
      return;
    }
    if (!cities.length) {
      setLastError("Agregá al menos una ciudad.");
      return;
    }

    setScrapeStatus("running");
    setLastError("");
    setLastDetail("");
    setPreviewMeta(null);

    const limit = Math.max(1, parseInt(searchLimit, 10) || 30);
    const body = { keywords, cities, limit };
    const maxRaw = maxTotalLeads.trim();
    if (maxRaw !== "") {
      const m = parseInt(maxRaw, 10);
      if (Number.isFinite(m) && m > 0) body.maxLeads = m;
    }

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setScrapeStatus("error");
        setLastError(data.error || `Error ${res.status}`);
        const detail = [data.stderr, data.stdout].filter(Boolean).join("\n---\n");
        setLastDetail(detail);
        return;
      }

      const list = Array.isArray(data.leads) ? data.leads : [];
      const normalized = list.map(normalizeImportedLead).filter(Boolean);
      setLeads(normalized);
      setPreviewMeta({
        totalBeforeCap: data.totalBeforeCap ?? normalized.length,
        capped: !!data.capped,
        fromFile: false,
      });
      setScrapeStatus("done");
    } catch (err) {
      setScrapeStatus("error");
      setLastError(err.message || "No se pudo conectar al API. ¿Corriste npm run dev en /dashboard?");
      setLastDetail("");
    }
  };

  const gridStyle = {
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
  };

  const running = scrapeStatus === "running";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 99px; }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: C.bg,
          fontFamily: "'Inter', sans-serif",
          color: C.white,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...gridStyle,
        }}
      >
        <header
          style={{
            flexShrink: 0,
            height: 52,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: 20,
            paddingRight: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: C.lime,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={16} color="#000" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Lead Scraper</div>
              <div style={{ fontSize: 11, color: C.dimText }}>
                Configuración → ejecutar → previsualizar → Excel / WhatsApp
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.dimText, fontFamily: "monospace" }}>
            {running ? "Scraping…" : scrapeStatus === "done" ? "Listo" : scrapeStatus === "error" ? "Error" : "Listo para ejecutar"}
          </div>
        </header>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(300px, 380px) 1fr",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Panel configuración */}
          <aside
            style={{
              borderRight: `1px solid ${C.border}`,
              padding: 20,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              background: "#050505",
            }}
          >
            <div>
              <Label11 style={{ display: "block", marginBottom: 8 }}>Búsqueda</Label11>
              <p style={{ margin: 0, fontSize: 12, color: C.midText, lineHeight: 1.45 }}>
                Keywords × ciudades en Google Maps. El límite es por cada combinación.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label11>Keywords</Label11>
              <textarea
                value={searchKeywordsText}
                onChange={(e) => setSearchKeywordsText(e.target.value)}
                rows={4}
                placeholder="restaurante, bar, peluquería…"
                style={{ ...inputStyle, resize: "vertical", minHeight: 88 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Label11>Ciudades</Label11>
              <textarea
                value={searchCitiesText}
                onChange={(e) => setSearchCitiesText(e.target.value)}
                rows={3}
                placeholder="Córdoba, Rosario…"
                style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label11>Límite / búsqueda</Label11>
                <input
                  type="number"
                  min={1}
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label11>Tope en vista (opc.)</Label11>
                <input
                  type="number"
                  min={0}
                  placeholder="sin tope"
                  value={maxTotalLeads}
                  onChange={(e) => setMaxTotalLeads(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: C.dimText }}>
              Si ponés un tope, el scraper sigue completo pero la app muestra y exporta solo esos leads.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                disabled={running}
                onClick={runScrape}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: running ? "#333" : C.lime,
                  color: running ? C.dimText : "#000",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: running ? "not-allowed" : "pointer",
                }}
              >
                {running ? (
                  <>
                    <Loader2 size={18} style={{ animation: "spin 0.9s linear infinite" }} />
                    Ejecutando scraper…
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    RUN — Scrape
                  </>
                )}
              </button>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={persistSearchConfig}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: "#111",
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Save size={14} /> Guardar config
                </button>
                <input
                  ref={leadsFileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={onLeadsJsonSelected}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => leadsFileRef.current?.click()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: "#111",
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={14} /> Importar JSON
                </button>
              </div>
            </div>

            {lastError && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#1a0a0a",
                  border: "1px solid #3a2020",
                }}
              >
                <div style={{ fontSize: 12, color: "#f08080", fontWeight: 600, marginBottom: 6 }}>
                  {lastError}
                </div>
                {lastDetail && (
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: C.midText,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 160,
                      overflow: "auto",
                    }}
                  >
                    {lastDetail}
                  </pre>
                )}
              </div>
            )}
          </aside>

          {/* Previsualización */}
          <main
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              padding: 20,
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <Label11 style={{ display: "block", marginBottom: 4 }}>Previsualización</Label11>
                <div style={{ fontSize: 13, color: C.midText }}>
                  {leads.length === 0
                    ? "Ejecutá el scraper o importá un leads.json."
                    : previewMeta?.capped
                      ? `Mostrando ${leads.length} de ${previewMeta.totalBeforeCap} leads.`
                      : `${leads.length} lead${leads.length === 1 ? "" : "s"}.`}
                </div>
              </div>
              <button
                type="button"
                disabled={!leads.length}
                onClick={() => exportLeadsToXlsx(leads, "leads.xlsx")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: leads.length ? C.lime : "#333",
                  color: leads.length ? "#000" : C.dimText,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: leads.length ? "pointer" : "not-allowed",
                }}
              >
                <Download size={16} />
                Exportar Excel
              </button>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                background: "#050505",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                overflow: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ position: "sticky", top: 0, background: "#0a0a0a", zIndex: 1 }}>
                  <tr>
                    {["Local", "Ciudad", "Teléfono", "WhatsApp", "Email", "IG", "Fuente"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderBottom: `1px solid ${C.border}`,
                          color: C.dimText,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, color: C.dimText, textAlign: "center" }}>
                        Sin datos. Usá RUN o importá JSON.
                      </td>
                    </tr>
                  ) : (
                    leads.map((row, i) => {
                      const wa = phoneToWaMeUrl(row.telefono);
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: "10px 12px", color: C.white, maxWidth: 180, wordBreak: "break-word" }}>
                            {row.nombreLocal}
                          </td>
                          <td style={{ padding: "10px 12px", color: C.midText }}>{row.ciudad}</td>
                          <td style={{ padding: "10px 12px", color: C.midText, whiteSpace: "nowrap" }}>
                            {row.telefono || "—"}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={wa}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "4px 10px",
                                  borderRadius: 8,
                                  background: "rgba(37, 211, 102, 0.12)",
                                  color: C.wa,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  textDecoration: "none",
                                }}
                              >
                                <MessageCircle size={14} />
                                WA
                              </a>
                            ) : (
                              <span style={{ color: C.dimText }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: C.midText, maxWidth: 160, wordBreak: "break-all" }}>
                            {row.email || "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: C.midText }}>{row.instagram || "—"}</td>
                          <td style={{ padding: "10px 12px", color: C.dimText }}>{row.fuente}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
