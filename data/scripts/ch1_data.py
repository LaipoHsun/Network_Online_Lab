"""第 1 章（度與度分布）的真實資料 → data/build/01-degree/*.json

用法（在 repo 根目錄）：
    python3 data/scripts/ch1_data.py --ugander <ugander.pdf>

需要 PyMuPDF（pymupdf）。PDF 因版權不放進 repo：
- Ugander, Karrer, Backstrom & Marlow 2011, The Anatomy of the Facebook Social Graph
  arXiv 版 https://arxiv.org/pdf/1111.4503v1（Fig. 1 在 PDF 第 3 頁，向量圖）

規則（docs/design.md「真實資料怎麼進到網站」）：論文只有圖沒有表時，JSON 標 digitized: true
並寫明數位化方法。中位數 99、平均約 190、7.21 億人、99.91% 在最大連通群，直接取自原文。
"""

from __future__ import annotations

import argparse
import bisect
import json
import math
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "build" / "01-degree"


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def ccdf_points(pdf: str) -> list[tuple[float, float]]:
    """Fig. 1(b) 的全球曲線（實線）頂點，換算成 (k, P(K ≥ k))。"""
    page = pymupdf.open(pdf)[2]
    words = page.get_text("words")
    drawings = page.get_drawings()
    # 面板 (b) 在頁面右半（x > 340）。刻度線：x 軸 1、10、100、1000 的位置由刻度文字下方的短線取得；
    # y 軸 1e+00 … 1e−04 的位置由刻度短線取得。
    xticks = sorted({round(d["rect"].x0, 2) for d in drawings
                     if d["rect"].x0 > 340 and d["rect"].width < 0.1 and 7 < d["rect"].height < 7.5 and d["rect"].y0 > 270})
    yticks = sorted({round(d["rect"].y0, 2) for d in drawings
                     if 340 < d["rect"].x0 < 351 and d["rect"].height < 0.1 and 7 < d["rect"].width < 7.5})
    # 刻度依序為 1, 5, 10, 50, 100, 500, 1000, 5000（文字只標 1、5、50、500、5000，短線每個都有）
    assert len(xticks) == 8, xticks
    assert len(yticks) == 5, yticks
    labels = [1, 5, 10, 50, 100, 500, 1000, 5000]
    # 最小平方法：x_pdf = a + b·log10(k)
    lx = [math.log10(v) for v in labels]
    n = len(lx)
    mx, my = sum(lx) / n, sum(xticks) / n
    b = sum((u - mx) * (v - my) for u, v in zip(lx, xticks)) / sum((u - mx) ** 2 for u in lx)
    a = my - b * mx
    # y：yticks 由上到下是 1e0, 1e-1, …, 1e-4
    y0, ydec = yticks[0], (yticks[-1] - yticks[0]) / 4
    assert any(w[4] == "(b)" for w in words)
    # 全球曲線：面板 (b) 裡由許多短線段組成、起點在 (k=1, 1.0) 的實線；美國那條是另一條（線段數 4,737 的那組）
    curve = [d for d in drawings if d["rect"].x0 > 340 and len(d["items"]) > 900]
    us = max(curve, key=lambda d: len(d["items"]))  # 美國曲線是單一一組，其餘四組合起來是全球曲線
    pts = set()
    for d in curve:
        if d is us:
            continue
        for it in d["items"]:
            for q in it[1:]:
                pts.add((round(q.x, 3), round(q.y, 3)))
    out = []
    for x, y in sorted(pts):
        k = 10 ** ((x - a) / b)
        p = 10 ** (-(y - y0) / ydec)
        out.append((k, p))
    return out


def ugander(pdf: str) -> None:
    pts = ccdf_points(pdf)
    ks = [k for k, _ in pts]

    def ccdf(k: float) -> float:
        """P(K ≥ k)：取最接近 k 的頂點（頂點落在整數 k 上）。"""
        j = bisect.bisect_left(ks, k - 0.5)
        return pts[min(j, len(pts) - 1)][1]

    # 取對數間距的整數 k，讓圖上大約 50 個點
    grid = sorted({max(1, round(10 ** (i / 13))) for i in range(0, 49)} | {5000})
    src = "Ugander et al. 2011, arXiv:1111.4503, Fig. 1(b)"
    points = []
    for k in grid:
        if k > ks[-1] + 1:
            break
        below = 1 - ccdf(k)  # 朋友數少於 k 的比例
        points.append({"x": k, "y": round(100 * below, 2), "source": src})
    if points[-1]["y"] < 99.99:
        points.append({"x": 5000, "y": 100.0, "source": src})
    method = ("arXiv 版 PDF 第 3 頁 Fig. 1(b) 為向量圖：以 PyMuPDF 讀出全球曲線（CCDF，對數–對數）的所有線段頂點，"
              "用軸上刻度短線的位置做對數座標換算（頂點恰好落在整數 k 上）。CCDF 是「朋友數 ≥ k 的比例」，"
              "這裡改畫成累積分布：y = 100 × (1 − CCDF(k)) = 朋友數少於 k 的人所佔百分比。")
    write("ugander_cdf", {
        "kind": "line",
        "description": "2011 年 5 月 Facebook 全球活躍用戶：朋友數少於 k 位的人所佔比例",
        "source": {"text": "Ugander, Karrer, Backstrom & Marlow 2011, The Anatomy of the Facebook Social Graph, arXiv:1111.4503, Fig. 1(b)（由圖讀取）",
                   "url": "https://arxiv.org/abs/1111.4503",
                   "sample": "2011 年 5 月全球 7.21 億位活躍 Facebook 用戶、687 億條好友關係", "year": 2011},
        "digitized": True,
        "digitization": {"figure": "Fig. 1(b)（全球）", "method": method},
        "summary": {
            "median": 99, "median_source": "Ugander et al. 2011, arXiv 版 p. 3：The median friend count for global users in our study was 99.",
            "mean": 190, "mean_source": "Ugander et al. 2011, arXiv 版 p. 2：687 億條邊、7.21 億人，平均約 190 位朋友（2 × 68.7e9 / 721e6 ≈ 190.6）",
            "users": 721_000_000, "users_source": "Ugander et al. 2011, arXiv 版 p. 1–2",
            "largest_component": 99.91, "largest_component_source": "Ugander et al. 2011, arXiv 版 p. 1、p. 5",
            "friend_cap": 5000, "friend_cap_source": "Ugander et al. 2011, arXiv 版 p. 3：Facebook 當時的好友上限",
            "below_10": round(100 * (1 - ccdf(10)), 1), "below_25": round(100 * (1 - ccdf(25)), 1),
            "below_200": round(100 * (1 - ccdf(200)), 1),
            "below_source": "由 Fig. 1(b) 讀取（約略值）",
        },
        "x": {"label": "朋友數 k", "scale": "log"}, "y": {"label": "朋友數少於 k 的人（%）"},
        "series": [{"name": "Facebook 全球用戶", "points": points}],
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ugander", required=True)
    args = ap.parse_args()
    ugander(args.ugander)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
