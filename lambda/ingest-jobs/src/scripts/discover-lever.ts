import "dotenv/config";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: tsx src/scripts/discover-lever.ts <slug>");
  process.exit(1);
}

const url = `https://api.lever.co/v0/postings/${slug}?limit=1&mode=json`;

fetch(url, { headers: { "user-agent": "JMA/1.0 (+contact)" } })
  .then(async (res) => {
    console.log({ status: res.status, ok: res.ok, url });
    if (res.ok) {
      const j = await res.json();
      console.log(
        "sample keys:",
        Array.isArray(j) && j[0] ? Object.keys(j[0]).slice(0, 8) : []
      );
    }
  })
  .catch((e) => console.error(e));
