# Contributing

Thanks for helping improve Crash Detector. The most useful contributions are well-sourced data additions, clearer crash explanations, and fixes that make Windows Event Viewer parsing more reliable.

## Local Setup

```powershell
npm install
npm run check
npm start
```

Live scans require Windows because the app reads Windows Event Viewer through PowerShell.

## Adding Game Data

Add games to `data/games.json`. Keep entries data-only so the analyzer can learn new games without code changes.

Each game should include:

- `id`: stable lowercase slug.
- `displayName`: user-facing game name.
- `launcher`: launcher or store.
- `processNames`: executable names from Event Viewer.
- `installMarkers`: filenames or paths that help local detection.
- `knownModules`: crash modules worth matching.
- `knownCrashes`: only when there is a specific, explainable signature.
- `sources`: official support, store, launcher, or vendor links.

Prefer official sources. If a rule is based on observed behavior, make that clear in the explanation and keep the claim narrow.

## Adding Crash Signatures

Add Windows-wide signatures to `data/crash-signatures.json`.

Good crash knowledge includes:

- A specific event provider, Event ID, exception code, bug check, or module fragment.
- A practical explanation written for a Windows gaming user.
- Evidence bullets that explain why the rule matched.
- Follow-up checks that gather more evidence before asking users to reinstall everything.
- Source links, especially Microsoft Learn for Windows events and NTSTATUS or bug check values.

Avoid broad, unsourced advice. `KERNELBASE.dll` and `ntdll.dll` are common final reporting modules and should not be treated as root causes by themselves.

## Pull Request Checklist

- Run `npm run check`.
- Keep generated folders such as `node_modules`, `dist`, and `out` out of commits.
- Update `README.md` or `docs/crash-knowledge.md` when changing user-visible behavior or data formats.
- Credit community-sourced research when it comes from the Lumin Discord.
