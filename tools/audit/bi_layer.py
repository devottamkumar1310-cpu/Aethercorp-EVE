import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "eve_audit_benchmarks.db")

class AuditBILayer:
    @staticmethod
    def _get_connection():
        return sqlite3.connect(DB_PATH)

    @staticmethod
    def get_financial_summary() -> str:
        conn = AuditBILayer._get_connection()
        cursor = conn.cursor()
        
        # Superstore totals
        cursor.execute("SELECT SUM(Sales), SUM(Profit), COUNT(*) FROM superstore;")
        ss_sales, ss_profit, ss_cnt = cursor.fetchone()
        ss_margin = (ss_profit / ss_sales) * 100 if ss_sales else 0
        
        # Olist totals
        cursor.execute("SELECT SUM(price), COUNT(*) FROM olist_order_items;")
        ol_sales, ol_cnt = cursor.fetchone()
        
        # Top profit generators
        cursor.execute("""
            SELECT [Product Name], SUM(Profit) as p 
            FROM superstore 
            GROUP BY [Product Name] 
            ORDER BY p DESC 
            LIMIT 3;
        """)
        top_prof = [f"{row[0]} (${row[1]:,.2f})" for row in cursor.fetchall()]
        
        # Top profit destroyers
        cursor.execute("""
            SELECT [Product Name], SUM(Profit) as p 
            FROM superstore 
            GROUP BY [Product Name] 
            ORDER BY p ASC 
            LIMIT 3;
        """)
        top_dest = [f"{row[0]} (${row[1]:,.2f})" for row in cursor.fetchall()]

        conn.close()
        
        summary = f"""[FINANCIAL BENCHMARK SUMMARY]
- Superstore Sales: ${ss_sales:,.2f}
- Superstore Profit: ${ss_profit:,.2f}
- Superstore Net Margin: {ss_margin:.2f}%
- Total Superstore Transactions: {ss_cnt:,}
- Olist E-Commerce GMV: ${ol_sales:,.2f} (Orders: {ol_cnt:,})
- Top Profit Drivers:
  1. {top_prof[0] if len(top_prof) > 0 else 'N/A'}
  2. {top_prof[1] if len(top_prof) > 1 else 'N/A'}
  3. {top_prof[2] if len(top_prof) > 2 else 'N/A'}
- Top Profit Destroyers (Loss Makers):
  1. {top_dest[0] if len(top_dest) > 0 else 'N/A'}
  2. {top_dest[1] if len(top_dest) > 1 else 'N/A'}
  3. {top_dest[2] if len(top_dest) > 2 else 'N/A'}
- Financial Trend: Overall revenue is stable, but profitability is heavily dragged down by negative-margin sales on select product SKUs (e.g. loss-leader items priced below unit costs).
"""
        return summary

    @staticmethod
    def get_client_summary() -> str:
        conn = AuditBILayer._get_connection()
        cursor = conn.cursor()
        
        # Telco Churn Totals
        cursor.execute("SELECT COUNT(*), SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) FROM ibm_churn;")
        total_cust, churned_cust = cursor.fetchone()
        churn_rate = (churned_cust / total_cust) * 100 if total_cust else 0
        
        # Churn by contract
        cursor.execute("""
            SELECT Contract, COUNT(*), SUM(CASE WHEN Churn = 'Yes' THEN 1 ELSE 0 END) 
            FROM ibm_churn 
            GROUP BY Contract;
        """)
        contracts = []
        for row in cursor.fetchall():
            c_type, c_cnt, c_churn = row
            c_rate = (c_churn / c_cnt) * 100 if c_cnt else 0
            contracts.append(f"{c_type}: Total={c_cnt:,}, Churned={c_churn:,} ({c_rate:.2f}% churn)")
            
        # Top monthly charges
        cursor.execute("SELECT MAX(MonthlyCharges), AVG(MonthlyCharges) FROM ibm_churn;")
        max_c, avg_c = cursor.fetchone()

        conn.close()
        
        summary = f"""[CLIENT BENCHMARK SUMMARY]
- Total Audited Customers: {total_cust:,}
- Churned Customers: {churned_cust:,}
- Overall Churn Rate: {churn_rate:.2f}%
- Average Monthly Spend: ${avg_c:.2f} (Max: ${max_c:.2f})
- Segmented Contract Risk:
  * {contracts[0] if len(contracts) > 0 else 'N/A'}
  * {contracts[1] if len(contracts) > 1 else 'N/A'}
  * {contracts[2] if len(contracts) > 2 else 'N/A'}
- Client Health Risk: Customer retention is the single largest operational threat, with Month-to-month contracts expressing extremely high churn rates. Two-year contract accounts remain highly stable.
"""
        return summary

    @staticmethod
    def get_growth_summary() -> str:
        conn = AuditBILayer._get_connection()
        cursor = conn.cursor()
        
        # Segment revenue growth
        cursor.execute("""
            SELECT Segment, SUM(Sales), SUM(Profit) 
            FROM superstore 
            GROUP BY Segment;
        """)
        segments = [f"{row[0]} Segment: Sales=${row[1]:,.2f}, Profit=${row[2]:,.2f}" for row in cursor.fetchall()]
        
        # Olist Payment types (revealing customer buying behavior)
        cursor.execute("""
            SELECT payment_type, COUNT(*), SUM(payment_value) as val
            FROM olist_payments
            GROUP BY payment_type
            ORDER BY val DESC;
        """)
        payments = [f"{row[0]}: {row[1]:,} payments (${row[2]:,.2f})" for row in cursor.fetchall()]
        
        conn.close()
        
        summary = f"""[GROWTH BENCHMARK SUMMARY]
- Segment Market Penetration:
  * {segments[0] if len(segments) > 0 else 'N/A'}
  * {segments[1] if len(segments) > 1 else 'N/A'}
  * {segments[2] if len(segments) > 2 else 'N/A'}
- Olist Transaction Preferences:
  * {payments[0] if len(payments) > 0 else 'N/A'}
  * {payments[1] if len(payments) > 1 else 'N/A'}
  * {payments[2] if len(payments) > 2 else 'N/A'}
- Opportunity Recommendation: Cross-selling value-added services (e.g. tech support) to corporate segments and introducing installment-payment promotions for high-value e-commerce orders are key paths to revenue expansion.
"""
        return summary

    @staticmethod
    def get_operations_summary() -> str:
        conn = AuditBILayer._get_connection()
        cursor = conn.cursor()
        
        # Olist delivery statistics (bottlenecks)
        cursor.execute("""
            SELECT COUNT(*),
                   SUM(CASE WHEN order_delivered_customer_date > order_estimated_delivery_date THEN 1 ELSE 0 END)
            FROM olist_orders
            WHERE order_delivered_customer_date IS NOT NULL AND order_estimated_delivery_date IS NOT NULL;
        """)
        total_del, late_del = cursor.fetchone()
        late_pct = (late_del / total_del) * 100 if total_del else 0
        
        # Superstore Shipping modes
        cursor.execute("""
            SELECT [Ship Mode], COUNT(*), AVG(Profit) 
            FROM superstore 
            GROUP BY [Ship Mode];
        """)
        ship_modes = [f"{row[0]} Ship Mode: Orders={row[1]:,}, AvgProfit=${row[2]:.2f}" for row in cursor.fetchall()]
        
        conn.close()
        
        summary = f"""[OPERATIONS BENCHMARK SUMMARY]
- Late Delivery Bottleneck (Olist): {late_del:,} out of {total_del:,} delivered orders were late ({late_pct:.2f}% late rate).
- Shipping Mode Analytics:
  * {ship_modes[0] if len(ship_modes) > 0 else 'N/A'}
  * {ship_modes[1] if len(ship_modes) > 1 else 'N/A'}
  * {ship_modes[2] if len(ship_modes) > 2 else 'N/A'}
- Operational Risk: Late shipments are directly causing a decline in customer satisfaction and brand trust. Logistics routes, especially standard class shipping channels, require urgent optimization.
"""
        return summary
