/**
 * tests/tier4_workloads.test.js
 * 
 * Tier 4: End-to-End Real-World Company Playthrough Workload Scenarios
 * Simulates 100+ day lifecycles from Garage to CyberTower enterprise,
 * exercising full cross-system integration under dynamic market conditions.
 */

const assert = require('node:assert/strict');
const { createGameEnvironment } = require('./harness.js');

function createWorkloadTests() {
    const tests = [];

    function addTest(id, title, fn) {
        tests.push({ id, title, fn });
    }

    // =========================================================================
    // Scenario 1: 120-Day AI Startup to Enterprise Playthrough
    // =========================================================================
    addTest('W1', 'Workload 1: 120-Day AI Startup to Enterprise Playthrough', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        assert.strictEqual(env.gameState.direction, 'ai');

        // Phase 1 (Days 1-20): Garage Phase
        // Hire 2 Juniors
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        // Manual coding clicks
        for (let i = 0; i < 15; i++) env.click('start-click-work');

        // Step 20 days
        env.tickBoth(20);
        assert.strictEqual(env.gameState.day, 21, 'Day must be 21');
        assert.ok(env.gameState.money > 0, 'Must survive Garage phase with positive cash');

        // Phase 2 (Days 21-50): Coworking Expansion
        env.gameState.money = Math.max(env.gameState.money, 15000);
        env.upgradeOfficeTier(); // Office Tier 2 (Coworking)
        assert.strictEqual(env.gameState.officeTier, 2);

        env.hireEmployee('middle');
        env.hireEmployee('marketer');
        env.buyEquipment('optic');
        env.buyEquipment('coffee');

        env.tickBoth(30);
        assert.strictEqual(env.gameState.day, 51);

        // Phase 3 (Days 51-80): GPU Cluster & Server Management
        env.gameState.money = Math.max(env.gameState.money, 35000);
        env.buyEquipment('server');
        env.upgradeOfficeTier(); // Office Tier 3 (Business Center)
        assert.strictEqual(env.gameState.officeTier, 3);

        env.hireEmployee('senior');
        env.tickBoth(30);
        assert.strictEqual(env.gameState.day, 81);

        // Phase 4 (Days 81-120): Enterprise Scaling
        env.tickBoth(40);
        assert.strictEqual(env.gameState.day, 121, 'Should reach Day 121 (120 full days simulated)');

        // End of run assertions
        assert.ok(env.gameState.money > -5000, 'Company must not be bankrupt');
        assert.ok(!Number.isNaN(env.gameState.stocks.price), 'Stock price must not be NaN');
        assert.ok(env.gameState.stocks.history.length >= 25, 'Stock history must be maintained');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Canvas operations must have zero NaN');

        env.cleanup();
    });

    // =========================================================================
    // Scenario 2: GameDev Studio with Bear Market Stress Test (100 Days)
    // =========================================================================
    addTest('W2', 'Workload 2: GameDev Studio with Bear Market Stress Test (100 Days)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('gamedev');
        assert.strictEqual(env.gameState.direction, 'gamedev');

        // Days 1-30: Hire staff, invest in shares during normal market
        env.hireEmployee('junior');
        env.hireEmployee('middle');
        env.gameState.money += 5000;
        
        // Buy 5 shares
        for (let i = 0; i < 5; i++) {
            if (env.gameState.money >= env.gameState.stocks.price) {
                env.click('buy-share-btn');
            }
        }
        env.tickBoth(30);
        assert.strictEqual(env.gameState.day, 31);

        // Days 31-60: Bear Market Crisis hits
        env.gameState.stocks.marketTrend = -1.0;
        env.gameState.stocks.price = Math.min(env.gameState.stocks.price, 30);
        
        // Player buys coffee to support workforce during crisis
        env.gameState.money += 2000;
        env.buyEquipment('coffee');

        env.tickBoth(30);
        assert.strictEqual(env.gameState.day, 61);

        // Days 61-100: Market stabilizes, complete game projects
        env.tickBoth(40);
        assert.strictEqual(env.gameState.day, 101, 'Should reach Day 101 (100 full days)');
        assert.ok(env.gameState.stocks.price >= 10, 'Stock price must survive bear market crash without dropping below 10');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'No NaN in chart under bear market');

        env.cleanup();
    });

    // =========================================================================
    // Scenario 3: CyberSec High-Load Scaling with Production Outage (100 Days)
    // =========================================================================
    addTest('W3', 'Workload 3: CyberSec High-Load Scaling with Production Outage (100 Days)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('cybersec');
        assert.strictEqual(env.gameState.direction, 'cybersec');

        // Days 1-40: Complete Tier 1 products, hire Senior dev
        env.gameState.officeTier = 2;
        env.hireEmployee('junior');
        env.hireEmployee('senior');

        const p1 = env.gameState.projects[0];
        p1.completed = true;
        p1.passiveIncome = 150;
        p1.serverCost = 15;

        env.tickBoth(40);
        assert.strictEqual(env.gameState.day, 41);

        // Days 41-70: Production incident strikes
        p1.hasBug = true;
        env.tickBoth(10);

        // Hotfix or auto-triage bug
        env.gameState.money = Math.max(env.gameState.money, 5000);
        p1.hasBug = false;

        env.tickBoth(20);
        assert.strictEqual(env.gameState.day, 71);

        // Days 71-100: Scaling up to Day 100
        env.tickBoth(30);
        assert.strictEqual(env.gameState.day, 101, 'Must reach Day 101');
        assert.ok(env.gameState.reputation >= 0 && env.gameState.reputation <= 100, `Reputation must stay bounded [0, 100], got ${env.gameState.reputation}`);
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Canvas chart clean throughout');

        env.cleanup();
    });

    // =========================================================================
    // Scenario 4: Aggressive Stock Trading & Capital Acceleration (100 Days)
    // =========================================================================
    addTest('W4', 'Workload 4: Aggressive Stock Trading & Capital Acceleration (100 Days)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        let totalTrades = 0;
        // 100 days of active swing trading based on signals
        for (let d = 0; d < 100; d++) {
            // Market step
            env.stepMarket(1);
            if (d % 2 === 0) env.stepDay(1);

            // Simple trading strategy: buy when price < 80 and have cash, sell when price > 130 and own shares
            if (env.gameState.stocks.price < 80 && env.gameState.money >= env.gameState.stocks.price) {
                env.click('buy-share-btn');
                totalTrades++;
            } else if (env.gameState.stocks.price > 130 && env.gameState.stocks.userOwned > 0) {
                env.click('sell-share-btn');
                totalTrades++;
            }
        }

        assert.ok(env.gameState.stocks.history.length >= 25, 'History must be populated');
        assert.strictEqual(typeof env.gameState.stocks.userOwned, 'number');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'No NaN in trading chart');
        env.cleanup();
    });

    // =========================================================================
    // Scenario 5: Minimalist Manual Coding & Bootstrap Run (100 Days)
    // =========================================================================
    addTest('W5', 'Workload 5: Minimalist Manual Coding & Bootstrap Run (100 Days)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        // Zero employees for first 30 days
        for (const emp of Object.values(env.gameState.employees)) {
            emp.count = 0;
        }

        // Daily manual clicking
        for (let d = 0; d < 30; d++) {
            env.click('start-click-work');
            env.stepDay(1);
        }
        assert.strictEqual(env.gameState.day, 31);
        assert.ok(env.gameState.money > 6000, `Money must grow through solo click freelancing, got ${env.gameState.money}`);

        // Day 31: Buy optic upgrade
        env.buyEquipment('optic');
        for (let d = 0; d < 20; d++) {
            env.click('start-click-work');
            env.stepDay(1);
        }
        assert.strictEqual(env.gameState.day, 51);

        // Day 51-100: Hire first dev team with accumulated savings
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        for (let d = 0; d < 50; d++) {
            env.stepDay(1);
        }
        assert.strictEqual(env.gameState.day, 101, 'Must reach Day 101');
        assert.ok(env.gameState.money > 0, 'Bootstrap run must maintain positive capital');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'No NaN in chart');

        env.cleanup();
    });

    return tests;
}

async function runTier4() {
    const tests = createWorkloadTests();
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

    return { name: 'Tier 4: End-to-End Workload Playthrough Scenarios', total: tests.length, passed, failed, results };
}

if (require.main === module) {
    runTier4().then(summary => {
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

module.exports = { runTier4, createWorkloadTests };
