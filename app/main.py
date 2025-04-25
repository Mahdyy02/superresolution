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
import uuid
from dotenv import load_dotenv

enhance_semaphore = asyncio.Semaphore(5)
active_sessions: dict[str, asyncio.Event] = {}
lock = asyncio.Lock()
load_dotenv()

ALLOWED_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}
ALLOWED_MIME_TYPES = {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac", "audio/ogg", "audio/mp4"}

frontend_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000") 
domain = frontend_url.split("//")[-1].split(":")[0]  
if ":" in domain: domain = domain.split(":")[0]  

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],  
    allow_credentials=True,  
    allow_methods=["GET", "POST", "OPTIONS"],  
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
    request.state.session_id = session_id
    response = await call_next(request)
    # Set cookie with correct attributes
    response.set_cookie(
        key="session_id",
        value=session_id,
        domain=domain,
        path="/",
        samesite="lax",
        secure=False,  
        httponly=True, 
    )

    return response

@app.get("/init-session")
async def init_session(request: Request):
    try:
        # Get existing session_id or create a new one
        session_id = request.cookies.get("session_id")
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Create response
        response = JSONResponse(content={"session_id": session_id})
        
        # Set cookie with correct attributes
        response.set_cookie(
            key="session_id",
            value=session_id,
            domain=domain,  # Match frontend/backend IP
            path="/",
            samesite="lax",  # Use 'lax' for HTTP localhost
            secure=False,  # HTTP on localhost
            httponly=True,  # Prevent JavaScript access for security
        )
        
        return response
    except Exception as e:
        # Log error for debugging
        print(f"Error in init_session: {str(e)}")
        raise

@app.post("/upload")
async def upload_audio(request: Request, file: UploadFile = File(...)):

    session_id = request.cookies.get("session_id")

    upload_dir = f"uploads/audio_{session_id}"
    result_file = f"result/enhanced_audio_{session_id}.wav"

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS or file.content_type not in ALLOWED_MIME_TYPES:
        return JSONResponse(status_code=400, content={"error": "Unsupported file type"})

    if os.path.exists(result_file):
        os.remove(result_file)
    if os.path.exists(upload_dir):
        shutil.rmtree(upload_dir)
    os.makedirs(upload_dir, exist_ok=True)

    safe_name = f"audio_{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(upload_dir, safe_name)

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        audio = AudioSegment.from_file(temp_path)
        
        if audio.channels > 1:
            audio = audio.set_channels(1)

        wav_path = os.path.join(upload_dir, f"audio_{session_id}.wav")
        audio.export(wav_path, format="wav")

        os.remove(temp_path)

        return JSONResponse(content={"message": "Upload and conversion successful", "filename": f"audio_{session_id}.wav"})

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return JSONResponse(status_code=400, content={"error": "Invalid or unsupported audio file"})

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
    
    input_path = f"uploads/audio_{session_id}/audio_{session_id}.wav"

    if not os.path.exists(input_path):
        raise HTTPException(
            status_code=400,
            detail="Audio file not found. Please upload a file before requesting enhancement."
        )
    
    output_filepath = f"result/enhanced_audio_{session_id}.wav"
    if os.path.exists(output_filepath):

        return {
            "message": "Enhancement started",
            "check_status_url": f"/status/{session_id}",
            "download_url": f"/result/enhanced_audio_{session_id}.wav"
        }

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

@app.get("/is-loaded")
async def is_audio_loaded(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return JSONResponse(status_code=400, content={"ready": False, "error": "No session ID in cookies"})

    input_path = f"uploads/audio_{session_id}/audio_{session_id}.wav"
    file_exists = os.path.exists(input_path)

    if file_exists:
        return {"ready": True}
    else:
        return {"ready": False}