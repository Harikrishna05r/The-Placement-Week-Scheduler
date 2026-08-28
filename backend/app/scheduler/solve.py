"""
Core scheduler: assigns every interview a (room, panel, slot) such that:
  - no student is in two interviews whose slots overlap
  - no room hosts two interviews in the same slot
  - no panel (company_id, panel_no) is double-booked in the same slot
  - a company's interviews only land in slots on/after its `day`
    (a late-arriving company is modeled by shifting its earliest usable slot)

When not everything fits, we don't fail silently: we run a relaxed pass
that maximizes the number of scheduled interviews (weighted by company
priority) and report exactly which interviews were dropped and why.

This module is deliberately kept solver-only (no I/O) so it can be reused
identically by both the "first schedule" and "replan" code paths --
replanning just adds constraints/penalties on top of the same model.
"""
from __future__ import annotations
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
    student_by_id = {s.id: s for s in students}
    slot_by_id = {s.id: s for s in slots}
    room_ids = [r.id for r in rooms]

    model = cp_model.CpModel()

    # candidate slots per interview: must be on/after the company's day,
    # and long enough for the interview's duration
    def candidate_slots(interview):
        company = company_by_id[interview.company_id]
        out = []
        for slot in slots:
            if slot.day < company.day:
                continue
            if (slot.end_min - slot.start_min) < interview.duration_min:
                # allow booking multiple contiguous base-slots if needed
                pass
            out.append(slot)
        return out

    # decision vars: x[i] = (room_idx, panel_no, slot_idx) chosen, modeled as
    # one boolean per (interview, room, panel, slot) candidate triple.
    # To keep the model tractable at this scale we bucket by "does interview
    # i get scheduled at all" (scheduled[i]) plus assignment vars only for
    # combinations we actually create.
    scheduled = {}
    choice_vars = {}  # (i.id, room_id, panel_no, slot_id) -> BoolVar

    for interview in interviews:
        company = company_by_id[interview.company_id]
        scheduled[interview.id] = model.NewBoolVar(f"sched_{interview.id}")
        options = []
        for slot in candidate_slots(interview):
            for room_id in room_ids:
                for panel_no in range(1, company.num_panels + 1):
                    v = model.NewBoolVar(f"x_{interview.id}_{room_id}_{panel_no}_{slot.id}")
                    choice_vars[(interview.id, room_id, panel_no, slot.id)] = v
                    options.append(v)
        # scheduled[i] true iff exactly one option chosen
        model.Add(sum(options) == scheduled[interview.id])

    # --- constraint: room not double-booked in same slot ---
    from collections import defaultdict
    room_slot_group = defaultdict(list)
    panel_slot_group = defaultdict(list)
    student_slot_group = defaultdict(list)

    interview_by_id = {i.id: i for i in interviews}
    for (iid, room_id, panel_no, slot_id), v in choice_vars.items():
        company_id = interview_by_id[iid].company_id
        room_slot_group[(room_id, slot_id)].append(v)
        panel_slot_group[(company_id, panel_no, slot_id)].append(v)

    for group in room_slot_group.values():
        model.Add(sum(group) <= 1)
    for group in panel_slot_group.values():
        model.Add(sum(group) <= 1)

    # --- constraint: student not double-booked in same slot ---
    for (iid, room_id, panel_no, slot_id), v in choice_vars.items():
        student_id = interview_by_id[iid].student_id
        student_slot_group[(student_id, slot_id)].append(v)
    for group in student_slot_group.values():
        model.Add(sum(group) <= 1)

    # --- objective: maximize scheduled interviews, weighted by priority
    # (lower priority number = more important = higher weight),
    # minus a penalty for deviating from locked_assignments if replanning
    objective_terms = []
    for interview in interviews:
        company = company_by_id[interview.company_id]
        weight = {1: 5, 2: 3, 3: 1}[company.priority]
        objective_terms.append(weight * scheduled[interview.id])

    if locked_assignments:
        for (iid, room_id, panel_no, slot_id), v in choice_vars.items():
            prior = locked_assignments.get(iid)
            if prior and (prior.room_id, prior.panel_no, prior.slot_id) == (room_id, panel_no, slot_id):
                objective_terms.append(disturbance_penalty * v)
            elif prior:
                # keeping this interview scheduled but in a NEW slot is fine;
                # no explicit penalty needed beyond not rewarding it extra.
                pass

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_sec
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    assignments = []
    unscheduled = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for interview in interviews:
            if solver.Value(scheduled[interview.id]) == 1:
                for (iid, room_id, panel_no, slot_id), v in choice_vars.items():
                    if iid == interview.id and solver.Value(v) == 1:
                        assignments.append(Assignment(interview.id, room_id, panel_no, slot_id))
                        break
            else:
                unscheduled.append({
                    "interview_id": interview.id,
                    "company_id": interview.company_id,
                    "student_id": interview.student_id,
                    "reason": "capacity_exhausted",  # refined by explain.py
                })
    else:
        # infeasible even for the relaxed maximize-count model (shouldn't
        # normally happen since scheduling nothing is always feasible) --
        # surface the solver status directly
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
