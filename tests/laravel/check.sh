#!/usr/bin/env bash
# After `php artisan migrate`, check that the Laravel-built enrollments table enforces the same rules
# as the plain SQL schema. Expects MYSQL (client command) and MYSQL_PWD in the environment.
set -uo pipefail
DB=${DB:-laravel}
fail=0
q() { $MYSQL --batch --skip-column-names "$DB" -e "$1" 2>&1; }
note() { echo "$1"; [ -n "${GITHUB_ACTIONS:-}" ] && echo "::$2 title=Laravel migration::$1"; return 0; }
expect_error() {
  local out
  if out=$(q "$3"); then note "$1: expected $2, statement succeeded" error; fail=1
  elif grep -q "$2" <<<"$out"; then echo "  ✓ $1 ($2)"
  else note "$1: expected $2, got $out" error; fail=1; fi
}

q "INSERT INTO tenants (id, name) VALUES (1, 'A'), (2, 'B');
   INSERT INTO students (id, tenant_id, name) VALUES (1, 1, 'Ali'), (2, 2, 'Other');
   INSERT INTO sections (id, tenant_id, name) VALUES (1, 1, '5-B'), (2, 2, '5-A');
   INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on, ends_on, end_reason)
     VALUES (1, 1, 1, '2025-04-01', '2026-03-31', 'promoted');
   INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on) VALUES (1, 1, 1, '2026-04-01');" \
  || { note "seed failed" error; exit 1; }

expect_error "second open enrolment" "ERROR 1062" \
  "INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on) VALUES (1, 1, 1, '2026-05-01')"
expect_error "cross-tenant student" "ERROR 1452" \
  "INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on, ends_on, end_reason) VALUES (1, 2, 1, '2024-04-01', '2025-03-31', 'promoted')"
expect_error "cross-tenant section" "ERROR 1452" \
  "INSERT INTO enrollments (tenant_id, student_id, section_id, starts_on, ends_on, end_reason) VALUES (1, 1, 2, '2024-04-01', '2025-03-31', 'promoted')"
expect_error "closing without a reason" "ERROR 3819" \
  "UPDATE enrollments SET ends_on = '2026-06-30' WHERE ends_on IS NULL"

[ "$fail" -eq 0 ] && note "$(php artisan --version), $(q 'SELECT VERSION()'): all checks passed" notice
exit $fail
