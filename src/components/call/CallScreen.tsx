import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Phone, PhoneOff,
  Volume2, VolumeX, RotateCcw, Maximize2
} from 'lucide-react';
import type { Profile } from '@/contexts/AuthContext';
import type { ChatWithMeta } from '@/hooks/useChats';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CallScreenProps {
  chat: ChatWithMeta;
  callType: 'audio' | 'video';
  callId?: string;        // if answering existing call
  isIncoming?: boolean;
  currentUser: Profile;
  onEnd: () => void;
}

type CallStatus = 'calling' | 'ringing' | 'active' | 'ended';

const avatarHue = (name: string) => (name.charCodeAt(0) * 13) % 360;

const CallScreen = ({ chat, callType, callId, isIncoming = false, currentUser, onEnd }: CallScreenProps) => {
  const [status, setStatus] = useState<CallStatus>(isIncoming ? 'ringing' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentCallId, setCurrentCallId] = useState<string | null>(callId || null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const chatName = chat.is_group ? chat.group_name || 'Group' : chat.members[0]?.display_name || 'Unknown';
  const chatMember = chat.is_group ? null : chat.members[0];

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const createPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    peerRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Remote track handler
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // ICE candidate handler — store in DB for signaling
    pc.onicecandidate = async (event) => {
      if (event.candidate && currentCallId) {
        // Append ICE candidate to calls table
        const { data: callRow } = await supabase
          .from('calls')
          .select('ice_candidates')
          .eq('id', currentCallId)
          .single();
        
        const existing = Array.isArray(callRow?.ice_candidates) ? callRow.ice_candidates : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candidates = [...existing, event.candidate.toJSON()] as any;
        await supabase.from('calls').update({ ice_candidates: candidates }).eq('id', currentCallId);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setStatus('active');
        startTimer();
      } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        endCall();
      }
    };

    return pc;
  }, [currentCallId]);

  const initMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      toast.error('Could not access camera/microphone. Check browser permissions.');
      onEnd();
      return null;
    }
  }, [callType, onEnd]);

  // Outgoing call flow
  const startCall = useCallback(async () => {
    const stream = await initMedia();
    if (!stream) return;

    // Create call record
    const callee = chat.members[0];
    const { data: callRow, error } = await supabase.from('calls').insert({
      chat_id: chat.id,
      caller_id: currentUser.user_id,
      callee_id: callee?.user_id || null,
      call_type: callType,
      status: 'ringing',
    }).select().single();

    if (error || !callRow) {
      toast.error('Failed to initiate call');
      onEnd();
      return;
    }

    setCurrentCallId(callRow.id);

    const pc = await createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Store offer in DB
    await supabase.from('calls').update({
      sdp_offer: JSON.stringify(offer),
    }).eq('id', callRow.id);

    // Subscribe for answer
    channelRef.current = supabase
      .channel(`call-${callRow.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${callRow.id}`,
      }, async (payload) => {
        const updated = payload.new as Record<string, unknown>;
        if (updated.status === 'active' && updated.sdp_answer) {
          const answer = JSON.parse(updated.sdp_answer as string);
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } else if (updated.status === 'ended' || updated.status === 'declined') {
          setStatus('ended');
          setTimeout(onEnd, 1500);
        }
      })
      .subscribe();
  }, [chat, callType, currentUser, createPeerConnection, initMedia, onEnd]);

  // Incoming call — answer
  const answerCall = useCallback(async () => {
    if (!callId) return;
    const stream = await initMedia();
    if (!stream) return;

    const { data: callRow } = await supabase.from('calls').select('*').eq('id', callId).single();
    if (!callRow) return;

    const pc = await createPeerConnection();
    const offer = JSON.parse(callRow.sdp_offer as string);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await supabase.from('calls').update({
      sdp_answer: JSON.stringify(answer),
      status: 'active',
    }).eq('id', callId);

    setStatus('active');
    startTimer();
  }, [callId, createPeerConnection, initMedia]);

  const endCall = useCallback(async () => {
    setStatus('ended');
    cleanup();
    if (currentCallId) {
      await supabase.from('calls').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      }).eq('id', currentCallId);
    }
    setTimeout(onEnd, 800);
  }, [cleanup, currentCallId, onEnd]);

  const declineCall = useCallback(async () => {
    if (callId) {
      await supabase.from('calls').update({ status: 'declined' }).eq('id', callId);
    }
    onEnd();
  }, [callId, onEnd]);

  useEffect(() => {
    if (!isIncoming) {
      startCall();
    }
    return cleanup;
  }, []);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
      setIsVideoOff(!isVideoOff);
    }
  };

  const statusLabel = {
    calling: 'Calling...',
    ringing: 'Incoming call...',
    active: formatDuration(duration),
    ended: 'Call ended',
  }[status];

  const hue = avatarHue(chatName);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: `linear-gradient(135deg, hsl(${hue}, 40%, 8%), hsl(228, 28%, 4%))` }}
    >
      {/* Video backgrounds */}
      {callType === 'video' && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px]" />
          {/* Local video PiP */}
          <motion.div
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden border-2 border-border/30 shadow-2xl z-20"
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {isVideoOff && (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <VideoOff size={20} className="text-muted-foreground" />
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full px-6 py-12">
        {/* Top info */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Avatar */}
          <motion.div
            animate={status === 'calling' || status === 'ringing' ? {
              boxShadow: [
                `0 0 0 0 hsl(${hue}, 70%, 45%, 0.4)`,
                `0 0 0 20px hsl(${hue}, 70%, 45%, 0)`,
              ],
            } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold"
            style={{ background: chatMember?.avatar_url ? undefined : `hsl(${hue}, 55%, 38%)` }}
          >
            {chatMember?.avatar_url
              ? <img src={chatMember.avatar_url} alt="" className="w-full h-full object-cover" />
              : chatName[0]?.toUpperCase()}
          </motion.div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{chatName}</h2>
            <p className={`text-sm mt-1 ${status === 'active' ? 'text-primary' : 'text-muted-foreground'}`}>
              {statusLabel}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {callType === 'video' ? '🎥 Video call' : '🎙️ Voice call'}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full">
          {/* Incoming call — accept/decline */}
          {status === 'ringing' && isIncoming && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-16 mb-8"
            >
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={declineCall}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg"
                  style={{ boxShadow: '0 0 20px hsl(0, 72%, 52%, 0.4)' }}
                >
                  <PhoneOff size={28} className="text-white" />
                </motion.button>
                <span className="text-xs text-muted-foreground">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={answerCall}
                  className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg neon-glow-cyan"
                >
                  <Phone size={28} className="text-primary-foreground" />
                </motion.button>
                <span className="text-xs text-muted-foreground">Accept</span>
              </div>
            </motion.div>
          )}

          {/* Active / Calling controls */}
          {(status === 'active' || status === 'calling') && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              {/* Secondary controls */}
              <div className="flex items-center justify-center gap-6">
                <ControlBtn
                  icon={isSpeakerOff ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  label={isSpeakerOff ? 'Speaker off' : 'Speaker'}
                  active={!isSpeakerOff}
                  onClick={() => setIsSpeakerOff(!isSpeakerOff)}
                />
                {callType === 'video' && (
                  <ControlBtn
                    icon={isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    label={isVideoOff ? 'Camera off' : 'Camera'}
                    active={!isVideoOff}
                    onClick={toggleVideo}
                  />
                )}
                <ControlBtn
                  icon={<RotateCcw size={20} />}
                  label="Flip"
                  active
                  onClick={() => {}}
                />
              </div>

              {/* Primary controls */}
              <div className="flex items-center justify-center gap-8">
                <ControlBtn
                  icon={isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                  label={isMuted ? 'Unmute' : 'Mute'}
                  active={!isMuted}
                  onClick={toggleMute}
                  large
                />
                {/* End call */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center shadow-lg"
                  style={{ boxShadow: '0 0 24px hsl(0, 72%, 52%, 0.5)' }}
                >
                  <PhoneOff size={28} className="text-white" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {status === 'ended' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-muted-foreground text-sm"
            >
              Call ended
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const ControlBtn = ({
  icon, label, active, onClick, large = false
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  large?: boolean;
}) => (
  <div className="flex flex-col items-center gap-1.5">
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      className={`${large ? 'w-14 h-14' : 'w-12 h-12'} rounded-full flex items-center justify-center transition-all ${
        active
          ? 'bg-white/15 text-foreground hover:bg-white/20'
          : 'bg-white/8 text-muted-foreground'
      }`}
    >
      {icon}
    </motion.button>
    <span className="text-[10px] text-muted-foreground">{label}</span>
  </div>
);

export default CallScreen;
