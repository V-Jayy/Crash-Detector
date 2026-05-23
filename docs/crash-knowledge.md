# Crash Knowledge Base

Crash Detector uses JSON knowledge packs instead of hard coded app logic. This file explains the current shape and the research standard for adding more.

## Windows Events

The app scans these by default:

| Log | Provider | Event ID | Why it matters |
| --- | --- | --- | --- |
| Application | Application Error | 1000 | Process crash with faulting app, module, exception code, and offset. |
| Application | Application Hang | 1002 | App stopped responding. |
| Application | Windows Error Reporting | 1001 | WER crash or hang bucket, often paired with 1000/1002. |
| Application | .NET Runtime | 1026 | Unhandled managed exception. |
| System | BugCheck | 1001 | Blue screen stop code. |
| System | Microsoft-Windows-WER-SystemErrorReporting | 1001 | System crash reporting after a stop error. |
| System | Microsoft-Windows-Kernel-Power | 41 | Boot after unclean shutdown or reboot. |
| System | EventLog | 6008 | Previous shutdown was unexpected. |
| System | Display | 4101 | Display driver stopped responding and recovered. |
| System | Disk | 7, 51 | Bad block or IO warning near crash time. |
| System | WHEA-Logger | 18 | Fatal hardware error report. |
| System | Service Control Manager | 7000, 7001, 7031, 7034 | Service startup or crash failures, useful around anti-cheat and launcher problems. |

## Exception Codes

Current documented NTSTATUS-style codes. These should explain what Windows caught, not pretend the code alone identifies the root cause.

| Code | Meaning | Analyzer category |
| --- | --- | --- |
| `0xc0000005` | Access violation | Access violation |
| `0xc0000374` | Heap corruption | Corrupt files / memory state |
| `0xc0000409` | Stack buffer overrun | Application bug |
| `0xc000001d` | Illegal instruction | Application bug / CPU compatibility |
| `0xe0434352` | .NET CLR exception marker | .NET runtime |
| `0xc00000fd` | Stack overflow | Application bug |
| `0x80000003` | Breakpoint | Application bug / anti-tamper context |
| `0xc0000135` | DLL not found | Windows runtime |
| `0xc0000142` | DLL initialization failed | Windows runtime |
| `0xc000007b` | Invalid image format | Windows runtime |

## Bug Checks

Current blue screen codes:

| Code | Name | Analyzer category |
| --- | --- | --- |
| `0x00000116` | VIDEO_TDR_FAILURE | GPU driver |
| `0x00000050` | PAGE_FAULT_IN_NONPAGED_AREA | System driver |
| `0x0000007e` | SYSTEM_THREAD_EXCEPTION_NOT_HANDLED | System driver |
| `0x0000001a` | MEMORY_MANAGEMENT | Memory |
| `0x000000ef` | CRITICAL_PROCESS_DIED | System driver |
| `0x00000124` | WHEA_UNCORRECTABLE_ERROR | Hardware |
| `0x00000133` | DPC_WATCHDOG_VIOLATION | System driver |
| `0x00000119` | VIDEO_SCHEDULER_INTERNAL_ERROR | GPU driver |
| `0x0000009f` | DRIVER_POWER_STATE_FAILURE | System driver |
| `0x0000003b` | SYSTEM_SERVICE_EXCEPTION | System driver |

## Game Research Coverage

The current game pack covers 19 games and every game now has at least one narrow `knownCrashes` entry. These entries are intentionally evidence-based: they match a process plus a module or message fragment, then explain what that specific signature means.

High-value patterns covered now include:

- Riot Vanguard for VALORANT and League of Legends.
- Easy Anti-Cheat for Fortnite, Apex Legends, and THE FINALS.
- BattlEye context for Destiny 2, PUBG, and Rainbow Six Siege.
- GameGuard context for HELLDIVERS 2.
- Source 2 module crashes for Counter-Strike 2 and Dota 2.
- Epic Online Services / Rockstar Social Club launcher paths.
- Minecraft Java LWJGL/OpenGL and Minecraft for Windows Store/Xbox package paths.
- Roblox graphics, blocked-image, and client-integrity paths.
- Graphics-driver paths for high-load DirectX titles such as Call of Duty, Overwatch 2, and HELLDIVERS 2.

## Adding Knowledge

Use [data/crash-signatures.json](../data/crash-signatures.json) for Windows-wide knowledge and [data/games.json](../data/games.json) for game knowledge.

Good additions include:

- A source link from Microsoft Learn, official support docs, a game store page, or vendor documentation.
- The exact process name or module name.
- A clear explanation of what the signature means.
- Follow up checks that gather evidence before asking the user to reinstall everything.

Avoid:

- Unsourced crash-code folklore.
- Broad advice such as "update drivers" as the only recommendation.
- Claiming a game-specific root cause from a generic `KERNELBASE.dll` or `ntdll.dll` event.

## Ported Behavior

The old C# app had these concepts:

- `WindowsEventLogScanner` became the PowerShell bridge in `src/main/main.js`.
- `EventMessageParser` became `src/shared/event-parser.js`.
- `CrashAnalyzer` became `src/shared/analyzer.js` plus the JSON knowledge packs.
- `SignatureCrashGrouper` became `src/shared/grouper.js`.
- `JsonReportFormatter` and console output became JSON/TXT exports in `src/shared/formatters.js`.
- The WPF view model state moved into `src/renderer/app.js`.

## Sources

- Microsoft Application Error troubleshooting: https://learn.microsoft.com/en-us/troubleshoot/windows-server/performance/troubleshoot-application-service-crashing-behavior
- Microsoft Kernel-Power Event ID 41: https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/event-id-41-restart
- Microsoft unexpected reboot event log guidance: https://learn.microsoft.com/en-us/troubleshoot/windows-server/performance/troubleshoot-unexpected-reboots-system-event-logs
- Microsoft Bug Check 0x116 VIDEO_TDR_FAILURE: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x116---video-tdr-failure
- Microsoft Bug Check 0x119 VIDEO_SCHEDULER_INTERNAL_ERROR: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x119---video-scheduler-internal-error
- Microsoft Bug Check 0x124 WHEA_UNCORRECTABLE_ERROR: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x124---whea-uncorrectable-error
- Microsoft Bug Check 0x133 DPC_WATCHDOG_VIOLATION: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x133-dpc-watchdog-violation
- Microsoft Bug Check 0x9F DRIVER_POWER_STATE_FAILURE: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x9f--driver-power-state-failure
- Microsoft Bug Check 0x3B SYSTEM_SERVICE_EXCEPTION: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x3b--system-service-exception
- Microsoft Bug Check reference: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-checks--blue-screens-
- Microsoft MS-ERREF NTSTATUS reference: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-erref/596a1078-e883-4972-9bbc-49e60bebca55
- Riot Vanguard for League of Legends: https://support-leagueoflegends.riotgames.com/hc/en-us/articles/24169857932435-Riot-Vanguard-League-of-Legends
- VALORANT Vanguard Windows 11 requirements: https://support-valorant.riotgames.com/hc/en-us/articles/10088435639571-Troubleshooting-the-VAN9001-or-VAN-9003-Error-on-Windows-11-VALORANT
- BattlEye FAQ: https://www.battleye.org/support/faq/
- Bungie BattlEye guide: https://help.bungie.net/hc/en-us/articles/4404072197140-BattlEye-Anti-Cheat-Support-Guide
- Roblox graphics troubleshooting: https://en.help.roblox.com/hc/en-us/articles/203312790-Graphics-Problems-on-Computers
- Roblox anti-cheat messages: https://en.help.roblox.com/hc/en-us/articles/24275616578708-Anti-cheat-Messages
- Minecraft Java mods: https://help.minecraft.net/hc/en-us/articles/4409139065613-Mods-for-Minecraft-Java-Edition
- Minecraft Java memory allocation: https://help.minecraft.net/hc/en-us/articles/39083573916941
- Minecraft Java graphics troubleshooting: https://help.minecraft.net/hc/en-us/articles/4409137348877-Minecraft-Java-Edition-Game-Crashes-and-Performance-Issues-FAQ
- Rockstar GTA V ERR_GFX_STATE support: https://support.rockstargames.com/articles/2vEOZW3tzshakakcwRvakg/grand-theft-auto-v-on-pc-crashing-with-err_gfx_state-error
