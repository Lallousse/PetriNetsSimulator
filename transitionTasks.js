class TransitionManager {
    static simulateStep(transitions, animations, isSmartModel, canvas) {
        const enabled = transitions.filter(t => {
            const isEnabled = isSmartModel ? t.isEnabledSmart() : t.isEnabled();
            return isEnabled && !t.active;
        });
        if (enabled.length > 0) {
            const t = enabled[Math.floor(Math.random() * enabled.length)];
            t.active = true;

            // Step 1: Acknowledge - Generate animations from input places to transition
            this.generateTransitionTokens(t, animations, isSmartModel);

            // Step 2: Validate and Fire - Wait for tokens to arrive, then fire
            setTimeout(() => {
                if (isSmartModel) {
                    t.fireSmart(animations);
                } else {
                    t.fire(animations);
                }
                canvas.updateStatus(`Fired transition: ${t.name}`, isSmartModel ? "S-Model" : "T-Model");
                console.log("Simulated step, fired transition:", t.name);
                t.active = false;
            }, 500); // 500ms delay for visual acknowledgment, matching Java behavior
        }
    }

    static generateTransitionTokens(transition, animations, isSmartModel) {
        transition.inputArcs.forEach(arc => {
            const place = arc.place;
            const weight = isSmartModel ? 1 : arc.weight;
            for (let i = 0; i < weight && place.tokens > 0; i++) {
                const anim = isSmartModel ?
                    new TokenAnimation(place.x, place.y, transition.x, transition.y, null, place, new SmartToken(place.getTokenValue())) :
                    new TokenAnimation(place.x, place.y, transition.x, transition.y, null, place);
                anim.toTransition = true;
                animations.push(anim);
                place.removeToken();
            }
        });
    }

    static updateAnimations(animations, transitions, isSmartModel) {
        animations = animations.filter(anim => {
            anim.update();
            if (anim.isFinished()) {
                if (anim.toTransition) {
                    const transition = transitions.find(t => t.x === anim.targetX && t.y === anim.targetY);
                    if (transition && (isSmartModel ? transition.isEnabledSmart() : transition.isEnabled())) {
                        transition.outputArcs.forEach(outArc => {
                            const newAnim = isSmartModel ?
                                new TokenAnimation(transition.x, transition.y, outArc.place.x, outArc.place.y, outArc.place, null, anim.smartToken) :
                                new TokenAnimation(transition.x, transition.y, outArc.place.x, outArc.place.y, outArc.place);
                            animations.push(newAnim);
                        });
                    }
                } else if (anim.targetPlace) {
                    anim.targetPlace.addToken();
                    if (isSmartModel && anim.smartToken) anim.targetPlace.setTokenValue(anim.smartToken.value);
                }
                return false;
            }
            return true;
        });
    }
}