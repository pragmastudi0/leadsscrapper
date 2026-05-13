const express = require("express");
const { runScrapeJob } = require("./scrape-runner.cjs");

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/api/scrape", async (req, res) => {
  const result = await runScrapeJob(req.body);
  res.status(result.status).json(result.body);
});

const PORT = Number(process.env.API_PORT) || 8787;
app.listen(PORT, () => {
  console.log(`[leadsscraper-api] http://localhost:${PORT}`);
});
