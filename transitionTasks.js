class TransitionManager {
    static simulateStep(transitions, animations, isSmartModel, canvas) {
        const enabled = transitions.filter(t => {
            const isEnabled = isSmartModel ? t.isEnabledSmart() : t.isEnabled();
            return isEnabled && !t.active;
        });
        if (enabled.length === 0) return;

        const transition = enabled[Math.floor(Math.random() * enabled.length)];
        transition.active = true;

        // Step 1: Acknowledge - Generate animations from input places to transition
        this.generateTransitionTokens(transition, animations, isSmartModel);
        canvas.updateStatus(`Acknowledging transition: ${transition.name}`, isSmartModel ? "S-Model" : "T-Model");
        console.log(`Acknowledging transition: ${transition.name}`);

        // Step 2: Validate and Fire - Wait for tokens to arrive, then fire
        setTimeout(() => {
            if (!(isSmartModel ? transition.isEnabledSmart() : transition.isEnabled())) {
                console.log(`Transition ${transition.name} no longer enabled`);
                transition.active = false;
                return;
            }

            if (isSmartModel) {
                transition.fireSmart(animations);
            } else {
                transition.fire(animations);
            }
            canvas.updateStatus(`Fired transition: ${transition.name}`, isSmartModel ? "S-Model" : "T-Model");
            console.log(`Fired transition: ${transition.name}`);
            transition.active = false;
        }, 500); // 500ms delay to allow tokens to visually reach the transition
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
}