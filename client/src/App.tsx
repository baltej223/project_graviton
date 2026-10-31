import { type ChangeEvent, useEffect, useMemo, useState } from 'react';

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
  { id: 'registration', label: 'Registration overlay', description: 'Aligned thermal overlay' },
  { id: 'mask', label: 'Anomaly mask', description: 'Flagged region' },
  { id: 'isotherm', label: 'Isotherm map', description: 'Thermal contour pattern' },
  { id: 'final', label: 'Final overlay', description: 'Clinical explanation layer' },
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
      return 'The flagged region is hotter than the corresponding reference side by more than the configured ΔT threshold.';
  }
};

const getConfigSummary = (config: Configuration) => {
  if (config.strategy === 'normative') {
    return `${config.baselineMin.toFixed(1)}°C–${config.baselineMax.toFixed(1)}°C baseline`;
  }

  return `${config.deltaT.toFixed(1)}°C ΔT threshold`;
};

const buildMockResult = (config: Configuration, upload: UploadState): MockAnalysisResult => ({
  strategyLabel: getStrategyLabel(config.strategy),
  regionLabel: getRegionLabel(config.bodyRegion),
  metrics: {
    maxTemperature: '37.8 °C',
    maxDeltaT: '+1.6 °C',
    epicenter: 'x 62%, y 44%',
    gradient: '0.42 °C/cm',
    pattern: 'Deep / diffuse',
    strategy: getStrategyLabel(config.strategy),
  },
  explanation: getStrategyExplanation(config.strategy),
  methodology: [
    'RGB and thermal inputs are represented together.',
    'The result is based on a configurable comparison strategy.',
    'Isotherms and gradient are explanatory visualizations.',
    'Phase 1 uses mocked values only.',
  ],
  disclaimer: 'Prototype output for triage and monitoring assistance only. It is not a diagnosis and must be interpreted by a qualified clinician.',
  visualLayers: layerOptions,
});

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

  useEffect(() => {
    return () => {
      if (upload.rgbPreview) {
        URL.revokeObjectURL(upload.rgbPreview);
      }
      if (upload.thermalPreview) {
        URL.revokeObjectURL(upload.thermalPreview);
      }
    };
  }, [upload.rgbPreview, upload.thermalPreview]);

  const canAnalyze = useMemo(
    () => Boolean(upload.rgb && upload.thermal && !upload.rgbError && !upload.thermalError),
    [upload],
  );

  const handleRgbInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

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
    setConfig((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleAnalyze = () => {
    if (!upload.rgb || !upload.thermal) {
      setValidationMessage('Both RGB and thermal files are required before analysis can run.');
      return;
    }

    if (upload.rgbError || upload.thermalError) {
      setValidationMessage('Please fix the upload validation errors before continuing.');
      return;
    }

    if (config.strategy !== 'normative') {
      if (!Number.isFinite(config.deltaT) || config.deltaT <= 0) {
        setValidationMessage('The ΔT threshold must be a positive value.');
        return;
      }
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
    setProcessingState({ status: 'processing', message: 'Upload validated' });

    window.setTimeout(() => {
      setProcessingState({ status: 'processing', message: 'Registration preview prepared' });
    }, 700);

    window.setTimeout(() => {
      setProcessingState({ status: 'complete', message: 'Mock analysis complete' });
      setAnalysisResult(buildMockResult(config, upload));
    }, 1600);
  };

  return (
    <main className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Header />

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
              disabled={!canAnalyze}
              validationMessage={validationMessage}
              processingState={processingState}
              onClick={handleAnalyze}
            />
          </div>

          <aside className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-sky-200">Prototype summary</h2>
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
          <section className="mt-10 rounded-3xl border border-slate-700 bg-slate-900/75 p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex flex-col gap-2 border-b border-slate-700 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Analysis dashboard</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Mock result overview</h2>
              </div>
              <div className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                Prototype output
              </div>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <AnalysisViewer
                selectedLayer={selectedLayer}
                onLayerSelect={setSelectedLayer}
                rgbPreview={upload.rgbPreview}
                thermalPreview={upload.thermalPreview}
              />

              <div className="space-y-4">
                <MetricCard label="Maximum temperature" value="37.8 °C" />
                <MetricCard label="Maximum ΔT" value="+1.6 °C" />
                <MetricCard label="Epicenter" value="x 62%, y 44%" />
                <MetricCard label="Thermal gradient" value="0.42 °C/cm" />
                <MetricCard label="Estimated pattern" value="Deep / diffuse" />
                <MetricCard label="Analysis strategy" value={analysisResult.strategyLabel} />
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <ExplanationPanel config={config} strategyLabel={analysisResult.strategyLabel} />

              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Method summary</p>
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
    <header className="rounded-3xl border border-cyan-500/20 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/30 backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Bioheat decision support</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Multimodal Bioheat Tracker</h1>
        </div>

        <span className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-200">
          Prototype / Phase 1
        </span>
      </div>

      <p className="mt-4 max-w-3xl text-base text-slate-300">
        Explainable thermal triage and monitoring assistance.
      </p>
    </header>
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

      <label className="mt-5 flex cursor-pointer flex-col gap-3 rounded-2xl border border-dashed border-slate-600 bg-slate-950/50 p-4 text-left transition hover:border-cyan-400/60 hover:bg-slate-950">
        <span className="text-sm font-medium text-slate-200">Select file</span>
        <input aria-label={title} type="file" accept={accept} onChange={onChange} className="sr-only" />
        <span className="inline-flex w-fit rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:bg-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400">
          Choose file
        </span>
      </label>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950/40 px-3 py-2">
        <span className="truncate text-sm text-slate-300">{file ? file.name : 'No file selected'}</span>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

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
  const isDeltaVisible = config.strategy === 'bilateral' || config.strategy === 'midline';

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Analysis configuration</h2>
        <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-violet-200">
          {config.strategy}
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

        {isDeltaVisible ? (
          <div>
            <label htmlFor="deltaT" className="mb-2 block text-sm font-medium text-slate-200">
              ΔT threshold (°C)
            </label>
            <input
              id="deltaT"
              type="number"
              min="0.1"
              step="0.1"
              value={config.deltaT}
              onChange={(event) => onChange('deltaT', Number(event.target.value))}
              className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
        ) : (
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
        )}
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
        className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-sky-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Analyze prototype data
      </button>

      {validationMessage ? <p className="mt-3 text-sm text-rose-300">{validationMessage}</p> : null}

      {processingState.status !== 'idle' ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
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
}: {
  selectedLayer: VisualizationLayer;
  onLayerSelect: (value: VisualizationLayer) => void;
  rgbPreview: string | null;
  thermalPreview: string | null;
}) {
  const selectedLayerInfo = layerOptions.find((layer) => layer.id === selectedLayer) ?? layerOptions[2];

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <div className="flex flex-wrap gap-2">
        {layerOptions.map((layer) => (
          <button
            key={layer.id}
            type="button"
            onClick={() => onLayerSelect(layer.id)}
            className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
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
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
          {selectedLayer === 'rgb' || selectedLayer === 'registration' || selectedLayer === 'mask' || selectedLayer === 'isotherm' || selectedLayer === 'final' ? (
            rgbPreview ? <img src={rgbPreview} alt="RGB reference" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.35),_rgba(15,23,42,0.9)_65%)]" />
          ) : null}

          {selectedLayer === 'thermal' && thermalPreview ? (
            <img src={thermalPreview} alt="Thermal input" className="h-full w-full object-cover" />
          ) : null}

          {selectedLayer === 'thermal' && !thermalPreview ? (
            <div className="h-full w-full bg-[radial-gradient(circle_at_60%_50%,_rgba(248,113,113,0.28),_transparent_20%),radial-gradient(circle_at_50%_36%,_rgba(96,165,250,0.3),_transparent_25%),linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,1))]" />
          ) : null}

          {(selectedLayer === 'registration' || selectedLayer === 'final') && (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(96,165,250,0.18),rgba(34,197,94,0.08))]" />
          )}

          {selectedLayer === 'mask' && (
            <div className="absolute inset-0">
              <div className="absolute left-[26%] top-[28%] h-[42%] w-[31%] rounded-[36%] border-4 border-red-400/80 bg-red-500/20 shadow-[0_0_50px_rgba(248,113,113,0.4)]" />
              <div className="absolute left-[52%] top-[46%] h-[22%] w-[18%] rounded-full border-4 border-amber-300/80 bg-amber-400/25 shadow-[0_0_30px_rgba(251,191,36,0.5)]" />
            </div>
          )}

          {selectedLayer === 'isotherm' && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_56%,rgba(251,146,60,0.28),transparent_12%),radial-gradient(circle_at_57%_52%,rgba(248,113,113,0.35),transparent_18%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,41,59,0.9))]">
              <div className="absolute inset-x-[18%] top-[22%] h-[18%] rounded-full border-2 border-cyan-400/80" />
              <div className="absolute inset-x-[30%] top-[34%] h-[20%] rounded-full border-2 border-sky-300/60" />
              <div className="absolute inset-x-[40%] top-[48%] h-[18%] rounded-full border-2 border-red-300/60" />
            </div>
          )}

          {(selectedLayer === 'registration' || selectedLayer === 'final') && (
            <div className="absolute inset-0">
              <div className="absolute left-[24%] top-[28%] h-[42%] w-[30%] rounded-[36%] border-4 border-cyan-300/80 bg-cyan-500/10" />
              <div className="absolute left-[56%] top-[42%] h-[20%] w-[18%] rounded-[40%] border-4 border-amber-300/80 bg-amber-500/10" />
            </div>
          )}

          {selectedLayer === 'final' && (
            <div className="absolute inset-0 bg-[linear-gradient(160deg,transparent_60%,rgba(248,113,113,0.18)_100%)]" />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Active layer</p>
          <p className="mt-1 text-sm font-medium text-slate-100">{selectedLayerInfo.label}</p>
          <p className="text-xs text-slate-400">{selectedLayerInfo.description}</p>
        </div>

        <div className="flex gap-2">
          <LegendSwatch label="Cooler / normal region" color="bg-sky-500/70" />
          <LegendSwatch label="Elevated temperature" color="bg-amber-400/80" />
          <LegendSwatch label="Flagged region" color="bg-red-500/80" />
        </div>
      </div>
    </div>
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
        {config.strategy === 'bilateral' && 'The flagged region is hotter than the corresponding reference side by more than the configured ΔT threshold.'}
        {config.strategy === 'midline' && 'The flagged region differs from the corresponding internal side of the same structure.'}
        {config.strategy === 'normative' && 'The localized temperature falls outside the configured body-region baseline.'}
      </p>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <p className="text-sm text-slate-300">
          Strategy: <span className="font-medium text-cyan-200">{strategyLabel}</span>
        </p>
        <p className="mt-2 text-sm text-slate-300">Threshold: {getConfigSummary(config)}</p>
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
