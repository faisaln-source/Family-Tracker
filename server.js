require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');

// Initialize DB (runs schema creation)
require('./db/database');

const app = express();

const { sseMiddleware } = require('./sse');

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/families', require('./routes/families.routes'));
app.use('/api/persons',  require('./routes/persons.routes'));
app.use('/api/tree',     require('./routes/tree.routes'));

// SSE Stream
app.get('/api/stream', sseMiddleware);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve Angular PWA ───────────────────────────────────────────────────────
const distPath = path.join(__dirname, 'frontend', 'dist', 'frontend', 'browser');
app.use(express.static(distPath));

// 404 handler for API routes only
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// SPA fallback — Angular handles all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌳 Family Tracker API running on http://localhost:${PORT}`);
  console.log(`📂 API docs available at http://localhost:${PORT}/api/health\n`);
});
