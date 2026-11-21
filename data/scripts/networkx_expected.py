"""產生圖演算法單元測試的期望值（以 networkx 為準）。

用法（在 repo 根目錄）：
    python3 data/scripts/networkx_expected.py

輸出：
    data/raw/karate.json、data/raw/florentine.json   原始網路（附來源）
    tests/fixtures/networkx/<graph>.json              每個函式的期望值

節點一律用 networkx 的節點順序編號為 0..n-1；`labels` 保留原名。
所有指標都把網路當成無權重、無向的簡單圖計算。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import networkx as nx

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
FIX = ROOT / "tests" / "fixtures" / "networkx"

SOURCES = {
    "karate": {
        "source": "Zachary, W. W. (1977). An information flow model for conflict and fission "
        "in small groups. Journal of Anthropological Research, 33(4), 452–473. "
        "取自 networkx karate_club_graph()。",
        "license": "公開學術資料集，隨 networkx（BSD-3-Clause）散布。",
        "note": "34 人、78 條連結。`club` 是分裂後各成員的去向（Mr. Hi / Officer）。",
    },
    "florentine": {
        "source": "Padgett, J. F., & Ansell, C. K. (1993). Robust action and the rise of the "
        "Medici, 1400–1434. American Journal of Sociology, 98(6), 1259–1319；"
        "婚姻關係，取自 networkx florentine_families_graph()（Breiger & Pattison 1986 版本）。",
        "license": "公開學術資料集，隨 networkx（BSD-3-Clause）散布。",
        "note": "婚姻網路 15 個家族、20 條連結；沒有任何婚姻連結的 Pucci 家族不在其中。",
    },
}


def toy_graph() -> nx.Graph:
    """測試邊界情況用的小圖：兩個連通群加一個孤立點。不是研究資料。"""
    G = nx.Graph()
    G.add_nodes_from(range(10))
    G.add_edges_from([(0, 1), (1, 2), (2, 0), (2, 3), (3, 4), (4, 5), (5, 3), (6, 7), (7, 8)])
    return G  # 節點 9 孤立


def relabel(G: nx.Graph) -> tuple[nx.Graph, list[str]]:
    labels = [str(v) for v in G.nodes()]
    idx = {v: i for i, v in enumerate(G.nodes())}
    H = nx.Graph()
    H.add_nodes_from(range(len(labels)))
    H.add_edges_from((idx[u], idx[v]) for u, v in G.edges())
    return H, labels


def arr(d: dict, n: int) -> list[float]:
    return [d[i] for i in range(n)]


def edge_key(u: int, v: int) -> tuple[int, int]:
    return (u, v) if u < v else (v, u)


def threshold_cascade(G: nx.Graph, seeds: list[int], theta: int) -> list[int]:
    """遞進式門檻模型（已採用者不會退出），同步更新；回傳每個節點的採用時間，-1 表示沒採用。"""
    t_adopt = {v: -1 for v in G}
    for s in seeds:
        t_adopt[s] = 0
    t = 0
    while True:
        t += 1
        new = [
            v
            for v in G
            if t_adopt[v] < 0 and sum(1 for u in G[v] if t_adopt[u] >= 0) >= theta
        ]
        if not new:
            break
        for v in new:
            t_adopt[v] = t
    return [t_adopt[i] for i in range(G.number_of_nodes())]


def expected(G: nx.Graph, labels: list[str], extra: dict | None = None) -> dict:
    n = G.number_of_nodes()
    connected = nx.is_connected(G)
    sp = dict(nx.all_pairs_shortest_path_length(G))
    dist = [[sp[i].get(j, -1) for j in range(n)] for i in range(n)]

    eb = nx.edge_betweenness_centrality(G, normalized=True)
    edges = sorted(edge_key(u, v) for u, v in G.edges())

    def overlap(u: int, v: int) -> float:
        nu, nv = set(G[u]), set(G[v])
        common = len(nu & nv)
        denom = (len(nu) - 1) + (len(nv) - 1) - common
        return common / denom if denom > 0 else 0.0

    local_bridges = sorted(
        [*edge_key(u, v), span] for u, v, span in nx.local_bridges(G, with_span=True)
    )
    # networkx 對「拿掉後兩端不再連通」的 span 給 inf；JSON 用 -1 表示
    local_bridges = [[u, v, -1 if s == float("inf") else s] for u, v, s in local_bridges]

    out: dict = {
        "labels": labels,
        "n": n,
        "edges": [list(e) for e in edges],
        "degree": [d for _, d in sorted(G.degree())],
        "degree_histogram": nx.degree_histogram(G),
        "average_degree": 2 * G.number_of_edges() / n,
        "density": nx.density(G),
        "distances": dist,
        "connected_components": sorted(sorted(c) for c in nx.connected_components(G)),
        "is_connected": connected,
        "triangles": arr(nx.triangles(G), n),
        "clustering": arr(nx.clustering(G), n),
        "average_clustering": nx.average_clustering(G),
        "transitivity": nx.transitivity(G),
        "degree_centrality": arr(nx.degree_centrality(G), n),
        "closeness_centrality": arr(nx.closeness_centrality(G), n),
        "betweenness_centrality": arr(nx.betweenness_centrality(G, normalized=True), n),
        "betweenness_centrality_raw": arr(nx.betweenness_centrality(G, normalized=False), n),
        "edge_betweenness_centrality": [[u, v, eb.get((u, v), eb.get((v, u)))] for u, v in edges],
        "neighborhood_overlap": [[u, v, overlap(u, v)] for u, v in edges],
        "bridges": sorted(list(edge_key(u, v)) for u, v in nx.bridges(G)),
        "local_bridges": local_bridges,
    }
    if connected:
        out["average_shortest_path_length"] = nx.average_shortest_path_length(G)
        out["diameter"] = nx.diameter(G)
        out["eigenvector_centrality"] = arr(
            nx.eigenvector_centrality(G, max_iter=10000, tol=1e-12), n
        )
        out["katz_centrality"] = arr(
            nx.katz_centrality(G, alpha=0.1, beta=1.0, max_iter=10000, tol=1e-12), n
        )

    # 模組度：全部一群、每人一群、greedy（確定性）分法
    greedy = [sorted(c) for c in nx.community.greedy_modularity_communities(G)]
    out["modularity"] = {
        "all_in_one": {"partition": [list(range(n))], "Q": nx.community.modularity(G, [set(range(n))])},
        "singletons": {
            "partition": [[i] for i in range(n)],
            "Q": nx.community.modularity(G, [{i} for i in range(n)]),
        },
        "greedy": {"partition": greedy, "Q": nx.community.modularity(G, greedy)},
    }
    # Louvain 有隨機性：記錄 50 個種子的 Q 範圍，TS 版的結果應落在合理區間
    qs = [
        nx.community.modularity(G, nx.community.louvain_communities(G, seed=s))
        for s in range(50)
    ]
    out["louvain_Q"] = {"min": min(qs), "max": max(qs)}

    if G.number_of_edges() > 0:
        first = next(nx.community.girvan_newman(G))
        out["girvan_newman_first_split"] = sorted(sorted(c) for c in first)

    if extra:
        out.update(extra)
    return out


def write(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main() -> None:
    meta = {"generator": "data/scripts/networkx_expected.py", "networkx": nx.__version__,
            "python": sys.version.split()[0]}

    karate, k_labels = relabel(nx.karate_club_graph())
    raw_k = nx.karate_club_graph()
    club = [raw_k.nodes[v]["club"] for v in raw_k.nodes()]
    club_split = [[i for i, c in enumerate(club) if c == name] for name in ("Mr. Hi", "Officer")]

    florentine, f_labels = relabel(nx.florentine_families_graph())
    toy, t_labels = relabel(toy_graph())

    for name, G, labels in (("karate", karate, k_labels), ("florentine", florentine, f_labels)):
        raw = {**SOURCES[name], "labels": labels,
               "edges": sorted(list(edge_key(u, v)) for u, v in G.edges())}
        if name == "karate":
            raw["club"] = club
        write(RAW / f"{name}.json", raw)

    write(FIX / "karate.json", {**meta, **expected(karate, k_labels, {
        "club_split": {"partition": club_split, "Q": nx.community.modularity(karate, club_split)},
        "threshold": [
            {"seeds": [0, 1], "theta": 2, "adopt_time": threshold_cascade(karate, [0, 1], 2)},
            {"seeds": [32, 33], "theta": 2, "adopt_time": threshold_cascade(karate, [32, 33], 2)},
            {"seeds": [0, 33], "theta": 1, "adopt_time": threshold_cascade(karate, [0, 33], 1)},
        ],
    })})
    write(FIX / "florentine.json", {**meta, **expected(florentine, f_labels, {
        "threshold": [
            {"seeds": [f_labels.index("Medici")], "theta": 1,
             "adopt_time": threshold_cascade(florentine, [f_labels.index("Medici")], 1)},
        ],
    })})
    write(FIX / "toy.json", {**meta, "note": "測試邊界用的小圖，不是研究資料。", **expected(toy, t_labels)})

    ws = {
        "ring_n20_k4": sorted(list(edge_key(u, v)) for u, v in nx.watts_strogatz_graph(20, 4, 0).edges()),
        "ring_n60_k6_clustering": nx.average_clustering(nx.watts_strogatz_graph(60, 6, 0)),
        "ring_n60_k6_avg_path": nx.average_shortest_path_length(nx.watts_strogatz_graph(60, 6, 0)),
    }
    write(FIX / "watts_strogatz.json", {**meta, **ws})
    print("wrote", RAW, FIX)


if __name__ == "__main__":
    main()
