import { Place, Transition, Arc, Initializer, Annotation, Point } from '../models/elements.js';

export class InputHandler {
    constructor(canvasEl, app) {
        this.canvasEl = canvasEl;
        this.app = app;
        
        // Mouse state
        this.isDragging = false;
        this.isPanning = false;
        this.lastX = 0;
        this.lastY = 0;
        this.panX = 0;
        this.panY = 0;
        
        this.setupEventListeners();
    }

    applyZoomRelative(actualFactor, clientX, clientY) {
        const rect = this.canvasEl.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        
        const oldZoom = this.app.zoomLevel / actualFactor;
        const newZoom = this.app.zoomLevel;
        
        this.panX += (mouseX / newZoom) - (mouseX / oldZoom);
        this.panY += (mouseY / newZoom) - (mouseY / oldZoom);
    }

    getMousePos(e) {
        const rect = this.canvasEl.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / this.app.zoomLevel - this.panX,
            y: (e.clientY - rect.top) / this.app.zoomLevel - this.panY
        };
    }

    setupEventListeners() {
        this.canvasEl.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvasEl.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvasEl.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvasEl.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvasEl.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onMouseDown(e) {
        if (e.button === 1) {
            this.rawStartX = e.clientX;
            this.rawStartY = e.clientY;
            this.isPanning = true;
            this.canvasEl.style.cursor = 'grabbing';
            return;
        }
        
        if (e.button !== 0) return; // Only left click
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.rawStartX = e.clientX;
        this.rawStartY = e.clientY;

        if (this.app.handMode || this.isSpacePan) {
            this.isPanning = true;
            this.canvasEl.style.cursor = 'grabbing';
            return;
        }

        const clickedElement = this.app.getElementAt(pos.x, pos.y) || 
                             this.app.getAnnotationAt(pos.x, pos.y) || 
                             this.app.getArcAt(pos.x, pos.y);

        if (this.app.addMode === 'select') {
            if (clickedElement) {
                if (!e.shiftKey) {
                    this.app.selectedElements = [clickedElement];
                    this.app.selected = clickedElement;
                } else {
                    if (!this.app.selectedElements.includes(clickedElement)) {
                        this.app.selectedElements.push(clickedElement);
                    }
                }
                
                if (this.app.selectedElements.length === 1 && !(clickedElement instanceof Arc)) {
                    this.isDragging = true;
                }
                
                if (this.app.selectedElements.length === 1) {
                    this.app.propertiesPanel.show(clickedElement, this.app.isSmartModel);
                } else {
                    this.app.propertiesPanel.hide();
                }
                
            } else {
                this.app.selectedElements = [];
                this.app.selected = null;
                this.app.selectionStart = new Point(pos.x, pos.y);
                this.app.selectionArea = { x: pos.x, y: pos.y, width: 0, height: 0 };
                this.app.propertiesPanel.hide();
            }
        } else if (this.app.addMode === 'arc') {
            if (clickedElement && !(clickedElement instanceof Arc) && !(clickedElement instanceof Annotation)) {
                this.app.drawingArc = true;
                this.app.arcStart = new Point(clickedElement.x, clickedElement.y);
                this.app.arcEnd = new Point(pos.x, pos.y);
                this.app.arcSource = clickedElement;
            }
        } else if (this.app.addMode === 'place') {
            this.app.undoManager.saveState();
            let pX = pos.x; let pY = pos.y;
            if (this.app.snapToGrid) { pX = Math.round(pX/20)*20; pY = Math.round(pY/20)*20; }
            this.app.places.push(new Place(`P${this.app.places.length + 1}`, pX, pY));
            this.app.designState.setUnsavedChanges();
            this.app.updateUI();
        } else if (this.app.addMode === 'transition') {
            this.app.undoManager.saveState();
            let tX = pos.x; let tY = pos.y;
            if (this.app.snapToGrid) { tX = Math.round(tX/20)*20; tY = Math.round(tY/20)*20; }
            this.app.transitions.push(new Transition(`T${this.app.transitions.length + 1}`, tX, tY));
            this.app.designState.setUnsavedChanges();
            this.app.updateUI();
        } else if (this.app.addMode === 'initializer') {
            this.app.undoManager.saveState();
            let iX = pos.x; let iY = pos.y;
            if (this.app.snapToGrid) { iX = Math.round(iX/20)*20; iY = Math.round(iY/20)*20; }
            this.app.initializers.push(new Initializer(`I${this.app.initializers.length + 1}`, iX, iY));
            this.app.designState.setUnsavedChanges();
            this.app.updateUI();
        } else if (this.app.addMode === 'annotation') {
            this.app.undoManager.saveState();
            this.app.annotations.push(new Annotation("New Note", pos.x, pos.y, "Inter", 14, "#e2e8f0"));
            this.app.designState.setUnsavedChanges();
            this.app.updateUI();
        } else if (this.app.addMode === 'plus') {
            if (clickedElement instanceof Place) {
                this.app.undoManager.saveState();
                clickedElement.addToken();
                this.app.designState.setUnsavedChanges();
            }
        } else if (this.app.addMode === 'minus') {
            if (clickedElement instanceof Place) {
                this.app.undoManager.saveState();
                clickedElement.removeToken();
                this.app.designState.setUnsavedChanges();
            }
        } else if (this.app.addMode === 'zoomIn' || this.app.addMode === 'zoomOut') {
            this.app.selectionStart = new Point(pos.x, pos.y);
            this.app.selectionArea = { x: pos.x, y: pos.y, width: 0, height: 0, mode: this.app.addMode };
        }
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.isPanning) {
            const dx = (e.clientX - this.rawStartX) / this.app.zoomLevel;
            const dy = (e.clientY - this.rawStartY) / this.app.zoomLevel;
            this.panX += dx;
            this.panY += dy;
            this.rawStartX = e.clientX;
            this.rawStartY = e.clientY;
            return;
        }

        if (this.isDragging && this.app.selectedElements.length > 0) {
            const dx = pos.x - this.lastX;
            const dy = pos.y - this.lastY;
            this.app.selectedElements.forEach(el => {
                if (!(el instanceof Arc)) {
                    el.x += dx;
                    el.y += dy;
                    if (this.app.snapToGrid) {
                        el.x = Math.round(el.x / 20) * 20;
                        el.y = Math.round(el.y / 20) * 20;
                    }
                }
            });
            this.lastX = pos.x;
            this.lastY = pos.y;
            this.app.designState.setUnsavedChanges();
        } else if (this.app.drawingArc) {
            this.app.arcEnd = new Point(pos.x, pos.y);
        } else if (this.app.selectionArea) {
            this.app.selectionArea.width = pos.x - this.app.selectionStart.x;
            this.app.selectionArea.height = pos.y - this.app.selectionStart.y;
            
            if (this.app.addMode === 'select') {
                const rect = {
                    x: Math.min(this.app.selectionStart.x, pos.x),
                    y: Math.min(this.app.selectionStart.y, pos.y),
                    width: Math.abs(this.app.selectionArea.width),
                    height: Math.abs(this.app.selectionArea.height)
                };
                this.app.selectWithinArea(rect);
            }
        }
    }

    onMouseUp(e) {
        const pos = this.getMousePos(e);
        
        if (this.isPanning) {
            this.isPanning = false;
            if (this.isSpacePan || e.button === 1 || !this.app.handMode) {
                this.app.setMode(this.app.addMode);
            } else {
                this.canvasEl.style.cursor = 'grab';
            }
            if (e.button === 1) return;
        }
        
        this.isDragging = false;
        
        if (this.app.drawingArc) {
            const endElement = this.app.getElementAt(pos.x, pos.y);
            if (endElement && endElement !== this.app.arcSource) {
                // Validate Arc connection
                const start = this.app.arcSource;
                const end = endElement;
                let isValid = false;
                let isInput = false;

                if (start instanceof Place && end instanceof Transition) {
                    isValid = true; isInput = true;
                } else if (start instanceof Transition && end instanceof Place) {
                    isValid = true; isInput = false;
                } else if (start instanceof Initializer && end instanceof Place) {
                    isValid = true; isInput = false;
                }

                if (isValid) {
                    // Check duplicate
                    const exists = this.app.arcs.some(a => a.start === start && a.end === end);
                    if (!exists) {
                        this.app.undoManager.saveState();
                        const arc = new Arc(start, end, isInput);
                        this.app.arcs.push(arc);
                        
                        if (isInput && end instanceof Transition) {
                            end.inputArcs.push({ place: start, weight: 1 });
                        } else if (!isInput && start instanceof Transition) {
                            start.outputArcs.push({ place: end, weight: 1 });
                        } else if (start instanceof Initializer) {
                            start.outputPlace = end;
                        }
                        this.app.designState.setUnsavedChanges();
                        this.app.updateUI();
                    }
                }
            }
            this.app.drawingArc = false;
            this.app.arcStart = null;
            this.app.arcEnd = null;
            this.app.arcSource = null;
        }

        if (this.app.selectionArea) {
            const area = this.app.selectionArea;
            this.app.selectionArea = null;
            
            if (this.app.addMode === 'select') {
                if (this.app.selectedElements.length === 1) {
                    this.app.selected = this.app.selectedElements[0];
                    this.app.propertiesPanel.show(this.app.selected, this.app.isSmartModel);
                }
            } else if (this.app.addMode === 'zoomIn') {
                if (Math.abs(area.width) < 5 && Math.abs(area.height) < 5) {
                    this.app.zoomIn(this.rawStartX, this.rawStartY);
                } else {
                    const rectX = Math.min(this.app.selectionStart.x, pos.x);
                    const rectY = Math.min(this.app.selectionStart.y, pos.y);
                    this.app.zoomToArea(rectX, rectY, Math.abs(area.width), Math.abs(area.height));
                }
            } else if (this.app.addMode === 'zoomOut') {
                this.app.zoomOut(this.rawStartX, this.rawStartY);
            }
        }
    }

    onWheel(e) {
        if (e.target === this.canvasEl) {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.app.zoomIn(e.clientX, e.clientY);
            } else {
                this.app.zoomOut(e.clientX, e.clientY);
            }
        }
    }

    onDoubleClick(e) {
        const pos = this.getMousePos(e);
        const clicked = this.app.getElementAt(pos.x, pos.y) || this.app.getAnnotationAt(pos.x, pos.y);
        
        if (clicked) {
            this.app.selectedElements = [clicked];
            this.app.selected = clicked;
            this.app.propertiesPanel.show(clicked, this.app.isSmartModel);
        }
    }

    onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space' && !this.isSpacePan) {
            e.preventDefault();
            this.isSpacePan = true;
            this.canvasEl.style.cursor = 'grab';
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.app.deleteSelected();
        } else if (e.ctrlKey && e.key === 'z') {
            if (e.shiftKey) this.app.undoManager.redo();
            else this.app.undoManager.undo();
        } else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.app.saveLocalDesign();
        }
    }

    onKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePan = false;
            if (!this.isPanning) {
                this.app.setMode(this.app.addMode);
            }
        }
    }
}
