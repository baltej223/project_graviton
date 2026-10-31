import numpy as np
import pytest
from PIL import Image

from app.engine.errors import InvalidInputError
from app.engine.ingestion import ingest_uploads


def _png_bytes() -> bytes:
    image = Image.new("RGB", (4, 3), color=(100, 100, 100))
    from io import BytesIO

    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_ingestion_preserves_raw_celsius_values() -> None:
    result = ingest_uploads(
        rgb_filename="rgb.png",
        rgb_media_type="image/png",
        rgb_bytes=_png_bytes(),
        thermal_filename="thermal.csv",
        thermal_media_type="text/csv",
        thermal_bytes=b"31.5,32.0\n33.25,34.0\n",
        thermal_unit="celsius",
    )

    assert result.thermal.rows == 2
    assert result.thermal.columns == 2
    assert result.thermal_matrix is not None
    np.testing.assert_array_equal(result.thermal_matrix, [[31.5, 32.0], [33.25, 34.0]])


def test_ingestion_rejects_non_rectangular_csv() -> None:
    with pytest.raises(InvalidInputError, match="rectangular"):
        ingest_uploads(
            rgb_filename="rgb.png",
            rgb_media_type="image/png",
            rgb_bytes=_png_bytes(),
            thermal_filename="thermal.csv",
            thermal_media_type="text/csv",
            thermal_bytes=b"31.5,32.0\n33.25\n",
            thermal_unit="celsius",
        )


def test_ingestion_requires_explicit_celsius_for_csv() -> None:
    with pytest.raises(InvalidInputError, match="Celsius"):
        ingest_uploads(
            rgb_filename="rgb.png",
            rgb_media_type="image/png",
            rgb_bytes=_png_bytes(),
            thermal_filename="thermal.csv",
            thermal_media_type="text/csv",
            thermal_bytes=b"31.5,32.0\n",
            thermal_unit=None,
        )
