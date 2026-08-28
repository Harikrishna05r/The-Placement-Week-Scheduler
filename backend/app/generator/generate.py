"""
Generates a realistic placement-week dataset.

Design choices (the "why" behind the numbers, for your write-up):

1. Company tiers ~ Day of week.
   Day 1 = mass recruiters (Amazon/TCS-style: huge headcount, low CGPA
   cutoff, many panels). Day 4 = niche/product companies (small
   headcount, high cutoff, 1-2 panels). This mirrors real placement
   calendars where colleges front-load bulk recruiters.

2. Shortlist size follows a power law skewed by tier.
   A handful of mass recruiters shortlist 200-400 students; niche
   companies shortlist 15-40. This creates the real bottleneck: a small
   set of "hot" students appear on 10+ overlapping shortlists while most
   students appear on 1-3.

3. Shortlist probability is CGPA-correlated, not uniform.
   A student's chance of being shortlisted by a company scales with how
   far their CGPA is above that company's cutoff -- top students clear
   every cutoff and stack up on every mass recruiter's list too, which
   is exactly what causes clashes on the day.

4. Panels/rooms are scarce relative to demand.
   20 rooms, ~4-6 panels/company for mass recruiters. This guarantees
   the schedule is NOT trivially feasible -- the assignment explicitly
   says a perfect schedule is usually impossible.
"""
from __future__ import annotations
import random
from app.models.entities import Company, Student, Room, TimeSlot, Interview, Tier

BRANCHES = ["CSE", "ECE", "ISE", "AIML", "ME", "CE", "EEE"]

TIER_CONFIG = {
    Tier.MASS_RECRUITER: dict(day=1, cutoff_range=(5.5, 6.5), panels=(4, 8),
                               duration=(15, 20), shortlist=(150, 400), priority=1),
    Tier.MID_TIER: dict(day=None, cutoff_range=(6.5, 7.5), panels=(2, 4),
                         duration=(20, 30), shortlist=(40, 120), priority=2),
    Tier.NICHE: dict(day=4, cutoff_range=(7.5, 8.8), panels=(1, 2),
                      duration=(30, 45), shortlist=(10, 40), priority=3),
}

COMPANY_NAMES = [
    "Netconnect", "Alorica", "Zenrise Tech", "Bluecrest Systems", "Or bital Dynamics",
    "Fintara", "CoreStack", "Nimbus Cloud", "Vayu Robotics", "Quantara Labs",
    "Meridian Software", "Brightloop", "TerraByte Analytics", "Skyforge",
    "PixelWorks Studio", "Ironclad Security", "DataSphere", "GreenGrid Energy Tech",
    "Kestrel Aerospace", "NovaMind AI", "Coral Fintech", "Anchorpoint Consulting",
    "Ridgeline Systems", "Lucent Devices", "Solstice Health Tech", "Verity Analytics",
    "Wavefront Networks", "Marlin Logistics Tech", "Arcadia Robotics", "Zephyr Cloud",
    "Cascade Financial Tech", "Halcyon Biotech", "TrueNorth Data", "Obsidian Security",
    "Pinnacle Retail Tech",
]


def _rand_cgpa() -> float:
    # Roughly bell-shaped 5.0-9.8, mean ~7.0 -- typical engineering college spread
    val = random.gauss(7.0, 0.9)
    return round(min(max(val, 5.0), 9.8), 2)


def generate_companies(n: int = 35, seed: int | None = None) -> list[Company]:
    if seed is not None:
        random.seed(seed)
    companies = []
    names = random.sample(COMPANY_NAMES, min(n, len(COMPANY_NAMES)))
    while len(names) < n:
        names.append(f"Company{len(names)+1}")

    # distribute tiers: ~20% mass recruiters, ~55% mid-tier, ~25% niche
    tiers = (
        [Tier.MASS_RECRUITER] * max(1, round(n * 0.2))
        + [Tier.NICHE] * max(1, round(n * 0.25))
    )
    tiers += [Tier.MID_TIER] * (n - len(tiers))
    random.shuffle(tiers)

    for i, (name, tier) in enumerate(zip(names, tiers)):
        cfg = TIER_CONFIG[tier]
        day = cfg["day"] if cfg["day"] else random.choice([1, 2, 3])
        companies.append(Company(
            id=f"C{i+1:03d}",
            name=name,
            tier=tier,
            day=day,
            cgpa_cutoff=round(random.uniform(*cfg["cutoff_range"]), 2),
            num_panels=random.randint(*cfg["panels"]),
            interview_duration_min=random.choice(range(cfg["duration"][0], cfg["duration"][1] + 1, 5)),
            priority=cfg["priority"],
        ))
    return companies


def generate_students(n: int = 800, seed: int | None = None) -> list[Student]:
    if seed is not None:
        random.seed(seed + 1)
    students = []
    for i in range(n):
        students.append(Student(
            id=f"S{i+1:04d}",
            name=f"Student {i+1}",
            branch=random.choice(BRANCHES),
            cgpa=_rand_cgpa(),
        ))
    return students


def assign_shortlists(companies: list[Company], students: list[Student], seed: int | None = None) -> None:
    """
    Populate company.shortlisted_student_ids and student.shortlists in place.
    Shortlist probability scales with (student CGPA - company cutoff):
    students right at the cutoff rarely get picked, students well above it
    almost always do -- this is what makes "hot" students stack up on many
    overlapping shortlists.
    """
    if seed is not None:
        random.seed(seed + 2)

    for company in companies:
        cfg = TIER_CONFIG[company.tier]
        target_size = random.randint(*cfg["shortlist"])
        eligible = [s for s in students if s.cgpa >= company.cgpa_cutoff]

        # weight by how far above cutoff (steeper margin = higher weight)
        weights = [max(0.05, (s.cgpa - company.cgpa_cutoff) + 0.3) for s in eligible]
        if not eligible:
            continue
        k = min(target_size, len(eligible))
        chosen = _weighted_sample_without_replacement(eligible, weights, k)

        for s in chosen:
            company.shortlisted_student_ids.append(s.id)
            s.shortlists.append(company.id)


def _weighted_sample_without_replacement(population, weights, k):
    pool = list(zip(population, weights))
    chosen = []
    for _ in range(k):
        total = sum(w for _, w in pool)
        r = random.uniform(0, total)
        upto = 0
        for idx, (item, w) in enumerate(pool):
            upto += w
            if upto >= r:
                chosen.append(item)
                pool.pop(idx)
                break
    return chosen


def generate_rooms(n: int = 20) -> list[Room]:
    return [Room(id=f"R{i+1:02d}", name=f"Room {i+1}") for i in range(n)]


def generate_slots(days: int = 4, start_hour: int = 9, end_hour: int = 17,
                    slot_min: int = 15) -> list[TimeSlot]:
    slots = []
    for day in range(1, days + 1):
        t = start_hour * 60
        end = end_hour * 60
        idx = 0
        while t + slot_min <= end:
            slots.append(TimeSlot(id=f"D{day}-T{idx:03d}", day=day, start_min=t, end_min=t + slot_min))
            t += slot_min
            idx += 1
    return slots


def build_interviews(companies: list[Company]) -> list[Interview]:
    interviews = []
    for c in companies:
        for sid in c.shortlisted_student_ids:
            interviews.append(Interview(
                id=f"I-{c.id}-{sid}",
                company_id=c.id,
                student_id=sid,
                duration_min=c.interview_duration_min,
            ))
    return interviews


def generate_dataset(num_companies: int = 35, num_students: int = 800,
                      num_rooms: int = 20, seed: int = 42):
    companies = generate_companies(num_companies, seed=seed)
    students = generate_students(num_students, seed=seed)
    assign_shortlists(companies, students, seed=seed)
    rooms = generate_rooms(num_rooms)
    slots = generate_slots()
    interviews = build_interviews(companies)
    return dict(companies=companies, students=students, rooms=rooms,
                slots=slots, interviews=interviews)


if __name__ == "__main__":
    data = generate_dataset()
    print(f"Companies: {len(data['companies'])}")
    print(f"Students: {len(data['students'])}")
    print(f"Rooms: {len(data['rooms'])}")
    print(f"Slots: {len(data['slots'])}")
    print(f"Interviews needed: {len(data['interviews'])}")
    hot = sorted(data['students'], key=lambda s: len(s.shortlists), reverse=True)[:5]
    for s in hot:
        print(f"  {s.id} cgpa={s.cgpa} shortlisted by {len(s.shortlists)} companies")
