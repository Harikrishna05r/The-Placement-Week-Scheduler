"""
Live FastAPI server test over HTTP using uvicorn and urllib.request.
"""
import sys
import os
import time
import subprocess
import urllib.request
import json

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.environ["PYTHONPATH"] = backend_dir

log_file = open("uvicorn_test.log", "w")

print("Starting uvicorn server...")
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd=backend_dir,
    stdout=log_file,
    stderr=log_file,
)

try:
    # Wait for server to start
    time.sleep(2)
    
    print("\n--- 1. POST http://127.0.0.1:8000/generate ---")
    gen_payload = json.dumps({"num_companies": 35, "num_students": 800, "num_rooms": 20, "seed": 42}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/generate",
        data=gen_payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        gen_res = json.loads(resp.read().decode("utf-8"))
        print("Response:", gen_res)
        
    print("\n--- 2. POST http://127.0.0.1:8000/schedule ---")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/schedule",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp:
        sched_res = json.loads(resp.read().decode("utf-8"))
        print(f"Solved in {time.time() - t0:.2f}s")
        print("Metrics:", sched_res["metrics"])
        print("\nShowing 5 unscheduled interviews with their detail strings:")
        for idx, item in enumerate(sched_res["unscheduled_sample"][:5], 1):
            print(f"\n[{idx}] Interview ID: {item['interview_id']}")
            print(f"    Company ID:   {item['company_id']}")
            print(f"    Student ID:   {item['student_id']}")
            print(f"    Reason:       {item['reason']}")
            print(f"    Detail:       {item['detail']}")

finally:
    print("\nStopping uvicorn server...")
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
    log_file.close()
    print("Server stopped.")
