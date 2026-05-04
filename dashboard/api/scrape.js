/**
 * Vercel Serverless Function — POST /api/scrape
 * En Vercel respondemos 503 sin cargar scrape-runner (evita 500 si el bundler no incluye .cjs / paths).
 * El require del runner solo corre fuera de Vercel (p. ej. self-hosted con Node).
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  try {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const onVercel =
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    Boolean(process.env.VERCEL_URL);

  if (onVercel) {
    return res.status(503).json({
      error:
        "El scraper no puede ejecutarse en Vercel (Playwright, tiempo de ejecución y archivos del monorepo no están disponibles en el servidor).",
      hint: "En tu PC: cd dashboard && npm run dev (levanta API + Vite). En esta web podés Importar JSON y exportar Excel, o usar los botones de WhatsApp.",
    });
  }

  const { runScrapeJob } = require("../scrape-runner.cjs");

  let body = req.body;
  if (body == null || typeof body !== "object") {
    try {
      body = await readJsonBody(req);
    } catch {
      body = {};
    }
  }

  const result = await runScrapeJob(body);
  return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("[api/scrape]", err);
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({
      error: "Error interno en /api/scrape",
      hint: String(err?.message || err),
    });
  }
};
