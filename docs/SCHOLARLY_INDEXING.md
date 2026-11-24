# Getting the blog cited and indexed (free)

This guide gets Gul’s Notebook posts into the systems researchers use: ORCID, Crossref DOIs, Google Scholar, Semantic Scholar, OpenAlex, IEEE and the rest. Every step is free.

**What the blog already does (no action needed):**

| Feature | Who reads it |
| --- | --- |
| Highwire Press `citation_*` and Dublin Core `DC.*` meta tags on open posts | Google Scholar, Zotero, Mendeley, Semantic Scholar, BASE, CORE |
| schema.org `ScholarlyArticle` + `Person` with your ORCID iD (`identifier`, `sameAs`) | Google, Bing, AI assistants, Rogue Scholar (commonmeta) |
| A PDF of every post (`/blog/<slug>.pdf`) with title, author, ORCID, abstract and “Cite as” on page 1 | Google Scholar (`citation_pdf_url`), Zenodo/OSF/ResearchGate uploads, readers |
| “Cite this post” in APA, MLA, Chicago, IEEE, Harvard, BibTeX and RIS, plus downloadable `.bib` / `.ris` | Readers, reference managers |
| Open-access Atom feed with full text, licence, ORCID and DOIs: `/feeds/open-access.xml` | Rogue Scholar (DOIs), feed readers |
| Reference lists with DOIs (`references[].doi`) | Crossref citation tracking (via Rogue Scholar) |
| `/blog/research`: your identifiers, open posts, how to cite, reuse policy | People, Google (ProfilePage) |
| `sitemap.xml`, `robots.txt` (AI crawlers welcome), `llms.txt`, IndexNow key | Search engines and AI assistants |

**Licensing (decided):** AI Research, Engineering and Writing posts are **CC BY 4.0** (open access, reuse with credit). Founder posts are **all rights reserved** and are deliberately left out of Scholar tags, the open-access feed and DOI registration. Change the rule in `src/blog/scholar.mjs` (`OPEN_CATEGORIES`) or per post with `license:` in the frontmatter. A CC BY licence can’t be withdrawn from copies people already have, so switching a post back later only affects future use.

**Adding a profile to the blog:** paste its URL into `PROFILES` in `src/blog/scholar.mjs`. It then appears in the author card, on `/blog/research`, in JSON-LD `sameAs` and as `rel="me"`.

---

## Step 1: ORCID (you have it). Finish the profile (10 min)

Your iD: https://orcid.org/0009-0000-8709-6989. It's already on every post, in every PDF and in all metadata.

1. Sign in at orcid.org. Set your name, **Biography** and **Keywords** (e.g. retrieval-augmented generation, AI agents, SaaS architecture, Laravel, technical writing) to visibility **Everyone**.
2. **Websites & social links:** add `https://gulzaib.vercel.app/blog/research` (“Research & citation”) and `https://gulzaib.vercel.app` (“Portfolio”).
3. **Employment:** SynergyFlow Labs (Founder & CEO). Add education too.
4. **Works → Add → Search & link:** connect **Crossref Metadata Search** and **DataCite**. From then on, any DOI that lists your ORCID iD (Rogue Scholar and Zenodo both do) arrives in your ORCID inbox. Approve the permission request once and new works are added automatically.

## Step 2: Rogue Scholar (free DOIs for every open post) ★ most important

[Rogue Scholar](https://rogue-scholar.org) is a free archive for science and technical blogs. It registers a **Crossref DOI** for each post within minutes of publishing, keeps a long-term copy (including in the Internet Archive) and sends the metadata (title, ORCID, references, licence) to Crossref. From there it flows to **ORCID** and to indexes built on Crossref data, such as **OpenAlex**, **Semantic Scholar**, Dimensions and Scilit (each on its own schedule), and Crossref tracks who cites your posts.

Requirements, all met: full-text feed ✓, CC BY licence ✓, an author and a date on every post ✓, at least 6 posts over at least 6 months ✓ (6 open posts, Nov 2025 to Nov 2026), and human-written content ✓.

1. Open rogue-scholar.org and use **Register your blog** (link in the footer).
2. Blog URL: `https://gulzaib.vercel.app/blog`. **Feed URL: `https://gulzaib.vercel.app/feeds/open-access.xml`.** Do not use `/rss.xml`, which also contains the all-rights-reserved Founder posts.
3. Give your ORCID iD and a short description (AI systems, software engineering, technical writing). Pick the category Computer and information sciences.
4. Once you're accepted (they may email a question or two), each new open post gets a DOI like `10.59350/xxxxx-xxxxx`. Then run:

   ```bash
   npm run blog:dois        # looks up every open post in the Rogue Scholar API and writes doi: into its frontmatter
   git commit -am "Add DOIs" && git push
   ```

   The DOI then appears on the post, in every citation format, the PDF, `citation_doi`, `rel="cite-as"` and JSON-LD.
5. Approve the ORCID inbox notification (Step 1.4) and the posts appear under Works.

## Step 3: Google Scholar

Be realistic here. Google Scholar mostly indexes journals, repositories and preprint servers, and rarely adds personal blogs on its own, even with perfect metadata (which this blog now has). The reliable routes are:

1. **Create a profile:** scholar.google.com → My profile. Add affiliation and interests, verify an email if you have an institutional one (optional), and make the profile public.
2. **Add posts by hand:** on your profile, **+ → Add article manually** for each open post (type: *Other*, publisher: Gul’s Notebook, date, URL or DOI). They count toward your profile right away.
3. **Let DOIs and repositories do the rest:** Crossref-registered posts (Step 2) and Zenodo or TechRxiv copies (Steps 4–5) are the sources Scholar actually crawls. When it finds them, it suggests them on your profile.
4. Set up **Follow → New citations** to get alerts when someone cites you.

Then paste your profile URL into `PROFILES` (`google-scholar`).

## Step 4: Zenodo (CERN's repository; free DataCite DOIs, indexed by Google Scholar and OpenAIRE)

Use Zenodo for things that aren't already covered by a Rogue Scholar DOI, so the same text doesn't end up with two DOIs:

- **Longer research write-ups or reports** (e.g. a fuller version of the RAG evaluation): upload the PDF as *Publication → Report* or *Preprint*, licence CC BY 4.0, creator with your ORCID iD. Under *Related works*, add the post URL with the relation *Is identical to*/*Is variant form of*.
- **Code:** connect GitHub (zenodo.org → GitHub) and every tagged release of a public repo gets a citable DOI.
- Sign in with ORCID, then create a **Community** (e.g. “Gul’s Notebook”) to group your uploads.

Approve the DataCite ORCID permission and the uploads appear in ORCID. Add the profile URL as `zenodo`.

## Step 5: IEEE (your account is enough; no membership needed)

- **Link ORCID to your IEEE account:** in IEEE Account → Profile, look for the ORCID / “Associate ORCID” option (IEEE asks authors for it at submission anyway). This ties anything you publish with IEEE to your iD.
- **IEEE Collabratec** (free with your IEEE account): create a profile, link ORCID and add your publications (DOIs) and interests. Add the URL as `ieee-collabratec`.
- **TechRxiv** (IEEE's free preprint server, CC BY, DOI): for research-grade manuscripts, not blog posts copied verbatim. A good candidate is a 6–8 page paper version of *Grounded exam generation with RAG* with an evaluation section. TechRxiv preprints are indexed by Google Scholar and can be linked from IEEE Xplore when the paper is later published. Add the URL as `techrxiv`.
- **IEEE Xplore** only lists work published in IEEE conferences and journals. Getting there means submitting a paper (registration fees or APCs usually apply; some workshops and student venues are cheap or free).

## Step 6: Semantic Scholar and OpenAlex (automatic, then claim)

Both pick up Crossref and DataCite DOIs automatically, a few weeks after Step 2 or Step 4.

- **Semantic Scholar:** search your name, open your author page and use **Claim author page** (follow its verification steps). Add the URL as `semantic-scholar`.
- **OpenAlex:** search `openalex.org` for your name or ORCID. Your author ID (`https://openalex.org/A…`) is linked to ORCID automatically. Add it as `openalex`.

## Step 7: Optional profiles

- **ResearchGate, Academia.edu:** create profiles. Add each open post as *Preprint/Other* with its PDF and DOI, and follow people in your field. These help with reach more than with indexing.
- **OSF** (osf.io): a free project page for datasets, prompts and evaluation code behind a post.
- **arXiv** (cs.IR, cs.CL, cs.SE): papers only, and first-time submitters need an endorsement.
- **Wikidata:** only add an item for yourself if you meet its notability policy.

## Step 8: Search engines (15 min, once)

1. **Google Search Console:** add the property `https://gulzaib.vercel.app` (verify with an HTML file in `public/` or a DNS record) and submit `https://gulzaib.vercel.app/sitemap.xml`.
2. **Bing Webmaster Tools:** import the site from Search Console. Bing powers ChatGPT search and Copilot.
3. After each deploy with new or changed posts, run `npm run blog:indexnow` so Bing, Yandex, Seznam and Naver re-crawl within minutes.

## Each time you publish

1. Write the post (`docs/BLOG_GUIDELINES.md`). For research posts, cite sources with `references` (include `doi:` whenever the work has one) and `<Cite id>`.
2. `npm run lint:blog`, then `npm run build` and check `dist/blog/<slug>.pdf`.
3. Push (Vercel deploys), then `npm run blog:indexnow`.
4. About 15 minutes later, run `npm run blog:dois`, then commit and push. Approve the ORCID inbox item.
5. Google Scholar: add the post to your profile (Step 3.2).
6. Share it: LinkedIn, X, relevant communities, and newsletters in your field. Citations follow readers.
