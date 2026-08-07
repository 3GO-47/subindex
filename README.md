# SubIndex — independent onchain yield analytics

Public, unaffiliated analytics for distribution protocols on Robinhood Chain:
the Index fee-treasury launchpad ("Indices"), $INDEX itself, and the tokenized
stock rails they pay out in.

**Not affiliated with The Index, Robinhood, or any project listed.** Every
number on the page is derived from public chain data at page load — there is no
backend, no database, and no privileged feed. Methodology is published on the
site so any figure can be reproduced independently.

## Architecture

`index.html` is one self-contained file. All data is fetched client-side from
sources that are CORS-open to a browser:

| Source | Used for |
|---|---|
| `rpc.mainnet.chain.robinhood.com` | v4 pool creation, treasury state via `eth_call`, keeper gas |
| `robinhoodchain.blockscout.com/api/v2` | contracts, holders, transfers, keeper activity |
| `api.dexscreener.com` | prices, market cap, liquidity, volume |

**Registry caveat, stated plainly:** the treasury contracts are *unverified* on
this chain, so they publish no ABI and their getters cannot be discovered from
chain alone. Client-side reads of treasury state would mean guessing function
selectors — we tried; they don't answer. Rather than ship guessed numbers, the
treasury registry is a scheduled **snapshot** (`data/protocols.json`, written by
`publish_subindex.py` from our own indexer, public chain facts only, allow-listed
field by field). Everything layered on top — prices, holders, keeper gas and
activity, pool creation — is read **live in the reader's browser**. The site
labels which is which and stamps the snapshot's age.

Roadmap: derive bindings and round counts purely from treasury event logs, which
removes the snapshot dependency entirely.

## Editorial stance

The site publishes **facts, not verdicts**: creator/holder split, holder
concentration, payout rounds executed, keeper liveness. Positive badges are
earned from observable behaviour (`VERIFIED PAYER`, `FULL PAYOUT`, `KEEPER LIVE`).
No project is labelled a scam; readers are given the numbers and the method.

## Deploy

Static — any host works. GitHub Pages: push this folder to a repo, enable Pages
on the default branch. Local preview: `python -m http.server 8080`.
