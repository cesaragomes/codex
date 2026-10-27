// =========================================================================
    // 7. ANALYTICS & CHARTS (VELOCIDADE DE LEITURA E LABORATÓRIO DE ESTILO)
    // =========================================================================
    function renderAnalytics() {
      const yearFilter = document.getElementById('analytics-year-filter')?.value || 'all';
      const completedBooks = state.books.filter(b => {
        if (b.status !== 'completed') return false;
        if (yearFilter !== 'all' && b.finishDate && !b.finishDate.startsWith(yearFilter)) return false;
        return true;
      });

      const count = completedBooks.length;
      const kindleCount = completedBooks.filter(b => b.format === 'kindle').length;
      const physicalCount = completedBooks.filter(b => b.format === 'physical').length;
      const totalPages = completedBooks.reduce((acc, b) => acc + (Number(b.pageCount) || 0), 0);
      const avgPages = count > 0 ? Math.round(totalPages / count) : 0;

      const timedBooks = completedBooks.filter(b => !b.excludeFromSpeedCalc && b.daysTaken && Number(b.daysTaken) > 0 && b.pagesPerDay);
      const timedPages = timedBooks.reduce((acc, b) => acc + (Number(b.pageCount) || 0), 0);
      const totalDays = timedBooks.reduce((acc, b) => acc + (Number(b.daysTaken) || 1), 0);
      const avgDays = timedBooks.length > 0 ? (totalDays / timedBooks.length).toFixed(1) : 0;
      const avgSpeed = timedBooks.length > 0 ? (timedPages / Math.max(1, totalDays)).toFixed(1) : 0;

      const relevantReviews = state.reviews.filter(r => completedBooks.some(b => b.id === r.bookId) && r.wordCount > 0);
      const totalWords = relevantReviews.reduce((acc, r) => acc + (r.wordCount || 0), 0);
      const avgRichness = relevantReviews.length > 0
        ? Math.round(relevantReviews.reduce((acc, r) => acc + (r.lexicalRichness || 0), 0) / relevantReviews.length)
        : 0;

      document.getElementById('stat-books-count').textContent = count;
      document.getElementById('stat-format-split').textContent = `${kindleCount} Kindle • ${physicalCount} Físico`;
      document.getElementById('stat-total-pages').textContent = `${totalPages.toLocaleString('pt-BR')} págs`;
      document.getElementById('stat-avg-pages').textContent = `~${avgPages} p/livro`;
      document.getElementById('stat-avg-speed').textContent = `${avgSpeed} págs/dia`;
      document.getElementById('stat-avg-days').textContent = `~${avgDays} dias/livro`;
      document.getElementById('stat-total-words').textContent = `${totalWords.toLocaleString('pt-BR')} pal.`;
      document.getElementById('stat-avg-richness').textContent = `${avgRichness}% riqueza`;

      const tbody = document.getElementById('analytics-table-body');
      if (completedBooks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-paper-500">Nenhum livro concluído no período selecionado.</td></tr>`;
      } else {
        tbody.innerHTML = completedBooks.map(b => {
          const rev = state.reviews.find(r => r.bookId === b.id);
          return `
            <tr class="hover:bg-paper-200/40 dark:hover:bg-stone-800/40 transition-colors">
              <td class="py-3 px-4">
                <p class="font-editorial font-bold text-paper-800 dark:text-paper-100">${escapeHtml(b.title)}</p>
                <p class="text-[11px] text-paper-500">${escapeHtml(b.author)}</p>
              </td>
              <td class="py-3 px-3 font-mono text-xs">${b.format === 'kindle' ? '📱 Kindle' : '📖 Físico'}</td>
              <td class="py-3 px-3 font-mono text-xs font-semibold">${b.pageCount} págs</td>
              <td class="py-3 px-3 font-mono text-xs text-paper-600 dark:text-paper-400">
                ${(!b.excludeFromSpeedCalc && b.daysTaken)
                  ? `${b.daysTaken} dias<span class="block text-[10px] text-paper-500">${formatDateBR(b.startDate)} → ${formatDateBR(b.finishDate)}</span>`
                  : `<span class="text-paper-400 italic">Sem data</span>`
                }
              </td>
              <td class="py-3 px-3 font-mono text-xs font-bold text-burgundy-600 dark:text-amber-400">
                ${(!b.excludeFromSpeedCalc && b.pagesPerDay)
                  ? `${b.pagesPerDay} págs/dia`
                  : `<span class="text-paper-400 font-normal text-[11px]">Fora do cálculo</span>`
                }
              </td>
              <td class="py-3 px-3">${renderStarRating(b.rating)}</td>
              <td class="py-3 px-4 text-right">
                <button type="button" onclick="openBookInWorkshop(${b.id})" class="px-2.5 py-1 rounded-lg text-xs font-medium bg-paper-200 dark:bg-stone-800 text-paper-800 dark:text-paper-200 hover:bg-burgundy-600 hover:text-white transition-colors">
                  ${rev && rev.wordCount > 0 ? `${rev.wordCount} pal.` : 'Escrever'}
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }

      if (typeof Chart === 'undefined') return;
      const isDark = document.documentElement.classList.contains('dark');
      const textColor = isDark ? '#E6DFD5' : '#2C2623';
      const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(44,38,35,0.08)';

      const sortedTimed = [...timedBooks].sort((a, b) => (a.finishDate || '').localeCompare(b.finishDate || ''));
      const speedLabels = sortedTimed.map(b => b.title.length > 18 ? b.title.slice(0, 18) + '…' : b.title);
      const speedData = sortedTimed.map(b => b.pagesPerDay || 0);
      const sortedChrono = [...completedBooks].sort((a, b) => (a.finishDate || a.createdAt || '').localeCompare(b.finishDate || b.createdAt || ''));
      const labels = sortedChrono.map(b => b.title.length > 18 ? b.title.slice(0, 18) + '…' : b.title);

      const speedCanvas = document.getElementById('chart-reading-speed');
      if (state.speedChart) state.speedChart.destroy();
      state.speedChart = new Chart(speedCanvas, {
        type: 'bar',
        data: {
          labels: speedLabels,
          datasets: [{
            label: 'Páginas por Dia',
            data: speedData,
            backgroundColor: isDark ? '#D97706' : '#7C2D12',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor } } },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });

      const wordData = sortedChrono.map(b => {
        const r = state.reviews.find(rev => rev.bookId === b.id);
        return r ? r.wordCount : 0;
      });
      const richnessData = sortedChrono.map(b => {
        const r = state.reviews.find(rev => rev.bookId === b.id);
        return r ? r.lexicalRichness : 0;
      });

      const evoCanvas = document.getElementById('chart-writing-evolution');
      if (state.evolutionChart) state.evolutionChart.destroy();
      state.evolutionChart = new Chart(evoCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Extensão da Resenha (Palavras)',
              data: wordData,
              borderColor: isDark ? '#F59E0B' : '#7C2D12',
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(124, 45, 18, 0.15)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'Riqueza Lexical (%)',
              data: richnessData,
              borderColor: '#059669',
              backgroundColor: 'transparent',
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: textColor } } },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } }
          }
        }
      });
    }
