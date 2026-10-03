import { describe, expect, it } from 'bun:test';
import { buildRowDetails, formatHours, formatLastPlayed, formatSize } from '../frontend/details/format';
import type { AppInfo, DetailToggles } from '../frontend/details/types';

const DAY = 86400;
const NOW = 1791000000; // 2026-10-03
const ALL_ON: DetailToggles = { showHours: true, showAchievements: true, showLastPlayed: true, showSize: true };
const GIB = 1024 ** 3;

// A played, uninstalled game: 7.4 hours, last played 22 Jul 2023 at noon UTC (same date in any US time zone).
const game: AppInfo = { appId: 1158310, minutesPlayed: 444, lastPlayed: 1690027200, sizeOnDisk: 0 };

describe('formatHours', () => {
  it('leaves zero playtime blank', () => {
    expect(formatHours(0)).toBe('');
  });

  it('shows minutes under an hour', () => {
    expect(formatHours(45)).toBe('45m');
    expect(formatHours(59)).toBe('59m');
  });

  it('shows one decimal under 100 hours, dropping .0', () => {
    expect(formatHours(60)).toBe('1h');
    expect(formatHours(444)).toBe('7.4h');
    expect(formatHours(2310)).toBe('38.5h');
    expect(formatHours(1500)).toBe('25h');
  });

  it('shows whole hours from 100 hours', () => {
    expect(formatHours(6720)).toBe('112h');
    expect(formatHours(24600)).toBe('410h');
  });
});

describe('formatLastPlayed', () => {
  it('leaves never-played blank', () => {
    expect(formatLastPlayed(0, NOW)).toBe('');
  });

  it('says today within the last day, including clock skew into the future', () => {
    expect(formatLastPlayed(NOW - 3600, NOW)).toBe('today');
    expect(formatLastPlayed(NOW + 60, NOW)).toBe('today');
  });

  it('uses days, then weeks, then months, then years', () => {
    expect(formatLastPlayed(NOW - 3 * DAY, NOW)).toBe('3d');
    expect(formatLastPlayed(NOW - 13 * DAY, NOW)).toBe('13d');
    expect(formatLastPlayed(NOW - 14 * DAY, NOW)).toBe('2w');
    expect(formatLastPlayed(NOW - 59 * DAY, NOW)).toBe('8w');
    expect(formatLastPlayed(NOW - 60 * DAY, NOW)).toBe('2mo');
    expect(formatLastPlayed(NOW - 364 * DAY, NOW)).toBe('12mo');
    expect(formatLastPlayed(NOW - 365 * DAY, NOW)).toBe('1y');
    expect(formatLastPlayed(game.lastPlayed, NOW)).toBe('3y');
  });
});

describe('formatSize', () => {
  it('leaves uninstalled (0 bytes) blank', () => {
    expect(formatSize(0)).toBe('');
  });

  it('shows whole MB under 1 GB, at least 1 MB', () => {
    expect(formatSize(996431544)).toBe('950 MB'); // 950.27 MB as Steam reports it
    expect(formatSize(300 * 1024)).toBe('1 MB');
  });

  it('shows one decimal GB under 100 GB, whole GB above', () => {
    expect(formatSize(18.17 * GIB)).toBe('18.2 GB');
    expect(formatSize(150 * GIB)).toBe('150 GB');
  });

  it('shows TB from 1024 GB', () => {
    expect(formatSize(1.5 * 1024 * GIB)).toBe('1.5 TB');
  });
});

describe('buildRowDetails', () => {
  it('builds every enabled column in order, blank where there is nothing', () => {
    expect(buildRowDetails(game, { unlocked: 7, total: 198 }, ALL_ON, NOW)).toEqual({
      columns: [
        { key: 'hours', text: '7.4h' },
        { key: 'achievements', text: '3%', complete: false },
        { key: 'lastPlayed', text: '3y' },
        { key: 'size', text: '' },
      ],
      tooltip: '7.4 hours played · 7 of 198 achievements (3%) · Last played Jul 22, 2023',
    });
  });

  it('marks a fully completed game and shows 100%', () => {
    const details = buildRowDetails(game, { unlocked: 56, total: 56 }, ALL_ON, NOW);
    expect(details.columns[1]).toEqual({ key: 'achievements', text: '100%', complete: true });
  });

  it('rounds achievement percentages down so 100% always means complete', () => {
    expect(buildRowDetails(game, { unlocked: 55, total: 56 }, ALL_ON, NOW).columns[1].text).toBe('98%');
    expect(buildRowDetails(game, { unlocked: 999, total: 1000 }, ALL_ON, NOW).columns[1].text).toBe('99%');
  });

  it('leaves achievements blank for a never-played game, a game without achievements, or no data yet', () => {
    const unplayed: AppInfo = { appId: 1, minutesPlayed: 0, lastPlayed: 0, sizeOnDisk: 0 };
    expect(buildRowDetails(unplayed, { unlocked: 0, total: 30 }, ALL_ON, NOW).columns[1].text).toBe('');
    expect(buildRowDetails(game, { unlocked: 0, total: 0 }, ALL_ON, NOW).columns[1].text).toBe('');
    expect(buildRowDetails(game, null, ALL_ON, NOW).columns[1].text).toBe('');
  });

  it('shows 0% for a played game with nothing unlocked', () => {
    expect(buildRowDetails(game, { unlocked: 0, total: 30 }, ALL_ON, NOW).columns[1].text).toBe('0%');
  });

  it('shows achievements unlocked without recorded playtime', () => {
    const noPlaytime: AppInfo = { ...game, minutesPlayed: 0 };
    expect(buildRowDetails(noPlaytime, { unlocked: 3, total: 30 }, ALL_ON, NOW).columns[1].text).toBe('10%');
  });

  it('shows size for installed games and describes short playtime in minutes', () => {
    const installed: AppInfo = { appId: 2, minutesPlayed: 45, lastPlayed: NOW - 3 * DAY, sizeOnDisk: 18.17 * GIB };
    const details = buildRowDetails(installed, null, ALL_ON, NOW);
    expect(details.columns.map((c) => c.text)).toEqual(['45m', '', '3d', '18.2 GB']);
    expect(details.tooltip).toStartWith('45 minutes played · Last played ');
    expect(details.tooltip).toEndWith(' · 18.2 GB on disk');
  });

  it('says "1 hour played" for exactly one hour', () => {
    const oneHour: AppInfo = { appId: 3, minutesPlayed: 60, lastPlayed: 0, sizeOnDisk: 0 };
    expect(buildRowDetails(oneHour, null, ALL_ON, NOW).tooltip).toBe('1 hour played');
  });

  it('leaves out turned-off columns and their tooltip parts', () => {
    const details = buildRowDetails(game, { unlocked: 7, total: 198 }, { ...ALL_ON, showHours: false, showLastPlayed: false }, NOW);
    expect(details.columns.map((c) => c.key)).toEqual(['achievements', 'size']);
    expect(details.tooltip).toBe('7 of 198 achievements (3%)');
  });

  it('returns no columns and no tooltip when everything is off', () => {
    const off: DetailToggles = { showHours: false, showAchievements: false, showLastPlayed: false, showSize: false };
    expect(buildRowDetails(game, { unlocked: 7, total: 198 }, off, NOW)).toEqual({ columns: [], tooltip: '' });
  });
});
