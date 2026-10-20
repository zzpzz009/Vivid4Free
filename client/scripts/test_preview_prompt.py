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
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path):
    req = Request(url=f"{BASE}{path}", method="GET")
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    img1 = os.path.join(root, "tests", "e2e", "fixtures", "test-main-image.jpg")
    img2 = os.path.join(root, "tests", "e2e", "fixtures", "test-reference-image.jpg")

    u1 = upload_image(img1)
    u2 = upload_image(img2)
    name1 = u1["name"]
    name2 = u2["name"]
    print("uploaded:", name1, name2)

    prompt_path = os.path.join(root, "src", "json", "1.json")
    with open(prompt_path, "r", encoding="utf-8") as f:
        prompt = json.load(f)

    prompt["536"]["inputs"]["image"] = name1
    prompt["605"]["inputs"]["image"] = name2
    prompt["762"]["inputs"]["positive"] = "测试提示词"
    prompt["1414"]["inputs"]["text"] = "test atmosphere description"
    prompt["1399"]["inputs"]["noise_seed"] = 123456

    resp = post_json("/prompt", {"prompt": prompt, "client_id": f"va-test-{int(time.time()*1000)}"})
    pid = resp["prompt_id"]
    print("prompt_id:", pid)

    for _ in range(120):
        time.sleep(1)
        try:
            hist = get_json(f"/history/{pid}")
        except Exception:
            continue
        job = hist.get(pid)
        if not job:
            continue
        outputs = job.get("outputs", {})
        out622 = outputs.get("622", {})
        images = out622.get("images", [])
        if images:
            img = images[0]
            print("done:", img.get("filename"), img.get("type"), img.get("subfolder"))
            return 0

    print("timeout")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

