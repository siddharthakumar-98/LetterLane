'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, identity } from './api';
import type { Action, RoomView } from '../game/types';
export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState<number | null>(null);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const offset = useRef(0);
  const inFlight = useRef(false);
  const accept = useCallback((next: RoomView) => {
    offset.current = next.serverTime - Date.now();
    setRoom((previous) =>
      !previous || next.revision >= previous.revision ? next : previous,
    );
    setConnected(true);
    setFatal(null);
    setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      accept(await api<RoomView>(`/api/rooms/${code}`));
    } catch (error) {
      if (
        error instanceof ApiError &&
        [403, 404, 410, 422].includes(error.status)
      ) {
        setFatal(error.status);
        setError(error.message);
      } else setConnected(false);
      setLoading(false);
    } finally {
      inFlight.current = false;
    }
  }, [accept, code]);
  useEffect(() => {
    let active = true;
    const initial = setTimeout(() => {
      if (active) void refresh();
    }, 0);
    const poll = setInterval(() => {
      if (active) void refresh();
    }, 1000);
    const clock = setInterval(() => setNow(Date.now() + offset.current), 100);
    const online = () => void refresh();
    const offline = () => setConnected(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      active = false;
      clearTimeout(initial);
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [refresh]);
  const roomId = room?.id;
  const selfId = room?.selfId;
  useEffect(() => {
    if (!roomId || !selfId) return;
    let cleanup = () => {};
    let cancelled = false;
    void identity()
      .then((supabase) => {
        if (!supabase || cancelled) return;
        const channel = supabase
          .channel(`room:${roomId}`, {
            config: { private: true, presence: { key: selfId } },
          })
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'room_events',
              filter: `room_id=eq.${roomId}`,
            },
            () => void refresh(),
          )
          .on('presence', { event: 'sync' }, () => void refresh())
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              void channel.track({ online: true });
              void refresh();
            }
          });
        cleanup = () => {
          void supabase.removeChannel(channel);
        };
      })
      .catch(() => {});
    const heartbeat = setInterval(() => {
      void api<RoomView>(`/api/rooms/${code}`, { type: 'heartbeat' })
        .then(accept)
        .catch(() => setConnected(false));
    }, 5000);
    return () => {
      cancelled = true;
      cleanup();
      clearInterval(heartbeat);
    };
  }, [roomId, selfId, code, accept, refresh]);
  const act = useCallback(
    async (action: Action) => {
      setBusy(true);
      setError('');
      try {
        accept(await api<RoomView>(`/api/rooms/${code}`, action));
        return true;
      } catch (error) {
        setError(
          error instanceof ApiError
            ? error.message
            : 'Connection interrupted. Try again; your progress is saved.',
        );
        if (!(error instanceof ApiError)) setConnected(false);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [accept, code],
  );
  return {
    room,
    error,
    fatal,
    connected,
    loading,
    busy,
    now,
    act,
    refresh,
    setError,
  };
}
