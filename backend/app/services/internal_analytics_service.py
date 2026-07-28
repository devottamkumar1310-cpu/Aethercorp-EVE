import datetime
import logging
import uuid
import psutil
import os
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.internal_analytics import InternalAnalyticsEvent
from app.services.gcs_service import GCSService

logger = logging.getLogger("eve.services.internal_analytics")


class InternalAnalyticsService:
    """
    Service layer for calculating platform-wide analytics exclusively for the Owner/Admin dashboard.
    Query logic is read-only and strictly isolated.
    """

    @staticmethod
    def log_event(
        db: Session,
        event_type: str,
        user_id: Optional[uuid.UUID] = None,
        organization_id: Optional[uuid.UUID] = None,
        endpoint: Optional[str] = None,
        status_code: int = 200,
        latency_ms: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Idempotently logs an analytics event to internal_analytics_events table.
        Fails silently to avoid impacting main workflow.
        """
        try:
            evt = InternalAnalyticsEvent(
                event_type=event_type,
                user_id=user_id,
                organization_id=organization_id,
                endpoint=endpoint,
                status_code=status_code,
                latency_ms=latency_ms,
                metadata_json=metadata or {}
            )
            db.add(evt)
            db.commit()
        except Exception as e:
            logger.warn(f"Failed to log internal analytics event: {e}")
            db.rollback()

    @staticmethod
    def get_overview_metrics(db: Session) -> Dict[str, Any]:
        """
        Returns high-level platform growth and usage KPIs.
        """
        now = datetime.datetime.utcnow()
        day_ago = now - datetime.timedelta(days=1)
        week_ago = now - datetime.timedelta(days=7)
        month_ago = now - datetime.timedelta(days=30)

        total_users = db.query(func.count(Profile.id)).scalar() or 0
        new_users_24h = db.query(func.count(Profile.id)).filter(Profile.created_at >= day_ago).scalar() or 0
        new_users_7d = db.query(func.count(Profile.id)).filter(Profile.created_at >= week_ago).scalar() or 0
        new_users_30d = db.query(func.count(Profile.id)).filter(Profile.created_at >= month_ago).scalar() or 0

        total_organizations = db.query(func.count(Organization.id)).scalar() or 0
        total_memberships = db.query(func.count(Membership.id)).scalar() or 0

        # Demo vs Custom workspaces
        demo_workspaces = db.query(func.count(Organization.id)).filter(
            (Organization.slug.like("luma%")) | 
            (Organization.slug.like("drift%")) | 
            (Organization.slug.like("basecamp%"))
        ).scalar() or 0
        custom_workspaces = max(0, total_organizations - demo_workspaces)

        # Plan type distribution
        plans_raw = db.query(Profile.plan_type, func.count(Profile.id)).group_by(Profile.plan_type).all()
        plan_distribution = {plan or "starter": count for plan, count in plans_raw}

        # Event counts
        total_events = db.query(func.count(InternalAnalyticsEvent.id)).scalar() or 0
        events_24h = db.query(func.count(InternalAnalyticsEvent.id)).filter(InternalAnalyticsEvent.created_at >= day_ago).scalar() or 0

        return {
            "total_users": total_users,
            "new_users_24h": new_users_24h,
            "new_users_7d": new_users_7d,
            "new_users_30d": new_users_30d,
            "total_organizations": total_organizations,
            "total_memberships": total_memberships,
            "demo_workspaces": demo_workspaces,
            "custom_workspaces": custom_workspaces,
            "plan_distribution": plan_distribution,
            "total_events": total_events,
            "events_24h": events_24h,
            "calculated_at": now.isoformat()
        }

    @staticmethod
    def get_user_analytics(db: Session, limit: int = 50) -> Dict[str, Any]:
        """
        Returns detailed user registration list and activity breakdown.
        """
        users = db.query(Profile).order_by(Profile.created_at.desc()).limit(limit).all()

        user_list = []
        for u in users:
            org_count = db.query(func.count(Membership.id)).filter(Membership.user_id == u.id).scalar() or 0
            user_list.append({
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "is_active": u.is_active,
                "subscription_status": u.subscription_status,
                "plan_type": u.plan_type,
                "organizations_count": org_count
            })

        # Signup trend by day for past 14 days
        now = datetime.datetime.utcnow()
        signup_trend = []
        for i in range(13, -1, -1):
            date_start = (now - datetime.timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            date_end = date_start + datetime.timedelta(days=1)
            cnt = db.query(func.count(Profile.id)).filter(
                Profile.created_at >= date_start,
                Profile.created_at < date_end
            ).scalar() or 0
            signup_trend.append({
                "date": date_start.strftime("%b %d"),
                "count": cnt
            })

        return {
            "users": user_list,
            "signup_trend": signup_trend
        }

    @staticmethod
    def get_feature_usage(db: Session) -> Dict[str, Any]:
        """
        Calculates feature usage counts across domain modules.
        """
        # Event distribution by event_type
        event_types_raw = db.query(
            InternalAnalyticsEvent.event_type, 
            func.count(InternalAnalyticsEvent.id)
        ).group_by(InternalAnalyticsEvent.event_type).all()

        feature_counts = {evt_type: count for evt_type, count in event_types_raw}

        # Average latency per endpoint
        latency_raw = db.query(
            InternalAnalyticsEvent.endpoint,
            func.avg(InternalAnalyticsEvent.latency_ms),
            func.count(InternalAnalyticsEvent.id)
        ).group_by(InternalAnalyticsEvent.endpoint).order_by(func.count(InternalAnalyticsEvent.id).desc()).limit(10).all()

        endpoint_stats = [
            {
                "endpoint": ep or "unknown",
                "avg_latency_ms": round(float(avg_lat or 0), 2),
                "count": count
            }
            for ep, avg_lat, count in latency_raw
        ]

        return {
            "feature_counts": feature_counts,
            "top_endpoints": endpoint_stats
        }

    @staticmethod
    def get_platform_health(db: Session) -> Dict[str, Any]:
        """
        Returns system health metrics, storage status, and memory/CPU usage.
        """
        # Database ping
        db_status = "healthy"
        db_latency_ms = 0.0
        try:
            t0 = datetime.datetime.utcnow()
            db.execute(text("SELECT 1"))
            t1 = datetime.datetime.utcnow()
            db_latency_ms = round((t1 - t0).total_seconds() * 1000, 2)
        except Exception as e:
            db_status = f"unhealthy: {e}"

        # GCS Storage Status
        storage_status = "healthy"
        try:
            if GCSService.is_available():
                storage_status = "healthy (GCS Configured)"
            else:
                storage_status = "local_fallback"
        except Exception:
            storage_status = "degraded"

        # Hardware metrics
        try:
            cpu_percent = psutil.cpu_percent(interval=None)
            memory_info = psutil.virtual_memory()
            memory_percent = memory_info.percent
        except Exception:
            cpu_percent = 0.0
            memory_percent = 0.0

        # Recent error event count in past 24h
        day_ago = datetime.datetime.utcnow() - datetime.timedelta(days=1)
        error_count_24h = db.query(func.count(InternalAnalyticsEvent.id)).filter(
            InternalAnalyticsEvent.created_at >= day_ago,
            InternalAnalyticsEvent.status_code >= 400
        ).scalar() or 0

        return {
            "status": "operational" if db_status == "healthy" else "degraded",
            "database": {
                "status": db_status,
                "latency_ms": db_latency_ms
            },
            "storage": {
                "status": storage_status
            },
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory_percent
            },
            "error_count_24h": error_count_24h,
            "checked_at": datetime.datetime.utcnow().isoformat()
        }

    @staticmethod
    def get_recent_events(db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Returns recent internal analytics events for audit inspection.
        """
        events = db.query(InternalAnalyticsEvent).order_by(InternalAnalyticsEvent.created_at.desc()).limit(limit).all()
        return [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "user_id": str(e.user_id) if e.user_id else None,
                "organization_id": str(e.organization_id) if e.organization_id else None,
                "endpoint": e.endpoint,
                "status_code": e.status_code,
                "latency_ms": e.latency_ms,
                "metadata": e.metadata_json,
                "created_at": e.created_at.isoformat() if e.created_at else None
            }
            for e in events
        ]
