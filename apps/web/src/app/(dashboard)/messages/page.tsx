'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, MessageSquare, Search, Circle } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { useChatSocket } from '@/hooks/use-socket';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatRelativeTime } from '@/lib/utils';

interface Conversation {
  id: string;
  type: string;
  lastMessageAt: string | null;
  participants: Array<{ userId: string; user: { id: string; firstName: string; lastName: string; avatar?: string; isVerified?: boolean } }>;
  messages: Array<{ id: string; content: string; senderId: string; createdAt: string; type: string }>;
  unreadCount?: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: string;
}

function ConversationItem({ conv, isActive, currentUserId, onClick }: {
  conv: Conversation; isActive: boolean; currentUserId: string; onClick: () => void;
}) {
  const other = conv.participants.find(p => p.userId !== currentUserId)?.user;
  const lastMsg = conv.messages?.[conv.messages.length - 1];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors',
        isActive && 'bg-accent',
      )}
    >
      <UserAvatar src={other?.avatar} firstName={other?.firstName ?? '?'} lastName={other?.lastName ?? ''} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{other?.firstName} {other?.lastName}</p>
          {lastMsg && <span className="text-xs text-muted-foreground shrink-0">{formatRelativeTime(lastMsg.createdAt)}</span>}
        </div>
        {lastMsg && <p className="text-xs text-muted-foreground truncate">{lastMsg.content}</p>}
      </div>
      {(conv.unreadCount ?? 0) > 0 && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {conv.unreadCount}
        </span>
      )}
    </button>
  );
}

function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[70%] rounded-2xl px-4 py-2.5 text-sm',
        isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm',
      )}>
        <p className="leading-relaxed">{msg.content}</p>
        <p className={cn('text-[10px] mt-1', isOwn ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground')}>
          {formatRelativeTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { emit, on, isConnected } = useChatSocket();

  const { data: convsData, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/chat/conversations').then(r => r.data.data as Conversation[]),
    enabled: !!user,
  });

  const conversations = (convsData ?? []).filter(c => {
    if (!search) return true;
    const other = c.participants.find(p => p.userId !== user?.id)?.user;
    return `${other?.firstName} ${other?.lastName}`.toLowerCase().includes(search.toLowerCase());
  });

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvId) return;
    api.get(`/chat/conversations/${activeConvId}/messages`).then(r => {
      setMessages(r.data.data ?? []);
    });
  }, [activeConvId]);

  // Socket: receive new messages
  useEffect(() => {
    return on<Message>('new_message', (msg) => {
      if (msg.conversationId === activeConvId) {
        setMessages(prev => [...prev, msg]);
      }
    });
  }, [on, activeConvId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pre-select conversation from query param
  useEffect(() => {
    const convId = searchParams.get('conversationId');
    if (convId) setActiveConvId(convId);
  }, [searchParams]);

  const sendMessage = () => {
    if (!input.trim() || !activeConvId) return;
    emit('send_message', { conversationId: activeConvId, content: input.trim(), type: 'TEXT' });
    setInput('');
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const otherUser = activeConv?.participants.find(p => p.userId !== user?.id)?.user;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col bg-background">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-foreground mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <ConversationItem key={conv.id} conv={conv} isActive={conv.id === activeConvId}
                currentUserId={user?.id ?? ''} onClick={() => setActiveConvId(conv.id)} />
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div><p className="font-semibold text-foreground">Select a conversation</p>
              <p className="text-sm text-muted-foreground mt-1">Choose a conversation from the left to start messaging.</p></div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background">
              {otherUser && <UserAvatar src={otherUser.avatar} firstName={otherUser.firstName} lastName={otherUser.lastName} size="sm" />}
              <div>
                <p className="font-semibold text-foreground">{otherUser?.firstName} {otherUser?.lastName}</p>
                <p className={cn('text-xs flex items-center gap-1', isConnected ? 'text-green-500' : 'text-muted-foreground')}>
                  <Circle className="h-2 w-2 fill-current" />
                  {isConnected ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} isOwn={msg.senderId === user?.id} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-background">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  className="flex-1"
                />
                <Button onClick={sendMessage} disabled={!input.trim()} size="icon" aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
