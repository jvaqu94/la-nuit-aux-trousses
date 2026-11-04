'use strict';

const assert = require('node:assert/strict');
const Core = require('../duel-core.js');

// 1. Catalogue de 10 atouts et validation du draft de 3 atouts distincts.
assert.equal(Core.PERK_CATALOG.length, 10, 'Le catalogue doit compter 10 atouts');
const expectedIds = [
  'comet-boots',
  'twin-burst',
  'swift-powder',
  'prism-fan',
  'dawn-halo',
  'soft-steps',
  'fleeting-dash',
  'ember-heart',
  'short-lance',
  'wide-wave'
];
assert.deepEqual(Core.PERK_CATALOG.map(p => p.id), expectedIds);

assert.equal(Core.validatePerks(['comet-boots', 'dawn-halo', 'fleeting-dash']).valid, true);
assert.equal(Core.validatePerks(['comet-boots', 'dawn-halo']).valid, false);
assert.equal(Core.validatePerks(['comet-boots', 'comet-boots', 'dawn-halo']).valid, false);
assert.equal(Core.validatePerks(['comet-boots', 'dawn-halo', 'arsenal-laser']).valid, false);

// 2. Extraction d'UUID et partage WhatsApp / Messenger.
const sampleUuid = '123e4567-e89b-42d3-a456-426614174000';
assert.equal(Core.extractDuelId(sampleUuid.toUpperCase()), sampleUuid);
assert.equal(Core.extractDuelId(`https://minuit.example/?team=abc&duel=${sampleUuid}#hash`), sampleUuid);
assert.equal(Core.extractDuelId('pas-un-uuid'), '');
const links = Core.buildShareLinks('https://minuit.example/?team=old', sampleUuid, 'Séléné', 'ranked');
assert.ok(links.inviteUrl.includes(`duel=${sampleUuid}`));
assert.ok(!links.inviteUrl.includes('team=old'));
assert.ok(links.whatsapp.startsWith('https://wa.me/?text='));
assert.ok(links.messenger.startsWith('https://www.facebook.com/sharer/sharer.php?u='));

// 3. Invisibilité hors halo, absence de coordonnées cachées dans les snapshots invité,
//    révélation brève au tir, projectiles toujours visibles et silhouette figée.
{
  const match = Core.createMatch({
    creatorPerks: ['comet-boots', 'dawn-halo', 'fleeting-dash'],
    opponentPerks: ['twin-burst', 'soft-steps', 'wide-wave']
  });
  assert.equal(match.witches.creator.hearts, 5);
  assert.equal(match.witches.opponent.hearts, 5);
  assert.equal(Core.isOpponentVisible(match, 'opponent'), false);

  const initialGuestSnap = Core.createSnapshotFor(match, 'opponent');
  assert.equal(initialGuestSnap.opponent.visible, false);
  assert.equal(initialGuestSnap.opponent.x, null);
  assert.equal(initialGuestSnap.opponent.y, null);
  assert.equal(initialGuestSnap.opponent.aimAngle, null);
  assert.equal(JSON.stringify(initialGuestSnap).includes('"y":730'), false);

  // Aucun tir automatique : même après plusieurs secondes, aucune salve ne part
  // et personne n'est révélé tant que la commande de tir n'est pas maintenue.
  Core.stepMatch(match, 2.5);
  assert.equal(match.projectiles.length, 0, 'Aucun projectile sans commande de tir manuelle');
  assert.equal(match.witches.creator.revealTimer, 0, 'Le créateur ne se révèle pas tout seul');
  assert.equal(match.witches.opponent.revealTimer, 0, "L'invitée ne se révèle pas toute seule");
  assert.equal(Core.createSnapshotFor(match, 'opponent').opponent.visible, false);

  // Tir manuel : 3 projectiles pour creator, 4 pour opponent (twin-burst).
  Core.applyCommand(match, 'creator', { fire: true });
  Core.applyCommand(match, 'opponent', { fire: true });
  Core.stepMatch(match, 0.4);
  const creatorShots = match.projectiles.filter(p => p.ownerRole === 'creator');
  const opponentShots = match.projectiles.filter(p => p.ownerRole === 'opponent');
  assert.equal(creatorShots.length, 3, 'Salve manuelle de base = 3 projectiles');
  assert.equal(opponentShots.length, 4, 'Rafale jumelle = 4 projectiles');
  assert.equal(opponentShots[0].r > creatorShots[0].r, true, 'Onde large élargit les projectiles');

  // Pendant l'éclat du tir, le tireur est brièvement révélé.
  const duringShotSnap = Core.createSnapshotFor(match, 'opponent');
  assert.equal(duringShotSnap.opponent.visible, true);
  assert.notEqual(duringShotSnap.opponent.x, null);
  assert.equal(duringShotSnap.projectiles.length, 7);
  assert.ok(duringShotSnap.self.fireCooldown > 0, 'Le cooldown de tir est exposé au HUD');

  // Relâcher le tir arrête les nouvelles salves ; le créateur se déplace loin pendant que
  // la révélation expire. Les projectiles restent visibles mais les nouvelles coordonnées
  // cachées ne fuitent jamais dans le snapshot invité.
  Core.applyCommand(match, 'creator', { fire: false, moveX: -1, moveY: 0 });
  Core.applyCommand(match, 'opponent', { fire: false });
  Core.stepMatch(match, 1.2);
  const hiddenAgainSnap = Core.createSnapshotFor(match, 'opponent');
  assert.equal(hiddenAgainSnap.opponent.visible, false);
  assert.equal(hiddenAgainSnap.opponent.x, null);
  assert.equal(hiddenAgainSnap.opponent.y, null);
  assert.ok(hiddenAgainSnap.projectiles.length > 0, 'Les projectiles dangereux restent toujours visibles');
  assert.ok(hiddenAgainSnap.lastKnownOpponent, 'Une silhouette subsiste à la dernière position connue');
  assert.notEqual(
    hiddenAgainSnap.lastKnownOpponent.x,
    Math.round(match.witches.creator.x * 10) / 10,
    'La silhouette reste figée et ne suit pas secrètement la sorcière cachée'
  );
}

// 4. Esquive : protection immédiate + reconnaissance à proximité sans contact exact + traînée.
{
  const match = Core.createMatch({
    creatorPerks: ['fleeting-dash', 'comet-boots', 'dawn-halo'],
    opponentPerks: ['short-lance', 'ember-heart', 'swift-powder']
  });
  match.witches.creator.fireCooldown = 99;
  match.witches.opponent.fireCooldown = 99;

  // Projectile passant à proximité (34 px du centre : hors HIT_RADIUS=16+8=24, mais dans DODGE_PROXIMITY_RADIUS=52+8=60).
  match.projectiles.push({
    id: 900,
    ownerRole: 'opponent',
    x: 434,
    y: 700,
    prevX: 434,
    prevY: 700,
    vx: 0,
    vy: 420,
    r: 8,
    damage: 2,
    life: 1.5,
    maxLife: 1.5
  });
  Core.applyCommand(match, 'creator', { dash: true, moveX: 0, moveY: 0 });
  Core.stepMatch(match, 0.16);
  assert.equal(match.witches.creator.hearts, 5, 'Aucun dégât subi');
  assert.equal(match.witches.creator.perfectDodges, 1, 'Esquive reconnue à proximité sans contact exact');
  assert.equal(match.projectiles.length, 1, 'Le projectile de proximité continue sa course sans impact');
  assert.ok(match.dodgeTrails.length >= 1, 'Une traînée d’esquive est émise');

  // Impact direct pendant la garde immédiate d'esquive : 0 dégât.
  const matchDirect = Core.createMatch({
    creatorPerks: ['fleeting-dash', 'comet-boots', 'dawn-halo'],
    opponentPerks: ['short-lance', 'ember-heart', 'swift-powder']
  });
  matchDirect.witches.creator.fireCooldown = 99;
  matchDirect.witches.opponent.fireCooldown = 99;
  matchDirect.projectiles.push({
    id: 901,
    ownerRole: 'opponent',
    x: 400,
    y: 726,
    prevX: 400,
    prevY: 726,
    vx: 0,
    vy: 300,
    r: 8,
    damage: 2,
    life: 1,
    maxLife: 1
  });
  Core.applyCommand(matchDirect, 'creator', { dash: true, moveX: 0, moveY: 1 });
  Core.stepMatch(matchDirect, 1 / 60);
  assert.equal(matchDirect.witches.creator.hearts, 5, 'Protection immédiate dès la frame d’activation');

  // Parade de Cœur de braise : 6 cœurs et premier coup double ramené à 1 dégât.
  assert.equal(matchDirect.witches.opponent.hearts, 6);
  matchDirect.projectiles = [{
    id: 902,
    ownerRole: 'creator',
    x: 400,
    y: 170,
    prevX: 400,
    prevY: 170,
    vx: 0,
    vy: -300,
    r: 8,
    damage: 2,
    life: 1,
    maxLife: 1
  }];
  Core.stepMatch(matchDirect, 1 / 60);
  assert.equal(matchDirect.witches.opponent.hearts, 5, 'La parade absorbe le surplus du premier coup lourd');
}

// 5. Pulsation lunaire (15 s puis 7,5 s après 45 s), rétrécissement > 60 s, mort subite à 90 s et BO3.
{
  const match = Core.createMatch({
    creatorPerks: ['comet-boots', 'dawn-halo', 'fleeting-dash'],
    opponentPerks: ['comet-boots', 'dawn-halo', 'fleeting-dash']
  });
  // Neutralise les tirs pour observer précisément l'horloge d'arène jusqu'à 90 s.
  const holdFire = () => {
    match.witches.creator.fireCooldown = 999;
    match.witches.opponent.fireCooldown = 999;
  };
  holdFire();
  Core.stepMatch(match, 15.05);
  assert.equal(match.lunarPulseCount, 1, '1re pulsation à 15 s');
  assert.equal(Core.isOpponentVisible(match, 'opponent'), true, 'La pulsation révèle les deux sorcières');

  holdFire();
  Core.stepMatch(match, 30.0); // t ~ 45.05 s -> pulsations à 30 s et 45 s
  assert.equal(match.lunarPulseCount, 3, 'Pulsations à 15, 30 et 45 s');

  holdFire();
  Core.stepMatch(match, 7.55); // t ~ 52.6 s -> pulsation accélérée à 52,5 s !
  assert.equal(match.lunarPulseCount, 4, 'Pulsation plus fréquente après 45 s (toutes les 7,5 s)');
  assert.equal(match.zoneRadius, Core.ZONE_INITIAL_RADIUS, 'Pas de rétrécissement avant 60 s');

  holdFire();
  Core.stepMatch(match, 22.5); // t ~ 75.1 s
  assert.ok(match.zoneRadius < Core.ZONE_INITIAL_RADIUS && match.zoneRadius > Core.ZONE_MIN_RADIUS, 'Zone rétrécie après 60 s');
  assert.equal(match.suddenDeath, false);

  holdFire();
  Core.stepMatch(match, 15.0); // t ~ 90.1 s -> Mort subite !
  assert.equal(match.suddenDeath, true, 'Mort subite activée à 90 s');

  // En mort subite, le prochain coup gagne immédiatement la manche.
  match.projectiles.push({
    id: 950,
    ownerRole: 'creator',
    x: match.witches.opponent.x,
    y: match.witches.opponent.y,
    prevX: match.witches.opponent.x,
    prevY: match.witches.opponent.y,
    vx: 0,
    vy: -200,
    r: 10,
    damage: 1,
    life: 1,
    maxLife: 1
  });
  Core.stepMatch(match, 1 / 60);
  assert.equal(match.scores.creator, 1, '1re manche remportée sur le coup de mort subite');
  assert.equal(match.roundPhase, 'intermission');

  // Passage à la manche 2 puis victoire finale en 2 manches gagnantes (best of 3).
  Core.stepMatch(match, 2.6);
  assert.equal(match.round, 2);
  assert.equal(match.roundPhase, 'fighting');
  match.witches.opponent.hearts = 1;
  match.witches.opponent.invTimer = 0;
  match.projectiles.push({
    id: 951,
    ownerRole: 'creator',
    x: match.witches.opponent.x,
    y: match.witches.opponent.y,
    prevX: match.witches.opponent.x,
    prevY: match.witches.opponent.y,
    vx: 0,
    vy: -200,
    r: 10,
    damage: 1,
    life: 1,
    maxLife: 1
  });
  Core.stepMatch(match, 1 / 60);
  assert.equal(match.scores.creator, 2);
  assert.equal(match.roundPhase, 'finished');
  assert.equal(match.winnerRole, 'creator');
}

// 6. Cotes, plafond quotidien Europe/Paris, amical neutre, abandon actif, consensus idempotent, mises et halos.
{
  assert.equal(Core.INITIAL_RATING, 1000);
  assert.equal(Core.computeRatingDelta(1000, 1000, 'ranked'), 20);
  assert.equal(Core.computeRatingDelta(1000, 1150, 'ranked'), 30);
  assert.equal(Core.computeRatingDelta(1200, 1000, 'ranked'), 10);
  assert.equal(Core.computeRatingDelta(1000, 1000, 'friendly'), 0);

  const now = new Date('2026-11-04T21:30:00Z');
  assert.equal(Core.parisDateKey(now), '2026-11-04');

  // Mise de 10 éclats chacun (pot de 20) + consensus à 2 rapports identiques + idempotence.
  const state = Core.createConsensusState({
    creatorId: 'u1',
    opponentId: 'u2',
    mode: 'ranked',
    wager: 10,
    now
  });
  assert.equal(state.profiles.u1.shards, 10);
  assert.equal(state.profiles.u2.shards, 10);

  Core.submitConsensusReport(state, 'u1', 'u1', now);
  assert.equal(state.status, 'active', 'Un seul rapport ne suffit pas');
  Core.submitConsensusReport(state, 'u2', 'u2', now);
  assert.equal(state.status, 'active', 'Rapports divergents ne clôturent pas');
  Core.submitConsensusReport(state, 'u2', 'u1', now);
  assert.equal(state.status, 'completed', 'Deux rapports identiques clôturent le duel');
  assert.equal(state.profiles.u1.rating, 1020);
  assert.equal(state.profiles.u2.rating, 980);
  assert.equal(state.profiles.u1.shards, 32, '10 restants + 2 bonus classé + pot de 20');

  // Appel répété idempotent.
  Core.submitConsensusReport(state, 'u1', 'u1', now);
  assert.equal(state.profiles.u1.rating, 1020);
  assert.equal(state.profiles.u1.shards, 32);

  // Abandon d'un duel classé actif = défaite classée.
  const forfeitState = Core.createConsensusState({
    creatorId: 'u1',
    opponentId: 'u2',
    mode: 'ranked',
    wager: 0,
    creatorProfile: state.profiles.u1,
    opponentProfile: { ...state.profiles.u2, rating: 1200 },
    pairHistory: [state],
    now
  });
  Core.forfeitConsensusState(forfeitState, 'u2', now);
  assert.equal(forfeitState.status, 'completed');
  assert.equal(forfeitState.winnerId, 'u1');
  assert.equal(forfeitState.ratingDelta, 30);
  assert.equal(forfeitState.profiles.u2.losses, 2);

  // 3e duel classé le même jour entre la même paire : refusé -> bascule en amical.
  const gate = Core.canPlayRankedToday([state, forfeitState], now);
  assert.equal(gate.allowed, false);
  assert.throws(() => Core.createConsensusState({
    creatorId: 'u1',
    opponentId: 'u2',
    mode: 'ranked',
    pairHistory: [state, forfeitState],
    now
  }), /Deux duels classés/);

  // Amical autorisé sans modifier ni cote ni bilan classé.
  const friendly = Core.createConsensusState({
    creatorId: 'u1',
    opponentId: 'u2',
    mode: 'friendly',
    creatorProfile: forfeitState.profiles.u1,
    opponentProfile: forfeitState.profiles.u2,
    pairHistory: [state, forfeitState],
    now
  });
  Core.submitConsensusReport(friendly, 'u1', 'u2', now);
  Core.submitConsensusReport(friendly, 'u2', 'u2', now);
  assert.equal(friendly.status, 'completed');
  assert.equal(friendly.ratingDelta, 0);
  assert.equal(friendly.profiles.u1.rating, forfeitState.profiles.u1.rating);
  assert.equal(friendly.profiles.u2.rating, forfeitState.profiles.u2.rating);
  assert.equal(friendly.profiles.u2.wins, forfeitState.profiles.u2.wins);

  // Halos cosmétiques achetés avec les éclats, sans effet sur computeStats.
  let unlocked = Core.unlockHaloInProfile(friendly.profiles.u1, 'halo-aurora');
  unlocked = Core.equipHaloInProfile(unlocked, 'halo-aurora');
  assert.equal(unlocked.equipped, 'halo-aurora');
  const m1 = Core.createMatch({ creatorCosmetic: 'halo-violet', opponentCosmetic: 'halo-aurora' });
  assert.deepEqual(m1.witches.creator.stats, m1.witches.opponent.stats, 'Les halos sont purement cosmétiques');
}

// 7. Orientation d'écran identique : chaque joueuse voit sa sorcière en bas et
//    l'adversaire en haut ; les commandes locales de l'invitée sont converties
//    vers le monde avant arbitrage.
{
  const match = Core.createMatch({
    creatorPerks: ['comet-boots', 'dawn-halo', 'fleeting-dash'],
    opponentPerks: ['comet-boots', 'dawn-halo', 'fleeting-dash']
  });
  const creatorView = Core.orientSnapshotForViewer(Core.createSnapshotFor(match, 'creator'), 'creator');
  const guestView = Core.orientSnapshotForViewer(Core.createSnapshotFor(match, 'opponent'), 'opponent');
  assert.equal(creatorView.self.y, 730, 'La créatrice se voit en bas');
  assert.equal(guestView.self.y, 730, "L'invitée se voit aussi en bas");
  assert.equal(guestView.self.x, 400);
  assert.ok(Math.sin(guestView.self.aimAngle) < -0.999 && Math.abs(Math.cos(guestView.self.aimAngle)) < 0.02, "L'invitée vise vers le haut de son écran");

  const localCmd = { moveX: 1, moveY: -1, aimX: 600, aimY: 200, fire: true, dashSeq: 3 };
  const worldCmd = Core.orientCommandForRole('opponent', localCmd);
  assert.equal(worldCmd.moveX, -1, 'Droite écran invité = gauche monde');
  assert.equal(worldCmd.moveY, 1, 'Haut écran invité = bas monde');
  assert.equal(worldCmd.aimX, 200);
  assert.equal(worldCmd.aimY, 700);
  assert.equal(worldCmd.fire, true);
  assert.equal(worldCmd.dashSeq, 3);
  assert.equal(Core.orientCommandForRole('creator', localCmd), localCmd, 'La créatrice joue déjà en coordonnées monde');

  Core.applyCommand(match, 'opponent', worldCmd);
  Core.stepMatch(match, 0.2);
  assert.ok(match.witches.opponent.x < 400, "L'invitée va à droite de son écran, donc à gauche du monde");
  assert.ok(match.witches.opponent.y > 170, "L'invitée monte vers le centre depuis le haut du monde");
  const guestAfter = Core.orientSnapshotForViewer(Core.createSnapshotFor(match, 'opponent'), 'opponent');
  assert.ok(guestAfter.self.x > 400, 'Le snapshot orienté montre bien le déplacement à droite');
  assert.ok(guestAfter.self.y < 730);
  assert.ok(guestAfter.projectiles.every(p => p.ownerRole !== 'opponent' || p.vy < 0), 'Les tirs invités montent à l’écran');
}

console.log('Duel de la Nuit noire — cœur déterministe, tir manuel, orientation, visibilité, snapshots, mort subite et cotes : OK');
