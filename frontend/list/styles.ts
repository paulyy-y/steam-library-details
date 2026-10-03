// Fixed-width, right-aligned columns at the end of each library list row.
export const columnsCss = (rowClass: string, nameClass: string) => `
.${rowClass} > .${nameClass} {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}

.${rowClass} > .ld-cols {
  display: flex;
  flex: 0 0 auto;
  margin-left: auto;
  padding: 0 6px 0 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #8b929a;
  white-space: nowrap;
  pointer-events: auto;
}

.${rowClass} > .ld-cols > span { text-align: right; }
.${rowClass} > .ld-cols > .ld-hours { width: 40px; }
.${rowClass} > .ld-cols > .ld-achievements { width: 36px; }
.${rowClass} > .ld-cols > .ld-lastPlayed { width: 40px; }
.${rowClass} > .ld-cols > .ld-size { width: 54px; }
.${rowClass} > .ld-cols > .ld-complete { color: #e5b143; font-weight: bold; }
`;

export const STYLE_ID = 'steam-library-details-styles';

export function injectStyles(doc: Document, css: string): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}

export function removeStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
