# Research brief: “Fee vouchers, not dashboards: what schools pay for”

Post 1 of the content plan (`docs/CONTENT_PLAN_DEC_2026.md`). Researched 24 November 2026.

**Status:** published as `src/blog/posts/fee-vouchers-not-dashboards.mdx` with option 1 from section 8 (`date: 2026-05-01`, `updated: 2026-11-24`, opening note). First-person lines are limited to what Gul had already published; replace the request table with real counts from the call sheet when available.

| | |
|---|---|
| Working title | Fee vouchers, not dashboards: what schools pay for (50 chars) |
| Alt SEO title | What Pakistani schools pay for in school software (49 chars) |
| Slug | `fee-vouchers-not-dashboards` |
| Category / licence | Founder / all-rights-reserved (default; no DOI or Scholar metadata) |
| Primary query | school management software features Pakistan |
| Requested date | 1 May 2026 (see section 8 before deciding) |

---

## 1. The angle in one sentence

Pakistani private schools pay for the jobs that bring money in and keep parents calm (fee vouchers that match their own fee rules, a defaulter list they can trust, absence and fee messages in Urdu), and they ignore the analytics dashboards most vendors lead their demos with.

The post backs that up three ways:

1. **Gul’s own calls and visits** for Oxygen LMS: the ranked list of requests, the clerk who asked where to print the voucher, and what each person in the office asked for.
2. **What the market already sells:** vendor pages and price lists converge on vouchers, challans and reconciliation (section 4).
3. **Published research on dashboards:** school leaders use them far less than designers hope (section 5).

## 2. Search intent and what currently ranks

**Who searches this:** school owners, principals and admin heads comparing software, plus founders and developers building for schools. Intent is commercial investigation (“which one, what should it have”).

**What ranks now:** nearly every result is a vendor page or a vendor’s own “top 5” list. Each one names itself best, and each has the same FAQ schema:

- MjFour
- Claslo
- NeoSkolera
- PakEduSystem / PakEducate
- Schooliee
- StudentCare
- EduSuite

Global results (clast.io, openeducat, myappacademia) are generic feature checklists with no local context.

**The gap:** no result is a first-hand, vendor-neutral account from someone who interviewed schools and wrote down what they asked for and paid for. That is the post. It won’t outrank vendor landing pages for the head term in week one. It can win the long-tail questions and AI answers:

- “what features do schools in Pakistan need”
- “what should a fee voucher include”
- “do schools use dashboards”
- “school software Urdu SMS”

**Supporting terms to use naturally, not stuffed:**

- fee voucher / fee challan
- bank challan reconciliation
- defaulter list
- sibling (family) voucher
- concessions and arrears
- late fee fine
- 1Bill consumer number
- Raast QR
- absentee SMS in Urdu
- result card
- school management system Pakistan

## 3. Overlap with existing posts (avoid cannibalising them)

Two live posts already touch this story:

| Post (date) | What it already says | How post 1 differs |
|---|---|---|
| `simple-wins` (2026-10-26) | Opens with the clerk who asked “Where do I click to print the fee voucher?” and “She didn’t need a dashboard.” Then UX principles. | Post 1 is about **what schools buy and why**, with the ranked request list, voucher anatomy and rules. Retell the clerk moment in two lines at most, or tell it fully here and leave simple-wins as the UX follow-up. |
| `distribution-beats-features` (2026-10-05) | The cold-calling process; one bullet says fee collection and parent communication came up most. | Post 1 is the full answer to that bullet: counts, examples and what it meant for the product. |

**Rule:** post 1 must carry facts neither of those has (counts from the call log, a redacted voucher, the request ranking), or Google will treat the three as near-duplicates and pick one.

## 4. What the market sells (evidence that vouchers are the product)

Read from vendor pages on 24 Nov 2026. **These are today’s prices; they can’t be confirmed for May 2026** except where marked.

| Vendor | What the page leads with | Published price |
|---|---|---|
| MjFour | “Fee vouchers reflect the concessions and arrears your school actually applies”, bank challans that reconcile, absentee SMS in Urdu the same morning | Bands to 400 students (not listed in snippet) |
| Schooliee | “Printed challans, cash in two clicks, 1Bill payments and a live defaulter list”, one challan per family with every sibling on it | Rs 8 per student per month (Rs 38,400 a year for 400 students) |
| StudentCare | 1LINK 1Bill and Raast QR printed on the challan, late fine auto-applied | n/a |
| Claslo | Attendance, fee challans, homework diary, parent portal | Rs 2,500/month to 1,000 students; Rs 5,000 to 2,500 |
| NeoSkolera | Voucher-based fee billing and unpaid-fee tracking | Rs 2,000 to 20,000/month. Lifetime: **Rs 120,000 basic vs Rs 180,000 for the package that adds fee vouchers and the unpaid-fee report** |
| PakEducate | Fees, attendance, results, Urdu | From Rs 1,500/month to 75 students (also on its blog in March and April 2026 ✅) |

**What this shows:** every local vendor puts vouchers, challans and the defaulter list first. NeoSkolera even charges Rs 60,000 more for the licence that includes vouchers. Dashboards appear as a line item at most. Use this as supporting evidence, kept short and fair. Don’t attack named vendors.

**What a voucher has to handle,** according to those vendor pages and what Gul should confirm from his visits:

- **Separate fee heads:** tuition, transport by route, lab, library, exam, annual.
- **Adjustments:** concessions, scholarships, staff-child rates, sibling discounts.
- **Carry-overs:** arrears and late fines.
- **Family vouchers:** one voucher per family, listing every sibling.
- **Copies:** bank copy, school copy and parent copy, in the school’s own bank format.
- **Payment details:** a 1Bill consumer number or Raast QR, so parents can pay from Easypaisa, JazzCash or any bank app.
- **Reconciliation:** bank receipts matched against issued vouchers, which is what makes the defaulter list trustworthy.

## 5. Facts and sources

✅ means the source was published on or before 1 May 2026, so it can be cited in a post dated then. ❌ means it was published later.

### The market

| Fact | Source | Pub. date | May-safe |
|---|---|---|---|
| 58.33 million students enrolled in 2023–24; 27.05 million (46%) in private institutions | [Pakistan Education Statistics 2023–24, PIE](https://pie.gov.pk/SiteImage/Publication/PES%202024.pdf) (table “Grand Total 58,331,078 / Private 27,053,079”) | 2025 | ✅ |
| Families now pay 56% of all education spending (Rs 2.8 trillion), including Rs 1.31 trillion in private school fees | I-SAPS report, via [Academia Magazine](https://academiamag.com/news/private-costs-soar-as-public-education-loses-ground-in-pakistan/) | Jan 2026 | ✅ |
| 40% of primary-age children attend low-fee private schools charging about Rs 400–800 a month (LEAPS data) | [RISE, “The Missing Link”](https://riseprogramme.org/sites/default/files/2022-09/Missing_Link_Low-Fee_Private_Tuition_PAKISTAN.pdf), citing Qureshi and Razzaque 2021 | 2022 | ✅ |
| Private schools grew because they keep fees very low | Andrabi, Das and Khwaja, [“A Dime a Day”](https://documents1.worldbank.org/curated/en/450421468284381096/pdf/wps4066.pdf), World Bank | 2006 | ✅ |
| Satellite and map data suggest private enrolment is undercounted (about 49%; 88% of Lahore schools are private) | [World Bank blog](https://blogs.worldbank.org/en/developmenttalk/why-aggregate-numbers-fail-pakistan-s-out-of-school-children) | Jun 2026 | ❌ |

**Margin pressure:** this is why fee collection is the owner’s top worry. Low fees and thin margins mean every unpaid voucher hurts.

### Rules a fee system must encode

| Fact | Source | Pub. date | May-safe |
|---|---|---|---|
| Islamabad (PEIRA): yearly increase capped at 5%; 6–8% only with approval; **no increase during the session**; fees charged **monthly**; late fine max 5% within 30 days and 10% within 60 | [Dawn, 14 Aug 2021](https://www.dawn.com/news/1640522) (fee policy of 6 Aug 2021) | 2021 | ✅ |
| PEIRA 2024 rules (S.R.O. 179(I)/2025, gazetted 20 Feb 2025) repeat the cap and require **60 days’ written notice** of new fees and an official receipt | Summarised by [pakera.pk](https://pakera.pk/complain-private-school-fee-islamabad/) | Oct 2026 | ❌ source (rule itself is from 2025; cite the gazette if found) |
| Senate committee says several Islamabad schools raised fees up to 12%, beyond PEIRA’s limit | [ProPakistani](https://propakistani.pk/2025/10/07/senate-panel-orders-private-schools-to-revise-unjustified-fee-increases/) | Oct 2025 | ✅ |
| Supreme Court (June 2019) upheld the Sindh 5% annual cap and the 2017 fee baseline | [Dawn, 13 Jun 2019](https://www.dawn.com/news/1487909) | 2019 | ✅ |
| Punjab corrected its 8% notification to 5% after the 2019 judgment; schools above Rs 4,000/month had to reissue vouchers | [The News, 7 Jul 2020](https://www.thenews.com.pk/print/683180-private-school-fee-case-school-fee-hike-notification-corrected-court-informed) | 2020 | ✅ |
| Sindh 2026–27: June and July fees may be collected in April and May, but **each month needs its own voucher**; no fees from matric students beyond March 2026 | [TechJuice](https://www.techjuice.pk/sindh-sets-new-private-school-fee-rules-for-2026-27-session/) | 23 Apr 2026 | ✅ |

**Product point:** a voucher system is a rules engine. Capped increases, no mid-session changes, capped late fines, one voucher per month and notice periods are why spreadsheets break and why owners pay. Dashboards don’t help with any of these.

⚠️ **Search trap:** “Punjab caps fee hike at 5%” results from June–August 2026 are about **Indian** Punjab (Bhagwant Mann government). Don’t cite them.

### How parents pay and get messages

| Fact | Source | Pub. date | May-safe |
|---|---|---|---|
| 92% of formal retail payments were digital in Oct–Dec 2025; Raast P2M payments rose to 33.6 million, with 2.1 million merchants onboarded | SBP Q2 FY26 review, via [The Nation](https://www.nation.com.pk/20-Mar-2026/sbp-releases-report-payment-systems-oct-dec-quarter) and [Mettis](https://mettisglobal.news/Pakistans-digital-payments-hit-3bn-transactions-in-Q2-FY26-59156) | Mar 2026 | ✅ |
| 117 million internet users (45.6%), 194 million mobile connections, Oct 2025 | DataReportal Digital 2026 Pakistan (cited by several outlets; link the DataReportal page directly) | early 2026 | ✅ |
| About 100 million WhatsApp users and 12 billion messages a day (PTA chairman to the NA IT committee) | [ProPakistani](https://propakistani.pk/2026/11/03/pakistan-has-100-million-whatsapp-users/) | Nov 2026 | ❌ |
| Parents in the twin cities report 20–40% increases, new vouchers “every few months”, and a Rs 2,500 late surcharge | [Express Tribune](https://tribune.com.pk/story/2631726/parents-decry-rising-private-school-fees) | Sep 2026 | ❌ |

### Why dashboards go unused

| Fact | Source | Pub. date | May-safe |
|---|---|---|---|
| Systematic review: educators and the public use data dashboards less than designers hope; use improves when dashboards fit existing workflows; evidence of impact is thin | Curran, Carlo and Harris-Walls, “Making the Data Visible”, *Review of Educational Research* 96(1), [doi:10.3102/00346543241288249](https://doi.org/10.3102/00346543241288249) | online Dec 2024 | ✅ |
| Principals in Pakistani private schools valued technology most for administration, more than for teaching; barriers were teacher readiness, cost, school culture and infrastructure | [Oxford ORA, “The Role of Technology in Pakistani Private Schools”](https://ora.ox.ac.uk/objects/uuid:8fed636a-f58c-4c25-836a-66fb43dd8e23/files/m7fbea4cceca7ddcd930167acc0c5d939) | pre-2026 | ✅ |
| A low-cost private school pilot in Islamabad: outages and internet cuts disrupted the digital tools | [BERA blog](https://www.bera.ac.uk/blog/bridging-the-digital-divide-in-low-resource-contexts-lessons-from-a-pakistani-school) | Nov 2025 | ✅ |

### Gul’s own earlier words (the best source of all)

His LinkedIn post about Oxygen LMS ([profile](https://www.linkedin.com/in/gulzaib-ai), around Dec 2025) already contains the post’s thesis in his voice:

> “She looked exhausted. … Attendance? Report cards? We got another problem.” “Everyone was ‘digitized.’ Nobody was actually helped.” “Not another bloated dashboard. A tool that finally works like schools actually work.”

Paste the full text of that post into the voice-note transcript and build from it.

## 6. Questions for Gul’s voice note (12–15 minutes)

Answer out loud, in any order. Specific beats complete.

1. How many schools did you call, and how many did you visit, roughly between which months? Which cities?
2. Open your call log. What did schools ask for most? Count it if you can: fee vouchers, defaulter list, SMS/WhatsApp, result cards, attendance, timetable, dashboards.
3. Tell the clerk story again, with the details you remember: the school, the screen you showed, what she asked, what you did next.
4. What did the **owner** ask, what did the **principal** ask, and what did the **clerk** ask? Where did they disagree?
5. Walk through a real fee voucher you saw: the fee heads, sibling discount, arrears, late fine, bank copy. What surprised you?
6. How do parents pay today at the schools you saw: bank branch, 1Bill, Easypaisa or JazzCash, or cash at the desk? How does the school find out who paid?
7. What does month-end look like in the office? How long does it take to print vouchers and make the defaulter list?
8. A feature you built or demoed that nobody cared about. Why do you think it fell flat?
9. The moment a school said yes (or nearly yes). What tipped it?
10. Did fee rules (5% cap, no mid-session change, late fine limits) come up? Did any school mention PEIRA?
11. What would you tell another founder building school software in Pakistan, in one sentence?

**Asset to add (10 minutes):**

- A redacted photo of a real fee voucher, with the name, roll number and amounts blurred.
- The request counts from your call sheet, as a small table.

## 7. Proposed shape

- **Opening (`<TLDR>`):** the angle in two or three sentences, plus your count (“Of N schools I spoke to, M asked about fee vouchers first”).
- **H2 “What do schools in Pakistan pay for first?”:** the ranked request table from your log.
- **H2 “What goes on a fee voucher?”:** a labelled image of the redacted voucher, then a short list of fee heads, sibling voucher, arrears and late fine.
- **H2 “Why can’t a spreadsheet do it?”:** the rules from section 5 as a small table, in your words.
- **H2 “Who in the school decides?”:** owner, principal and clerk, as a three-row table of what each asked for.
- **H2 “Why don’t schools use dashboards?”:** your observation first, then one line citing Curran et al. Keep the research in the background.
- **H2 “How do parents pay now?”:** challan at the bank vs 1Bill/Raast, plus the SBP figure.
- **H2 “What I built first because of this”:** the Oxygen LMS decision.
- **FAQ (3):**
  - “What features should school management software have in Pakistan?”
  - “What should a school fee voucher include?”
  - “How much does school management software cost in Pakistan?” (only if you are happy citing ranges with the date checked)
- **References:** PIE, SBP, Dawn 2021 (PEIRA), Dawn 2019 (Supreme Court), Curran et al. (DOI), plus one of the LEAPS papers.
- **Length:** 1,100–1,400 words.

**JSON-LD:** BlogPosting and FAQPage are generated automatically from frontmatter. No manual schema.

**Internal links** depend on the date (see section 8).

## 8. The 1 May 2026 date

Gul joined Oxygen LMS full time in January 2026 and the prototype was underway in December 2025, so school conversations by May 2026 fit his real timeline. The post itself, though, will be written and first seen by search engines in late 2026. Here is what dating it 1 May 2026 changes, so the choice is an informed one:

| Area | Effect of `date: 2026-05-01` |
|---|---|
| Penalty risk | Low for a single post. Google’s spam actions target scale and low value, not one date. Google may still decide the date itself, since the URL first appears in late 2026. |
| Sitemap | `lastmod` would say 2026-05-01 for a URL first seen in December. Google says it stops trusting `lastmod` on sites where it is inaccurate, which weakens the signal for **every** post. Fix: set `updated:` to the real publish day. |
| Where readers see it | It sorts below every post from June to November, on the blog index and in RSS. Most subscribers and visitors won’t see it as new. |
| AI citations | Perplexity and similar engines favour recent pages. A May date makes it look seven months old on day one. |
| Content | It may only use facts published before May (the ✅ rows). It can’t link to `distribution-beats-features` or `simple-wins` from the body, because those come later. Those posts can link back to it instead. |
| Scholarly record | No issue: Founder posts are all-rights-reserved, so no DOI or Scholar metadata is created. Don’t add a DOI. |
| House rules | `AGENTS.md` says never backdate. This post would be a recorded exception. |

**Three ways to do it:**

1. **Honest May (only if true):** if Gul wrote notes, a draft or a LinkedIn post about this in or around May 2026, keep `date: 2026-05-01`, add `updated:` with the real publish day, and open with “I first wrote these notes in May 2026, after …”. This is accurate and keeps the sitemap truthful.
2. **Field notes, published now:** use the real date and frame the time in the text (“From the school visits I made in spring 2026”). Best for ranking and AI citations, and it keeps the existing internal links.
3. **Plain backdate:** `date: 2026-05-01` with nothing else. It works technically, but it carries the sitemap, discovery and freshness costs above with no upside a reader or search engine will see.
