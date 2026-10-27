// =========================================================================
    // 6. MULTI-ENGINE BOOK SEARCH (BRASILAPI ISBN + GOOGLE BOOKS + OPENLIBRARY)
    // =========================================================================
    function handleSkipDatesToggle() {
      const skipCheckbox = document.getElementById('book-skip-dates-input');
      const startInput = document.getElementById('book-start-input');
      const finishInput = document.getElementById('book-finish-input');
      const wrap = document.getElementById('book-dates-inputs-wrap');
      const isSkipped = Boolean(skipCheckbox && skipCheckbox.checked);

      if (startInput && finishInput) {
        startInput.disabled = isSkipped;
        finishInput.disabled = isSkipped;
        if (isSkipped) {
          startInput.value = '';
          finishInput.value = '';
        }
      }
      if (wrap) {
        wrap.classList.toggle('opacity-40', isSkipped);
        wrap.classList.toggle('pointer-events-none', isSkipped);
      }
    }

    function openAddBookModal() {
      document.getElementById('modal-book-title-heading').textContent = 'Catalogar Nova Obra no Acervo';
      document.getElementById('book-id-input').value = '';
      document.getElementById('form-book').reset();
      document.getElementById('book-status-input').value = 'reading';
      const skipCheckbox = document.getElementById('book-skip-dates-input');
      if (skipCheckbox) skipCheckbox.checked = false;
      handleSkipDatesToggle();
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
      const skipCheckbox = document.getElementById('book-skip-dates-input');
      const isSkipped = Boolean(book.excludeFromSpeedCalc || (book.status === 'completed' && !book.startDate && !book.finishDate && !book.daysTaken));
      if (skipCheckbox) skipCheckbox.checked = isSkipped;
      handleSkipDatesToggle();
      if (!isSkipped) {
        document.getElementById('book-start-input').value = book.startDate || '';
        document.getElementById('book-finish-input').value = book.finishDate || '';
      }
      document.getElementById('book-cover-input').value = book.coverUrl || '';
      document.getElementById('api-search-results').classList.add('hidden');
      document.getElementById('modal-add-book').classList.remove('hidden');
    }

    function closeAddBookModal() {
      document.getElementById('modal-add-book').classList.add('hidden');
    }

    function handleModalStatusChange() {
      const status = document.getElementById('book-status-input').value;
      const skipCheckbox = document.getElementById('book-skip-dates-input');
      if (skipCheckbox && skipCheckbox.checked) return;
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

    // Helper que busca contagem real de páginas via BrasilAPI (CBL), OpenLibrary Data API ou Edições da Obra
    async function resolveRealPageCountAndMeta(candidate) {
      if (candidate.pageCount && candidate.pageCount > 15) return candidate;

      // 1. Tenta ISBN brasileiro (97885 / 97865) na BrasilAPI (CBL)
      const isbns = Array.isArray(candidate.isbnList) ? candidate.isbnList : (candidate.isbn ? [candidate.isbn] : []);
      const brIsbn = isbns.find(i => /^(97885|97865)\d{8}$/.test(i)) || isbns.find(i => /^\d{10,13}$/.test(i));
      if (brIsbn) {
        try {
          const brRes = await fetch(`https://brasilapi.com.br/api/isbn/v1/${brIsbn}`);
          if (brRes.ok) {
            const brData = await brRes.json();
            if (brData) {
              if (brData.page_count && Number(brData.page_count) > 15) {
                candidate.pageCount = Number(brData.page_count);
              }
              if (!candidate.coverUrl && brData.cover_url) {
                candidate.coverUrl = brData.cover_url;
              }
              if (!candidate.isbn) candidate.isbn = brIsbn;
              if (candidate.pageCount > 15) return candidate;
            }
          }
        } catch (e) {}

        // 2. Tenta OpenLibrary Books Data API por ISBN
        try {
          const olBookRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${brIsbn}&jscmd=data&format=json`);
          if (olBookRes.ok) {
            const olBookData = await olBookRes.json();
            const entry = olBookData[`ISBN:${brIsbn}`];
            if (entry) {
              if (entry.number_of_pages && Number(entry.number_of_pages) > 15) {
                candidate.pageCount = Number(entry.number_of_pages);
              }
              if (!candidate.coverUrl && entry.cover && (entry.cover.medium || entry.cover.small)) {
                candidate.coverUrl = entry.cover.medium || entry.cover.small;
              }
              if (candidate.pageCount > 15) return candidate;
            }
          }
        } catch (e) {}
      }

      // 3. Se tiver Work Key da OpenLibrary (/works/OL...W), busca nas edições da obra
      if (candidate.olWorkKey) {
        try {
          const edRes = await fetch(`https://openlibrary.org${candidate.olWorkKey}/editions.json?limit=25`);
          if (edRes.ok) {
            const edData = await edRes.json();
            const entries = edData.entries || [];
            // Prioriza edição em português (por / pt) com número de páginas válido
            const ptEdition = entries.find(e => e.number_of_pages > 15 && Array.isArray(e.isbn_13) && e.isbn_13.some(x => /^(97885|97865)/.test(x)));
            if (ptEdition) {
              candidate.pageCount = Number(ptEdition.number_of_pages);
              if (!candidate.isbn && ptEdition.isbn_13?.[0]) candidate.isbn = ptEdition.isbn_13[0];
              return candidate;
            }
            const validPages = entries
              .map(e => Number(e.number_of_pages) || 0)
              .filter(p => p > 15 && p < 3500)
              .sort((a, b) => a - b);
            if (validPages.length > 0) {
              candidate.pageCount = validPages[Math.floor(validPages.length / 2)];
              return candidate;
            }
          }
        } catch (e) {}
      }

      return candidate;
    }

    async function searchBooksAPI() {
      const rawQuery = document.getElementById("api-search-query").value.trim();
      const resultsBox = document.getElementById("api-search-results");
      const btn = document.getElementById("btn-api-search");
      if (!rawQuery) {
        showToast("Digite o título, autor ou ISBN para buscar.");
        return;
      }

      btn.textContent = "Buscando...";
      btn.disabled = true;
      resultsBox.classList.remove("hidden");
      resultsBox.innerHTML = `<div class="text-xs text-paper-600 dark:text-paper-400 p-2">Buscando capas e contagem exata de páginas...</div>`;

      const parsedQuery = parseRawBookLine(rawQuery);
      const searchCleanQuery = parsedQuery.cleanAuthor
        ? `${parsedQuery.cleanTitle} ${parsedQuery.cleanAuthor}`
        : parsedQuery.cleanTitle || rawQuery;

      const cleanedDigits = rawQuery.replace(/[-\s]/g, "");
      const isIsbn = /^(978|979)?\d{9}[\dXx]$/.test(cleanedDigits);
      const combinedResults = [];

      // 1. Se for ISBN, consulta BrasilAPI ISBN (CBL)
      if (isIsbn) {
        try {
          const brRes = await fetch(`https://brasilapi.com.br/api/isbn/v1/${cleanedDigits}`);
          if (brRes.ok) {
            const brData = await brRes.json();
            if (brData && brData.title) {
              combinedResults.push({
                source: "CBL / ISBN",
                title: brData.subtitle ? `${brData.title}: ${brData.subtitle}` : brData.title,
                author: Array.isArray(brData.authors) && brData.authors.length ? brData.authors.join(", ") : "Autor não informado",
                publishedYear: brData.year ? Number(brData.year) : "",
                genre: Array.isArray(brData.subjects) && brData.subjects[0] ? brData.subjects[0] : "Literatura",
                pageCount: Number(brData.page_count) || 0,
                isbn: cleanedDigits,
                isbnList: [cleanedDigits],
                coverUrl: brData.cover_url || `https://covers.openlibrary.org/b/isbn/${cleanedDigits}-M.jpg`
              });
            }
          }
        } catch (e) {}
      }

      // 2. Consulta Google Books API (com busca ampla de edições para capturar pageCount real)
      try {
        const queriesToTry = isIsbn
          ? [`isbn:${cleanedDigits}`, cleanedDigits]
          : [searchCleanQuery];

        for (const qStr of queriesToTry) {
          const gUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(qStr)}&maxResults=12&printType=books`;
          const gRes = await fetch(gUrl);
          if (gRes.ok) {
            const gData = await gRes.json();
            const items = gData.items || [];
            items.forEach(item => {
              const info = item.volumeInfo || {};
              if (!info.title) return;
              const yearMatch = (info.publishedDate || "").match(/\d{4}/);
              let cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
              if (cover.startsWith("http://")) cover = cover.replace("http://", "https://");
              const ids = Array.isArray(info.industryIdentifiers)
                ? info.industryIdentifiers.map(x => String(x.identifier || "").replace(/[-\s]/g, ""))
                : [];
              const bestIsbn = ids.find(x => /^(97885|97865)/.test(x)) || ids.find(x => /^97[89]\d{10}$/.test(x)) || ids[0] || "";
              combinedResults.push({
                source: "Google Books",
                title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
                author: (info.authors && info.authors.join(", ")) || "Autor desconhecido",
                publishedYear: yearMatch ? Number(yearMatch[0]) : "",
                genre: (info.categories && info.categories[0]) || "Literatura",
                pageCount: (info.pageCount && Number(info.pageCount) > 15) ? Number(info.pageCount) : 0,
                isbn: bestIsbn,
                isbnList: ids,
                coverUrl: cover
              });
            });
            if (combinedResults.some(r => r.pageCount > 15)) break;
          }
        }
      } catch (e) {}

      // 3. Consulta OpenLibrary Search API (COM fields explícitos para retornar number_of_pages_median e isbn!)
      try {
        const olFields = "key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,subject";
        const olUrl = isIsbn
          ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(cleanedDigits)}&fields=${olFields}&limit=8`
          : `https://openlibrary.org/search.json?q=${encodeURIComponent(searchCleanQuery)}&fields=${olFields}&limit=8`;
        const olRes = await fetch(olUrl);
        if (olRes.ok) {
          const olData = await olRes.json();
          const docs = olData.docs || [];
          docs.forEach(doc => {
            if (!doc.title) return;
            const isbns = Array.isArray(doc.isbn) ? doc.isbn : [];
            const bestIsbn = isbns.find(x => /^(97885|97865)/.test(x)) || isbns.find(x => /^97[89]\d{10}$/.test(x)) || isbns[0] || (isIsbn ? cleanedDigits : "");
            const cover = doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : (bestIsbn ? `https://covers.openlibrary.org/b/isbn/${bestIsbn}-M.jpg` : "");
            combinedResults.push({
              source: "OpenLibrary",
              title: doc.title,
              author: (doc.author_name && doc.author_name.slice(0, 2).join(", ")) || "Autor desconhecido",
              publishedYear: doc.first_publish_year || "",
              genre: (doc.subject && doc.subject[0]) || "Literatura",
              pageCount: (doc.number_of_pages_median && Number(doc.number_of_pages_median) > 15) ? Number(doc.number_of_pages_median) : 0,
              isbn: bestIsbn,
              isbnList: isbns,
              olWorkKey: doc.key || "",
              coverUrl: cover
            });
          });
        }
      } catch (e) {}

      // 4. Agrupa e mescla edições do mesmo livro (para que uma edição sem pageCount herde o pageCount real de outra edição!)
      const mergedMap = new Map();
      for (const item of combinedResults) {
        const normTitle = item.title.toLowerCase().replace(/[^a-z0-9à-ú]/g, "").slice(0, 28);
        const normAuthor = item.author.toLowerCase().replace(/[^a-z0-9à-ú]/g, "").slice(0, 14);
        const key = `${normTitle}|${normAuthor}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, { ...item });
        } else {
          const existing = mergedMap.get(key);
          if ((!existing.pageCount || existing.pageCount <= 15) && item.pageCount > 15) {
            existing.pageCount = item.pageCount;
          }
          if (!existing.coverUrl && item.coverUrl) {
            existing.coverUrl = item.coverUrl;
          }
          if (!existing.isbn && item.isbn) {
            existing.isbn = item.isbn;
          }
          if (!existing.olWorkKey && item.olWorkKey) {
            existing.olWorkKey = item.olWorkKey;
          }
          if (Array.isArray(item.isbnList) && item.isbnList.length) {
            existing.isbnList = Array.from(new Set([...(existing.isbnList || []), ...item.isbnList]));
          }
        }
      }

      let uniqueResults = Array.from(mergedMap.values()).slice(0, 6);

      // 5. Se algum dos resultados principais ainda estiver com pageCount === 0, busca nas edições/CBL em paralelo
      await Promise.all(uniqueResults.slice(0, 4).map(async (item) => {
        if (!item.pageCount || item.pageCount <= 15) {
          await resolveRealPageCountAndMeta(item);
        }
      }));

      // 6. Se houver outra edição do mesmo autor na lista que já tem pageCount válido (ex: título traduzido vs original), propaga como referência
      const knownPagesInSearch = uniqueResults.find(r => r.pageCount > 15)?.pageCount || 0;
      uniqueResults.forEach(item => {
        if ((!item.pageCount || item.pageCount <= 15) && knownPagesInSearch > 15) {
          item.pageCount = knownPagesInSearch;
        }
      });

      // Ordena priorizando resultados que têm contagem de páginas real e capa
      uniqueResults.sort((a, b) => {
        const scoreA = (a.pageCount > 15 ? 2 : 0) + (a.coverUrl ? 1 : 0);
        const scoreB = (b.pageCount > 15 ? 2 : 0) + (b.coverUrl ? 1 : 0);
        return scoreB - scoreA;
      });

      window._lastApiItems = uniqueResults;

      if (uniqueResults.length === 0) {
        resultsBox.innerHTML = `
          <div class="text-xs text-paper-600 dark:text-paper-400 p-2.5 rounded-lg bg-paper-50 dark:bg-stone-900 border border-paper-300 dark:border-stone-700">
            Nenhum resultado encontrado. Você pode preencher os campos abaixo manualmente.
          </div>
        `;
      } else {
        resultsBox.innerHTML = uniqueResults.map((b, idx) => `
          <div class="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-paper-50 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 hover:border-burgundy-600/50 transition-colors">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              ${b.coverUrl
                ? `<img src="${escapeHtml(b.coverUrl)}" alt="" class="w-8 h-11 object-cover rounded shadow-xs shrink-0 bg-paper-200" />`
                : `<div class="w-8 h-11 rounded bg-paper-200 dark:bg-stone-800 flex items-center justify-center text-[9px] font-mono text-paper-500 shrink-0">CAPA</div>`
              }
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold text-paper-800 dark:text-paper-100 truncate">${escapeHtml(b.title)}</p>
                <p class="text-[11px] text-paper-600 dark:text-paper-400 truncate mt-0.5">
                  ${escapeHtml(b.author)} ${b.publishedYear ? `(${b.publishedYear})` : ""} •
                  <span class="font-mono font-semibold text-burgundy-600 dark:text-amber-400">${b.pageCount > 15 ? `${b.pageCount} págs` : "Págs a verificar"}</span>
                </p>
              </div>
            </div>
            <button type="button" onclick="applyApiBookResult(${idx})" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-burgundy-600 hover:bg-burgundy-700 dark:bg-amber-600 text-white shrink-0">
              Usar Dados
            </button>
          </div>
        `).join("");
      }

      btn.textContent = "Buscar Capa e Dados";
      btn.disabled = false;
    }

    async function applyApiBookResult(index) {
      const b = window._lastApiItems?.[index];
      if (!b) return;
      if (!b.pageCount || b.pageCount <= 15) {
        await resolveRealPageCountAndMeta(b);
      }
      document.getElementById("book-title-input").value = b.title;
      document.getElementById("book-author-input").value = b.author;
      document.getElementById("book-year-input").value = b.publishedYear;
      document.getElementById("book-genre-input").value = b.genre;
      if (b.pageCount && b.pageCount > 15) {
        document.getElementById("book-pages-input").value = b.pageCount;
      }
      document.getElementById("book-cover-input").value = b.coverUrl;
      showToast("Dados preenchidos no formulário!");
    }

    async function handleSaveBook(event) {
      event.preventDefault();
      const idVal = document.getElementById("book-id-input").value;
      const title = document.getElementById("book-title-input").value.trim();
      const author = document.getElementById("book-author-input").value.trim();
      const publishedYear = Number(document.getElementById("book-year-input").value) || null;
      const genre = document.getElementById("book-genre-input").value.trim() || "Literatura";
      const pageCount = Math.max(1, Number(document.getElementById("book-pages-input").value) || 200);
      const status = document.getElementById("book-status-input").value;
      const format = document.getElementById("book-format-input").value;
      const rating = Number(document.getElementById("book-rating-input").value) || 0;
      const skipDates = Boolean(document.getElementById("book-skip-dates-input")?.checked);
      const startDate = skipDates ? "" : document.getElementById("book-start-input").value;
      const finishDate = skipDates ? "" : document.getElementById("book-finish-input").value;
      const coverUrl = document.getElementById("book-cover-input").value.trim();

      const hasBothDates = Boolean(startDate && finishDate);
      const excludeFromSpeedCalc = skipDates || (status === "completed" && !hasBothDates);

      const vel = (status === "completed" && !excludeFromSpeedCalc)
        ? calculateReadingVelocity(pageCount, startDate, finishDate)
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
        excludeFromSpeedCalc,
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
        await db.notes.where("bookId").equals(bookId).delete();
        await db.reviews.where("bookId").equals(bookId).delete();
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
        const localGemini = localStorage.getItem("codex_gemini_api_key");
        if (localGemini) return localGemini;
      } catch (e) {}
      if (firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("__CODEX_")) {
        return firebaseConfig.apiKey;
      }
      return "";
    }

    function openBatchImportModal() {
      document.getElementById("modal-batch-import").classList.remove("hidden");
    }

    function closeBatchImportModal() {
      document.getElementById("modal-batch-import").classList.add("hidden");
    }

    function fillSampleBatchList() {
      const sample = [
        "Manifesto do Partido Comunista (Karl Marx e Friedrich Engels) — O texto fundacional",
        "O Capital (Karl Marx) — A crítica definitiva ao modo de produção capitalista",
        "A Origem da Família, da Propriedade Privada e do Estado (Friedrich Engels)",
        "Torto Arado - Itamar Vieira Junior",
        "A Hora da Estrela (Clarice Lispector)"
      ].join("\n");
      document.getElementById("batch-raw-input").value = sample;
    }

    function parseRawBookLine(rawLine) {
      let line = String(rawLine || "")
        .replace(/^\s*(?:\d+[.)\-\s]+|[-*•]\s*)/, "")
        .replace(/[*_~`]/g, "")
        .trim();

      let extractedIsbn = "";
      const isbnMatch = line.match(/\b((?:978|979)[-\s]?\d[\d-\s]{8,11}[\dXx]|\d{9}[\dXx])\b/);
      if (isbnMatch) {
        extractedIsbn = isbnMatch[1].replace(/[-\s]/g, "");
      }

      const parenAuthorMatch = line.match(/^(.+?)\s*\(([^)]+)\)\s*(?:[—–\-:]\s*(.*))?$/);
      if (parenAuthorMatch) {
        const candidateTitle = parenAuthorMatch[1].trim().replace(/^["'“”«»]|["'“”«»]$/g, "");
        const insideParen = parenAuthorMatch[2].trim();
        if (!/^\d{4}$/.test(insideParen)) {
          return {
            cleanTitle: candidateTitle,
            cleanAuthor: insideParen,
            isbn: extractedIsbn
          };
        }
      }

      if (line.includes(" — ")) {
        const dashParts = line.split(" — ");
        const left = dashParts[0].trim();
        const right = dashParts.slice(1).join(" — ").trim();
        if (right.split(/\s+/).length <= 4 && !/[.!?,;]/.test(right)) {
          return { cleanTitle: left, cleanAuthor: right, isbn: extractedIsbn };
        }
        line = left;
      }

      const sepMatch = line.match(/^(.+?)\s+[-–]\s+([^—–\-]+)$/);
      if (sepMatch) {
        const left = sepMatch[1].trim();
        const right = sepMatch[2].trim();
        if (right.split(/\s+/).length <= 6) {
          return { cleanTitle: left, cleanAuthor: right, isbn: extractedIsbn };
        }
        return { cleanTitle: left, cleanAuthor: "", isbn: extractedIsbn };
      }

      const byMatch = line.match(/^(.+?)(?:,\s*de|\s+por)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú.]+){0,4})$/);
      if (byMatch) {
        return { cleanTitle: byMatch[1].trim(), cleanAuthor: byMatch[2].trim(), isbn: extractedIsbn };
      }

      return {
        cleanTitle: line.replace(/^["'“”«»]|["'“”«»]$/g, "").trim(),
        cleanAuthor: "",
        isbn: extractedIsbn
      };
    }

    async function enrichSingleBookFromPublicAPIs(rawLine, initialData = {}) {
      const parsedLine = parseRawBookLine(rawLine);
      const cleanTitle = (initialData.title || parsedLine.cleanTitle || rawLine).trim();
      const cleanAuthor = (initialData.author && initialData.author !== "Autor desconhecido")
        ? initialData.author.trim()
        : (parsedLine.cleanAuthor || "");
      const cleanIsbn = (initialData.isbn || parsedLine.isbn || "").replace(/[-\s]/g, "");
      const hasValidIsbn = /^(978|979)?\d{9}[\dXx]$/.test(cleanIsbn);

      let resolved = {
        title: cleanTitle,
        author: cleanAuthor || "Autor desconhecido",
        publishedYear: initialData.publishedYear || "",
        genre: initialData.genre || "Literatura",
        pageCount: (Number(initialData.pageCount) > 15) ? Number(initialData.pageCount) : 0,
        isbn: hasValidIsbn ? cleanIsbn : "",
        isbnList: hasValidIsbn ? [cleanIsbn] : [],
        olWorkKey: "",
        coverUrl: initialData.coverUrl || ""
      };

      // 1. Se tiver ISBN válido, consulta BrasilAPI ISBN (CBL)
      if (resolved.isbn) {
        try {
          const brRes = await fetch(`https://brasilapi.com.br/api/isbn/v1/${resolved.isbn}`);
          if (brRes.ok) {
            const brData = await brRes.json();
            if (brData && brData.title) {
              resolved.title = brData.subtitle ? `${brData.title}: ${brData.subtitle}` : brData.title;
              if (Array.isArray(brData.authors) && brData.authors.length) resolved.author = brData.authors.join(", ");
              if (brData.year) resolved.publishedYear = Number(brData.year);
              if (Array.isArray(brData.subjects) && brData.subjects[0]) resolved.genre = brData.subjects[0];
              if (brData.page_count && Number(brData.page_count) > 15) resolved.pageCount = Number(brData.page_count);
              if (brData.cover_url) resolved.coverUrl = brData.cover_url;
            }
          }
        } catch (e) {}
      }

      // 2. Consulta Google Books colhendo o melhor campo entre todas as edições retornadas
      try {
        const queryCandidates = [];
        if (cleanTitle && cleanAuthor) {
          queryCandidates.push(`intitle:${cleanTitle} inauthor:${cleanAuthor}`);
          queryCandidates.push(`${cleanTitle} ${cleanAuthor}`);
        } else {
          queryCandidates.push(cleanTitle);
        }

        for (const qStr of queryCandidates) {
          const gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(qStr)}&maxResults=8&printType=books`);
          if (gRes.ok) {
            const gData = await gRes.json();
            const items = gData.items || [];
            if (items.length > 0) {
              for (const it of items) {
                const info = it.volumeInfo || {};
                if ((!resolved.author || resolved.author === "Autor desconhecido") && Array.isArray(info.authors) && info.authors.length) {
                  resolved.author = info.authors.join(", ");
                }
                const yearMatch = (info.publishedDate || "").match(/\d{4}/);
                if (!resolved.publishedYear && yearMatch) resolved.publishedYear = Number(yearMatch[0]);
                if ((!resolved.genre || resolved.genre === "Literatura") && Array.isArray(info.categories) && info.categories[0]) {
                  resolved.genre = info.categories[0];
                }
                if (resolved.pageCount <= 15 && info.pageCount && Number(info.pageCount) > 15) {
                  resolved.pageCount = Number(info.pageCount);
                }
                if (Array.isArray(info.industryIdentifiers)) {
                  const ids = info.industryIdentifiers.map(x => String(x.identifier || "").replace(/[-\s]/g, ""));
                  resolved.isbnList.push(...ids);
                  if (!resolved.isbn) {
                    const bestId = ids.find(x => /^(97885|97865)/.test(x)) || ids.find(x => /^97[89]\d{10}$/.test(x)) || ids[0];
                    if (bestId) resolved.isbn = bestId;
                  }
                }
                let thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
                if (thumb.startsWith("http://")) thumb = thumb.replace("http://", "https://");
                if (thumb && !resolved.coverUrl) resolved.coverUrl = thumb;
              }
              if (resolved.coverUrl && resolved.pageCount > 15) break;
            }
          }
        }
      } catch (e) {}

      // 3. Consulta OpenLibrary COM fields explícitos (number_of_pages_median, cover_i, isbn)
      if (!resolved.coverUrl || resolved.pageCount <= 15 || resolved.author === "Autor desconhecido") {
        try {
          const olFields = "key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,subject";
          const olQuery = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
          const olRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(olQuery)}&fields=${olFields}&limit=5`);
          if (olRes.ok) {
            const olData = await olRes.json();
            const docs = olData.docs || [];
            for (const d of docs) {
              if (!resolved.olWorkKey && d.key) resolved.olWorkKey = d.key;
              if ((!resolved.author || resolved.author === "Autor desconhecido") && Array.isArray(d.author_name) && d.author_name.length) {
                resolved.author = d.author_name.slice(0, 2).join(", ");
              }
              if (!resolved.publishedYear && d.first_publish_year) resolved.publishedYear = d.first_publish_year;
              if (resolved.pageCount <= 15 && d.number_of_pages_median && Number(d.number_of_pages_median) > 15) {
                resolved.pageCount = Number(d.number_of_pages_median);
              }
              if (Array.isArray(d.isbn) && d.isbn.length) {
                resolved.isbnList.push(...d.isbn);
                if (!resolved.isbn) {
                  resolved.isbn = d.isbn.find(x => /^(97885|97865)/.test(x)) || d.isbn.find(x => /^97[89]\d{10}$/.test(x)) || d.isbn[0];
                }
              }
              if (!resolved.coverUrl && d.cover_i) {
                resolved.coverUrl = `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`;
              }
            }
          }
        } catch (e) {}
      }

      // 4. Se ainda não achou pageCount (> 15), busca nas edições da obra ou ISBN brasileiro via BrasilAPI / OpenLibrary Data API
      if (resolved.pageCount <= 15) {
        await resolveRealPageCountAndMeta(resolved);
      }

      // 5. Se encontrou ISBN mas ainda está sem capa, usa a capa direta por ISBN da OpenLibrary
      if (!resolved.coverUrl && resolved.isbn) {
        resolved.coverUrl = `https://covers.openlibrary.org/b/isbn/${resolved.isbn}-M.jpg`;
      }

      if (!resolved.pageCount || resolved.pageCount <= 15) resolved.pageCount = 200;
      return resolved;
    }

    async function callGeminiChunk(linesChunk, apiKey) {
      const prompt = `Extraia e complete os metadados bibliográficos de cada livro abaixo (em português do Brasil), incluindo o número real de páginas da edição padrão brasileira.
Lista:
${linesChunk.map((l, i) => `${i + 1}. ${l}`).join("\n")}

Retorne APENAS um array JSON com exatamente ${linesChunk.length} objetos na mesma ordem, contendo:
[{"title": "Título limpo da obra", "author": "Nome do autor", "publishedYear": 1995, "genre": "Gênero literário", "pageCount": 312, "isbn": "ISBN-13 apenas dígitos"}]`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) throw new Error("Gemini API indisponível");
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed) ? parsed : [];
    }

    async function processBatchBooksWithGemini() {
      const rawInput = document.getElementById("batch-raw-input").value || "";
      const lines = rawInput
        .split(/\r?\n/)
        .map(l => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
        .filter(l => l.length > 1);

      if (lines.length === 0) {
        showToast("Cole pelo menos 1 livro na caixa de texto.");
        return;
      }

      const btn = document.getElementById("btn-process-batch");
      const progressText = document.getElementById("batch-progress-text");
      const defaultStatus = document.getElementById("batch-default-status").value;
      const defaultFormat = document.getElementById("batch-default-format").value;
      const geminiKey = getActiveGeminiKey();

      btn.disabled = true;
      btn.innerHTML = `<span>⏳ Buscando ${lines.length} livros...</span>`;

      const preParsedList = lines.map(line => parseRawBookLine(line));

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
            break;
          }
        }
      }

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
            publishedYear: aiData.publishedYear || "",
            genre: aiData.genre || "Literatura",
            pageCount: aiData.pageCount || 0,
            isbn: aiData.isbn || localParsed.isbn || ""
          };
          const enriched = await enrichSingleBookFromPublicAPIs(line, seed);
          results[idx] = {
            selected: true,
            title: enriched.title,
            author: enriched.author,
            publishedYear: enriched.publishedYear || "",
            genre: enriched.genre || "Literatura",
            pageCount: enriched.pageCount,
            isbn: enriched.isbn || "",
            coverUrl: enriched.coverUrl || "",
            status: defaultStatus,
            format: defaultFormat
          };
        }));

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
      btn.innerHTML = `<span>Processar Lista</span>`;
    }

    function renderBatchPreviewTable() {
      const container = document.getElementById("batch-preview-container");
      const tbody = document.getElementById("batch-preview-tbody");
      const countEl = document.getElementById("batch-resolved-count");

      container.classList.remove("hidden");
      countEl.textContent = batchCandidates.filter(c => c.selected).length;

      tbody.innerHTML = batchCandidates.map((item, idx) => `
        <tr class="hover:bg-paper-200/40 dark:hover:bg-stone-800/40 transition-colors">
          <td class="py-2 px-3">
            <input type="checkbox" ${item.selected ? "checked" : ""} onchange="toggleBatchCandidate(${idx}, this.checked)" class="w-4 h-4 rounded text-burgundy-600" />
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
            <div>${escapeHtml(item.isbn || "—")}</div>
            <div class="text-[10px] opacity-75">${item.publishedYear || "—"} • ${escapeHtml(item.genre)}</div>
          </td>
          <td class="py-2 px-2">
            <input type="number" min="1" value="${item.pageCount}" oninput="batchCandidates[${idx}].pageCount = Number(this.value) || 200" class="w-16 px-2 py-1 rounded bg-paper-100 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 font-mono text-xs text-paper-800 dark:text-paper-100" />
          </td>
          <td class="py-2 px-2">
            <select onchange="batchCandidates[${idx}].status = this.value" class="px-2 py-1 rounded bg-paper-100 dark:bg-stone-900 border border-paper-300 dark:border-stone-700 text-xs text-paper-800 dark:text-paper-100">
              <option value="backlog" ${item.status === "backlog" ? "selected" : ""}>Quero Ler</option>
              <option value="completed" ${item.status === "completed" ? "selected" : ""}>Lido</option>
              <option value="reading" ${item.status === "reading" ? "selected" : ""}>Lendo</option>
            </select>
          </td>
        </tr>
      `).join("");
    }

    function toggleBatchCandidate(idx, checked) {
      if (batchCandidates[idx]) {
        batchCandidates[idx].selected = checked;
        document.getElementById("batch-resolved-count").textContent = batchCandidates.filter(c => c.selected).length;
      }
    }

    async function confirmSaveBatchBooks() {
      const selected = batchCandidates.filter(c => c.selected && c.title.trim());
      if (selected.length === 0) {
        showToast("Selecione pelo menos 1 livro da tabela para adicionar.");
        return;
      }

      const skipBatchDates = Boolean(document.getElementById("batch-skip-dates-input")?.checked);
      const todayIso = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const booksToInsert = selected.map((item, idx) => {
        const isCompleted = item.status === "completed";
        const isReading = item.status === "reading";
        const pages = Math.max(1, Number(item.pageCount) || 200);
        const excludeSpeed = isCompleted && skipBatchDates;
        return {
          title: item.title.trim(),
          author: (item.author || "Autor desconhecido").trim(),
          publishedYear: Number(item.publishedYear) || null,
          genre: (item.genre || "Literatura").trim(),
          isbn: item.isbn || "",
          pageCount: pages,
          status: item.status,
          format: item.format || "kindle",
          rating: 0,
          startDate: isReading ? todayIso : (isCompleted && !excludeSpeed ? todayIso : ""),
          finishDate: (isCompleted && !excludeSpeed) ? todayIso : "",
          daysTaken: (isCompleted && !excludeSpeed) ? 1 : null,
          pagesPerDay: (isCompleted && !excludeSpeed) ? pages : null,
          excludeFromSpeedCalc: excludeSpeed,
          coverUrl: item.coverUrl || "",
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
      document.getElementById("batch-raw-input").value = "";
      document.getElementById("batch-preview-container").classList.add("hidden");
      await refreshStateFromDB();
      await pushAllToFirestore(true);
      showToast(`🎉 ${booksToInsert.length} livros adicionados à estante!`);
    }
