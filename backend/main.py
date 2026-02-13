from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db

app = FastAPI(title="Claude Code Observability API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/")
def root():
    return {"message": "Claude Code Observability API"}

@app.get("/health")
def health():
    return {"status": "healthy"}