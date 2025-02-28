class PetriNetCanvas {
    constructor() {
        this.canvas = document.getElementById("petriCanvas");
        if (!this.canvas) {
            console.error("Canvas element not found!");
            return;
        }
        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx) {
            console.error("Failed to get 2D context!");
            return;
        }
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
        this.annotations = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.drawingArc = false;
        this.arcStart = null;
        this.arcEnd = null;
        this.selectionArea = null;
        this.selectionStart = null;
        this.autoRun = false;
        this.lastStep = 0;
        this.animationSpeed = 1.0;
        this.speedOptions = [0.25, 0.5, 1.0, 1.5];
        this.currentSpeedIndex = 2; // Default to 1.0
        this.snappingEnabled = false;
        this.zoomLevel = 1.0;
        this.isSmartModel = false;
        this.designState = new DesignState(this);
        this.designExists = false;
        this.arcType = "line";
        this.draggingControlPoint = false;

        this.iconSize = 32;
        this.tokenSize = 8;
        this.stepDelay = 2000; // Slower for visibility
        this.animationSpeedBase = 0.005; // Very slow animation

        this.icons = {};
        this.undoHistory = [];
        this.redoHistory = [];
        this.maxHistorySize = 10;

        this.resize();
        this.loadIcons();
        this.initEventListeners();
        this.updateButtonStates();
        this.renderLoop();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = (window.innerWidth - 50) * dpr;
        this.canvas.height = (window.innerHeight - 80) * dpr;
        this.canvas.style.width = `${window.innerWidth - 50}px`;
        this.canvas.style.height = `${window.innerHeight - 80}px`;
        this.ctx.scale(dpr, dpr);
        console.log("Canvas resized to:", this.canvas.width, this.canvas.height);
    }

    loadIcons() {
        const iconNames = [
            "new", "place", "transition", "delete", "plus", "minus", "play", "pause",
            "save", "load", "arc", "reset", "speed", "select", "snap", "zin", "zout",
            "clear", "switch", "guide", "ini", "note", "color", "font", "pnfn", "mrpn"
        ];
        iconNames.forEach(name => {
            this.icons[name] = new Image();
            this.icons[name].src = `assets/${name}.png`;
            this.icons[name].onload = () => {
                console.log(`Loaded icon: ${name}`);
                this.renderLoop();
            };
            this.icons[name].onerror = () => console.error(`Failed to load icon: ${name}`);
        });
    }

    initEventListeners() {
        this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
        this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
        this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        this.canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener("wheel", (e) => this.handleWheel(e));

        document.getElementById("newBtn").addEventListener("click", () => this.newDesign());
        document.getElementById("selectBtn").addEventListener("click", () => this.setMode("select"));
        document.getElementById("placeBtn").addEventListener("click", () => this.setMode("place"));
        document.getElementById("transitionBtn").addEventListener("click", () => this.setMode("transition"));
        document.getElementById("iniBtn").addEventListener("click", () => this.setMode("ini"));
        document.getElementById("arcBtn").addEventListener("click", () => this.setMode("arc"));
        document.getElementById("deleteBtn").addEventListener("click", () => this.deleteSelected());
        document.getElementById("plusTokenBtn").addEventListener("click", () => this.addToken());
        document.getElementById("minusTokenBtn").addEventListener("click", () => this.removeToken());
        document.getElementById("playPauseBtn").addEventListener("click", () => this.togglePlayPause());
        document.getElementById("resetBtn").addEventListener("click", () => this.resetTokens());
        document.getElementById("snapBtn").addEventListener("click", () => this.toggleSnap());
        document.getElementById("speedBtn").addEventListener("click", () => this.cycleSpeed());
        document.getElementById("saveBtn").addEventListener("click", () => this.saveDesign());
        document.getElementById("loadBtn").addEventListener("click", () => this.showLoadModal());
        document.getElementById("clearBtn").addEventListener("click", () => this.clearCanvas());
        document.getElementById("switchBtn").addEventListener("click", () => this.toggleModel());
        document.getElementById("guideBtn").addEventListener("click", () => this.showGuide());
        document.getElementById("annotateBtn").addEventListener("click", () => this.setMode("annotate"));
        document.getElementById("pnfnBtn").addEventListener("click", () => this.showPNFN());
        document.getElementById("mrpnBtn").addEventListener("click", () => this.showMRPN());

        document.getElementById("pnfnInsertBtn").addEventListener("click", () => this.insertPNFNAsNote());
        document.getElementById("pnfnRegenerateAllBtn").addEventListener("click", () => this.regeneratePNFN(true));
        document.getElementById("pnfnRegenerateM0Btn").addEventListener("click", () => this.regeneratePNFN(false));
        document.getElementById("mrpnInsertBtn").addEventListener("click", () => this.insertMRPNAsNote());
        document.getElementById("mrpnRegenerateAllBtn").addEventListener("click", () => this.regenerateMRPN(true));
        document.getElementById("mrpnRegenerateM0Btn").addEventListener("click", () => this.regenerateMRPN(false));
        document.getElementById("loadJsonBtn").addEventListener("click", () => this.loadJsonDesign());

        document.getElementById("zoomInBtn").addEventListener("click", () => this.zoomIn());
        document.getElementById("zoomOutBtn").addEventListener("click", () => this.zoomOut());

        window.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "z") this.undo();
            if (e.ctrlKey && e.shiftKey && e.key === "Z") this.redo();
            if (e.key === "Backspace" || e.key === "Delete") this.deleteSelected();
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                this.saveDesign();
            }
        });

        window.addEventListener("resize", () => this.resize());
        document.querySelectorAll(".close").forEach(close => close.onclick = () => close.parentElement.parentElement.style.display = "none");
    }

    renderLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        console.log("Rendering:", {
            places: this.places.length,
            transitions: this.transitions.length,
            arcs: this.arcs.length,
            initializers: this.initializers.length,
            animations: this.animations.length
        });

        this.arcs.forEach(arc => arc.draw(this.ctx, this.iconSize));
        if (this.drawingArc && this.arcStart && this.arcEnd) {
            this.ctx.strokeStyle = "green";
            this.ctx.beginPath();
            this.ctx.moveTo(this.arcStart.x, this.arcStart.y);
            this.ctx.lineTo(this.arcEnd.x, this.arcEnd.y);
            this.ctx.stroke();
        }
        this.places.forEach(place => place.draw(this.ctx, this.selectedElements.includes(place), this.iconSize, this.tokenSize));
        this.transitions.forEach(trans => trans.draw(this.ctx, this.selectedElements.includes(trans), this.iconSize));
        this.initializers.forEach(ini => ini.draw(this.ctx, this.selectedElements.includes(ini), this.iconSize));
        this.annotations.forEach(annot => annot.draw(this.ctx, this.selectedElements.includes(annot)));
        this.animations.forEach(anim => anim.draw(this.ctx, this.tokenSize));
        if (this.selectionArea) {
            this.ctx.fillStyle = "rgba(0, 120, 255, 0.2)";
            this.ctx.fillRect(this.selectionArea.x, this.selectionArea.y, this.selectionArea.width, this.selectionArea.height);
            this.ctx.strokeStyle = "rgba(0, 120, 255, 1)";
            this.ctx.strokeRect(this.selectionArea.x, this.selectionArea.y, this.selectionArea.width, this.selectionArea.height);
        }
        if (this.selected && this.selectedElements.length === 1) {
            this.drawProperties();
        }

        this.ctx.restore();
        if (this.autoRun) {
            const now = Date.now();
            if (now - this.lastStep >= this.stepDelay) {
                this.simulateStep();
                this.lastStep = now;
            }
            this.updateAnimations();
            this.generateTokensFromInitializers();
        }
        requestAnimationFrame(() => this.renderLoop());
    }

    drawProperties() {
        this.ctx.fillStyle = "black";
        this.ctx.font = "12px Helvetica Neue";
        let y = 10;
        if (this.selected instanceof Place) {
            const p = this.selected;
            this.ctx.fillText(`Name: ${p.name}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Tokens: ${p.tokens}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel && p.tokens > 0) {
                this.ctx.fillText(`Token Value: ${p.getTokenValue()}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
            }
        } else if (this.selected instanceof Transition) {
            const t = this.selected;
            this.ctx.fillText(`Name: ${t.name}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Inputs: ${t.inputArcs.length}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Outputs: ${t.outputArcs.length}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel) {
                this.ctx.fillText(`Task: ${t.task.task}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
            }
        } else if (this.selected instanceof Initializer) {
            const i = this.selected;
            this.ctx.fillText(`Name: ${i.name}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Tokens: ${i.tokensToGenerate}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel) {
                this.ctx.fillText(`Token Value: ${i.tokenValue}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            }
            this.ctx.fillText(`Rate: ${i.tokensPerSecond}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Continuous: ${i.isContinuous}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
        } else if (this.selected instanceof Annotation) {
            const a = this.selected;
            this.ctx.fillText(`Text: ${a.text}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Color: ${a.color}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Font: ${a.fontName} ${a.fontSize}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
        } else if (this.selected instanceof Arc) {
            const a = this.selected;
            this.ctx.fillText(`Arc Type: ${a.type}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (!this.isSmartModel) {
                this.ctx.fillText(`Weight: ${a.getWeight()}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
            }
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        console.log(`Mouse down at (${x}, ${y}) with mode: ${this.addMode}`);

        if (y < 0 || !this.designExists) return;

        const elem = this.getElementAt(x, y);
        const arc = this.getArcAt(x, y);
        const annotation = this.getAnnotationAt(x, y);

        if (this.addMode === "arc" && (elem instanceof Place || elem instanceof Transition || elem instanceof Initializer)) {
            this.arcStart = new Point(x, y);
            this.arcEnd = new Point(x, y);
            this.drawingArc = true;
            console.log("Started drawing arc");
        } else if (this.addMode === "select") {
            if (arc && (arc.type === "flexible" || arc.type === "90degree") && this.isNearControlPoint(x, y, arc)) {
                this.selected = arc;
                this.draggingControlPoint = true;
            } else if (annotation) {
                if (!e.ctrlKey) this.selectedElements = [];
                this.selectedElements.push(annotation);
                this.selected = annotation;
            } else if (arc) {
                if (!e.ctrlKey) this.selectedElements = [];
                this.selectedElements.push(arc);
                this.selected = arc;
            } else if (elem) {
                if (!this.selectedElements.includes(elem)) {
                    if (!e.ctrlKey) this.selectedElements = [];
                    this.selectedElements.push(elem);
                }
                this.selected = elem;
            } else {
                this.selected = null;
                this.selectionStart = new Point(x, y);
                this.selectionArea = { x, y, width: 0, height: 0 };
                if (!e.ctrlKey) this.selectedElements = [];
            }
        } else if (this.addMode === "place") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            this.places.push(new Place(`P${this.places.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added place at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "transition") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            this.transitions.push(new Transition(`T${this.transitions.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added transition at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "ini") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            this.initializers.push(new Initializer(`INI${this.initializers.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added initializer at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "annotate") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            const text = prompt("Enter annotation text:") || "Annotation";
            this.annotations.push(new Annotation(text.trim(), snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added annotation at (${snappedX}, ${snappedY})`);
        }
    }

    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        if (this.drawingArc && this.arcStart) {
            const start = this.getElementAt(this.arcStart.x, this.arcStart.y);
            const elem = this.getElementAt(x, y);
            if (start instanceof Place && elem instanceof Transition) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, true, this.arcType);
                this.arcs.push(arc);
                elem.inputArcs.push({ place: start, weight: 1 });
                this.designState.setUnsavedChanges();
                this.updateButtonStates();
                console.log("Added input arc");
            } else if (start instanceof Transition && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false, this.arcType);
                this.arcs.push(arc);
                start.outputArcs.push({ place: elem, weight: 1 });
                this.designState.setUnsavedChanges();
                this.updateButtonStates();
                console.log("Added output arc");
            } else if (start instanceof Initializer && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false, this.arcType);
                this.arcs.push(arc);
                start.outputPlace = elem;
                this.designState.setUnsavedChanges();
                this.updateButtonStates();
                console.log("Added initializer arc");
            }
            this.arcStart = null;
            this.arcEnd = null;
            this.drawingArc = false;
        } else if (this.addMode === "select" && this.selectionStart) {
            this.selectionArea = {
                x: Math.min(this.selectionStart.x, x),
                y: Math.min(this.selectionStart.y, y),
                width: Math.abs(x - this.selectionStart.x),
                height: Math.abs(y - this.selectionStart.y)
            };
            this.selectWithinArea();
            this.selectionStart = null;
            this.selectionArea = null;
        }
        this.draggingControlPoint = false;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        if (this.drawingArc && this.arcStart) {
            this.arcEnd = new Point(x, y);
        } else if (this.addMode === "select" && this.selectionStart) {
            this.selectionArea = {
                x: Math.min(this.selectionStart.x, x),
                y: Math.min(this.selectionStart.y, y),
                width: Math.abs(x - this.selectionStart.x),
                height: Math.abs(y - this.selectionStart.y)
            };
        } else if (this.addMode === "select" && this.selectedElements.length > 0 && e.buttons === 1) {
            this.saveStateToUndo();
            const ref = this.selectedElements[0];
            const dx = x - ref.x;
            const dy = y - ref.y;
            this.selectedElements.forEach(elem => {
                const snappedX = this.snappingEnabled ? Math.round((elem.x + dx) / 25) * 25 : elem.x + dx;
                const snappedY = this.snappingEnabled ? Math.round((elem.y + dy) / 25) * 25 : elem.y + dy;
                if (elem instanceof Arc && (elem.type === "flexible" || elem.type === "90degree") && this.draggingControlPoint) {
                    if (elem.type === "flexible") {
                        elem.controlPoints[0].x = snappedX;
                        elem.controlPoints[0].y = snappedY;
                    } else if (elem.type === "90degree") {
                        elem.controlPoints = [{ x: snappedX, y: elem.start.y }];
                    }
                } else {
                    elem.x = snappedX;
                    elem.y = snappedY;
                }
            });
            this.designState.setUnsavedChanges();
        }
    }

    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;
        const elem = this.getElementAt(x, y);
        const annotation = this.getAnnotationAt(x, y);
        const arc = this.getArcAt(x, y);

        if (this.addMode === "select") {
            if (annotation) {
                const newText = prompt("Enter new annotation text:", annotation.text);
                if (newText && newText.trim()) {
                    this.saveStateToUndo();
                    annotation.text = newText.trim();
                    this.designState.setUnsavedChanges();
                }
            } else if (elem) {
                const newName = prompt("Enter new name:", elem.name);
                if (newName && newName.trim()) {
                    this.saveStateToUndo();
                    elem.name = newName.trim();
                    this.designState.setUnsavedChanges();
                    console.log(`Renamed element to: ${newName}`);
                }
                if (elem instanceof Initializer) {
                    const tokens = prompt("Enter tokens to generate:", elem.tokensToGenerate) || elem.tokensToGenerate;
                    const rate = prompt("Enter rate (tokens/sec):", elem.tokensPerSecond) || elem.tokensPerSecond;
                    const continuous = confirm("Continuous?") ? "yes" : "no";
                    this.saveStateToUndo();
                    try {
                        elem.tokensToGenerate = parseInt(tokens);
                        if (this.isSmartModel) {
                            const value = prompt("Enter token value:", elem.tokenValue) || elem.tokenValue;
                            elem.tokenValue = parseFloat(value);
                        }
                        elem.tokensPerSecond = parseFloat(rate);
                        elem.isContinuous = continuous === "yes";
                        elem.tokensGenerated = 0;
                        elem.lastGenerationTime = Date.now();
                    } catch (ex) {
                        console.log("Invalid input for initializer settings");
                    }
                    this.designState.setUnsavedChanges();
                }
            } else if (arc && !this.isSmartModel) {
                const weight = prompt("Enter arc weight:", arc.getWeight()) || arc.getWeight();
                this.saveStateToUndo();
                try {
                    const w = parseInt(weight);
                    if (w > 0) {
                        arc.setWeight(w);
                        if (arc.isInput) {
                            arc.end.inputArcs.find(a => a.place === arc.start).weight = w;
                        } else {
                            arc.start.outputArcs.find(a => a.place === arc.end).weight = w;
                        }
                        console.log(`Set arc weight to: ${w}`);
                    }
                } catch (ex) {
                    console.log("Invalid weight input");
                }
                this.designState.setUnsavedChanges();
            } else if (arc && this.isSmartModel) {
                alert("Arc weights are not adjustable in S-Model.");
            }
        }
    }

    handleWheel(e) {
        e.preventDefault();
        if (e.deltaY < 0) this.zoomIn();
        else this.zoomOut();
    }

    newDesign() {
        if (this.designState.hasUnsavedChanges() && this.designState.hasDesign()) {
            if (!confirm("You have unsaved changes. Create a new design anyway?")) return;
        }
        this.saveStateToUndo();
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
        this.annotations = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.drawingArc = false;
        this.designExists = true;
        this.designState.newDesign("Untitled");
        this.updateTitle();
        this.updateButtonStates();
        console.log("New design created");
        alert("New design created");
    }

    setMode(mode) {
        this.addMode = mode;
        this.drawingArc = mode === "arc";
        document.querySelectorAll("#toolbar button").forEach(btn => btn.classList.remove("highlighted"));
        document.getElementById(`${mode}Btn`).classList.add("highlighted");
        console.log(`Mode set to: ${mode}`);
    }

    setArcType(type) {
        this.arcType = type;
        console.log("Arc type set to:", type);
    }

    deleteSelected() {
        if (this.addMode === "select" && this.selectedElements.length > 0) {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Arc) {
                    this.arcs = this.arcs.filter(a => a !== elem);
                    if (elem.isInput) {
                        elem.end.inputArcs = elem.end.inputArcs.filter(a => a.place !== elem.start);
                    } else {
                        elem.start.outputArcs = elem.start.outputArcs.filter(a => a.place !== elem.end);
                    }
                } else if (elem instanceof Place) {
                    this.places = this.places.filter(p => p !== elem);
                    this.arcs = this.arcs.filter(a => a.start !== elem && a.end !== elem);
                } else if (elem instanceof Transition) {
                    this.transitions = this.transitions.filter(t => t !== elem);
                    this.arcs = this.arcs.filter(a => a.start !== elem && a.end !== elem);
                } else if (elem instanceof Initializer) {
                    this.initializers = this.initializers.filter(i => i !== elem);
                    this.arcs = this.arcs.filter(a => a.start !== elem);
                } else if (elem instanceof Annotation) {
                    this.annotations = this.annotations.filter(a => a !== elem);
                }
            });
            this.selectedElements = [];
            this.selected = null;
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log("Selected elements deleted");
        }
    }

    addToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.addToken();
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log("Added tokens to selected places");
        }
    }

    removeToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.removeToken();
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log("Removed tokens from selected places");
        }
    }

    togglePlayPause() {
        this.autoRun = !this.autoRun;
        if (!this.autoRun) this.animations = [];
        document.getElementById("playPauseBtn").innerHTML = this.autoRun ?
            `<img src="assets/pause.png" alt="Pause">` :
            `<img src="assets/play.png" alt="Play">`;
        console.log("Play/Pause toggled to:", this.autoRun);
    }

    resetTokens() {
        this.saveStateToUndo();
        this.places.forEach(p => p.tokens = 0);
        this.transitions.forEach(t => t.active = false);
        this.initializers.forEach(i => {
            i.tokensGenerated = 0;
            i.lastGenerationTime = Date.now();
            i.isGenerating = false;
        });
        this.animations = [];
        this.autoRun = false;
        this.designState.setUnsavedChanges();
        this.updateButtonStates();
        console.log("Tokens reset");
    }

    toggleSnap() {
        this.snappingEnabled = !this.snappingEnabled;
        document.getElementById("snapBtn").classList.toggle("active", this.snappingEnabled);
        console.log("Snapping toggled to:", this.snappingEnabled);
    }

    cycleSpeed() {
        this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.speedOptions.length;
        this.animationSpeed = this.speedOptions[this.currentSpeedIndex];
        document.getElementById("speedLabel").textContent = `Speed: ${this.getSpeedLabel()}`;
        console.log("Speed cycled to:", this.animationSpeed);
    }

    getSpeedLabel() {
        return `${this.animationSpeed}x`;
    }

    saveDesign() {
        const design = Saver.save(this);
        const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = this.designState.currentFileName || "petriNetDesign.json";
        a.click();
        URL.revokeObjectURL(url);
        this.designState.saveDesign();
        this.updateTitle();
        console.log("Design saved");
    }

    showLoadModal() {
        const modal = document.getElementById("loadModal");
        modal.style.display = "block";
        document.getElementById("loadJsonText").value = "";
    }

    loadJsonDesign() {
        const jsonText = document.getElementById("loadJsonText").value;
        if (!jsonText) return;
        try {
            this.saveStateToUndo();
            Loader.load(this, JSON.parse(jsonText));
            this.designExists = true;
            this.designState.currentFileName = "Loaded Design";
            this.updateTitle();
            this.updateButtonStates();
            document.getElementById("loadModal").style.display = "none";
            console.log("Loaded design from JSON text");
            alert("Design loaded successfully");
        } catch (ex) {
            console.error("Failed to load design:", ex);
            alert("Error loading design. Check console for details.");
        }
    }

    clearCanvas() {
        if (!this.designExists) {
            alert("No design exists to clear.");
            return;
        }
        if (this.designState.hasUnsavedChanges() && !confirm("You have unsaved changes. Clear anyway?")) return;
        this.saveStateToUndo();
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
        this.annotations = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.drawingArc = false;
        this.designExists = false;
        this.designState.newDesign(null);
        this.updateTitle();
        this.updateButtonStates();
        console.log("Canvas cleared");
    }

    toggleModel() {
        this.isSmartModel = !this.isSmartModel;
        document.getElementById("switchBtn").classList.toggle("active", this.isSmartModel);
        document.getElementById("switchBtn").innerHTML = this.isSmartModel ?
            `<img src="assets/switch.png" alt="Switch">` :
            `<img src="assets/switch.png" alt="Switch">`;
        console.log("Model toggled to:", this.isSmartModel ? "S-Model" : "T-Model");
    }

    showGuide() {
        const modal = document.getElementById("guideModal");
        const guideText = document.getElementById("guideText");
        guideText.innerHTML = `
            <b>Smart Model (S-Model) Transition Tasks Guide:</b><br>
            - '+': Adds values of incoming tokens.<br>
            - '-': Subtracts second token value from first based on order.<br>
            - '*': Multiplies values of incoming tokens.<br>
            - '/': Divides first token value by second based on order.<br>
            - '!= <number>': Checks if token value is not equal to <number>.<br>
            - '== <number>': Checks if token value equals <number>.<br>
            - 'cp': Copies the token value to all output places.<br>
            - 'p <seconds>': Pauses token for <seconds> before forwarding.<br>
            - No task: Acts as a gate, forwards token as-is.<br><br>
            <b>Traditional Model (T-Model) Notes:</b><br>
            - Input arc weights: Number of tokens required to enable transition.<br>
            - Output arc weights: Number of tokens produced per firing to output places.<br>
        `;
        modal.style.display = "block";
        console.log("Guide modal opened");
    }

    showPNFN() {
        const modal = document.getElementById("pnfnModal");
        const pnfnText = document.getElementById("pnfnText");
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();
        let text = "";
        nets.forEach((net, i) => {
            text += `Net ${i + 1}:\n${net.toFormalNotation(this.isSmartModel)}\n\n`;
        });
        pnfnText.value = text;
        modal.style.display = "block";
        console.log("PN-FN modal opened");
    }

    showMRPN() {
        const modal = document.getElementById("mrpnModal");
        const tableContainer = document.getElementById("mrpnTableContainer");
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();

        tableContainer.innerHTML = "";
        nets.forEach((net, netIndex) => {
            const placeList = Array.from(net.places);
            const transitionList = Array.from(net.transitions);
            if (placeList.length === 0 || transitionList.length === 0) {
                tableContainer.innerHTML += `<p>Net ${netIndex + 1}: No design elements available.</p>`;
                return;
            }

            let inputTable = `<h3>Net ${netIndex + 1} - Input Matrix</h3><table><tr><th></th>`;
            transitionList.forEach(t => inputTable += `<th>${t.name}</th>`);
            inputTable += "</tr>";
            placeList.forEach(p => {
                inputTable += `<tr><td>${p.name}</td>`;
                transitionList.forEach(t => {
                    const weight = net.inputFunction.get(`${p.name},${t.name}`) || 0;
                    const value = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                    inputTable += `<td>[${value}]</td>`;
                });
                inputTable += "</tr>";
            });
            inputTable += "</table>";

            let outputTable = `<h3>Net ${netIndex + 1} - Output Matrix</h3><table><tr><th></th>`;
            transitionList.forEach(t => outputTable += `<th>${t.name}</th>`);
            outputTable += "</tr>";
            placeList.forEach(p => {
                outputTable += `<tr><td>${p.name}</td>`;
                transitionList.forEach(t => {
                    const weight = net.outputFunction.get(`${p.name},${t.name}`) || 0;
                    const value = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                    outputTable += `<td>[${value}]</td>`;
                });
                outputTable += "</tr>";
            });
            outputTable += "</table>";

            tableContainer.innerHTML += inputTable + outputTable;
        });

        modal.style.display = "block";
        console.log("MR-PN modal opened");
    }

    insertPNFNAsNote() {
        const pnfnText = document.getElementById("pnfnText").value;
        if (!pnfnText) return;
        this.saveStateToUndo();
        const { x, y } = this.findAnnotationPosition(pnfnText);
        this.annotations.push(new Annotation(pnfnText, x, y, "Times New Roman", 12));
        document.getElementById("pnfnModal").style.display = "none";
        this.designState.setUnsavedChanges();
        this.updateButtonStates();
        console.log("Inserted PN-FN as note");
    }

    insertMRPNAsNote() {
        const tableContainer = document.getElementById("mrpnTableContainer");
        const text = tableContainer.innerText;
        if (!text) return;
        this.saveStateToUndo();
        const { x, y } = this.findAnnotationPosition(text);
        this.annotations.push(new Annotation(text, x, y, "Times New Roman", 12));
        document.getElementById("mrpnModal").style.display = "none";
        this.designState.setUnsavedChanges();
        this.updateButtonStates();
        console.log("Inserted MR-PN as note");
    }

    regeneratePNFN(all) {
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();
        let text = "";
        nets.forEach((net, i) => {
            if (all) net.updateInitialMarking();
            text += `Net ${i + 1}:\n${net.toFormalNotation(this.isSmartModel)}\n\n`;
        });
        document.getElementById("pnfnText").value = text;
        console.log("Regenerated PNFN:", all ? "All" : "M0 only");
    }

    regenerateMRPN(all) {
        const tableContainer = document.getElementById("mrpnTableContainer");
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();

        tableContainer.innerHTML = "";
        nets.forEach((net, netIndex) => {
            if (all) net.updateInitialMarking();
            const placeList = Array.from(net.places);
            const transitionList = Array.from(net.transitions);
            if (placeList.length === 0 || transitionList.length === 0) {
                tableContainer.innerHTML += `<p>Net ${netIndex + 1}: No design elements available.</p>`;
                return;
            }

            let inputTable = `<h3>Net ${netIndex + 1} - Input Matrix</h3><table><tr><th></th>`;
            transitionList.forEach(t => inputTable += `<th>${t.name}</th>`);
            inputTable += "</tr>";
            placeList.forEach(p => {
                inputTable += `<tr><td>${p.name}</td>`;
                transitionList.forEach(t => {
                    const weight = net.inputFunction.get(`${p.name},${t.name}`) || 0;
                    const value = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                    inputTable += `<td>[${value}]</td>`;
                });
                inputTable += "</tr>";
            });
            inputTable += "</table>";

            let outputTable = `<h3>Net ${netIndex + 1} - Output Matrix</h3><table><tr><th></th>`;
            transitionList.forEach(t => outputTable += `<th>${t.name}</th>`);
            outputTable += "</tr>";
            placeList.forEach(p => {
                outputTable += `<tr><td>${p.name}</td>`;
                transitionList.forEach(t => {
                    const weight = net.outputFunction.get(`${p.name},${t.name}`) || 0;
                    const value = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                    outputTable += `<td>[${value}]</td>`;
                });
                outputTable += "</tr>";
            });
            outputTable += "</table>";

            tableContainer.innerHTML += inputTable + outputTable;
        });
        console.log("Regenerated MRPN:", all ? "All" : "M0 only");
    }

    findAnnotationPosition(text) {
        let maxX = 0, maxY = 0;
        this.places.forEach(p => { maxX = Math.max(maxX, p.x + 40); maxY = Math.max(maxY, p.y + 40); });
        this.transitions.forEach(t => { maxX = Math.max(maxX, t.x + 40); maxY = Math.max(maxY, t.y + 40); });
        this.initializers.forEach(i => { maxX = Math.max(maxX, i.x + 40); maxY = Math.max(maxY, i.y + 40); });
        this.annotations.forEach(a => {
            const width = this.ctx.measureText(a.text.split("\n")[0]).width;
            maxX = Math.max(maxX, a.x + width);
            maxY = Math.max(maxY, a.y + a.fontSize * a.text.split("\n").length);
        });

        let x = maxX + 20;
        let y = maxY / 2;
        const width = 200;
        const height = text.split("\n").length * 15;

        if (x + width > this.canvas.width / window.devicePixelRatio / this.zoomLevel || this.overlaps(x, y, width, height)) {
            x = maxX / 2;
            y = maxY + 20;
            if (y + height > this.canvas.height / window.devicePixelRatio / this.zoomLevel || this.overlaps(x, y, width, height)) {
                alert("No space available to insert annotation.");
                return { x: 0, y: 0 };
            }
        }
        return { x, y };
    }

    overlaps(x, y, width, height) {
        const rect = { x, y, width, height };
        return this.places.some(p => this.rectIntersects(rect, p.x - 20, p.y - 20, 40, 40)) ||
               this.transitions.some(t => this.rectIntersects(rect, t.x - 20, t.y - 20, 40, 40)) ||
               this.initializers.some(i => this.rectIntersects(rect, i.x - 20, i.y - 20, 40, 40)) ||
               this.annotations.some(a => {
                   const width = this.ctx.measureText(a.text.split("\n")[0]).width;
                   return this.rectIntersects(rect, a.x, a.y - a.fontSize, width, a.fontSize * a.text.split("\n").length);
               });
    }

    rectIntersects(r1, x, y, w, h) {
        return !(r1.x + r1.width < x || x + w < r1.x || r1.y + r1.height < y || y + h < r1.y);
    }

    zoomIn() {
        this.zoomLevel += 0.1;
        if (this.zoomLevel > 2.0) this.zoomLevel = 2.0;
        console.log("Zoomed in to:", this.zoomLevel);
    }

    zoomOut() {
        this.zoomLevel -= 0.1;
        if (this.zoomLevel < 0.5) this.zoomLevel = 0.5;
        console.log("Zoomed out to:", this.zoomLevel);
    }

    simulateStep() {
        const enabled = this.transitions.filter(t => this.isSmartModel ? t.isEnabledSmart() : t.isEnabled() && !t.active);
        if (enabled.length > 0) {
            const t = enabled[Math.floor(Math.random() * enabled.length)];
            if (this.isSmartModel) t.fireSmart(this.animations);
            else t.fire(this.animations);
            console.log("Simulated step, fired transition:", t.name);
        }
    }

    updateAnimations() {
        this.animations = this.animations.filter(anim => {
            anim.update();
            if (anim.isFinished()) {
                if (anim.toTransition && anim.sourcePlace) {
                    anim.sourcePlace.removeToken();
                    const t = this.getTransitionAt(anim.endX, anim.endY);
                    if (t) {
                        if (this.isSmartModel) t.completeFiringSmart(this.animations, anim.smartToken);
                        else t.completeFiring(this.animations);
                    }
                } else if (anim.targetPlace) {
                    anim.targetPlace.addToken();
                    if (this.isSmartModel && anim.smartToken) anim.targetPlace.setTokenValue(anim.smartToken.value);
                }
                return false;
            }
            return true;
        });
    }

    generateTokensFromInitializers() {
        if (!this.autoRun) return;
        const now = Date.now();
        this.initializers.forEach(ini => {
            if (ini.outputPlace && ini.tokensPerSecond > 0) {
                const timeSinceLast = now - ini.lastGenerationTime;
                const interval = 1000 / ini.tokensPerSecond;
                if (timeSinceLast >= interval) {
                    if (ini.isContinuous || ini.tokensGenerated < ini.tokensToGenerate) {
                        const anim = this.isSmartModel ?
                            new TokenAnimation(ini.x, ini.y, ini.outputPlace.x, ini.outputPlace.y, ini.outputPlace, null, new SmartToken(ini.tokenValue)) :
                            new TokenAnimation(ini.x, ini.y, ini.outputPlace.x, ini.outputPlace.y, ini.outputPlace);
                        this.animations.push(anim);
                        ini.tokensGenerated++;
                        ini.lastGenerationTime = now;
                        ini.isGenerating = true;
                        console.log(`Generated token from initializer ${ini.name}`);
                    } else {
                        ini.isGenerating = false;
                    }
                }
            }
        });
    }

    getElementAt(x, y) {
        for (const p of this.places) {
            if ((x - p.x) ** 2 + (y - p.y) ** 2 <= (this.iconSize / 2) ** 2) return p;
        }
        for (const t of this.transitions) {
            if (Math.abs(x - t.x) < this.iconSize / 2 && Math.abs(y - t.y) < this.iconSize / 2) return t;
        }
        for (const i of this.initializers) {
            if ((x - i.x) ** 2 + (y - i.y) ** 2 <= (this.iconSize / 2) ** 2) return i;
        }
        return null;
    }

    getArcAt(x, y) {
        for (const arc of this.arcs) {
            const startX = arc.start.x;
            const startY = arc.start.y;
            const endX = arc.end.x;
            const endY = arc.end.y;
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            if (Math.abs(x - midX) < 10 && Math.abs(y - midY) < 10) return arc;
        }
        return null;
    }

    getAnnotationAt(x, y) {
        for (const a of this.annotations) {
            const width = this.ctx.measureText(a.text).width;
            const height = a.fontSize;
            if (x >= a.x && x <= a.x + width && y >= a.y - height && y <= a.y) return a;
        }
        return null;
    }

    getTransitionAt(x, y) {
        return this.transitions.find(t => Math.abs(x - t.x) < this.iconSize / 2 && Math.abs(y - t.y) < this.iconSize / 2) || null;
    }

    isNearControlPoint(x, y, arc) {
        if (arc.type === "flexible") {
            const cp = arc.controlPoints[0];
            return Math.sqrt((x - cp.x) ** 2 + (y - cp.y) ** 2) < 10;
        } else if (arc.type === "90degree") {
            const cpX = arc.controlPoints[0].x;
            const cpY = arc.start.y;
            return Math.sqrt((x - cpX) ** 2 + (y - cpY) ** 2) < 10;
        }
        return false;
    }

    selectWithinArea() {
        this.places.forEach(p => {
            if (this.selectionArea.x <= p.x && p.x <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= p.y && p.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(p);
            }
        });
        this.transitions.forEach(t => {
            if (this.selectionArea.x <= t.x && t.x <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= t.y && t.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(t);
            }
        });
        this.initializers.forEach(i => {
            if (this.selectionArea.x <= i.x && i.x <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= i.y && i.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(i);
            }
        });
        this.arcs.forEach(a => {
            const startX = a.start.x;
            const startY = a.start.y;
            const endX = a.end.x;
            const endY = a.end.y;
            const line = { x1: startX, y1: startY, x2: endX, y2: endY };
            if (this.intersectsRectLine(this.selectionArea, line)) {
                this.selectedElements.push(a);
            }
        });
        this.annotations.forEach(a => {
            const width = this.ctx.measureText(a.text).width;
            const height = a.fontSize;
            if (this.selectionArea.x <= a.x && a.x + width <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= a.y - height && a.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(a);
            }
        });
        if (this.selectedElements.length === 1) this.selected = this.selectedElements[0];
        else this.selected = null;
        console.log("Selected elements:", this.selectedElements.length);
    }

    intersectsRectLine(rect, line) {
        const { x, y, width, height } = rect;
        const { x1, y1, x2, y2 } = line;
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        if (left > x + width || right < x || top > y + height || bottom < y) return false;

        const m = x1 === x2 ? Infinity : (y2 - y1) / (x2 - x1);
        const b = y1 - m * x1;
        const edges = [
            { x: x, y: y }, { x: x + width, y: y },
            { x: x + width, y: y + height }, { x: x, y: y + height }
        ];
        for (let i = 0; i < 4; i++) {
            const xEdge = edges[i].x;
            const yEdge = m === Infinity ? y1 : m * xEdge + b;
            if (yEdge >= Math.min(y, y + height) && yEdge <= Math.max(y, y + height) &&
                xEdge >= Math.min(x1, x2) && xEdge <= Math.max(x1, x2)) return true;
        }
        return false;
    }

    saveStateToUndo() {
        if (this.undoHistory.length >= this.maxHistorySize) this.undoHistory.shift();
        this.undoHistory.push({
            places: this.places.map(p => ({ ...p, smartToken: p.smartToken ? { value: p.smartToken.value } : null })),
            transitions: this.transitions.map(t => ({
                ...t,
                inputArcs: [...t.inputArcs],
                outputArcs: [...t.outputArcs],
                task: t.task ? { task: t.task.task } : null
            })),
            arcs: this.arcs.map(a => ({ ...a, type: a.type, controlPoints: a.controlPoints.map(cp => ({ ...cp })) })),
            initializers: this.initializers.map(i => ({ ...i })),
            annotations: this.annotations.map(a => ({ ...a })),
            selectedElements: [...this.selectedElements],
            isSmartModel: this.isSmartModel,
            autoRun: this.autoRun,
            addMode: this.addMode,
            drawingArc: this.drawingArc,
            arcStart: this.arcStart ? { ...this.arcStart } : null,
            arcEnd: this.arcEnd ? { ...this.arcEnd } : null,
            selectionArea: this.selectionArea ? { ...this.selectionArea } : null,
            selectionStart: this.selectionStart ? { ...this.selectionStart } : null,
            currentFileName: this.designState.currentFileName,
            designExists: this.designExists
        });
        this.redoHistory = [];
        console.log("State saved to undo history");
    }

    undo() {
        if (this.undoHistory.length > 0) {
            this.redoHistory.push(this.getCurrentState());
            this.restoreState(this.undoHistory.pop());
            this.updateTitle();
            this.updateButtonStates();
            console.log("Undo performed");
        }
    }

    redo() {
        if (this.redoHistory.length > 0) {
            this.undoHistory.push(this.getCurrentState());
            this.restoreState(this.redoHistory.pop());
            this.updateTitle();
            this.updateButtonStates();
            console.log("Redo performed");
        }
    }

    getCurrentState() {
        return {
            places: this.places.map(p => ({ ...p, smartToken: p.smartToken ? { value: p.smartToken.value } : null })),
            transitions: this.transitions.map(t => ({
                ...t,
                inputArcs: [...t.inputArcs],
                outputArcs: [...t.outputArcs],
                task: t.task ? { task: t.task.task } : null
            })),
            arcs: this.arcs.map(a => ({ ...a, type: a.type, controlPoints: a.controlPoints.map(cp => ({ ...cp })) })),
            initializers: this.initializers.map(i => ({ ...i })),
            annotations: this.annotations.map(a => ({ ...a })),
            selectedElements: [...this.selectedElements],
            isSmartModel: this.isSmartModel,
            autoRun: this.autoRun,
            addMode: this.addMode,
            drawingArc: this.drawingArc,
            arcStart: this.arcStart ? { ...this.arcStart } : null,
            arcEnd: this.arcEnd ? { ...this.arcEnd } : null,
            selectionArea: this.selectionArea ? { ...this.selectionArea } : null,
            selectionStart: this.selectionStart ? { ...this.selectionStart } : null,
            currentFileName: this.designState.currentFileName,
            designExists: this.designExists
        };
    }

    restoreState(state) {
        this.places = state.places.map(p => {
            const place = new Place(p.name, p.x, p.y, p.tokens);
            if (p.smartToken) place.smartToken = new SmartToken(p.smartToken.value);
            return place;
        });
        this.transitions = state.transitions.map(t => {
            const trans = new Transition(t.name, t.x, t.y);
            if (t.task) trans.task = new TransitionTask(t.task.task);
            return trans;
        });
        this.initializers = state.initializers.map(i => 
            new Initializer(i.name, i.x, i.y, i.tokensToGenerate, i.tokensPerSecond, i.isContinuous, i.tokenValue));
        this.arcs = state.arcs.map(a => {
            const start = a.start instanceof Place ? this.places[this.places.findIndex(p => p.name === a.start.name)] :
                          a.start instanceof Transition ? this.transitions[this.transitions.findIndex(t => t.name === a.start.name)] :
                          this.initializers[this.initializers.findIndex(i => i.name === a.start.name)];
            const end = a.end instanceof Place ? this.places[this.places.findIndex(p => p.name === a.end.name)] :
                        this.transitions[this.transitions.findIndex(t => t.name === a.end.name)];
            const arc = new Arc(start, end, a.isInput, a.type);
            arc.controlPoints = a.controlPoints.map(cp => ({ x: cp.x, y: cp.y }));
            arc.weight = a.weight || 1;
            return arc;
        });
        this.transitions.forEach((t, i) => {
            t.inputArcs = state.transitions[i].inputArcs.map(a => ({ 
                place: this.places[this.places.findIndex(p => p.name === a.place.name)], 
                weight: a.weight 
            }));
            t.outputArcs = state.transitions[i].outputArcs.map(a => ({ 
                place: this.places[this.places.findIndex(p => p.name === a.place.name)], 
                weight: a.weight 
            }));
        });
        this.initializers.forEach((i, idx) => {
            if (state.initializers[idx].outputPlace) {
                i.outputPlace = this.places[this.places.findIndex(p => p.name === state.initializers[idx].outputPlace.name)];
            }
        });
        this.annotations = state.annotations.map(a => 
            new Annotation(a.text, a.x, a.y, a.fontName, a.fontSize, a.color, a.strokeWeight));
        this.selectedElements = state.selectedElements.map(e => {
            if (e instanceof Place) return this.places.find(p => p.name === e.name);
            if (e instanceof Transition) return this.transitions.find(t => t.name === e.name);
            if (e instanceof Arc) return this.arcs.find(a => a.start.name === e.start.name && a.end.name === e.end.name && a.isInput === e.isInput);
            if (e instanceof Initializer) return this.initializers.find(i => i.name === e.name);
            if (e instanceof Annotation) return this.annotations.find(a => a.text === e.text && a.x === e.x && a.y === e.y);
            return e;
        });
        this.selected = this.selectedElements.length === 1 ? this.selectedElements[0] : null;
        this.isSmartModel = state.isSmartModel;
        this.autoRun = state.autoRun;
        this.addMode = state.addMode;
        this.drawingArc = state.drawingArc;
        this.arcStart = state.arcStart ? new Point(state.arcStart.x, state.arcStart.y) : null;
        this.arcEnd = state.arcEnd ? new Point(state.arcEnd.x, state.arcEnd.y) : null;
        this.selectionArea = state.selectionArea ? { ...state.selectionArea } : null;
        this.selectionStart = state.selectionStart ? new Point(state.selectionStart.x, state.selectionStart.y) : null;
        this.designState.currentFileName = state.currentFileName;
        this.designExists = state.designExists;
        console.log("State restored");
    }

    changeAnnotationColor(color) {
        if (this.addMode === "select" && this.selected instanceof Annotation) {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Annotation) elem.color = color;
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log("Annotation color changed to:", color);
        }
    }

    changeAnnotationFont(font, size) {
        if (this.addMode === "select" && this.selected instanceof Annotation) {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Annotation) {
                    elem.fontName = font;
                    elem.fontSize = size;
                }
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log("Annotation font changed to:", font, size);
        }
    }
    
    updateButtonStates() {
        const hasDesign = this.designExists && 
                         (this.places.length > 0 || this.transitions.length > 0 || 
                          this.arcs.length > 0 || this.initializers.length > 0 || 
                          this.annotations.length > 0);
        document.getElementById("deleteBtn").disabled = !hasDesign;
        document.getElementById("plusTokenBtn").disabled = !hasDesign;
        document.getElementById("minusTokenBtn").disabled = !hasDesign;
        document.getElementById("playPauseBtn").disabled = !hasDesign;
        document.getElementById("resetBtn").disabled = !hasDesign;
        document.getElementById("saveBtn").disabled = !hasDesign;
        document.getElementById("clearBtn").disabled = !hasDesign;
        document.getElementById("pnfnBtn").disabled = !hasDesign;
        document.getElementById("mrpnBtn").disabled = !hasDesign;
        document.getElementById("placeBtn").disabled = !this.designExists;
        document.getElementById("transitionBtn").disabled = !this.designExists;
        document.getElementById("iniBtn").disabled = !this.designExists;
        document.getElementById("arcBtn").disabled = !this.designExists;
        document.getElementById("annotateBtn").disabled = !this.designExists;
        console.log("Updated button states. Has design:", hasDesign, "Design exists:", this.designExists);
    }

    updateTitle() {
        document.title = `Petri Net Simulator - ${this.designState.currentFileName || "Untitled"}${this.designState.hasUnsavedChanges() ? " (unsaved changes *)" : " (saved)"}`;
    }
}

// Initialize the canvas after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    const canvas = new PetriNetCanvas();
    if (!canvas.canvas) {
        console.error("Failed to initialize PetriNetCanvas!");
    } else {
        console.log("PetriNetCanvas initialized successfully");
        window.canvas = canvas; // Expose globally for dropdowns and toolbar
    }
});