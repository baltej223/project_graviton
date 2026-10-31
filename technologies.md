# Multimodal Bioheat Tracker: Technologies

## Product shape

The MVP is a lightweight, explainable analysis tool for triage and monitoring assistance. It combines a high-resolution RGB image with a calibrated thermal image or temperature matrix, then produces an inspectable alignment, anomaly analysis, visual overlay, and PDF report.

The system should run on ordinary CPU hardware and should prefer deterministic computer vision and numerical methods over a trained diagnostic model.

## Frontend

- **React**: Single-page dashboard and user workflow.
- **TypeScript**: Type-safe UI state, API contracts, metrics, and analysis results.
- **Vite**: Lightweight development server and production bundling.
- **CSS**: Responsive layout for the upload screen, analysis dashboard, image comparison, metric cards, and report controls.
- **Browser File APIs**: Local preview and upload of RGB and thermal files.

The frontend is responsible for:

- Uploading and previewing the RGB and thermal inputs.
- Selecting the anatomy strategy: bilateral, midline-symmetric, or normative baseline.
- Showing processing progress and validation errors.
- Displaying the RGB image, aligned thermal data, anomaly mask, isotherms, and transparent final overlay.
- Presenting the configured thresholds and calculated metrics.
- Downloading the generated PDF report.

## Backend and API

- **Python**: Processing pipeline and HTTP service.
- **FastAPI**: Typed API endpoints, request validation, file uploads, and local API documentation.
- **Pydantic**: Configuration and analysis-result schemas shared by the API layer.
- **Uvicorn**: Local ASGI server for the FastAPI application.
- **python-multipart**: Multipart form-data file uploads.

The backend should expose modular endpoints or service functions for ingestion, registration, analysis, visualization, and report generation rather than placing all work in one request handler.

## Image processing and numerical analysis

- **OpenCV (`opencv-python`)**:
  - Grayscale conversion and normalization.
  - Canny/Sobel edge extraction.
  - Contours and bounding boxes.
  - ORB or SIFT feature matching where the input images provide usable features.
  - Homography or an explicitly reported geometric transform.
  - Image warping and overlay preparation.
- **NumPy**:
  - Temperature matrices and masks.
  - Pixel-wise temperature differences.
  - Gradient and statistical calculations.
  - Deterministic synthetic test data.
- **SciPy**:
  - Numerical gradients and smoothing.
  - Connected-component or distance-based analysis where useful.
  - Contour/isotherm support and numerical utilities.
- **Pillow**:
  - Reliable loading and encoding of common raster image formats.
  - Image conversion for report and API output where OpenCV is not appropriate.

Raw calibrated temperatures must remain separate from any temporary 0–255 visualization representation. Temperature calculations must use the original values.

## Thermal input formats

- **CSV**: First MVP format for a temperature matrix, with explicit units and metadata.
- **Radiometric JPEG**: Supported through a dedicated adapter only when the camera format and extraction method are known.
- **JPEG/PNG**: Standard RGB input.

The ingestion layer should normalize these formats into typed internal objects containing dimensions, units, calibration metadata, and the original temperature matrix.

## Analysis logic

- Configurable thresholds and baseline ranges stored in a typed configuration object.
- Explicit anatomy strategies:
  - Bilateral comparison for limbs, hands, feet, and other paired structures.
  - Internal midline comparison for singular structures with meaningful symmetry.
  - Normative localized baseline comparison when bilateral or midline comparison is not appropriate.
- Explainable temperature subtraction and anomaly-mask generation.
- Isotherm contours around the thermal epicenter.
- Thermal falloff gradient and a simplified superficial/deep classification.

The depth result is a heuristic approximation for triage and monitoring. It must not be presented as a definitive diagnosis or as a full Pennes bioheat solver.

## Reporting and artifacts

- **ReportLab**: Generate a printable PDF containing the source image, aligned thermal visualization, final overlay, metrics, thresholds, analysis strategy, and limitations.
- **JSON**: Return structured analysis results and configuration for the dashboard and reproducibility.
- **PNG**: Export inspectable intermediate artifacts such as the aligned thermal image, anomaly mask, isotherm image, and final overlay.

## Development and quality tools

- **pytest**: Unit and integration tests for ingestion, registration, analysis branches, and report generation.
- **Ruff**: Python linting and formatting.
- **mypy**: Optional static type checking for the Python pipeline.
- **ESLint**: TypeScript/React linting.
- **Prettier**: Frontend formatting.
- **GitHub Actions**: Run frontend and backend checks once project configuration exists.

No dependency or build command is assumed yet. These tools should be introduced with the corresponding application manifests and documented commands.

## Deliberately out of scope for the MVP

- AR projection.
- Dynamic ambient calibration.
- Temporal/time-series analysis.
- Heavy model training or opaque diagnostic classification.
- Claims of definitive diagnosis.
