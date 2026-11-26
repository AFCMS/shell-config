import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

export const startMarker = "# >>> shell-config >>>";
export const endMarker = "# <<< shell-config <<<";

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function readConfigFile(path: string) {
  try {
    const target = await realpath(path);
    const file = await stat(target);
    if (!file.isFile()) throw new Error(`Expected a regular configuration file: ${path}`);
    const bytes = await readFile(target);
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf16le" : "utf8";
    return {
      path: target,
      text: bytes.toString(encoding),
      mode: file.mode & 0o777,
      encoding,
    } as const;
  } catch (error) {
    if (!missing(error)) throw error;
    const entry = await lstat(path).catch((failure: unknown) => {
      if (!missing(failure)) throw failure;
    });
    if (entry) throw new Error(`Could not resolve configuration file: ${path}`, { cause: error });
    return { path, text: undefined, mode: 0o644, encoding: "utf8" } as const;
  }
}

type ConfigFile = Awaited<ReturnType<typeof readConfigFile>>;

export async function writeConfigFile(file: ConfigFile, text: string): Promise<void> {
  if (file.text === text) return;
  const dir = dirname(file.path);
  await mkdir(dir, { recursive: true });
  const tempDir = await mkdtemp(join(dir, ".shell-config-"));
  try {
    const temporary = join(tempDir, "config");
    await writeFile(temporary, text, { encoding: file.encoding, mode: file.mode });
    await rename(temporary, file.path);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function backupConfigFile(file: ConfigFile): Promise<void> {
  if (file.text === undefined) return;
  try {
    await writeFile(file.path + ".bak", file.text, {
      encoding: file.encoding,
      mode: file.mode,
      flag: "wx",
    });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  }
}

export function readStartupBlock(file: ConfigFile, legacy?: string) {
  const bom = file.text?.startsWith("\uFEFF") ? "\uFEFF" : "";
  const text = file.text?.slice(bom.length) ?? "";
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const legacyFile = legacy !== undefined && text.replaceAll("\r\n", "\n") === legacy;
  const starts = Array.from(text.matchAll(/^# >>> shell-config >>>\r?$/gm));
  const ends = Array.from(text.matchAll(/^# <<< shell-config <<<\r?$/gm));
  if (
    starts.length !== ends.length ||
    starts.length > 1 ||
    (starts[0] && starts[0].index >= ends[0].index)
  ) {
    throw new Error(`Invalid Shell Config markers in ${file.path}.`);
  }

  const start = starts[0]?.index;
  const end = ends[0] ? ends[0].index + endMarker.length : undefined;
  const before = start === undefined ? "" : text.slice(0, start);
  const after = end === undefined ? "" : text.slice(end);
  const custom = legacyFile ? "" : start === undefined ? text : before + after;

  return {
    custom,
    async write(body: string, prepend = false): Promise<void> {
      const block = [startMarker, body, endMarker].join("\n").replaceAll("\n", eol);
      let result: string;
      if (start !== undefined) {
        result = before + block + after;
      } else if (!custom) {
        result = block + eol;
      } else if (prepend) {
        result = block + eol + eol + custom;
      } else {
        result = custom + (custom.endsWith(eol) ? eol : eol + eol) + block + eol;
      }
      await writeConfigFile(file, bom + result);
    },
  };
}

export function hasUncommentedLine(text: string, pattern: RegExp): boolean {
  return text
    .split(/\r\n?|\n/)
    .some((line) => !line.trimStart().startsWith("#") && pattern.test(line));
}

export function hasStarshipInit(text: string): boolean {
  return hasUncommentedLine(text, /\bstarship(?:\.exe)?["']?\s+init\s/);
}
