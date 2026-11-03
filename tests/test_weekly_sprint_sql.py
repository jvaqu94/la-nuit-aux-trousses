"""Le Sprint utilise un stockage team dédié, jamais les scores de campagne."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sql = (ROOT / 'supabase/weekly_sprint.sql').read_text()
client = (ROOT / 'supabase.js').read_text()

assert 'create table if not exists public.team_weekly_sprints' in sql
assert 'alter table public.team_weekly_sprints enable row level security' in sql
assert 'revoke all on table public.team_weekly_sprints from anon, authenticated' in sql
assert "set search_path = ''" in sql
assert 'p_week <> v_current_week' in sql
assert 'on conflict (team_id, user_id, week_start) do update' in sql
assert 'insert into public.team_scores' not in sql
assert 'insert into public.team_score_attempts' not in sql
assert 'grant execute on function public.minuit_weekly_sprint_board(date) to authenticated' in sql
assert 'grant execute on function public.minuit_submit_weekly_sprint(date, text, integer, integer, integer, boolean) to authenticated' in sql
assert 'grant execute on function public.minuit_weekly_sprint_board(date) to anon' not in sql
assert 'grant execute on function public.minuit_submit_weekly_sprint(date, text, integer, integer, integer, boolean) to anon' not in sql

start = client.index('async function weeklySprintBoard')
end = client.index('function renderPanel', start)
weekly_client = client[start:end]
assert "/rpc/minuit_weekly_sprint_board" in weekly_client
assert "/rpc/minuit_submit_weekly_sprint" in weekly_client
assert 'p_mode' not in weekly_client
assert "'free'" not in weekly_client and "'ranked'" not in weekly_client and "'daily'" not in weekly_client
print('OK : Sprint hebdomadaire séparé, RLS, semaine courante et RPC authentifiés sans mode campagne.')

# La nouvelle course ne partage ni ses clés ni ses RPC avec l’ancien Sprint.
ring = (ROOT / 'supabase/ring_sprint.sql').read_text()
assert 'create table if not exists public.team_ring_sprints' in ring
assert 'alter table public.team_ring_sprints enable row level security' in ring
assert 'revoke all on table public.team_ring_sprints from anon, authenticated' in ring
assert 'p_week <> v_current_week' in ring
assert 'grant execute on function public.minuit_ring_sprint_board(date) to authenticated' in ring
assert 'grant execute on function public.minuit_submit_ring_sprint(date, text, integer, integer, integer, boolean) to authenticated' in ring
assert 'insert into public.team_weekly_sprints' not in ring
assert 'insert into public.team_scores' not in ring
assert '/rpc/minuit_ring_sprint_board' in client and '/rpc/minuit_submit_ring_sprint' in client
print('OK : classement de course distinct, RLS et RPC authentifiées.')

# Les records de la chevauchée ne sont pas mélangés avec les versions antérieures.
broom = (ROOT / 'supabase/broom_sprint.sql').read_text()
assert 'create table if not exists public.team_broom_sprints' in broom
assert 'alter table public.team_broom_sprints enable row level security' in broom
assert 'revoke all on table public.team_broom_sprints from anon, authenticated' in broom
assert 'grant execute on function public.minuit_broom_sprint_board(date) to authenticated' in broom
assert 'grant execute on function public.minuit_submit_broom_sprint(date, text, integer, integer, integer, boolean) to authenticated' in broom
assert 'insert into public.team_ring_sprints' not in broom
assert '/rpc/minuit_broom_sprint_board' in client and '/rpc/minuit_submit_broom_sprint' in client
print('OK : classement de la chevauchée distinct, RLS et RPC authentifiées.')

# La récolte compte les bonbons et ne doit jamais être mélangée aux anciens points.
candy = (ROOT / 'supabase/candy_sprint.sql').read_text()
assert 'create table if not exists public.team_candy_sprints' in candy
assert 'alter table public.team_candy_sprints enable row level security' in candy
assert 'revoke all on table public.team_candy_sprints from anon, authenticated' in candy
assert 'grant execute on function public.minuit_candy_sprint_board(date) to authenticated' in candy
assert 'grant execute on function public.minuit_submit_candy_sprint(date, text, integer, integer, integer, boolean) to authenticated' in candy
assert '/rpc/minuit_candy_sprint_v5_board' in client and '/rpc/minuit_submit_candy_sprint_v5' in client
assert 'public.team_broom_sprints' not in candy
print('OK : classement des bonbons isolé et authentifié.')

# Les résultats du parcours varié ne sont pas mélangés à l'ancien parcours.
v2 = (ROOT / 'supabase/candy_sprint_v2.sql').read_text()
assert 'create table if not exists public.team_candy_sprints_v2' in v2
assert 'alter table public.team_candy_sprints_v2 enable row level security' in v2
assert 'revoke all on table public.team_candy_sprints_v2 from anon, authenticated' in v2
assert 'grant execute on function public.minuit_candy_sprint_v2_board(date) to authenticated' in v2
assert 'grant execute on function public.minuit_submit_candy_sprint_v2(date, text, integer, integer, integer, boolean) to authenticated' in v2
assert 'insert into public.team_scores' not in v2 and 'insert into public.team_candy_sprints(' not in v2
print('OK : classement du parcours varié séparé et authentifié.')

# Classement à choix distinct des parcours précédents.
v3 = (ROOT / 'supabase/candy_sprint_v3.sql').read_text()
assert 'create table if not exists public.team_candy_sprints_v3' in v3
assert 'alter table public.team_candy_sprints_v3 enable row level security' in v3
assert 'revoke all on table public.team_candy_sprints_v3 from anon, authenticated' in v3
assert 'grant execute on function public.minuit_candy_sprint_v3_board(date) to authenticated' in v3
assert 'grant execute on function public.minuit_submit_candy_sprint_v3(date, text, integer, integer, integer, boolean) to authenticated' in v3
assert 'insert into public.team_scores' not in v3 and 'insert into public.team_candy_sprints_v2(' not in v3
print('OK : classement du parcours à choix séparé et authentifié.')

# Nouveau classement : les obstacles et tirs ne mélangent pas les anciens scores.
v4 = (ROOT / 'supabase/candy_sprint_v4.sql').read_text()
assert 'create table if not exists public.team_candy_sprints_v4' in v4
assert 'alter table public.team_candy_sprints_v4 enable row level security' in v4
assert 'revoke all on table public.team_candy_sprints_v4 from anon, authenticated' in v4
assert 'grant execute on function public.minuit_candy_sprint_v4_board(date) to authenticated' in v4
assert 'grant execute on function public.minuit_submit_candy_sprint_v4(date, text, integer, integer, integer, boolean) to authenticated' in v4
assert 'insert into public.team_scores' not in v4 and 'insert into public.team_candy_sprints_v3(' not in v4
print('OK : classement des nouveaux obstacles séparé et authentifié.')

# Parcours plus dense : classement propre et isolé des précédents.
v5 = (ROOT / 'supabase/candy_sprint_v5.sql').read_text()
assert 'create table if not exists public.team_candy_sprints_v5' in v5
assert 'alter table public.team_candy_sprints_v5 enable row level security' in v5
assert 'revoke all on table public.team_candy_sprints_v5 from anon, authenticated' in v5
assert 'grant execute on function public.minuit_candy_sprint_v5_board(date) to authenticated' in v5
assert 'grant execute on function public.minuit_submit_candy_sprint_v5(date, text, integer, integer, integer, boolean) to authenticated' in v5
assert 'insert into public.team_scores' not in v5 and 'insert into public.team_candy_sprints_v4(' not in v5
print('OK : classement du parcours dense séparé et authentifié.')
