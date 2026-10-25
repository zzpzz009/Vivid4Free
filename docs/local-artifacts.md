# 本地历史产物归档

2026-10-25：历史 UI、测试输出与恢复证据共 8,042 个文件、1,600,076,430 字节，已搬移至仓库外：

`G:\Agent\Vivida4free\VividPrivate\artifacts\distribution-hardening-20261025`

目录结构保留原仓库相对路径。该目录的 `receipt.json` 逐文件记录原路径、大小、SHA256，搬移后全部校验一致，状态为 `verified`。恢复时按 receipt 的相对路径映射，不要覆盖后来创建的新文件。归档中的历史 Git worktree 已修复注册路径，仍可独立读取状态。

保留原位：固定 `release/installer`、`.local-baseline/installer-archive`、`.local-baseline/client-rollback`、当前工作证据、所有依赖、现用客户端、正式引擎与模型、用户图库和任务数据。`.local-baseline/unified-update-center` 有正在使用的日志文件，整目录保留，未终止其进程。

开始时源码仓库的普通未跟踪文件数为零；上述文件原本已被 Git 忽略。本次是物理搬移，未删除文件，也未释放同一磁盘的空间。外层目录不是本源码仓库，不对其执行清理。

后续构建的 UI/工作流旧副本会写入 `G:\Agent\Vivida4free\VividPrivate\artifacts\desktop-ui`，避免继续堆积在源码工作树。测试临时目录仍可由测试自动创建。
