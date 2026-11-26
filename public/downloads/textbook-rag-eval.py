#!/usr/bin/env python3
"""Score manually mapped evidence coverage in paired retrieval results."""

import json
import sys
from collections import defaultdict


def anchors(value, *, allow_empty=True):
    if not isinstance(value, list) or any(not isinstance(x, str) or not x for x in value):
        raise ValueError('evidence must be a list of nonempty strings')
    if not allow_empty and not value:
        raise ValueError('required_evidence must not be empty')
    return set(value)


def score(case, system, k):
    required = anchors(case['required_evidence'], allow_empty=False)
    chunks = case[system]
    if not isinstance(chunks, list):
        raise ValueError('system results must be a list of ranked chunks')
    found = set()
    for chunk in chunks[:k]:
        found.update(anchors(chunk))
    return bool(required & found), required <= found


def main(path):
    with open(path, encoding='utf-8') as file:
        data = json.load(file)
    k = data['k']
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise ValueError('k must be a positive integer')
    cases = data['cases']
    if not cases or len({case['id'] for case in cases}) != len(cases):
        raise ValueError('cases must be nonempty and have unique IDs')
    totals = defaultdict(lambda: [0, 0, 0, 0, 0])
    for case in cases:
        if not isinstance(case['slice'], str) or case['slice'] in ('', 'overall'):
            raise ValueError('slice must be a nonempty string other than overall')
        before = score(case, 'baseline', k)
        after = score(case, 'candidate', k)
        for group in ('overall', case['slice']):
            row = totals[group]
            row[0] += 1
            row[1] += before[0]
            row[2] += before[1]
            row[3] += after[0]
            row[4] += after[1]
    print(f'Fixture evidence coverage at k={k}')
    print('slice      n   baseline any/all   candidate any/all')
    for group, (n, ba, bf, ca, cf) in totals.items():
        print(f'{group:<10} {n:<3} {ba}/{n}   {bf}/{n}          {ca}/{n}   {cf}/{n}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 textbook-rag-eval.py fixture.json')
    try:
        main(sys.argv[1])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        sys.exit(f'Invalid evaluation input: {exc}')
