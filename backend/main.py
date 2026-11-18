from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from db.session import engine, Base
# Import all models to ensure they are registered with Base
from models import orm_models

# Create tables
Base.metadata.create_all(bind=engine)

load_dotenv()

app = FastAPI(title="PAT Tracker API")

# Setup CORS
origins = [
    os.environ.get("FRONTEND_ORIGIN", "http://localhost:8080"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "PAT Tracker API is running"}

from routers import auth, uploads, reports
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])
