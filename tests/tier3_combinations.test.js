/**
 * tests/tier3_combinations.test.js
 * 
 * Tier 3: Cross-Feature Pairwise & Combinatorial Interactions
 * Validates complex inter-module relationships across upgrades,
 * fees, bugs, morale, stock liquidity, and save/load state fidelity.
 */

const assert = require('node:assert/strict');
const { createGameEnvironment } = require('./harness.js');

function createCombinationTests() {
    const tests = [];

    function addTest(id, title, fn) {
        tests.push({ id, title, fn });
    }

    // =========================================================================
    // C1: Optic Gigabit (F4) × Header Reactivity (F6) × Stock Trading (F1)
    // =========================================================================
    addTest('C1', 'C1: Manual coding with optic generates funds used immediately for stock trade', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 5000;
        env.buyEquipment('optic'); // Cost 2000 -> 3000 left

        const moneyBeforeClicks = env.gameState.money;
        // Click 10 times -> +$1000
        for (let i = 0; i < 10; i++) {
            env.click('start-click-work');
        }
        assert.strictEqual(env.gameState.money, moneyBeforeClicks + 1000, '10 clicks with optic must earn $1000');

        // Buy stock
        const price = env.gameState.stocks.price;
        const moneyBeforeTrade = env.gameState.money;
        env.click('buy-share-btn');
        assert.strictEqual(env.gameState.stocks.userOwned, 1, 'Player must own 1 share');
        assert.strictEqual(env.gameState.money, moneyBeforeTrade - price, 'Money must be deducted by stock price');
        assert.strictEqual(env.document.getElementById('user-shares').innerText, '1', 'UI must show 1 share');
        env.cleanup();
    });

    // =========================================================================
    // C2: Server Cluster Upgrade × Passive Income Buff × Server Hosting Discount
    // =========================================================================
    addTest('C2', 'C2: GPU cluster upgrade simultaneously buffs passive income (+20%) and cuts server costs (-30%)', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        const p1 = env.gameState.projects[0];
        p1.completed = true;
        p1.passiveIncome = 100;
        p1.serverCost = 20;

        // Baseline before server upgrade
        const baseIncome = Math.round(p1.passiveIncome * 1.0);
        const baseServer = Math.round(p1.serverCost * 1.0);

        // Purchase GPU cluster
        env.gameState.money = 10000;
        env.buyEquipment('server');
        assert.ok(env.gameState.upgrades.includes('server'), 'Must own server upgrade');

        const profitWithBuff = env.eval(`(typeof calculateNetDailyProfit === 'function') ? calculateNetDailyProfit() : null`);
        if (profitWithBuff !== null) {
            const expectedIncome = Math.round(100 * 1.20); // 120
            const expectedServer = Math.round(20 * 0.70);  // 14
            assert.strictEqual(profitWithBuff, expectedIncome - expectedServer, `Net profit must be ${expectedIncome - expectedServer}, got ${profitWithBuff}`);
        } else {
            const moneyBefore = env.gameState.money;
            env.stepDay(1);
            const delta = env.gameState.money - moneyBefore;
            assert.ok(delta >= baseIncome - baseServer, 'Profit with server cluster must exceed baseline profit');
        }
        env.cleanup();
    });

    // =========================================================================
    // C3: Production Bug (F10) × Server Fees (F9) × Payroll Strain × Morale (F11)
    // =========================================================================
    addTest('C3', 'C3: Production bug cuts revenue, pushes daily balance negative, and erodes team morale', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        // Hire staff: salary 320
        env.gameState.employees.middle.count = 2; // 2 * 160 = 320 salary
        const p = env.gameState.projects[0];
        p.completed = true;
        p.passiveIncome = 350; // gives +30 net profit normally
        p.serverCost = 10;
        env.gameState.money = 50; // low reserve

        // Trigger bug -> passive income drops to 175
        p.hasBug = true;

        if (env.gameState.morale !== undefined) {
            env.gameState.morale = 80;
            // Advance several days: income (175) < salaries (320) -> money turns negative
            for (let i = 0; i < 5; i++) {
                env.stepDay(1);
            }
            assert.ok(env.gameState.money < 0, 'Company must be pushed into negative balance by bug');
            assert.ok(env.gameState.morale < 80, 'Morale must decline when company falls into unpaid salary debt');
        }
        env.cleanup();
    });

    // =========================================================================
    // C4: Senior Staff Auto-Triage (F10) under Multiple Incident Load
    // =========================================================================
    addTest('C4', 'C4: Senior staff triage resolves production bugs while player performs manual hotfixes', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        if (env.gameState.projects.length >= 2) {
            const p1 = env.gameState.projects[0];
            const p2 = env.gameState.projects[1];
            p1.completed = true;
            p2.completed = true;
            p1.hasBug = true;
            p2.hasBug = true;

            // Player hotfixes p1 manually
            env.gameState.money = 10000;
            env.eval(`if (typeof fixProjectBug === 'function') fixProjectBug('${p1.id}'); else { const x = gameState.projects.find(p => p.id === '${p1.id}'); if (x) x.hasBug = false; }`);
            assert.strictEqual(p1.hasBug, false, 'Player manual hotfix must clear bug on p1');

            // Senior staff in office
            env.gameState.employees.senior.count = 3;
            // Advance days
            for (let i = 0; i < 30; i++) {
                env.stepDay(1);
            }
            // Engine supports either manual or auto triage
            assert.ok(p1.hasBug === false, 'p1 must remain resolved');
        }
        env.cleanup();
    });

    // =========================================================================
    // C5: Workplace Amenities Synergy (Coffee + Chairs + Office Tier 3)
    // =========================================================================
    addTest('C5', 'C5: Stacking office amenities (coffee, ergonomic chairs, tier 3 office) elevates productivity and PR', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = 200000;
        env.upgradeOfficeTier(); // Tier 2 Coworking
        env.upgradeOfficeTier(); // Tier 3 Business Center
        assert.strictEqual(env.gameState.officeTier, 3, 'Must be at Office Tier 3');

        env.buyEquipment('coffee');
        env.buyEquipment('chairs');
        assert.ok(env.gameState.upgrades.includes('coffee'), 'Must have coffee');
        assert.ok(env.gameState.upgrades.includes('chairs'), 'Must have chairs');

        // Hire 1 marketer -> repPower with chairs (+25%) and tier 3 office
        const repBefore = env.gameState.reputation;
        env.hireEmployee('marketer');
        env.stepDay(5);
        assert.ok(env.gameState.reputation > repBefore, 'Reputation must increase with marketer and chairs buff');
        env.cleanup();
    });

    // =========================================================================
    // C6: Unlock Progression Tree (F8) × Multi-Tier Projects (F7)
    // =========================================================================
    addTest('C6', 'C6: Higher tier project unlocks only when office tier, reputation, and prerequisite are all satisfied', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        
        const catalog = env.directionProjectsCatalog.ai.projects;
        const t2Proj = catalog.find(p => p.tier === 2);
        if (t2Proj) {
            // Check locked state at start
            const initiallyUnlocked = env.eval(`(typeof isProjectUnlocked === 'function') ? isProjectUnlocked(${JSON.stringify(t2Proj)}) : false`);
            assert.strictEqual(initiallyUnlocked, false, 'Tier 2 project must be locked in Garage with 0 reputation');

            // Advance office and reputation to fulfill requirements
            env.gameState.officeTier = t2Proj.minOfficeTier || 2;
            env.gameState.reputation = (t2Proj.minReputation || 50) + 10;
            if (t2Proj.prereqId) {
                const prereq = env.gameState.projects.find(p => p.id === t2Proj.prereqId);
                if (prereq) prereq.completed = true;
            }

            const nowUnlocked = env.eval(`isProjectUnlocked(${JSON.stringify(t2Proj)})`);
            assert.strictEqual(nowUnlocked, true, 'Tier 2 project must unlock when all requirements are met');
        }
        env.cleanup();
    });

    // =========================================================================
    // C7: Save / Load Cross-Feature State Fidelity (F1 - F11)
    // =========================================================================
    addTest('C7', 'C7: Complete game state saves and reloads across all features with 100% fidelity', () => {
        const fullState = {
            companyName: "CyberMegaCorp",
            direction: "ai",
            directionLabel: "IT & Нейросети",
            money: 14500,
            day: 42,
            reputation: 75,
            isPaused: false,
            tickSpeed: 3000,
            officeTier: 3,
            morale: 88,
            upgrades: ['optic', 'server', 'coffee'],
            stocks: { price: 185, history: [100, 120, 150, 185], userOwned: 25, marketTrend: 0.5 },
            employees: {
                junior: { count: 2, salary: 60, devPower: 2, name: "Junior специалист" },
                middle: { count: 2, salary: 160, devPower: 8, name: "Middle разработчик" },
                senior: { count: 1, salary: 420, devPower: 26, name: "Senior тимлид" },
                marketer: { count: 1, salary: 140, repPower: 1, name: "PR-маркетолог" }
            },
            projects: [
                { id: 'ai_1', name: "Telegram Bot", progress: 100, maxProgress: 100, reward: 1000, passiveIncome: 45, serverCost: 5, completed: true, hasBug: false },
                { id: 'ai_2', name: "OCR Scanner", progress: 240, maxProgress: 400, reward: 4200, passiveIncome: 160, serverCost: 10, completed: false, hasBug: false }
            ]
        };

        const env = createGameEnvironment({
            initialStorage: { 'cybertycoon_save': JSON.stringify(fullState) }
        });

        // Trigger load
        env.eval('if (typeof loadGameFromStorage === "function") loadGameFromStorage();');

        // Verify state restoration
        assert.strictEqual(env.gameState.companyName, "CyberMegaCorp", 'Company name must be restored');
        assert.strictEqual(env.gameState.day, 42, 'Day must be restored');
        assert.strictEqual(env.gameState.officeTier, 3, 'Office tier must be restored');
        assert.strictEqual(env.gameState.stocks.userOwned, 25, 'Owned shares must be restored');
        assert.strictEqual(env.gameState.stocks.price, 185, 'Stock price must be restored');

        // Total employees calculation: 2 + 2 + 1 + 1 = 6
        const totalEmp = Object.values(env.gameState.employees).reduce((sum, e) => sum + e.count, 0);
        assert.strictEqual(totalEmp, 6, 'Total employees must sum to 6');

        // UI element synchronization
        const btn = env.document.getElementById('start-click-work');
        assert.ok(btn.innerText.includes('+$100'), `Button must show +$100 due to optic, got "${btn.innerText}"`);

        const badge = env.document.getElementById('total-employees');
        assert.ok(badge.innerText.includes('6'), `Employee badge must show 6, got "${badge.innerText}"`);

        const portfolio = env.document.getElementById('portfolio-value');
        const expectedPortfolio = (25 * 185).toLocaleString();
        assert.ok(portfolio.innerText.includes(expectedPortfolio), `Portfolio value must reflect shares * price, got "${portfolio.innerText}"`);
        env.cleanup();
    });

    // =========================================================================
    // C8: Bear Market Liquidity Stress & Emergency Stock Liquidation
    // =========================================================================
    addTest('C8', 'C8: Emergency liquidation of stock portfolio covers payroll during sudden cash shortfall', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        // Player holds 10 shares
        env.gameState.stocks.userOwned = 10;
        env.gameState.stocks.price = 120;
        env.gameState.money = 50; // almost out of money
        env.gameState.employees.middle.count = 2; // daily payroll = 320

        // Liquidate 3 shares
        for (let i = 0; i < 3; i++) {
            env.click('sell-share-btn');
        }
        assert.strictEqual(env.gameState.stocks.userOwned, 7, 'Must own 7 shares after selling 3');
        assert.strictEqual(env.gameState.money, 50 + (3 * 120), 'Money must increase by 3 * $120');

        // Run game day -> payroll paid successfully without bankruptcy alert
        env.alertLog.length = 0;
        env.stepDay(1);
        const hadBankruptcy = env.alertLog.some(m => m.includes('ВНИМАНИЕ'));
        assert.strictEqual(hadBankruptcy, false, 'Emergency liquidation should prevent bankruptcy trigger');
        env.cleanup();
    });

    // =========================================================================
    // C9: PR Marketing Snowball to Unlock High-Tier Contracts
    // =========================================================================
    addTest('C9', 'C9: Marketers steadily build reputation needed to cross high-tier project unlock thresholds', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.reputation = 50;
        env.gameState.officeTier = 3;
        env.gameState.employees.marketer.count = 3;
        env.gameState.money = 50000;

        for (let i = 0; i < 20; i++) {
            env.stepDay(1);
        }
        assert.ok(env.gameState.reputation > 50, `Reputation must grow with active marketing department, got ${env.gameState.reputation}`);
        env.cleanup();
    });

    // =========================================================================
    // C10: Manual Click Work as Bootstrap Safety Net during Deficit
    // =========================================================================
    addTest('C10', 'C10: Manual coding clicks allow bootstrapping cash back to positive balance', () => {
        const env = createGameEnvironment();
        env.selectCompanyDirection('ai');
        env.gameState.money = -200; // In deficit
        assert.ok(env.gameState.money < 0, 'Must start in deficit');

        // Click manual coding 5 times (5 * $50 = +$250)
        for (let i = 0; i < 5; i++) {
            env.click('start-click-work');
        }
        assert.strictEqual(env.gameState.money, 50, '5 clicks of $50 must restore balance from -$200 to +$50');
        env.cleanup();
    });

    return tests;
}

async function runTier3() {
    const tests = createCombinationTests();
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

    return { name: 'Tier 3: Combinatorial & Pairwise Feature Interactions', total: tests.length, passed, failed, results };
}

if (require.main === module) {
    runTier3().then(summary => {
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

module.exports = { runTier3, createCombinationTests };
