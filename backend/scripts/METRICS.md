# Placement Week Scheduler — Comprehensive Metrics & Evaluation Report

*Generated automatically by `backend/scripts/report.py` from actual solver runs on full-scale placement data (35 companies, 800 students, 20 rooms, 3,627 shortlists).*

---

## 1. Executive Summary & Schedule Performance

| Metric Name | Value | Description / Status |
| :--- | :---: | :--- |
| **Total Interview Shortlists** | **3,627** | Total shortlists across 35 companies (Tier 1 mass, Tier 2 mid, Tier 3 niche) |
| **Interviews Scheduled** | **1,212** | Placed into conflict-free room, panel, and time slot |
| **Placement Rate (`pct_scheduled`)** | **33.42%** | Percentage of shortlisted candidates placed in the optimal schedule |
| **Room Utilization Rate** | **47.34%** | Percentage of available room-slots (20 rooms × 32 slots/day × 4 days) booked |
| **Student Clashes Avoided** | **100.0%** | **0 double-bookings** across 800 students (hard non-overlap constraint) |
| **Unscheduled Backlog** | **2,415** | Unplaced shortlists categorized with root-cause diagnostic explanations |

---

## 2. Student Waiting Time Analysis

*Evaluated across all students with multiple scheduled interviews on the same day (189 students, 333 consecutive interview transitions).*

| Waiting Time Metric | Value (Minutes) | Context |
| :--- | :---: | :--- |
| **Average Waiting Time Gap** | **116.91 min** | Mean gap between end of interview $i$ and start of interview $i+1$ |
| **Median Waiting Time Gap** | **100 min** | 50th percentile idle waiting time between same-day interviews |
| **Minimum Waiting Time Gap** | **0 min** | Immediate back-to-back transitions |
| **Maximum Waiting Time Gap** | **400 min** | Maximum idle gap observed across single-day multi-interview schedules |

---

## 3. Replan Churn & Disruption Stability Benchmarks

*Each disruption scenario was simulated independently against the baseline optimal schedule (1,212 interviews). Churn is evaluated using locked assignment disturbance penalties in CP-SAT ($P=50$).*

| Disruption Scenario | Disruption Details | Prior Scheduled | Unaffected Count | Stability (`% unaffected`) | Replan Churn (`% changed`) | Moved | Cancelled | Newly Scheduled |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`company_late`** | C003 GreenGrid Energy Tech late by 2h | 1212 | 1175 | **96.95%** | **3.05%** | 37 | 0 | 21 |
| **`panel_drop`** | C007 Lucent Devices drops panel 6 | 1212 | 948 | **78.22%** | **21.78%** | 249 | 15 | 91 |
| **`student_withdraw`** | Student S0283 withdraws offer | 1212 | 1195 | **98.6%** | **1.4%** | 15 | 2 | 2 |
| **`room_unavailable`** | Room R01 maintenance outage | 1212 | 887 | **73.18%** | **26.82%** | 264 | 61 | 1 |

---

## 4. Infeasibility Diagnosis Breakdown

*Root-cause binding constraint breakdown for the 2,415 unscheduled interviews:*

| Diagnostic Category | Count | Percentage | Primary Root Cause |
| :--- | :---: | :---: | :--- |
| **`room_capacity`** | **189** | 7.8% | All 20 interview rooms occupied by higher-priority interviews |
| **`panel_capacity`** | **758** | 31.4% | Company panel count fully saturated across all candidate slots |
| **`student_conflict`** | **1184** | 49.0% | Student shortlisted by multiple overlapping companies in the same time window |
| **`unknown` / Coupled** | **284** | 11.8% | Multi-constraint combinatorial coupling |

---

## 5. Written Justifications (To Fill In)

### Constraint Bending Order
<!--
TODO: Provide your written justification for which constraints should bend first when the schedule is infeasible.
Consider:
1. Tier priority weights (Tier 1 Mass vs. Tier 2 Mid vs. Tier 3 Niche)
2. Day flexibility (allowing Day 1 companies to spill into Day 2 vs. strictly holding to single-day interviews)
3. Panel capacity vs. Room capacity adjustments
4. Student maximum interviews per day limits
-->



### Acceptable Reshuffling Threshold
<!--
TODO: Provide your written justification for what percentage of reshuffling is acceptable during operational replanning.
Consider:
1. Operational disruption vs. student notification lead time
2. Why keeping unrelated interview churn below 10-15% is essential for coordinator trust
3. Trade-offs between schedule disturbance penalties and global objective optimality
-->


