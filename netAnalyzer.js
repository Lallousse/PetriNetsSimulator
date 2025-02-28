class NetAnalyzer {
    constructor(canvas) {
        this.canvas = canvas;
    }

    analyze() {
        const nets = [];
        const visitedPlaces = new Set();
        const visitedTransitions = new Set();

        // Start with all places and initializers to ensure connectivity
        const allElements = [...this.canvas.places, ...this.canvas.initializers.map(i => i.outputPlace).filter(p => p)];
        if (allElements.length === 0) return [this.createEmptyNet()];

        // Build a single net if connected, otherwise separate nets
        let currentNet = new PetriNet();
        const queue = [allElements[0]];
        visitedPlaces.add(allElements[0]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (current instanceof Place) {
                currentNet.places.add(current);
                const outgoingArcs = this.canvas.arcs.filter(arc => arc.start === current && arc.end instanceof Transition);
                outgoingArcs.forEach(arc => {
                    const transition = arc.end;
                    if (!visitedTransitions.has(transition)) {
                        visitedTransitions.add(transition);
                        currentNet.transitions.add(transition);
                        transition.inputArcs.forEach(input => {
                            currentNet.inputFunction.set(`${input.place.name},${transition.name}`, input.weight);
                            if (!visitedPlaces.has(input.place)) {
                                visitedPlaces.add(input.place);
                                currentNet.places.add(input.place);
                                queue.push(input.place);
                            }
                        });
                        transition.outputArcs.forEach(output => {
                            currentNet.outputFunction.set(`${output.place.name},${transition.name}`, output.weight);
                            if (!visitedPlaces.has(output.place)) {
                                visitedPlaces.add(output.place);
                                currentNet.places.add(output.place);
                                queue.push(output.place);
                            }
                        });
                    }
                });
            }
        }

        // Add unvisited elements to the same net if connected via arcs
        allElements.forEach(el => {
            if (!visitedPlaces.has(el)) {
                const connected = this.canvas.arcs.some(arc => 
                    (arc.start === el && currentNet.transitions.has(arc.end)) || 
                    (arc.end === el && currentNet.transitions.has(arc.start))
                );
                if (connected) {
                    queue.push(el);
                    visitedPlaces.add(el);
                    while (queue.length > 0) {
                        const current = queue.shift();
                        currentNet.places.add(current);
                        const outgoingArcs = this.canvas.arcs.filter(arc => arc.start === current && arc.end instanceof Transition);
                        outgoingArcs.forEach(arc => {
                            const transition = arc.end;
                            if (!visitedTransitions.has(transition)) {
                                visitedTransitions.add(transition);
                                currentNet.transitions.add(transition);
                                transition.inputArcs.forEach(input => {
                                    currentNet.inputFunction.set(`${input.place.name},${transition.name}`, input.weight);
                                    if (!visitedPlaces.has(input.place)) {
                                        visitedPlaces.add(input.place);
                                        currentNet.places.add(input.place);
                                        queue.push(input.place);
                                    }
                                });
                                transition.outputArcs.forEach(output => {
                                    currentNet.outputFunction.set(`${output.place.name},${transition.name}`, output.weight);
                                    if (!visitedPlaces.has(output.place)) {
                                        visitedPlaces.add(output.place);
                                        currentNet.places.add(output.place);
                                        queue.push(output.place);
                                    }
                                });
                            }
                        });
                    }
                }
            }
        });

        if (currentNet.places.size > 0 || currentNet.transitions.size > 0) {
            nets.push(currentNet);
        }

        // Check for any remaining unconnected elements
        allElements.forEach(el => {
            if (!visitedPlaces.has(el)) {
                const newNet = this.buildNet(el, visitedPlaces, visitedTransitions);
                if (newNet.places.size > 0 || newNet.transitions.size > 0) {
                    nets.push(newNet);
                }
            }
        });

        return nets.length > 0 ? nets : [this.createEmptyNet()];
    }

    buildNet(startPlace, visitedPlaces, visitedTransitions) {
        const net = new PetriNet();
        const queue = [startPlace];
        visitedPlaces.add(startPlace);
        net.places.add(startPlace);

        while (queue.length > 0) {
            const currentPlace = queue.shift();
            const outgoingArcs = this.canvas.arcs.filter(arc => arc.start === currentPlace && arc.end instanceof Transition);
            outgoingArcs.forEach(arc => {
                const transition = arc.end;
                if (!visitedTransitions.has(transition)) {
                    visitedTransitions.add(transition);
                    net.transitions.add(transition);
                    transition.inputArcs.forEach(input => {
                        net.inputFunction.set(`${input.place.name},${transition.name}`, input.weight);
                        if (!visitedPlaces.has(input.place)) {
                            visitedPlaces.add(input.place);
                            net.places.add(input.place);
                            queue.push(input.place);
                        }
                    });
                    transition.outputArcs.forEach(output => {
                        net.outputFunction.set(`${output.place.name},${transition.name}`, output.weight);
                        if (!visitedPlaces.has(output.place)) {
                            visitedPlaces.add(output.place);
                            net.places.add(output.place);
                            queue.push(output.place);
                        }
                    });
                }
            });
        }

        return net;
    }

    createEmptyNet() {
        const net = new PetriNet();
        this.canvas.places.forEach(p => net.places.add(p));
        this.canvas.transitions.forEach(t => net.transitions.add(t));
        this.canvas.arcs.forEach(arc => {
            if (arc.isInput) {
                net.inputFunction.set(`${arc.start.name},${arc.end.name}`, arc.weight);
            } else {
                net.outputFunction.set(`${arc.end.name},${arc.start.name}`, arc.weight);
            }
        });
        return net;
    }
}

class PetriNet {
    constructor() {
        this.places = new Set();
        this.transitions = new Set();
        this.inputFunction = new Map();
        this.outputFunction = new Map();
    }

    updateInitialMarking() {
        // Placeholder; M₀ is computed from current token state in canvas
    }

    toFormalNotation(isSmartModel) {
        let notation = `PN = {P, T, I, O, M₀}\n`;
        notation += `P = {${Array.from(this.places).map(p => p.name).join(", ")}}\n`;
        notation += `T = {${Array.from(this.transitions).map(t => t.name).join(", ")}}\n\n`;
        
        notation += this.inputFunction.size > 0 ? "I:\n" : "";
        this.inputFunction.forEach((weight, key) => {
            notation += `I(${key.replace(",", ", ")}) = ${isSmartModel ? (weight > 0 ? 1 : 0) : weight}\n`;
        });
        
        notation += this.outputFunction.size > 0 ? "\nO:\n" : "";
        this.outputFunction.forEach((weight, key) => {
            notation += `O(${key.replace(",", ", ")}) = ${isSmartModel ? (weight > 0 ? 1 : 0) : weight}\n`;
        });
        
        notation += "\nM₀ =\n";
        Array.from(this.places).forEach(p => {
            notation += `    |  ${p.tokens} |\n`;
        });
        return notation;
    }

    toMRPNText(isSmartModel) {
        const placeList = Array.from(this.places);
        const transitionList = Array.from(this.transitions);
        let text = "";

        if (placeList.length === 0 || transitionList.length === 0) {
            return "No design elements available.";
        }

        let inputText = "Input Matrix:\n        ";
        transitionList.forEach(t => inputText += `${t.name.padEnd(6)}`);
        inputText += "\n";
        const midRow = Math.floor(placeList.length / 2);

        placeList.forEach((p, i) => {
            inputText += `${p.name.padEnd(6)} | `;
            transitionList.forEach((t, j) => {
                const weight = this.inputFunction.get(`${p.name},${t.name}`) || 0;
                const value = isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                inputText += j === transitionList.length - 1 ? `${value}` : `${value}`.padEnd(6);
            });
            inputText += " |";
            if (i === midRow) inputText += "  I";
            inputText += "\n";
        });

        let outputText = "Output Matrix:\n        ";
        transitionList.forEach(t => outputText += `${t.name.padEnd(6)}`);
        outputText += "\n";

        placeList.forEach((p, i) => {
            outputText += `${p.name.padEnd(6)} | `;
            transitionList.forEach((t, j) => {
                const weight = this.outputFunction.get(`${p.name},${t.name}`) || 0;
                const value = isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                outputText += j === transitionList.length - 1 ? `${value}` : `${value}`.padEnd(6);
            });
            outputText += " |";
            if (i === midRow) outputText += "  O";
            outputText += "\n";
        });

        return `${inputText}\n\n${outputText}`;
    }
}