-- Move reactions after the full-title URLs are deployed, never before.
-- Keep the latest vote if a visitor has rows at multiple old or new URLs.
with slug_map(old_slug, new_slug) as (
  values
    ('agents-that-do-work', 'agents-that-do-real-work-a-pragmatic-multi-agent-design'),
    ('ai-features-in-laravel-queues-streaming', 'shipping-ai-features-in-laravel-without-blocking-your-app'),
    ('designing-for-non-technical-users', 'simple-wins-designing-for-the-least-technical-user-in-the-room'),
    ('fee-vouchers-not-dashboards', 'fee-vouchers-not-dashboards-what-schools-pay-for'),
    ('how-i-write-technical-posts', 'how-i-write-technical-posts-a-field-guide-with-examples'),
    ('how-to-write-a-readme', 'write-a-readme-people-actually-read'),
    ('laravel-agent-guard-setup', 'setting-up-laravel-agent-guard-budgets-loops-kill-switch'),
    ('laravel-agent-guard', 'laravel-agent-guard-why-your-laravel-ai-agents-need-brakes'),
    ('multi-tenant-laravel-saas', 'multi-tenant-laravel-saas-the-architecture-i-actually-use'),
    ('rag-for-exam-generation', 'grounded-exam-generation-with-rag-retrieval-and-evaluation'),
    ('school-erp-database-design', 'designing-the-database-for-a-school-erp'),
    ('selling-software-to-schools', 'distribution-beats-features-notes-from-cold-calling-schools'),
    ('validate-saas-idea', 'code-is-not-a-business-what-20-paying-customers-taught-me'),
    ('simple-wins', 'simple-wins-designing-for-the-least-technical-user-in-the-room'),
    ('readme-people-read', 'write-a-readme-people-actually-read'),
    ('code-is-not-a-business', 'code-is-not-a-business-what-20-paying-customers-taught-me'),
    ('distribution-beats-features', 'distribution-beats-features-notes-from-cold-calling-schools')
), latest as (
  select distinct on (m.new_slug, r.visitor)
    m.new_slug as slug, r.visitor, r.value, r.reason, r.ip_hash, r.created_at, r.updated_at
  from public.post_reactions r
  join slug_map m on r.slug = m.old_slug
  order by m.new_slug, r.visitor, r.updated_at desc, r.slug
)
insert into public.post_reactions as existing (slug, visitor, value, reason, ip_hash, created_at, updated_at)
select slug, visitor, value, reason, ip_hash, created_at, updated_at from latest
on conflict (slug, visitor) do update
  set value = excluded.value, reason = excluded.reason, ip_hash = excluded.ip_hash,
      created_at = excluded.created_at, updated_at = excluded.updated_at
  where excluded.updated_at > existing.updated_at;

delete from public.post_reactions where slug in (
'agents-that-do-work', 'ai-features-in-laravel-queues-streaming', 'designing-for-non-technical-users', 'fee-vouchers-not-dashboards', 'how-i-write-technical-posts', 'how-to-write-a-readme', 'laravel-agent-guard-setup', 'laravel-agent-guard', 'multi-tenant-laravel-saas', 'rag-for-exam-generation', 'school-erp-database-design', 'selling-software-to-schools', 'validate-saas-idea', 'simple-wins', 'readme-people-read', 'code-is-not-a-business', 'distribution-beats-features'
);
