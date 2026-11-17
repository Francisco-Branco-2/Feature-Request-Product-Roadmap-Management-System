import { Router } from 'express';
import { execute, query, queryOne, withTransaction } from './db.js';
import { login, logout, requireAuth, requireRoles, userFromRequest } from './auth.js';
import {
  aiPrioritize,
  enrichRequest,
  loadFeatureByCode,
  loadFeatureByPedidoId,
  loadFeatureRowByCode,
  relativeTime,
  STATUS_LABELS,
} from './helpers.js';
import {
  FEATURE_STATUS_TO_DB,
  mapCategory,
  mapComment,
  mapFeature,
  mapMilestone,
  mapNotification,
  mapRelease,
  mapStory,
  mapTag,
  mapUser,
  quarterFromDate,
  STATUS_TO_DB,
  VIS_TO_DB,
} from './mappers.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await queryOne('SELECT 1 AS ok');
    res.json({ ok: true, service: 'erprms-api', db: 'mysql' });
  }),
);

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const result = await login(String(email || '').trim().toLowerCase(), String(password || ''));
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(result);
  }),
);

router.post('/auth/logout', (req, res) => {
  const header = req.headers.authorization || '';
  const t = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (t) logout(t);
  res.json({ ok: true });
});

router.get(
  '/auth/me',
  asyncHandler(async (req, res) => {
    const user = await userFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user });
  }),
);

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await query('SELECT * FROM categorias ORDER BY nome');
    res.json(rows.map(mapCategory));
  }),
);

router.get(
  '/tags',
  asyncHandler(async (_req, res) => {
    const rows = await query('SELECT * FROM etiquetas ORDER BY nome');
    res.json(rows.map(mapTag));
  }),
);

async function listRequests({ user, q, status, visibility, mine, category }) {
  let sql = `SELECT p.* FROM pedidos p WHERE p.fundido_em_id IS NULL`;
  const params = [];
  if (mine && user) {
    sql += ' AND p.cliente_id = ?';
    params.push(user.id);
  }
  if (status) {
    if (status === 'merged') {
      sql = `SELECT p.* FROM pedidos p WHERE p.fundido_em_id IS NOT NULL`;
    } else if (status === 'in_backlog') {
      sql += ` AND p.estado = 'ADMITIDO_ANALISE'
        AND EXISTS (
          SELECT 1 FROM funcionalidades f
          JOIN user_stories us ON us.funcionalidade_id = f.id AND us.rascunho = 0
          WHERE f.pedido_origem_id = p.id
        )`;
    } else {
      sql += ' AND p.estado = ?';
      params.push(STATUS_TO_DB[status] || status);
    }
  }
  if (visibility) {
    sql += ' AND p.visibilidade = ?';
    params.push(VIS_TO_DB[visibility] || visibility);
  } else if (!user || user.role === 'customer') {
    if (user) {
      sql += ' AND (p.visibilidade = ? OR p.cliente_id = ?)';
      params.push('PUBLICO', user.id);
    } else {
      sql += ' AND p.visibilidade = ?';
      params.push('PUBLICO');
    }
  }
  if (category) {
    sql += ' AND p.categoria_id = ?';
    params.push(Number(category));
  }
  if (q) {
    sql += ' AND (p.titulo LIKE ? OR p.necessidade LIKE ? OR CAST(p.id AS CHAR) LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY p.atualizado_em DESC';
  const rows = await query(sql, params);
  const out = [];
  for (const r of rows) {
    const enriched = await enrichRequest(r, user?.id);
    out.push({
      ...enriched,
      updated_relative: relativeTime(r.atualizado_em),
      status_label: STATUS_LABELS[enriched.status] || { pt: enriched.status, en: enriched.status },
    });
  }
  return out;
}

router.get(
  '/requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { q, status, visibility, mine, category } = req.query;
    res.json(
      await listRequests({
        user: req.user,
        q,
        status,
        visibility,
        mine: mine === '1' || mine === 'true',
        category,
      }),
    );
  }),
);

router.get(
  '/requests/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    res.json(await listRequests({ user: req.user, q, visibility: 'public' }));
  }),
);

router.get(
  '/requests/:number',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [Number(req.params.number)]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (
      row.visibilidade === 'PRIVADO' &&
      req.user.role === 'customer' &&
      Number(row.cliente_id) !== req.user.id
    ) {
      return res.status(403).json({ error: 'Private request' });
    }

    const comments = (
      await query(
        `SELECT c.*, u.nome AS author_name,
           CASE
             WHEN cl.utilizador_id IS NOT NULL THEN 'customer'
             WHEN po.utilizador_id IS NOT NULL THEN 'product_owner'
             WHEN pr.utilizador_id IS NOT NULL THEN 'developer'
             WHEN g.utilizador_id IS NOT NULL THEN 'project_manager'
           END AS author_role,
           cl.empresa AS organization,
           CASE WHEN c.visibilidade = 'PRIVADO' THEN 'clarification' ELSE 'comment' END AS kind
         FROM comentarios c
         JOIN utilizadores u ON u.id = c.autor_id
         LEFT JOIN clientes cl ON cl.utilizador_id = u.id
         LEFT JOIN product_owners po ON po.utilizador_id = u.id
         LEFT JOIN programadores pr ON pr.utilizador_id = u.id
         LEFT JOIN gestores_projeto g ON g.utilizador_id = u.id
         WHERE c.pedido_id = ?
         ORDER BY c.data_hora`,
        [row.id],
      )
    ).map(mapComment);

    const history = (
      await query(
        `SELECT h.id, h.pedido_id AS request_id, h.autor_id AS actor_id, h.campo AS action,
           COALESCE(h.valor_novo, h.valor_anterior) AS detail, h.data_hora AS created_at,
           u.nome AS actor_name
         FROM registos_alteracao h
         LEFT JOIN utilizadores u ON u.id = h.autor_id
         WHERE h.pedido_id = ?
         ORDER BY h.data_hora`,
        [row.id],
      )
    ).map((h) => ({
      ...h,
      id: Number(h.id),
      request_id: Number(h.request_id),
      actor_id: h.actor_id != null ? Number(h.actor_id) : null,
    }));

    const featRow = await queryOne('SELECT * FROM funcionalidades WHERE pedido_origem_id = ?', [
      row.id,
    ]);
    let user_story = null;
    if (featRow) {
      const story = await queryOne(
        `SELECT us.*, f.pedido_origem_id FROM user_stories us
         JOIN funcionalidades f ON f.id = us.funcionalidade_id
         WHERE us.funcionalidade_id = ?
         ORDER BY us.criada_em DESC LIMIT 1`,
        [featRow.id],
      );
      if (story) {
        const criteria = await query(
          `SELECT * FROM criterios_aceitacao WHERE user_story_id = ? ORDER BY id`,
          [story.id],
        );
        user_story = mapStory(story, criteria);
      }
    }

    const feature = await loadFeatureByPedidoId(row.id);
    const enriched = await enrichRequest(row, req.user.id);
    res.json({
      ...enriched,
      updated_relative: relativeTime(row.atualizado_em),
      status_label: STATUS_LABELS[enriched.status] || { pt: enriched.status, en: enriched.status },
      comments,
      history,
      user_story,
      feature,
    });
  }),
);

router.post(
  '/requests',
  requireAuth,
  requireRoles('customer'),
  asyncHandler(async (req, res) => {
    const { title, need, benefit } = req.body || {};
    if (!title?.trim() || !need?.trim() || !benefit?.trim()) {
      return res.status(400).json({ error: 'title, need and benefit are required' });
    }
    const produto = await queryOne('SELECT id FROM produtos ORDER BY id LIMIT 1');
    if (!produto) return res.status(500).json({ error: 'No product configured' });

    const result = await execute(
      `INSERT INTO pedidos (
         produto_id, cliente_id, titulo, necessidade, beneficio, descricao_publica,
         estado, visibilidade
       ) VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE_ANALISE', 'PUBLICO')`,
      [
        produto.id,
        req.user.id,
        title.trim(),
        need.trim(),
        benefit.trim(),
        need.trim(),
      ],
    );
    const id = result.insertId;
    await execute(
      `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_novo)
       VALUES (?, ?, 'estado', 'PENDENTE_ANALISE')`,
      [id, req.user.id],
    );
    const po = await queryOne(
      'SELECT utilizador_id AS id FROM product_owners ORDER BY utilizador_id LIMIT 1',
    );
    if (po) {
      await execute(
        `INSERT INTO notificacoes (destinatario_id, pedido_id, tipo, texto)
         VALUES (?, ?, ?, ?)`,
        [
          po.id,
          id,
          `Novo pedido #${id}`,
          JSON.stringify({
            title: `Novo pedido #${id}`,
            body: `${req.user.name} submeteu ${title.trim()}`,
            link: `/po/requests/${id}`,
          }),
        ],
      );
    }
    await aiPrioritize(id, po?.id);
    const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [id]);
    res.status(201).json(await enrichRequest(row, req.user.id));
  }),
);

router.post(
  '/requests/:number/vote',
  requireAuth,
  requireRoles('customer'),
  asyncHandler(async (req, res) => {
    const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [Number(req.params.number)]);
    if (!row || row.visibilidade !== 'PUBLICO') return res.status(404).json({ error: 'Not found' });
    try {
      await execute(`INSERT INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [
        row.id,
        req.user.id,
      ]);
    } catch {
      return res.status(409).json({ error: 'Already voted' });
    }
    await aiPrioritize(row.id, null);
    res.json(
      await enrichRequest(await queryOne('SELECT * FROM pedidos WHERE id = ?', [row.id]), req.user.id),
    );
  }),
);

router.post(
  '/requests/:number/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [Number(req.params.number)]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const { body, kind } = req.body || {};
    if (!body?.trim()) return res.status(400).json({ error: 'body required' });
    const k = kind || (req.user.role === 'product_owner' ? 'clarification' : 'reply');
    const vis = k === 'clarification' ? 'PRIVADO' : 'PUBLICO';
    const result = await execute(
      `INSERT INTO comentarios (pedido_id, autor_id, texto, visibilidade) VALUES (?, ?, ?, ?)`,
      [row.id, req.user.id, body.trim(), vis],
    );
    await execute(
      `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_novo)
       VALUES (?, ?, ?, ?)`,
      [row.id, req.user.id, k, body.trim().slice(0, 120)],
    );
    if (k === 'clarification') {
      await execute(
        `INSERT INTO notificacoes (destinatario_id, pedido_id, comentario_id, tipo, texto)
         VALUES (?, ?, ?, ?, ?)`,
        [
          row.cliente_id,
          row.id,
          result.insertId,
          `Esclarecimento no pedido #${row.id}`,
          JSON.stringify({
            title: `Esclarecimento no pedido #${row.id}`,
            body: body.trim(),
            link: `/customer/requests/${row.id}`,
          }),
        ],
      );
    } else if (k === 'reply') {
      const po = await queryOne(
        'SELECT utilizador_id AS id FROM product_owners ORDER BY utilizador_id LIMIT 1',
      );
      if (po) {
        await execute(
          `INSERT INTO notificacoes (destinatario_id, pedido_id, comentario_id, tipo, texto)
           VALUES (?, ?, ?, ?, ?)`,
          [
            po.id,
            row.id,
            result.insertId,
            `Resposta no pedido #${row.id}`,
            JSON.stringify({
              title: `Resposta no pedido #${row.id}`,
              body: body.trim(),
              link: `/po/requests/${row.id}`,
            }),
          ],
        );
      }
    }
    const comment = await queryOne(
      `SELECT c.*, u.nome AS author_name,
         CASE
           WHEN po.utilizador_id IS NOT NULL THEN 'product_owner'
           WHEN cl.utilizador_id IS NOT NULL THEN 'customer'
           ELSE 'developer'
         END AS author_role,
         ? AS kind
       FROM comentarios c
       JOIN utilizadores u ON u.id = c.autor_id
       LEFT JOIN product_owners po ON po.utilizador_id = u.id
       LEFT JOIN clientes cl ON cl.utilizador_id = u.id
       WHERE c.id = ?`,
      [k, result.insertId],
    );
    res.status(201).json(mapComment(comment));
  }),
);

router.patch(
  '/requests/:number',
  requireAuth,
  requireRoles('product_owner'),
  asyncHandler(async (req, res) => {
    const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [Number(req.params.number)]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const {
      status,
      visibility,
      category_id,
      business_value,
      effort,
      final_priority,
      rejection_reason,
      title,
      need,
      benefit,
      tag_ids,
    } = req.body || {};

    const fields = [];
    const params = [];
    const set = (col, val) => {
      if (val !== undefined) {
        fields.push(`${col} = ?`);
        params.push(val);
      }
    };
    set('titulo', title);
    set('necessidade', need);
    set('beneficio', benefit);
    set('categoria_id', category_id);

    if (visibility !== undefined) {
      const vis = VIS_TO_DB[visibility] || visibility;
      set('visibilidade', vis);
      if (vis === 'PUBLICO' && !row.descricao_publica) {
        set('descricao_publica', row.necessidade);
      }
    }

    if (status) {
      const dbStatus = STATUS_TO_DB[status] || status;
      set('estado', dbStatus);
      if (dbStatus === 'PENDENTE_ANALISE') {
        set('justificacao_decisao', null);
        set('decidido_por', null);
        set('decidido_em', null);
      } else {
        set(
          'justificacao_decisao',
          rejection_reason ||
            (dbStatus === 'REJEITADO'
              ? 'Rejeitado pela Product Owner'
              : 'Admitido para análise pela Product Owner'),
        );
        set('decidido_por', req.user.id);
        set('decidido_em', new Date().toISOString().slice(0, 23).replace('T', ' '));
      }
    }

    if (fields.length) {
      params.push(row.id);
      await execute(`UPDATE pedidos SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    if (business_value !== undefined || effort !== undefined || final_priority !== undefined) {
      const existing = await queryOne('SELECT * FROM avaliacoes_impacto WHERE pedido_id = ?', [
        row.id,
      ]);
      const interesse = `effort:${effort ?? ''}|priority:${final_priority ?? ''}`;
      const valor = business_value || existing?.valor_negocio || 'n/d';
      if (existing) {
        await execute(
          `UPDATE avaliacoes_impacto SET valor_negocio = ?, interesse_clientes = ?, avaliador_id = ?
           WHERE pedido_id = ?`,
          [valor, interesse, req.user.id, row.id],
        );
      } else {
        await execute(
          `INSERT INTO avaliacoes_impacto (pedido_id, avaliador_id, valor_negocio, interesse_clientes)
           VALUES (?, ?, ?, ?)`,
          [row.id, req.user.id, valor, interesse],
        );
      }
    }

    if (Array.isArray(tag_ids)) {
      await execute('DELETE FROM pedido_etiquetas WHERE pedido_id = ?', [row.id]);
      for (const tid of tag_ids) {
        await execute(`INSERT INTO pedido_etiquetas (pedido_id, etiqueta_id) VALUES (?, ?)`, [
          row.id,
          tid,
        ]);
      }
    }

    if (status) {
      await execute(
        `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_anterior, valor_novo)
         VALUES (?, ?, 'estado', ?, ?)`,
        [row.id, req.user.id, row.estado, STATUS_TO_DB[status] || status],
      );
      if (status === 'rejected' || status === 'admitted') {
        await execute(
          `INSERT INTO notificacoes (destinatario_id, pedido_id, tipo, texto) VALUES (?, ?, ?, ?)`,
          [
            row.cliente_id,
            row.id,
            status === 'admitted' ? `Pedido #${row.id} admitido` : `Pedido #${row.id} rejeitado`,
            JSON.stringify({
              title:
                status === 'admitted'
                  ? `Pedido #${row.id} admitido`
                  : `Pedido #${row.id} rejeitado`,
              body: rejection_reason || '',
              link: `/customer/requests/${row.id}`,
            }),
          ],
        );
      }
    }

    await aiPrioritize(row.id, req.user.id);
    const updated = await queryOne('SELECT * FROM pedidos WHERE id = ?', [row.id]);
    res.json(await enrichRequest(updated, req.user.id));
  }),
);

router.post(
  '/requests/:number/ai-priority',
  requireAuth,
  requireRoles('product_owner'),
  asyncHandler(async (req, res) => {
    const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [Number(req.params.number)]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(await aiPrioritize(row.id, req.user.id));
  }),
);

router.post(
  '/requests/merge',
  requireAuth,
  requireRoles('product_owner'),
  asyncHandler(async (req, res) => {
    const { primary_number, secondary_number } = req.body || {};
    const primary = await queryOne('SELECT * FROM pedidos WHERE id = ?', [Number(primary_number)]);
    const secondary = await queryOne('SELECT * FROM pedidos WHERE id = ?', [
      Number(secondary_number),
    ]);
    if (!primary || !secondary) return res.status(404).json({ error: 'Not found' });

    await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE pedidos SET fundido_em_id = ?, fundido_por = ?, fundido_em_data = UTC_TIMESTAMP(6)
         WHERE id = ?`,
        [primary.id, req.user.id, secondary.id],
      );
      const votes = await tx.query('SELECT cliente_id FROM votos WHERE pedido_id = ?', [
        secondary.id,
      ]);
      for (const v of votes) {
        await tx.execute(`INSERT IGNORE INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [
          primary.id,
          v.cliente_id,
        ]);
      }
      await tx.execute(
        `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_novo)
         VALUES (?, ?, 'fusao', ?)`,
        [primary.id, req.user.id, `Fundido com #${secondary.id}`],
      );
    });

    await aiPrioritize(primary.id, req.user.id);
    res.json({
      primary: await enrichRequest(
        await queryOne('SELECT * FROM pedidos WHERE id = ?', [primary.id]),
        req.user.id,
      ),
    });
  }),
);

router.post(
  '/requests/:number/user-story',
  requireAuth,
  requireRoles('product_owner'),
  asyncHandler(async (req, res) => {
    const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [Number(req.params.number)]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    let { as_a, i_want, so_that, status, criteria } = req.body || {};
    if (!as_a) {
      as_a = 'utilizador do produto';
      i_want = row.titulo;
      so_that = row.beneficio;
    }

    let feat = await queryOne('SELECT * FROM funcionalidades WHERE pedido_origem_id = ?', [row.id]);
    if (!feat) {
      if (row.estado !== 'ADMITIDO_ANALISE') {
        await execute(
          `UPDATE pedidos SET estado = 'ADMITIDO_ANALISE',
             justificacao_decisao = COALESCE(justificacao_decisao, 'Admitido para gerar user story'),
             decidido_por = COALESCE(decidido_por, ?),
             decidido_em = COALESCE(decidido_em, UTC_TIMESTAMP(6))
           WHERE id = ?`,
          [req.user.id, row.id],
        );
      }
      const produtoId = row.produto_id;
      const espaco = await queryOne(
        'SELECT id FROM espacos_trabalho WHERE produto_id = ? ORDER BY id LIMIT 1',
        [produtoId],
      );
      const result = await execute(
        `INSERT INTO funcionalidades (produto_id, pedido_origem_id, espaco_id, titulo, estado, posicao_backlog)
         VALUES (?, ?, ?, ?, 'A_FAZER', NULL)`,
        [produtoId, row.id, espaco?.id || null, row.titulo],
      );
      feat = await queryOne('SELECT * FROM funcionalidades WHERE id = ?', [result.insertId]);
    }

    const existing = await queryOne(
      'SELECT * FROM user_stories WHERE funcionalidade_id = ? ORDER BY id DESC LIMIT 1',
      [feat.id],
    );
    const rascunho = status === 'approved' ? 0 : 1;
    let storyId;
    if (existing) {
      await execute(
        `UPDATE user_stories SET papel=?, pretendo=?, para_beneficio=?, rascunho=?, autor_id=?
         WHERE id=?`,
        [as_a, i_want, so_that, rascunho, req.user.id, existing.id],
      );
      storyId = existing.id;
    } else {
      const result = await execute(
        `INSERT INTO user_stories (funcionalidade_id, autor_id, papel, pretendo, para_beneficio, rascunho, gerada_por_ia)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [feat.id, req.user.id, as_a, i_want, so_that, rascunho],
      );
      storyId = result.insertId;
    }

    if (Array.isArray(criteria)) {
      await execute('DELETE FROM criterios_aceitacao WHERE user_story_id = ?', [storyId]);
      for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];
        await execute(
          `INSERT INTO criterios_aceitacao (user_story_id, definido_por, codigo, cenario_gherkin)
           VALUES (?, ?, ?, ?)`,
          [storyId, req.user.id, c.code || `CA${i + 1}`, c.text],
        );
      }
    }

    if (status === 'approved') {
      const av = await queryOne('SELECT interesse_clientes FROM avaliacoes_impacto WHERE pedido_id = ?', [
        row.id,
      ]);
      let effort = 3;
      const m = av?.interesse_clientes?.match(/effort:(\d+)/);
      if (m) effort = Number(m[1]);
      if (feat.estimativa_esforco == null) {
        await execute(
          `UPDATE funcionalidades SET
             estimativa_esforco = ?, unidade_esforco = 'STORY_POINTS',
             estimada_por = (SELECT utilizador_id FROM programadores ORDER BY utilizador_id LIMIT 1),
             estimada_em = UTC_TIMESTAMP(6),
             posicao_backlog = COALESCE(posicao_backlog, 0)
           WHERE id = ?`,
          [effort, feat.id],
        );
      }
    }

    const story = await queryOne(
      `SELECT us.*, f.pedido_origem_id FROM user_stories us
       JOIN funcionalidades f ON f.id = us.funcionalidade_id WHERE us.id = ?`,
      [storyId],
    );
    const ac = await query(
      'SELECT * FROM criterios_aceitacao WHERE user_story_id = ? ORDER BY id',
      [storyId],
    );
    res.json(mapStory(story, ac));
  }),
);

router.get(
  '/backlog',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT f.*, e.nome AS team_name, u.nome AS assignee_name,
         (SELECT CONCAT('Sprint ', s.numero) FROM sprint_funcionalidades sf
          JOIN sprints s ON s.id = sf.sprint_id
          WHERE sf.funcionalidade_id = f.id AND sf.retirada_em IS NULL
          ORDER BY sf.incluida_em DESC LIMIT 1) AS sprint_label,
         (SELECT rf.release_id FROM release_funcionalidades rf
          WHERE rf.funcionalidade_id = f.id AND rf.retirada_em IS NULL
          ORDER BY rf.incluida_em DESC LIMIT 1) AS release_id,
         (SELECT CONCAT('F-', fd.pedido_origem_id) FROM dependencias_funcionalidade d
          JOIN funcionalidades fd ON fd.id = d.bloqueadora_id
          WHERE d.dependente_id = f.id LIMIT 1) AS dependency_code,
         (SELECT CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(COALESCE(ai.interesse_clientes,''), 'priority:', -1), '|', 1) AS UNSIGNED)
          FROM avaliacoes_impacto ai WHERE ai.pedido_id = f.pedido_origem_id) AS final_priority
       FROM funcionalidades f
       LEFT JOIN equipas e ON e.id = f.equipa_id
       LEFT JOIN utilizadores u ON u.id = f.responsavel_id
       ORDER BY COALESCE(final_priority, 999), f.pedido_origem_id`,
    );
    res.json(rows.map(mapFeature));
  }),
);

router.patch(
  '/features/:code',
  requireAuth,
  requireRoles('developer', 'product_owner', 'project_manager'),
  asyncHandler(async (req, res) => {
    const feat = await loadFeatureRowByCode(req.params.code);
    if (!feat) return res.status(404).json({ error: 'Not found' });
    const {
      status,
      estimate_points,
      team,
      sprint,
      assignee_id,
      dependency_code,
      progress,
      release_id,
    } = req.body || {};

    const fields = [];
    const params = [];
    const set = (col, val) => {
      if (val !== undefined) {
        fields.push(`${col} = ?`);
        params.push(val);
      }
    };

    if (status !== undefined) {
      const dbStatus = FEATURE_STATUS_TO_DB[status] || status;
      set('estado', dbStatus);
      if (status === 'backlog') {
        set('posicao_backlog', null);
        set('data_inicio', null);
        set('data_conclusao', null);
      } else if (status === 'ready') {
        set('posicao_backlog', feat.posicao_backlog || 1);
        set('data_inicio', null);
        set('data_conclusao', null);
      } else if (status === 'in_development') {
        set('data_inicio', feat.data_inicio || new Date().toISOString().slice(0, 23).replace('T', ' '));
        set('data_conclusao', null);
      } else if (status === 'done') {
        set(
          'data_inicio',
          feat.data_inicio || new Date().toISOString().slice(0, 23).replace('T', ' '),
        );
        set('data_conclusao', new Date().toISOString().slice(0, 23).replace('T', ' '));
      }
    }

    if (estimate_points !== undefined) {
      if (estimate_points == null) {
        set('estimativa_esforco', null);
        set('unidade_esforco', null);
        set('estimada_por', null);
        set('estimada_em', null);
      } else {
        const estimator =
          (assignee_id &&
            (await queryOne(
              'SELECT utilizador_id AS id FROM programadores WHERE utilizador_id = ?',
              [assignee_id],
            ))) ||
          (feat.responsavel_id &&
            (await queryOne(
              'SELECT utilizador_id AS id FROM programadores WHERE utilizador_id = ?',
              [feat.responsavel_id],
            ))) ||
          (await queryOne(
            'SELECT utilizador_id AS id FROM programadores ORDER BY utilizador_id LIMIT 1',
          ));
        set('estimativa_esforco', estimate_points);
        set('unidade_esforco', 'STORY_POINTS');
        set('estimada_por', estimator.id);
        set('estimada_em', new Date().toISOString().slice(0, 23).replace('T', ' '));
      }
    }

    if (assignee_id !== undefined) {
      if (assignee_id == null) set('responsavel_id', null);
      else {
        const dev = await queryOne(
          'SELECT utilizador_id AS id FROM programadores WHERE utilizador_id = ?',
          [assignee_id],
        );
        if (dev) set('responsavel_id', assignee_id);
      }
    }

    if (team !== undefined) {
      let equipa = await queryOne('SELECT id FROM equipas WHERE nome = ?', [team]);
      if (!equipa && team) {
        const r = await execute(
          `INSERT INTO equipas (nome, capacidade, unidade_esforco) VALUES (?, 0, 'STORY_POINTS')`,
          [team],
        );
        equipa = { id: r.insertId };
      }
      set('equipa_id', equipa?.id || null);
    }

    if (fields.length) {
      params.push(feat.id);
      await execute(`UPDATE funcionalidades SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    if (dependency_code !== undefined) {
      await execute('DELETE FROM dependencias_funcionalidade WHERE dependente_id = ?', [feat.id]);
      if (dependency_code) {
        const dep = await loadFeatureRowByCode(dependency_code);
        if (dep) {
          const autor =
            (await queryOne('SELECT utilizador_id AS id FROM programadores WHERE utilizador_id = ?', [
              req.user.id,
            ])) ||
            (await queryOne(
              'SELECT utilizador_id AS id FROM programadores ORDER BY utilizador_id LIMIT 1',
            ));
          if (autor) {
            await execute(
              `INSERT INTO dependencias_funcionalidade (dependente_id, bloqueadora_id, autor_id)
               VALUES (?, ?, ?)`,
              [feat.id, dep.id, autor.id],
            );
          }
        }
      }
    }

    if (release_id !== undefined) {
      await execute(
        `UPDATE release_funcionalidades SET retirada_em = UTC_TIMESTAMP(6)
         WHERE funcionalidade_id = ? AND retirada_em IS NULL`,
        [feat.id],
      );
      if (release_id) {
        const pm =
          (await queryOne(
            'SELECT utilizador_id AS id FROM gestores_projeto WHERE utilizador_id = ?',
            [req.user.id],
          )) ||
          (await queryOne(
            'SELECT utilizador_id AS id FROM gestores_projeto ORDER BY utilizador_id LIMIT 1',
          ));
        await execute(
          `INSERT INTO release_funcionalidades (release_id, funcionalidade_id, incluida_por)
           VALUES (?, ?, ?)`,
          [release_id, feat.id, pm.id],
        );
      }
    }

    if (sprint !== undefined) {
      await execute(
        `UPDATE sprint_funcionalidades SET retirada_em = UTC_TIMESTAMP(6)
         WHERE funcionalidade_id = ? AND retirada_em IS NULL`,
        [feat.id],
      );
      const num = Number(String(sprint).replace(/\D+/g, ''));
      if (num) {
        let sp = await queryOne('SELECT id FROM sprints WHERE numero = ? AND produto_id = ?', [
          num,
          feat.produto_id,
        ]);
        if (!sp) {
          const r = await execute(
            `INSERT INTO sprints (produto_id, numero, data_inicio, data_fim)
             VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY))`,
            [feat.produto_id, num],
          );
          sp = { id: r.insertId };
        }
        const po =
          (await queryOne(
            'SELECT utilizador_id AS id FROM product_owners WHERE utilizador_id = ?',
            [req.user.id],
          )) ||
          (await queryOne(
            'SELECT utilizador_id AS id FROM product_owners ORDER BY utilizador_id LIMIT 1',
          ));
        await execute(
          `INSERT INTO sprint_funcionalidades (sprint_id, funcionalidade_id, incluida_por)
           VALUES (?, ?, ?)`,
          [sp.id, feat.id, po.id],
        );
      }
    }

    void progress;

    if (status === 'in_development') {
      const recipients = await query(
        `SELECT utilizador_id AS id FROM product_owners
         UNION SELECT utilizador_id FROM gestores_projeto`,
      );
      for (const r of recipients) {
        await execute(
          `INSERT INTO notificacoes (destinatario_id, tipo, texto) VALUES (?, ?, ?)`,
          [
            r.id,
            `${req.params.code} em desenvolvimento`,
            JSON.stringify({
              title: `${req.params.code} em desenvolvimento`,
              body: `${req.params.code} passou a Em desenvolvimento.`,
              link: `/dev/features/${req.params.code}`,
            }),
          ],
        );
      }
    }

    res.json(await loadFeatureByCode(req.params.code));
  }),
);

router.get(
  '/features/:code',
  requireAuth,
  asyncHandler(async (req, res) => {
    const feature = await loadFeatureByCode(req.params.code);
    if (!feature) return res.status(404).json({ error: 'Not found' });
    const featRow = await loadFeatureRowByCode(req.params.code);
    const discussions = (
      await query(
        `SELECT c.*, u.nome AS author_name,
           CASE
             WHEN po.utilizador_id IS NOT NULL THEN 'product_owner'
             WHEN pr.utilizador_id IS NOT NULL THEN 'developer'
             WHEN g.utilizador_id IS NOT NULL THEN 'project_manager'
             ELSE 'customer'
           END AS author_role
         FROM comentarios c
         JOIN utilizadores u ON u.id = c.autor_id
         LEFT JOIN product_owners po ON po.utilizador_id = u.id
         LEFT JOIN programadores pr ON pr.utilizador_id = u.id
         LEFT JOIN gestores_projeto g ON g.utilizador_id = u.id
         WHERE c.funcionalidade_id = ?
         ORDER BY c.data_hora`,
        [featRow.id],
      )
    ).map((d) => ({
      id: Number(d.id),
      feature_id: Number(d.funcionalidade_id),
      author_id: Number(d.autor_id),
      body: d.texto,
      created_at: d.data_hora,
      author_name: d.author_name,
      author_role: d.author_role,
    }));
    const request = feature.request_id
      ? await enrichRequest(
          await queryOne('SELECT * FROM pedidos WHERE id = ?', [feature.request_id]),
          req.user.id,
        )
      : null;
    res.json({ ...feature, discussions, request });
  }),
);

router.post(
  '/features/:code/discussions',
  requireAuth,
  requireRoles('developer', 'product_owner', 'project_manager'),
  asyncHandler(async (req, res) => {
    const feat = await loadFeatureRowByCode(req.params.code);
    if (!feat) return res.status(404).json({ error: 'Not found' });
    const { body } = req.body || {};
    if (!body?.trim()) return res.status(400).json({ error: 'body required' });
    const result = await execute(
      `INSERT INTO comentarios (funcionalidade_id, autor_id, texto, visibilidade)
       VALUES (?, ?, ?, 'PRIVADO')`,
      [feat.id, req.user.id, body.trim()],
    );
    const row = await queryOne(
      `SELECT c.*, u.nome AS author_name FROM comentarios c
       JOIN utilizadores u ON u.id = c.autor_id WHERE c.id = ?`,
      [result.insertId],
    );
    res.status(201).json({
      id: Number(row.id),
      feature_id: Number(row.funcionalidade_id),
      author_id: Number(row.autor_id),
      body: row.texto,
      created_at: row.data_hora,
      author_name: row.author_name,
    });
  }),
);

router.get(
  '/releases',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const releases = await query('SELECT * FROM releases ORDER BY data_fim');
    const result = [];
    for (const r of releases) {
      const milestones = (
        await query('SELECT * FROM marcos WHERE release_id = ? ORDER BY data_planeada', [r.id])
      ).map(mapMilestone);
      const features = (
        await query(
          `SELECT f.*, e.nome AS team_name, u.nome AS assignee_name,
             (SELECT CONCAT('Sprint ', s.numero) FROM sprint_funcionalidades sf
              JOIN sprints s ON s.id = sf.sprint_id
              WHERE sf.funcionalidade_id = f.id AND sf.retirada_em IS NULL
              ORDER BY sf.incluida_em DESC LIMIT 1) AS sprint_label,
             ? AS release_id
           FROM funcionalidades f
           JOIN release_funcionalidades rf ON rf.funcionalidade_id = f.id AND rf.retirada_em IS NULL
           LEFT JOIN equipas e ON e.id = f.equipa_id
           LEFT JOIN utilizadores u ON u.id = f.responsavel_id
           WHERE rf.release_id = ?
           ORDER BY f.pedido_origem_id`,
          [r.id, r.id],
        )
      ).map(mapFeature);
      result.push({ ...mapRelease(r), milestones, features });
    }
    res.json(result);
  }),
);

router.post(
  '/releases/:id/milestones',
  requireAuth,
  requireRoles('project_manager', 'product_owner'),
  asyncHandler(async (req, res) => {
    const { name, target_date } = req.body || {};
    if (!name || !target_date) {
      return res.status(400).json({ error: 'name and target_date required' });
    }
    const result = await execute(
      `INSERT INTO marcos (release_id, descricao, data_planeada) VALUES (?, ?, ?)`,
      [Number(req.params.id), name, target_date],
    );
    res
      .status(201)
      .json(mapMilestone(await queryOne('SELECT * FROM marcos WHERE id = ?', [result.insertId])));
  }),
);

router.get(
  '/roadmap',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT f.*, e.nome AS team_name,
         r.data_fim AS release_end, r.id AS release_id
       FROM funcionalidades f
       JOIN release_funcionalidades rf ON rf.funcionalidade_id = f.id AND rf.retirada_em IS NULL
       JOIN releases r ON r.id = rf.release_id
       LEFT JOIN equipas e ON e.id = f.equipa_id
       ORDER BY r.data_fim, f.pedido_origem_id`,
    );
    const items = rows.map((row, idx) => {
      const feature = mapFeature(row);
      const quarter = quarterFromDate(row.release_end);
      return {
        id: feature.id,
        feature_id: feature.id,
        quarter,
        lane: 'product',
        sort_order: idx + 1,
        code: feature.code,
        title: feature.title,
        status: feature.status,
        team: feature.team,
        progress: feature.progress,
      };
    });
    const byQuarter = {};
    for (const item of items) {
      byQuarter[item.quarter] ||= [];
      byQuarter[item.quarter].push(item);
    }
    res.json({ quarters: byQuarter, items });
  }),
);

router.get(
  '/metrics',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const submitted = Number((await queryOne('SELECT COUNT(*) AS c FROM pedidos')).c);
    const admitted = Number(
      (await queryOne(`SELECT COUNT(*) AS c FROM pedidos WHERE estado = 'ADMITIDO_ANALISE'`)).c,
    );
    const rejected = Number(
      (await queryOne(`SELECT COUNT(*) AS c FROM pedidos WHERE estado = 'REJEITADO'`)).c,
    );
    const pending = Number(
      (await queryOne(`SELECT COUNT(*) AS c FROM pedidos WHERE estado = 'PENDENTE_ANALISE'`)).c,
    );
    const byStatusRaw = await query(`SELECT estado AS status, COUNT(*) AS c FROM pedidos GROUP BY estado`);
    const byStatus = byStatusRaw.map((r) => ({
      status:
        r.status === 'PENDENTE_ANALISE'
          ? 'pending_analysis'
          : r.status === 'ADMITIDO_ANALISE'
            ? 'admitted'
            : r.status === 'REJEITADO'
              ? 'rejected'
              : r.status,
      c: Number(r.c),
    }));
    const featuresPerRelease = (
      await query(
        `SELECT r.nome AS name, COUNT(rf.funcionalidade_id) AS c
         FROM releases r
         LEFT JOIN release_funcionalidades rf ON rf.release_id = r.id AND rf.retirada_em IS NULL
         GROUP BY r.id`,
      )
    ).map((r) => ({ name: r.name, c: Number(r.c) }));
    const workload = (
      await query(
        `SELECT COALESCE(e.nome, 'Sem equipa') AS team, COUNT(*) AS c,
           SUM(COALESCE(f.estimativa_esforco,0)) AS points
         FROM funcionalidades f
         LEFT JOIN equipas e ON e.id = f.equipa_id
         GROUP BY e.nome`,
      )
    ).map((r) => ({ team: r.team, c: Number(r.c), points: Number(r.points) }));
    const votesTotal = Number((await queryOne('SELECT COUNT(*) AS c FROM votos')).c);
    const doneCount = Number(
      (await queryOne(`SELECT COUNT(*) AS c FROM funcionalidades WHERE estado = 'CONCLUIDA'`)).c,
    );
    const totalFeat = Number((await queryOne('SELECT COUNT(*) AS c FROM funcionalidades')).c) || 1;
    res.json({
      submitted,
      admitted,
      rejected,
      pending,
      approved_vs_rejected: { admitted, rejected },
      byStatus,
      featuresPerRelease,
      workload,
      votesTotal,
      leadTimeDays: 12.4,
      cycleTimeDays: 6.1,
      roadmapProgress: Number(((doneCount / totalFeat) * 100).toFixed(1)),
    });
  }),
);

router.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT * FROM notificacoes WHERE destinatario_id = ? ORDER BY data_hora DESC LIMIT 50`,
      [req.user.id],
    );
    res.json(
      rows.map((n) => {
        const mapped = mapNotification(n);
        return { ...mapped, relative: relativeTime(mapped.created_at) };
      }),
    );
  }),
);

router.post(
  '/notifications/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await execute(
      `UPDATE notificacoes SET lida_em = UTC_TIMESTAMP(6)
       WHERE destinatario_id = ? AND lida_em IS NULL`,
      [req.user.id],
    );
    res.json({ ok: true });
  }),
);

router.get(
  '/team',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const memberRows = await query(
      `SELECT u.id, u.email, u.nome,
         CASE
           WHEN po.utilizador_id IS NOT NULL THEN 'product_owner'
           WHEN pr.utilizador_id IS NOT NULL THEN 'developer'
           WHEN g.utilizador_id IS NOT NULL THEN 'project_manager'
         END AS role,
         'Nimbo Software' AS empresa,
         CASE
           WHEN po.utilizador_id IS NOT NULL THEN 'Product Owner'
           WHEN pr.utilizador_id IS NOT NULL THEN 'Programadora'
           WHEN g.utilizador_id IS NOT NULL THEN 'Gestor de projeto'
         END AS title
       FROM utilizadores u
       LEFT JOIN product_owners po ON po.utilizador_id = u.id
       LEFT JOIN programadores pr ON pr.utilizador_id = u.id
       LEFT JOIN gestores_projeto g ON g.utilizador_id = u.id
       WHERE po.utilizador_id IS NOT NULL OR pr.utilizador_id IS NOT NULL OR g.utilizador_id IS NOT NULL
       ORDER BY role, u.nome`,
    );
    const members = memberRows.map((r) => mapUser({ ...r, organization: r.empresa }));
    const boardRows = await query(
      `SELECT f.*, e.nome AS team_name, u.nome AS assignee_name,
         (SELECT CONCAT('Sprint ', s.numero) FROM sprint_funcionalidades sf
          JOIN sprints s ON s.id = sf.sprint_id
          WHERE sf.funcionalidade_id = f.id AND sf.retirada_em IS NULL
          ORDER BY sf.incluida_em DESC LIMIT 1) AS sprint_label,
         (SELECT rf.release_id FROM release_funcionalidades rf
          WHERE rf.funcionalidade_id = f.id AND rf.retirada_em IS NULL
          ORDER BY rf.incluida_em DESC LIMIT 1) AS release_id
       FROM funcionalidades f
       LEFT JOIN equipas e ON e.id = f.equipa_id
       LEFT JOIN utilizadores u ON u.id = f.responsavel_id
       ORDER BY f.estado, f.pedido_origem_id`,
    );
    res.json({ members, board: boardRows.map(mapFeature) });
  }),
);

router.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

export default router;
