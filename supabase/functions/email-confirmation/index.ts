// Page publique d’arrivée après /auth/v1/verify.
// Aucune donnée de compte n’est lue, conservée ou transmise par cette fonction.
// Le corps est volontairement ASCII : les entités HTML évitent tout mojibake
// même lorsqu’un client intermédiaire oublie le charset de la réponse.
const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirmation d&rsquo;e-mail &middot; La Nuit aux Trousses</title>
<style>color-scheme:dark;*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0,#30213f,#100e19 70%);color:#f4eee4;font:16px/1.65 Arial,sans-serif}main{width:min(100%,520px);padding:34px;border:1px solid #80628b66;border-radius:16px;background:#1b1626;text-align:center;box-shadow:0 24px 80px #0007}h1{margin:8px 0 18px;font:32px Georgia,serif}p{color:#c9bed4}small{display:block;margin-top:22px;color:#9e8eae}.moon{font-size:40px;color:#ffbd80}</style></head>
<body><main><div class="moon" aria-hidden="true">&#9790;</div><h1 id="title">Confirmation d&rsquo;e-mail</h1><p id="message">V&eacute;rification du lien&hellip;</p><small>La Nuit aux Trousses &middot; confirmation du compte en ligne</small></main>
<script>
(()=>{
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 const failed=query.has('error')||fragment.has('error');
 const confirmed=!failed&&(fragment.has('access_token')||query.get('type')==='signup'||fragment.get('type')==='signup');
 const title=failed?'Lien invalide ou expir&eacute;':confirmed?'Adresse e-mail confirm&eacute;e':'Confirmation d&rsquo;e-mail';
 const message=failed?'Ce lien a expir&eacute; ou a d&eacute;j&agrave; &eacute;t&eacute; utilis&eacute;. Retourne dans le jeu et choisis &laquo; Renvoyer la confirmation &raquo;.':confirmed?'Ton adresse est confirm&eacute;e. Retourne dans l&rsquo;onglet du jeu et connecte-toi avec ton e-mail et ton mot de passe.':'Ouvre le lien de confirmation re&ccedil;u par e-mail. Tu pourras ensuite revenir te connecter dans le jeu.';
 // Chaines statiques : aucun parametre d'URL n'est injecte dans le HTML.
 document.getElementById('title').innerHTML=title;document.getElementById('message').innerHTML=message;
 document.title=document.getElementById('title').textContent+' - La Nuit aux Trousses';
 // Ne pas conserver les jetons de confirmation dans l'historique.
 history.replaceState(null,'',location.pathname);
})();
</script></body></html>`;

Deno.serve(() => {
  const body = new TextEncoder().encode(page);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': String(body.length),
      'Content-Language': 'fr',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    }
  });
});
