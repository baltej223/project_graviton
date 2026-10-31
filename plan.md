# Multimodal Bioheat Tracker: Implementation Plan

This plan turns the documented five-phase architecture into a chronological build. Each phase ends with a demonstrable working slice, so the project can be shown to judges before the complete pipeline is connected.

## Phase 0: Repository and contracts

**Goal:** Establish the project shape before implementing algorithms.

**Work:**

- Create separate frontend and Python backend directories.
- Add frontend and backend dependency manifests.
- Define the core data contracts:
  - RGB image input.
  - Thermal matrix and calibration metadata.
  - Registration transform and alignment quality.
  - Anatomy strategy and configurable thresholds.
  - Intermediate artifacts.
  - Final analysis metrics and limitations.
- Add a small synthetic fixture format for deterministic development.
- Add the first lint, type-check, and test configuration.

**Working result:** The repository has a repeatable structure and typed contracts, but no clinical processing is implied yet.

## Phase 1: Standalone frontend prototype

**Goal:** Build the user-visible workflow before connecting any backend.

**Work:**

- Create a React/TypeScript dashboard with:
  - RGB and thermal upload panels.
  - File previews and validation messages.
  - Anatomy-strategy selector.
  - Configurable threshold fields.
  - Analyze button and progress state.
  - Empty-state metric cards.
- Use local mock data to render:
  - RGB image.
  - Thermal preview.
  - Transparent overlay.
  - Anomaly mask and isotherm layers.
  - Peak temperature, maximum ΔT, gradient, and depth classification.
- Add a clear triage/monitoring disclaimer.

**Working result:** A user can open the app, select files, and navigate a realistic dashboard with mocked analysis results. It is intentionally not connected to a backend.

## Phase 2: Ingestion and preprocessing

**Goal:** Accept real files and normalize them into safe internal representations.

**Work:**

- Implement RGB JPEG/PNG loading.
- Implement CSV thermal-matrix loading with explicit Celsius units and validation.
- Add an adapter boundary for radiometric JPEG support without assuming a camera-specific format.
- Preserve raw calibrated temperatures separately from display-scaled pixels.
- Normalize dimensions and record image metadata.
- Reject missing calibration, malformed matrices, incompatible dimensions, and unsupported formats explicitly.
- Expose a backend endpoint for validated upload metadata.
- Replace frontend mock previews with real uploaded-file previews where possible.

**Working result:** The system accepts a real RGB image and thermal CSV, validates both, and returns a typed preprocessing result.

## Phase 3: Multimodal registration

**Goal:** Produce an explicit, inspectable alignment between thermal and RGB data.

**Work:**

- Extract structural edges and contours from both representations.
- Use contour/bounding-box matching as the baseline alignment method.
- Add ORB or SIFT feature matching when the images contain usable landmarks.
- Compute and store the selected transform, confidence/quality measures, and transformed coordinates.
- Warp the thermal matrix into RGB coordinates while preserving temperature values.
- Generate an alignment overlay showing RGB structure and thermal structure together.
- Fail explicitly when registration quality is insufficient; never silently display unaligned data as aligned.

**Working result:** A real pair of images produces an aligned thermal layer, a visible registration overlay, and a transform record.

## Phase 4: Adaptive region analysis

**Goal:** Choose the correct comparison method for the anatomy instead of applying bilateral subtraction universally.

**Work:**

- Add an explicit anatomy configuration with:
  - Bilateral structures.
  - Singular structures with usable internal midline symmetry.
  - Singular/asymmetric structures requiring normative baselines.
- For bilateral anatomy:
  - Identify corresponding regions.
  - Calculate affected-side minus reference-side temperature.
  - Apply a configurable ΔT threshold.
- For singular anatomy with midline symmetry:
  - Detect or accept the anatomical midline.
  - Compare corresponding internal halves.
- For localized asymmetric anatomy:
  - Use a configurable body-region baseline range.
  - Flag localized temperatures outside the configured range.
- Produce an anomaly mask, comparison method, baseline details, and explanation text.

**Working result:** The same pipeline can analyze a limb with bilateral ΔT, a central structure with midline comparison, or an asymmetric region with normative thresholding.

## Phase 5: Isotherms and depth estimation

**Goal:** Turn anomaly pixels into explainable heat-source metrics.

**Work:**

- Identify the thermal epicenter and its coordinates.
- Generate isotherm contours around the abnormal region.
- Calculate temperature falloff and a configurable gradient metric.
- Classify the pattern as superficial or deep using documented thresholds.
- Preserve the aligned thermal matrix, anomaly mask, epicenter, isotherms, gradient, and classification as artifacts.
- Include the exact configuration and method used in the structured result.
- Phrase the output as a heuristic triage/monitoring estimate, not a diagnosis.

**Working result:** A processed scan produces an explainable analysis object and visual layers that can be inspected independently.

## Phase 6: Backend API integration

**Goal:** Connect the working frontend to the Python pipeline.

**Work:**

- Add FastAPI endpoints for:
  - Upload and validation.
  - Analysis configuration.
  - Registration and analysis execution.
  - Intermediate artifact retrieval.
  - Structured result retrieval.
- Return stable JSON schemas for metrics, thresholds, strategy, warnings, and limitations.
- Add clear error responses for invalid inputs and failed registration.
- Replace all relevant frontend mock data with API responses.
- Show processing states and actionable errors in the dashboard.

**Working result:** A user can upload real inputs in the React app and receive a complete backend-generated analysis.

## Phase 7: Dashboard polish and report export

**Goal:** Make the result understandable and usable in a clinical demonstration.

**Work:**

- Add synchronized image views for source RGB, thermal preview, aligned thermal data, anomaly mask, isotherms, and final overlay.
- Display maximum temperature, maximum ΔT, epicenter location, gradient, depth classification, strategy, and thresholds.
- Add plain-language explanations for why a region was flagged.
- Implement ReportLab PDF export containing:
  - Input metadata and timestamp.
  - Analysis method and configuration.
  - Source and final overlay images.
  - Key metrics and warnings.
  - Intermediate artifact references.
  - Triage/monitoring limitation.
- Add a frontend download action and backend report endpoint.

**Working result:** The complete flow ends in a printable, explainable report suitable for attaching to an EHR workflow, without claiming definitive diagnosis.

## Phase 8: Validation and demo readiness

**Goal:** Verify the MVP against synthetic and representative paired inputs.

**Work:**

- Test malformed CSVs, missing calibration, mismatched dimensions, and unsupported files.
- Test bilateral, midline, and normative-baseline branches independently.
- Test registration success and explicit low-confidence failure.
- Test isotherm, gradient, and depth classification edge cases.
- Test that raw temperatures are used for calculations rather than display-scaled values.
- Test that all intermediate artifacts are returned and renderable.
- Run frontend lint/type checks and Python tests.
- Prepare a deterministic demo dataset with one example for each anatomy branch.
- Document that outputs are heuristic triage/monitoring assistance and require clinical interpretation.

**Working result:** The MVP has a repeatable end-to-end demonstration and focused automated coverage for its core behavior.

## MVP boundary

The first demonstrable release includes the five documented processing phases, a React dashboard, a Python API/pipeline, synthetic or paired test inputs, and PDF export. It intentionally excludes AR projection, dynamic ambient calibration, temporal analysis, heavy model training, and definitive diagnostic claims.
