"""Capture actual yvUSD strategy debts; never fetch or infer risk/loss assumptions."""
import datetime
import hashlib
import json
import math
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://kong.yearn.fi/api/rest/snapshot/1/0x696d02Db93291651ED510704c9b286841d506987'
inputs = json.loads((ROOT / 'src/mock-data/tranche-allocation-inputs.json').read_text())
with urlopen(URL, timeout=30) as response:
    raw = response.read()
snapshot = json.loads(raw)
strategies = []
raw_debt = 0
seen = set()
for item in snapshot['composition']:
    debt = int(item['currentDebt'])
    if debt == 0:
        continue
    if debt < 0 or item['address'].lower() in seen:
        raise ValueError('Invalid or duplicate strategy debt')
    seen.add(item['address'].lower())
    mapping = inputs['strategyDependencies'].get(item['address'].lower())
    if not mapping or any(name not in {row['name'] for row in inputs['dependencies']} for name in mapping):
        raise ValueError(f"New strategy needs an explicitly labeled dependency mapping: {item['address']}")
    amount = float(item['currentDebtUsd'])
    if not math.isfinite(amount) or amount <= 0:
        raise ValueError('Funded strategy requires a positive USD valuation')
    strategies.append({'address': item['address'], 'name': item['name'], 'allocationUsd': amount})
    raw_debt += debt
if raw_debt <= 0 or raw_debt != int(snapshot['totalDebt']):
    raise ValueError('Incomplete strategy debt coverage')
idle = int(snapshot['totalIdle'])
if idle < 0 or raw_debt + idle != int(snapshot['totalAssets']):
    raise ValueError('Debt and idle must reconcile to total assets')
# All debt and idle are denominated in the same vault asset. Use the API's
# aggregate USD conversion to value idle at the same price, rather than a stale TVL row.
usd_debt = sum(item['allocationUsd'] for item in strategies)
usd_idle = idle * usd_debt / raw_debt
output = {
    'source': URL,
    'sourceSha256': hashlib.sha256(raw).hexdigest(),
    'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'observedAt': datetime.datetime.fromtimestamp(int(snapshot['blockTime']), datetime.timezone.utc).isoformat(),
    'blockNumber': int(snapshot['blockNumber']),
    'allocationBasis': 'currentDebtUsd',
    'totalAllocationUsd': usd_debt + usd_idle,
    'idleUsd': usd_idle,
    'strategies': strategies,
}
(ROOT / 'src/mock-data/tranche-allocation-exposures.json').write_text(json.dumps(output, indent=2) + '\n')
print(f"Captured {len(strategies)} funded strategies at block {output['blockNumber']}")
