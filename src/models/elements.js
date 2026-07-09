export class Place {
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
}

export class Transition {
    constructor(name, x, y) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.inputArcs = [];
        this.outputArcs = [];
        this.active = false;
        this.task = new TransitionTask("");
        this.tokenOrder = "";
        this.passOnTrue = true;
        this.passOnFalse = false;
        this.passPreviousValue = false;
    }

    isEnabled() {
        const enabled = this.inputArcs.every(a => a.place.hasEnoughTokens(a.weight));
        console.log(`T-Model ${this.name} enabled check: ${enabled}, input arcs: ${this.inputArcs.map(a => `${a.place.name}: ${a.place.tokens}/${a.weight}`).join(", ")}`);
        return enabled;
    }

    isEnabledSmart() {
        const enabled = this.inputArcs.length > 0 && this.inputArcs.every(a => a.place.tokens > 0);
        console.log(`S-Model ${this.name} enabled check: ${enabled}, input arcs: ${this.inputArcs.map(a => `${a.place.name}: ${a.place.tokens}`).join(", ")}`);
        return enabled;
    }

    fire(animations) {
        // No re-check of isEnabled(); trust fireTransition's validation
        this.outputArcs.forEach(a => {
            for (let i = 0; i < a.weight; i++) {
                const anim = new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place, this); // Set sourcePlace
                anim.transition = this;
                animations.push(anim);
                console.log(`T-Model fired token from ${this.name} to ${a.place.name}`);
            }
        });
    }

    fireSmart(animations, inputTokens) {
        // No re-check of isEnabledSmart(); trust fireTransition's validation
        const orderedTokens = this.tokenOrder ? 
            this.tokenOrder.split(",").map(name => {
                const index = this.inputArcs.findIndex(a => a.place.name === name.trim());
                return index !== -1 && inputTokens[index] ? inputTokens[index] : null;
            }).filter(t => t) : 
            [...inputTokens];
        
        const result = this.task.execute(orderedTokens);
        const previousValue = orderedTokens.length > 0 ? orderedTokens[0].value : 0;

        if (result) {
            this.outputArcs.forEach(a => {
                const outputToken = (this.task.task.startsWith("!=") || this.task.task.startsWith("==")) ?
                    (result.value === 1 && this.passOnTrue ? (this.passPreviousValue ? new SmartToken(previousValue) : new SmartToken(1)) :
                     result.value === 0 && this.passOnFalse ? (this.passPreviousValue ? new SmartToken(previousValue) : new SmartToken(0)) : null) :
                    (this.passPreviousValue ? new SmartToken(previousValue) : result);
                if (outputToken) {
                    const anim = new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place, this, outputToken); // Set sourcePlace
                    anim.transition = this;
                    animations.push(anim);
                    console.log(`S-Model fired token from ${this.name} to ${a.place.name} with value ${outputToken.value}`);
                }
            });
        } else {
            console.log(`S-Model ${this.name} task returned null, no output generated`);
        }
    }
}

export class Arc {
    constructor(start, end, isInput) {
        this.start = start;
        this.end = end;
        this.isInput = isInput;
        this.type = "line";
        this.controlPoints = [];
        this.weight = 1;
        this.highlighted = false; // For path highlighting
    }

    getWeight() {
        return this.weight;
    }

    setWeight(w) {
        this.weight = w;
    }
}

export class Initializer {
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
}

export class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

export class SmartToken {
    constructor(value) {
        this.value = value;
    }
}

export class TransitionTask {
    constructor(task) {
        this.task = task || "";
    }

    execute(inputTokens) {
        if (!this.task || inputTokens.length === 0) return null;
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
            case "cp":
                return inputTokens.length > 0 ? new SmartToken(inputTokens[0].value) : null;
            default:
                if (this.task.startsWith("!=")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value !== compareValue ? 1 : 0);
                } else if (this.task.startsWith("==")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value === compareValue ? 1 : 0);
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

export class TokenAnimation {
    constructor(startX, startY, endX, endY, targetPlace, sourcePlace, smartToken) {
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.targetPlace = targetPlace;
        this.sourcePlace = sourcePlace;
        this.smartToken = smartToken;
        this.toTransition = false;
        this.transition = null;
        this.progress = 0.0;
        this.animationSpeed = 1.0; // Injected by engine
    }

    update() {
        // Target: ~2s at speed 1.0 (120 frames at 60 FPS)
        const baseIncrement = 0.008; // Increased from 0.0005 for ~2s
        this.progress += baseIncrement * this.animationSpeed;
        if (this.progress > 1.0) this.progress = 1.0;
    }

    isFinished() {
        return this.progress >= 1.0;
    }
}

export class Annotation {
    constructor(text, x, y, fontName = "Arial", fontSize = 12, color = "black", strokeWeight = 1) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.fontName = fontName;
        this.fontSize = fontSize;
        this.color = color;
        this.strokeWeight = strokeWeight;
    }
}
