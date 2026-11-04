-- Test transactionnel des Duels de la Nuit noire.
-- S'exécute intégralement dans une transaction terminée par ROLLBACK :
-- aucun utilisateur, profil ou duel de test ne subsiste après exécution.

begin;

do $$
declare
  v_u1 uuid := '00000000-0000-4000-8000-00000000d001';
  v_u2 uuid := '00000000-0000-4000-8000-00000000d002';
  v_u3 uuid := '00000000-0000-4000-8000-00000000d003';
  v_team_count_before bigint := 0;
  v_team_count_after bigint := 0;
  v_duel1 uuid;
  v_duel2 uuid;
  v_duel3 uuid;
  v_duel4 uuid;
  v_duel5 uuid;
  v_res jsonb;
  v_p1 jsonb;
  v_p2 jsonb;
  v_err text;
begin
  -- 1. Vérification RLS et privilèges de tables / fonctions.
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('duel_profiles', 'duels')
      and not c.relrowsecurity
  ) then
    raise exception 'RLS doit être activé sur duel_profiles et duels';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('duel_profiles', 'duels')
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'Aucun accès direct aux tables duel_profiles et duels ne doit être accordé';
  end if;

  if exists (
    select 1
    from information_schema.role_routine_grants
    where specific_schema = 'public'
      and routine_name like 'minuit_duel_%'
      and grantee = 'anon'
  ) then
    raise exception 'Aucune RPC de duel ne doit être exécutable par anon';
  end if;

  if to_regclass('public.team_scores') is not null then
    execute 'select count(*) from public.team_scores' into v_team_count_before;
  end if;

  -- 2. Appel sans authentification rejeté.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.minuit_duel_profile();
    raise exception 'Appel non authentifié aurait dû échouer';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if position('Connexion requise' in v_err) = 0 then
      raise exception 'Erreur inattendue sans auth: %', v_err;
    end if;
  end;

  -- 3. Utilisateurs éphémères pour la transaction.
  insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_u1, 'duel-test-1@minuit.invalid', '{"display_name":"Séléné"}'::jsonb, now(), now()),
    (v_u2, 'duel-test-2@minuit.invalid', '{"display_name":"Nyx"}'::jsonb, now(), now()),
    (v_u3, 'duel-test-3@minuit.invalid', '{"display_name":"Intruse"}'::jsonb, now(), now());

  -- Profil initial : cote 1000, 20 éclats, halo-violet.
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  v_p1 := public.minuit_duel_profile();
  if (v_p1->>'rating')::int <> 1000
    or (v_p1->>'shards')::int <> 20
    or (v_p1->>'equipped') <> 'halo-violet'
  then
    raise exception 'Profil initial invalide: %', v_p1;
  end if;

  -- 4. Duel classé #1 avec mise de 10 éclats chacun (pot de 20).
  v_res := public.minuit_duel_create('ranked', 10);
  v_duel1 := (v_res->'duel'->>'id')::uuid;

  -- Auto-join interdit.
  begin
    perform public.minuit_duel_join(v_duel1);
    raise exception 'Auto-join aurait dû échouer';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if position('propre duel' in v_err) = 0 then
      raise exception 'Erreur auto-join inattendue: %', v_err;
    end if;
  end;

  -- Intruse bloquée sur le statut.
  perform set_config('request.jwt.claim.sub', v_u3::text, true);
  begin
    perform public.minuit_duel_status(v_duel1);
    raise exception 'Lecture tierce aurait dû échouer';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if position('réservé à ses invités' in v_err) = 0 then
      raise exception 'Erreur lecture tierce inattendue: %', v_err;
    end if;
  end;

  -- Nyx rejoint : passage en draft et prélèvement de 10 éclats chacun.
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  v_res := public.minuit_duel_join(v_duel1);
  if v_res->'duel'->>'status' <> 'draft' then
    raise exception 'Statut draft attendu: %', v_res;
  end if;
  -- Join idempotent pour l'invitée déjà inscrite.
  v_res := public.minuit_duel_join(v_duel1);
  if (v_res->'players'->1->>'shards')::int <> 10 then
    raise exception 'Prélèvement de mise invalide: %', v_res;
  end if;

  -- Validation serveur du draft (3 atouts distincts parmi les 10 autorisés).
  begin
    perform public.minuit_duel_ready(v_duel1, array['comet-boots', 'comet-boots', 'dawn-halo']);
    raise exception 'Doublon d’atouts aurait dû échouer';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if position('trois atouts différents' in v_err) = 0 then
      raise exception 'Erreur doublon inattendue: %', v_err;
    end if;
  end;

  begin
    perform public.minuit_duel_ready(v_duel1, array['comet-boots', 'dawn-halo', 'arsenal-forbidden']);
    raise exception 'Atout inconnu aurait dû échouer';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if position('trois atouts différents' in v_err) = 0 then
      raise exception 'Erreur atout inconnu inattendue: %', v_err;
    end if;
  end;

  v_res := public.minuit_duel_ready(v_duel1, array['comet-boots', 'dawn-halo', 'fleeting-dash']);
  if v_res->'duel'->>'status' <> 'draft' then
    raise exception 'Un seul joueur prêt ne doit pas activer le duel';
  end if;

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  v_res := public.minuit_duel_ready(v_duel1, array['twin-burst', 'ember-heart', 'wide-wave']);
  if v_res->'duel'->>'status' <> 'active' then
    raise exception 'Les deux joueurs prêts doivent activer le duel';
  end if;

  -- Consensus à deux rapports identiques et idempotence.
  v_res := public.minuit_duel_finish(v_duel1, v_u1);
  if v_res->'duel'->>'status' <> 'active' then
    raise exception 'Un seul rapport ne doit pas clôturer le duel';
  end if;

  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  v_res := public.minuit_duel_finish(v_duel1, v_u2);
  if v_res->'duel'->>'status' <> 'active' then
    raise exception 'Deux rapports divergents ne doivent pas clôturer le duel';
  end if;

  v_res := public.minuit_duel_finish(v_duel1, v_u1);
  if v_res->'duel'->>'status' <> 'completed'
    or (v_res->'duel'->>'ratingDelta')::int <> 20
    or (v_res->'players'->0->>'rating')::int <> 1020
    or (v_res->'players'->1->>'rating')::int <> 980
    or (v_res->'players'->0->>'shards')::int <> 32
  then
    raise exception 'Clôture du duel #1 invalide: %', v_res;
  end if;

  -- Appel finish répété : strictement idempotent.
  v_res := public.minuit_duel_finish(v_duel1, v_u1);
  if (v_res->'players'->0->>'rating')::int <> 1020
    or (v_res->'players'->0->>'shards')::int <> 32
    or (v_res->'players'->0->>'wins')::int <> 1
  then
    raise exception 'Idempotence de minuit_duel_finish violée: %', v_res;
  end if;

  -- 5. Cosmétiques uniquement : déblocage et équipement d'un halo avec éclats.
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  v_p1 := public.minuit_duel_unlock('halo-aurora');
  v_p1 := public.minuit_duel_equip('halo-aurora');
  if (v_p1->>'shards')::int <> 2 or (v_p1->>'equipped') <> 'halo-aurora' then
    raise exception 'Déblocage/équipement de halo invalide: %', v_p1;
  end if;

  -- 6. Duel classé #2 : écart >= 150 (+30 / -30) et abandon actif compté comme défaite.
  update public.duel_profiles set rating = 1200 where user_id = v_u2;
  v_res := public.minuit_duel_create('ranked', 0);
  v_duel2 := (v_res->'duel'->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform public.minuit_duel_join(v_duel2);
  perform public.minuit_duel_ready(v_duel2, array['swift-powder', 'prism-fan', 'soft-steps']);
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform public.minuit_duel_ready(v_duel2, array['short-lance', 'wide-wave', 'comet-boots']);

  -- Annulation sans forfait interdite en classé actif.
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  begin
    perform public.minuit_duel_cancel(v_duel2, false);
    raise exception 'Annulation sèche en classé actif aurait dû échouer';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if position('terminé ou abandonné' in v_err) = 0 then
      raise exception 'Erreur annulation classé inattendue: %', v_err;
    end if;
  end;

  -- Abandon actif de u2 (1200) face à u1 (1020) -> victoire de u1 avec delta +30 / -30.
  v_res := public.minuit_duel_cancel(v_duel2, true);
  if v_res->'duel'->>'status' <> 'completed'
    or (v_res->'duel'->>'winnerId')::uuid <> v_u1
    or (v_res->'duel'->>'ratingDelta')::int <> 30
    or (v_res->'players'->0->>'rating')::int <> 1050
    or (v_res->'players'->1->>'rating')::int <> 1170
    or (v_res->'players'->1->>'losses')::int <> 2
  then
    raise exception 'Abandon actif ou calcul +30/-30 invalide: %', v_res;
  end if;

  -- 7. Limite de 2 duels classés par jour et par paire (Europe/Paris).
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  v_res := public.minuit_duel_create('ranked', 0);
  v_duel3 := (v_res->'duel'->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  begin
    perform public.minuit_duel_join(v_duel3);
    raise exception 'Un 3e duel classé le même jour aurait dû être refusé';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if position('Deux duels classés déjà joués' in v_err) = 0 then
      raise exception 'Erreur plafond quotidien inattendue: %', v_err;
    end if;
  end;

  -- 8. Le duel amical reste autorisé après le plafond et ne modifie ni cote ni bilan classé.
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  v_res := public.minuit_duel_create('friendly', 0);
  v_duel4 := (v_res->'duel'->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform public.minuit_duel_join(v_duel4);
  perform public.minuit_duel_ready(v_duel4, array['comet-boots', 'twin-burst', 'dawn-halo']);
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform public.minuit_duel_ready(v_duel4, array['fleeting-dash', 'ember-heart', 'soft-steps']);
  perform public.minuit_duel_finish(v_duel4, v_u2);
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  v_res := public.minuit_duel_finish(v_duel4, v_u2);
  if v_res->'duel'->>'status' <> 'completed'
    or (v_res->'duel'->>'ratingDelta')::int <> 0
    or (v_res->'players'->0->>'rating')::int <> 1050
    or (v_res->'players'->1->>'rating')::int <> 1170
    or (v_res->'players'->0->>'losses')::int <> 0
    or (v_res->'players'->1->>'wins')::int <> 0
  then
    raise exception 'Le duel amical ne doit modifier ni cote ni bilan classé: %', v_res;
  end if;

  -- 9. Vérification du palier +10 / -10 contre un adversaire nettement plus faible (>= 150).
  update public.duel_profiles set rating = 1300 where user_id = v_u1;
  update public.duel_profiles set rating = 1000 where user_id = v_u3;
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  v_res := public.minuit_duel_create('ranked', 0);
  v_duel5 := (v_res->'duel'->>'id')::uuid;
  perform set_config('request.jwt.claim.sub', v_u3::text, true);
  perform public.minuit_duel_join(v_duel5);
  perform public.minuit_duel_ready(v_duel5, array['comet-boots', 'twin-burst', 'dawn-halo']);
  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform public.minuit_duel_ready(v_duel5, array['fleeting-dash', 'ember-heart', 'soft-steps']);
  perform public.minuit_duel_finish(v_duel5, v_u1);
  perform set_config('request.jwt.claim.sub', v_u3::text, true);
  v_res := public.minuit_duel_finish(v_duel5, v_u1);
  if (v_res->'duel'->>'ratingDelta')::int <> 10
    or (v_res->'players'->0->>'rating')::int <> 1310
    or (v_res->'players'->1->>'rating')::int <> 990
  then
    raise exception 'Calcul +10/-10 invalide: %', v_res;
  end if;

  if to_regclass('public.team_scores') is not null then
    execute 'select count(*) from public.team_scores' into v_team_count_after;
    if v_team_count_after <> v_team_count_before then
      raise exception 'Les highscores de team ne doivent jamais être modifiés';
    end if;
  end if;
end $$;

rollback;
