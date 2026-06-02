import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Globe, ImageIcon, Plus, RotateCcw, UserCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { speakerApi } from '../../lib/speakerApi';
import type { SpeakerUpsertRequest } from '../../types/speaker';

type SettingsTab = 'add-speaker' | 'api-contract';
type SpeakerMode = 'create' | 'update';

const initialFormState = {
  speakerId: '',
  name: '',
  bio: '',
  websiteUrl: '',
  profileImageUrl: '',
};

const tabButtonClass = (active: boolean) =>
  active
    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50';

const cleanOptionalString = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('add-speaker');
  const [speakerMode, setSpeakerMode] = useState<SpeakerMode>('create');
  const [form, setForm] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const payload = useMemo<SpeakerUpsertRequest>(() => ({
    name: form.name.trim(),
    bio: cleanOptionalString(form.bio),
    websiteUrl: cleanOptionalString(form.websiteUrl),
    profileImageUrl: cleanOptionalString(form.profileImageUrl),
  }), [form.bio, form.name, form.profileImageUrl, form.websiteUrl]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!payload.name) {
        throw new Error('Speaker name is required.');
      }

      if (speakerMode === 'create') {
        return speakerApi.createSpeaker(payload);
      }

      const speakerId = form.speakerId.trim();
      if (!speakerId) {
        throw new Error('Speaker ID is required when updating an existing speaker.');
      }

      return speakerApi.updateSpeaker(speakerId, payload);
    },
    onSuccess: (speaker) => {
      queryClient.invalidateQueries({ queryKey: ['speakers'] });
      queryClient.invalidateQueries({ queryKey: ['speakerProfile', speaker.id] });
      setSuccessMessage(
        speakerMode === 'create'
          ? `Speaker ${speaker.name} was created successfully.`
          : `Speaker ${speaker.name} was updated successfully.`
      );
      setForm(initialFormState);
      setSpeakerMode('create');
      navigate(`/speaker/${speaker.id}`);
    },
    onError: (error: unknown) => {
      setSuccessMessage(null);
      setFormError(error instanceof Error ? error.message : 'Unable to save speaker.');
    },
  });

  const handleChange = (field: keyof typeof initialFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    await upsertMutation.mutateAsync();
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Tenant Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Settings</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Add or update speaker records directly from the tenant admin area using the backend speaker endpoints.
          </p>
        </div>
        <Button
          variant="outline"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={() => navigate('/admin')}
        >
          Back to dashboard
        </Button>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setActiveTab('add-speaker')} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${tabButtonClass(activeTab === 'add-speaker')}`}>
          Add Speaker
        </button>
        <button type="button" onClick={() => setActiveTab('api-contract')} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${tabButtonClass(activeTab === 'api-contract')}`}>
          API Contract
        </button>
      </div>

      {activeTab === 'add-speaker' ? (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden border-slate-200/70 bg-white/95 shadow-soft">
            <CardHeader className="border-b border-slate-100 pb-5 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <UserCircle2 className="h-5 w-5 text-primary-600" />
                Add Speaker
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <div className="mb-6 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setSpeakerMode('create')}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${speakerMode === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Create new speaker
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerMode('update')}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${speakerMode === 'update' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Update existing speaker
                </button>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {speakerMode === 'update' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Speaker ID</label>
                    <Input
                      value={form.speakerId}
                      onChange={(event) => handleChange('speakerId', event.target.value)}
                      placeholder="Existing speaker UUID"
                      autoComplete="off"
                    />
                    <p className="text-xs text-slate-500">
                      Required for updates. The backend should expose <span className="font-medium text-slate-700">PUT /api/v1/speaker/{'{'}speaker_Id{'}'}</span>.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Speaker name</label>
                  <Input
                    value={form.name}
                    onChange={(event) => handleChange('name', event.target.value)}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(event) => handleChange('bio', event.target.value)}
                    placeholder="Short speaker bio or role summary"
                    rows={5}
                    className="flex min-h-[120px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Website URL</label>
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={form.websiteUrl}
                        onChange={(event) => handleChange('websiteUrl', event.target.value)}
                        placeholder="https://example.com"
                        className="pl-10"
                        autoComplete="url"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Profile image URL</label>
                    <div className="relative">
                      <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={form.profileImageUrl}
                        onChange={(event) => handleChange('profileImageUrl', event.target.value)}
                        placeholder="https://cdn.example.com/speaker.jpg"
                        className="pl-10"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button type="submit" loading={upsertMutation.isPending} icon={<Plus className="h-4 w-4" />}>
                    {speakerMode === 'create' ? 'Create speaker' : 'Update speaker'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForm(initialFormState);
                      setSpeakerMode('create');
                      setFormError(null);
                      setSuccessMessage(null);
                    }}
                  >
                    Reset form
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200/70 bg-white/95 shadow-soft">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">What gets saved</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span><span className="font-medium text-slate-900">name</span> is required and used everywhere the speaker appears.</span>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span><span className="font-medium text-slate-900">bio</span>, <span className="font-medium text-slate-900">websiteUrl</span>, and <span className="font-medium text-slate-900">profileImageUrl</span> are optional.</span>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>Successful saves navigate to the speaker profile page so you can verify the result immediately.</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-soft">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-white">Backend dependency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-200">
                <p>This form is wired for the following backend endpoints:</p>
                <p className="rounded-xl bg-white/10 px-4 py-3 font-mono text-xs leading-6 text-slate-100">
                  POST /api/v1/speaker
                  <br />
                  PUT /api/v1/speaker/{'{'}speaker_Id{'}'}
                </p>
                <p className="text-slate-300">
                  If the backend still only exposes the read-only speaker profile endpoint, the form will compile but the mutations will fail until those routes are implemented.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-slate-200/70 bg-white/95 shadow-soft">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Speaker create endpoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">POST /api/v1/speaker</p>
                <p className="mt-2 text-slate-700">Create a speaker record for the current tenant.</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Request body</p>
                <ul className="mt-2 space-y-2">
                  <li><span className="font-medium text-slate-900">name</span>: required speaker display name.</li>
                  <li><span className="font-medium text-slate-900">bio</span>: optional short biography or role summary.</li>
                  <li><span className="font-medium text-slate-900">websiteUrl</span>: optional public website or social profile.</li>
                  <li><span className="font-medium text-slate-900">profileImageUrl</span>: optional avatar/profile image URL.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-900">Expected response</p>
                <p className="mt-2">Return the created speaker profile so the UI can navigate to the profile page without a second fetch.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/70 bg-white/95 shadow-soft">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Speaker update endpoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">PUT /api/v1/speaker/{'{'}speaker_Id{'}'}</p>
                <p className="mt-2 text-slate-700">Update an existing speaker in the current tenant by ID.</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Request body</p>
                <p className="mt-2">Use the same payload as create. The ID is provided in the path and should not be duplicated in the body.</p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Error handling</p>
                <ul className="mt-2 space-y-2">
                  <li><span className="font-medium text-slate-900">400</span>: validation failure.</li>
                  <li><span className="font-medium text-slate-900">401</span>: not authenticated.</li>
                  <li><span className="font-medium text-slate-900">403</span>: authenticated but not allowed to manage speakers.</li>
                  <li><span className="font-medium text-slate-900">404</span>: speaker ID not found.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
