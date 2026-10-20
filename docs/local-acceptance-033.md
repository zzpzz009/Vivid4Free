# 客户端 0.3.3 本地验收

日期：2026-10-20。范围是用户指定的本地 CF、渲染、放大、图库、桌面安装和 Agent 控制。账号接入按用户要求等待后续方法；正式下载地址尚未确定，本报告不声称这两项已完成。

## 目录与交付物

- 源码：`G:\Agent\Vivida4free\VividDesktop`
- 已安装 EXE：`G:\Agent\Vivida4free\VividClient\VividDesktop.exe`
- 安装程序：`release/r10-client033/VividDesktop-Setup-0.3.3-x64.exe`，113,064,594 字节，SHA256 `7ee47b104ca89337ef2a224cf59e9bc5a764d46ed43e21ece364dab281e034f8`
- 独立 CF：`G:\Agent\Vivida4free\VividCFRuntime\versions\vivid-comfy-0.3.0`
- 独立 CF 包：`G:\Agent\Vivida4free\VividCFPackages\vivid-comfy-0.3.0-win32-x64.zip`，83,725,765,123 字节，SHA256 `3bc3e8e8495f3b6901f57f8d184fc506f926cccaf5eadf0b327a339650530ff7`

四个实体目录没有指向其他 CF 的链接；模型为独立文件。客户端 ASAR 不含 CF、Python 和模型。CF 包 43,581 个载荷文件的 SHA256、ZIP CRC 及清单一致性全部验证通过；没有再次解压完整大包做安装验收。CF 包排除了输入输出、用户数据、诊断插件和下载片段。

## 实际结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 原预览 | 2048×860，约99秒 | preview-final-original.json |
| 原放大 | 8000×3360，481.33秒 | upscale-final-original.json |
| Electron上传与渲染 | 双输入实际上传并保存预览 | electron-render-attempt1.json，渲染通过；该早期驱动后续选择器失败单独保留 |
| Electron放大 | 复用渲染结果，默认4096，输出4096×1720，273.30秒 | electron-journey-upscale.json，client-upscale-output.json |
| 重启 | 历史任务与图库保留，真实结果图重开 | electron-journey-reopen.json |
| 进度和取消 | CF进度28%，UI取消为cancelled且旧错误清除 | electron-journey-cancel.json、对应PNG |
| Agent | 401/200/403，重复requestId复用任务，独立任务提交及指定取消 | render、cancel及installed-final记录 |
| 安装 | NSIS成功；安装后的ASAR与候选相同 | install-033.json |
| 安装宿主 | 实际VividClient EXE恢复图库、任务及4096×1720图片，引擎与两工作流就绪 | installed-final.json、installed-final.png |
| 普通启动 | 不带调试参数和测试端口，默认用户设置自动找到CF | normal-client-ready.json |
| 回归 | 前端137项，桌面24项 | frontend-final-tests.log、desktop-final-tests.log |
| 完整包 | 全部载荷SHA256及CRC通过 | runtime-archive-verification.json |

上述证据均在 `.runloop/local-client-r10/evidence`。最新候选为 `delivery-candidate033.json`；独立 Luna6 审查见 `.archi-coo/receipts/candidate-review-r10-final033.json`，结论 PASS_LOCAL_SCOPE。旧0.3.2取消失败和驱动选择器失败证据保留，不混作本候选通过证据。

原工作流与原基础模型/精度/采样/分块策略保持，预览指定v1.4_000076275 LoRA，本地Qwen反推取代在线GLM。修复仅涉及兼容加载预算、阶段间释放前一模型、真实结果映射、进度重连、SeedVR种子范围与并发取消反馈。原放大默认8000保持；客户端明确传入默认4096时按选定尺寸运行，SeedVR的种子按其uint32范围映射。

## 留存与边界

基线、原始失败、各版候选、测试用户数据和回执留作恢复。自动审批以 blocked by policy 拒绝了旧模型下载片段清理；四个part/parts目标约26.99GB保留，位置见 download-transient-inventory.json，已排除在ZIP中。没有绕过拒绝。原资料、其他CF和线上账号配置未改。

创意工坊保留未开放，账号界面显示待配置，本地出图不扣额度。正式托管就绪后还需配置清单地址并验证实际完整包的下载及解压安装链路。本地已安装CF不依赖该下载入口。
