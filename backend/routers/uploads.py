from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from db.session import get_db
from db import crud
from services import excel_reader
from models import schemas, orm_models
import traceback

router = APIRouter()

@router.get("", response_model=List[schemas.UploadResponse])
def get_uploads(db: Session = Depends(get_db)):
    return crud.get_all_uploads(db)

@router.post("", response_model=schemas.UploadResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    
    file_bytes = await file.read()
    
    # Extract date
    ref_date = excel_reader.extract_date_from_a2(file_bytes)
    if not ref_date:
        raise HTTPException(status_code=400, detail="Could not extract 'Emitido em: DD/MM/YYYY' from cell A2")
        
    # Check duplicate
    existing = crud.get_upload_by_date(db, ref_date)
    if existing:
        raise HTTPException(status_code=409, detail=f"Upload for date {ref_date} already exists")
        
    # Parse rows
    try:
        rows = excel_reader.read_pat_rows(file_bytes)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error parsing rows: {str(e)}")
        
    total_pats = len(rows)
    total_mxm = sum(1 for r in rows if r['aberto_com'] and r['aberto_com'].strip().upper() == 'MXM')
    
    # Save upload
    db_upload = crud.create_upload(
        db=db,
        reference_date=ref_date,
        file_name=file.filename,
        total_pats=total_pats,
        total_mxm=total_mxm
    )
    
    # Bulk insert snapshots
    crud.create_snapshots_bulk(
        db=db,
        upload_id=db_upload.id,
        pat_rows=rows,
        reference_date=ref_date
    )
    
    return db_upload

@router.delete("/{upload_id}")
def delete_upload(upload_id: int, db: Session = Depends(get_db)):
    crud.delete_upload(db, upload_id)
    return {"status": "deleted"}

@router.post("/encerrados")
async def upload_encerrados(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    
    file_bytes = await file.read()
    
    try:
        rows = excel_reader.read_pat_rows(file_bytes)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error parsing rows: {str(e)}")
        
    inserted = 0
    updated = 0
    
    for r in rows:
        pat_id = r["pat_id"]
        existing = db.query(orm_models.PatEncerrado).filter(orm_models.PatEncerrado.pat_id == pat_id).first()
        if existing:
            existing.data_abertura = r.get("data_abertura")
            existing.encerramento = r.get("encerramento") or existing.encerramento
            existing.modulo = r.get("modulo")
            existing.titulo = r.get("titulo")
            existing.cliente = r.get("cliente")
            existing.status = r.get("status") or "Encerrado"
            existing.descricao = r.get("descricao")
            updated += 1
        else:
            new_enc = orm_models.PatEncerrado(
                pat_id=pat_id,
                data_abertura=r.get("data_abertura"),
                encerramento=r.get("encerramento"),
                modulo=r.get("modulo"),
                titulo=r.get("titulo"),
                cliente=r.get("cliente"),
                status=r.get("status") or "Encerrado",
                descricao=r.get("descricao")
            )
            db.add(new_enc)
            inserted += 1
            
    db.commit()
    return {"message": "PATs Encerrados processados com sucesso", "inserted": inserted, "updated": updated}
