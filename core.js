class DesignState {
    constructor(canvas) {
        this.canvas = canvas;
        this.currentFileName = null;
        this.unsavedChanges = false;
    }

    hasUnsavedChanges() {
        return this.unsavedChanges;
    }

    hasDesign() {
        return this.canvas.places.length > 0 || 
               this.canvas.transitions.length > 0 || 
               this.canvas.arcs.length > 0 || 
               this.canvas.initializers.length > 0 || 
               this.canvas.annotations.length > 0;
    }

    setUnsavedChanges() {
        this.unsavedChanges = true;
    }

    newDesign(fileName) {
        this.currentFileName = fileName;
        this.unsavedChanges = false;
    }

    saveDesign() {
        this.unsavedChanges = false;
    }
}

class Saver {
    static save(canvas) {
        const design = {
            places: canvas.places.map(p => ({
                name: p.name,
                x: p.x,
                y: p.y,
                tokens: p.tokens,
                ...(canvas.isSmartModel && p.smartToken ? { tokenValue: p.smartToken.value } : {})
            })),
            transitions: canvas.transitions.map(t => ({
                name: t.name,
                x: t.x,
                y: t.y,
                ...(canvas.isSmartModel ? {
                    task: t.task.task,
                    tokenOrder: t.tokenOrder,
                    passOnTrue: t.passOnTrue,
                    passOnFalse: t.passOnFalse,
                    passPreviousValue: t.passPreviousValue
                } : {})
            })),
            arcs: [],
            initializers: canvas.initializers.map(i => ({
                name: i.name,
                x: i.x,
                y: i.y,
                tokensToGenerate: i.tokensToGenerate,
                tokensPerSecond: i.tokensPerSecond,
                isContinuous: i.isContinuous,
                ...(canvas.isSmartModel ? { tokenValue: i.tokenValue } : {})
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

        canvas.arcs.forEach(arc => {
            const startIdx = arc.start instanceof Place ? canvas.places.indexOf(arc.start) :
                             arc.start instanceof Transition ? canvas.transitions.indexOf(arc.start) :
                             canvas.initializers.indexOf(arc.start);
            const endIdx = arc.end instanceof Place ? canvas.places.indexOf(arc.end) :
                           canvas.transitions.indexOf(arc.end);
            const arcData = {
                isInput: arc.isInput,
                weight: arc.weight
            };
            if (arc.start instanceof Transition) {
                arcData.startTransitionIdx = startIdx;
                arcData.endPlaceIdx = endIdx;
            } else if (arc.end instanceof Transition) {
                arcData.startPlaceIdx = startIdx;
                arcData.endTransitionIdx = endIdx;
            } else if (arc.start instanceof Initializer) {
                arcData.startInitializerIdx = startIdx;
                arcData.endPlaceIdx = endIdx;
            }
            design.arcs.push(arcData);
        });

        return design;
    }
}