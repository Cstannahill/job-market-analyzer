# New ingestion flow (cheap + idempotent)

Fetch from adapters → canonicalize → compute:

postingHash (company|title|location|date)

descriptionSig (sha1 of first ~1.5k chars)

Check existence in Dynamo for those hashes (batch).

Split: existing vs newOrChanged (changed = same hash but different descriptionSig or better fields).

Upsert only newOrChanged into Dynamo (merge).

Archive to S3 only if ARCHIVE_POLICY demands it (e.g., new or changed).

## Shape

PK: JOB#{postingHash}

SK: POSTING#v1 (or POSTING#${provider} if you want per-source line items — optional)

Attributes:

company, title, location{city,region,country,raw}, postedDate

description, descriptionSig

sources: array of { source, originalUrl, fetchedAt }

provenance: { termsUrl, robotsOk }

any precomputed skill tokens if you do them here
