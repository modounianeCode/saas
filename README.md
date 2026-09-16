# Argent Clair

Application web personnelle de gestion d'argent en FCFA : revenus, dépenses, solde et tableau de bord mensuel.

## Stack technique

- **Frontend** : Next.js 15, React 19, TypeScript
- **Backend / BDD** : Supabase (PostgreSQL, Auth, Row Level Security)
- **Style** : CSS vanilla

## Démarrer le projet

1. Créez un projet sur [Supabase](https://supabase.com), puis exécutez le contenu de `supabase/schema.sql` dans son éditeur SQL.
2. Copiez `.env.example` en `.env.local` et renseignez l'URL et la clé anonyme de Supabase.
3. Installez les dépendances : `npm install`
4. Lancez le serveur de développement : `npm run dev`
5. Dans Supabase Auth, configurez l'URL de redirection vers `http://localhost:3000` (et l'URL de production au déploiement).

## Structure du projet

```
app/
  components/         – Composants UI réutilisables
  (auth)/             – Page d'authentification (login/signup/reset)
  (dashboard)/        – Tableau de bord principal
  layout.tsx          – Layout racine
  globals.css         – Styles globaux
lib/
  supabase.ts         – Client Supabase côté navigateur
  useAuth.ts          – Hook d'authentification
  useTransactions.ts  – Hook de gestion des transactions
  validation.ts       – Validation côté client
supabase/
  schema.sql          – Schéma de la base de données
```

## Fonctionnalités

- Authentification (connexion, inscription, réinitialisation du mot de passe)
- Ajout et suppression de transactions (revenus / dépenses)
- Catégories prédéfinies (Alimentation, Transport, Logement, etc.)
- Tableau de bord mensuel : solde actuel, revenus et dépenses du mois
- Solde initial modifiable
- Sécurité RLS : chaque utilisateur ne voit que ses propres données

## Déploiement

```bash
npm run build
npm start
```

Déployez sur Vercel, Netlify ou tout hébergeur compatible Next.js.
