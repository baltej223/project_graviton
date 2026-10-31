import base64
import io

import numpy as np
from PIL import Image

from app.engine.models import IngestionResult


def _thermal_image(ingestion: IngestionResult) -> Image.Image:
    if ingestion.thermal_matrix is not None:
        matrix = ingestion.thermal_matrix
        minimum = float(np.min(matrix))
        maximum = float(np.max(matrix))
        span = maximum - minimum
        normalized = np.zeros_like(matrix, dtype=np.uint8)
        if span > 0:
            normalized = np.asarray((matrix - minimum) / span * 255, dtype=np.uint8)
        red = normalized
        green = np.asarray(np.clip(255 - np.abs(normalized.astype(float) - 170) * 2.2, 0, 255), dtype=np.uint8)
        blue = 255 - normalized
        return Image.fromarray(np.dstack((red, green, blue)))

    thermal_bytes = ingestion.thermal_display_bytes or ingestion.thermal_bytes
    with Image.open(io.BytesIO(thermal_bytes)) as image:
        return image.convert("RGB")


def create_overlay_data_url(ingestion: IngestionResult) -> str:
    with Image.open(io.BytesIO(ingestion.rgb_bytes)) as image:
        rgb = image.convert("RGBA")
    thermal = _thermal_image(ingestion).resize(rgb.size, Image.Resampling.BILINEAR).convert("RGBA")
    thermal.putalpha(150)
    overlay = Image.alpha_composite(rgb, thermal)
    output = io.BytesIO()
    overlay.save(output, format="PNG")
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def create_overlay_descriptors(ingestion: IngestionResult) -> list[dict[str, object]]:
    overlay_data_url = create_overlay_data_url(ingestion)
    return [
        {
            "name": "rgb_source",
            "source": "rgb",
            "mocked": False,
            "description": "Uploaded RGB source image.",
        },
        {
            "name": "thermal_preview",
            "source": "thermal",
            "mocked": True,
            "description": "Thermal visualization preview; calibration processing is mocked.",
        },
        {
            "name": "registration_overlay",
            "source": "rgb+thermal",
            "mocked": False,
            "data_url": overlay_data_url,
            "description": "Basic thermal-to-RGB resize overlay; full registration is deferred.",
        },
        {
            "name": "anomaly_mask",
            "source": "thermal",
            "mocked": True,
            "description": "Placeholder anomaly mask; no thermal anomaly calculation is performed.",
        },
        {
            "name": "isotherm_map",
            "source": "thermal",
            "mocked": True,
            "description": "Placeholder isotherm layer; contour generation is deferred.",
        },
        {
            "name": "final_overlay",
            "source": "rgb+thermal",
            "mocked": False,
            "data_url": overlay_data_url,
            "description": "Basic generated overlay for the Phase 3 integration slice.",
        },
    ]
