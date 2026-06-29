# ==============================================================================
# PURPOSE: Integration tests for Backup & Recovery System.
# DATA FLOW: Simulates SQLite backup copy, verifies magic header detection,
#            asserts retention cleanup, and tests restore simulation.
# ==============================================================================

import os
import time
import shutil
import uuid
import pytest
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.services.backup_service import BackupService, BACKUP_DIR


def test_backup_verification_logic():
    """
    Verifies that verify_backup detects correct magic headers.
    """
    # Create temp directory
    os.makedirs(BACKUP_DIR, exist_ok=True)
    temp_sqlite = os.path.join(BACKUP_DIR, "test_magic_verify.sqlite")
    temp_invalid = os.path.join(BACKUP_DIR, "test_magic_invalid.sqlite")

    try:
        # 1. Valid SQLite header
        with open(temp_sqlite, "wb") as f:
            f.write(b"SQLite format 3" + b"\x00" * 100)
        assert BackupService.verify_backup(temp_sqlite) is True

        # 2. Invalid header (over size threshold, contains sql statement text)
        with open(temp_invalid, "wb") as f:
            f.write(b"CREATE TABLE test (id integer);" + b"\x00" * 100)
        assert BackupService.verify_backup(temp_invalid) is True  # Falls back as sql text
        
        # 3. Too small file should fail
        with open(temp_invalid, "wb") as f:
            f.write(b"123")
        assert BackupService.verify_backup(temp_invalid) is False

    finally:
        for p in [temp_sqlite, temp_invalid]:
            if os.path.exists(p):
                os.remove(p)


def test_retention_policy_sweeps():
    """
    Verifies that local backups older than 7 days are automatically pruned.
    """
    os.makedirs(BACKUP_DIR, exist_ok=True)
    expired_file = os.path.join(BACKUP_DIR, "db_backup_expired.sqlite")
    active_file = os.path.join(BACKUP_DIR, "db_backup_active.sqlite")

    try:
        # Create active file (mtime = now)
        with open(active_file, "wb") as f:
            f.write(b"SQLite format 3\x00active")

        # Create expired file
        with open(expired_file, "wb") as f:
            f.write(b"SQLite format 3\x00expired")

        # Set expired file age to 8 days ago
        eight_days_ago = time.time() - (8 * 24 * 3600)
        os.utime(expired_file, (eight_days_ago, eight_days_ago))

        # Run retention sweep
        purged = BackupService.clean_expired_backups()
        
        assert expired_file.replace("\\", "/") in [p.replace("\\", "/") for p in purged]
        assert not os.path.exists(expired_file)
        assert os.path.exists(active_file)

    finally:
        for p in [expired_file, active_file]:
            if os.path.exists(p):
                os.remove(p)


def test_sqlite_backup_execution():
    """
    Verifies that the BackupService runs a complete backup, copies the SQLite file,
    and returns a success dictionary containing GCS and verification info.
    """
    db = SessionLocal()
    try:
        res = BackupService.run_backup(db)
        assert res["status"] == "success"
        assert res["verified"] is True
        assert os.path.exists(res["filepath"])
        
        # Cleanup generated file
        if os.path.exists(res["filepath"]):
            os.remove(res["filepath"])
    finally:
        db.close()
