// Install Hack and Fira Nerd Fonts on non headless systems
//
// https://www.nerdfonts.com
// https://github.com/ryanoasis/nerd-fonts

/**
 * @see https://github.com/ryanoasis/nerd-fonts/releases
 */
export const nerdFontsRelease = "v3.4.0";

export const installScriptPathBash =
  "https://raw.githubusercontent.com/ryanoasis/nerd-fonts/refs/heads/master/install.sh";

export const installScriptPathPowershell =
  "https://raw.githubusercontent.com/ryanoasis/nerd-fonts/refs/heads/master/install.ps1";

export function installNerdFonts() {
  throw new Error("Nerd Fonts installation is not implemented yet");
}
