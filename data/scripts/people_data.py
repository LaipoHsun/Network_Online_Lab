"""第 ⑥ 段「用小人畫出真實資料」的資料 → data/build/<章>/people_*.json

用法（在 repo 根目錄，先跑完各章的資料腳本）：
    python3 data/scripts/people_data.py

不讀任何新的研究資料：每個數字都從 data/build 裡已經有 source 的 JSON 換算而來，
換算方法寫在每一組的 source。小人數用「最大餘數法」四捨五入，讓總數剛好等於列的總數。
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / "data" / "build"


def load(path: str) -> dict:
    return json.loads((BUILD / f"{path}.json").read_text(encoding="utf-8"))


def write(path: str, obj: dict) -> None:
    out = BUILD / f"{path}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def apportion(shares: list[float], total: int) -> list[int]:
    """最大餘數法：把 shares（加總不必等於 total）按比例分成整數，總和剛好是 total。"""
    s = sum(shares)
    raw = [x / s * total for x in shares]
    base = [int(r) for r in raw]
    for i in sorted(range(len(raw)), key=lambda i: -(raw[i] - base[i]))[: total - sum(base)]:
        base[i] += 1
    return base


def ch1() -> None:
    d = load("01-degree/ugander_cdf")
    pts = {p["x"]: p["y"] for p in d["series"][0]["points"]}
    below = {10: pts[10], 25: d["summary"]["below_25"], 100: pts[100], 200: d["summary"]["below_200"]}
    bins = [below[10], below[25] - below[10], below[100] - below[25], below[200] - below[100], 100 - below[200]]
    counts = apportion(bins, 100)
    src = "由 01-degree/ugander_cdf.json（Ugander 等人 2011 Fig. 1(b)，由圖讀取）的累積比例相減換算"
    labels = ["少於 10 位", "10–24 位", "25–99 位", "100–199 位", "200 位以上"]
    tones = ["muted", "muted", "muted", "accent", "signal"]
    write("01-degree/people_friend_counts", {
        "kind": "people", "description": "如果 Facebook 只有 100 個人：每個人有幾位朋友",
        "source": d["source"], "digitized": True,
        "unit": "每個小人代表 1% 的用戶，依朋友數由少到多排好",
        "rows": [{"label": "100 位用戶", "groups": [
            {"label": l, "count": c, "tone": t, "source": src} for l, c, t in zip(labels, counts, tones)]}],
        "note": f"正中間（第 50、51 位）的人約有 99 位朋友，這是中位數；平均數 190 位，只有最右邊約 {counts[-1]} 個人的朋友比平均多。",
    })


def ch2() -> None:
    d = load("02-bipartite/traud_assortativity")
    top = d["facts"]["top_counts"]
    src = "02-bipartite/traud_assortativity.json 的 facts.top_counts（由 Traud 等人 2012 Table A.2 計算）"
    write("02-bipartite/people_schools", {
        "kind": "people", "description": "100 所學校，各由哪個屬性主導朋友圈",
        "source": d["source"], "digitized": False,
        "unit": "每個小人代表一所學校",
        "rows": [{"label": "100 所學校", "groups": [
            {"label": "年級最強", "count": top["年級"], "tone": "accent", "source": src},
            {"label": "宿舍最強", "count": top["宿舍"], "tone": "signal", "source": src},
            {"label": "主修最強", "count": top["主修"], "tone": "muted", "source": src},
            {"label": "高中最強", "count": top["高中"], "tone": "muted", "source": src},
        ]}],
        "note": "每所學校只算「同質性係數最高的那個屬性」。宿舍最強的學校包括 Caltech 和 Rice。",
    })


def ch3() -> None:
    d = load("03-triadic-closure/kossinets_closure_ratio")
    r1 = next(p["y"] for p in d["series"][0]["points"] if p["x"] == 1)
    n = int(round(r1))
    src = "03-triadic-closure/kossinets_closure_ratio.json 中 1 位共同朋友的倍數（由圖讀取後換算，約略值）"
    write("03-triadic-closure/people_pairs", {
        "kind": "people", "description": "同樣多的陌生配對裡，有幾對會開始聯絡",
        "source": d["source"], "digitized": True,
        "unit": "每個小人代表「一對開始聯絡的陌生人」",
        "rows": [
            {"label": "沒有共同朋友", "groups": [{"label": "開始聯絡", "count": 1, "tone": "muted", "source": src}]},
            {"label": "有 1 位共同朋友", "groups": [{"label": "開始聯絡", "count": n, "tone": "accent", "source": src}]},
        ],
        "note": f"兩列的配對數一樣多。沒有共同朋友的配對每有 1 對開始聯絡，有 1 位共同朋友的配對就有約 {n} 對（只看沒有一起修課的學生）。",
    })


def ch4() -> None:
    d = load("04-small-world/small_world_distances")
    f = d["facts"]
    per = 4
    groups = [f["milgram_completed"], f["milgram_sent"] - f["milgram_completed"], f["milgram_starters"] - f["milgram_sent"]]
    counts = apportion(groups, round(f["milgram_starters"] / per))
    src = "04-small-world/small_world_distances.json 的 facts（Travers & Milgram 1969 原文），每 4 人畫成 1 個小人"
    write("04-small-world/people_milgram", {
        "kind": "people", "description": "Milgram 的 296 位起點者，信後來怎麼了",
        "source": {"text": "Travers & Milgram 1969, An Experimental Study of the Small World Problem, Sociometry 32(4)",
                   "url": "https://doi.org/10.2307/2786545", "year": 1969},
        "digitized": False,
        "unit": "每個小人代表 4 位起點者",
        "rows": [{"label": "296 位起點者", "groups": [
            {"label": f"信送到了（{groups[0]} 人）", "count": counts[0], "tone": "accent", "source": src},
            {"label": f"寄出了但中途斷掉（{groups[1]} 人）", "count": counts[1], "tone": "muted", "source": src},
            {"label": f"根本沒寄出（{groups[2]} 人）", "count": counts[2], "tone": "line", "source": src},
        ]}],
        "note": "「六度分隔」的 5.2 位中間人，只算了最前面那一小群送到的信。",
    })


def ch5() -> None:
    d = load("05-friendship-paradox/pew_paradox_share")
    y = [p["y"] for p in d["series"][0]["points"]]
    src = "05-friendship-paradox/pew_paradox_share.json（Pew 2012 原文 84%）"
    write("05-friendship-paradox/people_paradox", {
        "kind": "people", "description": "如果 Pew 的樣本只有 100 位 Facebook 用戶",
        "source": d["source"], "digitized": False,
        "unit": "每個小人代表 1% 的用戶",
        "rows": [{"label": "100 位用戶", "groups": [
            {"label": "朋友比自己受歡迎", "count": y[0], "tone": "sci", "source": src},
            {"label": "不比自己受歡迎", "count": y[1], "tone": "muted", "source": src},
        ]}],
        "note": "藍色的人：自己的朋友數，比「自己朋友的平均朋友數」少。",
    })


def ch6() -> None:
    d = load("06-weak-ties/granovetter_contact_frequency")
    pts = d["series"][0]["points"]
    n = 54
    counts = apportion([p["y"] for p in pts], n)
    src = "06-weak-ties/granovetter_contact_frequency.json（Granovetter 1973 原文比例 × 54 人）"
    tones = ["muted", "accent", "signal"]
    write("06-weak-ties/people_introducers", {
        "kind": "people", "description": "Granovetter 訪問的 54 位透過人脈找到工作的人，介紹人多常見面",
        "source": d["source"], "digitized": False,
        "unit": "每個小人代表一位受訪者",
        "rows": [{"label": "54 位受訪者", "groups": [
            {"label": p["x"], "count": c, "tone": t, "source": src} for p, c, t in zip(pts, counts, tones)]}],
        "note": f"只有 {counts[0]} 位的介紹人是常常見面的人；其他 {n - counts[0]} 位是被偶爾或很少見面的人介紹的。",
    })


def ch7() -> None:
    d = load("07-centrality/milgram_funnel")
    f = d["facts"]
    other = f["completed"] - f["mr_g"] - f["associate_1"] - f["associate_2"]
    src = "07-centrality/milgram_funnel.json（Travers & Milgram 1969, p. 439–440 原文）"
    write("07-centrality/people_funnel", {
        "kind": "people", "description": "Milgram 實驗中 64 條送到的鏈，最後一站是誰",
        "source": d["source"], "digitized": False,
        "unit": "每個小人代表一條送到的鏈",
        "rows": [{"label": "64 條鏈", "groups": [
            {"label": "最後經過 G 先生", "count": f["mr_g"], "tone": "signal", "source": src},
            {"label": "最後經過商業夥伴甲", "count": f["associate_1"], "tone": "ill", "source": src},
            {"label": "最後經過商業夥伴乙", "count": f["associate_2"], "tone": "sci", "source": src},
            {"label": "其他人", "count": other, "tone": "muted", "source": src},
        ]}],
        "note": "三個人承接了將近一半的鏈：他們站在通往目標的少數幾條路上。",
    })


def main() -> None:
    for f in (ch1, ch2, ch3, ch4, ch5, ch6, ch7):
        f()
    print("wrote people_*.json")


if __name__ == "__main__":
    main()
