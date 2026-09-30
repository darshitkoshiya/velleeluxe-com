'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { isValidEmail } from '@/lib/utils';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot — real visitors never fill this.
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [status, setStatus] = useState<Status>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Please enter your name.';
    if (!isValidEmail(email)) next.email = 'Please enter a valid email address.';
    if (message.trim().length < 10) next.message = 'Please write a little more (at least 10 characters).';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus('sending');
    setServerError(null);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not send your message.');
      }
      setStatus('sent');
      setName('');
      setEmail('');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setServerError(error instanceof Error ? error.message : 'Could not send your message.');
    }
  };

  if (status === 'sent') {
    return (
      <div className="border border-sand p-8" role="status">
        <p className="font-serif text-xl italic text-ink">Thank you — your message is on its way.</p>
        <p className="mt-2 font-serif text-slateGrey">We respond within 24 hours.</p>
        <Button variant="outline" className="mt-6" onClick={() => setStatus('idle')}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
      <Textarea
        label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        error={errors.message}
        maxLength={3000}
        required
      />
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {serverError ? (
        <p role="alert" className="font-sans text-sm text-persimmon">
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
