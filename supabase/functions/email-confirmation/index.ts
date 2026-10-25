// Page publique d’arrivée après /auth/v1/verify.
// Aucune donnée de compte n’est lue, conservée ou transmise par cette fonction.
const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirmation d’e-mail · La Nuit aux Trousses</title>
<style>color-scheme:dark;*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0,#30213f,#100e19 70%);color:#f4eee4;font:16px/1.65 Arial,sans-serif}main{width:min(100%,520px);padding:34px;border:1px solid #80628b66;border-radius:16px;background:#1b1626;text-align:center;box-shadow:0 24px 80px #0007}h1{margin:8px 0 18px;font:32px Georgia,serif}p{color:#c9bed4}small{display:block;margin-top:22px;color:#9e8eae}.moon{font-size:40px;color:#ffbd80}</style></head>
<body><main><div class="moon" aria-hidden="true">☾</div><h1 id="title">Confirmation d’e-mail</h1><p id="message">Vérification du lien…</p><small>La Nuit aux Trousses · confirmation du compte en ligne</small></main>
<script>
(()=>{
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 const failed=query.has('error')||fragment.has('error');
 const confirmed=!failed&&(fragment.has('access_token')||query.get('type')==='signup'||fragment.get('type')==='signup');
 const title=failed?'Lien invalide ou expiré':confirmed?'Adresse e-mail confirmée':'Confirmation d’e-mail';
 const message=failed?'Ce lien a expiré ou a déjà été utilisé. Retourne dans le jeu et choisis « Renvoyer la confirmation ».':confirmed?'Ton adresse est confirmée. Retourne dans l’onglet du jeu et connecte-toi avec ton e-mail et ton mot de passe.':'Ouvre le lien de confirmation reçu par e-mail. Tu pourras ensuite revenir te connecter dans le jeu.';
 document.getElementById('title').textContent=title;document.getElementById('message').textContent=message;document.title=title+' · La Nuit aux Trousses';
 // Les jetons de confirmation ne doivent pas rester dans l’historique du navigateur.
 history.replaceState(null,'',location.pathname);
})();
</script></body></html>`;

Deno.serve(() => new Response(page, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }
}));
