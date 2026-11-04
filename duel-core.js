/* La Nuit aux Trousses — Cœur déterministe du Duel de la Nuit noire.
   Partagé entre le navigateur (window.NightDuelCore) et les tests Node (CommonJS).
   Isolé de la campagne, de l’Arsenal, des compagnons, de l’XP et des highscores. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NightDuelCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const ARENA_WIDTH = 800;
  const ARENA_HEIGHT = 900;
  const ARENA_CENTER = Object.freeze({ x: 400, y: 450 });
  const ARENA_PADDING_X = 28;
  const ARENA_PADDING_Y = 36;

  const BASE_HEARTS = 5;
  const ROUND_DURATION = 90;
  const ROUNDS_TO_WIN = 2;
  const MAX_ROUNDS = 3;
  const INTERMISSION_DURATION = 2.4;

  const BURST_COUNT = 3;
  const BURST_INTERVAL = 0.70;
  const BURST_STEP = 0.12;

  const BASE_HALO_RADIUS = 195;
  const SHOT_REVEAL_DURATION = 0.55;
  const HIT_REVEAL_DURATION = 0.45;
  const LUNAR_PULSE_EARLY_INTERVAL = 15;
  const LUNAR_PULSE_LATE_AT = 45;
  const LUNAR_PULSE_LATE_INTERVAL = 7.5;
  const LUNAR_REVEAL_DURATION = 1.35;

  const ZONE_SHRINK_START = 60;
  const ZONE_INITIAL_RADIUS = 560;
  const ZONE_MIN_RADIUS = 185;
  const ZONE_SUDDEN_DEATH_MIN = 145;
  const SUDDEN_DEATH_AT = 90;

  const HIT_RADIUS = 16;
  const DODGE_PROXIMITY_RADIUS = 52;
  const ACOUSTIC_STEP_RANGE = 350;
  const ACOUSTIC_TRAIL_RANGE = 380;

  const INITIAL_RATING = 1000;
  const RATING_DIFF_THRESHOLD = 150;
  const RATING_DELTA_CLOSE = 20;
  const RATING_DELTA_UPSET = 30;
  const RATING_DELTA_FAVORITE = 10;
  const DAILY_RANKED_PAIR_LIMIT = 2;
  const WAGER_AMOUNT = 10;
  const WAGER_POT = 20;
  const RANKED_WIN_SHARD_BONUS = 2;

  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  const EXACT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const PERK_CATALOG = Object.freeze([
    Object.freeze({
      id: 'comet-boots',
      name: 'Bottes comète',
      category: 'Vitesse',
      icon: '☄',
      short: '+22 % vitesse',
      desc: 'Accélère le vol libre et le vol précis dans l’obscurité.'
    }),
    Object.freeze({
      id: 'twin-burst',
      name: 'Rafale jumelle',
      category: 'Projectile supplémentaire',
      icon: '✦',
      short: '+1 tir par rafale',
      desc: 'Chaque salve manuelle passe de 3 à 4 projectiles.'
    }),
    Object.freeze({
      id: 'swift-powder',
      name: 'Poudre vive',
      category: 'Cadence',
      icon: '⚡',
      short: 'Salves plus proches',
      desc: 'Rapproche le rythme des salves manuelles (0,50 s).'
    }),
    Object.freeze({
      id: 'prism-fan',
      name: 'Éventail prismatique',
      category: 'Tirs latéraux',
      icon: '❖',
      short: '2 éclats latéraux',
      desc: 'Ajoute deux projectiles obliques à chaque tir de la salve.'
    }),
    Object.freeze({
      id: 'dawn-halo',
      name: 'Halo d’aube',
      category: 'Vision',
      icon: '◐',
      short: '+40 % rayon de halo',
      desc: 'Étend le cercle clair dans lequel l’adversaire devient visible.'
    }),
    Object.freeze({
      id: 'soft-steps',
      name: 'Pas feutrés',
      category: 'Discrétion',
      icon: '☾',
      short: 'Traces et lueur réduites',
      desc: 'Réduit les échos de pas, la portée où l’on te repère et l’éclat de tir.'
    }),
    Object.freeze({
      id: 'fleeting-dash',
      name: 'Bond furtif',
      category: 'Esquive',
      icon: '↝',
      short: 'Esquive vive',
      desc: 'Recharge l’esquive plus vite et prolonge sa garde immédiate.'
    }),
    Object.freeze({
      id: 'ember-heart',
      name: 'Cœur de braise',
      category: 'Cœur / parade',
      icon: '♥',
      short: '+1 cœur & parade',
      desc: 'Ajoute un 6e cœur et amortit le premier impact lourd de chaque manche.'
    }),
    Object.freeze({
      id: 'short-lance',
      name: 'Lance brève',
      category: 'Dégâts doubles',
      icon: '⚔',
      short: '2 cœurs par coup',
      desc: 'Inflige des dégâts doubles à portée resserrée.'
    }),
    Object.freeze({
      id: 'wide-wave',
      name: 'Onde large',
      category: 'Projectiles élargis',
      icon: '◎',
      short: 'Orbes élargis',
      desc: 'Élargit nettement le rayon des projectiles tirés.'
    })
  ]);

  const PERK_MAP = new Map(PERK_CATALOG.map(perk => [perk.id, perk]));

  const COSMETIC_HALOS = Object.freeze([
    Object.freeze({
      id: 'halo-violet',
      name: 'Halo violet',
      cost: 0,
      color: 'rgba(176, 132, 255, 0.24)',
      ring: '#c8a6ff',
      desc: 'Lueur nocturne originelle, offerte à toutes les sorcières.'
    }),
    Object.freeze({
      id: 'halo-aurora',
      name: 'Halo d’aurore',
      cost: 30,
      color: 'rgba(110, 232, 214, 0.24)',
      ring: '#7ef3df',
      desc: 'Reflet boréal purement cosmétique, sans avantage de portée.'
    }),
    Object.freeze({
      id: 'halo-solar',
      name: 'Halo solaire',
      cost: 60,
      color: 'rgba(255, 204, 112, 0.24)',
      ring: '#ffd27d',
      desc: 'Couronne ambrée purement cosmétique, sans avantage de combat.'
    }),
    Object.freeze({
      id: 'halo-eclipse',
      name: 'Halo d’éclipse',
      cost: 100,
      color: 'rgba(255, 122, 184, 0.24)',
      ring: '#ff94c8',
      desc: 'Anneau pourpre d’éclipse, strictement cosmétique.'
    })
  ]);

  const HALO_MAP = new Map(COSMETIC_HALOS.map(item => [item.id, item]));

  function getHaloCosmetic(id) {
    return HALO_MAP.get(id) || COSMETIC_HALOS[0];
  }

  function validatePerks(perks) {
    if (!Array.isArray(perks) || perks.length !== 3) {
      return { valid: false, error: 'Choisis exactement trois atouts différents.' };
    }
    const normalized = perks.map(item => String(item || '').trim());
    const unique = new Set(normalized);
    if (unique.size !== 3) {
      return { valid: false, error: 'Choisis exactement trois atouts différents.' };
    }
    for (const id of normalized) {
      if (!PERK_MAP.has(id)) {
        return { valid: false, error: 'Atout inconnu dans ce duel.' };
      }
    }
    return { valid: true, perks: normalized };
  }

  function extractDuelId(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (EXACT_UUID_RE.test(text)) return text.toLowerCase();
    try {
      const url = new URL(text, 'https://minuit.local/');
      const param = (url.searchParams.get('duel') || '').trim();
      if (EXACT_UUID_RE.test(param)) return param.toLowerCase();
    } catch (_) {}
    const match = text.match(UUID_RE);
    return match ? match[0].toLowerCase() : '';
  }

  function buildInviteUrl(baseHref, duelId) {
    const cleanId = extractDuelId(duelId);
    if (!cleanId) return '';
    try {
      const url = new URL(baseHref || 'https://minuit.local/');
      url.hash = '';
      ['team', 'code', 'token_hash', 'type', 'error', 'error_description'].forEach(key => url.searchParams.delete(key));
      url.searchParams.set('duel', cleanId);
      return url.toString();
    } catch (_) {
      return `?duel=${cleanId}`;
    }
  }

  function buildShareLinks(baseHref, duelId, creatorName, mode) {
    const inviteUrl = buildInviteUrl(baseHref, duelId);
    const label = mode === 'ranked' ? 'classé' : 'amical';
    const who = String(creatorName || 'Une sorcière').trim() || 'Une sorcière';
    const message = `${who} t’invite en Duel de la Nuit noire (${label}) sur La Nuit aux Trousses : ${inviteUrl}`;
    return {
      inviteUrl,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
      messenger: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}&quote=${encodeURIComponent(message)}`
    };
  }

  function parisDateKey(input) {
    const date = input instanceof Date ? input : new Date(input || Date.now());
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const get = type => (parts.find(part => part.type === type) || {}).value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function computeRatingDelta(winnerRating, loserRating, mode) {
    if (mode !== 'ranked') return 0;
    const w = Number.isFinite(winnerRating) ? winnerRating : INITIAL_RATING;
    const l = Number.isFinite(loserRating) ? loserRating : INITIAL_RATING;
    if (w + RATING_DIFF_THRESHOLD <= l) return RATING_DELTA_UPSET;
    if (w >= l + RATING_DIFF_THRESHOLD) return RATING_DELTA_FAVORITE;
    return RATING_DELTA_CLOSE;
  }

  function canPlayRankedToday(completedPairMatches, now) {
    const today = parisDateKey(now || new Date());
    let count = 0;
    for (const item of completedPairMatches || []) {
      if (!item || item.mode !== 'ranked' || item.status !== 'completed') continue;
      if (parisDateKey(item.completedAt || item.completed_at || now) === today) count += 1;
    }
    return {
      allowed: count < DAILY_RANKED_PAIR_LIMIT,
      count,
      remaining: Math.max(0, DAILY_RANKED_PAIR_LIMIT - count),
      parisDate: today
    };
  }

  function createDuelProfile(overrides) {
    const base = {
      rating: INITIAL_RATING,
      shards: 20,
      wins: 0,
      losses: 0,
      unlocked: ['halo-violet'],
      equipped: 'halo-violet'
    };
    const merged = Object.assign(base, overrides || {});
    merged.unlocked = Array.isArray(merged.unlocked) ? [...new Set(merged.unlocked)] : ['halo-violet'];
    if (!merged.unlocked.includes('halo-violet')) merged.unlocked.unshift('halo-violet');
    if (!merged.unlocked.includes(merged.equipped)) merged.equipped = 'halo-violet';
    return merged;
  }

  function unlockHaloInProfile(profile, haloId) {
    const p = createDuelProfile(profile);
    const halo = HALO_MAP.get(haloId);
    if (!halo || halo.cost <= 0) throw new Error('Halo inconnu');
    if (p.unlocked.includes(haloId)) throw new Error('Halo déjà débloqué');
    if (p.shards < halo.cost) throw new Error('Éclats insuffisants');
    p.shards -= halo.cost;
    p.unlocked.push(haloId);
    return p;
  }

  function equipHaloInProfile(profile, haloId) {
    const p = createDuelProfile(profile);
    if (!p.unlocked.includes(haloId)) throw new Error('Débloque ce halo avant de l’équiper');
    p.equipped = haloId;
    return p;
  }

  function createConsensusState(config) {
    const cfg = config || {};
    const mode = cfg.mode === 'ranked' ? 'ranked' : 'friendly';
    const wager = cfg.wager === WAGER_AMOUNT ? WAGER_AMOUNT : 0;
    const rankedGate = canPlayRankedToday(cfg.pairHistory || [], cfg.now);
    if (mode === 'ranked' && !rankedGate.allowed) {
      throw new Error('Deux duels classés déjà joués contre cette sorcière aujourd’hui. Choisis un amical.');
    }
    const creator = createDuelProfile(cfg.creatorProfile);
    const opponent = createDuelProfile(cfg.opponentProfile);
    if (wager > 0) {
      if (creator.shards < wager || opponent.shards < wager) {
        throw new Error('Éclats insuffisants pour cette mise');
      }
      creator.shards -= wager;
      opponent.shards -= wager;
    }
    return {
      id: cfg.id || '00000000-0000-4000-8000-000000000001',
      creatorId: cfg.creatorId || 'creator',
      opponentId: cfg.opponentId || 'opponent',
      mode,
      wager,
      status: 'active',
      creatorReport: null,
      opponentReport: null,
      winnerId: null,
      ratingDelta: 0,
      profiles: {
        [cfg.creatorId || 'creator']: creator,
        [cfg.opponentId || 'opponent']: opponent
      }
    };
  }

  function applyVictoryToState(duelState, winnerId, now) {
    if (duelState.status === 'completed') return duelState;
    const loserId = winnerId === duelState.creatorId ? duelState.opponentId : duelState.creatorId;
    const winner = duelState.profiles[winnerId];
    const loser = duelState.profiles[loserId];
    const delta = computeRatingDelta(winner.rating, loser.rating, duelState.mode);
    if (duelState.mode === 'ranked') {
      winner.rating = Math.max(0, Math.min(100000, winner.rating + delta));
      loser.rating = Math.max(0, Math.min(100000, loser.rating - delta));
      winner.wins += 1;
      loser.losses += 1;
      winner.shards += RANKED_WIN_SHARD_BONUS;
    }
    if (duelState.wager > 0) {
      winner.shards += duelState.wager * 2;
    }
    duelState.winnerId = winnerId;
    duelState.ratingDelta = delta;
    duelState.status = 'completed';
    duelState.completedAt = (now instanceof Date ? now : new Date(now || Date.now())).toISOString();
    return duelState;
  }

  function submitConsensusReport(duelState, reporterId, winnerId, now) {
    if (!duelState) throw new Error('Duel introuvable');
    if (duelState.status === 'completed') return duelState;
    if (duelState.status !== 'active') throw new Error('Ce duel n’est pas en cours');
    if (reporterId !== duelState.creatorId && reporterId !== duelState.opponentId) {
      throw new Error('Ce duel est réservé à ses invités');
    }
    if (winnerId !== duelState.creatorId && winnerId !== duelState.opponentId) {
      throw new Error('Vainqueur invalide');
    }
    if (reporterId === duelState.creatorId) duelState.creatorReport = winnerId;
    else duelState.opponentReport = winnerId;

    if (duelState.creatorReport && duelState.opponentReport && duelState.creatorReport === duelState.opponentReport) {
      applyVictoryToState(duelState, winnerId, now);
    }
    return duelState;
  }

  function forfeitConsensusState(duelState, forfeiterId, now) {
    if (!duelState) throw new Error('Duel introuvable');
    if (duelState.status === 'completed' || duelState.status === 'cancelled') return duelState;
    if (forfeiterId !== duelState.creatorId && forfeiterId !== duelState.opponentId) {
      throw new Error('Ce duel est réservé à ses invités');
    }
    if (duelState.status !== 'active') {
      if (duelState.wager > 0) {
        duelState.profiles[duelState.creatorId].shards += duelState.wager;
        duelState.profiles[duelState.opponentId].shards += duelState.wager;
      }
      duelState.status = 'cancelled';
      return duelState;
    }
    const winnerId = forfeiterId === duelState.creatorId ? duelState.opponentId : duelState.creatorId;
    duelState.creatorReport = winnerId;
    duelState.opponentReport = winnerId;
    return applyVictoryToState(duelState, winnerId, now);
  }

  function computeStats(perks) {
    const check = validatePerks(perks);
    const list = check.valid ? check.perks : [];
    const has = id => list.includes(id);
    const speedFactor = has('comet-boots') ? 1.22 : 1;
    return {
      perks: list,
      moveSpeed: 330 * speedFactor,
      focusSpeed: 175 * speedFactor,
      burstCount: BURST_COUNT + (has('twin-burst') ? 1 : 0),
      burstInterval: has('swift-powder') ? 0.50 : BURST_INTERVAL,
      burstStep: has('swift-powder') ? 0.095 : BURST_STEP,
      sideAngles: has('prism-fan') ? [-0.36, 0, 0.36] : [0],
      haloRadius: has('dawn-halo') ? 275 : BASE_HALO_RADIUS,
      stealthFactor: has('soft-steps') ? 0.84 : 1,
      shotRevealDuration: has('soft-steps') ? 0.28 : SHOT_REVEAL_DURATION,
      stepInterval: has('soft-steps') ? 0.82 : 0.46,
      stepMaxAge: has('soft-steps') ? 0.95 : 1.5,
      dashCooldown: has('fleeting-dash') ? 2.5 : 3.6,
      dashDuration: has('fleeting-dash') ? 0.38 : 0.32,
      dashInvDuration: has('fleeting-dash') ? 0.58 : 0.45,
      dashSpeedMultiplier: has('fleeting-dash') ? 2.45 : 2.25,
      maxHearts: BASE_HEARTS + (has('ember-heart') ? 1 : 0),
      initialParry: has('ember-heart') ? 1 : 0,
      shotDamage: has('short-lance') ? 2 : 1,
      shotSpeed: 470,
      shotLife: has('short-lance') ? 1.38 : 2.1,
      shotRadius: has('wide-wave') ? 15 : 8
    };
  }

  function createWitch(role, perks, cosmeticId) {
    const stats = computeStats(perks);
    const isCreator = role === 'creator';
    return {
      role,
      cosmetic: getHaloCosmetic(cosmeticId).id,
      stats,
      x: ARENA_CENTER.x,
      y: isCreator ? 730 : 170,
      vx: 0,
      vy: 0,
      aimAngle: isCreator ? -Math.PI / 2 : Math.PI / 2,
      hearts: stats.maxHearts,
      maxHearts: stats.maxHearts,
      parry: stats.initialParry,
      fireCooldown: 0,
      burstRemaining: 0,
      burstShotTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashDirX: 0,
      dashDirY: isCreator ? -1 : 1,
      invTimer: 0,
      dodgeProtectTimer: 0,
      dodgeCredited: false,
      perfectDodges: 0,
      dodgeSuccessTimer: 0,
      revealTimer: 0,
      stepAccum: 0,
      lastDashSeq: 0,
      activeTrailId: 0,
      lastKnownOpponent: null,
      cmd: {
        moveX: 0,
        moveY: 0,
        focus: false,
        hasTarget: false,
        targetX: ARENA_CENTER.x,
        targetY: isCreator ? 730 : 170,
        hasAim: false,
        aimX: ARENA_CENTER.x,
        aimY: ARENA_CENTER.y,
        dash: false,
        dashSeq: 0,
        fire: false
      }
    };
  }

  function resetRoundState(match) {
    const c = match.witches.creator;
    const o = match.witches.opponent;
    for (const [role, w] of [['creator', c], ['opponent', o]]) {
      const isCreator = role === 'creator';
      w.x = ARENA_CENTER.x;
      w.y = isCreator ? 730 : 170;
      w.vx = 0;
      w.vy = 0;
      w.aimAngle = isCreator ? -Math.PI / 2 : Math.PI / 2;
      w.hearts = w.stats.maxHearts;
      w.maxHearts = w.stats.maxHearts;
      w.parry = w.stats.initialParry;
      w.fireCooldown = 0;
      w.burstRemaining = 0;
      w.burstShotTimer = 0;
      w.dashTimer = 0;
      w.dashCooldown = 0;
      w.dashDirX = 0;
      w.dashDirY = isCreator ? -1 : 1;
      w.invTimer = 0;
      w.dodgeProtectTimer = 0;
      w.dodgeCredited = false;
      w.dodgeSuccessTimer = 0;
      w.revealTimer = 0;
      w.stepAccum = 0;
      w.activeTrailId = 0;
      w.lastKnownOpponent = null;
      w.cmd.moveX = 0;
      w.cmd.moveY = 0;
      w.cmd.hasTarget = false;
      w.cmd.dash = false;
      w.cmd.fire = false;
    }
    match.roundTime = 0;
    match.roundPhase = 'fighting';
    match.intermissionTimer = 0;
    match.zoneRadius = ZONE_INITIAL_RADIUS;
    match.suddenDeath = false;
    match.lunarPulseCount = 0;
    match.nextLunarPulseAt = LUNAR_PULSE_EARLY_INTERVAL;
    match.lunarRevealTimer = 0;
    match.lunarWave = null;
    match.projectiles = [];
    match.footsteps = [];
    match.dodgeTrails = [];
  }

  function createMatch(options) {
    const opts = options || {};
    const cCheck = validatePerks(opts.creatorPerks || ['comet-boots', 'dawn-halo', 'fleeting-dash']);
    const oCheck = validatePerks(opts.opponentPerks || ['comet-boots', 'dawn-halo', 'fleeting-dash']);
    if (!cCheck.valid) throw new Error(cCheck.error);
    if (!oCheck.valid) throw new Error(oCheck.error);

    const match = {
      id: opts.id || 'local-duel',
      mode: opts.mode === 'ranked' ? 'ranked' : 'friendly',
      wager: opts.wager === WAGER_AMOUNT ? WAGER_AMOUNT : 0,
      seq: 0,
      entitySeq: 0,
      totalTime: 0,
      round: 1,
      roundTime: 0,
      roundPhase: 'fighting',
      intermissionTimer: 0,
      lastRoundWinner: null,
      winnerRole: null,
      scores: { creator: 0, opponent: 0 },
      roundHistory: [],
      zoneRadius: ZONE_INITIAL_RADIUS,
      suddenDeath: false,
      lunarPulseCount: 0,
      nextLunarPulseAt: LUNAR_PULSE_EARLY_INTERVAL,
      lunarRevealTimer: 0,
      lunarWave: null,
      witches: {
        creator: createWitch('creator', cCheck.perks, opts.creatorCosmetic),
        opponent: createWitch('opponent', oCheck.perks, opts.opponentCosmetic)
      },
      projectiles: [],
      footsteps: [],
      dodgeTrails: [],
      events: []
    };
    resetRoundState(match);
    return match;
  }

  function startNextRound(match) {
    if (match.roundPhase === 'finished') return match;
    match.round += 1;
    resetRoundState(match);
    match.events.push({ type: 'round-start', round: match.round });
    return match;
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function applyCommand(match, role, input) {
    const w = match && match.witches && match.witches[role];
    if (!w || !input || typeof input !== 'object') return;
    if ('moveX' in input) w.cmd.moveX = clampNumber(input.moveX, -1, 1, 0);
    if ('moveY' in input) w.cmd.moveY = clampNumber(input.moveY, -1, 1, 0);
    if ('focus' in input) w.cmd.focus = Boolean(input.focus);
    if ('hasTarget' in input) w.cmd.hasTarget = Boolean(input.hasTarget);
    if (w.cmd.hasTarget && Number.isFinite(Number(input.targetX)) && Number.isFinite(Number(input.targetY))) {
      w.cmd.targetX = clampNumber(input.targetX, ARENA_PADDING_X, ARENA_WIDTH - ARENA_PADDING_X, w.x);
      w.cmd.targetY = clampNumber(input.targetY, ARENA_PADDING_Y, ARENA_HEIGHT - ARENA_PADDING_Y, w.y);
    }
    if ('hasAim' in input) w.cmd.hasAim = Boolean(input.hasAim);
    if (w.cmd.hasAim && Number.isFinite(Number(input.aimX)) && Number.isFinite(Number(input.aimY))) {
      w.cmd.aimX = clampNumber(input.aimX, 0, ARENA_WIDTH, ARENA_CENTER.x);
      w.cmd.aimY = clampNumber(input.aimY, 0, ARENA_HEIGHT, ARENA_CENTER.y);
    }
    if ('fire' in input) w.cmd.fire = Boolean(input.fire);
    if (input.dash === true) {
      w.cmd.dash = true;
    }
    if (Number.isFinite(Number(input.dashSeq)) && Number(input.dashSeq) > w.lastDashSeq) {
      w.lastDashSeq = Number(input.dashSeq);
      w.cmd.dash = true;
    }
  }

  function isOpponentVisible(match, viewerRole) {
    const otherRole = viewerRole === 'creator' ? 'opponent' : 'creator';
    const viewer = match.witches[viewerRole];
    const target = match.witches[otherRole];
    if (!viewer || !target) return false;
    if (match.lunarRevealTimer > 0) return true;
    if (target.revealTimer > 0) return true;
    const dist = Math.hypot(target.x - viewer.x, target.y - viewer.y);
    const effectiveHalo = viewer.stats.haloRadius * target.stats.stealthFactor;
    return dist <= effectiveHalo;
  }

  function updateVisibilityMemory(match, dt) {
    for (const [viewerRole, otherRole] of [['creator', 'opponent'], ['opponent', 'creator']]) {
      const viewer = match.witches[viewerRole];
      const target = match.witches[otherRole];
      if (isOpponentVisible(match, viewerRole)) {
        viewer.lastKnownOpponent = {
          x: Math.round(target.x * 10) / 10,
          y: Math.round(target.y * 10) / 10,
          aimAngle: Math.round(target.aimAngle * 100) / 100,
          age: 0,
          maxAge: 6.0
        };
      } else if (viewer.lastKnownOpponent) {
        viewer.lastKnownOpponent.age += dt;
        if (viewer.lastKnownOpponent.age >= viewer.lastKnownOpponent.maxAge) {
          viewer.lastKnownOpponent = null;
        }
      }
    }
  }

  function distancePointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 1e-6) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function clampToArenaAndZone(w, zoneRadius) {
    w.x = Math.max(ARENA_PADDING_X, Math.min(ARENA_WIDTH - ARENA_PADDING_X, w.x));
    w.y = Math.max(ARENA_PADDING_Y, Math.min(ARENA_HEIGHT - ARENA_PADDING_Y, w.y));
    const dx = w.x - ARENA_CENTER.x;
    const dy = w.y - ARENA_CENTER.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = Math.max(48, zoneRadius - 16);
    if (dist > maxDist && dist > 0) {
      const ratio = maxDist / dist;
      w.x = ARENA_CENTER.x + dx * ratio;
      w.y = ARENA_CENTER.y + dy * ratio;
    }
  }

  function triggerDash(match, w) {
    if (w.dashCooldown > 0) return false;
    let dx = w.cmd.moveX;
    let dy = w.cmd.moveY;
    if (Math.hypot(dx, dy) < 0.08 && w.cmd.hasTarget) {
      dx = w.cmd.targetX - w.x;
      dy = w.cmd.targetY - w.y;
    }
    const len = Math.hypot(dx, dy);
    if (len > 0.08) {
      w.dashDirX = dx / len;
      w.dashDirY = dy / len;
    } else {
      w.dashDirX = Math.cos(w.aimAngle);
      w.dashDirY = Math.sin(w.aimAngle);
    }
    w.dashTimer = w.stats.dashDuration;
    w.dashCooldown = w.stats.dashCooldown;
    w.invTimer = Math.max(w.invTimer, w.stats.dashInvDuration);
    w.dodgeProtectTimer = w.stats.dashInvDuration;
    w.dodgeCredited = false;

    const trailId = ++match.entitySeq;
    w.activeTrailId = trailId;
    match.dodgeTrails.push({
      id: trailId,
      ownerRole: w.role,
      x1: w.x,
      y1: w.y,
      x2: w.x,
      y2: w.y,
      age: 0,
      maxAge: 1.15,
      revealed: w.revealTimer > 0 || match.lunarRevealTimer > 0
    });
    match.events.push({ type: 'dash', role: w.role, time: match.roundTime });

    for (const p of match.projectiles) {
      if (p.ownerRole === w.role || p.life <= 0) continue;
      const dist = Math.hypot(p.x - w.x, p.y - w.y);
      if (!w.dodgeCredited && dist <= p.r + DODGE_PROXIMITY_RADIUS) {
        w.dodgeCredited = true;
        w.perfectDodges += 1;
        w.dodgeSuccessTimer = 0.7;
        match.events.push({ type: 'perfect-dodge', role: w.role, time: match.roundTime });
      }
    }
    return true;
  }

  function spawnBurstSalvo(match, w) {
    const otherRole = w.role === 'creator' ? 'opponent' : 'creator';
    const opp = match.witches[otherRole];
    if (w.cmd.hasAim) {
      const dx = w.cmd.aimX - w.x;
      const dy = w.cmd.aimY - w.y;
      if (Math.hypot(dx, dy) > 4) w.aimAngle = Math.atan2(dy, dx);
    } else if (isOpponentVisible(match, w.role)) {
      w.aimAngle = Math.atan2(opp.y - w.y, opp.x - w.x);
    } else if (w.lastKnownOpponent && Math.hypot(w.lastKnownOpponent.x - w.x, w.lastKnownOpponent.y - w.y) > 28) {
      w.aimAngle = Math.atan2(w.lastKnownOpponent.y - w.y, w.lastKnownOpponent.x - w.x);
    }

    for (const offset of w.stats.sideAngles) {
      const angle = w.aimAngle + offset;
      const muzzleX = w.x + Math.cos(angle) * 20;
      const muzzleY = w.y + Math.sin(angle) * 20;
      match.projectiles.push({
        id: ++match.entitySeq,
        ownerRole: w.role,
        x: muzzleX,
        y: muzzleY,
        prevX: muzzleX,
        prevY: muzzleY,
        vx: Math.cos(angle) * w.stats.shotSpeed,
        vy: Math.sin(angle) * w.stats.shotSpeed,
        r: w.stats.shotRadius,
        damage: w.stats.shotDamage,
        life: w.stats.shotLife,
        maxLife: w.stats.shotLife
      });
    }

    w.revealTimer = Math.max(w.revealTimer, w.stats.shotRevealDuration);
    match.events.push({ type: 'shot', role: w.role, time: match.roundTime });
  }

  function stepSingle(match, dt) {
    match.seq += 1;
    match.totalTime += dt;

    if (match.roundPhase === 'finished') return;
    if (match.roundPhase === 'intermission') {
      match.intermissionTimer -= dt;
      if (match.intermissionTimer <= 0) startNextRound(match);
      return;
    }

    match.roundTime += dt;

    if (match.lunarRevealTimer > 0) {
      match.lunarRevealTimer = Math.max(0, match.lunarRevealTimer - dt);
    }
    if (match.lunarWave) {
      match.lunarWave.age += dt;
      if (match.lunarWave.age >= match.lunarWave.maxAge) match.lunarWave = null;
    }

    while (match.roundTime + 1e-9 >= match.nextLunarPulseAt) {
      const pulseAt = match.nextLunarPulseAt;
      match.lunarPulseCount += 1;
      match.lunarRevealTimer = LUNAR_REVEAL_DURATION;
      match.lunarWave = { age: 0, maxAge: LUNAR_REVEAL_DURATION };
      match.events.push({ type: 'lunar-pulse', count: match.lunarPulseCount, time: pulseAt });
      match.nextLunarPulseAt += pulseAt >= LUNAR_PULSE_LATE_AT ? LUNAR_PULSE_LATE_INTERVAL : LUNAR_PULSE_EARLY_INTERVAL;
    }

    if (match.roundTime <= ZONE_SHRINK_START) {
      match.zoneRadius = ZONE_INITIAL_RADIUS;
    } else if (match.roundTime <= SUDDEN_DEATH_AT) {
      const progress = Math.min(1, (match.roundTime - ZONE_SHRINK_START) / (SUDDEN_DEATH_AT - ZONE_SHRINK_START));
      match.zoneRadius = ZONE_INITIAL_RADIUS + (ZONE_MIN_RADIUS - ZONE_INITIAL_RADIUS) * progress;
    } else {
      const extra = Math.min(1, (match.roundTime - SUDDEN_DEATH_AT) / 30);
      match.zoneRadius = ZONE_MIN_RADIUS + (ZONE_SUDDEN_DEATH_MIN - ZONE_MIN_RADIUS) * extra;
    }

    if (!match.suddenDeath && match.roundTime + 1e-9 >= SUDDEN_DEATH_AT) {
      match.suddenDeath = true;
      for (const role of ['creator', 'opponent']) {
        const w = match.witches[role];
        w.parry = 0;
        w.hearts = Math.min(w.hearts, 1);
      }
      match.events.push({ type: 'sudden-death', time: match.roundTime });
    }

    for (const role of ['creator', 'opponent']) {
      const w = match.witches[role];
      w.dashCooldown = Math.max(0, w.dashCooldown - dt);
      w.invTimer = Math.max(0, w.invTimer - dt);
      w.dodgeProtectTimer = Math.max(0, w.dodgeProtectTimer - dt);
      w.dodgeSuccessTimer = Math.max(0, w.dodgeSuccessTimer - dt);
      w.revealTimer = Math.max(0, w.revealTimer - dt);

      if (w.cmd.dash) {
        w.cmd.dash = false;
        triggerDash(match, w);
      }

      const prevX = w.x;
      const prevY = w.y;

      if (w.dashTimer > 0) {
        w.dashTimer = Math.max(0, w.dashTimer - dt);
        const speed = w.stats.moveSpeed * w.stats.dashSpeedMultiplier;
        w.vx = w.dashDirX * speed;
        w.vy = w.dashDirY * speed;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        const activeTrail = match.dodgeTrails.find(item => item.id === w.activeTrailId);
        if (activeTrail) {
          activeTrail.x2 = w.x;
          activeTrail.y2 = w.y;
          if (w.revealTimer > 0 || match.lunarRevealTimer > 0) activeTrail.revealed = true;
        }
      } else {
        const baseSpeed = w.cmd.focus ? w.stats.focusSpeed : w.stats.moveSpeed;
        let mx = w.cmd.moveX;
        let my = w.cmd.moveY;
        const mLen = Math.hypot(mx, my);
        if (mLen > 0.04) {
          if (mLen > 1) {
            mx /= mLen;
            my /= mLen;
          }
          w.vx = mx * baseSpeed;
          w.vy = my * baseSpeed;
          w.x += w.vx * dt;
          w.y += w.vy * dt;
        } else if (w.cmd.hasTarget) {
          const dx = w.cmd.targetX - w.x;
          const dy = w.cmd.targetY - w.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 2) {
            const step = Math.min(dist, baseSpeed * dt);
            w.vx = (dx / dist) * (step / dt);
            w.vy = (dy / dist) * (step / dt);
            w.x += (dx / dist) * step;
            w.y += (dy / dist) * step;
          } else {
            w.vx = 0;
            w.vy = 0;
          }
        } else {
          w.vx = 0;
          w.vy = 0;
        }
      }

      clampToArenaAndZone(w, match.zoneRadius);

      const moved = Math.hypot(w.x - prevX, w.y - prevY);
      if (moved > 0.35 && w.dashTimer <= 0) {
        w.stepAccum += dt;
        if (w.stepAccum >= w.stats.stepInterval) {
          w.stepAccum = 0;
          const id = ++match.entitySeq;
          const jitterX = ((id % 3) - 1) * 6;
          const jitterY = (((id >> 1) % 3) - 1) * 6;
          match.footsteps.push({
            id,
            ownerRole: w.role,
            x: Math.round(w.x / 20) * 20 + jitterX,
            y: Math.round(w.y / 20) * 20 + jitterY,
            age: 0,
            maxAge: w.stats.stepMaxAge
          });
        }
      }

      if (w.cmd.hasAim) {
        const dx = w.cmd.aimX - w.x;
        const dy = w.cmd.aimY - w.y;
        if (Math.hypot(dx, dy) > 4) w.aimAngle = Math.atan2(dy, dx);
      } else if (Math.hypot(w.vx, w.vy) > 25 && !isOpponentVisible(match, role)) {
        w.aimAngle = Math.atan2(w.vy, w.vx);
      }
    }

    updateVisibilityMemory(match, dt);

    for (const role of ['creator', 'opponent']) {
      const w = match.witches[role];
      // Aucun tir automatique : une salve ne part que si la joueuse maintient
      // la commande de tir. Tirer révèle brièvement la position, comme avant.
      w.fireCooldown = Math.max(0, w.fireCooldown - dt);
      if (w.cmd.fire && w.fireCooldown <= 0 && w.burstRemaining <= 0) {
        w.burstRemaining = w.stats.burstCount;
        w.burstShotTimer = 0;
        w.fireCooldown = w.stats.burstInterval;
      }
      if (w.burstRemaining > 0) {
        w.burstShotTimer -= dt;
        while (w.burstRemaining > 0 && w.burstShotTimer <= 1e-9) {
          spawnBurstSalvo(match, w);
          w.burstRemaining -= 1;
          if (w.burstRemaining > 0) w.burstShotTimer += w.stats.burstStep;
        }
      }
    }

    updateVisibilityMemory(match, 0);

    for (const p of match.projectiles) {
      if (p.life <= 0) continue;
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      const targetRole = p.ownerRole === 'creator' ? 'opponent' : 'creator';
      const target = match.witches[targetRole];
      const dist = distancePointToSegment(target.x, target.y, p.prevX, p.prevY, p.x, p.y);

      if (target.dodgeProtectTimer > 0 && !target.dodgeCredited && dist <= p.r + DODGE_PROXIMITY_RADIUS) {
        target.dodgeCredited = true;
        target.perfectDodges += 1;
        target.dodgeSuccessTimer = 0.7;
        match.events.push({ type: 'perfect-dodge', role: targetRole, time: match.roundTime });
      }

      if (dist <= p.r + HIT_RADIUS) {
        p.life = 0;
        if (target.invTimer > 0 || target.dashTimer > 0) {
          if (target.dodgeProtectTimer > 0 && !target.dodgeCredited) {
            target.dodgeCredited = true;
            target.perfectDodges += 1;
            target.dodgeSuccessTimer = 0.7;
            match.events.push({ type: 'perfect-dodge', role: targetRole, time: match.roundTime });
          }
        } else {
          if (match.suddenDeath) {
            target.parry = 0;
            target.hearts = 0;
          } else if (target.parry > 0) {
            target.parry -= 1;
            target.hearts = Math.max(0, target.hearts - 1);
          } else {
            target.hearts = Math.max(0, target.hearts - p.damage);
          }
          target.invTimer = 0.55;
          target.revealTimer = Math.max(target.revealTimer, HIT_REVEAL_DURATION);
          match.events.push({
            type: 'hit',
            targetRole,
            attackerRole: p.ownerRole,
            remainingHearts: target.hearts,
            time: match.roundTime
          });
        }
      }
    }

    match.projectiles = match.projectiles.filter(
      p => p.life > 0 && p.x >= -40 && p.x <= ARENA_WIDTH + 40 && p.y >= -40 && p.y <= ARENA_HEIGHT + 40
    );

    for (const s of match.footsteps) s.age += dt;
    match.footsteps = match.footsteps.filter(s => s.age < s.maxAge);

    for (const t of match.dodgeTrails) t.age += dt;
    match.dodgeTrails = match.dodgeTrails.filter(t => t.age < t.maxAge);

    updateVisibilityMemory(match, 0);

    const creatorDead = match.witches.creator.hearts <= 0;
    const opponentDead = match.witches.opponent.hearts <= 0;
    if (creatorDead || opponentDead) {
      let roundWinner = creatorDead && !opponentDead ? 'opponent' : 'creator';
      if (creatorDead && opponentDead) {
        roundWinner = match.witches.creator.hearts >= match.witches.opponent.hearts ? 'creator' : 'opponent';
      }
      match.scores[roundWinner] += 1;
      match.lastRoundWinner = roundWinner;
      match.roundHistory.push({
        round: match.round,
        winnerRole: roundWinner,
        duration: Math.round(match.roundTime * 100) / 100,
        suddenDeath: match.suddenDeath
      });
      if (match.scores[roundWinner] >= ROUNDS_TO_WIN) {
        match.roundPhase = 'finished';
        match.winnerRole = roundWinner;
        match.events.push({
          type: 'match-end',
          winnerRole: roundWinner,
          scores: { creator: match.scores.creator, opponent: match.scores.opponent }
        });
      } else {
        match.roundPhase = 'intermission';
        match.intermissionTimer = INTERMISSION_DURATION;
        match.events.push({
          type: 'round-end',
          round: match.round,
          winnerRole: roundWinner,
          scores: { creator: match.scores.creator, opponent: match.scores.opponent }
        });
      }
    }
  }

  function stepMatch(match, dt) {
    if (!match) return match;
    match.events = [];
    const total = Math.max(0, Math.min(180, Number(dt) || 0));
    if (total <= 0) return match;
    const maxStep = 1 / 60;
    let remaining = total;
    while (remaining > 1e-9) {
      const h = Math.min(maxStep, remaining);
      stepSingle(match, h);
      remaining -= h;
      if (match.roundPhase === 'finished') break;
    }
    return match;
  }

  function roundCoord(value) {
    return Math.round(value * 10) / 10;
  }

  function createSnapshotFor(match, viewerRole) {
    const role = viewerRole === 'opponent' ? 'opponent' : 'creator';
    const otherRole = role === 'creator' ? 'opponent' : 'creator';
    const self = match.witches[role];
    const opp = match.witches[otherRole];
    const oppVisible = isOpponentVisible(match, role);

    const visibleFootsteps = [];
    for (const s of match.footsteps) {
      if (s.ownerRole === role) {
        visibleFootsteps.push({
          id: s.id,
          ownerRole: s.ownerRole,
          x: s.x,
          y: s.y,
          age: Math.round(s.age * 100) / 100,
          maxAge: s.maxAge
        });
      } else if (s.age >= 0.12 && Math.hypot(s.x - self.x, s.y - self.y) <= ACOUSTIC_STEP_RANGE) {
        visibleFootsteps.push({
          id: s.id,
          ownerRole: s.ownerRole,
          x: s.x,
          y: s.y,
          age: Math.round(s.age * 100) / 100,
          maxAge: s.maxAge
        });
      }
    }

    const visibleTrails = [];
    for (const t of match.dodgeTrails) {
      const midX = (t.x1 + t.x2) * 0.5;
      const midY = (t.y1 + t.y2) * 0.5;
      const canSee =
        t.ownerRole === role ||
        oppVisible ||
        t.revealed ||
        Math.hypot(midX - self.x, midY - self.y) <= ACOUSTIC_TRAIL_RANGE;
      if (canSee) {
        visibleTrails.push({
          id: t.id,
          ownerRole: t.ownerRole,
          x1: roundCoord(t.x1),
          y1: roundCoord(t.y1),
          x2: roundCoord(t.x2),
          y2: roundCoord(t.y2),
          age: Math.round(t.age * 100) / 100,
          maxAge: t.maxAge
        });
      }
    }

    return {
      seq: match.seq,
      viewerRole: role,
      round: match.round,
      roundTime: Math.round(match.roundTime * 100) / 100,
      roundPhase: match.roundPhase,
      intermissionTimer: Math.round(match.intermissionTimer * 100) / 100,
      lastRoundWinner: match.lastRoundWinner,
      winnerRole: match.winnerRole,
      scores: {
        creator: match.scores.creator,
        opponent: match.scores.opponent
      },
      zoneRadius: roundCoord(match.zoneRadius),
      suddenDeath: match.suddenDeath,
      lunarPulseCount: match.lunarPulseCount,
      lunarRevealTimer: Math.round(match.lunarRevealTimer * 100) / 100,
      lunarWave: match.lunarWave
        ? {
            age: Math.round(match.lunarWave.age * 100) / 100,
            maxAge: match.lunarWave.maxAge
          }
        : null,
      self: {
        role: self.role,
        cosmetic: self.cosmetic,
        perks: self.stats.perks.slice(),
        x: roundCoord(self.x),
        y: roundCoord(self.y),
        aimAngle: Math.round(self.aimAngle * 100) / 100,
        hearts: self.hearts,
        maxHearts: self.maxHearts,
        parry: self.parry,
        haloRadius: self.stats.haloRadius,
        dashCooldown: Math.round(self.dashCooldown * 100) / 100,
        dashMaxCooldown: self.stats.dashCooldown,
        dashActive: self.dashTimer > 0,
        fireCooldown: Math.round(self.fireCooldown * 100) / 100,
        fireMaxCooldown: self.stats.burstInterval,
        firing: self.burstRemaining > 0,
        invulnerable: self.invTimer > 0,
        perfectDodges: self.perfectDodges,
        dodgeSuccess: self.dodgeSuccessTimer > 0,
        revealed: self.revealTimer > 0 || match.lunarRevealTimer > 0
      },
      opponent: {
        role: opp.role,
        cosmetic: opp.cosmetic,
        perks: opp.stats.perks.slice(),
        visible: oppVisible,
        x: oppVisible ? roundCoord(opp.x) : null,
        y: oppVisible ? roundCoord(opp.y) : null,
        aimAngle: oppVisible ? Math.round(opp.aimAngle * 100) / 100 : null,
        hearts: opp.hearts,
        maxHearts: opp.maxHearts,
        parry: opp.parry,
        dashActive: oppVisible ? opp.dashTimer > 0 : false,
        revealedByShot: opp.revealTimer > 0
      },
      lastKnownOpponent: self.lastKnownOpponent
        ? {
            x: self.lastKnownOpponent.x,
            y: self.lastKnownOpponent.y,
            aimAngle: self.lastKnownOpponent.aimAngle,
            age: Math.round(self.lastKnownOpponent.age * 100) / 100,
            maxAge: self.lastKnownOpponent.maxAge
          }
        : null,
      projectiles: match.projectiles.map(p => ({
        id: p.id,
        ownerRole: p.ownerRole,
        x: roundCoord(p.x),
        y: roundCoord(p.y),
        vx: roundCoord(p.vx),
        vy: roundCoord(p.vy),
        r: p.r,
        damage: p.damage
      })),
      footsteps: visibleFootsteps,
      dodgeTrails: visibleTrails
    };
  }

  // Chaque joueuse voit sa propre sorcière en bas et l'adversaire en haut.
  // Le monde reste arbitré côté créatrice ; ces helpers ne font que convertir
  // l'écran local de l'invitée (pivoté de 180°) vers le monde, et inversement.
  function orientCommandForRole(role, cmd) {
    if (!cmd || typeof cmd !== 'object' || role !== 'opponent') return cmd;
    const out = { ...cmd };
    if (Number.isFinite(Number(out.moveX))) out.moveX = -Number(out.moveX);
    if (Number.isFinite(Number(out.moveY))) out.moveY = -Number(out.moveY);
    if (out.targetX != null && Number.isFinite(Number(out.targetX))) out.targetX = ARENA_WIDTH - Number(out.targetX);
    if (out.targetY != null && Number.isFinite(Number(out.targetY))) out.targetY = ARENA_HEIGHT - Number(out.targetY);
    if (out.aimX != null && Number.isFinite(Number(out.aimX))) out.aimX = ARENA_WIDTH - Number(out.aimX);
    if (out.aimY != null && Number.isFinite(Number(out.aimY))) out.aimY = ARENA_HEIGHT - Number(out.aimY);
    return out;
  }

  function orientSnapshotForViewer(snapshot, viewerRole) {
    if (!snapshot || typeof snapshot !== 'object' || viewerRole !== 'opponent') return snapshot;
    const fx = x => (x != null && Number.isFinite(Number(x)) ? ARENA_WIDTH - Number(x) : x);
    const fy = y => (y != null && Number.isFinite(Number(y)) ? ARENA_HEIGHT - Number(y) : y);
    const fa = a => (a != null && Number.isFinite(Number(a)) ? Number(a) + Math.PI : a);
    const out = { ...snapshot };
    out.self = { ...snapshot.self, x: fx(snapshot.self.x), y: fy(snapshot.self.y), aimAngle: fa(snapshot.self.aimAngle) };
    out.opponent = { ...snapshot.opponent };
    if (snapshot.opponent.visible) {
      out.opponent.x = fx(snapshot.opponent.x);
      out.opponent.y = fy(snapshot.opponent.y);
      out.opponent.aimAngle = fa(snapshot.opponent.aimAngle);
    }
    if (snapshot.lastKnownOpponent) {
      out.lastKnownOpponent = {
        ...snapshot.lastKnownOpponent,
        x: fx(snapshot.lastKnownOpponent.x),
        y: fy(snapshot.lastKnownOpponent.y),
        aimAngle: fa(snapshot.lastKnownOpponent.aimAngle)
      };
    }
    out.projectiles = (snapshot.projectiles || []).map(p => ({ ...p, x: fx(p.x), y: fy(p.y), vx: -p.vx, vy: -p.vy }));
    out.footsteps = (snapshot.footsteps || []).map(s => ({ ...s, x: fx(s.x), y: fy(s.y) }));
    out.dodgeTrails = (snapshot.dodgeTrails || []).map(t => ({
      ...t,
      x1: fx(t.x1), y1: fy(t.y1),
      x2: fx(t.x2), y2: fy(t.y2)
    }));
    return out;
  }

  return Object.freeze({
    ARENA_WIDTH,
    ARENA_HEIGHT,
    ARENA_CENTER,
    BASE_HEARTS,
    ROUND_DURATION,
    ROUNDS_TO_WIN,
    MAX_ROUNDS,
    BURST_COUNT,
    BURST_INTERVAL,
    BASE_HALO_RADIUS,
    LUNAR_PULSE_EARLY_INTERVAL,
    LUNAR_PULSE_LATE_AT,
    LUNAR_PULSE_LATE_INTERVAL,
    ZONE_SHRINK_START,
    ZONE_INITIAL_RADIUS,
    ZONE_MIN_RADIUS,
    SUDDEN_DEATH_AT,
    HIT_RADIUS,
    DODGE_PROXIMITY_RADIUS,
    INITIAL_RATING,
    RATING_DIFF_THRESHOLD,
    DAILY_RANKED_PAIR_LIMIT,
    WAGER_AMOUNT,
    WAGER_POT,
    PERK_CATALOG,
    COSMETIC_HALOS,
    getHaloCosmetic,
    validatePerks,
    extractDuelId,
    buildInviteUrl,
    buildShareLinks,
    parisDateKey,
    computeRatingDelta,
    canPlayRankedToday,
    createDuelProfile,
    unlockHaloInProfile,
    equipHaloInProfile,
    createConsensusState,
    submitConsensusReport,
    forfeitConsensusState,
    computeStats,
    createMatch,
    startNextRound,
    applyCommand,
    isOpponentVisible,
    stepMatch,
    createSnapshotFor,
    orientCommandForRole,
    orientSnapshotForViewer
  });
});
