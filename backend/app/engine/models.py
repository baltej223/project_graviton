from dataclasses import dataclass
from typing import Literal

import numpy as np

from app.api_schemas.requests import AnalysisConfigurationRequest
from app.engine.errors import InvalidConfigurationError

AnalysisStrategy = Literal["bilateral", "midline", "normative"]


@dataclass(frozen=True)
class ImageMetadata:
    filename: str
    media_type: str
    file_size_bytes: int
    width: int
    height: int
    format: str
    calibration_status: str | None = None


@dataclass(frozen=True)
class ThermalMetadata:
    filename: str
    media_type: str
    file_size_bytes: int
    rows: int | None
    columns: int | None
    temperature_unit: str | None
    calibration_status: str


@dataclass(frozen=True)
class IngestionResult:
    rgb: ImageMetadata
    thermal: ThermalMetadata
    thermal_matrix: np.ndarray | None
    rgb_bytes: bytes
    thermal_bytes: bytes
    warnings: list[str]


@dataclass(frozen=True)
class AnalysisConfiguration:
    strategy: AnalysisStrategy
    body_region: str
    delta_t_threshold_celsius: float | None = None
    baseline_min_celsius: float | None = None
    baseline_max_celsius: float | None = None

    @classmethod
    def from_request(cls, request: AnalysisConfigurationRequest) -> "AnalysisConfiguration":
        try:
            return cls(
                strategy=request.strategy,
                body_region=request.body_region,
                delta_t_threshold_celsius=request.delta_t_threshold_celsius,
                baseline_min_celsius=request.baseline_min_celsius,
                baseline_max_celsius=request.baseline_max_celsius,
            )
        except (TypeError, ValueError) as error:
            raise InvalidConfigurationError(str(error), "configuration") from error

    def to_dict(self) -> dict[str, object]:
        return {
            "strategy": self.strategy,
            "body_region": self.body_region,
            "delta_t_threshold_celsius": self.delta_t_threshold_celsius,
            "baseline_min_celsius": self.baseline_min_celsius,
            "baseline_max_celsius": self.baseline_max_celsius,
        }


@dataclass(frozen=True)
class MockAnalysisResult:
    metrics: dict[str, float | str]
    explanation: str
    warnings: list[str]
    limitation: str
