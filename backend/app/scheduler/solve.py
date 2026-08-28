"""
Core scheduler: assigns every interview a (room, panel, slot) such that:
  - no student is in two interviews whose slots overlap
  - no room hosts two interviews at the same time
  - no panel (company_id, panel_no) is double-booked at the same time
  - a company's interviews only land on/after its `day`
  - late arrivals for companies are respected via earliest_start_min

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
                   invalidated_interview_ids: set[str] | None = None,
                   disturbance_penalty: int = 50,
                   time_limit_sec: float = 30.0) -> ScheduleResult:
    """
    interviews: list[Interview]
    companies, rooms, slots, students: lookup lists
    locked_assignments: {interview_id: Assignment} from a PRIOR schedule.
        When provided, the objective penalizes changing these (used by
        the replan engine to minimize disturbance). Pass None for a
        first-time schedule.
    invalidated_interview_ids: set[str] of interview IDs directly affected
        by the disruption, omitted from solution hints so CP-SAT initializes
        with a strictly feasible starting schedule.
    """
    company_by_id = {c.id: c for c in companies}
    slot_by_id = {s.id: s for s in slots}
    room_ids = [r.id for r in rooms]
    num_rooms = len(rooms)
    invalidated = invalidated_interview_ids or set()

    available_days = sorted(list(set(s.day for s in slots)))
    day_start_min = {}
    day_end_min = {}
    day_slots = defaultdict(list)
    for s in slots:
        day_slots[s.day].append(s)
    for d in available_days:
        day_start_min[d] = min(s.start_min for s in day_slots[d])
        day_end_min[d] = max(s.end_min for s in day_slots[d])

    model = cp_model.CpModel()

    scheduled = {}          # interview.id -> BoolVar (is_present)
    start_vars = {}         # interview.id -> IntVar

    all_intervals = []
    company_intervals = defaultdict(list)
    student_intervals = defaultdict(list)

    for interview in interviews:
        company = company_by_id[interview.company_id]
        dur = interview.duration_min

        # Allowed slot start times in global minutes aligned with valid discrete slots
        allowed_starts = []
        for d in available_days:
            if d >= company.day:
                d_start = day_start_min[d]
                if d == company.day and getattr(company, "earliest_start_min", None) is not None:
                    d_start = max(d_start, company.earliest_start_min)
                
                for s in day_slots[d]:
                    if s.start_min >= d_start and s.start_min + dur <= day_end_min[d]:
                        g_start = (d - 1) * 1440 + s.start_min
                        allowed_starts.append(g_start)

        is_present = model.NewBoolVar(f"sched_{interview.id}")
        scheduled[interview.id] = is_present

        if not allowed_starts or num_rooms == 0 or company.num_panels == 0:
            model.Add(is_present == 0)
            continue

        start = model.NewIntVarFromDomain(cp_model.Domain.FromValues(allowed_starts), f"start_{interview.id}")
        end = model.NewIntVar(min(allowed_starts), max(allowed_starts) + dur, f"end_{interview.id}")
        model.Add(end == start + dur)

        start_vars[interview.id] = start

        main_interval = model.NewOptionalIntervalVar(
            start, dur, end, is_present, f"int_{interview.id}"
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

    # --- objective function + locked disturbance penalties ---
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

                # Supply solution hint if not directly invalidated by disruption
                if interview.id not in invalidated:
                    model.AddHint(scheduled[interview.id], 1)
                    model.AddHint(start_vars[interview.id], prior_start_global)
                    model.AddHint(matches, 1)

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

        # Sort scheduled interviews for deterministic greedy room/panel allocation
        scheduled_items.sort(key=lambda item: (item["start"], item["end"]))

        # Assign room tracks (preserving prior room when available)
        room_end_times = {r_id: 0 for r_id in room_ids}
        for item in scheduled_items:
            i_id = item["interview"].id
            prior_r = locked_assignments.get(i_id).room_id if (locked_assignments and i_id in locked_assignments) else None
            
            if prior_r in room_end_times and room_end_times[prior_r] <= item["start"]:
                item["room_id"] = prior_r
                room_end_times[prior_r] = item["end"]
            else:
                for r_id in room_ids:
                    if room_end_times[r_id] <= item["start"]:
                        item["room_id"] = r_id
                        room_end_times[r_id] = item["end"]
                        break

        # Assign panel tracks per company (preserving prior panel when available)
        by_company = defaultdict(list)
        for item in scheduled_items:
            by_company[item["interview"].company_id].append(item)

        for cid, items in by_company.items():
            c = company_by_id[cid]
            panel_end_times = [0] * (c.num_panels + 1)
            for item in items:
                i_id = item["interview"].id
                prior_p = locked_assignments.get(i_id).panel_no if (locked_assignments and i_id in locked_assignments) else None
                
                if prior_p and 1 <= prior_p <= c.num_panels and panel_end_times[prior_p] <= item["start"]:
                    item["panel_no"] = prior_p
                    panel_end_times[prior_p] = item["end"]
                else:
                    for p_no in range(1, c.num_panels + 1):
                        if panel_end_times[p_no] <= item["start"]:
                            item["panel_no"] = p_no
                            panel_end_times[p_no] = item["end"]
                            break

        slot_map = {(s.day, s.start_min): s.id for s in slots}
        for item in scheduled_items:
            interview = item["interview"]
            val_start = item["start"]
            day = (val_start // 1440) + 1
            start_min_in_day = val_start % 1440
            slot_id = slot_map.get((day, start_min_in_day), slots[0].id)
            assignments.append(Assignment(interview.id, item["room_id"], item["panel_no"], slot_id))
    else:
        for interview in interviews:
            unscheduled.append({
                "interview_id": interview.id,
                "company_id": interview.company_id,
                "student_id": interview.student_id,
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
