# 📚 Codex — Oficina Literária Pessoal (Edição Cloud Firebase + Google Drive)

Aplicação web *Client-Side / Cloud-Synced* projetada para acompanhar leituras feitas no **Kindle** ou em **livros físicos** e transformar o hábito de leitura em produção ativa por meio de resenhas estruturadas em **3 Atos**.

## 🔐 Segurança & Sincronização em Nuvem
- **Login Obrigatório via Google (Firebase Authentication):** Configurado com o projeto `codex-literario` e restrito exclusivamente a `cesaraugusto.pintogomes@gmail.com`.
- **Sincronização Automática (Cloud Firestore + Dexie.js):** Tudo o que você cadastrar ou escrever no computador sincroniza automaticamente com o celular.
- **Backup Direto no Google Drive (API v3):** Salva e restaura o arquivo `codex-cloud-backup.json` diretamente na sua conta do Google Drive.
- **Busca Tripla de Livros e ISBN:** Consulta simultaneamente a **BrasilAPI (CBL / ISBN brasileiro)**, **Google Books API** e **OpenLibrary API**.

## 📁 Estrutura de Arquivos (Abordagem 2 — Modular Nativa Sem Build)
- `index.html` — Interface principal dividida nas 3 visões (*Estante*, *Oficina em 3 Atos* e *Ritmo & Estilo*) + Tela de Login Privado.
- `css/styles.css` — Estética Editorial & Literária (*Modo Papel* e *Modo Biblioteca Noturna*).
- `js/db.js` — Inicialização do **Firebase (`codex-literario`)**, sincronização com **Cloud Firestore**, **Google Drive API** e banco local **Dexie.js**.
- `js/workshop.js` — Editor separado em 3 Atos, Laboratório de Estilo em tempo real e Caderno de Notas/Citações.
- `js/api.js` — Busca Tripla (**BrasilAPI ISBN + Google Books + OpenLibrary**) e modal de catalogação/edição de obras.
- `js/analytics.js` — Painel anual de velocidade de leitura e gráficos comparativos (`Chart.js`).
- `js/export-backup.js` — Exportação de resenhas em Markdown (`.md`) e Backup/Restore completo em `.json`.
- `js/app.js` — Navegação principal, filtros da Estante e alternância de tema.
- `firestore.rules` — Regras de segurança do Firestore prontas para colar no console do Firebase.
