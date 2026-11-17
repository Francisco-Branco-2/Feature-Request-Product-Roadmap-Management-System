import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { closePool, mysqlConfig, queryOne } from './db.js';
import { seed } from './seed.js';
import routes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);

function describeDbTarget() {
  const cfg = mysqlConfig();
  if (cfg.socketPath) return `socket ${cfg.socketPath} as ${cfg.user}/${cfg.database}`;
  return `${cfg.host}:${cfg.port} as ${cfg.user}/${cfg.database}`;
}

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
    if (err && (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR')) {
      throw new Error(
        `Cannot connect to MySQL (${describeDbTarget()}): ${err.message}\n` +
          'Run: docker compose up -d && npm run db:reset\n' +
          'Check MYSQL_HOST / MYSQL_PORT in .env (Docker uses host port 3308).',
      );
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

  const server = app.listen(PORT, () => {
    console.log(`Nimbo Software API listening on http://localhost:${PORT}`);
    console.log(`MySQL: ${describeDbTarget()}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Free it with: fuser -k ${PORT}/tcp`,
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

main().catch(async (err) => {
  console.error('Failed to start server:', err.message || err);
  await closePool();
  process.exit(1);
});
