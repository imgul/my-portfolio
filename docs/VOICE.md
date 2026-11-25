# Gul’s writing voice

Read this before drafting, editing or reviewing anything published under Muhammad Gulzaib’s name. It describes how he writes, taken from the posts in `src/blog/posts/`. The aim is to keep *his* sentences, not to imitate him.

## The one rule

**Posts are made from Gul’s own words.** He talks a post through (voice note, call, dictation); an agent cuts, orders and formats that transcript. Agents may write headings, captions, table labels, link text, and short joins between his sentences, roughly one sentence in eight at most. Agents do not write sections. See `.agents/skills/voiceprint/SKILL.md` for the method and the reason (text reads as human in proportion to how many of the author’s own sentences survive).

## How he sounds

- **First person, specific, local.** “When I visited schools for Oxygen LMS…”, “Assalam o Alaikum, I’m Gulzaib…”. Real places (Islamabad, Lahore, Burewala), real products (Oxygen LMS, AnySub, ZeroExam AI, SynergyFlow Labs, Sehat Bunyad), real people described by role (“an admin clerk”, “the owner”).
- **Plain words.** “Fee voucher”, “print”, “call every afternoon”. No corporate filler (the list is below).
- **Short and long sentences mixed.** A long sentence that explains, then a short one that lands: “She didn’t need a dashboard. She needed one button, every month, without thinking.”
- **Admits what failed.** “The first version of my script was a feature list. It failed.” Numbers and mistakes beat claims.
- **Opinions with a reason.** He takes a side and says why, in one line.
- **Answer first.** Every post opens with `<TLDR>` that a reader could stop after.

## Punctuation and format

- Typographic quotes and apostrophes (’ “ ”) are house style. Keep them.
- **No em dashes** in prose. Use a full stop, a comma, a colon or brackets.
- Colons introduce a list or an example: “Three ways in: …”.
- Bold only for the one phrase a skimmer must see in a paragraph, never as list labels on every item.
- Tables for anything with numbers or options. `<Callout>`, `<Steps>`, `<Timeline>`, `<ProsCons>` from `src/blog/components/mdx.tsx` where they fit the content.
- British/Pakistani English spelling is fine (“organise”, “colour”) but stay consistent within a post.

## What he never writes

<!-- slop-ignore-start: the examples below quote the patterns on purpose -->

The full list lives in `.agents/skills/humanizer/SKILL.md` and `.agents/skills/stop-slop/references/`. The ones that slip in most often:

- “It’s not X, it’s Y” and “not just X, but Y”. State Y.
- “Here’s the thing”, “The truth is”, “Let’s dive in”, “In today’s fast-paced world”, “At the end of the day”.
- “Pivotal”, “testament”, “delve”, “landscape”, “seamless”, “game-changer”, “unlock the power”.
- A dramatic one-line paragraph after every section.
- Ending on “the future looks bright” or a motivational line. End on the last useful fact or the next step.

<!-- slop-ignore-end -->

`npm run lint:slop` and `npm run lint:blog` catch these automatically.

## Before/after (from his own posts)

> ❌ “Distribution plays a crucial role in the success of any SaaS product in today’s competitive landscape.”
>
> ✅ “Schools in Pakistan don’t discover software through Product Hunt or Google Ads. Decisions are made by a principal or an owner who is busy, cautious and gets pitched by a lot of people.”

> ❌ “It’s not about features. It’s about simplicity.”
>
> ✅ “‘My staff can’t use complicated software’ was one of the most common objections.”
