import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { speakersApi } from '../../../api/speakers.api';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Modal } from '../../../components/ui/modal';
import { SpeakerForm } from '../components/speaker-form';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';

export function SpeakersPage() {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const canManage = user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['speakers', { page: 1, limit: 50 }],
    queryFn: () => speakersApi.list({ page: 1, limit: 50 }),
  });

  return (
    <motion.div
      className="speakers-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Speakers</h1>
        {canManage && (
          <button type="button" onClick={() => setIsCreateOpen(true)}>
            Add Speaker
          </button>
        )}
      </div>

      {isLoading && <LoadingState label="Loading speakers…" />}
      {isError && <ErrorState message="Could not load speakers." />}
      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState message="No speakers yet. Add your first one." />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className="speaker-grid">
          {data.items.map((speaker, index) => (
            <motion.div
              key={speaker.id}
              className="speaker-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
              whileHover={{ y: -4 }}
            >
              <div className="speaker-avatar">{speaker.name.charAt(0).toUpperCase()}</div>
              <div className="speaker-info">
                <h3>{speaker.name}</h3>
                {speaker.title && <p className="speaker-title">{speaker.title}</p>}
                {speaker.bio && <p className="speaker-bio">{speaker.bio}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal isOpen={isCreateOpen} title="Add Speaker" onClose={() => setIsCreateOpen(false)}>
        <SpeakerForm onSuccess={() => setIsCreateOpen(false)} onCancel={() => setIsCreateOpen(false)} />
      </Modal>
    </motion.div>
  );
}
