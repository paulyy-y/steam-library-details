import { describe, expect, it } from 'bun:test';
import { AchievementStore, fromAchievementResponse } from '../frontend/details/achievements';
import type { AchievementProgress, AppInfo, SteamProgressEntry } from '../frontend/details/types';

// Shape of SteamClient.Apps.GetMyAchievementsForApp results (fields per @steambrew/client typings).
const achievement = (bAchieved: boolean, i: number) => ({
  bAchieved,
  bHidden: false,
  flMinProgress: 0,
  flCurrentProgress: 0,
  flMaxProgress: 0,
  flAchieved: 12.5,
  rtUnlocked: bAchieved ? 1700000000 : 0,
  strDescription: `Achievement ${i}`,
  strID: `ACH_${i}`,
  strImage: '',
  strName: `Achievement ${i}`,
});

// Shaped like an entry in Steam's own cache (userdata/<account>/config/librarycache/achievement_progress.json)
const steamEntry: SteamProgressEntry = {
  appid: 400,
  unlocked: 3,
  total: 15,
  percentage: 20,
  all_unlocked: false,
  cache_time: 1716000000,
};

const played = (appId: number, lastPlayed = 1716000000): AppInfo => ({ appId, minutesPlayed: 120, lastPlayed, sizeOnDisk: 0 });

// Deferred promise so tests control when a fetch finishes.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(opts: { steam?: Record<number, SteamProgressEntry>; result?: AchievementProgress | null } = {}) {
  const calls: number[] = [];
  const updates: number[] = [];
  const pending = new Map<number, ReturnType<typeof deferred<AchievementProgress | null>>>();
  const store = new AchievementStore(
    (appId) => {
      calls.push(appId);
      const d = deferred<AchievementProgress | null>();
      pending.set(appId, d);
      return d.promise;
    },
    (appId) => opts.steam?.[appId] ?? null,
    (appId) => updates.push(appId),
    2,
  );
  const finish = async (appId: number, value: AchievementProgress | null) => {
    pending.get(appId)!.resolve(value);
    await flush();
  };
  return { store, calls, updates, finish };
}

describe('fromAchievementResponse', () => {
  it('counts unlocked achievements', () => {
    const response = { result: 1, data: { rgAchievements: [achievement(true, 1), achievement(false, 2), achievement(true, 3)] } };
    expect(fromAchievementResponse(response)).toEqual({ unlocked: 2, total: 3 });
  });

  it('treats an OK result with no achievements as 0 of 0', () => {
    expect(fromAchievementResponse({ result: 1, data: { rgAchievements: [] } })).toEqual({ unlocked: 0, total: 0 });
  });

  it('returns null for a failed result or a malformed response', () => {
    expect(fromAchievementResponse({ result: 2, data: { rgAchievements: [] } })).toBeNull();
    expect(fromAchievementResponse({ result: 1 })).toBeNull();
    expect(fromAchievementResponse(null)).toBeNull();
    expect(fromAchievementResponse('nope')).toBeNull();
  });
});

describe('AchievementStore.resolve', () => {
  it('does not fetch for a never-played game', () => {
    const { store, calls } = harness();
    expect(store.resolve({ appId: 5, minutesPlayed: 0, lastPlayed: 0, sizeOnDisk: 0 })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("uses Steam's progress cache when it is newer than the last play, without fetching", () => {
    const { store, calls } = harness({ steam: { 400: steamEntry } });
    expect(store.resolve(played(400, steamEntry.cache_time - 100))).toEqual({ unlocked: 3, total: 15 });
    expect(calls).toEqual([]);
  });

  it("shows Steam's older entry while fetching a fresh count after the game was played again", async () => {
    const { store, calls, updates, finish } = harness({ steam: { 400: steamEntry } });
    const info = played(400, steamEntry.cache_time + 100);
    expect(store.resolve(info)).toEqual({ unlocked: 3, total: 15 });
    expect(calls).toEqual([400]);
    await finish(400, { unlocked: 4, total: 15 });
    expect(updates).toEqual([400]);
    expect(store.resolve(info)).toEqual({ unlocked: 4, total: 15 });
    expect(calls).toEqual([400]);
  });

  it('fetches a played game it knows nothing about and caches it against the last-played time', async () => {
    const { store, calls, finish } = harness();
    const info = played(10);
    expect(store.resolve(info)).toBeNull();
    await finish(10, { unlocked: 2, total: 8 });
    expect(store.get(10)).toEqual({ unlocked: 2, total: 8, lastPlayed: info.lastPlayed });
    expect(store.resolve(info)).toEqual({ unlocked: 2, total: 8 });
    expect(calls).toEqual([10]);
  });

  it('refetches once the game has been played since the cached count', async () => {
    const { store, calls, finish } = harness();
    store.resolve(played(10, 1000));
    await finish(10, { unlocked: 2, total: 8 });
    expect(store.resolve(played(10, 2000))).toEqual({ unlocked: 2, total: 8 });
    expect(calls).toEqual([10, 10]);
  });

  it('does not cache or retry a failed fetch in the same session', async () => {
    const { store, calls, updates, finish } = harness();
    store.resolve(played(10));
    await finish(10, null);
    expect(store.get(10)).toBeUndefined();
    expect(updates).toEqual([]);
    store.resolve(played(10));
    expect(calls).toEqual([10]);
  });

  it('fetches each game once while a fetch is in flight', () => {
    const { store, calls } = harness();
    store.resolve(played(10));
    store.resolve(played(10));
    expect(calls).toEqual([10]);
  });

  it('runs at most two fetches at a time and works through the queue', async () => {
    const { store, calls, finish } = harness();
    for (const id of [1, 2, 3, 4, 5]) store.resolve(played(id));
    expect(calls).toEqual([1, 2]);
    await finish(1, { unlocked: 0, total: 1 });
    expect(calls).toEqual([1, 2, 3]);
    await finish(2, { unlocked: 0, total: 1 });
    await finish(3, { unlocked: 0, total: 1 });
    expect(calls).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('AchievementStore persistence', () => {
  it('round-trips cached counts through serialize and load', async () => {
    const a = harness();
    a.store.resolve(played(10, 1234));
    await a.finish(10, { unlocked: 2, total: 8 });

    const b = harness();
    b.store.load(a.store.serialize());
    expect(b.store.get(10)).toEqual({ unlocked: 2, total: 8, lastPlayed: 1234 });
    expect(b.store.resolve(played(10, 1234))).toEqual({ unlocked: 2, total: 8 });
    expect(b.calls).toEqual([]);
  });

  it('ignores a corrupt or empty saved cache', () => {
    const { store } = harness();
    expect(() => store.load('{not json')).not.toThrow();
    expect(() => store.load('')).not.toThrow();
    expect(store.get(10)).toBeUndefined();
  });
});
