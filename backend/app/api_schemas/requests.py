from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AnalysisConfigurationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    strategy: Literal["bilateral", "midline", "normative"]
    body_region: str = Field(min_length=1, max_length=80)
    delta_t_threshold_celsius: float | None = Field(default=None, gt=0)
    baseline_min_celsius: float | None = None
    baseline_max_celsius: float | None = None

    @model_validator(mode="after")
    def validate_strategy_values(self) -> "AnalysisConfigurationRequest":
        if self.strategy in {"bilateral", "midline"}:
            if self.delta_t_threshold_celsius is None:
                raise ValueError(
                    "delta_t_threshold_celsius is required for bilateral and midline strategies"
                )
            if self.baseline_min_celsius is not None or self.baseline_max_celsius is not None:
                raise ValueError("baseline values are only valid for the normative strategy")
        else:
            if self.baseline_min_celsius is None or self.baseline_max_celsius is None:
                raise ValueError(
                    "baseline_min_celsius and baseline_max_celsius are required for normative strategy"
                )
            if self.baseline_min_celsius >= self.baseline_max_celsius:
                raise ValueError("baseline_min_celsius must be lower than baseline_max_celsius")
            if self.delta_t_threshold_celsius is not None:
                raise ValueError("delta_t_threshold_celsius is only valid for bilateral or midline")
        return self
