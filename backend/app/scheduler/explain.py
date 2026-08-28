"""
Infeasibility diagnosis for unscheduled placement interviews.

For each unscheduled interview, determines the most likely binding constraint
by checking the following hierarchy in order:
1. room_capacity: Every room-slot combination valid for this interview (given
   its company's day) was already occupied by a higher-priority interview.
2. panel_capacity: The company's panel count was the bottleneck (panels all
   busy across every valid slot for that company).
3. student_conflict: The student had schedule conflicts across their shortlisted
   companies such that no slot was free without colliding with a scheduled interview.
4. unknown: Otherwise (flagged for review).
"""
from __future__ import annotations
from collections import defaultdict
import logging
from app.models.entities import Company, Interview, Room, TimeSlot, Assignment

logger = logging.getLogger(__name__)


def _min_to_time_str(m: int) -> str:
    h = m // 60
    mins = m % 60
    am_pm = "am" if h < 12 else "pm"
    h_12 = h if 1 <= h <= 12 else (h - 12 if h > 12 else 12)
    if mins == 0:
        return f"{h_12}{am_pm}"
    return f"{h_12}:{mins:02d}{am_pm}"


def _format_time_range(start_min: int, end_min: int, day: int) -> str:
    return f"between {_min_to_time_str(start_min)}-{_min_to_time_str(end_min)} on Day {day}"


def explain_unscheduled(
    unscheduled: list[dict],
    interviews: list[Interview],
    companies: list[Company],
    rooms: list[Room],
    slots: list[TimeSlot],
    assignments: list[Assignment],
) -> list[dict]:
    """
    Diagnose why each interview in `unscheduled` was not placed by the solver.

    Returns a list of dicts:
    [
        {
            "interview_id": str,
            "company_id": str,
            "student_id": str,
            "reason": "room_capacity" | "panel_capacity" | "student_conflict" | "unknown",
            "detail": str,
        },
        ...
    ]
    """
    company_by_id = {c.id: c for c in companies}
    interview_by_id = {i.id: i for i in interviews}
    slot_by_id = {s.id: s for s in slots}
    num_rooms = len(rooms)

    # 1. Map all scheduled assignments to time intervals
    scheduled_items = []
    student_scheduled = defaultdict(list)
    company_scheduled = defaultdict(list)

    for a in assignments:
        inv = interview_by_id[a.interview_id]
        comp = company_by_id[inv.company_id]
        s = slot_by_id[a.slot_id]
        g_start = (s.day - 1) * 1440 + s.start_min
        g_end = g_start + inv.duration_min
        item = {
            "assignment": a,
            "interview": inv,
            "company": comp,
            "student_id": inv.student_id,
            "day": s.day,
            "start_min": s.start_min,
            "end_min": s.start_min + inv.duration_min,
            "g_start": g_start,
            "g_end": g_end,
            "priority": comp.priority,
        }
        scheduled_items.append(item)
        student_scheduled[inv.student_id].append(item)
        company_scheduled[comp.id].append(item)

    day_slots = defaultdict(list)
    for s in slots:
        day_slots[s.day].append(s)

    day_start_min = {d: min(s.start_min for s in day_slots[d]) for d in day_slots}
    day_end_min = {d: max(s.end_min for s in day_slots[d]) for d in day_slots}

    explained = []

    for u in unscheduled:
        inv_id = u["interview_id"]
        inv = interview_by_id[inv_id]
        comp = company_by_id[inv.company_id]
        sid = inv.student_id
        dur = inv.duration_min

        target_day = comp.day
        s_list = day_slots.get(target_day, [])
        valid_slots = [s for s in s_list if s.start_min + dur <= day_end_min[target_day]]

        if not valid_slots:
            detail = f"No valid time slots available for {dur}-minute interview on Day {target_day}"
            explained.append({
                "interview_id": inv_id,
                "company_id": comp.id,
                "student_id": sid,
                "reason": "room_capacity",
                "detail": detail,
            })
            continue

        d_start = min(s.start_min for s in valid_slots)
        d_end = max(s.start_min + dur for s in valid_slots)
        time_range_str = _format_time_range(d_start, d_end, target_day)

        # Analyze slot-by-slot capacity & conflicts on target day
        hp_room_full_slots = []
        all_room_full_slots = []
        panel_full_slots = []
        student_conflict_slots = []
        free_slots = []
        conflicting_companies = set()

        for s in valid_slots:
            g_s = (target_day - 1) * 1440 + s.start_min
            g_e = g_s + dur

            # Higher priority room occupancy (priority < comp.priority, where 1 is highest)
            hp_overlapping = [
                item for item in scheduled_items
                if item["priority"] < comp.priority and max(g_s, item["g_start"]) < min(g_e, item["g_end"])
            ]
            events_hp = []
            for item in hp_overlapping:
                events_hp.append((max(g_s, item["g_start"]), 1))
                events_hp.append((min(g_e, item["g_end"]), -1))
            events_hp.sort(key=lambda x: (x[0], x[1]))
            peak_hp = 0
            cur = 0
            for _, delta in events_hp:
                cur += delta
                if cur > peak_hp:
                    peak_hp = cur
            if peak_hp >= num_rooms:
                hp_room_full_slots.append(s)

            # All rooms occupancy
            all_overlapping = [
                item for item in scheduled_items
                if max(g_s, item["g_start"]) < min(g_e, item["g_end"])
            ]
            events_all = []
            for item in all_overlapping:
                events_all.append((max(g_s, item["g_start"]), 1))
                events_all.append((min(g_e, item["g_end"]), -1))
            events_all.sort(key=lambda x: (x[0], x[1]))
            peak_all = 0
            cur = 0
            for _, delta in events_all:
                cur += delta
                if cur > peak_all:
                    peak_all = cur
            if peak_all >= num_rooms:
                all_room_full_slots.append(s)

            # Company panel occupancy
            comp_overlapping = [
                item for item in company_scheduled[comp.id]
                if max(g_s, item["g_start"]) < min(g_e, item["g_end"])
            ]
            events_panel = []
            for item in comp_overlapping:
                events_panel.append((max(g_s, item["g_start"]), 1))
                events_panel.append((min(g_e, item["g_end"]), -1))
            events_panel.sort(key=lambda x: (x[0], x[1]))
            peak_panel = 0
            cur = 0
            for _, delta in events_panel:
                cur += delta
                if cur > peak_panel:
                    peak_panel = cur
            if peak_panel >= comp.num_panels:
                panel_full_slots.append(s)

            # Student overlapping interviews
            stu_overlapping = [
                item for item in student_scheduled[sid]
                if max(g_s, item["g_start"]) < min(g_e, item["g_end"])
            ]
            if stu_overlapping:
                student_conflict_slots.append(s)
                for item in stu_overlapping:
                    conflicting_companies.add(item["company"].id)

            if peak_all < num_rooms and peak_panel < comp.num_panels and not stu_overlapping:
                free_slots.append(s)

        # -------------------------------------------------------------
        # 1. Room Capacity:
        # Every room-slot combination valid for this interview occupied
        # by higher-priority interviews
        # -------------------------------------------------------------
        if len(hp_room_full_slots) == len(valid_slots) and comp.priority > 1:
            detail = f"All {num_rooms} rooms occupied by higher-priority interviews {time_range_str}"
            explained.append({
                "interview_id": inv_id,
                "company_id": comp.id,
                "student_id": sid,
                "reason": "room_capacity",
                "detail": detail,
            })
            continue

        # -------------------------------------------------------------
        # 2. Panel Capacity:
        # The company's panel count was the bottleneck (panels all busy
        # across every valid slot for that company)
        # -------------------------------------------------------------
        rooms_available_slots = [s for s in valid_slots if s not in all_room_full_slots]
        panel_busy_in_room_avail = [s for s in rooms_available_slots if s in panel_full_slots]

        if (
            len(panel_full_slots) == len(valid_slots)
            or (rooms_available_slots and len(panel_busy_in_room_avail) == len(rooms_available_slots))
            or (len(panel_full_slots) > 0 and len(free_slots) == 0 and not conflicting_companies)
        ):
            scheduled_count = len(company_scheduled[comp.id])
            detail = (
                f"All {comp.num_panels} panels for {comp.name} ({comp.id}) were busy across "
                f"available slots {time_range_str} ({scheduled_count} interviews scheduled)"
            )
            explained.append({
                "interview_id": inv_id,
                "company_id": comp.id,
                "student_id": sid,
                "reason": "panel_capacity",
                "detail": detail,
            })
            continue

        # -------------------------------------------------------------
        # 3. Student Conflict:
        # The student had conflicts across all their shortlisted companies
        # such that no slot was free for this interview without colliding
        # with a scheduled / higher-priority one
        # -------------------------------------------------------------
        slots_panel_and_room_free = [
            s for s in valid_slots if s not in all_room_full_slots and s not in panel_full_slots
        ]
        student_blocked_in_free = [s for s in slots_panel_and_room_free if s in student_conflict_slots]

        if slots_panel_and_room_free and len(student_blocked_in_free) == len(slots_panel_and_room_free):
            conflicts_str = ", ".join(
                f"{cid} ({company_by_id[cid].name})" for cid in sorted(conflicting_companies)
            )
            detail = (
                f"Student {sid} had schedule conflicts with {conflicts_str} across "
                f"all {len(slots_panel_and_room_free)} free panel slots on Day {target_day}"
            )
            explained.append({
                "interview_id": inv_id,
                "company_id": comp.id,
                "student_id": sid,
                "reason": "student_conflict",
                "detail": detail,
            })
            continue

        # If student was scheduled with other companies on target_day
        stu_on_day = [item for item in student_scheduled[sid] if item["day"] == target_day]
        if stu_on_day:
            conflicts_str = ", ".join(
                f"{item['company'].id} ({item['company'].name})" for item in stu_on_day
            )
            detail = f"Student {sid} had schedule conflicts with {conflicts_str} on Day {target_day}"
            explained.append({
                "interview_id": inv_id,
                "company_id": comp.id,
                "student_id": sid,
                "reason": "student_conflict",
                "detail": detail,
            })
            continue

        # If all rooms were occupied across all slots where panel was free
        if not slots_panel_and_room_free and len(all_room_full_slots) > 0:
            detail = f"All {num_rooms} rooms occupied across valid slots {time_range_str}"
            explained.append({
                "interview_id": inv_id,
                "company_id": comp.id,
                "student_id": sid,
                "reason": "room_capacity",
                "detail": detail,
            })
            continue

        # Panel capacity fallback if panels were busy in majority of slots
        if len(panel_full_slots) > len(valid_slots) * 0.5:
            detail = (
                f"All {comp.num_panels} panels for {comp.name} ({comp.id}) busy in "
                f"{len(panel_full_slots)}/{len(valid_slots)} slots on Day {target_day}"
            )
            explained.append({
                "interview_id": inv_id,
                "company_id": comp.id,
                "student_id": sid,
                "reason": "panel_capacity",
                "detail": detail,
            })
            continue

        # -------------------------------------------------------------
        # 4. Otherwise: unknown
        # -------------------------------------------------------------
        logger.warning(
            "Infeasibility diagnosis could not identify binding constraint for interview %s (Company %s, Student %s)",
            inv_id,
            comp.id,
            sid,
        )
        explained.append({
            "interview_id": inv_id,
            "company_id": comp.id,
            "student_id": sid,
            "reason": "unknown",
            "detail": f"No binding constraint identified for interview {inv_id} on Day {target_day}",
        })

    return explained
