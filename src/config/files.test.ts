import { expect, test } from "vitest";

import { hasStarshipInit } from "./files.ts";

test.each([
  'eval "$(starship init bash)"',
  'eval "$(starship init zsh)"',
  '& "C:\\Program Files\\starship.exe" init powershell',
  "& '/usr/local/bin/starship'\tinit\tpowershell",
  "# comment\r\n\tstarship init powershell\r\n",
  "# comment\rstarship init powershell\r",
])("detects existing Starship initialization in %j", (text) => {
  expect(hasStarshipInit(text)).toBe(true);
});

test.each([
  "",
  '# eval "$(starship init bash)"',
  '\t  # eval "$(starship init zsh)"',
  "notstarship init bash",
  "starship initialize bash",
  "starship prompt",
  " ".repeat(100_000),
  "prefix ".repeat(10_000) + "starship prompt",
])("ignores comments and unrelated commands (%#)", (text) => {
  expect(hasStarshipInit(text)).toBe(false);
});
