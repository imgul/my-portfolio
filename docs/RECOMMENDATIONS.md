# Blog recommendations

The blog index and end of each post use an on-device content-based ranker. These are conservative heuristics, not a trained model, a measurement of attention or a claim of improved engagement. Thresholds are starting points, not statistically calibrated values; evaluate changes against reader feedback and a wider catalogue.

## Reader choice and data

- Consent version 3 asks again before enabling the changed purpose. `Accept` enables `gul:recommendations:v2`; nothing is collected for this profile before consent or after `Essential only`. The earlier scroll-only v1 profile is not imported and is deleted when a choice is made. Essential saved posts and reading positions remain separate.
- Each entry contains a post slug, type, timestamp and bounded strength. Signals include estimated active reading and brief visits, saves, search matches, likes/dislikes and share or copy attempts. An attempt does not mean a share completed. Search terms and share destinations are not in the profile. The separate optional recent-search list can contain actual terms.
- Search records up to three matching post slugs: the index waits for input to settle; the search dialog records on result selection. Unmatched searches add nothing. No recommendation data is sent to a server, linked to the visitor ID, synced between devices or used for ads. Existing hosting, link previews, votes and external share destinations are separate; see `/privacy` and `/cookies`.
- One entry per post and type, at most 100 total. Entries older than 90 days are ignored and removed on the next write. Malformed, oversized, unknown and future-dated data is rejected; duplicates are reduced to the latest. `Clear suggestion history` removes this profile without deleting saved posts or reading positions and resets in-memory reading sessions. `Essential only` deletes optional keys and stops collection. Consent and clearing are observed across tabs; blocked storage falls back to unpersonalised results.

## Reading estimate and safeguards

The estimator runs only after opt-in while an article body is in view, its tab is visible and the document has focus. Trusted pointer movement/down, touch, wheel and navigation keys establish recent activity; typed content, coordinates, individual inputs and raw timing measurements are never persisted or transmitted. A scroll position and short-lived monotonic in-memory timer estimate depth and active duration. No interaction means no active time. Credit ends 30 seconds after the last input; hidden/unfocused tabs pause. Timer gaps over five seconds, negative or invalid times, and suspended devices are not credited. A visit contributes at most 20 minutes. This still cannot prove someone is reading; a reader may be attentive without interacting, or move a pointer without reading.

A positive signal needs at least 10 active seconds, two separate input bursts (at least four seconds apart), at least 12% depth and time spent in two depth bands; strength is quantised and capped at 0.75 until stricter completion criteria are met. Completion needs three input bursts, at least four bands with two seconds each, 95% depth, and active time of 40% of estimated reading time, clamped to 15–60 seconds. Estimated reading time is bounded to 1–30 minutes for these calculations. This prevents a quick jump to the end from counting as a completed recommendation read. The separate progress bar and Resume continue to reflect scroll position, not this estimate.

At page leave, two input bursts and 15 or more active seconds with 2–25% depth and less than half the estimated reading time can produce a weak `skim` signal. A very short, stationary or inactive visit is not penalised. A brief visit is not a dislike; it is a small, reversible adjustment and does not exclude the post. Later engaged reading removes it, and an existing positive read or like prevents it. Explicit dislikes are stronger, exclude that post, and lower related topics. Only successfully saved votes change the suggestion history; undoing a vote removes its signal, and a clear or consent change cancels an in-flight update. These rules avoid inferring disinterest from a quick click, an open tab, a hash jump or a backgrounded browser, but cannot eliminate all ambiguity.

## Ranking

The ranker only considers the supplied published catalogue. It excludes the current post and posts saved, strongly read or explicitly disliked in the optional profile. It never hides posts from search or the main catalogue. Each candidate combines:

1. Rare-tag-weighted overlap, title-token similarity, category and series.
2. Bounded, deduplicated signals weighted by type and strength with a 30-day half-life. Weak brief visits and stronger explicit dislikes decrease scores; positive reading, likes, saves, shares and search matches increase them. A single post's combined absolute influence is capped at 4, and a normalisation floor lets isolated older signals fade. Search matches can recommend themselves.
3. Context similarity, a next-series-part boost and small bounded freshness/featured priors.
4. Greedy diversity re-ranking, with deterministic date and slug tie-breaks.

Reasons describe the strongest positive contribution, or indicate an adjustment when only negative signals apply. Without eligible signals the ranker uses context or freshness; no personalisation is claimed. If every post is excluded, the section is omitted.

## Checks

Run `npm run test:recommendations` on Node 22 and `LINK_PREVIEWS=off npm run build`. Browser checks should cover consent, time with and without input, backgrounding, completion versus jumps, low-retention and vote reversal, reset and cross-tab opt-out, blocked storage, and responsive rendering. Check that raw activity and the recommendation profile never appear in network requests. Policy and consent text must change whenever data flows or retention rules change.
