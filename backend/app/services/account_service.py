import logging
import uuid
from sqlalchemy.orm import Session
from app.models.profile import Profile
from app.models.organization import Organization, Membership
from app.models.document import ProcessedDocument
from app.services.gcs_service import GCSService

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
            
            logger.info(f"[TIMING] delete_workspace() completed successfully in {(time.perf_counter() - t_start) * 1000:.2f} ms")
            return True

        return False

    @staticmethod
    def delete_account(db: Session, user_profile: Profile) -> bool:
        """
        Deletes a user account and all solely-owned workspaces.
        For workspaces with other owners, just removes the user's membership.
        """
        import time
        t_start = time.perf_counter()
        user_id = user_profile.id
        logger.info(f"[TIMING] delete_account() started for user {user_id}")

        # Find all memberships
        t_memberships = time.perf_counter()
        memberships = db.query(Membership).filter(Membership.user_id == user_id).all()
        logger.info(f"[TIMING] Fetch memberships took {(time.perf_counter() - t_memberships) * 1000:.2f} ms. Found {len(memberships)} memberships.")

        for membership in memberships:
            org_id = membership.organization_id

            # Check if user is the sole owner
            t_owner = time.perf_counter()
            owner_count = db.query(Membership).filter(
                Membership.organization_id == org_id,
                Membership.role == "owner"
            ).count()
            logger.info(f"[TIMING] Check owner count for org {org_id} took {(time.perf_counter() - t_owner) * 1000:.2f} ms. Count: {owner_count}")

            if owner_count <= 1:
                # User is sole owner — delete the entire workspace
                t_doc = time.perf_counter()
                documents = db.query(ProcessedDocument).filter(
                    ProcessedDocument.organization_id == org_id
                ).all()
                logger.info(f"[TIMING] Document query for org {org_id} took {(time.perf_counter() - t_doc) * 1000:.2f} ms. Found {len(documents)} docs.")
                
                for doc in documents:
                    if doc.file_path:
                        t_gcs = time.perf_counter()
                        try:
                            logger.info(f"[TIMING] Starting GCS deletion for {doc.file_path} in delete_account")
                            GCSService.delete_file(doc.file_path)
                            logger.info(f"[TIMING] Finished GCS deletion for {doc.file_path} in {(time.perf_counter() - t_gcs) * 1000:.2f} ms")
                        except Exception as e:
                            logger.warning(f"Failed to delete file {doc.file_path}: {e}")

                t_org = time.perf_counter()
                org = db.query(Organization).filter(Organization.id == org_id).first()
                if org:
                    logger.info(f"[TIMING] Queueing organization deletion in SQLAlchemy...")
                    db.delete(org)
                    logger.info(f"[TIMING] Finished queueing organization deletion in {(time.perf_counter() - t_org) * 1000:.2f} ms")
            else:
                t_mem = time.perf_counter()
                logger.info(f"[TIMING] Queueing membership deletion in SQLAlchemy...")
                db.delete(membership)
                logger.info(f"[TIMING] Finished queueing membership deletion in {(time.perf_counter() - t_mem) * 1000:.2f} ms")

        # Delete the profile (cascades to remaining memberships and activity logs)
        t_profile = time.perf_counter()
        logger.info(f"[TIMING] Queueing profile deletion in SQLAlchemy...")
        db.delete(user_profile)
        logger.info(f"[TIMING] Finished queueing profile deletion in {(time.perf_counter() - t_profile) * 1000:.2f} ms")
        
        t_commit = time.perf_counter()
        logger.info(f"[TIMING] Starting database commit for account deletion...")
        db.commit()
        logger.info(f"[TIMING] Finished database commit for account deletion in {(time.perf_counter() - t_commit) * 1000:.2f} ms")
        
        logger.info(f"[TIMING] delete_account() completed successfully in {(time.perf_counter() - t_start) * 1000:.2f} ms")
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

        # Delete the orphaned profile
        db.delete(existing)
        db.flush()
        logger.info(f"Orphaned profile {existing.id} purged successfully")
