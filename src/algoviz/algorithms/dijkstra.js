/**
 * Dijkstra's Algorithm for Shortest Paths
 */

export function generateDijkstraSteps(graph, startNodeId) {
    // Check if start node exists
    if (!startNodeId || !graph.getNode(startNodeId)) {
        return {
            steps: [],
            error: 'Start node is required for Dijkstra\'s algorithm.'
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
    const visited = new Set();
    
    // Initialize all distances to Infinity except the start node
    nodes.forEach(node => {
        distances[node.id] = node.id === startNodeId ? 0 : Infinity;
        predecessors[node.id] = null;
    });
    
    // Table data
    const headers = ["Sequence", ...nodes.map(node => node.name)];
    const rows = [];
    
    // Create the initial row showing distances before any node is visited
    const initialRow = [graph.getNode(startNodeId).name];
    nodes.forEach(node => {
        if (node.id === startNodeId) {
            initialRow.push("0(-)");
        } else {
            initialRow.push("∞(-)");
        }
    });
    rows.push(initialRow);
    
    // Add initial step
    steps.push({
        type: 'node-highlight',
        elementId: startNodeId,
        color: 'accent',
        text: `Starting Dijkstra's algorithm from node ${graph.getNode(startNodeId).name}.`,
        nodesSnapshot: nodesCopy.map(node => ({
            ...node,
            color: node.id === startNodeId ? 'accent' : null,
            label: distances[node.id]
        })),
        edgesSnapshot: edgesCopy,
        tableData: {
            headers,
            rows: [...rows]
        }
    });
    
    // Track the sequence of visited nodes
    let sequence = graph.getNode(startNodeId).name;
    
    // Process the direct neighbors of the start node
    const startNeighbors = graph.getNeighbors(startNodeId);
    let hasUpdatedNeighbors = false;
    
    for (const neighbor of startNeighbors) {
        const neighborNode = graph.getNode(neighbor.nodeId);
        const edge = graph.getEdge(neighbor.edgeId);
        
        // Update distance
        distances[neighborNode.id] = edge.weight;
        predecessors[neighborNode.id] = startNodeId;
        hasUpdatedNeighbors = true;
    }
    
    // If we updated any neighbors, add a row showing the updated distances
    if (hasUpdatedNeighbors) {
        const updatedRow = [sequence];
        nodes.forEach(node => {
            if (node.id === startNodeId) {
                updatedRow.push("x");
            } else {
                const dist = distances[node.id];
                const pred = predecessors[node.id];
                const predName = pred ? graph.getNode(pred).name : "-";
                updatedRow.push(dist === Infinity ? "∞(-)" : `${dist}(${predName})`);
            }
        });
        rows.push(updatedRow);
    }
    
    // Mark start node as visited
    visited.add(startNodeId);
    
    // Main algorithm loop
    while (visited.size < nodes.length) {
        // Find the unvisited node with the smallest distance
        let minDistance = Infinity;
        let minNode = null;
        
        nodes.forEach(node => {
            if (!visited.has(node.id) && distances[node.id] < minDistance) {
                minDistance = distances[node.id];
                minNode = node;
            }
        });
        
        // If no reachable node is found, break
        if (!minNode || minDistance === Infinity) {
            steps.push({
                type: 'text-update',
                text: 'No more nodes can be reached.',
                nodesSnapshot: nodesCopy.map(node => ({
                    ...node,
                    color: visited.has(node.id) ? 'accent' : null,
                    label: distances[node.id]
                })),
                edgesSnapshot: edgesCopy,
                tableData: { headers, rows: [...rows] }
            });
            break;
        }
        
        // Update the sequence with the node we're about to visit
        sequence += minNode.name;
        
        // Add a step to highlight the current node
        steps.push({
            type: 'node-highlight',
            elementId: minNode.id,
            color: 'accent',
            text: `Visiting node ${minNode.name} with distance ${distances[minNode.id]}.`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: visited.has(node.id) ? 'accent' : null,
                label: distances[node.id]
            })),
            edgesSnapshot: edgesCopy.map(edge => {
                // Highlight edges in the shortest path tree
                if (edge.from === predecessors[minNode.id] && edge.to === minNode.id) {
                    return { ...edge, color: 'accent' };
                } else if (!edge.isDirected && edge.to === predecessors[minNode.id] && edge.from === minNode.id) {
                    return { ...edge, color: 'accent' };
                }
                return { ...edge };
            }),
            tableData: { headers, rows: [...rows] }
        });
        
        // Mark the node as visited
        visited.add(minNode.id);
        
        // Explore neighbors and update distances BEFORE creating the table row
        const neighbors = graph.getNeighbors(minNode.id);
        
        for (const neighbor of neighbors) {
            const neighborNode = graph.getNode(neighbor.nodeId);
            
            if (visited.has(neighborNode.id)) continue;
            
            const edge = graph.getEdge(neighbor.edgeId);
            const newDistance = distances[minNode.id] + edge.weight;
            
            // If we found a shorter path
            if (newDistance < distances[neighborNode.id]) {
                distances[neighborNode.id] = newDistance;
                predecessors[neighborNode.id] = minNode.id;
            }
        }
        
        // NOW create row for the current state after visiting the node and updating neighbors
        const row = [sequence];
        nodes.forEach(node => {
            if (visited.has(node.id)) {
                // Already visited nodes
                row.push("x");
            } else {
                // Unvisited nodes - show current distance and predecessor
                const dist = distances[node.id];
                const pred = predecessors[node.id];
                const predName = pred ? graph.getNode(pred).name : "-";
                row.push(dist === Infinity ? "∞(-)" : `${dist}(${predName})`);
            }
        });
        rows.push(row);
        
        // Now add visualization steps for each neighbor exploration
        for (const neighbor of neighbors) {
            const neighborNode = graph.getNode(neighbor.nodeId);
            
            if (visited.has(neighborNode.id)) continue;
            
            const edge = graph.getEdge(neighbor.edgeId);
            
            // Add a step to highlight the edge being considered
            steps.push({
                type: 'edge-highlight',
                elementId: edge.id,
                color: 'secondary',
                text: `Considering edge from ${minNode.name} to ${neighborNode.name} with weight ${edge.weight}.`,
                nodesSnapshot: nodesCopy.map(node => ({
                    ...node,
                    color: visited.has(node.id) ? 'accent' : null,
                    label: distances[node.id]
                })),
                edgesSnapshot: edgesCopy.map(e => {
                    if (e.id === edge.id) {
                        return { ...e, color: 'secondary' };
                    } else if (
                        (e.from === predecessors[e.to] && visited.has(e.to)) ||
                        (!e.isDirected && e.to === predecessors[e.from] && visited.has(e.from))
                    ) {
                        return { ...e, color: 'accent' };
                    }
                    return { ...e };
                }),
                tableData: { headers, rows: [...rows] }
            });
            
            const newDistance = distances[minNode.id] + edge.weight;
            
            // If this is the path we're using, highlight it
            if (distances[neighborNode.id] === newDistance && predecessors[neighborNode.id] === minNode.id) {
                // Add a step to show the updated distance
                steps.push({
                    type: 'node-update',
                    elementId: neighborNode.id,
                    color: 'primary',
                    data: { label: newDistance },
                    text: `Updated distance to node ${neighborNode.name}: ${newDistance} via ${minNode.name}.`,
                    nodesSnapshot: nodesCopy.map(node => ({
                        ...node,
                        color: node.id === neighborNode.id ? 'primary' : visited.has(node.id) ? 'accent' : null,
                        label: node.id === neighborNode.id ? newDistance : distances[node.id]
                    })),
                    edgesSnapshot: edgesCopy.map(e => {
                        if (e.id === edge.id) {
                            return { ...e, color: 'primary' };
                        } else if (
                            (e.from === predecessors[e.to] && visited.has(e.to)) ||
                            (!e.isDirected && e.to === predecessors[e.from] && visited.has(e.from))
                        ) {
                            return { ...e, color: 'accent' };
                        }
                        return { ...e };
                    }),
                    tableData: { headers, rows: [...rows] }
                });
            } else if (distances[neighborNode.id] < newDistance) {
                // Add a step to show that the current path is better
                steps.push({
                    type: 'text-update',
                    text: `Current path to ${neighborNode.name} (distance ${distances[neighborNode.id]}) is better than the new path via ${minNode.name} (distance ${newDistance}).`,
                    nodesSnapshot: nodesCopy.map(node => ({
                        ...node,
                        color: visited.has(node.id) ? 'accent' : null,
                        label: distances[node.id]
                    })),
                    edgesSnapshot: edgesCopy.map(e => {
                        if (
                            (e.from === predecessors[e.to] && visited.has(e.to)) ||
                            (!e.isDirected && e.to === predecessors[e.from] && visited.has(e.from))
                        ) {
                            return { ...e, color: 'accent' };
                        }
                        return { ...e };
                    }),
                    tableData: { headers, rows: [...rows] }
                });
            }
        }
    }
    
    // Highlight the shortest paths in the final step
    const shortestPathEdges = new Set();
    
    nodes.forEach(node => {
        if (node.id !== startNodeId && predecessors[node.id] !== null) {
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
        text: `Dijkstra's algorithm completed. Shortest paths from ${graph.getNode(startNodeId).name} to all reachable nodes have been found.`,
        nodesSnapshot: nodesCopy.map(node => ({
            ...node,
            color: visited.has(node.id) ? 'accent' : null,
            label: distances[node.id]
        })),
        edgesSnapshot: edgesCopy.map(edge => ({
            ...edge,
            color: shortestPathEdges.has(edge.id) ? 'accent' : null
        })),
        tableData: { headers, rows: [...rows] }
    });
    
    return { steps };
} 