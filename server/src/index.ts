import { Hono } from "hono";
import { cors } from "hono/cors";
import analyzeRouter from "./routes/analyze";

const app = new Hono();

// Enable CORS for frontend communication
app.use("*", cors());

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", message: "PhishDetect API running" });
});

// Analyze endpoint
app.route("/api/analyze", analyzeRouter);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

const port = 8000;

export default {
  port,
  fetch: app.fetch,
};
