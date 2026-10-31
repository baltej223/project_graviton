import json
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


def _png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (2, 2), color=(100, 100, 100)).save(output, format="PNG")
    return output.getvalue()


def test_analyze_returns_strategy_specific_mock_result() -> None:
    response = TestClient(app).post(
        "/api/v1/analyze",
        files={
            "rgb_file": ("rgb.png", _png_bytes(), "image/png"),
            "thermal_file": ("thermal.csv", b"31.5,32.0\n33.0,34.0\n", "text/csv"),
        },
        data={
            "thermal_unit": "celsius",
            "configuration": json.dumps(
                {
                    "strategy": "bilateral",
                    "body_region": "limb_joint",
                    "delta_t_threshold_celsius": 1.2,
                }
            ),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "mock_complete"
    assert body["prototype_output"] is True
    assert body["configuration"]["strategy"] == "bilateral"
    assert body["metrics"]["maximum_delta_t_celsius"] == 1.6
    assert "corresponding reference side" in body["explanation"]
    overlay = next(item for item in body["artifacts"] if item["name"] == "final_overlay")
    assert overlay["mocked"] is False
    assert overlay["data_url"].startswith("data:image/png;base64,")


def test_validate_upload_rejects_missing_csv_unit() -> None:
    response = TestClient(app).post(
        "/api/v1/validate-upload",
        files={
            "rgb_file": ("rgb.png", _png_bytes(), "image/png"),
            "thermal_file": ("thermal.csv", b"31.5,32.0\n", "text/csv"),
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_input"
