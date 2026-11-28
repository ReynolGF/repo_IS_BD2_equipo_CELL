"""Utilidades de texto: limpieza y normalización para comparar descripciones."""

import unicodedata


def clean_text(text: str) -> str:
    """Quita espacios al inicio y al final y colapsa los espacios repetidos.

    Es lo que se guarda en la base de datos: conserva mayúsculas y tildes.
    """
    return " ".join(text.split())


def normalize_text(text: str) -> str:
    """Devuelve una forma canónica del texto para detectar duplicados semánticos.

    Pasa a minúsculas, quita tildes y diéresis (también la de la ñ) y colapsa los espacios.
    Dos descripciones con la misma forma normalizada se consideran la misma tarea.

    Example:
        >>> normalize_text("  Revisar   Rodamiento ÉJE ")
        'revisar rodamiento eje'
    """
    decomposed = unicodedata.normalize("NFKD", text)
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(without_marks.casefold().split())
