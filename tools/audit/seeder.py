import os
import urllib.request
import pandas as pd
import sqlite3

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DB_PATH = os.path.join(os.path.dirname(__file__), "eve_audit_benchmarks.db")

os.makedirs(DATA_DIR, exist_ok=True)

urls = {
    "olist_customers": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_customers_dataset.csv",
    "olist_orders": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_orders_dataset.csv",
    "olist_order_items": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_order_items_dataset.csv",
    "olist_products": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_products_dataset.csv",
    "olist_payments": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_order_payments_dataset.csv",
    "ibm_churn": "https://raw.githubusercontent.com/IBM/telco-customer-churn-on-icp4d/master/data/Telco-Customer-Churn.csv",
    "superstore": "https://raw.githubusercontent.com/leonism/sample-superstore/master/data/superstore.csv",
    "adventureworks": "https://raw.githubusercontent.com/martinandersen3d/AdventureWorks-for-SQLite/master/AdventureWorks-sqlite.db"
}

def download_file(name, url):
    ext = ".db" if name == "adventureworks" else ".csv"
    dest = os.path.join(DATA_DIR, f"{name}{ext}")
    if os.path.exists(dest):
        print(f"[*] {name} already exists. Skipping download.")
        return dest
    print(f"[*] Downloading {name} from {url}...")
    urllib.request.urlretrieve(url, dest)
    print(f"[+] Downloaded {name} successfully.")
    return dest

def seed_database():
    conn = sqlite3.connect(DB_PATH)
    
    # 1. Load CSVs into SQLite
    csv_datasets = ["olist_customers", "olist_orders", "olist_order_items", "olist_products", "olist_payments", "ibm_churn", "superstore"]
    for name in csv_datasets:
        dest = download_file(name, urls[name])
        print(f"[*] Seeding {name} into SQLite...")
        # read CSV with pandas
        df = pd.read_csv(dest)
        # write to SQL
        df.to_sql(name, conn, if_exists="replace", index=False)
        print(f"[+] Seeded {name} with {len(df)} records.")

    # 2. AdventureWorks SQLite db copy/attach
    aw_dest = download_file("adventureworks", urls["adventureworks"])
    print("[*] Seeding AdventureWorks tables...")
    aw_conn = sqlite3.connect(aw_dest)
    aw_conn.text_factory = lambda x: str(x, 'utf-8', 'ignore')
    cursor = aw_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    
    for t in tables:
        print(f"    [*] Copying table {t}...")
        df_t = pd.read_sql(f"SELECT * FROM [{t}]", aw_conn)
        df_t.to_sql(f"aw_{t.lower()}", conn, if_exists="replace", index=False)
    
    aw_conn.close()
    conn.close()
    print("[SUCCESS] All datasets seeded into isolated benchmark DB successfully!")

if __name__ == "__main__":
    seed_database()
