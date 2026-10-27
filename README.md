# Codex — Oficina Literária Pessoal

Aplicação web pessoal para organização de leituras, fichamentos, notas e revisões estruturadas em 3 atos, sincronizada via Firebase (Authentication + Firestore) e Google Drive.

## Secrets do GitHub Actions
Em **Settings → Secrets and variables → Actions**:
- `FIREBASE_API_KEY`: Chave de API do seu projeto Firebase (`codex-literario`).
- `GEMINI_API_KEY` *(opcional)*: Chave do Google AI Studio para o Gemini 2.5 Flash na importação em lote. Se você não criar um secret separado para `GEMINI_API_KEY`, o workflow usa automaticamente a sua `FIREBASE_API_KEY` (basta ativar a **Generative Language API** no Google Cloud Console do projeto `codex-literario`), além de contar com o parser local + busca automática na BrasilAPI (CBL), Google Books e OpenLibrary.
