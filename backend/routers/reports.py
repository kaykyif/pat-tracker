from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import io
import json
from datetime import datetime

from db.session import get_db
from models import orm_models
from services import classifier, excel_reader

router = APIRouter()

class BacklogRequest(BaseModel):
    recent_id: int
    previous_id: int

@router.post("/backlog")
def generate_backlog(req: BacklogRequest, db: Session = Depends(get_db)):
    # Helper to inject manual data and closed pats
    def inject_manual_and_closed(pats_list, ref_date):
        manual_data_list = db.query(orm_models.PatManualData).all()
        manual_map = {m.pat_id: m for m in manual_data_list}
        
        # apply overrides
        for p in pats_list:
            m = manual_map.get(p["id"])
            if m:
                p["manual_data"] = {
                    "andamento": m.andamento if m else "",
                    "responsavel_pat": m.responsavel_pat if m else "",
                    "usuario_solicitante": m.usuario_solicitante if m else "",
                    "gerente": m.gerente if m else "",
                    "diretor": m.diretor if m else "",
                    "cliente_impactado": m.cliente_impactado if m else "",
                    "impacto_problema": m.impacto_problema if m else "",
                    "medida_contorno": m.medida_contorno if m else ""
                }
                
                cur = p.get("recent") or p.get("previous")
                is_closed = False
                
                if m.override_encerramento:
                    if cur:
                        cur["encerramento"] = m.override_encerramento.isoformat()
                        cur["is_override_encerramento"] = True
                    is_closed = True
                
                if m.override_status:
                    if cur:
                        cur["status"] = m.override_status
                        cur["is_override_status"] = True
                        
                if is_closed:
                    if "encerrado" not in p["categories"]:
                        p["categories"].append("encerrado")
                    # remove deadline categories
                    p["categories"] = [c for c in p["categories"] if c not in ("atrasado", "vencendo_semana", "sem_prazo")]
                    
        # Inject closed pats from PatEncerrado
        closed_pats = db.query(orm_models.PatEncerrado).all()
        closed_map = {cp.pat_id: cp for cp in closed_pats}
        pat_ids_in_list = {p["id"] for p in pats_list}
        
        # Apply closed status to those already in the list
        for p in pats_list:
            if p["id"] in closed_map:
                cp = closed_map[p["id"]]
                cur = p.get("recent") or p.get("previous")
                if cur:
                    cur["is_closed_historic"] = True
                    if cp.encerramento and not cur.get("encerramento"):
                        cur["encerramento"] = cp.encerramento.isoformat()
                if "encerrado" not in p["categories"]:
                    p["categories"].append("encerrado")
                p["categories"] = [c for c in p["categories"] if c not in ("atrasado", "vencendo_semana", "sem_prazo")]
                
        for cp in closed_pats:
            if cp.pat_id in pat_ids_in_list:
                continue
                
            m = manual_map.get(cp.pat_id)
            d = {c.name: getattr(cp, c.name) for c in cp.__table__.columns}
            for k, v in d.items():
                if isinstance(v, datetime) or isinstance(v, type(ref_date)):
                    d[k] = v.isoformat() if v else None
                    
            d["is_closed_historic"] = True
            d["aberto_com"] = "MXM"
            d["prioridade"] = cp.status
            d["tipo_prazo"] = None
            
            if m and m.override_encerramento:
                d["encerramento"] = m.override_encerramento.isoformat()
                d["is_override_encerramento"] = True
            if m and m.override_status:
                d["status"] = m.override_status
                d["is_override_status"] = True
                
            pats_list.append({
                "id": cp.pat_id,
                "recent": d,
                "previous": None,
                "categories": ["encerrado"],
                "changes": [],
                "prazo_anterior": None,
                "dias_aberto": None,
                "manual_data": {
                    "andamento": m.andamento if m else "",
                    "responsavel_pat": m.responsavel_pat if m else "",
                    "usuario_solicitante": m.usuario_solicitante if m else "",
                    "gerente": m.gerente if m else "",
                    "diretor": m.diretor if m else "",
                    "cliente_impactado": m.cliente_impactado if m else "",
                    "impacto_problema": m.impacto_problema if m else "",
                    "medida_contorno": m.medida_contorno if m else ""
                } if m else None
            })
            
        return pats_list

    # Check cache
    cache = db.query(orm_models.PatAnalysisCache).filter(
        orm_models.PatAnalysisCache.upload_recent_id == req.recent_id,
        orm_models.PatAnalysisCache.upload_previous_id == req.previous_id
    ).first()
    
    if cache:
        recent_upload = db.query(orm_models.PatUpload).filter(orm_models.PatUpload.id == req.recent_id).first()
        pats = json.loads(cache.pats_json)
        if recent_upload:
            pats = inject_manual_and_closed(pats, recent_upload.reference_date)
            
        return {
            "pats": pats,
            "totals": json.loads(cache.totals_json),
            "matrix": json.loads(cache.matrix_json) if cache.matrix_json else [],
            "weekStart": cache.week_start.isoformat() if cache.week_start else None,
            "weekEnd": cache.week_end.isoformat() if cache.week_end else None
        }
        
    recent_upload = db.query(orm_models.PatUpload).filter(orm_models.PatUpload.id == req.recent_id).first()
    previous_upload = db.query(orm_models.PatUpload).filter(orm_models.PatUpload.id == req.previous_id).first()
    
    if not recent_upload or not previous_upload:
        raise HTTPException(status_code=404, detail="Uploads not found")
        
    recent_snaps = db.query(orm_models.PatSnapshot).filter(orm_models.PatSnapshot.upload_id == req.recent_id).all()
    previous_snaps = db.query(orm_models.PatSnapshot).filter(orm_models.PatSnapshot.upload_id == req.previous_id).all()
    
    # Convert ORM to dict
    def to_dict(snaps):
        return [
            {c.name: getattr(s, c.name) for c in s.__table__.columns}
            for s in snaps
        ]
        
    result = classifier.classify(
        recent=to_dict(recent_snaps),
        previous=to_dict(previous_snaps),
        reference_date=recent_upload.reference_date
    )
    
    # Save cache
    new_cache = orm_models.PatAnalysisCache(
        upload_recent_id=req.recent_id,
        upload_previous_id=req.previous_id,
        totals_json=json.dumps(result["totals"]),
        pats_json=json.dumps(result["pats"], default=str),
        matrix_json=json.dumps(result.get("matrix", [])),
        week_start=datetime.strptime(result["weekStart"], "%Y-%m-%d").date() if result.get("weekStart") else None,
        week_end=datetime.strptime(result["weekEnd"], "%Y-%m-%d").date() if result.get("weekEnd") else None
    )
    db.add(new_cache)
    db.commit()
    
    # Replace dates with string representation for JSON response if they exist in result dicts
    # In classifier, we may have date objects in pats array, json.dumps handles string defaults but FastAPI encoder might complain if not using pydantic models or proper dicts.
    
    # We can just return the re-loaded json string to ensure types are safe
    pats = json.loads(new_cache.pats_json)
    pats = inject_manual_and_closed(pats, recent_upload.reference_date)
    
    return {
        "pats": pats,
        "totals": json.loads(new_cache.totals_json),
        "matrix": json.loads(new_cache.matrix_json) if new_cache.matrix_json else [],
        "weekStart": new_cache.week_start.isoformat() if new_cache.week_start else None,
        "weekEnd": new_cache.week_end.isoformat() if new_cache.week_end else None
    }

@router.get("/backlog/export")
def export_backlog_excel(recent_id: int, previous_id: int, db: Session = Depends(get_db)):
    result = generate_backlog(BacklogRequest(recent_id=recent_id, previous_id=previous_id), db)
    from services.excel_writer import export_backlog
    excel_bytes = export_backlog(result)
    return StreamingResponse(io.BytesIO(excel_bytes), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=backlog.xlsx"})

class GerencialRequest(BaseModel):
    start_date: str
    end_date: str

@router.post("/gerencial")
def generate_gerencial(req: GerencialRequest, db: Session = Depends(get_db)):
    # Stub for now
    return {"message": "Gerencial data preview"}

@router.get("/gerencial/export")
def export_gerencial_excel(upload_id: int, db: Session = Depends(get_db)):
    upload = db.query(orm_models.PatUpload).filter(orm_models.PatUpload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
        
    snaps = db.query(orm_models.PatSnapshot).filter(orm_models.PatSnapshot.upload_id == upload_id).all()
    def to_dict(snaps):
        return [
            {c.name: getattr(s, c.name) for c in s.__table__.columns}
            for s in snaps
        ]
    data = to_dict(snaps)
    
    from services.excel_writer import export_gerencial
    excel_bytes = export_gerencial(data, upload.reference_date)
    return StreamingResponse(io.BytesIO(excel_bytes), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=gerencial-{upload.reference_date}.xlsx"})

class LevantamentoRequest(BaseModel):
    upload_id: int

@router.post("/levantamento")
def generate_levantamento(req: LevantamentoRequest, db: Session = Depends(get_db)):
    return {"message": "Levantamento data preview"}

@router.get("/levantamento/export")
def export_levantamento_excel(upload_id: int, db: Session = Depends(get_db)):
    upload = db.query(orm_models.PatUpload).filter(orm_models.PatUpload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
        
    snaps = db.query(orm_models.PatSnapshot).filter(orm_models.PatSnapshot.upload_id == upload_id).all()
    manual_data_list = db.query(orm_models.PatManualData).all()
    manual_map = {m.pat_id: m for m in manual_data_list}
    
    def to_dict(snaps):
        res = []
        for s in snaps:
            d = {c.name: getattr(s, c.name) for c in s.__table__.columns}
            # Add manual fields
            m = manual_map.get(s.pat_id)
            d["andamento"] = m.andamento if m else ""
            d["responsavel_pat"] = m.responsavel_pat if m else ""
            d["usuario_solicitante"] = m.usuario_solicitante if m else ""
            d["gerente"] = m.gerente if m else ""
            d["diretor"] = m.diretor if m else ""
            d["cliente_impactado"] = m.cliente_impactado if m else ""
            d["impacto_problema"] = m.impacto_problema if m else ""
            d["medida_contorno"] = m.medida_contorno if m else ""
            res.append(d)
        return res
        
    data = to_dict(snaps)
    
    # Also we need closed PATs (PATs in manual_data that are NOT in the current snaps)
    current_pat_ids = {s.pat_id for s in snaps}
    closed_pats = []
    for m in manual_data_list:
        if m.pat_id not in current_pat_ids:
            closed_pats.append({
                "pat_id": m.pat_id,
                "andamento": m.andamento,
                "responsavel_pat": m.responsavel_pat,
                "usuario_solicitante": m.usuario_solicitante,
                "gerente": m.gerente,
                "diretor": m.diretor,
                "cliente_impactado": m.cliente_impactado,
                "impacto_problema": m.impacto_problema,
                "medida_contorno": m.medida_contorno,
                # the rest is empty since it's not in current MXM snap, though ideally we could look up the latest snap for it. For now empty is fine.
            })
    
    from services.excel_writer import export_levantamento
    excel_bytes = export_levantamento(data, closed_pats, upload.reference_date)
    return StreamingResponse(io.BytesIO(excel_bytes), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=levantamento-{upload.reference_date}.xlsx"})

class ManualDataUpdate(BaseModel):
    andamento: str = ""
    responsavel_pat: str = ""
    usuario_solicitante: str = ""
    gerente: str = ""
    diretor: str = ""
    cliente_impactado: str = ""
    impacto_problema: str = ""
    medida_contorno: str = ""
    override_encerramento: str | None = None
    override_status: str | None = None

@router.get("/manual-data/{pat_id}")
def get_manual_data(pat_id: str, db: Session = Depends(get_db)):
    m = db.query(orm_models.PatManualData).filter(orm_models.PatManualData.pat_id == pat_id).first()
    if not m:
        return {}
    return {
        "andamento": m.andamento,
        "responsavel_pat": m.responsavel_pat,
        "usuario_solicitante": m.usuario_solicitante,
        "gerente": m.gerente,
        "diretor": m.diretor,
        "cliente_impactado": m.cliente_impactado,
        "impacto_problema": m.impacto_problema,
        "medida_contorno": m.medida_contorno,
        "override_encerramento": m.override_encerramento.isoformat() if m.override_encerramento else None,
        "override_status": m.override_status
    }

@router.put("/manual-data/{pat_id}")
def update_manual_data(pat_id: str, req: ManualDataUpdate, db: Session = Depends(get_db)):
    m = db.query(orm_models.PatManualData).filter(orm_models.PatManualData.pat_id == pat_id).first()
    if not m:
        m = orm_models.PatManualData(pat_id=pat_id)
        db.add(m)
    
    m.andamento = req.andamento
    m.responsavel_pat = req.responsavel_pat
    m.usuario_solicitante = req.usuario_solicitante
    m.gerente = req.gerente
    m.diretor = req.diretor
    m.cliente_impactado = req.cliente_impactado
    m.impacto_problema = req.impacto_problema
    m.medida_contorno = req.medida_contorno
    
    if req.override_encerramento:
        try:
            m.override_encerramento = datetime.strptime(req.override_encerramento, "%Y-%m-%d").date()
        except ValueError:
            pass
    else:
        m.override_encerramento = None
        
    m.override_status = req.override_status if req.override_status else None
    
    h = orm_models.PatManualDataHistory(
        pat_id=pat_id,
        reference_date=datetime.utcnow().date(),
        andamento=req.andamento,
        responsavel_pat=req.responsavel_pat,
        usuario_solicitante=req.usuario_solicitante,
        gerente=req.gerente,
        diretor=req.diretor,
        cliente_impactado=req.cliente_impactado,
        impacto_problema=req.impacto_problema,
        medida_contorno=req.medida_contorno,
        override_encerramento=m.override_encerramento,
        override_status=m.override_status
    )
    db.add(h)
    
    db.commit()
    return {"message": "Updated successfully"}

@router.post("/manual-data/upload")
async def upload_manual_data(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls')):
        raise HTTPException(status_code=400, detail="Somente arquivos .xlsx ou .xls são suportados")
    
    file_bytes = await file.read()
    
    try:
        rows = excel_reader.read_levantamento_manual_data(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler arquivo: {str(e)}")
        
    if not rows:
        return {"updated": 0, "message": "Nenhum dado manual encontrado."}
        
    import re
    match = re.search(r"(\d{2})[\.-](\d{2})[\.-](\d{4})", file.filename)
    if match:
        day, month, year = match.groups()
        ref_date = datetime(int(year), int(month), int(day)).date()
    else:
        ref_date = datetime.utcnow().date()
        
    # Fetch existing
    pat_ids = [r["pat_id"] for r in rows]
    existing_manual_data = db.query(orm_models.PatManualData).filter(orm_models.PatManualData.pat_id.in_(pat_ids)).all()
    manual_map = {m.pat_id: m for m in existing_manual_data}
    
    updates = 0
    new_records = []
    history_records = []
    
    for r in rows:
        pat_id = r["pat_id"]
        
        old_m = manual_map.get(pat_id)
        h = orm_models.PatManualDataHistory(
            pat_id=pat_id,
            reference_date=ref_date,
            andamento=r["andamento"],
            responsavel_pat=r["responsavel_pat"],
            usuario_solicitante=r["usuario_solicitante"],
            gerente=r["gerente"],
            diretor=r["diretor"],
            cliente_impactado=r["cliente_impactado"],
            impacto_problema=r["impacto_problema"],
            medida_contorno=r["medida_contorno"],
            override_encerramento=old_m.override_encerramento if old_m else None,
            override_status=old_m.override_status if old_m else None
        )
        history_records.append(h)
        
        if pat_id in manual_map:
            m = manual_map[pat_id]
            m.andamento = r["andamento"]
            m.responsavel_pat = r["responsavel_pat"]
            m.usuario_solicitante = r["usuario_solicitante"]
            m.gerente = r["gerente"]
            m.diretor = r["diretor"]
            m.cliente_impactado = r["cliente_impactado"]
            m.impacto_problema = r["impacto_problema"]
            m.medida_contorno = r["medida_contorno"]
            updates += 1
        else:
            m = orm_models.PatManualData(
                pat_id=pat_id,
                andamento=r["andamento"],
                responsavel_pat=r["responsavel_pat"],
                usuario_solicitante=r["usuario_solicitante"],
                gerente=r["gerente"],
                diretor=r["diretor"],
                cliente_impactado=r["cliente_impactado"],
                impacto_problema=r["impacto_problema"],
                medida_contorno=r["medida_contorno"]
            )
            new_records.append(m)
            
    if new_records:
        db.bulk_save_objects(new_records)
        updates += len(new_records)
        
    if history_records:
        db.bulk_save_objects(history_records)
        
    db.commit()
    return {"updated": updates, "message": "Dados importados com sucesso."}

@router.get("/snapshot")
def get_snapshot(upload_id: int, db: Session = Depends(get_db)):
    upload = db.query(orm_models.PatUpload).filter(orm_models.PatUpload.id == upload_id).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
        
    snaps = db.query(orm_models.PatSnapshot).filter(orm_models.PatSnapshot.upload_id == upload_id).all()
    manual_data_list = db.query(orm_models.PatManualData).all()
    manual_map = {m.pat_id: m for m in manual_data_list}
    
    closed_pats = db.query(orm_models.PatEncerrado).all()
    closed_map = {cp.pat_id: cp for cp in closed_pats}
    
    pats_out = []
    
    # Pre-calculate history of prazos for all PATs
    all_snaps = db.query(
        orm_models.PatSnapshot.pat_id, 
        orm_models.PatSnapshot.prazo
    ).order_by(orm_models.PatSnapshot.reference_date.asc()).all()
    
    prazos_by_pat = {}
    for pid, prazo in all_snaps:
        if prazo:
            if pid not in prazos_by_pat:
                prazos_by_pat[pid] = []
            prazo_iso = prazo.isoformat()
            if not prazos_by_pat[pid] or prazos_by_pat[pid][-1] != prazo_iso:
                prazos_by_pat[pid].append(prazo_iso)
    
    for s in snaps:
        d = {c.name: getattr(s, c.name) for c in s.__table__.columns}
        # Converte datas para string para JSON seguro
        for k, v in d.items():
            if isinstance(v, datetime) or isinstance(v, type(upload.reference_date)):
                d[k] = v.isoformat() if v else None
                
        d["historico_prazos"] = prazos_by_pat.get(s.pat_id, [])
        
        # If it's in PatEncerrado, it is historically closed now
        if s.pat_id in closed_map:
            cp = closed_map[s.pat_id]
            d["is_closed_historic"] = True
            if cp.encerramento and not d.get("encerramento"):
                d["encerramento"] = cp.encerramento.isoformat()
        
        m = manual_map.get(s.pat_id)
        d["manual_data"] = {
            "andamento": m.andamento if m else "",
            "responsavel_pat": m.responsavel_pat if m else "",
            "usuario_solicitante": m.usuario_solicitante if m else "",
            "gerente": m.gerente if m else "",
            "diretor": m.diretor if m else "",
            "cliente_impactado": m.cliente_impactado if m else "",
            "impacto_problema": m.impacto_problema if m else "",
            "medida_contorno": m.medida_contorno if m else ""
        }
        
        if m and m.override_encerramento:
            d["encerramento"] = m.override_encerramento.isoformat()
            d["is_override_encerramento"] = True
        if m and m.override_status:
            d["status"] = m.override_status
            d["is_override_status"] = True
            
        pats_out.append(d)
        
    # Inject closed pats that are not in the current snapshot
    snap_pat_ids = {s.pat_id for s in snaps}
    
    for cp in closed_pats:
        if cp.pat_id in snap_pat_ids:
            continue
            
        d = {c.name: getattr(cp, c.name) for c in cp.__table__.columns}
        for k, v in d.items():
            if isinstance(v, datetime) or isinstance(v, type(upload.reference_date)):
                d[k] = v.isoformat() if v else None
                
        d["is_closed_historic"] = True
        d["aberto_com"] = "MXM" # Presumed since we import from MXM closed reports
        d["prioridade"] = cp.status # fallback
        d["tipo_prazo"] = None
        d["historico_prazos"] = prazos_by_pat.get(cp.pat_id, [])
        
        m = manual_map.get(cp.pat_id)
        d["manual_data"] = {
            "andamento": m.andamento if m else "",
            "responsavel_pat": m.responsavel_pat if m else "",
            "usuario_solicitante": m.usuario_solicitante if m else "",
            "gerente": m.gerente if m else "",
            "diretor": m.diretor if m else "",
            "cliente_impactado": m.cliente_impactado if m else "",
            "impacto_problema": m.impacto_problema if m else "",
            "medida_contorno": m.medida_contorno if m else ""
        }
        
        if m and m.override_encerramento:
            d["encerramento"] = m.override_encerramento.isoformat()
            d["is_override_encerramento"] = True
        if m and m.override_status:
            d["status"] = m.override_status
            d["is_override_status"] = True
            
        pats_out.append(d)
        
    return {
        "upload": {
            "id": upload.id,
            "reference_date": upload.reference_date.isoformat(),
            "total_pats": upload.total_pats,
            "total_mxm": upload.total_mxm,
        },
        "pats": pats_out
    }

@router.get("/pat-history/{pat_id}")
def get_pat_history(pat_id: str, db: Session = Depends(get_db)):
    snaps = db.query(orm_models.PatSnapshot).filter(orm_models.PatSnapshot.pat_id == pat_id).order_by(orm_models.PatSnapshot.reference_date.asc()).all()
    manual_hist = db.query(orm_models.PatManualDataHistory).filter(orm_models.PatManualDataHistory.pat_id == pat_id).order_by(orm_models.PatManualDataHistory.reference_date.asc()).all()
    
    events = []
    for s in snaps:
        events.append({
            "type": "snapshot",
            "id": f"s_{s.id}",
            "date": s.reference_date.isoformat() if s.reference_date else None,
            "prazo": s.prazo.isoformat() if s.prazo else None,
            "natureza": s.prioridade,
            "status": s.status,
            "aberto_com": s.aberto_com,
            "tipo_prazo": s.tipo_prazo
        })
        
    for m in manual_hist:
        events.append({
            "type": "manual",
            "id": f"m_{m.id}",
            "date": m.reference_date.isoformat() if m.reference_date else None,
            "andamento": m.andamento,
            "responsavel_pat": m.responsavel_pat,
            "usuario_solicitante": m.usuario_solicitante,
            "gerente": m.gerente,
            "diretor": m.diretor,
            "cliente_impactado": m.cliente_impactado,
            "impacto_problema": m.impacto_problema,
            "medida_contorno": m.medida_contorno
        })
        
    encerrado = db.query(orm_models.PatEncerrado).filter(orm_models.PatEncerrado.pat_id == pat_id).first()
    if encerrado:
        events.append({
            "type": "encerrado",
            "id": f"e_{encerrado.pat_id}",
            "date": encerrado.encerramento.isoformat() if encerrado.encerramento else None,
            "status": "Encerrado",
            "aberto_com": "MXM"
        })
        
    # Sort chronologically
    events.sort(key=lambda x: x["date"] if x["date"] else "")
    return {"history": events}

@router.get("/encerrados/history")
def get_encerrados_history(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    # Group PatEncerrado by created_at (truncated to minute to avoid minor deviations if any)
    # Since created_at is a DateTime and imports happen in a batch, we can format it.
    
    # query to get counts and the exact created_at
    rows = db.query(
        orm_models.PatEncerrado.created_at,
        func.count(orm_models.PatEncerrado.pat_id).label("total")
    ).group_by(func.strftime('%Y-%m-%d %H:%M', orm_models.PatEncerrado.created_at)).all()
    
    res = []
    for r in rows:
        created_at, total = r
        res.append({
            "created_at": created_at.isoformat() if created_at else None,
            "total_pats": total
        })
        
    # Sort descending
    res.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return res
