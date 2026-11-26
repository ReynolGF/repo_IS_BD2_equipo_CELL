from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_y_verificacion_de_contrasena() -> None:
    password_hash = hash_password("clave-segura-1")
    assert password_hash != "clave-segura-1"
    assert verify_password("clave-segura-1", password_hash)
    assert not verify_password("otra-clave", password_hash)


def test_dos_hashes_de_la_misma_contrasena_son_distintos() -> None:
    assert hash_password("clave-segura-1") != hash_password("clave-segura-1")


def test_contrasena_de_mas_de_72_bytes_funciona_y_no_se_trunca() -> None:
    password = "a" * 100
    password_hash = hash_password(password)
    assert verify_password(password, password_hash)
    assert not verify_password("a" * 99 + "b", password_hash)


def test_hash_mal_formado_devuelve_false() -> None:
    assert not verify_password("clave-segura-1", "esto-no-es-un-hash")


def test_token_de_acceso_ida_y_vuelta() -> None:
    token, expires_in = create_access_token(42, "technician")
    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["role"] == "technician"
    assert expires_in == get_settings().access_token_expire_minutes * 60


def test_token_caducado_es_rechazado() -> None:
    token, _ = create_access_token(1, "operator", expires_delta=timedelta(seconds=-5))
    with pytest.raises(AuthenticationError, match="expirado"):
        decode_access_token(token)


def test_token_manipulado_es_rechazado() -> None:
    token, _ = create_access_token(1, "operator")
    with pytest.raises(AuthenticationError):
        decode_access_token(token[:-3] + "abc")


def test_token_firmado_con_otra_clave_es_rechazado() -> None:
    payload = {"sub": "1", "exp": datetime.now(UTC) + timedelta(minutes=5)}
    token = jwt.encode(payload, "otra-clave-distinta-de-32-caracteres!!", algorithm="HS256")
    with pytest.raises(AuthenticationError):
        decode_access_token(token)


def test_token_sin_firma_algoritmo_none_es_rechazado() -> None:
    payload = {"sub": "1", "exp": datetime.now(UTC) + timedelta(minutes=5)}
    token = jwt.encode(payload, None, algorithm="none")
    with pytest.raises(AuthenticationError):
        decode_access_token(token)


def test_token_sin_sub_es_rechazado() -> None:
    settings = get_settings()
    payload = {"exp": datetime.now(UTC) + timedelta(minutes=5)}
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    with pytest.raises(AuthenticationError):
        decode_access_token(token)


def test_texto_que_no_es_un_token_es_rechazado() -> None:
    with pytest.raises(AuthenticationError):
        decode_access_token("no-es-un-jwt")
