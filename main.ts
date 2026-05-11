import {
  box,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  spinner,
  taskLog,
} from "@clack/prompts";

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
import { installStarshipConfig } from "./src/modules/starship.ts";
import { installZshConfig } from "./src/modules/zsh.ts";

if (import.meta.main) {
  intro("AFCM - Shell Configuration");

  // Step 1. Detect system information
  const spin1 = spinner();
  spin1.start("Detecting system information...");

  const systemInfos = await detectSystem();

  spin1.clear();

  if (!systemInfos) {
    outro("Unsupported system detected. Exiting...");
    Deno.exit(1);
  }

  box(JSON.stringify(systemInfos, undefined, 2), "System Informations", {
    contentAlign: "left",
    titleAlign: "center",
    width: "auto",
    rounded: true,
  });

  const isValid = await confirm({
    message: "It it OK?",
  });

  if (!isValid || isCancel(isValid)) {
    outro("Aborting...");
    Deno.exit(1);
  }

  const test = await import("./test.json", { with: { type: "json" } });
  console.log(test);

  if (systemInfos.os === "linux") {
    console.log(
      `Detected Linux system with ${systemInfos.packageManager} package manager and ${systemInfos.arch} architecture.`,
    );
  } else {
    console.error("Unsupported distribution");
    Deno.exit(1);
  }

  // Step 2. Update package lists

  const log2 = taskLog({
    title: "Updating package lists...",
    limit: 10,
    retainLog: false,
  });
  // TODO: proper taskLog integration
  if (systemInfos.packageManager === "deb") {
    await updateDebPackagesList();
  }

  log2.success("Update complete");

  // Step 3. Install required packages for the program to work

  const log3 = taskLog({
    title: "3. Installing required packages...",
    limit: 10,
    retainLog: false,
  });
  // TODO: proper taskLog integration
  await installPackages(["which", "git"], systemInfos.packageManager);

  log3.success("Update complete");

  // Step 4. Shell configuration

  if (systemInfos.os === "linux") {
    // Install zsh
    const checkZsh = await checkExec("zsh");

    if (checkZsh) {
      log.success(`${checkZsh.version} is already installed`);
    } else {
      const logZsh = taskLog({
        title: "Installing Zsh...",
        limit: 10,
        retainLog: false,
      });

      const success = await installPackages(
        ["zsh"],
        systemInfos.packageManager,
      );

      if (success) {
        logZsh.success("Zsh installation complete");
      } else {
        outro("Failed to install zsh");
        Deno.exit(1);
      }
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
    const omzEnv = {
      HOME: systemInfos.homeDir,
      USER: systemInfos.user,
      ZSH: `${systemInfos.homeDir}/.oh-my-zsh`,
      CHSH: "no", // Don't change default shell when running via sudo
      RUNZSH: "no", // Don't run zsh after install
      KEEP_ZSHRC: "yes", // Keep existing .zshrc if it exists
    } as const satisfies Record<string, string>;
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

  await installStarshipConfig(systemInfos);

  await installZshConfig(systemInfos);

  outro(`You're all set!`);
}
