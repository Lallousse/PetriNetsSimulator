class Place {
    constructor(name, x, y, tokens = 0) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.tokens = tokens;
        this.smartToken = null; // For S-Model
    }

    addToken() {
        this.tokens++;
    }

    removeToken() {
        if (this.tokens > 0) this.tokens--;
    }

    hasEnoughTokens(weight) {
        return this.tokens >= weight;
    }

    getTokenValue() {
        return this.smartToken ? this.smartToken.value : 0;
    }

    setTokenValue(value) {
        this.smartToken = new SmartToken(value);
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
            ctx.fillRect(this.x - iconSize / 2, this.y - iconSize / 2, iconSize, iconSize);
        }
        ctx.fillStyle = "black";
        ctx.fillText(this.name, this.x - ctx.measureText(this.name).width / 2, this.y + iconSize / 2 + 15);

        if (this.tokens > 0) {
            const radius = tokenSize / 2;
            if (this.tokens === 1) {
                ctx.fillStyle = "black";
                ctx.beginPath();
                ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const angleStep = (2 * Math.PI) / this.tokens;
                for (let i = 0; i < this.tokens; i++) {
                    const tokenX = this.x + (iconSize / 3) * Math.cos(angleStep * i);
                    const tokenY = this.y + (iconSize / 3) * Math.sin(angleStep * i);
                    ctx.fillStyle = "black";
                    ctx.beginPath();
                    ctx.arc(tokenX, tokenY, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
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
                let tokenIndex = 0;
                for (const arc of this.inputArcs) {
                    if (tokenIndex < this.pendingSmartTokens.length) {
                        tokenMap.get(arc.place.name).push(this.pendingSmartTokens[tokenIndex++]);
                    }
                }
                order.forEach(name => {
                    const tokens = tokenMap.get(name);
                    if (tokens && tokens.length > 0) orderedTokens.push(tokens.shift());
                });
                tokenMap.forEach(tokens => orderedTokens.push(...tokens));
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

class Initializer {
    constructor(name, x, y, tokensToGenerate = 1, tokensPerSecond = 1.0, isContinuous = false, tokenValue = 0) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.tokensToGenerate = tokensToGenerate;
        this.tokensPerSecond = tokensPerSecond;
        this.isContinuous = isContinuous;
        this.tokenValue = tokenValue; // For S-Model
        this.tokensGenerated = 0;
        this.lastGenerationTime = Date.now();
        this.isGenerating = false;
        this.outputPlace = null;
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
            ctx.lineWidth = 3;
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

class Annotation {
    constructor(text, x, y, fontName = "Times New Roman", fontSize = 12, color = "black", strokeWeight = 1) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.fontName = fontName;
        this.fontSize = fontSize;
        this.color = color;
        this.strokeWeight = strokeWeight;
    }

    draw(ctx, selected) {
        ctx.font = `${this.fontSize}px ${this.fontName}`;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.strokeWeight;
        const lines = this.text.split("\n");
        lines.forEach((line, i) => {
            ctx.fillText(line, this.x, this.y + i * this.fontSize);
            if (selected) {
                const width = ctx.measureText(line).width;
                ctx.strokeRect(this.x - 2, this.y + i * this.fontSize - this.fontSize, width + 4, this.fontSize + 2);
            }
        });
    }
}

class SmartToken {
    constructor(value) {
        this.value = value;
    }
}

class TokenAnimation {
    constructor(startX, startY, endX, endY, targetPlace = null, sourcePlace = null, smartToken = null) {
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.targetPlace = targetPlace;
        this.sourcePlace = sourcePlace;
        this.smartToken = smartToken;
        this.progress = 0.0;
        this.toTransition = false;
        this.transition = null; // Reference for highlighting
    }

    update() {
        this.progress += canvas.animationSpeedBase * canvas.animationSpeed;
        if (this.progress > 1.0) this.progress = 1.0;
    }

    isFinished() {
        return this.progress >= 1.0;
    }

    draw(ctx, tokenSize) {
        const currentX = this.startX + (this.endX - this.startX) * this.progress;
        const currentY = this.startY + (this.endY - this.startY) * this.progress;
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(currentX, currentY, tokenSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}