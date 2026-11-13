#!/usr/bin/env python3
"""Composite Design's ticket layers (or serve a pre-rendered 32-state PNG)."""
import argparse, json, os, sys
from pathlib import Path
from PIL import Image

DEVNET = Path(__file__).resolve().parent.parent
ART = Path("/workspace/breakpoint-ticket")
LAYERS_JSON = ART / "layers.json"
LAYERS_PNG = ART / "layers_png"
RENDERS = ART / "renders"
SLOTS = ["door", "side_a", "side_b", "side_c", "side_d"]

def state_id(flags: dict) -> str:
    return "".join("1" if str(flags.get(s, "0")) == "1" else "0" for s in SLOTS)

def flags_from_args(raw: str) -> dict:
    data = json.loads(raw)
    if isinstance(data, dict):
        return data
    raise SystemExit("flags must be a JSON object")

def composite(flags: dict) -> Image.Image:
    sid = state_id(flags)
    prerendered = RENDERS / f"state_{sid}.png"
    if prerendered.exists():
        return Image.open(prerendered).convert("RGBA")
    layers = sorted(json.loads(LAYERS_JSON.read_text()), key=lambda l: l["z"])
    im = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    on = {s: str(flags.get(s, "0")) == "1" for s in SLOTS}
    for layer in layers:
        flag = layer["flag"]
        if flag == "always":
            use = True
        elif flag == "all":
            use = all(on.values())
        else:
            use = on.get(flag, False)
        if not use:
            continue
        png = LAYERS_PNG / Path(layer["file"]).name.replace(".svg", ".png")
        if not png.exists():
            raise SystemExit(f"missing layer PNG: {png}")
        im = Image.alpha_composite(im, Image.open(png).convert("RGBA"))
    return im

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--flags", required=True, help="JSON object of flag values")
    p.add_argument("--out", required=True)
    args = p.parse_args()
    flags = flags_from_args(args.flags)
    im = composite(flags)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(out)
    print(out)

if __name__ == "__main__":
    main()
