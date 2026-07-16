import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "eve_audit_benchmarks.db")

def calculate_ground_truth():
    if not os.path.exists(DB_PATH):
        return {"error": "Benchmark database does not exist yet."}
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    truth = {}
    
    # 1. Superstore Sales Ground Truth
    print("[*] Calculating Superstore Ground Truth...")
    cursor.execute("SELECT COUNT(*), SUM(Sales), SUM(Profit) FROM superstore;")
    cnt, sales, profit = cursor.fetchone()
    truth["superstore"] = {
        "total_transactions": cnt,
        "total_sales": round(sales, 2) if sales else 0,
        "total_profit": round(profit, 2) if profit else 0,
        "profit_margin_pct": round((profit / sales) * 100, 2) if sales else 0
    }
    
    # Top 3 profitable products in Superstore
    cursor.execute("""
        SELECT [Product Name], SUM(Profit) as TotalProfit 
        FROM superstore 
        WHERE [Product Name] IS NOT NULL
        GROUP BY [Product Name] 
        ORDER BY TotalProfit DESC 
        LIMIT 3;
    """)
    truth["superstore"]["top_profitable"] = [
        {"name": row[0], "profit": round(row[1], 2) if row[1] is not None else 0.0} for row in cursor.fetchall()
    ]
    
    # Top 3 unprofitable products in Superstore
    cursor.execute("""
        SELECT [Product Name], SUM(Profit) as TotalProfit 
        FROM superstore 
        WHERE [Product Name] IS NOT NULL
        GROUP BY [Product Name] 
        ORDER BY TotalProfit ASC 
        LIMIT 3;
    """)
    truth["superstore"]["top_unprofitable"] = [
        {"name": row[0], "profit": round(row[1], 2) if row[1] is not None else 0.0} for row in cursor.fetchall()
    ]
    
    # 2. IBM Telco Churn Ground Truth
    print("[*] Calculating IBM Telco Churn Ground Truth...")
    cursor.execute("SELECT COUNT(*) FROM ibm_churn;")
    total_cust = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM ibm_churn WHERE Churn = 'Yes';")
    churn_cust = cursor.fetchone()[0]
    
    truth["ibm_churn"] = {
        "total_customers": total_cust,
        "churned_customers": churn_cust,
        "churn_rate_pct": round((churn_cust / total_cust) * 100, 2) if total_cust else 0
    }
    
    # Churn rate by contract type
    cursor.execute("""
        SELECT Contract, COUNT(*), SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) 
        FROM ibm_churn 
        GROUP BY Contract;
    """)
    truth["ibm_churn"]["churn_by_contract"] = {}
    for row in cursor.fetchall():
        c_type, c_cnt, c_churn = row
        truth["ibm_churn"]["churn_by_contract"][c_type] = {
            "total": c_cnt,
            "churned": c_churn,
            "churn_rate_pct": round((c_churn / c_cnt) * 100, 2) if c_cnt else 0
        }
        
    # 3. Olist Ground Truth
    print("[*] Calculating Olist Ground Truth...")
    cursor.execute("SELECT COUNT(*) FROM olist_orders;")
    total_orders = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(price) FROM olist_order_items;")
    olist_rev = cursor.fetchone()[0]
    
    truth["olist"] = {
        "total_orders": total_orders,
        "total_revenue": round(olist_rev, 2) if olist_rev else 0
    }
    
    # Top 3 products in Olist
    cursor.execute("""
        SELECT p.product_category_name, SUM(i.price) as Revenue
        FROM olist_order_items i
        JOIN olist_products p ON i.product_id = p.product_id
        GROUP BY p.product_category_name
        ORDER BY Revenue DESC
        LIMIT 3;
    """)
    truth["olist"]["top_categories"] = [
        {"category": row[0], "revenue": round(row[1], 2) if row[1] is not None else 0.0} for row in cursor.fetchall()
    ]
    
    # 4. AdventureWorks Ground Truth
    print("[*] Calculating AdventureWorks Ground Truth...")
    # Verify if aw_salesorderdetail table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='aw_salesorderdetail';")
    if cursor.fetchone():
        cursor.execute("SELECT COUNT(*), SUM(linetotal) FROM aw_salesorderdetail;")
        det_cnt, total_sales = cursor.fetchone()
        truth["adventureworks"] = {
            "total_order_lines": det_cnt,
            "total_sales": round(total_sales, 2) if total_sales else 0
        }
    else:
        truth["adventureworks"] = {"status": "table not found"}
        
    conn.close()
    return truth

if __name__ == "__main__":
    truth = calculate_ground_truth()
    import json
    print(json.dumps(truth, indent=2))
