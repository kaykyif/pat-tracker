import os
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Set, Tuple

COMPARE_FIELDS = [
    "status",
    "prioridade",
    "tipo_prazo",
    "prazo",
    "modulo",
    "titulo",
    "cliente",
    "aberto_com"
]

IGNORED_STATUSES = ["aguardando direcionamento interno"]

# Valor da coluna "Aberto Com" que identifica a equipe interna (vs. o fornecedor MXM).
INTERNAL_TEAM = os.environ.get("INTERNAL_TEAM", "INTERNO").strip().upper()

def get_next_sun_to_sat_week(reference: date) -> Tuple[date, date]:
    # weekday() in python: Mon=0, Sun=6. We want Sun=0..Sat=6.
    # isoweekday(): Mon=1, Sun=7.
    dow = reference.isoweekday() % 7 # Sun=0, Mon=1...Sat=6
    add = ((7 - dow) % 7) or 7
    start = reference + timedelta(days=add)
    end = start + timedelta(days=6)
    return start, end

def classify_deadline(deadline, week_start, week_end, reference_date, atrasado_contra_hoje=False):
    """
    Regra unificada de classificação de prazo, espelhada no frontend
    (src/lib/deadline-classifier.ts).

    - Backlog Semanal (atrasado_contra_hoje=False): "atrasado" é medido contra o
      início da semana de referência (domingo).
    - Infos Gerais (atrasado_contra_hoje=True): "atrasado" é medido contra a data
      real de hoje; "vencendo_semana" continua sendo a semana de referência.

    Retorna "atrasado", "vencendo_semana", "sem_prazo" ou None.
    """
    if not deadline:
        return "sem_prazo"
    if isinstance(deadline, datetime):
        deadline = deadline.date()
    if not isinstance(deadline, date):
        return None
    threshold = reference_date if atrasado_contra_hoje else week_start
    if deadline < threshold:
        return "atrasado"
    if week_start <= deadline <= week_end:
        return "vencendo_semana"
    return None

def is_mxm_row(r: dict) -> bool:
    v = str(r.get("aberto_com") or "").strip().upper()
    return v == "MXM"

def is_ignored_status(r: dict) -> bool:
    s = str(r.get("status") or "").strip().lower()
    return any(ig in s for ig in IGNORED_STATUSES)

def classify(recent: List[dict], previous: List[dict], reference_date: date, config: dict = None) -> dict:
    if config is None:
        config = {"staleDays": 14}
        
    week_start, week_end = get_next_sun_to_sat_week(reference_date)
    
    recent_mxm = [r for r in recent if is_mxm_row(r) and not is_ignored_status(r)]
    previous_mxm = [r for r in previous if is_mxm_row(r) and not is_ignored_status(r)]
    
    recent_map = {str(r.get("pat_id")): r for r in recent_mxm if r.get("pat_id")}
    previous_map = {str(r.get("pat_id")): r for r in previous_mxm if r.get("pat_id")}
    
    ids = set(recent_map.keys()).union(set(previous_map.keys()))
    
    pats = []
    
    for pat_id in ids:
        r = recent_map.get(pat_id)
        p = previous_map.get(pat_id)
        categories = set()
        changes = []
        
        if r and not p:
            categories.add("novo")
        if not r and p:
            categories.add("saiu_mxm")
            
        if r and p:
            for f in COMPARE_FIELDS:
                a = str(r.get(f) or "").strip()
                b = str(p.get(f) or "").strip()
                if a != b:
                    changes.append({"id": pat_id, "field": f, "before": b or None, "after": a or None})
            
            if changes:
                categories.add("alterado")
            else:
                categories.add("sem_alteracao")
                
            old_dl = p.get("prazo")
            new_dl = r.get("prazo")
            if old_dl and new_dl and isinstance(old_dl, date) and isinstance(new_dl, date):
                if new_dl > old_dl:
                    categories.add("postergado")
                    
        if r:
            categories.add("aberto_mxm")
            # Regra de prazo compartilhada com o frontend (deadline-classifier.ts).
            # No Backlog Semanal, "atrasado" é medido contra o domingo da semana-alvo.
            deadline_cat = classify_deadline(
                r.get("prazo"), week_start, week_end, reference_date
            )
            if deadline_cat:
                categories.add(deadline_cat)

            # "sem_atualizacao" — comportamento atual preservado: o schema não possui
            # ultima_atualizacao, então usa encerramento como última referência e marca
            # quando a diferença em dias em relação à data da consulta passa de staleDays.
            last_upd = r.get("encerramento")
            if last_upd and isinstance(last_upd, date):
                diff_days = (reference_date - last_upd).days
                if diff_days > config.get("staleDays", 14):
                    categories.add("sem_atualizacao")
                    
        is_postponed = "postergado" in categories
        opened = None
        if r and r.get("data_abertura"):
            opened = r.get("data_abertura")
        elif p and p.get("data_abertura"):
            opened = p.get("data_abertura")
            
        dias_aberto = None
        if opened and isinstance(opened, date):
            dias_aberto = max(0, (reference_date - opened).days)
            
        pats.append({
            "id": pat_id,
            "recent": r,
            "previous": p,
            "categories": list(categories),
            "changes": changes,
            "prazo_anterior": p.get("prazo") if is_postponed and p else None,
            "dias_aberto": dias_aberto
        })
        
    totals = {
        "total_atual": len(recent),
        "total_anterior": len(previous),
        "mxm_atual": len(recent_mxm),
        "mxm_anterior": len(previous_mxm),
        "novo": 0, "saiu_mxm": 0, "alterado": 0, "sem_alteracao": 0,
        "atrasado": 0, "vencendo_semana": 0, "postergado": 0, "sem_prazo": 0,
        "sem_atualizacao": 0, "aberto_mxm": 0
    }
    
    for p in pats:
        for c in p["categories"]:
            totals[c] = totals.get(c, 0) + 1
            
    return {
        "pats": pats,
        "totals": totals,
        "totalRecent": len(recent),
        "totalPrevious": len(previous),
        "mxmRecent": len(recent_mxm),
        "mxmPrevious": len(previous_mxm),
        "weekStart": week_start.isoformat(),
        "weekEnd": week_end.isoformat(),
        "matrix": generate_matrix(recent, previous, reference_date)
    }

def generate_matrix(recent: List[dict], previous: List[dict], reference_date: date) -> List[dict]:
    recent_valid = [r for r in recent if not is_ignored_status(r)]
    previous_valid = [r for r in previous if not is_ignored_status(r)]
    
    recent_map = {str(r.get("pat_id")): r for r in recent_valid if r.get("pat_id")}
    previous_map = {str(r.get("pat_id")): r for r in previous_valid if r.get("pat_id")}
    
    naturezas = set()
    for r in recent_valid + previous_valid:
        n = str(r.get("prioridade") or "Outros").strip().title()
        naturezas.add(n)
        
    matrix = {}
    for n in naturezas:
        matrix[n] = {
            "natureza": n,
            "saldo_anterior": 0,
            "novos": 0,
            "encerrados": 0,
            "saldo_atual": 0,
            "aging_0_30": 0,
            "aging_31_60": 0,
            "aging_60_plus": 0,
            "resp_interno": 0,
            "resp_mxm": 0,
            "sem_prazo": 0,
            "adiados_atrasados": 0
        }
        
    week_start, _ = get_next_sun_to_sat_week(reference_date)
        
    for p in previous_valid:
        n = str(p.get("prioridade") or "Outros").strip().title()
        matrix[n]["saldo_anterior"] += 1
        if str(p.get("pat_id")) not in recent_map:
            matrix[n]["encerrados"] += 1

    for r in recent_valid:
        n = str(r.get("prioridade") or "Outros").strip().title()
        pat_id = str(r.get("pat_id"))
        
        matrix[n]["saldo_atual"] += 1
        if pat_id not in previous_map:
            matrix[n]["novos"] += 1
            
        abertura = r.get("data_abertura")
        if abertura and isinstance(abertura, date):
            dias = max(0, (reference_date - abertura).days)
            if dias <= 30:
                matrix[n]["aging_0_30"] += 1
            elif dias <= 60:
                matrix[n]["aging_31_60"] += 1
            else:
                matrix[n]["aging_60_plus"] += 1
                
        resp = str(r.get("aberto_com") or "").strip().upper()
        if resp in (INTERNAL_TEAM, "CLIENTE"):
            matrix[n]["resp_interno"] += 1
        elif resp == "MXM":
            matrix[n]["resp_mxm"] += 1
            
        prazo = r.get("prazo")
        if not prazo:
            matrix[n]["sem_prazo"] += 1
        elif isinstance(prazo, date):
            if prazo < week_start:
                matrix[n]["adiados_atrasados"] += 1
            else:
                p = previous_map.get(pat_id)
                if p:
                    old_prazo = p.get("prazo")
                    if old_prazo and isinstance(old_prazo, date) and prazo > old_prazo:
                        matrix[n]["adiados_atrasados"] += 1

    return list(matrix.values())
