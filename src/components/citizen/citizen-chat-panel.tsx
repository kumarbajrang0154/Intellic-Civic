'use client';

import * as React from 'react';
import { AlertCircle, Loader2, MessageSquare, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface CitizenChatMessage {
  id: string;
  sender: 'citizen' | 'assistant';
  text: string;
  source?: 'gemini' | 'rules';
}

const MAX_MESSAGE_LENGTH = 500;

const QUICK_QUESTIONS = [
  'What is the status of my complaints?',
  'How do I report a new issue and what happens next?',
] as const;

export function CitizenChatMessageBubble({ message }: { message: CitizenChatMessage }) {
  const isCitizen = message.sender === 'citizen';

  return (
    <div
      className={`flex flex-col gap-1 rounded-lg px-3 py-2 text-sm ${
        isCitizen
          ? 'ml-auto max-w-[90%] sm:max-w-[80%] bg-[#3468A1] text-white'
          : 'mr-auto max-w-[95%] sm:max-w-[85%] bg-slate-100 text-slate-900 border border-slate-200'
      }`}
    >
      {!isCitizen && message.source && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Assistant
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-white">
            {message.source === 'gemini' ? 'Gemini AI' : 'Rule Lookup'}
          </Badge>
        </div>
      )}
      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
    </div>
  );
}

export function CitizenChatPanel() {
  const [messages, setMessages] = React.useState<CitizenChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Ask about the status or latest update of your complaints (include a ticket ID like INC-20261112-0001), or ask how reporting works.',
      source: 'rules',
    },
  ]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sendMessage = React.useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || sending) return;

      if (trimmed.length > MAX_MESSAGE_LENGTH) {
        setError(`Question must not exceed ${MAX_MESSAGE_LENGTH} characters.`);
        return;
      }

      setError(null);
      setSending(true);
      setDraft('');

      const citizenMsg: CitizenChatMessage = {
        id: `c-${Date.now()}`,
        sender: 'citizen',
        text: trimmed,
      };
      setMessages((prev) => [...prev, citizenMsg]);

      try {
        const res = await fetch('/api/citizen/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.answer) {
          throw new Error(data?.error || 'Unable to get an assistant reply right now.');
        }

        const assistantMsg: CitizenChatMessage = {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: String(data.answer),
          source: data.source === 'gemini' ? 'gemini' : 'rules',
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reach assistant. Please try again.',
        );
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(draft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(draft);
    }
  };

  return (
    <Card aria-labelledby="citizen-assistant-heading">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle
            id="citizen-assistant-heading"
            className="text-base sm:text-lg flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4 text-[#3468A1] shrink-0" aria-hidden="true" />
            <span>Complaint Assistant</span>
          </CardTitle>
          <span className="text-xs text-slate-500">Scoped to your complaints only</span>
        </div>
        <CardDescription>
          Check complaint progress or reporting steps. Press Enter to send, Shift+Enter for a new line.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <Button
              key={q}
              type="button"
              variant="outline"
              size="sm"
              disabled={sending}
              onClick={() => void sendMessage(q)}
              className="h-auto min-h-[40px] py-1.5 px-2.5 text-xs text-left whitespace-normal"
            >
              {q}
            </Button>
          ))}
        </div>

        <div
          role="log"
          aria-live="polite"
          aria-label="Citizen complaint assistant conversation"
          className="max-h-72 overflow-y-auto space-y-2.5 rounded-lg border border-slate-200 bg-white p-3"
        >
          {messages.map((msg) => (
            <CitizenChatMessageBubble key={msg.id} message={msg} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-slate-500 px-1 py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
              <span>Checking your complaint updates...</span>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="citizen-chat-input"
              className="text-xs font-semibold text-slate-700"
            >
              Ask about your complaint
            </label>
            <span className="text-[11px] text-slate-500">
              {draft.trim().length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              id="citizen-chat-input"
              name="message"
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              placeholder="Ask about a ticket ID (e.g. INC-20261112-0001) or your recent complaints..."
              className="w-full min-h-[56px] resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-base md:text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={sending || draft.trim().length === 0}
              className="h-11 sm:h-auto sm:min-w-[96px] bg-[#3468A1] hover:bg-[#2B5687] text-white shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  <span>Send</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

