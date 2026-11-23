"""第 7 章（中心性）的真實資料 → data/build/07-centrality/*.json

用法（在 repo 根目錄）：
    python3 data/scripts/ch7_data.py

需要 networkx。
- 佛羅倫斯家族婚姻網路：data/raw/florentine.json（Padgett & Ansell 1993；networkx 的 florentine_families_graph，
  Breiger & Pattison 1986 版本，15 個家族、20 條婚姻連結）。四種中心性用 networkx 計算（不是論文數字）。
- Milgram 的「G 先生」：Travers & Milgram 1969, Sociometry 32(4), p. 439–440 的文字（64 條成功的鏈中，
  16 條的最後一站是 G 先生，另有兩位商業夥伴各 10 條、5 條；三人合計 48%）。
"""

from __future__ import annotations

import json
from pathlib import Path

import networkx as nx

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "build" / "07-centrality"


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def florentine() -> None:
    raw = json.loads((ROOT / "data" / "raw" / "florentine.json").read_text(encoding="utf-8"))
    labels = raw["labels"]
    G = nx.Graph()
    G.add_nodes_from(range(len(labels)))
    G.add_edges_from(tuple(e) for e in raw["edges"])
    deg = dict(G.degree())
    clo = nx.closeness_centrality(G)
    bet = nx.betweenness_centrality(G, normalized=True)
    eig = nx.eigenvector_centrality_numpy(G)
    src = "Padgett & Ansell 1993 婚姻網路（networkx florentine_families_graph）；中心性由 networkx 計算"
    source = {"text": "Padgett & Ansell 1993, Robust Action and the Rise of the Medici, 1400–1434, American Journal of Sociology 98(6)；"
                      "婚姻網路取自 networkx（Breiger & Pattison 1986 版本），中心性由本網站以 networkx 計算",
              "url": "https://doi.org/10.1086/230190", "sample": "1400–1434 年佛羅倫斯 15 個菁英家族、20 條婚姻連結", "year": 1993}
    order = sorted(range(len(labels)), key=lambda i: -bet[i])
    write("florentine_centrality", {
        "kind": "bar",
        "description": "佛羅倫斯 15 個家族在婚姻網路中的介數中心性（由高到低）",
        "source": source, "digitized": False,
        "x": {"label": "家族"}, "y": {"label": "介數中心性（標準化）"},
        "series": [{"name": "介數中心性", "points": [
            {"x": labels[i], "y": round(bet[i], 3), "source": src} for i in order]}],
        "network": {
            "labels": labels, "edges": raw["edges"],
            "degree": [deg[i] for i in range(len(labels))],
            "closeness": [round(clo[i], 4) for i in range(len(labels))],
            "betweenness": [round(bet[i], 4) for i in range(len(labels))],
            "eigenvector": [round(abs(eig[i]), 4) for i in range(len(labels))],
        },
        "facts": {
            "medici_top_in": [m for m, d in (("度", deg), ("接近", clo), ("介數", bet), ("特徵向量", eig))
                              if max(range(len(labels)), key=lambda i: abs(d[i])) == labels.index("Medici")],
            "medici_degree": deg[labels.index("Medici")],
        },
    })


def milgram_funnel() -> None:
    src = "Travers & Milgram 1969, Sociometry 32(4), p. 439–440"
    write("milgram_funnel", {
        "kind": "facts",
        "description": "Milgram 實驗中 64 條成功的鏈，最後一站是誰",
        "source": {"text": "Travers & Milgram 1969, An Experimental Study of the Small World Problem, Sociometry 32(4), p. 439–440",
                   "url": "https://doi.org/10.2307/2786545", "year": 1969},
        "digitized": False,
        "facts": {
            "completed": 64, "mr_g": 16, "associate_1": 10, "associate_2": 5,
            "quote": "Mr. G, who accounted for 16 completions, is a clothing merchant in the target's hometown of Sharon … "
                     "10 made contact through a single business associate, and 5 through a second business associate. "
                     "These three 'penultimate links' together accounted for 48 per cent of the total completions.",
            "source": src,
        },
    })


def main() -> None:
    florentine()
    milgram_funnel()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
