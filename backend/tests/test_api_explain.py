"""
Test /generate and /schedule endpoints with explain_unscheduled diagnosis.
"""
import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import generate, schedule, GenerateParams

def test_api_schedule_explains():
    print("1. Calling /generate endpoint function...")
    params = GenerateParams(num_companies=35, num_students=800, num_rooms=20, seed=42)
    gen_data = generate(params)
    print("Generated dataset:", gen_data)
    assert gen_data["companies"] == 35
    assert gen_data["students"] == 800
    assert gen_data["rooms"] == 20
    assert gen_data["interviews"] > 0
    
    print("\n2. Calling /schedule endpoint function...")
    sched_data = schedule()
    
    print("\nSchedule metrics:", sched_data["metrics"])
    print(f"\nUnscheduled sample ({len(sched_data['unscheduled_sample'])} items):")
    
    for i, item in enumerate(sched_data["unscheduled_sample"][:10], 1):
        print(f"\n--- Unscheduled Interview #{i} ---")
        print(f"Interview ID: {item.get('interview_id')}")
        print(f"Company ID:   {item.get('company_id')}")
        print(f"Student ID:   {item.get('student_id')}")
        print(f"Reason:       {item.get('reason')}")
        print(f"Detail:       {item.get('detail')}")
        assert "detail" in item, "Detail field is missing!"
        assert item["reason"] in ("room_capacity", "panel_capacity", "student_conflict", "unknown")
        assert len(item["detail"]) > 0, "Detail string is empty!"

    print("\nAll assertions passed successfully!")

if __name__ == "__main__":
    test_api_schedule_explains()
