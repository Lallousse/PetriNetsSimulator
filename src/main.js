import './styles/index.css';
import { createIcons, icons } from 'lucide';
import { DesignState, Saver } from './models/state.js';
import { Loader } from './models/loader.js';
import { NetAnalyzer } from './models/analyzer.js';
import { CanvasRenderer } from './renderer/CanvasRenderer.js';
import { SimulationEngine } from './simulation/SimulationEngine.js';
import { InputHandler } from './interaction/InputHandler.js';
import { UndoManager } from './interaction/UndoManager.js';
import { Toolbar } from './ui/Toolbar.js';
import { ModalManager } from './ui/ModalManager.js';
import { PropertiesPanel } from './ui/PropertiesPanel.js';
import { Place, Transition, Initializer, Annotation, Arc } from './models/elements.js';
import { FileSystem } from './storage/FileSystem.js';
import { FileExplorer } from './ui/FileExplorer.js';
import { initAlgoViz } from './algoviz/AlgoVizApp.js';

class PetriNetApp {
    constructor() {
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
        this.annotations = [];
        this.animations = [];
        
        this.isSmartModel = false;
        this.autoRun = false;
        this.paused = false;
        this.animationSpeed = 1.0;
        this.zoomLevel = 1.0;
        this.snapToGrid = false;
        
        this.addMode = 'select'; // select, place, transition, arc, initializer, annotation, hand, plus, minus
        this.handMode = false;
        
        this.selectedElements = [];
        this.selected = null;
        
        this.currentPlatform = 'petrinet'; // 'petrinet' or 'algoviz'
        this.algovizApp = null;
        
        this.initDOM();
        
        this.designState = new DesignState(this);
        this.renderer = new CanvasRenderer(this.canvasEl);
        this.simulation = new SimulationEngine(this);
        this.undoManager = new UndoManager(this);
        this.inputHandler = new InputHandler(this.canvasEl, this);
        
        this.modalManager = new ModalManager('modal-overlay');
        this.propertiesPanel = new PropertiesPanel('properties-panel', this.onPropertyChange.bind(this));
        
        this.initFileSystem();

        this.autoSaveEnabled = localStorage.getItem('petrinet_autosave') === 'true';

        this.initToolbars();
        this.updateUI();
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
        
        // Hide splash
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.remove(), 500);
            }
        }, 1000);

        // Start render loop
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.renderLoop(time));
        
        // Auto-save loop
        setInterval(() => {
            if (this.autoSaveEnabled && this.hasUnsavedChanges()) {
                this.saveLocalDesign(true);
            }
        }, 3000);
    }

    initDOM() {
        this.canvasEl = document.getElementById('petrinet-canvas');
        if (!this.canvasEl) {
            console.error("Canvas element not found!");
        }

        // Setup Platform Switch
        const platformBtns = document.querySelectorAll('#platform-switch .segment-btn');
        const platformBg = document.querySelector('#platform-switch .segment-active-bg');
        if (platformBtns.length > 0) {
            platformBtns.forEach((btn, index) => {
                btn.addEventListener('click', () => {
                    if (this.currentPlatform === btn.dataset.value) return;
                    platformBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    platformBg.style.left = index === 0 ? '4px' : 'calc(50% + 2px)';
                    this.switchPlatform(btn.dataset.value);
                });
            });
        }

        // Setup Theme Switch
        const themeBtns = document.querySelectorAll('#theme-switch .segment-btn');
        const themeBg = document.querySelector('#theme-switch .segment-active-bg');
        themeBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                themeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                themeBg.style.left = index === 0 ? '4px' : 'calc(50% + 2px)';
                document.documentElement.setAttribute('data-theme', btn.dataset.value);
            });
        });

        // Setup Model Switch
        const modelBtns = document.querySelectorAll('#model-switch .segment-btn');
        const modelBg = document.querySelector('#model-switch .segment-active-bg');
        modelBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (this.isSmartModel === (btn.dataset.value === 'S')) return;
                
                const performSwitch = () => {
                    this.isSmartModel = (btn.dataset.value === 'S');
                    this.switchModelInternal();
                };

                if (this.designState.hasDesign()) {
                    this.modalManager.showConfirm(
                        'Change Model Type', 
                        `Switch to ${btn.dataset.value}-Model? Some properties may be lost.`,
                        performSwitch
                    );
                } else {
                    performSwitch();
                }
            });
        });

        // Warning Banner
        const banner = document.getElementById('warning-banner');
        const closeBanner = document.getElementById('warning-close-btn');
        if (localStorage.getItem('hide_export_warning') !== 'true') {
            banner.style.display = 'flex';
        }
        closeBanner.addEventListener('click', () => {
            banner.style.display = 'none';
            localStorage.setItem('hide_export_warning', 'true');
        });
    }

    resize() {
        this.renderer.resize(window.innerWidth, window.innerHeight);
        // Retain rendering after resize
        this.setMode('select');
    }

    setMode(mode) {
        this.addMode = mode;
        this.handMode = (mode === 'hand');
        
        // Clear all exclusive left toolbar buttons, then set active if it belongs there
        this.toolbarLeft.setActive(mode + 'Btn', true, true);
        
        // Handle top toolbar exclusive modes (zoom)
        if (this.toolbarTop) {
            this.toolbarTop.setActive('zoomInBtn', mode === 'zoomIn', false);
            this.toolbarTop.setActive('zoomOutBtn', mode === 'zoomOut', false);
        }
        
        let cursor = 'default';
        if (mode === 'hand') cursor = 'grab';
        else if (mode === 'plus') cursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round'><line x1='12' y1='7' x2='12' y2='17' stroke='white' stroke-width='5'/><line x1='7' y1='12' x2='17' y2='12' stroke='white' stroke-width='5'/><line x1='12' y1='7' x2='12' y2='17' stroke='black' stroke-width='2'/><line x1='7' y1='12' x2='17' y2='12' stroke='black' stroke-width='2'/></svg>") 12 12, auto`;
        else if (mode === 'minus') cursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round'><line x1='7' y1='12' x2='17' y2='12' stroke='white' stroke-width='5'/><line x1='7' y1='12' x2='17' y2='12' stroke='black' stroke-width='2'/></svg>") 12 12, auto`;
        else if (['place', 'transition', 'arc', 'initializer', 'annotation', 'zoomIn', 'zoomOut'].includes(mode)) {
            if (mode === 'zoomIn') cursor = 'zoom-in';
            else if (mode === 'zoomOut') cursor = 'zoom-out';
            else cursor = 'crosshair';
        }
        
        this.canvasEl.style.cursor = cursor;
        this.updateUI();
        
        if (mode !== 'select') {
            this.selectedElements = [];
            this.selected = null;
            this.propertiesPanel.hide();
        }
    }

    initToolbars() {
        const leftTools = [
            [
                { id: 'selectBtn', icon: 'mouse-pointer-2', tooltip: 'Select & Edit', action: () => this.setMode('select') },
                { id: 'handBtn', icon: 'hand', tooltip: 'Pan Canvas', action: () => this.setMode('hand') }
            ],
            [
                { id: 'placeBtn', icon: 'circle', tooltip: 'Add Place', action: () => this.setMode('place') },
                { id: 'transitionBtn', icon: 'square', tooltip: 'Add Transition', action: () => this.setMode('transition') },
                { id: 'arcBtn', icon: 'move-up-right', tooltip: 'Add Arc', action: () => this.setMode('arc') },
                { id: 'initializerBtn', icon: 'sparkle', tooltip: 'Add Initializer', action: () => this.setMode('initializer') }
            ],
            [
                { id: 'plusBtn', icon: 'plus-circle', tooltip: 'Add Token', action: () => this.setMode('plus') },
                { id: 'minusBtn', icon: 'minus-circle', tooltip: 'Remove Token', action: () => this.setMode('minus') }
            ],
            [
                { id: 'annotationBtn', icon: 'type', tooltip: 'Add Note', action: () => this.setMode('annotation') }
            ]
        ];

        const topTools = [
            [
                { id: 'newBtn', icon: 'file-plus', tooltip: 'New Design', action: () => this.newDesign() },
                { id: 'explorerBtn', icon: 'folder', tooltip: 'File Explorer', action: () => this.fileExplorer && this.fileExplorer.open() },
                { id: 'saveBtn', icon: 'save', tooltip: 'Save Local', action: () => this.saveLocalDesign() },
                { id: 'saveAsBtn', icon: 'save-all', tooltip: 'Save As', action: () => this.saveAsLocalDesign() },
                { id: 'exportBtn', icon: 'download', tooltip: 'Export Design', action: () => this.exportDesign() },
                { id: 'autoSaveBtn', icon: 'refresh-cw', tooltip: 'Toggle Auto-Save', action: () => this.toggleAutoSave() }
            ],
            [
                { id: 'undoBtn', icon: 'undo', tooltip: 'Undo', action: () => this.undoManager.undo() && this.updateUI() },
                { id: 'redoBtn', icon: 'redo', tooltip: 'Redo', action: () => this.undoManager.redo() && this.updateUI() }
            ],
            [
                { id: 'playPauseBtn', icon: 'play', tooltip: 'Play/Pause', action: () => this.togglePlayPause() },
                { id: 'resetSimBtn', icon: 'rotate-ccw', tooltip: 'Reset Simulation', action: () => this.resetSimulation() },
                { id: 'speedBtn', icon: 'gauge', tooltip: 'Speed: 1.0x', action: () => this.cycleSpeed() }
            ],
            [
                { id: 'deleteBtn', icon: 'trash-2', tooltip: 'Delete Selected', action: () => this.deleteSelected() },
                { id: 'clearBtn', icon: 'eraser', tooltip: 'Clear Canvas', action: () => this.clearCanvas() }
            ],
            [
                { id: 'zoomInBtn', icon: 'zoom-in', tooltip: 'Zoom In Tool', action: () => this.setMode('zoomIn') },
                { id: 'zoomOutBtn', icon: 'zoom-out', tooltip: 'Zoom Out Tool', action: () => this.setMode('zoomOut') },
                { id: 'snapBtn', icon: 'magnet', tooltip: 'Snap to Grid', action: () => this.toggleSnap() }
            ],
            [
                { id: 'pnfnBtn', icon: 'sigma', tooltip: 'PN-FN Formal Notation', action: () => this.showPNFN() },
                { id: 'mrpnBtn', icon: 'table', tooltip: 'MR-PN Matrix Representation', action: () => this.showMRPN() }
            ],
            [
                { id: 'guideBtn', icon: 'help-circle', tooltip: 'Guide', action: () => this.showGuide() }
            ]
        ];
        const topToolsAlgo = [
            [
                { id: 'newAlgoBtn', icon: 'file-plus', tooltip: 'New Design', action: () => this.newDesign() },
                { id: 'explorerAlgoBtn', icon: 'folder', tooltip: 'File Explorer', action: () => this.fileExplorer && this.fileExplorer.open() },
                { id: 'saveAlgoBtn', icon: 'save', tooltip: 'Save Local', action: () => this.saveLocalDesign() },
                { id: 'saveAsAlgoBtn', icon: 'save-all', tooltip: 'Save As', action: () => this.saveAsLocalDesign() },
                { id: 'exportAlgoBtn', icon: 'download', tooltip: 'Export Design', action: () => this.exportDesign() },
                { id: 'autoSaveAlgoBtn', icon: 'refresh-cw', tooltip: 'Toggle Auto-Save', action: () => this.toggleAutoSave() }
            ]
        ];

        this.toolbarLeft = new Toolbar('left-toolbar', leftTools);
        this.toolbarTop = new Toolbar('top-toolbar', topTools);
        this.algovizToolbarTop = new Toolbar('algoviz-top-toolbar', topToolsAlgo);
        
        this.setMode('select');
    }

    updateUI() {
        const hasDesign = this.designState.hasDesign();
        
        // Update document title
        const unsaved = this.hasUnsavedChanges();
        const title = `AlgoViz Studio - ${this.designState.currentFileName || "Untitled"}${unsaved ? "*" : ""}`;
        document.title = title;
        document.getElementById('file-name-display').textContent = this.designState.currentFileName || "Untitled";

        // Update status bar model badge
        const badge = document.getElementById('model-badge');
        badge.textContent = this.isSmartModel ? 'S-Model' : 'T-Model';
        badge.className = `model-badge ${this.isSmartModel ? 's-model' : 't-model'}`;
        
        document.getElementById('zoom-display').textContent = `${(this.zoomLevel * 100).toFixed(0)}%`;
        
        const playBtn = this.toolbarTop.buttons.get('playPauseBtn');
        if (playBtn) {
            playBtn.innerHTML = `<i data-lucide="${(this.autoRun && !this.paused) ? 'pause' : 'play'}"></i>`;
        }

        // Sync model switch UI
        const modelBtns = document.querySelectorAll('#model-switch .segment-btn');
        const modelBg = document.querySelector('#model-switch .segment-active-bg');
        modelBtns.forEach((btn, index) => {
            if ((this.isSmartModel && btn.dataset.value === 'S') || (!this.isSmartModel && btn.dataset.value === 'T')) {
                modelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (modelBg) modelBg.style.left = index === 0 ? '4px' : 'calc(50% + 2px)';
            }
        });
        
        this.toolbarTop.setActive('autoSaveBtn', this.autoSaveEnabled, false);
        this.algovizToolbarTop.setActive('autoSaveAlgoBtn', this.autoSaveEnabled, false);
        this.toolbarTop.setActive('snapBtn', this.snapToGrid, false);

        createIcons({ icons, nameAttr: 'data-lucide' });
    }

    renderLoop(time) {
        if (this.autoRun && !this.paused) {
            if (!this.simulation.lastStepTime) {
                // Ensure immediate step on first run by subtracting interval
                this.simulation.lastStepTime = time - (2000 / this.animationSpeed);
            }
            if (time - this.simulation.lastStepTime >= (2000 / this.animationSpeed)) {
                this.simulation.simulateStep();
                this.simulation.generateTokensFromInitializers();
                this.simulation.lastStepTime = time;
            }
            this.simulation.updateAnimations();
        }
        
        this.renderer.render(this);
        requestAnimationFrame((t) => this.renderLoop(t));
    }

    // Property Panel Callback
    onPropertyChange(element, property, value, saveUndo = true) {
        if (saveUndo) {
            this.undoManager.saveState();
        }
        
        if (property === 'name') element.name = value;
        if (property === 'tokens') element.tokens = parseInt(value, 10);
        if (property === 'tokenValue') {
            if (element instanceof Initializer) element.tokenValue = parseFloat(value);
            else element.setTokenValue(parseFloat(value));
        }
        if (property === 'task') element.task.task = value;
        if (property === 'tokenOrder') element.tokenOrder = value;
        if (property === 'passOnTrue') element.passOnTrue = value;
        if (property === 'passOnFalse') element.passOnFalse = value;
        if (property === 'passPreviousValue') element.passPreviousValue = value;
        if (property === 'weight') {
            element.weight = parseInt(value, 10);
            if (element instanceof Arc) {
                if (element.isInput && element.end instanceof Transition) {
                    const linked = element.end.inputArcs.find(a => a.place === element.start);
                    if (linked) linked.weight = element.weight;
                } else if (!element.isInput && element.start instanceof Transition) {
                    const linked = element.start.outputArcs.find(a => a.place === element.end);
                    if (linked) linked.weight = element.weight;
                } else if (element.start instanceof Initializer) {
                    const linked = element.start.outputArcs.find(a => a.place === element.end);
                    if (linked) linked.weight = element.weight;
                }
            }
        }
        if (property === 'tokensToGenerate') element.tokensToGenerate = parseInt(value, 10);
        if (property === 'tokensPerSecond') element.tokensPerSecond = parseFloat(value);
        if (property === 'isContinuous') element.isContinuous = value;
        if (property === 'text') element.text = value;
        if (property === 'fontSize') element.fontSize = parseInt(value, 10);
        if (property === 'color') element.color = value;
        
        this.designState.setUnsavedChanges();
        this.updateUI();
    }

    // Simulation Controls
    togglePlayPause() {
        if (!this.autoRun) {
            this.autoRun = true;
            this.paused = false;
            // Subtract interval so it triggers on next frame
            this.simulation.lastStepTime = performance.now() - (2000 / this.animationSpeed);
        } else if (!this.paused) {
            this.paused = true;
        } else {
            this.paused = false;
            // Subtract interval so it triggers on next frame
            this.simulation.lastStepTime = performance.now() - (2000 / this.animationSpeed);
        }
        
        if (!this.autoRun && !this.paused) {
            this.simulation.reset();
        }
        this.updateUI();
    }

    resetSimulation() {
        this.autoRun = false;
        this.paused = false;
        this.simulation.reset();
        this.places.forEach(p => { p.tokens = 0; p.smartToken = null; });
        this.initializers.forEach(i => { i.tokensGenerated = 0; i.isGenerating = false; });
        this.updateUI();
    }

    cycleSpeed() {
        const speeds = [0.25, 0.5, 1.0, 1.5, 2.0];
        const idx = speeds.indexOf(this.animationSpeed);
        this.animationSpeed = speeds[(idx + 1) % speeds.length];
        this.toolbarTop.buttons.get('speedBtn').setAttribute('data-tooltip', `Speed: ${this.animationSpeed}x`);
        this.updateUI();
    }

    // View Controls
    zoomIn(clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
        this.applyZoom(1.2, clientX, clientY);
    }

    zoomOut(clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
        this.applyZoom(1 / 1.2, clientX, clientY);
    }

    applyZoom(factor, clientX, clientY) {
        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.max(0.2, Math.min(5.0, this.zoomLevel * factor));
        
        const actualFactor = this.zoomLevel / oldZoom;
        if (this.inputHandler) {
            this.inputHandler.applyZoomRelative(actualFactor, clientX, clientY);
        }
        
        this.resize();
        this.updateUI();
    }

    zoomToArea(rectX, rectY, rectWidth, rectHeight) {
        const pad = 40;
        const targetW = rectWidth || 1;
        const targetH = rectHeight || 1;
        
        const scaleX = (window.innerWidth - pad * 2) / targetW;
        const scaleY = (window.innerHeight - pad * 2) / targetH;
        
        let newZoom = Math.min(scaleX, scaleY);
        newZoom = Math.max(0.2, Math.min(5.0, newZoom));
        this.zoomLevel = newZoom;
        
        const rectCenterX = rectX + targetW / 2;
        const rectCenterY = rectY + targetH / 2;
        const rect = this.canvasEl.getBoundingClientRect();
        
        const screenCenterX = (window.innerWidth - rect.left) / 2;
        const screenCenterY = (window.innerHeight - rect.top) / 2;
        
        this.inputHandler.panX = screenCenterX / newZoom - rectCenterX;
        this.inputHandler.panY = screenCenterY / newZoom - rectCenterY;
        
        this.setMode('select');
        this.resize();
        this.updateUI();
    }

    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
        this.toolbarTop.setActive('snapBtn', this.snapToGrid, false);
    }

    // Editing Operations
    deleteSelected() {
        if (this.selectedElements.length > 0) {
            this.undoManager.saveState();
            this.selectedElements.forEach(el => {
                if (el instanceof Place) {
                    this.places = this.places.filter(p => p !== el);
                    this.arcs = this.arcs.filter(a => a.start !== el && a.end !== el);
                    this.transitions.forEach(t => {
                        t.inputArcs = t.inputArcs.filter(a => a.place !== el);
                        t.outputArcs = t.outputArcs.filter(a => a.place !== el);
                    });
                    this.initializers.forEach(i => {
                        i.outputArcs = i.outputArcs.filter(a => a.place !== el);
                    });
                } else if (el instanceof Transition) {
                    this.transitions = this.transitions.filter(t => t !== el);
                    this.arcs = this.arcs.filter(a => a.start !== el && a.end !== el);
                } else if (el instanceof Initializer) {
                    this.initializers = this.initializers.filter(i => i !== el);
                    this.arcs = this.arcs.filter(a => a.start !== el);
                } else if (el instanceof Arc) {
                    this.arcs = this.arcs.filter(a => a !== el);
                    if (el.isInput && el.end instanceof Transition) {
                        el.end.inputArcs = el.end.inputArcs.filter(a => a.place !== el.start);
                    } else if (!el.isInput && el.start instanceof Transition) {
                        el.start.outputArcs = el.start.outputArcs.filter(a => a.place !== el.end);
                    } else if (el.start instanceof Initializer) {
                        el.start.outputArcs = el.start.outputArcs.filter(a => a.place !== el.end);
                    }
                } else if (el instanceof Annotation) {
                    this.annotations = this.annotations.filter(a => a !== el);
                }
            });
            this.selectedElements = [];
            this.selected = null;
            this.propertiesPanel.hide();
            this.designState.setUnsavedChanges();
            this.updateUI();
        }
    }

    newDesign(force = false) {
        if (this.currentPlatform === 'petrinet') {
            this.clearCanvas(force);
        } else {
            const performNew = () => {
                if (this.algovizApp) {
                    this.algovizApp.clear();
                }
                this.designState.newDesign(null);
                this.updateUI();
            };
            
            if (this.hasUnsavedChanges() && !force) {
                this.modalManager.showConfirm('New Design', 'Are you sure you want to create a new design? All unsaved changes will be lost.', performNew);
            } else {
                performNew();
            }
        }
    }

    clearCanvas(force = false) {
        const performClear = () => {
            this.undoManager.saveState();
            this.places = [];
            this.transitions = [];
            this.arcs = [];
            this.initializers = [];
            this.annotations = [];
            this.selectedElements = [];
            this.selected = null;
            this.propertiesPanel.hide();
            this.simulation.reset();
            this.designState.newDesign(null);
            this.updateUI();
        };

        if (this.designState.hasDesign() && !force) {
            this.modalManager.showConfirm('Clear Canvas', 'Are you sure you want to clear the canvas?', performClear);
        } else {
            performClear();
        }
    }

    switchModelInternal() {
        this.undoManager.saveState();
        this.simulation.reset();
        if (!this.isSmartModel) {
            this.places.forEach(p => p.smartToken = null);
        }
        this.designState.setUnsavedChanges();
        this.updateUI();
    }

    // Helper finders for InputHandler
    getElementAt(x, y) {
        for (const p of this.places) {
            if ((x - p.x) ** 2 + (y - p.y) ** 2 <= 400) return p;
        }
        for (const t of this.transitions) {
            if (Math.abs(x - t.x) < 20 && Math.abs(y - t.y) < 24) return t;
        }
        for (const i of this.initializers) {
            if (Math.abs(x - i.x) < 20 && Math.abs(y - i.y) < 20) return i;
        }
        return null;
    }

    getArcAt(x, y) {
        for (const arc of this.arcs) {
            const startX = arc.start.x; const startY = arc.start.y;
            const endX = arc.end.x; const endY = arc.end.y;
            const dx = endX - startX; const dy = endY - startY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / length; const unitY = dy / length;
            const perpX = -unitY; const perpY = unitX;
            const t = ((x - startX) * unitX + (y - startY) * unitY);
            const dist = Math.abs((x - startX) * perpX + (y - startY) * perpY);
            if (dist < 10 && t >= 0 && t <= length) return arc;
        }
        return null;
    }

    getAnnotationAt(x, y) {
        for (const a of this.annotations) {
            this.renderer.ctx.font = `${a.fontSize}px ${a.fontName}`;
            const width = this.renderer.ctx.measureText(a.text.split("\n")[0]).width;
            const height = a.fontSize * a.text.split("\n").length;
            if (x >= a.x && x <= a.x + width && y >= a.y - height && y <= a.y) return a;
        }
        return null;
    }

    selectWithinArea(rect) {
        this.selectedElements = [];
        const inRect = (x, y) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
        
        this.places.forEach(p => { if (inRect(p.x, p.y)) this.selectedElements.push(p); });
        this.transitions.forEach(t => { if (inRect(t.x, t.y)) this.selectedElements.push(t); });
        this.initializers.forEach(i => { if (inRect(i.x, i.y)) this.selectedElements.push(i); });
        
        if (this.selectedElements.length === 1) {
            this.selected = this.selectedElements[0];
            this.propertiesPanel.show(this.selected, this.isSmartModel);
        } else {
            this.selected = null;
            this.propertiesPanel.hide();
        }
    }

    // File Operations
    toggleAutoSave() {
        this.autoSaveEnabled = !this.autoSaveEnabled;
        localStorage.setItem('petrinet_autosave', this.autoSaveEnabled);
        this.updateUI();
        if (this.autoSaveEnabled) {
            this.saveLocalDesign();
        }
    }

    async saveLocalDesign(silent = false) {
        if (this.isSaving) return;
        try {
            this.isSaving = true;
            
            let design;
            if (this.currentPlatform === 'petrinet') {
                if (!this.designState.hasDesign()) {
                    this.isSaving = false;
                    return;
                }
                design = Saver.save(this);
            } else {
                if (!this.algovizApp) {
                    this.isSaving = false;
                    return;
                }
                design = this.algovizApp.getState();
            }
            
            const json = JSON.stringify(design, null, 2);
            
            const fileName = this.designState.currentFileName || "New Design";
            const fileId = this.designState.currentFileId || null;
            
            if (this.fs) {
                let folderId = null;
                if (fileId) {
                    const existing = await this.fs.getFile(fileId);
                    if (existing) folderId = existing.folderId;
                }
                const savedFile = await this.fs.saveFile(fileId, fileName, folderId, json);
                
                this.designState.currentFileName = fileName;
                this.designState.currentFileId = savedFile.id;
                this.designState.saveDesign();
                
                if (this.currentPlatform === 'petrinet') {
                    this.designState.clearUnsavedChanges();
                } else {
                    this.algovizApp.markSaved();
                }
                
                // Update title directly to clear '*' immediately after async save
                const title = `AlgoViz Studio - ${this.designState.currentFileName}${this.hasUnsavedChanges() ? "*" : ""}`;
                document.title = title;
                const display = document.getElementById('file-name-display');
                if (display) display.textContent = this.designState.currentFileName;
                
                if (!silent) this.updateUI();
            }
        } catch (err) {
            console.error("Save failed:", err);
            if (!silent && this.modalManager) {
                this.modalManager.showAlert("Error", "Failed to save design locally: " + err.message);
            }
        } finally {
            this.isSaving = false;
        }
    }

    saveAsLocalDesign() {
        if (this.fileExplorer) {
            this.fileExplorer.open();
        }
    }

    initFileSystem() {
        this.fs = new FileSystem(this.currentPlatform);
        this.fs.init().then(() => {
            this.fileExplorer = new FileExplorer(this);
            if (this.currentPlatform === 'algoviz' && this.toolbarTop) {
                // We need to re-render toolbar if file explorer reference changes
                this.updateUI();
            }
        });
    }

    switchPlatform(platform) {
        this.currentPlatform = platform;
        
        const petrinetEl = document.getElementById('petrinet-app');
        const algovizEl = document.getElementById('algoviz-app');
        const platformBadge = document.getElementById('platform-badge');
        const modelBadge = document.getElementById('model-badge');
        const modelSwitch = document.getElementById('model-switch');

        if (platform === 'petrinet') {
            petrinetEl.style.display = 'block';
            algovizEl.style.display = 'none';
            platformBadge.textContent = 'PetriNet';
            modelBadge.style.display = 'inline';
            modelSwitch.style.display = 'flex';
        } else {
            petrinetEl.style.display = 'none';
            algovizEl.style.display = 'flex';
            platformBadge.textContent = 'AlgoViz';
            modelBadge.style.display = 'none';
            modelSwitch.style.display = 'none';
            
            if (!this.algovizApp) {
                this.algovizApp = initAlgoViz(this);
            }
        }
        
        // Re-initialize file system for the new platform database
        this.initFileSystem();
        
        // Clear current file tracking state
        this.designState.currentFileId = null;
        this.designState.currentFileName = "Untitled";
        this.designState.clearUnsavedChanges();
        
        this.updateUI();
    }
    
    hasUnsavedChanges() {
        if (this.currentPlatform === 'petrinet') {
            return this.designState.hasUnsavedChanges();
        } else {
            return this.algovizApp && this.algovizApp.hasUnsavedChanges();
        }
    }

    loadFromLocalFile(file) {
        try {
            const design = JSON.parse(file.content);
            if (this.currentPlatform === 'algoviz') {
                if (this.algovizApp && this.algovizApp.setState(design)) {
                    this.designState.newDesign(file.name);
                    this.designState.currentFileId = file.id;
                    this.algovizApp.markSaved();
                    this.updateUI();
                }
            } else {
                this.simulation.reset();
                Loader.load(this, design);
                this.undoManager.undoHistory = [];
                this.undoManager.redoHistory = [];
                this.designState.newDesign(file.name);
                this.designState.currentFileId = file.id;
                this.designState.saveDesign();
                this.selectedElements = [];
                this.selected = null;
                this.propertiesPanel.hide();
                this.updateUI();
            }
        } catch (err) {
            this.modalManager.showAlert("Error", "Error loading file: " + err.message);
        }
    }

    exportDesign() {
        if (!this.designState.hasDesign()) return;
        let design;
        if (this.currentPlatform === 'petrinet') {
            if (!this.designState.hasDesign()) return;
            design = Saver.save(this);
        } else {
            if (!this.algovizApp) return;
            design = this.algovizApp.getState();
        }
        const json = JSON.stringify(design, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const fileName = this.designState.currentFileName || "design";
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.designState.saveDesign();
        this.updateUI();
    }

    loadDesign() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const design = JSON.parse(event.target.result);
                    if (this.currentPlatform === 'algoviz') {
                        if (this.algovizApp && this.algovizApp.setState(design)) {
                            this.designState.newDesign(file.name.replace(".json", ""));
                            this.algovizApp.markSaved();
                            this.updateUI();
                        }
                    } else {
                        this.simulation.reset();
                        Loader.load(this, design);
                        this.undoManager.undoHistory = [];
                        this.undoManager.redoHistory = [];
                        this.designState.newDesign(file.name.replace(".json", ""));
                        this.selectedElements = [];
                        this.selected = null;
                        this.propertiesPanel.hide();
                        this.updateUI();
                    }
                } catch (err) {
                    this.modalManager.showAlert("Error", "Error loading file: " + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    newDesign(force = false) {
        const performNew = () => {
            this.places = [];
            this.transitions = [];
            this.arcs = [];
            this.initializers = [];
            this.annotations = [];
            this.selectedElements = [];
            this.selected = null;
            this.propertiesPanel.hide();
            this.simulation.reset();
            this.designState.newDesign("New Design");
            this.undoManager.undoHistory = [];
            this.undoManager.redoHistory = [];
            this.updateUI();
        };

        if (this.designState.hasUnsavedChanges() && !force) {
            this.modalManager.showConfirm('New Design', 'You have unsaved changes. Create new design anyway?', performNew);
        } else {
            performNew();
        }
    }

    // Analysis Modals
    showPNFN() {
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();
        let text = nets.map((net, i) => `Net ${i + 1}:\n${net.toFormalNotation(this.isSmartModel)}`).join("\n\n");
        if (!text) text = "No elements to analyze.";
        
        this.modalManager.show(
            'Petri Net Formal Notation (PN-FN)',
            `<textarea class="code-view" readonly>${text}</textarea>`
        );
    }

    showMRPN() {
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();
        let text = nets.map((net, i) => `Net ${i + 1}:\n${net.toMRPNText(this.isSmartModel)}`).join("\n\n-----------------\n\n");
        if (!text) text = "No elements to analyze.";
        
        this.modalManager.show(
            'Matrix Representation (MR-PN)',
            `<textarea class="code-view" readonly>${text}</textarea>`
        );
    }

    showGuide() {
        const guideText = `
            <div class="guide-container">
                <section class="guide-section">
                    <h4 class="guide-title">Smart Model (S-Model) Transition Tasks Guide</h4>
                    <ul class="guide-list">
                        <li><b>+</b>: Adds values of incoming tokens.</li>
                        <li><b>-</b>: Subtracts second token value from first based on order.</li>
                        <li><b>*</b>: Multiplies values of incoming tokens.</li>
                        <li><b>/</b>: Divides first token value by second based on order.</li>
                        <li><b>!= &lt;number&gt;</b>: Checks if token value is not equal to &lt;number&gt;.</li>
                        <li><b>== &lt;number&gt;</b>: Checks if token value equals &lt;number&gt;.</li>
                        <li><b>cp</b>: Copies the token value to all output places.</li>
                        <li><b>p &lt;seconds&gt;</b>: Pauses token for &lt;seconds&gt; before forwarding.</li>
                        <li>No task: Acts as a gate, forwards token as-is.</li>
                    </ul>
                </section>
                
                <section class="guide-section">
                    <h4 class="guide-title">Traditional Model (T-Model) Notes</h4>
                    <ul class="guide-list">
                        <li><b>Input arc weights:</b> Number of tokens required to enable transition.</li>
                        <li><b>Output arc weights:</b> Number of tokens produced per firing to output places.</li>
                    </ul>
                </section>

                <section class="guide-section">
                    <h4 class="guide-title">Basic Tools Tutorial</h4>
                    <div class="guide-grid">
                        <div class="guide-item"><i data-lucide="file-plus"></i><span><b>New Design</b>: Start a fresh Petri net.</span></div>
                        <div class="guide-item"><i data-lucide="mouse-pointer-2"></i><span><b>Select & Edit</b>: Click or drag-select elements; double-click to edit.</span></div>
                        <div class="guide-item"><i data-lucide="hand"></i><span><b>Hand Tool</b>: Drag the canvas to pan the view.</span></div>
                        <div class="guide-item"><i data-lucide="circle"></i><span><b>Add Place</b>: Select, then click on canvas to add a place.</span></div>
                        <div class="guide-item"><i data-lucide="square"></i><span><b>Add Transition</b>: Select, then click to add a transition.</span></div>
                        <div class="guide-item"><i data-lucide="move-up-right"></i><span><b>Draw Arc</b>: Select, click a source, then a target to connect.</span></div>
                        <div class="guide-item"><i data-lucide="zap"></i><span><b>Add Initializer</b>: Select, click to add an initializer.</span></div>
                        <div class="guide-item"><i data-lucide="plus-circle"></i><span><b>Add Tokens</b>: Select a place, click to add tokens.</span></div>
                        <div class="guide-item"><i data-lucide="minus-circle"></i><span><b>Remove Tokens</b>: Select a place, click to remove tokens.</span></div>
                        <div class="guide-item"><i data-lucide="type"></i><span><b>Add Note</b>: Select, click to add text notes; double-click to edit.</span></div>
                        <div class="guide-item"><i data-lucide="undo"></i><span><b>Undo</b>: Revert your last action.</span></div>
                        <div class="guide-item"><i data-lucide="redo"></i><span><b>Redo</b>: Reapply your last undone action.</span></div>
                        <div class="guide-item"><i data-lucide="play"></i><span><b>Play/Pause</b>: Click to run, click again to pause.</span></div>
                        <div class="guide-item"><i data-lucide="rotate-ccw"></i><span><b>Reset Simulation</b>: Clear running simulation and tokens.</span></div>
                        <div class="guide-item"><i data-lucide="gauge"></i><span><b>Speed Control</b>: Click to cycle speeds.</span></div>
                        <div class="guide-item"><i data-lucide="trash-2"></i><span><b>Delete</b>: Select elements, click to remove.</span></div>
                        <div class="guide-item"><i data-lucide="eraser"></i><span><b>Clear Canvas</b>: Remove all elements.</span></div>
                        <div class="guide-item"><i data-lucide="save"></i><span><b>Save</b>: Download design as JSON.</span></div>
                        <div class="guide-item"><i data-lucide="folder-open"></i><span><b>Load</b>: Import a JSON design.</span></div>
                        <div class="guide-item"><i data-lucide="zoom-in"></i><span><b>Zoom</b>: Use buttons or wheel to adjust view.</span></div>
                        <div class="guide-item"><i data-lucide="magnet"></i><span><b>Snap to Grid</b>: Toggle snapping to grid layout.</span></div>
                    </div>
                </section>

                <section class="guide-section">
                    <h4 class="guide-title">File Explorer & Saving</h4>
                    <ul class="guide-list">
                        <li><b><i data-lucide="folder" style="width:16px;height:16px;vertical-align:middle;color:currentColor;"></i> File Explorer:</b> Organize your local designs in folders. Supports drag-and-drop and uploading JSON files directly into the virtual filesystem.</li>
                        <li><b><i data-lucide="refresh-cw" style="width:16px;height:16px;vertical-align:middle;color:currentColor;"></i> Auto-Save:</b> Enable to automatically push changes to the local database seamlessly.</li>
                        <li><b><i data-lucide="save" style="width:16px;height:16px;vertical-align:middle;color:currentColor;"></i> Save Local:</b> Save a snapshot of your design instantly to the internal storage.</li>
                        <li><b><i data-lucide="download" style="width:16px;height:16px;vertical-align:middle;color:currentColor;"></i> Export Design:</b> Downloads your current canvas as a .json file.</li>
                        <li><b><i data-lucide="archive" style="width:16px;height:16px;vertical-align:middle;color:currentColor;"></i> Export All (in Explorer):</b> Zips and downloads your entire filesystem. <b>Always use export when you want to backup your designs or use them on another device!</b></li>
                    </ul>
                </section>

                <section class="guide-section">
                    <h4 class="guide-title">Analysis Tools</h4>
                    
                    <div style="margin-bottom: 8px;">
                        <b><i data-lucide="sigma" style="width:16px;height:16px;vertical-align:middle;color:currentColor;"></i> Petri Net Formal Notation (PN-FN):</b>
                        <ul class="guide-list" style="margin-top: 8px;">
                            <li>Access via the 'PN-FN' button in the toolbar.</li>
                            <li>Displays the formal notation of the Petri Net(s) on the canvas as PN = {P, T, I, O, M₀}.</li>
                            <li><b>P:</b> Set of all places (e.g., P = {P1, P2, P3}).</li>
                            <li><b>T:</b> Set of all transitions (e.g., T = {T1, T2}).</li>
                            <li><b>I:</b> Input function listing arc weights from places to transitions (e.g., I(P1, T1) = 2).</li>
                            <li><b>O:</b> Output function listing arc weights from transitions to places (e.g., O(P2, T1) = 1).</li>
                            <li><b>M₀:</b> Initial marking showing token counts for each place in a vertical matrix (e.g., M₀ =<br>
<pre style="margin: 4px 0; background: var(--bg-elevated); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.2;">  | 2 |
  | 1 |
  | 0 |</pre>).</li>
                            <li>Multiple nets are detected if elements are unconnected and shown as 'Net 1', 'Net 2', etc.</li>
                            <li><b>'Regenerate M₀':</b> Updates M₀ to reflect current token counts.</li>
                            <li><b>'Reload All':</b> Refreshes the entire notation after design changes.</li>
                            <li><b>'Insert as Note':</b> Adds the notation as a multi-line annotation on the canvas (right or bottom).</li>
                        </ul>
                    </div>

                    <div>
                        <b><i data-lucide="table" style="width:16px;height:16px;vertical-align:middle;color:currentColor;"></i> Matrix Representation of Petri Nets (MR-PN):</b>
                        <ul class="guide-list" style="margin-top: 8px;">
                            <li>Access via the 'MR-PN' button in the toolbar.</li>
                            <li>Displays input and output matrices for each net on the canvas.</li>
                            <li><b>Input Matrix (I):</b> Shows arc weights from places (rows) to transitions (columns), e.g.:<br>
<pre style="margin: 4px 0; background: var(--bg-elevated); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.2;">      t1  t2  t3
  p1 | 0   1   0  |
  p2 | 1   0   0  |</pre></li>
                            <li><b>Output Matrix (O):</b> Shows arc weights from transitions (columns) to places (rows), e.g.:<br>
<pre style="margin: 4px 0; background: var(--bg-elevated); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 13px; line-height: 1.2;">      t1  t2  t3
  p1 | 1   0   0  |
  p2 | 0   1   0  |</pre></li>
                            <li>In S-Model, weights are always 1; in T-Model, weights reflect user-set values.</li>
                            <li>Multiple nets are shown as separate matrices if detected.</li>
                            <li><b>'Regenerate':</b> Updates matrices after design changes.</li>
                            <li><b>'Insert as Note':</b> Adds the matrices as a multi-line annotation on the canvas (right or bottom).</li>
                        </ul>
                    </div>
                </section>
            </div>
        `;
        this.modalManager.show('User Guide', guideText);
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.app = new PetriNetApp();
});

window.addEventListener('beforeunload', (e) => {
    // Modern browsers ignore the custom string and display a generic message,
    // but this is the only standard way to warn the user before closing the tab.
    if (window.app && window.app.designState && window.app.designState.hasDesign()) {
        const msg = "Please ensure you have Exported your designs before leaving. Local browser data can be lost.";
        e.preventDefault();
        e.returnValue = msg;
        return msg;
    }
});
