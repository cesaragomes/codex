# 📚 Codex — Oficina Literária Pessoal (Com Importação em Lote Gemini IA)

## ✨ Novidade: Importador Inteligente em Lote (Gemini 2.5 Flash + 3 APIs)
Clique em **"Importar Lote (IA)"** no topo do app, cole uma lista de 10, 20 ou mais livros (um por linha) e escolha se todos devem entrar como **Quero Ler**, **Lido** ou **Lendo**.
- Se você configurar o segredo `GEMINI_API_KEY` nos Secrets do GitHub (ou colar uma chave gratuita do Google AI Studio no próprio modal), o **Gemini 2.5 Flash** interpreta a lista inteira, corrige títulos em português, identifica autor, ano, gênero, número de páginas e o **ISBN-13 brasileiro**.
- Em seguida, o Codex cruza cada livro com a **BrasilAPI (CBL)**, **Google Books** e **OpenLibrary** para buscar a capa oficial e validar a contagem de páginas antes de inserir tudo em lote na estante!
