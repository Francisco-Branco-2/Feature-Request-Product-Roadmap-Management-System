import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const migrationsDir = path.join(root, 'migrations');

function loadEnvFile() {
  for (const candidate of [path.join(root, '.env'), path.join(__dirname, '../.env')]) {
    if (!fs.existsSync(candidate)) continue;
    for (const line of fs.readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadEnvFile();

function env(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function envAllowEmpty(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined ? fallback : v;
}

export function mysqlConfig() {
  const socket = env('MYSQL_SOCKET');
  const config = {
    user: env('MYSQL_USER', 'erprms'),
    password: envAllowEmpty('MYSQL_PASSWORD', 'erprms'),
    database: env('MYSQL_DATABASE', 'erprms'),
    multipleStatements: true,
    dateStrings: true,
    namedPlaceholders: false,
  };
  if (socket) {
    config.socketPath = socket;
  } else {
    config.host = env('MYSQL_HOST', '127.0.0.1');
    config.port = Number(env('MYSQL_PORT', '3306'));
  }
  return config;
}

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...mysqlConfig(),
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function execute(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

export async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const api = {
      query: async (sql, params = []) => {
        const [rows] = await conn.execute(sql, params);
        return rows;
      },
      queryOne: async (sql, params = []) => {
        const [rows] = await conn.execute(sql, params);
        return rows[0] || null;
      },
      execute: async (sql, params = []) => {
        const [result] = await conn.execute(sql, params);
        return result;
      },
    };
    const out = await fn(api);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function mysqlCli() {
  for (const bin of ['mariadb', 'mysql']) {
    const check = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (check.status === 0) return bin;
  }
  return null;
}

function cliArgs(cfg, { withDatabase = true } = {}) {
  const args = ['-u', cfg.user];
  if (cfg.password) args.push(`-p${cfg.password}`);
  if (cfg.socketPath) args.push(`--socket=${cfg.socketPath}`);
  else {
    args.push('-h', cfg.host || '127.0.0.1');
    if (cfg.port) args.push('-P', String(cfg.port));
  }
  if (withDatabase && cfg.database) args.push(cfg.database);
  return args;
}

function runSql(sql, { withDatabase = true } = {}) {
  const cfg = mysqlConfig();
  const bin = mysqlCli();
  if (!bin) {
    throw new Error('mysql/mariadb CLI not found — needed to apply schema/triggers');
  }
  const result = spawnSync(bin, cliArgs(cfg, { withDatabase }), {
    input: sql,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`SQL apply failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function runSqlFile(filePath) {
  runSql(fs.readFileSync(filePath, 'utf8'), { withDatabase: false });
}

export async function resetDatabase() {
  const cfg = mysqlConfig();
  const db = cfg.database;
  runSql(
    `DROP DATABASE IF EXISTS \`${db}\`;\nCREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`,
    { withDatabase: false },
  );
  await closePool();
}

export async function migrate({ force = false } = {}) {
  const cfg = mysqlConfig();
  // Ensure database exists (best-effort; may require privileges)
  try {
    runSql(
      `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      { withDatabase: false },
    );
  } catch {
    /* database may already exist / user lacks CREATE */
  }

  let needsSchema = force;
  if (!needsSchema) {
    try {
      await queryOne('SELECT 1 FROM utilizadores LIMIT 1');
      needsSchema = false;
    } catch {
      needsSchema = true;
    }
  }

  if (needsSchema) {
    runSqlFile(path.join(migrationsDir, '01_schema.sql'));
  }
  runSqlFile(path.join(migrationsDir, '02_credenciais_locais.sql'));
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
