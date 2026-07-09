/**
 * Canvas handling for SVG drawing and interactions
 */
import { distance, calculateEdgeLabelPosition, calculateArrowPosition, formatNumber, showToast } from './utils.js';

export class GraphCanvas {
    constructor(svgElement, graph) {
        this.svg = svgElement;
        this.graph = graph;
        this.nodeRadius = 20;
        this.mode = 'select'; // 'select', 'addNode', 'addEdge'
        
        this.selectedElement = null;
        this.tempEdgeSource = null;
        this.tempEdgeLine = null;
        
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // Get initial dimensions from the SVG element
        const rect = svgElement.getBoundingClientRect();
        this.viewBox = { 
            x: 0, 
            y: 0, 
            width: rect.width || 1000, 
            height: rect.height || 800 
        };
        
        this.panOffset = { x: 0, y: 0 };
        this.panStart = { x: 0, y: 0 };
        this.isPanning = false;

        this.onNodeSelected = null;
        this.onEdgeSelected = null;
        this.onElementDoubleClick = null;
        this.onSelectStartNode = null;
        
        this.init();
    }
    
    init() {
        // Set initial viewBox
        this.updateViewBox();
        
        // Add event listeners for mouse/touch events
        this.svg.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.svg.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.svg.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.svg.addEventListener('pointerleave', this.handlePointerUp.bind(this));
        this.svg.addEventListener('pointercancel', this.handlePointerUp.bind(this));
        
        // Add specific double-click/tap handler
        this.svg.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        // Add touch-specific events for pinch-to-zoom
        this.svg.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.svg.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.svg.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Add wheel event for mouse zoom
        this.svg.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Prevent default touch actions to avoid conflicts with our custom handling
        this.svg.style.touchAction = 'none';
        
        // Handle window resize
        window.addEventListener('resize', () => this.updateViewBox());
        
        // Track touch points for multi-touch gestures
        this.touchPoints = [];
        this.initialPinchDistance = 0;
    }
    
    updateViewBox() {
        // Get the SVG container dimensions
        const rect = this.svg.getBoundingClientRect();
        
        // Keep the width and height of the viewBox matching the element's dimensions
        this.viewBox.width = rect.width;
        this.viewBox.height = rect.height;
        
        // Update the SVG viewBox
        this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
    }
    
    setMode(mode) {
        this.mode = mode;
        this.selectedElement = null;
        
        // Clear any temporary elements
        if (this.tempEdgeLine) {
            this.svg.removeChild(this.tempEdgeLine);
            this.tempEdgeLine = null;
        }
        
        this.tempEdgeSource = null;
        
        // Update cursor style
        this.svg.className.baseVal = 'graph-canvas';
        if (mode === 'addNode') {
            this.svg.classList.add('adding-node');
        } else if (mode === 'addEdge') {
            this.svg.classList.add('adding-edge');
        }
        
        // Redraw to update selected states
        this.render();
    }
    
    handlePointerDown(event) {
        // Get mouse position relative to SVG
        const point = this.getMousePosition(event);
        
        if (this.mode === 'select') {
            // Check if we clicked on a node
            const node = this.findNodeAt(point.x, point.y);
            if (node) {
                // Select the node
                this.selectedElement = { type: 'node', id: node.id };
                
                if (this.onNodeSelected) {
                    this.onNodeSelected(node.id);
                }
                
                // Prepare for dragging
                this.isDragging = true;
                this.dragOffset.x = point.x - node.x;
                this.dragOffset.y = point.y - node.y;
            } else {
                // Check if we clicked on an edge
                const edge = this.findEdgeAt(point.x, point.y);
                if (edge) {
                    // Select the edge
                    this.selectedElement = { type: 'edge', id: edge.id };
                    
                    if (this.onEdgeSelected) {
                        this.onEdgeSelected(edge.id);
                    }
                } else {
                    // Start panning
                    this.isPanning = true;
                    this.panStart.x = point.x;
                    this.panStart.y = point.y;
                    this.svg.classList.add('grabbing');
                    
                    // Deselect any selected element
                    this.selectedElement = null;
                    
                    if (this.onNodeSelected) {
                        this.onNodeSelected(null);
                    }
                    
                    if (this.onEdgeSelected) {
                        this.onEdgeSelected(null);
                    }
                }
            }
        } else if (this.mode === 'addNode') {
            // Add a new node at the clicked position
            const node = this.graph.addNode(point.x, point.y);
            this.render();
            showToast(`Node ${node.name} added`);
        } else if (this.mode === 'addEdge') {
            // Check if we clicked on a node
            const node = this.findNodeAt(point.x, point.y);
            if (node) {
                if (!this.tempEdgeSource) {
                    // First node selected, store it and create temporary edge line
                    this.tempEdgeSource = node;
                    
                    // Create temporary edge line
                    this.tempEdgeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    this.tempEdgeLine.setAttribute('x1', node.x);
                    this.tempEdgeLine.setAttribute('y1', node.y);
                    this.tempEdgeLine.setAttribute('x2', point.x);
                    this.tempEdgeLine.setAttribute('y2', point.y);
                    this.tempEdgeLine.setAttribute('stroke', 'var(--muted-foreground)');
                    this.tempEdgeLine.setAttribute('stroke-width', '2');
                    this.tempEdgeLine.classList.add('temp-edge');
                    
                    this.svg.appendChild(this.tempEdgeLine);
                } else if (this.tempEdgeSource.id !== node.id) {
                    // Second node selected, create the edge
                    
                    // Check if we're using Dijkstra or Bellman-Ford algorithm
                    const currentAlgorithm = document.getElementById('algorithm-select').value;
                    const shouldBeDirected = currentAlgorithm === 'dijkstra' || currentAlgorithm === 'bellmanFord';
                    
                    // Create the edge with the appropriate directed property
                    const edge = this.graph.addEdge(this.tempEdgeSource.id, node.id, 1, shouldBeDirected);
                    
                    // Clean up temporary edge
                    this.svg.removeChild(this.tempEdgeLine);
                    this.tempEdgeLine = null;
                    this.tempEdgeSource = null;
                    
                    this.render();
                    
                    if (edge) {
                        showToast(`Edge from ${this.graph.getNode(edge.from).name} to ${this.graph.getNode(edge.to).name} added`);
                    } else {
                        showToast('Edge already exists', 2000);
                    }
                }
            }
        }
        
        // Redraw to update selected states
        this.render();
    }
    
    handlePointerMove(event) {
        const point = this.getMousePosition(event);
        
        if (this.mode === 'select' && this.isDragging && this.selectedElement && this.selectedElement.type === 'node') {
            // Move the selected node
            const node = this.graph.getNode(this.selectedElement.id);
            if (node) {
                node.x = point.x - this.dragOffset.x;
                node.y = point.y - this.dragOffset.y;
                this.graph.isSaved = false;
                this.render();
            }
        } else if (this.mode === 'select' && this.isPanning) {
            // Calculate the difference from the pan start position
            const dx = point.x - this.panStart.x;
            const dy = point.y - this.panStart.y;
            
            // Update the viewBox position (move in opposite direction of pan)
            this.viewBox.x -= dx;
            this.viewBox.y -= dy;
            
            // Update the pan start position
            this.panStart = point;
            
            // Update the SVG viewBox
            this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
        } else if (this.mode === 'addEdge' && this.tempEdgeLine) {
            // Update temporary edge line
            this.tempEdgeLine.setAttribute('x2', point.x);
            this.tempEdgeLine.setAttribute('y2', point.y);
        }
    }
    
    handleDoubleClick(event) {
        // Prevent default behavior
        event.preventDefault();
        
        // Get mouse position relative to SVG
        const point = this.getMousePosition(event);
        
        // Check if we clicked on a node
        const node = this.findNodeAt(point.x, point.y);
        if (node) {
            this.selectedElement = { type: 'node', id: node.id };
            if (this.onElementDoubleClick) {
                this.onElementDoubleClick(this.selectedElement);
                event.stopPropagation(); // Stop event propagation
            }
            return;
        }
        
        // Check if we clicked on an edge
        const edge = this.findEdgeAt(point.x, point.y);
        if (edge) {
            this.selectedElement = { type: 'edge', id: edge.id };
            if (this.onElementDoubleClick) {
                this.onElementDoubleClick(this.selectedElement);
                event.stopPropagation(); // Stop event propagation
            }
            return;
        }
    }
    
    handlePointerUp(event) {
        if (this.mode === 'select') {
            // Handle selection for start node
            if (this.onSelectStartNode && this.selectedElement && this.selectedElement.type === 'node') {
                this.onSelectStartNode(this.selectedElement.id);
            }
            
            // End dragging and panning
            this.isDragging = false;
            this.isPanning = false;
            this.svg.classList.remove('grabbing');
        }
    }
    
    findNodeAt(x, y) {
        // Find a node at the given coordinates
        for (const node of this.graph.nodes) {
            if (distance(x, y, node.x, node.y) <= this.nodeRadius) {
                return node;
            }
        }
        return null;
    }
    
    findEdgeAt(x, y, threshold = 5) {
        // Find an edge near the given coordinates
        for (const edge of this.graph.edges) {
            const fromNode = this.graph.getNode(edge.from);
            const toNode = this.graph.getNode(edge.to);
            
            if (!fromNode || !toNode) continue;
            
            // Calculate distance from point to line segment
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) continue;
            
            // Calculate the closest point on the line segment
            const t = Math.max(0, Math.min(1, ((x - fromNode.x) * dx + (y - fromNode.y) * dy) / (dx * dx + dy * dy)));
            const closestX = fromNode.x + t * dx;
            const closestY = fromNode.y + t * dy;
            
            // Calculate distance from point to closest point on line segment
            const dist = distance(x, y, closestX, closestY);
            
            if (dist <= threshold) {
                return edge;
            }
        }
        return null;
    }
    
    getMousePosition(event) {
        const rect = this.svg.getBoundingClientRect();
        const scaleX = this.viewBox.width / rect.width;
        const scaleY = this.viewBox.height / rect.height;
        
        // Handle touch events
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        
        // Calculate position relative to SVG and apply viewBox offset
        return {
            x: (clientX - rect.left) * scaleX + this.viewBox.x,
            y: (clientY - rect.top) * scaleY + this.viewBox.y
        };
    }
    
    render() {
        // Clear the SVG
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }
        
        // Draw edges
        this.graph.edges.forEach(edge => this.drawEdge(edge));
        
        // Draw nodes
        this.graph.nodes.forEach(node => this.drawNode(node));
        
        // Re-add temporary edge line if it exists
        if (this.tempEdgeLine) {
            this.svg.appendChild(this.tempEdgeLine);
        }
    }
    
    drawNode(node) {
        // Create node circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node.x);
        circle.setAttribute('cy', node.y);
        circle.setAttribute('r', this.nodeRadius);
        circle.classList.add('node');
        
        // Set node color
        if (node.color) {
            circle.setAttribute('fill', `var(--${node.color}-color)`);
        } else if (this.selectedElement && this.selectedElement.type === 'node' && this.selectedElement.id === node.id) {
            circle.setAttribute('fill', 'var(--destructive-color)');
        } else {
            circle.setAttribute('fill', 'var(--primary-color)');
        }
        
        this.svg.appendChild(circle);
        
        // Create node label (name)
        const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameLabel.setAttribute('x', node.x);
        nameLabel.setAttribute('y', node.y);
        nameLabel.textContent = node.name;
        nameLabel.classList.add('node-label');
        
        this.svg.appendChild(nameLabel);
        
        // Create node distance label if present
        if (node.label !== null) {
            const distanceLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            distanceLabel.setAttribute('x', node.x);
            distanceLabel.setAttribute('y', node.y - this.nodeRadius - 5);
            distanceLabel.textContent = formatNumber(node.label);
            distanceLabel.classList.add('node-distance-label');
            
            this.svg.appendChild(distanceLabel);
        }
    }
    
    drawEdge(edge) {
        const fromNode = this.graph.getNode(edge.from);
        const toNode = this.graph.getNode(edge.to);
        
        if (!fromNode || !toNode) return;
        
        // Determine if the edge is directed
        let isDirected = edge.isDirected;
        
        // If isDirected is undefined, use algorithm-specific defaults
        if (isDirected === undefined) {
            const currentAlgorithm = document.getElementById('algorithm-select').value;
            isDirected = currentAlgorithm === 'dijkstra' || currentAlgorithm === 'bellmanFord';
            // Update the edge's isDirected property to match the algorithm requirement
            if (isDirected) {
                edge.isDirected = true;
            }
        }
        
        // Create edge line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromNode.x);
        line.setAttribute('y1', fromNode.y);
        
        // If directed, adjust the end point to be at the edge of the target node
        if (isDirected) {
            const arrowPos = calculateArrowPosition(fromNode.x, fromNode.y, toNode.x, toNode.y, this.nodeRadius);
            line.setAttribute('x2', arrowPos.x);
            line.setAttribute('y2', arrowPos.y);
        } else {
            line.setAttribute('x2', toNode.x);
            line.setAttribute('y2', toNode.y);
        }
        
        line.classList.add('edge');
        
        // Set edge color
        if (edge.color) {
            line.setAttribute('stroke', `var(--${edge.color}-color)`);
        } else if (this.selectedElement && this.selectedElement.type === 'edge' && this.selectedElement.id === edge.id) {
            line.setAttribute('stroke', 'var(--destructive-color)');
        } else {
            line.setAttribute('stroke', 'var(--muted-foreground)');
        }
        
        this.svg.appendChild(line);
        
        // If directed, add an arrow marker
        if (isDirected) {
            const arrowPos = calculateArrowPosition(fromNode.x, fromNode.y, toNode.x, toNode.y, this.nodeRadius);
            const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * 180 / Math.PI;
            
            const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            
            // Create arrow points
            const arrowSize = 10;
            const arrowPoints = [
                [arrowPos.x, arrowPos.y],
                [arrowPos.x - arrowSize, arrowPos.y - arrowSize / 2],
                [arrowPos.x - arrowSize, arrowPos.y + arrowSize / 2]
            ];
            
            // Rotate the arrow
            const rotatedPoints = arrowPoints.map(point => {
                const dx = point[0] - arrowPos.x;
                const dy = point[1] - arrowPos.y;
                const theta = angle * Math.PI / 180;
                
                return [
                    arrowPos.x + dx * Math.cos(theta) - dy * Math.sin(theta),
                    arrowPos.y + dx * Math.sin(theta) + dy * Math.cos(theta)
                ];
            });
            
            // Set the points attribute
            arrowHead.setAttribute('points', rotatedPoints.map(p => p.join(',')).join(' '));
            arrowHead.classList.add('edge-arrow');
            
            // Set arrow color
            if (edge.color) {
                arrowHead.setAttribute('fill', `var(--${edge.color}-color)`);
            } else if (this.selectedElement && this.selectedElement.type === 'edge' && this.selectedElement.id === edge.id) {
                arrowHead.setAttribute('fill', 'var(--destructive-color)');
            } else {
                arrowHead.setAttribute('fill', 'var(--muted-foreground)');
            }
            
            this.svg.appendChild(arrowHead);
        }
        
        // Create edge weight label
        const labelPos = calculateEdgeLabelPosition(fromNode.x, fromNode.y, toNode.x, toNode.y);
        
        const weightLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        weightLabel.setAttribute('x', labelPos.x);
        weightLabel.setAttribute('y', labelPos.y);
        weightLabel.textContent = edge.weight;
        weightLabel.classList.add('edge-weight');
        
        this.svg.appendChild(weightLabel);
    }

    // Handle wheel events for zooming with mouse
    handleWheel(event) {
        event.preventDefault();
        
        // Get mouse position before zoom
        const point = this.getMousePosition(event);
        
        // Determine zoom direction and factor
        const delta = event.deltaY > 0 ? 1.1 : 0.9;
        
        // Apply zoom
        this.zoom(point, delta);
    }

    // Handle touch start for multi-touch gestures
    handleTouchStart(event) {
        event.preventDefault();
        
        // Store touch points
        this.touchPoints = [];
        for (let i = 0; i < event.touches.length; i++) {
            this.touchPoints.push({
                id: event.touches[i].identifier,
                x: event.touches[i].clientX,
                y: event.touches[i].clientY
            });
        }
        
        // If we have two touch points, initialize pinch-to-zoom
        if (this.touchPoints.length === 2) {
            this.initialPinchDistance = this.getPinchDistance(
                this.touchPoints[0].x, this.touchPoints[0].y,
                this.touchPoints[1].x, this.touchPoints[1].y
            );
        }
    }

    // Handle touch move for multi-touch gestures
    handleTouchMove(event) {
        event.preventDefault();
        
        // Handle pinch-to-zoom with two fingers
        if (event.touches.length === 2 && this.touchPoints.length === 2) {
            // Calculate current distance between touch points
            const currentDistance = this.getPinchDistance(
                event.touches[0].clientX, event.touches[0].clientY,
                event.touches[1].clientX, event.touches[1].clientY
            );
            
            // Calculate zoom factor based on the change in distance
            if (this.initialPinchDistance > 0) {
                const zoomFactor = currentDistance / this.initialPinchDistance;
                
                // Only zoom if the change is significant enough
                if (Math.abs(zoomFactor - 1) > 0.01) {
                    // Calculate the midpoint between the two touches
                    const rect = this.svg.getBoundingClientRect();
                    const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
                    const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
                    
                    // Convert to SVG coordinates
                    const scaleX = this.viewBox.width / rect.width;
                    const scaleY = this.viewBox.height / rect.height;
                    const svgMidX = (midX - rect.left) * scaleX + this.viewBox.x;
                    const svgMidY = (midY - rect.top) * scaleY + this.viewBox.y;
                    
                    // Apply zoom
                    const zoomDelta = zoomFactor > 1 ? 0.95 : 1.05;
                    this.zoom({ x: svgMidX, y: svgMidY }, zoomDelta);
                    
                    // Update initial distance for next move event
                    this.initialPinchDistance = currentDistance;
                }
            }
        }
    }

    // Handle touch end for multi-touch gestures
    handleTouchEnd(event) {
        // Reset touch tracking
        if (event.touches.length < 2) {
            this.initialPinchDistance = 0;
        }
        
        // Update touch points
        this.touchPoints = [];
        for (let i = 0; i < event.touches.length; i++) {
            this.touchPoints.push({
                id: event.touches[i].identifier,
                x: event.touches[i].clientX,
                y: event.touches[i].clientY
            });
        }
    }

    // Calculate distance between two points (for pinch gesture)
    getPinchDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    // Zoom the canvas around a specific point
    zoom(point, factor) {
        // Calculate new viewBox dimensions
        const newWidth = this.viewBox.width * factor;
        const newHeight = this.viewBox.height * factor;
        
        // Calculate new viewBox position to zoom around the given point
        const dx = (point.x - this.viewBox.x) * (1 - factor);
        const dy = (point.y - this.viewBox.y) * (1 - factor);
        
        const newX = this.viewBox.x - dx;
        const newY = this.viewBox.y - dy;
        
        // Update viewBox
        this.viewBox.x = newX;
        this.viewBox.y = newY;
        this.viewBox.width = newWidth;
        this.viewBox.height = newHeight;
        
        // Apply the new viewBox
        this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
    }
} 