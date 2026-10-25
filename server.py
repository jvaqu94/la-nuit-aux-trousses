#!/usr/bin/env python3
"""Minuit : comptes, quotas quotidiens, objectifs, cumul et classement SSE."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from zoneinfo import ZoneInfo
from datetime import datetime
from http.cookies import SimpleCookie
import json, sqlite3, secrets, time, urllib.parse, re, os, hashlib, hmac, threading
ROOT=Path(__file__).resolve().parent
DB=Path(os.environ.get('MINUIT_DB',str(ROOT/'minuit-scores.sqlite3')))
EVENT=threading.Condition(); VERSION=0; LIMITS={}; LIMIT_LOCK=threading.Lock()
def connect():
    db=sqlite3.connect(DB,timeout=15);db.row_factory=sqlite3.Row;db.execute('PRAGMA foreign_keys=ON');db.execute('PRAGMA busy_timeout=15000');return db
def day_key():return datetime.now(ZoneInfo('Europe/Paris')).strftime('%Y-%m-%d')
def goals(day):
    n=int(hashlib.sha256(('minuit-objectives-v1:'+day).encode()).hexdigest()[:8],16)
    pools=[[("kills",35,"Chasse aux ombres",1800),("waves",4,"Traverser la nuit",2200),("cleanWaves",2,"Vol sans égratignure",2600)],[("graze",15,"Au plus près du danger",2400),("obstacles",3,"Briser les sceaux",2000)],[("elites",4,"Traquer les élites",3000),("bosses",1,"Faire tomber un gardien",3500)]]
    result=[]
    for i,pool in enumerate(pools):
        metric,target,title,reward=pool[(n>>(i*5))%len(pool)]
        result.append(dict(id=metric,metric=metric,target=target,title=title,reward=reward))
    return result
with connect() as db:
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript('''
    CREATE TABLE IF NOT EXISTS league_users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password TEXT NOT NULL, created REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS league_sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES league_users(id), expires REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS league_runs(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES league_users(id), day TEXT NOT NULL, mode TEXT NOT NULL, started REAL NOT NULL, finished INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, duration INTEGER NOT NULL DEFAULT 0, stats TEXT NOT NULL DEFAULT '{}');
    CREATE INDEX IF NOT EXISTS league_runs_quota ON league_runs(user_id,day,mode);
    CREATE TABLE IF NOT EXISTS league_days(user_id INTEGER NOT NULL REFERENCES league_users(id), day TEXT NOT NULL, best INTEGER NOT NULL DEFAULT 0, bonus INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,day));
    CREATE TABLE IF NOT EXISTS league_claims(user_id INTEGER NOT NULL REFERENCES league_users(id), day TEXT NOT NULL, goal TEXT NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(user_id,day,goal));
    ''')
def emit():
    global VERSION
    with EVENT:VERSION+=1;EVENT.notify_all()
def rankings(db):
    return [dict(r) for r in db.execute('''SELECT u.id,u.name,COALESCE(SUM(d.best+d.bonus),0) AS total,COALESCE(SUM(d.bonus),0) AS bonus,COUNT(d.day) AS days FROM league_users u LEFT JOIN league_days d ON u.id=d.user_id GROUP BY u.id ORDER BY total DESC,u.created ASC LIMIT 20''')]
def profile(db,user):
    day=day_key();uid=user['id'];counts={r['mode']:r['n'] for r in db.execute('SELECT mode,COUNT(*) n FROM league_runs WHERE user_id=? AND day=? GROUP BY mode',(uid,day))}
    d=db.execute('SELECT best,bonus FROM league_days WHERE user_id=? AND day=?',(uid,day)).fetchone()
    total=db.execute('SELECT COALESCE(SUM(best+bonus),0) n FROM league_days WHERE user_id=?',(uid,)).fetchone()['n']
    claims={r['goal'] for r in db.execute('SELECT goal FROM league_claims WHERE user_id=? AND day=?',(uid,day))}
    stats={}
    for row in db.execute("SELECT stats FROM league_runs WHERE user_id=? AND day=? AND mode='daily'",(uid,day)):
        for k,v in json.loads(row['stats']).items():stats[k]=max(stats.get(k,0),v)
    objectives=[{**g,'progress':min(g['target'],stats.get(g['metric'],0)),'claimed':g['id'] in claims} for g in goals(day)]
    return dict(id=uid,name=user['name'],day=day,total=total,best=d['best'] if d else 0,bonus=d['bonus'] if d else 0,rankedLeft=max(0,3-counts.get('ranked',0)),dailyLeft=max(0,1-counts.get('daily',0)),goals=objectives)
def password_hash(password,salt):return hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),310000).hex()
class ApiError(Exception):
    def __init__(self,status,message):self.status=status;self.message=message
class Handler(SimpleHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def __init__(self,*a,**k):super().__init__(*a,directory=str(ROOT),**k)
    def reply(self,code,data,cookie=None):
        body=json.dumps(data,ensure_ascii=False).encode();self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)))
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers();self.wfile.write(body)
    def cookie(self,token,clear=False):
        secure=self.headers.get('X-Forwarded-Proto','').split(',')[0].strip()=='https'
        return 'minuit_session='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+('0' if clear else '2592000')+('; Secure' if secure else '')
    def user(self,db,required=False):
        try:
            jar=SimpleCookie();jar.load(self.headers.get('Cookie',''));token=jar.get('minuit_session');token=token.value if token else ''
        except:token=''
        digest=hashlib.sha256(token.encode()).hexdigest()
        user=db.execute('SELECT u.* FROM league_sessions s JOIN league_users u ON s.user_id=u.id WHERE s.token=? AND s.expires>?',(digest,time.time())).fetchone()
        if not user and required:raise ApiError(401,'Connecte-toi pour jouer une partie classée.')
        return user
    def state(self,db,user=None):
        day=day_key();return dict(day=day,user=profile(db,user) if user else None,goals=goals(day),leaders=rankings(db),version=VERSION)
    def end_headers(self):
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control','no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma','no-cache')
            self.send_header('Expires','0')
        super().end_headers()
    def do_GET(self):
        path=urllib.parse.urlsplit(self.path)
        try:
            if path.path=='/api/events':return self.events()
            if path.path in ['/api/state','/api/scores','/api/league','/api/run']:
                with connect() as db:
                    user=self.user(db,path.path=='/api/run')
                    if path.path=='/api/run':
                        token=urllib.parse.parse_qs(path.query).get('token',[''])[0];r=db.execute('SELECT * FROM league_runs WHERE token=? AND user_id=?',(token,user['id'])).fetchone()
                        if not r:raise ApiError(404,'Partie inconnue pour ce compte.')
                        if r['finished']:raise ApiError(409,'Cette partie est déjà terminée.')
                        if time.time()-r['started']>86400:raise ApiError(410,'Cette partie a expiré.')
                        claims={x['goal'] for x in db.execute('SELECT goal FROM league_claims WHERE user_id=? AND day=?',(user['id'],r['day']))};stats=json.loads(r['stats']);run_goals=[{**g,'claimed':g['id'] in claims,'progress':min(g['target'],stats.get(g['metric'],0))} for g in goals(r['day'])]
                        return self.reply(200,dict(token=r['token'],mode=r['mode'],day=r['day'],stats=stats,score=r['score'],goals=run_goals,user=profile(db,user)))
                    result=self.state(db,user)
                    if path.path=='/api/scores':result['scores']=[{**r,'score':r['total']} for r in result['leaders']]
                    return self.reply(200,result)
            if path.path not in ['/','/index.html','/music.js','/game.js','/characters.js','/online.js','/journey.js','/viewport.js','/arsenal.js','/night-hazards.js','/adventure.js','/encounters.js','/collectible-art.js','/flow.js','/surprise.js','/coven.js','/nemesis.js','/combat-feel.js','/onboarding.js','/collision-replay.js','/supabase-config.js','/supabase.js','/README.md','/favicon.ico'] and not re.fullmatch(r'/audio/(nuitsorc-loop|boss-(forest|cemetery|castle|marsh|lanterns)|sfx-player-(shot|spread|missile|laser|special)|sfx-impact-(light|heavy|boss)|sfx-player-life-loss|sfx-obstacle-collision|sfx-surprise-monster|(forest|cemetery|castle|marsh|lanterns|defeat))\.mp3',path.path):raise ApiError(404,'Introuvable')
            if path.path=='/favicon.ico':self.send_response(204);self.send_header('Content-Length','0');self.end_headers();return
            for header in ['If-Modified-Since','If-None-Match']:
                if header in self.headers:del self.headers[header]
            super().do_GET()
        except ApiError as e:self.reply(e.status,{'error':e.message})
        except (BrokenPipeError,ConnectionResetError):pass
    def events(self):
        self.send_response(200);self.send_header('Content-Type','text/event-stream');self.send_header('Cache-Control','no-cache');self.send_header('X-Accel-Buffering','no');self.send_header('Connection','keep-alive');self.end_headers();last=-1;day=''
        try:
            while True:
                with EVENT:
                    if VERSION==last and day==day_key():EVENT.wait(15)
                    current=VERSION
                if current!=last or day!=day_key():
                    with connect() as db:data=dict(version=current,day=day_key(),leaders=rankings(db))
                    self.wfile.write(('event: leaderboard\ndata: '+json.dumps(data,ensure_ascii=False)+'\n\n').encode());last=current;day=data['day']
                else:self.wfile.write(b': keepalive\n\n')
                self.wfile.flush()
        except (BrokenPipeError,ConnectionResetError,TimeoutError):pass
    def do_POST(self):
        try:
            origin=self.headers.get('Origin')
            hosts=[self.headers.get('Host',''),self.headers.get('X-Forwarded-Host','').split(',')[0].strip()]
            if origin and urllib.parse.urlsplit(origin).netloc not in hosts:raise ApiError(403,'Origine de requête refusée.')
            if 'application/json' not in self.headers.get('Content-Type',''):raise ApiError(415,'Format JSON requis.')
            n=int(self.headers.get('Content-Length','0'))
            if not 2<=n<=16384:raise ApiError(400,'Requête invalide.')
            d=json.loads(self.rfile.read(n))
            if not isinstance(d,dict):raise ValueError()
            path=urllib.parse.urlsplit(self.path).path
            if path in ['/api/register','/api/login']:
                ip=self.client_address[0];now=time.time()
                with LIMIT_LOCK:
                    if len(LIMITS)>10000:
                        for key in list(LIMITS):
                            if not LIMITS[key] or LIMITS[key][-1]<now-900:LIMITS.pop(key,None)
                    history=[t for t in LIMITS.get(ip,[]) if t>now-900]
                    if len(history)>=30:raise ApiError(429,'Trop de tentatives. Réessaie dans 15 minutes.')
                    history.append(now);LIMITS[ip]=history
                name=str(d.get('name','')).strip();password=d.get('password','')
                if not re.fullmatch(r'[\w -]{3,20}',name) or not isinstance(password,str) or not 8<=len(password)<=128:raise ApiError(400,'Pseudo : 3 à 20 caractères. Mot de passe : 8 à 128 caractères.')
                with connect() as db:
                    db.execute('BEGIN IMMEDIATE');key=name.casefold();u=db.execute('SELECT * FROM league_users WHERE name_key=?',(key,)).fetchone()
                    if path=='/api/register':
                        if u:raise ApiError(409,'Ce pseudo est déjà utilisé.')
                        salt=secrets.token_hex(16);cursor=db.execute('INSERT INTO league_users(name,name_key,salt,password,created) VALUES(?,?,?,?,?)',(name,key,salt,password_hash(password,salt),now));u=db.execute('SELECT * FROM league_users WHERE id=?',(cursor.lastrowid,)).fetchone()
                    elif not u or not hmac.compare_digest(password_hash(password,u['salt']),u['password']):raise ApiError(401,'Pseudo ou mot de passe incorrect.')
                    token=secrets.token_urlsafe(32);db.execute('DELETE FROM league_sessions WHERE expires<?',(now,));db.execute('INSERT INTO league_sessions(token,user_id,expires) VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),u['id'],now+2592000));result=self.state(db,u)
                if path=='/api/register':emit()
                return self.reply(200,result,self.cookie(token))
            if path=='/api/logout':
                with connect() as db:
                    jar=SimpleCookie();jar.load(self.headers.get('Cookie',''));t=jar.get('minuit_session');db.execute('DELETE FROM league_sessions WHERE token=?',(hashlib.sha256((t.value if t else '').encode()).hexdigest(),))
                return self.reply(200,{'ok':True},self.cookie('',True))
            if path=='/api/run/start':
                m=d.get('mode')
                if m not in ['ranked','daily']:raise ApiError(400,'Mode invalide.')
                with connect() as db:
                    db.execute('BEGIN IMMEDIATE');u=self.user(db,True);day=day_key();count=db.execute('SELECT COUNT(*) n FROM league_runs WHERE user_id=? AND day=? AND mode=?',(u['id'],day,m)).fetchone()['n'];limit=3 if m=='ranked' else 1
                    if count>=limit:raise ApiError(409,'Tes essais de ce mode sont épuisés pour aujourd’hui. L’entraînement reste libre.')
                    token=secrets.token_urlsafe(24);db.execute('INSERT INTO league_runs(token,user_id,day,mode,started) VALUES(?,?,?,?,?)',(token,u['id'],day,m,time.time()));result=dict(token=token,mode=m,day=day,user=profile(db,u),goals=goals(day))
                return self.reply(200,result)
            if path=='/api/run/progress':
                with connect() as db:
                    db.execute('BEGIN IMMEDIATE');u=self.user(db,True);run=db.execute('SELECT * FROM league_runs WHERE token=? AND user_id=?',(str(d.get('token','')),u['id'])).fetchone()
                    if not run:raise ApiError(404,'Partie inconnue pour ce compte.')
                    if run['finished']:return self.reply(200,dict(user=profile(db,u),finished=True,awarded=[]))
                    elapsed=time.time()-run['started'];duration=int(d.get('duration',0));score=int(d.get('score',0))
                    if elapsed>86400:raise ApiError(410,'La partie a expiré.')
                    if not 0<=duration<=elapsed+10 or not 0<=score<=min(5000000,max(5000,duration*5000)):raise ApiError(400,'Progression incohérente.')
                    old=json.loads(run['stats']);raw=d.get('stats',{});stats={}
                    if not isinstance(raw,dict):raise ValueError()
                    ceilings=dict(kills=min(5000,duration*12+10),waves=25,cleanWaves=25,graze=min(20000,duration*20+20),elites=min(1500,duration*3+5),bosses=5,obstacles=min(500,duration*3+5))
                    for k,ceiling in ceilings.items():
                        value=int(raw.get(k,0))
                        if not 0<=value<=ceiling:raise ApiError(400,'Statistiques incohérentes.')
                        stats[k]=max(old.get(k,0),value)
                    if stats['cleanWaves']>stats['waves'] or stats['bosses']>stats['waves'] or stats['elites']>stats['kills']:raise ApiError(400,'Statistiques incohérentes.')
                    db.execute('UPDATE league_runs SET score=?,duration=?,stats=?,finished=? WHERE token=?',(max(score,run['score']),max(duration,run['duration']),json.dumps(stats),int(bool(d.get('finish'))),run['token']))
                    db.execute('INSERT OR IGNORE INTO league_days(user_id,day) VALUES(?,?)',(u['id'],run['day']))
                    awarded=[];changed=False
                    if run['mode']=='ranked':
                        before=db.execute('SELECT best FROM league_days WHERE user_id=? AND day=?',(u['id'],run['day'])).fetchone()['best'];best=max(score,run['score']);changed=best>before
                        if changed:db.execute('UPDATE league_days SET best=? WHERE user_id=? AND day=?',(best,u['id'],run['day']))
                    else:
                        for goal in goals(run['day']):
                            if stats.get(goal['metric'],0)>=goal['target']:
                                inserted=db.execute('INSERT OR IGNORE INTO league_claims(user_id,day,goal,points) VALUES(?,?,?,?)',(u['id'],run['day'],goal['id'],goal['reward']))
                                if inserted.rowcount:
                                    db.execute('UPDATE league_days SET bonus=bonus+? WHERE user_id=? AND day=?',(goal['reward'],u['id'],run['day']));awarded.append(goal);changed=True
                    result=dict(user=profile(db,u),awarded=awarded,finished=bool(d.get('finish')),runDay=run['day'],stats=stats)
                if changed:emit()
                return self.reply(200,result)
            if path in ['/api/start','/api/scores']:raise ApiError(410,'Le classement utilise désormais un compte joueur et des essais réservés.')
            raise ApiError(404,'Introuvable')
        except ApiError as e:self.reply(e.status,{'error':e.message})
        except (ValueError,KeyError,TypeError,json.JSONDecodeError):self.reply(400,{'error':'Données invalides.'})
        except (BrokenPipeError,ConnectionResetError):pass
        except sqlite3.Error:self.reply(503,{'error':'Base occupée. Réessaie dans un instant.'})
if __name__=='__main__':
    port=int(os.environ.get('PORT','3000'));print(f'La Nuit aux Trousses — Grimoire local prêt sur 0.0.0.0:{port}',flush=True);ThreadingHTTPServer(('0.0.0.0',port),Handler).serve_forever()
