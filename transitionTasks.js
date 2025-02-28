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
            }, 500); // 500ms delay for visual acknowledgment
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
        for (let i = animations.length - 1; i >= 0; i--) {
            const anim = animations[i];
            anim.update();
            if (anim.isFinished()) {
                if (anim.toTransition) {
                    const transition = transitions.find(t => t.x === anim.targetX && t.y === anim.targetY);
                    if (transition && !transition.active) {
                        if (isSmartModel) {
                            transition.fireSmart(animations);
                        } else {
                            transition.fire(animations);
                        }
                        transition.active = false; // Ensure reset after firing
                    }
                } else if (anim.targetPlace) {
                    anim.targetPlace.addToken();
                    if (isSmartModel && anim.smartToken) anim.targetPlace.setTokenValue(anim.smartToken.value);
                }
                animations.splice(i, 1); // Remove finished animation
            }
        }
    }
}