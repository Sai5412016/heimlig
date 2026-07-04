import unittest

from utils.models import Property


class PropertyModelTests(unittest.TestCase):
    def test_dedup_key_stable_for_same_input(self):
        prop = Property(
            id="1",
            provider="test",
            title="Haus",
            price=500000,
            city="Augsburg",
            address="Musterstraße 1",
            living_area=150,
            plot=600,
            rooms=6,
            url="https://example.com/1",
        )
        other = Property(
            id="1",
            provider="test",
            title="Haus",
            price=500000,
            city="Augsburg",
            address="Musterstraße 1",
            living_area=150,
            plot=600,
            rooms=6,
            url="https://example.com/1",
        )
        self.assertEqual(prop.dedup_key(), other.dedup_key())

    def test_dedup_key_differs_for_different_price(self):
        base = dict(
            id="1",
            provider="test",
            title="Haus",
            city="Augsburg",
            address="Musterstraße 1",
            living_area=150,
            plot=600,
            rooms=6,
            url="https://example.com/1",
        )
        cheap = Property(price=400000, **base)
        expensive = Property(price=500000, **base)
        self.assertNotEqual(cheap.dedup_key(), expensive.dedup_key())

    def test_price_per_sqm(self):
        prop = Property(
            id="1",
            provider="test",
            title="Haus",
            price=300000,
            city="Augsburg",
            address=None,
            living_area=150,
            plot=None,
            rooms=None,
            url="https://example.com/1",
        )
        self.assertEqual(prop.price_per_sqm, 2000.0)

    def test_price_per_sqm_none_without_living_area(self):
        prop = Property(
            id="1",
            provider="test",
            title="Haus",
            price=300000,
            city="Augsburg",
            address=None,
            living_area=None,
            plot=None,
            rooms=None,
            url="https://example.com/1",
        )
        self.assertIsNone(prop.price_per_sqm)


if __name__ == "__main__":
    unittest.main()
