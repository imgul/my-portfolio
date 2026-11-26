#!/usr/bin/env python3
"""Offline fixture demo: no LLM calls and no production data."""

import json
import sys

# These are fictional cases and hand-written outputs, not observed model results.
CASES = [
    {'id': 'fee', 'input': 'The fee voucher total is wrong.', 'expected': 'fees'},
    {'id': 'attendance', 'input': 'Attendance is missing today.', 'expected': 'attendance'},
    {'id': 'empty', 'input': '', 'expected': 'needs_review'},
    {'id': 'mixed', 'input': 'Fees and attendance both look wrong.', 'expected': 'needs_review'},
]

BASELINE = {
    'fee': '{"category":"fees"}',
    'attendance': '{"category":"attendance"}',
    'empty': '{"category":"needs_review"}',
    'mixed': '{"category":"needs_review"}',
}
CANDIDATE = {
    'fee': '{"category":"fees"}',
    'attendance': '{"category":"attendance"}',
    'empty': '{"category":"needs_review"}',
    'mixed': '{"category":"fees"}',  # Deliberate regression for this demo.
}


def passes(raw, expected):
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return False
    return (
        isinstance(value, dict)
        and set(value) == {'category'}
        and isinstance(value['category'], str)
        and value['category'] == expected
    )


def main():
    base = {c['id']: passes(BASELINE.get(c['id']), c['expected']) for c in CASES}
    new = {c['id']: passes(CANDIDATE.get(c['id']), c['expected']) for c in CASES}
    losses = [c['id'] for c in CASES if base[c['id']] and not new[c['id']]]
    print(f'Baseline: {sum(base.values())}/{len(CASES)} passed')
    print(f'Candidate: {sum(new.values())}/{len(CASES)} passed')
    print('Regressions:', ', '.join(losses) if losses else 'none')
    if losses or not all(new.values()):
        print('Release blocked: inspect failures')
        return 1
    print('Fixture gate passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
