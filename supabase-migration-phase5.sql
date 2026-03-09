-- Phase 5: File attachment support for session validations

-- Add attachment columns to session_validations
ALTER TABLE session_validations
  ADD COLUMN attachment_path TEXT,
  ADD COLUMN attachment_type TEXT;

-- Create storage bucket for session attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-attachments', 'session-attachments', true);

-- RLS: Authenticated users can upload to their own path
CREATE POLICY "Users can upload their own attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'session-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Authenticated users can read all attachments
CREATE POLICY "Authenticated users can read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'session-attachments');

-- RLS: Users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'session-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Users can update their own attachments
CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'session-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
