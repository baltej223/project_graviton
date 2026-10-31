# Multimodal Bioheat Tracker: Vertical-Slice Implementation Plan

This plan builds the product in small, demonstrable slices. The frontend and backend are first developed independently. They are then integrated around one working feature at a time. Every integration phase must leave the previous features working.

The backend processing engine remains independent from the API layer throughout the project. The frontend never performs image registration or thermal calculations.

## Phase 0: Repository, contracts, and tooling

**Goal:** Establish the project structure before implementing product behavior.

**Backend work:**

- Create the Python backend, API layer, and independent processing-engine modules.
- Define typed domain models for RGB inputs, thermal data, configurations, artifacts, and results.
- Add FastAPI, pytest, and backend lint/type-check configuration.

**Frontend work:**

- Create the React/TypeScript/Vite application.
- Define frontend types corresponding to the API contracts.
- Add frontend lint, build, and type-check configuration.

**Working result:** Both applications start independently, have documented commands, and share a stable contract without requiring a network connection.

## Phase 1: Independent frontend prototype

**Goal:** Build the complete user interface using local mock data only.

**Frontend work:**

- Add RGB and thermal upload controls with local previews.
- Add anatomy strategy and threshold controls.
- Add processing, empty, validation, and error states.
- Render mocked visual layers, metrics, explanations, warnings, and the triage disclaimer.

**Backend work:** None required for the frontend prototype.

**Working result:** The frontend demonstrates the intended workflow without a backend or network request.

## Phase 2: Independent backend with one overlay feature

**Goal:** Build a working backend independently from the frontend, with only the first processing feature implemented: a basic overlay.

**API/application work:**

- Implement `GET /health`.
- Implement upload validation and typed configuration endpoints.
- Keep HTTP orchestration separate from processing logic.

**Processing-engine work:**

- Accept and validate an RGB image.
- Accept and validate a thermal image or CSV temperature matrix.
- Preserve raw thermal values separately from visualization values.
- Normalize image metadata and dimensions.
- Implement one basic overlay feature: create an inspectable thermal visualization over the RGB image using an explicit transform or clearly labeled placeholder transform.
- Return the overlay artifact and its metadata.
- Do not implement ΔT, anomaly detection, isotherms, gradients, or depth estimation yet.

**Tests:**

- Test RGB and thermal ingestion directly through the engine.
- Test overlay generation without FastAPI.
- Test API validation and health routes separately.

**Working result:** The backend works independently. Given valid inputs, it validates them and produces one inspectable overlay feature. The frontend is still not connected.

## Phase 3: Frontend/backend integration with the overlay feature

**Goal:** Connect the independent systems around the first working feature.

**Integration work:**

- Connect frontend configuration loading to the backend options endpoint.
- Send RGB and thermal files using multipart form data.
- Display backend validation results and errors.
- Display the backend-produced overlay in the frontend.
- Keep the frontend’s local previews and overlay viewer functional.
- Clearly label any artifact that is still mocked or approximate.

**Working result:** A user uploads two images in the React app and sees the backend-generated overlay. No thermal comparison or inflammation calculation is claimed yet.

## Phase 4: Implement backend feature — thermal representation and registration

**Goal:** Add the next processing capability in the backend without changing the frontend workflow unnecessarily.

**Processing-engine work:**

- Preserve the calibrated thermal matrix through all transformations.
- Implement edge/contour extraction using OpenCV.
- Implement the first real geometric registration method.
- Produce an explicit transform, alignment quality, and registration failure result.
- Warp the thermal data into RGB coordinates without converting temperatures into analysis values.
- Add aligned thermal output as a distinct artifact.

**API work:**

- Extend response schemas with transform metadata, registration quality, and alignment warnings.
- Return explicit errors when registration is not reliable.

**Tests:**

- Test successful registration with deterministic fixtures.
- Test low-confidence registration.
- Test that raw temperature values are preserved after warping.

**Working result:** The backend independently performs and reports real multimodal registration. The existing overlay integration remains working.

## Phase 5: Integrate registration into the frontend

**Goal:** Expose the new backend registration feature in the existing application.

**Frontend work:**

- Add aligned thermal and registration-overlay views.
- Display transform quality and warnings.
- Prevent the UI from presenting low-confidence data as reliable alignment.
- Keep the upload and existing overlay flow unchanged for valid inputs.

**Working result:** The integrated app shows the RGB image, thermal input, explicit registration overlay, and registration quality.

## Phase 6: Implement backend feature — adaptive region analysis

**Goal:** Add the comparison logic for different anatomy types in the backend.

**Processing-engine work:**

- Add explicit bilateral, midline, and normative strategies.
- Implement bilateral ΔT comparison for paired anatomy.
- Implement internal midline comparison for suitable singular structures.
- Implement normative baseline comparison for localized asymmetric regions.
- Generate a real anomaly mask and structured explanation.
- Keep thresholds and baseline ranges configurable and included in results.

**API work:**

- Add strategy-specific configuration validation.
- Return comparison method, baseline details, ΔT data, anomaly mask, and warnings.

**Tests:**

- Test all three analysis branches independently.
- Test invalid strategy-specific configurations.
- Test that singular anatomy is not forced through bilateral comparison.

**Working result:** The backend independently produces a strategy-appropriate anomaly analysis instead of fixed mock metrics.

## Phase 7: Integrate adaptive analysis into the frontend

**Goal:** Replace frontend mock analysis with backend-generated comparison results.

**Frontend work:**

- Send the selected strategy and thresholds to the backend.
- Display the returned anomaly mask and comparison explanation.
- Display maximum temperature, maximum ΔT, and baseline details from the API.
- Render backend warnings and configuration values.
- Remove or disable conflicting frontend-only mock calculations.

**Working result:** The integrated app performs real strategy selection and anomaly comparison through the backend.

## Phase 8: Implement backend feature — isotherms and depth estimation

**Goal:** Add explainable thermal-shape analysis after anomaly detection is working.

**Processing-engine work:**

- Identify the thermal epicenter.
- Generate isotherm contours around the anomaly.
- Calculate the temperature falloff gradient.
- Apply configurable heuristic rules for superficial versus deep/diffuse patterns.
- Return the epicenter, isotherms, gradient, and classification as intermediate artifacts and metrics.
- Describe the result as a triage/monitoring heuristic, not a diagnosis.

**API work:**

- Extend schemas and artifact retrieval for isotherms and depth metrics.
- Preserve all intermediate artifacts for inspection.

**Tests:**

- Test epicenter selection.
- Test contour generation.
- Test steep and gradual gradient classifications.
- Test edge cases with no detected anomaly.

**Working result:** The backend independently produces the complete explainable analysis output except reporting.

## Phase 9: Integrate isotherms and depth estimation into the frontend

**Goal:** Make the complete analysis understandable in the dashboard.

**Frontend work:**

- Add isotherm and epicenter views.
- Display gradient and estimated depth pattern.
- Explain the selected comparison method and classification inputs.
- Show all intermediate artifacts as selectable views.
- Keep the clinical limitation visible near the result.

**Working result:** The integrated dashboard presents the full explainable analysis pipeline from input through depth heuristic.

## Phase 10: Implement backend feature — report generation

**Goal:** Add a printable report as a backend capability.

**Backend work:**

- Generate a PDF with ReportLab.
- Include source metadata, configuration, transform quality, comparison method, metrics, visual artifacts, warnings, and limitations.
- Expose a report-download endpoint.
- Keep report generation independent from route handlers.

**Tests:**

- Test PDF creation with deterministic fixtures.
- Test that warnings, configuration, metrics, and limitations appear in the report.

**Working result:** The backend independently creates a complete explainable clinical-style prototype report.

## Phase 11: Integrate reporting and finalize the MVP

**Goal:** Complete the end-to-end product demonstration.

**Frontend work:**

- Add a report download action.
- Show report-generation and download errors clearly.
- Verify that the report uses the same result shown in the dashboard.
- Polish responsive layout and accessibility.

**Validation:**

- Test malformed CSVs, unsupported files, missing calibration, and mismatched dimensions.
- Test registration failure and no-anomaly cases.
- Run backend tests, frontend lint, type-check, and production build.
- Prepare deterministic fixtures for bilateral, midline, and normative examples.
- Confirm that no feature presents heuristic output as a definitive diagnosis.

**Working result:** The MVP provides an end-to-end, CPU-bound, explainable workflow with independently testable backend features and incremental frontend integration.

## MVP boundary

The MVP includes the independent frontend and backend foundations, one overlay slice, real registration, adaptive region analysis, isotherms, heuristic depth estimation, dashboard integration, and PDF export.

It intentionally excludes AR projection, dynamic ambient calibration, temporal analysis, heavy model training, and definitive diagnostic claims.
