'use strict';
/* Exécute réellement supabase/teams.sql + supabase/night_duels.sql dans PostgreSQL
   WASM (PGlite) et vérifie les invitations dans l'application : résolution du pseudo
   côté serveur (même empreinte que pseudo-auth), liste des membres de la team,
   invitation directe par membre, popup entrant, accepter / refuser / annuler, et les
   garde-fous (soi-même, pseudo inconnu, hors team, duel déjà rejoint, invitation
   déjà traitée). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');
const ALICE = '4b1b47de-40f2-45f4-a62c-0f702d85ba01';
const BOB = '84f2f696-f9f4-4e6f-a25f-62746c598315';
const CAROL = '9a5e2c10-7b3d-4f8a-9c2e-1d6b8a4f0e77';
const TEAM = '7d7e7382-1648-4e34-a6a2-f6d616bd4f75';
const value = input => (typeof input === 'string' ? JSON.parse(input) : input);

function pseudoEmail(name) {
  const normalized = name.normalize('NFKC').trim().toLocaleLowerCase('fr-FR');
  const hex = crypto.createHash('sha256').update('la-nuit-pseudo-v1:' + normalized).digest('hex');
  return 'player-' + hex.slice(0, 40) + '@players.minuit.invalid';
}

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create role anon nologin;
      create role authenticated nologin;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      insert into auth.users(id, email, raw_user_meta_data) values
        ('${ALICE}', '${pseudoEmail('Séléné')}', '{"display_name":"Séléné"}'::jsonb),
        ('${BOB}', '${pseudoEmail('Nyx')}', '{"display_name":"Nyx"}'::jsonb),
        ('${CAROL}', '${pseudoEmail('Morgane')}', '{"display_name":"Morgane"}'::jsonb);
    `);
    await db.exec(fs.readFileSync(path.join(ROOT, 'supabase', 'teams.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(ROOT, 'supabase', 'night_duels.sql'), 'utf8'));
    await db.exec(`
      insert into public.teams(id, name, join_code, created_by)
      values ('${TEAM}', 'Les Nocturnes', 'ABCDE23456', '${ALICE}');
      insert into public.team_members(team_id, user_id, display_name)
      values ('${TEAM}', '${ALICE}', 'Séléné'), ('${TEAM}', '${BOB}', 'Nyx');
    `);

    const asUser = id => db.exec(`select set_config('request.jwt.claim.sub', '${id}', false);`);
    const rpc = async (fn, params = []) => {
      const placeholders = params.map((_, i) => `$${i + 1}`).join(',');
      const response = await db.query(`select public.${fn}(${placeholders}) as result`, params);
      return value(response.rows[0].result);
    };
    const expectError = async (fn, params, message) => {
      await assert.rejects(() => rpc(fn, params), err => {
        assert.ok(String(err.message).includes(message), `attendu « ${message} », reçu « ${err.message} »`);
        return true;
      });
    };

    // 1. La créatrice crée un duel puis invite « Nyx » par pseudo.
    await asUser(ALICE);
    const created = await rpc('minuit_duel_create', ['friendly', 0]);
    const duelId = created.duel.id;
    const invited = await rpc('minuit_duel_invite', [duelId, '  nyx  ']);
    assert.equal(invited.invitation.toUser, BOB, 'le pseudo doit être résolu vers le bon utilisateur');
    assert.equal(invited.invitation.fromUser, ALICE);
    assert.equal(invited.invitation.status, 'pending');
    assert.equal(invited.invitation.fromName, 'Séléné');
    assert.equal(invited.duel.duel.status, 'waiting');

    // Idempotence : réinviter le même pseudo ne crée pas de doublon pending.
    const invitedAgain = await rpc('minuit_duel_invite', [duelId, 'Nyx']);
    assert.equal(invitedAgain.invitation.id, invited.invitation.id, 'une seule invitation pending par duel/invité');

    // Garde-fous côté expéditeur.
    await expectError('minuit_duel_invite', [duelId, 'Séléné'], 'toi-même');
    await expectError('minuit_duel_invite', [duelId, 'Inconnue'], 'introuvable');

    // 2. L'invité voit l'invitation entrante (ce qui alimente le popup).
    await asUser(BOB);
    const incoming = await rpc('minuit_duel_invitations');
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0].duelId, duelId);
    assert.equal(incoming[0].fromName, 'Séléné');
    assert.equal(incoming[0].mode, 'friendly');

    // L'invité ne peut pas inviter sur le duel d'autrui.
    await expectError('minuit_duel_invite', [duelId, 'Séléné'], 'créatrice');

    // 3. Accepter rejoint le duel (draft) et vide la file d'invitations.
    const accepted = await rpc('minuit_duel_invite_respond', [invited.invitation.id, true]);
    assert.equal(accepted.invitation.status, 'accepted');
    assert.equal(accepted.duel.duel.status, 'draft');
    assert.equal(accepted.duel.duel.opponentId, BOB);
    const incomingAfter = await rpc('minuit_duel_invitations');
    assert.equal(incomingAfter.length, 0, 'plus d’invitation pending une fois le duel rejoint');

    // Une invitation déjà traitée ne peut pas être rejouée.
    await expectError('minuit_duel_invite_respond', [invited.invitation.id, true], 'déjà traitée');

    // 4. Refuser : le duel reste waiting, l'invitation sort de la file.
    await asUser(ALICE);
    const created2 = await rpc('minuit_duel_create', ['friendly', 0]);
    const invited2 = await rpc('minuit_duel_invite', [created2.duel.id, 'Nyx']);
    await asUser(BOB);
    const declined = await rpc('minuit_duel_invite_respond', [invited2.invitation.id, false]);
    assert.equal(declined.invitation.status, 'declined');
    assert.equal((await rpc('minuit_duel_invitations')).length, 0);
    await asUser(ALICE);
    const status2 = await rpc('minuit_duel_status', [created2.duel.id]);
    assert.equal(status2.duel.status, 'waiting', 'un refus ne rejoint pas le duel');

    // 5. Annuler côté expéditeur.
    const invited3 = await rpc('minuit_duel_invite', [created2.duel.id, 'Nyx']);
    const cancelled = await rpc('minuit_duel_invite_cancel', [invited3.invitation.id]);
    assert.equal(cancelled.invitation.status, 'cancelled');
    await asUser(BOB);
    assert.equal((await rpc('minuit_duel_invitations')).length, 0);

    // 6. Liste des membres de la team : uniquement sa propre team, soi marqué,
    //    et invitation directe par identifiant de membre (sans pseudo).
    await asUser(ALICE);
    await rpc('minuit_duel_cancel', [duelId, false]); // libère Nyx du draft précédent
    const roster = await rpc('minuit_duel_team_players', [null]);
    assert.equal(roster.team.name, 'Les Nocturnes');
    assert.equal(roster.players.length, 2, 'la liste ne contient que les membres de la team');
    const me = roster.players.find(p => p.id === ALICE);
    const nyx = roster.players.find(p => p.id === BOB);
    assert.equal(me.isYou, true);
    assert.equal(me.canInvite, false, 'on ne se défie pas soi-même');
    assert.equal(nyx.canInvite, true);
    assert.equal(nyx.availability, 'Disponible');
    assert.ok(!roster.players.some(p => p.id === CAROL), 'un joueur hors team n’apparaît pas');

    await asUser(CAROL);
    const outsiderRoster = await rpc('minuit_duel_team_players', [null]);
    assert.equal(outsiderRoster.team, null);
    assert.equal(outsiderRoster.players.length, 0);

    await asUser(ALICE);
    const createdTeamDuel = await rpc('minuit_duel_create', ['friendly', 0]);
    const teamDuelId = createdTeamDuel.duel.id;
    const rosterForDuel = await rpc('minuit_duel_team_players', [teamDuelId]);
    assert.equal(rosterForDuel.players.find(p => p.id === BOB).canInvite, true);

    const memberInvite = await rpc('minuit_duel_invite_member', [teamDuelId, BOB]);
    assert.equal(memberInvite.invitation.toUser, BOB);
    assert.equal(memberInvite.invitation.status, 'pending');
    const memberInviteAgain = await rpc('minuit_duel_invite_member', [teamDuelId, BOB]);
    assert.equal(memberInviteAgain.invitation.id, memberInvite.invitation.id, 'invitation membre idempotente');
    const rosterPending = await rpc('minuit_duel_team_players', [teamDuelId]);
    const nyxPending = rosterPending.players.find(p => p.id === BOB);
    assert.equal(nyxPending.invitationStatus, 'pending');
    assert.equal(nyxPending.canInvite, false, 'un membre déjà invité ne se réinvite pas');
    assert.equal(nyxPending.availability, 'Invitation envoyée');

    await expectError('minuit_duel_invite_member', [teamDuelId, CAROL], 'pas partie de ta team');
    await expectError('minuit_duel_invite_member', [teamDuelId, ALICE], 'toi-même');
    await asUser(CAROL);
    await expectError('minuit_duel_invite_member', [teamDuelId, BOB], 'pas encore dans une team');
    await asUser(BOB);
    await expectError('minuit_duel_invite_member', [teamDuelId, ALICE], 'créatrice');

    const memberIncoming = await rpc('minuit_duel_invitations');
    assert.equal(memberIncoming.length, 1);
    assert.equal(memberIncoming[0].duelId, teamDuelId);
    const memberAccepted = await rpc('minuit_duel_invite_respond', [memberInvite.invitation.id, true]);
    assert.equal(memberAccepted.duel.duel.status, 'draft');
    assert.equal(memberAccepted.duel.duel.opponentId, BOB);

    await asUser(ALICE);
    const rosterBusy = await rpc('minuit_duel_team_players', [null]);
    const nyxBusy = rosterBusy.players.find(p => p.id === BOB);
    assert.equal(nyxBusy.canInvite, false, 'un membre déjà en duel est signalé indisponible');
    assert.equal(nyxBusy.availability, 'En duel');

    console.log('OK : invitations de duel — pseudo, liste des membres de la team, invitation directe, popup entrant, accepter/refuser/annuler et garde-fous.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await db.close();
  }
})();
