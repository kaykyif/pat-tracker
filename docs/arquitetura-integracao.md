# Arquitetura de Integração — Pat-Tracker Pro

> Este documento descreve a arquitetura planejada para a **Fase 2**: migração do Pat-Tracker Pro de uma aplicação standalone para um módulo integrado dentro de um projeto hospedeiro já existente.

---

## Visão Geral das Fases

```
Fase 1 (ATUAL)                    Fase 2 (FUTURO)
────────────────────               ──────────────────────────────────────
[React Vite App]                   [Projeto Hospedeiro - Frontend]
    ↕ HTTP                             ├── /dashboard (rotas do hospedeiro)
[FastAPI Backend]                      └── /pat-tracker ← módulo integrado
    ↕ SQLAlchemy                           ↕ HTTP
[SQLite Local]                     [Projeto Hospedeiro - Backend]
                                       ├── routers do hospedeiro
                                       └── /pat/* ← routers do pat-tracker
                                           ↕ SQLAlchemy
                                       [PostgreSQL Compartilhado]
```

---

## Banco de Dados — Fase 2 (PostgreSQL)

> **Importante:** Todas as tabelas usam o prefixo `pat_` para não colidir com tabelas do projeto hospedeiro.
> A tabela `pat_users` será **removida** na Fase 2 — o usuário virá do sistema de auth do hospedeiro.

### Diagrama de Relacionamentos (ERD)

```
HOSPEDEIRO_USERS (tabela do hospedeiro)
│  id (PK)
│  nome
│  email
│
└──< pat_uploads (1 usuário → N uploads)
      │  id (PK)
      │  user_id (FK → hospedeiro_users.id)
      │  file_name
      │  reference_date
      │  total_pats
      │  total_mxm
      │  created_at
      │
      └──< pat_snapshots (1 upload → N snapshots)
            │  id (PK)
            │  upload_id (FK → pat_uploads.id)
            │  pat_id  ← número real do PAT, ex: "616167"
            │  reference_date
            │  modulo, titulo, cliente
            │  data_abertura, prioridade, status
            │  tipo_prazo, descricao, prazo
            │  encerramento, aberto_com
            │  created_at
            │
            ├── (pat_id) ──> pat_manual_data (1:1 por PAT)
            │                  pat_id (PK)
            │                  andamento, responsavel_pat
            │                  usuario_solicitante, gerente
            │                  diretor, cliente_impactado
            │                  impacto_problema, medida_contorno
            │                  updated_at
            │
            └── (pat_id) ──> pat_manual_data_history (1:N por PAT)
                               id (PK)
                               pat_id, reference_date
                               andamento, responsavel_pat, ...
                               created_at

pat_analysis_cache  (cache de comparativos)
  id (PK)
  upload_recent_id (FK → pat_uploads.id)
  upload_previous_id (FK → pat_uploads.id)
  totals_json, pats_json, matrix_json
  week_start, week_end
  created_at

pat_encerrados  (PATs removidos da MXM mas com histórico)
  pat_id (PK)
  data_abertura, encerramento
  modulo, titulo, cliente, status, descricao
  created_at
```

---

## Descrição das Tabelas

### `pat_uploads` — Controle de Importações
Cada linha representa um arquivo Excel do MXM importado pelo usuário.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK | Identificador interno |
| `user_id` | INT FK | ID do usuário do sistema hospedeiro (nullable na Fase 1) |
| `file_name` | VARCHAR(500) | Nome original do arquivo importado |
| `reference_date` | DATE | Data de referência do relatório (extraída do arquivo) |
| `total_pats` | INT | Quantidade total de PATs no arquivo |
| `total_mxm` | INT | Quantidade de PATs com `aberto_com = MXM` |
| `created_at` | DATETIME | Quando o upload foi processado |

**Constraint única:** `(user_id, reference_date)` — evita duplicatas do mesmo relatório por usuário.

---

### `pat_snapshots` — Histórico de Estados dos PATs
Cada linha representa o estado de um PAT em uma data específica. É a tabela mais importante do sistema — toda a inteligência de comparação, postergação e timeline é derivada dela.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK | Identificador interno |
| `upload_id` | INT FK | Upload de origem |
| `pat_id` | VARCHAR(50) | **Número real do PAT** (ex: `616167`) |
| `reference_date` | DATE | Data do relatório |
| `modulo` | VARCHAR(200) | Módulo/Sistema do PAT |
| `titulo` | VARCHAR(500) | Título / Descrição curta |
| `cliente` | VARCHAR(200) | Usuário solicitante (campo da MXM) |
| `data_abertura` | DATE | Data de abertura do PAT |
| `prioridade` | VARCHAR(100) | Natureza/Prioridade |
| `status` | VARCHAR(200) | Status atual na MXM |
| `tipo_prazo` | VARCHAR(100) | Tipo do prazo (ex: Externo, Interno) |
| `descricao` | TEXT | Descrição completa |
| `prazo` | DATE | Prazo de atendimento |
| `encerramento` | DATE | Data de encerramento (se houver) |
| `aberto_com` | VARCHAR(100) | Equipe responsável (ex: `MXM`, equipe interna) |
| `created_at` | DATETIME | Quando o registro foi inserido |

**Índices:** `(pat_id, reference_date)` e `(upload_id)` para performance nas queries de comparação.

---

### `pat_manual_data` — Dados Manuais de Levantamento (Estado Atual)
Dados preenchidos manualmente pela equipe (não vêm da MXM). Existe **um registro por PAT** — sempre a versão mais recente. É a fonte de verdade para o formulário lateral do drawer.

| Campo | Tipo | Descrição |
|---|---|---|
| `pat_id` | VARCHAR(50) PK | Número do PAT |
| `andamento` | TEXT | Descrição do andamento atual |
| `responsavel_pat` | VARCHAR(200) | Nome do responsável interno pelo PAT |
| `usuario_solicitante` | VARCHAR(200) | Usuário que abriu o PAT |
| `gerente` | VARCHAR(200) | Gerente responsável |
| `diretor` | VARCHAR(200) | Diretor responsável |
| `cliente_impactado` | VARCHAR(200) | Cliente afetado pelo problema |
| `impacto_problema` | TEXT | Descrição do impacto |
| `medida_contorno` | TEXT | Medida de contorno adotada |
| `updated_at` | DATETIME | Última atualização (auto-atualizado) |

---

### `pat_manual_data_history` — Histórico de Dados Manuais
Toda vez que um arquivo de levantamento é importado, um snapshot histórico é salvo aqui. Permite ver a evolução dos andamentos ao longo do tempo na timeline do PAT.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK | Identificador |
| `pat_id` | VARCHAR(50) | Número do PAT |
| `reference_date` | DATE | Data do levantamento de origem |
| `andamento` | TEXT | Andamento naquele momento |
| `responsavel_pat` ... | ... | Mesmos campos de `pat_manual_data` |
| `created_at` | DATETIME | Quando o histórico foi registrado |

---

### `pat_analysis_cache` — Cache de Análises Comparativas
Armazena o resultado do comparativo entre dois uploads (`recent` vs `previous`) para evitar reprocessar quando o usuário troca os seletores no Dashboard.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | INT PK | Identificador |
| `upload_recent_id` | INT FK | Upload mais recente |
| `upload_previous_id` | INT FK | Upload anterior de comparação |
| `totals_json` | TEXT | JSON com os totais por categoria |
| `pats_json` | TEXT | JSON com todos os PATs classificados |
| `matrix_json` | TEXT | JSON com a matriz de movimentação |
| `week_start` | DATE | Início da semana de referência |
| `week_end` | DATE | Fim da semana de referência |
| `created_at` | DATETIME | Quando o cache foi gerado |

**Constraint única:** `(upload_recent_id, upload_previous_id)`.

---

### `pat_encerrados` — PATs Encerrados / Histórico Permanente
PATs removidos dos relatórios ativos da MXM (porque foram encerrados) mas que precisam aparecer no histórico do sistema para rastreabilidade.

| Campo | Tipo | Descrição |
|---|---|---|
| `pat_id` | VARCHAR(50) PK | Número do PAT |
| `data_abertura` | DATE | Data de abertura original |
| `encerramento` | DATE | Data de encerramento |
| `modulo` | VARCHAR(200) | Módulo/Sistema |
| `titulo` | VARCHAR(500) | Título |
| `cliente` | VARCHAR(200) | Usuário solicitante |
| `status` | VARCHAR(200) | Status final |
| `descricao` | TEXT | Descrição |
| `created_at` | DATETIME | Quando foi registrado como encerrado |

---

## Plano de Migração — Fase 1 → Fase 2

### Passo 1: Trocar a Connection String
No arquivo `backend/db/session.py`, substituir:
```python
# Fase 1 (SQLite)
DATABASE_URL = "sqlite:///./pat_tracker.db"

# Fase 2 (PostgreSQL)
DATABASE_URL = os.environ.get("DATABASE_URL")
# ex: postgresql://user:pass@host:5432/hospedeiro_db
```
> Os modelos SQLAlchemy são 100% compatíveis — nenhum código de modelo muda.

### Passo 2: Remover `pat_users` e Integrar Auth do Hospedeiro
- Remover a tabela `pat_users` e o router `auth.py`.
- O endpoint de uploads deve receber o `user_id` via JWT do hospedeiro:
```python
# Antes (Fase 1)
user_id = req.user_id  # passado pelo frontend

# Depois (Fase 2)
from hospedeiro.auth import get_current_user

@router.post("/uploads")
def create_upload(user = Depends(get_current_user), ...):
    upload.user_id = user.id
```

### Passo 3: Registrar os Routers no Hospedeiro
```python
# No main.py do projeto hospedeiro
from pat_tracker.routers import uploads, reports

app.include_router(uploads.router, prefix="/pat/uploads", tags=["PAT Uploads"])
app.include_router(reports.router, prefix="/pat/reports", tags=["PAT Reports"])
```

### Passo 4: Integrar o Frontend
Mover o build do React para dentro do projeto hospedeiro como uma rota protegida. O `VITE_API_BASE_URL` apontará para o backend do hospedeiro:
```
https://hospedeiro.com/pat-tracker  ← frontend
https://hospedeiro.com/api/pat/*    ← backend
```

### Passo 5: Migração de Dados Existentes
Exportar o banco SQLite atual para PostgreSQL:
```bash
# Opção 1: pgloader (recomendado)
pgloader sqlite:///pat_tracker.db postgresql://user:pass@host/hospedeiro_db

# Opção 2: Script Python com SQLAlchemy (mais controle)
# criar script de seed lendo do SQLite e inserindo no Postgres
```
> Os dados serão preservados com IDs intactos e histórico completo.

---

## O que NÃO Muda na Fase 2

| Item | Status |
|---|---|
| Lógica de classificação (`services/classifier.py`) | ✅ Agnóstica de banco |
| Endpoints da API (`/reports/*`, `/uploads/*`) | ✅ Mesmos contratos |
| Modelos ORM SQLAlchemy | ✅ Compatíveis com PostgreSQL sem alteração |
| Frontend React (páginas, componentes, hooks) | ✅ Apenas muda URL base da API |
| Leitura/escrita de planilhas Excel | ✅ Independente do banco |
| Prefixo `pat_` nas tabelas | ✅ Já adotado desde a Fase 1 |

---

## Checklist para Iniciar a Fase 2

- [ ] Obter credenciais de acesso ao banco PostgreSQL do projeto hospedeiro
- [ ] Definir schema/namespace do banco para as tabelas do Pat-Tracker
- [ ] Confirmar sistema de autenticação do hospedeiro (JWT? OAuth? Session?)
- [ ] Criar a rota `/pat-tracker` no frontend hospedeiro
- [ ] Rodar script de migração dos dados do SQLite para PostgreSQL
- [ ] Atualizar `.env` com `DATABASE_URL` do PostgreSQL
- [ ] Remover `pat_users` e adaptar auth para o sistema do hospedeiro
- [ ] Registrar os routers do Pat-Tracker no backend do hospedeiro
- [ ] Testar todos os endpoints no novo ambiente
- [ ] Configurar CORS para aceitar o domínio do projeto hospedeiro
