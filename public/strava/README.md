# Official Strava brand assets

Drop the following files here to replace the CSS-only fallbacks:

| Filename | Source | Used by |
|----------|--------|---------|
| `wordmark-orange.svg` | https://developers.strava.com/guidelines/ → "Strava wordmark" (orange version, SVG preferred, PNG works too) | `<StravaWordmark variant="orange">` |
| `wordmark-white.svg` | Same page, white version | `<StravaWordmark variant="white">` |
| `btn_strava_connectwith_orange.png` | https://developers.strava.com/guidelines/ → "Connect With Strava buttons" (orange variant, 96px height recommended) | `<ConnectWithStravaButton>` |

Strava requires these specific assets, sizes and colors per their Brand Guidelines.
Do **not** modify the assets (no recoloring, no stretching, no overlaying).

If the files are missing, the components render a brand-compliant CSS/SVG
approximation (Strava orange #FC4C02 + correct wording), so the app keeps
working — but for the official Strava Developer Program submission, ship
the official assets.
