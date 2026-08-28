# Codex Prompts — Placement Week Scheduler

Use these in order. Each is self-contained: paste it into Codex in the repo root
(where `backend/` and `README.md` live) so it has the existing scaffold as context.
Run the acceptance check after each before moving to the next — don't stack
unverified changes.

---

## Prompt 1 — Rewrite the solver with interval variables (do this first)

```
Context: backend/app/scheduler/solve.py currently models scheduling as one
boolean variable per (interview, room, panel, slot) combination using
discrete 15-minute time slots. This does not scale past a few hundred
interviews -- it needs to handle ~3,600 interviews against 20 rooms and
128 time slots across 4 days.

Task: Rewrite solve_schedule() to use OR-Tools CP-SAT interval variables
instead of the discrete slot cross-product:
- Represent each interview's start time as an IntVar in minutes-from-day-start
  (respecting the interview's actual duration_min, not a fixed 15-min grid).
- Use model.NewOptionalIntervalVar(start, duration, end, is_present, name) per
  interview, where is_present replaces the old `scheduled[i]` boolean.
- Assign each interview to exactly one room (IntVar over room indices) and one
  panel number for its company.
- Use model.AddNoOverlap() per (room) track, per (company, panel_no) track,
  and per student track, instead of the current sum<=1 constraints over
  slot buckets.
- Preserve the existing function signature (interviews, companies, rooms,
  slots, students, locked_assignments=None, disturbance_penalty=5,
  time_limit_sec=30.0) and return type (ScheduleResult with .assignments,
  .unscheduled, .metrics) so nothing else in the codebase needs to change.
- Keep the constraint that a company's interviews can't start before its
  `day` (map day -> minutes-from-epoch using the existing slots list to get
  day boundaries, or compute day boundaries directly instead of depending on
  discrete slot IDs).
- Convert the resulting start-time back to the nearest matching TimeSlot id
  when building Assignment objects, so the rest of the API (which expects
  Assignment.slot_id) keeps working unchanged.
- Keep the priority-weighted objective (priority 1/2/3 -> weight 5/3/1) and
  the locked_assignments disturbance penalty exactly as they currently work.

Acceptance check: backend/tests/test_solve_small.py should now solve in
under 5 seconds instead of hitting the 20s time limit, and scheduled % should
be meaningfully higher than the current 40% for the same small dataset
(5 rooms, 1 day, ~116 interviews) since capacity clearly allows more. Then
write and run a new test at full scale (35 companies, 800 students, 20 rooms,
all 4 days) and report solve time and metrics -- it should complete in well
under a minute.
```

---

## Prompt 2 — Infeasibility explanations

```
Context: backend/app/scheduler/solve.py returns result.unscheduled as a list
of {interview_id, company_id, student_id, reason} where reason is currently
always the placeholder string "capacity_exhausted". This needs to be a real
diagnosis.

Task: Add a function explain_unscheduled(unscheduled, interviews, companies,
rooms, slots, assignments) in a new file backend/app/scheduler/explain.py
that, for each unscheduled interview, determines the most likely binding
constraint by checking, in order:
1. Was every room-slot combination valid for this interview (given its
   company's day) already occupied by a higher-priority interview? -> reason:
   "room_capacity" with the specific day/time range that was full.
2. Was the company's panel count the bottleneck (panels all busy across every
   valid slot for that company)? -> reason: "panel_capacity".
3. Did the student have a schedule conflict across ALL of their shortlisted
   companies such that no slot was free for this specific interview without
   colliding with a higher-priority one? -> reason: "student_conflict", and
   name the other company_id causing the conflict.
4. Otherwise -> reason: "unknown" (log this so we can investigate, it likely
   means a bug in the diagnosis logic, not the scheduler).

Each result should look like:
{interview_id, company_id, student_id, reason, detail: "<human-readable
explanation, e.g. 'All 20 rooms occupied by higher-priority interviews
between 2-4pm on Day 2'">}

Wire this into main.py's /schedule endpoint so unscheduled_sample includes
the detail field.

Acceptance check: run /generate + /schedule on the full dataset and print
5 unscheduled interviews with their detail strings -- confirm they read as
genuinely useful explanations a placement coordinator could act on, not
generic filler text.
```

---

## Prompt 3 — Implement /replan for all four disruption types

```
Context: backend/app/main.py has a /replan endpoint stubbed with a TODO.
backend/app/scheduler/solve.py already supports a locked_assignments
parameter that penalizes changing prior assignments in the objective
function -- this is the mechanism replanning should use.

Task: Implement replan(disruption: DisruptionParams) in main.py to handle
all four disruption types by mutating a working copy of the current dataset
and re-solving:

1. company_late (fields: target_id=company_id, hours_late=int):
   Push that company's earliest usable slot forward by hours_late. Any of
   its interviews already locked in at a time before (company's original
   start + hours_late) become invalid and must be re-solved into a new slot
   or dropped.

2. panel_drop (fields: target_id=company_id, plus a panel_no to drop -- add
   a panel_no field to DisruptionParams): Reduce that company's num_panels
   by removing the specified panel. Any interviews locked into that
   specific panel must be reassigned to a remaining panel or dropped.

3. student_withdraw (fields: target_id=student_id): Mark that student
   withdrawn=True and remove ALL their remaining (not-yet-completed)
   interviews from the interview list before re-solving. Interviews for that
   student that were already scheduled get freed up as capacity for others.

4. room_unavailable (fields: target_id=room_id): Remove that room from the
   room pool for the rest of the day (or entirely, your choice -- document
   which). Interviews locked into that room must be reassigned or dropped.

In all four cases:
- Take STATE["result"].assignments as locked_assignments and re-run
  solve_schedule() with the mutated dataset.
- Compute and return a diff comparing old assignments to new assignments:
  {
    moved: [{interview_id, old: {room,panel,slot}, new: {room,panel,slot}}],
    cancelled: [{interview_id, reason}],   # was scheduled, now isn't
    newly_scheduled: [{interview_id, room,panel,slot}],  # was unscheduled, now is
    unaffected_count: int,
    affected_students: [student_id, ...],   # anyone whose slot/room/panel changed
    affected_companies: [company_id, ...]
  }
- Update STATE["data"] and STATE["result"] to the new post-replan state.

Acceptance check: after /generate + /schedule, call /replan with each of the
four disruption types (test them one at a time against a fresh /schedule
each time) and confirm: (a) unaffected_count is the large majority of
previously-scheduled interviews -- if more than ~10-15% of unrelated
interviews moved for a single disruption, the disturbance_penalty in
solve_schedule needs to be increased; (b) the diff's moved/cancelled lists
are non-empty and specific to the disrupted company/student/room, not
scattered randomly across the whole schedule.
```

---

## Prompt 4 — React dashboard

```
Context: backend/app/main.py exposes /generate, /schedule, /replan, /state
over HTTP (CORS already open for all origins). frontend/ is currently empty.

Task: Build a React (Vite) app in frontend/ that gives a placement
coordinator a working-day view:
1. A control bar: "Generate dataset" (calls POST /generate with default
   params), "Run schedule" (calls POST /schedule), and shows the returned
   metrics (pct_scheduled, room_utilization_pct, counts) as a small stat row.
2. A room-by-time Gantt/timeline view: rows = rooms, columns = time slots
   grouped by day, cells = the interview scheduled there (company name +
   student id on hover/click). Color by company priority tier. Cells with
   no assignment are visibly empty, not just blank -- consider a subtle grid
   background so gaps read as "free room" not "missing data".
3. An "Unscheduled" panel listing interviews that couldn't be placed, showing
   the reason/detail text from the backend.
4. A "Trigger disruption" form: dropdown for disruption type
   (company_late / panel_drop / student_withdraw / room_unavailable), the
   relevant target ID field(s), and a "Replan" button that calls POST
   /replan and then displays the returned diff BEFORE applying it visually --
   show moved/cancelled/newly_scheduled counts and a list, with an explicit
   "Apply" step (don't silently re-render the whole Gantt chart on replan;
   the coordinator needs to see what changed first, per the assignment's
   requirement that replans must be reviewable, not silent).
5. Keep this to one focused screen -- no routing, no auth, this is a
   live-demo tool, not a production app. Plain fetch() calls against
   http://localhost:8000, with the base URL pulled from an env var
   (VITE_API_BASE) so it's easy to point at a deployed backend later.

Acceptance check: with the backend running locally, `npm run dev` should
produce a page where clicking Generate -> Schedule populates a visibly
readable Gantt view (even if just 1-2 days at a time via a day selector,
since 4 days x 20 rooms x 128 slots is a lot to show at once), and
triggering a company_late replan shows a diff panel before the schedule
updates.
```

---

## Prompt 5 — Metrics write-up scaffold

```
Context: The assignment requires defining and reporting your own metrics
(pct scheduled, student clashes avoided, room utilization, average student
waiting time, replan churn) plus a written justification for which
constraint bends first when the schedule is infeasible, and how much
reshuffling is acceptable during a replan.

Task: Add a script backend/scripts/report.py that runs /generate + /schedule
against the full-scale dataset, then computes and prints:
- pct_scheduled, room_utilization_pct (already in ScheduleResult.metrics)
- average and max student waiting time (gap between a student's consecutive
  scheduled interviews on the same day, in minutes)
- replan churn for each of the four disruption types: run one of each against
  the same base schedule (independently, not stacked) and report
  unaffected_count / total_scheduled as a percentage
- a short markdown summary (backend/scripts/METRICS.md) template with these
  numbers filled in and blank sections for "constraint bending order" and
  "acceptable reshuffling threshold" for me to fill in with my own reasoning.

Acceptance check: running the script end-to-end produces METRICS.md with all
numeric fields populated from an actual run, not placeholder values.
```
