import pytest
import numpy as np
from unittest.mock import MagicMock, patch

# Mock ultralytics YOLO before importing ortho_processor
with patch('ultralytics.YOLO'):
    from ortho_processor import OrthoProcessor

@pytest.fixture
def processor():
    with patch('ultralytics.YOLO'):
        proc = OrthoProcessor(model_path="dummy_path.pt", tile_size=1024, overlap=250)
        return proc

def test_apply_nms_empty_detections(processor):
    result = processor._apply_nms([])
    assert result == []

def test_apply_nms_suppresses_overlapping_boxes(processor):
    # Duas detecções quase idênticas sobrepostas, com confianças diferentes
    det1 = {
        "class_name": "fissura",
        "confidence": 0.95,
        "pixel_box": {"x1": 100, "y1": 100, "x2": 200, "y2": 200}
    }
    det2 = {
        "class_name": "fissura",
        "confidence": 0.70,
        "pixel_box": {"x1": 105, "y1": 105, "x2": 205, "y2": 205} # Alto IoU com det1
    }

    result = processor._apply_nms([det1, det2], iou_threshold=0.3)
    # Apenas a de maior confiança (0.95) deve ser mantida
    assert len(result) == 1
    assert result[0]["confidence"] == 0.95

def test_apply_nms_preserves_distant_boxes(processor):
    # Duas detecções em regiões completamente diferentes
    det1 = {
        "class_name": "fissura",
        "confidence": 0.90,
        "pixel_box": {"x1": 10, "y1": 10, "x2": 50, "y2": 50}
    }
    det2 = {
        "class_name": "sujidade",
        "confidence": 0.85,
        "pixel_box": {"x1": 500, "y1": 500, "x2": 600, "y2": 600}
    }

    result = processor._apply_nms([det1, det2], iou_threshold=0.3)
    assert len(result) == 2

def test_draw_on_image(processor):
    img = np.zeros((300, 300, 3), dtype=np.uint8)
    detections = [{
        "class_name": "infiltracao",
        "confidence": 0.88,
        "pixel_box": {"x1": 50, "y1": 50, "x2": 150, "y2": 150}
    }]

    drawn = processor._draw_on_image(img.copy(), detections)
    assert drawn.shape == (300, 300, 3)
    assert drawn.dtype == np.uint8
    # A imagem desenhada deve conter pixels não-pretos devido à anotação
    assert np.any(drawn > 0)
