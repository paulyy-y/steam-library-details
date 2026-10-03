import { useEffect, useState } from 'react';
import { definePlugin, Field, IconsModule, Millennium } from '@steambrew/client';
import { AchievementStore } from './details/achievements';
import { fetchMyAchievements, steamProgressCacheSize, steamProgressEntry } from './lib/steam';
import { initListDetails } from './list/decorate';
import { loadAchievementCache, log, saveAchievementCache } from './services/backend';
import { getSettings, initSettings, saveSettings, subscribeSettings, type PluginSettings } from './services/settings';

// Big Picture has no list view; only the desktop main window.
const MAIN_WINDOW_PREFIX = 'SP Desktop_';
const MAIN_WINDOW_NAME = 'SP Desktop_uid0';
const SAVE_DELAY_MS = 3000;

const TOGGLES: { key: keyof PluginSettings; label: string; description: string }[] = [
  { key: 'showHours', label: 'Hours played', description: 'Total playtime' },
  { key: 'showAchievements', label: 'Achievement completion', description: 'Percentage unlocked; 100% in gold' },
  { key: 'showLastPlayed', label: 'Last played', description: 'How long ago' },
  { key: 'showSize', label: 'Size on disk', description: 'Installed games only' },
];

const SettingsContent = () => {
  const [settings, setSettings] = useState<PluginSettings>(getSettings());
  useEffect(() => subscribeSettings(() => setSettings(getSettings())), []);

  return (
    <>
      {TOGGLES.map(({ key, label, description }) => (
        <Field key={key} label={label} description={description} bottomSeparator="standard">
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) => saveSettings({ ...getSettings(), [key]: e.target.checked })}
            style={{ width: '20px', height: '20px' }}
          />
        </Field>
      ))}
    </>
  );
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let rescan: () => void = () => {};

const store = new AchievementStore(
  fetchMyAchievements,
  steamProgressEntry,
  () => {
    rescan();
    saveTimer ??= setTimeout(() => {
      saveTimer = null;
      saveAchievementCache(store.serialize());
    }, SAVE_DELAY_MS);
  },
);

const attached = new Set<Document>();

function attach(context: { m_strName?: string; m_popup?: Window } | undefined): void {
  const doc = context?.m_popup?.document;
  if (!context?.m_strName?.startsWith(MAIN_WINDOW_PREFIX) || !doc?.body || attached.has(doc)) return;
  attached.add(doc);
  log(`Attaching to ${context.m_strName}; Steam progress cache: ${steamProgressCacheSize() ?? 'not found'}`);
  rescan = initListDetails(doc, store).rescan;
}

export default definePlugin(() => {
  Promise.all([initSettings(), loadAchievementCache().then((json) => store.load(json))]).then(() => rescan());

  Millennium.AddWindowCreateHook?.((context: any) => attach(context));
  try {
    attach(window.g_PopupManager?.GetExistingPopup?.(MAIN_WINDOW_NAME));
  } catch {
    // Window not created yet; the hook will attach.
  }

  return {
    title: 'Library Details',
    icon: <IconsModule.Settings />,
    content: <SettingsContent />,
  };
});
