class NetAnalyzer {
    constructor(canvas) {
        this.canvas = canvas;
    }

    analyze() {
        const nets = [];
        const elementToNet = new Map();
        const visited = new Set();

        // Step 1: Build nets based on arc connectivity, merging nets with shared elements
        this.canvas.arcs.forEach(arc => {
            let startNet = elementToNet.get(arc.start);
            let endNet = elementToNet.get(arc.end);

            // If both elements are in nets, merge them if different
            if (startNet && endNet && startNet !== endNet) {
                this.mergeNets(startNet, endNet, nets, elementToNet);
                elementToNet.set(arc.end, startNet); // Update end to merged net
            } else {
                // Use existing net or create new one
                const net = startNet || endNet || new PetriNet();
                if (!nets.includes(net)) {
                    nets.push(net);
                }
                elementToNet.set(arc.start, net);
                elementToNet.set(arc.end, net);
            }

            // Add elements and arcs to the net
            const net = elementToNet.get(arc.start);
            if (arc.start instanceof Place && arc.end instanceof Transition) {
                net.places.add(arc.start);
                net.transitions.add(arc.end);
                net.inputFunction.set(`${arc.start.name},${arc.end.name}`, arc.weight);
            } else if (arc.start instanceof Transition && arc.end instanceof Place) {
                net.transitions.add(arc.start);
                net.places.add(arc.end);
                net.outputFunction.set(`${arc.end.name},${arc.start.name}`, arc.weight);
            }
            visited.add(arc.start);
            visited.add(arc.end);
        });

        // Step 2: Handle unconnected elements as part of the first net or a new single net
        let mainNet = nets.length === 0 ? new PetriNet() : nets[0];
        let hasUnconnected = false;

        this.canvas.places.forEach(p => {
            if (!visited.has(p)) {
                mainNet.places.add(p);
                elementToNet.set(p, mainNet);
                hasUnconnected = true;
            }
        });
        this.canvas.transitions.forEach(t => {
            if (!visited.has(t)) {
                mainNet.transitions.add(t);
                elementToNet.set(t, mainNet);
                hasUnconnected = true;
            }
        });

        if (hasUnconnected && !nets.includes(mainNet)) {
            nets.push(mainNet);
        }

        // Step 3: Ensure at least one net if canvas has elements
        if (nets.length === 0 && (this.canvas.places.length > 0 || this.canvas.transitions.length > 0)) {
            nets.push(mainNet);
        }

        return nets;
    }

    mergeNets(net1, net2, nets, elementToNet) {
        // Merge net2 into net1
        net2.places.forEach(p => net1.places.add(p));
        net2.transitions.forEach(t => net1.transitions.add(t));
        net2.inputFunction.forEach((weight, key) => net1.inputFunction.set(key, weight));
        net2.outputFunction.forEach((weight, key) => net1.outputFunction.set(key, weight));
        nets.splice(nets.indexOf(net2), 1);

        // Update elementToNet mappings
        this.canvas.places.forEach(p => {
            if (elementToNet.get(p) === net2) elementToNet.set(p, net1);
        });
        this.canvas.transitions.forEach(t => {
            if (elementToNet.get(t) === net2) elementToNet.set(t, net1);
        });
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