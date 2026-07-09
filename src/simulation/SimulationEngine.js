import { SmartToken, TokenAnimation } from '../models/elements.js';

export class SimulationEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.tokenQueue = new Map();
        this.firingTimeouts = new Map();
    }

    reset() {
        this.canvas.animations = [];
        this.tokenQueue.clear();
        this.firingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.firingTimeouts.clear();
        this.canvas.transitions.forEach(t => t.active = false);
    }

    simulateStep() {
        if (!this.canvas.autoRun || this.canvas.paused) return;

        const enabled = this.canvas.transitions.filter(t => {
            const isEnabled = this.canvas.isSmartModel ? t.isEnabledSmart() : t.isEnabled();
            return isEnabled && !t.active && !this.firingTimeouts.has(t);
        });

        if (enabled.length === 0) return;

        const transition = enabled[Math.floor(Math.random() * enabled.length)];
        transition.active = true;
        const queue = [];

        transition.inputArcs.forEach(arc => {
            const place = arc.place;
            const weight = this.canvas.isSmartModel ? 1 : arc.weight;
            const tokensToMove = Math.min(weight, place.tokens);
            
            for (let i = 0; i < tokensToMove; i++) {
                const token = this.canvas.isSmartModel ? new SmartToken(place.getTokenValue()) : null;
                queue.push({ place, token });
                place.removeToken();
                
                const anim = new TokenAnimation(place.x, place.y, transition.x, transition.y, null, place, token);
                anim.toTransition = true;
                anim.transition = transition;
                anim.animationSpeed = this.canvas.animationSpeed || 1.0;
                this.canvas.animations.push(anim);
            }
        });

        if (queue.length === 0 && transition.inputArcs.length > 0) {
            transition.active = false;
        } else {
            this.tokenQueue.set(transition, queue);

            const checkAnimations = setInterval(() => {
                const inputAnimsPending = this.canvas.animations.some(a => a.transition === transition && a.toTransition && !a.isFinished());
                if (!inputAnimsPending && !this.canvas.paused) {
                    clearInterval(checkAnimations);
                    const pauseDuration = this.canvas.isSmartModel ? transition.task.getPauseDuration() : 0;
                    const timeoutId = setTimeout(() => {
                        this.fireTransition(transition);
                        this.firingTimeouts.delete(transition);
                    }, pauseDuration > 0 ? pauseDuration : 500);
                    this.firingTimeouts.set(transition, timeoutId);
                }
            }, 100);
        }
    }

    fireTransition(transition) {
        if (!transition.active || !this.tokenQueue.has(transition)) {
            transition.active = false;
            return;
        }

        const queue = this.tokenQueue.get(transition);
        const requiredTokens = this.canvas.isSmartModel ? transition.inputArcs.length : transition.inputArcs.reduce((sum, a) => sum + a.weight, 0);
        const stillEnabled = queue.length >= requiredTokens;

        if (stillEnabled) {
            if (this.canvas.isSmartModel) {
                const smartTokens = queue.map(q => q.token);
                transition.fireSmart(this.canvas.animations, smartTokens);
            } else {
                transition.fire(this.canvas.animations);
            }
            // Set speed on newly created output animations
            this.canvas.animations.forEach(a => {
                if (a.transition === transition && !a.toTransition) {
                    a.animationSpeed = this.canvas.animationSpeed || 1.0;
                }
            });
        }

        transition.active = false;
        this.tokenQueue.delete(transition);
    }

    updateAnimations() {
        if (this.canvas.paused) return;

        for (let i = this.canvas.animations.length - 1; i >= 0; i--) {
            const anim = this.canvas.animations[i];
            anim.update();

            const arc = this.canvas.arcs.find(a => 
                (a.start === anim.sourcePlace && a.end === anim.transition) ||
                (a.start === anim.transition && a.end === anim.targetPlace)
            );
            
            if (arc) {
                arc.highlighted = !anim.isFinished();
            }

            if (anim.isFinished()) {
                if (!anim.toTransition && anim.targetPlace) {
                    anim.targetPlace.addToken();
                    if (this.canvas.isSmartModel && anim.smartToken) {
                        anim.targetPlace.setTokenValue(anim.smartToken.value);
                    }
                }
                this.canvas.animations.splice(i, 1);
            }
        }
    }

    generateTokensFromInitializers() {
        if (!this.canvas.autoRun || this.canvas.paused) return;
        
        const now = Date.now();
        this.canvas.initializers.forEach(ini => {
            if (ini.outputPlace && ini.tokensPerSecond > 0) {
                const timeSinceLast = now - ini.lastGenerationTime;
                const interval = 1000 / ini.tokensPerSecond;
                
                if (timeSinceLast >= interval) {
                    if (ini.isContinuous || ini.tokensGenerated < ini.tokensToGenerate) {
                        const smartToken = this.canvas.isSmartModel ? new SmartToken(ini.tokenValue) : null;
                        const anim = new TokenAnimation(ini.x, ini.y, ini.outputPlace.x, ini.outputPlace.y, ini.outputPlace, ini, smartToken);
                        anim.animationSpeed = this.canvas.animationSpeed || 1.0;
                        this.canvas.animations.push(anim);
                        
                        ini.tokensGenerated++;
                        ini.lastGenerationTime = now;
                        ini.isGenerating = true;
                    } else {
                        ini.isGenerating = false;
                    }
                }
            }
        });
    }
}
