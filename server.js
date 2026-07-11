require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/boxer', require('./backend/routes/boxer'));
app.use('/api/coach', require('./backend/routes/coach'));
app.use('/api/events', require('./backend/routes/events'));
app.use('/api/admin', require('./backend/routes/admin'));
app.use('/api/training', require('./backend/routes/training'));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const { initDb } = require('./backend/db');

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🥊 Snatch Boxing Academy démarré sur http://localhost:${PORT}`);
    console.log(`   Coach : coach@boxing.fr / coach123\n`);
  });
}).catch(err => {
  console.error('Erreur initialisation base de données :', err);
  process.exit(1);
});
