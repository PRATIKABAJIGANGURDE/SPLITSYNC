import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

interface LeafletMapProps {
    currentLocation: Location.LocationObject | null;
    otherMembersLocations: any[];
    children?: React.ReactNode;
}

const LeafletMap = ({ currentLocation, otherMembersLocations }: LeafletMapProps) => {
    const webViewRef = useRef<WebView>(null);
    const [mapLoaded, setMapLoaded] = useState(false);

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
                .custom-marker {
                    background-color: #3b82f6;
                    border: 2px solid white;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }
                .member-marker {
                    background-color: #10b981;
                }
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

                // Function to update map from React Native
                window.updateMap = function(data) {
                    var parsed = JSON.parse(data);
                    var current = parsed.currentLocation;
                    var others = parsed.others;

                    if (current && current.coords) {
                        var lat = current.coords.latitude;
                        var lng = current.coords.longitude;
                        
                        if (!myMarker) {
                             var myIcon = L.divIcon({className: 'custom-marker'});
                             myMarker = L.marker([lat, lng], {icon: myIcon}).addTo(map);
                             map.setView([lat, lng], 15);
                        } else {
                            myMarker.setLatLng([lat, lng]);
                        }
                    }

                    // Handle other members
                    Object.keys(markers).forEach(function(id) {
                        if (!others.find(function(m) { return m.id === id; })) {
                            map.removeLayer(markers[id]);
                            delete markers[id];
                        }
                    });

                    others.forEach(function(member) {
                        if (markers[member.id]) {
                            markers[member.id].setLatLng([member.latitude, member.longitude]);
                        } else {
                            var memberIcon = L.divIcon({className: 'custom-marker member-marker'});
                            markers[member.id] = L.marker([member.latitude, member.longitude], {icon: memberIcon})
                                .bindPopup(member.users?.name || 'Member')
                                .addTo(map);
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
            />
            {!mapLoaded && (
                <View style={[styles.container, styles.loadingOverlay]}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            )}
        </View>
    );
};

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
