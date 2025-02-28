// Place class
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
        tokenSize = 6; // Reduced size for first 4 tokens (Adjustment 4)
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

// Transition class (unchanged except for reference)
class Transition {
    constructor(name, x, y) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.inputArcs = [];
        this.outputArcs = [];
        this.active = false;
        this.pendingTokens = 0;
        this.task = new TransitionTask("gate");
    }

    isEnabled() {
        return this.inputArcs.every(a => a.place.hasEnoughTokens(a.weight));
    }

    isEnabledSmart() {
        return this.inputArcs.length > 0 && this.inputArcs.every(a => a.place.tokens > 0);
    }

    fire(animations) {
        if (this.isEnabled() && !this.active) {
            this.active = true;
            this.pendingTokens = 0;
            this.inputArcs.forEach(a => {
                for (let i = 0; i < a.weight; i++) {
                    if (a.place.tokens > 0) {
                        animations.push(new TokenAnimation(a.place.x, a.place.y, this.x, this.y, null, a.place));
                        this.pendingTokens++;
                    }
                }
            });
        }
    }

    fireSmart(animations) {
        if (this.isEnabledSmart() && !this.active) {
            this.active = true;
            this.pendingTokens = 0;
            this.inputArcs.forEach(a => {
                if (a.place.tokens > 0) {
                    const token = new SmartToken(a.place.getTokenValue());
                    animations.push(new TokenAnimation(a.place.x, a.place.y, this.x, this.y, null, a.place, token));
                    this.pendingTokens++;
                }
            });
        }
    }

    completeFiring(animations) {
        this.pendingTokens--;
        if (this.pendingTokens <= 0 && this.active) {
            this.active = false;
            setTimeout(() => {
                this.outputArcs.forEach(a => {
                    for (let i = 0; i < a.weight; i++) {
                        animations.push(new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place));
                    }
                });
            }, 2000); // Slower for visibility (Adjustment 2)
        }
    }

    completeFiringSmart(animations, inputToken) {
        this.pendingTokens--;
        if (this.pendingTokens <= 0 && this.active) {
            this.active = false;
            const result = this.task.execute([inputToken]);
            if (result && this.outputArcs.length > 0) {
                const delay = this.task.getPauseDuration();
                setTimeout(() => {
                    this.outputArcs.forEach(a => {
                        animations.push(new TokenAnimation(this.x, this.y, a.place.x, a.place.y, a.place, null, result));
                    });
                }, delay > 0 ? delay : 2000); // Slower (Adjustment 2)
            }
        }
    }

    draw(ctx, selected, iconSize) {
        const img = canvas.icons.transition;
        if (!img) {
            console.error("Transition icon not loaded!");
            return;
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

// Arc class (unchanged except for reference)
class Arc {
    constructor(start, end, isInput, type = "line") {
        this.start = start;
        this.end = end;
        this.isInput = isInput;
        this.type = type;
        this.controlPoints = this.type === "flexible" ? [{ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }] : [];
        this.weight = 1;
    }

    getWeight() {
        return this.weight;
    }

    setWeight(w) {
        this.weight = w;
    }

    draw(ctx, iconSize) {
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

        ctx.strokeStyle = this.isInput ? "blue" : (this.start instanceof Initializer ? "magenta" : "red");
        if (this.end instanceof Transition && this.end.active) ctx.strokeStyle = "green";
        ctx.lineWidth = 2;

        if (this.type === "line") {
            ctx.beginPath();
            ctx.moveTo(adjStartX, adjStartY);
            ctx.lineTo(adjEndX, adjEndY);
            ctx.stroke();
        } else if (this.type === "flexible") {
            const cp = this.controlPoints[0];
            const dist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
            cp.y = Math.min(adjStartY, adjEndY) - dist / 4;
            ctx.beginPath();
            ctx.moveTo(adjStartX, adjStartY);
            ctx.quadraticCurveTo(cp.x, cp.y, adjEndX, adjEndY);
            ctx.stroke();
            if (canvas.selected === this) {
                ctx.fillStyle = "red";
                ctx.beginPath();
                ctx.arc(cp.x, cp.y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.type === "90degree") {
            ctx.beginPath();
            ctx.moveTo(adjStartX, adjStartY);
            ctx.lineTo(adjEndX, adjStartY);
            ctx.lineTo(adjEndX, adjEndY);
            ctx.stroke();
            if (canvas.selected === this) {
                ctx.fillStyle = "red";
                ctx.beginPath();
                ctx.arc(adjEndX, adjStartY, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

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
            if (weight > 1 || canvas.selected === this) {
                const midX = (adjStartX + adjEndX) / 2;
                const midY = (adjStartY + adjEndY) / 2;
                ctx.fillStyle = "black";
                ctx.fillText(weight.toString(), midX, midY - 5);
            }
        }
    }
}

// Initializer class (unchanged)
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

// Point class (unchanged)
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

// SmartToken class (unchanged)
class SmartToken {
    constructor(value) {
        this.value = value;
    }
}

// TransitionTask class (unchanged)
class TransitionTask {
    constructor(task) {
        this.task = task || "gate";
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
            default:
                if (this.task.startsWith("!=")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value !== compareValue ? 1 : 0);
                } else if (this.task.startsWith("==")) {
                    const compareValue = parseFloat(this.task.substring(2).trim());
                    return new SmartToken(inputTokens[0].value === compareValue ? 1 : 0);
                } else if (this.task === "cp") {
                    return new SmartToken(inputTokens[0].value);
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

// TokenAnimation class (unchanged)
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

// Annotation class (unchanged)
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