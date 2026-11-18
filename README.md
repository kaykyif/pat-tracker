# PAT Tracker

Sistema web para **acompanhar o backlog de chamados (PATs) abertos no ERP MXM**.
Toda semana o relatório de chamados é exportado do MXM em planilha; o PAT Tracker
importa esse arquivo, compara com a semana anterior e mostra, de forma executiva,
o que entrou, o que saiu, o que está atrasado e quais prazos foram empurrados.

> Projeto de portfólio. Os dados de exemplo e de produção foram removidos; para
> testar, importe uma planilha no formato do relatório "Consulta de PAT" do MXM.

---

## O problema

O acompanhamento de chamados era feito à mão em planilhas: copiar o relatório da
semana, comparar linha a linha com o da semana anterior, marcar quem é o responsável,
descobrir se um prazo foi adiado e montar o quadro para a diretoria. Lento, sujeito
a erro e sem histórico confiável.

## O que o PAT Tracker faz

1. **Importação semanal** — recebe o relatório exportado do MXM (`.xls`/`.xlsx`) e
   salva uma *foto* (snapshot) de todos os chamados naquela data.
2. **Comparação automática** entre a semana atual e a anterior, classificando cada PAT:

   | Categoria | Significado |
   |---|---|
   | `novo` | apareceu nesta semana |
   | `saiu_mxm` | estava no relatório anterior e saiu do atual |
   | `encerrado` | chamado fechado (visão histórica) |
   | `alterado` | status, prioridade, prazo ou responsável mudou |
   | `atrasado` | prazo já venceu |
   | `vencendo_semana` | prazo cai na próxima semana (domingo a sábado) |
   | `postergado` | o prazo foi empurrado para frente em relação ao histórico |
   | `sem_prazo` | chamado sem data de entrega |
   | `sem_atualizacao` | sem atualização há mais de N dias (configurável em Configurações) |
   | `aberto_mxm` | está com o fornecedor (MXM) e não com a equipe interna |
   | `sem_levantamento` | ainda não tem gerente/diretor/andamento preenchidos |

3. **Dados manuais por chamado** — gerente, diretor, responsável, cliente impactado,
   impacto, medida de contorno e andamento. Formulário com **auto-save** (debounce de
   1s) e histórico de todas as versões.
4. **Histórico de prazos** — linha do tempo de cada PAT mostrando cada vez que o prazo mudou.
5. **Visões**:
   - **Backlog comparativo** — resumo executivo com KPIs e evolução semanal (gráfico);
   - **Quadro da diretoria** — matriz por prioridade: saldo anterior, novos,
     encerrados, *aging* (0–30, 31–60, 60+ dias), responsável (interno × MXM),
     sem prazo e adiados/atrasados;
   - **PATs — info gerais** — tabela filtrável e quadro **Kanban** por status;
   - **Histórico** — uploads salvos e importações de encerrados.
6. **Exportações** — relatório gerencial e levantamento completo em **Excel**, e a
   visão atual em **PDF**.

---

## Arquitetura

```
 Planilha MXM ──► [React + Vite]  ──HTTP──►  [FastAPI]  ──SQLAlchemy──►  SQLite
                   dashboards,               leitura de Excel,            (PostgreSQL/Oracle
                   tabelas, kanban,          classificação,                via DATABASE_URL)
                   exportações               relatórios
```

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Recharts |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Planilhas | `openpyxl` / `xlrd` (leitura e geração), `xlsx` no front |
| Banco | SQLite local; troca para PostgreSQL/Oracle só mudando a `DATABASE_URL` |
| Testes | Vitest + Testing Library |

Todas as tabelas usam o prefixo `pat_` para o sistema poder ser embutido como módulo
em outra aplicação, compartilhando o mesmo banco
(ver [docs/arquitetura-integracao.md](docs/arquitetura-integracao.md)).

---

## Como rodar

Requisitos: **Node 18+** e **Python 3.11+**.

```bash
# Backend (porta 8000)
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
source .venv/bin/activate         # Linux/macOS
pip install -r requirements.txt
cp .env.example .env              # ajuste JWT_SECRET_KEY
uvicorn main:app --reload --port 8000

# Frontend (porta 8080, em outro terminal, na raiz)
npm install
npm run dev
```

O Vite encaminha `/api` para `http://localhost:8000`, então basta abrir
`http://localhost:8080` e importar uma planilha em **Novo Upload**.

### Variáveis do backend (`backend/.env`)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão SQLAlchemy (padrão: SQLite local) |
| `JWT_SECRET_KEY` | chave de assinatura do token de login |
| `FRONTEND_ORIGIN` | origem liberada no CORS |
| `INTERNAL_TEAM` | valor da coluna "Aberto Com" que representa a equipe interna |

### Outros comandos

```bash
npm test          # testes (Vitest)
npm run build     # build de produção
npm run lint      # ESLint
```

---

## Estrutura

```
backend/
  main.py                 entrypoint FastAPI
  routers/                uploads, reports (backlog, gerencial, levantamento, dados manuais), auth
  services/
    excel_reader.py       leitura do relatório MXM
    classifier.py         comparação entre semanas, matriz da diretoria, aging
    excel_writer.py       geração dos relatórios Excel
  models/                 modelos ORM e schemas
src/
  pages/                  Dashboard, QuadroDiretoria, NewAnalysis, PatsInfoGerais, History, Settings
  components/             tabela, kanban, drawer de detalhe, formulário manual, timelines, gráficos
  lib/                    classificação, parser de prazos, exportação Excel/PDF, cliente da API
  test/                   testes de classificação e mapeamento
docs/                     arquitetura de integração (fase 2)
```
