# 📚 Codex — Oficina Literária Pessoal (Com GitHub Secrets)

## 🔒 Como funciona a proteção da sua chave (`FIREBASE_API_KEY`)
O arquivo `js/db.js` neste repositório **não contém nenhuma chave exposta** (ele usa apenas o marcador `__CODEX_FIREBASE_API_KEY__`), evitando qualquer alerta de *Secret Scanning* do GitHub.

Quando você faz um `push`, o **GitHub Actions** (`.github/workflows/deploy.yml`) lê o segredo salvo nas configurações privadas do seu repositório (`secrets.FIREBASE_API_KEY`) e injeta a chave automaticamente apenas no pacote publicado no GitHub Pages.
