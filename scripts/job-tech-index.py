cat > jtindex.py << "EOF"
#!/usr/bin/env python3
import os, time, sys, re
import boto3
from datetime import datetime, timezone
from typing import Set, Dict, Tuple, List
from collections import defaultdict


JOBS_TABLE = "job-postings-enhanced"
INDEX_TABLE = "job-tech-index"

dynamodb = boto3.resource("dynamodb")
jobs = dynamodb.Table(JOBS_TABLE)
idx = dynamodb.Table(INDEX_TABLE)

# ---- COPY of your normalization logic (rules + behavior) --------------------
# Mirrors NORMALIZATION_RULES and normalize_term from your script.  :contentReference[oaicite:1]{index=1}
NORMALIZATION_RULES = {
    # JavaScript frameworks
    r"^react(?:\.js|js)?$": "React",
    r"^vue(?:\.js|js)?$": "Vue",
    r"^angular(?:\.js|js)?$": "Angular",
    r"^next(?:\.js|js)?$": "Next.js",
    r"^nuxt(?:\.js|js)?$": "Nuxt",
    r"^svelte(?:\.js|js)?$": "Svelte",
    # Python
    r"^python$": "Python",
    r"^django$": "Django",
    r"^fastapi$": "FastAPI",
    r"^flask$": "Flask",
    r"^pytorch$": "PyTorch",
    r"^tensorflow$": "TensorFlow",
    # Node
    r"^node(?:\.?js)?$": "Node.js",
    r"^express(?:\.js|js)?$": "Express",
    # Databases
    r"^postgre?sql$": "PostgreSQL",
    r"^mongo(?:db)?$": "MongoDB",
    r"^redis$": "Redis",
    r"^mysql$": "MySQL",
    r"^dynamodb$": "DynamoDB",
    r"^elasticsearch$": "Elasticsearch",
    # Cloud
    r"^aws$": "AWS",
    r"^gcp$": "GCP",
    r"^azure$": "Azure",
    r"^docker$": "Docker",
    r"^kubernetes$": "Kubernetes",
    # Languages
    r"^java(?:script)?$": "JavaScript",
    r"^type(?:script)?$": "TypeScript",
    r"^c#$": "C#",
    r"^c\+\+$": "C++",
    r"^golang|go$": "Go",
    r"^rust$": "Rust",
    # Tools
    r"^git$": "Git",
    r"^docker$": "Docker",
    r"^jenkins$": "Jenkins",
    r"^github$": "GitHub",
    r"^gitlab$": "GitLab",
}


def normalize_term(term: str) -> str:
    """
    Normalize a skill/technology term to canonical form
    """
    if not term or not isinstance(term, str):
        return None

    # Clean: lowercase, strip whitespace
    cleaned = term.strip().lower()

    if not cleaned:
        return None

    # Remove common punctuation variations
    cleaned = re.sub(r"[\s\-_\.]+", "", cleaned)

    # Check against normalization rules
    for pattern, canonical in NORMALIZATION_RULES.items():
        if re.match(pattern, cleaned):
            return canonical

    # If no rule matches, use title case with dots/hyphens preserved
    normalized = term.strip()
    parts = normalized.split(".")
    parts = [p.title() for p in parts]
    normalized = ".".join(parts)

    return normalized


# -----------------------------------------------------------------------------


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
        # very permissive fallback
        try:
            return (
                datetime.strptime(s, "%Y-%m-%dT%H:%M:%S.%fZ")
                .replace(tzinfo=timezone.utc)
                .isoformat()
            )
        except Exception:
            return datetime.now(timezone.utc).isoformat()


def scan_jobs():
    lek = None
    while True:
        kwargs = {
            "ProjectionExpression": "#pk,#sk,id,jobId,#st,processed_date,technologies,title,company",
            "ExpressionAttributeNames": {
                "#pk": "PK",
                "#sk": "SK",
                "#st": "status",  # <-- alias reserved word
            },
        }
        if lek:
            kwargs["ExclusiveStartKey"] = lek

        resp = jobs.scan(**kwargs)
        for it in resp.get("Items", []):
            yield it
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break


def build_puts(j):
    # derive jobId from id/jobId/PK
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
    # exact normalization flow used for your counts
    norm = set()
    for t in techs:
        canon = normalize_term(t)
        if canon:
            norm.add(canon)

    if not norm:
        return []

    puts = []
    for t in sorted(norm):
        sk = f"{status}#{processed}#{job_id}"
        item = {
            "PK": t,  # <-- table's partition key
            "SK": sk,  # <-- table's sort key
            "tech": t,  # optional convenience attr
            "jobId": job_id,  # used later to hydrate from Jobs table
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
    print(f"Backfilling from {JOBS_TABLE} → {INDEX_TABLE}")
    try:
        for j in scan_jobs():
            scanned += 1
            buf.extend(build_puts(j))
            if len(buf) >= 500:
                written += batch_write(buf)
                buf = []
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
