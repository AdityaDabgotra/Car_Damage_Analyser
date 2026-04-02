'use client';

import { VehicleIcon } from '@/components/icons/VehicleIcon';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Car {
  _id: string;
  brand: string;
  model: string;
  year: number;
}

type UploadStep = 'select-car' | 'upload-video' | 'submitting' | 'queued';

export default function NewClaimPage() {
  const router = useRouter();
  const [step, setStep] = useState<UploadStep>('select-car');
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [showAddCar, setShowAddCar] = useState(false);
  const [newCar, setNewCar] = useState({ brand: '', model: '', year: new Date().getFullYear() });
  const [dragOver, setDragOver] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [claimId, setClaimId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/cars')
      .then(r => r.json())
      .then(d => d.success && setCars(d.data));
  }, []);

  const handleFile = useCallback((file: File) => {
    setError('');
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file (MP4, MOV, etc.)');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('Video must be under 100MB');
      return;
    }
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setStep('upload-video');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  async function addCar() {
    const res = await fetch('/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCar),
    });
    const data = await res.json();
    if (data.success) {
      setCars(prev => [data.data, ...prev]);
      setSelectedCarId(data.data._id);
      setShowAddCar(false);
      setNewCar({ brand: '', model: '', year: new Date().getFullYear() });
    }
  }

  async function handleSubmit() {
    if (!selectedCarId || !videoFile) return;
    setStep('submitting');
    setError('');

    try {
      // Step 1: Get signed upload params
      const signRes = await fetch('/api/upload/sign', { method: 'POST', credentials: 'include' });
      const signData = await signRes.json();
      if (!signData.success) throw new Error('Failed to get upload signature');

      const { signature, timestamp, cloudName, apiKey, folder, eager, transformation } = signData.data;

      // Step 2: Upload to Cloudinary — only append signed params + excluded-but-required fields.
      // resource_type is NOT part of the signature (Cloudinary excludes it from string-to-sign).
      // transformation is signed: Cloudinary applies it as incoming transformation (~360p) before storage.
      const formData = new FormData();
      formData.append('file', videoFile);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);
      formData.append('folder', folder);
      if (eager != null) formData.append('eager', eager);
      if (transformation != null) formData.append('transformation', transformation);
      formData.append('resource_type', 'video');

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 70));
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            let result: { secure_url: string; public_id: string; duration?: number };
            try {
              result = JSON.parse(xhr.responseText);
            } catch {
              reject(new Error('Invalid response from upload service'));
              return;
            }
            setUploadProgress(80);
            fetch('/api/claims', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                carId: selectedCarId,
                videoUrl: result.secure_url,
                videoPublicId: result.public_id,
                videoDuration: result.duration,
              }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.success) {
                  setClaimId(d.data.claimId);
                  setUploadProgress(100);
                  setStep('queued');
                  resolve();
                } else {
                  reject(new Error(d.error?.message ?? 'Failed to create claim'));
                }
              })
              .catch(reject);
          } else {
            let detail = `Cloudinary upload failed (${xhr.status})`;
            try {
              const errBody = JSON.parse(xhr.responseText);
              if (errBody?.error?.message) detail = errBody.error.message;
            } catch {
              /* ignore */
            }
            reject(new Error(detail));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
      setStep('upload-video');
      setUploadProgress(0);
    }
  }

  return (
    <div className="new-claim">
      <div className="page-header">
        <h1>New Claim</h1>
        <p>Upload a video to start AI-powered damage analysis. High-resolution files are optimized to 360p on upload.</p>
      </div>

      {/* Step 1: Select Car */}
      <div className={`step-card ${step !== 'select-car' && step !== 'upload-video' ? 'step-card--done' : ''}`}>
        <div className="step-head">
          <div className="step-num-badge">1</div>
          <div>
            <h2>Select Vehicle</h2>
            <p>Choose which car was damaged</p>
          </div>
        </div>

        {(step === 'select-car' || step === 'upload-video') && (
          <div className="step-body">
            <div className="cars-grid">
              {cars.map(car => (
                <button
                  key={car._id}
                  className={`car-option ${selectedCarId === car._id ? 'car-option--selected' : ''}`}
                  onClick={() => setSelectedCarId(car._id)}
                >
                  <VehicleIcon className="car-icon-svg" size={28} />
                  <span className="car-option-name">{car.brand} {car.model}</span>
                  <span className="car-option-year">{car.year}</span>
                </button>
              ))}
              <button className="car-option car-option--add" onClick={() => setShowAddCar(!showAddCar)}>
                <span className="car-icon-add" aria-hidden>+</span>
                <span>Add Vehicle</span>
              </button>
            </div>

            {showAddCar && (
              <div className="add-car-form">
                <div className="form-row">
                  <input placeholder="Brand (e.g. Toyota)" value={newCar.brand} onChange={e => setNewCar(p => ({ ...p, brand: e.target.value }))} />
                  <input placeholder="Model (e.g. Camry)" value={newCar.model} onChange={e => setNewCar(p => ({ ...p, model: e.target.value }))} />
                  <input type="number" placeholder="Year" value={newCar.year} onChange={e => setNewCar(p => ({ ...p, year: parseInt(e.target.value) }))} />
                </div>
                <div className="form-actions">
                  <button className="btn-add-car" onClick={addCar} disabled={!newCar.brand || !newCar.model}>Add Vehicle</button>
                  <button className="btn-cancel" onClick={() => setShowAddCar(false)}>Cancel</button>
                </div>
              </div>
            )}

            {selectedCarId && step === 'select-car' && (
              <button className="btn-continue" onClick={() => setStep('upload-video')}>
                Continue → Upload Video
              </button>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Upload Video */}
      {(step === 'upload-video' || step === 'submitting') && (
        <div className="step-card">
          <div className="step-head">
            <div className="step-num-badge">2</div>
            <div>
              <h2>Upload Damage Video</h2>
              <p>Max 30 seconds · MP4, MOV, AVI · Saved at 360p</p>
            </div>
          </div>

          <div className="step-body">
            {error && <div className="error-banner">{error}</div>}

            {!videoFile ? (
              <div
                className={`drop-zone ${dragOver ? 'drop-zone--over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <div className="drop-icon">▷</div>
                <p className="drop-main">Drop your video here</p>
                <p className="drop-sub">or click to browse — Max 30 seconds, 100MB · High-res videos are scaled to 360p</p>
              </div>
            ) : (
              <div className="video-preview">
                <video src={videoPreview} controls className="preview-video" />
                <div className="preview-actions">
                  <button className="btn-change" onClick={() => { setVideoFile(null); setVideoPreview(''); }}>
                    ↺ Change video
                  </button>
                  <button
                    className="btn-analyze"
                    onClick={handleSubmit}
                    disabled={step === 'submitting'}
                  >
                    {step === 'submitting' ? (
                      <>
                        <span className="spinner" />
                        {uploadProgress < 75 ? `Uploading ${uploadProgress}%` : 'Creating claim...'}
                      </>
                    ) : '◈ Analyze Damage'}
                  </button>
                </div>
                {step === 'submitting' && (
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Queued */}
      {step === 'queued' && (
        <div className="success-card">
          <div className="success-icon">◈</div>
          <h2>Claim Submitted!</h2>
          <p>Your video is being analyzed by our AI engine. This takes under 30 seconds.</p>
          <div className="success-actions">
            <button className="btn-view-claim" onClick={() => router.push(`/dashboard/claims/${claimId}`)}>
              View Claim Status →
            </button>
            <button className="btn-new-claim" onClick={() => { setStep('select-car'); setVideoFile(null); setVideoPreview(''); setSelectedCarId(''); setClaimId(''); setUploadProgress(0); }}>
              Submit Another
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .new-claim { max-width: 700px; }
        .page-header { margin-bottom: 2rem; }
        h1 { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.03em; color: #f0f4ff; margin-bottom: 0.3rem; }
        .page-header p { color: #6b7280; font-size: 0.9rem; }

        .step-card {
          background: #0d1117;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 1.75rem;
          margin-bottom: 1.25rem;
        }
        .step-card--done { opacity: 0.6; }
        .step-head { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; }
        .step-num-badge {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(74,222,128,0.12); color: #4ade80;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem; font-weight: 800; flex-shrink: 0;
        }
        .step-head h2 { font-size: 1rem; font-weight: 700; color: #f0f4ff; margin-bottom: 0.15rem; }
        .step-head p { font-size: 0.8rem; color: #6b7280; }
        .step-body { display: flex; flex-direction: column; gap: 1rem; }

        .cars-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; }
        .car-option {
          display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
          padding: 1rem 1.25rem; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          color: #9ca3af; font-size: 0.82rem; cursor: pointer;
          transition: all 0.15s; min-width: 100px;
        }
        .car-option:hover { border-color: rgba(74,222,128,0.2); color: #e8eaf0; }
        .car-option:hover .car-option-name { color: #86efac; }
        .car-option--selected { border-color: #4ade80; background: rgba(74,222,128,0.08); color: #4ade80; }
        .car-option--add { border-style: dashed; color: #4b5563; }
        .car-option--add:hover { color: #4ade80; }
        .car-icon-svg { color: #4ade80; flex-shrink: 0; }
        .car-icon-add { font-size: 1.5rem; line-height: 1; font-weight: 300; }
        .car-option-name { font-weight: 600; color: #4ade80; }
        .car-option-year { font-size: 0.75rem; opacity: 0.7; }

        .add-car-form { background: rgba(255,255,255,0.02); border-radius: 10px; padding: 1.25rem; border: 1px solid rgba(255,255,255,0.06); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.75rem; margin-bottom: 0.75rem; }
        input { padding: 0.65rem 0.9rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #f0f4ff; font-size: 0.88rem; outline: none; transition: border-color 0.2s; width: 100%; }
        input:focus { border-color: rgba(74,222,128,0.4); }
        input::placeholder { color: #374151; }
        .form-actions { display: flex; gap: 0.5rem; }
        .btn-add-car { padding: 0.55rem 1.1rem; border-radius: 8px; background: #4ade80; color: #080a0f; font-weight: 700; font-size: 0.85rem; border: none; cursor: pointer; }
        .btn-add-car:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-cancel { padding: 0.55rem 1rem; border-radius: 8px; background: transparent; color: #6b7280; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.08); cursor: pointer; }

        .btn-continue { align-self: flex-start; padding: 0.65rem 1.4rem; border-radius: 8px; background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); font-weight: 600; font-size: 0.88rem; cursor: pointer; transition: all 0.2s; }
        .btn-continue:hover { background: rgba(74,222,128,0.15); }

        .error-banner { padding: 0.75rem 1rem; border-radius: 8px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); color: #f87171; font-size: 0.85rem; }

        .drop-zone {
          border: 2px dashed rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 3.5rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .drop-zone:hover, .drop-zone--over {
          border-color: rgba(74,222,128,0.3);
          background: rgba(74,222,128,0.03);
        }
        .drop-icon { font-size: 3rem; color: #374151; margin-bottom: 1rem; }
        .drop-main { font-size: 1rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.4rem; }
        .drop-sub { font-size: 0.82rem; color: #4b5563; }

        .video-preview { display: flex; flex-direction: column; gap: 1rem; }
        .preview-video { width: 100%; border-radius: 10px; max-height: 280px; background: #000; }
        .preview-actions { display: flex; gap: 0.75rem; }
        .btn-change { padding: 0.6rem 1.1rem; border-radius: 8px; background: transparent; color: #9ca3af; border: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem; cursor: pointer; }
        .btn-analyze {
          flex: 1; padding: 0.75rem; border-radius: 8px; background: #4ade80;
          color: #080a0f; font-weight: 700; font-size: 0.9rem; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: all 0.2s;
        }
        .btn-analyze:hover:not(:disabled) { background: #86efac; }
        .btn-analyze:disabled { opacity: 0.7; cursor: not-allowed; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #080a0f; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .progress-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 2px; background: #4ade80; transition: width 0.3s ease; }

        .success-card {
          background: #0d1117; border: 1px solid rgba(74,222,128,0.2);
          border-radius: 14px; padding: 3rem; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 1rem;
        }
        .success-icon { font-size: 3rem; color: #4ade80; }
        .success-card h2 { font-size: 1.5rem; font-weight: 800; color: #f0f4ff; letter-spacing: -0.02em; }
        .success-card p { color: #6b7280; font-size: 0.9rem; max-width: 360px; line-height: 1.6; }
        .success-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
        .btn-view-claim { padding: 0.7rem 1.4rem; border-radius: 8px; background: #4ade80; color: #080a0f; font-weight: 700; font-size: 0.88rem; border: none; cursor: pointer; }
        .btn-new-claim { padding: 0.7rem 1.2rem; border-radius: 8px; background: transparent; color: #6b7280; font-size: 0.88rem; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
      `}</style>
    </div>
  );
}
