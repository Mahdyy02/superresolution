from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from uuid import uuid4
import os
import shutil
from fastapi.middleware.cors import CORSMiddleware
from client import Client
from pydub import AudioSegment
from fastapi.staticfiles import StaticFiles
import asyncio

enhance_semaphore = asyncio.Semaphore(5)
active_sessions: dict[str, asyncio.Event] = {}
lock = asyncio.Lock()
 
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/result", StaticFiles(directory="result"), name="result")

@app.get("/result/{filename}")
def download_file(filename: str):
    filepath = f"result/{filename}"

    if os.path.exists(filepath):
        session_id = filename.split("_")[-1].replace(".wav", "")
        upload_dir = f"uploads/audio_{session_id}"

        def file_streamer():
            with open(filepath, mode="rb") as file_like:
                yield from file_like
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                if os.path.exists(upload_dir):
                    shutil.rmtree(upload_dir)
                print(f"[CLEANUP] Removed {filepath} and {upload_dir}")
            except Exception as e:
                print(f"[CLEANUP ERROR] {e}")

        return StreamingResponse(
            file_streamer(),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    session_id = filename.split("_")[-1].replace(".wav", "")
    if session_id in active_sessions:
        return JSONResponse(status_code=202, content={"message": "The file is still being processed. Please try again shortly."})

    raise HTTPException(status_code=404, detail="File not found or enhancement failed.")

@app.get("/status/{session_id}")
async def check_status(session_id: str):
    filepath = f"result/enhanced_audio_{session_id}.wav"
    if os.path.exists(filepath):
        return {"ready": True}
    elif session_id in active_sessions:
        return {"ready": False, "status": "processing"}
    else:
        return {"ready": False, "status": "failed"}

@app.middleware("http")
async def assign_session_id(request: Request, call_next):
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid4())
    response = await call_next(request)
    response.set_cookie("session_id", session_id)
    return response

@app.post("/upload")
async def upload_audio(request: Request, file: UploadFile = File(...)):
    session_id = request.cookies.get("session_id")
    upload_dir = f"uploads/audio_{session_id}"
    result_file = f"result/enhanced_audio_{session_id}.wav"

    # Delete old result file if it exists
    if os.path.exists(result_file):
        os.remove(result_file)

    # Clean up previous upload directory if it exists
    if os.path.exists(upload_dir):
        shutil.rmtree(upload_dir)

    os.makedirs(upload_dir, exist_ok=True)

    temp_path = os.path.join(upload_dir, file.filename)
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        audio = AudioSegment.from_file(temp_path)
        wav_path = os.path.join(upload_dir, f"audio_{session_id}.wav")
        audio.export(wav_path, format="wav")

        os.remove(temp_path)

        return JSONResponse(content={"message": "Upload and conversion successful", "filename": f"audio_{session_id}.wav"})
    except Exception as e:
        os.remove(temp_path)
        return JSONResponse(status_code=400, content={"error": "Unsupported audio format or conversion failed"})


@app.post("/cancel")
async def cancel_enhancement(request: Request):
    session_id = request.cookies.get("session_id")
    cancel_event = active_sessions.get(session_id)

    if cancel_event:
        cancel_event.set()  
        return {"message": "Enhancement cancelled"}
    
    return {"message": "No active enhancement process"}


@app.post("/enhance")
async def enhance_audio(
    request: Request,
    background_tasks: BackgroundTasks,
    quality: str = Form(...),
    output_rate: int = Form(...),
):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return {"error": "No session ID found in cookies"}
    
    output_filepath = f"result/enhanced_audio_{session_id}.wav"
    if os.path.exists(output_filepath):

        return {
            "message": "Enhancement started",
            "check_status_url": f"/status/{session_id}",
            "download_url": f"/result/enhanced_audio_{session_id}.wav"
        }

    input_path = f"uploads/audio_{session_id}/audio_{session_id}.wav"
    quality = quality.lower()

    if session_id in active_sessions:
        raise HTTPException(status_code=429, detail="You already have an ongoing enhancement process.")

    cancel_event = asyncio.Event()
    active_sessions[session_id] = cancel_event

    async def run_enhancement():
        async with enhance_semaphore:
            client = Client(session_id, input_path)
            while not cancel_event.is_set():
                await asyncio.to_thread(client.query, quality=quality, output_rate=output_rate)
                break  # This is just a placeholder, your actual task logic will go here

            async with lock:
                active_sessions.pop(session_id, None)

    background_tasks.add_task(run_enhancement)

    return {
        "message": "Enhancement started",
        "check_status_url": f"/status/{session_id}",
        "download_url": f"/result/enhanced_audio_{session_id}.wav"
    }
