from sqlalchemy.orm import Session
from models import orm_models

def get_upload_by_date(db: Session, reference_date):
    return db.query(orm_models.PatUpload).filter(orm_models.PatUpload.reference_date == reference_date).first()

def create_upload(db: Session, reference_date, file_name: str, total_pats: int, total_mxm: int, user_id: int = None):
    db_upload = orm_models.PatUpload(
        user_id=user_id,
        file_name=file_name,
        reference_date=reference_date,
        total_pats=total_pats,
        total_mxm=total_mxm
    )
    db.add(db_upload)
    db.commit()
    db.refresh(db_upload)
    return db_upload

def create_snapshots_bulk(db: Session, upload_id: int, pat_rows: list[dict], reference_date):
    snapshots = []
    for row in pat_rows:
        snap = orm_models.PatSnapshot(
            upload_id=upload_id,
            reference_date=reference_date,
            **row
        )
        snapshots.append(snap)
    
    db.bulk_save_objects(snapshots)
    db.commit()

def get_all_uploads(db: Session):
    return db.query(orm_models.PatUpload).order_by(orm_models.PatUpload.reference_date.desc()).all()

def delete_upload(db: Session, upload_id: int):
    upload = db.query(orm_models.PatUpload).filter(orm_models.PatUpload.id == upload_id).first()
    if upload:
        db.delete(upload)
        db.commit()
