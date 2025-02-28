// DesignState class
class DesignState {
    constructor(canvas) {
        this.canvas = canvas;
        this.currentFileName = null;
        this.hasUnsavedChangesFlag = false;
    }

    newDesign(fileName) {
        this.currentFileName = fileName || "Untitled";
        this.hasUnsavedChangesFlag = false;
        this.canvas.updateTitle();
    }

    loadDesign(fileName) {
        this.currentFileName = fileName;
        this.hasUnsavedChangesFlag = false;
        this.canvas.updateTitle();
    }

    saveDesign() {
        this.hasUnsavedChangesFlag = false;
        this.canvas.updateTitle();
    }

    setUnsavedChanges() {
        this.hasUnsavedChangesFlag = true;
        this.canvas.updateTitle();
    }

    hasDesign() {
        return this.currentFileName !== null;
    }

    hasUnsavedChanges() {
        return this.hasUnsavedChangesFlag;
    }
}

// Saver class (adapted for browser)
class Saver {
    static save(canvas) {
        return {
            places: canvas.places.map(p => ({
                name: p.name,
                x: p.x,
                y: p.y,
                tokens: p.tokens,
                tokenValue: canvas.isSmartModel && p.tokens > 0 ? p.getTokenValue() : undefined
            })),
            transitions: canvas.transitions.map(t => ({
                name: t.name,
                x: t.x,
                y: t.y,
                inputArcs: t.inputArcs.map(a => ({ placeIdx: canvas.places.indexOf(a.place), weight: a.weight })),
                outputArcs: t.outputArcs.map(a => ({ placeIdx: canvas.places.indexOf(a.place), weight: a.weight })),
                task: canvas.isSmartModel ? t.task.task : undefined
            })),
            arcs: canvas.arcs.map(a => ({
                isInput: a.isInput,
                startIdx: a.start instanceof Place ? canvas.places.indexOf(a.start) :
                          a.start instanceof Transition ? canvas.transitions.indexOf(a.start) :
                          canvas.initializers.indexOf(a.start),
                endIdx: a.end instanceof Place ? canvas.places.indexOf(a.end) : canvas.transitions.indexOf(a.end),
                startType: a.start instanceof Place ? "place" : a.start instanceof Transition ? "transition" : "initializer",
                endType: a.end instanceof Place ? "place" : "transition"
            })),
            initializers: canvas.initializers.map(i => ({
                name: i.name,
                x: i.x,
                y: i.y,
                tokensToGenerate: i.tokensToGenerate,
                tokensPerSecond: i.tokensPerSecond,
                isContinuous: i.isContinuous,
                tokenValue: canvas.isSmartModel ? i.tokenValue : undefined,
                outputPlaceIdx: i.outputPlace ? canvas.places.indexOf(i.outputPlace) : -1
            })),
            annotations: canvas.annotations.map(a => ({
                text: a.text,
                x: a.x,
                y: a.y,
                fontName: a.fontName,
                fontSize: a.fontSize,
                color: a.color,
                strokeWeight: a.strokeWeight
            })),
            isSmartModel: canvas.isSmartModel
        };
    }
}

// Loader class (adapted for browser)
class Loader {
    static load(canvas, json) {
        canvas.places = [];
        canvas.transitions = [];
        canvas.arcs = [];
        canvas.initializers = [];
        canvas.annotations = [];
        canvas.selectedElements = [];
        canvas.selected = null;
        canvas.addMode = "select";
        canvas.drawingArc = false;
        canvas.arcStart = null;
        canvas.arcEnd = null;
        canvas.selectionArea = null;
        canvas.selectionStart = null;
        canvas.autoRun = false;
        canvas.animations = [];

        canvas.isSmartModel = json.isSmartModel || false;

        json.places.forEach(p => {
            const place = new Place(p.name, p.x, p.y, p.tokens);
            if (canvas.isSmartModel && p.tokenValue !== undefined && p.tokens > 0) {
                place.setTokenValue(p.tokenValue);
            }
            canvas.places.push(place);
        });

        json.initializers.forEach(i => {
            const ini = new Initializer(i.name, i.x, i.y, i.tokensToGenerate, i.tokensPerSecond, i.isContinuous, i.tokenValue || 0);
            ini.tokensGenerated = 0;
            ini.lastGenerationTime = Date.now();
            canvas.initializers.push(ini);
        });

        json.transitions.forEach(t => {
            const trans = new Transition(t.name, t.x, t.y);
            if (canvas.isSmartModel && t.task) trans.task = new TransitionTask(t.task);
            canvas.transitions.push(trans);
        });

        json.arcs.forEach(a => {
            const start = a.startType === "place" ? canvas.places[a.startIdx] :
                          a.startType === "transition" ? canvas.transitions[a.startIdx] :
                          canvas.initializers[a.startIdx];
            const end = a.endType === "place" ? canvas.places[a.endIdx] : canvas.transitions[a.endIdx];
            const arc = new Arc(start, end, a.isInput);
            canvas.arcs.push(arc);
            if (a.isInput && end instanceof Transition) {
                end.inputArcs.push({ place: start, weight: 1 });
            } else if (!a.isInput && start instanceof Transition) {
                start.outputArcs.push({ place: end, weight: 1 });
            } else if (!a.isInput && start instanceof Initializer) {
                start.outputPlace = end;
            }
        });

        json.transitions.forEach((t, i) => {
            const trans = canvas.transitions[i];
            trans.inputArcs = t.inputArcs.map(a => ({ place: canvas.places[a.placeIdx], weight: a.weight }));
            trans.outputArcs = t.outputArcs.map(a => ({ place: canvas.places[a.placeIdx], weight: a.weight }));
        });

        json.annotations.forEach(a => {
            canvas.annotations.push(new Annotation(a.text, a.x, a.y, a.fontName, a.fontSize, a.color, a.strokeWeight));
        });

        canvas.designState.loadDesign(canvas.designState.currentFileName || "Loaded Design");
    }
}

// NetAnalyzer class
class NetAnalyzer {
    constructor(canvas) {
        this.canvas = canvas;
    }

    analyze() {
        const nets = [];
        const elementToNet = new Map();
        const visited = new Set();

        this.canvas.arcs.forEach(arc => {
            const startNet = elementToNet.get(arc.start);
            const endNet = elementToNet.get(arc.end);

            if (startNet && endNet && startNet !== endNet) {
                this.mergeNets(startNet, endNet, nets, elementToNet);
                elementToNet.set(arc.end, startNet);
            } else {
                const net = startNet || endNet || new PetriNet();
                if (!nets.includes(net)) nets.push(net);
                elementToNet.set(arc.start, net);
                elementToNet.set(arc.end, net);
            }

            const net = elementToNet.get(arc.start);
            if (arc.start instanceof Place && arc.end instanceof Transition) {
                net.addPlace(arc.start);
                net.addTransition(arc.end);
                net.addInputArc(arc.start, arc.end, arc.getWeight());
            } else if (arc.start instanceof Transition && arc.end instanceof Place) {
                net.addTransition(arc.start);
                net.addPlace(arc.end);
                net.addOutputArc(arc.end, arc.start, arc.getWeight());
            }
            visited.add(arc.start);
            visited.add(arc.end);
        });

        const mainNet = nets.length === 0 ? new PetriNet() : nets[0];
        let hasUnconnected = false;

        this.canvas.places.forEach(p => {
            if (!visited.has(p)) {
                mainNet.addPlace(p);
                elementToNet.set(p, mainNet);
                hasUnconnected = true;
            }
        });
        this.canvas.transitions.forEach(t => {
            if (!visited.has(t)) {
                mainNet.addTransition(t);
                elementToNet.set(t, mainNet);
                hasUnconnected = true;
            }
        });

        if (hasUnconnected && !nets.includes(mainNet)) nets.push(mainNet);
        if (nets.length === 0 && (this.canvas.places.length > 0 || this.canvas.transitions.length > 0)) nets.push(mainNet);

        return nets;
    }

    mergeNets(net1, net2, nets, elementToNet) {
        net2.places.forEach(p => net1.addPlace(p));
        net2.transitions.forEach(t => net1.addTransition(t));
        net2.inputFunction.forEach((weight, key) => {
            const [placeName, transName] = key.split(",");
            net1.addInputArc(this.getPlaceByName(placeName), this.getTransitionByName(transName), weight);
        });
        net2.outputFunction.forEach((weight, key) => {
            const [placeName, transName] = key.split(",");
            net1.addOutputArc(this.getPlaceByName(placeName), this.getTransitionByName(transName), weight);
        });
        nets.splice(nets.indexOf(net2), 1);

        this.canvas.places.forEach(p => {
            if (elementToNet.get(p) === net2) elementToNet.set(p, net1);
        });
        this.canvas.transitions.forEach(t => {
            if (elementToNet.get(t) === net2) elementToNet.set(t, net1);
        });
    }

    getPlaceByName(name) {
        return this.canvas.places.find(p => p.name === name) || null;
    }

    getTransitionByName(name) {
        return this.canvas.transitions.find(t => t.name === name) || null;
    }
}

// PetriNet class
class PetriNet {
    constructor() {
        this.places = new Set();
        this.transitions = new Set();
        this.inputFunction = new Map();
        this.outputFunction = new Map();
        this.initialMarking = new Map();
        this.canvas = document.getElementById("petriCanvas");
        if (!this.canvas) {
            console.error("Canvas element not found!");
            return;
        }
        this.ctx = this.canvas.getContext("2d");
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
        this.speedOptions = [0.5, 1.0, 1.5, 2.0];
        this.currentSpeedIndex = 1;
        this.snappingEnabled = false;
        this.zoomLevel = 1.0;
        this.isSmartModel = false;
        this.designState = new DesignState(this);

        this.iconSize = 32;
        this.tokenSize = 8;
        this.stepDelay = 500;
        this.animationSpeedBase = 0.05;
        this.snapGridSize = 25;

        this.icons = {};
        this.undoHistory = [];
        this.redoHistory = [];
        this.maxHistorySize = 10;

        this.resize();
        this.loadIcons();
        this.initEventListeners();
        this.renderLoop();
    }

    addPlace(p) {
        this.places.add(p);
        this.initialMarking.set(p, p.tokens);
    }

    addTransition(t) {
        this.transitions.add(t);
    }

    addInputArc(p, t, weight) {
        this.inputFunction.set(`${p.name},${t.name}`, weight);
    }

    addOutputArc(p, t, weight) {
        this.outputFunction.set(`${p.name},${t.name}`, weight);
    }

    updateInitialMarking() {
        this.initialMarking.clear();
        this.places.forEach(p => this.initialMarking.set(p, p.tokens));
    }

    toFormalNotation(isSmartModel) {
        let sb = "PN = {P, T, I, O, M₀}\n";

        sb += "P = {";
        sb += Array.from(this.places).map(p => p.name).join(", ");
        sb += "}\n\n";

        sb += "T = {";
        sb += Array.from(this.transitions).map(t => t.name).join(", ");
        sb += "}\n\n";

        this.inputFunction.forEach((value, key) => {
            const [place, trans] = key.split(",");
            sb += `I(${place}, ${trans}) = ${isSmartModel ? 1 : value}\n`;
        });
        if (this.inputFunction.size > 0) sb += "\n";

        this.outputFunction.forEach((value, key) => {
            const [place, trans] = key.split(",");
            sb += `O(${place}, ${trans}) = ${isSmartModel ? 1 : value}\n`;
        });
        if (this.outputFunction.size > 0) sb += "\n";

        const markingValues = Array.from(this.initialMarking.values());
        const rows = markingValues.length;
        sb += "M₀ =\n";
        if (rows === 0) {
            sb += "    |  |\n";
        } else {
            markingValues.forEach(val => {
                sb += `    | ${val.toString().padStart(2)} |\n`;
            });
        }

        return sb;
    }
}

// PetriNetCanvas class
class PetriNetCanvas {
    constructor() {
        this.canvas = document.getElementById("petriCanvas");
        if (!this.canvas) {
            console.error("Canvas element not found!");
            return;
        }
        this.ctx = this.canvas.getContext("2d");
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
        this.speedOptions = [0.5, 1.0, 1.5, 2.0];
        this.currentSpeedIndex = 1;
        this.snappingEnabled = false;
        this.zoomLevel = 1.0;
        this.isSmartModel = false;
        this.designState = new DesignState(this);

        this.iconSize = 32;
        this.tokenSize = 8;
        this.stepDelay = 500;
        this.animationSpeedBase = 0.05;
        this.snapGridSize = 25;

        this.icons = {};
        this.undoHistory = [];
        this.redoHistory = [];
        this.maxHistorySize = 10;

        this.resize();
        this.loadIcons();
        this.initEventListeners();
        this.updateButtonStates(); // Initial button state update
        this.renderLoop();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = (window.innerWidth - 50) * dpr;
        this.canvas.height = (window.innerHeight - 60) * dpr;
        this.canvas.style.width = `${window.innerWidth - 50}px`;
        this.canvas.style.height = `${window.innerHeight - 60}px`;
        this.ctx.scale(dpr, dpr);
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
            this.icons[name].onload = () => console.log(`Loaded icon: ${name}`);
            this.icons[name].onerror = () => console.error(`Failed to load icon: ${name}`);
        });
    }

    initEventListeners() {
        this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
        this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
        this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        this.canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e));

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
        document.getElementById("loadBtn").addEventListener("click", () => this.loadDesign());
        document.getElementById("clearBtn").addEventListener("click", () => this.clearCanvas());
        document.getElementById("switchBtn").addEventListener("click", () => this.toggleModel());
        document.getElementById("guideBtn").addEventListener("click", () => this.showGuide());
        document.getElementById("annotateBtn").addEventListener("click", () => this.setMode("annotate"));
        document.getElementById("colorBtn").addEventListener("click", () => this.changeAnnotationColor());
        document.getElementById("fontBtn").addEventListener("click", () => this.changeAnnotationFont());
        document.getElementById("pnfnBtn").addEventListener("click", () => this.showPNFN());
        document.getElementById("mrpnBtn").addEventListener("click", () => this.showMRPN());

        document.getElementById("pnfnInsertBtn").addEventListener("click", () => this.insertPNFNAsNote());
        document.getElementById("mrpnInsertBtn").addEventListener("click", () => this.insertMRPNAsNote());

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
    }

    renderLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

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
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        console.log(`Mouse down at (${x}, ${y}) with mode: ${this.addMode}`); // Debug log

        if (y < 0) return;

        const elem = this.getElementAt(x, y);
        const arc = this.getArcAt(x, y);
        const annotation = this.getAnnotationAt(x, y);
        if (this.addMode === "arc" && (elem instanceof Place || elem instanceof Transition || elem instanceof Initializer)) {
            this.arcStart = new Point(x, y);
            this.arcEnd = new Point(x, y);
            this.drawingArc = true;
            console.log("Started drawing arc");
        } else if (this.addMode === "select") {
            if (annotation) {
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
            const snappedX = this.snappingEnabled ? Math.round(x / this.snapGridSize) * this.snapGridSize : x;
            const snappedY = this.snappingEnabled ? Math.round(y / this.snapGridSize) * this.snapGridSize : y;
            this.places.push(new Place(`P${this.places.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added place at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "transition") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / this.snapGridSize) * this.snapGridSize : x;
            const snappedY = this.snappingEnabled ? Math.round(y / this.snapGridSize) * this.snapGridSize : y;
            this.transitions.push(new Transition(`T${this.transitions.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added transition at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "ini") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / this.snapGridSize) * this.snapGridSize : x;
            const snappedY = this.snappingEnabled ? Math.round(y / this.snapGridSize) * this.snapGridSize : y;
            this.initializers.push(new Initializer(`INI${this.initializers.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added initializer at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "annotate") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / this.snapGridSize) * this.snapGridSize : x;
            const snappedY = this.snappingEnabled ? Math.round(y / this.snapGridSize) * this.snapGridSize : y;
            const text = prompt("Enter annotation text:");
            if (text && text.trim()) {
                this.annotations.push(new Annotation(text.trim(), snappedX, snappedY));
                this.designState.setUnsavedChanges();
                this.updateButtonStates();
                console.log(`Added annotation at (${snappedX}, ${snappedY})`);
            }
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
                const arc = new Arc(start, elem, true);
                this.arcs.push(arc);
                elem.inputArcs.push({ place: start, weight: 1 });
                this.designState.setUnsavedChanges();
            } else if (start instanceof Transition && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false);
                this.arcs.push(arc);
                start.outputArcs.push({ place: elem, weight: 1 });
                this.designState.setUnsavedChanges();
            } else if (start instanceof Initializer && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false);
                this.arcs.push(arc);
                start.outputPlace = elem;
                this.designState.setUnsavedChanges();
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
                const snappedX = this.snappingEnabled ? Math.round((elem.x + dx) / this.snapGridSize) * this.snapGridSize : elem.x + dx;
                const snappedY = this.snappingEnabled ? Math.round((elem.y + dy) / this.snapGridSize) * this.snapGridSize : elem.y + dy;
                elem.x = snappedX;
                elem.y = snappedY;
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
        if (this.addMode === "select") {
            if (annotation) {
                const newText = prompt("Enter new annotation text:", annotation.text);
                if (newText && newText.trim()) {
                    this.saveStateToUndo();
                    annotation.text = newText.trim();
                    this.designState.setUnsavedChanges();
                }
            } else if (elem instanceof Place && this.isSmartModel && elem.tokens > 0) {
                const name = prompt("Enter new name:", elem.name) || elem.name;
                const value = prompt("Enter token value:", elem.getTokenValue()) || elem.getTokenValue();
                this.saveStateToUndo();
                elem.name = name.trim();
                try {
                    elem.setTokenValue(parseFloat(value));
                } catch (ex) {
                    console.log("Invalid token value input");
                }
                this.designState.setUnsavedChanges();
            } else if (elem instanceof Transition && this.isSmartModel) {
                const name = prompt("Enter new name:", elem.name) || elem.name;
                const task = prompt("Enter task (+, -, *, /, !=num, ==num, cp, p sec):", elem.task.task) || elem.task.task;
                this.saveStateToUndo();
                elem.name = name.trim();
                elem.task = new TransitionTask(task);
                this.designState.setUnsavedChanges();
            } else if (elem instanceof Initializer) {
                if (this.isSmartModel) {
                    const name = prompt("Enter new name:", elem.name) || elem.name;
                    const tokens = prompt("Enter tokens to generate:", elem.tokensToGenerate) || elem.tokensToGenerate;
                    const value = prompt("Enter token value:", elem.tokenValue) || elem.tokenValue;
                    const rate = prompt("Enter rate (tokens/sec):", elem.tokensPerSecond) || elem.tokensPerSecond;
                    const continuous = confirm("Continuous?") ? "yes" : "no";
                    this.saveStateToUndo();
                    elem.name = name.trim();
                    try {
                        elem.tokensToGenerate = parseInt(tokens);
                        elem.tokenValue = parseFloat(value);
                        elem.tokensPerSecond = parseFloat(rate);
                        elem.isContinuous = continuous === "yes";
                        elem.tokensGenerated = 0;
                        elem.lastGenerationTime = Date.now();
                    } catch (ex) {
                        console.log("Invalid input for initializer settings");
                    }
                    this.designState.setUnsavedChanges();
                } else {
                    const name = prompt("Enter new name:", elem.name) || elem.name;
                    const tokens = prompt("Enter tokens to generate:", elem.tokensToGenerate) || elem.tokensToGenerate;
                    const rate = prompt("Enter rate (tokens/sec):", elem.tokensPerSecond) || elem.tokensPerSecond;
                    const continuous = confirm("Continuous?") ? "yes" : "no";
                    this.saveStateToUndo();
                    elem.name = name.trim();
                    try {
                        elem.tokensToGenerate = parseInt(tokens);
                        elem.tokensPerSecond = parseFloat(rate);
                        elem.isContinuous = continuous === "yes";
                        elem.tokensGenerated = 0;
                        elem.lastGenerationTime = Date.now();
                    } catch (ex) {
                        console.log("Invalid input for initializer settings");
                    }
                    this.designState.setUnsavedChanges();
                }
            } else if (!this.isSmartModel) {
                const arc = this.getArcAt(x, y);
                if (arc) {
                    if (arc.isInput) {
                        const weight = prompt("Enter input arc weight:", arc.getWeight()) || arc.getWeight();
                        this.saveStateToUndo();
                        try {
                            const w = parseInt(weight);
                            if (w > 0) arc.end.inputArcs.find(a => a.place === arc.start).weight = w;
                        } catch (ex) {
                            console.log("Invalid weight input");
                        }
                        this.designState.setUnsavedChanges();
                    } else {
                        const weight = prompt("Enter output arc weight:", arc.getWeight()) || arc.getWeight();
                        this.saveStateToUndo();
                        try {
                            const w = parseInt(weight);
                            if (w > 0) arc.start.outputArcs.find(a => a.place === arc.end).weight = w;
                        } catch (ex) {
                            console.log("Invalid weight input");
                        }
                        this.designState.setUnsavedChanges();
                    }
                } else if (elem) {
                    const newName = prompt("Enter new name:", elem.name) || elem.name;
                    this.saveStateToUndo();
                    elem.name = newName.trim();
                    this.designState.setUnsavedChanges();
                }
            }
        }
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
        this.designState.newDesign("Untitled");
        this.updateTitle();
        this.updateButtonStates();
        console.log("New design created");
        alert("New design created"); // Visual feedback
    }

    setMode(mode) {
        this.addMode = mode;
        this.drawingArc = mode === "arc";
        document.querySelectorAll("#toolbar button").forEach(btn => btn.classList.remove("highlighted"));
        document.getElementById(`${mode}Btn`).classList.add("highlighted");
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
        }
    }

    addToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.addToken();
            });
            this.designState.setUnsavedChanges();
        }
    }

    removeToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.removeToken();
            });
            this.designState.setUnsavedChanges();
        }
    }

    togglePlayPause() {
        this.autoRun = !this.autoRun;
        if (!this.autoRun) this.animations = [];
        document.getElementById("playPauseBtn").innerHTML = this.autoRun ?
            `<img src="assets/pause.png" alt="Pause">` :
            `<img src="assets/play.png" alt="Play">`;
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
    }

    toggleSnap() {
        this.snappingEnabled = !this.snappingEnabled;
        document.getElementById("snapBtn").classList.toggle("active", this.snappingEnabled);
    }

    cycleSpeed() {
        this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.speedOptions.length;
        this.animationSpeed = this.speedOptions[this.currentSpeedIndex];
        document.getElementById("speedLabel").textContent = `Speed: ${this.getSpeedLabel()}`;
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
    }

    loadDesign() {
        if (this.designState.hasUnsavedChanges() && this.designState.hasDesign()) {
            if (!confirm("You have unsaved changes. Load a new design anyway?")) return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    this.saveStateToUndo();
                    Loader.load(this, JSON.parse(event.target.result));
                    this.designState.currentFileName = file.name;
                    this.updateTitle();
                    this.updateButtonStates();
                    console.log(`Loaded design from ${file.name}`);
                    alert(`Loaded design: ${file.name}`);
                } catch (ex) {
                    console.error("Failed to load design:", ex);
                    alert("Error loading design. Check console for details.");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    updateButtonStates() {
        const hasDesign = this.designState.hasDesign() && 
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
        console.log("Updated button states. Has design:", hasDesign);
    }
    clearCanvas() {
        if (!this.designState.hasDesign()) {
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
        this.designState.setUnsavedChanges();
    }

    toggleModel() {
        this.isSmartModel = !this.isSmartModel;
        document.getElementById("switchBtn").innerHTML = this.isSmartModel ?
            `<img src="assets/switch.png" alt="Switch">` :
            `<img src="assets/switch.png" alt="Switch">`;
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
        document.querySelectorAll(".close").forEach(close => close.onclick = () => modal.style.display = "none");
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
        document.querySelectorAll(".close").forEach(close => close.onclick = () => modal.style.display = "none");
    }

    showMRPN() {
        const modal = document.getElementById("mrpnModal");
        const mrpnText = document.getElementById("mrpnText");
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();
        let text = "";
        nets.forEach((net, netIndex) => {
            const placeList = Array.from(net.places);
            const transitionList = Array.from(net.transitions);
            if (placeList.length === 0 || transitionList.length === 0) {
                text += `Net ${netIndex + 1}: No design elements available.\n\n`;
                return;
            }

            text += `Net ${netIndex + 1}:\nInput Matrix:\n        `;
            transitionList.forEach(t => text += `${t.name.padEnd(6)}`);
            text += "\n";
            placeList.forEach(p => {
                text += `${p.name.padEnd(6)}| `;
                transitionList.forEach(t => {
                    const weight = net.inputFunction.get(`${p.name},${t.name}`) || 0;
                    const value = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                    text += `${value.toString().padEnd(6)}`;
                });
                text += " |\n";
            });
            text += "\nOutput Matrix:\n        ";
            transitionList.forEach(t => text += `${t.name.padEnd(6)}`);
            text += "\n";
            placeList.forEach(p => {
                text += `${p.name.padEnd(6)}| `;
                transitionList.forEach(t => {
                    const weight = net.outputFunction.get(`${p.name},${t.name}`) || 0;
                    const value = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                    text += `${value.toString().padEnd(6)}`;
                });
                text += " |\n";
            });
            text += "\n";
        });
        mrpnText.value = text;
        modal.style.display = "block";
        document.querySelectorAll(".close").forEach(close => close.onclick = () => modal.style.display = "none");
    }

    insertPNFNAsNote() {
        const pnfnText = document.getElementById("pnfnText").value;
        if (!pnfnText) return;
        this.saveStateToUndo();
        const { x, y } = this.findAnnotationPosition(pnfnText);
        this.annotations.push(new Annotation(pnfnText, x, y, "Times New Roman", 12));
        document.getElementById("pnfnModal").style.display = "none";
        this.designState.setUnsavedChanges();
    }

    insertMRPNAsNote() {
        const mrpnText = document.getElementById("mrpnText").value;
        if (!mrpnText) return;
        this.saveStateToUndo();
        const { x, y } = this.findAnnotationPosition(mrpnText);
        this.annotations.push(new Annotation(mrpnText, x, y, "Times New Roman", 12));
        document.getElementById("mrpnModal").style.display = "none";
        this.designState.setUnsavedChanges();
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
    }

    zoomOut() {
        this.zoomLevel -= 0.1;
        if (this.zoomLevel < 0.5) this.zoomLevel = 0.5;
    }

    simulateStep() {
        const enabled = this.transitions.filter(t => this.isSmartModel ? t.isEnabledSmart() : t.isEnabled() && !t.active);
        if (enabled.length > 0) {
            const t = enabled[Math.floor(Math.random() * enabled.length)];
            if (this.isSmartModel) t.fireSmart(this.animations);
            else t.fire(this.animations);
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
            arcs: this.arcs.map(a => ({ ...a })),
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
            currentFileName: this.designState.currentFileName
        });
        this.redoHistory = [];
    }

    undo() {
        if (this.undoHistory.length > 0) {
            this.redoHistory.push(this.getCurrentState());
            this.restoreState(this.undoHistory.pop());
            this.updateTitle();
        }
    }

    redo() {
        if (this.redoHistory.length > 0) {
            this.undoHistory.push(this.getCurrentState());
            this.restoreState(this.redoHistory.pop());
            this.updateTitle();
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
            arcs: this.arcs.map(a => ({ ...a })),
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
            currentFileName: this.designState.currentFileName
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
        this.initializers = state.initializers.map(i => new Initializer(i.name, i.x, i.y, i.tokensToGenerate, i.tokensPerSecond, i.isContinuous, i.tokenValue));
        this.arcs = state.arcs.map(a => {
            const start = a.start instanceof Place ? this.places[this.places.findIndex(p => p.name === a.start.name)] :
                          a.start instanceof Transition ? this.transitions[this.transitions.findIndex(t => t.name === a.start.name)] :
                          this.initializers[this.initializers.findIndex(i => i.name === a.start.name)];
            const end = a.end instanceof Place ? this.places[this.places.findIndex(p => p.name === a.end.name)] :
                        this.transitions[this.transitions.findIndex(t => t.name === a.end.name)];
            return new Arc(start, end, a.isInput);
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
        this.annotations = state.annotations.map(a => new Annotation(a.text, a.x, a.y, a.fontName, a.fontSize, a.color, a.strokeWeight));
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
    }

    changeAnnotationColor() {
        if (this.addMode === "select" && this.selected instanceof Annotation) {
            this.saveStateToUndo();
            const color = prompt("Enter color (e.g., red, #FF0000):", this.selected.color);
            if (color) {
                this.selectedElements.forEach(elem => {
                    if (elem instanceof Annotation) elem.color = color;
                });
                this.designState.setUnsavedChanges();
            }
        }
    }

    changeAnnotationFont() {
        if (this.addMode === "select" && this.selected instanceof Annotation) {
            this.saveStateToUndo();
            const fonts = ["Arial", "Times New Roman", "Courier New", "Verdana", "Helvetica"];
            const fontName = prompt("Enter font name (" + fonts.join(", ") + "):", this.selected.fontName) || this.selected.fontName;
            const fontSize = prompt("Enter font size:", this.selected.fontSize) || this.selected.fontSize;
            this.selectedElements.forEach(elem => {
                if (elem instanceof Annotation) {
                    elem.fontName = fonts.includes(fontName) ? fontName : elem.fontName;
                    try {
                        elem.fontSize = parseInt(fontSize);
                    } catch (ex) {
                        console.log("Invalid font size input");
                    }
                }
            });
            this.designState.setUnsavedChanges();
        }
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
    }
});
