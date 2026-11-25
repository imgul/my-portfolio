#!/usr/bin/env bash
# Loads public/downloads/school-erp-schema.sql into a real MySQL server, seeds one family, and checks
# that every rule the blog post claims is enforced by the database. Run by
# .github/workflows/sql-examples.yml against MySQL 8.4; locally:
#   MYSQL_PWD=root MYSQL="mysql -h127.0.0.1 -uroot" bash tests/sql/school-erp-schema.test.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

MYSQL=${MYSQL:-"mysql -h127.0.0.1 -uroot"}   # password via MYSQL_PWD, so no warning on stderr
DB=school_erp_test
q() { $MYSQL --batch --skip-column-names "$DB" -e "$1" 2>&1; }
pass=0; fail=0
ok()  { echo "  ✓ $1"; pass=$((pass + 1)); }
bad() {
  echo "  ✗ $1"; echo "    $2"; fail=$((fail + 1))
  [ -n "${GITHUB_ACTIONS:-}" ] && echo "::error title=$1::$(tr '\n' ' ' <<<"$2")"
  return 0
}

# step "description" "sql": run setup SQL and report the MySQL error if it fails
step() { local out; out=$(q "$2") || bad "$1" "$out"; }
# expect_error "description" "ERROR code" "sql"
expect_error() {
  local out
  if out=$(q "$3"); then bad "$1" "expected $2 but the statement succeeded"
  elif grep -q "$2" <<<"$out"; then ok "$1 ($2)"
  else bad "$1" "expected $2, got: $out"; fi
}
# expect_value "description" "expected" "sql"
expect_value() {
  local out; out=$(q "$3" | tr '\t' ' ')
  if [ "$out" = "$2" ]; then ok "$1 = $2"; else bad "$1" "expected '$2', got '$out'"; fi
}

$MYSQL -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB" 2>/dev/null
if ! out=$($MYSQL "$DB" < public/downloads/school-erp-schema.sql 2>&1); then
  echo "schema failed to load: $out"
  [ -n "${GITHUB_ACTIONS:-}" ] && echo "::error title=schema failed to load::$(tr '\n' ' ' <<<"$out")"
  exit 1
fi
echo "schema loaded: $(q "SELECT VERSION()")"

echo "seed"
step "seed data" "
INSERT INTO tenants (id, subdomain, name) VALUES (1, 'school-a', 'School A'), (2, 'school-b', 'School B');
INSERT INTO academic_years (id, tenant_id, name, starts_on, ends_on) VALUES
  (1, 1, '2025-26', '2025-04-01', '2026-03-31'),
  (2, 1, '2026-27', '2026-04-01', '2027-03-31'),
  (3, 2, '2026-27', '2026-08-01', '2027-06-30');
INSERT INTO grade_levels (id, tenant_id, name, sort_order) VALUES
  (1, 1, 'Class 2', 2), (2, 1, 'Class 4', 4), (3, 1, 'Class 5', 5), (4, 2, 'Class 5', 5);
INSERT INTO sections (id, tenant_id, academic_year_id, grade_level_id, name) VALUES
  (1, 1, 1, 2, 'A'),   -- Class 4-A 2025-26
  (2, 1, 2, 3, 'B'),   -- Class 5-B 2026-27
  (3, 1, 2, 1, 'A'),   -- Class 2-A 2026-27
  (4, 2, 3, 4, 'A');   -- School B
INSERT INTO families (id, tenant_id, guardian_name, phone) VALUES
  (1, 1, 'Imran Khan', '+923001234567'), (2, 2, 'Other Family', '+923331112223');
INSERT INTO students (id, tenant_id, family_id, admission_no, name, father_name, date_of_birth, b_form_no, admitted_on) VALUES
  (1, 1, 1, 'A-1021', 'Ali', 'Imran Khan', '2016-05-14', '6110112345671', '2022-04-01'),
  (2, 1, 1, 'A-1388', 'Sara', 'Imran Khan', '2019-09-02', NULL, '2025-04-01'),
  (3, 2, 2, 'B-0001', 'Other Student', 'Someone', '2016-01-01', '6110112345671', '2026-08-01');
-- Ali was in 4-A last year; promoted at year end.
INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on, ends_on, end_reason) VALUES
  (1, 1, 1, '2025-04-01', '2026-03-31', 'promoted');
INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on) VALUES
  (1, 1, 2, '2026-04-01'), (1, 2, 3, '2026-04-01');
INSERT INTO fee_heads (id, tenant_id, code, name, frequency) VALUES
  (1, 1, 'TUITION', 'Tuition', 'monthly'),
  (2, 1, 'TRANSPORT_R3', 'Transport, Route 3', 'monthly'),
  (3, 1, 'EXAM', 'Exam fee', 'termly');
INSERT INTO fee_rates (tenant_id, academic_year_id, grade_level_id, fee_head_id, amount_paisa) VALUES
  (1, 2, 3, 1, 450000), (1, 2, 1, 1, 450000), (1, 2, 3, 3, 80000);
INSERT INTO concessions (tenant_id, student_id, fee_head_id, percent_bp, reason, approved_by, valid_from) VALUES
  (1, 2, 1, 1000, 'sibling', 'Principal', '2026-04-01');
"

# April voucher: no arrears yet.
step "April voucher and payment" "
INSERT INTO vouchers (id, tenant_id, family_id, academic_year_id, period, voucher_no, consumer_no, due_on, balance_bf_paisa)
VALUES (1, 1, 1, 2, '2026-04-01', 'V-2026-04-0001', '100200300400', '2026-04-10', 0);
INSERT INTO ledger_entries (tenant_id, family_id, student_id, fee_head_id, voucher_id, entry_type, amount_paisa, memo) VALUES
  (1, 1, 1, 1, 1, 'charge', 450000, 'Ali, Class 5: tuition, April'),
  (1, 1, 2, 1, 1, 'charge', 450000, 'Sara, Class 2: tuition, April'),
  (1, 1, 2, 1, 1, 'concession', -45000, 'Sibling discount 10%'),
  (1, 1, 1, 2, 1, 'charge', 300000, 'Transport, Route 3');
INSERT INTO payments (id, tenant_id, family_id, voucher_id, method, external_ref, amount_paisa, received_at, received_by)
VALUES (1, 1, 1, 1, '1bill', 'TXN-88231', 1035000, '2026-04-09 14:20:00', '1Bill import');
INSERT INTO ledger_entries (tenant_id, family_id, payment_id, entry_type, amount_paisa, memo)
VALUES (1, 1, 1, 'payment', -1035000, '1Bill TXN-88231');
"

echo "fees"
expect_value "April charges after discount (Rs)" "11550" \
  "SELECT SUM(amount_paisa) DIV 100 FROM ledger_entries WHERE voucher_id = 1"
expect_value "balance after a partial payment (Rs)" "1200" \
  "SELECT balance_paisa DIV 100 FROM family_balances WHERE tenant_id = 1 AND family_id = 1"

# May voucher snapshots the balance as arrears; the arrears are not charged again.
step "May voucher" "
INSERT INTO vouchers (id, tenant_id, family_id, academic_year_id, period, voucher_no, consumer_no, due_on, balance_bf_paisa)
SELECT 2, 1, 1, 2, '2026-05-01', 'V-2026-05-0001', '100200300401', '2026-05-10', balance_paisa
FROM family_balances WHERE tenant_id = 1 AND family_id = 1;
INSERT INTO ledger_entries (tenant_id, family_id, student_id, fee_head_id, voucher_id, entry_type, amount_paisa, memo) VALUES
  (1, 1, 1, 1, 2, 'charge', 450000, 'Ali, Class 5: tuition, May'),
  (1, 1, 2, 1, 2, 'charge', 450000, 'Sara, Class 2: tuition, May'),
  (1, 1, 2, 1, 2, 'concession', -45000, 'Sibling discount 10%'),
  (1, 1, 1, 2, 2, 'charge', 300000, 'Transport, Route 3'),
  (1, 1, 1, 3, 2, 'charge', 80000, 'Exam fee, term 1');
"
expect_value "May voucher: arrears printed (Rs)" "1200" "SELECT balance_bf_paisa DIV 100 FROM vouchers WHERE id = 2"
expect_value "May voucher: total due (Rs)" "13550" \
  "SELECT (v.balance_bf_paisa + SUM(l.amount_paisa)) DIV 100 FROM vouchers v JOIN ledger_entries l ON l.voucher_id = v.id WHERE v.id = 2 GROUP BY v.id"
expect_value "family balance equals May total due (Rs)" "13550" \
  "SELECT balance_paisa DIV 100 FROM family_balances WHERE tenant_id = 1 AND family_id = 1"

echo "history"
expect_value "last year's 4-A roster still lists Ali" "A-1021 Ali promoted" \
  "SELECT admission_no, student, end_reason FROM section_rosters WHERE tenant_id = 1 AND academic_year = '2025-26' AND class_name = 'Class 4'"
expect_value "Ali's current class" "2026-27 Class 5 B" \
  "SELECT academic_year, class_name, section FROM section_rosters WHERE tenant_id = 1 AND admission_no = 'A-1021' AND ends_on IS NULL"

echo "rules the database enforces"
expect_error "only one open enrolment per student" "ERROR 1062" \
  "INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on) VALUES (1, 1, 3, '2026-05-01')"
expect_error "no reference to another school's student" "ERROR 1452" \
  "INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on) VALUES (2, 1, 4, '2026-08-01')"
expect_error "no reference to another school's section" "ERROR 1452" \
  "INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on, ends_on, end_reason) VALUES (1, 1, 4, '2024-04-01', '2025-03-31', 'promoted')"
expect_error "closing an enrolment needs a reason" "ERROR 3819" \
  "UPDATE enrollments SET ends_on = '2026-06-30' WHERE student_id = 2 AND ends_on IS NULL"
expect_error "ledger rows cannot be edited" "ERROR 1644" \
  "UPDATE ledger_entries SET amount_paisa = 1 WHERE id = 1"
expect_error "ledger rows cannot be deleted" "ERROR 1644" \
  "DELETE FROM ledger_entries WHERE id = 1"
expect_error "a charge cannot be negative" "ERROR 3819" \
  "INSERT INTO ledger_entries (tenant_id, family_id, entry_type, amount_paisa, memo) VALUES (1, 1, 'charge', -100, 'x')"
expect_error "the same bank transaction cannot be imported twice" "ERROR 1062" \
  "INSERT INTO payments (tenant_id, family_id, method, external_ref, amount_paisa, received_at, received_by) VALUES (1, 1, '1bill', 'TXN-88231', 1035000, NOW(), 'import')"
expect_error "a bank payment needs a reference" "ERROR 3819" \
  "INSERT INTO payments (tenant_id, family_id, method, amount_paisa, received_at, received_by) VALUES (1, 1, 'bank', 500000, NOW(), 'clerk')"
expect_error "one live voucher per family per month" "ERROR 1062" \
  "INSERT INTO vouchers (tenant_id, family_id, academic_year_id, period, voucher_no, due_on) VALUES (1, 1, 2, '2026-05-01', 'V-DUP', '2026-05-10')"
expect_error "a voucher period is the first of a month" "ERROR 3819" \
  "INSERT INTO vouchers (tenant_id, family_id, academic_year_id, period, voucher_no, due_on) VALUES (1, 1, 2, '2026-06-15', 'V-BAD', '2026-06-25')"
expect_error "a fee rate is set once per class, head and year" "ERROR 1062" \
  "INSERT INTO fee_rates (tenant_id, academic_year_id, grade_level_id, fee_head_id, amount_paisa) VALUES (1, 2, 3, 1, 480000)"

expect_error "a B-Form number is 13 digits" "ERROR 3819" \
  "INSERT INTO students (tenant_id, family_id, admission_no, name, father_name, date_of_birth, b_form_no, admitted_on) VALUES (1, 1, 'A-2000', 'X', 'Y', '2018-01-01', '61101-1234567-1', '2026-04-01')"
expect_error "one student per B-Form in a school" "ERROR 1062" \
  "INSERT INTO students (tenant_id, family_id, admission_no, name, father_name, date_of_birth, b_form_no, admitted_on) VALUES (1, 1, 'A-2001', 'X', 'Y', '2018-01-01', '6110112345671', '2026-04-01')"

echo "corrections"
q "UPDATE vouchers SET status = 'cancelled' WHERE id = 2;
   INSERT INTO vouchers (tenant_id, family_id, academic_year_id, period, voucher_no, due_on, balance_bf_paisa)
   VALUES (1, 1, 2, '2026-05-01', 'V-2026-05-0001R', '2026-05-12', 120000);" >/dev/null \
  && ok "a cancelled voucher can be replaced" || bad "a cancelled voucher can be replaced" "insert failed"
q "INSERT INTO ledger_entries (tenant_id, family_id, reverses_id, entry_type, amount_paisa, memo)
   VALUES (1, 1, 4, 'reversal', -300000, 'Transport charged in error, April');" >/dev/null \
  && ok "a wrong charge is fixed with a reversal" || bad "a wrong charge is fixed with a reversal" "insert failed"
expect_error "a row can be reversed only once" "ERROR 1062" \
  "INSERT INTO ledger_entries (tenant_id, family_id, reverses_id, entry_type, amount_paisa, memo) VALUES (1, 1, 4, 'reversal', -300000, 'again')"
expect_value "balance after the reversal (Rs)" "10550" \
  "SELECT balance_paisa DIV 100 FROM family_balances WHERE tenant_id = 1 AND family_id = 1"

echo "year-end promotion"
step "next year's calendar" "
INSERT INTO academic_years (id, tenant_id, name, starts_on, ends_on) VALUES (4, 1, '2027-28', '2027-04-01', '2028-03-31');
INSERT INTO grade_levels (id, tenant_id, name, sort_order) VALUES (5, 1, 'Class 6', 6);
INSERT INTO sections (id, tenant_id, academic_year_id, grade_level_id, name) VALUES (5, 1, 4, 5, 'B');"
# The same statements the post shows: close this year's rows, then open next year's from them.
step "promote 5-B to 6-B" "
START TRANSACTION;
UPDATE enrollments
SET ends_on = '2027-03-31', end_reason = 'promoted'
WHERE tenant_id = 1 AND section_id = 2 AND ends_on IS NULL;
INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on)
SELECT tenant_id, student_id, 5, '2027-04-01'
FROM enrollments
WHERE tenant_id = 1 AND section_id = 2 AND ends_on = '2027-03-31' AND end_reason = 'promoted';
COMMIT;"
expect_value "Ali's class after promotion" "2027-28 Class 6 B" \
  "SELECT academic_year, class_name, section FROM section_rosters WHERE tenant_id = 1 AND admission_no = 'A-1021' AND ends_on IS NULL"
expect_value "Ali's history rows" "3" \
  "SELECT COUNT(*) FROM enrollments WHERE tenant_id = 1 AND student_id = 1"
expect_value "2026-27 5-B roster still lists Ali" "A-1021 promoted" \
  "SELECT admission_no, end_reason FROM section_rosters WHERE tenant_id = 1 AND academic_year = '2026-27' AND class_name = 'Class 5'"

echo
echo "$pass passed, $fail failed"
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::notice title=SQL tests::$(q "SELECT VERSION()"): $pass passed, $fail failed"
[ "$fail" -eq 0 ]
