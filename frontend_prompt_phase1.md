# Phase 1 Frontend Implementation Prompt

## Context

Build Phase 1 of the Multimodal Bioheat Tracker: a standalone React frontend prototype for the documented MVP.

The application is an explainable triage and monitoring dashboard. A clinician uploads an RGB image and a thermal image or thermal matrix, selects the anatomy comparison strategy, and reviews a mocked analysis result. The frontend must look and behave like the eventual product, but it must not connect to a backend or perform real thermal analysis in this phase.

The frontend should follow the repository strategy and must not add AR projection, dynamic ambient calibration, temporal analysis, heavy machine learning, or definitive diagnostic language.

## Objective

Create a polished single-page React and TypeScript dashboard that demonstrates the complete user workflow using local mock data:

1. Select an RGB image.
2. Select a thermal image or CSV file.
3. Preview both selected files.
4. Choose the anatomy analysis strategy.
5. Configure the relevant threshold.
6. Click **Analyze**.
7. Display a mocked analysis dashboard with visual layers, metrics, explanation, and limitations.

The frontend must be fully usable without a running API or Python service.

## Required technology

- React
- TypeScript
- Vite
- Plain CSS or the repository's existing CSS approach
- Browser File APIs for local file selection and preview

Do not add a backend, database, authentication, charting library, state-management framework, or UI component library unless the repository already contains one.

## Main screen

Create a clean clinical-style dashboard with the following areas:

### 1. Header

Include:

- Product name: **Multimodal Bioheat Tracker**
- Short subtitle: **Explainable thermal triage and monitoring assistance**
- A visible badge such as **Prototype / Phase 1**

Avoid wording that claims diagnosis or medical certainty.

### 2. Upload section

Provide two clearly separated upload cards:

- **RGB optical image**
  - Accept JPEG and PNG files.
  - Show the selected filename.
  - Show a local image preview.
  - Show a useful validation error for unsupported files.
- **Thermal data**
  - Accept CSV, JPEG, and PNG files.
  - Show the selected filename.
  - Show an image preview for image files.
  - For CSV files, show a simple thermal-matrix placeholder preview and filename. Do not parse or analyze the CSV yet.
  - Show a useful validation error for unsupported files.

Use `URL.createObjectURL` or an equivalent browser-safe approach for previews and revoke object URLs when they are no longer needed.

### 3. Analysis configuration

Provide controls for:

- Anatomy strategy:
  - **Bilateral comparison**
  - **Internal midline symmetry**
  - **Normative baseline**
- Anatomy/body region:
  - Limb / joint
  - Hand or foot
  - Spine / torso
  - Localized asymmetric region
- ΔT threshold in °C, shown for bilateral and midline strategies.
- Baseline minimum and maximum temperature, shown for normative-baseline strategy.

The controls should change based on the selected strategy. Keep the values visible and editable. Use sensible demo defaults, but do not hide configuration in code or present unexplained magic numbers.

### 4. Analyze action

Include a prominent **Analyze prototype data** button.

Behavior:

- Disable the button until both files are selected.
- If clicked without valid files, show an inline validation message.
- On click, show a short simulated processing state such as:
  - Upload validated
  - Registration preview prepared
  - Mock analysis complete
- After the simulated processing state, render deterministic mock results.
- Do not make network requests.

## Mock analysis dashboard

After analysis, display:

### Visual analysis panel

Provide tabs or buttons to switch between these mocked views:

- RGB source image
- Thermal preview
- Registration overlay
- Anomaly mask
- Isotherm map
- Final overlay

The registration overlay and final overlay can use CSS layers over the RGB image. They should visibly communicate that the thermal layer is aligned to the RGB image. Use a simple, deterministic hotspot graphic if no thermal image is available.

Make the selected view obvious. Include a small legend explaining:

- Cooler/normal region
- Elevated temperature
- Flagged region

### Metrics panel

Display mock values for:

- Maximum temperature: `37.8 °C`
- Maximum ΔT: `+1.6 °C`
- Epicenter: `x 62%, y 44%`
- Thermal gradient: `0.42 °C/cm`
- Estimated pattern: `Deep / diffuse`
- Analysis strategy: the currently selected strategy

Label the values as prototype/demo output. Do not describe the estimated pattern as a confirmed disease or diagnosis.

### Explanation panel

Show a plain-language explanation that changes with the selected strategy:

- Bilateral: the flagged region is hotter than the corresponding reference side by more than the configured ΔT threshold.
- Midline: the flagged region differs from the corresponding internal side of the same structure.
- Normative baseline: the localized temperature falls outside the configured body-region baseline.

Also show a short methodology summary:

- RGB and thermal inputs are represented together.
- The result is based on a configurable comparison strategy.
- Isotherms and gradient are explanatory visualizations.
- Phase 1 uses mocked values only.

### Disclaimer

Keep a visible disclaimer near the result:

> Prototype output for triage and monitoring assistance only. It is not a diagnosis and must be interpreted by a qualified clinician.

## Empty, loading, and error states

Implement clear states for:

- No files selected.
- Only one file selected.
- Unsupported file type.
- Invalid configuration values.
- Processing in progress.
- Analysis completed.

Do not silently fall back to a successful-looking result when input validation fails.

## Accessibility and UX

- Use semantic headings and labels.
- Every file input and control must have an accessible label.
- Buttons must have visible hover, focus, and disabled states.
- Ensure sufficient color contrast.
- Do not use color as the only way to communicate a flagged region; pair it with labels or patterns.
- Keep the dashboard usable on a laptop-sized screen and reasonably responsive on a smaller viewport.

## Component structure

Prefer small components with clear responsibilities, for example:

- `App`
- `Header`
- `UploadCard`
- `AnalysisConfiguration`
- `AnalyzeButton`
- `ProcessingStatus`
- `AnalysisViewer`
- `MetricCard`
- `ExplanationPanel`
- `Disclaimer`

Keep mock data separate from UI components. Define types for:

- Upload state
- Analysis strategy
- Configuration
- Processing state
- Mock analysis result
- Visualization layer

## Out of scope for Phase 1

Do not implement:

- FastAPI or any backend endpoint.
- Real image registration.
- OpenCV, NumPy, SciPy, or thermal calculations.
- Real CSV parsing or radiometric JPEG extraction.
- Real anomaly detection or depth estimation.
- PDF generation.
- Patient accounts or persistent storage.
- AR projection.
- Dynamic ambient calibration.
- Temporal analysis.
- Authentication or EHR integration.

## Acceptance criteria

The phase is complete when:

1. The app starts locally using the repository's frontend command.
2. The upload screen accepts and previews valid RGB and thermal files.
3. Invalid file types and incomplete input produce visible errors.
4. The anatomy strategy changes the relevant configuration controls and explanation.
5. The analyze button shows a simulated processing state and then deterministic mock results.
6. The result view includes all required visualization layers, metrics, explanation, and disclaimer.
7. No backend or network request is required.
8. The implementation uses typed React state and does not contain unexplained hard-coded UI behavior.
9. The layout is accessible and usable on a laptop viewport.
10. The frontend lint and type-check commands pass once configured in the project.
