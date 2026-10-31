from typing import Any, Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    phase: str


class ImageMetadataResponse(BaseModel):
    filename: str
    media_type: str
    file_size_bytes: int
    width: int | None = None
    height: int | None = None
    format: str | None = None
    calibration_status: str | None = None


class ThermalMetadataResponse(BaseModel):
    filename: str
    media_type: str
    file_size_bytes: int
    rows: int | None = None
    columns: int | None = None
    temperature_unit: str | None = None
    calibration_status: str


class UploadValidationResponse(BaseModel):
    valid: bool
    rgb: ImageMetadataResponse
    thermal: ThermalMetadataResponse
    warnings: list[str]


class ConfigurationResponse(BaseModel):
    strategy: str
    body_region: str
    delta_t_threshold_celsius: float | None = None
    baseline_min_celsius: float | None = None
    baseline_max_celsius: float | None = None


class ArtifactDescriptorResponse(BaseModel):
    name: str
    source: str
    mocked: bool
    description: str
    data_url: str | None = None


class MetricsResponse(BaseModel):
    maximum_temperature_celsius: float
    maximum_delta_t_celsius: float
    epicenter_x: float
    epicenter_y: float
    thermal_gradient_celsius_per_cm: float
    estimated_pattern: str


class AnalysisResponse(BaseModel):
    status: Literal["mock_complete"]
    prototype_output: bool
    configuration: ConfigurationResponse
    metrics: MetricsResponse
    artifacts: list[ArtifactDescriptorResponse]
    explanation: str
    warnings: list[str]
    limitation: str
    uploads: UploadValidationResponse


class ConfigurationOptionResponse(BaseModel):
    value: str
    label: str
    description: str


class ConfigurationOptionsResponse(BaseModel):
    strategies: list[ConfigurationOptionResponse]
    body_regions: list[str]
    defaults: dict[str, float]
