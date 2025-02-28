class Loader {
    static load(canvas, design) {
        canvas.places = design.places.map(p => {
            const place = new Place(p.name, p.x, p.y, p.tokens);
            if (p.tokenValue !== undefined) place.setTokenValue(p.tokenValue);
            return place;
        });

        canvas.transitions = design.transitions.map(t => {
            const trans = new Transition(t.name, t.x, t.y);
            if (design.isSmartModel) {
                trans.task = new TransitionTask(t.task || "");
                trans.tokenOrder = t.tokenOrder || "";
                trans.passOnTrue = t.passOnTrue !== undefined ? t.passOnTrue : true;
                trans.passOnFalse = t.passOnFalse !== undefined ? t.passOnFalse : false;
                trans.passPreviousValue = t.passPreviousValue || false;
            }
            return trans;
        });

        canvas.initializers = design.initializers.map(i => 
            new Initializer(i.name, i.x, i.y, i.tokensToGenerate, i.tokensPerSecond, i.isContinuous, i.tokenValue || 0));

        canvas.annotations = design.annotations.map(a => 
            new Annotation(a.text, a.x, a.y, a.fontName, a.fontSize, a.color, a.strokeWeight));

        canvas.arcs = design.arcs.map(arc => {
            let start, end;
            if (arc.startTransitionIdx !== undefined) {
                start = canvas.transitions[arc.startTransitionIdx];
                end = canvas.places[arc.endPlaceIdx];
            } else if (arc.endTransitionIdx !== undefined) {
                start = canvas.places[arc.startPlaceIdx];
                end = canvas.transitions[arc.endTransitionIdx];
            } else if (arc.startInitializerIdx !== undefined) {
                start = canvas.initializers[arc.startInitializerIdx];
                end = canvas.places[arc.endPlaceIdx];
            }
            const newArc = new Arc(start, end, arc.isInput);
            newArc.weight = arc.weight || 1;
            if (arc.isInput && end instanceof Transition) {
                end.inputArcs.push({ place: start, weight: newArc.weight });
            } else if (!arc.isInput && start instanceof Transition) {
                start.outputArcs.push({ place: end, weight: newArc.weight });
            } else if (start instanceof Initializer) {
                start.outputPlace = end;
            }
            return newArc;
        });

        canvas.isSmartModel = design.isSmartModel || false;
    }
}