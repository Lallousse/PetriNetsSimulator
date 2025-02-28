class NetAnalyzer {
    constructor(canvas) {
        this.canvas = canvas;
    }

    analyze() {
        const nets = [];
        const visitedPlaces = new Set();
        const visitedTransitions = new Set();

        this.canvas.places.forEach(place => {
            if (!visitedPlaces.has(place)) {
                const net = this.buildNet(place, visitedPlaces, visitedTransitions);
                if (net.places.size > 0 || net.transitions.size > 0) {
                    nets.push(net);
                }
            }
        });

        this.canvas.initializers.forEach(ini => {
            if (ini.outputPlace && !visitedPlaces.has(ini.outputPlace)) {
                const net = this.buildNet(ini.outputPlace, visitedPlaces, visitedTransitions);
                if (net.places.size > 0 || net.transitions.size > 0) {
                    nets.push(net);
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
        // In Java, this might reset tokens; here we'll leave as-is since canvas manages tokens
    }

    toFormalNotation(isSmartModel) {
        let notation = "Places: {";
        notation += Array.from(this.places).map(p => `${p.name}(${p.tokens})`).join(", ");
        notation += "}\nTransitions: {";
        notation += Array.from(this.transitions).map(t => t.name).join(", ");
        notation += "}\nInput Function:\n";
        this.inputFunction.forEach((weight, key) => {
            notation += `${key} -> ${isSmartModel ? (weight > 0 ? 1 : 0) : weight}\n`;
        });
        notation += "Output Function:\n";
        this.outputFunction.forEach((weight, key) => {
            notation += `${key} -> ${isSmartModel ? (weight > 0 ? 1 : 0) : weight}\n`;
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