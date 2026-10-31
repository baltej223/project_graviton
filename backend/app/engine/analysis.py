from app.engine.models import AnalysisConfiguration, IngestionResult, MockAnalysisResult


def create_mock_analysis(
    configuration: AnalysisConfiguration,
    ingestion: IngestionResult,
) -> MockAnalysisResult:
    if configuration.strategy == "bilateral":
        explanation = (
            "The prototype compares the selected region with a corresponding reference side "
            f"using the configured ΔT threshold of {configuration.delta_t_threshold_celsius:.1f} °C."
        )
    elif configuration.strategy == "midline":
        explanation = (
            "The prototype compares the selected region with the corresponding internal side "
            f"using the configured ΔT threshold of {configuration.delta_t_threshold_celsius:.1f} °C."
        )
    else:
        explanation = (
            "The prototype compares the localized region with the configured baseline range of "
            f"{configuration.baseline_min_celsius:.1f}–{configuration.baseline_max_celsius:.1f} °C."
        )
    warnings = [
        "Registration and all analysis metrics are deterministic mock values in Phase 1.",
        "This output is not a diagnosis.",
    ]
    if ingestion.thermal.calibration_status == "unverified":
        warnings.append("Thermal image calibration is unverified.")
    return MockAnalysisResult(
        metrics={
            "maximum_temperature_celsius": 37.8,
            "maximum_delta_t_celsius": 1.6,
            "epicenter_x": 0.62,
            "epicenter_y": 0.44,
            "thermal_gradient_celsius_per_cm": 0.42,
            "estimated_pattern": "deep_diffuse",
        },
        explanation=explanation,
        warnings=warnings,
        limitation=(
            "Prototype output for triage and monitoring assistance only. It is not a diagnosis "
            "and must be interpreted by a qualified clinician."
        ),
    )
