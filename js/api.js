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
