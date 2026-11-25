# Research brief: “Designing the database for a school ERP”

Post 2 of the content plan (`docs/CONTENT_PLAN_DEC_2026.md`), series “Building Oxygen LMS”, part 2. Researched 24 November 2026.

**Status:** written as `src/blog/posts/school-erp-database-design.mdx`, scheduled for `date: 2026-12-02` (goes live through the daily publish workflow). First-person lines are limited to what Gul has already published. The schema is a cut-down design written for the post, and the post says so; it is not a copy of Oxygen LMS’s production schema.

| | |
|---|---|
| Title | Designing the database for a school ERP |
| SEO title | School management system database design (MySQL) (48 chars) |
| Slug | `school-erp-database-design` |
| Category / level / art | Engineering / Intermediate / `network` |
| Primary query | school management system database design |
| Assets | `public/downloads/school-erp-schema.sql`, `public/img/blog/school-erp-erd.svg`, `tests/sql/`, `tests/laravel/`, `.github/workflows/sql-examples.yml` |

## 1. The angle

A school ERP database rests on three decisions: class membership is a dated enrolment row per academic year, fees are an append-only ledger in integer paisa (arrears are a printed balance, never a new charge), and every foreign key includes `tenant_id`. All of it in MySQL and Laravel, with a schema that is tested in CI, and with the Pakistani details (family vouchers, B-Form, April sessions, PEIRA rules) that generic ER diagrams leave out.

## 2. What ranks now (24 Nov 2026)

| Result | What it offers | Weakness |
|---|---|---|
| itsourcecode (Jul 2026) | Capstone ER diagram | Weak types: gender and age as Int, contact number as Int |
| diagramdb.com | 7-table college ERD, crow’s foot | No history, no fees |
| chartcraft.dev | 9-node ERD | Diagram only |
| Medium @filemakr (Apr 2026) | Students, courses, offerings, enrolments, attendance; master/relationship/transaction layers | No SQL, no fees |
| **PlanSmith** (Oct 2026) | Strongest. PostgreSQL 16, downloadable SQL: people plus role tables, dated enrolments with a gist exclusion constraint, promotion decisions, attendance, marks, invoices, payments, append-only fee ledger in minor units, audit log | PostgreSQL only; no multi-tenancy; nothing local |

**Gap the post fills:**

- MySQL has no exclusion constraints. A generated column plus a unique index (`open_student_id`) gives “one open enrolment per student”.
- Multi-tenant integrity at the database level: composite `(tenant_id, id)` foreign keys.
- Family vouchers, arrears handling and re-import-safe payments.
- B-Form and NADRA name rules.
- Tested on real MySQL (8.0 and 8.4) plus a real Laravel 13 app.

PlanSmith is cited once, fairly, as the PostgreSQL route.

## 3. Overlap with existing posts

`multi-tenant-laravel-saas` already covers shared DB plus `tenant_id`, tenant resolution, global scopes, queued jobs and `(tenant_id, …)` indexes. Post 2 links to it and only adds the database-level part (composite foreign keys), saying the global scope protects reads but not bad writes.

`fee-vouchers-not-dashboards` explains why fees matter. Post 2 reuses its example family (Ali and Sara, Rs 13,550 with Rs 1,200 arrears), and the test suite reproduces that total to the rupee.

## 4. Facts and sources

| Fact | Source |
|---|---|
| MySQL enforces CHECK constraints from 8.0.16; they can’t use AUTO_INCREMENT columns, other tables, NOW() or subqueries; a NULL result passes | [MySQL 8.4 manual, CHECK constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html) |
| A UNIQUE index permits multiple NULL values | [MySQL 8.4 manual, CREATE INDEX](https://dev.mysql.com/doc/refman/8.4/en/create-index.html) |
| Punjab’s new academic year began on 1 April 2026 | [Express Tribune, 22 Nov 2025](https://tribune.com.pk/story/2578631/punjab-revises-school-admissions-policy-updates-syllabus-and-textbooks-for-2026) |
| PEIRA (Islamabad): no fee increase during the session; monthly fees; capped late fines | [Dawn, 14 Aug 2021](https://www.dawn.com/news/1640522) |
| NADRA issues the CRC (B-Form) to children under 18, under Rule 18 of the NADRA (NIC) Rules 2002 | [nadra.gov.pk](https://www.nadra.gov.pk/) |
| Since 1 Sep 2026, FBISE takes a candidate’s name, father’s name and date of birth from NADRA for Matric and Inter registration | [NADRA press release PR-Sep-354](https://www.nadra.gov.pk/media-release/nadra-and-fbise-sign-agreement-to-integrate-student-registration-and-educational-certificates-system-14030d12) |
| Store money as integer minor units or DECIMAL, never FLOAT | Common guidance (several engineering blogs, Stack Overflow 57968398); stated in the post without a citation |
| Composite tenant foreign keys: `UNIQUE (tenant_id, id)` on the parent, `(tenant_id, parent_id)` on the child | drawdb.app (Oct 2026), emergen.io (Nov 2026); stated without a citation |

⚠️ Don’t use 2026 “Punjab caps fees at 5%” stories: they are about Indian Punjab.

## 5. How the claims were verified

The sandbox couldn’t reach MySQL’s download servers, so tests run on GitHub Actions (`.github/workflows/sql-examples.yml`, runs on every change to the SQL or tests):

- **`mysql` job**, a matrix of MySQL 8.0 and 8.4: loads `public/downloads/school-erp-schema.sql`, seeds two schools and the Ali/Sara family, and runs 29 checks in `tests/sql/school-erp-schema.test.sh`. These cover voucher totals, arrears, promotion history, plus every error code the post quotes: 1062, 1452, 3819, 1644, and 1406 for an over-long B-Form.
- **`laravel` job:** `composer create-project laravel/laravel`, copies `tests/laravel/…_create_enrollments_table.php` (the post’s PHP excerpt is taken from it verbatim), runs `php artisan migrate` on MySQL 8.4 and then `tests/laravel/check.sh`.
- **Reading results:** job logs are on blob storage the sandbox can’t reach, so the scripts print GitHub annotations. Read them with `gh api repos/imgul/my-portfolio/check-runs/<job_id>/annotations`.

Last green run on 24 Nov 2026: MySQL 8.0.46 29/29, MySQL 8.4.13 29/29, Laravel Framework 13.44.1 passed.

## 6. Questions for Gul (optional, to make it more his)

1. One migration in Oxygen LMS you regretted, and what it cost to fix. The plan asked for this; it was left out because nothing about it is published.
2. Does Oxygen store class history the same way? If not, what does it do? A line like “Oxygen does X” would add first-hand weight.
3. A screenshot of a real (redacted) defaulter list built from a ledger.
