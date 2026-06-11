import urllib.request

urls = {
    "Olist Customers": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_customers_dataset.csv",
    "Olist Orders": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_orders_dataset.csv",
    "Olist Order Items": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_order_items_dataset.csv",
    "Olist Products": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_products_dataset.csv",
    "Olist Payments": "https://raw.githubusercontent.com/Ganesh7699/Brazilian-E-Commerce-OList/master/olist_order_payments_dataset.csv",
    "IBM Churn": "https://raw.githubusercontent.com/IBM/telco-customer-churn-on-icp4d/master/data/Telco-Customer-Churn.csv",
    "Superstore": "https://raw.githubusercontent.com/leonism/sample-superstore/master/data/superstore.csv",
    "AdventureWorks DB": "https://raw.githubusercontent.com/martinandersen3d/AdventureWorks-for-SQLite/master/AdventureWorks-sqlite.db"
}

for name, url in urls.items():
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=5) as response:
            print(f"[+] {name}: Success (Status {response.status})")
    except Exception as e:
        print(f"[-] {name}: Failed ({e})")
