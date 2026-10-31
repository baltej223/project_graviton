import base64
import io

import cv2
import matplotlib
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


def _png_data_url(image: np.ndarray) -> str:
    output = io.BytesIO()
    Image.fromarray(image).save(output, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(output.getvalue()).decode('ascii')}"


def create_bilateral_visuals(
    ingestion: IngestionResult,
    blend_intensity: float = 0.5,
) -> tuple[str, str]:
    """Create the isolated Inferno regions and their RGB blended composite."""
    if not 0.0 <= blend_intensity <= 1.0:
        raise ValueError("blend_intensity must be between 0 and 1")

    if ingestion.thermal_matrix is not None:
        matrix = ingestion.thermal_matrix
        low, high = float(np.min(matrix)), float(np.max(matrix))
        if high > low:
            gray = np.clip((matrix - low) * (255.0 / (high - low)), 0, 255).astype(np.uint8)
        else:
            gray = np.full(matrix.shape, 128, dtype=np.uint8)
    else:
        image = cv2.imdecode(
            np.frombuffer(ingestion.thermal_bytes, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )
        if image is None:
            raise ValueError("Uploaded thermal image could not be decoded")
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, threshold = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(threshold, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    regions = np.zeros_like(mask)
    selected = [
        contour
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:2]
        if cv2.contourArea(contour) > 500
    ]
    if selected:
        cv2.drawContours(regions, selected, -1, 255, thickness=cv2.FILLED)
    elif contours:
        cv2.drawContours(regions, [max(contours, key=cv2.contourArea)], -1, 255, thickness=cv2.FILLED)
    else:
        regions = mask

    active = regions > 0
    colored = np.zeros((*gray.shape, 3), dtype=np.uint8)
    if np.any(active):
        values = gray[active].astype(np.float32)
        lo, hi = float(values.min()), float(values.max())
        normalized = np.zeros(gray.shape, dtype=np.float32)
        normalized[active] = (
            0.1 + (gray[active].astype(np.float32) - lo) * (0.8 / (hi - lo))
            if hi > lo else 0.5
        )
        colormap = matplotlib.colormaps["inferno"]
        colored = (colormap(normalized)[:, :, :3] * 255).astype(np.uint8)
        colored[~active] = 0

    backdrop = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    isolated_on_gray = colored.copy()
    isolated_on_gray[~active] = backdrop[~active]
    rgb_bgr = cv2.imdecode(
        np.frombuffer(ingestion.rgb_bytes, dtype=np.uint8),
        cv2.IMREAD_COLOR,
    )
    if rgb_bgr is None:
        raise ValueError("Uploaded RGB image could not be decoded")
    rgb = cv2.cvtColor(rgb_bgr, cv2.COLOR_BGR2RGB)
    if rgb.shape[:2] != gray.shape:
        rgb = cv2.resize(rgb, (gray.shape[1], gray.shape[0]), interpolation=cv2.INTER_LINEAR)
    blended = cv2.addWeighted(isolated_on_gray, blend_intensity, rgb, 1.0 - blend_intensity, 0)
    return _png_data_url(colored), _png_data_url(blended)


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


def create_overlay_descriptors(
    ingestion: IngestionResult,
    include_bilateral: bool = False,
    blend_intensity: float = 0.5,
) -> list[dict[str, object]]:
    overlay_data_url = create_overlay_data_url(ingestion)
    descriptors = [
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
    if include_bilateral:
        isolated_url, blended_url = create_bilateral_visuals(ingestion, blend_intensity)
        descriptors.extend([
            {
                "name": "bilateral_inferno_regions",
                "source": "thermal",
                "mocked": False,
                "data_url": isolated_url,
                "description": "Inferno-colored foreground regions on a black background.",
            },
            {
                "name": "bilateral_blended_overlay",
                "source": "rgb+thermal",
                "mocked": False,
                "data_url": blended_url,
                "description": "Bilateral thermal regions blended with the RGB image.",
            },
        ])
    return descriptors
