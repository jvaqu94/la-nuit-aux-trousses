// Accès par pseudo sans e-mail. La clé service_role reste exclusivement ici :
// elle crée un utilisateur confirmé dans un domaine technique réservé, puis le
// navigateur reçoit uniquement la session obtenue par le mot de passe.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function failure(status: number, code: string) {
  return reply(status, { error: code });
}

function validUsername(value: string) {
  const length = Array.from(value).length;
  return length >= 2 && length <= 24 && /^[\p{L}\p{N}\p{M} ._'-]+$/u.test(value);
}

async function authRequest(url: string, path: string, key: string, body: unknown) {
  const response = await fetch(url + path, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED');
  if (Number(request.headers.get('content-length') || 0) > 4096) return failure(413, 'REQUEST_TOO_LARGE');

  let input: { action?: unknown; username?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return failure(400, 'REQUEST_INVALID');
  }

  const action = String(input.action || '');
  const username = String(input.username || '').normalize('NFKC').trim();
  const password = String(input.password || '');
  const passwordLength = Array.from(password).length;
  if (!['login', 'register'].includes(action)) return failure(400, 'ACTION_INVALID');
  if (!validUsername(username)) return failure(400, 'PSEUDO_INVALID');
  if (passwordLength < 8 || passwordLength > 128) return failure(400, 'PASSWORD_INVALID');

  const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || request.headers.get('apikey') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !publicKey || (action === 'register' && !serviceKey)) {
    return failure(503, 'AUTH_UNAVAILABLE');
  }

  // Le pseudo normalisé détermine une identité technique unique, sans exposer
  // d’adresse réelle ni ajouter une table publique de correspondance.
  const normalized = username.toLocaleLowerCase('fr-FR');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('la-nuit-pseudo-v1:' + normalized),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const email = 'player-' + hex.slice(0, 40) + '@players.minuit.invalid';

  try {
    if (action === 'register') {
      const created = await authRequest(supabaseUrl, '/auth/v1/admin/users', serviceKey, {
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: username,
          auth_provider: 'pseudo',
        },
      });
      if (!created.response.ok) {
        const code = String(created.data?.error_code || created.data?.code || created.data?.msg || '');
        if ([409, 422].includes(created.response.status) || /already|exist|duplicate/i.test(code)) {
          return failure(409, 'PSEUDO_UNAVAILABLE');
        }
        console.error('pseudo-auth: création refusée', created.response.status, code.slice(0, 120));
        return failure(503, 'AUTH_UNAVAILABLE');
      }
    }

    const login = await authRequest(supabaseUrl, '/auth/v1/token?grant_type=password', publicKey, {
      email,
      password,
    });
    if (!login.response.ok || !login.data?.access_token) {
      return action === 'register' ? failure(503, 'AUTH_UNAVAILABLE') : failure(401, 'AUTH_INVALID');
    }
    return reply(200, login.data);
  } catch (error) {
    console.error('pseudo-auth: service indisponible', String(error).slice(0, 180));
    return failure(503, 'AUTH_UNAVAILABLE');
  }
});
