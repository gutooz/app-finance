from datetime import date
import unittest

from backend.services.credit_card_service import (
    calculate_credit_card_due_date,
    is_credit_card_category,
    is_credit_card_payment_method,
    normalize_payment_method,
)
from backend.bot.handlers.natural_language import parse_expense


class CreditCardServiceTest(unittest.TestCase):
    def test_recognizes_credit_card_category(self):
        self.assertTrue(is_credit_card_category("cartao-de-credito"))
        self.assertTrue(is_credit_card_category("credito"))
        self.assertFalse(is_credit_card_category("mercado"))

    def test_normalizes_payment_methods(self):
        self.assertEqual(normalize_payment_method("pix"), "pix")
        self.assertEqual(normalize_payment_method("dinheiro"), "cash")
        self.assertEqual(normalize_payment_method("debito"), "debit")
        self.assertEqual(normalize_payment_method("cartão de crédito"), "credit_card")
        self.assertTrue(is_credit_card_payment_method("credit_card"))

    def test_uses_current_month_when_due_day_has_not_passed(self):
        self.assertEqual(calculate_credit_card_due_date(date(2026, 9, 4), 10), date(2026, 9, 10))

    def test_uses_next_month_when_due_day_has_passed(self):
        self.assertEqual(calculate_credit_card_due_date(date(2026, 9, 11), 10), date(2026, 10, 10))

    def test_clamps_due_day_to_month_end(self):
        self.assertEqual(calculate_credit_card_due_date(date(2026, 2, 28), 31), date(2026, 2, 28))
        self.assertEqual(calculate_credit_card_due_date(date(2026, 3, 31), 31), date(2026, 3, 31))

    def test_parses_credit_card_messages_as_payment_method(self):
        parsed = parse_expense("gastei 50 de gasolina no crédito")

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["category"], "gasolina")
        self.assertEqual(parsed["payment_method"], "credit_card")


if __name__ == "__main__":
    unittest.main()
