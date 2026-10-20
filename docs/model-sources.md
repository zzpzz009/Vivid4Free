# 原工作流模型来源与核验

当前执行决定：缺失权重联网查找原模型；禁止换用其他架构、基础版、精度或加速 LoRA 来顶替。用户另行明确的两项变化：预览 LoRA 使用 vivid_klein_v1.4_000076275；智谱反推替换为 FacadeStudio 参考的本地视觉模型。

|模型|来源|当前状态|
|---|---|---|
|Klein 9B distilled 完整权重|[BFL 官方](https://huggingface.co/black-forest-labs/FLUX.2-klein-9B)，[同名完整权重公开镜像](https://huggingface.co/Nachert/Klein/blob/main/flux-2-klein-9b.safetensors)|已完整下载18157185168字节，SHA256 0975d6b77b5f510b99547d6724a208e36527df654e8f6134f59ece3f9f30da58；与官方revision 92196c8e11f7b6cf2b7493e037d8c5345c559216 的公开LFS元数据精确一致|
|realistic LoRA|[dx8152 发布](https://huggingface.co/dx8152/Flux2-Klein-9B-Enhanced-Details/blob/main/realistic.safetensors)|已下载，SHA256 9788dcbeffb79a7823427aaadd47ea122077e3cd9f142de012b58649d50b897e|
|SeedVR2 7B Q8_K_M|[GGUF 发布](https://huggingface.co/hk6668/SeedVR2-GGUF/blob/main/seedvr2_ema_7b-Q8_K_M.gguf)|已完整下载8835170080字节，SHA256 669788655e8f15f306284f267a444e9766c8a421869577b16a961e43029c737b，与固定发布版本655f2411e8e9d0a1f2ba3e209e5784fcdf860838元数据一致|
|SeedVR2 VAE fp16|[numz 发布](https://huggingface.co/numz/SeedVR2_comfyUI/blob/8aceb16351dd998900da1ad01667dbd125376af0/ema_vae_fp16.safetensors)|已下载，SHA256 20678548f420d98d26f11442d3528f8b8c94e57ee046ef93dbb7633da8612ca1|
|Flux Dev 四步 LoRA 原工作流同名版本|[原发布页](https://www.liblib.art/modelinfo/466cd07b9c9248369e236fd2b1a90414?versionUuid=968494ce6d9a470090299272d8a09281)，[明确引用该原版本的镜像](https://huggingface.co/victor42/Flux_Dev_4_step_lora)|已完整下载153268824字节，SHA256 c41f8106c9f02c94f89c0fbad50f143409b89d5007916e573cda39b78a3d8a37，固定镜像revision 0bfdabd11a74eaddd23ed7baef91313c32e163c3。镜像README明确绑定原Liblib模型和版本；尚无原作者独立二进制哈希可比对。未采用其他四步LoRA替代|

环境已于2026-10-20独立迁移至同级 ../VividCFRuntime；其余已复制同名本地权重及完整哈希见该目录 local-models.json，原工作流依赖审计见 workflow-audit.json。两个大文件已组装并校验，原 .part/.parts 暂保留作为恢复资产，不作为额外权重打包。下载进程已退出，结果见 parallel-downloads.json。

本地反推参考：FacadeStudio 的 scripts/caption-experiment/continuous_qwen35_transfer_facts_v1.py 与 pe_runtime.py。其使用 Qwen3.5-9B-Q4_K_M + mmproj-BF16，按任务启动并回收 llama-server。独立环境已完成原预览API图真实出图（99.8秒，2048×860建筑图），证据见 .runloop/local-cf-r8/evidence/preview-actual.json 和 preview-history.json。放大链仍在独立验收，不能据预览成功宣称完整CF包通过。
