"""Tests HTTP isolés : aucun compte ni score ajouté à la vraie base."""
import os, tempfile, importlib.util, threading, json, urllib.request, urllib.error, concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(dir=ROOT/'tests') as tmp:
 os.environ['MINUIT_DB']=str(Path(tmp)/'test.sqlite3')
 spec=importlib.util.spec_from_file_location('minuit_test_server',ROOT/'server.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
 today=['2026-10-24'];s.day_key=lambda:today[0]
 server=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler);server.daemon_threads=True
 threading.Thread(target=server.serve_forever,daemon=True).start();base='http://127.0.0.1:'+str(server.server_port)
 def req(path,data=None,cookie=''):
  headers={'Content-Type':'application/json','Cookie':cookie}
  r=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
  try:
   with urllib.request.urlopen(r,timeout=5) as f:return f.status,json.load(f),f.headers.get('Set-Cookie','')
  except urllib.error.HTTPError as e:return e.code,json.load(e),''
 def aged(token):
  with s.connect() as db:db.execute('UPDATE league_runs SET started=started-1000 WHERE token=?',(token,))
 def start(mode,cookie):
  status,d,_=req('/api/run/start',{'mode':mode},cookie);assert status==200,(status,d);aged(d['token']);return d['token']
 def progress(token,score,cookie,stats={},finish=False):return req('/api/run/progress',dict(token=token,score=score,duration=100,stats=stats,finish=finish),cookie)
 try:
  assert req('/api/run/start',{'mode':'ranked'})[0]==401
  status,d,cookie=req('/api/register',{'name':'SorciereTest','password':'motdepasse-test'});assert status==200
  assert d['user']['rankedLeft']==3 and d['user']['dailyLeft']==1
  assert req('/api/login',{'name':'SorciereTest','password':'incorrect-test'})[0]==401
  assert req('/api/register',{'name':'sorcieretest','password':'another-password'})[0]==409
  cookie=cookie.split(';')[0]
  other_status,other,other_cookie=req('/api/register',{'name':'AutreCompte','password':'autre-pass-test'});assert other_status==200;other_cookie=other_cookie.split(';')[0]
  t1=start('ranked',cookie)
  assert progress(t1,1200,other_cookie)[0]==404
  # Flux SSE : publication visible sans rafraîchir la page.
  stream=urllib.request.urlopen(base+'/api/events',timeout=5)
  assert stream.readline().decode().startswith('event: leaderboard');initial=json.loads(stream.readline().decode()[6:]);stream.readline()
  assert progress(t1,1200,cookie,finish=True)[0]==200
  assert stream.readline().decode().startswith('event: leaderboard');updated=json.loads(stream.readline().decode()[6:]);stream.readline();assert updated['leaders'][0]['total']==1200
  stream.close()
  t2=start('ranked',cookie);assert progress(t2,500,cookie,finish=True)[1]['user']['total']==1200
  t3=start('ranked',cookie);assert progress(t3,1700,cookie,finish=True)[1]['user']['total']==1700
  assert req('/api/run/start',{'mode':'ranked'},cookie)[0]==409
  td=start('daily',cookie);assert req('/api/run/start',{'mode':'daily'},cookie)[0]==409
  stats=dict(kills=60,waves=6,cleanWaves=3,graze=20,elites=8,bosses=1,obstacles=6)
  result=progress(td,9999,cookie,stats,True);assert result[0]==200,result
  bonus=sum(g['reward'] for g in s.goals(today[0]));assert result[1]['user']['total']==1700+bonus
  assert len(result[1]['awarded'])==3
  again=progress(td,9999,cookie,stats,True);assert again[1]['user']['total']==1700+bonus and not again[1]['awarded']
  total=1700+bonus;today[0]='2026-10-25';p=req('/api/state',cookie=cookie)[1]['user'];assert p['rankedLeft']==3 and p['dailyLeft']==1 and p['total']==total and p['best']==0
  t4=start('ranked',cookie);assert progress(t4,600,cookie,finish=True)[1]['user']['total']==total+600
  # Clics concurrents : le compteur ne dépasse jamais trois réservations.
  with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:statuses=list(ex.map(lambda _:req('/api/run/start',{'mode':'ranked'},cookie)[0],range(5)))
  assert statuses.count(200)==2 and statuses.count(409)==3,statuses
  assert req('/api/logout',{},cookie)[0]==200 and req('/api/state',cookie=cookie)[1]['user'] is None
  print('OK : comptes, séparation joueurs, 3+1 essais, transactions concurrentes, meilleur du jour, primes uniques, cumul multi-jours, reset Paris, SSE et déconnexion.')
 finally:server.shutdown();server.server_close()
