"""Refresh explicitly, then review the receipt before regenerating the frozen counterfactual."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'src/mock-data/tranche-config.json').read_text())
COMMIT = '58182cf41f38aa86365942a23af4876fbd76fca2'
BASE = 'https://kong.yearn.fi/api/rest'
UNLOCKED = '0x696d02Db93291651ED510704c9b286841d506987'
LOCKED = '0xAaaFEa48472f77563961Cdb53291DEDfB46F9040'
START = int(datetime.datetime.fromisoformat(CONFIG['start'].replace('Z', '+00:00')).timestamp())
END = int(datetime.datetime.fromisoformat(CONFIG['end'].replace('Z', '+00:00')).timestamp())
URLS = [
    f'{BASE}/timeseries/tvl/1/{UNLOCKED}',
    f'{BASE}/timeseries/tvl/1/{LOCKED}',
    f'{BASE}/timeseries/pps/1/{UNLOCKED}?components=humanized',
    f'https://raw.githubusercontent.com/yearn/ytranche/{COMMIT}/src/TrancheController.sol',
    f'{BASE}/timeseries/pps/1/{LOCKED}?components=humanized',
    f'{BASE}/timeseries/apy-historical/1/{UNLOCKED}?components=weeklyNet&components=monthlyNet',
    f'{BASE}/timeseries/apy-historical/1/{LOCKED}?components=weeklyNet&components=monthlyNet',
]

def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()

with concurrent.futures.ThreadPoolExecutor() as executor:
    raw = list(executor.map(fetch, URLS))

def migration_balance(payload):
    matches = [row for row in json.loads(payload) if int(row['time']) == START and row['component'] == 'tvl']
    if len(matches) != 1:
        raise ValueError('Need exactly one TVL observation at migration time')
    return {'time': START, 'value': matches[0]['value']}

source = {
    'schemaVersion': 2,
    'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'controllerCommit': COMMIT,
    'controllerSourceSha256': hashlib.sha256(raw[3]).hexdigest(),
    'sources': [{'url': url, 'sha256': hashlib.sha256(body).hexdigest()} for url, body in zip(URLS, raw)],
    'totalTvl': migration_balance(raw[0]),
    'lockedTvl': migration_balance(raw[1]),
    'history': {
        name: [row for row in json.loads(raw[index]) if int(row['time']) <= END]
        for name, index in [('totalTvl', 0), ('lockedTvl', 1), ('unlockedPps', 2), ('lockedPps', 4), ('seniorApy', 5), ('juniorApy', 6)]
    },
    'pps': [
        {'time': int(row['time']), 'value': row['value']}
        for row in json.loads(raw[2])
        if START <= int(row['time']) <= END and row['component'] == 'humanized'
    ],
}
(ROOT / 'src/mock-data/tranche-source.json').write_text(json.dumps(source, indent=2) + '\n')
print(json.dumps({key: source[key] for key in ['totalTvl', 'lockedTvl', 'controllerCommit']}))
