// =========================================================================
    // 1. DATABASE INITIALIZATION (DEXIE.JS / INDEXEDDB + FALLBACK IN-MEMORY)
    // =========================================================================
    let db = null;
    let useMemoryFallback = false;
    const memoryStore = {
      books: [],
      notes: [],
      reviews: []
    };

    const STOPWORDS_PT = new Set([
      'a','ao','aos','aquela','aquelas','aquele','aqueles','aquilo','as','até','com','como',
      'da','das','de','dela','delas','dele','deles','depois','do','dos','e','ela','elas',
      'ele','eles','em','entre','era','eram','essa','essas','esse','esses','esta','estas',
      'este','estes','eu','foi','foram','há','isso','isto','já','lhe','lhes','mais','mas',
      'me','mesmo','meu','meus','minha','minhas','muito','na','nas','nem','no','nos','nós',
      'nossa','nossas','nosso','nossos','num','numa','não','o','os','ou','para','pela',
      'pelas','pelo','pelos','por','qual','quando','que','quem','se','sem','seu','seus',
      'só','sua','suas','são','também','te','tem','tendo','tenho','ter','teu','teus','tu',
      'tua','tuas','tudo','um','uma','umas','uns','você','vocês','vos','à','às','é','sobre',
      'livro','obra','autor','leitura','texto','história','ser','está','estão','fazer'
    ]);

    let state = {
      currentView: 'shelf',
      shelfFilter: 'all',
      selectedBookId: null,
      focusMode: false,
      books: [],
      notes: [],
      reviews: [],
      speedChart: null,
      evolutionChart: null,
      autosaveTimer: null
    };

    async function initDatabase() {
      try {
        if (typeof Dexie !== 'undefined') {
          db = new Dexie('CodexLiteraryDB');
          db.version(1).stores({
            books: '++id, status, format, rating, startDate, finishDate, author, genre',
            notes: '++id, bookId, type, createdAt',
            reviews: '++id, &bookId, isCompleted, wordCount, updatedAt'
          });
          await db.open();
          const count = await db.books.count();
          if (count === 0) {
            await seedInitialLiteraryData();
          }
        } else {
          useMemoryFallback = true;
          await seedInitialLiteraryData();
        }
      } catch (err) {
        useMemoryFallback = true;
        const badge = document.getElementById('db-engine-badge');
        if (badge) badge.textContent = 'Modo Local Ativo';
        await seedInitialLiteraryData();
      }
      await refreshStateFromDB();
    }

    function calculateReadingVelocity(pageCount, startDate, finishDate) {
      const pages = Math.max(1, Number(pageCount) || 1);
      if (!startDate || !finishDate) {
        return { daysTaken: null, pagesPerDay: null };
      }
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(finishDate + 'T00:00:00');
      const diffMs = end.getTime() - start.getTime();
      const daysTaken = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      const pagesPerDay = Number((pages / daysTaken).toFixed(1));
      return { daysTaken, pagesPerDay };
    }

    function analyzeReviewText(act1, act2, act3) {
      const fullText = [act1 || '', act2 || '', act3 || ''].join(' ').trim();
      if (!fullText) {
        return {
          wordCount: 0,
          act1Words: 0,
          act2Words: 0,
          act3Words: 0,
          uniqueWordsCount: 0,
          lexicalRichness: 0,
          wordsPerSentence: 0,
          repetitions: []
        };
      }
      const countWords = (txt) => {
        const cleaned = (txt || '').trim();
        return cleaned ? cleaned.split(/\s+/).length : 0;
      };
      const act1Words = countWords(act1);
      const act2Words = countWords(act2);
      const act3Words = countWords(act3);
      const wordCount = act1Words + act2Words + act3Words;

      const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const wordsPerSentence = sentences.length > 0 ? Number((wordCount / sentences.length).toFixed(1)) : wordCount;

      const tokens = fullText
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'“”«»—–[\]]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOPWORDS_PT.has(w) && isNaN(Number(w)));

      const freqMap = {};
      tokens.forEach(t => {
        freqMap[t] = (freqMap[t] || 0) + 1;
      });
      const uniqueWordsCount = Object.keys(freqMap).length;
      const lexicalRichness = tokens.length > 0 ? Math.min(100, Math.round((uniqueWordsCount / tokens.length) * 100)) : 0;

      const repetitions = Object.entries(freqMap)
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      return {
        wordCount,
        act1Words,
        act2Words,
        act3Words,
        uniqueWordsCount,
        lexicalRichness,
        wordsPerSentence,
        repetitions
      };
    }

    async function seedInitialLiteraryData() {
      const sampleBooks = [
        {
          id: 1,
          title: 'Ensaio sobre a Cegueira',
          author: 'José Saramago',
          publishedYear: 1995,
          genre: 'Ficção Filosófica / Distopia',
          pageCount: 312,
          format: 'physical',
          status: 'completed',
          rating: 5.0,
          startDate: '2026-08-02',
          finishDate: '2026-08-11',
          daysTaken: 10,
          pagesPerDay: 31.2,
          coverUrl: '',
          createdAt: '2026-08-02T10:00:00Z',
          updatedAt: '2026-08-11T21:00:00Z'
        },
        {
          id: 2,
          title: 'Memórias Póstumas de Brás Cubas',
          author: 'Machado de Assis',
          publishedYear: 1881,
          genre: 'Clássico Brasileiro',
          pageCount: 240,
          format: 'kindle',
          status: 'completed',
          rating: 4.5,
          startDate: '2026-09-05',
          finishDate: '2026-09-12',
          daysTaken: 8,
          pagesPerDay: 30.0,
          coverUrl: '',
          createdAt: '2026-09-05T10:00:00Z',
          updatedAt: '2026-09-12T20:00:00Z'
        },
        {
          id: 3,
          title: 'Duna',
          author: 'Frank Herbert',
          publishedYear: 1965,
          genre: 'Ficção Científica',
          pageCount: 680,
          format: 'kindle',
          status: 'completed',
          rating: 4.5,
          startDate: '2026-09-18',
          finishDate: '2026-10-07',
          daysTaken: 20,
          pagesPerDay: 34.0,
          coverUrl: '',
          createdAt: '2026-09-18T10:00:00Z',
          updatedAt: '2026-10-07T22:00:00Z'
        },
        {
          id: 4,
          title: 'O Deserto dos Tártaros',
          author: 'Dino Buzzati',
          publishedYear: 1940,
          genre: 'Ficção Existencial',
          pageCount: 224,
          format: 'physical',
          status: 'reading',
          rating: 0,
          startDate: '2026-10-19',
          finishDate: '',
          daysTaken: null,
          pagesPerDay: null,
          coverUrl: '',
          createdAt: '2026-10-19T09:00:00Z',
          updatedAt: '2026-10-25T18:00:00Z'
        },
        {
          id: 5,
          title: 'Ficções',
          author: 'Jorge Luis Borges',
          publishedYear: 1944,
          genre: 'Contos / Metafísica',
          pageCount: 176,
          format: 'kindle',
          status: 'backlog',
          rating: 0,
          startDate: '',
          finishDate: '',
          daysTaken: null,
          pagesPerDay: null,
          coverUrl: '',
          createdAt: '2026-10-22T14:00:00Z',
          updatedAt: '2026-10-22T14:00:00Z'
        }
      ];

      const sampleNotes = [
        {
          id: 1,
          bookId: 1,
          type: 'quote',
          reference: 'Pág. 310',
          content: 'Penso que não cegámos, penso que estamos cegos, Cegos que veem, Cegos que, vendo, não veem.',
          createdAt: '2026-08-11T19:30:00Z'
        },
        {
          id: 2,
          bookId: 1,
          type: 'note',
          reference: 'Cap. 6',
          content: 'A ausência de nomes próprios reduz todos os personagens à sua condição humana mais crua: a mulher do médico funciona como único eixo moral.',
          createdAt: '2026-08-07T21:15:00Z'
        },
        {
          id: 3,
          bookId: 4,
          type: 'note',
          reference: 'Pág. 84',
          content: 'Giovanni Drogo começa a perceber que o hábito na Fortaleza Bastiani é uma armadilha silenciosa contra a passagem do tempo.',
          createdAt: '2026-10-23T22:10:00Z'
        },
        {
          id: 4,
          bookId: 4,
          type: 'quote',
          reference: 'Pág. 112',
          content: 'Até então ele avançara pela idade despreocupada da primeira juventude, numa estrada que quando se é menino parece infinita.',
          createdAt: '2026-10-25T20:05:00Z'
        }
      ];

      const act1Sample1 = 'Em Ensaio sobre a Cegueira, José Saramago constrói uma parábola inclemente sobre a fragilidade do pacto civilizatório. Uma epidemia repentina de cegueira branca — leitosa e sem explicação clínica — alastra-se por uma metrópole não nomeada, levando o Estado a confinar os primeiros infectados em um manicômio desativado sob vigilância militar.';
      const act2Sample1 = 'A radicalidade estilística de Saramago, marcada por períodos longos separados apenas por vírgulas e pela abolição de travessões, simula um fluxo coral de vozes em pânico. Diferente de distopias políticas como 1984, aqui a barbárie não nasce de um regime totalitário externo, mas da rápida dissolução ética diante da escassez e do medo. Apenas a mulher do médico conserva a visão, tornando-se testemunha silenciosa da degradação e da posterior reconstrução solidária.';
      const act3Sample1 = 'O romance encerra-se como um alerta filosófico atemporal: a verdadeira cegueira não é fisiológica, mas a incapacidade coletiva de enxergar a dignidade alheia. É uma leitura indispensável para quem aprecia ficção densa, provocadora e estilisticamente audaciosa.';
      const stats1 = analyzeReviewText(act1Sample1, act2Sample1, act3Sample1);

      const act1Sample2 = 'Narrado por um defunto autor livre das conveniências sociais dos vivos, Memórias Póstumas de Brás Cubas revisita a trajetória medíocre de um aristocrata carioca do século XIX, expondo as vaidades, o parasitismo e as contradições da elite imperial.';
      const act2Sample2 = 'Machado de Assis rompe com o realismo linear ao dialogar diretamente com o leitor em capítulos curtos, digressivos e carregados de ironia fina. O pessimismo bem-humorado de Brás Cubas desmascara a hipocrisia afetiva (no caso de Virgília) e intelectual (no sistema filosófico do Humanitismo de Quincas Borba).';
      const act3Sample2 = 'O célebre balanço final das negativas sintetiza a genialidade machadiana. Uma obra-prima enxuta, mordaz e fundamental para compreender tanto a literatura brasileira quanto a arte da ironia narrativa.';
      const stats2 = analyzeReviewText(act1Sample2, act2Sample2, act3Sample2);

      const sampleReviews = [
        {
          id: 1,
          bookId: 1,
          act1Premise: act1Sample1,
          act2Analysis: act2Sample1,
          act3Verdict: act3Sample1,
          wordCount: stats1.wordCount,
          uniqueWordsCount: stats1.uniqueWordsCount,
          lexicalRichness: stats1.lexicalRichness,
          isCompleted: true,
          updatedAt: '2026-08-11T21:40:00Z'
        },
        {
          id: 2,
          bookId: 2,
          act1Premise: act1Sample2,
          act2Analysis: act2Sample2,
          act3Verdict: act3Sample2,
          wordCount: stats2.wordCount,
          uniqueWordsCount: stats2.uniqueWordsCount,
          lexicalRichness: stats2.lexicalRichness,
          isCompleted: true,
          updatedAt: '2026-09-12T22:10:00Z'
        }
      ];

      if (!useMemoryFallback && db) {
        await db.books.bulkPut(sampleBooks);
        await db.notes.bulkPut(sampleNotes);
        await db.reviews.bulkPut(sampleReviews);
      } else {
        memoryStore.books = sampleBooks;
        memoryStore.notes = sampleNotes;
        memoryStore.reviews = sampleReviews;
      }
    }

    async function refreshStateFromDB() {
      if (!useMemoryFallback && db) {
        state.books = await db.books.toArray();
        state.notes = await db.notes.toArray();
        state.reviews = await db.reviews.toArray();
      } else {
        state.books = [...memoryStore.books];
        state.notes = [...memoryStore.notes];
        state.reviews = [...memoryStore.reviews];
      }
      state.books.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      if (!state.selectedBookId && state.books.length > 0) {
        const firstCompletedOrReading = state.books.find(b => b.status === 'completed') || state.books[0];
        state.selectedBookId = firstCompletedOrReading.id;
      }
      renderAll();
    }

    function renderAll() {
      renderShelf();
      renderWorkshop();
      if (state.currentView === 'analytics') {
        renderAnalytics();
      }
    }
