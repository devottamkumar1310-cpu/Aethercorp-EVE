"""Tests for the variant detection logic."""
import pytest
from app.fashion.variant_detector import detect_variants, _parse_variant_name


class TestParseVariantName:
    def test_dash_slash_pattern(self):
        parent, size, color = _parse_variant_name("Classic Cotton Tee - Black / S")
        assert parent == "Classic Cotton Tee"
        assert size == "S"
        assert color == "Black"

    def test_dash_slash_no_color(self):
        parent, size, color = _parse_variant_name("Basic Tee - M")
        assert parent == "Basic Tee"
        assert size == "M"
        assert color is None

    def test_parenthesized_pattern(self):
        parent, size, color = _parse_variant_name("Summer Dress (Red, L)")
        assert parent == "Summer Dress"
        assert size == "L"
        assert color == "Red"

    def test_pipe_pattern(self):
        parent, size, color = _parse_variant_name("Slim Jeans | Navy | 32")
        assert parent == "Slim Jeans"
        assert size == "32"
        assert color == "Navy"

    def test_no_variant_info(self):
        parent, size, color = _parse_variant_name("Plain Product Name")
        assert parent == "Plain Product Name"
        assert size is None
        assert color is None

    def test_color_only(self):
        parent, size, color = _parse_variant_name("Hoodie - Black")
        assert parent == "Hoodie"
        assert color == "Black"
        assert size is None

    def test_size_only_xl(self):
        parent, size, color = _parse_variant_name("Tank Top - XL")
        assert parent == "Tank Top"
        assert size == "XL"
        assert color is None


class TestDetectVariants:
    def test_groups_variants(self):
        products = [
            {"sku": "CCT-BLK-S", "name": "Classic Cotton Tee - Black / S"},
            {"sku": "CCT-BLK-M", "name": "Classic Cotton Tee - Black / M"},
            {"sku": "CCT-BLK-L", "name": "Classic Cotton Tee - Black / L"},
            {"sku": "CCT-WHT-S", "name": "Classic Cotton Tee - White / S"},
        ]
        result = detect_variants(products)
        assert len(result.variant_groups) == 1
        assert result.variant_groups[0].parent_name == "Classic Cotton Tee"
        assert result.total_variants_detected == 4
        assert "S" in result.variant_groups[0].detected_sizes
        assert "Black" in result.variant_groups[0].detected_colors

    def test_unmatched_product(self):
        products = [
            {"sku": "SOLO-001", "name": "Standalone Product"},
        ]
        result = detect_variants(products)
        assert len(result.variant_groups) == 0
        assert len(result.unmatched_products) == 1

    def test_explicit_overrides(self):
        products = [
            {"sku": "A1", "name": "Product A", "parent_product_id": "PARENT-A", "size": "S"},
            {"sku": "A2", "name": "Product A", "parent_product_id": "PARENT-A", "size": "M"},
        ]
        result = detect_variants(products)
        assert len(result.variant_groups) == 1
        assert result.variant_groups[0].parent_product_id == "PARENT-A"

    def test_mixed_products(self):
        products = [
            {"sku": "V1", "name": "Tee - Red / S"},
            {"sku": "V2", "name": "Tee - Red / M"},
            {"sku": "SOLO", "name": "Random Gadget"},
        ]
        result = detect_variants(products)
        assert result.total_variants_detected == 2
        assert len(result.unmatched_products) == 1
        assert result.total_products == 3

    def test_confidence_calculation(self):
        products = [
            {"sku": "V1", "name": "Shirt - Blue / S"},
            {"sku": "V2", "name": "Shirt - Blue / M"},
            {"sku": "V3", "name": "Shirt - Blue / L"},
            {"sku": "V4", "name": "Shirt - Blue / XL"},
        ]
        result = detect_variants(products)
        assert result.detection_confidence == 1.0
