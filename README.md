# AFCMS - Shell Config

| OS             |
| -------------- |
| Ubuntu 24.04   |
| Fedora 43      |
| Windows 11 Pro |

- ZSH
- Oh-My-ZSH
- OMZ plugins
- Starship

```shell
deno compile -P --output build/shell-config ./main.ts

# Docker
docker run --rm -it -v "$(pwd)/build:/build" fedora:43 bash
docker run --rm -it -v "$(pwd)/build:/build" ubuntu:24.04 bash
```
