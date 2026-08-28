import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.main import app, STATE, GenerateParams, DisruptionParams, generate, schedule, replan, state

def test_api_replan_flow():
    # 1. Generate dataset
    gen_res = generate(GenerateParams(num_companies=10, num_students=120, num_rooms=6, seed=42))
    assert gen_res["companies"] == 10
    assert gen_res["rooms"] == 6

    # 2. Schedule
    sched_res = schedule()
    assert sched_res["scheduled"] is True
    assert sched_res["metrics"]["scheduled"] > 0
    initial_scheduled = sched_res["metrics"]["scheduled"]

    # 3. Company Late Replan
    c_id = STATE["data"]["companies"][0].id
    replan_res = replan(DisruptionParams(type="company_late", target_id=c_id, hours_late=2))
    assert "diff" in replan_res
    assert "post_replan_state" in replan_res
    diff = replan_res["diff"]
    assert diff["unaffected_count"] + len(diff["moved"]) + len(diff["cancelled"]) == initial_scheduled
    assert diff["pct_unaffected"] > 80.0

def test_api_panel_drop():
    generate(GenerateParams(num_companies=10, num_students=120, num_rooms=6, seed=42))
    sched_res = schedule()
    initial_scheduled = sched_res["metrics"]["scheduled"]
    
    c_id = STATE["data"]["companies"][0].id
    replan_res = replan(DisruptionParams(type="panel_drop", target_id=c_id))
    diff = replan_res["diff"]
    assert diff["pct_unaffected"] > 80.0

def test_api_student_withdraw():
    generate(GenerateParams(num_companies=10, num_students=120, num_rooms=6, seed=42))
    sched_res = schedule()
    
    s_id = STATE["data"]["students"][0].id
    replan_res = replan(DisruptionParams(type="student_withdraw", target_id=s_id))
    diff = replan_res["diff"]
    assert diff["pct_unaffected"] > 80.0

def test_api_room_unavailable():
    generate(GenerateParams(num_companies=10, num_students=120, num_rooms=6, seed=42))
    sched_res = schedule()
    
    r_id = STATE["data"]["rooms"][0].id
    replan_res = replan(DisruptionParams(type="room_unavailable", target_id=r_id))
    diff = replan_res["diff"]
    assert diff["pct_unaffected"] > 70.0

if __name__ == "__main__":
    print("Running test_api_replan_flow...")
    test_api_replan_flow()
    print("Running test_api_panel_drop...")
    test_api_panel_drop()
    print("Running test_api_student_withdraw...")
    test_api_student_withdraw()
    print("Running test_api_room_unavailable...")
    test_api_room_unavailable()
    print("All replan API tests passed successfully!")

