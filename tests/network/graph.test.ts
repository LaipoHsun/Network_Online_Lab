import { describe, it, expect } from 'vitest';
import * as net from '../../src/lib/network';

describe('Graph 基本操作', () => {
  const g = net.fromEdges(4, [[0, 1], [1, 0], [1, 2], [2, 2], [2, 3]]);
  it('忽略重複連結與自環，鄰居排序', () => {
    expect(g.adj).toEqual([[1], [0, 2], [1, 3], [2]]);
    expect(net.numEdges(g)).toBe(3);
  });
  it('超出範圍的節點會丟錯', () => {
    expect(() => net.fromEdges(2, [[0, 2]])).toThrow();
    expect(() => net.fromEdges(2, [], ['a'])).toThrow();
  });
  it('hasEdge', () => {
    expect(net.hasEdge(g, 1, 2)).toBe(true);
    expect(net.hasEdge(g, 0, 3)).toBe(false);
  });
  it('removeEdges / addEdges 不改動原圖', () => {
    const h = net.removeEdges(g, [[2, 1]]);
    expect(net.numEdges(h)).toBe(2);
    expect(net.numEdges(g)).toBe(3);
    expect(net.numEdges(net.addEdges(h, [[0, 3]]))).toBe(3);
  });
  it('isolateNodes：拿掉一個人（第 7 章「休學」）', () => {
    const h = net.isolateNodes(g, [1]);
    expect(h.adj[1]).toEqual([]);
    expect(net.connectedComponents(h)).toEqual([[2, 3], [0], [1]]);
    expect(net.largestComponentFraction(h)).toBe(0.5);
  });
  it('subgraph 重新編號並保留名稱', () => {
    const named = net.fromEdges(3, [[0, 1], [1, 2]], ['甲', '乙', '丙']);
    const { graph, original } = net.subgraph(named, [2, 1]);
    expect(original).toEqual([1, 2]);
    expect(graph.labels).toEqual(['乙', '丙']);
    expect(net.edges(graph)).toEqual([[0, 1]]);
  });
  it('空圖與單點', () => {
    expect(net.averageDegree(net.emptyGraph(0))).toBe(0);
    expect(net.averageShortestPathLength(net.emptyGraph(1))).toBe(0);
    expect(net.louvain(net.emptyGraph(3)).modularity).toBe(0);
    expect(net.medianDegree(net.fromEdges(4, [[0, 1], [0, 2], [0, 3]]))).toBe(1);
  });
  it('membership ↔ communities', () => {
    expect(net.communitiesFromMembership([1, 0, 1, 2])).toEqual([[0, 2], [1], [3]]);
    expect(net.membershipFromCommunities(3, [[2], [0, 1]])).toEqual([1, 1, 0]);
    expect(() => net.membershipFromCommunities(3, [[0], [0, 1, 2]])).toThrow();
  });
});
