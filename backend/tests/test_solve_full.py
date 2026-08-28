"""Run the solver on the full-scale dataset (3,600+ interviews across 4 days)
to verify performance and scheduling metrics."""
import time
from app.generator.generate import generate_dataset
from app.scheduler.solve import solve_schedule

print("Generating full dataset...")
data = generate_dataset(num_companies=35, num_students=800, num_rooms=20, seed=42)

print(f"Dataset generated: {len(data['companies'])} companies, {len(data['students'])} students, "
      f"{len(data['rooms'])} rooms, {len(data['slots'])} slots, {len(data['interviews'])} interviews.")

t0 = time.time()
result = solve_schedule(
    interviews=data["interviews"],
    companies=data["companies"],
    rooms=data["rooms"],
    slots=data["slots"],
    students=data["students"],
    time_limit_sec=60.0,
)
elapsed = time.time() - t0
print(f"Solved full dataset in {elapsed:.2f} seconds")
print("Metrics:", result.metrics)
print("Unscheduled sample:", result.unscheduled[:3])
print("Assignment sample:", result.assignments[:3])
