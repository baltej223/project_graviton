from fastapi import UploadFile

from app.api_schemas.requests import AnalysisConfigurationRequest
from app.api_schemas.responses import (
    AnalysisResponse,
    ArtifactDescriptorResponse,
    ConfigurationResponse,
    ImageMetadataResponse,
    MetricsResponse,
    ThermalMetadataResponse,
    UploadValidationResponse,
)
from app.engine.analysis import create_mock_analysis
from app.engine.ingestion import ingest_uploads
from app.engine.models import AnalysisConfiguration
from app.engine.overlays import create_overlay_descriptors


async def _read_upload(upload: UploadFile) -> bytes:
    return await upload.read()


def _upload_response(result) -> UploadValidationResponse:
    rgb = result.rgb
    thermal = result.thermal
    return UploadValidationResponse(
        valid=True,
        rgb=ImageMetadataResponse(
            filename=rgb.filename,
            media_type=rgb.media_type,
            file_size_bytes=rgb.file_size_bytes,
            width=rgb.width,
            height=rgb.height,
            format=rgb.format,
            calibration_status=rgb.calibration_status,
        ),
        thermal=ThermalMetadataResponse(
            filename=thermal.filename,
            media_type=thermal.media_type,
            file_size_bytes=thermal.file_size_bytes,
            rows=thermal.rows,
            columns=thermal.columns,
            temperature_unit=thermal.temperature_unit,
            calibration_status=thermal.calibration_status,
        ),
        warnings=result.warnings,
    )


async def validate_uploads(
    rgb_file: UploadFile,
    thermal_file: UploadFile,
    thermal_unit: str | None,
) -> UploadValidationResponse:
    result = ingest_uploads(
        rgb_filename=rgb_file.filename or "",
        rgb_media_type=rgb_file.content_type,
        rgb_bytes=await _read_upload(rgb_file),
        thermal_filename=thermal_file.filename or "",
        thermal_media_type=thermal_file.content_type,
        thermal_bytes=await _read_upload(thermal_file),
        thermal_unit=thermal_unit,
    )
    return _upload_response(result)


async def analyze_uploads(
    rgb_file: UploadFile,
    thermal_file: UploadFile,
    thermal_unit: str | None,
    configuration_request: AnalysisConfigurationRequest,
) -> AnalysisResponse:
    ingestion = ingest_uploads(
        rgb_filename=rgb_file.filename or "",
        rgb_media_type=rgb_file.content_type,
        rgb_bytes=await _read_upload(rgb_file),
        thermal_filename=thermal_file.filename or "",
        thermal_media_type=thermal_file.content_type,
        thermal_bytes=await _read_upload(thermal_file),
        thermal_unit=thermal_unit,
    )
    configuration = AnalysisConfiguration.from_request(configuration_request)
    result = create_mock_analysis(configuration, ingestion)
    return AnalysisResponse(
        status="mock_complete",
        prototype_output=True,
        configuration=ConfigurationResponse(**configuration.to_dict()),
        metrics=MetricsResponse(**result.metrics),
        artifacts=[
            ArtifactDescriptorResponse(**artifact)
            for artifact in create_overlay_descriptors(ingestion)
        ],
        explanation=result.explanation,
        warnings=[*ingestion.warnings, *result.warnings],
        limitation=result.limitation,
        uploads=_upload_response(ingestion),
    )
