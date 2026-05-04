/**
 * Solo para el deploy en Vercel: el scraper (Playwright + monorepo) corre en local (server.cjs).
 * Handler mínimo — sin require, sin async — para evitar 500 por bundler / env / runtime.
 */
module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  res.status(503).json({
    error:
      "El scraper no puede ejecutarse en Vercel (Playwright, tiempo de ejecución y carpeta business-scraper no están en el servidor).",
    hint: "En tu PC: cd dashboard && npm run dev. En esta web usá Importar JSON, Exportar Excel y los enlaces de WhatsApp.",
  });
};
