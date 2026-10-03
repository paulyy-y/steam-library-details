// Row/app id lookup adapted from Yohlo/protondb-library-badges (MIT). See NOTICE.
import { findClassModule, getReactInstance } from '@steambrew/client';
import { fromAchievementResponse } from '../details/achievements';
import type { AchievementProgress, AppInfo, SteamProgressEntry } from '../details/types';

declare global {
  interface Window {
    appAchievementProgressCache?: { m_achievementProgress?: { mapCache?: Map<number, SteamProgressEntry> } };
    g_PopupManager?: { GetExistingPopup?(name: string): { m_strName?: string; m_popup?: Window } | undefined };
  }
}

// Non-Steam shortcuts get app ids with the high bit set.
export const isSteamApp = (appId: number) => Number.isInteger(appId) && appId > 0 && appId < 0x80000000;

export function getAppInfo(appId: number): AppInfo | null {
  // size_on_disk can arrive as a string (64-bit value); Number() handles both.
  const overview = window.appStore?.GetAppOverviewByAppID(appId);
  if (!overview) return null;
  return {
    appId,
    minutesPlayed: Number(overview.minutes_playtime_forever) || 0,
    lastPlayed: Number(overview.rt_last_time_played) || 0,
    sizeOnDisk: Number(overview.size_on_disk) || 0,
  };
}

// Steam's own achievement progress cache (only covers games Steam has looked at).
export function steamProgressEntry(appId: number): SteamProgressEntry | null {
  return window.appAchievementProgressCache?.m_achievementProgress?.mapCache?.get(appId) ?? null;
}

export function steamProgressCacheSize(): number | null {
  return window.appAchievementProgressCache?.m_achievementProgress?.mapCache?.size ?? null;
}

export async function fetchMyAchievements(appId: number): Promise<AchievementProgress | null> {
  if (!isSteamApp(appId)) return null;
  return fromAchievementResponse(await SteamClient.Apps.GetMyAchievementsForApp(String(appId)));
}

// Finds one of Steam's CSS modules by its class keys; the hashed class names change between builds.
export function classModuleFinder<K extends string>(...keys: K[]): () => Record<K, string> | null {
  let found: Record<K, string> | null = null;
  return () => {
    if (found) return found;
    const module = findClassModule((m: Record<string, unknown>) => keys.every((k) => typeof m[k] === 'string'));
    found = (module as Record<K, string> | undefined) ?? null;
    return found;
  };
}

type Props = Record<string, unknown>;
interface FiberLike {
  memoizedProps?: Props;
  return?: FiberLike | null;
}
const MAX_FIBER_DEPTH = 40;

function appIdFromProps(props: Props): number | null {
  for (const candidate of [props, props.item, props.appOverview]) {
    const appId = (candidate as { appid?: unknown } | undefined)?.appid;
    if (typeof appId === 'number') return appId;
  }
  return null;
}

// Walks up the React fiber tree from a list row to the props that carry its app id.
export function findAppIdFromElement(el: Element): number | null {
  let fiber: FiberLike | null | undefined;
  try {
    fiber = getReactInstance(el) as FiberLike | null;
  } catch {
    return null;
  }
  for (let depth = 0; fiber && depth < MAX_FIBER_DEPTH; depth++, fiber = fiber.return) {
    const appId = fiber.memoizedProps ? appIdFromProps(fiber.memoizedProps) : null;
    if (appId !== null) return appId;
  }
  return null;
}
