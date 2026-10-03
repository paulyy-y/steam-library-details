# Library Details

A [Millennium](https://steambrew.app/) plugin that shows small details in aligned columns at the
right of each game in the Steam library list (desktop):

| Column | Example | Source |
| --- | --- | --- |
| Hours played | `45m`, `6.4h`, `112h` | app overview `minutes_playtime_forever` |
| Achievements | `29%`, `100%` in gold | see below; rounded down, so 100% means everything unlocked |
| Last played | `today`, `5d`, `6w`, `10mo`, `1y` | app overview `rt_last_time_played` |
| Size on disk | `950 MB`, `85 GB` | app overview `size_on_disk` (installed games only) |

Empty values are left blank: never-played games, games without achievements, uninstalled games.
Hover the columns for the full numbers. Each column can be turned off in
Steam menu > Millennium Library Manager > Library Details.

## How it works

- Everything comes from the Steam client itself; there are no web requests.
- Rows are found through Steam's CSS module (`GameListEntryContainer`) and each row's app id is
  read from its React props. The list is virtualised, so a throttled `MutationObserver`
  decorates rows as they scroll into view.
- Achievement counts come from, in order: this plugin's cache (`achievements.json` in the plugin
  folder) when the game hasn't been played since; Steam's own achievement progress cache when it
  has the game and is newer; otherwise `SteamClient.Apps.GetMyAchievementsForApp`, two at a time,
  only for rows on screen and played games. A game is refetched only after it is played again.
- The Lua backend only stores settings and the achievement cache, and writes frontend
  diagnostics to `<Steam>/millennium/logs/steam-library-details_log.log`.

## Development

```bash
npm install
npm test              # bun tests for frontend/details
npm run typecheck
npm run build         # millennium-ttc -> .millennium/Dist
npm run deploy:dry    # show what deploy would copy
npm run deploy        # copy into <Steam>/millennium/plugins/steam-library-details
```

`deploy` uses `STEAM_PATH` or `C:\Program Files (x86)\Steam` and keeps the installed plugin's
`settings.json` and `achievements.json`. Frontend changes show after F5 in Steam; backend changes
need a Steam restart. Enable the plugin once in Millennium's plugin list.

The Lua backend and the DOM decoration have no automated tests; they are checked live in Steam.

## Credits

Row lookup is adapted from [protondb-library-badges](https://github.com/Yohlo/protondb-library-badges)
(MIT). See `NOTICE`.

## License

MIT, see `LICENSE`. Third-party code notices are in `NOTICE`.
