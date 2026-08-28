"""
Core scheduler: assigns every interview a (room, panel, slot) such that:
  - no student is in two interviews whose slots overlap
  - no room hosts two interviews at the same time
  - no panel (company_id, panel_no) is double-booked at the same time
  - a company's interviews only land on/after its `day`

Uses OR-Tools CP-SAT Interval variables, AddCumulative, and AddNoOverlap constraints for high performance.

This module is deliberately kept solver-only (no I/O) so it can be reused
identically by both the "first schedule" and "replan" code paths.
"""
from __future__ import annotations
from collections import defaultdict
from ortools.sat.python import cp_model
from app.models.entities import Assignment, ScheduleResult


def solve_schedule(interviews, companies, rooms, slots, students,
                    locked_assignments: dict[str, Assignment] | None = None,
                    disturbance_penalty: int = 5,
                    time_limit_sec: float = 30.0) -> ScheduleResult:
    """
    interviews: list[Interview]
    companies, rooms, slots, students: lookup lists
    locked_assignments: {interview_id: Assignment} from a PRIOR schedule.
        When provided, the objective penalizes changing these (used by
        the replan engine to minimize disturbance). Pass None for a
        first-time schedule.
    """
    company_by_id = {c.id: c for c in companies}
    slot_by_id = {s.id: s for s in slots}
    room_ids = [r.id for r in rooms]
    num_rooms = len(rooms)

    available_days = sorted(list(set(s.day for s in slots)))
    day_start_min = {}
    day_end_min = {}
    for d in available_days:
        day_slots = [s for s in slots if s.day == d]
        day_start_min[d] = min(s.start_min for s in day_slots)
        day_end_min[d] = max(s.end_min for s in day_slots)

    model = cp_model.CpModel()

    scheduled = {}          # interview.id -> BoolVar (is_present)
    start_vars = {}         # interview.id -> IntVar

    all_intervals = []
    company_intervals = defaultdict(list)
    student_intervals = defaultdict(list)

    for interview in interviews:
        company = company_by_id[interview.company_id]

        # Calculate valid start-time intervals in global minutes across allowed days
        valid_intervals = []
        for d in available_days:
            if d >= company.day:
                s_lim = (d - 1) * 1440 + day_start_min[d]
                e_lim = (d - 1) * 1440 + day_end_min[d] - interview.duration_min
                if e_lim >= s_lim:
                    valid_intervals.append([s_lim, e_lim])

        is_present = model.NewBoolVar(f"sched_{interview.id}")
        scheduled[interview.id] = is_present

        if not valid_intervals or num_rooms == 0 or company.num_panels == 0:
            model.Add(is_present == 0)
            continue

        domain = cp_model.Domain.FromIntervals(valid_intervals)
        start = model.NewIntVarFromDomain(domain, f"start_{interview.id}")
        end = model.NewIntVar(domain.min(), domain.max() + interview.duration_min, f"end_{interview.id}")
        model.Add(end == start + interview.duration_min)

        start_vars[interview.id] = start

        main_interval = model.NewOptionalIntervalVar(
            start, interview.duration_min, end, is_present, f"int_{interview.id}"
        )
        all_intervals.append(main_interval)
        company_intervals[company.id].append(main_interval)
        student_intervals[interview.student_id].append(main_interval)

    # Room capacity track: no more than num_rooms concurrent interviews
    if all_intervals and num_rooms > 0:
        model.AddCumulative(all_intervals, [1] * len(all_intervals), num_rooms)

    # Panel capacity track per company: no more than company.num_panels concurrent interviews
    for cid, intervals in company_intervals.items():
        c = company_by_id[cid]
        if intervals and c.num_panels > 0:
            model.AddCumulative(intervals, [1] * len(intervals), c.num_panels)

    # Student track: no overlapping interviews for the same student
    for sid, intervals in student_intervals.items():
        model.AddNoOverlap(intervals)

    # --- objective function ---
    objective_terms = []
    for interview in interviews:
        company = company_by_id[interview.company_id]
        weight = {1: 5, 2: 3, 3: 1}[company.priority]
        objective_terms.append(weight * scheduled[interview.id])

        if locked_assignments and interview.id in start_vars:
            prior = locked_assignments.get(interview.id)
            if prior and prior.slot_id in slot_by_id:
                prior_slot = slot_by_id[prior.slot_id]
                prior_start_global = (prior_slot.day - 1) * 1440 + prior_slot.start_min

                matches = model.NewBoolVar(f"matches_locked_{interview.id}")
                model.Add(scheduled[interview.id] == 1).OnlyEnforceIf(matches)
                model.Add(start_vars[interview.id] == prior_start_global).OnlyEnforceIf(matches)
                objective_terms.append(disturbance_penalty * matches)

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_sec
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    assignments = []
    unscheduled = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        scheduled_items = []
        for interview in interviews:
            if interview.id in start_vars and solver.Value(scheduled[interview.id]) == 1:
                val_start = solver.Value(start_vars[interview.id])
                scheduled_items.append({
                    "interview": interview,
                    "start": val_start,
                    "end": val_start + interview.duration_min,
                })
            else:
                unscheduled.append({
                    "interview_id": interview.id,
                    "company_id": interview.company_id,
                    "student_id": interview.student_id,
                    "reason": "capacity_exhausted",
                })

        # Sort scheduled interviews for greedy room and panel assignment
        scheduled_items.sort(key=lambda item: (item["start"], item["end"]))

        # Assign room tracks
        room_end_times = [0] * num_rooms
        for item in scheduled_items:
            for r_idx in range(num_rooms):
                if room_end_times[r_idx] <= item["start"]:
                    item["room_id"] = room_ids[r_idx]
                    room_end_times[r_idx] = item["end"]
                    break

        # Assign panel tracks per company
        by_company = defaultdict(list)
        for item in scheduled_items:
            by_company[item["interview"].company_id].append(item)

        for cid, items in by_company.items():
            c = company_by_id[cid]
            panel_end_times = [0] * (c.num_panels + 1)
            for item in items:
                for p_no in range(1, c.num_panels + 1):
                    if panel_end_times[p_no] <= item["start"]:
                        item["panel_no"] = p_no
                        panel_end_times[p_no] = item["end"]
                        break

        for item in scheduled_items:
            interview = item["interview"]
            val_start = item["start"]
            day = (val_start // 1440) + 1
            start_min_in_day = val_start % 1440
            day_slots = [s for s in slots if s.day == day]
            if not day_slots:
                day_slots = slots
            best_slot = min(day_slots, key=lambda s: abs(s.start_min - start_min_in_day))
            assignments.append(Assignment(interview.id, item["room_id"], item["panel_no"], best_slot.id))
    else:
        for interview in interviews:
            unscheduled.append({
                "interview_id": interview.id,
                "reason": f"solver_status_{solver.StatusName(status)}",
            })

    metrics = compute_metrics(interviews, assignments, unscheduled, rooms, slots)
    return ScheduleResult(assignments=assignments, unscheduled=unscheduled, metrics=metrics)


def compute_metrics(interviews, assignments, unscheduled, rooms, slots) -> dict:
    total = len(interviews)
    scheduled_count = len(assignments)
    room_slot_capacity = len(rooms) * len(slots)
    used_room_slots = len({(a.room_id, a.slot_id) for a in assignments})
    return {
        "total_interviews": total,
        "scheduled": scheduled_count,
        "unscheduled": len(unscheduled),
        "pct_scheduled": round(100 * scheduled_count / total, 2) if total else 0,
        "room_utilization_pct": round(100 * used_room_slots / room_slot_capacity, 2) if room_slot_capacity else 0,
    }
