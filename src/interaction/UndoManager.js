import { Place, Transition, Arc, Initializer, Annotation, TransitionTask, SmartToken } from '../models/elements.js';

export class UndoManager {
    constructor(canvas, maxHistory = 10) {
        this.canvas = canvas;
        this.undoHistory = [];
        this.redoHistory = [];
        this.maxHistorySize = maxHistory;
    }

    saveState() {
        if (this.undoHistory.length >= this.maxHistorySize) {
            this.undoHistory.shift();
        }
        this.undoHistory.push(this.getCurrentState());
        this.redoHistory = [];
    }

    undo() {
        if (this.undoHistory.length > 0) {
            this.redoHistory.push(this.getCurrentState());
            this.restoreState(this.undoHistory.pop());
            return true;
        }
        return false;
    }

    redo() {
        if (this.redoHistory.length > 0) {
            this.undoHistory.push(this.getCurrentState());
            this.restoreState(this.redoHistory.pop());
            return true;
        }
        return false;
    }

    getCurrentState() {
        return {
            places: this.canvas.places.map(p => ({ ...p, smartToken: p.smartToken ? { value: p.smartToken.value } : null })),
            transitions: this.canvas.transitions.map(t => ({
                ...t,
                inputArcs: [...t.inputArcs],
                outputArcs: [...t.outputArcs],
                task: t.task ? { task: t.task.task } : null,
                tokenOrder: t.tokenOrder,
                passOnTrue: t.passOnTrue,
                passOnFalse: t.passOnFalse,
                passPreviousValue: t.passPreviousValue
            })),
            arcs: this.canvas.arcs.map(a => ({ 
                ...a, 
                type: a.type, 
                controlPoints: a.controlPoints.map(cp => ({ ...cp })), 
                weight: a.weight 
            })),
            initializers: this.canvas.initializers.map(i => ({ ...i })),
            annotations: this.canvas.annotations.map(a => ({ ...a })),
            isSmartModel: this.canvas.isSmartModel,
            currentFileName: this.canvas.designState.currentFileName
        };
    }

    restoreState(state) {
        this.canvas.places = state.places.map(p => {
            const place = new Place(p.name, p.x, p.y, p.tokens);
            if (p.smartToken) place.smartToken = new SmartToken(p.smartToken.value);
            return place;
        });
        
        this.canvas.transitions = state.transitions.map(t => {
            const trans = new Transition(t.name, t.x, t.y);
            if (t.task) trans.task = new TransitionTask(t.task.task);
            trans.tokenOrder = t.tokenOrder || "";
            trans.passOnTrue = t.passOnTrue !== undefined ? t.passOnTrue : true;
            trans.passOnFalse = t.passOnFalse !== undefined ? t.passOnFalse : false;
            trans.passPreviousValue = t.passPreviousValue || false;
            return trans;
        });
        
        this.canvas.initializers = state.initializers.map(i => 
            new Initializer(i.name, i.x, i.y, i.tokensToGenerate, i.tokensPerSecond, i.isContinuous, i.tokenValue || 0)
        );
        
        this.canvas.arcs = state.arcs.map(a => {
            const start = a.start.tokens !== undefined ? this.canvas.places.find(p => p.name === a.start.name) :
                          a.start.inputArcs !== undefined ? this.canvas.transitions.find(t => t.name === a.start.name) :
                          this.canvas.initializers.find(i => i.name === a.start.name);
            const end = a.end.tokens !== undefined ? this.canvas.places.find(p => p.name === a.end.name) :
                        this.canvas.transitions.find(t => t.name === a.end.name);
            
            const arc = new Arc(start, end, a.isInput);
            arc.controlPoints = a.controlPoints.map(cp => ({ x: cp.x, y: cp.y }));
            arc.weight = a.weight || 1;
            return arc;
        });
        
        this.canvas.transitions.forEach((t, i) => {
            t.inputArcs = state.transitions[i].inputArcs.map(a => ({ 
                place: this.canvas.places.find(p => p.name === a.place.name), 
                weight: a.weight 
            }));
            t.outputArcs = state.transitions[i].outputArcs.map(a => ({ 
                place: this.canvas.places.find(p => p.name === a.place.name), 
                weight: a.weight 
            }));
        });
        
        this.canvas.initializers.forEach((ini, idx) => {
            if (state.initializers[idx].outputPlace) {
                ini.outputPlace = this.canvas.places.find(p => p.name === state.initializers[idx].outputPlace.name);
            }
        });
        
        this.canvas.annotations = state.annotations.map(a => 
            new Annotation(a.text, a.x, a.y, a.fontName, a.fontSize, a.color, a.strokeWeight)
        );
        
        // Clear selection to avoid dangling references
        this.canvas.selectedElements = [];
        this.canvas.selected = null;
        if (this.canvas.propertiesPanel) {
            this.canvas.propertiesPanel.hide();
        }
        
        this.canvas.isSmartModel = state.isSmartModel;
        this.canvas.designState.currentFileName = state.currentFileName;
        this.canvas.designState.unsavedChanges = true; // Typically a change requires saving
    }
}
