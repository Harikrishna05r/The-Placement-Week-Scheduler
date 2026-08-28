"""
Core data model for the Placement Week Scheduler.

Kept as plain dataclasses (not ORM models) so the generator, solver,
and API layer can all share the same objects without a DB round-trip.
Swap in SQLAlchemy models later if you want persistence beyond a run.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum


class Tier(str, Enum):
    MASS_RECRUITER = "mass_recruiter"   # Day 1, huge shortlists, low cutoff
    MID_TIER = "mid_tier"               # Day 2-3, moderate shortlists
    NICHE = "niche"                     # Day 4, small shortlists, high cutoff


@dataclass
class Company:
    id: str
    name: str
    tier: Tier
    day: int                    # 1-4
    cgpa_cutoff: float
    num_panels: int
    interview_duration_min: int
    priority: int                # 1 (highest) - 3 (lowest); used when bending constraints
    shortlisted_student_ids: list[str] = field(default_factory=list)


@dataclass
class Student:
    id: str
    name: str
    branch: str
    cgpa: float
    # company_id -> shortlisted (populated from the company side too, kept
    # here for O(1) lookup when checking a student's day)
    shortlists: list[str] = field(default_factory=list)
    withdrawn: bool = False


@dataclass
class Room:
    id: str
    name: str
    capacity: int = 1            # interviews that can run in parallel (usually 1 panel/room)


@dataclass
class TimeSlot:
    id: str
    day: int
    start_min: int                # minutes from day start, e.g. 9:00 = 540
    end_min: int


@dataclass
class Interview:
    """One (company, student) interview that needs room+panel+slot."""
    id: str
    company_id: str
    student_id: str
    duration_min: int


@dataclass
class Assignment:
    """A scheduled interview: which room, panel, and slot it landed in."""
    interview_id: str
    room_id: str
    panel_no: int
    slot_id: str


@dataclass
class ScheduleResult:
    assignments: list[Assignment]
    unscheduled: list[dict]        # [{interview_id, reason}]
    metrics: dict
