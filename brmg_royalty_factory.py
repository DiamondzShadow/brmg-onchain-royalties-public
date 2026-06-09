#!/usr/bin/env python3
"""
BRMG Royalty Factory (Phase 1) — register each catalog work as a Story IP Asset AND
distribute its Royalty Tokens to stakeholders in ONE atomic, audited transaction.

This is the Model-1 ownership layer from docs/BRMG-ECONOMY.md. It writes NO new Solidity:
it drives Story Protocol's audited `RoyaltyTokenDistributionWorkflows`
(`mintAndRegisterIpAndAttachPILTermsAndDistributeRoyaltyTokens`), which:
  1. mints an SPG NFT into the BRMG catalog collection,
  2. registers it as an IP Asset,
  3. attaches PIL commercial terms (rev share + derivatives → upstream pay via PIL),
  4. deploys the IP Royalty Vault and splits its 100,000,000 Royalty Tokens (RT) to the
     stakeholder addresses in `splits` — atomically, no post-hoc signature dance.

Each RT holder later calls Story's `claimAllRevenue` to pull their pro-rata of revenue
paid into the vault. Artist holds the majority; collaborators auto-split; a fan-pool
address holds the fan allocation (Phase 3 distributes from it via proof-of-fandom).

Splits live per-work in the spec:
  "splits": [
    {"recipient": "0x..", "role": "artist",       "percentage": 60},
    {"recipient": "0x..", "role": "producer",     "percentage": 15},
    {"recipient": "0x..", "role": "writer",        "percentage": 5},
    {"recipient": "0x..", "role": "fan_pool",      "percentage": 20}
  ]
Percentages are human percent (must sum to EXACTLY 100). They are converted to Story's
millionths unit (100% = 100_000_000) before the call.

Run (defaults to --backend storj):
  cd ~/story-mcp-hub
  .venv/bin/python ~/billionaires-row-protocol/story-ip-pilot/brmg_royalty_factory.py \
      --spec ~/billionaires-row-protocol/story-ip-pilot/catalog-royalty.json --dry-run

--dry-run builds each tx and runs eth_estimateGas (which reverts on bad permissions /
bad structs / bad split sums) WITHOUT sending — verify before spending real IP.

Env: ~/.brmg-factory.env (+ story-sdk-mcp/.env) — same as brmg_catalog_factory.
"""
import os, sys, json, time, argparse

HUB = os.path.expanduser("~/story-mcp-hub/story-sdk-mcp")
sys.path.insert(0, HUB)

# Reuse the proven hosting/metadata pipeline from the catalog factory (same dir).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import brmg_catalog_factory as cat  # resolve_image, registration_metadata, ip_balance, SPG, RPC, PK, etc.

from eth_account import Account
from story_protocol_python_sdk.utils.transaction_utils import build_and_send_transaction
from story_protocol_python_sdk.abi.RoyaltyTokenDistributionWorkflows.RoyaltyTokenDistributionWorkflows_client import (
    RoyaltyTokenDistributionWorkflowsClient,
)
from services.story_service import StoryService

HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(HERE, "royalty-ledger.json")
WIP = "0x1514000000000000000000000000000000000000"  # native IP wrapper, the rev currency
PCT_DENOM = 100_000_000  # Story: 100_000_000 == 100%
MIN_IP_WEI = 1 * 10**18


def load_ledger():
    return json.load(open(LEDGER)) if os.path.exists(LEDGER) else {}


def save_ledger(d):
    json.dump(d, open(LEDGER, "w"), indent=2)


def to_millionths(pct):
    """Human percent -> Story millionths. 60 -> 60_000_000."""
    return int(round((float(pct) / 100.0) * PCT_DENOM))


def build_royalty_shares(splits):
    """Validate a splits list and return the on-chain RoyaltyShare list (dicts web3 maps
    to the (recipient,percentage) tuple). Enforces sum == exactly 100%."""
    if not splits:
        raise ValueError("work has no 'splits' — every royalty work needs stakeholder shares")
    shares, total = [], 0
    for s in splits:
        pct = to_millionths(s["percentage"])
        if pct <= 0:
            raise ValueError(f"split for {s.get('role','?')} must be > 0%")
        total += pct
        shares.append({"recipient": cat.Web3.to_checksum_address(s["recipient"]), "percentage": pct})
    if total != PCT_DENOM:
        raise ValueError(
            f"splits must sum to EXACTLY 100% (got {total/PCT_DENOM*100:.4f}%). "
            f"Story mints 100,000,000 RT = 100%; partial distribution is rejected."
        )
    return shares


def build_pil_terms(pil, license_terms_util):
    """Mirror IPAsset.mint_and_register_ip_asset_with_pil_terms term construction exactly:
    snake_case dict -> validate_license_terms (mutates rev_share->millionths,
    checker_data->bytes) -> camelCase dict that web3 maps to the PILTerms tuple."""
    commercial_use = pil.get("commercial_use", True)
    rev_share = pil.get("commercial_rev_share", 10)
    derivatives = pil.get("derivatives_allowed", True)
    minting_fee = pil.get("minting_fee", 0)
    royalty_policy = (
        license_terms_util.web3.to_checksum_address(  # RoyaltyPolicyLAP, the liquid-split policy
            cat_royalty_policy_lap()
        )
        if commercial_use
        else "0x0000000000000000000000000000000000000000"
    )

    terms = {
        "transferable": True,
        "royalty_policy": royalty_policy,
        "default_minting_fee": minting_fee,
        "expiration": 0,
        "commercial_use": commercial_use,
        "commercial_attribution": False,
        "commercializer_checker": "0x0000000000000000000000000000000000000000",
        "commercializer_checker_data": "0x",
        "commercial_rev_share": rev_share,  # validate_* converts 10 -> 10_000_000 in place
        "commercial_rev_ceiling": 0,
        "derivatives_allowed": derivatives,
        "derivatives_attribution": derivatives,
        "derivatives_approval": False,
        "derivatives_reciprocal": derivatives,  # reciprocal => derivatives pay upstream via PIL
        "derivative_rev_ceiling": 0,
        "currency": WIP,
        "uri": "",
    }
    cfg = {
        "is_set": False,
        "minting_fee": minting_fee,
        "hook_data": "",
        "licensing_hook": "0x0000000000000000000000000000000000000000",
        "commercial_rev_share": rev_share,
        "disabled": False,
        "expect_minimum_group_reward_share": 0,
        "expect_group_reward_pool": "0x0000000000000000000000000000000000000000",
    }
    license_terms_util.validate_license_terms(terms)        # mutates terms in place
    vcfg = license_terms_util.validate_licensing_config(cfg)

    camel_terms = {
        "transferable": terms["transferable"],
        "royaltyPolicy": terms["royalty_policy"],
        "defaultMintingFee": terms["default_minting_fee"],
        "expiration": terms["expiration"],
        "commercialUse": terms["commercial_use"],
        "commercialAttribution": terms["commercial_attribution"],
        "commercializerChecker": terms["commercializer_checker"],
        "commercializerCheckerData": terms["commercializer_checker_data"],
        "commercialRevShare": terms["commercial_rev_share"],
        "commercialRevCeiling": terms["commercial_rev_ceiling"],
        "derivativesAllowed": terms["derivatives_allowed"],
        "derivativesAttribution": terms["derivatives_attribution"],
        "derivativesApproval": terms["derivatives_approval"],
        "derivativesReciprocal": terms["derivatives_reciprocal"],
        "derivativeRevCeiling": terms["derivative_rev_ceiling"],
        "currency": terms["currency"],
        "uri": terms["uri"],
    }
    camel_cfg = {
        "isSet": vcfg["is_set"],
        "mintingFee": vcfg["minting_fee"],
        "hookData": vcfg["hook_data"],
        "licensingHook": vcfg["licensing_hook"],
        "commercialRevShare": vcfg["commercial_rev_share"],
        "disabled": vcfg["disabled"],
        "expectMinimumGroupRewardShare": vcfg["expect_minimum_group_reward_share"],
        "expectGroupRewardPool": vcfg["expect_group_reward_pool"],
    }
    return {"terms": camel_terms, "licensingConfig": camel_cfg}


def cat_royalty_policy_lap():
    """RoyaltyPolicyLAP address from the SDK config (the same source the SDK uses)."""
    import story_protocol_python_sdk, json as _json
    base = os.path.dirname(story_protocol_python_sdk.__file__)
    cfg = _json.load(open(os.path.join(base, "scripts", "config.json")))
    for c in cfg["contracts"]:
        if c["contract_name"] == "RoyaltyPolicyLAP":
            return c["contract_address"]
    raise RuntimeError("RoyaltyPolicyLAP not in SDK config.json")


def metadata_struct(reg):
    return {
        "ipMetadataURI": reg["ip_metadata_uri"],
        "ipMetadataHash": cat.Web3.to_bytes(hexstr=reg["ip_metadata_hash"]),
        "nftMetadataURI": reg["nft_metadata_uri"],
        "nftMetadataHash": cat.Web3.to_bytes(hexstr=reg["nft_metadata_hash"]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", default=os.path.join(HERE, "catalog-royalty.json"))
    ap.add_argument("--backend", choices=["ipfs", "storj", "data"], default="storj")
    ap.add_argument("--only", help="register only this work key")
    ap.add_argument("--dry-run", action="store_true",
                    help="build + estimate gas (reverts surface here) but DO NOT send")
    args = ap.parse_args()

    if not cat.PK:
        sys.exit("FATAL: WALLET_PRIVATE_KEY missing")
    owner = Account.from_key(cat.PK).address
    works = json.load(open(args.spec))
    if args.only:
        works = [w for w in works if w["key"] == args.only]
    ledger = load_ledger()

    print("BRMG Royalty Factory (Phase 1 — register + distribute royalty tokens)")
    print(f"  SPG collection: {cat.SPG}")
    print(f"  Owner wallet:   {owner}")
    print(f"  Backend:        {args.backend}")
    print(f"  Workflow:       RoyaltyTokenDistributionWorkflows (Story audited)")

    todo = [w for w in works if w["key"] not in ledger]
    print(f"  To register:    {len(todo)}  {[w['key'] for w in todo]}")
    if not todo:
        print("  nothing to do."); return

    svc = StoryService(rpc_url=cat.RPC, private_key=cat.PK, network="mainnet")
    web3 = svc.web3
    account = svc.account
    lt_util = svc.client.IPAsset.license_terms_util
    rtd = RoyaltyTokenDistributionWorkflowsClient(web3)

    # Confirm the SPG mint fee is something we can cover (our collection is free).
    fee_info = svc.get_spg_nft_minting_token(cat.SPG)
    mint_fee = fee_info.get("mint_fee", 0)
    if mint_fee and mint_fee > 0:
        print(f"  ⚠ SPG charges a mint fee of {mint_fee} wei ({fee_info.get('mint_fee_token')}) — "
              f"approve/value handling required; aborting so it isn't silently paid.")
        sys.exit(1)

    if not args.dry_run:
        bal = cat.ip_balance(owner)
        print(f"  IP balance:     {bal/1e18:.4f}")
        if bal < MIN_IP_WEI:
            sys.exit(f"✋ underfunded ({bal/1e18:.4f} IP). Fund {owner} on Story.")

    for w in todo:
        print(f"\n=== {w['key']} — {w['title']} ===")
        shares = build_royalty_shares(w.get("splits"))
        print("  splits: " + ", ".join(
            f"{s.get('role','?')} {s['percentage']}%" for s in w["splits"]))

        image_uri = cat.resolve_image(w, args.backend)
        reg, _snap = cat.registration_metadata(w, image_uri, owner, args.backend)
        meta = metadata_struct(reg)
        terms_data = [build_pil_terms(w.get("pil", {}), lt_util)]

        call_args = (cat.SPG, owner, meta, terms_data, shares, True)

        if args.dry_run:
            tx = rtd.build_mintAndRegisterIpAndAttachPILTermsAndDistributeRoyaltyTokens_transaction(
                *call_args, {"from": owner, "nonce": web3.eth.get_transaction_count(owner)})
            gas = web3.eth.estimate_gas(tx)   # reverts here if perms/structs/sum are wrong
            print(f"  ✅ dry-run OK — estimated gas {gas} (no tx sent)")
            continue

        resp = build_and_send_transaction(
            web3, account,
            rtd.build_mintAndRegisterIpAndAttachPILTermsAndDistributeRoyaltyTokens_transaction,
            *call_args,
        )
        receipt = resp["tx_receipt"]
        ipreg = svc.client.IPAsset._parse_tx_ip_registered_event(receipt)
        terms_ids = svc.client.IPAsset._parse_tx_license_terms_attached_event(receipt)
        ip_id = ipreg["ip_id"]
        vault = None
        try:
            vault = svc.client.Royalty.get_royalty_vault_address(ip_id)
        except Exception as e:
            print(f"  (vault lookup deferred: {e})")

        rec = {
            "title": w["title"], "artist": w.get("artist", ""),
            "ip_id": ip_id, "token_id": ipreg["token_id"],
            "license_terms_ids": terms_ids, "tx_hash": resp["tx_hash"],
            "royalty_vault": vault, "splits": w["splits"],
            "backend": args.backend, "image_uri": image_uri,
            "ip_metadata_uri": reg["ip_metadata_uri"], "pil": w.get("pil", {}),
            "registered_at": int(time.time()),
        }
        ledger[w["key"]] = rec
        save_ledger(ledger)
        print(f"  ✅ IP {ip_id} | token #{ipreg['token_id']} | terms {terms_ids}")
        print(f"     vault: {vault}")
        print(f"     https://explorer.story.foundation/ipa/{ip_id}")

    print(f"\nDone. Ledger: {LEDGER} ({len(ledger)} works total)")


if __name__ == "__main__":
    main()
