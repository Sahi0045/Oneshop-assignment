'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Minimize2, Maximize2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useChatSocket } from '@/hooks/use-socket';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { cn, formatRelativeTime } from '@/lib/utils';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface ChatWindowProps {
  conversationId: string;
  recipientName: string;
  recipientAvatar?: string;
  onClose: () => void;
}

export function ChatWindow({ conversationId, recipientName, recipientAvatar, onClose }: ChatWindowProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { emit, on } = useChatSocket();

  useEffect(() => {
    api.get(`/chat/conversations/${conversationId}/messages`).then(r => {
      setMessages(r.data.data ?? []);
    });
  }, [conversationId]);

  useEffect(() => {
    return on<Message>('new_message', (msg) => {
      if (msg.conversationId === conversationId) {
        setMessages(prev => [...prev, msg]);
      }
    });
  }, [on, conversationId]);

  useEffect(() => {
    if (!minimized) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, minimized]);

  const send = () => {
    if (!input.trim()) return;
    emit('send_message', { conversationId, content: input.trim(), type: 'TEXT' });
    setInput('');
  };

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border bg-background shadow-xl flex flex-col',
      minimized ? 'h-14' : 'h-96',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5 rounded-t-xl">
        <UserAvatar firstName={recipientName.split(' ')[0]} lastName={recipientName.split(' ')[1]} src={recipientAvatar} size="xs" />
        <p className="flex-1 text-sm font-semibold text-foreground truncate">{recipientName}</p>
        <button type="button" onClick={() => setMinimized(p => !p)} className="text-muted-foreground hover:text-foreground p-1">
          {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map(msg => (
              <div key={msg.id} className={cn('flex', msg.senderId === user?.id ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-xl px-3 py-2 text-xs',
                  msg.senderId === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="flex gap-1.5 p-2 border-t border-border">
            <Input
              placeholder="Message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              className="h-8 text-xs"
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={!input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
