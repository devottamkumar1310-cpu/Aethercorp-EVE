import os
import sys
import uuid
import datetime
import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

# Add parent directory to sys.path so app modules load correctly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.internal_analytics import InternalAnalyticsEvent
from app.models.executive_conversation import ExecutiveConversation, ExecutiveMessage
from app.models.recommendation_trace import RecommendationTrace
from app.models.document import ProcessedDocument

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("eve.migration")

# Namespace for deterministic UUID generation
MIGRATION_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def run_migration():
    """
    Ultra-fast, idempotent migration script.
    Uses single-pass set lookups and batch commits to prevent connection pool exhaustion.
    """
    db: Session = SessionLocal()

    report = {
        "users_migrated": 0,
        "users_updated": 0,
        "users_total_auth": 0,
        "organizations_total": 0,
        "events_created": 0,
        "events_skipped": 0,
        "event_breakdown": {},
        "skipped_records": [],
        "inconsistencies": []
    }

    try:
        logger.info("Starting Supabase historical data migration...")

        # ---------------------------------------------------------
        # PHASE 1: PROFILE MIGRATION
        # ---------------------------------------------------------
        logger.info("--- PHASE 1: Profile Migration ---")
        auth_users = db.execute(
            text("SELECT id, email, created_at, last_sign_in_at, raw_user_meta_data FROM auth.users")
        ).fetchall()
        report["users_total_auth"] = len(auth_users)
        logger.info(f"Found {len(auth_users)} users in auth.users.")

        # Single query to get all existing profile IDs and emails
        existing_profiles = {p.id: p for p in db.query(Profile).all()}

        profiles_to_add = []
        for u in auth_users:
            user_id = u[0]
            if isinstance(user_id, str):
                user_id = uuid.UUID(user_id)

            email = (u[1] or f"user_{str(user_id)[:8]}@example.com").strip().lower()
            created_at = u[2] or datetime.datetime.utcnow()
            if hasattr(created_at, "replace") and getattr(created_at, "tzinfo", None):
                created_at = created_at.replace(tzinfo=None)

            meta = u[4] or {}
            full_name = meta.get("full_name") or meta.get("name") or email.split("@")[0].replace(".", " ").title()

            if user_id not in existing_profiles:
                profiles_to_add.append(
                    Profile(
                        id=user_id,
                        email=email,
                        hashed_password="SUPABASE_AUTH_MANAGED",
                        full_name=full_name,
                        created_at=created_at,
                        is_active=True,
                        plan_type="starter"
                    )
                )
                report["users_migrated"] += 1
            else:
                ex = existing_profiles[user_id]
                updated = False
                if not ex.email:
                    ex.email = email
                    updated = True
                ex_created = ex.created_at.replace(tzinfo=None) if ex.created_at and hasattr(ex.created_at, "replace") else ex.created_at
                if ex_created and ex_created > created_at:
                    ex.created_at = created_at
                    updated = True
                if updated:
                    report["users_updated"] += 1

        if profiles_to_add:
            db.add_all(profiles_to_add)
        db.commit()
        logger.info(f"Phase 1 Complete: {report['users_migrated']} inserted, {report['users_updated']} updated.")

        # Organizations check
        org_count = db.query(Organization).count()
        report["organizations_total"] = org_count
        default_org = db.query(Organization).first()
        default_org_id = default_org.id if default_org else None

        # ---------------------------------------------------------
        # PHASE 2: TELEMETRY BACKFILL
        # ---------------------------------------------------------
        logger.info("--- PHASE 2: Telemetry Event Backfill ---")

        # Single query to get all existing internal analytics event IDs
        existing_event_ids = set(r[0] for r in db.query(InternalAnalyticsEvent.id).all())

        events_to_add = []

        # 2A. Signup & Login Events
        for u in auth_users:
            user_id = u[0]
            if isinstance(user_id, str):
                user_id = uuid.UUID(user_id)
            email = (u[1] or "").strip().lower()
            created_at = u[2] or datetime.datetime.utcnow()
            if hasattr(created_at, "replace") and getattr(created_at, "tzinfo", None):
                created_at = created_at.replace(tzinfo=None)

            sign_in_at = u[3]
            if sign_in_at and hasattr(sign_in_at, "replace") and getattr(sign_in_at, "tzinfo", None):
                sign_in_at = sign_in_at.replace(tzinfo=None)

            # Signup Event
            evt_id_signup = uuid.uuid5(MIGRATION_NAMESPACE, f"signup-{user_id}")
            if evt_id_signup not in existing_event_ids:
                events_to_add.append(
                    InternalAnalyticsEvent(
                        id=evt_id_signup,
                        event_type="signup",
                        user_id=user_id,
                        organization_id=default_org_id,
                        endpoint="/api/auth/signup",
                        status_code=200,
                        latency_ms=120.0,
                        metadata_json={"email": email, "source": "supabase_auth_migration"},
                        created_at=created_at
                    )
                )
                existing_event_ids.add(evt_id_signup)
                report["event_breakdown"]["signup"] = report["event_breakdown"].get("signup", 0) + 1
            else:
                report["events_skipped"] += 1

            # Login Event
            if sign_in_at:
                evt_id_login = uuid.uuid5(MIGRATION_NAMESPACE, f"login-{user_id}-{sign_in_at.isoformat()}")
                if evt_id_login not in existing_event_ids:
                    events_to_add.append(
                        InternalAnalyticsEvent(
                            id=evt_id_login,
                            event_type="login",
                            user_id=user_id,
                            organization_id=default_org_id,
                            endpoint="/api/auth/login",
                            status_code=200,
                            latency_ms=85.0,
                            metadata_json={"email": email, "source": "supabase_auth_migration"},
                            created_at=sign_in_at
                        )
                    )
                    existing_event_ids.add(evt_id_login)
                    report["event_breakdown"]["login"] = report["event_breakdown"].get("login", 0) + 1
                else:
                    report["events_skipped"] += 1

        # 2B. Executive Messages -> ai_query
        try:
            exec_msgs = db.query(ExecutiveMessage).filter(ExecutiveMessage.role == "user").all()
            for msg in exec_msgs:
                created_at = msg.created_at or datetime.datetime.utcnow()
                if hasattr(created_at, "replace") and getattr(created_at, "tzinfo", None):
                    created_at = created_at.replace(tzinfo=None)

                evt_id = uuid.uuid5(MIGRATION_NAMESPACE, f"exec_msg-{msg.id}")
                if evt_id not in existing_event_ids:
                    events_to_add.append(
                        InternalAnalyticsEvent(
                            id=evt_id,
                            event_type="ai_query",
                            user_id=None,
                            organization_id=default_org_id,
                            endpoint="/api/executive/chat",
                            status_code=200,
                            latency_ms=850.0,
                            metadata_json={
                                "conversation_id": str(msg.conversation_id),
                                "content_preview": (msg.content or "")[:50],
                                "source": "historical_executive_message"
                            },
                            created_at=created_at
                        )
                    )
                    existing_event_ids.add(evt_id)
                    report["event_breakdown"]["ai_query"] = report["event_breakdown"].get("ai_query", 0) + 1
                else:
                    report["events_skipped"] += 1
        except Exception as e:
            logger.error(f"Error reading executive messages: {e}")
            report["inconsistencies"].append(f"Executive messages: {e}")

        # 2C. Recommendation Traces -> recommendation_generated
        try:
            traces = db.query(RecommendationTrace).all()
            for tr in traces:
                created_at = tr.created_at or datetime.datetime.utcnow()
                if hasattr(created_at, "replace") and getattr(created_at, "tzinfo", None):
                    created_at = created_at.replace(tzinfo=None)

                evt_id = uuid.uuid5(MIGRATION_NAMESPACE, f"rec_trace-{tr.id}")
                if evt_id not in existing_event_ids:
                    events_to_add.append(
                        InternalAnalyticsEvent(
                            id=evt_id,
                            event_type="recommendation_generated",
                            user_id=tr.triggered_by_user_id,
                            organization_id=tr.organization_id or default_org_id,
                            endpoint="/api/intelligence/recommendations",
                            status_code=200,
                            latency_ms=420.0,
                            metadata_json={
                                "recommendation_type": tr.recommendation_type,
                                "status": tr.status,
                                "confidence_score": tr.confidence_score,
                                "source": "historical_recommendation_trace"
                            },
                            created_at=created_at
                        )
                    )
                    existing_event_ids.add(evt_id)
                    report["event_breakdown"]["recommendation_generated"] = report["event_breakdown"].get("recommendation_generated", 0) + 1
                else:
                    report["events_skipped"] += 1
        except Exception as e:
            logger.error(f"Error reading recommendation traces: {e}")
            report["inconsistencies"].append(f"Recommendation traces: {e}")

        # 2D. Processed Documents -> csv_upload
        try:
            docs = db.query(ProcessedDocument).all()
            for doc in docs:
                created_at = doc.created_at or datetime.datetime.utcnow()
                if hasattr(created_at, "replace") and getattr(created_at, "tzinfo", None):
                    created_at = created_at.replace(tzinfo=None)

                evt_id = uuid.uuid5(MIGRATION_NAMESPACE, f"doc-{doc.id}")
                if evt_id not in existing_event_ids:
                    events_to_add.append(
                        InternalAnalyticsEvent(
                            id=evt_id,
                            event_type="csv_upload",
                            user_id=None,
                            organization_id=doc.organization_id or default_org_id,
                            endpoint="/api/documents/upload",
                            status_code=200,
                            latency_ms=1150.0,
                            metadata_json={
                                "filename": doc.filename,
                                "file_size": doc.file_size,
                                "status": doc.status,
                                "source": "historical_processed_document"
                            },
                            created_at=created_at
                        )
                    )
                    existing_event_ids.add(evt_id)
                    report["event_breakdown"]["csv_upload"] = report["event_breakdown"].get("csv_upload", 0) + 1
                else:
                    report["events_skipped"] += 1
        except Exception as e:
            logger.error(f"Error reading processed documents: {e}")
            report["inconsistencies"].append(f"Processed documents: {e}")

        # Single batch insert for all new events
        if events_to_add:
            logger.info(f"Inserting batch of {len(events_to_add)} new historical events...")
            db.add_all(events_to_add)

        db.commit()

        report["events_created"] = len(events_to_add)

        # Final Verification
        total_profiles = db.query(Profile).count()
        total_events = db.query(InternalAnalyticsEvent).count()
        logger.info(f"--- MIGRATION VERIFICATION COMPLETE ---")
        logger.info(f"Total Profiles in public.profiles: {total_profiles}")
        logger.info(f"Total Internal Analytics Events: {total_events}")

        return report

    except Exception as e:
        logger.error(f"Migration error: {e}", exc_info=e)
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    report = run_migration()
    print("\n================ MIGRATION REPORT ================")
    print(f"Users Total in Auth:        {report['users_total_auth']}")
    print(f"Users Newly Migrated:       {report['users_migrated']}")
    print(f"Users Existing Updated:     {report['users_updated']}")
    print(f"Organizations Total:        {report['organizations_total']}")
    print(f"Historical Events Created:  {report['events_created']}")
    print(f"Historical Events Skipped:  {report['events_skipped']}")
    print(f"Event Breakdown:            {report['event_breakdown']}")
    print(f"Inconsistencies Encountered:{report['inconsistencies']}")
    print("==================================================")
