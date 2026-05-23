const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const exceptionExplanations = {
  "0xc0000005": "The process tried to use memory it did not own. The faulting module shows where the bad access happened.",
  "0xc0000374": "Windows found corrupted heap memory in this process. Something damaged memory before the crash was logged.",
  "0xc0000409": "Windows stopped the process because stack memory was corrupted. Invalid code or a broken module likely ran inside the app.",
  "0xc000001d": "The CPU hit an instruction it could not run. That can mean bad code in memory, a broken module, or a CPU feature mismatch.",
  "0xe0434352": "A .NET app threw an unhandled managed exception. The Application Error marks the exit, while the managed details live in the .NET Runtime event.",
  "0xc00000fd": "This process ran out of thread stack space. That often means broken scripts, plugins, or a runaway loop inside the app.",
  "0x80000003": "The process hit a breakpoint exception. Debug tools, anti-tamper code, or a failed internal check can trigger this.",
  "0xc0000135": "The process could not load a required DLL. The missing name in the event message is the important detail.",
  "0xc0000142": "A DLL loaded but failed during startup. The faulting module usually points to the dependency that failed to initialize.",
  "0xc000007b": "Windows tried to load a broken or mismatched binary image. This is a dependency format problem, not a gameplay crash."
};

const bugCheckExplanations = {
  "0x00000116": "The GPU stopped responding and Windows could not recover the display stack. This is a graphics driver or GPU stability failure.",
  "0x00000050": "Kernel code touched invalid memory that should have been resident. A driver, RAM, storage, or filter driver is usually involved.",
  "0x0000007e": "A kernel system thread threw an unhandled exception. This usually points to a kernel driver named in the dump.",
  "0x0000001a": "Windows detected memory manager corruption. RAM instability or bad memory management is the likely cause.",
  "0x000000ef": "A process Windows treats as critical died. This is broader than a single game crash and can involve storage, drivers, or system files.",
  "0x00000124": "Windows received an uncorrectable hardware error through WHEA. CPU, RAM, PCIe, GPU, storage, or power delivery can be involved.",
  "0x00000133": "Windows detected stalled interrupt or DPC processing. A storage, network, USB, audio, GPU, or chipset driver is often involved.",
  "0x00000119": "The Windows video scheduler hit a fatal error. This is a graphics stack failure, not a generic app crash.",
  "0x0000009f": "A driver got stuck during a power transition. Sleep, wake, USB, network, storage, Bluetooth, or GPU power paths are common sources.",
  "0x0000003b": "An exception happened while Windows was running a kernel service routine. The named driver in the dump is the key detail."
};

const moduleExplanations = {
  nvwgf2um: "The NVIDIA user-mode graphics driver was active when the process crashed.",
  nvoglv: "The NVIDIA OpenGL driver was active when the process crashed.",
  nvlddmkm: "The NVIDIA kernel display driver was involved in this failure.",
  amdxx64: "An AMD DirectX user-mode driver was active when the process crashed.",
  atidxx64: "An AMD DirectX driver module faulted during this crash.",
  atio6axx: "An AMD OpenGL driver module was active when the process crashed.",
  igdkmd: "An Intel graphics kernel driver was involved in this failure.",
  igc: "An Intel graphics compiler or runtime module appears in this crash signature.",
  d3d11: "The Direct3D 11 runtime was active when the process crashed.",
  dxgi: "DXGI was active during this crash. Swap chain, adapter, or presentation code was on the stack.",
  d3d12: "The Direct3D 12 runtime was active when the process crashed.",
  dxgmms2: "The DirectX graphics memory manager was involved in this failure.",
  "watchdog.sys": "The Windows watchdog driver was involved, often with a video scheduler or TDR failure.",
  EasyAntiCheat: "Easy Anti-Cheat code was running when the process crashed.",
  BEService: "BattlEye service code was running when the process crashed.",
  BEClient: "BattlEye client code was running when the process crashed.",
  BEDaisy: "BattlEye kernel driver code was involved in this failure.",
  EAAntiCheat: "EA AntiCheat code was running when the process crashed.",
  GameGuard: "GameGuard anti-cheat code was running when the process crashed.",
  "vgk.sys": "Riot Vanguard kernel driver code was involved in this failure.",
  "vgc.exe": "Riot Vanguard user-mode service code was running when the process crashed.",
  ucrtbase: "The Universal C Runtime was on the crash stack. The app may have already been in a bad state before this call.",
  VCRUNTIME: "A Visual C++ runtime DLL was on the crash stack. The app may have already been in a bad state before this call.",
  EOSSDK: "Epic Online Services SDK code was running when the process crashed.",
  lwjgl: "LWJGL native bridge code was active when the Java process crashed.",
  OpenAL: "OpenAL audio code was active when the process crashed.",
  UnityPlayer: "Unity engine code was active when the process crashed.",
  Unreal: "Unreal Engine code was active when the process crashed.",
  KERNELBASE: "KERNELBASE is a common final reporting module. It is rarely the root cause by itself.",
  ntdll: "ntdll is deep Windows user-mode runtime code. It often appears at the end of a failure chain."
};

const gameCrashExplanations = {
  "fortnite-eac-module": "Fortnite crashed while Easy Anti-Cheat code was active. The failure happened in the anti-cheat layer, not ordinary rendering.",
  "valorant-vanguard": "VALORANT crashed while Riot Vanguard code was active. The failure happened in the Vanguard service or driver path.",
  "league-vanguard": "League crashed while Riot Vanguard code was active. The failure happened in the Vanguard service or driver path.",
  "apex-anticheat": "Apex crashed while anti-cheat code was active. The failure happened during protection or launch, not ordinary match rendering.",
  "cs2-source2-module": "Counter-Strike 2 crashed inside a Source 2 engine module. The failure happened in game engine code.",
  "cod-gpu-driver-module": "Call of Duty crashed while a GPU driver module was active. The failure happened on the graphics path.",
  "cod-amd-driver-module": "Call of Duty crashed while an AMD graphics driver module was active. The failure happened on the graphics path.",
  "overwatch-display-driver": "Overwatch 2 crashed near a display driver failure. The graphics stack was unstable when the game exited.",
  "destiny-battleye": "Destiny 2 crashed while BattlEye code was active. The failure happened in the anti-cheat layer.",
  "roblox-graphics": "Roblox crashed while graphics code was active. The failure happened during rendering or device setup.",
  "roblox-client-integrity": "Roblox crashed during a client integrity or protection check. The failure happened before normal gameplay continued.",
  "minecraft-java-opengl": "Minecraft Java crashed while OpenGL code was active. The failure happened on the render path.",
  "minecraft-java-opengl-driver": "Minecraft Java crashed while a GPU OpenGL driver module was active.",
  "minecraft-bedrock-store-package": "Minecraft Bedrock crashed inside the Store package path. Gaming Services or package state may be part of the failure.",
  "dota2-source2-module": "Dota 2 crashed inside a Source 2 engine module. The failure happened in game engine code.",
  "pubg-battleye": "PUBG crashed while BattlEye code was active. The failure happened in the anti-cheat layer.",
  "pubg-unreal-module": "PUBG crashed inside an Unreal module. The failure happened in game engine code.",
  "r6-battleye": "Rainbow Six Siege crashed while BattlEye code was active. The failure happened in the anti-cheat layer.",
  "r6-renderer-switch": "Rainbow Six Siege crashed inside renderer or engine code. The failure happened in the game render path.",
  "gtav-err-gfx-state": "GTA V crashed with a graphics state failure. The render path was in a bad state when the game exited.",
  "gtav-socialclub": "GTA V crashed while Rockstar launcher or Social Club code was active.",
  "rocketleague-eos": "Rocket League crashed while Epic Online Services code was active. The failure happened in the online services layer.",
  "the-finals-eac": "THE FINALS crashed while Easy Anti-Cheat code was active. The failure happened in the anti-cheat layer.",
  "the-finals-unreal": "THE FINALS crashed inside an Unreal module. The failure happened in game engine code.",
  "helldivers2-gameguard": "Helldivers 2 crashed while GameGuard code was active. The failure happened in the anti-cheat layer.",
  "helldivers2-gpu-driver": "Helldivers 2 crashed while a GPU driver module was active. The failure happened on the graphics path.",
  "palworld-unreal-shipping": "Palworld crashed inside the Unreal shipping executable. The failure happened in game or engine code."
};

function stripChecks(value) {
  if (Array.isArray(value)) return value.map(stripChecks);
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "checks") continue;
    next[key] = stripChecks(child);
  }
  return next;
}

function refineCrashSignatures(data) {
  for (const item of data.exceptionCodes || []) {
    if (exceptionExplanations[item.code]) item.explanation = exceptionExplanations[item.code];
  }
  for (const item of data.bugChecks || []) {
    if (bugCheckExplanations[item.code]) item.explanation = bugCheckExplanations[item.code];
  }
  for (const item of data.moduleHeuristics || []) {
    if (moduleExplanations[item.contains]) item.explanation = moduleExplanations[item.contains];
  }
  return stripChecks(data);
}

function refineGames(data) {
  for (const game of data.games || []) {
    for (const crash of game.knownCrashes || []) {
      if (gameCrashExplanations[crash.id]) crash.explanation = gameCrashExplanations[crash.id];
    }
  }
  return stripChecks(data);
}

function writeJson(relativePath, data) {
  fs.writeFileSync(
    path.join(root, relativePath),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );
}

const signaturesPath = "data/crash-signatures.json";
const gamesPath = "data/games.json";

writeJson(signaturesPath, refineCrashSignatures(JSON.parse(fs.readFileSync(path.join(root, signaturesPath), "utf8"))));
writeJson(gamesPath, refineGames(JSON.parse(fs.readFileSync(path.join(root, gamesPath), "utf8"))));

console.log("Refined crash copy in data/crash-signatures.json and data/games.json");
