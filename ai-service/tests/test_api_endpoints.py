import pytest
from unittest.mock import patch, MagicMock

# Evita o carregamento real de pesos do modelo durante os testes
with patch('ultralytics.YOLO'), patch('ortho_processor.OrthoProcessor'):
    from fastapi.testclient import TestClient
    from main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_switch_model_endpoints(client):
    response = client.get("/switch-model/best")
    assert response.status_code == 200
    assert response.json() == {"message": "Switched to 'best'."}

    response = client.get("/switch-model/last")
    assert response.status_code == 200
    assert response.json() == {"message": "Switched to 'last'."}

    response = client.get("/switch-model/unknown_model")
    assert response.status_code == 200
    assert response.json() == {"message": "Invalid model."}

def test_process_ortho_requires_fields(client):
    # Requisição sem arquivo e sem campos obrigatórios deve falhar com 422 Unprocessable Entity
    response = client.post("/process-ortho/", data={})
    assert response.status_code == 422
