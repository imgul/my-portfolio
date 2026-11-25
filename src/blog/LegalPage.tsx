/**
 * /privacy, /terms and /cookies. Written from what the code actually does:
 * no cookies, no analytics, a handful of localStorage keys, and Supabase only
 * for likes / dislikes. If you add a tracker, a form or a new storage key,
 * update these pages, LEGAL_UPDATED in ./legal.mjs, and CONSENT_VERSION in
 * src/lib/consent/consent.ts so visitors are asked again.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from './router'
import { setHead, legalHead } from './head'
import { LEGAL, LEGAL_UPDATED, type LegalId } from './legal.mjs'
import { useHydrated } from './hydrated'
import { visitorId } from './store'
import { toast } from './components/ui'
import { CONSENT_VERSION, openConsent, saveConsent, useConsent } from '../lib/consent/consent'
import { clearRecommendationHistory } from './recommendation-history'

const EMAIL = 'iigulzaib@gmail.com'
const updatedLabel = new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>

/* ---------------------------------------------------------------- privacy */

function Privacy() {
  return (
    <>
      <h2 id="who">Who runs this site</h2>
      <p>
        gulzaib.vercel.app is my personal site: a portfolio and a blog called Gul’s Notebook. I’m Muhammad Gulzaib, a software engineer in Islamabad, Pakistan. I decide what happens to the little data
        the site handles, so in data-protection language I’m the controller. Any question about this page goes to <Mail />.
      </p>

      <h2 id="collect">What I collect</h2>
      <div className="b-table" tabIndex={0} role="region" aria-label="What the site collects">
        <table>
          <thead>
            <tr>
              <th scope="col">What</th>
              <th scope="col">When</th>
              <th scope="col">Where it goes</th>
              <th scope="col">How long</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Request logs: IP address, browser, page, time</td>
              <td>Every visit, on any website</td>
              <td>Vercel, which hosts the site</td>
              <td>A short period set by Vercel. I don’t export or combine them.</td>
            </tr>
            <tr>
              <td>A like or dislike, the post, a random visitor ID and a hash of your IP</td>
              <td>Only when you press like or dislike</td>
              <td>My Supabase database</td>
              <td>Until you take the vote back, or ask me to delete it</td>
            </tr>
            <tr>
              <td>The reason you type after a vote (600 characters at most)</td>
              <td>Only if you write one</td>
              <td>The same database. Only I can read it.</td>
              <td>Same as the vote</td>
            </tr>
            <tr>
              <td>Your email address and message</td>
              <td>If you email me, or use the newsletter box (it opens your own mail app)</td>
              <td>My Gmail inbox</td>
              <td>While the conversation is useful. Ask and I’ll delete it.</td>
            </tr>
            <tr>
              <td>Post activity used for suggestions: active reading estimates, saves, search matches, votes and share attempts</td>
              <td>After you accept optional storage and use those features</td>
              <td>Your browser only; not sent to me for recommendations</td>
              <td>Up to 100 entries; ignored after 90 days and removed on the next update or when you clear them</td>
            </tr>
            <tr>
              <td>The address of a link you hover</td>
              <td>When a link preview card loads</td>
              <td>The site’s own preview function, which fetches that public page</td>
              <td>Not stored by me</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>That’s the whole list. There’s no sign-up and no account, and I never ask for your name.</p>

      <h2 id="dont">What I don’t do</h2>
      <ul>
        <li>No analytics: no Google Analytics, no Vercel Analytics, no heatmaps, no session recording.</li>
        <li>No advertising, no ad networks and no tracking pixels.</li>
        <li>No selling or sharing data with anyone for marketing.</li>
        <li>No third-party fonts or scripts. The fonts are served from this domain, so Google never hears about your visit.</li>
        <li>
          No social media widgets. Share buttons are plain links that open the other site only when you click them. A post with a video loads it from youtube-nocookie.com only after you press play.
        </li>
      </ul>

      <h2 id="recommendations">Personalised suggestions</h2>
      <p>
        If you choose <em>Accept</em>, this browser keeps a separate suggestion history of post IDs, activity type, time and a small strength value. It records estimated reading engagement, saves, search result matches,
        votes and attempts to share or copy a link. A share attempt does not mean you completed a share. The suggestion history does not contain the words you searched for or a share destination.
      </p>
      <p>
        To estimate active reading, the page uses scroll position and signals from pointer movement, touch, the mouse wheel and navigation keys. Time counts only while the article is visible, the tab is focused
        and there has been recent input; it stops after 30 seconds without input and is capped per visit. This is an estimate, not proof that you read. Raw movements, coordinates, keys and time measurements are not stored or sent;
        only a derived reading or brief-visit strength may enter the suggestion history. A brief visit is weak evidence, not a dislike, and short or inactive visits do not count against you.
      </p>
      <p>
        The site ranks available posts on this device using topic overlap, category, series, the kind and recency of activity, and variety among results. It avoids recommending posts marked fully read, saved or
        disliked in that history; dislikes also lower related topics, while brief visits have a much smaller effect. A reason may appear beside a suggestion. Without optional storage, you get non-personalised suggestions.
        No recommendation profile is sent to my server, linked to your visitor ID, used for ads or used to make decisions about you beyond ordering these posts. This history starts after consent and does not import earlier activity.
      </p>
      <p>
        The history holds at most 100 entries. Entries older than 90 days are ignored and removed on the next history update. Use <em>Clear suggestion history</em> on the blog or below to delete it without
        deleting your saved posts and reading positions. Choose <em>Essential only</em> to stop this feature and delete optional storage. The separate recent-search list can contain the actual search terms;
        searches placed in a URL may also appear in ordinary server logs if you load or share that URL.
      </p>

      <h2 id="visitor-id">The visitor ID</h2>
      <p>
        The first time you open the blog, your browser makes a random ID, something like <code>3f6c…a91e</code>, and keeps it in local storage. It isn’t linked to your name, email, or device. When you
        vote, the ID goes along with the vote so the site can show which way you voted, let you change it, and stop one browser from voting twice on the same post. You can see yours on the{' '}
        <Link href="/cookies#your-data">Cookie Policy</Link> page.
      </p>

      <h2 id="ip">Your IP address and the rate limit</h2>
      <p>
        When you vote, the database stores a SHA-256 hash of your IP address, never the address itself. It uses the hash for one thing: refusing more than 60 votes an hour from the same network, which
        keeps bots from stuffing the counts. A hash like this can still be matched against a known address, so I treat it as personal data and don’t use it for anything else.
      </p>

      <h2 id="processors">Who else handles it</h2>
      <p>Three companies run the services this site depends on. Each has its own privacy policy:</p>
      <ul>
        <li>
          <Ext href="https://vercel.com/legal/privacy-policy">Vercel</Ext> hosts the pages and the link-preview function.
        </li>
        <li>
          <Ext href="https://supabase.com/privacy">Supabase</Ext> runs the database that holds votes and feedback.
        </li>
        <li>
          <Ext href="https://policies.google.com/privacy">Google</Ext> runs Gmail, if you email me.
        </li>
      </ul>
      <p>Their servers may be outside Pakistan, for example in the United States or the European Union.</p>

      <h2 id="basis">Why I’m allowed to use it</h2>
      <p>If you’re in the EU or the UK, the GDPR asks me to name a legal basis for each use:</p>
      <ul>
        <li>Request logs and the vote rate limit: legitimate interest in keeping the site online and free of spam.</li>
        <li>Votes, feedback and emails: consent. You choose to send them, and you can take them back.</li>
        <li>
          Optional browser storage (recent searches, suggestion history and the link-preview cache): consent, given with the <em>Accept</em> button.
        </li>
      </ul>

      <h2 id="rights">Your rights</h2>
      <p>
        You can ask me to show you what I hold about you, correct it, or delete it, and you can object to any use above. Write to <Mail />. For a vote or feedback, include your visitor ID from the{' '}
        <Link href="/cookies#your-data">Cookie Policy</Link> page, because without it I have no way to find your row. I reply within 30 days, usually within a few. If you think I’ve handled your data
        badly, you can also complain to the data-protection authority where you live.
      </p>

      <h2 id="children">Children</h2>
      <p>The site isn’t made for children under 13, and I don’t knowingly collect anything from them. If you think a child has sent me something, tell me and I’ll delete it.</p>

      <h2 id="security">Security</h2>
      <p>
        Every page is served over HTTPS. The votes table can’t be read through the public API at all: the site can only call two database functions, one that adds or removes your own vote and one that
        returns totals.
      </p>

      <h2 id="changes">Changes to this policy</h2>
      <p>
        When I change something that matters, I update the date at the top of this page and the cookie notice asks you again. Older versions are in the site’s{' '}
        <Ext href="https://github.com/imgul/my-portfolio/commits/main/src/blog/LegalPage.tsx">public Git history</Ext>.
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ terms */

function Terms() {
  return (
    <>
      <h2 id="use">Using the site</h2>
      <p>
        Read anything here for free, for personal or work use. Please don’t try to break it: no attacks on the servers or the preview function, no scraping hard enough to slow the site down, and no
        scripted votes or spam in the feedback box. Search engines and AI crawlers are welcome, as set out in <a href="/robots.txt">robots.txt</a>.
      </p>

      <h2 id="ownership">Who owns what</h2>
      <div className="b-table" tabIndex={0} role="region" aria-label="Who owns what">
        <table>
          <thead>
            <tr>
              <th scope="col">Content</th>
              <th scope="col">Licence</th>
              <th scope="col">What you can do</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>AI Research, Engineering and Writing posts</td>
              <td>
                <Ext href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</Ext>
              </td>
              <td>Share, translate or adapt them, commercially too, as long as you credit me and link to the original post</td>
            </tr>
            <tr>
              <td>Founder posts</td>
              <td>All rights reserved</td>
              <td>Quote short passages with my name and a link. Ask me before republishing a whole post.</td>
            </tr>
            <tr>
              <td>Code samples and SQL downloads</td>
              <td>MIT</td>
              <td>Use them in anything, with no warranty</td>
            </tr>
            <tr>
              <td>Site design, cover art, the 3D scene, sounds, photos, my name and logos</td>
              <td>All rights reserved</td>
              <td>Ask first, unless a post says otherwise</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Each post shows its own licence at the bottom. Product names like Laravel, React or Supabase belong to their owners. I mention them only to describe what I use.</p>

      <h2 id="advice">Not professional advice</h2>
      <p>
        Posts describe what I built, what I saw and what I think. They aren’t legal, financial, tax or other professional advice. Rules such as school fee regulations change, so check the official
        source before you rely on a number. Test code samples before you put them in production.
      </p>

      <h2 id="feedback">Feedback you send</h2>
      <p>
        If you leave feedback after a vote or email me an idea, I may use it to fix or improve a post or the site, without owing you anything. I won’t publish your words under your name without asking
        you first.
      </p>

      <h2 id="links">Links to other sites</h2>
      <p>
        I link to other sites when they help, and preview cards show their titles and images. I don’t control those sites, and a link isn’t an endorsement of everything on them. Their own terms apply
        once you’re there.
      </p>

      <h2 id="availability">Availability</h2>
      <p>This is a personal site. I can change, move or remove any page at any time, and I can’t promise it will always be online or free of mistakes.</p>

      <h2 id="liability">Liability</h2>
      <p>
        As far as the law allows, I’m not liable for any loss that comes from using the site or relying on what it says. Nothing in these terms takes away rights that the law in your country gives you
        and doesn’t let anyone waive.
      </p>

      <h2 id="law">Governing law</h2>
      <p>These terms are governed by the laws of Pakistan. Any dispute goes to the courts in Islamabad.</p>

      <h2 id="changes">Changes to these terms</h2>
      <p>
        If I change them, the date at the top changes too. Using the site after that means you accept the new version. Questions go to <Mail />.
      </p>
    </>
  )
}

/* ---------------------------------------------------------------- cookies */

const STORAGE: { key: string; what: string; when: string; needed: boolean }[] = [
  {
    key: 'gul:consent',
    what: 'Your answer to the cookie notice, and the date',
    when: 'When you answer it',
    needed: true,
  },
  {
    key: 'gul:blog-prefs',
    what: 'Reader settings: theme, text size, font, line spacing, motion, link previews, sounds, vibration',
    when: 'When you change a setting',
    needed: true,
  },
  {
    key: 'gul:blog-reader',
    what: 'Your random visitor ID, saved posts, where you stopped reading, and your own votes',
    when: 'When you open the blog',
    needed: true,
  },
  {
    key: 'gul:blog-view',
    what: 'Grid or list view on the blog index',
    when: 'When you switch views',
    needed: true,
  },
  {
    key: 'gul:sound-theme-v3',
    what: 'The sound theme on the portfolio',
    when: 'When you pick one',
    needed: true,
  },
  {
    key: 'gul:recent-searches',
    what: 'Your last five blog searches',
    when: 'After you accept',
    needed: false,
  },
  {
    key: 'gul:recommendations:v2',
    what: 'Up to 100 post IDs, activity types, times and derived strengths for suggestions; entries are ignored after 90 days',
    when: 'After you accept and interact with posts or search',
    needed: false,
  },
  {
    key: 'gul:lp:v2',
    what: 'A cache of link previews, kept up to 14 days so cards open faster',
    when: 'After you accept',
    needed: false,
  },
]

function Cookies() {
  return (
    <>
      <h2 id="none">Cookies: none</h2>
      <p>
        No part of this site creates a cookie, and there are no third-party scripts that could add one. You can check: open your browser’s developer tools on any page and look under Storage, then
        Cookies. The list for gulzaib.vercel.app is empty.
      </p>

      <h2 id="storage">What’s in your browser’s storage</h2>
      <p>
        The site does use local storage. It works much like a cookie, with one difference: your browser never sends it to my server. Everything below stays on your device, apart from the visitor ID,
        which travels with a vote when you cast one.
      </p>
      <div className="b-table" tabIndex={0} role="region" aria-label="Items in local storage">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">What it holds</th>
              <th scope="col">Saved</th>
              <th scope="col">Type</th>
            </tr>
          </thead>
          <tbody>
            {STORAGE.map((s) => (
              <tr key={s.key}>
                <td>
                  <code>{s.key}</code>
                </td>
                <td>{s.what}</td>
                <td>{s.when}</td>
                <td>{s.needed ? 'Essential' : 'Optional'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Essential here means something you asked for stops working without it: your theme would reset on every page, and saved posts would vanish. Optional items support recent searches, link-preview caching and personalised suggestions.
      </p>

      <h2 id="choices">What the buttons do</h2>
      <ul>
        <li>
          <strong>Accept</strong> allows the optional items too. The notice goes away and doesn’t come back.
        </li>
        <li>
          <em>Essential only</em> deletes the optional items and stops them being saved. The notice goes away for good this way as well.
        </li>
      </ul>
      <p>The notice only returns if this policy changes in a way you should know about. You can change your answer below at any time.</p>

      <h2 id="third-parties">Other sites</h2>
      <p>
        Two features can make your browser talk to another site. A link preview card may load the linked page’s image or icon straight from that site, with no referrer sent. A video loads from
        youtube-nocookie.com only after you press play, and from then on YouTube’s own policy applies. Neither sets a cookie on this domain.
      </p>

      <h2 id="your-data">Your choice and your data</h2>
      <StoragePanel />

      <h2 id="clear">Clearing it yourself</h2>
      <p>
        Every browser can delete a single site’s data. In Chrome or Edge, click the icon left of the address, then Site settings, then Delete data. In Firefox, go to Settings, Privacy &amp; Security,
        Manage Data. In Safari, go to Settings, Privacy, Manage Website Data. A private window keeps nothing after you close it.
      </p>
    </>
  )
}

/** Live view of this browser's consent and data (client only, so pre-rendered HTML stays stable). */
function StoragePanel() {
  const hydrated = useHydrated()
  const consent = useConsent()
  const [id, setId] = useState('')
  useEffect(() => {
    if (hydrated) setId(visitorId())
  }, [hydrated])

  if (!hydrated) return <div className="b-legal__panel is-loading" aria-hidden="true" />

  const choose = (c: 'all' | 'essential') => {
    saveConsent(c)
    toast(c === 'all' ? 'Saved: accepted' : 'Saved: essential only')
  }
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id)
      toast('Visitor ID copied')
    } catch {
      toast('Couldn’t copy. Select the ID and copy it by hand.')
    }
  }
  const clearAll = () => {
    if (!window.confirm('Delete everything this site saved in this browser? Your theme, saved posts, reading positions and votes on this device will reset.')) return
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('gul:')) localStorage.removeItem(k)
    } catch {
      /* storage blocked: nothing to clear */
    }
    location.reload()
  }

  return (
    <div className="b-legal__panel">
      <dl>
        <div>
          <dt>Your answer</dt>
          <dd>
            {consent ? (consent.choice === 'all' ? 'Accepted' : 'Essential only') : 'Not answered yet'}
            {consent?.at ? ` (${new Date(consent.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, policy v${CONSENT_VERSION})` : ''}
          </dd>
        </div>
        <div>
          <dt>Your visitor ID</dt>
          <dd>
            <code className="b-legal__id">{id || 'none yet'}</code>
          </dd>
        </div>
      </dl>
      <div className="b-legal__actions">
        <button type="button" className="b-btn is-sm" onClick={() => choose('all')} aria-pressed={consent?.choice === 'all'}>
          Accept
        </button>
        <button type="button" className="b-btn is-sm is-ghost" onClick={() => choose('essential')} aria-pressed={consent?.choice === 'essential'}>
          Essential only
        </button>
        {id && (
          <button type="button" className="b-btn is-sm is-ghost" onClick={copyId}>
            Copy visitor ID
          </button>
        )}
        <button type="button" className="b-btn is-sm is-ghost" onClick={() => (clearRecommendationHistory(), toast('Suggestion history cleared'))}>
          Clear suggestion history
        </button>
        <button type="button" className="b-btn is-sm is-ghost is-danger" onClick={clearAll}>
          Delete all site data
        </button>
      </div>
      <p className="b-legal__hint">
        To remove a vote from my database as well, email the visitor ID to <Mail />. Deleting the data here only clears this browser.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------- page */

const LEDE: Record<LegalId, ReactNode> = {
  privacy: (
    <>
      No ads, analytics or cookies. With your permission, post suggestions use activity stored on this device. Hosting requests, link previews, votes, emails and sharing with other sites can involve other services; this page explains each one.
    </>
  ),
  terms: <>These terms cover gulzaib.vercel.app, both the portfolio and Gul’s Notebook. They’re short because the deal is simple: I write, you read, and nobody pays anybody.</>,
  cookies: <>This site sets no cookies. It does keep a few items in your browser’s local storage, and this page lists every one of them, with the switch to turn the optional ones off.</>,
}
const BODY: Record<LegalId, () => ReactNode> = {
  privacy: Privacy,
  terms: Terms,
  cookies: Cookies,
}

export default function LegalPage({ id }: { id: LegalId }) {
  const meta = LEGAL.find((p) => p.id === id)!
  const Body = BODY[id]
  useEffect(() => {
    setHead(legalHead(meta))
  }, [meta])
  return (
    <main id="main" className="b-research b-legal" tabIndex={-1}>
      <header className="b-research__head">
        <nav aria-label="Breadcrumb">
          <ol className="b-crumbs">
            <li>
              <a href="/">Home</a>
            </li>
            <li>
              <span aria-current="page">{meta.title}</span>
            </li>
          </ol>
        </nav>
        <h1>{meta.title}</h1>
        <p className="b-lede">{LEDE[id]}</p>
        <p className="b-legal__updated">
          Last updated <time dateTime={LEGAL_UPDATED}>{updatedLabel}</time>
        </p>
      </header>
      <article className="b-prose b-legal__body">
        <Body />
      </article>
      <nav className="b-legal__more" aria-label="Legal pages">
        {LEGAL.map((p) =>
          p.id === id ? (
            <span key={p.id} aria-current="page">
              {p.title}
            </span>
          ) : (
            <Link key={p.id} href={p.path}>
              {p.title}
            </Link>
          ),
        )}
        <button type="button" className="b-legal__settings" onClick={openConsent}>
          Cookie settings
        </button>
      </nav>
    </main>
  )
}
