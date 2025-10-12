cat > normalize.py << "EOF"
#!/usr/bin/env python3
"""
Normalize and migrate skills, technologies, benefits, and requirements
from job-postings-enhanced to normalized lookup tables and denormalized posting table
"""

from datetime import datetime, timedelta, timezone
import boto3
import re
from typing import Set, Dict, Tuple, List
from collections import defaultdict

dynamodb = boto3.resource("dynamodb")
source_table = dynamodb.Table("job-postings-enhanced")  # PK: jobId
tech_table = dynamodb.Table("job-postings-technologies")  # PK: Id, SK: Name
skills_table = dynamodb.Table("job-postings-skills")  # PK: Id, SK: Name
benefits_table = dynamodb.Table("job-postings-benefits")  # PK: Id, SK: Name
requirements_table = dynamodb.Table("job-postings-requirements")  # PK: Id, SK: Name
industries_table = dynamodb.Table("job-postings-industries")  # PK: Id, SK: Name
normalized_table = dynamodb.Table("job-postings-normalized")  # PK: Id

# Normalization rules mapping
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


def _parse_processed_date(val):
    """
    Parse a processed_date value into a timezone-aware datetime (UTC).
    Handles:
      - numeric epoch seconds (int/float)
      - ISO 8601 strings with or without 'Z' / offset
      - a few common strptime formats
    Returns datetime (tz-aware, UTC) or None on failure.
    """
    if not val:
        return None
    # epoch seconds
    if isinstance(val, (int, float)):
        try:
            return datetime.fromtimestamp(val, tz=timezone.utc)
        except Exception:
            return None

    s = str(val).strip()
    if not s:
        return None

    # Try fromisoformat (handles offsets but not trailing 'Z')
    try:
        if s.endswith("Z"):
            return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(
                timezone.utc
            )
        return datetime.fromisoformat(s).astimezone(timezone.utc)
    except Exception:
        pass

    # Try a few common formats
    formats = (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    )
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue

    return None


def normalize_industry(industry: str) -> List[str]:
    """
    Normalize an industry string and split on separators (&, /, and)
    Returns list of individual industries, each title-cased

    Examples:
    "Transportation and Logistics" -> ["Transportation", "Logistics"]
    "technology/transportation" -> ["Technology", "Transportation"]
    "Finance & Insurance" -> ["Finance", "Insurance"]
    """
    if not industry or not isinstance(industry, str):
        return []

    # Split on &, /, and "and" (case-insensitive)
    # Replace separators with a consistent delimiter
    normalized = re.sub(r"\s+and\s+", "|", industry, flags=re.IGNORECASE)
    normalized = re.sub(r"\s*/\s*", "|", normalized)
    normalized = re.sub(r"\s*&\s*", "|", normalized)

    # Split on the delimiter and clean
    industries = [ind.strip().title() for ind in normalized.split("|")]

    # Filter out empty strings and return unique industries
    industries = [ind for ind in industries if ind]

    return list(set(industries))


def get_id_from_name(name: str) -> str:
    """
    Generate ID from name
    """
    return name.lower().replace(" ", "-").replace(".", "")


def normalize_and_collect(items_list: List[str]) -> Tuple[List[str], Dict]:
    """
    Normalize a list of items and return normalized list + index map
    Returns: (normalized_list, index_dict)
    """
    if not items_list or not isinstance(items_list, list):
        return [], {}

    normalized = {}
    for item in items_list:
        if not item:
            continue
        canonical = normalize_term(item)
        if canonical:
            normalized[canonical] = {
                "Id": get_id_from_name(canonical),
                "name": canonical,
                "count": 0,
            }

    return list(normalized.keys()), normalized


def migrate_postings():
    """
    Scan job-postings-enhanced and migrate to normalized tables
    """
    print("=" * 60)
    print("Starting migration: job-postings-enhanced → normalized tables")
    print("=" * 60)

    tech_index = {}
    skill_index = {}
    benefits_index = {}
    requirements_index = {}
    industries_index = {}

    postings_processed = 0
    items_to_normalize = []
    skipped_normalized = 0

    try:
        # Scan source table
        response = source_table.scan()
        items = response["Items"]

        print(f"\nInitial scan retrieved {len(items)} items")
        items_to_normalize.extend(items)

        # Handle pagination
        while "LastEvaluatedKey" in response:
            print(f"Paginating through results...")
            response = source_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items_to_normalize.extend(response["Items"])
            print(f"Retrieved {len(response['Items'])} more items")

        print(f"Total items to process: {len(items_to_normalize)}\n")

        # Process each posting
        for posting in items_to_normalize:
            # Skip if already normalized
            # if posting.get("normalized") == True:
            #     skipped_normalized += 1
            #     continue

            postings_processed += 1
            posting_id = posting.get("Id") or posting.get("jobId")

            # Process technologies
            if "technologies" in posting and posting["technologies"]:
                normalized_techs, tech_data = normalize_and_collect(
                    posting["technologies"]
                )
                posting["technologies"] = normalized_techs if normalized_techs else None

                for tech, data in tech_data.items():
                    if tech not in tech_index:
                        tech_index[tech] = data
                    tech_index[tech]["count"] += 1
            else:
                posting.pop("technologies", None)

            # Process skills
            if "skills" in posting and posting["skills"]:
                normalized_skills, skill_data = normalize_and_collect(posting["skills"])
                posting["skills"] = normalized_skills if normalized_skills else None

                for skill, data in skill_data.items():
                    if skill not in skill_index:
                        skill_index[skill] = data
                    skill_index[skill]["count"] += 1
            else:
                posting.pop("skills", None)

            # Process benefits
            if "benefits" in posting and posting["benefits"]:
                normalized_benefits, benefits_data = normalize_and_collect(
                    posting["benefits"]
                )
                posting["benefits"] = (
                    normalized_benefits if normalized_benefits else None
                )

                for benefit, data in benefits_data.items():
                    if benefit not in benefits_index:
                        benefits_index[benefit] = data
                    benefits_index[benefit]["count"] += 1
            else:
                posting.pop("benefits", None)

            # Process requirements
            if "requirements" in posting and posting["requirements"]:
                normalized_requirements, requirements_data = normalize_and_collect(
                    posting["requirements"]
                )
                posting["requirements"] = (
                    normalized_requirements if normalized_requirements else None
                )

                for requirement, data in requirements_data.items():
                    if requirement not in requirements_index:
                        requirements_index[requirement] = data
                    requirements_index[requirement]["count"] += 1
            else:
                posting.pop("requirements", None)

            # Process industry (can have multiple industries from one field)
            if "industry" in posting and posting["industry"]:
                industries_list = normalize_industry(posting["industry"])
                if industries_list:
                    posting["industry"] = industries_list

                    for industry in industries_list:
                        if industry not in industries_index:
                            industries_index[industry] = {
                                "Id": get_id_from_name(industry),
                                "name": industry,
                                "count": 0,
                            }
                        industries_index[industry]["count"] += 1
                else:
                    posting.pop("industry", None)
            else:
                posting.pop("industry", None)

            if postings_processed % 100 == 0:
                print(f"✓ Processed {postings_processed} postings")

        print(
            f"\n✓ Processed {postings_processed} total postings (skipped {skipped_normalized} already normalized)"
        )
        print(f"✓ Found {len(tech_index)} unique technologies")
        print(f"✓ Found {len(skill_index)} unique skills")
        print(f"✓ Found {len(benefits_index)} unique benefits")
        print(f"✓ Found {len(requirements_index)} unique requirements")
        print(f"✓ Found {len(industries_index)} unique industries")

        # Write technology lookup table
        print("\nWriting technology lookup table...")
        with tech_table.batch_writer(overwrite_by_pkeys=["Id", "Name"]) as batch:
            for canonical, data in sorted(tech_index.items()):
                batch.put_item(
                    Item={
                        "Id": data["Id"],
                        "Name": data["name"],
                        "postingCount": data["count"],
                        "createdAt": str(
                            __import__("datetime").datetime.now().isoformat()
                        ),
                    }
                )
        print(f"✓ Wrote {len(tech_index)} technologies")

        # Write skills lookup table
        print("\nWriting skills lookup table...")
        with skills_table.batch_writer(overwrite_by_pkeys=["Id", "Name"]) as batch:
            for canonical, data in sorted(skill_index.items()):
                batch.put_item(
                    Item={
                        "Id": data["Id"],
                        "Name": data["name"],
                        "postingCount": data["count"],
                        "createdAt": str(
                            __import__("datetime").datetime.now().isoformat()
                        ),
                    }
                )
        print(f"✓ Wrote {len(skill_index)} skills")

        # Write benefits lookup table
        print("\nWriting benefits lookup table...")
        with benefits_table.batch_writer(overwrite_by_pkeys=["Id", "Name"]) as batch:
            for canonical, data in sorted(benefits_index.items()):
                batch.put_item(
                    Item={
                        "Id": data["Id"],
                        "Name": data["name"],
                        "postingCount": data["count"],
                        "createdAt": str(
                            __import__("datetime").datetime.now().isoformat()
                        ),
                    }
                )
        print(f"✓ Wrote {len(benefits_index)} benefits")

        # Write requirements lookup table
        print("\nWriting requirements lookup table...")
        with requirements_table.batch_writer(
            overwrite_by_pkeys=["Id", "Name"]
        ) as batch:
            for canonical, data in sorted(requirements_index.items()):
                batch.put_item(
                    Item={
                        "Id": data["Id"],
                        "Name": data["name"],
                        "postingCount": data["count"],
                        "createdAt": str(
                            __import__("datetime").datetime.now().isoformat()
                        ),
                    }
                )
        print(f"✓ Wrote {len(requirements_index)} requirements")

        # Write industries lookup table
        print("\nWriting industries lookup table...")
        with industries_table.batch_writer(overwrite_by_pkeys=["Id", "Name"]) as batch:
            for canonical, data in sorted(industries_index.items()):
                batch.put_item(
                    Item={
                        "Id": data["Id"],
                        "Name": data["name"],
                        "postingCount": data["count"],
                        "createdAt": str(
                            __import__("datetime").datetime.now().isoformat()
                        ),
                    }
                )
        print(f"✓ Wrote {len(industries_index)} industries")

        # Write normalized postings
        print("\nWriting normalized postings...")
        with normalized_table.batch_writer(overwrite_by_pkeys=["Id"]) as batch:
            normalized_count = 0
            for posting in items_to_normalize:
                # Skip if already normalized
                # if posting.get("normalized") == True:
                #     continue

                # Ensure Id field exists (copy from jobId if needed)
                if "Id" not in posting and "jobId" in posting:
                    posting["Id"] = posting["jobId"]
                if "comany_name" not in posting:
                    posting["company_name"] = "Unknown"
                if "remote_status" not in posting:
                    posting["remote_status"] = "Unknown"
                if "location" not in posting:
                    posting["location"] = "Unknown"
                if "company_size" not in posting:
                    posting["company_size"] = "Unknown"
                if "salary_mentioned" not in posting:
                    posting["salary_mentioned"] = False
                if "salary_range" not in posting:
                    posting["salary_range"] = "Unknown"
                if "seniority_level" not in posting:
                    posting["seniority_level"] = "Unknown"
                proc_dt = _parse_processed_date(posting.get("processed_date"))
                if "status" not in posting and proc_dt:
                    if datetime.now(timezone.utc) - proc_dt <= timedelta(days=30):
                        posting["status"] = "Active"
                # Mark as normalized
                NormalizedItem = {
                    "Id": posting["Id"],
                    "job_title": posting.get("job_title", "Unknown"),
                    "job_description": posting.get("job_description", ""),
                    "normalized": True,
                    "normalized_at": str(
                        __import__("datetime").datetime.now().isoformat()
                    ),
                    "processed_date": posting["processed_date"],
                    "company_name": posting["company_name"],
                    "company_size": posting["company_size"],
                    "location": posting["location"],
                    "remote_status": posting["remote_status"],
                    "salary_mentioned": posting["salary_mentioned"],
                    "salary_range": posting["salary_range"],
                    "seniority_level": posting["seniority_level"],
                    "status": posting["status"],
                }
                batch.put_item(Item=NormalizedItem)
                normalized_count += 1
        print(f"✓ Wrote {normalized_count} normalized postings")

        print("\n" + "=" * 60)
        print("✓ Migration complete!")
        print("=" * 60)
        print(f"\nSummary:")
        print(f"  • Postings processed: {postings_processed}")
        print(f"  • Unique technologies: {len(tech_index)}")
        print(f"  • Unique skills: {len(skill_index)}")
        print(f"  • Unique benefits: {len(benefits_index)}")
        print(f"  • Unique requirements: {len(requirements_index)}")
        print(f"  • Unique industries: {len(industries_index)}")

        return True

    except Exception as e:
        print(f"\n✗ Error during migration: {str(e)}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Technology, Skill, Benefit, Requirement & Industry Normalization Migration")
    print("=" * 60)

    confirm = (
        input("\nThis will normalize and migrate all 4 fields.\nProceed? (yes/no): ")
        .strip()
        .lower()
    )
    if confirm != "yes":
        print("Cancelled.")
        exit(0)

    success = migrate_postings()
    exit(0 if success else 1)
EOF
