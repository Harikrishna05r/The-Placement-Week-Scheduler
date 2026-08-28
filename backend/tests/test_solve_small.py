"""Run the solver on a deliberately small slice so we can see it work
before throwing the full 3,600-interview dataset at it."""
import time
from app.generator.generate import generate_dataset
from app.scheduler.solve import solve_schedule

data = generate_dataset(num_companies=4, num_students=60, num_rooms=5, seed=1)

# trim slots to a single day to keep the first smoke-test tiny
slots = [s for s in data["slots"] if s.day == 1]

t0 = time.time()
result = solve_schedule(
    interviews=data["interviews"],
    companies=data["companies"],
    rooms=data["rooms"],
    slots=slots,
    students=data["students"],
    time_limit_sec=20,
)
print(f"solved in {time.time()-t0:.1f}s")
print("metrics:", result.metrics)
print("unscheduled sample:", result.unscheduled[:3])
print("assignment sample:", result.assignments[:3])
