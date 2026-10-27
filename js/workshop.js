// =========================================================================
    // 4. OFICINA DE RESENHA EM 3 ATOS & CADERNO DE NOTAS (WORKSHOP VIEW)
    // =========================================================================
    function openBookInWorkshop(bookId) {
      state.selectedBookId = bookId;
      switchMainView('workshop');
    }

    function selectBookForWorkshop(bookId) {
      state.selectedBookId = bookId;
      renderWorkshop();
    }

    function renderWorkshop() {
      const selectEl = document.getElementById('workshop-book-select');
      if (!selectEl) return;

      if (state.books.length === 0) {
        selectEl.innerHTML = `<option value="">Nenhum livro cadastrado</option>`;
        return;
      }

      selectEl.innerHTML = state.books.map(b => {
        const statusTag = b.status === 'completed' ? '✓ Lido' : (b.status === 'reading' ? '📖 Lendo' : '⏳ Quero Ler');
        return `<option value="${b.id}" ${b.id === state.selectedBookId ? 'selected' : ''}>${escapeHtml(b.title)} — ${escapeHtml(b.author)} (${statusTag})</option>`;
      }).join('');

      const book = state.books.find(b => b.id === state.selectedBookId) || state.books[0];
      state.selectedBookId = book.id;

      const headerEl = document.getElementById('workshop-book-header');
      const velText = book.daysTaken && book.pagesPerDay
        ? `${book.pageCount} páginas lidas em <strong>${book.daysTaken} dias</strong> (<strong class="text-burgundy-600 dark:text-amber-400">${book.pagesPerDay} págs/dia</strong>)`
        : `${book.pageCount} páginas • ${book.startDate ? 'Iniciado em ' + formatDateBR(book.startDate) : 'Datas não definidas'}`;

      headerEl.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            ${getBookInitialsCover(book)}
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-mono uppercase tracking-wider text-burgundy-600 dark:text-amber-400">${escapeHtml(book.genre || 'Literatura')}</span>
                <span>•</span>
                <span class="text-xs font-mono text-paper-500">${book.format === 'kindle' ? '📱 Lido no Kindle' : '📖 Livro Físico'}</span>
              </div>
              <h2 class="font-editorial text-lg sm:text-xl font-bold text-paper-800 dark:text-paper-100">${escapeHtml(book.title)}</h2>
              <p class="text-xs text-paper-600 dark:text-paper-400">${escapeHtml(book.author)} ${book.publishedYear ? `(${book.publishedYear})` : ''} — ${velText}</p>
            </div>
          </div>

          <!-- Interactive 5-Star (with Half-Star) Selector -->
          <div class="flex flex-col sm:items-end gap-1.5">
            <label for="workshop-quick-rating" class="text-[11px] font-medium text-paper-600 dark:text-paper-400">Avaliação da Obra (0.5 a 5.0 ★):</label>
            <div class="flex items-center gap-2">
              <select id="workshop-quick-rating" onchange="updateBookRatingFromWorkshop(Number(this.value))" class="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-paper-100 dark:bg-stone-800 border border-paper-300 dark:border-stone-700 text-amber-700 dark:text-amber-400">
                ${[0, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map(val => `
                  <option value="${val}" ${Number(book.rating || 0) === val ? 'selected' : ''}>
                    ${val === 0 ? 'Sem nota ainda' : `${val.toFixed(1)} ★`}
                  </option>
                `).join('')}
              </select>
              <button type="button" onclick="openEditBookModal(${book.id})" class="px-2.5 py-1.5 rounded-xl text-xs border border-paper-300 dark:border-stone-700 hover:bg-paper-200 dark:hover:bg-stone-800 text-paper-700 dark:text-paper-300">
                Datas / Ficha
              </button>
            </div>
          </div>
        </div>
      `;

      const review = state.reviews.find(r => r.bookId === book.id);
      document.getElementById('editor-act1').value = review?.act1Premise || '';
      document.getElementById('editor-act2').value = review?.act2Analysis || '';
      document.getElementById('editor-act3').value = review?.act3Verdict || '';
      document.getElementById('review-completed-checkbox').checked = Boolean(review?.isCompleted);

      updateLiveStyleLab();
      renderWorkshopNotesList();
    }

    async function updateBookRatingFromWorkshop(newRating) {
      const book = state.books.find(b => b.id === state.selectedBookId);
      if (!book) return;
      book.rating = newRating;
      book.updatedAt = new Date().toISOString();
      if (!useMemoryFallback && db) {
        await db.books.put(book);
      }
      renderShelf();
      await pushAllToFirestore(true);
      showToast(`Avaliação atualizada para ${newRating > 0 ? newRating.toFixed(1) + ' ★' : 'Sem nota'}`);
    }

    function handleReviewInput(immediate = false) {
      updateLiveStyleLab();
      const indicator = document.getElementById('workshop-autosave-indicator');
      if (indicator) indicator.textContent = 'Digitando...';

      if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
      if (immediate) {
        saveCurrentReviewNow();
      } else {
        state.autosaveTimer = setTimeout(() => {
          saveCurrentReviewNow(true);
        }, 550);
      }
    }

    function updateLiveStyleLab() {
      const act1 = document.getElementById('editor-act1')?.value || '';
      const act2 = document.getElementById('editor-act2')?.value || '';
      const act3 = document.getElementById('editor-act3')?.value || '';
      const metrics = analyzeReviewText(act1, act2, act3);

      document.getElementById('act1-word-badge').textContent = `${metrics.act1Words} palavras`;
      document.getElementById('act2-word-badge').textContent = `${metrics.act2Words} palavras`;
      document.getElementById('act3-word-badge').textContent = `${metrics.act3Words} palavras`;

      document.getElementById('lab-total-words').textContent = metrics.wordCount;
      document.getElementById('lab-lexical-richness').textContent = `${metrics.lexicalRichness}%`;
      document.getElementById('lab-words-per-sentence').textContent = metrics.wordsPerSentence;
      document.getElementById('lab-unique-words').textContent = `${metrics.uniqueWordsCount} termos`;

      const total = Math.max(1, metrics.wordCount);
      const p1 = Math.round((metrics.act1Words / total) * 100);
      const p2 = Math.round((metrics.act2Words / total) * 100);
      const p3 = Math.max(0, 100 - p1 - p2);

      document.getElementById('lab-act-distribution').textContent = `${p1}% / ${p2}% / ${p3}%`;
      document.getElementById('bar-act1').style.width = `${p1}%`;
      document.getElementById('bar-act2').style.width = `${p2}%`;
      document.getElementById('bar-act3').style.width = `${p3}%`;

      const repContainer = document.getElementById('lab-repetitions-list');
      if (metrics.repetitions.length === 0) {
        repContainer.innerHTML = `<span class="text-[11px] text-emerald-700 dark:text-emerald-400">✓ Vocabulário variado (nenhuma palavra repetida 3+ vezes).</span>`;
      } else {
        repContainer.innerHTML = metrics.repetitions.map(([word, count]) => `
          <span class="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-300 font-mono text-[11px] border border-amber-500/30">
            "${escapeHtml(word)}" (${count}x)
          </span>
        `).join('');
      }
    }

    async function saveCurrentReviewNow(silent = false) {
      if (!state.selectedBookId) return;
      const act1 = document.getElementById('editor-act1').value;
      const act2 = document.getElementById('editor-act2').value;
      const act3 = document.getElementById('editor-act3').value;
      const isCompleted = document.getElementById('review-completed-checkbox').checked;
      const metrics = analyzeReviewText(act1, act2, act3);

      let existing = state.reviews.find(r => r.bookId === state.selectedBookId);
      const nowIso = new Date().toISOString();

      const reviewObj = {
        ...(existing ? { id: existing.id } : {}),
        bookId: state.selectedBookId,
        act1Premise: act1,
        act2Analysis: act2,
        act3Verdict: act3,
        wordCount: metrics.wordCount,
        uniqueWordsCount: metrics.uniqueWordsCount,
        lexicalRichness: metrics.lexicalRichness,
        isCompleted,
        updatedAt: nowIso
      };

      if (!useMemoryFallback && db) {
        const id = await db.reviews.put(reviewObj);
        reviewObj.id = id;
        state.reviews = await db.reviews.toArray();
      } else {
        if (existing) {
          Object.assign(existing, reviewObj);
        } else {
          reviewObj.id = Date.now();
          memoryStore.reviews.push(reviewObj);
        }
        state.reviews = [...memoryStore.reviews];
      }

      const indicator = document.getElementById('workshop-autosave-indicator');
      if (indicator) {
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        indicator.textContent = `✓ Salvo às ${timeStr}`;
      }
      renderShelf();
      await pushAllToFirestore(true);
      if (!silent) {
        showToast('Resenha salva localmente e sincronizada na nuvem!');
      }
    }

    function toggleFocusMode() {
      state.focusMode = !state.focusMode;
      const header = document.getElementById('main-header');
      const bookHeader = document.getElementById('workshop-book-header');
      const label = document.getElementById('focus-mode-label');

      if (state.focusMode) {
        header.classList.add('hidden');
        bookHeader.classList.add('hidden');
        label.textContent = 'Sair do Modo Foco';
        showToast('Modo Foco ativado: concentre-se nos 3 atos da escrita.');
      } else {
        header.classList.remove('hidden');
        bookHeader.classList.remove('hidden');
        label.textContent = 'Modo Foco';
      }
    }

// =========================================================================
    // 5. CADERNO DE NOTAS E CITAÇÕES (READING NOTES)
    // =========================================================================
    function renderWorkshopNotesList() {
      const listEl = document.getElementById('workshop-notes-list');
      const countEl = document.getElementById('workshop-notes-count');
      const bookNotes = state.notes
        .filter(n => n.bookId === state.selectedBookId)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      countEl.textContent = bookNotes.length;

      if (bookNotes.length === 0) {
        listEl.innerHTML = `
          <div class="p-4 rounded-xl border border-dashed border-paper-300 dark:border-stone-800 text-center text-xs text-paper-500">
            Nenhuma nota ou citação registrada para este livro ainda. Anote passagens marcantes enquanto lê no Kindle ou no papel!
          </div>
        `;
        return;
      }

      listEl.innerHTML = bookNotes.map(note => `
        <div class="p-3 rounded-xl bg-paper-100/90 dark:bg-stone-800/80 border border-paper-300/80 dark:border-stone-700 space-y-1.5 group">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-semibold ${note.type === 'quote' ? 'text-burgundy-600 dark:text-amber-400' : 'text-paper-700 dark:text-paper-300'}">
              ${note.type === 'quote' ? '❝ Citação' : '💡 Reflexão'} ${note.reference ? `• <span class="font-mono">${escapeHtml(note.reference)}</span>` : ''}
            </span>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="insertNoteIntoEditor(${note.id})" title="Inserir no Ato 2 (Análise)" class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-paper-200 dark:bg-stone-700 text-paper-700 dark:text-paper-200 hover:bg-burgundy-600 hover:text-white transition-colors">
                + Usar na Análise
              </button>
              <button type="button" onclick="deleteNote(${note.id})" title="Excluir nota" class="text-paper-400 hover:text-red-600">
                ×
              </button>
            </div>
          </div>
          <p class="${note.type === 'quote' ? 'font-editorial italic' : ''} text-xs text-paper-800 dark:text-paper-100 leading-relaxed">
            ${escapeHtml(note.content)}
          </p>
        </div>
      `).join('');
    }

    async function handleAddNoteFromWorkshop(event) {
      event.preventDefault();
      if (!state.selectedBookId) return;
      const type = document.getElementById('workshop-note-type').value;
      const reference = document.getElementById('workshop-note-ref').value.trim();
      const content = document.getElementById('workshop-note-content').value.trim();
      if (!content) return;

      const newNote = {
        bookId: state.selectedBookId,
        type,
        reference,
        content,
        createdAt: new Date().toISOString()
      };

      if (!useMemoryFallback && db) {
        await db.notes.add(newNote);
      } else {
        newNote.id = Date.now();
        memoryStore.notes.push(newNote);
      }

      document.getElementById('workshop-note-ref').value = '';
      document.getElementById('workshop-note-content').value = '';
      await refreshStateFromDB();
      await pushAllToFirestore(true);
      showToast('Nota adicionada e sincronizada!');
    }

    function insertNoteIntoEditor(noteId) {
      const note = state.notes.find(n => n.id === noteId);
      if (!note) return;
      const act2El = document.getElementById('editor-act2');
      const formatted = note.type === 'quote'
        ? `\n\n"${note.content}" (${note.reference || 'Trecho da obra'})`
        : `\n\n${note.content}`;
      act2El.value = (act2El.value + formatted).trim();
      handleReviewInput(true);
      showToast('Trecho incorporado ao Ato 2 (Análise)!');
    }

    async function deleteNote(noteId) {
      if (!useMemoryFallback && db) {
        await db.notes.delete(noteId);
      } else {
        memoryStore.notes = memoryStore.notes.filter(n => n.id !== noteId);
      }
      await refreshStateFromDB();
      await pushAllToFirestore(true);
      showToast('Nota removida.');
    }
