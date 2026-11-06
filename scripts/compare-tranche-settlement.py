"""Compare keeper settlement/report cadences using the frozen tranche inputs.

Daily observations and inferred end-of-day flows stay fixed. Accrual follows
controller call timing: settle accrues all tranches; a flow accrues its tranche.
This comparison isolates settlement cadence with zero unlock delay. The current
mock additionally locks Junior/Equity profits; only economic NAV is compared here.
"""
import json
from pathlib import Path
from decimal import Decimal

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / 'src/mock-data/tranche-source.json').read_text())
CONFIG = json.loads((ROOT / 'src/mock-data/tranche-config.json').read_text())
FROZEN = json.loads((ROOT / 'src/mock-data/tranche-simulation.json').read_text())
IDS = ('senior', 'junior', 'equity')
WAD, YEAR, DAY = 10**18, 31556952, 86400


def units(value, decimals=6):
    return int(Decimal(value) * 10**decimals)


def run(cadence):
    total = units(SOURCE['totalTvl']['value'])
    locked = units(SOURCE['lockedTvl']['value'])
    initial = [total - locked - units(CONFIG['seniorReallocationUsd']),
               locked + units(CONFIG['juniorAdditionUsd']), units(CONFIG['equitySeedUsd'])]
    baseline = initial.copy()
    shares = [v * 10**12 for v in initial]
    rates = [CONFIG['targetBps'][id] * WAD // (10000 * YEAR) for id in IDS]
    last_accrual, paused, net_flows = [0]*3, [False]*3, [0]*3
    losses, excess, loss_counts = [0]*3, [0]*3, [0]*3
    observations = {
        key: {row['time']: units(row['value'], 20 if 'Pps' in key else 6)
              for row in SOURCE['history'][key]}
        for key in ('totalTvl', 'lockedTvl', 'unlockedPps', 'lockedPps')
    }
    pool, settlement_count = total, 0
    points = []

    def live(j, day):
        return baseline[j] + (0 if paused[j] else baseline[j] * rates[j] * ((day-last_accrual[j])*DAY) // WAD)

    def accrue(j, day):
        baseline[j] = live(j, day)
        last_accrual[j] = day

    for day, point in enumerate(SOURCE['pps']):
        time = point['time']
        flows = [0]*3
        if day:
            previous = SOURCE['pps'][day-1]
            pool = pool * units(point['value'], 20) // units(previous['value'], 20)
            t0 = previous['time']
            for j in (0, 1):
                balance = lambda t: (observations['totalTvl'][t] - observations['lockedTvl'][t]
                                     if j == 0 else observations['lockedTvl'][t])
                price = lambda t: observations['unlockedPps'][t] * (1 if j == 0 else observations['lockedPps'][t])
                flows[j] = balance(time) - balance(t0)*price(time)//price(t0)

        settle = day > 0 and (day % cadence == 0 or day == len(SOURCE['pps'])-1)
        if settle:
            settlement_count += 1
            for j in range(3):
                accrue(j, day)
            pnl = pool - sum(baseline)
            if pnl > 0:
                for j, id in enumerate(IDS):
                    paused[j] = False
                    gain = pnl * CONFIG['excessShareBps'][id] // 10000
                    # settleAndReport immediately realizes all pending excess.
                    baseline[j] += gain
                    excess[j] += gain
            elif pnl < 0:
                remaining = -pnl
                for j in (2, 1, 0):
                    loss = min(remaining, baseline[j])
                    baseline[j] -= loss
                    remaining -= loss
                    losses[j] += loss
                    if loss:
                        loss_counts[j] += 1
                        paused[j] = True
                assert remaining == 0

        for j, flow in enumerate(flows):
            if flow:
                accrue(j, day)
                assert baseline[j] > 0 and flow >= -baseline[j]
                delta = abs(flow)*shares[j]//baseline[j]
                shares[j] += delta if flow > 0 else -delta
                baseline[j] += flow
                net_flows[j] += flow
                pool += flow
        if settle:
            assert 0 <= pool - sum(baseline) <= 2
        points.append({'date': point.get('date', time), 'navUnits': [live(j, day) for j in range(3)],
                       'sharesUnits': shares.copy()})

    rows = {}
    for j, id in enumerate(IDS):
        rows[id] = dict(endingTvl=baseline[j]/1e6,
                        earnings=(baseline[j]-initial[j]-net_flows[j])/1e6,
                        returnPct=(baseline[j]*10**12/shares[j]-1)*100,
                        lossAbsorbed=losses[j]/1e6, lossSettlements=loss_counts[j],
                        excessAllocated=excess[j]/1e6, netFlow=net_flows[j]/1e6)
    return dict(cadenceDays=cadence, settlements=settlement_count, tranches=rows), points


daily, _ = run(1)
weekly, weekly_points = run(7)
# Validate independently implemented accounting against every frozen weekly-scenario observation.
for actual, frozen in zip(weekly_points, FROZEN['points'], strict=True):
    for j, id in enumerate(IDS):
        assert actual['navUnits'][j] == int(frozen['tranches'][id]['navUnits']), (frozen['date'], id)
print(json.dumps({'weeklyEconomicNavMatchesFrozenExactly': True, 'daily': daily, 'weekly': weekly}, indent=2))
