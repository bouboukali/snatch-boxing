const app = require('./backend/app');
const { initDb } = require('./backend/db');

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🥊 Snatch Boxing Academy démarré sur http://localhost:${PORT}`);
    console.log(`   Coach : coach@boxing.fr / coach123\n`);
  });
}).catch(err => {
  console.error('Erreur initialisation base de données :', err);
  process.exit(1);
});
