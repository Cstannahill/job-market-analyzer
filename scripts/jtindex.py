cat > jtindex.py << "EOF"
#!/usr/bin/env python3
import os, sys, time, re, unicodedata
from datetime import datetime, timezone
from typing import Iterable, Dict, Any, Set
import boto3

JOBS_TABLE = "job-postings-enhanced"
INDEX_TABLE = "job-tech-index-v2"

dynamodb = boto3.resource("dynamodb")
jobs = dynamodb.Table(JOBS_TABLE)
idx = dynamodb.Table(INDEX_TABLE)


# ---------- time helpers ----------
def parse_iso_or_epoch(val):
    if not val:
        return datetime.now(timezone.utc).isoformat()
    if isinstance(val, (int, float)):
        return datetime.fromtimestamp(val, tz=timezone.utc).isoformat()
    s = str(val).strip()
    try:
        if s.endswith("Z"):
            return (
                datetime.fromisoformat(s.replace("Z", "+00:00"))
                .astimezone(timezone.utc)
                .isoformat()
            )
        return datetime.fromisoformat(s).astimezone(timezone.utc).isoformat()
    except Exception:
        for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                return (
                    datetime.strptime(s, fmt).replace(tzinfo=timezone.utc).isoformat()
                )
            except Exception:
                pass
        return datetime.now(timezone.utc).isoformat()


# ---------- slugify ----------
# Minimal structural transforms (not a giant exceptions list)
STRUCTURAL_MAP = {
    "c#": "csharp",
    "csharp": "csharp",
    "c++": "cpp",
    "cpp": "cpp",
    ".net": "dotnet",
    "node.js": "nodejs",
    "next.js": "nextjs",
    "nuxt.js": "nuxtjs",
    "express.js": "express",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "mongo": "mongodb",
    "mongodb": "mongodb",
}


def normalize_unicode(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def structural_pass(s: str) -> str:
    t = s.lower().strip()
    # quick wins first
    if t in STRUCTURAL_MAP:
        return STRUCTURAL_MAP[t]
    # handle common .js pattern generically
    if t.endswith(".js"):
        base = t[:-3]
        if base in ("node", "next", "nuxt", "express"):
            return STRUCTURAL_MAP.get(t, base + "js")
    return t


def slugify_tech(raw: str) -> str:
    if not raw or not isinstance(raw, str):
        return ""
    # 1) structural transforms on the raw string
    t = structural_pass(raw)
    # 2) unicode fold
    t = normalize_unicode(t)
    # 3) replace anything non-alnum with a dash
    t = re.sub(r"[^a-z0-9]+", "-", t.lower())
    # 4) collapse dashes and trim
    t = re.sub(r"-{2,}", "-", t).strip("-")
    return t


# ---------- scan ----------
def scan_jobs():
    lek = None
    proj = "#pk,#sk,id,jobId,#st,processed_date,technologies"
    ean = {"#pk": "PK", "#sk": "SK", "#st": "status"}  # status is reserved
    while True:
        kwargs = {"ProjectionExpression": proj, "ExpressionAttributeNames": ean}
        if lek:
            kwargs["ExclusiveStartKey"] = lek
        resp = jobs.scan(**kwargs)
        for it in resp.get("Items", []):
            yield it
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break


# ---------- build write batch ----------
def build_puts(j: Dict[str, Any]):
    job_id = j.get("id") or j.get("jobId")
    if not job_id:
        pk = j.get("PK") or ""
        if isinstance(pk, str) and pk.startswith("JOB#"):
            job_id = pk[4:]
    if not job_id:
        return []

    status = (j.get("status") or "Active").strip() or "Active"
    processed = parse_iso_or_epoch(j.get("processed_date"))

    techs = j.get("technologies") or []
    slugs: Set[str] = set()

    for t in techs:
        s = slugify_tech(str(t))
        if s:
            slugs.add(s)

    if not slugs:
        return []

    puts = []
    sk = f"{status}#{processed}#{job_id}"
    for slug in sorted(slugs):
        item = {
            "PK": slug,  # slug as partition key
            "SK": sk,  # status#processed#jobId
            "slug": slug,  # convenience
            "jobId": job_id,  # for hydration
            # "display": t_norm  # optional: store a display label later if you want
        }
        puts.append({"PutRequest": {"Item": item}})
    return puts


def batch_write(items):
    if not items:
        return 0
    written = 0
    with idx.batch_writer(overwrite_by_pkeys=["PK", "SK"]) as bw:
        for i in items:
            bw.put_item(Item=i["PutRequest"]["Item"])
            written += 1
    return written


def main():
    scanned = written = 0
    buf = []
    print(f"Backfilling from {JOBS_TABLE} → {INDEX_TABLE} (slug PK)")
    try:
        for j in scan_jobs():
            scanned += 1
            buf.extend(build_puts(j))
            if len(buf) >= 500:
                written += batch_write(buf)
                buf = []
                if scanned % 2000 == 0:
                    print(f"… scanned {scanned}, wrote {written}")
        if buf:
            written += batch_write(buf)
        print(f"✓ Done. scanned={scanned}, wrote={written}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
EOF
