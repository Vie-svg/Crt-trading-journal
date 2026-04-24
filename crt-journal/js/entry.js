// ═══════════════════════════════════════════════════════════
// CRT JOURNAL — ENTRY FORM + PLAN CALCULATOR
// ═══════════════════════════════════════════════════════════

const Entry = {
  checkCount: 0,
  selectedOutcome: null,
  emoBefore: null,
  emoAfter: null,

  toggleCheck(el) {
    el.classList.toggle('checked');
    this.checkCount = document.querySelectorAll('#checklist .check-item.checked').length;
    this.updateScore();
  },

  updateScore() {
    const n = this.checkCount;
    const pct = n / 10 * 100;
    const fill = document.getElementById('score-fill');
    const num = document.getElementById('score-num');
    const verdict = document.getElementById('verdict');
    if (!fill) return;

    fill.style.width = pct + '%';
    if (n >= 7) {
      fill.style.background = 'var(--green)'; num.style.color = 'var(--green)';
      verdict.className = 'verdict verdict-go';
      verdict.textContent = '✓ TRADE VALIDE — ' + n + '/10 — Confluence suffisante';
    } else if (n >= 5) {
      fill.style.background = 'var(--orange)'; num.style.color = 'var(--orange)';
      verdict.className = 'verdict verdict-warn';
      verdict.textContent = '⚠ ATTENDRE — ' + n + '/10 — Confluence insuffisante';
    } else {
      fill.style.background = 'var(--red)'; num.style.color = 'var(--red)';
      verdict.className = 'verdict verdict-no';
      verdict.textContent = '✕ INVALIDE — ' + n + '/10 — Ne pas exécuter';
    }
    if (num) num.textContent = n + '/10';
  },

  selPill(el, group) {
    document.querySelectorAll('#' + group + ' .pill').forEach(b => b.classList.remove('active', 'active-red'));
    const isDangerous = Utils.isEmotionDangerous(el.textContent);
    el.classList.add(isDangerous ? 'active-red' : 'active');
    if (group === 'emo-before') this.emoBefore = el.textContent;
    if (group === 'emo-after') this.emoAfter = el.textContent;
  },

  selOutcome(el, val) {
    document.querySelectorAll('.outcome-btn').forEach(b => b.className = 'outcome-btn');
    el.className = 'outcome-btn sel-' + val;
    this.selectedOutcome = val;
    const rf = document.getElementById('result-fields');
    if (rf) rf.style.display = val === 'SKIP' ? 'none' : 'block';
  },

  save() {
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const date = get('t-date');
    if (!date) { Toast.show('Date requise', 'error'); return; }
    if (!this.selectedOutcome) { Toast.show('Sélectionner un résultat', 'error'); return; }

    const trade = {
      date, pair: get('t-pair'), session: get('t-session'),
      htf: get('t-htf'), bias: get('t-bias'),
      model: get('t-model'), phase: get('t-phase'),
      score: this.checkCount,
      entry: get('t-entry'), sl: get('t-sl'),
      tp1: get('t-tp1'), tp2: get('t-tp2'),
      risk: get('t-risk'),
      outcome: this.selectedOutcome,
      r: parseFloat(get('t-r')) || 0,
      tpHit: get('t-tp-hit'),
      emoBefore: this.emoBefore || '—',
      emoAfter: this.emoAfter || '—',
      ruleViolated: get('t-rule-violated'),
      notesPre: get('t-notes-pre'),
      notesPost: get('t-notes-post'),
      week: Utils.getWeekStr(date)
    };

    DB.add(trade);
    Toast.show('Trade enregistré — ' + (trade.pair || '') + ' ' + (trade.outcome || ''));
    this.reset();
    // Switch to log tab
    document.querySelector('[onclick*="log"]').click();
  },

  reset() {
    const clearEl = id => { const el = document.getElementById(id); if (el) el.value = ''; };
    ['t-entry','t-sl','t-tp1','t-tp2','t-r','t-notes-pre','t-notes-post'].forEach(clearEl);
    document.getElementById('t-date').valueAsDate = new Date();
    document.getElementById('t-rule-violated').value = 'Aucune';
    document.querySelectorAll('#checklist .check-item').forEach(el => el.classList.remove('checked'));
    document.querySelectorAll('.outcome-btn').forEach(b => b.className = 'outcome-btn');
    document.querySelectorAll('.pill').forEach(b => b.classList.remove('active', 'active-red'));
    const rf = document.getElementById('result-fields');
    if (rf) rf.style.display = 'none';
    this.selectedOutcome = null; this.emoBefore = null; this.emoAfter = null;
    this.checkCount = 0;
    this.updateScore();
  }
};

// ═══ PLAN CALCULATOR ═══
const Plan = {
  calculate() {
    const get = id => parseFloat(document.getElementById(id)?.value);
    const gets = id => document.getElementById(id)?.value || '';

    const dir = gets('p-dir');
    const entry = get('p-entry');
    const sl = get('p-sl');
    const tp3Input = get('p-tp3');
    const c1l = get('p-c1l');
    const c1h = get('p-c1h');
    const capital = get('p-capital') || 1000;
    const riskPct = parseFloat(gets('p-risk')) || 0.5;
    const model = gets('p-model');
    const pair = gets('p-pair');
    const emo = gets('p-emotion');

    const msgEl = document.getElementById('p-emo-msg');
    if (msgEl) {
      msgEl.className = 'alert';
      msgEl.style.display = 'block';
      if (emo === 'danger') {
        msgEl.className = 'alert alert-danger';
        msgEl.textContent = '⛔ ARRÊT IMMÉDIAT — État émotionnel dégradé. Fermer la plateforme. La prochaine session existe.';
        document.getElementById('plan-output')?.classList.add('hidden');
        return;
      } else if (emo === 'warn') {
        msgEl.className = 'alert alert-warn';
        msgEl.textContent = '⚠ Incertitude détectée — Réduire obligatoirement à 0.5% de risque. Vérifier la checklist une 2e fois.';
      } else {
        msgEl.className = 'alert alert-ok';
        msgEl.textContent = '✓ État optimal — Procéder selon le plan. Ne pas modifier les niveaux après exécution.';
      }
    }

    if (isNaN(entry) || isNaN(sl)) { Toast.show('Entrée et Stop Loss requis', 'error'); return; }

    const slDist = Math.abs(entry - sl);
    let tp1, tp2;

    if (!isNaN(c1l) && !isNaN(c1h)) {
      const mid = (c1h + c1l) / 2;
      tp1 = mid;
      tp2 = dir === 'LONG' ? c1h : c1l;
    } else {
      tp1 = dir === 'LONG' ? entry + slDist : entry - slDist;
      tp2 = dir === 'LONG' ? entry + slDist * 2 : entry - slDist * 2;
    }

    const tp3 = isNaN(tp3Input) ? null : tp3Input;
    const riskAmt = capital * (riskPct / 100);
    const r1 = (Math.abs(tp1 - entry) / slDist);
    const r2 = (Math.abs(tp2 - entry) / slDist);
    const r3 = tp3 ? (Math.abs(tp3 - entry) / slDist) : null;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('p-out-title', pair + ' — ' + (model.split('(')[0].trim()) + ' — ' + (dir === 'LONG' ? 'HAUSSIER' : 'BAISSIER'));
    setEl('p-out-entry', Utils.fmt5(entry));
    setEl('p-out-sl', Utils.fmt5(sl));
    setEl('p-out-tp1', Utils.fmt5(tp1));
    setEl('p-r1', '+' + r1.toFixed(1) + 'R');
    setEl('p-out-tp2', Utils.fmt5(tp2));
    setEl('p-r2', '+' + r2.toFixed(1) + 'R');
    setEl('p-out-tp3', tp3 ? Utils.fmt5(tp3) : 'À définir selon HTF');
    setEl('p-r3', r3 ? '+' + r3.toFixed(1) + 'R' : '—');

    setEl('p-risk-amt', riskAmt.toFixed(2) + ' $');
    setEl('p-max-loss', '−' + riskAmt.toFixed(2) + ' $');
    setEl('p-gain1', '+' + (riskAmt * r1).toFixed(2) + ' $');
    setEl('p-gain2', '+' + (riskAmt * r2).toFixed(2) + ' $');
    setEl('p-gain3', r3 ? '+' + (riskAmt * r3).toFixed(2) + ' $ ' : '—');
    setEl('p-rr-max', r3 ? '1:' + r3.toFixed(1) : '1:' + r2.toFixed(1));

    const dirLabel = dir === 'LONG' ? 'en dessous' : 'au-dessus';
    setEl('p-invalid', `Close H4 ${dirLabel} du Stop Loss → sortie immédiate. Si le prix retourne en C1 sans nouveau Turtle Soup, setup annulé. Attendre une nouvelle séquence C1→C2→C3 complète avant toute re-entrée.`);

    let modelNote = '';
    if (model.includes('KOD')) modelNote = 'KOD actif : placer un ordre limite au niveau de retour sur C3. Le pullback fait partie du plan — ce n\'est pas un signal d\'alarme. Ne pas modifier le SL pendant l\'attente.';
    else if (model.includes('sans')) modelNote = 'C3 Direct sans pullback : entrée agressive. Probabilité de retracement vers l\'entrée est haute. Position réduite à 0.5% obligatoirement. Ne pas moyenner.';
    else modelNote = 'Model #1 : attendre la clôture complète de la bougie C3. Une bougie en mouvement n\'est pas une confirmation. Patience absolue.';

    setEl('p-patience', modelNote + '\n\nTP1 à +' + r1.toFixed(1) + 'R : clôturer 50% de la position ici — obligatoire sans exception. Déplacer le SL au point mort immédiatement après. Entre TP1 et TP2, laisser courir selon le plan défini avant l\'entrée. Ne pas fermer manuellement sur une consolidation normale.');

    document.getElementById('plan-output')?.classList.remove('hidden');
  }
};
