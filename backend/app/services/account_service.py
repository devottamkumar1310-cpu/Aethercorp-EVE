import logging
import uuid
from sqlalchemy.orm import Session
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.document import ProcessedDocument
from app.services.gcs_service import GCSService
from app.config import settings

logger = logging.getLogger("eve.services.account")


class AccountService:
    """
    Handles account lifecycle operations: workspace deletion, account deletion,
    and orphaned profile cleanup.
    """

    @staticmethod
    def delete_workspace(db: Session, organization_id: uuid.UUID, user_profile: Profile) -> bool:
        """
        Deletes a workspace (organization) and all associated data.
        Only the workspace owner can perform this action.
        """
        import time
        t_start = time.perf_counter()
        logger.info(f"[TIMING] delete_workspace() started for workspace {organization_id}")
        
        # Verify ownership
        membership = db.query(Membership).filter(
            Membership.user_id == user_profile.id,
            Membership.organization_id == organization_id,
            Membership.role == "owner"
        ).first()

        if not membership:
            logger.warning(f"[TIMING] delete_workspace() failed: user {user_profile.id} is not owner")
            return False

        # Clean up storage files for all documents in this workspace
        t_doc = time.perf_counter()
        documents = db.query(ProcessedDocument).filter(
            ProcessedDocument.organization_id == organization_id
        ).all()
        logger.info(f"[TIMING] Document query took {(time.perf_counter() - t_doc) * 1000:.2f} ms. Found {len(documents)} documents.")
        
        for doc in documents:
            if doc.file_path:
                t_gcs = time.perf_counter()
                try:
                    logger.info(f"[TIMING] Starting GCS deletion for {doc.file_path}")
                    GCSService.delete_file(doc.file_path)
                    logger.info(f"[TIMING] Finished GCS deletion for {doc.file_path} in {(time.perf_counter() - t_gcs) * 1000:.2f} ms")
                except Exception as e:
                    logger.warning(f"Failed to delete file {doc.file_path}: {e}")

        # Delete the organization
        t_org = time.perf_counter()
        org = db.query(Organization).filter(Organization.id == organization_id).first()
        if org:
            logger.info(f"[TIMING] Queueing organization deletion in SQLAlchemy...")
            db.delete(org)
            logger.info(f"[TIMING] Finished queueing organization deletion in {(time.perf_counter() - t_org) * 1000:.2f} ms")
            
            t_commit = time.perf_counter()
            logger.info(f"[TIMING] Starting database commit for organization deletion...")
            db.commit()
            logger.info(f"[TIMING] Finished database commit for organization deletion in {(time.perf_counter() - t_commit) * 1000:.2f} ms")
            
            try:
                from app.core.cache import invalidate_workspace
                invalidate_workspace(str(organization_id))
            except Exception as ce:
                logger.warning(f"Failed to invalidate cache for workspace {organization_id}: {ce}")
            
            logger.info(f"[TIMING] delete_workspace() completed successfully in {(time.perf_counter() - t_start) * 1000:.2f} ms")
            return True

        return False

    @staticmethod
    def delete_account(db: Session, user_profile: Profile) -> bool:
        """
        Deletes a user account and all solely-owned workspaces.
        For workspaces with other owners, just removes the user's membership.
        """
        logger.info("[DELETE] Start")

        if not settings.SUPABASE_SERVICE_ROLE_KEY or not settings.SUPABASE_URL:
            logger.error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is not configured. Account deletion aborted to prevent orphaned auth records.")
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL is not configured. Account deletion aborted to prevent orphaned auth records.")

        user_id = user_profile.id

        logger.info("[DELETE] Loading profile")
        db.refresh(user_profile)
        logger.info("[DELETE] Loading profile complete")

        # Step 3: Avatar deletion
        logger.info("[DELETE] Avatar cleanup")
        if user_profile.avatar_url:
            try:
                logger.info(f"Purging user avatar file: {user_profile.avatar_url}")
                GCSService.delete_file(user_profile.avatar_url)
            except Exception as e:
                logger.warning(f"Failed to delete user avatar file {user_profile.avatar_url}: {e}")
        logger.info("[DELETE] Avatar cleanup complete")

        # Step 2: Workspace lookup
        memberships = db.query(Membership).filter(Membership.user_id == user_id).all()
        logger.info(f"Found {len(memberships)} memberships to process.")

        deleted_org_ids = []

        logger.info("[DELETE] Membership cleanup")
        logger.info("[DELETE] Workspace deletion")
        for membership in memberships:
            org_id = membership.organization_id

            owner_count = db.query(Membership).filter(
                Membership.organization_id == org_id,
                Membership.role == "owner"
            ).count()

            if owner_count <= 1:
                # User is sole owner — delete GCS documents first
                documents = db.query(ProcessedDocument).filter(
                    ProcessedDocument.organization_id == org_id
                ).all()
                for doc in documents:
                    if doc.file_path:
                        try:
                            logger.info(f"Starting GCS deletion for {doc.file_path}")
                            GCSService.delete_file(doc.file_path)
                        except Exception as e:
                            logger.warning(f"Failed to delete file {doc.file_path}: {e}")

                # Delete Organization
                org = db.query(Organization).filter(Organization.id == org_id).first()
                if org:
                    db.delete(org)
                    deleted_org_ids.append(org_id)
            else:
                db.delete(membership)

        logger.info("[DELETE] Membership cleanup complete")
        logger.info("[DELETE] Workspace deletion complete")

        # Step 8: Supabase Admin deletion
        logger.info("[DELETE] Supabase admin delete")
        if settings.SUPABASE_SERVICE_ROLE_KEY and settings.SUPABASE_URL:
            import httpx
            try:
                logger.info(f"Triggering Supabase Auth deletion for user {user_id}")
                url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
                headers = {
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
                }
                with httpx.Client(timeout=5.0) as client:
                    resp = client.delete(url, headers=headers)
                    if resp.status_code not in (200, 204):
                        logger.error(f"Failed to delete Supabase user: status={resp.status_code} response={resp.text}")
                    else:
                        logger.info(f"Supabase Auth user {user_id} deleted successfully.")
            except Exception as e:
                logger.error(f"Error calling Supabase user delete API: {e}", exc_info=True)
        else:
            logger.warning("SUPABASE_SERVICE_ROLE_KEY not configured. Skipping Supabase Auth user deletion.")
        logger.info("[DELETE] Supabase admin delete complete")

        # Step 7: Profile deletion
        logger.info("[DELETE] Profile deletion")
        db.delete(user_profile)
        logger.info("[DELETE] Profile deletion complete")

        # Step 9: Commit transaction
        logger.info("[DELETE] Commit")
        db.commit()
        logger.info("[DELETE] Commit complete")

        # Invalidate caches
        from app.core.cache import invalidate_workspace
        for oid in deleted_org_ids:
            try:
                invalidate_workspace(str(oid))
            except Exception as ce:
                logger.warning(f"Failed to invalidate cache for workspace {oid}: {ce}")

        return True

    @staticmethod
    def purge_orphaned_profile(db: Session, email: str) -> None:
        """
        Purges an orphaned profile and all its owned data.
        Used when a new user registers with the same email as an orphaned profile.
        """
        existing = db.query(Profile).filter(Profile.email == email).first()
        if not existing:
            return

        logger.info(f"Purging orphaned profile {existing.id} for email {email}")

        # Delete user avatar file from GCS / local storage
        if existing.avatar_url:
            try:
                logger.info(f"Purging orphaned user avatar file: {existing.avatar_url}")
                GCSService.delete_file(existing.avatar_url)
            except Exception as e:
                logger.warning(f"Failed to delete orphaned user avatar file {existing.avatar_url}: {e}")

        # Find and delete all solely-owned workspaces
        memberships = db.query(Membership).filter(Membership.user_id == existing.id).all()
        for membership in memberships:
            org_id = membership.organization_id
            owner_count = db.query(Membership).filter(
                Membership.organization_id == org_id,
                Membership.role == "owner"
            ).count()

            if owner_count <= 1:
                # Clean up GCS files
                documents = db.query(ProcessedDocument).filter(
                    ProcessedDocument.organization_id == org_id
                ).all()
                for doc in documents:
                    if doc.file_path:
                        try:
                            GCSService.delete_file(doc.file_path)
                        except Exception as e:
                            logger.warning(f"Failed to delete file {doc.file_path}: {e}")

                org = db.query(Organization).filter(Organization.id == org_id).first()
                if org:
                    db.delete(org)
            else:
                db.delete(membership)

        # Delete user from Supabase auth if service role key is present
        if settings.SUPABASE_SERVICE_ROLE_KEY and settings.SUPABASE_URL:
            import httpx
            try:
                logger.info(f"Triggering Supabase Auth deletion for orphaned user {existing.id}")
                url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{existing.id}"
                headers = {
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
                }
                with httpx.Client() as client:
                    resp = client.delete(url, headers=headers)
                    if resp.status_code not in (200, 204):
                        logger.error(f"Failed to delete Supabase user: status={resp.status_code} response={resp.text}")
                    else:
                        logger.info(f"Supabase Auth user {existing.id} deleted successfully.")
            except Exception as e:
                logger.error(f"Error calling Supabase user delete API: {e}", exc_info=True)

        # Delete the orphaned profile
        db.delete(existing)
        db.flush()
        logger.info(f"Orphaned profile {existing.id} purged successfully")
