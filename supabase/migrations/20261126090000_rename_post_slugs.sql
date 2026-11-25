-- Four posts moved to keyword URLs (old URLs 301 to the new ones in vercel.json).
-- Carry their reactions over so like/dislike counts survive the rename.
-- Apply when the rename is deployed, not before: the live site still reads the old slugs until then.
update public.post_reactions set slug = 'designing-for-non-technical-users' where slug = 'simple-wins';
update public.post_reactions set slug = 'how-to-write-a-readme' where slug = 'readme-people-read';
update public.post_reactions set slug = 'validate-saas-idea' where slug = 'code-is-not-a-business';
update public.post_reactions set slug = 'selling-software-to-schools' where slug = 'distribution-beats-features';
