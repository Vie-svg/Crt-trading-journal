# CRT Trading Journal

**Candle Range Theory — Système institutionnel de trading**
*Framework RomeoTPT / TradesbyVee*

---

## Contenu du journal

| Page | Description |
|---|---|
| **Dashboard** | Vue d'ensemble — R total, win rate, discipline, courbe hebdomadaire |
| **Saisir Trade** | Formulaire complet — Checklist 10 points, état émotionnel, niveaux |
| **Plan de Trade** | Calculateur — TP1/TP2/TP3, risque réel en $, gestion psychologique |
| **Historique** | Tous les trades — Filtres, tri, export, détail complet par trade |
| **Performance** | Statistiques — Score d'edge, par modèle, par session, émotions |
| **Règles CRT** | Framework complet — 10 règles absolues, séquence HTF, modèles |
| **Guide** | Déploiement GitHub Pages + backup des données |

## Déploiement

1. Fork ou clone ce repo
2. Settings → Pages → Deploy from branch → main → / root
3. URL: `https://tonnom.github.io/crt-journal`

## Structure

```
crt-journal/
├── index.html      ← Page principale (toute la logique HTML)
├── css/
│   └── main.css    ← Styles complets (dark theme institutionnel)
└── js/
    ├── data.js     ← Base de données localStorage + export CSV/JSON
    ├── app.js      ← Navigation, Dashboard, Historique, Statistiques
    └── entry.js    ← Formulaire de saisie + Calculateur de plan
```

## Données

- Sauvegardées dans **localStorage** du navigateur
- Export **CSV** pour analyse Excel / Google Sheets
- Export **JSON** pour backup et restauration
- Import JSON pour migrer entre appareils

## Règles CRT codifiées

- Score checklist minimum **7/10** — bloqué en dessous
- **KOD** prioritaire sur C3 direct
- **TP1 à 50% de C1** — obligatoire, non négociable
- Risque **0.5%–1%** max par trade
- Alerte automatique si état émotionnel dégradé (FOMO, Revanche...)
- Séquence **H4 → H1 → M15** obligatoire

---

*Basé sur CRT Secrets Series 1 et The Secrets of Time — TradesbyVee / RomeoTPT*
