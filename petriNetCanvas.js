// PetriNetCanvas class
class PetriNetCanvas {
    constructor() {
        this.canvas = document.getElementById("petriCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
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
            "clear", "switch", "guide", "ini"
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

        // Add initializer button (new for this batch)
        const iniBtn = document.createElement("button");
        iniBtn.id = "iniBtn";
        iniBtn.innerHTML = `<img src="assets/ini.png" alt="INI"> INI`;
        iniBtn.addEventListener("click", () => this.setMode("ini"));
        document.getElementById("toolbar").appendChild(iniBtn);

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
        this.initializers.forEach(ini => ini.draw(this.ctx, this.selectedElements.includes(ini)));
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
            this.ctx.fillText(`Name: ${p.name}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Tokens: ${p.tokens}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel && p.tokens > 0) {
                this.ctx.fillText(`Token Value: ${p.getTokenValue()}`, (this.canvas.width - 190) / this.zoomLevel, y);
            }
        } else if (this.selected instanceof Transition) {
            const t = this.selected;
            this.ctx.fillText(`Name: ${t.name}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Inputs: ${t.inputArcs.length}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Outputs: ${t.outputArcs.length}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel) {
                this.ctx.fillText(`Task: ${t.task.task}`, (this.canvas.width - 190) / this.zoomLevel, y);
            }
        } else if (this.selected instanceof Initializer) {
            const i = this.selected;
            this.ctx.fillText(`Name: ${i.name}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Tokens: ${i.tokensToGenerate}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel) {
                this.ctx.fillText(`Token Value: ${i.tokenValue}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            }
            this.ctx.fillText(`Rate: ${i.tokensPerSecond}`, (this.canvas.width - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Continuous: ${i.isContinuous}`, (this.canvas.width - 190) / this.zoomLevel, y);
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        if (y < 0) return;

        const elem = this.getElementAt(x, y);
        const arc = this.getArcAt(x, y);
        if (this.addMode === "arc" && (elem instanceof Place || elem instanceof Transition || elem instanceof Initializer)) {
            this.arcStart = new Point(x, y);
            this.arcEnd = new Point(x, y);
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
                this.selectionStart = new Point(x, y);
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
        } else if (this.addMode === "ini") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / this.snapGridSize) * this.snapGridSize : x;
            const snappedY = this.snappingEnabled ? Math.round(y / this.snapGridSize) * this.snapGridSize : y;
            this.initializers.push(new Initializer(`INI${this.initializers.length + 1}`, snappedX, snappedY));
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
            } else if (start instanceof Initializer && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false);
                this.arcs.push(arc);
                start.outputPlace = elem;
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
            if (elem instanceof Place && this.isSmartModel && elem.tokens > 0) {
                const name = prompt("Enter new name:", elem.name) || elem.name;
                const value = prompt("Enter token value:", elem.getTokenValue()) || elem.getTokenValue();
                this.saveStateToUndo();
                elem.name = name.trim();
                try {
                    elem.setTokenValue(parseFloat(value));
                } catch (ex) {
                    console.log("Invalid token value input");
                }
            } else if (elem instanceof Transition && this.isSmartModel) {
                const name = prompt("Enter new name:", elem.name) || elem.name;
                const task = prompt("Enter task (+, -, *, /, !=num, ==num, cp, p sec):", elem.task.task) || elem.task.task;
                this.saveStateToUndo();
                elem.name = name.trim();
                elem.task = new TransitionTask(task);
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
                    } else {
                        const weight = prompt("Enter output arc weight:", arc.getWeight()) || arc.getWeight();
                        this.saveStateToUndo();
                        try {
                            const w = parseInt(weight);
                            if (w > 0) arc.start.outputArcs.find(a => a.place === arc.end).weight = w;
                        } catch (ex) {
                            console.log("Invalid weight input");
                        }
                    }
                } else if (elem) {
                    const newName = prompt("Enter new name:", elem.name) || elem.name;
                    this.saveStateToUndo();
                    elem.name = newName.trim();
                }
            }
        }
    }

    newDesign() {
        this.saveStateToUndo();
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
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
                } else if (elem instanceof Initializer) {
                    this.initializers = this.initializers.filter(i => i !== elem);
                    this.arcs = this.arcs.filter(a => a.start !== elem);
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
        this.initializers.forEach(i => {
            i.tokensGenerated = 0;
            i.lastGenerationTime = Date.now();
            i.isGenerating = false;
        });
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
            places: this.places.map(p => ({
                name: p.name,
                x: p.x,
                y: p.y,
                tokens: p.tokens,
                tokenValue: this.isSmartModel && p.tokens > 0 ? p.getTokenValue() : undefined
            })),
            transitions: this.transitions.map(t => ({
                name: t.name,
                x: t.x,
                y: t.y,
                inputArcs: t.inputArcs.map(a => ({ placeIdx: this.places.indexOf(a.place), weight: a.weight })),
                outputArcs: t.outputArcs.map(a => ({ placeIdx: this.places.indexOf(a.place), weight: a.weight })),
                task: this.isSmartModel ? t.task.task : undefined
            })),
            arcs: this.arcs.map(a => ({
                isInput: a.isInput,
                startIdx: a.start instanceof Place ? this.places.indexOf(a.start) :
                          a.start instanceof Transition ? this.transitions.indexOf(a.start) :
                          this.initializers.indexOf(a.start),
                endIdx: a.end instanceof Place ? this.places.indexOf(a.end) : this.transitions.indexOf(a.end),
                startType: a.start instanceof Place ? "place" : a.start instanceof Transition ? "transition" : "initializer",
                endType: a.end instanceof Place ? "place" : "transition"
            })),
            initializers: this.initializers.map(i => ({
                name: i.name,
                x: i.x,
                y: i.y,
                tokensToGenerate: i.tokensToGenerate,
                tokensPerSecond: i.tokensPerSecond,
                isContinuous: i.isContinuous,
                tokenValue: this.isSmartModel ? i.tokenValue : undefined,
                outputPlaceIdx: i.outputPlace ? this.places.indexOf(i.outputPlace) : -1
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
        if (this.isSmartModel) {
            design.places.forEach((p, i) => {
                if (p.tokenValue !== undefined && this.places[i].tokens > 0) {
                    this.places[i].setTokenValue(p.tokenValue);
                }
            });
        }
        this.transitions = design.transitions.map(t => {
            const trans = new Transition(t.name, t.x, t.y);
            if (this.isSmartModel && t.task) trans.task = new TransitionTask(t.task);
            return trans;
        });
        this.initializers = design.initializers.map(i => {
            const ini = new Initializer(i.name, i.x, i.y);
            ini.tokensToGenerate = i.tokensToGenerate;
            ini.tokensPerSecond = i.tokensPerSecond;
            ini.isContinuous = i.isContinuous;
            ini.tokenValue = i.tokenValue || 0;
            return ini;
        });
        this.arcs = design.arcs.map(a => {
            const start = a.startType === "place" ? this.places[a.startIdx] :
                          a.startType === "transition" ? this.transitions[a.startIdx] :
                          this.initializers[a.startIdx];
            const end = a.endType === "place" ? this.places[a.endIdx] : this.transitions[a.endIdx];
            return new Arc(start, end, a.isInput);
        });
        this.transitions.forEach((t, i) => {
            t.inputArcs = design.transitions[i].inputArcs.map(a => ({ place: this.places[a.placeIdx], weight: a.weight }));
            t.outputArcs = design.transitions[i].outputArcs.map(a => ({ place: this.places[a.placeIdx], weight: a.weight }));
        });
        this.initializers.forEach((i, idx) => {
            if (design.initializers[idx].outputPlaceIdx >= 0) {
                i.outputPlace = this.places[design.initializers[idx].outputPlaceIdx];
            }
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
        this.initializers = [];
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
            const line = {
                x1: startX, y1: startY, x2: endX, y2: endY
            };
            if (this.intersectsRectLine(this.selectionArea, line)) {
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

        const m = (y2 - y1) / (x2 - x1);
        const b = y1 - m * x1;
        const edges = [
            { x: x, y: y }, { x: x + width, y: y },
            { x: x + width, y: y + height }, { x: x, y: y + height }
        ];
        for (let i = 0; i < 4; i++) {
            const xEdge = edges[i].x;
            const yEdge = m * xEdge + b;
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
            places: this.places.map(p => ({ ...p, smartToken: p.smartToken ? { value: p.smartToken.value } : null })),
            transitions: this.transitions.map(t => ({
                ...t,
                inputArcs: [...t.inputArcs],
                outputArcs: [...t.outputArcs],
                task: t.task ? { task: t.task.task } : null
            })),
            arcs: this.arcs.map(a => ({ ...a })),
            initializers: this.initializers.map(i => ({ ...i })),
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
            const start = a.startType === "place" ? this.places[a.startIdx] :
                          a.startType === "transition" ? this.transitions[a.startIdx] :
                          this.initializers[a.startIdx];
            const end = a.endType === "place" ? this.places[a.endIdx] : this.transitions[a.endIdx];
            return new Arc(start, end, a.isInput);
        });
        this.transitions.forEach((t, i) => {
            t.inputArcs = state.transitions[i].inputArcs.map(a => ({ place: this.places[a.placeIdx], weight: a.weight }));
            t.outputArcs = state.transitions[i].outputArcs.map(a => ({ place: this.places[a.placeIdx], weight: a.weight }));
        });
        this.initializers.forEach((i, idx) => {
            if (state.initializers[idx].outputPlaceIdx >= 0) {
                i.outputPlace = this.places[state.initializers[idx].outputPlaceIdx];
            }
        });
        this.selectedElements = state.selectedElements.map(e => {
            if (e instanceof Place) return this.places.find(p => p.name === e.name);
            if (e instanceof Transition) return this.transitions.find(t => t.name === e.name);
            if (e instanceof Arc) return this.arcs.find(a => a.start === e.start && a.end === e.end);
            if (e instanceof Initializer) return this.initializers.find(i => i.name === e.name);
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
    }
}

// Place class
class Place {
    constructor(name, x, y, tokens = 0) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.tokens = tokens;
        this.smartToken = null;
    }

    addToken() {
        this.tokens++;
    }

    removeToken() {
        if (this.tokens > 0) {
            this.tokens--;
            if (this.tokens === 0) this.smartToken = null;
        }
    }

    hasEnoughTokens(amount) {
        return this.tokens >= amount;
    }

    getTokenValue() {
        return this.smartToken ? this.smartToken.value : 0;
    }

    setTokenValue(value) {
        if (this.tokens > 0) this.smartToken = new SmartToken(value);
    }

    draw(ctx, selected) {
        const img = selected ? canvas.icons.place : canvas.icons.place;
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
        this.task = new TransitionTask("gate"); // Default task
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
                    const token = new SmartToken(a.place.getTokenValue());
                    animations.push(new TokenAnimation(a.place.x, a.place.y, this.x, this.y, null, a.place, token));
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

    completeFiringSmart(animations, inputToken) {
        this.pendingTokens--;
        if (this.pendingTokens <= 0 && this.active) {
            this.active = false;
            const result = this.task.execute([inputToken]);
            if (result && this.outputArcs.length > 0) {
                const delay = this.task.getPauseDuration();
                setTimeout(() => {
                    this.outputArcs.forEach(a => {
                        animations.push(new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place, null, result));
                    });
                }, delay > 0 ? delay : 500);
            }
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

        ctx.strokeStyle = this.isInput ? "blue" : (this.start instanceof Initializer ? "magenta" : "red");
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

// Initializer class
class Initializer {
    constructor(name, x, y, tokensToGenerate = 0, tokensPerSecond = 1.0, isContinuous = false, tokenValue = 0) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.tokensToGenerate = tokensToGenerate;
        this.tokensPerSecond = tokensPerSecond;
        this.isContinuous = isContinuous;
        this.tokenValue = tokenValue;
        this.tokensGenerated = 0;
        this.lastGenerationTime = Date.now();
        this.outputPlace = null;
        this.isGenerating = false;
    }

    draw(ctx, selected) {
        const img = selected ? canvas.icons.ini : (this.isGenerating ? canvas.icons.ini : canvas.icons.ini);
        ctx.drawImage(img, this.x - canvas.iconSize / 2, this.y - canvas.iconSize / 2, canvas.iconSize, canvas.iconSize);
        ctx.fillStyle = "black";
        ctx.fillText(this.name, this.x - ctx.measureText(this.name).width / 2, this.y + canvas.iconSize / 2 + 15);
    }
}

// Point class
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

// SmartToken class
class SmartToken {
    constructor(value) {
        this.value = value;
    }
}

// TransitionTask class
class TransitionTask {
    constructor(task) {
        this.task = task || "gate";
    }

    execute(inputTokens) {
        if (this.task === "gate") {
            return inputTokens.length > 0 ? new SmartToken(inputTokens[0].value) : null;
        }
        if (inputTokens.length === 0) return null;

        switch (this.task) {
            case "+":
                return new SmartToken(inputTokens.reduce((sum, t) => sum + t.value, 0));
            case "-":
                if (inputTokens.length < 2) return null;
                return new SmartToken(inputTokens[0].value - inputTokens[1].value);
            case "*":
                return new SmartToken(inputTokens.reduce((prod, t) => prod * t.value, 1));
            case "/":
                if (inputTokens.length < 2 || inputTokens[1].value === 0) return null;
                return new SmartToken(inputTokens[0].value / inputTokens[1].value);
            default:
                if (this.task.startsWith("!=")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value !== compareValue ? 1 : 0);
                } else if (this.task.startsWith("==")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value === compareValue ? 1 : 0);
                } else if (this.task === "cp") {
                    return new SmartToken(inputTokens[0].value);
                } else if (this.task.startsWith("p ")) {
                    return new SmartToken(inputTokens[0].value);
                }
                return null;
        }
    }

    getPauseDuration() {
        if (this.task.startsWith("p ")) {
            return parseFloat(this.task.substring(2).trim()) * 1000;
        }
        return 0;
    }
}

// TokenAnimation class
class TokenAnimation {
    constructor(startX, startY, endX, endY, targetPlace, sourcePlace = null, smartToken = null) {
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.targetPlace = targetPlace;
        this.sourcePlace = sourcePlace;
        this.smartToken = smartToken;
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
