import io
import re
from datetime import datetime, date
import openpyxl
import xlrd

def _parse_date(date_str: str) -> date | None:
    if not date_str:
        return None
    match = re.search(r"(\d{2})\s*[/-]\s*(\d{2})\s*[/-]\s*(\d{2,4})", str(date_str))
    if match:
        year_str = match.group(3)
        year = int(year_str)
        if len(year_str) == 2:
            year += 2000
        try:
            return date(year, int(match.group(2)), int(match.group(1)))
        except ValueError:
            return None
    return None

def _get_sheet_rows(file_bytes: bytes) -> list[list]:
    # Try openpyxl first (.xlsx)
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        rows = []
        for r in range(1, sheet.max_row + 1):
            row_data = []
            for c in range(1, sheet.max_column + 1):
                row_data.append(sheet.cell(row=r, column=c).value)
            rows.append(row_data)
        wb.close()
        return rows
    except Exception:
        pass
        
    # Fallback to xlrd (.xls)
    try:
        wb = xlrd.open_workbook(file_contents=file_bytes)
        sheet = wb.sheet_by_index(0)
        rows = []
        for r in range(sheet.nrows):
            row_data = []
            for c in range(sheet.ncols):
                cell_val = sheet.cell_value(r, c)
                cell_type = sheet.cell_type(r, c)
                # xlrd stores dates as floats. convert if it's a date
                if cell_type == xlrd.XL_CELL_DATE:
                    try:
                        dt_tuple = xlrd.xldate_as_tuple(cell_val, wb.datemode)
                        cell_val = date(dt_tuple[0], dt_tuple[1], dt_tuple[2])
                    except Exception:
                        pass
                row_data.append(cell_val)
            rows.append(row_data)
        return rows
    except Exception as e:
        # Fallback for HTML tables disguised as XLS (common in legacy systems)
        content = file_bytes.decode('latin-1', errors='ignore')
        if '<table' in content[:2000].lower():
            from html.parser import HTMLParser
            class HTMLTableParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.rows = []
                    self.current_row = []
                    self.in_cell = False
                    self.current_data = []
                def handle_starttag(self, tag, attrs):
                    if tag == 'tr':
                        self.current_row = []
                    elif tag in ('td', 'th'):
                        self.in_cell = True
                        self.current_data = []
                def handle_endtag(self, tag):
                    if tag == 'tr':
                        self.rows.append(self.current_row)
                    elif tag in ('td', 'th'):
                        self.in_cell = False
                        self.current_row.append(" ".join(self.current_data).strip())
                def handle_data(self, data):
                    if self.in_cell:
                        self.current_data.append(data)
            
            parser = HTMLTableParser()
            try:
                parser.feed(content)
                if parser.rows:
                    return parser.rows
            except Exception:
                pass
                
        print(f"Error reading file: {e}")
        return []

def extract_date_from_a2(file_bytes: bytes) -> date | None:
    rows = _get_sheet_rows(file_bytes)
    if len(rows) >= 2 and len(rows[1]) >= 1:
        a2_val = rows[1][0]
        if isinstance(a2_val, str) and "Emitido em" in a2_val:
            return _parse_date(a2_val)
    return None

def validate_headers(file_bytes: bytes) -> bool:
    rows = _get_sheet_rows(file_bytes)
    if len(rows) < 3:
        return False
    headers = [str(v).strip().lower() if v else "" for v in rows[2][:12]]
    if len(headers) >= 12 and "pat" in headers[0] and "sistema" in headers[1]:
        return True
    return False

def read_pat_rows(file_bytes: bytes) -> list[dict]:
    rows_data = _get_sheet_rows(file_bytes)
    out_rows = []
    # Data starts at index 3 (row 4 in excel)
    for r in range(3, len(rows_data)):
        row = rows_data[r]
        if not row or not row[0]:
            continue
            
        def get_val(idx):
            if idx >= len(row): return None
            val = row[idx]
            if val is None or str(val).strip() == "":
                return None
            return str(val).strip()

        def get_date(idx):
            if idx >= len(row): return None
            val = row[idx]
            if isinstance(val, datetime):
                return val.date()
            if isinstance(val, date):
                return val
            if isinstance(val, str):
                return _parse_date(val)
            return None

        row_dict = {
            "pat_id": str(row[0]).strip(),
            "modulo": get_val(1),
            "titulo": get_val(2),
            "cliente": get_val(3),
            "data_abertura": get_date(4),
            "prioridade": get_val(5),
            "status": get_val(6),
            "tipo_prazo": get_val(7),
            "descricao": get_val(8),
            "prazo": get_date(9),
            "encerramento": get_date(10),
            "aberto_com": get_val(11)
        }
        out_rows.append(row_dict)
    
    return out_rows

def read_levantamento_manual_data(file_bytes: bytes) -> list[dict]:
    rows_data = _get_sheet_rows(file_bytes)
    out_rows = []
    # Data starts at index 3 (row 4 in excel)
    for r in range(3, len(rows_data)):
        row = rows_data[r]
        if not row or not row[0]:
            continue
            
        def get_val(idx):
            if idx >= len(row): return ""
            val = row[idx]
            if val is None: return ""
            return str(val).strip()

        # Columns: 13(N) to 20(U)
        row_dict = {
            "pat_id": str(row[0]).strip(),
            "andamento": get_val(13),
            "responsavel_pat": get_val(14),
            "usuario_solicitante": get_val(15),
            "gerente": get_val(16),
            "diretor": get_val(17),
            "cliente_impactado": get_val(18),
            "impacto_problema": get_val(19),
            "medida_contorno": get_val(20)
        }
        
        # Only add if at least one manual field is filled
        if any(v for k, v in row_dict.items() if k != "pat_id"):
            out_rows.append(row_dict)
            
    return out_rows
