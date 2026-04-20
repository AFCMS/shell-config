// https://www.freedesktop.org/software/systemd/man/latest/os-release.html

const osReleaseFilePath = "/etc/os-release";

export async function getOsReleaseRaw(): Promise<string | undefined> {
  try {
    const response = await Deno.readFile(osReleaseFilePath);
    return new TextDecoder().decode(response);
  } catch {
    return undefined;
  }
}

export interface OsRelease {
  readonly NAME?: string;
  readonly ID?: string;
  readonly ID_LIKE?: string;
  readonly PRETTY_NAME?: string;
  readonly FANCY_NAME?: string;
  readonly CPE_NAME?: string;
  readonly VARIANT?: string;
  readonly VARIANT_ID?: string;
  readonly VERSION?: string;
  readonly VERSION_ID?: string;
  readonly VERSION_CODENAME?: string;
  readonly BUILD_ID?: string;
  readonly IMAGE_ID?: string;
  readonly IMAGE_VERSION?: string;
  readonly RELEASE_TYPE?: string;
  [key: string]: string | undefined;
}

export function parseOsRelease(osReleaseContent: string): OsRelease {
  const env: OsRelease = {};
  const lines = osReleaseContent.split("\n");
  for (const line of lines) {
    const [key, value] = line.split("=");
    if (key && value) {
      env[key] = value.replace(/"/g, "");
    }
  }
  return env;
}

export async function getOsRelease(): Promise<OsRelease | undefined> {
  const raw = await getOsReleaseRaw();
  if (raw) {
    return parseOsRelease(raw);
  }
  return undefined;
}
