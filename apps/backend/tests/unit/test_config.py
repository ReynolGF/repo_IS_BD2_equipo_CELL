from app.core.config import Settings


def test_cors_origins_se_separa_por_comas_y_limpia_espacios() -> None:
    settings = Settings(cors_origins=" http://a.com , http://b.com ,, ")
    assert settings.cors_origins_list == ["http://a.com", "http://b.com"]


def test_cors_origins_por_defecto_incluye_puertos_del_frontend() -> None:
    settings = Settings()
    assert "http://localhost:5173" in settings.cors_origins_list
