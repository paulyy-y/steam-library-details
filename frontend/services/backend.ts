import { callable } from '@steambrew/client';

const LogRpc = callable<[{ message: string }], string>('Log');
const LoadAchievementsRpc = callable<[], string>('LoadAchievements');
const SaveAchievementsRpc = callable<[{ cache_json: string }], string>('SaveAchievements');

const PREFIX = '[Library Details]';

// Console for DevTools, plus the plugin's log file for when DevTools isn't on.
export function log(...args: unknown[]): void {
  console.log(PREFIX, ...args);
  const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  LogRpc({ message }).catch(() => {});
}

export async function loadAchievementCache(): Promise<string> {
  try {
    const result = JSON.parse((await LoadAchievementsRpc()) || '{}');
    return result.success && typeof result.data === 'string' ? result.data : '{}';
  } catch {
    return '{}';
  }
}

export async function saveAchievementCache(json: string): Promise<void> {
  try {
    const result = JSON.parse((await SaveAchievementsRpc({ cache_json: json })) || '{}');
    if (!result.success) log('Failed to save achievement cache:', result.error);
  } catch (e) {
    log('Failed to save achievement cache:', String(e));
  }
}
