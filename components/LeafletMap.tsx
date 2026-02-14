import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

interface LeafletMapProps {
    currentLocation: Location.LocationObject | null;
    otherMembersLocations: any[];
    children?: React.ReactNode;
}

export interface LeafletMapRef {
    flyTo: (latitude: number, longitude: number) => void;
}

const LeafletMap = forwardRef<LeafletMapRef, {
    currentLocation: Location.LocationObject | null;
    otherMembersLocations: any[];
    onMemberSelect?: (id: string) => void;
}>(({ currentLocation, otherMembersLocations, onMemberSelect }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
        flyTo: (latitude, longitude) => {
            webViewRef.current?.injectJavaScript(`map.flyTo([${latitude}, ${longitude}], 16); true;`);
        }
    }));

    // Initial HTML setup for Leaflet map
    const mapHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
            <style>
                body { margin: 0; padding: 0; }
                #map { height: 100vh; width: 100vw; }
                
                .marker-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: auto !important;
                    height: auto !important;
                    background: transparent;
                }

                .avatar-box {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background-color: white;
                    border: 3px solid #3b82f6;
                    overflow: hidden;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    z-index: 10;
                }

                .avatar-box.is-me {
                    border-color: #10b981;
                }

                .avatar-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-text {
                    font-family: sans-serif;
                    font-weight: bold;
                    font-size: 18px;
                    color: #475569;
                }

                .name-tag {
                    margin-top: 4px;
                    background-color: rgba(255,255,255,0.95);
                    padding: 2px 8px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                    font-family: sans-serif;
                    font-size: 12px;
                    font-weight: bold;
                    color: #1e293b;
                    white-space: nowrap;
                    z-index: 5;
                }

                .arrow {
                    width: 0; 
                    height: 0; 
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 8px solid #3b82f6;
                    margin-top: -2px;
                    z-index: 9;
                }
                .is-me .arrow { border-top-color: #10b981; }

            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                var map = L.map('map', {
                    zoomControl: false,
                    attributionControl: false
                }).setView([0, 0], 2);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                }).addTo(map);

                var markers = {};
                var myMarker = null;

                function createIconHTML(member, isMe) {
                    var name = member.users?.name || (isMe ? 'You' : 'Member');
                    var initial = name.charAt(0).toUpperCase();
                    var photo = member.users?.photo_url;
                    
                    var avatarContent = photo 
                        ? '<img src="' + photo + '" class="avatar-img" />'
                        : '<span class="avatar-text">' + initial + '</span>';

                    var wrapperClass = isMe ? 'marker-container is-me' : 'marker-container';

                    return '<div class="' + wrapperClass + '">' +
                           '<div class="avatar-box ' + (isMe ? 'is-me' : '') + '">' + avatarContent + '</div>' +
                           '<div class="arrow"></div>' +
                           '<div class="name-tag">' + name + '</div>' +
                           '</div>';
                }

                window.updateMap = function(data) {
                    var parsed = JSON.parse(data);
                    var current = parsed.currentLocation;
                    var others = parsed.others;

                    if (current && current.coords) {
                        var lat = current.coords.latitude;
                        var lng = current.coords.longitude;
                        
                        if (!myMarker) {
                             var html = createIconHTML({users: {name: 'You', photo_url: null}}, true); // Pass true for isMe
                             var myIcon = L.divIcon({
                                 className: 'custom-div-icon',
                                 html: html,
                                 iconSize: [60, 80],
                                 iconAnchor: [30, 50]
                             });
                             myMarker = L.marker([lat, lng], {icon: myIcon}).addTo(map);
                             myMarker.on('click', function() {
                                 window.ReactNativeWebView.postMessage(JSON.stringify({type: 'marker_click', id: 'current-user'}));
                             });
                             map.setView([lat, lng], 15);
                        } else {
                            myMarker.setLatLng([lat, lng]);
                        }
                    }

                    // Remove old
                    Object.keys(markers).forEach(function(id) {
                        if (!others.find(function(m) { return m.id === id; })) {
                            map.removeLayer(markers[id]);
                            delete markers[id];
                        }
                    });

                    // Update/Add new
                    others.forEach(function(member) {
                        if (markers[member.id]) {
                            markers[member.id].setLatLng([member.latitude, member.longitude]);
                        } else {
                            var html = createIconHTML(member, false);
                            var memberIcon = L.divIcon({
                                 className: 'custom-div-icon',
                                 html: html,
                                 iconSize: [60, 80],
                                 iconAnchor: [30, 50]
                            });
                             
                            markers[member.id] = L.marker([member.latitude, member.longitude], {icon: memberIcon})
                                .addTo(map);
                            
                            markers[member.id].on('click', function() {
                                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'marker_click', id: member.id}));
                            });
                        }
                    });
                }

            </script>
        </body>
        </html>
    `;

    useEffect(() => {
        if (mapLoaded && currentLocation) {
            const data = JSON.stringify({
                currentLocation,
                others: otherMembersLocations
            });
            webViewRef.current?.injectJavaScript(`window.updateMap('${data}'); true;`);
        }
    }, [currentLocation, otherMembersLocations, mapLoaded]);

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'marker_click' && onMemberSelect) {
                onMemberSelect(data.id);
            }
        } catch (e) {
            // ignore
        }
    };

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                source={{ html: mapHTML }}
                style={styles.webview}
                onLoad={() => setMapLoaded(true)}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                originWhitelist={['*']}
                onMessage={handleMessage}
            />
            {!mapLoaded && (
                <View style={[styles.container, styles.loadingOverlay]}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
    }
});

export default LeafletMap;
