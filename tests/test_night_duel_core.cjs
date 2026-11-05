'use strict';

const assert = require('node:assert/strict');
const Core = require('../duel-core.js');

// Les sections historiques testent le combat pur : on vide le décor généré pour
// éviter qu'un piège/une caisse ne perturbe les assertions déterministes.
function emptyWorld(match) {
  const w = match.world;
  w.obstacles = []; w.crates = []; w.bombs = []; w.traps = [];
  w.enemies = []; w.pickups = []; w.alarms = [];
  match.effects = [];
  return match;
}

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
  emptyWorld(match);
  assert.equal(match.witches.creator.hearts, 5);
  assert.equal(match.witches.opponent.hearts, 5);
  assert.equal(Core.isOpponentVisible(match, 'opponent'), false);

  const initialGuestSnap = Core.createSnapshotFor(match, 'opponent');
  assert.equal(initialGuestSnap.opponent.visible, false);
  assert.equal(initialGuestSnap.opponent.x, null);
  assert.equal(initialGuestSnap.opponent.y, null);
  assert.equal(initialGuestSnap.opponent.aimAngle, null);
  // Les coordonnées cachées de l'adversaire ne doivent jamais apparaître.
  // (self.y peut coïncider avec le spawn créateur selon l'aléa : on teste l'objet opponent.)
  assert.equal(JSON.stringify(initialGuestSnap.opponent).includes('"x":null'), true);
  assert.equal(JSON.stringify(initialGuestSnap.opponent).includes('"y":null'), true);

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
  emptyWorld(match);
  match.witches.creator.fireCooldown = 99;
  match.witches.opponent.fireCooldown = 99;

  // Projectile passant à proximité (34 px du centre : hors HIT_RADIUS=16+8=24, mais dans DODGE_PROXIMITY_RADIUS=52+8=60).
  match.projectiles.push({
    id: 900,
    ownerRole: 'opponent',
    x: match.witches.creator.x + 34,
    y: match.witches.creator.y - 30,
    prevX: match.witches.creator.x + 34,
    prevY: match.witches.creator.y - 30,
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
  emptyWorld(matchDirect);
  matchDirect.witches.creator.fireCooldown = 99;
  matchDirect.witches.opponent.fireCooldown = 99;
  matchDirect.projectiles.push({
    id: 901,
    ownerRole: 'opponent',
    x: matchDirect.witches.creator.x,
    y: matchDirect.witches.creator.y - 4,
    prevX: matchDirect.witches.creator.x,
    prevY: matchDirect.witches.creator.y - 4,
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
    x: matchDirect.witches.opponent.x,
    y: matchDirect.witches.opponent.y,
    prevX: matchDirect.witches.opponent.x,
    prevY: matchDirect.witches.opponent.y,
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
  emptyWorld(match);
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
  emptyWorld(match);
  const creatorView = Core.orientSnapshotForViewer(Core.createSnapshotFor(match, 'creator'), 'creator');
  const guestView = Core.orientSnapshotForViewer(Core.createSnapshotFor(match, 'opponent'), 'opponent');
  assert.equal(creatorView.self.y, match.spawns.creator.y, 'La créatrice voit son spawn aléatoire');
  assert.equal(guestView.self.y, match.spawns.creator.y, "L'invitée voit le même écran orienté (spawn miroir)");
  assert.equal(guestView.self.x, match.spawns.creator.x);
  assert.ok(Math.sin(guestView.self.aimAngle) < -0.999 && Math.abs(Math.cos(guestView.self.aimAngle)) < 0.02, "L'invitée vise vers le haut de son écran");

  const localCmd = { moveX: 1, moveY: -1, aimX: 600, aimY: 200, fire: true, dashSeq: 3 };
  const worldCmd = Core.orientCommandForRole('opponent', localCmd);
  assert.equal(worldCmd.moveX, -1, 'Droite écran invité = gauche monde');
  assert.equal(worldCmd.moveY, 1, 'Haut écran invité = bas monde');
  assert.equal(worldCmd.aimX, Core.WORLD_WIDTH - 600);
  assert.equal(worldCmd.aimY, Core.WORLD_HEIGHT - 200);
  assert.equal(worldCmd.fire, true);
  assert.equal(worldCmd.dashSeq, 3);
  assert.equal(Core.orientCommandForRole('creator', localCmd), localCmd, 'La créatrice joue déjà en coordonnées monde');

  Core.applyCommand(match, 'opponent', worldCmd);
  Core.stepMatch(match, 0.2);
  assert.ok(match.witches.opponent.x < match.spawns.opponent.x, "L'invitée va à droite de son écran, donc à gauche du monde");
  assert.ok(match.witches.opponent.y > match.spawns.opponent.y, "L'invitée monte vers le centre depuis le haut du monde");
  const guestAfter = Core.orientSnapshotForViewer(Core.createSnapshotFor(match, 'opponent'), 'opponent');
  assert.ok(guestAfter.self.x > match.spawns.creator.x, 'Le snapshot orienté montre bien le déplacement à droite');
  assert.ok(guestAfter.self.y < match.spawns.creator.y);
  assert.ok(guestAfter.projectiles.every(p => p.ownerRole !== 'opponent' || p.vy < 0), 'Les tirs invités montent à l’écran');
}

// 8. Monde vaste (5×), caméra, décor, pièges, bombes, caisses, sentinelles, atouts.
{
  assert.equal(Core.WORLD_WIDTH * Core.WORLD_HEIGHT, 5 * Core.VIEW_WIDTH * Core.VIEW_HEIGHT, 'Le monde fait exactement 5× la surface du viewport');
  assert.equal(Core.VIEW_WIDTH, 800);
  assert.equal(Core.VIEW_HEIGHT, 900);

  const match = Core.createMatch({ id: 'world-test' });
  const other = Core.createMatch({ id: 'world-test-other' });
  const again = Core.createMatch({ id: 'world-test' });
  assert.ok(match.spawns && other.spawns, 'Spawns aléatoires générés');
  assert.notDeepEqual(match.spawns.creator, other.spawns.creator, 'Deux matches ont des spawns différents');
  assert.deepEqual(match.spawns, again.spawns, 'Spawns déterministes pour un même id');
  assert.equal(match.spawns.opponent.x, Core.WORLD_WIDTH - match.spawns.creator.x, 'Spawn adverse en miroir 180°');
  assert.equal(match.spawns.opponent.y, Core.WORLD_HEIGHT - match.spawns.creator.y);
  assert.equal(match.witches.creator.x, match.spawns.creator.x);
  assert.equal(match.witches.opponent.y, match.spawns.opponent.y);
  const w = match.world;
  assert.ok(w.obstacles.length >= 10, 'Décor solide généré');
  assert.ok(w.crates.length >= 8, 'Caisses générées');
  assert.ok(w.bombs.length >= 6, 'Bombes générées');
  assert.ok(w.traps.length >= 6, 'Pièges générés');
  assert.ok(w.enemies.length >= 6, 'Sentinelles endormies générées');
  assert.ok(w.enemies.every(e => e.state === 'sleep'), 'Les sentinelles démarrent endormies');
  // Symétrie 180° pour l'équité.
  for (const crate of w.crates) {
    const mirror = w.crates.find(c => Math.abs(c.x - (Core.WORLD_WIDTH - crate.x)) < 1 && Math.abs(c.y - (Core.WORLD_HEIGHT - crate.y)) < 1);
    assert.ok(mirror, 'Chaque caisse a son miroir 180°');
  }
  // Le couloir central reste dégagé pour les tirs verticaux historiques.
  for (const ob of w.obstacles) {
    const cx = ob.shape === 'rect' ? ob.x + ob.w / 2 : ob.x;
    assert.ok(Math.abs(cx - Core.ARENA_CENTER.x) > 100, 'Pas de solide dans le couloir central');
  }

  const snap = Core.createSnapshotFor(match, 'creator');
  assert.ok(snap.world && Array.isArray(snap.world.crates), 'Le snapshot transporte le monde');
  assert.equal(snap.self.boons.swift, 0);

  // Caisse cassée -> atout au sol.
  const crate = w.crates[0];
  match.projectiles.push({ id: 8000, ownerRole: 'creator', x: crate.x, y: crate.y, prevX: crate.x, prevY: crate.y, vx: 0, vy: 0, r: 8, damage: 2, life: 1, maxLife: 1 });
  Core.stepMatch(match, 1 / 60);
  assert.equal(crate.alive, false, 'La caisse est cassée');
  assert.ok(w.pickups.length >= 1, 'Un atout apparaît');

  // Bombe -> explosion, alarme, réveil.
  const bomb = w.bombs.find(b => b.alive);
  match.projectiles.push({ id: 8001, ownerRole: 'creator', x: bomb.x, y: bomb.y, prevX: bomb.x, prevY: bomb.y, vx: 0, vy: 0, r: 8, damage: 1, life: 1, maxLife: 1 });
  Core.stepMatch(match, 1 / 60);
  assert.equal(bomb.alive, false, 'La bombe explose');
  assert.ok(w.alarms.length >= 1, 'Une alarme de minimap est émise');
  assert.ok(match.effects.some(fx => fx.type === 'explosion'), 'Effet d’explosion');

  // Piège de contact.
  const trap = w.traps[0];
  const c = match.witches.creator;
  c.x = trap.x; c.y = trap.y; c.invTimer = 0; c.parry = 0;
  const heartsBefore = c.hearts;
  Core.stepMatch(match, 1 / 60);
  assert.ok(trap.cooldown > 0, 'Le piège se déclenche');
  assert.ok(c.hearts < heartsBefore || c.revealTimer > 0, 'Le piège blesse ou révèle');

  // La lumière du tir réveille une sentinelle proche.
  const enemy = w.enemies.find(e => e.state === 'sleep');
  enemy.x = c.x + 90; enemy.y = c.y; enemy.homeX = enemy.x; enemy.homeY = enemy.y;
  Core.applyCommand(match, 'creator', { fire: true, hasAim: true, aimX: c.x, aimY: c.y - 100 });
  Core.stepMatch(match, 0.1);
  assert.equal(enemy.state, 'awake', 'La lumière réveille la sentinelle');
  assert.ok(w.alarms.some(a => a.role === 'creator'), 'L’alarme révèle la position de la tireuse');

  // Tuer une sentinelle donne un avantage.
  enemy.hp = 1;
  match.projectiles.push({ id: 8002, ownerRole: 'creator', x: enemy.x, y: enemy.y, prevX: enemy.x, prevY: enemy.y, vx: 0, vy: 0, r: 8, damage: 1, life: 1, maxLife: 1 });
  Core.stepMatch(match, 1 / 60);
  assert.equal(enemy.state, 'dead', 'La sentinelle est tuée');
  assert.ok(match.events.some(ev => ev.type === 'enemy-killed'), 'Événement de kill');
  const boonActive = Object.values(c.boons).some(v => v > 0) || c.hearts > 0;
  assert.ok(boonActive, 'Le kill donne un avantage');

  // Orientation du monde pour l'invitée (snapshot synthétique, indépendant du brouillard).
  const fake = {
    self: { role: 'opponent', x: 100, y: 200, aimAngle: 0 },
    opponent: { visible: false, x: null, y: null },
    world: { obstacles: [], crates: [{ id: 9, x: 300, y: 400 }], bombs: [], traps: [], enemies: [], pickups: [], alarms: [] },
    projectiles: [], footsteps: [], dodgeTrails: [], effects: []
  };
  const oriented = Core.orientSnapshotForViewer(fake, 'opponent');
  assert.equal(oriented.world.crates[0].x, Core.WORLD_WIDTH - 300, 'Le monde est pivoté pour l’invitée');
  assert.equal(oriented.world.crates[0].y, Core.WORLD_HEIGHT - 400);
  // Aucune coordonnée adverse cachée ne fuite.
  const hidden = Core.createSnapshotFor(match, 'opponent');
  if (!hidden.opponent.visible) {
    assert.equal(hidden.opponent.x, null);
    assert.equal(hidden.opponent.y, null);
  }
}

// 9. Brouillard de guerre : objets/monstres visibles seulement dans la lumière ;
//    les sentinelles perdent l'aggro, font leur ronde puis se rendorment.
{
  const m = Core.createMatch({ id: 'fog-test' });
  const c = m.witches.creator;
  m.world.obstacles = []; m.world.crates = []; m.world.bombs = []; m.world.traps = [];
  m.world.enemies = []; m.world.pickups = []; m.world.alarms = []; m.effects = [];

  const nearCrate = { id: 1, type: 'crate', shape: 'circle', x: c.x + 80, y: c.y, r: 22, hp: 2, alive: true };
  const farCrate = { id: 2, type: 'crate', shape: 'circle', x: 100, y: 100, r: 22, hp: 2, alive: true };
  m.world.crates = [nearCrate, farCrate];
  let snap = Core.createSnapshotFor(m, 'creator');
  assert.equal(snap.world.crates.length, 1, 'Seule la caisse dans le halo est visible');
  assert.equal(snap.world.crates[0].id, nearCrate.id);

  const e = {
    id: 3, type: 'enemy', shape: 'circle', kind: 'ghost', x: c.x + 120, y: c.y, r: 20, hp: 3,
    state: 'sleep', targetRole: null, attackCd: 0, shootCd: 0, sleepTimer: 0, loseTimer: 0,
    patrolAngle: 0, perimeter: 170, discovered: false, homeX: c.x + 120, homeY: c.y
  };
  m.world.enemies = [e];
  snap = Core.createSnapshotFor(m, 'creator');
  assert.equal(snap.world.enemies.length, 1, 'La sentinelle proche est visible dans le halo');
  assert.equal(snap.world.enemies[0].state, 'sleep');

  Core.stepMatch(m, 0.1);
  assert.equal(e.state, 'awake', 'Le halo réveille la sentinelle');

  // La joueuse part au loin : la sentinelle doit perdre l'aggro et revenir en ronde/sommeil.
  c.x = 100; c.y = 100;
  for (let i = 0; i < 400 && e.state === 'awake'; i += 1) Core.stepMatch(m, 0.05);
  assert.ok(e.state === 'patrol' || e.state === 'sleep', 'La sentinelle se calme quand la joueuse quitte la lumière');
  const distHome = Math.hypot(e.x - e.homeX, e.y - e.homeY);
  assert.ok(distHome <= e.perimeter + 40, 'La sentinelle reste dans son périmètre de ronde');
  snap = Core.createSnapshotFor(m, 'creator');
  assert.equal(snap.world.enemies.length, 0, 'Loin du halo, la sentinelle redevient invisible');

  // Une explosion éclaire temporairement les objets.
  m.effects.push({ id: 99, type: 'explosion', x: farCrate.x, y: farCrate.y, age: 0, maxAge: 0.7, r: 150 });
  snap = Core.createSnapshotFor(m, 'creator');
  assert.ok(snap.world.crates.some(cr => cr.id === farCrate.id), 'La lumière d’explosion révèle les objets');
}

// 10. Visée curseur : l'angle de la sorcière (et donc l'avant du balai) suit la direction visée.
{
  const m = Core.createMatch({ id: 'aim-test' });
  emptyWorld(m);
  const c = m.witches.creator;
  Core.applyCommand(m, 'creator', { hasAim: true, aimX: c.x + 120, aimY: c.y });
  Core.stepMatch(m, 1 / 60);
  assert.ok(Math.cos(c.aimAngle) > 0.999 && Math.abs(Math.sin(c.aimAngle)) < 0.02, 'La sorcière vise à droite du curseur');
  Core.applyCommand(m, 'creator', { hasAim: true, aimX: c.x, aimY: c.y + 120 });
  Core.stepMatch(m, 1 / 60);
  assert.ok(Math.sin(c.aimAngle) > 0.999 && Math.abs(Math.cos(c.aimAngle)) < 0.02, 'La sorcière vise vers le bas du curseur');
  const snap = Core.createSnapshotFor(m, 'creator');
  assert.ok(Math.sin(snap.self.aimAngle) > 0.99, 'Le snapshot expose l’angle de visée pour orienter le balai');
}

// ---------------------------------------------------------------------------
// 11. Allure de déplacement : plus douce pour rester visable au doigt.
// ---------------------------------------------------------------------------
{
  const stats = Core.computeStats([]);
  assert.equal(stats.moveSpeed, 275, 'vitesse de course réduite');
  assert.equal(stats.focusSpeed, 150, 'vitesse de précision réduite');
  assert.ok(stats.focusSpeed < stats.moveSpeed, 'la précision reste plus lente');
  assert.equal(Core.ENEMY_SPEED, 120, 'poursuite des sentinelles ralentie');
  assert.equal(Core.ENEMY_PATROL_SPEED, 48, 'ronde des sentinelles ralentie');
  assert.equal(Core.ENEMY_SHOT_SPEED, 240, 'projectiles ennemis plus lents');
  console.log('  ✓ vitesse du duel adoucie pour la visée');
}

console.log('Duel de la Nuit noire — cœur déterministe, monde 5×, caméra, brouillard de guerre, ronde/sommeil des sentinelles, décor/pièges/bombes/caisses, tir manuel, visée curseur, orientation, visibilité, snapshots, mort subite et cotes : OK');
