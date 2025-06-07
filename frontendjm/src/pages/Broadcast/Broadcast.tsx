import React, { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Square, Users, Eye, Clock, Settings } from 'lucide-react';
import { streamService, viewerService } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';


interface Stream {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  channel: {
    name: string;
  };
}

const Broadcast: React.FC = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [stream, setStream] = useState<Stream | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingStream, setStartingStream] = useState(false);
  const [endingStream, setEndingStream] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const {transcript, isListening, startListening, stopListening} = useContext(AuthContext)


  useEffect(() => {
    if (streamId) {
      fetchStream();
      fetchViewerCount();
      const interval = setInterval(fetchViewerCount, 5000);
      return () => clearInterval(interval);
    }
  }, [streamId]);

  useEffect(() => {
    let pc: RTCPeerConnection | null = null;

    const startWHIPStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        pc = new RTCPeerConnection({ iceServers: [] });
        stream.getTracks().forEach(track => pc!.addTrack(track, stream));

        pc.onicegatheringstatechange = async () => {
          if (pc!.iceGatheringState === "complete") {
            const offer = pc!.localDescription;
            const res = await fetch(`http://localhost:8889/${streamId}/whip`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/sdp' },
              body: offer!.sdp || ''
            });

            const answer = await res.text();
            await pc!.setRemoteDescription({ type: 'answer', sdp: answer });
          }
        };

        await pc.setLocalDescription(await pc.createOffer());
      } catch (error) {
        console.error("Error starting WHIP stream:", error);
      }
    };

    startWHIPStream();

    return () => {
      if (pc) {
        pc.getSenders().forEach(sender => sender.track?.stop());
        pc.close();
      }
    };
  }, []);

  const fetchStream = async () => {
    try {
      const response = await streamService.getStreamById(streamId!);
      setStream(response.data);
      setIsLive(response.data.status === 'live');
    } catch (error) {
      console.error('Error fetching stream:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchViewerCount = async () => {
    try {
      const response = await viewerService.getCurrentViewersCount(streamId!);
      setViewerCount(response.data.count);
    } catch (error) {
      console.error('Error fetching viewer count:', error);
    }
  };

  const handleStartStream = async () => {
    setStartingStream(true);
    try {
      await streamService.startStream(streamId!);
      setIsLive(true);
      setIsStreaming(true);
      startListening();
      setStream(prev => prev ? { ...prev, status: 'live', startedAt: new Date().toISOString() } : null);
    } catch (error) {
      console.error('Error starting stream:', error);
    } finally {
      setStartingStream(false);
    }
  };

  const handleEndStream = async () => {
    if (window.confirm('Are you sure you want to end this stream?')) {
      setEndingStream(true);
      stopListening()
      try {
        await streamService.endStream(streamId!);
        setIsLive(false);
        setStream(prev => prev ? { ...prev, status: 'ended' } : null);
      } catch (error) {
        console.error('Error ending stream:', error);
      } finally {
        setEndingStream(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Stream not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{stream.title}</h1>
            <p className="text-gray-600">{stream?.channel?.name}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isLive ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {isLive ? '🔴 LIVE' : stream.status.toUpperCase()}
            </div>
          </div>
        </div>

        {stream.description && (
          <p className="text-gray-700 mb-4">{stream.description}</p>
        )}

        <div className="flex items-center space-x-6 text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{viewerCount} viewers</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>Created {new Date(stream.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div id="video-container" className="bg-black rounded-lg aspect-video flex items-center justify-center">
            <video
            id="video"
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover rounded-lg"
            />
            <div id="subtitle">{transcript}</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stream Controls</h3>
            <div className="flex items-center space-x-4">
              {!isLive ? (
                <button
                  onClick={handleStartStream}
                  disabled={startingStream}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {startingStream ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Play className="h-4 w-4" />}
                  {startingStream ? 'Starting...' : 'Go Live'}
                </button>
              ) : (
                <button
                  onClick={handleEndStream}
                  disabled={endingStream}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {endingStream ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Square className="h-4 w-4" />}
                  {endingStream ? 'Ending...' : 'End Stream'}
                </button>
              )}
              <button className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stream Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Current Viewers</span>
                <span className="font-semibold text-gray-900">{viewerCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <span className={`font-semibold ${isLive ? 'text-red-600' : 'text-gray-600'}`}>{isLive ? 'Live' : 'Offline'}</span>
              </div>
              {stream.startedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Started At</span>
                  <span className="font-semibold text-gray-900">{new Date(stream.startedAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stream Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Stream URL</p>
                <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-1 font-mono">{window.location.origin}/watch/{stream.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Stream Key</p>
                <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-1 font-mono">{stream.id.substring(0, 8)}...</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button onClick={() => window.open(`/watch/${stream.id}`, '_blank')} className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3">
                <Eye className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">Preview Stream</span>
              </button>
              <button onClick={() => navigate('/dashboard')} className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-sm font-medium">Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Broadcast;


