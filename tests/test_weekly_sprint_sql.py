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
