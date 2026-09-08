from app.main import app

def check():
    schema = app.openapi()
    paths = schema.get("paths", {})
    print(f"\nTotal unique URL paths registered: {len(paths)}")
    
    all_ops = []
    seen = {}
    conflicts = []

    for path, methods in sorted(paths.items()):
        for method, details in methods.items():
            m = method.upper()
            if m in ("GET", "POST", "PUT", "PATCH", "DELETE"):
                tags = details.get("tags", [])
                tag_str = tags[0] if tags else "None"
                op_id = details.get("operationId", "")
                all_ops.append((m, path, tag_str, op_id))
                
                key = (m, path)
                if key in seen:
                    conflicts.append((m, path, seen[key], op_id))
                else:
                    seen[key] = op_id

    print(f"Total API operations: {len(all_ops)}")
    print("\n--- DETAILED ENDPOINTS BY PREFIX / ROUTE ---")
    for m, p, tag, op in all_ops:
        print(f"  {m:6s} {p:46s} [{tag:16s}] -> {op}")

    print("\n--- CONFLICT AUDIT RESULT ---")
    if conflicts:
        print(f"FAILED: Found {len(conflicts)} duplicate endpoint(s):")
        for m, p, first_op, second_op in conflicts:
            print(f"  CONFLICT: {m} {p} (Defined in {first_op} AND {second_op})")
    else:
        print("SUCCESS: 0 overlapping endpoints found across all routers.")

if __name__ == "__main__":
    check()
