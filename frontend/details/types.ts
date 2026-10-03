// What the list needs from Steam's app overview for one game.
export interface AppInfo {
  appId: number;
  minutesPlayed: number;
  lastPlayed: number; // unix seconds, 0 = never
  sizeOnDisk: number; // bytes, 0 = not installed
}

export interface AchievementProgress {
  unlocked: number;
  total: number;
}

// Our cached result, tagged with the game's last-played time when it was fetched:
// playing the game again changes lastPlayed and triggers a refetch.
export interface CachedAchievements extends AchievementProgress {
  lastPlayed: number;
}

// An entry from Steam's own achievement progress cache.
export interface SteamProgressEntry {
  appid: number;
  unlocked: number;
  total: number;
  percentage?: number;
  all_unlocked?: boolean;
  cache_time: number; // unix seconds
}

export interface DetailToggles {
  showHours: boolean;
  showAchievements: boolean;
  showLastPlayed: boolean;
  showSize: boolean;
}

export type DetailKey = 'hours' | 'achievements' | 'lastPlayed' | 'size';

export interface DetailColumn {
  key: DetailKey;
  text: string; // '' = leave blank
  complete?: boolean; // achievements: every achievement unlocked
}

export interface RowDetails {
  columns: DetailColumn[];
  tooltip: string;
}
