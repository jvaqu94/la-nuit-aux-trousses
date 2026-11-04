'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const Core = require('../duel-core.js');
const QRHarness = require('./qr-harness.cjs');

const ROOT = path.resolve(__dirname, '..');

function encodeWsTextFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function createWsReader(onMessage, onClose) {
  let buffer = Buffer.alloc(0);
  return chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const first = buffer[0];
      const second = buffer[1];
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let offset = 2;
      let len = second & 0x7f;
      if (len === 126) {
        if (buffer.length < 4) return;
        len = buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buffer.length < 10) return;
        len = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      const maskBytes = masked ? 4 : 0;
      if (buffer.length < offset + maskBytes + len) return;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null;
      const data = Buffer.from(buffer.subarray(offset + maskBytes, offset + maskBytes + len));
      buffer = buffer.subarray(offset + maskBytes + len);
      if (masked && mask) {
        for (let i = 0; i < data.length; i += 1) data[i] ^= mask[i & 3];
      }
      if (opcode === 0x8) {
        onClose();
        return;
      }
      if (opcode === 0x1) {
        onMessage(data.toString('utf8'));
      }
    }
  };
}

function startMockSupabaseServer() {
  const users = new Map([
    ['token-u1', { id: '00000000-0000-4000-8000-00000000c001', name: 'Séléné' }],
    ['token-u2', { id: '00000000-0000-4000-8000-00000000c002', name: 'Nyx' }]
  ]);
  const profiles = new Map();
  const duels = new Map();
  const invitations = new Map();
  const team = {
    id: 'team-nocturnes',
    name: 'Les Nocturnes',
    members: new Set(['00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000c002'])
  };
  const completedHistory = [];
  const topicSockets = new Map();
  const wireLog = [];

  const ensureProfile = userId => {
    if (!profiles.has(userId)) {
      const user = [...users.values()].find(u => u.id === userId);
      profiles.set(userId, {
        id: userId,
        name: user ? user.name : 'Sorcière',
        rating: 1000,
        shards: 20,
        wins: 0,
        losses: 0,
        unlocked: ['halo-violet'],
        equipped: 'halo-violet'
      });
    }
    return profiles.get(userId);
  };

  const duelStatusJson = d => ({
    duel: { ...d },
    players: [
      { ...ensureProfile(d.creatorId) },
      d.opponentId ? { ...ensureProfile(d.opponentId) } : null
    ]
  });

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => {
      body += c;
    });
    req.on('end', () => {
      const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const user = users.get(auth);
      const reply = (code, data) => {
        res.writeHead(code, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*'
        });
        res.end(JSON.stringify(data));
      };
      if (req.method === 'OPTIONS') return reply(200, {});
      if (!user) return reply(401, { message: 'Connexion requise' });

      const payload = body ? JSON.parse(body) : {};
      const fn = req.url.split('/rest/v1/rpc/')[1];
      try {
        if (fn === 'minuit_duel_profile') {
          return reply(200, { ...ensureProfile(user.id) });
        }
        if (fn === 'minuit_duel_create') {
          ensureProfile(user.id);
          const id = crypto.randomUUID();
          const d = {
            id,
            creatorId: user.id,
            opponentId: null,
            mode: payload.p_mode === 'ranked' ? 'ranked' : 'friendly',
            wager: payload.p_wager === 10 ? 10 : 0,
            status: 'waiting',
            creatorPerks: [],
            opponentPerks: [],
            creatorReady: false,
            opponentReady: false,
            creatorReport: null,
            opponentReport: null,
            winnerId: null,
            ratingDelta: null
          };
          duels.set(id, d);
          return reply(200, duelStatusJson(d));
        }
        if (fn === 'minuit_duel_join') {
          const d = duels.get(payload.p_duel);
          if (!d) throw new Error('Duel introuvable');
          if (d.opponentId === user.id) return reply(200, duelStatusJson(d));
          if (d.creatorId === user.id) throw new Error('Tu ne peux pas rejoindre ton propre duel');
          const pCreator = ensureProfile(d.creatorId);
          const pOpp = ensureProfile(user.id);
          if (d.mode === 'ranked') {
            const gate = Core.canPlayRankedToday(completedHistory);
            if (!gate.allowed) throw new Error('Deux duels classés déjà joués contre cette sorcière aujourd’hui. Choisis un amical.');
          }
          if (d.wager > 0) {
            pCreator.shards -= d.wager;
            pOpp.shards -= d.wager;
          }
          d.opponentId = user.id;
          d.status = 'draft';
          return reply(200, duelStatusJson(d));
        }
        if (fn === 'minuit_duel_status') {
          const d = duels.get(payload.p_duel);
          if (!d) throw new Error('Duel introuvable');
          return reply(200, duelStatusJson(d));
        }
        if (fn === 'minuit_duel_ready') {
          const d = duels.get(payload.p_duel);
          const check = Core.validatePerks(payload.p_perks);
          if (!check.valid) throw new Error(check.error);
          if (user.id === d.creatorId) {
            d.creatorPerks = check.perks;
            d.creatorReady = true;
          } else if (user.id === d.opponentId) {
            d.opponentPerks = check.perks;
            d.opponentReady = true;
          }
          if (d.creatorReady && d.opponentReady) d.status = 'active';
          return reply(200, duelStatusJson(d));
        }
        if (fn === 'minuit_duel_finish') {
          const d = duels.get(payload.p_duel);
          if (d.status === 'completed') return reply(200, duelStatusJson(d));
          if (user.id === d.creatorId) d.creatorReport = payload.p_winner;
          else if (user.id === d.opponentId) d.opponentReport = payload.p_winner;
          if (d.creatorReport && d.creatorReport === d.opponentReport) {
            const winner = ensureProfile(d.creatorReport);
            const loser = ensureProfile(d.creatorReport === d.creatorId ? d.opponentId : d.creatorId);
            const delta = Core.computeRatingDelta(winner.rating, loser.rating, d.mode);
            if (d.mode === 'ranked') {
              winner.rating += delta;
              loser.rating -= delta;
              winner.wins += 1;
              loser.losses += 1;
              winner.shards += 2;
            }
            if (d.wager > 0) winner.shards += d.wager * 2;
            d.winnerId = d.creatorReport;
            d.ratingDelta = delta;
            d.status = 'completed';
            d.completedAt = new Date().toISOString();
            completedHistory.push({ ...d });
          }
          return reply(200, duelStatusJson(d));
        }
        if (fn === 'minuit_duel_cancel') {
          const d = duels.get(payload.p_duel);
          if (payload.p_forfeit && d.status === 'active') {
            const winnerId = user.id === d.creatorId ? d.opponentId : d.creatorId;
            d.creatorReport = winnerId;
            d.opponentReport = winnerId;
            const winner = ensureProfile(winnerId);
            const loser = ensureProfile(user.id);
            const delta = Core.computeRatingDelta(winner.rating, loser.rating, d.mode);
            if (d.mode === 'ranked') {
              winner.rating += delta;
              loser.rating -= delta;
              winner.wins += 1;
              loser.losses += 1;
              winner.shards += 2;
            }
            if (d.wager > 0) winner.shards += d.wager * 2;
            d.winnerId = winnerId;
            d.ratingDelta = delta;
            d.status = 'completed';
            return reply(200, duelStatusJson(d));
          }
          d.status = 'cancelled';
          return reply(200, duelStatusJson(d));
        }
        if (fn === 'minuit_duel_invite') {
          const d = duels.get(payload.p_duel);
          if (!d) throw new Error('Duel introuvable');
          if (d.creatorId !== user.id) throw new Error('Seule la créatrice du duel peut inviter');
          if (d.status !== 'waiting' || d.opponentId) throw new Error('Ce duel a déjà une adversaire');
          const pseudo = String(payload.p_pseudo || '').trim().toLowerCase();
          const target = [...users.values()].find(u => u.name.toLowerCase() === pseudo);
          if (!target) throw new Error('Joueur introuvable. Vérifie le pseudo exact.');
          if (target.id === user.id) throw new Error('Tu ne peux pas t’inviter toi-même');
          const existing = [...invitations.values()].find(i => i.duelId === d.id && i.toUser === target.id && i.status === 'pending');
          const inv = existing || {
            id: crypto.randomUUID(),
            duelId: d.id,
            fromUser: user.id,
            toUser: target.id,
            fromName: user.name,
            toName: target.name,
            mode: d.mode,
            wager: d.wager,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600000).toISOString()
          };
          invitations.set(inv.id, inv);
          return reply(200, { invitation: { ...inv }, duel: duelStatusJson(d) });
        }
        if (fn === 'minuit_duel_invitations') {
          const list = [...invitations.values()].filter(i => {
            const d = duels.get(i.duelId);
            return i.toUser === user.id && i.status === 'pending' && d && d.status === 'waiting' && !d.opponentId && d.creatorId !== user.id;
          });
          return reply(200, list.map(i => ({ ...i })));
        }
        if (fn === 'minuit_duel_sent_invitations') {
          const d = duels.get(payload.p_duel);
          const list = [...invitations.values()].filter(i => i.duelId === payload.p_duel && i.fromUser === user.id && i.status === 'pending' && d && d.status === 'waiting' && !d.opponentId);
          return reply(200, list.map(i => ({ ...i })));
        }
        if (fn === 'minuit_duel_invite_respond') {
          const inv = invitations.get(payload.p_invitation);
          if (!inv) throw new Error('Invitation introuvable');
          if (inv.toUser !== user.id) throw new Error('Cette invitation ne t’est pas adressée');
          if (inv.status !== 'pending') throw new Error('Invitation déjà traitée');
          const d = duels.get(inv.duelId);
          if (payload.p_accept) {
            if (!d || d.status !== 'waiting' || d.opponentId || d.creatorId === user.id) {
              inv.status = 'cancelled';
              throw new Error('Ce duel n’est plus disponible');
            }
            const pCreator = ensureProfile(d.creatorId);
            const pOpp = ensureProfile(user.id);
            if (d.wager > 0) {
              pCreator.shards -= d.wager;
              pOpp.shards -= d.wager;
            }
            d.opponentId = user.id;
            d.status = 'draft';
            inv.status = 'accepted';
            return reply(200, { invitation: { ...inv }, duel: duelStatusJson(d) });
          }
          inv.status = 'declined';
          return reply(200, { invitation: { ...inv } });
        }
        if (fn === 'minuit_duel_invite_cancel') {
          const inv = invitations.get(payload.p_invitation);
          if (!inv) throw new Error('Invitation introuvable');
          if (inv.fromUser !== user.id) throw new Error('Seule l’expéditrice peut annuler cette invitation');
          if (inv.status === 'pending') inv.status = 'cancelled';
          return reply(200, { invitation: { ...inv } });
        }
        if (fn === 'minuit_duel_team_players') {
          if (!team.members.has(user.id)) return reply(200, { team: null, players: [] });
          let waiting = null;
          if (payload.p_duel) {
            const d = duels.get(payload.p_duel);
            if (d && d.creatorId !== user.id) throw new Error('Seule la créatrice du duel peut inviter');
            if (d && d.status === 'waiting' && !d.opponentId) waiting = d;
          }
          const players = [...team.members].map(id => {
            const u = [...users.values()].find(x => x.id === id);
            const pending = Boolean(waiting) && [...invitations.values()].some(i => i.duelId === waiting.id && i.toUser === id && i.status === 'pending');
            const busy = [...duels.values()].some(b => ['draft', 'active'].includes(b.status) && (b.creatorId === id || b.opponentId === id));
            const canInvite = id !== user.id && !busy && (!waiting || (!pending && id !== waiting.opponentId));
            const availability = id === user.id ? 'Toi' : busy ? 'En duel' : pending ? 'Invitation envoyée' : canInvite ? 'Disponible' : 'Indisponible';
            return {
              id,
              displayName: u ? u.name : 'Sorcière',
              duelName: u ? u.name : 'Sorcière',
              isYou: id === user.id,
              invitationStatus: pending ? 'pending' : null,
              availability,
              canInvite
            };
          }).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));
          return reply(200, { team: { id: team.id, name: team.name, memberCount: team.members.size }, players });
        }
        if (fn === 'minuit_duel_invite_member') {
          if (!team.members.has(user.id)) throw new Error('Tu n’es pas encore dans une team');
          if (!team.members.has(payload.p_member)) throw new Error('Cette joueuse ne fait pas partie de ta team');
          const d = duels.get(payload.p_duel);
          if (!d) throw new Error('Duel introuvable');
          if (d.creatorId !== user.id) throw new Error('Seule la créatrice du duel peut inviter');
          if (d.status !== 'waiting' || d.opponentId) throw new Error('Ce duel a déjà une adversaire');
          if (payload.p_member === user.id) throw new Error('Tu ne peux pas t’inviter toi-même');
          const target = [...users.values()].find(u => u.id === payload.p_member);
          const existing = [...invitations.values()].find(i => i.duelId === d.id && i.toUser === payload.p_member && i.status === 'pending');
          const inv = existing || {
            id: crypto.randomUUID(),
            duelId: d.id,
            fromUser: user.id,
            toUser: payload.p_member,
            fromName: user.name,
            toName: target ? target.name : 'Sorcière',
            mode: d.mode,
            wager: d.wager,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600000).toISOString()
          };
          invitations.set(inv.id, inv);
          return reply(200, { invitation: { ...inv }, duel: duelStatusJson(d) });
        }
        return reply(200, { team: null, scores: [] });
      } catch (err) {
        return reply(400, { message: err.message });
      }
    });
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const joinedTopics = new Set();
    const cleanup = () => {
      for (const t of joinedTopics) {
        topicSockets.get(t)?.delete(socket);
      }
      joinedTopics.clear();
    };
    const reader = createWsReader(raw => {
      const msg = JSON.parse(raw);
      if (msg.event === 'phx_join') {
        joinedTopics.add(msg.topic);
        if (!topicSockets.has(msg.topic)) topicSockets.set(msg.topic, new Set());
        topicSockets.get(msg.topic).add(socket);
        socket.write(
          encodeWsTextFrame(
            JSON.stringify({
              topic: msg.topic,
              event: 'phx_reply',
              ref: msg.ref,
              join_ref: msg.join_ref,
              payload: { status: 'ok', response: {} }
            })
          )
        );
      } else if (msg.event === 'heartbeat') {
        socket.write(
          encodeWsTextFrame(
            JSON.stringify({
              topic: 'phoenix',
              event: 'phx_reply',
              ref: msg.ref,
              payload: { status: 'ok', response: {} }
            })
          )
        );
      } else if (msg.event === 'broadcast') {
        wireLog.push(msg);
        const peers = topicSockets.get(msg.topic) || new Set();
        const frame = encodeWsTextFrame(JSON.stringify(msg));
        for (const peer of peers) {
          if (peer !== socket && !peer.destroyed) peer.write(frame);
        }
      }
    }, () => socket.end());

    socket.on('data', reader);
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        wireLog,
        close: () =>
          new Promise(done => {
            for (const set of topicSockets.values()) {
              for (const s of set) s.destroy();
            }
            server.close(() => done());
          })
      });
    });
  });
}

function createFakeDom(initialUrl, sessionObj) {
  const storage = new Map();
  const sessionStore = new Map();
  if (sessionObj) {
    storage.set('minuit-supabase-session-v1', JSON.stringify(sessionObj));
  }
  const elementsById = new Map();
  const allElements = [];
  const winListeners = new Map();

  const makeClassList = el => {
    const classes = new Set();
    return {
      add: (...names) => names.forEach(n => n && classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (n, force) => {
        const shouldAdd = force === undefined ? !classes.has(n) : Boolean(force);
        if (shouldAdd) classes.add(n);
        else classes.delete(n);
        return shouldAdd;
      },
      contains: n => classes.has(n),
      _syncFromString(str) {
        classes.clear();
        String(str || '')
          .split(/\s+/)
          .filter(Boolean)
          .forEach(c => classes.add(c));
      }
    };
  };

  function makeElement(tag = 'div', id = '') {
    const listeners = new Map();
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      type: '',
      value: '',
      href: '',
      disabled: false,
      textContent: '',
      dataset: {},
      style: {},
      children: [],
      parentElement: null,
      isConnected: true,
      onclick: null,
      classList: null,
      setAttribute(k, v) {
        if (k === 'id') this.id = String(v);
        else if (k === 'class') this.className = String(v);
        else if (k.startsWith('data-')) {
          const camel = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          this.dataset[camel] = String(v);
        } else this[k] = String(v);
      },
      getAttribute(k) {
        return this[k] ?? null;
      },
      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        if (child.id) elementsById.set(child.id, child);
        return child;
      },
      insertBefore(child, ref) {
        child.parentElement = this;
        const idx = this.children.indexOf(ref);
        if (idx >= 0) this.children.splice(idx, 0, child);
        else this.children.push(child);
        if (child.id) elementsById.set(child.id, child);
        return child;
      },
      remove() {
        const drop = node => {
          if (node.id) elementsById.delete(node.id);
          (node.children || []).forEach(drop);
        };
        drop(el);
        if (el.parentElement) {
          const idx = el.parentElement.children.indexOf(el);
          if (idx >= 0) el.parentElement.children.splice(idx, 1);
          el.parentElement = null;
        }
      },
      closest(sel) {
        if (sel === '.menu-grid') return menuGrid;
        return null;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 900 }),
      getContext: () =>
        new Proxy(
          {
            createLinearGradient: () => ({ addColorStop() {} }),
            createRadialGradient: () => ({ addColorStop() {} }),
            measureText: s => ({ width: String(s).length * 6 })
          },
          { get: (o, k) => o[k] || (() => {}) }
        ),
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      dispatchEvent(evt) {
        (listeners.get(evt.type) || []).forEach(fn => fn(evt));
      },
      click() {
        if (this.disabled) return;
        if (typeof this.onclick === 'function') this.onclick({ preventDefault() {}, stopPropagation() {} });
        this.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
      },
      focus() {},
      select() {},
      scrollIntoView() {}
    };
    el.classList = makeClassList(el);
    let currentClass = '';
    Object.defineProperty(el, 'className', {
      get: () => currentClass,
      set: v => {
        currentClass = String(v || '');
        el.classList._syncFromString(currentClass);
      }
    });
    let rawHtml = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => rawHtml,
      set: html => {
        rawHtml = String(html || '');
        el.children = [];
        parseOverlayHtml(rawHtml, el);
      }
    });
    if (id) {
      el.id = id;
      elementsById.set(id, el);
    }
    allElements.push(el);
    return el;
  }

  function parseOverlayHtml(html, parent) {
    const tagRe = /<(button|input|a|div|span|b|small|code|section)\b([^>]*)>/gi;
    let match;
    while ((match = tagRe.exec(html)) !== null) {
      const node = makeElement(match[1]);
      const attrs = match[2] || '';
      const attrRe = /([a-zA-Z0-9_-]+)(?:="([^"]*)")?/g;
      let am;
      while ((am = attrRe.exec(attrs)) !== null) {
        const key = am[1];
        const val = am[2] ?? '';
        if (key === 'disabled') node.disabled = true;
        else node.setAttribute(key, val);
      }
      parent.appendChild(node);
    }
  }

  const head = makeElement('head');
  const body = makeElement('body');
  const canvasHolder = makeElement('div', 'canvasHolder');
  const canvas = makeElement('canvas', 'canvas');
  canvasHolder.appendChild(canvas);
  const touchStick = makeElement('div', 'touchStick');
  const touchbar = makeElement('div', 'touchbar');
  touchbar.className = 'touchbar';
  const overlayEl = makeElement('div', 'overlay');
  const menuGrid = makeElement('div', 'menuGrid');
  menuGrid.className = 'menu-grid';
  const labMenu = makeElement('button', 'labMenu');
  menuGrid.appendChild(labMenu);
  makeElement('div', 'gameStatus');
  makeElement('button', 'specialCast');

  const parsedUrl = new URL(initialUrl);
  const locationObj = {
    href: parsedUrl.href,
    origin: parsedUrl.origin,
    pathname: parsedUrl.pathname,
    search: parsedUrl.search,
    hash: parsedUrl.hash
  };

  const document = {
    head,
    body,
    createElement: tag => makeElement(tag),
    getElementById: id => elementsById.get(id) || null,
    querySelector: sel => {
      if (sel === '.touchbar') return touchbar;
      if (sel === '#overlay .duel-draft-grid') {
        return allElements.find(e => e.classList.contains('duel-draft-grid')) || null;
      }
      return null;
    },
    querySelectorAll: sel => {
      if (sel === '.duel-perk-card') return allElements.filter(e => e.classList.contains('duel-perk-card'));
      if (sel === '[data-unlock-halo]') return allElements.filter(e => e.dataset.unlockHalo);
      if (sel === '[data-equip-halo]') return allElements.filter(e => e.dataset.equipHalo);
      return [];
    },
    addEventListener() {}
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: fn => setTimeout(fn, 16),
    URL,
    URLSearchParams,
    AbortController,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    fetch: globalThis.fetch,
    WebSocket: globalThis.WebSocket,
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k)
    },
    sessionStorage: {
      getItem: k => (sessionStore.has(k) ? sessionStore.get(k) : null),
      setItem: (k, v) => sessionStore.set(k, String(v)),
      removeItem: k => sessionStore.delete(k)
    },
    location: locationObj,
    history: {
      replaceState(_, __, nextUrl) {
        const next = new URL(nextUrl, locationObj.origin);
        locationObj.href = next.href;
        locationObj.pathname = next.pathname;
        locationObj.search = next.search;
        locationObj.hash = next.hash;
      }
    },
    document,
    state: 'league-menu',
    prefs: { touchLayout: 'left', sound: true },
    keys: {},
    ctx: canvas.getContext('2d'),
    overlay(html) {
      overlayEl.innerHTML = html;
      overlayEl.style.display = 'flex';
    },
    hideOverlay() {
      overlayEl.style.display = 'none';
    },
    update() {},
    drawGame() {},
    dodge() {},
    togglePause() {},
    syncPauseIcon() {},
    // Reproduit la sémantique réelle de journey.js : `run` est un accesseur
    // (getter + setter) adossé à une variable interne, pas une simple propriété.
    // Un stub « propriété inscriptible » masquerait le bug TypeError du duel.
    Journey: (() => {
      let run = { combat: true };
      return {
        get run() { return run; },
        set run(value) { run = value; },
        menu() {},
        grantDailyReward: () => ({ granted: true })
      };
    })(),
    LocalLeague: { menu() {} }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = (type, fn) => {
    if (!winListeners.has(type)) winListeners.set(type, []);
    winListeners.get(type).push(fn);
  };
  sandbox.dispatchEvent = evt => {
    (winListeners.get(evt.type) || []).forEach(fn => fn(evt));
  };

  return { sandbox, document, elementsById, canvas };
}

function bootClientVm(supabaseUrl, pageUrl, token, userId, displayName) {
  const session = {
    access_token: token,
    refresh_token: 'refresh-' + token,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, displayName, user_metadata: { display_name: displayName } }
  };
  const env = createFakeDom(pageUrl, session);
  const ctx = vm.createContext(env.sandbox);
  vm.runInContext(
    `window.MINUIT_SUPABASE_CONFIG = { url: ${JSON.stringify(supabaseUrl)}, publishableKey: 'sb_publishable_test_key' };`,
    ctx
  );
  for (const scriptName of ['supabase.js', 'duel-core.js', 'qrcode.js', 'duel-qr.js', 'night-duel.js']) {
    const code = fs.readFileSync(path.join(ROOT, scriptName), 'utf8');
    vm.runInContext(code, ctx, { filename: scriptName });
  }
  return { ctx, ...env };
}

const waitUntil = async (predicate, timeoutMs = 4000, stepMs = 25) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const val = await predicate();
    if (val) return val;
    await new Promise(r => setTimeout(r, stepMs));
  }
  throw new Error('Délai dépassé en attente d’une condition asynchrone.');
};

async function verifyPythonStaticServer() {
  const port = 34000 + Math.floor(Math.random() * 4000);
  const proc = spawn('python3', ['server.py'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), MINUIT_DB: path.join('/tmp', `minuit-duel-${port}.sqlite3`) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await waitUntil(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/duel-core.js`);
        return res.status === 200;
      } catch (_) {
        return false;
      }
    }, 5000, 60);

    for (const route of ['/index.html', '/duel-core.js', '/night-duel.js', '/supabase.js']) {
      const res = await fetch(`http://127.0.0.1:${port}${route}`);
      assert.equal(res.status, 200, `server.py doit servir ${route} en 200`);
      const text = await res.text();
      assert.equal(/sb_secret_|service_role/i.test(text), false, `Aucune clé secrète dans ${route}`);
    }
    return `http://127.0.0.1:${port}`;
  } finally {
    proc.kill('SIGTERM');
    try {
      fs.unlinkSync(path.join('/tmp', `minuit-duel-${port}.sqlite3`));
    } catch (_) {}
  }
}

async function runTwoClientIntegration(mockSupabase) {
  // 1. Créatrice ouvre l'accueil, clique sur « Duel de la Nuit noire », active la mise de 10 éclats et crée l'invitation.
  const host = bootClientVm(
    mockSupabase.url,
    'http://127.0.0.1:3000/',
    'token-u1',
    '00000000-0000-4000-8000-00000000c001',
    'Séléné'
  );
  const entryBtn = host.document.getElementById('nightDuelEntry');
  assert.ok(entryBtn, 'Le bouton d’accueil « Duel de la Nuit noire » doit être injecté');
  entryBtn.click();

  await waitUntil(() => host.document.getElementById('duelCreateBtn'));
  assert.equal(host.ctx.Journey.grantDailyReward(), null, 'Les récompenses quotidiennes sont bloquées pendant le duel');

  host.document.getElementById('duelWagerTen').click();
  host.document.getElementById('duelCreateBtn').click();

  await waitUntil(() => host.document.getElementById('duelInviteLink'));
  const inviteUrl = host.document.getElementById('duelInviteLink').value;
  const whatsappHref = host.document.getElementById('duelShareWhatsapp').href;
  const messengerHref = host.document.getElementById('duelShareMessenger').href;
  assert.ok(Core.extractDuelId(inviteUrl), 'Lien d’invitation contenant un UUID valide');
  assert.ok(whatsappHref.startsWith('https://wa.me/?text='), 'Partage WhatsApp conservé');
  assert.ok(messengerHref.startsWith('https://www.facebook.com/sharer/sharer.php?u='), 'Partage Messenger conservé');

  // QR code d’invitation : présent dans l’écran d’attente et scannable vers le lien exact.
  assert.ok(host.ctx.NightDuelQR && host.ctx.NightDuelQR.available(), 'Le module QR doit être chargé dans le client');
  const waitingHtml = host.document.getElementById('overlay').innerHTML;
  assert.ok(host.document.getElementById('duelInviteQr'), 'Le cadre du QR d’invitation doit être affiché');
  assert.ok(host.document.getElementById('duelQrDownload'), 'Le bouton de téléchargement du QR doit être présent');
  const renderedSvg = (waitingHtml.match(/<svg[\s\S]*?<\/svg>/) || [])[0];
  assert.ok(renderedSvg, 'Un QR SVG doit être rendu dans l’écran d’attente');
  const renderedMat = QRHarness.matrixFromSvg(renderedSvg);
  assert.ok(renderedMat, 'Le QR rendu doit être reconstructible');
  assert.ok(QRHarness.hasFinderPatterns(renderedMat), 'Le QR rendu doit avoir ses motifs de recherche');
  if (QRHarness.hasJsQR) {
    assert.equal(QRHarness.decodeMatrix(renderedMat), inviteUrl, 'Le QR affiché doit scanner vers le lien d’invitation exact');
  }

  // 2. Invitée ouvre directement le lien privé ?duel=<uuid> et rejoint automatiquement le draft.
  const guest = bootClientVm(
    mockSupabase.url,
    inviteUrl,
    'token-u2',
    '00000000-0000-4000-8000-00000000c002',
    'Nyx'
  );

  await waitUntil(() => guest.document.querySelector('#overlay .duel-draft-grid'));
  await waitUntil(() => host.document.querySelector('#overlay .duel-draft-grid'));

  // 3. Deux drafts indépendants de 3 atouts chacun.
  // Host garde ['comet-boots', 'dawn-halo', 'fleeting-dash'] et valide ; Guest choisit ['twin-burst', 'wide-wave', 'ember-heart'].
  const guestCards = guest.document.querySelectorAll('.duel-perk-card');
  // Désélectionne les 3 par défaut puis choisit 3 nouveaux atouts distincts.
  for (const id of ['comet-boots', 'dawn-halo', 'fleeting-dash']) {
    guestCards.find(c => c.dataset.perkId === id).click();
  }
  for (const id of ['twin-burst', 'wide-wave', 'ember-heart']) {
    guest.document.querySelectorAll('.duel-perk-card').find(c => c.dataset.perkId === id).click();
  }
  guest.document.getElementById('duelReadyBtn').click();
  host.document.getElementById('duelReadyBtn').click();

  await waitUntil(() => host.ctx.NightDuel.isCombatActive && guest.ctx.NightDuel.isCombatActive);
  assert.equal(host.ctx.Journey.run, null, 'Journey.run est désactivé pendant le combat de duel');

  // Respect de prefs.touchLayout sur les deux clients.
  guest.ctx.prefs.touchLayout = 'right';
  guest.ctx.update(1 / 60);
  assert.equal(guest.document.body.dataset.touchLayout, 'right');

  // 4. Simulation temps réel : vérification sur le fil WebSocket que les coordonnées cachées ne fuitent jamais,
  //    que les projectiles dangereux sont visibles et que les commandes de l'invitée déplacent sa sorcière côté hôte.
  mockSupabase.wireLog.length = 0;
  for (let i = 0; i < 6; i += 1) {
    host.ctx.update(1 / 60);
  }
  await waitUntil(() =>
    mockSupabase.wireLog.some(m => m.payload?.event === 'snapshot')
  );
  const firstWireSnap = mockSupabase.wireLog.find(m => m.payload?.event === 'snapshot').payload.payload;
  assert.equal(firstWireSnap.opponent.visible, false, 'Au départ hors halo, la créatrice est invisible pour l’invitée');
  assert.equal(firstWireSnap.opponent.x, null, 'Aucune coordonnée X cachée envoyée à l’invitée');
  assert.equal(firstWireSnap.opponent.y, null, 'Aucune coordonnée Y cachée envoyée à l’invitée');

  // L'invitée envoie une commande de déplacement vers la droite (sans jamais envoyer de position d'autorité).
  guest.ctx.keys.ArrowRight = true;
  guest.ctx.update(0.05);
  await waitUntil(() => mockSupabase.wireLog.some(m => m.payload?.event === 'cmd'));
  const wireCmd = mockSupabase.wireLog.find(m => m.payload?.event === 'cmd').payload.payload;
  assert.equal(wireCmd.moveX, 1);
  assert.equal('hearts' in wireCmd, false, 'Le paquet de commande invité ne transporte aucun état d’autorité');

  // Avance l'hôte d'1,2 s : les rafales automatiques tirent et les projectiles deviennent visibles chez l'invitée.
  for (let i = 0; i < 72; i += 1) {
    host.ctx.update(1 / 60);
    host.ctx.drawGame();
  }
  await waitUntil(() => (guest.ctx.NightDuel.snapshot?.projectiles?.length || 0) >= 3);
  assert.ok(guest.ctx.NightDuel.snapshot.self.x > 400, 'La commande de l’invitée a bien déplacé sa sorcière côté hôte');
  guest.ctx.drawGame();

  // 5. Conclusion du duel en 2 manches gagnantes + double rapport de consensus + mise à jour de la cote (1000 -> 1020 / 980).
  // Rapproche les deux sorcières au centre et laisse les salves conclure les 2 manches.
  guest.ctx.keys.ArrowRight = false;
  guest.ctx.keys.ArrowDown = true;
  host.ctx.keys.ArrowUp = true;
  let guard = 0;
  while (host.ctx.NightDuel.isCombatActive && guard < 2400) {
    guest.ctx.update(0.05);
    host.ctx.update(0.05);
    guard += 1;
    if (guard % 20 === 0) await new Promise(r => setTimeout(r, 10));
  }

  await waitUntil(() => host.ctx.NightDuel.currentDuel?.status === 'completed', 5000);
  await waitUntil(() => guest.ctx.NightDuel.currentDuel?.status === 'completed', 5000);

  const finalDuel = host.ctx.NightDuel.currentDuel;
  assert.equal(finalDuel.status, 'completed');
  assert.equal(finalDuel.ratingDelta, 20);
  assert.ok(finalDuel.winnerId, 'Un vainqueur a été validé par consensus');
}

async function tryOptionalChromiumFlow() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (_) {
    return { ran: false, reason: 'module playwright non installé localement' };
  }
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, args: ['--no-sandbox'] });
  } catch (err) {
    return { ran: false, reason: `binaire Chromium indisponible (${String(err.message || err).split('\n')[0]})` };
  }

  const port = 38000 + Math.floor(Math.random() * 2000);
  const dbFile = path.join('/tmp', `minuit-pw-${port}.sqlite3`);
  const srv = spawn('python3', ['server.py'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), MINUIT_DB: dbFile },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const mockSupabase = await startMockSupabaseServer();

  try {
    const appUrl = `http://127.0.0.1:${port}`;
    await waitUntil(async () => {
      try {
        const res = await fetch(`${appUrl}/duel-core.js`);
        return res.status === 200;
      } catch (_) {
        return false;
      }
    }, 5000, 60);

    const makeInit = (token, id, name) => `
      localStorage.setItem('minuit-supabase-session-v1', JSON.stringify({
        access_token: ${JSON.stringify(token)},
        refresh_token: 'refresh-' + ${JSON.stringify(token)},
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: ${JSON.stringify(id)}, displayName: ${JSON.stringify(name)}, user_metadata: { display_name: ${JSON.stringify(name)} } }
      }));
      const origDefine = Object.defineProperty;
      window.__overrideSupabaseUrl = ${JSON.stringify(mockSupabase.url)};
    `;

    const c1 = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    const routeConfig = async ctx => {
      await ctx.route('**/supabase-config.js*', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: `window.MINUIT_SUPABASE_CONFIG = { url: ${JSON.stringify(mockSupabase.url)}, publishableKey: 'sb_publishable_test' };`
        })
      );
    };
    await routeConfig(c1);
    await routeConfig(c2);

    await c1.addInitScript(makeInit('token-u1', '00000000-0000-4000-8000-00000000c001', 'Séléné'));
    await c2.addInitScript(makeInit('token-u2', '00000000-0000-4000-8000-00000000c002', 'Nyx'));

    const p1 = await c1.newPage();
    const p2 = await c2.newPage();

    await p1.goto(appUrl);
    await p1.waitForSelector('#nightDuelEntry');
    await p1.click('#nightDuelEntry');
    await p1.waitForSelector('#duelCreateBtn');
    await p1.click('#duelCreateBtn');
    await p1.waitForSelector('#duelInviteLink');

    const inviteHref = await p1.inputValue('#duelInviteLink');
    const duelId = Core.extractDuelId(inviteHref);
    assert.ok(duelId, 'UUID valide dans le lien Chromium');

    await p2.goto(`${appUrl}/?duel=${duelId}`);
    await p2.waitForSelector('.duel-draft-grid');
    await p1.waitForSelector('.duel-draft-grid');

    await p1.click('#duelReadyBtn');
    await p2.click('#duelReadyBtn');

    await p1.waitForFunction(() => window.NightDuel?.isCombatActive === true);
    await p2.waitForFunction(() => window.NightDuel?.isCombatActive === true);

    await waitUntil(() => mockSupabase.wireLog.some(m => m.payload?.event === 'snapshot'));
    const hiddenSnap = mockSupabase.wireLog.find(m => m.payload?.event === 'snapshot').payload.payload;
    assert.equal(hiddenSnap.opponent.x, null);
    assert.equal(hiddenSnap.opponent.y, null);

    await p2.keyboard.down('ArrowRight');
    await p2.waitForFunction(() => (window.NightDuel?.snapshot?.projectiles?.length || 0) > 0);
    await p2.keyboard.up('ArrowRight');

    await p2.click('#duelForfeitBtn');
    await p2.waitForSelector('#duelConfirmForfeit');
    await p2.click('#duelConfirmForfeit');

    await p1.waitForSelector('.duel-result-screen');
    await p2.waitForSelector('.duel-result-screen');
    return { ran: true, reason: 'Chromium 2 clients exécuté' };
  } finally {
    await browser.close();
    await mockSupabase.close();
    srv.kill('SIGTERM');
    try {
      fs.unlinkSync(dbFile);
    } catch (_) {}
  }
}

async function runInAppInviteScenario(mockSupabase) {
  // Invitation dans l'application : l'hôte invite un pseudo, l'invité reçoit un
  // popup « rejoindre / refuser » puis accepte -> les deux clients passent en draft.
  const host = bootClientVm(mockSupabase.url, 'http://127.0.0.1:3000/', 'token-u1', '00000000-0000-4000-8000-00000000c001', 'Séléné');
  const guest = bootClientVm(mockSupabase.url, 'http://127.0.0.1:3000/', 'token-u2', '00000000-0000-4000-8000-00000000c002', 'Nyx');

  host.document.getElementById('nightDuelEntry').click();
  await waitUntil(() => host.document.getElementById('duelCreateBtn'));
  host.document.getElementById('duelModeFriendly').click();
  host.document.getElementById('duelWagerZero').click();
  host.document.getElementById('duelCreateBtn').click();
  await waitUntil(() => host.document.getElementById('duelInAppSend'));
  await waitUntil(() => host.ctx.NightDuel.teamPlayers.length === 2);
  assert.ok(host.document.getElementById('duelTeamChallenge_00000000-0000-4000-8000-00000000c002'), 'La liste de team doit proposer de défier Nyx');
  assert.ok(host.document.getElementById('duelInAppPseudo'), 'L’invitation par pseudo doit rester disponible');

  const pseudoInput = host.document.getElementById('duelInAppPseudo');
  assert.ok(pseudoInput, 'Le champ de pseudo pour inviter dans le jeu doit être présent');
  pseudoInput.value = 'Nyx';
  host.document.getElementById('duelInAppSend').click();
  await waitUntil(() => host.document.getElementById('duelStatusMsg')?.textContent.includes('Invitation envoyée'));

  // Côté invité : l'observateur remonte l'invitation et affiche le popup.
  await guest.ctx.NightDuel.refreshInvitations();
  await waitUntil(() => guest.document.getElementById('duelInvitePopup'));
  const popupHtml = guest.document.getElementById('duelInvitePopup').innerHTML;
  assert.ok(popupHtml.includes('Séléné'), 'Le popup doit nommer la joueuse qui invite');
  assert.ok(guest.document.getElementById('duelInviteAccept'), 'Le popup doit proposer de rejoindre');
  assert.ok(guest.document.getElementById('duelInviteDecline'), 'Le popup doit proposer de refuser');

  guest.document.getElementById('duelInviteAccept').click();
  await waitUntil(() => guest.ctx.NightDuel.currentDuel?.status === 'draft');
  assert.equal(guest.document.getElementById('duelInvitePopup'), null, 'Le popup disparaît après acceptation');
  await waitUntil(() => host.ctx.NightDuel.currentDuel?.status === 'draft', 8000);
  assert.equal(host.ctx.NightDuel.currentDuel.opponentId, '00000000-0000-4000-8000-00000000c002');
  assert.equal(guest.ctx.NightDuel.currentDuel.opponentId, '00000000-0000-4000-8000-00000000c002');
}

async function runTeamInviteScenario(mockSupabase) {
  // Liste des membres de la team : un clic sur « Défier » crée le duel et envoie
  // l'invitation au bon compte, sans saisir le pseudo. L'invité accepte via popup.
  const host = bootClientVm(mockSupabase.url, 'http://127.0.0.1:3000/', 'token-u1', '00000000-0000-4000-8000-00000000c001', 'Séléné');
  const guest = bootClientVm(mockSupabase.url, 'http://127.0.0.1:3000/', 'token-u2', '00000000-0000-4000-8000-00000000c002', 'Nyx');

  host.document.getElementById('nightDuelEntry').click();
  await waitUntil(() => host.document.getElementById('duelCreateBtn'));
  host.document.getElementById('duelModeFriendly').click();
  host.document.getElementById('duelWagerZero').click();
  const challengeId = 'duelTeamChallenge_00000000-0000-4000-8000-00000000c002';
  await waitUntil(() => {
    const btn = host.document.getElementById(challengeId);
    return btn && !btn.disabled;
  });
  const roster = host.ctx.NightDuel.teamPlayers;
  assert.equal(roster.length, 2, 'La liste doit contenir les membres de la team');
  assert.ok(roster.some(p => p.isYou), 'La joueuse courante doit être marquée');
  host.document.getElementById(challengeId).click();
  await waitUntil(() => host.ctx.NightDuel.currentDuel?.status === 'waiting');
  await waitUntil(() => host.document.getElementById('duelStatusMsg')?.textContent.includes('Invitation envoyée'));

  await guest.ctx.NightDuel.refreshInvitations();
  await waitUntil(() => guest.document.getElementById('duelInvitePopup'));
  guest.document.getElementById('duelInviteAccept').click();
  await waitUntil(() => guest.ctx.NightDuel.currentDuel?.status === 'draft');
  await waitUntil(() => host.ctx.NightDuel.currentDuel?.status === 'draft', 8000);
  assert.equal(host.ctx.NightDuel.currentDuel.opponentId, '00000000-0000-4000-8000-00000000c002');
}

(async () => {
  await verifyPythonStaticServer();
  // Un serveur mock neuf par scénario : les duels/invitations d'un scénario ne
  // doivent pas rendre les membres « occupés » dans le suivant.
  for (const scenario of [runTwoClientIntegration, runInAppInviteScenario, runTeamInviteScenario]) {
    const mockSupabase = await startMockSupabaseServer();
    try {
      await scenario(mockSupabase);
    } finally {
      await mockSupabase.close();
    }
  }
  const browserCheck = await tryOptionalChromiumFlow();
  console.log(
    `Duel de la Nuit noire — intégration 2 clients (lien/QR, liste de team, invitation par pseudo/membre + popup rejoindre, 2 drafts, positions masquées, projectiles, commandes, consensus & cote) : OK (${
      browserCheck.ran ? browserCheck.reason : 'VM 2-clients HTTP+WS exécutée ; ' + browserCheck.reason
    })`
  );
  // supabase.js embarque désormais un setInterval(60 s) (file de scores) qui
  // maintient la boucle Node active : on sort explicitement après le succès.
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
