# Skills Directories

`.agents/skills/` is the primary location for all skills. `.claude/skills/` must always be kept in sync via symlinks pointing back here.

When adding or removing a skill:
1. Add/remove the skill folder in `.agents/skills/`
2. Add/remove a corresponding symlink in `.claude/skills/` (e.g. `ln -s ../../.agents/skills/<name> .claude/skills/<name>`)
