import subprocess
import sys

print("Running tests/test_coo_experience.py...")
result = subprocess.run(
    ["c:\\Users\\Devottam\\OneDrive\\Pictures\Desktop\\Project\\aethercorp-eve\\.venv\\Scripts\\pytest.exe", "tests/test_coo_experience.py", "-v"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    check=False
)
print("=== STDOUT ===")
print(result.stdout)
print("=== STDERR ===")
print(result.stderr)
print(f"Return Code: {result.returncode}")
sys.exit(1) # FORCE FAILURE TO TRACE OUTPUT
