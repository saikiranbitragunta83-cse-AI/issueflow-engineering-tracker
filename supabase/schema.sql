-- IssueFlow v2: Shared workspaces with per-member Row Level Security.
-- Paste into Supabase Dashboard > SQL Editor > New query, then Run ONCE.
-- Uses current authenticated GitHub login (auth.uid()).
-- Never publish a service_role/secret key in browser code.

create table if not exists public.issueflow_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  invite_code text not null unique default replace(gen_random_uuid()::text,'-',''),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.issueflow_members (
  workspace_id uuid not null references public.issueflow_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);

create table if not exists public.issueflow_issues (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.issueflow_workspaces(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'backlog' check(status in ('backlog','progress','review','done')),
  priority text not null default 'medium' check(priority in ('critical','high','medium','low')),
  assignee text not null default '' check (char_length(assignee) <= 60),
  due_date date,
  tags text[] not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists issueflow_issues_workspace_idx on public.issueflow_issues(workspace_id,updated_at desc);

create table if not exists public.issueflow_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.issueflow_workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  message text not null check (char_length(message) between 1 and 220),
  created_at timestamptz not null default now()
);
create index if not exists issueflow_events_workspace_idx on public.issueflow_events(workspace_id,created_at desc);

alter table public.issueflow_workspaces enable row level security;
alter table public.issueflow_members enable row level security;
alter table public.issueflow_issues enable row level security;
alter table public.issueflow_events enable row level security;

-- SECURITY DEFINER avoids recursion on the membership table's own RLS policy.
create or replace function public.issueflow_is_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.issueflow_members m
    where m.workspace_id = p_workspace and m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.issueflow_is_member(uuid) from public;
grant execute on function public.issueflow_is_member(uuid) to authenticated;

create policy "if_workspaces_read_members" on public.issueflow_workspaces
  for select to authenticated using (public.issueflow_is_member(id));
create policy "if_members_read_members" on public.issueflow_members
  for select to authenticated using (public.issueflow_is_member(workspace_id));
create policy "if_issues_read_members" on public.issueflow_issues
  for select to authenticated using (public.issueflow_is_member(workspace_id));
create policy "if_issues_insert_members" on public.issueflow_issues
  for insert to authenticated with check (public.issueflow_is_member(workspace_id) and created_by = (select auth.uid()));
create policy "if_issues_update_members" on public.issueflow_issues
  for update to authenticated using (public.issueflow_is_member(workspace_id))
  with check (public.issueflow_is_member(workspace_id));
create policy "if_issues_delete_members" on public.issueflow_issues
  for delete to authenticated using (public.issueflow_is_member(workspace_id));
create policy "if_events_read_members" on public.issueflow_events
  for select to authenticated using (public.issueflow_is_member(workspace_id));
create policy "if_events_insert_members" on public.issueflow_events
  for insert to authenticated with check (public.issueflow_is_member(workspace_id) and user_id = (select auth.uid()));

-- An authenticated user gets their own new workspace and membership atomically.
create or replace function public.issueflow_create_workspace(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Login required'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 2 and 80 then
    raise exception 'Workspace name must be between 2 and 80 characters';
  end if;
  insert into public.issueflow_workspaces(name,created_by)
  values (trim(p_name),(select auth.uid())) returning id into v_id;
  insert into public.issueflow_members(workspace_id,user_id)
  values (v_id,(select auth.uid()));
  return v_id;
end; $$;

-- A 32-character random invite code grants access to the team's workspace.
-- Treat invite codes as private; anyone with a valid code can join after login.
create or replace function public.issueflow_join_workspace(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Login required'; end if;
  select id into v_id from public.issueflow_workspaces
  where invite_code=lower(trim(coalesce(p_code,'')));
  if v_id is null then raise exception 'Invite code not recognized'; end if;
  insert into public.issueflow_members(workspace_id,user_id)
  values(v_id,(select auth.uid())) on conflict do nothing;
  return v_id;
end; $$;
revoke all on function public.issueflow_create_workspace(text) from public;
revoke all on function public.issueflow_join_workspace(text) from public;
grant execute on function public.issueflow_create_workspace(text) to authenticated;
grant execute on function public.issueflow_join_workspace(text) to authenticated;

-- Default API grants can vary between projects; grant narrowly and rely on RLS.
grant select on public.issueflow_workspaces,public.issueflow_members,public.issueflow_issues,public.issueflow_events to authenticated;
grant insert,update,delete on public.issueflow_issues to authenticated;
grant insert on public.issueflow_events to authenticated;
grant usage on sequence public.issueflow_issues_id_seq to authenticated;
grant usage on sequence public.issueflow_events_id_seq to authenticated;
