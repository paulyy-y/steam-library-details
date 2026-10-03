// Row scanning adapted from Yohlo/protondb-library-badges (MIT). See NOTICE.
import { AchievementStore } from '../details/achievements';
import { buildRowDetails } from '../details/format';
import type { RowDetails } from '../details/types';
import { classModuleFinder, findAppIdFromElement, getAppInfo, isSteamApp } from '../lib/steam';
import { log } from '../services/backend';
import { getSettings, subscribeSettings } from '../services/settings';
import { columnsCss, injectStyles, removeStyles } from './styles';

const COLS_CLASS = 'ld-cols';
const SIGNATURE_ATTR = 'data-ld-sig';
const SCAN_THROTTLE_MS = 150;

const rowClasses = classModuleFinder('GameListEntryContainer', 'GameListEntryName');

function render(cols: HTMLElement, details: RowDetails): void {
  const signature = JSON.stringify(details);
  if (cols.getAttribute(SIGNATURE_ATTR) === signature) return;
  cols.setAttribute(SIGNATURE_ATTR, signature);
  cols.title = details.tooltip;
  cols.replaceChildren(
    ...details.columns.map((column) => {
      const span = cols.ownerDocument.createElement('span');
      span.className = `ld-${column.key}` + (column.complete ? ' ld-complete' : '');
      span.textContent = column.text;
      return span;
    }),
  );
}

function decorateRow(row: HTMLElement, store: AchievementStore, now: number): void {
  const settings = getSettings();
  const appId = findAppIdFromElement(row);
  const info = appId !== null ? getAppInfo(appId) : null;
  let cols = row.querySelector<HTMLElement>(`:scope > .${COLS_CLASS}`);
  if (!info) {
    cols?.remove();
    return;
  }
  if (!cols) {
    cols = row.ownerDocument.createElement('span');
    cols.className = COLS_CLASS;
    row.appendChild(cols);
  }
  const achievements = isSteamApp(info.appId) ? store.resolve(info) : null;
  render(cols, buildRowDetails(info, achievements, settings, now));
}

// Keeps the visible rows of the (virtualised) game list decorated. Returns a teardown.
export function initListDetails(doc: Document, store: AchievementStore): { rescan: () => void; stop: () => void } {
  let loggedFound = false;

  const scan = () => {
    const c = rowClasses();
    if (!c) return;
    const s = getSettings();
    const anyOn = s.showHours || s.showAchievements || s.showLastPlayed || s.showSize;
    const rows = doc.querySelectorAll<HTMLElement>('.' + c.GameListEntryContainer);
    if (!anyOn) {
      doc.querySelectorAll('.' + COLS_CLASS).forEach((el) => el.remove());
      return;
    }
    injectStyles(doc, columnsCss(c.GameListEntryContainer, c.GameListEntryName));
    if (!loggedFound && rows.length > 0) {
      loggedFound = true;
      log(`Found ${rows.length} list rows`);
    }
    const now = Math.floor(Date.now() / 1000);
    rows.forEach((row) => {
      try {
        decorateRow(row, store, now);
      } catch (e) {
        log('Row decoration failed:', String(e));
      }
    });
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduled = () => {
    timer ??= setTimeout(() => {
      timer = null;
      scan();
    }, SCAN_THROTTLE_MS);
  };

  const observer = new MutationObserver(scheduled);
  observer.observe(doc.body, { childList: true, subtree: true });
  const stopSettings = subscribeSettings(scheduled);
  scan();

  return {
    rescan: scheduled,
    stop: () => {
      observer.disconnect();
      stopSettings();
      if (timer) clearTimeout(timer);
      doc.querySelectorAll('.' + COLS_CLASS).forEach((el) => el.remove());
      removeStyles(doc);
    },
  };
}
