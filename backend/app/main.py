"""
Minimal API surface for the coordinator dashboard.

    POST /generate   -> new dataset (companies/students/rooms/slots)
    POST /schedule    -> run solver on current dataset, return ScheduleResult
    POST /replan      -> apply a disruption + re-solve with minimal disturbance
    GET  /state        -> current schedule + metrics (what the dashboard polls)

Kept in-memory (module-level dict) for the assignment; swap for a DB if
you want the coordinator's changes to survive a server restart.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dataclasses import asdict

from app.generator.generate import generate_dataset
from app.scheduler.solve import solve_schedule
from app.scheduler.explain import explain_unscheduled

app = FastAPI(title="Placement Week Scheduler")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STATE = {"data": None, "result": None}


class GenerateParams(BaseModel):
    num_companies: int = 35
    num_students: int = 800
    num_rooms: int = 20
    seed: int = 42


class DisruptionParams(BaseModel):
    type: str          # "company_late" | "panel_drop" | "student_withdraw" | "room_unavailable"
    target_id: str      # company_id / panel_no / student_id / room_id depending on type
    hours_late: int | None = None


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
    return {"metrics": result.metrics, "unscheduled_sample": result.unscheduled[:10]}


@app.post("/replan")
def replan(disruption: DisruptionParams):
    """
    TODO (this is the heart of the assignment -- implement per disruption type):
      - company_late: push that company's candidate slots forward by hours_late
      - panel_drop: reduce that company's num_panels, re-solve
      - student_withdraw: mark student withdrawn, drop their pending interviews
      - room_unavailable: remove that room from the pool for affected slots
    Then re-solve with `locked_assignments=previous_result` so the objective
    penalizes moving anything that didn't need to move, and return a diff:
    {moved: [...], cancelled: [...], newly_scheduled: [...]}
    """
    return {"error": "not yet implemented -- see TODO in replan()"}


@app.get("/state")
def state():
    if STATE["result"] is None:
        return {"scheduled": False}
    return {"scheduled": True, "metrics": STATE["result"].metrics}
