/**
 * Vercel Serverless Function — POST /api/scrape
 * En preview/producción de Vercel no hay Playwright ni el monorepo completo; respondemos 503 con instrucciones.
 * El SPA rewrite ya no debe capturar /api/* (ver vercel.json).
 */
const { runScrapeJob } = require("../scrape-runner.cjs");

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

  if (process.env.VERCEL) {
    return res.status(503).json({
      error:
        "El scraper no puede ejecutarse en Vercel (Playwright, tiempo de ejecución y archivos del monorepo no están disponibles en el servidor).",
      hint: "En tu PC: cd dashboard && npm run dev (levanta API + Vite). En esta web podés Importar JSON y exportar Excel, o usar los botones de WhatsApp.",
    });
  }

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
};
