/**
 * tests/harness.js
 * 
 * Lightweight Headless DOM & Canvas Mock Environment for CyberTycoon
 * Enables running game.js in Node.js with 100% fidelity, zero external dependencies.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GAME_JS_PATH = path.resolve(__dirname, '..', 'game.js');
const INDEX_HTML_PATH = path.resolve(__dirname, '..', 'index.html');

/**
 * Mock DOM ClassList implementation
 */
class MockClassList {
    constructor(element) {
        this.element = element;
        this._classes = new Set();
        this._syncFromClassName();
    }

    _syncFromClassName() {
        if (this.element._className) {
            this._classes = new Set(this.element._className.split(/\s+/).filter(Boolean));
        } else {
            this._classes.clear();
        }
    }

    _syncToClassName() {
        this.element._className = Array.from(this._classes).join(' ');
    }

    add(...tokens) {
        tokens.forEach(t => { if (t) this._classes.add(t); });
        this._syncToClassName();
    }

    remove(...tokens) {
        tokens.forEach(t => { if (t) this._classes.delete(t); });
        this._syncToClassName();
    }

    contains(token) {
        return this._classes.has(token);
    }

    toggle(token, force) {
        if (typeof force === 'boolean') {
            if (force) this.add(token);
            else this.remove(token);
            return force;
        }
        if (this.contains(token)) {
            this.remove(token);
            return false;
        } else {
            this.add(token);
            return true;
        }
    }
}

/**
 * Mock CanvasRenderingContext2D implementation
 * Tracks all drawing operations and asserts coordinate validity (no NaN/Infinity)
 */
class MockCanvasContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.strokeStyle = '#000000';
        this.fillStyle = '#000000';
        this.lineWidth = 1;
        this.operations = [];
        this.moveToCalls = [];
        this.lineToCalls = [];
        this.clearRectCalls = [];
        this.strokeCalls = 0;
        this.fillCalls = 0;
        this.gradients = [];
    }

    clearRect(x, y, w, h) {
        this.clearRectCalls.push({ x, y, w, h });
        this.operations.push({ type: 'clearRect', x, y, w, h });
    }

    beginPath() {
        this.operations.push({ type: 'beginPath' });
    }

    moveTo(x, y) {
        this.moveToCalls.push({ x, y });
        this.operations.push({ type: 'moveTo', x, y });
    }

    lineTo(x, y) {
        this.lineToCalls.push({ x, y });
        this.operations.push({ type: 'lineTo', x, y });
    }

    stroke() {
        this.strokeCalls++;
        this.operations.push({ type: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    }

    fill() {
        this.fillCalls++;
        this.operations.push({ type: 'fill', fillStyle: this.fillStyle });
    }

    fillRect(x, y, w, h) {
        this.operations.push({ type: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
    }

    strokeRect(x, y, w, h) {
        this.operations.push({ type: 'strokeRect', x, y, w, h, strokeStyle: this.strokeStyle });
    }

    arc(x, y, r, startAngle, endAngle) {
        this.operations.push({ type: 'arc', x, y, r, startAngle, endAngle });
    }

    closePath() {
        this.operations.push({ type: 'closePath' });
    }

    save() {
        this.operations.push({ type: 'save' });
    }

    restore() {
        this.operations.push({ type: 'restore' });
    }

    fillText(text, x, y) {
        this.operations.push({ type: 'fillText', text, x, y });
    }

    createLinearGradient(x0, y0, x1, y1) {
        const grad = {
            x0, y0, x1, y1,
            colorStops: [],
            addColorStop(offset, color) {
                this.colorStops.push({ offset, color });
            }
        };
        this.gradients.push(grad);
        this.operations.push({ type: 'createLinearGradient', gradient: grad });
        return grad;
    }

    hasNaN() {
        for (const op of this.operations) {
            if (op.type === 'moveTo' || op.type === 'lineTo') {
                if (Number.isNaN(op.x) || Number.isNaN(op.y) || op.x === undefined || op.y === undefined) {
                    return true;
                }
            }
            if (op.type === 'clearRect') {
                if (Number.isNaN(op.x) || Number.isNaN(op.y) || Number.isNaN(op.w) || Number.isNaN(op.h)) {
                    return true;
                }
            }
        }
        return false;
    }

    hasInfinity() {
        for (const op of this.operations) {
            if (op.type === 'moveTo' || op.type === 'lineTo') {
                if (!Number.isFinite(op.x) || !Number.isFinite(op.y)) {
                    return true;
                }
            }
        }
        return false;
    }

    resetTracking() {
        this.operations = [];
        this.moveToCalls = [];
        this.lineToCalls = [];
        this.clearRectCalls = [];
        this.strokeCalls = 0;
        this.fillCalls = 0;
        this.gradients = [];
    }
}

/**
 * Mock DOM Element implementation
 */
class MockElement {
    constructor(tagName = 'div', id = '', ownerDocument = null) {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this._className = '';
        this.classList = new MockClassList(this);
        this.children = [];
        this.parentElement = null;
        this.ownerDocument = ownerDocument;
        this._innerText = '';
        this._innerHTML = '';
        this.style = {};
        this.checked = false;
        this.title = '';
        this.listeners = new Map();
        this.width = (this.tagName === 'CANVAS') ? 340 : 0;
        this.height = (this.tagName === 'CANVAS') ? 140 : 0;
        this._canvasCtx = (this.tagName === 'CANVAS') ? new MockCanvasContext(this) : null;
    }

    get className() {
        return this._className;
    }

    set className(val) {
        this._className = val || '';
        this.classList._syncFromClassName();
    }

    get innerText() {
        return this._innerText;
    }

    set innerText(val) {
        this._innerText = String(val);
        this._innerHTML = String(val);
    }

    get textContent() {
        return this.innerText;
    }

    set textContent(val) {
        this.innerText = val;
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(val) {
        this._innerHTML = String(val);
        // Simple extraction of text content
        this._innerText = String(val).replace(/<[^>]*>/g, '').trim();
    }

    getContext(type) {
        if (type === '2d') {
            if (!this._canvasCtx) {
                this._canvasCtx = new MockCanvasContext(this);
            }
            return this._canvasCtx;
        }
        return null;
    }

    appendChild(child) {
        if (child instanceof MockElement) {
            child.parentElement = this;
            this.children.push(child);
        }
        return child;
    }

    prepend(child) {
        if (child instanceof MockElement) {
            child.parentElement = this;
            this.children.unshift(child);
        }
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
        }
        return child;
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(handler);
    }

    removeEventListener(type, handler) {
        if (!this.listeners.has(type)) return;
        const list = this.listeners.get(type).filter(h => h !== handler);
        this.listeners.set(type, list);
    }

    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event.type;
        const handlers = this.listeners.get(type) || [];
        for (const handler of handlers) {
            handler.call(this, event);
        }
        if (type === 'click' && typeof this.onclick === 'function') {
            this.onclick.call(this, event);
        }
    }

    click() {
        this.dispatchEvent({ type: 'click', target: this });
    }
}

/**
 * Mock Document implementation
 */
class MockDocument {
    constructor() {
        this.elements = new Map();
        this.listeners = new Map();
    }

    getElementById(id) {
        if (!this.elements.has(id)) {
            const el = new MockElement('div', id, this);
            this.elements.set(id, el);
        }
        return this.elements.get(id);
    }

    createElement(tagName) {
        return new MockElement(tagName, '', this);
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(handler);
    }

    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event.type;
        const handlers = this.listeners.get(type) || [];
        for (const handler of handlers) {
            handler.call(this, event);
        }
    }
}

/**
 * Mock Web Storage (localStorage)
 */
class MockStorage {
    constructor() {
        this._store = new Map();
    }

    getItem(key) {
        return this._store.has(key) ? this._store.get(key) : null;
    }

    setItem(key, value) {
        this._store.set(key, String(value));
    }

    removeItem(key) {
        this._store.delete(key);
    }

    clear() {
        this._store.clear();
    }
}

/**
 * Pre-populates the standard DOM tree matching index.html
 */
function populateStandardDOM(doc) {
    // Top Bar & Metrics
    doc.getElementById('main-menu-screen');
    doc.getElementById('menu-btn-play');
    doc.getElementById('menu-btn-continue');
    doc.getElementById('menu-btn-tutorial');
    doc.getElementById('menu-btn-settings');
    doc.getElementById('menu-btn-about');

    doc.getElementById('direction-modal');
    doc.getElementById('tutorial-modal');
    doc.getElementById('settings-modal');
    doc.getElementById('about-modal');

    const soundCheck = doc.getElementById('setting-sound');
    soundCheck.checked = true;
    const autosaveCheck = doc.getElementById('setting-autosave');
    autosaveCheck.checked = true;

    doc.getElementById('game-screen');
    doc.getElementById('btn-back-to-menu');
    doc.getElementById('company-name-display');
    doc.getElementById('company-dir-display');

    doc.getElementById('money-display').innerText = '$6,000';
    doc.getElementById('income-display').innerText = '+$0/день';
    doc.getElementById('reputation-display').innerText = '⭐ 50';
    doc.getElementById('office-display').innerText = 'Гараж основателей (0/4)';
    doc.getElementById('day-display').innerText = 'День 1';
    doc.getElementById('morale-display').innerText = '😊 85%';

    doc.getElementById('speed-slow-btn');
    doc.getElementById('speed-normal-btn');
    doc.getElementById('pause-btn');
    doc.getElementById('save-btn');

    // HR Panel
    doc.getElementById('total-employees').innerText = 'Сотрудников: 0';
    doc.getElementById('hire-list');

    // Tabs
    doc.getElementById('tab-btn-rd');
    doc.getElementById('tab-btn-office');
    doc.getElementById('tab-btn-bi');
    doc.getElementById('tab-btn-devops');
    doc.getElementById('tab-content-rd');
    doc.getElementById('tab-content-office');
    doc.getElementById('tab-content-bi');
    doc.getElementById('tab-content-devops');
    doc.getElementById('dev-terminal');
    doc.getElementById('terminal-feed');
    doc.getElementById('bi-summary-cards');
    doc.getElementById('pnl-statement-container');
    doc.getElementById('server-rack-display');

    // Projects Panel
    const clickBtn = doc.getElementById('start-click-work');
    clickBtn.innerText = '⚡ Написать код вручную (+$50)';
    doc.getElementById('active-projects-list');

    // Office Panel
    doc.getElementById('current-tier-badge').innerText = 'Уровень 1';
    doc.getElementById('office-showcase');
    doc.getElementById('upgrades-grid');

    // Market Panel
    const canvasEl = doc.getElementById('market-chart');
    canvasEl.tagName = 'CANVAS';
    canvasEl.width = 340;
    canvasEl.height = 140;

    doc.getElementById('stock-price').innerText = '$100';
    doc.getElementById('user-shares').innerText = '0';
    doc.getElementById('portfolio-value').innerText = '$0';
    doc.getElementById('buy-share-btn').innerText = 'Купить ($100)';
    doc.getElementById('sell-share-btn');
    doc.getElementById('latest-news-signal');
    doc.getElementById('news-signal-text');
    doc.getElementById('event-feed');

    // Event Modal
    doc.getElementById('event-modal');
    doc.getElementById('modal-title');
    doc.getElementById('modal-desc');
    doc.getElementById('modal-choices');
}

/**
 * Creates an isolated execution environment running game.js
 * Returns control interface with stepDay, stepMarket, click, etc.
 */
function createGameEnvironment(options = {}) {
    const doc = new MockDocument();
    populateStandardDOM(doc);

    const storage = new MockStorage();
    if (options.initialStorage) {
        for (const [k, v] of Object.entries(options.initialStorage)) {
            storage.setItem(k, v);
        }
    }

    const intervals = new Map();
    let nextIntervalId = 1;

    function customSetInterval(fn, ms) {
        const id = nextIntervalId++;
        intervals.set(id, { fn, ms, id });
        return id;
    }

    function customClearInterval(id) {
        intervals.delete(id);
    }

    const timeouts = new Map();
    let nextTimeoutId = 1;

    function customSetTimeout(fn, ms) {
        const id = nextTimeoutId++;
        timeouts.set(id, { fn, ms, id });
        return id;
    }

    function customClearTimeout(id) {
        timeouts.delete(id);
    }

    const alertLog = [];
    const confirmLog = [];

    // Construct mock window object matching browser environment
    const mockWindow = {
        document: doc,
        localStorage: storage,
        setInterval: customSetInterval,
        clearInterval: customClearInterval,
        setTimeout: customSetTimeout,
        clearTimeout: customClearTimeout,
        alert: (msg) => { alertLog.push(msg); },
        confirm: (msg) => {
            confirmLog.push(msg);
            return options.confirmResult !== undefined ? options.confirmResult : true;
        },
        location: {
            reload: () => {}
        },
        AudioContext: function() {
            return {
                currentTime: 0,
                createOscillator: () => ({
                    type: 'sine',
                    frequency: { setValueAtTime: () => {} },
                    connect: () => {},
                    start: () => {},
                    stop: () => {}
                }),
                createGain: () => ({
                    gain: {
                        setValueAtTime: () => {},
                        exponentialRampToValueAtTime: () => {}
                    },
                    connect: () => {}
                }),
                destination: {}
            };
        },
        addEventListener: (event, handler) => {
            if (!mockWindow._listeners) mockWindow._listeners = new Map();
            if (!mockWindow._listeners.has(event)) mockWindow._listeners.set(event, []);
            mockWindow._listeners.get(event).push(handler);
        },
        _listeners: new Map(),
        console: {
            log: () => {},
            error: () => {},
            warn: () => {},
            info: () => {}
        },
        Math,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        Object,
        Array,
        String,
        Number,
        Boolean,
        RegExp,
        Date,
        Map,
        Set
    };

    mockWindow.window = mockWindow;
    mockWindow.globalThis = mockWindow;

    // VM context setup with mockWindow as root sandbox
    const context = vm.createContext(mockWindow);

    // Read and execute game.js
    const gameSource = fs.readFileSync(GAME_JS_PATH, 'utf-8');
    vm.runInContext(gameSource, context);

    // Bind state and helpers to context
    vm.runInContext(`
        globalThis.getGameState = () => typeof gameState !== 'undefined' ? gameState : null;
        globalThis.setGameState = (newState) => { gameState = newState; };
        globalThis.getOfficeTiers = () => typeof officeTiers !== 'undefined' ? officeTiers : null;
        globalThis.getEquipmentCatalog = () => typeof equipmentCatalog !== 'undefined' ? equipmentCatalog : null;
        globalThis.getDirectionProjectsCatalog = () => typeof directionProjectsCatalog !== 'undefined' ? directionProjectsCatalog : null;
        globalThis.getMarketNewsSignals = () => typeof marketNewsSignals !== 'undefined' ? marketNewsSignals : null;
        globalThis.getGameLoopTimer = () => typeof gameLoopTimer !== 'undefined' ? gameLoopTimer : null;
        globalThis.getMarketTimer = () => typeof marketTimer !== 'undefined' ? marketTimer : null;
    `, context);

    // Trigger DOMContentLoaded
    const domLoadedHandlers = mockWindow._listeners.get('DOMContentLoaded') || [];
    for (const handler of domLoadedHandlers) {
        handler();
    }

    const canvasEl = doc.getElementById('market-chart');
    const canvasCtx = canvasEl.getContext('2d');

    // Helper wrappers
    const env = {
        window: mockWindow,
        document: doc,
        canvas: canvasEl,
        canvasCtx: canvasCtx,
        localStorage: storage,
        alertLog,
        confirmLog,
        intervals,

        get gameState() {
            return context.getGameState();
        },
        set gameState(state) {
            context.setGameState(state);
        },
        get officeTiers() {
            return context.getOfficeTiers();
        },
        get equipmentCatalog() {
            return context.getEquipmentCatalog();
        },
        get directionProjectsCatalog() {
            return context.getDirectionProjectsCatalog();
        },
        get marketNewsSignals() {
            return context.getMarketNewsSignals();
        },

        eval(code) {
            return vm.runInContext(code, context);
        },

        selectCompanyDirection(dirKey = 'ai') {
            if (typeof mockWindow.selectCompanyDirection === 'function') {
                mockWindow.selectCompanyDirection(dirKey);
            } else if (context.selectCompanyDirection) {
                context.selectCompanyDirection(dirKey);
            }
        },

        hireEmployee(type) {
            if (typeof mockWindow.hireEmployee === 'function') {
                mockWindow.hireEmployee(type);
            }
        },

        fireEmployee(type) {
            if (typeof mockWindow.fireEmployee === 'function') {
                mockWindow.fireEmployee(type);
            }
        },

        investInProject(id) {
            if (typeof mockWindow.investInProject === 'function') {
                mockWindow.investInProject(id);
            }
        },

        upgradeOfficeTier() {
            if (typeof mockWindow.upgradeOfficeTier === 'function') {
                mockWindow.upgradeOfficeTier();
            }
        },

        buyEquipment(id) {
            if (typeof mockWindow.buyEquipment === 'function') {
                mockWindow.buyEquipment(id);
            }
        },

        switchCentralTab(tabName) {
            if (typeof mockWindow.switchCentralTab === 'function') {
                mockWindow.switchCentralTab(tabName);
            }
        },

        updateUI() {
            if (typeof context.updateUI === 'function') {
                context.updateUI();
            }
        },

        drawStockChart() {
            if (typeof context.drawStockChart === 'function') {
                context.drawStockChart();
            }
        },

        stepDay(count = 1) {
            const timerId = context.getGameLoopTimer();
            const interval = intervals.get(timerId);
            const stepFn = (interval && typeof interval.fn === 'function') ? interval.fn : () => {
                for (const item of intervals.values()) {
                    if (item.ms === env.gameState.tickSpeed || item.ms === 3000 || item.ms === 5000) {
                        return item.fn();
                    }
                }
            };

            for (let i = 0; i < count; i++) {
                if (env.gameState.isPaused) {
                    const choices = doc.getElementById('modal-choices');
                    if (choices && choices.children && choices.children.length > 0) {
                        choices.children[0].click();
                    } else {
                        env.gameState.isPaused = false;
                    }
                }
                stepFn();
                if (env.gameState.isPaused) {
                    const choices = doc.getElementById('modal-choices');
                    if (choices && choices.children && choices.children.length > 0) {
                        choices.children[0].click();
                    } else {
                        env.gameState.isPaused = false;
                    }
                }
            }
        },

        stepMarket(count = 1) {
            const timerId = context.getMarketTimer();
            const interval = intervals.get(timerId);
            if (interval && typeof interval.fn === 'function') {
                for (let i = 0; i < count; i++) {
                    interval.fn();
                }
            } else {
                for (const item of intervals.values()) {
                    if (item.ms === 5000) {
                        for (let i = 0; i < count; i++) {
                            item.fn();
                        }
                        break;
                    }
                }
            }
        },

        tickBoth(days = 1) {
            // Steps days and market proportionally
            for (let d = 0; d < days; d++) {
                env.stepDay(1);
                // Approx 3s/5s ~ 0.6 market ticks per day
                if (d % 2 === 0) {
                    env.stepMarket(1);
                }
            }
        },

        click(target) {
            const el = typeof target === 'string' ? doc.getElementById(target) : target;
            if (el && typeof el.click === 'function') {
                el.click();
            }
        },

        cleanup() {
            intervals.clear();
            timeouts.clear();
        }
    };

    return env;
}

module.exports = {
    createGameEnvironment,
    MockElement,
    MockDocument,
    MockStorage,
    MockCanvasContext
};
