# AFCMS - Shell Config

| OS             |
| -------------- |
| Ubuntu 26.04   |
| Fedora 44      |
| Windows 11 Pro |

- ZSH
- Oh-My-ZSH
- OMZ plugins
- Starship

```shell
deno compile -P --output build/shell-config ./main.ts

# Docker
docker run --rm -it -v "$(pwd)/build:/build" fedora:44 bash
docker run --rm -it -v "$(pwd)/build:/build" ubuntu:26.04 bash
```
