// 第 7 章：同一張網路，不同的中心性指向不同的人（隊長 vs. 學長）；梅迪奇在四種中心性都最高。
import { describe, it, expect } from 'vitest';
import { CAPTAIN, centralities, makeNetwork, MEASURES, NET_EDGES, NET_LABELS, rankOf, SENIOR, topOf } from '../../src/components/chapters/ch7/model';
import * as net from '../../src/lib/network';
import flo from '../../data/build/07-centrality/florentine_centrality.json';
import funnel from '../../data/build/07-centrality/milgram_funnel.json';
import people from '../../data/build/07-centrality/people_funnel.json';

describe('第 7 章模型', () => {
  const g = makeNetwork();
  const c = centralities(g);
  it('40 人、連通', () => {
    expect(g.n).toBe(40);
    expect(net.isConnected(g)).toBe(true);
    expect(NET_EDGES.length).toBe(net.numEdges(g));
    expect(NET_LABELS.length).toBe(40);
  });
  it('度和特徵向量的第一名是籃球隊長；接近和介數的第一名是學長', () => {
    expect(topOf(c.degree)).toBe(CAPTAIN);
    expect(topOf(c.eigenvector)).toBe(CAPTAIN);
    expect(topOf(c.closeness)).toBe(SENIOR);
    expect(topOf(c.betweenness)).toBe(SENIOR);
  });
  it('學長的朋友不是最多（度排第 2 以後）', () => {
    expect(rankOf(c.degree, SENIOR)).toBeGreaterThan(1);
    expect(MEASURES.map((m) => m.key)).toEqual(['degree', 'closeness', 'betweenness', 'eigenvector']);
  });
});

describe('第 7 章資料', () => {
  const d = flo as any;
  it('佛羅倫斯：15 家族、20 條婚姻；梅迪奇四種中心性都第一，介數是第二名的兩倍以上', () => {
    expect(d.network.labels.length).toBe(15);
    expect(d.network.edges.length).toBe(20);
    expect(d.facts.medici_top_in).toEqual(['度', '接近', '介數', '特徵向量']);
    const [first, second] = d.series[0].points;
    expect(first.x).toBe('Medici');
    expect(first.y / second.y).toBeGreaterThan(2);
  });
  it('與程式庫的介數計算一致（networkx 與 src/lib/network）', () => {
    const g = net.fromEdges(15, d.network.edges);
    const b = net.betweennessCentrality(g);
    b.forEach((v: number, i: number) => expect(v).toBeCloseTo(d.network.betweenness[i], 3));
  });
  it('Milgram 的 G 先生：64 條中的 16 條；小人圖總數 64', () => {
    expect((funnel as any).facts.mr_g).toBe(16);
    const total = (people as any).rows[0].groups.reduce((s: number, g: any) => s + g.count, 0);
    expect(total).toBe(64);
  });
});
