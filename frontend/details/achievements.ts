import type { AchievementProgress, AppInfo, CachedAchievements, SteamProgressEntry } from './types';

export type AchievementFetcher = (appId: number) => Promise<AchievementProgress | null>;
export type ProgressLookup = (appId: number) => SteamProgressEntry | null;

const K_ERESULT_OK = 1;

// SteamClient.Apps.GetMyAchievementsForApp -> { result, data: { rgAchievements: [{ bAchieved, ... }] } }
export function fromAchievementResponse(response: unknown): AchievementProgress | null {
  const r = response as { result?: unknown; data?: { rgAchievements?: unknown } } | null;
  if (!r || typeof r !== 'object' || r.result !== K_ERESULT_OK) return null;
  const list = r.data?.rgAchievements;
  if (!Array.isArray(list)) return null;
  return { unlocked: list.filter((a) => a?.bAchieved === true).length, total: list.length };
}

const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Achievement counts per game, from (in order): our cache when the game hasn't been
 * played since, Steam's own progress cache when it is newer than the last play, or a
 * fetch from Steam. Stale values are shown while a fetch runs; onUpdate fires when
 * a fetch brings a new count.
 */
export class AchievementStore {
  private cache = new Map<number, CachedAchievements>();
  private queue: AppInfo[] = [];
  private inFlight = new Set<number>();
  private queued = new Set<number>();
  private failed = new Set<number>();

  constructor(
    private readonly fetcher: AchievementFetcher,
    private readonly steamProgress: ProgressLookup,
    private readonly onUpdate: (appId: number) => void,
    private readonly concurrency = 2,
  ) {}

  get(appId: number): CachedAchievements | undefined {
    return this.cache.get(appId);
  }

  resolve(info: AppInfo): AchievementProgress | null {
    const own = this.cache.get(info.appId);
    if (own && own.lastPlayed === info.lastPlayed) return { unlocked: own.unlocked, total: own.total };

    const steam = this.steamProgress(info.appId);
    const steamValue = steam && isCount(steam.unlocked) && isCount(steam.total) ? { unlocked: steam.unlocked, total: steam.total } : null;
    if (steam && steamValue && steam.cache_time >= info.lastPlayed) return steamValue;

    if (info.minutesPlayed > 0) this.enqueue(info);
    if (own) return { unlocked: own.unlocked, total: own.total };
    return steamValue;
  }

  load(json: string): void {
    this.cache.clear();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    for (const [key, value] of Object.entries(parsed as Record<string, any>)) {
      const appId = Number(key);
      if (Number.isInteger(appId) && value && isCount(value.unlocked) && isCount(value.total) && isCount(value.lastPlayed)) {
        this.cache.set(appId, { unlocked: value.unlocked, total: value.total, lastPlayed: value.lastPlayed });
      }
    }
  }

  serialize(): string {
    return JSON.stringify(Object.fromEntries(this.cache));
  }

  private enqueue(info: AppInfo): void {
    const id = info.appId;
    if (this.inFlight.has(id) || this.queued.has(id) || this.failed.has(id)) return;
    this.queued.add(id);
    this.queue.push(info);
    this.pump();
  }

  private pump(): void {
    while (this.inFlight.size < this.concurrency && this.queue.length > 0) {
      const info = this.queue.shift()!;
      this.queued.delete(info.appId);
      this.inFlight.add(info.appId);
      this.run(info);
    }
  }

  private async run(info: AppInfo): Promise<void> {
    let result: AchievementProgress | null = null;
    try {
      result = await this.fetcher(info.appId);
    } catch {
      result = null;
    }
    this.inFlight.delete(info.appId);
    if (result) {
      this.cache.set(info.appId, { ...result, lastPlayed: info.lastPlayed });
      this.onUpdate(info.appId);
    } else {
      this.failed.add(info.appId);
    }
    this.pump();
  }
}
