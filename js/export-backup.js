// =========================================================================
    // 8. PREVIEW UNIFICADO, EXPORTAÇÃO MARKDOWN & BACKUP JSON
    // =========================================================================
    function buildMarkdownForBook(book) {
      const review = state.reviews.find(r => r.bookId === book.id) || {};
      const notes = state.notes.filter(n => n.bookId === book.id);
      const lines = [
        '---',
        `title: "${book.title}"`,
        `author: "${book.author}"`,
        `publishedYear: ${book.publishedYear || ''}`,
        `genre: "${book.genre || ''}"`,
        `pages: ${book.pageCount || 0}`,
        `format: "${book.format}"`,
        `rating: ${book.rating || 0}`,
        `startDate: "${book.startDate || ''}"`,
        `finishDate: "${book.finishDate || ''}"`,
        `daysTaken: ${book.daysTaken || ''}`,
        `pagesPerDay: ${book.pagesPerDay || ''}`,
        `lexicalRichness: "${review.lexicalRichness || 0}%"`,
        '---',
        '',
        `# ${book.title}`,
        `**Autor:** ${book.author} | **Páginas:** ${book.pageCount} | **Ritmo:** ${book.pagesPerDay ? `${book.pagesPerDay} págs/dia (${book.daysTaken} dias)` : 'Em andamento'} | **Nota:** ${book.rating ? book.rating.toFixed(1) + ' ★' : 'S/N'}`,
        '',
        '## I. Premissa & Contexto',
        review.act1Premise || '_Ainda não redigido._',
        '',
        '## II. Análise Crítica & Impressão',
        review.act2Analysis || '_Ainda não redigido._',
        '',
        '## III. Conclusão & Veredito',
        review.act3Verdict || '_Ainda não redigido._',
        ''
      ];

      if (notes.length > 0) {
        lines.push('## Caderno de Notas & Citações da Leitura');
        notes.forEach(n => {
          const prefix = n.type === 'quote' ? '> ' : '- ';
          const ref = n.reference ? ` *(${n.reference})*` : '';
          lines.push(`${prefix}${n.content}${ref}`);
        });
        lines.push('');
      }
      return lines.join('\n');
    }

    function openPreviewReviewModal() {
      const book = state.books.find(b => b.id === state.selectedBookId);
      if (!book) return;
      saveCurrentReviewNow(true);
      const review = state.reviews.find(r => r.bookId === book.id) || {};

      document.getElementById('preview-modal-title').textContent = book.title;
      document.getElementById('preview-modal-meta').innerHTML = `
        Por <strong>${escapeHtml(book.author)}</strong> • ${book.pageCount} páginas •
        ${book.daysTaken ? `Lido em ${book.daysTaken} dias (${book.pagesPerDay} págs/dia)` : 'Leitura registrada'} •
        ${renderStarRating(book.rating)}
      `;

      const bodyEl = document.getElementById('preview-modal-body');
      bodyEl.innerHTML = `
        <section class="space-y-2">
          <h3 class="text-xs font-sans font-bold uppercase tracking-widest text-burgundy-600 dark:text-amber-400">I. Premissa</h3>
          <p class="whitespace-pre-line">${escapeHtml(review.act1Premise || 'Nenhuma premissa escrita ainda.')}</p>
        </section>
        <section class="space-y-2">
          <h3 class="text-xs font-sans font-bold uppercase tracking-widest text-burgundy-600 dark:text-amber-400">II. Análise e Impressão</h3>
          <p class="whitespace-pre-line">${escapeHtml(review.act2Analysis || 'Nenhuma análise escrita ainda.')}</p>
        </section>
        <section class="space-y-2">
          <h3 class="text-xs font-sans font-bold uppercase tracking-widest text-burgundy-600 dark:text-amber-400">III. Conclusão e Veredito</h3>
          <p class="whitespace-pre-line">${escapeHtml(review.act3Verdict || 'Nenhum veredito escrito ainda.')}</p>
        </section>
      `;
      document.getElementById('modal-preview-review').classList.remove('hidden');
    }

    function closePreviewReviewModal() {
      document.getElementById('modal-preview-review').classList.add('hidden');
    }

    function exportCurrentReviewMarkdown() {
      const book = state.books.find(b => b.id === state.selectedBookId);
      if (!book) return;
      saveCurrentReviewNow(true);
      const md = buildMarkdownForBook(book);
      const slug = book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      downloadFile(`codex-resenha-${slug || 'livro'}.md`, md, 'text/markdown;charset=utf-8');
      showToast('Arquivo Markdown (.md) exportado com sucesso!');
    }

    function copyCurrentReviewMarkdown() {
      const book = state.books.find(b => b.id === state.selectedBookId);
      if (!book) return;
      const md = buildMarkdownForBook(book);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(md).then(() => showToast('Markdown copiado para a área de transferência!'));
      } else {
        const temp = document.createElement('textarea');
        temp.value = md;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showToast('Markdown copiado para a área de transferência!');
      }
    }

    function openBackupModal() {
      document.getElementById('modal-backup').classList.remove('hidden');
    }

    function closeBackupModal() {
      document.getElementById('modal-backup').classList.add('hidden');
    }

    function exportFullBackupJSON() {
      const payload = {
        app: 'Codex Literary Workshop',
        owner: ALLOWED_OWNER_EMAIL,
        version: 2,
        exportedAt: new Date().toISOString(),
        books: state.books,
        notes: state.notes,
        reviews: state.reviews
      };
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadFile(`codex-backup-${dateStr}.json`, JSON.stringify(payload, null, 2), 'application/json');
      showToast('Backup JSON completo gerado com sucesso!');
    }

    async function importFullBackupJSON(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.books)) {
          showToast('Arquivo JSON inválido para o Codex.');
          return;
        }
        if (!useMemoryFallback && db) {
          await db.books.clear();
          await db.notes.clear();
          await db.reviews.clear();
          await db.books.bulkPut(data.books || []);
          await db.notes.bulkPut(data.notes || []);
          await db.reviews.bulkPut(data.reviews || []);
        } else {
          memoryStore.books = data.books || [];
          memoryStore.notes = data.notes || [];
          memoryStore.reviews = data.reviews || [];
        }
        await refreshStateFromDB();
        await pushAllToFirestore(true);
        closeBackupModal();
        showToast(`Backup restaurado e sincronizado: ${data.books.length} livros recuperados!`);
      } catch (err) {
        showToast('Erro ao ler o arquivo de backup JSON.');
      }
    }

    function exportAllReviewsMarkdown() {
      const mdBlocks = state.books.map(b => buildMarkdownForBook(b));
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadFile(`codex-antologia-completa-${dateStr}.md`, mdBlocks.join('\n\n---\n\n'), 'text/markdown;charset=utf-8');
      showToast('Antologia completa em Markdown exportada!');
    }

    // =========================================================================
    // 9. HELPERS & UTILITIES
    // =========================================================================
    function downloadFile(filename, content, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function formatDateBR(isoDate) {
      if (!isoDate) return '—';
      const parts = isoDate.split('-');
      if (parts.length !== 3) return isoDate;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function showToast(message) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'px-4 py-2.5 rounded-xl bg-paper-800 dark:bg-amber-600 text-paper-50 text-xs font-medium shadow-lg border border-paper-700 transition-all pointer-events-auto';
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3200);
    }

    window.addEventListener('DOMContentLoaded', async () => {
      loadSavedTheme();
      initPwaSupport();
      await initDatabase();
      initFirebaseServices();
    });
