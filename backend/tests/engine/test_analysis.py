from io import BytesIO

from PIL import Image

from app.api_schemas.requests import AnalysisConfigurationRequest
from app.engine.analysis import create_mock_analysis
from app.engine.ingestion import ingest_uploads
from app.engine.models import AnalysisConfiguration


def _png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (2, 2), color=(100, 100, 100)).save(output, format="PNG")
    return output.getvalue()


def test_mock_analysis_explains_selected_strategy() -> None:
    configuration = AnalysisConfiguration.from_request(
        AnalysisConfigurationRequest(
            strategy="normative",
            body_region="localized_asymmetric_region",
            baseline_min_celsius=30.0,
            baseline_max_celsius=35.0,
        )
    )
    ingestion = ingest_uploads(
        rgb_filename="rgb.png",
        rgb_media_type="image/png",
        rgb_bytes=_png_bytes(),
        thermal_filename="thermal.png",
        thermal_media_type="image/png",
        thermal_bytes=_png_bytes(),
        thermal_unit=None,
    )
    assert configuration.strategy == "normative"
    assert ingestion.thermal.calibration_status == "unverified"


def test_mock_output_is_deterministic_for_same_configuration() -> None:
    from app.engine.models import IngestionResult, ImageMetadata, ThermalMetadata

    configuration = AnalysisConfiguration(
        strategy="bilateral",
        body_region="limb_joint",
        delta_t_threshold_celsius=1.2,
    )
    ingestion = IngestionResult(
        rgb=ImageMetadata("rgb.png", "image/png", 1, 1, 1, "PNG"),
        thermal=ThermalMetadata(
            "thermal.csv", "text/csv", 1, 1, 1, "celsius", "calibrated"
        ),
        thermal_matrix=None,
        rgb_bytes=b"",
        thermal_bytes=b"",
        warnings=[],
    )

    first = create_mock_analysis(configuration, ingestion)
    second = create_mock_analysis(configuration, ingestion)

    assert first == second
