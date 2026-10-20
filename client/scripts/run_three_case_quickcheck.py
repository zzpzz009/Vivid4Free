import json
import os
import time
import uuid
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:8188"
SUBMIT_TIMEOUT_SEC = 15
HISTORY_VISIBLE_TIMEOUT_SEC = 60
PREVIEW_OUTPUT_TIMEOUT_SEC = 180
UPSCALE_OUTPUT_TIMEOUT_SEC = 240
PREVIEW_OUTPUT_NODE = "1407"
UPSCALE_OUTPUT_NODE = "346"


def _multipart_form(fields, files):
    boundary = "----WebKitFormBoundary" + uuid.uuid4().hex
    body = bytearray()

    def add(s):
        body.extend(s.encode("utf-8"))

    for name, value in fields.items():
        add(f"--{boundary}\r\n")
        add(f'Content-Disposition: form-data; name="{name}"\r\n\r\n')
        add(str(value))
        add("\r\n")

    for name, path, content_type in files:
        filename = os.path.basename(path)
        add(f"--{boundary}\r\n")
        add(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n')
        add(f"Content-Type: {content_type}\r\n\r\n")
        with open(path, "rb") as f:
            body.extend(f.read())
        add("\r\n")

    add(f"--{boundary}--\r\n")
    return boundary, bytes(body)


def upload(path):
    boundary, body = _multipart_form({"type": "input"}, [("image", path, "image/jpeg")])
    req = Request(
        url=f"{BASE}/upload/image",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_json(path, payload):
    data = json.dumps(payload).encode("utf-8")
    req = Request(url=f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path):
    req = Request(url=f"{BASE}{path}", method="GET")
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def queue_has_prompt(prompt_id):
    try:
        data = get_json("/queue")
    except Exception:
        return False
    queue_running = data.get("queue_running") or []
    queue_pending = data.get("queue_pending") or []
    merged = list(queue_running) + list(queue_pending)
    for item in merged:
        if isinstance(item, list) and len(item) > 1 and str(item[1]) == str(prompt_id):
            return True
    return False


def set_number(inputs, value):
    if "Number" in inputs:
        inputs["Number"] = value
    elif "number" in inputs:
        inputs["number"] = value
    elif "value" in inputs:
        inputs["value"] = value


def submit_preview(case_id, main_img, ref_img):
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    with open(os.path.join(root, "src", "json", "1.json"), "r", encoding="utf-8") as f:
        prompt = json.load(f)
    main_name = upload(main_img)["name"]
    ref_name = upload(ref_img)["name"]
    prompt["536"]["inputs"]["image"] = main_name
    prompt["605"]["inputs"]["image"] = ref_name
    prompt["762"]["inputs"]["positive"] = f"{case_id} 快速校验"
    prompt["1414"]["inputs"]["text"] = "quick check"
    prompt["1399"]["inputs"]["noise_seed"] = 123456
    result = post_json("/prompt", {"prompt": prompt, "client_id": f"quick-{case_id}-{int(time.time()*1000)}"})
    return result["prompt_id"]


def submit_upscale(case_id, main_img):
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    with open(os.path.join(root, "src", "json", "wash_v64_single_upscale.json"), "r", encoding="utf-8") as f:
        prompt = json.load(f)
    main_name = upload(main_img)["name"]
    prompt["138"]["inputs"]["image"] = main_name
    set_number(prompt["791"]["inputs"], 1300)
    set_number(prompt["166"]["inputs"], 0.35)
    result = post_json("/prompt", {"prompt": prompt, "client_id": f"quick-{case_id}-{int(time.time()*1000)}"})
    return result["prompt_id"]


def observe_layered(case_id, prompt_id, output_node, output_timeout_sec):
    started = time.time()
    history_visible_at = None
    queue_visible_at = None
    last_status = "submitted"
    while time.time() - started < output_timeout_sec:
        time.sleep(2)
        if queue_visible_at is None and queue_has_prompt(prompt_id):
            queue_visible_at = time.time()
        try:
            hist = get_json(f"/history/{prompt_id}")
        except Exception:
            continue
        item = hist.get(prompt_id)
        if not item:
            if time.time() - started > HISTORY_VISIBLE_TIMEOUT_SEC:
                if queue_visible_at is not None:
                    continue
                return {
                    "case": case_id,
                    "prompt_id": prompt_id,
                    "ok": False,
                    "submit_ok": True,
                    "history_visible_ok": False,
                    "queue_visible_ok": queue_visible_at is not None,
                    "visibility_ok": queue_visible_at is not None,
                    "output_ok": False,
                    "status": last_status,
                    "queue_visible_in_sec": round(queue_visible_at - started, 2) if queue_visible_at else None,
                    "error": f"history not visible within {HISTORY_VISIBLE_TIMEOUT_SEC}s",
                }
            continue
        if history_visible_at is None:
            history_visible_at = time.time()
        outputs = item.get("outputs", {})
        images = outputs.get(str(output_node), {}).get("images", [])
        if images:
            return {
                "case": case_id,
                "prompt_id": prompt_id,
                "ok": True,
                "submit_ok": True,
                "history_visible_ok": True,
                "queue_visible_ok": queue_visible_at is not None,
                "visibility_ok": True,
                "output_ok": True,
                "status": "completed",
                "queue_visible_in_sec": round(queue_visible_at - started, 2) if queue_visible_at else None,
                "history_visible_in_sec": round(history_visible_at - started, 2),
                "output_in_sec": round(time.time() - started, 2),
                "filename": images[0].get("filename"),
            }
        status = item.get("status") or item.get("state") or "history_found_no_output"
        last_status = status
    return {
        "case": case_id,
        "prompt_id": prompt_id,
        "ok": False,
        "submit_ok": True,
        "history_visible_ok": history_visible_at is not None,
        "queue_visible_ok": queue_visible_at is not None,
        "visibility_ok": history_visible_at is not None or queue_visible_at is not None,
        "output_ok": False,
        "status": last_status,
        "queue_visible_in_sec": round(queue_visible_at - started, 2) if queue_visible_at else None,
        "history_visible_in_sec": round(history_visible_at - started, 2) if history_visible_at else None,
        "error": f"no output within {output_timeout_sec}s",
    }


def main():
    results = []
    try:
        p1 = submit_preview("P-01", r"d:\ComfyUI_Vivid\test\01\01原图.jpg", r"d:\ComfyUI_Vivid\test\01\02参考.jpg")
        results.append(observe_layered("P-01", p1, PREVIEW_OUTPUT_NODE, PREVIEW_OUTPUT_TIMEOUT_SEC))
    except Exception as e:
        results.append({"case": "P-01", "ok": False, "submit_ok": False, "error": str(e)})
    try:
        p2 = submit_preview("P-02", r"d:\ComfyUI_Vivid\test\02\01原图.jpg", r"d:\ComfyUI_Vivid\test\02\02参考.jpg")
        results.append(observe_layered("P-02", p2, PREVIEW_OUTPUT_NODE, PREVIEW_OUTPUT_TIMEOUT_SEC))
    except Exception as e:
        results.append({"case": "P-02", "ok": False, "submit_ok": False, "error": str(e)})
    try:
        u1 = submit_upscale("U-01", r"d:\ComfyUI_Vivid\test\03\03放大.jpg")
        results.append(observe_layered("U-01", u1, UPSCALE_OUTPUT_NODE, UPSCALE_OUTPUT_TIMEOUT_SEC))
    except Exception as e:
        results.append({"case": "U-01", "ok": False, "submit_ok": False, "error": str(e)})
    summary = {
        "thresholds": {
            "submit_sec": SUBMIT_TIMEOUT_SEC,
            "visibility_sec": HISTORY_VISIBLE_TIMEOUT_SEC,
            "preview_output_sec": PREVIEW_OUTPUT_TIMEOUT_SEC,
            "upscale_output_sec": UPSCALE_OUTPUT_TIMEOUT_SEC,
        },
        "pass_count": sum(1 for r in results if r.get("ok")),
        "visibility_pass_count": sum(1 for r in results if r.get("visibility_ok")),
        "total": len(results),
    }
    print(json.dumps({"summary": summary, "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
