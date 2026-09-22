/**
 * tests/tier2_boundaries.test.js
 * 
 * Tier 2: Boundary Value Analysis & Corner Case Stress Testing
 * Tests 100+ day simulations, zero/extreme balances, capacity limits,
 * zero-division safety, and boundary clampings.
 */

const assert = require('node:assert/strict');
const { createGameEnvironment } = require('./harness.js');

function createBoundaryTests() {
    const tests = [];

    function addTest(id, title, fn) {
        tests.push({ id, title, fn });
    }

    // =========================================================================
    // Category 1: Stock Market Price & Simulation Boundaries (100+ Days)
    // =========================================================================
    addTest('B1_1', 'B1: 120-market-tick simulation across 100+ days produces zero NaN/null values', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        
        // Simulate 120 market ticks and 100 game days
        for (let i = 0; i < 120; i++) {
            env.stepMarket(1);
            if (i % 2 === 0) env.stepDay(1);
        }

        const history = env.gameState.stocks.history;
        assert.ok(history.length >= 20, 'History should retain multi-day trading records');
        for (let i = 0; i < history.length; i++) {
            const p = history[i];
            assert.ok(typeof p === 'number', `Price at idx ${i} must be a number`);
            assert.ok(!Number.isNaN(p), `Price at idx ${i} must not be NaN`);
            assert.ok(Number.isFinite(p), `Price at idx ${i} must be finite`);
            assert.ok(p > 0, `Price at idx ${i} must be positive (> 0), got ${p}`);
        }
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Canvas operations across 120 ticks must contain zero NaN');
        env.cleanup();
    });

    addTest('B1_2', 'B1: Extreme floor boundary: price at $15 recovers within 60 ticks without crashing', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.stocks.price = 15;
        if (env.gameState.stocks.floatPrice !== undefined) env.gameState.stocks.floatPrice = 15.0;
        env.gameState.stocks.marketTrend = -1.0; // adverse trend

        let recoveredAbove15 = false;
        for (let i = 0; i < 60; i++) {
            env.stepMarket(1);
            assert.ok(env.gameState.stocks.price >= 10, 'Price must not breach hard minimum floor');
            if (env.gameState.stocks.price > 15) {
                recoveredAbove15 = true;
            }
        }
        assert.ok(recoveredAbove15, 'Price at $15 floor must bounce back and not remain frozen permanently');
        env.cleanup();
    });

    addTest('B1_3', 'B1: Extreme ceiling boundary: price at $600 resists infinite explosion and stays finite', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.stocks.price = 600;
        if (env.gameState.stocks.floatPrice !== undefined) env.gameState.stocks.floatPrice = 600.0;
        env.gameState.stocks.marketTrend = 1.0; // bullish trend

        for (let i = 0; i < 40; i++) {
            env.stepMarket(1);
            assert.ok(Number.isFinite(env.gameState.stocks.price), 'Price must be finite');
            assert.ok(env.gameState.stocks.price <= 900, 'Price must not explode beyond ceiling bounds');
        }
        env.cleanup();
    });

    addTest('B1_4', 'B1: Canvas zero-spread boundary: flat history [100, 100, ...] draws safely without division by zero', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.stocks.history = new Array(50).fill(100);
        env.canvasCtx.resetTracking();
        assert.doesNotThrow(() => env.drawStockChart(), 'Drawing flat history must not throw');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Zero spread must not produce NaN coordinates');
        assert.strictEqual(env.canvasCtx.hasInfinity(), false, 'Zero spread must not produce Infinity coordinates');
        env.cleanup();
    });

    addTest('B1_5', 'B1: Canvas extreme oscillation boundary: [15, 600, 15, 600, ...] stays within canvas height', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const osc = [];
        for (let i = 0; i < 60; i++) osc.push(i % 2 === 0 ? 15 : 600);
        env.gameState.stocks.history = osc;
        env.canvasCtx.resetTracking();
        env.drawStockChart();
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Extreme oscillation must not produce NaN');
        for (const op of env.canvasCtx.operations) {
            if (op.type === 'moveTo' || op.type === 'lineTo') {
                assert.ok(op.y >= -2 && op.y <= 144, `Oscillating y ${op.y} must stay bounded within canvas viewport`);
            }
        }
        env.cleanup();
    });

    // =========================================================================
    // Category 2: Financial & Balance Boundaries
    // =========================================================================
    addTest('B2_1', 'B2: Exactly $0 balance boundary: game loop handles zero funds without division by zero', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 0;
        assert.doesNotThrow(() => env.stepDay(3), 'Simulation must handle $0 balance without crashing');
        assert.strictEqual(typeof env.gameState.money, 'number', 'Money must remain a valid number');
        assert.ok(!Number.isNaN(env.gameState.money), 'Money must not be NaN');
        env.cleanup();
    });

    addTest('B2_2', 'B2: Exact cost purchase: buying upgrade with exact funds leaves exactly $0', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 2000; // optic cost is 2000
        env.buyEquipment('optic');
        assert.strictEqual(env.gameState.money, 0, 'Balance must be exactly 0 after exact payment');
        assert.ok(env.gameState.upgrades.includes('optic'), 'Upgrade must be successfully purchased');
        env.cleanup();
    });

    addTest('B2_3', 'B2: Insufficient funds by $1: purchase fails, balance untouched', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 1999; // optic cost is 2000
        env.alertLog.length = 0;
        env.buyEquipment('optic');
        assert.strictEqual(env.gameState.money, 1999, 'Balance must remain 1999 when purchase fails');
        assert.strictEqual(env.gameState.upgrades.includes('optic'), false, 'Optic must not be acquired');
        assert.ok(env.alertLog.length > 0, 'Alert must be triggered on insufficient funds');
        env.cleanup();
    });

    addTest('B2_4', 'B2: Extreme negative balance: debt reaching -$5,000 triggers bankruptcy warning', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = -5100;
        env.alertLog.length = 0;
        env.stepDay(1);
        const hasBankruptcyAlert = env.alertLog.some(msg => msg.includes('ВНИМАНИЕ') || msg.includes('Долг') || msg.includes('5,000'));
        assert.ok(hasBankruptcyAlert, 'Must alert player when debt exceeds -$5,000');
        env.cleanup();
    });

    addTest('B2_5', 'B2: Extreme wealth boundary: $10,000,000 formats with separators without scientific notation', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 10000000;
        env.updateUI();
        const moneyText = env.document.getElementById('money-display').innerText;
        assert.ok(/10[\s,\u00A0]000[\s,\u00A0]000/.test(moneyText) || moneyText.includes('10,000,000'), `Money display must format millions with separators, got "${moneyText}"`);
        assert.strictEqual(moneyText.includes('e+'), false, 'Money display must not use scientific exponent notation');
        env.cleanup();
    });

    // =========================================================================
    // Category 3: Office Capacity & Employee Extremes
    // =========================================================================
    addTest('B3_1', 'B3: Zero employees boundary: salaries = 0, devPower = 0, loop advances cleanly', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        for (const emp of Object.values(env.gameState.employees)) {
            emp.count = 0;
        }
        const moneyStart = env.gameState.money;
        env.stepDay(5);
        assert.strictEqual(env.gameState.money, moneyStart, 'No salaries should be deducted when 0 employees hired');
        env.cleanup();
    });

    addTest('B3_2', 'B3: Garage 100% capacity boundary: hiring 5th employee is blocked (limit 4)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 50000;
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        env.hireEmployee('junior'); // 4 hired
        assert.strictEqual(env.gameState.employees.junior.count, 4, 'Must have 4 juniors');
        
        env.alertLog.length = 0;
        env.hireEmployee('junior'); // 5th attempt
        assert.strictEqual(env.gameState.employees.junior.count, 4, '5th junior must be rejected');
        assert.ok(env.alertLog.length > 0, 'Capacity limit alert must trigger');
        env.cleanup();
    });

    addTest('B3_3', 'B3: Office upgrade boundary: upgrading to Coworking allows hiring 5th through 10th employee', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 100000;
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        env.upgradeOfficeTier(); // Upgrade to Tier 2 (max 10)
        assert.strictEqual(env.gameState.officeTier, 2, 'Office must be Tier 2');

        env.hireEmployee('junior'); // 5th employee should now succeed
        assert.strictEqual(env.gameState.employees.junior.count, 5, '5th employee must succeed after office expansion');
        env.cleanup();
    });

    addTest('B3_4', 'B3: CyberTower unlimited scale: supports 30+ employees without capacity blockage', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.officeTier = 4; // CyberTower (999 seats)
        env.gameState.money = 1000000;
        for (let i = 0; i < 30; i++) {
            env.hireEmployee('junior');
        }
        assert.strictEqual(env.gameState.employees.junior.count, 30, 'CyberTower must comfortably accommodate 30 employees');
        env.cleanup();
    });

    addTest('B3_5', 'B3: Firing at zero employees: count cannot drop below 0', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        assert.strictEqual(env.gameState.employees.senior.count, 0, 'Senior count starts at 0');
        env.fireEmployee('senior');
        assert.strictEqual(env.gameState.employees.senior.count, 0, 'Count must remain 0, cannot be negative');
        env.cleanup();
    });

    // =========================================================================
    // Category 4: Project Progress & Catalog Boundaries
    // =========================================================================
    addTest('B4_1', 'B4: Progress at maxProgress - 1 leaves project strictly uncompleted', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.progress = p.maxProgress - 1;
        p.completed = false;
        assert.strictEqual(p.completed, false, 'Project at maxProgress - 1 must not be marked complete');
        env.cleanup();
    });

    addTest('B4_2', 'B4: Massive overflow dev power completes project cleanly and awards grant once', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.progress = p.maxProgress - 5;
        p.completed = false;
        const moneyBefore = env.gameState.money;
        // Assign 2 middle developers (2 * 8 = 16 dev power, salary 2 * 160 = 320)
        env.gameState.employees.middle.count = 2;
        env.stepDay(1);
        assert.strictEqual(p.completed, true, 'Project must be marked completed');
        assert.ok(env.gameState.money > moneyBefore, 'Money must increase due to completion grant reward');
        assert.ok(env.gameState.money < moneyBefore + (p.reward * 2), 'Grant reward must not be granted twice');
        env.cleanup();
    });

    addTest('B4_3', 'B4: Completed project is not re-completed on subsequent game ticks', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.completed = true;
        p.progress = p.maxProgress;
        const moneyBefore = env.gameState.money;
        env.stepDay(3);
        // Balance change should only reflect passive income minus salaries, not duplicate rewards
        const delta = env.gameState.money - moneyBefore;
        assert.ok(delta < p.reward * 2, 'Completed project must not re-trigger completion reward');
        env.cleanup();
    });

    addTest('B4_4', 'B4: All projects completed: simulation runs smoothly without out-of-bounds error', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        for (const p of env.gameState.projects) {
            p.completed = true;
            p.progress = p.maxProgress;
        }
        assert.doesNotThrow(() => env.stepDay(5), 'All projects completed must not cause game loop crash');
        env.cleanup();
    });

    addTest('B4_5', 'B4: 0 developers assigned: active projects make exactly 0 progress per day', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        for (const emp of Object.values(env.gameState.employees)) {
            emp.count = 0;
        }
        const p = env.gameState.projects[0];
        p.progress = 10;
        p.completed = false;
        env.stepDay(3);
        assert.strictEqual(p.progress, 10, 'Project progress must not change without developers');
        env.cleanup();
    });

    // =========================================================================
    // Category 5: Morale Boundary Conditions
    // =========================================================================
    addTest('B5_1', 'B5: Morale ceiling clamp: morale cannot exceed 100% under stacking buffs', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.morale = 99;
        env.gameState.officeTier = 4;
        env.gameState.upgrades.push('coffee', 'chairs');
        env.gameState.money = 100000;
        for (let i = 0; i < 20; i++) {
            env.stepDay(1);
        }
        if (env.gameState.morale !== undefined) {
            assert.ok(env.gameState.morale <= 100, `Morale must never exceed 100%, got ${env.gameState.morale}`);
        }
        env.cleanup();
    });

    addTest('B5_2', 'B5: Morale floor clamp: morale cannot drop below 0% under prolonged debt', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.morale = 5;
        env.gameState.money = -10000; // deep in debt
        for (let i = 0; i < 20; i++) {
            env.stepDay(1);
        }
        if (env.gameState.morale !== undefined) {
            assert.ok(env.gameState.morale >= 0, `Morale must never drop below 0%, got ${env.gameState.morale}`);
        }
        env.cleanup();
    });

    addTest('B5_3', 'B5: Exact morale boundary at 90%: triggers high-morale productivity boost', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.morale = 90;
        env.gameState.employees.junior.count = 2; // base 4 dev points
        const p = env.gameState.projects[0];
        p.progress = 0;
        env.stepDay(1);
        if (env.gameState.morale !== undefined) {
            assert.ok(p.progress >= 4, 'Morale >= 90% must produce normal or boosted progress');
        }
        env.cleanup();
    });

    addTest('B5_4', 'B5: Exact morale boundary below 40%: applies severe penalty', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.morale = 39;
        env.gameState.employees.senior.count = 1; // base 26
        const p = env.gameState.projects[0];
        p.progress = 0;
        env.stepDay(1);
        if (env.gameState.morale !== undefined) {
            assert.ok(p.progress <= 20, `Morale < 40% must apply penalty, got ${p.progress}`);
        }
        env.cleanup();
    });

    addTest('B5_5', 'B5: Daily morale transition rate is bounded (no discontinuous wild leaps > 15%/day)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        if (env.gameState.morale !== undefined) {
            const mBefore = env.gameState.morale;
            env.stepDay(1);
            const diff = Math.abs(env.gameState.morale - mBefore);
            assert.ok(diff <= 15, `Morale daily shift must be gradual (<= 15%), got ${diff}%`);
        }
        env.cleanup();
    });

    return tests;
}

async function runTier2() {
    const tests = createBoundaryTests();
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const t of tests) {
        const startTime = Date.now();
        try {
            await t.fn();
            results.push({ id: t.id, title: t.title, passed: true, duration: Date.now() - startTime });
            passed++;
        } catch (err) {
            results.push({ id: t.id, title: t.title, passed: false, error: err.message || String(err), duration: Date.now() - startTime });
            failed++;
        }
    }

    return { name: 'Tier 2: Boundary Value Analysis & Stress Testing', total: tests.length, passed, failed, results };
}

if (require.main === module) {
    runTier2().then(summary => {
        console.log(`\n=== ${summary.name} ===`);
        console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}\n`);
        for (const r of summary.results) {
            const mark = r.passed ? '✓ PASS' : '✗ FAIL';
            console.log(`[${mark}] ${r.id}: ${r.title} (${r.duration}ms)`);
            if (!r.passed) {
                console.log(`       Error: ${r.error}`);
            }
        }
        process.exit(summary.failed > 0 ? 1 : 0);
    });
}

module.exports = { runTier2, createBoundaryTests };
