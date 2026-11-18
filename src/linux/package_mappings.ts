import type { PackageManager } from "../system.ts";

export type PackageMappingValue = {
  readonly [key in PackageManager]: string | readonly string[];
};

export type PackageMapping = Readonly<Record<string, PackageMappingValue>>;

export const packageMappings = {
  zsh: {
    deb: "zsh",
    rpm: "zsh",
  },
  zsh2: {
    deb: "zsh2",
    rpm: "zsh2",
  },
  which: {
    deb: "which",
    rpm: "which",
  },
  git: {
    deb: "git",
    rpm: "git",
  },
  chsh: {
    deb: "util-linux",
    rpm: "util-linux",
  },
  fastfetch: {
    deb: "fastfetch",
    rpm: "fastfetch",
  },
} as const satisfies PackageMapping;

export type PackageName = keyof typeof packageMappings;
