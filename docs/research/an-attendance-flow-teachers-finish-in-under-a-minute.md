# Research brief: attendance flow for teachers

Researched 25 November 2026 for the 3 December Engineering post. The post is a design proposal, not a description of Oxygen LMS’s production implementation. No teacher timing, interview, screenshot or measured claim was supplied. The title’s one-minute threshold is a target to test, not a demonstrated outcome.

## Sources and decisions

| Source | What it supports | Design implication |
| --- | --- | --- |
| [Attendance Works: high-quality attendance data](https://www.attendanceworks.org/high-quality-attendance-data-is-more-important-than-ever/) | Recommends a neutral default and a way to detect missing submissions. | Keep unmarked and submitted registers distinct; require deliberate confirmation. |
| [Arbor: teacher register](https://support.arbor-education.com/hc/en-us/articles/115000298325-How-can-a-teacher-take-attendance) | Supports present, absent and late marks and an explicit “Mark All Blanks as Present” action. | Allow bulk confirmation after checking, without treating an untouched roster as proof of presence. |
| [MDN: Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) | Background Sync has limited browser availability and requires a secure context. | Retry on app open or reconnect as well; do not promise automatic sync after close. |
| [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) | Best-effort browser storage can be evicted; writes can exceed quota. | Distinguish a local pending save from a server-confirmed save and handle storage failures. |
| [Stripe: idempotent requests](https://docs.stripe.com/api/idempotent_requests) | Documents retrying the same request under the same key and rejecting mismatched parameters. | Propose a separate operation ID and payload fingerprint; version checking still handles competing edits. This is an analogy, not a claim that Stripe powers the register. |
| [W3C: what’s new in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) | Target Size (Minimum) is 24 by 24 CSS pixels, subject to exceptions. | Label controls, support keyboard use and test larger touch targets. |
| [ICO: Edtech examined statement](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/06/ico-statement-on-edtech-examined-report/) | UK audits identified weaknesses in data minimisation and retention. | Limit student data and define retention with each school. UK guidance is not described as Pakistani law. |

## Verification and limitations

The sample register and proposed server contract are illustrative. The design requires an incomplete draft state, explicit completion, an atomic idempotency record, a roster and permission check, plus conflict review for stale versions. It has not been implemented or tested with teachers. The suggested test records class size, device, connection, completion distribution and accuracy instead of presenting an invented result.
