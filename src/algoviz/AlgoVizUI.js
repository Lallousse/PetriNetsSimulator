/**
 * UI handling for dialogs, panels, and user interactions
 */
import { formatNumber } from './utils.js';
import { createIcons, icons } from 'lucide';

export class AlgoVizUI {
    constructor() {
        // Dialogs
        this.nodeEditorDialog = document.getElementById('node-editor-dialog');
        this.edgeEditorDialog = document.getElementById('edge-editor-dialog');
        
        // Floating panel
        this.floatingPanel = document.getElementById('floating-steps-panel');
        this.stepsTable = document.getElementById('algorithm-steps-table');
        this.explanationPanel = document.getElementById('explanation-panel');
        
        // Current elements being edited
        this.currentNodeId = null;
        this.currentEdgeId = null;
        
        // Pending action for unsaved changes dialog
        this.pendingAction = null;
        
        // Start node selection mode
        this.selectingStartNode = false;
        
        // Panel states
        this.isPanelPinned = false;
        
        this.init();
    }
    
    init() {
        // Node editor dialog
        document.getElementById('save-node-btn').addEventListener('click', () => this.saveNodeEdit());
        document.getElementById('cancel-node-btn').addEventListener('click', () => this.closeNodeEditor());
        
        // Edge editor dialog
        document.getElementById('save-edge-btn').addEventListener('click', () => this.saveEdgeEdit());
        document.getElementById('cancel-edge-btn').addEventListener('click', () => this.closeEdgeEditor());
        
        // Floating panels
        document.getElementById('close-panel-btn').addEventListener('click', () => this.toggleStepsPanel(false));
        document.getElementById('pin-explanation-btn').addEventListener('click', () => this.togglePinExplanationPanel());
        
        // Make the floating panels draggable
        this.makeDraggable(this.floatingPanel, document.querySelector('#floating-steps-panel .panel-header'));
        this.makeDraggable(this.explanationPanel, document.querySelector('#explanation-panel .panel-header'));
    }
    
    // Make an element draggable
    makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const ui = this; // Store reference to UI instance
        
        if (handle) {
            // If a handle is provided, make only the handle trigger dragging
            handle.addEventListener('pointerdown', dragMouseDown);
        } else {
            // Otherwise, make the whole element draggable
            element.addEventListener('pointerdown', dragMouseDown);
        }
        
        function dragMouseDown(e) {
            e.preventDefault();
            
            // Don't allow dragging if the panel is pinned and it's the explanation panel
            if (element === ui.explanationPanel && ui.isPanelPinned) {
                return;
            }
            
            // Ensure we're not clicking on a button or interactive element
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            
            // Get the mouse/touch cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // Set capture to ensure we get all events even if pointer moves outside element
            e.target.setPointerCapture(e.pointerId);
            
            // Add event listeners for move and end events
            document.addEventListener('pointermove', elementDrag);
            document.addEventListener('pointerup', closeDragElement);
            document.addEventListener('pointercancel', closeDragElement);
            
            // Add a class to indicate dragging
            element.classList.add('dragging');
            
            // Convert right-anchored to left-anchored to allow left positioning
            element.style.left = element.offsetLeft + 'px';
            element.style.top = element.offsetTop + 'px';
            element.style.right = 'auto';
        }
        
        function elementDrag(e) {
            e.preventDefault();
            
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // Calculate new position
            let newTop = element.offsetTop - pos2;
            let newLeft = element.offsetLeft - pos1;
            
            // Keep the panel within the viewport bounds
            const rect = element.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Ensure at least 50px of the panel is always visible
            newTop = Math.max(-rect.height + 50, Math.min(newTop, viewportHeight - 50));
            newLeft = Math.max(-rect.width + 50, Math.min(newLeft, viewportWidth - 50));
            
            // Set the element's new position
            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";
        }
        
        function closeDragElement(e) {
            // Release pointer capture
            if (e && e.pointerId) {
                const captureElement = e.target.hasPointerCapture(e.pointerId) ? 
                    e.target : document.elementFromPoint(e.clientX, e.clientY);
                if (captureElement && captureElement.hasPointerCapture(e.pointerId)) {
                    captureElement.releasePointerCapture(e.pointerId);
                }
            }
            
            // Stop moving when pointer button is released
            document.removeEventListener('pointermove', elementDrag);
            document.removeEventListener('pointerup', closeDragElement);
            document.removeEventListener('pointercancel', closeDragElement);
            
            // Remove dragging class
            element.classList.remove('dragging');
        }
    }
    
    // Show the node editor dialog
    showNodeEditor(nodeId, graph) {
        this.currentNodeId = nodeId;
        const node = graph.getNode(nodeId);
        
        if (!node) return;
        
        document.getElementById('node-name-input').value = node.name;
        this.nodeEditorDialog.classList.remove('hidden');
        document.getElementById('node-name-input').focus();
    }
    
    // Close the node editor dialog
    closeNodeEditor() {
        this.nodeEditorDialog.classList.add('hidden');
        this.currentNodeId = null;
    }
    
    // Save the node edit
    saveNodeEdit() {
        if (!this.currentNodeId) return;
        
        const name = document.getElementById('node-name-input').value.trim();
        
        if (name) {
            // Call the callback with the updated values
            if (this.onNodeEdit) {
                this.onNodeEdit(this.currentNodeId, { name });
            }
        }
        
        this.closeNodeEditor();
    }
    
    // Show the edge editor dialog
    showEdgeEditor(edgeId, graph) {
        this.currentEdgeId = edgeId;
        const edge = graph.getEdge(edgeId);
        
        if (!edge) return;
        
        document.getElementById('edge-weight-input').value = edge.weight;
        
        // Check if we're using Dijkstra or Bellman-Ford algorithm
        const currentAlgorithm = document.getElementById('algorithm-select').value;
        const shouldBeDirected = currentAlgorithm === 'dijkstra' || currentAlgorithm === 'bellmanFord';
        
        // Set the checkbox state based on algorithm or existing edge property
        document.getElementById('edge-directed-input').checked = shouldBeDirected || edge.isDirected === true;
        
        this.edgeEditorDialog.classList.remove('hidden');
        document.getElementById('edge-weight-input').focus();
    }
    
    // Close the edge editor dialog
    closeEdgeEditor() {
        this.edgeEditorDialog.classList.add('hidden');
        this.currentEdgeId = null;
    }
    
    // Save the edge edit
    saveEdgeEdit() {
        if (!this.currentEdgeId) return;
        
        const weight = parseInt(document.getElementById('edge-weight-input').value);
        const isDirected = document.getElementById('edge-directed-input').checked;
        
        if (!isNaN(weight)) {
            // Call the callback with the updated values
            if (this.onEdgeEdit) {
                this.onEdgeEdit(this.currentEdgeId, { weight, isDirected });
            }
        }
        
        this.closeEdgeEditor();
    }
    
    // Update the graph info display
    
    // Update the graph info display
    updateGraphInfo(graph, startNodeId = null) {
        document.getElementById('node-count').textContent = graph.nodes.length;
        document.getElementById('edge-count').textContent = graph.edges.length;
        
        const startNodeContainer = document.getElementById('start-node-container');
        const startNodeElement = document.getElementById('start-node');
        
        if (startNodeId) {
            const startNode = graph.getNode(startNodeId);
            startNodeElement.textContent = startNode ? startNode.name : 'None';
            startNodeContainer.classList.remove('hidden');
        } else {
            startNodeContainer.classList.add('hidden');
        }
    }
    
    // Update the explanation text
    updateExplanation(text) {
        const explanationText = document.getElementById('explanation-text');
        explanationText.textContent = text;
        
        // Ensure the explanation panel is visible
        const explanationPanel = document.getElementById('explanation-panel');
        if (explanationPanel.classList.contains('hidden')) {
            explanationPanel.classList.remove('hidden');
        }
    }
    
    // Toggle the steps panel visibility
    toggleStepsPanel(show = true) {
        if (show) {
            this.floatingPanel.classList.remove('hidden');
        } else {
            this.floatingPanel.classList.add('hidden');
        }
    }
    
    // Update the algorithm steps table
    updateStepsTable(headers, rows) {
        // Clear the table
        this.stepsTable.innerHTML = '';
        
        if (!headers || !rows) return;
        
        // Create table
        const table = document.createElement('table');
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body rows
        const tbody = document.createElement('tbody');
        
        rows.forEach(row => {
            const tr = document.createElement('tr');
            
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = formatNumber(cell);
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        this.stepsTable.appendChild(table);
    }
    
    // Enable or disable a button
    setButtonEnabled(buttonId, enabled) {
        const button = document.getElementById(buttonId);
        
        if (enabled) {
            button.classList.remove('disabled');
        } else {
            button.classList.add('disabled');
        }
    }
    
    // Set button active state
    setButtonActive(buttonId, active) {
        const button = document.getElementById(buttonId);
        
        if (active) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }
    
    // Utility to update button text/icon (modified for pure icon UI)
    updateToolButton(buttonId, iconName, tooltipText) {
        const button = document.getElementById(buttonId);
        if (button) {
            button.setAttribute('data-tooltip', tooltipText);
            button.innerHTML = `<i data-lucide="${iconName}"></i>`;
            createIcons({
                icons,
                nameAttr: 'data-lucide'
            });
        }
    }
    
    // Enter start node selection mode
    enterStartNodeSelectionMode() {
        this.selectingStartNode = true;
        this.updateToolButton('select-start-node-btn', 'mouse-pointer-2', 'Selecting... Click a Node');
        this.updateExplanation('Click on a node to select it as the start node.');
    }
    
    // Exit start node selection mode
    exitStartNodeSelectionMode() {
        this.selectingStartNode = false;
        this.updateToolButton('select-start-node-btn', 'crosshair', 'Select Start Node');
    }
    
    // Check if in start node selection mode
    isSelectingStartNode() {
        return this.selectingStartNode;
    }
    
    // Toggle pin state for the explanation panel
    togglePinExplanationPanel() {
        const pinButton = document.getElementById('pin-explanation-btn');
        this.isPanelPinned = !this.isPanelPinned;
        
        if (this.isPanelPinned) {
            this.explanationPanel.classList.add('pinned');
            pinButton.classList.add('pinned');
            pinButton.title = 'Unpin Panel';
        } else {
            this.explanationPanel.classList.remove('pinned');
            pinButton.classList.remove('pinned');
            pinButton.title = 'Pin Panel';
        }
    }
} 