import json
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.api_schemas.requests import AnalysisConfigurationRequest
from app.api_schemas.responses import (
    AnalysisResponse,
    ConfigurationOptionsResponse,
    HealthResponse,
    UploadValidationResponse,
)
from app.application.services import analyze_uploads, validate_uploads
from app.engine.errors import EngineError

router = APIRouter()


def _engine_http_error(error: EngineError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={
            "code": error.code,
            "message": str(error),
            "field": error.field,
        },
    )


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="bioheat-tracker", phase="phase-1")


@router.get(
    "/api/v1/configuration-options",
    response_model=ConfigurationOptionsResponse,
)
def configuration_options() -> ConfigurationOptionsResponse:
    return ConfigurationOptionsResponse(
        strategies=[
            {
                "value": "bilateral",
                "label": "Bilateral comparison",
                "description": "Compare corresponding regions on paired anatomy.",
            },
            {
                "value": "midline",
                "label": "Internal midline symmetry",
                "description": "Compare corresponding sides within one structure.",
            },
            {
                "value": "normative",
                "label": "Normative baseline",
                "description": "Compare a localized region with a configured baseline range.",
            },
        ],
        body_regions=[
            "limb_joint",
            "hand_foot",
            "spine_torso",
            "localized_asymmetric_region",
        ],
        defaults={
            "delta_t_threshold_celsius": 1.2,
            "baseline_min_celsius": 30.0,
            "baseline_max_celsius": 35.0,
        },
    )


@router.post(
    "/api/v1/validate-upload",
    response_model=UploadValidationResponse,
)
async def validate_upload(
    rgb_file: Annotated[UploadFile, File(...)],
    thermal_file: Annotated[UploadFile, File(...)],
    thermal_unit: Annotated[str | None, Form()] = None,
) -> UploadValidationResponse:
    try:
        return await validate_uploads(rgb_file, thermal_file, thermal_unit)
    except EngineError as error:
        raise _engine_http_error(error) from error


@router.post("/api/v1/analyze", response_model=AnalysisResponse)
async def analyze(
    rgb_file: Annotated[UploadFile, File(...)],
    thermal_file: Annotated[UploadFile, File(...)],
    configuration: Annotated[str, Form(...)],
    thermal_unit: Annotated[str | None, Form()] = None,
) -> AnalysisResponse:
    try:
        configuration_request = AnalysisConfigurationRequest.model_validate(
            json.loads(configuration)
        )
        return await analyze_uploads(
            rgb_file,
            thermal_file,
            thermal_unit,
            configuration_request,
        )
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "invalid_configuration_json",
                "message": "configuration must be a valid JSON object",
                "field": "configuration",
            },
        ) from error
    except EngineError as error:
        raise _engine_http_error(error) from error
