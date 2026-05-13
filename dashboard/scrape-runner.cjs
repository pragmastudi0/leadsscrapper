const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const CONFIG_NAME = "scraper-user-config.json";

function getScraperDir() {
  if (process.env.SCRAPER_ROOT) return path.resolve(process.env.SCRAPER_ROOT);
  return path.resolve(__dirname, "..", "business-scraper");
}

/**
 * @param {object} body - req body: keywords, cities, limit, maxLeads
 * @returns {Promise<{ status: number, body: object }>}
 */
function runScrapeJob(body) {
  const { keywords, cities, limit, maxLeads } = body ?? {};

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return Promise.resolve({ status: 400, body: { error: "Indicá al menos una keyword." } });
  }
  if (!Array.isArray(cities) || cities.length === 0) {
    return Promise.resolve({ status: 400, body: { error: "Indicá al menos una ciudad." } });
  }

  const lim = Math.max(1, parseInt(String(limit), 10) || 20);
  const cap =
    maxLeads != null && maxLeads !== ""
      ? Math.max(0, parseInt(String(maxLeads), 10) || 0)
      : 0;

  const cleanKw = keywords.map((k) => String(k).trim()).filter(Boolean);
  const cleanCities = cities.map((c) => String(c).trim()).filter(Boolean);
  if (!cleanKw.length || !cleanCities.length) {
    return Promise.resolve({
      status: 400,
      body: { error: "Keywords o ciudades vacías tras normalizar." },
    });
  }

  const SCRAPER_DIR = getScraperDir();
  const configPath = path.join(SCRAPER_DIR, CONFIG_NAME);

  try {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ search: { keywords: cleanKw, cities: cleanCities, limit: lim } }, null, 2)
    );
  } catch (e) {
    return Promise.resolve({
      status: 500,
      body: { error: `No se pudo escribir la config: ${e.message}` },
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (status, payload) => {
      if (settled) return;
      settled = true;
      resolve({ status, body: payload });
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
}

module.exports = { runScrapeJob, getScraperDir };
