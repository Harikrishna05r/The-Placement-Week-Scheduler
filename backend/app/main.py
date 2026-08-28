"""
Placement Week Scheduler API
Exposes:
    POST /generate   -> new dataset (companies/students/rooms/slots)
    POST /schedule    -> run solver on current dataset, return ScheduleResult + enriched schedule view
    POST /replan      -> apply a disruption + re-solve with minimal disturbance, return diff + post-replan state
    GET  /state        -> current schedule, rooms, slots, companies, metrics, and unscheduled list

Kept in-memory (module-level dict) for the demo tool.
"""
from __future__ import annotations
import copy
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dataclasses import asdict

from app.generator.generate import generate_dataset
from app.scheduler.solve import solve_schedule
from app.scheduler.explain import explain_unscheduled
from app.models.entities import Assignment, ScheduleResult

app = FastAPI(title="Placement Week Scheduler API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE = {"data": None, "result": None}


class GenerateParams(BaseModel):
    num_companies: int = 35
    num_students: int = 800
    num_rooms: int = 20
    seed: int = 42


class DisruptionParams(BaseModel):
    type: str                     # "company_late" | "panel_drop" | "student_withdraw" | "room_unavailable"
    target_id: str                 # company_id / panel_no / student_id / room_id depending on type
    hours_late: int | None = None
    panel_no: int | None = None


def serialize_schedule_payload(data: dict, result: ScheduleResult) -> dict:
    company_by_id = {c.id: c for c in data["companies"]}
    interview_by_id = {i.id: i for i in data["interviews"]}

    serialized_assignments = []
    for a in result.assignments:
        inv = interview_by_id.get(a.interview_id)
        comp = company_by_id.get(inv.company_id) if inv else None
        serialized_assignments.append({
            "interview_id": a.interview_id,
            "room_id": a.room_id,
            "panel_no": a.panel_no,
            "slot_id": a.slot_id,
            "company_id": inv.company_id if inv else "",
            "company_name": comp.name if comp else "",
            "student_id": inv.student_id if inv else "",
            "priority": comp.priority if comp else 2,
            "duration_min": inv.duration_min if inv else 30,
        })

    serialized_unscheduled = []
    for u in result.unscheduled:
        inv = interview_by_id.get(u.get("interview_id"))
        comp = company_by_id.get(inv.company_id) if inv else None
        serialized_unscheduled.append({
            "interview_id": u.get("interview_id"),
            "company_id": u.get("company_id", inv.company_id if inv else ""),
            "company_name": comp.name if comp else "",
            "student_id": u.get("student_id", inv.student_id if inv else ""),
            "priority": comp.priority if comp else 2,
            "reason": u.get("reason", "unknown"),
            "detail": u.get("detail", "Constraint conflict prevented placement"),
        })

    serialized_rooms = [{"id": r.id, "name": r.name, "capacity": r.capacity} for r in data["rooms"]]
    serialized_slots = [{"id": s.id, "day": s.day, "start_min": s.start_min, "end_min": s.end_min} for s in data["slots"]]
    serialized_companies = [
        {
            "id": c.id,
            "name": c.name,
            "tier": c.tier.value if hasattr(c.tier, "value") else str(c.tier),
            "day": c.day,
            "num_panels": c.num_panels,
            "interview_duration_min": c.interview_duration_min,
            "priority": c.priority,
            "earliest_start_min": c.earliest_start_min,
            "shortlist_count": len(c.shortlisted_student_ids),
        }
        for c in data["companies"]
    ]

    days_count = len(set(s.day for s in data["slots"])) if "slots" in data and data["slots"] else 4
    summary = {
        "companies": len(data["companies"]),
        "students": len(data["students"]),
        "rooms": len(data["rooms"]),
        "total_interviews": len(data["interviews"]),
        "days": days_count,
    }

    return {
        "scheduled": True,
        "summary": summary,
        "metrics": result.metrics,
        "rooms": serialized_rooms,
        "slots": serialized_slots,
        "companies": serialized_companies,
        "assignments": serialized_assignments,
        "unscheduled": serialized_unscheduled,
    }


@app.post("/generate")
def generate(params: GenerateParams):
    STATE["data"] = generate_dataset(
        num_companies=params.num_companies,
        num_students=params.num_students,
        num_rooms=params.num_rooms,
        seed=params.seed,
    )
    STATE["result"] = None
    d = STATE["data"]
    return {
        "companies": len(d["companies"]),
        "students": len(d["students"]),
        "rooms": len(d["rooms"]),
        "interviews": len(d["interviews"]),
        "slots": len(d["slots"]),
        "company_list": [{"id": c.id, "name": c.name, "day": c.day, "num_panels": c.num_panels} for c in d["companies"]],
        "room_list": [{"id": r.id, "name": r.name} for r in d["rooms"]],
    }


@app.post("/schedule")
def schedule():
    d = STATE["data"]
    if d is None:
        return {"error": "call /generate first"}
    result = solve_schedule(
        interviews=d["interviews"], companies=d["companies"],
        rooms=d["rooms"], slots=d["slots"], students=d["students"],
    )
    result.unscheduled = explain_unscheduled(
        unscheduled=result.unscheduled,
        interviews=d["interviews"],
        companies=d["companies"],
        rooms=d["rooms"],
        slots=d["slots"],
        assignments=result.assignments,
    )
    STATE["result"] = result
    return serialize_schedule_payload(d, result)


@app.post("/replan")
def replan(disruption: DisruptionParams):
    """
    Handle disruptions by mutating a working copy of the dataset and re-solving
    with locked_assignments to minimize churn:
      1. company_late (target_id=company_id, hours_late=int)
      2. panel_drop (target_id=company_id, panel_no=int)
      3. student_withdraw (target_id=student_id)
      4. room_unavailable (target_id=room_id)
    """
    if STATE["data"] is None or STATE["result"] is None:
        raise HTTPException(status_code=400, detail="Must call /generate and /schedule before /replan")

    base_data = STATE["data"]
    base_result = STATE["result"]
    prior_assignments = {a.interview_id: a for a in base_result.assignments}
    interview_by_id = {i.id: i for i in base_data["interviews"]}
    slot_by_id = {s.id: s for s in base_data["slots"]}
    company_by_id = {c.id: c for c in base_data["companies"]}

    mutated_data = copy.deepcopy(base_data)
    invalidated_ids: set[str] = set()

    if disruption.type == "company_late":
        cid = disruption.target_id
        hrs = disruption.hours_late or 1
        comp = next((c for c in mutated_data["companies"] if c.id == cid), None)
        if not comp:
            raise HTTPException(status_code=404, detail=f"Company {cid} not found")
        comp.earliest_start_min = 540 + hrs * 60
        # Invalidate prior assignments for this company on its day before the new start time
        for a in base_result.assignments:
            inv = interview_by_id.get(a.interview_id)
            if inv and inv.company_id == cid:
                s = slot_by_id.get(a.slot_id)
                if s and s.day == comp.day and s.start_min < comp.earliest_start_min:
                    invalidated_ids.add(a.interview_id)

    elif disruption.type == "panel_drop":
        cid = disruption.target_id
        comp = next((c for c in mutated_data["companies"] if c.id == cid), None)
        if not comp:
            raise HTTPException(status_code=404, detail=f"Company {cid} not found")
        target_panel = disruption.panel_no or comp.num_panels
        comp.num_panels = max(1, comp.num_panels - 1)
        for a in base_result.assignments:
            inv = interview_by_id.get(a.interview_id)
            if inv and inv.company_id == cid and (a.panel_no == target_panel or a.panel_no > comp.num_panels):
                invalidated_ids.add(a.interview_id)

    elif disruption.type == "student_withdraw":
        sid = disruption.target_id
        student = next((s for s in mutated_data["students"] if s.id == sid), None)
        if not student:
            raise HTTPException(status_code=404, detail=f"Student {sid} not found")
        student.withdrawn = True
        mutated_data["interviews"] = [i for i in mutated_data["interviews"] if i.student_id != sid]
        for a in base_result.assignments:
            inv = interview_by_id.get(a.interview_id)
            if inv and inv.student_id == sid:
                invalidated_ids.add(a.interview_id)

    elif disruption.type == "room_unavailable":
        rid = disruption.target_id
        room = next((r for r in mutated_data["rooms"] if r.id == rid), None)
        if not room:
            raise HTTPException(status_code=404, detail=f"Room {rid} not found")
        mutated_data["rooms"] = [r for r in mutated_data["rooms"] if r.id != rid]
        for a in base_result.assignments:
            if a.room_id == rid:
                invalidated_ids.add(a.interview_id)

    else:
        raise HTTPException(status_code=400, detail=f"Unknown disruption type: {disruption.type}")

    # Re-solve with locked assignments and disturbance penalty
    new_result = solve_schedule(
        interviews=mutated_data["interviews"],
        companies=mutated_data["companies"],
        rooms=mutated_data["rooms"],
        slots=mutated_data["slots"],
        students=mutated_data["students"],
        locked_assignments=prior_assignments,
        invalidated_interview_ids=invalidated_ids,
        disturbance_penalty=50,
    )

    new_result.unscheduled = explain_unscheduled(
        unscheduled=new_result.unscheduled,
        interviews=mutated_data["interviews"],
        companies=mutated_data["companies"],
        rooms=mutated_data["rooms"],
        slots=mutated_data["slots"],
        assignments=new_result.assignments,
    )

    # Compute detailed diff
    new_assigned_map = {a.interview_id: a for a in new_result.assignments}
    moved = []
    unaffected_count = 0
    affected_students = set()
    affected_companies = set()

    for i_id, old_a in prior_assignments.items():
        inv = interview_by_id.get(i_id)
        if i_id in new_assigned_map:
            new_a = new_assigned_map[i_id]
            if (old_a.room_id != new_a.room_id or 
                old_a.panel_no != new_a.panel_no or 
                old_a.slot_id != new_a.slot_id):
                moved.append({
                    "interview_id": i_id,
                    "company_id": inv.company_id if inv else "",
                    "company_name": company_by_id[inv.company_id].name if inv and inv.company_id in company_by_id else "",
                    "student_id": inv.student_id if inv else "",
                    "old": {"room": old_a.room_id, "panel": old_a.panel_no, "slot": old_a.slot_id},
                    "new": {"room": new_a.room_id, "panel": new_a.panel_no, "slot": new_a.slot_id},
                })
                if inv:
                    affected_students.add(inv.student_id)
                    affected_companies.add(inv.company_id)
            else:
                unaffected_count += 1

    cancelled = []
    unsched_reasons = {u["interview_id"]: u for u in new_result.unscheduled}
    for i_id, old_a in prior_assignments.items():
        if i_id not in new_assigned_map:
            inv = interview_by_id.get(i_id)
            u_info = unsched_reasons.get(i_id, {})
            cancelled.append({
                "interview_id": i_id,
                "company_id": inv.company_id if inv else "",
                "company_name": company_by_id[inv.company_id].name if inv and inv.company_id in company_by_id else "",
                "student_id": inv.student_id if inv else "",
                "reason": u_info.get("reason", "cancelled_in_replan"),
                "detail": u_info.get("detail", "Cancelled during replan to accommodate disruption"),
            })
            if inv:
                affected_students.add(inv.student_id)
                affected_companies.add(inv.company_id)

    newly_scheduled = []
    for i_id, new_a in new_assigned_map.items():
        if i_id not in prior_assignments:
            inv = interview_by_id.get(i_id)
            newly_scheduled.append({
                "interview_id": i_id,
                "company_id": inv.company_id if inv else "",
                "company_name": company_by_id[inv.company_id].name if inv and inv.company_id in company_by_id else "",
                "student_id": inv.student_id if inv else "",
                "room": new_a.room_id,
                "panel": new_a.panel_no,
                "slot": new_a.slot_id,
            })
            if inv:
                affected_students.add(inv.student_id)
                affected_companies.add(inv.company_id)

    diff = {
        "moved": moved,
        "cancelled": cancelled,
        "newly_scheduled": newly_scheduled,
        "unaffected_count": unaffected_count,
        "total_prior_scheduled": len(prior_assignments),
        "pct_unaffected": round(100 * unaffected_count / len(prior_assignments), 2) if prior_assignments else 100.0,
        "affected_students": sorted(list(affected_students)),
        "affected_companies": sorted(list(affected_companies)),
    }

    # Update STATE
    STATE["data"] = mutated_data
    STATE["result"] = new_result

    post_replan_payload = serialize_schedule_payload(mutated_data, new_result)
    return {
        "diff": diff,
        "post_replan_state": post_replan_payload,
    }


@app.get("/state")
def state():
    if STATE["data"] is None or STATE["result"] is None:
        if STATE["data"] is not None:
            d = STATE["data"]
            days_count = len(set(s.day for s in d["slots"])) if "slots" in d and d["slots"] else 4
            summary = {
                "companies": len(d["companies"]),
                "students": len(d["students"]),
                "rooms": len(d["rooms"]),
                "total_interviews": len(d["interviews"]),
                "days": days_count,
            }
            return {
                "scheduled": False,
                "summary": summary,
                "companies": len(d["companies"]),
                "students": len(d["students"]),
                "rooms": len(d["rooms"]),
                "interviews": len(d["interviews"]),
                "slots": len(d["slots"]),
                "company_list": [{"id": c.id, "name": c.name, "day": c.day, "num_panels": c.num_panels} for c in d["companies"]],
                "room_list": [{"id": r.id, "name": r.name} for r in d["rooms"]],
            }
        return {"scheduled": False}
    return serialize_schedule_payload(STATE["data"], STATE["result"])
