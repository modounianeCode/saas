# Argent Clair

Application web personnelle de gestion d'argent en FCFA : revenus, dépenses, solde et tableau de bord mensuel.

## Stack technique

- **Frontend** : Next.js 15, React 19, TypeScript
- **Backend / BDD** : Supabase (PostgreSQL, Auth, Row Level Security)
- **Style** : CSS vanilla

## Démarrer le projet

1. Créez un projet sur [Supabase](https://supabase.com), puis exécutez le contenu de `supabase/schema.sql` dans son éditeur SQL. Pour une base existante, exécutez plutôt les fichiers de `supabase/migrations/` dans l'ordre.
2. Copiez `.env.example` en `.env.local` et renseignez l'URL et la clé anonyme de Supabase.
3. Installez les dépendances : `npm install`
4. Lancez le serveur de développement : `npm run dev`
5. Dans Supabase Auth, configurez l'URL de redirection vers `http://localhost:3000/auth/callback` (et `https://<votre-domaine>/auth/callback` en production).

## Structure du projet

```
app/
  components/         – Composants UI réutilisables (dont OfflineProvider)
  auth/callback/      – Échange du code PKCE des liens e-mail
  login/              – Page d'authentification (connexion/inscription)
  reset-password/     – Définition d'un nouveau mot de passe
  dashboard/          – Tableau de bord principal
  layout.tsx          – Layout racine
  globals.css         – Styles globaux
  manifest.ts         – Manifest PWA
middleware.ts         – Rafraîchissement de la session Supabase
next.config.ts        – En-têtes de sécurité + cache du service worker
lib/
  supabase.ts         – Client Supabase côté navigateur
  supabaseServer.ts   – Client Supabase côté serveur (session)
  useAuth.ts          – Hook d'authentification (+ déconnexion)
  useTransactions.ts  – Hook de gestion des transactions
  useSavings.ts       – Hook de gestion des objectifs d'épargne
  useOnline.ts        – État de la connexion (en ligne / hors ligne)
  offlineSync.ts      – Cache, file d'attente des écritures et synchronisation
  db.ts               – Accès IndexedDB (persistance locale)
  validation.ts       – Validation côté client
  types.ts            – Types partagés
public/
  sw.js               – Service worker (cache des assets, pages et payloads RSC)
  offline.html        – Page de repli hors ligne
  icon.svg            – Icône PWA
supabase/
  schema.sql          – Schéma complet (installations neuves)
  check_state.sql     – Diagnostic en lecture seule des migrations appliquées
  migrations/         – Migrations idempotentes pour bases existantes
```

## Qualité

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript strict
npm run audit      # Vulnérabilités des dépendances de production
```

La CI GitHub Actions exécute ces trois contrôles puis `npm run build` sur chaque push et pull request.

## Fonctionnalités

- Authentification (connexion, inscription, réinitialisation du mot de passe via lien e-mail)
- Ajout, modification et suppression réversible des transactions (revenus / dépenses)
- Historique complet : filtres par mois, type et catégorie, affichage progressif (20 par page)
- Suppression avec « Annuler » (soft delete, 6 secondes)
- Résumé mensuel synchronisé avec le mois sélectionné
- Catégories prédéfinies (Alimentation, Transport, Logement, etc.)
- Solde initial modifiable
- Objectifs d'épargne : création, dépôts/retraits dédiés, barre de progression
- Sécurité RLS : chaque utilisateur ne voit que ses propres données
- **Mode hors ligne** : PWA installable ; hors connexion, l'app reste lisible et les modifications sont mises en file d'attente puis synchronisées au retour du réseau (bannière « Hors ligne » / compteur « à synchroniser », bouton « Réessayer », relance automatique toutes les 30 s). Les données sont mises en cache localement dans le navigateur (IndexedDB + service worker).
- **File d'attente fiable** : chaque écriture est étiquetée par utilisateur (jamais rejouée sur un autre compte) et une opération invalide n'y bloque plus les suivantes.
- **Sécurité** : en-têtes HTTP durcis (`next.config.ts`), session rafraîchie par middleware, caches locaux effacés à la déconnexion.

## Déploiement

```bash
npm run build
npm start
```

Déployez sur Vercel, Netlify ou tout hébergeur compatible Next.js.

## Mettre à jour une base existante

N'exécutez **pas** `schema.sql` sur une base déjà initialisée : il est réservé aux installations neuves. Utilisez les migrations, dans l'ordre :

1. `supabase/check_state.sql` — script de diagnostic en lecture seule (tables, colonnes, contraintes, fonctions déjà présentes).
2. `supabase/migrations/001_…` puis `002_…`, `003_…`, `004_…`.

Les migrations sont **idempotentes** : elles peuvent être rejouées sans erreur, y compris après une application partielle. En cas d'échec, corrigez la cause puis relancez simplement le fichier.

> Erreur `42703: column "client_id" does not exist` : la migration `003` n'a pas encore été appliquée (c'est elle qui ajoute `client_id`, la clé d'idempotence des écritures hors ligne). Exécutez `003` puis `004`.
