import {
  fetchTextFile,
  omzInstallScriptUrl,
} from "./src/linux/download_script.ts";
import {
  checkOmzInstalled,
  installPlugins,
  updatePlugins,
} from "./src/linux/omz/omz.ts";
import { runInlineScript } from "./src/linux/run_script.ts";
import { checkExec } from "./src/linux/utils/check_exec.ts";
import {
  installPackages,
  updateDebPackagesList,
} from "./src/linux/utils/install_package.ts";
import { detectSystem } from "./src/system_detection.ts";

if (import.meta.main) {
  const systemInfos = await detectSystem();
  console.log(systemInfos);

  const test = await import("./test.json", { with: { type: "json" } });
  console.log(test);

  if (!systemInfos) {
    console.error("Unsupported system");
    Deno.exit(1);
  }

  if (systemInfos.os === "linux") {
    console.log(
      `Detected Linux system with ${systemInfos.packageManager} package manager and ${systemInfos.arch} architecture.`,
    );
  } else {
    console.error("Unsupported distribution");
    Deno.exit(1);
  }

  if (systemInfos.packageManager === "deb") {
    await updateDebPackagesList();
  }

  // Install required packages for the program to work

  await installPackages(["which", "git"], systemInfos.packageManager);

  // Install zsh
  const checkZsh = await checkExec("zsh");
  console.log(`Zsh is ${checkZsh ? "already installed" : "not installed"}.`);
  if (!checkZsh) {
    const success = await installPackages(["zsh"], systemInfos.packageManager);
    if (!success) {
      console.error("Failed to install zsh");
      Deno.exit(1);
    }
  }

  // Install OMZ
  if (await checkOmzInstalled(systemInfos.homeDir)) {
    console.log("OMZ is already installed.");
  } else {
    const script = await fetchTextFile(omzInstallScriptUrl);
    if (!script) {
      console.error("Failed to fetch OMZ install script");
      Deno.exit(1);
    }
    // Prepare environment variables for the OMZ install script
    // This ensures it installs to the correct user's home directory
    // even when running with sudo
    const omzEnv: Record<string, string> = {
      HOME: systemInfos.homeDir,
      USER: systemInfos.user,
      ZSH: `${systemInfos.homeDir}/.oh-my-zsh`,
      CHSH: "no", // Don't change default shell when running via sudo
      RUNZSH: "no", // Don't run zsh after install
      KEEP_ZSHRC: "yes", // Keep existing .zshrc if it exists
    };
    try {
      await runInlineScript(script, omzEnv);
    } catch (err) {
      console.error("Failed to install OMZ:", err);
      Deno.exit(1);
    }
  }

  // Install/update ZSH plugins
  const omzDir = await checkOmzInstalled(systemInfos.homeDir);
  if (omzDir) {
    console.log("Installing ZSH plugins...");
    await installPlugins(omzDir);

    console.log("Updating ZSH plugins...");
    await updatePlugins(omzDir);
  } else {
    console.warn("OMZ not found, skipping plugin installation...");
  }
}
