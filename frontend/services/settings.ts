import { callable } from '@steambrew/client';
import type { DetailToggles } from '../details/types';
import { log } from './backend';

export type PluginSettings = DetailToggles;

const DEFAULT_SETTINGS: PluginSettings = {
  showHours: true,
  showAchievements: true,
  showLastPlayed: true,
  showSize: true,
};

const GetSettingsRpc = callable<[], string>('GetSettings');
const SaveSettingsRpc = callable<[{ settings_json: string }], string>('SaveSettings');

let cachedSettings: PluginSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const notify = () => listeners.forEach((l) => l());

export async function initSettings(): Promise<void> {
  try {
    const result = JSON.parse((await GetSettingsRpc()) || '{}');
    if (result.success && result.data) {
      cachedSettings = { ...DEFAULT_SETTINGS, ...result.data };
      notify();
    }
  } catch (e) {
    log('Failed to load settings:', String(e));
  }
}

export function getSettings(): PluginSettings {
  return cachedSettings;
}

export async function saveSettings(settings: PluginSettings): Promise<void> {
  const previous = cachedSettings;
  cachedSettings = settings;
  notify();
  try {
    const result = JSON.parse((await SaveSettingsRpc({ settings_json: JSON.stringify(settings) })) || '{}');
    if (!result.success) throw new Error(result.error);
  } catch (e) {
    log('Failed to save settings:', String(e));
    cachedSettings = previous;
    notify();
  }
}
