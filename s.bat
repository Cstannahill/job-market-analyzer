cat > statusadd.py << 'EOF'
#!/usr/bin/env python3
"""
Batch update all items in DynamoDB table to set status to 'Active'
Uses batch_write_item for efficient bulk updates
"""

import boto3
import time
from typing import List, Dict, Any

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('job-postings-enhanced')

def batch_update_items(table, batch_size: int = 25):
    """
    Scan all items and batch update them in groups of 25 (DynamoDB limit)
    """
    items_to_update = []
    processed_count = 0
    updated_count = 0
    
    try:
        # Scan all items
        response = table.scan()
        items = response['Items']
        
        print(f"Initial scan retrieved {len(items)} items")
        items_to_update.extend(items)
        
        # Handle pagination if result > 1MB
        while 'LastEvaluatedKey' in response:
            print("Paginating through results...")
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items_to_update.extend(response['Items'])
            print(f"Scan retrieved {len(response['Items'])} more items")
        
        print(f"\nTotal items to update: {len(items_to_update)}")
        
        # Batch write in groups of 25
        with table.batch_writer(overwrite_by_pkeys=['jobId']) as batch:
            for item in items_to_update:
                try:
                    # Add status field to item
                    item['status'] = 'Active'
                    batch.put_item(Item=item)
                    updated_count += 1
                    
                    # Progress indicator
                    if updated_count % 100 == 0:
                        print(f"✓ Updated {updated_count}/{len(items_to_update)} items")
                        
                except Exception as e:
                    print(f"✗ Error updating item {item.get('jobId')}: {str(e)}")
                    processed_count += 1
                    continue
                
                processed_count += 1
        
        print(f"\n✓ Successfully updated {updated_count} items")
        print(f"Total processed: {processed_count}")
        
    except Exception as e:
        print(f"✗ Error during batch update: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    print("=" * 50)
    print("DynamoDB Batch Update - Set Status to 'Active'")
    print("=" * 50)
    print(f"Table: JobPostings")
    print(f"Update: Add/set status = 'Active'\n")
    
    # Confirm before proceeding
    confirm = input("Proceed with update? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("Cancelled.")
        exit(0)
    
    start_time = time.time()
    success = batch_update_items(table, batch_size=25)
    elapsed = time.time() - start_time
    
    print(f"\nCompleted in {elapsed:.2f} seconds")
    
    if not success:
        exit(1)
EOF