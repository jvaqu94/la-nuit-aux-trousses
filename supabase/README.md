# Configurer Supabase

Le jeu reste utilisable localement sans Supabase. Le cloud ajoute une sauvegarde distante optionnelle, des teams avec highscores privés et l’envoi privé des avis de difficulté.

## État de cette installation

Le projet `fkdijgrmgnbpybcfowpr` est configuré dans `supabase-config.js`. Les migrations `20261025104836_la_nuit_cloud_saves_feedback`, `20261025110755_minuit_teams_and_highscores`, `20261025112049_minuit_team_admin_rules`, `20261025125012_minuit_team_deletion` et `20261029132000_minuit_team_stats` sont appliquées, ainsi que `add_weekly_sprint_team_scores` pour le classement Sprint séparé, `20261031113625_ranked_team_scores_only` pour réserver la campagne aux parties classées, `20261102140000_team_ranked_period_history` pour les podiums et périodes archivées, et `20261103230930_night_duels` suivie de `20261103232247_night_duels_harden_grants` pour le Duel de la Nuit noire ; toutes les tables ont RLS activé. L’authentification e-mail et la confirmation d’adresse restent activées pour les comptes e-mail existants. La fonction **`pseudo-auth` version 1 est déployée et active avec `verify_jwt=false`** pour les accès par pseudo sans e-mail. Seule la clé publiable est utilisée par le navigateur ; la clé `service_role` reste dans l’environnement privé de la fonction.

Les sections suivantes servent de procédure de maintenance ou de réinstallation sur un autre projet.

## 1. Créer les tables

Dans le **SQL Editor** du projet Supabase, exécuter le fichier [`schema.sql`](schema.sql).

Il crée :

- `public.game_saves` : un emplacement de sauvegarde par utilisateur authentifié, protégé par RLS avec `auth.uid()` ;
- `public.game_feedback` : les appréciations et commentaires d’équilibrage, accessibles en insertion seulement depuis le jeu.

Les avis n’ont **aucune politique de lecture publique**. Ils se consultent depuis le tableau de bord Supabase ou avec une clé secrète conservée sur un serveur d’administration.

Pour activer les teams, exécuter également [`teams.sql`](teams.sql), puis [`team_rules.sql`](team_rules.sql), [`team_stats.sql`](team_stats.sql) et [`team_periods.sql`](team_periods.sql). Ils créent `teams`, `team_members`, `team_scores`, `team_score_attempts`, `team_ranked_periods` et `team_ranked_period_scores`, toutes protégées par RLS et sans accès direct pour `anon` ou `authenticated`. Seules des fonctions authentifiées sont exposées : consulter sa team, créer, rejoindre, quitter, modifier les règles en tant qu’admin, réinitialiser la campagne, supprimer la team en tant qu’admin, transmettre un score et consulter les statistiques en tant qu’admin.

Sur une installation qui possédait déjà des highscores avant la bascule `20261031113625_ranked_team_scores_only`, appliquer une fois [`team_legacy_highscores.sql`](team_legacy_highscores.sql). Cette migration conserve les anciens records dans le tableau sans changer leurs points. Elle ne reclassifie pas les tentatives : les quotas et les nouveaux scores de team restent réservés aux parties classées, tandis que les anciennes classiques peuvent être lues comme activité sans changer leur mode. La migration `20261031183500_restore_legacy_team_highscores` est appliquée sur ce projet.

Pour le Sprint hebdomadaire, exécuter ensuite [`weekly_sprint.sql`](weekly_sprint.sql). Ce fichier crée `team_weekly_sprints` et les RPC `minuit_weekly_sprint_board(date)` et `minuit_submit_weekly_sprint(date, text, integer, integer, integer, boolean)`. Ce classement amical conserve le meilleur score de chaque membre pour la semaine courante, dans une table séparée de la campagne. Il ne consomme aucune partie quotidienne et ne modifie pas les highscores `free`, `ranked` ou `daily`. La table est protégée par RLS, sans accès direct ; seules les deux fonctions authentifiées sont exposées.

Pour le **Duel de la Nuit noire** (1 contre 1 en direct), exécuter [`night_duels.sql`](night_duels.sql). Ce script crée `public.duel_profiles` et `public.duels` avec RLS activé et aucun privilège direct accordé à `anon` ou `authenticated`. Toutes les opérations passent par des RPC `security definer` réservées à `authenticated` qui vérifient `auth.uid()` (`minuit_duel_profile`, `minuit_duel_create`, `minuit_duel_join`, `minuit_duel_status`, `minuit_duel_ready`, `minuit_duel_finish`, `minuit_duel_cancel`, `minuit_duel_unlock`, `minuit_duel_equip`). Les échanges temps réel transitent par un canal Realtime dédié par duel (`realtime:duel:<uuid>`) où la créatrice arbitre la simulation et n’envoie jamais les coordonnées cachées à l’invitée. La cote de duel commence à `1000` (`±20` proche, `±30` contre `>= 150` au-dessus, `±10` contre `>= 150` en dessous), plafonnée à 2 duels classés par jour et par paire (`Europe/Paris`), avec consensus à deux rapports identiques et idempotents, abandon actif compté comme défaite classée, mise optionnelle de 10 éclats de lune chacun (pot de 20) et halos strictement cosmétiques — sans jamais toucher aux scores de campagne ou aux highscores de team. **Invitation dans l’application** : réexécuter [`night_duels.sql`](night_duels.sql) (idempotent) ajoute `public.duel_invitations` (RLS, aucun privilège direct) et les RPC `minuit_duel_invite`, `minuit_duel_invitations`, `minuit_duel_sent_invitations`, `minuit_duel_invite_respond`, `minuit_duel_invite_cancel`. L’expéditrice saisit un pseudo ; le serveur le résout en interne via la même empreinte déterministe que `pseudo-auth` (`sha256('la-nuit-pseudo-v1:'||lower(NFKC(pseudo)))` → e-mail technique `player-…@players.minuit.invalid`, repli sur `display_name` unique), sans exposer de table publique pseudo → e-mail. L’invitée connectée interroge `minuit_duel_invitations` (toutes les 15 s, au focus et au retour en ligne) et voit un popup « Rejoindre / Refuser » ; accepter délègue à `minuit_duel_join` (mêmes garde-fous : mise, quota classé, duel encore ouvert). Les invitations expirent après 10 minutes et deviennent invalides dès que le duel quitte l’état `waiting`. Le lien, l’UUID et le QR code restent fonctionnels en parallèle. **Invitation depuis la team** : les RPC `minuit_duel_team_players(p_duel uuid default null)` et `minuit_duel_invite_member(p_duel uuid, p_member uuid)` listent les membres de la même team et invitent directement par identifiant de membre, sans ressaisir le pseudo (évite homonymes et renommages). La liste n’est visible que par les membres de cette team ; l’invitation vérifie côté serveur que l’expéditrice et la cible appartiennent à la même team, puis réutilise les mêmes garde-fous que l’invitation par pseudo. Les membres déjà en duel, déjà invités, soi-même et le quota classé atteint sont signalés indisponibles. L’invitation par pseudo reste disponible.

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
2. **la synchronisation est automatique dans les deux sens** : à la connexion, la sauvegarde locale est envoyée si le cloud est vide, sinon la sauvegarde cloud est récupérée automatiquement (entraînement, scores, réglages, team) ;
3. les changements suivants sont envoyés automatiquement, au maximum toutes les 30 secondes ;
4. sur un autre appareil, il suffit de se connecter avec le même accès pour retrouver sa progression — aucun bouton obligatoire. **Envoyer ma progression** et **Récupérer le cloud** restent disponibles pour forcer une action. L’entraînement obligatoire suit le profil : s’il a déjà commencé/terminé une partie ou terminé l’entraînement, il n’est pas redemandé. Les anciennes sauvegardes sont normalisées à partir des traces de partie existantes, et une journée vide créée par le menu sur un appareil neuf n’est pas considérée comme une progression locale divergente.

La restauration automatique réutilise la validation de l’import JSON et conserve une copie locale de secours (`minuit-import-rollback`) avant remplacement ; elle ne demande pas de confirmation quand l’appareil n’a pas de progression locale à perdre. Un compte possède un seul emplacement.

**Protection contre l’écrasement :** le client mémorise l’état de la dernière synchronisation (`minuit-cloud-sync-v1`) et la date de dernière modification locale (`minuit-cloud-touched-v1`). Si le cloud a changé depuis la dernière synchro et que l’appareil n’a rien de neuf, il récupère le cloud. Si les deux côtés ont changé, il demande lequel conserver (synchro manuelle) ou diffère la décision (synchro automatique) — il n’écrase jamais silencieusement une sauvegarde plus récente venue d’un autre appareil. Ces clés ne contiennent ni session ni mot de passe et ne sont pas incluses dans les exports.

Le mot de passe n’est jamais enregistré par le jeu. La session Supabase reste dans une clé `localStorage` séparée et n’est jamais incluse dans une sauvegarde JSON ou cloud.

## 5. Utiliser les teams et les highscores

Après connexion, le panneau **Team & highscore** permet de créer ou rejoindre une team. Les entrées **Classée** de l’accueil restent masquées tant que la team n’est pas confirmée, puis apparaissent automatiquement. Le panneau permet de :

1. choisir un pseudo de 2 à 24 caractères ;
2. à la création, définir la limite quotidienne et, si nécessaire, la période de jeu ;
3. préparer une invitation par e-mail avec destinataire, objet, code et lien préremplis, ou partager sur mobile le lien `?team=CODE` par WhatsApp ou Messenger ; l’e-mail ouvre la messagerie sans enregistrer le destinataire et le lien ne contient aucun jeton de session. À son ouverture, la carte d’invitation affiche le code avant toute connexion, le conserve dans `sessionStorage` après nettoyage de l’URL et propose de rejoindre directement avec un pseudo et un mot de passe ;
4. terminer un vol classé pour transmettre son score, ou une classique pour transmettre uniquement son activité au suivi privé du créateur ;
5. consulter le meilleur score classé de chaque membre, le total et les parties classées restantes.

Le créateur est **administrateur**. Lui seul peut ouvrir **Règles administrateur** pour modifier la limite de 1 à 100 parties par jour, ou illimité, et les dates/heures de début et de fin. Il peut aussi choisir **Supprimer la team** : le RPC `minuit_delete_team()` vérifie `created_by = auth.uid()` et les cascades effacent membres, scores et tentatives. S’il quitte la team sans la supprimer, le membre le plus ancien devient administrateur.

**Prolonger / enregistrer cette période** modifie ses dates ou sa limite sans changer son numéro, ses highscores ni son classement. **Archiver et lancer une nouvelle période** remplace par maintenant une date de début laissée identique à l’ancienne, vérifie une échéance future (ou absente), verrouille la team, enregistre le podium et le tableau complet dans `team_ranked_period_scores`, puis remet uniquement les highscores courants à zéro. Les membres, le code d’invitation, les tentatives d’activité et le quota du jour sont conservés. Une team reste joignable à tout moment, y compris après l’échéance. Tous les membres peuvent consulter toutes les périodes archivées avec `minuit_team_period_history()` ; aucun accès direct aux tables n’est accordé. La remise à zéro complète de la campagne efface aussi ces archives, ce qui est indiqué dans sa confirmation.

Le bouton **Statistiques de la team**, visible uniquement par l’administrateur, ouvre une synthèse sur 7, 30, 90 ou 365 jours : tous les vols classiques et classés transmis, parties et points répartis par mode, activité par jour et par membre, derniers vols et 50 vols récents. Le RPC `minuit_team_stats(integer)` revérifie `teams.created_by = auth.uid()` avant chaque lecture. Les **points gagnés** additionnent les scores `free` et `ranked` pour mesurer l’activité ; ce total privé n’est pas le score de la team. Les champs `rankedGames`, `freeGames`, `rankedPoints` et `freePoints` permettent de repérer les joueurs qui oublient la classée. Les highscores actuels restent strictement `ranked` et sont renvoyés séparément. Les membres sans vol restent visibles avec des compteurs à zéro ; aucun e-mail ou identifiant de connexion n’est inclus.

Sur une base existante, réappliquer d’abord [`team_rules.sql`](team_rules.sql), puis [`team_stats.sql`](team_stats.sql), pour activer l’envoi d’activité classique et la répartition complète. Exécuter ensuite [`team_periods.sql`](team_periods.sql) pour les podiums et l’historique. Ces scripts remplacent les fonctions sans réécrire les tentatives ou les highscores existants ; la migration des périodes conserve notamment le classement de la période en cours.

La limite suit le jour **Europe/Paris**. Chaque vol classé accepté consomme une tentative, même si son score n’améliore pas le record. Les parties classiques sont enregistrées dans `team_score_attempts` pour le suivi uniquement : le RPC renvoie `activityOnly=true`, sans écriture dans `team_scores`, sans consommation du quota et sans dépendance à la période classée. Les défis quotidiens ne sont pas envoyés à la team. Le `run_id` est unique dans la team pour éviter un double comptage lors d’un renvoi réseau. Hors période ou au-delà de la limite, le score classé est refusé mais le jeu local et l’envoi d’activité classique restent accessibles.

**File d’attente côté client :** si l’envoi d’un vol échoue pour une raison transitoire (réseau, délai dépassé, serveur, session à renouveler), le client le conserve dans `minuit-team-pending-v1` (30 vols max, 3 jours) et le renvoie automatiquement au retour du réseau, à la connexion suivante, après un envoi réussi, ou via **Renvoyer maintenant** dans la carte de team. Le `run_id` unique garantit qu’un renvoi ne compte pas deux fois. Les refus « règles » (`TEAM_PERIOD_ENDED`, `TEAM_DAILY_LIMIT`, `TEAM_RULES_REQUIRED`, etc.) ne sont pas mis en file car ils ne changeraient pas. Un échec de chargement de `minuit_team_state` ne saute plus l’envoi : le RPC est tenté quand même et répond `NOT_IN_TEAM` le cas échéant. Aucune migration n’est nécessaire pour ce comportement (uniquement `supabase.js`).

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

Pour le parcours renforcé de la **Course aux bonbons**, exécuter [`candy_sprint_v5.sql`](candy_sprint_v5.sql). Son classement compte les bonbons récoltés et reste séparé des parcours précédents ([`candy_sprint.sql`](candy_sprint.sql), [`candy_sprint_v2.sql`](candy_sprint_v2.sql), [`candy_sprint_v3.sql`](candy_sprint_v3.sql), [`candy_sprint_v4.sql`](candy_sprint_v4.sql)) et des anciennes courses. Sans déploiement, les records locaux restent utilisables mais le classement de team est indisponible.

Les schémas [`ring_sprint.sql`](ring_sprint.sql) et [`broom_sprint.sql`](broom_sprint.sql) conservent les anciens records des courses aux anneaux et de la Chevauchée ; ils ne sont pas nécessaires à la nouvelle course.
