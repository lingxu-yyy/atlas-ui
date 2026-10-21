# TASKS

| ID | 任务 | owner | 状态 | 验收命令 |
| --- | --- | --- | --- | --- |
| v0.2-1 | 组件级按需入口（unplugin resolver） | ds | todo | `pnpm lint && pnpm test && pnpm build` |
| v0.2-2 | AtFilterBuilder（条件构造器） | trae | todo | `pnpm lint && pnpm test && pnpm build` |
| v0.2-4 | README 补 GIF 与 Releases notes | trae | todo | `pnpm docs:build` |
| v0.2-5 | v0.2.0 发布 | ds | todo | `git tag -l v0.2.0 && git ls-remote --tags origin v0.2.0` |

owner=ds 的任务由 DeepSeek 产出交接单与判据，由 trae 执行并回传原始输出；
trae 不得自行决定或放宽验收标准。
