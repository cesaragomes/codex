# 📚 Codex — Oficina Literária Pessoal & Acervo de Leituras

Aplicação web *Client-Side / Offline-First* projetada para acompanhar leituras feitas no **Kindle** ou em **livros físicos** e transformar o hábito de leitura em produção ativa por meio de resenhas estruturadas em **3 Atos**.

## 📁 Estrutura de Arquivos (Abordagem 2 — Modular Nativa Sem Build)
- `index.html` — Interface principal dividida nas 3 visões (*Estante*, *Oficina em 3 Atos* e *Ritmo & Estilo*).
- `css/styles.css` — Estética Editorial & Literária (*Modo Papel* e *Modo Biblioteca Noturna*).
- `js/db.js` — Inicialização do **Dexie.js (`IndexedDB`)**, cálculo de velocidade (`páginas/dia`) e análise lexical.
- `js/workshop.js` — Editor separado em 3 Atos, Laboratório de Estilo em tempo real e Caderno de Notas/Citações.
- `js/api.js` — Integração com a **Google Books API** e modal de catalogação/edição de obras.
- `js/analytics.js` — Painel anual de velocidade de leitura e gráficos comparativos (`Chart.js`).
- `js/export-backup.js` — Exportação de resenhas em Markdown (`.md`) e Backup/Restore completo em `.json`.
- `js/app.js` — Navegação principal, filtros da Estante e alternância de tema.
- `manifest.json` & `.nojekyll` — Configuração de WebApp (PWA) e entrega direta no GitHub Pages.
- `.github/workflows/deploy.yml` — Workflow de deploy automático para o GitHub Pages.

## 🚀 Como hospedar no GitHub Pages
1. Crie um repositório no GitHub (ex: `codex`) e suba todos os arquivos deste pacote na branch `main`.
2. Vá em **Settings → Pages** e selecione **Deploy from a branch (`main` / `root`)** ou **GitHub Actions**.
3. Acesse a URL gerada pelo GitHub Pages ou abra o `index.html` diretamente no navegador!
