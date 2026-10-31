# Phase 1 Backend Implementation Prompt

## Context

Build the backend foundation for Phase 1 of the Multimodal Bioheat Tracker.

The backend will eventually provide a Python processing pipeline for RGB images and calibrated thermal data. In this phase, do not implement real image registration, thermal analysis, anomaly detection, depth estimation, or PDF generation. Instead, establish a clean, independently testable Python service with validated contracts and deterministic mock analysis output that the frontend can connect to later.

The backend must preserve the documented MVP scope:

- Lightweight and CPU-bound.
- Explainable and deterministic.
- Suitable for triage and monitoring assistance only.
- No AR projection.
- No dynamic ambient calibration.
- No temporal analysis.
- No heavy model training.
- No definitive diagnostic claims.

## Objective

Create a Python backend composed of two logically separated systems:

1. **API/application system**: Handles HTTP requests, uploads, validation responses, configuration, orchestration, and serialization.
2. **Processing engine**: Handles ingestion, overlay preparation, and all future calculations. It must be independently importable and testable without FastAPI.

The API may call the processing engine through typed service functions, but the engine must not import FastAPI, Uvicorn, request objects, or HTTP response classes. The engine should later be reusable by a CLI, batch job, or notebook.

The combined backend must:

1. Accept an RGB image and thermal file upload.
2. Validates file types and basic metadata.
3. Parses RGB image metadata and thermal CSV dimensions.
4. Preserves raw thermal values separately from visualization values.
5. Validates an analysis configuration.
6. Returns deterministic mock analysis results.
7. Exposes typed API contracts that can later support the real five-phase pipeline.
8. Runs independently from the React frontend.

The backend must not make external network requests.

## Required separation of responsibilities

### System A: API/application layer

This system owns:

- FastAPI setup and route registration.
- Multipart upload handling.
- API request and response models.
- Request validation and conversion into engine inputs.
- Calling the processing engine.
- Mapping domain errors to HTTP errors.
- Serializing engine outputs into JSON-safe responses.
- API-only concerns such as status codes, CORS, and OpenAPI metadata.

The API layer must not contain NumPy calculations, CSV parsing algorithms, image overlay logic, or anatomy comparison logic.

### System B: processing and analysis engine

This system owns:

- RGB validation and metadata extraction.
- Thermal CSV parsing and matrix validation.
- Thermal image validation and calibration-status tracking.
- Internal RGB and thermal data models.
- Overlay preparation and visualization-layer descriptions.
- Future OpenCV registration.
- Future ΔT, anomaly-mask, isotherm, gradient, and depth calculations.
- Deterministic mock analysis for Phase 1.

The engine must:

- Accept plain Python values, typed engine models, bytes, file-like objects, or paths.
- Return typed engine results rather than HTTP response objects.
- Raise domain-specific errors such as `InvalidInputError` or `UnsupportedFormatError`.
- Keep raw calibrated temperatures separate from display-scaled visualization data.
- Be testable directly with pytest without starting an HTTP server.

## Required technology

- Python
- FastAPI
- Pydantic
- Uvicorn
- `python-multipart` for multipart uploads
- Pillow for basic RGB image metadata validation
- NumPy for thermal matrix representation
- pytest for tests

Use the repository's existing Python configuration if one exists. If no backend configuration exists, create a minimal backend project structure and dependency manifest without adding unrelated tooling.

## Suggested project structure

Use a modular structure similar to:

```text
backend/
  app/
    api/
      __init__.py
      main.py
      routes.py
      dependencies.py
    api_schemas/
      __init__.py
      requests.py
      responses.py
    engine/
      __init__.py
      models.py
      ingestion.py
      overlays.py
      analysis.py
      mock_analysis.py
      errors.py
    application/
      __init__.py
      services.py
    main.py
  tests/
    api/
      test_health.py
      test_routes.py
    engine/
      test_ingestion.py
      test_overlays.py
      test_analysis.py
      test_mock_analysis.py
  pyproject.toml
```

Adapt the structure if the repository already has an established convention. Keep API-facing Pydantic models separate from engine-facing domain models where their responsibilities differ. `application/services.py` may orchestrate conversion and engine calls, but it must not duplicate engine algorithms.

## Data contracts

Define typed Pydantic models for the following concepts.

### Analysis strategy

Use an explicit enum or equivalent constrained type:

- `bilateral`
- `midline`
- `normative`

Do not silently choose bilateral comparison when another strategy is selected.

### Analysis configuration

Include:

- Anatomy strategy.
- Body region.
- ΔT threshold in °C for bilateral and midline strategies.
- Baseline minimum and maximum temperature for normative strategy.

Validation rules:

- Thresholds must be finite and positive where applicable.
- Normative minimum must be lower than normative maximum.
- Bilateral and midline strategies require a ΔT threshold.
- Normative strategy requires a baseline range.
- Invalid configurations must produce explicit validation errors.

Keep configuration values visible in the response so results are reproducible.

### Upload metadata

Return metadata for both inputs:

- Original filename.
- Detected media or data type.
- File size.
- Width and height for raster images where available.
- Row and column count for thermal CSV input.
- Temperature unit, which must be explicit for CSV data.

Do not claim a thermal image contains calibrated temperatures unless the input adapter can verify that.

### Analysis result

Define a stable response model containing:

- Processing status.
- Analysis strategy.
- Body region.
- Configuration used.
- Mock metrics:
  - Maximum temperature.
  - Maximum ΔT.
  - Epicenter coordinates.
  - Thermal gradient.
  - Estimated pattern.
- Intermediate artifact descriptors:
  - RGB source.
  - Thermal preview.
  - Registration overlay.
  - Anomaly mask.
  - Isotherm map.
  - Final overlay.
- Plain-language explanation.
- Warnings.
- A triage/monitoring limitation statement.

Mark mock values clearly as prototype output.

## API endpoints

### `GET /health`

Return a small JSON response confirming that the service is running, for example:

```json
{
  "status": "ok",
  "service": "bioheat-tracker",
  "phase": "phase-1"
}
```

### `POST /api/v1/validate-upload`

Accept multipart form data containing:

- `rgb_file`
- `thermal_file`

Validate:

- RGB extension and image readability.
- Thermal extension.
- CSV readability and rectangular numeric values when the thermal input is CSV.
- Explicit Celsius temperature units for CSV input, using the agreed Phase 1 convention.
- Non-empty files.
- Reasonable dimensions and matrix shape.

Return typed upload metadata and validation warnings.

Do not perform registration or analysis in this endpoint.

### `POST /api/v1/analyze`

Accept the same two files plus the analysis configuration.

Behavior:

1. Convert HTTP upload objects into engine inputs.
2. Ask the processing engine to validate both files.
3. Validate or convert the analysis configuration.
4. Ask the processing engine for deterministic mock analysis output.
5. Convert the engine result into the API response model.

Do not make network calls, invoke OpenCV, perform real registration, or calculate real ΔT values in Phase 1.

The response must make it clear that:

- The registration is mocked.
- The metrics are mocked.
- The result is not a diagnosis.

### `GET /api/v1/configuration-options`

Return the supported strategies, body regions, default thresholds, and explanatory labels. This allows the frontend to avoid duplicating backend-supported option definitions later.

## Processing-engine behavior

All behavior in the following sections belongs to System B, not to FastAPI route functions.

## Ingestion behavior

### RGB files

- Accept JPEG and PNG.
- Verify that the file can be opened as an image.
- Read width, height, and format using Pillow.
- Reject corrupted or empty files with a useful client error.
- Do not permanently store uploaded files in Phase 1.

### Thermal CSV files

- Parse a rectangular matrix of numeric values.
- Reject blank rows, inconsistent column counts, non-numeric cells, and empty matrices.
- Keep values as floating-point temperatures in their original units.
- Do not convert the matrix to 0–255 for calculations.
- Return only safe metadata and summary information, not an unbounded raw matrix in the API response.

### Thermal image files

- Accept JPEG and PNG as upload formats.
- Validate that the file is a readable raster image.
- Clearly mark its calibration status as `unverified` unless a known radiometric adapter is implemented.
- Do not interpret ordinary color pixels as Celsius temperatures.

## Mock analysis behavior

Use deterministic values for identical inputs and configuration. The mock result may use:

- Maximum temperature: `37.8 °C`
- Maximum ΔT: `+1.6 °C`
- Epicenter: `x 0.62`, `y 0.44`
- Thermal gradient: `0.42 °C/cm`
- Estimated pattern: `deep_diffuse`

The strategy-specific explanation must be generated from the selected strategy:

- Bilateral: comparison against a corresponding reference side.
- Midline: comparison against the corresponding internal side.
- Normative: comparison against the configured localized baseline.

Keep the mock implementation isolated in the processing engine so it can later be replaced by real ingestion, registration, adaptive analysis, and depth-estimation services. The API should not need to change when the engine switches from mock output to real calculations.

## Overlay behavior

Create an explicit `overlays.py` module in the processing engine.

For Phase 1 it should:

- Represent visualization layers as typed descriptors.
- Identify the source image for each layer.
- Record whether a layer is mocked.
- Optionally generate simple deterministic preview images without claiming they are real registration results.
- Keep overlay composition out of API routes and frontend-specific code.

Later phases will replace these mock descriptors with real aligned thermal data, anomaly masks, isotherms, and final RGB overlays.

## Error handling

Implement explicit errors for:

- Missing files.
- Empty files.
- Unsupported extensions.
- Corrupt RGB images.
- Invalid thermal CSV shape.
- Non-numeric thermal values.
- Missing or invalid temperature units.
- Invalid analysis strategy.
- Invalid thresholds or baseline ranges.

Return consistent JSON error responses with:

- Error code.
- Human-readable message.
- Field or file name when relevant.

Do not catch broad exceptions and convert them into successful-looking mock results. Unexpected errors should remain visible to the server logs and produce an appropriate server error response.

## Testing requirements

Add focused pytest coverage for both systems independently.

### Processing-engine tests

1. Health endpoint success.
2. Valid RGB image metadata extraction.
3. Valid rectangular thermal CSV parsing.
4. Rejection of malformed or non-numeric CSV data.
5. Rejection of unsupported and empty files.
6. Rejection of invalid configuration values.
7. Successful mock analysis for bilateral strategy.
8. Successful mock analysis for midline strategy.
9. Successful mock analysis for normative strategy.
10. Deterministic mock output for the same request.
11. Presence of warnings and the triage limitation in the analysis response.
12. Confirmation that raw thermal values are not replaced by display-scaled values during ingestion.
13. Overlay descriptors are produced without importing FastAPI.
14. Mock analysis can be called directly as a Python function without an HTTP server.
15. Domain-specific engine errors are raised for invalid inputs.

### API-layer tests

Add focused coverage for:

1. Health endpoint success.
2. Multipart files are converted and delegated to the engine.
3. Engine validation errors become consistent HTTP errors.
4. Engine results are serialized into the documented API response.
5. Routes contain orchestration only and no overlay or calculation algorithms.

Use in-memory file objects or temporary test files. Do not require external datasets, network access, or a running frontend.

## Out of scope for Phase 1

Do not implement:

- Real OpenCV registration.
- ORB, SIFT, homography, or image warping.
- Real ΔT or anomaly-mask calculations.
- Isotherm generation.
- Thermal gradient calculation.
- Pennes bioheat modeling.
- Depth estimation from real data.
- PNG artifact generation.
- PDF reports.
- Persistent patient or scan storage.
- Authentication or authorization.
- Database integration.
- Background job queues.
- EHR integration.
- AR projection.
- Dynamic ambient calibration.
- Temporal analysis.
- Frontend implementation.

## Acceptance criteria

The phase is complete when:

1. The backend starts locally with Uvicorn using the repository's documented command.
2. `GET /health` responds successfully.
3. Valid RGB and thermal files are accepted and described by typed metadata.
4. Invalid files and configurations return explicit, useful errors.
5. `POST /api/v1/analyze` returns deterministic, clearly labeled mock results.
6. Bilateral, midline, and normative strategies are represented explicitly.
7. Raw thermal values remain distinct from visualization scaling.
8. No endpoint performs real analysis or makes network requests.
9. Processing-engine tests pass without starting FastAPI.
10. API-layer tests pass against the engine boundary.
11. API routes contain orchestration only and no overlay or calculation algorithms.
12. The API contracts are ready for Phase 2 ingestion and preprocessing without requiring a breaking redesign.
