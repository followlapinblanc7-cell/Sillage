# Sillage

Garde une trace de chaque jour — application web simple et discrète. Tes jours restent dans le navigateur (`localStorage`).

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
- `localStorage` / IndexedDB en local-first ; Supabase optionnel pour le cercle

## Fonctionnalités

- **Fil** — semaine, aujourd’hui, jours précédents
- **Jour** — titre, souvenir, lieu, humeur, photos
- **Album** — grilles de couvertures
- **Chercher** — texte + filtres d’humeur
- **Tiroir** — épinglés, privé, réglages
- **Monde** — globe 3D atlas politique nocturne (polygones pays dessinés, océan encre, halo bleu/violet, fond étoilé) ; même look espace en thème clair

## Cercle privé (Supabase) — optionnel

Le journal reste **local-first** (`localStorage` / IndexedDB). Le cercle est une couche cloud optionnelle : auth Google, cercle de 2–5 personnes, partage opt-in d’un jour vers le fil « Ensemble ». Les jours du **coffre** ne sont jamais partagés.

### 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) et crée un projet.
2. **SQL Editor** → colle et exécute `supabase/migrations/0001_circles.sql`.
3. **Authentication → Providers** → active **Google** (Client ID / secret Google Cloud).
4. **Authentication → URL Configuration** :
   - **Site URL** : `https://followlapinblanc7-cell.github.io/Sillage/`
   - **Redirect URLs** : ajoute la même URL (et `http://localhost:5173/Sillage/` pour le dev).

### 2. Variables Vite

Copie `.env.example` vers `.env` (ne committe jamais `.env`) :

```bash
cp .env.example .env
```

Renseigne :

- `VITE_SUPABASE_URL` — Project Settings → API → Project URL
- `VITE_SUPABASE_ANON_KEY` — Project Settings → API → `anon` `public` key

Sans ces variables, l’app build et tourne en local-only ; le Tiroir affiche un message calme (« cloud pas encore branché »).

### 3. Vérifier

```bash
npm run dev
```

Tiroir → **Compte / Cercle** → Se connecter avec Google. La page Jour a un bouton **Partager avec le cercle** (désactivé tant que tu n’as pas de session + cercle).

Apple Sign-In, création de cercle, invites et API de partage complet : passes suivantes.
