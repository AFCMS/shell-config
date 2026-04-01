export const omzInstallScriptUrl =
  "https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh";

export async function fetchTextFile(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  return await response.text();
}
