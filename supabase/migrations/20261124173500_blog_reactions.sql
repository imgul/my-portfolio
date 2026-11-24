-- Blog likes / dislikes with optional feedback (Supabase project "gul-blog").
-- Readers never touch the table directly: RLS is on with no policies, and
-- all access goes through two SECURITY DEFINER functions.
-- See feedback in the dashboard:  select * from post_reactions where reason is not null order by updated_at desc;
create extension if not exists pgcrypto with schema extensions;

create table public.post_reactions (
  slug       text        not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  visitor    uuid        not null,
  value      smallint    not null check (value in (-1, 1)),
  reason     text        check (reason is null or char_length(reason) <= 600),
  ip_hash    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (slug, visitor)
);
create index post_reactions_ip_recent on public.post_reactions (ip_hash, updated_at desc);

alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from anon, authenticated;

-- Aggregate counts for one or more posts (public).
create or replace function public.reaction_counts(p_slugs text[])
returns table (slug text, likes bigint, dislikes bigint)
language sql stable security definer set search_path = public
as $$
  select r.slug,
         count(*) filter (where r.value = 1),
         count(*) filter (where r.value = -1)
  from public.post_reactions r
  where r.slug = any (p_slugs[1:200])
  group by r.slug
$$;

-- Cast, change or remove a vote (p_value 0 = remove). Optional short reason.
-- Max 60 votes per IP per hour; the IP is stored only as a salted SHA-256 hash.
create or replace function public.react(p_slug text, p_visitor uuid, p_value smallint, p_reason text default null)
returns table (likes bigint, dislikes bigint, my_value smallint)
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_ip   text := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  v_hash text := encode(extensions.digest('gul-blog:' || v_ip, 'sha256'), 'hex');
  v_recent int;
begin
  if p_value not in (-1, 0, 1) then raise exception 'invalid value'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{0,119}$' then raise exception 'invalid slug'; end if;

  select count(*) into v_recent from public.post_reactions
   where ip_hash = v_hash and updated_at > now() - interval '1 hour';
  if v_ip <> '' and v_recent >= 60 then raise exception 'rate_limited' using errcode = 'P0001'; end if;

  if p_value = 0 then
    delete from public.post_reactions r where r.slug = p_slug and r.visitor = p_visitor;
  else
    insert into public.post_reactions as r (slug, visitor, value, reason, ip_hash)
    values (p_slug, p_visitor, p_value, nullif(left(trim(p_reason), 600), ''), v_hash)
    on conflict (slug, visitor) do update
      set value = excluded.value,
          reason = case
                     when excluded.reason is not null then excluded.reason
                     when r.value = excluded.value then r.reason
                     else null
                   end,
          ip_hash = excluded.ip_hash,
          updated_at = now();
  end if;

  return query
    select count(*) filter (where r.value = 1),
           count(*) filter (where r.value = -1),
           (select r2.value from public.post_reactions r2 where r2.slug = p_slug and r2.visitor = p_visitor)
    from public.post_reactions r
    where r.slug = p_slug;
end
$$;

revoke all on function public.reaction_counts(text[]) from public;
revoke all on function public.react(text, uuid, smallint, text) from public;
grant execute on function public.reaction_counts(text[]) to anon, authenticated;
grant execute on function public.react(text, uuid, smallint, text) to anon, authenticated;

-- Owner-only summary for the Supabase dashboard (not exposed to the API).
create or replace view public.reaction_summary with (security_invoker = true) as
  select slug,
         count(*) filter (where value = 1)  as likes,
         count(*) filter (where value = -1) as dislikes,
         count(*) filter (where reason is not null) as with_feedback,
         max(updated_at) as last_vote
  from public.post_reactions
  group by slug
  order by likes desc;
revoke all on public.reaction_summary from anon, authenticated;
