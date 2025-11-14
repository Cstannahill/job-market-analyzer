```bash
curl -s https://openrouter.ai/api/v1/models | \
  jq '.data[] | select(.id | test("free"; "i")) | {id, context_length}'
```
