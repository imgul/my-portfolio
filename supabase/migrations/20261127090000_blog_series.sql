-- Blog series: the database model behind src/blog/series.mjs.
--
-- The site itself is file-based (posts are MDX files in src/blog/posts/, and
-- the series registry is src/blog/series.mjs), so nothing in the app reads
-- these tables today. They record the same model in Postgres for a future
-- admin / API, and document how the two map:
--
--   blog_series.slug            <-> seriesSlug frontmatter + registry `slug`
--   blog_series_stages.title    <-> seriesStage frontmatter (matched by title)
--   posts.series_position       <-> seriesPart frontmatter
--   planned / scheduled parts   <-> registry `plannedPosts` (title + date only;
--                                   no body exists until the MDX file does)
--
-- A post belongs to zero or one series (series_id directly on the post, no
-- junction table): the same article never appears in two series.
-- See supabase/migrations/20261124173500_blog_reactions.sql for the RLS style.

create table public.blog_series (
  id                 uuid primary key default gen_random_uuid(),
  title              varchar(200) not null,
  slug               varchar(220) not null unique,
  subtitle           varchar(300),
  description        text,
  introduction       text,
  cover_image_url    text,
  cover_image_alt    varchar(300),
  planned_post_count integer,
  status             varchar(30) not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  seo_title          varchar(255),
  seo_description    varchar(320),
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.blog_series_stages (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references public.blog_series(id) on delete cascade,
  title       varchar(200) not null,
  description text,
  position    integer not null,
  unique (series_id, position)
);

-- Posts would carry (once they live in a table):
--   series_id       uuid references public.blog_series(id) on delete set null
--   series_stage_id uuid references public.blog_series_stages(id) on delete set null
--   series_position integer
--   unique index (series_id, series_position) where series_id is not null

alter table public.blog_series enable row level security;
alter table public.blog_series_stages enable row level security;
revoke all on public.blog_series from anon, authenticated;
revoke all on public.blog_series_stages from anon, authenticated;
