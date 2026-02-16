import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, StatusBar, Animated, Easing } from 'react-native';
import { useAlert } from "@/context/AlertContext";
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { X, Zap, ZapOff, ScanLine } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const SCAN_WIDTH = width * 0.85;
const SCAN_HEIGHT = SCAN_WIDTH * 1.4; // Receipt aspect ratio

interface BillScannerProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
    processing?: boolean;
}

export default function BillScanner({ onCapture, onClose, processing = false }: BillScannerProps) {
    const { showAlert } = useAlert();
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<'off' | 'on'>('off');
    const [isCapturing, setIsCapturing] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    // Animation for scanning line
    const scanAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!permission) requestPermission();
        startScanAnimation();
    }, [permission]);

    const startScanAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(scanAnim, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ])
        ).start();
    };

    if (!permission) return <View style={styles.container} />;

    if (!permission.granted) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Text style={styles.permissionText}>Camera access is needed to scan receipts.</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Allow Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (cameraRef.current && !isCapturing && !processing) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setIsCapturing(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                    base64: true,
                    shutterSound: true,
                });

                if (photo?.base64) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onCapture(photo.base64);
                }
            } catch (error) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                showAlert("Error", "Failed to capture receipt");
                setIsCapturing(false);
            } finally {
                setIsCapturing(false);
            }
        }
    };

    const toggleFlash = () => {
        Haptics.selectionAsync();
        setFlash(current => (current === 'off' ? 'on' : 'off'));
    };

    const translateY = scanAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, SCAN_HEIGHT],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <CameraView
                style={StyleSheet.absoluteFill}
                facing={facing}
                enableTorch={flash === 'on'}
                ref={cameraRef}
            />

            {/* Dark Overlay with Transparent Cutout */}
            <View style={styles.overlay} pointerEvents="none">
                <View style={styles.sideOverlay} />
                <View style={styles.centerColumn}>
                    <View style={styles.topOverlay} />
                    <View style={styles.scanWindow}>
                        {/* Corner Markers */}
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />

                        {/* Scanning Laser */}
                        {!processing && (
                            <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]}>
                                <LinearGradient
                                    colors={['rgba(99, 102, 241, 0)', 'rgba(99, 102, 241, 0.5)', 'rgba(99, 102, 241, 0)']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.scanGradient}
                                />
                            </Animated.View>
                        )}
                    </View>
                    <View style={styles.bottomOverlay} />
                </View>
                <View style={styles.sideOverlay} />
            </View>

            <SafeAreaView style={styles.uiContainer} edges={['top', 'bottom']}>
                {/* Header Controls */}
                <BlurView intensity={20} tint="dark" style={styles.headerBar}>
                    <TouchableOpacity onPress={onClose} style={styles.iconButton} disabled={processing}>
                        <X color="#fff" size={24} />
                    </TouchableOpacity>
                    <View style={styles.statusBadge}>
                        <ScanLine size={14} color="#6366f1" />
                        <Text style={styles.statusText}>{processing ? "Processing..." : "AI Scanner Ready"}</Text>
                    </View>
                    <TouchableOpacity onPress={toggleFlash} style={styles.iconButton} disabled={processing}>
                        {flash === 'on' ? <Zap color="#fbbf24" fill="#fbbf24" size={24} /> : <ZapOff color="#fff" size={24} />}
                    </TouchableOpacity>
                </BlurView>

                {/* Hint Text */}
                <View style={styles.hintContainer}>
                    <Text style={styles.hintText}>{processing ? "Analyzing Receipt..." : "Align receipt within frame"}</Text>
                    <Text style={styles.subHint}>{processing ? "Extracting items & prices" : "We'll extract items automatically"}</Text>
                </View>

                {/* Bottom Controls */}
                <View style={styles.bottomControls}>
                    <TouchableOpacity
                        style={[styles.shutterOuter, processing && { opacity: 0.5, borderColor: '#6366f1' }]}
                        onPress={takePicture}
                        disabled={isCapturing || processing}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.shutterInner, processing && { backgroundColor: '#6366f1' }]}>
                            {(isCapturing || processing) && <View style={[styles.processingDot, { backgroundColor: '#fff' }]} />}
                        </View>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Processing Overlay */}
            {processing && (
                <View style={StyleSheet.absoluteFill}>
                    <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                        <View style={styles.processingContainer}>
                            <ScanLine size={48} color="#6366f1" style={{ marginBottom: 16 }} />
                            <Text style={styles.processingTitle}>Analyzing Receipt</Text>
                            <Text style={styles.processingSubtitle}>This may take a few seconds...</Text>
                        </View>
                    </BlurView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
    },
    sideOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    centerColumn: {
        width: SCAN_WIDTH,
    },
    topOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    bottomOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    scanWindow: {
        height: SCAN_HEIGHT,
        backgroundColor: 'transparent',
        position: 'relative',
    },
    scanLine: {
        height: 2,
        width: '100%',
        backgroundColor: '#6366f1',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
    },
    scanGradient: {
        flex: 1,
        height: 40,
        marginTop: -20, // Center the glow
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#fff',
        borderWidth: 4,
        borderRadius: 4,
    },
    cornerTL: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0 },
    cornerTR: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0 },
    cornerBL: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0 },
    cornerBR: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0 },

    uiContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 24,
        overflow: 'hidden',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.4)',
    },
    statusText: {
        color: '#e0e7ff',
        fontSize: 12,
        fontWeight: '600',
    },
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    hintContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    hintText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    subHint: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginTop: 4,
    },
    bottomControls: {
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterOuter: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    shutterInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    processingDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#6366f1',
    },

    // Permission Screens
    permissionText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 24,
    },
    primaryButton: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 24,
        marginBottom: 16,
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    secondaryButton: {
        padding: 12,
    },
    secondaryButtonText: {
        color: '#94a3b8',
        fontSize: 16,
    },
    processingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        width: 250,
        height: 180,
    },
    processingTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
        marginTop: 16,
        textAlign: 'center',
    },
    processingSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
    }
});
