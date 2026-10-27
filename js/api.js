// =========================================================================
    // 6. MULTI-ENGINE BOOK SEARCH (BRASILAPI ISBN + GOOGLE BOOKS + OPENLIBRARY)
    // =========================================================================
    function openAddBookModal() {
      document.getElementById('modal-book-title-heading').textContent = 'Catalogar Nova Obra no Acervo';
      document.getElementById('book-id-input').value = '';
      document.getElementById('form-book').reset();
      document.getElementById('book-status-input').value = 'reading';
      document.getElementById('book-start-input').value = new Date().toISOString().slice(0, 10);
      document.getElementById('api-search-results').classList.add('hidden');
      document.getElementById('api-search-query').value = '';
      document.getElementById('modal-add-book').classList.remove('hidden');
    }

    function openEditBookModal(bookId) {
      const book = state.books.find(b => b.id === bookId);
      if (!book) return;
      document.getElementById('modal-book-title-heading').textContent = 'Editar Metadados & Datas de Leitura';
      document.getElementById('book-id-input').value = book.id;
      document.getElementById('book-title-input').value = book.title || '';
      document.getElementById('book-author-input').value = book.author || '';
      document.getElementById('book-year-input').value = book.publishedYear || '';
      document.getElementById('book-genre-input').value = book.genre || '';
      document.getElementById('book-pages-input').value = book.pageCount || '';
      document.getElementById('book-status-input').value = book.status || 'backlog';
      document.getElementById('book-format-input').value = book.format || 'kindle';
      document.getElementById('book-rating-input').value = book.rating || 0;
      document.getElementById('book-start-input').value = book.startDate || '';
      document.getElementById('book-finish-input').value = book.finishDate || '';
      document.getElementById('book-cover-input').value = book.coverUrl || '';
      document.getElementById('api-search-results').classList.add('hidden');
      document.getElementById('modal-add-book').classList.remove('hidden');
    }

    function closeAddBookModal() {
      document.getElementById('modal-add-book').classList.add('hidden');
    }

    function handleModalStatusChange() {
      const status = document.getElementById('book-status-input').value;
      const todayIso = new Date().toISOString().slice(0, 10);
      const startInput = document.getElementById('book-start-input');
      const finishInput = document.getElementById('book-finish-input');
      if (status === 'reading' && !startInput.value) {
        startInput.value = todayIso;
      } else if (status === 'completed') {
        if (!startInput.value) startInput.value = todayIso;
        if (!finishInput.value) finishInput.value = todayIso;
      }
    }

    async function searchBooksAPI() {
      const rawQuery = document.getElementById('api-search-query').value.trim();
      const resultsBox = document.getElementById('api-search-results');
      const btn = document.getElementById('btn-api-search');
      if (!rawQuery) {
        showToast('Digite o título, autor ou ISBN para buscar.');
        return;
      }

      btn.textContent = 'Buscando...';
      btn.disabled = true;
      resultsBox.classList.remove('hidden');
      resultsBox.innerHTML = `<div class="text-xs text-paper-600 dark:text-paper-400 p-2">Consultando BrasilAPI (ISBN), Google Books e OpenLibrary...</div>`;

      const cleanedDigits = rawQuery.replace(/[-\s]/g, '');
      const isIsbn = /^(978|979)?\d{9}[\dXx]$/.test(cleanedDigits);
      const combinedResults = [];

      // 1. Se for ISBN (especialmente edições brasileiras), consulta BrasilAPI ISBN (CBL / Mercado Editorial)
      if (isIsbn) {
        try {
          const brRes = await fetch(`https://brasilapi.com.br/api/isbn/v1/${cleanedDigits}`);
          if (brRes.ok) {
            const brData = await brRes.json();
            if (brData && brData.title) {
              combinedResults.push({
                source: 'BrasilAPI / CBL',
                title: brData.subtitle ? `${brData.title}: ${brData.subtitle}` : brData.title,
                author: Array.isArray(brData.authors) && brData.authors.length ? brData.authors.join(', ') : 'Autor não informado',
                publishedYear: brData.year ? Number(brData.year) : '',
                genre: Array.isArray(brData.subjects) && brData.subjects[0] ? brData.subjects[0] : 'Literatura',
                pageCount: brData.page_count || 250,
                coverUrl: brData.cover_url || `https://covers.openlibrary.org/b/isbn/${cleanedDigits}-M.jpg`
              });
            }
          }
        } catch (e) {}
      }

      // 2. Consulta Google Books API (tanto com prefixo isbn: quanto busca geral para não perder edições sem tag ISBN)
      try {
        const queriesToTry = isIsbn
          ? [`isbn:${cleanedDigits}`, cleanedDigits]
          : [rawQuery];

        for (const qStr of queriesToTry) {
          const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(qStr)}&maxResults=6`;
          const gRes = await fetch(gUrl);
          if (gRes.ok) {
            const gData = await gRes.json();
            const items = gData.items || [];
            items.forEach(item => {
              const info = item.volumeInfo || {};
              if (!info.title) return;
              const yearMatch = (info.publishedDate || '').match(/\d{4}/);
              let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
              if (cover.startsWith('http://')) cover = cover.replace('http://', 'https://');
              combinedResults.push({
                source: 'Google Books',
                title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
                author: (info.authors && info.authors.join(', ')) || 'Autor desconhecido',
                publishedYear: yearMatch ? Number(yearMatch[0]) : '',
                genre: (info.categories && info.categories[0]) || 'Literatura',
                pageCount: info.pageCount || 240,
                coverUrl: cover
              });
            });
            if (combinedResults.length >= 4) break;
          }
        }
      } catch (e) {}

      // 3. Consulta OpenLibrary Search API (excelente fallback sem chave de API)
      try {
        const olUrl = isIsbn
          ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(cleanedDigits)}&limit=5`
          : `https://openlibrary.org/search.json?q=${encodeURIComponent(rawQuery)}&limit=5`;
        const olRes = await fetch(olUrl);
        if (olRes.ok) {
          const olData = await olRes.json();
          const docs = olData.docs || [];
          docs.forEach(doc => {
            if (!doc.title) return;
            const cover = doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : (isIsbn ? `https://covers.openlibrary.org/b/isbn/${cleanedDigits}-M.jpg` : '');
            combinedResults.push({
              source: 'OpenLibrary',
              title: doc.title,
              author: (doc.author_name && doc.author_name.slice(0, 2).join(', ')) || 'Autor desconhecido',
              publishedYear: doc.first_publish_year || '',
              genre: (doc.subject && doc.subject[0]) || 'Literatura',
              pageCount: doc.number_of_pages_median || 250,
              coverUrl: cover
            });
          });
        }
      } catch (e) {}

      // Deduplicar resultados por título + autor
      const seen = new Set();
      const uniqueResults = combinedResults.filter(item => {
        const key = `${item.title.toLowerCase().slice(0, 25)}|${item.author.toLowerCase().slice(0, 15)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 8);

      window._lastApiItems = uniqueResults;

      if (uniqueResults.length === 0) {
        resultsBox.innerHTML = `
          <div class="text-xs text-paper-600 dark:text-paper-400 p-2.5 rounded-lg bg-paper-50 dark:bg-stone-900 border border-paper-300 dark:border-stone-700">
            Nenhum resultado retornado pelas APIs neste instante (ou conexão bloqueada pelo modo preview). Você pode preencher os campos abaixo manualmente.
          </div>
        `;
      } else {
        resultsBox.innerHTML = uniqueResults.map((b, idx) => `
          <div class="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-paper-50 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 hover:border-burgundy-600/50 transition-colors">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-paper-200 dark:bg-stone-800 text-burgundy-600 dark:text-amber-400">${escapeHtml(b.source)}</span>
                <p class="text-xs font-bold text-paper-800 dark:text-paper-100 truncate">${escapeHtml(b.title)}</p>
              </div>
              <p class="text-[11px] text-paper-600 dark:text-paper-400 truncate mt-0.5">${escapeHtml(b.author)} ${b.publishedYear ? `(${b.publishedYear})` : ''} • <span class="font-mono font-semibold">${b.pageCount} págs</span></p>
            </div>
            <button type="button" onclick="applyApiBookResult(${idx})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burgundy-600 hover:bg-burgundy-700 dark:bg-amber-600 text-white shrink-0">
              Usar Dados
            </button>
          </div>
        `).join('');
      }

      btn.textContent = 'Buscar na API';
      btn.disabled = false;
    }

    function applyApiBookResult(index) {
      const b = window._lastApiItems?.[index];
      if (!b) return;
      document.getElementById('book-title-input').value = b.title;
      document.getElementById('book-author-input').value = b.author;
      document.getElementById('book-year-input').value = b.publishedYear;
      document.getElementById('book-genre-input').value = b.genre;
      document.getElementById('book-pages-input').value = b.pageCount;
      document.getElementById('book-cover-input').value = b.coverUrl;
      showToast(`Dados preenchidos via ${b.source}!`);
    }

    async function handleSaveBook(event) {
      event.preventDefault();
      const idVal = document.getElementById('book-id-input').value;
      const title = document.getElementById('book-title-input').value.trim();
      const author = document.getElementById('book-author-input').value.trim();
      const publishedYear = Number(document.getElementById('book-year-input').value) || null;
      const genre = document.getElementById('book-genre-input').value.trim() || 'Literatura';
      const pageCount = Math.max(1, Number(document.getElementById('book-pages-input').value) || 200);
      const status = document.getElementById('book-status-input').value;
      const format = document.getElementById('book-format-input').value;
      const rating = Number(document.getElementById('book-rating-input').value) || 0;
      const startDate = document.getElementById('book-start-input').value;
      const finishDate = document.getElementById('book-finish-input').value;
      const coverUrl = document.getElementById('book-cover-input').value.trim();

      const vel = status === 'completed'
        ? calculateReadingVelocity(pageCount, startDate || new Date().toISOString().slice(0, 10), finishDate || new Date().toISOString().slice(0, 10))
        : { daysTaken: null, pagesPerDay: null };

      const nowIso = new Date().toISOString();
      const bookObj = {
        ...(idVal ? { id: Number(idVal) } : {}),
        title,
        author,
        publishedYear,
        genre,
        pageCount,
        status,
        format,
        rating,
        startDate,
        finishDate,
        daysTaken: vel.daysTaken,
        pagesPerDay: vel.pagesPerDay,
        coverUrl,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      if (!useMemoryFallback && db) {
        const savedId = await db.books.put(bookObj);
        state.selectedBookId = savedId;
      } else {
        if (idVal) {
          const idx = memoryStore.books.findIndex(b => b.id === Number(idVal));
          if (idx >= 0) memoryStore.books[idx] = bookObj;
        } else {
          bookObj.id = Date.now();
          memoryStore.books.push(bookObj);
          state.selectedBookId = bookObj.id;
        }
      }

      closeAddBookModal();
      await refreshStateFromDB();
      await pushAllToFirestore(true);
      showToast(`"${title}" salvo na estante e sincronizado!`);
    }

    async function deleteBook(bookId) {
      const book = state.books.find(b => b.id === bookId);
      if (!book) return;
      if (!useMemoryFallback && db) {
        await db.books.delete(bookId);
        await db.notes.where('bookId').equals(bookId).delete();
        await db.reviews.where('bookId').equals(bookId).delete();
      } else {
        memoryStore.books = memoryStore.books.filter(b => b.id !== bookId);
        memoryStore.notes = memoryStore.notes.filter(n => n.bookId !== bookId);
        memoryStore.reviews = memoryStore.reviews.filter(r => r.bookId !== bookId);
      }
      if (state.selectedBookId === bookId) {
        state.selectedBookId = null;
      }
      await refreshStateFromDB();
      await pushAllToFirestore(true);
      showToast(`"${book.title}" removido do acervo.`);
    }


    // =========================================================================
    // 6B. IMPORTAÇÃO DE LIVROS EM LOTE (PARSER INTELIGENTE + GEMINI + CATÁLOGOS)
    // =========================================================================
    const _injectedGeminiKey = "__CODEX_GEMINI_API_KEY__";
    let batchCandidates = [];

    function getActiveGeminiKey() {
      if (_injectedGeminiKey && !_injectedGeminiKey.startsWith("__CODEX_")) {
        return _injectedGeminiKey;
      }
      try {
        const localGemini = localStorage.getItem('codex_gemini_api_key');
        if (localGemini) return localGemini;
      } catch (e) {}
      // Usa a chave do projeto Google Cloud / Firebase caso a Generative Language API esteja ativa no mesmo projeto
      if (firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("__CODEX_")) {
        return firebaseConfig.apiKey;
      }
      return '';
    }

    function openBatchImportModal() {
      document.getElementById('modal-batch-import').classList.remove('hidden');
    }

    function closeBatchImportModal() {
      document.getElementById('modal-batch-import').classList.add('hidden');
    }

    function fillSampleBatchList() {
      const sample = [
        'Manifesto do Partido Comunista (Karl Marx e Friedrich Engels) — O texto fundacional',
        'O Capital (Karl Marx) — A crítica definitiva ao modo de produção capitalista',
        'A Origem da Família, da Propriedade Privada e do Estado (Friedrich Engels)',
        'Torto Arado - Itamar Vieira Junior',
        'A Hora da Estrela (Clarice Lispector)'
      ].join('\n');
      document.getElementById('batch-raw-input').value = sample;
    }

    // Extrai Título Limpo, Autor e ISBN mesmo quando a linha vem com parênteses, travessões e resumos
    function parseRawBookLine(rawLine) {
      let line = String(rawLine || '')
        .replace(/^\s*(?:\d+[.)\-\s]+|[-*•]\s*)/, '')
        .replace(/[*_~`]/g, '')
        .trim();

      let extractedIsbn = '';
      const isbnMatch = line.match(/\b((?:978|979)[-\s]?\d[\d-\s]{8,11}[\dXx]|\d{9}[\dXx])\b/);
      if (isbnMatch) {
        extractedIsbn = isbnMatch[1].replace(/[-\s]/g, '');
      }

      // Caso 1: "Título da Obra (Autor) — Descrição opcional" ou "Título (Autor) - Descrição"
      const parenAuthorMatch = line.match(/^(.+?)\s*\(([^)]+)\)\s*(?:[—–\-:]\s*(.*))?$/);
      if (parenAuthorMatch) {
        const candidateTitle = parenAuthorMatch[1].trim().replace(/^["'“”«»]|["'“”«»]$/g, '');
        const insideParen = parenAuthorMatch[2].trim();
        // Se dentro do parêntese não for apenas um ano de 4 dígitos, é o autor
        if (!/^\d{4}$/.test(insideParen)) {
          return {
            cleanTitle: candidateTitle,
            cleanAuthor: insideParen,
            isbn: extractedIsbn
          };
        }
      }

      // Remove descrições longas após travessão duplo/em-dash " — " quando o título já está antes
      if (line.includes(' — ')) {
        const dashParts = line.split(' — ');
        const left = dashParts[0].trim();
        const right = dashParts.slice(1).join(' — ').trim();
        // Se o lado direito tem até 4 palavras e parece nome de autor, usa como autor; senão descarta como resumo
        if (right.split(/\s+/).length <= 4 && !/[.!?,;]/.test(right)) {
          return { cleanTitle: left, cleanAuthor: right, isbn: extractedIsbn };
        }
        line = left;
      }

      // Caso 2: "Título - Autor" ou "Título – Autor"
      const sepMatch = line.match(/^(.+?)\s+[-–]\s+([^—–\-]+)$/);
      if (sepMatch) {
        const left = sepMatch[1].trim();
        const right = sepMatch[2].trim();
        if (right.split(/\s+/).length <= 6) {
          return { cleanTitle: left, cleanAuthor: right, isbn: extractedIsbn };
        }
        return { cleanTitle: left, cleanAuthor: '', isbn: extractedIsbn };
      }

      // Caso 3: "Título, de Autor" ou "Título por Autor"
      const byMatch = line.match(/^(.+?)(?:,\s*de|\s+por)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú.]+){0,4})$/);
      if (byMatch) {
        return { cleanTitle: byMatch[1].trim(), cleanAuthor: byMatch[2].trim(), isbn: extractedIsbn };
      }

      return {
        cleanTitle: line.replace(/^["'“”«»]|["'“”«»]$/g, '').trim(),
        cleanAuthor: '',
        isbn: extractedIsbn
      };
    }

    async function enrichSingleBookFromPublicAPIs(rawLine, initialData = {}) {
      const parsedLine = parseRawBookLine(rawLine);
      const cleanTitle = (initialData.title || parsedLine.cleanTitle || rawLine).trim();
      const cleanAuthor = (initialData.author && initialData.author !== 'Autor desconhecido')
        ? initialData.author.trim()
        : (parsedLine.cleanAuthor || '');
      const cleanIsbn = (initialData.isbn || parsedLine.isbn || '').replace(/[-\s]/g, '');
      const hasValidIsbn = /^(978|979)?\d{9}[\dXx]$/.test(cleanIsbn);

      let resolved = {
        title: cleanTitle,
        author: cleanAuthor || 'Autor desconhecido',
        publishedYear: initialData.publishedYear || '',
        genre: initialData.genre || 'Literatura',
        pageCount: Number(initialData.pageCount) || 0,
        isbn: hasValidIsbn ? cleanIsbn : '',
        coverUrl: initialData.coverUrl || ''
      };

      // 1. Se tiver ISBN válido, consulta BrasilAPI ISBN (CBL)
      if (resolved.isbn) {
        try {
          const brRes = await fetch(`https://brasilapi.com.br/api/isbn/v1/${resolved.isbn}`);
          if (brRes.ok) {
            const brData = await brRes.json();
            if (brData && brData.title) {
              resolved.title = brData.subtitle ? `${brData.title}: ${brData.subtitle}` : brData.title;
              if (Array.isArray(brData.authors) && brData.authors.length) resolved.author = brData.authors.join(', ');
              if (brData.year) resolved.publishedYear = Number(brData.year);
              if (Array.isArray(brData.subjects) && brData.subjects[0]) resolved.genre = brData.subjects[0];
              if (brData.page_count) resolved.pageCount = Number(brData.page_count);
              if (brData.cover_url) resolved.coverUrl = brData.cover_url;
            }
          }
        } catch (e) {}
      }

      // 2. Consulta Google Books usando apenas o Título Limpo + Autor Limpo (sem o resumo que quebrava a busca!)
      try {
        const queryCandidates = [];
        if (cleanTitle && cleanAuthor) {
          queryCandidates.push(`intitle:${cleanTitle} inauthor:${cleanAuthor}`);
          queryCandidates.push(`${cleanTitle} ${cleanAuthor}`);
        } else {
          queryCandidates.push(cleanTitle);
        }

        for (const qStr of queryCandidates) {
          const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(qStr)}&maxResults=4`);
          if (gRes.ok) {
            const gData = await gRes.json();
            const items = gData.items || [];
            // Escolhe o primeiro item que tenha capa ou contagem de páginas
            const bestItem = items.find(it => it.volumeInfo?.imageLinks && it.volumeInfo?.pageCount)
                          || items.find(it => it.volumeInfo?.imageLinks)
                          || items[0];
            if (bestItem && bestItem.volumeInfo) {
              const info = bestItem.volumeInfo;
              if (info.title && (!initialData.title || resolved.title === rawLine)) {
                resolved.title = info.title;
              }
              if ((!resolved.author || resolved.author === 'Autor desconhecido') && Array.isArray(info.authors)) {
                resolved.author = info.authors.join(', ');
              }
              const yearMatch = (info.publishedDate || '').match(/\d{4}/);
              if (!resolved.publishedYear && yearMatch) resolved.publishedYear = Number(yearMatch[0]);
              if ((!resolved.genre || resolved.genre === 'Literatura') && Array.isArray(info.categories) && info.categories[0]) {
                resolved.genre = info.categories[0];
              }
              if (!resolved.pageCount && info.pageCount) resolved.pageCount = Number(info.pageCount);
              if (!resolved.isbn && Array.isArray(info.industryIdentifiers)) {
                const isbn13 = info.industryIdentifiers.find(id => id.type === 'ISBN_13') || info.industryIdentifiers[0];
                if (isbn13) resolved.isbn = isbn13.identifier;
              }
              let thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
              if (thumb.startsWith('http://')) thumb = thumb.replace('http://', 'https://');
              if (thumb && !resolved.coverUrl) resolved.coverUrl = thumb;
              break;
            }
          }
        }
      } catch (e) {}

      // 3. Fallback OpenLibrary (com busca por título limpo + autor limpo)
      if (!resolved.coverUrl || !resolved.pageCount || resolved.author === 'Autor desconhecido') {
        try {
          const olQuery = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
          const olRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&limit=3`);
          if (olRes.ok) {
            const olData = await olRes.json();
            const docs = olData.docs || [];
            const bestDoc = docs.find(d => d.cover_i && d.number_of_pages_median) || docs.find(d => d.cover_i) || docs[0];
            if (bestDoc) {
              if (!resolved.author || resolved.author === 'Autor desconhecido') {
                resolved.author = (bestDoc.author_name && bestDoc.author_name.slice(0, 2).join(', ')) || resolved.author;
              }
              if (!resolved.publishedYear && bestDoc.first_publish_year) resolved.publishedYear = bestDoc.first_publish_year;
              if (!resolved.pageCount && bestDoc.number_of_pages_median) resolved.pageCount = bestDoc.number_of_pages_median;
              if (!resolved.isbn && Array.isArray(bestDoc.isbn) && bestDoc.isbn[0]) resolved.isbn = bestDoc.isbn[0];
              if (!resolved.coverUrl && bestDoc.cover_i) {
                resolved.coverUrl = `https://covers.openlibrary.org/b/id/${bestDoc.cover_i}-M.jpg`;
              }
            }
          }
        } catch (e) {}
      }

      // 4. Se encontrou ISBN mas ainda está sem capa, usa a capa direta por ISBN da OpenLibrary
      if (!resolved.coverUrl && resolved.isbn) {
        resolved.coverUrl = `https://covers.openlibrary.org/b/isbn/${resolved.isbn}-M.jpg`;
      }

      if (!resolved.pageCount || resolved.pageCount < 1) resolved.pageCount = 220;
      return resolved;
    }

    async function callGeminiChunk(linesChunk, apiKey) {
      const prompt = `Extraia e complete os metadados bibliográficos de cada livro abaixo (em português do Brasil).
Lista:
${linesChunk.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Retorne APENAS um array JSON com exatamente ${linesChunk.length} objetos na mesma ordem, contendo:
[{"title": "Título limpo da obra", "author": "Nome do autor", "publishedYear": 1995, "genre": "Gênero literário", "pageCount": 250, "isbn": "ISBN-13 apenas dígitos"}]`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) throw new Error('Gemini API indisponível');
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed) ? parsed : [];
    }

    async function processBatchBooksWithGemini() {
      const rawInput = document.getElementById('batch-raw-input').value || '';
      const lines = rawInput
        .split(/\r?\n/)
        .map(l => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
        .filter(l => l.length > 1);

      if (lines.length === 0) {
        showToast('Cole pelo menos 1 livro na caixa de texto.');
        return;
      }

      const btn = document.getElementById('btn-process-batch');
      const progressText = document.getElementById('batch-progress-text');
      const defaultStatus = document.getElementById('batch-default-status').value;
      const defaultFormat = document.getElementById('batch-default-format').value;
      const geminiKey = getActiveGeminiKey();

      btn.disabled = true;
      btn.innerHTML = `<span>⏳ Buscando ${lines.length} livros...</span>`;

      // 1. Pre-parse instantâneo de todas as linhas (extrai Título e Autor imediatamente mesmo em listas de 100+ livros)
      const preParsedList = lines.map(line => parseRawBookLine(line));

      // 2. Se houver chave Gemini ativa, processa em blocos de 25 livros para não estourar limite de tokens
      let geminiResults = new Array(lines.length).fill(null);
      if (geminiKey) {
        const CHUNK_SIZE = 25;
        for (let start = 0; start < lines.length; start += CHUNK_SIZE) {
          const chunkLines = lines.slice(start, start + CHUNK_SIZE);
          progressText.textContent = `Analisando lista (${Math.min(start + CHUNK_SIZE, lines.length)}/${lines.length})...`;
          try {
            const chunkParsed = await callGeminiChunk(chunkLines, geminiKey);
            for (let j = 0; j < chunkParsed.length; j++) {
              if (start + j < lines.length) {
                geminiResults[start + j] = chunkParsed[j];
              }
            }
          } catch (err) {
            // Se a chave não tiver a API Generative Language habilitada ou falhar, segue com o parser + catálogos
            break;
          }
        }
      }

      // 3. Enriquece capas, páginas e ISBN em pequenos lotes paralelos de 3 (com pausa curta para evitar bloqueio/rate-limit em 100+ livros)
      const results = new Array(lines.length);
      const CONCURRENCY = 3;
      for (let i = 0; i < lines.length; i += CONCURRENCY) {
        const sliceIndices = [];
        for (let k = i; k < Math.min(i + CONCURRENCY, lines.length); k++) {
          sliceIndices.push(k);
        }
        progressText.textContent = `Buscando capas e páginas (${Math.min(i + CONCURRENCY, lines.length)} de ${lines.length})...`;

        await Promise.all(sliceIndices.map(async (idx) => {
          const line = lines[idx];
          const localParsed = preParsedList[idx];
          const aiData = geminiResults[idx] || {};
          const seed = {
            title: aiData.title || localParsed.cleanTitle,
            author: aiData.author || localParsed.cleanAuthor,
            publishedYear: aiData.publishedYear || '',
            genre: aiData.genre || 'Literatura',
            pageCount: aiData.pageCount || 0,
            isbn: aiData.isbn || localParsed.isbn || ''
          };
          const enriched = await enrichSingleBookFromPublicAPIs(line, seed);
          results[idx] = {
            selected: true,
            title: enriched.title,
            author: enriched.author,
            publishedYear: enriched.publishedYear || '',
            genre: enriched.genre || 'Literatura',
            pageCount: enriched.pageCount || 220,
            isbn: enriched.isbn || '',
            coverUrl: enriched.coverUrl || '',
            status: defaultStatus,
            format: defaultFormat
          };
        }));

        // Renderiza parcialmente a tabela em tempo real para o usuário ver o progresso
        batchCandidates = results.filter(Boolean);
        renderBatchPreviewTable();

        if (i + CONCURRENCY < lines.length) {
          await new Promise(r => setTimeout(r, 180));
        }
      }

      batchCandidates = results.filter(Boolean);
      renderBatchPreviewTable();
      progressText.textContent = `✓ ${batchCandidates.length} livros prontos para adicionar.`;
      btn.disabled = false;
      btn.innerHTML = `<span>Buscar Dados da Lista</span>`;
    }

    function renderBatchPreviewTable() {
      const container = document.getElementById('batch-preview-container');
      const tbody = document.getElementById('batch-preview-tbody');
      const countEl = document.getElementById('batch-resolved-count');

      container.classList.remove('hidden');
      countEl.textContent = batchCandidates.filter(c => c.selected).length;

      tbody.innerHTML = batchCandidates.map((item, idx) => `
        <tr class="hover:bg-paper-200/40 dark:hover:bg-stone-800/40 transition-colors">
          <td class="py-2 px-3">
            <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="toggleBatchCandidate(${idx}, this.checked)" class="w-4 h-4 rounded text-burgundy-600" />
          </td>
          <td class="py-2 px-2">
            ${item.coverUrl
              ? `<img src="${escapeHtml(item.coverUrl)}" alt="Capa" class="w-8 h-12 object-cover rounded shadow-xs bg-paper-300" />`
              : `<div class="w-8 h-12 rounded bg-paper-300 dark:bg-stone-800 flex items-center justify-center text-[9px] font-mono text-paper-600">CAPA</div>`
            }
          </td>
          <td class="py-2 px-2">
            <input type="text" value="${escapeHtml(item.title)}" oninput="batchCandidates[${idx}].title = this.value" class="w-full min-w-[180px] px-2 py-1 rounded bg-paper-100 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 font-editorial font-bold text-xs text-paper-800 dark:text-paper-100" />
          </td>
          <td class="py-2 px-2">
            <input type="text" value="${escapeHtml(item.author)}" oninput="batchCandidates[${idx}].author = this.value" class="w-full min-w-[140px] px-2 py-1 rounded bg-paper-100 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 text-xs text-paper-700 dark:text-paper-300" />
          </td>
          <td class="py-2 px-2 font-mono text-[11px] text-paper-600 dark:text-paper-400">
            <div>${escapeHtml(item.isbn || '—')}</div>
            <div class="text-[10px] opacity-75">${item.publishedYear || '—'} • ${escapeHtml(item.genre)}</div>
          </td>
          <td class="py-2 px-2">
            <input type="number" min="1" value="${item.pageCount}" oninput="batchCandidates[${idx}].pageCount = Number(this.value) || 200" class="w-16 px-2 py-1 rounded bg-paper-100 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 font-mono text-xs text-paper-800 dark:text-paper-100" />
          </td>
          <td class="py-2 px-2">
            <select onchange="batchCandidates[${idx}].status = this.value" class="px-2 py-1 rounded bg-paper-100 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 text-xs text-paper-800 dark:text-paper-100">
              <option value="backlog" ${item.status === 'backlog' ? 'selected' : ''}>Quero Ler</option>
              <option value="completed" ${item.status === 'completed' ? 'selected' : ''}>Lido</option>
              <option value="reading" ${item.status === 'reading' ? 'selected' : ''}>Lendo</option>
            </select>
          </td>
        </tr>
      `).join('');
    }

    function toggleBatchCandidate(idx, checked) {
      if (batchCandidates[idx]) {
        batchCandidates[idx].selected = checked;
        document.getElementById('batch-resolved-count').textContent = batchCandidates.filter(c => c.selected).length;
      }
    }

    async function confirmSaveBatchBooks() {
      const selected = batchCandidates.filter(c => c.selected && c.title.trim());
      if (selected.length === 0) {
        showToast('Selecione pelo menos 1 livro da tabela para adicionar.');
        return;
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const booksToInsert = selected.map((item, idx) => {
        const isCompleted = item.status === 'completed';
        const isReading = item.status === 'reading';
        const pages = Math.max(1, Number(item.pageCount) || 220);
        return {
          title: item.title.trim(),
          author: (item.author || 'Autor desconhecido').trim(),
          publishedYear: Number(item.publishedYear) || null,
          genre: (item.genre || 'Literatura').trim(),
          isbn: item.isbn || '',
          pageCount: pages,
          status: item.status,
          format: item.format || 'kindle',
          rating: 0,
          startDate: (isCompleted || isReading) ? todayIso : '',
          finishDate: isCompleted ? todayIso : '',
          daysTaken: isCompleted ? 1 : null,
          pagesPerDay: isCompleted ? pages : null,
          coverUrl: item.coverUrl || '',
          createdAt: nowIso,
          updatedAt: new Date(Date.now() + idx).toISOString()
        };
      });

      if (!useMemoryFallback && db) {
        await db.books.bulkAdd(booksToInsert);
      } else {
        booksToInsert.forEach((b, i) => {
          b.id = Date.now() + i;
          memoryStore.books.push(b);
        });
      }

      closeBatchImportModal();
      document.getElementById('batch-raw-input').value = '';
      document.getElementById('batch-preview-container').classList.add('hidden');
      await refreshStateFromDB();
      await pushAllToFirestore(true);
      showToast(`🎉 ${booksToInsert.length} livros adicionados à estante!`);
    }
