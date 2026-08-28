# Placement Week Scheduler — starter scaffold

## What's here

```
backend/
  app/
    models/entities.py      # Company, Student, Room, TimeSlot, Interview, Assignment
    generator/generate.py    # realistic dataset generator (power-law shortlists)
    scheduler/solve.py       # CP-SAT scheduler -- WORKING BUT NEEDS THE FIX BELOW
    main.py                  # FastAPI: /generate /schedule /replan /state
  tests/test_solve_small.py  # smoke test on a tiny slice
frontend/                    # empty -- build the dashboard here (React/Vite suggested)
```

## Run it locally

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
# then in another terminal:
curl -X POST localhost:8000/generate -H "Content-Type: application/json" \
  -d '{"num_companies":35,"num_students":800,"num_rooms":20}'
curl -X POST localhost:8000/schedule
```

## STATUS — what's done vs. what's next

**Done and verified:**
- Generator produces realistic, CGPA-correlated, power-law shortlists (verified:
  top student on a 35-company/800-student run gets shortlisted by 27 companies;
  demand outstrips capacity — 3,627 interviews vs. 2,560 room-slots — so
  infeasibility is real, not synthetic).
- CP-SAT solver correctly enforces no-double-booking for students, rooms, and
  panels, and reports unscheduled interviews with a reason instead of failing
  silently.
- FastAPI skeleton boots and round-trips `/generate` → `/schedule`.

**Critical next task — solver scalability:**
The current model represents each interview as one boolean per
(room, panel, slot) combination. That's correct but explodes combinatorially —
at full scale (3,600+ interviews) it will not converge in reasonable time.
**Rewrite `solve_schedule` using CP-SAT interval variables**
(`model.NewOptionalIntervalVar` per interview, continuous start-time in
minutes, `model.AddNoOverlap` per room/panel/student track) instead of the
discrete slot cross-product. This is the standard formulation for
interview/exam timetabling and should handle the full dataset in seconds,
not minutes. Do this before building anything else on top of the solver.

**Not yet built (in priority order):**
1. Fix solver scalability (above).
2. Implement `/replan` for all four disruption types (company late, panel
   drop, student withdrawal, room unavailable) — reuse `solve_schedule` with
   a `locked_assignments` argument (already wired into the objective function)
   so replans are penalized for moving things unnecessarily.
3. Diff output for replans: `{moved, cancelled, newly_scheduled, unaffected_count}`.
4. Infeasibility explanation: when interviews can't be scheduled, report
   *why* (e.g. "room capacity exhausted 2-4pm Day 2") not just "capacity_exhausted".
5. React dashboard: timeline/Gantt view per room, conflict list, one-click
   replan button showing the diff before committing.
6. Write up your metrics (% scheduled, room utilization, student wait time,
   replan churn) and your constraint-bending policy — the assignment
   explicitly grades this reasoning, not just the code.

## Deploying for the live defense

Given the defense involves a live disruption injected in the room, prioritize
zero network risk over "looking deployed":
- **Primary:** run locally (`uvicorn` + `npm run dev`), screen-share.
- **Backup, so you have a link if asked:** push `backend/` to Render or
  Railway (free tier, auto-deploys from GitHub), and `frontend/` to Vercel.
  Point the frontend's API base URL at the deployed backend via an env var.

## Why CP-SAT and not a greedy/heuristic scheduler

A hand-rolled greedy assignment (sort by priority, assign first free slot)
is faster to write but can't answer "why is this infeasible" cleanly, and
can't be reused as-is for minimal-disturbance replanning. CP-SAT gives you
both for free: infeasibility diagnostics via constraint relaxation, and
minimal-disturbance replans via a penalty term in the objective for any
assignment that differs from the prior schedule. This is worth defending
explicitly in your write-up.
