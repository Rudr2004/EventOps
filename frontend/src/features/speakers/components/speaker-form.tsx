import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { speakersApi } from '../../../api/speakers.api';
import { FormField } from '../../../components/layout/form-field';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import type { Speaker } from '../../../types/speaker';

interface SpeakerFormProps {
  initialValues?: Partial<Speaker>;
  speakerId?: string;
  onSuccess: (speaker: Speaker) => void;
  onCancel: () => void;
}

export function SpeakerForm({ initialValues, speakerId, onSuccess, onCancel }: SpeakerFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialValues?.name ?? '');
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [email, setEmail] = useState(initialValues?.email ?? '');
  const [bio, setBio] = useState(initialValues?.bio ?? '');

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        title: title || undefined,
        email: email || undefined,
        bio: bio || undefined,
      };
      return speakerId ? speakersApi.update(speakerId, payload) : speakersApi.create(payload);
    },
    onSuccess: (speaker) => {
      queryClient.invalidateQueries({ queryKey: ['speakers'] });
      onSuccess(speaker);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {mutation.isError && <Alert message={extractErrorMessage(mutation.error)} />}
      <FormField id="speaker-name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
      <FormField
        id="speaker-title"
        label="Title / Organization"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <FormField
        id="speaker-email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="form-field">
        <label htmlFor="speaker-bio">Bio</label>
        <textarea id="speaker-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : speakerId ? 'Save changes' : 'Add speaker'}
        </button>
      </div>
    </form>
  );
}
