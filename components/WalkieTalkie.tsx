import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator, Platform } from 'react-native';
import { useAlert } from "@/context/AlertContext";
import { Audio } from 'expo-av';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface WalkieTalkieProps {
    tripId: string;
    currentUser: User | null;
}

export default function WalkieTalkie({ tripId, currentUser }: WalkieTalkieProps) {
    const { showAlert } = useAlert();
    const recordingRef = useRef<Audio.Recording | null>(null);
    const isPressedRef = useRef(false);
    const audioLock = useRef(false);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [isRecording, setIsRecording] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speakerName, setSpeakerName] = useState<string | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const isMutedRef = useRef(isMuted);

    // Keep ref in sync
    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    // Subscribe to new voice messages
    useEffect(() => {
        if (!tripId || !currentUser?.id) return;

        const channel = supabase
            .channel(`walkie-talkie:${tripId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'voice_messages',
                    filter: `trip_id=eq.${tripId}`,
                },
                async (payload) => {
                    const newMessage = payload.new;

                    // Don't play own messages
                    if (newMessage.user_id === currentUser.id) return;

                    // Don't play if muted (check ref)
                    if (isMutedRef.current) return;

                    console.log('Received voice message:', newMessage);

                    try {
                        // Get user name for UI
                        const { data: userData } = await supabase
                            .from('users')
                            .select('name')
                            .eq('id', newMessage.user_id)
                            .single();

                        setSpeakerName(userData?.name || 'Someone');
                        playAudio(newMessage.public_url, newMessage.id);
                    } catch (error) {
                        console.error('Error handling incoming voice message:', error);
                    }
                }
            )
            .subscribe((status) => {
                console.log(`WalkieTalkie Subscription Status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`Listening for messages on trip: ${tripId}`);
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('WalkieTalkie Subscription Error');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tripId, currentUser?.id]); // Depend on ID, not object reference

    // Cleanup on unmount
    useEffect(() => {
        // Configure audio mode immediately for playback
        const configureAudio = async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });
            } catch (e) {
                console.error('Error configuring audio session:', e);
            }
        };
        configureAudio();

        return () => {
            isPressedRef.current = false;
            // Force release lock on unmount
            audioLock.current = false;
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync();
            }
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    async function startRecording() {
        console.log('Button pressed in (startRecording called)');
        if (audioLock.current) {
            console.log("Audio lock is busy, ignoring start request.");
            return;
        }

        isPressedRef.current = true;
        audioLock.current = true;

        try {
            // Check permissions first
            if (permissionResponse?.status !== 'granted') {
                console.log("Requesting permission...");
                const { status } = await requestPermission();
                if (status !== 'granted') {
                    showAlert("Permission Required", "Please enable microphone access in your phone settings to use the Walkie-Talkie.");
                    audioLock.current = false;
                    return;
                }
            }

            // Cleanup any existing (stale) recording first
            if (recordingRef.current) {
                console.warn("Unloading stale recording...");
                try {
                    await recordingRef.current.stopAndUnloadAsync();
                } catch (e) {
                    // Ignore stale cleanup errors
                }
                recordingRef.current = null;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Optimized for Voice (Low latency, smaller file size)
            const voiceRecordingOptions: Audio.RecordingOptions = {
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 16000, // Lower sample rate for voice
                    numberOfChannels: 1, // Mono
                    bitRate: 24000, // Lower bitrate (approx 3KB/sec)
                },
                ios: {
                    extension: '.m4a',
                    audioQuality: Audio.IOSAudioQuality.MEDIUM,
                    sampleRate: 16000,
                    numberOfChannels: 1,
                    bitRate: 24000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            };

            // Start recording setup
            const { recording: newRecording } = await Audio.Recording.createAsync(
                voiceRecordingOptions
            );

            // CRITICAL CHECK: Did user release the button while we were loading?
            if (!isPressedRef.current) {
                console.log("Recording started but user already released. Stopping and discarding.");
                try {
                    await newRecording.stopAndUnloadAsync();
                } catch (e: any) {
                    // SILENTLY ignore "no valid audio data" error here
                    if (!e?.message?.includes('no valid audio data')) {
                        console.log("Error unloading discarded recording", e);
                    }
                }
                // Release lock since we are done with this attempt
                audioLock.current = false;
                return;
            }

            recordingRef.current = newRecording;
            setIsRecording(true);
            console.log('Recording started');
            // Lock stays TRUE until stopRecording is called by user action

        } catch (err: any) {
            console.error('Failed to start recording', err);
            showAlert("Error", `Could not start recording: ${err.message || "Unknown error"}`);
            audioLock.current = false; // Release lock on error
        }
    }

    async function stopRecording() {
        console.log('Button released (stopRecording called)');
        isPressedRef.current = false;

        // If no recording ref, just return. 
        if (!recordingRef.current) {
            setIsRecording(false);
            return;
        }

        setIsRecording(false);
        const recording = recordingRef.current;
        recordingRef.current = null; // Clear ref immediately

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            // Check if recording was successful/long enough
            const status = await recording.getStatusAsync();
            if (status.isDoneRecording && status.durationMillis < 200) { // Reduced to 200ms
                console.log(`Recording too short (${status.durationMillis}ms), discarding.`);
            } else if (uri) {
                console.log('Recording stopped and stored at', uri);
                uploadAndSend(uri);
            }
        } catch (error: any) {
            // Handle specific errors
            if (error.message && error.message.includes("no valid audio data")) {
                console.log("Recording stopped with no valid audio data (too short?). Discarding.");
            } else {
                console.error('Error stopping recording:', error);
            }
        } finally {
            // Always release lock when done stopping an active recording
            audioLock.current = false;
        }
    }

    async function uploadAndSend(uri: string) {
        if (!currentUser) return;

        try {
            console.log('Starting upload for:', uri);

            // 1. Create FormData for reliable Android upload
            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                name: `voice_${Date.now()}.m4a`,
                type: 'audio/m4a',
            } as any);

            const fileName = `${tripId}/${Date.now()}.m4a`;

            console.log('Uploading formData to Supabase...');

            // 2. Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('voice-messages')
                .upload(fileName, formData, {
                    contentType: 'audio/m4a',
                    upsert: false,
                });

            if (uploadError) {
                console.error('Supabase Upload Error details:', uploadError);
                showAlert("Upload Failed", `Could not upload audio: ${uploadError.message}`);
                return;
            }

            console.log('Upload successful:', uploadData);

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('voice-messages')
                .getPublicUrl(fileName);

            // 4. Insert into 'voice_messages' table
            const { error: dbError } = await supabase
                .from('voice_messages')
                .insert({
                    trip_id: tripId,
                    user_id: currentUser.id,
                    public_url: publicUrl,
                    duration: 0, // Optional: Calculate duration if possible
                });

            if (dbError) {
                console.error("Database insert error:", dbError);
                // Don't alert user if only DB insert failed but upload worked, just log it. 
                // Or strictly, it's a failure.
            } else {
                console.log('Voice message record created.');
            }

        } catch (error: any) {
            console.error('Error in uploadAndSend:', error);
            showAlert('Error', `Failed to send message: ${error.message || error}`);
        }
    }

    async function deleteMessage(messageId: string, publicUrl: string) {
        try {
            console.log('Deleting played message:', messageId);

            // 1. Delete from DB
            const { error: dbError } = await supabase
                .from('voice_messages')
                .delete()
                .eq('id', messageId);

            if (dbError) console.error('Error deleting message row:', dbError);

            // 2. Delete from Storage
            // Extract path from public URL. Format usually: .../voice-messages/<path>
            const path = publicUrl.split('/voice-messages/')[1];
            if (path) {
                const { error: storageError } = await supabase.storage
                    .from('voice-messages')
                    .remove([decodeURIComponent(path)]);

                if (storageError) console.error('Error deleting message file:', storageError);
            }

        } catch (error) {
            console.error('Failed to cleanup message:', error);
        }
    }

    async function playAudio(url: string, messageId: string) {
        try {
            setIsPlaying(true);

            // Stop previous sound if any
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: true }
            );
            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                    setSpeakerName(null);
                    // Auto-delete after playing
                    deleteMessage(messageId, url);
                }
            });

        } catch (error) {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
            setSpeakerName(null);
        }
    }

    return (
        <View style={styles.container}>
            {/* Status Display */}
            {isPlaying && (
                <View style={styles.statusPill}>
                    <Volume2 size={16} color="#10b981" />
                    <Text style={styles.statusText}>{speakerName} is talking...</Text>
                </View>
            )}

            <View style={styles.controls}>
                {/* Mute Toggle */}
                <TouchableOpacity
                    style={[styles.smallButton, isMuted && styles.mutedButton]}
                    onPress={() => setIsMuted(!isMuted)}
                >
                    {isMuted ? (
                        <VolumeX size={20} color="white" />
                    ) : (
                        <Volume2 size={20} color="#1e293b" />
                    )}
                </TouchableOpacity>

                {/* Push to Talk Button */}
                <TouchableOpacity
                    style={[
                        styles.pttButton,
                        isRecording && styles.pttButtonActive
                    ]}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                    activeOpacity={0.7}
                >
                    {isRecording ? (
                        <View style={styles.recordingIndicator} />
                    ) : (
                        <Mic size={32} color="white" />
                    )}
                </TouchableOpacity>

                {/* Placeholder for symmetry or other controls */}
                <View style={{ width: 44 }} />
            </View>

            <Text style={styles.hintText}>
                {isRecording ? "Release to Send" : "Hold to Talk"}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 80, // Slightly lower, closer to nav
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingBottom: 20, // Safe area
        zIndex: 100, // Ensure it sits on top
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32, // Better spacing
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 20,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#10b981',
    },
    smallButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    mutedButton: {
        backgroundColor: '#ef4444',
    },
    pttButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    pttButtonActive: {
        backgroundColor: '#ef4444', // Red when recording
        borderColor: 'rgba(239, 68, 68, 0.3)',
        // transform: [{ scale: 1.1 }], // Removing scale to avoid layout shift cancelling touch
        borderWidth: 6, // Make border thicker instead for feedback
    },
    recordingIndicator: {
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: 'white',
    },
    hintText: {
        marginTop: 12,
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(255,255,255,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    }
});
