#!/usr/bin/env python3
"""Offline demonstration of a read-only tool gate. Not a production service."""

from dataclasses import dataclass
import unittest


@dataclass(frozen=True)
class Context:
    # Trusted server-side context, never model-provided arguments.
    tenant_id: int
    can_read_invoices: bool


class Denied(Exception):
    pass


def execute(proposal, context, invoices):
    if not isinstance(proposal, dict) or set(proposal) != {'name', 'arguments'}:
        raise Denied('invalid proposal')
    if proposal['name'] != 'invoice_status' or not context.can_read_invoices:
        raise Denied('tool not permitted')
    args = proposal['arguments']
    if not isinstance(args, dict) or set(args) != {'invoice_id'}:
        raise Denied('invalid arguments')
    invoice_id = args['invoice_id']
    if type(invoice_id) is not int or invoice_id < 1:
        raise Denied('invalid invoice ID')
    invoice = invoices.get(invoice_id)
    if invoice is None or invoice['tenant_id'] != context.tenant_id:
        raise Denied('invoice unavailable')
    return {'invoice_id': invoice_id, 'status': invoice['status']}


class ToolGateTests(unittest.TestCase):
    def setUp(self):
        self.context = Context(tenant_id=1, can_read_invoices=True)
        self.invoices = {
            10: {'tenant_id': 1, 'status': 'paid'},
            20: {'tenant_id': 2, 'status': 'unpaid'},
        }
        self.proposal = {'name': 'invoice_status', 'arguments': {'invoice_id': 10}}

    def test_permitted_read(self):
        self.assertEqual(execute(self.proposal, self.context, self.invoices),
                         {'invoice_id': 10, 'status': 'paid'})

    def test_cross_tenant_and_missing_are_denied(self):
        for invoice_id in (20, 999):
            with self.subTest(invoice_id=invoice_id), self.assertRaises(Denied):
                execute({'name': 'invoice_status', 'arguments': {'invoice_id': invoice_id}},
                        self.context, self.invoices)

    def test_unknown_tool_and_missing_permission_are_denied(self):
        with self.assertRaises(Denied):
            execute({'name': 'send_email', 'arguments': {}}, self.context, self.invoices)
        with self.assertRaises(Denied):
            execute(self.proposal, Context(1, False), self.invoices)

    def test_extra_and_invalid_arguments_are_denied(self):
        for args in ({'invoice_id': 10, 'tenant_id': 2}, {'invoice_id': True},
                     {'invoice_id': '10'}, {}, None):
            with self.subTest(args=args), self.assertRaises(Denied):
                execute({'name': 'invoice_status', 'arguments': args},
                        self.context, self.invoices)


if __name__ == '__main__':
    unittest.main()
