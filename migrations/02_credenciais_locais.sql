-- Extensão de aplicação: autenticação local por email/palavra-passe.
-- O schema formal usa identidades_autenticacao para identidade externa;
-- esta tabela guarda o hash bcrypt para o fornecedor local.
USE erprms;

CREATE TABLE IF NOT EXISTS credenciais_locais (
  utilizador_id BIGINT UNSIGNED PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
) ENGINE=InnoDB;
