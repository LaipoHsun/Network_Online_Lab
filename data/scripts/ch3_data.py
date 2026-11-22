"""第 3 章（三元閉合）的真實資料 → data/build/03-triadic-closure/*.json

用法（在 repo 根目錄）：
    python3 data/scripts/ch3_data.py --kossinets <kossinets_watts_2006.pdf> [--overlay <out.png>]

需要 PyMuPDF（pymupdf）、numpy、Pillow。PDF 因版權不放進 repo：
- Kossinets & Watts 2006, Empirical Analysis of an Evolving Social Network, Science 311:88–90
  （規格連結 https://cse.iitk.ac.in/users/cs888/files/good.pdf；Fig. 1 在 PDF 第 2 頁，點陣圖）

規則（docs/design.md「真實資料怎麼進到網站」）：論文只有圖沒有表時，JSON 標 digitized: true
並寫明數位化方法。43,553 人、14,584,423 封、22,611 位學生等數字直接取自原文。
Pew 2012 的好友圈密度 0.12 直接取自網頁原文（網址見 pew()）。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "build" / "03-triadic-closure"


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def figure_image(pdf: str) -> Image.Image:
    """PDF 第 2 頁上方的 Fig. 1（A、B、C 三個面板，原始點陣圖）。"""
    doc = pymupdf.open(pdf)
    page = doc[1]
    # 頁面上方那張（bbox 的 y0 最小）就是 Fig. 1；下方那張是 Fig. 2
    info = min(page.get_image_info(xrefs=True), key=lambda i: i["bbox"][1])
    xref = info["xref"]
    pix = pymupdf.Pixmap(doc, xref)
    if pix.n >= 4:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return Image.frombytes("RGB" if pix.n == 3 else "L", (pix.w, pix.h), pix.samples).convert("L")


def panel_b(img: Image.Image) -> tuple[list[tuple[int, float, float]], dict]:
    """面板 B：p_new 對共同朋友數（0–10+），實心圓 = 有共同課程，空心三角形 = 沒有。

    座標框由長黑線偵測；x 刻度每 2 單位 40 像素（框左緣 = 0、右緣 = 10+）；
    y 為對數軸，框上緣 = 10^-1、下緣 = 10^-7，中間刻度 10^-3、10^-5 等距。
    標記是 MATLAB 的圓（實心）與三角形（空心），高約 12 像素：
    圓心 = 標記上緣 + 6；三角形中心 = 實心底邊的下緣 − 6（兩者重疊時也成立）。
    """
    a = np.asarray(img).astype(int)
    dark = a < 128
    H, W = dark.shape
    # 面板 B 在左下：找左半邊的長橫線（框的上下緣）與長直線（左右緣）
    rows = [y for y in range(H // 2, H) if dark[y, : W // 2].sum() > 150]
    top, bottom = rows[0] + 0.5, rows[-1] - 0.5  # 線寬 2 像素，取中線
    inner = range(int(top) + 2, int(bottom) - 1)
    # 面板 B 的右緣略超過圖寬一半，面板 C 的左緣在 0.6 W 之後
    cols = [x for x in range(int(W * 0.56)) if dark[inner.start:inner.stop, x].sum() > 0.9 * len(inner)]
    left, right = cols[0] + 0.5, cols[-1] - 0.5
    frame_cols = set(cols)
    unit = (right - left) / 10
    per_dec = (bottom - top) / 6

    def log_p(y: float) -> float:
        return -1 - (y - top) / per_dec

    out = []
    for k in range(11):
        xc = left + unit * k
        xs = [x for x in range(int(round(xc)) - 3, int(round(xc)) + 3) if x not in frame_cols and 0 <= x < W]
        hits = [y for y in inner if dark[y, xs].sum() >= min(3, len(xs))]
        # 分群（間隔超過 1 列就是不同群），只保留高度 ≥ 9 的群（排除穿過的連線與字母）
        groups, cur = [], []
        for y in hits:
            if cur and y - cur[-1] > 1:
                groups.append(cur)
                cur = []
            cur.append(y)
        if cur:
            groups.append(cur)
        groups = [g for g in groups if g[-1] - g[0] >= 8]
        circle_y = groups[0][0] + 6
        # 三角形是空心的，中間幾欄看不到；改找它實心的底邊：標記半邊（6 欄）全黑的最下面一列。
        # 10+ 在框的右緣上，看左半邊；其他看右半邊（避開框外的刻度文字）。
        x0 = int(round(xc))
        half = range(x0 - 6, x0) if k == 10 else range(x0 + 1, x0 + 7)
        half = [x for x in half if x not in frame_cols]
        base = [y for y in inner if all(dark[y, x] for x in half)]
        tri_y = base[-1] - 6
        out.append((k, 10 ** log_p(circle_y), 10 ** log_p(tri_y)))
    frame = {"left": left, "right": right, "top": top, "bottom": bottom}
    return out, frame


def overlay(img: Image.Image, pts, frame, path: str) -> None:
    """把讀出的點畫回原圖，人工檢查用。"""
    im = img.convert("RGB")
    d = ImageDraw.Draw(im)
    unit = (frame["right"] - frame["left"]) / 10
    per_dec = (frame["bottom"] - frame["top"]) / 6
    for k, pc, pt in pts:
        x = frame["left"] + unit * k
        for p, col in ((pc, (230, 60, 60)), (pt, (40, 120, 230))):
            y = frame["top"] + (-1 - np.log10(p)) * per_dec
            d.ellipse([x - 3, y - 3, x + 3, y + 3], outline=col, width=2)
    im.save(path)


def kossinets(pdf: str, overlay_path: str | None) -> None:
    img = figure_image(pdf)
    pts, frame = panel_b(img)
    if overlay_path:
        overlay(img, pts, frame, overlay_path)
    src = "Kossinets & Watts 2006, Science 311, Fig. 1B"
    label = lambda k: "10+" if k == 10 else str(k)
    method = ("PDF 第 2 頁 Fig. 1 為點陣圖（525×395 像素）：以長黑線偵測面板 B 的座標框，"
              "x 軸框左緣為 0、右緣為 10+（每單位 20 像素），y 軸為對數尺度（框上緣 10^-1、下緣 10^-7）。"
              "在每個整數 x 的位置找出標記所在的像素列：實心圓的圓心 = 標記上緣 + 6 像素，"
              "空心三角形的中心 = 實心底邊的下緣 − 6 像素（兩種標記重疊時也適用）。"
              "一個像素約 0.04 個數量級，讀數誤差約 ±10–20%。為約略值。")
    write("kossinets_mutual_acquaintances", {
        "kind": "line",
        "description": "兩個還不認識的學生，在一天之內開始互寄 email 的機率，對他們的共同朋友數",
        "source": {"text": "Kossinets & Watts 2006, Empirical Analysis of an Evolving Social Network, Science 311(5757), Fig. 1B（由圖讀取）",
                   "url": "https://doi.org/10.1126/science.1116869",
                   "sample": "美國一所大型大學一學年的 email 紀錄；分析對象為 22,611 位大學部與研究所學生", "year": 2006},
        "digitized": True,
        "digitization": {"figure": "Fig. 1B", "method": method},
        "facts": {
            "population": 43553, "population_source": "Kossinets & Watts 2006, p. 88：43,553 位學生、教職員",
            "messages": 14584423, "messages_source": "Kossinets & Watts 2006, p. 88：過濾後 355 天內 14,584,423 封",
            "students": 22611, "students_source": "Kossinets & Watts 2006, p. 88：焦點與循環閉合的結果針對 22,611 位學生",
            "window_days": 60, "window_source": "Kossinets & Watts 2006, p. 88：過去 60 天內雙向互寄過 email 即視為有連結",
            "plateau": "共同朋友六位以上時，有沒有共同課程不再造成差異（p. 89）",
        },
        "x": {"label": "共同朋友數"}, "y": {"label": "每天形成新連結的機率 p_new", "scale": "log"},
        "series": [
            {"name": "有共同課程", "points": [{"x": k, "label": label(k), "y": float(f"{pc:.3g}"), "source": src} for k, pc, _ in pts]},
            {"name": "沒有共同課程", "points": [{"x": k, "label": label(k), "y": float(f"{pt:.3g}"), "source": src} for k, _, pt in pts]},
        ],
    })
    # 換算：沒有共同課程的兩人，共同朋友 k 位時的機率是 0 位時的幾倍（純粹的三元閉合）
    p0 = pts[0][2]
    write("kossinets_closure_ratio", {
        "kind": "line",
        "description": "沒有共同課程的兩個陌生人：有 k 位共同朋友時，開始聯絡的機率是沒有共同朋友時的幾倍",
        "source": {"text": "由 Kossinets & Watts 2006, Science 311(5757), Fig. 1B（三角形：沒有共同課程）的讀數換算（約略值）",
                   "url": "https://doi.org/10.1126/science.1116869",
                   "sample": "美國一所大型大學一學年的 email 紀錄；22,611 位學生", "year": 2006},
        "digitized": True,
        "digitization": {"figure": "Fig. 1B（三角形）",
                         "method": "以 kossinets_mutual_acquaintances.json 的「沒有共同課程」各點除以共同朋友 0 位的那一點。"
                                   "兩個讀數各有約 ±10–20% 的誤差，比值的誤差約 ±30%，只適合看數量級。"},
        "x": {"label": "共同朋友數"}, "y": {"label": "是沒有共同朋友時的幾倍", "scale": "log"},
        "series": [{"name": "沒有共同課程", "points": [
            {"x": k, "label": label(k), "y": float(f"{pt / p0:.2g}"), "source": src + "（換算）"} for k, _, pt in pts]}],
    })


def pew() -> None:
    """Pew 2012 的數字直接取自網頁原文（不是數位化）。"""
    url = "https://www.pewresearch.org/internet/2012/02/03/part-3-the-structure-of-friendship/"
    write("pew_friend_density", {
        "kind": "facts",
        "description": "Facebook 用戶好友圈的密度（好友之間彼此也是好友的比例）",
        "source": {"text": "Pew Research Center 2012, Why Most Facebook Users Get More Than They Give, Part 3: The structure of friendship",
                   "url": url, "sample": "Pew 研究樣本中的 Facebook 用戶", "year": 2012},
        "digitized": False,
        "facts": {
            "mean_density": 0.12, "sd_density": 0.07, "max_density": 0.42, "mean_friends": 245,
            "quote_source": "原文：The average Facebook user's friends list has a density of only .12 (SD=.07). "
                            "There was a maximum density of .42 … with 245 friends …",
        },
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kossinets", required=True)
    ap.add_argument("--overlay", help="把讀出的點畫回原圖，存成 PNG 以便人工檢查")
    args = ap.parse_args()
    kossinets(args.kossinets, args.overlay)
    pew()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
