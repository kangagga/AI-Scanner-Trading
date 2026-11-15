# AI SCANNER TRADING — Control Center Plan (updated to the latest instruction)

## Audit findings
- Current `/workspace` contains the active Node project and dependencies; search found no separate legacy scanner source, old trading database, or bot API contract. The earlier generated engine files belong to this current workspace and are not evidence of your existing bot.
- No files from outside `/workspace` have been inspected. Please provide the old bot's source/repository path and API details for a real integration; I will not guess them or modify legacy data.
- Android SDK/Gradle are unavailable in this environment. I will deliver a mobile-first installable PWA/control-center source and document the Capacitor/Android build path; I will not claim an APK was built.

## Scope and safety
- Frontend/control center only: **no scanner engine, no strategy modifications, no replacement trading database, no simulated bot control**.
- Existing bot remains authoritative. REST and WebSocket adapter calls are configurable; dashboard shows DEMO/OFFLINE status when unavailable.
- PAPER TRADING remains a display-only safety indicator (`true`); BITGET_MIRROR is `false`; no live order path is added.
- Keep the previous generated files on disk; do not delete them or touch any legacy project.

## Implementation stages
1. Inspect current app files, then preserve but stop relying on the generated engine. Define a frontend-facing API client for health/status, scanner signals, market, paper positions, trade history, performance, strategy settings, logs, and START/STOP/RESTART/REFRESH. Control actions only report success if the configured backend confirms them.
2. Build responsive premium dark control-center screens for Dashboard, Live Scanner, AI Signals, Market Overview, Paper Trading, Trade History, Performance, Strategy Settings, System Monitor, and Settings. Demo fixtures are clearly labeled, actions remain unavailable in demo mode, and charts use only explicit demo values or real backend responses.
3. Add live REST/WebSocket connection status, configurable backend URL/token, request/error states, reconnect behavior, and a documented adapter contract that can sit in front of the old bot or move to cloud without changing the app.
4. Add PWA install assets and documentation: app structure, API contract, run/build steps, Capacitor APK path, verified vs demo features, and exact legacy source/API details needed to integrate.
5. Start the development server, run preview checks, fix runtime issues, and report honestly that APK generation and legacy integration require unavailable SDK/source details.

No new trading database, scanner, strategy engine, or bot behavior will be implemented.