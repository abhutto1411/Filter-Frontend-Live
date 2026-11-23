// Run with: node src/utils/visiblePolling.test.mjs
import assert from 'node:assert/strict';

const USER_ACTIVITY_EVENT = 'filter-user-activity';

const documentTarget = new EventTarget();
documentTarget.hidden = false;
globalThis.document = documentTarget;
const windowTarget = new EventTarget();
globalThis.window = windowTarget;

let intervals = [];
globalThis.setInterval = (fn) => {
    const timer = { fn, cleared: false };
    intervals.push(timer);
    return timer;
};
globalThis.clearInterval = (timer) => {
    timer.cleared = true;
};

const { startVisiblePolling } = await import('./visiblePolling.js');

function setup(options) {
    intervals = [];
    documentTarget.hidden = false;
    const state = { runs: 0, activity: 0 };
    const onActivity = () => {
        state.activity += 1;
    };
    windowTarget.addEventListener(USER_ACTIVITY_EVENT, onActivity);
    const stop = startVisiblePolling(() => {
        state.runs += 1;
    }, 1000, options);
    const timer = intervals[0];
    return {
        state,
        tick: () => {
            if (!timer.cleared) timer.fn();
        },
        setHidden: (hidden) => {
            documentTarget.hidden = hidden;
            documentTarget.dispatchEvent(new Event('visibilitychange'));
        },
        stop: () => {
            stop();
            windowTarget.removeEventListener(USER_ACTIVITY_EVENT, onActivity);
        },
    };
}

const cases = {
    'runs on every tick while visible'() {
        const p = setup();
        p.tick();
        p.tick();
        assert.equal(p.state.runs, 2);
        assert.equal(p.state.activity, 0);
        p.stop();
    },
    'does not start with an immediate run'() {
        const p = setup();
        assert.equal(p.state.runs, 0);
        p.stop();
    },
    'skips ticks while hidden'() {
        const p = setup();
        p.setHidden(true);
        p.tick();
        p.tick();
        assert.equal(p.state.runs, 0);
        p.stop();
    },
    'keeps the session alive on each skipped tick'() {
        const p = setup();
        p.setHidden(true);
        p.tick();
        p.tick();
        assert.equal(p.state.activity, 2);
        p.stop();
    },
    'leaves the session alone when keepSessionAlive is false'() {
        const p = setup({ keepSessionAlive: false });
        p.setHidden(true);
        p.tick();
        assert.equal(p.state.activity, 0);
        p.stop();
    },
    'refreshes once on return after a skipped tick'() {
        const p = setup();
        p.setHidden(true);
        p.tick();
        p.tick();
        p.setHidden(false);
        assert.equal(p.state.runs, 1);
        p.setHidden(true);
        p.setHidden(false);
        assert.equal(p.state.runs, 1);
        p.stop();
    },
    'does not refresh after a quick tab switch with no skipped tick'() {
        const p = setup();
        p.setHidden(true);
        p.setHidden(false);
        assert.equal(p.state.runs, 0);
        p.stop();
    },
    'polls normally again after returning'() {
        const p = setup();
        p.setHidden(true);
        p.tick();
        p.setHidden(false);
        p.tick();
        assert.equal(p.state.runs, 2);
        p.stop();
    },
    'stop ends the timer and the visibility refresh'() {
        const p = setup();
        p.setHidden(true);
        p.tick();
        p.stop();
        p.setHidden(false);
        p.tick();
        assert.equal(p.state.runs, 0);
    },
};

let failed = 0;
for (const [name, run] of Object.entries(cases)) {
    try {
        run();
        console.log(`ok   ${name}`);
    } catch (err) {
        failed += 1;
        console.error(`FAIL ${name}: ${err.message}`);
    }
}
console.log(`${Object.keys(cases).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
