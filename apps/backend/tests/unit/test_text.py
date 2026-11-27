import pytest

from app.core.text import clean_text, normalize_text


def test_clean_text_colapsa_espacios_y_conserva_tildes_y_mayusculas() -> None:
    assert clean_text("  Revisar   Rodamiento  ") == "Revisar Rodamiento"
    assert clean_text("Cambiar\taceite\ndel motor") == "Cambiar aceite del motor"


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("Revisar Rodamiento", "revisar rodamiento"),
        ("Revisar   rodamiento", "revisar rodamiento"),
        ("Lubricar el EJE", "lubricar el eje"),
        ("Inspección visual", "inspeccion visual"),
        ("  Año nuevo ", "ano nuevo"),
    ],
)
def test_normalize_text_iguala_variantes_triviales(a: str, b: str) -> None:
    assert normalize_text(a) == normalize_text(b)


def test_normalize_text_no_une_textos_distintos() -> None:
    assert normalize_text("Revisar rodamiento") != normalize_text("Revisar rodamientos")
