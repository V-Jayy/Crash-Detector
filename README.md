# Crash Detector

Crash Detector is a lightweight Electron app for reviewing Windows Event Viewer crashes. It focuses on game crashes, app hangs, blue screens, driver resets, disk warnings, hardware-adjacent events, and the nearby evidence that helps explain what probably happened.

The app is data-driven: supported games, crash signatures, Windows event explanations, and follow-up checks live in JSON knowledge packs instead of being buried in app logic.

Community and research credit: https://discord.gg/lumin

## Features

- Scan Windows Application and System logs.
- Automatically scan the last 30 days on launch.
- Group related crash events into readable signatures.
- Show evidence, likely meaning, follow-up checks, and raw Event Viewer messages.
- Detect supported installed games from Steam, Epic, and common local markers.
- Pick a specific `.exe` and scan for crashes matching that process.
- Export the current report as JSON or TXT.
- Extend game and crash knowledge through documented JSON files.
- Include checks for Display 4101, Disk 7/51, WHEA-Logger 18, Kernel-Power 41, EventLog 6008, BugCheck 1001, Windows Error Reporting, .NET Runtime, and service failures.

## Requirements

- Windows 10 or Windows 11 for live Event Viewer scanning.
- Node.js 20 or newer.
- npm.

## Download

Download the latest release from:

https://github.com/V-Jayy/Crash-Detector/releases

If a packaged build is not attached yet, download the source archive from the release page and run it locally with the commands below.

## Run From Source

```powershell
git clone https://github.com/V-Jayy/Crash-Detector.git
cd Crash-Detector
npm install
npm start
```

To validate the project without launching Electron:

```powershell
npm run check
```

`npm run check` validates JavaScript syntax across the Electron main process, preload bridge, renderer, and shared analyzer modules.

## How Data Works

Crash Detector loads two knowledge packs at runtime:

```text
data/games.json              Game detection, executable names, modules, and game-specific crash hints
data/crash-signatures.json   Windows event definitions, exception codes, bug checks, and module heuristics
```

Because these files are regular JSON, adding support for a new game or crash code usually does not require changing JavaScript.

## Add Game Data

Edit `data/games.json` and add an entry under `games`.

```json
{
  "id": "example-game",
  "displayName": "Example Game",
  "launcher": "Steam",
  "steamAppId": "123",
  "processNames": ["Example.exe"],
  "installMarkers": ["Example.exe"],
  "knownModules": ["EasyAntiCheat"],
  "knownCrashes": [
    {
      "id": "example-eac",
      "title": "Example crash involving Easy Anti-Cheat",
      "faultingModuleContains": "EasyAntiCheat",
      "category": "anticheat",
      "explanation": "Explain what this signature means and why this module matters.",
      "evidence": ["Faulting module contains EasyAntiCheat."],
      "checks": ["Repair anti-cheat.", "Reboot and relaunch cleanly."]
    }
  ],
  "commonCauses": ["Anti-cheat service issue", "Overlay conflict"],
  "sources": ["https://example.com/support"]
}
```

Good game data should include:

- Exact executable names as they appear in Event Viewer.
- Launcher or store details.
- Install markers that can be found locally.
- Official support, store, launcher, or vendor source links.
- Narrow explanations for known signatures.

## Add Crash Signature Data

Edit `data/crash-signatures.json` for Windows-wide knowledge:

- `eventDefinitions`: Event Viewer provider and Event ID explanations.
- `exceptionCodes`: app crash codes such as `0xc0000005`.
- `bugChecks`: blue screen stop codes such as `0x00000116`.
- `moduleHeuristics`: module-name fragments such as GPU drivers or anti-cheat components.
- `sources`: reusable source IDs and links.

Prefer primary sources, especially Microsoft Learn for Windows events, NTSTATUS values, and bug checks. Keep links in `sources` so future maintainers can audit why a rule exists.

## Research Standard

Crash advice gets noisy fast, so this project keeps claims narrow:

- Do credit official docs, store pages, vendor support pages, and community research from https://discord.gg/lumin.
- Do explain what evidence caused a match.
- Do recommend follow-up checks before broad reinstall advice.
- Do not treat generic modules such as `KERNELBASE.dll` or `ntdll.dll` as root causes by themselves.
- Do not add unsourced folklore as a high-confidence rule.

More detail lives in `docs/crash-knowledge.md`.

## Project Layout

```text
src/main/          Electron main process, PowerShell Event Viewer bridge, exports
src/renderer/      App UI
src/shared/        Parsers, analyzer, grouping, game detection, formatters
data/              JSON knowledge packs
docs/              Crash knowledge and legacy port notes
```

## Release Notes

See `CHANGELOG.md`.

## Limitations

- Event Viewer messages vary by Windows language and provider version.
- The analyzer is heuristic. It explains likely paths; it is not a substitute for WinDbg dump analysis.
- Store and Xbox app detection is intentionally conservative. The app can still scan by picked executable or process name.
- The app reads local Event Viewer data and should not upload reports anywhere.

## Credits

Built for the Lumin community. Research, support, and future data contributions are credited to https://discord.gg/lumin.

## License

MIT. See `LICENSE`.
