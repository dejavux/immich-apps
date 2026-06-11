#!/usr/bin/env python3
"""Immich photo-sync runner (invoked from immich-sync.sh)."""

from __future__ import annotations

import json
import os
import pty
import re
import select
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import yaml


def log(log_file: str, msg: str) -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}\n"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(line)
    print(line, end="")


def empty_stats() -> dict:
    return {
        "new_files": 0,
        "duplicates": 0,
        "new_assets": 0,
        "failed_assets": 0,
    }


def parse_immich_upload_output(stdout: str) -> dict:
    """Parse immich CLI upload text output (v2.x no longer supports -j)."""
    stats = empty_stats()
    found = re.search(r"Found (\d+) new files and (\d+) duplicates", stdout)
    if found:
        stats["new_files"] = int(found.group(1))
        stats["duplicates"] = int(found.group(2))
    uploaded = re.search(r"Successfully uploaded (\d+) new assets?", stdout)
    if uploaded:
        stats["new_assets"] = int(uploaded.group(1))
    else:
        planned = re.search(r"Would have uploaded (\d+) assets?", stdout)
        if planned:
            stats["new_assets"] = int(planned.group(1))
            stats["dry_run_planned"] = True
    failed = re.search(r"Failed to upload (\d+) assets?", stdout)
    if failed:
        stats["failed_assets"] = int(failed.group(1))
    return stats


def extract_failed_paths(stdout: str) -> list[str]:
    return re.findall(r"^- (.+?) - Error$", stdout, re.MULTILINE)


def is_transient_error(stdout: str, exit_code: int) -> bool:
    if exit_code == 0:
        return False
    if re.search(r"\b502\b|\b503\b|\b504\b|ECONNRESET|ETIMEDOUT", stdout):
        return True
    return "updateAlbums" in stdout and exit_code != 0


def merge_stats(total: dict, run: dict) -> dict:
    merged = dict(total)
    if run.get("new_files") or not merged.get("new_files"):
        merged["new_files"] = run.get("new_files", 0)
    if run.get("duplicates") or not merged.get("duplicates"):
        merged["duplicates"] = run.get("duplicates", 0)
    merged["new_assets"] = merged.get("new_assets", 0) + run.get("new_assets", 0)
    merged["failed_assets"] = run.get("failed_assets", 0)
    return merged


def build_upload_cmd(
    *,
    url: str,
    api_key: str,
    paths: list[str],
    album: str,
    recursive: bool,
    concurrency: int,
    dry: bool,
) -> list[str]:
    cmd = ["immich", "-u", url, "-k", api_key, "upload", *paths]
    if recursive and len(paths) == 1 and Path(paths[0]).is_dir():
        cmd.append("--recursive")
    cmd.extend(["-A", album, "-c", str(concurrency)])
    if dry:
        cmd.append("-n")
    return cmd


def run_immich_with_tee(cmd: list[str], log_path: Path) -> tuple[int, str]:
    """Stream immich via pseudo-TTY so \\r progress bars render (pipe breaks them)."""
    master_fd, slave_fd = pty.openpty()
    chunks: list[str] = []
    with log_path.open("w", encoding="utf-8") as logf:
        proc = subprocess.Popen(
            cmd,
            stdout=slave_fd,
            stderr=slave_fd,
            stdin=slave_fd,
            close_fds=True,
        )
        os.close(slave_fd)

        def drain() -> bool:
            try:
                data = os.read(master_fd, 4096)
            except OSError:
                return False
            if not data:
                return False
            text = data.decode("utf-8", errors="replace")
            sys.stdout.write(text)
            sys.stdout.flush()
            logf.write(text)
            logf.flush()
            chunks.append(text)
            return True

        try:
            while True:
                ready, _, _ = select.select([master_fd], [], [], 0.2)
                if master_fd in ready:
                    if not drain():
                        break
                if proc.poll() is not None:
                    while drain():
                        pass
                    break
        finally:
            os.close(master_fd)
        code = proc.wait()
        return code, "".join(chunks)


def run_upload_with_retries(
    *,
    log_file: str,
    lib_id: str,
    url: str,
    api_key: str,
    lib_path: Path,
    album: str,
    recursive: bool,
    concurrency: int,
    stats_dir: Path,
    dry: bool,
    retry_failed: bool,
    retry_concurrency: int,
    max_retries: int,
    retry_delay: int,
) -> tuple[int, dict, Path]:
    base_cmd = build_upload_cmd(
        url=url,
        api_key=api_key,
        paths=[str(lib_path)],
        album=album,
        recursive=recursive,
        concurrency=concurrency,
        dry=dry,
    )
    run_log = stats_dir / f"{lib_id}-run-{datetime.now():%Y%m%d-%H%M%S}.log"
    result_code, output = run_immich_with_tee(base_cmd, run_log)
    total_stats = parse_immich_upload_output(output)
    failed_paths = extract_failed_paths(output)

    if failed_paths:
        failed_list = stats_dir / f"{lib_id}-failed-{datetime.now():%Y%m%d-%H%M%S}.txt"
        failed_list.write_text("\n".join(failed_paths) + "\n", encoding="utf-8")
        log(log_file, f"FAILED_LIST {failed_list} count={len(failed_paths)}")

    if (
        not dry
        and retry_failed
        and failed_paths
        and total_stats.get("failed_assets", 0) > 0
    ):
        log(
            log_file,
            f"RETRY failed uploads library={lib_id} "
            f"count={len(failed_paths)} concurrency={retry_concurrency}",
        )
        retry_cmd = build_upload_cmd(
            url=url,
            api_key=api_key,
            paths=failed_paths,
            album=album,
            recursive=False,
            concurrency=retry_concurrency,
            dry=False,
        )
        retry_log = stats_dir / f"{lib_id}-retry-{datetime.now():%Y%m%d-%H%M%S}.log"
        retry_code, retry_output = run_immich_with_tee(retry_cmd, retry_log)
        retry_stats = parse_immich_upload_output(retry_output)
        total_stats = merge_stats(total_stats, retry_stats)
        output += "\n" + retry_output
        if retry_stats.get("failed_assets", 0) == 0:
            result_code = 0 if retry_code == 0 else retry_code
        elif retry_stats.get("new_assets", 0) > 0:
            result_code = retry_code

    attempt = 0
    while (
        not dry
        and attempt < max_retries
        and result_code != 0
        and is_transient_error(output, result_code)
    ):
        attempt += 1
        log(
            log_file,
            f"RETRY transient library={lib_id} attempt={attempt}/{max_retries} "
            f"delay={retry_delay}s",
        )
        time.sleep(retry_delay)
        retry_log = stats_dir / f"{lib_id}-transient-{datetime.now():%Y%m%d-%H%M%S}.log"
        result_code, retry_output = run_immich_with_tee(base_cmd, retry_log)
        retry_stats = parse_immich_upload_output(retry_output)
        total_stats = merge_stats(total_stats, retry_stats)
        output += "\n" + retry_output
        if result_code == 0:
            break

    return result_code, total_stats, run_log


def print_watch_config(config_path: str) -> int:
    with open(config_path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    log_dir = Path(
        os.path.expanduser(cfg.get("sync", {}).get("log_dir", "~/Library/Logs/immich-photo-sync"))
    )
    debounce = cfg.get("sync", {}).get("debounce_seconds", 30)
    print(f"LOG_DIR={log_dir}")
    print(f"DEBOUNCE={debounce}")
    for lib in cfg.get("libraries", []):
        if lib.get("enabled", True):
            print(os.path.expanduser(lib.get("path", "")))
    return 0


def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "--watch-config":
        if len(sys.argv) != 3:
            print("Usage: immich_sync_runner.py --watch-config CONFIG.yaml", file=sys.stderr)
            return 1
        return print_watch_config(sys.argv[2])

    config_path, only_lib, dry_run, log_file = sys.argv[1:5]
    dry = dry_run == "true"

    with open(config_path, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    immich_cfg = cfg.get("immich", {})
    url = os.environ.get("IMMICH_INSTANCE_URL") or immich_cfg.get("instance_url", "")
    api_key = os.environ.get("IMMICH_API_KEY", "")
    if not api_key:
        log(log_file, "ERROR: IMMICH_API_KEY not set")
        return 1
    if url:
        os.environ["IMMICH_INSTANCE_URL"] = url.rstrip("/")

    sync_cfg = cfg.get("sync", {})
    recursive = sync_cfg.get("recursive", True)
    concurrency = sync_cfg.get("upload_concurrency", 2)
    retry_failed = sync_cfg.get("retry_failed_uploads", True)
    retry_concurrency = sync_cfg.get("retry_concurrency", 1)
    max_retries = sync_cfg.get("max_retries", 2)
    retry_delay = sync_cfg.get("retry_delay_seconds", 30)
    json_output = sync_cfg.get("json_output", True)
    os.environ["IMMICH_UPLOAD_CONCURRENCY"] = str(concurrency)

    log_dir = Path(log_file).parent
    stats_dir = log_dir / "stats"
    stats_dir.mkdir(parents=True, exist_ok=True)

    for lib in cfg.get("libraries", []):
        if not lib.get("enabled", True):
            continue
        lib_id = lib.get("id", "")
        if only_lib and lib_id != only_lib:
            continue
        lib_path = Path(os.path.expanduser(lib.get("path", "")))
        album = lib.get("album", lib.get("name", lib_id))
        if not lib_path.is_dir():
            log(log_file, f"ERROR library={lib_id} path not found: {lib_path}")
            continue
        log(log_file, f"START library={lib_id} path={lib_path} album={album}")
        result_code, stats, run_log = run_upload_with_retries(
            log_file=log_file,
            lib_id=lib_id,
            url=os.environ["IMMICH_INSTANCE_URL"],
            api_key=api_key,
            lib_path=lib_path,
            album=album,
            recursive=recursive,
            concurrency=concurrency,
            stats_dir=stats_dir,
            dry=dry,
            retry_failed=retry_failed,
            retry_concurrency=retry_concurrency,
            max_retries=max_retries,
            retry_delay=retry_delay,
        )
        if json_output and stats:
            failed_count = stats.get("failed_assets", 0)
            log(
                log_file,
                f"STATS library={lib_id} new_files={stats['new_files']} "
                f"duplicates={stats['duplicates']} new_assets={stats['new_assets']} "
                f"failed_assets={failed_count}",
            )
            stats_path = stats_dir / f"{lib_id}-{datetime.now():%Y%m%d-%H%M%S}.json"
            payload = {
                "library_id": lib_id,
                "dry_run": dry,
                "at": datetime.now().isoformat(),
                "run_log": str(run_log),
                **stats,
            }
            stats_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            log(log_file, f"STATS_JSON {stats_path}")

        if result_code == 0:
            log(log_file, f"DONE library={lib_id}")
        elif stats.get("new_assets", 0) > 0:
            log(
                log_file,
                f"PARTIAL library={lib_id} uploaded={stats['new_assets']} "
                f"failed={stats.get('failed_assets', 0)} "
                f"(exit={result_code}; see {run_log})",
            )
        else:
            log(log_file, f"FAILED library={lib_id} exit={result_code} (see {run_log})")
            return result_code

    log(log_file, "All libraries processed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
