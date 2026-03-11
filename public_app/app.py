import json
import queue
import re
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from pipeline import REPORT_VERSION, run_pipeline
from storage import Storage


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
JOBS_DIR = DATA_DIR / "jobs"
DB_PATH = DATA_DIR / "movieglobe.db"

storage = Storage(DB_PATH)
job_queue = queue.Queue()
worker_thread = None


def normalize_douban_id(raw_value):
    value = (raw_value or "").strip()
    if not value:
        raise ValueError("Please enter a Douban ID or profile URL.")

    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 2 and parts[0] == "people":
            value = parts[1]

    if not re.fullmatch(r"[A-Za-z0-9_-]{3,64}", value):
        raise ValueError("Douban ID format looks invalid.")
    return value


def job_response(job):
    return {
        "job_id": job["id"],
        "douban_id": job["douban_id"],
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
        "error": job["error"],
        "report_url": f"/reports/{job['douban_id']}" if job["status"] == "ready" else None,
    }


def worker_loop():
    while True:
        job_id = job_queue.get()
        if job_id is None:
            break

        job = storage.get_job(job_id)
        if not job:
            job_queue.task_done()
            continue

        douban_id = job["douban_id"]
        work_dir = JOBS_DIR / douban_id

        def update_progress(percent, message):
            storage.update_job(job_id, status="processing", progress=percent, message=message, error=None)

        try:
            update_progress(1, "Preparing report workspace.")
            report = run_pipeline(douban_id, work_dir, progress_callback=update_progress)
            storage.save_report(report)
            storage.update_job(
                job_id,
                status="ready",
                progress=100,
                message="Report completed successfully.",
                error=None,
            )
        except Exception as exc:
            storage.update_job(
                job_id,
                status="failed",
                progress=100,
                message="Report generation failed.",
                error=str(exc),
            )
        finally:
            job_queue.task_done()


@asynccontextmanager
async def lifespan(app):
    global worker_thread
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    storage.mark_processing_jobs_failed()
    worker_thread = threading.Thread(target=worker_loop, daemon=True)
    worker_thread.start()
    try:
        yield
    finally:
        job_queue.put(None)
        if worker_thread:
            worker_thread.join(timeout=2)


app = FastAPI(title="Movie Globe Public App", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


class CreateReportPayload(BaseModel):
    douban_id: str


@app.get("/healthz")
def healthcheck():
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
        },
    )


@app.post("/api/reports")
def create_report(payload: CreateReportPayload):
    try:
        douban_id = normalize_douban_id(payload.douban_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    existing_report = storage.get_report(douban_id)
    if (
        existing_report
        and existing_report.get("movie_count", 0) > 0
        and existing_report.get("payload", {}).get("report_version") == REPORT_VERSION
    ):
        return {
            "status": "ready",
            "douban_id": douban_id,
            "report_url": f"/reports/{douban_id}",
        }

    active_job = storage.get_active_job(douban_id)
    if active_job:
        return job_response(active_job)

    job = storage.create_job(douban_id)
    job_queue.put(job["id"])
    return job_response(job)


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job_response(job)


@app.get("/api/reports/{douban_id}")
def get_report(douban_id: str):
    report = storage.get_report(douban_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return JSONResponse(report["payload"])


@app.get("/reports/{douban_id}", response_class=HTMLResponse)
def report_page(request: Request, douban_id: str):
    report = storage.get_report(douban_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    return templates.TemplateResponse(
        "report.html",
        {
            "request": request,
            "report_json": json.dumps(report["payload"], ensure_ascii=False),
            "report_title": report["payload"].get("title") or f"Movie Globe for {douban_id}",
        },
    )
