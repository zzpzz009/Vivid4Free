"""Compile the supplied upscale UI graph to a minimal ComfyUI API graph."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "vivid模型" / "VIVID放大工作流正式版.json"
INPUT_NAME = "vivid-main.png"

UI_ONLY = {
    "easy bookmark",
    "Image Comparer (rgthree)",
    "PreviewImage",
}
PASSTHROUGH = {"Reroute", "SetNode"}
WIDGET_LAYOUTS = {
    # These frontend-only seed mode controls are serialized beside values but
    # are not API inputs; keep them from shifting the ComfyUI input values.
    "KSampler (Efficient)": ["seed", None, "steps", "cfg", "sampler_name", "scheduler", "denoise", "preview_method", "vae_decode"],
    "SeedVR2VideoUpscaler": ["seed", None, "resolution", "max_resolution", "batch_size", "uniform_batch_size", "color_correction", "temporal_overlap", "prepend_frames", "input_noise_scale", "latent_noise_scale", "offload_device", "enable_debug"],
    "InjectLatentNoise+": ["noise_seed", None, "noise_strength", "normalize"],
}


def _linked_inputs(node: dict[str, Any], links: dict[int, tuple[str, int]]) -> dict[str, Any]:
    serialized = iter(node.get("widgets_values") or [])
    layout = WIDGET_LAYOUTS.get(node["type"])
    if layout is not None:
        value_by_name = {}
        for name in layout:
            value = next(serialized, None)
            if name is not None:
                value_by_name[name] = value
    else:
        value_by_name = {}
        for item in node.get("inputs", []):
            if item.get("widget") is not None:
                value_by_name[item["name"]] = next(serialized, None)
    inputs: dict[str, Any] = {}
    for item in node.get("inputs", []):
        if item.get("link") is not None:
            link = links[item["link"]]
            inputs[item["name"]] = [link[0], link[1]]
        elif item.get("widget") is not None:
            inputs[item["name"]] = value_by_name.get(item["name"])
    if node["type"] == "ImageResize+" and "multiple_of" in [i["name"] for i in node.get("inputs", [])]:
        # This socket is represented in widgets_values although the UI graph
        # does not mark it as a widget-capable input.
        inputs["multiple_of"] = (node.get("widgets_values") or [None] * 6)[5]
    return inputs


def compile_graph() -> tuple[dict[str, Any], dict[str, Any]]:
    source_bytes = SOURCE.read_bytes()
    source = json.loads(source_bytes.decode("utf-8"))
    nodes = {str(node["id"]): node for node in source["nodes"]}
    links = {link[0]: (str(link[1]), link[2]) for link in source["links"]}
    candidates: dict[str, dict[str, Any]] = {}

    for key, node in nodes.items():
        node_type = node["type"]
        if node_type in UI_ONLY | PASSTHROUGH or node_type == "Image Save":
            continue
        if node_type == "LayerUtility: ZhipuGLM4V":
            serialized = node.get("widgets_values") or []
            candidates[key] = {
                "class_type": "VividLocalCaption",
                "inputs": {
                    "image": [str(links[next(i["link"] for i in node["inputs"] if i["name"] == "image")][0]),
                              links[next(i["link"] for i in node["inputs"] if i["name"] == "image")][1]],
                    "prompt": serialized[1],
                },
            }
            continue
        if node_type in {"Int", "easy float"}:
            raw = (node.get("widgets_values") or [None])[0]
            candidates[key] = {
                "class_type": "PrimitiveInt" if node_type == "Int" else "easy float",
                "inputs": {"value": int(raw) if node_type == "Int" else float(raw)},
            }
        else:
            candidates[key] = {"class_type": node_type, "inputs": _linked_inputs(node, links)}

    # Remove the upload-only widget and point the service's input alias at LoadImage.
    if "48" not in candidates or candidates["48"]["class_type"] != "LoadImage":
        raise ValueError("Expected original LoadImage node 48")
    candidates["48"]["inputs"]["image"] = INPUT_NAME
    candidates["48"]["inputs"].pop("upload", None)

    output = nodes["287"]
    output_link = next(item["link"] for item in output["inputs"] if item["name"] == "images")
    candidates["287"] = {
        "class_type": "SaveImage",
        "inputs": {"images": [str(links[output_link][0]), links[output_link][1]],
                   "filename_prefix": "Vivid/upscale"},
    }

    def resolve(value: Any, seen: set[tuple[str, int]] | None = None,
                preserve_primitive: bool = False) -> Any:
        if not (isinstance(value, list) and len(value) == 2 and str(value[0]) in nodes):
            return value
        key, slot = str(value[0]), int(value[1])
        node = nodes[key]
        seen = set() if seen is None else seen
        marker = (key, slot)
        if marker in seen:
            raise ValueError(f"Cycle while resolving node {key} output {slot}")
        seen.add(marker)
        node_type = node["type"]
        if node_type in PASSTHROUGH:
            linked = [item["link"] for item in node.get("inputs", []) if item.get("link") is not None]
            if not linked:
                raise ValueError(f"Cannot bypass unconnected {node_type} node {key}")
            return resolve(list(links[linked[0]]), seen, preserve_primitive)
        if node_type in {"Int", "easy float"} and preserve_primitive:
            return [key, slot]
        if node_type in {"Int", "easy float", "Seed (rgthree)"}:
            raw = (node.get("widgets_values") or [None])[0]
            if node_type == "Int":
                return int(raw)
            if node_type == "easy float":
                return float(raw)
            return int(raw)
        if node.get("mode", 0) == 4:
            linked = [item["link"] for item in node.get("inputs", []) if item.get("link") is not None]
            output_slots = node.get("outputs", [])
            if slot >= len(output_slots) or not linked:
                raise ValueError(f"Cannot bypass node {key} ({node_type}) output {slot}")
            matching = next((item for item in node.get("inputs", [])
                             if item.get("type") == output_slots[slot].get("type")
                             and item.get("link") is not None), None)
            if matching is None:
                raise ValueError(f"No compatible bypass input on node {key} ({node_type})")
            return resolve(list(links[matching["link"]]), seen, preserve_primitive)
        if node_type in UI_ONLY:
            raise ValueError(f"UI-only node {key} ({node_type}) entered output closure")
        if key not in candidates:
            raise ValueError(f"Unresolved source node {key} ({node_type})")
        return [key, slot]

    selected: dict[str, Any] = {}

    def visit(key: str) -> None:
        if key in selected:
            return
        if key not in candidates:
            raise ValueError(f"Unresolved node {key}")
        selected[key] = candidates[key]
        wildcard_inputs = {
            item["name"] for item in nodes[key].get("inputs", [])
            if item.get("type") in {"*", "ANY"}
        }
        candidates[key]["inputs"] = {
            name: resolve(value, preserve_primitive=name in wildcard_inputs)
            for name, value in candidates[key]["inputs"].items()
        }
        for value in candidates[key]["inputs"].values():
            if isinstance(value, list) and len(value) == 2 and isinstance(value[0], str):
                visit(value[0])

    visit("287")

    must_retain = {"127": "KSampler (Efficient)", "271": "SeedVR2VideoUpscaler",
                   "10": "TTP_Image_Tile_Batch", "30": "TTP_Tile_image_size",
                   "33": "TTP_Image_Assy", "261": "TTP_Image_Assy"}
    for key, node_type in must_retain.items():
        if key not in selected or selected[key]["class_type"] != node_type:
            raise ValueError(f"Original algorithm node {key} ({node_type}) was not retained")

    active_source_ids = set(selected)
    bypassed = sorted(key for key, node in nodes.items()
                      if node.get("mode", 0) == 4 and key not in active_source_ids)
    pins: dict[str, dict[str, Any]] = {}
    for key in sorted(active_source_ids, key=int):
        node = nodes[key]
        props = node.get("properties") or {}
        pins[node["type"]] = {k: props[k] for k in ("cnr_id", "ver", "aux_id") if k in props}

    metadata = {
        "source": str(SOURCE),
        "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "source_nodes": len(nodes),
        "api_nodes": len(selected),
        "node_pins": pins,
        "required_node_types": sorted({node["class_type"] for node in selected.values()}),
        "changes": [
            "LayerUtility: ZhipuGLM4V node 138 replaced by existing VividLocalCaption; original prompt retained",
            "Image Save node 287 replaced by core SaveImage; final image input connection retained",
            "LoadImage node 48 uses the task-service alias vivid-main.png; upload-only field omitted",
            "PreviewImage, Image Comparer, and bookmark UI nodes are omitted from the API output closure",
            "Mode-4 nodes are bypassed when connected; disconnected bypass branches remain inactive",
            "Primitive Int/easy float outputs remain nodes only when feeding wildcard sockets; typed numeric inputs stay constant-folded",
        ],
        "algorithm_nodes": {key: {"type": nodes[key]["type"], "widgets_values": nodes[key].get("widgets_values")}
                            for key in must_retain},
        "inactive_mode4_nodes": bypassed,
        "model_paths": {
            "diffusion_models/flux.1-dev-SRPO-bf16.safetensors": "UNETLoader node 118",
            "text_encoders/SD3/clip_l.safetensors": "DualCLIPLoader node 27 clip_name1",
            "text_encoders/SD3/t5xxl_fp16.safetensors": "DualCLIPLoader node 27 clip_name2",
            "vae/ae.safetensors": "VAELoader node 6",
            "loras/FLUX/Flux Dev模型4步出图lora_Flux Dev模型4步出图lora_Flux Dev 4-step.safetensors": "LoraLoaderModelOnly node 132; original name retained",
            "upscale_models/2xNomosUni_span_multijpg_ldl.pth": "UpscaleModelLoader node 37",
            "SEEDVR2/seedvr2_ema_7b-Q8_K_M.gguf": "SeedVR2LoadDiTModel node 266",
            "SEEDVR2/ema_vae_fp16.safetensors": "SeedVR2LoadVAEModel node 265",
        },
        "real_image_acceptance": "Not performed by this compiler; requires parent engine validation and an authorized GPU run.",
    }
    return selected, metadata


if __name__ == "__main__":
    graph, metadata = compile_graph()
    output = ROOT / "workflows"
    output.mkdir(exist_ok=True)
    (output / "upscale.json").write_text(json.dumps(graph, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "upscale-source.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Compiled {len(graph)} API nodes; original sampling, tiling, and SeedVR2 nodes retained")
