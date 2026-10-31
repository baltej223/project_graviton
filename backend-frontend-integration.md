# Backend–Frontend Integration Handoff

## Purpose

Integrate the Phase 1 React frontend with the FastAPI backend in `backend/`.

The backend currently returns deterministic prototype results. This integration should replace frontend-only mock analysis calls with real HTTP calls while preserving the existing dashboard workflow and visual design.

The backend and processing engine remain separate:

- **Frontend:** upload controls, configuration UI, progress states, visualization, metrics, and user-facing errors.
- **API layer:** HTTP transport, multipart handling, request validation, and response serialization.
- **Processing engine:** ingestion, overlay descriptors, and deterministic mock analysis.

Do not move processing logic into the frontend.

## Backend startup

From the repository root:

```bash
cd backend
uvicorn app.main:app --reload
```

The API is available at:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

## Frontend configuration

Use an environment variable for the API base URL:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Do not hard-code the backend URL throughout components. Centralize it in an API client module.

If the frontend dev server runs on another origin, the backend may need CORS configuration for the frontend origin. Keep CORS configuration limited to local development origins and do not use unrestricted production settings.

## API endpoints

### Health check

```http
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "bioheat-tracker",
  "phase": "phase-1"
}
```

Use this only for an optional connection indicator or development troubleshooting. Do not block the upload screen solely because the health check has not run.

### Configuration options

```http
GET /api/v1/configuration-options
```

Expected response:

```json
{
  "strategies": [
    {
      "value": "bilateral",
      "label": "Bilateral comparison",
      "description": "Compare corresponding regions on paired anatomy."
    },
    {
      "value": "midline",
      "label": "Internal midline symmetry",
      "description": "Compare corresponding sides within one structure."
    },
    {
      "value": "normative",
      "label": "Normative baseline",
      "description": "Compare a localized region with a configured baseline range."
    }
  ],
  "body_regions": [
    "limb_joint",
    "hand_foot",
    "spine_torso",
    "localized_asymmetric_region"
  ],
  "defaults": {
    "delta_t_threshold_celsius": 1.2,
    "baseline_min_celsius": 30.0,
    "baseline_max_celsius": 35.0
  }
}
```

Load this data when the configuration screen initializes. Use the response values for labels and defaults rather than duplicating backend option definitions in multiple components.

### Upload validation

```http
POST /api/v1/validate-upload
Content-Type: multipart/form-data
```

Multipart fields:

- `rgb_file`: JPEG or PNG.
- `thermal_file`: CSV, JPEG, or PNG.
- `thermal_unit`: send `celsius` for CSV thermal matrices.

Example:

```ts
const formData = new FormData();
formData.append("rgb_file", rgbFile);
formData.append("thermal_file", thermalFile);
formData.append("thermal_unit", "celsius");

const response = await fetch(`${API_BASE_URL}/api/v1/validate-upload`, {
  method: "POST",
  body: formData,
});
```

Do not manually set the `Content-Type` header when sending `FormData`; the browser must add the multipart boundary.

Expected response shape:

```json
{
  "valid": true,
  "rgb": {
    "filename": "rgb.png",
    "media_type": "image/png",
    "file_size_bytes": 12345,
    "width": 1200,
    "height": 900,
    "format": "PNG",
    "calibration_status": null
  },
  "thermal": {
    "filename": "thermal.csv",
    "media_type": "text/csv",
    "file_size_bytes": 6789,
    "rows": 32,
    "columns": 48,
    "temperature_unit": "celsius",
    "calibration_status": "calibrated"
  },
  "warnings": []
}
```

Use this endpoint before analysis if the UI should show a distinct validation step. The analyze endpoint also validates uploads, so the frontend must not assume validation succeeded merely because this endpoint was called.

### Analysis

```http
POST /api/v1/analyze
Content-Type: multipart/form-data
```

Multipart fields:

- `rgb_file`: JPEG or PNG.
- `thermal_file`: CSV, JPEG, or PNG.
- `thermal_unit`: `celsius` for CSV input.
- `configuration`: JSON string.

Configuration JSON for bilateral or midline analysis:

```json
{
  "strategy": "bilateral",
  "body_region": "limb_joint",
  "delta_t_threshold_celsius": 1.2
}
```

Configuration JSON for normative analysis:

```json
{
  "strategy": "normative",
  "body_region": "localized_asymmetric_region",
  "baseline_min_celsius": 30.0,
  "baseline_max_celsius": 35.0
}
```

Example:

```ts
const formData = new FormData();
formData.append("rgb_file", rgbFile);
formData.append("thermal_file", thermalFile);
formData.append("thermal_unit", thermalFile.name.toLowerCase().endsWith(".csv") ? "celsius" : "");
formData.append("configuration", JSON.stringify(configuration));

const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
  method: "POST",
  body: formData,
});
```

Expected response shape:

```json
{
  "status": "mock_complete",
  "prototype_output": true,
  "configuration": {
    "strategy": "bilateral",
    "body_region": "limb_joint",
    "delta_t_threshold_celsius": 1.2,
    "baseline_min_celsius": null,
    "baseline_max_celsius": null
  },
  "metrics": {
    "maximum_temperature_celsius": 37.8,
    "maximum_delta_t_celsius": 1.6,
    "epicenter_x": 0.62,
    "epicenter_y": 0.44,
    "thermal_gradient_celsius_per_cm": 0.42,
    "estimated_pattern": "deep_diffuse"
  },
  "artifacts": [
    {
      "name": "rgb_source",
      "source": "rgb",
      "mocked": false,
      "description": "Uploaded RGB source image."
    },
    {
      "name": "thermal_preview",
      "source": "thermal",
      "mocked": true,
      "description": "Thermal visualization preview; calibration processing is mocked."
    }
  ],
  "explanation": "The prototype compares the selected region with a corresponding reference side using the configured ΔT threshold of 1.2 °C.",
  "warnings": [
    "Registration and all analysis metrics are deterministic mock values in Phase 1.",
    "This output is not a diagnosis."
  ],
  "limitation": "Prototype output for triage and monitoring assistance only. It is not a diagnosis and must be interpreted by a qualified clinician.",
  "uploads": {}
}
```

The actual `uploads` object contains the same metadata structure returned by `/validate-upload`.

## Recommended frontend API module

Create one typed module such as:

```text
src/api/client.ts
src/api/types.ts
```

The client should provide functions similar to:

```ts
getConfigurationOptions(): Promise<ConfigurationOptions>;
validateUploads(input: UploadRequest): Promise<UploadValidation>;
analyze(input: AnalyzeRequest): Promise<AnalysisResult>;
```

Keep `fetch` calls out of presentational components. Components should call typed client functions and render loading, success, and error states.

Define TypeScript types for:

- `AnalysisStrategy`
- `AnalysisConfiguration`
- `ConfigurationOptions`
- `UploadValidation`
- `ImageMetadata`
- `ThermalMetadata`
- `ArtifactDescriptor`
- `AnalysisMetrics`
- `AnalysisResult`
- `ApiError`

Use the backend field names in the API types, or add an explicit conversion layer. Do not silently rename fields in a way that makes future backend integration ambiguous.

## Frontend state flow

Implement this state flow:

1. **Initial state**
   - Load configuration options.
   - Show upload controls.
   - Show no-result empty state.
2. **Files selected**
   - Create local previews with `URL.createObjectURL`.
   - Keep file objects in component or feature state.
   - Revoke object URLs when replaced or unmounted.
3. **Validation**
   - Submit files to `/validate-upload`, or rely on `/analyze` validation if the design uses one action.
   - Display backend warnings without treating warnings as failures.
4. **Analyzing**
   - Disable the analyze button.
   - Show progress text such as “Validating upload” and “Preparing prototype analysis”.
   - Do not claim real registration or calculation is occurring.
5. **Completed**
   - Render metrics from `result.metrics`.
   - Render the selected analysis strategy and configuration from `result.configuration`.
   - Render explanation, warnings, and limitation.
   - Use `result.artifacts` to populate layer labels and mocked status.
6. **Failed**
   - Preserve selected files and configuration.
   - Display a useful error near the relevant form or result area.
   - Allow retry without a full page reload.

## Visualization integration

The backend currently returns artifact descriptors, not binary overlay images. Continue using the frontend's local image previews and deterministic CSS/mock visualization layers for Phase 1.

For each artifact:

- `rgb_source`: show the uploaded RGB preview.
- `thermal_preview`: show the uploaded thermal image preview, or the CSV placeholder.
- `registration_overlay`: show the RGB preview with the existing mocked thermal layer.
- `anomaly_mask`: show the existing mocked flagged-region layer.
- `isotherm_map`: show the existing mocked contour layer.
- `final_overlay`: show the existing combined mock overlay.

Use `artifact.mocked` to show a subtle “Mocked” label. Do not imply that a real registration transform or calculated anomaly mask was returned.

When real binary artifacts are introduced in a later phase, update the API client and viewer behind the same artifact abstraction rather than changing every dashboard component.

## Error handling

Expected backend validation errors use this shape:

```json
{
  "detail": {
    "code": "invalid_input",
    "message": "thermal_unit must explicitly identify Celsius for CSV input",
    "field": "thermal_unit"
  }
}
```

Handle at least:

- `422`: invalid files or configuration.
- `413`: file too large, if a size limit is later added.
- `5xx`: unexpected backend failure.
- Network failure: backend unavailable or unreachable.

Recommended user-facing behavior:

- `invalid_input`: show the message beside the relevant upload or configuration field.
- `unsupported_format`: explain accepted formats.
- `invalid_configuration`: keep the form values and show the configuration error.
- Network failure: say the backend could not be reached and provide the local backend command.
- Unexpected failure: show a generic error without hiding the failure in a successful result.

Do not display raw stack traces to users.

## Important constraints

- Do not calculate ΔT, gradients, registration, or depth in TypeScript.
- Do not parse thermal CSV values in the frontend for analysis.
- Do not send display-scaled pixel values as if they were temperatures.
- Do not add a second duplicate API client inside a component.
- Do not make the frontend depend on backend implementation paths; use HTTP contracts only.
- Preserve the triage/monitoring disclaimer.
- Keep AR, dynamic ambient calibration, temporal analysis, heavy ML, PDF generation, and EHR integration out of this integration task.

## Acceptance criteria

The integration is complete when:

1. The frontend obtains configuration options from the backend.
2. RGB and thermal files are sent as multipart form data.
3. CSV thermal uploads include explicit Celsius units.
4. Configuration is sent as the documented JSON string.
5. The frontend renders backend metrics, strategy, explanation, warnings, and limitation.
6. Existing local previews and mocked visualization layers remain functional.
7. Loading, validation, network, and backend errors are visible and recoverable.
8. No image or thermal calculations are implemented in the frontend.
9. No fetch calls are scattered through presentation components.
10. The frontend works against the local FastAPI server without requiring changes to backend engine code.
11. Existing frontend lint, type-check, and build commands pass.
