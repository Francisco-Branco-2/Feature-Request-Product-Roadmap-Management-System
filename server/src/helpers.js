import { execute, query, queryOne } from './db.js';
import {
  mapCategory,
  mapFeature,
  mapPedidoStatus,
  mapRequest,
  mapTag,
  mapUser,
  parseFeatureCode,
} from './mappers.js';

export const STATUS_LABELS = {
  pending_analysis: { pt: 'Pendente de Análise', en: 'Pending analysis' },
  admitted: { pt: 'Admitido para Análise', en: 'Admitted for analysis' },
  rejected: { pt: 'Rejeitado', en: 'Rejected' },
  in_backlog: { pt: 'No backlog', en: 'In backlog' },
  in_development: { pt: 'Em desenvolvimento', en: 'In development' },
  done: { pt: 'Concluído', en: 'Done' },
  merged: { pt: 'Fundido', en: 'Merged' },
};

export async function voteCount(pedidoId) {
  const row = await queryOne('SELECT COUNT(*) AS c FROM votos WHERE pedido_id = ?', [pedidoId]);
  return Number(row?.c || 0);
}

export async function loadAvaliacao(pedidoId) {
  return queryOne('SELECT * FROM avaliacoes_impacto WHERE pedido_id = ?', [pedidoId]);
}

export async function loadAiSuggestion(pedidoId) {
  return queryOne(
    `SELECT * FROM sugestoes_ia WHERE pedido_id = ? ORDER BY data_hora DESC, id DESC LIMIT 1`,
    [pedidoId],
  );
}

function parseInteresse(interesse) {
  const out = { effort: null, final_priority: null };
  if (!interesse) return out;
  const effort = interesse.match(/effort:(\d+)/);
  const priority = interesse.match(/priority:(\d+)/);
  if (effort) out.effort = Number(effort[1]);
  if (priority) out.final_priority = Number(priority[1]);
  return out;
}

export async function deriveFollowUp(pedidoId) {
  const last = await queryOne(
    `SELECT texto, visibilidade FROM comentarios
     WHERE pedido_id = ? ORDER BY data_hora DESC LIMIT 1`,
    [pedidoId],
  );
  if (!last) return null;
  if (last.visibilidade === 'PRIVADO') return 'Pergunta por responder';
  return 'Resposta enviada';
}

export async function enrichRequest(row, userId = null) {
  if (!row) return null;
  const tags = (
    await query(
      `SELECT e.id, e.nome FROM etiquetas e
       JOIN pedido_etiquetas pe ON pe.etiqueta_id = e.id
       WHERE pe.pedido_id = ?`,
      [row.id],
    )
  ).map(mapTag);

  const category = row.categoria_id
    ? mapCategory(await queryOne('SELECT * FROM categorias WHERE id = ?', [row.categoria_id]))
    : null;

  const submitterRow = await queryOne(
    `SELECT u.id, u.email, u.nome, c.empresa,
       'customer' AS role, 'Cliente' AS title
     FROM utilizadores u
     JOIN clientes c ON c.utilizador_id = u.id
     WHERE u.id = ?`,
    [row.cliente_id],
  );
  const submitter = mapUser(submitterRow);

  const votes = await voteCount(row.id);
  const voted = userId
    ? !!(await queryOne('SELECT 1 AS ok FROM votos WHERE pedido_id = ? AND cliente_id = ?', [
        row.id,
        userId,
      ]))
    : false;

  const av = await loadAvaliacao(row.id);
  const parsed = parseInteresse(av?.interesse_clientes);
  const ai = await loadAiSuggestion(row.id);
  const aiScore = ai?.prioridade != null ? Number(ai.prioridade) : null;

  let status = mapPedidoStatus(row);
  if (status === 'admitted') {
    const feat = await queryOne(
      'SELECT id FROM funcionalidades WHERE pedido_origem_id = ?',
      [row.id],
    );
    const story = feat
      ? await queryOne(
          'SELECT id FROM user_stories WHERE funcionalidade_id = ? AND rascunho = 0 LIMIT 1',
          [feat.id],
        )
      : null;
    if (story) status = 'in_backlog';
  }

  const follow_up = await deriveFollowUp(row.id);

  return {
    ...mapRequest(row, {
      status,
      business_value: av?.valor_negocio || null,
      effort: parsed.effort,
      final_priority: parsed.final_priority,
      ai_score: Number.isFinite(aiScore) ? aiScore : null,
      ai_rationale: ai?.fundamentacao || null,
      follow_up,
    }),
    tags,
    category,
    submitter,
    votes,
    voted,
  };
}

export async function aiPrioritize(pedidoId, solicitanteId) {
  const row = await queryOne('SELECT * FROM pedidos WHERE id = ?', [pedidoId]);
  if (!row) return null;
  const votes = await voteCount(pedidoId);
  const unique = await queryOne(
    'SELECT COUNT(DISTINCT cliente_id) AS c FROM votos WHERE pedido_id = ?',
    [pedidoId],
  );
  const uniqueVoters = Number(unique?.c || 0);
  let score = Math.min(0.95, 0.3 + votes * 0.025 + uniqueVoters * 0.02);
  if (row.estado === 'REJEITADO') score = Math.min(score, 0.25);
  if (row.visibilidade === 'PRIVADO') score *= 0.85;
  const rationale =
    votes > 10
      ? `${votes} votos de ${uniqueVoters} clientes e necessidade recorrente.`
      : votes > 0
        ? `Interesse inicial (${votes} votos). Requer validação da Product Owner.`
        : 'Sem votos ainda — priorizar só se alinhado com a estratégia do produto.';
  const po =
    solicitanteId ||
    (await queryOne('SELECT utilizador_id AS id FROM product_owners ORDER BY utilizador_id LIMIT 1'))
      ?.id;
  if (po) {
    await execute(
      `INSERT INTO sugestoes_ia (pedido_id, solicitante_id, prioridade, fundamentacao)
       VALUES (?, ?, ?, ?)`,
      [pedidoId, po, String(Number(score.toFixed(2))), rationale],
    );
  }
  return { ai_score: Number(score.toFixed(2)), ai_rationale: rationale };
}

export function relativeTime(iso, locale = 'pt') {
  if (!iso) return '';
  const raw = String(iso);
  const then = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - then.getTime();
  const mins = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3600000);
  const days = Math.round(diffMs / 86400000);
  if (locale === 'en') {
    if (mins < 60) return `${Math.max(1, mins)} min ago`;
    if (hours < 48) return `${hours}h ago`;
    if (days < 14) return `${days}d ago`;
    return `${Math.round(days / 7)}w ago`;
  }
  if (mins < 60) return `há ${Math.max(1, mins)} min`;
  if (hours < 48) return hours === 1 ? 'há 1 hora' : `há ${hours} horas`;
  if (days === 1) return 'há 1 dia';
  if (days < 14) return `há ${days} dias`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? 'há 1 semana' : `há ${weeks} semanas`;
}

export async function loadFeatureByPedidoId(pedidoId) {
  const row = await queryOne(
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
       (SELECT CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(ai.interesse_clientes, 'priority:', -1), '|', 1) AS UNSIGNED)
        FROM avaliacoes_impacto ai WHERE ai.pedido_id = f.pedido_origem_id) AS final_priority
     FROM funcionalidades f
     LEFT JOIN equipas e ON e.id = f.equipa_id
     LEFT JOIN utilizadores u ON u.id = f.responsavel_id
     WHERE f.pedido_origem_id = ?`,
    [pedidoId],
  );
  return mapFeature(row);
}

export async function loadFeatureByCode(code) {
  const pedidoId = parseFeatureCode(code);
  if (!pedidoId) return null;
  return loadFeatureByPedidoId(pedidoId);
}

export async function loadFeatureRowByCode(code) {
  const pedidoId = parseFeatureCode(code);
  if (!pedidoId) return null;
  return queryOne('SELECT * FROM funcionalidades WHERE pedido_origem_id = ?', [pedidoId]);
}
