import { chmod, lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "jsonc-parser";
import { afterEach, beforeEach, expect, test } from "vitest";

import { updateJsoncConfig } from "./jsonc.ts";

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "shell-config-jsonc-test-"));
  path = join(dir, "settings.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("preserves comments, BOM, CRLF, indentation and unrelated nested settings", async () => {
  const original =
    '\uFEFF{\r\n\t// My editor settings\r\n\t"editor.fontFamily": "old", // font\r\n\t"[typescript]": { "editor.tabSize": 4 },\r\n}\r\n';
  await writeFile(path, original);
  await updateJsoncConfig(path, {
    "editor.fontFamily": "new",
    "terminal.integrated.enableImages": true,
  });
  const text = await readFile(path, "utf8");
  expect(text.startsWith("\uFEFF")).toBe(true);
  expect(text).toContain('\t"editor.fontFamily": "new", // font\r\n');
  expect(text).toContain('\t"terminal.integrated.enableImages": true,\r\n');
  expect(text).toContain("// My editor settings\r\n");
  expect(text.replaceAll("\r\n", "")).not.toContain("\n");
  expect(parse(text.slice(1))).toEqual({
    "editor.fontFamily": "new",
    "[typescript]": { "editor.tabSize": 4 },
    "terminal.integrated.enableImages": true,
  });
  expect(await readFile(path + ".bak", "utf8")).toBe(original);
});

test("backs up once and avoids rewriting unchanged settings", async () => {
  await writeFile(path, '{ "custom": true }\n');
  expect(await updateJsoncConfig(path, { font: "Hack" })).toBe(true);
  const first = await stat(path);
  expect(await updateJsoncConfig(path, { font: "Hack" })).toBe(false);
  expect((await stat(path)).mtimeMs).toBe(first.mtimeMs);
  await updateJsoncConfig(path, { font: "FiraCode" });
  expect(await readFile(path + ".bak", "utf8")).toBe('{ "custom": true }\n');
});

test("creates a missing settings file without a backup", async () => {
  await updateJsoncConfig(path, { "editor.fontFamily": "FiraCode" });
  expect(parse(await readFile(path, "utf8"))).toEqual({ "editor.fontFamily": "FiraCode" });
  await expect(stat(path + ".bak")).rejects.toMatchObject({ code: "ENOENT" });
});

test.each(["", "// My preferences", "// My preferences\r\n"])(
  "creates settings in an empty or comment-only file: %j",
  async (original) => {
    await writeFile(path, original);
    await updateJsoncConfig(path, { "editor.fontFamily": "FiraCode" });
    const text = await readFile(path, "utf8");
    expect(parse(text)).toEqual({ "editor.fontFamily": "FiraCode" });
    expect(text).toContain(original);
  },
);

test("rejects duplicate managed settings without changing the file", async () => {
  const original = '{ "font": "old", "font": "other" }\n';
  await writeFile(path, original);
  await expect(updateJsoncConfig(path, { images: true, font: "Hack" })).rejects.toThrow(
    "Duplicate setting font",
  );
  expect(await readFile(path, "utf8")).toBe(original);
  await expect(stat(path + ".bak")).rejects.toMatchObject({ code: "ENOENT" });
});

test.each(['{"broken": }', "[]", "null", "{", '{"unterminated": "value}'])(
  "leaves invalid settings unchanged: %s",
  async (original) => {
    await writeFile(path, original);
    await expect(updateJsoncConfig(path, { font: "Hack" })).rejects.toThrow(path);
    expect(await readFile(path, "utf8")).toBe(original);
    await expect(stat(path + ".bak")).rejects.toMatchObject({ code: "ENOENT" });
  },
);

test.skipIf(process.platform === "win32")("preserves symlinks and permissions", async () => {
  const target = join(dir, "actual.json");
  await writeFile(target, "{}\n");
  await chmod(target, 0o600);
  await symlink(target, path);
  await updateJsoncConfig(path, { font: "Hack" });
  expect((await lstat(path)).isSymbolicLink()).toBe(true);
  expect((await stat(target)).mode & 0o777).toBe(0o600);
  expect(parse(await readFile(target, "utf8"))).toEqual({ font: "Hack" });
});
