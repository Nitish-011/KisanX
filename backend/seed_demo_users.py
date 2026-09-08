from app.services.supabase_service import get_server_supabase

def seed_demo_users():
    supabase = get_server_supabase()

    demo_accounts = [
        {
            "email": "farmer@kisanx.com",
            "password": "Password123!",
            "role": "FARMER",
            "full_name": "Rameshwar Patil (Farmer)",
        },
        {
            "email": "buyer@kisanx.com",
            "password": "Password123!",
            "role": "BUYER",
            "full_name": "Vidarbha Agro Mills (Buyer)",
        },
        {
            "email": "officer@kisanx.com",
            "password": "Password123!",
            "role": "OFFICER",
            "full_name": "Dr. S. K. Joshi (FSSAI Officer)",
        },
    ]

    print("Checking existing Supabase users...")
    users = supabase.auth.admin.list_users()

    for acc in demo_accounts:
        email = acc["email"]
        role = acc["role"]
        name = acc["full_name"]
        pwd = acc["password"]

        existing = next((u for u in users if u.email == email), None)
        uid = None

        if existing:
            print(f"[{role}] {email} already exists (ID: {existing.id}), updating...")
            try:
                supabase.auth.admin.update_user_by_id(
                    existing.id,
                    {
                        "password": pwd,
                        "email_confirm": True,
                        "user_metadata": {"full_name": name, "role": role},
                    },
                )
                uid = existing.id
            except Exception as ex:
                print(f"Update warning: {ex}")
                uid = existing.id
        else:
            print(f"[{role}] Creating {email}...")
            try:
                res = supabase.auth.admin.create_user(
                    {
                        "email": email,
                        "password": pwd,
                        "email_confirm": True,
                        "user_metadata": {"full_name": name, "role": role},
                    }
                )
                uid = res.user.id
                print(f"Created {email} successfully: {uid}")
            except Exception as ex:
                print(f"Creation failed for {email}: {ex}")

        if uid:
            try:
                supabase.table("profiles").upsert(
                    {
                        "id": uid,
                        "full_name": name,
                        "role": role,
                    }
                ).execute()
                print(f"Profile upserted for {name} ({role})")
            except Exception as pe:
                print(f"Profile upsert warning: {pe}")

    print("\n--- Demo Users Provisioning Complete ---")

if __name__ == "__main__":
    seed_demo_users()
