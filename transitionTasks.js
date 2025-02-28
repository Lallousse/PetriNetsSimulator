class TransitionManager {
    static async simulateStep(transitions, animations, isSmartModel, canvas) {
        const enabled = transitions.filter(t => {
            const isEnabled = isSmartModel ? t.isEnabledSmart() : t.isEnabled();
            return isEnabled && !t.active;
        });
        if (enabled.length === 0) return;

        const transition = enabled[Math.floor(Math.random() * enabled.length)];
        transition.active = true;

        try {
            // Step 1: Acknowledge - Move tokens to transition
            this.generateTransitionTokens(transition, animations, isSmartModel);
            canvas.updateStatus(`Acknowledging transition: ${transition.name}`, isSmartModel ? "S-Model" : "T-Model");
            await this.waitForAnimations(animations, 500); // Wait for tokens to reach transition

            // Step 2: Validate - Check if still enabled
            if (!(isSmartModel ? transition.isEnabledSmart() : transition.isEnabled())) {
                console.log(`Transition ${transition.name} no longer enabled`);
                transition.active = false;
                return;
            }

            // Step 3: Fire - Move tokens to output places
            if (isSmartModel) {
                transition.fireSmart(animations);
            } else {
                transition.fire(animations);
            }
            canvas.updateStatus(`Fired transition: ${transition.name}`, isSmartModel ? "S-Model" : "T-Model");
            console.log("Fired transition:", transition.name);
        } catch (error) {
            console.error("Error in transition simulation:", error);
            canvas.updateStatus(`Error firing ${transition.name}: ${error.message}`, isSmartModel ? "S-Model" : "T-Model");
        } finally {
            transition.active = false;
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

    static updateAnimations(animations) {
        for (let i = animations.length - 1; i >= 0; i--) {
            const anim = animations[i];
            anim.update();
            if (anim.isFinished()) {
                if (!anim.toTransition && anim.targetPlace) {
                    anim.targetPlace.addToken();
                    if (anim.smartToken) anim.targetPlace.setTokenValue(anim.smartToken.value);
                }
                animations.splice(i, 1);
            }
        }
    }

    static waitForAnimations(animations, delay) {
        return new Promise(resolve => {
            let finished = false;
            const checkFinished = setInterval(() => {
                const toTransition = animations.filter(a => a.toTransition);
                if (toTransition.every(a => a.isFinished())) {
                    clearInterval(checkFinished);
                    finished = true;
                }
            }, 10);
            setTimeout(() => {
                if (!finished) clearInterval(checkFinished);
                resolve();
            }, delay);
        });
    }
}