// =========================================================================
    // 2. NAVIGATION & THEME
    // =========================================================================
    function switchMainView(viewName) {
      state.currentView = viewName;
      const views = ['shelf', 'workshop', 'analytics'];
      views.forEach(v => {
        const sec = document.getElementById('view-' + v);
        const btn = document.getElementById('nav-btn-' + v);
        if (sec) sec.classList.toggle('hidden', v !== viewName);
        if (btn) {
          if (v === viewName) {
            btn.className = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 bg-paper-50 dark:bg-stone-900 text-burgundy-600 dark:text-amber-400 shadow-sm';
          } else {
            btn.className = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 text-paper-600 dark:text-paper-400 hover:text-paper-800 dark:hover:text-paper-100';
          }
        }
      });
      if (viewName === 'workshop') {
        renderWorkshop();
      } else if (viewName === 'analytics') {
        renderAnalytics();
      }
    }

    function toggleTheme() {
      const htmlEl = document.documentElement;
      const isDark = htmlEl.classList.toggle('dark');
      try {
        localStorage.setItem('codex_theme', isDark ? 'dark' : 'light');
      } catch (e) {}
      document.getElementById('theme-icon-moon').classList.toggle('hidden', isDark);
      document.getElementById('theme-icon-sun').classList.toggle('hidden', !isDark);
      if (state.currentView === 'analytics') {
        renderAnalytics();
      }
    }

    function loadSavedTheme() {
      try {
        const saved = localStorage.getItem('codex_theme');
        if (saved === 'dark') {
          document.documentElement.classList.add('dark');
          document.getElementById('theme-icon-moon').classList.add('hidden');
          document.getElementById('theme-icon-sun').classList.remove('hidden');
        }
      } catch (e) {}
    }

// =========================================================================
    // 3. ESTANTE DE STATUS (SHELF VIEW)
    // =========================================================================
    function setShelfFilter(filter) {
      state.shelfFilter = filter;
      const tabs = ['all', 'reading', 'backlog', 'completed'];
      tabs.forEach(t => {
        const el = document.getElementById('shelf-tab-' + t);
        if (!el) return;
        if (t === filter) {
          el.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-paper-800 text-paper-50 dark:bg-paper-100 dark:text-paper-900';
        } else {
          el.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-paper-200 dark:bg-stone-800 text-paper-700 dark:text-paper-300 hover:bg-paper-300';
        }
      });
      renderShelf();
    }

    function renderStarRating(rating) {
      const r = Number(rating) || 0;
      if (r <= 0) return '<span class="text-[11px] text-paper-500 italic">Sem avaliação</span>';
      const fullStars = Math.floor(r);
      const hasHalf = (r - fullStars) >= 0.5;
      let starsHtml = '';
      for (let i = 0; i < fullStars; i++) starsHtml += '★';
      if (hasHalf) starsHtml += '½';
      return `<span class="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400" title="${r.toFixed(1)} de 5 estrelas">${starsHtml} <span class="text-[11px] text-paper-600 dark:text-paper-400">(${r.toFixed(1)})</span></span>`;
    }

    function getBookInitialsCover(book) {
      if (book.coverUrl && book.coverUrl.startsWith('http')) {
        return `<img src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}" class="w-16 h-24 sm:w-20 sm:h-28 object-cover rounded-lg book-spine-shadow shrink-0 bg-paper-300" />`;
      }
      const palettes = [
        'from-amber-900 to-stone-900 text-amber-100',
        'from-red-950 to-stone-900 text-red-100',
        'from-emerald-950 to-stone-900 text-emerald-100',
        'from-slate-900 to-stone-950 text-slate-100'
      ];
      const palette = palettes[(book.id || 0) % palettes.length];
      return `
        <div class="w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-gradient-to-br ${palette} p-2 flex flex-col justify-between book-spine-shadow shrink-0 border-l-4 border-amber-500/40 select-none">
          <span class="text-[9px] uppercase tracking-widest opacity-75 line-clamp-1">${escapeHtml(book.author || 'Codex')}</span>
          <span class="font-editorial text-[11px] font-bold leading-tight line-clamp-3">${escapeHtml(book.title)}</span>
          <span class="font-mono text-[9px] opacity-70">${book.pageCount || 0}p</span>
        </div>
      `;
    }

    function renderShelf() {
      const allCount = state.books.length;
      const readingCount = state.books.filter(b => b.status === 'reading').length;
      const backlogCount = state.books.filter(b => b.status === 'backlog').length;
      const completedBooks = state.books.filter(b => b.status === 'completed');
      const completedCount = completedBooks.length;

      document.getElementById('count-all').textContent = allCount;
      document.getElementById('count-reading').textContent = readingCount;
      document.getElementById('count-backlog').textContent = backlogCount;
      document.getElementById('count-completed').textContent = completedCount;

      // Update Top Shelf KPIs
      const totalPagesRead = completedBooks.reduce((acc, b) => acc + (Number(b.pageCount) || 0), 0);
      const totalDaysRead = completedBooks.reduce((acc, b) => acc + (Number(b.daysTaken) || 1), 0);
      const avgSpeed = completedCount > 0 ? (totalPagesRead / Math.max(1, totalDaysRead)).toFixed(1) : '0';
      const completedReviewsCount = state.reviews.filter(r => r.wordCount > 10).length;

      document.getElementById('kpi-shelf-completed').textContent = completedCount;
      document.getElementById('kpi-shelf-pages').textContent = totalPagesRead.toLocaleString('pt-BR');
      document.getElementById('kpi-shelf-speed').textContent = `${avgSpeed} p/d`;
      document.getElementById('kpi-shelf-reviews').textContent = completedReviewsCount;

      const query = (document.getElementById('shelf-search-input')?.value || '').toLowerCase().trim();
      const formatFilter = document.getElementById('shelf-format-filter')?.value || 'all';

      const filtered = state.books.filter(book => {
        if (state.shelfFilter !== 'all' && book.status !== state.shelfFilter) return false;
        if (formatFilter !== 'all' && book.format !== formatFilter) return false;
        if (query) {
          const hay = `${book.title} ${book.author} ${book.genre || ''}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      const container = document.getElementById('shelf-books-container');
      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="col-span-full rounded-2xl border border-dashed border-paper-400 dark:border-stone-700 p-10 text-center space-y-3">
            <p class="font-editorial text-lg text-paper-700 dark:text-paper-300">Nenhum livro encontrado neste filtro da estante.</p>
            <button type="button" onclick="openAddBookModal()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-burgundy-600 text-white">
              + Catalogar Novo Livro
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(book => {
        const notesCount = state.notes.filter(n => n.bookId === book.id).length;
        const review = state.reviews.find(r => r.bookId === book.id);
        const hasReview = review && review.wordCount > 0;

        let statusBadge = '';
        if (book.status === 'reading') {
          statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">Lendo Agora</span>`;
        } else if (book.status === 'completed') {
          statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-600/30">Lido</span>`;
        } else {
          statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-paper-300/80 dark:bg-stone-800 text-paper-700 dark:text-paper-300">Quero Ler</span>`;
        }

        const formatBadge = book.format === 'kindle'
          ? `<span class="text-[11px] font-mono text-paper-600 dark:text-paper-400">📱 Kindle</span>`
          : `<span class="text-[11px] font-mono text-paper-600 dark:text-paper-400">📖 Físico</span>`;

        let velocityLine = '';
        if (book.status === 'completed' && book.daysTaken && book.pagesPerDay) {
          velocityLine = `
            <div class="mt-2 pt-2 border-t border-paper-300/70 dark:border-stone-800 flex items-center justify-between text-xs">
              <span class="text-paper-600 dark:text-paper-400">Ritmo: <strong class="font-mono text-paper-800 dark:text-paper-200">${book.daysTaken} dias</strong></span>
              <span class="font-mono font-semibold text-burgundy-600 dark:text-amber-400">${book.pagesPerDay} págs/dia</span>
            </div>
          `;
        } else if (book.status === 'reading' && book.startDate) {
          const todayIso = new Date().toISOString().slice(0, 10);
          const elapsed = calculateReadingVelocity(book.pageCount, book.startDate, todayIso);
          velocityLine = `
            <div class="mt-2 pt-2 border-t border-paper-300/70 dark:border-stone-800 flex items-center justify-between text-xs">
              <span class="text-paper-600 dark:text-paper-400">Iniciado em <span class="font-mono">${formatDateBR(book.startDate)}</span></span>
              <span class="font-mono text-amber-700 dark:text-amber-400">${elapsed.daysTaken || 1}º dia de leitura</span>
            </div>
          `;
        }

        return `
          <article class="rounded-2xl bg-paper-50 dark:bg-stone-900 border border-paper-300 dark:border-stone-800 p-4 sm:p-5 flex flex-col justify-between gap-4 hover:border-burgundy-600/50 dark:hover:border-amber-500/50 transition-all shadow-xs">
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                ${statusBadge}
                <div class="flex items-center gap-2">
                  ${formatBadge}
                  <button type="button" onclick="openEditBookModal(${book.id})" title="Editar ficha técnica ou datas" class="p-1 rounded hover:bg-paper-200 dark:hover:bg-stone-800 text-paper-500">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </button>
                  <button type="button" onclick="deleteBook(${book.id})" title="Remover livro" class="p-1 rounded hover:bg-red-500/10 text-paper-400 hover:text-red-600">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>

              <div class="flex gap-3.5">
                ${getBookInitialsCover(book)}
                <div class="flex-1 min-w-0 space-y-1">
                  <h3 class="font-editorial font-bold text-base sm:text-lg text-paper-800 dark:text-paper-100 leading-snug line-clamp-2">${escapeHtml(book.title)}</h3>
                  <p class="text-xs font-medium text-paper-600 dark:text-paper-400">${escapeHtml(book.author)} ${book.publishedYear ? `• <span class="font-mono">${book.publishedYear}</span>` : ''}</p>
                  <p class="text-[11px] text-paper-500">${escapeHtml(book.genre || 'Literatura')} • <span class="font-mono font-semibold text-paper-700 dark:text-paper-300">${book.pageCount} págs</span></p>
                  <div class="pt-1">
                    ${renderStarRating(book.rating)}
                  </div>
                </div>
              </div>

              ${velocityLine}
            </div>

            <!-- Action Footer -->
            <div class="pt-3 border-t border-paper-300/70 dark:border-stone-800 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-[11px] font-mono text-paper-600 dark:text-paper-400">
                <span>🗒️ ${notesCount} nota${notesCount === 1 ? '' : 's'}</span>
                <span>•</span>
                <span>✍️ ${hasReview ? `${review.wordCount} pal.` : 'Sem resenha'}</span>
              </div>

              <div class="flex items-center gap-1.5">
                ${book.status === 'backlog' ? `
                  <button type="button" onclick="quickTransitionStatus(${book.id}, 'reading')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors">
                    Iniciar Leitura
                  </button>
                ` : ''}
                ${book.status === 'reading' ? `
                  <button type="button" onclick="openBookInWorkshop(${book.id})" class="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-paper-300 dark:border-stone-700 bg-paper-100 dark:bg-stone-800 text-paper-800 dark:text-paper-200 hover:bg-paper-200">
                    + Notas
                  </button>
                  <button type="button" onclick="quickTransitionStatus(${book.id}, 'completed')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors">
                    Concluir Livro
                  </button>
                ` : ''}
                ${book.status === 'completed' ? `
                  <button type="button" onclick="openBookInWorkshop(${book.id})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burgundy-600 hover:bg-burgundy-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white transition-colors">
                    ${hasReview ? 'Abrir Resenha (3 Atos)' : 'Escrever Resenha'}
                  </button>
                ` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    async function quickTransitionStatus(bookId, newStatus) {
      const book = state.books.find(b => b.id === bookId);
      if (!book) return;
      const todayIso = new Date().toISOString().slice(0, 10);
      book.status = newStatus;
      if (newStatus === 'reading' && !book.startDate) {
        book.startDate = todayIso;
      }
      if (newStatus === 'completed') {
        if (!book.startDate) book.startDate = todayIso;
        if (!book.finishDate) book.finishDate = todayIso;
        const vel = calculateReadingVelocity(book.pageCount, book.startDate, book.finishDate);
        book.daysTaken = vel.daysTaken;
        book.pagesPerDay = vel.pagesPerDay;
      }
      book.updatedAt = new Date().toISOString();

      if (!useMemoryFallback && db) {
        await db.books.put(book);
      }
      await refreshStateFromDB();

      if (newStatus === 'completed') {
        showToast(`"${book.title}" concluído! Ritmo: ${book.pagesPerDay} págs/dia em ${book.daysTaken} dias.`);
        openBookInWorkshop(bookId);
      } else {
        showToast(`Leitura de "${book.title}" iniciada em ${formatDateBR(book.startDate)}!`);
      }
    }
