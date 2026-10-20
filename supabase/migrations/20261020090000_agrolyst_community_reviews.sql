-- Agrolyst Community Reviews schema
-- Applied to the Agrolyst Supabase project on 2026-10-20.
create table if not exists public.agrolyst_reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(trim(author_name)) between 2 and 80),
  business_name text check (business_name is null or char_length(business_name) <= 120),
  location text check (location is null or char_length(location) <= 100),
  category text not null default 'General experience' check (char_length(category) <= 80),
  body text not null check (char_length(trim(body)) between 10 and 2000),
  visitor_id text not null check (char_length(visitor_id) between 16 and 80),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agrolyst_reviews_created_at_idx on public.agrolyst_reviews (created_at desc);
create table if not exists public.agrolyst_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.agrolyst_reviews(id) on delete cascade,
  parent_id uuid references public.agrolyst_review_comments(id) on delete cascade,
  author_name text not null check (char_length(trim(author_name)) between 2 and 80),
  body text not null check (char_length(trim(body)) between 2 and 1000),
  visitor_id text not null check (char_length(visitor_id) between 16 and 80),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agrolyst_review_comments_review_idx on public.agrolyst_review_comments (review_id, created_at asc);
create table if not exists public.agrolyst_review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.agrolyst_reviews(id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 16 and 80),
  created_at timestamptz not null default now(),
  unique (review_id, visitor_id)
);
create index if not exists agrolyst_review_likes_review_idx on public.agrolyst_review_likes (review_id);
alter table public.agrolyst_reviews enable row level security;
alter table public.agrolyst_review_comments enable row level security;
alter table public.agrolyst_review_likes enable row level security;
drop policy if exists "Public can read visible Agrolyst reviews" on public.agrolyst_reviews;
create policy "Public can read visible Agrolyst reviews" on public.agrolyst_reviews for select to anon, authenticated using (is_hidden = false);
drop policy if exists "Public can post Agrolyst reviews" on public.agrolyst_reviews;
create policy "Public can post Agrolyst reviews" on public.agrolyst_reviews for insert to anon, authenticated with check (is_hidden = false and char_length(trim(author_name)) between 2 and 80 and char_length(trim(body)) between 10 and 2000 and char_length(visitor_id) between 16 and 80);
drop policy if exists "Public can read visible Agrolyst review comments" on public.agrolyst_review_comments;
create policy "Public can read visible Agrolyst review comments" on public.agrolyst_review_comments for select to anon, authenticated using (is_hidden = false);
drop policy if exists "Public can add Agrolyst review comments" on public.agrolyst_review_comments;
create policy "Public can add Agrolyst review comments" on public.agrolyst_review_comments for insert to anon, authenticated with check (is_hidden = false and char_length(trim(author_name)) between 2 and 80 and char_length(trim(body)) between 2 and 1000 and char_length(visitor_id) between 16 and 80 and exists (select 1 from public.agrolyst_reviews r where r.id = review_id and r.is_hidden = false) and (parent_id is null or exists (select 1 from public.agrolyst_review_comments p where p.id = parent_id and p.review_id = review_id and p.is_hidden = false)));
drop policy if exists "Public can read Agrolyst review likes" on public.agrolyst_review_likes;
create policy "Public can read Agrolyst review likes" on public.agrolyst_review_likes for select to anon, authenticated using (true);
drop policy if exists "Public can like visible Agrolyst reviews" on public.agrolyst_review_likes;
create policy "Public can like visible Agrolyst reviews" on public.agrolyst_review_likes for insert to anon, authenticated with check (char_length(visitor_id) between 16 and 80 and exists (select 1 from public.agrolyst_reviews r where r.id = review_id and r.is_hidden = false));
grant select on public.agrolyst_reviews to anon, authenticated;
grant insert (author_name, business_name, location, category, body, visitor_id) on public.agrolyst_reviews to anon, authenticated;
grant select on public.agrolyst_review_comments to anon, authenticated;
grant insert (review_id, parent_id, author_name, body, visitor_id) on public.agrolyst_review_comments to anon, authenticated;
grant select on public.agrolyst_review_likes to anon, authenticated;
grant insert (review_id, visitor_id) on public.agrolyst_review_likes to anon, authenticated;

-- Publish community changes for live updates in open website sessions.
alter publication supabase_realtime add table public.agrolyst_reviews, public.agrolyst_review_comments, public.agrolyst_review_likes;
