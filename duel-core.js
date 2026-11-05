/* La Nuit aux Trousses — Cœur déterministe du Duel de la Nuit noire.
   Partagé entre le navigateur (window.NightDuelCore) et les tests Node (CommonJS).
   Isolé de la campagne, de l’Arsenal, des compagnons, de l’XP et des highscores. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NightDuelCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // Le monde est 5x plus vaste en surface que l'ancien écran (800x900).
  // L'écran n'affiche qu'une fenêtre (VIEW) centrée sur la sorcière locale.
  const WORLD_WIDTH = 1800;
  const WORLD_HEIGHT = 2000;
  const VIEW_WIDTH = 800;
  const VIEW_HEIGHT = 900;
  const ARENA_WIDTH = WORLD_WIDTH;
  const ARENA_HEIGHT = WORLD_HEIGHT;
  const ARENA_CENTER = Object.freeze({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });
  const ARENA_PADDING_X = 40;
  const ARENA_PADDING_Y = 40;
  const SPAWN_CREATOR = Object.freeze({ x: ARENA_CENTER.x, y: WORLD_HEIGHT - 220 });
  const SPAWN_OPPONENT = Object.freeze({ x: ARENA_CENTER.x, y: 220 });

  // Décor / gameplay de l'arène vaste.
  const CRATE_HP = 2;
  const CRATE_RADIUS = 22;
  const BOMB_RADIUS = 18;
  const BOMB_TRIGGER_RADIUS = 34;
  const BOMB_BLAST_RADIUS = 150;
  const TRAP_RADIUS = 26;
  const TRAP_COOLDOWN = 4.0;
  const ENEMY_RADIUS = 20;
  const ENEMY_HP = 3;
  const ENEMY_SPEED = 120;
  const ENEMY_MELEE_CD = 1.15;
  const ENEMY_SHOOT_CD = 2.3;
  const ENEMY_SHOT_SPEED = 240;
  const ENEMY_WAKE_RADIUS = 330;
  const ENEMY_SLEEP_RETURN = 7.5;
  const ENEMY_PATROL_RADIUS = 170;
  const ENEMY_PATROL_SPEED = 48;
  const ENEMY_AGGRO_RADIUS = 470;
  const ENEMY_LOSE_AGGRO = 1.15;
  const ENEMY_KINDS = Object.freeze(['ghost', 'bat', 'spider', 'zombie', 'pumpkin', 'skull']);

  // Maps du duel. Par défaut on joue un duel pur, SANS monstre : c'est plus
  // lisible à deux et surtout plus simple à viser sur téléphone. Tout le moteur
  // des sentinelles est conservé et reste actif sur la Forêt hantée, prête pour
  // le futur choix de map / difficulté.
  const DUEL_MAPS = Object.freeze([
    Object.freeze({
      id: 'clairiere',
      name: 'Clairière silencieuse',
      tagline: 'Duel pur · aucun monstre',
      description: 'Seule la sorcière adverse compte : caisses à atouts, pièges et bombes, mais aucune créature.',
      enemyPairs: 0
    }),
    Object.freeze({
      id: 'foret-hantee',
      name: 'Forêt hantée',
      tagline: 'Sentinelles endormies',
      description: 'Le décor vivant : les sentinelles dorment, se réveillent dans la lumière puis reprennent leur ronde.',
      enemyPairs: 5
    })
  ]);
  const DEFAULT_DUEL_MAP_ID = 'clairiere';
  const DUEL_MAP_INDEX = new Map(DUEL_MAPS.map(map => [map.id, map]));
  function getDuelMap(mapId) {
    return DUEL_MAP_INDEX.get(String(mapId || '')) || DUEL_MAP_INDEX.get(DEFAULT_DUEL_MAP_ID);
  }

  // Difficulté : ne touche que les maps peuplées. Le duel sans monstre reste
  // identique quelle que soit la difficulté choisie.
  const DUEL_DIFFICULTIES = Object.freeze([
    Object.freeze({ id: 'douce', name: 'Douce', enemyPairsDelta: -2, enemySpeedFactor: 0.8 }),
    Object.freeze({ id: 'normale', name: 'Normale', enemyPairsDelta: 0, enemySpeedFactor: 1 }),
    Object.freeze({ id: 'cauchemar', name: 'Cauchemar', enemyPairsDelta: 3, enemySpeedFactor: 1.2 })
  ]);
  const DEFAULT_DUEL_DIFFICULTY = 'normale';
  const DUEL_DIFFICULTY_INDEX = new Map(DUEL_DIFFICULTIES.map(level => [level.id, level]));
  function getDuelDifficulty(difficulty) {
    return DUEL_DIFFICULTY_INDEX.get(String(difficulty || '')) || DUEL_DIFFICULTY_INDEX.get(DEFAULT_DUEL_DIFFICULTY);
  }
  const PICKUP_RADIUS = 16;
  const PICKUP_LIFE = 22;
  const ALARM_LIFE = 4.0;
  const BOON_DURATION = 12;

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
  const ZONE_INITIAL_RADIUS = 1320;
  const ZONE_MIN_RADIUS = 430;
  const ZONE_SUDDEN_DEATH_MIN = 330;
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
      moveSpeed: 275 * speedFactor,
      focusSpeed: 150 * speedFactor,
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

  // ------------------------------------------------------------------
  // Monde vaste : décor solide, pièges, bombes, caisses, ennemis endormis,
  // atouts temporaires et alarmes de minimap. Tout est déterministe (seed).
  // ------------------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    let h = 2166136261;
    const text = String(str || 'nuit');
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const BOON_TYPES = Object.freeze(['heal', 'swift', 'rapid', 'power', 'ward', 'ghost', 'dash']);
  const BOON_LABELS = Object.freeze({
    heal: 'Cœur rendu',
    swift: 'Vol rapide',
    rapid: 'Cadence vive',
    power: 'Tir puissant',
    ward: 'Parade',
    ghost: 'Voile furtif',
    dash: 'Bond léger'
  });

  function effectiveStats(w) {
    const b = w.baseStats;
    const out = { ...b, sideAngles: b.sideAngles.slice(), perks: b.perks.slice() };
    const bo = w.boons || {};
    if (bo.swift > 0) { out.moveSpeed *= 1.25; out.focusSpeed *= 1.18; }
    if (bo.rapid > 0) { out.burstInterval *= 0.72; out.burstStep *= 0.85; }
    if (bo.power > 0) { out.shotDamage += 1; }
    if (bo.ghost > 0) { out.stealthFactor *= 0.7; out.shotRevealDuration *= 0.6; }
    if (bo.dash > 0) { out.dashCooldown *= 0.65; }
    return out;
  }

  function emptyBoons() {
    return { swift: 0, rapid: 0, power: 0, ghost: 0, dash: 0 };
  }

  function mirrorEntity(e) {
    const m = { ...e };
    if (e.shape === 'rect') {
      m.x = WORLD_WIDTH - e.x - e.w;
      m.y = WORLD_HEIGHT - e.y - e.h;
    } else {
      m.x = WORLD_WIDTH - e.x;
      m.y = WORLD_HEIGHT - e.y;
    }
    if (typeof e.homeX === 'number') { m.homeX = WORLD_WIDTH - e.homeX; m.homeY = WORLD_HEIGHT - e.homeY; }
    return m;
  }

  function chooseSpawns(match) {
    const rng = match.rng;
    const margin = 180;
    const minCenterDist = 380;
    // Spawns aléatoires partout dans la map, en miroir 180° pour l'équité,
    // déterministes par match/manche, et jamais collés au centre.
    let x = ARENA_CENTER.x;
    let y = WORLD_HEIGHT - margin;
    for (let i = 0; i < 60; i += 1) {
      const cx = margin + rng() * (WORLD_WIDTH - margin * 2);
      const cy = margin + rng() * (WORLD_HEIGHT - margin * 2);
      if (Math.hypot(cx - ARENA_CENTER.x, cy - ARENA_CENTER.y) >= minCenterDist) {
        x = cx; y = cy; break;
      }
    }
    const creator = { x: Math.round(x), y: Math.round(y) };
    const opponent = { x: WORLD_WIDTH - creator.x, y: WORLD_HEIGHT - creator.y };
    match.spawns = { creator, opponent };
    return match.spawns;
  }

  function buildWorld(match) {
    const map = getDuelMap(match.mapId);
    const difficulty = getDuelDifficulty(match.difficulty);
    const rng = mulberry32((match.seed + match.round * 104729) >>> 0);
    const world = { obstacles: [], crates: [], bombs: [], traps: [], enemies: [], pickups: [], alarms: [] };
    const placed = [];
    const corridor = { x1: ARENA_CENTER.x - 110, x2: ARENA_CENTER.x + 110, y1: 140, y2: WORLD_HEIGHT - 140 };

    function inCorridor(x, y, r) {
      return x + r > corridor.x1 && x - r < corridor.x2 && y + r > corridor.y1 && y - r < corridor.y2;
    }
    const spawns = match.spawns || { creator: SPAWN_CREATOR, opponent: SPAWN_OPPONENT };
    function nearSpawn(x, y, r) {
      return Math.hypot(x - spawns.creator.x, y - spawns.creator.y) < 300 + r ||
             Math.hypot(x - spawns.opponent.x, y - spawns.opponent.y) < 300 + r;
    }
    function inSpawnLane(x, y, r) {
      // Couloir dégagé entre chaque spawn et le centre, pour une approche équitable.
      const d1 = distancePointToSegment(x, y, spawns.creator.x, spawns.creator.y, ARENA_CENTER.x, ARENA_CENTER.y);
      const d2 = distancePointToSegment(x, y, spawns.opponent.x, spawns.opponent.y, ARENA_CENTER.x, ARENA_CENTER.y);
      return d1 < 150 + r || d2 < 150 + r;
    }
    function overlaps(x, y, r) {
      for (const q of placed) {
        if (Math.hypot(x - q.x, y - q.y) < r + q.r + 26) return true;
      }
      return false;
    }
    function spot(r) {
      for (let i = 0; i < 80; i += 1) {
        const x = 120 + rng() * (WORLD_WIDTH - 240);
        const y = 150 + rng() * (WORLD_HEIGHT - 300);
        if (inCorridor(x, y, r) || inSpawnLane(x, y, r) || nearSpawn(x, y, r) || overlaps(x, y, r)) continue;
        // On ne garde que la moitié haute ; l'autre moitié est le miroir 180°.
        if (y > ARENA_CENTER.y - 40) continue;
        placed.push({ x, y, r });
        placed.push({ x: WORLD_WIDTH - x, y: WORLD_HEIGHT - y, r });
        return { x, y };
      }
      return null;
    }
    function addPair(list, maker, r) {
      const pos = spot(r);
      if (!pos) return;
      const a = maker(pos.x, pos.y);
      a.id = ++match.entitySeq;
      const b = mirrorEntity(a);
      b.id = ++match.entitySeq;
      list.push(a, b);
    }

    // Rochers / ruines solides.
    for (let i = 0; i < 11; i += 1) {
      const isRect = rng() < 0.45;
      if (isRect) {
        const w = 90 + rng() * 90;
        const h = 42 + rng() * 40;
        addPair(world.obstacles, (x, y) => ({ type: 'obstacle', shape: 'rect', x: x - w / 2, y: y - h / 2, w, h, r: Math.max(w, h) / 2 }), Math.max(w, h) / 2);
      } else {
        const r = 34 + rng() * 30;
        addPair(world.obstacles, (x, y) => ({ type: 'obstacle', shape: 'circle', x, y, r }), r);
      }
    }
    // Caisses à atouts.
    for (let i = 0; i < 8; i += 1) {
      addPair(world.crates, (x, y) => ({ type: 'crate', shape: 'circle', x, y, r: CRATE_RADIUS, hp: CRATE_HP, alive: true }), CRATE_RADIUS);
    }
    // Bombes révélatrices.
    for (let i = 0; i < 5; i += 1) {
      addPair(world.bombs, (x, y) => ({ type: 'bomb', shape: 'circle', x, y, r: BOMB_RADIUS, alive: true }), BOMB_RADIUS);
    }
    // Pièges de contact.
    for (let i = 0; i < 5; i += 1) {
      addPair(world.traps, (x, y) => ({ type: 'trap', shape: 'circle', x, y, r: TRAP_RADIUS, cooldown: 0 }), TRAP_RADIUS);
    }
    // Sentinelles endormies : uniquement sur les maps qui en prévoient.
    // Générées en dernier, elles ne décalent jamais le décor des autres maps.
    const enemyPairs = map.enemyPairs > 0 ? Math.max(1, map.enemyPairs + difficulty.enemyPairsDelta) : 0;
    match.enemySpeedFactor = map.enemyPairs > 0 ? difficulty.enemySpeedFactor : 1;
    for (let i = 0; i < enemyPairs; i += 1) {
      addPair(world.enemies, (x, y) => ({
        type: 'enemy', shape: 'circle', x, y, r: ENEMY_RADIUS, hp: ENEMY_HP,
        kind: ENEMY_KINDS[Math.floor(rng() * ENEMY_KINDS.length)],
        state: 'sleep', targetRole: null, attackCd: 0, shootCd: 0, sleepTimer: 0,
        loseTimer: 0, patrolAngle: rng() * Math.PI * 2,
        perimeter: ENEMY_PATROL_RADIUS * (0.8 + rng() * 0.5),
        discovered: false, homeX: x, homeY: y
      }), ENEMY_RADIUS);
    }
    match.world = world;
  }

  function addAlarm(match, x, y, role, kind) {
    match.world.alarms.push({
      id: ++match.entitySeq,
      x: roundCoord(x), y: roundCoord(y),
      role: role || 'world', kind: kind || 'reveal',
      age: 0, maxAge: ALARM_LIFE
    });
    match.events.push({ type: 'alarm', role: role || 'world', kind: kind || 'reveal', x: roundCoord(x), y: roundCoord(y) });
  }

  function wakeEnemies(match, x, y, radius, role) {
    for (const enemy of match.world.enemies) {
      if (enemy.state === 'dead') continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) <= radius + enemy.r) {
        const wasSleep = enemy.state === 'sleep' || enemy.state === 'patrol';
        enemy.state = 'awake';
        enemy.targetRole = role;
        enemy.sleepTimer = 0;
        enemy.loseTimer = 0;
        enemy.discovered = true;
        if (wasSleep) match.events.push({ type: 'enemy-wake', enemyId: enemy.id, role });
      }
    }
  }

  function markRevealed(match, w, duration, kind) {
    w.revealTimer = Math.max(w.revealTimer, duration);
    wakeEnemies(match, w.x, w.y, ENEMY_WAKE_RADIUS, w.role);
    // Une seule alarme par rafale : on évite de spammer la minimap.
    if (w.lastAlarmAt == null || match.roundTime - w.lastAlarmAt >= 0.8) {
      w.lastAlarmAt = match.roundTime;
      addAlarm(match, w.x, w.y, w.role, kind);
    }
    const other = match.witches[w.role === 'creator' ? 'opponent' : 'creator'];
    if (other) {
      other.lastKnownOpponent = {
        x: roundCoord(w.x), y: roundCoord(w.y),
        aimAngle: Math.round(w.aimAngle * 100) / 100,
        age: 0, maxAge: 6.0
      };
    }
  }

  function applyBoon(match, w, type) {
    if (type === 'heal') {
      w.hearts = Math.min(w.maxHearts, w.hearts + 1);
    } else if (type === 'ward') {
      w.parry = Math.min(2, w.parry + 1);
      w.invTimer = Math.max(w.invTimer, 0.5);
    } else if (w.boons && type in w.boons) {
      w.boons[type] = BOON_DURATION;
    }
    match.events.push({ type: 'pickup', role: w.role, boon: type, label: BOON_LABELS[type] || type });
  }

  function randomBoon(rng) {
    return BOON_TYPES[Math.floor(rng() * BOON_TYPES.length)];
  }

  function spawnPickup(match, x, y, type) {
    match.world.pickups.push({
      id: ++match.entitySeq,
      type: 'pickup', x: roundCoord(x), y: roundCoord(y), r: PICKUP_RADIUS,
      boon: type || randomBoon(match.rng), age: 0, maxAge: PICKUP_LIFE
    });
  }

  function breakCrate(match, crate) {
    if (!crate.alive) return;
    crate.alive = false;
    spawnPickup(match, crate.x, crate.y);
    match.effects.push({ id: ++match.entitySeq, type: 'crate-break', x: crate.x, y: crate.y, age: 0, maxAge: 0.6, r: CRATE_RADIUS });
    match.events.push({ type: 'crate-break', crateId: crate.id });
  }

  function damageWitch(match, target, amount, attackerRole, kind) {
    if (!target || target.hearts <= 0) return;
    if (target.invTimer > 0 || target.dashTimer > 0) return;
    if (match.suddenDeath) {
      target.parry = 0;
      target.hearts = 0;
    } else if (target.parry > 0) {
      target.parry -= 1;
      target.hearts = Math.max(0, target.hearts - 1);
    } else {
      target.hearts = Math.max(0, target.hearts - amount);
    }
    target.invTimer = 0.55;
    markRevealed(match, target, HIT_REVEAL_DURATION, kind || 'hit');
    match.events.push({
      type: 'hit', targetRole: target.role, attackerRole: attackerRole || 'world',
      remainingHearts: target.hearts, kind: kind || 'hit', time: match.roundTime
    });
  }

  function explodeBomb(match, bomb, sourceRole) {
    if (!bomb.alive) return;
    bomb.alive = false;
    match.effects.push({ id: ++match.entitySeq, type: 'explosion', x: bomb.x, y: bomb.y, age: 0, maxAge: 0.7, r: BOMB_BLAST_RADIUS });
    match.events.push({ type: 'bomb-explode', bombId: bomb.id, role: sourceRole || 'world' });
    addAlarm(match, bomb.x, bomb.y, sourceRole || 'world', 'bomb');
    wakeEnemies(match, bomb.x, bomb.y, BOMB_BLAST_RADIUS * 1.6, sourceRole || 'world');
    for (const role of ['creator', 'opponent']) {
      const w = match.witches[role];
      if (Math.hypot(w.x - bomb.x, w.y - bomb.y) <= BOMB_BLAST_RADIUS + HIT_RADIUS) {
        damageWitch(match, w, 1, sourceRole || 'world', 'bomb');
        markRevealed(match, w, 1.1, 'bomb');
      }
    }
    for (const crate of match.world.crates) {
      if (crate.alive && Math.hypot(crate.x - bomb.x, crate.y - bomb.y) <= BOMB_BLAST_RADIUS + crate.r) breakCrate(match, crate);
    }
    for (const enemy of match.world.enemies) {
      if (enemy.state !== 'dead' && Math.hypot(enemy.x - bomb.x, enemy.y - bomb.y) <= BOMB_BLAST_RADIUS + enemy.r) {
        enemy.hp -= 2;
        enemy.discovered = true;
        if (enemy.hp <= 0) killEnemy(match, enemy, sourceRole);
      }
    }
    // Réaction en chaîne des bombes voisines.
    for (const other of match.world.bombs) {
      if (other.alive && Math.hypot(other.x - bomb.x, other.y - bomb.y) <= BOMB_BLAST_RADIUS + other.r) {
        explodeBomb(match, other, sourceRole);
      }
    }
  }

  function killEnemy(match, enemy, killerRole) {
    if (enemy.state === 'dead') return;
    enemy.state = 'dead';
    enemy.hp = 0;
    match.effects.push({ id: ++match.entitySeq, type: 'enemy-death', x: enemy.x, y: enemy.y, age: 0, maxAge: 0.8, r: ENEMY_RADIUS });
    spawnPickup(match, enemy.x, enemy.y);
    if (killerRole === 'creator' || killerRole === 'opponent') {
      const w = match.witches[killerRole];
      applyBoon(match, w, randomBoon(match.rng));
      match.events.push({ type: 'enemy-killed', enemyId: enemy.id, role: killerRole });
    }
  }

  function circleRectPush(w, rect) {
    const cx = Math.max(rect.x, Math.min(w.x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(w.y, rect.y + rect.h));
    let dx = w.x - cx;
    let dy = w.y - cy;
    let dist = Math.hypot(dx, dy);
    if (dist >= HIT_RADIUS) return;
    if (dist < 1e-4) {
      // Centre dans le rect : pousser vers le bord le plus proche.
      const left = w.x - rect.x, right = rect.x + rect.w - w.x;
      const top = w.y - rect.y, bottom = rect.y + rect.h - w.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) w.x = rect.x - HIT_RADIUS;
      else if (m === right) w.x = rect.x + rect.w + HIT_RADIUS;
      else if (m === top) w.y = rect.y - HIT_RADIUS;
      else w.y = rect.y + rect.h + HIT_RADIUS;
      return;
    }
    const push = (HIT_RADIUS - dist) / dist;
    w.x += dx * push;
    w.y += dy * push;
  }

  function resolveWorldCollisions(match, w) {
    for (const ob of match.world.obstacles) {
      if (ob.shape === 'rect') circleRectPush(w, ob);
      else {
        const dx = w.x - ob.x, dy = w.y - ob.y;
        const dist = Math.hypot(dx, dy);
        const min = ob.r + HIT_RADIUS;
        if (dist < min && dist > 1e-4) {
          w.x = ob.x + (dx / dist) * min;
          w.y = ob.y + (dy / dist) * min;
        }
      }
    }
    for (const crate of match.world.crates) {
      if (!crate.alive) continue;
      const dx = w.x - crate.x, dy = w.y - crate.y;
      const dist = Math.hypot(dx, dy);
      const min = crate.r + HIT_RADIUS;
      if (dist < min && dist > 1e-4) {
        w.x = crate.x + (dx / dist) * min;
        w.y = crate.y + (dy / dist) * min;
      }
    }
  }

  function segmentHitsRect(x1, y1, x2, y2, rect, pad) {
    const rx = rect.x - pad, ry = rect.y - pad, rw = rect.w + pad * 2, rh = rect.h + pad * 2;
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
    for (let i = 0; i < 4; i += 1) {
      if (Math.abs(p[i]) < 1e-9) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  }

  function projectileHitsWorld(match, p) {
    // Renvoie true si le projectile doit disparaître.
    for (const ob of match.world.obstacles) {
      if (ob.shape === 'rect') {
        if (segmentHitsRect(p.prevX, p.prevY, p.x, p.y, ob, p.r)) return true;
      } else if (distancePointToSegment(ob.x, ob.y, p.prevX, p.prevY, p.x, p.y) <= ob.r + p.r) {
        return true;
      }
    }
    if (p.ownerRole === 'enemy') return false;
    for (const crate of match.world.crates) {
      if (!crate.alive) continue;
      if (distancePointToSegment(crate.x, crate.y, p.prevX, p.prevY, p.x, p.y) <= crate.r + p.r) {
        crate.hp -= p.damage;
        if (crate.hp <= 0) breakCrate(match, crate);
        return true;
      }
    }
    for (const bomb of match.world.bombs) {
      if (!bomb.alive) continue;
      if (distancePointToSegment(bomb.x, bomb.y, p.prevX, p.prevY, p.x, p.y) <= bomb.r + p.r) {
        explodeBomb(match, bomb, p.ownerRole);
        return true;
      }
    }
    for (const enemy of match.world.enemies) {
      if (enemy.state === 'dead') continue;
      if (distancePointToSegment(enemy.x, enemy.y, p.prevX, p.prevY, p.x, p.y) <= enemy.r + p.r) {
        enemy.hp -= p.damage;
        enemy.discovered = true;
        if (enemy.state === 'sleep') { enemy.state = 'awake'; enemy.targetRole = p.ownerRole; }
        if (enemy.hp <= 0) killEnemy(match, enemy, p.ownerRole);
        else match.events.push({ type: 'enemy-hit', enemyId: enemy.id, role: p.ownerRole });
        return true;
      }
    }
    return false;
  }

  function updateWorld(match, dt) {
    const world = match.world;
    const enemySpeedFactor = Number(match.enemySpeedFactor) > 0 ? Number(match.enemySpeedFactor) : 1;
    for (const trap of world.traps) trap.cooldown = Math.max(0, trap.cooldown - dt);

    // Contact joueuses -> pièges / bombes / pickups.
    for (const role of ['creator', 'opponent']) {
      const w = match.witches[role];
      if (w.hearts <= 0) continue;
      for (const trap of world.traps) {
        if (trap.cooldown > 0) continue;
        if (Math.hypot(w.x - trap.x, w.y - trap.y) <= trap.r + HIT_RADIUS) {
          trap.cooldown = TRAP_COOLDOWN;
          match.effects.push({ id: ++match.entitySeq, type: 'trap', x: trap.x, y: trap.y, age: 0, maxAge: 0.6, r: TRAP_RADIUS });
          damageWitch(match, w, 1, 'world', 'trap');
          markRevealed(match, w, 0.9, 'trap');
          match.events.push({ type: 'trap-trigger', role, trapId: trap.id });
        }
      }
      for (const bomb of world.bombs) {
        if (!bomb.alive) continue;
        if (Math.hypot(w.x - bomb.x, w.y - bomb.y) <= BOMB_TRIGGER_RADIUS + HIT_RADIUS) {
          explodeBomb(match, bomb, role);
        }
      }
      for (const pickup of world.pickups) {
        if (pickup.taken) continue;
        if (Math.hypot(w.x - pickup.x, w.y - pickup.y) <= pickup.r + HIT_RADIUS + 4) {
          pickup.taken = true;
          applyBoon(match, w, pickup.boon);
        }
      }
    }
    world.pickups = world.pickups.filter(pk => !pk.taken && pk.age < pk.maxAge);
    for (const pk of world.pickups) pk.age += dt;

    // Sentinelles : sommeil -> ronde dans le périmètre -> éveil par la lumière.
    // Si la joueuse quitte la lumière, la sentinelle perd l'aggro, retourne en
    // ronde puis se rendort. Elles ne sont visibles que dans la lumière.
    function pushEnemyOutOfObstacles(enemy) {
      for (const ob of world.obstacles) {
        if (ob.shape === 'rect') circleRectPush(enemy, ob);
        else {
          const dx = enemy.x - ob.x, dy = enemy.y - ob.y;
          const d = Math.hypot(dx, dy), min = ob.r + enemy.r;
          if (d < min && d > 1e-4) { enemy.x = ob.x + (dx / d) * min; enemy.y = ob.y + (dy / d) * min; }
        }
      }
    }
    function witchLightEngages(enemy, w) {
      const dist = Math.hypot(w.x - enemy.x, w.y - enemy.y);
      const halo = dist <= w.stats.haloRadius + enemy.r + 24;
      const revealed = w.revealTimer > 0 && dist <= ENEMY_AGGRO_RADIUS;
      const lunar = match.lunarRevealTimer > 0 && dist <= ENEMY_AGGRO_RADIUS;
      return { dist, halo, engaged: dist <= ENEMY_AGGRO_RADIUS && (halo || revealed || lunar) };
    }
    for (const enemy of world.enemies) {
      if (enemy.state === 'dead') continue;

      // Réveil continu par le halo d'une sorcière (la lumière touche la sentinelle).
      if (enemy.state === 'sleep' || enemy.state === 'patrol') {
        let wokenBy = null;
        for (const role of ['creator', 'opponent']) {
          const w = match.witches[role];
          if (w.hearts <= 0) continue;
          if (witchLightEngages(enemy, w).halo) { wokenBy = role; break; }
        }
        if (wokenBy) {
          const wasSleep = enemy.state === 'sleep';
          enemy.state = 'awake';
          enemy.targetRole = wokenBy;
          enemy.sleepTimer = 0;
          enemy.loseTimer = 0;
          enemy.discovered = true;
          if (wasSleep) match.events.push({ type: 'enemy-wake', enemyId: enemy.id, role: wokenBy });
        }
      }

      if (enemy.state === 'sleep') {
        enemy.sleepTimer = 0;
        continue;
      }

      if (enemy.state === 'patrol') {
        enemy.sleepTimer += dt;
        if (enemy.sleepTimer >= ENEMY_SLEEP_RETURN) {
          enemy.state = 'sleep';
          enemy.sleepTimer = 0;
          continue;
        }
        enemy.patrolAngle += dt * ((ENEMY_PATROL_SPEED * enemySpeedFactor) / Math.max(60, enemy.perimeter));
        const tx = enemy.homeX + Math.cos(enemy.patrolAngle) * enemy.perimeter;
        const ty = enemy.homeY + Math.sin(enemy.patrolAngle) * enemy.perimeter;
        const dx = tx - enemy.x, dy = ty - enemy.y;
        const d = Math.hypot(dx, dy);
        if (d > 2) {
          const step = Math.min(d, ENEMY_PATROL_SPEED * enemySpeedFactor * dt);
          enemy.x += (dx / d) * step;
          enemy.y += (dy / d) * step;
        }
        pushEnemyOutOfObstacles(enemy);
        continue;
      }

      // Éveillée : ne poursuit que si la cible est dans sa lumière / révélée.
      let target = match.witches[enemy.targetRole];
      let info = target && target.hearts > 0 ? witchLightEngages(enemy, target) : { dist: Infinity, engaged: false };
      if (!info.engaged) {
        const otherRole = enemy.targetRole === 'creator' ? 'opponent' : 'creator';
        const other = match.witches[otherRole];
        const otherInfo = other && other.hearts > 0 ? witchLightEngages(enemy, other) : { dist: Infinity, engaged: false };
        if (otherInfo.engaged) {
          enemy.targetRole = otherRole;
          target = other;
          info = otherInfo;
        }
      }
      if (!info.engaged) {
        enemy.loseTimer += dt;
        if (enemy.loseTimer >= ENEMY_LOSE_AGGRO) {
          enemy.state = 'patrol';
          enemy.targetRole = null;
          enemy.loseTimer = 0;
          enemy.sleepTimer = 0;
          enemy.patrolAngle = Math.atan2(enemy.y - enemy.homeY, enemy.x - enemy.homeX);
          match.events.push({ type: 'enemy-calmed', enemyId: enemy.id });
          continue;
        }
      } else {
        enemy.loseTimer = 0;
      }

      enemy.attackCd = Math.max(0, enemy.attackCd - dt);
      enemy.shootCd = Math.max(0, enemy.shootCd - dt);
      const dist = info.dist;
      if (target && target.hearts > 0 && dist > 1) {
        const step = Math.min(dist, ENEMY_SPEED * enemySpeedFactor * dt);
        enemy.x += ((target.x - enemy.x) / dist) * step;
        enemy.y += ((target.y - enemy.y) / dist) * step;
      }
      pushEnemyOutOfObstacles(enemy);
      if (target && target.hearts > 0 && dist <= enemy.r + HIT_RADIUS + 8 && enemy.attackCd <= 0) {
        enemy.attackCd = ENEMY_MELEE_CD;
        damageWitch(match, target, 1, 'enemy', 'enemy-melee');
        match.events.push({ type: 'enemy-attack', enemyId: enemy.id, targetRole: target.role });
      } else if (target && target.hearts > 0 && dist > 140 && dist < 470 && enemy.shootCd <= 0) {
        enemy.shootCd = ENEMY_SHOOT_CD;
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        match.projectiles.push({
          id: ++match.entitySeq, ownerRole: 'enemy', enemyId: enemy.id,
          x: enemy.x, y: enemy.y, prevX: enemy.x, prevY: enemy.y,
          vx: Math.cos(angle) * ENEMY_SHOT_SPEED * enemySpeedFactor, vy: Math.sin(angle) * ENEMY_SHOT_SPEED * enemySpeedFactor,
          r: 7, damage: 1, life: 2.4, maxLife: 2.4
        });
        match.events.push({ type: 'enemy-shot', enemyId: enemy.id });
      }
    }

    for (const alarm of world.alarms) alarm.age += dt;
    world.alarms = world.alarms.filter(a => a.age < a.maxAge);
    for (const fx of match.effects) fx.age += dt;
    match.effects = match.effects.filter(fx => fx.age < fx.maxAge);
  }

  function createWitch(role, perks, cosmeticId) {
    const stats = computeStats(perks);
    const isCreator = role === 'creator';
    const spawn = isCreator ? SPAWN_CREATOR : SPAWN_OPPONENT;
    return {
      role,
      cosmetic: getHaloCosmetic(cosmeticId).id,
      baseStats: stats,
      stats,
      boons: emptyBoons(),
      x: spawn.x,
      y: spawn.y,
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
        targetX: spawn.x,
        targetY: spawn.y,
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
    match.rng = mulberry32((match.seed + match.round * 7919) >>> 0);
    chooseSpawns(match);
    const c = match.witches.creator;
    const o = match.witches.opponent;
    for (const [role, w] of [['creator', c], ['opponent', o]]) {
      const isCreator = role === 'creator';
      const spawn = match.spawns[role];
      w.x = spawn.x;
      w.y = spawn.y;
      w.vx = 0;
      w.vy = 0;
      w.aimAngle = isCreator ? -Math.PI / 2 : Math.PI / 2;
      w.boons = emptyBoons();
      w.stats = effectiveStats(w);
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
      w.lastAlarmAt = -10;
      w.cmd.moveX = 0;
      w.cmd.moveY = 0;
      w.cmd.hasTarget = false;
      w.cmd.targetX = spawn.x;
      w.cmd.targetY = spawn.y;
      w.cmd.hasAim = false;
      w.cmd.dash = false;
      w.cmd.fire = false;
    }
    buildWorld(match);
    match.effects = [];
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

    const id = opts.id || 'local-duel';
    const match = {
      id,
      seed: hashSeed(id),
      rng: mulberry32(hashSeed(id)),
      mode: opts.mode === 'ranked' ? 'ranked' : 'friendly',
      mapId: getDuelMap(opts.mapId).id,
      difficulty: getDuelDifficulty(opts.difficulty).id,
      enemySpeedFactor: 1,
      wager: opts.wager === WAGER_AMOUNT ? WAGER_AMOUNT : 0,
      seq: 0,
      entitySeq: 0,
      world: null,
      spawns: null,
      effects: [],
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

    markRevealed(match, w, w.stats.shotRevealDuration, 'shot');
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
      for (const key of Object.keys(w.boons)) w.boons[key] = Math.max(0, w.boons[key] - dt);
      w.stats = effectiveStats(w);

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
      resolveWorldCollisions(match, w);
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

      if (projectileHitsWorld(match, p)) {
        p.life = 0;
        continue;
      }

      const targets = p.ownerRole === 'enemy'
        ? [['creator', match.witches.creator], ['opponent', match.witches.opponent]]
        : [[p.ownerRole === 'creator' ? 'opponent' : 'creator', match.witches[p.ownerRole === 'creator' ? 'opponent' : 'creator']]];
      for (const [targetRole, target] of targets) {
        if (target.hearts <= 0) continue;
        const dist = distancePointToSegment(target.x, target.y, p.prevX, p.prevY, p.x, p.y);
        if (target.dodgeProtectTimer > 0 && !target.dodgeCredited && dist <= p.r + DODGE_PROXIMITY_RADIUS) {
          target.dodgeCredited = true;
          target.perfectDodges += 1;
          target.dodgeSuccessTimer = 0.7;
          match.events.push({ type: 'perfect-dodge', role: targetRole, time: match.roundTime });
        }
        if (dist <= p.r + HIT_RADIUS) {
          p.life = 0;
          damageWitch(match, target, p.damage, p.ownerRole, p.ownerRole === 'enemy' ? 'enemy-shot' : 'shot');
          break;
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

    updateWorld(match, dt);
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
      mapId: getDuelMap(match.mapId).id,
      difficulty: getDuelDifficulty(match.difficulty).id,
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
        revealed: self.revealTimer > 0 || match.lunarRevealTimer > 0,
        boons: {
          swift: Math.round(self.boons.swift * 100) / 100,
          rapid: Math.round(self.boons.rapid * 100) / 100,
          power: Math.round(self.boons.power * 100) / 100,
          ghost: Math.round(self.boons.ghost * 100) / 100,
          dash: Math.round(self.boons.dash * 100) / 100
        }
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
      dodgeTrails: visibleTrails,
      world: snapshotWorld(match, role),
      effects: match.effects.map(fx => ({
        id: fx.id, type: fx.type,
        x: roundCoord(fx.x), y: roundCoord(fx.y),
        age: Math.round(fx.age * 100) / 100, maxAge: fx.maxAge, r: fx.r
      }))
    };
  }

  // Brouillard de guerre : seuls les objets/monstres touchés par la lumière
  // (halo de la joueuse, lueur de tir, explosion) sont transmis au client.
  function lightRadiusFor(match, w) {
    return w.stats.haloRadius + (w.revealTimer > 0 ? 70 : 0);
  }
  function isLitFor(match, viewerRole, x, y, r = 0) {
    const w = match.witches[viewerRole];
    if (Math.hypot(x - w.x, y - w.y) <= lightRadiusFor(match, w) + r) return true;
    for (const fx of match.effects) {
      if (fx.type !== 'explosion') continue;
      const p = Math.max(0, 1 - fx.age / Math.max(0.1, fx.maxAge));
      if (Math.hypot(x - fx.x, y - fx.y) <= fx.r * p + r) return true;
    }
    return false;
  }
  function rectLitFor(match, viewerRole, ob) {
    const w = match.witches[viewerRole];
    const cx = Math.max(ob.x, Math.min(w.x, ob.x + ob.w));
    const cy = Math.max(ob.y, Math.min(w.y, ob.y + ob.h));
    return isLitFor(match, viewerRole, cx, cy, 0);
  }
  function snapshotWorld(match, viewerRole) {
    const world = match.world;
    const enemies = [];
    for (const enemy of world.enemies) {
      if (enemy.state === 'dead') continue;
      if (!isLitFor(match, viewerRole, enemy.x, enemy.y, enemy.r)) continue;
      enemy.discovered = true;
      enemies.push({
        id: enemy.id, x: roundCoord(enemy.x), y: roundCoord(enemy.y), r: enemy.r,
        hp: enemy.hp, state: enemy.state, targetRole: enemy.targetRole, kind: enemy.kind
      });
    }
    return {
      obstacles: world.obstacles.filter(ob => ob.shape === 'rect' ? rectLitFor(match, viewerRole, ob) : isLitFor(match, viewerRole, ob.x, ob.y, ob.r)).map(ob => ob.shape === 'rect'
        ? { id: ob.id, shape: 'rect', x: roundCoord(ob.x), y: roundCoord(ob.y), w: ob.w, h: ob.h }
        : { id: ob.id, shape: 'circle', x: roundCoord(ob.x), y: roundCoord(ob.y), r: ob.r }),
      crates: world.crates.filter(c => c.alive && isLitFor(match, viewerRole, c.x, c.y, c.r)).map(c => ({ id: c.id, x: roundCoord(c.x), y: roundCoord(c.y), r: c.r, hp: c.hp })),
      bombs: world.bombs.filter(b => b.alive && isLitFor(match, viewerRole, b.x, b.y, b.r)).map(b => ({ id: b.id, x: roundCoord(b.x), y: roundCoord(b.y), r: b.r })),
      traps: world.traps.filter(t => isLitFor(match, viewerRole, t.x, t.y, t.r)).map(t => ({ id: t.id, x: roundCoord(t.x), y: roundCoord(t.y), r: t.r, cooldown: Math.round(t.cooldown * 100) / 100 })),
      enemies,
      pickups: world.pickups.filter(pk => isLitFor(match, viewerRole, pk.x, pk.y, pk.r)).map(pk => ({ id: pk.id, x: roundCoord(pk.x), y: roundCoord(pk.y), r: pk.r, boon: pk.boon, age: Math.round(pk.age * 100) / 100, maxAge: pk.maxAge })),
      alarms: world.alarms.map(a => ({ id: a.id, x: roundCoord(a.x), y: roundCoord(a.y), role: a.role, kind: a.kind, age: Math.round(a.age * 100) / 100, maxAge: a.maxAge }))
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
    if (snapshot.world) {
      const w = snapshot.world;
      out.world = {
        obstacles: (w.obstacles || []).map(ob => ob.shape === 'rect'
          ? { ...ob, x: ARENA_WIDTH - ob.x - ob.w, y: ARENA_HEIGHT - ob.y - ob.h }
          : { ...ob, x: fx(ob.x), y: fy(ob.y) }),
        crates: (w.crates || []).map(c => ({ ...c, x: fx(c.x), y: fy(c.y) })),
        bombs: (w.bombs || []).map(b => ({ ...b, x: fx(b.x), y: fy(b.y) })),
        traps: (w.traps || []).map(t => ({ ...t, x: fx(t.x), y: fy(t.y) })),
        enemies: (w.enemies || []).map(e => ({ ...e, x: fx(e.x), y: fy(e.y) })),
        pickups: (w.pickups || []).map(pk => ({ ...pk, x: fx(pk.x), y: fy(pk.y) })),
        alarms: (w.alarms || []).map(a => ({ ...a, x: fx(a.x), y: fy(a.y) }))
      };
    }
    if (snapshot.effects) out.effects = snapshot.effects.map(fx2 => ({ ...fx2, x: fx(fx2.x), y: fy(fx2.y) }));
    return out;
  }

  return Object.freeze({
    WORLD_WIDTH,
    WORLD_HEIGHT,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    SPAWN_CREATOR,
    SPAWN_OPPONENT,
    BOON_TYPES,
    BOON_LABELS,
    CRATE_RADIUS,
    BOMB_BLAST_RADIUS,
    ENEMY_WAKE_RADIUS,
    ENEMY_PATROL_RADIUS,
    ENEMY_AGGRO_RADIUS,
    ENEMY_SPEED,
    ENEMY_PATROL_SPEED,
    ENEMY_SHOT_SPEED,
    ENEMY_KINDS,
    DUEL_MAPS,
    DEFAULT_DUEL_MAP_ID,
    getDuelMap,
    DUEL_DIFFICULTIES,
    DEFAULT_DUEL_DIFFICULTY,
    getDuelDifficulty,
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
