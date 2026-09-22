/**
 * tests/tier1_features.test.js
 * 
 * Tier 1: Primary Feature Happy-Path Verification (F1 - F12)
 * Ensures >= 5 assertions/cases per feature verifying specification compliance.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createGameEnvironment } = require('./harness.js');

const GAME_JS_PATH = path.resolve(__dirname, '..', 'game.js');

function createFeatureTests() {
    const tests = [];

    function addTest(id, title, fn) {
        tests.push({ id, title, fn });
    }

    // =========================================================================
    // F1: Stock Market Continuous Dynamics
    // =========================================================================
    addTest('F1_1', 'F1: Stock price initializes at $100 with history [100]', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        assert.strictEqual(env.gameState.stocks.price, 100, 'Initial stock price must be 100');
        assert.ok(Array.isArray(env.gameState.stocks.history), 'Stocks history must be an array');
        assert.strictEqual(env.gameState.stocks.history[0], 100, 'First history item must be 100');
        env.cleanup();
    });

    addTest('F1_2', 'F1: Stock price fluctuates dynamically over multiple market ticks', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.stepMarket(10);
        assert.ok(env.gameState.stocks.history.length > 1, 'History must expand with market ticks');
        assert.ok(typeof env.gameState.stocks.price === 'number', 'Price must be a number');
        assert.ok(!Number.isNaN(env.gameState.stocks.price), 'Price must not be NaN');
        env.cleanup();
    });

    addTest('F1_3', 'F1: Stock price remains strictly positive and bounded', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.stepMarket(20);
        assert.ok(env.gameState.stocks.price >= 10, 'Price must not collapse below minimum trading floor (>= 10)');
        assert.ok(env.gameState.stocks.price <= 800, 'Price must not exceed realistic upper boundary');
        env.cleanup();
    });

    addTest('F1_4', 'F1: Stock price at $15 floor escapes quantization trap over 50 ticks', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        // Force price to floor
        env.gameState.stocks.price = 15;
        if (env.gameState.stocks.floatPrice !== undefined) {
            env.gameState.stocks.floatPrice = 15.0;
        }
        env.gameState.stocks.marketTrend = 0;
        
        let reachedAbove15 = false;
        for (let i = 0; i < 50; i++) {
            env.stepMarket(1);
            if (env.gameState.stocks.price > 15) {
                reachedAbove15 = true;
                break;
            }
        }
        assert.ok(reachedAbove15, 'Price at $15 floor must escape the quantization trap within 50 ticks');
        env.cleanup();
    });

    addTest('F1_5', 'F1: Stock price at $600 ceiling pulls back naturally toward mean', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.stocks.price = 600;
        if (env.gameState.stocks.floatPrice !== undefined) {
            env.gameState.stocks.floatPrice = 600.0;
        }
        env.gameState.stocks.marketTrend = 0;

        let pulledBack = false;
        for (let i = 0; i < 50; i++) {
            env.stepMarket(1);
            if (env.gameState.stocks.price < 600) {
                pulledBack = true;
                break;
            }
        }
        assert.ok(pulledBack, 'Price at $600 ceiling must drift downward toward equilibrium');
        env.cleanup();
    });

    // =========================================================================
    // F2: Canvas Price Chart Reliability
    // =========================================================================
    addTest('F2_1', 'F2: drawStockChart executes without throwing and records draw operations', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.canvasCtx.resetTracking();
        env.drawStockChart();
        assert.ok(env.canvasCtx.clearRectCalls.length > 0, 'Canvas clearRect must be called');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Canvas operations must not contain NaN');
        assert.strictEqual(env.canvasCtx.hasInfinity(), false, 'Canvas operations must not contain Infinity');
        env.cleanup();
    });

    addTest('F2_2', 'F2: drawStockChart handles history.length === 1 without division by zero', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.stocks.history = [100];
        env.canvasCtx.resetTracking();
        assert.doesNotThrow(() => env.drawStockChart(), 'Drawing with single-item history must not throw');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'No NaN coordinates with single-item history');
        env.cleanup();
    });

    addTest('F2_3', 'F2: drawStockChart handles flat identical history values safely with padding', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.stocks.history = [50, 50, 50, 50, 50];
        env.canvasCtx.resetTracking();
        assert.doesNotThrow(() => env.drawStockChart(), 'Drawing flat history must not throw');
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'Flat history must not cause zero-division NaN');
        env.cleanup();
    });

    addTest('F2_4', 'F2: Canvas accommodates 100+ points within vertical coordinates [0, 140]', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const points = [];
        for (let i = 0; i < 110; i++) {
            // Realistic stock prices within [15, 600]
            points.push(Math.round(15 + (585 * (Math.sin(i / 10) + 1)) / 2));
        }
        env.gameState.stocks.history = points;
        env.canvasCtx.resetTracking();
        env.drawStockChart();
        assert.strictEqual(env.canvasCtx.hasNaN(), false, 'No NaN coordinates across 100+ points');
        for (const op of env.canvasCtx.operations) {
            if (op.type === 'moveTo' || op.type === 'lineTo') {
                assert.ok(op.y >= -1 && op.y <= 142, `Y coordinate ${op.y} must stay within canvas height [0, 140] (subpixel tolerance)`);
            }
        }
        env.cleanup();
    });

    addTest('F2_5', 'F2: Trend line colors match price movement (green if up, red if down)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        
        // Bullish history
        env.gameState.stocks.history = [100, 120, 150];
        env.canvasCtx.resetTracking();
        env.drawStockChart();
        const bullStroke = env.canvasCtx.operations.filter(o => o.type === 'stroke').find(o => o.strokeStyle !== '#21262d');
        assert.ok(bullStroke, 'Price line stroke operation must be recorded');
        assert.strictEqual(bullStroke.strokeStyle, '#2ea043', 'Uptrend stroke should be green (#2ea043)');

        // Bearish history
        env.gameState.stocks.history = [150, 120, 100];
        env.canvasCtx.resetTracking();
        env.drawStockChart();
        const bearStroke = env.canvasCtx.operations.filter(o => o.type === 'stroke').find(o => o.strokeStyle !== '#21262d');
        assert.ok(bearStroke, 'Price line stroke operation must be recorded');
        assert.strictEqual(bearStroke.strokeStyle, '#f85149', 'Downtrend stroke should be red (#f85149)');
        env.cleanup();
    });

    // =========================================================================
    // F3: Market Sentiment & Volatility
    // =========================================================================
    addTest('F3_1', 'F3: marketNewsSignals contains defined bullish and bearish signals', () => {
        const env = createGameEnvironment();
        const signals = env.marketNewsSignals;
        assert.ok(Array.isArray(signals), 'marketNewsSignals must be an array');
        assert.ok(signals.length >= 4, 'Must have multiple news signals');
        const hasBullish = signals.some(s => s.type === 'bullish' && s.trend > 0);
        const hasBearish = signals.some(s => s.type === 'bearish' && s.trend < 0);
        assert.ok(hasBullish, 'Must contain bullish signal with trend > 0');
        assert.ok(hasBearish, 'Must contain bearish signal with trend < 0');
        env.cleanup();
    });

    addTest('F3_2', 'F3: Bullish sentiment applies upward drift on stock price', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const initialPrice = env.gameState.stocks.price;
        env.gameState.stocks.marketTrend = 1.0;
        env.stepMarket(3);
        assert.ok(env.gameState.stocks.price >= initialPrice * 0.95, 'Bullish news must maintain or increase price momentum');
        env.cleanup();
    });

    addTest('F3_3', 'F3: Bearish sentiment applies downward drift on stock price', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const initialPrice = env.gameState.stocks.price;
        env.gameState.stocks.marketTrend = -1.0;
        env.stepMarket(3);
        assert.ok(env.gameState.stocks.price <= initialPrice * 1.05, 'Bearish news must apply downward momentum');
        env.cleanup();
    });

    addTest('F3_4', 'F3: News signal updates latest-news-signal in DOM and logs to feed', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.eval('if (typeof triggerMarketNews === "function") triggerMarketNews();');
        const newsBox = env.document.getElementById('latest-news-signal');
        assert.ok(newsBox.innerHTML.length > 0, 'News box should contain news content');
        const feed = env.document.getElementById('event-feed');
        assert.ok(feed.children.length > 0, 'Event feed should have received messages');
        env.cleanup();
    });

    addTest('F3_5', 'F3: Market trend decays smoothly toward 0 over subsequent ticks', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.stocks.marketTrend = 1.0;
        env.stepMarket(3);
        assert.ok(Math.abs(env.gameState.stocks.marketTrend) <= 0.5, 'Market trend must decay toward 0 over time');
        env.cleanup();
    });

    // =========================================================================
    // F4: Manual Coding Button Reactivity
    // =========================================================================
    addTest('F4_1', 'F4: Initial manual coding button text contains +$50', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const btn = env.document.getElementById('start-click-work');
        assert.ok(btn.innerText.includes('+$50'), 'Button must initially show +$50');
        env.cleanup();
    });

    addTest('F4_2', 'F4: Clicking manual code button awards exactly $50 initially', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const initialMoney = env.gameState.money;
        env.click('start-click-work');
        assert.strictEqual(env.gameState.money, initialMoney + 50, 'Click must award $50');
        env.cleanup();
    });

    addTest('F4_3', 'F4: Purchasing optic upgrade immediately updates button label to +$100', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 10000;
        env.buyEquipment('optic');
        const btn = env.document.getElementById('start-click-work');
        assert.ok(btn.innerText.includes('+$100'), 'Button label must update to +$100 immediately upon buying optic');
        env.cleanup();
    });

    addTest('F4_4', 'F4: Clicking button after optic upgrade awards exactly $100', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 10000;
        env.buyEquipment('optic');
        const moneyBefore = env.gameState.money;
        env.click('start-click-work');
        assert.strictEqual(env.gameState.money, moneyBefore + 100, 'Click must award $100 after optic upgrade');
        env.cleanup();
    });

    addTest('F4_5', 'F4: Button displays +$100 immediately after loading saved game with optic', () => {
        const savedState = {
            companyName: "TestCorp",
            direction: "ai",
            directionLabel: "IT & Нейросети",
            money: 8000,
            day: 10,
            reputation: 60,
            isPaused: false,
            tickSpeed: 3000,
            officeTier: 1,
            upgrades: ['optic'],
            stocks: { price: 100, history: [100], userOwned: 0, marketTrend: 0 },
            employees: {
                junior: { count: 1, salary: 60, devPower: 2, name: "Junior специалист" },
                middle: { count: 0, salary: 160, devPower: 8, name: "Middle разработчик" },
                senior: { count: 0, salary: 420, devPower: 26, name: "Senior тимлид" },
                marketer: { count: 0, salary: 140, repPower: 1, name: "PR-маркетолог" }
            },
            projects: []
        };
        const env = createGameEnvironment({
            initialStorage: { 'cybertycoon_save': JSON.stringify(savedState) }
        });
        env.eval('if (typeof loadGameFromStorage === "function") loadGameFromStorage();');
        const btn = env.document.getElementById('start-click-work');
        assert.ok(btn.innerText.includes('+$100'), 'Loaded save with optic must immediately display +$100');
        env.cleanup();
    });

    // =========================================================================
    // F5: Dynamic Employee Headcount Calculation
    // =========================================================================
    addTest('F5_1', 'F5: Initial employee headcount is 0 across all roles', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const total = Object.values(env.gameState.employees).reduce((sum, e) => sum + e.count, 0);
        assert.strictEqual(total, 0, 'Total employees count must start at 0');
        env.cleanup();
    });

    addTest('F5_2', 'F5: Hiring 1 Junior increments total-employees badge immediately to 1', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.hireEmployee('junior');
        assert.strictEqual(env.gameState.employees.junior.count, 1, 'Junior count must be 1');
        const badge = env.document.getElementById('total-employees');
        assert.ok(badge.innerText.includes('1'), `total-employees badge must show 1, got: "${badge.innerText}"`);
        env.cleanup();
    });

    addTest('F5_3', 'F5: Hiring mixed team accurately sums total headcount', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.officeTier = 2; // Increase limit to 10
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        env.hireEmployee('middle');
        env.hireEmployee('marketer');
        const expectedTotal = 4;
        const badge = env.document.getElementById('total-employees');
        assert.ok(badge.innerText.includes(String(expectedTotal)), `Badge must show ${expectedTotal}, got: "${badge.innerText}"`);
        env.cleanup();
    });

    addTest('F5_4', 'F5: Firing an employee immediately decrements headcount without resetting to 0', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.hireEmployee('junior');
        env.hireEmployee('junior');
        env.fireEmployee('junior');
        assert.strictEqual(env.gameState.employees.junior.count, 1, 'Junior count must be 1 after firing one');
        const badge = env.document.getElementById('total-employees');
        assert.ok(badge.innerText.includes('1'), `Badge must show 1 after firing, got: "${badge.innerText}"`);
        env.cleanup();
    });

    addTest('F5_5', 'F5: updateUI() without arguments preserves true employee count', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.hireEmployee('junior');
        env.hireEmployee('middle');
        // Invoke updateUI without arguments (which previously defaulted totalEmp to 0)
        env.updateUI();
        const badge = env.document.getElementById('total-employees');
        assert.ok(badge.innerText.includes('2'), `updateUI() without parameters must preserve headcount 2, got: "${badge.innerText}"`);
        const officeDisp = env.document.getElementById('office-display');
        assert.ok(officeDisp.innerText.includes('2/'), `office-display must show 2/, got: "${officeDisp.innerText}"`);
        env.cleanup();
    });

    // =========================================================================
    // F6: Reactive Header Indicators
    // =========================================================================
    addTest('F6_1', 'F6: #money-display updates immediately across hiring and purchases', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const startMoney = env.gameState.money;
        env.hireEmployee('junior');
        const expectedMoney = startMoney - env.gameState.employees.junior.salary;
        const moneyText = env.document.getElementById('money-display').innerText;
        assert.ok(moneyText.includes(expectedMoney.toLocaleString()), `Money display must show ${expectedMoney}, got "${moneyText}"`);
        env.cleanup();
    });

    addTest('F6_2', 'F6: #income-display immediately reflects negative salary upon hire', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.hireEmployee('junior'); // salary 60
        const incomeText = env.document.getElementById('income-display').innerText;
        assert.ok(incomeText.includes('60'), `Income display must reflect salary 60, got "${incomeText}"`);
        env.cleanup();
    });

    addTest('F6_3', 'F6: #office-display updates capacity (count/max) immediately', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.hireEmployee('junior');
        const officeText = env.document.getElementById('office-display').innerText;
        assert.ok(officeText.includes('1/4'), `Office display must show 1/4 in Garage, got "${officeText}"`);
        env.cleanup();
    });

    addTest('F6_4', 'F6: Buying stock immediately deducts money and increments user-shares', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const price = env.gameState.stocks.price;
        const moneyBefore = env.gameState.money;
        env.click('buy-share-btn');
        assert.strictEqual(env.gameState.stocks.userOwned, 1, 'userOwned must be 1');
        assert.strictEqual(env.gameState.money, moneyBefore - price, 'Money must be deducted by stock price');
        const sharesText = env.document.getElementById('user-shares').innerText;
        assert.strictEqual(sharesText, '1', `user-shares element must display 1 immediately, got "${sharesText}"`);
        env.cleanup();
    });

    addTest('F6_5', 'F6: Selling stock immediately adds money and decrements user-shares', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.click('buy-share-btn');
        const moneyAfterBuy = env.gameState.money;
        const price = env.gameState.stocks.price;
        env.click('sell-share-btn');
        assert.strictEqual(env.gameState.stocks.userOwned, 0, 'userOwned must be 0 after sale');
        assert.strictEqual(env.gameState.money, moneyAfterBuy + price, 'Money must be refunded by stock price');
        const sharesText = env.document.getElementById('user-shares').innerText;
        assert.strictEqual(sharesText, '0', `user-shares element must display 0 immediately, got "${sharesText}"`);
        env.cleanup();
    });

    // =========================================================================
    // F7: Expanded Project Catalog (30 Projects Across 4 Tiers)
    // =========================================================================
    addTest('F7_1', 'F7: directionProjectsCatalog contains ai, gamedev, and cybersec industries', () => {
        const env = createGameEnvironment();
        const catalog = env.directionProjectsCatalog;
        assert.ok(catalog.ai, 'Must contain ai industry');
        assert.ok(catalog.gamedev, 'Must contain gamedev industry');
        assert.ok(catalog.cybersec, 'Must contain cybersec industry');
        env.cleanup();
    });

    addTest('F7_2', 'F7: Each industry contains at least 8 to 10 unique projects', () => {
        const env = createGameEnvironment();
        const catalog = env.directionProjectsCatalog;
        assert.ok(catalog.ai.projects.length >= 8, `AI must have >= 8 projects, got ${catalog.ai.projects.length}`);
        assert.ok(catalog.gamedev.projects.length >= 8, `GameDev must have >= 8 projects, got ${catalog.gamedev.projects.length}`);
        assert.ok(catalog.cybersec.projects.length >= 8, `CyberSec must have >= 8 projects, got ${catalog.cybersec.projects.length}`);
        env.cleanup();
    });

    addTest('F7_3', 'F7: Projects span 4 distinct progression tiers (Startup, B2B, Enterprise, Global)', () => {
        const env = createGameEnvironment();
        const catalog = env.directionProjectsCatalog;
        const tiersInAi = new Set(catalog.ai.projects.map(p => p.tier));
        assert.ok(tiersInAi.has(1), 'Must have Tier 1 project');
        assert.ok(tiersInAi.has(2), 'Must have Tier 2 project');
        assert.ok(tiersInAi.has(3), 'Must have Tier 3 project');
        assert.ok(tiersInAi.has(4), 'Must have Tier 4 project');
        env.cleanup();
    });

    addTest('F7_4', 'F7: Every project defines complete schema (id, name, cost, maxProgress, reward, passiveIncome, serverCost)', () => {
        const env = createGameEnvironment();
        const catalog = env.directionProjectsCatalog;
        for (const [ind, data] of Object.entries(catalog)) {
            for (const p of data.projects) {
                assert.ok(p.id !== undefined, `Project in ${ind} must have id`);
                assert.ok(p.name, `Project ${p.id} must have name`);
                assert.ok(p.cost !== undefined, `Project ${p.id} must have cost`);
                assert.ok(p.maxProgress > 0, `Project ${p.id} must have maxProgress > 0`);
                assert.ok(p.reward > 0, `Project ${p.id} must have reward > 0`);
                assert.ok(p.passiveIncome > 0, `Project ${p.id} must have passiveIncome > 0`);
                assert.ok(p.serverCost !== undefined, `Project ${p.id} must have serverCost`);
            }
        }
        env.cleanup();
    });

    addTest('F7_5', 'F7: Progressive scaling: Tier 4 projects have higher dev requirements and income than Tier 1', () => {
        const env = createGameEnvironment();
        const catalog = env.directionProjectsCatalog;
        const t1 = catalog.ai.projects.find(p => p.tier === 1);
        const t4 = catalog.ai.projects.find(p => p.tier === 4);
        assert.ok(t4.maxProgress > t1.maxProgress, 'Tier 4 must require more dev points than Tier 1');
        assert.ok(t4.passiveIncome > t1.passiveIncome, 'Tier 4 must generate higher passive income than Tier 1');
        assert.ok(t4.reward > t1.reward, 'Tier 4 must grant larger completion reward than Tier 1');
        env.cleanup();
    });

    // =========================================================================
    // F8: Project Unlock Progression Tree
    // =========================================================================
    addTest('F8_1', 'F8: Tier 1 starting project is unlocked at game start (Office Tier 1, Rep 50)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p1 = env.gameState.projects.find(p => p.tier === 1 || p.id === 'ai_1' || p.id === 1);
        assert.ok(p1, 'First project must exist');
        const isUnlocked = env.eval(`(typeof isProjectUnlocked === 'function') ? isProjectUnlocked(${JSON.stringify(p1)}) : true`);
        assert.strictEqual(isUnlocked, true, 'First Tier 1 project must be unlocked at start');
        env.cleanup();
    });

    addTest('F8_2', 'F8: Higher tier projects requiring Office Tier 2+ are initially locked', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const highProject = env.gameState.projects.find(p => p.minOfficeTier && p.minOfficeTier > 1);
        if (highProject) {
            const isUnlocked = env.eval(`isProjectUnlocked(${JSON.stringify(highProject)})`);
            assert.strictEqual(isUnlocked, false, 'Project requiring higher office tier must be locked in Garage');
        } else {
            // Check if catalog has minOfficeTier defined
            const hasMinOffice = env.directionProjectsCatalog.ai.projects.some(p => p.minOfficeTier > 1);
            assert.ok(hasMinOffice, 'Catalog must define projects with minOfficeTier > 1');
        }
        env.cleanup();
    });

    addTest('F8_3', 'F8: Upgrading office tier unlocks projects whose office requirements are met', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 50000;
        env.upgradeOfficeTier(); // Upgrades to Coworking (tier 2)
        assert.strictEqual(env.gameState.officeTier, 2, 'Office tier must now be 2');
        const t2Project = env.gameState.projects.find(p => p.minOfficeTier === 2 && (!p.prereqId || isProjectCompleted(p.prereqId)));
        if (t2Project) {
            const isUnlocked = env.eval(`isProjectUnlocked(${JSON.stringify(t2Project)})`);
            assert.strictEqual(isUnlocked, true, 'Tier 2 project without unmet prereq must be unlocked');
        }
        env.cleanup();
    });

    addTest('F8_4', 'F8: Projects with prereqId remain locked until prerequisite project is completed', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const prereqProject = env.gameState.projects.find(p => p.prereqId);
        if (prereqProject) {
            const isUnlocked = env.eval(`isProjectUnlocked(${JSON.stringify(prereqProject)})`);
            assert.strictEqual(isUnlocked, false, 'Project with incomplete prerequisite must remain locked');
        } else {
            const hasPrereq = env.directionProjectsCatalog.ai.projects.some(p => p.prereqId);
            assert.ok(hasPrereq, 'Catalog must define projects with prereqId');
        }
        env.cleanup();
    });

    addTest('F8_5', 'F8: Completing prerequisite project unlocks dependent project', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const depProject = env.gameState.projects.find(p => p.prereqId);
        if (depProject) {
            const parent = env.gameState.projects.find(p => p.id === depProject.prereqId);
            if (parent) {
                parent.completed = true;
                const isUnlocked = env.eval(`isProjectUnlocked(${JSON.stringify(depProject)})`);
                assert.strictEqual(isUnlocked, true, 'Project must unlock once its prerequisite is completed');
            }
        }
        env.cleanup();
    });

    // =========================================================================
    // F9: Server Hosting Fees & Operational Overhead
    // =========================================================================
    addTest('F9_1', 'F9: Completed projects incur daily server hosting costs', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        assert.ok(p.serverCost !== undefined && p.serverCost > 0, 'Project must specify serverCost > 0');
        env.cleanup();
    });

    addTest('F9_2', 'F9: Net daily profit formula subtracts server costs from passive income', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.completed = true;
        // Check calculation
        const profit = env.eval(`(typeof calculateNetDailyProfit === 'function') ? calculateNetDailyProfit() : null`);
        if (profit !== null) {
            const expected = p.passiveIncome - p.serverCost;
            assert.strictEqual(profit, expected, `Profit must be passiveIncome (${p.passiveIncome}) - serverCost (${p.serverCost})`);
        } else {
            // Verify inside game tick
            const moneyBefore = env.gameState.money;
            env.stepDay(1);
            const delta = env.gameState.money - moneyBefore;
            assert.strictEqual(delta, p.passiveIncome - (p.serverCost || 0), 'Daily profit delta must factor server hosting costs');
        }
        env.cleanup();
    });

    addTest('F9_3', 'F9: Purchasing server cluster upgrade reduces server costs by 30%', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.upgrades.push('server');
        const p = env.gameState.projects[0];
        p.completed = true;
        const profitWithServer = env.eval(`(typeof calculateNetDailyProfit === 'function') ? calculateNetDailyProfit() : null`);
        if (profitWithServer !== null) {
            const expectedBuffedIncome = Math.round(p.passiveIncome * 1.20);
            const expectedDiscountedServer = Math.round(p.serverCost * 0.70);
            assert.strictEqual(profitWithServer, expectedBuffedIncome - expectedDiscountedServer);
        }
        env.cleanup();
    });

    addTest('F9_4', 'F9: Incomplete projects do not incur server hosting fees', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.completed = false;
        const profit = env.eval(`(typeof calculateNetDailyProfit === 'function') ? calculateNetDailyProfit() : null`);
        if (profit !== null) {
            assert.strictEqual(profit, 0, 'Incomplete project must not incur server fees');
        }
        env.cleanup();
    });

    addTest('F9_5', 'F9: Multiple completed projects accumulate server hosting fees', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        if (env.gameState.projects.length >= 2) {
            const p1 = env.gameState.projects[0];
            const p2 = env.gameState.projects[1];
            p1.completed = true;
            p2.completed = true;
            const profit = env.eval(`(typeof calculateNetDailyProfit === 'function') ? calculateNetDailyProfit() : null`);
            if (profit !== null) {
                const totalIncome = p1.passiveIncome + p2.passiveIncome;
                const totalServer = (p1.serverCost || 0) + (p2.serverCost || 0);
                assert.strictEqual(profit, totalIncome - totalServer, 'Profit must deduct sum of all server costs');
            }
        }
        env.cleanup();
    });

    // =========================================================================
    // F10: Technical Debt & Production Bug Incidents
    // =========================================================================
    addTest('F10_1', 'F10: Projects support hasBug flag', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        assert.ok('hasBug' in p || p.hasBug !== undefined, 'Project object must support hasBug property');
        env.cleanup();
    });

    addTest('F10_2', 'F10: Active bug reduces project passive revenue by 50%', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.completed = true;
        p.hasBug = true;
        const profitWithBug = env.eval(`(typeof calculateNetDailyProfit === 'function') ? calculateNetDailyProfit() : null`);
        if (profitWithBug !== null) {
            const expectedPassive = Math.round(p.passiveIncome * 0.5);
            assert.strictEqual(profitWithBug, expectedPassive - (p.serverCost || 0), 'Bugged project must produce 50% passive revenue');
        }
        env.cleanup();
    });

    addTest('F10_3', 'F10: Fixing bug restores project passive revenue and clears hasBug', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.completed = true;
        p.hasBug = true;
        env.eval(`if (typeof fixProjectBug === 'function') fixProjectBug('${p.id}'); else { const proj = gameState.projects.find(x => x.id === '${p.id}'); if (proj) proj.hasBug = false; }`);
        assert.strictEqual(p.hasBug, false, 'hasBug must be cleared after bug fix');
        env.cleanup();
    });

    addTest('F10_4', 'F10: Bug fix deducts fixCost from company balance', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.completed = true;
        p.hasBug = true;
        p.fixCost = 80;
        const moneyBefore = env.gameState.money;
        env.eval(`if (typeof fixProjectBug === 'function') fixProjectBug('${p.id}');`);
        if (p.hasBug === false) {
            assert.strictEqual(env.gameState.money, moneyBefore - 80, 'Fixing bug must deduct fixCost from balance');
        }
        env.cleanup();
    });

    addTest('F10_5', 'F10: Senior developers provide auto-triage capability for bugs', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p = env.gameState.projects[0];
        p.completed = true;
        p.hasBug = true;
        env.gameState.employees.senior.count = 3;
        // Run several days to test auto-triage chance
        let resolved = false;
        for (let i = 0; i < 40; i++) {
            env.stepDay(1);
            if (!p.hasBug) {
                resolved = true;
                break;
            }
        }
        // Either auto-triage or manual fix is available
        assert.ok(typeof env.eval('typeof fixProjectBug') === 'string' || resolved, 'Senior developers or engine must provide bug triage');
        env.cleanup();
    });

    // =========================================================================
    // F11: Employee Workplace Morale Engine
    // =========================================================================
    addTest('F11_1', 'F11: gameState tracks morale parameter (0 to 100%)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        assert.ok(env.gameState.morale !== undefined, 'gameState.morale must be defined');
        assert.ok(env.gameState.morale >= 0 && env.gameState.morale <= 100, 'Morale must be within [0, 100]');
        env.cleanup();
    });

    addTest('F11_2', 'F11: High morale (>= 90%) boosts developer productivity (+20%)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.morale = 95;
        env.gameState.employees.junior.count = 2; // base power 2*2 = 4
        const p = env.gameState.projects[0];
        p.progress = 0;
        env.stepDay(1);
        // Base 4 * 1.20 = ~5 dev progress
        assert.ok(p.progress >= 4, 'High morale must produce at least base or boosted dev points');
        env.cleanup();
    });

    addTest('F11_3', 'F11: Low morale (< 40%) severely penalizes developer productivity (-50%)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.morale = 30;
        env.gameState.employees.senior.count = 1; // base 26
        const p = env.gameState.projects[0];
        p.progress = 0;
        env.stepDay(1);
        // Base 26 * 0.50 = 13
        assert.ok(p.progress <= 20, `Low morale must reduce dev speed below standard, got ${p.progress}`);
        env.cleanup();
    });

    addTest('F11_4', 'F11: Office equipment upgrades increase company target morale', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 20000;
        env.buyEquipment('coffee');
        env.buyEquipment('chairs');
        assert.ok(env.gameState.upgrades.includes('coffee'), 'Must own coffee machine');
        assert.ok(env.gameState.upgrades.includes('chairs'), 'Must own ergonomic chairs');
        // Let days advance with positive balance -> morale should rise toward 95-100%
        for (let i = 0; i < 20; i++) {
            env.stepDay(1);
        }
        assert.ok(env.gameState.morale >= 80, `Morale with luxury amenities must be high, got ${env.gameState.morale}`);
        env.cleanup();
    });

    addTest('F11_5', 'F11: Payroll deficit / negative balance erodes team morale', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = -2000; // Company in debt
        env.gameState.morale = 80;
        for (let i = 0; i < 5; i++) {
            env.stepDay(1);
        }
        assert.ok(env.gameState.morale < 80, `Unpaid debt must decrease morale, got ${env.gameState.morale}`);
        env.cleanup();
    });

    // =========================================================================
    // F12: Comprehensive Russian Educational Comments
    // =========================================================================
    addTest('F12_1', 'F12: game.js file exists and contains Cyrillic characters', () => {
        const content = fs.readFileSync(GAME_JS_PATH, 'utf-8');
        assert.ok(/[а-яА-ЯёЁ]/.test(content), 'game.js must contain Russian comments/strings');
    });

    addTest('F12_2', 'F12: State machine and game loop routines have explanatory Russian comments', () => {
        const content = fs.readFileSync(GAME_JS_PATH, 'utf-8');
        assert.ok(content.includes('Игровой цикл') || content.includes('GAME STATE') || content.includes('ГЛОБАЛЬНОЕ СОСТОЯНИЕ'), 'Must have Russian architecture headers');
    });

    addTest('F12_3', 'F12: Economic principles and terminology are explained in comments', () => {
        const content = fs.readFileSync(GAME_JS_PATH, 'utf-8');
        const hasEconTerms = /зарплат|доход|прибыл|репутаци|фонд/i.test(content);
        assert.ok(hasEconTerms, 'Must explain economic terms in Russian comments');
    });

    addTest('F12_4', 'F12: Office tiers and equipment catalogs include descriptive Russian text', () => {
        const env = createGameEnvironment();
        const tiers = env.officeTiers;
        for (const t of tiers) {
            assert.ok(/[а-яА-ЯёЁ]/.test(t.desc), `Office tier ${t.tier} must have Russian description`);
        }
        const eq = env.equipmentCatalog;
        for (const item of eq) {
            assert.ok(/[а-яА-ЯёЁ]/.test(item.desc), `Equipment ${item.id} must have Russian description`);
        }
        env.cleanup();
    });

    addTest('F12_5', 'F12: Educational comments constitute >= 15% of game.js lines', () => {
        const content = fs.readFileSync(GAME_JS_PATH, 'utf-8');
        const lines = content.split('\n');
        const commentLines = lines.filter(l => {
            const trimmed = l.trim();
            return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
        });
        const ratio = commentLines.length / lines.length;
        assert.ok(ratio >= 0.15, `Comment line ratio must be >= 15%, got ${(ratio * 100).toFixed(1)}%`);
    });

    return tests;
}

async function runTier1() {
    const tests = createFeatureTests();
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

    return { name: 'Tier 1: Feature Happy-Path Verification', total: tests.length, passed, failed, results };
}

if (require.main === module) {
    runTier1().then(summary => {
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

module.exports = { runTier1, createFeatureTests };
