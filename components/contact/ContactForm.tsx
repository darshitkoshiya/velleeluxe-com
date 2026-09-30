'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { isValidEmail } from '@/lib/utils';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const SUBJECT_OPTIONS = [
  { value: 'Order Query', label: 'Order Query' },
  { value: 'Product Question', label: 'Product Question' },
  { value: 'Return & Exchange', label: 'Return & Exchange' },
  { value: 'General', label: 'General' },
];

interface FieldErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot — real visitors never fill this.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = 'Please enter your name.';
    if (!isValidEmail(email)) next.email = 'Please enter a valid email address.';
    if (!subject) next.subject = 'Please choose a subject.';
    if (message.trim().length < 10) next.message = 'Please write a little more (at least 10 characters).';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus('sending');
    setServerError(null);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The API accepts name/email/message; the subject travels as the first line of the message.
        body: JSON.stringify({ name, email, message: `Subject: ${subject}\n\n${message}`, website }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not send your message.');
      }
      setStatus('sent');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setServerError(error instanceof Error ? error.message : 'Could not send your message.');
    }
  };

  if (status === 'sent') {
    return (
      <div className="border border-sand/60 bg-surface p-8 md:p-10" role="status">
        <p className="label-caps text-oxford">Message received</p>
        <p className="mt-4 font-serif text-2xl italic text-ink">Thank you — your message is on its way.</p>
        <p className="mt-3 font-sans text-base leading-relaxed text-ink-muted">
          A member of our team will reply within one working day.
        </p>
        <Button variant="outline" className="mt-8" onClick={() => setStatus('idle')}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
      </div>
      <Select
        label="Subject"
        options={SUBJECT_OPTIONS}
        placeholder="Choose a subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        error={errors.subject}
        required
      />
      <Textarea
        label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        error={errors.message}
        maxLength={2900}
        required
      />
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {serverError ? (
        <p role="alert" className="font-sans text-sm text-accent">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={status === 'sending'}>
        Send Message
      </Button>
    </form>
  );
}

export default ContactForm;
