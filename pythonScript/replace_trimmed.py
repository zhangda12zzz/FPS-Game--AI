"""用 _trimmed 版本替换原文件"""
import os
import shutil
from pathlib import Path

video_dir = Path(__file__).resolve().parent.parent / "public" / "video"

count = 0
for f in sorted(video_dir.glob("*_trimmed.mp4")):
    original = f.with_name(f.stem.replace("_trimmed", "") + ".mp4")
    if original.exists():
        # 备份原文件
        bak = original.with_suffix(".bak.mp4")
        original.rename(bak)
        f.rename(original)
        bak.unlink()
        print(f"  {original.name} <- {f.name}")
        count += 1
    else:
        print(f"  [SKIP] 原文件不存在: {original.name}")

print(f"\n共替换 {count} 个文件")
