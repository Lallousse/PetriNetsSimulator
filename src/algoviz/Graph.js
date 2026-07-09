/**
 * Graph data structure and related functions
 */

import { generateId } from './utils.js';

// Node class
export class Node {
    constructor(id, x, y, name) {
        this.id = id || generateId();
        this.x = x;
        this.y = y;
        this.name = name;
        this.color = null;
        this.label = null;
    }
}

// Edge class
export class Edge {
    constructor(id, from, to, weight = 1, isDirected = undefined) {
        this.id = id || generateId();
        this.from = from;
        this.to = to;
        this.weight = weight;
        this.isDirected = isDirected;
        this.color = null;
    }
}

// Graph class
export class Graph {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.nodeCounter = 1;
        this.isSaved = true;
    }

    // Add a node to the graph
    addNode(x, y) {
        const name = `N${this.nodeCounter++}`;
        const node = new Node(null, x, y, name);
        this.nodes.push(node);
        this.isSaved = false;
        return node;
    }

    // Add an edge to the graph
    addEdge(fromNodeId, toNodeId, weight = 1, isDirected = undefined) {
        // Check if edge already exists
        const existingEdge = this.edges.find(e => 
            (e.from === fromNodeId && e.to === toNodeId) || 
            (!isDirected && e.from === toNodeId && e.to === fromNodeId)
        );

        if (existingEdge) {
            return null;
        }

        // Ensure isDirected is explicitly set based on algorithm
        if (isDirected === undefined) {
            const currentAlgorithm = document.getElementById('algorithm-select').value;
            isDirected = currentAlgorithm === 'dijkstra' || currentAlgorithm === 'bellmanFord';
        }

        const edge = new Edge(null, fromNodeId, toNodeId, weight, isDirected);
        this.edges.push(edge);
        this.isSaved = false;
        return edge;
    }

    // Update a node
    updateNode(nodeId, updates) {
        const node = this.getNode(nodeId);
        if (!node) return false;

        Object.assign(node, updates);
        this.isSaved = false;
        return true;
    }

    // Update an edge
    updateEdge(edgeId, updates) {
        const edge = this.getEdge(edgeId);
        if (!edge) return false;

        Object.assign(edge, updates);
        this.isSaved = false;
        return true;
    }

    // Delete a node and its connected edges
    deleteNode(nodeId) {
        const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) return false;

        // Remove the node
        this.nodes.splice(nodeIndex, 1);

        // Remove all edges connected to this node
        this.edges = this.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
        
        this.isSaved = false;
        return true;
    }

    // Delete an edge
    deleteEdge(edgeId) {
        const edgeIndex = this.edges.findIndex(e => e.id === edgeId);
        if (edgeIndex === -1) return false;

        this.edges.splice(edgeIndex, 1);
        this.isSaved = false;
        return true;
    }

    // Get a node by ID
    getNode(nodeId) {
        return this.nodes.find(n => n.id === nodeId);
    }

    // Get an edge by ID
    getEdge(edgeId) {
        return this.edges.find(e => e.id === edgeId);
    }

    // Get all edges connected to a node
    getConnectedEdges(nodeId) {
        return this.edges.filter(e => e.from === nodeId || e.to === nodeId);
    }

    // Get all neighbors of a node
    getNeighbors(nodeId) {
        const neighbors = [];
        
        this.edges.forEach(edge => {
            if (edge.from === nodeId) {
                neighbors.push({
                    nodeId: edge.to,
                    edgeId: edge.id,
                    weight: edge.weight
                });
            } else if (edge.to === nodeId && (!edge.isDirected)) {
                neighbors.push({
                    nodeId: edge.from,
                    edgeId: edge.id,
                    weight: edge.weight
                });
            }
        });
        
        return neighbors;
    }

    // Reset all node and edge colors and labels
    resetVisualState() {
        this.nodes.forEach(node => {
            node.color = null;
            node.label = null;
        });
        
        this.edges.forEach(edge => {
            edge.color = null;
        });
    }

    // Clear the graph
    clear() {
        this.nodes = [];
        this.edges = [];
        this.nodeCounter = 1;
        this.isSaved = true;
    }

    // Export the graph to JSON
    toJSON() {
        return {
            nodes: this.nodes.map(node => ({
                id: node.id,
                x: node.x,
                y: node.y,
                name: node.name
            })),
            edges: this.edges.map(edge => ({
                id: edge.id,
                from: edge.from,
                to: edge.to,
                weight: edge.weight,
                isDirected: edge.isDirected
            }))
        };
    }

    // Import the graph from JSON
    fromJSON(json) {
        try {
            if (!json.nodes || !json.edges || !Array.isArray(json.nodes) || !Array.isArray(json.edges)) {
                throw new Error('Invalid graph format');
            }

            this.clear();

            // Add nodes
            json.nodes.forEach(nodeData => {
                const node = new Node(
                    nodeData.id,
                    nodeData.x,
                    nodeData.y,
                    nodeData.name
                );
                this.nodes.push(node);
                
                // Update node counter to be greater than any existing node number
                const match = node.name.match(/^N(\d+)$/);
                if (match) {
                    const num = parseInt(match[1]);
                    if (num >= this.nodeCounter) {
                        this.nodeCounter = num + 1;
                    }
                }
            });

            // Add edges
            json.edges.forEach(edgeData => {
                const edge = new Edge(
                    edgeData.id,
                    edgeData.from,
                    edgeData.to,
                    edgeData.weight,
                    edgeData.isDirected
                );
                this.edges.push(edge);
            });

            this.isSaved = true;
            return true;
        } catch (error) {
            console.error('Error importing graph:', error);
            return false;
        }
    }
} 