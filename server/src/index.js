import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { closePool, queryOne } from './db.js';
import { seed } from './seed.js';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);

async function ensureSeeded() {
  try {
    const row = await queryOne('SELECT COUNT(*) AS c FROM utilizadores');
    if (Number(row?.c || 0) === 0) {
      console.log('Empty database — seeding demo data…');
      await seed();
    }
  } catch (err) {
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_DB_ERROR')) {
      console.log('Database not migrated — seeding (migrate + data)…');
      await seed();
      return;
    }
    throw err;
  }
}

async function main() {
  await ensureSeeded();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', routes);

  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Nimbo Software API listening on http://localhost:${PORT}`);
  });
}

main().catch(async (err) => {
  console.error('Failed to start server:', err);
  await closePool();
  process.exit(1);
});
