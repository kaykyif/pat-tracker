import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from datetime import datetime

def _format_date(d):
    if not d:
        return ""
    if isinstance(d, str):
        try:
            return datetime.strptime(d, "%Y-%m-%d").strftime("%d/%m/%Y")
        except:
            return d
    return d.strftime("%d/%m/%Y")

def export_backlog(result: dict) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Backlog MXM"
    
    headers = [
        "PAT", "Sistema", "Função", "Usuário", "Abertura", "Natureza",
        "Status", "Descrição", "Prazo", "Aberto Com", "PRAZOS"
    ]
    
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    fill_semana = PatternFill(start_color="FF92D050", end_color="FF92D050", fill_type="solid")
    fill_postergado = PatternFill(start_color="FFFFFF00", end_color="FFFFFF00", fill_type="solid")
    fill_atrasado = PatternFill(start_color="FFFFC000", end_color="FFFFC000", fill_type="solid")
    fill_sem_prazo = PatternFill(start_color="FFFFFF00", end_color="FFFFFF00", fill_type="solid") # Index 5 (Amarelo)
    fill_header = PatternFill(start_color="FFBDD7EE", end_color="FFBDD7EE", fill_type="solid") # Um azul claro (idêntico ao default do Excel)
    
    font_title = Font(bold=True, size=12)
    font_header = Font(bold=True, color="FF000000")
    
    sections = [
        ("PATS COM PRAZO PRA SEMANA", "vencendo_semana", fill_semana),
        ("PATS COM PRAZO POSTERGADO", "postergado", fill_postergado),
        ("PATs em atraso", "atrasado", fill_atrasado),
        ("PATs sem prazo", "sem_prazo", fill_sem_prazo),
    ]
    
    for title, cat_key, fill in sections:
        # Linha de Título
        ws.append([title] + [""] * (len(headers) - 1))
        row_idx = ws.max_row
        ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=len(headers))
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.border = thin_border
            c.fill = fill
        cell = ws.cell(row=row_idx, column=1)
        cell.font = font_title
        cell.alignment = Alignment(horizontal="center")
        
        # Linha de Cabeçalhos
        ws.append(headers)
        row_idx = ws.max_row
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.font = font_header
            c.fill = fill_header
            c.border = thin_border
            
        # Dados
        count = 0
        for p in result.get("pats", []):
            if cat_key in p.get("categories", []):
                r = p.get("recent")
                if not r: continue
                # Filtra apenas os que estão com a MXM, conforme o backlog
                if not str(r.get("aberto_com") or "").upper().startswith("MXM"): continue
                
                ws.append([
                    r.get("pat_id"), r.get("modulo"), r.get("titulo"), r.get("cliente"),
                    _format_date(r.get("data_abertura")), r.get("prioridade"), r.get("status"),
                    r.get("descricao"), _format_date(r.get("prazo")), r.get("aberto_com"), ""
                ])
                row_idx = ws.max_row
                for col_idx in range(1, len(headers) + 1):
                    ws.cell(row=row_idx, column=col_idx).border = thin_border
                count += 1
                
        if count == 0:
            ws.append(["Nenhum PAT nesta categoria"] + [""] * (len(headers) - 1))
            row_idx = ws.max_row
            ws.merge_cells(start_row=row_idx, start_column=1, end_row=row_idx, end_column=len(headers))
            for col_idx in range(1, len(headers) + 1):
                ws.cell(row=row_idx, column=col_idx).border = thin_border
            ws.cell(row=row_idx, column=1).alignment = Alignment(horizontal="center")
            
        ws.append([""] * len(headers)) # Linha em branco separadora com bordas
        row_idx = ws.max_row
        for col_idx in range(1, len(headers) + 1):
            ws.cell(row=row_idx, column=col_idx).border = thin_border

    # Ajuste simples de largura
    from openpyxl.utils import get_column_letter
    for col_idx in range(1, len(headers) + 1):
        column = get_column_letter(col_idx)
        ws.column_dimensions[column].width = 18

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()

def export_gerencial(data: list, reference_date) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Base WK Atual"
    
    headers = [
        'PAT', 'Sistema', 'Função', 'Usuário', 'Abertura', 'Natureza', 'Status', 'Descrição', 'Prazo', 'Prazo Proposta', 'Encerramento', 'Aberto Com', 'Vazio', 'Dias Em Abert', 'Dias da Prev Entrega', 'S/Ant >=7', 'Novos', 'Encerrados', 'Total', 'Interno', 'MXM', '30 Dias', 'Entre 30 - 60 Dias', '> 60 dias', 'Natureza_2', 'Ref', 'S/ Prazo MXM', 'Apagar > 14 ou Desempen', 'Validador do Aging = 0', 'Natureza_3', 'Naturaza Anterior', 'Prazo_2', 'Data Anterior', 'Prazo Proposta_2', 'Data Anterior_2', 'ADIADO/ATRASADO'
    ]
    
    ws.append(["Consulta de PAT"])
    ws.append([])
    ws.append(headers)
    for c in ws[3]:
        c.font = Font(bold=True)
        
    for r in data:
        ws.append([
            r.get("pat_id"), r.get("modulo"), r.get("titulo"), r.get("cliente"),
            _format_date(r.get("data_abertura")), r.get("prioridade"), r.get("status"),
            r.get("descricao"), _format_date(r.get("prazo")), "", _format_date(r.get("encerramento")),
            r.get("aberto_com")
        ])
        
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()

def export_levantamento(data: list, closed_pats: list, reference_date) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Consulta de PAT"
    
    headers = [
        "PAT", "Sistema", "Função", "Usuário", "Abertura", "Idade", "Idade (em dias)",
        "Natureza", "Status", "Descrição", "Prazo Externo", "Pendente", "Status Prazo",
        "Andamento / Reavaliação", "Responsável pelo PAT", "Usuário Solicitante", "Gerente",
        "Diretor", "Cliente Impactado", "Impacto do Problema", "Medida de Contorno em utilização"
    ]
    
    def fill_sheet(sheet, items):
        sheet.append(["Consulta de PAT"])
        sheet.append([])
        sheet.append(headers)
        for c in sheet[3]:
            c.font = Font(bold=True)
            
        for r in items:
            # calculate Idade em dias
            abertura = r.get("data_abertura")
            idade = ""
            idade_dias = ""
            if abertura and isinstance(abertura, str):
                try:
                    d = datetime.strptime(abertura, "%Y-%m-%d").date()
                    idade_dias = (reference_date - d).days
                except:
                    pass
            elif abertura:
                idade_dias = (reference_date - abertura).days
            
            sheet.append([
                r.get("pat_id"), r.get("modulo"), r.get("titulo"), r.get("cliente"),
                _format_date(r.get("data_abertura")), idade, idade_dias, r.get("prioridade"),
                r.get("status"), r.get("descricao"), _format_date(r.get("prazo")),
                "", "", # Pendente, Status Prazo
                r.get("andamento"), r.get("responsavel_pat"), r.get("usuario_solicitante"),
                r.get("gerente"), r.get("diretor"), r.get("cliente_impactado"),
                r.get("impacto_problema"), r.get("medida_contorno")
            ])
            
    fill_sheet(ws, data)
    
    ws_closed = wb.create_sheet("Fechados")
    fill_sheet(ws_closed, closed_pats)
        
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
