const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const SCRAPER_DIR = path.resolve(__dirname, "../business-scraper");
const CONFIG_NAME = "scraper-user-config.json";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/api/scrape", (req, res) => {
  const { keywords, cities, limit, maxLeads } = req.body ?? {};

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: "Indicá al menos una keyword." });
  }
  if (!Array.isArray(cities) || cities.length === 0) {
    return res.status(400).json({ error: "Indicá al menos una ciudad." });
  }

  const lim = Math.max(1, parseInt(String(limit), 10) || 20);
  const cap =
    maxLeads != null && maxLeads !== ""
      ? Math.max(0, parseInt(String(maxLeads), 10) || 0)
      : 0;

  const cleanKw = keywords.map((k) => String(k).trim()).filter(Boolean);
  const cleanCities = cities.map((c) => String(c).trim()).filter(Boolean);
  if (!cleanKw.length || !cleanCities.length) {
    return res.status(400).json({ error: "Keywords o ciudades vacías tras normalizar." });
  }

  const configPath = path.join(SCRAPER_DIR, CONFIG_NAME);
  try {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ search: { keywords: cleanKw, cities: cleanCities, limit: lim } }, null, 2)
    );
  } catch (e) {
    return res.status(500).json({ error: `No se pudo escribir la config: ${e.message}` });
  }

  let settled = false;
  const finish = (status, body) => {
    if (settled) return;
    settled = true;
    res.status(status).json(body);
  };

  const child = spawn("npm", ["run", "scrape", "--silent"], {
    cwd: SCRAPER_DIR,
    env: { ...process.env, FORCE_COLOR: "0" },
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  let stdout = "";
  child.stderr?.on("data", (d) => {
    stderr += d.toString();
  });
  child.stdout?.on("data", (d) => {
    stdout += d.toString();
  });

  child.on("error", (err) => {
    finish(500, { error: err.message || String(err) });
  });

  child.on("close", (code) => {
    if (settled) return;

    const leadsPath = path.join(SCRAPER_DIR, "output", "leads.json");
    if (code !== 0) {
      return finish(500, {
        error: "El scraper terminó con error.",
        code,
        stderr: stderr.slice(-6000),
        stdout: stdout.slice(-4000),
      });
    }

    try {
      if (!fs.existsSync(leadsPath)) {
        return finish(500, {
          error: "No se encontró output/leads.json tras el scrape.",
          stderr: stderr.slice(-4000),
        });
      }
      const raw = fs.readFileSync(leadsPath, "utf8");
      let list = JSON.parse(raw);
      list = Array.isArray(list) ? list : [];
      const totalBeforeCap = list.length;
      const capped = cap > 0 ? list.slice(0, cap) : list;
      finish(200, {
        leads: capped,
        count: capped.length,
        totalBeforeCap,
        capped: cap > 0 && totalBeforeCap > capped.length,
      });
    } catch (e) {
      finish(500, { error: `No se pudo leer leads.json: ${e.message}` });
    }
  });
});

const PORT = Number(process.env.API_PORT) || 8787;
app.listen(PORT, () => {
  console.log(`[leadsscraper-api] http://localhost:${PORT}`);
});
