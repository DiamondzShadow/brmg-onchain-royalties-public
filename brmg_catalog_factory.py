#!/usr/bin/env python3
"""
BRMG Catalog Factory — batch-register BRMG catalog works as Story IP Assets.

Takes a catalog spec (JSON list of works), and for each work:
  1. resolves cover art (local file / existing ipfs|https|data URI / inline)
  2. builds music-standard NFT + IP metadata
  3. hosts metadata (and art) via Pinata IPFS  -- or self-contained data: URIs
  4. mints + registers it as an IP Asset with PIL license terms into the BRMG
     SPG collection (one IP Asset per catalog work)
  5. appends the on-chain result to an idempotent ledger (re-runs skip done work)

Backends:
  --backend ipfs   pin art+metadata to IPFS via Pinata (needs an UNBLOCKED Pinata
                   account; auth alone is not enough — the plan must allow pins)
  --backend data   embed metadata in self-contained data: URIs (no hosting needed;
                   proven to register on Story). Cover art referenced as given.

Run (defaults to --backend storj):
  cd ~/story-mcp-hub
  .venv/bin/python ~/billionaires-row-protocol/story-ip-pilot/brmg_catalog_factory.py \
      --spec ~/billionaires-row-protocol/story-ip-pilot/catalog.json

Env: ~/.brmg-factory.env (PINATA_JWT, BRMG_SPG_CONTRACT) + story-sdk-mcp/.env
     (WALLET_PRIVATE_KEY, RPC_PROVIDER_URL).
"""
import os, sys, json, time, base64, argparse, mimetypes
from pathlib import Path

HUB = os.path.expanduser("~/story-mcp-hub/story-sdk-mcp")
sys.path.insert(0, HUB)
from dotenv import load_dotenv
load_dotenv(os.path.expanduser("~/.brmg-factory.env"))
load_dotenv(os.path.join(HUB, ".env"))

import requests
from web3 import Web3
from eth_account import Account
from services.story_service import StoryService

RPC = os.getenv("RPC_PROVIDER_URL", "https://mainnet.storyrpc.io")
PK = os.getenv("WALLET_PRIVATE_KEY")
SPG = os.getenv("BRMG_SPG_CONTRACT", "0x020CE1b10Ce744Fc876633fD4B8b3b06fC426c76")
PINATA_JWT = os.getenv("PINATA_JWT", "")
PINATA_GW = "https://gateway.pinata.cloud/ipfs/"
# Storj S3 (upload) + linksharing (public read)
STORJ_AK = os.getenv("STORJ_ACCESS_KEY_ID", "")
STORJ_SK = os.getenv("STORJ_SECRET_ACCESS_KEY", "")
STORJ_ENDPOINT = os.getenv("STORJ_ENDPOINT", "https://gateway.storjshare.io")
STORJ_BUCKET = os.getenv("STORJ_BUCKET", "crabby")
STORJ_PUB = os.getenv("STORJ_PUBLIC_LINKSHARE_KEY", "")
STORJ_PREFIX = os.getenv("STORJ_PREFIX", "brmg")
HERE = os.path.dirname(os.path.abspath(__file__))
LEDGER = os.path.join(HERE, "catalog-ledger.json")
MIN_IP_WEI = 1 * 10**18


def ip_balance(addr):
    r = requests.post(RPC, json={"jsonrpc": "2.0", "method": "eth_getBalance",
                                 "params": [addr, "latest"], "id": 1}, timeout=15)
    return int(r.json()["result"], 16)


# ---- hosting -----------------------------------------------------------------
def pin_json(obj, name):
    r = requests.post("https://api.pinata.cloud/pinning/pinJSONToIPFS",
                      headers={"Authorization": f"Bearer {PINATA_JWT}"},
                      json={"pinataContent": obj, "pinataMetadata": {"name": name}}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Pinata pinJSON failed ({r.status_code}): {r.text}")
    return "ipfs://" + r.json()["IpfsHash"]


def pin_file(path, name):
    mt = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as fh:
        r = requests.post("https://api.pinata.cloud/pinning/pinFileToIPFS",
                          headers={"Authorization": f"Bearer {PINATA_JWT}"},
                          files={"file": (os.path.basename(path), fh, mt)},
                          data={"pinataMetadata": json.dumps({"name": name})}, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"Pinata pinFile failed ({r.status_code}): {r.text}")
    return "ipfs://" + r.json()["IpfsHash"]


_storj = None
def storj_client():
    global _storj
    if _storj is None:
        import boto3
        from botocore.config import Config
        _storj = boto3.client(
            "s3", endpoint_url=STORJ_ENDPOINT,
            aws_access_key_id=STORJ_AK, aws_secret_access_key=STORJ_SK,
            # botocore>=1.36 auto-checksum forces aws-chunked, which Storj rejects
            config=Config(request_checksum_calculation="when_required",
                          response_checksum_validation="when_required"))
    return _storj


def storj_put(key, data: bytes, content_type):
    """Upload to Storj and return a permanent public linksharing URL."""
    full = f"{STORJ_PREFIX}/{key}"
    storj_client().put_object(Bucket=STORJ_BUCKET, Key=full, Body=data, ContentType=content_type)
    return f"https://link.storjshare.io/raw/{STORJ_PUB}/{STORJ_BUCKET}/{full}"


def keccak_hex(obj):
    return Web3.to_hex(Web3.keccak(text=json.dumps(obj, sort_keys=True)))


def data_uri(obj):
    return "data:application/json;base64," + base64.b64encode(
        json.dumps(obj, sort_keys=True).encode()).decode()


def resolve_image(work, backend):
    """Return an image URI usable in metadata."""
    img = work.get("image")
    if not img:
        return work.get("image_uri", "")            # may be empty -> ok for pilot
    if img.startswith(("ipfs://", "https://", "http://", "data:")):
        return img
    # local file
    p = img if os.path.isabs(img) else os.path.join(HERE, img)
    if not os.path.exists(p):
        raise FileNotFoundError(f"image not found: {p}")
    if backend == "ipfs":
        return pin_file(p, f"brmg-art-{work['key']}")
    if backend == "storj":
        ext = os.path.splitext(p)[1].lstrip(".") or "bin"
        mt = mimetypes.guess_type(p)[0] or "application/octet-stream"
        return storj_put(f"{work['key']}/cover.{ext}", Path(p).read_bytes(), mt)
    # data backend cannot host a local image (inlining it bloats the on-chain
    # metadata past the registration call's practical size). Real art requires
    # --backend ipfs or --backend storj. Keep a short reference so reg stays small.
    print(f"      ! local art '{os.path.basename(p)}' not embedded in data: backend "
          f"(use --backend ipfs|storj to host real art). Referencing placeholder.")
    return work.get("image_uri", "ipfs://PENDING-host-via-ipfs-or-storj")


# ---- metadata ----------------------------------------------------------------
def build_metadata(work, image_uri, owner):
    attrs = [
        {"trait_type": "Rights Type",    "value": work.get("rights_type", "Master Recording")},
        {"trait_type": "Master Owner",   "value": work.get("master_owner", "Billionaires Row Music Group")},
        {"trait_type": "Artist",         "value": work.get("artist", "")},
        {"trait_type": "ISRC",           "value": work.get("isrc", "PENDING")},
        {"trait_type": "ISWC",           "value": work.get("iswc", "PENDING")},
        {"trait_type": "Publisher",      "value": work.get("publisher", "BRMG Publishing")},
        {"trait_type": "BRMG Catalog ID","value": work["key"]},
        {"trait_type": "Genre",          "value": work.get("genre", "")},
        {"trait_type": "Release Date",   "value": work.get("release_date", "")},
    ]
    nft = {"name": work["title"], "description": work.get("description", work["title"]),
           "image": image_uri, "attributes": attrs}
    ip = {"title": work["title"], "description": work.get("description", work["title"]),
          "createdAt": int(time.time()), "image": image_uri, "mediaUrl": image_uri,
          "mediaType": work.get("media_type", "audio/mpeg"),
          "creators": [{"name": "Billionaires Row Music Group", "address": owner,
                        "contributionPercent": 100}],
          "attributes": attrs}
    return nft, ip


def registration_metadata(work, image_uri, owner, backend):
    nft, ip = build_metadata(work, image_uri, owner)
    if backend == "ipfs":
        nft_uri = pin_json(nft, f"brmg-nft-{work['key']}")
        ip_uri = pin_json(ip, f"brmg-ip-{work['key']}")
    elif backend == "storj":
        # upload the EXACT canonical bytes that keccak_hex() hashes, so the
        # hosted content matches the on-chain hash byte-for-byte.
        nft_uri = storj_put(f"{work['key']}/nft.json",
                            json.dumps(nft, sort_keys=True).encode(), "application/json")
        ip_uri = storj_put(f"{work['key']}/ip.json",
                           json.dumps(ip, sort_keys=True).encode(), "application/json")
    else:
        nft_uri, ip_uri = data_uri(nft), data_uri(ip)
    return {
        "ip_metadata_uri": ip_uri, "ip_metadata_hash": keccak_hex(ip),
        "nft_metadata_uri": nft_uri, "nft_metadata_hash": keccak_hex(nft),
    }, {"nft": nft, "ip": ip}


# ---- ledger ------------------------------------------------------------------
def load_ledger():
    return json.load(open(LEDGER)) if os.path.exists(LEDGER) else {}


def save_ledger(d):
    json.dump(d, open(LEDGER, "w"), indent=2)


# ---- main --------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", default=os.path.join(HERE, "catalog.json"))
    ap.add_argument("--backend", choices=["ipfs", "storj", "data"], default="storj")
    ap.add_argument("--only", help="register only this work key")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not PK:
        sys.exit("FATAL: WALLET_PRIVATE_KEY missing")
    owner = Account.from_key(PK).address
    works = json.load(open(args.spec))
    if args.only:
        works = [w for w in works if w["key"] == args.only]
    ledger = load_ledger()

    print(f"BRMG Catalog Factory")
    print(f"  SPG collection: {SPG}")
    print(f"  Owner wallet:   {owner}")
    print(f"  Backend:        {args.backend}")
    print(f"  Works in spec:  {len(works)}  | already registered: {len(ledger)}")

    todo = [w for w in works if w["key"] not in ledger]
    print(f"  To register:    {len(todo)}  {[w['key'] for w in todo]}")
    if not todo:
        print("  nothing to do."); return
    if args.dry_run:
        print("  (dry-run) stopping before any tx."); return

    bal = ip_balance(owner)
    print(f"  IP balance:     {bal/1e18:.4f}")
    if bal < MIN_IP_WEI:
        sys.exit(f"✋ underfunded ({bal/1e18:.4f} IP). Fund {owner} on Story.")

    svc = StoryService(rpc_url=RPC, private_key=PK, network="mainnet")

    for w in todo:
        print(f"\n=== {w['key']} — {w['title']} ===")
        image_uri = resolve_image(w, args.backend)
        print(f"  image: {image_uri[:60]}{'…' if len(image_uri)>60 else ''}")
        reg, snapshot = registration_metadata(w, image_uri, owner, args.backend)
        print(f"  ip uri:  {reg['ip_metadata_uri'][:55]}…")
        pil = w.get("pil", {})
        out = svc.mint_and_register_ip_with_terms(
            commercial_rev_share=pil.get("commercial_rev_share", 10),
            derivatives_allowed=pil.get("derivatives_allowed", True),
            registration_metadata=reg,
            commercial_use=pil.get("commercial_use", True),
            minting_fee=pil.get("minting_fee", 0),
            spg_nft_contract=SPG,
        )
        rec = {
            "title": w["title"], "artist": w.get("artist", ""),
            "ip_id": out["ip_id"], "token_id": out["token_id"],
            "license_terms_ids": out["license_terms_ids"], "tx_hash": out.get("tx_hash"),
            "backend": args.backend, "image_uri": image_uri,
            "ip_metadata_uri": "data:(inline)" if args.backend == "data" else reg["ip_metadata_uri"],
            "pil": pil, "registered_at": int(time.time()),
        }
        ledger[w["key"]] = rec
        save_ledger(ledger)
        print(f"  ✅ IP {out['ip_id']} | token #{out['token_id']} | terms {out['license_terms_ids']}")
        print(f"     https://explorer.story.foundation/ipa/{out['ip_id']}")

    print(f"\nDone. Ledger: {LEDGER} ({len(ledger)} works total)")


if __name__ == "__main__":
    main()
