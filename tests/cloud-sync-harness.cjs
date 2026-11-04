/* Scratch harness: run the real supabase.js client against real SQL (PGlite). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PGlite } = require('@electric-sql/pglite');

const ROOT = path.resolve(__dirname, '..');

function makeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: k => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

async function makeDb() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key);
    create role anon nologin;
    create role authenticated nologin;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.game_saves(
      user_id uuid primary key,
      payload jsonb not null,
      client_updated_at timestamptz,
      updated_at timestamptz not null default now()
    );
  `);
  for (const name of ['teams.sql', 'team_rules.sql', 'team_stats.sql', 'team_periods.sql']) {
    await db.exec(fs.readFileSync(path.join(ROOT, 'supabase', name), 'utf8'));
  }
  return db;
}

/* One "device" = one sandboxed window with its own localStorage. */
async function makeDevice(db, label, opts = {}) {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const listeners = {};
  const tokens = opts.tokens; // shared access_token -> user id map
  const requests = [];
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        id, textContent: '', innerHTML: '', value: '', disabled: false, href: '',
        classList: { add() {}, remove() {}, toggle() {} },
        style: {}, dataset: {},
        addEventListener() {}, removeEventListener() {},
        querySelector: () => null, querySelectorAll: () => [],
        scrollIntoView() {}, focus() {}, click() {},
        closest: () => null,
      });
    }
    return elements.get(id);
  };
  const documentStub = {
    getElementById: id => (opts.noDom ? null : el(id)),
    createElement: tag => ({ tag, textContent: '', style: {}, setAttribute() {}, appendChild() {} }),
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const windowStub = {
    MINUIT_SUPABASE_CONFIG: { url: 'https://mock.supabase.co', publishableKey: 'sb_publishable_mock' },
    // Globals defined in game.js (loaded before supabase.js in the browser).
    safeText: s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    overlay: () => {},
    $: id => documentStub.getElementById(id),
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    removeEventListener() {},
    dispatchEvent: ev => { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; },
    useAccountPseudo: () => {},
    Journey: opts.journey || null,
    LocalLeague: null,
    location: { href: 'https://game.example/', search: '', protocol: 'https:' },
    localStorage, sessionStorage,
    navigator: {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: fn => setTimeout(fn, 0),
    matchMedia: () => ({ matches: false }),
    history: { replaceState() {} },
    confirm: opts.confirm || (() => true),
    File: class File {
      constructor(parts, name, options = {}) { this._text = parts.join(''); this.name = name; this.type = options.type || ''; this.size = this._text.length; }
      text() { return Promise.resolve(this._text); }
    },
    AbortController,
    URL, URLSearchParams,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    fetch: async (url, options = {}) => {
      const u = new URL(url);
      const auth = String(options.headers?.Authorization || '').replace('Bearer ', '');
      const uid = tokens.get(auth) || null;
      const body = options.body ? JSON.parse(options.body) : {};
      requests.push({ label, path: u.pathname + u.search, method: options.method || 'GET', body });
      if (opts.failRpc && u.pathname.startsWith('/rest/v1/rpc/') && opts.failRpc(body, u)) {
        return { ok: false, status: 500, text: async () => JSON.stringify({ message: 'mock network failure' }) };
      }
      const json = (data, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(data) });
      if (u.pathname === '/functions/v1/pseudo-auth') {
        const userId = opts.users[body.username];
        if (!userId) return json({ message: 'AUTH_INVALID' }, 400);
        if (body.action === 'login' && body.password !== 'password123') return json({ message: 'AUTH_INVALID' }, 400);
        const token = 'token-' + userId;
        tokens.set(token, userId);
        return json({ access_token: token, refresh_token: 'refresh-' + userId, expires_in: 3600, user: { id: userId, user_metadata: { display_name: body.username, auth_provider: 'pseudo' } } });
      }
      if (u.pathname === '/auth/v1/token') {
        const userId = opts.usersByEmail?.[body.email];
        if (!userId || body.password !== 'password123') return json({ message: 'invalid credentials' }, 400);
        const token = 'token-' + userId;
        tokens.set(token, userId);
        return json({ access_token: token, refresh_token: 'refresh-' + userId, expires_in: 3600, user: { id: userId, email: body.email } });
      }
      if (u.pathname === '/auth/v1/logout') return json({});
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
      if (u.pathname === '/rest/v1/game_saves') {
        if ((options.method || 'GET') === 'GET') {
          const r = await db.query('select payload, client_updated_at, updated_at from public.game_saves where user_id = $1::uuid', [uid]);
          return json(r.rows);
        }
        const row = body;
        const inserted = await db.query(
          `insert into public.game_saves(user_id, payload, client_updated_at, updated_at)
           values ($1::uuid, $2::jsonb, $3::timestamptz, now())
           on conflict (user_id) do update set payload = excluded.payload, client_updated_at = excluded.client_updated_at, updated_at = now()
           returning user_id, payload, client_updated_at, updated_at`,
          [row.user_id, JSON.stringify(row.payload), row.client_updated_at]
        );
        // PostgREST `return=representation` renvoie la ligne insérée.
        return { ok: true, status: 201, text: async () => JSON.stringify(inserted.rows) };
      }
      if (u.pathname.startsWith('/rest/v1/rpc/')) {
        const name = u.pathname.split('/').pop();
        const params = Object.entries(body);
        const placeholders = params.map((_, i) => `$${i + 1}`).join(',');
        try {
          const r = await db.query(`select public.${name}(${placeholders}) as result`, params.map(([, v]) => v));
          return json(r.rows[0].result);
        } catch (error) {
          return json({ message: String(error.message || error) }, 400);
        }
      }
      return json({ message: 'not found' }, 404);
    },
  };
  windowStub.document = documentStub;
  windowStub.window = windowStub;
  windowStub.globalThis = windowStub;
  const sandbox = vm.createContext(windowStub);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'supabase.js'), 'utf8'), sandbox, { filename: 'supabase.js' });
  return { window: windowStub, cloud: windowStub.MinuitCloud, localStorage, requests, el, label };
}

module.exports = { makeDb, makeDevice, ROOT };
