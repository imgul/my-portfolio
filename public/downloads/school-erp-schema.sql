-- School ERP core schema (MySQL 8.4)
-- From "Designing the database for a school ERP", https://gulzaib.vercel.app/blog/designing-the-database-for-a-school-erp
-- Licence: CC BY 4.0. Muhammad Gulzaib.
--
-- Run in an empty practice database:
--   mysql -u root -p school_erp < school-erp-schema.sql
--
-- Design rules:
--   1. Every school-owned table has tenant_id, and every foreign key between them includes it,
--      so a row can never point at another school's row.
--   2. A student's class is an enrolment row for one academic year, never a column on students.
--   3. Money is integer paisa. Fees are an append-only ledger; arrears are a balance, not a fee.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------------------------

CREATE TABLE tenants (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subdomain  VARCHAR(63)  NOT NULL UNIQUE,
  name       VARCHAR(160) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------------------------
-- Calendar and classes
-- ---------------------------------------------------------------------------------------------

-- Sessions start in April for most local-board schools and in August for many Cambridge schools,
-- so the academic year is data, never derived from the calendar year.
CREATE TABLE academic_years (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name      VARCHAR(20) NOT NULL,                       -- '2026-27'
  starts_on DATE NOT NULL,
  ends_on   DATE NOT NULL,
  UNIQUE KEY academic_years_tenant_id (tenant_id, id),
  UNIQUE KEY academic_years_tenant_name (tenant_id, name),
  CONSTRAINT academic_years_dates CHECK (ends_on > starts_on),
  CONSTRAINT academic_years_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

-- 'Class 5' exists every year. It is permanent.
CREATE TABLE grade_levels (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id  BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(40) NOT NULL,                      -- 'Class 5'
  sort_order SMALLINT NOT NULL,
  UNIQUE KEY grade_levels_tenant_id (tenant_id, id),
  UNIQUE KEY grade_levels_tenant_name (tenant_id, name),
  CONSTRAINT grade_levels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

-- '5-B in 2026-27' is a row for that year only.
CREATE TABLE sections (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id        BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id   BIGINT UNSIGNED NOT NULL,
  name             VARCHAR(20) NOT NULL,                -- 'B'
  UNIQUE KEY sections_tenant_id (tenant_id, id),
  UNIQUE KEY sections_unique_name (tenant_id, academic_year_id, grade_level_id, name),
  CONSTRAINT sections_year  FOREIGN KEY (tenant_id, academic_year_id) REFERENCES academic_years (tenant_id, id),
  CONSTRAINT sections_grade FOREIGN KEY (tenant_id, grade_level_id)   REFERENCES grade_levels (tenant_id, id)
);

-- ---------------------------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------------------------

-- The household that receives one fee voucher for all its children.
CREATE TABLE families (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  guardian_name VARCHAR(120) NOT NULL,
  phone         VARCHAR(16)  NOT NULL,                  -- E.164, e.g. +923001234567
  UNIQUE KEY families_tenant_id (tenant_id, id),
  KEY families_tenant_phone (tenant_id, phone),
  CONSTRAINT families_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

-- Identity only. No class, no section, no fee columns.
CREATE TABLE students (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  family_id    BIGINT UNSIGNED NOT NULL,
  admission_no VARCHAR(20)  NOT NULL,
  name         VARCHAR(120) NOT NULL,                 -- spelled exactly as on the B-Form
  father_name  VARCHAR(120) NOT NULL,
  date_of_birth DATE NOT NULL,
  b_form_no    CHAR(13) NULL,                         -- NADRA Child Registration Certificate, digits only
  admitted_on  DATE NOT NULL,
  UNIQUE KEY students_tenant_id (tenant_id, id),
  UNIQUE KEY students_admission_no (tenant_id, admission_no),
  UNIQUE KEY students_b_form (tenant_id, b_form_no),
  CONSTRAINT students_b_form_digits CHECK (REGEXP_LIKE(b_form_no, '^[0-9]{13}$')),
  CONSTRAINT students_family FOREIGN KEY (tenant_id, family_id) REFERENCES families (tenant_id, id)
);

-- A student's place in a section, with dates. Moving section or being promoted closes one row and
-- opens another; rows are never overwritten, so last year's class lists stay correct.
CREATE TABLE enrollments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  student_id      BIGINT UNSIGNED NOT NULL,
  section_id      BIGINT UNSIGNED NOT NULL,
  starts_on       DATE NOT NULL,
  ends_on         DATE NULL,                            -- NULL = current
  end_reason      VARCHAR(12) NULL,
  -- equals student_id while the row is open, NULL once closed. The unique key below then allows
  -- any number of closed rows but only one open row per student (UNIQUE ignores NULLs).
  open_student_id BIGINT UNSIGNED AS (IF(ends_on IS NULL, student_id, NULL)) VIRTUAL,
  UNIQUE KEY enrollments_tenant_id (tenant_id, id),
  UNIQUE KEY enrollments_one_open (tenant_id, open_student_id),
  KEY enrollments_section (tenant_id, section_id, ends_on),
  CONSTRAINT enrollments_dates  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT enrollments_reason CHECK ((ends_on IS NULL) = (end_reason IS NULL)),
  CONSTRAINT enrollments_reason_values CHECK (end_reason IN ('promoted', 'retained', 'transferred', 'withdrawn', 'graduated')),
  CONSTRAINT enrollments_student FOREIGN KEY (tenant_id, student_id) REFERENCES students (tenant_id, id),
  CONSTRAINT enrollments_section FOREIGN KEY (tenant_id, section_id) REFERENCES sections (tenant_id, id)
);

-- Attendance belongs to the enrolment, so it stays attached to the right section and year.
CREATE TABLE attendance_marks (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id     BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  on_date       DATE NOT NULL,
  status        CHAR(1) NOT NULL,                       -- P present, A absent, L late, E excused
  UNIQUE KEY attendance_one_per_day (tenant_id, enrollment_id, on_date),
  CONSTRAINT attendance_status CHECK (status IN ('P', 'A', 'L', 'E')),
  CONSTRAINT attendance_enrollment FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments (tenant_id, id)
);

-- ---------------------------------------------------------------------------------------------
-- Fees
-- ---------------------------------------------------------------------------------------------

CREATE TABLE fee_heads (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  code      VARCHAR(20) NOT NULL,                       -- 'TUITION', 'TRANSPORT_R3', 'EXAM'
  name      VARCHAR(80) NOT NULL,
  frequency VARCHAR(8)  NOT NULL,
  UNIQUE KEY fee_heads_tenant_id (tenant_id, id),
  UNIQUE KEY fee_heads_code (tenant_id, code),
  CONSTRAINT fee_heads_frequency CHECK (frequency IN ('monthly', 'termly', 'annual', 'once')),
  CONSTRAINT fee_heads_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

-- One rate per head, class and academic year. Rates for a running year are not edited (regulators
-- forbid mid-session increases); next year's rates are new rows.
CREATE TABLE fee_rates (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id        BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id   BIGINT UNSIGNED NOT NULL,
  fee_head_id      BIGINT UNSIGNED NOT NULL,
  amount_paisa     BIGINT NOT NULL,
  UNIQUE KEY fee_rates_unique (tenant_id, academic_year_id, grade_level_id, fee_head_id),
  CONSTRAINT fee_rates_positive CHECK (amount_paisa > 0),
  CONSTRAINT fee_rates_year  FOREIGN KEY (tenant_id, academic_year_id) REFERENCES academic_years (tenant_id, id),
  CONSTRAINT fee_rates_grade FOREIGN KEY (tenant_id, grade_level_id)   REFERENCES grade_levels (tenant_id, id),
  CONSTRAINT fee_rates_head  FOREIGN KEY (tenant_id, fee_head_id)      REFERENCES fee_heads (tenant_id, id)
);

-- Sibling discounts, staff-child rates, scholarships. Who approved it is part of the row.
CREATE TABLE concessions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   BIGINT UNSIGNED NOT NULL,
  student_id  BIGINT UNSIGNED NOT NULL,
  fee_head_id BIGINT UNSIGNED NOT NULL,
  percent_bp  INT NOT NULL,                             -- basis points: 1000 = 10%
  reason      VARCHAR(20) NOT NULL,
  approved_by VARCHAR(120) NOT NULL,
  valid_from  DATE NOT NULL,
  valid_to    DATE NULL,
  UNIQUE KEY concessions_tenant_id (tenant_id, id),
  CONSTRAINT concessions_range  CHECK (percent_bp BETWEEN 1 AND 10000),
  CONSTRAINT concessions_dates  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT concessions_reason CHECK (reason IN ('sibling', 'staff_child', 'scholarship', 'hardship')),
  CONSTRAINT concessions_student FOREIGN KEY (tenant_id, student_id)  REFERENCES students (tenant_id, id),
  CONSTRAINT concessions_head    FOREIGN KEY (tenant_id, fee_head_id) REFERENCES fee_heads (tenant_id, id)
);

-- The printed document: one family, one month. balance_bf_paisa is a snapshot of what the family
-- owed when it was issued (the "arrears" line); it is printed, never added to the ledger again.
CREATE TABLE vouchers (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id        BIGINT UNSIGNED NOT NULL,
  family_id        BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  period           DATE NOT NULL,                       -- first day of the billed month
  voucher_no       VARCHAR(24) NOT NULL,
  consumer_no      VARCHAR(24) NULL,                    -- 1Bill / bank reference printed on the voucher
  due_on           DATE NOT NULL,
  balance_bf_paisa BIGINT NOT NULL DEFAULT 0,
  status           VARCHAR(10) NOT NULL DEFAULT 'issued',
  issued_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- one live voucher per family per month; cancelled ones step aside so a corrected one can be issued
  live_period      DATE AS (IF(status = 'issued', period, NULL)) VIRTUAL,
  UNIQUE KEY vouchers_tenant_id (tenant_id, id),
  UNIQUE KEY vouchers_no (tenant_id, voucher_no),
  UNIQUE KEY vouchers_consumer_no (consumer_no),
  UNIQUE KEY vouchers_one_per_month (tenant_id, family_id, live_period),
  CONSTRAINT vouchers_period CHECK (DAY(period) = 1),
  CONSTRAINT vouchers_status CHECK (status IN ('issued', 'cancelled')),
  CONSTRAINT vouchers_family FOREIGN KEY (tenant_id, family_id)        REFERENCES families (tenant_id, id),
  CONSTRAINT vouchers_year   FOREIGN KEY (tenant_id, academic_year_id) REFERENCES academic_years (tenant_id, id)
);

-- Money received. The bank or wallet reference is unique, so importing the same bank file twice
-- cannot record a payment twice.
CREATE TABLE payments (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  family_id    BIGINT UNSIGNED NOT NULL,
  voucher_id   BIGINT UNSIGNED NULL,
  method       VARCHAR(8) NOT NULL,
  external_ref VARCHAR(64) NULL,                        -- bank transaction id; NULL for cash
  amount_paisa BIGINT NOT NULL,
  received_at  DATETIME NOT NULL,
  received_by  VARCHAR(120) NOT NULL,
  UNIQUE KEY payments_tenant_id (tenant_id, id),
  UNIQUE KEY payments_external_ref (method, external_ref),
  CONSTRAINT payments_method   CHECK (method IN ('cash', 'bank', '1bill', 'raast')),
  CONSTRAINT payments_positive CHECK (amount_paisa > 0),
  CONSTRAINT payments_ref      CHECK (method = 'cash' OR external_ref IS NOT NULL),
  CONSTRAINT payments_family  FOREIGN KEY (tenant_id, family_id)  REFERENCES families (tenant_id, id),
  CONSTRAINT payments_voucher FOREIGN KEY (tenant_id, voucher_id) REFERENCES vouchers (tenant_id, id)
);

-- Every rupee owed or paid, one row each. Charges are positive, payments and concessions negative.
-- A family's balance is SUM(amount_paisa). Mistakes are fixed with a reversing row, never an edit.
CREATE TABLE ledger_entries (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    BIGINT UNSIGNED NOT NULL,
  family_id    BIGINT UNSIGNED NOT NULL,
  student_id   BIGINT UNSIGNED NULL,
  fee_head_id  BIGINT UNSIGNED NULL,
  voucher_id   BIGINT UNSIGNED NULL,
  payment_id   BIGINT UNSIGNED NULL,
  reverses_id  BIGINT UNSIGNED NULL,
  entry_type   VARCHAR(12) NOT NULL,
  amount_paisa BIGINT NOT NULL,
  memo         VARCHAR(160) NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ledger_tenant_id (tenant_id, id),
  UNIQUE KEY ledger_reversed_once (reverses_id),
  KEY ledger_family_balance (tenant_id, family_id, amount_paisa),
  CONSTRAINT ledger_type CHECK (entry_type IN ('charge', 'concession', 'late_fine', 'payment', 'refund', 'reversal')),
  CONSTRAINT ledger_sign CHECK (
    (entry_type IN ('charge', 'late_fine', 'refund') AND amount_paisa > 0) OR
    (entry_type IN ('concession', 'payment') AND amount_paisa < 0) OR
    (entry_type = 'reversal' AND amount_paisa <> 0 AND reverses_id IS NOT NULL)),
  CONSTRAINT ledger_payment_link CHECK ((entry_type = 'payment') = (payment_id IS NOT NULL)),
  CONSTRAINT ledger_family   FOREIGN KEY (tenant_id, family_id)   REFERENCES families (tenant_id, id),
  CONSTRAINT ledger_student  FOREIGN KEY (tenant_id, student_id)  REFERENCES students (tenant_id, id),
  CONSTRAINT ledger_head     FOREIGN KEY (tenant_id, fee_head_id) REFERENCES fee_heads (tenant_id, id),
  CONSTRAINT ledger_voucher  FOREIGN KEY (tenant_id, voucher_id)  REFERENCES vouchers (tenant_id, id),
  CONSTRAINT ledger_payment  FOREIGN KEY (tenant_id, payment_id)  REFERENCES payments (tenant_id, id),
  CONSTRAINT ledger_reverses FOREIGN KEY (tenant_id, reverses_id) REFERENCES ledger_entries (tenant_id, id)
);

-- Append-only, even for someone with full rights on the table.
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger_entries FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is append-only: add a reversal instead';
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger_entries FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is append-only: add a reversal instead';

-- ---------------------------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------------------------

-- Who owes what, right now. This is the defaulter list.
CREATE VIEW family_balances AS
SELECT l.tenant_id, l.family_id, f.guardian_name, f.phone, SUM(l.amount_paisa) AS balance_paisa
FROM ledger_entries l
JOIN families f ON f.tenant_id = l.tenant_id AND f.id = l.family_id
GROUP BY l.tenant_id, l.family_id, f.guardian_name, f.phone;

-- The class list for any section, any year, including students who left part-way.
CREATE VIEW section_rosters AS
SELECT e.tenant_id, ay.name AS academic_year, g.name AS class_name, s.name AS section,
       st.admission_no, st.name AS student, e.starts_on, e.ends_on, e.end_reason
FROM enrollments e
JOIN sections s        ON s.tenant_id = e.tenant_id  AND s.id = e.section_id
JOIN academic_years ay ON ay.tenant_id = s.tenant_id AND ay.id = s.academic_year_id
JOIN grade_levels g    ON g.tenant_id = s.tenant_id  AND g.id = s.grade_level_id
JOIN students st       ON st.tenant_id = e.tenant_id AND st.id = e.student_id;
