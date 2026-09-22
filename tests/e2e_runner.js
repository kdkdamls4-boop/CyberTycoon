/**
 * tests/e2e_runner.js
 * 
 * Central Test Runner for CyberTycoon Automated Test Suite
 * Executes Tier 1 (Features), Tier 2 (Boundaries), Tier 3 (Combinations),
 * and Tier 4 (Workload Playthroughs).
 * 
 * Exits with status code 0 if all tests pass, or non-zero (1) if any fail.
 */

const { runTier1 } = require('./tier1_features.test.js');
const { runTier2 } = require('./tier2_boundaries.test.js');
const { runTier3 } = require('./tier3_combinations.test.js');
const { runTier4 } = require('./tier4_workloads.test.js');

async function runAllTiers() {
    const startTime = Date.now();

    console.log('='.repeat(78));
    console.log('  CYBERTYCOON AUTOMATED E2E TEST SUITE (TIERS 1 - 4)');
    console.log('='.repeat(78));
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('Runtime: Node.js (Headless DOM & Canvas Mock Environment)\n');

    const tiers = [
        { name: 'Tier 1: Feature Happy-Path Verification (F1 - F12)', runner: runTier1 },
        { name: 'Tier 2: Boundary Value Analysis & Stress Testing', runner: runTier2 },
        { name: 'Tier 3: Combinatorial & Pairwise Feature Interactions', runner: runTier3 },
        { name: 'Tier 4: End-to-End Workload Playthrough Scenarios', runner: runTier4 }
    ];

    const summaries = [];
    let globalTotal = 0;
    let globalPassed = 0;
    let globalFailed = 0;
    const allFailures = [];

    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        console.log(`\n[Running ${i + 1}/4] ${tier.name}...`);
        const tierStart = Date.now();
        
        try {
            const summary = await tier.runner();
            const tierDuration = Date.now() - tierStart;
            summary.duration = tierDuration;
            summaries.push(summary);

            globalTotal += summary.total;
            globalPassed += summary.passed;
            globalFailed += summary.failed;

            console.log(`  -> Finished in ${tierDuration}ms | Passed: ${summary.passed}/${summary.total} | Failed: ${summary.failed}`);

            for (const r of summary.results) {
                if (!r.passed) {
                    allFailures.push({ tier: tier.name, id: r.id, title: r.title, error: r.error });
                }
            }
        } catch (err) {
            console.error(`Fatal error executing ${tier.name}:`, err);
            globalFailed++;
            allFailures.push({ tier: tier.name, id: 'FATAL', title: 'Execution crashed', error: String(err) });
        }
    }

    const totalDuration = Date.now() - startTime;

    console.log('\n' + '='.repeat(78));
    console.log('  TEST EXECUTION SUMMARY');
    console.log('='.repeat(78));
    console.log(sprintf('%-50s %8s %8s %8s %8s', 'Tier Sub-Suite', 'Total', 'Passed', 'Failed', 'Time'));
    console.log('-'.repeat(78));

    for (const s of summaries) {
        console.log(sprintf('%-50s %8d %8d %8d %7dms', s.name.slice(0, 50), s.total, s.passed, s.failed, s.duration));
    }

    console.log('-'.repeat(78));
    console.log(sprintf('%-50s %8d %8d %8d %7dms', 'TOTAL AGGREGATE', globalTotal, globalPassed, globalFailed, totalDuration));
    console.log('='.repeat(78));

    if (allFailures.length > 0) {
        console.log(`\nDETAILED FAILURE BREAKDOWN (${allFailures.length} failed tests):`);
        console.log('-'.repeat(78));
        allFailures.forEach((f, idx) => {
            console.log(`\n${idx + 1}. [${f.id}] ${f.title}`);
            console.log(`   Tier:  ${f.tier}`);
            console.log(`   Error: ${f.error}`);
        });
        console.log('\n' + '-'.repeat(78));
    }

    const passRate = globalTotal > 0 ? ((globalPassed / globalTotal) * 100).toFixed(1) : '0.0';
    console.log(`\nFinal Verdict: ${globalFailed === 0 ? '✓ 100% ALL TESTS PASSED' : `✗ ${globalFailed} TEST(S) FAILED`} (Pass Rate: ${passRate}%)`);
    console.log(`Total Test Execution Time: ${totalDuration}ms\n`);

    return {
        total: globalTotal,
        passed: globalPassed,
        failed: globalFailed,
        duration: totalDuration,
        summaries,
        failures: allFailures
    };
}

function sprintf(format, ...args) {
    let argIdx = 0;
    return format.replace(/%(-)?(\d+)?([sdf])/g, (match, leftAlign, width, type) => {
        let val = args[argIdx++];
        if (type === 'd') val = parseInt(val, 10);
        let str = String(val);
        if (width) {
            const padLen = parseInt(width, 10) - str.length;
            if (padLen > 0) {
                const pad = ' '.repeat(padLen);
                str = leftAlign ? (str + pad) : (pad + str);
            }
        }
        return str;
    });
}

if (require.main === module) {
    runAllTiers().then(res => {
        process.exit(res.failed > 0 ? 1 : 0);
    }).catch(err => {
        console.error('Unhandled runner exception:', err);
        process.exit(1);
    });
}

module.exports = { runAllTiers };
