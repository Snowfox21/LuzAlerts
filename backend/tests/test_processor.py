from processor import build_geocode_queries


def test_empty_string_returns_empty():
    assert build_geocode_queries("") == []


def test_only_zona_prefix_returns_empty():
    assert build_geocode_queries("ZONA 03 :") == []


def test_barrio_with_city():
    queries = build_geocode_queries("ZONA 03 : Barrio San Jorge – Asunción")
    assert "San Jorge, Asunción" in queries
    assert queries[0] == "San Jorge, Asunción"


def test_barrio_without_city():
    queries = build_geocode_queries("ZONA 02 : Barrio Las Mercedes")
    assert "Las Mercedes" in queries


def test_ciudad_de():
    queries = build_geocode_queries("ZONA 02 : Ciudad de San Bernardino")
    assert "San Bernardino" in queries
    assert queries[0] == "San Bernardino"


def test_long_zona_with_period_and_emdash_tail():
    """Sector Futbol Manía pattern: long descriptive prefix, then '. City – Department'."""
    zona = (
        "ZONA 03 : Sector Futbol Manía a una cuadra de la calle Mcal. José Felix "
        "Estigarribia y Sector Artes y Oficios, sobre calle los Mingueros. "
        "Minga Guazú – Alto Paraná"
    )
    queries = build_geocode_queries(zona)
    assert "Minga Guazú, Alto Paraná" in queries
    assert "Minga Guazú" in queries
    assert queries[0] == "Minga Guazú, Alto Paraná"


def test_emdash_chain_no_period():
    queries = build_geocode_queries("ZONA 1: San Estanislao – San Pedro")
    assert "San Estanislao, San Pedro" in queries
    assert "San Estanislao" in queries


def test_departamentos_de_prefix_stripped():
    queries = build_geocode_queries(
        "ZONA 5 : Sector Norte – Departamentos de Itapúa, Misiones, Caazapá"
    )
    assert any("Itapúa" in q for q in queries)
    assert not any("Departamentos" in q for q in queries)


def test_single_word_zona():
    queries = build_geocode_queries("ZONA 1: Asunción")
    assert "Asunción" in queries


def test_no_zona_prefix_still_works():
    queries = build_geocode_queries("Barrio Mburicaó – Asunción")
    assert "Mburicaó, Asunción" in queries


def test_dedup_and_priority_order():
    """Barrio match must come before broader em-dash tail match."""
    zona = "ZONA 1: Barrio Centro – Asunción"
    queries = build_geocode_queries(zona)
    assert queries[0] == "Centro, Asunción"
    assert len(queries) == len(set(q.lower() for q in queries))


def test_drops_too_long_candidates():
    """A 200-char run with no clean tail should not produce that run as a query."""
    long_run = "x" * 200
    queries = build_geocode_queries(f"ZONA 1: {long_run}")
    assert all(len(q) <= 80 for q in queries)


def test_drops_too_short_candidates():
    queries = build_geocode_queries("ZONA 1: ab")
    assert all(len(q) >= 3 for q in queries)
