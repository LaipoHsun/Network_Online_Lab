"""產生 /playground 揭曉圖用的資料（data/build/playground/*.json）。

用法（在 repo 根目錄）：
    python3 data/scripts/networkx_expected.py   # 先產生 data/raw
    python3 data/scripts/playground_data.py

所有數字都由 data/raw 的公開網路或明確標示的模擬算出，不含任何從論文抄來的數字。
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path

import networkx as nx

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "build" / "playground"


def load(name: str) -> tuple[nx.Graph, dict]:
    raw = json.loads((RAW / f"{name}.json").read_text(encoding="utf-8"))
    G = nx.Graph()
    G.add_nodes_from(range(len(raw["labels"])))
    G.add_edges_from(raw["edges"])
    return G, raw


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main() -> None:
    karate, k_raw = load("karate")
    flor, f_raw = load("florentine")
    k_source = {"text": "Zachary 1977, Journal of Anthropological Research 33(4)；本站以 networkx 計算",
                "url": "https://doi.org/10.1086/jar.33.4.3629752", "sample": "34 位社員、78 條連結", "year": 1977}
    f_source = {"text": "Padgett & Ansell 1993, American Journal of Sociology 98(6)；婚姻網路，本站以 networkx 計算",
                "url": "https://doi.org/10.1086/230190", "sample": "15 個家族、20 條婚姻連結", "year": 1993}

    degs = [d for _, d in karate.degree()]
    hist = nx.degree_histogram(karate)
    write("karate_degree", {
        "kind": "distribution",
        "description": "空手道社每位成員的朋友數（度）",
        "source": k_source,
        "x": {"label": "朋友數 k"}, "y": {"label": "人數"},
        "values": degs,
        "summary": {"mean": statistics.mean(degs), "median": statistics.median(degs), "max": max(degs)},
        "histogram": [{"x": k, "y": c, "source": k_source["text"]} for k, c in enumerate(hist)],
    })

    btw = nx.betweenness_centrality(karate)
    write("karate_degree_betweenness", {
        "kind": "scatter",
        "description": "空手道社每位成員的度與介數中心性",
        "source": k_source,
        "x": {"label": "朋友數 k"}, "y": {"label": "介數中心性（正規化）"},
        "series": [{"name": "成員", "points": [
            {"x": karate.degree(i), "y": btw[i], "label": k_raw["labels"][i], "source": k_source["text"]}
            for i in karate.nodes()]}],
    })

    fb = nx.betweenness_centrality(flor)
    order = sorted(flor.nodes(), key=lambda i: -fb[i])
    write("florentine_betweenness", {
        "kind": "bar",
        "description": "佛羅倫斯各家族在婚姻網路中的介數中心性",
        "source": f_source,
        "x": {"label": "家族"}, "y": {"label": "介數中心性（正規化）"},
        "series": [{"name": "家族", "points": [
            {"x": f_raw["labels"][i], "y": fb[i], "source": f_source["text"]} for i in order]}],
    })

    # Watts–Strogatz：⟨d⟩(p)/⟨d⟩(0) 與 C(p)/C(0)；每個 p 平均 10 個種子
    n, k, seeds = 500, 10, 10
    ps = [0.0001, 0.0003, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1.0]
    base = nx.watts_strogatz_graph(n, k, 0)
    d0, c0 = nx.average_shortest_path_length(base), nx.average_clustering(base)
    ds, cs = [], []
    for p in ps:
        dl, cl = [], []
        for s in range(seeds):
            G = nx.connected_watts_strogatz_graph(n, k, p, tries=100, seed=s)
            dl.append(nx.average_shortest_path_length(G) / d0)
            cl.append(nx.average_clustering(G) / c0)
        ds.append(statistics.mean(dl)); cs.append(statistics.mean(cl))
    sim_source = {"text": f"本站模擬：Watts–Strogatz 模型（Watts & Strogatz 1998），N = {n}、K = {k}，每個 p 平均 {seeds} 次（networkx {nx.__version__}）",
                  "url": "https://doi.org/10.1038/30918", "sample": f"模擬網路 N = {n}", "year": 1998}
    write("watts_strogatz_curves", {
        "kind": "line",
        "description": "重連機率 p 對平均距離與聚集係數的影響（相對於 p = 0）",
        "source": sim_source,
        "x": {"label": "重連機率 p", "scale": "log"}, "y": {"label": "相對於 p = 0 的比值"},
        "series": [
            {"name": "平均距離 ⟨d⟩(p)/⟨d⟩(0)", "points": [{"x": p, "y": y, "source": sim_source["text"]} for p, y in zip(ps, ds)]},
            {"name": "聚集係數 C(p)/C(0)", "points": [{"x": p, "y": y, "source": sim_source["text"]} for p, y in zip(ps, cs)]},
        ],
    })
    print("wrote", OUT)


if __name__ == "__main__":
    main()
