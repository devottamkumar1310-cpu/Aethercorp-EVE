import sys
import os
import time
import requests
import threading

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def run_server():
    import uvicorn
    # run server on port 8123
    uvicorn.run("app.main:app", host="127.0.0.1", port=8123, log_level="info")

# Start server in a background thread
server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

# Wait for server to boot
time.sleep(3)

print("Server started. Sending DELETE request...")

# Send OPTIONS request to test CORS
options_res = requests.options("http://127.0.0.1:8123/api/account/delete", headers={"Origin": "http://localhost:3000"})
print("OPTIONS Response:", options_res.status_code)
print("OPTIONS Headers:", options_res.headers)

# We cannot actually delete a user without a valid JWT, but we can see if we reach the route
# or if it gets rejected immediately by auth. If it reaches auth, it should return 401.
# If it hangs, we will see it hang here.

try:
    print("Sending DELETE request...")
    t0 = time.time()
    delete_res = requests.delete(
        "http://127.0.0.1:8123/api/account/delete", 
        headers={"Origin": "http://localhost:3000", "Authorization": "Bearer FAKE_TOKEN"},
        timeout=10
    )
    t1 = time.time()
    print("DELETE Response:", delete_res.status_code)
    print("DELETE Body:", delete_res.text)
    print(f"Time taken: {t1 - t0:.2f} seconds")
except requests.exceptions.Timeout:
    print("DELETE request HUNG and TIMED OUT after 10 seconds!")
except Exception as e:
    print(f"DELETE request failed: {e}")
