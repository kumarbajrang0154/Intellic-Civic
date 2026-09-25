'use client';

import React from 'react';
import { ShieldCheck, Mail, UploadCloud, Loader2, User, Globe, Settings } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AdminProfilePage() {
  const [user, setUser] = React.useState<{
    id?: string;
    name: string;
    role: 'ADMIN' | 'SUPER_ADMIN';
    email?: string;
    avatarUrl?: string | null;
  }>({
    name: 'Super Admin',
    role: 'ADMIN',
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [editName, setEditName] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          const role = data.user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';
          setUser({
            id: data.user.id,
            name: data.user.name || 'Super Admin',
            role,
            email: data.user.email,
            avatarUrl: data.user.avatarUrl || null,
          });
          setAvatarUrl(data.user.avatarUrl || '');
          setEditName(data.user.name || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      let secureUrl = '';
      try {
        const sigRes = await fetch('/api/upload/signature', { method: 'POST' });
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          if (sigData.cloudName && sigData.cloudName !== 'demo' && sigData.apiKey !== '1234567890') {
            const { timestamp, signature, cloudName, apiKey } = sigData;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', apiKey);
            formData.append('timestamp', String(timestamp));
            formData.append('signature', signature);
            const uploadRes = await fetch(
              `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
              { method: 'POST', body: formData },
            );
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              secureUrl = uploadData.secure_url;
            }
          }
        }
      } catch {
        // Cloudinary unavailable, use base64 fallback
      }

      if (!secureUrl) {
        secureUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setAvatarUrl(secureUrl);
      toast.success('Photo uploaded! Click "Save Profile" to persist.');
    } catch (err: any) {
      toast.error('Failed to upload image: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/staff/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      setUser((prev) => ({
        ...prev,
        name: data.profile.name,
        avatarUrl: data.profile.avatarUrl,
      }));
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell user={user}>
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={{ ...user, avatarUrl: avatarUrl || user.avatarUrl }}>
      <div className="space-y-6 p-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Super Admin Profile</h1>
          <p className="text-sm text-slate-500 mt-1">
            System Administrator credentials & platform scope
          </p>
        </div>

        <Card className="border shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center gap-4">
            {/* Avatar */}
            <div className="relative h-16 w-16 rounded-full border-2 border-indigo-200 overflow-hidden bg-indigo-50 flex items-center justify-center shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-indigo-400" />
              )}
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">{user.name}</CardTitle>
              <p className="text-sm text-slate-500">{user.email || 'admin@city.gov'}</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-4 border-t text-sm">
            {/* Profile Picture Upload */}
            <div className="space-y-2">
              <span className="font-semibold text-sm block">Profile Picture</span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="text-xs font-mono flex-1"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs gap-1.5 shrink-0"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5" />
                  )}
                  <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                </Button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="font-semibold block">Display Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Administrator name"
                className="text-sm"
              />
            </div>

            {/* Read-only info */}
            <div className="flex justify-between items-center py-2 border-t">
              <span className="text-slate-500">System Role:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full text-xs">
                {user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-slate-500">Department Scope:</span>
              <span className="font-semibold text-slate-800">Unrestricted (System-Wide)</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">Platform Permissions:</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                Full Governance & Approval Rights
              </span>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
