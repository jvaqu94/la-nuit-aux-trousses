/* La Nuit aux Trousses — Duel de la Nuit noire (1 contre 1 en temps réel).
   Simulation arbitrée par le client créateur, commandes seules côté invitée,
   snapshots filtrés sans coordonnées cachées, draft 3/10 indépendant de la campagne. */
(() => {
  'use strict';

  const Core = window.NightDuelCore;
  if (!Core) return;

  const PENDING_INVITE_KEY = 'minuit-night-duel-invite-v1';
  const SNAPSHOT_INTERVAL = 0.05;
  const CMD_INTERVAL = 0.033;

  const el = id => document.getElementById(id);
  const getCanvas = () => el('game') || el('canvas');
  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  let screenOpen = false;
  let combatActive = false;
  let combatPaused = false;
  let pendingInviteId = '';
  let profile = null;
  let duel = null;
  let players = [null, null];
  let createMode = 'ranked';
  let createWager = 0;
  let selectedPerks = ['comet-boots', 'dawn-halo', 'fleeting-dash'];
  let statusNotice = '';
  let statusError = false;
  let busy = false;

  // Invitations dans l'application : file entrante (popup), invitations envoyées,
  // et petit observateur qui interroge le serveur tant que le compte est connecté.
  let incomingInvites = [];
  let sentInvites = [];
  let invitePollTimer = null;
  let activeInvitePopup = null;
  let inviteRespondBusy = false;
  let inviteWatcherBound = false;
  let createInvitePseudo = '';
  let waitingInvitePseudo = '';
  let teamInfo = null;
  let teamPlayers = [];
  let teamPlayersLoading = false;
  let teamPlayersError = '';
  let teamPlayersRequestId = 0;
  const teamInviteBusyIds = new Set();
  const dismissedInviteIds = new Set();
  const INVITE_POLL_MS = 15000;

  // Contrôles tactiles volontairement directs : pas de courbe ni de lissage.
  // Le joystick répond linéairement, le 2e doigt vise exactement où il est, et
  // le bouton Tir aide à accrocher une cible visible devant soi.
  const TOUCH_MAX_DRAG = 64;
  const TOUCH_DEADZONE = 6;
  const TOUCH_MOVE_SCALE = 1;
  const AIM_ASSIST_SNAP_RADIUS = 46;
  const AIM_ASSIST_FIRE_RANGE = 460;
  const AIM_ASSIST_FIRE_COS = 0.82;
  // Flèches = pilotage relatif au balai : haut avance dans l'axe du balai,
  // bas recule, gauche/droite font pivoter le balai (quand la souris ne vise pas).
  const ARROW_TURN_RATE = 3.4; // rad/s

  let channel = null;
  let pollTimer = null;
  let hostMatch = null;
  let renderSnap = null;
  let snapshotAccum = 0;
  let cmdAccum = 0;
  let snapshotRequestAccum = 0;
  let lastSnapshotAt = 0;
  let dashSeq = 0;
  let finishSubmitting = false;
  let lastReportedDuelId = '';
  let reportedMatchKey = '';
  let basePauseLabel = '';
  let baseHintLabel = '';
  const duelKeys = new Set();
  let padDashHeld = false;
  let padPauseHeld = false;
  let fireButtonHeld = false;
  let keyboardHeading = null; // angle écran du balai piloté aux flèches
  let lastControlDt = 1 / 60;
  const duelCamera = { x: 0, y: 0 };

  const pointerState = {
    mouseAimActive: false,
    fireMouse: false,
    aimX: Core.ARENA_CENTER.x,
    aimY: Core.ARENA_CENTER.y,
    moveTouchId: null,
    moveOriginX: 0,
    moveOriginY: 0,
    moveCurrentX: 0,
    moveCurrentY: 0,
    touchMoveX: 0,
    touchMoveY: 0,
    aimTouchId: null
  };

  const baseOverlay = typeof overlay === 'function' ? overlay : null;
  const baseGrantDailyReward = window.Journey?.grantDailyReward
    ? window.Journey.grantDailyReward.bind(window.Journey)
    : null;

  function readInitialInvite() {
    let found = Core.extractDuelId(window.location?.href || '');
    if (found) {
      try {
        sessionStorage.setItem(PENDING_INVITE_KEY, found);
      } catch (_) {}
      cleanDuelParamFromUrl();
      return found;
    }
    try {
      found = Core.extractDuelId(sessionStorage.getItem(PENDING_INVITE_KEY) || '');
    } catch (_) {}
    return found;
  }

  function clearPendingInvite() {
    pendingInviteId = '';
    try {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
    } catch (_) {}
    cleanDuelParamFromUrl();
  }

  function cleanDuelParamFromUrl() {
    try {
      const current = new URL(window.location.href);
      if (!current.searchParams.has('duel')) return;
      current.searchParams.delete('duel');
      const next = current.pathname + (current.searchParams.toString() ? '?' + current.searchParams.toString() : '') + current.hash;
      window.history?.replaceState?.(null, '', next);
    } catch (_) {}
  }

  function isNightDuelBlockingOverlay() {
    return Boolean(screenOpen || combatActive || pendingInviteId);
  }

  if (baseOverlay) {
    overlay = function(html) {
      if (isNightDuelBlockingOverlay() && typeof html === 'string' && html.includes('daily-reward-screen')) {
        return;
      }
      return baseOverlay(html);
    };
  }

  if (window.Journey && baseGrantDailyReward) {
    window.Journey.grantDailyReward = function(...args) {
      if (isNightDuelBlockingOverlay()) return null;
      return baseGrantDailyReward(...args);
    };
  }

  function setGameState(next) {
    try {
      state = next;
    } catch (_) {}
  }

  function getGameState() {
    try {
      return state;
    } catch (_) {
      return '';
    }
  }

  function myUserId() {
    return window.MinuitCloud?.user?.id || profile?.id || '';
  }

  function myRole() {
    if (!duel) return 'creator';
    return duel.creatorId === myUserId() ? 'creator' : 'opponent';
  }

  function setStatus(message, isError = false) {
    statusNotice = String(message || '');
    statusError = Boolean(isError);
    const node = el('duelStatusMsg');
    if (node) {
      node.textContent = statusNotice;
      node.classList.toggle('is-error', statusError);
    }
  }

  function applyTouchLayoutPreference() {
    const layout = (typeof prefs === 'object' && prefs?.touchLayout === 'right') ? 'right' : 'left';
    if (document.body) document.body.dataset.touchLayout = layout;
    const stick = el('touchStick');
    if (stick) stick.dataset.touchLayout = layout;
    const bar = document.querySelector('.touchbar');
    if (bar) bar.dataset.touchLayout = layout;
  }

  function isolateFromCampaign() {
    window.SandboxMode = true;
    if (window.Journey) {
      window.Journey.run = null;
    }
    const special = el('specialCast');
    if (special) special.style.display = 'none';
    const runner = el('runnerControls');
    if (runner) runner.style.display = 'none';
    const mission = el('runnerMission');
    if (mission) mission.style.display = 'none';
    applyTouchLayoutPreference();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function closeChannel() {
    if (channel) {
      try {
        channel.close();
      } catch (_) {}
      channel = null;
    }
  }

  function hideTopHud() {
    const hud = el('duelTopHud');
    if (hud) hud.style.display = 'none';
    document.body?.classList.remove('night-duel-combat');
  }

  function teardownDuelRuntime() {
    stopPolling();
    closeChannel();
    combatActive = false;
    combatPaused = false;
    hostMatch = null;
    renderSnap = null;
    finishSubmitting = false;
    resetCombatInput();
    reportedMatchKey = '';
    const pauseBtn = el('pause');
    if (pauseBtn && basePauseLabel) pauseBtn.textContent = basePauseLabel;
    const hint = el('hint');
    if (hint && baseHintLabel) hint.textContent = baseHintLabel;
    const fireBtn = el('duelFire');
    if (fireBtn) fireBtn.style.display = 'none';
    fireButtonHeld = false;
    hideTopHud();
  }

  function leaveToHome() {
    teardownDuelRuntime();
    screenOpen = false;
    duel = null;
    players = [null, null];
    clearPendingInvite();
    window.SandboxMode = false;
    if (window.LocalLeague?.menu) window.LocalLeague.menu();
    else if (window.Journey?.menu) window.Journey.menu();
    else if (typeof menu === 'function') menu();
  }

  async function refreshProfile() {
    if (!window.MinuitCloud?.connected) return null;
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_profile', {});
      if (data && typeof data === 'object') profile = data;
      return profile;
    } catch (err) {
      setStatus(err?.message || 'Profil de duel indisponible.', true);
      return null;
    }
  }

  function ingestDuelPayload(payload) {
    if (!payload || !payload.duel) return;
    duel = payload.duel;
    players = Array.isArray(payload.players) ? payload.players : [null, null];
    const uid = myUserId();
    if (players[0]?.id === uid) profile = players[0];
    else if (players[1]?.id === uid) profile = players[1];
  }

  function ensureRealtimeChannel(duelId) {
    if (!window.MinuitCloud?.connected || !duelId) return;
    const expectedTopic = 'realtime:duel:' + duelId;
    if (channel && channel.topic === expectedTopic) return;
    closeChannel();
    try {
      channel = window.MinuitCloud.openDuelChannel(duelId, {
        onStatus(st) {
          if (st !== 'SUBSCRIBED') return;
          // À chaque (re)connexion on rattrape l'état du duel : un changement a pu
          // survenir pendant une coupure réseau ou un onglet/appareil en veille.
          syncDuelStatus(false);
          if (combatActive && myRole() === 'creator' && hostMatch) {
            sendGuestSnapshotNow();
          } else if (combatActive && myRole() === 'opponent') {
            lastSnapshotAt = Date.now();
            channel?.send('snapshot-request', {});
          }
        },
        onBroadcast(eventName, data) {
          handleRealtimeEvent(eventName, data || {});
        }
      });
    } catch (err) {
      setStatus(err?.message || 'Canal temps réel indisponible.', true);
    }
  }

  function sendGuestSnapshotNow() {
    if (!channel || !hostMatch || myRole() !== 'creator') return;
    const guestSnap = Core.createSnapshotFor(hostMatch, 'opponent');
    channel.send('snapshot', guestSnap);
  }

  function handleRealtimeEvent(eventName, data) {
    if (!duel) return;
    if (eventName === 'state-sync' || eventName === 'joined' || eventName === 'draft-ready' || eventName === 'forfeit' || eventName === 'report-submitted') {
      syncDuelStatus(false);
      return;
    }
    if (eventName === 'cmd' && combatActive && myRole() === 'creator' && hostMatch) {
      Core.applyCommand(hostMatch, 'opponent', {
        moveX: data.moveX,
        moveY: data.moveY,
        focus: data.focus,
        hasTarget: data.hasTarget,
        targetX: data.targetX,
        targetY: data.targetY,
        hasAim: data.hasAim,
        aimX: data.aimX,
        aimY: data.aimY,
        dash: data.dash,
        dashSeq: data.dashSeq,
        fire: data.fire
      });
      return;
    }
    if (eventName === 'snapshot-request' && combatActive && myRole() === 'creator' && hostMatch) {
      sendGuestSnapshotNow();
      return;
    }
    if (eventName === 'snapshot' && combatActive && myRole() === 'opponent') {
      lastSnapshotAt = Date.now();
      if (!renderSnap || Number(data.seq) >= Number(renderSnap.seq || 0)) {
        renderSnap = data;
        updateTopHud();
        if (renderSnap.roundPhase === 'finished' && renderSnap.winnerRole) {
          submitMatchReport(renderSnap.winnerRole);
        }
      }
      return;
    }
    if (eventName === 'match-finished' && data.winnerRole) {
      submitMatchReport(data.winnerRole);
    }
  }

  async function syncDuelStatus(showErrors = false) {
    if (!duel?.id || !window.MinuitCloud?.connected) return;
    try {
      const prevStatus = duel.status;
      const data = await window.MinuitCloud.rpc('minuit_duel_status', { p_duel: duel.id });
      ingestDuelPayload(data);
      transitionForDuelStatus(prevStatus);
    } catch (err) {
      if (showErrors) setStatus(err?.message || 'Impossible d’actualiser le duel.', true);
    }
  }

  // Rattrape l'état du duel après une veille d'onglet, une micro-coupure réseau ou
  // un changement d'appareil : les timers sont gelés en arrière-plan, donc on
  // resynchronise explicitement dès que la fenêtre redevient active/en ligne.
  function resyncDuelConnection() {
    if (!duel?.id || !window.MinuitCloud?.connected) return;
    ensureRealtimeChannel(duel.id);
    syncDuelStatus(false);
    if (combatActive && myRole() === 'creator' && hostMatch) {
      sendGuestSnapshotNow();
    } else if (combatActive && myRole() === 'opponent') {
      channel?.send('snapshot-request', {});
    }
  }

  function startPolling(intervalMs) {
    stopPolling();
    pollTimer = setInterval(() => {
      syncDuelStatus(false);
    }, intervalMs);
  }

  function transitionForDuelStatus(prevStatus) {
    if (!duel) return;
    ensureRealtimeChannel(duel.id);

    if (duel.status === 'waiting') {
      combatActive = false;
      hideTopHud();
      startPolling(2200);
      // Ne reconstruit pas l'écran à chaque sondage : préserve la saisie du pseudo
      // et le QR déjà affichés. Le premier rendu (après création) passe ici.
      if (!document.querySelector('#overlay .duel-share-card')) renderScreen();
      return;
    }

    if (duel.status === 'draft') {
      combatActive = false;
      hideTopHud();
      startPolling(1600);
      if (prevStatus !== 'draft' || !document.querySelector('#overlay .duel-draft-grid')) {
        renderScreen();
      } else {
        updateDraftIndicators();
      }
      return;
    }

    if (duel.status === 'active') {
      if (!combatActive) {
        beginActiveCombat();
      }
      return;
    }

    if (duel.status === 'completed' || duel.status === 'cancelled') {
      const wasCompleted = duel.status === 'completed';
      teardownDuelRuntime();
      screenOpen = true;
      setGameState('night-duel');
      if (wasCompleted) {
        renderResultScreen();
      } else {
        const cancelledMsg = 'Ce duel a été annulé.';
        duel = null;
        players = [null, null];
        renderScreen();
        setStatus(cancelledMsg, false);
      }
    }
  }

  function beginActiveCombat() {
    if (!duel) return;
    isolateFromCampaign();
    combatActive = true;
    combatPaused = false;
    screenOpen = false;
    lastReportedDuelId = '';
    dashSeq = 0;
    snapshotAccum = 0;
    cmdAccum = 0;
    snapshotRequestAccum = 0;
    lastSnapshotAt = 0;

    const creatorEquip = players[0]?.equipped || 'halo-violet';
    const opponentEquip = players[1]?.equipped || 'halo-violet';

    if (myRole() === 'creator') {
      hostMatch = Core.createMatch({
        id: duel.id,
        mode: duel.mode,
        mapId: duel.mapId,
        difficulty: duel.difficulty,
        wager: duel.wager,
        creatorPerks: duel.creatorPerks,
        opponentPerks: duel.opponentPerks,
        creatorCosmetic: creatorEquip,
        opponentCosmetic: opponentEquip
      });
      renderSnap = Core.createSnapshotFor(hostMatch, 'creator');
      sendGuestSnapshotNow();
    } else {
      hostMatch = null;
      const preview = Core.createMatch({
        id: duel.id,
        mode: duel.mode,
        mapId: duel.mapId,
        difficulty: duel.difficulty,
        wager: duel.wager,
        creatorPerks: duel.creatorPerks,
        opponentPerks: duel.opponentPerks,
        creatorCosmetic: creatorEquip,
        opponentCosmetic: opponentEquip
      });
      renderSnap = Core.createSnapshotFor(preview, 'opponent');
      // Demande tout de suite un état frais à l'hôte (file d'attente du canal si
      // la souscription n'est pas encore terminée).
      snapshotRequestAccum = 0.5;
      channel?.send('snapshot-request', {});
    }

    if (typeof hideOverlay === 'function') hideOverlay();
    document.body?.classList.remove('menu-open');
    document.body?.classList.add('night-duel-combat');
    // La boucle principale de game.js ne simule que lorsque state === 'play'.
    // 'playing' laissait le duel figé : aucune mise à jour, aucun déplacement.
    setGameState('play');
    resetCombatInput();
    wireCombatButtons();
    if (typeof syncPauseIcon === 'function') syncPauseIcon();
    ensureTopHud();
    updateTopHud();
    startPolling(2500);
  }

  async function submitMatchReport(winnerRole) {
    if (!duel || duel.status === 'completed' || finishSubmitting) return;
    const winnerId = winnerRole === 'creator' ? duel.creatorId : duel.opponentId;
    if (!winnerId) return;
    const matchKey = duel.id + ':' + winnerId;
    if (reportedMatchKey === matchKey || lastReportedDuelId === matchKey) return;

    finishSubmitting = true;
    try {
      if (myRole() === 'creator' && channel) {
        channel.send('match-finished', { winnerRole });
      }
      const data = await window.MinuitCloud.rpc('minuit_duel_finish', {
        p_duel: duel.id,
        p_winner: winnerId
      });
      lastReportedDuelId = matchKey;
      reportedMatchKey = matchKey;
      if (channel) channel.send('report-submitted', { winnerRole });
      ingestDuelPayload(data);
      if (duel.status === 'completed') {
        transitionForDuelStatus('active');
      } else {
        startPolling(900);
      }
    } catch (err) {
      reportedMatchKey = '';
      startPolling(1200);
    } finally {
      finishSubmitting = false;
    }
  }

  async function createInvitation(inviteMemberId = '') {
    if (busy || !window.MinuitCloud?.connected) return;
    const pseudoToInvite = inviteMemberId ? '' : String(createInvitePseudo || '').trim();
    busy = true;
    setStatus('Création de l’invitation privée…');
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_create', {
        p_mode: createMode,
        p_wager: createWager
      });
      ingestDuelPayload(data);
      busy = false;
      transitionForDuelStatus('');
      if (inviteMemberId) {
        await sendTeamDuelInvite(inviteMemberId);
      } else if (pseudoToInvite) {
        createInvitePseudo = '';
        await sendDuelInvite(pseudoToInvite);
      }
    } catch (err) {
      busy = false;
      setStatus(err?.message || 'Création du duel impossible.', true);
    }
  }

  async function joinInvitation(rawInput) {
    if (busy || !window.MinuitCloud?.connected) return;
    const id = Core.extractDuelId(rawInput);
    if (!id) {
      setStatus('Saisis un lien d’invitation valide ou l’UUID du duel.', true);
      return;
    }
    busy = true;
    setStatus('Connexion au duel privé…');
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_join', { p_duel: id });
      clearPendingInvite();
      ingestDuelPayload(data);
      ensureRealtimeChannel(id);
      channel?.send('joined', { duelId: id });
      busy = false;
      transitionForDuelStatus('');
    } catch (err) {
      busy = false;
      let msg = String(err?.message || 'Impossible de rejoindre ce duel.');
      if (msg.includes('Deux duels classés')) {
        createMode = 'friendly';
        msg = 'Quota classé atteint avec cette joueuse aujourd’hui (2/2). Crée un duel AMICAL pour rejouer immédiatement : choisis « Amical » puis partage le nouveau lien.';
      }
      clearPendingInvite();
      renderScreen();
      setStatus(msg, true);
    }
  }

  async function submitDraftReady() {
    if (busy || !duel) return;
    const check = Core.validatePerks(selectedPerks);
    if (!check.valid) {
      setStatus(check.error, true);
      return;
    }
    busy = true;
    setStatus('Validation de tes 3 atouts…');
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_ready', {
        p_duel: duel.id,
        p_perks: check.perks
      });
      ingestDuelPayload(data);
      channel?.send('draft-ready', { role: myRole() });
      busy = false;
      transitionForDuelStatus('draft');
    } catch (err) {
      busy = false;
      setStatus(err?.message || 'Validation du draft refusée.', true);
    }
  }

  async function cancelOrForfeitDuel(forfeit = false) {
    if (busy || !duel) return;
    busy = true;
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_cancel', {
        p_duel: duel.id,
        p_forfeit: Boolean(forfeit)
      });
      channel?.send(forfeit ? 'forfeit' : 'state-sync', {});
      ingestDuelPayload(data);
      busy = false;
      transitionForDuelStatus('active');
    } catch (err) {
      busy = false;
      setStatus(err?.message || 'Action impossible.', true);
    }
  }

  async function handleCosmeticAction(haloId, unlock) {
    if (busy || !window.MinuitCloud?.connected) return;
    busy = true;
    try {
      const fn = unlock ? 'minuit_duel_unlock' : 'minuit_duel_equip';
      const data = await window.MinuitCloud.rpc(fn, { p_item: haloId });
      if (data && typeof data === 'object') profile = data;
      busy = false;
      renderScreen();
      setStatus(unlock ? 'Halo cosmétique débloqué !' : 'Halo cosmétique équipé.');
    } catch (err) {
      busy = false;
      setStatus(err?.message || 'Action sur le halo impossible.', true);
    }
  }

  function updateDraftIndicators() {
    const cBadge = el('duelCreatorReadyBadge');
    const oBadge = el('duelOpponentReadyBadge');
    if (cBadge && duel) {
      cBadge.textContent = duel.creatorReady ? 'Prête ✓' : 'En choix…';
      cBadge.classList.toggle('is-ready', Boolean(duel.creatorReady));
    }
    if (oBadge && duel) {
      oBadge.textContent = duel.opponentReady ? 'Prête ✓' : 'En choix…';
      oBadge.classList.toggle('is-ready', Boolean(duel.opponentReady));
    }
  }

  function renderAuthRequiredScreen() {
    const inviteBanner = pendingInviteId
      ? `<div class="duel-invite-banner"><span>INVITATION REÇUE</span><b>${esc(pendingInviteId)}</b><small>Connecte-toi ou crée ton pseudo pour rejoindre immédiatement ce duel.</small></div>`
      : '';
    overlay(`<section class="night-duel-screen" aria-label="Duel de la Nuit noire">
      <div class="duel-header">
        <div class="eyebrow">☾ DUEL DE SORCIÈRES · 1 CONTRE 1 EN DIRECT</div>
        <h2>DUEL DE LA NUIT NOIRE</h2>
        <p>Affronte une autre sorcière dans l’obscurité avec ton accès existant (pseudo ou e-mail). Aucun bonus de campagne ni highscore de team n’est utilisé.</p>
      </div>
      ${inviteBanner}
      <div id="duelAuthMount" class="duel-auth-mount"></div>
      <div class="duel-status" id="duelStatusMsg" role="status">${esc(statusNotice)}</div>
      <div class="menu-actions duel-footer-actions">
        <button type="button" class="secondary" id="duelBackHome">Retour à l’accueil</button>
      </div>
    </section>`);
    document.body?.classList.add('menu-open');
    const mount = el('duelAuthMount');
    if (mount && window.MinuitCloud?.renderPanel) {
      window.MinuitCloud.renderPanel(mount);
    }
    const back = el('duelBackHome');
    if (back) back.onclick = leaveToHome;
  }

  function inviteQrPanelHtml(inviteUrl) {
    try {
      if (!window.NightDuelQR?.available?.()) return '';
      const qrSvg = window.NightDuelQR.svg(inviteUrl, { title: 'QR code d’invitation au Duel de la Nuit noire' });
      if (!qrSvg) return '';
      return `<div class="duel-qr-panel">
        <div class="duel-qr-frame" id="duelInviteQr">${qrSvg}</div>
        <div class="duel-qr-side">
          <b>Scanne pour rejoindre</b>
          <small>Ouvre l’appareil photo du téléphone de ton adversaire et vise ce code : le duel s’ouvre directement, sans rien copier.</small>
          <button type="button" class="secondary" id="duelQrDownload">Télécharger le QR</button>
        </div>
      </div>`;
    } catch (_) {
      return '';
    }
  }

  function downloadInviteQr(inviteUrl) {
    try {
      const dataUrl = window.NightDuelQR?.pngDataUrl?.(inviteUrl, { scale: 12, margin: 4 });
      if (!dataUrl) throw new Error('QR indisponible');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `duel-nuit-noire-${String(duel?.id || '').slice(0, 8)}.png`;
      document.body?.appendChild(link);
      link.click();
      if (typeof link.remove === 'function') link.remove();
      setStatus('QR code téléchargé : partage l’image ou fais-la scanner.');
    } catch (_) {
      setStatus('Téléchargement du QR indisponible : utilise le lien d’invitation.', true);
    }
  }

  function inviteModeLabel(mode) {
    return mode === 'ranked' ? 'Classé' : 'Amical';
  }

  function inviteWagerLabel(wager) {
    return Number(wager) > 0 ? `Mise ${Number(wager)} ☾ chacune` : 'Sans mise';
  }

  async function refreshIncomingInvitations() {
    if (!window.MinuitCloud?.connected) return;
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_invitations', {});
      incomingInvites = (Array.isArray(data) ? data : []).filter(inv => inv && !dismissedInviteIds.has(inv.id));
      maybeShowInvitePopup();
    } catch (_) {
      // Silencieux : l'observateur réessaiera au prochain cycle.
    }
  }

  async function refreshSentInvitations() {
    if (!window.MinuitCloud?.connected || duel?.status !== 'waiting' || !duel?.id) return;
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_sent_invitations', { p_duel: duel.id });
      sentInvites = Array.isArray(data) ? data : [];
      renderSentInvites();
    } catch (_) {
      sentInvites = [];
      renderSentInvites();
    }
  }

  function renderSentInvites() {
    const holder = el('duelSentInvites');
    if (!holder) return;
    if (!sentInvites.length) {
      holder.innerHTML = '<small class="duel-sent-empty">Aucune invitation envoyée pour le moment.</small>';
      return;
    }
    holder.innerHTML = sentInvites.map(inv => `<div class="duel-sent-row">
      <span><b>${esc(inv.toName || 'Sorcière')}</b><small>${esc(inviteModeLabel(inv.mode))} · ${esc(inviteWagerLabel(inv.wager))} · en attente</small></span>
      <button type="button" class="secondary" data-cancel-invite="${esc(inv.id)}">Annuler</button>
    </div>`).join('');
    document.querySelectorAll('[data-cancel-invite]').forEach(btn => {
      btn.onclick = () => cancelSentInvite(btn.dataset.cancelInvite);
    });
  }

  async function sendDuelInvite(pseudo) {
    if (!window.MinuitCloud?.connected || !duel?.id) return;
    const name = String(pseudo || '').trim();
    if (name.length < 2) {
      setStatus('Saisis le pseudo exact de la joueuse à inviter.', true);
      return;
    }
    setStatus(`Envoi de l’invitation à ${name}…`);
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_invite', { p_duel: duel.id, p_pseudo: name });
      waitingInvitePseudo = '';
      const input = el('duelInAppPseudo');
      if (input) input.value = '';
      setStatus(`Invitation envoyée à ${data?.invitation?.toName || name}. Elle recevra un popup dans le jeu (valable 10 minutes).`);
      await refreshSentInvitations();
      await refreshTeamPlayers();
    } catch (err) {
      setStatus(err?.message || 'Envoi de l’invitation impossible.', true);
    }
  }

  async function cancelSentInvite(invitationId) {
    if (!window.MinuitCloud?.connected || !invitationId) return;
    try {
      await window.MinuitCloud.rpc('minuit_duel_invite_cancel', { p_invitation: invitationId });
      setStatus('Invitation annulée.');
      await refreshSentInvitations();
      await refreshTeamPlayers();
    } catch (err) {
      setStatus(err?.message || 'Annulation impossible.', true);
    }
  }

  function teamPlayersCardHtml() {
    return `<div class="duel-card duel-team-card">
      <div class="duel-team-card-head">
        <h3>DÉFIER MA TEAM</h3>
        <button type="button" class="secondary duel-team-refresh" id="duelTeamRefresh">Actualiser</button>
      </div>
      <small class="duel-inapp-hint" id="duelTeamSubtitle">Choisis un membre de ta team : l’invitation part directement, sans saisir son pseudo.</small>
      <div id="duelTeamPlayers" class="duel-team-list" aria-live="polite"></div>
    </div>`;
  }

  function renderTeamPlayers() {
    const subtitle = el('duelTeamSubtitle');
    if (subtitle) {
      subtitle.textContent = teamInfo
        ? `Team « ${teamInfo.name || 'Sans nom'} » · ${Number(teamInfo.memberCount) || teamPlayers.length} membre${(Number(teamInfo.memberCount) || teamPlayers.length) > 1 ? 's' : ''}. L’invitation par pseudo reste aussi disponible.`
        : 'Choisis un membre de ta team : l’invitation part directement, sans saisir son pseudo.';
    }
    const refreshBtn = el('duelTeamRefresh');
    if (refreshBtn) {
      refreshBtn.disabled = teamPlayersLoading;
      refreshBtn.onclick = () => refreshTeamPlayers();
    }
    const holder = el('duelTeamPlayers');
    if (!holder) return;
    if (teamPlayersLoading && !teamPlayers.length) {
      holder.innerHTML = '<small class="duel-team-empty">Chargement des membres de la team…</small>';
      return;
    }
    if (teamPlayersError) {
      holder.innerHTML = `<small class="duel-team-empty is-error">${esc(teamPlayersError)}</small>`;
      return;
    }
    if (!teamInfo) {
      holder.innerHTML = '<small class="duel-team-empty">Tu n’es pas encore dans une team. Rejoins-en une dans Compte & team pour défier ses membres, ou invite par pseudo.</small>';
      return;
    }
    if (!teamPlayers.length) {
      holder.innerHTML = '<small class="duel-team-empty">Aucun autre membre dans ta team pour le moment.</small>';
      return;
    }
    holder.innerHTML = teamPlayers.map(member => {
      const sending = teamInviteBusyIds.has(member.id);
      const disabled = !member.canInvite || sending || busy;
      const label = sending
        ? 'Envoi…'
        : member.isYou
          ? 'Toi'
          : member.invitationStatus === 'pending'
            ? 'Invitée ✓'
            : member.canInvite
              ? 'Défier'
              : 'Indisponible';
      return `<div class="duel-team-row${member.isYou ? ' is-you' : ''}">
        <span><b>${esc(member.displayName || member.duelName || 'Sorcière')}</b><small>${esc(member.availability || 'Disponible')}</small></span>
        <button type="button" class="secondary" id="duelTeamChallenge_${esc(member.id)}" data-challenge-member="${esc(member.id)}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>
      </div>`;
    }).join('');
    teamPlayers.forEach(member => {
      const btn = el(`duelTeamChallenge_${member.id}`);
      if (btn) btn.onclick = () => challengeTeamMember(member.id);
    });
  }

  async function refreshTeamPlayers() {
    if (!window.MinuitCloud?.connected) return;
    const requestId = ++teamPlayersRequestId;
    teamPlayersLoading = true;
    teamPlayersError = '';
    renderTeamPlayers();
    try {
      const duelId = duel?.status === 'waiting' ? duel.id : null;
      const data = await window.MinuitCloud.rpc('minuit_duel_team_players', { p_duel: duelId });
      if (requestId !== teamPlayersRequestId) return;
      teamInfo = data?.team || null;
      teamPlayers = Array.isArray(data?.players) ? data.players : [];
    } catch (err) {
      if (requestId !== teamPlayersRequestId) return;
      teamInfo = null;
      teamPlayers = [];
      teamPlayersError = err?.message || 'Impossible de charger les membres de la team.';
    } finally {
      if (requestId === teamPlayersRequestId) {
        teamPlayersLoading = false;
        renderTeamPlayers();
      }
    }
  }

  async function challengeTeamMember(memberId) {
    if (!window.MinuitCloud?.connected || !memberId) return;
    const member = teamPlayers.find(p => p.id === memberId);
    if (!member) {
      setStatus('Ce membre n’est plus dans la team. Actualise la liste.', true);
      await refreshTeamPlayers();
      return;
    }
    if (member.isYou) {
      setStatus('Tu ne peux pas te défier toi-même.', true);
      return;
    }
    if (!member.canInvite) {
      setStatus(`${member.displayName || 'Ce membre'} : ${member.availability || 'indisponible'}.`, true);
      return;
    }
    if (duel && duel.status !== 'waiting') {
      setStatus('Termine ou annule le duel en cours avant d’en créer un autre.', true);
      return;
    }
    if (!duel || duel.status !== 'waiting') {
      await createInvitation(memberId);
      return;
    }
    await sendTeamDuelInvite(memberId);
  }

  async function sendTeamDuelInvite(memberId) {
    if (!window.MinuitCloud?.connected || !duel?.id || duel.status !== 'waiting' || !memberId) return;
    if (teamInviteBusyIds.has(memberId)) return;
    const member = teamPlayers.find(p => p.id === memberId);
    const name = member?.displayName || member?.duelName || 'cette joueuse';
    teamInviteBusyIds.add(memberId);
    renderTeamPlayers();
    setStatus(`Envoi de l’invitation à ${name}…`);
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_invite_member', { p_duel: duel.id, p_member: memberId });
      setStatus(`Invitation envoyée à ${data?.invitation?.toName || name}. Elle recevra un popup dans le jeu (valable 10 minutes).`);
      await refreshSentInvitations();
      await refreshTeamPlayers();
    } catch (err) {
      setStatus(err?.message || 'Envoi de l’invitation impossible.', true);
      await refreshTeamPlayers();
    } finally {
      teamInviteBusyIds.delete(memberId);
      renderTeamPlayers();
    }
  }

  function maybeShowInvitePopup() {
    if (activeInvitePopup || screenOpen || combatActive || !window.MinuitCloud?.connected) return;
    const next = incomingInvites.find(inv => inv && !dismissedInviteIds.has(inv.id));
    if (!next) return;
    activeInvitePopup = next;
    renderInvitePopup(next);
    try {
      window.dispatchEvent(new CustomEvent('minuit:duel-invitation', { detail: next }));
    } catch (_) {}
  }

  function renderInvitePopup(invite) {
    document.getElementById('duelInvitePopup')?.remove();
    const popup = document.createElement('div');
    popup.id = 'duelInvitePopup';
    popup.className = 'duel-invite-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-live', 'polite');
    popup.setAttribute('aria-label', 'Invitation à un Duel de la Nuit noire');
    popup.innerHTML = `
      <div class="duel-invite-popup-eyebrow">☾ INVITATION À UN DUEL</div>
      <b>${esc(invite.fromName || 'Une sorcière')} te défie en Duel de la Nuit noire</b>
      <small>${esc(inviteModeLabel(invite.mode))} · ${esc(inviteWagerLabel(invite.wager))} · expire dans 10 min</small>
      <div class="duel-invite-popup-actions">
        <button type="button" class="primary" id="duelInviteAccept">Rejoindre le duel</button>
        <button type="button" class="secondary" id="duelInviteDecline">Refuser</button>
      </div>
      <div class="duel-invite-popup-status" id="duelInvitePopupStatus" role="status"></div>`;
    document.body?.appendChild(popup);
    const acceptBtn = el('duelInviteAccept');
    const declineBtn = el('duelInviteDecline');
    if (acceptBtn) acceptBtn.onclick = () => respondToIncomingInvite(invite, true);
    if (declineBtn) declineBtn.onclick = () => respondToIncomingInvite(invite, false);
  }

  function closeInvitePopup() {
    document.getElementById('duelInvitePopup')?.remove();
    activeInvitePopup = null;
    maybeShowInvitePopup();
  }

  async function respondToIncomingInvite(invite, accept) {
    if (inviteRespondBusy || !invite || !window.MinuitCloud?.connected) return;
    if (accept && getGameState() === 'play' && !combatActive) {
      const ok = typeof window.confirm === 'function'
        ? window.confirm('Rejoindre le duel mettra fin à ta partie en cours. Continuer ?')
        : true;
      if (!ok) return;
    }
    inviteRespondBusy = true;
    const statusEl = el('duelInvitePopupStatus');
    if (statusEl) statusEl.textContent = accept ? 'Connexion au duel…' : 'Envoi du refus…';
    try {
      const data = await window.MinuitCloud.rpc('minuit_duel_invite_respond', { p_invitation: invite.id, p_accept: Boolean(accept) });
      dismissedInviteIds.add(invite.id);
      incomingInvites = incomingInvites.filter(inv => inv.id !== invite.id);
      closeInvitePopup();
      if (accept && data?.duel) {
        enterDuelFromInvite(data.duel);
      }
    } catch (err) {
      const message = err?.message || 'Réponse à l’invitation impossible.';
      const currentStatus = el('duelInvitePopupStatus');
      if (currentStatus) currentStatus.textContent = message;
      if (/expirée|plus disponible|déjà traitée/i.test(message)) {
        dismissedInviteIds.add(invite.id);
        incomingInvites = incomingInvites.filter(inv => inv.id !== invite.id);
        closeInvitePopup();
      }
    } finally {
      inviteRespondBusy = false;
    }
  }

  function enterDuelFromInvite(payload) {
    clearPendingInvite();
    ingestDuelPayload(payload);
    screenOpen = true;
    statusNotice = '';
    statusError = false;
    isolateFromCampaign();
    ensureRealtimeChannel(duel?.id);
    channel?.send('joined', { duelId: duel?.id });
    transitionForDuelStatus('');
  }

  function startInviteWatcher() {
    if (!window.MinuitCloud?.connected) return;
    refreshIncomingInvitations();
    if (!inviteWatcherBound) {
      inviteWatcherBound = true;
      window.addEventListener('focus', () => refreshIncomingInvitations());
      window.addEventListener('online', () => refreshIncomingInvitations());
    }
    if (invitePollTimer) return;
    invitePollTimer = setInterval(() => refreshIncomingInvitations(), INVITE_POLL_MS);
  }

  function stopInviteWatcher() {
    if (invitePollTimer) {
      clearInterval(invitePollTimer);
      invitePollTimer = null;
    }
    incomingInvites = [];
    sentInvites = [];
    teamInfo = null;
    teamPlayers = [];
    teamPlayersLoading = false;
    teamPlayersError = '';
    teamPlayersRequestId += 1;
    teamInviteBusyIds.clear();
    document.getElementById('duelInvitePopup')?.remove();
    activeInvitePopup = null;
  }

  function renderWaitingScreen() {
    const creatorName = players[0]?.name || window.MinuitCloud?.user?.displayName || 'Sorcière';
    const links = Core.buildShareLinks(window.location?.href || 'https://minuit.local/', duel.id, creatorName, duel.mode);
    const modeLabel = duel.mode === 'ranked' ? 'Classé' : 'Amical';
    const wagerLabel = duel.wager > 0 ? `Mise : ${duel.wager} éclats chacune (pot de ${duel.wager * 2})` : 'Sans mise d’éclats';
    const qrPanel = inviteQrPanelHtml(links.inviteUrl);

    overlay(`<section class="night-duel-screen" aria-label="Invitation Duel de la Nuit noire">
      <div class="duel-header">
        <div class="eyebrow">☾ INVITATION PRIVÉE EN ATTENTE · ${esc(modeLabel.toUpperCase())}</div>
        <h2>INVITE TON ADVERSAIRE</h2>
        <p>${esc(wagerLabel)} · Le draft de 3 atouts s’ouvrira dès que l’autre sorcière rejoint.</p>
      </div>
      <div class="duel-card duel-share-card">
        <label class="duel-field-label" for="duelInviteLink">Lien d’invitation privée</label>
        <div class="duel-copy-row">
          <input id="duelInviteLink" type="text" readonly value="${esc(links.inviteUrl)}">
          <button type="button" class="primary" id="duelCopyLink">Copier le lien</button>
        </div>
        ${qrPanel}
        <div class="duel-uuid-line">
          <span>UUID du duel : <code id="duelUuidCode">${esc(duel.id)}</code></span>
          <button type="button" class="secondary" id="duelCopyUuid">Copier l’UUID</button>
        </div>
        <div class="duel-share-buttons">
          <a class="secondary duel-share-link" id="duelShareWhatsapp" href="${esc(links.whatsapp)}" target="_blank" rel="noopener noreferrer">Partager sur WhatsApp</a>
          <a class="secondary duel-share-link" id="duelShareMessenger" href="${esc(links.messenger)}" target="_blank" rel="noopener noreferrer">Partager sur Messenger</a>
        </div>
      </div>
      ${teamPlayersCardHtml()}
      <div class="duel-card duel-inapp-card">
        <h3>INVITER PAR PSEUDO</h3>
        <label class="duel-field-label" for="duelInAppPseudo">Pseudo de la joueuse à inviter</label>
        <div class="duel-copy-row">
          <input id="duelInAppPseudo" type="text" maxlength="24" placeholder="Ex. : Nyx" value="${esc(waitingInvitePseudo)}" autocomplete="off" spellcheck="false">
          <button type="button" class="primary" id="duelInAppSend">Envoyer l’invitation</button>
        </div>
        <small class="duel-inapp-hint">La joueuse recevra un popup dans le jeu pour rejoindre ou refuser. L’invitation expire après 10 minutes.</small>
        <div id="duelSentInvites" class="duel-sent-invites"></div>
      </div>
      <div class="duel-status${statusError ? ' is-error' : ''}" id="duelStatusMsg" role="status">${esc(statusNotice || 'En attente de la seconde sorcière…')}</div>
      <div class="menu-actions duel-footer-actions">
        <button type="button" class="secondary" id="duelRefreshWait">Actualiser</button>
        <button type="button" class="secondary team-danger" id="duelCancelInvite">Annuler l’invitation</button>
      </div>
    </section>`);
    document.body?.classList.add('menu-open');

    const copyText = async (value, label) => {
      try {
        await navigator.clipboard.writeText(value);
        setStatus(`${label} copié dans le presse-papiers.`);
      } catch (_) {
        const input = el('duelInviteLink');
        if (input) {
          input.focus();
          input.select();
        }
        setStatus(`Sélectionne et copie : ${value}`);
      }
    };
    el('duelCopyLink').onclick = () => copyText(links.inviteUrl, 'Lien d’invitation');
    el('duelCopyUuid').onclick = () => copyText(duel.id, 'UUID du duel');
    const qrDownload = el('duelQrDownload');
    if (qrDownload) qrDownload.onclick = () => downloadInviteQr(links.inviteUrl);
    const inAppInput = el('duelInAppPseudo');
    const inAppSend = el('duelInAppSend');
    if (inAppInput) {
      inAppInput.addEventListener('input', () => { waitingInvitePseudo = inAppInput.value; });
      inAppInput.addEventListener('keydown', evt => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          sendDuelInvite(inAppInput.value);
        }
      });
    }
    if (inAppSend) inAppSend.onclick = () => sendDuelInvite(inAppInput?.value || waitingInvitePseudo);
    renderSentInvites();
    refreshSentInvitations();
    renderTeamPlayers();
    refreshTeamPlayers();
    el('duelRefreshWait').onclick = () => {
      syncDuelStatus(true);
      refreshSentInvitations();
      refreshTeamPlayers();
    };
    el('duelCancelInvite').onclick = () => cancelOrForfeitDuel(false);
  }

  function renderDraftScreen() {
    const role = myRole();
    const alreadyReady = role === 'creator' ? duel.creatorReady : duel.opponentReady;
    const savedPerks = role === 'creator' ? duel.creatorPerks : duel.opponentPerks;
    if (alreadyReady && Array.isArray(savedPerks) && savedPerks.length === 3) {
      selectedPerks = savedPerks.slice();
    }
    const pCreator = players[0] || { name: 'Créatrice', rating: 1000 };
    const pOpponent = players[1] || { name: 'Invitée', rating: 1000 };
    const modeLabel = duel.mode === 'ranked' ? 'Duel classé' : 'Duel amical';
    const wagerLabel = duel.wager > 0 ? ` · Pot de ${duel.wager * 2} éclats` : '';

    overlay(`<section class="night-duel-screen" aria-label="Draft du Duel de la Nuit noire">
      <div class="duel-header">
        <div class="eyebrow">☾ ${esc(modeLabel.toUpperCase())}${esc(wagerLabel.toUpperCase())} · BEST OF 3</div>
        <h2>CHOISIS 3 ATOUTS DE NUIT</h2>
        <p>Catalogue commun de 10 atouts · Aucun équipement de campagne, compagnon ou bonus quotidien ne s’applique.</p>
        <small class="duel-map-note">Map : <b>${esc(Core.getDuelMap?.(duel?.mapId)?.name || 'Clairière silencieuse')}</b> · ${esc(Core.getDuelMap?.(duel?.mapId)?.tagline || 'Duel pur · aucun monstre')}</small>
      </div>
      <div class="duel-versus-strip">
        <div class="duel-fighter-pill">
          <b>${esc(pCreator.name || 'Créatrice')}</b>
          <small>Cote ${Number(pCreator.rating) || 1000}</small>
          <span class="duel-ready-badge${duel.creatorReady ? ' is-ready' : ''}" id="duelCreatorReadyBadge">${duel.creatorReady ? 'Prête ✓' : 'En choix…'}</span>
        </div>
        <span class="duel-vs-mark">VS</span>
        <div class="duel-fighter-pill">
          <b>${esc(pOpponent.name || 'Invitée')}</b>
          <small>Cote ${Number(pOpponent.rating) || 1000}</small>
          <span class="duel-ready-badge${duel.opponentReady ? ' is-ready' : ''}" id="duelOpponentReadyBadge">${duel.opponentReady ? 'Prête ✓' : 'En choix…'}</span>
        </div>
      </div>
      <div class="duel-draft-counter" id="duelDraftCounter">${selectedPerks.length} / 3 atouts sélectionnés</div>
      <div class="duel-draft-grid" role="group" aria-label="Catalogue de 10 atouts">
        ${Core.PERK_CATALOG.map(perk => {
          const picked = selectedPerks.includes(perk.id);
          return `<button type="button" class="duel-perk-card${picked ? ' is-picked' : ''}" data-perk-id="${esc(perk.id)}" aria-pressed="${picked}" ${alreadyReady ? 'disabled' : ''}>
            <div class="duel-perk-top"><span class="duel-perk-icon">${esc(perk.icon)}</span><small>${esc(perk.category)}</small></div>
            <b>${esc(perk.name)}</b>
            <span>${esc(perk.desc)}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="duel-status${statusError ? ' is-error' : ''}" id="duelStatusMsg" role="status">${esc(alreadyReady ? 'Atouts verrouillés. En attente de l’autre sorcière…' : statusNotice)}</div>
      <div class="menu-actions duel-footer-actions">
        <button type="button" class="primary" id="duelReadyBtn" ${alreadyReady || selectedPerks.length !== 3 ? 'disabled' : ''}>${alreadyReady ? 'Prête pour la nuit ✓' : 'Valider mes 3 atouts'}</button>
        <button type="button" class="secondary team-danger" id="duelCancelDraft">Quitter le draft</button>
      </div>
    </section>`);
    document.body?.classList.add('menu-open');

    document.querySelectorAll('.duel-perk-card').forEach(btn => {
      btn.onclick = () => {
        if (alreadyReady) return;
        const id = btn.dataset.perkId;
        if (!id) return;
        if (selectedPerks.includes(id)) {
          selectedPerks = selectedPerks.filter(item => item !== id);
        } else if (selectedPerks.length < 3) {
          selectedPerks = [...selectedPerks, id];
        } else {
          setStatus('Trois atouts maximum : retire un atout avant d’en choisir un autre.', false);
          return;
        }
        renderDraftScreen();
      };
    });

    const readyBtn = el('duelReadyBtn');
    if (readyBtn) readyBtn.onclick = submitDraftReady;
    const cancelBtn = el('duelCancelDraft');
    if (cancelBtn) cancelBtn.onclick = () => cancelOrForfeitDuel(false);
  }

  function renderResultScreen() {
    const uid = myUserId();
    const won = duel?.winnerId === uid;
    const pMe = (players[0]?.id === uid ? players[0] : players[1]) || profile || Core.createDuelProfile();
    const pOther = (players[0]?.id === uid ? players[1] : players[0]) || { name: 'Adversaire', rating: 1000 };
    const delta = Number(duel?.ratingDelta) || 0;
    const signedDelta = duel?.mode === 'ranked' ? (won ? `+${delta}` : `-${delta}`) : '±0 (amical)';
    const wagerNote = duel?.wager > 0
      ? (won ? `Pot remporté : +${duel.wager * 2} éclats de lune` : `Mise engagée : ${duel.wager} éclats de lune`)
      : 'Duel sans mise d’éclats';

    overlay(`<section class="night-duel-screen duel-result-screen" aria-label="Résultat du Duel de la Nuit noire">
      <div class="duel-header">
        <div class="eyebrow">☾ ${duel?.mode === 'ranked' ? 'DUEL CLASSÉ TERMINÉ' : 'DUEL AMICAL TERMINÉ'}</div>
        <h2>${won ? 'VICTOIRE NOCTURNE' : 'DÉFAITE DANS LA BRUME'}</h2>
        <p>Face à <b>${esc(pOther.name || 'Adversaire')}</b> · Résultat validé par consensus des deux clients.</p>
      </div>
      <div class="duel-summary-grid">
        <div class="duel-stat-box"><small>VARIATION DE COTE</small><b>${esc(signedDelta)}</b></div>
        <div class="duel-stat-box"><small>NOUVELLE COTE DUEL</small><b>${Number(pMe.rating) || 1000}</b></div>
        <div class="duel-stat-box"><small>BILAN CLASSÉ</small><b>${Number(pMe.wins) || 0} V · ${Number(pMe.losses) || 0} D</b></div>
        <div class="duel-stat-box"><small>ÉCLATS DE LUNE</small><b>${Number(pMe.shards) || 0} ☾</b></div>
      </div>
      <p class="duel-wager-note">${esc(wagerNote)} · Les highscores de campagne et de team restent intacts.</p>
      <div class="menu-actions duel-footer-actions">
        <button type="button" class="primary" id="duelAgainBtn">Nouveau duel</button>
        <button type="button" class="secondary" id="duelHomeBtn">Retour à l’accueil</button>
      </div>
    </section>`);
    document.body?.classList.add('menu-open');
    el('duelAgainBtn').onclick = () => {
      duel = null;
      players = [null, null];
      statusNotice = '';
      openHub();
    };
    el('duelHomeBtn').onclick = leaveToHome;
  }

  function renderHubScreen() {
    const p = profile || Core.createDuelProfile();
    const pseudo = p.name || window.MinuitCloud?.user?.displayName || window.MinuitCloud?.user?.email || 'Sorcière';
    const unlocked = Array.isArray(p.unlocked) ? p.unlocked : ['halo-violet'];

    overlay(`<section class="night-duel-screen" aria-label="Salon Duel de la Nuit noire">
      <div class="duel-header">
        <div class="eyebrow">☾ DUEL DE LA NUIT NOIRE · 1 CONTRE 1 EN DIRECT</div>
        <h2>SALON DES OMBRES</h2>
        <p> Sorcière : <b>${esc(pseudo)}</b> · Manches de 90 s en 2 manches gagnantes · Visibilité limitée au halo et aux éclats.</p>
        <small class="duel-map-note">Map jouée : <b>${esc(Core.getDuelMap?.(duel?.mapId)?.name || 'Clairière silencieuse')}</b> · ${esc(Core.getDuelMap?.(duel?.mapId)?.tagline || 'Duel pur · aucun monstre')}. Les sentinelles restent réservées aux maps hantées.</small>
      </div>
      <div class="duel-summary-grid">
        <div class="duel-stat-box"><small>COTE DUEL</small><b>${Number(p.rating) || 1000}</b></div>
        <div class="duel-stat-box"><small>BILAN CLASSÉ</small><b>${Number(p.wins) || 0} V · ${Number(p.losses) || 0} D</b></div>
        <div class="duel-stat-box"><small>ÉCLATS DE LUNE</small><b>${Number(p.shards) || 0} ☾</b></div>
        <div class="duel-stat-box"><small>HALO ÉQUIPÉ</small><b>${esc(Core.getHaloCosmetic(p.equipped).name)}</b></div>
      </div>
      <div class="duel-hub-columns">
        <div class="duel-card">
          <h3>CRÉER UNE INVITATION PRIVÉE</h3>
          <div class="duel-toggle-row" role="group" aria-label="Mode de duel">
            <button type="button" class="secondary${createMode === 'ranked' ? ' is-selected' : ''}" id="duelModeRanked">Classé (max 2/jour/paire)</button>
            <button type="button" class="secondary${createMode === 'friendly' ? ' is-selected' : ''}" id="duelModeFriendly">Amical (libre)</button>
          </div>
          <div class="duel-toggle-row" role="group" aria-label="Mise d’éclats de lune">
            <button type="button" class="secondary${createWager === 0 ? ' is-selected' : ''}" id="duelWagerZero">Sans mise</button>
            <button type="button" class="secondary${createWager === 10 ? ' is-selected' : ''}" id="duelWagerTen" ${(Number(p.shards) || 0) < 10 ? 'disabled' : ''}>Mise 10 ☾ (pot 20)</button>
          </div>
          <label class="duel-field-label" for="duelCreateInvitePseudo">Inviter directement ce pseudo (optionnel)</label>
          <input id="duelCreateInvitePseudo" type="text" maxlength="24" placeholder="Ex. : Nyx" value="${esc(createInvitePseudo)}" autocomplete="off" spellcheck="false">
          <button type="button" class="primary duel-full-btn" id="duelCreateBtn">Créer le duel & obtenir le lien</button>
        </div>
        <div class="duel-card">
          <h3>REJOINDRE UN DUEL</h3>
          <label class="duel-field-label" for="duelJoinInput">Colle un lien d’invitation ou l’UUID du duel</label>
          <input id="duelJoinInput" type="text" spellcheck="false" autocomplete="off" placeholder="https://…/?duel=… ou UUID" value="${esc(pendingInviteId)}">
          <button type="button" class="primary duel-full-btn" id="duelJoinBtn">Rejoindre ce duel</button>
        </div>
      </div>
      ${teamPlayersCardHtml()}
      <div class="duel-card duel-halos-card">
        <h3>HALOS COSMÉTIQUES (ÉCLATS DE LUNE · AUCUN AVANTAGE EN JEU)</h3>
        <div class="duel-halo-grid">
          ${Core.COSMETIC_HALOS.map(item => {
            const isUnlocked = unlocked.includes(item.id);
            const isEquipped = p.equipped === item.id;
            return `<div class="duel-halo-item${isEquipped ? ' is-equipped' : ''}">
              <div><i class="duel-halo-swatch" style="background:${esc(item.ring)}"></i><b>${esc(item.name)}</b><small>${item.cost > 0 ? `${item.cost} ☾` : 'Inclus'}</small></div>
              ${isEquipped
                ? '<span class="duel-equipped-tag">Équipé</span>'
                : isUnlocked
                  ? `<button type="button" class="secondary" data-equip-halo="${esc(item.id)}">Équiper</button>`
                  : `<button type="button" class="secondary" data-unlock-halo="${esc(item.id)}" ${(Number(p.shards) || 0) < item.cost ? 'disabled' : ''}>Débloquer (${item.cost} ☾)</button>`}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="duel-status${statusError ? ' is-error' : ''}" id="duelStatusMsg" role="status">${esc(statusNotice)}</div>
      <div class="menu-actions duel-footer-actions">
        <button type="button" class="secondary" id="duelBackHome">Retour à l’accueil</button>
      </div>
    </section>`);
    document.body?.classList.add('menu-open');

    el('duelModeRanked').onclick = () => {
      createMode = 'ranked';
      renderHubScreen();
    };
    el('duelModeFriendly').onclick = () => {
      createMode = 'friendly';
      renderHubScreen();
    };
    el('duelWagerZero').onclick = () => {
      createWager = 0;
      renderHubScreen();
    };
    el('duelWagerTen').onclick = () => {
      createWager = 10;
      renderHubScreen();
    };
    const createPseudoInput = el('duelCreateInvitePseudo');
    if (createPseudoInput) {
      createPseudoInput.addEventListener('input', () => { createInvitePseudo = createPseudoInput.value; });
    }
    el('duelCreateBtn').onclick = () => createInvitation();
    renderTeamPlayers();
    refreshTeamPlayers();
    el('duelJoinBtn').onclick = () => joinInvitation(el('duelJoinInput')?.value || '');
    el('duelJoinInput').addEventListener('keydown', evt => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        joinInvitation(el('duelJoinInput')?.value || '');
      }
    });
    document.querySelectorAll('[data-unlock-halo]').forEach(btn => {
      btn.onclick = () => handleCosmeticAction(btn.dataset.unlockHalo, true);
    });
    document.querySelectorAll('[data-equip-halo]').forEach(btn => {
      btn.onclick = () => handleCosmeticAction(btn.dataset.equipHalo, false);
    });
    el('duelBackHome').onclick = leaveToHome;
  }

  function renderScreen() {
    if (!screenOpen) return;
    setGameState('night-duel');
    isolateFromCampaign();
    if (!window.MinuitCloud?.connected) {
      renderAuthRequiredScreen();
      return;
    }
    if (duel?.status === 'waiting') {
      renderWaitingScreen();
      return;
    }
    if (duel?.status === 'draft') {
      renderDraftScreen();
      return;
    }
    if (duel?.status === 'completed') {
      renderResultScreen();
      return;
    }
    renderHubScreen();
  }

  async function openHub(options = {}) {
    if (options.inviteId) pendingInviteId = Core.extractDuelId(options.inviteId) || pendingInviteId;
    teardownDuelRuntime();
    screenOpen = true;
    statusNotice = '';
    statusError = false;
    isolateFromCampaign();
    renderScreen();
    if (window.MinuitCloud?.connected) {
      await refreshProfile();
      if (pendingInviteId) {
        await joinInvitation(pendingInviteId);
        return;
      }
      renderScreen();
    }
  }

  function ensureTopHud() {
    let hud = el('duelTopHud');
    // Le bandeau du duel vit hors du canvas, comme le HUD du jeu principal :
    // il ne doit jamais recouvrir la minimap ni la zone de jeu.
    const preferredHolder = document.querySelector?.('.heading.game-status') || document.querySelector?.('main .heading');
    const holder = preferredHolder || getCanvas()?.parentElement || document.body;
    if (hud && hud.parentElement !== holder) holder.appendChild(hud);
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'duelTopHud';
      hud.className = 'duel-top-hud';
      hud.setAttribute('aria-live', 'polite');
      hud.innerHTML = `
        <div class="duel-hud-side duel-hud-self">
          <small id="duelHudSelfName">TOI</small>
          <b id="duelHudSelfHearts">♥♥♥♥♥</b>
          <span id="duelHudDashState">Esquive prête</span>
          <span id="duelHudFireState">Tir manuel prêt</span>
          <span id="duelHudBoons"></span>
        </div>
        <div class="duel-hud-center">
          <div class="duel-hud-scoreline"><span id="duelHudRound">M1/3</span> · <strong id="duelHudScore">0 — 0</strong> · <b id="duelHudClock">01:30</b></div>
          <div class="duel-hud-banner" id="duelHudBanner">Chasse dans la brume</div>
        </div>
        <div class="duel-hud-side duel-hud-opp">
          <div class="duel-hud-opp-top">
            <small id="duelHudOppName">ADVERSAIRE</small>
            <button type="button" class="duel-hud-exit" id="duelForfeitBtn">Abandon</button>
          </div>
          <b id="duelHudOppHearts">♥♥♥♥♥</b>
          <span id="duelHudOppVis">Hors du halo</span>
        </div>
      `;
      holder.appendChild(hud);
      const forfeitBtn = el('duelForfeitBtn');
      if (forfeitBtn) {
        forfeitBtn.onclick = evt => {
          evt.stopPropagation();
          openCombatPauseOverlay();
        };
      }
    }
    hud.style.display = 'grid';
  }

  function heartsText(count, maxCount, parry) {
    const full = Math.max(0, Math.round(count || 0));
    const empty = Math.max(0, Math.round((maxCount || 5) - full));
    return '♥'.repeat(full) + '♡'.repeat(empty) + (parry > 0 ? ' 🛡' : '');
  }

  function formatClock(roundTime) {
    const rem = Math.max(0, Math.ceil(Core.ROUND_DURATION - (Number(roundTime) || 0)));
    const m = String(Math.floor(rem / 60)).padStart(2, '0');
    const s = String(rem % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateTopHud() {
    if (!combatActive || !renderSnap) return;
    ensureTopHud();
    const role = myRole();
    const myScore = role === 'creator' ? renderSnap.scores.creator : renderSnap.scores.opponent;
    const oppScore = role === 'creator' ? renderSnap.scores.opponent : renderSnap.scores.creator;
    const meInfo = role === 'creator' ? players[0] : players[1];
    const oppInfo = role === 'creator' ? players[1] : players[0];

    const selfName = el('duelHudSelfName');
    const oppName = el('duelHudOppName');
    const selfHearts = el('duelHudSelfHearts');
    const oppHearts = el('duelHudOppHearts');
    const dashState = el('duelHudDashState');
    const fireState = el('duelHudFireState');
    const roundEl = el('duelHudRound');
    const scoreEl = el('duelHudScore');
    const clockEl = el('duelHudClock');
    const bannerEl = el('duelHudBanner');
    const oppVisEl = el('duelHudOppVis');

    if (selfName) selfName.textContent = (meInfo?.name || 'TOI').slice(0, 16);
    if (oppName) oppName.textContent = (oppInfo?.name || 'ADVERSAIRE').slice(0, 16);
    if (selfHearts) selfHearts.textContent = heartsText(renderSnap.self.hearts, renderSnap.self.maxHearts, renderSnap.self.parry);
    if (oppHearts) oppHearts.textContent = heartsText(renderSnap.opponent.hearts, renderSnap.opponent.maxHearts, renderSnap.opponent.parry);
    if (dashState) {
      dashState.textContent = renderSnap.self.dodgeSuccess
        ? 'Esquive parfaite !'
        : renderSnap.self.dashCooldown > 0
          ? `Esquive ${renderSnap.self.dashCooldown.toFixed(1)} s`
          : 'Esquive prête';
    }
    if (fireState) {
      const fireCd = Number(renderSnap.self.fireCooldown) || 0;
      fireState.textContent = fireCd > 0 ? `Tir ${fireCd.toFixed(1)} s` : 'Tir manuel prêt';
    }
    const boonsEl = el('duelHudBoons');
    if (boonsEl) {
      const boons = renderSnap.self.boons || {};
      const active = Object.keys(boons).filter(k => boons[k] > 0).map(k => `${Core.BOON_LABELS?.[k] || k} ${Math.ceil(boons[k])}s`);
      boonsEl.textContent = active.length ? `Atouts : ${active.join(' · ')}` : 'Casse des caisses pour des atouts';
    }
    if (roundEl) roundEl.textContent = `M${renderSnap.round}/3`;
    if (scoreEl) scoreEl.textContent = `${myScore} — ${oppScore}`;
    if (clockEl) clockEl.textContent = renderSnap.suddenDeath ? 'MORT SUBITE' : formatClock(renderSnap.roundTime);

    if (bannerEl) {
      if (renderSnap.roundPhase === 'intermission') {
        const wonRound = renderSnap.lastRoundWinner === role;
        bannerEl.textContent = wonRound ? 'Manche remportée · préparation…' : 'Manche perdue · nouvelle manche…';
      } else if (renderSnap.suddenDeath) {
        bannerEl.textContent = 'MORT SUBITE · Le prochain coup gagne la manche !';
      } else if ((renderSnap.world?.alarms || []).some(a => a.age < 1.2)) {
        const mine = (renderSnap.world.alarms || []).some(a => a.role === role && a.age < 1.2);
        bannerEl.textContent = mine ? '⚠ Alarme ! Ta position est repérée sur la minimap' : '⚠ Alarme adverse · position repérée sur la minimap';
      } else if (renderSnap.lunarRevealTimer > 0) {
        bannerEl.textContent = '☾ Pulsation lunaire · positions révélées !';
      } else if (renderSnap.roundTime >= Core.ZONE_SHRINK_START) {
        bannerEl.textContent = 'La brume se resserre vers le centre !';
      } else {
        const mapName = Core.getDuelMap?.(renderSnap.mapId || duel?.mapId)?.name || 'Clairière silencieuse';
        bannerEl.textContent = `${duel?.mode === 'ranked' ? 'Duel classé' : 'Duel amical'} · ${mapName}`;
      }
    }

    if (oppVisEl) {
      oppVisEl.textContent = renderSnap.opponent.visible
        ? 'Révélée !'
        : renderSnap.lastKnownOpponent
          ? 'Silhouette connue'
          : 'Hors du halo';
    }

    const statusBar = el('gameStatus') || el('status');
    if (statusBar) {
      statusBar.textContent = `DUEL ${duel?.mode === 'ranked' ? 'CLASSÉ' : 'AMICAL'} · M${renderSnap.round}/3 · ${myScore}-${oppScore}`;
    }
    const dashBtn = el('dash');
    if (dashBtn) {
      const cd = Number(renderSnap.self.dashCooldown) || 0;
      dashBtn.textContent = cd > 0 ? `✦ Esquive ${cd.toFixed(1)} s` : '✦ Esquive';
      dashBtn.classList.toggle('dash-ready', cd <= 0);
      dashBtn.classList.toggle('dash-cooldown', cd > 0);
    }
    const fireBtn = el('duelFire');
    if (fireBtn) {
      const fireCd = Number(renderSnap.self.fireCooldown) || 0;
      fireBtn.textContent = fireCd > 0 ? `✦ Tir ${fireCd.toFixed(1)} s` : '✦ Tir';
      fireBtn.classList.toggle('duel-fire-ready', fireCd <= 0);
      fireBtn.classList.toggle('duel-fire-cooldown', fireCd > 0);
    }
  }

  function resumeCombat() {
    combatPaused = false;
    if (typeof hideOverlay === 'function') hideOverlay();
    document.body?.classList.remove('menu-open');
  }

  function openCombatPauseOverlay() {
    if (!combatActive || !duel) return;
    combatPaused = true;
    const isRanked = duel.mode === 'ranked';
    overlay(`<section class="night-duel-screen duel-pause-modal" aria-label="Menu du duel en cours">
      <div class="duel-header">
        <div class="eyebrow">☾ DUEL EN DIRECT · LE TEMPS CONTINUE</div>
        <h2>ABANDONNER LE COMBAT ?</h2>
        <p>${isRanked
          ? 'Attention : abandonner un duel classé commencé compte immédiatement comme une défaite classée.'
          : 'Abandonner ce duel amical donnera la victoire à ton adversaire sans modifier ta cote.'}</p>
      </div>
      <div class="menu-actions duel-footer-actions">
        <button type="button" class="primary" id="duelResumeCombat">Reprendre le combat</button>
        <button type="button" class="secondary" id="duelResyncCombat">Resynchroniser</button>
        <button type="button" class="secondary team-danger" id="duelConfirmForfeit">${isRanked ? 'Abandonner (défaite classée)' : 'Abandonner le duel'}</button>
      </div>
    </section>`);
    document.body?.classList.add('menu-open');
    el('duelResumeCombat').onclick = resumeCombat;
    el('duelResyncCombat').onclick = () => {
      resyncDuelConnection();
      resumeCombat();
    };
    el('duelConfirmForfeit').onclick = () => {
      combatPaused = false;
      cancelOrForfeitDuel(true);
    };
  }

  function resetCombatInput() {
    duelKeys.clear();
    padDashHeld = false;
    padPauseHeld = false;
    pointerState.mouseAimActive = false;
    pointerState.fireMouse = false;
    fireButtonHeld = false;
    pointerState.moveTouchId = null;
    pointerState.aimTouchId = null;
    pointerState.touchMoveX = 0;
    pointerState.touchMoveY = 0;
    pointerState.aimX = Core.ARENA_CENTER.x;
    pointerState.aimY = Core.ARENA_CENTER.y;
    pointerState.moveCurrentX = 0;
    pointerState.moveCurrentY = 0;
    keyboardHeading = null;
    if (typeof moveInput === 'object' && moveInput) {
      for (const key of Object.keys(moveInput)) delete moveInput[key];
    }
  }

  function keyIsDown(name) {
    const raw = String(name || '');
    const lower = raw.toLowerCase();
    if (!lower) return false;
    if (duelKeys.has(lower)) return true;
    if (typeof moveInput === 'object' && moveInput && moveInput[lower]) return true;
    // Compatibilité avec les anciens harness qui exposaient un objet `keys`.
    if (typeof keys === 'object' && keys && (keys[raw] || keys[lower])) return true;
    return false;
  }

  function bindingFor(action, fallback) {
    const custom = typeof prefs === 'object' && prefs?.keys ? prefs.keys[action] : '';
    return String(custom || fallback || '');
  }

  function visibleAssistTargets(snap) {
    const targets = [];
    const world = snap?.world || {};
    for (const enemy of world.enemies || []) {
      if (enemy && enemy.state !== 'dead' && (enemy.hp == null || enemy.hp > 0)) {
        targets.push({ x: enemy.x, y: enemy.y, r: enemy.r || 20, priority: 0 });
      }
    }
    if (snap?.opponent?.visible && Number.isFinite(snap.opponent.x) && Number.isFinite(snap.opponent.y)) {
      targets.push({ x: snap.opponent.x, y: snap.opponent.y, r: 16, priority: 0 });
    }
    for (const crate of world.crates || []) {
      if (crate && (crate.hp == null || crate.hp > 0)) targets.push({ x: crate.x, y: crate.y, r: crate.r || 22, priority: 1 });
    }
    for (const bomb of world.bombs || []) {
      if (bomb) targets.push({ x: bomb.x, y: bomb.y, r: bomb.r || 18, priority: 1 });
    }
    return targets;
  }

  function assistTouchAim(aimX, aimY, hasAim, autoFire) {
    const snap = Core.orientSnapshotForViewer(renderSnap, myRole());
    const self = snap?.self;
    const targets = visibleAssistTargets(snap);
    if (!self || !targets.length) return { aimX, aimY, hasAim };

    if (hasAim) {
      // Aim « aimant » : si le doigt est proche d'une cible visible, on colle dessus.
      let best = null, bestDist = Infinity;
      for (const t of targets) {
        const d = Math.hypot(t.x - aimX, t.y - aimY);
        if (d <= t.r + AIM_ASSIST_SNAP_RADIUS && d < bestDist) { best = t; bestDist = d; }
      }
      if (best) return { aimX: best.x, aimY: best.y, hasAim: true };
      return { aimX, aimY, hasAim };
    }

    if (autoFire) {
      // Bouton Tir sans visée : accroche la cible visible la plus pertinente devant soi.
      const facing = Number.isFinite(self.aimAngle) ? self.aimAngle : Math.atan2(aimY - self.y, aimX - self.x);
      const fx = Math.cos(facing), fy = Math.sin(facing);
      let best = null, bestScore = Infinity;
      for (const t of targets) {
        const dx = t.x - self.x, dy = t.y - self.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1 || dist > AIM_ASSIST_FIRE_RANGE) continue;
        const cos = (dx * fx + dy * fy) / dist;
        if (cos < AIM_ASSIST_FIRE_COS) continue;
        const score = dist - (t.priority === 0 ? 60 : 0);
        if (score < bestScore) { best = t; bestScore = score; }
      }
      if (best) return { aimX: best.x, aimY: best.y, hasAim: true };
    }
    return { aimX, aimY, hasAim };
  }

  function readLocalCommand() {
    if (combatPaused) {
      return {
        moveX: 0, moveY: 0, focus: false, fire: false,
        hasTarget: false, targetX: pointerState.aimX, targetY: pointerState.aimY,
        hasAim: false, aimX: pointerState.aimX, aimY: pointerState.aimY,
        dashSeq
      };
    }

    let kx = 0;
    let ky = 0;
    const left = bindingFor('left', 'ArrowLeft');
    const right = bindingFor('right', 'ArrowRight');
    const up = bindingFor('up', 'ArrowUp');
    const down = bindingFor('down', 'ArrowDown');
    if (keyIsDown(left) || keyIsDown('a') || keyIsDown('q')) kx -= 1;
    if (keyIsDown(right) || keyIsDown('d')) kx += 1;
    if (keyIsDown(up) || keyIsDown('w') || keyIsDown('z')) ky -= 1;
    if (keyIsDown(down) || keyIsDown('s')) ky += 1;
    // Les flèches physiques ne sont plus un déplacement « haut de carte » :
    // elles pilotent le balai (voir plus bas). On retire leur contribution absolue.
    if (left.toLowerCase() === 'arrowleft' && keyIsDown('arrowleft')) kx += 1;
    if (right.toLowerCase() === 'arrowright' && keyIsDown('arrowright')) kx -= 1;
    if (up.toLowerCase() === 'arrowup' && keyIsDown('arrowup')) ky += 1;
    if (down.toLowerCase() === 'arrowdown' && keyIsDown('arrowdown')) ky -= 1;

    let moveX = kx;
    let moveY = ky;
    let focus = keyIsDown(bindingFor('focus', 'Shift'));
    let fire = keyIsDown(bindingFor('special', 'f')) || keyIsDown('f') || pointerState.fireMouse || fireButtonHeld;
    let aimX = pointerState.aimX;
    let aimY = pointerState.aimY;
    let hasAim = Boolean(pointerState.mouseAimActive || pointerState.aimTouchId !== null);

    // Visée tactile directe : le balai pointe immédiatement vers le doigt.
    // On garde un léger ralentissement de précision pendant la visée mobile.
    if (pointerState.aimTouchId !== null) focus = true;

    const gp = typeof navigator !== 'undefined' ? navigator.getGamepads?.()[0] : null;
    if (gp) {
      const ax = Number(gp.axes?.[0]) || 0;
      const ay = Number(gp.axes?.[1]) || 0;
      if (Math.hypot(ax, ay) > 0.18) {
        moveX = ax;
        moveY = ay;
      }
      focus = focus || Boolean(gp.buttons?.[6]?.pressed);
      fire = fire || Boolean(gp.buttons?.[7]?.pressed);
      const rx = Number(gp.axes?.[2]) || 0;
      const ry = Number(gp.axes?.[3]) || 0;
      if (Math.hypot(rx, ry) > 0.22 && renderSnap) {
        const screenSelf = Core.orientSnapshotForViewer(renderSnap, myRole()).self;
        aimX = Math.max(0, Math.min(Core.WORLD_WIDTH, screenSelf.x + rx * 260));
        aimY = Math.max(0, Math.min(Core.WORLD_HEIGHT, screenSelf.y + ry * 260));
        hasAim = true;
      }
    }

    // Assistance mobile uniquement, à partir de ce que la joueuse voit déjà
    // (brouillard de guerre respecté) : jamais une cible cachée.
    if (renderSnap && (pointerState.aimTouchId !== null || fireButtonHeld)) {
      const assisted = assistTouchAim(aimX, aimY, hasAim, fireButtonHeld && pointerState.aimTouchId === null && !pointerState.mouseAimActive);
      aimX = assisted.aimX;
      aimY = assisted.aimY;
      hasAim = assisted.hasAim;
      pointerState.aimX = aimX;
      pointerState.aimY = aimY;
    }

    // Flèches = pilotage relatif au balai : haut avance vers le devant du balai,
    // bas recule, gauche/droite pivotent le balai si la souris ne vise pas.
    const arrowTurn = (keyIsDown('arrowright') ? 1 : 0) - (keyIsDown('arrowleft') ? 1 : 0);
    const arrowThrottle = (keyIsDown('arrowup') ? 1 : 0) - (keyIsDown('arrowdown') ? 1 : 0);
    if ((arrowTurn !== 0 || arrowThrottle !== 0) && renderSnap) {
      const snapSelf = Core.orientSnapshotForViewer(renderSnap, myRole()).self;
      if (snapSelf) {
        const mouseAiming = pointerState.mouseAimActive || pointerState.aimTouchId !== null;
        let heading = Number.isFinite(keyboardHeading)
          ? keyboardHeading
          : (Number.isFinite(snapSelf.aimAngle) ? snapSelf.aimAngle : -Math.PI / 2);
        if (mouseAiming && Number.isFinite(aimX) && Number.isFinite(aimY)) {
          const dx = aimX - snapSelf.x, dy = aimY - snapSelf.y;
          if (Math.hypot(dx, dy) > 4) heading = Math.atan2(dy, dx);
        } else if (arrowTurn !== 0) {
          heading += arrowTurn * ARROW_TURN_RATE * Math.min(0.05, Math.max(0.001, lastControlDt));
        }
        keyboardHeading = heading;
        if (!mouseAiming) {
          // On envoie le cap au moteur pour que le balai reste orienté où on le tourne.
          aimX = clampNum(snapSelf.x + Math.cos(heading) * 260, 0, Core.WORLD_WIDTH);
          aimY = clampNum(snapSelf.y + Math.sin(heading) * 260, 0, Core.WORLD_HEIGHT);
          hasAim = true;
          pointerState.aimX = aimX;
          pointerState.aimY = aimY;
        }
        if (arrowThrottle !== 0) {
          moveX += Math.cos(heading) * arrowThrottle;
          moveY += Math.sin(heading) * arrowThrottle;
        }
        if (mouseAiming && arrowTurn !== 0) {
          // Souris active : gauche/droite deviennent un pas de côté relatif au balai.
          const side = heading + Math.PI / 2;
          moveX += Math.cos(side) * arrowTurn;
          moveY += Math.sin(side) * arrowTurn;
        }
      }
    } else if (!pointerState.mouseAimActive && pointerState.aimTouchId === null) {
      keyboardHeading = null;
    }

    if (Math.hypot(moveX, moveY) < 0.05 && pointerState.moveTouchId !== null) {
      moveX = pointerState.touchMoveX;
      moveY = pointerState.touchMoveY;
    }
    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    return {
      moveX: Math.round(moveX * 1000) / 1000,
      moveY: Math.round(moveY * 1000) / 1000,
      focus: Boolean(focus),
      fire: Boolean(fire),
      hasTarget: false,
      targetX: Math.round(aimX * 10) / 10,
      targetY: Math.round(aimY * 10) / 10,
      hasAim,
      aimX: Math.round(aimX * 10) / 10,
      aimY: Math.round(aimY * 10) / 10,
      dashSeq
    };
  }

  function localCommandToWorld(cmd) {
    return Core.orientCommandForRole(myRole(), cmd);
  }

  function pollDuelGamepadActions() {
    const gp = typeof navigator !== 'undefined' ? navigator.getGamepads?.()[0] : null;
    if (!gp) {
      padDashHeld = false;
      padPauseHeld = false;
      return;
    }
    const dashPressed = Boolean(gp.buttons?.[0]?.pressed);
    if (dashPressed && !padDashHeld) triggerLocalDodge();
    padDashHeld = dashPressed;
    const pausePressed = Boolean(gp.buttons?.[9]?.pressed);
    if (pausePressed && !padPauseHeld) {
      if (combatPaused) resumeCombat();
      else openCombatPauseOverlay();
    }
    padPauseHeld = pausePressed;
  }

  function triggerLocalDodge() {
    if (!combatActive || combatPaused) return false;
    dashSeq += 1;
    const cmd = localCommandToWorld(readLocalCommand());
    cmd.dash = true;
    if (myRole() === 'creator' && hostMatch) {
      Core.applyCommand(hostMatch, 'creator', cmd);
    } else if (channel) {
      channel.send('cmd', cmd);
    }
    if (typeof sfx === 'function') {
      try {
        sfx(540, 0.09, 'triangle', 0.05, 860);
      } catch (_) {}
    }
    return true;
  }

  function stepDuelFrame(dt) {
    if (!combatActive || !duel) return;
    lastControlDt = Number(dt) > 0 ? Number(dt) : lastControlDt;
    computeDuelCamera();
    applyTouchLayoutPreference();
    pollDuelGamepadActions();
    const cmd = localCommandToWorld(readLocalCommand());

    if (myRole() === 'creator' && hostMatch) {
      Core.applyCommand(hostMatch, 'creator', cmd);
      Core.stepMatch(hostMatch, dt);
      renderSnap = Core.createSnapshotFor(hostMatch, 'creator');

      snapshotAccum += dt;
      const mustFlush =
        snapshotAccum >= SNAPSHOT_INTERVAL ||
        hostMatch.events.some(ev => ev.type === 'round-end' || ev.type === 'match-end' || ev.type === 'lunar-pulse' || ev.type === 'sudden-death');
      if (mustFlush) {
        snapshotAccum = 0;
        sendGuestSnapshotNow();
      }
      if (renderSnap.roundPhase === 'finished' && renderSnap.winnerRole) {
        submitMatchReport(renderSnap.winnerRole);
      }
    } else if (myRole() === 'opponent') {
      cmdAccum += dt;
      if (cmdAccum >= CMD_INTERVAL && channel) {
        cmdAccum = 0;
        channel.send('cmd', cmd);
      }
      // Si les snapshots de l'hôte n'arrivent plus (onglet hôte en veille, coupure),
      // on redemande régulièrement un état frais plutôt que de rester figé.
      snapshotRequestAccum += dt;
      const staleMs = lastSnapshotAt ? Date.now() - lastSnapshotAt : Number.POSITIVE_INFINITY;
      if (channel && staleMs > 1200 && snapshotRequestAccum >= 0.5) {
        snapshotRequestAccum = 0;
        channel.send('snapshot-request', {});
      }
      if (renderSnap && renderSnap.roundPhase === 'fighting') {
        for (const p of renderSnap.projectiles || []) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }
    }

    updateTopHud();
  }

  function clampNum(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function computeDuelCamera() {
    const vw = Core.VIEW_WIDTH || 800;
    const vh = Core.VIEW_HEIGHT || 900;
    const ww = Core.WORLD_WIDTH || vw;
    const wh = Core.WORLD_HEIGHT || vh;
    let sx = vw / 2;
    let sy = vh / 2;
    if (renderSnap) {
      const oriented = Core.orientSnapshotForViewer(renderSnap, myRole());
      if (oriented && oriented.self) {
        sx = Number(oriented.self.x) || sx;
        sy = Number(oriented.self.y) || sy;
      }
    }
    duelCamera.x = clampNum(sx - vw / 2, 0, Math.max(0, ww - vw));
    duelCamera.y = clampNum(sy - vh / 2, 0, Math.max(0, wh - vh));
    return duelCamera;
  }

  function viewToWorld(pt) {
    return { x: pt.x + duelCamera.x, y: pt.y + duelCamera.y };
  }

  function boonColor(type) {
    return ({
      heal: '#7dffb0', swift: '#8fd6ff', rapid: '#ffd36e',
      power: '#ff8f6e', ward: '#b9a6ff', ghost: '#9ef7e8', dash: '#c6ff8f'
    })[type] || '#e7d7ff';
  }

  function drawAsset(c, bag, key, x, y, w, opts = {}) {
    const source = bag === 'CollectibleArt' ? window.CollectibleArt?.art : window.MinuitArt;
    const im = source?.[key];
    if (!im || !im.complete || !im.naturalWidth) return false;
    const h = w * (im.naturalHeight / im.naturalWidth);
    c.save();
    c.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    if (opts.filter) c.filter = opts.filter;
    c.translate(x, y);
    if (opts.rotate) c.rotate(opts.rotate);
    c.drawImage(im, -w / 2, -h / 2, w, h);
    c.restore();
    return true;
  }

  function boonArtKey(type) {
    return ({ heal: 'heal', ward: 'pickup-shield', swift: 'candy', rapid: 'fire', power: 'pierce', ghost: 'familiar', dash: 'rocket' })[type] || 'points';
  }

  function drawAlarms(c, alarms, self) {
    for (const alarm of alarms || []) {
      const ratio = Math.min(1, alarm.age / Math.max(0.1, alarm.maxAge));
      const isMine = alarm.role === self.role;
      const col = alarm.role === 'world' ? '255, 170, 90' : isMine ? '140, 220, 255' : '255, 120, 140';
      c.strokeStyle = `rgba(${col}, ${(1 - ratio) * 0.9})`;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(alarm.x, alarm.y, 14 + ratio * 46, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = `rgba(${col}, ${(1 - ratio) * 0.95})`;
      c.font = 'bold 16px Arial';
      c.textAlign = 'center';
      c.fillText('!', alarm.x, alarm.y + 6);
    }
  }

  function drawWorldDecor(c, world, self, time) {
    if (!world) return;
    // Décor solide : rochers illustrés et ruines de pierre, palette du jeu principal.
    for (const ob of world.obstacles || []) {
      if (ob.shape === 'rect') {
        const grad = c.createLinearGradient(ob.x, ob.y, ob.x, ob.y + ob.h);
        grad.addColorStop(0, '#3a2c4a');
        grad.addColorStop(1, '#1b1428');
        c.fillStyle = grad;
        c.strokeStyle = '#6e587e';
        c.lineWidth = 2;
        c.fillRect(ob.x, ob.y, ob.w, ob.h);
        c.strokeRect(ob.x, ob.y, ob.w, ob.h);
        c.strokeStyle = 'rgba(212, 160, 84, 0.45)';
        c.beginPath();
        c.moveTo(ob.x + 4, ob.y + 4);
        c.lineTo(ob.x + ob.w - 4, ob.y + 4);
        c.stroke();
        c.strokeStyle = 'rgba(20, 14, 30, 0.6)';
        for (let x = ob.x + 18; x < ob.x + ob.w; x += 26) {
          c.beginPath(); c.moveTo(x, ob.y + 6); c.lineTo(x - 6, ob.y + ob.h - 6); c.stroke();
        }
      } else {
        if (!drawAsset(c, 'MinuitArt', 'rock', ob.x, ob.y, ob.r * 2.25)) {
          c.fillStyle = '#2a2038';
          c.strokeStyle = '#8a7099';
          c.lineWidth = 2;
          c.beginPath();
          for (let i = 0; i < 7; i += 1) {
            const a = (i / 7) * Math.PI * 2;
            const rr = ob.r * (0.85 + ((i * 37) % 10) / 40);
            const px = ob.x + Math.cos(a) * rr, py = ob.y + Math.sin(a) * rr;
            if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
          }
          c.closePath(); c.fill(); c.stroke();
        }
      }
    }
    // Pièges : runes / toiles dorées et roses.
    for (const trap of world.traps || []) {
      const armed = !(trap.cooldown > 0);
      const col = armed ? 'rgba(255, 143, 176, 0.9)' : 'rgba(120, 100, 140, 0.45)';
      c.save();
      c.strokeStyle = col;
      c.fillStyle = armed ? 'rgba(70, 22, 48, 0.5)' : 'rgba(35, 26, 48, 0.4)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(trap.x, trap.y, trap.r, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = armed ? 'rgba(212, 160, 84, 0.7)' : 'rgba(120, 100, 140, 0.3)';
      c.beginPath(); c.arc(trap.x, trap.y, trap.r * 0.62, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + time * 0.4;
        c.beginPath();
        c.moveTo(trap.x + Math.cos(a) * 4, trap.y + Math.sin(a) * 4);
        c.lineTo(trap.x + Math.cos(a) * (trap.r - 3), trap.y + Math.sin(a) * (trap.r - 3));
        c.stroke();
      }
      c.restore();
    }
    // Bombes : lanternes explosives, lueur orangée pulsante.
    for (const bomb of world.bombs || []) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 5 + bomb.id);
      const glow = c.createRadialGradient(bomb.x, bomb.y, 2, bomb.x, bomb.y, bomb.r * 3);
      glow.addColorStop(0, `rgba(255, 170, 80, ${0.28 + pulse * 0.2})`);
      glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(bomb.x, bomb.y, bomb.r * 3, 0, Math.PI * 2); c.fill();
      if (!drawAsset(c, 'MinuitArt', 'lantern', bomb.x, bomb.y, bomb.r * 3.1)) {
        c.fillStyle = '#5a2a22';
        c.strokeStyle = '#d4a054';
        c.lineWidth = 2;
        c.beginPath(); c.arc(bomb.x, bomb.y, bomb.r, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.fillStyle = `rgba(255, 230, 150, ${0.5 + pulse * 0.5})`;
      c.beginPath(); c.arc(bomb.x + 4, bomb.y - bomb.r * 1.4, 2.4, 0, Math.PI * 2); c.fill();
    }
    // Caisses : coffres illustrés du jeu principal.
    for (const crate of world.crates || []) {
      const size = crate.r * 2.9;
      if (!drawAsset(c, 'CollectibleArt', 'chest', crate.x, crate.y, size)) {
        c.fillStyle = crate.hp > 1 ? '#463044' : '#2a1f30';
        c.strokeStyle = '#d4a054';
        c.lineWidth = 2;
        c.fillRect(crate.x - crate.r, crate.y - crate.r, crate.r * 2, crate.r * 2);
        c.strokeRect(crate.x - crate.r, crate.y - crate.r, crate.r * 2, crate.r * 2);
      }
      if (crate.hp <= 1) {
        c.strokeStyle = 'rgba(20, 12, 24, 0.8)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(crate.x - crate.r * 0.6, crate.y - crate.r * 0.5);
        c.lineTo(crate.x + crate.r * 0.2, crate.y + crate.r * 0.6);
        c.stroke();
      }
    }
    // Atouts : objets illustrés (cœur, bouclier, bonbon, feu, rocket…).
    for (const pk of world.pickups || []) {
      const bob = Math.sin(time * 4 + pk.id) * 3;
      const col = boonColor(pk.boon);
      const glow = c.createRadialGradient(pk.x, pk.y + bob, 2, pk.x, pk.y + bob, pk.r * 2.4);
      glow.addColorStop(0, col + '66');
      glow.addColorStop(1, col + '00');
      c.fillStyle = glow;
      c.beginPath(); c.arc(pk.x, pk.y + bob, pk.r * 2.4, 0, Math.PI * 2); c.fill();
      if (!drawAsset(c, 'CollectibleArt', boonArtKey(pk.boon), pk.x, pk.y + bob, pk.r * 2.6)) {
        c.fillStyle = col;
        c.beginPath(); c.arc(pk.x, pk.y + bob, pk.r * 0.7, 0, Math.PI * 2); c.fill();
      }
    }
    // Sentinelles : créatures du jeu principal, endormies / en ronde / éveillées.
    for (const enemy of world.enemies || []) {
      const awake = enemy.state === 'awake';
      const patrol = enemy.state === 'patrol';
      const kind = enemy.kind || 'ghost';
      const size = enemy.r * 2.7;
      c.save();
      c.fillStyle = 'rgba(8, 5, 14, 0.45)';
      c.beginPath(); c.ellipse(enemy.x, enemy.y + enemy.r * 0.8, enemy.r * 0.9, enemy.r * 0.35, 0, 0, Math.PI * 2); c.fill();
      const alpha = awake ? 1 : patrol ? 0.82 : 0.5;
      const filter = awake ? 'sepia(1) saturate(2.4) hue-rotate(-32deg) brightness(1.08)' : patrol ? 'none' : 'grayscale(0.65) brightness(0.72)';
      if (!drawAsset(c, 'MinuitArt', kind, enemy.x, enemy.y, size, { alpha, filter })) {
        c.globalAlpha = alpha;
        c.fillStyle = awake ? '#5a1f2a' : '#241a38';
        c.strokeStyle = awake ? '#ff6b88' : '#8a7099';
        c.lineWidth = 2;
        c.beginPath(); c.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2); c.fill(); c.stroke();
        c.globalAlpha = 1;
      }
      c.restore();
      if (awake) {
        const glow = c.createRadialGradient(enemy.x, enemy.y, 2, enemy.x, enemy.y, enemy.r * 2.2);
        glow.addColorStop(0, 'rgba(255, 90, 120, 0.28)');
        glow.addColorStop(1, 'rgba(255, 90, 120, 0)');
        c.fillStyle = glow;
        c.beginPath(); c.arc(enemy.x, enemy.y, enemy.r * 2.2, 0, Math.PI * 2); c.fill();
      } else if (!patrol) {
        c.fillStyle = 'rgba(210, 200, 235, 0.7)';
        c.font = 'bold 12px Arial';
        c.textAlign = 'center';
        const z = Math.sin(time * 2 + enemy.id) * 2;
        c.fillText('z', enemy.x + enemy.r + 5, enemy.y - enemy.r + z);
        c.fillText('Z', enemy.x + enemy.r + 13, enemy.y - enemy.r - 8 + z);
      }
    }
  }

  function drawWorldEffects(c, effects) {
    for (const fx of effects || []) {
      const ratio = Math.min(1, fx.age / Math.max(0.1, fx.maxAge));
      if (fx.type === 'explosion') {
        c.fillStyle = `rgba(255, 150, 70, ${(1 - ratio) * 0.5})`;
        c.beginPath();
        c.arc(fx.x, fx.y, (fx.r || 120) * (0.3 + ratio * 0.7), 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = `rgba(255, 220, 150, ${(1 - ratio) * 0.9})`;
        c.lineWidth = 4;
        c.beginPath();
        c.arc(fx.x, fx.y, (fx.r || 120) * ratio, 0, Math.PI * 2);
        c.stroke();
      } else if (fx.type === 'crate-break') {
        c.strokeStyle = `rgba(201, 154, 91, ${(1 - ratio)})`;
        c.lineWidth = 3;
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2;
          const d = 8 + ratio * 30;
          c.beginPath();
          c.moveTo(fx.x + Math.cos(a) * 6, fx.y + Math.sin(a) * 6);
          c.lineTo(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d);
          c.stroke();
        }
      } else if (fx.type === 'enemy-death') {
        c.fillStyle = `rgba(255, 107, 136, ${(1 - ratio) * 0.7})`;
        c.beginPath();
        c.arc(fx.x, fx.y, 10 + ratio * 34, 0, Math.PI * 2);
        c.fill();
      } else if (fx.type === 'trap') {
        c.strokeStyle = `rgba(255, 120, 170, ${(1 - ratio)})`;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(fx.x, fx.y, 10 + ratio * 30, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  function drawMinimap(c, viewSnap, cam) {
    const vw = Core.VIEW_WIDTH || 800;
    const ww = Core.WORLD_WIDTH || 1800;
    const wh = Core.WORLD_HEIGHT || 2000;
    const mmW = 176;
    const mmH = Math.round(mmW * (wh / ww));
    const mx = vw - mmW - 12;
    const my = 12;
    const sx = mmW / ww;
    const sy = mmH / wh;
    const world = viewSnap.world || {};
    const self = viewSnap.self;

    c.save();
    const panel = c.createLinearGradient(mx, my, mx, my + mmH);
    panel.addColorStop(0, 'rgba(29, 21, 44, 0.92)');
    panel.addColorStop(1, 'rgba(12, 8, 20, 0.92)');
    c.fillStyle = panel;
    c.strokeStyle = 'rgba(212, 160, 84, 0.55)';
    c.lineWidth = 1.5;
    c.fillRect(mx, my, mmW, mmH);
    c.strokeRect(mx, my, mmW, mmH);
    c.fillStyle = '#e8c9a0';
    c.font = 'bold 9px Arial';
    c.textAlign = 'left';
    c.fillText('CARTE · BROUILLARD', mx + 6, my + 12);

    function px(x) { return mx + x * sx; }
    function py(y) { return my + y * sy; }

    // Brouillard strict : seul le décor actuellement éclairé apparaît.
    for (const ob of world.obstacles || []) {
      c.fillStyle = 'rgba(160, 132, 184, 0.7)';
      if (ob.shape === 'rect') c.fillRect(px(ob.x), py(ob.y), ob.w * sx, ob.h * sy);
      else { c.beginPath(); c.arc(px(ob.x), py(ob.y), Math.max(1.6, ob.r * sx), 0, Math.PI * 2); c.fill(); }
    }
    for (const trap of world.traps || []) {
      c.fillStyle = trap.cooldown > 0 ? 'rgba(120,90,120,0.5)' : 'rgba(255,143,176,0.9)';
      c.fillRect(px(trap.x) - 1.5, py(trap.y) - 1.5, 3, 3);
    }
    for (const bomb of world.bombs || []) {
      c.fillStyle = '#ffab5e';
      c.beginPath(); c.arc(px(bomb.x), py(bomb.y), 2, 0, Math.PI * 2); c.fill();
    }
    for (const crate of world.crates || []) {
      c.fillStyle = '#d4a054';
      c.fillRect(px(crate.x) - 2, py(crate.y) - 2, 4, 4);
    }
    for (const pk of world.pickups || []) {
      c.fillStyle = boonColor(pk.boon);
      c.beginPath(); c.arc(px(pk.x), py(pk.y), 2, 0, Math.PI * 2); c.fill();
    }
    for (const enemy of world.enemies || []) {
      c.fillStyle = enemy.state === 'awake' ? '#ff6b88' : 'rgba(190,178,214,0.8)';
      c.beginPath(); c.arc(px(enemy.x), py(enemy.y), enemy.state === 'awake' ? 2.6 : 1.9, 0, Math.PI * 2); c.fill();
    }
    for (const alarm of world.alarms || []) {
      const ratio = Math.min(1, alarm.age / Math.max(0.1, alarm.maxAge));
      const col = alarm.role === 'world' ? '255,170,90' : alarm.role === self.role ? '140,220,255' : '255,120,140';
      c.strokeStyle = `rgba(${col}, ${1 - ratio})`;
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(px(alarm.x), py(alarm.y), 3 + ratio * 8, 0, Math.PI * 2); c.stroke();
    }
    const opp = viewSnap.opponent;
    if (opp && opp.visible && typeof opp.x === 'number') {
      c.fillStyle = '#ff9ca8';
      c.beginPath(); c.arc(px(opp.x), py(opp.y), 3, 0, Math.PI * 2); c.fill();
    } else if (viewSnap.lastKnownOpponent) {
      c.fillStyle = 'rgba(184,164,214,0.6)';
      c.beginPath(); c.arc(px(viewSnap.lastKnownOpponent.x), py(viewSnap.lastKnownOpponent.y), 2.5, 0, Math.PI * 2); c.fill();
    }
    if (self) {
      c.fillStyle = '#9ee7ff';
      c.beginPath(); c.arc(px(self.x), py(self.y), 3.2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(158,231,255,0.5)';
      c.beginPath(); c.arc(px(self.x), py(self.y), (self.haloRadius || 180) * sx, 0, Math.PI * 2); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    c.strokeRect(px(cam.x), py(cam.y), (Core.VIEW_WIDTH || 800) * sx, (Core.VIEW_HEIGHT || 900) * sy);
    c.restore();
  }

  function drawWitchFigure(c, x, y, aimAngle, ringColor, options = {}) {
    c.save();
    c.translate(x, y);

    if (options.ghost) {
      c.globalAlpha = Math.max(0.14, 0.5 * (1 - (options.age || 0) / (options.maxAge || 6)));
    }

    // Ombre au sol.
    c.fillStyle = 'rgba(8, 5, 14, 0.4)';
    c.beginPath(); c.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2); c.fill();

    // Halo / anneau cosmétique.
    c.strokeStyle = ringColor;
    c.lineWidth = options.isSelf ? 2.4 : 2.0;
    c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke();

    if (options.invulnerable) {
      c.strokeStyle = '#9ef7e8';
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(0, 0, 28, 0, Math.PI * 2); c.stroke();
    }
    if (options.revealedByShot) {
      c.strokeStyle = '#ffd27d';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 26, 0, Math.PI * 2); c.stroke();
    }
    if (typeof aimAngle === 'number' && !options.ghost) {
      c.strokeStyle = options.isSelf ? '#e7d7ff99' : '#ff9ca899';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(Math.cos(aimAngle) * 20, Math.sin(aimAngle) * 20);
      c.lineTo(Math.cos(aimAngle) * 34, Math.sin(aimAngle) * 34);
      c.stroke();
    }

    // Sorcière illustrée du jeu principal (cape, balai, chapeau).
    // Le sprite witchFlight est peint manche/embout magique vers le nord :
    // on le pivote pour que l'avant du balai pointe vers le curseur/la visée.
    const witchKey = window.MinuitArt?.witchFlight?.complete ? 'witchFlight' : 'witch';
    const facing = (typeof aimAngle === 'number' ? aimAngle : -Math.PI / 2) + Math.PI / 2;
    const filter = options.ghost ? 'grayscale(0.6) brightness(0.8)' : options.isSelf ? 'none' : 'sepia(0.5) saturate(1.4) hue-rotate(-28deg)';
    if (!drawAsset(c, 'MinuitArt', witchKey, 0, -4, 62, { filter, rotate: facing })) {
      c.rotate(facing);
      c.fillStyle = options.ghost ? '#9e8cb8' : options.isSelf ? '#f5e8ff' : '#ffb8c9';
      c.beginPath();
      c.moveTo(0, -17); c.lineTo(12, 13); c.lineTo(0, 7); c.lineTo(-12, 13);
      c.closePath(); c.fill();
      c.fillStyle = options.ghost ? '#6d5c88' : ringColor;
      c.beginPath(); c.arc(0, -2, 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawTouchControls(c) {
    if (pointerState.moveTouchId === null) return;
    const ox = pointerState.moveOriginX, oy = pointerState.moveOriginY;
    const dx = pointerState.moveCurrentX - ox, dy = pointerState.moveCurrentY - oy;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, TOUCH_MAX_DRAG);
    const kx = ox + (dx / dist) * clamped * 0.5;
    const ky = oy + (dy / dist) * clamped * 0.5;
    c.save();
    c.globalAlpha = 0.55;
    c.strokeStyle = '#cbb9dc';
    c.lineWidth = 2;
    c.beginPath(); c.arc(ox, oy, 44, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(231, 215, 255, 0.35)';
    c.beginPath(); c.arc(kx, ky, 20, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.8;
    c.fillStyle = '#e8c9a0';
    c.font = '9px Arial';
    c.textAlign = 'center';
    c.fillText('DÉPLACEMENT', ox, oy + 58);
    if (pointerState.aimTouchId !== null) {
      c.fillStyle = '#9ef7e8';
      c.fillText('VISÉE DIRECTE', ox, oy + 70);
    }
    c.restore();
  }

  function drawDuelArena() {
    if (!combatActive || !renderSnap || typeof ctx === 'undefined' || !ctx) return;
    const c = ctx;
    const viewSnap = Core.orientSnapshotForViewer(renderSnap, myRole());
    const vw = Core.VIEW_WIDTH || 800;
    const vh = Core.VIEW_HEIGHT || 900;
    const ww = Core.WORLD_WIDTH || vw;
    const wh = Core.WORLD_HEIGHT || vh;
    const cx = Core.ARENA_CENTER.x;
    const cy = Core.ARENA_CENTER.y;
    const cam = computeDuelCamera();
    const self = viewSnap.self;
    const time = Number(viewSnap.roundTime) || 0;

    c.save();
    // Fond écran.
    c.fillStyle = '#06040d';
    c.fillRect(0, 0, vw, vh);

    c.save();
    c.translate(-cam.x, -cam.y);

    // Sol visible.
    const bg = c.createLinearGradient(cam.x, cam.y, cam.x, cam.y + vh);
    bg.addColorStop(0, '#070510');
    bg.addColorStop(0.5, '#0d091b');
    bg.addColorStop(1, '#06040d');
    c.fillStyle = bg;
    c.fillRect(cam.x, cam.y, vw, vh);

    // Grille / repères.
    c.strokeStyle = 'rgba(155, 130, 196, 0.07)';
    c.lineWidth = 1;
    const grid = 120;
    const gx0 = Math.floor(cam.x / grid) * grid;
    const gy0 = Math.floor(cam.y / grid) * grid;
    for (let x = gx0; x <= cam.x + vw; x += grid) {
      c.beginPath(); c.moveTo(x, cam.y); c.lineTo(x, cam.y + vh); c.stroke();
    }
    for (let y = gy0; y <= cam.y + vh; y += grid) {
      c.beginPath(); c.moveTo(cam.x, y); c.lineTo(cam.x + vw, y); c.stroke();
    }
    c.strokeStyle = 'rgba(155, 130, 196, 0.12)';
    for (const r of [220, 440, 660]) {
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    }
    // Poussière d'étoiles fixe, même ambiance que le jeu principal.
    c.fillStyle = 'rgba(212, 196, 226, 0.2)';
    for (let i = 0; i < 140; i += 1) {
      const x = (i * 113.27) % ww;
      const y = (i * 67.11) % wh;
      if (x < cam.x - 4 || x > cam.x + vw + 4 || y < cam.y - 4 || y > cam.y + vh + 4) continue;
      const r = 0.6 + (i % 3) * 0.35;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    // Bordure du monde.
    c.strokeStyle = 'rgba(182, 152, 224, 0.4)';
    c.lineWidth = 3;
    c.strokeRect(2, 2, ww - 4, wh - 4);

    // Décor, pièges, bombes, caisses, ennemis, alarmes.
    drawWorldDecor(c, viewSnap.world, self, time);

    // Halo de vision.
    const selfCosmetic = Core.getHaloCosmetic(self.cosmetic);
    const haloGrad = c.createRadialGradient(self.x, self.y, 18, self.x, self.y, self.haloRadius);
    haloGrad.addColorStop(0, selfCosmetic.color);
    haloGrad.addColorStop(0.72, 'rgba(92, 68, 138, 0.09)');
    haloGrad.addColorStop(1, 'rgba(10, 7, 20, 0)');
    c.fillStyle = haloGrad;
    c.beginPath();
    c.arc(self.x, self.y, self.haloRadius, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = selfCosmetic.ring + '55';
    c.lineWidth = 1.5;
    c.setLineDash([7, 6]);
    c.beginPath();
    c.arc(self.x, self.y, self.haloRadius, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);

    // Onde lunaire.
    if (viewSnap.lunarWave) {
      const p = Math.min(1, viewSnap.lunarWave.age / Math.max(0.1, viewSnap.lunarWave.maxAge));
      c.strokeStyle = `rgba(198, 226, 255, ${(1 - p) * 0.7})`;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(cx, cy, 40 + p * 900, 0, Math.PI * 2);
      c.stroke();
    }

    // Pas.
    for (const step of viewSnap.footsteps || []) {
      const ratio = Math.min(1, step.age / Math.max(0.1, step.maxAge));
      const isMine = step.ownerRole === self.role;
      c.strokeStyle = isMine
        ? `rgba(166, 214, 255, ${(1 - ratio) * 0.28})`
        : `rgba(255, 196, 132, ${(1 - ratio) * 0.58})`;
      c.lineWidth = isMine ? 1.2 : 2;
      c.beginPath();
      c.arc(step.x, step.y, 6 + ratio * 22, 0, Math.PI * 2);
      c.stroke();
    }

    // Traînées d'esquive.
    for (const trail of viewSnap.dodgeTrails || []) {
      const ratio = Math.min(1, trail.age / Math.max(0.1, trail.maxAge));
      const isMine = trail.ownerRole === self.role;
      c.strokeStyle = isMine
        ? `rgba(142, 245, 226, ${(1 - ratio) * 0.7})`
        : `rgba(255, 148, 200, ${(1 - ratio) * 0.75})`;
      c.lineWidth = 5 * (1 - ratio * 0.5);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(trail.x1, trail.y1);
      c.lineTo(trail.x2, trail.y2);
      c.stroke();
    }

    // Dernière position connue.
    const opp = viewSnap.opponent;
    if (!opp.visible && viewSnap.lastKnownOpponent) {
      const lk = viewSnap.lastKnownOpponent;
      drawWitchFigure(c, lk.x, lk.y, lk.aimAngle, '#b8a4d6', { ghost: true, age: lk.age, maxAge: lk.maxAge });
    }
    if (opp.visible && typeof opp.x === 'number' && typeof opp.y === 'number') {
      const oppCosmetic = Core.getHaloCosmetic(opp.cosmetic);
      drawWitchFigure(c, opp.x, opp.y, opp.aimAngle, oppCosmetic.ring, { isSelf: false, revealedByShot: opp.revealedByShot });
    }

    // Brouillard de guerre : l'obscurité retombe hors du halo de lumière.
    const fog = c.createRadialGradient(self.x, self.y, self.haloRadius * 0.42, self.x, self.y, self.haloRadius * 1.22);
    fog.addColorStop(0, 'rgba(6, 4, 13, 0)');
    fog.addColorStop(0.68, 'rgba(6, 4, 13, 0.5)');
    fog.addColorStop(1, 'rgba(6, 4, 13, 0.94)');
    c.fillStyle = fog;
    c.fillRect(cam.x, cam.y, vw, vh);

    // Effets lumineux (explosions) et alarmes restent visibles par-dessus l'obscurité.
    drawWorldEffects(c, viewSnap.effects);
    drawAlarms(c, viewSnap.world?.alarms, self);

    // Projectiles dangereux : toujours visibles, même hors du halo.
    for (const proj of viewSnap.projectiles || []) {
      const isDanger = proj.ownerRole !== self.role;
      const speed = Math.hypot(proj.vx, proj.vy) || 1;
      const tailX = proj.x - (proj.vx / speed) * (proj.r * 2.4);
      const tailY = proj.y - (proj.vy / speed) * (proj.r * 2.4);
      c.strokeStyle = isDanger ? 'rgba(255, 112, 96, 0.75)' : 'rgba(165, 225, 255, 0.65)';
      c.lineWidth = Math.max(3, proj.r * 0.85);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(tailX, tailY);
      c.lineTo(proj.x, proj.y);
      c.stroke();
      c.fillStyle = isDanger ? '#ff5d6c' : '#9ee7ff';
      c.beginPath();
      c.arc(proj.x, proj.y, proj.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff8ea';
      c.beginPath();
      c.arc(proj.x, proj.y, Math.max(2.5, proj.r * 0.44), 0, Math.PI * 2);
      c.fill();
    }

    // Sorcière locale.
    drawWitchFigure(c, self.x, self.y, self.aimAngle, selfCosmetic.ring, { isSelf: true, invulnerable: self.invulnerable });
    if (self.dodgeSuccess) {
      c.fillStyle = '#9ef7e8';
      c.font = 'bold 13px Arial';
      c.textAlign = 'center';
      c.fillText('ESQUIVE !', self.x, self.y - 32);
    }

    // Réticule de visée : montre où l'avant du balai pointe.
    if (pointerState.mouseAimActive || pointerState.aimTouchId !== null) {
      const ax = pointerState.aimX, ay = pointerState.aimY;
      c.save();
      c.strokeStyle = 'rgba(231, 215, 255, 0.55)';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(ax, ay, 9, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(ax - 14, ay); c.lineTo(ax - 5, ay);
      c.moveTo(ax + 5, ay); c.lineTo(ax + 14, ay);
      c.moveTo(ax, ay - 14); c.lineTo(ax, ay - 5);
      c.moveTo(ax, ay + 5); c.lineTo(ax, ay + 14);
      c.stroke();
      c.restore();
    }

    // Brume de zone.
    if (viewSnap.zoneRadius < (Core.ZONE_INITIAL_RADIUS || 1320) - 1) {
      c.save();
      c.beginPath();
      c.rect(cam.x, cam.y, vw, vh);
      c.arc(cx, cy, viewSnap.zoneRadius, 0, Math.PI * 2, true);
      c.fillStyle = viewSnap.suddenDeath ? 'rgba(46, 10, 28, 0.76)' : 'rgba(18, 10, 34, 0.68)';
      c.fill('evenodd');
      c.strokeStyle = viewSnap.suddenDeath
        ? '#ff6b88'
        : viewSnap.roundTime >= Core.ZONE_SHRINK_START ? '#ffb86c' : 'rgba(182, 152, 224, 0.35)';
      c.lineWidth = viewSnap.roundTime >= Core.ZONE_SHRINK_START ? 3 : 1.5;
      c.beginPath();
      c.arc(cx, cy, viewSnap.zoneRadius, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    c.restore(); // caméra

    // Minimap en haut à droite de l'espace de jeu.
    drawMinimap(c, viewSnap, cam);
    drawTouchControls(c);
    c.restore();
  }

  function canvasCoordsFromEvent(evt) {
    const node = getCanvas();
    const vw = Core.VIEW_WIDTH || 800;
    const vh = Core.VIEW_HEIGHT || 900;
    if (!node) return { x: vw / 2, y: vh / 2 };
    const rect = node.getBoundingClientRect();
    const rx = rect.width > 0 ? (evt.clientX - rect.left) / rect.width : 0.5;
    const ry = rect.height > 0 ? (evt.clientY - rect.top) / rect.height : 0.5;
    // Coordonnées ÉCRAN (viewport). La conversion vers le monde se fait avec la caméra.
    return {
      x: Math.max(0, Math.min(vw, rx * vw)),
      y: Math.max(0, Math.min(vh, ry * vh))
    };
  }

  function wireCombatInputs() {
    const node = getCanvas();
    if (node) {
      node.addEventListener('pointerdown', evt => {
        if (!combatActive) return;
        evt.preventDefault();
        try { node.setPointerCapture?.(evt.pointerId); } catch (_) {}
        const pt = canvasCoordsFromEvent(evt);
        if (evt.pointerType === 'touch') {
          if (pointerState.moveTouchId === null) {
            pointerState.moveTouchId = evt.pointerId;
            pointerState.moveOriginX = pt.x;
            pointerState.moveOriginY = pt.y;
            pointerState.moveCurrentX = pt.x;
            pointerState.moveCurrentY = pt.y;
            pointerState.touchMoveX = 0;
            pointerState.touchMoveY = 0;
          } else if (pointerState.aimTouchId === null) {
            pointerState.aimTouchId = evt.pointerId;
            const wp = viewToWorld(pt);
            pointerState.aimX = wp.x;
            pointerState.aimY = wp.y;
          }
          return;
        }
        if (evt.button === 2) {
          evt.preventDefault();
          triggerLocalDodge();
          return;
        }
        if (evt.button === 0) {
          pointerState.fireMouse = true;
          pointerState.mouseAimActive = true;
          const wp = viewToWorld(pt);
          pointerState.aimX = wp.x;
          pointerState.aimY = wp.y;
        }
      });

      node.addEventListener('pointermove', evt => {
        if (!combatActive) return;
        if (evt.pointerType === 'touch') evt.preventDefault();
        const pt = canvasCoordsFromEvent(evt);
        if (evt.pointerType === 'touch') {
          if (evt.pointerId === pointerState.moveTouchId) {
            const dx = pt.x - pointerState.moveOriginX;
            const dy = pt.y - pointerState.moveOriginY;
            pointerState.moveCurrentX = pt.x;
            pointerState.moveCurrentY = pt.y;
            const dist = Math.hypot(dx, dy);
            if (dist > TOUCH_DEADZONE) {
              // Linéaire : direction = doigt, vitesse proportionnelle sans courbe.
              const t = Math.min(1, (dist - TOUCH_DEADZONE) / (TOUCH_MAX_DRAG - TOUCH_DEADZONE));
              const scale = (t / dist) * TOUCH_MOVE_SCALE;
              pointerState.touchMoveX = dx * scale;
              pointerState.touchMoveY = dy * scale;
            } else {
              pointerState.touchMoveX = 0;
              pointerState.touchMoveY = 0;
            }
          } else if (evt.pointerId === pointerState.aimTouchId) {
            const wp = viewToWorld(pt);
            pointerState.aimX = wp.x;
            pointerState.aimY = wp.y;
          }
          return;
        }
        pointerState.mouseAimActive = true;
        const wp = viewToWorld(pt);
        pointerState.aimX = wp.x;
        pointerState.aimY = wp.y;
      });

      const releasePointer = evt => {
        if (evt.pointerId === pointerState.moveTouchId) {
          pointerState.moveTouchId = null;
          pointerState.touchMoveX = 0;
          pointerState.touchMoveY = 0;
        } else if (evt.pointerId === pointerState.aimTouchId) {
          pointerState.aimTouchId = null;
        } else if (evt.pointerType !== 'touch') {
          pointerState.fireMouse = false;
        }
      };
      node.addEventListener('pointerup', releasePointer);
      node.addEventListener('pointercancel', releasePointer);
      node.addEventListener('contextmenu', evt => {
        if (combatActive) evt.preventDefault();
      });
    }

    window.addEventListener('keydown', evt => {
      if (!combatActive) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const lower = String(evt.key || '').toLowerCase();
      duelKeys.add(lower);
      const dashKey = bindingFor('dash', ' ').toLowerCase();
      const pauseKey = bindingFor('pause', 'p').toLowerCase();
      if (evt.code === 'Space' || lower === 'e' || lower === dashKey) {
        evt.preventDefault();
        if (!evt.repeat) triggerLocalDodge();
      } else if (lower === 'escape' || lower === pauseKey) {
        evt.preventDefault();
        if (evt.repeat) return;
        if (combatPaused) resumeCombat();
        else openCombatPauseOverlay();
      }
    });
    window.addEventListener('keyup', evt => {
      duelKeys.delete(String(evt.key || '').toLowerCase());
    });
    window.addEventListener('blur', () => {
      duelKeys.clear();
      pointerState.fireMouse = false;
      fireButtonHeld = false;
      pointerState.moveTouchId = null;
      pointerState.aimTouchId = null;
      pointerState.touchMoveX = 0;
      pointerState.touchMoveY = 0;
    });
  }

  function wireCombatButtons() {
    const bar = document.querySelector('.touchbar');
    let fireBtn = el('duelFire');
    if (!fireBtn && bar) {
      fireBtn = document.createElement('button');
      fireBtn.type = 'button';
      fireBtn.id = 'duelFire';
      fireBtn.className = 'secondary duel-fire-button';
      fireBtn.textContent = '✦ Tir';
      const dashNode = el('dash');
      if (dashNode && dashNode.parentElement === bar) bar.insertBefore(fireBtn, dashNode);
      else bar.appendChild(fireBtn);
      const press = evt => {
        evt?.preventDefault?.();
        fireButtonHeld = true;
        try { fireBtn.setPointerCapture?.(evt.pointerId); } catch (_) {}
      };
      const release = evt => {
        evt?.preventDefault?.();
        fireButtonHeld = false;
      };
      fireBtn.addEventListener('pointerdown', press);
      fireBtn.addEventListener('pointerup', release);
      fireBtn.addEventListener('pointercancel', release);
      fireBtn.addEventListener('pointerleave', release);
      fireBtn.addEventListener('keydown', evt => {
        if (evt.key === ' ' || evt.key === 'Enter') {
          evt.preventDefault();
          fireButtonHeld = true;
        }
      });
      fireBtn.addEventListener('keyup', evt => {
        if (evt.key === ' ' || evt.key === 'Enter') {
          evt.preventDefault();
          fireButtonHeld = false;
        }
      });
    }
    if (fireBtn) fireBtn.style.display = '';
    const dashBtn = el('dash');
    if (dashBtn) {
      if (!basePauseLabel) basePauseLabel = el('pause')?.textContent || '';
      if (!baseHintLabel) baseHintLabel = el('hint')?.textContent || '';
      dashBtn.onclick = evt => {
        evt?.preventDefault?.();
        if (combatActive) triggerLocalDodge();
        else if (typeof dodge === 'function') dodge();
      };
    }
    const pauseBtn = el('pause');
    if (pauseBtn) {
      pauseBtn.textContent = 'Ⅱ Abandon';
      pauseBtn.onclick = evt => {
        evt?.preventDefault?.();
        if (combatActive) {
          if (combatPaused) resumeCombat();
          else openCombatPauseOverlay();
        } else if (typeof togglePause === 'function') togglePause();
      };
    }
    const hint = el('hint');
    if (hint) hint.textContent = 'DUEL · Flèches ↑/↓ = avancer/reculer dans l’axe du balai, ←/→ = pivoter · ZQSD = déplacement libre · souris = viser · Tir/F · Espace/E esquive · Maj précision · Mobile : glisser + 2e doigt';
    if (bar) bar.style.display = 'flex';
  }

  // Hooks sur la boucle principale de game.js.
  if (typeof update === 'function') {
    const baseUpdate = update;
    update = function(dt) {
      if (combatActive) {
        stepDuelFrame(dt);
        return;
      }
      return baseUpdate(dt);
    };
  }

  if (typeof drawGame === 'function') {
    const baseDrawGame = drawGame;
    drawGame = function() {
      if (combatActive) {
        drawDuelArena();
        return;
      }
      return baseDrawGame();
    };
  }

  if (typeof dodge === 'function') {
    const baseDodge = dodge;
    dodge = function(...args) {
      if (combatActive) return triggerLocalDodge();
      return baseDodge(...args);
    };
  }

  if (typeof togglePause === 'function') {
    const baseTogglePause = togglePause;
    togglePause = function(...args) {
      if (combatActive) {
        if (combatPaused) resumeCombat();
        else openCombatPauseOverlay();
        return;
      }
      return baseTogglePause(...args);
    };
  }

  function installMenuButton() {
    if (getGameState() !== 'league-menu' || document.querySelector('#overlay .training-mode')) return;
    if (el('nightDuelEntry')) return;
    const lab = el('labMenu');
    const grid = lab?.closest('.menu-grid');
    if (!grid) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'nightDuelEntry';
    button.className = 'secondary menu-card-button';
    button.innerHTML =
      '<span class="menu-card-icon">☾</span><span>Duel de la Nuit noire<small>1v1 en direct · duel sans monstre</small></span>';
    button.onclick = () => openHub();
    grid.insertBefore(button, grid.firstChild);
  }

  if (window.Journey?.menu) {
    const baseJourneyMenu = window.Journey.menu;
    window.Journey.menu = function(...args) {
      const result = baseJourneyMenu.apply(this, args);
      installMenuButton();
      return result;
    };
  }

  window.addEventListener('minuit:account-connected', async () => {
    startInviteWatcher();
    if (!screenOpen && !pendingInviteId && !duel) return;
    screenOpen = true;
    await refreshProfile();
    if (pendingInviteId) {
      await joinInvitation(pendingInviteId);
      return;
    }
    if (duel?.id) {
      resyncDuelConnection();
      return;
    }
    renderScreen();
  });

  // Retour d'onglet / reprise de réseau : les timers et le WebSocket ont pu être
  // gelés. On resynchronise l'état du duel et on redemande un snapshot à l'hôte.
  window.addEventListener('focus', () => resyncDuelConnection());
  window.addEventListener('online', () => resyncDuelConnection());
  window.addEventListener('pageshow', () => resyncDuelConnection());
  document.addEventListener?.('visibilitychange', () => {
    if (!document.hidden) resyncDuelConnection();
  });

  window.addEventListener('minuit:account-disconnected', () => {
    stopInviteWatcher();
    profile = null;
    if (screenOpen || combatActive) {
      teardownDuelRuntime();
      duel = null;
      screenOpen = true;
      renderScreen();
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    .overlay:has(.night-duel-screen){justify-content:flex-start}
    .night-duel-screen{width:min(860px,100%);min-width:0;margin:0 auto;display:flex;flex-direction:column;gap:12px;text-align:left;color:#efe5f7}
    .duel-header{text-align:center}
    .duel-header h2{margin:4px 0 6px;font-size:clamp(22px,3.6vw,34px);color:#f7e9ff}
    .duel-header p{margin:0 auto;max-width:660px;font-size:11px;line-height:1.55;color:#c3b2d4}
    .duel-map-note{display:block;margin:7px auto 0;max-width:660px;font-size:10px;line-height:1.5;color:#cbbad9}
    .duel-map-note b{color:#ffd596}
    .duel-invite-banner{padding:10px 12px;border:1px dashed #d8b574aa;border-radius:10px;background:#2e233cdd;text-align:center}
    .duel-invite-banner span{display:block;font-size:9px;letter-spacing:1.1px;color:#ffd28e}
    .duel-invite-banner b{display:block;margin:4px 0;font:700 13px ui-monospace,monospace;color:#fff2d6;overflow-wrap:anywhere}
    .duel-invite-banner small{font-size:10px;color:#cbbad9}
    .duel-auth-mount{display:flex;justify-content:center;width:100%}
    .duel-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;width:100%}
    .duel-stat-box{padding:10px;border:1px solid #78608b66;border-radius:10px;background:#1c152acc;text-align:center}
    .duel-stat-box small{display:block;font-size:8px;letter-spacing:.9px;color:#b8a5ca}
    .duel-stat-box b{display:block;margin-top:4px;font-size:16px;color:#ffd596;overflow-wrap:anywhere}
    .duel-hub-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}
    .duel-card{padding:13px;border:1px solid #78608b66;border-radius:11px;background:#1a1327d8;display:flex;flex-direction:column;gap:9px}
    .duel-card h3{margin:0;font-size:11px;letter-spacing:.9px;color:#e8c99b}
    .duel-field-label{font-size:10px;color:#cbbad9}
    .duel-card input{width:100%;min-width:0;padding:9px 10px;border:1px solid #755e8a;border-radius:7px;background:#251c36;color:#f5ecff;font-size:11px}
    .duel-toggle-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
    .duel-toggle-row button.is-selected{border-color:#ffd08e;background:#3a2849;color:#ffe6bd;box-shadow:0 0 0 1px #ffd08e88}
    .duel-full-btn{width:100%;min-height:42px}
    .duel-copy-row{display:flex;gap:7px;align-items:stretch}
    .duel-copy-row input{flex:1}
    .duel-qr-panel{display:flex;gap:14px;align-items:center;padding:12px;border:1px solid #78608b66;border-radius:10px;background:#241b35}
    .duel-qr-frame{flex:0 0 auto;width:164px;height:164px;padding:8px;background:#fff;border-radius:10px;box-shadow:0 4px 18px #0006}
    .duel-qr-frame svg{display:block;width:100%;height:100%}
    .duel-qr-side{display:flex;flex-direction:column;gap:7px;min-width:0}
    .duel-qr-side b{font-size:12px;color:#ffe6bd}
    .duel-qr-side small{font-size:10px;line-height:1.55;color:#c7b6d8}
    .duel-qr-side button{align-self:flex-start}
    .duel-uuid-line{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:10px;color:#c7b6d8}
    .duel-uuid-line code{padding:4px 7px;border-radius:5px;background:#291f3b;color:#ffe0a6;overflow-wrap:anywhere}
    .duel-share-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .duel-share-link{display:flex;align-items:center;justify-content:center;min-height:40px;padding:8px 12px;border:1px solid #7b648f;border-radius:8px;background:#261d38;color:#f2e7ff;text-decoration:none;font-size:11px;text-align:center}
    .duel-inapp-hint{font-size:10px;line-height:1.5;color:#c7b6d8}
    .duel-sent-invites{display:flex;flex-direction:column;gap:6px}
    .duel-sent-empty{font-size:10px;color:#a996ba}
    .duel-sent-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #6e578155;border-radius:8px;background:#231a34}
    .duel-sent-row span{display:flex;flex-direction:column;gap:2px;min-width:0}
    .duel-sent-row b{font-size:11px;color:#f3e7ff;overflow-wrap:anywhere}
    .duel-sent-row small{font-size:9px;color:#bba8cd}
    .duel-team-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .duel-team-card-head h3{margin:0}
    .duel-team-refresh{min-height:32px;padding:5px 10px;font-size:10px}
    .duel-team-list{display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto;padding-right:2px}
    .duel-team-empty{font-size:10px;line-height:1.5;color:#a996ba}
    .duel-team-empty.is-error{color:#f5aba4}
    .duel-team-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #6e578155;border-radius:8px;background:#231a34}
    .duel-team-row.is-you{border-color:#ffd08e66;background:#2a2138}
    .duel-team-row span{display:flex;flex-direction:column;gap:2px;min-width:0}
    .duel-team-row b{font-size:11px;color:#f3e7ff;overflow-wrap:anywhere}
    .duel-team-row small{font-size:9px;color:#bba8cd}
    .duel-team-row button{flex:0 0 auto;min-height:34px;padding:6px 12px;font-size:10px}
    .duel-invite-popup{position:fixed;right:16px;bottom:16px;z-index:10000;width:min(340px,calc(100vw - 32px));display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid #d8b574aa;border-radius:12px;background:linear-gradient(150deg,#2e233c,#171226);box-shadow:0 14px 40px #000a;color:#efe5f7;text-align:left}
    .duel-invite-popup-eyebrow{font-size:9px;letter-spacing:1.1px;color:#ffd28e}
    .duel-invite-popup b{font-size:13px;line-height:1.4;color:#fff2d6;overflow-wrap:anywhere}
    .duel-invite-popup small{font-size:10px;color:#cbbad9}
    .duel-invite-popup-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px}
    .duel-invite-popup-actions button{min-height:40px}
    .duel-invite-popup-status{min-height:14px;font-size:10px;color:#f5aba4}
    .duel-halo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .duel-halo-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #6e578155;border-radius:8px;background:#231a34}
    .duel-halo-item.is-equipped{border-color:#ffd08e99}
    .duel-halo-item b{font-size:11px;color:#f3e7ff}
    .duel-halo-item small{display:block;font-size:9px;color:#bba8cd}
    .duel-halo-swatch{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:50%;vertical-align:middle}
    .duel-equipped-tag{font-size:10px;color:#a9e5c8;font-weight:700}
    .duel-versus-strip{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:10px;border:1px solid #78608b66;border-radius:10px;background:#1b1429cc}
    .duel-fighter-pill{display:flex;flex-direction:column;gap:2px;min-width:0}
    .duel-fighter-pill:last-child{text-align:right;align-items:flex-end}
    .duel-fighter-pill b{font-size:12px;color:#f7ebff;overflow-wrap:anywhere}
    .duel-fighter-pill small{font-size:9px;color:#bca9ce}
    .duel-vs-mark{font-weight:700;font-size:12px;color:#ffd08e;padding:0 6px}
    .duel-ready-badge{display:inline-block;margin-top:2px;padding:2px 7px;border-radius:999px;background:#312544;color:#cbb9dc;font-size:9px}
    .duel-ready-badge.is-ready{background:#1f4438;color:#b6f2d4}
    .duel-draft-counter{text-align:center;font-size:11px;font-weight:700;color:#ffd596}
    .duel-draft-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .duel-perk-card{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px;border:1px solid #755d8888;border-radius:9px;background:#221933;color:#efe5f7;text-align:left;cursor:pointer}
    .duel-perk-card.is-picked{border-color:#ffd08e;background:#36264b;box-shadow:0 0 0 1px #ffd08e99}
    .duel-perk-top{display:flex;align-items:center;justify-content:space-between;width:100%;font-size:9px;color:#cbb7dd}
    .duel-perk-icon{font-size:14px;color:#ffd596}
    .duel-perk-card b{font-size:11px;color:#fff0d4}
    .duel-perk-card span{font-size:10px;line-height:1.4;color:#c7b5d8}
    .duel-status{min-height:18px;font-size:11px;text-align:center;color:#a9e0c7}
    .duel-status.is-error{color:#f5aba4}
    .duel-wager-note{margin:0;text-align:center;font-size:10px;color:#c5b3d6}
    .duel-footer-actions{justify-content:center;flex-wrap:wrap}
    .duel-top-hud{position:absolute;top:8px;left:8px;right:8px;z-index:5;display:none;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px;padding:7px 10px;border:1px solid #8a6fa166;border-radius:10px;background:rgba(16,11,28,0.86);backdrop-filter:blur(4px);color:#f4ebff;pointer-events:none}
    .heading.game-status .duel-top-hud{position:static;inset:auto;width:100%;margin:0}
    body.night-duel-combat .heading.game-status{display:block;width:var(--field-width,400px);max-width:100%;height:auto;min-height:0;margin:0 0 8px;padding:0;border:0;background:none;box-shadow:none}
    .duel-hud-side{display:flex;flex-direction:column;gap:2px;min-width:0}
    .duel-hud-opp{align-items:flex-end;text-align:right}
    .duel-hud-opp-top{display:flex;align-items:center;gap:6px}
    .duel-hud-exit{pointer-events:auto;padding:3px 7px;border:1px solid #b46b7888;border-radius:6px;background:#351c2acc;color:#ffd6dc;font-size:9px;cursor:pointer}
    .duel-hud-side small{font-size:8px;letter-spacing:.8px;color:#c3b0d7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
    .duel-hud-side b{font-size:13px;color:#ff8fa3;letter-spacing:1px}
    .duel-hud-self b{color:#9ef7e8}
    .duel-hud-side span{font-size:9px;color:#cbb9dc}
    #duelHudBoons{color:#e8c9a0;font-size:8px;letter-spacing:.3px}
    .duel-hud-center{text-align:center;padding:0 6px}
    .duel-hud-scoreline{font-size:12px;color:#efe3fc;white-space:nowrap}
    .duel-hud-scoreline strong{color:#ffd596;font-size:14px}
    .duel-hud-banner{margin-top:2px;font-size:9px;color:#d6c4e8}
    .duel-fire-button{min-width:112px;min-height:54px;font-size:16px;border-color:#d8b574aa;color:#ffe6bd;background:linear-gradient(145deg,#3a2849,#251c36)}
    .duel-fire-ready{box-shadow:0 0 0 1px #ffd08e55}
    .duel-fire-cooldown{opacity:.72}
    body.night-duel-combat .hud,
    body.night-duel-combat .bossbar,
    body.night-duel-combat .game-details{display:none!important}
    body.night-duel-combat .touchbar[data-touch-layout="left"]{justify-content:flex-end}
    body.night-duel-combat .touchbar[data-touch-layout="right"]{justify-content:flex-start}
    @media(max-width:720px){
      .duel-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .duel-hub-columns,.duel-draft-grid,.duel-halo-grid,.duel-share-buttons{grid-template-columns:1fr}
      .duel-copy-row{flex-direction:column}
      .duel-qr-panel{flex-direction:column;text-align:center}
      .duel-qr-frame{width:188px;height:188px}
      .duel-qr-side{align-items:center}
      .duel-qr-side button{align-self:center}
      .duel-invite-popup{left:16px;right:16px;width:auto}
      .duel-top-hud{top:4px;left:4px;right:4px;padding:5px 7px;gap:4px}
      .duel-hud-scoreline{font-size:10px}
      .duel-hud-side b{font-size:11px}
    }
  `;
  document.head?.appendChild(style);

  wireCombatInputs();
  installMenuButton();

  // Si une session est déjà reprise au chargement (pas d'événement account-connected),
  // démarre quand même l'observateur d'invitations pour afficher le popup côté invité.
  if (window.MinuitCloud?.connected) startInviteWatcher();

  pendingInviteId = readInitialInvite();
  if (pendingInviteId) {
    setTimeout(() => {
      openHub({ inviteId: pendingInviteId });
    }, 0);
  }

  window.NightDuel = {
    open: openHub,
    leave: leaveToHome,
    triggerDodge: triggerLocalDodge,
    get isOpen() {
      return screenOpen;
    },
    get isCombatActive() {
      return combatActive;
    },
    get snapshot() {
      return renderSnap;
    },
    get currentDuel() {
      return duel;
    },
    refreshInvitations: refreshIncomingInvitations,
    sendInvitation: sendDuelInvite,
    respondToInvitation: respondToIncomingInvite,
    refreshTeamPlayers,
    challengeTeamMember,
    get pendingInvitations() {
      return incomingInvites.slice();
    },
    get activeInvitation() {
      return activeInvitePopup;
    },
    get teamPlayers() {
      return teamPlayers.slice();
    }
  };
})();
