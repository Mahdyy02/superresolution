# Use a CUDA-enabled base image
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

# Set the working directory
WORKDIR /app

# Install Python and other required dependencies
RUN apt-get update && apt-get install -y \
    python3.11 python3-pip python3.11-dev build-essential \
    nvidia-container-toolkit \
    && ln -sf python3.11 /usr/bin/python3 \
    && pip3 install --upgrade pip \
    && apt install -y ffmpeg

# Copy requirements and install them
COPY ./requirements.txt .

# Install Python dependencies (including GPU-enabled torch)
RUN pip install -v -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu121

# Copy the rest of your backend app
COPY . .

# Set up NVIDIA environment variables for GPU support
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Expose FastAPI port
EXPOSE 8000

# Run the FastAPI app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
