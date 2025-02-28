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
        this.places.forEach(place => {
            // Initial marking could be updated here if needed, currently just a placeholder
        });
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
}