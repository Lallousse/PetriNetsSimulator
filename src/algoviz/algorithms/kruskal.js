/**
 * Kruskal's Algorithm for Minimum Spanning Tree
 */

export function generateKruskalSteps(graph) {
    const steps = [];
    const nodes = graph.nodes;
    const edges = graph.edges;
    
    // Create a copy of nodes and edges for visualization
    const nodesCopy = nodes.map(node => ({ ...node }));
    const edgesCopy = edges.map(edge => ({ ...edge }));
    
    // Table data
    const headers = ["Step", "Edge Considered (u,v)=w", "Find(u)", "Find(v)", "Action", "MST Edges", "Total MST Cost"];
    const rows = [];
    
    // Initialize Disjoint Set Union (DSU)
    const parent = {};
    const rank = {};
    
    // Make set for each node
    nodes.forEach(node => {
        parent[node.id] = node.id;
        rank[node.id] = 0;
    });
    
    // Find function for DSU with path compression
    function find(x) {
        if (parent[x] !== x) {
            parent[x] = find(parent[x]);
        }
        return parent[x];
    }
    
    // Union function for DSU with rank
    function union(x, y) {
        const rootX = find(x);
        const rootY = find(y);
        
        if (rootX === rootY) return;
        
        if (rank[rootX] < rank[rootY]) {
            parent[rootX] = rootY;
        } else if (rank[rootX] > rank[rootY]) {
            parent[rootY] = rootX;
        } else {
            parent[rootY] = rootX;
            rank[rootX]++;
        }
    }
    
    // Sort edges by weight
    const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight);
    
    // Add initial step
    steps.push({
        type: 'text-update',
        text: `Starting Kruskal's algorithm. Edges are sorted by weight.`,
        nodesSnapshot: nodesCopy,
        edgesSnapshot: edgesCopy,
        tableData: {
            headers,
            rows: [...rows]
        }
    });
    
    const mstEdges = [];
    let totalMSTCost = 0;
    let stepCount = 1;
    
    // Process each edge in ascending order of weight
    // Note: Kruskal's algorithm treats all edges as undirected, ignoring any direction flags
    for (const edge of sortedEdges) {
        const fromNode = graph.getNode(edge.from);
        const toNode = graph.getNode(edge.to);
        
        if (!fromNode || !toNode) continue;
        
        const fromRoot = find(edge.from);
        const toRoot = find(edge.to);
        
        const fromRootName = graph.getNode(fromRoot).name;
        const toRootName = graph.getNode(toRoot).name;
        
        // Add a step to highlight the edge being considered
        steps.push({
            type: 'edge-highlight',
            elementId: edge.id,
            color: 'secondary',
            text: `Considering edge ${fromNode.name}-${toNode.name} with weight ${edge.weight}.`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: mstEdges.some(e => {
                    const edgeObj = graph.getEdge(e);
                    return edgeObj.from === node.id || edgeObj.to === node.id;
                }) ? 'accent' : null
            })),
            edgesSnapshot: edgesCopy.map(e => ({
                ...e,
                color: e.id === edge.id ? 'secondary' : mstEdges.includes(e.id) ? 'accent' : null
            })),
            tableData: { headers, rows: [...rows] }
        });
        
        let action, color;
        
        if (fromRoot !== toRoot) {
            // Add edge to MST
            union(edge.from, edge.to);
            mstEdges.push(edge.id);
            totalMSTCost += edge.weight;
            action = "Add to MST";
            color = 'accent';
        } else {
            // Skip edge (would form a cycle)
            action = "Forms Cycle - Skipped";
            color = null;
        }
        
        // Add row to the table
        rows.push([
            stepCount++,
            `(${fromNode.name},${toNode.name})=${edge.weight}`,
            fromRootName,
            toRootName,
            action,
            mstEdges.length,
            totalMSTCost
        ]);
        
        // Add a step to show the action taken
        steps.push({
            type: 'edge-highlight',
            elementId: edge.id,
            color: color,
            text: `${action}: Edge ${fromNode.name}-${toNode.name} with weight ${edge.weight}. ${action === "Add to MST" ? `Total MST cost: ${totalMSTCost}.` : "Would form a cycle."}`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: mstEdges.some(e => {
                    const edgeObj = graph.getEdge(e);
                    return edgeObj.from === node.id || edgeObj.to === node.id;
                }) ? 'accent' : null
            })),
            edgesSnapshot: edgesCopy.map(e => ({
                ...e,
                color: mstEdges.includes(e.id) ? 'accent' : null
            })),
            tableData: { headers, rows: [...rows] }
        });
    }
    
    // Add final step
    steps.push({
        type: 'final',
        text: `Kruskal's algorithm completed. Total MST cost: ${totalMSTCost}.`,
        nodesSnapshot: nodesCopy.map(node => ({
            ...node,
            color: mstEdges.some(e => {
                const edgeObj = graph.getEdge(e);
                return edgeObj.from === node.id || edgeObj.to === node.id;
            }) ? 'accent' : null
        })),
        edgesSnapshot: edgesCopy.map(edge => ({
            ...edge,
            color: mstEdges.includes(edge.id) ? 'accent' : null
        })),
        tableData: { headers, rows: [...rows] }
    });
    
    return { steps };
} 