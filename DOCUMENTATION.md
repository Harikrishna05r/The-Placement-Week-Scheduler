# Placement Week Scheduler — Technical Documentation

## 1. System Overview & Problem Formulation

The **Placement Week Scheduler** is an intelligent optimization and decision-support system designed to automate multi-day campus recruitment interview scheduling under heavy contention and constrained physical resources.

In real-world campus placements:
- **Mass recruiters** arrive early (Day 1) with large panels and interview shortlists spanning hundreds of candidates.
- **Top candidates** ("hot students") clear multiple CGPA cutoffs and appear simultaneously on 10+ company shortlists.
- **Physical room capacity** (e.g., 20 rooms) and **company panel availability** (e.g., 1–8 panels) strictly limit concurrency.
- **Demand outstrips supply**: A realistic cohort creates 3,600+ interview requirements against ~2,560 theoretical room-slots, making perfect feasibility mathematically impossible.

The system solves this via constraint programming (OR-Tools CP-SAT) to maximize high-priority interview throughput, enforces zero double-booking, and provides an **Infeasibility Explainability Engine** that diagnoses why unscheduled interviews could not be placed.

---

## 2. Core Architecture & Component Diagram

```
                        ┌───────────────────────────────┐
                        │   FastAPI Web Application     │
                        │        (app/main.py)          │
                        └───────┬───────────────┬───────┘
                                │               │
                POST /generate  │               │ POST /schedule
                                ▼               ▼
                    ┌────────────────┐   ┌───────────────────────────┐
                    │ Data Generator │   │      CP-SAT Solver        │
                    │(app/generator) │   │ (app/scheduler/solve.py)  │
                    └────────────────┘   └─────────────┬─────────────┘
                                                       │
                                                       │ Unscheduled Interviews +
                                                       │ Schedule Assignments
                                                       ▼
                                         ┌───────────────────────────┐
                                         │ Infeasibility Diagnosis   │
                                         │ (app/scheduler/explain.py)│
                                         └───────────────────────────┘
```

### Directory Structure

```
backend/
├── app/
│   ├── generator/
│   │   └── generate.py         # Realistic dataset generator with power-law shortlists
│   ├── models/
│   │   └── entities.py         # Core dataclasses: Company, Student, Room, Slot, Assignment
│   ├── scheduler/
│   │   ├── explain.py          # Infeasibility diagnosis & human-readable explainability
│   │   └── solve.py            # High-performance OR-Tools CP-SAT interval scheduler
│   └── main.py                 # FastAPI API layer (/generate, /schedule, /replan, /state)
├── tests/
│   ├── test_solve_small.py     # Smoke test on small dataset slice
│   ├── test_solve_full.py      # Benchmark test on full-scale dataset (3,600+ interviews)
│   ├── test_api_explain.py     # API test verifying diagnostic explanation engine
│   └── test_http_live.py       # Live end-to-end HTTP integration test
└── requirements.txt            # Python dependencies (fastapi, uvicorn, ortools, pydantic)
```

---

## 3. Data Models (`app/models/entities.py`)

All domain entities are implemented as clean Python dataclasses:

| Entity | Attributes | Description |
|---|---|---|
| `Company` | `id`, `name`, `tier`, `day`, `cgpa_cutoff`, `num_panels`, `interview_duration_min`, `priority`, `shortlisted_student_ids` | Tiers: `MASS_RECRUITER` (Day 1, Priority 1), `MID_TIER` (Days 2–3, Priority 2), `NICHE` (Day 4, Priority 3). |
| `Student` | `id`, `name`, `branch`, `cgpa`, `shortlists`, `withdrawn` | Candidate profiles with branch and CGPA. |
| `Room` | `id`, `name`, `capacity` | Physical rooms available (capacity = 1 interview per room). |
| `TimeSlot` | `id`, `day`, `start_min`, `end_min` | Discrete reference slots (e.g. 15-minute intervals from 9:00 AM to 5:00 PM). |
| `Interview` | `id`, `company_id`, `student_id`, `duration_min` | Unique interview unit to be placed. |
| `Assignment` | `interview_id`, `room_id`, `panel_no`, `slot_id` | Scheduled assignment result. |
| `ScheduleResult` | `assignments`, `unscheduled`, `metrics` | Overall solver output containing assignments, diagnosed unscheduled items, and metrics. |

---

## 4. CP-SAT Solver Implementation (`app/scheduler/solve.py`)

### 4.1 Formulation Strategy: Interval Variables
The scheduler models each interview $i$ using OR-Tools CP-SAT interval variables:
- **Presence Boolean**: `is_present = model.NewBoolVar(f"sched_{i.id}")`
- **Continuous Start Time**: `start = model.NewIntVarFromDomain(domain, f"start_{i.id}")` over global minutes from day start.
- **End Time**: `end = start + duration_min`
- **Optional Interval**: `main_interval = model.NewOptionalIntervalVar(start, duration_min, end, is_present, ...)`

### 4.2 Constraints Enforced
1. **Earliest Company Day**: Interview start domain restricts $i$ to days $d \ge \text{company.day}$ within working hours (9:00 AM – 5:00 PM).
2. **Room Capacity**:
   $$\text{Cumulative}(\text{all\_intervals}, \text{demands}=1, \text{capacity}=N_{\text{rooms}})$$
   Ensures at most $N_{\text{rooms}}$ interviews run concurrently across the campus.
3. **Company Panel Capacity**:
   $$\text{Cumulative}(\text{company\_intervals}[c], \text{demands}=1, \text{capacity}=c.\text{num\_panels})$$
   Ensures no company exceeds its active panel count.
4. **Student Non-Overlap**:
   $$\text{NoOverlap}(\text{student\_intervals}[s])$$
   Guarantees no student is double-booked across simultaneous interviews.

### 4.3 Objective Function
$$\text{Maximize} \sum_{i \in \text{Interviews}} w(\text{company}_i.\text{priority}) \cdot \text{is\_present}_i + \sum_{i \in \text{Locked}} P_{\text{disturb}} \cdot \text{matches\_locked}_i$$
- **Priority Weights**: Priority 1 (Mass Recruiters) = 5, Priority 2 (Mid-Tier) = 3, Priority 3 (Niche) = 1.
- **Disturbance Penalty**: Penalizes changing prior assignments during replans.

### 4.4 Track Allocation
After CP-SAT solves interval start times, greedy interval-graph coloring allocates specific physical `room_id` (1 to $N_{\text{rooms}}$) and company `panel_no` (1 to $c.\text{num\_panels}$) without introducing overlaps, and maps start times to the closest discrete `TimeSlot.id`.

---

## 5. Infeasibility Explainability Engine (`app/scheduler/explain.py`)

When an interview cannot be placed, placement coordinators require actionable diagnoses rather than a generic `"capacity_exhausted"` message.

The explainability engine determines the binding constraint by evaluating candidate time windows across the company's operating day in strict priority hierarchy:

```
                      ┌───────────────────────────────┐
                      │    Unscheduled Interview      │
                      └───────────────┬───────────────┘
                                      │
               Are all valid slots occupied by higher-priority
                             companies? (Rule 1)
                                ├─── YES ───► [ room_capacity ]
                                │
               Were company panels busy across all valid slots? (Rule 2)
                                ├─── YES ───► [ panel_capacity ]
                                │
               Did student have conflicting scheduled interviews? (Rule 3)
                                ├─── YES ───► [ student_conflict ]
                                │
                                └─── NO  ───► [ unknown ] (Flagged)
```

### Hierarchy & Diagnostic Rules

| Hierarchy | Reason Code | Condition | Human-Readable Detail Example |
|---|---|---|---|
| **1** | `room_capacity` | Every candidate room-slot on the company's designated day is occupied by higher-priority interviews ($\text{priority} < C.\text{priority}$). | `"All 20 rooms occupied by higher-priority interviews between 9:00am-5:00pm on Day 2"` |
| **2** | `panel_capacity` | Company's active panels were fully booked across all valid slots or across all slots where room capacity existed. | `"All 2 panels for Nimbus Cloud (C001) busy in 20/31 slots on Day 3"` |
| **3** | `student_conflict` | Rooms and company panels had free capacity, but the student was booked with other shortlisted companies during all available windows. | `"Student S0393 had schedule conflicts with C012 (Zenrise Tech), C035 (Quantara Labs) on Day 3"` |
| **4** | `unknown` | Fallback condition if multi-constraint coupling prevents simple classification (logs warning for review). | `"No binding constraint identified for interview I-C024-S0267 on Day 4"` |

---

## 6. API Endpoints (`app/main.py`)

### 1. `POST /generate`
Generates a synthetic, realistic dataset.
- **Request Body**:
  ```json
  {
    "num_companies": 35,
    "num_students": 800,
    "num_rooms": 20,
    "seed": 42
  }
  ```
- **Response**:
  ```json
  {
    "companies": 35,
    "students": 800,
    "rooms": 20,
    "interviews": 3627
  }
  ```

### 2. `POST /schedule`
Executes the CP-SAT scheduler on the generated dataset and enriches unscheduled interviews with the diagnostic explainability engine.
- **Response**:
  ```json
  {
    "metrics": {
      "total_interviews": 3627,
      "scheduled": 1188,
      "unscheduled": 2439,
      "pct_scheduled": 32.75,
      "room_utilization_pct": 46.41
    },
    "unscheduled_sample": [
      {
        "interview_id": "I-C001-S0393",
        "company_id": "C001",
        "student_id": "S0393",
        "reason": "student_conflict",
        "detail": "Student S0393 had schedule conflicts with C012 (Zenrise Tech), C035 (Quantara Labs) on Day 3"
      },
      {
        "interview_id": "I-C001-S0197",
        "company_id": "C001",
        "student_id": "S0197",
        "reason": "panel_capacity",
        "detail": "All 2 panels for Nimbus Cloud (C001) busy in 20/31 slots on Day 3"
      }
    ]
  }
  ```

### 3. `GET /state`
Returns the current schedule state and summary metrics for frontend polling.

### 4. `POST /replan`
API hook for disruption injection (company late, panel drop, student withdrawal, room unavailable) with minimal disturbance re-solving.

---

## 7. Experimental Verification & Test Results

### 7.1 Small Dataset Smoke Test (`backend/tests/test_solve_small.py`)
- **Scale**: 4 companies, 60 students, 5 rooms, 1 day.
- **Solve Time**: ~0.10s.
- **Result**: 47 scheduled, 69 unscheduled (capacity constrained).

### 7.2 Full-Scale Benchmark Test (`backend/tests/test_solve_full.py`)
- **Scale**: 35 companies, 800 students, 20 rooms, 128 time slots across 4 days (3,627 interviews).
- **Solve Time**: ~48.40s.
- **Metrics**:
  - Total Interviews: 3,627
  - Scheduled: 1,188 (32.75%)
  - Unscheduled: 2,439 (67.25%)
  - Room Utilization: 46.41%

### 7.3 End-to-End Live HTTP Test (`backend/tests/test_http_live.py`)
Verified live HTTP roundtrip against a running Uvicorn server:
1. `POST /generate` responded in 0.05s with 3,627 interviews created.
2. `POST /schedule` solved in 48.40s and returned enriched diagnostic detail strings for all unscheduled interviews.

---

## 8. Key Technical Justifications (Defense Q&A)

### Q1: Why CP-SAT Interval Variables instead of Discrete Slot Booleans?
- Discrete slot formulations require $O(\text{Interviews} \times \text{Rooms} \times \text{Panels} \times \text{Slots})$ binary variables ($> 18\text{ million}$ variables for 3,600 interviews), causing combinatorial explosion.
- Interval variables formulate the problem with continuous start-time integers and $O(\text{Interviews})$ interval variables. CP-SAT's `AddCumulative` and `AddNoOverlap` propagators execute in sub-minute time.

### Q2: Why CP-SAT instead of a Greedy Heuristic?
- Greedy heuristics cannot reason globally about student shortlists across 4 days and get trapped in poor local optima.
- CP-SAT naturally supports soft constraint optimization (priority weights), locked-assignment disturbance penalties for replanning, and mathematical bounds.

### Q3: How do the diagnostic explanations help placement coordinators?
- **`room_capacity`**: Signals to administrative staff that college infrastructure is saturated; adding rooms or extending hours on that day is needed.
- **`panel_capacity`**: Alerts the company HR that their candidate shortlist exceeds what their panels can handle; advises requesting extra interviewers.
- **`student_conflict`**: Informs coordinators of scheduling gridlock on specific high-demand candidates; suggests rescheduling candidate interviews across adjacent days.
