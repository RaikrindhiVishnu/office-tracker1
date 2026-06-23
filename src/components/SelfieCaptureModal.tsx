"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, X } from "lucide-react";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadString as sUploadString, getDownloadURL as sGetDownloadURL } from "firebase/storage";

interface Props {
  uid: string;
  onCapture: (photoUrl: string) => void;
  onCancel: () => void;
  title?: string;
}

export default function SelfieCaptureModal({ uid, onCapture, onCancel, title = "Verification" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then(s => {
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(err => {
        console.error("Camera access denied or unavailable", err);
        setError("Camera access is required for verification. Please allow camera permissions.");
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCapturing(false);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

    try {
      const fileName = `attendance_selfies/${uid}_${Date.now()}.jpg`;
      const imgRef = storageRef(storage, fileName);
      await sUploadString(imgRef, dataUrl, 'data_url');
      const photoUrl = await sGetDownloadURL(imgRef);
      onCapture(photoUrl);
    } catch (err) {
      console.error("Failed to upload selfie", err);
      setError("Failed to upload photo. Please try again.");
      setCapturing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
        <button onClick={onCancel} disabled={capturing} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center mb-6 mt-2">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">Please take a quick selfie to verify your identity.</p>
        </div>

        {error ? (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm mb-4 border border-rose-200">
            {error}
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-[3/4] mb-6 shadow-inner">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }} // mirror
            />
            {capturing && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <button 
          onClick={handleCapture}
          disabled={capturing || !!error || !stream}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Camera className="w-6 h-6" />
          {capturing ? "Verifying..." : "Capture & Check In"}
        </button>
      </div>
    </div>
  );
}
