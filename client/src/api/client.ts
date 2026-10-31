import type { AnalysisConfiguration, AnalysisResponse, ConfigurationOptions } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new Error('Backend unavailable. Start it with ./run.sh or cd backend && uvicorn app.main:app --reload.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: { message?: string } | Array<{ msg?: string }> }
      | null;
    const detail = body?.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map((item) => item.msg ?? 'Invalid request').join(', '));
    }
    throw new Error(detail?.message ?? `Backend request failed with status ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export function getConfigurationOptions(): Promise<ConfigurationOptions> {
  return request<ConfigurationOptions>('/api/v1/configuration-options');
}

export function analyze(
  rgbFile: File,
  thermalFile: File,
  configuration: AnalysisConfiguration,
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('rgb_file', rgbFile);
  formData.append('thermal_file', thermalFile);
  if (thermalFile.name.toLowerCase().endsWith('.csv')) {
    formData.append('thermal_unit', 'celsius');
  }
  formData.append('configuration', JSON.stringify(configuration));
  return request<AnalysisResponse>('/api/v1/analyze', {
    method: 'POST',
    body: formData,
  });
}
