# Configurer Supabase

Le jeu reste utilisable localement sans Supabase. Le cloud ajoute une sauvegarde distante optionnelle, des teams avec highscores privés et l’envoi privé des avis de difficulté.

## État de cette installation

Le projet `fkdijgrmgnbpybcfowpr` est configuré dans `supabase-config.js`. Les migrations `20261025104836_la_nuit_cloud_saves_feedback`, `20261025110755_minuit_teams_and_highscores`, `20261025112049_minuit_team_admin_rules`, `20261025125012_minuit_team_deletion` et `20261029132000_minuit_team_stats` sont appliquées, ainsi que `add_weekly_sprint_team_scores` pour le classement Sprint séparé ; toutes les tables ont RLS activé. L’authentification e-mail et la confirmation d’adresse restent activées pour les comptes e-mail existants. La fonction **`pseudo-auth` version 1 est déployée et active avec `verify_jwt=false`** pour les accès par pseudo sans e-mail. Seule la clé publiable est utilisée par le navigateur ; la clé `service_role` reste dans l’environnement privé de la fonction.

Les sections suivantes servent de procédure de maintenance ou de réinstallation sur un autre projet.

## 1. Créer les tables

Dans le **SQL Editor** du projet Supabase, exécuter le fichier [`schema.sql`](schema.sql).

Il crée :

- `public.game_saves` : un emplacement de sauvegarde par utilisateur authentifié, protégé par RLS avec `auth.uid()` ;
- `public.game_feedback` : les appréciations et commentaires d’équilibrage, accessibles en insertion seulement depuis le jeu.

Les avis n’ont **aucune politique de lecture publique**. Ils se consultent depuis le tableau de bord Supabase ou avec une clé secrète conservée sur un serveur d’administration.

Pour activer les teams, exécuter également [`teams.sql`](teams.sql), puis [`team_rules.sql`](team_rules.sql) et [`team_stats.sql`](team_stats.sql). Ils créent `teams`, `team_members`, `team_scores` et `team_score_attempts`, toutes protégées par RLS et sans accès direct pour `anon` ou `authenticated`. Seules des fonctions authentifiées sont exposées : consulter sa team, créer, rejoindre, quitter, modifier les règles en tant qu’admin, réinitialiser la campagne, supprimer la team en tant qu’admin, transmettre un score et consulter les statistiques en tant qu’admin.

Pour le Sprint hebdomadaire, exécuter ensuite [`weekly_sprint.sql`](weekly_sprint.sql). Ce fichier crée `team_weekly_sprints` et les RPC `minuit_weekly_sprint_board(date)` et `minuit_submit_weekly_sprint(date, text, integer, integer, integer, boolean)`. Ce classement amical conserve le meilleur score de chaque membre pour la semaine courante, dans une table séparée de la campagne. Il ne consomme aucune partie quotidienne et ne modifie pas les highscores `free`, `ranked` ou `daily`. La table est protégée par RLS, sans accès direct ; seules les deux fonctions authentifiées sont exposées.

## 2. Activer les accès par pseudo ou e-mail

### Accès par pseudo, sans adresse e-mail

La fonction [`functions/pseudo-auth/index.ts`](functions/pseudo-auth/index.ts) est déployée avec `verify_jwt=false`. Elle accepte un pseudo de 2 à 24 caractères et un mot de passe de 8 à 128 caractères. À l’inscription, elle crée côté serveur un utilisateur confirmé dans un domaine technique réservé dérivé du pseudo normalisé, puis obtient sa session avec son mot de passe. À la connexion suivante, le même pseudo et le même mot de passe retrouvent cet utilisateur, ses sauvegardes et sa team.

Le fournisseur **Email** doit rester activé, car il fournit le mécanisme de session sous-jacent, mais le joueur ne renseigne ni ne confirme aucune adresse. Aucune table publique de pseudos n’est nécessaire et aucune clé secrète n’est renvoyée au navigateur. Les erreurs de connexion sont génériques et le mot de passe n’est ni journalisé ni stocké par le jeu. Sans e-mail, aucune récupération de mot de passe par message n’est proposée.

Pour réinstaller la fonction, déployer l’équivalent de `supabase functions deploy pseudo-auth --no-verify-jwt`. Les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies par l’environnement des fonctions ; ne jamais recopier ces valeurs dans le dépôt ou le navigateur.

### Comptes e-mail existants

Dans **Authentication → Sign In / Providers**, conserver le fournisseur **Email**. La confirmation d’adresse peut rester activée : après une inscription avec e-mail, le joueur confirme l’adresse puis revient se connecter. Cette confirmation ne concerne pas les accès par pseudo créés par la fonction précédente.

Dans **Authentication → URL Configuration**, conserver l’adresse publique du jeu comme **Site URL**, mais ajouter cette URL exacte dans **Redirect URLs** :

```text
https://VOTRE-PROJET.supabase.co/functions/v1/email-confirmation
```

Pour ce projet, la fonction **`email-confirmation` est déployée et active avec `verify_jwt=false`**. Son code source est dans [`functions/email-confirmation/index.ts`](functions/email-confirmation/index.ts). L’inscription et le bouton **Renvoyer la confirmation** utilisent cette page Supabase comme `redirect_to`, y compris depuis le HTML autonome. Elle ne lit aucune donnée de compte, efface les jetons du fragment d’URL et invite le joueur à revenir se connecter dans le jeu.

La réponse est explicitement servie en **`text/html; charset=utf-8`**, avec longueur de contenu et corps HTML ASCII utilisant des entités pour les accents. Cela évite l’affichage du code source et les séquences corrompues comme `dâ€™e-mail`, même si un client intermédiaire ignore le charset. Après une correction, choisir **Renvoyer la confirmation** et ouvrir le nouveau lien plutôt qu’un ancien lien déjà utilisé ou conservé en cache.

Cette page évite de rediriger l’e-mail vers une URL de prévisualisation Arena/E2B protégée par un **traffic access token**. Ne pas remettre l’origine `*.e2b.app` comme redirection d’inscription. Les anciens liens déjà envoyés conservent leur ancienne destination : utiliser **Renvoyer la confirmation** pour obtenir un lien corrigé. Ne pas utiliser de joker d’URL large.

Pour réinstaller la fonction sur un autre projet, déployer le fichier source avec l’équivalent de `supabase functions deploy email-confirmation --no-verify-jwt`, puis autoriser son URL exacte. Aucun fournisseur anonyme n’est nécessaire. Un avis peut être envoyé sans compte, tandis que la sauvegarde cloud nécessite un accès par pseudo ou e-mail afin de fonctionner sur plusieurs appareils.

## 3. Renseigner la configuration publique

Modifier [`../supabase-config.js`](../supabase-config.js) :

```js
window.MINUIT_SUPABASE_CONFIG = {
  url: 'https://VOTRE-PROJET.supabase.co',
  publishableKey: 'sb_publishable_...'
};
```

L’ancienne clé `anon` est également acceptée dans `publishableKey`. Utiliser uniquement une **clé publiable / anon**, conçue pour le navigateur.

> Ne jamais mettre de clé `service_role` ou `sb_secret_...` dans ce fichier, dans le HTML autonome ou dans le dépôt. Elle contournerait les règles RLS.

Laisser les deux valeurs vides désactive toutes les requêtes Supabase.

## 4. Utiliser le cloud dans le jeu

Ouvrir **Compte & team** dans le menu ou les réglages :

1. créer un accès avec un pseudo et un mot de passe, ou se connecter avec un compte e-mail existant ;
2. cliquer sur **Envoyer ma progression** une première fois ;
3. les changements suivants sont envoyés automatiquement, au maximum toutes les 30 secondes ;
4. sur un autre appareil, se connecter puis choisir **Récupérer le cloud**.

La restauration utilise la validation et la confirmation de l’import JSON. Une copie locale de secours est créée avant remplacement. Un compte possède un seul emplacement : le dernier envoi remplace le précédent, sans fusion entre appareils.

Le mot de passe n’est jamais enregistré par le jeu. La session Supabase reste dans une clé `localStorage` séparée et n’est jamais incluse dans une sauvegarde JSON ou cloud.

## 5. Utiliser les teams et les highscores

Après connexion, le panneau **Team & highscore** permet de :

1. choisir un pseudo de 2 à 24 caractères ;
2. à la création, définir la limite quotidienne et, si nécessaire, la période de jeu ;
3. préparer une invitation par e-mail avec destinataire, objet, code et lien préremplis, ou partager sur mobile le lien `?team=CODE` par WhatsApp ou Messenger ; l’e-mail ouvre la messagerie sans enregistrer le destinataire et le lien ne contient aucun jeton de session. À son ouverture, la carte d’invitation affiche le code avant toute connexion, le conserve dans `sessionStorage` après nettoyage de l’URL et propose de rejoindre directement avec un pseudo et un mot de passe ;
4. terminer un vol pour transmettre automatiquement son score ;
5. consulter le meilleur score de chaque membre, le total et les parties restantes.

Le créateur est **administrateur**. Lui seul peut ouvrir **Règles administrateur** pour modifier la limite de 1 à 100 parties par jour, ou illimité, et les dates/heures de début et de fin. Il peut aussi choisir **Supprimer la team** : le RPC `minuit_delete_team()` vérifie `created_by = auth.uid()` et les cascades effacent membres, scores et tentatives. S’il quitte la team sans la supprimer, le membre le plus ancien devient administrateur.

Le bouton **Statistiques de la team**, visible uniquement par l’administrateur, ouvre une synthèse sur 7, 30, 90 ou 365 jours : nombre de parties et points par jour, meilleur monde et vague, activité de chaque membre et 50 derniers vols. Le RPC `minuit_team_stats(integer)` revérifie `teams.created_by = auth.uid()` avant chaque lecture. Les **points gagnés** sont la somme des scores de tous les vols comptabilisés dans `team_score_attempts`, pas la somme des highscores. Les membres sans vol restent visibles avec des compteurs à zéro ; aucun e-mail ou identifiant de connexion n’est inclus.

La limite suit le jour **Europe/Paris**. Chaque vol accepté consomme une tentative, même si son score n’améliore pas le record. Son `run_id` est unique dans la team pour éviter un double comptage lors d’un renvoi réseau. Hors période ou au-delà de la limite, le score est refusé mais le jeu local reste accessible.

Un compte ne peut appartenir qu’à une team. Quitter la team supprime le score et les tentatives du joueur de ce classement ; quitter la dernière place occupée supprime également la team vide. Les e-mails ne sont jamais renvoyés par les fonctions de classement.

> Le classement est amical, pas anti-triche. Les fonctions vérifient `auth.uid()`, l’appartenance et les bornes des valeurs, mais un score calculé dans un navigateur reste déclaratif. Pour une compétition officielle, ajouter une validation serveur des parties ou un rejeu signé, ainsi qu’une limitation de débit.

## 6. Lire les avis d’équilibrage

Depuis une session d’administration Supabase :

```sql
select rating, world, stage, wave, score, mode, difficulty, comment, created_at
from public.game_feedback
order by created_at desc
limit 100;
```

Correspondance des appréciations :

- `hard` : trop difficile ;
- `fair` : bien dosé ;
- `easy` : trop facile.

Le commentaire est facultatif et limité à 1 000 caractères. Les votes et commentaires restent aussi dans le journal local et l’export du joueur.

## Exploitation publique

L’insertion d’avis sans compte est pratique pour un petit jeu, mais ne remplace pas une protection anti-spam. En cas de forte fréquentation, faire passer les avis par une **Edge Function avec CAPTCHA et limitation de débit**, puis retirer l’accès direct en insertion à `anon`.
