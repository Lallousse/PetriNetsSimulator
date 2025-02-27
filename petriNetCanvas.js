// PetriNetCanvas class
class PetriNetCanvas {
    constructor() {
        this.canvas = document.getElementById("petriCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.places = [];
        this.transitions = [];
        this.arcs = [];
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

        this.iconSize = 30;
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

    resize() {
        this.canvas.width = window.innerWidth - 40;
        this.canvas.height = window.innerHeight - 100;
    }

    loadIcons() {
        const iconNames = [
            "new", "place", "transition", "delete", "plus", "minus", "play", "pause",
            "save", "load", "arc", "reset", "speed", "select", "snap", "zin", "zout",
            "clear", "switch", "guide"
        ];
        iconNames.forEach(name => {
            this.icons[name] = new Image();
            this.icons[name].src = `assets/${name}.png`;
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
        this.ctx.translate(0, 0);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        this.arcs.forEach(arc => arc.draw(this.ctx));
        if (this.drawingArc && this.arcStart && this.arcEnd) {
            this.ctx.strokeStyle = "green";
            this.ctx.beginPath();
            this.ctx.moveTo(this.arcStart.x, this.arcStart.y);
            this.ctx.lineTo(this.arcEnd.x, this.arcEnd.y);
            this.ctx.stroke();
        }
        this.places.forEach(place => place.draw(this.ctx, this.selectedElements.includes(place)));
        this.transitions.forEach(trans => trans.draw(this.ctx, this.selectedElements.includes(trans)));
        this.animations.forEach(anim => anim.draw(this.ctx));
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
        }
        requestAnimationFrame(() => this.renderLoop());
    }

    drawProperties() {
        this.ctx.fillStyle = "black";
        this.ctx.font = "12px Helvetica Neue";
        let y = 10;
        if (this.selected instanceof Place) {
            const p = this.selected;
            this.ctx.fillText(`Name: ${p.name}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Tokens: ${p.tokens}`, (this.canvas.width - 190) / this.zoomLevel, y);
        } else if (this.selected instanceof Transition) {
            const t = this.selected;
            this.ctx.fillText(`Name: ${t.name}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Inputs: ${t.inputArcs.length}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Outputs: ${t.outputArcs.length}`, (this.canvas.width - 190) / this.zoomLevel, y);
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        if (y < 0) return; // Ignore clicks in toolbar/zoom panel

        const elem = this.getElementAt(x, y);
        const arc = this.getArcAt(x, y);
        if (this.addMode === "arc" && (elem instanceof Place || elem instanceof Transition)) {
            this.arcStart = { x, y };
            this.arcEnd = { x, y };
            this.drawingArc = true;
        } else if (this.addMode === "select") {
            if (arc) {
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
                this.selectionStart = { x, y };
                this.selectionArea = { x, y, width: 0, height: 0 };
                if (!e.ctrlKey) this.selectedElements = [];
            }
        } else if (this.addMode === "place") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / this.snapGridSize) * this.snapGridSize : x;
            const snappedY = this.snappingEnabled ? Math.round(y / this.snapGridSize) * this.snapGridSize : y;
            this.places.push(new Place(`P${this.places.length + 1}`, snappedX, snappedY));
        } else if (this.addMode === "transition") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / this.snapGridSize) * this.snapGridSize : x;
            const snappedY = this.snappingEnabled ? Math.round(y / this.snapGridSize) * this.snapGridSize : y;
            this.transitions.push(new Transition(`T${this.transitions.length + 1}`, snappedX, snappedY));
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
            } else if (start instanceof Transition && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false);
                this.arcs.push(arc);
                start.outputArcs.push({ place: elem, weight: 1 });
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
            this.arcEnd = { x, y };
        } else if (this.addMode === "select" && this.selectionStart) {
            this.selectionArea = {
                x: Math.min(this.selectionStart.x, x),
                y: Math.min(this.selectionStart.y, y),
                width: Math.abs(x - this.selectionStart.x),
                height: Math.abs(y - this.selectionStart.y)
            };
        } else if (this.addMode === "select" && this.selectedElements.length > 0 && e.buttons === 1) {
            this.saveStateToUndo();
            const dx = x - this.selectedElements[0].x;
            const dy = y - this.selectedElements[0].y;
            this.selectedElements.forEach(elem => {
                elem.x += dx;
                elem.y += dy;
            });
        }
    }

    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;
        const elem = this.getElementAt(x, y);
        if (this.addMode === "select" && elem) {
            const newName = prompt("Enter new name:", elem.name);
            if (newName && newName.trim()) {
                this.saveStateToUndo();
                elem.name = newName.trim();
            }
        }
    }

    newDesign() {
        this.saveStateToUndo();
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.drawingArc = false;
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
                }
            });
            this.selectedElements = [];
            this.selected = null;
        }
    }

    addToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.addToken();
            });
        }
    }

    removeToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.removeToken();
            });
        }
    }

    togglePlayPause() {
        this.autoRun = !this.autoRun;
        if (!this.autoRun) this.animations = [];
        document.getElementById("playPauseBtn").innerHTML = this.autoRun ?
            `<img src="assets/pause.png" alt="Pause"> Pause` :
            `<img src="assets/play.png" alt="Play"> Play`;
    }

    resetTokens() {
        this.saveStateToUndo();
        this.places.forEach(p => p.tokens = 0);
        this.transitions.forEach(t => t.active = false);
        this.animations = [];
        this.autoRun = false;
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
        const design = {
            places: this.places.map(p => ({ name: p.name, x: p.x, y: p.y, tokens: p.tokens })),
            transitions: this.transitions.map(t => ({ name: t.name, x: t.x, y: t.y, inputArcs: t.inputArcs, outputArcs: t.outputArcs })),
            arcs: this.arcs.map(a => ({
                isInput: a.isInput,
                startIdx: a.start instanceof Place ? this.places.indexOf(a.start) : this.transitions.indexOf(a.start),
                endIdx: a.end instanceof Place ? this.places.indexOf(a.end) : this.transitions.indexOf(a.end)
            })),
            isSmartModel: this.isSmartModel
        };
        const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "petriNetDesign.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    loadDesign() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                this.saveStateToUndo();
                const design = JSON.parse(event.target.result);
                this.importDesign(design);
            };
            reader.readAsText(file);
        };
        input.click();
    }

    importDesign(design) {
        this.places = design.places.map(p => new Place(p.name, p.x, p.y, p.tokens));
        this.transitions = design.transitions.map(t => new Transition(t.name, t.x, t.y));
        this.arcs = design.arcs.map(a => {
            const start = a.isInput ? this.places[a.startIdx] : this.transitions[a.startIdx];
            const end = a.isInput ? this.transitions[a.endIdx] : this.places[a.endIdx];
            return new Arc(start, end, a.isInput);
        });
        this.isSmartModel = design.isSmartModel;
        document.getElementById("switchBtn").innerHTML = this.isSmartModel ?
            `<img src="assets/switch.png" alt="Switch"> S-Model` :
            `<img src="assets/switch.png" alt="Switch"> T-Model`;
    }

    clearCanvas() {
        this.saveStateToUndo();
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.drawingArc = false;
    }

    toggleModel() {
        this.isSmartModel = !this.isSmartModel;
        document.getElementById("switchBtn").innerHTML = this.isSmartModel ?
            `<img src="assets/switch.png" alt="Switch"> S-Model` :
            `<img src="assets/switch.png" alt="Switch"> T-Model`;
    }

    showGuide() {
        const modal = document.getElementById("guideModal");
        const guideText = document.getElementById("guideText");
        guideText.innerHTML = `
            <b>Traditional Model (T-Model) Notes:</b><br>
            - Input arc weights: Number of tokens required to enable transition.<br>
            - Output arc weights: Number of tokens produced per firing to output places.<br>
        `;
        modal.style.display = "block";
        document.querySelector(".close").onclick = () => modal.style.display = "none";
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
                    if (t) t.completeFiring(this.animations);
                } else if (anim.targetPlace) {
                    anim.targetPlace.addToken();
                }
                return false;
            }
            return true;
        });
    }

    getElementAt(x, y) {
        for (const p of this.places) {
            if ((x - p.x) ** 2 + (y - p.y) ** 2 <= (this.iconSize / 2) ** 2) return p;
        }
        for (const t of this.transitions) {
            if (Math.abs(x - t.x) < this.iconSize / 2 && Math.abs(y - t.y) < this.iconSize / 2) return t;
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
        this.arcs.forEach(a => {
            const startX = a.start.x;
            const startY = a.start.y;
            const endX = a.end.x;
            const endY = a.end.y;
            if (this.selectionArea.intersectsLine(startX, startY, endX, endY)) {
                this.selectedElements.push(a);
            }
        });
        if (this.selectedElements.length === 1) this.selected = this.selectedElements[0];
        else this.selected = null;
    }

    saveStateToUndo() {
        if (this.undoHistory.length >= this.maxHistorySize) this.undoHistory.shift();
        this.undoHistory.push({
            places: this.places.map(p => ({ ...p })),
            transitions: this.transitions.map(t => ({ ...t, inputArcs: [...t.inputArcs], outputArcs: [...t.outputArcs] })),
            arcs: this.arcs.map(a => ({ ...a })),
            selectedElements: [...this.selectedElements],
            isSmartModel: this.isSmartModel,
            autoRun: this.autoRun,
            addMode: this.addMode,
            drawingArc: this.drawingArc,
            arcStart: this.arcStart ? { ...this.arcStart } : null,
            arcEnd: this.arcEnd ? { ...this.arcEnd } : null,
            selectionArea: this.selectionArea ? { ...this.selectionArea } : null,
            selectionStart: this.selectionStart ? { ...this.selectionStart } : null
        });
        this.redoHistory = [];
    }

    undo() {
        if (this.undoHistory.length > 0) {
            this.redoHistory.push(this.getCurrentState());
            this.restoreState(this.undoHistory.pop());
        }
    }

    redo() {
        if (this.redoHistory.length > 0) {
            this.undoHistory.push(this.getCurrentState());
            this.restoreState(this.redoHistory.pop());
        }
    }

    getCurrentState() {
        return {
            places: this.places.map(p => ({ ...p })),
            transitions: this.transitions.map(t => ({ ...t, inputArcs: [...t.inputArcs], outputArcs: [...t.outputArcs] })),
            arcs: this.arcs.map(a => ({ ...a })),
            selectedElements: [...this.selectedElements],
            isSmartModel: this.isSmartModel,
            autoRun: this.autoRun,
            addMode: this.addMode,
            drawingArc: this.drawingArc,
            arcStart: this.arcStart ? { ...this.arcStart } : null,
            arcEnd: this.arcEnd ? { ...this.arcEnd } : null,
            selectionArea: this.selectionArea ? { ...this.selectionArea } : null,
            selectionStart: this.selectionStart ? { ...this.selectionStart } : null
        };
    }

    restoreState(state) {
        this.places = state.places.map(p => new Place(p.name, p.x, p.y, p.tokens));
        this.transitions = state.transitions.map(t => new Transition(t.name, t.x, t.y));
        this.arcs = state.arcs.map(a => {
            const start = a.isInput ? this.places[a.startIdx] : this.transitions[a.startIdx];
            const end = a.isInput ? this.transitions[a.endIdx] : this.places[a.endIdx];
            return new Arc(start, end, a.isInput);
        });
        this.selectedElements = state.selectedElements.map(e => {
            if (e instanceof Place) return this.places.find(p => p.name === e.name);
            if (e instanceof Transition) return this.transitions.find(t => t.name === e.name);
            if (e instanceof Arc) return this.arcs.find(a => a.start === e.start && a.end === e.end);
            return e;
        });
        this.selected = this.selectedElements.length === 1 ? this.selectedElements[0] : null;
        this.isSmartModel = state.isSmartModel;
        this.autoRun = state.autoRun;
        this.addMode = state.addMode;
        this.drawingArc = state.drawingArc;
        this.arcStart = state.arcStart ? { ...state.arcStart } : null;
        this.arcEnd = state.arcEnd ? { ...state.arcEnd } : null;
        this.selectionArea = state.selectionArea ? { ...state.selectionArea } : null;
        this.selectionStart = state.selectionStart ? { ...state.selectionStart } : null;
    }
}

// Place class
class Place {
    constructor(name, x, y, tokens = 0) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.tokens = tokens;
    }

    addToken() {
        this.tokens++;
    }

    removeToken() {
        if (this.tokens > 0) this.tokens--;
    }

    hasEnoughTokens(amount) {
        return this.tokens >= amount;
    }

    draw(ctx, selected) {
        const img = selected ? canvas.icons.place : canvas.icons.place; // Simplified for now
        ctx.drawImage(img, this.x - canvas.iconSize / 2, this.y - canvas.iconSize / 2, canvas.iconSize, canvas.iconSize);
        ctx.fillStyle = "black";
        const visibleTokens = Math.min(this.tokens, 2);
        for (let i = 0; i < visibleTokens; i++) {
            const tokenX = this.x - canvas.tokenSize / 2 + (i - visibleTokens / 2) * canvas.tokenSize;
            const tokenY = this.y - canvas.tokenSize / 2;
            ctx.beginPath();
            ctx.arc(tokenX, tokenY, canvas.tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.tokens > 2) ctx.fillText("+", this.x + canvas.iconSize / 4, this.y + 5);
        ctx.fillText(this.name, this.x - ctx.measureText(this.name).width / 2, this.y + canvas.iconSize / 2 + 15);
    }
}

// Transition class
class Transition {
    constructor(name, x, y) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.inputArcs = [];
        this.outputArcs = [];
        this.active = false;
        this.pendingTokens = 0;
    }

    isEnabled() {
        return this.inputArcs.every(a => a.place.hasEnoughTokens(a.weight));
    }

    isEnabledSmart() {
        return this.inputArcs.length > 0 && this.inputArcs.every(a => a.place.tokens > 0);
    }

    fire(animations) {
        if (this.isEnabled() && !this.active) {
            this.active = true;
            this.pendingTokens = 0;
            this.inputArcs.forEach(a => {
                for (let i = 0; i < a.weight; i++) {
                    if (a.place.tokens > 0) {
                        animations.push(new TokenAnimation(a.place.x, a.place.y, this.x, this.y, null, a.place));
                        this.pendingTokens++;
                    }
                }
            });
        }
    }

    fireSmart(animations) {
        if (this.isEnabledSmart() && !this.active) {
            this.active = true;
            this.pendingTokens = 0;
            this.inputArcs.forEach(a => {
                if (a.place.tokens > 0) {
                    animations.push(new TokenAnimation(a.place.x, a.place.y, this.x, this.y, null, a.place));
                    this.pendingTokens++;
                }
            });
        }
    }

    completeFiring(animations) {
        this.pendingTokens--;
        if (this.pendingTokens <= 0 && this.active) {
            this.active = false;
            setTimeout(() => {
                this.outputArcs.forEach(a => {
                    for (let i = 0; i < a.weight; i++) {
                        animations.push(new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place));
                    }
                });
            }, 500);
        }
    }

    draw(ctx, selected) {
        const img = selected ? canvas.icons.transition : (this.active ? canvas.icons.transition : canvas.icons.transition);
        ctx.drawImage(img, this.x - canvas.iconSize / 2, this.y - canvas.iconSize / 2, canvas.iconSize, canvas.iconSize);
        ctx.fillStyle = "black";
        ctx.fillText(this.name, this.x - ctx.measureText(this.name).width / 2, this.y + canvas.iconSize / 2 + 15);
    }
}

// Arc class
class Arc {
    constructor(start, end, isInput) {
        this.start = start;
        this.end = end;
        this.isInput = isInput;
    }

    getWeight() {
        if (!canvas.isSmartModel) {
            if (this.isInput) {
                return this.end.inputArcs.find(a => a.place === this.start)?.weight || 1;
            } else {
                return this.start.outputArcs.find(a => a.place === this.end)?.weight || 1;
            }
        }
        return 1;
    }

    draw(ctx) {
        const startX = this.start.x;
        const startY = this.start.y;
        const endX = this.end.x;
        const endY = this.end.y;
        const angle = Math.atan2(endY - startY, endX - startX);
        const offset = canvas.iconSize / 2;
        const adjStartX = startX + offset * Math.cos(angle);
        const adjStartY = startY + offset * Math.sin(angle);
        const adjEndX = endX - offset * Math.cos(angle);
        const adjEndY = endY - offset * Math.sin(angle);

        ctx.strokeStyle = this.isInput ? "blue" : "red";
        if (this.end instanceof Transition && this.end.active) ctx.strokeStyle = "green";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(adjStartX, adjStartY);
        ctx.lineTo(adjEndX, adjEndY);
        ctx.stroke();

        const arrowSize = 10;
        const arrowX = adjEndX;
        const arrowY = adjEndY;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowSize * Math.cos(angle + Math.PI / 6), arrowY - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - arrowSize * Math.cos(angle - Math.PI / 6), arrowY - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.stroke();

        if (!canvas.isSmartModel) {
            const weight = this.getWeight();
            if (weight > 1) {
                const midX = (adjStartX + adjEndX) / 2;
                const midY = (adjStartY + adjEndY) / 2;
                ctx.fillStyle = "black";
                ctx.fillText(weight.toString(), midX, midY - 5);
            }
        }
    }
}

// TokenAnimation class (placeholder for later batch)
class TokenAnimation {
    constructor(startX, startY, endX, endY, targetPlace, sourcePlace) {
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.targetPlace = targetPlace;
        this.sourcePlace = sourcePlace;
        this.progress = 0;
        this.toTransition = !!sourcePlace;
    }

    update() {
        this.progress += canvas.animationSpeedBase * canvas.animationSpeed;
        if (this.progress > 1) this.progress = 1;
    }

    isFinished() {
        return this.progress >= 1;
    }

    draw(ctx) {
        const x = this.startX + (this.endX - this.startX) * this.progress;
        const y = this.startY + (this.endY - this.startY) * this.progress;
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(x, y, canvas.tokenSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize the canvas
const canvas = new PetriNetCanvas();
