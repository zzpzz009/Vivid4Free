# 独立引擎与模型声明

核对日期：2026-10-25。适用于 `updates/engine.json` 列出的独立引擎及模型；客户端安装包不包含这些大型权重。前端声明 `client/THIRD-PARTY-NOTICES.txt` 不覆盖本文件列出的内容，项目根 LICENSE 不替代任何第三方许可证。

| 组件 / 发布文件 | 上游授权与发布要求 |
| --- | --- |
| ComfyUI（`comfyui/`） | 本机 0.3.2 的 LICENSE 为 GNU GPL v3。分发时须保留许可证、版权及修改说明，并按适用 GPL 条款提供对应版本的完整源代码、修改与构建/安装所需材料。仅链接上游首页不能代替对应源代码交付。参见 [ComfyUI LICENSE](https://github.com/Comfy-Org/ComfyUI/blob/master/LICENSE)。 |
| FLUX.2 [klein] 9B（`flux-2-klein-9b.safetensors`） | [BFL 官方模型及许可证](https://huggingface.co/black-forest-labs/FLUX.2-klein-9B/blob/main/LICENSE.md)为 FLUX Non-Commercial，不能因客户端免费或前端依赖为 MIT 而宣称权重可自由商用。模型与衍生权重的使用、再分发须遵守取得该版本时的完整条款；商业使用需另核对授权。 |
| FLUX.1 [dev] 衍生（`flux.1-dev-SRPO-bf16.safetensors`）、FLUX LoRA 与 VAE | 保留 [FLUX.1 dev 上游许可证](https://huggingface.co/black-forest-labs/FLUX.1-dev/blob/main/LICENSE.md)，同时核对 SRPO、LoRA 和各个权重发布者的额外条款。非商用模型授权和生成结果的使用条款须分别判断，不把权重限制直接等同于所有输出一律禁止商用。 |
| SeedVR2 官方模型 | [ByteDance-Seed/SeedVR2-7B](https://huggingface.co/ByteDance-Seed/SeedVR2-7B)标示 Apache-2.0。分发时保留许可证、版权、适用 NOTICE 和修改说明。 |
| SeedVR2 ComfyUI 节点（`seedvr2_videoupscaler/`） | 本机 0.3.2 的 LICENSE 为 Apache-2.0；参见 [节点项目 LICENSE](https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler/blob/main/LICENSE)。节点代码与模型权重分别核对。 |
| SeedVR2 GGUF 和 VAE 转换版 | 实际来源为 [hk6668/SeedVR2-GGUF](https://huggingface.co/hk6668/SeedVR2-GGUF)及 [numz/SeedVR2_comfyUI](https://huggingface.co/numz/SeedVR2_comfyUI)。需保留上游及转换作者声明，不能仅凭官方模型授权推定每个转换包已完成许可核查。具体来源和校验见 `docs/model-sources.md`。 |
| 其他自定义节点、Python、PyTorch、Qwen、CLIP/T5、放大模型及自有/第三方 LoRA | 各自许可证独立适用。保留运行包内原始 LICENSE/NOTICE；不得统称“全引擎 MIT”或“全部模型可自由商用”。现有来源记录未完整确认每个权重的授权链，因此尚不能声明整个 83.7GB 包的再分发合规核查已完成。 |

## 发布边界

独立目录与独立下载不自动消除 GPL 或模型授权义务。本文件是组件声明，不是对组合产品法律属性、全部来源或再分发资格的认证。已有 0.3.2 ZIP 不在本次修改中被重打包或改写，不能声称旧 ZIP 已补齐本文件。

每次发布引擎应随包提供本文件、各组件许可证全文和适用 NOTICE，并记录源码版本、修改及对应源码获取方式。GPL 对应源码和未明确来源/授权的 LoRA、转换权重仍需逐项核实后才能对外作完整合规承诺。
