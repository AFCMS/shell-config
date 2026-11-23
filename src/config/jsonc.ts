import { applyEdits, modify, parseTree, type ParseError } from "jsonc-parser";

import { backupConfigFile, readConfigFile, writeConfigFile } from "./files.ts";

/** Merge top-level settings without discarding JSONC comments or unrelated values. */
export async function updateJsoncConfig(
  path: string,
  settings: Readonly<Record<string, unknown>>,
): Promise<boolean> {
  const file = await readConfigFile(path);
  const bom = file.text?.startsWith("\uFEFF") ? "\uFEFF" : "";
  let text = file.text?.slice(bom.length) ?? "";
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true, allowEmptyContent: true });
  if (errors.length || (root && root.type !== "object")) {
    throw new Error(`Expected a JSONC settings object in ${path}. The file was left unchanged.`);
  }

  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const indent = text.match(/^[\t ]+(?=")/m)?.[0] ?? "  ";
  const formattingOptions = {
    insertSpaces: !indent.includes("\t"),
    tabSize: indent.length,
    eol,
  };
  if (!root) text += (text && !text.endsWith("\n") ? eol : "") + "{}" + eol;

  for (const [key, value] of Object.entries(settings)) {
    const properties = root?.children?.filter((property) => property.children?.[0]?.value === key);
    if (properties && properties.length > 1) {
      throw new Error(`Duplicate setting ${key} in ${path}. The file was left unchanged.`);
    }
    text = applyEdits(text, modify(text, [key], value, { formattingOptions }));
  }
  if (file.text === bom + text) return false;
  await backupConfigFile(file);
  await writeConfigFile(file, bom + text);
  return true;
}
