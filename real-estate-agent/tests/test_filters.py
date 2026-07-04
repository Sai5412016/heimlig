import unittest

from filter.filters import apply_filters
from utils.models import Property, SearchCriteria


def make_property(**overrides) -> Property:
    defaults = dict(
        id="1",
        provider="test",
        title="Schönes Haus mit Garage und Garten",
        price=500000,
        city="Augsburg",
        address="Musterstraße 1, Augsburg",
        living_area=150,
        plot=600,
        rooms=6,
        url="https://example.com/1",
    )
    defaults.update(overrides)
    return Property(**defaults)


def make_criteria(**overrides) -> SearchCriteria:
    defaults = dict(
        types=["house"],
        buy=True,
        rent=False,
        center="Augsburg",
        radius_km=25,
        price_min=0,
        price_max=650000,
        living_area_min=130,
        rooms_min=5,
        plot_min=500,
        keywords=["garage", "garten"],
        exclude=["erbpacht"],
    )
    defaults.update(overrides)
    return SearchCriteria(**defaults)


class ApplyFiltersTests(unittest.TestCase):
    def test_matching_property_is_kept(self):
        result = apply_filters([make_property()], make_criteria())
        self.assertEqual(len(result), 1)

    def test_price_over_max_is_rejected(self):
        result = apply_filters([make_property(price=700000)], make_criteria())
        self.assertEqual(result, [])

    def test_living_area_below_min_is_rejected(self):
        result = apply_filters([make_property(living_area=80)], make_criteria())
        self.assertEqual(result, [])

    def test_missing_keyword_is_rejected(self):
        result = apply_filters([make_property(title="Haus ohne Stellplatz")], make_criteria())
        self.assertEqual(result, [])

    def test_exclusion_keyword_is_rejected(self):
        result = apply_filters(
            [make_property(title="Haus mit Garage und Erbpacht")], make_criteria()
        )
        self.assertEqual(result, [])

    def test_unknown_price_is_not_discarded(self):
        result = apply_filters([make_property(price=None)], make_criteria())
        self.assertEqual(len(result), 1)


if __name__ == "__main__":
    unittest.main()
