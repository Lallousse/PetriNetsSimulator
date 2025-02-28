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

// Saver class
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
                endType: a.end instanceof Place ? "place" : "transition",
                type: a.type,
                controlPoints: a.controlPoints,
                weight: a.weight
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

// Loader class
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
            const arc = new Arc(start, end, a.isInput, a.type);
            arc.controlPoints = a.controlPoints || (a.type === "flexible" ? [{ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }] : []);
            arc.weight = a.weight || 1;
            canvas.arcs.push(arc);
            if (a.isInput && end instanceof Transition) {
                end.inputArcs.push({ place: start, weight: arc.weight });
            } else if (!a.isInput && start instanceof Transition) {
                start.outputArcs.push({ place: end, weight: arc.weight });
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

// Initialize the canvas after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    const canvas = new PetriNetCanvas();
    if (!canvas.canvas) {
        console.error("Failed to initialize PetriNetCanvas!");
    } else {
        console.log("PetriNetCanvas initialized successfully");
        window.canvas = canvas; // Expose globally for dropdowns
    }
});