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

    draw(ctx, selected, iconSize, tokenSize) {
        const img = canvas.icons.place;
        if (!img) {
            console.error("Place icon not loaded!");
            return;
        }
        ctx.drawImage(img, this.x - iconSize / 2, this.y - iconSize / 2, iconSize, iconSize);
        if (selected) {
            ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, iconSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = "black";
        const radius = iconSize / 2 - 4;
        tokenSize = 6;

        // Draw tokens based solely on this.tokens, not animations
        if (this.tokens === 1) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.tokens === 2) {
            ctx.beginPath();
            ctx.arc(this.x - tokenSize, this.y, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + tokenSize, this.y, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.tokens === 3) {
            ctx.beginPath();
            ctx.arc(this.x, this.y - tokenSize, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x - tokenSize, this.y + tokenSize / 2, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + tokenSize, this.y + tokenSize / 2, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.tokens === 4) {
            ctx.beginPath();
            ctx.arc(this.x, this.y - tokenSize, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x - tokenSize, this.y, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + tokenSize, this.y, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x, this.y + tokenSize, tokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.tokens > 4) {
            const smallTokenSize = tokenSize / 1.5;
            ctx.beginPath();
            ctx.arc(this.x - smallTokenSize, this.y - smallTokenSize, smallTokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + smallTokenSize, this.y - smallTokenSize, smallTokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x - smallTokenSize, this.y + smallTokenSize, smallTokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.x + smallTokenSize, this.y + smallTokenSize, smallTokenSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText("+", this.x - 3, this.y + 5);
        }
        ctx.fillText(this.name, this.x - ctx.measureText(this.name).width / 2, this.y + iconSize / 2 + 15);
    }
}

class Transition {
    constructor(name, x, y) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.inputArcs = [];
        this.outputArcs = [];
        this.active = false;
        this.pendingTokens = 0;
        this.pendingSmartTokens = [];
        this.task = new TransitionTask("");
        this.tokenOrder = "";
        this.passOnTrue = true;
        this.passOnFalse = false;
        this.passPreviousValue = false;
    }

    isEnabled() {
        return this.inputArcs.every(a => a.place.hasEnoughTokens(a.weight));
    }

    isEnabledSmart() {
        return this.inputArcs.length > 0 && this.inputArcs.every(a => a.place.tokens > 0);
    }

    fire(animations) {
        if (this.isEnabled() && !this.active) {
            this.outputArcs.forEach(a => {
                for (let i = 0; i < a.weight; i++) {
                    const anim = new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place);
                    anim.transition = this;
                    animations.push(anim);
                }
            });
        }
    }

    fireSmart(animations) {
        if (this.isEnabledSmart() && !this.active) {
            const orderedTokens = [];
            if (this.tokenOrder && this.pendingSmartTokens.length > 0) {
                const order = this.tokenOrder.split(",").map(name => name.trim());
                const tokenMap = new Map();
                this.inputArcs.forEach(arc => tokenMap.set(arc.place.name, []));
                this.pendingSmartTokens.forEach(token => {
                    const place = this.inputArcs.find(a => a.place.tokens > 0 || this.pendingSmartTokens.length > 0)?.place;
                    if (place) tokenMap.get(place.name).push(token);
                });
                order.forEach(name => {
                    const tokens = tokenMap.get(name);
                    if (tokens && tokens.length > 0) orderedTokens.push(tokens.shift());
                });
                tokenMap.forEach((tokens, name) => orderedTokens.push(...tokens));
            } else {
                orderedTokens.push(...this.pendingSmartTokens);
            }

            const result = this.task.execute(orderedTokens);
            const previousValue = orderedTokens.length > 0 ? orderedTokens[0].value : 0;

            if (result) {
                this.outputArcs.forEach(a => {
                    const outputToken = (this.task.task.startsWith("!=") || this.task.task.startsWith("==")) ?
                        (result.value === 1 && this.passOnTrue ? (this.passPreviousValue ? new SmartToken(previousValue) : new SmartToken(1)) :
                         result.value === 0 && this.passOnFalse ? (this.passPreviousValue ? new SmartToken(previousValue) : new SmartToken(0)) : null) :
                        (this.passPreviousValue ? new SmartToken(previousValue) : result);
                    if (outputToken) {
                        const anim = new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place, null, outputToken);
                        anim.transition = this;
                        animations.push(anim);
                    }
                });
            }
            this.pendingSmartTokens = [];
        }
    }

    draw(ctx, selected, iconSize, highlighted = false) {
        const img = canvas.icons.transition;
        if (!img) {
            console.error("Transition icon not loaded!");
            return;
        }
        if (highlighted) {
            ctx.fillStyle = "#90EE90"; // Solid light green
            ctx.fillRect(this.x - iconSize / 2 + 2, this.y - iconSize / 2 + 2, iconSize - 4, iconSize - 4); // Inner area only
        }
        ctx.drawImage(img, this.x - iconSize / 2, this.y - iconSize / 2, iconSize, iconSize);
        if (selected) {
            ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
            ctx.fillRect(this.x - iconSize / 2, this.y - iconSize / 2, iconSize, iconSize);
        }
        ctx.fillStyle = "black";
        ctx.fillText(this.name, this.x - ctx.measureText(this.name).width / 2, this.y + iconSize / 2 + 15);
    }
}

class Arc {
    constructor(start, end, isInput) {
        this.start = start;
        this.end = end;
        this.isInput = isInput;
        this.type = "line";
        this.controlPoints = [];
        this.weight = 1;
        this.highlighted = false;
    }

    getWeight() {
        return this.weight;
    }

    setWeight(w) {
        this.weight = w;
    }

    draw(ctx, selected, iconSize) {
        const startX = this.start.x;
        const startY = this.start.y;
        const endX = this.end.x;
        const endY = this.end.y;
        const offset = iconSize / 2;
        const angle = Math.atan2(endY - startY, endX - startX);
        const adjStartX = startX + offset * Math.cos(angle);
        const adjStartY = startY + offset * Math.sin(angle);
        const adjEndX = endX - offset * Math.cos(angle);
        const adjEndY = endY - offset * Math.sin(angle);

        if (this.highlighted) {
            ctx.strokeStyle = "#90EE90"; // Solid light green
            ctx.lineWidth = 3; // Slightly thicker for visibility
            ctx.beginPath();
            ctx.moveTo(adjStartX, adjStartY);
            ctx.lineTo(adjEndX, adjEndY);
            ctx.stroke();
        }

        ctx.strokeStyle = selected ? "yellow" : this.isInput ? "blue" : (this.start instanceof Initializer ? "magenta" : "red");
        ctx.lineWidth = selected ? 3 : 2;
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
            if (weight > 1 || selected) {
                const midX = (adjStartX + adjEndX) / 2;
                const midY = (adjStartY + adjEndY) / 2;
                ctx.fillStyle = "black";
                ctx.fillText(weight.toString(), midX, midY - 5);
            }
        }
    }
}

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

    draw(ctx, selected, iconSize) {
        const img = canvas.icons.ini;
        if (!img) {
            console.error("Initializer icon not loaded!");
            return;
        }
        ctx.drawImage(img, this.x - iconSize / 2, this.y - iconSize / 2, iconSize, iconSize);
        if (selected) {
            ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, iconSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = "black";
        ctx.fillText(this.name, this.x - ctx.measureText(this.name).width / 2, this.y + iconSize / 2 + 15);
    }
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class SmartToken {
    constructor(value) {
        this.value = value;
    }
}

class TransitionTask {
    constructor(task) {
        this.task = task && task.trim() ? task.trim() : "gate";
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
            case "cp":
                return inputTokens[0] ? new SmartToken(inputTokens[0].value) : null;
            default:
                if (this.task.startsWith("!=")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value !== compareValue ? 1 : 0);
                } else if (this.task.startsWith("==")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value === compareValue ? 1 : 0);
                } else if (this.task.startsWith("p ")) {
                    return inputTokens[0] ? new SmartToken(inputTokens[0].value) : null;
                }
                return null;
        }
    }

    getPauseDuration() {
        if (this.task.startsWith("p ")) {
            return parseFloat(this.task.substring(2).trim()) * 1000; // Convert seconds to milliseconds
        }
        return 0;
    }
}

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

    draw(ctx, tokenSize) {
        const x = this.startX + (this.endX - this.startX) * this.progress;
        const y = this.startY + (this.endY - this.startY) * this.progress;
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(x, y, tokenSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Annotation {
    constructor(text, x, y, fontName = "Arial", fontSize = 12, color = "black", strokeWeight = 1) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.fontName = fontName;
        this.fontSize = fontSize;
        this.color = color;
        this.strokeWeight = strokeWeight;
    }

    draw(ctx, selected) {
        ctx.fillStyle = this.color;
        ctx.font = `${this.fontSize}px ${this.fontName}`;
        ctx.lineWidth = this.strokeWeight;
        const lines = this.text.split("\n");
        lines.forEach((line, i) => {
            ctx.fillText(line, this.x, this.y + i * this.fontSize);
        });
        if (selected) {
            const width = Math.max(...lines.map(line => ctx.measureText(line).width));
            const height = this.fontSize * lines.length;
            ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
            ctx.fillRect(this.x - 5, this.y - this.fontSize - 5, width + 10, height + 10);
        }
    }
}