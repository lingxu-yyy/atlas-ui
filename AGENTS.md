# atlas-ui 协作规则
1. 开工前读 TASKS.md 与 docs/handoff/ 最新交接单
2. 一次只做一个任务；当前任务未标 done 不得开始下一个
3. 交付 = 命令输出为准，"文件已建"不算完成
4. 每次交付写 docs/handoff/H-xxx-report.md，贴原始输出
5. 禁止 git add -A、force push、提交 .env*、新增未批准的依赖
6. 长命令不要接管道吞输出：pnpm install 用 --reporter=append-only；vitest 用 --reporter=verbose（append-only 不是 vitest 的合法 reporter）
7. 对验收条件有异议先提出，不要自行放宽
