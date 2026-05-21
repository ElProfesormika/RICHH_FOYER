"""Parse les INSERT MySQL du dump phpMyAdmin app_db.sql."""

from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import datetime
from typing import Any

INSERT_RE = re.compile(
    r"INSERT INTO `(?P<table>\w+)` \([^)]+\) VALUES\s*(?P<values>.+?);\s*(?:\n|$)",
    re.DOTALL,
)


def _parse_value(token: str) -> Any:
    token = token.strip()
    if token.upper() == "NULL":
        return None
    if token.startswith("'") and token.endswith("'"):
        return token[1:-1].replace("\\'", "'").replace("\\\\", "\\")
    if re.fullmatch(r"-?\d+", token):
        return int(token)
    if re.fullmatch(r"-?\d+\.\d+", token):
        return float(token)
    return token


def _split_fields(inner: str) -> list[Any]:
    fields: list[Any] = []
    buf: list[str] = []
    in_str = False
    escape = False
    i = 0
    while i < len(inner):
        c = inner[i]
        if in_str:
            if escape:
                buf.append(c)
                escape = False
            elif c == "\\":
                escape = True
            elif c == "'":
                in_str = False
            else:
                buf.append(c)
        elif c == "'":
            in_str = True
        elif c == ",":
            fields.append(_parse_value("".join(buf)))
            buf = []
        else:
            buf.append(c)
        i += 1
    if buf or fields:
        fields.append(_parse_value("".join(buf)))
    return fields


def iter_rows(values_blob: str) -> Iterator[list[Any]]:
    """Itère les tuples (field1, field2, ...) dans un bloc VALUES."""
    i = 0
    n = len(values_blob)
    while i < n:
        if values_blob[i] != "(":
            i += 1
            continue
        depth = 1
        j = i + 1
        in_str = False
        escape = False
        while j < n and depth > 0:
            c = values_blob[j]
            if in_str:
                if escape:
                    escape = False
                elif c == "\\":
                    escape = True
                elif c == "'":
                    in_str = False
            elif c == "'":
                in_str = True
            elif c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
            j += 1
        if depth == 0:
            inner = values_blob[i + 1 : j - 1]
            yield _split_fields(inner)
        i = j


def parse_dump_tables(sql_path: str) -> dict[str, list[list[Any]]]:
    """Lit le fichier SQL et retourne les lignes par table."""
    content = open(sql_path, encoding="utf-8", errors="replace").read()
    out: dict[str, list[list[Any]]] = {}
    for m in INSERT_RE.finditer(content):
        table = m.group("table")
        rows = list(iter_rows(m.group("values")))
        out.setdefault(table, []).extend(rows)
    return out


def parse_datetime(val: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%f"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return datetime.fromisoformat(val.replace("Z", ""))
