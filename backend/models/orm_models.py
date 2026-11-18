from sqlalchemy import Column, Integer, String, Date, Text, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from db.session import Base

class PatUser(Base):
    __tablename__ = "pat_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploads = relationship("PatUpload", back_populates="user")

class PatUpload(Base):
    __tablename__ = "pat_uploads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("pat_users.id"), nullable=True) # Nullable for Phase 1
    file_name = Column(String(500))
    reference_date = Column(Date, nullable=False)
    total_pats = Column(Integer, default=0)
    total_mxm = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('user_id', 'reference_date', name='uq_upload_user_date'),
    )

    user = relationship("PatUser", back_populates="uploads")
    snapshots = relationship("PatSnapshot", back_populates="upload", cascade="all, delete-orphan")


class PatSnapshot(Base):
    __tablename__ = "pat_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_id = Column(Integer, ForeignKey("pat_uploads.id"), nullable=False)
    pat_id = Column(String(50), nullable=False)
    reference_date = Column(Date, nullable=False)
    modulo = Column(String(200))
    titulo = Column(String(500))
    cliente = Column(String(200))
    data_abertura = Column(Date)
    prioridade = Column(String(100))
    status = Column(String(200))
    tipo_prazo = Column(String(100))
    descricao = Column(Text)
    prazo = Column(Date)
    encerramento = Column(Date)
    aberto_com = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_snap_pat_date', 'pat_id', 'reference_date'),
        Index('idx_snap_upload', 'upload_id'),
    )

    upload = relationship("PatUpload", back_populates="snapshots")


class PatAnalysisCache(Base):
    __tablename__ = "pat_analysis_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_recent_id = Column(Integer, ForeignKey("pat_uploads.id"), nullable=False)
    upload_previous_id = Column(Integer, ForeignKey("pat_uploads.id"), nullable=False)
    totals_json = Column(Text)
    pats_json = Column(Text)
    matrix_json = Column(Text)
    week_start = Column(Date)
    week_end = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('upload_recent_id', 'upload_previous_id', name='uq_cache_pair'),
    )

    recent_upload = relationship("PatUpload", foreign_keys=[upload_recent_id])
    previous_upload = relationship("PatUpload", foreign_keys=[upload_previous_id])

class PatManualData(Base):
    __tablename__ = "pat_manual_data"

    pat_id = Column(String(50), primary_key=True)
    andamento = Column(Text)
    responsavel_pat = Column(String(200))
    usuario_solicitante = Column(String(200))
    gerente = Column(String(200))
    diretor = Column(String(200))
    cliente_impactado = Column(String(200))
    impacto_problema = Column(Text)
    medida_contorno = Column(Text)
    override_encerramento = Column(Date, nullable=True)
    override_status = Column(String(200), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PatManualDataHistory(Base):
    __tablename__ = "pat_manual_data_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pat_id = Column(String(50), nullable=False)
    reference_date = Column(Date, nullable=False)
    andamento = Column(Text)
    responsavel_pat = Column(String(200))
    usuario_solicitante = Column(String(200))
    gerente = Column(String(200))
    diretor = Column(String(200))
    cliente_impactado = Column(String(200))
    impacto_problema = Column(Text)
    medida_contorno = Column(Text)
    override_encerramento = Column(Date, nullable=True)
    override_status = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PatEncerrado(Base):
    __tablename__ = "pat_encerrados"

    pat_id = Column(String(50), primary_key=True)
    data_abertura = Column(Date)
    encerramento = Column(Date)
    modulo = Column(String(200))
    titulo = Column(String(500))
    cliente = Column(String(200))
    status = Column(String(200))
    descricao = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
