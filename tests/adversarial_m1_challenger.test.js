/**
 * tests/adversarial_m1_challenger.test.js
 * 
 * Empirical Adversarial Stress Test Suite for Milestone 1:
 * Canvas Chart Scaling & Rendering Engine (drawStockChart).
 * 
 * Stress-tests drawStockChart under degenerate, extreme, and large-scale price histories:
 * 1. Single point history: [100], [15], [600]
 * 2. Flat history: [50, 50, 50, ...], [15, 15, ...], [600, 600, ...]
 * 3. Alternating extreme values: [15, 600, 15, 600, ...] (2, 4, 50, 500 points)
 * 4. 500 historical data points (random walk, extreme oscillation, monotonic rise/fall)
 * 5. Multi-scale canvas dimensions (340x140 default, 800x400 high-res, 100x50 compact)
 * 
 * Strict Coordinate Auditing:
 * Verifies every single Canvas API call receives finite, real numbers
 * (never NaN, Infinity, or negative / out-of-bounds coordinates).
 */

const assert = require('node:assert');
const { createGameEnvironment } = require('./harness.js');

/**
 * Strict Auditing Canvas Context
 * Intercepts and rigorously validates every coordinate in canvas rendering operations.
 */
class AuditingCanvasContext {
    constructor(width = 340, height = 140) {
        this.canvas = { width, height };
        this.strokeStyle = '#000000';
        this.fillStyle = '#000000';
        this.lineWidth = 1;
        this.operations = [];
        this.auditedCoordsCount = 0;
        this.minX = Infinity;
        this.maxX = -Infinity;
        this.minY = Infinity;
        this.maxY = -Infinity;
        this.violations = [];
    }

    _audit(val, name, minBound = 0, maxBound = Infinity) {
        this.auditedCoordsCount++;
        if (typeof val !== 'number') {
            this.violations.push(`${name} is not a number: ${typeof val} (${val})`);
            return;
        }
        if (Number.isNaN(val)) {
            this.violations.push(`${name} is NaN!`);
            return;
        }
        if (!Number.isFinite(val)) {
            this.violations.push(`${name} is non-finite (${val})!`);
            return;
        }
        if (val < minBound) {
            this.violations.push(`${name} is negative or below min (${val} < ${minBound})!`);
            return;
        }
        if (val > maxBound) {
            this.violations.push(`${name} exceeds upper bound (${val} > ${maxBound})!`);
            return;
        }
    }

    _trackX(x) {
        this._audit(x, 'coord.x', 0, this.canvas.width + 0.001);
        if (Number.isFinite(x)) {
            this.minX = Math.min(this.minX, x);
            this.maxX = Math.max(this.maxX, x);
        }
    }

    _trackY(y) {
        this._audit(y, 'coord.y', 0, this.canvas.height + 0.001);
        if (Number.isFinite(y)) {
            this.minY = Math.min(this.minY, y);
            this.maxY = Math.max(this.maxY, y);
        }
    }

    clearRect(x, y, w, h) {
        this._audit(x, 'clearRect.x', 0, this.canvas.width);
        this._audit(y, 'clearRect.y', 0, this.canvas.height);
        this._audit(w, 'clearRect.w', 0, this.canvas.width);
        this._audit(h, 'clearRect.h', 0, this.canvas.height);
        this.operations.push({ type: 'clearRect', x, y, w, h });
    }

    beginPath() {
        this.operations.push({ type: 'beginPath' });
    }

    moveTo(x, y) {
        this._trackX(x);
        this._trackY(y);
        this.operations.push({ type: 'moveTo', x, y });
    }

    lineTo(x, y) {
        this._trackX(x);
        this._trackY(y);
        this.operations.push({ type: 'lineTo', x, y });
    }

    stroke() {
        this.operations.push({ type: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    }

    fill() {
        this.operations.push({ type: 'fill', fillStyle: this.fillStyle });
    }

    fillRect(x, y, w, h) {
        this._audit(x, 'fillRect.x', 0, this.canvas.width);
        this._audit(y, 'fillRect.y', 0, this.canvas.height);
        this._audit(w, 'fillRect.w', 0, this.canvas.width);
        this._audit(h, 'fillRect.h', 0, this.canvas.height);
        this.operations.push({ type: 'fillRect', x, y, w, h });
    }

    arc(x, y, r, startAngle, endAngle) {
        this._trackX(x);
        this._trackY(y);
        this._audit(r, 'arc.r', 0, 100);
        this._audit(startAngle, 'arc.startAngle', -100, 100);
        this._audit(endAngle, 'arc.endAngle', -100, 100);
        this.operations.push({ type: 'arc', x, y, r, startAngle, endAngle });
    }

    closePath() {
        this.operations.push({ type: 'closePath' });
    }

    createLinearGradient(x0, y0, x1, y1) {
        this._audit(x0, 'grad.x0', 0, this.canvas.width);
        this._audit(y0, 'grad.y0', 0, this.canvas.height);
        this._audit(x1, 'grad.x1', 0, this.canvas.width);
        this._audit(y1, 'grad.y1', 0, this.canvas.height);
        const grad = {
            x0, y0, x1, y1,
            colorStops: [],
            addColorStop(offset, color) {
                this.colorStops.push({ offset, color });
            }
        };
        this.operations.push({ type: 'createLinearGradient', gradient: grad });
        return grad;
    }
}

/**
 * Test Runner Function
 */
async function runAdversarialM1Suite() {
    const baseEnv = createGameEnvironment();
    baseEnv.selectCompanyDirection('ai');
    const drawStockChart = baseEnv.eval('drawStockChart');

    const results = [];
    let totalAssertions = 0;
    let totalCoordinatesAudited = 0;

    function test(title, fn) {
        const start = Date.now();
        try {
            fn();
            const duration = Date.now() - start;
            results.push({ title, passed: true, duration });
            console.log(`  [PASS] ${title} (${duration}ms)`);
        } catch (err) {
            const duration = Date.now() - start;
            results.push({ title, passed: false, duration, error: err });
            console.error(`  [FAIL] ${title} (${duration}ms)\n         Error: ${err.message}`);
        }
    }

    console.log('='.repeat(78));
    console.log('  EMPIRICAL CHALLENGER: MILESTONE 1 ADVERSARIAL STRESS HARNESS');
    console.log('='.repeat(78));
    console.log(`Target: drawStockChart in game.js`);
    console.log(`Execution Mode: Strict Headless Coordinate Auditing\n`);

    // =========================================================================
    // Scenario 1: Single Point History ([100], [15], [600])
    // =========================================================================
    console.log('--- SCENARIO 1: Single Point History ---');

    test('1.1: Single point history [100] renders center point & horizon without NaN/Infinity', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        drawStockChart(ctx.canvas, ctx, [100]);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.auditedCoordsCount > 0, 'Audited coordinates count must be > 0');
        
        // Check for specific single-point elements: line and center circle marker
        const arcs = ctx.operations.filter(op => op.type === 'arc');
        assert.strictEqual(arcs.length, 1, 'Must render exactly 1 marker arc for single point');
        assert.strictEqual(arcs[0].x, 170, 'Center circle marker must be at x = w / 2 (170)');
        assert.strictEqual(arcs[0].y, 70, 'Center circle marker must be at y = padTop + plotH / 2 (70)');
        
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 4;
    });

    test('1.2: Single point boundary minimum [15] renders safely with valid coordinates', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        drawStockChart(ctx.canvas, ctx, [15]);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 0 && ctx.maxY <= 140, 'Y coordinates must be within [0, 140]');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('1.3: Single point boundary maximum [600] renders safely with valid coordinates', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        drawStockChart(ctx.canvas, ctx, [600]);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 0 && ctx.maxY <= 140, 'Y coordinates must be within [0, 140]');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    // =========================================================================
    // Scenario 2: Flat Price History ([50, 50, ...], [15, ...], [600, ...])
    // =========================================================================
    console.log('\n--- SCENARIO 2: Flat Price History (Zero-Division Stress) ---');

    test('2.1: Flat sequence [50, 50, 50, 50, 50] handles zero span with zero-division guard', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const flatHistory = [50, 50, 50, 50, 50];
        drawStockChart(ctx.canvas, ctx, flatHistory);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.auditedCoordsCount >= flatHistory.length * 2, 'Must audit all points');
        
        // In flat history, span = 0, padding = max(10, 50*0.15) = 10, minVal = 40, maxVal = 60, range = 20.
        // val 50 -> (50 - 40) / 20 = 0.5. y = 12 + 116 - 0.5 * 116 = 70.
        // Find the stroke operation for the trend line (lineWidth === 2.5)
        const trendStrokeIdx = ctx.operations.findIndex(op => op.type === 'stroke' && op.lineWidth === 2.5);
        assert.ok(trendStrokeIdx > 0, 'Must have a stroke operation for the trend line');

        // Look back from trendStrokeIdx to the preceding beginPath
        let startIdx = trendStrokeIdx - 1;
        while (startIdx >= 0 && ctx.operations[startIdx].type !== 'beginPath') {
            startIdx--;
        }

        const trendOps = ctx.operations.slice(startIdx, trendStrokeIdx);
        const trendPoints = trendOps.filter(op => op.type === 'moveTo' || op.type === 'lineTo');
        assert.strictEqual(trendPoints.length, flatHistory.length, `Must have ${flatHistory.length} trend points`);
        for (const pt of trendPoints) {
            assert.strictEqual(Math.round(pt.y), 70, `Flat point y should be 70, got ${pt.y}`);
        }

        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 4;
    });

    test('2.2: Flat sequence at floor boundary [15, 15, 15, 15, 15, 15, 15, 15, 15, 15]', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const flatFloor = new Array(10).fill(15);
        drawStockChart(ctx.canvas, ctx, flatFloor);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 12 && ctx.maxY <= 128, `Coordinates must stay within padded plot area [12, 128], got [${ctx.minY}, ${ctx.maxY}]`);
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('2.3: Flat sequence at ceiling boundary [600, 600, 600, 600, 600, 600, 600, 600, 600, 600]', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const flatCeiling = new Array(10).fill(600);
        drawStockChart(ctx.canvas, ctx, flatCeiling);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 12 && ctx.maxY <= 128, `Coordinates must stay within padded plot area [12, 128], got [${ctx.minY}, ${ctx.maxY}]`);
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('2.4: Flat 2-point history [100, 100] (minimal multi-point sequence)', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        drawStockChart(ctx.canvas, ctx, [100, 100]);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.strictEqual(ctx.minX, 0, 'First point at x = 0');
        assert.strictEqual(ctx.maxX, 340, 'Second point at x = 340');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 3;
    });

    // =========================================================================
    // Scenario 3: Alternating Extreme Values ([15, 600, 15, 600, ...])
    // =========================================================================
    console.log('\n--- SCENARIO 3: Alternating Extreme Values (Dynamic Range Stress) ---');

    test('3.1: 4-point alternating extremes [15, 600, 15, 600]', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const alt = [15, 600, 15, 600];
        drawStockChart(ctx.canvas, ctx, alt);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        // Padding is 15% of span (585 * 0.15 = 87.75), so minVal = 0, maxVal = 687.75
        // Prices 15 and 600 must be safely mapped within [12, 128]
        assert.ok(ctx.minY >= 12, `minY (${ctx.minY}) must respect padTop (12)`);
        assert.ok(ctx.maxY <= 128, `maxY (${ctx.maxY}) must respect padBottom (128)`);
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 3;
    });

    test('3.2: 50-point high-frequency oscillation between $15 and $600', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const alt50 = [];
        for (let i = 0; i < 50; i++) alt50.push(i % 2 === 0 ? 15 : 600);
        drawStockChart(ctx.canvas, ctx, alt50);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 12 && ctx.maxY <= 128, 'Coordinates strictly inside padded boundaries');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    // =========================================================================
    // Scenario 4: 500 Historical Data Points (High Density & Stack Stress)
    // =========================================================================
    console.log('\n--- SCENARIO 4: 500 Historical Data Points (Large Scale Stress) ---');

    test('4.1: 500 points alternating between $15 and $600', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const points500 = [];
        for (let i = 0; i < 500; i++) points500.push(i % 2 === 0 ? 15 : 600);

        drawStockChart(ctx.canvas, ctx, points500);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.auditedCoordsCount >= 1000, `Expected over 1000 audited coords, got ${ctx.auditedCoordsCount}`);
        assert.strictEqual(ctx.minX, 0, 'minX must be 0');
        assert.strictEqual(ctx.maxX, 340, 'maxX must be canvas width 340');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 4;
    });

    test('4.2: 500 points realistic continuous stochastic random walk with news shocks', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const walk = [100];
        let price = 100.0;
        for (let i = 1; i < 500; i++) {
            const delta = (Math.random() * 0.10) - 0.05; // -5% to +5%
            const newsImpulse = (i % 50 === 0) ? (Math.random() > 0.5 ? 0.15 : -0.15) : 0;
            price = Math.max(15, Math.min(600, price * (1 + delta + newsImpulse)));
            walk.push(Math.round(price));
        }

        drawStockChart(ctx.canvas, ctx, walk);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 12 && ctx.maxY <= 128, `Random walk coords [${ctx.minY}, ${ctx.maxY}] stay within bounds`);
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('4.3: 500 points strictly monotonic ascending (15 -> 600)', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const ascending = [];
        for (let i = 0; i < 500; i++) {
            ascending.push(15 + (585 * i / 499));
        }

        drawStockChart(ctx.canvas, ctx, ascending);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        // Verify trend color is green for growth
        const strokeOps = ctx.operations.filter(op => op.type === 'stroke');
        const lastStroke = strokeOps[strokeOps.length - 1];
        assert.strictEqual(lastStroke.strokeStyle, '#2ea043', 'Ascending history must render green line (#2ea043)');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('4.4: 500 points strictly monotonic descending (600 -> 15)', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const descending = [];
        for (let i = 0; i < 500; i++) {
            descending.push(600 - (585 * i / 499));
        }

        drawStockChart(ctx.canvas, ctx, descending);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        // Verify trend color is red for decline
        const strokeOps = ctx.operations.filter(op => op.type === 'stroke');
        const lastStroke = strokeOps[strokeOps.length - 1];
        assert.strictEqual(lastStroke.strokeStyle, '#f85149', 'Descending history must render red line (#f85149)');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('4.5: 500 points flat boundary minimum [15, 15, ... 15]', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const flat500 = new Array(500).fill(15);

        drawStockChart(ctx.canvas, ctx, flat500);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 12 && ctx.maxY <= 128, 'Coordinates within bounds');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    // =========================================================================
    // Scenario 5: Extended Edge Cases & Resilience Testing
    // =========================================================================
    console.log('\n--- SCENARIO 5: Extended Edge Cases & Dimensions ---');

    test('5.1: Empty history array [] exits gracefully without rendering operations or errors', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        drawStockChart(ctx.canvas, ctx, []);

        assert.strictEqual(ctx.operations.length, 0, 'Must not perform any operations on empty history');
        assert.strictEqual(ctx.violations.length, 0);
        totalAssertions += 2;
    });

    test('5.2: 1000 points history (stress test JS argument spread on Math.min/Math.max)', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const points1000 = [];
        for (let i = 0; i < 1000; i++) points1000.push(15 + Math.sin(i / 10) * 200 + 200);

        drawStockChart(ctx.canvas, ctx, points1000);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.auditedCoordsCount > 2000, 'Audited coords count > 2000');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('5.3: Fractional price inputs with micro-decimals [100.0001, 100.0005, 100.0002]', () => {
        const ctx = new AuditingCanvasContext(340, 140);
        const micro = [100.0001, 100.0005, 100.0002];

        drawStockChart(ctx.canvas, ctx, micro);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.ok(ctx.minY >= 12 && ctx.maxY <= 128, 'Y coordinates stay bounded');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 2;
    });

    test('5.4: High-resolution Canvas (800x400)', () => {
        const ctx = new AuditingCanvasContext(800, 400);
        const pts = [50, 200, 15, 600, 300];

        drawStockChart(ctx.canvas, ctx, pts);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.strictEqual(ctx.maxX, 800, 'maxX matches high-res canvas width');
        assert.ok(ctx.maxY <= 388, 'maxY matches high-res padBottom (400 - 12 = 388)');
        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 3;
    });

    test('5.5: Compact Canvas (120x60)', () => {
        const ctx = new AuditingCanvasContext(120, 60);
        const pts = [100, 200, 150];

        drawStockChart(ctx.canvas, ctx, pts);

        assert.strictEqual(ctx.violations.length, 0, `Violations found: ${ctx.violations.join(', ')}`);
        assert.strictEqual(ctx.maxX, 120, 'maxX matches compact canvas width');
        assert.ok(ctx.maxY <= 60, 'All coordinates stay within compact canvas height (60)');

        // Verify trend points specifically stay within padded bounds [12, 48]
        const trendStrokeIdx = ctx.operations.findIndex(op => op.type === 'stroke' && op.lineWidth === 2.5);
        let startIdx = trendStrokeIdx - 1;
        while (startIdx >= 0 && ctx.operations[startIdx].type !== 'beginPath') {
            startIdx--;
        }
        const trendPoints = ctx.operations.slice(startIdx, trendStrokeIdx).filter(op => op.type === 'moveTo' || op.type === 'lineTo');
        for (const pt of trendPoints) {
            assert.ok(pt.y >= 12 && pt.y <= 48, `Trend point y (${pt.y}) must be within [12, 48]`);
        }

        totalCoordinatesAudited += ctx.auditedCoordsCount;
        totalAssertions += 4;
    });

    test('5.6: Integration with createGameEnvironment() full headless browser harness', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        // Test with 500 points directly in gameState
        const points500 = [];
        for (let i = 0; i < 500; i++) points500.push(Math.round(50 + 200 * Math.sin(i / 15)));
        env.gameState.stocks.history = points500;

        env.canvasCtx.resetTracking();
        env.drawStockChart();

        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Harness reports zero NaN');
        assert.strictEqual(env.canvasCtx.hasInfinity(), false, 'Harness reports zero Infinity');
        assert.ok(env.canvasCtx.operations.length > 500, 'Harness operations recorded');
        env.cleanup();
        totalAssertions += 3;
    });

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n' + '='.repeat(78));
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log(`TOTAL ASSERTIONS VERIFIED: ${totalAssertions}`);
    console.log(`TOTAL CANVAS COORDINATES AUDITED: ${totalCoordinatesAudited}`);
    console.log(`ALL COORDINATES FINITE & REAL: ${failedCount === 0 ? 'YES (100% VALID)' : 'NO'}`);
    console.log('='.repeat(78));

    baseEnv.cleanup();

    return {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        assertions: totalAssertions,
        auditedCoords: totalCoordinatesAudited,
        results
    };
}

if (require.main === module) {
    runAdversarialM1Suite().then(res => {
        process.exit(res.failed > 0 ? 1 : 0);
    }).catch(err => {
        console.error('Fatal crash in stress runner:', err);
        process.exit(1);
    });
}

module.exports = { runAdversarialM1Suite, AuditingCanvasContext };
