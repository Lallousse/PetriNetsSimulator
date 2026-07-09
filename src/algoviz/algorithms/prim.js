/**
 * Prim's Algorithm for Minimum Spanning Tree
 */

export function generatePrimSteps(graph, startNodeId) {
    // Check if start node exists
    if (!startNodeId || !graph.getNode(startNodeId)) {
        return {
            steps: [],
            error: 'Start node is required for Prim\'s algorithm.'
        };
    }
    
    const steps = [];
    const nodes = graph.nodes;
    const edges = graph.edges;
    
    // Create a copy of nodes and edges for visualization
    const nodesCopy = nodes.map(node => ({ ...node }));
    const edgesCopy = edges.map(edge => ({ ...edge }));
    
    // Initialize data structures
    const visited = new Set();
    const mstEdges = [];
    let totalMSTCost = 0;
    
    // Table data
    const headers = ["Step", "Action", "Current MST Nodes", "Candidate Edge (u,v)=w", "Total MST Cost"];
    const rows = [];
    
    // Add start node to visited set
    visited.add(startNodeId);
    
    // Initial row for the table
    const initialRow = [1, `Start with node ${graph.getNode(startNodeId).name}`, graph.getNode(startNodeId).name, "-", 0];
    rows.push(initialRow);
    
    // Add initial step
    steps.push({
        type: 'node-highlight',
        elementId: startNodeId,
        color: 'accent',
        text: `Starting Prim's algorithm from node ${graph.getNode(startNodeId).name}.`,
        nodesSnapshot: nodesCopy.map(node => ({
            ...node,
            color: node.id === startNodeId ? 'accent' : null
        })),
        edgesSnapshot: edgesCopy,
        tableData: {
            headers,
            rows: [...rows] // Create a copy of the current rows
        }
    });
    
    let stepCount = 2;
    
    // Continue until all nodes are visited or no more edges can be added
    while (visited.size < nodes.length) {
        let minEdge = null;
        let minWeight = Infinity;
        
        // Find all edges that connect a visited node to an unvisited node
        for (const edge of edges) {
            const fromNode = graph.getNode(edge.from);
            const toNode = graph.getNode(edge.to);
            
            if (!fromNode || !toNode) continue;
            
            // Check if this edge connects a visited node to an unvisited node
            // For MST algorithms, we treat all edges as undirected
            if (visited.has(edge.from) && !visited.has(edge.to)) {
                if (edge.weight < minWeight) {
                    minEdge = edge;
                    minWeight = edge.weight;
                }
            } else if (visited.has(edge.to) && !visited.has(edge.from)) {
                // Always consider edges in both directions, regardless of isDirected flag
                if (edge.weight < minWeight) {
                    minEdge = edge;
                    minWeight = edge.weight;
                }
            }
        }
        
        // If no edge is found, break the loop (graph might be disconnected)
        if (!minEdge) {
            steps.push({
                type: 'text-update',
                text: 'No more edges can be added. The graph might be disconnected.',
                nodesSnapshot: nodesCopy.map(node => ({
                    ...node,
                    color: visited.has(node.id) ? 'accent' : null
                })),
                edgesSnapshot: edgesCopy.map(edge => ({
                    ...edge,
                    color: mstEdges.includes(edge.id) ? 'accent' : null
                })),
                tableData: { headers, rows: [...rows] }
            });
            break;
        }
        
        // Determine the node to be added to the MST
        const newNodeId = visited.has(minEdge.from) ? minEdge.to : minEdge.from;
        const fromNodeName = graph.getNode(visited.has(minEdge.from) ? minEdge.from : minEdge.to).name;
        const toNodeName = graph.getNode(newNodeId).name;
        
        // Add a step to highlight the edge being considered
        steps.push({
            type: 'edge-highlight',
            elementId: minEdge.id,
            color: 'secondary',
            text: `Considering edge from ${fromNodeName} to ${toNodeName} with weight ${minEdge.weight}.`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: visited.has(node.id) ? 'accent' : null
            })),
            edgesSnapshot: edgesCopy.map(edge => ({
                ...edge,
                color: edge.id === minEdge.id ? 'secondary' : mstEdges.includes(edge.id) ? 'accent' : null
            })),
            tableData: { headers, rows: [...rows] }
        });
        
        // Add the new node to the visited set
        visited.add(newNodeId);
        
        // Add the edge to the MST
        mstEdges.push(minEdge.id);
        totalMSTCost += minEdge.weight;
        
        // Create a list of current MST nodes
        const mstNodeNames = Array.from(visited).map(id => graph.getNode(id).name).join(', ');
        
        // Add a new row to the table
        const newRow = [
            stepCount++,
            `Added edge ${fromNodeName}-${toNodeName} to MST. Node ${toNodeName} joined MST.`,
            mstNodeNames,
            `(${fromNodeName},${toNodeName})=${minEdge.weight}`,
            totalMSTCost
        ];
        rows.push(newRow);
        
        // Add a step to add the edge to the MST
        steps.push({
            type: 'edge-highlight',
            elementId: minEdge.id,
            color: 'accent',
            text: `Added edge ${fromNodeName}-${toNodeName} to MST. Node ${toNodeName} joined MST.`,
            nodesSnapshot: nodesCopy.map(node => ({
                ...node,
                color: visited.has(node.id) ? 'accent' : null
            })),
            edgesSnapshot: edgesCopy.map(edge => ({
                ...edge,
                color: mstEdges.includes(edge.id) ? 'accent' : null
            })),
            tableData: { headers, rows: [...rows] }
        });
    }
    
    // Add final step
    steps.push({
        type: 'final',
        text: `Prim's algorithm completed. Total MST cost: ${totalMSTCost}.`,
        nodesSnapshot: nodesCopy.map(node => ({
            ...node,
            color: visited.has(node.id) ? 'accent' : null
        })),
        edgesSnapshot: edgesCopy.map(edge => ({
            ...edge,
            color: mstEdges.includes(edge.id) ? 'accent' : null
        })),
        tableData: { headers, rows: [...rows] }
    });
    
    return { steps };
} 