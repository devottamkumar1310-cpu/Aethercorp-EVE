import pytest
from app.fashion.dead_stock import detect_dead_stock
from app.fashion.stockout_prediction import predict_stockout
from app.fashion.reorder_engine import calculate_reorder_quantity
from app.fashion.margin_analysis import calculate_margin
from app.fashion.profit_impact import estimate_profit_impact
from app.fashion.inventory_turnover import calculate_inventory_turnover

def test_detect_dead_stock():
    # Dead stock: zero sales
    assert detect_dead_stock(100, 0.0, 30) == True
    # Not dead stock: high velocity
    assert detect_dead_stock(100, 10.0, 30) == False
    # Threshold reached: 30 days of supply
    assert detect_dead_stock(30, 1.0, 30) == True
    # Threshold not reached: 29 days of supply
    assert detect_dead_stock(29, 1.0, 30) == False

def test_predict_stockout():
    # 100 items / 10 a day = 10 days
    res = predict_stockout("SKU001", 100, 10.0)
    assert res["sku"] == "SKU001"
    assert res["days_until_stockout"] == 10.0

    # 0 sales = 999 days
    res2 = predict_stockout("SKU002", 50, 0.0)
    assert res2["days_until_stockout"] == 999.0

def test_calculate_reorder_quantity():
    # Safety stock (50) + Lead time demand (10 * 14) = 50 + 140 = 190
    res = calculate_reorder_quantity("SKU001", 10.0, 14, 50)
    assert res["recommended_reorder"] == 190

def test_calculate_margin():
    # (100 - 60) / 100 = 40%
    res = calculate_margin(100.0, 60.0)
    assert res["margin_percent"] == 40.0

def test_estimate_profit_impact():
    # current_profit: 100 - 50 = 50. recommended_profit: 110 - 50 = 60. Diff = 10.
    # 10 * 100 units = 1000
    res = estimate_profit_impact(100.0, 110.0, 50.0, 100)
    assert res["estimated_profit_impact"] == 1000.0

def test_inventory_turnover():
    # COGS = 1000, Avg Inv = 500 => 2.0
    res = calculate_inventory_turnover(1000.0, 500.0)
    assert res == 2.0
