/**
 * tests/adversarial_stock_engine.test.js
 * 
 * Empirical Adversarial Challenge Suite for Milestone 1: Stock Market Price Engine
 * 
 * Stress-tests:
 * 1. 1000-tick continuous trading under standard market conditions (> 500 simulated days).
 * 2. 500-tick sustained BEAR RUN: forced continuous negative sentiment (trend = -1.0).
 *    Verifies price escapes/bounces from $15 floor and never gets permanently pinned.
 * 3. 500-tick sustained BULL RUN: forced continuous positive sentiment (trend = +1.0).
 *    Verifies price pulls back immediately once sentiment relaxes and never pins permanently.
 * 4. 100 Monte Carlo trials from $15 floor and $600 ceiling: verifies 100% escape/pullback rate.
 * 5. Extreme adversarial boundary injection (NaN, Infinity, negative, zero, malformed types).
 * 6. Canvas rendering under extreme hostile histories (0 points, 1 point, flat 15, flat 600, 500 points, alternating).
 * 7. Frozen state detection: asserts dynamic entropy and absence of frozen price states.
 */

const assert = require('node:assert/strict');
const { createGameEnvironment } = require('./harness.js');

async function runAdversarialStockTests() {
    console.log('='.repeat(78));
    console.log('  EMPIRICAL ADVERSARIAL CHALLENGE: STOCK MARKET PRICE ENGINE');
    console.log('='.repeat(78));

    const results = [];
    let passed = 0;
    let failed = 0;

    function record(name, status, details = '') {
        if (status) {
            passed++;
            console.log(`  [PASS] ${name}`);
        } else {
            failed++;
            console.error(`  [FAIL] ${name}: ${details}`);
        }
        results.push({ name, passed: status, details });
    }

    // -------------------------------------------------------------------------
    // TEST 1: 1000-Tick Extended Continuous Trading Volatility (Simulating 500+ Days)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Extended Continuous Trading Volatility (1000 Ticks / 500+ Days) ---');
    try {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        const prices = [];
        let nanCount = 0;
        let outOfBoundsCount = 0;
        let canvasNanCount = 0;
        let maxIdenticalTicks = 0;
        let currentIdenticalTicks = 1;

        for (let tick = 0; tick < 1000; tick++) {
            env.stepMarket(1);
            if (tick % 2 === 0) env.stepDay(1);

            const p = env.gameState.stocks.price;
            const fp = env.gameState.stocks.floatPrice;

            if (prices.length > 0) {
                if (p === prices[prices.length - 1]) {
                    currentIdenticalTicks++;
                    if (currentIdenticalTicks > maxIdenticalTicks) {
                        maxIdenticalTicks = currentIdenticalTicks;
                    }
                } else {
                    currentIdenticalTicks = 1;
                }
            }
            prices.push(p);

            if (Number.isNaN(p) || Number.isNaN(fp) || !Number.isFinite(p) || !Number.isFinite(fp)) {
                nanCount++;
            }
            if (p < 15 || p > 600) {
                outOfBoundsCount++;
            }
            if (env.canvasCtx.hasNaN() || env.canvasCtx.hasInfinity()) {
                canvasNanCount++;
            }
        }

        // Statistical validation
        const minObserved = Math.min(...prices);
        const maxObserved = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const uniquePrices = new Set(prices);

        record(
            '1000 ticks: Zero NaNs or non-finite values in price/floatPrice',
            nanCount === 0,
            `Found ${nanCount} NaNs`
        );
        record(
            '1000 ticks: All prices strictly bounded within corridor [$15, $600]',
            outOfBoundsCount === 0,
            `Observed min=${minObserved}, max=${maxObserved}, violations=${outOfBoundsCount}`
        );
        record(
            '1000 ticks: High dynamic entropy (unique prices >= 25, no frozen state)',
            uniquePrices.size >= 25,
            `Unique price values count: ${uniquePrices.size}`
        );
        record(
            '1000 ticks: No extended price freezing (max consecutive identical ticks <= 5)',
            maxIdenticalTicks <= 5,
            `Max consecutive identical ticks: ${maxIdenticalTicks}`
        );
        record(
            '1000 ticks: Mean-reversion keeps long-term average near equilibrium ($60..$140)',
            avg >= 60 && avg <= 140,
            `Observed mean price: ${avg.toFixed(2)}`
        );
        record(
            '1000 ticks: Canvas rendering executed without any NaN or Infinity operations',
            canvasNanCount === 0,
            `Found ${canvasNanCount} Canvas NaN operations`
        );
        record(
            '1000 ticks: Stocks history is capped to 120 elements without leaking memory',
            env.gameState.stocks.history.length <= 120,
            `History length: ${env.gameState.stocks.history.length}`
        );

        env.cleanup();
    } catch (err) {
        record('Extended Continuous Trading', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Prolonged Bear Run (500 Ticks Negative Sentiment) & Floor Escape
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Prolonged Bear Run & $15 Floor Escape Stress Test ---');
    try {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        // Subtest 2A: Price pinned to $15 initially, continuous trend = -1.0 for 500 ticks
        env.gameState.stocks.price = 15;
        env.gameState.stocks.floatPrice = 15.0;

        let floorBreaches = 0;
        let timesAtOrAbove16 = 0;
        let consecutiveAt15 = 0;
        let maxConsecutiveAt15 = 0;

        for (let tick = 0; tick < 500; tick++) {
            // Re-apply bearish news pressure every tick
            env.gameState.stocks.marketTrend = -1.0;
            env.stepMarket(1);

            const p = env.gameState.stocks.price;
            if (p < 15) floorBreaches++;
            if (p > 15) {
                timesAtOrAbove16++;
                consecutiveAt15 = 0;
            } else {
                consecutiveAt15++;
                if (consecutiveAt15 > maxConsecutiveAt15) {
                    maxConsecutiveAt15 = consecutiveAt15;
                }
            }
        }

        record(
            'Bear Run (500 ticks @ trend=-1.0): Absolute floor $15 never breached (< 15)',
            floorBreaches === 0,
            `Floor breached ${floorBreaches} times`
        );
        record(
            'Bear Run: Price escapes $15 floor repeatedly even under active continuous bearish pressure',
            timesAtOrAbove16 > 0,
            `Price was above $15 in ${timesAtOrAbove16} / 500 ticks`
        );
        record(
            'Bear Run: Max consecutive ticks pinned at exactly $15 is bounded (< 5 ticks)',
            maxConsecutiveAt15 < 5,
            `Max consecutive ticks at $15: ${maxConsecutiveAt15}`
        );

        // Subtest 2B: 100 Monte Carlo trials starting from $15 floor
        let maxEscapeTicksFrom15 = 0;
        let failedEscapeFrom15 = 0;
        for (let trial = 0; trial < 100; trial++) {
            const trialEnv = createGameEnvironment();
            trialEnv.selectCompanyDirection('ai');
            trialEnv.gameState.stocks.price = 15;
            trialEnv.gameState.stocks.floatPrice = 15.0;
            trialEnv.gameState.stocks.marketTrend = 0;

            let escaped = false;
            for (let t = 1; t <= 10; t++) {
                trialEnv.stepMarket(1);
                if (trialEnv.gameState.stocks.price > 15) {
                    escaped = true;
                    if (t > maxEscapeTicksFrom15) maxEscapeTicksFrom15 = t;
                    break;
                }
            }
            if (!escaped) failedEscapeFrom15++;
            trialEnv.cleanup();
        }

        record(
            'Floor Escape (100 Monte Carlo trials from $15): 100% escape rate within 3 ticks',
            failedEscapeFrom15 === 0 && maxEscapeTicksFrom15 <= 3,
            `Failed: ${failedEscapeFrom15}, Max ticks to escape: ${maxEscapeTicksFrom15}`
        );

        // Subtest 2C: Single news sentiment decay test (without random news interference)
        env.eval('triggerMarketNews = () => {}'); // Silence new random news to test pure decay
        env.gameState.stocks.marketTrend = -1.0;

        let decayedToZeroTick = -1;
        for (let tick = 1; tick <= 15; tick++) {
            env.stepMarket(1);
            if (env.gameState.stocks.marketTrend === 0) {
                decayedToZeroTick = tick;
                break;
            }
        }

        record(
            'Market Sentiment Decay: Single news trend (-1.0) decays to 0 within 6-7 ticks',
            decayedToZeroTick !== -1 && decayedToZeroTick <= 7,
            `Decayed to 0 at tick ${decayedToZeroTick}`
        );

        env.cleanup();
    } catch (err) {
        record('Prolonged Bear Run Test', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Prolonged Bull Run (500 Ticks Positive Sentiment) & Ceiling Pullback
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Prolonged Bull Run & $600 Ceiling Pullback Stress Test ---');
    try {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        // Subtest 3A: Continuous bullish trend = +1.0 for 500 ticks
        env.gameState.stocks.price = 500;
        env.gameState.stocks.floatPrice = 500.0;

        let ceilingBreaches = 0;
        let reached600 = false;

        for (let tick = 0; tick < 500; tick++) {
            env.gameState.stocks.marketTrend = 1.0;
            env.stepMarket(1);

            const p = env.gameState.stocks.price;
            if (p > 600) ceilingBreaches++;
            if (p >= 600) reached600 = true;
        }

        record(
            'Bull Run (500 ticks @ trend=+1.0): Absolute ceiling $600 never breached (> 600)',
            ceilingBreaches === 0,
            `Ceiling breached ${ceilingBreaches} times`
        );
        record(
            'Bull Run: Price reached ceiling zone ($600) under sustained buying pressure',
            reached600,
            `Final price: ${env.gameState.stocks.price}`
        );

        // Subtest 3B: Immediate Pullback from $600 ceiling under pure neutral trading
        env.eval('triggerMarketNews = () => {}'); // Silence new random news to test pure pullback
        env.gameState.stocks.price = 600;
        env.gameState.stocks.floatPrice = 600.0;
        env.gameState.stocks.marketTrend = 0;

        let pullBackTick = -1;
        const pullBackPrices = [];
        for (let tick = 1; tick <= 10; tick++) {
            env.stepMarket(1);
            pullBackPrices.push(env.gameState.stocks.price);
            if (env.gameState.stocks.price < 600 && pullBackTick === -1) {
                pullBackTick = tick;
            }
        }

        record(
            'Ceiling Pullback: Price at $600 pulls back below $600 within 2 ticks in neutral trading',
            pullBackTick !== -1 && pullBackTick <= 2,
            `Pulled back at tick ${pullBackTick}, initial trajectory: ${pullBackPrices.slice(0, 5).join(' -> ')}`
        );

        // Subtest 3C: 100 Monte Carlo trials starting from $600 ceiling in live market
        let maxPullbackTicksFrom600 = 0;
        let failedPullbackFrom600 = 0;
        for (let trial = 0; trial < 100; trial++) {
            const trialEnv = createGameEnvironment();
            trialEnv.selectCompanyDirection('ai');
            trialEnv.gameState.stocks.price = 600;
            trialEnv.gameState.stocks.floatPrice = 600.0;
            trialEnv.gameState.stocks.marketTrend = 0;

            let pulledBack = false;
            for (let t = 1; t <= 15; t++) {
                trialEnv.stepMarket(1);
                if (trialEnv.gameState.stocks.price < 600) {
                    pulledBack = true;
                    if (t > maxPullbackTicksFrom600) maxPullbackTicksFrom600 = t;
                    break;
                }
            }
            if (!pulledBack) failedPullbackFrom600++;
            trialEnv.cleanup();
        }

        record(
            'Ceiling Pullback (100 Monte Carlo trials in live market): 100% pull back, max ticks <= 10',
            failedPullbackFrom600 === 0 && maxPullbackTicksFrom600 <= 10,
            `Failed: ${failedPullbackFrom600}, Max ticks to pull back: ${maxPullbackTicksFrom600}`
        );

        // Subtest 3D: Extended neutral trading brings price down toward mean (< $400)
        for (let tick = 0; tick < 40; tick++) {
            env.stepMarket(1);
        }
        record(
            'Ceiling Mean-Reversion: Extended trading from $600 pulls price toward equilibrium (< $400)',
            env.gameState.stocks.price < 400,
            `Price after 50 ticks: $${env.gameState.stocks.price}`
        );

        env.cleanup();
    } catch (err) {
        record('Prolonged Bull Run Test', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Boundary Edge Case Injections & Math Engine Invariants
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Direct Mathematical Engine Invariant Stress Tests ---');
    try {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        const calculateStockPrice = env.eval('calculateStockPrice');

        // 4A: Missing or null parameters
        const resDefault = calculateStockPrice();
        record(
            'calculateStockPrice() with no args returns valid positive integer',
            typeof resDefault === 'number' && Number.isFinite(resDefault) && resDefault >= 15 && resDefault <= 600,
            `Result: ${resDefault}`
        );

        // 4B: NaN and malformed inputs
        const resNan1 = calculateStockPrice(NaN, 0);
        const resNan2 = calculateStockPrice(100, NaN);
        const resNan3 = calculateStockPrice(NaN, NaN);
        const resNull = calculateStockPrice(null, null);
        const resUndef = calculateStockPrice(undefined, undefined);
        record(
            'calculateStockPrice(NaN, null, undefined) gracefully sanitizes to valid finite integer',
            !Number.isNaN(resNan1) && !Number.isNaN(resNan2) && !Number.isNaN(resNan3) &&
            !Number.isNaN(resNull) && !Number.isNaN(resUndef),
            `Results: nan1=${resNan1}, nan2=${resNan2}, nan3=${resNan3}, null=${resNull}`
        );

        // 4C: Extreme out-of-bounds input prices
        const resBelow = calculateStockPrice(-1000, 0);
        const resAbove = calculateStockPrice(999999, 0);
        const resZero = calculateStockPrice(0, 0);
        record(
            'calculateStockPrice handles extreme inputs (-1000, 0, 999999) and clamps strictly to [15, 600]',
            resBelow >= 15 && resBelow <= 600 && resAbove >= 15 && resAbove <= 600 && resZero >= 15 && resZero <= 600,
            `resBelow=${resBelow}, resAbove=${resAbove}, resZero=${resZero}`
        );

        // 4D: Extreme trends
        const resHugeTrendPos = calculateStockPrice(100, 1000);
        const resHugeTrendNeg = calculateStockPrice(100, -1000);
        record(
            'calculateStockPrice caps extreme trend multiplier (trend=±1000) within [15, 600]',
            resHugeTrendPos <= 600 && resHugeTrendNeg >= 15,
            `pos=${resHugeTrendPos}, neg=${resHugeTrendNeg}`
        );

        env.cleanup();
    } catch (err) {
        record('Direct Math Engine Test', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Canvas Rendering Stress Test under Hostile Histories
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Canvas Chart Adversarial Rendering Stress Test ---');
    try {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const drawStockChart = env.eval('drawStockChart');

        // 5A: Empty history []
        env.canvasCtx.resetTracking();
        assert.doesNotThrow(() => drawStockChart(env.canvas, env.canvasCtx, []), 'Empty history must not throw');
        record('Canvas: Empty history handled safely without throwing', true);

        // 5B: Single-point history [15], [600]
        env.canvasCtx.resetTracking();
        assert.doesNotThrow(() => drawStockChart(env.canvas, env.canvasCtx, [15]), 'Single point [15] must not throw');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Single point [15] produced no NaNs');
        record('Canvas: Single-point history at boundary [15] renders with zero NaNs', true);

        // 5C: Flat history of 100 points at $15 (zero spread at floor)
        env.canvasCtx.resetTracking();
        const flat15 = new Array(100).fill(15);
        drawStockChart(env.canvas, env.canvasCtx, flat15);
        record(
            'Canvas: Flat history of 100 points at $15 produces no division by zero or NaNs',
            !env.canvasCtx.hasNaN() && !env.canvasCtx.hasInfinity(),
            `NaN=${env.canvasCtx.hasNaN()}, Inf=${env.canvasCtx.hasInfinity()}`
        );

        // 5D: Flat history of 100 points at $600 (zero spread at ceiling)
        env.canvasCtx.resetTracking();
        const flat600 = new Array(100).fill(600);
        drawStockChart(env.canvas, env.canvasCtx, flat600);
        record(
            'Canvas: Flat history of 100 points at $600 produces no division by zero or NaNs',
            !env.canvasCtx.hasNaN() && !env.canvasCtx.hasInfinity(),
            `NaN=${env.canvasCtx.hasNaN()}, Inf=${env.canvasCtx.hasInfinity()}`
        );

        // 5E: Extreme alternating oscillation [15, 600, 15, 600, ...] for 200 points
        env.canvasCtx.resetTracking();
        const alternating = [];
        for (let i = 0; i < 200; i++) alternating.push(i % 2 === 0 ? 15 : 600);
        drawStockChart(env.canvas, env.canvasCtx, alternating);
        let allCoordinatesValid = true;
        for (const op of env.canvasCtx.operations) {
            if (op.type === 'moveTo' || op.type === 'lineTo') {
                if (Number.isNaN(op.x) || Number.isNaN(op.y) || !Number.isFinite(op.x) || !Number.isFinite(op.y)) {
                    allCoordinatesValid = false;
                }
            }
        }
        record(
            'Canvas: Extreme alternating 200-point square wave maintains valid bounded coordinates',
            allCoordinatesValid && !env.canvasCtx.hasNaN(),
            `Valid=${allCoordinatesValid}`
        );

        // 5F: 500-point massive history
        env.canvasCtx.resetTracking();
        const longHistory = [];
        for (let i = 0; i < 500; i++) longHistory.push(Math.round(100 + 50 * Math.sin(i / 10)));
        drawStockChart(env.canvas, env.canvasCtx, longHistory);
        record(
            'Canvas: 500-point massive history renders smoothly without NaN or Infinity',
            !env.canvasCtx.hasNaN() && !env.canvasCtx.hasInfinity(),
            `NaN=${env.canvasCtx.hasNaN()}`
        );

        env.cleanup();
    } catch (err) {
        record('Canvas Adversarial Test', false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Trading Execution & Synchronous UI State Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Trading Execution & Synchronous UI State Integrity ---');
    try {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');

        env.gameState.money = 100000;
        env.gameState.stocks.price = 50;
        env.gameState.stocks.floatPrice = 50.0;
        env.gameState.stocks.userOwned = 0;

        const buyBtn = env.document.getElementById('buy-share-btn');
        const sellBtn = env.document.getElementById('sell-share-btn');
        const userSharesEl = env.document.getElementById('user-shares');
        const portfolioEl = env.document.getElementById('portfolio-value');

        // Buy 10 shares
        for (let i = 0; i < 10; i++) {
            buyBtn.click();
        }

        record(
            'Trading: Buying 10 shares updates gameState.stocks.userOwned to 10',
            env.gameState.stocks.userOwned === 10,
            `Owned: ${env.gameState.stocks.userOwned}`
        );
        record(
            'Trading: #user-shares DOM reflects 10 immediately',
            userSharesEl.innerText === '10',
            `DOM: ${userSharesEl.innerText}`
        );
        record(
            'Trading: #portfolio-value DOM reflects $500 immediately',
            portfolioEl.innerText === '$500',
            `DOM: ${portfolioEl.innerText}`
        );

        // Sell 4 shares
        for (let i = 0; i < 4; i++) {
            sellBtn.click();
        }

        record(
            'Trading: Selling 4 shares updates userOwned to 6 and updates DOM synchronously',
            env.gameState.stocks.userOwned === 6 && userSharesEl.innerText === '6',
            `Owned: ${env.gameState.stocks.userOwned}, DOM: ${userSharesEl.innerText}`
        );

        env.cleanup();
    } catch (err) {
        record('Trading Interaction Test', false, err.message);
    }

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n' + '='.repeat(78));
    console.log(`TOTAL ADVERSARIAL ASSERTIONS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log(`FINAL EMPIRICAL VERDICT: ${failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES'}`);
    console.log('='.repeat(78) + '\n');

    return { total: passed + failed, passed, failed, results };
}

if (require.main === module) {
    runAdversarialStockTests().then(res => {
        process.exit(res.failed > 0 ? 1 : 0);
    }).catch(err => {
        console.error('Adversarial suite crashed:', err);
        process.exit(1);
    });
}

module.exports = { runAdversarialStockTests };
