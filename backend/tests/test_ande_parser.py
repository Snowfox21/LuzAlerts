from pathlib import Path

import pytest
from bs4 import BeautifulSoup

from ande_parser import _zones_from_lines, parse_pdf_bytes

FIXTURES = Path(__file__).parent / "fixtures"


def test_zones_from_lines_empty():
    assert _zones_from_lines([], "Sin titulo") == []


def test_zones_from_lines_no_zona_marker():
    lines = ["Texto cualquiera", "HORARIO: 08:00", "ACTIVIDAD: poda"]
    assert _zones_from_lines(lines, "Trabajos") == []


def test_zones_from_lines_single_zone():
    lines = [
        "ZONA 1: Asunción - Villa Morra",
        "HORARIO: De 08:00 a 14:00",
        "ACTIVIDAD: Mantenimiento de la red",
    ]
    out = _zones_from_lines(lines, "Trabajos para el Lunes")

    assert len(out) == 1
    zone = out[0]
    assert zone["title"] == "Trabajos para el Lunes"
    assert "ZONA 1" in zone["zona"]
    assert "08:00" in zone["horario"]
    assert "Mantenimiento" in zone["actividad"]
    assert "ZONA 1" in zone["raw"]
    assert "HORARIO" in zone["raw"]
    assert "ACTIVIDAD" in zone["raw"]


def test_zones_from_lines_multiple_zones():
    lines = [
        "ZONA 1: Centro",
        "HORARIO: 08:00 a 12:00",
        "ZONA 2: San Lorenzo",
        "HORARIO: 13:00 a 17:00",
        "ACTIVIDAD: Cambio de transformador",
    ]
    out = _zones_from_lines(lines, "Trabajos")

    assert len(out) == 2
    assert "ZONA 1" in out[0]["zona"]
    assert "ZONA 2" in out[1]["zona"]
    assert "08:00" in out[0]["horario"]
    assert "13:00" in out[1]["horario"]
    assert out[0]["actividad"] == ""
    assert "Cambio" in out[1]["actividad"]


def test_zones_from_lines_skips_blank():
    lines = ["", "   ", "ZONA 5: Test", "", "HORARIO: 09:00 a 11:00"]
    out = _zones_from_lines(lines, "T")

    assert len(out) == 1
    assert "ZONA 5" in out[0]["zona"]
    assert "09:00" in out[0]["horario"]


def test_zones_from_lines_recomendacion_does_not_clobber_horario():
    """Regression: 'RECOMENDACIÓN: ... en el horario y zona' must not overwrite HORARIO."""
    lines = [
        "ZONA 01: Centro",
        "HORARIO DE TRABAJO: De 07:00 a 17:00 horas",
        "ACTIVIDAD: Mantenimiento de la red",
        "RECOMENDACIÓN: Tomar las medidas preventivas en el horario y zona mencionada",
    ]
    out = _zones_from_lines(lines, "Trabajos")

    assert len(out) == 1
    zone = out[0]
    assert "07:00 a 17:00" in zone["horario"]
    assert zone["horario"].startswith("HORARIO")
    assert "Mantenimiento" in zone["actividad"]
    assert zone["actividad"].startswith("ACTIVIDAD")
    assert "RECOMENDACIÓN" in zone["raw"]


def test_parse_pdf_bytes_corrupt_returns_empty():
    assert parse_pdf_bytes(b"not a pdf at all", "T") == []


def test_parse_pdf_bytes_empty_input():
    assert parse_pdf_bytes(b"", "T") == []


def test_parse_real_ande_detail_page():
    """End-to-end on saved ANDE detail page — exercises the full HTML pipeline."""
    html = (FIXTURES / "ande_15238.html").read_text()
    soup = BeautifulSoup(html, "lxml")

    main_col = soup.find("div", class_="col-sm-8")
    assert main_col is not None, "ANDE detail page must contain div.col-sm-8"

    title = main_col.find("h1").text.strip()
    assert "Trabajos programados" in title
    assert "abril de 2026" in title

    paragraphs = main_col.find_all("p")
    line_texts = [p.get_text(separator=" ", strip=True) for p in paragraphs]
    zones = _zones_from_lines(line_texts, title)

    assert len(zones) == 1
    z = zones[0]
    assert z["title"] == title
    assert z["zona"].startswith("ZONA 01")
    assert "Ciudad del Este" in z["zona"]
    assert "07:00" in z["horario"] and "17:00" in z["horario"]
    assert z["horario"].upper().startswith("HORARIO")
    assert "23.000 Voltios" in z["actividad"]
