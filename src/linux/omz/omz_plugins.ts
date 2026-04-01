export interface OmzPlugin {
  readonly name: string;
  readonly url: string;
}

export const omzPlugins = [
  {
    name: "zsh-autosuggestions",
    url: "https://github.com/zsh-users/zsh-autosuggestions",
  },
  {
    name: "zsh-syntax-highlighting",
    url: "https://github.com/zsh-users/zsh-syntax-highlighting",
  },
] as const satisfies readonly OmzPlugin[];
