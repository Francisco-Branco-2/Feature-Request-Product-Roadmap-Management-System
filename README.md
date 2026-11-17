# Nimbo Software

Sistema de gestão de pedidos de funcionalidades e roadmap de produto.

## Contas

Palavra-passe de todas as contas: `demo123`

| Papel | Email |
| --- | --- |
| Cliente | `rui.antunes@beiradistribuicao.pt` |
| Product Owner | `marta.ferreira@nimbo.pt` |
| Programadora | `ines.carvalho@nimbo.pt` |
| Gestor de projeto | `paulo.mendes@nimbo.pt` |

## Como correr

Requisitos: Node.js 20+ e Docker.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:reset
npm run dev
```

Abrir http://localhost:5173

O MySQL do Docker usa a porta **3308** no host (para não conflituar com um MySQL local na 3306).

Se as portas 4000 ou 5173 estiverem ocupadas:

```bash
fuser -k 4000/tcp 5173/tcp
npm run dev
```
