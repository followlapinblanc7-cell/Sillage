# Sillage

Journal intime — application web simple et discrète. Tes jours restent dans le navigateur (`localStorage`).

## Lancer en local

```bash
npm install
npm run dev
```

Ouvre l’URL affichée (souvent `http://localhost:5173`).

Build de production :

```bash
npm run build
npm run preview
```

## Déployer sur Vercel

1. Importe le dépôt dans [Vercel](https://vercel.com).
2. **Framework Preset** : Vite
3. **Build Command** : `npm run build`
4. **Output Directory** : `dist`
5. Le fichier `vercel.json` réécrit toutes les routes vers `index.html` (SPA).

## Stack

- Vite + React 19 + TypeScript
- CSS (thème sombre brun / crème / bordeaux)
- `localStorage` uniquement — pas de backend

## Fonctionnalités

- **Fil** — semaine, aujourd’hui, jours précédents
- **Jour** — titre, histoire, lieu, humeur, photos
- **Album** — grilles de couvertures
- **Chercher** — texte + filtres d’humeur
- **Tiroir** — épinglés, privé, réglages
