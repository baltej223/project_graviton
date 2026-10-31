import csv
import io
from pathlib import PurePath

import numpy as np
from PIL import Image, UnidentifiedImageError

from app.engine.errors import InvalidInputError, UnsupportedFormatError
from app.engine.models import ImageMetadata, IngestionResult, ThermalMetadata

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def _extension(filename: str) -> str:
    return PurePath(filename).suffix.lower()


def _validate_image(
    filename: str,
    media_type: str | None,
    content: bytes,
    calibration_status: str | None = None,
) -> ImageMetadata:
    if not content:
        raise InvalidInputError("file is empty", filename)
    if _extension(filename) not in SUPPORTED_IMAGE_EXTENSIONS:
        raise UnsupportedFormatError("only JPEG and PNG images are supported", filename)
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            width, height = image.size
            image_format = image.format or "unknown"
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidInputError("file is not a readable raster image", filename) from error
    return ImageMetadata(
        filename=filename,
        media_type=media_type or "application/octet-stream",
        file_size_bytes=len(content),
        width=width,
        height=height,
        format=image_format,
        calibration_status=calibration_status,
    )


def _parse_thermal_csv(
    filename: str,
    media_type: str | None,
    content: bytes,
    temperature_unit: str | None,
) -> tuple[ThermalMetadata, np.ndarray]:
    if not content:
        raise InvalidInputError("file is empty", filename)
    if temperature_unit is None or temperature_unit.strip().lower() not in {"c", "celsius", "°c"}:
        raise InvalidInputError(
            "thermal_unit must explicitly identify Celsius for CSV input",
            "thermal_unit",
        )
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise InvalidInputError("thermal CSV must be UTF-8 encoded", filename) from error

    rows: list[list[float]] = []
    for row_number, row in enumerate(csv.reader(io.StringIO(text)), start=1):
        if not row or all(not cell.strip() for cell in row):
            raise InvalidInputError(f"thermal CSV contains a blank row at {row_number}", filename)
        try:
            values = [float(cell.strip()) for cell in row]
        except ValueError as error:
            raise InvalidInputError(
                f"thermal CSV contains a non-numeric value at row {row_number}",
                filename,
            ) from error
        if not values:
            raise InvalidInputError("thermal CSV contains an empty row", filename)
        rows.append(values)

    if not rows:
        raise InvalidInputError("thermal CSV contains no values", filename)
    column_count = len(rows[0])
    if any(len(row) != column_count for row in rows):
        raise InvalidInputError("thermal CSV must be rectangular", filename)

    matrix = np.asarray(rows, dtype=np.float64)
    metadata = ThermalMetadata(
        filename=filename,
        media_type=media_type or "text/csv",
        file_size_bytes=len(content),
        rows=matrix.shape[0],
        columns=matrix.shape[1],
        temperature_unit="celsius",
        calibration_status="calibrated",
    )
    return metadata, matrix


def ingest_uploads(
    *,
    rgb_filename: str,
    rgb_media_type: str | None,
    rgb_bytes: bytes,
    thermal_filename: str,
    thermal_media_type: str | None,
    thermal_bytes: bytes,
    thermal_unit: str | None,
) -> IngestionResult:
    if not rgb_filename:
        raise InvalidInputError("RGB filename is required", "rgb_file")
    if not thermal_filename:
        raise InvalidInputError("thermal filename is required", "thermal_file")

    rgb_metadata = _validate_image(rgb_filename, rgb_media_type, rgb_bytes)
    thermal_extension = _extension(thermal_filename)
    if thermal_extension == ".csv":
        thermal_metadata, thermal_matrix = _parse_thermal_csv(
            thermal_filename,
            thermal_media_type,
            thermal_bytes,
            thermal_unit,
        )
        warnings: list[str] = []
    elif thermal_extension in SUPPORTED_IMAGE_EXTENSIONS:
        thermal_image = _validate_image(
            thermal_filename,
            thermal_media_type,
            thermal_bytes,
            calibration_status="unverified",
        )
        thermal_metadata = ThermalMetadata(
            filename=thermal_image.filename,
            media_type=thermal_image.media_type,
            file_size_bytes=thermal_image.file_size_bytes,
            rows=None,
            columns=None,
            temperature_unit=None,
            calibration_status=thermal_image.calibration_status or "unverified",
        )
        thermal_matrix = None
        warnings = [
            "Thermal image calibration is unverified; ordinary image pixels are not treated as Celsius."
        ]
    else:
        raise UnsupportedFormatError("thermal input must be CSV, JPEG, or PNG", thermal_filename)

    return IngestionResult(
        rgb=rgb_metadata,
        thermal=thermal_metadata,
        thermal_matrix=thermal_matrix,
        rgb_bytes=rgb_bytes,
        thermal_bytes=thermal_bytes,
        warnings=warnings,
    )
