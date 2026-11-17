/** Map between MySQL domain schema and the SPA API contract. */

export const STATUS_TO_DB = {
  pending_analysis: 'PENDENTE_ANALISE',
  admitted: 'ADMITIDO_ANALISE',
  rejected: 'REJEITADO',
};

export const STATUS_TO_API = {
  PENDENTE_ANALISE: 'pending_analysis',
  ADMITIDO_ANALISE: 'admitted',
  REJEITADO: 'rejected',
};

export const VIS_TO_DB = { public: 'PUBLICO', private: 'PRIVADO' };
export const VIS_TO_API = { PUBLICO: 'public', PRIVADO: 'private' };

export const ROLE_TABLE = {
  customer: 'clientes',
  product_owner: 'product_owners',
  developer: 'programadores',
  project_manager: 'gestores_projeto',
};

export const FEATURE_STATUS_TO_DB = {
  backlog: 'A_FAZER',
  ready: 'A_FAZER',
  in_development: 'EM_CURSO',
  done: 'CONCLUIDA',
};

export function featureStatusToApi(estado, posicaoBacklog) {
  if (estado === 'EM_CURSO') return 'in_development';
  if (estado === 'CONCLUIDA') return 'done';
  if (estado === 'A_FAZER' && posicaoBacklog != null && Number(posicaoBacklog) > 0) return 'ready';
  return 'backlog';
}

export function featureCode(pedidoOrigemId) {
  return `F-${pedidoOrigemId}`;
}

export function parseFeatureCode(code) {
  const m = String(code || '').match(/^F-(\d+)$/i);
  return m ? Number(m[1]) : null;
}

export function quarterFromDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(String(dateStr).includes('T') ? dateStr : `${dateStr}T00:00:00Z`);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

export function mapUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email,
    name: row.nome,
    role: row.role,
    organization: row.organization || row.empresa || null,
    title: row.title || null,
    locale: 'pt',
  };
}

export function mapCategory(row) {
  if (!row) return null;
  const slug = String(row.nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    id: Number(row.id),
    name_pt: row.nome,
    name_en: row.nome,
    slug,
  };
}

export function mapTag(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.nome,
    color: row.color || '#3b5bdb',
  };
}

export function mapPedidoStatus(row) {
  if (row.fundido_em_id) return 'merged';
  return STATUS_TO_API[row.estado] || row.estado;
}

export function mapRequest(row, extras = {}) {
  if (!row) return null;
  const status = extras.status || mapPedidoStatus(row);
  return {
    id: Number(row.id),
    number: Number(row.id),
    title: row.titulo,
    need: row.necessidade,
    benefit: row.beneficio,
    status,
    visibility: VIS_TO_API[row.visibilidade] || row.visibilidade,
    category_id: row.categoria_id != null ? Number(row.categoria_id) : null,
    submitter_id: Number(row.cliente_id),
    business_value: extras.business_value ?? null,
    effort: extras.effort ?? null,
    final_priority: extras.final_priority ?? null,
    ai_score: extras.ai_score ?? null,
    ai_rationale: extras.ai_rationale ?? null,
    rejection_reason: row.estado === 'REJEITADO' ? row.justificacao_decisao : null,
    follow_up: extras.follow_up ?? null,
    merged_into_id: row.fundido_em_id != null ? Number(row.fundido_em_id) : null,
    created_at: row.data_submissao,
    updated_at: row.atualizado_em,
    descricao_publica: row.descricao_publica,
  };
}

export function mapFeature(row) {
  if (!row) return null;
  const pedidoId = Number(row.pedido_origem_id);
  const status = featureStatusToApi(row.estado, row.posicao_backlog);
  return {
    id: Number(row.id),
    code: featureCode(pedidoId),
    title: row.titulo,
    request_id: pedidoId,
    request_number: pedidoId,
    release_id: row.release_id != null ? Number(row.release_id) : null,
    status,
    team: row.team_name || null,
    estimate_points: row.estimativa_esforco != null ? Number(row.estimativa_esforco) : null,
    sprint: row.sprint_label || null,
    assignee_id: row.responsavel_id != null ? Number(row.responsavel_id) : null,
    assignee_name: row.assignee_name || null,
    dependency_code: row.dependency_code || null,
    progress:
      status === 'done' ? 100 : status === 'in_development' ? 55 : status === 'ready' ? 10 : 0,
    final_priority: row.final_priority != null ? Number(row.final_priority) : null,
    created_at: row.criada_em,
    updated_at: row.data_conclusao || row.data_inicio || row.criada_em,
  };
}

export function mapStory(row, criteria = []) {
  if (!row) return null;
  return {
    id: Number(row.id),
    request_id: row.pedido_origem_id != null ? Number(row.pedido_origem_id) : null,
    as_a: row.papel,
    i_want: row.pretendo,
    so_that: row.para_beneficio,
    status: row.rascunho ? 'draft' : 'approved',
    approved_by: row.rascunho ? null : Number(row.autor_id),
    created_at: row.criada_em,
    updated_at: row.criada_em,
    criteria: criteria.map((c) => ({
      id: Number(c.id),
      user_story_id: Number(c.user_story_id),
      code: c.codigo,
      text: c.cenario_gherkin,
      sort_order: Number(c.id),
    })),
  };
}

export function mapRelease(row) {
  if (!row) return null;
  const today = new Date().toISOString().slice(0, 10);
  let status = 'planned';
  if (row.data_inicio && row.data_fim) {
    if (today > row.data_fim) status = 'done';
    else if (today >= row.data_inicio) status = 'in_progress';
  }
  return {
    id: Number(row.id),
    name: row.nome,
    version: row.nome,
    target_date: row.data_fim,
    status,
    description: null,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
  };
}

export function mapMilestone(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    release_id: Number(row.release_id),
    name: row.descricao,
    target_date: row.data_planeada,
    status: row.concluido_em ? 'done' : 'planned',
  };
}

export function mapNotification(row) {
  if (!row) return null;
  let title = row.tipo;
  let body = row.texto;
  let link = null;
  try {
    const parsed = JSON.parse(row.texto);
    if (parsed && typeof parsed === 'object') {
      title = parsed.title || title;
      body = parsed.body || '';
      link = parsed.link || null;
    }
  } catch {
    /* plain text */
  }
  return {
    id: Number(row.id),
    user_id: Number(row.destinatario_id),
    title,
    body,
    link,
    read: row.lida_em ? 1 : 0,
    created_at: row.data_hora,
  };
}

export function mapComment(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    request_id: row.pedido_id != null ? Number(row.pedido_id) : null,
    author_id: Number(row.autor_id),
    body: row.texto,
    kind: row.kind || (row.visibilidade === 'PRIVADO' ? 'clarification' : 'comment'),
    created_at: row.data_hora,
    author_name: row.author_name,
    author_role: row.author_role,
    organization: row.organization,
  };
}
