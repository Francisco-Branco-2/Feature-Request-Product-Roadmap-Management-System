import bcrypt from 'bcryptjs';
import { closePool, execute, migrate, queryOne, resetDatabase } from './db.js';

const DEMO_PASSWORD = 'demo123';

async function clear() {
  await execute('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'envios_email',
    'notificacoes',
    'comentario_mencoes',
    'comentarios',
    'criterios_aceitacao',
    'pull_requests',
    'user_stories',
    'dependencias_funcionalidade',
    'sprint_funcionalidades',
    'release_funcionalidades',
    'marcos',
    'sprints',
    'releases',
    'funcionalidades',
    'sugestoes_ia',
    'avaliacoes_impacto',
    'registos_alteracao',
    'versoes_descricao',
    'votos',
    'pedido_etiquetas',
    'pedidos',
    'etiquetas',
    'categorias',
    'espaco_membros',
    'espaco_equipas',
    'espacos_trabalho',
    'equipa_membros',
    'equipas',
    'credenciais_locais',
    'identidades_autenticacao',
    'clientes',
    'product_owners',
    'programadores',
    'gestores_projeto',
    'utilizadores',
    'produtos',
  ];
  for (const t of tables) {
    try {
      await execute(`DELETE FROM ${t}`);
    } catch {
      /* ignore missing */
    }
  }
  await execute('SET FOREIGN_KEY_CHECKS = 1');
}

async function createUser({ email, name, role, organization, passwordHash }) {
  const result = await execute(
    `INSERT INTO utilizadores (nome, email, ativo) VALUES (?, ?, 1)`,
    [name, email],
  );
  const id = result.insertId;
  if (role === 'customer') {
    await execute(`INSERT INTO clientes (utilizador_id, empresa) VALUES (?, ?)`, [
      id,
      organization || 'Cliente',
    ]);
  } else if (role === 'product_owner') {
    await execute(`INSERT INTO product_owners (utilizador_id) VALUES (?)`, [id]);
  } else if (role === 'developer') {
    await execute(`INSERT INTO programadores (utilizador_id) VALUES (?)`, [id]);
  } else if (role === 'project_manager') {
    await execute(`INSERT INTO gestores_projeto (utilizador_id) VALUES (?)`, [id]);
  }
  await execute(
    `INSERT INTO identidades_autenticacao (utilizador_id, fornecedor, identificador_externo)
     VALUES (?, 'local', ?)`,
    [id, email],
  );
  await execute(`INSERT INTO credenciais_locais (utilizador_id, password_hash) VALUES (?, ?)`, [
    id,
    passwordHash,
  ]);
  return id;
}

function dt(days) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 23).replace('T', ' ');
}

export async function seed({ reset = false } = {}) {
  if (reset) await resetDatabase();
  await migrate();
  await clear();

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 8);

  const users = {
    rui: await createUser({
      email: 'rui.antunes@beiradistribuicao.pt',
      name: 'Rui Antunes',
      role: 'customer',
      organization: 'Beira Distribuição',
      passwordHash: hash,
    }),
    marta: await createUser({
      email: 'marta.ferreira@nimbo.pt',
      name: 'Marta Ferreira',
      role: 'product_owner',
      organization: 'Nimbo Software',
      passwordHash: hash,
    }),
    ines: await createUser({
      email: 'ines.carvalho@nimbo.pt',
      name: 'Inês Carvalho',
      role: 'developer',
      organization: 'Nimbo Software',
      passwordHash: hash,
    }),
    paulo: await createUser({
      email: 'paulo.mendes@nimbo.pt',
      name: 'Paulo Mendes',
      role: 'project_manager',
      organization: 'Nimbo Software',
      passwordHash: hash,
    }),
  };

  const extra = [
    ['ana.silva@norte.pt', 'Ana Silva', 'Norte Logística'],
    ['joao.costa@algarve.pt', 'João Costa', 'Algarve Retail'],
    ['sofia.ramos@lisboa.pt', 'Sofia Ramos', 'Lisboa Serviços'],
  ];
  const extraIds = [];
  for (const [email, name, org] of extra) {
    extraIds.push(
      await createUser({
        email,
        name,
        role: 'customer',
        organization: org,
        passwordHash: hash,
      }),
    );
  }

  const produto = (
    await execute(
      `INSERT INTO produtos (nome, descricao) VALUES (?, ?)`,
      ['Nimbo ERP', 'Suite de gestão financeira e operacional da Nimbo Software'],
    )
  ).insertId;

  const equipaReporting = (
    await execute(
      `INSERT INTO equipas (nome, capacidade, unidade_esforco) VALUES (?, ?, ?)`,
      ['Equipa Reporting', 40, 'STORY_POINTS'],
    )
  ).insertId;
  const equipaCobranca = (
    await execute(
      `INSERT INTO equipas (nome, capacidade, unidade_esforco) VALUES (?, ?, ?)`,
      ['Equipa Cobrança', 30, 'STORY_POINTS'],
    )
  ).insertId;
  const equipaFaturacao = (
    await execute(
      `INSERT INTO equipas (nome, capacidade, unidade_esforco) VALUES (?, ?, ?)`,
      ['Equipa Faturação', 25, 'STORY_POINTS'],
    )
  ).insertId;

  await execute(`INSERT INTO equipa_membros (equipa_id, programador_id) VALUES (?, ?)`, [
    equipaReporting,
    users.ines,
  ]);

  const espaco = (
    await execute(`INSERT INTO espacos_trabalho (produto_id, nome) VALUES (?, ?)`, [
      produto,
      'Espaço Nimbo ERP',
    ])
  ).insertId;
  for (const eid of [equipaReporting, equipaCobranca, equipaFaturacao]) {
    await execute(`INSERT INTO espaco_equipas (espaco_id, equipa_id) VALUES (?, ?)`, [espaco, eid]);
  }
  for (const [uid, perm] of [
    [users.marta, 'GESTAO'],
    [users.ines, 'COLABORACAO'],
    [users.paulo, 'GESTAO'],
  ]) {
    await execute(
      `INSERT INTO espaco_membros (espaco_id, utilizador_id, permissao) VALUES (?, ?, ?)`,
      [espaco, uid, perm],
    );
  }

  async function cat(nome) {
    return (await execute(`INSERT INTO categorias (produto_id, nome) VALUES (?, ?)`, [produto, nome]))
      .insertId;
  }
  const categories = {
    relatorios: await cat('Relatórios'),
    faturacao: await cat('Faturação'),
    alertas: await cat('Alertas'),
    exportacao: await cat('Exportação'),
  };

  async function tag(nome) {
    return (await execute(`INSERT INTO etiquetas (produto_id, nome) VALUES (?, ?)`, [produto, nome]))
      .insertId;
  }
  const tags = {
    auditoria: await tag('auditoria'),
    iva: await tag('iva'),
    centros: await tag('centros-de-custo'),
    cobranca: await tag('cobrança'),
  };

  async function insertPedido({
    id,
    clienteId,
    categoriaId,
    titulo,
    necessidade,
    beneficio,
    estado,
    visibilidade,
    descricaoPublica,
    justificacao,
    decididoPor,
    decididoEm,
    dataSubmissao,
  }) {
    await execute(
      `INSERT INTO pedidos (
        id, produto_id, cliente_id, categoria_id, titulo, necessidade, beneficio,
        descricao_publica, estado, visibilidade, data_submissao, atualizado_em,
        justificacao_decisao, decidido_por, decidido_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        produto,
        clienteId,
        categoriaId,
        titulo,
        necessidade,
        beneficio,
        descricaoPublica,
        estado,
        visibilidade,
        dataSubmissao,
        dataSubmissao,
        justificacao,
        decididoPor,
        decididoEm,
      ],
    );
    return id;
  }

  const reqs = {};
  reqs[142] = await insertPedido({
    id: 142,
    clienteId: users.rui,
    categoriaId: categories.relatorios,
    titulo: 'Exportar relatórios por centro de custo',
    necessidade:
      'Exportar os relatórios separados por centro de custo para preparar as auditorias internas.',
    beneficio: 'Reduzir o tempo de preparação das auditorias e evitar erros manuais.',
    estado: 'ADMITIDO_ANALISE',
    visibilidade: 'PUBLICO',
    descricaoPublica:
      'Exportar relatórios separados por centro de custo para auditorias internas.',
    justificacao: 'Pedido alinhado com a estratégia de reporting financeiro.',
    decididoPor: users.marta,
    decididoEm: dt(-10),
    dataSubmissao: dt(-20),
  });

  reqs[151] = await insertPedido({
    id: 151,
    clienteId: users.rui,
    categoriaId: categories.alertas,
    titulo: 'Alertas de faturas vencidas',
    necessidade: 'Receber alertas automáticos quando faturas passam do prazo de pagamento.',
    beneficio: 'Reduzir o tempo de cobrança e os esquecimentos.',
    estado: 'PENDENTE_ANALISE',
    visibilidade: 'PUBLICO',
    descricaoPublica: 'Alertas automáticos para faturas vencidas.',
    justificacao: null,
    decididoPor: null,
    decididoEm: null,
    dataSubmissao: dt(-1),
  });

  reqs[160] = await insertPedido({
    id: 160,
    clienteId: users.rui,
    categoriaId: categories.exportacao,
    titulo: 'Exportar custos por departamento',
    necessidade: 'Exportar custos agregados por departamento a partir da faturação.',
    beneficio: 'Apoiar o reporting interno mensal.',
    estado: 'PENDENTE_ANALISE',
    visibilidade: 'PRIVADO',
    descricaoPublica: null,
    justificacao: null,
    decididoPor: null,
    decididoEm: null,
    dataSubmissao: dt(-3),
  });

  reqs[137] = await insertPedido({
    id: 137,
    clienteId: users.rui,
    categoriaId: categories.relatorios,
    titulo: 'Relatório de IVA por cliente',
    necessidade: 'Gerar relatório de IVA discriminado por cliente.',
    beneficio: 'Facilitar o fecho fiscal mensal.',
    estado: 'REJEITADO',
    visibilidade: 'PUBLICO',
    descricaoPublica: 'Relatório de IVA discriminado por cliente.',
    justificacao: 'Já disponível no relatório fiscal padrão.',
    decididoPor: users.marta,
    decididoEm: dt(-14),
    dataSubmissao: dt(-30),
  });

  reqs[121] = await insertPedido({
    id: 121,
    clienteId: extraIds[0],
    categoriaId: categories.faturacao,
    titulo: 'Centro de custo nas faturas',
    necessidade: 'Indicar o centro de custo em cada linha da fatura.',
    beneficio: 'Melhorar a imputação contabilística.',
    estado: 'ADMITIDO_ANALISE',
    visibilidade: 'PUBLICO',
    descricaoPublica: 'Indicar centro de custo em cada linha da fatura.',
    justificacao: 'Complementa o reporting por centro de custo.',
    decididoPor: users.marta,
    decididoEm: dt(-12),
    dataSubmissao: dt(-25),
  });

  reqs[133] = await insertPedido({
    id: 133,
    clienteId: extraIds[1],
    categoriaId: categories.relatorios,
    titulo: 'Mapa mensal por centro de custo',
    necessidade: 'Mapa mensal com os custos agregados por centro de custo.',
    beneficio: 'Visão consolidada para a direção financeira.',
    estado: 'ADMITIDO_ANALISE',
    visibilidade: 'PUBLICO',
    descricaoPublica: 'Mapa mensal agregado por centro de custo.',
    justificacao: 'Pedido público relacionado com centros de custo.',
    decididoPor: users.marta,
    decididoEm: dt(-8),
    dataSubmissao: dt(-18),
  });

  await execute(`ALTER TABLE pedidos AUTO_INCREMENT = 200`);

  for (const [pedidoId, tagId] of [
    [142, tags.centros],
    [142, tags.auditoria],
    [151, tags.cobranca],
    [137, tags.iva],
    [121, tags.centros],
  ]) {
    await execute(`INSERT INTO pedido_etiquetas (pedido_id, etiqueta_id) VALUES (?, ?)`, [
      pedidoId,
      tagId,
    ]);
  }

  const allCustomers = [users.rui, ...extraIds];
  for (const uid of allCustomers) {
    await execute(`INSERT INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [reqs[142], uid]);
  }
  for (let i = 1; i <= 11; i++) {
    const id = await createUser({
      email: `cliente${i}@demo.pt`,
      name: `Cliente Demo ${i}`,
      role: 'customer',
      organization: `Empresa ${i}`,
      passwordHash: hash,
    });
    await execute(`INSERT INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [reqs[142], id]);
    if (i <= 8) await execute(`INSERT INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [reqs[121], id]);
    if (i <= 3) await execute(`INSERT INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [reqs[133], id]);
    if (i <= 6) await execute(`INSERT INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [reqs[151], id]);
    if (i <= 3) await execute(`INSERT INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [reqs[137], id]);
  }
  await execute(`INSERT IGNORE INTO votos (pedido_id, cliente_id) VALUES (?, ?)`, [
    reqs[151],
    users.rui,
  ]);

  await execute(
    `INSERT INTO comentarios (pedido_id, autor_id, texto, visibilidade, data_hora)
     VALUES (?, ?, ?, 'PRIVADO', ?)`,
    [reqs[142], users.marta, 'Os relatórios devem incluir também os subcentros de custo?', dt(-0.1)],
  );
  await execute(
    `INSERT INTO comentarios (pedido_id, autor_id, texto, visibilidade, data_hora)
     VALUES (?, ?, ?, 'PUBLICO', ?)`,
    [reqs[151], users.rui, 'Gostaríamos de alertas por email e no dashboard.', dt(-0.8)],
  );

  await execute(
    `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_anterior, valor_novo, data_hora)
     VALUES (?, ?, 'estado', NULL, 'PENDENTE_ANALISE', ?)`,
    [reqs[142], users.rui, dt(-20)],
  );
  await execute(
    `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_anterior, valor_novo, data_hora)
     VALUES (?, ?, 'estado', 'PENDENTE_ANALISE', 'ADMITIDO_ANALISE', ?)`,
    [reqs[142], users.marta, dt(-10)],
  );
  await execute(
    `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_anterior, valor_novo, data_hora)
     VALUES (?, ?, 'estado', 'PENDENTE_ANALISE', 'REJEITADO', ?)`,
    [reqs[137], users.marta, dt(-14)],
  );
  await execute(
    `INSERT INTO registos_alteracao (pedido_id, autor_id, campo, valor_anterior, valor_novo, data_hora)
     VALUES (?, ?, 'visibilidade', 'PUBLICO', 'PRIVADO', ?)`,
    [reqs[160], users.marta, dt(-3)],
  );

  await execute(
    `INSERT INTO avaliacoes_impacto (pedido_id, avaliador_id, valor_negocio, interesse_clientes, data_hora)
     VALUES (?, ?, 'high', 'effort:5|priority:1', ?)`,
    [reqs[142], users.marta, dt(-9)],
  );
  await execute(
    `INSERT INTO avaliacoes_impacto (pedido_id, avaliador_id, valor_negocio, interesse_clientes, data_hora)
     VALUES (?, ?, 'medium', 'effort:3|priority:2', ?)`,
    [reqs[121], users.marta, dt(-11)],
  );

  await execute(
    `INSERT INTO sugestoes_ia (pedido_id, solicitante_id, prioridade, fundamentacao, data_hora)
     VALUES (?, ?, '0.91', '23 votos de 14 clientes e necessidade recorrente nas auditorias.', ?)`,
    [reqs[142], users.marta, dt(-9)],
  );
  await execute(
    `INSERT INTO sugestoes_ia (pedido_id, solicitante_id, prioridade, fundamentacao, data_hora)
     VALUES (?, ?, '0.72', 'Interesse dos clientes e impacto direto na cobrança.', ?)`,
    [reqs[151], users.marta, dt(-1)],
  );

  // Features — respect estado/datas/estimativa constraints
  async function insertFeature({
    pedidoId,
    titulo,
    estado,
    equipaId,
    responsavelId,
    estimativa,
    posicao,
    dataInicio,
    dataConclusao,
    estimadaEm,
  }) {
    return (
      await execute(
        `INSERT INTO funcionalidades (
          produto_id, pedido_origem_id, espaco_id, equipa_id, responsavel_id, titulo, estado,
          posicao_backlog, estimativa_esforco, unidade_esforco, estimada_por, estimada_em,
          data_inicio, data_conclusao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          produto,
          pedidoId,
          espaco,
          equipaId,
          responsavelId,
          titulo,
          estado,
          posicao,
          estimativa,
          estimativa != null ? 'STORY_POINTS' : null,
          estimativa != null ? users.ines : null,
          estimativa != null ? estimadaEm || dt(-5) : null,
          dataInicio,
          dataConclusao,
        ],
      )
    ).insertId;
  }

  const f142 = await insertFeature({
    pedidoId: reqs[142],
    titulo: 'Exportar relatórios por centro de custo',
    estado: 'A_FAZER',
    equipaId: equipaReporting,
    responsavelId: users.ines,
    estimativa: 8,
    posicao: 1,
    dataInicio: null,
    dataConclusao: null,
  });

  const f131 = await insertFeature({
    pedidoId: reqs[133],
    titulo: 'Filtros avançados no mapa de custos',
    estado: 'EM_CURSO',
    equipaId: equipaReporting,
    responsavelId: users.ines,
    estimativa: 5,
    posicao: 2,
    dataInicio: dt(-7),
    dataConclusao: null,
  });

  const f151 = await insertFeature({
    pedidoId: reqs[151],
    titulo: 'Alertas de faturas vencidas',
    estado: 'A_FAZER',
    equipaId: equipaCobranca,
    responsavelId: null,
    estimativa: 5,
    posicao: null,
    dataInicio: null,
    dataConclusao: null,
  });

  const f118 = await insertFeature({
    pedidoId: reqs[121],
    titulo: 'Centro de custo nas faturas',
    estado: 'CONCLUIDA',
    equipaId: equipaFaturacao,
    responsavelId: users.ines,
    estimativa: 3,
    posicao: 3,
    dataInicio: dt(-40),
    dataConclusao: dt(-10),
  });

  await execute(
    `INSERT INTO dependencias_funcionalidade (dependente_id, bloqueadora_id, autor_id)
     VALUES (?, ?, ?)`,
    [f151, f142, users.ines],
  );

  const storyId = (
    await execute(
      `INSERT INTO user_stories (funcionalidade_id, autor_id, papel, pretendo, para_beneficio, rascunho, gerada_por_ia)
       VALUES (?, ?, ?, ?, ?, 0, 1)`,
      [
        f142,
        users.marta,
        'diretor financeiro de uma empresa cliente',
        'exportar os relatórios por centro de custo',
        'preparar as auditorias internas sem folhas de cálculo manuais',
      ],
    )
  ).insertId;

  await execute(
    `INSERT INTO criterios_aceitacao (user_story_id, definido_por, codigo, cenario_gherkin)
     VALUES (?, ?, 'CA1', ?)`,
    [
      storyId,
      users.marta,
      'Dado que o cliente tem centros de custo, quando exporta o relatório, então cada centro aparece num separador ou ficheiro distinto.',
    ],
  );
  await execute(
    `INSERT INTO criterios_aceitacao (user_story_id, definido_por, codigo, cenario_gherkin)
     VALUES (?, ?, 'CA2', ?)`,
    [
      storyId,
      users.marta,
      'Dado um período selecionado, quando confirma a exportação, então o ficheiro é gerado em menos de 30 segundos para até 10 000 linhas.',
    ],
  );

  const releaseId = (
    await execute(
      `INSERT INTO releases (produto_id, nome, data_inicio, data_fim, criada_por)
       VALUES (?, ?, ?, ?, ?)`,
      [produto, 'Release 2027.1', '2027-01-01', '2027-03-31', users.paulo],
    )
  ).insertId;

  for (const [desc, date] of [
    ['Fim do desenvolvimento', '2027-03-05'],
    ['Demonstração ao cliente', '2027-03-20'],
    ['Entrega ao cliente', '2027-03-31'],
  ]) {
    await execute(
      `INSERT INTO marcos (release_id, descricao, data_planeada) VALUES (?, ?, ?)`,
      [releaseId, desc, date],
    );
  }

  const sprint11 = (
    await execute(
      `INSERT INTO sprints (produto_id, equipa_id, numero, data_inicio, data_fim, capacidade, unidade_esforco)
       VALUES (?, ?, 11, '2026-11-01', '2026-11-14', 40, 'STORY_POINTS')`,
      [produto, equipaReporting],
    )
  ).insertId;
  const sprint12 = (
    await execute(
      `INSERT INTO sprints (produto_id, equipa_id, numero, data_inicio, data_fim, capacidade, unidade_esforco)
       VALUES (?, ?, 12, '2026-11-15', '2026-11-28', 40, 'STORY_POINTS')`,
      [produto, equipaReporting],
    )
  ).insertId;
  const sprint10 = (
    await execute(
      `INSERT INTO sprints (produto_id, equipa_id, numero, data_inicio, data_fim, capacidade, unidade_esforco)
       VALUES (?, ?, 10, '2026-10-15', '2026-10-28', 30, 'STORY_POINTS')`,
      [produto, equipaFaturacao],
    )
  ).insertId;

  // Triggers require ADMITIDO + estimativa — already satisfied for these features
  await execute(
    `INSERT INTO sprint_funcionalidades (sprint_id, funcionalidade_id, incluida_por)
     VALUES (?, ?, ?)`,
    [sprint12, f142, users.marta],
  );
  await execute(
    `INSERT INTO sprint_funcionalidades (sprint_id, funcionalidade_id, incluida_por)
     VALUES (?, ?, ?)`,
    [sprint11, f131, users.marta],
  );
  await execute(
    `INSERT INTO sprint_funcionalidades (sprint_id, funcionalidade_id, incluida_por)
     VALUES (?, ?, ?)`,
    [sprint10, f118, users.marta],
  );

  // f151 fica fora da release: pedido ainda PENDENTE_ANALISE (trigger exige ADMITIDO)
  for (const fid of [f142, f131, f118]) {
    await execute(
      `INSERT INTO release_funcionalidades (release_id, funcionalidade_id, incluida_por)
       VALUES (?, ?, ?)`,
      [releaseId, fid, users.paulo],
    );
  }

  await execute(
    `INSERT INTO comentarios (funcionalidade_id, autor_id, texto, visibilidade)
     VALUES (?, ?, ?, 'PRIVADO')`,
    [f142, users.ines, '@Marta o centro de custo inclui subcentros na exportação?'],
  );
  await execute(
    `INSERT INTO comentarios (funcionalidade_id, autor_id, texto, visibilidade)
     VALUES (?, ?, ?, 'PRIVADO')`,
    [f131, users.paulo, 'Capacidade da Equipa Reporting no Sprint 11 está no limite.'],
  );
  await execute(
    `INSERT INTO comentarios (funcionalidade_id, autor_id, texto, visibilidade)
     VALUES (?, ?, ?, 'PRIVADO')`,
    [f131, users.ines, 'PR associado: #482 — filtros por período e centro.'],
  );

  async function notify(userId, title, body, link) {
    await execute(
      `INSERT INTO notificacoes (destinatario_id, tipo, texto)
       VALUES (?, ?, ?)`,
      [userId, title, JSON.stringify({ title, body, link })],
    );
  }
  await notify(
    users.rui,
    'Esclarecimento no pedido #142',
    'A Product Owner perguntou sobre subcentros de custo.',
    '/customer/requests/142',
  );
  await notify(
    users.marta,
    'Novo pedido #151',
    'Rui Antunes submeteu Alertas de faturas vencidas.',
    '/po/requests/151',
  );
  await notify(
    users.ines,
    'F-131 em desenvolvimento',
    'F-131 passou a Em desenvolvimento.',
    '/dev/features/F-131',
  );
  await notify(
    users.paulo,
    'Marco: Demonstração ao cliente',
    'Marco registado para 20 mar 2027.',
    '/pm/releases',
  );

  const counts = await queryOne('SELECT COUNT(*) AS c FROM utilizadores');
  console.log('Seed complete.');
  console.log('Demo password for all personas:', DEMO_PASSWORD);
  console.log({
    customer: 'rui.antunes@beiradistribuicao.pt',
    product_owner: 'marta.ferreira@nimbo.pt',
    developer: 'ines.carvalho@nimbo.pt',
    project_manager: 'paulo.mendes@nimbo.pt',
    users: Number(counts.c),
  });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain || process.argv[1]?.endsWith('seed.js')) {
  const reset = process.argv.includes('--reset');
  seed({ reset })
    .then(() => closePool())
    .catch(async (err) => {
      console.error(err);
      await closePool();
      process.exit(1);
    });
}
