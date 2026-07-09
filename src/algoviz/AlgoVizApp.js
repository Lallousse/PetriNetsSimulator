/**
 * Main application file for AlgoViz
 */
import { Graph } from './Graph.js';
import { GraphCanvas } from './GraphCanvas.js';
import { AlgoVizUI } from './AlgoVizUI.js';
import { generatePrimSteps } from './algorithms/prim.js';
import { generateKruskalSteps } from './algorithms/kruskal.js';
import { generateDijkstraSteps } from './algorithms/dijkstra.js';
import { generateBellmanFordSteps } from './algorithms/bellmanFord.js';
import { formatTableToText, saveToFile, loadFile, showToast } from './utils.js';

export function initAlgoViz(appContext) {
    const graph = new Graph();
    
    // Get the SVG element
    const svgElement = document.getElementById('graph-canvas');
    
    // Initialize the canvas
    const canvas = new GraphCanvas(svgElement, graph);
    
    // Initialize UI
    const ui = new AlgoVizUI();
    
    // Visualization state
    let currentAlgorithm = null;
    let visualizationSteps = [];
    let currentStepIndex = -1;
    let isPlaying = false;
    let isPaused = false;
    let playbackInterval = null;
    let startNodeId = null;
    let currentTableData = null;
    
    // Set up UI callbacks
    ui.onNodeEdit = (nodeId, updates) => {
        graph.updateNode(nodeId, updates);
        
        // If we're in the middle of a visualization, preserve the edited node's name
        // but keep the visual state from the algorithm
        if (isPlaying && currentStepIndex >= 0 && currentStepIndex < visualizationSteps.length) {
            const step = visualizationSteps[currentStepIndex];
            if (step.nodesSnapshot) {
                const nodeInSnapshot = step.nodesSnapshot.find(n => n.id === nodeId);
                if (nodeInSnapshot) {
                    // Preserve the name but keep the visual properties
                    nodeInSnapshot.name = updates.name || nodeInSnapshot.name;
                }
            }
        }
        
        canvas.render();
        updateGraphInfo();
    };
    
    ui.onEdgeEdit = (edgeId, updates) => {
        graph.updateEdge(edgeId, updates);
        
        // If we're in the middle of a visualization, preserve the edited edge's weight
        // but keep the visual state from the algorithm
        if (isPlaying && currentStepIndex >= 0 && currentStepIndex < visualizationSteps.length) {
            const step = visualizationSteps[currentStepIndex];
            if (step.edgesSnapshot) {
                const edgeInSnapshot = step.edgesSnapshot.find(e => e.id === edgeId);
                if (edgeInSnapshot) {
                    // Preserve the weight and direction but keep the visual properties
                    edgeInSnapshot.weight = updates.weight !== undefined ? updates.weight : edgeInSnapshot.weight;
                    edgeInSnapshot.isDirected = updates.isDirected !== undefined ? updates.isDirected : edgeInSnapshot.isDirected;
                }
            }
        }
        
        canvas.render();
        updateGraphInfo();
    };
    
    // Set up canvas callbacks
    canvas.onNodeSelected = (nodeId) => {
        if (ui.isSelectingStartNode() && nodeId) {
            setStartNode(nodeId);
            ui.exitStartNodeSelectionMode();
            return;
        }
        
        updateDeleteButtonState();
    };
    
    canvas.onEdgeSelected = (edgeId) => {
        updateDeleteButtonState();
    };
    
    canvas.onElementDoubleClick = (element) => {
        if (isPlaying || currentStepIndex >= 0) {
            showToast('Editing is disabled during simulation. Please reset the graph first.', 3000);
            return;
        }
        
        if (element.type === 'node') {
            ui.showNodeEditor(element.id, graph);
        } else if (element.type === 'edge') {
            ui.showEdgeEditor(element.id, graph);
        }
    };
    
    canvas.onSelectStartNode = (nodeId) => {
        if (ui.isSelectingStartNode() && nodeId) {
            setStartNode(nodeId);
            ui.exitStartNodeSelectionMode();
        }
    };
    
    // Button click handlers
    
    document.getElementById('select-move-btn').addEventListener('click', () => setDrawingMode('select'));
    document.getElementById('add-node-btn').addEventListener('click', () => setDrawingMode('addNode'));
    document.getElementById('add-edge-btn').addEventListener('click', () => setDrawingMode('addEdge'));
    document.getElementById('flip-edge-btn').addEventListener('click', flipSelectedEdge);
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelected);
    
    document.getElementById('select-start-node-btn').addEventListener('click', () => {
        if (!ui.isSelectingStartNode()) {
            ui.enterStartNodeSelectionMode();
            setDrawingMode('select');
        }
    });
    
    document.getElementById('start-btn').addEventListener('click', startVisualization);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('next-btn').addEventListener('click', nextStep);
    document.getElementById('reset-btn').addEventListener('click', resetGraph);
    document.getElementById('toggle-steps-panel-btn').addEventListener('click', toggleStepsPanel);
    
    document.getElementById('algorithm-select').addEventListener('change', () => {
        updateStartNodeVisibility();
        updateEdgeDirections();
        resetVisualization();
    });
    
    // Function to update the graph info display
    function updateGraphInfo() {
        ui.updateGraphInfo(graph, startNodeId);
    }
    
    // Function to update the delete button state
    function updateDeleteButtonState() {
        const hasSelection = canvas.selectedElement !== null;
        ui.setButtonEnabled('delete-selected-btn', hasSelection);
        
        // Enable flip edge button only if a directed edge is selected
        let canFlipEdge = false;
        if (canvas.selectedElement && canvas.selectedElement.type === 'edge') {
            const edge = graph.getEdge(canvas.selectedElement.id);
            // Check if the edge exists and is directed (explicitly true)
            canFlipEdge = edge && (edge.isDirected === true);
        }
        ui.setButtonEnabled('flip-edge-btn', canFlipEdge);
    }
    
    // Function to set the drawing mode
    function setDrawingMode(mode) {
        canvas.setMode(mode);
        
        // Update button active states
        ui.setButtonActive('select-move-btn', mode === 'select');
        ui.setButtonActive('add-node-btn', mode === 'addNode');
        ui.setButtonActive('add-edge-btn', mode === 'addEdge');
        
        // Update explanation text
        if (mode === 'select') {
            ui.updateExplanation('Select Mode: Click on nodes or edges to select them. Double-click to edit. Drag nodes to move them. Drag the canvas to pan.');
        } else if (mode === 'addNode') {
            ui.updateExplanation('Add Node Mode: Click anywhere on the canvas to add a new node.');
        } else if (mode === 'addEdge') {
            ui.updateExplanation('Add Edge Mode: Click on a source node, then click on a target node to create an edge between them.');
        }
    }
    
    // Function to set the start node
    function setStartNode(nodeId) {
        startNodeId = nodeId;
        updateGraphInfo();
        
        const node = graph.getNode(nodeId);
        if (node) {
            showToast(`Selected ${node.name} as the start node`);
            ui.updateExplanation(`Start node set to ${node.name}.`);
        }
        
        // Enable the start button if an algorithm is selected
        updateStartButtonState();
    }
    
    // Function to update the start button state
    function updateStartButtonState() {
        const algorithmValue = document.getElementById('algorithm-select').value;
        const needsStartNode = algorithmValue === 'prim' || algorithmValue === 'dijkstra' || algorithmValue === 'bellmanFord';
        
        ui.setButtonEnabled('start-btn', !needsStartNode || (needsStartNode && startNodeId !== null));
    }
    
    // Function to update start node visibility based on selected algorithm
    function updateStartNodeVisibility() {
        const algorithmValue = document.getElementById('algorithm-select').value;
        const needsStartNode = algorithmValue === 'prim' || algorithmValue === 'dijkstra' || algorithmValue === 'bellmanFord';
        
        ui.setButtonEnabled('select-start-node-btn', needsStartNode);
        
        if (needsStartNode) {
            document.getElementById('start-node-container').classList.remove('hidden');
        } else {
            document.getElementById('start-node-container').classList.add('hidden');
        }
        
        updateStartButtonState();
    }
    
    // Function to create a new design
    function newDesign() {
        graph.clear();
        canvas.render();
        resetVisualization();
        updateGraphInfo();
        ui.updateExplanation('New design created. Select a drawing tool to start creating your graph.');
        showToast('New design created');
    }
    
    // Function to save the current design
    function saveDesign() {
        // Save the graph structure
        const graphData = graph.toJSON();
        saveToFile(JSON.stringify(graphData, null, 2), 'graph-design.json');
        
        // If we have algorithm steps, save them too
        if (currentTableData && currentTableData.headers && currentTableData.rows) {
            const algorithmName = document.getElementById('algorithm-select').value;
            const title = `Algorithm Steps: ${algorithmName.charAt(0).toUpperCase() + algorithmName.slice(1)}`;
            const formattedTable = formatTableToText(title, currentTableData.headers, currentTableData.rows);
            saveToFile(formattedTable, `algorithm-steps-${algorithmName}.txt`, 'text/plain');
        }
        
        graph.isSaved = true;
        showToast('Design saved');
    }
    
    // Function to load a design
    async function loadDesign(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const content = await loadFile(file);
            const graphData = JSON.parse(content);
            
            if (graph.fromJSON(graphData)) {
                canvas.render();
                resetVisualization();
                updateGraphInfo();
                ui.updateExplanation('Design loaded. You can now visualize algorithms on this graph.');
                showToast('Design loaded successfully');
            } else {
                showToast('Error loading design: Invalid format', 5000);
            }
        } catch (error) {
            console.error('Error loading design:', error);
            showToast('Error loading design', 5000);
        }
        
        // Reset the file input
        event.target.value = '';
    }
    
    // Function to delete the selected element
    function deleteSelected() {
        if (!canvas.selectedElement) return;
        
        if (canvas.selectedElement.type === 'node') {
            const nodeId = canvas.selectedElement.id;
            const node = graph.getNode(nodeId);
            
            if (node) {
                graph.deleteNode(nodeId);
                
                // If this was the start node, clear it
                if (startNodeId === nodeId) {
                    startNodeId = null;
                    updateGraphInfo();
                    updateStartButtonState();
                }
                
                showToast(`Node ${node.name} deleted`);
            }
        } else if (canvas.selectedElement.type === 'edge') {
            const edgeId = canvas.selectedElement.id;
            const edge = graph.getEdge(edgeId);
            
            if (edge) {
                const fromNode = graph.getNode(edge.from);
                const toNode = graph.getNode(edge.to);
                
                graph.deleteEdge(edgeId);
                
                if (fromNode && toNode) {
                    showToast(`Edge from ${fromNode.name} to ${toNode.name} deleted`);
                }
            }
        }
        
        canvas.selectedElement = null;
        canvas.render();
        updateGraphInfo();
        updateDeleteButtonState();
    }
    
    // Function to start the visualization
    function startVisualization() {
        const algorithmValue = document.getElementById('algorithm-select').value;
        
        // Reset any previous visualization
        resetVisualization();
        
        // Generate steps based on the selected algorithm
        let result;
        
        switch (algorithmValue) {
            case 'prim':
                result = generatePrimSteps(graph, startNodeId);
                break;
            case 'kruskal':
                result = generateKruskalSteps(graph);
                break;
            case 'dijkstra':
                result = generateDijkstraSteps(graph, startNodeId);
                break;
            case 'bellmanFord':
                result = generateBellmanFordSteps(graph, startNodeId);
                break;
            default:
                showToast('Please select an algorithm', 3000);
                return;
        }
        
        if (result.error) {
            ui.updateExplanation(`Error: ${result.error}`);
            showToast(`Error: ${result.error}`, 5000);
            return;
        }
        
        visualizationSteps = result.steps;
        currentAlgorithm = algorithmValue;
        
        if (visualizationSteps.length === 0) {
            ui.updateExplanation('No steps generated. The graph might be empty or invalid for this algorithm.');
            return;
        }
        
        // Start playing
        isPlaying = true;
        isPaused = false;
        currentStepIndex = -1;
        
        // Update UI
        ui.setButtonEnabled('pause-btn', true);
        ui.setButtonEnabled('next-btn', true);
        ui.setButtonEnabled('start-btn', false);
        ui.setButtonEnabled('toggle-steps-panel-btn', true);
        
        // Show the steps panel automatically
        ui.toggleStepsPanel(true);
        ui.updateToolButton('toggle-steps-panel-btn', 'eye-off', 'Hide Steps Panel');
        
        // Start the playback
        nextStep();
        startPlayback();
    }
    
    // Function to toggle pause/resume
    function togglePause() {
        if (!isPlaying) return;
        
        isPaused = !isPaused;
        
        if (isPaused) {
            ui.updateToolButton('pause-btn', 'play', 'Resume');
            stopPlayback();
        } else {
            ui.updateToolButton('pause-btn', 'pause', 'Pause');
            startPlayback();
        }
    }
    
    // Function to start automatic playback
    function startPlayback() {
        if (playbackInterval) clearInterval(playbackInterval);
        
        playbackInterval = setInterval(() => {
            if (currentStepIndex >= visualizationSteps.length - 1) {
                stopPlayback();
                return;
            }
            nextStep();
        }, 2000);
    }
    
    // Function to stop automatic playback
    function stopPlayback() {
        if (playbackInterval) {
            clearInterval(playbackInterval);
            playbackInterval = null;
        }
    }
    
    // Function to go to the next step
    function nextStep() {
        if (visualizationSteps.length === 0) return;
        
        // If we're at the end, loop back to the beginning
        if (currentStepIndex >= visualizationSteps.length - 1) {
            resetVisualization(false);
            return;
        }
        
        // Make sure the steps panel is visible when stepping through the algorithm
        const panel = document.getElementById('floating-steps-panel');
        if (panel.classList.contains('hidden')) {
            ui.toggleStepsPanel(true);
            ui.updateToolButton('toggle-steps-panel-btn', 'eye-off', 'Hide Steps Panel');
        }
        
        currentStepIndex++;
        applyStep(currentStepIndex);
        
        // Check if finished
        if (currentStepIndex >= visualizationSteps.length - 1) {
            isPlaying = false;
            stopPlayback();
            ui.setButtonEnabled('pause-btn', false);
            ui.updateToolButton('next-btn', 'rotate-ccw', 'Restart');
        }
    }
    
    // Function to apply a specific step
    function applyStep(index) {
        if (index < 0 || index >= visualizationSteps.length) return;
        
        const step = visualizationSteps[index];
        
        // Update the explanation text
        if (step.text) {
            ui.updateExplanation(step.text);
        }
        
        // Apply node and edge snapshots
        if (step.nodesSnapshot) {
            graph.nodes = step.nodesSnapshot;
        }
        
        if (step.edgesSnapshot) {
            graph.edges = step.edgesSnapshot;
        }
        
        // Update the canvas
        canvas.render();
        
        // Update the table data if available
        if (step.tableData) {
            currentTableData = step.tableData;
            ui.updateStepsTable(step.tableData.headers, step.tableData.rows);
        }
    }
    
    // Function to reset the visualization
    function resetVisualization(resetAlgorithm = true) {
        // Stop any ongoing playback
        stopPlayback();
        
        // Reset state
        isPlaying = false;
        isPaused = false;
        currentStepIndex = -1;
        visualizationSteps = [];
        
        if (resetAlgorithm) {
            currentAlgorithm = null;
            currentTableData = null;
            
            // Hide the steps panel and update button
            ui.toggleStepsPanel(false);
            ui.updateToolButton('toggle-steps-panel-btn', 'list', 'Show Steps Panel');
        }
        
        // Reset the graph visual state
        graph.resetVisualState();
        canvas.render();
        
        // Update UI
        ui.setButtonEnabled('pause-btn', false);
        ui.setButtonEnabled('next-btn', resetAlgorithm ? false : true);
        ui.setButtonEnabled('start-btn', true);
        ui.setButtonEnabled('toggle-steps-panel-btn', !resetAlgorithm && currentTableData !== null);
        ui.updateToolButton('pause-btn', 'pause', 'Pause');
        ui.updateToolButton('next-btn', 'skip-forward', 'Next Step');
        
        // Update explanation
        if (resetAlgorithm) {
            ui.updateExplanation('Visualization reset. Select an algorithm and click Start to begin visualization.');
        }
    }
    
    // Function to reset the graph
    function resetGraph() {
        if (!graph.isSaved) {
            ui.showUnsavedChangesDialog(() => {
                graph.clear();
                canvas.render();
                resetVisualization();
                startNodeId = null;
                updateGraphInfo();
                ui.updateExplanation('Graph reset. Select a drawing tool to start creating your graph.');
                showToast('Graph reset');
            });
        } else {
            graph.clear();
            canvas.render();
            resetVisualization();
            startNodeId = null;
            updateGraphInfo();
            ui.updateExplanation('Graph reset. Select a drawing tool to start creating your graph.');
            showToast('Graph reset');
        }
    }
    
    // Function to toggle the steps panel
    function toggleStepsPanel() {
        const panel = document.getElementById('floating-steps-panel');
        const isVisible = !panel.classList.contains('hidden');
        
        ui.toggleStepsPanel(!isVisible);
        
        if (isVisible) {
            ui.updateToolButton('toggle-steps-panel-btn', 'eye-off', 'Hide Steps Panel');
        } else {
            ui.updateToolButton('toggle-steps-panel-btn', 'list', 'Show Steps Panel');
        }
    }
    
    // Function to update edge directions based on selected algorithm
    function updateEdgeDirections() {
        const algorithmValue = document.getElementById('algorithm-select').value;
        const shouldBeDirected = algorithmValue === 'dijkstra' || algorithmValue === 'bellmanFord';
        
        if (shouldBeDirected) {
            // Update all edges to be directed when switching to Dijkstra or Bellman-Ford
            graph.edges.forEach(edge => {
                if (edge.isDirected === undefined || edge.isDirected === false) {
                    edge.isDirected = true;
                    graph.isSaved = false;
                }
            });
            canvas.render();
        }
    }
    
    // Function to flip the direction of the selected edge
    function flipSelectedEdge() {
        if (canvas.selectedElement && canvas.selectedElement.type === 'edge') {
            const edge = graph.getEdge(canvas.selectedElement.id);
            if (edge && edge.isDirected === true) {
                // Check if the flipped edge would duplicate an existing edge
                const existingEdge = graph.edges.find(e => e.id !== edge.id && e.from === edge.to && e.to === edge.from);
                if (existingEdge) {
                    showToast('An edge in that direction already exists', 3000);
                    return;
                }
                
                // Swap from and to nodes
                const temp = edge.from;
                edge.from = edge.to;
                edge.to = temp;
                graph.isSaved = false;
                canvas.render();
                showToast('Edge direction flipped');
            }
        }
    }
    
    // Initialize the application
    function init() {
        // Set initial drawing mode
        setDrawingMode('select');
        
        // Update UI based on the selected algorithm
        updateStartNodeVisibility();
        
        // Initial graph info update
        updateGraphInfo();
        
        // Welcome message
        ui.updateExplanation('Welcome to AlgoViz! Select a drawing tool to create your graph, then choose an algorithm to visualize.');
    }
    
    // Start the application
    init();

    // Expose API for the main application to interact with
    return {
        getState: () => {
            return graph.toJSON();
        },
        setState: (data) => {
            if (graph.fromJSON(data)) {
                canvas.render();
                resetVisualization();
                updateGraphInfo();
                ui.updateExplanation('Design loaded successfully.');
                return true;
            }
            return false;
        },
        clear: () => {
            newDesign();
        },
        hasUnsavedChanges: () => {
            return !graph.isSaved;
        },
        markSaved: () => {
            graph.isSaved = true;
        }
    };
}