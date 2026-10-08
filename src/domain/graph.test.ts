import { describe, expect, it } from 'vitest';
import { getDirectDependencies, getTransitiveDependencies } from './graph';
import type { DependencyMap } from './types';

/** Builds a dependency map from `node: [the nodes it depends on]`. */
function graph(dependencies: Record<string, string[]>): DependencyMap {
  return new Map(Object.entries(dependencies));
}

describe('getDirectDependencies', () => {
  it('returns the nodes a node depends on directly', () => {
    const dependencies = graph({ a: [], b: ['a'] });

    expect(getDirectDependencies(dependencies, 'b')).toEqual(['a']);
  });

  it('returns nothing for a root node', () => {
    expect(getDirectDependencies(graph({ a: [], b: ['a'] }), 'a')).toEqual([]);
  });

  it('does not include ancestors further up the chain', () => {
    const dependencies = graph({ a: [], b: ['a'], c: ['b'] });

    expect(getDirectDependencies(dependencies, 'c')).toEqual(['b']);
  });

  it('removes duplicate references', () => {
    expect(getDirectDependencies(graph({ a: [], b: ['a', 'a'] }), 'b')).toEqual(['a']);
  });

  it('ignores references to nodes that do not exist', () => {
    expect(getDirectDependencies(graph({ a: [], b: ['ghost', 'a'] }), 'b')).toEqual(['a']);
  });

  it('ignores a node that lists itself', () => {
    expect(getDirectDependencies(graph({ a: [], b: ['b', 'a'] }), 'b')).toEqual(['a']);
  });

  it('returns nothing for a node that is not in the graph', () => {
    expect(getDirectDependencies(graph({ a: [] }), 'ghost')).toEqual([]);
  });
});

describe('getTransitiveDependencies', () => {
  it('returns nothing when all dependencies are direct', () => {
    expect(getTransitiveDependencies(graph({ a: [], b: ['a'] }), 'b')).toEqual([]);
  });

  it('returns the dependency of a dependency', () => {
    const dependencies = graph({ a: [], b: ['a'], c: ['b'] });

    expect(getTransitiveDependencies(dependencies, 'c')).toEqual(['a']);
  });

  it('walks a multi-level chain, closest ancestor first', () => {
    const dependencies = graph({ a: [], b: ['a'], c: ['b'], d: ['c'], e: ['d'] });

    expect(getTransitiveDependencies(dependencies, 'e')).toEqual(['c', 'b', 'a']);
  });

  it('follows every branch of a branching graph', () => {
    const dependencies = graph({ a: [], b: [], c: ['a'], d: ['b'], e: ['c', 'd'] });

    expect(getTransitiveDependencies(dependencies, 'e')).toEqual(['a', 'b']);
  });

  it('reports the shared ancestor of a diamond once', () => {
    //   a
    //  / \
    // b   c
    //  \ /
    //   d
    const dependencies = graph({ a: [], b: ['a'], c: ['a'], d: ['b', 'c'] });

    expect(getDirectDependencies(dependencies, 'd')).toEqual(['b', 'c']);
    expect(getTransitiveDependencies(dependencies, 'd')).toEqual(['a']);
  });

  it('treats a node that is both direct and reachable through another node as direct only', () => {
    const dependencies = graph({ a: [], b: ['a'], c: ['a', 'b'] });

    expect(getDirectDependencies(dependencies, 'c')).toEqual(['a', 'b']);
    expect(getTransitiveDependencies(dependencies, 'c')).toEqual([]);
  });

  it('keeps independent graphs apart', () => {
    const dependencies = graph({ a: [], b: ['a'], c: ['b'], x: [], y: ['x'], z: ['y'] });

    expect(getTransitiveDependencies(dependencies, 'c')).toEqual(['a']);
    expect(getTransitiveDependencies(dependencies, 'z')).toEqual(['x']);
  });

  it('does not report nodes that depend on the selected node', () => {
    const dependencies = graph({ a: [], b: ['a'], c: ['b'], d: ['c'] });

    expect(getTransitiveDependencies(dependencies, 'b')).toEqual([]);
  });

  it('skips references to nodes that do not exist and keeps walking the rest', () => {
    const dependencies = graph({ a: [], b: ['a', 'ghost'], c: ['b', 'phantom'] });

    expect(getTransitiveDependencies(dependencies, 'c')).toEqual(['a']);
  });

  it('terminates on a cycle and never reports the selected node', () => {
    // a → b → c → a
    const dependencies = graph({ a: ['c'], b: ['a'], c: ['b'] });

    expect(getDirectDependencies(dependencies, 'c')).toEqual(['b']);
    expect(getTransitiveDependencies(dependencies, 'c')).toEqual(['a']);
  });

  it('terminates on a cycle further upstream', () => {
    // a ⇄ b, then b → c
    const dependencies = graph({ a: ['b'], b: ['a'], c: ['b'] });

    expect(getTransitiveDependencies(dependencies, 'c')).toEqual(['a']);
  });

  it('returns nothing for a node that is not in the graph', () => {
    expect(getTransitiveDependencies(graph({ a: [] }), 'ghost')).toEqual([]);
  });

  it('gives the same answer regardless of the order nodes are declared in', () => {
    const forwards = graph({ a: [], b: ['a'], c: ['a'], d: ['b', 'c'], e: ['d'] });
    const backwards = graph({ e: ['d'], d: ['b', 'c'], c: ['a'], b: ['a'], a: [] });

    expect(getTransitiveDependencies(backwards, 'e')).toEqual(
      getTransitiveDependencies(forwards, 'e'),
    );
  });
});
