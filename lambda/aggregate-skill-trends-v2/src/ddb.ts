// lambdas/aggregate-skill-trends-v2/ddb.ts
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

export async function batchWriteAll(
  doc: DynamoDBDocumentClient,
  table: string,
  items: any[]
) {
  const CHUNK = 25;
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    let req = {
      RequestItems: {
        [table]: slice.map((Item) => ({ PutRequest: { Item } })),
      },
    };
    // retry on Unprocessed
    for (let attempts = 0; attempts < 5; attempts++) {
      const res = await doc.send(new BatchWriteCommand(req as any));
      const un = res.UnprocessedItems?.[table];
      if (!un || un.length === 0) break;
      await new Promise((r) => setTimeout(r, 200 * (attempts + 1)));
      req = { RequestItems: { [table]: un } } as any;
    }
  }
}
