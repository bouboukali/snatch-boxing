require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve uploaded files (auth check done at route level for download)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/boxer', require('./backend/routes/boxer'));
app.use('/api/coach', require('./backend/routes/coach'));
app.use('/api/events', require('./backend/routes/events'));
app.use('/api/admin', require('./backend/routes/admin'));
app.use('/api/training', require('./backend/routes/training'));

// SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🥊 Snatch Boxing Academy démarré sur http://localhost:${PORT}`);
  console.log(`   Coach : coach@boxing.fr / coach123\n`);
});
