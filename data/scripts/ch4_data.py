"""第 4 章（小世界）的真實資料 → data/build/04-small-world/*.json

用法（在 repo 根目錄）：
    python3 data/scripts/ch4_data.py

這一章的數字都直接取自原文文字（不是由圖讀取），原文位置寫在每筆的 source：
- Travers & Milgram 1969, An Experimental Study of the Small World Problem, Sociometry 32(4)
  https://www.cse.cuhk.edu.hk/~cslui/CMSC5734/travers69smallworld.pdf（摘要、Results 段）
- Backstrom, Boldi, Rosa, Ugander & Vigna 2012, Four Degrees of Separation, arXiv:1111.4570（摘要）
- Facebook Research 2016, Three and a half degrees of separation（部落格全文）
- 內政部戶政司 114 年 12 月戶籍人口統計（台灣估算用的人口數）

「距離」= 兩人之間最短路徑的步數；「分隔度數」= 中間人數 = 距離 − 1。
Milgram 報告的是中間人數，所以距離是 5.2 + 1 = 6.2（換算，另外標註）。
"""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "build" / "04-small-world"


def write(name: str, obj: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


MILGRAM = "Travers & Milgram 1969, Sociometry 32(4), p. 425（摘要）"
BACKSTROM = "Backstrom et al. 2012, arXiv:1111.4570, 摘要"
FB2016 = "Facebook Research 2016, Three and a half degrees of separation"


def distances() -> None:
    write("small_world_distances", {
        "kind": "bar",
        "description": "三次「世界有多小」的測量：兩人之間平均要走幾步（距離）",
        "source": {"text": "Travers & Milgram 1969（Sociometry）；Backstrom 等人 2012（arXiv:1111.4570）；Facebook Research 2016（部落格）",
                   "url": "https://arxiv.org/abs/1111.4570",
                   "sample": "Milgram：296 位起點者、64 條成功的鏈；Facebook 2011：約 7.21 億位用戶、690 億條友誼；Facebook 2016：15.9 億位用戶"},
        "digitized": False,
        "x": {"label": "研究"}, "y": {"label": "平均距離（步）"},
        "series": [{"name": "平均距離", "points": [
            {"x": "Milgram 1969", "y": 6.2, "label": "成功的 64 條鏈；論文報告中間人 5.2 位，距離 = 5.2 + 1",
             "source": MILGRAM + "：mean number of intermediaries … is 5.2（換算成距離 +1）"},
            {"x": "Facebook 2011", "y": 4.74, "label": "全球約 7.21 億人",
             "source": BACKSTROM + "：The average distance we observe is 4.74, corresponding to 3.74 intermediaries"},
            {"x": "Facebook 2016", "y": 4.57, "label": "全球 15.9 億人",
             "source": FB2016 + "：The average distance we observe is 4.57, corresponding to 3.57 intermediaries"},
        ]}],
        "facts": {
            "milgram_starters": 296, "milgram_sent": 217, "milgram_completed": 64, "milgram_completed_pct_of_sent": 29,
            "milgram_intermediaries": 5.2, "milgram_funnel_pct": 48,
            "milgram_source": "Travers & Milgram 1969：N = 296；217 of the 296 starting persons actually sent the document；"
                              "64 of the folders, or 29 per cent of those sent out … reached the target；"
                              "48 per cent of the chains passing through three persons before reaching the target",
            "fb2011_users": 721_000_000, "fb2011_links": 69_000_000_000, "fb2011_distance": 4.74, "fb2011_degrees": 3.74,
            "fb2011_source": BACKSTROM,
            "fb2016_users": 1_590_000_000, "fb2016_distance": 4.57, "fb2016_degrees": 3.57, "fb2016_us_degrees": 3.46,
            "fb2016_source": FB2016 + "：Within the US, people are connected to each other by an average of 3.46 degrees",
            "fb2016_url": "https://research.facebook.com/blog/2016/02/three-and-a-half-degrees-of-separation/",
        },
    })


def taiwan() -> None:
    n = 23_299_132
    k = 1000
    write("taiwan_estimate", {
        "kind": "facts",
        "description": "台灣任兩人平均距離的粗估：⟨d⟩ ≈ ln N / ln ⟨k⟩（假設每人認識約 1,000 人；只是數量級的估算）",
        "source": {"text": "人口：內政部戶政司，114 年 12 月底戶籍登記人口數",
                   "url": "https://www.ris.gov.tw/info-liferay/app/channel/newsDetail/26007114", "year": 2025},
        "digitized": False,
        "facts": {
            "population": n, "population_source": "內政部戶政司：114年12月底人口數為23,299,132人",
            "assumed_acquaintances": k, "assumed_note": "「每人認識約 1,000 人」是規格中的假設，不是測量值",
            "ln_N": round(math.log(n), 2), "ln_k": round(math.log(k), 2),
            "estimate": round(math.log(n) / math.log(k), 2),
            "extra_per_10x": round(math.log(10) / math.log(k), 2),
        },
    })


def main() -> None:
    distances()
    taiwan()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
