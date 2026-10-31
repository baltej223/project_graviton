export type AnalysisStrategy = 'bilateral' | 'midline' | 'normative';

export type AnalysisConfiguration = {
  strategy: AnalysisStrategy;
  body_region: string;
  delta_t_threshold_celsius?: number;
  baseline_min_celsius?: number;
  baseline_max_celsius?: number;
  blend_intensity?: number;
};

export type ArtifactDescriptor = {
  name: string;
  source: string;
  mocked: boolean;
  description: string;
  data_url?: string | null;
};

export type AnalysisResponse = {
  status: 'mock_complete';
  prototype_output: boolean;
  configuration: AnalysisConfiguration;
  metrics: {
    maximum_temperature_celsius: number;
    maximum_delta_t_celsius: number;
    epicenter_x: number;
    epicenter_y: number;
    thermal_gradient_celsius_per_cm: number;
    estimated_pattern: string;
  };
  artifacts: ArtifactDescriptor[];
  explanation: string;
  warnings: string[];
  limitation: string;
};

export type ConfigurationOptions = {
  strategies: Array<{ value: AnalysisStrategy; label: string; description: string }>;
  body_regions: string[];
  defaults: {
    delta_t_threshold_celsius: number;
    baseline_min_celsius: number;
    baseline_max_celsius: number;
  };
};
