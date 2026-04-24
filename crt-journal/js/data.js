// ═══════════════════════════════════════════════════════════
// CRT JOURNAL — DATA LAYER
// localStorage persistence, CRUD, export/import
// ═══════════════════════════════════════════════════════════

const DB = {
  KEY: 'crt_journal_v2',
  KEY_SETTINGS: 'crt_settings_v1',

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch { return []; }
  },
  save(trades) {
    localStorage.setItem(this.KEY, JSON.stringify(trades));
    App.updateTopbar();
  },
  loadSettings() {
    try { return JSON.parse(localStorage.getItem(this.KEY_SETTINGS) || '{}'); } catch { return {}; }
  },
  saveSettings(s) {
    localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(s));
  },

  add(trade) {
    const trades = this.load();
    trade.id = Date.now();
    trade.createdAt = new Date().toISOString();
    trades.push(trade);
    this.save(trades);
    return trade;
  },

  update(id, data) {
    const trades = this.load();
    const idx = trades.findIndex(t => t.id === id);
    if (idx > -1) { trades[idx] = { ...trades[idx], ...data, updatedAt: new Date().toISOString() }; this.save(trades); }
  },

  delete(id) {
    const trades = this.load().filter(t => t.id !== id);
    this.save(trades);
  },

  clear() { localStorage.removeItem(this.KEY); App.updateTopbar(); },

  exportCSV() {
    const trades = this.load();
    if (!trades.length) return;
    const headers = ['ID','Date','Instrument','Session','Biais HTF','Timeframe HTF','Modèle CRT','Phase CRT','Score Checklist','Checklist OK','Entrée','Stop Loss','TP1','TP2','Risque %','Résultat','R Réalisé','TP Atteint','Émotion Avant','Émotion Après','Règle Violée','Notes Pré-Trade','Post-Mortem','Semaine'];
    const rows = trades.map((t,i) => [
      `CRT-${String(i+1).padStart(3,'0')}`,
      t.date, t.pair, t.session, t.bias, t.htf,
      t.model, t.phase, t.score,
      t.score >= 7 ? 'OUI' : 'NON',
      t.entry || '', t.sl || '', t.tp1 || '', t.tp2 || '',
      t.risk || '', t.outcome || '', t.r || '', t.tpHit || '',
      t.emoBefore || '', t.emoAfter || '',
      t.ruleViolated || 'Aucune',
      `"${(t.notesPre || '').replace(/"/g,'""')}"`,
      `"${(t.notesPost || '').replace(/"/g,'""')}"`,
      t.week || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `crt_journal_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  },

  exportJSON() {
    const trades = this.load();
    const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `crt_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  },

  importJSON(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (!Array.isArray(data)) throw new Error('Format invalide');
          const trades = this.load();
          const merged = [...trades, ...data.filter(n => !trades.find(t => t.id === n.id))];
          this.save(merged);
          res(data.length);
        } catch(err) { rej(err); }
      };
      reader.readAsText(file);
    });
  }
};

// ═══ STATS ENGINE ═══
const Stats = {
  compute(trades) {
    const closed = trades.filter(t => t.outcome && t.outcome !== 'SKIP');
    const wins = closed.filter(t => t.outcome === 'WIN');
    const losses = closed.filter(t => t.outcome === 'LOSS');
    const bes = closed.filter(t => t.outcome === 'BE');
    const totalR = closed.reduce((s, t) => s + (parseFloat(t.r) || 0), 0);
    const wr = closed.length ? (wins.length / closed.length) * 100 : 0;
    const avgR = closed.length ? totalR / closed.length : 0;
    const avgScore = trades.length ? trades.reduce((s, t) => s + (t.score || 0), 0) / trades.length : 0;
    const badTrades = trades.filter(t => (t.score || 0) < 7 && t.outcome !== 'SKIP');
    const violated = trades.filter(t => t.ruleViolated && t.ruleViolated !== 'Aucune');

    // Per model
    const byModel = {};
    trades.forEach(t => {
      const m = t.model || 'Inconnu';
      if (!byModel[m]) byModel[m] = { total: 0, wins: 0, losses: 0, r: 0, scores: [] };
      byModel[m].total++;
      if (t.outcome === 'WIN') byModel[m].wins++;
      if (t.outcome === 'LOSS') byModel[m].losses++;
      byModel[m].r += parseFloat(t.r) || 0;
      byModel[m].scores.push(t.score || 0);
    });

    // Per session
    const bySession = {};
    trades.forEach(t => {
      const s = t.session || 'Inconnu';
      if (!bySession[s]) bySession[s] = { total: 0, wins: 0, r: 0 };
      bySession[s].total++;
      if (t.outcome === 'WIN') bySession[s].wins++;
      bySession[s].r += parseFloat(t.r) || 0;
    });

    // Per instrument
    const byPair = {};
    trades.forEach(t => {
      const p = t.pair || 'Inconnu';
      if (!byPair[p]) byPair[p] = { total: 0, wins: 0, r: 0 };
      byPair[p].total++;
      if (t.outcome === 'WIN') byPair[p].wins++;
      byPair[p].r += parseFloat(t.r) || 0;
    });

    // Emotion correlation
    const byEmotion = {};
    trades.forEach(t => {
      if (!t.emoBefore || t.emoBefore === '—') return;
      if (!byEmotion[t.emoBefore]) byEmotion[t.emoBefore] = { total: 0, wins: 0, losses: 0 };
      byEmotion[t.emoBefore].total++;
      if (t.outcome === 'WIN') byEmotion[t.emoBefore].wins++;
      if (t.outcome === 'LOSS') byEmotion[t.emoBefore].losses++;
    });

    // Weekly R curve (last 12 weeks)
    const byWeek = {};
    trades.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      const start = new Date(d); start.setDate(d.getDate() - d.getDay() + 1);
      const key = start.toISOString().slice(0, 10);
      if (!byWeek[key]) byWeek[key] = { r: 0, trades: 0 };
      byWeek[key].r += parseFloat(t.r) || 0;
      byWeek[key].trades++;
    });
    const weeks = Object.entries(byWeek).sort((a,b) => a[0].localeCompare(b[0])).slice(-12);

    // Longest win/loss streak
    let maxWS = 0, maxLS = 0, curWS = 0, curLS = 0;
    closed.forEach(t => {
      if (t.outcome === 'WIN') { curWS++; curLS = 0; maxWS = Math.max(maxWS, curWS); }
      else { curLS++; curWS = 0; maxLS = Math.max(maxLS, curLS); }
    });

    return {
      total: trades.length, closed: closed.length,
      wins: wins.length, losses: losses.length, bes: bes.length,
      skips: trades.length - closed.length,
      totalR: totalR.toFixed(1), wr: wr.toFixed(1), avgR: avgR.toFixed(2),
      avgScore: avgScore.toFixed(1), badTrades: badTrades.length,
      violated: violated.length, maxWS, maxLS,
      byModel, bySession, byPair, byEmotion, weeks
    };
  }
};

// ═══ UTILS ═══
const Utils = {
  fmt5: n => isNaN(n) ? '—' : parseFloat(n).toFixed(5),
  fmt2: n => isNaN(n) ? '—' : parseFloat(n).toFixed(2),
  fmtR: r => {
    const v = parseFloat(r);
    if (isNaN(v)) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(1) + 'R';
  },
  modelShort: m => {
    if (!m) return '—';
    if (m.includes('KOD')) return 'KOD';
    if (m.includes('#1')) return 'Model #1';
    if (m.includes('sans')) return 'C3 Direct';
    if (m.includes('ignoré') || m.includes('Ignoré')) return 'Ignoré';
    return m.split(' ')[0];
  },
  scoreClass: s => s >= 7 ? 'score-hi' : s >= 5 ? 'score-mid' : 'score-lo',
  rClass: r => {
    const v = parseFloat(r);
    return v > 0 ? 'r-pos' : v < 0 ? 'r-neg' : 'r-zero';
  },
  weekLabel: dateStr => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    return days[d.getDay()] + ' ' + d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  },
  tradeNum: (i, total) => `CRT-${String(total - i).padStart(3,'0')}`,
  dangerous_emotions: ['FOMO','Revanche','Anxieux','Surconfiant','Frustré'],
  isEmotionDangerous: e => ['FOMO','Revanche','Anxieux','Surconfiant'].includes(e),

  getWeekStr(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const start = new Date(d); start.setDate(d.getDate() - d.getDay() + 1);
    return `Sem. ${start.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })}`;
  }
};

// ═══ TOAST NOTIFICATIONS ═══
const Toast = {
  show(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    el.style.cssText = `
      position:fixed; bottom:24px; right:24px; z-index:9999;
      padding:10px 16px; border-radius:4px; font-size:11px; font-weight:700;
      font-family:var(--font-mono); letter-spacing:0.06em;
      animation: slideUp 0.2s ease;
    `;
    if (type === 'success') el.style.cssText += 'background:#0a2820;border:1px solid var(--green3);color:var(--green);';
    if (type === 'error') el.style.cssText += 'background:var(--bg2);border:1px solid var(--red);color:var(--red);';
    if (type === 'info') el.style.cssText += 'background:var(--bg2);border:1px solid var(--border3);color:var(--text2);';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2500);
  }
};
