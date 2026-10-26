// =========================================================================
    // 6. GOOGLE BOOKS API + MODAL DE CADASTRO / EDIÇÃO DE LIVRO
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
      const query = document.getElementById('api-search-query').value.trim();
      const resultsBox = document.getElementById('api-search-results');
      const btn = document.getElementById('btn-api-search');
      if (!query) {
        showToast('Digite o título, autor ou ISBN para buscar na API.');
        return;
      }

      btn.textContent = 'Buscando...';
      btn.disabled = true;
      resultsBox.classList.remove('hidden');
      resultsBox.innerHTML = `<div class="text-xs text-paper-600 dark:text-paper-400 p-2">Consultando Google Books API...</div>`;

      try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&printType=books`);
        const data = await res.json();
        const items = data.items || [];

        if (items.length === 0) {
          resultsBox.innerHTML = `<div class="text-xs text-paper-500 p-2">Nenhum resultado na API. Você pode preencher os campos manualmente abaixo.</div>`;
        } else {
          window._lastApiItems = items.map(item => {
            const info = item.volumeInfo || {};
            const yearMatch = (info.publishedDate || '').match(/\d{4}/);
            let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
            if (cover.startsWith('http://')) cover = cover.replace('http://', 'https://');
            return {
              title: info.title || 'Sem título',
              author: (info.authors && info.authors.join(', ')) || 'Autor desconhecido',
              publishedYear: yearMatch ? Number(yearMatch[0]) : '',
              genre: (info.categories && info.categories[0]) || 'Literatura',
              pageCount: info.pageCount || 250,
              coverUrl: cover
            };
          });

          resultsBox.innerHTML = window._lastApiItems.map((b, idx) => `
            <div class="flex items-center justify-between gap-3 p-2 rounded-lg bg-paper-50 dark:bg-stone-900 border border-paper-300 dark:border-stone-700">
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-paper-800 dark:text-paper-100 truncate">${escapeHtml(b.title)}</p>
                <p class="text-[11px] text-paper-600 dark:text-paper-400 truncate">${escapeHtml(b.author)} ${b.publishedYear ? `(${b.publishedYear})` : ''} • <span class="font-mono">${b.pageCount} págs</span></p>
              </div>
              <button type="button" onclick="applyApiBookResult(${idx})" class="px-2.5 py-1 rounded-md text-xs font-semibold bg-burgundy-600 text-white shrink-0">
                Preencher
              </button>
            </div>
          `).join('');
        }
      } catch (err) {
        resultsBox.innerHTML = `<div class="text-xs text-amber-700 dark:text-amber-400 p-2">Sem conexão com a API no momento (Modo Offline). Preencha os campos abaixo manualmente.</div>`;
      } finally {
        btn.textContent = 'Buscar na API';
        btn.disabled = false;
      }
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
      showToast('Metadados importados da Google Books API!');
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
      showToast(`"${title}" salvo na sua estante!`);
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
      showToast(`"${book.title}" removido do acervo.`);
    }
