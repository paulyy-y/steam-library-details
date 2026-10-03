import type { AchievementProgress, AppInfo, DetailColumn, DetailToggles, RowDetails } from './types';

const DAY = 86400;
const MB = 1024 ** 2;
const GB = 1024 ** 3;
const TB = 1024 ** 4;

// Up to one decimal, without a trailing ".0".
const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

export function formatHours(minutes: number): string {
  if (!(minutes > 0)) return '';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return hours < 100 ? `${oneDecimal(hours)}h` : `${Math.round(hours)}h`;
}

export function formatLastPlayed(lastPlayed: number, now: number): string {
  if (!(lastPlayed > 0)) return '';
  const days = Math.floor((now - lastPlayed) / DAY);
  if (days < 1) return 'today';
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

// 1024-based, as Steam reports sizes.
export function formatSize(bytes: number): string {
  if (!(bytes > 0)) return '';
  if (bytes < GB) return `${Math.max(1, Math.round(bytes / MB))} MB`;
  if (bytes < 100 * GB) return `${oneDecimal(bytes / GB)} GB`;
  if (bytes < TB) return `${Math.round(bytes / GB)} GB`;
  return `${oneDecimal(bytes / TB)} TB`;
}

// Rounded down so 100% only ever means every achievement is unlocked.
const achievementPercent = (a: AchievementProgress) => Math.floor((a.unlocked / a.total) * 100);

function showsAchievements(info: AppInfo, a: AchievementProgress | null): a is AchievementProgress {
  if (!a || !(a.total > 0)) return false;
  // A never-played game is blank rather than 0%.
  return a.unlocked > 0 || info.minutesPlayed > 0;
}

function hoursTooltip(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes played`;
  const hours = oneDecimal(minutes / 60);
  return hours === '1' ? '1 hour played' : `${hours} hours played`;
}

const formatDate = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function buildRowDetails(
  info: AppInfo,
  achievements: AchievementProgress | null,
  toggles: DetailToggles,
  now: number,
): RowDetails {
  const columns: DetailColumn[] = [];
  const tips: string[] = [];

  if (toggles.showHours) {
    columns.push({ key: 'hours', text: formatHours(info.minutesPlayed) });
    if (info.minutesPlayed > 0) tips.push(hoursTooltip(info.minutesPlayed));
  }

  if (toggles.showAchievements) {
    if (showsAchievements(info, achievements)) {
      const complete = achievements.unlocked >= achievements.total;
      const percent = complete ? 100 : achievementPercent(achievements);
      columns.push({ key: 'achievements', text: `${percent}%`, complete });
      tips.push(`${achievements.unlocked} of ${achievements.total} achievements (${percent}%)`);
    } else {
      columns.push({ key: 'achievements', text: '', complete: false });
    }
  }

  if (toggles.showLastPlayed) {
    columns.push({ key: 'lastPlayed', text: formatLastPlayed(info.lastPlayed, now) });
    if (info.lastPlayed > 0) tips.push(`Last played ${formatDate(info.lastPlayed)}`);
  }

  if (toggles.showSize) {
    const size = formatSize(info.sizeOnDisk);
    columns.push({ key: 'size', text: size });
    if (size) tips.push(`${size} on disk`);
  }

  return { columns, tooltip: tips.join(' · ') };
}
