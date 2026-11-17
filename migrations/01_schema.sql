CREATE DATABASE IF NOT EXISTS erprms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erprms;
SET time_zone = '+00:00';

CREATE TABLE utilizadores (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nome VARCHAR(150) NOT NULL,
 email VARCHAR(254) NOT NULL,
 ativo BOOLEAN NOT NULL DEFAULT TRUE,
 criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_utilizador_email (email),
 CONSTRAINT ck_utilizador_nome CHECK (CHAR_LENGTH(TRIM(nome)) > 0)
) ENGINE=InnoDB;

-- Heranca por tabela de subtipo; um utilizador pode ter varios papeis.
CREATE TABLE clientes (
 utilizador_id BIGINT UNSIGNED PRIMARY KEY,
 empresa VARCHAR(200) NOT NULL,
 FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;
CREATE TABLE product_owners (
 utilizador_id BIGINT UNSIGNED PRIMARY KEY,
 FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;
CREATE TABLE programadores (
 utilizador_id BIGINT UNSIGNED PRIMARY KEY,
 FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;
CREATE TABLE gestores_projeto (
 utilizador_id BIGINT UNSIGNED PRIMARY KEY,
 FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;

-- Identidade externa opcional; nao assume passwords nem fornecedor especifico.
CREATE TABLE identidades_autenticacao (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 utilizador_id BIGINT UNSIGNED NOT NULL,
 fornecedor VARCHAR(100) NOT NULL,
 identificador_externo VARCHAR(255) NOT NULL,
 UNIQUE KEY uq_identidade (fornecedor, identificador_externo),
 FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;

CREATE TABLE produtos (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nome VARCHAR(150) NOT NULL,
 descricao TEXT NULL
) ENGINE=InnoDB;
CREATE TABLE equipas (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nome VARCHAR(150) NOT NULL,
 capacidade DECIMAL(10,2) NULL,
 unidade_esforco ENUM('HORAS','STORY_POINTS') NULL,
 CONSTRAINT ck_equipa_capacidade CHECK (capacidade IS NULL OR capacidade >= 0),
 CONSTRAINT ck_equipa_unidade CHECK (capacidade IS NULL OR unidade_esforco IS NOT NULL)
) ENGINE=InnoDB;
CREATE TABLE equipa_membros (
 equipa_id BIGINT UNSIGNED NOT NULL,
 programador_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY (equipa_id, programador_id),
 FOREIGN KEY (equipa_id) REFERENCES equipas(id),
 FOREIGN KEY (programador_id) REFERENCES programadores(utilizador_id)
) ENGINE=InnoDB;
CREATE TABLE espacos_trabalho (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 produto_id BIGINT UNSIGNED NOT NULL,
 nome VARCHAR(150) NOT NULL,
 FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB;
CREATE TABLE espaco_equipas (
 espaco_id BIGINT UNSIGNED NOT NULL,
 equipa_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY (espaco_id, equipa_id),
 FOREIGN KEY (espaco_id) REFERENCES espacos_trabalho(id),
 FOREIGN KEY (equipa_id) REFERENCES equipas(id)
) ENGINE=InnoDB;
CREATE TABLE espaco_membros (
 espaco_id BIGINT UNSIGNED NOT NULL,
 utilizador_id BIGINT UNSIGNED NOT NULL,
 permissao ENUM('LEITURA','COLABORACAO','GESTAO') NOT NULL,
 PRIMARY KEY (espaco_id, utilizador_id),
 FOREIGN KEY (espaco_id) REFERENCES espacos_trabalho(id),
 FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;

CREATE TABLE categorias (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 produto_id BIGINT UNSIGNED NOT NULL,
 nome VARCHAR(100) NOT NULL,
 UNIQUE KEY uq_categoria_nome (produto_id, nome),
 FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB;
CREATE TABLE etiquetas (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 produto_id BIGINT UNSIGNED NOT NULL,
 nome VARCHAR(100) NOT NULL,
 UNIQUE KEY uq_etiqueta_nome (produto_id, nome),
 FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB;

CREATE TABLE pedidos (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 produto_id BIGINT UNSIGNED NOT NULL,
 cliente_id BIGINT UNSIGNED NOT NULL,
 categoria_id BIGINT UNSIGNED NULL,
 titulo VARCHAR(200) NOT NULL,
 necessidade TEXT NOT NULL,
 beneficio TEXT NOT NULL,
 descricao_publica TEXT NULL,
 estado ENUM('PENDENTE_ANALISE','ADMITIDO_ANALISE','REJEITADO') NOT NULL DEFAULT 'PENDENTE_ANALISE',
 visibilidade ENUM('PUBLICO','PRIVADO') NOT NULL DEFAULT 'PRIVADO',
 data_submissao DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 justificacao_decisao TEXT NULL,
 decidido_por BIGINT UNSIGNED NULL,
 decidido_em DATETIME(6) NULL,
 fundido_em_id BIGINT UNSIGNED NULL,
 fundido_por BIGINT UNSIGNED NULL,
 fundido_em_data DATETIME(6) NULL,
 bloqueio_versao INT UNSIGNED NOT NULL DEFAULT 1,
 KEY ix_pedido_lista (produto_id, estado, categoria_id),
 KEY ix_pedido_cliente (cliente_id, data_submissao),
 KEY ix_pedido_publico (produto_id, visibilidade),
 FOREIGN KEY (produto_id) REFERENCES produtos(id),
 FOREIGN KEY (cliente_id) REFERENCES clientes(utilizador_id),
 FOREIGN KEY (categoria_id) REFERENCES categorias(id),
 FOREIGN KEY (decidido_por) REFERENCES product_owners(utilizador_id),
 FOREIGN KEY (fundido_por) REFERENCES product_owners(utilizador_id),
 FOREIGN KEY (fundido_em_id) REFERENCES pedidos(id),
 CONSTRAINT ck_pedido_textos CHECK (CHAR_LENGTH(TRIM(titulo)) > 0 AND CHAR_LENGTH(TRIM(necessidade)) > 0 AND CHAR_LENGTH(TRIM(beneficio)) > 0),
 CONSTRAINT ck_pedido_decisao CHECK (
  (estado = 'PENDENTE_ANALISE' AND justificacao_decisao IS NULL AND decidido_por IS NULL AND decidido_em IS NULL)
  OR (estado <> 'PENDENTE_ANALISE' AND justificacao_decisao IS NOT NULL AND CHAR_LENGTH(TRIM(justificacao_decisao)) > 0 AND decidido_por IS NOT NULL AND decidido_em IS NOT NULL)
 ),
 CONSTRAINT ck_pedido_publicacao CHECK (visibilidade = 'PRIVADO' OR (descricao_publica IS NOT NULL AND CHAR_LENGTH(TRIM(descricao_publica)) > 0)),
 CONSTRAINT ck_pedido_fusao CHECK (
  (fundido_em_id IS NULL AND fundido_por IS NULL AND fundido_em_data IS NULL)
  OR (fundido_em_id IS NOT NULL AND fundido_por IS NOT NULL AND fundido_em_data IS NOT NULL)
 )
) ENGINE=InnoDB;
CREATE TABLE pedido_etiquetas (
 pedido_id BIGINT UNSIGNED NOT NULL,
 etiqueta_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY (pedido_id, etiqueta_id),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (etiqueta_id) REFERENCES etiquetas(id)
) ENGINE=InnoDB;
CREATE TABLE votos (
 pedido_id BIGINT UNSIGNED NOT NULL,
 cliente_id BIGINT UNSIGNED NOT NULL,
 data_hora DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY (pedido_id, cliente_id),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (cliente_id) REFERENCES clientes(utilizador_id)
) ENGINE=InnoDB;
CREATE TABLE versoes_descricao (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 pedido_id BIGINT UNSIGNED NOT NULL,
 autor_id BIGINT UNSIGNED NOT NULL,
 numero INT UNSIGNED NOT NULL,
 texto TEXT NOT NULL,
 beneficio TEXT NOT NULL,
 data_hora DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_versao_pedido (pedido_id, numero),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (autor_id) REFERENCES utilizadores(id),
 CONSTRAINT ck_versao_numero CHECK (numero > 0)
) ENGINE=InnoDB;
CREATE TABLE registos_alteracao (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 pedido_id BIGINT UNSIGNED NOT NULL,
 autor_id BIGINT UNSIGNED NOT NULL,
 campo VARCHAR(100) NOT NULL,
 valor_anterior TEXT NULL,
 valor_novo TEXT NULL,
 data_hora DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 KEY ix_alteracao_pedido (pedido_id, data_hora),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (autor_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;
CREATE TABLE avaliacoes_impacto (
 pedido_id BIGINT UNSIGNED PRIMARY KEY,
 avaliador_id BIGINT UNSIGNED NOT NULL,
 valor_negocio TEXT NOT NULL,
 interesse_clientes TEXT NULL,
 data_hora DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (avaliador_id) REFERENCES product_owners(utilizador_id),
 CONSTRAINT ck_impacto_valor CHECK (CHAR_LENGTH(TRIM(valor_negocio)) > 0)
) ENGINE=InnoDB;
CREATE TABLE sugestoes_ia (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 pedido_id BIGINT UNSIGNED NOT NULL,
 solicitante_id BIGINT UNSIGNED NOT NULL,
 prioridade VARCHAR(100) NOT NULL,
 fundamentacao TEXT NULL,
 decisao_final TEXT NULL,
 data_hora DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (solicitante_id) REFERENCES product_owners(utilizador_id)
) ENGINE=InnoDB;

CREATE TABLE funcionalidades (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 produto_id BIGINT UNSIGNED NOT NULL,
 pedido_origem_id BIGINT UNSIGNED NOT NULL,
 espaco_id BIGINT UNSIGNED NULL,
 equipa_id BIGINT UNSIGNED NULL,
 responsavel_id BIGINT UNSIGNED NULL,
 titulo VARCHAR(200) NOT NULL,
 estado ENUM('A_FAZER','EM_CURSO','CONCLUIDA') NOT NULL DEFAULT 'A_FAZER',
 posicao_backlog DECIMAL(20,6) NULL,
 estimativa_esforco DECIMAL(10,2) NULL,
 unidade_esforco ENUM('HORAS','STORY_POINTS') NULL,
 estimada_por BIGINT UNSIGNED NULL,
 estimada_em DATETIME(6) NULL,
 criada_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 data_inicio DATETIME(6) NULL,
 data_conclusao DATETIME(6) NULL,
 UNIQUE KEY uq_funcionalidade_origem (pedido_origem_id),
 KEY ix_funcionalidade_backlog (produto_id, posicao_backlog),
 FOREIGN KEY (produto_id) REFERENCES produtos(id),
 FOREIGN KEY (pedido_origem_id) REFERENCES pedidos(id),
 FOREIGN KEY (espaco_id) REFERENCES espacos_trabalho(id),
 FOREIGN KEY (equipa_id) REFERENCES equipas(id),
 FOREIGN KEY (responsavel_id) REFERENCES programadores(utilizador_id),
 FOREIGN KEY (estimada_por) REFERENCES programadores(utilizador_id),
 CONSTRAINT ck_func_estimativa CHECK (
  (estimativa_esforco IS NULL AND unidade_esforco IS NULL AND estimada_por IS NULL AND estimada_em IS NULL)
  OR (estimativa_esforco IS NOT NULL AND estimativa_esforco > 0 AND unidade_esforco IS NOT NULL AND estimada_por IS NOT NULL AND estimada_em IS NOT NULL)
 ),
 CONSTRAINT ck_func_datas CHECK (data_conclusao IS NULL OR (data_inicio IS NOT NULL AND data_conclusao >= data_inicio)),
 CONSTRAINT ck_func_estado_datas CHECK (
  (estado = 'A_FAZER' AND data_inicio IS NULL AND data_conclusao IS NULL)
  OR (estado = 'EM_CURSO' AND data_inicio IS NOT NULL AND data_conclusao IS NULL)
  OR (estado = 'CONCLUIDA' AND data_inicio IS NOT NULL AND data_conclusao IS NOT NULL)
 )
) ENGINE=InnoDB;
CREATE TABLE dependencias_funcionalidade (
 dependente_id BIGINT UNSIGNED NOT NULL,
 bloqueadora_id BIGINT UNSIGNED NOT NULL,
 autor_id BIGINT UNSIGNED NOT NULL,
 criada_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY (dependente_id, bloqueadora_id),
 FOREIGN KEY (dependente_id) REFERENCES funcionalidades(id),
 FOREIGN KEY (bloqueadora_id) REFERENCES funcionalidades(id),
 FOREIGN KEY (autor_id) REFERENCES programadores(utilizador_id),
 CONSTRAINT ck_dependencia_distinta CHECK (dependente_id <> bloqueadora_id)
) ENGINE=InnoDB;
CREATE TABLE comentarios (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 pedido_id BIGINT UNSIGNED NULL,
 funcionalidade_id BIGINT UNSIGNED NULL,
 autor_id BIGINT UNSIGNED NOT NULL,
 resposta_a_id BIGINT UNSIGNED NULL,
 texto TEXT NOT NULL,
 visibilidade ENUM('PUBLICO','PRIVADO') NOT NULL DEFAULT 'PRIVADO',
 data_hora DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 KEY ix_comentario_pedido (pedido_id, data_hora),
 KEY ix_comentario_func (funcionalidade_id, data_hora),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (funcionalidade_id) REFERENCES funcionalidades(id),
 FOREIGN KEY (autor_id) REFERENCES utilizadores(id),
 FOREIGN KEY (resposta_a_id) REFERENCES comentarios(id),
 CONSTRAINT ck_comentario_destino CHECK ((pedido_id IS NOT NULL) + (funcionalidade_id IS NOT NULL) = 1),
 CONSTRAINT ck_comentario_texto CHECK (CHAR_LENGTH(TRIM(texto)) > 0)
) ENGINE=InnoDB;
CREATE TABLE comentario_mencoes (
 comentario_id BIGINT UNSIGNED NOT NULL,
 utilizador_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY (comentario_id, utilizador_id),
 FOREIGN KEY (comentario_id) REFERENCES comentarios(id),
 FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;
CREATE TABLE user_stories (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 funcionalidade_id BIGINT UNSIGNED NOT NULL,
 autor_id BIGINT UNSIGNED NOT NULL,
 papel VARCHAR(100) NOT NULL,
 pretendo TEXT NOT NULL,
 para_beneficio TEXT NOT NULL,
 rascunho BOOLEAN NOT NULL DEFAULT TRUE,
 gerada_por_ia BOOLEAN NOT NULL DEFAULT FALSE,
 criada_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 FOREIGN KEY (funcionalidade_id) REFERENCES funcionalidades(id),
 FOREIGN KEY (autor_id) REFERENCES utilizadores(id),
 CONSTRAINT ck_story_textos CHECK (CHAR_LENGTH(TRIM(papel)) > 0 AND CHAR_LENGTH(TRIM(pretendo)) > 0 AND CHAR_LENGTH(TRIM(para_beneficio)) > 0)
) ENGINE=InnoDB;
CREATE TABLE criterios_aceitacao (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_story_id BIGINT UNSIGNED NOT NULL,
 definido_por BIGINT UNSIGNED NOT NULL,
 codigo VARCHAR(20) NOT NULL,
 cenario_gherkin TEXT NOT NULL,
 UNIQUE KEY uq_criterio_codigo (user_story_id, codigo),
 FOREIGN KEY (user_story_id) REFERENCES user_stories(id),
 FOREIGN KEY (definido_por) REFERENCES product_owners(utilizador_id),
 CONSTRAINT ck_criterio_texto CHECK (CHAR_LENGTH(TRIM(cenario_gherkin)) > 0)
) ENGINE=InnoDB;
CREATE TABLE pull_requests (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_story_id BIGINT UNSIGNED NOT NULL,
 associado_por BIGINT UNSIGNED NOT NULL,
 identificador VARCHAR(200) NOT NULL,
 url VARCHAR(1000) NOT NULL,
 criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_pr_story_identificador (user_story_id, identificador),
 FOREIGN KEY (user_story_id) REFERENCES user_stories(id),
 FOREIGN KEY (associado_por) REFERENCES programadores(utilizador_id)
) ENGINE=InnoDB;

CREATE TABLE sprints (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 produto_id BIGINT UNSIGNED NOT NULL,
 equipa_id BIGINT UNSIGNED NULL,
 numero INT UNSIGNED NOT NULL,
 data_inicio DATE NOT NULL,
 data_fim DATE NOT NULL,
 capacidade DECIMAL(10,2) NULL,
 unidade_esforco ENUM('HORAS','STORY_POINTS') NULL,
 UNIQUE KEY uq_sprint_numero (produto_id, numero),
 FOREIGN KEY (produto_id) REFERENCES produtos(id),
 FOREIGN KEY (equipa_id) REFERENCES equipas(id),
 CONSTRAINT ck_sprint_datas CHECK (data_fim >= data_inicio),
 CONSTRAINT ck_sprint_capacidade CHECK (capacidade IS NULL OR capacidade >= 0),
 CONSTRAINT ck_sprint_unidade CHECK (capacidade IS NULL OR unidade_esforco IS NOT NULL)
) ENGINE=InnoDB;
CREATE TABLE releases (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 produto_id BIGINT UNSIGNED NOT NULL,
 nome VARCHAR(150) NOT NULL,
 data_inicio DATE NOT NULL,
 data_fim DATE NOT NULL,
 criada_por BIGINT UNSIGNED NOT NULL,
 FOREIGN KEY (produto_id) REFERENCES produtos(id),
 FOREIGN KEY (criada_por) REFERENCES gestores_projeto(utilizador_id),
 CONSTRAINT ck_release_datas CHECK (data_fim >= data_inicio)
) ENGINE=InnoDB;
CREATE TABLE sprint_funcionalidades (
 sprint_id BIGINT UNSIGNED NOT NULL,
 funcionalidade_id BIGINT UNSIGNED NOT NULL,
 incluida_por BIGINT UNSIGNED NOT NULL,
 incluida_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 retirada_em DATETIME(6) NULL,
 PRIMARY KEY (sprint_id, funcionalidade_id),
 FOREIGN KEY (sprint_id) REFERENCES sprints(id),
 FOREIGN KEY (funcionalidade_id) REFERENCES funcionalidades(id),
 FOREIGN KEY (incluida_por) REFERENCES product_owners(utilizador_id),
 CONSTRAINT ck_sprint_retirada CHECK (retirada_em IS NULL OR retirada_em >= incluida_em)
) ENGINE=InnoDB;
CREATE TABLE release_funcionalidades (
 release_id BIGINT UNSIGNED NOT NULL,
 funcionalidade_id BIGINT UNSIGNED NOT NULL,
 incluida_por BIGINT UNSIGNED NOT NULL,
 incluida_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 retirada_em DATETIME(6) NULL,
 PRIMARY KEY (release_id, funcionalidade_id),
 FOREIGN KEY (release_id) REFERENCES releases(id),
 FOREIGN KEY (funcionalidade_id) REFERENCES funcionalidades(id),
 FOREIGN KEY (incluida_por) REFERENCES gestores_projeto(utilizador_id),
 CONSTRAINT ck_release_retirada CHECK (retirada_em IS NULL OR retirada_em >= incluida_em)
) ENGINE=InnoDB;
CREATE TABLE marcos (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 release_id BIGINT UNSIGNED NOT NULL,
 descricao VARCHAR(500) NOT NULL,
 data_planeada DATE NOT NULL,
 concluido_em DATETIME(6) NULL,
 FOREIGN KEY (release_id) REFERENCES releases(id),
 CONSTRAINT ck_marco_descricao CHECK (CHAR_LENGTH(TRIM(descricao)) > 0)
) ENGINE=InnoDB;
CREATE TABLE notificacoes (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 destinatario_id BIGINT UNSIGNED NOT NULL,
 pedido_id BIGINT UNSIGNED NULL,
 comentario_id BIGINT UNSIGNED NULL,
 tipo VARCHAR(80) NOT NULL,
 texto TEXT NOT NULL,
 data_hora DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 lida_em DATETIME(6) NULL,
 KEY ix_notificacao_destinatario (destinatario_id, lida_em, data_hora),
 FOREIGN KEY (destinatario_id) REFERENCES utilizadores(id),
 FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
 FOREIGN KEY (comentario_id) REFERENCES comentarios(id)
) ENGINE=InnoDB;
-- Outbox: a notificacao e a intencao de email devem nascer na mesma transacao.
CREATE TABLE envios_email (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 notificacao_id BIGINT UNSIGNED NOT NULL,
 estado ENUM('PENDENTE','ENVIADO','FALHOU') NOT NULL DEFAULT 'PENDENTE',
 tentativas INT UNSIGNED NOT NULL DEFAULT 0,
 proxima_tentativa_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 enviado_em DATETIME(6) NULL,
 ultimo_erro TEXT NULL,
 UNIQUE KEY uq_email_notificacao (notificacao_id),
 KEY ix_email_pendente (estado, proxima_tentativa_em),
 FOREIGN KEY (notificacao_id) REFERENCES notificacoes(id)
) ENGINE=InnoDB;

-- Consistencia entre tabelas: estimativa e admissao antes do planeamento.
-- O back-end tem de usar as mesmas transacoes e ordem de bloqueio.
DELIMITER $$
CREATE TRIGGER bi_sprint_funcionalidade BEFORE INSERT ON sprint_funcionalidades
FOR EACH ROW
BEGIN
 DECLARE v_esforco DECIMAL(10,2);
 DECLARE v_estado VARCHAR(30);
 DECLARE v_produto BIGINT UNSIGNED;
 DECLARE v_produto_sprint BIGINT UNSIGNED;
 SELECT estimativa_esforco, produto_id INTO v_esforco, v_produto
 FROM funcionalidades WHERE id = NEW.funcionalidade_id FOR UPDATE;
 SELECT p.estado INTO v_estado FROM pedidos p
 JOIN funcionalidades f ON f.pedido_origem_id = p.id WHERE f.id = NEW.funcionalidade_id FOR UPDATE;
 SELECT produto_id INTO v_produto_sprint FROM sprints WHERE id = NEW.sprint_id;
 IF v_esforco IS NULL OR v_estado <> 'ADMITIDO_ANALISE' OR v_produto <> v_produto_sprint THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Planeamento exige admissao, estimativa e mesmo produto';
 END IF;
END$$
CREATE TRIGGER bi_release_funcionalidade BEFORE INSERT ON release_funcionalidades
FOR EACH ROW
BEGIN
 DECLARE v_esforco DECIMAL(10,2);
 DECLARE v_estado VARCHAR(30);
 DECLARE v_produto BIGINT UNSIGNED;
 DECLARE v_produto_release BIGINT UNSIGNED;
 SELECT estimativa_esforco, produto_id INTO v_esforco, v_produto
 FROM funcionalidades WHERE id = NEW.funcionalidade_id FOR UPDATE;
 SELECT p.estado INTO v_estado FROM pedidos p
 JOIN funcionalidades f ON f.pedido_origem_id = p.id WHERE f.id = NEW.funcionalidade_id FOR UPDATE;
 SELECT produto_id INTO v_produto_release FROM releases WHERE id = NEW.release_id;
 IF v_esforco IS NULL OR v_estado <> 'ADMITIDO_ANALISE' OR v_produto <> v_produto_release THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Planeamento exige admissao, estimativa e mesmo produto';
 END IF;
END$$
DELIMITER ;

-- Projecao publica: nao e por si so uma politica de acesso.
-- Publicacao exige uma descricao publica revista; comentarios sao filtrados pela API.
CREATE VIEW vw_pedidos_publicos AS
SELECT p.id, p.produto_id, p.titulo, p.descricao_publica, p.categoria_id,
 p.estado AS estado_triagem, p.data_submissao,
 (SELECT COUNT(*) FROM votos v WHERE v.pedido_id = p.id) AS votos_diretos
FROM pedidos p WHERE p.visibilidade = 'PUBLICO' AND p.fundido_em_id IS NULL;

-- Contagem distinta: inclui pedidos fundidos DIRETAMENTE no principal.
-- A fusao deve manter a ligacao plana para o principal canonico.
CREATE VIEW vw_votos_consolidados AS
SELECT COALESCE(p.fundido_em_id, p.id) AS pedido_principal_id,
 COUNT(DISTINCT v.cliente_id) AS votos_unicos
FROM pedidos p LEFT JOIN votos v ON v.pedido_id = p.id
GROUP BY COALESCE(p.fundido_em_id, p.id);

CREATE VIEW vw_tempos_funcionalidade AS
SELECT id AS funcionalidade_id, produto_id, equipa_id,
 TIMESTAMPDIFF(SECOND, criada_em, data_conclusao) AS lead_time_funcionalidade_segundos,
 TIMESTAMPDIFF(SECOND, data_inicio, data_conclusao) AS cycle_time_segundos
FROM funcionalidades WHERE estado = 'CONCLUIDA';
