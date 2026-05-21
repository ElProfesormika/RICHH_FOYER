from datetime import date


def _in_range(d: date, start: tuple[int, int, int], end: tuple[int, int, int]) -> bool:
    s = date(*start)
    e = date(*end)
    return s <= d <= e


VACANCES_2025_2026 = [
    ((2025, 7, 5), (2025, 9, 1)),
    ((2025, 10, 18), (2025, 11, 3)),
    ((2025, 12, 20), (2026, 1, 5)),
    ((2026, 2, 14), (2026, 3, 2)),
    ((2026, 4, 11), (2026, 4, 27)),
]


def is_vacances(d: date) -> bool:
    for start, end in VACANCES_2025_2026:
        if _in_range(d, start, end):
            return True
    return False
