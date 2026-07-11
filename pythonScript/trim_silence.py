"""
视频静音前缀裁剪脚本
====================
自动检测 MP4 文件开头的静音段，裁剪到声音实际开始的位置。

依赖：需要安装 ffmpeg 并加入系统 PATH
  - pip install imageio-ffmpeg   （推荐，自动内置 ffmpeg）

用法：
  python trim_silence.py                  # 处理 ../public/video/ 下所有 mp4
  python trim_silence.py -i 某个文件.mp4  # 只处理单个文件
  python trim_silence.py --threshold -40  # 自定义静音阈值(dB)，默认-35
  python trim_silence.py --dry-run        # 仅检测不裁剪，预览结果
"""

import subprocess
import sys
import os
import re
import shutil
import argparse
from pathlib import Path

# 修复 Windows 终端编码问题
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


# ─── 配置 ───────────────────────────────────────────────
DEFAULT_VIDEO_DIR = Path(__file__).resolve().parent.parent / "public" / "video"
DEFAULT_THRESHOLD_DB = -35     # 低于此分贝视为静音
DEFAULT_MIN_SILENCE = 0.08     # 最短静音时长(秒)，低于此不算静音段
OUTPUT_SUFFIX = "_trimmed"     # 输出文件名后缀
# ────────────────────────────────────────────────────────


def get_ffmpeg_path() -> str:
    """获取 ffmpeg 可执行文件路径（优先系统 PATH，其次 imageio-ffmpeg 内置）"""
    system_ff = shutil.which("ffmpeg")
    if system_ff:
        return system_ff
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def get_ffprobe_path() -> str:
    """获取 ffprobe 路径（imageio-ffmpeg 不自带 ffprobe，尝试同目录查找）"""
    sp = shutil.which("ffprobe")
    if sp:
        return sp
    ff = get_ffmpeg_path()
    if ff:
        probe = Path(ff).with_name("ffprobe" + Path(ff).suffix)
        if probe.exists():
            return str(probe)
    return "ffprobe"  # 回退到系统默认


FFMPEG = ""
FFPROBE = ""


def check_ffmpeg():
    """检查 ffmpeg 是否可用"""
    global FFMPEG, FFPROBE
    FFMPEG = get_ffmpeg_path()
    FFPROBE = get_ffprobe_path()
    if not FFMPEG:
        print("[X] 未找到 ffmpeg！请安装：")
        print("   pip install imageio-ffmpeg    （推荐，自动内置）")
        print("   或手动下载: https://ffmpeg.org/download.html")
        sys.exit(1)
    print(f"[OK] ffmpeg 已就绪: {FFMPEG}")


def detect_silence_end(filepath: Path, threshold_db: float, min_silence: float) -> float:
    """
    使用 ffmpeg silencedetect 滤镜检测音频开头的静音段。
    返回静音结束的时间戳(秒)，如果没有静音则返回 0。
    """
    cmd = [
        FFMPEG, "-i", str(filepath),
        "-af", f"silencedetect=noise={threshold_db}dB:d={min_silence}",
        "-f", "null", "-"
    ]

    result = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace"
    )

    # silencedetect 输出示例：
    # [silencedetect @ ...] silence_start: 0
    # [silencedetect @ ...] silence_end: 1.234 | silence_duration: 1.234
    output = result.stderr

    # 找到第一个 silence_end（即开头静音结束的位置）
    matches = re.findall(r"silence_end:\s*([\d.]+)", output)
    starts = re.findall(r"silence_start:\s*([\d.]+)", output)

    if not starts:
        # 没有检测到任何静音段
        return 0.0

    first_start = float(starts[0])
    # 只有开头就是静音(start ≈ 0)才需要裁剪
    if first_start > 0.1:
        return 0.0

    if matches:
        first_end = float(matches[0])
        # 往前回退一点(50ms)，避免裁掉声音起始的瞬态
        return max(0.0, first_end - 0.05)

    # 整段都是静音的情况
    return 0.0


def get_duration(filepath: Path) -> float:
    """获取视频总时长（优先 ffprobe，回退用 ffmpeg）"""
    # 优先用 ffprobe
    if FFPROBE and shutil.which(FFPROBE):
        cmd = [
            FFPROBE, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(filepath)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        try:
            return float(result.stdout.strip())
        except ValueError:
            pass
    # 回退：用 ffmpeg 获取时长
    cmd2 = [
        FFMPEG, "-i", str(filepath), "-f", "null", "-"
    ]
    result2 = subprocess.run(cmd2, capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = re.search(r"Duration:\s*([\d:]+(?:\.[\d]+)?)", result2.stderr)
    if m:
        parts = m.group(1).split(":")
        return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    return 0.0


def trim_video(filepath: Path, start_time: float, output_path: Path):
    """使用 ffmpeg 裁剪视频，从 start_time 开始，保留音视频同步"""
    cmd = [
        FFMPEG, "-y",
        "-i", str(filepath),
        "-ss", str(start_time),       # 起始偏移
        "-c:v", "libx264",            # 重新编码视频(保证精确裁剪)
        "-c:a", "aac",                # 重新编码音频
        "-preset", "fast",            # 编码速度
        "-crf", "18",                 # 视频质量(越低越好)
        "-b:a", "192k",              # 音频比特率
        "-movflags", "+faststart",    # Web 友好(MP4 头前置)
        str(output_path)
    ]

    subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def process_file(filepath: Path, threshold_db: float, min_silence: float,
                 dry_run: bool, overwrite: bool):
    """处理单个文件"""
    print(f"\n{'─' * 50}")
    print(f"\n[FILE] {filepath.name}")

    duration = get_duration(filepath)
    if duration <= 0:
        print("   [!] 无法读取时长，跳过")
        return

    silence_end = detect_silence_end(filepath, threshold_db, min_silence)

    if silence_end <= 0.01:
        print(f"   [OK] 开头无静音，无需裁剪 (总时长 {duration:.2f}s)")
        return

    saved_pct = (silence_end / duration) * 100
    print(f"   [SILENT] 开头静音: {silence_end:.3f}s / 总时长: {duration:.2f}s (节省 {saved_pct:.1f}%)")

    if dry_run:
        print(f"   [DRY] 将裁剪到 {silence_end:.3f}s 开始")
        return

    # 生成输出文件名
    if overwrite:
        output_path = filepath.with_name(filepath.stem + "_tmp" + filepath.suffix)
    else:
        output_path = filepath.with_name(filepath.stem + OUTPUT_SUFFIX + filepath.suffix)

    print(f"   [CUT] 裁剪中 -> {output_path.name} ...", end="", flush=True)
    trim_video(filepath, silence_end, output_path)

    if output_path.exists() and output_path.stat().st_size > 0:
        new_duration = get_duration(output_path)
        print(f" 完成! ({duration:.2f}s → {new_duration:.2f}s)")

        if overwrite:
            # 替换原文件
            backup = filepath.with_name(filepath.stem + ".bak" + filepath.suffix)
            filepath.rename(backup)
            output_path.rename(filepath)
            backup.unlink()
            print(f"   [SAVED] 已替换原文件")
    else:
        print(f"   [X] 裁剪失败!")


def main():
    parser = argparse.ArgumentParser(description="裁剪 MP4 开头的静音段")
    parser.add_argument("-i", "--input", help="指定单个文件路径（而非整个目录）")
    parser.add_argument("-d", "--dir", default=str(DEFAULT_VIDEO_DIR), help="视频目录路径")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD_DB,
                        help=f"静音阈值(dB)，默认 {DEFAULT_THRESHOLD_DB}")
    parser.add_argument("--min-silence", type=float, default=DEFAULT_MIN_SILENCE,
                        help=f"最短静音时长(s)，默认 {DEFAULT_MIN_SILENCE}")
    parser.add_argument("--dry-run", action="store_true", help="仅检测，不裁剪")
    parser.add_argument("--overwrite", action="store_true", help="直接覆盖原文件")
    args = parser.parse_args()

    check_ffmpeg()

    if args.input:
        files = [Path(args.input)]
        if not files[0].exists():
            print(f"[X] 文件不存在: {args.input}")
            sys.exit(1)
    else:
        video_dir = Path(args.dir)
        if not video_dir.exists():
            print(f"[X] 目录不存在: {video_dir}")
            sys.exit(1)
        files = sorted(video_dir.glob("*.mp4"))
        if not files:
            print(f"[!] 目录中无 MP4 文件: {video_dir}")
            sys.exit(0)

    print(f"\n共找到 {len(files)} 个 MP4 文件")
    print(f"静音阈值: {args.threshold} dB | 最短静音: {args.min_silence}s")
    if args.dry_run:
        print("[DRY-RUN] 预览模式：仅检测，不执行裁剪")

    for f in files:
        process_file(f, args.threshold, args.min_silence, args.dry_run, args.overwrite)

    print(f"\n{'─' * 50}")
    print("\n全部处理完成!")


if __name__ == "__main__":
    main()
