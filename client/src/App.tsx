import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { analyze, getConfigurationOptions } from './api/client';
import type { AnalysisResponse } from './api/types';

type AnalysisStrategy = 'bilateral' | 'midline' | 'normative';
type BodyRegion = 'limb' | 'handFoot' | 'spine' | 'localized';
type VisualizationLayer = 'rgb' | 'thermal' | 'registration' | 'mask' | 'isotherm' | 'final';

type UploadState = {
  rgb: File | null;
  thermal: File | null;
  rgbPreview: string | null;
  thermalPreview: string | null;
  rgbError: string;
  thermalError: string;
};

type Configuration = {
  strategy: AnalysisStrategy;
  bodyRegion: BodyRegion;
  deltaT: number;
  baselineMin: number;
  baselineMax: number;
};

type ProcessingState = {
  status: 'idle' | 'processing' | 'complete';
  message: string;
};

type MockAnalysisResult = {
  strategyLabel: string;
  regionLabel: string;
  configuration: Configuration;
  sourceFiles: { rgb: string; thermal: string };
  metrics: {
    maxTemperature: string;
    maxDeltaT: string;
    epicenter: string;
    gradient: string;
    pattern: string;
    strategy: string;
  };
  explanation: string;
  methodology: string[];
  disclaimer: string;
  visualLayers: { id: VisualizationLayer; label: string; description: string }[];
  overlayDataUrl: string | null;
};

const strategyOptions: { value: AnalysisStrategy; label: string }[] = [
  { value: 'bilateral', label: 'Bilateral comparison' },
  { value: 'midline', label: 'Internal midline symmetry' },
  { value: 'normative', label: 'Normative baseline' },
];

const regionOptions: { value: BodyRegion; label: string }[] = [
  { value: 'limb', label: 'Limb / joint' },
  { value: 'handFoot', label: 'Hand or foot' },
  { value: 'spine', label: 'Spine / torso' },
  { value: 'localized', label: 'Localized asymmetric region' },
];

const layerOptions: { id: VisualizationLayer; label: string; description: string }[] = [
  { id: 'rgb', label: 'RGB source image', description: 'Clinical image reference' },
  { id: 'thermal', label: 'Thermal preview', description: 'Tissue heat map' },
  { id: 'registration', label: 'Registration overlay', description: 'Basic generated thermal overlay' },
  { id: 'mask', label: 'Anomaly mask', description: 'Available in a later analysis phase' },
  { id: 'isotherm', label: 'Isotherm map', description: 'Available in a later analysis phase' },
  { id: 'final', label: 'Final overlay', description: 'Basic generated thermal overlay' },
];

const defaultConfig: Configuration = {
  strategy: 'bilateral',
  bodyRegion: 'limb',
  deltaT: 1.2,
  baselineMin: 31.5,
  baselineMax: 35.2,
};

const getStrategyLabel = (strategy: AnalysisStrategy) =>
  strategyOptions.find((option) => option.value === strategy)?.label ?? 'Bilateral comparison';

const getRegionLabel = (region: BodyRegion) =>
  regionOptions.find((option) => option.value === region)?.label ?? 'Limb / joint';

const isRgbFile = (file: File) =>
  file.type === 'image/jpeg' || file.type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name);

const isThermalFile = (file: File) =>
  file.type === 'image/jpeg' ||
  file.type === 'image/png' ||
  file.type === 'text/csv' ||
  /\.(csv|jpe?g|png)$/i.test(file.name);

const getStrategyExplanation = (strategy: AnalysisStrategy) => {
  switch (strategy) {
    case 'midline':
      return 'The flagged region differs from the corresponding internal side of the same structure.';
    case 'normative':
      return 'The localized temperature falls outside the configured body-region baseline.';
    default:
      return 'The selected region is compared with the corresponding reference side.';
  }
};

const getConfigSummary = (config: Configuration) => {
  if (config.strategy === 'normative') {
    return `${config.baselineMin.toFixed(1)}°C–${config.baselineMax.toFixed(1)}°C baseline`;
  }

  return 'Backend comparison defaults';
};

const bodyRegionToApi: Record<BodyRegion, string> = {
  limb: 'limb_joint',
  handFoot: 'hand_foot',
  spine: 'spine_torso',
  localized: 'localized_asymmetric_region',
};

const buildResultFromApi = (
  response: AnalysisResponse,
  config: Configuration,
  upload: UploadState,
): MockAnalysisResult => {
  const overlay = response.artifacts.find((artifact) => artifact.name === 'final_overlay');
  const bodyRegion =
    Object.entries(bodyRegionToApi).find(([, value]) => value === response.configuration.body_region)?.[0] as
      | BodyRegion
      | undefined;
  return {
    strategyLabel: getStrategyLabel(response.configuration.strategy),
    regionLabel: getRegionLabel(bodyRegion ?? config.bodyRegion),
    configuration: { ...config },
    sourceFiles: { rgb: upload.rgb?.name ?? '', thermal: upload.thermal?.name ?? '' },
    metrics: {
      maxTemperature: `${response.metrics.maximum_temperature_celsius.toFixed(1)} °C`,
      maxDeltaT: `${response.metrics.maximum_delta_t_celsius >= 0 ? '+' : ''}${response.metrics.maximum_delta_t_celsius.toFixed(1)} °C`,
      epicenter: `x ${Math.round(response.metrics.epicenter_x * 100)}%, y ${Math.round(response.metrics.epicenter_y * 100)}%`,
      gradient: `${response.metrics.thermal_gradient_celsius_per_cm.toFixed(2)} °C/cm`,
      pattern: response.metrics.estimated_pattern.replaceAll('_', ' / '),
      strategy: getStrategyLabel(response.configuration.strategy),
    },
    explanation: response.explanation,
    methodology: [
      'The backend generated a basic thermal-to-RGB resize overlay.',
      'Raw thermal values remain separate from visualization scaling.',
      ...response.warnings,
    ],
    disclaimer: response.limitation,
    visualLayers: layerOptions,
    overlayDataUrl: overlay?.data_url ?? null,
  };
};

function App() {
  const [upload, setUpload] = useState<UploadState>({
    rgb: null,
    thermal: null,
    rgbPreview: null,
    thermalPreview: null,
    rgbError: '',
    thermalError: '',
  });

  const [config, setConfig] = useState<Configuration>(defaultConfig);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    message: 'Awaiting valid inputs',
  });
  const [analysisResult, setAnalysisResult] = useState<MockAnalysisResult | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<VisualizationLayer>('registration');
  const [validationMessage, setValidationMessage] = useState('');
  const processingTimeouts = useRef<number[]>([]);

  const clearProcessingTimeouts = () => {
    processingTimeouts.current.forEach(window.clearTimeout);
    processingTimeouts.current = [];
  };

  const invalidateAnalysis = () => {
    clearProcessingTimeouts();
    setAnalysisResult(null);
    setProcessingState({ status: 'idle', message: 'Awaiting valid inputs' });
  };

  useEffect(() => {
    return () => {
      clearProcessingTimeouts();
      if (upload.rgbPreview) {
        URL.revokeObjectURL(upload.rgbPreview);
      }
      if (upload.thermalPreview) {
        URL.revokeObjectURL(upload.thermalPreview);
      }
    };
  }, [upload.rgbPreview, upload.thermalPreview]);

  useEffect(() => {
    getConfigurationOptions()
      .then((options) => {
        setConfig((previous) => ({
          ...previous,
          deltaT: options.defaults.delta_t_threshold_celsius,
          baselineMin: options.defaults.baseline_min_celsius,
          baselineMax: options.defaults.baseline_max_celsius,
        }));
      })
      .catch(() => {
        setValidationMessage('Backend configuration options could not be loaded; local defaults are being used.');
      });
  }, []);

  const canAnalyze = useMemo(
    () => Boolean(upload.rgb && upload.thermal && !upload.rgbError && !upload.thermalError),
    [upload],
  );

  const handleRgbInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    invalidateAnalysis();
    if (upload.rgbPreview) {
      URL.revokeObjectURL(upload.rgbPreview);
    }

    if (!file) {
      setUpload((previous) => ({
        ...previous,
        rgb: null,
        rgbPreview: null,
        rgbError: 'Please choose an RGB image.',
      }));
      return;
    }

    if (!isRgbFile(file)) {
      setUpload((previous) => ({
        ...previous,
        rgb: null,
        rgbPreview: null,
        rgbError: 'Unsupported RGB file. Please upload a JPEG or PNG image.',
      }));
      event.target.value = '';
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setUpload((previous) => ({
      ...previous,
      rgb: file,
      rgbPreview: nextPreview,
      rgbError: '',
    }));
    setValidationMessage('');
    event.target.value = '';
  };

  const handleThermalInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    invalidateAnalysis();
    if (upload.thermalPreview) {
      URL.revokeObjectURL(upload.thermalPreview);
    }

    if (!file) {
      setUpload((previous) => ({
        ...previous,
        thermal: null,
        thermalPreview: null,
        thermalError: 'Please choose a thermal source.',
      }));
      return;
    }

    if (!isThermalFile(file)) {
      setUpload((previous) => ({
        ...previous,
        thermal: null,
        thermalPreview: null,
        thermalError: 'Unsupported thermal file. Please upload a CSV, JPEG, or PNG file.',
      }));
      event.target.value = '';
      return;
    }

    const nextPreview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setUpload((previous) => ({
      ...previous,
      thermal: file,
      thermalPreview: nextPreview,
      thermalError: '',
    }));
    setValidationMessage('');
    event.target.value = '';
  };

  const updateConfiguration = <K extends keyof Configuration>(key: K, value: Configuration[K]) => {
    invalidateAnalysis();
    setValidationMessage('');
    setConfig((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleAnalyze = async () => {
    if (processingState.status === 'processing') {
      return;
    }

    if (!upload.rgb || !upload.thermal) {
      setValidationMessage('Both RGB and thermal files are required before analysis can run.');
      return;
    }

    if (upload.rgbError || upload.thermalError) {
      setValidationMessage('Please fix the upload validation errors before continuing.');
      return;
    }

    if (config.strategy === 'normative') {
      if (!Number.isFinite(config.baselineMin) || !Number.isFinite(config.baselineMax)) {
        setValidationMessage('Baseline minimum and maximum values must be valid numbers.');
        return;
      }

      if (config.baselineMin >= config.baselineMax) {
        setValidationMessage('Baseline minimum must be lower than baseline maximum.');
        return;
      }
    }

    setValidationMessage('');
    clearProcessingTimeouts();
    setProcessingState({ status: 'processing', message: 'Sending files to backend' });

    try {
      const response = await analyze(upload.rgb, upload.thermal, {
        strategy: config.strategy,
        body_region: bodyRegionToApi[config.bodyRegion],
        ...(config.strategy === 'normative'
          ? {
              baseline_min_celsius: config.baselineMin,
              baseline_max_celsius: config.baselineMax,
            }
          : { delta_t_threshold_celsius: config.deltaT }),
      });
      setProcessingState({ status: 'complete', message: 'Backend overlay complete' });
      setAnalysisResult(buildResultFromApi(response, config, upload));
      setSelectedLayer('final');
    } catch (error) {
      setProcessingState({ status: 'idle', message: 'Backend request failed' });
      setValidationMessage(error instanceof Error ? error.message : 'The backend request failed.');
    }
  };

  return (
    <main className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Header />
        <WorkflowSteps
          hasRgb={Boolean(upload.rgb && !upload.rgbError)}
          hasThermal={Boolean(upload.thermal && !upload.thermalError)}
          analysisComplete={processingState.status === 'complete'}
        />

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <UploadCard
              title="RGB optical image"
              description="High-resolution optical reference for alignment"
              accept="image/png,image/jpeg"
              file={upload.rgb}
              preview={upload.rgbPreview}
              error={upload.rgbError}
              fileKind="image"
              onChange={handleRgbInput}
            />

            <UploadCard
              title="Thermal data"
              description="CSV matrix or thermal image input"
              accept=".csv,image/png,image/jpeg"
              file={upload.thermal}
              preview={upload.thermalPreview}
              error={upload.thermalError}
              fileKind="thermal"
              onChange={handleThermalInput}
            />

            <AnalysisConfiguration config={config} onChange={updateConfiguration} />

            <AnalyzeButton
              disabled={!canAnalyze || processingState.status === 'processing'}
              validationMessage={validationMessage}
              processingState={processingState}
              onClick={handleAnalyze}
            />
          </div>

          <aside className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-sm xl:sticky xl:top-6 xl:self-start">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Session setup</p>
                <h2 className="mt-1 text-lg font-semibold text-sky-200">Prototype summary</h2>
              </div>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300">
                Demo
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <SummaryLine label="Strategy" value={getStrategyLabel(config.strategy)} />
              <SummaryLine label="Region" value={getRegionLabel(config.bodyRegion)} />
              <SummaryLine label="Threshold" value={getConfigSummary(config)} />
              <SummaryLine label="Status" value={processingState.message} />
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <FileStatus label="RGB image" file={upload.rgb} valid={Boolean(upload.rgb && !upload.rgbError)} />
              <FileStatus label="Thermal data" file={upload.thermal} valid={Boolean(upload.thermal && !upload.thermalError)} />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Clinical framing</p>
              <p className="mt-3 text-sm text-slate-300">
                This prototype demonstrates explainable image alignment and thermal hotspot interpretation for
                triage and monitoring assistance, not a confirmed diagnosis.
              </p>
            </div>
          </aside>
        </section>

        {analysisResult ? (
          <section className="mt-10 min-w-0 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/75 p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex flex-col gap-2 border-b border-slate-700 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Analysis dashboard</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Backend overlay result</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {analysisResult.regionLabel} · {analysisResult.strategyLabel}
                </p>
              </div>
              <div className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                Prototype output
              </div>
            </div>

            <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(16rem,1fr)]">
              <AnalysisViewer
                selectedLayer={selectedLayer}
                onLayerSelect={setSelectedLayer}
                rgbPreview={upload.rgbPreview}
                thermalPreview={upload.thermalPreview}
                overlayDataUrl={analysisResult.overlayDataUrl}
              />

              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">Overlay status</h3>
                  <span className="text-xs text-slate-400">Phase 3 feature</span>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-sm font-semibold text-emerald-200">Basic overlay generated</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    The thermal input was resized to the RGB dimensions and blended into a PNG overlay.
                    Registration quality, anomaly masks, isotherms, epicenter, and clinical metrics are not
                    implemented in this phase.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <ExplanationPanel config={analysisResult.configuration} strategyLabel={analysisResult.strategyLabel} />

              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Method summary</p>
                <p className="mt-2 text-xs text-slate-400">
                  Inputs: {analysisResult.sourceFiles.rgb} + {analysisResult.sourceFiles.thermal}
                </p>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {analysisResult.methodology.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Disclaimer />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30 backdrop-blur-sm sm:p-8">
      <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
            Bioheat decision support
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Multimodal Bioheat Tracker
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Explainable thermal triage and monitoring assistance.
            <span className="mt-1 block text-sm text-slate-400">
              Pair an optical reference with thermal data to review a transparent, anatomy-aware prototype analysis.
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <span className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-200">
            Prototype / Phase 1
          </span>
          <span className="text-xs text-slate-400">Local-only demo · No patient data is uploaded</span>
        </div>
      </div>
    </header>
  );
}

function WorkflowSteps({
  hasRgb,
  hasThermal,
  analysisComplete,
}: {
  hasRgb: boolean;
  hasThermal: boolean;
  analysisComplete: boolean;
}) {
  const uploadsComplete = hasRgb && hasThermal;
  const steps = [
    { number: '01', label: 'Add source images', detail: 'RGB + thermal', complete: uploadsComplete },
    { number: '02', label: 'Set comparison', detail: 'Anatomy + threshold', complete: false },
    { number: '03', label: 'Review output', detail: 'Explainable mock result', complete: analysisComplete },
  ];

  return (
    <nav aria-label="Analysis workflow" className="mt-5 grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => {
        const active = index === 0 ? !uploadsComplete : index === 1 ? uploadsComplete && !analysisComplete : analysisComplete;

        return (
          <div
            key={step.number}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
              active
                ? 'border-cyan-400/40 bg-cyan-500/10'
                : step.complete
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-slate-800 bg-slate-900/40'
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ${
                active
                  ? 'bg-cyan-400 text-slate-950'
                  : step.complete
                    ? 'bg-emerald-400/15 text-emerald-200'
                    : 'bg-slate-800 text-slate-400'
              }`}
            >
              {step.complete ? '✓' : step.number}
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-sm font-medium ${active ? 'text-white' : 'text-slate-300'}`}>
                {step.label}
              </span>
              <span className="block truncate text-xs text-slate-400">{step.detail}</span>
            </span>
          </div>
        );
      })}
    </nav>
  );
}

function FileStatus({ label, file, valid }: { label: string; file: File | null; valid: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        <p className="truncate text-xs text-slate-500">{file?.name ?? 'Waiting for a file'}</p>
      </div>
      <span className={`shrink-0 text-xs font-medium ${valid ? 'text-emerald-300' : 'text-slate-500'}`}>
        {valid ? 'Ready' : 'Required'}
      </span>
    </div>
  );
}

function UploadCard({
  title,
  description,
  accept,
  file,
  preview,
  error,
  fileKind,
  onChange,
}: {
  title: string;
  description: string;
  accept: string;
  file: File | null;
  preview: string | null;
  error: string;
  fileKind: 'image' | 'thermal';
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const isCsv = fileKind === 'thermal' && file && file.name.toLowerCase().endsWith('.csv');

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
          {fileKind === 'image' ? 'Optical' : 'Thermal'}
        </span>
      </div>

      <label className="group mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-600 bg-slate-950/50 p-4 text-left transition hover:border-cyan-400/60 hover:bg-slate-950 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/30">
        <span>
          <span className="block text-sm font-medium text-slate-200">{file ? 'Replace selected file' : 'Choose a local file'}</span>
          <span className="mt-1 block text-xs text-slate-400">
            {fileKind === 'image' ? 'JPEG or PNG · Stored only in this browser' : 'CSV, JPEG, or PNG · Stored only in this browser'}
          </span>
        </span>
        <input aria-label={title} type="file" accept={accept} onChange={onChange} className="sr-only" />
        <span className="shrink-0 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition group-hover:bg-cyan-500/20">
          Browse
        </span>
      </label>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950/40 px-3 py-2">
        <span className="truncate text-sm text-slate-300">{file ? file.name : 'No file selected'}</span>
      </div>

      {error ? <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/60">
        {file && preview && !isCsv ? (
          <img src={preview} alt={`${title} preview`} className="h-52 w-full object-cover" />
        ) : (
          <div className="flex h-52 items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_38%),linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,1))] p-4">
            {isCsv ? (
              <div className="w-full rounded-xl border border-cyan-400/30 bg-slate-900/70 p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                  <span>Thermal matrix</span>
                  <span>{file?.name}</span>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: 32 }).map((_, index) => (
                    <span
                      key={index}
                      className={
                        `h-3 rounded-sm ${
                          index % 5 === 0 || index % 7 === 0
                            ? 'bg-cyan-400/80'
                            : index % 3 === 0
                              ? 'bg-blue-500/70'
                              : 'bg-slate-700'
                        }`
                      }
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-sm text-slate-400">
                <span className="block text-lg text-slate-200">Preview placeholder</span>
                Upload a valid file to see it here.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisConfiguration({
  config,
  onChange,
}: {
  config: Configuration;
  onChange: <K extends keyof Configuration>(key: K, value: Configuration[K]) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Analysis configuration</h2>
        <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-200">
          {getStrategyLabel(config.strategy)}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="strategy" className="mb-2 block text-sm font-medium text-slate-200">
            Anatomy strategy
          </label>
          <select
            id="strategy"
            value={config.strategy}
            onChange={(event) => onChange('strategy', event.target.value as AnalysisStrategy)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
          >
            {strategyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="region" className="mb-2 block text-sm font-medium text-slate-200">
            Anatomy / body region
          </label>
          <select
            id="region"
            value={config.bodyRegion}
            onChange={(event) => onChange('bodyRegion', event.target.value as BodyRegion)}
            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
          >
            {regionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {config.strategy === 'normative' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="baselineMin" className="mb-2 block text-sm font-medium text-slate-200">
                Baseline minimum (°C)
              </label>
              <input
                id="baselineMin"
                type="number"
                step="0.1"
                value={config.baselineMin}
                onChange={(event) => onChange('baselineMin', Number(event.target.value))}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>

            <div>
              <label htmlFor="baselineMax" className="mb-2 block text-sm font-medium text-slate-200">
                Baseline maximum (°C)
              </label>
              <input
                id="baselineMax"
                type="number"
                step="0.1"
                value={config.baselineMax}
                onChange={(event) => onChange('baselineMax', Number(event.target.value))}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AnalyzeButton({
  disabled,
  validationMessage,
  processingState,
  onClick,
}: {
  disabled: boolean;
  validationMessage: string;
  processingState: ProcessingState;
  onClick: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-linear-to-r from-cyan-500 to-sky-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Analyze prototype data
      </button>

      {validationMessage ? <p className="mt-3 text-sm text-rose-300">{validationMessage}</p> : null}

      {processingState.status !== 'idle' ? (
        <div role="status" aria-live="polite" className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              processingState.status === 'complete' ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'
            }`}
          />
          {processingState.message}
        </div>
      ) : null}
    </div>
  );
}

function AnalysisViewer({
  selectedLayer,
  onLayerSelect,
  rgbPreview,
  thermalPreview,
  overlayDataUrl,
}: {
  selectedLayer: VisualizationLayer;
  onLayerSelect: (value: VisualizationLayer) => void;
  rgbPreview: string | null;
  thermalPreview: string | null;
  overlayDataUrl: string | null;
}) {
  const selectedLayerInfo = layerOptions.find((layer) => layer.id === selectedLayer) ?? layerOptions[2];
  const isThermalLayer = selectedLayer === 'thermal';
  const isSourceLayer = selectedLayer === 'rgb' || isThermalLayer;
  const sourcePreview = isThermalLayer ? thermalPreview : rgbPreview;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {layerOptions.map((layer) => (
          <button
            key={layer.id}
            type="button"
            onClick={() => onLayerSelect(layer.id)}
            aria-pressed={selectedLayer === layer.id}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
              selectedLayer === layer.id
                ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
        <div className="relative aspect-4/3 overflow-hidden bg-slate-950">
          {isSourceLayer && sourcePreview ? (
            <img
              src={sourcePreview}
              alt={isThermalLayer ? 'Thermal input preview' : 'RGB source image'}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : selectedLayer === 'registration' || selectedLayer === 'final' ? (
            overlayDataUrl ? (
              <img
                src={overlayDataUrl}
                alt="Backend-generated basic thermal overlay"
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <UnavailableLayer message="The backend overlay is not available." />
            )
          ) : (
            <UnavailableLayer message="This analysis layer is not implemented yet." />
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-950/90 to-transparent p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                {isThermalLayer && !thermalPreview ? 'Synthetic thermal preview' : selectedLayerInfo.label}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {isThermalLayer && !thermalPreview ? 'Illustrative data · not measured temperatures' : selectedLayerInfo.description}
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-slate-950/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-200">
              Demo view
            </span>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1.5 text-[10px] text-slate-300">
            {selectedLayer === 'final' && overlayDataUrl
              ? 'Backend-generated basic overlay · no epicenter or anomaly calculation yet'
              : isThermalLayer && thermalPreview
                ? 'Original thermal image'
                : 'Illustrative alignment · not a clinical measurement'}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Active layer</p>
          <p className="mt-1 text-sm font-medium text-slate-100">{selectedLayerInfo.label}</p>
          <p className="text-xs text-slate-400">{selectedLayerInfo.description}</p>
        </div>

        <div aria-label="Visualization legend" className="flex flex-wrap gap-x-4 gap-y-2">
          <LegendSwatch label="Cooler / normal" color="bg-sky-500/70" />
          <LegendSwatch label="Elevated temperature" color="bg-amber-400/80" />
          <LegendSwatch label="Flagged region" color="bg-red-500/80" />
        </div>
      </div>
    </div>
  );
}

function UnavailableLayer({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-950 p-8 text-center">
      <div>
        <p className="text-sm font-semibold text-slate-200">Not available in Phase 3</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function MockThermalMap({ layer }: { layer: VisualizationLayer }) {
  const isMask = layer === 'mask';
  const isIsotherm = layer === 'isotherm';
  const isRgb = layer === 'rgb';

  return (
    <svg
      role="img"
      aria-label={isMask ? 'Illustrative anomaly mask' : isIsotherm ? 'Illustrative isotherm contour map' : 'Illustrative thermal map'}
      viewBox="0 0 640 480"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="scan-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={isMask ? '#101825' : '#081827'} />
          <stop offset="1" stopColor={isMask ? '#171c29' : '#10233a'} />
        </linearGradient>
        <linearGradient id="limb-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={isRgb ? '#9aa9b9' : '#285776'} />
          <stop offset=".5" stopColor={isRgb ? '#d2dbe4' : '#427aa0'} />
          <stop offset="1" stopColor={isRgb ? '#8496a7' : '#234c70'} />
        </linearGradient>
        <radialGradient id="heat-field">
          <stop offset="0" stopColor="#fef08a" stopOpacity=".98" />
          <stop offset=".28" stopColor="#fb923c" stopOpacity=".88" />
          <stop offset=".58" stopColor="#ef4444" stopOpacity=".56" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <pattern id="scan-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="#9fb4ca" strokeOpacity=".07" strokeWidth="1" />
          <circle cx="0" cy="0" r="1.2" fill="#9fb4ca" fillOpacity=".15" />
        </pattern>
        <pattern id="mask-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="#7f1d1d" fillOpacity=".34" />
          <path d="M0 0V9" stroke="#f87171" strokeOpacity=".9" strokeWidth="3" />
        </pattern>
        <filter id="hotspot-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      <rect width="640" height="480" fill="url(#scan-bg)" />
      <rect width="640" height="480" fill="url(#scan-grid)" />
      <path d="M80 415H560M320 46V434" stroke="#b6c8d8" strokeOpacity=".12" strokeDasharray="4 8" />

      <g opacity={isMask ? '.62' : '.95'}>
        <path
          d="M204 44C187 78 181 121 190 163L211 231C216 248 215 272 205 293L172 371C165 389 175 407 194 412L222 418C239 420 252 411 256 394L278 304C283 281 281 254 271 231L254 165C248 132 259 87 275 54Z"
          fill="url(#limb-fill)"
          stroke="#c5d5e2"
          strokeOpacity=".5"
          strokeWidth="2"
        />
        <path
          d="M366 44C383 78 389 121 380 163L359 231C354 248 355 272 365 293L398 371C405 389 395 407 376 412L348 418C331 420 318 411 314 394L292 304C287 281 289 254 299 231L316 165C322 132 311 87 295 54Z"
          fill="url(#limb-fill)"
          stroke="#c5d5e2"
          strokeOpacity=".5"
          strokeWidth="2"
        />
        <path d="M229 180C247 191 258 211 260 231M335 180C353 191 364 211 366 231" fill="none" stroke="#e2e8f0" strokeOpacity=".25" strokeWidth="2" />
      </g>

      {!isRgb && !isMask ? (
        <>
          <ellipse cx="371" cy="211" rx="91" ry="78" fill="url(#heat-field)" filter="url(#hotspot-glow)" />
          <ellipse cx="371" cy="211" rx="72" ry="57" fill="url(#heat-field)" opacity=".74" />
          <ellipse cx="253" cy="211" rx="60" ry="50" fill="#38bdf8" opacity=".12" />
        </>
      ) : null}

      {isMask ? (
        <>
          <path d="M318 169C338 144 382 139 410 163C438 187 437 224 414 247C391 270 348 269 324 247C302 227 298 193 318 169Z" fill="url(#mask-hatch)" stroke="#fca5a5" strokeWidth="3" strokeDasharray="7 5" />
          <circle cx="371" cy="211" r="8" fill="#fff" />
          <path d="M371 191V231M351 211H391" stroke="#fff" strokeWidth="2" />
          <text x="371" y="286" textAnchor="middle" fill="#fecaca" fontSize="13" fontWeight="600">FLAGGED REGION</text>
        </>
      ) : null}

      {isIsotherm ? (
        <g fill="none" strokeWidth="2.5">
          <path d="M292 211C292 165 326 130 371 130C416 130 450 165 450 211C450 257 416 292 371 292C326 292 292 257 292 211Z" stroke="#67e8f9" />
          <path d="M315 211C315 178 340 153 371 153C402 153 427 178 427 211C427 244 402 269 371 269C340 269 315 244 315 211Z" stroke="#fbbf24" />
          <path d="M339 211C339 193 353 179 371 179C389 179 403 193 403 211C403 229 389 243 371 243C353 243 339 229 339 211Z" stroke="#fb7185" />
        </g>
      ) : null}

      {(layer === 'registration' || layer === 'final') ? (
        <g fill="none">
          <path d="M199 229C218 242 245 244 265 230M355 229C374 242 401 244 421 230" stroke="#a5f3fc" strokeWidth="3" strokeDasharray="8 5" />
          <ellipse cx="371" cy="211" rx="54" ry="45" stroke="#fcd34d" strokeWidth="2.5" />
          <circle cx="397" cy="211" r="7" fill="#fff" stroke="#f87171" strokeWidth="4" />
          <path d="M405 207L455 179H505" stroke="#fca5a5" strokeWidth="2" />
          <text x="510" y="183" fill="#fee2e2" fontSize="12">Epicenter</text>
          {layer === 'final' ? (
            <path d="M322 167C341 143 383 140 408 163C435 187 435 222 412 246C389 269 350 267 326 247C303 228 301 191 322 167Z" fill="#ef4444" fillOpacity=".24" stroke="#fca5a5" strokeWidth="3" />
          ) : null}
        </g>
      ) : null}

      <g fill="#cbd5e1" fillOpacity=".72" fontSize="10" letterSpacing="2">
        <text x="30" y="36">LEFT</text>
        <text x="566" y="36">RIGHT</text>
        <text x="30" y="454">ILLUSTRATIVE ONLY</text>
      </g>
    </svg>
  );
}

function ScanLayerOverlay({ layer }: { layer: VisualizationLayer }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 640 480"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <pattern id="overlay-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="#7f1d1d" fillOpacity=".3" />
          <path d="M0 0V9" stroke="#f87171" strokeOpacity=".9" strokeWidth="3" />
        </pattern>
      </defs>
      {layer === 'mask' ? (
        <path d="M318 169C338 144 382 139 410 163C438 187 437 224 414 247C391 270 348 269 324 247C302 227 298 193 318 169Z" fill="url(#overlay-hatch)" stroke="#fecaca" strokeWidth="3" strokeDasharray="7 5" />
      ) : null}
      {layer === 'isotherm' ? (
        <g fill="none" strokeWidth="3">
          <ellipse cx="371" cy="211" rx="82" ry="69" stroke="#67e8f9" />
          <ellipse cx="371" cy="211" rx="57" ry="48" stroke="#fbbf24" />
          <ellipse cx="371" cy="211" rx="31" ry="27" stroke="#fb7185" />
        </g>
      ) : null}
      {(layer === 'registration' || layer === 'final') ? (
        <>
          <ellipse cx="371" cy="211" rx="58" ry="48" fill="#f97316" fillOpacity=".22" stroke="#fde68a" strokeWidth="3" />
          <path d="M338 211C338 193 353 178 371 178C389 178 404 193 404 211C404 229 389 244 371 244" fill="none" stroke="#fb7185" strokeWidth="3" />
          <circle cx="397" cy="211" r="8" fill="#fff" stroke="#ef4444" strokeWidth="4" />
          {layer === 'final' ? (
            <path d="M320 170C341 143 383 140 411 164C437 187 436 224 412 248C388 270 348 269 323 246C301 226 299 193 320 170Z" fill="url(#overlay-hatch)" fillOpacity=".7" stroke="#fecaca" strokeWidth="3" />
          ) : null}
        </>
      ) : null}
    </svg>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ExplanationPanel({ config, strategyLabel }: { config: Configuration; strategyLabel: string }) {
  const explanation = getStrategyExplanation(config.strategy);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Explanation</p>

      <p className="mt-4 text-base text-slate-100">
        {config.strategy === 'bilateral' && 'The selected region is compared with the corresponding reference side.'}
        {config.strategy === 'midline' && 'The flagged region differs from the corresponding internal side of the same structure.'}
        {config.strategy === 'normative' && 'The localized temperature falls outside the configured body-region baseline.'}
      </p>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <p className="text-sm text-slate-300">
          Strategy: <span className="font-medium text-cyan-200">{strategyLabel}</span>
        </p>
        <p className="mt-2 text-sm text-slate-300">Comparison settings: managed by the backend prototype.</p>
        <p className="mt-2 text-sm text-slate-300">Methodology: {explanation}</p>
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
      Prototype output for triage and monitoring assistance only. It is not a diagnosis and must be interpreted by a qualified clinician.
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
}

function LegendSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-300">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}

export default App;
