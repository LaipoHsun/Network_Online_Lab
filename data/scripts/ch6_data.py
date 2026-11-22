"""第 6 章（弱連結）的真實資料 → data/build/06-weak-ties/*.json

用法（在 repo 根目錄）：
    python3 data/scripts/ch6_data.py --onnela <onnela.pdf> --rajkumar <rajkumar.pdf>

需要 PyMuPDF（pymupdf）與 numpy。兩份 PDF 因版權不放進 repo：
- Onnela 等人 2007：arXiv 版 https://arxiv.org/pdf/physics/0610104（Fig. 3 在 PDF 第 12 頁，點陣圖）
- Rajkumar 等人 2022：Science 377:1304（Fig. 3 在期刊第 1307 頁，向量圖）

規則（docs/design.md「真實資料怎麼進到網站」）：論文只有圖沒有表時，JSON 標 digitized: true
並寫明數位化方法。Granovetter 1973 的數字直接取自原文第 1371 頁，不是數位化。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pymupdf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "build" / "06-weak-ties"


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- Granovetter 1973

def granovetter() -> None:
    src = "Granovetter 1973, American Journal of Sociology 78(6), p. 1371"
    source = {"text": "Granovetter 1973, The Strength of Weak Ties, American Journal of Sociology 78(6), 頁 1371",
              "url": "https://doi.org/10.1086/225469",
              "sample": "波士頓郊區專業、技術與管理職換工作者中，透過人脈找到工作的 54 人（N = 54）",
              "year": 1973}
    write("granovetter_contact_frequency", {
        "kind": "bar",
        "description": "透過人脈找到工作的人，當時多常和介紹人見面",
        "source": source,
        "digitized": False,
        "definitions": {"常常見面": "每週至少兩次", "偶爾見面": "一年多於一次、但每週少於兩次", "很少見面": "一年一次或更少"},
        "x": {"label": "和介紹人見面的頻率"}, "y": {"label": "比例（%）"},
        "series": [{"name": "Granovetter 1973", "points": [
            {"x": "常常見面", "y": 16.7, "source": src},
            {"x": "偶爾見面", "y": 55.6, "source": src},
            {"x": "很少見面", "y": 27.8, "source": src},
        ]}],
    })


# ---------------------------------------------------------------- Onnela 2007（點陣圖，依顏色萃取）

def onnela(pdf: str) -> None:
    doc = pymupdf.open(pdf)
    pix = doc[11].get_pixmap(dpi=300)  # PDF 第 12 頁 = Fig. 3
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3].astype(int)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    red = (R > 170) & (G < 110) & (B < 110)
    blk = (R < 90) & (G < 90) & (B < 90)
    # 座標框（300 dpi 像素）：由長黑線偵測得到；R=1 在 y=401，R=0 在 y=817；f=0、1 在框的左右邊
    Y1, Y0 = 401, 817
    panels = {"A": (534, 1250), "B": (1444, 2161)}
    excl = {"A": [(982, 1236, 395, 640), (780, 880, 495, 730), (810, 920, 425, 580)],
            "B": [(1615, 1710, 580, 760), (1885, 2000, 505, 600)]}
    for p in excl:
        excl[p].append((panels[p][0], panels[p][0] + 90, 720, 816))  # 面板字母

    def bad(p, x, y):
        return any(x0 <= x <= x1 and y0 <= y <= y1 for x0, x1, y0, y1 in excl[p])

    curves = {}
    for p, (X0, X1) in panels.items():
        for name, mask in (("red", red), ("black", blk)):
            prev, miss, pts = float(Y1), 0, []
            for f in np.round(np.arange(0, 1.0001, 0.02), 2):
                xc = int(round(X0 + f * (X1 - X0)))
                ys = [y for x in range(max(X0 + 6, xc - 4), min(X1 - 6, xc + 4) + 1)
                      for y in range(Y1 + 4, Y0 - 3)
                      if mask[y, x] and not bad(p, x, y) and abs(y - prev) < 70 + 45 * miss]
                if not ys:
                    miss += 1
                    continue
                miss, prev = 0, float(np.median(ys))
                pts.append([float(f), (Y0 - prev) / (Y0 - Y1)])
            # 去掉落在文字標籤上的離群點：和前後各兩點的中位數差超過 0.05 的點
            vals = [v for _, v in pts]
            keep = []
            for i, (f, v) in enumerate(pts):
                nb = vals[max(0, i - 2):i] + vals[i + 1:i + 3]
                if nb and abs(v - float(np.median(nb))) > 0.05:
                    continue
                keep.append([f, round(0.0 if v < 0.02 else min(1.0, v), 3)])
            curves[(p, name)] = keep

    method = ("由 arXiv 版 PDF 第 12 頁（Fig. 3）以 300 dpi 繪製後依顏色萃取：紅色為先剪弱連結、黑色為先剪強連結；"
              "座標框由長黑線偵測，每隔 f = 0.02 取該欄曲線像素的中位數，剔除落在文字標籤上的離群點，"
              "小於 0.02 視為 0（標記半徑造成的偏差）。為約略值。")
    src = "Onnela et al. 2007, PNAS 104(18), Fig. 3"
    source = {"text": "Onnela 等人 2007, Structure and tie strengths in mobile communication networks, PNAS 104(18), Fig. 3（由圖讀取，約略值）",
              "url": "https://doi.org/10.1073/pnas.0610245104",
              "sample": "某國約 20% 人口 18 週的手機通話紀錄", "year": 2007}
    for panel, key, label in (("A", "weight", "連結強度 w（通話時間）"), ("B", "overlap", "鄰居重疊度 O")):
        write(f"onnela_removal_{key}", {
            "kind": "line",
            "description": f"依{label}排序剪斷連結時，最大連通群的相對大小",
            "source": source,
            "digitized": True,
            "digitization": {"figure": f"Fig. 3{panel}", "method": method},
            "critical_points": {"text": "有限尺寸標度給出的臨界點（先剪弱連結）：f_c^w = 0.80 ± 0.04、f_c^O = 0.62 ± 0.05；先剪強連結時沒有相變",
                                "source": "Onnela et al. 2007, arXiv 版 p. 6"},
            "x": {"label": "剪掉的連結比例 f"}, "y": {"label": "最大連通群的相對大小 R"},
            "series": [
                {"name": "先剪弱的", "points": [{"x": f, "y": v, "source": src} for f, v in curves[(panel, "red")]]},
                {"name": "先剪強的", "points": [{"x": f, "y": v, "source": src} for f, v in curves[(panel, "black")]]},
            ],
        })


# ---------------------------------------------------------------- Rajkumar 2022（向量圖，直接讀座標）

def rajkumar(pdf: str) -> None:
    pg = pymupdf.open(pdf)[3]  # 期刊第 1307 頁
    teal = (0.12, 0.74, 0.76)
    close = lambda c: c is not None and len(c) == 3 and all(abs(x - y) < 0.03 for x, y in zip(c, teal))
    # 面板 B 右（IV）：座標框大約 x 420–540、y 260–410（PDF 點）
    box = (420, 540, 260, 410)
    inside = lambda x, y: box[0] <= x <= box[1] and box[2] <= y <= box[3]
    marks, bars = [], []
    for d in pg.get_drawings():
        r = d["rect"]
        cx, cy = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
        if close(d.get("fill")) and inside(cx, cy):
            marks.append((cx, cy))
        if close(d.get("color")) and d["type"] == "s" and r.width < 0.5 and inside(cx, cy):
            bars.append((cx, r.y0, r.y1))
    # 用刻度文字定座標：x 標籤 0/10/20/30，y 標籤 0.000–0.004（取文字框中心，最小平方法）
    xs, ys = [], []
    for w in pg.get_text("words"):
        x0, y0, x1, y1, t = w[:5]
        if 414 < x0 < 530 and 410 < y0 < 425 and t in ("0", "10", "20", "30"):
            xs.append(((x0 + x1) / 2, float(t)))
        if 395 < x0 < 420 and 260 < y0 < 410 and t.startswith("0.00"):
            ys.append(((y0 + y1) / 2, float(t)))
    ax = np.polyfit([p for p, _ in xs], [v for _, v in xs], 1)
    ay = np.polyfit([p for p, _ in ys], [v for _, v in ys], 1)
    pts = []
    for cx, cy in sorted(marks):
        bar = min(bars, key=lambda b: abs(b[0] - cx)) if bars else None
        lo = hi = None
        if bar and abs(bar[0] - cx) < 0.5:
            lo, hi = float(np.polyval(ay, bar[2])), float(np.polyval(ay, bar[1]))
        pts.append({"x": round(float(np.polyval(ax, cx)), 1), "y": round(float(np.polyval(ay, cy)), 5),
                    "ci": [round(lo, 5), round(hi, 5)] if lo is not None else None,
                    "source": "Rajkumar et al. 2022, Science 377, Fig. 3B (IV)"})
    write("rajkumar_mutual_friends", {
        "kind": "scatter",
        "description": "LinkedIn 實驗：兩人共同朋友數（結構性連結強度）與這條連結帶來工作的機率",
        "source": {"text": "Rajkumar 等人 2022, A causal test of the strength of weak ties, Science 377(6612), Fig. 3B 右（IV 估計，由圖讀取）",
                   "url": "https://doi.org/10.1126/science.abl4476",
                   "sample": "LinkedIn 五年間超過 2,000 萬人的隨機實驗；約 20 億條新連結、60 萬份新工作", "year": 2022},
        "digitized": True,
        "digitization": {"figure": "Fig. 3B（右，IV）",
                         "method": "Fig. 3 為向量圖：以 PyMuPDF 讀出青色標記與誤差線的 PDF 座標，再用刻度文字位置做線性換算。x 為圖上各點位置換算的共同朋友數（論文以分箱呈現），誤差線為圖上的信賴區間。"},
        "x": {"label": "共同朋友數（結構性連結強度）"}, "y": {"label": "帶來工作的機率"},
        "series": [{"name": "IV 估計", "points": pts}],
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--onnela", required=True)
    ap.add_argument("--rajkumar", required=True)
    args = ap.parse_args()
    granovetter()
    onnela(args.onnela)
    rajkumar(args.rajkumar)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
