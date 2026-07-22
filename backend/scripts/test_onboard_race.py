"""Concurrency proof for hardened demo onboarding.

Fires two SIMULTANEOUS provisioning attempts (separate DB sessions, released at a
common barrier) for one fresh test user, mirroring the endpoint's critical section:
  INSERT org  ON CONFLICT (slug) DO NOTHING RETURNING id
  INSERT membership ON CONFLICT (organization_id, user_id) DO NOTHING

Asserts: 1 org, 1 membership, both threads resolve to the same org, exactly one
thread "created" it (would seed). Cleans up the test fixture afterward.
"""
import sys, os, uuid, threading
sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.database import SessionLocal
from app.models.profile import Profile
from app.models.organization import Organization, Membership

TEST_EMAIL = "race-test-fixture@example.invalid"
NAME, SLUG_BASE, DEMO = "Luma & Co.", "luma-and-co", "luma"

def provision(user_id, slug, barrier, results, idx):
    db = SessionLocal()
    try:
        barrier.wait()  # release both threads together
        insert_org = (
            pg_insert(Organization.__table__)
            .values(id=uuid.uuid4(), name=NAME, slug=slug)
            .on_conflict_do_nothing(index_elements=["slug"])
            .returning(Organization.__table__.c.id)
        )
        inserted_id = db.execute(insert_org).scalar()
        db.commit()
        created_here = inserted_id is not None

        org = db.query(Organization).filter(Organization.slug == slug).first()
        insert_m = (
            pg_insert(Membership.__table__)
            .values(id=uuid.uuid4(), organization_id=org.id, user_id=user_id, role="owner")
            .on_conflict_do_nothing(index_elements=["organization_id", "user_id"])
        )
        db.execute(insert_m)
        db.commit()
        results[idx] = {"created_here": created_here, "org_id": str(org.id)}
    except Exception as e:
        results[idx] = {"error": str(e)}
    finally:
        db.close()

def main():
    setup = SessionLocal()
    user_id = uuid.uuid4()
    try:
        setup.add(Profile(id=user_id, email=TEST_EMAIL, hashed_password="x", full_name="Race Test", is_active=True))
        setup.commit()
    except Exception as e:
        print(f"✗ setup failed: {e}"); setup.rollback(); setup.close(); return
    finally:
        setup.close()

    slug = f"{SLUG_BASE}-{user_id.hex[:12]}"
    barrier = threading.Barrier(2)
    results = [None, None]
    t1 = threading.Thread(target=provision, args=(user_id, slug, barrier, results, 0))
    t2 = threading.Thread(target=provision, args=(user_id, slug, barrier, results, 1))
    t1.start(); t2.start(); t1.join(); t2.join()

    print(f"Thread results: {results}")

    verify = SessionLocal()
    ok = True
    try:
        org_count = verify.query(Organization).filter(Organization.slug == slug).count()
        name_count = (
            verify.query(Organization)
            .join(Membership, Membership.organization_id == Organization.id)
            .filter(Membership.user_id == user_id, Organization.name == NAME)
            .count()
        )
        orgs = verify.query(Organization).filter(Organization.slug == slug).all()
        org_ids = [str(o.id) for o in orgs]
        mem_count = 0
        if orgs:
            mem_count = verify.query(Membership).filter(
                Membership.organization_id == orgs[0].id, Membership.user_id == user_id
            ).count()
        created_flags = [r.get("created_here") for r in results if r and "created_here" in r]
        resolved_ids = {r.get("org_id") for r in results if r and "org_id" in r}

        print("\n=== ASSERTIONS ===")
        def check(label, cond):
            nonlocal ok
            ok = ok and cond
            print(f"  {'✓' if cond else '✗'} {label}")
        check(f"exactly 1 org with slug (got {org_count})", org_count == 1)
        check(f"exactly 1 org by (owner,name) (got {name_count})", name_count == 1)
        check(f"exactly 1 membership (got {mem_count})", mem_count == 1)
        check(f"both threads resolved to same org (got {resolved_ids})", len(resolved_ids) == 1)
        check(f"exactly one thread created it (created flags {created_flags})", created_flags.count(True) == 1)

        # Idempotent re-run: a third sequential attempt must not create a new org.
        insert_org = (
            pg_insert(Organization.__table__)
            .values(id=uuid.uuid4(), name=NAME, slug=slug)
            .on_conflict_do_nothing(index_elements=["slug"])
            .returning(Organization.__table__.c.id)
        )
        third = verify.execute(insert_org).scalar()
        verify.commit()
        check("3rd sequential attempt creates nothing (idempotent)", third is None)

        print(f"\nRESULT: {'✅ PASS — race is DB-safe' if ok else '❌ FAIL'}")
    finally:
        # Cleanup: delete test org (cascades membership) + test profile fixture.
        for o in verify.query(Organization).filter(Organization.slug == slug).all():
            verify.delete(o)
        verify.commit()
        p = verify.query(Profile).filter(Profile.id == user_id).first()
        if p:
            verify.delete(p); verify.commit()
        print("✓ Test fixtures cleaned up (org + profile removed).")
        verify.close()

if __name__ == "__main__":
    main()
