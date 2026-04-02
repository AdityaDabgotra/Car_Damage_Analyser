'use client';

import { VehicleIcon } from '@/components/icons/VehicleIcon';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface Car {
  _id: string;
  brand: string;
  model: string;
  year: number;
  licensePlate?: string;
  color?: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [cars, setCars] = useState<Car[]>([]);
  const [showAddCar, setShowAddCar] = useState(false);
  const [newCar, setNewCar] = useState({ brand: '', model: '', year: new Date().getFullYear(), licensePlate: '', color: '' });
  const [carLoading, setCarLoading] = useState(false);
  const [carError, setCarError] = useState('');
  const [carSuccess, setCarSuccess] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const isCredentials = (session?.user as any)?.provider !== 'google';

  useEffect(() => {
    fetch('/api/cars').then(r => r.json()).then(d => d.success && setCars(d.data));
  }, []);

  async function addCar() {
    setCarError(''); setCarSuccess(''); setCarLoading(true);
    const res = await fetch('/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCar),
    });
    const data = await res.json();
    setCarLoading(false);
    if (data.success) {
      setCars(prev => [data.data, ...prev]);
      setShowAddCar(false);
      setNewCar({ brand: '', model: '', year: new Date().getFullYear(), licensePlate: '', color: '' });
      setCarSuccess('Vehicle added successfully');
      setTimeout(() => setCarSuccess(''), 3000);
    } else {
      setCarError(data.error?.message ?? 'Failed to add vehicle');
    }
  }

  async function deleteCar(id: string) {
    if (!confirm('Delete this vehicle? This will not delete associated claims.')) return;
    const res = await fetch(`/api/cars/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) setCars(prev => prev.filter(c => c._id !== id));
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(''); setPwSuccess(''); setPwLoading(true);
    const res = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pwForm),
    });
    const data = await res.json();
    setPwLoading(false);
    if (data.success) {
      setPwSuccess('Password updated successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPwSuccess(''), 4000);
    } else {
      setPwError(data.error?.message ?? 'Password change failed');
    }
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Profile</h1>
        <p>Manage your account and vehicles</p>
      </div>

      {/* Account Info */}
      <div className="card">
        <h2>Account Information</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Name</span>
            <span className="info-value">{session?.user?.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Email</span>
            <span className="info-value">{session?.user?.email}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Sign-in Method</span>
            <span className="info-value">
              {(session?.user as any)?.provider === 'google' ? '🔵 Google OAuth' : '🔑 Email & Password'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Role</span>
            <span className="info-value role-badge">{(session?.user as any)?.role ?? 'user'}</span>
          </div>
        </div>
      </div>

      {/* Vehicles */}
      <div className="card">
        <div className="card-header">
          <h2>My Vehicles</h2>
          <button className="btn-add" onClick={() => setShowAddCar(!showAddCar)}>
            {showAddCar ? '✕ Cancel' : '+ Add Vehicle'}
          </button>
        </div>

        {carSuccess && <div className="success-msg">{carSuccess}</div>}
        {carError && <div className="error-msg">{carError}</div>}

        {showAddCar && (
          <div className="add-car-form">
            <div className="form-grid">
              <div className="field">
                <label>Brand *</label>
                <input placeholder="Toyota" value={newCar.brand} onChange={e => setNewCar(p => ({ ...p, brand: e.target.value }))} />
              </div>
              <div className="field">
                <label>Model *</label>
                <input placeholder="Camry" value={newCar.model} onChange={e => setNewCar(p => ({ ...p, model: e.target.value }))} />
              </div>
              <div className="field">
                <label>Year *</label>
                <input type="number" value={newCar.year} onChange={e => setNewCar(p => ({ ...p, year: parseInt(e.target.value) }))} />
              </div>
              <div className="field">
                <label>License Plate</label>
                <input placeholder="ABC-1234" value={newCar.licensePlate} onChange={e => setNewCar(p => ({ ...p, licensePlate: e.target.value }))} />
              </div>
              <div className="field">
                <label>Color</label>
                <input placeholder="White" value={newCar.color} onChange={e => setNewCar(p => ({ ...p, color: e.target.value }))} />
              </div>
            </div>
            <button className="btn-submit-car" onClick={addCar} disabled={carLoading || !newCar.brand || !newCar.model}>
              {carLoading ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        )}

        {cars.length === 0 && !showAddCar ? (
          <div className="empty-cars">
            <VehicleIcon className="empty-cars-icon" size={40} />
            <p>No vehicles registered yet</p>
          </div>
        ) : (
          <div className="cars-list">
            {cars.map(car => (
              <div key={car._id} className="car-item">
                <div className="car-icon-wrap">
                  <VehicleIcon size={24} />
                </div>
                <div className="car-details">
                  <span className="car-name">{car.brand} {car.model}</span>
                  <span className="car-sub">
                    {car.year}{car.color ? ` · ${car.color}` : ''}{car.licensePlate ? ` · ${car.licensePlate}` : ''}
                  </span>
                </div>
                <button className="btn-delete" onClick={() => deleteCar(car._id)} title="Delete vehicle">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Password - credentials only */}
      <div className="card">
        <h2>Security</h2>
        {!isCredentials ? (
          <div className="oauth-notice">
            <span>🔵</span>
            <p>You signed in with Google. Password management is handled by your Google account.</p>
          </div>
        ) : (
          <form onSubmit={changePassword} className="pw-form">
            {pwError && <div className="error-msg">{pwError}</div>}
            {pwSuccess && <div className="success-msg">{pwSuccess}</div>}
            <div className="field">
              <label>Current Password</label>
              <input
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>New Password</label>
              <input
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="Minimum 8 characters, 1 uppercase, 1 number"
                required
              />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn-change-pw" disabled={pwLoading}>
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .profile-page { max-width: 700px; display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { margin-bottom: 0.5rem; }
        h1 { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.03em; color: #f0f4ff; margin-bottom: 0.25rem; }
        .page-header p { color: #6b7280; font-size: 0.9rem; }

        .card { background: #0d1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.75rem; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
        h2 { font-size: 1rem; font-weight: 700; color: #f0f4ff; margin-bottom: 1.25rem; }
        .card-header h2 { margin-bottom: 0; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .info-item { display: flex; flex-direction: column; gap: 0.3rem; }
        .info-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; font-weight: 600; }
        .info-value { font-size: 0.9rem; color: #e8eaf0; }
        .role-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 5px; background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); font-size: 0.78rem; font-weight: 700; width: fit-content; text-transform: uppercase; }

        .btn-add { padding: 0.5rem 1rem; border-radius: 7px; background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); font-size: 0.82rem; font-weight: 600; cursor: pointer; }

        .success-msg { padding: 0.65rem 1rem; border-radius: 8px; background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.2); color: #4ade80; font-size: 0.83rem; margin-bottom: 1rem; }
        .error-msg { padding: 0.65rem 1rem; border-radius: 8px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); color: #f87171; font-size: 0.83rem; margin-bottom: 1rem; }

        .add-car-form { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        label { font-size: 0.78rem; font-weight: 600; color: #9ca3af; }
        input { padding: 0.65rem 0.9rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #f0f4ff; font-size: 0.88rem; outline: none; transition: border-color 0.2s; width: 100%; font-family: inherit; }
        input:focus { border-color: rgba(74,222,128,0.4); }
        input::placeholder { color: #374151; }
        .btn-submit-car { padding: 0.6rem 1.25rem; border-radius: 8px; background: #4ade80; color: #080a0f; font-weight: 700; font-size: 0.85rem; border: none; cursor: pointer; }
        .btn-submit-car:disabled { opacity: 0.5; cursor: not-allowed; }

        .empty-cars { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2rem; color: #6b7280; font-size: 0.9rem; }
        .empty-cars-icon { color: #374151; opacity: 0.9; }

        .cars-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .car-item { display: flex; align-items: center; gap: 0.9rem; padding: 0.85rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 9px; }
        .car-icon-wrap { display: flex; align-items: center; justify-content: center; color: #4ade80; flex-shrink: 0; }
        .car-details { flex: 1; min-width: 0; }
        .car-name { display: block; font-size: 0.9rem; font-weight: 600; color: #4ade80; }
        .car-sub { display: block; font-size: 0.75rem; color: #6b7280; margin-top: 0.1rem; }
        .btn-delete { background: none; border: none; color: #374151; cursor: pointer; padding: 0.3rem; font-size: 0.85rem; border-radius: 5px; transition: color 0.15s; }
        .btn-delete:hover { color: #f87171; }

        .oauth-notice { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .oauth-notice p { font-size: 0.85rem; color: #9ca3af; }

        .pw-form { display: flex; flex-direction: column; gap: 1rem; }
        .btn-change-pw { align-self: flex-start; padding: 0.65rem 1.4rem; border-radius: 8px; background: #4ade80; color: #080a0f; font-weight: 700; font-size: 0.88rem; border: none; cursor: pointer; }
        .btn-change-pw:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 600px) {
          .info-grid { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
