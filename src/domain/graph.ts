import type { DependencyMap } from './types';

/**
 * Upstream traversal of the blueprint DAG.
 *
 * "Upstream" means against the direction of the API's edges: an edge `source → target` says
 * `target` depends on `source`, so the dependencies of a node are found by walking from it
 * towards the sources.
 *
 * Both functions tolerate malformed input rather than trusting it:
 * - ids that are not nodes of the graph are ignored,
 * - a node is never reported as its own dependency (self-loops, cycles),
 * - every node is reported at most once (diamonds, duplicate edges),
 * - a cycle ends the walk instead of looping forever.
 */

/** The existing nodes `nodeId` directly depends on, without duplicates or `nodeId` itself. */
export function getDirectDependencies(dependencies: DependencyMap, nodeId: string): string[] {
  const parents = new Set<string>();
  for (const parentId of dependencies.get(nodeId) ?? []) {
    if (parentId !== nodeId && dependencies.has(parentId)) parents.add(parentId);
  }
  return [...parents];
}

/**
 * The nodes `nodeId` depends on only through other nodes: every ancestor that is not a direct
 * dependency. A node reachable both directly and through a longer path counts as direct, so
 * the two functions never return the same node.
 *
 * Breadth-first, so the result is ordered closest ancestor first.
 */
export function getTransitiveDependencies(dependencies: DependencyMap, nodeId: string): string[] {
  const direct = getDirectDependencies(dependencies, nodeId);
  // Seeding `visited` with the start node and its parents keeps both out of the result.
  const visited = new Set([nodeId, ...direct]);
  const transitive: string[] = [];

  // `queue` grows while it is being iterated: `for…of` also visits the ids pushed below.
  const queue = [...direct];
  for (const currentId of queue) {
    for (const parentId of getDirectDependencies(dependencies, currentId)) {
      if (visited.has(parentId)) continue;
      visited.add(parentId);
      transitive.push(parentId);
      queue.push(parentId);
    }
  }
  return transitive;
}
