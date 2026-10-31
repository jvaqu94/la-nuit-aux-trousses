-- La Nuit aux Trousses — conservation des highscores de team antérieurs au mode classé.
-- À appliquer une seule fois après 20261031113625_ranked_team_scores_only.
--
-- Cette bascule a filtré le tableau sur mode = 'ranked' sans reclasser les
-- highscores déjà enregistrés en mode 'free'. Ils restaient donc en base mais
-- disparaissaient de Compte & team. Seuls les enregistrements antérieurs à ce
-- changement sont migrés ; leurs points et leur progression sont inchangés.
--
-- Les tentatives ne sont volontairement pas modifiées : les anciennes parties
-- classiques ne sont ni ajoutées aux statistiques classées ni déduites des
-- nouveaux quotas quotidiens. Après cette migration, seules les nouvelles
-- parties classées peuvent alimenter le classement de team.

update public.team_scores
set mode = 'ranked'
where mode = 'free'
  and updated_at < '2026-10-31 11:36:25+00'::timestamptz;
