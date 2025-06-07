import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Users, Clock, User, Mail } from 'lucide-react';
import { streamService, viewerService } from '../../services/api';

interface Stream {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  channel: {
    name: string;
    owner: {
      firstName: string;
      lastName: string;
    };
  };
}

const WatchStream: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const [stream, setStream] = useState<Stream | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [viewerData, setViewerData] = useState({ firstName: '', lastName: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (streamId) {
      fetchStream();
      fetchViewerCount();
      const registeredStreamId = localStorage.getItem('registeredStreamId');
      if (registeredStreamId === streamId) setIsRegistered(true);
      const interval = setInterval(fetchViewerCount, 5000);
      return () => clearInterval(interval);
    }
  }, [streamId]);

  const fetchStream = async () => {
    try {
      const res = await streamService.getStreamById(streamId!);
      setStream(res.data);
    } catch (e) {
      setError('Stream not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchViewerCount = async () => {
    try {
      const res = await viewerService.getCurrentViewersCount(streamId!);
      setViewerCount(res.data.count);
    } catch (e) {
      console.error('Error fetching viewer count:', e);
    }
  };

  const handleViewerRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setError('');
    try {
      await viewerService.registerViewer({ ...viewerData, streamId: streamId! });
      setIsRegistered(true);
      localStorage.setItem('registeredStreamId', streamId!);
    } catch (err: any) {
      setError(err.message || 'Failed to join stream');
    } finally {
      setRegistering(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setViewerData({ ...viewerData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (isRegistered && stream?.status === 'live') {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const video = document.getElementById('remoteVideo') as HTMLVideoElement;
      pc.ontrack = (event) => { video.srcObject = event.streams[0]; };
      pc.oniceconnectionstatechange = () => console.log('ICE connection:', pc.iceConnectionState);
      const startViewing = async () => {
        try {
          const offer = await pc.createOffer({ offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          const res = await fetch(`http://localhost:8889/${streamId}/whep`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/sdp' },
            body: offer.sdp
          });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const answer = await res.text();
          await pc.setRemoteDescription({ type: 'answer', sdp: answer });
        } catch (e) {
          console.error('WebRTC error:', e);
        }
      };
      startViewing();
      return () => pc.close();
    }
  }, [isRegistered, stream]);

  if (loading) return <div className="flex justify-center items-center h-96">Loading...</div>;
  if (error && !stream) return <div className="text-center text-red-500 py-16">{error}</div>;
  if (!stream) return <div className="text-center py-16">Stream not found</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {!isRegistered ? (
        <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow">
          <h2 className="text-2xl font-bold text-center mb-4">Join Stream</h2>
          <form onSubmit={handleViewerRegistration} className="space-y-4">
            <input name="firstName" required value={viewerData.firstName} onChange={handleInputChange} placeholder="First Name" className="w-full px-4 py-2 border rounded" />
            <input name="lastName" required value={viewerData.lastName} onChange={handleInputChange} placeholder="Last Name" className="w-full px-4 py-2 border rounded" />
            <input name="email" required type="email" value={viewerData.email} onChange={handleInputChange} placeholder="Email" className="w-full px-4 py-2 border rounded" />
            <button type="submit" disabled={registering} className="w-full bg-purple-600 text-white py-2 rounded">{registering ? 'Joining...' : 'Join Stream'}</button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h1 className="text-2xl font-bold">{stream.title}</h1>
            <p className="text-gray-600">{stream?.channel?.name} - {stream?.channel?.owner?.firstName} {stream?.channel?.owner?.lastName}</p>
            <p className="text-sm text-gray-500">{stream.status === 'live' ? '🔴 LIVE' : stream.status.toUpperCase()} • {viewerCount} viewers</p>
          </div>

          <div className="bg-black aspect-video rounded-lg overflow-hidden">
            asdsad
            <video id="remoteVideo" autoPlay controls playsInline className="w-full h-full"></video>
          </div>

          {stream.status === 'ended' && (
            <div className="text-center bg-gray-100 p-6 rounded-lg">
              <h3 className="text-lg font-medium">Stream Ended</h3>
              <p>Thanks for watching! Check back later for more content from {stream.channel.name}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WatchStream;
