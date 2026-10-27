# Vendored Agent Skills

Third-party skills copied into this repository at a pinned commit, after
reading their files. Update them deliberately: re-read the diff before
replacing a copy.

| Skill | Source | Commit | License |
| --- | --- | --- | --- |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`.claude/skills/impeccable`) | `d34c87e1a00989ae8dbdd7f6b30b70f23319e860` | Apache-2.0 (`impeccable/LICENSE`, `impeccable/NOTICE.md`) |
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `2d228630ba1446365f614a108cb8252f1feda202` | MIT |
| `mobile-native` | same | same | MIT |
| `break-ui` | same | same | MIT |
| `review-animations` | same | same | MIT |

## Notes

- `impeccable` runs a native engine through `scripts/impeccable`. On first use
  the launcher downloads the engine (version in `scripts/VERSION`) from the
  project's GitHub releases and verifies it against the SHA-256 digests in
  `scripts/engine-checksums.txt`. Downloaded binaries land in a cache outside
  the repository or in a git-ignored `bin/` folder.
- The `impeccable` edit hook is **off**. Turn it on only deliberately
  (`/impeccable hooks on`).
- The Emil Kowalski skills are plain Markdown instructions.
