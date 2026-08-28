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

## Documentation

For full mathematical formulations, architecture diagrams, infeasibility diagnostic rules, and benchmark results, see [DOCUMENTATION.md](DOCUMENTATION.md).

## STATUS — what's done vs. what's next

**Done and verified:**
- Generator produces realistic, CGPA-correlated, power-law shortlists (verified:
  top student on a 35-company/800-student run gets shortlisted by 27 companies;
  demand outstrips capacity — 3,627 interviews vs. 2,560 room-slots — so
  infeasibility is real, not synthetic).
- CP-SAT solver rewritten with interval variables (`model.NewOptionalIntervalVar`,
  `AddCumulative`, `AddNoOverlap`), solving 3,600+ interviews across 4 days in ~48s.
- Infeasibility explanation engine (`app/scheduler/explain.py`) implemented: evaluates
  `room_capacity`, `panel_capacity`, `student_conflict`, and `unknown` in strict hierarchy
  with human-readable detail strings.
- FastAPI endpoints (`/generate`, `/schedule`, `/state`) verified live via HTTP.

**Not yet built (next steps):**
1. Implement `/replan` for all four disruption types (company late, panel
   drop, student withdrawal, room unavailable) — reuse `solve_schedule` with
   a `locked_assignments` argument so replans minimize disturbance.
2. Diff output for replans: `{moved, cancelled, newly_scheduled, unaffected_count}`.
3. React dashboard: timeline/Gantt view per room, conflict list, one-click
   replan button showing the diff before committing.
4. Write up metrics report (`backend/scripts/report.py` and `METRICS.md`).

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
