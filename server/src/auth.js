import bcrypt from 'bcryptjs';
import { queryOne } from './db.js';
import { mapUser } from './mappers.js';

const sessions = new Map();

function token() {
  return `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

const USER_SELECT = `
  SELECT u.id, u.email, u.nome, u.ativo,
    c.empresa,
    CASE
      WHEN c.utilizador_id IS NOT NULL THEN 'customer'
      WHEN po.utilizador_id IS NOT NULL THEN 'product_owner'
      WHEN pr.utilizador_id IS NOT NULL THEN 'developer'
      WHEN g.utilizador_id IS NOT NULL THEN 'project_manager'
      ELSE NULL
    END AS role,
    CASE
      WHEN c.utilizador_id IS NOT NULL THEN 'Cliente'
      WHEN po.utilizador_id IS NOT NULL THEN 'Product Owner'
      WHEN pr.utilizador_id IS NOT NULL THEN 'Programadora'
      WHEN g.utilizador_id IS NOT NULL THEN 'Gestor de projeto'
      ELSE NULL
    END AS title
  FROM utilizadores u
  LEFT JOIN clientes c ON c.utilizador_id = u.id
  LEFT JOIN product_owners po ON po.utilizador_id = u.id
  LEFT JOIN programadores pr ON pr.utilizador_id = u.id
  LEFT JOIN gestores_projeto g ON g.utilizador_id = u.id
`;

export function publicUser(row) {
  return mapUser(row);
}

export async function findUserById(id) {
  return queryOne(`${USER_SELECT} WHERE u.id = ?`, [id]);
}

export async function findUserByEmail(email) {
  return queryOne(`${USER_SELECT} WHERE u.email = ?`, [email]);
}

export async function login(email, password) {
  const user = await findUserByEmail(email);
  if (!user || !user.ativo) return null;
  const cred = await queryOne(
    'SELECT password_hash FROM credenciais_locais WHERE utilizador_id = ?',
    [user.id],
  );
  if (!cred || !bcrypt.compareSync(password, cred.password_hash)) return null;
  const t = token();
  sessions.set(t, Number(user.id));
  return { token: t, user: publicUser(user) };
}

export function logout(t) {
  sessions.delete(t);
}

export async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  const t = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-session-token'];
  if (!t) return null;
  const userId = sessions.get(t);
  if (!userId) return null;
  const user = await findUserById(userId);
  return publicUser(user);
}

export async function requireAuth(req, res, next) {
  try {
    const user = await userFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden for this role' });
    }
    next();
  };
}
