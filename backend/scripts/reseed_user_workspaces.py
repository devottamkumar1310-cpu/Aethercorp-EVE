"""
Re-seed the demo workspaces for a specific user with the new Luma/Drift/Basecamp scenarios.
This replaces old NovaWear/Urban Threads/Essentials Co. data with the new catalog.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.commands.seed_scenarios import seed_demo_workspace_data

USER_EMAIL = "devottamkumar1310@gmail.com"

SCENARIO_MAP = [
    ("luma",     "luma",     "Luma & Co.",       "luma-and-co"),
    ("drift",    "drift",    "Drift Collective",  "drift-collective"),
    ("basecamp", "basecamp", "Basecamp Basics",   "basecamp-basics"),
]

def main():
    db = SessionLocal()
    try:
        # Find the user
        profile = db.query(Profile).filter(Profile.email == USER_EMAIL).first()
        if not profile:
            print(f"✗ User not found: {USER_EMAIL}")
            return
        print(f"✓ Found user: {profile.full_name} ({profile.email}) id={profile.id}")

        # Get all orgs this user is a member of
        memberships = db.query(Membership).filter(Membership.user_id == profile.id).all()
        orgs = []
        for m in memberships:
            org = db.query(Organization).filter(Organization.id == m.organization_id).first()
            if org:
                orgs.append(org)
        print(f"  User has {len(orgs)} workspace(s): {[o.slug for o in orgs]}")

        # Match each old workspace to a new scenario
        for slug_pattern, scenario, new_name, new_slug in SCENARIO_MAP:
            matched = next((o for o in orgs if slug_pattern in (o.slug or "").lower()), None)
            if not matched:
                # Try matching by name
                matched = next((o for o in orgs if slug_pattern in (o.name or "").lower()), None)
            if not matched:
                print(f"  ⚠ No match for pattern '{slug_pattern}' — skipping")
                continue

            print(f"\n  Re-seeding: {matched.name} ({matched.id}) → {new_name} [{scenario}]")

            # Rename the org
            matched.name = new_name
            matched.slug = new_slug
            db.flush()

            # Re-seed with new scenario (deletes old data first)
            seed_demo_workspace_data(db, matched.id, scenario)

            print(f"  ✓ Done: {new_name}")

        print("\n✓ All workspaces re-seeded successfully.")

    except Exception as e:
        print(f"\n✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
