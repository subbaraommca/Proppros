"""Deep-merge a JSON fragment into src/locales/en.json (used while extracting strings).

Usage: python scripts/merge_locale.py fragment.json
"""
import json
import sys
from pathlib import Path

target = Path(__file__).resolve().parent.parent / "src" / "locales" / "en.json"


def merge(base: dict, extra: dict, path: str = "") -> None:
    for key, value in extra.items():
        if isinstance(value, dict):
            merge(base.setdefault(key, {}), value, f"{path}{key}.")
        else:
            if key in base and base[key] != value:
                print(f"  changed {path}{key}: {base[key]!r} -> {value!r}")
            base[key] = value


data = json.loads(target.read_text(encoding="utf-8"))
merge(data, json.loads(Path(sys.argv[1]).read_text(encoding="utf-8")))
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print("merged", sys.argv[1])
