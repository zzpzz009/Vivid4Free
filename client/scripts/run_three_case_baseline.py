import json
import os
import time
import uuid
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:8188"


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


def upload_image(path, image_type="input"):
    boundary, body = _multipart_form(
        fields={"type": image_type},
        files=[("image", path, "image/jpeg")],
    )
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
    req = Request(
        url=f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path):
    req = Request(url=f"{BASE}{path}", method="GET")
    with urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _set_number(inputs, value):
    if "Number" in inputs:
        inputs["Number"] = value
    elif "number" in inputs:
        inputs["number"] = value
    elif "value" in inputs:
        inputs["value"] = value


def run_preview_case(case_id, main_img, ref_img):
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    with open(os.path.join(root, "src", "json", "1.json"), "r", encoding="utf-8") as f:
        prompt = json.load(f)

    main_name = upload_image(main_img)["name"]
    ref_name = upload_image(ref_img)["name"]

    prompt["536"]["inputs"]["image"] = main_name
    prompt["605"]["inputs"]["image"] = ref_name
    prompt["762"]["inputs"]["positive"] = f"{case_id} 自动验证"
    prompt["1414"]["inputs"]["text"] = "auto validation"
    prompt["1399"]["inputs"]["noise_seed"] = 123456

    created = post_json("/prompt", {"prompt": prompt, "client_id": f"va-{case_id}-{int(time.time()*1000)}"})
    prompt_id = created["prompt_id"]
    started = time.time()

    for _ in range(180):
        time.sleep(1)
        try:
            hist = get_json(f"/history/{prompt_id}")
        except Exception:
            continue
        item = hist.get(prompt_id)
        if not item:
            continue
        images = item.get("outputs", {}).get("622", {}).get("images", [])
        if images:
            return {
                "case": case_id,
                "workflow": "preview",
                "ok": True,
                "prompt_id": prompt_id,
                "seconds": round(time.time() - started, 2),
                "filename": images[0].get("filename"),
            }
    return {
        "case": case_id,
        "workflow": "preview",
        "ok": False,
        "prompt_id": prompt_id,
        "seconds": round(time.time() - started, 2),
        "error": "timeout",
    }


def run_upscale_case(case_id, main_img):
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    with open(os.path.join(root, "src", "json", "wash_v64_single_upscale.json"), "r", encoding="utf-8") as f:
        prompt = json.load(f)

    main_name = upload_image(main_img)["name"]
    prompt["138"]["inputs"]["image"] = main_name
    _set_number(prompt["791"]["inputs"], 1300)
    _set_number(prompt["166"]["inputs"], 0.35)

    created = post_json("/prompt", {"prompt": prompt, "client_id": f"va-{case_id}-{int(time.time()*1000)}"})
    prompt_id = created["prompt_id"]
    started = time.time()

    for _ in range(240):
        time.sleep(1)
        try:
            hist = get_json(f"/history/{prompt_id}")
        except Exception:
            continue
        item = hist.get(prompt_id)
        if not item:
            continue
        images = item.get("outputs", {}).get("346", {}).get("images", [])
        if images:
            return {
                "case": case_id,
                "workflow": "upscale",
                "ok": True,
                "prompt_id": prompt_id,
                "seconds": round(time.time() - started, 2),
                "filename": images[0].get("filename"),
            }
    return {
        "case": case_id,
        "workflow": "upscale",
        "ok": False,
        "prompt_id": prompt_id,
        "seconds": round(time.time() - started, 2),
        "error": "timeout",
    }


def main():
    cases = [
        ("P-01", r"d:\ComfyUI_Vivid\test\01\01原图.jpg", r"d:\ComfyUI_Vivid\test\01\02参考.jpg"),
        ("P-02", r"d:\ComfyUI_Vivid\test\02\01原图.jpg", r"d:\ComfyUI_Vivid\test\02\02参考.jpg"),
    ]

    results = []
    for case_id, main_img, ref_img in cases:
        try:
            results.append(run_preview_case(case_id, main_img, ref_img))
        except Exception as e:
            results.append({"case": case_id, "workflow": "preview", "ok": False, "error": str(e)})

    try:
        results.append(run_upscale_case("U-01", r"d:\ComfyUI_Vivid\test\03\03放大.jpg"))
    except Exception as e:
        results.append({"case": "U-01", "workflow": "upscale", "ok": False, "error": str(e)})

    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
