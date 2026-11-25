# Blog recommendations

The blog index and the end of each post use the same on-device, content-based ranker. This is a set of transparent heuristics, not a trained model, collaborative filtering or a claim that suggestions are proven to improve engagement. The published catalogue is small; changing weights should be evaluated against real scenarios and a wider catalogue before claiming a quality improvement.

## Reader choice and data

- `Accept` optional storage enables `gul:recommendations:v1`. No recommendation history is read or written before consent, or after choosing `Essential only`. Consent version 2 asks readers again after this change.
- Signals start after consent. They record a post slug, event type, timestamp and strength for reading milestones, saving, matching a search, liking or disliking, and attempting to share or copy a link. A share attempt does not establish that a share completed. The profile stores neither raw search terms nor share destinations. The separate optional `gul:recent-searches` list can contain raw terms.
- A search records up to three matching post slugs. The index waits for the query to settle; the search dialog records on selecting a result. Unmatched searches add no recommendation signal. Input is never sent to a recommendation service.
- There is at most one entry per post and signal type, up to 100 total. Entries older than 90 days are ignored and removed on the next write. Corrupt, future-dated, duplicated, unknown and oversized stored data is rejected or bounded. Browser storage is local to that browser and device.
- `Clear suggestion history` removes only this profile; saved posts and reading positions remain. `Essential only` removes all optional keys and stops new collection. Controls are on the recommendations section, cookie notice and cookie policy page. Cross-tab consent and storage changes are observed. With blocked storage, the site uses the non-personalised fallback.
- No account, cross-device sync, recommendation API, recommendation analytics, external model, user identifier or server-side recommendation profile is added. Existing hosting, link previews, votes and external share destinations are separate; see `/privacy` and `/cookies`.

## Ranking

`src/blog/recommendations.ts` works only with the supplied post catalogue. Drafts and scheduled posts are excluded, as are the current post and posts marked saved, completed or disliked in the optional profile. The existing local saved/reading store is not imported into the optional profile, including after a reset.

For each candidate, the ranker combines:

1. A content similarity score: inverse-frequency-weighted shared tags, title-token overlap, category and series. Rare shared tags have more influence than ubiquitous ones.
2. Signals weighted by type and strength, with a 30-day half-life. Likes, saves and share attempts are stronger than search matches; dislikes are negative. Search matches can recommend the matched post itself. Profile weight is normalised with a floor so old or weak isolated activity fades instead of remaining dominant.
3. On a post, similarity to that post and a boost for the next part of the same series. A small bounded freshness/featured prior supports a cold start.
4. Greedy re-ranking that penalises similarity to already selected recommendations. Date and slug provide deterministic tie-breaks.

The strongest positive signal supplies a short reason; search reasons never echo the query. Without eligible history, ranking uses context or the freshness/featured fallback and does not claim personalisation. If every post is excluded, the section is omitted. No filtering applies to the main catalogue or explicit search results.

## Checks

Run `npm run test:recommendations` on Node 22 and `LINK_PREVIEWS=off npm run build`. Browser checks should cover both consent choices, a fresh profile, saved/read/shared and searched posts, clear and revoke, another tab, storage denied, incomplete profiles and responsive/light/dark rendering. Confirm the network receives no recommendation profile. The policy pages and consent text must change whenever these data flows or retention rules change.
