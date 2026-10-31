# Copilot instructions

## Repository status and source of truth

This repository currently contains the project strategy and prompt for a proposed **multimodal bioheat tracker**; it does not yet contain application code, dependency manifests, or automated tests. Treat `Hackathon Project Strategy for Judges.md` as the technical product/architecture source of truth and `Prompt.md` as the implementation-planning context. Preserve the documented scope unless the user explicitly changes it.

The current scope excludes AR projection, dynamic ambient calibration, and temporal analysis. The intended MVP is a lightweight, CPU-bound, explainable analysis tool rather than a model-training-heavy diagnostic system.

## Build, test, and lint

No build, test, lint, or package-manager commands are defined yet. Do not invent a command or claim validation has run until implementation files add the relevant Python project configuration and scripts. When tooling is introduced, document the exact full-suite and single-test commands here.

## Architecture

The planned application is a Python processing pipeline with a React frontend:

1. **Ingestion and preprocessing:** accept a high-resolution RGB image plus a thermal matrix (CSV or radiometric JPEG), normalize their dimensions/representations, and preserve the thermal values as temperatures for analysis.
2. **Multimodal registration:** use classical OpenCV image processing (edges/contours and feature or geometric matching) to warp the lower-resolution thermal data into RGB coordinates.
3. **Adaptive region analysis:** choose the comparison strategy from the anatomy:
   - Bilateral structures such as limbs, hands, and feet use corresponding-side temperature subtraction and a configurable ΔT threshold.
   - Singular or central structures use internal midline symmetry where available; otherwise use localized normative temperature baselines rather than forcing a bilateral comparison.
4. **Isotherms and depth estimation:** identify the thermal epicenter, generate contour/isotherm regions with SciPy-style numerical tooling, calculate the temperature falloff gradient, and classify the pattern as superficial or deep tissue. This is a simplified, explainable approximation—not a clinical diagnosis or a full bioheat solver.
5. **Dashboard and report:** display the RGB image with a transparent flagged-region heatmap, expose maximum temperature/ΔT/depth metrics, and generate a clinical PDF report suitable for attaching to an EHR.

Keep processing modular so each phase can be demonstrated independently and so synthetic or paired test inputs can exercise the pipeline before real clinical data is available.

## Project-specific conventions

- Prefer deterministic, explainable classical computer vision and mathematical operations over opaque ML models.
- Keep raw thermal measurements separate from visualization scaling. A 0–255 representation may be used for image algorithms, but temperature calculations must use the original calibrated values.
- Registration must produce an explicit transform and a visibly inspectable overlay; do not silently fall back to unaligned RGB/thermal data.
- Make the anatomy branch explicit in the analysis result. Do not apply bilateral subtraction to a singular structure simply because it is the default path.
- Keep thresholds, baseline ranges, and depth-classification rules configurable and visible in the analysis/report output; avoid unexplained magic numbers.
- Preserve clinically meaningful intermediate artifacts—aligned thermal data, anomaly mask, epicenter, isotherms, gradient, and final overlay—so the UI and report can explain how a result was produced.
- Treat outputs as triage/monitoring assistance. Avoid wording that presents the heuristic result as a definitive diagnosis.
- Follow the five documented phases when adding features; a feature should identify which phase it belongs to and keep unrelated phases decoupled.
- The planned UI is React, backed by the Python numerical/vision stack with OpenCV, NumPy, and SciPy. Add other dependencies only when the feature requires them and update repository documentation/configuration at the same time.
