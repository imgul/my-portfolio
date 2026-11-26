# December 2026 posting plan

The calendar plans posts for Gul’s Notebook across December 2026. Scheduled posts become eligible at midnight Islamabad time; the daily publishing workflow runs at 09:07, although another production build can publish them earlier. Original experience and useful evidence make each post stronger.

- **Voice guide:** [`docs/VOICE.md`](VOICE.md)
- **Post rules:** [`docs/BLOG_GUIDELINES.md`](BLOG_GUIDELINES.md)
- **Agent rules:** [`AGENTS.md`](../AGENTS.md)

---

## 1. Decisions and why

### Real dates, scheduled ahead (no backdating)

Write in batches, give each post its future date, and let the site publish it on the day. A future-dated post stays out of every production file until its date ([`isPublished`](../scripts/blog.mjs)). [`.github/workflows/publish-scheduled.yml`](../.github/workflows/publish-scheduled.yml) redeploys each morning a post is due, then pings IndexNow.

Backdating 30 posts into past months was considered and rejected:

| What backdating would try to do | What actually happens |
|---|---|
| Make the blog look older | Google estimates a page’s date from several signals, not only the one you print. A new URL that first appears in the sitemap today, with a commit from today, is new whatever its byline says. Mismatched signals weaken the date instead of moving it. |
| Look “fresh” or “established” | Google’s helpful-content guidance asks whether you change dates to make pages seem fresh, and answers that it won’t help. Its byline-date guidance says dates must describe when the page was published or updated. |
| Avoid looking like a content dump | Publishing 30 pages in one deploy, all dated in the past, is the pattern the scaled-content-abuse policy describes. One reviewed post a day is the opposite pattern. |
| Get more AI citations | Perplexity in particular favours recent pages. A post honestly dated this week beats the same post dated last spring. |

**The one honest exception:** a piece Gul really published earlier somewhere else (a LinkedIn post, a talk, a client write-up). It can keep that original date if the post says so in the first lines, e.g. “First posted on LinkedIn on 12 March 2026; expanded here.” Use `updated:` for the expansion date.

### No “detector evasion”

Nothing here tries to trick AI detectors, and nothing promises a detector score. Independent tests put false-positive rates between about 3% and 26% depending on the tool, so a fully human post can still be flagged. Google says it does not rank pages by how they were produced. It acts on low-value content at scale.

The approach that holds up is to make the post genuinely Gul’s:

1. His spoken words make up most of the text (the `voiceprint` method).
2. It contains facts nobody else has: his numbers, screenshots, schemas, quotes from real calls.
3. The `humanizer` and `stop-slop` checks run as a final edit to remove the habits that make any writing sound machine-made.

### The “100/100” bar, made checkable

| Gate | Tool | Pass |
|---|---|---|
| Content quality and guidelines | `npm run lint:blog` | 0 errors, 0 warnings |
| AI tells | `npm run lint:slop -- src/blog/posts/<slug>.mdx` | score ≥ 95 |
| Technical SEO, OG image, JSON-LD | `npm run build` (runs `seo:check`) | 0 errors, 0 warnings |
| Social cards | opengraph.to on the live URL | 100 (already 100 for posts) |
| Answer-first | `<TLDR>` answers the title in ≤ 3 sentences | a reader can stop there |
| Original value | one asset per post that exists nowhere else | named in the brief below |
| Evidence | every number has a source; claims about tools link to docs | references + `<Cite>` |
| Internal links | ≥ 2 links to other posts | lint checks broken ones |

---

## 2. What the research says

| Finding | Source | What the plan does |
|---|---|---|
| AI-assisted content is allowed. Many pages made mainly to rank, with little value, break the scaled-content-abuse policy however they were produced. | Google: [generative AI content guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content), [spam policies](https://developers.google.com/search/docs/essentials/spam-policies#scaled-content) | One reviewed post a day, each with an original asset |
| Byline dates are estimated from several signals. Visible and structured dates must match and describe real publication. | Google: [byline dates](https://developers.google.com/search/docs/appearance/publication-dates), [helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Real dates; `updated:` only for real edits |
| Google’s AI features run on core Search ranking. No special file or schema is required to appear in them. | Google Search Central, summarised by [eyesift](https://www.eyesift.com/blog/google-ai-content-guidelines/) | Normal SEO done well; llms.txt is a bonus, not a strategy |
| 44% of LLM citations come from the first 30% of a page. Original data and first-hand phrasing (“I tried”, “after 6 months”) get cited. | [Leapd 2026](https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026), [Digital Applied Q2 2026](https://www.digitalapplied.com/blog/ai-search-citation-analysis-q2-2026-domains-ranked) | TL;DR first; every post carries a number or artefact from Gul’s work |
| Perplexity cites when one page answers the exact question; first citations took 5 days to 10 weeks. | [Khorana, 6-month study](https://gautamkhorana.com/blog/llm-citations-study-2026/) | One post per question; titles phrased the way people ask |
| AI detectors misfire often (roughly 3–26% false positives, worse for non-native English writers). | [AI Busted](https://blog.aibusted.com/ai-detectors-2026-test-results/), [Paper Checker](https://hub.paper-checker.com/blog/ai-detection-false-positive-rates-tools-2026/) | Don’t chase detector scores; make the writing his |
| Text reads as human roughly in proportion to how much of the author’s own wording survives; style passes on model prose don’t fix it. | `voiceprint` skill (measured on its author’s own articles) | Record, then cut; agents don’t compose sections |

---

## 3. How each post gets made (about 45 minutes of Gul’s time)

1. **Brief (agent, 0 min of Gul).** Copy the day’s brief below into a scratch note.
2. **Talk it through (Gul, 12–15 min).** Answer the brief’s questions out loud, as if explaining to one person. Phone voice memo or Google Docs voice typing. Aim for about 2,000 spoken words for a 1,500-word post.
3. **Cut, don’t compose (agent).** Use the `voiceprint` skill: keep his sentences, remove repetition and false starts, order them under headings. At most one sentence in eight is new, and only joins.
4. **Add the asset (Gul, 10 min).** The screenshot, table, schema, code or numbers named in the brief.
5. **Structure for search and AI (agent).** `<TLDR>` from his clearest answer, question-style H2s, `faq:` from questions readers really ask, references for every external claim, two internal links. Skills: `answer-first`, `seo`, `ai-seo`, `schema`.
6. **Clean-up pass (agent, flags only).** `humanizer` and `stop-slop` list the tells; fix them by re-using his own wording from the transcript, not by inventing new sentences.
7. **Gates.** `npm run lint:blog`, `npm run lint:slop -- <file>`, `npm run build`.
8. **Gul reads it aloud once (10 min).** Anything he wouldn’t say, he rewords.
9. **Schedule.** Set `date:` to the day in the calendar, commit, merge. It goes live by itself.

**Batching:** record the coming week’s seven posts on Saturday (about 90 minutes), review on Sunday. Keep three posts ready ahead of schedule as a buffer.

**If a day isn’t ready, skip it.** A gap is harmless. A thin post published to keep a streak is the one thing that hurts.

---

## 4. Calendar

Series keep readers moving between posts and give AI engines clusters of pages on one topic. “Founder lessons” continues from the three existing parts.

| # | Date | Category | Title | Primary search intent |
|---|---|---|---|---|
| 1 | Tue 1 Dec | Founder | ~~Fee vouchers, not dashboards~~ published 24 Nov (notes dated 1 May 2026). Slot open: pick a reserve topic | school management software features Pakistan |
| 2 | Wed 2 Dec | Engineering | ~~Designing the database for a school ERP~~ published 24 Nov (dated 2 May 2026, `designing-the-database-for-a-school-erp`). Slot open: pick a reserve topic | school management system database design |
| 3 | Thu 3 Dec | Engineering | ✅ [An attendance flow teachers finish in under a minute](/blog/an-attendance-flow-teachers-finish-in-under-a-minute), written and published | attendance app design for schools |
| 5 | Sat 5 Dec | Founder | [School software pricing: per student or per branch?](/blog/school-software-pricing-per-student-or-per-branch), published 26 Nov. Slot open: pick a reserve topic | how to price SaaS for schools |
| 6 | Sun 6 Dec | Engineering | WhatsApp fee reminders parents read (and reply to) | whatsapp business api school fee reminders |
| 7 | Mon 7 Dec | Engineering | Building web apps for load-shedding and slow 3G | offline first web app laravel react |
| 8 | Tue 8 Dec | AI Research | A rubric for judging AI-generated exam questions | evaluate AI generated exam questions |
| 9 | Wed 9 Dec | Engineering | What an AI feature costs: token maths for a SaaS | OpenAI API cost per user SaaS |
| 10 | Thu 10 Dec | AI Research | Voice agents in Urdu, Punjabi and Pashto: where they break | urdu speech recognition voice agent |
| 11 | Fri 11 Dec | Engineering | Reliable JSON from LLMs in PHP with structured outputs | openai structured outputs php laravel |
| 12 | Sat 12 Dec | AI Research | Grading written answers with AI: what worked, what didn’t | AI answer evaluation subjective exams |
| 13 | Sun 13 Dec | AI Research | The evals I run before shipping a prompt change | LLM prompt regression testing |
| 14 | Mon 14 Dec | AI Research | RAG over textbooks with tables, formulas and Urdu text | chunking PDF textbooks for RAG |
| 15 | Tue 15 Dec | Founder | Freelancer to studio: what changed when I stopped selling hours | freelancer to agency developer |
| 16 | Wed 16 Dec | Founder | [How I scope an MVP in one call: my question list](/blog/how-i-scope-an-mvp-in-one-call-my-question-list), published 26 Nov (dated 20 Aug by request). Slot open: pick a reserve topic | how to scope an MVP |
| 17 | Thu 17 Dec | Founder | Building AnySub in public: the first month in numbers | building in public SaaS numbers |
| 18 | Fri 18 Dec | Engineering | The data model behind a subscription tracker | subscription tracking database schema |
| 19 | Sat 19 Dec | Founder | Fixed price or retainer for AI projects? What I charge | how to price AI development projects |
| 20 | Sun 20 Dec | Founder | Applying to National Incubation Center Lahore: our notes | NIC Lahore application process |
| 21 | Mon 21 Dec | Founder | Projects I turned down and what each one taught me | when to turn down a software client |
| 22 | Tue 22 Dec | Engineering | Laravel queues in production: failures I’ve hit | laravel queue failed jobs production |
| 23 | Wed 23 Dec | Writing | Writing a software proposal clients sign | software development proposal template |
| 24 | Thu 24 Dec | Engineering | My code review checklist for junior Laravel developers | laravel code review checklist |
| 25 | Fri 25 Dec | Founder | Remote roles in the UAE and KSA from Pakistan: my notes | remote developer jobs UAE from Pakistan |
| 26 | Sat 26 Dec | Writing | Release notes customers read: how I write changelogs | how to write release notes SaaS |
| 27 | Sun 27 Dec | Engineering | My 2026 stack, and what I’d drop in 2027 | laravel react stack 2026 |
| 28 | Mon 28 Dec | Engineering | Hiring engineers in Pakistan: the take-home test I use | hiring software engineers Pakistan |
| 29 | Tue 29 Dec | AI Research | Logging every agent step in MySQL: observability on a budget | LLM agent observability logging |
| 30 | Wed 30 Dec | Writing | 30 posts in 30 days: traffic, citations and what I’d change | blogging every day results |

**Mix:** 11 Engineering, 9 Founder, 6 AI Research, 3 Writing. Sundays are shorter field notes (600–900 words); weekdays 1,000–1,600. The 4 December slot is removed; posts 1–3 and 5 are already published.

**Series:**
- School software topics: posts 1–3 and 5–7.
- “AI in production”: posts 8–14 and 29.
- “Founder lessons”: parts 4–9 are posts 15, 16, 17, 19, 20 and 21.

---

## 5. Briefs

Each brief lists what the TL;DR must answer, the questions to talk through, the asset that makes it original, and its links. **If Gul doesn’t have the experience a brief needs, swap in a reserve topic (section 6).** Never fill the gap with general knowledge.

### Week 1: Building Oxygen LMS

**1. Fee vouchers, not dashboards: what schools pay for** · `fee-vouchers-not-dashboards-what-schools-pay-for` · Founder, Building Oxygen LMS 1
- **TL;DR answers:** which features Pakistani private schools pay for first, and which ones they ignore.
- **Talk through:** the top requests from calls and visits, in order. A feature you built that nobody used. The moment a school agreed to pay, and what tipped it. What the owner, the clerk and the teachers each asked for.
- **Asset:** a ranked table of requests from your call log (count per request), plus a redacted fee voucher.
- **Links:** distribution-beats-features-notes-from-cold-calling-schools, simple-wins-designing-for-the-least-technical-user-in-the-room.
- **FAQ:** “What should a school management system include?” “Do schools pay for attendance software?”

**2. Designing the database for a school ERP** · `designing-the-database-for-a-school-erp` · Engineering, Building Oxygen LMS 2
- **TL;DR answers:** the core tables and relationships, and the two design choices you’d defend.
- **Talk through:** students vs enrolments vs sessions. How you model classes, sections and subjects across academic years. Fee heads, concessions, and partial payments. One migration you regretted.
- **Asset:** ER diagram (Mermaid or image) and two real migrations.
- **Links:** multi-tenant-laravel-saas-the-architecture-i-actually-use.

**3. An attendance flow teachers finish in under a minute** · `an-attendance-flow-teachers-finish-in-under-a-minute` · Engineering, school software · Written and published
- **Published angle:** a proposed attendance flow, with defaults, offline considerations and an idempotent backend design. The one-minute goal is not presented as a measured result.
- **Links:** simple-wins-designing-for-the-least-technical-user-in-the-room.

**5. School software pricing: per student or per branch?** · `school-software-pricing-per-student-or-per-branch` · Founder, school software · Written and published on 26 November
- **Angle:** A practical comparison of per-student, per-branch and size-band pricing for school software.
- **Includes:** Hypothetical PKR examples, publicly sourced vendor pricing, costs and contract terms to check. No unverified Oxygen LMS prices or customer anecdotes.
- **Links:** code-is-not-a-business-what-20-paying-customers-taught-me, distribution-beats-features-notes-from-cold-calling-schools.

**6. WhatsApp fee reminders parents read (and reply to)** · `whatsapp-fee-reminders` · Engineering, Building Oxygen LMS 6 (field note)
- **TL;DR answers:** how you send fee reminders over WhatsApp, what it costs, and what changed in payments.
- **Talk through:** SMS vs WhatsApp in your experience. Template approval. Message wording that worked. Opt-outs.
- **Asset:** the message template and a delivery/reply count.
- **References:** WhatsApp Business Platform docs (template messages, pricing).

**7. Building web apps for load-shedding and slow 3G** · `apps-for-load-shedding-and-3g` · Engineering, Building Oxygen LMS 7
- **TL;DR answers:** the techniques that kept the app usable during outages and on weak networks.
- **Talk through:** what broke first in the field. Local queueing of attendance. Payload sizes. Retries and conflict handling.
- **Asset:** network panel numbers before/after; the sync code.
- **Links:** shipping-ai-features-in-laravel-without-blocking-your-app.

### Week 2: AI in production

**8. A rubric for judging AI-generated exam questions** · `rubric-for-ai-exam-questions` · AI Research, AI in production 1
- **TL;DR answers:** the criteria and scale you use to accept or reject generated questions, with pass rates.
- **Talk through:** how teachers judged ZeroExam drafts. Common failure types. Inter-rater disagreement.
- **Asset:** the rubric table and pass/fail counts from a real batch.
- **Links:** grounded-exam-generation-with-rag-retrieval-and-evaluation.
- **References:** Bloom’s taxonomy source, one paper on automatic question generation evaluation.

**9. What an AI feature costs: token maths for a SaaS** · `ai-feature-token-costs` · Engineering, AI in production 2
- **TL;DR answers:** cost per user per month for one real feature, and the three levers that cut it.
- **Talk through:** your actual monthly bill for a feature. Caching, smaller models, batching. When you pass cost to customers.
- **Asset:** a cost table with your real token counts (prices linked to the provider’s pricing page with the date checked).
- **Links:** shipping-ai-features-in-laravel-without-blocking-your-app.

**10. Voice agents in Urdu, Punjabi and Pashto: where they break** · `urdu-punjabi-pashto-voice-agents` · AI Research, AI in production 3
- **TL;DR answers:** which parts of the speech-to-LLM-to-speech pipeline fail first in local languages, from your tests.
- **Talk through:** code-switching (Urdu with English words). Names and numbers. Latency on calls. Cost per minute.
- **Asset:** a small test table: phrases, what the model heard, error type.
- **References:** docs for the speech models you used.

**11. Reliable JSON from LLMs in PHP with structured outputs** · `llm-structured-outputs-php` · Engineering, AI in production 4
- **TL;DR answers:** how to get schema-valid JSON from an LLM in Laravel, and what to do when it still fails.
- **Talk through:** your before (regex parsing) and after. Validation. Retries. A real failure.
- **Asset:** working Laravel code and the JSON schema.
- **References:** the provider’s structured outputs docs.

**12. Grading written answers with AI: what worked, what didn’t** · `ai-grading-written-answers` · AI Research, AI in production 5
- **TL;DR answers:** how close AI grades got to a teacher’s grades in your R&D, and where it went wrong.
- **Talk through:** the setup, the marking scheme, agreement with human graders, handwriting/OCR issues.
- **Asset:** agreement numbers on your sample, with sample size stated.
- **Links:** rubric-for-ai-exam-questions, grounded-exam-generation-with-rag-retrieval-and-evaluation.

**13. The evals I run before shipping a prompt change** · `prompt-change-evals` · AI Research, AI in production 6 (field note)
- **TL;DR answers:** the small test set and checks you run before any prompt or model change goes live.
- **Talk through:** a regression you caught (or didn’t). Golden examples. How long the run takes.
- **Asset:** the eval script or test file.
- **Links:** agents-that-do-real-work-a-pragmatic-multi-agent-design.

**14. RAG over textbooks with tables, formulas and Urdu text** · `rag-over-textbooks` · AI Research, AI in production 7
- **TL;DR answers:** the chunking and parsing approach that worked on real syllabus PDFs.
- **Talk through:** what broke with naive chunking. Tables and formulas. Right-to-left text. Retrieval quality before/after.
- **Asset:** retrieval hit-rate before/after on your question set.
- **Links:** grounded-exam-generation-with-rag-retrieval-and-evaluation.

### Week 3: Running a studio and building in public

**15. Freelancer to studio: what changed when I stopped selling hours** · `freelancer-to-studio` · Founder lessons 4
- **TL;DR answers:** the concrete changes (pricing, clients, process) when you moved from freelancing to SynergyFlow Labs.
- **Talk through:** the month you decided. Your first productised offer. What you stopped doing. Revenue mix before/after (ranges are fine).
- **Asset:** a before/after table of how you sell and deliver.
- **Links:** code-is-not-a-business-what-20-paying-customers-taught-me.

**16. How I scope an MVP in one call: my question list** · `how-i-scope-an-mvp-in-one-call-my-question-list` · Founder · Written and published
- **Angle:** A proposed first-call question list, followed by validation and a conditional estimate.
- **Date:** 20 August 2026 requested; the guide was prepared and published on 26 November 2026, as noted in the post.
- **Asset:** Downloadable proposed scoping checklist; fictional examples are labelled.
- **Links:** simple-wins-designing-for-the-least-technical-user-in-the-room, code-is-not-a-business-what-20-paying-customers-taught-me.

**17. Building AnySub in public: the first month in numbers** · `anysub-month-one` · Founder lessons 6
- **TL;DR answers:** visitors, signups and what moved them in AnySub’s first month, with real numbers.
- **Talk through:** launch channels. What you shipped. What surprised you. What you’ll change.
- **Asset:** your analytics numbers and a chart. **Only publish with real data.** If AnySub isn’t at that stage yet, move this to January and pull a reserve topic.

**18. The data model behind a subscription tracker** · `subscription-tracker-data-model` · Engineering
- **TL;DR answers:** how AnySub models subscriptions, trials, renewals, currencies and budgets.
- **Talk through:** billing cycles that don’t fit months. Currency. Audit history. A schema change you had to make.
- **Asset:** schema diagram and migrations.
- **Links:** multi-tenant-laravel-saas-the-architecture-i-actually-use, anysub-month-one.

**19. Fixed price or retainer for AI projects? What I charge** · `pricing-ai-projects` · Founder lessons 7
- **TL;DR answers:** which model you use for which kind of AI project, and why.
- **Talk through:** a fixed-price project that went over. How you price uncertainty in LLM work. Running costs after launch.
- **Asset:** your decision table (project type → model → typical range, if you’re comfortable sharing ranges).
- **Links:** ai-feature-token-costs, scope-an-mvp-in-one-call.

**20. Applying to National Incubation Center Lahore: our notes** · `nic-lahore-application` · Founder lessons 8, field note
- **TL;DR answers:** what NIC Lahore’s process asked of Sehat Bunyad and what you’d prepare earlier.
- **Talk through:** the application, the pitch, the questions panels asked, timeline. Only what you’re free to share.
- **Asset:** a timeline of your actual dates and a prep checklist.
- **References:** NIC Lahore’s official page.

**21. Projects I turned down and what each one taught me** · `projects-i-turned-down` · Founder lessons 9
- **TL;DR answers:** the signals that make you say no, from real (anonymised) cases.
- **Talk through:** two or three projects you declined, the warning signs, and what happened later if you know.
- **Asset:** your “no” checklist.
- **Links:** scope-an-mvp-in-one-call.

### Week 4: Craft and career

**22. Laravel queues in production: failures I’ve hit** · `laravel-queue-failures` · Engineering
- **TL;DR answers:** the queue failures you’ve met in production and the fix for each.
- **Talk through:** timeouts vs retry_after, memory leaks in workers, jobs that ran twice, a 3 am incident.
- **Asset:** config snippets and a failure → cause → fix table.
- **Links:** shipping-ai-features-in-laravel-without-blocking-your-app.
- **References:** Laravel queue docs.

**23. Writing a software proposal clients sign** · `software-proposal-clients-sign` · Writing
- **TL;DR answers:** the sections and wording of a proposal that gets signed, from your own.
- **Talk through:** a proposal that won and one that lost. Pricing presentation. Scope exclusions.
- **Asset:** a redacted outline of a real proposal.
- **Links:** scope-an-mvp-in-one-call, how-i-write-technical-posts-a-field-guide-with-examples.

**24. My code review checklist for junior Laravel developers** · `laravel-code-review-checklist` · Engineering
- **TL;DR answers:** what you check in every review, in order, from mentoring at Exertlogics.
- **Talk through:** the mistakes juniors make most. How you give feedback. What improved team output.
- **Asset:** the checklist as a copyable list; a before/after code sample.
- **Links:** laravel-queue-failures.

**25. Remote roles in the UAE and KSA from Pakistan: my notes** · `remote-roles-uae-ksa` · Founder
- **TL;DR answers:** what you’ve learned so far about landing remote or relocation roles in the Gulf.
- **Talk through:** where you applied, what interviewers asked, time zones, contracts, payment. Only first-hand experience; say plainly what you don’t know yet.
- **Asset:** your application tracker stats (applications, replies, interviews).

**26. Release notes customers read: how I write changelogs** · `release-notes-customers-read` · Writing
- **TL;DR answers:** the format and tone of release notes that customers open and act on.
- **Talk through:** a release note that caused support tickets, one that reduced them. Who you write for.
- **Asset:** two real release notes, before and after.
- **Links:** write-a-readme-people-actually-read, how-i-write-technical-posts-a-field-guide-with-examples.

**27. My 2026 stack, and what I’d drop in 2027** · `my-stack-2026` · Engineering, field note
- **TL;DR answers:** the tools you use for each layer and the ones you plan to replace.
- **Talk through:** one tool you love, one you regret, costs per month.
- **Asset:** a stack table with cost and verdict.
- **Links:** most of the month’s engineering posts.

**28. Hiring engineers in Pakistan: the take-home test I use** · `hiring-engineers-take-home-test` · Engineering
- **TL;DR answers:** the test, how you grade it, and what predicted good hires.
- **Talk through:** a hire that worked, a test that misled you, time limits, paying for tests.
- **Asset:** the task description and grading rubric.
- **Links:** laravel-code-review-checklist.

### Wrap-up

**29. Logging every agent step in MySQL: observability on a budget** · `agent-step-logging-mysql` · AI Research, AI in production 8
- **TL;DR answers:** the table design and queries you use to trace, replay and cost agent runs.
- **Talk through:** a bug you found by replaying a run. Storage growth. What you’d move to a proper tracing tool.
- **Asset:** schema and three useful queries.
- **Links:** agents-that-do-real-work-a-pragmatic-multi-agent-design, prompt-change-evals.

**30. 30 posts in 30 days: traffic, citations and what I’d change** · `30-posts-in-30-days` · Writing
- **TL;DR answers:** what a month of daily posts did for impressions, clicks and AI citations, with real numbers.
- **Talk through:** which posts surprised you, time spent per post, what you’d stop doing.
- **Asset:** Search Console and Bing Webmaster numbers per post; the AI citation log (section 7). This is the most citable post of the month because nobody else has this data.

---

## 6. Reserve topics (swap in when a brief doesn’t fit)

- **Code-switching in prompts:** Roman Urdu vs Urdu script in user inputs (AI Research).
- **Moving a client from WordPress to Laravel:** what we kept (Engineering).
- **Shopify apps for Pakistani payment gateways:** what we learned (Engineering).
- **Teaching a non-technical co-founder to read a pull request** (Writing).
- **The first five customer support tickets for a new SaaS** (Founder).

---

## 7. Measure (weekly, 20 minutes)

- **Google Search Console:** impressions, clicks, average position per post. Check that each post is indexed within a week (URL Inspection).
- **Bing Webmaster Tools:** ChatGPT search and Copilot draw on Bing; check indexing and the IndexNow submissions.
- **AI citation log:** every Monday, ask ChatGPT (search on), Perplexity and Google AI Mode the primary query of each published post. Note whether gulzaib.vercel.app is cited. Keep it in a sheet; it feeds post 30.
- **Refresh rule:** if a post earns impressions but few clicks after 4 weeks, rewrite its title and TL;DR, add a real update, and set `updated:`.
