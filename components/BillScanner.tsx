import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { X, Zap, ZapOff, Camera } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

interface BillScannerProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
}

export default function BillScanner({ onCapture, onClose }: BillScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<'off' | 'on'>('off');
    const [isCapturing, setIsCapturing] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    // Animation for the laser line
    const laserPosition = useSharedValue(0);

    useEffect(() => {
        if (!permission) requestPermission();

        // Start laser animation
        laserPosition.value = withRepeat(
            withTiming(SCAN_AREA_SIZE, { duration: 1500, easing: Easing.linear }),
            -1,
            true // reverse
        );
    }, [permission]);

    const laserStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: laserPosition.value }],
    }));

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>We need your permission to show the camera</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.button}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <X color="white" size={24} />
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (cameraRef.current && !isCapturing) {
            setIsCapturing(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.7,
                    base64: true,
                });

                if (photo?.base64) {
                    onCapture(photo.base64);
                }
            } catch (error) {
                Alert.alert("Error", "Failed to capture image");
                setIsCapturing(false);
            }
        }
    };

    const toggleFlash = () => {
        setFlash(current => (current === 'off' ? 'on' : 'off'));
    };

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing={facing}
                enableTorch={flash === 'on'}
                ref={cameraRef}
            >
                <SafeAreaView style={styles.uiContainer}>
                    {/* Top Bar */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                            <X color="white" size={28} />
                        </TouchableOpacity>
                        <Text style={styles.headerText}>Scan Bill</Text>
                        <TouchableOpacity onPress={toggleFlash} style={styles.iconButton}>
                            {flash === 'on' ? (
                                <Zap color="#fbbf24" size={28} fill="#fbbf24" />
                            ) : (
                                <ZapOff color="white" size={28} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Scanner Overlay */}
                    <View style={styles.overlayContainer}>
                        <View style={styles.overlayTop} />
                        <View style={styles.overlayMiddle}>
                            <View style={styles.overlaySide} />
                            <View style={styles.scanWindow}>
                                <View style={styles.cornerTL} />
                                <View style={styles.cornerTR} />
                                <View style={styles.cornerBL} />
                                <View style={styles.cornerBR} />

                                {/* Laser Animation */}
                                <Animated.View style={[styles.laser, laserStyle]} />
                            </View>
                            <View style={styles.overlaySide} />
                        </View>
                        <View style={styles.overlayBottom}>
                            <Text style={styles.hintText}>Align bill within the frame</Text>
                        </View>
                    </View>

                    {/* Bottom Control */}
                    <View style={styles.bottomBar}>
                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={takePicture}
                            disabled={isCapturing}
                        >
                            <View style={styles.captureInner} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    uiContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    headerText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    iconButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
    },
    overlayContainer: {
        flex: 1,
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    overlayMiddle: {
        flexDirection: 'row',
        height: SCAN_AREA_SIZE,
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        paddingTop: 20,
    },
    scanWindow: {
        width: SCAN_AREA_SIZE,
        height: SCAN_AREA_SIZE,
        position: 'relative',
        overflow: 'hidden',
    },
    cornerTL: { position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderColor: '#3b82f6', borderTopWidth: 4, borderLeftWidth: 4 },
    cornerTR: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderColor: '#3b82f6', borderTopWidth: 4, borderRightWidth: 4 },
    cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderColor: '#3b82f6', borderBottomWidth: 4, borderLeftWidth: 4 },
    cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderColor: '#3b82f6', borderBottomWidth: 4, borderRightWidth: 4 },
    laser: {
        width: '100%',
        height: 2,
        backgroundColor: '#60a5fa', // Cyan/Blue laser
        shadowColor: '#3b82f6',
        shadowOpacity: 0.8,
        shadowRadius: 10,
        elevation: 5,
    },
    hintText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.9,
    },
    bottomBar: {
        paddingBottom: 40,
        alignItems: 'center',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'white',
    },
    text: {
        color: 'white',
        fontSize: 16,
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#0a7ea4',
        padding: 15,
        borderRadius: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        marginTop: 40,
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 50,
    }
});
