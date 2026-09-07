from ande_parser import analyze_ande_ids, extract_ande_id


def test_extract_ande_id():
    assert extract_ande_id("https://www.ande.gov.py/interna.php?id=15238") == 15238
    assert extract_ande_id("/interna.php?id=nope") is None


def test_ande_ids_are_checked_independently_for_order_and_density():
    result = analyze_ande_ids([15240, 15239, 15237])
    assert result["monotonic"] is True
    assert result["direction"] == "descending"
    assert result["dense"] is False
    assert result["gaps"] == [15238]


def test_ande_ids_non_monotonic():
    result = analyze_ande_ids([10, 12, 11])
    assert result["monotonic"] is False
