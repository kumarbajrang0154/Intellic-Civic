'use client';

import * as React from 'react';
import { Mail, Building2, Shield, Wrench, UploadCloud, Loader2, User } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function FieldWorkerProfilePage() {
  const [user, setUser] = React.useState<{
    id?: string;
    name: string;
    role: 'FIELD_WORKER';
    email?: string;
    departmentId?: string;
    avatarUrl?: string | null;
  }>({
    name: 'Field Worker',
    role: 'FIELD_WORKER',
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
          setUser({
            id: data.user.id,
            name: data.user.name || 'Field Worker',
            role: 'FIELD_WORKER',
            email: data.user.email,
            departmentId: data.user.departmentId,
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
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Field Worker Profile</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your Field Worker account details and profile picture.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative h-16 w-16 rounded-full border-2 border-cyan-300 overflow-hidden bg-cyan-50 flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-cyan-400" />
                )}
              </div>
              <div>
                <CardTitle className="text-base font-bold">{user.name}</CardTitle>
                <Badge variant="outline" className="text-xs mt-1 border-cyan-300 text-cyan-700 bg-cyan-50">
                  FIELD WORKER
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-5 text-xs">
            {/* Profile Picture Upload */}
            <div className="border-t pt-4 space-y-2">
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
                placeholder="Your full name"
                className="text-sm"
              />
            </div>

            {/* Email */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold block">Email Address</span>
                <span className="text-muted-foreground">{user.email || 'worker@city.gov.in'}</span>
              </div>
            </div>

            {/* Department */}
            <div className="flex items-center gap-3 pt-2">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold block">Department</span>
                <span className="text-muted-foreground">{user.departmentId || 'Assigned Department'}</span>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-center gap-3 pt-2">
              <Wrench className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-semibold block">Role</span>
                <span className="text-cyan-700 font-semibold">Field Worker — On-Ground Operations</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-3 border-t flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
