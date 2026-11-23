"""第 2 章（二分網路與投影）的真實資料 → data/build/02-bipartite/*.json

用法（在 repo 根目錄）：
    python3 data/scripts/ch2_data.py --traud <traud_mucha_porter_2012.pdf>

需要 PyMuPDF（pymupdf）。PDF 因版權不放進 repo：
- Traud, Mucha & Porter 2012, Social structure of Facebook networks, Physica A 391: 4165–4180
  （規格連結 https://www.math.ucla.edu/~mason/papers/datadump.pdf；附錄 Table A.1、A.2）

數字直接取自論文附錄的表格文字（不是由圖讀取）：
- Table A.1：每所學校完整網路（Full）的人數。
- Table A.2：每所學校完整網路的同質性（assortativity）係數：主修、宿舍、年級、高中（另有性別，這章不用）。
本腳本把 100 所學校各屬性的係數整理成中位數，並數出每所學校哪個屬性的係數最高。
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "build" / "02-bipartite"
ATTRS = [("year", "年級"), ("residence", "宿舍"), ("major", "主修"), ("hs", "高中")]


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def parse(pdf: str):
    text = " ".join(p.get_text() for p in pymupdf.open(pdf))
    text = re.sub(r"\s+", " ", text).replace("−", "-")
    # 表格跨頁時夾著「(continued on next page) 頁碼 Table A.x (continued) …表頭…」，先拿掉
    text = re.sub(r"\(continued on next page\) \d+ Table A\.\d \(continued\) Institution,? Number[^A-Z]*?"
                  r"(Full Student Female Male|Nodes \(Full, Student, Female, Male\) Edges \(Full, Student, Female, Male\)) ?", "", text)
    nodes = {}
    for m in re.finditer(r"([A-Za-z][A-Za-z\-\.&]*?) (\d{1,3}) \((\d+), (\d+), (\d+), (\d+)\) \((\d+), (\d+), (\d+), (\d+)\)", text):
        nodes[int(m.group(2))] = {"name": m.group(1), "nodes": int(m.group(3)), "edges": int(m.group(7))}
    num = r"(-?[\d\.]+(?:e-?\d+)?)"
    pat = re.compile(r"([A-Za-z][A-Za-z\-\.&]*?) (\d{1,3}) Gender " + num + " " + num + " Major " + " ".join([num] * 4)
                     + " Residence " + " ".join([num] * 4) + " Year " + " ".join([num] * 4) + " High School " + " ".join([num] * 4))
    rows = {}
    for m in pat.finditer(text):
        g = m.groups()
        # 每個屬性的第一個數字是完整網路（Full）
        rows[int(g[1])] = {"name": g[0], "major": float(g[4]), "residence": float(g[8]), "year": float(g[12]), "hs": float(g[16])}
    assert len(nodes) == 100, len(nodes)
    assert len(rows) == 100, len(rows)
    return nodes, rows


def traud(pdf: str) -> None:
    nodes, rows = parse(pdf)
    src = "Traud, Mucha & Porter 2012, Physica A 391, Table A.2（Full 欄）"
    medians = {k: statistics.median(r[k] for r in rows.values()) for k, _ in ATTRS}
    top = {k: 0 for k, _ in ATTRS}
    for r in rows.values():
        top[max((k for k, _ in ATTRS), key=lambda k: r[k])] += 1
    res_top = sorted([r["name"] for r in rows.values() if r["residence"] == max(r[k] for k, _ in ATTRS)])
    sizes = [v["nodes"] for v in nodes.values()]
    smallest = min(nodes.values(), key=lambda v: v["nodes"])
    largest = max(nodes.values(), key=lambda v: v["nodes"])
    write("traud_assortativity", {
        "kind": "bar",
        "description": "Facebook100：100 所美國大學的好友網路裡，朋友是否傾向和自己同年級、同宿舍、同主修、同高中（同質性係數的中位數）",
        "source": {"text": "Traud, Mucha & Porter 2012, Social structure of Facebook networks, Physica A 391: 4165–4180, Table A.2",
                   "url": "https://doi.org/10.1016/j.physa.2011.12.021",
                   "sample": f"2005 年 9 月 Facebook 只開放 .edu 信箱時的 100 所美國大學完整好友網路，每校 {min(sizes):,} 到 {max(sizes):,} 人",
                   "year": 2012},
        "digitized": False,
        "x": {"label": "屬性"}, "y": {"label": "同質性係數（100 校中位數）"},
        "series": [{"name": "100 校中位數", "points": [
            {"x": label, "y": round(medians[k], 3), "source": src + "：100 校的中位數（本腳本計算）"} for k, label in ATTRS]}],
        "facts": {
            "schools": 100,
            "top_counts": {label: top[k] for k, label in ATTRS},
            "top_counts_note": "每所學校完整網路中，同質性係數最高的屬性（本腳本由 Table A.2 計算）",
            "residence_top_schools": res_top,
            "smallest": smallest, "largest": largest,
            "sizes_source": "Traud, Mucha & Porter 2012, Table A.1（Full 欄）",
            "paper_text": "For almost all of the institutions and each of the 4 network subsets, the class year attribute produces higher "
                          "assortativity values than the other available demographic characteristics.（p. 4170）",
            "abstract": "… common high school is more important to the social organization of large institutions and … the importance of "
                        "common major varies significantly between institutions.（摘要）",
        },
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--traud", required=True)
    args = ap.parse_args()
    traud(args.traud)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
