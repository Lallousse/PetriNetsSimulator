/**
 * Bellman-Ford Algorithm for Shortest Paths (with negative edge weights)
 */

export function generateBellmanFordSteps(graph, startNodeId) {
    // Check if start node exists
    if (!startNodeId || !graph.getNode(startNodeId)) {
        return {
            steps: [],
            error: 'Start node is required for Bellman-Ford algorithm.'
        };
    }
    
    const steps = [];
    const nodes = graph.nodes;
    const edges = graph.edges;
    
    // Create a copy of nodes and edges for visualization
    const nodesCopy = nodes.map(node => ({ ...node }));
    const edgesCopy = edges.map(edge => ({ ...edge }));
    
    // Initialize distances and predecessors
    const distances = {};
    const predecessors = {};
    
    // Initialize all distances to Infinity except the start node
    nodes.forEach(node => {
        distances[node.id] = node.id === startNodeId ? 0 : Infinity;
        predecessors[node.id] = null;
    });
    
    // Table data
    const headers = ["Iteration", ...nodes.map(node => node.name)];
    const rows = [];
    
    // Add initial step
    steps.push({
        type: 'node-highlight',
        elementId: startNodeId,
        color: 'accent',
        text: `Starting Bellman-Ford algorithm from node ${graph.getNode(startNodeId).name}.`,
        nodesSnapshot: nodesCopy.map(node => ({
            ...node,
            color: node.id === startNodeId ? 'accent' : null,
            label: distances[node.id]
        })),
        edgesSnapshot: edgesCopy,
        tableData: {
            headers,
            rows: []
        }
    });
    
    // Add initial row to the table
    const initialRow = ["0 (Initial)"];
    nodes.forEach(node => {
        const dist = distances[node.id];
        const pred = predecessors[node.id];
        const predName = pred ? graph.getNode(pred).name : "-";
        initialRow.push(dist === Infinity ? "∞(-)" : `${dist}(${predName})`);
    });
    rows.push(initialRow);
    
    // Main algorithm loop - |V| - 1 iterations
    const numIterations = nodes.length - 1;
    let hasNegativeCycle = false;
    
    for (let i = 0; i < numIterations + 1; i++) {
        const isNegativeCycleCheck = i === numIterations;
        
        // Add a step to start the iteration
        steps.push({
            type: 'text-update',
            text: isNegativeCycleCheck 
                ? `Starting iteration ${i+1} (checking for negative cycles).` 
                : `Starting iteration ${i+1} of ${numIterations}.`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: node.id === startNodeId ? 'accent' : null,
                label: distances[node.id]
            })),
            edgesSnapshot: edgesCopy,
            tableData: { headers, rows: [...rows] }
        });
        
        let relaxed = false; // Track if any edge was relaxed in this iteration
        
        // Process each edge
        for (const edge of edges) {
            const fromNode = graph.getNode(edge.from);
            const toNode = graph.getNode(edge.to);
            
            if (!fromNode || !toNode) continue;
            
            // Skip if the source node is not reachable
            if (distances[edge.from] === Infinity) continue;
            
            // Add a step to highlight the edge being considered
            steps.push({
                type: 'edge-highlight',
                elementId: edge.id,
                color: 'secondary',
                text: `Considering edge from ${fromNode.name} to ${toNode.name} with weight ${edge.weight}.`,
                nodesSnapshot: nodesCopy.map(node => ({
                    ...node,
                    color: node.id === startNodeId ? 'accent' : null,
                    label: distances[node.id]
                })),
                edgesSnapshot: edgesCopy.map(e => ({
                    ...e,
                    color: e.id === edge.id ? 'secondary' : null
                })),
                tableData: { headers, rows: [...rows] }
            });
            
            // Calculate new distance
            const newDistance = distances[edge.from] + edge.weight;
            
            // If we found a shorter path
            if (newDistance < distances[edge.to]) {
                // If this is the negative cycle check iteration and we found a shorter path,
                // then there is a negative cycle
                if (isNegativeCycleCheck) {
                    hasNegativeCycle = true;
                    
                    // Mark nodes and edges involved in the negative cycle
                    steps.push({
                        type: 'edge-highlight',
                        elementId: edge.id,
                        color: 'destructive',
                        text: `Negative cycle detected! Edge ${fromNode.name}-${toNode.name} can still reduce the distance to ${toNode.name}.`,
                        nodesSnapshot: nodesCopy.map(node => ({
                            ...node,
                            color: node.id === edge.to ? 'destructive' : node.id === startNodeId ? 'accent' : null,
                            label: node.id === edge.to ? -Infinity : distances[node.id]
                        })),
                        edgesSnapshot: edgesCopy.map(e => ({
                            ...e,
                            color: e.id === edge.id ? 'destructive' : null
                        })),
                        tableData: { headers, rows: [...rows] }
                    });
                    
                    // Update the distance to -Infinity
                    distances[edge.to] = -Infinity;
                    
                    // We can break early as we found a negative cycle
                    break;
                } else {
                    // Normal relaxation step
                    distances[edge.to] = newDistance;
                    predecessors[edge.to] = edge.from;
                    relaxed = true;
                    
                    // Add a step to update the distance
                    steps.push({
                        type: 'node-update',
                        elementId: edge.to,
                        color: 'primary',
                        data: { label: newDistance },
                        text: `Updated distance to node ${toNode.name}: ${newDistance} via ${fromNode.name}.`,
                        nodesSnapshot: nodesCopy.map(node => ({
                            ...node,
                            color: node.id === edge.to ? 'primary' : node.id === startNodeId ? 'accent' : null,
                            label: node.id === edge.to ? newDistance : distances[node.id]
                        })),
                        edgesSnapshot: edgesCopy.map(e => ({
                            ...e,
                            color: e.id === edge.id ? 'primary' : null
                        })),
                        tableData: { headers, rows: [...rows] }
                    });
                }
            }
        }
        
        // Create row for the current iteration
        const iterationRow = [isNegativeCycleCheck ? `${i+1} (Neg. Cycle Check)` : `${i+1}`];
        nodes.forEach(node => {
            const dist = distances[node.id];
            const pred = predecessors[node.id];
            const predName = pred ? graph.getNode(pred).name : "-";
            
            if (dist === -Infinity) {
                iterationRow.push("-∞(-)");
            } else {
                iterationRow.push(dist === Infinity ? "∞(-)" : `${dist}(${predName})`);
            }
        });
        rows.push(iterationRow);
        
        // If no edge was relaxed in this iteration and we're not in the negative cycle check,
        // we can terminate early
        if (!relaxed && !isNegativeCycleCheck) {
            steps.push({
                type: 'text-update',
                text: `No distances were updated in iteration ${i+1}. Algorithm can terminate early.`,
                nodesSnapshot: nodesCopy.map(node => ({
                    ...node,
                    color: node.id === startNodeId ? 'accent' : null,
                    label: distances[node.id]
                })),
                edgesSnapshot: edgesCopy,
                tableData: { headers, rows: [...rows] }
            });
            break;
        }
        
        // If we found a negative cycle, propagate -Infinity to all reachable nodes
        if (hasNegativeCycle) {
            // Find all nodes reachable from the negative cycle
            const reachableFromNegativeCycle = new Set();
            
            // First, find nodes directly in a negative cycle (with -Infinity distance)
            nodes.forEach(node => {
                if (distances[node.id] === -Infinity) {
                    reachableFromNegativeCycle.add(node.id);
                }
            });
            
            // Then, propagate to all nodes reachable from these nodes
            let changed = true;
            while (changed) {
                changed = false;
                
                for (const edge of edges) {
                    if (reachableFromNegativeCycle.has(edge.from) && !reachableFromNegativeCycle.has(edge.to)) {
                        reachableFromNegativeCycle.add(edge.to);
                        distances[edge.to] = -Infinity;
                        changed = true;
                    }
                }
            }
            
            // Add a step to show the propagation of negative infinity
            steps.push({
                type: 'text-update',
                text: `Propagating negative infinity to all nodes reachable from the negative cycle.`,
                nodesSnapshot: nodesCopy.map(node => ({
                    ...node,
                    color: reachableFromNegativeCycle.has(node.id) ? 'destructive' : node.id === startNodeId ? 'accent' : null,
                    label: reachableFromNegativeCycle.has(node.id) ? -Infinity : distances[node.id]
                })),
                edgesSnapshot: edgesCopy.map(edge => ({
                    ...edge,
                    color: reachableFromNegativeCycle.has(edge.from) && reachableFromNegativeCycle.has(edge.to) ? 'destructive' : null
                })),
                tableData: { headers, rows: [...rows] }
            });
            
            // Add a final row showing the propagated -Infinity values
            const finalRow = [`Final (with -∞)`];
            nodes.forEach(node => {
                if (reachableFromNegativeCycle.has(node.id)) {
                    finalRow.push("-∞(-)");
                } else {
                    const dist = distances[node.id];
                    const pred = predecessors[node.id];
                    const predName = pred ? graph.getNode(pred).name : "-";
                    finalRow.push(dist === Infinity ? "∞(-)" : `${dist}(${predName})`);
                }
            });
            rows.push(finalRow);
            
            break;
        }
    }
    
    // Highlight the shortest paths in the final step if no negative cycle
    if (!hasNegativeCycle) {
        const shortestPathEdges = new Set();
        
        nodes.forEach(node => {
            if (node.id !== startNodeId && predecessors[node.id] !== null && distances[node.id] !== Infinity) {
                let current = node.id;
                while (current !== startNodeId) {
                    const prev = predecessors[current];
                    
                    // Find the edge between prev and current
                    const edge = edges.find(e => 
                        (e.from === prev && e.to === current) || 
                        (!e.isDirected && e.from === current && e.to === prev)
                    );
                    
                    if (edge) {
                        shortestPathEdges.add(edge.id);
                    }
                    
                    current = prev;
                }
            }
        });
        
        // Add final step
        steps.push({
            type: 'final',
            text: `Bellman-Ford algorithm completed. No negative cycles detected. Shortest paths from ${graph.getNode(startNodeId).name} to all reachable nodes have been found.`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: node.id === startNodeId ? 'accent' : null,
                label: distances[node.id]
            })),
            edgesSnapshot: edgesCopy.map(edge => ({
                ...edge,
                color: shortestPathEdges.has(edge.id) ? 'accent' : null
            })),
            tableData: { headers, rows: [...rows] }
        });
    } else {
        // Add final step for negative cycle case
        steps.push({
            type: 'final',
            text: `Bellman-Ford algorithm completed. Negative cycle detected! Some distances are -∞.`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: distances[node.id] === -Infinity ? 'destructive' : node.id === startNodeId ? 'accent' : null,
                label: distances[node.id]
            })),
            edgesSnapshot: edgesCopy,
            tableData: { headers, rows: [...rows] }
        });
    }
    
    return { steps };
} 