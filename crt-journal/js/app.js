// ═══════════════════════════════════════════════════════════
// CRT JOURNAL — APP CORE
// Navigation, state, topbar
// ═══════════════════════════════════════════════════════════

const App = {
  currentPage: 'dashboard',

  init() {
    // Set today's date on entry form
    const dateEl = document.getElementById('t-date');
    if (dateEl) dateEl.valueAsDate = new Date();

    this.updateTopbar();
    this.initPage('dashboard');
  },

  nav(page, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
    if (btn) btn.classList.add('active');
    this.currentPage = page;
    this.initPage(page);
    window.scrollTo(0, 0);
  },

  initPage(page) {
    if (page === 'dashboard') Dashboard.render();
    if (page === 'log') Log.render();
    if (page === 'stats') Stats_Page.render();
  },

  updateTopbar() {
    const trades = DB.load();
    const closed = trades.filter(t => t.outcome && t.outcome !== 'SKIP');
    const totalR = closed.reduce((s, t) => s + (parseFloat(t.r) || 0), 0);
    const wins = closed.filter(t => t.outcome === 'WIN');
    const wr = closed.length ? Math.round(wins.length / closed.length * 100) : 0;

    const totalEl = document.getElementById('tb-total');
    const rEl = document.getElementById('tb-r');
    const wrEl = document.getElementById('tb-wr');

    if (totalEl) totalEl.textContent = trades.length;
    if (rEl) {
      rEl.textContent = (totalR >= 0 ? '+' : '') + totalR.toFixed(1) + 'R';
      rEl.className = 'val ' + (totalR > 0 ? 'pos' : totalR < 0 ? 'neg' : '');
    }
    if (wrEl) wrEl.textContent = closed.length ? wr + '%' : '—';
  }
};

// ═══ DASHBOARD ═══
const Dashboard = {
  render() {
    const trades = DB.load();
    const s = Stats.compute(trades);
    const recent = trades.slice(-5).reverse();

    // Stat cards
    this.fillStat('dash-total', trades.length, '');
    this.fillStat('dash-r', (parseFloat(s.totalR) >= 0 ? '+' : '') + s.totalR + 'R', parseFloat(s.totalR) > 0 ? 'pos' : parseFloat(s.totalR) < 0 ? 'neg' : '');
    this.fillStat('dash-wr', s.closed ? s.wr + '%' : '—', parseFloat(s.wr) >= 50 ? 'pos' : parseFloat(s.wr) > 0 ? 'neg' : '');
    this.fillStat('dash-score', s.avgScore + '/10', '');
    this.fillStat('dash-streak-w', s.maxWS, 'pos');
    this.fillStat('dash-bad', s.badTrades, s.badTrades === 0 ? 'pos' : 'neg');

    // Recent trades
    const tbody = document.getElementById('dash-recent');
    if (tbody) {
      if (!recent.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:30px;text-align:center;color:var(--text3)">Aucun trade enregistré</td></tr>`;
      } else {
        tbody.innerHTML = recent.map((t, i) => `
          <tr>
            <td class="td-main" style="font-size:10px;color:var(--text3)">CRT-${String(trades.length - i).padStart(3,'0')}</td>
            <td>${t.date}</td>
            <td>${t.pair}</td>
            <td><span class="model-badge">${Utils.modelShort(t.model)}</span></td>
            <td><span class="${Utils.scoreClass(t.score)}">${t.score}/10</span></td>
            <td><span class="tag tag-${(t.outcome||'skip').toLowerCase()}">${t.outcome || 'SKIP'}</span></td>
            <td class="${Utils.rClass(t.r)}">${t.outcome === 'SKIP' ? '—' : Utils.fmtR(t.r)}</td>
          </tr>`).join('');
      }
    }

    // Weekly R mini chart
    const weekBars = document.getElementById('dash-week-bars');
    if (weekBars && s.weeks.length) {
      const maxR = Math.max(...s.weeks.map(w => Math.abs(w[1].r)), 0.01);
      weekBars.innerHTML = s.weeks.map(([week, data]) => {
        const h = Math.max(4, Math.round((Math.abs(data.r) / maxR) * 44));
        const color = data.r >= 0 ? 'var(--green)' : 'var(--red)';
        return `<div class="mini-bar" style="height:${h}px;background:${color};opacity:0.8" data-tip="Sem. ${week}: ${Utils.fmtR(data.r)}"></div>`;
      }).join('');
    }

    // Discipline gauge
    const validTrades = trades.filter(t => t.outcome && t.outcome !== 'SKIP');
    const disciplineScore = validTrades.length
      ? Math.round(100 - (s.badTrades / Math.max(validTrades.length, 1)) * 100)
      : 100;
    const gaugeFill = document.getElementById('dash-discipline-fill');
    const gaugeVal = document.getElementById('dash-discipline-val');
    if (gaugeFill) { gaugeFill.style.width = disciplineScore + '%'; gaugeFill.style.background = disciplineScore >= 80 ? 'var(--green)' : disciplineScore >= 60 ? 'var(--orange)' : 'var(--red)'; }
    if (gaugeVal) { gaugeVal.textContent = disciplineScore + '%'; }
  },

  fillStat(id, val, cls) {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.className = 'sc-val' + (cls ? ' ' + cls : ''); }
  }
};

// ═══ LOG PAGE ═══
const Log = {
  filter: { outcome: 'all', model: 'all', search: '' },
  sortKey: 'date', sortDir: -1,

  render() {
    const trades = DB.load();
    let filtered = [...trades];

    // Filters
    if (this.filter.outcome !== 'all') filtered = filtered.filter(t => t.outcome === this.filter.outcome);
    if (this.filter.model !== 'all') filtered = filtered.filter(t => (t.model || '').includes(this.filter.model));
    if (this.filter.search) {
      const q = this.filter.search.toLowerCase();
      filtered = filtered.filter(t => (t.pair || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q) || (t.notesPost || '').toLowerCase().includes(q));
    }

    // Sort
    filtered.sort((a, b) => {
      if (this.sortKey === 'date') return (a.date || '').localeCompare(b.date || '') * this.sortDir;
      if (this.sortKey === 'r') return ((parseFloat(a.r)||0) - (parseFloat(b.r)||0)) * this.sortDir;
      if (this.sortKey === 'score') return ((a.score||0) - (b.score||0)) * this.sortDir;
      return 0;
    });

    const totalIndex = trades.length;
    const tbody = document.getElementById('log-body');
    const empty = document.getElementById('log-empty');
    const count = document.getElementById('log-count');

    if (count) count.textContent = filtered.length + ' trade(s)';

    if (!filtered.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    if (tbody) {
      tbody.innerHTML = filtered.map((t, i) => {
        const origIdx = trades.findIndex(x => x.id === t.id);
        const num = `CRT-${String(origIdx + 1).padStart(3, '0')}`;
        const ruleOk = !t.ruleViolated || t.ruleViolated === 'Aucune';
        return `
          <tr>
            <td class="td-main" style="font-size:10px;color:var(--text3)">${num}</td>
            <td>${t.date || '—'}</td>
            <td style="color:var(--text)">${t.pair || '—'}</td>
            <td>${t.session || '—'}</td>
            <td><span class="model-badge">${Utils.modelShort(t.model)}</span></td>
            <td><span class="${Utils.scoreClass(t.score || 0)}">${t.score || 0}/10</span></td>
            <td><span class="tag tag-${(t.outcome || 'skip').toLowerCase()}">${t.outcome || '—'}</span></td>
            <td class="${Utils.rClass(t.r)}">${t.outcome === 'SKIP' ? '—' : Utils.fmtR(t.r)}</td>
            <td><span class="tag ${ruleOk ? 'tag-valid' : 'tag-invalid'}">${ruleOk ? 'OK' : '⚠'}</span></td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm" onclick="Log.openDetail(${t.id})">Voir</button>
                <button class="btn btn-danger btn-sm" onclick="Log.deleteTrade(${t.id})">✕</button>
              </div>
            </td>
          </tr>`;
      }).join('');
    }
  },

  openDetail(id) {
    const trades = DB.load();
    const t = trades.find(x => x.id === id);
    if (!t) return;
    const idx = trades.findIndex(x => x.id === id);
    const num = `CRT-${String(idx + 1).padStart(3, '0')}`;
    const ruleOk = !t.ruleViolated || t.ruleViolated === 'Aucune';

    document.getElementById('modal-title').textContent = num + ' — ' + (t.pair || '') + ' — ' + (t.date || '');
    document.getElementById('modal-body').innerHTML = `
      <div class="grid-3" style="margin-bottom:16px">
        <div><div class="label-inline">Instrument</div><div style="margin-top:4px;font-size:13px;color:var(--text)">${t.pair||'—'}</div></div>
        <div><div class="label-inline">Session</div><div style="margin-top:4px;font-size:13px">${t.session||'—'}</div></div>
        <div><div class="label-inline">Biais HTF</div><div style="margin-top:4px;font-size:13px">${t.bias||'—'}</div></div>
      </div>
      <div class="grid-3" style="margin-bottom:16px">
        <div><div class="label-inline">Modèle CRT</div><div style="margin-top:4px"><span class="model-badge">${Utils.modelShort(t.model)}</span></div></div>
        <div><div class="label-inline">Phase</div><div style="margin-top:4px;font-size:12px;color:var(--text2)">${t.phase||'—'}</div></div>
        <div><div class="label-inline">Score Checklist</div><div style="margin-top:4px;font-size:18px;font-weight:700" class="${Utils.scoreClass(t.score||0)}">${t.score||0}/10</div></div>
      </div>
      <hr class="divider">
      <div class="grid-4" style="margin-bottom:16px">
        <div><div class="label-inline">Entrée</div><div style="margin-top:4px;font-size:13px;color:var(--blue)">${Utils.fmt5(t.entry)}</div></div>
        <div><div class="label-inline">Stop Loss</div><div style="margin-top:4px;font-size:13px;color:var(--red)">${Utils.fmt5(t.sl)}</div></div>
        <div><div class="label-inline">TP1 (50% C1)</div><div style="margin-top:4px;font-size:13px;color:var(--green)">${Utils.fmt5(t.tp1)}</div></div>
        <div><div class="label-inline">TP2</div><div style="margin-top:4px;font-size:13px;color:var(--green)">${Utils.fmt5(t.tp2)}</div></div>
      </div>
      <hr class="divider">
      <div class="grid-4" style="margin-bottom:16px">
        <div><div class="label-inline">Résultat</div><div style="margin-top:6px"><span class="tag tag-${(t.outcome||'skip').toLowerCase()}">${t.outcome||'—'}</span></div></div>
        <div><div class="label-inline">R Réalisé</div><div style="margin-top:4px;font-size:18px;font-weight:700" class="${Utils.rClass(t.r)}">${t.outcome==='SKIP'?'—':Utils.fmtR(t.r)}</div></div>
        <div><div class="label-inline">TP Atteint</div><div style="margin-top:4px;font-size:12px">${t.tpHit||'—'}</div></div>
        <div><div class="label-inline">Règle Violée</div><div style="margin-top:4px"><span class="tag ${ruleOk?'tag-valid':'tag-invalid'}">${t.ruleViolated||'Aucune'}</span></div></div>
      </div>
      <div class="grid-2" style="margin-bottom:16px">
        <div><div class="label-inline">Émotion Avant</div><div style="margin-top:4px;font-size:12px;color:${Utils.isEmotionDangerous(t.emoBefore)?'var(--red)':'var(--text2)'}">${t.emoBefore||'—'}</div></div>
        <div><div class="label-inline">Émotion Après</div><div style="margin-top:4px;font-size:12px;color:var(--text2)">${t.emoAfter||'—'}</div></div>
      </div>
      ${t.notesPre ? `<hr class="divider"><div class="label-inline">Notes pré-trade</div><div style="margin-top:8px;font-size:12px;color:var(--text2);line-height:1.7;background:var(--bg3);padding:12px;border-radius:4px;border:1px solid var(--border)">${t.notesPre}</div>` : ''}
      ${t.notesPost ? `<div style="margin-top:12px"><div class="label-inline">Post-mortem</div><div style="margin-top:8px;font-size:12px;color:var(--text2);line-height:1.7;background:var(--bg3);padding:12px;border-radius:4px;border:1px solid var(--border)">${t.notesPost}</div></div>` : ''}
    `;
    document.getElementById('trade-modal').classList.add('open');
  },

  closeModal() {
    document.getElementById('trade-modal').classList.remove('open');
  },

  deleteTrade(id) {
    if (confirm('Supprimer ce trade ?')) {
      DB.delete(id);
      this.render();
      App.updateTopbar();
      Toast.show('Trade supprimé');
    }
  },

  applyFilter(key, val) {
    this.filter[key] = val;
    this.render();
  },

  sort(key) {
    if (this.sortKey === key) this.sortDir *= -1;
    else { this.sortKey = key; this.sortDir = -1; }
    this.render();
  }
};

// ═══ STATS PAGE ═══
const Stats_Page = {
  render() {
    const trades = DB.load();
    if (!trades.length) {
      document.getElementById('stats-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-title">Aucune donnée disponible</div>
          Enregistre tes premiers trades pour voir apparaître les statistiques.
        </div>`;
      return;
    }
    const s = Stats.compute(trades);
    this.renderCards(s);
    this.renderModels(s);
    this.renderSessions(s);
    this.renderEmotions(s);
    this.renderWeeklyCurve(s);
    this.renderEdgeScore(s, trades);
  },

  renderCards(s) {
    const container = document.getElementById('stats-cards');
    if (!container) return;
    container.innerHTML = `
      <div class="stat-card" data-accent="green"><div class="sc-label">R Total</div><div class="sc-val ${parseFloat(s.totalR)>0?'pos':parseFloat(s.totalR)<0?'neg':''}">${parseFloat(s.totalR)>0?'+':''}${s.totalR}R</div><div class="sc-sub">${s.closed} trades fermés</div></div>
      <div class="stat-card" data-accent="blue"><div class="sc-label">Win Rate</div><div class="sc-val ${parseFloat(s.wr)>=50?'pos':'neg'}">${s.closed?s.wr+'%':'—'}</div><div class="sc-sub">${s.wins}W / ${s.losses}L / ${s.bes}BE</div></div>
      <div class="stat-card" data-accent="teal"><div class="sc-label">R Moyen / Trade</div><div class="sc-val ${parseFloat(s.avgR)>0?'pos':parseFloat(s.avgR)<0?'neg':''}">${parseFloat(s.avgR)>=0?'+':''}${s.avgR}R</div><div class="sc-sub">par trade fermé</div></div>
      <div class="stat-card" data-accent="orange"><div class="sc-label">Score Checklist Moyen</div><div class="sc-val">${s.avgScore}/10</div><div class="sc-sub">discipline globale</div></div>
      <div class="stat-card" data-accent="${s.badTrades===0?'green':'red'}"><div class="sc-label">Trades Sous 7/10</div><div class="sc-val ${s.badTrades===0?'pos':'neg'}">${s.badTrades}</div><div class="sc-sub">discipline violée</div></div>
      <div class="stat-card" data-accent="purple"><div class="sc-label">Série Max Gagnante</div><div class="sc-val pos">${s.maxWS}</div><div class="sc-sub">trades consécutifs</div></div>
    `;
  },

  renderModels(s) {
    const el = document.getElementById('stats-models');
    if (!el) return;
    const entries = Object.entries(s.byModel);
    if (!entries.length) { el.innerHTML = '<div class="rule-item"><span class="rule-text" style="color:var(--text3)">Aucune donnée</span></div>'; return; }
    el.innerHTML = entries.sort((a,b)=>b[1].r-a[1].r).map(([model, d]) => {
      const wr = d.total ? Math.round(d.wins/d.total*100) : 0;
      const avgScore = d.scores.length ? (d.scores.reduce((a,b)=>a+b,0)/d.scores.length).toFixed(1) : '—';
      return `<div class="rule-item">
        <span class="rule-num" style="min-width:90px;font-size:10px">${Utils.modelShort(model)}</span>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:12px;color:var(--text)">${d.total} trade(s)</span>
            <span style="font-size:12px"><span style="${wr>=50?'color:var(--green)':'color:var(--red)'}">WR: ${wr}%</span> · <span class="${Utils.rClass(d.r)}">${Utils.fmtR(d.r)}</span> · Score moy: ${avgScore}</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${wr}%;background:${wr>=50?'var(--green)':'var(--red)'}"></div></div>
        </div>
      </div>`;
    }).join('');
  },

  renderSessions(s) {
    const el = document.getElementById('stats-sessions');
    if (!el) return;
    const entries = Object.entries(s.bySession);
    if (!entries.length) { el.innerHTML = '<div class="rule-item"><span class="rule-text" style="color:var(--text3)">Aucune donnée</span></div>'; return; }
    el.innerHTML = entries.sort((a,b)=>b[1].r-a[1].r).map(([session, d]) => {
      const wr = d.total ? Math.round(d.wins/d.total*100) : 0;
      return `<div class="rule-item">
        <span class="rule-num" style="min-width:90px;font-size:10px">${session}</span>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:12px;color:var(--text)">${d.total} trade(s)</span>
            <span style="font-size:12px"><span style="${wr>=50?'color:var(--green)':'color:var(--red)'}">WR: ${wr}%</span> · <span class="${Utils.rClass(d.r)}">${Utils.fmtR(d.r)}</span></span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${wr}%;background:${wr>=50?'var(--green)':'var(--red)'}"></div></div>
        </div>
      </div>`;
    }).join('');
  },

  renderEmotions(s) {
    const el = document.getElementById('stats-emotions');
    if (!el) return;
    const entries = Object.entries(s.byEmotion);
    if (!entries.length) { el.innerHTML = '<div class="rule-item"><span class="rule-text" style="color:var(--text3)">Aucune donnée — enregistrer l\'état émotionnel</span></div>'; return; }
    el.innerHTML = entries.sort((a,b)=>b[1].total-a[1].total).map(([emo, d]) => {
      const wr = d.total ? Math.round(d.wins/d.total*100) : 0;
      const isDanger = Utils.isEmotionDangerous(emo);
      const insight = isDanger && d.total >= 3 && wr < 50 ? ` <span style="color:var(--red);font-size:10px">⚠ Pattern de perte identifié</span>` : '';
      return `<div class="rule-item">
        <span class="rule-num" style="min-width:90px;font-size:10px;color:${isDanger?'var(--red)':'var(--text2)'}">${isDanger?'⚠ ':''}${emo}</span>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:12px;color:var(--text)">${d.total} trade(s)${insight}</span>
            <span style="font-size:12px;${wr>=50?'color:var(--green)':'color:var(--red)'}">WR: ${wr}%</span>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${wr}%;background:${wr>=50?'var(--green)':'var(--red)'}"></div></div>
        </div>
      </div>`;
    }).join('');
  },

  renderWeeklyCurve(s) {
    const el = document.getElementById('stats-weekly');
    if (!el || !s.weeks.length) { if(el) el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:16px">Pas assez de données</div>'; return; }
    const maxAbs = Math.max(...s.weeks.map(w => Math.abs(w[1].r)), 0.01);
    el.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:6px;height:80px;padding:0 4px">
        ${s.weeks.map(([week, d]) => {
          const h = Math.max(6, Math.round((Math.abs(d.r) / maxAbs) * 72));
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="width:100%;height:${h}px;background:${d.r>=0?'var(--green)':'var(--red)'};opacity:0.75;border-radius:2px 2px 0 0;min-height:4px" data-tip="Sem. ${week}: ${Utils.fmtR(d.r)}"></div>
            <div style="font-size:9px;color:var(--text3);writing-mode:vertical-lr;transform:rotate(180deg);white-space:nowrap">${week.slice(5)}</div>
          </div>`;
        }).join('')}
      </div>`;
  },

  renderEdgeScore(s, trades) {
    const el = document.getElementById('stats-edge');
    if (!el) return;
    const closed = trades.filter(t => t.outcome && t.outcome !== 'SKIP');
    const wr = closed.length ? parseFloat(s.wr) : 0;
    const avgR = parseFloat(s.avgR);
    const discipline = s.total ? Math.round(100 - (s.badTrades / Math.max(s.total, 1)) * 100) : 100;
    const noViolations = s.violated === 0;

    const edgeScore = Math.round(
      (wr >= 50 ? 30 : wr >= 40 ? 20 : 10) +
      (avgR >= 1.5 ? 25 : avgR >= 1 ? 18 : avgR >= 0 ? 10 : 0) +
      (discipline >= 90 ? 25 : discipline >= 75 ? 18 : 10) +
      (noViolations ? 20 : s.violated <= 3 ? 12 : 5)
    );

    const color = edgeScore >= 75 ? 'var(--green)' : edgeScore >= 50 ? 'var(--orange)' : 'var(--red)';
    const label = edgeScore >= 75 ? 'Edge confirmé' : edgeScore >= 50 ? 'Edge en développement' : 'Edge insuffisant';

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:20px;padding:16px 20px">
        <div style="text-align:center;min-width:80px">
          <div style="font-size:42px;font-weight:800;color:${color};font-family:var(--font-display)">${edgeScore}</div>
          <div style="font-size:9px;color:var(--text3);letter-spacing:0.1em;text-transform:uppercase">/100</div>
        </div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:8px">${label}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:var(--text2)">
            <div>Win rate: <span style="${wr>=50?'color:var(--green)':'color:var(--red)'}">${wr.toFixed(0)}%</span></div>
            <div>R moyen: <span class="${Utils.rClass(avgR)}">${avgR>=0?'+':''}${avgR}R</span></div>
            <div>Discipline: <span style="${discipline>=80?'color:var(--green)':'color:var(--red)'}">${discipline}%</span></div>
            <div>Violations: <span style="${noViolations?'color:var(--green)':'color:var(--red)'}">${s.violated}</span></div>
          </div>
        </div>
      </div>`;
  }
};
