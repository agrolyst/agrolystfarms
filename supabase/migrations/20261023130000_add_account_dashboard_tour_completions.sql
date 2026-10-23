create table if not exists public.user_tour_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  tour_key text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, tour_key)
);

alter table public.user_tour_completions enable row level security;

drop policy if exists "Users can read their own tour completions" on public.user_tour_completions;
create policy "Users can read their own tour completions"
  on public.user_tour_completions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can record their own tour completions" on public.user_tour_completions;
create policy "Users can record their own tour completions"
  on public.user_tour_completions for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.user_tour_completions to authenticated;
