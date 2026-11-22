"""第 5 章（友誼悖論）的真實資料 → data/build/05-friendship-paradox/*.json

用法（在 repo 根目錄）：
    python3 data/scripts/ch5_data.py --christakis-fig <fig3.jpg> [--overlay <out.png>]

需要 numpy、Pillow。圖檔因版權不放進 repo：
- Christakis & Fowler 2010, Social Network Sensors for Early Detection of Contagious Outbreaks, PLoS ONE 5(9): e12948
  Figure 3（PMC 版：https://pmc.ncbi.nlm.nih.gov/articles/PMC2939797/ ，圖檔 pone.0012948.g003.jpg，661×333 像素）
- Pew Research Center 2012 的數字直接取自網頁原文。

規則：論文只有圖沒有表時，JSON 標 digitized: true 並寫明數位化方法。
319、425、744 人、提前 13.9 天（95% 信賴區間 9.9–16.6）直接取自原文。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "build" / "05-friendship-paradox"
PEW_URL = "https://www.pewresearch.org/internet/2012/02/03/part-3-the-structure-of-friendship/"


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def pew() -> None:
    src = "Pew Research Center 2012, Part 3: The structure of friendship（Your friends have more friends than you 段）"
    source = {"text": "Pew Research Center 2012, Why Most Facebook Users Get More Than They Give, Part 3: The structure of friendship",
              "url": PEW_URL, "sample": "Pew 研究樣本中的 Facebook 用戶", "year": 2012}
    write("pew_paradox_share", {
        "kind": "bar",
        "description": "朋友數少於「自己朋友的平均朋友數」的人所佔比例",
        "source": source, "digitized": False,
        "x": {"label": "Facebook 用戶"}, "y": {"label": "比例（%）"},
        "series": [{"name": "Pew 2012", "points": [
            {"x": "朋友比自己的朋友少", "y": 84, "source": src + "：84%"},
            {"x": "不比自己的朋友少", "y": 16, "source": src + "：100% − 84%"},
        ]}],
    })
    write("pew_friend_counts", {
        "kind": "bar",
        "description": "一般用戶的朋友數，和他們朋友的平均朋友數",
        "source": source, "digitized": False,
        "x": {"label": ""}, "y": {"label": "朋友數（平均）"},
        "series": [{"name": "Pew 2012", "points": [
            {"x": "用戶本人", "y": 245, "source": src + "：the average Facebook user has 245 friends"},
            {"x": "用戶的朋友", "y": 359, "source": src + "：the average friend has a mean of 359 Facebook friends"},
        ]}],
        "facts": {"top10_threshold": 780,
                  "top10_source": src + "：only those … among the 10% largest friends lists (more than 780 friends) had more friends than their average friend"},
    })


# ---------------------------------------------------------------- Christakis & Fowler 2010 Figure 3 左圖

def christakis(fig: str, overlay_path: str | None) -> None:
    img = Image.open(fig).convert("RGB")
    a = np.asarray(img).astype(int)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    blue = (B > 150) & (R < 120) & (G < 140)   # 朋友組（實線）
    red = (R > 170) & (G < 120) & (B < 120)    # 隨機組（虛線）
    L = a.sum(2)
    gray = L < 600
    # 左圖座標框：灰色長線（上、下、左、右）
    rows = [y for y in range(a.shape[0]) if gray[y, 60:330].sum() > 200]
    cols = [x for x in range(40, 330) if gray[0:300, x].sum() > 200]
    top, bottom = rows[0], rows[-1]
    left, right = cols[0], cols[-1]
    # 刻度：x 軸 0、20、…、120 天；y 軸 0.00、0.02、…、0.08（由框外的刻度短線取得）
    ink = L < 500
    xt = [x for x in range(left - 5, right + 5) if ink[bottom + 2:bottom + 6, x].sum() >= 3]
    yt = [y for y in range(top, bottom + 3) if ink[y, left - 6:left - 1].sum() >= 4]
    x0, x120 = xt[0], xt[-1]
    y0, y02 = yt[-1], yt[-2]  # 0.00 與 0.02
    day_px = (x120 - x0) / 120
    per = (y0 - y02) / 0.02

    def level(mask, x):
        # 階梯函數：取該欄最上面那一段（垂直跳升時就是新的值）；跳過左上角的圖例
        ys = [y for y in range(top + 1, bottom - 1) if mask[y, x] and not (x < left + 70 and y < top + 27)]
        if not ys:
            return None
        runs = [[ys[0]]]
        for y in ys[1:]:
            if y - runs[-1][-1] <= 1:
                runs[-1].append(y)
            else:
                runs.append([y])
        r = runs[0]
        return r[0] + 1 if len(r) > 3 else (r[0] + r[-1]) / 2

    def near(mask, x, w=6):
        # 虛線有空隙：往左右最多 6 個像素找最近的一欄
        for dx in sorted(range(-w, w + 1), key=abs):
            v = level(mask, x + dx)
            if v is not None:
                return v
        return None

    series = {}
    marks = []
    for name, mask in (("朋友組（被提名為朋友的人）", blue), ("隨機組", red)):
        pts = []
        for day in range(0, 121, 2):
            v = near(mask, int(round(x0 + day * day_px)))
            if v is None:
                continue
            pct = max(0.0, (y0 - v) / per * 100)
            pts.append({"x": day, "y": round(pct, 2), "source": "Christakis & Fowler 2010, PLoS ONE 5(9), Figure 3 左"})
            marks.append((x0 + day * day_px, v))
        series[name] = pts
    if overlay_path:
        d = ImageDraw.Draw(img)
        for x, y in marks:
            d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], outline=(0, 160, 0))
        img.save(overlay_path)

    method = ("PMC 版 Figure 3（661×333 像素點陣圖）左圖：以灰色長線偵測座標框、以框外刻度短線定出 0 與 120 天、0.00 與 0.02。"
              "依顏色分出藍色實線（朋友組）與紅色虛線（隨機組），每 2 天取該欄曲線最上面一段的位置（階梯跳升時即新值）；"
              "虛線有空隙時往左右 6 個像素內找最近的一欄，找不到就略過該天。一個像素約 0.03 個百分點、0.5 天。為約略值。")
    write("christakis_flu", {
        "kind": "line",
        "description": "2009 年哈佛大學流感：朋友組與隨機組的累積發病比例（醫護人員診斷）",
        "source": {"text": "Christakis & Fowler 2010, Social Network Sensors for Early Detection of Contagious Outbreaks, PLoS ONE 5(9): e12948, Figure 3 左（由圖讀取）",
                   "url": "https://doi.org/10.1371/journal.pone.0012948",
                   "sample": "哈佛大學部隨機抽出 319 人，加上被他們提名為朋友的 425 人，共追蹤 744 人", "year": 2010},
        "digitized": True,
        "digitization": {"figure": "Figure 3 左", "method": method},
        "facts": {
            "random_n": 319, "friends_n": 425, "total_n": 744, "lead_days": 13.9, "lead_ci": [9.9, 16.6],
            "first_significant_day": 16, "days_before_peak": 46,
            "source": "Christakis & Fowler 2010, Abstract：744 students … 13.9 days (95% C.I. 9.9–16.6) in advance … "
                      "significant lead time (p < 0.05) on day 16 of the epidemic, a full 46 days before the peak",
        },
        "x": {"label": "9 月 1 日之後的天數"}, "y": {"label": "累積發病比例（%）"},
        "series": [{"name": k, "points": v} for k, v in series.items()],
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--christakis-fig", required=True)
    ap.add_argument("--overlay")
    args = ap.parse_args()
    pew()
    christakis(args.christakis_fig, args.overlay)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
